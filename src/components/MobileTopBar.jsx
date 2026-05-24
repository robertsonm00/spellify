// MobileTopBar — floating SPELLIFY wordmark, mobile only.
//
// The hamburger menu and its drawer moved to MobileBottomNav (5th tab)
// so the top of the viewport stays clear of controls. This component
// is purely decorative: the wordmark fades out when the user scrolls
// down past 40px and returns when they scroll back up.
//
// On desktop the whole component is display:none — desktop uses the
// existing TopNav for brand + nav.

import React, { useEffect, useState } from 'react';
import './MobileTopBar.css';

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

export default function MobileTopBar() {
  const [brandHidden, setBrandHidden] = useState(false);
  useEffect(() => {
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      if (y > 40 && y > lastY) setBrandHidden(true);
      else if (y < lastY || y <= 40) setBrandHidden(false);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`mtb__brand${brandHidden ? ' mtb__brand--hidden' : ''}`}
      aria-hidden="true"
    >
      {BRAND_LETTERS.map(({ letter, color }, i) => (
        <span
          key={i}
          className="mtb__brand-letter"
          style={{ color, animationDelay: `${i * 0.08}s` }}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}
