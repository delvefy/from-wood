import { RECIPE_BY_ID } from '../content/recipes';
import { RESOURCE_BY_ID } from '../content/resources';
import type { AccountData } from './account';
import { harvestMultiplier } from './multipliers';
import { craftTimeFactor, gatherTimeFactor } from './premium';
import type { GameState, ResourceId } from './types';

// Theoretical steady-state flow per material, mirroring the tick's gather and
// craft loops at full pace. Deliberately ignores the tick's stock throttle
// (runs capped by what stock can pay for): a consumer of an empty, draining
// material reports its demand, not its actual throughput. Pair with stock via
// secondsToDry / isInputStarved to surface that gap in the UI.
export interface FlowRates {
  production: Record<ResourceId, number>;
  consumption: Record<ResourceId, number>;
}

// Float dust from summing rates can leave a net of ±1e-15 where the design
// intends exact balance; anything this small counts as zero.
const NET_EPSILON = 1e-9;

export function computeFlowRates(s: GameState, a: AccountData): FlowRates {
  const production: Record<ResourceId, number> = {};
  const consumption: Record<ResourceId, number> = {};
  const gatherFactor = gatherTimeFactor(a);
  const craftFactor = craftTimeFactor(a);

  for (const [id, assigned] of Object.entries(s.gatherAssignment)) {
    const def = RESOURCE_BY_ID[id];
    if (!def || assigned <= 0 || def.harvestAmount <= 0 || !s.unlockedResources.includes(id)) {
      continue;
    }
    const cycle = def.extractTimeSeconds * gatherFactor;
    production[id] =
      (production[id] ?? 0) +
      (assigned * def.harvestAmount * harvestMultiplier(s.multipliers, id)) / cycle;
  }

  // Runs once per second while the Craft tab is open, so membership is a Set
  // rather than an O(unlocked) `.includes` per staffed recipe.
  const unlockedRecipeSet = new Set(s.unlockedRecipes);
  for (const [recipeId, assigned] of Object.entries(s.craftAssignment)) {
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe || assigned <= 0 || !unlockedRecipeSet.has(recipeId)) continue;
    const cycle = recipe.craftTimeSeconds * craftFactor;
    for (const [id, n] of Object.entries(recipe.inputs)) {
      consumption[id] = (consumption[id] ?? 0) + (assigned * n) / cycle;
    }
    for (const [id, n] of Object.entries(recipe.outputs)) {
      production[id] =
        (production[id] ?? 0) + (assigned * n * s.multipliers.craftOutput) / cycle;
    }
  }

  return { production, consumption };
}

export function netRate(rates: FlowRates, id: ResourceId): number {
  const net = (rates.production[id] ?? 0) - (rates.consumption[id] ?? 0);
  return Math.abs(net) < NET_EPSILON ? 0 : net;
}

// Seconds until the stock hits zero at the current net drain; Infinity when
// the material is holding steady or growing.
export function secondsToDry(s: GameState, rates: FlowRates, id: ResourceId): number {
  const net = netRate(rates, id);
  if (net >= 0) return Infinity;
  return (s.resources[id] ?? 0) / -net;
}
