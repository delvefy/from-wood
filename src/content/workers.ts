import type { WorkerConfig } from '../engine/types';

// One unified worker type: each worker is a gather slot. The player starts with
// `startingCount` free workers; more are hired with credits at scaling cost.
export const WORKER: WorkerConfig = {
  name: 'Worker',
  icon: '👷',
  description: 'Each worker fills one gather slot and can be assigned to a resource.',
  hireCost: 50,
  hireCostGrowth: 1.15,
  startingCount: 1,
};
