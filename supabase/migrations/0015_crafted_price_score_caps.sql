-- Score headroom for the crafted-price rework.
--
-- Crafted items are now priced so each crafter adds K(tier) gatherers' worth
-- of value per second (content/resources.ts, priceCraftedItems): the best
-- recipe went from ~12 to ~917 credits/s per crafter (~54 top-raw gatherers,
-- ×70–350 at tiers 5–9). Crafter-heavy late play (tournament endgame, village
-- prestige era) therefore grows net worth ~50–100× faster than the caps below
-- were tuned for. Gatherer income and research quantities are unchanged.

-- 1. Tournament hard cap: ×100, for new and existing tournaments.
alter table public.tournaments alter column score_cap_per_hour set default 1e8;
update public.tournaments set score_cap_per_hour = score_cap_per_hour * 100;

-- 2. Predictor: submit_score still weighs a crafter as 10 gatherers, but one
--    is now worth up to ~54. Raising the per-worker rate ×6 covers crews up to
--    ~50 crafters per 100 gatherers without rewriting the function; flags only
--    mark entries for review, so the looser gatherer-only allowance is fine.
alter table public.tournaments alter column cheat_rate_per_worker_hour set default 2.5e5;
update public.tournaments set cheat_rate_per_worker_hour = 2.5e5
where cheat_rate_per_worker_hour < 2.5e5;

-- 3. Village: replaces 0013's version; identical except the hourly cap rate
--    goes 1e8 → 1e10.
create or replace function public.submit_village_score(p_score numeric, p_display_name text default null)
returns numeric
language plpgsql security definer set search_path = public
as $$
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
