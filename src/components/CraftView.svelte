<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  import SearchBox from './SearchBox.svelte';
  import { CATEGORY_ORDER, RECIPES } from '../content/recipes';
  import { RESOURCE_BY_ID } from '../content/resources';
  import { TECH } from '../content/tech';
  import { CRAFTER } from '../content/workers';
  import {
    assignAllCrafters,
    assignCrafter,
    idleCrafters,
    unassignAllCrafters,
  } from '../engine/actions';
  import { craftTimeFactor, totalCrafters } from '../engine/premium';
  import { game } from '../engine/state';
  import { collapsed, isCollapsed, toggleCollapsed } from '../util/collapse';
  import { formatNumber } from '../util/format';
  import { holdRepeat } from '../util/holdRepeat';
  import { openMaterial, searchFilters } from '../util/nav';
  import { rawCost } from '../util/rawCost';
  import { settings } from '../util/settings';
  import type { Recipe } from '../engine/types';

  // The tech node whose research unlocks each recipe (for the locked hint).
  const unlockedBy = new Map(
    TECH.flatMap((t) =>
      t.effects.filter((e) => e.kind === 'unlockRecipe').map((e) => [e.id, t] as const),
    ),
  );

  const branchLabel = {
    magic: '✦ Magic',
    tech: '⚙ Tech',
    magitech: '⚡ Magitech',
  } as const;

  const query = $derived(($searchFilters.craft ?? '').trim().toLowerCase());

  // A recipe matches on its own name or on any output material's name, so
  // material links land on the recipes that produce that material.
  function matchesQuery(recipe: Recipe, q: string): boolean {
    if (!q) return true;
    if (recipe.name.toLowerCase().includes(q)) return true;
    return Object.keys(recipe.outputs).some((id) =>
      (RESOURCE_BY_ID[id]?.name ?? '').toLowerCase().includes(q),
    );
  }

  const groups = $derived(
    CATEGORY_ORDER.map((cat) => {
      const recipes = RECIPES.filter((r) => r.category === cat.id && matchesQuery(r, query));
      return {
        ...cat,
        unlocked: recipes.filter((r) => $game.unlockedRecipes.includes(r.id)),
        locked: recipes.filter((r) => !$game.unlockedRecipes.includes(r.id)),
      };
    }).filter((g) => g.unlocked.length > 0 || g.locked.length > 0),
  );
  const anyUnlocked = $derived($game.unlockedRecipes.length > 0);
  const idle = $derived(idleCrafters($game));
  let manage = $state(false);

  // Raw line is static per recipe; shown only for recipes with crafted inputs.
  function rawLine(recipeId: string): string {
    const recipe = RECIPES.find((r) => r.id === recipeId)!;
    const raws = rawCost(recipe);
    const hasCraftedInput = Object.keys(recipe.inputs).some(
      (id) => (RESOURCE_BY_ID[id]?.harvestAmount ?? 0) === 0,
    );
    if (!hasCraftedInput) return '';
    return Object.entries(raws)
      .map(
        ([id, n]) =>
          `${RESOURCE_BY_ID[id]?.icon}${formatNumber(Math.ceil(n))} ${RESOURCE_BY_ID[id]?.name}`,
      )
      .join(' · ');
  }
</script>

{#if !anyUnlocked}
  <p class="muted empty">No recipes yet — research <strong>Woodworking</strong> to unlock crafting.</p>
{:else}
  <SearchBox view="craft" placeholder="Search recipes & materials…" />
  <button class="slots" onclick={() => (manage = !manage)}>
    {CRAFTER.icon} Crafters: <strong>{idle}</strong> idle / {totalCrafters($game)} total
    <span class="muted">— tap to manage {manage ? '▾' : '▸'}</span>
  </button>
  {#if manage}
    <div class="manage">
      <button onclick={unassignAllCrafters}>Unassign all</button>
      <button class="fill" disabled={idle <= 0} onclick={assignAllCrafters}>Assign all evenly</button>
    </div>
  {/if}
{/if}
<div class="groups">
  {#each groups as group (group.id)}
    <button class="group-head" onclick={() => toggleCollapsed('craft', group.id)}>
      <span>{group.icon} {group.label}</span>
      <span class="muted">
        {group.unlocked.length}/{group.unlocked.length + group.locked.length}
        {isCollapsed($collapsed, 'craft', group.id) ? '▸' : '▾'}
      </span>
    </button>
    {#if query || !isCollapsed($collapsed, 'craft', group.id)}
      <div class="list">
        {#each group.unlocked as recipe (recipe.id)}
            {@const assigned = $game.craftAssignment[recipe.id] ?? 0}
            {@const duration = recipe.craftTimeSeconds * craftTimeFactor($game)}
            {@const raw = rawLine(recipe.id)}
            <div class="card craft">
              <button
                class="chev remove"
                aria-label="Unassign a crafter from {recipe.name}"
                disabled={assigned <= 0}
                use:holdRepeat={() => assignCrafter(recipe.id, -1)}
              >
                <svg viewBox="0 0 24 48" aria-hidden="true"><path d="M19 7 L7 24 L19 41" /></svg>
              </button>
              <div class="mid">
                <div class="title">
                  <span class="icon">{recipe.icon}</span>
                  <span class="name">{recipe.name}</span>
                </div>
                <div class="io">
                  {#each Object.entries(recipe.inputs) as [id, n] (id)}
                    {#if $settings.materialLinks}
                      <button
                        class="item link"
                        class:short={($game.resources[id] ?? 0) < n}
                        title="Go to {RESOURCE_BY_ID[id]?.name}"
                        onclick={() => openMaterial(id)}
                      >
                        {RESOURCE_BY_ID[id]?.icon}{n}
                        {RESOURCE_BY_ID[id]?.name}
                        <small>({formatNumber($game.resources[id] ?? 0)})</small>
                      </button>
                    {:else}
                      <span class="item" class:short={($game.resources[id] ?? 0) < n}>
                        {RESOURCE_BY_ID[id]?.icon}{n}
                        {RESOURCE_BY_ID[id]?.name}
                        <small>({formatNumber($game.resources[id] ?? 0)})</small>
                      </span>
                    {/if}
                  {/each}
                  <span class="arrow">→</span>
                  {#each Object.entries(recipe.outputs) as [id, n] (id)}
                    <span class="item out">
                      {RESOURCE_BY_ID[id]?.icon}{formatNumber(n * $game.multipliers.craftOutput)}
                      {RESOURCE_BY_ID[id]?.name}
                    </span>
                  {/each}
                </div>
                {#if raw}
                  <div class="raw muted">raw ≈ {raw}</div>
                {/if}
                <div class="crew">
                  {CRAFTER.icon} <strong>{assigned}</strong>
                  {#if assigned > 0}
                    <span class="muted">
                      ·
                      {#each Object.entries(recipe.outputs) as [id, n] (id)}
                        +{RESOURCE_BY_ID[id]?.icon}{formatNumber(assigned * n * $game.multipliers.craftOutput)}
                      {/each}
                      / {formatNumber(duration)}s
                    </span>
                  {:else}
                    <span class="muted">· hold ❯ to assign · ⏱ {formatNumber(duration)}s</span>
                  {/if}
                </div>
                {#if assigned > 0}
                  <div class="progress">
                    <ProgressBar value={$game.craftProgress[recipe.id] ?? 0} max={duration} />
                    <span class="left muted">{Math.ceil(duration - ($game.craftProgress[recipe.id] ?? 0))}s</span>
                  </div>
                {/if}
              </div>
              <button
                class="chev add"
                aria-label="Assign a crafter to {recipe.name}"
                disabled={idle <= 0}
                use:holdRepeat={() => assignCrafter(recipe.id, 1)}
              >
                <svg viewBox="0 0 24 48" aria-hidden="true"><path d="M5 7 L17 24 L5 41" /></svg>
              </button>
            </div>
        {/each}
        {#each group.locked as recipe (recipe.id)}
          {@const tech = unlockedBy.get(recipe.id)}
          <div class="card dim">
            <div class="head">
              <span class="rname"><span class="grey">{recipe.icon}</span> {recipe.name}</span>
              <span class="time muted">🔒</span>
            </div>
            <span class="hint muted">
              {#if tech}
                Research <strong>{tech.name}</strong>
                <span class="branch {tech.branch}">{branchLabel[tech.branch]}</span>
              {:else}
                Unlock not available yet
              {/if}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  {/each}
</div>

<style>
  .empty {
    text-align: center;
    padding: 24px 12px;
  }

  .slots {
    display: block;
    width: 100%;
    text-align: left;
    padding: 10px 12px;
    margin-bottom: 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    font-size: 0.9rem;
  }

  .slots .muted {
    font-size: 0.75rem;
  }

  .manage {
    display: flex;
    gap: 8px;
    margin: -2px 0 10px;
  }

  .manage button {
    flex: 1;
    font-size: 0.85rem;
  }

  .manage .fill {
    background: var(--grad-primary);
    border: none;
    color: #fff;
    font-weight: 600;
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .group-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
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

  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  /* Craft cards: chevron rails on the edges, info centered between them. */
  .card.craft {
    display: grid;
    grid-template-columns: 52px 1fr 52px;
    align-items: stretch;
    gap: 0;
    padding: 0;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }

  .chev {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 0;
    background: color-mix(in srgb, var(--panel-2) 55%, transparent);
    color: var(--accent);
    touch-action: none;
    -webkit-touch-callout: none;
  }

  .chev.remove {
    border-right: 1px solid var(--border);
    color: var(--danger);
  }

  .chev.add {
    border-left: 1px solid var(--border);
  }

  .chev svg {
    width: 20px;
    height: 40px;
    transition: transform 0.08s ease;
  }

  .chev path {
    fill: none;
    stroke: currentColor;
    stroke-width: 5;
    stroke-linejoin: miter;
    stroke-linecap: butt;
  }

  .chev:not(:disabled):active {
    transform: none; /* the global button squish moves the whole rail; scale the arrow instead */
    background: color-mix(in srgb, currentColor 16%, transparent);
  }

  .chev:not(:disabled):active svg {
    transform: scale(0.8);
  }

  .chev:disabled {
    opacity: 1;
    color: color-mix(in srgb, var(--muted) 40%, transparent);
    background: transparent;
  }

  .mid {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 0;
    padding: 9px 8px;
    text-align: center;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .icon {
    font-size: 1.2rem;
    line-height: 1;
  }

  .name {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .io {
    justify-content: center;
  }

  .crew {
    font-size: 0.8rem;
  }

  .crew strong {
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .rname {
    font-weight: 600;
  }

  .time {
    font-size: 0.75rem;
  }

  .io {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
  }

  .item {
    padding: 3px 9px;
    background: var(--panel-2);
    border-radius: 999px;
    white-space: nowrap;
  }

  /* Input chips become tappable material links when the setting is on. */
  button.item {
    min-height: 0;
    border: none;
    font: inherit;
    color: inherit;
  }

  .item.link {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }

  .item small {
    color: var(--muted);
  }

  .item.short {
    color: var(--danger);
  }

  .item.out {
    border: 1px solid var(--accent-dark);
    box-shadow: 0 0 6px color-mix(in srgb, var(--accent-dark) 35%, transparent);
  }

  .arrow {
    color: var(--muted);
  }

  .raw {
    font-size: 0.75rem;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-top: 2px;
  }

  .progress :global(.track) {
    flex: 1;
  }

  .left {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    min-width: 3.5ch;
    text-align: right;
  }

  .card.dim {
    opacity: 0.55;
    gap: 4px;
    padding: 8px 12px;
  }

  .grey {
    filter: grayscale(1);
  }

  .hint {
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .branch {
    padding: 1px 8px;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 0.68rem;
  }

  .branch.magic {
    color: var(--magic);
    border-color: var(--magic);
  }

  .branch.tech {
    color: var(--tech);
    border-color: var(--tech);
  }

  .branch.magitech {
    color: var(--magitech);
    border-color: var(--magitech);
  }
</style>
