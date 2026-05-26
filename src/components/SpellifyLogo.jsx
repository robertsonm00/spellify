// Floating Spellify logo — magical adventure edition.
// Sits fixed top-left over the map. Clicking routes to Home.

import React from 'react';
import './SpellifyLogo.css';

// Magical palette: pink → purple → aqua → gold cycling across the letters.
const LETTERS = [
  { letter: 'S', color: '#ec4899' },
  { letter: 'P', color: '#c77dff' },
  { letter: 'E', color: '#06b6d4' },
  { letter: 'L', color: '#fbbf24' },
  { letter: 'L', color: '#ec4899' },
  { letter: 'I', color: '#c77dff' },
  { letter: 'F', color: '#06b6d4' },
  { letter: 'Y', color: '#fbbf24' },
];

// Tiny sparkle stars scattered around the wordmark.
const SPARKLES = [
  { char: '✦', className: 'spellify-logo__spark--1' },
  { char: '✧', className: 'spellify-logo__spark--2' },
  { char: '✦', className: 'spellify-logo__spark--3' },
  { char: '✧', className: 'spellify-logo__spark--4' },
];

export default function SpellifyLogo({ onClick }) {
  return (
    <button
      type="button"
      className="spellify-logo"
      onClick={onClick}
      aria-label="Spellify — go to Home"
    >
      {/* Frosted backdrop */}
      <span className="spellify-logo__backdrop" aria-hidden="true" />

      {/* Sparkle stars */}
      {SPARKLES.map(({ char, className }, i) => (
        <span key={i} className={`spellify-logo__spark ${className}`} aria-hidden="true">
          {char}
        </span>
      ))}

      {/* Wordmark */}
      <span className="spellify-logo__word">
        {LETTERS.map(({ letter, color }, i) => (
          <span
            key={i}
            className="spellify-logo__letter"
            style={{ color, animationDelay: `${i * 0.1}s` }}
          >
            {letter}
          </span>
        ))}
      </span>
    </button>
  );
}
