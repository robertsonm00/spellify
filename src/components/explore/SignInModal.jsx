import React, { useState } from 'react';
import { isSupabaseEnabled } from '../../lib/supabase';
import './SignInModal.css';

const YEAR_GROUPS = [1, 2, 3, 4, 5, 6];

export default function SignInModal({ onClose, signIn, signUp, signInWithGoogle }) {
  const [tab,            setTab]            = useState('signin');  // 'signin' | 'signup'
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [confirmPw,      setConfirmPw]      = useState('');
  const [displayName,    setDisplayName]    = useState('');
  const [yearGroup,      setYearGroup]      = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');

  const resetForm = () => {
    setEmail(''); setPassword(''); setConfirmPw('');
    setDisplayName(''); setYearGroup(null);
    setError(''); setSuccess('');
  };

  const switchTab = (t) => { setTab(t); resetForm(); };

  // ── Sign in ──────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true); setError('');
    const { error: err } = await signIn({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Wrong email or password — try again.'
        : err.message);
    } else {
      onClose();
    }
  };

  // ── Sign up ──────────────────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) { setError('Please enter a display name.'); return; }
    if (!email)              { setError('Please enter an email address.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    const { error: err } = await signUp({ email, password, displayName: displayName.trim(), yearGroup });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess('Account created! Check your email to confirm, then sign in.');
      resetForm();
      setTab('signin');
    }
  };

  return (
    <div className="sim-backdrop" onClick={onClose}>
      <div className="sim-wrap" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Sign in">
        {/* Header */}
        <button className="sim-close" onClick={onClose} aria-label="Close">✕</button>
        <h2 className="sim-heading">🎮 Spellify</h2>
        <p className="sim-sub">Sign in to save your progress across all your devices</p>

        {/* Tabs */}
        <div className="sim-tabs">
          <button
            className={`sim-tab${tab === 'signin' ? ' sim-tab--active' : ''}`}
            onClick={() => switchTab('signin')}
          >
            Sign in
          </button>
          <button
            className={`sim-tab${tab === 'signup' ? ' sim-tab--active' : ''}`}
            onClick={() => switchTab('signup')}
          >
            Create account
          </button>
        </div>

        {/* Success banner */}
        {success && <div className="sim-success">{success}</div>}

        {/* ── Sign in form ── */}
        {tab === 'signin' && (
          <form className="sim-form" onSubmit={handleSignIn} noValidate>
            <label className="sim-label">Email</label>
            <input
              className="sim-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />

            <label className="sim-label">Password</label>
            <input
              className="sim-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            {error && <p className="sim-error">{error}</p>}

            <button className="sim-btn sim-btn--primary" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            {isSupabaseEnabled && (
              <button
                type="button"
                className="sim-btn sim-btn--google"
                onClick={() => signInWithGoogle?.()}
              >
                <span className="sim-google-icon">G</span> Continue with Google
              </button>
            )}

            <button type="button" className="sim-btn sim-btn--ghost" onClick={onClose}>
              Continue without signing in
            </button>
          </form>
        )}

        {/* ── Sign up form ── */}
        {tab === 'signup' && (
          <form className="sim-form" onSubmit={handleSignUp} noValidate>
            <label className="sim-label">Your name (e.g. Billy)</label>
            <input
              className="sim-input"
              type="text"
              placeholder="Your first name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              autoComplete="nickname"
            />

            <label className="sim-label">What year are you in?</label>
            <div className="sim-year-pills">
              {YEAR_GROUPS.map(y => (
                <button
                  key={y}
                  type="button"
                  className={`sim-year-pill${yearGroup === y ? ' sim-year-pill--active' : ''}`}
                  onClick={() => setYearGroup(y)}
                >
                  Year {y}
                </button>
              ))}
            </div>

            <label className="sim-label">Parent or guardian's email</label>
            <input
              className="sim-input"
              type="email"
              placeholder="parent@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />

            <label className="sim-label">Password (min 8 characters)</label>
            <input
              className="sim-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            <label className="sim-label">Confirm password</label>
            <input
              className="sim-input"
              type="password"
              placeholder="••••••••"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              autoComplete="new-password"
            />

            {error && <p className="sim-error">{error}</p>}

            <button className="sim-btn sim-btn--primary" type="submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>

            <p className="sim-privacy">
              🔒 We only store your name and year group. No personal data is shared.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
