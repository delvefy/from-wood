<script lang="ts">
  import { awayReport, dismissAwayReport } from '../engine/away';
  import { OFFLINE_CAP_SECONDS } from '../engine/save';
  import { formatCredits, formatDuration } from '../util/format';

  const report = $derived($awayReport);
  const total = $derived((report?.slots ?? []).reduce((sum, s) => sum + s.gain, 0));
  // The absence was longer than the game pays for, so say so rather than
  // letting the player wonder why a week away looks like a day.
  const capped = $derived((report?.seconds ?? 0) >= OFFLINE_CAP_SECONDS);

  const LABEL: Record<string, string> = {
    main: '🏡 Village',
    tournament: '🏆 Tournament run',
  };
</script>

{#if report}
  <!-- Clicking the backdrop dismisses; clicks inside the sheet bubble up to
       here too, so only a hit on the backdrop itself counts. -->
  <div
    class="backdrop"
    role="presentation"
    onclick={(e) => e.target === e.currentTarget && dismissAwayReport()}
  >
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="away-title" tabindex="-1">
      <h2 id="away-title">Welcome back</h2>
      <p class="muted small">
        Your workers kept going for {formatDuration(report.seconds)}.
        {#if capped}
          Offline progress pays out for at most {formatDuration(OFFLINE_CAP_SECONDS)}.
        {/if}
      </p>

      <ul class="slots">
        {#each report.slots as slot (slot.mode)}
          <li>
            <span class="name">{LABEL[slot.mode]}</span>
            <span class="gain">+{formatCredits(slot.gain)}</span>
          </li>
        {/each}
      </ul>

      {#if report.slots.length > 1}
        <div class="total">
          <span class="name">Total value earned</span>
          <span class="gain">+{formatCredits(total)}</span>
        </div>
      {/if}

      <button class="primary" onclick={dismissAwayReport}>Continue</button>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.6);
  }

  .sheet {
    width: 100%;
    max-width: 340px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px;
    background: var(--panel);
    border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border));
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  h2 {
    margin: 0;
  }

  .slots {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .slots li,
  .total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--magic) 10%, transparent);
  }

  .total {
    background: none;
    border-top: 1px solid var(--border);
    border-radius: 0;
    font-weight: 700;
  }

  .gain {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--gold);
  }

  .primary {
    background: var(--grad-primary);
    border: none;
    color: #fff;
    font-weight: 600;
    padding: 10px;
    border-radius: var(--radius-sm);
  }

  .muted {
    color: var(--muted);
  }

  .small {
    font-size: 0.85rem;
  }

  p {
    margin: 0;
  }
</style>
