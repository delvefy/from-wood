import { PRESTIGE_TREE, techTree } from '../content/tech';
import type { GameMode } from './mode';
import { villageTreeComplete } from './prestige';
import { canAfford } from './tick';
import type { GameState, TechNode } from './types';

// What the research queue can draw from right now: the mode's tree, or the
// prestige Expansion tree once the village triangle is done (ResearchView's
// canvas toggle only changes what is drawn, not what can be queued).
export function activeTree(s: GameState, mode: GameMode): TechNode[] {
  return mode === 'main' && villageTreeComplete(s.unlockedTech) ? PRESTIGE_TREE : techTree(mode);
}

// A node can be started when it isn't owned or queued already, its
// prerequisites are owned or queued, and its cost is affordable right now.
function isReady(s: GameState, n: TechNode, unlocked: Set<string>, queued: Set<string>): boolean {
  if (unlocked.has(n.id) || queued.has(n.id)) return false;
  if (!n.requires.every((r) => unlocked.has(r) || queued.has(r))) return false;
  return canAfford(s, n.cost);
}

export function readyResearchNodes(tree: TechNode[], s: GameState): TechNode[] {
  const unlocked = new Set(s.unlockedTech);
  const queued = new Set(s.researchQueue);
  return tree.filter((n) => isReady(s, n, unlocked, queued));
}

// Badge test for the nav bar: is the single research slot idle with something
// the player could start? Runs every tick over the whole tree, so it stops at
// the first hit instead of collecting them.
export function researchWaiting(s: GameState, mode: GameMode): boolean {
  if (s.researchQueue.length > 0) return false;
  const unlocked = new Set(s.unlockedTech);
  const queued = new Set(s.researchQueue);
  return activeTree(s, mode).some((n) => isReady(s, n, unlocked, queued));
}
