<script lang="ts">
  import AccountSection from './AccountSection.svelte';
  import { notificationsSupported, setTournamentReminders } from '../lib/notifications';
  import { setTournamentRemindersSetting, settings, toggleMaterialLinks } from '../util/settings';
  import { setTheme, theme } from '../util/theme';

  // Web builds can't schedule anything for a closed tab, so the row only
  // exists in the native app.
  const canRemind = notificationsSupported();
  let busy = $state(false);
  let denied = $state(false);

  async function toggleReminders() {
    if (busy) return;
    busy = true;
    try {
      const want = !$settings.tournamentReminders;
      const on = await setTournamentReminders(want);
      setTournamentRemindersSetting(on);
      // Wanted them on and didn't get them: the OS prompt was declined.
      denied = want && !on;
    } finally {
      busy = false;
    }
  }
</script>

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

{#if canRemind}
  <button class="row" onclick={toggleReminders} disabled={busy}>
    <span class="text">
      <span class="label">Tournament reminders</span>
      <span class="desc muted">
        Notify me when a new tournament opens — Monday 12:00 and Friday 00:00 UTC.
        {#if denied}
          <br />Notifications are blocked for From Wood in your system settings.
        {/if}
      </span>
    </span>
    <span class="toggle" class:on={$settings.tournamentReminders} aria-hidden="true">
      <span class="knob"></span>
    </span>
  </button>
{/if}

<h2>Credits</h2>
<p class="credits muted">
  Item icons by the <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>
  contributors, licensed under
  <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>.
</p>

<AccountSection />

<style>
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
