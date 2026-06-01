// AvatarCharacters — the (set-based) Avatar selector.
//
// Surface label is just "Avatar"; internally this is the character-sets
// picker (distinct from the mix-and-match AvatarBuilder, which still
// lives at the 'avatar' section). You don't build a character here — you
// pick a whole one from a set.
//
//   ┌───────────────────────────────────────────────────────┐
//   │  Avatar                                   ✦ 1,240      │  header
//   │  ┌─────────┐                                           │
//   │  │  HERO   │   Nova            ← selected character    │  hero
//   │  └─────────┘   Starter Squad                           │
//   │  Starter Squad                                         │
//   │  [○][○][●][○][○][○][○][○][○][○]   ← highlight through  │  starter row
//   │  More character sets                                   │
//   │  [👑 Royals 🔒] [🧭 Explorers 🔒] [🐉 Mythical 🔒] …   │  locked grid
//   └───────────────────────────────────────────────────────┘
//
// Selection persists to localStorage. Locked sets have no art yet, so
// "unlock" is a gentle Coming-soon message rather than a lumens spend;
// the price data is ready for when real purchases get wired up.

import React, { useEffect, useState } from 'react';
import './AvatarCharacters.css';
import {
  STARTER_SET,
  LOCKED_SETS,
  UNLOCKED_SETS_KEY,
  findAvatar,
  loadSelection,
  saveSelection,
} from '../data/avatarSets';

function loadUnlockedSets() {
  try {
    const raw = localStorage.getItem(UNLOCKED_SETS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? Array.from(new Set(['starter', ...arr])) : ['starter'];
  } catch { return ['starter']; }
}

export default function AvatarCharacters({ lumens = 0, onSelect }) {
  const [selection, setSelection] = useState(loadSelection);
  // Unlocked sets are read once; today only 'starter' is ever unlocked.
  const [unlockedSets] = useState(loadUnlockedSets);
  const [peekSetId, setPeekSetId] = useState(null);

  useEffect(() => { saveSelection(selection); }, [selection]);

  const selected = findAvatar(selection.avatarId);
  const peekSet = LOCKED_SETS.find((s) => s.id === peekSetId) || null;

  const handlePick = (avatar) => {
    setSelection({ setId: STARTER_SET.id, avatarId: avatar.id });
    setPeekSetId(null);
    onSelect?.(avatar);   // let App mirror the choice into the footer
  };

  const handleLockedSet = (set) => {
    // No art for these yet — surface a friendly Coming-soon note instead of
    // spending lumens on an empty set. Toggle off if tapped again.
    setPeekSetId((cur) => (cur === set.id ? null : set.id));
  };

  return (
    <main className="avx-root">
      {/* Header — title + lumens balance (mirrors the Spell Shop). */}
      <header className="avx-header">
        <div className="avx-header__inner">
          <h1 className="avx-title">
            <span aria-hidden="true">🧑‍🚀</span>
            <span>Avatar</span>
          </h1>
          <p className="avx-subtitle">Choose a character to be your hero</p>
        </div>
        <div
          className="avx-lumens"
          title="Your current lumens balance"
          aria-label={`${lumens.toLocaleString()} lumens`}
        >
          <span className="avx-lumens__icon" aria-hidden="true">✦</span>
          <span className="avx-lumens__value">{lumens.toLocaleString()}</span>
          <span className="avx-lumens__label">Lumens</span>
        </div>
      </header>

      {/* Hero — the currently selected character, shown large. */}
      <section className="avx-hero" aria-label="Your chosen character">
        <div className="avx-hero__frame">
          <img
            className="avx-hero__img"
            src={selected.src}
            alt={selected.name}
            draggable={false}
          />
        </div>
        <div className="avx-hero__meta">
          <span className="avx-hero__tag">
            <span aria-hidden="true">✓</span> This is you
          </span>
          <h2 className="avx-hero__name">{selected.name}</h2>
          <p className="avx-hero__set">{STARTER_SET.name}</p>
        </div>
      </section>

      {/* Starter squad — the row you highlight through to pick. */}
      <section className="avx-section" aria-label={STARTER_SET.name}>
        <div className="avx-section__head">
          <h3 className="avx-section__title">
            <span aria-hidden="true">{STARTER_SET.emoji}</span> {STARTER_SET.name}
          </h3>
          <span className="avx-section__hint">{STARTER_SET.blurb}</span>
        </div>
        <div className="avx-starter-row" role="radiogroup" aria-label={`${STARTER_SET.name} characters`}>
          {STARTER_SET.avatars.map((avatar) => {
            const isSel = avatar.id === selection.avatarId;
            return (
              <button
                key={avatar.id}
                type="button"
                role="radio"
                aria-checked={isSel}
                aria-label={avatar.name}
                title={avatar.name}
                className={`avx-pick${isSel ? ' is-selected' : ''}`}
                onClick={() => handlePick(avatar)}
              >
                <img
                  className="avx-pick__img"
                  src={avatar.src}
                  alt=""
                  draggable={false}
                />
                {isSel && <span className="avx-pick__check" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* More sets — locked, unlockable-with-lumens (Coming soon for now). */}
      <section className="avx-section" aria-label="More character sets">
        <div className="avx-section__head">
          <h3 className="avx-section__title">
            <span aria-hidden="true">🎁</span> More character sets
          </h3>
          <span className="avx-section__hint">Unlock new crews with your lumens</span>
        </div>

        {peekSet && (
          <div className="avx-peek" role="status">
            <span className="avx-peek__emoji" aria-hidden="true">{peekSet.emoji}</span>
            <span className="avx-peek__text">
              <strong>{peekSet.name}</strong> is on its way! These characters are
              being illustrated — you'll be able to unlock them for
              {' '}<span className="avx-peek__price">✦{peekSet.price.toLocaleString()}</span> soon.
            </span>
          </div>
        )}

        <div className="avx-sets-grid">
          {LOCKED_SETS.map((set) => {
            const unlocked = unlockedSets.includes(set.id);
            const isPeek = peekSetId === set.id;
            return (
              <button
                key={set.id}
                type="button"
                className={`avx-set-card${unlocked ? ' is-unlocked' : ' is-locked'}${isPeek ? ' is-peek' : ''}`}
                style={{ '--avx-accent': set.accent }}
                onClick={() => !unlocked && handleLockedSet(set)}
                aria-label={`${set.name} set — ${unlocked ? 'unlocked' : `locked, ${set.price} lumens`}`}
                aria-expanded={isPeek}
              >
                <span className="avx-set-card__icon" aria-hidden="true">{set.emoji}</span>
                <span className="avx-set-card__title">{set.name}</span>
                <span className="avx-set-card__blurb">{set.blurb}</span>
                <span className="avx-set-card__foot">
                  <span className="avx-set-card__count">{set.size} characters</span>
                  <span className="avx-set-card__price">
                    <span aria-hidden="true">🔒</span> ✦{set.price.toLocaleString()}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="avx-footnote">
        <span aria-hidden="true">💡</span>
        <span>Earn lumens by playing games on the Adventure map to unlock new sets.</span>
      </footer>
    </main>
  );
}
