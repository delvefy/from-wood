<script lang="ts">
  import Icon from './Icon.svelte';
  import type { TechNode } from '../engine/types';
  import { openTech } from '../util/nav';

  // Collapsed-by-default footer listing what the tab can't do yet, each with
  // a jump to the tech node that unlocks it. Kept out of the main groups so
  // browsing the playable list never scrolls past locked entries.
  let { items }: { items: { id: string; name: string; tech?: TechNode }[] } = $props();

  let open = $state(false);

  const branchLabel = {
    magic: '✦ Magic',
    tech: '⚙ Tech',
    magitech: '⚡ Magitech',
    prestige: '🏗 Expansion', // unreachable today (prestige nodes unlock nothing), keeps the map total
  } as const;
</script>

{#if items.length > 0}
  <button class="head" aria-expanded={open} onclick={() => (open = !open)}>
    <span>🔒 Locked</span>
    <span class="muted">{items.length} {open ? '▾' : '▸'}</span>
  </button>
  {#if open}
    <div class="list">
      {#each items as item (item.id)}
        <div class="row">
          <span class="icon"><Icon id={item.id} /></span>
          <span class="name">{item.name}</span>
          {#if item.tech}
            {@const tech = item.tech}
            <button class="hint link" title="Show {tech.name} in the research tree" onclick={() => openTech(tech.id)}>
              <span class="branch {tech.branch}">{branchLabel[tech.branch]}</span>
              <strong>{tech.name}</strong>
            </button>
          {:else}
            <span class="hint muted">Not available yet</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-top: 14px;
    padding: 8px 12px;
    background: transparent;
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    color: var(--muted);
    font-weight: 600;
    text-align: left;
  }

  .list {
    margin-top: 6px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 6px 12px;
    opacity: 0.7;
  }

  .row + .row {
    border-top: 1px solid var(--border);
  }

  .icon {
    font-size: 1.1rem;
    line-height: 1;
    filter: grayscale(1);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  /* The hint is a tap target that jumps to the tech node. */
  button.hint {
    min-height: 0;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 0.75rem;
    color: var(--muted);
  }

  .hint.link strong {
    color: var(--text);
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }

  .branch {
    padding: 1px 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    font-size: 0.68rem;
  }

  .branch.magic {
    color: var(--magic);
    border-color: var(--magic);
  }

  .branch.tech {
    color: var(--tech);
    border-color: var(--tech);
  }

  .branch.magitech {
    color: var(--magitech);
    border-color: var(--magitech);
  }
</style>
