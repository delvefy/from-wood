import type { TechBranch } from '../../engine/types';

// Shorthand for what a small (+1%) node improves: 'craft' = craft output,
// 'both' = gather + craft (spine only), 'gather:<resourceId>' = that
// resource's yield, 'gather:all' = all gathering.
export type SmallEffect = 'craft' | 'both' | `gather:${string}`;

// A chain of small nodes along the edge between two anchors (usually two
// majors). Node i requires node i-1; the target major's `requires` entry for
// `from` is rewired to the last node of the chain. Coordinates are
// interpolated between the anchors with a slight alternating perpendicular
// wiggle. Costs only set the resource mix — the global cost curve (index.ts)
// scales the amounts.
export interface PathSpec {
  from: string; // anchor node id (core node or major)
  to: string; // major whose `requires` gets rewired through this path
  branch: TechBranch;
  eff: SmallEffect;
  cost: Record<string, number>; // resource mix (amounts rescaled by the curve)
  time: number; // research seconds per node
  names: string[]; // one small node per name, in from->to order
  flip?: boolean; // invert the wiggle side (to dodge nodes near the edge)
  bow?: number; // constant perpendicular offset instead of alternating wiggle
}

// A fan of small nodes hanging off an anchor. `angle` is the fan's center in
// degrees (0 = +x/right, 90 = +y/down), `spread` the total arc. With
// depth 2 the names pair up into spokes of two chained nodes (inner ->
// outer); with depth 1 every name is its own spoke.
export interface ClusterSpec {
  anchor: string;
  branch: TechBranch;
  eff: SmallEffect;
  cost: Record<string, number>; // resource mix (amounts rescaled by the curve)
  time: number;
  angle: number;
  spread: number;
  names: string[];
  depth?: 1 | 2; // default 1
  radius?: number; // inner ring distance, default 170
}

// Era unlock majors: each unlocks a themed batch of recipes (plus any new raw
// resource) and grants the standard +2% major bonus for its branch.
export interface MajorSpec {
  id: string;
  name: string;
  description: string;
  branch: TechBranch;
  x: number;
  y: number;
  requires: string[]; // anchor ids; rewired through paths where one exists
  cost: Record<string, number>;
  time: number;
  resources?: string[]; // unlockResource effects
  recipes: string[]; // unlockRecipe effects
}
