-- From Wood — server side of the client's hard reset.
--
-- Hard reset wipes the device completely (saves, premium purchases, account
-- workers), so the player's tournament entries must go too — otherwise the
-- next get_tournament_state re-adopts the old entry and the "fresh" account
-- finds itself still enrolled (and re-claims old tournament rewards).

create or replace function public.hard_reset_player()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  -- All entries, running and finished: history rows would re-grant their
  -- worker rewards after the local claimed-list is wiped.
  delete from public.entries where player_id = uid;
end;
$$;

revoke execute on function public.hard_reset_player() from public, anon;
grant execute on function public.hard_reset_player() to authenticated;
