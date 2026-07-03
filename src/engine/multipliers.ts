import { TECH_BY_ID } from '../content/tech';
import type { Multipliers, ResourceId, TechId } from './types';

// Multipliers are pure functions of the unlocked tech set; recomputed on
// tech purchase and on load so saves never store stale derived values.
export function computeMultipliers(unlockedTech: TechId[]): Multipliers {
  const m: Multipliers = {
    harvestAll: 1,
    harvestByResource: {},
    craftSpeed: 1,
    workerEfficiency: { harvester: 1, researcher: 1, crafter: 1 },
  };
  for (const techId of unlockedTech) {
    const node = TECH_BY_ID[techId];
    if (!node) continue;
    for (const effect of node.effects) {
      if (effect.kind === 'harvestMultiplier') {
        if (effect.resource === 'all') m.harvestAll *= effect.factor;
        else m.harvestByResource[effect.resource] = (m.harvestByResource[effect.resource] ?? 1) * effect.factor;
      } else if (effect.kind === 'craftSpeedMultiplier') {
        m.craftSpeed *= effect.factor;
      } else if (effect.kind === 'workerEfficiencyMultiplier') {
        m.workerEfficiency[effect.workerType] *= effect.factor;
      }
    }
  }
  return m;
}

export function harvestMultiplier(m: Multipliers, resourceId: ResourceId): number {
  return m.harvestAll * (m.harvestByResource[resourceId] ?? 1);
}
