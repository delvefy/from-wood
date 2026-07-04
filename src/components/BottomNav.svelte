<script module lang="ts">
  export type Tab = 'gather' | 'craft' | 'research' | 'market';
</script>

<script lang="ts">
  let { tab, onchange }: { tab: Tab; onchange: (tab: Tab) => void } = $props();

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'gather', icon: '🪵', label: 'Gather' },
    { id: 'craft', icon: '🛠️', label: 'Craft' },
    { id: 'research', icon: '🔬', label: 'Research' },
    { id: 'market', icon: '🪙', label: 'Market' },
  ];
</script>

<nav>
  {#each tabs as t (t.id)}
    <button class:active={tab === t.id} onclick={() => onchange(t.id)}>
      <span class="icon">{t.icon}</span>
      <span class="label">{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  nav {
    flex: none;
    display: flex;
    background: var(--panel);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom);
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
    border: none;
    color: var(--muted);
  }

  button.active {
    color: var(--accent);
  }

  .icon {
    font-size: 1.3rem;
    line-height: 1;
  }

  .label {
    font-size: 0.7rem;
  }
</style>
