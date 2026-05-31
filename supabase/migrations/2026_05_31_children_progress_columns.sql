-- 2026-05-31  children progression columns (total_games, total_mastered)
--
-- Background: a child's points / lumens / level / streak were only ever
-- written to localStorage during gameplay and never synced back to the
-- `children` row. On the next login the app re-seeds localStorage FROM the
-- (still-zero) row, so every returning child showed Level 1, 0 points,
-- 0 lumens. The app now syncs progression to the row after each game and
-- on exit (src/App.jsx → syncActiveChildProgress).
--
-- The row already has `points`, `lumens`, `level`, `last_played_date`,
-- `current_streak`, `longest_streak`. The two columns below are what was
-- missing: level is DERIVED from total games played, so without a place to
-- store the game count the level can't be reconstructed on a fresh device.
--
-- The app degrades gracefully without this migration (it retries the sync
-- with only the always-present columns), so points/lumens/level-by-games
-- persist either way; applying this restores level on a brand-new device
-- and the mastered-word count.
--
-- Run in the Supabase SQL Editor. Idempotent.

alter table public.children
  add column if not exists total_games    integer not null default 0,
  add column if not exists total_mastered integer not null default 0;

comment on column public.children.total_games is
  'Total completed games for this child. Drives the derived level (getLevelFromGames). Synced from the app after each game.';
comment on column public.children.total_mastered is
  'Total words this child has mastered. Synced from the app after each game.';

-- Sanity check after running:
--   select id, nickname, points, lumens, level, total_games, total_mastered
--   from public.children where parent_id = auth.uid();
