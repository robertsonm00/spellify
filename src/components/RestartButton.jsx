import React, { useState } from 'react';

// Standardised restart control used across every game. Renders the ↺ Restart
// button styled to slot into <GameHeader rightSlot>. When `hasProgress` is
// true, clicking opens an "Are you sure?" modal; when false it restarts
// immediately. Confirming runs `onRestart` (the host's "go back to word 1"
// reset).
export default function RestartButton({ hasProgress, onRestart, label = 'Restart game' }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClick = () => {
    if (hasProgress) setConfirmOpen(true);
    else onRestart();
  };

  const confirmAndRestart = () => {
    setConfirmOpen(false);
    onRestart();
  };

  return (
    <>
      <button className="game-header-btn" onClick={handleClick} title={label}>
        ↺ Restart
      </button>

      {confirmOpen && (
        <div className="exit-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="exit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="exit-modal-icon">↺</div>
            <h2 className="exit-modal-title">Restart?</h2>
            <p className="exit-modal-body">You'll lose your progress so far.</p>
            <div className="exit-modal-btns">
              <button className="exit-btn exit-btn--cancel"  onClick={() => setConfirmOpen(false)}>Keep going</button>
              <button className="exit-btn exit-btn--confirm" onClick={confirmAndRestart}>Yes, restart</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
