// MemoryMatch — classic memory pairing, wizard / spellbook theme.
//
// Rules:
//   • Each unique word becomes TWO cards (the pair to match).
//   • Cards start face-down (showing a decorative spellbook back).
//   • Tap a card to flip. Tap a second card.
//     - If the two words match: both cards stay revealed in a "matched"
//       success state, the pair is locked, and the child moves on.
//     - If they don't match: both cards flip back after a short pause
//       and the run continues (classic memory rules — no penalty other
//       than the extra move on the score).
//   • Round ends when every pair is matched.
//
// Grid sizing:
//   The grid auto-fits roughly square based on the pair count so any
//   word-list size from 6 to 18 pairs reads as a coherent board.
//
// Save / resume:
//   Snapshot includes the shuffled order, the set of already-matched
//   word ids, and the moves counter. Resuming reloads the same board.
//
// Completion:
//   Calls onComplete with one entry per word, all marked correct — a
//   successful run finishes when every pair is found, so per-word
//   correctness mirrors that. (Future: penalise too-many-attempts to
//   surface "shaky recall" in the engine — out of scope for this build.)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import { speakWord } from '../utils/speech';
import { isMuted } from '../utils/audioMute';
import './MemoryMatch.css';

// ── Card deck assembly ───────────────────────────────────────────────────────

// Build a shuffled list of 2N cards from N unique words. Each card is
// `{ id, word }` where `id` is unique even when two cards share a
// word — the click handler keys off `id`, the match check off `word`.
//
// `pairCount` (optional) caps how many word-pairs end up in the deck;
// the chooser screen sets it to 6 or 12 before the game starts. We
// pick the words randomly from the pool (also seeded) so the same
// list can produce different sub-decks across runs but stays stable
// across resumes.
function buildDeck(words, seed = Date.now(), pairCount = null) {
  const unique = Array.from(new Set((words || []).map((w) => String(w).trim()).filter(Boolean)));
  // Hard ceiling at 18 pairs so the largest sensible board (6×6 = 36
  // cards) fits on a phone without dominating the UI with scroll.
  const hardCap = 18;
  const want = pairCount ? Math.min(pairCount, unique.length, hardCap) : Math.min(unique.length, hardCap);
  // Shuffle the whole pool with the run's seed, then take the top N —
  // gives a stable but per-run sub-selection.
  const pool = shuffle(unique, seed).slice(0, want);
  const cards = [];
  pool.forEach((word, idx) => {
    cards.push({ id: `${idx}-a`, word });
    cards.push({ id: `${idx}-b`, word });
  });
  // Reshuffle with a derived seed so the card positions aren't a
  // function of the pool order.
  return shuffle(cards, seed ^ 0x9E3779B9);
}

// Seedable Fisher-Yates so save/resume keeps the same board across
// reloads. seed → mulberry32 RNG.
function shuffle(arr, seed) {
  const rng = mulberry32(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// Remember the last pair-count the player picked so re-entering the
// game after completion drops straight into a fresh round with the
// same difficulty (App clears the per-activity progress snapshot on
// completion, so we can't rely on savedProgress for this).
const CHOICE_KEY = 'spellify_memorymatch_lastChoice';
function readSavedChoice() {
  try {
    const raw = localStorage.getItem(CHOICE_KEY);
    if (!raw) return null;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}
function writeSavedChoice(n) {
  try { localStorage.setItem(CHOICE_KEY, JSON.stringify(n)); } catch { /* ignore */ }
}
function clearSavedChoice() {
  try { localStorage.removeItem(CHOICE_KEY); } catch { /* ignore */ }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick the grid shape (cols × rows) that gives the biggest card size
// for the current viewport. We try every divisor pair of `n` and pick
// the (cols, rows) where `min(width-budget, height-budget)` is
// largest. On a wide screen the result is more landscape (6×2 for 12
// cards), on a square-ish screen it goes 4×3, on tall portrait 3×4.
//
// For decks whose count isn't a clean divisor of the candidate cols
// (e.g. 14 cards across a 4-wide grid), `rows = ceil(n / cols)` —
// the last row will have empty cells, which the grid CSS handles
// gracefully (`justify-content: center`).
function pickGridShape(n, availW, availH, gap = 8) {
  if (n <= 0) return { cols: 1, rows: 1 };
  // Cards are 3:4 portrait — width = height × 3/4.
  let best = { cols: 1, rows: n, cardW: 0 };
  // Only try shapes up to n columns (anything larger is just empty
  // padding on the right and never wins).
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const wFromWidth  = (availW - gap * (cols - 1)) / cols;
    const wFromHeight = ((availH - gap * (rows - 1)) / rows) * 3 / 4;
    const cardW = Math.min(wFromWidth, wFromHeight);
    if (cardW > best.cardW) best = { cols, rows, cardW };
  }
  return { cols: best.cols, rows: best.rows };
}

// Reserved vertical space above + below the grid: GameHeader pill +
// subtitle + meta row + bottom padding. Used as the height budget for
// the shape-picker. Adjust if the chrome grows.
const RESERVED_VERT_PX = 160;
const RESERVED_HORIZ_PX = 32;

// ── Sound effects ────────────────────────────────────────────────────────────

// Soft chime on match — two-note Web Audio fanfare so we don't need an
// asset file. Falls back silently if AudioContext is unavailable.
function playChime() {
  if (isMuted()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[660, 0], [880, 0.09]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch { /* ignore */ }
}

// Subtle "no match" thunk — single low note.
function playThunk() {
  if (isMuted()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.value = 220;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.start(t);
    osc.stop(t + 0.2);
  } catch { /* ignore */ }
}

function fireConfetti() {
  confetti({
    particleCount: 140,
    spread: 95,
    origin: { y: 0.5 },
    colors: ['#ffd93d', '#ff9f43', '#c77dff', '#6bcb77', '#4d96ff', '#ff6b6b'],
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MemoryMatch({
  words = [],
  dyslexiaMode = false,
  savedProgress = null,
  onSaveProgress,
  onComplete,
  onExit,
}) {
  // ── Difficulty chooser ──────────────────────────────────────────
  // Before the board appears, the child picks how many pairs to play.
  // We persist the choice into savedProgress so resumes skip the
  // chooser and drop straight back into the same board.
  const availablePairs = useMemo(() => {
    const unique = new Set((words || []).map((w) => String(w).trim()).filter(Boolean));
    return unique.size;
  }, [words]);
  // If the persisted snapshot represents a COMPLETED game (matched
  // count ≥ pairCount), treat it as no snapshot for matched / moves
  // / seed — we want a fresh round on re-entry. The pair-count
  // choice is still honoured below so the next round runs at the
  // same size. This is the second line of defence; the completion
  // effect clears the snapshot once the game finishes, but a player
  // who exits mid-celebration (before the 1.2 s `onComplete` timer
  // fires) leaves a stale completed snapshot we need to ignore.
  const wasCompleted = !!savedProgress
    && Number(savedProgress.pairCount) > 0
    && Array.isArray(savedProgress.matched)
    && savedProgress.matched.length >= savedProgress.pairCount;
  const activeSavedProgress = wasCompleted ? null : savedProgress;

  // Init priority:
  //   1. Active resume (savedProgress.pairCount from a paused mid-game)
  //   2. Last-completed choice (localStorage) — auto-starts a fresh
  //      round at the same difficulty after the previous round ended
  //   3. null → show the chooser
  const [pairCount, setPairCount] = useState(
    savedProgress?.pairCount ?? readSavedChoice() ?? null
  );

  // Seed locked at first mount so resumes show the same shuffle. If a
  // (non-completed) snapshot is provided, reuse its seed; otherwise
  // pick a fresh one.
  const seedRef = useRef(activeSavedProgress?.seed ?? Date.now());
  const deck = useMemo(
    () => (pairCount ? buildDeck(words, seedRef.current, pairCount) : []),
    [words, pairCount],
  );

  // Set of matched WORD strings (lowercased). Cards stay flipped face-up
  // when their `word` is in this set.
  const [matched, setMatched] = useState(() => new Set(activeSavedProgress?.matched || []));
  // Currently flipped (un-matched) card IDs. Always 0, 1, or 2 entries.
  const [flipped, setFlipped] = useState([]);
  // Total flips counted as moves (pair = 1 move).
  const [moves, setMoves] = useState(activeSavedProgress?.moves || 0);
  // Lock clicks while we evaluate a pair (the 800ms peek-then-flip-back).
  const [locked, setLocked] = useState(false);
  // Set of card IDs that should briefly pulse on mismatch (red flash).
  const [mismatchIds, setMismatchIds] = useState(null);

  // Snapshot save — fires after every state change so the parent can
  // persist progress between sessions.
  useEffect(() => {
    if (!onSaveProgress) return;
    onSaveProgress({
      seed: seedRef.current,
      pairCount,
      matched: Array.from(matched),
      moves,
    });
    // We intentionally don't depend on `flipped` — only matched pairs
    // and the move count get persisted; the live "two cards face-up"
    // state is transient and resets on resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, moves, pairCount]);

  // Completion check — when every unique word in the deck has been
  // matched, fire confetti and bubble up to App.
  const totalPairs = useMemo(() => new Set(deck.map((c) => c.word)).size, [deck]);
  const didCompleteRef = useRef(false);
  useEffect(() => {
    if (didCompleteRef.current) return;
    if (matched.size === 0 || matched.size < totalPairs) return;
    didCompleteRef.current = true;
    fireConfetti();
    // Drop the snapshot the moment we know the run is done. If the
    // player exits during the 1.2 s celebration before `onComplete`
    // fires, App's saveSnapshot effect would otherwise persist the
    // "all matched" state and re-show the win modal on re-entry.
    onSaveProgress?.(null);
    // Slight delay so the player sees the final pair stay revealed
    // before App swaps the screen.
    const t = setTimeout(() => {
      const results = Array.from(matched).map((w) => ({ word: w, correct: true }));
      onComplete?.(results);
    }, 1200);
    return () => clearTimeout(t);
  }, [matched, totalPairs, onComplete, onSaveProgress]);

  // ── Card tap ────────────────────────────────────────────────────────
  const handleCard = useCallback((card) => {
    if (locked) return;
    if (matched.has(card.word)) return;       // already matched — ignore
    if (flipped.find((c) => c.id === card.id)) return; // already flipped this turn

    // Voice-over the word the moment the card flips, so the child
    // hears the spelling target. Skip the second utterance when this
    // tap completes a matching pair — the child just heard the same
    // word on the first card, so repeating it adds noise. Mismatched
    // second taps still speak (different word — the child needs to
    // hear it). `speakWord` self-guards against the global mute.
    const completesMatch = flipped.length === 1 && flipped[0].word === card.word;
    if (!completesMatch) {
      speakWord(card.word);
    }

    const next = [...flipped, card];
    setFlipped(next);

    if (next.length === 2) {
      // Bump moves immediately so the counter updates with the second flip.
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (a.word === b.word) {
        // Match — promote both to "matched" after a short reveal pause
        // so the success state reads cleanly to the eye.
        playChime();
        setLocked(true);
        setTimeout(() => {
          setMatched((prev) => new Set(prev).add(a.word));
          setFlipped([]);
          setLocked(false);
        }, 600);
      } else {
        // No match — let the player see both, then flip back.
        playThunk();
        setLocked(true);
        setMismatchIds(new Set([a.id, b.id]));
        setTimeout(() => {
          setFlipped([]);
          setMismatchIds(null);
          setLocked(false);
        }, 950);
      }
    }
  }, [flipped, locked, matched]);

  // Reset (restart) button — keeps the same word list but reshuffles
  // AND drops the player back to the chooser so they can pick a new
  // difficulty. Also wipes the saved-choice so the chooser actually
  // shows on the next mount (without this it would auto-resume the
  // previous difficulty and skip the chooser).
  const handleRestart = useCallback(() => {
    seedRef.current = Date.now();
    setMatched(new Set());
    setFlipped([]);
    setMoves(0);
    setLocked(false);
    setMismatchIds(null);
    setPairCount(null);
    clearSavedChoice();
    didCompleteRef.current = false;
  }, []);

  // Chooser → board. Caps the request at the actual word-list size so
  // a list of 8 words can't ask for "12 pairs". Also writes the choice
  // to localStorage so the next visit (after completion) auto-resumes
  // the same difficulty with a fresh deck.
  const handlePickPairs = useCallback((n) => {
    seedRef.current = Date.now();
    setMatched(new Set());
    setFlipped([]);
    setMoves(0);
    setLocked(false);
    setMismatchIds(null);
    didCompleteRef.current = false;
    const capped = Math.min(n, availablePairs);
    writeSavedChoice(capped);
    setPairCount(capped);
  }, [availablePairs]);

  // Track viewport so the grid shape can re-pick on orientation
  // changes / window resizes. Cards reflow without losing state.
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth  : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { cols, rows } = useMemo(
    () => pickGridShape(
      deck.length,
      viewport.w - RESERVED_HORIZ_PX,
      viewport.h - RESERVED_VERT_PX,
    ),
    [deck.length, viewport],
  );
  const matchedCount = matched.size;

  // ── Pre-game chooser ────────────────────────────────────────────
  // Rendered when no difficulty has been picked yet. Two options for
  // now (6 / 12 pairs). Each option auto-disables if the word list
  // doesn't have enough unique words to play that size.
  if (pairCount == null) {
    const PAIR_OPTIONS = [
      { n: 6,  label: '6 pairs',  sub: '12 cards · quick warm-up' },
      { n: 12, label: '12 pairs', sub: '24 cards · full challenge' },
    ];
    return (
      <main className={`mm-root${dyslexiaMode ? ' mm-root--dyslexia' : ''}`}>
        <GameHeader title="Memory Match" onExit={onExit} />
        <div className="mm-bg" aria-hidden="true">
          <div className="mm-bg__stars" />
        </div>
        <div className="mm-chooser">
          <h1 className="mm-title">
            <span aria-hidden="true">✦</span>
            Memory Match
            <span aria-hidden="true">✦</span>
          </h1>
          <p className="mm-sub">How many pairs would you like to play?</p>

          <div className="mm-chooser__row">
            {PAIR_OPTIONS.map((opt) => {
              const tooMany = opt.n > availablePairs;
              return (
                <button
                  key={opt.n}
                  type="button"
                  className="mm-chooser__option"
                  onClick={() => handlePickPairs(opt.n)}
                  disabled={tooMany}
                  aria-label={`Play with ${opt.n} pairs`}
                >
                  <span className="mm-chooser__num">{opt.n}</span>
                  <span className="mm-chooser__label">{opt.label}</span>
                  <span className="mm-chooser__sub">{opt.sub}</span>
                  {tooMany && (
                    <span className="mm-chooser__warn">
                      Your list only has {availablePairs} word{availablePairs === 1 ? '' : 's'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`mm-root${dyslexiaMode ? ' mm-root--dyslexia' : ''}`}>
      <GameProgressStrip
        current={matchedCount}
        total={totalPairs}
        label={`${matchedCount} / ${totalPairs} pairs`}
      />
      <GameHeader
        title="Memory Match"
        onExit={onExit}
        rightSlot={(
          <button
            type="button"
            className="mm-restart-btn"
            onClick={handleRestart}
            aria-label="Restart"
            title="Restart"
          >
            ↺
          </button>
        )}
      />

      <div className="mm-bg" aria-hidden="true">
        <div className="mm-bg__stars" />
      </div>

      <header className="mm-header">
        {/* Title removed from the board to maximise space for the
            grid — the player already saw it on the chooser. */}
        <p className="mm-sub">Find the matching pairs of magical words.</p>
        <div className="mm-meta">
          <span className="mm-meta__chip">
            <span aria-hidden="true">📖</span>
            <span>{matchedCount} / {totalPairs} pairs</span>
          </span>
          <span className="mm-meta__chip">
            <span aria-hidden="true">🪄</span>
            <span>{moves} {moves === 1 ? 'move' : 'moves'}</span>
          </span>
          {/* Restart pill — returns to the difficulty chooser so the
              player can swap between 6 and 12 pairs without leaving
              the game. The clickable style mirrors the meta chips so
              it sits naturally in the same row. */}
          <button
            type="button"
            className="mm-meta__chip mm-meta__chip--btn"
            onClick={handleRestart}
            aria-label="Change pair count"
            title="Change pair count"
          >
            <span aria-hidden="true">↺</span>
            <span>Change size</span>
          </button>
        </div>
      </header>

      <section
        className="mm-grid"
        style={{ '--cols': cols, '--rows': rows }}
        role="grid"
        aria-label="Memory match grid"
      >
        {deck.map((card) => {
          const isMatched = matched.has(card.word);
          const isFlipped = isMatched || !!flipped.find((c) => c.id === card.id);
          const isMismatch = mismatchIds?.has(card.id);
          return (
            <button
              key={card.id}
              type="button"
              role="gridcell"
              className={
                'mm-card' +
                (isFlipped   ? ' is-flipped'  : '') +
                (isMatched   ? ' is-matched'  : '') +
                (isMismatch  ? ' is-mismatch' : '')
              }
              aria-label={isFlipped ? card.word : 'Hidden card'}
              onClick={() => handleCard(card)}
              disabled={isMatched}
            >
              <span className="mm-card__inner">
                {/* Back: spellbook design (decorative). The star sits
                    centre, the corner runes give it a tarot/grimoire feel. */}
                <span className="mm-card__back" aria-hidden="true">
                  <span className="mm-card__back-frame">
                    <span className="mm-card__back-star">✦</span>
                    <span className="mm-card__back-rune mm-card__back-rune--tl">✶</span>
                    <span className="mm-card__back-rune mm-card__back-rune--tr">✶</span>
                    <span className="mm-card__back-rune mm-card__back-rune--bl">✶</span>
                    <span className="mm-card__back-rune mm-card__back-rune--br">✶</span>
                  </span>
                </span>
                {/* Front: the word, big and centred. */}
                <span className="mm-card__front">
                  <span className="mm-card__word">{card.word}</span>
                </span>
              </span>
            </button>
          );
        })}
      </section>

      {/* Completion overlay — shows the final move count and stays put
          until App swaps the screen on onComplete. */}
      {matchedCount === totalPairs && totalPairs > 0 && (
        <div className="mm-win" role="status" aria-live="polite">
          <div className="mm-win__card">
            <div className="mm-win__icon" aria-hidden="true">🏆</div>
            <h2 className="mm-win__title">Spellbook Sealed!</h2>
            <p className="mm-win__body">
              You matched every pair in <b>{moves}</b> {moves === 1 ? 'move' : 'moves'}.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
