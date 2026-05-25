// ProfileSelector — Netflix-style "Who's playing?" landing screen.
//
// Primary entry point for every signed-in Spellify user (Prompt 1,
// May 2026). Replaces the dark hub-on-sign-in pattern that used to
// drop straight into the game.
//
// Visual model:
//   - Large circular avatars in a centred row (wraps to multiple
//     rows on narrow viewports).
//   - Each child card: avatar (buddy art), nickname, year sub-label.
//   - Parent card visually distinct: padlock badge overlay, slightly
//     different glow. Tap → PIN entry (Prompt 2 wires that).
//   - "Add profile" card with + icon, greyed out when the current
//     tier has hit its child limit (free = 1, premium = N).
//   - Guest state: a single Quick Start card + sign-in/sign-up link
//     in the corner.
//
// Prop API (kept stable for App.jsx — no callsite changes needed):
//   authUser       Supabase auth user, or null for guest
//   children       array of Supabase children rows
//   loading        boolean — while the auth/children query is in flight
//   tier           'guest' | 'free' | 'premium' (default 'free' if
//                  signed in, 'guest' otherwise)
//   onSelectChild  (child) => void  — adopt that child + enter game
//   onQuickStart   () => void       — guest "play now"
//   onOpenAuth     (view) => void   — open sign-in / sign-up modal
//   onAddProfile   () => void       — opens CreateChildProfile
//   onParentEnter  () => void       — Prompt 2 swaps in PIN gate;
//                                     today this just exposes Sign Out
//   onSignOut      () => void       — nuclear, parent-only

import React, { useState } from 'react';
import BuddyAvatar, { hasBuddyAvatar, DEFAULT_BUDDY } from '../BuddyAvatar';
import './ProfileSelector.css';

const TIER_LIMITS = { guest: 0, free: 1, premium: 4 };

export default function ProfileSelector({
  authUser,
  children = [],
  loading = false,
  tier,
  onSelectChild,
  onQuickStart,
  onOpenAuth,
  onAddProfile,
  onParentEnter,
  onSignOut,
}) {
  const isGuest        = !authUser;
  const effectiveTier  = tier || (isGuest ? 'guest' : 'free');
  const maxChildren    = TIER_LIMITS[effectiveTier] ?? 1;
  const addLocked      = !isGuest && children.length >= maxChildren;
  const [showUpsell, setShowUpsell] = useState(false);

  const handleAddClick = () => {
    if (addLocked) { setShowUpsell(true); return; }
    onAddProfile?.();
  };

  return (
    <div className="ps-root">
      {/* Top-right utility row — Sign in/up for guests, parent card
          handles the signed-in equivalent further down. */}
      {isGuest && (
        <div className="ps-topbar">
          <button
            type="button"
            className="ps-topbar__link"
            onClick={() => onOpenAuth?.('signin')}
          >
            Sign in
          </button>
          <span className="ps-topbar__divider" aria-hidden="true">·</span>
          <button
            type="button"
            className="ps-topbar__link ps-topbar__link--accent"
            onClick={() => onOpenAuth?.('signup')}
          >
            Create account
          </button>
        </div>
      )}

      <h1 className="ps-title">Who's playing?</h1>
      {!loading && !isGuest && (
        <p className="ps-subtitle">
          Tap a profile to start, or add a new one.
        </p>
      )}

      {loading && <p className="ps-status">Loading profiles…</p>}

      {!loading && isGuest && (
        <div className="ps-grid">
          <ProfileCard
            kind="quick"
            label="Quick Start"
            sub="Play as a guest"
            emoji="▶"
            onClick={onQuickStart}
          />
        </div>
      )}

      {!loading && !isGuest && (
        <div className="ps-grid">
          {children.map((child) => (
            <ProfileCard
              key={child.id}
              kind="child"
              label={child.nickname || 'Player'}
              sub={formatYear(child.school_year)}
              buddyId={child.active_buddy_id || 'raccoon'}
              onClick={() => onSelectChild?.(child)}
            />
          ))}

          {/* Adult card — Prompt 2 swaps the onClick for a PIN
              entry modal. For now it falls back to sign-out so a
              tester can still get out of the account. The kind is
              still "parent" internally — that's the CSS hook and
              prop name; user-facing copy is "Adult". */}
          <ProfileCard
            kind="parent"
            label="Adult"
            sub="Settings & reports"
            emoji="👤"
            onClick={onParentEnter || onSignOut}
          />

          <ProfileCard
            kind="add"
            label={addLocked ? 'Add profile' : 'Add profile'}
            sub={addLocked
              ? `${effectiveTier === 'free' ? 'Free' : 'Plan'} limit reached`
              : 'New player on this account'}
            emoji="+"
            locked={addLocked}
            onClick={handleAddClick}
            title={addLocked ? 'Upgrade to add more profiles' : 'Add a new child profile'}
          />
        </div>
      )}

      {!loading && !isGuest && children.length === 0 && (
        <p className="ps-status ps-status--empty">
          No profiles yet — tap <strong>Add profile</strong> to create one.
        </p>
      )}

      {showUpsell && (
        <UpsellModal
          tier={effectiveTier}
          maxChildren={maxChildren}
          onClose={() => setShowUpsell(false)}
        />
      )}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────
function ProfileCard({ kind, label, sub, emoji, buddyId, locked, onClick, title }) {
  return (
    <button
      type="button"
      className={[
        'ps-card',
        `ps-card--${kind}`,
        locked ? 'ps-card--locked' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      title={title}
      aria-label={`${label}${sub ? ` — ${sub}` : ''}${locked ? ' (locked)' : ''}`}
    >
      <span className="ps-card__avatar" aria-hidden="true">
        <span className="ps-card__avatar-ring" />
        <span className="ps-card__avatar-inner">
          {kind === 'child'
            // Always render an SVG buddy for child cards. If the
            // stored buddy id doesn't have a registered renderer
            // (e.g. paid buddy not yet illustrated), fall back to the
            // canonical raccoon SVG — never an emoji.
            ? <BuddyAvatar
                id={hasBuddyAvatar(buddyId) ? buddyId : DEFAULT_BUDDY.id}
                size={108}
              />
            : (buddyId && hasBuddyAvatar(buddyId)
                ? <BuddyAvatar id={buddyId} size={108} />
                : <span className="ps-card__emoji">{emoji}</span>)}
        </span>
        {kind === 'parent' && (
          <span className="ps-card__badge" aria-hidden="true" title="PIN-protected">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
        )}
      </span>
      <span className="ps-card__name">{label}</span>
      {sub && <span className="ps-card__sub">{sub}</span>}
    </button>
  );
}

// ── Upsell modal — minimal placeholder ──────────────────────────────
// Prompt-4 territory will replace this with the real premium upsell
// flow + payment. For now it's a friendly "coming soon" so the locked-
// add affordance has feedback when tapped.
function UpsellModal({ tier, maxChildren, onClose }) {
  return (
    <div className="ps-upsell-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ps-upsell-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="ps-upsell-title">More players, more adventures</h2>
        <p className="ps-upsell-body">
          The {tier === 'free' ? 'free' : tier} plan supports {maxChildren} {maxChildren === 1 ? 'profile' : 'profiles'}.
          Premium adds room for the whole family plus every world and game mode.
        </p>
        <p className="ps-upsell-soon">Premium subscriptions launching soon.</p>
        <button type="button" className="ps-upsell-btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────
function formatYear(y) {
  if (y == null) return '';
  if (y === 0)   return 'Reception';
  return `Year ${y}`;
}
