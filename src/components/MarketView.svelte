<script lang="ts">
  import { PREMIUM } from '../content/premium';
  import { CATEGORY_ORDER, RECIPES } from '../content/recipes';
  import { RESOURCES } from '../content/resources';
  import { CRAFTER, GATHERER } from '../content/workers';
  import {
    hireCrafter,
    hireWorker,
    nextHireCost,
    sellEverything,
    sellResource,
  } from '../engine/actions';
  import { account } from '../engine/account';
  import {
    buyPremium,
    premiumOwned,
    sellPriceFactor,
    totalCrafters,
    totalGatherers,
  } from '../engine/premium';
  import { hardReset } from '../engine/hardReset';
  import type { PremiumItem, ResourceDef } from '../engine/types';
  import { game } from '../engine/state';
  import Icon from './Icon.svelte';
  import SearchBox from './SearchBox.svelte';
  import { collapsed, isCollapsed, toggleCollapsed } from '../util/collapse';
  import { formatCredits, formatNumber } from '../util/format';
  import { searchFilters } from '../util/nav';

  // Crafted items sell under their recipe's category; gathered ones share one group.
  const categoryByOutput = new Map<string, string>();
  for (const recipe of RECIPES) {
    for (const id of Object.keys(recipe.outputs)) {
      if (!categoryByOutput.has(id)) categoryByOutput.set(id, recipe.category);
    }
  }

  const SELL_CATEGORIES = [{ id: 'gathered', label: 'Gathered', icon: '🌿' }, ...CATEGORY_ORDER];

  const query = $derived(($searchFilters.market ?? '').trim().toLowerCase());

  // Rebuilt (and saleValue re-run 4×) on every game tick, so unlock checks
  // are a Set and the groups come from one pass over the catalog — a filter
  // per category with `.includes` per item made it O(categories × items ×
  // unlocked) per second.
  const unlockedSet = $derived(new Set($game.unlockedResources));
  const sellGroups = $derived.by(() => {
    const byCategory = new Map(
      SELL_CATEGORIES.map((cat) => [cat.id, { ...cat, items: [] as ResourceDef[] }]),
    );
    for (const r of RESOURCES) {
      if (!unlockedSet.has(r.id) || !r.name.toLowerCase().includes(query)) continue;
      const cat = r.harvestAmount > 0 ? 'gathered' : (categoryByOutput.get(r.id) ?? 'goods');
      byCategory.get(cat)?.items.push(r);
    }
    return [...byCategory.values()].filter((g) => g.items.length > 0);
  });

  const priceFactor = $derived(sellPriceFactor($account));

  // Credits a sale pays out: `fraction` of every unlocked stack — mirrors
  // sellEverything exactly.
  function saleValue(fraction: number): number {
    return RESOURCES.reduce(
      (sum, r) =>
        unlockedSet.has(r.id)
          ? sum + ($game.resources[r.id] ?? 0) * fraction * r.baseSellPrice * priceFactor
          : sum,
      0,
    );
  }

  const SELL_PRESETS = [25, 50, 75, 100];

  // `owned` drives the hire cost (only paid hires scale it); `total` includes
  // base workers (premium packs + tournament rewards) and is what the player sees.
  const hireRows = $derived([
    {
      config: GATHERER,
      owned: $game.workers,
      total: totalGatherers($game, $account),
      hire: hireWorker,
    },
    {
      config: CRAFTER,
      owned: $game.crafters,
      total: totalCrafters($game, $account),
      hire: hireCrafter,
    },
  ]);

  function formatUsd(price: number): string {
    return `$${price.toFixed(2)}`;
  }

  // Free while the game is in development, but keep the spending ritual.
  function confirmBuyPremium(item: PremiumItem) {
    if (confirm(`Are you sure you want to spend ${formatUsd(item.priceUsd)} on ${item.name}?`)) {
      buyPremium(item.id);
    }
  }

  async function confirmReset() {
    if (
      confirm(
        'Wipe EVERYTHING and start over? This also removes premium purchases, tournament rewards, and your tournament entry.',
      )
    )
      await hardReset();
  }
</script>

<SearchBox view="market" placeholder="Search items…" />

<div class="balance">
  <div class="balance-top">
    <span>Credits: <strong>{formatCredits($game.credits)}</strong></span>
  </div>
  <div class="sell-btns">
    <span class="muted">Sell</span>
    {#each SELL_PRESETS as pct (pct)}
      {@const value = saleValue(pct / 100)}
      <button
        class="sell-all"
        disabled={value <= 0}
        aria-label="Sell {pct}% of all inventory"
        onclick={() => sellEverything(pct / 100)}
      >
        {pct}%{value > 0 ? ` +${formatCredits(value)}` : ''}
      </button>
    {/each}
  </div>
</div>

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
    {#if query || !isCollapsed($collapsed, 'market', group.id)}
      {#each group.items as r (r.id)}
        {@const have = $game.resources[r.id] ?? 0}
        {@const value = have * r.baseSellPrice * priceFactor}
        <div class="row sell">
          <span class="what"><Icon id={r.id} /> {r.name}</span>
          <span class="have">{formatNumber(have)}</span>
          <span class="price">{formatCredits(r.baseSellPrice * priceFactor)}/u</span>
          <button class="sell-btn" disabled={value <= 0} onclick={() => sellResource(r.id, 'all')}>
            Sell {value > 0 ? `+${formatCredits(value)}` : '—'}
          </button>
        </div>
      {/each}
    {/if}
  {/each}
</div>

<h2>Workers</h2>
{#each hireRows as row (row.config.name)}
  <div class="row worker">
    <span class="what">
      <Icon id={row.config.icon} tint={false} /> {row.config.name}s <span class="muted">×{row.total}</span>
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
{/each}

<h2>✨ Premium Emporium</h2>
<p class="muted hint">Boosts bought with real money — free while the game is in development.</p>
{#each PREMIUM as item (item.id)}
  {@const owned = premiumOwned($account, item.id)}
  <div class="row worker premium">
    <span class="what">
      {item.icon} {item.name}
      {#if owned > 0}
        <span class="muted">{item.unique ? '✓ owned' : `×${owned}`}</span>
      {/if}
    </span>
    <span class="desc muted">{item.description}</span>
    {#if item.unique && owned > 0}
      <button class="buy" disabled>Owned</button>
    {:else}
      <button class="buy" onclick={() => confirmBuyPremium(item)}>
        Buy {formatUsd(item.priceUsd)}
      </button>
    {/if}
  </div>
{/each}

<h2>Danger zone</h2>
<button class="reset" onclick={confirmReset}>Hard-reset save</button>

<style>
  .balance {
    display: flex;
    flex-direction: column;
    gap: 6px;
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

  .balance-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  /* Fixed 2×2 grid: equal-width cells so buttons keep their spot no matter
     how long the credit amounts get. */
  .sell-btns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .sell-btns .muted {
    grid-column: 1 / -1;
  }

  .sell-all {
    background: var(--grad-primary);
    border: none;
    color: #fff;
    font-weight: 600;
    padding: 0 10px;
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
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
    min-width: 0;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  .sell-btn {
    min-width: 96px;
    padding: 0 10px;
    font-size: 0.8rem;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
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

  .row.premium {
    border-color: var(--gold);
    box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 20%, transparent);
  }

  .buy {
    background: linear-gradient(135deg, var(--gold), color-mix(in srgb, var(--gold) 60%, #b45309));
    border: none;
    color: #1a1206;
    font-weight: 700;
    padding: 0 14px;
    white-space: nowrap;
  }

  .buy:disabled {
    background: var(--panel-2);
    color: var(--muted);
    border: 1px solid var(--border);
  }

  .reset {
    width: 100%;
    color: var(--danger);
    border-color: var(--danger);
    background: none;
    margin-bottom: 12px;
  }
</style>
