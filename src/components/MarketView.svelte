<script lang="ts">
  import { RESOURCES } from '../content/resources';
  import { WORKER_TYPES } from '../content/workers';
  import {
    assignHarvester,
    assignedHarvesters,
    hireWorker,
    nextHireCost,
    sellResource,
  } from '../engine/actions';
  import { hardReset } from '../engine/save';
  import { game } from '../engine/state';
  import { formatNumber } from '../util/format';

  const sellable = $derived(RESOURCES.filter((r) => $game.unlockedResources.includes(r.id)));
  const hireable = $derived(WORKER_TYPES.filter((w) => $game.unlockedWorkerTypes.includes(w.type)));
  const harvesterUnlocked = $derived($game.unlockedWorkerTypes.includes('harvester'));
  const assignable = $derived(
    RESOURCES.filter((r) => r.manualHarvestAmount > 0 && $game.unlockedResources.includes(r.id)),
  );
  const idleHarvesters = $derived($game.workers.harvester - assignedHarvesters($game));

  async function confirmReset() {
    if (confirm('Wipe the save and start over?')) await hardReset();
  }
</script>

<h2>Sell</h2>
<div class="list">
  {#each sellable as r (r.id)}
    <div class="row">
      <span class="what">{r.icon} {r.name}</span>
      <span class="have">{formatNumber($game.resources[r.id] ?? 0)}</span>
      <span class="price">🪙{r.baseSellPrice}/u</span>
      <span class="btns">
        <button disabled={($game.resources[r.id] ?? 0) < 1} onclick={() => sellResource(r.id, 1)}>1</button>
        <button disabled={($game.resources[r.id] ?? 0) < 1} onclick={() => sellResource(r.id, 10)}>10</button>
        <button disabled={($game.resources[r.id] ?? 0) < 1} onclick={() => sellResource(r.id, 'all')}>All</button>
      </span>
    </div>
  {/each}
</div>

<h2>Workers</h2>
{#if hireable.length === 0}
  <p class="muted">Research <strong>Workforce</strong> to start hiring workers.</p>
{:else}
  <div class="list">
    {#each hireable as w (w.type)}
      <div class="row worker">
        <span class="what">{w.icon} {w.name} <span class="muted">×{$game.workers[w.type]}</span></span>
        <span class="desc muted">{w.description}</span>
        <button
          class="hire"
          disabled={$game.credits < nextHireCost(w.type, $game.workers[w.type])}
          onclick={() => hireWorker(w.type)}
        >
          Hire 🪙{formatNumber(nextHireCost(w.type, $game.workers[w.type]))}
        </button>
      </div>
    {/each}
  </div>
{/if}

{#if harvesterUnlocked}
  <h2>Assign harvesters <span class="muted">(idle: {idleHarvesters})</span></h2>
  <div class="list">
    {#each assignable as r (r.id)}
      <div class="row">
        <span class="what">{r.icon} {r.name}</span>
        <span class="btns assign">
          <button
            disabled={($game.harvesterAssignment[r.id] ?? 0) <= 0}
            onclick={() => assignHarvester(r.id, -1)}>−</button
          >
          <span class="count">{$game.harvesterAssignment[r.id] ?? 0}</span>
          <button disabled={idleHarvesters <= 0} onclick={() => assignHarvester(r.id, 1)}>+</button>
        </span>
      </div>
    {/each}
  </div>
{/if}

<h2>Danger zone</h2>
<button class="reset" onclick={confirmReset}>Hard-reset save</button>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
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
    background: var(--accent-dark);
    border-color: var(--accent-dark);
    font-weight: 600;
    padding: 0 12px;
    white-space: nowrap;
  }

  .assign .count {
    min-width: 2.5ch;
    text-align: center;
    align-self: center;
    font-variant-numeric: tabular-nums;
  }

  .reset {
    width: 100%;
    color: var(--danger);
    border-color: var(--danger);
    background: none;
    margin-bottom: 12px;
  }
</style>
