// Password reset: emails the player a one-time recovery link. Clicking it
// signs them into the app, which then prompts for a new password — no
// passwords ever travel by email. Called unauthenticated from the client
// (deploy with --no-verify-jwt; see supabase/config.toml), so the response is
// always the same neutral success whether or not the email exists — no
// enumeration. Rate limited to one email per address per 15 minutes via the
// password_reset_requests table (0008); throttled requests also get the
// neutral success.
//
// Secrets (supabase secrets set KEY=value):
//   RESEND_API_KEY     — Resend API key used to send the email
//   RESET_FROM         — optional From header, defaults to Resend's test sender
//   RESET_REDIRECT_TO  — optional link landing page, defaults to the live app;
//                        must be allowlisted under Auth → URL Configuration.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_COOLDOWN_MS = 15 * 60 * 1000;
const DEFAULT_REDIRECT_TO = 'https://delvefy.github.io/from-wood/';

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

  let email = '';
  try {
    email = String((await req.json()).email ?? '')
      .trim()
      .toLowerCase();
  } catch {
    // fall through to the validation below
  }
  if (!email || !email.includes('@') || email.length > 254) {
    return json(400, { error: 'invalid email' });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Rate limit before the account lookup so throttling behaves identically for
  // known and unknown emails — the endpoint stays useless for enumeration.
  const { data: prior, error: rlError } = await admin
    .from('password_reset_requests')
    .select('last_sent_at')
    .eq('email', email)
    .maybeSingle();
  if (rlError) {
    console.error('rate-limit lookup failed:', rlError.message);
    return json(500, { error: 'reset failed' });
  }
  if (prior && Date.now() - new Date(prior.last_sent_at).getTime() < RESEND_COOLDOWN_MS) {
    return json(200, { ok: true });
  }
  const { error: stampError } = await admin
    .from('password_reset_requests')
    .upsert({ email, last_sent_at: new Date().toISOString() });
  if (stampError) {
    console.error('rate-limit stamp failed:', stampError.message);
    return json(500, { error: 'reset failed' });
  }

  const { data: userId, error: lookupError } = await admin.rpc('user_id_by_email', {
    p_email: email,
  });
  if (lookupError) {
    console.error('lookup failed:', lookupError.message);
    return json(500, { error: 'reset failed' });
  }
  // Unknown email: report success anyway so the endpoint can't be used to
  // probe which emails have accounts.
  if (!userId) return json(200, { ok: true });

  const redirectTo = Deno.env.get('RESET_REDIRECT_TO') ?? DEFAULT_REDIRECT_TO;
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });
  if (linkError || !link?.properties?.action_link) {
    console.error('recovery link failed:', linkError?.message ?? 'no action_link');
    return json(500, { error: 'reset failed' });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.error('RESEND_API_KEY is not set — cannot email the reset link');
    return json(500, { error: 'reset failed' });
  }

  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESET_FROM') ?? 'From Wood <onboarding@resend.dev>',
      to: [email],
      subject: 'Reset your From Wood password',
      text:
        `Someone (hopefully you) asked to reset your From Wood password.\n\n` +
        `Open this link to sign in and choose a new one:\n${link.properties.action_link}\n\n` +
        `The link works once and expires after about an hour. ` +
        `If you did not request this, you can ignore this email — ` +
        `your password has not changed.`,
    }),
  });
  if (!mail.ok) {
    console.error('email send failed:', mail.status, await mail.text());
    return json(500, { error: 'reset failed' });
  }

  return json(200, { ok: true });
});
