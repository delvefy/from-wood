import { get, writable } from 'svelte/store';
import { randomPlayerName } from '../content/tournament';
import { ensureSignedIn, supabase } from '../lib/supabase';
import { gameMode } from './mode';
import { savesSuspended } from './save';
import { game } from './state';
import type { LeaderboardRow } from './tournament';
import { totalValue } from './worth';

// Client side of the all-time village leaderboard (supabase/migrations/0005).
// The board is cached in localStorage with a TTL so opening the view does not
// fire a query every time.

export interface VillageTop {
  top: LeaderboardRow[];
  me: { rank: number; name: string; score: number } | null;
  fetchedAt: number; // epoch ms of the fetch, drives the cache TTL
}

const CACHE_KEY = 'from-wood-village-top-v1';
// PLACEHOLDER cadences — tune once real traffic exists.
const TOP_TTL_MS = 5 * 60_000; // how long a fetched board stays fresh
const SUBMIT_INTERVAL_MS = 5 * 60_000; // village score push throttle

function readCache(): VillageTop | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VillageTop;
    return Array.isArray(parsed?.top) && typeof parsed?.fetchedAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

export const villageTop = writable<VillageTop | null>(readCache());
export const villageTopError = writable<string | null>(null);

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseTop(data: any): VillageTop {
  return {
    top: ((data?.top as any[]) ?? []).map((r) => ({
      rank: Number(r.rank),
      name: String(r.name),
      score: Number(r.score),
      isMe: Boolean(r.is_me),
    })),
    me: data?.me
      ? { rank: Number(data.me.rank), name: String(data.me.name), score: Number(data.me.score) }
      : null,
    fetchedAt: Date.now(),
  };
}

// Refresh the board, unless the cached one is still fresh (TTL above).
export async function fetchVillageTop(force = false): Promise<void> {
  const cached = get(villageTop);
  if (!force && cached && Date.now() - cached.fetchedAt < TOP_TTL_MS) return;
  try {
    await ensureSignedIn();
    const { data, error } = await supabase.rpc('get_village_top');
    if (error) throw new Error(error.message);
    const parsed = parseTop(data);
    villageTop.set(parsed);
    villageTopError.set(null);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // Storage full/unavailable — the in-memory board still works.
    }
  } catch (err) {
    // Offline or transient — keep showing the last known board if we have one.
    if (!get(villageTop)) {
      villageTopError.set(
        err instanceof Error && err.message ? err.message : 'Could not reach the leaderboard',
      );
    }
  }
}

// Same key TournamentView uses for the "compete as" prefill, so the name the
// village board invents is the one the player later sees suggested at join.
const NAME_KEY = 'from-wood-player-name';

function playerName(): string {
  let name = localStorage.getItem(NAME_KEY);
  if (!name) {
    name = randomPlayerName();
    localStorage.setItem(NAME_KEY, name);
  }
  return name;
}

// Push the village run's net worth, throttled. Fire-and-forget like the
// tournament submit: scores are monotonic server-side, dropped ones cost
// nothing.
let lastSubmitAt = 0;

export function maybeSubmitVillageScore(force = false): void {
  // Mid account-swap the signed-in user and the local state disagree; never
  // submit one account's worth under another's row.
  if (savesSuspended()) return;
  if (get(gameMode) !== 'main') return;
  const now = Date.now();
  if (!force && now - lastSubmitAt < SUBMIT_INTERVAL_MS) return;
  lastSubmitAt = now;
  const score = totalValue(get(game));
  void (async () => {
    try {
      await ensureSignedIn();
      await supabase.rpc('submit_village_score', {
        p_score: score,
        p_display_name: playerName(),
      });
    } catch {
      // Offline or transient — the next throttled submit retries.
    }
  })();
}
