import type { WorkerType, WorkerTypeDef } from '../engine/types';

export const WORKER_TYPES: WorkerTypeDef[] = [
  {
    type: 'harvester',
    name: 'Harvester',
    icon: '👷',
    description: 'Gathers its assigned resource every second.',
    hireCost: 50,
    hireCostGrowth: 1.15,
    productionPerTick: 1,
  },
  {
    type: 'researcher',
    name: 'Researcher',
    icon: '🔬',
    description: 'Generates research points every second.',
    hireCost: 150,
    hireCostGrowth: 1.15,
    productionPerTick: 0.5,
  },
  {
    type: 'crafter',
    name: 'Crafter',
    icon: '🛠️',
    description: 'Continuously runs the selected recipe.',
    hireCost: 300,
    hireCostGrowth: 1.15,
    productionPerTick: 1,
  },
];

export const WORKER_BY_TYPE: Record<WorkerType, WorkerTypeDef> = Object.fromEntries(
  WORKER_TYPES.map((w) => [w.type, w]),
) as Record<WorkerType, WorkerTypeDef>;
