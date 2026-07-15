import { replaceAccountData } from './account';
import { flushCloudSave } from './cloudSave';
import { wipeLocalState } from './save';
import { resetTournamentEntries } from './tournament';

// The player-facing "start over" button: wipes EVERYTHING — both save slots,
// account data (premium purchases, tournament reward workers, claimed
// rewards), the server-side tournament entries, and the cloud backup.
//
// Lives outside save.ts because it spans layers that already import save.ts
// (tournament.ts, cloudSave.ts).
export async function hardReset(): Promise<void> {
  // Server first, best-effort: the local wipe must go through even offline.
  // If this fails the old tournament entry survives on the server and the
  // next state refresh re-adopts it — same as before, and harmless enough
  // for a reset the player can simply run again.
  try {
    await resetTournamentEntries();
  } catch (err) {
    console.warn('hard reset: could not clear server tournament entries', err);
  }

  replaceAccountData(null); // premium purchases + reward workers + claims
  await wipeLocalState();

  // Overwrite the cloud backup with the wiped state so it can't restore the
  // old progress on this or another device. No-op for anonymous players.
  await flushCloudSave();
}
