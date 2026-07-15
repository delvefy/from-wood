<script lang="ts">
  import AccountSection from './AccountSection.svelte';
  import { devEndTournament, devStartTournament } from '../engine/tournament';
  import { settings, toggleMaterialLinks } from '../util/settings';
  import { setTheme, theme } from '../util/theme';

  // Dev-only tournament controls; the server rejects calls without the right
  // admin key, so this section is harmless for regular players.
  const DEV_KEY_STORAGE = 'from-wood-dev-key';

  let devKey = $state(localStorage.getItem(DEV_KEY_STORAGE) ?? '');
  let devMinutes = $state(4320); // 3 days, the real tournament length
  let devBusy = $state(false);
  let devMessage = $state<string | null>(null);
  let devError = $state(false);

  async function runDev(action: () => Promise<void>, done: string) {
    localStorage.setItem(DEV_KEY_STORAGE, devKey);
    devBusy = true;
    devMessage = null;
    try {
      await action();
      devMessage = done;
      devError = false;
    } catch (err) {
      devMessage = err instanceof Error ? err.message : 'Request failed';
      devError = true;
    } finally {
      devBusy = false;
    }
  }
</script>

<AccountSection />

<h2>Appearance</h2>
<div class="options">
  <button class:active={$theme === 'wood'} onclick={() => setTheme('wood')}>☀️ Light</button>
  <button class:active={$theme === 'industrial'} onclick={() => setTheme('industrial')}>
    🌙 Dark
  </button>
</div>

<h2>Gameplay</h2>
<button class="row" onclick={toggleMaterialLinks}>
  <span class="text">
    <span class="label">Material links</span>
    <span class="desc muted">
      Tap a material in Craft or Research to jump to where it's gathered or crafted, with the
      search filter pre-filled.
    </span>
  </span>
  <span class="toggle" class:on={$settings.materialLinks} aria-hidden="true">
    <span class="knob"></span>
  </span>
</button>

<h2>Testing</h2>
<div class="dev">
  <p class="desc muted">
    Tournament controls for testing. Actions run on the server and affect every player, and
    need the admin key.
  </p>
  <label class="dev-field">
    <span class="label">Admin key</span>
    <input type="password" bind:value={devKey} placeholder="admin key" autocomplete="off" />
  </label>
  <label class="dev-field">
    <span class="label">Duration (minutes)</span>
    <input type="number" min="1" bind:value={devMinutes} />
  </label>
  <div class="dev-actions">
    <button
      disabled={devBusy || devKey.trim().length === 0}
      onclick={() =>
        runDev(
          () => devStartTournament(devKey.trim(), Math.max(1, Math.floor(devMinutes || 1))),
          'New tournament started — join it from the Tournament tab.',
        )}
    >
      🏁 Start new tournament
    </button>
    <button
      disabled={devBusy || devKey.trim().length === 0}
      onclick={() =>
        runDev(
          () => devEndTournament(devKey.trim()),
          'Tournament ended — final ranks and rewards are in.',
        )}
    >
      🛑 End tournament now
    </button>
  </div>
  <p class="desc muted">
    Starting ends any running tournament first (finalizing its ranks and rewards).
  </p>
  {#if devMessage}
    <p class="dev-status" class:error={devError}>{devMessage}</p>
  {/if}
</div>

<h2>Credits</h2>
<p class="credits muted">
  Item icons by the <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>
  contributors, licensed under
  <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>.
</p>

<style>
  .dev {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .dev-field {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .dev-field .label {
    flex: none;
    width: 40%;
  }

  .dev-field input {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text);
  }

  .dev-actions {
    display: flex;
    gap: 8px;
  }

  .dev-actions button {
    flex: 1;
    padding: 10px;
    font-weight: 600;
  }

  .dev-actions button:disabled {
    opacity: 0.6;
  }

  .dev-status {
    margin: 0;
    font-size: 0.85rem;
    color: var(--tech);
  }

  .dev-status.error {
    color: var(--danger);
  }

  .credits {
    font-size: 0.78rem;
  }

  .credits a {
    color: inherit;
  }

  .options {
    display: flex;
    gap: 8px;
  }

  .options button {
    flex: 1;
    padding: 12px;
    font-weight: 600;
  }

  .options button.active {
    border-color: color-mix(in srgb, var(--magic) 45%, var(--border));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--magic) 18%, var(--panel-2)),
      color-mix(in srgb, var(--tech) 18%, var(--panel-2))
    );
    box-shadow: 0 0 12px color-mix(in srgb, var(--magic) 25%, transparent);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px;
    background: var(--panel);
    text-align: left;
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .label {
    font-weight: 600;
  }

  .desc {
    font-size: 0.78rem;
  }

  .toggle {
    flex: none;
    position: relative;
    width: 46px;
    height: 26px;
    border-radius: var(--radius-pill);
    background: var(--panel-2);
    border: 1px solid var(--border);
    transition: background 0.15s ease;
  }

  .toggle.on {
    background: var(--grad-primary);
    border-color: transparent;
  }

  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-round);
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 30%);
    transition: transform 0.15s ease;
  }

  .toggle.on .knob {
    transform: translateX(20px);
  }
</style>
