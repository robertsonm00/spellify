import React, { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { generateWordSearch, checkWord } from '../utils/wordSearchEngine';
import { speakWord } from '../utils/speech';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import RestartButton from './RestartButton';
import './WordSearch.css';

// ── Word-found celebration (same as Crossword / Hangman) ─────────────────────

function playWordChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[523, 0], [659, 0.1], [784, 0.2]].forEach(([freq, delay]) => {
      const osc  = ctx.createOscillator();
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

function fireVictoryFanfare() {
  // Wave 1 — big central burst
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { x: 0.5, y: 0.4 },
    colors: ['#FFD700', '#ec4899', '#c77dff', '#6bcb77', '#60a5fa'],
  });
  // Wave 2 — left cannon
  setTimeout(() => confetti({
    particleCount: 70,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.6 },
    colors: ['#fbbf24', '#f9a8d4', '#a78bfa'],
  }), 200);
  // Wave 3 — right cannon
  setTimeout(() => confetti({
    particleCount: 70,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.6 },
    colors: ['#fbbf24', '#f9a8d4', '#a78bfa'],
  }), 400);
}

function playVictorySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Rising arpeggio + sustained chord
    const notes = [
      { f: 523.25, t: 0.00, d: 0.3, v: 0.18 },
      { f: 659.25, t: 0.12, d: 0.3, v: 0.18 },
      { f: 783.99, t: 0.24, d: 0.3, v: 0.18 },
      { f: 1046.5, t: 0.38, d: 0.7, v: 0.22 },
      { f: 1318.5, t: 0.45, d: 0.6, v: 0.14 },
      // Sparkle tail
      { f: 1568.0, t: 0.55, d: 0.25, v: 0.09 },
      { f: 2093.0, t: 0.65, d: 0.25, v: 0.09 },
      { f: 2637.0, t: 0.75, d: 0.30, v: 0.07 },
    ];
    notes.forEach(({ f, t, d, v }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = f;
      const at = ctx.currentTime + t;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(v, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, at + d);
      osc.start(at);
      osc.stop(at + d + 0.05);
    });
  } catch { /* AudioContext unavailable */ }
}

// Fixed 10×10 max
// Year 5+ get a roomier 16x16 grid; younger ages stay on the cosier 10x10.
const gridSizeForYear = (year) => (year != null && year >= 5 ? 16 : 10);

function getCellsBetween(start, end) {
  const rowDiff = end.row - start.row;
  const colDiff = end.col - start.col;
  if (rowDiff !== 0 && colDiff !== 0 && Math.abs(rowDiff) !== Math.abs(colDiff)) {
    return [start];
  }
  const steps   = Math.max(Math.abs(rowDiff), Math.abs(colDiff));
  const rowStep = rowDiff === 0 ? 0 : rowDiff / Math.abs(rowDiff);
  const colStep = colDiff === 0 ? 0 : colDiff / Math.abs(colDiff);
  return Array.from({ length: steps + 1 }, (_, i) => ({
    row: start.row + i * rowStep,
    col: start.col + i * colStep,
  }));
}

export default function WordSearch({ words, year = null, savedProgress = null, onSaveProgress, onComplete, onExit, dyslexiaMode = false }) {
  const GRID_SIZE = gridSizeForYear(year);
  const [gameState,      setGameState]      = useState(() => savedProgress?.gameState ?? generateWordSearch(words, GRID_SIZE, { dyslexiaMode }));
  const [selectionAnchor, setSelectionAnchor] = useState(null); // click-mode anchor
  const [selectionCells,  setSelectionCells]  = useState([]);
  const [foundWords,      setFoundWords]      = useState(savedProgress?.foundWords ?? []);
  const [foundCells,      setFoundCells]      = useState(savedProgress?.foundCells ?? []);
  const [toast,           setToast]           = useState(null);
  const [listSide,        setListSide]        = useState('left');
  // Magical celebration overlay — appears for ~1.2s after a word is correctly
  // found. Carries the matched word so we can show it inside the burst.
  const [celebration,     setCelebration]     = useState(null);

  // Drag state in refs to avoid stale closures inside event handlers
  const isDraggingRef = useRef(false);
  const dragStartRef  = useRef(null);

  // ── Victory fanfare — fires once when all words are found ───────────────────
  const fanfareFiredRef = useRef(false);
  useEffect(() => {
    // Reset the fanfare guard when a new game starts (foundWords back to 0).
    if (foundWords.length === 0) { fanfareFiredRef.current = false; return; }
    // Need the placed-word count; read from gameState.
    const total = gameState?.placedWords?.length ?? 0;
    if (total > 0 && foundWords.length === total && !fanfareFiredRef.current) {
      fanfareFiredRef.current = true;
      fireVictoryFanfare();
      playVictorySound();
    }
  }, [foundWords, gameState]);

  // ── Game actions ────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    onSaveProgress?.(null);
    const fresh = generateWordSearch(words, GRID_SIZE, { dyslexiaMode });
    setGameState(fresh);
    setFoundWords([]);
    setFoundCells([]);
    setSelectionAnchor(null);
    setSelectionCells([]);
    setToast(null);
    isDraggingRef.current = false;
    dragStartRef.current  = null;
  }, [words, onSaveProgress]);

  // Restart without regenerating the grid — only clears found state.
  const resetProgress = useCallback(() => {
    onSaveProgress?.(null);
    setFoundWords([]);
    setFoundCells([]);
    setSelectionAnchor(null);
    setSelectionCells([]);
    setToast(null);
    isDraggingRef.current = false;
    dragStartRef.current  = null;
  }, [onSaveProgress]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
  };

  // Evaluate a start→end pair against the grid; returns true if matched
  const tryMatch = useCallback((startCell, endCell) => {
    if (!gameState) return false;
    const cells   = getCellsBetween(startCell, endCell);
    const s       = cells[0];
    const e       = cells[cells.length - 1];
    const matched = checkWord(gameState.grid, s.row, s.col, e.row, e.col, gameState.placedWords);
    if (matched && !foundWords.includes(matched.word)) {
      const newFoundWords = [...foundWords, matched.word];
      const newFoundCells = [...foundCells, ...cells];
      setFoundWords(newFoundWords);
      setFoundCells(newFoundCells);
      onSaveProgress?.({ gameState, foundWords: newFoundWords, foundCells: newFoundCells });
      showToast(`✓ ${matched.word.toLowerCase()}`);
      playWordChime();
      fireWordConfetti();
      // Magical pop-up — sits over the grid for a beat to celebrate the find.
      setCelebration({ word: matched.word, id: Date.now() });
      setTimeout(() => setCelebration(null), 1400);
      // Speak the word after the celebration so they don't overlap. Lowercase
      // first — many TTS engines spell out all-caps as letters (C·A·T).
      setTimeout(() => speakWord(matched.word.toLowerCase()), 1000);
      return true;
    }
    return false;
  }, [gameState, foundWords]);

  // ── Global mouseup — cancels drag if pointer released outside grid ──────────

  useEffect(() => {
    const onUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        dragStartRef.current  = null;
        setSelectionCells([]);
      }
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  // ── Cell pointer handlers ───────────────────────────────────────────────────

  const handleMouseDown = (row, col, e) => {
    e.preventDefault(); // prevent text highlight during drag
    isDraggingRef.current = true;
    dragStartRef.current  = { row, col };
    setSelectionCells([{ row, col }]);
  };

  const handleMouseEnter = (row, col) => {
    if (isDraggingRef.current && dragStartRef.current) {
      // Live drag preview
      setSelectionCells(getCellsBetween(dragStartRef.current, { row, col }));
      return;
    }
    // Click-mode hover preview
    if (selectionAnchor) {
      setSelectionCells(getCellsBetween(selectionAnchor, { row, col }));
    }
  };

  const handleMouseUp = (row, col) => {
    if (!isDraggingRef.current) return;
    const start = dragStartRef.current;
    isDraggingRef.current = false;
    dragStartRef.current  = null;
    if (!start) return;

    const sameCell = start.row === row && start.col === col;

    if (!sameCell) {
      // ── Drag completed across multiple cells ──
      tryMatch(start, { row, col });
      setSelectionAnchor(null);
      setSelectionCells([]);
    } else {
      // ── Single-cell click ──
      if (!selectionAnchor) {
        // First click: set anchor
        setSelectionAnchor({ row, col });
        setSelectionCells([{ row, col }]);
      } else if (selectionAnchor.row === row && selectionAnchor.col === col) {
        // Clicked same anchor again: cancel
        setSelectionAnchor(null);
        setSelectionCells([]);
      } else {
        // Second click: evaluate click-mode selection
        tryMatch(selectionAnchor, { row, col });
        setSelectionAnchor(null);
        setSelectionCells([]);
      }
    }
  };

  const cancelSelection = (e) => {
    e.preventDefault();
    setSelectionAnchor(null);
    setSelectionCells([]);
    isDraggingRef.current = false;
    dragStartRef.current  = null;
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!gameState) return null;

  const placedWords = gameState.placedWords;
  const progress    = placedWords.length > 0
    ? Math.round((foundWords.length / placedWords.length) * 100)
    : 0;

  // Is the currently-traced selection a valid (unfound) word? Used to flip
  // the selection highlight to green the moment the player crosses the
  // last correct letter.
  const selectionIsMatch = (() => {
    if (selectionCells.length < 2) return false;
    const s = selectionCells[0];
    const e = selectionCells[selectionCells.length - 1];
    const matched = checkWord(gameState.grid, s.row, s.col, e.row, e.col, placedWords);
    return !!matched && !foundWords.includes(matched.word);
  })();

  const isComplete = foundWords.length > 0 && foundWords.length === placedWords.length;
  const gridSize   = gameState.grid.length;

  return (
    <div className="ws-wrap" onContextMenu={cancelSelection}>

      {/* ── Header ── */}
      <GameHeader
        title="Word Search"
        onExit={onExit}
        rightSlot={
          <RestartButton hasProgress={foundWords.length > 0} onRestart={resetProgress} />
        }
      />

      <GameProgressStrip percent={progress}>
        {foundWords.length} of {placedWords.length} words found
      </GameProgressStrip>

      {/* ── Body: grid + word list ── */}
      <div className={`ws-body ws-body--list-${listSide}`}>

        {/* Grid area */}
        <div className="ws-grid-wrap">
          {toast && <div className="ws-toast">{toast}</div>}
          {celebration && (
            <div
              key={celebration.id}
              className="ws-celebration"
              role="status"
              aria-live="polite"
            >
              <span className="ws-celebration-sparkles" aria-hidden="true">
                <span className="ws-celebration-star ws-celebration-star--1">✦</span>
                <span className="ws-celebration-star ws-celebration-star--2">✦</span>
                <span className="ws-celebration-star ws-celebration-star--3">✦</span>
                <span className="ws-celebration-star ws-celebration-star--4">✦</span>
                <span className="ws-celebration-star ws-celebration-star--5">✦</span>
              </span>
              <span className="ws-celebration-word">{celebration.word.toLowerCase()}</span>
              <span className="ws-celebration-found">found!</span>
            </div>
          )}
          <div
            className="ws-grid"
            style={{ '--gs': gridSize }}
          >
            {gameState.grid.map((row, ri) => (
              <div key={ri} className="ws-row">
                {row.map((letter, ci) => {
                  const sel   = selectionCells.some(c => c.row === ri && c.col === ci);
                  const found = foundCells.some(c => c.row === ri && c.col === ci);
                  const cellSelClass = sel
                    ? (selectionIsMatch ? ' ws-cell--sel ws-cell--sel-correct' : ' ws-cell--sel')
                    : '';
                  return (
                    <div
                      key={`${ri}-${ci}`}
                      className={`ws-cell${found ? ' ws-cell--found' : cellSelClass}`}
                      onMouseDown={e  => handleMouseDown(ri, ci, e)}
                      onMouseEnter={() => handleMouseEnter(ri, ci)}
                      onMouseUp={()   => handleMouseUp(ri, ci)}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Word list */}
        <aside className="ws-wordlist-panel">
          <button
            className="ws-side-btn"
            onClick={() => setListSide(s => s === 'left' ? 'right' : 'left')}
            title={`Move list to the ${listSide === 'left' ? 'right' : 'left'}`}
            aria-label={`Move list to the ${listSide === 'left' ? 'right' : 'left'}`}
          >
            {listSide === 'left' ? '→' : '←'}
          </button>
          <ul className="ws-word-list">
            {placedWords.map(({ word }) => {
              const done = foundWords.includes(word);
              return (
                <li key={word} className={`game-word${done ? ' game-word--done' : ''}`}>
                  {done && <span className="game-word-check">✓</span>}
                  {word.toLowerCase()}
                </li>
              );
            })}
          </ul>
        </aside>

      </div>

      {/* ── Completion overlay — sits on top of the game, not a separate screen ── */}
      {isComplete && (
        <div className="ws-complete-overlay" role="dialog" aria-modal="true" aria-label="Word search complete">
          <div className="ws-complete-card">
            <div className="ws-complete-emoji">🎉</div>
            <h2 className="ws-complete-title">All words found!</h2>
            <p className="ws-complete-sub">Congratulations — brilliant work!</p>
            <div className="ws-complete-actions">
              <button className="ws-done-btn ws-done-btn--primary" onClick={startGame}>
                Play Again
              </button>
              <button className="ws-done-btn ws-done-btn--secondary" onClick={() => {
                // Per-word result for the mastery engine. Word Search is
                // recognition-only — there are no attempts and no hint
                // affordance, so every word is reported as a 1st-attempt
                // outcome with no hint. The 0.5x recognition multiplier is
                // applied centrally in gamificationEngine.
                onSaveProgress?.(null);
                onComplete(words.map(w => ({
                  word:     w,
                  correct:  foundWords.includes(w),
                  attempts: 1,
                  hintUsed: false,
                })));
              }}>
                Back to Hub
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
