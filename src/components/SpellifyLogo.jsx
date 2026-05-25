// Floating Spellify logo — used in place of the old desktop TopNav.
// Sits absolutely positioned top-left of the viewport on top of the
// map background. Clicking it routes to Home.

import React from 'react';
import './SpellifyLogo.css';

const LETTERS = [
  { letter: 'S', color: '#ff6b6b' },
  { letter: 'P', color: '#ffd93d' },
  { letter: 'E', color: '#6bcb77' },
  { letter: 'L', color: '#4d96ff' },
  { letter: 'L', color: '#c77dff' },
  { letter: 'I', color: '#ff9f43' },
  { letter: 'F', color: '#ff6b6b' },
  { letter: 'Y', color: '#ffd93d' },
];

export default function SpellifyLogo({ onClick }) {
  return (
    <button
      type="button"
      className="spellify-logo"
      onClick={onClick}
      aria-label="Spellify — go to Home"
    >
      {LETTERS.map(({ letter, color }, i) => (
        <span
          key={i}
          className="spellify-logo__letter"
          style={{ color, animationDelay: `${i * 0.08}s` }}
        >
          {letter}
        </span>
      ))}
    </button>
  );
}
