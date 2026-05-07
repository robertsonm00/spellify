import React, { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { generateWordSearch, checkWord } from '../utils/wordSearchEngine';
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
const GRID_SIZE = 10;

const HEADER_STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left:  (i * 37 + 13) % 100,
  top:   (i * 53 + 7)  % 100,
  size:  6 + (i % 4) * 3,
  dim:   i % 3 === 0,
}));

const BRAND_LETTERS = [
  { letter: 'S', color: '#ff6b6b' },
  { letter: 'P', color: '#ffd93d' },
  { letter: 'E', color: '#6bcb77' },
  { letter: 'L', color: '#4d96ff' },
  { letter: 'L', color: '#c77dff' },
  { letter: 'I', color: '#ff9f43' },
  { letter: 'F', color: '#ff6b6b' },
  { letter: 'Y', color: '#ffd93d' },
];

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

export default function WordSearch({ words, savedProgress = null, onSaveProgress, onComplete, onExit, dyslexiaMode = false, hideTopbar = false }) {
  const [gameState,      setGameState]      = useState(() => savedProgress?.gameState ?? generateWordSearch(words, GRID_SIZE, { dyslexiaMode }));
  const [selectionAnchor, setSelectionAnchor] = useState(null); // click-mode anchor
  const [selectionCells,  setSelectionCells]  = useState([]);
  const [foundWords,      setFoundWords]      = useState(savedProgress?.foundWords ?? []);
  const [foundCells,      setFoundCells]      = useState(savedProgress?.foundCells ?? []);
  const [toast,           setToast]           = useState(null);
  const [confirmRestart,  setConfirmRestart]  = useState(false);

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

  // Completion screen
  if (foundWords.length > 0 && foundWords.length === placedWords.length) {
    return (
      <div className="ws-wrap ws-wrap--complete">
        <div className="ws-complete-card">
          <div className="ws-complete-emoji">🎉</div>
          <h2 className="ws-complete-title">All words found!</h2>
          <div className="ws-complete-actions">
            <button className="ws-done-btn ws-done-btn--primary"   onClick={startGame}>Play Again</button>
            <button className="ws-done-btn ws-done-btn--secondary" onClick={() => { onSaveProgress?.(null); onComplete(words.map(w => ({ word: w, correct: true }))); }}>Back to Hub</button>
          </div>
        </div>
      </div>
    );
  }

  const gridSize = gameState.grid.length;

  return (
    <div className="ws-wrap" onContextMenu={cancelSelection}>

      {/* ── Header ── */}
      {!hideTopbar && (
      <div className="ws-topbar">
        <div className="ws-topbar-stars" aria-hidden="true">
          {HEADER_STARS.map((s) => (
            <span key={s.id} className={`ws-topbar-star${s.dim ? ' ws-topbar-star--dim' : ''}`}
              style={{ left: `${s.left}%`, top: `${s.top}%`, fontSize: `${s.size}px` }}>★</span>
          ))}
        </div>
        <button className="ws-back" onClick={onExit}>← Exit</button>
        <div className="ws-topbar-center">
          <span className="ws-topbar-brand" aria-label="Spellify">
            {BRAND_LETTERS.map(({ letter, color }, i) => (
              <span key={i} className="ws-brand-letter" style={{ color, animationDelay: `${i * 0.08}s` }}>{letter}</span>
            ))}
          </span>
          <h2 className="ws-title">Word Search</h2>
        </div>
        <div className="ws-topbar-right">
          <button className="ws-restart-btn" onClick={() => { if (foundWords.length > 0) setConfirmRestart(true); else resetProgress(); }} title="Restart game">↺ Restart</button>
        </div>
      </div>
      )}

      {/* ── Progress strip — full width, touches header border ── */}
      <div className="ws-progress-strip">
        <div className="ws-bar-fill" style={{ width: `${progress}%` }} />
        <span className="ws-count">
          {foundWords.length} of {placedWords.length} words found
        </span>
      </div>

      {/* ── Body: grid + word list ── */}
      <div className="ws-body">

        {/* Grid area */}
        <div className="ws-grid-wrap">
          {toast && <div className="ws-toast">{toast}</div>}
          <div
            className="ws-grid"
            style={{ '--gs': gridSize }}
          >
            {gameState.grid.map((row, ri) => (
              <div key={ri} className="ws-row">
                {row.map((letter, ci) => {
                  const sel   = selectionCells.some(c => c.row === ri && c.col === ci);
                  const found = foundCells.some(c => c.row === ri && c.col === ci);
                  return (
                    <div
                      key={`${ri}-${ci}`}
                      className={`ws-cell${found ? ' ws-cell--found' : sel ? ' ws-cell--sel' : ''}`}
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
        <ul className="ws-word-list">
          {placedWords.map(({ word }) => {
            const done = foundWords.includes(word);
            return (
              <li key={word} className={`ws-word${done ? ' ws-word--done' : ''}`}>
                {done && <span className="ws-word-check">✓</span>}
                {word.toLowerCase()}
              </li>
            );
          })}
        </ul>

      </div>

      {confirmRestart && (
        <div className="exit-overlay" onClick={() => setConfirmRestart(false)}>
          <div className="exit-modal" onClick={e => e.stopPropagation()}>
            <div className="exit-modal-icon">↺</div>
            <h2 className="exit-modal-title">Restart?</h2>
            <p className="exit-modal-body">You'll lose your progress so far.</p>
            <div className="exit-modal-btns">
              <button className="exit-btn exit-btn--cancel" onClick={() => setConfirmRestart(false)}>Keep going</button>
              <button className="exit-btn exit-btn--confirm" onClick={() => { setConfirmRestart(false); resetProgress(); }}>Yes, restart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
