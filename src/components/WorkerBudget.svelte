<script lang="ts">
  import Icon from './Icon.svelte';

  // Sticky worker headroom bar shared by the Gather and Craft tabs: idle/total
  // plus the two bulk actions. Sticks to the top of <main> while the list
  // scrolls so headroom is always in view.
  let {
    icon,
    idle,
    total,
    noun,
    onclear,
    onfill,
  }: {
    icon: string;
    idle: number;
    total: number;
    noun: string;
    onclear: () => void;
    onfill: () => void;
  } = $props();
</script>

<div class="budget">
  <span class="count" title="{idle} idle of {total} {noun}">
    <Icon id={icon} tint={false} /> <strong>{idle}</strong><span class="muted">/{total} idle</span>
  </span>
  <button disabled={idle >= total} onclick={onclear}>Clear all</button>
  <button class="fill" disabled={idle <= 0} onclick={onfill}>Assign evenly</button>
</div>

<style>
  .budget {
    /* <main> pads 12px; sticky insets by that padding, so pull back to sit flush. */
    position: sticky;
    top: -12px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 6px 6px 12px;
    margin-bottom: 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    font-size: 0.9rem;
  }

  .count {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-right: auto;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .count strong {
    font-size: 1.05rem;
  }

  button {
    min-height: 36px;
    padding: 0 10px;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .fill {
    background: var(--grad-primary);
    border: none;
    color: #fff;
    font-weight: 600;
  }
</style>
