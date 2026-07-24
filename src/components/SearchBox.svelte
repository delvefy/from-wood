<script lang="ts">
  import { goBack, navTrail, searchFilters, setSearch } from '../util/nav';

  let { view, placeholder = 'Search…' }: { view: string; placeholder?: string } = $props();

  // Where the back button returns to: the previous search text, or the tab
  // name when the jump came from an unsearched view (the research tree).
  const TAB_LABEL: Record<string, string> = {
    gather: 'Gather',
    craft: 'Craft',
    research: 'Research',
    market: 'Market',
  };
  const backTo = $derived.by(() => {
    const crumb = $navTrail[$navTrail.length - 1];
    if (!crumb) return null;
    return crumb.search || TAB_LABEL[crumb.tab] || crumb.tab;
  });
</script>

<div class="search">
  {#if backTo}
    <button class="back" aria-label="Back to {backTo}" onclick={goBack}>← {backTo}</button>
  {/if}
  <span class="glass" aria-hidden="true">🔍</span>
  <input
    type="search"
    {placeholder}
    value={$searchFilters[view] ?? ''}
    oninput={(e) => setSearch(view, e.currentTarget.value)}
  />
  {#if ($searchFilters[view] ?? '') !== ''}
    <button class="clear" aria-label="Clear search" onclick={() => setSearch(view, '')}>✕</button>
  {/if}
</div>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    margin-bottom: 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .back {
    min-height: 28px;
    max-width: 38%;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    color: var(--accent);
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .glass {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  input {
    flex: 1;
    min-width: 0;
    min-height: 42px;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    outline: none;
  }

  input::placeholder {
    color: var(--muted);
  }

  input::-webkit-search-cancel-button {
    display: none;
  }

  .clear {
    min-height: 28px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>
