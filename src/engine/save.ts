import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { get } from 'svelte/store';
import { computeMultipliers } from './multipliers';
import { createInitialState, game } from './state';
import { tick } from './tick';
import { resetTickClock } from './actions';
import type { GameState } from './types';

const SAVE_KEY = 'from-wood-save-v2';
const LEGACY_SAVE_KEYS = ['from-wood-save-v1'];
export const OFFLINE_CAP_SECONDS = 8 * 3600;

export interface OfflineReport {
  seconds: number;
  resourceGains: Record<string, number>;
  techCompleted: string[];
}

export async function saveGame(): Promise<void> {
  game.update((s) => ({ ...s, lastSeen: Date.now() }));
  // Plain deep clone so IndexedDB never sees store-internal references.
  await idbSet(SAVE_KEY, JSON.parse(JSON.stringify(get(game))));
}

// Loads the save (if any), fast-forwards all timed work for the time away
// (capped), and returns a summary of what was gained.
export async function loadGame(): Promise<OfflineReport | null> {
  for (const key of LEGACY_SAVE_KEYS) void idbDel(key);
  const saved = (await idbGet(SAVE_KEY)) as Partial<GameState> | undefined;
  if (!saved) return null;

  const base = createInitialState();
  // Merge over the initial state so saves survive new content/fields, and
  // union unlock lists so newly-default content is never lost.
  const s: GameState = {
    ...base,
    ...saved,
    resources: { ...base.resources, ...(saved.resources ?? {}) },
    gatherAssignment: { ...(saved.gatherAssignment ?? {}) },
    gatherProgress: { ...(saved.gatherProgress ?? {}) },
    craftJobs: { ...(saved.craftJobs ?? {}) },
    craftRepeat: { ...(saved.craftRepeat ?? {}) },
    unlockedResources: union(base.unlockedResources, saved.unlockedResources),
    unlockedRecipes: union(base.unlockedRecipes, saved.unlockedRecipes),
    unlockedTech: union([], saved.unlockedTech),
    researchQueue: [...(saved.researchQueue ?? [])],
    multipliers: computeMultipliers(saved.unlockedTech ?? []),
  };

  const now = Date.now();
  const elapsed = Math.min(
    Math.max(Math.floor((now - (saved.lastSeen ?? now)) / 1000), 0),
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
  return report;
}

export async function hardReset(): Promise<void> {
  await idbDel(SAVE_KEY);
  game.set(createInitialState());
  resetTickClock();
  await saveGame();
}

function union<T>(base: T[], saved: T[] | undefined): T[] {
  return Array.from(new Set([...base, ...(saved ?? [])]));
}
