import React, { useEffect } from 'react';
import './GameHeader.css';

// Standardised game-screen header used by every activity.
//
// Layout after redesign:
//   - Progress bar: fixed at very top of viewport (rendered by GameProgressStrip)
//   - SPELLIFY brand: removed
//   - Exit button: floating fixed overlay, top-left, below the progress bar
//   - Header bar: thin bar showing game title (centred) + right slot buttons
//
// While mounted, hides the global TopNav via a body class.

export default function GameHeader({ title, onExit, rightSlot = null }) {
  // Hide the global TopNav while any game is on screen.
  useEffect(() => {
    document.body.classList.add('game-active');
    return () => document.body.classList.remove('game-active');
  }, []);

  // Render only the floating exit button — no header bar.
  // Always returns a fragment so the component's output type stays
  // structurally consistent regardless of whether onExit is provided
  // (prevents React HMR / reconciliation drift between renders).
  return (
    <>
      {onExit && (
        <button className="game-header-exit" onClick={onExit} aria-label="Exit game">
          Exit
        </button>
      )}
    </>
  );
}
