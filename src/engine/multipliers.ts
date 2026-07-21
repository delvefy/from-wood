import { techById } from '../content/tech';
import type { GameMode } from './mode';
import type { Multipliers, ResourceId, TechId } from './types';

// Multipliers are pure functions of the unlocked tech set; recomputed on
// research completion and on load so saves never store stale derived values.
// Efficiency percents stack ADDITIVELY within each bucket (many tiny flat
// nodes), then convert to a multiplier once: 1 + total/100. Speed is never
// affected — cycle/job durations are fixed by content.
// Mode-aware: the same node id grants +1% in the village tree but +5% in the
// tournament tree (NODE_BONUS_PERCENT), so effects must be read from the
// active mode's tree.
export function computeMultipliers(unlockedTech: TechId[], mode: GameMode): Multipliers {
  const effectsById = techById(mode);
  let gatherAllPct = 0;
  const gatherPctByResource: Record<ResourceId, number> = {};
  let craftPct = 0;
  for (const techId of unlockedTech) {
    const node = effectsById[techId];
    if (!node) continue;
    for (const effect of node.effects) {
      if (effect.kind === 'gatherEfficiency') {
        if (effect.resource === 'all') gatherAllPct += effect.percent;
        else gatherPctByResource[effect.resource] = (gatherPctByResource[effect.resource] ?? 0) + effect.percent;
      } else if (effect.kind === 'craftEfficiency') {
        craftPct += effect.percent;
      }
    }
  }
  return {
    gatherAll: 1 + gatherAllPct / 100,
    gatherByResource: Object.fromEntries(
      Object.entries(gatherPctByResource).map(([id, pct]) => [id, 1 + pct / 100]),
    ),
    craftOutput: 1 + craftPct / 100,
  };
}

export function harvestMultiplier(m: Multipliers, resourceId: ResourceId): number {
  return m.gatherAll * (m.gatherByResource[resourceId] ?? 1);
}
