// Tournament pacing simulation: run with `npm run simulate` (or
// `node --import tsx scripts/simulate-tournament.ts [gatherers] [crafters] [mode]`).
//
// Models a dedicated player — replanning every tick, never idle — using the
// same mechanics as engine/tick.ts: 30s gather cycles, per-recipe craft
// cycles limited by stock, one research slot, additive efficiency
// multipliers, costs paid when a node is queued. The bot:
// - demands the summed techCost of every not-yet-queued node, expanded
//   through unlocked recipes down to raw resources;
// - assigns crafters to needed recipes (base materials first) and gatherers
//   proportional to each raw's outstanding time-to-gather;
// - queues any affordable node whose prerequisites are researched or queued
//   (shortest research time first).
// Reports wall-clock completion time and where the research slot idled, so
// cost/time curves can be tuned against a target (~48h tournament).
import { RECIPES, RECIPE_BY_ID } from '../src/content/recipes';
import { RESOURCES, RESOURCE_BY_ID } from '../src/content/resources';
import { techTree } from '../src/content/tech';
import { computeMultipliers, harvestMultiplier } from '../src/engine/multipliers';
import type { GameMode } from '../src/engine/mode';

const GATHERERS = Number(process.argv[2] ?? 100);
const CRAFTERS = Number(process.argv[3] ?? 10);
const MODE = (process.argv[4] ?? 'tournament') as GameMode;

// Each mode has its own tree (100-node tournament, 1000-node village) with
// costs and durations baked into the nodes.
const TECH = techTree(MODE);
const TECH_BY_ID = Object.fromEntries(TECH.map((n) => [n.id, n]));
const DT = MODE === 'main' ? 30 : 10; // seconds per step; replan every step
const MAX_SIM_SECONDS = 400 * 86_400;

// ---- State ----------------------------------------------------------------------
const stock: Record<string, number> = {};
const unlockedResources = new Set(RESOURCES.filter((r) => r.unlockedByDefault).map((r) => r.id));
const unlockedRecipes = new Set(RECIPES.filter((r) => r.unlockedByDefault).map((r) => r.id));
const researched = new Set<string>();
const queue: string[] = [];
let researchProgress = 0;
let multipliers = computeMultipliers([]);
const gatherProgress: Record<string, number> = {};
const craftProgress: Record<string, number> = {};
let gatherAssignment: Record<string, number> = {};
let craftAssignment: Record<string, number> = {};

// One recipe per craftable item (recipes output exactly one item type).
const recipeFor: Record<string, (typeof RECIPES)[number]> = {};
for (const r of RECIPES) recipeFor[Object.keys(r.outputs)[0]] = r;

// Depth = longest crafting chain below an item; raws are 0. Used to expand
// demand top-down and to craft base materials first.
const depthMemo: Record<string, number> = {};
function depth(id: string): number {
  if (depthMemo[id] !== undefined) return depthMemo[id];
  depthMemo[id] = 0; // cycle/raw guard
  const r = recipeFor[id];
  if (r) depthMemo[id] = 1 + Math.max(...Object.keys(r.inputs).map(depth));
  return depthMemo[id];
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
  multipliers = computeMultipliers([...researched]);
}

// ---- Planner --------------------------------------------------------------------
// Expands a demand map (item -> qty wanted) through unlocked recipes into
// recipe runs and raw-resource deficits, walking items deepest-first so a
// consumer's input needs accumulate before the input itself is expanded.
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
    // Locked recipe/resource: nothing can be done toward it yet.
  }
  return { runsNeeded, rawDeficit };
}

function sortedIndex(items: string[], id: string): number {
  const d = depth(id);
  for (let i = 0; i < items.length; i++) if (depth(items[i]) <= d) return i;
  return items.length;
}

// Assigns up to `count` crafters over `runs`, always to the RUNNABLE recipe
// (inputs in stock for at least one run) with the most outstanding work per
// crafter. Chains cascade because the plan reruns every tick: once barkhide
// stock exists, forge bellows become runnable, then the furnace.
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

function plan(): void {
  // Priority demand: the next few researchable nodes (prereqs met, sorted by
  // research time). Background demand: every node not yet paid for — keeps
  // idle hands stockpiling for the endgame.
  const remaining = TECH.filter((n) => !researched.has(n.id) && !queue.includes(n.id));
  const frontier = remaining
    .filter((n) => n.requires.every((r) => researched.has(r) || queue.includes(r)))
    .sort((a, b) => a.researchTimeSeconds - b.researchTimeSeconds)
    .slice(0, 6);
  const sumCosts = (nodes: typeof remaining) => {
    const demand: Record<string, number> = {};
    for (const node of nodes) {
      for (const [id, n] of Object.entries(node.cost)) {
        demand[id] = (demand[id] ?? 0) + n;
      }
    }
    return demand;
  };
  const pri = expand(sumCosts(frontier));
  const all = expand(sumCosts(remaining));

  // Crafters: frontier chains first, leftovers stockpile background demand.
  craftAssignment = {};
  const left = assignCrafters(pri.runsNeeded, CRAFTERS);
  assignCrafters(all.runsNeeded, left);

  // Gatherers: proportional to outstanding one-worker gather time per raw,
  // with frontier raws weighted heavily so the next node is never starved.
  gatherAssignment = {};
  const weights: Record<string, number> = {};
  const addWeights = (raw: Record<string, number>, boost: number) => {
    for (const [id, deficit] of Object.entries(raw)) {
      const def = RESOURCE_BY_ID[id];
      const w = (deficit * def.extractTimeSeconds) / (def.harvestAmount * harvestMultiplier(multipliers, id));
      weights[id] = (weights[id] ?? 0) + w * boost;
    }
  };
  addWeights(all.rawDeficit, 1);
  addWeights(pri.rawDeficit, 20);
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
  if (totalWeight > 0) {
    let free = GATHERERS;
    for (const [id, w] of Object.entries(weights).sort((a, b) => b[1] - a[1])) {
      const n = Math.min(free, Math.max(1, Math.round((GATHERERS * w) / totalWeight)));
      gatherAssignment[id] = n;
      free -= n;
      if (free <= 0) break;
    }
  }
}

// ---- Research queueing ------------------------------------------------------------
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
  }
}

// ---- Main loop --------------------------------------------------------------------
let t = 0;
let researchIdle = 0;
let lastLogHour = -1;
const nodeDone: { id: string; t: number }[] = [];

while (researched.size < TECH.length && t < MAX_SIM_SECONDS) {
  plan();
  tryQueue();

  // Gathering (mirrors engine: shared cycle bar per resource).
  for (const [id, assigned] of Object.entries(gatherAssignment)) {
    const def = RESOURCE_BY_ID[id];
    const cycle = def.extractTimeSeconds;
    const progress = (gatherProgress[id] ?? 0) + DT;
    const cycles = Math.floor(progress / cycle);
    if (cycles > 0) {
      stock[id] = (stock[id] ?? 0) + cycles * assigned * def.harvestAmount * harvestMultiplier(multipliers, id);
    }
    gatherProgress[id] = progress % cycle;
  }

  // Research (single slot working through the queue).
  let remaining = DT;
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
    nodeDone.push({ id: node.id, t: t + (DT - remaining) });
    tryQueue();
  }
  if (queue.length === 0) researchIdle += remaining;

  // Crafting (per-cycle, stock-limited, like the engine).
  for (const [rid, assigned] of Object.entries(craftAssignment)) {
    const recipe = RECIPE_BY_ID[rid];
    const cycle = recipe.craftTimeSeconds;
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

  t += DT;
  const hour = Math.floor(t / 3600);
  if (hour !== lastLogHour && hour % (MODE === 'main' ? 96 : 4) === 0) {
    lastLogHour = hour;
    console.log(
      `t=${(t / 3600).toFixed(0).padStart(3)}h researched=${String(researched.size).padStart(3)}/${TECH.length}` +
        ` queue=${queue.length} researchIdle=${(researchIdle / 3600).toFixed(1)}h`,
    );
  }
}

// ---- Report -----------------------------------------------------------------------
console.log('');
if (researched.size < TECH.length) {
  const missing = TECH.filter((n) => !researched.has(n.id)).map((n) => n.id);
  console.log(`DID NOT FINISH after ${(t / 86_400).toFixed(1)} days; missing ${missing.length}: ${missing.slice(0, 10).join(', ')}`);
  plan();
  const frontier = TECH.filter(
    (n) => !researched.has(n.id) && n.requires.every((r) => researched.has(r)),
  );
  for (const n of frontier.slice(0, 8)) {
    const gaps = Object.entries(n.cost)
      .map(([id, need]) => `${id} ${Math.floor(stock[id] ?? 0)}/${need}`)
      .join(', ');
    console.log(`  frontier ${n.id}: ${gaps}`);
  }
  const top = Object.entries(craftAssignment).map(([rid, c]) => `${rid}×${c}`).join(', ');
  console.log(`  crafters: ${top || 'idle'}`);
  const g = Object.entries(gatherAssignment).map(([id, c]) => `${id}×${c}`).join(', ');
  console.log(`  gatherers: ${g || 'idle'}`);
} else {
  console.log(`mode=${MODE} gatherers=${GATHERERS} crafters=${CRAFTERS}`);
  console.log(`finished in ${(t / 3600).toFixed(1)}h (${(t / 86_400).toFixed(2)} days)`);
  const busy = TECH.reduce((s, n) => s + n.researchTimeSeconds, 0);
  console.log(`research busy ${(busy / 3600).toFixed(1)}h, slot idle (waiting for materials) ${(researchIdle / 3600).toFixed(1)}h`);
  const last = nodeDone.slice(-5).map((d) => `${d.id}@${(d.t / 3600).toFixed(1)}h`);
  console.log(`last nodes: ${last.join(', ')}`);
}
