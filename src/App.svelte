<script lang="ts">
  import { onMount } from 'svelte';
  import BottomNav from './components/BottomNav.svelte';
  import ModeSwitch from './components/ModeSwitch.svelte';
  import CraftView from './components/CraftView.svelte';
  import GatherView from './components/GatherView.svelte';
  import MarketView from './components/MarketView.svelte';
  import ResearchView from './components/ResearchView.svelte';
  import ResourceBar from './components/ResourceBar.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import TournamentView from './components/TournamentView.svelte';
  import VillageBoardView from './components/VillageBoardView.svelte';
  import { resetTickClock, runTick } from './engine/actions';
  import { initCloudSave, maybeCloudPush } from './engine/cloudSave';
  import { loadGame, saveGame } from './engine/save';
  import { maybeSubmitScore } from './engine/tournament';
  import { maybeSubmitVillageScore } from './engine/villageBoard';
  import { activeTab } from './util/nav';

  let ready = $state(false);

  onMount(() => {
    let tickTimer: number | undefined;
    let saveTimer: number | undefined;

    (async () => {
      await loadGame();
      initCloudSave();
      resetTickClock();
      ready = true;
      tickTimer = window.setInterval(() => {
        runTick();
        maybeSubmitScore();
        maybeSubmitVillageScore();
      }, 1000);
      saveTimer = window.setInterval(() => {
        void saveGame();
        maybeCloudPush();
      }, 10_000);
    })();

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void saveGame();
        maybeSubmitScore(true);
        maybeSubmitVillageScore(true);
        maybeCloudPush('hide');
      }
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
  <ModeSwitch />
  <ResourceBar />
  <main>
    {#if $activeTab === 'gather'}
      <GatherView />
    {:else if $activeTab === 'craft'}
      <CraftView />
    {:else if $activeTab === 'research'}
      <ResearchView />
    {:else if $activeTab === 'tournament'}
      <TournamentView />
    {:else if $activeTab === 'leaderboard'}
      <VillageBoardView />
    {:else if $activeTab === 'settings'}
      <SettingsView />
    {:else}
      <MarketView />
    {/if}
  </main>
  <BottomNav />
{:else}
  <div class="loading">Loading…</div>
{/if}

<style>
  main {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 12px;
  }

  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
  }
</style>
