/**
 * migrationService — all data-transfer logic for the guest → Supabase
 * progress save flow. No UI here; MigratePrompt.jsx owns the presentation.
 *
 * What migrates:
 *   1. Custom word lists   spellify_custom_lists → custom_lists (Supabase)
 *   2. Per-word mastery    spellify_mastery_*    → mastery_records (Supabase)
 *   3. Player stats        totalPoints / totalLumens → children.points / .lumens
 *   4. Streak              currentStreak / longestStreak / lastPlayedDate
 *                          → children.current_streak / .longest_streak / .last_played_date
 *   5. (best-effort) Event log → migration_events (Supabase, silent on error)
 *
 * Robustness contract:
 *   - Every write checks its error field; the first real failure aborts
 *     and returns { ok: false, error: <human message> }.
 *   - localStorage is NEVER cleared here — the caller decides.
 *   - The custom_lists localStorage key IS removed when lists land in
 *     Supabase so useCustomLists doesn't re-surface stale guest data.
 *   - Event logging is best-effort (try/catch); table may not exist yet.
 *
 * migration_events table (create if you want the log):
 *   create table migration_events (
 *     id uuid default gen_random_uuid() primary key,
 *     child_id   uuid references children(id) on delete cascade,
 *     user_id    uuid references auth.users(id) on delete set null,
 *     lists_migrated        integer default 0,
 *     mastery_rows_migrated integer default 0,
 *     points_migrated       integer default 0,
 *     streak_migrated       integer default 0,
 *     migrated_at timestamp with time zone default now()
 *   );
 *   alter table migration_events enable row level security;
 *   create policy "service can insert migration events" on migration_events
 *     for insert with check (true);
 */

import { supabase } from './supabase';

const MASTERY_PREFIX    = 'spellify_mastery_';
const STATS_KEY         = 'spellify_player_stats';
const STREAK_KEY        = 'spellify_streak';
const CUSTOM_LISTS_KEY  = 'spellify_custom_lists';

// ── Read all guest data from localStorage ──────────────────────────────────

/**
 * Gather all guest progress from localStorage into a single data object.
 *
 * @param {object|null} snapStats  - snapshot captured before any wipe (from guestPrefill._stats)
 * @param {object|null} snapStreak - snapshot captured before any wipe (from guestPrefill._streak)
 * @returns {{ lists, masteryRows, stats, streak, summary }}
 */
export function gatherGuestData(snapStats = null, snapStreak = null) {
  // ── Custom word lists ──────────────────────────────────────────────
  let lists = [];
  try {
    const raw = localStorage.getItem(CUSTOM_LISTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    lists = Array.isArray(parsed) ? parsed : [];
  } catch { lists = []; }

  // ── Per-word mastery ───────────────────────────────────────────────
  const masteryRows = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(MASTERY_PREFIX)) continue;
      try {
        const obj    = JSON.parse(localStorage.getItem(k) || '{}');
        const listId = obj?.listId || k.slice(MASTERY_PREFIX.length);
        const words  = obj?.words  || {};
        for (const w of Object.values(words)) {
          if (!w?.word) continue;
          masteryRows.push({
            list_id:        listId,
            word:           w.word,
            mastered:       !!w.mastered,
            struggling:     !!w.struggling,
            credit_by_game: w.creditByGame || {},
          });
        }
      } catch { /* skip malformed record */ }
    }
  } catch {}

  // ── Stats (prefer snapshot so stale wipes don't lose data) ────────
  let stats = snapStats;
  if (!stats) {
    try { stats = JSON.parse(localStorage.getItem(STATS_KEY) || 'null'); } catch {}
  }

  // ── Streak (prefer snapshot) ───────────────────────────────────────
  let streak = snapStreak;
  if (!streak) {
    try { streak = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null'); } catch {}
  }

  // ── Summary (shown in the UI) ──────────────────────────────────────
  const summary = {
    listCount:     lists.length,
    wordCount:     masteryRows.length,
    masteredCount: masteryRows.filter((r) => r.mastered).length,
    points:        stats?.totalPoints        ?? 0,
    currentStreak: streak?.currentStreak     ?? 0,
  };

  return { lists, masteryRows, stats, streak, summary };
}

/**
 * Returns true if there is any guest data worth showing the prompt for.
 */
export function hasGuestData(snapStats = null, snapStreak = null) {
  const { lists, masteryRows, stats, streak } = gatherGuestData(snapStats, snapStreak);
  return lists.length > 0 || masteryRows.length > 0 || !!stats || !!streak;
}

// ── Write all guest data to Supabase ──────────────────────────────────────

/**
 * Migrate all gathered guest data to Supabase under the given child + user.
 *
 * @param {object} child     - Supabase children row ({ id, ... })
 * @param {object|null} user - Supabase auth user ({ id, ... })
 * @param {object} guestData - return value of gatherGuestData()
 * @returns {{ ok: boolean, refreshChild?: object, error?: string }}
 */
export async function migrateAll(child, user, guestData) {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  if (!child?.id) return { ok: false, error: 'No child ID — cannot save progress.' };

  const { lists, masteryRows, stats, streak } = guestData;

  // ── Step 1: custom word lists → custom_lists table ─────────────────
  if (lists.length > 0 && user?.id) {
    const rows = lists.map((l) => ({
      user_id:    user.id,
      name:       l.name   || 'My word list',
      words:      Array.isArray(l.words) ? l.words : [],
      test_date:  l.testDate || null,
      created_at: l.created_at || new Date().toISOString(),
    }));
    const { error: listErr } = await supabase.from('custom_lists').insert(rows);
    if (listErr) {
      console.error('[migration] custom_lists insert failed', listErr);
      return {
        ok: false,
        error: `Couldn't save your word lists (${listErr.message || listErr.code || 'unknown'}). Your progress is still safe on this device — try again.`,
      };
    }
    // Remove from localStorage now that they're in Supabase, so
    // useCustomLists doesn't re-surface stale guest data on next load.
    try { localStorage.removeItem(CUSTOM_LISTS_KEY); } catch {}
  }

  // ── Step 2: per-word mastery → mastery_records table ──────────────
  if (masteryRows.length > 0) {
    const rows = masteryRows.map((r) => ({ ...r, child_id: child.id }));
    const { error: masteryErr } = await supabase.from('mastery_records').insert(rows);
    if (masteryErr) {
      console.error('[migration] mastery_records insert failed', masteryErr);
      return {
        ok: false,
        error: `Couldn't save word progress (${masteryErr.message || masteryErr.code || 'unknown'}). Your progress is still safe on this device — try again.`,
      };
    }
  }

  // ── Step 3: update children row with stats + streak ────────────────
  const update = { migration_completed_at: new Date().toISOString() };
  if (stats) {
    if (typeof stats.totalPoints === 'number') update.points           = stats.totalPoints;
    if (typeof stats.totalLumens === 'number') update.lumens           = stats.totalLumens;
    if (stats.lastPlayedDate)                  update.last_played_date = stats.lastPlayedDate;
  }
  if (streak) {
    if (typeof streak.currentStreak === 'number') update.current_streak  = streak.currentStreak;
    if (typeof streak.longestStreak === 'number') update.longest_streak  = streak.longestStreak;
    if (streak.lastPlayedDate)                    update.last_played_date = streak.lastPlayedDate;
  }

  const { data: refreshChild, error: childErr } = await supabase
    .from('children')
    .update(update)
    .eq('id', child.id)
    .select()
    .single();

  if (childErr) {
    console.error('[migration] children update failed', childErr);
    return {
      ok: false,
      error: `Word lists and progress saved, but couldn't update your points / streak (${childErr.message || childErr.code || 'unknown'}). Try again.`,
    };
  }

  // ── Step 4: re-seed localStorage engines ──────────────────────────
  // The gamification + streak engines read straight from localStorage;
  // re-seed them so the footer reflects the migrated totals immediately.
  try {
    if (stats) {
      localStorage.setItem(STATS_KEY, JSON.stringify({
        ...stats,
        totalPoints:    refreshChild.points          ?? stats.totalPoints    ?? 0,
        totalLumens:    refreshChild.lumens          ?? stats.totalLumens    ?? 0,
        lastPlayedDate: refreshChild.last_played_date ?? stats.lastPlayedDate ?? null,
      }));
    }
    if (streak) {
      localStorage.setItem(STREAK_KEY, JSON.stringify({
        ...streak,
        currentStreak:  refreshChild.current_streak  ?? streak.currentStreak ?? 0,
        longestStreak:  refreshChild.longest_streak  ?? streak.longestStreak ?? 0,
        lastPlayedDate: refreshChild.last_played_date ?? streak.lastPlayedDate ?? null,
      }));
    }
    window.dispatchEvent(new CustomEvent('spellify-points-update'));
  } catch (e) {
    console.warn('[migration] re-seed non-fatal', e);
  }

  // ── Step 5: event log (best-effort — silent if table doesn't exist) ─
  try {
    await supabase.from('migration_events').insert({
      child_id:             child.id,
      user_id:              user?.id || null,
      lists_migrated:       lists.length,
      mastery_rows_migrated: masteryRows.length,
      points_migrated:      stats?.totalPoints   ?? 0,
      streak_migrated:      streak?.currentStreak ?? 0,
      migrated_at:          new Date().toISOString(),
    });
  } catch { /* table may not exist yet — never block on this */ }

  return { ok: true, refreshChild };
}
