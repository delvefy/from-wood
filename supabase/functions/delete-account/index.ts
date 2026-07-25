// Account deletion: re-verifies the caller's password, then removes their
// auth.users row — every game table cascades from it (profiles → entries →
// score_submissions, plus saves and village_scores). Deployed with JWT
// verification left on (the default, see supabase/config.toml), so the
// gateway rejects unauthenticated calls before the function runs. The
// password check happens here, server-side, so a leaked session token alone
// is never enough to destroy an account.
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  let password = '';
  try {
    password = String((await req.json()).password ?? '');
  } catch {
    // fall through to the validation below
  }
  if (!password) return json(400, { error: 'password required' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Resolve the caller from their JWT (already gateway-verified).
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return json(401, { error: 'not signed in' });
  const { id: uid, email, is_anonymous: isAnonymous } = caller.user;
  // Anonymous identities have no password to confirm with; they clear their
  // data through the in-game hard reset instead.
  if (isAnonymous || !email) return json(400, { error: 'no email account to delete' });

  // Password check via the password grant, on a separate client so the
  // sign-in it performs never touches the admin client's state. Wrong
  // passwords hit GoTrue's own sign-in rate limits, so this can't be
  // brute-forced any faster than the login form.
  const verifier = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error: passwordError } = await verifier.auth.signInWithPassword({ email, password });
  if (passwordError) return json(403, { error: 'Incorrect password.' });

  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) {
    console.error('account deletion failed:', deleteError.message);
    return json(500, { error: 'deletion failed' });
  }

  // Best-effort cleanup of the reset-email rate-limit row, which is keyed by
  // email rather than user id and so survives the cascade.
  await admin.from('password_reset_requests').delete().eq('email', email.toLowerCase());

  return json(200, { ok: true });
});
