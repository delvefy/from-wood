<script lang="ts">
  import { searchFilters, setSearch } from '../util/nav';

  let { view, placeholder = 'Search…' }: { view: string; placeholder?: string } = $props();
</script>

<div class="search">
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
