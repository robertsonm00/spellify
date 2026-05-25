// ParentDashboard — minimal placeholder (Prompt 2).
//
// Drops here after the grown-up area PIN gate clears. For now this is
// the home of three controls:
//   • Change PIN     → opens PINSetup, writes new hash to profiles
//   • Remove PIN     → clears parent_pin_hash so the gate is open
//   • Sign out       → the nuclear control (only here, never on a
//                      child surface — per Prompt 3 spec)
// Plus a "Back to Who's playing?" exit that returns to the selector
// without signing out.
//
// Prompt 4/5 will grow this into the real reporting dashboard. The
// route + entry path are stable so future surface work doesn't
// re-shape navigation.

import React from 'react';
import './ParentDashboard.css';

export default function ParentDashboard({
  authUser,
  hasPin,
  childrenCount = 0,
  onChangePin,
  onRemovePin,
  onSignOut,
  onBackToSelector,
}) {
  const email = authUser?.email || '';
  return (
    <div className="pd-root">
      <header className="pd-header">
        <h1 className="pd-title">Grown-up area</h1>
        <button
          type="button"
          className="pd-back"
          onClick={onBackToSelector}
        >
          ← Back to Who's playing?
        </button>
      </header>

      <section className="pd-section">
        <h2 className="pd-section__h">Account</h2>
        <dl className="pd-meta">
          <div className="pd-meta__row">
            <dt>Signed in as</dt>
            <dd>{email || '—'}</dd>
          </div>
          <div className="pd-meta__row">
            <dt>Child profiles</dt>
            <dd>{childrenCount}</dd>
          </div>
          <div className="pd-meta__row">
            <dt>PIN protection</dt>
            <dd>{hasPin ? 'On' : 'Off — anyone can open this area'}</dd>
          </div>
        </dl>
      </section>

      <section className="pd-section">
        <h2 className="pd-section__h">Settings</h2>
        <div className="pd-actions">
          <button type="button" className="pd-btn" onClick={onChangePin}>
            {hasPin ? 'Change PIN' : 'Set a PIN'}
          </button>
          {hasPin && (
            <button type="button" className="pd-btn pd-btn--ghost" onClick={onRemovePin}>
              Remove PIN
            </button>
          )}
        </div>
      </section>

      <section className="pd-section">
        <h2 className="pd-section__h">Reports</h2>
        <p className="pd-coming-soon">
          Progress reports, weekly digests, and parent-teacher exports
          are coming soon.
        </p>
      </section>

      <section className="pd-section pd-section--danger">
        <h2 className="pd-section__h">Account</h2>
        <button type="button" className="pd-btn pd-btn--danger" onClick={onSignOut}>
          Sign out
        </button>
        <p className="pd-danger-hint">
          Signs out across all profiles on this device.
        </p>
      </section>
    </div>
  );
}
