import { writable } from 'svelte/store';

export type Theme = 'wood' | 'industrial';

const STORAGE_KEY = 'from-wood-theme';

function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'industrial' ? 'industrial' : 'wood';
}

export const theme = writable<Theme>(initialTheme());

theme.subscribe((t) => {
  document.documentElement.dataset.theme = t;
  localStorage.setItem(STORAGE_KEY, t);
});

export function toggleTheme() {
  theme.update((t) => (t === 'wood' ? 'industrial' : 'wood'));
}
