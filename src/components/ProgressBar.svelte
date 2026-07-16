<script lang="ts">
  let { value, max }: { value: number; max: number } = $props();

  const pct = $derived(max > 0 ? Math.min(100, (value / max) * 100) : 0);
</script>

<div class="track">
  <div class="fill" style="transform: translateX({pct - 100}%)"></div>
</div>

<style>
  .track {
    width: 100%;
    height: 8px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  /* Full-width fill slid into view with translateX rather than an animated
     width: the tick updates every bar once a second, so the 1s transition
     runs back-to-back forever — transform stays on the compositor while
     width would relayout + repaint every frame on every visible bar. */
  .fill {
    width: 100%;
    height: 100%;
    background: var(--grad-primary);
    border-radius: var(--radius-pill);
    box-shadow: 0 0 8px color-mix(in srgb, var(--magic) 60%, transparent);
    transition: transform 1s linear;
    will-change: transform;
  }
</style>
