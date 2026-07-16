---
name: verify
description: How to build, launch, and drive From Wood to verify changes end-to-end in a real browser.
---

# Verifying From Wood

Svelte 5 + Vite PWA. The surface is the browser at `http://localhost:5173/from-wood/`.

## Launch

```bash
npm run dev        # Vite, ready in ~1s; note the /from-wood/ base path
```

If the Claude-in-Chrome extension isn't connected, headless Chrome + CDP works
(needs sandbox disabled — the sandbox blocks Chrome's `nice()` and CDP's listen port):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --remote-debugging-port=9222 --user-data-dir="$SCRATCH/chrome-profile" \
  --no-first-run --window-size=430,900 about:blank &
```

Then drive over `ws://` from `http://localhost:9222/json/list` with Node's global
WebSocket (`Runtime.evaluate`, `Page.captureScreenshot`). `npx tsx` also fails
sandboxed (IPC pipe); bundle scratch TS with `npx esbuild --bundle` instead.

## Gotchas when driving

- A fresh profile starts a brand-new save: 1 gatherer, only Wood + Water unlocked,
  nothing affordable in research.
- The assign/unassign chevrons use the `holdRepeat` pointer action — `.click()`
  does nothing. Dispatch `pointerdown` on the button, then `pointerup` on `window`.
- Svelte re-renders async: after a click that flips a `disabled` attr, wait a beat
  before clicking the next button in the same flow.
- Fast-forward without waiting: the tick uses real elapsed time with up to 8h
  catch-up, so `Date.now = () => orig() + 600_000` in the page advances the game
  ~10 min on the next 1s tick. (Basic Tools: 10 wood + 10 water, 30s research.)
- Research-tree nodes/edges are viewport-culled (~27 of 495 at default zoom);
  count `.node` elements to check culling, pan via PointerEvents on `.viewport`.
- Tab switching: `[...document.querySelectorAll('nav button')]` and match label
  text (Gather / Craft / Research / Market).

## Flows worth driving

- Gather: assign worker → stock counter climbs, progress bar `transform` advances
  once per second (must be `transition: transform`, not `width` — heat fix).
- Research: node counts under culling; `.node.available.ready` pulse must animate
  `transform` only (box-shadow static — heat fix); tap a ready node → slot shows
  "Researching: …" with a progress bar.
