import { RECIPE_BY_ID } from '../content/recipes';
import { WORKER_BY_TYPE } from '../content/workers';
import { harvestMultiplier } from './multipliers';
import type { GameState, ResourceId } from './types';

export function canAfford(s: GameState, inputs: Record<ResourceId, number>): boolean {
  return Object.entries(inputs).every(([id, n]) => (s.resources[id] ?? 0) >= n);
}

export function spendInputs(s: GameState, inputs: Record<ResourceId, number>): void {
  for (const [id, n] of Object.entries(inputs)) s.resources[id] = (s.resources[id] ?? 0) - n;
}

export function grantOutputs(s: GameState, outputs: Record<ResourceId, number>): void {
  for (const [id, n] of Object.entries(outputs)) s.resources[id] = (s.resources[id] ?? 0) + n;
}

// Advances all automated production by `seconds`. Deterministic and cheap;
// also used to fast-forward offline progress (workers only, no manual taps).
export function tick(s: GameState, seconds: number): GameState {
  const m = s.multipliers;

  // Harvesters: each assigned harvester adds a fixed amount per tick.
  const harvesterRate =
    WORKER_BY_TYPE.harvester.productionPerTick * m.workerEfficiency.harvester;
  for (const [resourceId, count] of Object.entries(s.harvesterAssignment)) {
    if (count <= 0 || !s.unlockedResources.includes(resourceId)) continue;
    s.resources[resourceId] =
      (s.resources[resourceId] ?? 0) +
      count * harvesterRate * harvestMultiplier(m, resourceId) * seconds;
  }

  // Researchers: flat research points per tick.
  s.researchPoints +=
    s.workers.researcher *
    WORKER_BY_TYPE.researcher.productionPerTick *
    m.workerEfficiency.researcher *
    seconds;

  // Crafters: accumulate craft-seconds toward the selected recipe; each time a
  // full craft is reached, consume inputs and produce outputs. Idle (progress
  // capped at one pending craft) when inputs are missing.
  const recipe = s.crafterRecipe ? RECIPE_BY_ID[s.crafterRecipe] : undefined;
  if (recipe && s.workers.crafter > 0 && s.unlockedRecipes.includes(recipe.id)) {
    s.crafterProgress +=
      s.workers.crafter *
      WORKER_BY_TYPE.crafter.productionPerTick *
      m.craftSpeed *
      m.workerEfficiency.crafter *
      seconds;
    while (s.crafterProgress >= recipe.craftTimeSeconds) {
      if (!canAfford(s, recipe.inputs)) {
        s.crafterProgress = recipe.craftTimeSeconds;
        break;
      }
      spendInputs(s, recipe.inputs);
      grantOutputs(s, recipe.outputs);
      if (recipe.researchOutput) s.researchPoints += recipe.researchOutput;
      s.crafterProgress -= recipe.craftTimeSeconds;
    }
  } else {
    s.crafterProgress = 0;
  }

  return s;
}
