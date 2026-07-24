import type { TechNode } from '../../engine/types';
import { RECIPES } from '../recipes';

// The prestige "Expansion" tree — unlocked once the 500-node village tree is
// fully researched (the finished tree collapses into a bonus-summary banner).
// Ten repeating tiers climb straight up from (0, 0): a row of 10 small nodes
// (one per Wonder — there are exactly 10) that together unlock one big
// capstone node, which opens the next row. 100 smalls + 10 capstones = 110.
//
// Rewards are worker packs only — no efficiency, no unlocks — so the tree
// converts endgame Wonder throughput into a permanently growing workforce:
// +1 pack per small node, +10 per capstone (200 packs total).
//
// Cost design (all costs are Wonders, nothing else):
// - Anchor: a tier-1 small node costs what a 100-crafter fleet crafts in 24h
//   of that node's Wonder, at the completed-village craft bonus (+500%).
//   Quantities therefore differ per Wonder (2400s wonders come out cheaper
//   per unit) but every small node in a tier is the same amount of fleet-time.
// - A small node charges 1 Wonder; a capstone charges 2 seeded-random Wonders
//   at the same per-wonder amount, i.e. double the small-node cost.
// - The next tier's smalls match the capstone below them (2x the previous
//   smalls), so amounts double every tier: tier k costs 2^(k-1) anchors.

export const PRESTIGE_PREFIX = 'prestige_';

// One worker pack — the same crew block as the premium workerPack item.
export const WORKER_PACK = { gatherers: 10, crafters: 1 } as const;

export const PRESTIGE_TIERS = 10;
const SMALLS_PER_TIER = 10;
const SMALL_PACKS = 1;
const BIG_PACKS = 10;

// Cost anchor fleet: 100 crafters working a Wonder recipe for 24 hours.
const CREW_CRAFTERS = 100;
const CREW_SECONDS = 24 * 3600;

// Layout: rows of smalls 150px apart with a gentle downward arc at the edges,
// capstone centered 240px above its row, next row another 220px up.
const COL_GAP = 150;
const ROW_GAP = 460;
const BIG_LIFT = 240;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// Small-node names cycle per row (suffixed with the tier numeral); capstones
// read as the settlement growing tier over tier.
const SMALL_NAMES = [
  "Loggers' Camp",
  'Quarry Yard',
  "Foragers' Lodge",
  "Miners' Row",
  'Charcoal Kilns',
  "Weavers' Hall",
  "Smiths' Alley",
  "Masons' Guild",
  "Brewers' Court",
  "Artisans' Wing",
];
const BIG_NAMES = [
  'Hamlet Charter',
  'Village Green',
  'Town Rights',
  'Market Square',
  'City Walls',
  'Guild Quarter',
  'High District',
  'Royal Seat',
  'Imperial Court',
  'Eternal Capital',
];

// Deterministic PRNG (mulberry32): the tree is generated at module load on
// every client, so the "random" wonder assignments must come out identical
// everywhere. Fixed seed, single stream consumed in a fixed order.
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Same 2-significant-digit rounding the base trees use, so amounts read
// cleanly (14,400 -> 14,000) at every tier's doubling.
const niceAmount = (n: number): number => {
  if (n < 100) return Math.round(n);
  const unit = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / unit) * unit;
};

const packDescription = (packs: number) =>
  `+${packs} worker pack${packs === 1 ? '' : 's'} — ` +
  `+${packs * WORKER_PACK.gatherers} gatherers, +${packs * WORKER_PACK.crafters} crafter${
    packs * WORKER_PACK.crafters === 1 ? '' : 's'
  }`;

// Built by content/tech/index.ts with the baked research time and the
// completed-village craft multiplier, so the anchor math has one source of
// truth (a factory also avoids an import cycle with index.ts).
export function buildPrestigeTree(opts: {
  researchTimeSeconds: number;
  craftOutputMultiplier: number;
}): TechNode[] {
  const wonders = RECIPES.filter((r) => r.category === 'wonders');
  if (wonders.length !== SMALLS_PER_TIER) {
    throw new Error(`prestige tree expects ${SMALLS_PER_TIER} wonders, found ${wonders.length}`);
  }

  // Unrounded 24h fleet output of one Wonder; rounded only after the tier's
  // doubling so every tier's amount lands on clean digits.
  const anchor = new Map(
    wonders.map((w) => {
      const [outId, outN] = Object.entries(w.outputs)[0];
      return [
        w.id,
        {
          resource: outId,
          amount: ((CREW_CRAFTERS * CREW_SECONDS) / w.craftTimeSeconds) * outN * opts.craftOutputMultiplier,
        },
      ];
    }),
  );
  const costOf = (wonderId: string, tier: number): [string, number] => {
    const a = anchor.get(wonderId)!;
    return [a.resource, niceAmount(a.amount * 2 ** tier)];
  };

  const rand = mulberry32(0x66726f6d); // 'from'
  const nodes: TechNode[] = [];

  for (let t = 0; t < PRESTIGE_TIERS; t++) {
    const rowY = -t * ROW_GAP;
    const smallWonders = shuffled(wonders, rand);
    const smallIds: string[] = [];

    for (let i = 0; i < SMALLS_PER_TIER; i++) {
      const id = `${PRESTIGE_PREFIX}${t + 1}_${i + 1}`;
      smallIds.push(id);
      const [resource, amount] = costOf(smallWonders[i].id, t);
      const spread = i - (SMALLS_PER_TIER - 1) / 2;
      nodes.push({
        id,
        name: `${SMALL_NAMES[i]} ${ROMAN[t]}`,
        description: packDescription(SMALL_PACKS),
        cost: { [resource]: amount },
        researchTimeSeconds: opts.researchTimeSeconds,
        requires: t === 0 ? [] : [`${PRESTIGE_PREFIX}capstone_${t}`],
        effects: [{ kind: 'workerPack', packs: SMALL_PACKS }],
        branch: 'prestige',
        x: Math.round(spread * COL_GAP),
        y: rowY + Math.round(Math.abs(spread) ** 2 * 6),
      });
    }

    const [a, b] = shuffled(wonders, rand);
    const [resA, amtA] = costOf(a.id, t);
    const [resB, amtB] = costOf(b.id, t);
    nodes.push({
      id: `${PRESTIGE_PREFIX}capstone_${t + 1}`,
      name: BIG_NAMES[t],
      description: packDescription(BIG_PACKS),
      cost: { [resA]: amtA, [resB]: amtB },
      researchTimeSeconds: opts.researchTimeSeconds,
      requires: smallIds,
      effects: [{ kind: 'workerPack', packs: BIG_PACKS }],
      branch: 'prestige',
      x: 0,
      y: rowY - BIG_LIFT,
      major: true,
    });
  }

  return nodes;
}
