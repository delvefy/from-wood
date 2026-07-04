export type ResourceId = string;
export type TechId = string;

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
  // Design rule: at most 3 distinct input types per recipe. Depth and
  // quantities carry the cost curve, never more ingredient slots.
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

// Skill-tree branches: magic grows left, tech grows right, magitech runs along
// the vertical spine and requires nodes from both sides.
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
  researchQueue: TechId[]; // head is being researched; one slot, rest wait
  researchProgress: number; // seconds into the queue head
  craftJobs: Record<string, number>; // recipeId -> seconds of progress (one job per recipe)
  craftRepeat: Record<string, number>; // recipeId -> queued repeat runs after the current job (inputs paid per run)
  multipliers: Multipliers; // derived from tech, recomputed on unlock/load
  lastSeen: number; // epoch ms, for offline progress
}
