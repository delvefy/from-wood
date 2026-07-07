<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav, { type Tab } from './components/BottomNav.svelte';
  import CraftView from './components/CraftView.svelte';
  import GatherView from './components/GatherView.svelte';
  import MarketView from './components/MarketView.svelte';
  import ResearchView from './components/ResearchView.svelte';
  import ResourceBar from './components/ResourceBar.svelte';
  import { RESOURCE_BY_ID } from './content/resources';
  import { TECH_BY_ID } from './content/tech';
  import { resetTickClock, runTick } from './engine/actions';
  import { loadGame, saveGame, type OfflineReport } from './engine/save';
  import { formatDuration, formatNumber } from './util/format';

  let tab = $state<Tab>('gather');
  let ready = $state(false);
  let offline = $state<OfflineReport | null>(null);

  onMount(() => {
    let tickTimer: number | undefined;
    let saveTimer: number | undefined;

    (async () => {
      offline = await loadGame();
      resetTickClock();
      ready = true;
      tickTimer = window.setInterval(() => runTick(), 1000);
      saveTimer = window.setInterval(() => void saveGame(), 10_000);
    })();

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void saveGame();
    };
    const onUnload = () => void saveGame();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(tickTimer);
      clearInterval(saveTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
    };
  });
</script>

{#if ready}
  <ResourceBar />
  <main>
    {#if tab === 'gather'}
      <GatherView />
    {:else if tab === 'craft'}
      <CraftView />
    {:else if tab === 'research'}
      <ResearchView />
    {:else}
      <MarketView />
    {/if}
  </main>
  <BottomNav {tab} onchange={(t) => (tab = t)} />

  {#if offline}
    <div class="overlay" role="dialog" aria-label="Offline progress">
      <div class="modal">
        <h2>While you were away…</h2>
        <p class="muted">{formatDuration(offline.seconds)} of automated work</p>
        <ul>
          {#each offline.techCompleted as id (id)}
            <li>🔬 Researched {TECH_BY_ID[id]?.name ?? id}</li>
          {/each}
          {#each Object.entries(offline.resourceGains) as [id, gain] (id)}
            <li>{RESOURCE_BY_ID[id]?.icon} +{formatNumber(gain)} {RESOURCE_BY_ID[id]?.name ?? id}</li>
          {/each}
        </ul>
        <button class="primary" onclick={() => (offline = null)}>Nice</button>
      </div>
    </div>
  {/if}
{:else}
  <div class="loading">Loading…</div>
{/if}

<style>
  main {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 55%);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 50;
  }

  .modal {
    background: var(--panel);
    border: 1px solid color-mix(in srgb, var(--magic) 40%, var(--border));
    border-radius: var(--radius);
    box-shadow:
      var(--shadow),
      0 0 24px color-mix(in srgb, var(--magic) 25%, transparent);
    padding: 20px;
    width: min(92vw, 360px);
  }

  .modal h2 {
    margin: 0 0 4px;
  }

  .modal ul {
    margin: 12px 0;
    padding-left: 4px;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .primary {
    width: 100%;
    background: var(--grad-primary);
    border: none;
    color: #fff;
    font-weight: 600;
    box-shadow: 0 0 10px color-mix(in srgb, var(--magic) 35%, transparent);
  }
</style>
