<script lang="ts">
  import { RESOURCES } from '../content/resources';
  import { WORKER_BY_TYPE } from '../content/workers';
  import { harvest } from '../engine/actions';
  import { harvestMultiplier } from '../engine/multipliers';
  import { game } from '../engine/state';
  import { formatNumber } from '../util/format';

  const harvestable = $derived(
    RESOURCES.filter((r) => r.manualHarvestAmount > 0 && $game.unlockedResources.includes(r.id)),
  );

  function autoRate(resourceId: string): number {
    const assigned = $game.harvesterAssignment[resourceId] ?? 0;
    return (
      assigned *
      WORKER_BY_TYPE.harvester.productionPerTick *
      $game.multipliers.workerEfficiency.harvester *
      harvestMultiplier($game.multipliers, resourceId)
    );
  }
</script>

<div class="grid">
  {#each harvestable as r (r.id)}
    <button class="tile" onclick={() => harvest(r.id)}>
      <span class="icon">{r.icon}</span>
      <span class="name">{r.name}</span>
      <span class="amount">{formatNumber($game.resources[r.id] ?? 0)}</span>
      <span class="rate">
        +{formatNumber(r.manualHarvestAmount * harvestMultiplier($game.multipliers, r.id))}/tap
        {#if autoRate(r.id) > 0}
          · +{formatNumber(autoRate(r.id))}/s
        {/if}
      </span>
    </button>
  {/each}
</div>
<p class="muted hint">Tap to gather. Unlock more resources in Research.</p>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 18px 8px 14px;
    background: var(--panel);
  }

  .tile:active {
    transform: scale(0.96);
    background: var(--panel-2);
  }

  .icon {
    font-size: 2.4rem;
    line-height: 1;
  }

  .name {
    font-weight: 600;
  }

  .amount {
    font-size: 1.2rem;
    font-variant-numeric: tabular-nums;
    color: var(--accent);
  }

  .rate {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .hint {
    text-align: center;
    font-size: 0.8rem;
  }
</style>
