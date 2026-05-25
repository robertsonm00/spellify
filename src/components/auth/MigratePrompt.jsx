// MigratePrompt — shown once, right after a new child profile is
// created, IF localStorage has existing mastery data. Lets the parent
// either save existing progress to the account or start fresh.
//
// Mastery records in localStorage are keyed `spellify_mastery_<listId>`
// with a JSON body shaped like:
//   { listId, words: { <normalised>: { word, mastered, struggling,
//                                       creditByGame, ... } }, lastUpdated }
// We flatten that into rows for the `mastery_records` table.

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

function clearLocalMastery() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

export default function MigratePrompt({ child, onDone }) {
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);

  const handleYes = async () => {
    if (!child?.id) { onDone?.(); return; }
    setBusy(true); setError(null);
    try {
      const rows = readLocalMastery().map((r) => ({ ...r, child_id: child.id }));
      if (rows.length > 0) {
        const { error: err } = await supabase.from('mastery_records').insert(rows);
        if (err) throw err;
      }
      await supabase
        .from('children')
        .update({ migration_completed_at: new Date().toISOString() })
        .eq('id', child.id);
      clearLocalMastery();
      onDone?.();
    } catch (err) {
      setError(err?.message || 'Could not save progress. You can try again later.');
    } finally {
      setBusy(false);
    }
  };

  const handleNo = () => {
    clearLocalMastery();
    onDone?.();
  };

  return (
    <div className="ccp-overlay" role="dialog" aria-modal="true" aria-label="Save existing progress">
      <div className="ccp-card" style={{ maxWidth: 460 }}>
        <h2 className="ccp-title">Found existing progress</h2>
        <p className="ccp-subtitle">
          We found progress saved on this device — would you like to save it to your account?
        </p>

        {error && <p className="ccp-error" role="alert">{error}</p>}

        <div className="ccp-actions" style={{ marginTop: 18 }}>
          <button type="button" className="ccp-cancel" onClick={handleNo} disabled={busy}>
            No, start fresh
          </button>
          <button type="button" className="ccp-submit" onClick={handleYes} disabled={busy}>
            {busy ? 'Saving…' : 'Yes, save it'}
          </button>
        </div>
      </div>
    </div>
  );
}
