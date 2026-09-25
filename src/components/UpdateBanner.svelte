<script lang="ts">
  import { APP_VERSION, dismissUpdatePrompt, updateAvailable } from '../lib/version';

  const info = $derived($updateAvailable);

  // Web builds are served by the auto-updating service worker, so the newer
  // bundle is already waiting — a hard reload is the whole update.
  function act() {
    const url = info?.storeUrl;
    if (url) window.open(url, '_blank', 'noopener');
    else window.location.reload();
  }
</script>

{#if info}
  <div class="banner" role="status">
    <div class="text">
      <strong>Update available</strong>
      <span class="muted">You're on {APP_VERSION} · {info.latest} is out</span>
    </div>
    <button class="go" onclick={act}>{info.storeUrl ? 'Update' : 'Reload'}</button>
    <button class="close" onclick={dismissUpdatePrompt} aria-label="Not now">✕</button>
  </div>
{/if}

<style>
  .banner {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--gold) 18%, var(--panel));
    border-bottom: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border));
    font-size: 0.8rem;
  }

  .text {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
    min-width: 0;
  }

  .muted {
    color: var(--muted);
    font-size: 0.72rem;
  }

  .go {
    margin-left: auto;
    flex: none;
    min-height: 0;
    padding: 6px 12px;
    font-weight: 600;
    border-radius: var(--radius-pill);
    background: var(--grad-primary);
    border: none;
    color: #fff;
  }

  .close {
    flex: none;
    min-height: 0;
    padding: 6px 8px;
    line-height: 1;
    background: none;
    border: none;
    color: var(--muted);
  }
</style>
