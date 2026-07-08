import { writable } from 'svelte/store';
import { RESOURCES } from '../content/resources';
import { RECIPES } from '../content/recipes';
import { CRAFTER, GATHERER } from '../content/workers';
import { computeMultipliers } from './multipliers';
import type { GameState } from './types';

export function createInitialState(): GameState {
  const resources: Record<string, number> = {};
  for (const r of RESOURCES) resources[r.id] = 0;
  return {
    resources,
    credits: 0,
    unlockedResources: RESOURCES.filter((r) => r.unlockedByDefault).map((r) => r.id),
    unlockedRecipes: RECIPES.filter((r) => r.unlockedByDefault).map((r) => r.id),
    unlockedTech: [],
    workers: GATHERER.startingCount,
    gatherAssignment: {},
    gatherProgress: {},
    crafters: CRAFTER.startingCount,
    craftAssignment: {},
    craftProgress: {},
    researchQueue: [],
    researchProgress: 0,
    multipliers: computeMultipliers([]),
    premium: {},
    lastSeen: Date.now(),
  };
}

// Single source of truth: every mutable piece of game state lives here.
// UI components subscribe to it and call actions; they hold no game logic.
export const game = writable<GameState>(createInitialState());
