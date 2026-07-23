import { writable } from 'svelte/store';

// UI preferences persisted in localStorage — separate from the game save.
const STORAGE_KEY = 'from-wood-settings';

export interface Settings {
  // Tapping a material in Craft/Research jumps to the view that produces it.
  materialLinks: boolean;
  // First-steps guide on the Gather tab; dismissed by hand or for good once
  // Woodworking is researched (so fresh tournament runs don't resurface it).
  guideDismissed: boolean;
}

function load(): Settings {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      materialLinks: parsed?.materialLinks ?? true,
      guideDismissed: parsed?.guideDismissed ?? false,
    };
  } catch {
    return { materialLinks: true, guideDismissed: false };
  }
}

export const settings = writable<Settings>(load());

settings.subscribe((s) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s)));

export function toggleMaterialLinks(): void {
  settings.update((s) => ({ ...s, materialLinks: !s.materialLinks }));
}

export function dismissGuide(): void {
  settings.update((s) => (s.guideDismissed ? s : { ...s, guideDismissed: true }));
}
