// PINEntry — 4-digit grown-up area PIN gate.
//
// Reusable across "enter PIN to open grown-up area" and "confirm PIN
// to change it later". Renders four large circular digit inputs in an
// arcade-style row, auto-advances on input, supports backspace, and
// auto-submits the moment the fourth digit lands. Shake + clear on a
// wrong attempt. "Forgot PIN?" triggers a password-reset email via
// the parent's Supabase account.
//
// Props:
//   title          string (default "Enter your PIN")
//   subtitle       string — short context line
//   onSubmit       async (pin) => boolean   true = correct, false = shake
//   onForgot       () => void               — typically triggers email reset
//   onCancel       () => void               — close the modal (back to selector)
//   busy           boolean — pause input during async submit
//   errorMessage   string — surfaced beneath the inputs

import React, { useEffect, useRef, useState } from 'react';
import './PIN.css';

const PIN_LENGTH = 4;

export default function PINEntry({
  title = 'Enter your PIN',
  subtitle,
  onSubmit,
  onForgot,
  onCancel,
  busy = false,
  errorMessage,
}) {
  const [digits, setDigits] = useState(Array(PIN_LENGTH).fill(''));
  const [shake,  setShake]  = useState(false);
  const inputRefs = useRef([]);

  // Autofocus first cell on mount.
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Whenever the pin becomes fully filled, submit. The submit handler
  // returns true/false — false triggers shake + clear so the user can
  // try again.
  useEffect(() => {
    const full = digits.every((d) => d !== '');
    if (!full || busy) return;
    (async () => {
      const ok = await onSubmit?.(digits.join(''));
      if (ok === false) {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setDigits(Array(PIN_LENGTH).fill(''));
          inputRefs.current[0]?.focus();
        }, 350);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits.join(''), busy]);

  const handleChange = (i, raw) => {
    // Accept only one digit per cell. If a paste smuggles in more,
    // distribute across remaining cells.
    const clean = String(raw).replace(/\D/g, '');
    if (clean.length === 0) {
      setDigits((prev) => {
        const next = [...prev]; next[i] = ''; return next;
      });
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      for (let j = 0; j < clean.length && i + j < PIN_LENGTH; j++) {
        next[i + j] = clean[j];
      }
      return next;
    });
    // Move focus to the next empty cell.
    const advanceTo = Math.min(i + clean.length, PIN_LENGTH - 1);
    inputRefs.current[advanceTo]?.focus();
    inputRefs.current[advanceTo]?.select?.();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      setDigits((prev) => {
        const next = [...prev];
        if (next[i]) {
          next[i] = '';
        } else if (i > 0) {
          next[i - 1] = '';
          inputRefs.current[i - 1]?.focus();
        }
        return next;
      });
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      inputRefs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < PIN_LENGTH - 1) {
      e.preventDefault();
      inputRefs.current[i + 1]?.focus();
    } else if (e.key === 'Enter') {
      // Try to submit whatever is there; the effect will only fire
      // when all 4 cells are populated.
    }
  };

  return (
    <div className="pin-overlay" role="dialog" aria-modal="true">
      <div className={`pin-card${shake ? ' pin-card--shake' : ''}`}>
        {onCancel && (
          <button type="button" className="pin-close" onClick={onCancel} aria-label="Close">✕</button>
        )}
        <h2 className="pin-title">{title}</h2>
        {subtitle && <p className="pin-subtitle">{subtitle}</p>}

        <div className="pin-row" role="group" aria-label="PIN digits">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              className="pin-cell"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={d}
              disabled={busy}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              aria-label={`PIN digit ${i + 1}`}
            />
          ))}
        </div>

        {errorMessage && (
          <p className="pin-error" role="alert">{errorMessage}</p>
        )}

        {onForgot && (
          <button type="button" className="pin-forgot" onClick={onForgot} disabled={busy}>
            Forgot PIN?
          </button>
        )}
      </div>
    </div>
  );
}
