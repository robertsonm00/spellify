// PINLocked — shown when the grown-up PIN gate hits its wrong-attempt
// ceiling (MAX_PIN_ATTEMPTS). The gate is sealed for PIN_LOCKOUT_MS; the
// only way straight through is to reset the PIN via the account email. A
// live countdown shows when entry re-opens, at which point onExpire() flips
// the gate back to normal entry.
//
// Props:
//   lockedUntil   epoch ms the lock lifts at
//   onExpire      () => void  — fired once the countdown reaches zero
//   onReset       () => void  — send the PIN-reset email (Forgot PIN route)
//   onClose       () => void  — close the gate (back to the selector)
//   busy          boolean     — disable the reset button mid-request
//   notice        string      — confirmation / feedback under the buttons

import React, { useEffect, useState } from 'react';
import './PIN.css';

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PINLocked({ lockedUntil, onExpire, onReset, onClose, busy = false, notice }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, lockedUntil - Date.now()));

  // Tick once a second; fire onExpire the moment the lock lifts so the
  // parent can swap us back to the entry gate.
  useEffect(() => {
    const tick = () => {
      const left = lockedUntil - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil, onExpire]);

  return (
    <div className="pin-overlay" role="dialog" aria-modal="true">
      <div className="pin-card pin-card--locked">
        {onClose && (
          <button type="button" className="pin-close" onClick={onClose} aria-label="Close">✕</button>
        )}

        <div className="pin-locked-icon" aria-hidden="true">🔒</div>
        <h2 className="pin-title">Too many tries</h2>
        <p className="pin-subtitle">
          For safety, the grown-up area is locked.<br />
          You can try again in <strong>{formatRemaining(remaining)}</strong>.
        </p>

        <p className="pin-locked-help">
          Forgotten your PIN? Reset it with an email to the grown-up's account.
        </p>
        <button
          type="button"
          className="pin-reset-btn"
          onClick={onReset}
          disabled={busy}
        >
          Reset PIN by email
        </button>

        {notice && <p className="pin-error" role="status">{notice}</p>}
      </div>
    </div>
  );
}
