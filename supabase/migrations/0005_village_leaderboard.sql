-- From Wood — all-time village leaderboard.
--
-- One row per player holding their best-ever village net worth. The client
-- submits throttled while the village slot is live; `get_village_top` returns
-- the top 50 ever plus the caller's own rank so the UI can show "you are
-- #1234" below the board.

create table public.village_scores (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  best_score numeric not null default 0, -- monotonic: only ever raised
  -- Bumped only when best_score rises, so ties rank the earlier achiever first.
  updated_at timestamptz not null default now()
);

create index village_scores_top_idx on public.village_scores (best_score desc, updated_at asc);

alter table public.village_scores enable row level security;

-- Record the player's village net worth. Monotonic, and clamped so a score
-- can never exceed what real time since account creation allows — the server
-- clock is the only clock that counts.
-- Also sets the profile display name when it is still empty (village players
-- may never have joined a tournament, which is where names are normally set);
-- a name chosen at tournament join always wins.
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
  -- PLACEHOLDER rate — tune alongside tournaments.score_cap_per_hour.
  cap := (extract(epoch from (now() - prof.created_at)) / 3600.0) * 1e12;
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

-- The all-time top 50 village scores, plus the caller's own row (rank over the
-- whole table) so the client can render their position below the board when
-- they are not in the top.
create or replace function public.get_village_top()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  with ranked as (
    select v.player_id, v.best_score,
           coalesce(nullif(p.display_name, ''), 'Anonymous') as name,
           rank() over (order by v.best_score desc, v.updated_at asc) as rnk
    from public.village_scores v
    join public.profiles p on p.id = v.player_id
  )
  select jsonb_build_object(
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
          'rank', t.rnk,
          'name', t.name,
          'score', t.best_score,
          'is_me', t.player_id = uid
        ) order by t.rnk)
      from (select * from ranked order by rnk limit 50) t
    ), '[]'::jsonb),
    'me', (
      select jsonb_build_object('rank', rnk, 'name', name, 'score', best_score)
      from ranked where player_id = uid
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.submit_village_score(numeric, text) from public, anon;
revoke execute on function public.get_village_top() from public, anon;

grant execute on function public.submit_village_score(numeric, text) to authenticated;
grant execute on function public.get_village_top() to authenticated;
