// Tournament display data. The authoritative rules (schedule, group size,
// promotion counts) live in supabase/migrations/ — keep these in sync.

export const GROUP_SIZE = 40;
export const PROMOTE_COUNT = 20; // top half of a full group moves up a league
export const DEMOTE_COUNT = 20; // bottom half moves down

// League 0..4; profiles start in Sapling.
export const LEAGUES = [
  { name: 'Sapling', icon: '🌱' },
  { name: 'Timber', icon: '🪵' },
  { name: 'Ironbark', icon: '🛡️' },
  { name: 'Runewood', icon: '🔮' },
  { name: 'Worldtree', icon: '🌳' },
] as const;

// Worker rewards, granted once per finished tournament and added permanently
// to the player's base workers — they apply to the village and seed every
// future tournament run. Every place wins: the prize is worth 41 − rank
// gatherers, paid as crafters (worth 10 gatherers each) plus the remainder.
// 1st: 4 crafters, 2nd: 3 crafters + 9 gatherers, … 40th: 1 gatherer.
export interface TournamentReward {
  gatherers: number;
  crafters: number;
}

export function rewardForRank(rank: number): TournamentReward {
  const value = Math.max(0, 41 - rank);
  return { gatherers: value % 10, crafters: Math.floor(value / 10) };
}

export const REWARD_SUMMARY =
  'every place wins, from +4 crafters for 1st down to +1 gatherer for 40th';

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
