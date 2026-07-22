import { writable } from 'svelte/store';

// Resource ids included in the market's "sell custom" action, persisted as a
// UI preference in localStorage — separate from the game save.
const STORAGE_KEY = 'from-wood-sell-ticks';

function load(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export const sellTicks = writable<string[]>(load());

sellTicks.subscribe((v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)));

export function toggleSellTick(id: string): void {
  sellTicks.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
}
