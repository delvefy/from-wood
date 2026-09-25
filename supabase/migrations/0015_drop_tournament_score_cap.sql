-- Drop the hard score cap from submit_score.
--
-- 0008 clamped accepted tournament scores to (hours since join) × 1e6. That
-- rate was tuned to the pre-split cost curve; since the tournament tree was
-- rebalanced to a ~3-day run, legitimate play blows past 1e6/hour within the
-- first day. The visible symptom: the top of every group sits at an identical
-- score a few million apart, ordered by who joined earliest — the cap, not the
-- run. (Keep bare dollar signs out of this file: the SQL editor's statement
-- splitter pairs one with the function body's dollar quote and then chops the
-- body on every semicolon.)
-- (0010 already raised the village cap to 1e8/hour for the same reason but
-- never touched the tournament one.)
--
-- Rather than re-tune a number that will rot again on the next rebalance, the
-- ceiling goes away entirely. 0009's predictor is the real detection layer:
-- it flags a submission whose growth since the last one outruns what the
-- reported workforce can plausibly produce, and every submission is still
-- written to the score_submissions ledger. The trade-off is explicit — a
-- forged score now lands on the board until someone acts on the flag, where
-- before it was silently clipped. Flags and the ledger are the response path.
--
-- Scores stay monotonic: an entry's score only ever moves up.
--
-- tournaments.score_cap_per_hour keeps its column (like the league columns in
-- 0014) so nothing that reads the row breaks; it now has no reader.
--
-- Deploy: run in the Supabase SQL editor. Safe mid-tournament — entries
-- currently pinned at the cap jump to their true net worth on the next sync
-- (about a minute of play).

create or replace function public.submit_score(
  p_score numeric,
  p_gatherers integer,
  p_crafters integer
) returns numeric
language plpgsql security definer set search_path = public
as $fn$
declare
  uid uuid := auth.uid();
  e public.entries;
  t public.tournaments;
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

  -- No ceiling: the best score submitted wins, monotonically.
  accepted := greatest(e.score, p_score);

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
$fn$;

revoke execute on function public.submit_score(numeric, integer, integer) from public, anon;
grant execute on function public.submit_score(numeric, integer, integer) to authenticated;
