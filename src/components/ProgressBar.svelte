<script lang="ts">
  let { value, max }: { value: number; max: number } = $props();

  const pct = $derived(max > 0 ? Math.min(100, (value / max) * 100) : 0);
</script>

<div class="track">
  <div class="fill" style="width: {pct}%"></div>
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

  .fill {
    height: 100%;
    background: var(--grad-primary);
    border-radius: var(--radius-pill);
    box-shadow: 0 0 8px color-mix(in srgb, var(--magic) 60%, transparent);
    transition: width 1s linear;
  }
</style>
