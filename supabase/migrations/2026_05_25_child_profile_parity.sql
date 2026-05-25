-- 2026-05-25  Child profile parity + guest-session migration support (v3)
--
-- This migration has been pared back to ONLY what's genuinely missing
-- from the live schema. Earlier versions tried to add columns that
-- already exist (sen_profile, active_buddy_id) or that clashed with
-- a Postgres reserved keyword (`character`). Discovered via
-- information_schema dump on 2026-05-25.
--
-- What this migration adds:
--   • current_streak    (integer, default 0)
--   • longest_streak    (integer, default 0)
--   • last_played_date  (date)
--
-- What it does NOT add (already present — verify before running):
--   • buddy / character  → use existing `active_buddy_id`
--   • sen_profile        → already present
--   • points, lumens     → already present
--
-- Run in the Supabase SQL Editor. Idempotent (`if not exists`).
-- Pre-flight check:
--   select column_name from information_schema.columns
--   where table_schema='public' and table_name='children'
--     and column_name in ('current_streak','longest_streak','last_played_date');
-- Should return zero rows before running. After running, all three.

alter table public.children
  add column if not exists current_streak     integer not null default 0,
  add column if not exists longest_streak     integer not null default 0,
  add column if not exists last_played_date   date;

comment on column public.children.current_streak   is 'Days-in-a-row at sign-up (kept in sync by gameplay later).';
comment on column public.children.longest_streak   is 'Best-ever streak — preserved across resets.';
comment on column public.children.last_played_date is 'YYYY-MM-DD of last play, for streak continuity.';

-- ── Cleanup: drop any leftover parallel columns from previous
-- migration attempts. Safe no-ops if absent.
alter table public.children
  drop column if exists total_points,
  drop column if exists total_lumens,
  drop column if exists buddy;

-- ── Post-flight verification ──────────────────────────────────────
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema='public' and table_name='children'
--   order by ordinal_position;
--
-- Expected NEW columns:
--   current_streak     integer  NOT NULL  default 0
--   longest_streak     integer  NOT NULL  default 0
--   last_played_date   date     NULL
