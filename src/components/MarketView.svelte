<script lang="ts">
  import { CATEGORY_ORDER, RECIPES } from '../content/recipes';
  import { RESOURCES } from '../content/resources';
  import { CRAFTER, WORKER } from '../content/workers';
  import {
    hireCrafter,
    hireWorker,
    idleCrafters,
    idleWorkers,
    nextHireCost,
    sellResource,
  } from '../engine/actions';
  import { hardReset } from '../engine/save';
  import { game } from '../engine/state';
  import { collapsed, isCollapsed, toggleCollapsed } from '../util/collapse';
  import { formatCredits, formatNumber } from '../util/format';

  // Crafted items sell under their recipe's category; gathered ones share one group.
  const categoryByOutput = new Map<string, string>();
  for (const recipe of RECIPES) {
    for (const id of Object.keys(recipe.outputs)) {
      if (!categoryByOutput.has(id)) categoryByOutput.set(id, recipe.category);
    }
  }

  const SELL_CATEGORIES = [{ id: 'gathered', label: 'Gathered', icon: '🌿' }, ...CATEGORY_ORDER];

  const sellGroups = $derived(
    SELL_CATEGORIES.map((cat) => ({
      ...cat,
      items: RESOURCES.filter(
        (r) =>
          $game.unlockedResources.includes(r.id) &&
          (r.harvestAmount > 0 ? 'gathered' : (categoryByOutput.get(r.id) ?? 'goods')) === cat.id,
      ),
    })).filter((g) => g.items.length > 0),
  );

  const hireRows = $derived([
    {
      config: WORKER,
      owned: $game.workers,
      idle: idleWorkers($game),
      hire: hireWorker,
      hint: 'Assign workers to resources in the Gather tab.',
    },
    {
      config: CRAFTER,
      owned: $game.crafters,
      idle: idleCrafters($game),
      hire: hireCrafter,
      hint: 'Assign crafters to recipes in the Craft tab.',
    },
  ]);

  async function confirmReset() {
    if (confirm('Wipe the save and start over?')) await hardReset();
  }
</script>

<div class="balance">Credits: <strong>{formatCredits($game.credits)}</strong></div>

<h2>Sell</h2>
<div class="list">
  {#each sellGroups as group (group.id)}
    <button class="group-head" onclick={() => toggleCollapsed('market', group.id)}>
      <span>{group.icon} {group.label}</span>
      <span class="muted">
        {group.items.length}
        {isCollapsed($collapsed, 'market', group.id) ? '▸' : '▾'}
      </span>
    </button>
    {#if !isCollapsed($collapsed, 'market', group.id)}
      {#each group.items as r (r.id)}
        <div class="row">
          <span class="what">{r.icon} {r.name}</span>
          <span class="have">{formatNumber($game.resources[r.id] ?? 0)}</span>
          <span class="price">{formatCredits(r.baseSellPrice)}/u</span>
          <span class="btns">
            <button disabled={($game.resources[r.id] ?? 0) < 1} onclick={() => sellResource(r.id, 1)}>1</button>
            <button disabled={($game.resources[r.id] ?? 0) < 1} onclick={() => sellResource(r.id, 10)}>10</button>
            <button disabled={($game.resources[r.id] ?? 0) < 1} onclick={() => sellResource(r.id, 'all')}>All</button>
          </span>
        </div>
      {/each}
    {/if}
  {/each}
</div>

<h2>Workers</h2>
{#each hireRows as row (row.config.name)}
  <div class="row worker">
    <span class="what">
      {row.config.icon} {row.config.name}s <span class="muted">×{row.owned} ({row.idle} idle)</span>
    </span>
    <span class="desc muted">{row.config.description}</span>
    <button
      class="hire"
      disabled={$game.credits < nextHireCost(row.config, row.owned)}
      onclick={() => row.hire()}
    >
      Hire {formatCredits(nextHireCost(row.config, row.owned))}
    </button>
  </div>
  <p class="muted hint">{row.hint}</p>
{/each}

<h2>Danger zone</h2>
<button class="reset" onclick={confirmReset}>Hard-reset save</button>

<style>
  .balance {
    padding: 10px 12px;
    background: var(--panel);
    border: 1px solid var(--gold);
    border-radius: var(--radius);
    box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 25%, transparent);
    font-size: 0.9rem;
  }

  .balance strong {
    color: var(--gold);
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
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

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .what {
    flex: 1;
    font-weight: 600;
    white-space: nowrap;
  }

  .have {
    font-variant-numeric: tabular-nums;
    color: var(--accent);
    min-width: 3ch;
    text-align: right;
  }

  .price {
    font-size: 0.75rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .btns {
    display: flex;
    gap: 6px;
  }

  .btns button {
    min-width: 44px;
    padding: 0 8px;
  }

  .row.worker {
    flex-wrap: wrap;
  }

  .row.worker .desc {
    flex-basis: 100%;
    order: 3;
    font-size: 0.75rem;
  }

  .hire {
    background: var(--grad-primary);
    border: none;
    color: #fff;
    font-weight: 600;
    padding: 0 14px;
    white-space: nowrap;
    box-shadow: 0 0 10px color-mix(in srgb, var(--magic) 35%, transparent);
  }

  .hint {
    font-size: 0.8rem;
  }

  .reset {
    width: 100%;
    color: var(--danger);
    border-color: var(--danger);
    background: none;
    margin-bottom: 12px;
  }
</style>
