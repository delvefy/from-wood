// Content-graph validation: run with `npm run validate`.
// Catches the errors that otherwise surface as silently broken items three
// tiers deep: bad IDs, recipes over the 3-input cap, content unreachable from
// the tech tree, and resources nothing produces. Both mode trees are checked:
// the 500-node village and the 98-node tournament.
import { RECIPES } from '../src/content/recipes';
import { RESOURCES, RESOURCE_BY_ID } from '../src/content/resources';
import { techTree } from '../src/content/tech';

const errors: string[] = [];
const warnings: string[] = [];

const TREES = [
  { label: 'village', expected: 500, nodes: techTree('main') },
  { label: 'tournament', expected: 98, nodes: techTree('tournament') },
];

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

// ---- Recipes --------------------------------------------------------------------
for (const recipe of RECIPES) {
  const inputIds = Object.keys(recipe.inputs);
  // Design rule: exactly 2 input types everywhere; only materials (simple
  // refinements like planks) may run on a single input.
  if (recipe.category === 'materials') {
    if (inputIds.length < 1 || inputIds.length > 2) {
      errors.push(`recipe ${recipe.id} has ${inputIds.length} input types (materials need 1-2)`);
    }
  } else if (inputIds.length !== 2) {
    errors.push(`recipe ${recipe.id} has ${inputIds.length} input types (exactly 2 required)`);
  }
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

// ---- Tech (per mode tree) -------------------------------------------------------
const recipeIds = new Set(RECIPES.map((r) => r.id));
for (const { label, expected, nodes: TECH } of TREES) {
  const tag = (id: string) => `tech[${label}] ${id}`;
  const TECH_BY_ID: Record<string, (typeof TECH)[number]> = Object.fromEntries(
    TECH.map((t) => [t.id, t]),
  );

  if (TECH.length !== expected) {
    errors.push(`tech[${label}] tree has ${TECH.length} nodes, expected exactly ${expected}`);
  }
  checkUnique(`tech[${label}]`, TECH.map((t) => t.id));

  for (const node of TECH) {
    for (const req of node.requires) {
      if (!TECH_BY_ID[req]) errors.push(`${tag(node.id)} requires unknown node: ${req}`);
    }
    for (const [id] of Object.entries(node.cost)) {
      if (!RESOURCE_BY_ID[id]) errors.push(`${tag(node.id)} cost references unknown resource: ${id}`);
    }
    // Same rule as recipes: every node charges exactly 2 resources.
    if (Object.keys(node.cost).length !== 2) {
      errors.push(`${tag(node.id)} cost has ${Object.keys(node.cost).length} resources (exactly 2 required)`);
    }
    if (node.researchTimeSeconds <= 0) {
      errors.push(`${tag(node.id)} has non-positive research time`);
    }
    for (const effect of node.effects) {
      if (effect.kind === 'unlockRecipe' && !recipeIds.has(effect.id)) {
        errors.push(`${tag(node.id)} unlocks unknown recipe: ${effect.id}`);
      }
      if (effect.kind === 'unlockResource' && !RESOURCE_BY_ID[effect.id]) {
        errors.push(`${tag(node.id)} unlocks unknown resource: ${effect.id}`);
      }
    }
  }

  // Tech prerequisite cycles would make nodes unreachable.
  {
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (id: string): void => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'visiting') {
        errors.push(`tech[${label}] prerequisite cycle involving: ${id}`);
        return;
      }
      state.set(id, 'visiting');
      for (const req of TECH_BY_ID[id]?.requires ?? []) visit(req);
      state.set(id, 'done');
    };
    for (const node of TECH) visit(node.id);
  }

  // ---- Cost feasibility ------------------------------------------------------
  // Simulate actual play: a node becomes researchable once all its
  // prerequisites are researched AND every resource in its cost is obtainable
  // — gatherable, or craftable through recipes unlocked so far (inputs
  // recursively obtainable). Catches deadlocks like a node whose cost item
  // only unlocks behind that node.
  {
    const researched = new Set<string>();
    const recipesOn = new Set(RECIPES.filter((r) => r.unlockedByDefault).map((r) => r.id));
    const obtainable = new Set(
      RESOURCES.filter((r) => r.unlockedByDefault && r.harvestAmount > 0).map((r) => r.id),
    );

    // Fixpoint over obtainable resources given the currently unlocked recipes.
    const propagate = () => {
      let changed = true;
      while (changed) {
        changed = false;
        for (const rec of RECIPES) {
          if (!recipesOn.has(rec.id)) continue;
          if (!Object.keys(rec.inputs).every((id) => obtainable.has(id))) continue;
          for (const id of Object.keys(rec.outputs)) {
            if (!obtainable.has(id)) {
              obtainable.add(id);
              changed = true;
            }
          }
        }
      }
    };

    let progressed = true;
    while (progressed) {
      progressed = false;
      propagate();
      for (const node of TECH) {
        if (researched.has(node.id)) continue;
        if (!node.requires.every((req) => researched.has(req))) continue;
        if (!Object.keys(node.cost).every((id) => obtainable.has(id))) continue;
        researched.add(node.id);
        for (const effect of node.effects) {
          if (effect.kind === 'unlockRecipe') recipesOn.add(effect.id);
          if (effect.kind === 'unlockResource') obtainable.add(effect.id);
        }
        progressed = true;
      }
    }

    for (const node of TECH) {
      if (researched.has(node.id)) continue;
      const blockedReqs = node.requires.filter((req) => !researched.has(req));
      if (blockedReqs.length > 0) {
        errors.push(`${tag(node.id)} is unreachable: blocked prerequisites ${blockedReqs.join(', ')}`);
      } else {
        const missing = Object.keys(node.cost).filter((id) => !obtainable.has(id));
        errors.push(`${tag(node.id)} is unreachable: cost needs unobtainable ${missing.join(', ')}`);
      }
    }
  }

  // ---- Tree layout -----------------------------------------------------------
  // Nodes render ~108x90px centered on (x, y); generated paths/clusters can
  // collide when specs move. Warn on any pair closer than 100px.
  for (let i = 0; i < TECH.length; i++) {
    for (let j = i + 1; j < TECH.length; j++) {
      const a = TECH[i];
      const b = TECH[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 100) {
        warnings.push(`tech[${label}] nodes overlap: ${a.id} and ${b.id} are ${Math.round(d)}px apart`);
      }
    }
  }
}

// ---- Reachability -----------------------------------------------------------------
// Unlock effects live on majors, which are identical in both trees, so the
// village tree stands in for both here.
const VILLAGE = TREES[0].nodes;
const unlockedRecipes = new Set<string>(RECIPES.filter((r) => r.unlockedByDefault).map((r) => r.id));
const unlockedResources = new Set<string>(RESOURCES.filter((r) => r.unlockedByDefault).map((r) => r.id));
for (const node of VILLAGE) {
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
for (const node of VILLAGE) for (const id of Object.keys(node.cost)) used.add(id);
for (const res of RESOURCES) {
  if (!used.has(res.id) && res.harvestAmount === 0) {
    warnings.push(`resource ${res.id} is defined but never used by any recipe or tech cost`);
  }
}

// ---- Report --------------------------------------------------------------------------
console.log(
  `content: ${RESOURCES.length} resources, ${RECIPES.length} recipes, ` +
    TREES.map((t) => `${t.nodes.length} ${t.label} tech nodes`).join(', '),
);
for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log(`ok: ${warnings.length} warnings, 0 errors`);
