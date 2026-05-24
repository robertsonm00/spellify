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

// ── Pixel-style SVG icons (24×24 viewBox, blocky pixel-art look) ────

const IconHome = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 3 L3 11 H6 V20 H10 V14 H14 V20 H18 V11 H21 Z" />
  </svg>
);
const IconExplore = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" {...props}>
    <rect x="4" y="4" width="11" height="11" rx="0" />
    <rect x="6" y="6" width="7" height="7" rx="0" fill="currentColor" opacity="0.15" stroke="none" />
    <path d="M15 15 L20 20" />
  </svg>
);
const IconStar = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2 L14 9 H21 L15 13 L17 20 L12 16 L7 20 L9 13 L3 9 H10 Z" />
  </svg>
);
const IconBell = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <rect x="11" y="2" width="2" height="2" />
    <path d="M6 16 V14 Q6 8 12 8 Q18 8 18 14 V16 H20 V18 H4 V16 Z" />
    <rect x="10" y="19" width="4" height="2" />
  </svg>
);
const IconMenu = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <rect x="3"  y="5"  width="18" height="3" />
    <rect x="3"  y="11" width="18" height="3" />
    <rect x="3"  y="17" width="18" height="3" />
  </svg>
);

const TABS = [
  { key: 'home',             Icon: IconHome,    label: 'Home',           kind: 'nav' },
  { key: 'exploreDashboard', Icon: IconExplore, label: 'Explore',        kind: 'nav' },
  { key: 'mylists',          Icon: IconStar,    label: 'My Lists',       kind: 'nav' },
  { key: 'alerts',           Icon: IconBell,    label: 'Alerts',         kind: 'nav' },
  { key: '__menu__',         Icon: IconMenu,    label: 'Account menu',   kind: 'menu' },
];

const DRAWER_ITEMS = [
  { key: 'signin',         label: 'Sign In',           type: 'action' },
  { key: 'signup',         label: 'Sign Up',           type: 'action' },
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
