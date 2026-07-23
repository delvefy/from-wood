import { RECIPE_BY_ID } from '../content/recipes';
import { RESOURCE_BY_ID } from '../content/resources';
import { techById } from '../content/tech';
import { get } from 'svelte/store';
import { getAccount } from './account';
import { gameMode, type GameMode } from './mode';
import { computeMultipliers, harvestMultiplier } from './multipliers';
import { craftTimeFactor, gatherTimeFactor } from './premium';
import type { GameState, Recipe, ResourceId, TechNode } from './types';

export function canAfford(s: GameState, inputs: Record<ResourceId, number>): boolean {
  return Object.entries(inputs).every(([id, n]) => (s.resources[id] ?? 0) >= n);
}

export function spendInputs(s: GameState, inputs: Record<ResourceId, number>): void {
  for (const [id, n] of Object.entries(inputs)) s.resources[id] = (s.resources[id] ?? 0) - n;
}

export function pushUnique<T>(arr: T[], value: T): void {
  if (!arr.includes(value)) arr.push(value);
}

// Applies a finished research node: marks it owned, applies unlock effects,
// and recomputes derived multipliers. Used by the tick (queue head finishing)
// and by offline fast-forward.
export function completeResearch(s: GameState, node: TechNode, mode: GameMode): void {
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
  s.multipliers = computeMultipliers(s.unlockedTech, mode);
}

// Unlocking a recipe reveals its output items in Market/top bar.
export function unlockOutputs(s: GameState, recipe: Recipe): void {
  for (const id of Object.keys(recipe.outputs)) pushUnique(s.unlockedResources, id);
}

// Offline catch-up granularity for the craft flow. Online ticks (1s) always
// fit in one sub-step; an 8h catch-up costs ~480 iterations.
const CRAFT_SUBSTEP_SECONDS = 60;

// Advances all timed work by `seconds`: gather flows, the research queue, and
// craft flows. Deterministic and cheap; also used to fast-forward offline
// progress.
export function tick(s: GameState, seconds: number): GameState {
  // Premium managers double flow rates (0.5× time-per-run); hoisted since
  // they apply to all. Account-level, so they hold in the village and
  // tournament slots alike. Worker pace is mode-independent; research
  // durations are baked into each mode's own tree (see content/tech).
  const acct = getAccount();
  const mode = get(gameMode);
  const gatherFactor = gatherTimeFactor(acct);
  const craftFactor = craftTimeFactor(acct);

  // Gathering is a continuous flow: each worker yields
  // harvestAmount / extractTime per second, scaled by multipliers. No cycle
  // state — a tick of any length accrues exactly rate × seconds. Iterates the
  // assignment map (a handful of staffed raws) rather than the full catalog.
  for (const [id, assigned] of Object.entries(s.gatherAssignment)) {
    const def = RESOURCE_BY_ID[id];
    if (!def || assigned <= 0 || def.harvestAmount <= 0 || !s.unlockedResources.includes(id)) {
      continue;
    }
    const cycle = def.extractTimeSeconds * gatherFactor;
    s.resources[id] =
      (s.resources[id] ?? 0) +
      (seconds / cycle) * assigned * def.harvestAmount * harvestMultiplier(s.multipliers, id);
  }

  // Research: a single slot works through the queue front-to-back.
  let remaining = seconds;
  while (s.researchQueue.length > 0 && remaining > 0) {
    const node = techById(mode)[s.researchQueue[0]];
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
    completeResearch(s, node, mode);
  }

  // Crafting is a continuous flow too: each crafter completes
  // 1 / craftTime runs per second, throttled by what the input stock can pay
  // for right now (fractional runs — scarcity degrades throughput smoothly
  // instead of stalling whole cycles). Long offline windows advance in
  // sub-steps so recipes chained through craftAssignment order keep feeding
  // each other at close to online fidelity.
  // Everything per-recipe except the stock throttle is invariant across
  // sub-steps, so resolve it once: an 8h catch-up used to redo the recipe
  // lookup, an O(unlocked) `.includes` and four throwaway objects per staffed
  // recipe × ~480 sub-steps. Built after the research phase so recipes
  // unlocked this very tick are already visible (matching the old per-substep
  // check).
  const unlockedRecipeSet = new Set(s.unlockedRecipes);
  const flows: {
    assigned: number;
    cycle: number;
    inputs: [ResourceId, number][];
    outputs: [ResourceId, number][];
  }[] = [];
  for (const [recipeId, assigned] of Object.entries(s.craftAssignment)) {
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe || assigned <= 0 || !unlockedRecipeSet.has(recipeId)) continue;
    flows.push({
      assigned,
      cycle: recipe.craftTimeSeconds * craftFactor,
      inputs: Object.entries(recipe.inputs),
      outputs: Object.entries(recipe.outputs),
    });
  }

  let craftLeft = flows.length > 0 ? seconds : 0;
  while (craftLeft > 0) {
    const dt = Math.min(craftLeft, CRAFT_SUBSTEP_SECONDS);
    craftLeft -= dt;
    for (const { assigned, cycle, inputs, outputs } of flows) {
      let runs = (assigned * dt) / cycle;
      for (const [id, n] of inputs) {
        const cap = (s.resources[id] ?? 0) / n;
        if (cap < runs) runs = cap;
      }
      if (runs <= 0) continue;
      for (const [id, n] of inputs) {
        const next = (s.resources[id] ?? 0) - n * runs;
        // Spending exactly `have / need × need` can leave -1e-15 dust; clamp
        // so stock never displays (or compares) as negative.
        s.resources[id] = next < 0 ? 0 : next;
      }
      const outFactor = runs * s.multipliers.craftOutput;
      for (const [id, n] of outputs) {
        s.resources[id] = (s.resources[id] ?? 0) + n * outFactor;
      }
    }
  }

  return s;
}
