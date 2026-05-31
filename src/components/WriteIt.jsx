import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import RestartButton from './RestartButton';
import GameResults from './GameResults';
import './WriteIt.css';
import './WordListHub.css';
import { speakWord as speak } from '../utils/speech';
import { formatDuration } from '../utils/formatDuration';
import { preSeedClueCache } from '../utils/clueResolver';
import { WordDetailModal } from './WordListHub';

// Word info is delegated to the central clueResolver.
// Word detail modal is the shared WordDetailModal from WordListHub.

// Themed background — same pattern as the other adventure screens.
const BG_STYLE = {
  '--bg-image-url': `url("${process.env.PUBLIC_URL || ''}/adventure/Write%20it%20background.png")`,
};

// ── Constants ────────────────────────────────────────────────────────────────

// Inline SVG icons for the Look→Say→Cover→Write→Check method banner.
// "look" and "say" are CSS-animated (blink / speaker-pulse) to give the same
// looping effect as a Lottie animation without adding a new library dependency.
const STEP_ICONS = {
  look: (
    /* Eye blink: the eyelid arc animates via wi-icon-lid,
       the pupil gently scales via wi-icon-pupil */
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
      {/* eyelid — closes down on blink */}
      <path className="wi-icon-lid" d="M1.5 12s4-7 10.5-7 10.5 7 10.5 7" strokeWidth="2.4" />
      <circle className="wi-icon-pupil" cx="12" cy="12" r="3.2" />
    </svg>
  ),
  say: (
    /* Speaker: cone stays static, wave arcs pulse in/out */
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path className="wi-icon-wave wi-icon-wave--1" d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path className="wi-icon-wave wi-icon-wave--2" d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  ),
  cover: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s4-7 10-7c2.2 0 4.1.8 5.7 1.9" />
      <path d="M22 12s-4 7-10 7c-2.2 0-4.1-.8-5.7-1.9" />
      <path d="M3 3l18 18" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  ),
  write: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 3.5l6 6L9 21H3v-6L14.5 3.5z" />
      <path d="M13 5l6 6" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7.5 12.5l3 3 6-7" />
    </svg>
  ),
};
const STEPS = [
  { key: 'look',  label: 'Look',  accent: '#a5f3fc' },
  { key: 'say',   label: 'Say',   accent: '#fde68a' },
  { key: 'cover', label: 'Cover', accent: '#d8b4fe' },
  { key: 'write', label: 'Write', accent: '#fbcfe8' },
  { key: 'check', label: 'Check', accent: '#bbf7d0' },
];

// WRT-01: Write It is spaced over days. Each visit is ONE practice (the child
// writes every word once, then returns to the hub). Four practices are the
// structured core; beyond that the child is gently asked if they'd like a
// bonus practice rather than being auto-presented endless rounds.
const STRUCTURED_TOTAL = 4;

// ── Helpers ──────────────────────────────────────────────────────────────────

// One cell per word — a single practice per visit (WRT-01). The old model held
// an array of NUM_BASE practice cells per word and let the child do all rounds
// in one sitting; that's now spread across visits.
function makeInitialRows(words) {
  return words.map((w) => ({
    word:       w,
    value:      '',
    done:       false,
    attempts:   0,
    revealHint: false,
    status:     'idle',
    celebrated: false,
  }));
}

// Restore a mid-practice snapshot only if it matches the current word list AND
// the new single-cell shape. A snapshot from the old multi-column model (rows
// carry a `practices` array) is ignored so the child simply restarts the
// current practice — harmless, since the snapshot is ephemeral.
function restoreRows(savedProgress, words) {
  const saved = savedProgress?.rows;
  const valid =
    Array.isArray(saved) &&
    saved.length === words.length &&
    saved.every((r, i) =>
      r && r.word === words[i] && typeof r.done === 'boolean' && !('practices' in r));
  return valid ? saved : makeInitialRows(words);
}

function isCorrect(input, target) {
  return input.trim().toLowerCase() === target.trim().toLowerCase();
}

// ── Component ────────────────────────────────────────────────────────────────

function WriteIt({
  words,
  wordObjects = [],
  childName = '',
  dyslexiaMode = false,
  practisesDone = 0,      // WRT-01: how many practices already locked in (across visits)
  savedProgress = null,
  onSaveProgress,
  onComplete,
  onExit,
}) {
  const isExtra = practisesDone >= STRUCTURED_TOTAL;
  const practiceNumber = practisesDone + 1; // the practice being done this visit

  const [rows, setRows] = useState(() => restoreRows(savedProgress, words));
  const [wordsHidden, setWordsHidden] = useState(false);
  const [activeWord,  setActiveWord]  = useState(null);
  // Beyond the four structured practices we don't auto-start — we ask first.
  // (If they'd already begun a bonus practice and have saved progress, skip
  // straight back into it.)
  const [started, setStarted] = useState(
    () => !isExtra || restoreRows(savedProgress, words).some((r) => r.done)
  );
  const [endTime, setEndTime] = useState(null);

  const inputRefs        = useRef({});
  const onSaveRef        = useRef(onSaveProgress);
  onSaveRef.current      = onSaveProgress;
  const startRef         = useRef(null);
  const celebratedRef    = useRef(new Set());

  // Pre-seed the clue cache with any list-provided definitions so the word
  // detail modal resolves instantly without hitting the external API.
  useEffect(() => {
    preSeedClueCache(wordObjects);
  }, [words]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ────────────────────────────────────────────────────────────────

  const total     = rows.length;
  const doneCount  = rows.filter((r) => r.done).length;
  const allDone    = started && total > 0 && doneCount === total;

  const gridTemplate = 'minmax(200px, 260px) minmax(156px, 1fr)';

  // ── Start the clock once the practice is actually under way ────────────────
  useEffect(() => {
    if (started && startRef.current == null) startRef.current = Date.now();
  }, [started]);

  // ── Freeze the elapsed time the moment the practice is complete ────────────
  useEffect(() => {
    if (allDone && endTime == null) setEndTime(Date.now());
  }, [allDone, endTime]);

  // ── Save progress whenever rows change (if any work done) ──────────────────
  useEffect(() => {
    const anyDone = rows.some((r) => r.done);
    if (anyDone) onSaveRef.current?.({ rows });
  }, [rows]);

  // ── Per-word celebrate auto-fade ───────────────────────────────────────────
  useEffect(() => {
    const stillCelebrating = rows.some((r) => r.celebrated);
    if (!stillCelebrating) return undefined;
    const t = setTimeout(() => {
      setRows((prev) => prev.map((r) => (r.celebrated ? { ...r, celebrated: false } : r)));
    }, 1500);
    return () => clearTimeout(t);
  }, [rows]);

  // ── Per-word success chime: a light positive cue the first time each word
  // is written correctly. The big confetti + fanfare is owned by the end
  // screen (GameResults), so we keep per-word feedback gentle here.
  useEffect(() => {
    rows.forEach((r) => {
      if (!r.done) return;
      if (celebratedRef.current.has(r.word)) return;
      celebratedRef.current.add(r.word);
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const t = ctx.currentTime + i * 0.12;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.18, t + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          osc.start(t); osc.stop(t + 0.4);
        });
      } catch { /* AudioContext unavailable */ }
    });
  }, [rows]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const beginPractice = () => setStarted(true);

  const doRestart = () => {
    onSaveRef.current?.(null);
    celebratedRef.current = new Set();
    setRows(makeInitialRows(words));
    setWordsHidden(false);
    setEndTime(null);
    startRef.current = Date.now();
  };

  // ── DEV-only: instant complete ─────────────────────────────────────────────
  const handleDevComplete = () => {
    setRows((prev) => prev.map((r) => ({
      ...r, done: true, status: 'success', value: r.word, attempts: 1, celebrated: false,
    })));
  };

  const hasProgress = rows.some((r) => r.done);

  const updateCell = useCallback((idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const handleChange = (idx, value) => {
    const row = rows[idx];
    if (!row || row.done) return;
    if (isCorrect(value, row.word)) {
      setWordsHidden(false);
      updateCell(idx, { value, done: true, status: 'success', celebrated: true });
    } else {
      updateCell(idx, { value, status: 'idle' });
    }
  };

  const handleSubmit = (idx) => {
    const row = rows[idx];
    if (!row || row.done) return;
    if (isCorrect(row.value, row.word)) {
      setWordsHidden(false);
      updateCell(idx, { done: true, status: 'success', celebrated: true });
    } else {
      // On a wrong answer, reveal the word straight away — un-hide the column
      // and show the helper line — so the child can look, then write it.
      setWordsHidden(false);
      updateCell(idx, {
        attempts:   (row.attempts || 0) + 1,
        status:     'trying',
        revealHint: true,
      });
    }
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(idx);
    }
  };

  const handleInputFocus = (idx) => {
    setWordsHidden(true);
    // Auto-play the target word so the child gets an audio cue the moment
    // they're ready to type. Browsers typically allow speech synthesis after
    // a user gesture (the click that focused the input counts).
    const row = rows[idx];
    if (row?.word) speak(row.word);
  };

  // Continue from the end screen → roll up a per-word result for the credit
  // framework and hand back to the hub. A practice only completes once every
  // word is written correctly, so every word is `correct`; attempts/hintUsed
  // still feed the mastery signal.
  const handleContinue = () => {
    onSaveRef.current?.(null);
    onComplete(rows.map((r) => ({
      word:     r.word,
      correct:  r.done,
      attempts: (Number(r.attempts) || 0) <= 1 ? 1 : 2,
      hintUsed: !!r.revealHint,
    })));
  };

  // ── Render: opt-in prompt past the four structured practices ───────────────
  if (isExtra && !started) {
    return (
      <div className="wi-wrap" style={BG_STYLE}>
        <div className="wi-no-print">
          <GameHeader title="Write It" onExit={onExit} />
        </div>
        <div className="wi-optin">
          <div className="wi-optin-card">
            <div className="wi-optin-emoji" aria-hidden="true">🎉</div>
            <h2 className="wi-optin-title">All four practices done!</h2>
            <p className="wi-optin-text">
              Brilliant work spreading them out{childName ? `, ${childName}` : ''}. That's exactly
              how spelling sticks. Would you like a bonus practice, just for fun?
            </p>
            <div className="wi-optin-actions">
              <button type="button" className="wi-optin-yes" onClick={beginPractice}>
                Yes, let's practise ✏️
              </button>
              <button type="button" className="wi-optin-no" onClick={onExit}>
                Back to the map
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: the practice ───────────────────────────────────────────────────

  const elapsedSeconds = ((endTime ?? Date.now()) - (startRef.current ?? Date.now())) / 1000;
  const headerLabel = isExtra ? 'Bonus practice' : `Practice ${practiceNumber}`;

  return (
    <div className={`wi-wrap${dyslexiaMode ? ' wi-wrap--es' : ''}`} style={BG_STYLE}>

      {/* Screen header */}
      <div className="wi-no-print">
        <GameHeader
          title="Write It"
          onExit={onExit}
          rightSlot={
            <>
              <RestartButton hasProgress={hasProgress} onRestart={doRestart} />
              <button className="game-header-btn" onClick={() => window.print()} title="Print as worksheet">🖨 Print</button>
            </>
          }
        />
        <GameProgressStrip percent={total > 0 ? (doneCount / total) * 100 : 0}>
          {doneCount} of {total} words written
        </GameProgressStrip>
      </div>

      {/* Print-only header */}
      <div className="wi-print-header">
        <div className="wi-print-title">🎯 Spellify · Write It</div>
        {childName && <div className="wi-print-name">Name: {childName}</div>}
        <p className="wi-print-instructions">
          Look at the word, say it, cover it, write it, and check it three times.
        </p>
      </div>

      {/* Method banner — bigger, padded, with SVG step icons. */}
      <div className="wi-steps wi-no-print">
        {STEPS.map((s) => (
          <div key={s.key} className="wi-step" style={{ '--wi-step-accent': s.accent }}>
            <span className="wi-step-icon" aria-hidden="true">{STEP_ICONS[s.key]}</span>
            <span className="wi-step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Practice tracker — which of the four practices this is. Completed
          ones read as locked-in (✓); the current one is highlighted; future
          ones are quiet dots, not dangled buttons (WRT-01). */}
      <div className="wi-tracker wi-no-print" aria-label={`This is ${headerLabel}`}>
        {Array.from({ length: STRUCTURED_TOTAL }, (_, i) => {
          const n = i + 1;
          const state = isExtra || n < practiceNumber
            ? 'done'
            : n === practiceNumber ? 'current' : 'upcoming';
          return (
            <span key={n} className={`wi-track-pill wi-track-pill--${state}`} aria-hidden="true">
              {state === 'done' ? '✓' : n}
            </span>
          );
        })}
        {isExtra && <span className="wi-track-bonus" aria-hidden="true">Bonus ✨</span>}
      </div>

      {/* Table */}
      <div className="wi-table-outer">
        <div className="wi-table">

          {/* Column headers */}
          <div className="wi-thead" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="wi-th wi-th--word">Word</div>
            <div className="wi-th wi-th--active">{headerLabel}</div>
            {/* Paper worksheet gets two more write columns (the classic
                look-cover-write-check ×3); hidden on screen. */}
            <div className="wi-th wi-print-only">2nd write</div>
            <div className="wi-th wi-print-only">3rd write</div>
          </div>

          {/* Word rows */}
          {rows.map((row, idx) => {
            const wordFaded = wordsHidden && !row.done;
            const stateClass =
              row.done                  ? ' wi-cell--success' :
              row.status === 'trying'   ? ' wi-cell--retry' : '';

            return (
              <div
                key={row.word}
                className={`wi-row${row.done ? ' wi-row--done' : ''}${row.celebrated ? ' wi-row--celebrate' : ''}`}
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {row.celebrated && (
                  <div className="wi-row-burst" aria-hidden="true">⭐ ✨ 🌟 ✨ ⭐</div>
                )}

                {/* Word cell — sticky */}
                <div className="wi-cell wi-cell--word">
                  <div className="wi-word-display">
                    <span className={`wi-word-text${wordFaded ? ' wi-word-text--faded' : ''}`}>
                      {row.word}
                    </span>
                    <div className="wi-word-actions wi-no-print">
                      {wordFaded && (
                        <button
                          className="wi-eye"
                          onClick={() => setWordsHidden(false)}
                          title="Show words"
                          aria-label="Show words"
                        >👁</button>
                      )}
                      <button
                        className="wi-speaker"
                        onClick={() => speak(row.word)}
                        title="Hear this word"
                        aria-label={`Hear ${row.word}`}
                      >👂</button>
                      <button
                        className="wi-define"
                        onClick={() => setActiveWord(row.word)}
                        title="Definition"
                        aria-label={`Definition of ${row.word}`}
                      >?</button>
                    </div>
                  </div>
                </div>

                {/* Practice cell */}
                <div className={`wi-cell wi-cell--practice${stateClass}`}>
                  {row.revealHint && !row.done && (
                    <div className="wi-helper">
                      Here it is — give it another go 💪
                      <strong className="wi-helper-word">{row.word}</strong>
                    </div>
                  )}

                  <div className="wi-input-wrap">
                    <input
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      type="text"
                      className="wi-input"
                      value={row.value}
                      onChange={(e) => handleChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      onFocus={() => handleInputFocus(idx)}
                      disabled={row.done}
                      placeholder="Type here…"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                    />
                    {!row.done && (
                      <button
                        className="wi-check-btn wi-no-print"
                        onClick={() => handleSubmit(idx)}
                      >
                        Check
                      </button>
                    )}
                  </div>

                  {row.done && <span className="wi-success-badge wi-no-print">✨</span>}
                  {row.status === 'trying' && !row.done && row.attempts === 1 && (
                    <p className="wi-feedback wi-feedback--retry">Try again!</p>
                  )}
                </div>

                {/* Paper-only blank write columns (hidden on screen). */}
                <div className="wi-cell wi-print-only" aria-hidden="true">
                  <div className="wi-input-wrap"><input className="wi-input" disabled tabIndex={-1} /></div>
                </div>
                <div className="wi-cell wi-print-only" aria-hidden="true">
                  <div className="wi-input-wrap"><input className="wi-input" disabled tabIndex={-1} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* End screen — shared RES-01 Variant B results (Completed · Time ·
          Number of words · Continue → hub), same component as Word Search
          and Crossword. */}
      {allDone && (
        <div className="wi-results-overlay" role="dialog" aria-modal="true" aria-label="Write It practice complete">
          <GameResults
            variant="B"
            stats={[
              { value: formatDuration(elapsedSeconds), label: 'Time' },
              { value: total, label: total === 1 ? 'Word' : 'Words' },
            ]}
            onContinue={handleContinue}
          />
        </div>
      )}

      {/* Word definition modal — shared component from WordListHub */}
      {activeWord && (
        <WordDetailModal
          word={activeWord}
          userAge={7}
          chipColor="#c77dff"
          onClose={() => setActiveWord(null)}
        />
      )}

      {/* DEV-only: instant complete — stripped by webpack in production builds */}
      {process.env.NODE_ENV === 'development' && (
        <button onClick={handleDevComplete} style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, background: '#ff6b35', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'monospace' }}>
          ⚡ DEV: Complete
        </button>
      )}
    </div>
  );
}

export default WriteIt;
