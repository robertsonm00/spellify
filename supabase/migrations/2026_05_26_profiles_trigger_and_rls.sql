-- 2026-05-26  profiles trigger + RLS + backfill
--
-- Diagnosis (May 2026): the client code at src/lib/auth.js assumes
-- a DB trigger creates the `profiles` row on every new auth.users
-- insert ("the profile row is created automatically by a DB trigger"
-- — comment in lib/auth.js). The trigger was never installed in this
-- Supabase project, so signing up creates an auth.users row but no
-- profiles row, and the PIN gate's profile-fetch + upsert path
-- silently no-ops.
--
-- This migration:
--   1. Installs the `handle_new_user` trigger (SECURITY DEFINER, so
--      it can write to public.profiles regardless of RLS).
--   2. Enables RLS on profiles and adds self-only select/insert/
--      update policies + grants for the authenticated role. Without
--      these, the trigger's row is inserted but the client can't see
--      or modify it.
--   3. Backfills profiles rows for every existing auth.users row
--      that doesn't have one — so your test accounts work without
--      having to re-sign-up.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

-- ── 1. Trigger function ────────────────────────────────────────────
-- IMPORTANT (May 2026 schema audit): public.profiles has no
-- `display_name` column. An earlier draft of this trigger tried to
-- insert one and silently failed on every signup (rolling back the
-- auth.users insert). We now insert only `id` and rely on the table
-- defaults for everything else: subscription_tier='free',
-- subscription_status='active', timezone='Europe/London',
-- updated_at=now(), created_at=now().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Inserts a public.profiles row (id only) for every new auth.users record. SECURITY DEFINER so RLS does not block. All other profiles columns have defaults.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2. RLS + grants for profiles ───────────────────────────────────
alter table public.profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;

-- Ensure the trigger function owner (postgres / supabase_auth_admin) can
-- always insert into profiles, regardless of RLS policies.
grant insert on public.profiles to postgres;
grant insert on public.profiles to supabase_auth_admin;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using  (id = auth.uid())
  with check (id = auth.uid());

-- ── 3. Backfill existing auth.users → profiles ─────────────────────
-- Bridges accounts created BEFORE the trigger existed. Schema-safe:
-- only inserts `id`, lets table defaults handle everything else.
insert into public.profiles (id)
select u.id
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ── 4. Verification queries ────────────────────────────────────────
-- Run these after the migration to confirm everything's wired up:
--
-- Trigger present?
--   select trigger_name from information_schema.triggers
--   where event_object_table = 'users' and trigger_schema = 'auth';
--   -- expect: on_auth_user_created
--
-- Your profile row exists?
--   select id, display_name, (parent_pin_hash is not null) as has_pin
--   from public.profiles where id = auth.uid();
--   -- expect: 1 row
--
-- Policies present?
--   select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='profiles' order by cmd;
--   -- expect: profiles_select_own (SELECT), profiles_insert_own (INSERT),
--   --         profiles_update_own (UPDATE)
