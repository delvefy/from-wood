-- Security hardening, three parts:
--
-- 1. Drop the dev tournament controls from 0003. They were guarded only by a
--    shared key hardcoded in the migration — which lives in a public repo, so
--    the key is burned and the functions are a backdoor for any anonymous
--    user. Dev testing can use the dashboard SQL editor instead.
--
-- 2. Realistic anti-cheat score caps. The 1e12/hour placeholder was ~5 orders
--    of magnitude above real play (village endgame net worth is tens of
--    millions over ~100 days), so it capped nothing. 1e6/hour keeps ~10-20x
--    headroom over the fastest legitimate pace (premium multipliers included)
--    while actually bounding forged scores. Tune alongside real score data.
--
-- 3. A rate-limit ledger for the reset-password edge function: one email per
--    address per 15 minutes. Service-role only (RLS on, no policies).

-- ---- 1. Drop the dev backdoor -------------------------------------------------

drop function if exists public.dev_start_tournament(text, integer);
drop function if exists public.dev_end_tournament(text);
drop function if exists public.dev_assert_key(text);

-- ---- 2. Score caps --------------------------------------------------------------

alter table public.tournaments alter column score_cap_per_hour set default 1e6;
update public.tournaments set score_cap_per_hour = 1e6;

-- Replaces 0005's version: identical except the village cap rate is 1e6/hour
-- instead of the 1e12 placeholder.
create or replace function public.submit_village_score(p_score numeric, p_display_name text default null)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles;
  cap numeric;
  accepted numeric;
  nm text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_score is null or p_score < 0 or p_score > 1e30 then
    raise exception 'invalid score';
  end if;

  select * into prof from public.profiles where id = uid;
  if not found then
    insert into public.profiles (id) values (uid)
    on conflict do nothing;
    select * into prof from public.profiles where id = uid;
  end if;

  nm := trim(coalesce(p_display_name, ''));
  if prof.display_name = '' and length(nm) between 1 and 24 then
    update public.profiles set display_name = nm where id = uid;
  end if;

  -- Anti-cheat ceiling: hours since the account existed × hourly rate.
  cap := (extract(epoch from (now() - prof.created_at)) / 3600.0) * 1e6;
  accepted := least(p_score, cap);

  insert into public.village_scores (player_id, best_score)
  values (uid, accepted)
  on conflict (player_id) do update
    set best_score = greatest(village_scores.best_score, excluded.best_score),
        updated_at = case
          when excluded.best_score > village_scores.best_score then now()
          else village_scores.updated_at
        end;

  select best_score into accepted from public.village_scores where player_id = uid;
  return accepted;
end;
$$;

-- ---- 3. Password-reset rate limit ----------------------------------------------
-- One row per requested email; the reset-password edge function (service role,
-- bypasses RLS) refuses to send again within 15 minutes of last_sent_at.
-- No policies: clients can neither read nor write it.

create table public.password_reset_requests (
  email text primary key,
  last_sent_at timestamptz not null default now()
);

alter table public.password_reset_requests enable row level security;
