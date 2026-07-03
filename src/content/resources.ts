import type { ResourceDef } from '../engine/types';

// All resources AND crafted items live here — the engine treats them uniformly.
// To add a new resource: add an entry (manualHarvestAmount > 0 makes it tappable
// in the Gather view) and, if it starts locked, add an `unlockResource` effect
// to a tech node in tech.ts.
export const RESOURCES: ResourceDef[] = [
  // Harvestable resources
  { id: 'wood', name: 'Wood', icon: '🪵', tier: 0, baseSellPrice: 1, unlockedByDefault: true, manualHarvestAmount: 1 },
  { id: 'water', name: 'Water', icon: '💧', tier: 0, baseSellPrice: 1, unlockedByDefault: true, manualHarvestAmount: 1 },
  { id: 'stone', name: 'Stone', icon: '🪨', tier: 1, baseSellPrice: 3, unlockedByDefault: false, manualHarvestAmount: 1 },
  { id: 'fiber', name: 'Fiber', icon: '🌾', tier: 1, baseSellPrice: 3, unlockedByDefault: false, manualHarvestAmount: 1 },
  { id: 'copper_ore', name: 'Copper Ore', icon: '🟠', tier: 2, baseSellPrice: 8, unlockedByDefault: false, manualHarvestAmount: 1 },
  { id: 'iron_ore', name: 'Iron Ore', icon: '🔩', tier: 2, baseSellPrice: 10, unlockedByDefault: false, manualHarvestAmount: 1 },
  // Crafted items (manualHarvestAmount 0 = not tappable)
  { id: 'plank', name: 'Plank', icon: '🟫', tier: 1, baseSellPrice: 4, unlockedByDefault: true, manualHarvestAmount: 0 },
  { id: 'rope', name: 'Rope', icon: '🪢', tier: 2, baseSellPrice: 12, unlockedByDefault: false, manualHarvestAmount: 0 },
  { id: 'stone_brick', name: 'Stone Brick', icon: '🧱', tier: 2, baseSellPrice: 9, unlockedByDefault: false, manualHarvestAmount: 0 },
  { id: 'copper_ingot', name: 'Copper Ingot', icon: '🥉', tier: 3, baseSellPrice: 20, unlockedByDefault: false, manualHarvestAmount: 0 },
];

export const RESOURCE_BY_ID: Record<string, ResourceDef> = Object.fromEntries(
  RESOURCES.map((r) => [r.id, r]),
);
