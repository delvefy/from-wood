import { writable } from 'svelte/store';

// Collapsed category ids per view ('craft', 'market', …), persisted as a UI
// preference in localStorage — separate from the game save.
const STORAGE_KEY = 'from-wood-collapsed';

function load(): Record<string, string[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export const collapsed = writable<Record<string, string[]>>(load());

collapsed.subscribe((v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)));

export function toggleCollapsed(view: string, id: string): void {
  collapsed.update((all) => {
    const ids = new Set(all[view] ?? []);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    return { ...all, [view]: [...ids] };
  });
}

export function isCollapsed(all: Record<string, string[]>, view: string, id: string): boolean {
  return (all[view] ?? []).includes(id);
}
