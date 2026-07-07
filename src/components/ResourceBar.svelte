<script lang="ts">
  import { game } from '../engine/state';
  import { totalValue } from '../engine/worth';
  import { formatCredits } from '../util/format';
  import { theme, toggleTheme } from '../util/theme';
</script>

<header>
  <div class="total">
    <div>Total Value: <strong>{formatCredits(totalValue($game))}</strong></div>
    <div class="hint">total price of everything you own</div>
  </div>
  <button
    class="theme-toggle"
    onclick={toggleTheme}
    aria-label="Switch theme"
    title={$theme === 'wood' ? 'Switch to dark theme' : 'Switch to light theme'}
  >
    {$theme === 'wood' ? '🌙' : '☀️'}
  </button>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
    padding: calc(10px + env(safe-area-inset-top)) 12px 10px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--magic) 10%, var(--panel)),
      color-mix(in srgb, var(--tech) 10%, var(--panel))
    );
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow);
  }

  .total {
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .total .hint {
    font-size: 0.62rem;
    letter-spacing: 0.04em;
    text-transform: none;
    opacity: 0.8;
  }

  .total strong {
    font-size: 1.15rem;
    letter-spacing: 0;
    background: var(--grad-primary);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .theme-toggle {
    flex: none;
    margin-left: auto;
    min-height: 0;
    padding: 6px 9px;
    font-size: 0.85rem;
    line-height: 1;
    border-radius: 999px;
  }
</style>
