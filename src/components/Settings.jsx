import React, { useState } from 'react';
import './Settings.css';
import { YEAR_GROUPS } from '../utils/wordSelectionEngine';
import { CHARACTERS } from './OnboardingFlow';
import { ageToYear } from '../data/ukCurriculum';
import BuddyAvatar, { DEFAULT_BUDDY, hasBuddyAvatar } from './BuddyAvatar';

function Settings({
  userAge,
  dyslexiaMode = false,
  childName,
  childCharacter,
  year: yearProp,
  adaptiveLearning = true,
  onUpdate,
  onClose,
  onExit,
  authUser = null,
  onSignInClick,
  onSignUpClick,
  onSignOut,
}) {
  const currentYear = yearProp ?? ageToYear(userAge);

  const [editName,      setEditName]      = useState(childName || '');
  const [editCharacter, setEditCharacter] = useState(childCharacter || null);
  const [editYear,      setEditYear]      = useState(currentYear);
  const [buddyOpen,     setBuddyOpen]     = useState(false);

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

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose} aria-label="Close settings">✕</button>

        <h2 className="settings-title">Profile</h2>

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

        {/* ── Adaptive Learning — accounts only ── */}
        {authUser && (
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
        )}

        <div className="settings-divider" />

        {/* ── Exit — triggers the existing "Are you sure?" modal in App.jsx ── */}
        {onExit && (
          <button
            type="button"
            className="settings-exit-btn"
            onClick={() => { onClose?.(); onExit?.(); }}
          >
            ↩ Exit Game
          </button>
        )}

        {authUser ? (
          /* Signed-in: small clean row with email + Sign Out */
          <div className="settings-account-row">
            <span className="settings-account-row__email" title={authUser.email}>
              {authUser.email}
            </span>
            <button
              type="button"
              className="settings-account-row__link"
              onClick={() => { onClose?.(); onSignOut?.(); }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          /* Guest: reward-teaser card — gold border, soft glow.
             "Create free account" routes to the Sign Up tab (not Sign In). */
          <button
            type="button"
            className="settings-unlock-card"
            onClick={() => { onClose?.(); (onSignUpClick || onSignInClick)?.(); }}
          >
            <span className="settings-unlock-card__icon" aria-hidden="true">✨</span>
            <span className="settings-unlock-card__body">
              <span className="settings-unlock-card__title">Unlock new worlds</span>
              <span className="settings-unlock-card__sub">
                Save your progress and journey beyond Ember Isle
              </span>
              <span className="settings-unlock-card__cta">
                Create free account&nbsp;→
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export default Settings;
