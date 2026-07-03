import type { Recipe } from '../engine/types';

// To add a recipe: add an entry here; if it starts locked, unlock it via an
// `unlockRecipe` tech effect. Outputs are resource ids from resources.ts;
// `researchOutput` grants research points directly instead of (or on top of) items.
export const RECIPES: Recipe[] = [
  { id: 'planks', name: 'Planks', icon: '🟫', inputs: { wood: 2 }, outputs: { plank: 1 }, craftTimeSeconds: 2, unlockedByDefault: true },
  // Spec note: uses Planks + Water instead of Planks + Copper Ingot so research
  // is earnable before any tech is bought (the tree isn't gated behind itself).
  { id: 'research_sample', name: 'Research Sample', icon: '🧪', inputs: { plank: 2, water: 1 }, outputs: {}, researchOutput: 5, craftTimeSeconds: 4, unlockedByDefault: true },
  { id: 'rope', name: 'Rope', icon: '🪢', inputs: { fiber: 3 }, outputs: { rope: 1 }, craftTimeSeconds: 3, unlockedByDefault: false },
  { id: 'stone_brick', name: 'Stone Brick', icon: '🧱', inputs: { stone: 2 }, outputs: { stone_brick: 1 }, craftTimeSeconds: 3, unlockedByDefault: false },
  { id: 'copper_ingot', name: 'Copper Ingot', icon: '🥉', inputs: { copper_ore: 2 }, outputs: { copper_ingot: 1 }, craftTimeSeconds: 5, unlockedByDefault: false },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(
  RECIPES.map((r) => [r.id, r]),
);
