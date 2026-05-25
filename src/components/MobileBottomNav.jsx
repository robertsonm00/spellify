// MobileBottomNav — fixed two-row bottom nav rendered only on mobile.
//
//   ┌───────────────────────────────────────────────────────────┐
//   │  [buddy]   4,710          Grand Wordmancer ▓▓▓▓▒▒        │  ← status
//   ├───────────────────────────────────────────────────────────┤
//   │   🏠      🔍      ⭐      🔔      ☰                       │  ← 5 tabs
//   └───────────────────────────────────────────────────────────┘
//
// Buddy sits in the top row alongside the points. The raccoon is sized
// so its body bursts out the BOTTOM of the bar (overhanging the safe
// area) — every future buddy is rendered at the same scale.
//
// The 5th tab is a hamburger that opens an account/profile drawer
// (Sign In / Sign Up / Settings / Profile / Favourites / Recently
// viewed / Recently added). Previously the drawer lived in
// MobileTopBar; the top bar is now just the floating Spellify wordmark.

import React, { useEffect, useState } from 'react';
import BuddyAvatar from './BuddyAvatar';
import './MobileBottomNav.css';

// ── Outlined line icons (Lucide-style) ─────────────────────────────
// All icons share a consistent stroke + cap style so they read as a
// single family. 24×24 viewBox, 2px stroke, rounded line caps + joins.
// `fill="none"` so they're pure outlines; the parent button drives
// the colour via currentColor (active = gold, inactive = muted).

const ICON_PROPS = {
  viewBox:        '0 0 24 24',
  fill:           'none',
  stroke:         'currentColor',
  strokeWidth:    2,
  strokeLinecap:  'round',
  strokeLinejoin: 'round',
};

const IconHome = (props) => (
  <svg {...ICON_PROPS} {...props}>
    {/* Simple house — roof apex + walls + door */}
    <path d="M3 11 L12 3 L21 11" />
    <path d="M5 10 V20 H19 V10" />
    <path d="M10 20 V14 H14 V20" />
  </svg>
);

const IconExplore = (props) => (
  <svg {...ICON_PROPS} {...props}>
    {/* Magnifier — clean circle + diagonal handle */}
    <circle cx="11" cy="11" r="6.5" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
);

const IconNotebook = (props) => (
  <svg {...ICON_PROPS} {...props}>
    {/* Notebook — rectangle + spine line + 3 page lines.
        Replaces the old star which read as Favourites. */}
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <line x1="8" y1="3" x2="8" y2="21" />
    <line x1="11.5" y1="8"  x2="17" y2="8"  />
    <line x1="11.5" y1="12" x2="17" y2="12" />
    <line x1="11.5" y1="16" x2="17" y2="16" />
  </svg>
);

const IconBell = (props) => (
  <svg {...ICON_PROPS} {...props}>
    {/* Bell — dome + base bar + clapper, all rounded */}
    <path d="M6 16 V12 a6 6 0 0 1 12 0 V16" />
    <line x1="4" y1="17" x2="20" y2="17" />
    <path d="M10.5 20 a1.5 1.5 0 0 0 3 0" />
  </svg>
);

const IconMenu = (props) => (
  <svg {...ICON_PROPS} {...props}>
    {/* 3 lines, slightly inset from the edges */}
    <line x1="4" y1="7"  x2="20" y2="7"  />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </svg>
);

const TABS = [
  { key: 'home',             Icon: IconHome,     label: 'Home',         kind: 'nav' },
  { key: 'exploreDashboard', Icon: IconExplore,  label: 'Explore',      kind: 'nav' },
  { key: 'mylists',          Icon: IconNotebook, label: 'My Lists',     kind: 'nav' },
  { key: 'alerts',           Icon: IconBell,     label: 'Alerts',       kind: 'nav' },
  { key: '__menu__',         Icon: IconMenu,     label: 'Account menu', kind: 'menu' },
];

const DRAWER_ITEMS = [
  { key: 'signin',         label: 'Sign In / Sign Up', type: 'action' },
  { key: 'settings',       label: '⚙️ Settings',       type: 'action' },
  { key: 'profile',        label: 'Profile',           type: 'soon'   },
  { key: 'favourites',     label: '❤ Favourites',      type: 'nav'    },
  { key: 'recent',         label: '🕒 Recently viewed', type: 'nav'    },
  { key: 'recently-added', label: 'Recently added',    type: 'soon'   },
];

export default function MobileBottomNav({
  section,
  onSectionChange,
  points = 0,
  lumens = 0,
  level = 1,
  levelTitle = '',
  xpCurrent = 0,
  xpMax = 1,
  buddyId = 'raccoon',
  buddyFallback = '🦝',
  onSignInClick,
  onSignUpClick,
  onSettingsClick,
}) {
  const xpPct = Math.max(0, Math.min(100, (xpCurrent / Math.max(1, xpMax)) * 100));

  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  const handleTab = (tab) => {
    if (tab.kind === 'menu') { setDrawerOpen(true); return; }
    onSectionChange(tab.key);
  };

  const handleDrawerItem = (item) => {
    setDrawerOpen(false);
    if (item.type === 'soon') return;
    if (item.key === 'signin')   { onSignInClick?.();   return; }
    if (item.key === 'signup')   { onSignUpClick?.();   return; }
    if (item.key === 'settings') { onSettingsClick?.(); return; }
    if (item.type === 'nav')     { onSectionChange?.(item.key); return; }
  };

  return (
    <>
      <nav className="mbn" role="navigation" aria-label="Main">
        {/* Status row — buddy + score + level title with xp bar. */}
        <div className="mbn__status">
          <div className="mbn__buddy-slot">
            <BuddyAvatar id={buddyId} size={92} fallback={buddyFallback} interactive />
          </div>
          <span className="mbn__points-num">{points.toLocaleString()}</span>
          <span className="mbn__lumens" aria-label={`${lumens} lumens`}>
            <span className="mbn__lumens-icon" aria-hidden="true">✦</span>
            <span className="mbn__lumens-num">{lumens.toLocaleString()}</span>
          </span>
          <div className="mbn__level-block">
            <span className="mbn__level-title">{levelTitle || `LVL ${level}`}</span>
            <span className="mbn__xp" aria-hidden="true">
              <span className="mbn__xp-fill" style={{ width: `${xpPct}%` }} />
            </span>
          </div>
        </div>

        {/* Tabs row — full-width 5-column grid. */}
        <div className="mbn__tabs" role="tablist">
          {TABS.map((tab) => {
            const active = tab.kind === 'nav' && section === tab.key;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.key}
                type="button"
                role={tab.kind === 'nav' ? 'tab' : 'button'}
                aria-label={tab.label}
                aria-selected={active}
                className={`mbn__tab${active ? ' mbn__tab--active' : ''}`}
                onClick={() => handleTab(tab)}
              >
                <Icon className="mbn__tab-icon" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </nav>

      {/* Drawer — opened by the menu tab. Slides in from the right. */}
      {drawerOpen && (
        <>
          <div
            className="mbn__backdrop"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <nav className="mbn__drawer" role="menu" aria-label="Account menu">
            <button
              type="button"
              className="mbn__drawer-close"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              ✕
            </button>
            <ul className="mbn__drawer-list">
              {DRAWER_ITEMS.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    role="menuitem"
                    className={`mbn__drawer-item${item.type === 'soon' ? ' mbn__drawer-item--soon' : ''}`}
                    onClick={() => handleDrawerItem(item)}
                  >
                    <span>{item.label}</span>
                    {item.type === 'soon' && (
                      <span className="mbn__drawer-item-tag">Coming soon</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </>
  );
}
