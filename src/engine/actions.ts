import { CATEGORY_ORDER, RECIPES, RECIPE_BY_ID } from '../content/recipes';
import { RESOURCES, RESOURCE_BY_ID } from '../content/resources';
import { TECH_BY_ID } from '../content/tech';
import { CRAFTER, GATHERER } from '../content/workers';
import { getAccount } from './account';
import { sellPriceFactor, totalCrafters, totalGatherers } from './premium';
import { game } from './state';
import { canAfford, grantOutputs, spendInputs, tick } from './tick';
import type { GameState, ResourceId, TechId, WorkerConfig } from './types';

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
  return totalGatherers(s, getAccount()) - assignedWorkers(s);
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

// Distributes `idle` workers over `targets` (in display order): each goes to
// the first target with the lowest count, so the spread stays as even as
// possible with the remainder landing top-to-bottom.
function distributeIdle(
  targets: string[],
  assignment: Record<string, number>,
  idle: number,
): Record<string, number> {
  const next = { ...assignment };
  while (idle-- > 0) {
    let best = targets[0];
    for (const id of targets) {
      if ((next[id] ?? 0) < (next[best] ?? 0)) best = id;
    }
    next[best] = (next[best] ?? 0) + 1;
  }
  return next;
}

export function unassignAllWorkers(): void {
  game.update((s) => ({ ...s, gatherAssignment: {} }));
}

export function assignAllWorkers(): void {
  game.update((s) => {
    const targets = RESOURCES.filter(
      (r) => r.harvestAmount > 0 && s.unlockedResources.includes(r.id),
    ).map((r) => r.id);
    const idle = idleWorkers(s);
    if (targets.length === 0 || idle <= 0) return s;
    return { ...s, gatherAssignment: distributeIdle(targets, s.gatherAssignment, idle) };
  });
}

// Hired workers = owned minus the free starting slots; cost scales with those.
export function nextHireCost(config: WorkerConfig, owned: number): number {
  const hired = Math.max(0, owned - config.startingCount);
  return Math.ceil(config.hireCost * config.hireCostGrowth ** hired);
}

export function hireWorker(): void {
  game.update((s) => {
    const cost = nextHireCost(GATHERER, s.workers);
    if (s.credits < cost) return s;
    return { ...s, credits: s.credits - cost, workers: s.workers + 1 };
  });
}

// ---- Crafters / craft slots ----------------------------------------------------

export function assignedCrafters(s: GameState): number {
  return Object.values(s.craftAssignment).reduce((sum, n) => sum + n, 0);
}

export function idleCrafters(s: GameState): number {
  return totalCrafters(s, getAccount()) - assignedCrafters(s);
}

export function assignCrafter(recipeId: string, delta: number): void {
  game.update((s) => {
    if (!RECIPE_BY_ID[recipeId] || !s.unlockedRecipes.includes(recipeId)) return s;
    const current = s.craftAssignment[recipeId] ?? 0;
    const next = Math.max(0, Math.min(current + delta, current + idleCrafters(s)));
    if (next === current) return s;
    s.craftAssignment = { ...s.craftAssignment, [recipeId]: next };
    return { ...s };
  });
}

export function unassignAllCrafters(): void {
  game.update((s) => ({ ...s, craftAssignment: {} }));
}

export function assignAllCrafters(): void {
  game.update((s) => {
    // Same top-to-bottom order the Craft tab renders: category by category.
    const targets = CATEGORY_ORDER.flatMap((cat) =>
      RECIPES.filter((r) => r.category === cat.id && s.unlockedRecipes.includes(r.id)),
    ).map((r) => r.id);
    const idle = idleCrafters(s);
    if (targets.length === 0 || idle <= 0) return s;
    return { ...s, craftAssignment: distributeIdle(targets, s.craftAssignment, idle) };
  });
}

export function hireCrafter(): void {
  game.update((s) => {
    const cost = nextHireCost(CRAFTER, s.crafters);
    if (s.credits < cost) return s;
    return { ...s, credits: s.credits - cost, crafters: s.crafters + 1 };
  });
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

// `fraction` sells that share of each stack (0..1), rounded down per resource.
export function sellEverything(fraction = 1): void {
  game.update((s) => {
    let gained = 0;
    const f = Math.min(1, Math.max(0, fraction));
    const priceFactor = sellPriceFactor(getAccount());
    for (const id of s.unlockedResources) {
      const def = RESOURCE_BY_ID[id];
      const n = Math.floor(Math.floor(s.resources[id] ?? 0) * f);
      if (!def || n <= 0) continue;
      s.resources[id] = (s.resources[id] ?? 0) - n;
      gained += n * def.baseSellPrice * priceFactor;
    }
    if (gained <= 0) return s;
    return { ...s, credits: s.credits + gained };
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
    s.credits += n * def.baseSellPrice * sellPriceFactor(getAccount());
    return { ...s };
  });
}
