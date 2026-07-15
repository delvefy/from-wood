<script lang="ts">
  import { switchMode } from '../engine/tournament';
  import { getTournamentMeta } from '../engine/tournamentMeta';
  import { activeTab } from '../util/nav';
  import { uiMode } from '../util/theme';

  let switching = $state(false);

  // Leave mode-only tabs behind when swapping slots so both sides land on
  // the same gather page.
  function landOnGather() {
    if ($activeTab === 'tournament' || $activeTab === 'leaderboard') activeTab.set('gather');
  }

  // With a live run to resume, switching sides works exactly like Village:
  // swap the slot and land on the gather page. Without one (never joined, or
  // the run ended) open the hub, where joining lives.
  async function selectTournament() {
    if (switching) return;
    const meta = getTournamentMeta();
    const now = Date.now();
    if (!meta || now < meta.startsAt || now > meta.endsAt) {
      activeTab.set('tournament');
      return;
    }
    switching = true;
    try {
      await switchMode('tournament'); // no-op when the tournament slot is already live
    } finally {
      switching = false;
    }
    landOnGather();
  }

  async function selectVillage() {
    if (switching) return;
    switching = true;
    try {
      await switchMode('main'); // no-op when the village slot is already live
    } finally {
      switching = false;
    }
    landOnGather();
  }
</script>

<div class="switch" role="radiogroup" aria-label="Village or tournament">
  <button
    role="radio"
    aria-checked={$uiMode === 'village'}
    class:active={$uiMode === 'village'}
    disabled={switching}
    onclick={selectVillage}
  >
    🏡 Village
  </button>
  <button
    role="radio"
    aria-checked={$uiMode === 'tournament'}
    class:active={$uiMode === 'tournament'}
    disabled={switching}
    onclick={selectTournament}
  >
    🏆 Tournament
  </button>
</div>

<style>
  .switch {
    flex: none;
    display: flex;
    gap: 4px;
    padding: calc(6px + env(safe-area-inset-top)) 12px 6px;
    background: var(--panel-2);
    border-bottom: 1px solid var(--border);
  }

  button {
    flex: 1;
    min-height: 34px;
    padding: 4px 0;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--muted);
  }

  button.active {
    color: var(--text);
    border-color: color-mix(in srgb, var(--magic) 45%, var(--border));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--magic) 18%, var(--panel)),
      color-mix(in srgb, var(--tech) 18%, var(--panel))
    );
    box-shadow: 0 0 10px color-mix(in srgb, var(--magic) 25%, transparent);
  }
</style>
