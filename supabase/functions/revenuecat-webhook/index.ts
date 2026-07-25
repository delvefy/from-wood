// RevenueCat → Supabase entitlement webhook: the only writer of the
// public.purchases ledger (migration 0011). RevenueCat validates the store
// receipt, then delivers one event per purchase/refund here; we append a
// ledger row and the client derives ownership as greatest(sum(delta), 0) per
// product. The client itself can never write the ledger, so this hop is what
// makes premium ownership server truth.
//
// Security model:
//  - Deployed with verify_jwt = false (supabase/config.toml): RevenueCat has
//    no Supabase JWT. Instead the RevenueCat webhook config sets a static
//    Authorization header, which must equal the RC_WEBHOOK_SECRET env var
//    (set via `supabase secrets set RC_WEBHOOK_SECRET=...`, mirror the same
//    value in the RevenueCat dashboard under Integrations → Webhooks).
//  - Idempotent: event.id is unique in the ledger, so RevenueCat's retries
//    and duplicate deliveries collapse into one row.
//  - Unknown/irrelevant event types are acknowledged with 200 (anything else
//    makes RevenueCat retry forever); genuine DB failures return 500 so the
//    event IS retried.
//
// Event semantics (this app sells only one-time products, no subscriptions):
//  - INITIAL_PURCHASE / NON_RENEWING_PURCHASE → grant (+1)
//  - CANCELLATION → refund → revoke (-1). (For subscriptions this event can
//    also mean "auto-renew turned off"; if subscriptions are ever added this
//    must switch to checking cancel_reason.)
//  - EXPIRATION → revoke (-1); unreachable for one-time products, handled so
//    a future promotional grant with an expiry does the right thing.
//  - REFUND_REVERSED → the store un-refunded → grant again (+1)
//  - TRANSFER → the store account restored its purchases under a different
//    app user id (reinstall + new Supabase account): move the ledger rows so
//    the entitlement follows the store receipt, exactly like RevenueCat does.
//
// app_user_id is always a Supabase user id: the client configures RevenueCat
// with Purchases.logIn(<supabase uid>) before any purchase and blocks buying
// until signed in. A non-uuid id (RevenueCat anonymous) is acknowledged and
// logged — retrying would never fix it.
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2';

const GRANT_EVENTS = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'REFUND_REVERSED']);
const REVOKE_EVENTS = new Set(['CANCELLATION', 'EXPIRATION']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RcEvent {
  type?: string;
  id?: string;
  app_user_id?: string;
  product_id?: string;
  store?: string;
  environment?: string;
  event_timestamp_ms?: number;
  transferred_from?: string[];
  transferred_to?: string[];
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Constant-time-ish comparison; the secret is long and random, so the main
// point is just to never accept an empty/unset secret.
function authorized(header: string | null): boolean {
  const secret = Deno.env.get('RC_WEBHOOK_SECRET') ?? '';
  if (!secret || !header || header.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= header.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  if (!authorized(req.headers.get('Authorization'))) return json(401, { error: 'unauthorized' });

  let event: RcEvent;
  try {
    event = ((await req.json()) as { event?: RcEvent }).event ?? {};
  } catch {
    return json(400, { error: 'invalid json' });
  }
  const type = event.type ?? '';
  if (!event.id) return json(400, { error: 'missing event id' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Purchases restored under a different identity: re-home the ledger rows.
  if (type === 'TRANSFER') {
    const to = (event.transferred_to ?? []).find((id) => UUID_RE.test(id));
    const from = (event.transferred_from ?? []).filter((id) => UUID_RE.test(id));
    if (!to || from.length === 0) {
      console.warn('transfer without usable uuids', event.id);
      return json(200, { ok: true, skipped: 'no uuid identities' });
    }
    const { error } = await admin
      .from('purchases')
      .update({ user_id: to })
      .in('user_id', from);
    if (error) {
      console.error('transfer failed:', error.message);
      return json(500, { error: 'transfer failed' });
    }
    return json(200, { ok: true });
  }

  const grant = GRANT_EVENTS.has(type);
  if (!grant && !REVOKE_EVENTS.has(type)) return json(200, { ok: true, ignored: type });

  const uid = event.app_user_id ?? '';
  if (!UUID_RE.test(uid)) {
    console.warn('event for non-supabase identity', event.id, uid);
    return json(200, { ok: true, skipped: 'not a supabase user id' });
  }
  if (!event.product_id) return json(200, { ok: true, skipped: 'no product id' });

  const { error } = await admin.from('purchases').insert({
    user_id: uid,
    event_id: event.id,
    product_id: event.product_id,
    event_type: type,
    delta: grant ? 1 : -1,
    store: event.store ?? null,
    environment: event.environment ?? null,
    event_at: event.event_timestamp_ms ? new Date(event.event_timestamp_ms).toISOString() : null,
  });
  // 23505 = duplicate event_id: an already-processed retry, acknowledge it.
  if (error && error.code !== '23505') {
    // A deleted account's uid fails the FK (23503) — the purchase has no home
    // anymore; acknowledge so RevenueCat stops retrying.
    if (error.code === '23503') return json(200, { ok: true, skipped: 'user deleted' });
    console.error('ledger insert failed:', error.message);
    return json(500, { error: 'insert failed' });
  }
  return json(200, { ok: true });
});
