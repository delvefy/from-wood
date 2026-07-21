import { TECH_EFFECTS_BY_ID } from '../content/tech';
import type { Multipliers, ResourceId, TechId } from './types';

// Multipliers are pure functions of the unlocked tech set; recomputed on
// research completion and on load so saves never store stale derived values.
// Efficiency percents stack ADDITIVELY within each bucket (many tiny +1%
// nodes), then convert to a multiplier once: 1 + total/100. Speed is never
// affected — cycle/job durations are fixed by content.
// Mode-blind on purpose: effects are identical wherever an id exists in both
// trees, and each save can only hold ids from its own mode's tree.
export function computeMultipliers(unlockedTech: TechId[]): Multipliers {
  let gatherAllPct = 0;
  const gatherPctByResource: Record<ResourceId, number> = {};
  let craftPct = 0;
  for (const techId of unlockedTech) {
    const node = TECH_EFFECTS_BY_ID[techId];
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
