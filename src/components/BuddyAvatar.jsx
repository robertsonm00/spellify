import React from 'react';
import raccoonSvg from '../assets/raccoon.svg';

// Custom avatars for specific buddies. Falls back to the emoji when a buddy
// doesn't have a custom design yet. Buddies can be either an inline SVG asset
// (loaded from src/assets/*.svg) or — historically — a hand-drawn pixel grid.

const BUDDY_IMAGES = {
  raccoon: raccoonSvg,
};

/**
 * Returns a custom avatar for known buddy ids. For ids without a bespoke
 * design, returns the `fallback` (typically the buddy's emoji), or null if
 * no fallback was provided.
 *
 * @param {string}    id        — buddy id from src/components/OnboardingFlow.jsx
 * @param {number}    size      — rendered px (longest side; aspect preserved)
 * @param {ReactNode} fallback  — what to render for buddies without an asset
 */
export default function BuddyAvatar({ id, size = 88, fallback = null }) {
  const src = BUDDY_IMAGES[id];
  if (!src) return fallback;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{ maxWidth: size, maxHeight: size, width: 'auto', height: 'auto' }}
    />
  );
}

/** True if the buddy has a custom avatar (not just the emoji). */
export function hasBuddyAvatar(id) {
  return id in BUDDY_IMAGES;
}
