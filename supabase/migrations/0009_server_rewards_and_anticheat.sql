-- Server-authoritative worker rewards + predictive anti-cheat, three parts:
--
-- 1. Reward workers become server truth. Until now the client granted itself
--    tournament worker rewards in localStorage (trivially forgeable, and the
--    permanent, compounding meta-progression — the thing most worth cheating).
--    Every entry's final_rank is already frozen server-side at finalize, and
--    the reward is a pure function of rank, so get_tournament_state now
--    returns the account's total earned reward workers computed from finalized
--    entries. The client overwrites its local values with these on every
--    refresh instead of self-granting.
--
-- 2. A score predictor on submit_score. The client now reports its worker
--    counts alongside the score; the server predicts the maximum plausible
--    net-worth growth since the last submit (elapsed server time × per-worker
--    rate × effective workers) and, when the submitted score drifts past it —
--    or the reported workforce itself is implausible — flags the entry.
--    Flag-only for now: the score is still accepted (subject to the existing
--    hard cap from 0008), but cheat_flags/cheat_reason mark the entry for
--    review. Catches console-forged scores AND device-clock offline-catchup
--    farming (real elapsed time is short even though game time jumped).
--
--    Rate calibration (tune with real ledger data): simulated optimal play
--    (scripts/simulate-tournament.ts, 100 gatherers + 10 crafters = 200
--    gatherer-equivalents) finishes the tournament tree in ~24h at ~9e6 total
--    net worth — ~2e3/worker-hour average, maybe ~5e3 at the late-game peak,
--    up to ~2e4 with all premium doublers. Default 4e4 leaves ~2x headroom
--    over the fastest conceivable legitimate pace.
--
-- 3. A score_submissions ledger (one row per submit: reported score, workers,
--    verdict). Blocks nothing, but a cheater's history looks nothing like
--    real play, and the ledger is the data for tuning the rate constants.
--    Service-role only. Rows cascade away with the entry (hard reset).

-- ---- 1. Server-computed reward workers -------------------------------------------

-- Total reward workers earned across all finalized entries. Mirrors
-- rewardForRank in src/content/tournament.ts: value = max(0, 41 - rank),
-- paid as floor(value/10) crafters plus (value % 10) gatherers.
create or replace function public.reward_workers(p_player uuid)
returns table (gatherers integer, crafters integer)
language sql stable
as $$
  select coalesce(sum(v % 10), 0)::integer,
         coalesce(sum(v / 10), 0)::integer
  from (
    select greatest(0, 41 - e.final_rank) as v
    from public.entries e
    where e.player_id = p_player and e.final_rank is not null
  ) x;
$$;

revoke execute on function public.reward_workers(uuid) from public, anon, authenticated;

-- Replaces 0001's version: identical plus the 'rewards' field.
create or replace function public.get_tournament_state()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.tournaments;
  prof public.profiles;
  entry_json jsonb;
  rw record;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  perform public.finalize_due_tournaments();
  t := public.current_tournament();

  select * into prof from public.profiles where id = uid;
  if not found then
    insert into public.profiles (id) values (uid)
    on conflict do nothing;
    select * into prof from public.profiles where id = uid;
  end if;

  -- The player's most recent entry (current or last finished tournament).
  select jsonb_build_object(
      'tournament_id', e.tournament_id,
      'group_id', e.group_id,
      'league', e.league,
      'joined_at', e.joined_at,
      'score', e.score,
      'final_rank', e.final_rank,
      'group_size', g.player_count,
      'starts_at', tt.starts_at,
      'ends_at', tt.ends_at,
      'status', tt.status)
  into entry_json
  from public.entries e
  join public.tournaments tt on tt.id = e.tournament_id
  join public.groups g on g.id = e.group_id
  where e.player_id = uid
  order by e.joined_at desc
  limit 1;

  select * into rw from public.reward_workers(uid);

  return jsonb_build_object(
    'now', now(),
    'league', prof.league,
    'display_name', prof.display_name,
    'next_starts_at', public.tournament_week_start(now()) + interval '7 days',
    'tournament', case when t.id is null then null else jsonb_build_object(
      'id', t.id, 'starts_at', t.starts_at, 'ends_at', t.ends_at) end,
    'entry', entry_json,
    'rewards', jsonb_build_object('gatherers', rw.gatherers, 'crafters', rw.crafters)
  );
end;
$$;

-- ---- 2 + 3. Predictor knobs, cheat flags, submission ledger -----------------------

-- Per-tournament predictor knobs, so tuning needs no migration. "Effective
-- workers" = gatherers + 10 × crafters (a crafter is paced as a block of ten
-- gatherers throughout the content).
alter table public.tournaments
  add column cheat_rate_per_worker_hour numeric not null default 4e4,
  add column cheat_max_workers integer not null default 600;

alter table public.entries
  add column cheat_flags integer not null default 0,
  add column cheat_reason text,
  add column cheat_flagged_at timestamptz;

create table public.score_submissions (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.entries(id) on delete cascade,
  player_id uuid not null,
  tournament_id uuid not null,
  submitted_at timestamptz not null default now(),
  reported_score numeric not null,
  accepted_score numeric not null,
  gatherers integer not null,
  crafters integer not null,
  flagged boolean not null default false,
  flag_reason text
);

create index score_submissions_entry_idx
  on public.score_submissions (entry_id, submitted_at desc);

-- Service-role only: RLS on, no policies.
alter table public.score_submissions enable row level security;

-- Replaces 0001's submit_score. The old single-argument signature is dropped
-- (not wrapped) so there is no submission path that skips the predictor;
-- deploy the client alongside this migration.
drop function public.submit_score(numeric);

create function public.submit_score(
  p_score numeric,
  p_gatherers integer,
  p_crafters integer
) returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.entries;
  t public.tournaments;
  cap numeric;
  accepted numeric;
  eff integer;
  elapsed_h numeric;
  allowed numeric;
  reason text := null;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_score is null or p_score < 0 or p_score > 1e30 then
    raise exception 'invalid score';
  end if;
  if p_gatherers is null or p_gatherers < 0 or p_gatherers > 1000000
     or p_crafters is null or p_crafters < 0 or p_crafters > 1000000 then
    raise exception 'invalid workers';
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

  cap := (extract(epoch from (now() - e.joined_at)) / 3600.0) * t.score_cap_per_hour;
  accepted := greatest(e.score, least(p_score, cap));

  -- Predictor: since the last submit (or join), the score can plausibly have
  -- grown by elapsed × rate × workforce. Elapsed is floored at one minute so
  -- back-to-back forced submits (mode switches) never flag on noise, and the
  -- workforce is floored at 10 and capped at cheat_max_workers so neither a
  -- tiny nor an inflated reported crew distorts the allowance.
  eff := p_gatherers + 10 * p_crafters;
  elapsed_h := greatest(
    extract(epoch from (now() - coalesce(e.last_submit_at, e.joined_at))) / 3600.0,
    1.0 / 60.0);
  allowed := e.score + elapsed_h * t.cheat_rate_per_worker_hour
             * greatest(least(eff, t.cheat_max_workers), 10);

  if eff > t.cheat_max_workers then
    reason := format('implausible workforce: %s gatherers + %s crafters (%s effective, max %s)',
                     p_gatherers, p_crafters, eff, t.cheat_max_workers);
  elsif p_score > allowed then
    reason := format('score drift: reported %s, predicted at most %s (%s effective workers, %s h elapsed)',
                     round(p_score), round(allowed), eff, round(elapsed_h, 2));
  end if;

  if reason is not null then
    update public.entries
    set cheat_flags = cheat_flags + 1,
        cheat_reason = reason,
        cheat_flagged_at = now()
    where id = e.id;
  end if;

  insert into public.score_submissions
    (entry_id, player_id, tournament_id, reported_score, accepted_score,
     gatherers, crafters, flagged, flag_reason)
  values
    (e.id, uid, e.tournament_id, p_score, accepted,
     p_gatherers, p_crafters, reason is not null, reason);

  update public.entries set score = accepted, last_submit_at = now() where id = e.id;
  return accepted;
end;
$$;

revoke execute on function public.submit_score(numeric, integer, integer) from public, anon;
grant execute on function public.submit_score(numeric, integer, integer) to authenticated;
