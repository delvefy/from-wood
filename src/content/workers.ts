import type { WorkerConfig } from '../engine/types';

// Two worker types with the same mechanic: each worker fills one slot and is
// assigned to a resource (gatherers) or a recipe (crafters). The player starts
// with `startingCount` free workers; more are hired with credits at scaling cost.
export const WORKER: WorkerConfig = {
  name: 'Worker',
  icon: '👷',
  description: 'Each worker fills one gather slot and can be assigned to a resource.',
  hireCost: 5,
  hireCostGrowth: 1.15,
  startingCount: 1,
};

// Crafters start at the same price as gather workers.
export const CRAFTER: WorkerConfig = {
  name: 'Crafter',
  icon: '🧑‍🏭',
  description: 'Each crafter fills one craft slot and can be assigned to a recipe.',
  hireCost: 5,
  hireCostGrowth: 1.15,
  startingCount: 1,
};
