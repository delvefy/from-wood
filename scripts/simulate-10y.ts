// 10-year whale simulation: run with
//   node --import tsx scripts/simulate-10y.ts [years]
//
// Models a maxed-out account playing the VILLAGE perfectly for N years:
// - All three managers (gather 2x, craft 2x, sell price 2x).
// - 100 gatherer packs (+1000 base gatherers) and 100 crafter packs
//   (+100 base crafters) — base workers never raise hire prices, so hired
//   workers start from the bottom of the cost curve.
// - Phase 1: research the whole 500-node tree. The single research slot is
//   the bottleneck (~100 days); the oversized crew collects every node's
//   materials within days, and all spare hands run the income plan.
// - Phase 2: pure economy. A tiny LP picks the best steady-state mix of
//   gather/craft chains to sell (at most two chains are ever optimal), and
//   its dual prices drive greedy bang-per-buck hiring of new workers.
//   Hiring is worth-neutral (totalValue counts sunk hire credits), so
//   perfect play buys whenever a worker adds any income.
import { RECIPES, RECIPE_BY_ID } from '../src/content/recipes';
import { RESOURCES, RESOURCE_BY_ID } from '../src/content/resources';
import { techTree } from '../src/content/tech';
import { computeMultipliers, harvestMultiplier } from '../src/engine/multipliers';

const YEARS = Number(process.argv[2] ?? 10);
const T_END = YEARS * 365.25 * 86_400;
const DT = 30; // phase-1 step; phase 2 is event-driven

// Premium account: managers halve cycle times and double sell prices.
const GATHER_F = 0.5;
const CRAFT_F = 0.5;
const SELL_F = 2;
const BASE_G = 1000; // 100 gatherer packs
const BASE_C = 100; // 100 crafter packs

const TECH = techTree('main');
const TECH_BY_ID = Object.fromEntries(TECH.map((n) => [n.id, n]));
const price = (id: string) => RESOURCE_BY_ID[id]?.baseSellPrice ?? 0;

// ---- Player state -----------------------------------------------------------------
let t = 0;
let credits = 0;
let hiredG = 1; // owned hired gatherers (starts at the free 1)
let hiredC = 0;
const stock: Record<string, number> = {};
const unlockedResources = new Set(RESOURCES.filter((r) => r.unlockedByDefault).map((r) => r.id));
const unlockedRecipes = new Set(RECIPES.filter((r) => r.unlockedByDefault).map((r) => r.id));
const researched = new Set<string>();
const queue: string[] = [];
let researchProgress = 0;
let multipliers = computeMultipliers([], 'main');

const totalG = () => BASE_G + hiredG;
const totalC = () => BASE_C + hiredC;
const nextGCost = () => 1.15 ** (hiredG - 1); // GATHERER: hireCost 1, growth 1.15, starting 1
const nextCCost = () => 50 * 4 ** hiredC; // CRAFTER: hireCost 50, growth 4, starting 0

const hiredValue = () => (1.15 ** (hiredG - 1) - 1) / 0.15 + (50 * (4 ** hiredC - 1)) / 3;
const techValue = () => {
  let sum = 0;
  for (const id of [...researched, ...queue]) {
    for (const [rid, n] of Object.entries(TECH_BY_ID[id].cost)) sum += n * price(rid);
  }
  return sum;
};
const stockValue = () =>
  Object.entries(stock).reduce((sum, [id, n]) => sum + n * price(id) * SELL_F, 0);
const worth = () => credits + hiredValue() + techValue() + stockValue();

// ---- Income LP ----------------------------------------------------------------------
// Steady-state cost of producing 1 unit/s of an item: gatherer-seconds (gs)
// and crafter-seconds (cs) per unit, expanded through the (unique) recipe
// chain. Craft output multiplier scales outputs, so each stage divides the
// upstream needs by (outputCount x m).
interface ChainCost {
  gs: number;
  cs: number;
}
const recipeFor: Record<string, (typeof RECIPES)[number]> = {};
for (const r of RECIPES) recipeFor[Object.keys(r.outputs)[0]] = r;

function chainCosts(): Map<string, ChainCost> {
  const m = multipliers.craftOutput; // == gatherAll (every node boosts both)
  const memo = new Map<string, ChainCost | null>();
  const costOf = (id: string): ChainCost | null => {
    if (memo.has(id)) return memo.get(id)!;
    memo.set(id, null); // cycle guard
    const r = recipeFor[id];
    if (r && unlockedRecipes.has(r.id)) {
      const out = r.outputs[id] * m;
      let gs = 0;
      let cs = (r.craftTimeSeconds * CRAFT_F) / out;
      for (const [inp, q] of Object.entries(r.inputs)) {
        const c = costOf(inp);
        if (!c) return null;
        gs += (c.gs * q) / out;
        cs += (c.cs * q) / out;
      }
      memo.set(id, { gs, cs });
    } else if (!r && (RESOURCE_BY_ID[id]?.harvestAmount ?? 0) > 0 && unlockedResources.has(id)) {
      memo.set(id, {
        gs: (RESOURCE_BY_ID[id].extractTimeSeconds * GATHER_F) / harvestMultiplier(multipliers, id),
        cs: 0,
      });
    }
    return memo.get(id)!;
  };
  const out = new Map<string, ChainCost>();
  for (const def of RESOURCES) {
    const c = costOf(def.id);
    if (c && def.baseSellPrice > 0) out.set(def.id, c);
  }
  return out;
}

// max sum(x_i v_i) s.t. sum(x_i gs_i) <= G, sum(x_i cs_i) <= C. Two
// constraints, so the optimum uses at most two items; Pareto-prune per-credit
// costs, then enumerate singles and pairs. Duals (lam per gatherer-second,
// mu per crafter-second) price marginal workers for the hiring policy.
interface LpResult {
  R: number;
  lam: number;
  mu: number;
  plan: { id: string; rate: number }[];
}
let lpCache: { key: string; chains: Map<string, ChainCost> } | null = null;

function solveLp(G: number, C: number): LpResult {
  const key = `${researched.size}`;
  if (!lpCache || lpCache.key !== key) lpCache = { key, chains: chainCosts() };
  const cands = [...lpCache.chains.entries()]
    .map(([id, c]) => ({ id, v: price(id) * SELL_F, ...c }))
    .filter((c) => c.v > 0)
    // Pareto prune on per-credit worker costs.
    .sort((a, b) => a.gs / a.v - b.gs / b.v || a.cs / a.v - b.cs / b.v);
  const front: typeof cands = [];
  for (const c of cands) {
    if (front.length === 0 || c.cs / c.v < front[front.length - 1].cs / front[front.length - 1].v - 1e-15) {
      front.push(c);
    }
  }

  let best: LpResult = { R: 0, lam: 0, mu: 0, plan: [] };
  for (const c of front) {
    const x = Math.min(c.gs > 0 ? G / c.gs : Infinity, c.cs > 0 ? C / c.cs : Infinity);
    if (!isFinite(x)) continue;
    const R = x * c.v;
    if (R > best.R) {
      const gBound = c.gs > 0 && G / c.gs <= (c.cs > 0 ? C / c.cs : Infinity);
      best = {
        R,
        lam: gBound ? c.v / c.gs : 0,
        mu: gBound ? 0 : c.v / c.cs,
        plan: [{ id: c.id, rate: x }],
      };
    }
  }
  for (let i = 0; i < front.length; i++) {
    for (let j = i + 1; j < front.length; j++) {
      const a = front[i];
      const b = front[j];
      const det = a.gs * b.cs - b.gs * a.cs;
      if (Math.abs(det) < 1e-12) continue;
      const x = (G * b.cs - C * b.gs) / det;
      const y = (C * a.gs - G * a.cs) / det;
      if (x < 0 || y < 0) continue;
      const R = x * a.v + y * b.v;
      if (R > best.R) {
        best = {
          R,
          lam: Math.max(0, (a.v * b.cs - b.v * a.cs) / det),
          mu: Math.max(0, (a.gs * b.v - b.gs * a.v) / det),
          plan: [
            { id: a.id, rate: x },
            { id: b.id, rate: y },
          ],
        };
      }
    }
  }
  return best;
}

// Greedy bang-per-buck hiring off the LP duals. Buying is worth-neutral and
// income-positive, so buy whichever affordable worker adds the most income
// per credit; repeat until nothing affordable helps.
function buyWorkers(freeG: () => number, freeC: () => number): boolean {
  let bought = false;
  for (;;) {
    const { lam, mu } = solveLp(freeG(), freeC());
    const gRatio = lam / nextGCost();
    const cRatio = mu / nextCCost();
    if (gRatio >= cRatio && lam > 0 && credits >= nextGCost()) {
      credits -= nextGCost();
      hiredG++;
    } else if (cRatio > gRatio && mu > 0 && credits >= nextCCost()) {
      credits -= nextCCost();
      hiredC++;
    } else {
      return bought;
    }
    bought = true;
  }
}

// ---- Phase 1: research (planner adapted from simulate-tournament.ts) ---------------
const depthMemo: Record<string, number> = {};
function depth(id: string): number {
  if (depthMemo[id] !== undefined) return depthMemo[id];
  depthMemo[id] = 0;
  const r = recipeFor[id];
  if (r) depthMemo[id] = 1 + Math.max(...Object.keys(r.inputs).map(depth));
  return depthMemo[id];
}

function expand(demand: Record<string, number>): {
  runsNeeded: Record<string, number>;
  rawDeficit: Record<string, number>;
} {
  const runsNeeded: Record<string, number> = {};
  const rawDeficit: Record<string, number> = {};
  const items = Object.keys(demand).sort((a, b) => depth(b) - depth(a));
  const pending = { ...demand };
  while (items.length > 0) {
    const id = items.shift()!;
    const deficit = (pending[id] ?? 0) - (stock[id] ?? 0);
    if (deficit <= 0) continue;
    const recipe = recipeFor[id];
    if (recipe && unlockedRecipes.has(recipe.id)) {
      const perRun = recipe.outputs[id] * multipliers.craftOutput;
      const runs = Math.ceil(deficit / perRun);
      runsNeeded[recipe.id] = (runsNeeded[recipe.id] ?? 0) + runs;
      for (const [inp, n] of Object.entries(recipe.inputs)) {
        if ((pending[inp] ?? 0) === 0) items.splice(sortedIndex(items, inp), 0, inp);
        pending[inp] = (pending[inp] ?? 0) + n * runs;
      }
    } else if (!recipe && unlockedResources.has(id)) {
      rawDeficit[id] = deficit;
    }
  }
  return { runsNeeded, rawDeficit };
}

function sortedIndex(items: string[], id: string): number {
  const d = depth(id);
  for (let i = 0; i < items.length; i++) if (depth(items[i]) <= d) return i;
  return items.length;
}

let gatherAssignment: Record<string, number> = {};
let craftAssignment: Record<string, number> = {};
const gatherProgress: Record<string, number> = {};
const craftProgress: Record<string, number> = {};

function assignCrafters(runs: Record<string, number>, count: number): number {
  const runnable = Object.keys(runs).filter((rid) =>
    Object.entries(RECIPE_BY_ID[rid].inputs).every(([id, n]) => (stock[id] ?? 0) >= n),
  );
  while (count > 0) {
    let best = '';
    let bestWork = 0;
    for (const rid of runnable) {
      const work =
        ((runs[rid] - (craftAssignment[rid] ?? 0)) * RECIPE_BY_ID[rid].craftTimeSeconds) /
        ((craftAssignment[rid] ?? 0) + 1);
      if (work > bestWork) {
        bestWork = work;
        best = rid;
      }
    }
    if (!best) break;
    craftAssignment[best] = (craftAssignment[best] ?? 0) + 1;
    count--;
  }
  return count;
}

// Assigns workers to research materials; returns the spare crew that the
// analytic income model gets to use this step.
function plan(): { freeG: number; freeC: number } {
  const remaining = TECH.filter((n) => !researched.has(n.id) && !queue.includes(n.id));
  const frontier = remaining
    .filter((n) => n.requires.every((r) => researched.has(r) || queue.includes(r)))
    .sort((a, b) => a.researchTimeSeconds - b.researchTimeSeconds)
    .slice(0, 6);
  const sumCosts = (nodes: typeof remaining) => {
    const demand: Record<string, number> = {};
    for (const node of nodes) {
      for (const [id, n] of Object.entries(node.cost)) demand[id] = (demand[id] ?? 0) + n;
    }
    return demand;
  };
  const pri = expand(sumCosts(frontier));
  const all = expand(sumCosts(remaining));

  craftAssignment = {};
  let freeC = assignCrafters(pri.runsNeeded, totalC());
  freeC = assignCrafters(all.runsNeeded, freeC);

  gatherAssignment = {};
  const weights: Record<string, number> = {};
  const addWeights = (raw: Record<string, number>, boost: number) => {
    for (const [id, deficit] of Object.entries(raw)) {
      const def = RESOURCE_BY_ID[id];
      const w =
        (deficit * def.extractTimeSeconds * GATHER_F) /
        (def.harvestAmount * harvestMultiplier(multipliers, id));
      weights[id] = (weights[id] ?? 0) + w * boost;
    }
  };
  addWeights(all.rawDeficit, 1);
  addWeights(pri.rawDeficit, 20);
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
  let freeG = totalG();
  if (totalWeight > 0) {
    for (const [id, w] of Object.entries(weights).sort((a, b) => b[1] - a[1])) {
      const n = Math.min(freeG, Math.max(1, Math.round((totalG() * w) / totalWeight)));
      gatherAssignment[id] = n;
      freeG -= n;
      if (freeG <= 0) break;
    }
  }
  return { freeG, freeC };
}

function completeResearch(id: string): void {
  researched.add(id);
  for (const effect of TECH_BY_ID[id].effects) {
    if (effect.kind === 'unlockResource') unlockedResources.add(effect.id);
    if (effect.kind === 'unlockRecipe') {
      unlockedRecipes.add(effect.id);
      for (const out of Object.keys(RECIPE_BY_ID[effect.id].outputs)) unlockedResources.add(out);
    }
  }
  multipliers = computeMultipliers([...researched], 'main');
}

let lastQueuedAt = 0;
function tryQueue(): void {
  for (;;) {
    const candidates = TECH.filter(
      (n) =>
        !researched.has(n.id) &&
        !queue.includes(n.id) &&
        n.requires.every((r) => researched.has(r) || queue.includes(r)) &&
        Object.entries(n.cost).every(([id, need]) => (stock[id] ?? 0) >= need),
    ).sort((a, b) => a.researchTimeSeconds - b.researchTimeSeconds);
    if (candidates.length === 0) return;
    const node = candidates[0];
    for (const [id, n] of Object.entries(node.cost)) stock[id] = (stock[id] ?? 0) - n;
    queue.push(node.id);
    lastQueuedAt = t;
  }
}

// ---- Phase 1 loop -------------------------------------------------------------------
console.log(`=== ${YEARS}-year whale simulation ===`);
console.log(
  `managers: gather 2x, craft 2x, sell 2x | base workers: ${BASE_G} gatherers + ${BASE_C} crafters`,
);
console.log('');

let income = solveLp(0, 0); // no spare workers yet
let stepsSinceLp = 0;

while (researched.size < TECH.length && t < T_END) {
  const { freeG, freeC } = plan();
  tryQueue();

  // Gathering toward research materials.
  for (const [id, assigned] of Object.entries(gatherAssignment)) {
    const def = RESOURCE_BY_ID[id];
    const cycle = def.extractTimeSeconds * GATHER_F;
    const progress = (gatherProgress[id] ?? 0) + DT;
    const cycles = Math.floor(progress / cycle);
    if (cycles > 0) {
      stock[id] =
        (stock[id] ?? 0) + cycles * assigned * def.harvestAmount * harvestMultiplier(multipliers, id);
    }
    gatherProgress[id] = progress % cycle;
  }

  // Research slot.
  let remaining = DT;
  let unlocksChanged = false;
  while (queue.length > 0 && remaining > 0) {
    const node = TECH_BY_ID[queue[0]];
    const needed = node.researchTimeSeconds - researchProgress;
    if (remaining < needed) {
      researchProgress += remaining;
      remaining = 0;
      break;
    }
    remaining -= needed;
    queue.shift();
    researchProgress = 0;
    completeResearch(node.id);
    unlocksChanged = true;
    tryQueue();
  }

  // Crafting toward research materials.
  for (const [rid, assigned] of Object.entries(craftAssignment)) {
    const recipe = RECIPE_BY_ID[rid];
    const cycle = recipe.craftTimeSeconds * CRAFT_F;
    const progress = (craftProgress[rid] ?? 0) + DT;
    for (let i = Math.floor(progress / cycle); i > 0; i--) {
      let runs = assigned;
      for (const [id, n] of Object.entries(recipe.inputs)) {
        runs = Math.min(runs, Math.floor((stock[id] ?? 0) / n));
      }
      if (runs <= 0) break;
      for (const [id, n] of Object.entries(recipe.inputs)) stock[id] = (stock[id] ?? 0) - n * runs;
      for (const [id, n] of Object.entries(recipe.outputs)) {
        stock[id] = (stock[id] ?? 0) + n * runs * multipliers.craftOutput;
      }
    }
    craftProgress[rid] = progress % cycle;
  }

  // Spare crew earns the LP income analytically; refresh the plan whenever
  // the tree state moved or every 2400s (spare counts drift as stocks fill).
  if (unlocksChanged || ++stepsSinceLp >= 80) {
    stepsSinceLp = 0;
    income = solveLp(freeG, freeC);
    buyWorkers(
      () => freeG + (hiredG - 1),
      () => freeC + hiredC,
    );
    income = solveLp(freeG, freeC);
  }
  credits += income.R * DT;

  t += DT;
  if (t % (10 * 86_400) < DT) {
    console.log(
      `day ${(t / 86_400).toFixed(0).padStart(3)}: researched ${researched.size}/${TECH.length}, ` +
        `credits ${credits.toExponential(2)}, income ${income.R.toFixed(0)}/s, ` +
        `hired +${hiredG - 1}g +${hiredC}c`,
    );
  }
}

const researchDoneDay = t / 86_400;
console.log('');
console.log(
  `research complete: day ${researchDoneDay.toFixed(1)} ` +
    `(all materials queued by day ${(lastQueuedAt / 86_400).toFixed(1)})`,
);

// Liquidate the leftover research stockpile and switch to the pure economy.
credits += stockValue();
for (const id of Object.keys(stock)) stock[id] = 0;

// ---- Phase 2: event-driven economy ---------------------------------------------------
console.log('');
console.log('phase 2 economy (income plan / hires update on every purchase):');
let nextReport = Math.ceil(t / (365.25 * 86_400)) * 365.25 * 86_400;

while (t < T_END) {
  buyWorkers(totalG, totalC);
  const { R, lam, mu, plan: mix } = solveLp(totalG(), totalC());
  // Next event: the better bang-per-buck purchase becomes affordable.
  const gWait = lam > 0 ? (nextGCost() - credits) / R : Infinity;
  const cWait = mu > 0 ? (nextCCost() - credits) / R : Infinity;
  const wait = Math.max(DT, Math.min(gWait, cWait));
  const step = Math.min(wait, nextReport - t, T_END - t);
  credits += R * step;
  t += step;
  if (t >= nextReport - 1e-6 && t < T_END) {
    const years = t / (365.25 * 86_400);
    console.log(
      `year ${years.toFixed(0).padStart(2)}: worth ${worth().toExponential(3)}, ` +
        `income ${R.toExponential(2)}/s, workers ${totalG()}g/${totalC()}c ` +
        `(hired +${hiredG - 1}g +${hiredC}c), selling ${mix.map((p) => p.id).join(' + ')}`,
    );
    nextReport += 365.25 * 86_400;
  }
}

// ---- Report --------------------------------------------------------------------------
const final = solveLp(totalG(), totalC());
console.log('');
console.log(`=== after ${YEARS} years ===`);
console.log(`TOTAL VALUE: ${worth().toExponential(4)} credits`);
console.log(`  credits:        ${credits.toExponential(3)}`);
console.log(`  hired workers:  ${hiredValue().toExponential(3)} (+${hiredG - 1} gatherers, +${hiredC} crafters)`);
console.log(`  tech tree:      ${techValue().toExponential(3)}`);
console.log(`final income: ${final.R.toExponential(3)} credits/s, selling ${final.plan.map((p) => `${p.id} @${p.rate.toFixed(2)}/s`).join(' + ')}`);
console.log(`final crew: ${totalG()} gatherers, ${totalC()} crafters`);
console.log(`next hire costs: gatherer ${nextGCost().toExponential(2)}, crafter ${nextCCost().toExponential(2)}`);
