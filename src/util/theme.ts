import { Capacitor, registerPlugin } from '@capacitor/core';
import { derived, writable } from 'svelte/store';
import { gameMode } from '../engine/mode';
import { activeTab } from './nav';

export type Theme = 'wood' | 'industrial';

// Tiny in-app native plugin (android/.../StatusBarStylePlugin.java) that only
// flips status bar icon colour; @capacitor/status-bar pulls in APIs Android 15
// deprecates for edge-to-edge apps, which Play flags on every release.
const StatusBarStyle = registerPlugin<{
  setStyle(opts: { style: 'dark' | 'light' }): Promise<void>;
}>('StatusBarStyle');

const STORAGE_KEY = 'from-wood-theme';

// Dark (industrial) is the default; only an explicit past choice of wood
// keeps a player on the light palette. Must stay in sync with the pre-paint
// script in index.html, which picks the theme before the app boots.
function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'wood' ? 'wood' : 'industrial';
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
  // The native shell draws edge-to-edge, so the status bar icons sit on the
  // page's own background — keep them readable for the active theme.
  if (Capacitor.isNativePlatform()) {
    void StatusBarStyle.setStyle({ style: t === 'industrial' ? 'dark' : 'light' }).catch(() => {});
  }
});

export function setTheme(t: Theme) {
  theme.set(t);
}
