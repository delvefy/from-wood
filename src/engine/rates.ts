import { RECIPE_BY_ID } from '../content/recipes';
import { RESOURCES } from '../content/resources';
import type { AccountData } from './account';
import { harvestMultiplier } from './multipliers';
import { craftTimeFactor, gatherTimeFactor } from './premium';
import type { GameState, Recipe, ResourceId } from './types';

// Theoretical steady-state flow per material, mirroring the tick's gather and
// craft loops at full pace. Deliberately ignores the stock throttle
// (affordableRuns): a consumer of an empty, draining material reports its
// demand, not its actual throughput. Pair with stock via secondsToDry /
// isInputStarved to surface that gap in the UI.
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

  for (const def of RESOURCES) {
    const assigned = s.gatherAssignment[def.id] ?? 0;
    if (assigned <= 0 || def.harvestAmount <= 0 || !s.unlockedResources.includes(def.id)) {
      continue;
    }
    const cycle = def.extractTimeSeconds * gatherFactor;
    production[def.id] =
      (production[def.id] ?? 0) +
      (assigned * def.harvestAmount * harvestMultiplier(s.multipliers, def.id)) / cycle;
  }

  for (const [recipeId, assigned] of Object.entries(s.craftAssignment)) {
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe || assigned <= 0 || !s.unlockedRecipes.includes(recipeId)) continue;
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

// A recipe is input-starved when some input is draining and empty (or seconds
// from it) — the tick then caps its runs below the displayed full-pace rate.
const STARVED_HORIZON_SECONDS = 5;

export function isInputStarved(s: GameState, rates: FlowRates, recipe: Recipe): boolean {
  return Object.keys(recipe.inputs).some(
    (id) => secondsToDry(s, rates, id) < STARVED_HORIZON_SECONDS,
  );
}
