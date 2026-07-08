// Svelte action: fires `fire` once on press, then repeatedly while held.
// Works for mouse, touch and pen (pointer events) plus Enter/Space, which
// auto-repeat natively via keydown. The element should set `touch-action:
// none` so holding doesn't start a scroll.
const HOLD_DELAY_MS = 380;
const REPEAT_EVERY_MS = 110;

export function holdRepeat(node: HTMLElement, fire: () => void) {
  let current = fire;
  let timeout = 0;
  let interval = 0;

  function stop() {
    clearTimeout(timeout);
    clearInterval(interval);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
  }

  function start(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    current();
    timeout = window.setTimeout(() => {
      interval = window.setInterval(() => current(), REPEAT_EVERY_MS);
    }, HOLD_DELAY_MS);
    // Listen on window: the pointer may be released outside the element, or
    // the element may become disabled mid-hold and stop emitting events.
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); // suppress the synthetic click that would double-fire
      current();
    }
  }

  // Long-press must not open the browser context menu on mobile.
  const blockMenu = (e: Event) => e.preventDefault();

  node.addEventListener('pointerdown', start);
  node.addEventListener('keydown', key);
  node.addEventListener('contextmenu', blockMenu);
  return {
    update(next: () => void) {
      current = next;
    },
    destroy() {
      stop();
      node.removeEventListener('pointerdown', start);
      node.removeEventListener('keydown', key);
      node.removeEventListener('contextmenu', blockMenu);
    },
  };
}
