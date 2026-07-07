<script module lang="ts">
  export type Tab = 'gather' | 'craft' | 'research' | 'market';
</script>

<script lang="ts">
  let { tab, onchange }: { tab: Tab; onchange: (tab: Tab) => void } = $props();

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'gather', icon: '🪵', label: 'Gather' },
    { id: 'craft', icon: '🛠️', label: 'Craft' },
    { id: 'research', icon: '🔬', label: 'Research' },
    { id: 'market', icon: '💲', label: 'Market' },
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
    font-size: 1.3rem;
    line-height: 1;
  }

  .label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
</style>
