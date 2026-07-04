<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  import { CATEGORY_ORDER, RECIPES } from '../content/recipes';
  import { RESOURCE_BY_ID } from '../content/resources';
  import { TECH } from '../content/tech';
  import { affordableRuns, cancelCraftQueue, startCraft } from '../engine/actions';
  import { game } from '../engine/state';
  import { canAfford } from '../engine/tick';
  import { formatNumber } from '../util/format';
  import { rawCost } from '../util/rawCost';

  // The tech node whose research unlocks each recipe (for the locked hint).
  const unlockedBy = new Map(
    TECH.flatMap((t) =>
      t.effects.filter((e) => e.kind === 'unlockRecipe').map((e) => [e.id, t] as const),
    ),
  );

  const branchLabel = {
    magic: '✦ Magic',
    tech: '⚙ Tech',
    magitech: '⚡ Magitech',
  } as const;

  const groups = $derived(
    CATEGORY_ORDER.map((cat) => {
      const recipes = RECIPES.filter((r) => r.category === cat.id);
      return {
        ...cat,
        unlocked: recipes.filter((r) => $game.unlockedRecipes.includes(r.id)),
        locked: recipes.filter((r) => !$game.unlockedRecipes.includes(r.id)),
      };
    }).filter((g) => g.unlocked.length > 0 || g.locked.length > 0),
  );
  const anyUnlocked = $derived(groups.some((g) => g.unlocked.length > 0));

  let collapsed = $state(new Set<string>());

  function toggle(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed = next;
  }

  // Raw line is static per recipe; shown only for recipes with crafted inputs.
  function rawLine(recipeId: string): string {
    const recipe = RECIPES.find((r) => r.id === recipeId)!;
    const raws = rawCost(recipe);
    const hasCraftedInput = Object.keys(recipe.inputs).some(
      (id) => (RESOURCE_BY_ID[id]?.harvestAmount ?? 0) === 0,
    );
    if (!hasCraftedInput) return '';
    return Object.entries(raws)
      .map(([id, n]) => `${RESOURCE_BY_ID[id]?.icon}${formatNumber(Math.ceil(n))}`)
      .join(' ');
  }
</script>

{#if !anyUnlocked}
  <p class="muted empty">No recipes yet — research <strong>Woodworking</strong> to unlock crafting.</p>
{/if}
<div class="groups">
  {#each groups as group (group.id)}
    <button class="group-head" onclick={() => toggle(group.id)}>
      <span>{group.icon} {group.label}</span>
      <span class="muted">
        {group.unlocked.length}/{group.unlocked.length + group.locked.length}
        {collapsed.has(group.id) ? '▸' : '▾'}
      </span>
    </button>
    {#if !collapsed.has(group.id)}
      <div class="list">
        {#each group.unlocked as recipe (recipe.id)}
            {@const job = $game.craftJobs[recipe.id]}
            {@const running = job !== undefined}
            {@const queued = $game.craftRepeat[recipe.id] ?? 0}
            {@const duration = recipe.craftTimeSeconds}
            {@const affordable = affordableRuns($game, recipe.id)}
            {@const raw = rawLine(recipe.id)}
            <div class="card">
              <div class="head">
                <span class="rname">{recipe.icon} {recipe.name}</span>
                <span class="time muted">⏱ {formatNumber(duration)}s</span>
              </div>
              <div class="io">
                {#each Object.entries(recipe.inputs) as [id, n] (id)}
                  <span class="item" class:short={($game.resources[id] ?? 0) < n}>
                    {RESOURCE_BY_ID[id]?.icon}{n}
                    <small>({formatNumber($game.resources[id] ?? 0)})</small>
                  </span>
                {/each}
                <span class="arrow">→</span>
                {#each Object.entries(recipe.outputs) as [id, n] (id)}
                  <span class="item out">
                    {RESOURCE_BY_ID[id]?.icon}{formatNumber(n * $game.multipliers.craftOutput)}
                  </span>
                {/each}
              </div>
              {#if raw}
                <div class="raw muted">raw ≈ {raw}</div>
              {/if}
              {#if running}
                <div class="progress">
                  <ProgressBar value={job} max={duration} />
                  <span class="left muted">{Math.ceil(duration - job)}s</span>
                </div>
                <div class="queue">
                  {#if queued > 0}
                    <span class="muted">+{queued} queued</span>
                    <button class="cancel" onclick={() => cancelCraftQueue(recipe.id)}>✕</button>
                  {/if}
                  <button
                    class="more"
                    disabled={affordable < 1}
                    onclick={() => startCraft(recipe.id, 1)}
                  >
                    +1
                  </button>
                </div>
              {:else}
                <div class="buttons">
                  <button class="craft-btn" disabled={!canAfford($game, recipe.inputs)} onclick={() => startCraft(recipe.id, 1)}>
                    Craft
                  </button>
                  <button disabled={affordable < 2} onclick={() => startCraft(recipe.id, 5)}>×5</button>
                  <button disabled={affordable < 2} onclick={() => startCraft(recipe.id, 25)}>×25</button>
                </div>
              {/if}
            </div>
        {/each}
        {#each group.locked as recipe (recipe.id)}
          {@const tech = unlockedBy.get(recipe.id)}
          <div class="card dim">
            <div class="head">
              <span class="rname"><span class="grey">{recipe.icon}</span> {recipe.name}</span>
              <span class="time muted">🔒</span>
            </div>
            <span class="hint muted">
              {#if tech}
                Research <strong>{tech.name}</strong>
                <span class="branch {tech.branch}">{branchLabel[tech.branch]}</span>
              {:else}
                Unlock not available yet
              {/if}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  {/each}
</div>

<style>
  .empty {
    text-align: center;
    padding: 24px 12px;
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .group-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 12px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    font-weight: 600;
    text-align: left;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--panel);
    border: 1px solid var(--border);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .rname {
    font-weight: 600;
  }

  .time {
    font-size: 0.75rem;
  }

  .io {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
  }

  .item {
    padding: 3px 7px;
    background: var(--panel-2);
    white-space: nowrap;
  }

  .item small {
    color: var(--muted);
  }

  .item.short {
    color: var(--danger);
  }

  .item.out {
    border: 1px solid var(--accent-dark);
  }

  .arrow {
    color: var(--muted);
  }

  .raw {
    font-size: 0.75rem;
  }

  .buttons {
    display: flex;
    gap: 6px;
  }

  .buttons button {
    min-width: 44px;
  }

  .craft-btn {
    flex: 1;
    background: var(--accent-dark);
    border-color: var(--accent-dark);
    font-weight: 600;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .progress :global(.track) {
    flex: 1;
  }

  .left {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    min-width: 3.5ch;
    text-align: right;
  }

  .queue {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
  }

  .queue .more {
    margin-left: auto;
    min-width: 44px;
  }

  .queue .cancel {
    min-width: 32px;
    padding: 0 6px;
    color: var(--danger);
    border-color: var(--danger);
    background: none;
  }

  .card.dim {
    opacity: 0.55;
    gap: 4px;
    padding: 8px 12px;
  }

  .grey {
    filter: grayscale(1);
  }

  .hint {
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .branch {
    padding: 1px 6px;
    border: 1px solid var(--border);
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
