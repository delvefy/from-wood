import type { WorkerConfig } from '../engine/types';

// Two worker types with the same mechanic: each worker fills one slot and is
// assigned to a resource (gatherers) or a recipe (crafters). The player starts
// with `startingCount` free workers; more are hired with credits at scaling cost.
export const GATHERER: WorkerConfig = {
  name: 'Gatherer',
  icon: '👷',
  description: 'Each gatherer fills one gather slot and can be assigned to a resource.',
  hireCost: 5,
  hireCostGrowth: 1.15,
  startingCount: 1,
};

// Crafters are far pricier than gatherers and scale steeply, soft-capping the
// crew at ~15-20 unless credit income keeps up.
export const CRAFTER: WorkerConfig = {
  name: 'Crafter',
  icon: '🧑‍🏭',
  description: 'Each crafter fills one craft slot and can be assigned to a recipe.',
  hireCost: 50,
  hireCostGrowth: 1.4,
  startingCount: 1,
};
