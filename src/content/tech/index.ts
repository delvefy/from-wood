import type { GameMode } from '../../engine/mode';
import type { TechEffect, TechNode } from '../../engine/types';
import { RESOURCE_BY_ID } from '../resources';
import { CLUSTERS } from './clusters';
import { CORE } from './core';
import { MAJORS } from './majors';
import { PATHS } from './paths';
import type { SmallEffect } from './specs';

export type { ClusterSpec, MajorSpec, PathSpec, SmallEffect } from './specs';

// PoE-style skill tree on an infinite canvas. Root sits at (0, 0); the Magic
// branch grows LEFT (x < 0), the Tech branch grows RIGHT (x > 0), and Magitech
// hybrids run along the vertical spine (x = 0) — each spine node requires one
// node from each side.
//
// The tree is assembled from four layers:
// - CORE: the hand-placed inner nodes around the root (stable ids/positions).
// - MAJORS: era unlock nodes (~600px apart) that open recipe/resource batches.
// - PATHS: chains of small +1% nodes generated along each major->major edge;
//   the target major's requirement is rewired through the chain.
// - CLUSTERS: fans of small +1% nodes generated around each major.
//
// Design rules:
// - No speed effects anywhere. Only efficiency: small additive percents
//   (+1% per small node, +2% on majors) to gather yield or craft output.
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
  main: 200 * 86_400, // 200 days of continuous research
  tournament: 48 * 3_600, // 48 hours
};

const COST_CURVE: Record<GameMode, { rootValue: number; endValue: number }> = {
  main: { rootValue: 20, endValue: 100_000 }, // 10 wood + 10 water at the root
  tournament: { rootValue: 2, endValue: 1_000 }, // 1 wood + 1 water at the root
};

const AUTHORED_TIME = { root: 30, end: 86_400 };

const price = (id: string) => RESOURCE_BY_ID[id]?.baseSellPrice ?? 0;
const costValue = (cost: Record<string, number>): number =>
  Object.entries(cost).reduce((sum, [id, n]) => sum + n * price(id), 0);

function targetCostValue(mode: GameMode, authoredSeconds: number): number {
  const { rootValue, endValue } = COST_CURVE[mode];
  const exp = Math.log(endValue / rootValue) / Math.log(AUTHORED_TIME.end / AUTHORED_TIME.root);
  return rootValue * (authoredSeconds / AUTHORED_TIME.root) ** exp;
}

// Amounts ≥ 100 round to two significant digits so scaled costs read cleanly.
const niceAmount = (n: number): number => {
  if (n < 100) return Math.round(n);
  const unit = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / unit) * unit;
};

// Rescales a cost mix so its value lands on `target`. Entries that round to
// zero drop out (a small budget can't afford one locomotive); the cheapest
// ingredient then absorbs whatever gap rounding and drops left behind.
function scaledCost(mix: Record<string, number>, target: number): Record<string, number> {
  const value = costValue(mix);
  if (value <= 0) return { ...mix };
  const scale = target / value;
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(mix)) {
    const amount = niceAmount(n * scale);
    if (amount > 0) out[id] = amount;
  }
  const cheapest = Object.keys(mix).reduce((a, b) => (price(a) <= price(b) ? a : b));
  const gap = target - costValue(out);
  if (Math.abs(gap) >= price(cheapest)) {
    out[cheapest] = Math.max(1, (out[cheapest] ?? 0) + Math.round(gap / price(cheapest)));
  }
  if (Object.keys(out).length === 0) out[cheapest] = 1;
  return out;
}

function smallMeta(eff: SmallEffect): { description: string; effects: TechEffect[] } {
  if (eff === 'craft') {
    return { description: 'Craft output +1%', effects: [{ kind: 'craftEfficiency', percent: 1 }] };
  }
  if (eff === 'both') {
    return {
      description: 'Gather +1%, craft output +1%',
      effects: [
        { kind: 'gatherEfficiency', resource: 'all', percent: 1 },
        { kind: 'craftEfficiency', percent: 1 },
      ],
    };
  }
  const resource = eff.slice('gather:'.length);
  return {
    description:
      resource === 'all'
        ? 'Gather efficiency +1%'
        : `${RESOURCE_BY_ID[resource]?.name ?? resource} yield +1%`,
    effects: [{ kind: 'gatherEfficiency', resource, percent: 1 }],
  };
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
      ...smallMeta(p.eff),
      cost: p.cost,
      researchTimeSeconds: p.time,
      requires: [prev],
      branch: p.branch,
      x: Math.round(a.x + dx * t + px * wiggle),
      y: Math.round(a.y + dy * t + py * wiggle),
    });
    prev = id;
  });
  (rewire[p.to] ??= {})[p.from] = prev;
}

// Majors: batch unlocks plus the standard major bonus — tech majors boost
// crafting, magic majors boost gathering, spine majors give +1% of each.
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
    ...(m.branch === 'tech'
      ? [{ kind: 'craftEfficiency', percent: 2 } as const]
      : m.branch === 'magic'
        ? [{ kind: 'gatherEfficiency', resource: 'all', percent: 2 } as const]
        : [
            { kind: 'gatherEfficiency', resource: 'all', percent: 1 } as const,
            { kind: 'craftEfficiency', percent: 1 } as const,
          ]),
  ],
  branch: m.branch,
  x: m.x,
  y: m.y,
  major: true,
}));

// Clusters: evenly spaced spokes across the fan; depth-2 fans chain an outer
// node behind each inner one.
const clusterNodes: TechNode[] = CLUSTERS.flatMap((c) => {
  const a = pos[c.anchor];
  if (!a) throw new Error(`tech cluster on ${c.anchor}: unknown anchor`);
  const inner = c.radius ?? 175;
  const spokes: string[][] = [];
  if ((c.depth ?? 1) === 2) {
    for (let i = 0; i < c.names.length; i += 2) spokes.push(c.names.slice(i, i + 2));
  } else {
    for (const name of c.names) spokes.push([name]);
  }
  return spokes.flatMap((spoke, s) => {
    const deg =
      spokes.length === 1
        ? c.angle
        : c.angle - c.spread / 2 + (c.spread * s) / (spokes.length - 1);
    const rad = (deg * Math.PI) / 180;
    let prev = c.anchor;
    return spoke.map((name, d) => {
      const id = slug(name);
      const r = inner + d * 150;
      const node: TechNode = {
        id,
        name,
        ...smallMeta(c.eff),
        cost: c.cost,
        researchTimeSeconds: c.time,
        requires: [prev],
        branch: c.branch,
        x: Math.round(a.x + Math.cos(rad) * r),
        y: Math.round(a.y + Math.sin(rad) * r),
      };
      prev = id;
      return node;
    });
  });
});

const AUTHORED: TechNode[] = [...CORE, ...majorNodes, ...pathNodes, ...clusterNodes];

const VILLAGE_TIME_SCALE =
  RESEARCH_TOTAL_SECONDS.main / AUTHORED.reduce((sum, n) => sum + n.researchTimeSeconds, 0);

// Baked at village pace/prices; tournament reads go through the helpers below.
export const TECH: TechNode[] = AUTHORED.map((node) => ({
  ...node,
  cost: scaledCost(node.cost, targetCostValue('main', node.researchTimeSeconds)),
  researchTimeSeconds: Math.round(node.researchTimeSeconds * VILLAGE_TIME_SCALE),
}));

export const TECH_BY_ID: Record<string, TechNode> = Object.fromEntries(
  TECH.map((t) => [t.id, t]),
);

const TOURNAMENT_COST: Record<string, Record<string, number>> = Object.fromEntries(
  AUTHORED.map((n) => [n.id, scaledCost(n.cost, targetCostValue('tournament', n.researchTimeSeconds))]),
);

// Village-only early-game pacing, cost side: the root and its four direct
// neighbours are 10× cheaper than the cost curve would price them, so a fresh
// village can start researching within its first few gather cycles. Applied
// at read time (like the time overrides below) so tournament costs and the
// rest of the tree keep their curve values.
const VILLAGE_CHEAP_FACTOR = 10;
const VILLAGE_COST_OVERRIDES: Record<string, Record<string, number>> = Object.fromEntries(
  ['basic_tools', 'attune_wood', 'attune_water', 'sharp_tools', 'measured_cuts'].map((id) => [
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

// Village-only early-game pacing: the root and every node within 2 hops of it
// research fast so a fresh village gets moving, regardless of what the
// 200-day normalization would give them. Applied at read time so the rest of
// the tree (and all tournament times) keep their normalized values.
const VILLAGE_TIME_OVERRIDES: Record<string, number> = {
  basic_tools: 30,
  // 1 hop from the root
  attune_wood: 60,
  attune_water: 60,
  sharp_tools: 60,
  measured_cuts: 60,
  // 2 hops from the root
  sap_flow: 60,
  spring_song: 60,
  rope_making: 60,
  woodworking: 60,
  quarrying: 60,
  jigs: 60,
  runic_saws: 60,
  mana_lathe: 60,
};

// Tournament compresses the village queue by a flat factor (48h / 200d).
export function researchTimeFactor(mode: GameMode): number {
  return RESEARCH_TOTAL_SECONDS[mode] / RESEARCH_TOTAL_SECONDS.main;
}

export function researchTime(node: TechNode, mode: GameMode): number {
  if (mode === 'main') {
    return VILLAGE_TIME_OVERRIDES[node.id] ?? node.researchTimeSeconds;
  }
  return node.researchTimeSeconds * researchTimeFactor(mode);
}
