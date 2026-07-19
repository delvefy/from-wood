import type { GameMode } from '../../engine/mode';
import type { TechBranch, TechEffect, TechNode } from '../../engine/types';
import { RESOURCE_BY_ID } from '../resources';
import { CORE } from './core';
import { MAJORS } from './majors';
import { PATHS } from './paths';

export type { MajorSpec, PathSpec } from './specs';

// A 100-node skill tree on an infinite canvas: the root at (0, 0) plus
// 30 Magic nodes growing LEFT (x < 0), 30 Tech nodes growing RIGHT (x > 0),
// and two Magitech spines of 20 nodes each running NORTH (y < 0, root
// included) and SOUTH (y > 0) — spine majors require one major from each
// side.
//
// The tree is assembled from three layers:
// - CORE: the hand-placed root.
// - MAJORS: 48 unlock/keystone nodes that open recipe/resource batches.
// - PATHS: chains of 51 small +1% nodes generated along each major->major
//   edge; the target major's requirement is rewired through the chain.
//
// Design rules:
// - No speed effects anywhere. Only efficiency, always to BOTH buckets:
//   every magic/tech node gives +1% gather and +1% craft output, every
//   magitech node +2% of each (majors and smalls alike).
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
// The passes below rescale both onto per-mode targets:
// - Time: node.researchTimeSeconds is baked at VILLAGE pace, normalized so the
//   whole tree sums to RESEARCH_TOTAL_SECONDS.main of continuous research.
//   Tournament runs the same queue compressed to its own total — the engine
//   and Research UI read durations through researchTime().
// - Cost: each node's cost value (amounts × base sell price) follows a power
//   curve of its authored time, from rootValue to endValue. node.cost holds
//   the village cost; tournament costs live in a side table read via techCost().
export const RESEARCH_TOTAL_SECONDS: Record<GameMode, number> = {
  main: 100 * 86_400, // 100 days of continuous research
  tournament: 24 * 3_600, // 1 day
};

// The cost curve is defined at TOURNAMENT scale and tuned with
// `npm run simulate` (scripts/simulate-tournament.ts) so a player with
// 100 gatherers and 10 crafters finishes the whole tree in ~48h — the 24h
// research queue plus ~24h of material stalls. Re-run the sim after changing
// curves, recipes or worker math. Village costs are exactly
// VILLAGE_COST_FACTOR × the tournament cost, entry for entry.
const COST_CURVE = { rootValue: 2, endValue: 900_000 }; // 1 wood + 1 water at the root
const VILLAGE_COST_FACTOR = 100;

const AUTHORED_TIME = { root: 30, end: 86_400 };

// Later nodes in a path chain run this much longer than the one before —
// which also grows their cost, since cost follows authored time.
const PATH_STEP_GROWTH = 1.3;

const price = (id: string) => RESOURCE_BY_ID[id]?.baseSellPrice ?? 0;
const costValue = (cost: Record<string, number>): number =>
  Object.entries(cost).reduce((sum, [id, n]) => sum + n * price(id), 0);

function targetCostValue(authoredSeconds: number): number {
  const { rootValue, endValue } = COST_CURVE;
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

// ---- Assembly -------------------------------------------------------------------
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
// (+1% gather & craft, +2% each on the spine).
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

const VILLAGE_TIME_SCALE =
  RESEARCH_TOTAL_SECONDS.main / AUTHORED.reduce((sum, n) => sum + n.researchTimeSeconds, 0);

const TOURNAMENT_COST: Record<string, Record<string, number>> = Object.fromEntries(
  AUTHORED.map((n) => [n.id, scaledCost(n.cost, targetCostValue(n.researchTimeSeconds))]),
);

// Baked at village pace/prices — village cost is the tournament cost ×100,
// entry for entry. Tournament reads go through the helpers below.
export const TECH: TechNode[] = AUTHORED.map((node) => ({
  ...node,
  cost: Object.fromEntries(
    Object.entries(TOURNAMENT_COST[node.id]).map(([id, n]) => [id, n * VILLAGE_COST_FACTOR]),
  ),
  researchTimeSeconds: Math.round(node.researchTimeSeconds * VILLAGE_TIME_SCALE),
}));

export const TECH_BY_ID: Record<string, TechNode> = Object.fromEntries(
  TECH.map((t) => [t.id, t]),
);

// The first five nodes — the root and the four branch openers one hop out —
// are cheap and fast so a fresh village gets moving within its first few
// gather cycles; the ramp starts one node later.
const FIRST_FIVE = [
  'basic_tools',
  'sharp_tools', // tech opener
  'wood_attunement', // magic opener
  'runic_saws', // north spine opener
  'mana_lathe', // south spine opener
];

// Village-only early-game pacing, cost side: the first five are 100× cheaper
// than the ×100 village pricing would make them (i.e. at tournament prices).
// Applied at read time (like the time overrides below) so the rest of the
// tree keeps its curve values.
const VILLAGE_CHEAP_FACTOR = 100;
const VILLAGE_COST_OVERRIDES: Record<string, Record<string, number>> = Object.fromEntries(
  FIRST_FIVE.map((id) => [
    id,
    Object.fromEntries(
      Object.entries(TECH_BY_ID[id].cost).map(([res, n]) => [
        res,
        Math.max(1, Math.round(n / VILLAGE_CHEAP_FACTOR)),
      ]),
    ),
  ]),
);

export function techCost(node: TechNode, mode: GameMode): Record<string, number> {
  if (mode === 'tournament') return TOURNAMENT_COST[node.id] ?? node.cost;
  return VILLAGE_COST_OVERRIDES[node.id] ?? node.cost;
}

// Village-only early-game pacing, time side: the first five research in
// seconds regardless of what the 100-day normalization would give them.
// Applied at read time so the rest of the tree (and all tournament times)
// keep their normalized values.
const VILLAGE_TIME_OVERRIDES: Record<string, number> = {
  basic_tools: 30,
  sharp_tools: 45,
  wood_attunement: 45,
  runic_saws: 45,
  mana_lathe: 45,
};

// Tournament compresses the village queue by a flat factor (1 day / 100 days).
export function researchTimeFactor(mode: GameMode): number {
  return RESEARCH_TOTAL_SECONDS[mode] / RESEARCH_TOTAL_SECONDS.main;
}

export function researchTime(node: TechNode, mode: GameMode): number {
  if (mode === 'main') {
    return VILLAGE_TIME_OVERRIDES[node.id] ?? node.researchTimeSeconds;
  }
  return node.researchTimeSeconds * researchTimeFactor(mode);
}
