-- Server-trusted catch-up clock; drop the score ledger and predictor.
--
-- 1. sync_clock(): the client's catch-up used the device clock, so moving it
--    forward paid out up to a day of progress per reload (the 2026-09 spikes
--    in score_submissions). The client now anchors a monotonic clock to the
--    server's now() at launch and on every resume (src/engine/clock.ts), and
--    caps an absence at the time since the server last took a submit for that
--    slot. sync_clock returns both; it works signed out (submit times null).
--
-- 2. submit_score / submit_village_score return jsonb {score, now_ms} so each
--    submit refreshes the client's anchor. Released builds ignore the return
--    value, so the type change is safe for them. submit_score keeps
--    p_gatherers / p_crafters as ignored, defaulted parameters: builds up to
--    1.1.4 still send them, and the new client does not.
--
-- 3. The score_submissions ledger, the worker-based predictor and its flags
--    (0009, re-tuned in 0015 and 0017) go away. The flags never gated
--    anything and the ledger grew by a row per player-minute.
--    tournaments.score_cap_per_hour is still left in place (see 0015). The
--    village account-age cap from 0017 stays.
--
-- Deploy: run in the Supabase SQL editor BEFORE shipping the client that
-- calls sync_clock. Older clients keep working against this schema.
-- (No bare dollar signs in comments: the SQL editor's splitter pairs them
-- with the function bodies' dollar quotes.)

-- ---- 1. Drop the ledger and predictor state -------------------------------

drop table if exists public.score_submissions;

alter table public.entries
  drop column if exists cheat_flags,
  drop column if exists cheat_reason,
  drop column if exists cheat_flagged_at;

alter table public.tournaments
  drop column if exists cheat_rate_per_worker_hour,
  drop column if exists cheat_max_workers;

-- ---- 2. Village: remember when the server last heard from the slot --------

alter table public.village_scores
  add column if not exists last_submit_at timestamptz;

-- ---- 3. Tournament submit ---------------------------------------------------

drop function if exists public.submit_score(numeric, integer, integer);

create function public.submit_score(
  p_score numeric,
  p_gatherers integer default null, -- ignored; sent by builds up to 1.1.4
  p_crafters integer default null   -- ignored; sent by builds up to 1.1.4
) returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  e public.entries;
  t public.tournaments;
  accepted numeric;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_score is null or p_score < 0 or p_score > 1e30 then
    raise exception 'invalid score';
  end if;

  select * into e from public.entries
  where player_id = uid order by joined_at desc limit 1;
  if not found then
    raise exception 'not entered in a tournament';
  end if;

  select * into t from public.tournaments where id = e.tournament_id;
  if t.status <> 'running' or now() < t.starts_at or now() > t.ends_at then
    raise exception 'tournament is not running';
  end if;

  -- The best score submitted wins, monotonically.
  accepted := greatest(e.score, p_score);
  update public.entries set score = accepted, last_submit_at = now() where id = e.id;

  return jsonb_build_object(
    'score', accepted,
    'now_ms', floor(extract(epoch from now()) * 1000));
end;
$fn$;

revoke execute on function public.submit_score(numeric, integer, integer) from public, anon;
grant execute on function public.submit_score(numeric, integer, integer) to authenticated;

-- ---- 4. Village submit (0017's body, plus last_submit_at and jsonb) --------

drop function if exists public.submit_village_score(numeric, text);

create function public.submit_village_score(p_score numeric, p_display_name text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  prof public.profiles;
  cap numeric;
  accepted numeric;
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

  perform public.username_ensure(uid, p_display_name);

  -- Anti-cheat ceiling: hours since the account existed × hourly rate.
  cap := (extract(epoch from (now() - prof.created_at)) / 3600.0) * 1e10;
  accepted := least(p_score, cap);

  insert into public.village_scores (player_id, best_score, last_submit_at)
  values (uid, accepted, now())
  on conflict (player_id) do update
    set best_score = greatest(village_scores.best_score, excluded.best_score),
        last_submit_at = now(),
        updated_at = case
          when excluded.best_score > village_scores.best_score then now()
          else village_scores.updated_at
        end;

  select best_score into accepted from public.village_scores where player_id = uid;
  return jsonb_build_object(
    'score', accepted,
    'now_ms', floor(extract(epoch from now()) * 1000));
end;
$fn$;

revoke execute on function public.submit_village_score(numeric, text) from public, anon;
grant execute on function public.submit_village_score(numeric, text) to authenticated;

-- ---- 5. Clock sync -----------------------------------------------------------

create or replace function public.sync_clock()
returns jsonb
language plpgsql stable security definer set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  t_last timestamptz;
  v_last timestamptz;
begin
  if uid is not null then
    select coalesce(e.last_submit_at, e.joined_at) into t_last
    from public.entries e
    where e.player_id = uid order by e.joined_at desc limit 1;

    select coalesce(v.last_submit_at, v.updated_at) into v_last
    from public.village_scores v
    where v.player_id = uid;
  end if;

  return jsonb_build_object(
    'now_ms', floor(extract(epoch from now()) * 1000),
    'tournament_last_submit_ms', floor(extract(epoch from t_last) * 1000),
    'village_last_submit_ms', floor(extract(epoch from v_last) * 1000));
end;
$fn$;

revoke execute on function public.sync_clock() from public;
grant execute on function public.sync_clock() to anon, authenticated;
