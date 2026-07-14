-- Email/password accounts.
--
-- Registration, sign-in and password change use Supabase Auth directly from
-- the client. Password reset goes through the reset-password Edge Function
-- (supabase/functions/reset-password), which needs to translate an email into
-- a user id; the auth schema is not exposed over the API, so that lookup is
-- this definer function, callable by the service role only.

create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql
security definer set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke execute on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;
