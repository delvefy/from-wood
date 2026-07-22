<script lang="ts">
  import Icon from './Icon.svelte';
  import SearchBox from './SearchBox.svelte';
  import { CATEGORY_ORDER, RECIPES } from '../content/recipes';
  import { RESOURCE_BY_ID } from '../content/resources';
  import { techTree } from '../content/tech';
  import { CRAFTER } from '../content/workers';
  import {
    assignAllCrafters,
    assignCrafter,
    idleCrafters,
    unassignAllCrafters,
  } from '../engine/actions';
  import { account } from '../engine/account';
  import { craftTimeFactor, totalCrafters } from '../engine/premium';
  import { computeFlowRates, netRate, secondsToDry } from '../engine/rates';
  import { game } from '../engine/state';
  import { collapsed, isCollapsed, toggleCollapsed } from '../util/collapse';
  import { formatDuration, formatNumber } from '../util/format';
  import { holdRepeat } from '../util/holdRepeat';
  import { openMaterial, openTech, searchFilters } from '../util/nav';
  import { rawCost } from '../util/rawCost';
  import { settings } from '../util/settings';
  import type { Recipe } from '../engine/types';

  // The tech node whose research unlocks each recipe (for the locked hint).
  // Unlock effects live on majors, which are identical in both mode trees, so
  // the village tree serves as the lookup for either mode.
  const unlockedBy = new Map(
    techTree('main').flatMap((t) =>
      t.effects.filter((e) => e.kind === 'unlockRecipe').map((e) => [e.id, t] as const),
    ),
  );

  const branchLabel = {
    magic: '✦ Magic',
    tech: '⚙ Tech',
    magitech: '⚡ Magitech',
  } as const;

  const query = $derived(($searchFilters.craft ?? '').trim().toLowerCase());

  // "Staffed only" narrows the list to recipes with crafters assigned — with
  // ~200 recipes, finding the handful that are actually running is the most
  // common scan. Local state: leaving the tab resets it, same as search.
  let staffedOnly = $state(false);
  const staffedCount = $derived(
    RECIPES.filter((r) => ($game.craftAssignment[r.id] ?? 0) > 0).length,
  );

  // A recipe matches on its own name or on any output OR input material's
  // name — filtering for an item surfaces both the recipes that produce it
  // and the recipes that consume it.
  function matchesQuery(recipe: Recipe, q: string): boolean {
    if (!q) return true;
    if (recipe.name.toLowerCase().includes(q)) return true;
    return [...Object.keys(recipe.outputs), ...Object.keys(recipe.inputs)].some((id) =>
      (RESOURCE_BY_ID[id]?.name ?? '').toLowerCase().includes(q),
    );
  }

  const groups = $derived(
    CATEGORY_ORDER.map((cat) => {
      // Locked recipes can't be staffed, so the staffed filter empties them too.
      const recipes = RECIPES.filter(
        (r) =>
          r.category === cat.id &&
          matchesQuery(r, query) &&
          (!staffedOnly || ($game.craftAssignment[r.id] ?? 0) > 0),
      );
      return {
        ...cat,
        unlocked: recipes.filter((r) => $game.unlockedRecipes.includes(r.id)),
        locked: recipes.filter((r) => !$game.unlockedRecipes.includes(r.id)),
      };
    }).filter((g) => g.unlocked.length > 0 || g.locked.length > 0),
  );
  const anyUnlocked = $derived($game.unlockedRecipes.length > 0);
  const idle = $derived(idleCrafters($game));

  // Global per-material flow (gatherers + all staffed recipes), driving the
  // net-drain tint, "dry in" countdown, and starvation warning per card.
  const rates = $derived(computeFlowRates($game, $account));

  // Tooltip suffix for a staffed recipe's input: this card's own draw plus
  // the material's economy-wide balance.
  function flowLabel(id: string, drain: number): string {
    const net = netRate(rates, id);
    let text = ` · using ${formatNumber(drain)}/s here · net ${net < 0 ? '−' : '+'}${formatNumber(Math.abs(net))}/s`;
    const dry = secondsToDry($game, rates, id);
    if (Number.isFinite(dry)) text += ` · dry in ~${formatDuration(dry)}`;
    return text;
  }

  // Raw-cost summary for the output chip's tooltip — the visible raw ≈ line
  // went away when cards tightened to two rows.
  function rawLabel(raw: [string, number][]): string {
    if (!raw.length) return '';
    const parts = raw.map(([id, n]) => `${formatNumber(Math.ceil(n))} ${RESOURCE_BY_ID[id]?.name ?? id}`);
    return ` · raw ≈ ${parts.join(', ')}`;
  }

  // Every recipe outputs exactly one item type; its icon stands in for the recipe.
  const outputId = (recipe: Recipe) => Object.keys(recipe.outputs)[0];

  // Raw cost is static per recipe; shown only for recipes with crafted inputs.
  function rawEntries(recipeId: string): [string, number][] {
    const recipe = RECIPES.find((r) => r.id === recipeId)!;
    const hasCraftedInput = Object.keys(recipe.inputs).some(
      (id) => (RESOURCE_BY_ID[id]?.harvestAmount ?? 0) === 0,
    );
    if (!hasCraftedInput) return [];
    return Object.entries(rawCost(recipe));
  }
</script>

{#if !anyUnlocked}
  <p class="muted empty">No recipes yet — research <strong>Woodworking</strong> to unlock crafting.</p>
{:else}
  <SearchBox view="craft" placeholder="Search recipes & materials…" />
  <div class="slots">
    <span class="count" title="{idle} idle of {totalCrafters($game, $account)} crafters">
      <Icon id={CRAFTER.icon} tint={false} /> <strong>{idle}</strong>/{totalCrafters($game, $account)} idle
    </span>
    <button
      class="staffed"
      class:on={staffedOnly}
      disabled={staffedCount === 0 && !staffedOnly}
      title="Show only recipes with crafters assigned"
      onclick={() => (staffedOnly = !staffedOnly)}
    >
      ⚒ {staffedCount} active
    </button>
    <button onclick={unassignAllCrafters}>Unassign all</button>
    <button class="fill" disabled={idle <= 0} onclick={assignAllCrafters}>Assign evenly</button>
  </div>
{/if}
<div class="groups">
  {#if staffedOnly && groups.length === 0}
    <p class="muted empty">No staffed recipes{query ? ' match the search' : ''} — assign crafters to see them here.</p>
  {/if}
  {#each groups as group (group.id)}
    <button class="group-head" onclick={() => toggleCollapsed('craft', group.id)}>
      <span>{group.icon} {group.label}</span>
      <span class="muted">
        {group.unlocked.length}/{group.unlocked.length + group.locked.length}
        {isCollapsed($collapsed, 'craft', group.id) ? '▸' : '▾'}
      </span>
    </button>
    {#if query || staffedOnly || !isCollapsed($collapsed, 'craft', group.id)}
      <div class="list">
        {#each group.unlocked as recipe (recipe.id)}
            {@const assigned = $game.craftAssignment[recipe.id] ?? 0}
            {@const duration = recipe.craftTimeSeconds * craftTimeFactor($account)}
            {@const raw = rawEntries(recipe.id)}
            <div class="card craft">
              <button
                class="chev remove"
                aria-label="Unassign a crafter from {recipe.name}"
                disabled={assigned <= 0}
                use:holdRepeat={() => assignCrafter(recipe.id, -1)}
              >
                <svg viewBox="0 0 24 48" aria-hidden="true"><path d="M19 7 L7 24 L19 41" /></svg>
              </button>
              <div class="mid">
                <div class="title">
                  <span class="icon"><Icon id={outputId(recipe)} /></span>
                  <span class="name">{recipe.name}</span>
                  <span class="amount">{formatNumber($game.resources[outputId(recipe)] ?? 0)}</span>
                  <span class="crew" class:idle={assigned <= 0}>
                    <Icon id={CRAFTER.icon} tint={false} /><strong>{assigned}</strong>
                  </span>
                </div>
                <!-- Icon-only chips keep the recipe to one row; the material
                     name lives in the tooltip and (with links on) the tap. -->
                <!-- Unstaffed: the plain recipe ratio (2 🪵 → 1 🪧). Staffed: pure
                     flow (−x/s → +x/s). Stock, net rate, and dry countdown live
                     in the tooltip only. -->
                <div class="io">
                  {#each Object.entries(recipe.inputs) as [id, n] (id)}
                    {@const have = $game.resources[id] ?? 0}
                    {@const drain = (assigned * n) / duration}
                    {@const draining = assigned > 0 && netRate(rates, id) < 0}
                    {@const label =
                      `${RESOURCE_BY_ID[id]?.name ?? id} — need ${n}, have ${formatNumber(have)}` +
                      (assigned > 0 ? flowLabel(id, drain) : '')}
                    {#if $settings.materialLinks}
                      <button
                        class="item link"
                        class:short={have < n}
                        class:drain={draining}
                        title={label}
                        aria-label={label}
                        onclick={() => openMaterial(id)}
                      >
                        <Icon {id} />{#if assigned > 0}−{formatNumber(drain)}/s{:else}{n}{/if}
                      </button>
                    {:else}
                      <span class="item" class:short={have < n} class:drain={draining} title={label}>
                        <Icon {id} />{#if assigned > 0}−{formatNumber(drain)}/s{:else}{n}{/if}
                      </span>
                    {/if}
                  {/each}
                  <span class="arrow">→</span>
                  {#each Object.entries(recipe.outputs) as [id, n] (id)}
                    {@const perCraft = n * $game.multipliers.craftOutput}
                    <span
                      class="item out"
                      title="{RESOURCE_BY_ID[id]?.name} — {formatNumber(perCraft)} per craft · ⏱ {formatNumber(duration)}s{rawLabel(raw)}"
                    >
                      <Icon {id} />{#if assigned > 0}+{formatNumber((assigned * perCraft) / duration)}/s{:else}{formatNumber(perCraft)}{/if}
                    </span>
                  {/each}
                </div>
              </div>
              <button
                class="chev add"
                aria-label="Assign a crafter to {recipe.name}"
                disabled={idle <= 0}
                use:holdRepeat={() => assignCrafter(recipe.id, 1)}
              >
                <svg viewBox="0 0 24 48" aria-hidden="true"><path d="M5 7 L17 24 L5 41" /></svg>
              </button>
            </div>
        {/each}
        {#each group.locked as recipe (recipe.id)}
          {@const tech = unlockedBy.get(recipe.id)}
          <div class="card dim">
            <div class="head">
              <span class="rname"><span class="grey"><Icon id={outputId(recipe)} /></span> {recipe.name}</span>
              <span class="time muted">🔒</span>
            </div>
            {#if tech}
              <button class="hint muted link" title="Show {tech.name} in the research tree" onclick={() => openTech(tech.id)}>
                Research <strong>{tech.name}</strong>
                <span class="branch {tech.branch}">{branchLabel[tech.branch]}</span>
              </button>
            {:else}
              <span class="hint muted">Unlock not available yet</span>
            {/if}
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

  .slots {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 6px 6px 12px;
    margin-bottom: 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    font-size: 0.9rem;
  }

  .count {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-right: auto;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .slots button {
    min-height: 36px;
    padding: 0 10px;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .slots .staffed {
    border-radius: var(--radius-pill);
    font-variant-numeric: tabular-nums;
  }

  .slots .staffed.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 16%, var(--panel));
    color: var(--accent);
    font-weight: 600;
  }

  .slots .fill {
    background: var(--grad-primary);
    border: none;
    color: #fff;
    font-weight: 600;
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
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--magic) 12%, var(--panel-2)),
      color-mix(in srgb, var(--tech) 12%, var(--panel-2))
    );
    border: 1px solid var(--border);
    border-radius: var(--radius);
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
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  /* Craft cards: chevron rails on the edges, info centered between them. */
  .card.craft {
    display: grid;
    grid-template-columns: 52px 1fr 52px;
    align-items: stretch;
    gap: 0;
    padding: 0;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }

  .chev {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 0;
    background: color-mix(in srgb, var(--panel-2) 55%, transparent);
    color: var(--accent);
    touch-action: none;
    -webkit-touch-callout: none;
  }

  .chev.remove {
    border-right: 1px solid var(--border);
    color: var(--danger);
  }

  .chev.add {
    border-left: 1px solid var(--border);
  }

  .chev svg {
    width: 20px;
    height: 40px;
    transition: transform 0.08s ease;
  }

  .chev path {
    fill: none;
    stroke: currentColor;
    stroke-width: 5;
    stroke-linejoin: miter;
    stroke-linecap: butt;
  }

  .chev:not(:disabled):active {
    transform: none; /* the global button squish moves the whole rail; scale the arrow instead */
    background: color-mix(in srgb, currentColor 16%, transparent);
  }

  .chev:not(:disabled):active svg {
    transform: scale(0.8);
  }

  .chev:disabled {
    opacity: 1;
    color: color-mix(in srgb, var(--muted) 40%, transparent);
    background: transparent;
  }

  .mid {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    padding: 7px 8px;
    text-align: center;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .icon {
    font-size: 1.2rem;
    line-height: 1;
  }

  .name {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .amount {
    font-size: 0.95rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--accent);
  }

  .io {
    justify-content: center;
  }

  /* Crafter count rides the title row; dimmed while the recipe is unstaffed. */
  .crew {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: 4px;
    font-size: 0.8rem;
  }

  .crew strong {
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }

  .crew.idle {
    opacity: 0.5;
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
    gap: 5px;
    font-size: 0.85rem;
  }

  .item {
    padding: 2px 8px;
    background: var(--panel-2);
    border-radius: var(--radius-pill);
    white-space: nowrap;
  }

  /* Input chips become tappable material links when the setting is on. */
  button.item {
    min-height: 0;
    border: none;
    font: inherit;
    color: inherit;
  }

  .item.link {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }

  /* Staffed flow tints: amber while the material drains economy-wide; the
     red "can't afford a craft" state below wins when both apply. */
  .item.drain {
    color: var(--gold);
  }

  .item.short {
    color: var(--danger);
  }

  .item.out {
    border: 1px solid var(--accent-dark);
    box-shadow: 0 0 6px color-mix(in srgb, var(--accent-dark) 35%, transparent);
  }

  .arrow {
    color: var(--muted);
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

  /* The locked hint is a tap target that jumps to the tech node. */
  button.hint {
    min-height: 0;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    text-align: left;
  }

  .hint.link strong {
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
