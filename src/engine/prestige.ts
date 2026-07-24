import { PRESTIGE_TREE, VILLAGE_NODE_TARGET } from '../content/tech';
import { WORKER_PACK } from '../content/tech/prestige';
import type { TechId } from './types';

// Prestige (Expansion tree) rewards are pure functions of the unlocked tech
// set, like multipliers — saves never store worker-pack counts, so they can't
// go stale. Unlike multipliers these are read every tick AND every render
// (totalGatherers/totalCrafters), so the scan memoizes per unlockedTech
// array: completeResearch only ever appends in place (pushUnique) and loads
// build a fresh array, so (array identity, length) is a sound cache key.

const PACKS_BY_ID: Record<string, number> = Object.fromEntries(
  PRESTIGE_TREE.map((n) => [
    n.id,
    n.effects.reduce((sum, e) => (e.kind === 'workerPack' ? sum + e.packs : sum), 0),
  ]),
);

interface Scan {
  len: number;
  packs: number; // worker packs from owned prestige nodes
  baseCount: number; // owned nodes that are NOT prestige nodes
}

const memo = new WeakMap<TechId[], Scan>();

function scan(unlockedTech: TechId[]): Scan {
  const hit = memo.get(unlockedTech);
  if (hit && hit.len === unlockedTech.length) return hit;
  let packs = 0;
  let baseCount = 0;
  for (const id of unlockedTech) {
    const p = PACKS_BY_ID[id];
    if (p === undefined) baseCount++;
    else packs += p;
  }
  const entry = { len: unlockedTech.length, packs, baseCount };
  memo.set(unlockedTech, entry);
  return entry;
}

export function prestigeGatherers(unlockedTech: TechId[]): number {
  return WORKER_PACK.gatherers * scan(unlockedTech).packs;
}

export function prestigeCrafters(unlockedTech: TechId[]): number {
  return WORKER_PACK.crafters * scan(unlockedTech).packs;
}

// The base village tree counts as complete when every non-prestige node is
// owned. Only ever true in the village slot — the tournament tree tops out
// at 98 nodes, so tournament runs can never satisfy it.
export function villageTreeComplete(unlockedTech: TechId[]): boolean {
  return scan(unlockedTech).baseCount >= VILLAGE_NODE_TARGET;
}
