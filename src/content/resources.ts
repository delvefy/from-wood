import type { ResourceDef } from '../engine/types';

// All resources AND crafted items live here — the engine treats them uniformly.
// To add a new resource: add an entry (harvestAmount > 0 makes it gatherable by
// workers in the Gather view) and, if it starts locked, add an `unlockResource`
// effect to a tech node in tech.ts.
export const RESOURCES: ResourceDef[] = [
  // Gatherable resources
  { id: 'wood', name: 'Wood', icon: '🪵', tier: 0, baseSellPrice: 1, unlockedByDefault: true, harvestAmount: 1, extractTimeSeconds: 60 },
  { id: 'water', name: 'Water', icon: '💧', tier: 0, baseSellPrice: 1, unlockedByDefault: true, harvestAmount: 1, extractTimeSeconds: 60 },
  { id: 'stone', name: 'Stone', icon: '🪨', tier: 1, baseSellPrice: 3, unlockedByDefault: false, harvestAmount: 1, extractTimeSeconds: 60 },
  { id: 'fiber', name: 'Fiber', icon: '🌾', tier: 1, baseSellPrice: 3, unlockedByDefault: false, harvestAmount: 1, extractTimeSeconds: 60 },
  { id: 'copper_ore', name: 'Copper Ore', icon: '🟠', tier: 2, baseSellPrice: 8, unlockedByDefault: false, harvestAmount: 1, extractTimeSeconds: 60 },
  { id: 'iron_ore', name: 'Iron Ore', icon: '🔩', tier: 2, baseSellPrice: 10, unlockedByDefault: false, harvestAmount: 1, extractTimeSeconds: 60 },
  // Crafted items (harvestAmount 0 = not gatherable)
  { id: 'plank', name: 'Plank', icon: '🟫', tier: 1, baseSellPrice: 4, unlockedByDefault: false, harvestAmount: 0, extractTimeSeconds: 60 },
  { id: 'rope', name: 'Rope', icon: '🪢', tier: 2, baseSellPrice: 12, unlockedByDefault: false, harvestAmount: 0, extractTimeSeconds: 60 },
  { id: 'stone_brick', name: 'Stone Brick', icon: '🧱', tier: 2, baseSellPrice: 9, unlockedByDefault: false, harvestAmount: 0, extractTimeSeconds: 60 },
  { id: 'copper_ingot', name: 'Copper Ingot', icon: '🥉', tier: 3, baseSellPrice: 20, unlockedByDefault: false, harvestAmount: 0, extractTimeSeconds: 60 },
];

export const RESOURCE_BY_ID: Record<string, ResourceDef> = Object.fromEntries(
  RESOURCES.map((r) => [r.id, r]),
);

// Drafted materials from the 20-material plan that have no ResourceDef or tech
// unlock yet. Shown as greyed placeholders in the Gather view; move an entry
// into RESOURCES (plus an unlockResource tech node) when it becomes real.
export interface PlannedMaterial {
  name: string;
  icon: string;
  tier: number;
  branch: 'magic' | 'tech' | 'neutral';
}

export const PLANNED_MATERIALS: PlannedMaterial[] = [
  { name: 'Herbs', icon: '🌿', tier: 2, branch: 'magic' },
  { name: 'Resin', icon: '🍯', tier: 2, branch: 'magic' },
  { name: 'Clay', icon: '🟤', tier: 2, branch: 'tech' },
  { name: 'Salt', icon: '🧂', tier: 3, branch: 'magic' },
  { name: 'Amber', icon: '🔶', tier: 3, branch: 'magic' },
  { name: 'Coal', icon: '⚫', tier: 3, branch: 'tech' },
  { name: 'Glowspore', icon: '🍄', tier: 4, branch: 'magic' },
  { name: 'Moon Dew', icon: '🌙', tier: 4, branch: 'magic' },
  { name: 'Sulfur', icon: '🟡', tier: 4, branch: 'tech' },
  { name: 'Quartz Sand', icon: '⏳', tier: 4, branch: 'tech' },
  { name: 'Mana Crystal', icon: '🔮', tier: 5, branch: 'magic' },
  { name: 'Crude Oil', icon: '🛢️', tier: 5, branch: 'tech' },
  { name: 'Ley Essence', icon: '✨', tier: 6, branch: 'magic' },
  { name: 'Voltite', icon: '⚡', tier: 6, branch: 'tech' },
];
