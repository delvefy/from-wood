-- Dev/testing tournament controls: start and end tournaments on command from
-- the Settings tab, instead of waiting for the weekly Friday window.
--
-- Guarded by a shared admin key (players are anonymous, so there is no role
-- to check). CHANGE THE KEY in dev_assert_key before running this migration,
-- and drop both dev_* functions before a real launch:
--   drop function public.dev_start_tournament(text, integer);
--   drop function public.dev_end_tournament(text);

create or replace function public.dev_assert_key(p_key text)
returns void
language plpgsql
as $$
begin
  if p_key is distinct from '215ba0c66eaab4c900443abe' then
    raise exception 'bad admin key';
  end if;
end;
$$;

-- Replaces 0001's version. Any running tournament that covers now() counts
-- (so dev-started ones are picked up); otherwise fall back to creating the
-- weekly tournament inside its Friday → Monday window. A weekly row that was
-- ended early by dev_end_tournament stays ended.
create or replace function public.current_tournament()
returns public.tournaments
language plpgsql security definer set search_path = public
as $$
declare
  ws timestamptz := public.tournament_week_start(now());
  we timestamptz := ws + interval '3 days';
  t public.tournaments;
begin
  select * into t from public.tournaments
  where status = 'running' and starts_at <= now() and ends_at > now()
  order by starts_at desc
  limit 1;
  if found then
    return t;
  end if;

  if now() >= we then
    return null;
  end if;
  insert into public.tournaments (starts_at, ends_at) values (ws, we)
  on conflict (starts_at) do nothing;
  select * into t from public.tournaments where starts_at = ws;
  if t.status = 'running' and t.ends_at > now() then
    return t;
  end if;
  return null;
end;
$$;

-- Ends whatever is running (finalizing ranks, promotions and rewards), then
-- starts a fresh tournament right now for p_minutes (default 3 days).
create or replace function public.dev_start_tournament(p_key text, p_minutes integer default 4320)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.dev_assert_key(p_key);
  update public.tournaments set ends_at = now()
  where status = 'running' and ends_at > now();
  perform public.finalize_due_tournaments();
  insert into public.tournaments (starts_at, ends_at)
  values (now(), now() + make_interval(mins => greatest(coalesce(p_minutes, 4320), 1)));
  return public.get_tournament_state();
end;
$$;

-- Ends the running tournament immediately and finalizes it, so final ranks
-- (and client-side worker rewards) land right away.
create or replace function public.dev_end_tournament(p_key text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.dev_assert_key(p_key);
  update public.tournaments set ends_at = now()
  where status = 'running' and ends_at > now();
  perform public.finalize_due_tournaments();
  return public.get_tournament_state();
end;
$$;

revoke execute on function public.dev_assert_key(text) from public, anon, authenticated;
revoke execute on function public.dev_start_tournament(text, integer) from public, anon;
revoke execute on function public.dev_end_tournament(text) from public, anon;

grant execute on function public.dev_start_tournament(text, integer) to authenticated;
grant execute on function public.dev_end_tournament(text) to authenticated;
