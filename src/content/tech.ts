import type { TechNode } from '../engine/types';

// To add a tech node: add an entry with its prerequisites in `requires` and
// pick a free col (0-2) / row slot for the tree layout. Effects are applied
// generically by the engine — no engine changes needed.
export const TECH: TechNode[] = [
  {
    id: 'basic_tools',
    name: 'Basic Tools',
    description: 'All harvesting ×1.5',
    cost: 10,
    requires: [],
    effects: [{ kind: 'harvestMultiplier', resource: 'all', factor: 1.5 }],
    col: 1,
    row: 0,
  },
  {
    id: 'quarrying',
    name: 'Quarrying',
    description: 'Unlocks Stone + Stone Bricks',
    cost: 25,
    requires: ['basic_tools'],
    effects: [
      { kind: 'unlockResource', id: 'stone' },
      { kind: 'unlockRecipe', id: 'stone_brick' },
    ],
    col: 0,
    row: 1,
  },
  {
    id: 'rope_making',
    name: 'Rope Making',
    description: 'Unlocks Fiber + Rope',
    cost: 25,
    requires: ['basic_tools'],
    effects: [
      { kind: 'unlockResource', id: 'fiber' },
      { kind: 'unlockRecipe', id: 'rope' },
    ],
    col: 1,
    row: 1,
  },
  {
    id: 'workforce',
    name: 'Workforce',
    description: 'Hire harvesters',
    cost: 30,
    requires: ['basic_tools'],
    effects: [{ kind: 'unlockWorkerType', workerType: 'harvester' }],
    col: 2,
    row: 1,
  },
  {
    id: 'research_lab',
    name: 'Research Lab',
    description: 'Hire researchers',
    cost: 60,
    requires: ['workforce'],
    effects: [{ kind: 'unlockWorkerType', workerType: 'researcher' }],
    col: 2,
    row: 2,
  },
  {
    id: 'automation',
    name: 'Automation',
    description: 'Hire crafters',
    cost: 120,
    requires: ['research_lab'],
    effects: [{ kind: 'unlockWorkerType', workerType: 'crafter' }],
    col: 2,
    row: 3,
  },
  {
    id: 'metallurgy',
    name: 'Metallurgy',
    description: 'Unlocks Copper + Iron Ore, Copper Ingots',
    cost: 150,
    requires: ['quarrying', 'research_lab'],
    effects: [
      { kind: 'unlockResource', id: 'copper_ore' },
      { kind: 'unlockResource', id: 'iron_ore' },
      { kind: 'unlockRecipe', id: 'copper_ingot' },
    ],
    col: 0,
    row: 3,
  },
];

export const TECH_BY_ID: Record<string, TechNode> = Object.fromEntries(
  TECH.map((t) => [t.id, t]),
);
