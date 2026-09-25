// Client-side mirror of the server schedule (supabase/migrations/0014): one
// tournament a week, opening Monday 12:00 UTC and running until 00:00 the
// following Monday — 6.5 days, with the Monday 00:00-12:00 break between runs.
// Keep in sync with tournament_next_start().
//
// (0012's second weekly slot on Friday 00:00 is gone. Leaving it here meant
// every other reminder announced a tournament that never opened.)
//
// The schedule is fully deterministic, which is what lets the app remind the
// player about a start with no push backend: the device schedules local
// notifications for the next few starts itself (src/lib/notifications.ts).

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Offset from Monday 00:00 UTC of the week's single start.
const START_OFFSET_MS = 12 * 3600 * 1000;

export const TOURNAMENT_LENGTH_MS = WEEK_MS - START_OFFSET_MS; // 6.5 days

// Monday 00:00 UTC of the week containing `at`.
export function weekStartUtc(at: number): number {
  const d = new Date(at);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return midnight - daysSinceMonday * DAY_MS;
}

// The next `count` starts strictly after `from`, ascending — one per week.
export function tournamentStartsAfter(from: number, count: number): number[] {
  const starts: number[] = [];
  let at = weekStartUtc(from) + START_OFFSET_MS;
  while (starts.length < count) {
    if (at > from) starts.push(at);
    at += WEEK_MS;
  }
  return starts;
}
