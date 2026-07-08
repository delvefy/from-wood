<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  import { RESOURCES } from '../content/resources';
  import { TECH } from '../content/tech';
  import { GATHERER } from '../content/workers';
  import { assignAllWorkers, assignWorker, idleWorkers, unassignAllWorkers } from '../engine/actions';
  import { harvestMultiplier } from '../engine/multipliers';
  import { gatherTimeFactor, totalGatherers } from '../engine/premium';
  import { game } from '../engine/state';
  import { formatNumber } from '../util/format';

  const gatherable = $derived(
    RESOURCES.filter((r) => r.harvestAmount > 0 && $game.unlockedResources.includes(r.id)),
  );
  const locked = $derived(
    RESOURCES.filter((r) => r.harvestAmount > 0 && !$game.unlockedResources.includes(r.id)),
  );
  const idle = $derived(idleWorkers($game));
  let manage = $state(false);

  // The tech node whose research unlocks this resource (for the locked hint).
  function unlockedBy(resourceId: string) {
    return TECH.find((t) =>
      t.effects.some((e) => e.kind === 'unlockResource' && e.id === resourceId),
    );
  }

  const branchLabel = {
    magic: '✦ Magic',
    tech: '⚙ Tech',
    magitech: '⚡ Magitech',
  } as const;
</script>

<button class="slots" onclick={() => (manage = !manage)}>
  {GATHERER.icon} Gatherers: <strong>{idle}</strong> idle / {totalGatherers($game)} total
  <span class="muted">— tap to manage {manage ? '▾' : '▸'}</span>
</button>
{#if manage}
  <div class="manage">
    <button onclick={unassignAllWorkers}>Unassign all</button>
    <button class="fill" disabled={idle <= 0} onclick={assignAllWorkers}>Assign all evenly</button>
  </div>
{/if}

<div class="list">
  {#each gatherable as r (r.id)}
    {@const assigned = $game.gatherAssignment[r.id] ?? 0}
    {@const cycle = r.extractTimeSeconds * gatherTimeFactor($game)}
    {@const yield_ = assigned * r.harvestAmount * harvestMultiplier($game.multipliers, r.id)}
    <div class="card">
      <div class="top">
        <span class="icon">{r.icon}</span>
        <span class="name">{r.name}</span>
        <span class="amount">{formatNumber($game.resources[r.id] ?? 0)}</span>
      </div>
      <div class="controls">
        <button disabled={assigned <= 0} onclick={() => assignWorker(r.id, -1)}>−</button>
        <span class="count">{GATHERER.icon} {assigned}</span>
        <button disabled={idle <= 0} onclick={() => assignWorker(r.id, 1)}>+</button>
        <span class="rate muted">
          {#if assigned > 0}
            +{formatNumber(yield_)} / {formatNumber(cycle)}s
          {:else}
            assign a gatherer
          {/if}
        </span>
      </div>
      {#if assigned > 0}
        <div class="progress">
          <ProgressBar value={$game.gatherProgress[r.id] ?? 0} max={cycle} />
          <span class="left muted">{Math.ceil(cycle - ($game.gatherProgress[r.id] ?? 0))}s</span>
        </div>
      {/if}
    </div>
  {/each}

  {#if locked.length > 0}
    <h3 class="section muted">🔒 Locked</h3>
    {#each locked as r (r.id)}
      {@const tech = unlockedBy(r.id)}
      <div class="card dim">
        <div class="top">
          <span class="icon grey">{r.icon}</span>
          <span class="name">{r.name}</span>
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
  {/if}

</div>

<style>
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

  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 7px 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon {
    font-size: 1.2rem;
    line-height: 1;
  }

  .name {
    flex: 1;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .amount {
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
    color: var(--accent);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .controls button {
    min-width: 40px;
    min-height: 32px;
    padding: 0 8px;
    line-height: 1;
  }

  .count {
    min-width: 3.5ch;
    text-align: center;
    font-size: 0.85rem;
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

  .section {
    margin: 8px 0 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .card.dim {
    opacity: 0.55;
    gap: 3px;
    padding: 6px 10px;
  }

  .icon.grey {
    filter: grayscale(1);
  }

  .tier {
    margin-left: auto;
    font-size: 0.75rem;
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
