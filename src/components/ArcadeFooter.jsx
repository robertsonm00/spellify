import React, { useEffect, useRef, useState } from 'react';
import BuddyAvatar from './BuddyAvatar';
import './ArcadeFooter.css';

// Footer is the desktop's primary nav surface. Layout (left → right):
//   Buddy | Profile icon | Name/Year | Points | Lumens | LVL pill |
//   spacer | HOME | ASSIGN | MY LISTS | EXPLORE | ♥ | ⏰ | 🔔
// The profile icon opens Settings (where Sign In / Sign Out lives).

const NAV_TABS = [
  { key: 'home',             label: 'HOME' },
  { key: 'assignments',      label: 'ASSIGN' },
  { key: 'mylists',          label: 'MY LISTS' },
  { key: 'exploreDashboard', label: 'EXPLORE' },
];

export default function ArcadeFooter({
  playerName = '',
  year = null,
  isGuest = false,
  points = 0,
  lumens = 0,
  level = 1,
  levelTitle = '',
  xpCurrent = 0,
  xpMax = 1,
  buddyId = 'raccoon',
  buddyFallback = '🦝',
  // New props for footer-as-nav
  section = '',
  onSectionChange,
  onSettings,
}) {
  const [pop, setPop] = useState(false);
  const popTimer = useRef(null);
  useEffect(() => {
    setPop(false);
    const raf = requestAnimationFrame(() => setPop(true));
    clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPop(false), 420);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(popTimer.current);
    };
  }, [points]);

  const xpPct = Math.max(0, Math.min(100, (xpCurrent / Math.max(1, xpMax)) * 100));

  return (
    <footer className="arcade-footer" role="contentinfo">
      {/* Buddy (pokes up above the bar) */}
      <div className="arcade-footer__raccoon-slot">
        <BuddyAvatar id={buddyId} size={114} fallback={buddyFallback} interactive />
      </div>

      <div className="arcade-footer__vdiv" />

      {/* Profile icon — opens Settings (which now hosts Sign In / Sign Out) */}
      {onSettings && (
        <button
          type="button"
          className="arcade-footer__profile-btn"
          onClick={onSettings}
          aria-label="Profile and settings"
          title="Profile and settings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
          </svg>
        </button>
      )}

      {/* Player identity */}
      <div className="arcade-footer__player">
        <div>
          <div className="arcade-footer__player-name">{playerName}</div>
          <div className="arcade-footer__player-meta">
            {year != null && <span className="arcade-footer__player-year">Year {year}</span>}
            {isGuest && <span className="arcade-footer__guest-tag">GUEST</span>}
          </div>
        </div>
      </div>

      <div className="arcade-footer__vdiv" />

      {/* Points */}
      <div className="arcade-footer__points">
        <div
          key={points}
          className={`arcade-footer__points-num${pop ? ' arcade-footer__points-num--pop' : ''}`}
        >
          {points.toLocaleString()}
        </div>
        <div className="arcade-footer__points-label">POINTS</div>
      </div>

      <div className="arcade-footer__vdiv" />

      {/* Lumens */}
      <div className="arcade-footer__lumens" aria-label={`${lumens} lumens`}>
        <div className="arcade-footer__lumens-row">
          <span className="arcade-footer__lumens-icon" aria-hidden="true">✦</span>
          <span className="arcade-footer__lumens-num">{lumens.toLocaleString()}</span>
        </div>
        <div className="arcade-footer__lumens-label">LUMENS</div>
      </div>

      <div className="arcade-footer__vdiv" />

      {/* Level pill + hover tooltip */}
      <div
        className="arcade-footer__level"
        tabIndex={0}
        aria-label={`Level ${level}, ${levelTitle}`}
      >
        <div className="arcade-footer__level-pill">
          <span className="arcade-footer__level-star">★</span>
          <span className="arcade-footer__level-text">LVL {level}</span>
        </div>
        <div className="arcade-footer__level-tooltip" role="tooltip">
          <div className="arcade-footer__tt-title">{levelTitle}</div>
          <div className="arcade-footer__tt-level">Level {level}</div>
          <div className="arcade-footer__xp-bg">
            <div className="arcade-footer__xp-fill" style={{ width: `${xpPct}%` }} />
          </div>
          <div className="arcade-footer__xp-label">
            {xpCurrent} / {xpMax} XP → Level {level + 1}
          </div>
        </div>
      </div>

      <div className="arcade-footer__spacer" />

      {/* ── Nav tabs (moved from TopNav) ─────────────────────────── */}
      {onSectionChange && (
        <nav className="arcade-footer__nav" role="tablist" aria-label="Main navigation">
          {NAV_TABS.map(({ key, label }) => {
            const active = section === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`af-nav-tab${active ? ' af-nav-tab--active' : ''}`}
                onClick={() => onSectionChange(key)}
              >
                {label}
              </button>
            );
          })}

          {/* Icon-only tabs: Favourites, Recently viewed, Alerts */}
          <button
            type="button"
            className={`af-nav-icon${section === 'favourites' ? ' af-nav-icon--active' : ''}`}
            onClick={() => onSectionChange('favourites')}
            aria-label="Favourites"
            title="Favourites"
          >
            <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
              <path d="M16 28.2c-1.6-1.1-13-7.9-13-16.3 0-3.7 2.7-6.8 6.3-6.8 2.6 0 4.7 1.3 6.7 3.5 2-2.2 4.1-3.5 6.7-3.5 3.6 0 6.3 3.1 6.3 6.8 0 8.4-11.4 15.2-13 16.3z" />
            </svg>
          </button>
          <button
            type="button"
            className={`af-nav-icon${section === 'recent' ? ' af-nav-icon--active' : ''}`}
            onClick={() => onSectionChange('recent')}
            aria-label="Recently viewed"
            title="Recently viewed"
          >
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="16" cy="16" r="11" />
              <path d="M16 9.5v7l4.5 3" />
            </svg>
          </button>
          <button
            type="button"
            className={`af-nav-icon${section === 'alerts' ? ' af-nav-icon--active' : ''}`}
            onClick={() => onSectionChange('alerts')}
            aria-label="Alerts"
            title="Alerts"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="11" y="2" width="2" height="2" />
              <path d="M6 16 V14 Q6 8 12 8 Q18 8 18 14 V16 H20 V18 H4 V16 Z" />
              <rect x="10" y="19" width="4" height="2" />
            </svg>
          </button>
        </nav>
      )}
    </footer>
  );
}
