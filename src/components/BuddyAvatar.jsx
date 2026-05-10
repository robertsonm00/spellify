import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import './BuddyAvatar.css';
import raccoonStill from '../assets/raccoon-still.svg';
import raccoonCheer from '../assets/raccoon-cheer.svg';

// ── Cheer sound + confetti ───────────────────────────────────────────────
// Bright ascending arpeggio with a sparkle tail — suggests a kid's "yay!".
function playKidCheer() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const NOTES = [
      { f: 523.25,  t: 0.00, d: 0.16, v: 0.18, type: 'triangle' },
      { f: 659.25,  t: 0.07, d: 0.16, v: 0.18, type: 'triangle' },
      { f: 783.99,  t: 0.14, d: 0.16, v: 0.18, type: 'triangle' },
      { f: 1046.50, t: 0.22, d: 0.50, v: 0.22, type: 'triangle' },
      // Sparkle layer — high-pitched short pings overlap the sustained note
      { f: 1568.00, t: 0.32, d: 0.18, v: 0.10, type: 'sine' },
      { f: 2093.00, t: 0.42, d: 0.20, v: 0.10, type: 'sine' },
    ];
    NOTES.forEach(({ f, t, d, v, type }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = f;
      const at = ctx.currentTime + t;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(v, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, at + d);
      osc.start(at);
      osc.stop(at + d);
    });
  } catch { /* AudioContext unavailable */ }
}

function fireBuddyConfetti() {
  confetti({
    particleCount: 100,
    spread: 80,
    origin: { y: 0.5 },
    colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f43'],
  });
}

// ── Buddy renderers ──────────────────────────────────────────────────────

function RaccoonSprite({ size, cheering }) {
  const src = cheering ? raccoonCheer : raccoonStill;
  return (
    <img
      className="buddy-sprite"
      src={src}
      alt=""
      aria-hidden="true"
      style={{ maxWidth: size, maxHeight: size, width: 'auto', height: 'auto' }}
    />
  );
}

const BUDDY_RENDERERS = {
  raccoon: RaccoonSprite,
};

/** True if the buddy has a custom avatar (not just the emoji). */
export function hasBuddyAvatar(id) {
  return id in BUDDY_RENDERERS;
}

/**
 * Returns a custom avatar for known buddy ids. Falls back to the emoji
 * (passed as `fallback`) for buddies without a bespoke design.
 *
 * When `interactive` is true the avatar is wrapped in a button: clicking
 * it plays a kid cheer + confetti and (for buddies with a cheer frame)
 * swaps to the cheer pose for 3 seconds before reverting.
 */
export default function BuddyAvatar({
  id,
  size = 88,
  fallback = null,
  interactive = false,
  cheering: cheeringProp = false,
}) {
  const [cheering, setCheering] = useState(false);
  const cheeringRef = useRef(false);
  // External `cheering` prop overrides; either route lights up the cheer pose.
  const isCheering = cheeringProp || cheering;

  // Run the full cheer routine: image swap (if buddy has a cheer frame),
  // sound, confetti — for ~3 seconds. De-duped so overlapping triggers
  // (e.g. quick clicks or two events landing back-to-back) don't stack.
  const runCheer = () => {
    if (cheeringRef.current) return;
    cheeringRef.current = true;
    setCheering(true);
    playKidCheer();
    fireBuddyConfetti();
    setTimeout(() => {
      cheeringRef.current = false;
      setCheering(false);
    }, 3000);
  };

  // Listen for global `buddy-cheer` events — fired e.g. when a child
  // finishes a game and returns to the hub.
  useEffect(() => {
    const onCheer = () => runCheer();
    window.addEventListener('buddy-cheer', onCheer);
    return () => window.removeEventListener('buddy-cheer', onCheer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheerClick = (e) => {
    e?.stopPropagation();
    runCheer();
  };

  const Renderer = BUDDY_RENDERERS[id];
  const inner = Renderer
    ? <Renderer size={size} cheering={isCheering} />
    : fallback;
  if (inner == null) return null;

  if (!interactive) return inner;
  return (
    <button
      type="button"
      className="buddy-sprite-btn"
      onClick={handleCheerClick}
      aria-label="Cheer with your buddy"
    >
      {inner}
    </button>
  );
}

/**
 * Trigger the buddy-cheer celebration from anywhere in the app. Any mounted
 * BuddyAvatar listens for the `buddy-cheer` window event and runs the same
 * routine that firing on click does.
 */
export function fireBuddyCheer() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('buddy-cheer'));
  }
}
