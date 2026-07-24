import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { get } from 'svelte/store';
import { techById, techTree } from '../content/tech';
import { migrateLegacyPremium } from './account';
import { computeMultipliers } from './multipliers';
import { gameMode, type GameMode } from './mode';
import { createInitialState, game } from './state';
import { tick } from './tick';
import { resetTickClock } from './actions';
import { clearTournamentMeta, getTournamentMeta } from './tournamentMeta';
import type { GameState, TechId } from './types';

// One save slot per mode: the village and the current tournament run are
// fully independent games sharing the same engine.
const SAVE_KEYS: Record<GameMode, string> = {
  main: 'from-wood-save-v2',
  tournament: 'from-wood-tournament-save-v1',
};
const LEGACY_SAVE_KEYS = ['from-wood-save-v1'];
export const OFFLINE_CAP_SECONDS = 8 * 3600;

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

// Loads the active slot's save (if any) and silently fast-forwards all timed
// work for the time away (capped).
export async function loadGame(): Promise<void> {
  for (const key of LEGACY_SAVE_KEYS) void idbDel(key);
  const mode = get(gameMode);
  const saved = (await idbGet(SAVE_KEYS[mode])) as Partial<GameState> | undefined;
  if (!saved) {
    // An empty tournament slot starts fresh rather than leaking village state
    // (normally unreachable: joining writes a fresh save before switching).
    if (mode === 'tournament') game.set(createInitialState());
    return;
  }

  const base = createInitialState();
  const unlockedTech = migrateVanishedTech(union([], saved.unlockedTech), mode);
  // Merge over the initial state so saves survive new content/fields, and
  // union unlock lists so newly-default content is never lost.
  const s: GameState = {
    ...base,
    ...saved,
    resources: { ...base.resources, ...(saved.resources ?? {}) },
    gatherAssignment: { ...(saved.gatherAssignment ?? {}) },
    craftAssignment: { ...(saved.craftAssignment ?? {}) },
    unlockedResources: union(base.unlockedResources, saved.unlockedResources),
    unlockedRecipes: union(base.unlockedRecipes, saved.unlockedRecipes),
    unlockedTech,
    researchQueue: (saved.researchQueue ?? []).filter((id) => techById(mode)[id]),
    multipliers: computeMultipliers(unlockedTech, mode),
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

  if (elapsed > 0) tick(s, elapsed);

  s.lastSeen = now;
  game.set(s);
}

// Called on tournament join: overwrite the tournament slot with a brand-new
// run. Base workers (premium packs + tournament rewards) need no seeding here —
// they live on the account and apply to whichever slot is loaded.
export async function writeFreshTournamentSave(): Promise<void> {
  const s: GameState = { ...createInitialState(), lastSeen: Date.now() };
  await idbSet(SAVE_KEYS.tournament, JSON.parse(JSON.stringify(s)));
}

// Local half of the hard reset: wipe both slots and boot a fresh village.
// The full player-facing reset (account data, server tournament entries,
// cloud flush) is orchestrated in hardReset.ts.
export async function wipeLocalState(): Promise<void> {
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

// Layout reshuffles regenerate the village fillers' ids (their names depend
// on edge geometry), which would silently strip those researched nodes from
// older saves. Every small node grants the same flat bonus, so the fair
// repair is one-for-one: drop ids that no longer exist and grant the same
// number of reachable non-major nodes in tree order. Authored ids (root,
// majors, path smalls, prestige) are stable, so this only ever touches
// fillers — and it's a no-op for saves written against the current tree.
function migrateVanishedTech(unlocked: TechId[], mode: GameMode): TechId[] {
  const byId = techById(mode);
  const known = unlocked.filter((id) => byId[id]);
  let lost = unlocked.length - known.length;
  if (lost === 0) return unlocked;
  const owned = new Set(known);
  const tree = techTree(mode);
  while (lost > 0) {
    const next = tree.find(
      (n) => !n.major && !owned.has(n.id) && n.requires.every((r) => owned.has(r)),
    );
    if (!next) break;
    owned.add(next.id);
    lost--;
  }
  return Array.from(owned);
}
