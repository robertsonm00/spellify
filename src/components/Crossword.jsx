import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateCrossword, wordCells } from '../utils/crosswordEngine';
import DEFINITIONS from '../data/definitions';
import './Crossword.css';

// ── Config ──────────────────────────────────────────────────────────────────

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

// ── Definition lookup ────────────────────────────────────────────────────────

// For custom words not in the local dictionary, try the API and pick the
// shortest definition that reads like plain English (no parenthetical jargon).
async function fetchFromApi(word) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    // Collect all definitions across all meanings
    const defs = data[0]?.meanings?.flatMap(m => m.definitions.map(d => d.definition)) ?? [];
    // Pick shortest that doesn't start with technical markers like "(" or abbreviations
    const clean = defs
      .filter(d => d && !d.startsWith('(') && d.length > 8)
      .sort((a, b) => a.length - b.length);
    return clean[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchDefinition(word) {
  const key = word.toLowerCase();
  // 1. Check local kid-friendly definitions first
  if (DEFINITIONS[key]) return DEFINITIONS[key];
  // 2. Fall back to API for custom words
  const api = await fetchFromApi(key);
  return api ?? 'Can you spell this word?';
}

// Cap length for very young users
function ageAwareDefinition(def, userAge) {
  if (userAge < 7  && def.length > 70)  return def.slice(0, 67) + '…';
  if (userAge < 10 && def.length > 130) return def.slice(0, 127) + '…';
  return def;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellKey(row, col) { return `${row},${col}`; }

function getExpectedLetter(layout, row, col) {
  for (const pw of layout.placedWords) {
    const cells = wordCells(pw.word, pw.row, pw.col, pw.direction);
    const idx = cells.findIndex(c => c.row === row && c.col === col);
    if (idx >= 0) return pw.word[idx];
  }
  return null;
}

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

// ── Component ────────────────────────────────────────────────────────────────

function Crossword({ words, userAge = 8, difficulty = 'medium', onComplete, onExit }) {
  const maxWords  = getMaxWords(userAge, difficulty);
  const maxHints  = getMaxHints(userAge);

  // Layout is computed once on mount
  const [layout]       = useState(() => generateCrossword(words, maxWords));
  const [definitions,  setDefinitions]  = useState(new Map()); // word → definition string
  const [filled,       setFilled]       = useState(new Map()); // key → { letter, isHint }
  const [selectedCell, setSelectedCell] = useState(null);      // { row, col }
  const [selDir,       setSelDir]       = useState('across');  // selected direction
  const [hints,        setHints]        = useState(new Map()); // wordId → hintLevel (0-3)
  const [hintsUsed,    setHintsUsed]    = useState(0);
  const [startTime]    = useState(Date.now);
  const [endTime,      setEndTime]      = useState(null);
  const containerRef   = useRef(null);

  // Fetch definitions for all placed words
  useEffect(() => {
    if (!layout) return;
    layout.placedWords.forEach(async (pw) => {
      const def = await fetchDefinition(pw.word);
      setDefinitions(prev => new Map(prev).set(pw.word, ageAwareDefinition(def, userAge)));
    });
  }, [layout, userAge]);

  // Focus container for keyboard events
  useEffect(() => { containerRef.current?.focus(); }, [layout]);

  // ── Derived state ──────────────────────────────────────────────────────────

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

  // Detect completion
  useEffect(() => {
    if (isGameComplete && !endTime) setEndTime(Date.now());
  }, [isGameComplete, endTime]);

  // ── Interaction ────────────────────────────────────────────────────────────

  const handleCellClick = useCallback((row, col) => {
    if (!layout) return;
    const wordsHere = getWordsAtCell(layout, row, col);
    if (!wordsHere.length) return;

    if (selectedCell?.row === row && selectedCell?.col === col) {
      // Toggle direction on second click
      const other = selDir === 'across' ? 'down' : 'across';
      if (wordsHere.some(pw => pw.direction === other)) setSelDir(other);
    } else {
      setSelectedCell({ row, col });
      // Prefer the current direction if a word exists in it
      const hasCurrentDir = wordsHere.some(pw => pw.direction === selDir);
      if (!hasCurrentDir) setSelDir(wordsHere[0].direction);
    }
  }, [layout, selectedCell, selDir]);

  const advanceCell = useCallback((word, currentRow, currentCol) => {
    const cells = wordCells(word.word, word.row, word.col, word.direction);
    const idx = cells.findIndex(c => c.row === currentRow && c.col === currentCol);
    // Move to next empty cell, or just the next cell if no empty ones remain
    for (let i = idx + 1; i < cells.length; i++) {
      if (!filled.has(cellKey(cells[i].row, cells[i].col))) {
        setSelectedCell(cells[i]);
        return;
      }
    }
    // All remaining cells filled — move to next if possible
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
      // Cycle to next word
      const allWords = layout.placedWords;
      const currentIdx = selectedWord ? allWords.indexOf(selectedWord) : -1;
      const next = allWords[(currentIdx + 1) % allWords.length];
      const firstCell = wordCells(next.word, next.row, next.col, next.direction)[0];
      setSelectedCell(firstCell);
      setSelDir(next.direction);
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      const key = cellKey(selectedCell.row, selectedCell.col);
      if (filled.has(key) && !filled.get(key).isHint) {
        setFilled(prev => { const m = new Map(prev); m.delete(key); return m; });
      } else if (word) {
        retreatCell(word, selectedCell.row, selectedCell.col);
        const cells = wordCells(word.word, word.row, word.col, word.direction);
        const idx = cells.findIndex(c => c.row === selectedCell.row && c.col === selectedCell.col);
        if (idx > 0) {
          const prev = cells[idx - 1];
          const prevKey = cellKey(prev.row, prev.col);
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
      const letter = e.key.toUpperCase();
      const key = cellKey(selectedCell.row, selectedCell.col);
      if (filled.get(key)?.isHint) return; // don't overwrite hints
      setFilled(prev => new Map(prev).set(key, { letter, isHint: false }));
      if (word) advanceCell(word, selectedCell.row, selectedCell.col);
    }
  }, [selectedCell, selectedWord, layout, filled, advanceCell, retreatCell]);

  // ── Hint system ────────────────────────────────────────────────────────────

  const applyHint = (wordId) => {
    const pw = layout?.placedWords.find(p => p.id === wordId);
    if (!pw) return;
    const level = (hints.get(wordId) || 0) + 1;
    if (level > maxHints) return;

    const cells = wordCells(pw.word, pw.row, pw.col, pw.direction);

    setHints(prev => new Map(prev).set(wordId, level));
    setHintsUsed(n => n + 1);

    if (level === 1) {
      // Reveal first letter
      const { row, col } = cells[0];
      setFilled(prev => new Map(prev).set(cellKey(row, col), { letter: pw.word[0], isHint: true }));
    } else if (level === 2) {
      // Reveal first + last letter
      const last = cells[cells.length - 1];
      setFilled(prev => new Map(prev)
        .set(cellKey(cells[0].row, cells[0].col), { letter: pw.word[0], isHint: true })
        .set(cellKey(last.row, last.col),          { letter: pw.word[pw.word.length - 1], isHint: true })
      );
    } else {
      // Reveal entire word
      setFilled(prev => {
        const m = new Map(prev);
        cells.forEach((c, i) => m.set(cellKey(c.row, c.col), { letter: pw.word[i], isHint: true }));
        return m;
      });
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  if (!layout) {
    return (
      <div className="cw-wrap">
        {onExit && <button className="cw-back" onClick={onExit}>← Hub</button>}
        <p className="cw-error">Not enough words to build a crossword (need at least 2).</p>
      </div>
    );
  }

  if (isGameComplete) {
    const elapsed = Math.round((endTime - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const accuracy = layout
      ? Math.round(((layout.placedWords.length * 1) / Math.max(1, layout.placedWords.length)) * 100)
      : 100;

    return (
      <div className="cw-wrap">
        {onExit && <button className="cw-back" onClick={onExit}>← Hub</button>}
        <div className="cw-complete">
          <h2>🎉 Crossword Complete!</h2>
          <div className="cw-stats">
            <div className="cw-stat">
              <span className="cw-stat-val">{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</span>
              <span className="cw-stat-label">Time</span>
            </div>
            <div className="cw-stat">
              <span className="cw-stat-val">{hintsUsed}</span>
              <span className="cw-stat-label">Hints used</span>
            </div>
            <div className="cw-stat">
              <span className="cw-stat-val">{layout.placedWords.length}</span>
              <span className="cw-stat-label">Words solved</span>
            </div>
          </div>
          <div className="cw-done-actions">
            <button onClick={() => {
              setFilled(new Map());
              setHints(new Map());
              setHintsUsed(0);
              setSelectedCell(null);
              setEndTime(null);
            }}>
              Try Again
            </button>
            <button onClick={onComplete}>Back to Hub</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Grid ───────────────────────────────────────────────────────────────────

  // Build a 2-D cell-info lookup
  const gridInfo = new Map(); // key → { expected, number }
  for (const pw of layout.placedWords) {
    const cells = wordCells(pw.word, pw.row, pw.col, pw.direction);
    cells.forEach((c, i) => {
      const k = cellKey(c.row, c.col);
      if (!gridInfo.has(k)) gridInfo.set(k, { expected: pw.word[i], number: null });
    });
    gridInfo.get(cellKey(pw.row, pw.col)).number = pw.number;
  }

  const selectedWordIds = new Set(selectedWordCells.map(c => cellKey(c.row, c.col)));

  // Clues split by direction
  const across = layout.placedWords.filter(pw => pw.direction === 'across').sort((a,b) => a.number - b.number);
  const down   = layout.placedWords.filter(pw => pw.direction === 'down').sort((a,b) => a.number - b.number);

  return (
    <div
      className="cw-wrap"
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {onExit && <button className="cw-back" onClick={onExit}>← Hub</button>}

      {/* Progress */}
      <div className="cw-header">
        <h2>Crossword</h2>
        <p className="cw-progress">{completedWords} / {layout.placedWords.length} words</p>
      </div>

      <div className="cw-main">
        {/* Grid */}
        <div className="cw-grid-wrap">
          <div className="cw-grid" style={{ '--cols': layout.cols }}>
            {Array.from({ length: layout.rows }, (_, r) =>
              Array.from({ length: layout.cols }, (_, c) => {
                const k = cellKey(r, c);
                const info = gridInfo.get(k);
                if (!info) return <div key={k} className="cw-cell cw-cell--black" />;

                const filledEntry = filled.get(k);
                const letter      = filledEntry?.letter ?? '';
                const isHintCell  = filledEntry?.isHint ?? false;
                const isCorrect   = letter && letter === info.expected;
                const isWrong     = letter && letter !== info.expected;
                const isSelected  = selectedCell?.row === r && selectedCell?.col === c;
                const isInWord    = selectedWordIds.has(k);

                return (
                  <div
                    key={k}
                    className={[
                      'cw-cell',
                      isSelected ? 'cw-cell--selected' : '',
                      isInWord && !isSelected ? 'cw-cell--in-word' : '',
                      isCorrect ? 'cw-cell--correct' : '',
                      isWrong ? 'cw-cell--wrong' : '',
                      isHintCell ? 'cw-cell--hint' : '',
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

        {/* Clue panel */}
        <div className="cw-clues">
          {[['Across', across], ['Down', down]].map(([label, clues]) => (
            <div key={label} className="cw-clue-section">
              <h3>{label}</h3>
              <ul>
                {clues.map(pw => {
                  const hintLevel = hints.get(pw.id) || 0;
                  const done      = isWordComplete(pw, filled);
                  const active    = selectedWord?.id === pw.id;

                  return (
                    <li
                      key={pw.id}
                      className={[
                        'cw-clue',
                        active ? 'cw-clue--active' : '',
                        done   ? 'cw-clue--done'   : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        const first = wordCells(pw.word, pw.row, pw.col, pw.direction)[0];
                        setSelectedCell(first);
                        setSelDir(pw.direction);
                      }}
                    >
                      <div className="cw-clue-top">
                        <span className="cw-clue-num">{pw.number}.</span>
                        <span className="cw-clue-def">
                          {definitions.get(pw.word) ?? '…'}
                        </span>
                        {done && <span className="cw-clue-check">✓</span>}
                      </div>

                      <div className="cw-clue-meta">
                        <span className="cw-clue-length">{pw.word.length} letters</span>
                        {!done && hintLevel < maxHints && (
                          <button
                            className="cw-hint-btn"
                            onClick={e => { e.stopPropagation(); applyHint(pw.id); }}
                          >
                            Hint {hintLevel + 1}
                          </button>
                        )}
                        {hintLevel > 0 && (
                          <span className="cw-hint-used">{hintLevel} hint{hintLevel > 1 ? 's' : ''} used</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Crossword;
