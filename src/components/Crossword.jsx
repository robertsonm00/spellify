import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { generateCrossword, wordCells } from '../utils/crosswordEngine';
import DEFINITIONS from '../data/definitions';
import { isSafeDefinition } from '../utils/definitionSafety';
import './Crossword.css';

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

// ── Speech ───────────────────────────────────────────────────────────────────

let cachedCwVoice = null;
function pickCwVoice() {
  if (cachedCwVoice) return cachedCwVoice;
  const voices = window.speechSynthesis?.getVoices?.() || [];
  cachedCwVoice = voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang?.startsWith('en')) || null;
  return cachedCwVoice;
}
function speakWord(word) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-GB'; u.rate = 0.85;
  const v = pickCwVoice(); if (v) u.voice = v;
  window.speechSynthesis.speak(u);
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

// ── Definition lookup ────────────────────────────────────────────────────────

// Walk the API meanings in noun → verb → other order, returning the first
// safe primary-sense definition. This biases toward concrete, kid-friendly
// senses (e.g. "mouse" = animal, not "a shy person"). Short definitions
// (e.g. "An enemy.") are kept — kid-friendly clues are often terse.
function pickKidFriendly(meanings) {
  const PART_ORDER = { noun: 0, verb: 1 };
  const ordered = [...meanings].sort((a, b) =>
    (PART_ORDER[a.partOfSpeech] ?? 2) - (PART_ORDER[b.partOfSpeech] ?? 2)
  );
  for (const meaning of ordered) {
    for (const def of (meaning.definitions || [])) {
      const text = def.definition;
      if (!text || text.startsWith('(') || text.length < 5) continue;
      if (!isSafeDefinition(text)) continue;
      return text;
    }
  }
  return null;
}

// Returns:
//   { found: true,  definition: 'text' | null }   — word exists in the dictionary
//   { found: false }                              — confirmed not a word (404)
//   { found: 'unknown' }                          — network failed; treat permissively
async function lookupApi(word) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`
    );
    if (res.status === 404) return { found: false };
    if (!res.ok)            return { found: 'unknown' };
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return { found: false };
    // Some words (e.g. "foe") have a kid-safe sense in entry 0 and an
    // obscure-but-longer sense in entry 1 — flatten so we don't miss either.
    const allMeanings = data.flatMap(entry => entry?.meanings || []);
    if (allMeanings.length === 0) return { found: false };
    return { found: true, definition: pickKidFriendly(allMeanings) };
  } catch {
    return { found: 'unknown' };
  }
}

// Validates a single word and resolves a kid-friendly definition.
//   - Local DEFINITIONS map always wins (curated, safe by construction).
//   - Otherwise the dictionary API decides validity.
//   - Words confirmed to exist but with no usable kid-safe clue are
//     marked invalid so they're excluded from the crossword.
//   - Network/server failures keep the word but leave the clue blank.
async function validateWord(word) {
  const key = word.toLowerCase();
  if (DEFINITIONS[key]) return { word, valid: true, definition: DEFINITIONS[key] };

  const api = await lookupApi(key);
  if (api.found === false)     return { word, valid: false, reason: 'not_a_word' };
  if (api.found === 'unknown') return { word, valid: true,  definition: null };
  if (!api.definition)         return { word, valid: false, reason: 'no_clue' };
  return { word, valid: true, definition: api.definition };
}

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

function Crossword({ words, userAge = 8, difficulty = 'medium', onComplete, onExit, savedProgress = null, onSaveProgress, hideTopbar = false }) {
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
  const [startTime]      = useState(Date.now);
  const [endTime,        setEndTime]        = useState(null);
  const [wordsVisible,   setWordsVisible]   = useState(true);
  const containerRef     = useRef(null);

  // Validate every word against the dictionary, then build the crossword
  // from the survivors. Words confirmed-missing (404) are excluded;
  // network failures stay in (permissive) but with no definition.
  useEffect(() => {
    let cancelled = false;
    setValidation(null);
    setLayout(null);
    (async () => {
      const results = await Promise.all(words.map(validateWord));
      if (cancelled) return;
      const valid     = results.filter(r => r.valid);
      const validList = valid.map(r => r.word);
      const skipped   = results.filter(r => !r.valid).map(r => r.word);

      const built = generateCrossword(validList, maxWords);
      const defs  = new Map();
      if (built) {
        for (const pw of built.placedWords) {
          const match = valid.find(r => r.word.toLowerCase() === pw.word.toLowerCase());
          if (match?.definition) {
            defs.set(pw.word, ageAwareDefinition(match.definition, userAge));
          }
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

  // ── Loading & no-layout states ────────────────────────────────────────────

  const topbar = (rightSlot = null) => (
    <div className="cw-topbar">
      <div className="cw-topbar-stars" aria-hidden="true">
        {HEADER_STARS.map((s) => (
          <span key={s.id} className={`cw-topbar-star${s.dim ? ' cw-topbar-star--dim' : ''}`}
            style={{ left: `${s.left}%`, top: `${s.top}%`, fontSize: `${s.size}px` }}>★</span>
        ))}
      </div>
      <button className="cw-back" onClick={onExit}>← Exit</button>
      <div className="cw-topbar-center">
        <span className="cw-topbar-brand" aria-label="Spellify">
          {BRAND_LETTERS.map(({ letter, color }, i) => (
            <span key={i} className="cw-brand-letter" style={{ color, animationDelay: `${i * 0.08}s` }}>{letter}</span>
          ))}
        </span>
        <h2 className="cw-title">Crossword</h2>
      </div>
      <div className="cw-topbar-right">{rightSlot}</div>
    </div>
  );

  if (validation === null) {
    return (
      <div className="cw-wrap">
        {!hideTopbar && topbar()}
        <p className="cw-loading">📖 Checking the dictionary…</p>
      </div>
    );
  }

  if (!layout) {
    const skipped = validation?.skipped ?? [];
    return (
      <div className="cw-wrap">
        {!hideTopbar && topbar()}
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
              const results = layout.placedWords.map(pw => ({
                word: pw.word,
                correct: !revealedWords.has(pw.id),
              }));
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
      {!hideTopbar && topbar(null)}

      {/* ── Body ── */}
      <div className="cw-body">
        {/* Word list sidebar — always rendered so toggle button is always visible */}
        <aside className="cw-wordlist">
          <button
            className="cw-toggle-btn"
            onClick={() => setWordsVisible(v => !v)}
          >
            {wordsVisible ? '🙈 Hide word list' : '👁 Show word list'}
          </button>
          {wordsVisible && (
            <ul className="cw-word-rows">
              {cwWords.map((pw) => {
                const done = isWordComplete(pw, filled);
                return (
                  <li
                    key={pw.id}
                    className={`cw-word-row${done ? ' cw-word-row--done' : ''}`}
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
                    {done && <span className="cw-word-check" aria-hidden="true">✓</span>}
                    <span className="cw-word-text">{pw.word.toLowerCase()}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Grid */}
        <div className="cw-grid-area">
          <div
            className="cw-grid"
            style={{ '--cols': layout.cols, '--rows': layout.rows }}
          >
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
      <div className={`cw-clue-bar${selectedWord ? ' cw-clue-bar--active' : ''}`}>
        {selectedWord ? (
          <>
            <div className="cw-clue-bar-meta">
              <span className="cw-clue-bar-num">
                {selectedWord.direction === 'across' ? '→' : '↓'}
              </span>
              <span className="cw-clue-bar-letters">{selectedWord.word.length} letters</span>
              {wordDone && <span className="cw-clue-bar-done">✓ Done!</span>}
            </div>
            <p className="cw-clue-bar-text">
              {definitions.get(selectedWord.word) ?? '…'}
            </p>
            <div className="cw-clue-bar-actions">
              <button
                className="cw-hear-btn"
                onClick={() => speakWord(selectedWord.word)}
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
          </>
        ) : (
          <p className="cw-clue-bar-empty">
            👆 Tap a square to start — or pick a word from the list!
          </p>
        )}
      </div>
    </div>
  );
}

export default Crossword;
