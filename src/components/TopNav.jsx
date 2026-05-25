import React, { useEffect } from 'react';
import './TopNav.css';

// Desktop header — intentionally minimal. The brand logo doubles as a
// Home button. Everything else (nav tabs, settings, sign-in / sign-out,
// account avatar) lives in ArcadeFooter so the top edge of the screen
// stays clean and the map can fill the viewport.

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

export default function TopNav({ onHomeClick, gameTitle }) {
  // Ensure the body.game-active class (which hides the TopNav while a
  // game is mounted) is cleared whenever the TopNav itself renders.
  useEffect(() => {
    document.body.classList.remove('game-active');
  }, []);

  return (
    <nav className="topnav topnav--classic">
      <div className="topnav-left">
        <button
          type="button"
          className="topnav-brand topnav-brand--btn"
          aria-label="Spellify — go to Home"
          onClick={onHomeClick}
        >
          {BRAND_LETTERS.map(({ letter, color }, i) => (
            <span
              key={i}
              className="topnav-brand-letter"
              style={{ color, animationDelay: `${i * 0.08}s` }}
            >
              {letter}
            </span>
          ))}
        </button>
      </div>

      {gameTitle && <div className="topnav-game-title">{gameTitle}</div>}
    </nav>
  );
}
