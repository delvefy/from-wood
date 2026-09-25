<script lang="ts">
  import { onMount } from 'svelte';
  import { App as CapacitorApp } from '@capacitor/app';
  import { Capacitor } from '@capacitor/core';
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
  import { retryClockSync, syncServerClock } from './engine/clock';
  import { initCloudSave, maybeCloudPush } from './engine/cloudSave';
  import { loadGame, saveGame } from './engine/save';
  import { maybeSubmitScore } from './engine/tournament';
  import { maybeSubmitVillageScore } from './engine/villageBoard';
  import { initUpdateCheck } from './lib/version';
  import { activeTab } from './util/nav';

  const CLOCK_SYNC_TIMEOUT_MS = 3000;

  let ready = $state(false);

  onMount(() => {
    let tickTimer: number | undefined;
    let saveTimer: number | undefined;

    (async () => {
      // Trusted time first, so the cold-start catch-up can be paid right
      // away. Bounded: an offline launch still starts, and the absence is
      // credited once a later sync succeeds.
      await Promise.race([
        syncServerClock(),
        new Promise((resolve) => setTimeout(resolve, CLOCK_SYNC_TIMEOUT_MS)),
      ]);
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
        retryClockSync();
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
      // Back from the background: re-anchor to the server so the time away
      // is paid by trusted time, not by the device clock.
      if (document.visibilityState === 'visible') void syncServerClock();
      if (document.visibilityState === 'hidden') {
        void saveGame();
        maybeSubmitScore(true);
        maybeSubmitVillageScore(true);
        maybeCloudPush('hide');
      }
    };
    const onUnload = () => void saveGame();
    document.addEventListener('visibilitychange', onVisibility);
    // The native shell reports resume itself; visibilitychange is not
    // guaranteed to fire in every Android webview.
    const resume = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('resume', () => void syncServerClock())
      : null;
    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(tickTimer);
      clearInterval(saveTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      void resume?.then((h) => h.remove());
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
