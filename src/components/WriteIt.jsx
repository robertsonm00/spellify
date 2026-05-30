import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import RestartButton from './RestartButton';
import './WriteIt.css';
import './WordListHub.css';
import { speakWord as speak } from '../utils/speech';
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

const NUM_BASE = 3; // base practices that count toward 100%

const CELEBRATE_MSGS = [
  { emoji: '🎉', text: 'You did it!' },
  { emoji: '✋', text: 'High five!' },
  { emoji: '🌟', text: 'Amazing work!' },
  { emoji: '🎊', text: 'Brilliant!' },
  { emoji: '💪', text: 'Keep going!' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeInitialState(words) {
  return words.map(w => ({
    word:       w,
    practices:  Array.from({ length: NUM_BASE }, () => ({
      value:      '',
      done:       false,
      attempts:   0,
      revealHint: false,
      status:     'idle',
    })),
    revealed:   false,
    celebrated: false,
  }));
}

function isCorrect(input, target) {
  return input.trim().toLowerCase() === target.trim().toLowerCase();
}

function getPracticeLabel(i) {
  if (i === 0) return '1st Practice';
  if (i === 1) return '2nd Practice';
  if (i === 2) return '3rd Practice';
  return `Extra ${i - 2}`;
}

function getCompletedLabel(i) {
  return `Practice ${i + 1}`;
}

// ── Component ────────────────────────────────────────────────────────────────

function WriteIt({
  words,
  wordObjects = [],
  childName = '',
  dyslexiaMode = false,
  savedProgress = null,
  onSaveProgress,
  onComplete,
  onExit,
}) {
  const [rows, setRows] = useState(() => savedProgress?.rows ?? makeInitialState(words));
  const [wordsHidden,     setWordsHidden]     = useState(false);
  const [activeWord,      setActiveWord]      = useState(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [celebrate, setCelebrate] = useState(null); // { emoji, text, hiding }
  const [confettiFired, setConfettiFired] = useState(() => {
    if (!savedProgress?.rows) return false;
    return savedProgress.rows.every(r =>
      r.practices.slice(0, NUM_BASE).every(p => p.done)
    );
  });

  // Pre-seed the clue cache with any list-provided definitions so the word
  // detail modal resolves instantly without hitting the external API.
  useEffect(() => {
    preSeedClueCache(wordObjects);
  }, [words]); // eslint-disable-line react-hooks/exhaustive-deps

  const inputRefs          = useRef({});
  const onSaveRef          = useRef(onSaveProgress);
  onSaveRef.current        = onSaveProgress;
  const prevRoundRef       = useRef(null);
  const celebrateTimerRef  = useRef(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const numPractices = rows[0]?.practices.length ?? NUM_BASE;

  const currentRound = (() => {
    for (let r = 0; r < numPractices; r++) {
      if (rows.some(row => !row.practices[r]?.done)) return r;
    }
    return numPractices; // all done
  })();

  const baseAllDone = currentRound >= NUM_BASE;

  const gridTemplate = [
    'minmax(200px, 260px)',
    ...Array.from({ length: numPractices }, (_, i) => {
      if (i < currentRound || currentRound >= numPractices) return '80px';
      if (i === currentRound) return 'minmax(156px, 1fr)';
      return '72px';
    }),
  ].join(' ');


  // ── Save progress whenever rows change (if any work done) ──────────────────

  useEffect(() => {
    const anyDone = rows.some(r => r.practices.some(p => p.done));
    if (anyDone) onSaveRef.current?.({ rows });
  }, [rows]);

  // ── Completion celebration ─────────────────────────────────────────────────

  useEffect(() => {
    if (baseAllDone && !confettiFired) {
      setConfettiFired(true);
      setJustCompleted(true);
      const end = Date.now() + 3000;
      const tick = () => {
        confetti({
          particleCount: 4,
          startVelocity: 35,
          spread: 60,
          origin: { x: Math.random(), y: Math.random() * 0.5 },
          colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff'],
        });
        if (Date.now() < end) requestAnimationFrame(tick);
      };
      tick();
      setTimeout(() => setJustCompleted(false), 3500);
    }
  }, [baseAllDone, confettiFired]);

  // ── Celebration dismiss ────────────────────────────────────────────────────

  const dismissCelebration = useCallback(() => {
    setCelebrate(prev => prev ? { ...prev, hiding: true } : null);
    setTimeout(() => setCelebrate(null), 450);
  }, []);

  // ── Round-advance: reset hidden words + show celebration popup ─────────────

  useEffect(() => {
    if (prevRoundRef.current !== null && prevRoundRef.current !== currentRound) {
      setWordsHidden(false);
      if (currentRound > prevRoundRef.current && currentRound < numPractices) {
        const pool = [
          ...CELEBRATE_MSGS,
          ...(childName
            ? [{ emoji: '🤩', text: `Great job, ${childName}!` }, { emoji: '⭐', text: `Well done, ${childName}!` }]
            : []),
        ];
        const pick = pool[Math.floor(Math.random() * pool.length)];
        setCelebrate({ ...pick, hiding: false });
        clearTimeout(celebrateTimerRef.current);
        celebrateTimerRef.current = setTimeout(() => {
          setCelebrate(prev => prev ? { ...prev, hiding: true } : null);
          setTimeout(() => setCelebrate(null), 450);
        }, 3550);
      }
    }
    prevRoundRef.current = currentRound;
  }, [currentRound, numPractices, childName]);

  useEffect(() => () => clearTimeout(celebrateTimerRef.current), []);

  // ── Per-word celebrate auto-fade ───────────────────────────────────────────

  useEffect(() => {
    const stillCelebrating = rows.some(r => r.celebrated);
    if (!stillCelebrating) return;
    const t = setTimeout(() => {
      setRows(prev => prev.map(r => r.celebrated ? { ...r, celebrated: false } : r));
    }, 1500);
    return () => clearTimeout(t);
  }, [rows]);

  // ── Per-word celebration: chime + confetti the first time each word
  // is fully completed (all NUM_BASE practices marked done). Tracked by
  // word so we don't fire twice if the row's `celebrated` flag flickers.
  const celebratedWordsRef = useRef(new Set());
  useEffect(() => {
    rows.forEach((r) => {
      const allDone = r.practices.slice(0, NUM_BASE).every(p => p.done);
      if (!allDone) return;
      if (celebratedWordsRef.current.has(r.word)) return;
      celebratedWordsRef.current.add(r.word);
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
          gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          osc.start(t); osc.stop(t + 0.4);
        });
      } catch { /* AudioContext unavailable */ }
      confetti({
        particleCount: 80,
        spread: 65,
        origin: { y: 0.45 },
        colors: ['#a855f7', '#c084fc', '#6bcb77', '#ffd93d', '#4d96ff'],
      });
    });
  }, [rows]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const doRestart = () => {
    onSaveRef.current?.(null);
    celebratedWordsRef.current = new Set();
    setRows(makeInitialState(words));
    setWordsHidden(false);
    setJustCompleted(false);
    setConfettiFired(false);
  };

  // ── DEV-only: instant complete ─────────────────────────────────────────────
  const handleDevComplete = () => {
    setConfettiFired(false); // ensure the celebration fires on next render
    setRows(prev => prev.map(row => ({
      ...row,
      practices: row.practices.map((p, i) =>
        i < NUM_BASE ? { ...p, done: true, status: 'correct', value: row.word, attempts: 1 } : p
      ),
      celebrated: false,
    })));
  };

  const hasProgress = rows.some(r => r.practices.some(p => p.done));

  const updatePractice = useCallback((wordIdx, practiceIdx, patch) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== wordIdx) return r;
      const practices = r.practices.map((p, j) =>
        j === practiceIdx ? { ...p, ...patch } : p
      );
      return { ...r, practices };
    }));
  }, []);

  const handleChange = (wordIdx, practiceIdx, value) => {
    const row = rows[wordIdx];
    if (!row || row.practices[practiceIdx].done) return;
    if (isCorrect(value, row.word)) {
      setWordsHidden(false);
      setRows(prev => prev.map((r, i) => {
        if (i !== wordIdx) return r;
        const practices = r.practices.map((p, j) =>
          j === practiceIdx ? { ...p, value, done: true, status: 'success' } : p
        );
        const allThree = practices.every(p => p.done);
        return { ...r, practices, celebrated: allThree ? true : r.celebrated };
      }));
    } else {
      updatePractice(wordIdx, practiceIdx, { value, status: 'idle' });
    }
  };

  const handleSubmit = (wordIdx, practiceIdx) => {
    const row = rows[wordIdx];
    if (!row) return;
    const cell = row.practices[practiceIdx];
    if (cell.done) return;

    if (isCorrect(cell.value, row.word)) {
      setWordsHidden(false);

      setRows(prev => prev.map((r, i) => {
        if (i !== wordIdx) return r;
        const practices = r.practices.map((p, j) =>
          j === practiceIdx ? { ...p, done: true, status: 'success' } : p
        );
        const allThree = practices.every(p => p.done);
        return { ...r, practices, celebrated: allThree ? true : r.celebrated };
      }));
    } else {
      const next = cell.attempts + 1;
      // On a wrong answer we reveal the original word back to the child
      // immediately — both by un-hiding the column and by showing the
      // helper line under the input. Previous behaviour required two
      // wrong attempts before the hint appeared, which felt punishing
      // for the first round.
      setWordsHidden(false);
      updatePractice(wordIdx, practiceIdx, {
        attempts:   next,
        status:     'trying',
        revealHint: true,
      });
    }
  };

  const handleKeyDown = (e, wordIdx, practiceIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(wordIdx, practiceIdx);
    }
  };

  const handleInputFocus = (wordIdx) => {
    setWordsHidden(true);
    // Auto-play the target word so the child gets an audio cue the moment
    // they're ready to type. Browsers typically allow speech synthesis after
    // a user gesture (the click that focused the input counts), so this is
    // safe inside the focus handler.
    const row = rows[wordIdx];
    if (row?.word) speak(row.word);
  };

  const handleComplete = () => {
    onSaveRef.current?.(null);
    // WriteIt tracks per-practice attempts & a one-shot auto-reveal hint.
    // Roll up to a single per-word result for the credit framework:
    //   - correct:  every base practice marked done
    //   - attempts: worst (highest) attempts count across the base practices,
    //               capped at 2 to keep the framework's buckets aligned
    //               (1 = no struggle, ≥2 = needed multiple tries)
    //   - hintUsed: any base practice triggered the auto-reveal helper
    onComplete(rows.map(r => {
      const base = r.practices.slice(0, NUM_BASE);
      const correct  = base.every(p => p.done);
      const maxTries = base.reduce((m, p) => Math.max(m, Number(p.attempts) || 0), 0);
      const hintUsed = base.some(p => !!p.revealHint);
      // attempts counts how many tries it took: 1 means correct on the
      // first submission; ≥2 means a wrong answer happened along the way.
      const attempts = maxTries <= 1 ? 1 : 2;
      return { word: r.word, correct, attempts, hintUsed };
    }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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
              {baseAllDone && (
                <button className="game-header-btn" onClick={handleComplete}>✓ Done</button>
              )}
            </>
          }
        />
        <GameProgressStrip percent={(Math.min(currentRound, NUM_BASE) / NUM_BASE) * 100}>
          {Math.min(currentRound, NUM_BASE)} of {NUM_BASE} rounds done
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

      {/* Table */}
      <div className="wi-table-outer">
        <div className="wi-table">

          {/* Column headers */}
          <div className="wi-thead" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="wi-th wi-th--word">Word</div>
            {Array.from({ length: numPractices }, (_, i) => {
              if (i < currentRound || currentRound >= numPractices)
                return <div key={i} className="wi-th wi-th--done">{getCompletedLabel(i)}</div>;
              if (i === currentRound)
                return <div key={i} className="wi-th wi-th--active">{getPracticeLabel(i)}</div>;
              return <div key={i} className="wi-th wi-th--locked">P{i + 1}</div>;
            })}
          </div>

          {/* Word rows */}
          {rows.map((row, wordIdx) => {
            const allRowDone = row.practices.every(p => p.done);
            const wordFaded  = wordsHidden && !allRowDone;

            return (
              <div
                key={row.word}
                className={`wi-row${allRowDone ? ' wi-row--done' : ''}${row.celebrated ? ' wi-row--celebrate' : ''}`}
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

                {/* Practice cells */}
                {row.practices.map((cell, practiceIdx) => {
                  // Completed column
                  if (practiceIdx < currentRound || currentRound >= numPractices) {
                    return (
                      <div key={practiceIdx} className="wi-cell wi-cell--tick">
                        <span className="wi-tick">✓</span>
                      </div>
                    );
                  }

                  // Locked future column
                  if (practiceIdx > currentRound) {
                    return (
                      <div key={practiceIdx} className="wi-cell wi-cell--locked">
                        <span className="wi-lock-icon">🔒</span>
                      </div>
                    );
                  }

                  // Active column
                  const isDone      = cell.done;
                  const stateClass  =
                    isDone              ? ' wi-cell--success' :
                    cell.status === 'trying' ? ' wi-cell--retry' : '';

                  return (
                    <div key={practiceIdx} className={`wi-cell wi-cell--practice${stateClass}`}>
                      {cell.revealHint && !isDone && (
                        <div className="wi-helper">
                          Here it is — give it another go 💪
                          <strong className="wi-helper-word">{row.word}</strong>
                        </div>
                      )}

                      <div className="wi-input-wrap">
                        <input
                          ref={(el) => { inputRefs.current[`${wordIdx}-${practiceIdx}`] = el; }}
                          type="text"
                          className="wi-input"
                          value={cell.value}
                          onChange={(e) => handleChange(wordIdx, practiceIdx, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, wordIdx, practiceIdx)}
                          onFocus={() => handleInputFocus(wordIdx)}
                          disabled={isDone}
                          placeholder="Type here…"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck="false"
                        />
                        {!isDone && (
                          <button
                            className="wi-check-btn wi-no-print"
                            onClick={() => handleSubmit(wordIdx, practiceIdx)}
                          >
                            Check
                          </button>
                        )}
                      </div>

                      {isDone && <span className="wi-success-badge wi-no-print">✨</span>}
                      {cell.status === 'trying' && !isDone && cell.attempts === 1 && (
                        <p className="wi-feedback wi-feedback--retry">Try again!</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Extra-practice option removed — child finishes after the base
          three rounds and lands on the results / Done flow. */}

      {/* Round-complete celebration popup */}
      {celebrate && (
        <div className="wi-celebrate-overlay" onClick={dismissCelebration}>
          <div
            className={`wi-celebrate-popup${celebrate.hiding ? ' wi-celebrate-popup--hiding' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            <button className="wi-celebrate-close" onClick={dismissCelebration} aria-label="Close">✕</button>
            <div className="wi-celebrate-emoji">{celebrate.emoji}</div>
            <p className="wi-celebrate-msg">{celebrate.text}</p>
          </div>
        </div>
      )}

      {/* Brief completion celebration overlay */}
      {justCompleted && (
        <div className="wi-complete wi-no-print" role="status">
          <span className="wi-complete-emoji">⭐</span>
          <span>You're a spelling star! ⭐</span>
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
