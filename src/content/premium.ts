import type { PremiumItem } from '../engine/types';

// Premium shop catalog. priceUsd is display-only (the store charges its own
// localized price); productId must match the in-app product ids created in
// Play Console and mirrored in RevenueCat. Managers are one-time buys
// (non-consumable products); packs are repeatable (consumable products).
export const PREMIUM: PremiumItem[] = [
  {
    id: 'gatherManager',
    name: 'Gathering Manager',
    icon: '🧑‍💼',
    description: 'Doubles the gather rate of every resource.',
    priceUsd: 9.99,
    unique: true,
    productId: 'gather_manager',
  },
  {
    id: 'craftManager',
    name: 'Crafting Manager',
    icon: '👩‍💼',
    description: 'Doubles the craft rate of every recipe.',
    priceUsd: 9.99,
    unique: true,
    productId: 'craft_manager',
  },
  {
    id: 'marketManager',
    name: 'Market Manager',
    icon: '🤵',
    description: 'Doubles the sell price of everything.',
    priceUsd: 9.99,
    unique: true,
    productId: 'market_manager',
  },
  {
    id: 'workerPack',
    name: 'Worker Pack',
    icon: '📦',
    description:
      '+10 permanent base gatherers and +1 permanent base crafter — they work the village and every tournament run, and never raise hire prices.',
    priceUsd: 3.99,
    unique: false,
    productId: 'worker_pack',
  },
];

export const PREMIUM_BY_ID: Record<string, PremiumItem> = Object.fromEntries(
  PREMIUM.map((p) => [p.id, p]),
);

// Store product id → premium id, for mapping purchases-ledger rows back onto
// the account.
export const PREMIUM_BY_PRODUCT: Record<string, PremiumItem> = Object.fromEntries(
  PREMIUM.map((p) => [p.productId, p]),
);
