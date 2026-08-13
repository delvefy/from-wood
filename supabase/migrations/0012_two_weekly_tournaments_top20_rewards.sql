-- Two tournaments per week + worker rewards for the top 20 only.
--
-- Schedule (UTC), anchored on Monday 00:00:
--   slot A: Monday 12:00 -> Thursday 12:00
--   slot B: Friday 00:00 -> Monday 00:00
-- Both slots are exactly 3 days, so the client's "races for 3 days" copy
-- stays true. Client copy that is now stale until the next release:
--   - TournamentView.svelte: "opens every Friday at 00:00 UTC"
--   - src/content/tournament.ts: rewardForRank / rewardLabel / REWARD_SUMMARY
--     still show the old 41 - rank scale for every rank; actual grants are
--     server-truth, so only the displayed text is wrong until a client update.
--
-- Rewards: only the top 20 earn workers, on a new scale:
--   ranks 1-10:  1 crafter + (11 - rank) gatherers   (1st: 1c + 10g ... 10th: 1c + 1g)
--   ranks 11-20: (21 - rank) gatherers               (11th: 10g ... 20th: 1g)
--   ranks 21+:   nothing
-- Applies only to tournaments starting on/after 2026-08-14 00:00 UTC so
-- already-finalized entries keep the rewards players were shown at the time.
--
-- DB-only deploy: run this in the Supabase SQL editor; no client build needed.

-- ---- Schedule ---------------------------------------------------------------

-- The slot containing p, if any (nulls during the two breaks:
-- Mon 00:00-12:00 and Thu 12:00 - Fri 00:00).
create or replace function public.tournament_current_slot(
  p timestamptz,
  out slot_start timestamptz,
  out slot_end timestamptz
)
language sql stable
as $$
  select s, e
  from (select date_trunc('week', p at time zone 'utc') at time zone 'utc' as mon) w,
       lateral (values
         (w.mon + interval '12 hours', w.mon + interval '3 days 12 hours'),
         (w.mon + interval '4 days',   w.mon + interval '7 days')
       ) slots(s, e)
  where p >= s and p < e;
$$;

-- First slot start strictly after p.
create or replace function public.tournament_next_start(p timestamptz)
returns timestamptz
language sql stable
as $$
  select min(w.mon + v.off)
  from (select date_trunc('week', p at time zone 'utc') at time zone 'utc' as mon) w,
       (values (interval '12 hours'),
               (interval '4 days'),
               (interval '7 days 12 hours')) v(off)
  where w.mon + v.off > p;
$$;

revoke execute on function public.tournament_current_slot(timestamptz)
  from public, anon, authenticated;
revoke execute on function public.tournament_next_start(timestamptz)
  from public, anon, authenticated;

-- Replaces 0003's version: same lazy insert-on-first-read, but against the
-- two weekly slots instead of the single Friday window. tournament_week_start
-- (0001) is left in place but is no longer referenced.
create or replace function public.current_tournament()
returns public.tournaments
language plpgsql security definer set search_path = public
as $$
declare
  s timestamptz;
  e timestamptz;
  t public.tournaments;
begin
  select * into t from public.tournaments
  where status = 'running' and starts_at <= now() and ends_at > now()
  order by starts_at desc
  limit 1;
  if found then
    return t;
  end if;

  select slot_start, slot_end into s, e from public.tournament_current_slot(now());
  if s is null then
    return null;
  end if;
  insert into public.tournaments (starts_at, ends_at) values (s, e)
  on conflict (starts_at) do nothing;
  select * into t from public.tournaments where starts_at = s;
  if t.status = 'running' and t.ends_at > now() then
    return t;
  end if;
  return null;
end;
$$;

-- ---- Rewards: top 20 only, new scale ----------------------------------------

-- Replaces 0009's version. Entries from tournaments starting on/after the
-- cutoff use the new top-20 scale; earlier entries keep the old
-- every-place-wins payout (rewards are recomputed from all finalized entries
-- on every read, so without the cutoff this change would retroactively strip
-- workers players already have). The old value % 10 / value / 10 encoding
-- cannot express "10 gatherers", so gatherers and crafters are summed
-- separately per entry.
create or replace function public.reward_workers(p_player uuid)
returns table (gatherers integer, crafters integer)
language sql stable
as $$
  select coalesce(sum(g), 0)::integer,
         coalesce(sum(c), 0)::integer
  from (
    select
      case
        when t.starts_at >= timestamptz '2026-08-14 00:00:00+00' then
          case
            when e.final_rank <= 10 then 11 - e.final_rank
            when e.final_rank <= 20 then 21 - e.final_rank
            else 0
          end
        else greatest(0, 41 - e.final_rank) % 10
      end as g,
      case
        when t.starts_at >= timestamptz '2026-08-14 00:00:00+00' then
          case when e.final_rank <= 10 then 1 else 0 end
        else greatest(0, 41 - e.final_rank) / 10
      end as c
    from public.entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.player_id = p_player and e.final_rank is not null
  ) x;
$$;

revoke execute on function public.reward_workers(uuid) from public, anon, authenticated;

-- ---- get_tournament_state: new next_starts_at -------------------------------

-- Replaces 0009's version; identical except next_starts_at now comes from
-- tournament_next_start instead of tournament_week_start + 7 days.
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
    'next_starts_at', public.tournament_next_start(now()),
    'tournament', case when t.id is null then null else jsonb_build_object(
      'id', t.id, 'starts_at', t.starts_at, 'ends_at', t.ends_at) end,
    'entry', entry_json,
    'rewards', jsonb_build_object('gatherers', rw.gatherers, 'crafters', rw.crafters)
  );
end;
$$;
