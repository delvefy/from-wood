<script lang="ts">
  import { game } from '../engine/state';
  import { dismissGuide, settings } from '../util/settings';
  import { openTech } from '../util/nav';

  // The opening chain the guide walks: root → its tech-path small → the
  // first crafting unlock. Ids match content/tech (paths.ts names, slugified).
  const ROOT = 'basic_tools';
  const OPENER = 'sharp_tools';
  const CRAFTING = 'woodworking';

  const owned = $derived(new Set([...$game.unlockedTech, ...$game.researchQueue]));
  const assignedAny = $derived(Object.values($game.gatherAssignment).some((n) => n > 0));
  const gatheredAny = $derived(($game.resources.wood ?? 0) > 0 || ($game.resources.water ?? 0) > 0);

  const step1Done = $derived(assignedAny || gatheredAny);
  const step2Done = $derived(owned.has(ROOT));
  const step3Done = $derived(owned.has(CRAFTING));

  const show = $derived(!$settings.guideDismissed && !step3Done);
  const nextTech = $derived(!step2Done ? ROOT : !owned.has(OPENER) ? OPENER : CRAFTING);

  // Once crafting is unlocked the player has the loop — retire the guide for
  // good so fresh tournament runs don't resurface it.
  $effect(() => {
    if (step3Done && !$settings.guideDismissed) dismissGuide();
  });
</script>

{#if show}
  <div class="guide">
    <div class="head">
      <strong>First steps</strong>
      <button class="dismiss" aria-label="Dismiss guide" onclick={dismissGuide}>✕</button>
    </div>
    <ol>
      <li class:done={step1Done}>
        <span class="mark">{step1Done ? '✓' : '1'}</span>
        Put your gatherer to work — tap <strong>+</strong> on Wood or Water.
      </li>
      <li class:done={step2Done}>
        <span class="mark">{step2Done ? '✓' : '2'}</span>
        Research <strong>Basic Tools</strong> (10 wood + 10 water — move your gatherer
        between the two).
      </li>
      <li>
        <span class="mark">3</span>
        Research <strong>Sharp Tools</strong>, then <strong>Woodworking</strong> to start
        crafting.
      </li>
    </ol>
    {#if step1Done}
      <button class="go" onclick={() => openTech(nextTech)}>▶ Show me the next research</button>
    {/if}
  </div>
{/if}

<style>
  .guide {
    background: var(--panel);
    border: 1px solid color-mix(in srgb, var(--magic) 40%, var(--border));
    border-radius: var(--radius);
    padding: 10px 12px;
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dismiss {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 0.9rem;
    padding: 4px 8px;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 0.85rem;
  }

  li.done {
    color: var(--muted);
    text-decoration: line-through;
  }

  .mark {
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid var(--border);
    font-size: 0.7rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transform: translateY(2px);
  }

  li.done .mark {
    border-color: color-mix(in srgb, var(--magic) 50%, var(--border));
    color: var(--magic);
  }

  .go {
    align-self: flex-start;
    background: none;
    border: 1px solid color-mix(in srgb, var(--magic) 45%, var(--border));
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 0.85rem;
    font-weight: 600;
    padding: 6px 10px;
  }
</style>
