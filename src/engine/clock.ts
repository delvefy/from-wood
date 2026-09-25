import { supabase } from '../lib/supabase';
import type { GameMode } from './mode';

// Trusted time for catch-up. The device clock belongs to the player: moving it
// forward used to pay out up to a day of progress per reload. Instead the
// server's now() anchors a monotonic clock (performance.now() ignores
// wall-clock changes), and an absence is additionally capped at the time since
// the server last took a score submit for that slot.
//
// Until the first successful sync there is no trusted time: live play still
// advances by monotonic time, but no absence is paid out. A slot's lastSeen
// stays behind until then, so the absence is credited once the server answers.

// How much time away a slot is paid for. Anything beyond this is forfeited,
// so leaving for a week is worth the same as leaving for a day.
export const OFFLINE_CAP_SECONDS = 24 * 3600;

// Gaps up to this long are live play (a throttled tick), not an absence, and
// skip the last-submit bound: submits land between ticks, so bounding every
// tick by them would shave a second off live play now and then.
const ABSENCE_MS = 60_000;
const RETRY_MS = 60_000;

let anchor: { server: number; perf: number } | null = null;
// Server time of each slot's last score submit, as of the last sync. Refreshed
// only by syncServerClock (launch / resume), so it always describes the
// absence being settled rather than a submit made after it.
let lastSubmit: Partial<Record<GameMode, number>> = {};
let lastAttemptAt = -Infinity;

export function trustedNow(): number | null {
  return anchor ? anchor.server + (performance.now() - anchor.perf) : null;
}

// Timestamp for a brand-new save. The device clock is only a stand-in before
// the first sync; a wrong one pays nothing (a future lastSeen is rewound, a
// past one is bounded by the caps below).
export function stampNow(): number {
  return trustedNow() ?? Date.now();
}

// Seconds a slot may be credited for simulating from `from` to `to` (trusted
// epoch ms): at most OFFLINE_CAP_SECONDS, and for a real absence no more than
// the server has gone without hearing from that slot.
export function creditableSeconds(mode: GameMode, from: number, to: number): number {
  let ms = Math.max(to - from, 0);
  const since = lastSubmit[mode];
  if (ms > ABSENCE_MS && since !== undefined) ms = Math.min(ms, Math.max(to - since, 0));
  return Math.min(ms / 1000, OFFLINE_CAP_SECONDS);
}

const num = (v: unknown): number | undefined => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

// Fetch server time plus both slots' last submits. Called at launch and on
// every resume; works signed out (the submit times are then unknown).
export async function syncServerClock(): Promise<boolean> {
  lastAttemptAt = performance.now();
  try {
    const { data, error } = await supabase.rpc('sync_clock');
    const d = data as Record<string, unknown> | null;
    const now = num(d?.now_ms);
    if (error || now === undefined) return false;
    anchor = { server: now, perf: performance.now() };
    const next: Partial<Record<GameMode, number>> = {};
    const t = num(d?.tournament_last_submit_ms);
    const v = num(d?.village_last_submit_ms);
    if (t !== undefined) next.tournament = t;
    if (v !== undefined) next.main = v;
    lastSubmit = next;
    return true;
  } catch {
    return false;
  }
}

// Offline launch: keep trying once a minute until the server answers.
export function retryClockSync(): void {
  if (anchor || performance.now() - lastAttemptAt < RETRY_MS) return;
  void syncServerClock();
}

// Other RPCs that return the server's now() (score submits, tournament state)
// refresh an existing anchor. They never create the first one: that must come
// with the last-submit times from syncServerClock.
export function refreshServerClock(serverMs: unknown): void {
  const now = num(serverMs);
  if (anchor && now !== undefined) anchor = { server: now, perf: performance.now() };
}
