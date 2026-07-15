// Tournament display data. The authoritative rules (schedule, group size,
// promotion counts) live in supabase/migrations/ — keep these in sync.

export const GROUP_SIZE = 40;
export const PROMOTE_COUNT = 8; // top N of a full group move up a league
export const DEMOTE_COUNT = 8; // bottom N move down

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
// future tournament run. 1st: 2 crafters, 2nd: 1 crafter, 3rd–12th: 10 down
// to 1 gatherer, below that: nothing.
export interface TournamentReward {
  gatherers: number;
  crafters: number;
}

export function rewardForRank(rank: number): TournamentReward {
  if (rank === 1) return { gatherers: 0, crafters: 2 };
  if (rank === 2) return { gatherers: 0, crafters: 1 };
  if (rank >= 3 && rank <= 12) return { gatherers: 13 - rank, crafters: 0 };
  return { gatherers: 0, crafters: 0 };
}

export const REWARD_SUMMARY =
  '1st: +2 crafters · 2nd: +1 crafter · 3rd–12th: +10 down to +1 gatherers';

export function rewardLabel(rank: number): string {
  const r = rewardForRank(rank);
  if (r.crafters > 0) {
    return `🏆 +${r.crafters} permanent crafter${r.crafters > 1 ? 's' : ''} added to your base workers`;
  }
  if (r.gatherers > 0) {
    return `🎁 +${r.gatherers} permanent gatherer${r.gatherers > 1 ? 's' : ''} added to your base workers`;
  }
  return 'No worker reward this time — finish in the top 12 to win permanent workers.';
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
