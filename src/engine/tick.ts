import { RECIPE_BY_ID } from '../content/recipes';
import { RESOURCES } from '../content/resources';
import { TECH_BY_ID } from '../content/tech';
import { computeMultipliers, harvestMultiplier } from './multipliers';
import type { GameState, Recipe, ResourceId, TechNode } from './types';

export function canAfford(s: GameState, inputs: Record<ResourceId, number>): boolean {
  return Object.entries(inputs).every(([id, n]) => (s.resources[id] ?? 0) >= n);
}

export function spendInputs(s: GameState, inputs: Record<ResourceId, number>): void {
  for (const [id, n] of Object.entries(inputs)) s.resources[id] = (s.resources[id] ?? 0) - n;
}

export function grantOutputs(s: GameState, outputs: Record<ResourceId, number>): void {
  for (const [id, n] of Object.entries(outputs)) s.resources[id] = (s.resources[id] ?? 0) + n;
}

export function scaleAmounts(
  amounts: Record<ResourceId, number>,
  factor: number,
): Record<ResourceId, number> {
  return Object.fromEntries(Object.entries(amounts).map(([id, n]) => [id, n * factor]));
}

// How many runs of a recipe the current stock can pay for (Infinity if free).
export function affordableRuns(s: GameState, inputs: Record<ResourceId, number>): number {
  let runs = Infinity;
  for (const [id, n] of Object.entries(inputs)) {
    runs = Math.min(runs, Math.floor((s.resources[id] ?? 0) / n));
  }
  return runs;
}

export function pushUnique<T>(arr: T[], value: T): void {
  if (!arr.includes(value)) arr.push(value);
}

// Applies a finished research node: marks it owned, applies unlock effects,
// and recomputes derived multipliers. Used by the tick (queue head finishing)
// and by offline fast-forward.
export function completeResearch(s: GameState, node: TechNode): void {
  pushUnique(s.unlockedTech, node.id);
  for (const effect of node.effects) {
    if (effect.kind === 'unlockResource') {
      pushUnique(s.unlockedResources, effect.id);
    } else if (effect.kind === 'unlockRecipe') {
      pushUnique(s.unlockedRecipes, effect.id);
      const recipe = RECIPE_BY_ID[effect.id];
      if (recipe) unlockOutputs(s, recipe);
    }
    // Multiplier effects need no unlock step — they're derived below.
  }
  s.multipliers = computeMultipliers(s.unlockedTech);
}

// Unlocking a recipe reveals its output items in Market/top bar.
export function unlockOutputs(s: GameState, recipe: Recipe): void {
  for (const id of Object.keys(recipe.outputs)) pushUnique(s.unlockedResources, id);
}

// Advances all timed work by `seconds`: gather cycles, the research queue, and
// running craft jobs. Deterministic and cheap; also used to fast-forward
// offline progress.
export function tick(s: GameState, seconds: number): GameState {
  // Gathering: each resource with assigned workers runs a shared cycle bar;
  // every completed cycle yields (workers × amount × multipliers).
  for (const def of RESOURCES) {
    const assigned = s.gatherAssignment[def.id] ?? 0;
    if (assigned <= 0 || def.harvestAmount <= 0 || !s.unlockedResources.includes(def.id)) {
      if (s.gatherProgress[def.id]) s.gatherProgress[def.id] = 0;
      continue;
    }
    const cycle = def.extractTimeSeconds;
    const progress = (s.gatherProgress[def.id] ?? 0) + seconds;
    const cycles = Math.floor(progress / cycle);
    if (cycles > 0) {
      s.resources[def.id] =
        (s.resources[def.id] ?? 0) +
        cycles * assigned * def.harvestAmount * harvestMultiplier(s.multipliers, def.id);
    }
    s.gatherProgress[def.id] = progress % cycle;
  }

  // Research: a single slot works through the queue front-to-back.
  let remaining = seconds;
  while (s.researchQueue.length > 0 && remaining > 0) {
    const node = TECH_BY_ID[s.researchQueue[0]];
    if (!node || s.unlockedTech.includes(s.researchQueue[0])) {
      s.researchQueue.shift();
      s.researchProgress = 0;
      continue;
    }
    const needed = node.researchTimeSeconds - s.researchProgress;
    if (remaining < needed) {
      s.researchProgress += remaining;
      break;
    }
    remaining -= needed;
    s.researchQueue.shift();
    s.researchProgress = 0;
    completeResearch(s, node);
  }

  // Crafting mirrors gathering: each recipe with assigned crafters runs a
  // shared cycle bar. Every completed cycle runs up to one craft per crafter,
  // limited by what the input stock can pay for; inputs are spent and outputs
  // (scaled by craft efficiency) land at cycle completion.
  for (const [recipeId, assigned] of Object.entries(s.craftAssignment)) {
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe || assigned <= 0 || !s.unlockedRecipes.includes(recipeId)) {
      if (s.craftProgress[recipeId]) s.craftProgress[recipeId] = 0;
      continue;
    }
    const cycle = recipe.craftTimeSeconds;
    const progress = (s.craftProgress[recipeId] ?? 0) + seconds;
    // Loop per cycle (not per tick) so offline fast-forward respects the stock
    // available at each completion. Stock only shrinks within this loop, so a
    // zero-run cycle means every later cycle is zero too.
    for (let i = Math.floor(progress / cycle); i > 0; i--) {
      const runs = Math.min(assigned, affordableRuns(s, recipe.inputs));
      if (runs <= 0) break;
      spendInputs(s, scaleAmounts(recipe.inputs, runs));
      grantOutputs(s, scaleAmounts(recipe.outputs, runs * s.multipliers.craftOutput));
    }
    s.craftProgress[recipeId] = progress % cycle;
  }

  return s;
}
