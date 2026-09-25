-- From Wood — operational full player wipe. NOT a migration: never add this to
-- supabase/migrations, or the next `db push` replays it against live data.
--
-- Deletes every account and everything hanging off it. The FK graph does the
-- work (same cascade delete-account/index.ts relies on for a single player):
--
--   auth.users ─┬─> profiles ─┬─> entries
--               │             └─> village_scores
--               ├─> saves
--               └─> purchases
--
-- Two things the cascade does NOT reach, handled explicitly below:
--   - password_reset_requests is keyed by email, not user id;
--   - tournaments / groups are not owned by any player.
--
-- IRREVERSIBLE, and one loss is not recoverable at all: the purchases ledger
-- (migration 0011) is the only record of real-money entitlements. RevenueCat
-- never re-sends past events, its TRANSFER handler only UPDATEs rows that
-- still exist, and the webhook acknowledges-and-drops events whose user is
-- gone (23503). Any paid item must be re-granted or refunded by hand.
--
-- Run in the Supabase SQL editor (dashboard → SQL) on the production project.

-- ---- Before: what is about to be destroyed --------------------------------
select
  (select count(*) from auth.users)         as users,
  (select count(*) from public.profiles)    as profiles,
  (select count(*) from public.saves)       as saves,
  (select count(*) from public.entries)     as entries,
  (select count(*) from public.purchases)   as purchases,
  (select count(*) from public.tournaments) as tournaments;

-- Stop here if `purchases` is non-zero and those grants have not been dealt
-- with. Export them first if you intend to re-grant:
--   select user_id, product_id, event_type, delta, store, environment, event_at
--   from public.purchases order by event_at;

-- ---- The wipe -------------------------------------------------------------
begin;

-- Every account, cascading through the graph above. Inside the auth schema
-- this also clears the caller's identities, sessions and refresh tokens, so
-- every device is signed out on its next token refresh.
delete from auth.users;

-- Email-keyed reset rate limits: survive the cascade, so drop them here.
truncate table public.password_reset_requests;

-- Tournaments and their groups. Self-healing: current_tournament() recreates
-- the slot that is live now from the 0012 schedule the first time a client
-- calls get_tournament_state().
truncate table public.tournaments cascade;

-- Already empty via cascade; truncate only to restart the identity sequence
-- so a fresh ledger numbers from 1.
truncate table public.purchases restart identity;

commit;

-- ---- After: all zeros ------------------------------------------------------
select
  (select count(*) from auth.users)                     as users,
  (select count(*) from public.profiles)                as profiles,
  (select count(*) from public.saves)                   as saves,
  (select count(*) from public.entries)                 as entries,
  (select count(*) from public.village_scores)          as village_scores,
  (select count(*) from public.purchases)               as purchases,
  (select count(*) from public.password_reset_requests) as reset_requests,
  (select count(*) from public.tournaments)             as tournaments,
  (select count(*) from public.groups)                  as groups;
