<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import { formatNumber } from '../util/format';
  import { holdRepeat } from '../util/holdRepeat';

  // One assignable thing (a resource or a recipe) as a flat list row. The
  // left ~75% is plain content that toggles the detail panel; only the
  // compact stepper on the right takes assignment input, and it uses
  // `touch-action: pan-y` so a swipe that starts on it still scrolls the
  // list. Expanded, the row grows a panel with a larger stepper, bulk
  // buttons, and whatever `details` the tab wants to show.
  let {
    id,
    name,
    stock,
    assigned,
    idle,
    workerIcon,
    summary,
    tone = 'muted',
    expanded = false,
    ontoggle,
    onassign,
    details,
  }: {
    id: string;
    name: string;
    stock: number;
    assigned: number;
    idle: number;
    workerIcon: string;
    summary: string;
    tone?: 'muted' | 'ok' | 'warn' | 'danger';
    expanded?: boolean;
    ontoggle: () => void;
    onassign: (delta: number) => void;
    details?: Snippet;
  } = $props();
</script>

<div class="row" class:expanded class:staffed={assigned > 0}>
  <button class="main" aria-expanded={expanded} onclick={ontoggle}>
    <span class="icon"><Icon {id} /></span>
    <span class="text">
      <span class="name">{name}</span>
      <span class="sub {tone}">{summary}</span>
    </span>
    <span class="stock">{formatNumber(stock)}</span>
  </button>

  {#if expanded}
    <span class="chev muted" aria-hidden="true">▴</span>
  {:else}
    <div class="step">
      <button
        class="dec"
        aria-label="Unassign one from {name}"
        disabled={assigned <= 0}
        use:holdRepeat={() => onassign(-1)}>−</button>
      <span class="n" class:idle={assigned <= 0}>
        <Icon id={workerIcon} tint={false} />{assigned}
      </span>
      <button
        class="inc"
        aria-label="Assign one to {name}"
        disabled={idle <= 0}
        use:holdRepeat={() => onassign(1)}>+</button>
    </div>
  {/if}

  {#if expanded}
    <div class="panel">
      <div class="controls">
        <button
          class="big dec"
          aria-label="Unassign one from {name}"
          disabled={assigned <= 0}
          use:holdRepeat={() => onassign(-1)}>−</button>
        <span class="count" class:idle={assigned <= 0}>
          <Icon id={workerIcon} tint={false} /><strong>{assigned}</strong>
        </span>
        <button
          class="big inc"
          aria-label="Assign one to {name}"
          disabled={idle <= 0}
          use:holdRepeat={() => onassign(1)}>+</button>
        <span class="quick">
          <button disabled={idle <= 0} onclick={() => onassign(5)}>+5</button>
          <!-- The engine clamps to idle / zero, so ±Infinity means "all" / "none". -->
          <button disabled={idle <= 0} onclick={() => onassign(Infinity)}>Max</button>
          <button disabled={assigned <= 0} onclick={() => onassign(-Infinity)}>Clear</button>
        </span>
      </div>
      {@render details?.()}
    </div>
  {/if}
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 6px;
    padding-right: 8px;
  }

  .row.expanded {
    background: color-mix(in srgb, var(--accent) 7%, var(--panel));
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .main {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: 52px;
    padding: 6px 4px 6px 12px;
    border: none;
    border-radius: 0;
    background: none;
    text-align: left;
  }

  .main:not(:disabled):active {
    transform: none;
    background: color-mix(in srgb, var(--panel-2) 60%, transparent);
  }

  .icon {
    flex: none;
    font-size: 1.35rem;
    line-height: 1;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }

  .name {
    font-weight: 600;
    font-size: 0.95rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .sub.muted {
    color: var(--muted);
  }

  .sub.ok {
    color: var(--accent);
  }

  .sub.warn {
    color: var(--gold);
  }

  .sub.danger {
    color: var(--danger);
  }

  .stock {
    flex: none;
    font-size: 0.95rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--accent);
  }

  .chev {
    padding: 0 10px;
    font-size: 0.9rem;
  }

  /* Compact stepper: the row's only assignment surface. */
  .step {
    display: flex;
    align-items: center;
    height: 34px;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--panel-2) 70%, transparent);
    overflow: hidden;
    -webkit-user-select: none;
    user-select: none;
  }

  .step button,
  .big {
    touch-action: pan-y;
    -webkit-touch-callout: none;
  }

  .step button {
    width: 36px;
    min-height: 0;
    height: 100%;
    padding: 0;
    border: none;
    border-radius: 0;
    background: none;
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1;
    color: var(--accent);
  }

  .step .dec,
  .big.dec {
    color: var(--danger);
  }

  .step button:not(:disabled):active {
    transform: none;
    background: color-mix(in srgb, currentColor 16%, transparent);
  }

  .step button:disabled {
    opacity: 1;
    color: color-mix(in srgb, var(--muted) 40%, transparent);
  }

  .n {
    display: flex;
    align-items: center;
    gap: 3px;
    min-width: 34px;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .n.idle,
  .count.idle {
    opacity: 0.5;
  }

  /* Expanded panel spans the whole row under the header. */
  .panel {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 12px 12px;
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .big {
    width: 44px;
    height: 44px;
    min-height: 0;
    padding: 0;
    border-radius: var(--radius-round);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1;
    color: var(--accent);
  }

  .count {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 56px;
    justify-content: center;
    font-size: 1.1rem;
    font-variant-numeric: tabular-nums;
  }

  .count strong {
    font-size: 1.35rem;
  }

  .quick {
    display: flex;
    gap: 6px;
    margin-left: 6px;
  }

  .quick button {
    min-height: 34px;
    padding: 0 10px;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: var(--radius-pill);
  }
</style>
