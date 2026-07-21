import type { TechBranch } from '../../engine/types';

// A chain of small nodes along the edge between two anchors (usually two
// majors). Node i requires node i-1; the target major's `requires` entry for
// `from` is rewired to the last node of the chain. Coordinates are
// interpolated between the anchors with a slight alternating perpendicular
// wiggle. Costs only set the resource mix — the global cost curve (index.ts)
// scales the amounts. Effects are uniform: every node gives +1% gather AND
// +1% craft, regardless of branch.
export interface PathSpec {
  from: string; // anchor node id (core node or major)
  to: string; // major whose `requires` gets rewired through this path
  branch: TechBranch;
  cost: Record<string, number>; // resource mix (amounts rescaled by the curve)
  time: number; // AUTHORED research seconds of the first node (×1.3 per step)
  names: string[]; // one small node per name, in from->to order
  flip?: boolean; // invert the wiggle side (to dodge nodes near the edge)
  bow?: number; // constant perpendicular offset instead of alternating wiggle
}

// Era unlock majors: each unlocks a themed batch of recipes (plus any new raw
// resource) and grants the standard +1% gather / +1% craft bonus.
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
