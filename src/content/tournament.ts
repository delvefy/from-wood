// Tournament display data. The authoritative rules (schedule, group size,
// rewards) live in supabase/migrations/ — keep these in sync.

export const GROUP_SIZE = 40;

// Schedule copy (UTC): one tournament a week, Monday 12:00 → Monday 00:00.
export const SCHEDULE_SUMMARY =
  'Tournaments open every Monday at 12:00 UTC and run until midnight Sunday (00:00 UTC Monday).';

// Worker rewards, granted once per finished tournament and added permanently
// to the player's base workers — they apply to the village and seed every
// future tournament run. Everyone in a full 40-player group wins something:
// points = 41 − rank, each 10 points is a crafter and the remainder gatherers
// (1st: 4 crafters, 2nd: 3 crafters + 9 gatherers … 40th: 1 gatherer).
// Mirrors reward_workers() in the backend.
export interface TournamentReward {
  gatherers: number;
  crafters: number;
}

export function rewardForRank(rank: number): TournamentReward {
  const points = Math.max(0, 41 - rank);
  return { gatherers: points % 10, crafters: Math.floor(points / 10) };
}

export const REWARD_SUMMARY =
  'the top 40 win, from +4 crafters for 1st, +3 crafters and +9 gatherers for 2nd, down to +1 gatherer for 40th';

export function rewardLabel(rank: number): string {
  const r = rewardForRank(rank);
  const parts: string[] = [];
  if (r.crafters > 0) parts.push(`+${r.crafters} crafter${r.crafters > 1 ? 's' : ''}`);
  if (r.gatherers > 0) parts.push(`+${r.gatherers} gatherer${r.gatherers > 1 ? 's' : ''}`);
  if (parts.length === 0) return 'No worker reward this time.';
  return `🏆 ${parts.join(' and ')} added permanently to your base workers`;
}

const NAME_ADJECTIVES = [
  'Brave', 'Swift', 'Mossy', 'Arcane', 'Iron', 'Elder', 'Wild', 'Lucky',
  'Sturdy', 'Gilded', 'Quiet', 'Amber',
];
const NAME_NOUNS = [
  'Otter', 'Sawyer', 'Druid', 'Tinker', 'Warden', 'Beaver', 'Smith', 'Sprite',
  'Logger', 'Golem', 'Fox', 'Willow',
];

export function randomPlayerName(): string {
  const a = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const n = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return `${a}${n}${Math.floor(Math.random() * 90) + 10}`;
}
