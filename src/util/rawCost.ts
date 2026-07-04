import { RECIPES } from '../content/recipes';
import { RESOURCE_BY_ID } from '../content/resources';
import type { Recipe, ResourceId } from '../engine/types';

// Fully-expanded raw-material cost of one craft of a recipe: every crafted
// input is recursively replaced by its own inputs (divided by its output
// batch size), so deep chains show what they really cost in gathered raws.
// Static per recipe (ignores efficiency multipliers), so it's computed once.

// First recipe producing each item; alternates (if ever added) are ignored.
const PRODUCER: Record<ResourceId, Recipe> = {};
for (const recipe of RECIPES) {
  for (const id of Object.keys(recipe.outputs)) {
    if (!(id in PRODUCER)) PRODUCER[id] = recipe;
  }
}

const cache: Record<string, Record<ResourceId, number>> = {};

function add(into: Record<ResourceId, number>, id: ResourceId, n: number): void {
  into[id] = (into[id] ?? 0) + n;
}

function expand(recipe: Recipe, visiting: Set<string>): Record<ResourceId, number> {
  if (cache[recipe.id]) return cache[recipe.id];
  const total: Record<ResourceId, number> = {};
  visiting.add(recipe.id);
  for (const [id, n] of Object.entries(recipe.inputs)) {
    const producer = PRODUCER[id];
    // treat as raw when gatherable, unproduced, or part of a recipe cycle
    if (!producer || (RESOURCE_BY_ID[id]?.harvestAmount ?? 0) > 0 || visiting.has(producer.id)) {
      add(total, id, n);
      continue;
    }
    const perUnit = expand(producer, visiting);
    const batch = producer.outputs[id] ?? 1;
    for (const [rawId, rawN] of Object.entries(perUnit)) {
      add(total, rawId, (rawN * n) / batch);
    }
  }
  visiting.delete(recipe.id);
  cache[recipe.id] = total;
  return total;
}

export function rawCost(recipe: Recipe): Record<ResourceId, number> {
  return expand(recipe, new Set());
}
