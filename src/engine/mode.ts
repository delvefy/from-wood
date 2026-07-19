import { writable } from 'svelte/store';

// Which save slot is live: the village (main) or the current tournament run.
// Persisted so a reload drops the player back into the slot they were playing.
export type GameMode = 'main' | 'tournament';

const STORAGE_KEY = 'from-wood-mode';

function load(): GameMode {
  return localStorage.getItem(STORAGE_KEY) === 'tournament' ? 'tournament' : 'main';
}

export const gameMode = writable<GameMode>(load());

gameMode.subscribe((m) => localStorage.setItem(STORAGE_KEY, m));

// Workers run at the same pace in both modes: the tournament sprint comes
// entirely from its compressed research times and cheaper costs (see
// researchTime/techCost in content/tech).
