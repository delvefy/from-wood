-- Real-money purchases become server truth (same move 0009 made for reward
-- workers). Until now premium ownership was a client-writable field inside
-- the cloud-save blob — fine while purchases were free, indefensible once
-- real money flows: anyone could console-grant themselves the shop, and a
-- refunded purchase would stay granted forever.
--
-- Design: an append-only ledger, one row per RevenueCat webhook event
-- (supabase/functions/revenuecat-webhook). Grants are +1 deltas, refunds -1,
-- refund reversals +1 again; ownership is greatest(sum(delta), 0) per store
-- product. Only the service role writes rows; clients may read their own and
-- overwrite their local premium counts with the aggregate on every refresh —
-- so locally forged purchases never survive contact with the server, and
-- refunds revoke the item on the next sync.
--
-- event_id is RevenueCat's unique event id: webhook retries and duplicate
-- deliveries collapse into one row (insert .. on conflict do nothing).
create table public.purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id text not null unique,
  product_id text not null, -- store product id (e.g. gather_manager), mapped in src/content/premium.ts
  event_type text not null, -- RevenueCat event type, kept verbatim for auditing
  delta integer not null check (delta in (-1, 1)),
  store text, -- PLAY_STORE / APP_STORE / ...
  environment text, -- PRODUCTION or SANDBOX (license-tester purchases)
  event_at timestamptz, -- RevenueCat's event timestamp
  created_at timestamptz not null default now()
);

create index purchases_user_idx on public.purchases (user_id);

alter table public.purchases enable row level security;

-- Players read their own ledger (the client aggregates ownership from it).
-- No insert/update/delete policies exist: only the webhook's service-role
-- client can write, so entitlements cannot be forged or replayed from a
-- browser console.
create policy "read own purchases" on public.purchases
  for select using ((select auth.uid()) = user_id);

grant select on public.purchases to authenticated;
