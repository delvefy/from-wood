import { get, writable } from 'svelte/store';
import { rewardForRank } from '../content/tournament';
import { ensureSignedIn, supabase } from '../lib/supabase';
import { grantTournamentReward } from './account';
import { resetTickClock } from './actions';
import { gameMode, type GameMode } from './mode';
import { loadGame, saveGame, savesSuspended, writeFreshTournamentSave } from './save';
import { game } from './state';
import { getTournamentMeta, setTournamentMeta } from './tournamentMeta';
import { totalValue } from './worth';

// Client side of the weekly tournament: talks to the Supabase RPCs defined in
// supabase/migrations/, and owns switching between the two save slots.

export interface TournamentInfo {
  id: string;
  startsAt: number;
  endsAt: number;
}

export interface EntryInfo {
  tournamentId: string;
  groupId: string;
  league: number;
  joinedAt: number;
  score: number;
  finalRank: number | null;
  groupSize: number;
  startsAt: number;
  endsAt: number;
  status: 'running' | 'finished';
}

export interface TournamentState {
  serverNow: number;
  league: number;
  displayName: string;
  nextStartsAt: number;
  tournament: TournamentInfo | null; // the running tournament, if any
  entry: EntryInfo | null; // the player's most recent entry, if any
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  isMe: boolean;
}

export const tournamentState = writable<TournamentState | null>(null);
export const leaderboard = writable<LeaderboardRow[]>([]);
export const tournamentError = writable<string | null>(null);

const ts = (v: unknown): number => new Date(String(v)).getTime();

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseState(data: any): TournamentState {
  return {
    serverNow: ts(data.now),
    league: Number(data.league ?? 0),
    displayName: String(data.display_name ?? ''),
    nextStartsAt: ts(data.next_starts_at),
    tournament: data.tournament
      ? {
          id: String(data.tournament.id),
          startsAt: ts(data.tournament.starts_at),
          endsAt: ts(data.tournament.ends_at),
        }
      : null,
    entry: data.entry
      ? {
          tournamentId: String(data.entry.tournament_id),
          groupId: String(data.entry.group_id),
          league: Number(data.entry.league),
          joinedAt: ts(data.entry.joined_at),
          score: Number(data.entry.score),
          finalRank: data.entry.final_rank == null ? null : Number(data.entry.final_rank),
          groupSize: Number(data.entry.group_size ?? 0),
          startsAt: ts(data.entry.starts_at),
          endsAt: ts(data.entry.ends_at),
          status: data.entry.status === 'finished' ? 'finished' : 'running',
        }
      : null,
  };
}

// Mirror the entry into localStorage so the save layer can cap tournament
// offline catch-up at the tournament's end without the network.
function syncMeta(st: TournamentState): void {
  const e = st.entry;
  if (!e) return;
  setTournamentMeta({
    tournamentId: e.tournamentId,
    groupId: e.groupId,
    league: e.league,
    joinedAt: e.joinedAt,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    displayName: st.displayName,
  });
}

// Once a run is finalized, add its worker reward to the account's base
// workers. grantTournamentReward is idempotent per tournament, so calling this
// on every state refresh is safe; ranks below the reward table grant nothing
// but still mark the tournament claimed.
function claimRewardIfDue(st: TournamentState): void {
  const e = st.entry;
  if (!e || e.status !== 'finished' || e.finalRank == null) return;
  const reward = rewardForRank(e.finalRank);
  grantTournamentReward(e.tournamentId, reward.gatherers, reward.crafters);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const msg = (err as { message?: string })?.message;
  return msg || 'Could not reach the tournament server';
}

// Parse a get_tournament_state payload and apply it everywhere it matters.
function applyState(data: unknown): TournamentState {
  const st = parseState(data);
  tournamentState.set(st);
  tournamentError.set(null);
  syncMeta(st);
  claimRewardIfDue(st);
  return st;
}

export async function refreshTournamentState(): Promise<TournamentState | null> {
  try {
    await ensureSignedIn();
    const { data, error } = await supabase.rpc('get_tournament_state');
    if (error) throw new Error(error.message);
    return applyState(data);
  } catch (err) {
    tournamentError.set(errorMessage(err));
    return null;
  }
}

export async function fetchLeaderboard(): Promise<void> {
  try {
    await ensureSignedIn();
    const { data, error } = await supabase.rpc('get_leaderboard');
    if (error) throw new Error(error.message);
    leaderboard.set(
      ((data as any[]) ?? []).map((r) => ({
        rank: Number(r.rank),
        name: String(r.name),
        score: Number(r.score),
        isMe: Boolean(r.is_me),
      })),
    );
  } catch {
    // Offline or transient — keep the last known board.
  }
}

// Join the running tournament and enter the (brand-new) tournament run.
// Throws with a user-readable message on failure.
export async function joinTournament(displayName: string): Promise<void> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc('join_tournament', {
    p_display_name: displayName,
  });
  if (error) throw new Error(error.message);
  applyState(data);

  await writeFreshTournamentSave();
  if (get(gameMode) === 'tournament') {
    // Already on the tournament slot (a previous, ended run): reload it from
    // the fresh save instead of switching, so autosave can't resurrect it.
    await loadGame();
    resetTickClock();
  } else {
    await switchMode('tournament');
  }
  void fetchLeaderboard();
}

// Swap the live save slot: saves the active one, flips mode, loads the other
// (applying its offline catch-up).
export async function switchMode(target: GameMode): Promise<void> {
  if (get(gameMode) === target) return;
  if (get(gameMode) === 'tournament') maybeSubmitScore(true);
  await saveGame();
  gameMode.set(target);
  await loadGame();
  resetTickClock();
}

// Push the current run's net worth to the server, at most once a minute.
// Fire-and-forget: submissions are monotonic server-side, so a dropped one
// costs nothing — the next submit carries the higher score.
let lastSubmitAt = 0;

export function maybeSubmitScore(force = false): void {
  // Mid account-swap the signed-in user and the local state disagree; never
  // submit one account's worth under another's entry.
  if (savesSuspended()) return;
  if (get(gameMode) !== 'tournament') return;
  const meta = getTournamentMeta();
  if (!meta) return;
  const now = Date.now();
  if (now < meta.startsAt || now > meta.endsAt) return;
  if (!force && now - lastSubmitAt < 60_000) return;
  lastSubmitAt = now;
  const score = totalValue(get(game));
  void (async () => {
    try {
      await ensureSignedIn();
      await supabase.rpc('submit_score', { p_score: score });
    } catch {
      // Offline or transient — the next throttled submit retries.
    }
  })();
}
