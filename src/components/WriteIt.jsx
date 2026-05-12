import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import RestartButton from './RestartButton';
import './WriteIt.css';
import './WordListHub.css';
import { speakWord as speak } from '../utils/speech';
import DEFINITIONS from '../data/definitions';
import { isSafeDefinition } from '../utils/definitionSafety';


// ── Word info cache + fetch ───────────────────────────────────────────────────

const wordInfoCache = {};

function pickDefForAge(meanings, userAge) {
  const ORDER = { noun: 0, verb: 1 };
  const sorted = [...meanings].sort((a, b) => (ORDER[a.partOfSpeech] ?? 2) - (ORDER[b.partOfSpeech] ?? 2));
  for (const m of sorted) {
    for (const d of m.definitions || []) {
      const t = d.definition;
      if (!t || t.startsWith('(') || t.length < 5) continue;
      if (!isSafeDefinition(t)) continue;
      if (userAge < 7  && t.length > 80)  return t.slice(0, 77) + '…';
      if (userAge < 10 && t.length > 160) return t.slice(0, 157) + '…';
      return t;
    }
  }
  return null;
}

async function fetchWordInfo(word, userAge = 7) {
  const key = word.toLowerCase();
  if (wordInfoCache[key]) return wordInfoCache[key];
  const local = DEFINITIONS[key];
  if (local) {
    const r = { definition: local, phonetic: null, partOfSpeech: null, example: null };
    wordInfoCache[key] = r;
    return r;
  }
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
    if (!res.ok) return { definition: null, phonetic: null, partOfSpeech: null, example: null };
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return { definition: null, phonetic: null, partOfSpeech: null, example: null };
    const phonetic     = data[0].phonetic || data[0].phonetics?.find(p => p.text)?.text || null;
    const allMeanings  = data.flatMap(e => e?.meanings || []);
    const definition   = pickDefForAge(allMeanings, userAge);
    const partOfSpeech = allMeanings[0]?.partOfSpeech || null;
    let example = null;
    outer: for (const m of allMeanings) {
      for (const d of m.definitions || []) {
        if (d.example && isSafeDefinition(d.example)) { example = d.example; break outer; }
      }
    }
    const r = { definition, phonetic, partOfSpeech, example };
    wordInfoCache[key] = r;
    return r;
  } catch {
    return { definition: null, phonetic: null, partOfSpeech: null, example: null };
  }
}

// ── Word detail modal ─────────────────────────────────────────────────────────

function WordDetailModal({ word, userAge, onClose }) {
  const [info, setInfo] = useState({ loading: true, definition: null, phonetic: null, partOfSpeech: null, example: null });

  useEffect(() => {
    let cancelled = false;
    setInfo({ loading: true, definition: null, phonetic: null, partOfSpeech: null, example: null });
    fetchWordInfo(word, userAge).then(r => { if (!cancelled) setInfo({ loading: false, ...r }); });
    return () => { cancelled = true; };
  }, [word, userAge]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const ACCENT = '#c77dff';

  return (
    <div className="hub-word-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="hub-word-modal" onClick={e => e.stopPropagation()}>
        <button className="hub-word-modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="hub-word-modal-header" style={{ borderBottomColor: ACCENT }}>
          <h2 className="hub-word-modal-word" style={{ color: ACCENT }}>{word}</h2>
          {!info.loading && info.phonetic     && <p className="hub-word-modal-phonetic">{info.phonetic}</p>}
          {!info.loading && info.partOfSpeech && <span className="hub-word-modal-pos">{info.partOfSpeech}</span>}
        </div>
        <div className="hub-word-modal-actions">
          <button className="hub-word-modal-speak" onClick={() => speak(word)}>🔊 Hear it</button>
          <button className="hub-word-modal-teacher" disabled title="Coming in a future update">🎤 Teacher's Recording</button>
        </div>
        <div className="hub-word-modal-body">
          {info.loading ? (
            <p className="hub-word-modal-loading">Looking it up…</p>
          ) : info.definition ? (
            <>
              <p className="hub-word-modal-def">{info.definition}</p>
              {info.example && (
                <p className="hub-word-modal-example">
                  <em className="hub-word-modal-example-label">e.g. </em>"{info.example}"
                </p>
              )}
            </>
          ) : (
            <p className="hub-word-modal-nodef">No definition available</p>
          )}
        </div>
      </div>
    </div>
  );
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

  // Pre-seed definition cache with any list-provided definitions
  wordObjects.forEach(({ word, definition }) => {
    const key = word.toLowerCase();
    if (!wordInfoCache[key] && definition) {
      wordInfoCache[key] = { definition, phonetic: null, partOfSpeech: null, example: null };
    }
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
      if (i === currentRound) return 'minmax(90px, 0.6fr)';
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

      {/* Add Practice button — appears once all base practices complete */}
      {baseAllDone && (
        <div className="wi-add-practice-wrap wi-no-print">
          <button className="wi-add-practice-btn" onClick={addPractice}>
            + Add Practice
          </button>
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

      {/* Word definition modal */}
      {activeWord && (
        <WordDetailModal
          word={activeWord}
          userAge={7}
          onClose={() => setActiveWord(null)}
        />
      )}
    </div>
  );
}

export default WriteIt;
