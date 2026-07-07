// Content-graph validation: run with `npm run validate`.
// Catches the errors that otherwise surface as silently broken items three
// tiers deep: bad IDs, recipes over the 3-input cap, content unreachable from
// the tech tree, and resources nothing produces.
import { RECIPES } from '../src/content/recipes';
import { RESOURCES, RESOURCE_BY_ID } from '../src/content/resources';
import { TECH, TECH_BY_ID } from '../src/content/tech';

const errors: string[] = [];
const warnings: string[] = [];

// ---- Uniqueness ---------------------------------------------------------------
function checkUnique(kind: string, ids: string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`duplicate ${kind} id: ${id}`);
    seen.add(id);
  }
}
checkUnique('resource', RESOURCES.map((r) => r.id));
checkUnique('recipe', RECIPES.map((r) => r.id));
checkUnique('tech', TECH.map((t) => t.id));

// ---- Recipes --------------------------------------------------------------------
for (const recipe of RECIPES) {
  const inputIds = Object.keys(recipe.inputs);
  if (inputIds.length > 3) {
    errors.push(`recipe ${recipe.id} has ${inputIds.length} input types (max 3)`);
  }
  if (inputIds.length === 0) errors.push(`recipe ${recipe.id} has no inputs`);
  for (const [id, n] of Object.entries(recipe.inputs)) {
    if (!RESOURCE_BY_ID[id]) errors.push(`recipe ${recipe.id} input references unknown resource: ${id}`);
    if (n <= 0) errors.push(`recipe ${recipe.id} input ${id} has non-positive amount`);
  }
  for (const [id, n] of Object.entries(recipe.outputs)) {
    if (!RESOURCE_BY_ID[id]) errors.push(`recipe ${recipe.id} output references unknown resource: ${id}`);
    if (n <= 0) errors.push(`recipe ${recipe.id} output ${id} has non-positive amount`);
    if (id in recipe.inputs) errors.push(`recipe ${recipe.id} outputs one of its own inputs: ${id}`);
  }
  if (recipe.craftTimeSeconds <= 0) errors.push(`recipe ${recipe.id} has non-positive craft time`);
}

// ---- Tech ---------------------------------------------------------------------------
const recipeIds = new Set(RECIPES.map((r) => r.id));
for (const node of TECH) {
  for (const req of node.requires) {
    if (!TECH_BY_ID[req]) errors.push(`tech ${node.id} requires unknown node: ${req}`);
  }
  for (const [id] of Object.entries(node.cost)) {
    if (!RESOURCE_BY_ID[id]) errors.push(`tech ${node.id} cost references unknown resource: ${id}`);
  }
  for (const effect of node.effects) {
    if (effect.kind === 'unlockRecipe' && !recipeIds.has(effect.id)) {
      errors.push(`tech ${node.id} unlocks unknown recipe: ${effect.id}`);
    }
    if (effect.kind === 'unlockResource' && !RESOURCE_BY_ID[effect.id]) {
      errors.push(`tech ${node.id} unlocks unknown resource: ${effect.id}`);
    }
  }
}

// Tech prerequisite cycles would make nodes unreachable.
{
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      errors.push(`tech prerequisite cycle involving: ${id}`);
      return;
    }
    state.set(id, 'visiting');
    for (const req of TECH_BY_ID[id]?.requires ?? []) visit(req);
    state.set(id, 'done');
  };
  for (const node of TECH) visit(node.id);
}

// ---- Reachability ------------------------------------------------------------------
const unlockedRecipes = new Set<string>(RECIPES.filter((r) => r.unlockedByDefault).map((r) => r.id));
const unlockedResources = new Set<string>(RESOURCES.filter((r) => r.unlockedByDefault).map((r) => r.id));
for (const node of TECH) {
  for (const effect of node.effects) {
    if (effect.kind === 'unlockRecipe') unlockedRecipes.add(effect.id);
    if (effect.kind === 'unlockResource') unlockedResources.add(effect.id);
  }
}
for (const recipe of RECIPES) {
  if (!unlockedRecipes.has(recipe.id)) {
    errors.push(`recipe ${recipe.id} is never unlocked (no tech node, not default)`);
  }
}

// Every resource must have a source: gatherable (and unlockable) or produced
// by some recipe.
const produced = new Set<string>();
for (const recipe of RECIPES) for (const id of Object.keys(recipe.outputs)) produced.add(id);
for (const res of RESOURCES) {
  if (res.harvestAmount > 0) {
    if (!unlockedResources.has(res.id)) {
      errors.push(`gatherable resource ${res.id} is never unlocked`);
    }
  } else if (!produced.has(res.id)) {
    errors.push(`crafted resource ${res.id} is not produced by any recipe`);
  }
}

// Resources defined but unused anywhere are probably typos or dead content.
const used = new Set<string>();
for (const recipe of RECIPES) {
  for (const id of Object.keys(recipe.inputs)) used.add(id);
  for (const id of Object.keys(recipe.outputs)) used.add(id);
}
for (const node of TECH) for (const id of Object.keys(node.cost)) used.add(id);
for (const res of RESOURCES) {
  if (!used.has(res.id) && res.harvestAmount === 0) {
    warnings.push(`resource ${res.id} is defined but never used by any recipe or tech cost`);
  }
}

// ---- Tree layout -----------------------------------------------------------------
// Nodes render ~108x90px centered on (x, y); generated paths/clusters can
// collide when specs move. Warn on any pair closer than 100px.
for (let i = 0; i < TECH.length; i++) {
  for (let j = i + 1; j < TECH.length; j++) {
    const a = TECH[i];
    const b = TECH[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < 100) {
      warnings.push(`tech nodes overlap: ${a.id} and ${b.id} are ${Math.round(d)}px apart`);
    }
  }
}

// ---- Report --------------------------------------------------------------------------
console.log(`content: ${RESOURCES.length} resources, ${RECIPES.length} recipes, ${TECH.length} tech nodes`);
for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log(`ok: ${warnings.length} warnings, 0 errors`);
