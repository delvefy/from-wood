// Client-side mirror of the server schedule (supabase/migrations/0012):
// anchored on Monday 00:00 UTC, slot A opens Mon 12:00 and slot B Fri 00:00,
// each running 3 days. Keep in sync with tournament_next_start().
//
// The schedule is fully deterministic, which is what lets the app remind the
// player about a start with no push backend: the device schedules local
// notifications for the next few starts itself (src/lib/notifications.ts).

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Offsets from Monday 00:00 UTC.
const SLOT_OFFSETS_MS = [12 * 3600 * 1000, 4 * DAY_MS];

export const TOURNAMENT_LENGTH_MS = 3 * DAY_MS;

// Monday 00:00 UTC of the week containing `at`.
export function weekStartUtc(at: number): number {
  const d = new Date(at);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return midnight - daysSinceMonday * DAY_MS;
}

// The next `count` slot starts strictly after `from`, ascending.
export function tournamentStartsAfter(from: number, count: number): number[] {
  const starts: number[] = [];
  let week = weekStartUtc(from);
  while (starts.length < count) {
    for (const offset of SLOT_OFFSETS_MS) {
      const at = week + offset;
      if (at > from && starts.length < count) starts.push(at);
    }
    week += WEEK_MS;
  }
  return starts;
}
