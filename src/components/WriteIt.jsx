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

const PRACTICE_LABELS = ['1st Practice', '2nd Practice', '3rd Practice'];
const NUM_PRACTICES   = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeInitialState(words) {
  return words.map(w => ({
    word:        w,
    practices:   Array.from({ length: NUM_PRACTICES }, () => ({
      value:       '',
      done:        false,
      attempts:    0,    // failed attempts in this cell so far
      revealHint:  false, // show the answer above the input after 2 misses
      status:      'idle', // idle | trying | success
    })),
    revealed:    false,    // manual show-word toggle for 2nd/3rd practice
    celebrated:  false,    // small per-row celebration shown
  }));
}

function isCorrect(input, target) {
  return input.trim().toLowerCase() === target.trim().toLowerCase();
}

// ── Component ────────────────────────────────────────────────────────────────

function WriteIt({ words, childName = '', dyslexiaMode = false, onComplete, onExit }) {
  const [rows, setRows] = useState(() => makeInitialState(words));
  const [allDone, setAllDone] = useState(false);
  const inputRefs = useRef({});

  // Warm up speech voices (Chrome populates voices async)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    pickUkVoice();
    const onChange = () => { cachedUkVoice = null; pickUkVoice(); };
    window.speechSynthesis.addEventListener?.('voiceschanged', onChange);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', onChange);
  }, []);

  // Detect full-list completion → fire confetti, fade celebration
  useEffect(() => {
    const everyDone = rows.every(r => r.practices.every(p => p.done));
    if (everyDone && !allDone) {
      setAllDone(true);
      const end = Date.now() + 3000;
      const tick = () => {
        confetti({
          particleCount: 4,
          startVelocity: 35,
          spread: 60,
          origin: { x: Math.random(), y: Math.random() * 0.5 },
          colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f43'],
        });
        if (Date.now() < end) requestAnimationFrame(tick);
      };
      tick();
    }
  }, [rows, allDone]);

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
      updatePractice(wordIdx, practiceIdx, {
        done:   true,
        status: 'success',
      });

      // Check whether all 3 practices for this word are done — small reward
      setRows(prev => prev.map((r, i) => {
        if (i !== wordIdx) return r;
        const practices = r.practices.map((p, j) =>
          j === practiceIdx ? { ...p, done: true, status: 'success' } : p
        );
        const allThree = practices.every(p => p.done);
        return { ...r, practices, celebrated: allThree ? true : r.celebrated };
      }));

      // Auto-advance focus to the next practice cell for the same word
      setTimeout(() => {
        if (practiceIdx < NUM_PRACTICES - 1) {
          inputRefs.current[`${wordIdx}-${practiceIdx + 1}`]?.focus();
        }
      }, 200);
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

  const toggleReveal = (wordIdx) => {
    setRows(prev => prev.map((r, i) =>
      i === wordIdx ? { ...r, revealed: !r.revealed } : r
    ));
  };

  // ── Per-word celebration auto-fade ─────────────────────────────────────────

  useEffect(() => {
    const stillCelebrating = rows.some(r => r.celebrated);
    if (!stillCelebrating) return;
    const t = setTimeout(() => {
      setRows(prev => prev.map(r => r.celebrated ? { ...r, celebrated: false } : r));
    }, 1500);
    return () => clearTimeout(t);
  }, [rows]);

  // Determine the active practice index for a word (first not-done, else 3 = all done)
  const activeIndex = (row) =>
    row.practices.findIndex(p => !p.done) === -1 ? NUM_PRACTICES : row.practices.findIndex(p => !p.done);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`wi-wrap${dyslexiaMode ? ' wi-wrap--es' : ''}`}>
      {/* On-screen header */}
      <div className="wi-topbar wi-no-print">
        <button className="wi-back" onClick={onExit}>← Hub</button>
        <h2 className="wi-title">Write It</h2>
        <div className="wi-topbar-actions">
          <button
            className="wi-print-btn"
            onClick={() => window.print()}
            title="Print as a worksheet"
          >
            🖨 Print
          </button>
          {allDone && (
            <button className="wi-done-btn" onClick={() => onComplete(rows.map(r => ({ word: r.word, correct: true })))}>
              Back to Hub ▶
            </button>
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

      {/* Method banner */}
      <div className="wi-steps wi-no-print">
        {STEPS.map((s) => (
          <div key={s.label} className="wi-step">
            <span className="wi-step-icon">{s.icon}</span>
            <span className="wi-step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Column headers */}
      <div className="wi-table">
        <div className="wi-thead">
          <div className="wi-th wi-th--word">Word</div>
          {PRACTICE_LABELS.map((label) => (
            <div key={label} className="wi-th">{label}</div>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row, wordIdx) => {
          const active        = activeIndex(row);
          const allWordDone   = active === NUM_PRACTICES;
          const showWordChip  = active === 0 || row.revealed || allWordDone;

          return (
            <div
              key={row.word}
              className={`wi-row${allWordDone ? ' wi-row--done' : ''}${row.celebrated ? ' wi-row--celebrate' : ''}`}
            >
              {row.celebrated && (
                <div className="wi-row-burst" aria-hidden="true">⭐ ✨ 🌟 ✨ ⭐</div>
              )}

              {/* Word column */}
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
                  <span className={`wi-word-text${showWordChip ? '' : ' wi-word-text--hidden'}`}>
                    {row.word}
                  </span>
                </div>
                {active > 0 && !allWordDone && (
                  <button
                    className="wi-reveal-btn wi-no-print"
                    onClick={() => toggleReveal(wordIdx)}
                  >
                    {row.revealed ? 'Hide word' : 'Show word'}
                  </button>
                )}
              </div>

              {/* Practice cells */}
              {row.practices.map((cell, practiceIdx) => {
                const locked  = practiceIdx > active;
                const isDone  = cell.done;
                const stateClass =
                  isDone           ? 'wi-cell--success' :
                  cell.status === 'trying' ? 'wi-cell--retry'  : '';

                return (
                  <div
                    key={practiceIdx}
                    className={`wi-cell wi-cell--practice ${stateClass}${locked ? ' wi-cell--locked' : ''}`}
                  >
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
                        disabled={locked || isDone}
                        placeholder={locked ? '🔒' : 'Type here…'}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                      />
                      {!locked && !isDone && (
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

      {/* Full-list completion message */}
      {allDone && (
        <div className="wi-complete wi-no-print" role="status">
          <span className="wi-complete-emoji">⭐</span>
          <span>You're a spelling star! ⭐</span>
        </div>
      )}
    </div>
  );
}

export default WriteIt;
