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
  hireCost: 5,
  hireCostGrowth: 1.15,
  startingCount: 1,
};

// Crafters are pegged at ~10 gatherers apiece: growth is the gatherer's
// growth to the 10th power (1.15^10 ≈ 4), so the Nth crafter always costs
// about as much as gatherers 10N-9..10N. Soft-caps the crew at ~8-10.
export const CRAFTER: WorkerConfig = {
  name: 'Crafter',
  icon: 'worker_crafter',
  description: 'Each crafter fills one craft slot and can be assigned to a recipe.',
  hireCost: 100,
  hireCostGrowth: 4,
  startingCount: 0,
};
