<script lang="ts">
  import { RESOURCES } from '../content/resources';
  import { WORKER } from '../content/workers';
  import { idleWorkers } from '../engine/actions';
  import { game } from '../engine/state';
  import { formatNumber } from '../util/format';
  import { theme, toggleTheme } from '../util/theme';

  const visible = $derived(RESOURCES.filter((r) => $game.unlockedResources.includes(r.id)));
</script>

<header>
  <span class="chip gold">🪙 {formatNumber(Math.floor($game.credits))}</span>
  <span class="chip science">{WORKER.icon} {idleWorkers($game)}/{$game.workers}</span>
  {#each visible as r (r.id)}
    <span class="chip">{r.icon} {formatNumber($game.resources[r.id] ?? 0)}</span>
  {/each}
  <button
    class="theme-toggle"
    onclick={toggleTheme}
    aria-label="Switch theme"
    title={$theme === 'wood' ? 'Switch to industrial theme' : 'Switch to wood theme'}
  >
    {$theme === 'wood' ? '🏭' : '🪵'}
  </button>
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
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .theme-toggle {
    flex: none;
    margin-left: auto;
    min-height: 0;
    padding: 4px 8px;
    font-size: 0.85rem;
    line-height: 1;
  }

  .gold {
    border-color: var(--gold);
  }

  .science {
    border-color: var(--science);
  }
</style>
