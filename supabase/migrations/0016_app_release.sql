-- Published release version, so a running build can tell it is stale.
--
-- One public, read-only row. The client (src/lib/version.ts) compares the
-- version baked into its bundle against latest_version and, when it is older,
-- shows a dismissible banner pointing at the store. Nothing is enforced: an
-- old build keeps playing and keeps talking to every RPC it already knows.
-- Blocking it would punish players for a store rollout they do not control,
-- and would strand anyone whose device refuses the update.
--
-- Readable by anon as well as authenticated: the check runs at launch, before
-- the game has any reason to sign the player in. Writes are service-role only
-- (RLS on, no write policy) — bump the row from the SQL editor on release.
--
-- Bootstrap caveat: builds shipped BEFORE this migration have no version-check
-- code, so they can never show the banner. The prompt only reaches players
-- from the release that carries it onward.
--
-- Deploy: run in the Supabase SQL editor, then keep latest_version in step
-- with package.json on every store release.

create table if not exists public.app_release (
  id boolean primary key default true,
  latest_version text not null,
  android_url text,
  ios_url text,
  updated_at timestamptz not null default now(),
  -- Keeps the table to exactly one row: a second insert collides on the key.
  constraint app_release_singleton check (id)
);

alter table public.app_release enable row level security;

drop policy if exists app_release_readable on public.app_release;
create policy app_release_readable
  on public.app_release for select
  to anon, authenticated
  using (true);

-- Seed / bump. Keep latest_version equal to package.json's version field.
insert into public.app_release (id, latest_version, android_url, ios_url)
values (
  true,
  '1.1.3',
  'https://play.google.com/store/apps/details?id=victorblack.fromwood',
  null
)
on conflict (id) do update
  set latest_version = excluded.latest_version,
      android_url = excluded.android_url,
      ios_url = excluded.ios_url,
      updated_at = now();
