<script lang="ts">
  import { TECH } from '../content/tech';
  import { buyTech } from '../engine/actions';
  import { game } from '../engine/state';
  import { formatNumber } from '../util/format';
  import type { TechNode } from '../engine/types';

  // Layout: 3 columns in a 300-unit-wide coordinate space (stretched to 100%
  // width via preserveAspectRatio="none" so SVG edges line up with CSS nodes).
  const COLS = 3;
  const CELL_W = 100;
  const ROW_H = 132;
  const NODE_H = 116;

  const rows = Math.max(...TECH.map((t) => t.row)) + 1;

  const edges = TECH.flatMap((node) =>
    node.requires.map((parentId) => {
      const parent = TECH.find((t) => t.id === parentId)!;
      return {
        id: `${parentId}->${node.id}`,
        parentId,
        x1: (parent.col + 0.5) * CELL_W,
        y1: parent.row * ROW_H + NODE_H,
        x2: (node.col + 0.5) * CELL_W,
        y2: node.row * ROW_H,
      };
    }),
  );

  type Status = 'owned' | 'available' | 'locked';

  function status(node: TechNode): Status {
    if ($game.unlockedTech.includes(node.id)) return 'owned';
    if (node.requires.every((r) => $game.unlockedTech.includes(r))) return 'available';
    return 'locked';
  }
</script>

<p class="points">🔬 {formatNumber(Math.floor($game.researchPoints * 10) / 10)} research points</p>

<div class="tree" style="height: {rows * ROW_H}px">
  <svg viewBox="0 0 {COLS * CELL_W} {rows * ROW_H}" preserveAspectRatio="none" aria-hidden="true">
    {#each edges as e (e.id)}
      <line
        x1={e.x1}
        y1={e.y1}
        x2={e.x2}
        y2={e.y2}
        class:done={$game.unlockedTech.includes(e.parentId)}
      />
    {/each}
  </svg>
  {#each TECH as node (node.id)}
    {@const st = status(node)}
    <button
      class="node {st}"
      class:affordable={st === 'available' && $game.researchPoints >= node.cost}
      disabled={st !== 'available' || $game.researchPoints < node.cost}
      style="left: calc({node.col} * 100% / {COLS}); top: {node.row * ROW_H}px; height: {NODE_H}px"
      onclick={() => buyTech(node.id)}
    >
      <span class="tname">{node.name}</span>
      <span class="tdesc">{node.description}</span>
      <span class="tcost">{st === 'owned' ? '✓ Done' : `🔬 ${node.cost}`}</span>
    </button>
  {/each}
</div>

<style>
  .points {
    margin: 0 0 10px;
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
  }

  .tree {
    position: relative;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  line {
    stroke: var(--border);
    stroke-width: 2;
  }

  line.done {
    stroke: var(--accent-dark);
  }

  .node {
    position: absolute;
    width: calc(100% / 3 - 8px);
    margin: 0 4px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 6px;
    background: var(--panel);
    text-align: center;
  }

  .node:disabled {
    opacity: 1;
  }

  .node.locked {
    opacity: 0.45;
  }

  .node.owned {
    border-color: var(--accent-dark);
    background: var(--panel-2);
  }

  .node.affordable {
    border-color: var(--accent);
    box-shadow: 0 0 8px rgb(143 209 102 / 25%);
  }

  .tname {
    font-weight: 600;
    font-size: 0.8rem;
  }

  .tdesc {
    font-size: 0.68rem;
    color: var(--muted);
  }

  .tcost {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }

  .node.owned .tcost {
    color: var(--accent);
  }
</style>
