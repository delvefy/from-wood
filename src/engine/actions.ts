import { RECIPE_BY_ID } from '../content/recipes';
import { RESOURCE_BY_ID } from '../content/resources';
import { TECH_BY_ID } from '../content/tech';
import { WORKER } from '../content/workers';
import { game } from './state';
import { canAfford, grantOutputs, spendInputs, tick } from './tick';
import type { GameState, ResourceId, TechId } from './types';

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

// ---- Workers / gather slots --------------------------------------------------

export function assignedWorkers(s: GameState): number {
  return Object.values(s.gatherAssignment).reduce((sum, n) => sum + n, 0);
}

export function idleWorkers(s: GameState): number {
  return s.workers - assignedWorkers(s);
}

export function assignWorker(resourceId: ResourceId, delta: number): void {
  game.update((s) => {
    const def = RESOURCE_BY_ID[resourceId];
    if (!def || def.harvestAmount <= 0 || !s.unlockedResources.includes(resourceId)) return s;
    const current = s.gatherAssignment[resourceId] ?? 0;
    const next = Math.max(0, Math.min(current + delta, current + idleWorkers(s)));
    if (next === current) return s;
    s.gatherAssignment = { ...s.gatherAssignment, [resourceId]: next };
    return { ...s };
  });
}

// Hired workers = owned minus the free starting slots; cost scales with those.
export function nextHireCost(workersOwned: number): number {
  const hired = Math.max(0, workersOwned - WORKER.startingCount);
  return Math.ceil(WORKER.hireCost * WORKER.hireCostGrowth ** hired);
}

export function hireWorker(): void {
  game.update((s) => {
    const cost = nextHireCost(s.workers);
    if (s.credits < cost) return s;
    return { ...s, credits: s.credits - cost, workers: s.workers + 1 };
  });
}

// ---- Crafting ----------------------------------------------------------------

// Starts a craft, or queues extra runs behind the running job. Inputs are paid
// per run (the first immediately, the rest as each run starts), so cancelling
// the queue never needs a refund.
export function startCraft(recipeId: string, times = 1): void {
  game.update((s) => {
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe || !s.unlockedRecipes.includes(recipeId) || times < 1) return s;
    if (recipeId in s.craftJobs) {
      // already running: just extend the repeat queue
      s.craftRepeat = { ...s.craftRepeat, [recipeId]: (s.craftRepeat[recipeId] ?? 0) + times };
      return { ...s };
    }
    if (!canAfford(s, recipe.inputs)) return s;
    spendInputs(s, recipe.inputs);
    s.craftJobs = { ...s.craftJobs, [recipeId]: 0 };
    if (times > 1) s.craftRepeat = { ...s.craftRepeat, [recipeId]: times - 1 };
    return { ...s };
  });
}

export function cancelCraftQueue(recipeId: string): void {
  game.update((s) => {
    if (!(recipeId in s.craftRepeat)) return s;
    const { [recipeId]: _, ...rest } = s.craftRepeat;
    return { ...s, craftRepeat: rest };
  });
}

// How many runs of a recipe the current stock can pay for.
export function affordableRuns(s: GameState, recipeId: string): number {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) return 0;
  let runs = Infinity;
  for (const [id, n] of Object.entries(recipe.inputs)) {
    runs = Math.min(runs, Math.floor((s.resources[id] ?? 0) / n));
  }
  return Number.isFinite(runs) ? runs : 0;
}

// ---- Research queue ------------------------------------------------------------

// Research costs resources, paid up-front when the node is queued.
export function queueResearch(techId: TechId): void {
  game.update((s) => {
    const node = TECH_BY_ID[techId];
    if (!node || s.unlockedTech.includes(techId) || s.researchQueue.includes(techId)) return s;
    const satisfied = node.requires.every(
      (r) => s.unlockedTech.includes(r) || s.researchQueue.includes(r),
    );
    if (!satisfied || !canAfford(s, node.cost)) return s;
    spendInputs(s, node.cost);
    return { ...s, researchQueue: [...s.researchQueue, techId] };
  });
}

// Removes a queued node plus everything queued behind it that depends on it.
// All removed nodes get their resource cost refunded in full.
export function cancelResearch(techId: TechId): void {
  game.update((s) => {
    if (!s.researchQueue.includes(techId)) return s;
    const removed = new Set<TechId>([techId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of s.researchQueue) {
        if (removed.has(id)) continue;
        const node = TECH_BY_ID[id];
        if (node?.requires.some((r) => removed.has(r))) {
          removed.add(id);
          changed = true;
        }
      }
    }
    for (const id of removed) {
      const node = TECH_BY_ID[id];
      if (node) grantOutputs(s, node.cost);
    }
    const wasHead = s.researchQueue[0] === techId;
    return {
      ...s,
      researchQueue: s.researchQueue.filter((id) => !removed.has(id)),
      researchProgress: wasHead ? 0 : s.researchProgress,
    };
  });
}

// ---- Economy -------------------------------------------------------------------

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
