// Local snapshot of the player's tournament entry (server truth lives in
// Supabase). Kept in localStorage so the save layer can cap tournament-slot
// offline catch-up at the tournament's end without a network round-trip.

export interface TournamentMeta {
  tournamentId: string;
  groupId: string;
  league: number;
  joinedAt: number; // epoch ms
  startsAt: number; // epoch ms
  endsAt: number; // epoch ms — tournament runs freeze here
  displayName: string;
}

const STORAGE_KEY = 'from-wood-tournament-meta-v1';

export function getTournamentMeta(): TournamentMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TournamentMeta;
    return typeof parsed?.tournamentId === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function setTournamentMeta(meta: TournamentMeta): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

export function clearTournamentMeta(): void {
  localStorage.removeItem(STORAGE_KEY);
}
