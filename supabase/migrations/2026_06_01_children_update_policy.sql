-- 2026-06-01  children RLS UPDATE policy (the real progress-reset fix)
--
-- Symptom: a child's points / lumens / level / streak reset to 0 / Level 1
-- on every re-login, even after the app started syncing progression back to
-- the `children` row after each game (src/App.jsx → syncActiveChildProgress).
--
-- Root cause: the `children` table has RLS enabled with SELECT and INSERT
-- policies (the app can read its children and create them) but NO UPDATE
-- policy. Under Postgres RLS, an UPDATE with no matching policy is not an
-- error — it simply matches ZERO rows and returns success. So every
-- progression sync "succeeded" while writing nothing, the row stayed at 0,
-- and the next login re-seeded localStorage FROM those zeros. The only
-- UPDATE against `children` in the whole codebase is that sync, so this gap
-- was never exercised before progression sync existed.
--
-- This adds the missing self-scoped UPDATE policy + the UPDATE grant, keyed
-- on the owning parent (children.parent_id = auth.uid()), mirroring the
-- profiles_update_own pattern in 2026_05_26_profiles_trigger_and_rls.sql.
--
-- Run in the Supabase SQL Editor. Safe to re-run (drop-if-exists first).

-- Ensure RLS is on (no-op if already enabled) and the authenticated role is
-- actually granted UPDATE — a policy without the grant still can't write.
alter table public.children enable row level security;
grant update on table public.children to authenticated;

drop policy if exists "children_update_own" on public.children;

create policy "children_update_own"
  on public.children for update to authenticated
  using      (parent_id = auth.uid())
  with check (parent_id = auth.uid());

-- ── Verification ───────────────────────────────────────────────────
-- Policy present?
--   select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='children' order by cmd;
--   -- expect a row: children_update_own (UPDATE)
--
-- End-to-end (run while signed in as a parent, with one of your children):
--   update public.children set points = points
--   where parent_id = auth.uid()
--   returning id, nickname, points;
--   -- expect: your child row(s) returned. Zero rows ⇒ policy still missing.
