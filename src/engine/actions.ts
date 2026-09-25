import { get } from 'svelte/store';
import { CATEGORY_ORDER, RECIPES, RECIPE_BY_ID } from '../content/recipes';
import { RESOURCES, RESOURCE_BY_ID } from '../content/resources';
import { techById } from '../content/tech';
import { CRAFTER, GATHERER } from '../content/workers';
import { getAccount } from './account';
import { gameMode } from './mode';
import { sellPriceFactor, totalCrafters, totalGatherers } from './premium';
import { villageTreeComplete } from './prestige';
import { creditableSeconds, trustedNow } from './clock';
import type { SlotCatchUp } from './save';
import { game } from './state';
import { canAfford, spendInputs, tick } from './tick';
import type { GameState, ResourceId, TechId, WorkerConfig } from './types';
import { totalValue } from './worth';

// ---- Game loop -------------------------------------------------------------

// An app that was backgrounded rather than killed catches up through here
// instead of through loadGame, under the same caps (engine/clock.ts).
//
// Jumps shorter than this are ordinary background-tab throttling, not an
// absence; pricing them every second would be wasted work.
const REPORTABLE_GAP_SECONDS = 60;
let lastPerf: number | null = null;

export function resetTickClock(): void {
  lastPerf = performance.now();
}

// Called once per second by the UI. Advances the live slot from its lastSeen
// to trusted time (server-anchored, engine/clock.ts), so a throttled or
// backgrounded app catches up on the next tick and the device clock is never
// consulted. Before the first server sync only monotonic time spent in the
// app counts. Returns what the jump was worth when it was long enough to be
// an absence (engine/away.ts decides whether that is worth telling the player
// about), null otherwise.
export function runTick(): SlotCatchUp | null {
  const perf = performance.now();
  const played = lastPerf === null ? 0 : Math.max(perf - lastPerf, 0);
  lastPerf = perf;
  const mode = get(gameMode);
  const s = get(game);
  const to = trustedNow() ?? s.lastSeen + played;
  const seconds = creditableSeconds(mode, s.lastSeen, to);
  if (seconds <= 0) {
    // lastSeen ahead of the server (a save stamped by a fast device clock):
    // rewind it without paying anything.
    if (to < s.lastSeen) game.set({ ...s, lastSeen: to });
    return null;
  }
  const report = seconds >= REPORTABLE_GAP_SECONDS;
  const before = report ? totalValue(s, mode) : 0;
  const next = { ...tick(s, seconds, mode), lastSeen: to };
  game.set(next);
  return report ? { mode, seconds, gain: totalValue(next, mode) - before } : null;
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
// Costs keep their decimals (rounded to cents) — credits are not integers.
export function nextHireCost(config: WorkerConfig, owned: number): number {
  const hired = Math.max(0, owned - config.startingCount);
  return Math.round(config.hireCost * config.hireCostGrowth ** hired * 100) / 100;
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

// Research costs resources, paid up-front when the node is queued, and locks
// in: there is no cancel or refund. Prices are mode-dependent (each mode has
// its own tree with costs baked in).
export function queueResearch(techId: TechId): void {
  game.update((s) => {
    const node = techById(get(gameMode))[techId];
    if (!node || s.unlockedTech.includes(techId) || s.researchQueue.includes(techId)) return s;
    // Prestige nodes sit in the village id map from day one (tier-1 smalls
    // have no prerequisites), but the Expansion tree only opens once the
    // whole base tree is researched.
    if (node.branch === 'prestige' && !villageTreeComplete(s.unlockedTech)) return s;
    const satisfied = node.requires.every(
      (r) => s.unlockedTech.includes(r) || s.researchQueue.includes(r),
    );
    const cost = node.cost;
    if (!satisfied || !canAfford(s, cost)) return s;
    spendInputs(s, cost);
    return { ...s, researchQueue: [...s.researchQueue, techId] };
  });
}

// ---- Economy -------------------------------------------------------------------

// `fraction` sells that share of each stack (0..1). Stacks are fractional
// (gathering and crafting accrue continuously), so no rounding — selling 100%
// empties the stack exactly.
export function sellEverything(fraction = 1): void {
  game.update((s) => {
    let gained = 0;
    const f = Math.min(1, Math.max(0, fraction));
    const priceFactor = sellPriceFactor(getAccount());
    for (const id of s.unlockedResources) {
      const def = RESOURCE_BY_ID[id];
      const n = (s.resources[id] ?? 0) * f;
      if (!def || n <= 0) continue;
      s.resources[id] = f === 1 ? 0 : (s.resources[id] ?? 0) - n;
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
    const have = s.resources[resourceId] ?? 0;
    const n = amount === 'all' ? have : Math.min(amount, have);
    if (n <= 0) return s;
    s.resources[resourceId] = (s.resources[resourceId] ?? 0) - n;
    s.credits += n * def.baseSellPrice * sellPriceFactor(getAccount());
    return { ...s };
  });
}
