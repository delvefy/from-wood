export type ResourceId = string;
export type TechId = string;
export type PremiumId = string;

export interface ResourceDef {
  id: ResourceId;
  name: string;
  icon: string;
  tier: number; // gating / progression order
  baseSellPrice: number; // credits per unit when sold
  unlockedByDefault: boolean;
  harvestAmount: number; // gained per completed gather cycle per worker; 0 = crafted item, not gatherable
  extractTimeSeconds: number; // gather cycle length (before speed multipliers)
}

// Crafting categories, in display order. Materials are refined inputs for
// everything else; wonders are the end-game obscene-cost builds.
export type RecipeCategory =
  | 'materials'
  | 'components'
  | 'tools'
  | 'goods'
  | 'machines'
  | 'arcana'
  | 'magitech'
  | 'wonders';

export interface Recipe {
  id: string;
  name: string;
  icon: string;
  category: RecipeCategory;
  // Design rule: exactly 2 distinct input types per recipe (materials may
  // use 1 — simple refinements). Depth and quantities carry the cost curve,
  // never more ingredient slots.
  inputs: Record<ResourceId, number>;
  outputs: Record<ResourceId, number>;
  craftTimeSeconds: number; // craft job length (before speed multipliers)
  unlockedByDefault: boolean;
}

// Tech effects are a discriminated union so the engine can apply them generically.
// There are deliberately NO speed effects: progression only improves efficiency
// (yield per gather cycle / output per craft job), in small additive percents.
export type TechEffect =
  | { kind: 'unlockResource'; id: ResourceId }
  | { kind: 'unlockRecipe'; id: string }
  | { kind: 'gatherEfficiency'; resource: ResourceId | 'all'; percent: number }
  | { kind: 'craftEfficiency'; percent: number };

// Skill-tree branches: magic rises up-left, tech up-right, magitech sits only
// at the top of the triangle and requires nodes from both sides.
export type TechBranch = 'magic' | 'tech' | 'magitech';

export interface TechNode {
  id: TechId;
  name: string;
  description: string;
  cost: Record<ResourceId, number>; // resources paid when queued (refunded on cancel)
  researchTimeSeconds: number; // time in the single research slot
  requires: TechId[]; // prerequisite nodes (all must be owned or queued)
  effects: TechEffect[];
  branch: TechBranch;
  // world coordinates on the infinite canvas; root sits at (0, 0)
  x: number;
  y: number;
  major?: boolean; // keystone/unlock nodes render larger
}

export interface WorkerConfig {
  name: string;
  icon: string;
  description: string;
  hireCost: number; // credits for the first hired worker
  hireCostGrowth: number; // multiplier per additional hired worker
  startingCount: number; // free gather slots at game start
}

// A real-money shop item. Purchases are free during development but still go
// through a confirm dialog; ownership counts live on the account (not the save
// slot), and effects are derived from them, never stored.
export interface PremiumItem {
  id: PremiumId;
  name: string;
  icon: string;
  description: string;
  priceUsd: number; // display-only for now — nothing is actually charged
  unique: boolean; // true = own at most once (managers); false = repeatable (packs)
}

export interface Multipliers {
  gatherAll: number; // 1 + sum of 'all' gatherEfficiency percents / 100
  gatherByResource: Record<ResourceId, number>; // per-resource, same additive scheme
  craftOutput: number; // multiplies craft job outputs
}

export interface GameState {
  resources: Record<ResourceId, number>;
  credits: number;
  unlockedResources: ResourceId[];
  unlockedRecipes: string[];
  unlockedTech: TechId[];
  workers: number; // gather slots owned (1 free at start, more hired with credits)
  gatherAssignment: Record<ResourceId, number>; // workers allocated per resource
  gatherProgress: Record<ResourceId, number>; // seconds into the current gather cycle
  crafters: number; // craft slots owned (none free at start, hired with credits)
  craftAssignment: Record<string, number>; // crafters allocated per recipe
  craftProgress: Record<string, number>; // seconds into the current craft cycle
  researchQueue: TechId[]; // head is being researched; one slot, rest wait
  researchProgress: number; // seconds into the queue head
  multipliers: Multipliers; // derived from tech, recomputed on unlock/load
  lastSeen: number; // epoch ms, for offline progress
}
