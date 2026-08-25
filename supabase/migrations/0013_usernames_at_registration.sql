-- Usernames are picked once, at registration — not re-typed at every join.
--
-- Before: join_tournament(p_display_name) overwrote profiles.display_name on
-- every join, so the name was really a per-tournament field and the only place
-- it could be set was the tournament join card.
--
-- After: the name is a permanent identity made of two parts —
--   username_base   what the player typed ("vlad")
--   username_tag    a per-base sequence number the server assigns (1, 2, 3…)
-- and display_name is the rendered "vlad#1". Duplicates are the point: the
-- second vlad becomes vlad#2. Uniqueness is on (lower(base), tag), so Vlad and
-- vlad share one sequence and can never collide case-insensitively.
--
-- display_name keeps its shape and every reader (get_leaderboard,
-- get_village_top, get_tournament_state) is untouched.
--
-- p_display_name survives on both write RPCs as a *fallback base*, used only
-- when the player has no username yet — that covers anonymous players who
-- never registered, and clients from before this release that still send a
-- typed name. Once a username exists the parameter is ignored, which is what
-- makes old clients stop renaming people mid-season.
--
-- username_chosen marks a name the player actually picked. Auto-assigned names
-- (and the backfill below) leave it false, so everyone still gets exactly one
-- free pick at registration; after that claim_username refuses to change it.
--
-- Deploy DB first, then the client: the new columns and the fallback semantics
-- are backward compatible with the currently shipped build.

-- ---- Schema -----------------------------------------------------------------

alter table public.profiles
  add column if not exists username_base   text,
  add column if not exists username_tag    integer,
  add column if not exists username_chosen boolean not null default false;

create unique index if not exists profiles_username_key
  on public.profiles (lower(username_base), username_tag)
  where username_base is not null;

-- ---- Name helpers -----------------------------------------------------------

-- What a player is allowed to type. Deliberately narrow: no spaces, no '#'
-- (the tag separator), no lookalike punctuation.
create or replace function public.username_valid(p_raw text)
returns boolean
language sql immutable set search_path = public
as $$
  select coalesce(p_raw, '') ~ '^[A-Za-z0-9_]{3,16}$';
$$;

-- Coerce anything into a legal base. Used for names the player did not type at
-- a prompt — legacy client values, generated names, the backfill — where
-- raising would break a join instead of informing anyone.
create or replace function public.username_sanitize(p_raw text)
returns text
language sql immutable set search_path = public
as $$
  select case
    when length(s) > 16 then substr(s, 1, 16)
    when length(s) >= 3 then s
    else 'Player'
  end
  from (select regexp_replace(coalesce(p_raw, ''), '[^A-Za-z0-9_]', '', 'g') as s) q;
$$;

-- Assign the next free tag for a base and write the rendered name. Serialized
-- per base so two players claiming "vlad" at once get 1 and 2, never both 1.
create or replace function public.username_allocate(p_uid uuid, p_base text, p_chosen boolean)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  tag integer;
  full_name text;
begin
  perform pg_advisory_xact_lock(hashtext('username-' || lower(p_base)));

  select coalesce(max(username_tag), 0) + 1 into tag
  from public.profiles
  where lower(username_base) = lower(p_base);

  full_name := p_base || '#' || tag;

  update public.profiles
     set username_base   = p_base,
         username_tag    = tag,
         username_chosen = p_chosen,
         display_name    = full_name
   where id = p_uid;

  return full_name;
end;
$$;

-- Give the player a name if they have none, leaving an existing one alone.
create or replace function public.username_ensure(p_uid uuid, p_fallback text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  prof public.profiles;
begin
  select * into prof from public.profiles where id = p_uid;
  if prof.username_base is not null then
    return prof.display_name;
  end if;
  return public.username_allocate(p_uid, public.username_sanitize(p_fallback), false);
end;
$$;

-- ---- The one place a player names themselves --------------------------------

-- Called from the registration form. Returns the rendered "vlad#1".
create or replace function public.claim_username(p_username text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  prof public.profiles;
  base text := trim(coalesce(p_username, ''));
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if not public.username_valid(base) then
    raise exception 'username must be 3-16 characters: letters, numbers or underscore';
  end if;

  select * into prof from public.profiles where id = uid;
  if not found then
    insert into public.profiles (id) values (uid) on conflict do nothing;
    select * into prof from public.profiles where id = uid;
  end if;

  if prof.username_chosen then
    -- Permanent. Re-claiming the same base is a no-op so a registration that
    -- failed after the claim can simply be retried; anything else is refused.
    if lower(prof.username_base) = lower(base) then
      return prof.display_name;
    end if;
    raise exception 'username is already set and cannot be changed';
  end if;

  return public.username_allocate(uid, base, true);
end;
$$;

-- ---- Write RPCs: name is a fallback, never an overwrite ---------------------

-- Replaces 0001_tournament.sql L252. Only the naming block changed; the
-- seating logic below it is verbatim.
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

-- Replaces 0010_prestige_score_cap.sql L15. The 1e8/hour cap is unchanged;
-- only the naming block moves to username_ensure (same "first writer wins"
-- effect, but the name now gets a tag).
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

-- ---- Backfill ---------------------------------------------------------------

-- Existing names become the base, tagged by account age so the oldest holder of
-- a name keeps #1. Left as chosen = false: most current display_names were
-- auto-generated by randomPlayerName() and never deliberately picked, so every
-- existing player still gets their one free choice when they register.
-- Profiles with an empty display_name stay null and get named on their next
-- score submit or join.
with ranked as (
  select
    id,
    public.username_sanitize(display_name) as base,
    row_number() over (
      partition by lower(public.username_sanitize(display_name))
      order by created_at, id
    ) as tag
  from public.profiles
  where username_base is null and display_name <> ''
)
update public.profiles p
   set username_base   = r.base,
       username_tag    = r.tag,
       username_chosen = false,
       display_name    = r.base || '#' || r.tag
  from ranked r
 where p.id = r.id;

-- ---- Permissions ------------------------------------------------------------
-- claim_username is the only new player-callable RPC; the helpers are internal.

revoke execute on function public.username_valid(text) from public, anon, authenticated;
revoke execute on function public.username_sanitize(text) from public, anon, authenticated;
revoke execute on function public.username_allocate(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.username_ensure(uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_username(text) from public, anon;

grant execute on function public.claim_username(text) to authenticated;
