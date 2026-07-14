import type { PremiumItem } from '../engine/types';

// Premium shop catalog. Prices are real-money USD for display only — during
// development every purchase is granted for free after a confirm dialog.
// Managers are one-time buys; packs can be bought repeatedly.
export const PREMIUM: PremiumItem[] = [
  {
    id: 'gatherManager',
    name: 'Gathering Manager',
    icon: '🧑‍💼',
    description: 'Halves the gather cycle time of every resource.',
    priceUsd: 4.99,
    unique: true,
  },
  {
    id: 'craftManager',
    name: 'Crafting Manager',
    icon: '👩‍💼',
    description: 'Halves the craft time of every recipe.',
    priceUsd: 4.99,
    unique: true,
  },
  {
    id: 'marketManager',
    name: 'Market Manager',
    icon: '🤵',
    description: 'Doubles the sell price of everything.',
    priceUsd: 6.99,
    unique: true,
  },
  {
    id: 'gathererPack',
    name: 'Gatherer Pack',
    icon: '📦',
    description: '+10 gatherers. Does not raise normal hire prices.',
    priceUsd: 5,
    unique: false,
  },
  {
    id: 'crafterPack',
    name: 'Crafter Pack',
    icon: '🎁',
    description: '+1 crafter. Does not raise normal hire prices.',
    priceUsd: 5,
    unique: false,
  },
];

export const PREMIUM_BY_ID: Record<string, PremiumItem> = Object.fromEntries(
  PREMIUM.map((p) => [p.id, p]),
);
