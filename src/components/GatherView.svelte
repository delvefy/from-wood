<script lang="ts">
  import FirstStepsGuide from './FirstStepsGuide.svelte';
  import Icon from './Icon.svelte';
  import SearchBox from './SearchBox.svelte';
  import { RESOURCES } from '../content/resources';
  import { techTree } from '../content/tech';
  import { GATHERER } from '../content/workers';
  import { account } from '../engine/account';
  import { assignAllWorkers, assignWorker, idleWorkers, unassignAllWorkers } from '../engine/actions';
  import { harvestMultiplier } from '../engine/multipliers';
  import { gatherTimeFactor, totalGatherers } from '../engine/premium';
  import { game } from '../engine/state';
  import type { TechNode } from '../engine/types';
  import { formatNumber } from '../util/format';
  import { holdRepeat } from '../util/holdRepeat';
  import { openTech, searchFilters } from '../util/nav';

  // Only ~20 of the 200+ catalog entries are gatherable; filter those once so
  // the per-tick deriveds below never rescan the full catalog.
  const RAWS = RESOURCES.filter((r) => r.harvestAmount > 0);

  const query = $derived(($searchFilters.gather ?? '').trim().toLowerCase());
  const unlockedSet = $derived(new Set($game.unlockedResources));
  const gatherable = $derived(
    RAWS.filter((r) => unlockedSet.has(r.id) && r.name.toLowerCase().includes(query)),
  );
  const locked = $derived(
    RAWS.filter((r) => !unlockedSet.has(r.id) && r.name.toLowerCase().includes(query)),
  );
  const idle = $derived(idleWorkers($game));

  // The tech node whose research unlocks each resource (for the locked hint),
  // resolved once — a find() over the 500-node tree per locked card scanned
  // the whole tree each time. Unlock effects live on majors, which are
  // identical in both mode trees, so the village tree serves either mode.
  // First matching node wins, mirroring the find() this replaces.
  const unlockedByTech = new Map<string, TechNode>();
  for (const t of techTree('main')) {
    for (const e of t.effects) {
      if (e.kind === 'unlockResource' && !unlockedByTech.has(e.id)) unlockedByTech.set(e.id, t);
    }
  }

  const branchLabel = {
    magic: '✦ Magic',
    tech: '⚙ Tech',
    magitech: '⚡ Magitech',
    prestige: '🏗 Expansion', // unreachable today (prestige nodes unlock nothing), keeps the map total
  } as const;
</script>

<FirstStepsGuide />

<SearchBox view="gather" placeholder="Search materials…" />

<div class="slots">
  <span class="count" title="{idle} idle of {totalGatherers($game, $account)} gatherers">
    <Icon id={GATHERER.icon} tint={false} /> <strong>{idle}</strong>/{totalGatherers($game, $account)} idle
  </span>
  <button onclick={unassignAllWorkers}>Unassign all</button>
  <button class="fill" disabled={idle <= 0} onclick={assignAllWorkers}>Assign evenly</button>
</div>

<div class="list">
  {#each gatherable as r (r.id)}
    {@const assigned = $game.gatherAssignment[r.id] ?? 0}
    {@const cycle = r.extractTimeSeconds * gatherTimeFactor($account)}
    {@const yield_ = assigned * r.harvestAmount * harvestMultiplier($game.multipliers, r.id)}
    <div class="card gather">
      <button
        class="chev remove"
        aria-label="Unassign a gatherer from {r.name}"
        disabled={assigned <= 0}
        use:holdRepeat={() => assignWorker(r.id, -1)}
      >
        <svg viewBox="0 0 24 48" aria-hidden="true"><path d="M19 7 L7 24 L19 41" /></svg>
      </button>
      <div class="mid">
        <div class="title">
          <span class="icon"><Icon id={r.id} /></span>
          <span class="name">{r.name}</span>
          <span class="amount">{formatNumber($game.resources[r.id] ?? 0)}</span>
        </div>
        <div class="crew">
          <Icon id={GATHERER.icon} tint={false} /> <strong>{assigned}</strong>
          {#if assigned > 0}
            <span class="muted">· +{formatNumber(yield_ / cycle)}/s</span>
          {:else}
            <span class="muted">· hold ❯ to assign</span>
          {/if}
        </div>
      </div>
      <button
        class="chev add"
        aria-label="Assign a gatherer to {r.name}"
        disabled={idle <= 0}
        use:holdRepeat={() => assignWorker(r.id, 1)}
      >
        <svg viewBox="0 0 24 48" aria-hidden="true"><path d="M5 7 L17 24 L5 41" /></svg>
      </button>
    </div>
  {/each}

  {#if locked.length > 0}
    <h3 class="section muted">🔒 Locked</h3>
    {#each locked as r (r.id)}
      {@const tech = unlockedByTech.get(r.id)}
      <div class="card dim">
        <div class="top">
          <span class="icon grey"><Icon id={r.id} /></span>
          <span class="name">{r.name}</span>
        </div>
        {#if tech}
          <button class="hint muted link" title="Show {tech.name} in the research tree" onclick={() => openTech(tech.id)}>
            Research <strong>{tech.name}</strong>
            <span class="branch {tech.branch}">{branchLabel[tech.branch]}</span>
          </button>
        {:else}
          <span class="hint muted">Unlock not available yet</span>
        {/if}
      </div>
    {/each}
  {/if}

</div>

<style>
  .slots {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 6px 6px 12px;
    margin-bottom: 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    font-size: 0.9rem;
  }

  .count {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-right: auto;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .slots button {
    min-height: 36px;
    padding: 0 10px;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .slots .fill {
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

  /* Gather cards: chevron rails on the edges, info centered between them. */
  .card.gather {
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
    gap: 2px;
    min-width: 0;
    padding: 6px 8px;
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
    font-size: 1.1rem;
    line-height: 1;
  }

  .name {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .amount {
    font-size: 0.95rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--accent);
  }

  .crew {
    font-size: 0.8rem;
  }

  .crew strong {
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
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

  .top {
    display: flex;
    align-items: center;
    gap: 8px;
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

  /* The locked hint is a tap target that jumps to the tech node. */
  button.hint {
    min-height: 0;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    text-align: left;
  }

  .hint.link strong {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }

  .branch {
    padding: 1px 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
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
