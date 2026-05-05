import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateWordSearch, checkWord } from '../utils/wordSearchEngine';
import './WordSearch.css';

// Fixed 10×10 max
const GRID_SIZE = 10;

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

export default function WordSearch({ words, onComplete, onExit, dyslexiaMode = false }) {
  const [gameState,      setGameState]      = useState(() => generateWordSearch(words, GRID_SIZE, { dyslexiaMode }));
  const [selectionAnchor, setSelectionAnchor] = useState(null); // click-mode anchor
  const [selectionCells,  setSelectionCells]  = useState([]);
  const [foundWords,      setFoundWords]      = useState([]);
  const [foundCells,      setFoundCells]      = useState([]);
  const [toast,           setToast]           = useState(null);

  // Drag state in refs to avoid stale closures inside event handlers
  const isDraggingRef = useRef(false);
  const dragStartRef  = useRef(null);

  // ── Game actions ────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    setGameState(generateWordSearch(words, GRID_SIZE, { dyslexiaMode }));
    setFoundWords([]);
    setFoundCells([]);
    setSelectionAnchor(null);
    setSelectionCells([]);
    setToast(null);
    isDraggingRef.current = false;
    dragStartRef.current  = null;
  }, [words]);

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
      setFoundWords(prev => [...prev, matched.word]);
      setFoundCells(prev => [...prev, ...cells]);
      showToast(`✓ ${matched.word.toLowerCase()}`);
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
            <button className="ws-done-btn ws-done-btn--secondary" onClick={onComplete}>Back to Hub</button>
          </div>
        </div>
      </div>
    );
  }

  const gridSize = gameState.grid.length;

  return (
    <div className="ws-wrap" onContextMenu={cancelSelection}>

      {/* ── Header ── */}
      <div className="ws-header">
        <button className="ws-back-btn" onClick={onExit}>← Hub</button>
        <div className="ws-header-center">
          <h1 className="ws-title">Word Search</h1>
        </div>
      </div>

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
    </div>
  );
}
