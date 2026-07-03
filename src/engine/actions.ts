import { RECIPE_BY_ID } from '../content/recipes';
import { RESOURCE_BY_ID } from '../content/resources';
import { TECH_BY_ID } from '../content/tech';
import { WORKER_BY_TYPE } from '../content/workers';
import { computeMultipliers, harvestMultiplier } from './multipliers';
import { game } from './state';
import { canAfford, grantOutputs, spendInputs, tick } from './tick';
import type { GameState, Recipe, ResourceId, TechId, WorkerType } from './types';

// ---- Game loop -------------------------------------------------------------

const MAX_CATCHUP_SECONDS = 8 * 3600;
let lastTickAt: number | null = null;

export function resetTickClock(now = Date.now()): void {
  lastTickAt = now;
}

// Called once per second by the UI. Uses real elapsed time so throttled
// background tabs catch up correctly on the next tick.
export function runTick(now = Date.now()): void {
  if (lastTickAt === null) lastTickAt = now;
  const seconds = Math.min(Math.max((now - lastTickAt) / 1000, 0), MAX_CATCHUP_SECONDS);
  lastTickAt = now;
  if (seconds <= 0) return;
  game.update((s) => ({ ...tick(s, seconds) }));
}

// ---- Manual actions (outside the tick) --------------------------------------

export function harvest(resourceId: ResourceId): void {
  game.update((s) => {
    const def = RESOURCE_BY_ID[resourceId];
    if (!def || def.manualHarvestAmount <= 0 || !s.unlockedResources.includes(resourceId)) return s;
    s.resources[resourceId] =
      (s.resources[resourceId] ?? 0) +
      def.manualHarvestAmount * harvestMultiplier(s.multipliers, resourceId);
    return { ...s };
  });
}

export function craft(recipeId: string): void {
  game.update((s) => {
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe || !s.unlockedRecipes.includes(recipeId) || !canAfford(s, recipe.inputs)) return s;
    spendInputs(s, recipe.inputs);
    grantOutputs(s, recipe.outputs);
    if (recipe.researchOutput) s.researchPoints += recipe.researchOutput;
    unlockOutputs(s, recipe);
    return { ...s };
  });
}

export function buyTech(techId: TechId): void {
  game.update((s) => {
    const node = TECH_BY_ID[techId];
    if (!node || s.unlockedTech.includes(techId)) return s;
    if (!node.requires.every((r) => s.unlockedTech.includes(r))) return s;
    if (s.researchPoints < node.cost) return s;
    s.researchPoints -= node.cost;
    s.unlockedTech.push(techId);
    for (const effect of node.effects) {
      if (effect.kind === 'unlockResource') {
        pushUnique(s.unlockedResources, effect.id);
      } else if (effect.kind === 'unlockRecipe') {
        pushUnique(s.unlockedRecipes, effect.id);
        const recipe = RECIPE_BY_ID[effect.id];
        if (recipe) unlockOutputs(s, recipe);
      } else if (effect.kind === 'unlockWorkerType') {
        pushUnique(s.unlockedWorkerTypes, effect.workerType);
      }
      // Multiplier effects need no unlock step — they're derived below.
    }
    s.multipliers = computeMultipliers(s.unlockedTech);
    return { ...s };
  });
}

export function sellResource(resourceId: ResourceId, amount: number | 'all'): void {
  game.update((s) => {
    const def = RESOURCE_BY_ID[resourceId];
    if (!def || !s.unlockedResources.includes(resourceId)) return s;
    const have = Math.floor(s.resources[resourceId] ?? 0);
    const n = amount === 'all' ? have : Math.min(amount, have);
    if (n <= 0) return s;
    s.resources[resourceId] = (s.resources[resourceId] ?? 0) - n;
    s.credits += n * def.baseSellPrice;
    return { ...s };
  });
}

export function nextHireCost(type: WorkerType, owned: number): number {
  const def = WORKER_BY_TYPE[type];
  return Math.ceil(def.hireCost * def.hireCostGrowth ** owned);
}

export function hireWorker(type: WorkerType): void {
  game.update((s) => {
    if (!s.unlockedWorkerTypes.includes(type)) return s;
    const cost = nextHireCost(type, s.workers[type]);
    if (s.credits < cost) return s;
    s.credits -= cost;
    s.workers[type] += 1;
    return { ...s };
  });
}

export function assignedHarvesters(s: GameState): number {
  return Object.values(s.harvesterAssignment).reduce((sum, n) => sum + n, 0);
}

export function assignHarvester(resourceId: ResourceId, delta: number): void {
  game.update((s) => {
    const current = s.harvesterAssignment[resourceId] ?? 0;
    const idle = s.workers.harvester - assignedHarvesters(s);
    const next = Math.max(0, Math.min(current + delta, current + idle));
    if (next === current) return s;
    s.harvesterAssignment = { ...s.harvesterAssignment, [resourceId]: next };
    return { ...s };
  });
}

export function setCrafterRecipe(recipeId: string | null): void {
  game.update((s) => {
    if (recipeId !== null && !s.unlockedRecipes.includes(recipeId)) return s;
    if (s.crafterRecipe === recipeId) return s;
    return { ...s, crafterRecipe: recipeId, crafterProgress: 0 };
  });
}

// ---- Helpers ----------------------------------------------------------------

function pushUnique<T>(arr: T[], value: T): void {
  if (!arr.includes(value)) arr.push(value);
}

// Crafting or unlocking a recipe reveals its output items in Market/top bar.
function unlockOutputs(s: GameState, recipe: Recipe): void {
  for (const id of Object.keys(recipe.outputs)) pushUnique(s.unlockedResources, id);
}
