// EditChildProfile — edit an existing child row from the grown-up area.
//
// Mirrors CreateChildProfile's fields but pre-populates from the existing
// child row and does a Supabase UPDATE instead of INSERT. Also exposes a
// delete path with a two-step confirmation so a grown-up can permanently
// remove a profile.
//
// Props:
//   authUser   — the signed-in Supabase user (used for ownership checks)
//   child      — the existing children row from Supabase
//   onSaved    — (updatedRow) => void  — called after successful UPDATE
//   onDeleted  — (childId)    => void  — called after successful DELETE
//   onCancel   — ()           => void  — dismiss without saving

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { confidenceToDefaults } from '../../data/spelling/sessionSchema';
import { CHARACTERS } from '../OnboardingFlow';
import BuddyAvatar, { hasBuddyAvatar } from '../BuddyAvatar';
import './CreateChildProfile.css'; // reuse all form styles

const YEAR_GROUPS = [
  { yearGroup: 0, label: 'Reception', age: '4–5' },
  { yearGroup: 1, label: 'Year 1',    age: '5–6' },
  { yearGroup: 2, label: 'Year 2',    age: '6–7' },
  { yearGroup: 3, label: 'Year 3',    age: '7–8' },
  { yearGroup: 4, label: 'Year 4',    age: '8–9' },
  { yearGroup: 5, label: 'Year 5',    age: '9–10' },
  { yearGroup: 6, label: 'Year 6',    age: '10–11' },
];

const CONFIDENCE_OPTIONS = [
  { id: 'easy',         emoji: '🙂', label: 'Usually pretty easy' },
  { id: 'tricky',       emoji: '🤔', label: 'Sometimes easy, sometimes hard' },
  { id: 'often-tricky', emoji: '🧐', label: 'Often feels tricky' },
];

const SEN_OPTIONS = [
  { id: 'dyslexia',   label: 'Dyslexia' },
  { id: 'dysgraphia', label: 'Dysgraphia' },
  { id: 'processing', label: 'Processing differences' },
  { id: 'eal',        label: 'English as an additional language' },
  { id: 'other',      label: 'Other / prefer to discuss' },
];

export default function EditChildProfile({ authUser, child, onSaved, onDeleted, onCancel }) {
  const [nickname,    setNickname]    = useState(child.nickname || '');
  const [yearGroup,   setYearGroup]   = useState(child.school_year ?? null);
  const [confidence,  setConfidence]  = useState(child.spelling_confidence || null);
  const [characterId, setCharacterId] = useState(child.active_buddy_id || 'raccoon');
  const [senProfile,  setSenProfile]  = useState(
    Array.isArray(child.sen_profile) ? child.sen_profile : []
  );
  const [adaptive,    setAdaptive]    = useState(child.adaptive_learning !== false);
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canSubmit =
    nickname.trim().length >= 1 &&
    nickname.trim().length <= 30 &&
    yearGroup != null &&
    confidence != null &&
    !busy;

  const toggleSen = (id) => {
    setSenProfile((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);

    const { dyslexiaMode } = confidenceToDefaults(confidence);

    try {
      const { data, error: err } = await supabase
        .from('children')
        .update({
          nickname:            nickname.trim(),
          school_year:         yearGroup,
          working_level:       yearGroup,
          active_buddy_id:     characterId || 'raccoon',
          spelling_confidence: confidence,
          sen_profile:         senProfile,
          dyslexia_mode:       dyslexiaMode,
          adaptive_learning:   adaptive,
        })
        .eq('id', child.id)
        .select()
        .single();

      if (err) {
        setError(err.message || 'Could not save changes. Please try again.');
        return;
      }
      onSaved?.(data);
    } catch (err) {
      setError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('children')
        .delete()
        .eq('id', child.id);

      if (err) {
        setError(err.message || 'Could not delete profile. Please try again.');
        setConfirmDelete(false);
        return;
      }
      onDeleted?.(child.id);
    } catch (err) {
      setError(err?.message || 'Could not delete profile. Please try again.');
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ccp-overlay" role="dialog" aria-modal="true" aria-label={`Edit ${child.nickname}'s profile`}>
      <div className="ccp-card">
        <h2 className="ccp-title">Edit {child.nickname}'s profile</h2>
        <p className="ccp-subtitle">Changes take effect next time they play.</p>

        <form className="ccp-form" onSubmit={handleSave}>

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

          {/* Learning buddy */}
          <fieldset className="ccp-field">
            <legend className="ccp-field__label">Learning buddy</legend>
            <div className="ccp-buddy-grid">
              {CHARACTERS.map((c) => {
                const isRaccoon = c.id === 'raccoon';
                const picked    = characterId === c.id;
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
            </div>
          </fieldset>

          {/* Spelling confidence */}
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

          {/* SEN profile */}
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

          {/* Adaptive learning */}
          <label className="ccp-toggle">
            <input
              type="checkbox"
              checked={adaptive}
              onChange={(e) => setAdaptive(e.target.checked)}
            />
            <span className="ccp-toggle__label">
              Adaptive learning{' '}
              <span className="ccp-toggle__hint">— focus practice on words this child finds tricky</span>
            </span>
          </label>

          {error && <p className="ccp-error" role="alert">{error}</p>}

          <div className="ccp-actions">
            <button type="button" className="ccp-cancel" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="ccp-submit" disabled={!canSubmit}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>

        {/* ── Delete profile ── */}
        <div className="ccp-delete-zone">
          {!confirmDelete ? (
            <button
              type="button"
              className="ccp-delete-trigger"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              Delete {child.nickname}'s profile…
            </button>
          ) : (
            <div className="ccp-delete-confirm">
              <p className="ccp-delete-confirm__msg">
                This permanently deletes <strong>{child.nickname}</strong>'s profile and all their progress. This cannot be undone.
              </p>
              <div className="ccp-delete-confirm__actions">
                <button
                  type="button"
                  className="ccp-cancel"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                >
                  Keep profile
                </button>
                <button
                  type="button"
                  className="ccp-delete-btn"
                  onClick={handleDelete}
                  disabled={busy}
                >
                  {busy ? 'Deleting…' : 'Yes, delete permanently'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
