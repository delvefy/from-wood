<script lang="ts">
  let { value, max }: { value: number; max: number } = $props();

  const pct = $derived(max > 0 ? Math.min(100, (value / max) * 100) : 0);

  // Snap instead of animating when the bar moves backwards (action completed
  // and reset) — otherwise the 1s transition plays a full reverse slide.
  // `prev` is deliberately non-reactive: it only feeds the direction check.
  let prev = 0;
  const snap = $derived.by(() => {
    const backwards = pct < prev;
    prev = pct;
    return backwards;
  });
</script>

<div class="track">
  <div class="fill" class:snap style="transform: translateX({pct - 100}%)"></div>
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

  .fill.snap {
    transition: none;
  }
</style>
