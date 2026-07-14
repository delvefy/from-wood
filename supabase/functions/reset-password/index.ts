// Password reset: generates a fresh 10-digit password, sets it on the account
// and emails it to the player. Called unauthenticated from the client (deploy
// with --no-verify-jwt; see supabase/config.toml), so the response is always
// the same neutral success whether or not the email exists — no enumeration.
//
// Secrets (supabase secrets set KEY=value):
//   RESEND_API_KEY  — Resend API key used to send the email
//   RESET_FROM      — optional From header, defaults to Resend's test sender
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

function tenDigitPassword(): string {
  const digits = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(digits, (n) => n % 10).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  let email = '';
  try {
    email = String((await req.json()).email ?? '').trim();
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

  const password = tenDigitPassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
  if (updateError) {
    console.error('password update failed:', updateError.message);
    return json(500, { error: 'reset failed' });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.error('RESEND_API_KEY is not set — cannot email the new password');
    return json(500, { error: 'reset failed' });
  }

  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESET_FROM') ?? 'From Wood <onboarding@resend.dev>',
      to: [email],
      subject: 'Your new From Wood password',
      text:
        `Your From Wood password was reset.\n\n` +
        `New password: ${password}\n\n` +
        `Sign in with it, then change it in Settings if you like. ` +
        `If you did not request this, just request another reset.`,
    }),
  });
  if (!mail.ok) {
    console.error('email send failed:', mail.status, await mail.text());
    return json(500, { error: 'reset failed' });
  }

  return json(200, { ok: true });
});
