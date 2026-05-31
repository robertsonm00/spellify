-- 2026-05-31  custom_lists.test_date
--
-- The app (src/hooks/useCustomLists.js → addList) writes an optional
-- `test_date` when a parent creates a word list, but the column was never
-- added to the live `custom_lists` table. PostgREST rejected every insert
-- that carried it, so for logged-in users NEW LISTS NEVER SAVED — neither
-- "random" nor custom — because both flows go through the same insert.
--
-- This adds the missing column. The app also degrades gracefully when the
-- column is absent (it retries the insert without test_date), so list
-- saving works with or without this migration; applying it simply restores
-- cloud persistence of the optional test date.
--
-- Run in the Supabase SQL Editor. Idempotent.

alter table public.custom_lists
  add column if not exists test_date date;

comment on column public.custom_lists.test_date is
  'Optional spelling-test date for a custom word list (YYYY-MM-DD). NULL = no date set.';

-- Sanity check after running:
--   select id, name, test_date from public.custom_lists
--   where user_id = auth.uid() order by created_at desc;
