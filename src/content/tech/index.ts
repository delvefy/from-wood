import type { GameMode } from '../../engine/mode';
import type { TechBranch, TechEffect, TechNode } from '../../engine/types';
import { RESOURCE_BY_ID } from '../resources';
import { CORE } from './core';
import { fillerName } from './fillers';
import { MAJORS } from './majors';
import { PATHS } from './paths';

export type { MajorSpec, PathSpec } from './specs';

// Two skill trees are generated from ONE authored source (core + majors +
// paths), laid out as a big point-UP triangle (pyramid) on an infinite
// canvas: the root (start) at the bottom-center of the base (0, 0), the
// Magic arm running left along the base into the bottom-left corner, the
// Tech arm running right into the bottom-right corner (each arm's endgame
// curls up its slant edge), and Magitech in the center — two spine columns
// (spirit x=-240, matter x=+240) climbing from the base and converging to
// the apex, where the wonders (end) crown the peak. Spine majors require one
// major from each side.
//
// - TOURNAMENT: the authored 100 nodes as-is — root, 48 majors, 51 small
//   path nodes — on the compact authored canvas.
// - VILLAGE (main): a 500-node superset. The same 100 authored nodes keep
//   their ids on a scaled-up canvas, and 400 generated filler smalls
//   (named from pools in fillers.ts) are spliced into every edge, rewiring
//   `requires` through the chain.
//
// The authored layers:
// - CORE: the hand-placed root.
// - MAJORS: 48 unlock/keystone nodes that open recipe/resource batches.
// - PATHS: chains of 51 small +1% nodes generated along each major->major
//   edge; the target major's requirement is rewired through the chain.
//
// Design rules:
// - No speed effects anywhere. Only efficiency, always to BOTH buckets:
//   every magic/tech node gives +1% gather and +1% craft output, every
//   magitech node +2% of each (majors, smalls and fillers alike).
// - `major` nodes unlock content (resources/recipes) and render larger.
// - Coordinates are world px; keep ~150px between connected nodes.

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// ---- Balance curves ---------------------------------------------------------
// Authored costs and times only set the tree's SHAPE: cost entries fix each
// node's resource mix, and the authored 30s..86400s times fix how eras relate.
// The build below rescales both onto per-mode targets:
// - Time: each tree's researchTimeSeconds is baked so the whole tree sums to
//   RESEARCH_TOTAL_SECONDS of continuous research. The village targets ~100
//   days of TOTAL play (research + gathering the materials): the research
//   queue is 50 days, and with a full crew (~100 gatherers / 10 crafters,
//   `npm run simulate -- 100 10 main`) material stalls add roughly as much
//   again. The tournament research queue is 1 day (~48h wall clock).
// - Cost: each node's cost value (amounts × base sell price) follows a power
//   curve of its authored time. Each mode has its own curve, baked into its
//   own nodes.
export const RESEARCH_TOTAL_SECONDS: Record<GameMode, number> = {
  main: 50 * 86_400, // half of the ~100-day village target; gathering fills the rest
  tournament: 24 * 3_600, // 1 day
};

// The tournament curve is tuned with `npm run simulate`
// (scripts/simulate-tournament.ts) so a player with 100 gatherers and 10
// crafters finishes the whole tree in ~48h — the 24h research queue plus
// ~24h of material stalls. Re-run the sim after changing curves, recipes or
// worker math.
//
// The village curve shares the tournament's cheap start (so a fresh village
// gets moving within its first few gather cycles) and ends ~70× the
// tournament's final node — costs spread smoothly between the two instead of
// the old flat ×100 on every node. The end value is tuned with the sim so
// material stalls add ~50 days on top of the 50-day research queue.
const TOURNAMENT_COST_CURVE = { rootValue: 2, endValue: 900_000 }; // 1 wood + 1 water at the root
const VILLAGE_COST_CURVE = { rootValue: 2, endValue: 71_000_000 };

const AUTHORED_TIME = { root: 30, end: 86_400 };

// Later nodes in a path chain run this much longer than the one before —
// which also grows their cost, since cost follows authored time.
const PATH_STEP_GROWTH = 1.3;

const price = (id: string) => RESOURCE_BY_ID[id]?.baseSellPrice ?? 0;
const costValue = (cost: Record<string, number>): number =>
  Object.entries(cost).reduce((sum, [id, n]) => sum + n * price(id), 0);

function targetCostValue(
  authoredSeconds: number,
  curve: { rootValue: number; endValue: number },
): number {
  const { rootValue, endValue } = curve;
  const exp = Math.log(endValue / rootValue) / Math.log(AUTHORED_TIME.end / AUTHORED_TIME.root);
  return rootValue * (authoredSeconds / AUTHORED_TIME.root) ** exp;
}

// Amounts ≥ 100 round to two significant digits so scaled costs read cleanly.
const niceAmount = (n: number): number => {
  if (n < 100) return Math.round(n);
  const unit = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / unit) * unit;
};

// Rescales a cost mix so its value lands on `target`. Every ingredient stays
// in the cost (design rule: exactly 2 per node) at a minimum of 1, even when
// a small budget can't really afford one locomotive; the cheapest ingredient
// absorbs whatever gap rounding leaves behind.
function scaledCost(mix: Record<string, number>, target: number): Record<string, number> {
  const value = costValue(mix);
  if (value <= 0) return { ...mix };
  const scale = target / value;
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(mix)) {
    out[id] = Math.max(1, niceAmount(n * scale));
  }
  const cheapest = Object.keys(mix).reduce((a, b) => (price(a) <= price(b) ? a : b));
  const gap = target - costValue(out);
  if (gap >= price(cheapest)) {
    out[cheapest] = Math.max(1, out[cheapest] + Math.round(gap / price(cheapest)));
  }
  return out;
}

// Efficiency is uniform and branch-keyed: magic/tech nodes give +1% to
// gathering AND crafting, magitech nodes +2% to both.
function branchBonus(branch: TechBranch): { percent: number; effects: TechEffect[] } {
  const percent = branch === 'magitech' ? 2 : 1;
  return {
    percent,
    effects: [
      { kind: 'gatherEfficiency', resource: 'all', percent },
      { kind: 'craftEfficiency', percent },
    ],
  };
}

function smallMeta(branch: TechBranch): { description: string; effects: TechEffect[] } {
  const { percent, effects } = branchBonus(branch);
  return { description: `Gather +${percent}%, craft output +${percent}%`, effects };
}

// ---- Authored assembly ------------------------------------------------------
// Builds the 100 authored nodes with AUTHORED costs (mixes) and times
// (seconds); the per-mode bakes below turn those into real prices/durations.
const pos: Record<string, { x: number; y: number }> = {};
for (const n of CORE) pos[n.id] = { x: n.x, y: n.y };
for (const m of MAJORS) pos[m.id] = { x: m.x, y: m.y };

// Paths: chain of small nodes interpolated between the anchors, with a slight
// alternating perpendicular wiggle so runs don't look laser-straight.
const rewire: Record<string, Record<string, string>> = {}; // to -> (from -> last chain node)
const pathNodes: TechNode[] = [];
for (const p of PATHS) {
  const a = pos[p.from];
  const b = pos[p.to];
  if (!a || !b) throw new Error(`tech path ${p.from} -> ${p.to}: unknown anchor`);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const px = -dy / len;
  const py = dx / len;
  let prev = p.from;
  p.names.forEach((name, i) => {
    const id = slug(name);
    const t = (i + 1) / (p.names.length + 1);
    const wiggle =
      p.bow ??
      (i % 2 === (p.flip ? 1 : 0) ? 22 : -22) * (p.names.length > 1 ? 1 : 0);
    pathNodes.push({
      id,
      name,
      ...smallMeta(p.branch),
      cost: p.cost,
      researchTimeSeconds: Math.round(p.time * PATH_STEP_GROWTH ** i),
      requires: [prev],
      branch: p.branch,
      x: Math.round(a.x + dx * t + px * wiggle),
      y: Math.round(a.y + dy * t + py * wiggle),
    });
    prev = id;
  });
  (rewire[p.to] ??= {})[p.from] = prev;
}

// Majors: batch unlocks plus the same branch bonus every node carries
// (+1% gather & craft, +2% each on the spines).
const majorNodes: TechNode[] = MAJORS.map((m) => ({
  id: m.id,
  name: m.name,
  description: m.description,
  cost: m.cost,
  researchTimeSeconds: m.time,
  requires: m.requires.map((r) => rewire[m.id]?.[r] ?? r),
  effects: [
    ...(m.resources ?? []).map((id) => ({ kind: 'unlockResource', id }) as const),
    ...m.recipes.map((id) => ({ kind: 'unlockRecipe', id }) as const),
    ...branchBonus(m.branch).effects,
  ],
  branch: m.branch,
  x: m.x,
  y: m.y,
  major: true,
}));

const AUTHORED: TechNode[] = [...CORE, ...majorNodes, ...pathNodes];
const AUTHORED_BY_ID: Record<string, TechNode> = Object.fromEntries(
  AUTHORED.map((n) => [n.id, n]),
);

// ---- Tournament tree --------------------------------------------------------
// The authored 100 nodes on the authored canvas. Times normalize the queue to
// one day (rounded at village scale first, then compressed, so the two trees
// keep exactly proportional durations on shared ids).
const AUTHORED_TOTAL_SECONDS = AUTHORED.reduce((sum, n) => sum + n.researchTimeSeconds, 0);
const PRE_SPLIT_TIME_SCALE = RESEARCH_TOTAL_SECONDS.main / AUTHORED_TOTAL_SECONDS;
const TOURNAMENT_COMPRESSION = RESEARCH_TOTAL_SECONDS.tournament / RESEARCH_TOTAL_SECONDS.main;

const TOURNAMENT_TREE: TechNode[] = AUTHORED.map((n) => ({
  ...n,
  cost: scaledCost(n.cost, targetCostValue(n.researchTimeSeconds, TOURNAMENT_COST_CURVE)),
  researchTimeSeconds:
    Math.round(n.researchTimeSeconds * PRE_SPLIT_TIME_SCALE) * TOURNAMENT_COMPRESSION,
}));

// ---- Village tree -----------------------------------------------------------
// The same 100 nodes on a scaled-up canvas, plus generated filler smalls
// spliced into every edge until the tree hits exactly VILLAGE_NODE_TARGET.
const VILLAGE_NODE_TARGET = 500;
const VILLAGE_SPACING = 150; // px between chain neighbours once fillers are in

const edges = AUTHORED.flatMap((n) =>
  n.requires.map((from) => {
    const a = AUTHORED_BY_ID[from];
    return { from, to: n.id, length: Math.hypot(n.x - a.x, n.y - a.y) };
  }),
);

const FILL_TOTAL = VILLAGE_NODE_TARGET - AUTHORED.length;
const TOTAL_EDGE_LENGTH = edges.reduce((sum, e) => sum + e.length, 0);

// Canvas scale chosen so that, with FILL_TOTAL nodes spliced in, the average
// gap along an edge lands on VILLAGE_SPACING.
const VILLAGE_SCALE = (VILLAGE_SPACING * (FILL_TOTAL + edges.length)) / TOTAL_EDGE_LENGTH;

// Fillers per edge, proportional to scaled edge length, adjusted by largest
// remainder (deterministically) so the counts sum to exactly FILL_TOTAL.
const rawQuota = edges.map((e) => Math.max(0, (e.length * VILLAGE_SCALE) / VILLAGE_SPACING - 1));
const fillCounts = rawQuota.map(Math.floor);
{
  let diff = FILL_TOTAL - fillCounts.reduce((sum, n) => sum + n, 0);
  const byRemainder = rawQuota
    .map((q, i) => ({ frac: q - fillCounts[i], i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
    .map((r) => r.i);
  for (let k = 0; diff > 0; k = (k + 1) % byRemainder.length) {
    fillCounts[byRemainder[k]]++;
    diff--;
  }
  for (let k = byRemainder.length - 1; diff < 0; k = (k - 1 + byRemainder.length) % byRemainder.length) {
    if (fillCounts[byRemainder[k]] > 0) {
      fillCounts[byRemainder[k]]--;
      diff++;
    }
  }
}

// Village copies of the authored nodes (scaled positions, requires rewired
// through fillers below). Costs/times still authored here; baked after.
const villageBase: Record<string, TechNode> = Object.fromEntries(
  AUTHORED.map((n) => [
    n.id,
    {
      ...n,
      requires: [...n.requires],
      x: Math.round(n.x * VILLAGE_SCALE),
      y: Math.round(n.y * VILLAGE_SCALE),
    },
  ]),
);

const fillerCounters: Record<TechBranch, number> = { magic: 0, tech: 0, magitech: 0 };
const villageFillers: TechNode[] = [];
edges.forEach((edge, idx) => {
  const count = fillCounts[idx];
  if (count <= 0) return;
  const parent = villageBase[edge.from];
  const child = villageBase[edge.to];
  const dx = child.x - parent.x;
  const dy = child.y - parent.y;
  const len = Math.hypot(dx, dy);
  const px = -dy / len;
  const py = dx / len;
  // Authored seconds interpolate geometrically parent -> child, so filler
  // costs (via the curve) ramp smoothly across the edge. The cost MIX is the
  // PARENT's: always obtainable by the time the chain starts — the child's
  // mix may charge materials that another of its parents unlocks.
  const tFrom = AUTHORED_BY_ID[edge.from].researchTimeSeconds;
  const tTo = AUTHORED_BY_ID[edge.to].researchTimeSeconds;
  // Fillers on same-branch edges inherit that branch. On cross-branch edges
  // (the arm -> spine links) the branch follows POSITION instead — magic in
  // the bottom-left region, tech in the bottom-right, magitech in the center
  // column and the whole peak above the arms — so the long cross-links read
  // as arm-colored near the base and magitech as they climb to the apex.
  // Thresholds are authored px, scaled to village canvas units.
  const branchAt = (x: number, y: number): TechBranch =>
    parent.branch === child.branch
      ? child.branch
      : Math.abs(x) <= 300 * VILLAGE_SCALE || y < -1400 * VILLAGE_SCALE
        ? 'magitech'
        : x < 0
          ? 'magic'
          : 'tech';
  let prev = edge.from;
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    const branch = branchAt(parent.x + dx * t, parent.y + dy * t);
    const name = fillerName(branch, fillerCounters[branch]++);
    const id = slug(name);
    const offset = i % 2 === 0 ? 26 : -26;
    villageFillers.push({
      id,
      name,
      ...smallMeta(branch),
      cost: AUTHORED_BY_ID[edge.from].cost,
      researchTimeSeconds: tFrom * (tTo / tFrom) ** t,
      requires: [prev],
      branch,
      x: Math.round(parent.x + dx * t + px * offset),
      y: Math.round(parent.y + dy * t + py * offset),
    });
    prev = id;
  }
  child.requires = child.requires.map((r) => (r === edge.from ? prev : r));
});

// Village-only early-game pacing: the root and the four branch openers one
// hop out research in seconds regardless of the 100-day normalization, so a
// fresh village gets moving within its first few gather cycles. (Their costs
// need no override — the village curve starts as cheap as the tournament's.)
const VILLAGE_TIME_OVERRIDES: Record<string, number> = {
  basic_tools: 30,
  sharp_tools: 45,
  wood_attunement: 45,
  runic_saws: 45,
  mana_lathe: 45,
};

const villageAuthored: TechNode[] = [...AUTHORED.map((n) => villageBase[n.id]), ...villageFillers];

// Where several cross-links converge on the same spine major, filler chains
// from different edges can land on top of each other. A few grid-hashed
// repulsion sweeps push overlapping pairs to ~a node's footprint apart —
// fillers move, authored nodes stay pinned, ids (and thus saves) are
// untouched. Deterministic and cheap (~200k distance checks at module load).
{
  const MIN_GAP = 118; // nodes render ~108px wide
  const movable = new Set(villageFillers.map((n) => n.id));
  for (let sweep = 0; sweep < 24; sweep++) {
    const grid = new Map<string, TechNode[]>();
    const keyOf = (x: number, y: number) => `${Math.floor(x / MIN_GAP)},${Math.floor(y / MIN_GAP)}`;
    for (const n of villageAuthored) {
      const key = keyOf(n.x, n.y);
      (grid.get(key) ?? grid.set(key, []).get(key)!).push(n);
    }
    let moved = false;
    for (const n of villageAuthored) {
      const cx = Math.floor(n.x / MIN_GAP);
      const cy = Math.floor(n.y / MIN_GAP);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          for (const m of grid.get(`${gx},${gy}`) ?? []) {
            if (m.id <= n.id) continue; // each pair once
            const d = Math.hypot(n.x - m.x, n.y - m.y);
            if (d >= MIN_GAP) continue;
            // Exactly-coincident pairs get a deterministic split direction.
            const ux = d > 0 ? (n.x - m.x) / d : 1;
            const uy = d > 0 ? (n.y - m.y) / d : 0;
            const push = (MIN_GAP - d) / (movable.has(n.id) && movable.has(m.id) ? 2 : 1) + 1;
            if (movable.has(n.id)) {
              n.x = Math.round(n.x + ux * push);
              n.y = Math.round(n.y + uy * push);
              moved = true;
            }
            if (movable.has(m.id)) {
              m.x = Math.round(m.x - ux * push);
              m.y = Math.round(m.y - uy * push);
              moved = true;
            }
          }
        }
      }
    }
    if (!moved) break;
  }
}
const VILLAGE_AUTHORED_TOTAL = villageAuthored.reduce((sum, n) => sum + n.researchTimeSeconds, 0);
const VILLAGE_TIME_SCALE = RESEARCH_TOTAL_SECONDS.main / VILLAGE_AUTHORED_TOTAL;

const VILLAGE_TREE: TechNode[] = villageAuthored.map((n) => ({
  ...n,
  cost: scaledCost(n.cost, targetCostValue(n.researchTimeSeconds, VILLAGE_COST_CURVE)),
  researchTimeSeconds:
    VILLAGE_TIME_OVERRIDES[n.id] ?? Math.max(1, Math.round(n.researchTimeSeconds * VILLAGE_TIME_SCALE)),
}));

if (VILLAGE_TREE.length !== VILLAGE_NODE_TARGET) {
  throw new Error(`village tree has ${VILLAGE_TREE.length} nodes, expected ${VILLAGE_NODE_TARGET}`);
}

// ---- Per-mode access --------------------------------------------------------
// Costs and durations are baked into each tree's nodes, so consumers read
// node.cost / node.researchTimeSeconds directly — just make sure the node
// came from the right mode's tree.
export const TECH_TREES: Record<GameMode, TechNode[]> = {
  main: VILLAGE_TREE,
  tournament: TOURNAMENT_TREE,
};

const TECH_BY_ID_BY_MODE: Record<GameMode, Record<string, TechNode>> = {
  main: Object.fromEntries(VILLAGE_TREE.map((t) => [t.id, t])),
  tournament: Object.fromEntries(TOURNAMENT_TREE.map((t) => [t.id, t])),
};

export function techTree(mode: GameMode): TechNode[] {
  return TECH_TREES[mode];
}

export function techById(mode: GameMode): Record<string, TechNode> {
  return TECH_BY_ID_BY_MODE[mode];
}

// Effects (unlocks and efficiency percents) are identical wherever an id
// exists in both trees, and tournament ids are a subset of village ids — so
// effect lookups (multiplier recomputation) can stay mode-blind.
export const TECH_EFFECTS_BY_ID: Record<string, TechNode> = TECH_BY_ID_BY_MODE.main;
