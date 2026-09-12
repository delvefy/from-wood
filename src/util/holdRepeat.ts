// Svelte action: a tap fires `fire` once on release; holding fires it after a
// delay and then repeatedly until release. Works for mouse, touch and pen
// (pointer events) plus Enter/Space, which auto-repeat natively via keydown.
//
// Scroll-friendly: the element should set `touch-action: pan-y`. A vertical
// drag then becomes a page scroll — the browser sends pointercancel and
// nothing fires. Any drag past MOVE_CANCEL_PX before the hold kicks in also
// cancels, so a swipe that starts on the button never assigns by accident.
const HOLD_DELAY_MS = 380;
const REPEAT_EVERY_MS = 110;
const MOVE_CANCEL_PX = 8;

export function holdRepeat(node: HTMLElement, fire: () => void) {
  let current = fire;
  let timeout = 0;
  let interval = 0;
  let held = false;
  let startX = 0;
  let startY = 0;

  function cleanup() {
    clearTimeout(timeout);
    clearInterval(interval);
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', cleanup);
    window.removeEventListener('pointermove', move);
  }

  // A release before the hold delay is a tap: fire exactly once.
  function release() {
    if (!held) current();
    cleanup();
  }

  function move(e: PointerEvent) {
    if (held) return;
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_CANCEL_PX) cleanup();
  }

  function start(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    held = false;
    startX = e.clientX;
    startY = e.clientY;
    timeout = window.setTimeout(() => {
      held = true;
      current();
      interval = window.setInterval(() => current(), REPEAT_EVERY_MS);
    }, HOLD_DELAY_MS);
    // Listen on window: the pointer may be released outside the element, or
    // the element may become disabled mid-hold and stop emitting events.
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', cleanup);
    window.addEventListener('pointermove', move);
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
      cleanup();
      node.removeEventListener('pointerdown', start);
      node.removeEventListener('keydown', key);
      node.removeEventListener('contextmenu', blockMenu);
    },
  };
}
