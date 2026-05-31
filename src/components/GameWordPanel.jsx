import React, { useState } from 'react';
import { WordDetailModal } from './WordListHub';
import './GameWordPanel.css';

// Shared in-game word-list panel (R2-04).
//
// Spellify is a *spelling* app, not a memory test of the word set — so the
// words a child is learning should always be available to glance at, in
// every game. This panel ports the hub's word list into a single reusable,
// collapsible panel that is injected once at each game-launch point
// (App.jsx for My Words, exploreActivityRunner for Explore lists), so every
// game gets it without per-game wiring.
//
//   - Desktop: a fixed panel on the far right, open by default, toggled by a
//     pull-tab on the right edge.
//   - Mobile: closed by default so it never covers the grid / keyboard /
//     tiles; a right-edge pull-tab slides it in over a dimming scrim, and it
//     closes on tap-away or the ✕.
//
// Tapping a word opens the shared WordDetailModal (meaning + audio), the same
// modal used on the hub.

const CHIP_COLORS = [
  { bg: '#fff0f0', border: '#ff6b6b' },
  { bg: '#fff8e1', border: '#ffd93d' },
  { bg: '#f0fff4', border: '#6bcb77' },
  { bg: '#e8f4ff', border: '#4d96ff' },
  { bg: '#f5f0ff', border: '#c77dff' },
  { bg: '#fff4ec', border: '#ff9f43' },
  { bg: '#f0ffff', border: '#00d2d3' },
  { bg: '#fff0f8', border: '#ff6b9d' },
];

function isDesktopViewport() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(min-width: 769px)').matches;
}

export default function GameWordPanel({ words = [], userAge = 8, listName = 'Your words' }) {
  // Open by default on desktop (room to spare), closed on mobile (protect the
  // game surface). The child toggles from there via the tab / ✕.
  const [open, setOpen] = useState(isDesktopViewport);
  const [activeWord, setActiveWord] = useState(null);

  // Nothing to show — don't mount the tab either.
  if (!Array.isArray(words) || words.length === 0) return null;

  return (
    <>
      {/* Pull-tab — always on the right edge; rides the panel's left edge
          when open on desktop, hides behind the open drawer on mobile. */}
      <button
        type="button"
        className={`gwp-tab${open ? ' gwp-tab--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Hide word list' : 'Show word list'}
        aria-expanded={open}
      >
        <span className="gwp-tab__icon" aria-hidden="true">{open ? '✕' : '📖'}</span>
        <span className="gwp-tab__label">Words</span>
      </button>

      {/* Scrim — mobile only (CSS hides it on desktop); tap-away closes. */}
      {open && (
        <div className="gwp-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <aside
        className={`gwp-panel${open ? ' gwp-panel--open' : ''}`}
        role="dialog"
        aria-label="Word list"
        aria-hidden={!open}
      >
        <header className="gwp-panel__header">
          <div className="gwp-panel__heading">
            <span className="gwp-panel__label">WORD LIST</span>
            <h2 className="gwp-panel__title">{listName}</h2>
          </div>
          <button
            type="button"
            className="gwp-panel__close"
            onClick={() => setOpen(false)}
            aria-label="Close word list"
          >
            ✕
          </button>
        </header>

        <p className="gwp-panel__hint">Tap a word to hear it and see what it means.</p>

        <div className="gwp-chips">
          {words.map((w, i) => {
            const { bg, border } = CHIP_COLORS[i % CHIP_COLORS.length];
            return (
              <button
                key={`${w}-${i}`}
                type="button"
                className="gwp-chip"
                style={{ background: bg, borderColor: border }}
                onClick={() => setActiveWord({ word: w, chipColor: border })}
              >
                {w}
              </button>
            );
          })}
        </div>
      </aside>

      {activeWord && (
        <WordDetailModal
          word={activeWord.word}
          chipColor={activeWord.chipColor}
          userAge={userAge}
          onClose={() => setActiveWord(null)}
        />
      )}
    </>
  );
}
