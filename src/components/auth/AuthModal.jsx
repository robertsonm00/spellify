// AuthModal — parent account sign-in / sign-up.
//
// Two tabs (sign in / sign up). On successful sign up, displays an
// "check your email" message rather than closing — the user needs to
// confirm their email before they can sign in. On successful sign in,
// closes via `onClose`. Errors render inline beneath the form.
//
// Child profile creation happens in CreateChildProfile, AFTER first
// successful sign-in — not in this modal.

import React, { useEffect, useState } from 'react';
import { signIn, signUp, resetPassword } from '../../lib/auth';
import './AuthModal.css';

const MIN_PASSWORD = 8;

// Strong-password generator. Guarantees at least one lowercase,
// uppercase, digit, and symbol, then 8 random chars from the full
// pool, finally shuffled — meets Supabase's complexity defaults.
function generatePassword() {
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits  = '0123456789';
  const symbols = '!@#$%^&*';
  const all     = lower + upper + digits + symbols;
  const pwd = [
    lower  [Math.floor(Math.random() * lower.length)],
    upper  [Math.floor(Math.random() * upper.length)],
    digits [Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  for (let i = 0; i < 8; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }
  return pwd.sort(() => Math.random() - 0.5).join('');
}

export default function AuthModal({ initialView = 'signin', onClose, onSignedIn }) {
  const [view,     setView]     = useState(initialView); // 'signin' | 'signup'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [busy,     setBusy]     = useState(false);
  // Generator state — cleared whenever the parent edits the password.
  const [generated, setGenerated] = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [error,    setError]    = useState(null);
  const [notice,   setNotice]   = useState(null); // success/info message
  const [resetSent, setResetSent] = useState(false);

  // Esc closes the modal.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reset = () => {
    setError(null); setNotice(null); setResetSent(false);
  };
  const switchView = (next) => {
    setView(next); reset();
    // Generator UI is sign-up-only; reset it on any view switch.
    setGenerated(false); setCopied(false);
  };

  const handleGenerate = () => {
    const pw = generatePassword();
    setPassword(pw);
    setConfirm(pw);
    setShowPw(true);           // reveal so the parent can see/copy it
    setGenerated(true);
    setCopied(false);
    setError(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked (e.g. insecure context). Fall back
      // to selecting the field so the parent can copy manually.
      const el = document.querySelector('.auth-form input[type="text"], .auth-form input[type="password"]');
      el?.select?.();
    }
  };

  // Manual edits in either password field invalidate the generated
  // state (the suggested password is no longer what's typed).
  const onPasswordInput = (e) => {
    setPassword(e.target.value);
    if (generated) { setGenerated(false); setCopied(false); }
  };
  const onConfirmInput = (e) => {
    setConfirm(e.target.value);
    if (generated) { setGenerated(false); setCopied(false); }
  };

  const validate = () => {
    if (!email.includes('@'))            return 'Please enter a valid email.';
    if (!password)                       return 'Password is required.';
    if (view === 'signup') {
      if (password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
      if (password !== confirm)           return 'Passwords don’t match.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    reset();
    const v = validate();
    if (v) { setError(v); return; }

    setBusy(true);
    try {
      if (view === 'signup') {
        const { error: err } = await signUp(email.trim(), password);
        if (err) { setError(err.message); return; }
        setNotice('Check your email to confirm your account before signing in.');
        setPassword(''); setConfirm('');
      } else {
        const { error: err } = await signIn(email.trim(), password);
        if (err) { setError(err.message); return; }
        onSignedIn?.();
        onClose?.();
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    reset();
    if (!email.includes('@')) { setError('Enter your email above first, then tap Forgot password.'); return; }
    setBusy(true);
    try {
      const { error: err } = await resetPassword(email.trim());
      if (err) { setError(err.message); return; }
      setResetSent(true);
      setNotice(`We’ve sent a password reset link to ${email}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Sign in to Spellify">
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal__close" aria-label="Close" onClick={onClose}>✕</button>

        <header className="auth-modal__head">
          <h2 className="auth-modal__title">{view === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-modal__subtitle">
            {view === 'signin'
              ? 'Sign in to sync your child’s progress across devices.'
              : 'Grown-ups only — your child’s profile comes next.'}
          </p>
        </header>

        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'signin'}
                  className={`auth-tab${view === 'signin' ? ' auth-tab--active' : ''}`}
                  onClick={() => switchView('signin')}>Sign In</button>
          <button type="button" role="tab" aria-selected={view === 'signup'}
                  className={`auth-tab${view === 'signup' ? ' auth-tab--active' : ''}`}
                  onClick={() => switchView('signup')}>Sign Up</button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-field__label">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="auth-field">
            <span className="auth-field__label-row">
              <span className="auth-field__label">Password</span>
              {view === 'signup' && (
                <button
                  type="button"
                  className="auth-generate"
                  onClick={handleGenerate}
                  title="Generate a strong password"
                >
                  ✦ Generate password
                </button>
              )}
            </span>
            <span className="auth-field__pw">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={onPasswordInput}
                placeholder={view === 'signup' ? `Min ${MIN_PASSWORD} characters` : 'Your password'}
                minLength={view === 'signup' ? MIN_PASSWORD : undefined}
                required
              />
              <button type="button" className="auth-field__pw-toggle"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPw((v) => !v)}>
                {showPw ? '🙈' : '👁'}
              </button>
            </span>
            {view === 'signup' && generated && (
              <span className="auth-generated">
                <button
                  type="button"
                  className={`auth-copy${copied ? ' auth-copy--copied' : ''}`}
                  onClick={handleCopy}
                  aria-label="Copy generated password"
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
                <span className="auth-generated__note">
                  Save this password somewhere safe — you’ll need it to sign in.
                </span>
              </span>
            )}
          </label>

          {view === 'signup' && (
            <label className="auth-field">
              <span className="auth-field__label">Confirm password</span>
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={onConfirmInput}
                placeholder="Re-enter your password"
                minLength={MIN_PASSWORD}
                required
              />
            </label>
          )}

          {error  && <p className="auth-error"  role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Working…' : (view === 'signin' ? 'Sign In' : 'Create Account')}
          </button>

          {view === 'signin' && !resetSent && (
            <button type="button" className="auth-forgot" onClick={handleForgot} disabled={busy}>
              Forgot password?
            </button>
          )}

          <p className="auth-switch">
            {view === 'signin'
              ? <>New here? <button type="button" className="auth-switch__link" onClick={() => switchView('signup')}>Create an account</button></>
              : <>Already have one? <button type="button" className="auth-switch__link" onClick={() => switchView('signin')}>Sign in</button></>}
          </p>
        </form>
      </div>
    </div>
  );
}
