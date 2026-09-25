<script lang="ts">
  import { onMount } from 'svelte';
  import { GROUP_SIZE, REWARD_SUMMARY, SCHEDULE_SUMMARY, rewardLabel } from '../content/tournament';
  import {
    fetchLeaderboard,
    joinTournament,
    leaderboard,
    maybeSubmitScore,
    refreshTournamentState,
    tournamentError,
    tournamentState,
  } from '../engine/tournament';
  import { account } from '../lib/supabase';
  import { formatCredits } from '../util/format';
  import { activeTab, openAuth } from '../util/nav';

  let loading = $state(true);
  let joining = $state(false);
  let joinError = $state<string | null>(null);
  let now = $state(Date.now());

  onMount(() => {
    const clock = window.setInterval(() => (now = Date.now()), 1000);
    const poll = window.setInterval(() => {
      void refreshTournamentState();
      void fetchLeaderboard();
    }, 30_000);
    void (async () => {
      maybeSubmitScore(true);
      await refreshTournamentState();
      await fetchLeaderboard();
      loading = false;
    })();
    return () => {
      clearInterval(clock);
      clearInterval(poll);
    };
  });

  const st = $derived($tournamentState);
  const running = $derived(st?.tournament ?? null);
  const entry = $derived(st?.entry ?? null);
  // Entered in the currently running tournament?
  const inCurrent = $derived(running !== null && entry?.tournamentId === running.id);
  // A finished entry to show results for (this week's ended run or an older one).
  const lastResult = $derived(entry && entry.status === 'finished' ? entry : null);
  const myRow = $derived($leaderboard.find((r) => r.isMe) ?? null);

  function timeLeft(until: number): string {
    const s = Math.max(0, Math.floor((until - now) / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s % 60}s`;
  }

  async function onJoin() {
    joinError = null;
    joining = true;
    try {
      await joinTournament();
      activeTab.set('gather'); // straight into the fresh run
    } catch (err) {
      joinError = err instanceof Error ? err.message : 'Could not join';
    } finally {
      joining = false;
    }
  }

</script>

<div class="wrap">
  {#if loading}
    <p class="muted center">Connecting to the tournament grounds…</p>
  {:else if !st}
    <div class="card">
      <h2>🏆 Weekly Tournament</h2>
      {#if !$account.signedIn}
        <p class="muted">Competing needs an account, so your results can follow you.</p>
        <button class="primary" onclick={() => openAuth('signup')}>Create an account</button>
      {:else}
        <p class="muted">{$tournamentError ?? 'Could not reach the tournament server.'}</p>
        <button
          class="primary"
          onclick={async () => {
            loading = true;
            await refreshTournamentState();
            await fetchLeaderboard();
            loading = false;
          }}>Retry</button
        >
      {/if}
    </div>
  {:else}
    <div class="header card">
      <div class="title">
        <span class="title-icon">🏆</span>
        <div>
          <div class="title-name">Weekly Tournament</div>
          <div class="muted small">
            {#if st.displayName}Competing as {st.displayName}{:else}Not competing yet{/if}
          </div>
        </div>
      </div>
      {#if running}
        <div class="countdown">
          <div class="small muted">ends in</div>
          <div class="time">{timeLeft(running.endsAt)}</div>
        </div>
      {:else}
        <div class="countdown">
          <div class="small muted">next starts in</div>
          <div class="time">{timeLeft(st.nextStartsAt)}</div>
        </div>
      {/if}
    </div>

    {#if lastResult && lastResult.finalRank !== null && !inCurrent}
      <div class="card">
        <h3>Last tournament result</h3>
        <p>
          Finished <strong>#{lastResult.finalRank}</strong> of {lastResult.groupSize} in your
          group.
        </p>
        <p class="muted">{rewardLabel(lastResult.finalRank)}</p>
      </div>
    {/if}

    {#if running && inCurrent && entry}
      <div class="card">
        <div class="row-between">
          <h3>Your run</h3>
          {#if myRow}
            <span class="rank" class:up={myRow.rank <= GROUP_SIZE}>#{myRow.rank}</span>
          {/if}
        </div>
        <p class="muted small">
          Best synced score: {formatCredits(entry.score)} · scores sync about once a minute while
          you play your run.
        </p>
      </div>
    {:else if running && !inCurrent}
      <div class="card">
        <h3>Join this week's tournament</h3>
        <p class="muted small">
          Everyone starts a brand-new run with just their base workers and races until
          Sunday midnight (UTC) to build the highest net worth. Your village keeps running
          and is never affected. You compete in a group of up to {GROUP_SIZE} players.
        </p>
        <p class="muted small">
          Rewards are permanent base workers: {REWARD_SUMMARY}.
        </p>
        {#if st.displayName}
          <p class="muted small">Competing as <strong>{st.displayName}</strong>.</p>
        {:else}
          <p class="muted small">
            You'll get a temporary name for the board — create an account to pick your own.
          </p>
        {/if}
        {#if joinError}
          <p class="error small">{joinError}</p>
        {/if}
        <button class="primary" disabled={joining} onclick={onJoin}>
          {joining ? 'Joining…' : '🏆 Join tournament'}
        </button>
      </div>
    {:else if !running}
      <div class="card">
        <h3>Between tournaments</h3>
        <p class="muted">
          The grounds are being swept. {SCHEDULE_SUMMARY}
        </p>
      </div>
    {/if}

    {#if $leaderboard.length > 0}
      <div class="card">
        <h3>{inCurrent ? 'Standings' : 'Final standings'}</h3>
        <ol class="board">
          {#each $leaderboard as row, i (i)}
            <li class:me={row.isMe} class:up={row.rank <= GROUP_SIZE}>
              <span class="pos">#{row.rank}</span>
              <span class="name">{row.name}{row.isMe ? ' (you)' : ''}</span>
              <span class="score">{formatCredits(row.score)}</span>
            </li>
          {/each}
        </ol>
        <p class="muted small">
          Every place in a group of {GROUP_SIZE} wins workers · higher rank, bigger reward
        </p>
      </div>
    {/if}
  {/if}
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

  .card h2,
  .card h3 {
    margin: 0;
  }

  .header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
  }

  .title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .title-icon {
    font-size: 1.8rem;
  }

  .title-name {
    font-weight: 700;
  }

  .countdown {
    text-align: right;
  }

  .time {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .row-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .rank {
    font-weight: 700;
    color: var(--muted);
  }

  .rank.up {
    color: var(--gold);
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

  .board li.up {
    background: color-mix(in srgb, var(--gold) 10%, transparent);
  }

  .board li.me {
    border: 1px solid color-mix(in srgb, var(--magic) 55%, var(--border));
    background: color-mix(in srgb, var(--magic) 12%, transparent);
  }

  .pos {
    width: 2.6em;
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

  .primary {
    background: var(--grad-primary);
    border: none;
    color: #fff;
    font-weight: 600;
    padding: 10px;
    border-radius: var(--radius-sm);
    box-shadow: 0 0 10px color-mix(in srgb, var(--magic) 35%, transparent);
  }

  button:disabled {
    opacity: 0.6;
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

  .error {
    color: var(--danger);
    margin: 0;
  }
</style>
