// PageShell — shared mobile page wrapper.
//
// On mobile (≤768px) it provides the canonical Spellify shell: dark
// purple starfield background, pixel font for the heading, padding
// that reserves space for the MobileBottomNav, and consistent text
// colours.
//
// On desktop the component renders as a transparent pass-through so
// existing desktop layouts (TopNav + ArcadeFooter + page content) are
// untouched.
//
// Usage:
//   <PageShell title="Alerts">
//     <p>Daily challenges and streak — coming soon.</p>
//   </PageShell>

import React from 'react';
import './PageShell.css';

export default function PageShell({ title, children, className = '' }) {
  return (
    <div className={`page-shell ${className}`.trim()}>
      {title && <h1 className="page-shell__title">{title}</h1>}
      <div className="page-shell__body">{children}</div>
    </div>
  );
}
