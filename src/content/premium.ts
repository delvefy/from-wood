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
    priceUsd: 50,
    unique: true,
  },
  {
    id: 'craftManager',
    name: 'Crafting Manager',
    icon: '👩‍💼',
    description: 'Halves the craft time of every recipe.',
    priceUsd: 50,
    unique: true,
  },
  {
    id: 'marketManager',
    name: 'Market Manager',
    icon: '🤵',
    description: 'Doubles the sell price of everything.',
    priceUsd: 50,
    unique: true,
  },
  {
    id: 'gathererPack',
    name: 'Gatherer Pack',
    icon: '📦',
    description:
      '+10 permanent base gatherers — they work the village and every tournament run, and never raise hire prices.',
    priceUsd: 5,
    unique: false,
  },
  {
    id: 'crafterPack',
    name: 'Crafter Pack',
    icon: '🎁',
    description:
      '+1 permanent base crafter — they work the village and every tournament run, and never raise hire prices.',
    priceUsd: 5,
    unique: false,
  },
];

export const PREMIUM_BY_ID: Record<string, PremiumItem> = Object.fromEntries(
  PREMIUM.map((p) => [p.id, p]),
);
