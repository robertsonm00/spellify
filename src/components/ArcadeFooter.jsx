import React, { useEffect, useRef, useState } from 'react';
import BuddyAvatar from './BuddyAvatar';
import './ArcadeFooter.css';

/**
 * ArcadeFooter — fixed arcade-style status bar.
 *
 * Props match the prototype layout:
 *   playerName, year, isGuest, points, level, levelTitle, xpCurrent, xpMax,
 *   onFavourites, onRecentlyViewed
 */
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
  // Buddy is whichever character the child picked at onboarding. Falls
  // back to the raccoon when no session / no pick yet — raccoon is the
  // single buddy with a full SVG sprite and cheer pose, so it stays the
  // canonical default everywhere.
  buddyId = 'raccoon',
  buddyFallback = '🦝',
  onFavourites,
  onRecentlyViewed,
}) {
  // Trigger a one-shot pop animation on mount and whenever points changes.
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
      {/* Buddy (pokes up above the bar). Sized to fit the 68px footer with
          a small overflow; click cheer + global buddy-cheer event are handled
          inside BuddyAvatar itself when `interactive` is set. */}
      <div className="arcade-footer__raccoon-slot">
        <BuddyAvatar id={buddyId} size={114} fallback={buddyFallback} interactive />
      </div>

      <div className="arcade-footer__vdiv" />

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

      {/* Lumens — secondary currency (1 per 5 Spell Points) */}
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

      {/* Favourites + Recently viewed moved to the TopNav. */}
    </footer>
  );
}
