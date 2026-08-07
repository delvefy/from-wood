# from-wood

An incremental crafting game: gather resources, craft items, research tech, automate everything. Ships as a web app (PWA) and as a native Android app wrapping the same build.

## Tech stack

### Frontend

- **[Svelte 5](https://svelte.dev/)** — UI framework (single-page app, entry at `src/main.ts` / `src/App.svelte`)
- **[TypeScript](https://www.typescriptlang.org/)** — used throughout, checked with `svelte-check` (`npm run check`)
- **[Vite 7](https://vitejs.dev/)** — dev server and bundler (`npm run dev`, `npm run build`)
- **[vite-plugin-pwa](https://vite-pwa-org.netlify.app/)** — PWA manifest + Workbox service worker with auto-update (disabled for native builds)
- **[idb-keyval](https://github.com/jakearchibald/idb-keyval)** — IndexedDB persistence for local game saves

The game logic lives in `src/engine/` (tick loop, state, rates, prestige, tournaments, cloud save) and is plain TypeScript, independent of the UI layer. Game content (recipes, tech trees) lives in `src/content/`.

### Backend

- **[Supabase](https://supabase.com/)** — auth, Postgres database (schema in `supabase/migrations/`), and Deno Edge Functions (`supabase/functions/`: account deletion, password reset, RevenueCat webhook)

### Native / mobile

- **[Capacitor 8](https://capacitorjs.com/)** — native Android shell around the same Vite build (`npm run build:android`; project in `android/`, config in `capacitor.config.ts`)
- **[RevenueCat](https://www.revenuecat.com/)** (`@revenuecat/purchases-capacitor`) — in-app purchases, with a server-side webhook writing to a purchases ledger

### Tooling & deployment

- **tsx** — runs the TypeScript utility scripts in `scripts/` (content validation, tech-tree layout checks, tournament simulation, icon generation)
- **GitHub Pages / GitHub Actions** — web deployment at [delvefy.github.io/from-wood](https://delvefy.github.io/from-wood/) (built with the `/from-wood/` base path; native builds use relative paths via `CAP_BUILD=1`)

## Common commands

```bash
npm run dev            # start the Vite dev server
npm run build          # production web build
npm run build:android  # native bundle + capacitor sync
npm run check          # type-check with svelte-check
npm run validate       # validate game content
```
