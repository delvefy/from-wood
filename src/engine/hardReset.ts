import { refreshPremium } from '../lib/purchases';
import { replaceAccountData } from './account';
import { flushCloudSave } from './cloudSave';
import { wipeLocalState } from './save';
import { resetTournamentEntries } from './tournament';

// The player-facing "start over" button: wipes EVERYTHING — both save slots,
// account data (tournament reward workers, claimed rewards), the server-side
// tournament entries, and the cloud backup. Real-money purchases are the one
// exception: they live in the server's purchases ledger, which a game reset
// must never touch (refunds are Google's job, not the reset button's), so
// they are re-adopted right after the wipe.
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

  replaceAccountData(null); // reward workers + claims (+ any dev premium grants)
  await wipeLocalState();

  // Paid purchases survive the reset: pull them back from the ledger before
  // the cloud flush so the backup is written with them included. Best-effort
  // and a no-op for signed-out/anonymous players (nothing to restore).
  try {
    await refreshPremium();
  } catch (err) {
    console.warn('hard reset: could not restore purchases yet', err);
  }

  // Overwrite the cloud backup with the wiped state so it can't restore the
  // old progress on this or another device. No-op for anonymous players.
  await flushCloudSave();
}
