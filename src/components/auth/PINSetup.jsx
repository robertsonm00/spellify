// PINSetup — first-time PIN creation for the grown-up area.
//
// Two-stage flow:
//   1. Enter a 4-digit PIN.
//   2. Confirm it (re-enter exactly the same digits).
// On match → onSave(pin). On mismatch → shake + reset to stage 1.
//
// `isMandatory` (R2-06): when a PIN-less parent first opens the
// grown-up area, setting a PIN is required — there's no "Skip", so the
// only way IN is to set one (the gate can't be left open). They can
// still back out with the ✕ (onCancel), which closes the gate and
// leaves them OUTSIDE the area — no back-door. "Skip" is offered only
// when the parent is *changing* an existing PIN from inside the
// dashboard (already past the gate, so backing out is harmless).

import React, { useState } from 'react';
import PINEntry from './PINEntry';
import './PIN.css';

export default function PINSetup({ onSave, onSkip, onCancel, isMandatory = false, busy = false }) {
  // Two different "ways out", kept distinct:
  //   skip   — proceed WITHOUT setting/changing a PIN. Only offered for
  //            the optional change-PIN flow; never for mandatory setup
  //            (that's the back-door R2-06 closes).
  //   cancel — back out of the gate entirely (close it, don't enter the
  //            grown-up area). Always available, so a parent who tapped
  //            in by accident isn't trapped. For mandatory setup this is
  //            the ONLY exit, and it leaves them safely OUTSIDE the gate.
  const skip   = isMandatory ? null : onSkip;
  const cancel = isMandatory ? onCancel : onSkip;
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
          ? (isMandatory
              ? 'Set this now so only grown-ups can open the grown-up area.'
              : 'This stops little hands from opening the grown-up area.')
          : 'One more time so we know it\'s really yours.'}
        onSubmit={stage === 'create' ? handleCreate : handleConfirm}
        onCancel={cancel}
        busy={busy}
        errorMessage={error}
      />
      {/* Skip option — only on the first stage, and only when setup is
          optional (changing an existing PIN). A mandatory first-time
          setup has no escape hatch (R2-06). */}
      {stage === 'create' && skip && (
        <button
          type="button"
          className="pin-skip"
          onClick={skip}
          disabled={busy}
        >
          Skip for now
        </button>
      )}
    </>
  );
}
