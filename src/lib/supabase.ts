import { createClient } from '@supabase/supabase-js';

// Publishable credentials — safe to ship in the client. All protection comes
// from row-level security and the definer RPCs in supabase/migrations/.
const SUPABASE_URL = 'https://mawhmuprhprzmdgjzqve.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vbKbpKKS5Aztu9CGi45VLA_fumRhwfT';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Anonymous auth: a stable per-device identity with no signup. Lazy — first
// called when the player opens the Tournament tab. Requires anonymous
// sign-ins to be enabled in the Supabase dashboard.
export async function ensureSignedIn(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error('Anonymous sign-in failed');
  return anon.user.id;
}
