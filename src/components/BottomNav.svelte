<script lang="ts">
  import Icon from './Icon.svelte';
  import { idleCrafters, idleWorkers } from '../engine/actions';
  import { gameMode } from '../engine/mode';
  import { researchWaiting } from '../engine/research';
  import { game } from '../engine/state';
  import { activeTab, type Tab } from '../util/nav';

  // `icon` is an ICON_PATHS id (icon-map.json), rendered via <Icon>.
  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'gather', icon: 'ui_gather', label: 'Gather' },
    { id: 'craft', icon: 'ui_craft', label: 'Craft' },
    { id: 'research', icon: 'ui_research', label: 'Research' },
    { id: 'market', icon: 'ui_market', label: 'Market' },
  ];

  // Attention badges: idle crew is a count (workers doing nothing right now),
  // research is a plain dot — the slot is free and something is affordable.
  const idleGather = $derived(Math.max(0, Math.floor(idleWorkers($game))));
  const idleCraft = $derived(Math.max(0, Math.floor(idleCrafters($game))));
  const researchReady = $derived(researchWaiting($game, $gameMode));

  const badgeCount = (tab: Tab): number =>
    tab === 'gather' ? idleGather : tab === 'craft' ? idleCraft : 0;

  // 99+ keeps the pill from stretching the tab on a late-game crew.
  const badgeText = (n: number): string => (n > 99 ? '99+' : String(n));
</script>

<nav>
  {#each tabs as t (t.id)}
    {@const count = badgeCount(t.id)}
    {@const dot = t.id === 'research' && researchReady}
    <button class:active={$activeTab === t.id} onclick={() => activeTab.set(t.id)}>
      <span class="icon">
        <Icon id={t.icon} tint={false} />
        {#if count > 0}
          <span class="badge" aria-hidden="true">{badgeText(count)}</span>
        {:else if dot}
          <span class="badge dot" aria-hidden="true"></span>
        {/if}
      </span>
      <span class="label">{t.label}</span>
      {#if count > 0}
        <span class="sr">{count} idle</span>
      {:else if dot}
        <span class="sr">research available</span>
      {/if}
    </button>
  {/each}
</nav>

<style>
  nav {
    flex: none;
    display: flex;
    gap: 4px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--magic) 8%, var(--panel)),
      color-mix(in srgb, var(--tech) 8%, var(--panel))
    );
    border-top: 1px solid var(--border);
  }

  button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 0 6px;
    min-height: 56px;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius);
    color: var(--muted);
  }

  button.active {
    color: var(--text);
    border-color: color-mix(in srgb, var(--magic) 45%, var(--border));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--magic) 18%, transparent),
      color-mix(in srgb, var(--tech) 18%, transparent)
    );
    box-shadow: 0 0 12px color-mix(in srgb, var(--magic) 25%, transparent);
  }

  .icon {
    position: relative;
    font-size: 1.3rem;
    line-height: 1;
  }

  /* Sits on the icon's top-right corner, outside its box, so it reads as a
     notification badge rather than part of the glyph. */
  .badge {
    position: absolute;
    top: -5px;
    left: 100%;
    transform: translateX(-40%);
    min-width: 16px;
    padding: 0 4px;
    font-size: 0.62rem;
    font-weight: 700;
    line-height: 16px;
    text-align: center;
    color: #fff;
    background: var(--danger);
    border-radius: var(--radius-pill);
    box-shadow: 0 0 0 2px var(--panel);
  }

  .badge.dot {
    min-width: 9px;
    height: 9px;
    padding: 0;
    top: -2px;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
</style>
