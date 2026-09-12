<script lang="ts">
  import { untrack } from 'svelte';
  import FirstStepsGuide from './FirstStepsGuide.svelte';
  import LockedList from './LockedList.svelte';
  import SearchBox from './SearchBox.svelte';
  import WorkerBudget from './WorkerBudget.svelte';
  import WorkerRow from './WorkerRow.svelte';
  import { RESOURCES } from '../content/resources';
  import { techTree } from '../content/tech';
  import { GATHERER } from '../content/workers';
  import { account } from '../engine/account';
  import { assignAllWorkers, assignWorker, idleWorkers, unassignAllWorkers } from '../engine/actions';
  import { harvestMultiplier } from '../engine/multipliers';
  import { gatherTimeFactor, totalGatherers } from '../engine/premium';
  import { computeFlowRates, netRate, secondsToDry } from '../engine/rates';
  import { game } from '../engine/state';
  import type { ResourceDef, TechNode } from '../engine/types';
  import { formatDuration, formatNumber } from '../util/format';
  import { searchFilters } from '../util/nav';

  // Only ~20 of the 200+ catalog entries are gatherable; filter those once so
  // the per-tick deriveds below never rescan the full catalog.
  const RAWS = RESOURCES.filter((r) => r.harvestAmount > 0);

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

  const query = $derived(($searchFilters.gather ?? '').trim().toLowerCase());
  const unlockedSet = $derived(new Set($game.unlockedResources));
  const gatherable = $derived(
    RAWS.filter((r) => unlockedSet.has(r.id) && r.name.toLowerCase().includes(query)),
  );
  const locked = $derived(
    RAWS.filter((r) => !unlockedSet.has(r.id) && r.name.toLowerCase().includes(query)).map(
      (r) => ({ id: r.id, name: r.name, tech: unlockedByTech.get(r.id) }),
    ),
  );
  const idle = $derived(idleWorkers($game));
  const rates = $derived(computeFlowRates($game, $account));

  // One row expanded at a time.
  let expanded = $state<string | null>(null);
  const toggle = (id: string) => (expanded = expanded === id ? null : id);

  // A new search collapses whatever was open; an exact material name (what
  // material links set) opens that material's row.
  $effect(() => {
    const q = query;
    untrack(() => {
      expanded = (q && gatherable.find((r) => r.name.toLowerCase() === q)?.id) || null;
    });
  });

  function cycleOf(r: ResourceDef): number {
    return r.extractTimeSeconds * gatherTimeFactor($account);
  }

  function perGatherer(r: ResourceDef): number {
    return (r.harvestAmount * harvestMultiplier($game.multipliers, r.id)) / cycleOf(r);
  }

  // Collapsed subline: unstaffed rows show the per-gatherer rate; staffed rows
  // show the gather rate, downgraded to a warning when crafters drain the
  // material faster than it comes in.
  function summarize(r: ResourceDef, assigned: number): { text: string; tone: 'muted' | 'ok' | 'warn' } {
    if (assigned <= 0) return { text: `+${formatNumber(perGatherer(r))}/s per gatherer`, tone: 'muted' };
    const gross = assigned * perGatherer(r);
    const net = netRate(rates, r.id);
    if (net < 0) {
      const dry = secondsToDry($game, rates, r.id);
      return {
        text: `+${formatNumber(gross)}/s · net −${formatNumber(-net)}/s · dry in ~${formatDuration(dry)}`,
        tone: 'warn',
      };
    }
    return { text: `+${formatNumber(gross)}/s`, tone: 'ok' };
  }
</script>

<FirstStepsGuide />

<SearchBox view="gather" placeholder="Search materials…" />

<WorkerBudget
  icon={GATHERER.icon}
  idle={idle}
  total={totalGatherers($game, $account)}
  noun="gatherers"
  onclear={unassignAllWorkers}
  onfill={assignAllWorkers}
/>

{#snippet row(r: ResourceDef)}
  {@const assigned = $game.gatherAssignment[r.id] ?? 0}
  {@const s = summarize(r, assigned)}
  <WorkerRow
    id={r.id}
    name={r.name}
    stock={$game.resources[r.id] ?? 0}
    {assigned}
    {idle}
    workerIcon={GATHERER.icon}
    summary={s.text}
    tone={s.tone}
    expanded={expanded === r.id}
    ontoggle={() => toggle(r.id)}
    onassign={(d) => assignWorker(r.id, d)}
  >
    {#snippet details()}
      {@const net = netRate(rates, r.id)}
      {@const dry = secondsToDry($game, rates, r.id)}
      <dl class="facts">
        <dt>Per gatherer</dt>
        <dd>+{formatNumber(perGatherer(r))}/s · {formatNumber(r.harvestAmount * harvestMultiplier($game.multipliers, r.id))} every {formatNumber(cycleOf(r))}s</dd>
        <dt>Gathering</dt>
        <dd>+{formatNumber(rates.production[r.id] ?? 0)}/s</dd>
        <dt>Crafting uses</dt>
        <dd>−{formatNumber(rates.consumption[r.id] ?? 0)}/s</dd>
        <dt>Net</dt>
        <dd class:warn={net < 0} class:ok={net > 0}>
          {net < 0 ? '−' : '+'}{formatNumber(Math.abs(net))}/s{#if Number.isFinite(dry)} · dry in ~{formatDuration(dry)}{/if}
        </dd>
      </dl>
    {/snippet}
  </WorkerRow>
{/snippet}

{#if gatherable.length > 0}
  <h3 class="section">Materials <span class="muted">{gatherable.length}</span></h3>
  <div class="list">
    {#each gatherable as r (r.id)}
      {@render row(r)}
    {/each}
  </div>
{:else if query}
  <p class="muted empty">No materials match “{query}”.</p>
{/if}

<LockedList items={locked} />

<style>
  .section {
    display: flex;
    justify-content: space-between;
    margin: 12px 4px 6px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }

  .section:first-of-type {
    margin-top: 2px;
  }

  .list {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .list > :global(.row + .row) {
    border-top: 1px solid var(--border);
  }

  .empty {
    text-align: center;
    padding: 24px 12px 8px;
  }

  .facts {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 12px;
    margin: 0;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .facts dt {
    color: var(--muted);
  }

  .facts dd {
    margin: 0;
  }

  .facts .warn {
    color: var(--gold);
  }

  .facts .ok {
    color: var(--accent);
  }
</style>
