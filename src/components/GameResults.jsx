import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import './GameResults.css';

/**
 * GameResults — the one shared end-of-game results screen (RES-01).
 *
 * Every game finishes on this component so the celebration, the star, the
 * results shell and the single "Continue" CTA are identical everywhere and no
 * game can silently skip them. Two variants cover all ~7 games:
 *
 *   Variant A — Word Results (Memory Spell, Spell Duel, Syllable Tap,
 *     Quiz Quest): words are individually right/wrong, so we show two boxes —
 *     the words you got right and the words to practise.
 *
 *   Variant B — Completion (Word Search, Memory Match / Spell Book, Crossword,
 *     Write It): "find-them-all" games with no per-word wrong state, so we show
 *     stat tiles (big number + label) instead of word boxes.
 *
 * Shared by both: a single star at the top, a status line, a results container,
 * and the Continue button — which always sits OUTSIDE the containers, below
 * everything. This replaces the old "Play Again" + "Back to Hub" pair: there is
 * no Play Again anymore, just Continue → back to the hub.
 */

// ── Completion celebration (RES-02) ──────────────────────────────────────────
// The SAME warm celebration fires on EVERY finished game, every time, no matter
// the score — a child who struggled gets exactly the same encouraging finish.
// Confetti waves + a short rising chime, fired once when the screen mounts.

const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f43'];

function fireCelebration() {
  try {
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors: CONFETTI_COLORS });
    setTimeout(() => confetti({
      particleCount: 50, angle: 60, spread: 65, origin: { x: 0, y: 0.65 }, colors: CONFETTI_COLORS,
    }), 150);
    setTimeout(() => confetti({
      particleCount: 50, angle: 120, spread: 65, origin: { x: 1, y: 0.65 }, colors: CONFETTI_COLORS,
    }), 300);
  } catch {
    // canvas-confetti unavailable — skip silently.
  }
}

function playFanfare() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[523, 0], [659, 0.13], [784, 0.26], [1047, 0.4]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  } catch {
    // AudioContext unavailable or blocked — skip silently.
  }
}

export default function GameResults({
  variant = 'A',
  // Variant A
  correctWords = [],
  practiceWords = [],
  total,
  // Variant B
  stats = [],
  // shared
  onContinue,
  celebrate = true,
  continueLabel = 'Continue ▶',
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (celebrate && !firedRef.current) {
      firedRef.current = true;
      fireCelebration();
      playFanfare();
    }
  }, [celebrate]);

  const totalWords = typeof total === 'number'
    ? total
    : correctWords.length + practiceWords.length;

  return (
    <div className="gr-results" role="region" aria-label="Game results">
      <span className="gr-star" aria-hidden="true">⭐</span>

      <p className="gr-status">
        {variant === 'B' ? 'Completed' : `${correctWords.length} of ${totalWords} words`}
      </p>

      {variant === 'B' ? (
        <div className="gr-container gr-stats">
          {stats.map((s) => (
            <div className="gr-stat" key={s.label}>
              <span className="gr-stat-value">{s.value}</span>
              <span className="gr-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {correctWords.length > 0 && (
            <div className="gr-container gr-box">
              <h3 className="gr-box-heading gr-box-heading--good">Correct words</h3>
              <div className="gr-chips">
                {correctWords.map((w) => (
                  <span key={w} className="gr-chip gr-chip--good">{w}</span>
                ))}
              </div>
            </div>
          )}
          {practiceWords.length > 0 && (
            <div className="gr-container gr-box">
              <h3 className="gr-box-heading gr-box-heading--practice">Words to practise</h3>
              <div className="gr-chips">
                {practiceWords.map((w) => (
                  <span key={w} className="gr-chip gr-chip--practice">{w}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <button type="button" className="gr-continue" onClick={onContinue}>
        {continueLabel}
      </button>
    </div>
  );
}
