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

// Tournament runs are a sprint: base gather/craft cycles run this many times
// faster than in the village. The village always runs at 1×.
export const TOURNAMENT_SPEED = 5;

export function modeTimeFactor(mode: GameMode): number {
  return mode === 'tournament' ? 1 / TOURNAMENT_SPEED : 1;
}
