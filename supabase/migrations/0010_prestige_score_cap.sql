-- Prestige (Expansion tree) score headroom.
--
-- 0008's 1e6/hour village cap was tuned to the 500-node tree's endgame
-- (net worth in the tens of millions over ~100 days). The Expansion tree
-- changes the scale: each node costs Wonders worth ~24h of a 100-crafter
-- fleet (~300M sell value at the anchor, doubling per tier), and research
-- spend counts toward net worth like any other node — so legitimate prestige
-- play accrues worth at tens of millions per hour, well over the old cap.
--
-- 1e8/hour keeps roughly the same headroom ratio over real prestige-era
-- throughput that 1e6 kept over base-tree play, while still clamping a
-- day-one cheater to ~2.4e9. The cap stays age-based and monotonic; only the
-- hourly rate changes. Deploy alongside the prestige-tree client.

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
  cap := (extract(epoch from (now() - prof.created_at)) / 3600.0) * 1e8;
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
