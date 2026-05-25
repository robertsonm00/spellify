// CreateChildProfile — first-time child profile setup after sign-in.
//
// Inserts a row into the `children` table. After insert succeeds, the
// parent caller is handed the child row and can decide whether to
// prompt for localStorage progress migration.
//
// Auto-generates a friendly alias_id (Adjective + MagicalNoun + Animal).
// If insert fails with a unique-collision on alias_id, it retries once
// with a 2-digit suffix.

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { confidenceToDefaults } from '../../data/spelling/sessionSchema';
import './CreateChildProfile.css';

const ADJECTIVES = ['Glowing','Sparkling','Whispering','Glimmering','Blazing','Crystal','Amber','Ember','Flaring','Aurora','Twilight','Silver','Golden','Mystic','Wandering'];
const NOUNS      = ['Moon','Star','Ember','Flame','Glow','Spark','Mist','Dawn','Dusk','Storm','Frost','Bloom'];
const ANIMALS    = ['Fox','Owl','Badger','Raccoon','Hedgehog','Deer','Otter','Robin','Hare','Wolf','Bear','Lynx'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function generateAlias(suffix = '') {
  return `${pick(ADJECTIVES)}${pick(NOUNS)}${pick(ANIMALS)}${suffix}`;
}

// Same year groups as onboarding. Reception = 0 then Years 1–6.
const YEAR_GROUPS = [
  { yearGroup: 0, label: 'Reception', age: '4–5' },
  { yearGroup: 1, label: 'Year 1',    age: '5–6' },
  { yearGroup: 2, label: 'Year 2',    age: '6–7' },
  { yearGroup: 3, label: 'Year 3',    age: '7–8' },
  { yearGroup: 4, label: 'Year 4',    age: '8–9' },
  { yearGroup: 5, label: 'Year 5',    age: '9–10' },
  { yearGroup: 6, label: 'Year 6',    age: '10–11' },
];

// Same three confidence cards as onboarding.
const CONFIDENCE_OPTIONS = [
  { id: 'easy',         emoji: '🙂', label: 'Usually pretty easy' },
  { id: 'tricky',       emoji: '🤔', label: 'Sometimes easy, sometimes hard' },
  { id: 'often-tricky', emoji: '🧐', label: 'Often feels tricky' },
];

export default function CreateChildProfile({ authUser, onCreated, onCancel }) {
  const [nickname,   setNickname]   = useState('');
  const [yearGroup,  setYearGroup]  = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState(null);

  const canSubmit =
    nickname.trim().length >= 1 &&
    nickname.trim().length <= 30 &&
    yearGroup != null &&
    confidence != null &&
    !busy;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !authUser?.id) return;
    setError(null);
    setBusy(true);

    const { dyslexiaMode } = confidenceToDefaults(confidence);
    const adaptive_learning = true;

    const tryInsert = async (alias) => {
      return supabase.from('children').insert({
        parent_id:           authUser.id,
        nickname:            nickname.trim(),
        school_year:         yearGroup,
        working_level:       yearGroup,
        spelling_confidence: confidence,
        dyslexia_mode:       dyslexiaMode,
        adaptive_learning,
        alias_id:            alias,
      }).select().single();
    };

    try {
      let alias = generateAlias();
      let { data, error: err } = await tryInsert(alias);

      // Unique-violation on alias_id → retry once with a 2-digit suffix.
      if (err && (err.code === '23505' || /duplicate|unique/i.test(err.message || ''))) {
        const suffix = String(Math.floor(Math.random() * 90) + 10);
        alias = generateAlias(suffix);
        ({ data, error: err } = await tryInsert(alias));
      }

      if (err) {
        setError(err.message || 'Could not create profile. Please try again.');
        return;
      }
      onCreated?.(data);
    } catch (err) {
      setError(err?.message || 'Could not create profile. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ccp-overlay" role="dialog" aria-modal="true" aria-label="Create your child's profile">
      <div className="ccp-card">
        <h2 className="ccp-title">Create your child's profile</h2>
        <p className="ccp-subtitle">Quick setup so we can pick the right words.</p>

        <form className="ccp-form" onSubmit={handleSubmit}>
          {/* Nickname */}
          <label className="ccp-field">
            <span className="ccp-field__label">Nickname</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              minLength={1}
              placeholder="e.g. Robin"
              required
            />
            <span className="ccp-field__hint">1–30 characters. Visible only to you.</span>
          </label>

          {/* Year group */}
          <fieldset className="ccp-field">
            <legend className="ccp-field__label">Year group</legend>
            <div className="ccp-year-grid">
              {YEAR_GROUPS.map((y) => (
                <button
                  key={y.yearGroup}
                  type="button"
                  className={`ccp-year-card${yearGroup === y.yearGroup ? ' ccp-year-card--picked' : ''}`}
                  onClick={() => setYearGroup(y.yearGroup)}
                  aria-pressed={yearGroup === y.yearGroup}
                >
                  <span className="ccp-year-card__age">Ages {y.age}</span>
                  <span className="ccp-year-card__label">{y.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Confidence */}
          <fieldset className="ccp-field">
            <legend className="ccp-field__label">How does spelling feel?</legend>
            <div className="ccp-confidence-grid">
              {CONFIDENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`ccp-confidence-card${confidence === opt.id ? ' ccp-confidence-card--picked' : ''}`}
                  onClick={() => setConfidence(opt.id)}
                  aria-pressed={confidence === opt.id}
                >
                  <span className="ccp-confidence-card__emoji" aria-hidden="true">{opt.emoji}</span>
                  <span className="ccp-confidence-card__label">{opt.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {error && <p className="ccp-error" role="alert">{error}</p>}

          <div className="ccp-actions">
            {typeof onCancel === 'function' && (
              <button type="button" className="ccp-cancel" onClick={onCancel} disabled={busy}>
                Skip for now
              </button>
            )}
            <button type="submit" className="ccp-submit" disabled={!canSubmit}>
              {busy ? 'Creating…' : 'Create profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
