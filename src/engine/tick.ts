import { RECIPE_BY_ID } from '../content/recipes';
import { RESOURCES } from '../content/resources';
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
// Fractional: crafting is a continuous flow, so 0.4 of a run is spendable.
export function affordableRuns(s: GameState, inputs: Record<ResourceId, number>): number {
  let runs = Infinity;
  for (const [id, n] of Object.entries(inputs)) {
    runs = Math.min(runs, (s.resources[id] ?? 0) / n);
  }
  return runs;
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
  // state — a tick of any length accrues exactly rate × seconds.
  for (const def of RESOURCES) {
    const assigned = s.gatherAssignment[def.id] ?? 0;
    if (assigned <= 0 || def.harvestAmount <= 0 || !s.unlockedResources.includes(def.id)) {
      continue;
    }
    const cycle = def.extractTimeSeconds * gatherFactor;
    s.resources[def.id] =
      (s.resources[def.id] ?? 0) +
      (seconds / cycle) * assigned * def.harvestAmount * harvestMultiplier(s.multipliers, def.id);
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
  let craftLeft = seconds;
  while (craftLeft > 0) {
    const dt = Math.min(craftLeft, CRAFT_SUBSTEP_SECONDS);
    craftLeft -= dt;
    for (const [recipeId, assigned] of Object.entries(s.craftAssignment)) {
      const recipe = RECIPE_BY_ID[recipeId];
      if (!recipe || assigned <= 0 || !s.unlockedRecipes.includes(recipeId)) continue;
      const cycle = recipe.craftTimeSeconds * craftFactor;
      const runs = Math.min((assigned * dt) / cycle, affordableRuns(s, recipe.inputs));
      if (runs <= 0) continue;
      spendInputs(s, scaleAmounts(recipe.inputs, runs));
      // Spending exactly `have / need × need` can leave -1e-15 dust; clamp so
      // stock never displays (or compares) as negative.
      for (const id of Object.keys(recipe.inputs)) {
        if ((s.resources[id] ?? 0) < 0) s.resources[id] = 0;
      }
      grantOutputs(s, scaleAmounts(recipe.outputs, runs * s.multipliers.craftOutput));
    }
  }

  return s;
}
