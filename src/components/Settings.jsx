import React, { useState } from 'react';
import './Settings.css';
import { YEAR_LABELS, ageToYear } from '../data/ukCurriculum';
import { YEAR_GROUPS } from '../utils/wordSelectionEngine';
import { CHARACTERS } from './OnboardingFlow';
import { confidenceToDefaults } from '../data/spelling/sessionSchema';
import BuddyAvatar, { DEFAULT_BUDDY, hasBuddyAvatar } from './BuddyAvatar';

const CONFIDENCE_LABELS = {
  'easy':         { emoji: '😊', label: 'Pretty easy' },
  'tricky':       { emoji: '🤔', label: 'Sometimes tricky' },
  'often-tricky': { emoji: '😰', label: 'Often tricky' },
};

function Settings({ userAge, dyslexiaMode = false, childName, childCharacter, year: yearProp, spellingConfidence = 'tricky', adaptiveLearning = true, onUpdate, onChangeWords, onClearProgress, onClose }) {
  const currentYear = yearProp ?? ageToYear(userAge);

  const [editName,       setEditName]       = useState(childName || '');
  const [editCharacter,  setEditCharacter]  = useState(childCharacter || null);
  const [editYear,       setEditYear]       = useState(currentYear);
  const [buddyOpen,      setBuddyOpen]      = useState(false);
  const [comingSoon,     setComingSoon]     = useState(false);

  const save = (patch) => onUpdate(patch);

  const handleNameBlur = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== childName) save({ childName: trimmed });
  };

  const handleCharacterSelect = (char) => {
    setEditCharacter(char);
    setBuddyOpen(false);
    save({ childCharacter: char });
  };

  const handleYearChange = (e) => {
    const yr = Number(e.target.value);
    setEditYear(yr);
    const group = YEAR_GROUPS.find((g) => g.yearGroup === yr);
    const age = group?.ageRange[0] ?? userAge;
    save({ year: yr, age });
  };

  // Changing the confidence answer re-applies the dyslexiaMode/difficulty
  // defaults from confidenceToDefaults. Matches the onboarding mapping.
  // If the parent has manually toggled Support Mode independently (or
  // SEN profile contains 'dyslexia') the Support Mode toggle keeps its
  // own state — both fields are saved together so they're consistent.
  const handleConfidenceChange = (next) => {
    const { dyslexiaMode: dm, difficulty } = confidenceToDefaults(next);
    save({
      spellingConfidence: next,
      dyslexiaMode:       dm,
      difficulty,
    });
  };

  const handleSaveProfile = () => {
    setComingSoon(true);
    setTimeout(() => setComingSoon(false), 3000);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose} aria-label="Close settings">✕</button>

        <h2 className="settings-title">⚙️ Settings</h2>

        {/* ── Name ── */}
        <div className="settings-field-row">
          <label className="settings-label" htmlFor="settings-name">Name</label>
          <input
            id="settings-name"
            className="settings-input"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Child's name"
          />
        </div>

        {/* ── Buddy ── */}
        {/* Display uses the same BuddyAvatar component as onboarding/games
            so buddies with custom sprites (e.g. raccoon) render the SVG
            rather than the bare emoji — single source of truth. */}
        {(() => {
          const displayChar = editCharacter || DEFAULT_BUDDY;
          return (
            <div className="settings-field-row">
              <span className="settings-label">Buddy</span>
              <button
                className="settings-buddy-trigger"
                onClick={() => setBuddyOpen((v) => !v)}
              >
                <span className={`settings-buddy-emoji${hasBuddyAvatar(displayChar.id) ? ' settings-buddy-emoji--svg' : ''}`}>
                  <BuddyAvatar id={displayChar.id} size={28} fallback={displayChar.emoji} />
                </span>
                <span className="settings-buddy-cname">{displayChar.name}</span>
                <span className="settings-buddy-edit">✎</span>
              </button>
            </div>
          );
        })()}

        {buddyOpen && (
          <div className="settings-buddy-grid">
            {CHARACTERS.map((char) => (
              <button
                key={char.id}
                className={`settings-buddy-opt${editCharacter?.id === char.id ? ' settings-buddy-opt--active' : ''}`}
                onClick={() => handleCharacterSelect(char)}
                title={char.name}
              >
                {hasBuddyAvatar(char.id)
                  ? <BuddyAvatar id={char.id} size={28} fallback={char.emoji} />
                  : char.emoji}
              </button>
            ))}
          </div>
        )}

        {/* ── School Year ── */}
        <div className="settings-field-row">
          <span className="settings-label">School Year</span>
          <select
            className="settings-select"
            value={editYear}
            onChange={handleYearChange}
          >
            {YEAR_GROUPS.map((g) => (
              <option key={g.yearGroup} value={g.yearGroup}>
                {g.label} (age {g.ageRange[0]})
              </option>
            ))}
          </select>
        </div>

        <div className="settings-divider" />

        {/* ── Spelling confidence ── */}
        <div className="settings-confidence">
          <span className="settings-label settings-confidence-label">
            How does <span style={{ whiteSpace: 'nowrap' }}>{childName || 'they'}</span> find spelling?
          </span>
          <div className="settings-confidence-options">
            {(['easy', 'tricky', 'often-tricky']).map((id) => {
              const meta = CONFIDENCE_LABELS[id];
              const active = spellingConfidence === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`settings-confidence-opt${active ? ' settings-confidence-opt--active' : ''}`}
                  onClick={() => handleConfidenceChange(id)}
                >
                  <span className="settings-confidence-emoji" aria-hidden="true">{meta.emoji}</span>
                  <span className="settings-confidence-text">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Extra Support Mode ── */}
        <label className="settings-support-toggle">
          <div className="settings-support-text">
            <span className="settings-support-name">⭐ Extra Support Mode</span>
            <span className="settings-support-hint">Bigger fonts, simpler words, gentler activities</span>
          </div>
          <div className="settings-support-switch">
            <input
              type="checkbox"
              checked={dyslexiaMode}
              onChange={(e) => onUpdate({ dyslexiaMode: e.target.checked })}
            />
            <span className="settings-support-slider" />
          </div>
        </label>

        {/* ── Adaptive Learning ──
            Surfaced here as a parent override until the account-creation
            flow exists. When the account flow lands, this becomes an
            explicit step in the child profile setup (see TODO in
            sessionSchema.js). Default on; off means every word every
            session, struggling-word reinforcement still applies. */}
        <label className="settings-support-toggle">
          <div className="settings-support-text">
            <span className="settings-support-name">Adaptive Learning</span>
            <span className="settings-support-hint">
              When on, Spellify gently adjusts to how{' '}
              <span style={{ whiteSpace: 'nowrap' }}>{childName || 'they'}</span>{' '}
              is doing — making things a little easier or harder as they go.
              You can change this any time.
            </span>
          </div>
          <div className="settings-support-switch">
            <input
              type="checkbox"
              checked={adaptiveLearning}
              onChange={(e) => onUpdate({ adaptiveLearning: e.target.checked })}
            />
            <span className="settings-support-slider" />
          </div>
        </label>

        <div className="settings-divider" />

        {/* ── Actions ── */}
        <div className="settings-actions">
          <button className="settings-action-btn" onClick={onChangeWords}>
            📝 Change Words
          </button>
          <button
            className="settings-action-btn settings-action-btn--danger"
            onClick={() => { onClearProgress(); onClose(); }}
          >
            🔄 Reset Progress
          </button>
        </div>

        <div className="settings-divider" />

        {/* ── Save Profile ── */}
        <button
          className="settings-action-btn settings-action-btn--primary"
          onClick={handleSaveProfile}
        >
          💾 Save Profile
        </button>

        {comingSoon && (
          <p className="settings-coming-soon">
            Coming soon — profiles will let you save your progress across devices.
          </p>
        )}
      </div>
    </div>
  );
}

export default Settings;
