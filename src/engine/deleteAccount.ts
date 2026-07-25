import { requestAccountDeletion } from '../lib/supabase';
import { replaceAccountData } from './account';
import { forgetCloudIdentity } from './cloudSave';
import { wipeLocalState } from './save';

// The player-facing "delete my account" flow. Server first: the Edge Function
// re-checks the password and deletes the auth user, which cascades away the
// profile, cloud save, tournament entries, and leaderboard scores. Only after
// that succeeds is this device wiped — a wrong password (or being offline)
// throws and leaves everything untouched.
//
// Lives beside hardReset.ts because it spans the same layers. No cloud flush
// at the end: there is no account left to back anything up to.
export async function deleteAccount(password: string): Promise<void> {
  await requestAccountDeletion(password);

  await forgetCloudIdentity();
  replaceAccountData(null); // premium purchases + reward workers + claims
  await wipeLocalState();
}
