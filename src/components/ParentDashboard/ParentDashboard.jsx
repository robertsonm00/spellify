import React, { useState } from 'react';
import BuddyAvatar from '../BuddyAvatar';
import EditChildProfile from '../auth/EditChildProfile';
import './ParentDashboard.css';

const YEAR_LABELS = {
  0: 'Reception', 1: 'Year 1', 2: 'Year 2', 3: 'Year 3',
  4: 'Year 4',    5: 'Year 5', 6: 'Year 6',
};

export default function ParentDashboard({
  authUser,
  hasPin,
  children = [],
  onEditChild,
  onDeleteChild,
  onChangePin,
  onRemovePin,
  onSignOut,
  onBackToSelector,
}) {
  const [editingChild, setEditingChild] = useState(null);

  const email = authUser?.email || '';

  // ── Edit overlay ─────────────────────────────────────────────────
  if (editingChild) {
    return (
      <EditChildProfile
        authUser={authUser}
        child={editingChild}
        onSaved={(updated) => {
          onEditChild?.(updated);
          setEditingChild(null);
        }}
        onDeleted={(id) => {
          onDeleteChild?.(id);
          setEditingChild(null);
        }}
        onCancel={() => setEditingChild(null)}
      />
    );
  }

  return (
    <div className="pd-root">
      <header className="pd-header">
        <h1 className="pd-title">Grown-up area</h1>
        <button type="button" className="pd-back" onClick={onBackToSelector}>
          ← Back to Who's playing?
        </button>
      </header>

      {/* ── Children ── */}
      <section className="pd-section">
        <h2 className="pd-section__h">Children</h2>
        {children.length === 0 ? (
          <p className="pd-coming-soon">No child profiles yet.</p>
        ) : (
          <ul className="pd-child-list">
            {children.map((child) => (
              <li key={child.id} className="pd-child-row">
                <span className="pd-child-avatar">
                  <BuddyAvatar
                    id={child.active_buddy_id}
                    fallback="🦝"
                    size={40}
                  />
                </span>
                <span className="pd-child-info">
                  <span className="pd-child-name">{child.nickname}</span>
                  <span className="pd-child-year">
                    {YEAR_LABELS[child.school_year] ?? `Year ${child.school_year}`}
                  </span>
                </span>
                <button
                  type="button"
                  className="pd-edit-btn"
                  onClick={() => setEditingChild(child)}
                  aria-label={`Edit ${child.nickname}'s profile`}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Account ── */}
      <section className="pd-section">
        <h2 className="pd-section__h">Account</h2>
        <dl className="pd-meta">
          <div className="pd-meta__row">
            <dt>Signed in as</dt>
            <dd>{email || '—'}</dd>
          </div>
          <div className="pd-meta__row">
            <dt>Child profiles</dt>
            <dd>{children.length}</dd>
          </div>
          <div className="pd-meta__row">
            <dt>PIN protection</dt>
            <dd>{hasPin ? 'On' : 'Off — anyone can open this area'}</dd>
          </div>
        </dl>
      </section>

      {/* ── Settings ── */}
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

      {/* ── Reports ── */}
      <section className="pd-section">
        <h2 className="pd-section__h">Reports</h2>
        <p className="pd-coming-soon">
          Progress reports, weekly digests, and parent-teacher exports are coming soon.
        </p>
      </section>

      {/* ── Danger zone ── */}
      <section className="pd-section pd-section--danger">
        <h2 className="pd-section__h">Account</h2>
        <button type="button" className="pd-btn pd-btn--danger" onClick={onSignOut}>
          Sign out
        </button>
        <p className="pd-danger-hint">Signs out across all profiles on this device.</p>
      </section>
    </div>
  );
}
