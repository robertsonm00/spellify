// MigratePrompt — shown once, right after a new child profile is
// created, IF there is any guest progress to import (mastery rows,
// points / lumens, or a current streak). Lets the parent either save
// the guest progress to the account or start fresh.
//
// What gets migrated:
//   1. Per-word mastery rows (localStorage `spellify_mastery_*`) →
//      Supabase `mastery_records` (child_id, list_id, word, mastered,
//      struggling, credit_by_game).
//   2. Player stats — `spellify_player_stats` (totalPoints, totalLumens,
//      lastPlayedDate) merged with `spellify_streak`
//      (currentStreak, longestStreak) → written onto the `children`
//      row via UPDATE. Column mapping:
//        local totalPoints   → children.points        (existing column)
//        local totalLumens   → children.lumens        (existing column)
//        local currentStreak → children.current_streak
//        local longestStreak → children.longest_streak
//        local lastPlayedDate→ children.last_played_date
//
// Robustness (May 2026 hardening):
//   • Every write checks its `error` field; the first failure aborts.
//   • localStorage is NEVER cleared from here — the parent's
//     onDone(result) callback decides, based on result.ok / .skipped.
//   • Errors are surfaced visibly with a Retry button rather than
//     silently swallowed.

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import './CreateChildProfile.css';   // shares the modal aesthetic

const KEY_PREFIX = 'spellify_mastery_';

export function hasLocalMastery() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) return true;
    }
  } catch {}
  return false;
}

function readLocalMastery() {
  const rows = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(KEY_PREFIX)) continue;
      try {
        const obj  = JSON.parse(localStorage.getItem(k) || '{}');
        const list = obj?.listId || k.slice(KEY_PREFIX.length);
        const words = obj?.words || {};
        for (const w of Object.values(words)) {
          if (!w?.word) continue;
          rows.push({
            list_id:    list,
            word:       w.word,
            mastered:   !!w.mastered,
            struggling: !!w.struggling,
            credit_by_game: w.creditByGame || {},
          });
        }
      } catch { /* skip bad row */ }
    }
  } catch {}
  return rows;
}

// Pull guest stats / streak from the props the parent App snapshotted
// BEFORE wiping localStorage. Falls back to reading localStorage live
// (defensive — in case props weren't supplied).
function readGuestStats(guestStats) {
  if (guestStats) return guestStats;
  try { return JSON.parse(localStorage.getItem('spellify_player_stats') || 'null'); }
  catch { return null; }
}
function readGuestStreak(guestStreak) {
  if (guestStreak) return guestStreak;
  try { return JSON.parse(localStorage.getItem('spellify_streak') || 'null'); }
  catch { return null; }
}

export default function MigratePrompt({ child, guestStats, guestStreak, onDone }) {
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);

  const doMigration = async () => {
    if (!child?.id) { onDone?.({ ok: true, skipped: true }); return; }
    setBusy(true);
    setError(null);

    const stats  = readGuestStats(guestStats);
    const streak = readGuestStreak(guestStreak);
    const masteryRows = readLocalMastery().map((r) => ({ ...r, child_id: child.id }));

    // ── Step 1: mastery rows (skip if none) ────────────────────────
    if (masteryRows.length > 0) {
      const { error: mErr } = await supabase
        .from('mastery_records')
        .insert(masteryRows);
      if (mErr) {
        console.error('[migrate] mastery insert failed', mErr);
        setError(`Could not save mastery records (${mErr.message || mErr.code || 'unknown error'}). Your guest progress is still safe on this device — try again, or skip to continue without importing.`);
        setBusy(false);
        return; // do NOT call onDone — keep localStorage intact for retry
      }
    }

    // ── Step 2: merge stats + streak onto the child row ────────────
    const update = {
      migration_completed_at: new Date().toISOString(),
    };
    if (stats) {
      // children.points / .lumens already exist on the table; reuse
      // them rather than introducing parallel total_* columns.
      if (typeof stats.totalPoints    === 'number') update.points           = stats.totalPoints;
      if (typeof stats.totalLumens    === 'number') update.lumens           = stats.totalLumens;
      if (stats.lastPlayedDate)                     update.last_played_date = stats.lastPlayedDate;
    }
    if (streak) {
      if (typeof streak.currentStreak === 'number') update.current_streak   = streak.currentStreak;
      if (typeof streak.longestStreak === 'number') update.longest_streak   = streak.longestStreak;
      if (streak.lastPlayedDate)                    update.last_played_date = streak.lastPlayedDate;
    }

    const { data: updatedChild, error: uErr } = await supabase
      .from('children')
      .update(update)
      .eq('id', child.id)
      .select()
      .single();

    if (uErr) {
      console.error('[migrate] child stats update failed', uErr);
      setError(`Mastery saved, but couldn't save points / lumens / streak (${uErr.message || uErr.code || 'unknown error'}). You can retry — nothing has been deleted locally.`);
      setBusy(false);
      return;
    }

    // ── Step 3: re-seed local engine keys with the merged values ───
    // The gamification + streak engines read straight from these keys;
    // we want the footer to show the migrated totals immediately,
    // without waiting for a round-trip.
    try {
      if (stats) {
        localStorage.setItem('spellify_player_stats', JSON.stringify({
          ...stats,
          totalPoints:    updatedChild.points          ?? stats.totalPoints    ?? 0,
          totalLumens:    updatedChild.lumens          ?? stats.totalLumens    ?? 0,
          lastPlayedDate: updatedChild.last_played_date ?? stats.lastPlayedDate ?? null,
        }));
      }
      if (streak) {
        localStorage.setItem('spellify_streak', JSON.stringify({
          ...streak,
          currentStreak:  updatedChild.current_streak  ?? streak.currentStreak ?? 0,
          longestStreak:  updatedChild.longest_streak  ?? streak.longestStreak ?? 0,
          lastPlayedDate: updatedChild.last_played_date ?? streak.lastPlayedDate ?? null,
        }));
      }
      window.dispatchEvent(new CustomEvent('spellify-points-update'));
    } catch (e) {
      console.warn('[migrate] re-seeding local stats failed (non-fatal)', e);
    }

    setBusy(false);
    // Hand the freshly-updated row back so the parent can hydrate the
    // session from it (footer name + totals reflect the child).
    onDone?.({ ok: true, refreshChild: updatedChild });
  };

  const handleYes = () => { doMigration(); };

  // Skip: explicit parent choice to NOT import guest progress. Tell
  // the parent it's safe to wipe local data (skipped: true) so the
  // next sign-in doesn't re-prompt.
  const handleNo = () => onDone?.({ ok: false, skipped: true });

  return (
    <div className="ccp-overlay" role="dialog" aria-modal="true" aria-label="Save existing progress">
      <div className="ccp-card" style={{ maxWidth: 460 }}>
        <h2 className="ccp-title">Found existing progress</h2>
        <p className="ccp-subtitle">
          We can save the words, points and streak from your guest session to
          {' '}<strong>{child?.nickname || 'this profile'}</strong> so nothing is lost.
        </p>

        {error && (
          <p className="ccp-error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div className="ccp-actions" style={{ justifyContent: 'space-between', marginTop: 18 }}>
          <button type="button" className="ccp-cancel" onClick={handleNo} disabled={busy}>
            Start fresh
          </button>
          <button type="button" className="ccp-submit" onClick={handleYes} disabled={busy}>
            {busy ? 'Saving…' : (error ? 'Retry' : 'Save my progress')}
          </button>
        </div>
      </div>
    </div>
  );
}
