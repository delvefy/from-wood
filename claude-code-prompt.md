# Claude Code Prompt — Resource / Crafting / Tech-Tree PWA Game

Copy everything below the line into Claude Code.

---

Build a **mobile-first Progressive Web App (PWA) game** about gathering resources, crafting items, researching a tech tree, and hiring workers to automate it all. This is an incremental / idle-adjacent management game — no physics, no sprites, no canvas rendering. The whole game is state + a UI on top of it.

## Tech stack (use exactly this)

- **Vite** as the build tool
- **Svelte + TypeScript** for UI and reactivity
- **vite-plugin-pwa** for the manifest + service worker (offline support, installable)
- **idb-keyval** for saving game state to IndexedDB
- Plain CSS (mobile-first). No UI component library, no CSS framework.
- No game engine (no Phaser/Pixi). The DOM is the renderer.

Set the project up, get it running with `npm run dev`, and make sure `npm run build` passes before you consider a step done.

## Core architecture principles (important)

1. **Data-driven content.** All resources, recipes, tech-tree nodes, and worker types live in plain config files under `src/content/` as typed data. Adding new content later must mean editing those files, NOT changing engine logic. The engine reads content generically.
2. **Single source of truth.** One central reactive game-state store (a Svelte store) holds all mutable state: resource amounts, unlocked things, worker counts and assignments, credits, research points, timestamps. UI components read from it and dispatch actions; they never hold game logic.
3. **Engine separated from UI.** A `src/engine/` folder holds pure-ish logic: the tick function, harvesting, crafting, research, buying/selling, hiring, and offline-progress calculation. UI just calls these and renders the result.
4. **A single game loop.** One tick runs on a fixed interval (once per second). Each tick advances all automated production. Manual actions (tapping to harvest, crafting, buying) happen on user input, outside the tick.

## Suggested file structure

```
src/
  content/
    resources.ts     // resource definitions
    recipes.ts       // crafting recipes
    tech.ts          // tech-tree nodes + effects
    workers.ts       // worker type definitions
  engine/
    types.ts         // shared TypeScript types
    state.ts         // the central store + initial state
    tick.ts          // the game loop tick
    actions.ts       // harvest, craft, buyResearch, sell, hireWorker, assignWorker
    save.ts          // save/load via idb-keyval + offline progress
  components/
    GatherView.svelte
    CraftView.svelte
    ResearchView.svelte
    MarketView.svelte   // selling + hiring/assigning workers
    BottomNav.svelte
    ResourceBar.svelte  // persistent top bar showing key resources + credits
  App.svelte
  main.ts
```

## Data model (define these types, refine as needed)

```ts
type ResourceId = string;
type ItemId = string;      // crafted things; treat items and resources uniformly if easier
type TechId = string;
type WorkerType = 'harvester' | 'researcher' | 'crafter';

interface ResourceDef {
  id: ResourceId;
  name: string;
  tier: number;            // gating / progression order
  baseSellPrice: number;   // credits per unit when sold
  unlockedByDefault: boolean;
  manualHarvestAmount: number; // gained per tap when harvestable
}

interface Recipe {
  id: string;
  name: string;
  inputs: Record<ResourceId, number>;
  outputs: Record<ResourceId, number>;
  craftTimeSeconds: number;    // for crafter automation
  unlockedByDefault: boolean;
}

// Tech effects are a discriminated union so the engine can apply them generically
type TechEffect =
  | { kind: 'unlockResource'; id: ResourceId }
  | { kind: 'unlockRecipe'; id: string }
  | { kind: 'unlockWorkerType'; workerType: WorkerType }
  | { kind: 'harvestMultiplier'; resource: ResourceId | 'all'; factor: number }
  | { kind: 'craftSpeedMultiplier'; factor: number }
  | { kind: 'workerEfficiencyMultiplier'; workerType: WorkerType; factor: number };

interface TechNode {
  id: TechId;
  name: string;
  description: string;
  cost: number;                 // research points
  requires: TechId[];           // prerequisite nodes (for tree layout + gating)
  effects: TechEffect[];
}

interface WorkerTypeDef {
  type: WorkerType;
  name: string;
  hireCost: number;             // credits; may scale with count owned
  hireCostGrowth: number;       // multiplier per additional worker
}

interface GameState {
  resources: Record<ResourceId, number>;
  credits: number;
  researchPoints: number;
  unlockedResources: Set<ResourceId> | ResourceId[];
  unlockedRecipes: Set<string> | string[];
  unlockedTech: TechId[];
  unlockedWorkerTypes: WorkerType[];
  workers: Record<WorkerType, number>;         // how many hired
  // assignments: which resource each harvester block targets, which recipe crafters run
  harvesterAssignment: Record<ResourceId, number>; // harvesters allocated per resource
  crafterRecipe: string | null;                    // recipe crafters currently run
  multipliers: { /* derived from tech, recomputed on unlock */ };
  lastSeen: number;                                 // epoch ms, for offline progress
}
```

## Mechanics

**Harvesting (Gather view).** Show the player's unlocked resources. Each has a big tap target; tapping adds `manualHarvestAmount * harvestMultiplier`. This is the core early action before automation. Water and Wood are the two starting resources.

**Workers & automation.** Three worker types, unlocked via tech:
- *Harvester* — the player allocates their harvesters across unlocked resources. Each harvester on a resource adds a fixed amount per tick (scaled by multipliers).
- *Researcher* — each researcher adds research points per tick.
- *Crafter* — crafters continuously run the currently-selected recipe, consuming inputs and producing outputs on the recipe's craft timer. If inputs are missing, they idle.

**Crafting (Craft view).** List unlocked recipes. Player can manually craft one (instant, consumes inputs → gives outputs) if they can afford the inputs, and can select which recipe the crafters auto-run. Crafted items feed back into research and better tools.

**Research (Research view).** Render the tech tree: nodes with names, costs, prerequisite lines connecting them (use SVG for the connecting edges, CSS for node positions). Locked-but-available nodes are buyable if prerequisites are met and the player has enough research points. Buying a node applies its effects permanently (unlocks resources/recipes/worker types, or bumps multipliers). Already-unlocked nodes show as done.

**Economy (Market view).** Sell any resource/item for credits at its sell price. Use credits to hire workers; hire cost scales up with each worker of that type already owned (`hireCost * hireCostGrowth^owned`). Also assign harvesters to resources and pick the crafter recipe here (or split assignment UI into the relevant views — your call, keep it usable on a phone).

**Tick loop.** Once per second: apply harvester production, researcher production, and crafter production; recompute anything derived. Keep it deterministic and cheap.

**Offline progress.** On load, read `lastSeen`, compute elapsed seconds (cap it at e.g. 8 hours so it can't balloon), and fast-forward that many ticks of *automated* production only (workers keep working; no manual taps). Show the player a small "while you were away you gained…" summary.

## Starter content (build this exact set so there's a real, playable loop)

Keep it small but complete — a full loop from tapping wood to hiring a worker.

**Resources:** Wood (tier 0, start), Water (tier 0, start), Stone (tier 1, locked), Fiber (tier 1, locked), Copper Ore (tier 2, locked), Iron Ore (tier 2, locked). Give each a sensible sell price rising with tier.

**Recipes:** Planks (2 Wood → 1 Plank), Rope (3 Fiber → 1 Rope), Stone Brick (2 Stone → 1 Brick), Copper Ingot (2 Copper Ore → 1 Copper Ingot), Research Sample (1 Plank + 1 Copper Ingot → 5 research points-worth item OR directly grants research when crafted — pick one and be consistent). Treat crafted items as resources in the same maps for simplicity.

**Tech tree (a small connected tree):**
- *Basic Tools* (cheap, no prereq): harvestMultiplier all ×1.5
- *Quarrying* (needs Basic Tools): unlockResource Stone, unlockRecipe Stone Brick
- *Rope Making* (needs Basic Tools): unlockResource Fiber, unlockRecipe Rope
- *Workforce* (needs Basic Tools): unlockWorkerType harvester
- *Research Lab* (needs Workforce): unlockWorkerType researcher
- *Automation* (needs Research Lab): unlockWorkerType crafter
- *Metallurgy* (needs Quarrying + Research Lab): unlockResource Copper Ore, Iron Ore, unlockRecipe Copper Ingot

Make research points earnable early even before researchers exist (e.g. crafting Research Samples), so the tree isn't gated behind itself.

**Worker types:** harvester (cheap), researcher (mid), crafter (higher), each with cost growth ~1.15.

## UI / mobile-first requirements

- Design for a **narrow portrait viewport first** (~360–400px wide). Everything must be reachable and tappable one-handed.
- **Bottom navigation bar** with the four sections (Gather / Craft / Research / Market). Tapping switches the active view.
- A **persistent top bar** always showing key resource counts + credits + research points.
- Big tap targets (min ~44px). No hover-dependent interactions.
- Use `clamp()`, flexbox/grid for scaling. Respect safe-area insets for notched phones.
- Clean, readable, not fancy — clarity over decoration. Numbers should be formatted (e.g. 1.2k) once they get large.

## PWA requirements

- Configure vite-plugin-pwa: a web app manifest (name, short_name, theme_color, background_color, `display: standalone`, portrait orientation, icons — generate placeholder icons if needed) and a service worker that precaches the app shell so the game **loads and plays fully offline**.
- The app must be installable to the home screen and launch fullscreen.

## Save system

- Autosave the full game state to IndexedDB (via idb-keyval) every ~10 seconds, and on `visibilitychange`/`beforeunload`. Write `lastSeen` on save.
- Load and restore on startup, then run the offline-progress calculation.
- Include a way to hard-reset the save (a button in Market/settings) for testing.

## How to work

1. Scaffold the Vite + Svelte + TS project, add the dependencies, get `npm run dev` showing a placeholder. Confirm it runs.
2. Build the types, content files, and central state store with the starter content above.
3. Implement the engine (tick, actions, save/offline).
4. Build the four views + bottom nav + top bar, wired to the store.
5. Add the PWA config and verify offline works and `npm run build` passes.
6. Playtest the core loop end to end: tap Wood → craft Planks → craft Research Sample → buy Basic Tools → buy Workforce → hire a harvester → assign it → watch it auto-gather.

## Scope guardrails

- Build **only** the starter content and mechanics above for this first version. Don't invent extra resources, prestige systems, or "extreme" late-game tiers yet — leave the content files structured so I can add them later.
- Keep engine logic generic and content-driven. If adding a resource would require editing the engine, that's a design smell — fix the structure instead.
- Prefer clarity and small, readable files over cleverness.

When you're done, give me a short summary of the file structure, how to run it, and how to add a new resource / recipe / tech node so I can extend it myself.
