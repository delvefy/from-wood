<script lang="ts">
  import { RESOURCES } from '../content/resources';
  import { game } from '../engine/state';
  import { formatNumber } from '../util/format';

  const visible = $derived(RESOURCES.filter((r) => $game.unlockedResources.includes(r.id)));
</script>

<header>
  <span class="chip gold">🪙 {formatNumber(Math.floor($game.credits))}</span>
  <span class="chip science">🔬 {formatNumber(Math.floor($game.researchPoints * 10) / 10)}</span>
  {#each visible as r (r.id)}
    <span class="chip">{r.icon} {formatNumber($game.resources[r.id] ?? 0)}</span>
  {/each}
</header>

<style>
  header {
    display: flex;
    gap: 6px;
    align-items: center;
    overflow-x: auto;
    flex: none;
    padding: calc(8px + env(safe-area-inset-top)) 10px 8px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    scrollbar-width: none;
  }

  header::-webkit-scrollbar {
    display: none;
  }

  .chip {
    flex: none;
    padding: 6px 10px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .gold {
    border-color: var(--gold);
  }

  .science {
    border-color: var(--science);
  }
</style>
