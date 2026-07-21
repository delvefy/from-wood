import { PREMIUM_BY_ID } from '../content/premium';
import { account, type AccountData } from './account';
import type { GameState, PremiumId } from './types';

// All premium effects and base-worker bonuses are pure functions of the
// account-level counts (money purchases + tournament reward workers). They
// live on the account, not the save slot, so they apply to the village and to
// every tournament run alike — a fresh run starts with the full base crew.

export function premiumOwned(a: AccountData, id: PremiumId): number {
  return a.premium[id] ?? 0;
}

// Managers: flat on/off boosts (unique items, so counts are 0 or 1). The
// factor scales the time-per-run, which under continuous flows is exactly a
// 2× rate: rate = amount / (baseTime × factor).
export function gatherTimeFactor(a: AccountData): number {
  return premiumOwned(a, 'gatherManager') > 0 ? 0.5 : 1;
}

export function craftTimeFactor(a: AccountData): number {
  return premiumOwned(a, 'craftManager') > 0 ? 0.5 : 1;
}

export function sellPriceFactor(a: AccountData): number {
  return premiumOwned(a, 'marketManager') > 0 ? 2 : 1;
}

// Base workers on top of the hired pool: money-bought packs plus tournament
// reward workers. Hire costs scale off `s.workers` / `s.crafters` alone, so
// base workers never raise them.
export function bonusGatherers(a: AccountData): number {
  return 10 * premiumOwned(a, 'gathererPack') + a.rewardGatherers;
}

export function bonusCrafters(a: AccountData): number {
  return premiumOwned(a, 'crafterPack') + a.rewardCrafters;
}

export function totalGatherers(s: GameState, a: AccountData): number {
  return s.workers + bonusGatherers(a);
}

export function totalCrafters(s: GameState, a: AccountData): number {
  return s.crafters + bonusCrafters(a);
}

// Free during development: the UI confirms the (pretend) charge, then this
// just grants the item on the account.
export function buyPremium(id: PremiumId): void {
  const item = PREMIUM_BY_ID[id];
  if (!item) return;
  account.update((a) => {
    if (item.unique && premiumOwned(a, id) > 0) return a;
    return { ...a, premium: { ...a.premium, [id]: premiumOwned(a, id) + 1 } };
  });
}
