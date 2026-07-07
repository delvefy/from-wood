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

// Small-node cost curve: ~25% more per step along a chain/fan, rounded.
const grow = (base: Record<string, number>, step: number): Record<string, number> =>
  Object.fromEntries(
    Object.entries(base).map(([id, n]) => [id, Math.max(1, Math.round(n * 1.25 ** step))]),
  );

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
      cost: grow(p.cost, i),
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
        cost: grow(c.cost, s + d),
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

export const TECH: TechNode[] = [...CORE, ...majorNodes, ...pathNodes, ...clusterNodes];

export const TECH_BY_ID: Record<string, TechNode> = Object.fromEntries(
  TECH.map((t) => [t.id, t]),
);
