<script lang="ts">
  import { switchMode } from '../engine/tournament';
  import { activeTab } from '../util/nav';
  import { uiMode } from '../util/theme';

  let switching = $state(false);

  // Tournament side of the radio doubles as the way back to the hub
  // (standings, join) while a run is being played.
  function selectTournament() {
    activeTab.set('tournament');
  }

  async function selectVillage() {
    if (switching) return;
    switching = true;
    try {
      await switchMode('main'); // no-op when the village slot is already live
    } finally {
      switching = false;
    }
    if ($activeTab === 'tournament') activeTab.set('gather');
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
