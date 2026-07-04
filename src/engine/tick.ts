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

export function scaleOutputs(
  outputs: Record<ResourceId, number>,
  factor: number,
): Record<ResourceId, number> {
  return Object.fromEntries(Object.entries(outputs).map(([id, n]) => [id, n * factor]));
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

  // Craft jobs: one per recipe, inputs already consumed at start; outputs land
  // when the bar fills, scaled by craft efficiency. Queued repeat runs pay
  // their inputs as each run starts; an unaffordable repeat drops the queue.
  // The loop handles multiple completions per tick for offline fast-forward.
  for (const [recipeId, progress] of Object.entries(s.craftJobs)) {
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe) {
      delete s.craftJobs[recipeId];
      delete s.craftRepeat[recipeId];
      continue;
    }
    const duration = recipe.craftTimeSeconds;
    let next = progress + seconds;
    let running = true;
    while (running && next >= duration) {
      grantOutputs(s, scaleOutputs(recipe.outputs, s.multipliers.craftOutput));
      next -= duration;
      const repeat = s.craftRepeat[recipeId] ?? 0;
      if (repeat > 0 && canAfford(s, recipe.inputs)) {
        spendInputs(s, recipe.inputs);
        if (repeat === 1) delete s.craftRepeat[recipeId];
        else s.craftRepeat[recipeId] = repeat - 1;
      } else {
        running = false;
        delete s.craftRepeat[recipeId];
      }
    }
    if (running) s.craftJobs[recipeId] = next;
    else delete s.craftJobs[recipeId];
  }

  return s;
}
