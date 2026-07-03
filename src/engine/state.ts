import { writable } from 'svelte/store';
import { RESOURCES } from '../content/resources';
import { RECIPES } from '../content/recipes';
import { computeMultipliers } from './multipliers';
import type { GameState } from './types';

export function createInitialState(): GameState {
  const resources: Record<string, number> = {};
  for (const r of RESOURCES) resources[r.id] = 0;
  return {
    resources,
    credits: 0,
    researchPoints: 0,
    unlockedResources: RESOURCES.filter((r) => r.unlockedByDefault).map((r) => r.id),
    unlockedRecipes: RECIPES.filter((r) => r.unlockedByDefault).map((r) => r.id),
    unlockedTech: [],
    unlockedWorkerTypes: [],
    workers: { harvester: 0, researcher: 0, crafter: 0 },
    harvesterAssignment: {},
    crafterRecipe: null,
    crafterProgress: 0,
    multipliers: computeMultipliers([]),
    lastSeen: Date.now(),
  };
}

// Single source of truth: every mutable piece of game state lives here.
// UI components subscribe to it and call actions; they hold no game logic.
export const game = writable<GameState>(createInitialState());
