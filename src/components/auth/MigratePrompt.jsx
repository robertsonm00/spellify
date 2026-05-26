// MigratePrompt — shown once, right after a new child profile is created,
// when there is any guest progress to save. Delegates all data-transfer
// logic to src/lib/migrationService.js; this file owns only the UI.
//
// User-facing framing rule (Prompt 5 spec):
//   NEVER use the word "migrate". Always say "save my progress" / "keep
//   my progress" / "save to my account".
//
// Props:
//   child       - freshly-created Supabase children row ({ id, nickname, … })
//   user        - Supabase auth user ({ id, … }) — needed to insert custom_lists
//   guestStats  - snapshot of spellify_player_stats captured BEFORE any wipe
//   guestStreak - snapshot of spellify_streak captured BEFORE any wipe
//   onDone(result) - called when finished: { ok, skipped?, refreshChild? }
//                    caller clears localStorage; we never do it here.

import React, { useState, useMemo } from 'react';
import { gatherGuestData, migrateAll } from '../../lib/migrationService';
import './CreateChildProfile.css';   // shares the modal aesthetic

export default function MigratePrompt({ child, user, guestStats, guestStreak, onDone }) {
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);

  // Compute summary once on mount — shown in the "what you'll keep" block.
  // gatherGuestData reads mastery keys live + uses the pre-wipe stat snapshots.
  const { guestData, summary } = useMemo(() => {
    const data = gatherGuestData(guestStats, guestStreak);
    return { guestData: data, summary: data.summary };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasSomething = summary.listCount > 0 || summary.masteredCount > 0 || summary.points > 0 || summary.currentStreak > 0;

  const doSave = async () => {
    if (!child?.id) { onDone?.({ ok: true, skipped: true }); return; }
    setBusy(true);
    setError(null);

    const result = await migrateAll(child, user, guestData);

    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return; // do NOT call onDone — keep localStorage intact for retry
    }

    setBusy(false);
    onDone?.({ ok: true, refreshChild: result.refreshChild });
  };

  // Skip: parent explicitly chose not to save. Tell caller it's safe to
  // wipe local data (skipped: true) so the prompt doesn't re-appear.
  const handleSkip = () => onDone?.({ ok: false, skipped: true });

  return (
    <div className="ccp-overlay" role="dialog" aria-modal="true" aria-label="Save your progress">
      <div className="ccp-card" style={{ maxWidth: 480 }}>

        <div className="ccp-title" style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
          We found your progress!
        </div>
        <p className="ccp-subtitle">
          Save everything to{' '}
          <strong>{child?.nickname || 'this profile'}</strong>{' '}
          so nothing is lost.
        </p>

        {/* ── What you'll keep ─────────────────────────────────────── */}
        {hasSomething && (
          <div className="mp-summary">
            {summary.listCount > 0 && (
              <div className="mp-summary__row">
                <span className="mp-summary__icon" aria-hidden="true">📋</span>
                <span className="mp-summary__label">
                  <strong>{summary.listCount}</strong>{' '}
                  word {summary.listCount === 1 ? 'list' : 'lists'}
                </span>
              </div>
            )}
            {summary.masteredCount > 0 && (
              <div className="mp-summary__row">
                <span className="mp-summary__icon" aria-hidden="true">⭐</span>
                <span className="mp-summary__label">
                  <strong>{summary.masteredCount}</strong>{' '}
                  {summary.masteredCount === 1 ? 'word' : 'words'} mastered
                </span>
              </div>
            )}
            {summary.points > 0 && (
              <div className="mp-summary__row">
                <span className="mp-summary__icon" aria-hidden="true">✨</span>
                <span className="mp-summary__label">
                  <strong>{summary.points.toLocaleString()}</strong> Spell Points
                </span>
              </div>
            )}
            {summary.currentStreak > 0 && (
              <div className="mp-summary__row">
                <span className="mp-summary__icon" aria-hidden="true">🔥</span>
                <span className="mp-summary__label">
                  <strong>{summary.currentStreak}</strong>-day streak
                </span>
              </div>
            )}
          </div>
        )}

        {!hasSomething && (
          <p className="ccp-subtitle" style={{ color: '#b89fd4', fontSize: '0.82rem' }}>
            No games played yet — your account is all set.
          </p>
        )}

        {/* ── Error state ──────────────────────────────────────────── */}
        {error && (
          <p className="ccp-error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </p>
        )}

        {/* ── Actions ──────────────────────────────────────────────── */}
        <div className="ccp-actions" style={{ justifyContent: 'space-between', marginTop: 18 }}>
          <button
            type="button"
            className="ccp-cancel"
            onClick={handleSkip}
            disabled={busy}
          >
            Start fresh
          </button>
          <button
            type="button"
            className="ccp-submit"
            onClick={doSave}
            disabled={busy || !hasSomething}
          >
            {busy ? 'Saving…' : error ? 'Retry' : 'Save my progress'}
          </button>
        </div>

        {!hasSomething && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button type="button" className="ccp-submit" onClick={() => onDone?.({ ok: true, skipped: true })} style={{ width: '100%' }}>
              Let's go!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
