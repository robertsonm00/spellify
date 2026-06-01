// CreateChildProfile — first-time child profile setup after sign-in.
//
// Inserts a row into the `children` table. After insert succeeds, the
// parent caller is handed the child row and can decide whether to
// prompt for localStorage progress migration.
//
// Field parity with Quick Start onboarding (May 2026):
//   - nickname            ↔ session.childName
//   - school_year         ↔ session.year
//   - character           ↔ session.childCharacter.id           (raccoon free, others locked)
//   - spelling_confidence ↔ session.spellingConfidence
//   - sen_profile         ↔ session.senProfile                  (parent-only field, multi-select)
//   - adaptive_learning   ↔ session.adaptiveLearning            (toggle)
//   - dyslexia_mode       derived from confidence on save (Settings overrides later)
//
// If a `prefill` prop is provided (e.g. captured from a guest session
// before sign-up wiped localStorage), the form is pre-populated from it
// — parents shouldn't have to retype what Quick Start already asked.
//
// Auto-generates a friendly alias_id (Adjective + MagicalNoun + Animal).
// If insert fails with a unique-collision on alias_id, it retries once
// with a 2-digit suffix.

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { confidenceToDefaults } from '../../data/spelling/sessionSchema';
import { CHARACTERS } from '../OnboardingFlow';
import BuddyAvatar, { hasBuddyAvatar } from '../BuddyAvatar';
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

// Parent-declared SEN tags. Multi-select; empty array means "none /
// prefer not to say". Matches the senProfile shape used by the
// Learning Engine (see sessionSchema.js).
const SEN_OPTIONS = [
  { id: 'dyslexia',   label: 'Dyslexia' },
  { id: 'dysgraphia', label: 'Dysgraphia' },
  { id: 'processing', label: 'Processing differences' },
  { id: 'eal',        label: 'English as an additional language' },
  { id: 'other',      label: 'Other / prefer to discuss' },
];

export default function CreateChildProfile({ authUser, prefill = null, onCreated, onCancel }) {
  // Prefill from a captured guest session (App.jsx snapshots it before
  // wiping localStorage on first sign-in). Each branch falls back to a
  // sensible default if the field is missing.
  const [nickname,    setNickname]    = useState(prefill?.childName || '');
  const [yearGroup,   setYearGroup]   = useState(prefill?.year ?? null);
  const [confidence,  setConfidence]  = useState(prefill?.spellingConfidence || null);
  const [characterId, setCharacterId] = useState(prefill?.childCharacter?.id || 'raccoon');
  const [senProfile,  setSenProfile]  = useState(
    Array.isArray(prefill?.senProfile) ? prefill.senProfile : []
  );
  const [adaptive,    setAdaptive]    = useState(prefill?.adaptiveLearning !== false);
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState(null);
  // Buddy picker is long (50+ animals). Mirror onboarding: show the first
  // seven, then a "Show more" card reveals the rest. Raccoon (the only free
  // buddy) sits within the first seven, so the default view is still usable.
  const [showAllBuddies, setShowAllBuddies] = useState(false);
  const visibleCharacters = showAllBuddies ? CHARACTERS : CHARACTERS.slice(0, 7);

  const canSubmit =
    nickname.trim().length >= 1 &&
    nickname.trim().length <= 30 &&
    yearGroup != null &&
    confidence != null &&
    !busy;

  const toggleSen = (id) => {
    setSenProfile((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !authUser?.id) return;
    setError(null);
    setBusy(true);

    // Effective dyslexia default comes from confidence — Settings can
    // override later. We persist it eagerly so the gameplay engine can
    // pick it up on first session-hydrate (App.jsx) without an extra
    // round-trip.
    const { dyslexiaMode } = confidenceToDefaults(confidence);

    const tryInsert = async (alias) => {
      return supabase.from('children').insert({
        parent_id:           authUser.id,
        nickname:            nickname.trim(),
        school_year:         yearGroup,
        working_level:       yearGroup,
        // Supabase column is `active_buddy_id` (it pre-existed in the
        // schema with a default of 'raccoon'; we don't add a parallel
        // `buddy` column — see 2026_05_25_child_profile_parity.sql).
        active_buddy_id:     characterId || 'raccoon',
        spelling_confidence: confidence,
        sen_profile:         senProfile,
        dyslexia_mode:       dyslexiaMode,
        adaptive_learning:   adaptive,
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

          {/* Learning buddy — raccoon is free, others are locked
              (mirror of the onboarding character picker). */}
          <fieldset className="ccp-field">
            <legend className="ccp-field__label">Learning buddy</legend>
            <div className="ccp-buddy-grid">
              {visibleCharacters.map((c) => {
                const isRaccoon = c.id === 'raccoon';
                const picked   = characterId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`ccp-buddy-card${picked ? ' ccp-buddy-card--picked' : ''}${isRaccoon ? '' : ' ccp-buddy-card--locked'}`}
                    onClick={() => isRaccoon && setCharacterId('raccoon')}
                    aria-pressed={picked}
                    aria-label={`${c.name}${isRaccoon ? '' : ' (locked)'}`}
                    title={isRaccoon ? c.name : `${c.name} — unlocks with subscription`}
                  >
                    <span className="ccp-buddy-card__face" aria-hidden="true">
                      {hasBuddyAvatar(c.id)
                        ? <BuddyAvatar id={c.id} size={44} />
                        : <span className="ccp-buddy-card__emoji">{c.emoji}</span>}
                    </span>
                    <span className="ccp-buddy-card__name">{c.name}</span>
                    {!isRaccoon && <span className="ccp-buddy-card__lock" aria-hidden="true">🔒</span>}
                  </button>
                );
              })}
              {!showAllBuddies && (
                <button
                  type="button"
                  className="ccp-buddy-card ccp-buddy-card--more"
                  onClick={() => setShowAllBuddies(true)}
                  aria-label="Show more buddies"
                >
                  <span className="ccp-buddy-card__face" aria-hidden="true">
                    <span className="ccp-buddy-card__emoji">➕</span>
                  </span>
                  <span className="ccp-buddy-card__name">Show more</span>
                </button>
              )}
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

          {/* SEN profile — parent-only, optional multi-select. Empty
              means "none / prefer not to say"; the Learning Engine
              treats it as no specialised adjustments. */}
          <fieldset className="ccp-field">
            <legend className="ccp-field__label">
              Learning support <span className="ccp-field__optional">(optional)</span>
            </legend>
            <span className="ccp-field__hint">
              Helps us tailor pace, hints and font support. Pick all that apply, or leave blank.
            </span>
            <div className="ccp-sen-grid">
              {SEN_OPTIONS.map((opt) => {
                const on = senProfile.includes(opt.id);
                return (
                  <label key={opt.id} className={`ccp-sen-chip${on ? ' ccp-sen-chip--on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleSen(opt.id)}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Adaptive learning toggle */}
          <label className="ccp-toggle">
            <input
              type="checkbox"
              checked={adaptive}
              onChange={(e) => setAdaptive(e.target.checked)}
            />
            <span className="ccp-toggle__label">
              Adaptive learning <span className="ccp-toggle__hint">— focus practice on words this child finds tricky</span>
            </span>
          </label>

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
