<script lang="ts">
  import ProgressBar from './ProgressBar.svelte';
  import { RESOURCE_BY_ID } from '../content/resources';
  import { TECH, TECH_BY_ID } from '../content/tech';
  import { cancelResearch, queueResearch } from '../engine/actions';
  import { game } from '../engine/state';
  import { canAfford } from '../engine/tick';
  import type { TechNode } from '../engine/types';

  // ---- Camera: world point at the viewport center, plus zoom -----------------
  let cam = $state({ x: 0, y: -60 });
  let zoom = $state(1);
  let vw = $state(0);
  let vh = $state(0);
  let viewportEl: HTMLDivElement | undefined = $state();

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 2.5;

  function clampZoom(z: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }

  // Zoom keeping the viewport point (sx, sy) fixed on the same world point.
  function zoomAt(sx: number, sy: number, nextZoom: number) {
    const z = clampZoom(nextZoom);
    const wx = cam.x + (sx - vw / 2) / zoom;
    const wy = cam.y + (sy - vh / 2) / zoom;
    cam.x = wx - (sx - vw / 2) / z;
    cam.y = wy - (sy - vh / 2) / z;
    zoom = z;
  }

  function recenter() {
    cam.x = 0;
    cam.y = -60;
    zoom = 1;
  }

  // ---- Pan / pinch via pointer events -----------------------------------------
  // One pointer pans; two pointers pinch-zoom around their midpoint. `moved`
  // accumulates gesture distance so a drag never triggers a node tap.
  const pointers = new Map<number, { x: number; y: number }>();
  let moved = 0;

  function localPoint(e: { clientX: number; clientY: number }) {
    const rect = viewportEl!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) moved = 0;
  }

  function onPointerMove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    if (!prev || !viewportEl) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      cam.x -= (cur.x - prev.x) / zoom;
      cam.y -= (cur.y - prev.y) / zoom;
      moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
    } else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
        const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
        const rect = viewportEl.getBoundingClientRect();
        const m0 = { x: (prev.x + other.x) / 2 - rect.left, y: (prev.y + other.y) / 2 - rect.top };
        const m1 = { x: (cur.x + other.x) / 2 - rect.left, y: (cur.y + other.y) / 2 - rect.top };
        if (d0 > 0) zoomAt(m1.x, m1.y, zoom * (d1 / d0));
        cam.x -= (m1.x - m0.x) / zoom;
        cam.y -= (m1.y - m0.y) / zoom;
        moved += 10;
      }
    }
    pointers.set(e.pointerId, cur);
  }

  function onPointerEnd(e: PointerEvent) {
    pointers.delete(e.pointerId);
  }

  // Svelte marks wheel handlers passive, so attach manually to preventDefault
  // (otherwise the page behind the canvas scrolls/zooms).
  $effect(() => {
    const el = viewportEl;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = localPoint(e);
      zoomAt(p.x, p.y, zoom * Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  // ---- Tree data ---------------------------------------------------------------
  const edges = TECH.flatMap((node) =>
    node.requires.map((parentId) => {
      const parent = TECH_BY_ID[parentId]!;
      return {
        id: `${parentId}->${node.id}`,
        parentId,
        branch: node.branch,
        x1: parent.x,
        y1: parent.y,
        x2: node.x,
        y2: node.y,
      };
    }),
  );

  type Status = 'owned' | 'active' | 'queued' | 'available' | 'locked';

  function status(node: TechNode): Status {
    if ($game.unlockedTech.includes(node.id)) return 'owned';
    if ($game.researchQueue[0] === node.id) return 'active';
    if ($game.researchQueue.includes(node.id)) return 'queued';
    const satisfied = node.requires.every(
      (r) => $game.unlockedTech.includes(r) || $game.researchQueue.includes(r),
    );
    return satisfied ? 'available' : 'locked';
  }

  function tap(node: TechNode, st: Status) {
    if (moved > 8) return; // was a pan, not a tap
    if (st === 'available') queueResearch(node.id);
    else if (st === 'active' || st === 'queued') cancelResearch(node.id);
  }

  const activeNode = $derived(
    $game.researchQueue.length > 0 ? TECH_BY_ID[$game.researchQueue[0]] : null,
  );
</script>

<div class="wrap">
  <div class="slot">
    {#if activeNode}
      <div class="slot-head">
        <span>🔬 Researching: <strong>{activeNode.name}</strong></span>
        <span class="muted">{Math.ceil(activeNode.researchTimeSeconds - $game.researchProgress)}s</span>
      </div>
      <ProgressBar value={$game.researchProgress} max={activeNode.researchTimeSeconds} />
      {#if $game.researchQueue.length > 1}
        <div class="queue">
          {#each $game.researchQueue.slice(1) as id, i (id)}
            <button class="qchip" onclick={() => cancelResearch(id)}>
              {i + 2}. {TECH_BY_ID[id]?.name ?? id} ✕
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      <span class="muted">🔬 Research slot idle — tap an available node to queue it.</span>
    {/if}
  </div>

  <div
    class="viewport"
    role="application"
    aria-label="Skill tree canvas — drag to pan, pinch or scroll to zoom"
    bind:this={viewportEl}
    bind:clientWidth={vw}
    bind:clientHeight={vh}
    onpointerdown={onPointerDown}
  >
    <div
      class="world"
      style="transform: translate({vw / 2 - cam.x * zoom}px, {vh / 2 - cam.y * zoom}px) scale({zoom})"
    >
      <svg class="edges" aria-hidden="true">
        {#each edges as e (e.id)}
          <line
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            class="edge {e.branch}"
            class:done={$game.unlockedTech.includes(e.parentId)}
          />
        {/each}
      </svg>
      {#each TECH as node (node.id)}
        {@const st = status(node)}
        <button
          class="node {st} {node.branch}"
          class:major={node.major}
          disabled={st === 'owned' || st === 'locked' || (st === 'available' && !canAfford($game, node.cost))}
          style="left: {node.x}px; top: {node.y}px"
          onclick={() => tap(node, st)}
        >
          <span class="tname">{node.name}</span>
          <span class="tdesc">{node.description}</span>
          {#if st === 'available' || st === 'locked'}
            <span class="tprice">
              {#each Object.entries(node.cost) as [id, n] (id)}
                <span class="pitem" class:short={($game.resources[id] ?? 0) < n}>
                  {RESOURCE_BY_ID[id]?.icon}{n}
                </span>
              {/each}
            </span>
          {/if}
          <span class="tcost">
            {#if st === 'owned'}
              ✓ Done
            {:else if st === 'active'}
              {Math.ceil(node.researchTimeSeconds - $game.researchProgress)}s… ✕
            {:else if st === 'queued'}
              Queued #{$game.researchQueue.indexOf(node.id) + 1} ✕
            {:else}
              ⏱ {node.researchTimeSeconds}s
            {/if}
          </span>
          {#if st === 'active'}
            <ProgressBar value={$game.researchProgress} max={node.researchTimeSeconds} />
          {/if}
        </button>
      {/each}
    </div>

    <span class="legend magic-l">✦ Magic</span>
    <span class="legend magitech-l">⚡ Magitech</span>
    <span class="legend tech-l">⚙ Tech</span>

    <div class="zoom-controls">
      <button aria-label="Zoom in" onclick={() => zoomAt(vw / 2, vh / 2, zoom * 1.25)}>+</button>
      <button aria-label="Zoom out" onclick={() => zoomAt(vw / 2, vh / 2, zoom / 1.25)}>−</button>
      <button aria-label="Recenter" onclick={recenter}>⌖</button>
    </div>
  </div>
</div>

<svelte:window onpointermove={onPointerMove} onpointerup={onPointerEnd} onpointercancel={onPointerEnd} />

<style>
  .wrap {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .slot {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    font-size: 0.9rem;
  }

  .slot-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .queue {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .qchip {
    min-height: 32px;
    padding: 2px 12px;
    border-radius: 999px;
    font-size: 0.75rem;
    color: var(--muted);
  }

  .viewport {
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    /* faint circuit-dot grid over the arcane backdrop */
    background:
      radial-gradient(
          circle,
          color-mix(in srgb, var(--border) 60%, transparent) 1px,
          transparent 1.5px
        )
        0 0 / 26px 26px,
      radial-gradient(500px 320px at 0% 0%, var(--bg-glow-1), transparent 70%),
      radial-gradient(500px 320px at 100% 100%, var(--bg-glow-2), transparent 70%),
      var(--bg);
    touch-action: none;
    cursor: grab;
  }

  .world {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
  }

  .edges {
    position: absolute;
    left: 0;
    top: 0;
    width: 1px;
    height: 1px;
    overflow: visible;
  }

  .edge {
    stroke: var(--border);
    stroke-width: 2;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }

  .edge.done {
    stroke-width: 3;
  }

  .edge.done.magic {
    stroke: var(--magic);
  }

  .edge.done.tech {
    stroke: var(--tech);
  }

  .edge.done.magitech {
    stroke: var(--magitech);
  }

  .node {
    position: absolute;
    width: 108px;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    padding: 8px 6px 6px;
    background: var(--panel);
    border-radius: var(--radius-sm);
    overflow: hidden;
    text-align: center;
  }

  .node.major {
    width: 132px;
    padding: 12px 8px 10px;
    border-radius: var(--radius);
  }

  /* branch stripe along the top edge */
  .node::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
  }

  .node.magic::before {
    background: var(--magic);
  }

  .node.tech::before {
    background: var(--tech);
  }

  .node.magitech::before {
    background: var(--magitech);
  }

  .node:disabled {
    opacity: 1;
  }

  .node.locked {
    opacity: 0.45;
  }

  .node.owned {
    border-color: var(--accent-dark);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--accent-dark) 14%, var(--panel-2)),
      var(--panel-2)
    );
  }

  .node.available {
    border-color: var(--accent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 40%, transparent);
  }

  .node.active {
    border-color: var(--science);
    box-shadow: 0 0 14px color-mix(in srgb, var(--science) 50%, transparent);
  }

  .node.queued {
    border-color: var(--science);
    border-style: dashed;
  }

  .tname {
    font-weight: 600;
    font-size: 0.72rem;
  }

  .node.major .tname {
    font-size: 0.8rem;
  }

  .tdesc {
    font-size: 0.62rem;
    color: var(--muted);
  }

  .tprice {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
  }

  .pitem {
    font-size: 0.65rem;
    padding: 1px 6px;
    background: var(--panel-2);
    border-radius: 999px;
    white-space: nowrap;
  }

  .pitem.short {
    color: var(--danger);
  }

  .tcost {
    font-size: 0.66rem;
    font-variant-numeric: tabular-nums;
  }

  .node.owned .tcost {
    color: var(--accent);
  }

  .legend {
    position: absolute;
    top: 6px;
    font-size: 0.68rem;
    pointer-events: none;
  }

  .legend.magic-l {
    left: 8px;
    color: var(--magic);
  }

  .legend.magitech-l {
    left: 50%;
    transform: translateX(-50%);
    color: var(--magitech);
  }

  .legend.tech-l {
    right: 8px;
    color: var(--tech);
  }

  .zoom-controls {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .zoom-controls button {
    width: 36px;
    min-height: 36px;
    padding: 0;
    font-size: 1rem;
    line-height: 1;
  }
</style>
