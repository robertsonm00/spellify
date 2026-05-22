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

  // Completion screen
  if (foundWords.length > 0 && foundWords.length === placedWords.length) {
    return (
      <div className="ws-wrap ws-wrap--complete">
        <div className="ws-complete-card">
          <div className="ws-complete-emoji">🎉</div>
          <h2 className="ws-complete-title">All words found!</h2>
          <div className="ws-complete-actions">
            <button className="ws-done-btn ws-done-btn--primary"   onClick={startGame}>Play Again</button>
            <button className="ws-done-btn ws-done-btn--secondary" onClick={() => {
              // Per-word accuracy for the mastery engine: a word counts as
              // "correct" only if it was found this session. Unplaced /
              // unfound words flow through as correct: false so they don't
              // accrue mastery credit they didn't earn.
              onSaveProgress?.(null);
              onComplete(words.map(w => ({ word: w, correct: foundWords.includes(w) })));
            }}>Back to Hub</button>
          </div>
        </div>
      </div>
    );
  }

  const gridSize = gameState.grid.length;

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

    </div>
  );
}
