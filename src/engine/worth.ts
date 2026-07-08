import { RESOURCES } from '../content/resources';
import { TECH } from '../content/tech';
import { CRAFTER, GATHERER } from '../content/workers';
import { sellPriceFactor } from './premium';
import type { GameState, WorkerConfig } from './types';

// Precomputed once at module load so totalValue stays cheap per tick.
const PRICE: Record<string, number> = Object.fromEntries(
  RESOURCES.map((r) => [r.id, r.baseSellPrice]),
);

// Sell value of each tech node's resource cost.
const TECH_VALUE: Record<string, number> = Object.fromEntries(
  TECH.map((t) => [
    t.id,
    Object.entries(t.cost).reduce((sum, [id, n]) => sum + n * (PRICE[id] ?? 0), 0),
  ]),
);

// Credits spent hiring up to `owned` workers: closed-form geometric sum, so no
// loop over the workforce (ignores the per-purchase rounding, fine for display).
function hiredValue(config: WorkerConfig, owned: number): number {
  const hired = Math.max(0, owned - config.startingCount);
  if (hired <= 0) return 0;
  return (config.hireCost * (config.hireCostGrowth ** hired - 1)) / (config.hireCostGrowth - 1);
}

// Net worth: cash + stock at sell price + credits sunk into workers + resources
// sunk into research (queued nodes count too — their cost is paid up-front and
// refundable). O(resources + tech owned) per call, everything else precomputed.
export function totalValue(s: GameState): number {
  let total = s.credits;
  const priceFactor = sellPriceFactor(s);
  for (const [id, n] of Object.entries(s.resources)) total += n * (PRICE[id] ?? 0) * priceFactor;
  total += hiredValue(GATHERER, s.workers) + hiredValue(CRAFTER, s.crafters);
  for (const id of s.unlockedTech) total += TECH_VALUE[id] ?? 0;
  for (const id of s.researchQueue) total += TECH_VALUE[id] ?? 0;
  return total;
}
