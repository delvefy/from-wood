-- Halved promotion/demotion: at finalize, the top 20 of each full 40-player
-- group move up a league and the bottom 20 move down — everyone in a full
-- group moves. Undersized groups scale to half (round up for promotion, down
-- for demotion; never promoting from a solo group).
--
-- Replaces 0001's finalize_due_tournaments. Keep PROMOTE_COUNT/DEMOTE_COUNT
-- in src/content/tournament.ts in sync.

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

    -- Promote the top 20 (half of undersized groups; never from a solo group).
    update public.profiles p
    set league = least(p.league + 1, 4)
    from public.entries e
    join (
      select group_id, count(*)::int as n
      from public.entries where tournament_id = t.id group by group_id
    ) s on s.group_id = e.group_id
    where e.tournament_id = t.id
      and e.player_id = p.id
      and s.n >= 2
      and e.final_rank <= least(20, ceil(s.n * 0.5));

    -- Demote the bottom 20 (half of undersized groups).
    update public.profiles p
    set league = greatest(p.league - 1, 0)
    from public.entries e
    join (
      select group_id, count(*)::int as n
      from public.entries where tournament_id = t.id group by group_id
    ) s on s.group_id = e.group_id
    where e.tournament_id = t.id
      and e.player_id = p.id
      and p.league > 0
      and e.final_rank > s.n - least(20, floor(s.n * 0.5));

    update public.tournaments set status = 'finished' where id = t.id;
  end loop;
end;
$$;
