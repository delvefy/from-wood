import { derived, writable } from 'svelte/store';
import { gameMode } from '../engine/mode';
import { activeTab } from './nav';

export type Theme = 'wood' | 'industrial';

const STORAGE_KEY = 'from-wood-theme';

function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'industrial' ? 'industrial' : 'wood';
}

export const theme = writable<Theme>(initialTheme());

// Tournament UI takes over whenever the tournament slot is live or its hub
// tab is open; it restyles the whole app (blue palettes, sharp corners).
export type UiMode = 'village' | 'tournament';

export const uiMode = derived([gameMode, activeTab], ([mode, tab]): UiMode =>
  mode === 'tournament' || tab === 'tournament' ? 'tournament' : 'village',
);

const META_COLORS: Record<UiMode, Record<Theme, string>> = {
  village: { wood: '#ede3cf', industrial: '#0c0a1e' },
  tournament: { wood: '#dde7f2', industrial: '#081020' },
};

derived([theme, uiMode], (pair) => pair).subscribe(([t, mode]) => {
  document.documentElement.dataset.theme = t;
  if (mode === 'tournament') document.documentElement.dataset.mode = 'tournament';
  else delete document.documentElement.dataset.mode;
  localStorage.setItem(STORAGE_KEY, t);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', META_COLORS[mode][t]);
});

export function setTheme(t: Theme) {
  theme.set(t);
}
