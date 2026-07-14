import { createClient } from '@supabase/supabase-js';
import { writable } from 'svelte/store';

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

// ---- Email/password accounts -------------------------------------------------
// Optional upgrade over the anonymous identity: registering while anonymous
// attaches the email to the same user (keeping league/tournament history);
// signing in on another device recovers that account.

export interface AccountInfo {
  email: string | null; // null while anonymous or signed out
  signedIn: boolean;
}

export const account = writable<AccountInfo>({ email: null, signedIn: false });

supabase.auth.onAuthStateChange((_event, session) => {
  const user = session?.user ?? null;
  account.set({
    email: user && !user.is_anonymous ? (user.email ?? null) : null,
    signedIn: user !== null,
  });
});

function authError(error: { message?: string } | null, fallback: string): Error {
  return new Error(error?.message || fallback);
}

// Register an email/password account. If the player already has an anonymous
// session, the email is linked to it in place so tournament identity survives;
// otherwise a fresh account is created and signed in. Returns a user-facing
// status message. No password rules are enforced here — Supabase itself
// rejects only passwords shorter than its configured minimum.
export async function registerWithEmail(email: string, password: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.is_anonymous) {
    const { data: upd, error } = await supabase.auth.updateUser({ email, password });
    if (error) throw authError(error, 'Registration failed');
    return upd.user?.email_confirmed_at
      ? 'Account created.'
      : 'Account created — check your inbox if a confirmation email arrives.';
  }
  const { data: sign, error } = await supabase.auth.signUp({ email, password });
  if (error) throw authError(error, 'Registration failed');
  return sign.session
    ? 'Account created and signed in.'
    : 'Account created — confirm it from the email we sent, then sign in.';
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw authError(error, 'Sign-in failed');
}

export async function signOutAccount(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw authError(error, 'Sign-out failed');
}

// Change the signed-in account's password. No client-side rules.
export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw authError(error, 'Password change failed');
}

// Ask the reset-password Edge Function to generate a fresh 10-digit password
// and email it. Always resolves with a neutral message — the server never
// reveals whether the email exists.
export async function requestPasswordReset(email: string): Promise<string> {
  const { error } = await supabase.functions.invoke('reset-password', {
    body: { email },
  });
  if (error) throw authError(error, 'Could not request a password reset');
  return 'If an account exists for that email, a new 10-digit password is on its way.';
}
