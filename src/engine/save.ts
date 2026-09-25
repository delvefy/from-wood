import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { get } from 'svelte/store';
import { techById, techTree } from '../content/tech';
import { migrateLegacyPremium } from './account';
import { computeMultipliers } from './multipliers';
import { gameMode, type GameMode } from './mode';
import { createInitialState, game } from './state';
import { tick } from './tick';
import { resetTickClock } from './actions';
import { creditableSeconds, stampNow, trustedNow } from './clock';
import { clearTournamentMeta, getTournamentMeta } from './tournamentMeta';
import type { GameState, TechId } from './types';
import { totalValue } from './worth';

// One save slot per mode: the village and the current tournament run are
// fully independent games sharing the same engine.
const SAVE_KEYS: Record<GameMode, string> = {
  main: 'from-wood-save-v2',
  tournament: 'from-wood-tournament-save-v1',
};
const LEGACY_SAVE_KEYS = ['from-wood-save-v1'];
export { OFFLINE_CAP_SECONDS } from './clock';

const OTHER_MODE: Record<GameMode, GameMode> = { main: 'tournament', tournament: 'main' };

export async function saveGame(): Promise<void> {
  if (suspended) return;
  // No lastSeen stamp: the tick loop keeps it at trusted time (actions.ts).
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

// Loads `mode`'s save (if any), makes it the live slot, and silently
// fast-forwards all timed work for the time away (capped). Returns what the
// absence was worth, for the welcome-back report; null when there was no save
// to load.
//
// Everything after the IDB read is synchronous, so gameMode and game flip
// together: the tick/autosave/score-submit intervals can never observe the new
// mode paired with the old slot's state (that race once submitted the
// village's net worth as a tournament score).
export async function loadGame(mode: GameMode = get(gameMode)): Promise<SlotCatchUp | null> {
  for (const key of LEGACY_SAVE_KEYS) void idbDel(key);
  const saved = (await idbGet(SAVE_KEYS[mode])) as Partial<GameState> | undefined;
  gameMode.set(mode);
  if (!saved) {
    // An empty slot starts fresh rather than leaking the other slot's state
    // (normally unreachable for tournaments: joining writes a fresh save first).
    game.set(createInitialState());
    return null;
  }

  const s = hydrate(saved, mode);
  const result = fastForward(s, mode);
  game.set(s);
  return result;
}

// What a slot earned while the player was away.
export interface SlotCatchUp {
  mode: GameMode;
  seconds: number; // time actually credited (capped at OFFLINE_CAP_SECONDS)
  gain: number; // net worth added by that catch-up
}

// Fast-forward the slot that is NOT being played and write it back, so the
// welcome-back report can price both games at once. Without this the idle
// slot's catch-up would not happen until the player switched to it.
// Skipped mid account-swap, when the slots on disk are not this player's.
export async function catchUpIdleSlot(): Promise<SlotCatchUp | null> {
  if (suspended) return null;
  const mode = OTHER_MODE[get(gameMode)];
  const saved = (await idbGet(SAVE_KEYS[mode])) as Partial<GameState> | undefined;
  if (!saved) return null;
  const s = hydrate(saved, mode);
  const result = fastForward(s, mode);
  await idbSet(SAVE_KEYS[mode], JSON.parse(JSON.stringify(s)));
  return result;
}

// Merge a raw slot payload into a full state for `mode`, without advancing it.
function hydrate(saved: Partial<GameState>, mode: GameMode): GameState {
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

  return s;
}

// Advance `s` from its lastSeen to trusted time (capped, engine/clock.ts) and
// stamp it as current. Prices the state either side of the jump so the caller
// can tell the player what the absence was worth. Without a server sync yet
// nothing is credited and lastSeen stays put, so the absence is paid once the
// server answers (by runTick for the live slot, next load for the idle one).
function fastForward(s: GameState, mode: GameMode): SlotCatchUp {
  const now = trustedNow();
  if (now === null) return { mode, seconds: 0, gain: 0 };
  // Tournament runs freeze at the finish line: catch-up never runs past it.
  let horizon = now;
  if (mode === 'tournament') {
    const meta = getTournamentMeta();
    if (meta) horizon = Math.min(now, meta.endsAt);
  }
  const elapsed = Math.floor(creditableSeconds(mode, s.lastSeen ?? horizon, horizon));

  const before = elapsed > 0 ? totalValue(s, mode) : 0;
  if (elapsed > 0) tick(s, elapsed, mode);
  const gain = elapsed > 0 ? totalValue(s, mode) - before : 0;

  s.lastSeen = now;
  return { mode, seconds: elapsed, gain };
}

// Called on tournament join: overwrite the tournament slot with a brand-new
// run. Base workers (premium packs + tournament rewards) need no seeding here —
// they live on the account and apply to whichever slot is loaded.
export async function writeFreshTournamentSave(): Promise<void> {
  const s: GameState = { ...createInitialState(), lastSeen: stampNow() };
  await idbSet(SAVE_KEYS.tournament, JSON.parse(JSON.stringify(s)));
}

// Local half of account deletion: wipe both slots and boot a fresh village.
// The rest of the wipe (server-side deletion, cloud identity, account data)
// is orchestrated in deleteAccount.ts.
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
