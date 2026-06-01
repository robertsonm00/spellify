// SpellShop — placeholder framework for the lumens-spending screen.
// The visual chrome (themed background, lumens header, category grid) is
// here so we can hot-iterate on content. Each category card currently
// shows a "Coming soon" placeholder; replace with real items as designed.

import React from 'react';
import './SpellShop.css';

// Placeholder categories — these are stand-ins. When the catalogue is
// designed, swap in real item lists, prices, descriptions, etc.
const SHOP_CATEGORIES = [
  {
    id: 'buddies',
    icon: '🦝',
    title: 'Buddies',
    blurb: 'New companions to join you on your adventure.',
    accent: '#c77dff',
  },
  {
    id: 'themes',
    icon: '🎨',
    title: 'Themes',
    blurb: 'Magical skins and backgrounds for your games.',
    accent: '#f9a8d4',
  },
  {
    id: 'power-ups',
    icon: '⚡',
    title: 'Power-Ups',
    blurb: 'Boost your spell-casting with magical helpers.',
    accent: '#fde68a',
  },
  {
    id: 'badges',
    icon: '🏅',
    title: 'Badges',
    blurb: 'Display your achievements with style.',
    accent: '#86efac',
  },
  {
    id: 'spells',
    icon: '✨',
    title: 'Spells',
    blurb: 'Unlock special abilities and surprises.',
    accent: '#a5f3fc',
  },
  {
    id: 'mystery',
    icon: '🎁',
    title: 'Mystery Box',
    blurb: 'A surprise gift — what could be inside?',
    accent: '#fbbf24',
  },
];

// Public-path image URL — set as a CSS custom property at runtime so the
// CSS file doesn't have to reference a public/ path (which css-loader would
// try to resolve at build time and fail).
const BG_URL = `url("${process.env.PUBLIC_URL || ''}/adventure/backgrounds/spell-shop-background.webp")`;

export default function SpellShop({ session, lumens = 0, onSectionChange }) {
  return (
    <main className="spellshop-root" style={{ '--bg-image-url': BG_URL }}>
      {/* Themed background sits behind everything via .spellshop-root CSS. */}

      {/* Header — title + current lumens balance */}
      <header className="spellshop-header">
        <div className="spellshop-header__inner">
          <h1 className="spellshop-title">
            <span aria-hidden="true">🪄</span>
            <span>Spell Shop</span>
          </h1>
          <p className="spellshop-subtitle">
            Spend your lumens on magical rewards
          </p>
        </div>
        <div
          className="spellshop-lumens"
          title="Your current lumens balance"
          aria-label={`${lumens.toLocaleString()} lumens`}
        >
          <span className="spellshop-lumens__icon" aria-hidden="true">💎</span>
          <span className="spellshop-lumens__value">{lumens.toLocaleString()}</span>
          <span className="spellshop-lumens__label">Lumens</span>
        </div>
      </header>

      {/* Featured / hero slot — reserved for promoted items. */}
      <section className="spellshop-featured" aria-label="Featured items">
        <div className="spellshop-featured__card">
          <div className="spellshop-featured__badge">Featured</div>
          <div className="spellshop-featured__icon" aria-hidden="true">✨</div>
          <h2 className="spellshop-featured__title">Coming soon</h2>
          <p className="spellshop-featured__copy">
            The shop is being stocked with rare items. Check back shortly!
          </p>
        </div>
      </section>

      {/* Category grid — six placeholder tiles. Each will later be a route
          into a dedicated catalogue page. */}
      <section className="spellshop-grid" aria-label="Shop categories">
        {SHOP_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="spellshop-card"
            style={{ '--spellshop-card-accent': cat.accent }}
            onClick={() => {
              // Placeholder click handler — wire to a real category page later.
              // For now we just no-op so the button is interactive in QA.
            }}
            aria-label={`${cat.title} — coming soon`}
          >
            <span className="spellshop-card__icon" aria-hidden="true">{cat.icon}</span>
            <span className="spellshop-card__title">{cat.title}</span>
            <span className="spellshop-card__blurb">{cat.blurb}</span>
            <span className="spellshop-card__cta">Coming soon</span>
          </button>
        ))}
      </section>

      {/* Footer note — reminds the child where lumens come from. */}
      <footer className="spellshop-footnote">
        <span aria-hidden="true">💡</span>
        <span>Earn more lumens by playing games on the Adventure map.</span>
      </footer>
    </main>
  );
}
