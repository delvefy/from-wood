import { get } from 'svelte/store';
import { RESOURCES } from '../content/resources';
import { PRESTIGE_TREE, techTree } from '../content/tech';
import { CRAFTER, GATHERER } from '../content/workers';
import { getAccount } from './account';
import { gameMode, type GameMode } from './mode';
import { sellPriceFactor } from './premium';
import type { GameState, WorkerConfig } from './types';

// Precomputed once at module load so totalValue stays cheap per tick.
const PRICE: Record<string, number> = Object.fromEntries(
  RESOURCES.map((r) => [r.id, r.baseSellPrice]),
);

// Sell value of each tech node's resource cost — per mode, since each mode
// has its own tree (tournament runs a much cheaper price curve). The village
// map includes the prestige Expansion nodes: their Wonder costs count toward
// net worth like any other research spend.
const TECH_VALUE: Record<GameMode, Record<string, number>> = Object.fromEntries(
  (['main', 'tournament'] as GameMode[]).map((mode) => [
    mode,
    Object.fromEntries(
      (mode === 'main' ? [...techTree(mode), ...PRESTIGE_TREE] : techTree(mode)).map((t) => [
        t.id,
        Object.entries(t.cost).reduce((sum, [id, n]) => sum + n * (PRICE[id] ?? 0), 0),
      ]),
    ),
  ]),
) as Record<GameMode, Record<string, number>>;

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
  const priceFactor = sellPriceFactor(getAccount());
  const techValue = TECH_VALUE[get(gameMode)];
  for (const [id, n] of Object.entries(s.resources)) total += n * (PRICE[id] ?? 0) * priceFactor;
  total += hiredValue(GATHERER, s.workers) + hiredValue(CRAFTER, s.crafters);
  for (const id of s.unlockedTech) total += techValue[id] ?? 0;
  for (const id of s.researchQueue) total += techValue[id] ?? 0;
  return total;
}
