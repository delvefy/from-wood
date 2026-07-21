import type { WorkerConfig } from '../engine/types';

// Two worker types with the same mechanic: each worker fills one slot and is
// assigned to a resource (gatherers) or a recipe (crafters). A new player
// starts with just 1 gatherer; more workers are hired with credits at scaling
// cost, and permanent base workers (premium packs, tournament rewards) stack
// on top via the account. `icon` is an ICON_PATHS id, rendered via <Icon>.
export const GATHERER: WorkerConfig = {
  name: 'Gatherer',
  icon: 'worker_gatherer',
  description: 'Each gatherer fills one gather slot and can be assigned to a resource.',
  hireCost: 1,
  hireCostGrowth: 1.15,
  startingCount: 1,
};

// Crafters grow at the gatherer's rate to the 10th power (1.15^10 ≈ 4), so
// each crafter keeps pace with a block of ten gatherers (the Nth crafter ≈
// 2.5× the cost of gatherers 10N-9..10N). Soft-caps the crew at ~8-10.
export const CRAFTER: WorkerConfig = {
  name: 'Crafter',
  icon: 'worker_crafter',
  description: 'Each crafter fills one craft slot and can be assigned to a recipe.',
  hireCost: 50,
  hireCostGrowth: 4,
  startingCount: 0,
};
