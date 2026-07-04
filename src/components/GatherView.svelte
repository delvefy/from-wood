<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  import { PLANNED_MATERIALS, RESOURCES } from '../content/resources';
  import { TECH } from '../content/tech';
  import { WORKER } from '../content/workers';
  import { assignWorker, idleWorkers } from '../engine/actions';
  import { harvestMultiplier } from '../engine/multipliers';
  import { game } from '../engine/state';
  import { formatNumber } from '../util/format';

  const gatherable = $derived(
    RESOURCES.filter((r) => r.harvestAmount > 0 && $game.unlockedResources.includes(r.id)),
  );
  const locked = $derived(
    RESOURCES.filter((r) => r.harvestAmount > 0 && !$game.unlockedResources.includes(r.id)),
  );
  const idle = $derived(idleWorkers($game));

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
    neutral: 'Neutral',
  } as const;
</script>

<div class="slots">
  {WORKER.icon} Workers: <strong>{idle}</strong> idle / {$game.workers} total
  <span class="muted">— hire more in Market</span>
</div>

<div class="list">
  {#each gatherable as r (r.id)}
    {@const assigned = $game.gatherAssignment[r.id] ?? 0}
    {@const cycle = r.extractTimeSeconds}
    {@const yield_ = assigned * r.harvestAmount * harvestMultiplier($game.multipliers, r.id)}
    <div class="card">
      <div class="top">
        <span class="icon">{r.icon}</span>
        <span class="name">{r.name}</span>
        <span class="amount">{formatNumber($game.resources[r.id] ?? 0)}</span>
      </div>
      <div class="controls">
        <button disabled={assigned <= 0} onclick={() => assignWorker(r.id, -1)}>−</button>
        <span class="count">{WORKER.icon} {assigned}</span>
        <button disabled={idle <= 0} onclick={() => assignWorker(r.id, 1)}>+</button>
        <span class="rate muted">
          {#if assigned > 0}
            +{formatNumber(yield_)} / {formatNumber(cycle)}s
          {:else}
            assign a worker
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

  <h3 class="section muted">🧪 Planned</h3>
  {#each PLANNED_MATERIALS as p (p.name)}
    <div class="card dim">
      <div class="top">
        <span class="icon grey">{p.icon}</span>
        <span class="name">{p.name}</span>
        <span class="tier muted">Tier {p.tier}</span>
      </div>
      <span class="hint muted">
        Coming soon
        <span class="branch {p.branch}">{branchLabel[p.branch]}</span>
      </span>
    </div>
  {/each}
</div>

<style>
  .slots {
    padding: 10px 12px;
    margin-bottom: 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    font-size: 0.9rem;
  }

  .slots .muted {
    font-size: 0.75rem;
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

  .top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon {
    font-size: 1.6rem;
    line-height: 1;
  }

  .name {
    flex: 1;
    font-weight: 600;
  }

  .amount {
    font-size: 1.1rem;
    font-variant-numeric: tabular-nums;
    color: var(--accent);
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

  .section {
    margin: 8px 0 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .card.dim {
    opacity: 0.55;
    gap: 4px;
    padding: 8px 12px;
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
    padding: 1px 6px;
    border: 1px solid var(--border);
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
