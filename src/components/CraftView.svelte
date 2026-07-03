<script lang="ts">
  import { RECIPES, RECIPE_BY_ID } from '../content/recipes';
  import { RESOURCE_BY_ID } from '../content/resources';
  import { craft, setCrafterRecipe } from '../engine/actions';
  import { game } from '../engine/state';
  import { canAfford } from '../engine/tick';
  import { formatNumber } from '../util/format';

  const unlocked = $derived(RECIPES.filter((r) => $game.unlockedRecipes.includes(r.id)));
  const crafterUnlocked = $derived($game.unlockedWorkerTypes.includes('crafter'));
  const activeRecipe = $derived($game.crafterRecipe ? RECIPE_BY_ID[$game.crafterRecipe] : null);
</script>

{#if crafterUnlocked}
  <div class="crafter-status">
    {#if $game.workers.crafter === 0}
      <span class="muted">🛠️ No crafters hired yet — hire them in Market.</span>
    {:else if activeRecipe}
      <span>🛠️ {$game.workers.crafter} crafter{$game.workers.crafter > 1 ? 's' : ''} → {activeRecipe.name}</span>
      <progress max={activeRecipe.craftTimeSeconds} value={Math.min($game.crafterProgress, activeRecipe.craftTimeSeconds)}></progress>
    {:else}
      <span class="muted">🛠️ Crafters idle — pick an Auto recipe below.</span>
    {/if}
  </div>
{/if}

<div class="list">
  {#each unlocked as recipe (recipe.id)}
    <div class="card">
      <div class="head">
        <span class="rname">{recipe.icon} {recipe.name}</span>
        {#if crafterUnlocked}
          <label class="auto">
            <input
              type="checkbox"
              checked={$game.crafterRecipe === recipe.id}
              onchange={() => setCrafterRecipe($game.crafterRecipe === recipe.id ? null : recipe.id)}
            />
            Auto
          </label>
        {/if}
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
          <span class="item out">{RESOURCE_BY_ID[id]?.icon}{n}</span>
        {/each}
        {#if recipe.researchOutput}
          <span class="item out">🔬{recipe.researchOutput}</span>
        {/if}
      </div>
      <button class="craft-btn" disabled={!canAfford($game, recipe.inputs)} onclick={() => craft(recipe.id)}>
        Craft
      </button>
    </div>
  {/each}
</div>

<style>
  .crafter-status {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    margin-bottom: 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.85rem;
  }

  progress {
    width: 100%;
    height: 6px;
    accent-color: var(--accent);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .card {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'head head'
      'io btn';
    gap: 8px;
    align-items: center;
    padding: 12px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .head {
    grid-area: head;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .rname {
    font-weight: 600;
  }

  .auto {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--muted);
    padding: 4px;
  }

  .auto input {
    width: 20px;
    height: 20px;
    accent-color: var(--accent);
  }

  .io {
    grid-area: io;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
  }

  .item {
    padding: 3px 7px;
    background: var(--panel-2);
    border-radius: 8px;
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
    grid-area: btn;
    padding: 0 18px;
    background: var(--accent-dark);
    border-color: var(--accent-dark);
    font-weight: 600;
  }
</style>
