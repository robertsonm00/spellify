import React from 'react';

/**
 * DevCompleteButton — a development-only "instant complete" affordance.
 *
 * Renders a small fixed button in the bottom-right corner that, when clicked,
 * jumps a game straight to its real end-of-game state (win), so the shared
 * results screen, its celebration, and the points / lumens / reward flow that
 * fires on "Continue" can all be tested without playing the game through.
 *
 * The button is gated on process.env.NODE_ENV: in a production build
 * (NODE_ENV === 'production') the early return is a compile-time constant, so
 * webpack/Terser dead-code-eliminates the markup and it never ships to users.
 *
 * Each game supplies its own `onClick` (a `handleDevComplete`) that sets the
 * game's state to "all words correct + finished", because the win condition
 * is game-specific. This component only owns the button chrome + the dev gate.
 */
export default function DevCompleteButton({ onClick, label = '⚡ DEV: Complete' }) {
  if (process.env.NODE_ENV !== 'development') return null;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        background: '#ff6b35',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        padding: '8px 14px',
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'monospace',
      }}
    >
      {label}
    </button>
  );
}
