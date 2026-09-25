import { writable } from 'svelte/store';
import { catchUpIdleSlot, type SlotCatchUp } from './save';

// The welcome-back report: what the village and the tournament run earned
// while the player was away. Both slots are priced, not just the one that
// happens to be live — coming back to "your village made $4M, your run made
// $900k" is the point of leaving two games running.
//
// Only absences of at least an hour are reported, so switching tabs, taking a
// call or reloading the page never pops a modal.

export const AWAY_MIN_SECONDS = 3600;

export interface AwayReport {
  seconds: number; // longest absence credited across the slots
  slots: SlotCatchUp[]; // live slot first
}

export const awayReport = writable<AwayReport | null>(null);

// Catch the idle slot up as well, then publish the report. `live` is what the
// active slot already earned — loadGame credits it on a cold start, runTick
// when the app comes back from the background without having been killed.
export async function settleAway(live: SlotCatchUp | null): Promise<void> {
  // A slot that cannot be read is a slot with nothing to report; never let it
  // take the launch down with it.
  const idle = await catchUpIdleSlot().catch(() => null);
  const slots = [live, idle].filter(
    (s): s is SlotCatchUp => s !== null && s.seconds >= AWAY_MIN_SECONDS,
  );
  // A long absence that earned nothing (no workers assigned, run already over)
  // is not worth interrupting for.
  if (slots.every((s) => s.gain <= 0)) return;
  awayReport.set({
    seconds: Math.max(...slots.map((s) => s.seconds)),
    slots,
  });
}

// Tick-loop entry point: settle only when the jump was a real absence rather
// than ordinary background-tab throttling.
export function settleIfAway(live: SlotCatchUp | null): void {
  if (!live || live.seconds < AWAY_MIN_SECONDS) return;
  void settleAway(live);
}

export function dismissAwayReport(): void {
  awayReport.set(null);
}
