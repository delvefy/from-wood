import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { get } from 'svelte/store';
import { writable } from 'svelte/store';
import { migrateLegacyPremium } from './account';
import { computeMultipliers } from './multipliers';
import { gameMode, type GameMode } from './mode';
import { createInitialState, game } from './state';
import { tick } from './tick';
import { resetTickClock } from './actions';
import { clearTournamentMeta, getTournamentMeta } from './tournamentMeta';
import type { GameState } from './types';

// One save slot per mode: the village and the current tournament run are
// fully independent games sharing the same engine.
const SAVE_KEYS: Record<GameMode, string> = {
  main: 'from-wood-save-v2',
  tournament: 'from-wood-tournament-save-v1',
};
const LEGACY_SAVE_KEYS = ['from-wood-save-v1'];
export const OFFLINE_CAP_SECONDS = 8 * 3600;

export interface OfflineReport {
  seconds: number;
  resourceGains: Record<string, number>;
  techCompleted: string[];
}

// Set by loadGame whenever catch-up produced something worth showing; the app
// shell renders it as the "While you were away…" modal (also on slot switch).
export const offlineReport = writable<OfflineReport | null>(null);

export async function saveGame(): Promise<void> {
  if (suspended) return;
  game.update((s) => ({ ...s, lastSeen: Date.now() }));
  // Plain deep clone so IndexedDB never sees store-internal references.
  await idbSet(SAVE_KEYS[get(gameMode)], JSON.parse(JSON.stringify(get(game))));
}

// While the cloud-save layer swaps the local state over to another account,
// autosave and score submission must not run against half-swapped state.
let suspended = false;

export function savesSuspended(): boolean {
  return suspended;
}

export async function withSavesSuspended<T>(fn: () => Promise<T>): Promise<T> {
  suspended = true;
  try {
    return await fn();
  } finally {
    suspended = false;
  }
}

// Raw slot contents, for the cloud-save layer to back up and restore
// wholesale without going through the live game store.
export interface SlotSnapshot {
  main?: GameState;
  tournament?: GameState;
}

export async function snapshotSlots(): Promise<SlotSnapshot> {
  const [main, tournament] = await Promise.all([
    idbGet(SAVE_KEYS.main) as Promise<GameState | undefined>,
    idbGet(SAVE_KEYS.tournament) as Promise<GameState | undefined>,
  ]);
  const slots: SlotSnapshot = {};
  if (main) slots.main = main;
  if (tournament) slots.tournament = tournament;
  return slots;
}

export async function restoreSlots(slots: SlotSnapshot): Promise<void> {
  await (slots.main ? idbSet(SAVE_KEYS.main, slots.main) : idbDel(SAVE_KEYS.main));
  await (slots.tournament
    ? idbSet(SAVE_KEYS.tournament, slots.tournament)
    : idbDel(SAVE_KEYS.tournament));
}

// Loads the active slot's save (if any), fast-forwards all timed work for the
// time away (capped), and returns a summary of what was gained.
export async function loadGame(): Promise<OfflineReport | null> {
  for (const key of LEGACY_SAVE_KEYS) void idbDel(key);
  const mode = get(gameMode);
  const saved = (await idbGet(SAVE_KEYS[mode])) as Partial<GameState> | undefined;
  if (!saved) {
    // An empty tournament slot starts fresh rather than leaking village state
    // (normally unreachable: joining writes a fresh save before switching).
    if (mode === 'tournament') game.set(createInitialState());
    return null;
  }

  const base = createInitialState();
  // Merge over the initial state so saves survive new content/fields, and
  // union unlock lists so newly-default content is never lost.
  const s: GameState = {
    ...base,
    ...saved,
    resources: { ...base.resources, ...(saved.resources ?? {}) },
    gatherAssignment: { ...(saved.gatherAssignment ?? {}) },
    gatherProgress: { ...(saved.gatherProgress ?? {}) },
    craftAssignment: { ...(saved.craftAssignment ?? {}) },
    craftProgress: { ...(saved.craftProgress ?? {}) },
    unlockedResources: union(base.unlockedResources, saved.unlockedResources),
    unlockedRecipes: union(base.unlockedRecipes, saved.unlockedRecipes),
    unlockedTech: union([], saved.unlockedTech),
    researchQueue: [...(saved.researchQueue ?? [])],
    multipliers: computeMultipliers(saved.unlockedTech ?? []),
  };

  // Legacy saves kept premium purchases inside the slot; move them onto the
  // account once so they keep working (and now apply to both slots).
  const legacyPremium = (saved as { premium?: Record<string, number> }).premium;
  if (legacyPremium && Object.keys(legacyPremium).length > 0) {
    migrateLegacyPremium(legacyPremium);
  }

  const now = Date.now();
  // Tournament runs freeze at the finish line: catch-up never runs past it.
  let horizon = now;
  if (mode === 'tournament') {
    const meta = getTournamentMeta();
    if (meta) horizon = Math.min(now, meta.endsAt);
  }
  const elapsed = Math.min(
    Math.max(Math.floor((horizon - (saved.lastSeen ?? horizon)) / 1000), 0),
    OFFLINE_CAP_SECONDS,
  );

  let report: OfflineReport | null = null;
  if (elapsed >= 5) {
    const resourcesBefore = { ...s.resources };
    const techBefore = new Set(s.unlockedTech);
    tick(s, elapsed);
    const resourceGains: Record<string, number> = {};
    for (const [id, value] of Object.entries(s.resources)) {
      const gain = value - (resourcesBefore[id] ?? 0);
      if (gain > 0.005) resourceGains[id] = gain;
    }
    const techCompleted = s.unlockedTech.filter((id) => !techBefore.has(id));
    if (Object.keys(resourceGains).length > 0 || techCompleted.length > 0) {
      report = { seconds: elapsed, resourceGains, techCompleted };
    }
  }

  s.lastSeen = now;
  game.set(s);
  if (report) offlineReport.set(report);
  return report;
}

// Called on tournament join: overwrite the tournament slot with a brand-new
// run. Base workers (premium packs + tournament rewards) need no seeding here —
// they live on the account and apply to whichever slot is loaded.
export async function writeFreshTournamentSave(): Promise<void> {
  const s: GameState = { ...createInitialState(), lastSeen: Date.now() };
  await idbSet(SAVE_KEYS.tournament, JSON.parse(JSON.stringify(s)));
}

export async function hardReset(): Promise<void> {
  await idbDel(SAVE_KEYS.main);
  await idbDel(SAVE_KEYS.tournament);
  clearTournamentMeta();
  gameMode.set('main');
  game.set(createInitialState());
  resetTickClock();
  await saveGame();
}

function union<T>(base: T[], saved: T[] | undefined): T[] {
  return Array.from(new Set([...base, ...(saved ?? [])]));
}
