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
// future tournament run. Only the top 20 win: ranks 1-10 earn 1 crafter plus
// 11 − rank gatherers (1st: 1 crafter + 10 gatherers), ranks 11-20 earn
// 21 − rank gatherers (11th: 10 gatherers … 20th: 1 gatherer).
export interface TournamentReward {
  gatherers: number;
  crafters: number;
}

export function rewardForRank(rank: number): TournamentReward {
  if (rank <= 10) return { gatherers: 11 - rank, crafters: 1 };
  if (rank <= 20) return { gatherers: 21 - rank, crafters: 0 };
  return { gatherers: 0, crafters: 0 };
}

export const REWARD_SUMMARY =
  'the top 20 win, from +1 crafter and +10 gatherers for 1st down to +1 gatherer for 20th';

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
