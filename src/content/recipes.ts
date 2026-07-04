import type { Recipe } from '../engine/types';

// To add a recipe: add an entry here; recipes start locked and are unlocked via
// an `unlockRecipe` tech effect (unlocking a recipe also reveals its outputs).
// Crafting starts a timed job with a progress bar; one job per recipe at a time.
export const RECIPES: Recipe[] = [
  { id: 'planks', name: 'Planks', icon: '🟫', inputs: { wood: 2 }, outputs: { plank: 1 }, craftTimeSeconds: 60, unlockedByDefault: false },
  { id: 'rope', name: 'Rope', icon: '🪢', inputs: { fiber: 3 }, outputs: { rope: 1 }, craftTimeSeconds: 60, unlockedByDefault: false },
  { id: 'stone_brick', name: 'Stone Brick', icon: '🧱', inputs: { stone: 2 }, outputs: { stone_brick: 1 }, craftTimeSeconds: 60, unlockedByDefault: false },
  { id: 'copper_ingot', name: 'Copper Ingot', icon: '🥉', inputs: { copper_ore: 2 }, outputs: { copper_ingot: 1 }, craftTimeSeconds: 60, unlockedByDefault: false },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(
  RECIPES.map((r) => [r.id, r]),
);
