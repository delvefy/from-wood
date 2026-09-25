<script lang="ts">
  import { onMount } from 'svelte';
  import AuthView from './components/AuthView.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import ModeSwitch from './components/ModeSwitch.svelte';
  import CraftView from './components/CraftView.svelte';
  import GatherView from './components/GatherView.svelte';
  import MarketView from './components/MarketView.svelte';
  import ResearchView from './components/ResearchView.svelte';
  import ResourceBar from './components/ResourceBar.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import TournamentView from './components/TournamentView.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import VillageBoardView from './components/VillageBoardView.svelte';
  import WelcomeBackModal from './components/WelcomeBackModal.svelte';
  import { resetTickClock, runTick } from './engine/actions';
  import { settleAway, settleIfAway } from './engine/away';
  import { initCloudSave, maybeCloudPush } from './engine/cloudSave';
  import { loadGame, saveGame } from './engine/save';
  import { maybeSubmitScore } from './engine/tournament';
  import { maybeSubmitVillageScore } from './engine/villageBoard';
  import { initUpdateCheck } from './lib/version';
  import { activeTab } from './util/nav';

  let ready = $state(false);

  onMount(() => {
    let tickTimer: number | undefined;
    let saveTimer: number | undefined;

    (async () => {
      const caughtUp = await loadGame();
      initCloudSave();
      initUpdateCheck();
      resetTickClock();
      ready = true;
      // Catches the idle slot up too, then reports both if the player was away
      // long enough to be worth telling about.
      void settleAway(caughtUp);
      tickTimer = window.setInterval(() => {
        // A long jump here means the app was backgrounded, not killed — the
        // same absence, reaching the player down a different path.
        settleIfAway(runTick());
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
  <UpdateBanner />
  <ResourceBar />
  <WelcomeBackModal />
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
    {:else if $activeTab === 'signin'}
      <AuthView mode="signin" />
    {:else if $activeTab === 'signup'}
      <AuthView mode="signup" />
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
