import React, { useState, useRef, useEffect } from 'react';
import './TopNav.css';

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
        <div className="topnav-tabs" role="tablist">
          <button
            className={`topnav-tab${section === 'myWords' ? ' topnav-tab--active' : ''}`}
            onClick={() => onSectionChange('myWords')}
            role="tab"
            aria-selected={section === 'myWords'}
          >
            📚 My Words
          </button>
          <button
            className={`topnav-tab${section === 'explore' ? ' topnav-tab--active' : ''}`}
            onClick={() => onSectionChange('explore')}
            role="tab"
            aria-selected={section === 'explore'}
          >
            🔭 Explore
          </button>
          <button
            className={`topnav-tab${section === 'exploreDashboard' ? ' topnav-tab--active' : ''}`}
            onClick={() => onSectionChange('exploreDashboard')}
            role="tab"
            aria-selected={section === 'exploreDashboard'}
          >
            Explore
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
