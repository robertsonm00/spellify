// Floating Spellify logo — magical adventure edition.
// Sits fixed top-left over the map. Clicking routes to Home.

import React from 'react';
import './SpellifyLogo.css';

// Palette: white → light aqua → pink → purple lilac, cycling across the letters.
const LETTERS = [
  { letter: 'S', color: '#ffffff' },
  { letter: 'P', color: '#a5f3fc' },
  { letter: 'E', color: '#f9a8d4' },
  { letter: 'L', color: '#d8b4fe' },
  { letter: 'L', color: '#ffffff' },
  { letter: 'I', color: '#a5f3fc' },
  { letter: 'F', color: '#f9a8d4' },
  { letter: 'Y', color: '#d8b4fe' },
];

// Tiny sparkle stars scattered around the wordmark.
const SPARKLES = [
  { char: '✦', className: 'spellify-logo__spark--1' },
  { char: '✧', className: 'spellify-logo__spark--2' },
  { char: '✦', className: 'spellify-logo__spark--3' },
  { char: '✧', className: 'spellify-logo__spark--4' },
];

export default function SpellifyLogo({ onClick, onHomeClick, variant }) {
  const handleClick = onClick || onHomeClick;
  const isAdventure = variant === 'adventure';
  const className = `spellify-logo${isAdventure ? ' spellify-logo--adventure' : ''}`;
  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      aria-label="Spellify — go to Home"
    >
      {/* Frosted backdrop — hidden in adventure variant */}
      {!isAdventure && <span className="spellify-logo__backdrop" aria-hidden="true" />}

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
            style={{ color: isAdventure ? '#ffffff' : color, animationDelay: `${i * 0.1}s` }}
          >
            {letter}
          </span>
        ))}
      </span>
    </button>
  );
}
