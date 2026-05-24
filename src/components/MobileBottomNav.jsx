// MobileBottomNav — fixed two-row bottom nav rendered only on mobile.
//
// Grid layout:
//   ┌──────────┬─────────────────────────────────┐
//   │  buddy   │  score · level title            │   (top)
//   │ (spans   │  ─────────── xp progress ───────│
//   │  rows)   │  [home] [explore] [lists] [bell]│   (bottom)
//   └──────────┴─────────────────────────────────┘
//
// The buddy sprite is grounded at the bottom and bleeds upward past
// the bar so it feels alive rather than icon-like. On desktop the
// whole component is display:none — desktop uses TopNav + ArcadeFooter.

import React from 'react';
import BuddyAvatar from './BuddyAvatar';
import './MobileBottomNav.css';

// ── Pixel-style SVG icons ────────────────────────────────────────────
// All four icons use the same 24×24 viewBox so they centre and scale
// identically. Shapes are blocky (1px stroke, hard edges, no thin
// lines) to match the pixel-art aesthetic of the raccoon buddy. Fill
// inherits `currentColor` so the active/inactive colour swap is driven
// purely by CSS on the parent button.

const IconHome = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    {/* Roof */}
    <path d="M12 3 L3 11 H6 V20 H10 V14 H14 V20 H18 V11 H21 Z" />
  </svg>
);

const IconExplore = (props) => (
  // Pixel magnifying glass — chunky ring + diagonal handle.
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" {...props}>
    <rect x="4" y="4" width="11" height="11" rx="0" />
    <rect x="6" y="6" width="7" height="7" rx="0" fill="currentColor" opacity="0.15" stroke="none" />
    <path d="M15 15 L20 20" />
  </svg>
);

const IconStar = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    {/* Chunky 5-point star, blocky tips */}
    <path d="M12 2 L14 9 H21 L15 13 L17 20 L12 16 L7 20 L9 13 L3 9 H10 Z" />
  </svg>
);

const IconBell = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    {/* Bell — top knob, dome, base bar, clapper */}
    <rect x="11" y="2" width="2" height="2" />
    <path d="M6 16 V14 Q6 8 12 8 Q18 8 18 14 V16 H20 V18 H4 V16 Z" />
    <rect x="10" y="19" width="4" height="2" />
  </svg>
);

const TABS = [
  { key: 'home',             Icon: IconHome,    label: 'Home'    },
  { key: 'exploreDashboard', Icon: IconExplore, label: 'Explore' },
  { key: 'mylists',          Icon: IconStar,    label: 'My Lists' },
  { key: 'alerts',           Icon: IconBell,    label: 'Alerts' },
];

export default function MobileBottomNav({
  section,
  onSectionChange,
  points = 0,
  level = 1,
  levelTitle = '',
  xpCurrent = 0,
  xpMax = 1,
  buddyId = 'raccoon',
  buddyFallback = '🦝',
}) {
  const xpPct = Math.max(0, Math.min(100, (xpCurrent / Math.max(1, xpMax)) * 100));

  return (
    <nav className="mbn" role="navigation" aria-label="Main">
      {/* Buddy slot — spans both rows on the left so the sprite is
          grounded at the bar's bottom and bleeds upward. */}
      <div className="mbn__buddy-slot">
        {/* Size matches the raccoon body's natural rendered scale so the
            sprite spans both rows of the bar and busts up above it.
            All buddy sizing across the app is anchored to this number
            — the raccoon is the canonical body with full cheer pose. */}
        <BuddyAvatar id={buddyId} size={110} fallback={buddyFallback} interactive />
      </div>

      {/* Top-right cell — score on the left, level title + xp bar on the
          right. The xp bar sits directly beneath the level title only,
          not full-width across the row. */}
      <div className="mbn__status">
        <span className="mbn__points-num">{points.toLocaleString()}</span>
        <div className="mbn__level-block">
          <span className="mbn__level-title">{levelTitle || `LVL ${level}`}</span>
          <span className="mbn__xp" aria-hidden="true">
            <span className="mbn__xp-fill" style={{ width: `${xpPct}%` }} />
          </span>
        </div>
      </div>

      {/* Bottom-right cell — four icon-only tabs. */}
      <div className="mbn__tabs" role="tablist">
        {TABS.map(({ key, Icon, label }) => {
          const active = section === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-label={label}
              aria-selected={active}
              className={`mbn__tab${active ? ' mbn__tab--active' : ''}`}
              onClick={() => onSectionChange(key)}
            >
              <Icon className="mbn__tab-icon" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
