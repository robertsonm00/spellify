import React, { useState, useRef, useEffect } from 'react';
import './TopNav.css';

// Arcade-style tab config (visual labels + section keys for onSectionChange).
// Routing logic is unchanged — keys map to existing section values where they
// exist. 'assignments' is intentionally literal here even though no section
// block currently handles it (see Step 4 spec); wire it up when needed.
// Arcade tabs — text-only, unified magical look. Styling lives in
// TopNav.css (.topnav-tab--arcade) so every tab shares the same visual
// language with the icon-only Favourites + Recently viewed buttons.
const ARCADE_TABS = [
  { key: 'home',             label: 'HOME' },
  { key: 'assignments',      label: 'ASSIGNMENTS' },
  { key: 'mylists',          label: 'MY LISTS' },
  { key: 'exploreDashboard', label: 'EXPLORE' },
];

const BRAND_LETTERS = [
  { letter: 'S', color: '#ff6b6b' },
  { letter: 'P', color: '#ffd93d' },
  { letter: 'E', color: '#6bcb77' },
  { letter: 'L', color: '#4d96ff' },
  { letter: 'L', color: '#c77dff' },
  { letter: 'I', color: '#ff9f43' },
  { letter: 'F', color: '#ff6b6b' },
  { letter: 'Y', color: '#ffd93d' },
];

export default function TopNav({
  section,
  onSectionChange,
  user,
  profile,
  onSignInClick,
  onSignOut,
  onExit,
  onSettings,
  gameTitle,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Visual variant — 'classic' (dark navy, default) or 'v2' (cream retro
  // window). Toggled by clicking the SPELLIFY logo. Persists in its own
  // localStorage key so the choice survives reloads.
  const [variant, setVariant] = useState(() => {
    if (typeof window === 'undefined') return 'classic';
    return window.localStorage.getItem('topnavVariant') === 'v2' ? 'v2' : 'classic';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('topnavVariant', variant);
    }
  }, [variant]);
  const toggleVariant = () => setVariant((v) => (v === 'classic' ? 'v2' : 'classic'));

  // Ensure the body.game-active class (which hides the TopNav while a game
  // is mounted) is cleared whenever the TopNav itself renders. Belt-and-
  // braces — protects against the class lingering after a hot-reload or a
  // missed unmount.
  useEffect(() => {
    document.body.classList.remove('game-active');
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'You';
  const initials    = displayName.slice(0, 2).toUpperCase();

  return (
    <nav className={`topnav topnav--${variant}`}>
      {/* ── Left: Brand + Exit ── */}
      <div className="topnav-left">
        <div
          className="topnav-brand"
          aria-label="Spellify — click to switch header style"
          role="button"
          tabIndex={0}
          onClick={toggleVariant}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleVariant(); } }}
          style={{ cursor: 'pointer' }}
        >
          {BRAND_LETTERS.map(({ letter, color }, i) => (
            <span
              key={i}
              className="topnav-brand-letter"
              style={{ color, animationDelay: `${i * 0.08}s` }}
            >
              {letter}
            </span>
          ))}
        </div>
        {onExit && (
          <button className="topnav-exit" onClick={onExit} aria-label="Exit">
            ← Exit
          </button>
        )}
      </div>

      {/* ── Centre: tabs or game title ── */}
      {gameTitle ? (
        <div className="topnav-game-title">{gameTitle}</div>
      ) : (
        <div className="topnav-tabs topnav-tabs--arcade" role="tablist">
          {ARCADE_TABS.map(({ key, label }) => {
            const active = section === key;
            return (
              <button
                key={key}
                type="button"
                className={`topnav-tab topnav-tab--arcade${active ? ' topnav-tab--arcade-active' : ''}`}
                onClick={() => onSectionChange(key)}
                role="tab"
                aria-selected={active}
              >
                {label}
              </button>
            );
          })}
          {/* Favourites + Recently viewed — icon-only tabs (SVG, not emoji,
              so they centre and scale predictably across platforms). */}
          <button
            key="favourites"
            type="button"
            className={`topnav-tab topnav-tab--icon${section === 'favourites' ? ' topnav-tab--icon-active' : ''}`}
            onClick={() => onSectionChange('favourites')}
            role="tab"
            aria-selected={section === 'favourites'}
            aria-label="Favourites"
            title="Favourites"
          >
            <svg
              className="topnav-tab__icon"
              viewBox="0 0 32 32"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M16 28.2c-1.6-1.1-13-7.9-13-16.3 0-3.7 2.7-6.8 6.3-6.8 2.6 0 4.7 1.3 6.7 3.5 2-2.2 4.1-3.5 6.7-3.5 3.6 0 6.3 3.1 6.3 6.8 0 8.4-11.4 15.2-13 16.3z" />
            </svg>
          </button>
          <button
            key="recent"
            type="button"
            className={`topnav-tab topnav-tab--icon${section === 'recent' ? ' topnav-tab--icon-active' : ''}`}
            onClick={() => onSectionChange('recent')}
            role="tab"
            aria-selected={section === 'recent'}
            aria-label="Recently viewed"
            title="Recently viewed"
          >
            <svg
              className="topnav-tab__icon"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="16" cy="16" r="11" />
              <path d="M16 9.5v7l4.5 3" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Right: Settings + User area ── */}
      <div className="topnav-right">
        {onSettings && (
          <button className="topnav-settings" onClick={onSettings} aria-label="Settings">
            ⚙️ Settings
          </button>
        )}
        <div className="topnav-user">
          {user ? (
            <div className="topnav-avatar-wrap" ref={dropdownRef}>
              <button
                className="topnav-avatar"
                onClick={() => setDropdownOpen(o => !o)}
                aria-label="Account menu"
                aria-expanded={dropdownOpen}
              >
                <span className="topnav-avatar-initials">{initials}</span>
                <span className="topnav-avatar-name">{displayName}</span>
                <span className="topnav-avatar-caret">▾</span>
              </button>
              {dropdownOpen && (
                <div className="topnav-dropdown">
                  <div className="topnav-dropdown-name">{displayName}</div>
                  {profile?.year_group && (
                    <div className="topnav-dropdown-year">Year {profile.year_group}</div>
                  )}
                  <hr className="topnav-dropdown-hr" />
                  <button
                    className="topnav-dropdown-signout"
                    onClick={() => { setDropdownOpen(false); onSignOut?.(); }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="topnav-signin" onClick={onSignInClick}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
