<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  import { RECIPES } from '../content/recipes';
  import { RESOURCE_BY_ID } from '../content/resources';
  import { startCraft } from '../engine/actions';
  import { game } from '../engine/state';
  import { canAfford } from '../engine/tick';
  import { formatNumber } from '../util/format';

  const unlocked = $derived(RECIPES.filter((r) => $game.unlockedRecipes.includes(r.id)));
</script>

{#if unlocked.length === 0}
  <p class="muted empty">No recipes yet — research <strong>Woodworking</strong> to unlock crafting.</p>
{:else}
  <div class="list">
    {#each unlocked as recipe (recipe.id)}
      {@const job = $game.craftJobs[recipe.id]}
      {@const running = job !== undefined}
      {@const duration = recipe.craftTimeSeconds}
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
        {#if running}
          <div class="progress">
            <ProgressBar value={job} max={duration} />
            <span class="left muted">{Math.ceil(duration - job)}s</span>
          </div>
        {:else}
          <button
            class="craft-btn"
            disabled={!canAfford($game, recipe.inputs)}
            onclick={() => startCraft(recipe.id)}
          >
            Craft
          </button>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .empty {
    text-align: center;
    padding: 24px 12px;
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
    padding: 3px 7px;
    background: var(--panel-2);
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
  }

  .arrow {
    color: var(--muted);
  }

  .craft-btn {
    background: var(--accent-dark);
    border-color: var(--accent-dark);
    font-weight: 600;
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
</style>
