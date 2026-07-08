import { PREMIUM_BY_ID } from '../content/premium';
import { game } from './state';
import type { GameState, PremiumId } from './types';

// All premium effects are pure functions of the ownership counts in
// `s.premium`, mirroring how tech multipliers are derived — nothing here is
// persisted beyond the counts themselves.

export function premiumOwned(s: GameState, id: PremiumId): number {
  return s.premium[id] ?? 0;
}

// Managers: flat on/off boosts (unique items, so counts are 0 or 1).
export function gatherTimeFactor(s: GameState): number {
  return premiumOwned(s, 'gatherManager') > 0 ? 0.5 : 1;
}

export function craftTimeFactor(s: GameState): number {
  return premiumOwned(s, 'craftManager') > 0 ? 0.5 : 1;
}

export function sellPriceFactor(s: GameState): number {
  return premiumOwned(s, 'marketManager') > 0 ? 2 : 1;
}

// Packs grant workers on top of the hired pool. Hire costs scale off
// `s.workers` / `s.crafters` alone, so pack workers never raise them.
export function bonusGatherers(s: GameState): number {
  return 10 * premiumOwned(s, 'gathererPack');
}

export function bonusCrafters(s: GameState): number {
  return premiumOwned(s, 'crafterPack');
}

export function totalGatherers(s: GameState): number {
  return s.workers + bonusGatherers(s);
}

export function totalCrafters(s: GameState): number {
  return s.crafters + bonusCrafters(s);
}

// Free during development: the UI confirms the (pretend) charge, then this
// just grants the item.
export function buyPremium(id: PremiumId): void {
  game.update((s) => {
    const item = PREMIUM_BY_ID[id];
    if (!item) return s;
    if (item.unique && premiumOwned(s, id) > 0) return s;
    return { ...s, premium: { ...s.premium, [id]: premiumOwned(s, id) + 1 } };
  });
}
