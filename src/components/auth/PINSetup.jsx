// PINSetup — first-time PIN creation for the grown-up area.
//
// Two-stage flow:
//   1. Enter a 4-digit PIN.
//   2. Confirm it (re-enter exactly the same digits).
// On match → onSave(pin). On mismatch → shake + reset to stage 1.
//
// Per spec the parent can skip — `onSkip` keeps `parent_pin_hash`
// null and the grown-up area is open-access. They can set a PIN later
// from the dashboard settings.

import React, { useState } from 'react';
import PINEntry from './PINEntry';
import './PIN.css';

export default function PINSetup({ onSave, onSkip, busy = false }) {
  const [stage, setStage]   = useState('create');   // 'create' | 'confirm'
  const [firstPin, setFirst] = useState('');
  const [error, setError]    = useState(null);

  const handleCreate = async (pin) => {
    setFirst(pin);
    setStage('confirm');
    return true;     // accept — advance to confirm stage
  };

  const handleConfirm = async (pin) => {
    if (pin !== firstPin) {
      setError('Those PINs didn\'t match — let\'s try again.');
      setFirst('');
      setStage('create');
      return false;
    }
    setError(null);
    await onSave?.(pin);
    return true;
  };

  return (
    <>
      <PINEntry
        key={stage}                            // remount → fresh digit state
        title={stage === 'create'
          ? 'Set a 4-digit PIN'
          : 'Re-enter your PIN'}
        subtitle={stage === 'create'
          ? 'This stops little hands from opening the grown-up area.'
          : 'One more time so we know it\'s really yours.'}
        onSubmit={stage === 'create' ? handleCreate : handleConfirm}
        onCancel={onSkip}
        busy={busy}
        errorMessage={error}
      />
      {/* Skip option — only meaningful on the first stage. */}
      {stage === 'create' && onSkip && (
        <button
          type="button"
          className="pin-skip"
          onClick={onSkip}
          disabled={busy}
        >
          Skip for now
        </button>
      )}
    </>
  );
}
