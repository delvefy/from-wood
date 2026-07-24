<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from './Icon.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import { RESOURCE_BY_ID } from '../content/resources';
  import { PRESTIGE_TREE, techById, techTree } from '../content/tech';
  import { queueResearch } from '../engine/actions';
  import { gameMode } from '../engine/mode';
  import { villageTreeComplete } from '../engine/prestige';
  import { game } from '../engine/state';
  import { canAfford } from '../engine/tick';
  import type { TechNode } from '../engine/types';
  import { formatDuration, formatNumber } from '../util/format';
  import { focusTech, openMaterial } from '../util/nav';
  import { settings } from '../util/settings';

  // Each mode renders its own tree: the 500-node village triangle or the
  // 100-node tournament one. Derived so a mode switch swaps the canvas live.
  // Once the village triangle is fully researched it collapses into a banner
  // (total bonuses, tap to reopen for viewing) and the canvas shows the
  // prestige Expansion tree instead.
  const villageDone = $derived($gameMode === 'main' && villageTreeComplete($game.unlockedTech));
  let showBase = $state(false);
  const prestigeView = $derived(villageDone && !showBase);
  const tree = $derived(prestigeView ? PRESTIGE_TREE : techTree($gameMode));
  const byId = $derived(techById($gameMode));

  // ---- Camera: world point at the viewport center, plus zoom -----------------
  // Persisted as a UI preference so the tree reopens where you left it.
  const CAM_KEY = 'from-wood-research-cam';

  function loadCam(): { x: number; y: number; zoom: number } | null {
    try {
      const p = JSON.parse(localStorage.getItem(CAM_KEY) ?? 'null');
      if (
        p &&
        typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        typeof p.zoom === 'number' &&
        [p.x, p.y, p.zoom].every(Number.isFinite)
      ) {
        return p;
      }
    } catch {
      // fall through to defaults
    }
    return null;
  }

  const MIN_ZOOM = 0.04; // far enough out to frame the 500-node village triangle
  const MAX_ZOOM = 2.5;

  const savedCam = loadCam();
  let cam = $state({ x: savedCam?.x ?? 0, y: savedCam?.y ?? -60 });
  let zoom = $state(clampZoom(savedCam?.zoom ?? 1));
  let vw = $state(0);
  let vh = $state(0);
  let viewportEl: HTMLDivElement | undefined = $state();

  // Debounced save while panning/zooming; final flush when leaving the tab.
  $effect(() => {
    const snapshot = JSON.stringify({ x: cam.x, y: cam.y, zoom });
    const t = setTimeout(() => localStorage.setItem(CAM_KEY, snapshot), 250);
    return () => clearTimeout(t);
  });

  onDestroy(() => {
    localStorage.setItem(CAM_KEY, JSON.stringify({ x: cam.x, y: cam.y, zoom }));
  });

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
    // The Expansion tree's first tier spans ±675px, so frame it a bit wider.
    if (prestigeView) {
      cam.x = 0;
      cam.y = -160;
      zoom = 0.55;
    } else {
      cam.x = 0;
      cam.y = -60;
      zoom = 1;
    }
  }

  // Recenter when the displayed tree swaps (base <-> Expansion) — the saved
  // camera almost certainly points at the other canvas. A focus jump that
  // swaps trees positions the camera itself, so it suppresses this once.
  let lastTree: TechNode[] | undefined;
  let focusJumped = false;
  $effect(() => {
    if (lastTree !== undefined && lastTree !== tree && !focusJumped) recenter();
    focusJumped = false;
    lastTree = tree;
  });

  // Another view asked us to show a node (locked-item "Research X" links):
  // center the camera on it and pulse it briefly so the eye lands there.
  let flashId = $state<string | null>(null);
  $effect(() => {
    const id = $focusTech;
    if (!id) return;
    focusTech.set(null);
    const node = byId[id];
    if (!node) return;
    // The target may live on the other canvas (base vs Expansion); swap first.
    const wantBase = node.branch !== 'prestige';
    if (villageDone && showBase !== wantBase) {
      focusJumped = true;
      showBase = wantBase;
    }
    cam.x = node.x;
    cam.y = node.y;
    zoom = Math.max(zoom, 1);
    flashId = id;
    // No cleanup: resetting focusTech above re-runs this effect immediately,
    // and a cleanup would cancel the timer before the pulse plays out.
    setTimeout(() => (flashId = null), 2500);
  });

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
  const edges = $derived(
    tree.flatMap((node) =>
      node.requires.map((parentId) => {
        const parent = byId[parentId]!;
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
    ),
  );

  // Cull to the camera viewport: the village tree holds 500 nodes and edges,
  // and mounting them all means every per-second state update re-diffs the
  // whole forest. Padded in world units so things slide in before their box
  // enters; covers the node's half-size plus its glow.
  const CULL_PAD = 200;
  const cullHalfW = $derived(vw / 2 / zoom + CULL_PAD);
  const cullHalfH = $derived(vh / 2 / zoom + CULL_PAD);
  const visibleNodes = $derived(
    tree.filter(
      (n) => Math.abs(n.x - cam.x) < cullHalfW && Math.abs(n.y - cam.y) < cullHalfH,
    ),
  );
  const visibleEdges = $derived(
    edges.filter(
      (e) =>
        Math.min(e.x1, e.x2) < cam.x + cullHalfW &&
        Math.max(e.x1, e.x2) > cam.x - cullHalfW &&
        Math.min(e.y1, e.y2) < cam.y + cullHalfH &&
        Math.max(e.y1, e.y2) > cam.y - cullHalfH,
    ),
  );

  // Level of detail: below this zoom a 108px card is under ~40px on screen —
  // its text is unreadable and culling no longer helps (the cull box grows as
  // 1/zoom, so far out ALL 500 cards were live DOM, and every zoom step
  // re-rasterized ~5000 styled elements). Swap to SVG mini-cards: the same
  // card silhouette at world scale (body + branch stripe, status colors), so
  // zooming out shrinks the tree instead of replacing it. Geometry is static
  // world units — nothing per-frame but the parent transform.
  const LOD_ZOOM = 0.35;
  const lod = $derived(zoom < LOD_ZOOM);
  // Very far out (whole-tree view) locked cards get less dimming: at ~4px per
  // card the near-threshold dim level fades the pyramid into the backdrop.
  const far = $derived(zoom < 0.12);
  // Mini-card world footprint, matching the DOM cards' width; height is the
  // typical rendered card height so the swap at the threshold is seamless.
  const MINI_W = 108;
  const MINI_H = 64;
  const MINI_W_MAJOR = 132;
  const MINI_H_MAJOR = 84;

  type Status = 'owned' | 'active' | 'queued' | 'available' | 'locked';

  // O(1) membership for status(): it runs per node per render, and array
  // .includes over 500 unlocked techs made every game tick re-render O(n²).
  const unlockedSet = $derived(new Set($game.unlockedTech));
  const queuedSet = $derived(new Set($game.researchQueue));

  function status(node: TechNode): Status {
    if (unlockedSet.has(node.id)) return 'owned';
    if ($game.researchQueue[0] === node.id) return 'active';
    if (queuedSet.has(node.id)) return 'queued';
    const satisfied = node.requires.every((r) => unlockedSet.has(r) || queuedSet.has(r));
    return satisfied ? 'available' : 'locked';
  }

  // Cost and duration are mode-dependent, baked into each mode's tree nodes.
  const nodeCost = (node: TechNode) => node.cost;
  const nodeTime = (node: TechNode) => node.researchTimeSeconds;

  // Research locks in when queued — no cancel, no refund.
  function tap(node: TechNode, st: Status) {
    if (moved > 8) return; // was a pan, not a tap
    if (st === 'available' && canAfford($game, nodeCost(node))) queueResearch(node.id);
  }

  function tapMaterial(e: Event, id: string, fromTech: string) {
    e.stopPropagation(); // don't also queue/cancel the node behind the chip
    if (moved > 8) return;
    openMaterial(id, fromTech);
  }

  const activeNode = $derived(
    $game.researchQueue.length > 0 ? byId[$game.researchQueue[0]] : null,
  );

  // Nodes the player can start right now: prereqs met AND affordable.
  const readyNodes = $derived(
    tree.filter((n) => status(n) === 'available' && canAfford($game, nodeCost(n))),
  );

  // Cycles through ready nodes so repeated taps tour all of them.
  let readyCycle = 0;
  function jumpToReady() {
    if (readyNodes.length === 0) return;
    focusTech.set(readyNodes[readyCycle++ % readyNodes.length].id);
  }

  // ---- Queue summary -----------------------------------------------------------
  // The queue can hold dozens of nodes; rendering them all as chips buried the
  // tree. Collapsed by default to a one-line summary; expands to a scrollable
  // list capped in height. Tapping a row jumps the camera to that node.
  let queueOpen = $state(false);

  const queuedIds = $derived($game.researchQueue.slice(1));

  const queueTotalSeconds = $derived(
    (activeNode ? nodeTime(activeNode) - $game.researchProgress : 0) +
      queuedIds.reduce((sum, id) => {
        const node = byId[id];
        return sum + (node ? nodeTime(node) : 0);
      }, 0),
  );

  function jumpToNode(id: string) {
    focusTech.set(id);
  }
</script>

<div class="wrap">
  {#if villageDone}
    <!-- The finished base tree collapses into this banner: it reports the
         total bonuses all 500 nodes add up to and reopens the old canvas
         (view-only in practice — everything in it is researched). -->
    <button class="prestige-banner" class:back={showBase} onclick={() => (showBase = !showBase)}>
      {#if showBase}
        ⬆ Back to the Expansion tree
      {:else}
        🏆 Village tree complete — gather +{Math.round(($game.multipliers.gatherAll - 1) * 100)}%,
        craft +{Math.round(($game.multipliers.craftOutput - 1) * 100)}%
        <span class="banner-hint">view tree</span>
      {/if}
    </button>
  {/if}
  <div class="slot">
    {#if activeNode}
      <div class="slot-head">
        <span>🔬 Researching: <strong>{activeNode.name}</strong></span>
        <span class="muted">{formatDuration(Math.ceil(nodeTime(activeNode) - $game.researchProgress))}</span>
      </div>
      <ProgressBar value={$game.researchProgress} max={nodeTime(activeNode)} />
      {#if queuedIds.length > 0}
        <div class="queue-bar">
          <button class="queue-toggle" onclick={() => (queueOpen = !queueOpen)}>
            <span class="caret" class:open={queueOpen}>▸</span>
            {queuedIds.length} queued · ~{formatDuration(Math.ceil(queueTotalSeconds))} total
          </button>
        </div>
        {#if queueOpen}
          <ol class="queue-list">
            {#each queuedIds as id, i (id)}
              {@const node = byId[id]}
              <li class="qrow">
                <button class="qname" title="Show in tree" onclick={() => jumpToNode(id)}>
                  <span class="qnum">{i + 2}.</span>
                  {node?.name ?? id}
                </button>
                <span class="qtime muted">{node ? formatDuration(Math.ceil(nodeTime(node))) : ''}</span>
              </li>
            {/each}
          </ol>
        {/if}
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
      <svg class="edges" class:lod class:far aria-hidden="true">
        {#each visibleEdges as e (e.id)}
          <line
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            class="edge {e.branch}"
            class:done={unlockedSet.has(e.parentId)}
          />
        {/each}
        {#if lod}
          {#each visibleNodes as node (node.id)}
            {@const st = status(node)}
            {@const w = node.major ? MINI_W_MAJOR : MINI_W}
            {@const h = node.major ? MINI_H_MAJOR : MINI_H}
            <g
              class="mini {node.branch} {st}"
              class:ready={st === 'available' && canAfford($game, nodeCost(node))}
              transform="translate({node.x}, {node.y})"
            >
              <rect class="mbody" x={-w / 2} y={-h / 2} width={w} height={h} rx="8" />
              <rect class="mstripe" x={-w / 2} y={-h / 2} width={w} height="5" />
            </g>
          {/each}
        {/if}
      </svg>
      {#each lod ? [] : visibleNodes as node (node.id)}
        {@const st = status(node)}
        {@const ready = st === 'available' && canAfford($game, nodeCost(node))}
        <!-- A div, not a button: cost chips inside must stay tappable even when
             the node itself is locked/unaffordable (disabled buttons swallow
             child clicks). tap() guards status and affordability instead. -->
        <div
          class="node {st} {node.branch}"
          class:ready
          class:major={node.major}
          class:flash={flashId === node.id}
          role="button"
          tabindex="0"
          style="left: {node.x}px; top: {node.y}px"
          onclick={() => tap(node, st)}
          onkeydown={(e) => {
            if (e.target !== e.currentTarget) return; // key events from cost chips
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              tap(node, st);
            }
          }}
        >
          <span class="tname">{node.name}</span>
          <span class="tdesc">{node.description}</span>
          <span class="tcost">
            {#if st === 'owned'}
              ✓ Done
            {:else if st === 'active'}
              {formatDuration(Math.ceil(nodeTime(node) - $game.researchProgress))}…
            {:else if st === 'queued'}
              Queued #{$game.researchQueue.indexOf(node.id) + 1}
            {:else if ready}
              ▶ Tap to research · {formatDuration(Math.ceil(nodeTime(node)))}
            {:else}
              ⏱ {formatDuration(Math.ceil(nodeTime(node)))}
            {/if}
          </span>
          <!-- Cost chips last, below the tap-to-research line: they carry their
               own tap targets (material links), so keeping them at the bottom
               edge makes them harder to hit when tapping the node itself. -->
          {#if st === 'available' || st === 'locked'}
            <span class="tprice">
              {#each Object.entries(nodeCost(node)) as [id, n] (id)}
                {#if $settings.materialLinks}
                  <button
                    class="pitem link"
                    class:short={($game.resources[id] ?? 0) < n}
                    title="Go to {RESOURCE_BY_ID[id]?.name}"
                    onclick={(e) => tapMaterial(e, id, node.id)}
                  >
                    <Icon {id} />{formatNumber(n)}
                    {RESOURCE_BY_ID[id]?.name}
                  </button>
                {:else}
                  <span class="pitem" class:short={($game.resources[id] ?? 0) < n}>
                    <Icon {id} />{formatNumber(n)}
                    {RESOURCE_BY_ID[id]?.name}
                  </span>
                {/if}
              {/each}
            </span>
          {/if}
          {#if st === 'active'}
            <ProgressBar value={$game.researchProgress} max={nodeTime(node)} />
          {/if}
        </div>
      {/each}
    </div>

    {#if prestigeView}
      <span class="legend prestige-l">🏗 Expansion — every node adds worker packs</span>
    {:else}
      <span class="legend magic-l">✦ Magic</span>
      <span class="legend magitech-l">⚡ Magitech</span>
      <span class="legend tech-l">⚙ Tech</span>
    {/if}

    {#if readyNodes.length > 0}
      <button class="ready-jump" onclick={jumpToReady}>
        ▶ {readyNodes.length} ready — show me
      </button>
    {/if}

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

  .prestige-banner {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 8px 12px;
    border: 1px solid var(--tree-prestige);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--tree-prestige) 12%, var(--panel));
    color: var(--text);
    font-size: 0.85rem;
    font-weight: 600;
    box-shadow: var(--shadow);
  }

  .prestige-banner.back {
    background: var(--panel);
    font-weight: 500;
  }

  .banner-hint {
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--muted);
    text-decoration: underline dotted;
    text-underline-offset: 2px;
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

  .queue-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .queue-toggle {
    min-height: 32px;
    padding: 2px 10px;
    border-radius: var(--radius-pill);
    font-size: 0.75rem;
    color: var(--muted);
  }

  .caret {
    display: inline-block;
    transition: transform 0.15s ease;
  }

  .caret.open {
    transform: rotate(90deg);
  }

  .queue-list {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: min(200px, 28vh);
    overflow-y: auto;
    overscroll-behavior: contain;
    border-top: 1px solid var(--border);
  }

  .qrow {
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  }

  .qname {
    flex: 1;
    min-width: 0;
    min-height: 34px;
    padding: 2px 4px;
    border: none;
    background: none;
    text-align: left;
    font-size: 0.78rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .qnum {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .qtime {
    flex: none;
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
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
    /* keep the pan/zoom transform on its own compositor layer */
    will-change: transform;
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

  /* Branch colors come from the --tree-* palette, which stays on the village
     hues even in tournament mode — the arena theme's all-blue branch colors
     made the tree's branches impossible to tell apart at any zoom level. */
  .edge.done.magic {
    stroke: var(--tree-magic);
  }

  .edge.done.tech {
    stroke: var(--tree-tech);
  }

  .edge.done.magitech {
    stroke: var(--tree-magitech);
  }

  .edge.done.prestige {
    stroke: var(--tree-prestige);
  }

  /* Zoomed-out LOD mini-cards: the DOM cards' silhouette (body, border,
     branch stripe, status colors) redrawn as cheap SVG rects, so the tree
     keeps looking like the tree at any zoom. Borders use non-scaling strokes
     so cards stay outlined even when a card is only a few pixels wide. */
  .mini .mbody {
    fill: var(--panel);
    stroke: var(--border);
    stroke-width: 1.25;
    vector-effect: non-scaling-stroke;
  }

  .mini .mstripe {
    stroke: none;
  }

  .mini.magic .mstripe {
    fill: var(--tree-magic);
  }

  .mini.tech .mstripe {
    fill: var(--tree-tech);
  }

  .mini.magitech .mstripe {
    fill: var(--tree-magitech);
  }

  .mini.prestige .mstripe {
    fill: var(--tree-prestige);
  }

  /* Dimmer than live cards but stronger than the DOM cards' 0.35 — panel
     fill on the beige backdrop at 0.35 made the far-out tree nearly
     invisible, and reading the pyramid's shape is the point of zooming out. */
  .mini.locked {
    opacity: 0.55;
  }

  .mini.locked .mbody {
    fill: color-mix(in srgb, var(--border) 35%, var(--panel));
  }

  .far .mini.locked {
    opacity: 0.85;
  }

  .far .mini.locked .mbody {
    stroke: color-mix(in srgb, var(--muted) 45%, var(--border));
  }

  /* Owned cards tint toward their branch color so cleared regions still read
     as tinted territory from far out (what the old dots were for). */
  .mini.owned.magic .mbody {
    fill: color-mix(in srgb, var(--tree-magic) 32%, var(--panel-2));
    stroke: var(--tree-magic);
  }

  .mini.owned.tech .mbody {
    fill: color-mix(in srgb, var(--tree-tech) 32%, var(--panel-2));
    stroke: var(--tree-tech);
  }

  .mini.owned.magitech .mbody {
    fill: color-mix(in srgb, var(--tree-magitech) 32%, var(--panel-2));
    stroke: var(--tree-magitech);
  }

  .mini.owned.prestige .mbody {
    fill: color-mix(in srgb, var(--tree-prestige) 32%, var(--panel-2));
    stroke: var(--tree-prestige);
  }

  .mini.available .mbody {
    stroke: color-mix(in srgb, var(--accent) 45%, var(--border));
  }

  .mini.available.ready .mbody {
    fill: color-mix(in srgb, var(--accent) 30%, var(--panel));
    stroke: var(--accent);
    stroke-width: 2;
  }

  .mini.active .mbody {
    fill: color-mix(in srgb, var(--science) 22%, var(--panel));
    stroke: var(--science);
    stroke-width: 2;
  }

  /* Grey, not science-blue: --science equals --tech, so queued cards were
     indistinguishable from owned tech territory when zoomed out. */
  .mini.queued .mbody {
    stroke: var(--muted);
    stroke-dasharray: 7 5;
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
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    text-align: center;
    cursor: pointer;
  }

  .node.owned,
  .node.locked {
    cursor: default;
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
    background: var(--tree-magic);
  }

  .node.tech::before {
    background: var(--tree-tech);
  }

  .node.magitech::before {
    background: var(--tree-magitech);
  }

  .node.prestige::before {
    background: var(--tree-prestige);
  }

  .node.locked {
    opacity: 0.35;
    filter: saturate(0.4);
  }

  .node.owned {
    border-color: var(--accent-dark);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--accent-dark) 14%, var(--panel-2)),
      var(--panel-2)
    );
  }

  /* Prereqs met but can't afford it yet: hint of accent, no glow, so the eye
     goes to the nodes that are actually actionable. */
  .node.available {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  }

  /* Prereqs met AND affordable: the loudest thing on the canvas. The glow is
     static and the pulse is a transform, so the animation stays on the
     compositor — pulsing box-shadow instead repaints every ready node's glow
     region every frame, which adds up to real heat on mobile GPUs. */
  .node.available.ready {
    border: 2px solid var(--accent);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--accent) 14%, var(--panel)),
      var(--panel)
    );
    box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 55%, transparent);
    animation: ready-pulse 1.8s ease-in-out infinite;
    will-change: transform;
  }

  @keyframes ready-pulse {
    0%,
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.045);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .node.available.ready {
      animation: none;
    }
  }

  .node.ready .tcost {
    color: var(--accent);
    font-weight: 600;
  }

  .node.active {
    border-color: var(--science);
    box-shadow: 0 0 14px color-mix(in srgb, var(--science) 50%, transparent);
  }

  .node.queued {
    border-color: var(--muted);
    border-style: dashed;
  }

  /* Pulse drawing the eye to a jumped-to node. The .viewport prefix keeps it
     more specific than .node.available.ready, whose idle pulse would
     otherwise win and swallow this one-shot flash. */
  .viewport .node.flash {
    animation: node-flash 0.85s ease-in-out 3;
  }

  @keyframes node-flash {
    50% {
      border-color: var(--accent);
      box-shadow: 0 0 22px var(--accent);
    }
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

  /* Materials footer: a full-bleed section split off by a line, so the node
     reads as two tap zones — body queues research, chips open the material. */
  .tprice {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
    align-self: stretch;
    margin: 2px -6px -6px;
    padding: 5px 6px 6px;
    border-top: 1px solid color-mix(in srgb, var(--muted) 35%, var(--border));
    background: color-mix(in srgb, var(--bg) 60%, transparent);
  }

  .node.major .tprice {
    margin: 2px -8px -10px;
    padding: 5px 8px 10px;
  }

  .pitem {
    font-size: 0.65rem;
    padding: 1px 6px;
    background: var(--panel-2);
    border-radius: var(--radius-pill);
    white-space: nowrap;
  }

  /* Cost chips become tappable material links when the setting is on. */
  button.pitem {
    min-height: 0;
    border: none;
    color: inherit;
    font-size: 0.65rem;
    line-height: inherit;
  }

  .pitem.link {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
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
    color: var(--tree-magic);
  }

  .legend.magitech-l {
    left: 50%;
    transform: translateX(-50%);
    color: var(--tree-magitech);
  }

  .legend.tech-l {
    right: 8px;
    color: var(--tree-tech);
  }

  .legend.prestige-l {
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    color: var(--tree-prestige);
  }

  .ready-jump {
    position: absolute;
    left: 8px;
    bottom: 8px;
    min-height: 36px;
    padding: 4px 14px;
    border: 1px solid var(--accent);
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--accent) 16%, var(--panel));
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 600;
    box-shadow: var(--shadow);
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
