import React from 'react';
import './Welcome.css';

const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  left: (i * 37 + 13) % 100,
  top:  (i * 53 + 7)  % 100,
  delay: ((i * 0.31) % 3).toFixed(2),
  size:  8 + (i % 4) * 4,
  dim:   i % 3 === 0,
}));

const TITLE = [
  { letter: 'S', color: '#ff6b6b' },
  { letter: 'P', color: '#ffd93d' },
  { letter: 'E', color: '#6bcb77' },
  { letter: 'L', color: '#4d96ff' },
  { letter: 'L', color: '#c77dff' },
  { letter: 'I', color: '#ff9f43' },
  { letter: 'F', color: '#ff6b6b' },
  { letter: 'Y', color: '#ffd93d' },
];

function Welcome({ onStart, onSignIn, onCreateAccount }) {
  return (
    <div className="welcome">
      <div className="welcome-stars" aria-hidden="true">
        {STARS.map((s) => (
          <span
            key={s.id}
            className={`welcome-star${s.dim ? ' welcome-star--dim' : ''}`}
            style={{
              left:            `${s.left}%`,
              top:             `${s.top}%`,
              fontSize:        `${s.size}px`,
              animationDelay:  `${s.delay}s`,
            }}
          >★</span>
        ))}
      </div>

      <div className="welcome-content">
        <div className="welcome-logo-wrap">
          <h1 className="welcome-title">
            {TITLE.map(({ letter, color }, i) => (
              <span
                key={i}
                className="welcome-title-letter"
                style={{ color, animationDelay: `${i * 0.1}s` }}
              >
                {letter}
              </span>
            ))}
          </h1>
          <p className="welcome-subtitle">Master your spellings with fun games!</p>
        </div>

        <div className="welcome-character" aria-hidden="true">🧙</div>

        <div className="welcome-btns">
          <button
            className="welcome-btn welcome-btn--primary"
            onClick={onStart}
          >
            ▶ Quick Start
          </button>
          <button
            className="welcome-btn welcome-btn--secondary"
            onClick={onSignIn || onStart}
          >
            Sign In / Sign Up
          </button>
        </div>

        <p className="welcome-hint">No sign-in needed in guest mode — pick your age and play.</p>
      </div>
    </div>
  );
}

export default Welcome;
