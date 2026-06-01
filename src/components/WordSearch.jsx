import React, { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { generateWordSearch, checkWord } from '../utils/wordSearchEngine';
import { speakWord } from '../utils/speech';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import RestartButton from './RestartButton';
import GameResults from './GameResults';
import DevCompleteButton from './DevCompleteButton';
import { formatDuration } from '../utils/formatDuration';
import { WordDetailModal, preSeedWordInfoCache } from './WordListHub';
import './WordSearch.css';

// Themed backgrounds — injected via CSS custom properties at runtime so
// css-loader doesn't have to resolve public/ paths at build time.
const BG_STYLE = {
  '--bg-image-url': `url("${process.env.PUBLIC_URL || ''}/adventure/backgrounds/word-search-forest-background.webp")`,
  '--bg-image-url-wordlist': `url("${process.env.PUBLIC_URL || ''}/adventure/backgrounds/word-list-background.webp")`,
};

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

// The completion fanfare (confetti + victory sound) is owned by the shared
// GameResults screen now (RES-01/RES-02). Only the per-word burst above stays
// local to Word Search.

// Fixed 10×10 max
// Year 5+ get a roomier 16x16 grid; younger ages stay on the cosier 10x10.
const gridSizeForYear = (year) => (year != null && year >= 5 ? 16 : 10);

// ── Coach (onboarding) helpers ───────────────────────────────────────────────
// localStorage key — bumped suffix invalidates older "seen" flags if we revamp.
const COACH_SEEN_KEY = 'spellify.ws.onboarding.v1';
// We coach through the first N words then step aside.
const COACH_WORDS = 2;
// Direction index → {dx, dy} (mirrors wordSearchEngine.js).
const COACH_DIRS = [
  { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
];
// Expand a placedWord {startRow, startCol, direction, length} into its cells.
function coachCellsForPlacedWord(pw) {
  if (!pw) return [];
  const { dx, dy } = COACH_DIRS[pw.direction] || COACH_DIRS[0];
  const cells = [];
  for (let i = 0; i < pw.length; i++) {
    cells.push({ row: pw.startRow + dy * i, col: pw.startCol + dx * i });
  }
  return cells;
}

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

export default function WordSearch({ words, wordObjects = [], year = null, savedProgress = null, onSaveProgress, onComplete, onExit, dyslexiaMode = false }) {
  const GRID_SIZE = gridSizeForYear(year);
  // The grid is generated once on mount (resumed from a snapshot if present)
  // and never regenerated in place — "Play Again" was removed with RES-01, so
  // there's no setter. A header restart only clears found state (resetProgress).
  const [gameState] = useState(() => savedProgress?.gameState ?? generateWordSearch(words, GRID_SIZE, { dyslexiaMode }));
  const [selectionAnchor, setSelectionAnchor] = useState(null); // click-mode anchor
  const [selectionCells,  setSelectionCells]  = useState([]);
  const [foundWords,      setFoundWords]      = useState(savedProgress?.foundWords ?? []);
  const [foundCells,      setFoundCells]      = useState(savedProgress?.foundCells ?? []);
  const [toast,           setToast]           = useState(null);
  const [listSide,        setListSide]        = useState('left');
  // Magical celebration overlay — appears for ~1.2s after a word is correctly
  // found. Carries the matched word so we can show it inside the burst.
  const [celebration,     setCelebration]     = useState(null);
  // Word detail modal — opened when any word in the sidebar list is tapped
  const [activeWord,      setActiveWord]      = useState(null); // string | null

  // Elapsed-time tracking for the Variant B results tile (RES-01). The clock
  // starts on mount (≈ when this sitting begins) and freezes when the last
  // word is found. Resuming or restarting restarts the clock for that sitting.
  const startTimeRef = useRef(Date.now());
  const [endTime, setEndTime] = useState(null);

  // ── Coach (onboarding) state ───────────────────────────────────────────
  // Active on a first-time play (no saved progress, no "seen" flag in
  // localStorage). Walks the child through the first COACH_WORDS finds,
  // highlighting the target cells and pointing to the word in the list.
  // `coachStep` is the index into placedWords of the current target.
  // `coachPhase` is one of: 'guide' | 'done' | 'off'.
  const [coachStep,  setCoachStep]  = useState(0);
  const [coachPhase, setCoachPhase] = useState(() => {
    // Don't coach if they already have progress in this list, or if they've
    // played Word Search before on this device.
    if (savedProgress?.foundWords?.length) return 'off';
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem(COACH_SEEN_KEY)) {
        return 'off';
      }
    } catch { /* private mode etc. — coach is fine to show */ }
    return 'guide';
  });

  // Pre-seed word info cache with list definitions so the modal resolves instantly
  useEffect(() => { preSeedWordInfoCache(wordObjects); }, [words]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag state in refs to avoid stale closures inside event handlers
  const isDraggingRef = useRef(false);
  const dragStartRef  = useRef(null);

  // ── Completion clock — freeze elapsed time once all words are found ─────────
  // The celebration itself is owned by the shared GameResults screen (RES-02);
  // here we just stop the clock so the Variant B Time tile is stable.
  useEffect(() => {
    if (foundWords.length === 0) { setEndTime(null); return; }
    const total = gameState?.placedWords?.length ?? 0;
    if (total > 0 && foundWords.length === total) {
      setEndTime((prev) => prev ?? Date.now());
    }
  }, [foundWords, gameState]);

  // ── Game actions ────────────────────────────────────────────────────────────

  // ── DEV-only: instant complete ─────────────────────────────────────────────
  const handleDevComplete = () => {
    if (!gameState) return;
    setFoundWords(gameState.placedWords.map(pw => pw.word));
    setFoundCells([]); // cell highlighting skipped; isComplete still triggers
  };

  // Restart without regenerating the grid — only clears found state.
  const resetProgress = useCallback(() => {
    onSaveProgress?.(null);
    setFoundWords([]);
    setFoundCells([]);
    setSelectionAnchor(null);
    setSelectionCells([]);
    setToast(null);
    setEndTime(null);
    startTimeRef.current = Date.now();
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
  }, [gameState, foundWords]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Coach — advance to next target when current is found, finish after
  // COACH_WORDS words. Hook lives up here (above any early return) so it
  // runs unconditionally per React's rules-of-hooks. ────────────────────
  useEffect(() => {
    if (coachPhase !== 'guide') return;
    const placed = gameState?.placedWords;
    if (!placed) return;
    const target = placed[coachStep];
    if (!target) return;
    if (foundWords.includes(target.word)) {
      if (coachStep + 1 >= Math.min(COACH_WORDS, placed.length)) {
        setCoachPhase('done');
        try {
          if (typeof window !== 'undefined') window.localStorage.setItem(COACH_SEEN_KEY, '1');
        } catch { /* ignore */ }
        const t = setTimeout(() => setCoachPhase('off'), 2800);
        return () => clearTimeout(t);
      }
      setCoachStep(s => s + 1);
    }
  }, [foundWords, coachStep, coachPhase, gameState]);

  const dismissCoach = useCallback(() => {
    setCoachPhase('off');
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(COACH_SEEN_KEY, '1');
    } catch { /* ignore */ }
  }, []);

  // Manual coach activation — fired by the floating Help button. Reactivates
  // the onboarding flow from word 1, independent of the localStorage gate.
  const activateCoach = useCallback(() => {
    setCoachStep(0);
    setCoachPhase('guide');
  }, []);

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

  // ── Coach — derive target + advance when the target word is found ─────
  const coachTarget = (coachPhase === 'guide' && placedWords[coachStep])
    ? placedWords[coachStep]
    : null;
  const coachCellSet = (() => {
    if (!coachTarget) return null;
    const cells = coachCellsForPlacedWord(coachTarget);
    return new Set(cells.map(c => `${c.row},${c.col}`));
  })();

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

  // Help button is only offered before the child has begun. Once a word is
  // found we hide it — they're clearly underway. Hidden while the coach is
  // already running so it can't double-trigger. Later we'll likely gate
  // this on play-count / time-since-first-game from the session.
  const showHelpButton = foundWords.length === 0 && coachPhase === 'off';

  // When the coach is actively guiding, lock out everything except the
  // target cells and the coach card itself. Two layers:
  //   • full-viewport shield catches clicks outside the wrap (footer / nav)
  //   • the wrap gets a modifier class that disables pointer-events on its
  //     children, with re-enabling rules for coach cells and the card.
  const coachActive = coachPhase === 'guide';

  return (
    <div className={`ws-wrap${coachActive ? ' ws-wrap--coach-active' : ''}`} style={BG_STYLE} onContextMenu={cancelSelection}>

      {/* Full-viewport shield — sits behind the coach card; absorbs all
          clicks so the child can't tap the footer / nav / hub while the
          coach is running. Cells + card sit on higher z-indexes. */}
      {coachActive && <div className="ws-coach-shield" aria-hidden="true" />}

      {/* ── Floating Help button (top-right) — manually activates the
            onboarding coach. Visible only before the game has started. */}
      {showHelpButton && (
        <button
          type="button"
          className="ws-help-btn"
          onClick={activateCoach}
          aria-label="Show help and tutorial"
        >
          <span className="ws-help-btn__icon" aria-hidden="true">?</span>
          <span className="ws-help-btn__label">Help</span>
        </button>
      )}

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

          {/* ── Coach card ── first-time onboarding overlay */}
          {coachPhase !== 'off' && (
            <div
              className={`ws-coach ws-coach--${coachPhase}`}
              role="status"
              aria-live="polite"
            >
              {coachPhase === 'guide' && coachTarget && (
                <>
                  <span className="ws-coach__icon" aria-hidden="true">
                    {coachStep === 0 ? '👀' : '✨'}
                  </span>
                  <div className="ws-coach__body">
                    <div className="ws-coach__title">
                      {coachStep === 0
                        ? <>Find the word <strong>{coachTarget.word.toLowerCase()}</strong></>
                        : <>Great! Now find <strong>{coachTarget.word.toLowerCase()}</strong></>}
                    </div>
                    <div className="ws-coach__hint">
                      {coachStep === 0
                        ? 'Click and drag across the glowing letters.'
                        : 'Look for the glowing letters in the grid.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ws-coach__skip"
                    onClick={dismissCoach}
                    aria-label="Skip the tutorial"
                  >
                    Skip
                  </button>
                </>
              )}
              {coachPhase === 'done' && (
                <>
                  <span className="ws-coach__icon" aria-hidden="true">🌟</span>
                  <div className="ws-coach__body">
                    <div className="ws-coach__title">You've got it!</div>
                    <div className="ws-coach__hint">Find the rest on your own.</div>
                  </div>
                </>
              )}
            </div>
          )}


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
                  const coachClass = (coachCellSet && coachCellSet.has(`${ri},${ci}`) && !found)
                    ? ' ws-cell--coach' : '';
                  return (
                    <div
                      key={`${ri}-${ci}`}
                      className={`ws-cell${found ? ' ws-cell--found' : ''}${cellSelClass}${coachClass}`}
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
            {listSide === 'left' ? '→' : '←'} Switch
          </button>
          <ul className="ws-word-list">
            {placedWords.map(({ word }) => {
              const done = foundWords.includes(word);
              const isCoachTarget = coachTarget && coachTarget.word === word;
              return (
                <li
                  key={word}
                  className={`game-word ws-word-clickable${done ? ' game-word--done' : ''}${isCoachTarget ? ' game-word--coach' : ''}`}
                  onClick={() => setActiveWord(word)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveWord(word); }}
                  title="Tap to see definition"
                >
                  {done && <span className="game-word-check">✓</span>}
                  {word.toLowerCase()}
                </li>
              );
            })}
          </ul>
        </aside>

      </div>

      {/* ── Completion — shared Variant B results over the finished grid ── */}
      {isComplete && (
        <div className="ws-complete-overlay" role="dialog" aria-modal="true" aria-label="Word search complete">
          <GameResults
            variant="B"
            stats={[
              { value: formatDuration(((endTime ?? Date.now()) - startTimeRef.current) / 1000), label: 'Time' },
              { value: foundWords.length, label: 'Words found' },
            ]}
            onContinue={() => {
              // Per-word result for the mastery engine. Word Search is
              // recognition-only — there are no attempts and no hint
              // affordance, so every word is reported as a 1st-attempt
              // outcome with no hint. The 0.5x recognition multiplier is
              // applied centrally in gamificationEngine.
              onSaveProgress?.(null);
              onComplete(words.map((w) => ({
                word:     w,
                correct:  foundWords.includes(w),
                attempts: 1,
                hintUsed: false,
              })));
            }}
          />
        </div>
      )}

      {/* Word detail modal — opened by tapping any word in the sidebar list */}
      {activeWord && (
        <WordDetailModal
          word={activeWord}
          userAge={year ? (year + 4) : 8}
          chipColor="#c77dff"
          onClose={() => setActiveWord(null)}
        />
      )}

      {/* DEV-only: instant complete — fills the grid so the end screen shows. */}
      <DevCompleteButton onClick={handleDevComplete} />

    </div>
  );
}
