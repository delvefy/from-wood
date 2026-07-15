-- Cloud saves — one small jsonb row per email account.
--
-- The game stays local-first: IndexedDB/localStorage are the source of truth
-- while playing. Signed-in (non-anonymous) clients back the whole local state
-- up here on a slow cadence and pull it once per sign-in / app start (see
-- src/engine/cloudSave.ts), so Supabase usage stays at a handful of requests
-- per session and a few KB per player. Anonymous identities never write rows.

create table public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  -- Backstop against runaway/hostile payloads; real saves are a few KB.
  constraint saves_payload_size check (pg_column_size(payload) <= 262144)
);

alter table public.saves enable row level security;

-- Owners read and write only their own row; writes additionally require a
-- non-anonymous account so throwaway device identities never accumulate rows.
create policy "read own save" on public.saves
  for select to authenticated using (user_id = auth.uid());

create policy "insert own save" on public.saves
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "update own save" on public.saves
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

revoke all on public.saves from anon;
grant select, insert, update on public.saves to authenticated;

-- saved_at is server-stamped for dashboard visibility; conflict resolution
-- uses the client-side savedAt inside the payload.
create or replace function public.touch_saved_at()
returns trigger
language plpgsql
as $$
begin
  new.saved_at := now();
  return new;
end;
$$;

create trigger saves_touch_saved_at
  before update on public.saves
  for each row execute function public.touch_saved_at();

revoke execute on function public.touch_saved_at() from public, anon, authenticated;
