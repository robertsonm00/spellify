import React, { useEffect } from 'react';
import './GameHeader.css';

// Standardised game-screen header used by every activity. Renders:
//   [← Exit]   SPELLIFY · <title>   [right slot]
// While mounted, hides the global TopNav via a body class so a single
// header sits at the top of every game.

const HEADER_STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left:  (i * 37 + 13) % 100,
  top:   (i * 53 + 7)  % 100,
  size:  6 + (i % 4) * 3,
  dim:   i % 3 === 0,
}));

const BRAND_LETTERS = [
  { letter: 'S', color: '#ff6b6b' },
  { letter: 'P', color: '#ffd93d' },
  { letter: 'E', color: '#6bcb77' },
  { letter: 'L', color: '#4d96ff' },
  { letter: 'L', color: '#c77dff' },
  { letter: 'I', color: '#ff9f43' },
  { letter: 'F', color: '#ff6b6b' },
  { letter: 'Y', color: '#ffd93d' },
];

export default function GameHeader({ title, onExit, rightSlot = null }) {
  // Hide the global TopNav while any game is on screen.
  useEffect(() => {
    document.body.classList.add('game-active');
    return () => document.body.classList.remove('game-active');
  }, []);

  return (
    <div className="game-header">
      <div className="game-header-stars" aria-hidden="true">
        {HEADER_STARS.map((s) => (
          <span
            key={s.id}
            className={`game-header-star${s.dim ? ' game-header-star--dim' : ''}`}
            style={{ left: `${s.left}%`, top: `${s.top}%`, fontSize: `${s.size}px` }}
          >★</span>
        ))}
      </div>
      {onExit ? (
        <button className="game-header-exit" onClick={onExit}>← Exit</button>
      ) : <span className="game-header-exit-spacer" />}
      <div className="game-header-center">
        <span className="game-header-brand" aria-label="Spellify">
          {BRAND_LETTERS.map(({ letter, color }, i) => (
            <span
              key={i}
              className="game-header-brand-letter"
              style={{ color, animationDelay: `${i * 0.08}s` }}
            >{letter}</span>
          ))}
        </span>
        {title && <h2 className="game-header-title">{title}</h2>}
      </div>
      <div className="game-header-right">{rightSlot}</div>
    </div>
  );
}
