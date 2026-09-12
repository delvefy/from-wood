-- One weekly tournament, no leagues, rewards for the whole 40-player group.
--
-- Schedule (UTC): Monday 12:00 -> next Monday 00:00 (6.5 days). The only
-- break is Monday 00:00-12:00. Replaces 0012's two 3-day slots.
--
-- Leagues are scrapped: no promotion/demotion at finalize, and groups are
-- filled in join order regardless of the player's old league. The league
-- columns stay (profiles.league, groups.league, entries.league) so nothing
-- else breaks; they are simply always 0 from now on.
--
-- Rewards go back to the original 41 - rank scale, top 40 (a full group):
--   points = 41 - rank, crafters = points / 10, gatherers = points % 10
--   1st: 4 crafters   2nd: 3c + 9g   11th: 3c   12th: 2c + 9g
--   21st: 2c          31st: 1c       32nd: 9g   40th: 1g       41st+: nothing
-- Only tournaments starting on/after 2026-09-07 00:00 UTC use it, so the
-- top-20-era tournaments (started 2026-08-14 .. 2026-09-06, incl. the one
-- running while this is applied) keep the rewards players were shown.
--
-- Deploy: run in the Supabase SQL editor. The running Fri->Mon tournament
-- finishes normally; the first weekly one opens Mon 2026-09-07 12:00 UTC.
-- Ship the client build from the same commit (league UI + reward copy).

-- ---- Schedule ---------------------------------------------------------------

-- Replaces 0012's version: a single slot Mon 12:00 -> Mon+7d 00:00. Nulls
-- during the Mon 00:00-12:00 break.
create or replace function public.tournament_current_slot(
  p timestamptz,
  out slot_start timestamptz,
  out slot_end timestamptz
)
language sql stable
as $$
  select w.mon + interval '12 hours', w.mon + interval '7 days'
  from (select date_trunc('week', p at time zone 'utc') at time zone 'utc' as mon) w
  where p >= w.mon + interval '12 hours' and p < w.mon + interval '7 days';
$$;

-- Replaces 0012's version: first Monday 12:00 UTC strictly after p.
create or replace function public.tournament_next_start(p timestamptz)
returns timestamptz
language sql stable
as $$
  select case
           when w.mon + interval '12 hours' > p then w.mon + interval '12 hours'
           else w.mon + interval '7 days 12 hours'
         end
  from (select date_trunc('week', p at time zone 'utc') at time zone 'utc' as mon) w;
$$;

revoke execute on function public.tournament_current_slot(timestamptz)
  from public, anon, authenticated;
revoke execute on function public.tournament_next_start(timestamptz)
  from public, anon, authenticated;

-- current_tournament() (0012) is unchanged: it already reads the slot from
-- tournament_current_slot and prefers any running row, so the tournament in
-- progress when this runs simply completes.

-- ---- Finalize: freeze ranks only, no promotion/demotion ----------------------

-- Replaces 0007's version.
create or replace function public.finalize_due_tournaments()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  t record;
begin
  -- One finalizer at a time; concurrent callers just skip.
  if not pg_try_advisory_xact_lock(hashtext('from-wood-finalize')) then
    return;
  end if;

  for t in
    select * from public.tournaments where status = 'running' and ends_at <= now()
  loop
    -- Freeze standings per group; ties break toward the earlier joiner.
    update public.entries e
    set final_rank = r.rnk
    from (
      select id, rank() over (partition by group_id order by score desc, joined_at asc) as rnk
      from public.entries
      where tournament_id = t.id
    ) r
    where e.id = r.id;

    update public.tournaments set status = 'finished' where id = t.id;
  end loop;
end;
$$;

-- Everyone is in the same (and only) bracket now.
update public.profiles set league = 0 where league <> 0;

-- ---- Join: 40-player groups in join order, no league split -----------------

-- Replaces 0013's version. Naming block unchanged; seating no longer keys on
-- the profile's league (groups.league / entries.league are written as 0).
create or replace function public.join_tournament(p_display_name text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.tournaments;
  prof public.profiles;
  g_id uuid;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  t := public.current_tournament();
  if t.id is null then
    raise exception 'no tournament is running right now';
  end if;

  select * into prof from public.profiles where id = uid;
  if not found then
    insert into public.profiles (id) values (uid) returning * into prof;
  end if;

  -- Names are chosen at registration. p_display_name is only a fallback base
  -- for a player who has never picked one, so joining can never rename anyone.
  perform public.username_ensure(uid, p_display_name);

  if exists (select 1 from public.entries where tournament_id = t.id and player_id = uid) then
    raise exception 'already joined this tournament';
  end if;

  -- Serialize seating per tournament so groups fill to exactly 40.
  perform pg_advisory_xact_lock(hashtext(t.id::text || '-seat'));

  select id into g_id
  from public.groups
  where tournament_id = t.id and player_count < 40
  order by seq
  limit 1;

  if g_id is null then
    insert into public.groups (tournament_id, league, seq)
    values (
      t.id,
      0,
      coalesce((select max(seq) from public.groups where tournament_id = t.id), 0) + 1
    )
    returning id into g_id;
  end if;

  insert into public.entries (tournament_id, group_id, player_id, league)
  values (t.id, g_id, uid, 0);

  update public.groups set player_count = player_count + 1 where id = g_id;

  return public.get_tournament_state();
end;
$$;

-- ---- Rewards: 41 - rank for the top 40 ---------------------------------------

-- Replaces 0012's version. Three eras, by tournament start:
--   < 2026-08-14              original 41 - rank scale
--   2026-08-14 .. 2026-09-06  top-20 scale (kept as shown to players)
--   >= 2026-09-07             41 - rank scale again
create or replace function public.reward_workers(p_player uuid)
returns table (gatherers integer, crafters integer)
language sql stable
as $$
  select coalesce(sum(g), 0)::integer,
         coalesce(sum(c), 0)::integer
  from (
    select
      case
        when t.starts_at >= timestamptz '2026-08-14 00:00:00+00'
         and t.starts_at <  timestamptz '2026-09-07 00:00:00+00' then
          case
            when e.final_rank <= 10 then 11 - e.final_rank
            when e.final_rank <= 20 then 21 - e.final_rank
            else 0
          end
        else greatest(0, 41 - e.final_rank) % 10
      end as g,
      case
        when t.starts_at >= timestamptz '2026-08-14 00:00:00+00'
         and t.starts_at <  timestamptz '2026-09-07 00:00:00+00' then
          case when e.final_rank <= 10 then 1 else 0 end
        else greatest(0, 41 - e.final_rank) / 10
      end as c
    from public.entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.player_id = p_player and e.final_rank is not null
  ) x;
$$;

revoke execute on function public.reward_workers(uuid) from public, anon, authenticated;

-- get_tournament_state (0012) and get_leaderboard (0001) are unchanged. The
-- state payload still carries 'league' fields (always 0); the client ignores
-- them.
