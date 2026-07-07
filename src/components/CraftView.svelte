<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
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
  import { game } from '../engine/state';
  import { collapsed, isCollapsed, toggleCollapsed } from '../util/collapse';
  import { formatNumber } from '../util/format';
  import { rawCost } from '../util/rawCost';

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

  const groups = $derived(
    CATEGORY_ORDER.map((cat) => {
      const recipes = RECIPES.filter((r) => r.category === cat.id);
      return {
        ...cat,
        unlocked: recipes.filter((r) => $game.unlockedRecipes.includes(r.id)),
        locked: recipes.filter((r) => !$game.unlockedRecipes.includes(r.id)),
      };
    }).filter((g) => g.unlocked.length > 0 || g.locked.length > 0),
  );
  const anyUnlocked = $derived(groups.some((g) => g.unlocked.length > 0));
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
      .map(([id, n]) => `${RESOURCE_BY_ID[id]?.icon}${formatNumber(Math.ceil(n))}`)
      .join(' ');
  }
</script>

{#if !anyUnlocked}
  <p class="muted empty">No recipes yet — research <strong>Woodworking</strong> to unlock crafting.</p>
{:else}
  <button class="slots" onclick={() => (manage = !manage)}>
    {CRAFTER.icon} Crafters: <strong>{idle}</strong> idle / {$game.crafters} total
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
    {#if !isCollapsed($collapsed, 'craft', group.id)}
      <div class="list">
        {#each group.unlocked as recipe (recipe.id)}
            {@const assigned = $game.craftAssignment[recipe.id] ?? 0}
            {@const duration = recipe.craftTimeSeconds}
            {@const raw = rawLine(recipe.id)}
            <div class="card">
              <div class="head">
                <span class="rname">{recipe.icon} {recipe.name}</span>
                <span class="time muted">⏱ {formatNumber(duration)}s</span>
              </div>
              <div class="io">
                {#each Object.entries(recipe.inputs) as [id, n] (id)}
                  <span class="item" class:short={($game.resources[id] ?? 0) < n}>
                    {RESOURCE_BY_ID[id]?.icon}{n}
                    <small>({formatNumber($game.resources[id] ?? 0)})</small>
                  </span>
                {/each}
                <span class="arrow">→</span>
                {#each Object.entries(recipe.outputs) as [id, n] (id)}
                  <span class="item out">
                    {RESOURCE_BY_ID[id]?.icon}{formatNumber(n * $game.multipliers.craftOutput)}
                  </span>
                {/each}
              </div>
              {#if raw}
                <div class="raw muted">raw ≈ {raw}</div>
              {/if}
              <div class="controls">
                <button disabled={assigned <= 0} onclick={() => assignCrafter(recipe.id, -1)}>−</button>
                <span class="count">{CRAFTER.icon} {assigned}</span>
                <button disabled={idle <= 0} onclick={() => assignCrafter(recipe.id, 1)}>+</button>
                <span class="rate muted">
                  {#if assigned > 0}
                    {#each Object.entries(recipe.outputs) as [id, n] (id)}
                      +{RESOURCE_BY_ID[id]?.icon}{formatNumber(assigned * n * $game.multipliers.craftOutput)}
                    {/each}
                    / {formatNumber(duration)}s
                  {:else}
                    assign a crafter
                  {/if}
                </span>
              </div>
              {#if assigned > 0}
                <div class="progress">
                  <ProgressBar value={$game.craftProgress[recipe.id] ?? 0} max={duration} />
                  <span class="left muted">{Math.ceil(duration - ($game.craftProgress[recipe.id] ?? 0))}s</span>
                </div>
              {/if}
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

  .controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .controls button {
    min-width: 44px;
    padding: 0 8px;
  }

  .count {
    min-width: 4ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .rate {
    margin-left: auto;
    font-size: 0.75rem;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
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
