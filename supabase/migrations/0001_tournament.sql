-- From Wood — weekly tournament backend.
--
-- The whole backend is this file: four tables locked behind RLS, and
-- security-definer RPCs the client calls. All timestamps are stamped by
-- Postgres (`now()`), never by the client, so device-clock manipulation
-- cannot fake elapsed time.
--
-- Schedule: a tournament starts every Friday 00:00 UTC and runs 3 days
-- (ends Monday 00:00 UTC); the rest of the week is the results/break window.
-- Players can join any time while it runs. Groups hold up to 40 players of the same
-- league; leagues run 0..4 (Sapling → Worldtree). At the end, the top 8 of
-- each group promote and the bottom 8 demote (scaled down for small groups).
--
-- Requires: anonymous sign-ins enabled (Authentication → Sign In / Up).

-- ---- Tables -----------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  league smallint not null default 0, -- 0..4, see LEAGUES in the client
  rating integer not null default 1000, -- reserved for future Elo-style seeding
  created_at timestamptz not null default now()
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  ends_at timestamptz not null,
  status text not null default 'running' check (status in ('running', 'finished')),
  -- Anti-cheat ceiling: a submitted score can never exceed
  -- hours-since-join × this rate. PLACEHOLDER — tune once real score data exists.
  score_cap_per_hour numeric not null default 1e12
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  league smallint not null,
  seq integer not null, -- fill order within (tournament, league)
  player_count integer not null default 0,
  unique (tournament_id, league, seq)
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  league smallint not null, -- league at join time (profile may move later)
  joined_at timestamptz not null default now(),
  score numeric not null default 0, -- monotonic: only ever raised
  last_submit_at timestamptz,
  final_rank integer, -- frozen at finalize
  unique (tournament_id, player_id)
);

create index entries_group_idx on public.entries (group_id);
create index entries_player_idx on public.entries (player_id, joined_at desc);

-- ---- Row-level security -------------------------------------------------------
-- Everything is locked down; clients go through the definer RPCs below. The two
-- read policies exist only for debugging convenience.

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.groups enable row level security;
alter table public.entries enable row level security;

create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "read tournaments" on public.tournaments
  for select to authenticated using (true);

-- ---- Profile bootstrap ---------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- Scheduling helpers ----------------------------------------------------------

-- Most recent Friday 00:00 UTC at or before p.
create or replace function public.tournament_week_start(p timestamptz)
returns timestamptz
language sql immutable
as $$
  select case when fri > p then fri - interval '7 days' else fri end
  from (
    -- Monday 00:00 of p's ISO week (in UTC) + 4 days = Friday 00:00 UTC.
    select (date_trunc('week', p at time zone 'utc') + interval '4 days') at time zone 'utc' as fri
  ) x;
$$;

-- The tournament for the current window, created on first demand. Returns
-- null during the break (between Monday 00:00 and Friday 00:00 UTC).
create or replace function public.current_tournament()
returns public.tournaments
language plpgsql security definer set search_path = public
as $$
declare
  ws timestamptz := public.tournament_week_start(now());
  we timestamptz := ws + interval '3 days';
  t public.tournaments;
begin
  if now() >= we then
    return null;
  end if;
  select * into t from public.tournaments where starts_at = ws;
  if not found then
    insert into public.tournaments (starts_at, ends_at) values (ws, we)
    on conflict (starts_at) do nothing;
    select * into t from public.tournaments where starts_at = ws;
  end if;
  return t;
end;
$$;

-- ---- Finalize (no cron needed: piggybacks on get_tournament_state) ---------------

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

    -- Promote the top 8 (20% of undersized groups; never from a solo group).
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
      and e.final_rank <= least(8, ceil(s.n * 0.2));

    -- Demote the bottom 8 (20% of undersized groups).
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
      and e.final_rank > s.n - least(8, floor(s.n * 0.2));

    update public.tournaments set status = 'finished' where id = t.id;
  end loop;
end;
$$;

-- ---- Client RPCs -------------------------------------------------------------------

-- Everything the client needs on load, in one call. Also creates the weekly
-- tournament row on demand and finalizes any tournament that has ended.
create or replace function public.get_tournament_state()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.tournaments;
  prof public.profiles;
  entry_json jsonb;
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

  return jsonb_build_object(
    'now', now(),
    'league', prof.league,
    'display_name', prof.display_name,
    'next_starts_at', public.tournament_week_start(now()) + interval '7 days',
    'tournament', case when t.id is null then null else jsonb_build_object(
      'id', t.id, 'starts_at', t.starts_at, 'ends_at', t.ends_at) end,
    'entry', entry_json
  );
end;
$$;

-- Join the running tournament: sets the display name, then seats the player in
-- the first non-full group of their league (creating a new group when all are
-- full). Group assignment is serialized per (tournament, league) so groups
-- fill to exactly 40.
create or replace function public.join_tournament(p_display_name text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.tournaments;
  prof public.profiles;
  g_id uuid;
  nm text;
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

  nm := trim(coalesce(p_display_name, ''));
  if length(nm) < 1 or length(nm) > 24 then
    raise exception 'name must be 1-24 characters';
  end if;
  update public.profiles set display_name = nm where id = uid;

  if exists (select 1 from public.entries where tournament_id = t.id and player_id = uid) then
    raise exception 'already joined this tournament';
  end if;

  perform pg_advisory_xact_lock(hashtext(t.id::text || '-league-' || prof.league::text));

  select id into g_id
  from public.groups
  where tournament_id = t.id and league = prof.league and player_count < 40
  order by seq
  limit 1;

  if g_id is null then
    insert into public.groups (tournament_id, league, seq)
    values (
      t.id,
      prof.league,
      coalesce((select max(seq) from public.groups
                where tournament_id = t.id and league = prof.league), 0) + 1
    )
    returning id into g_id;
  end if;

  insert into public.entries (tournament_id, group_id, player_id, league)
  values (t.id, g_id, uid, prof.league);

  update public.groups set player_count = player_count + 1 where id = g_id;

  return public.get_tournament_state();
end;
$$;

-- Record a score for the player's current entry. Scores are monotonic (only
-- ever raised) and clamped so they can never exceed what real elapsed time
-- since joining allows — the server clock is the only clock that counts.
create or replace function public.submit_score(p_score numeric)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e public.entries;
  t public.tournaments;
  cap numeric;
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

  cap := (extract(epoch from (now() - e.joined_at)) / 3600.0) * t.score_cap_per_hour;
  accepted := greatest(e.score, least(p_score, cap));
  update public.entries set score = accepted, last_submit_at = now() where id = e.id;
  return accepted;
end;
$$;

-- The 40-row leaderboard of the player's group (most recent entry). Live rank
-- while running, frozen final_rank after finalize.
create or replace function public.get_leaderboard()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
  result jsonb;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select group_id into gid from public.entries
  where player_id = uid order by joined_at desc limit 1;
  if gid is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'rank', coalesce(x.final_rank, x.live_rank),
      'name', coalesce(nullif(x.display_name, ''), 'Anonymous'),
      'score', x.score,
      'is_me', x.player_id = uid
    ) order by coalesce(x.final_rank, x.live_rank)), '[]'::jsonb)
  into result
  from (
    select e.player_id, e.score, e.final_rank, e.joined_at, p.display_name,
           rank() over (order by e.score desc, e.joined_at asc) as live_rank
    from public.entries e
    join public.profiles p on p.id = e.player_id
    where e.group_id = gid
  ) x;

  return result;
end;
$$;

-- ---- Permissions ----------------------------------------------------------------
-- RPCs are for signed-in (anonymous) players only; internals are not callable.

revoke execute on function public.get_tournament_state() from public, anon;
revoke execute on function public.join_tournament(text) from public, anon;
revoke execute on function public.submit_score(numeric) from public, anon;
revoke execute on function public.get_leaderboard() from public, anon;
revoke execute on function public.current_tournament() from public, anon, authenticated;
revoke execute on function public.finalize_due_tournaments() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.get_tournament_state() to authenticated;
grant execute on function public.join_tournament(text) to authenticated;
grant execute on function public.submit_score(numeric) to authenticated;
grant execute on function public.get_leaderboard() to authenticated;
