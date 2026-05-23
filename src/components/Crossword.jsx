import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { generateCrossword, wordCells } from '../utils/crosswordEngine';
import { getClueSync } from '../utils/clueResolver';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import RestartButton from './RestartButton';
import './Crossword.css';
import { speakWord } from '../utils/speech';

function playWordChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[523, 0], [659, 0.1], [784, 0.2]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  } catch { /* AudioContext unavailable */ }
}

function fireWordConfetti() {
  confetti({
    particleCount: 55,
    spread: 55,
    origin: { y: 0.45 },
    colors: ['#6bcb77', '#4d96ff', '#ffd93d', '#c77dff', '#ff6b6b'],
  });
}

// ── Config ───────────────────────────────────────────────────────────────────

function getMaxWords(userAge, difficulty) {
  const base = userAge < 7 ? 6 : userAge < 10 ? 10 : 15;
  if (difficulty === 'easy') return Math.max(4, base - 2);
  if (difficulty === 'hard') return Math.min(50, base + 3);
  return base;
}

function getMaxHints(userAge) {
  if (userAge < 7)  return 3;
  if (userAge < 10) return 2;
  return 1;
}

// Note: the previous async dictionary-API validator (with pickKidFriendly
// + isSafeDefinition) has been removed. Word eligibility is now decided
// synchronously by getClueSync via the `activityAvailability` gate AND
// the in-game pre-filter (see useEffect below). If the API path returns
// later for non-curriculum custom lists, re-introduce the helpers from
// the file's git history.

function ageAwareDefinition(def, userAge) {
  if (!def) return def;
  if (userAge < 7  && def.length > 70)  return def.slice(0, 67) + '…';
  if (userAge < 10 && def.length > 130) return def.slice(0, 127) + '…';
  return def;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellKey(row, col) { return `${row},${col}`; }

function getWordsAtCell(layout, row, col) {
  return layout.placedWords.filter(pw => {
    const cells = wordCells(pw.word, pw.row, pw.col, pw.direction);
    return cells.some(c => c.row === row && c.col === col);
  });
}

function findWordContaining(layout, row, col, direction) {
  return layout.placedWords.find(pw => {
    if (pw.direction !== direction) return false;
    const cells = wordCells(pw.word, pw.row, pw.col, pw.direction);
    return cells.some(c => c.row === row && c.col === col);
  });
}

function isWordComplete(pw, filled) {
  return wordCells(pw.word, pw.row, pw.col, pw.direction).every(
    (c, i) => filled.get(cellKey(c.row, c.col))?.letter === pw.word[i]
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function Crossword({ words, userAge = 8, difficulty = 'medium', onComplete, onExit, savedProgress = null, onSaveProgress }) {
  const maxWords = getMaxWords(userAge, difficulty);
  const maxHints = getMaxHints(userAge);

  // Validation runs once per word list — null until done.
  const [validation,     setValidation]     = useState(null);
  const [layout,         setLayout]         = useState(null);
  const [definitions,    setDefinitions]    = useState(new Map());
  const [filled,         setFilled]         = useState(new Map());
  const [selectedCell,   setSelectedCell]   = useState(null);
  const [selDir,         setSelDir]         = useState('across');
  const [hints,          setHints]          = useState(new Map());
  const [hintsUsed,      setHintsUsed]      = useState(0);
  const [revealedWords,  setRevealedWords]  = useState(new Set());
  // Retry phase state — after the main grid is solved, any words that
  // the child revealed via "Reveal Answer" get a single follow-up
  // attempt. Each revealed word is presented in turn with its clue;
  // the child types the word and we record correct/incorrect.
  //
  //   retryIndex      walks the revealed-words list (-1 = retry phase
  //                   not yet active; revealedList.length = finished)
  //   retryResults    Map<wordId, boolean>  true = retried correctly
  const [retryIndex,     setRetryIndex]     = useState(-1);
  const [retryInput,     setRetryInput]     = useState('');
  const [retryResults,   setRetryResults]   = useState(() => new Map());
  const [retryFeedback,  setRetryFeedback]  = useState(null); // 'correct' | 'wrong' | null
  const [startTime]      = useState(Date.now);
  const [endTime,        setEndTime]        = useState(null);
  const [wordsVisible,   setWordsVisible]   = useState(true);
  const [listSide,       setListSide]       = useState('left');
  const containerRef     = useRef(null);

  // Pre-filter the session word list to clue-available words only — every
  // word in the crossword needs a kid-friendly clue, otherwise the
  // puzzle's clue boxes would be blank. We use the sync resolver
  // (DEFINITIONS + word database, no API) so puzzle generation is
  // deterministic and instant. The availability gate
  // (activityAvailability.js) uses the same predicate to lock the card
  // when fewer than 6 words qualify, so by the time we reach this
  // effect we should always have ≥ 6 clue-words.
  useEffect(() => {
    let cancelled = false;
    setValidation(null);
    setLayout(null);
    (async () => {
      const approxYear = userAge <= 7 ? 2 : 4;
      const clueLookup = new Map();
      const validList  = [];
      const skipped    = [];
      for (const w of words) {
        const clue = getClueSync(w, approxYear);
        if (typeof clue === 'string' && clue.trim().length > 0) {
          clueLookup.set(w.toLowerCase(), clue);
          validList.push(w);
        } else {
          skipped.push(w);
        }
      }
      if (cancelled) return;

      const built = generateCrossword(validList, maxWords);
      const defs  = new Map();
      if (built) {
        for (const pw of built.placedWords) {
          const def = clueLookup.get(pw.word.toLowerCase());
          if (def) defs.set(pw.word, ageAwareDefinition(def, userAge));
        }
      }
      setValidation({ skipped });
      setLayout(built);
      setDefinitions(defs);
      // Restore mid-session snapshot if one exists.
      // Flag prevents the celebration effect firing for already-completed words.
      if (savedProgress?.filled) {
        restoringRef.current = true;
        setFilled(new Map(savedProgress.filled));
        setHints(new Map(savedProgress.hints ?? []));
        setHintsUsed(savedProgress.hintsUsed ?? 0);
        setRevealedWords(new Set(savedProgress.revealedWords ?? []));
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, maxWords, userAge]);

  useEffect(() => { containerRef.current?.focus(); }, [layout]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedWord = layout
    ? findWordContaining(layout, selectedCell?.row, selectedCell?.col, selDir) ||
      (selectedCell ? getWordsAtCell(layout, selectedCell.row, selectedCell.col)[0] : null)
    : null;

  const selectedWordCells = selectedWord
    ? wordCells(selectedWord.word, selectedWord.row, selectedWord.col, selectedWord.direction)
    : [];

  const completedWords = layout
    ? layout.placedWords.filter(pw => isWordComplete(pw, filled)).length
    : 0;

  const isGameComplete = layout && completedWords === layout.placedWords.length;

  const lockedCellKeys = useMemo(() => {
    if (!layout) return new Set();
    const s = new Set();
    for (const pw of layout.placedWords) {
      if (isWordComplete(pw, filled)) {
        for (const c of wordCells(pw.word, pw.row, pw.col, pw.direction)) {
          s.add(cellKey(c.row, c.col));
        }
      }
    }
    return s;
  }, [layout, filled]);

  useEffect(() => {
    if (isGameComplete && !endTime) setEndTime(Date.now());
  }, [isGameComplete, endTime]);

  // ── Crossword completion fanfare ──────────────────────────────────────────
  const cwFanfareFiredRef = useRef(false);
  useEffect(() => {
    if (!isGameComplete || cwFanfareFiredRef.current) return;
    cwFanfareFiredRef.current = true;

    // Fanfare sound — ascending arpeggio + sustained chord + sparkle tail
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const seq = [
        { f: 523.25, t: 0.00, d: 0.30, v: 0.18 },
        { f: 659.25, t: 0.12, d: 0.30, v: 0.18 },
        { f: 783.99, t: 0.24, d: 0.30, v: 0.18 },
        { f: 1046.5, t: 0.38, d: 0.80, v: 0.22 },
        { f: 1318.5, t: 0.46, d: 0.65, v: 0.15 },
        { f: 1568.0, t: 0.56, d: 0.25, v: 0.09 },
        { f: 2093.0, t: 0.66, d: 0.25, v: 0.09 },
        { f: 2637.0, t: 0.76, d: 0.30, v: 0.07 },
      ];
      seq.forEach(({ f, t, d, v }) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'triangle'; osc.frequency.value = f;
        const at = ctx.currentTime + t;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(v, at + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, at + d);
        osc.start(at); osc.stop(at + d + 0.05);
      });
    } catch { /* AudioContext unavailable */ }

    // Confetti — 3 waves from different origins
    confetti({ particleCount: 130, spread: 85, origin: { x: 0.5, y: 0.4 },
      colors: ['#FFD700', '#ec4899', '#c77dff', '#6bcb77', '#60a5fa'] });
    setTimeout(() => confetti({ particleCount: 75, angle: 60, spread: 60,
      origin: { x: 0, y: 0.65 }, colors: ['#fbbf24', '#f9a8d4', '#a78bfa'] }), 250);
    setTimeout(() => confetti({ particleCount: 75, angle: 120, spread: 60,
      origin: { x: 1, y: 0.65 }, colors: ['#fbbf24', '#f9a8d4', '#a78bfa'] }), 500);
  }, [isGameComplete]);

  // Save progress whenever the board changes and at least one word is correct.
  // Wipe the snapshot when the game finishes.
  useEffect(() => {
    if (!layout || !onSaveProgress) return;
    if (isGameComplete) {
      onSaveProgress(null);
      return;
    }
    const doneCount = layout.placedWords.filter(pw => isWordComplete(pw, filled)).length;
    if (doneCount === 0) return;
    onSaveProgress({
      filled:       Array.from(filled.entries()),
      hints:        Array.from(hints.entries()),
      hintsUsed,
      revealedWords: Array.from(revealedWords),
    });
  }, [filled, layout, isGameComplete, onSaveProgress, hints, hintsUsed, revealedWords]);

  // Celebrate each word the moment it becomes complete.
  // restoringRef is set true when restoring saved progress so the initial
  // batch of already-complete words does NOT trigger celebration.
  const prevCompletedRef = useRef(new Set());
  const restoringRef     = useRef(false);
  useEffect(() => {
    if (!layout) return;
    const nowComplete = new Set(
      layout.placedWords.filter(pw => isWordComplete(pw, filled)).map(pw => pw.id)
    );
    const justCompleted = [...nowComplete].filter(id => !prevCompletedRef.current.has(id));
    if (justCompleted.length > 0 && !isGameComplete && !restoringRef.current) {
      playWordChime();
      fireWordConfetti();
    }
    restoringRef.current   = false;
    prevCompletedRef.current = nowComplete;
  }, [filled, layout, isGameComplete]);

  // Word list — shuffled once per layout so order doesn't reveal grid positions
  const cwWords = useMemo(() => {
    if (!layout) return [];
    const arr = [...layout.placedWords];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // ── Interaction ────────────────────────────────────────────────────────────

  const handleCellClick = useCallback((row, col) => {
    if (!layout) return;
    const wordsHere = getWordsAtCell(layout, row, col);
    if (!wordsHere.length) return;
    if (wordsHere.every(pw => isWordComplete(pw, filled))) return;
    if (selectedCell?.row === row && selectedCell?.col === col) {
      const other = selDir === 'across' ? 'down' : 'across';
      if (wordsHere.some(pw => pw.direction === other)) setSelDir(other);
    } else {
      setSelectedCell({ row, col });
      const hasCurrentDir = wordsHere.some(pw => pw.direction === selDir);
      if (!hasCurrentDir) setSelDir(wordsHere[0].direction);
    }
  }, [layout, selectedCell, selDir, filled]);

  const advanceCell = useCallback((word, currentRow, currentCol) => {
    const cells = wordCells(word.word, word.row, word.col, word.direction);
    const idx = cells.findIndex(c => c.row === currentRow && c.col === currentCol);
    for (let i = idx + 1; i < cells.length; i++) {
      if (!filled.has(cellKey(cells[i].row, cells[i].col))) {
        setSelectedCell(cells[i]);
        return;
      }
    }
    if (idx + 1 < cells.length) setSelectedCell(cells[idx + 1]);
  }, [filled]);

  const retreatCell = useCallback((word, currentRow, currentCol) => {
    const cells = wordCells(word.word, word.row, word.col, word.direction);
    const idx = cells.findIndex(c => c.row === currentRow && c.col === currentCol);
    if (idx > 0) setSelectedCell(cells[idx - 1]);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (!selectedCell || !layout) return;
    const word = selectedWord;

    if (e.key === 'Tab') {
      e.preventDefault();
      const allWords  = layout.placedWords;
      const currentIdx = selectedWord ? allWords.indexOf(selectedWord) : -1;
      const next = allWords[(currentIdx + 1) % allWords.length];
      const firstCell = wordCells(next.word, next.row, next.col, next.direction)[0];
      setSelectedCell(firstCell);
      setSelDir(next.direction);
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (selectedWord && isWordComplete(selectedWord, filled)) return;
      const key = cellKey(selectedCell.row, selectedCell.col);
      if (filled.has(key) && !filled.get(key).isHint) {
        setFilled(prev => { const m = new Map(prev); m.delete(key); return m; });
      } else if (word) {
        retreatCell(word, selectedCell.row, selectedCell.col);
        const cells = wordCells(word.word, word.row, word.col, word.direction);
        const idx = cells.findIndex(c => c.row === selectedCell.row && c.col === selectedCell.col);
        if (idx > 0) {
          const prevCell = cells[idx - 1];
          const prevKey  = cellKey(prevCell.row, prevCell.col);
          if (!filled.get(prevKey)?.isHint) {
            setFilled(m => { const n = new Map(m); n.delete(prevKey); return n; });
          }
        }
      }
      return;
    }

    if (e.key === 'ArrowRight') { e.preventDefault(); setSelDir('across'); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSelDir('down');   return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setSelDir('across'); if (word) retreatCell(word, selectedCell.row, selectedCell.col); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setSelDir('down');   if (word) retreatCell(word, selectedCell.row, selectedCell.col); return; }

    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      if (selectedWord && isWordComplete(selectedWord, filled)) return;
      const letter = e.key.toUpperCase();
      const key    = cellKey(selectedCell.row, selectedCell.col);
      if (filled.get(key)?.isHint) return;
      setFilled(prev => new Map(prev).set(key, { letter, isHint: false }));
      if (word) advanceCell(word, selectedCell.row, selectedCell.col);
    }
  }, [selectedCell, selectedWord, layout, filled, advanceCell, retreatCell]);

  // ── Hints ──────────────────────────────────────────────────────────────────

  const applyHint = (wordId) => {
    const pw = layout?.placedWords.find(p => p.id === wordId);
    if (!pw) return;
    const level = (hints.get(wordId) || 0) + 1;
    if (level > maxHints) return;
    const cells = wordCells(pw.word, pw.row, pw.col, pw.direction);
    setHints(prev => new Map(prev).set(wordId, level));
    setHintsUsed(n => n + 1);
    if (level === 1) {
      const { row, col } = cells[0];
      setFilled(prev => new Map(prev).set(cellKey(row, col), { letter: pw.word[0], isHint: true }));
    } else if (level === 2) {
      const last = cells[cells.length - 1];
      setFilled(prev => new Map(prev)
        .set(cellKey(cells[0].row, cells[0].col), { letter: pw.word[0], isHint: true })
        .set(cellKey(last.row, last.col),          { letter: pw.word[pw.word.length - 1], isHint: true })
      );
    } else {
      setFilled(prev => {
        const m = new Map(prev);
        cells.forEach((c, i) => m.set(cellKey(c.row, c.col), { letter: pw.word[i], isHint: true }));
        return m;
      });
    }
  };

  const revealAnswer = (wordId) => {
    const pw = layout?.placedWords.find(p => p.id === wordId);
    if (!pw) return;
    const cells = wordCells(pw.word, pw.row, pw.col, pw.direction);
    setFilled(prev => {
      const m = new Map(prev);
      cells.forEach((c, i) => m.set(cellKey(c.row, c.col), { letter: pw.word[i], isHint: true }));
      return m;
    });
    setRevealedWords(prev => new Set(prev).add(wordId));
  };

  // Reset all puzzle state — used by both the "Try Again" button on the
  // completion screen and the shared RestartButton in the header.
  const resetPuzzle = () => {
    onSaveProgress?.(null);
    setFilled(new Map());
    setHints(new Map());
    setHintsUsed(0);
    setSelectedCell(null);
    setEndTime(null);
    setRevealedWords(new Set());
  };

  const restartHasProgress = filled.size > 0 || hintsUsed > 0;

  // ── Loading & no-layout states ────────────────────────────────────────────

  const topbar = (rightSlot = null) => (
    <GameHeader
      title="Crossword"
      onExit={onExit}
      rightSlot={rightSlot ?? <RestartButton hasProgress={restartHasProgress} onRestart={resetPuzzle} />}
    />
  );

  if (validation === null) {
    return (
      <div className="cw-wrap">
        {topbar()}
        <p className="cw-loading">📖 Checking the dictionary…</p>
      </div>
    );
  }

  if (!layout) {
    const skipped = validation?.skipped ?? [];
    return (
      <div className="cw-wrap">
        {topbar()}
        <p className="cw-error">
          Couldn't build a crossword — need at least 2 dictionary words.
        </p>
        {skipped.length > 0 && (
          <p className="cw-error-detail">
            Skipped: {skipped.join(', ')}
          </p>
        )}
      </div>
    );
  }

  // ── Retry phase: one more attempt for each revealed word ─────────────
  //
  // When the main grid is fully complete, before showing the celebration
  // screen we walk the list of words the child revealed via "Reveal
  // Answer" and give each one a single follow-up attempt. The clue is
  // shown; the child types the word; correct/wrong is captured and
  // folded into the final results sent to the mastery engine.

  const revealedList = layout
    ? layout.placedWords.filter(pw => revealedWords.has(pw.id))
    : [];

  // Auto-activate the retry phase the first time we land on the
  // completion screen with at least one revealed word.
  useEffect(() => {
    if (!isGameComplete) return;
    if (retryIndex !== -1) return;
    if (revealedList.length === 0) return;
    setRetryIndex(0);
    setRetryInput('');
    setRetryFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameComplete, revealedList.length]);

  const retryActive = isGameComplete
    && retryIndex >= 0
    && retryIndex < revealedList.length;

  if (retryActive) {
    const pw      = revealedList[retryIndex];
    const def     = definitions.get(pw.word);
    const target  = pw.word;
    const advance = (correct) => {
      setRetryResults(prev => {
        const next = new Map(prev);
        next.set(pw.id, !!correct);
        return next;
      });
      setRetryFeedback(correct ? 'correct' : 'wrong');
      // Brief pause so the child sees the outcome before moving on.
      setTimeout(() => {
        setRetryInput('');
        setRetryFeedback(null);
        setRetryIndex(i => i + 1);
      }, 1100);
    };
    const submitRetry = () => {
      if (retryFeedback) return; // already submitted, waiting for advance
      const correct = retryInput.trim().toLowerCase() === target.toLowerCase();
      advance(correct);
    };

    return (
      <div className="cw-wrap cw-wrap--complete">
        <div className="cw-complete cw-retry">
          <div className="cw-complete-emoji">🎯</div>
          <h2 className="cw-complete-title">One more go!</h2>
          <p className="cw-retry-sub">
            {retryIndex + 1} of {revealedList.length} — try this word again.
          </p>
          {def && <p className="cw-retry-clue">"{def}"</p>}
          <p className="cw-retry-meta">{target.length}-letter word</p>
          <input
            className={`cw-retry-input${retryFeedback ? ' cw-retry-input--' + retryFeedback : ''}`}
            type="text"
            value={retryInput}
            onChange={e => setRetryInput(e.target.value.replace(/[^a-zA-Z]/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') submitRetry(); }}
            autoFocus
            maxLength={target.length}
            disabled={!!retryFeedback}
            aria-label="Type the word"
          />
          <div className="cw-done-actions">
            <button
              className="cw-done-btn cw-done-btn--primary"
              onClick={submitRetry}
              disabled={!!retryFeedback || retryInput.length === 0}
            >
              Check ▶
            </button>
          </div>
          {retryFeedback === 'correct' && (
            <p className="cw-retry-feedback cw-retry-feedback--correct">Nice one!</p>
          )}
          {retryFeedback === 'wrong' && (
            <p className="cw-retry-feedback cw-retry-feedback--wrong">
              The word was <strong>{target}</strong>
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Completion screen ─────────────────────────────────────────────────────

  if (isGameComplete) {
    const elapsed = Math.round((endTime - startTime) / 1000);
    const mins    = Math.floor(elapsed / 60);
    const secs    = elapsed % 60;
    return (
      <div className="cw-wrap cw-wrap--complete">
        <div className="cw-complete">
          <div className="cw-complete-emoji">🎉</div>
          <h2 className="cw-complete-title">Crossword Complete!</h2>
          <div className="cw-stats">
            <div className="cw-stat">
              <span className="cw-stat-val">{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</span>
              <span className="cw-stat-label">Time</span>
            </div>
            <div className="cw-stat">
              <span className="cw-stat-val">{layout.placedWords.length}</span>
              <span className="cw-stat-label">Words</span>
            </div>
            <div className="cw-stat">
              <span className="cw-stat-val">{hintsUsed}</span>
              <span className="cw-stat-label">Hints</span>
            </div>
          </div>
          <div className="cw-done-actions">
            <button className="cw-done-btn cw-done-btn--secondary" onClick={() => {
              setFilled(new Map()); setHints(new Map());
              setHintsUsed(0); setSelectedCell(null); setEndTime(null);
              setRevealedWords(new Set());
            }}>
              Try Again
            </button>
            <button className="cw-done-btn cw-done-btn--primary" onClick={() => {
              // Build the per-word result shape expected by the credit
              // framework in gamificationEngine. Revealed words get one
              // follow-up attempt via the retry phase above — the retry
              // outcome (if any) overrides the initial "wrong on reveal"
              // result so the child can recover credit on a 2nd attempt.
              //
              //   - hintUsed: a letter-reveal or full reveal counts as hinted
              //   - attempts: reveals are always 2nd-attempt outcomes
              //   - correct: TRUE if the word was filled cleanly OR if the
              //     retry input matched; FALSE only when revealed AND the
              //     retry was either missed or never offered.
              const results = layout.placedWords.map(pw => {
                const fullyRevealed = revealedWords.has(pw.id);
                const anyHint       = hints.has(pw.id) || fullyRevealed;
                const retried       = retryResults.has(pw.id);
                const retryCorrect  = retryResults.get(pw.id) === true;
                return {
                  word:     pw.word,
                  correct:  fullyRevealed ? (retried && retryCorrect) : true,
                  attempts: fullyRevealed ? 2 : 1,
                  hintUsed: anyHint,
                };
              });
              onComplete(results);
            }}>
              Back to Hub ▶
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Grid info ─────────────────────────────────────────────────────────────

  const gridInfo = new Map();
  for (const pw of layout.placedWords) {
    const cells = wordCells(pw.word, pw.row, pw.col, pw.direction);
    cells.forEach((c, i) => {
      const k = cellKey(c.row, c.col);
      if (!gridInfo.has(k)) gridInfo.set(k, { expected: pw.word[i], number: null });
    });
    gridInfo.get(cellKey(pw.row, pw.col)).number = pw.number;
  }

  const selectedWordKeys = new Set(selectedWordCells.map(c => cellKey(c.row, c.col)));

  const hintLevel    = selectedWord ? (hints.get(selectedWord.id) || 0) : 0;
  const wordDone     = selectedWord ? isWordComplete(selectedWord, filled) : false;
  const canHint      = selectedWord && !wordDone && hintLevel < maxHints;

  return (
    <div
      className="cw-wrap"
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {/* ── Header ── */}
      {topbar(null)}

      <GameProgressStrip percent={(completedWords / layout.placedWords.length) * 100}>
        {completedWords} of {layout.placedWords.length} words solved
      </GameProgressStrip>

      {/* ── Body ── */}
      <div className={`cw-body cw-body--list-${listSide}`}>
        {/* Word list sidebar — always rendered so toggle button is always visible */}
        <aside className="cw-wordlist">
          <div className="cw-wordlist-controls">
            <button
              className="cw-toggle-btn"
              onClick={() => setWordsVisible(v => !v)}
            >
              {wordsVisible ? '🙈 Hide word list' : '👁 Show word list'}
            </button>
            <button
              className="cw-side-btn"
              onClick={() => setListSide(s => s === 'left' ? 'right' : 'left')}
              title={`Move list to the ${listSide === 'left' ? 'right' : 'left'}`}
              aria-label={`Move list to the ${listSide === 'left' ? 'right' : 'left'}`}
            >
              {listSide === 'left' ? '→' : '←'}
            </button>
          </div>
          {wordsVisible && (
            <ul className="cw-word-rows">
              {cwWords.map((pw) => {
                const done = isWordComplete(pw, filled);
                return (
                  <li
                    key={pw.id}
                    className={`game-word${done ? ' game-word--done' : ''}`}
                    onClick={() => {
                      // Fill the CURRENTLY SELECTED grid word with this pill's letters.
                      // Does not reveal which pill belongs to which grid position.
                      if (!selectedWord || isWordComplete(selectedWord, filled)) return;
                      const gridCells = wordCells(
                        selectedWord.word, selectedWord.row, selectedWord.col, selectedWord.direction
                      );
                      const letters = pw.word.toUpperCase();
                      setFilled(prev => {
                        const m = new Map(prev);
                        gridCells.forEach((c, i) => {
                          if (i < letters.length && !prev.get(cellKey(c.row, c.col))?.isHint) {
                            m.set(cellKey(c.row, c.col), { letter: letters[i], isHint: false });
                          }
                        });
                        return m;
                      });
                      // Move cursor to last filled cell
                      const lastIdx = Math.min(letters.length, gridCells.length) - 1;
                      setSelectedCell(gridCells[lastIdx]);
                      containerRef.current?.focus();
                    }}
                  >
                    {done && <span className="game-word-check" aria-hidden="true">✓</span>}
                    {pw.word.toLowerCase()}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Grid */}
        <div
          className="cw-grid-area"
          style={{ '--cols': layout.cols, '--rows': layout.rows }}
        >
          <div className="cw-grid">
            {Array.from({ length: layout.rows }, (_, r) =>
              Array.from({ length: layout.cols }, (_, c) => {
                const k    = cellKey(r, c);
                const info = gridInfo.get(k);
                if (!info) return <div key={k} className="cw-cell cw-cell--black" />;

                const filledEntry = filled.get(k);
                const letter      = filledEntry?.letter ?? '';
                const isHintCell  = filledEntry?.isHint ?? false;
                const isCorrect   = letter && letter === info.expected;
                const isWrong     = letter && letter !== info.expected;
                const isSelected  = selectedCell?.row === r && selectedCell?.col === c;
                const isInWord    = selectedWordKeys.has(k);
                const isLocked    = lockedCellKeys.has(k);

                return (
                  <div
                    key={k}
                    className={[
                      'cw-cell',
                      isSelected ? 'cw-cell--selected' : '',
                      isInWord && !isSelected ? 'cw-cell--in-word' : '',
                      isCorrect ? 'cw-cell--correct' : '',
                      isWrong   ? 'cw-cell--wrong'   : '',
                      isHintCell ? 'cw-cell--hint'   : '',
                      isLocked  ? 'cw-cell--locked'  : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleCellClick(r, c)}
                  >
                    {info.number && <span className="cw-num">{info.number}</span>}
                    <span className="cw-letter">{letter}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Clue bar ── */}
      <div className={`cw-clue-bar${selectedWord && !wordDone ? ' cw-clue-bar--active' : ''}`}>
        {selectedWord && !wordDone ? (
          <div key={selectedWord.id} className="cw-clue-bar-inner">
            <div className="cw-clue-bar-meta">
              <span className="cw-clue-bar-badge">
                <span className="cw-clue-bar-badge-icon">
                  {selectedWord.direction === 'across' ? '→' : '↓'}
                </span>
                {selectedWord.direction === 'across' ? 'Across' : 'Down'}
              </span>
              <span className="cw-clue-bar-badge">
                {selectedWord.word.length} letters
              </span>
              {wordDone && <span className="cw-clue-bar-done">✓ Done!</span>}
            </div>
            <AutoFitClueText text={definitions.get(selectedWord.word) ?? '…'} />
            <div className="cw-clue-bar-actions">
              <button
                className="cw-hear-btn"
                onClick={() => speakWord(selectedWord.word.toLowerCase())}
                title="Hear the word"
              >
                🔊 Hear the word
              </button>
              {canHint && (
                <button
                  className="cw-hint-btn"
                  onClick={() => applyHint(selectedWord.id)}
                >
                  💡 {hintLevel === 0 ? 'Reveal a letter' : 'Reveal another letter'}
                </button>
              )}
              {!canHint && !wordDone && !revealedWords.has(selectedWord.id) && (
                <button
                  className="cw-reveal-btn"
                  onClick={() => revealAnswer(selectedWord.id)}
                >
                  👀 Reveal answer
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="cw-clue-bar-empty">
            👆 Tap a square to start — or pick a word from the list!
          </p>
        )}
      </div>
    </div>
  );
}

// Shrinks the clue text so it never wraps past 3 lines. Starts at the CSS
// default and steps down until it fits (or hits the floor).
function AutoFitClueText({ text }) {
  const MAX_LINES = 3;
  const MAX_PX = 32;
  const MIN_PX = 14;
  const stateRef = useRef({ el: null, ro: null });

  const fit = (el) => {
    if (!el || !el.isConnected || el.clientWidth === 0) return;
    let size = MAX_PX;
    el.style.fontSize = size + 'px';
    let lineHeight = parseFloat(getComputedStyle(el).lineHeight) || size * 1.25;
    while (el.scrollHeight > lineHeight * MAX_LINES + 1 && size > MIN_PX) {
      size -= 1;
      el.style.fontSize = size + 'px';
      lineHeight = parseFloat(getComputedStyle(el).lineHeight) || size * 1.25;
    }
  };

  // Ref callback fires synchronously when the DOM node attaches. We keep the
  // ResizeObserver instance on the same DOM node across React re-renders so
  // a re-render storm in a sibling doesn't tear down our observer.
  const setRef = (el) => {
    const s = stateRef.current;
    if (s.el === el) return;
    if (s.ro) { s.ro.disconnect(); s.ro = null; }
    s.el = el;
    if (!el) return;
    fit(el);
    s.ro = new ResizeObserver(() => fit(el));
    s.ro.observe(el);
  };

  // Re-fit when the text content changes for the same element.
  useEffect(() => {
    if (stateRef.current.el) fit(stateRef.current.el);
  }, [text]);

  return <p ref={setRef} className="cw-clue-bar-text">{text}</p>;
}

export default Crossword;
