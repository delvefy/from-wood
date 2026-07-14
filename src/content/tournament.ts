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

// PLACEHOLDER rewards until the real reward system lands.
const REWARD_TIERS: { maxRank: number; label: string }[] = [
  { maxRank: 1, label: '🏆 Champion reward (coming soon)' },
  { maxRank: 3, label: '🥇 Podium reward (coming soon)' },
  { maxRank: PROMOTE_COUNT, label: '🎁 Promotion reward (coming soon)' },
  { maxRank: 20, label: '📦 Top-half reward (coming soon)' },
  { maxRank: GROUP_SIZE, label: '🪙 Participation reward (coming soon)' },
];

export function rewardFor(rank: number): string {
  for (const tier of REWARD_TIERS) if (rank <= tier.maxRank) return tier.label;
  return REWARD_TIERS[REWARD_TIERS.length - 1].label;
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
