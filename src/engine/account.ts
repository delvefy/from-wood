import { get, writable } from 'svelte/store';
import type { PremiumId } from './types';

// Account-level data: everything that belongs to the player rather than to a
// save slot. Base workers — real-money premium purchases plus worker rewards
// won in tournaments — live here, so they apply to the village and seed every
// new tournament run alike. Only the full hard reset (hardReset.ts) wipes them.
export interface AccountData {
  premium: Record<PremiumId, number>; // real-money purchases, id → copies owned
  rewardGatherers: number; // permanent gatherers won in tournaments
  rewardCrafters: number; // permanent crafters won in tournaments
  claimedTournamentIds: string[]; // tournaments whose rewards were already granted
}

const STORAGE_KEY = 'from-wood-account-v1';

const EMPTY: AccountData = {
  premium: {},
  rewardGatherers: 0,
  rewardCrafters: 0,
  claimedTournamentIds: [],
};

function normalize(parsed: Partial<AccountData> | null | undefined): AccountData {
  if (!parsed) return { ...EMPTY };
  return {
    ...EMPTY,
    ...parsed,
    premium: { ...(parsed.premium ?? {}) },
    claimedTournamentIds: [...(parsed.claimedTournamentIds ?? [])],
  };
}

function load(): AccountData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalize(raw ? (JSON.parse(raw) as Partial<AccountData>) : null);
  } catch {
    return { ...EMPTY };
  }
}

export const account = writable<AccountData>(load());

// Cloud-save account switch: replace the whole account (null → empty).
export function replaceAccountData(data: Partial<AccountData> | null): void {
  account.set(normalize(data));
}

account.subscribe((a) => localStorage.setItem(STORAGE_KEY, JSON.stringify(a)));

// Snapshot for engine code (tick, worth) that isn't store-reactive.
export function getAccount(): AccountData {
  return get(account);
}

// One-time move of premium counts that older saves kept inside GameState.
// Max per id (not sum) so loading both slots can't double purchases.
export function migrateLegacyPremium(premium: Record<PremiumId, number>): void {
  account.update((a) => {
    const merged = { ...a.premium };
    for (const [id, n] of Object.entries(premium)) merged[id] = Math.max(merged[id] ?? 0, n);
    return { ...a, premium: merged };
  });
}

// Adds a finished tournament's worker reward to the base workers, exactly once
// per tournament. Returns whether anything was granted by this call.
export function grantTournamentReward(
  tournamentId: string,
  gatherers: number,
  crafters: number,
): boolean {
  let granted = false;
  account.update((a) => {
    if (a.claimedTournamentIds.includes(tournamentId)) return a;
    granted = true;
    return {
      ...a,
      rewardGatherers: a.rewardGatherers + gatherers,
      rewardCrafters: a.rewardCrafters + crafters,
      claimedTournamentIds: [...a.claimedTournamentIds, tournamentId],
    };
  });
  return granted;
}
