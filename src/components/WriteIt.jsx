import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import './WriteIt.css';

// ── Speech (en-GB) ───────────────────────────────────────────────────────────

let cachedUkVoice = null;
function pickUkVoice() {
  if (cachedUkVoice) return cachedUkVoice;
  const voices = window.speechSynthesis?.getVoices?.() || [];
  cachedUkVoice =
    voices.find(v => v.lang === 'en-GB') ||
    voices.find(v => v.lang?.startsWith('en-GB')) ||
    null;
  return cachedUkVoice;
}

function speak(word) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-GB';
  u.rate = 0.85;
  const v = pickUkVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { icon: '👀', label: 'Look' },
  { icon: '🔊', label: 'Say' },
  { icon: '🫣', label: 'Cover' },
  { icon: '✏️', label: 'Write' },
  { icon: '✅', label: 'Check' },
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
  childName = '',
  dyslexiaMode = false,
  savedProgress = null,
  onSaveProgress,
  onComplete,
  onExit,
}) {
  const [rows, setRows] = useState(() => savedProgress?.rows ?? makeInitialState(words));
  const [wordsHidden,     setWordsHidden]     = useState(false);
  const [confirmRestart,  setConfirmRestart]  = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [celebrate, setCelebrate] = useState(null); // { emoji, text, hiding }
  const [confettiFired, setConfettiFired] = useState(() => {
    if (!savedProgress?.rows) return false;
    return savedProgress.rows.every(r =>
      r.practices.slice(0, NUM_BASE).every(p => p.done)
    );
  });

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
      if (i === currentRound) return 'minmax(150px, 1fr)';
      return '72px';
    }),
  ].join(' ');

  // ── Warm up voices ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    pickUkVoice();
    const onChange = () => { cachedUkVoice = null; pickUkVoice(); };
    window.speechSynthesis.addEventListener?.('voiceschanged', onChange);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', onChange);
  }, []);

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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const doRestart = () => {
    onSaveRef.current?.(null);
    setRows(makeInitialState(words));
    setWordsHidden(false);
    setJustCompleted(false);
    setConfettiFired(false);
  };

  const handleRestartClick = () => {
    const hasProgress = rows.some(r => r.practices.some(p => p.done));
    if (hasProgress) setConfirmRestart(true);
    else doRestart();
  };

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
    updatePractice(wordIdx, practiceIdx, { value, status: 'idle' });
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
      updatePractice(wordIdx, practiceIdx, {
        attempts:   next,
        status:     'trying',
        revealHint: next >= 2,
      });
    }
  };

  const handleKeyDown = (e, wordIdx, practiceIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(wordIdx, practiceIdx);
    }
  };

  const handleInputFocus = () => {
    setWordsHidden(true);
  };

  const addPractice = () => {
    setRows(prev => prev.map(r => ({
      ...r,
      practices: [
        ...r.practices,
        { value: '', done: false, attempts: 0, revealHint: false, status: 'idle' },
      ],
    })));
  };

  const handleComplete = () => {
    onSaveRef.current?.(null);
    onComplete(rows.map(r => ({ word: r.word, correct: r.practices.slice(0, NUM_BASE).every(p => p.done) })));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`wi-wrap${dyslexiaMode ? ' wi-wrap--es' : ''}`}>

      {/* Screen header */}
      <div className="wi-topbar wi-no-print">
        <button className="wi-back" onClick={onExit}>← Hub</button>
        <h2 className="wi-title">Write It</h2>
        <div className="wi-topbar-actions">
          <button className="wi-restart-btn" onClick={handleRestartClick} title="Restart">↺ Restart</button>
          <button className="wi-print-btn" onClick={() => window.print()} title="Print as worksheet">🖨 Print</button>
          {baseAllDone && (
            <button className="wi-done-btn" onClick={handleComplete}>Back to Hub ▶</button>
          )}
        </div>
      </div>

      {/* Print-only header */}
      <div className="wi-print-header">
        <div className="wi-print-title">🎯 Spellify · Write It</div>
        {childName && <div className="wi-print-name">Name: {childName}</div>}
        <p className="wi-print-instructions">
          Look at the word, say it, cover it, write it, and check it three times.
        </p>
      </div>

      {/* Method banner — no boxes, just floating steps */}
      <div className="wi-steps wi-no-print">
        {STEPS.map((s) => (
          <div key={s.label} className="wi-step">
            <span className="wi-step-icon">{s.icon}</span>
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
                    <button
                      className="wi-speaker wi-no-print"
                      onClick={() => speak(row.word)}
                      title="Hear this word"
                      aria-label={`Hear ${row.word}`}
                    >
                      🔊
                    </button>
                    <button
                      className={`wi-eye wi-no-print${wordsHidden ? ' wi-eye--hidden' : ''}`}
                      onClick={() => setWordsHidden(h => !h)}
                      title={wordsHidden ? 'Show words' : 'Hide words'}
                      aria-label={wordsHidden ? 'Show words' : 'Hide words'}
                    >
                      👁
                    </button>
                    <span className={`wi-word-text${wordFaded ? ' wi-word-text--faded' : ''}`}>
                      {row.word}
                    </span>
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
                          onFocus={handleInputFocus}
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

      {/* Add Practice button — appears once all base practices complete */}
      {baseAllDone && (
        <div className="wi-add-practice-wrap wi-no-print">
          <button className="wi-add-practice-btn" onClick={addPractice}>
            + Add Practice
          </button>
        </div>
      )}

      {/* Restart confirmation */}
      {confirmRestart && (
        <div className="exit-overlay" onClick={() => setConfirmRestart(false)}>
          <div className="exit-modal" onClick={e => e.stopPropagation()}>
            <div className="exit-modal-icon">↺</div>
            <h2 className="exit-modal-title">Restart?</h2>
            <p className="exit-modal-body">You'll lose your progress so far.</p>
            <div className="exit-modal-btns">
              <button className="exit-btn exit-btn--cancel" onClick={() => setConfirmRestart(false)}>Keep going</button>
              <button className="exit-btn exit-btn--confirm" onClick={() => { setConfirmRestart(false); doRestart(); }}>Yes, restart</button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}

export default WriteIt;
