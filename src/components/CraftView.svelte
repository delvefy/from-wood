<script lang="ts">
  import Icon from './Icon.svelte';
  import LockedList from './LockedList.svelte';
  import SearchBox from './SearchBox.svelte';
  import WorkerBudget from './WorkerBudget.svelte';
  import WorkerRow from './WorkerRow.svelte';
  import { CATEGORY_ORDER, RECIPES } from '../content/recipes';
  import { RESOURCE_BY_ID } from '../content/resources';
  import { techTree } from '../content/tech';
  import { CRAFTER } from '../content/workers';
  import {
    assignAllCrafters,
    assignCrafter,
    idleCrafters,
    unassignAllCrafters,
  } from '../engine/actions';
  import { account } from '../engine/account';
  import { craftTimeFactor, totalCrafters } from '../engine/premium';
  import { computeFlowRates, netRate, secondsToDry } from '../engine/rates';
  import { game } from '../engine/state';
  import type { Recipe } from '../engine/types';
  import { collapsed, isOpen, toggleCollapsed } from '../util/collapse';
  import { formatDuration, formatNumber } from '../util/format';
  import { openMaterial, searchFilters } from '../util/nav';
  import { rawCost } from '../util/rawCost';
  import { settings } from '../util/settings';

  // The tech node whose research unlocks each recipe (for the locked hint).
  // Unlock effects live on majors, which are identical in both mode trees, so
  // the village tree serves as the lookup for either mode.
  const unlockedBy = new Map(
    techTree('main').flatMap((t) =>
      t.effects.filter((e) => e.kind === 'unlockRecipe').map((e) => [e.id, t] as const),
    ),
  );

  // Raw cost is static per recipe, so expand it once up front. Only recipes
  // with crafted inputs show it (raws-only recipes ARE their raw cost).
  const rawEntriesByRecipe = new Map<string, [string, number][]>(
    RECIPES.map((recipe) => {
      const hasCraftedInput = Object.keys(recipe.inputs).some(
        (id) => (RESOURCE_BY_ID[id]?.harvestAmount ?? 0) === 0,
      );
      return [recipe.id, hasCraftedInput ? Object.entries(rawCost(recipe)) : []];
    }),
  );

  const nameOf = (id: string) => RESOURCE_BY_ID[id]?.name ?? id;
  // Every recipe outputs exactly one item type; its icon stands in for the recipe.
  const outputId = (recipe: Recipe) => Object.keys(recipe.outputs)[0];

  const query = $derived(($searchFilters.craft ?? '').trim().toLowerCase());

  // A recipe matches on its own name or on any output OR input material's
  // name — filtering for an item surfaces both the recipes that produce it
  // and the recipes that consume it.
  function matchesQuery(recipe: Recipe, q: string): boolean {
    if (!q) return true;
    if (recipe.name.toLowerCase().includes(q)) return true;
    const nameHas = (id: string) => nameOf(id).toLowerCase().includes(q);
    return Object.keys(recipe.outputs).some(nameHas) || Object.keys(recipe.inputs).some(nameHas);
  }

  // Rebuilt on every game tick, so it's a single pass over the catalog with
  // Set membership.
  const unlockedRecipeSet = $derived(new Set($game.unlockedRecipes));
  const visible = $derived(RECIPES.filter((r) => matchesQuery(r, query)));
  const groups = $derived.by(() => {
    const byCategory = new Map(
      CATEGORY_ORDER.map((cat) => [cat.id, { ...cat, recipes: [] as Recipe[] }]),
    );
    for (const r of visible) {
      if (unlockedRecipeSet.has(r.id)) byCategory.get(r.category)?.recipes.push(r);
    }
    return [...byCategory.values()].filter((g) => g.recipes.length > 0);
  });
  // Pinned on top: every staffed recipe regardless of category — the
  // handful actually running is what players check most.
  const active = $derived(
    visible.filter((r) => unlockedRecipeSet.has(r.id) && ($game.craftAssignment[r.id] ?? 0) > 0),
  );
  const locked = $derived(
    visible
      .filter((r) => !unlockedRecipeSet.has(r.id))
      .map((r) => ({ id: outputId(r), name: r.name, tech: unlockedBy.get(r.id) })),
  );
  const idle = $derived(idleCrafters($game));

  // Global per-material flow (gatherers + all staffed recipes), driving the
  // subline warnings and the expanded panel's per-input balance.
  const rates = $derived(computeFlowRates($game, $account));

  // One row expanded at a time, keyed by section so the pinned Active copy
  // and the category copy of the same recipe open independently.
  let expanded = $state<string | null>(null);
  const toggle = (key: string) => (expanded = expanded === key ? null : key);

  // Groups start collapsed (search shows everything); the open set persists.
  const groupOpen = (id: string) => !!query || isOpen($collapsed, 'craft-open', id);

  const duration = (recipe: Recipe) => recipe.craftTimeSeconds * craftTimeFactor($account);

  // Collapsed subline. Unstaffed: the plain recipe ratio in words. Staffed:
  // output rate, downgraded to the worst input problem — red when a craft
  // can't be paid for right now, amber when an input is draining dry.
  function summarize(
    recipe: Recipe,
    assigned: number,
  ): { text: string; tone: 'muted' | 'ok' | 'warn' | 'danger' } {
    const perCraft = (recipe.outputs[outputId(recipe)] ?? 0) * $game.multipliers.craftOutput;
    if (assigned <= 0) {
      const ins = Object.entries(recipe.inputs)
        .map(([id, n]) => `${n} ${nameOf(id)}`)
        .join(' + ');
      return { text: `${ins} → ${formatNumber(perCraft)} · ${formatNumber(duration(recipe))}s`, tone: 'muted' };
    }
    const out = `+${formatNumber((assigned * perCraft) / duration(recipe))}/s`;
    let worst: { text: string; tone: 'warn' | 'danger' } | null = null;
    for (const [id, n] of Object.entries(recipe.inputs)) {
      if (($game.resources[id] ?? 0) < n) {
        worst = { text: `${out} · out of ${nameOf(id)}`, tone: 'danger' };
        break;
      }
      const dry = secondsToDry($game, rates, id);
      if (Number.isFinite(dry) && !worst) {
        worst = { text: `${out} · ${nameOf(id)} dry in ~${formatDuration(dry)}`, tone: 'warn' };
      }
    }
    return worst ?? { text: out, tone: 'ok' };
  }
</script>

<SearchBox view="craft" placeholder="Search recipes & materials…" />

<WorkerBudget
  icon={CRAFTER.icon}
  idle={idle}
  total={totalCrafters($game, $account)}
  noun="crafters"
  onclear={unassignAllCrafters}
  onfill={assignAllCrafters}
/>

{#snippet row(recipe: Recipe, section: string)}
  {@const assigned = $game.craftAssignment[recipe.id] ?? 0}
  {@const key = `${section}:${recipe.id}`}
  {@const s = summarize(recipe, assigned)}
  {@const out = outputId(recipe)}
  <WorkerRow
    id={out}
    name={recipe.name}
    stock={$game.resources[out] ?? 0}
    {assigned}
    {idle}
    workerIcon={CRAFTER.icon}
    summary={s.text}
    tone={s.tone}
    expanded={expanded === key}
    ontoggle={() => toggle(key)}
    onassign={(d) => assignCrafter(recipe.id, d)}
  >
    {#snippet details()}
      {@const dur = duration(recipe)}
      {@const raw = rawEntriesByRecipe.get(recipe.id) ?? []}
      <div class="io">
        {#each Object.entries(recipe.inputs) as [id, n] (id)}
          {@const have = $game.resources[id] ?? 0}
          {@const net = netRate(rates, id)}
          {@const dry = secondsToDry($game, rates, id)}
          {@const short = have < n}
          {#snippet chipBody()}
            <span class="chip-head"><Icon {id} /> {nameOf(id)}</span>
            <span class="chip-sub">
              {#if assigned > 0}
                −{formatNumber((assigned * n) / dur)}/s · have {formatNumber(have)}
              {:else}
                need {n} · have {formatNumber(have)}
              {/if}
            </span>
            {#if assigned > 0}
              <span class="chip-sub">
                net {net < 0 ? '−' : '+'}{formatNumber(Math.abs(net))}/s{#if Number.isFinite(dry)} · dry ~{formatDuration(dry)}{/if}
              </span>
            {/if}
          {/snippet}
          {#if $settings.materialLinks}
            <button class="chip link" class:short class:drain={!short && assigned > 0 && net < 0} onclick={() => openMaterial(id)}>
              {@render chipBody()}
            </button>
          {:else}
            <div class="chip" class:short class:drain={!short && assigned > 0 && net < 0}>
              {@render chipBody()}
            </div>
          {/if}
        {/each}
        <span class="arrow muted">→</span>
        {#each Object.entries(recipe.outputs) as [id, n] (id)}
          {@const perCraft = n * $game.multipliers.craftOutput}
          <div class="chip out">
            <span class="chip-head"><Icon {id} /> {nameOf(id)}</span>
            <span class="chip-sub">
              {#if assigned > 0}
                +{formatNumber((assigned * perCraft) / dur)}/s
              {:else}
                {formatNumber(perCraft)} per craft
              {/if}
            </span>
          </div>
        {/each}
      </div>
      <p class="facts muted">
        ⏱ {formatNumber(dur)}s per craft
        {#if raw.length}
          · raw ≈ {raw.map(([id, n]) => `${formatNumber(Math.ceil(n))} ${nameOf(id)}`).join(', ')}
        {/if}
      </p>
    {/snippet}
  </WorkerRow>
{/snippet}

{#if active.length > 0}
  <h3 class="section">Active <span class="muted">{active.length}</span></h3>
  <div class="list">
    {#each active as recipe (recipe.id)}
      {@render row(recipe, 'active')}
    {/each}
  </div>
{/if}

{#if groups.length === 0 && query}
  <p class="muted empty">No recipes match “{query}”.</p>
{/if}

{#each groups as group (group.id)}
  <button class="group-head" aria-expanded={groupOpen(group.id)} onclick={() => toggleCollapsed('craft-open', group.id)}>
    <span>{group.icon} {group.label}</span>
    <span class="muted">{group.recipes.length} {groupOpen(group.id) ? '▾' : '▸'}</span>
  </button>
  {#if groupOpen(group.id)}
    <div class="list">
      {#each group.recipes as recipe (recipe.id)}
        {@render row(recipe, group.id)}
      {/each}
    </div>
  {/if}
{/each}

<LockedList items={locked} />

<style>
  .section {
    display: flex;
    justify-content: space-between;
    margin: 2px 4px 6px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }

  .empty {
    text-align: center;
    padding: 24px 12px 8px;
  }

  .group-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-top: 8px;
    padding: 8px 12px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--magic) 12%, var(--panel-2)),
      color-mix(in srgb, var(--tech) 12%, var(--panel-2))
    );
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-weight: 600;
    text-align: left;
  }

  .group-head + .list {
    margin-top: 4px;
  }

  .list {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .list > :global(.row + .row) {
    border-top: 1px solid var(--border);
  }

  .io {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .chip {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    min-height: 0;
    padding: 5px 10px;
    background: var(--panel-2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font: inherit;
    font-size: 0.8rem;
    color: inherit;
    text-align: left;
    font-variant-numeric: tabular-nums;
  }

  .chip-head {
    font-weight: 600;
  }

  .chip.link .chip-head {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }

  .chip-sub {
    font-size: 0.72rem;
    color: var(--muted);
  }

  /* Flow tints: amber while the material drains economy-wide; red when a
     craft can't be paid for right now. */
  .chip.drain,
  .chip.drain .chip-sub {
    color: var(--gold);
  }

  .chip.short,
  .chip.short .chip-sub {
    color: var(--danger);
  }

  .chip.out {
    border-color: var(--accent-dark);
    box-shadow: 0 0 6px color-mix(in srgb, var(--accent-dark) 35%, transparent);
  }

  .arrow {
    font-size: 1.1rem;
  }

  .facts {
    margin: 0;
    font-size: 0.75rem;
    text-align: center;
  }
</style>
