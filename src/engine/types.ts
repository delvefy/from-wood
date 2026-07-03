export type ResourceId = string;
export type TechId = string;
export type WorkerType = 'harvester' | 'researcher' | 'crafter';

export interface ResourceDef {
  id: ResourceId;
  name: string;
  icon: string;
  tier: number; // gating / progression order
  baseSellPrice: number; // credits per unit when sold
  unlockedByDefault: boolean;
  manualHarvestAmount: number; // gained per tap; 0 = crafted item, not harvestable
}

export interface Recipe {
  id: string;
  name: string;
  icon: string;
  inputs: Record<ResourceId, number>;
  outputs: Record<ResourceId, number>;
  researchOutput?: number; // research points granted per craft
  craftTimeSeconds: number; // for crafter automation
  unlockedByDefault: boolean;
}

// Tech effects are a discriminated union so the engine can apply them generically
export type TechEffect =
  | { kind: 'unlockResource'; id: ResourceId }
  | { kind: 'unlockRecipe'; id: string }
  | { kind: 'unlockWorkerType'; workerType: WorkerType }
  | { kind: 'harvestMultiplier'; resource: ResourceId | 'all'; factor: number }
  | { kind: 'craftSpeedMultiplier'; factor: number }
  | { kind: 'workerEfficiencyMultiplier'; workerType: WorkerType; factor: number };

export interface TechNode {
  id: TechId;
  name: string;
  description: string;
  cost: number; // research points
  requires: TechId[]; // prerequisite nodes
  effects: TechEffect[];
  // layout hints for the tree view (column 0..2, row top-down)
  col: number;
  row: number;
}

export interface WorkerTypeDef {
  type: WorkerType;
  name: string;
  icon: string;
  description: string;
  hireCost: number; // credits for the first worker
  hireCostGrowth: number; // multiplier per additional worker owned
  // harvester: resource units per tick per worker; researcher: research points
  // per tick per worker; crafter: craft-seconds of progress per tick per worker
  productionPerTick: number;
}

export interface Multipliers {
  harvestAll: number;
  harvestByResource: Record<ResourceId, number>;
  craftSpeed: number;
  workerEfficiency: Record<WorkerType, number>;
}

export interface GameState {
  resources: Record<ResourceId, number>;
  credits: number;
  researchPoints: number;
  unlockedResources: ResourceId[];
  unlockedRecipes: string[];
  unlockedTech: TechId[];
  unlockedWorkerTypes: WorkerType[];
  workers: Record<WorkerType, number>; // how many hired
  harvesterAssignment: Record<ResourceId, number>; // harvesters allocated per resource
  crafterRecipe: string | null; // recipe crafters currently run
  crafterProgress: number; // accumulated craft-seconds toward the next auto-craft
  multipliers: Multipliers; // derived from tech, recomputed on unlock/load
  lastSeen: number; // epoch ms, for offline progress
}
