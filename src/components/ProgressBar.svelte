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
    height: 6px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 1s linear;
  }
</style>
