<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchVillageTop, villageTop, villageTopError } from '../engine/villageBoard';
  import { formatCredits } from '../util/format';

  onMount(() => {
    void fetchVillageTop(); // served from cache when fresh
  });

  const board = $derived($villageTop);
  const meInTop = $derived(board?.top.some((r) => r.isMe) ?? false);
</script>

<div class="wrap">
  <div class="card">
    <h3>🏆 Top villages of all time</h3>
    <p class="muted small">
      The 50 highest village worths ever recorded. Updates every few minutes.
    </p>

    {#if !board}
      <p class="muted center">{$villageTopError ?? 'Loading the hall of fame…'}</p>
    {:else if board.top.length === 0}
      <p class="muted center">No villages on the board yet — keep building!</p>
    {:else}
      <ol class="board">
        {#each board.top as row (row.rank + row.name)}
          <li class:me={row.isMe}>
            <span class="pos">#{row.rank}</span>
            <span class="name">{row.name}{row.isMe ? ' (you)' : ''}</span>
            <span class="score">{formatCredits(row.score)}</span>
          </li>
        {/each}
        {#if board.me && !meInTop}
          <li class="gap" aria-hidden="true">· · ·</li>
          <li class="me outside">
            <span class="pos">#{board.me.rank}</span>
            <span class="name">{board.me.name} (you)</span>
            <span class="score">{formatCredits(board.me.score)}</span>
          </li>
        {/if}
      </ol>
    {/if}
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card h3 {
    margin: 0;
  }

  .board {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .board li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
  }

  .board li.me {
    border: 1px solid color-mix(in srgb, var(--magic) 55%, var(--border));
    background: color-mix(in srgb, var(--magic) 12%, transparent);
  }

  /* Outside the top 50: dashed box + a gap row hint at the players between. */
  .board li.outside {
    border-style: dashed;
  }

  .board li.gap {
    justify-content: center;
    color: var(--muted);
    letter-spacing: 0.3em;
    padding: 2px 8px;
  }

  .pos {
    width: 3.4em;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .score {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .muted {
    color: var(--muted);
  }

  .small {
    font-size: 0.85rem;
  }

  .center {
    text-align: center;
    padding: 24px 0;
  }
</style>
