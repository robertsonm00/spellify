import React, { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { chunkWord } from '../utils/wordChunking';
import { letterBoxSize } from '../utils/letterBoxSize';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import BuddyAvatar from './BuddyAvatar';
import GameResults from './GameResults';
import DevCompleteButton from './DevCompleteButton';
import './MemorySpell.css';
import { speakWord as speak } from '../utils/speech';
import { SESSION_RETRY_CEILING } from '../utils/retryCeiling';

// Themed background — see Crossword.jsx for the rationale.
const BG_STYLE = {
  '--bg-image-url': `url("${process.env.PUBLIC_URL || ''}/adventure/backgrounds/memory-spell-background.png")`,
};

// ── Success fanfare ───────────────────────────────────────────────────────────

// Three-note trumpet fanfare via Web Audio API (no external file needed).
// sawtooth oscillator gives a brass-like timbre.
// FUTURE: replace with a recorded sample for richer sound.
function playTrumpet() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[523, 0], [659, 0.13], [784, 0.26]].forEach(([freq, delay]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  } catch {
    // AudioContext unavailable or blocked — skip silently.
  }
}

function fireConfetti() {
  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.55 },
    colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f43'],
  });
}

// ── Constants ────────────────────────────────────────────────────────────────

const INITIAL_HINTS = { heard: false, firstLetter: false, letterCount: false, chunk: false };

// ── Letter boxes (recall input) ───────────────────────────────────────────────
//
// One box per letter. A hidden <input> captures all keystrokes.
// Live colour: green = correct position, red = wrong position.

function LetterBoxes({ value, target, inputRef, onChange, onKeyDown }) {
  const boxSize = letterBoxSize(target.length);
  return (
    <div
      className="ms-letter-boxes-wrap"
      onClick={() => inputRef.current?.focus()}
      role="group"
      aria-label="Letter input boxes"
    >
      <div className="ms-letter-boxes" style={{ '--box-size': `${boxSize}px` }}>
        {Array.from({ length: target.length }, (_, i) => {
          const char  = value[i] || '';
          const state = !char
            ? i === value.length ? 'cursor' : 'empty'
            : value[i].toLowerCase() === target[i].toLowerCase() ? 'ok' : 'wrong';
          return (
            <div key={i} className={`ms-letter-box ms-letter-box--${state}`}>
              {char.toUpperCase()}
            </div>
          );
        })}
      </div>
      {/* Hidden but focusable; boxes above are the visual display */}
      <input
        ref={inputRef}
        className="ms-input-hidden"
        type="text"
        inputMode="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        maxLength={target.length}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        aria-label="Type the word"
      />
    </div>
  );
}

// ── Letter diff (feedback) ────────────────────────────────────────────────────

function LetterDiff({ typed, target }) {
  const tLow = target.toLowerCase();
  const iLow = (typed || '').toLowerCase();
  return (
    <div className="ms-diff" aria-label="Letter comparison">
      {tLow.split('').map((char, i) => (
        <span key={i} className={`ms-diff-char ms-diff-char--${iLow[i] === char ? 'ok' : 'wrong'}`}>
          {char}
        </span>
      ))}
      {iLow.slice(tLow.length).split('').map((char, i) => (
        <span key={`x${i}`} className="ms-diff-char ms-diff-char--extra">{char}</span>
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MemorySpell({
  words,
  wordObjects = [],
  childCharacter = null,
  savedProgress = null,
  onSaveProgress,
  onComplete,
  onExit,
  dyslexiaMode = false,
}) {
  // Restore from a mid-session snapshot if one exists.
  const initWordIdx = savedProgress?.wordIdx ?? 0;
  const initResults = savedProgress?.results ?? [];
  const initPhase   = !savedProgress               ? 'intro'
                    : initWordIdx >= words.length  ? 'results'
                    : 'reveal';

  const [phase,      setPhase]      = useState(initPhase);
  const [wordIdx,    setWordIdx]    = useState(initWordIdx);
  const [input,      setInput]      = useState('');
  const [results,    setResults]    = useState(initResults);
  const [hints,      setHints]      = useState({ ...INITIAL_HINTS });
  const [lastResult, setLastResult] = useState(null);
  // Internal session queue — starts as the prop `words` but grows by one
  // when the child gets a word wrong for the first time (push to the end).
  // Subsequent wrong answers on the same word do NOT re-queue, and at most
  // SESSION_RETRY_CEILING distinct words are ever re-queued (SR-01), so the
  // queue length is capped at words.length + SESSION_RETRY_CEILING.
  const [queue,      setQueue]      = useState(() => savedProgress?.queue ?? [...words]);
  const requeuedRef = useRef(new Set(savedProgress?.requeued ?? []));
  const inputRef  = useRef(null);
  const hintsRef  = useRef(hints);
  hintsRef.current = hints; // always current without stale-closure issues

  const word  = queue[wordIdx] ?? '';
  const chunk = chunkWord(word);


  useEffect(() => {
    if (phase === 'recall') inputRef.current?.focus();
    if (phase === 'reveal' && word) speak(word);
  }, [phase, word]);

  // ── Core submit logic ──────────────────────────────────────────────────────
  // Extracted so it can be called both from the Check button and from
  // handleChange when the final correct letter is entered.

  const submitWord = useCallback((value) => {
    const correct = value.toLowerCase() === word.toLowerCase();
    if (correct) {
      playTrumpet();
      fireConfetti();
    }
    const result = { word, correct, hintsUsed: { ...hintsRef.current }, typed: value };
    const next = [...results, result];

    // Silent re-queue (SR-01): on the first wrong attempt for a word, push
    // it to the end of the session queue so the child gets one more shot.
    // Rule 1 — one retry per word (requeuedRef guards repeats). Rule 2 —
    // stop adding retry rounds once SESSION_RETRY_CEILING distinct words
    // have already been re-queued; further wrong words just finish the
    // session and land on the practice list via the mastery-credit flow.
    let nextQueue = queue;
    const lower = word.toLowerCase();
    if (!correct &&
        !requeuedRef.current.has(lower) &&
        requeuedRef.current.size < SESSION_RETRY_CEILING) {
      requeuedRef.current.add(lower);
      nextQueue = [...queue, word];
      setQueue(nextQueue);
    }

    setLastResult(result);
    setResults(next);
    onSaveProgress?.({
      wordIdx: wordIdx + 1,
      results: next,
      queue: nextQueue,
      requeued: Array.from(requeuedRef.current),
    });
    // Stay on the recall screen — the in-place feedback layer takes over.
    // (Phase stays 'recall'; lastResult drives the alternate render.)
  }, [word, wordIdx, results, queue, onSaveProgress]);

  // ── Input handlers ─────────────────────────────────────────────────────────

  const handleChange = (e) => {
    const clean = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, word.length);
    setInput(clean);
    // Auto-submit the instant the final letter makes the word correct.
    if (clean.length === word.length && clean.toLowerCase() === word.toLowerCase()) {
      submitWord(clean);
    }
  };

  const handleSubmit = useCallback(() => {
    if (input.length < word.length) return;
    submitWord(input);
  }, [input, word, submitWord]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
  };

  // ── Phase transitions ──────────────────────────────────────────────────────

  const goReveal = () => setPhase('reveal');

  const goRecall = () => {
    setInput('');
    setHints({ ...INITIAL_HINTS });
    setPhase('recall');
  };

  const handleHint = (key) => {
    setHints(h => ({ ...h, [key]: true }));
    if (key === 'heard') speak(word);
    inputRef.current?.focus();
  };

  // Prevent buttons from stealing focus from the hidden input on click.
  const keepFocus = (e) => e.preventDefault();

  const nextWord = () => {
    setLastResult(null);   // clear inline feedback as we advance
    if (wordIdx + 1 >= queue.length) {
      setPhase('results');
    } else {
      setWordIdx(i => i + 1);
      // Skip the intro screen after the first word.
      setPhase('reveal');
    }
  };

  // Auto-advance after 3s on a correct answer. The CTA shows a fill that
  // mirrors the same 3-second window so the child sees the timer ticking.
  const autoAdvanceTimerRef = useRef(null);
  useEffect(() => {
    if (lastResult?.correct && phase === 'recall') {
      autoAdvanceTimerRef.current = setTimeout(nextWord, 3000);
      return () => clearTimeout(autoAdvanceTimerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastResult, phase]);

  // Buddy holds the cheer pose for ~1 second, then reverts to still even
  // though the success panel stays up until the auto-advance fires.
  const [buddyCheering, setBuddyCheering] = useState(false);
  useEffect(() => {
    if (lastResult?.correct) {
      setBuddyCheering(true);
      const t = setTimeout(() => setBuddyCheering(false), 1000);
      return () => clearTimeout(t);
    }
    setBuddyCheering(false);
  }, [lastResult]);

  // ── DEV-only: instant complete ─────────────────────────────────────────────
  // Mark every word correct and jump to the shared results screen, so the
  // celebration + Continue → onComplete (points / lumens / reward) flow can be
  // exercised without spelling each word.
  const handleDevComplete = () => {
    onSaveProgress?.(null);
    setResults(words.map((w) => ({
      word: w, correct: true, hintsUsed: { ...INITIAL_HINTS }, typed: w,
    })));
    setPhase('results');
  };

  const handleComplete = () => {
    onSaveProgress?.(null); // wipe snapshot — activity is fully done
    // Aggregate per-word for the credit framework. A word can appear up
    // to twice in `results` because of the silent in-session re-queue:
    //   - attempts = number of results for that word (1 or 2)
    //   - correct  = most-recent outcome (rolling — 1st wrong then 2nd
    //                correct counts as correct-on-2nd-attempt)
    //   - hintUsed = any letter-reveal hint across either attempt
    //                ("🔊 Hear it" is treated as core gameplay, not a hint)
    const byWord = {};
    for (const r of results) {
      const key = r.word.toLowerCase();
      const h   = r.hintsUsed || {};
      const hintThisRound = !!(h.firstLetter || h.letterCount || h.chunk);
      const prev = byWord[key];
      if (!prev) {
        byWord[key] = {
          word:     r.word,
          correct:  !!r.correct,
          attempts: 1,
          hintUsed: hintThisRound,
        };
      } else {
        prev.attempts += 1;
        prev.correct  = !!r.correct;       // most-recent outcome wins
        prev.hintUsed = prev.hintUsed || hintThisRound;
      }
    }
    onComplete(Object.values(byWord));
  };

  // Chunk hint hides once the user starts typing.
  const showChunkHint = hints.chunk && input.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  const wrapClass = `ms-wrap game-magical-bg${dyslexiaMode ? ' ms-wrap--es' : ''}`;

  const topbar = <GameHeader title="Memory Spell" onExit={onExit} />;

  const progressBar = (
    <GameProgressStrip percent={(results.length / queue.length) * 100}>
      Word {Math.min(wordIdx + 1, queue.length)} of {queue.length}
    </GameProgressStrip>
  );

  // Small pill placed above the H1 on every phase so the child can always
  // see where they are in the list at a glance.
  const wordCounterPill = (
    <span className="ms-word-counter" aria-label={`Word ${Math.min(wordIdx + 1, queue.length)} of ${queue.length}`}>
      Word {Math.min(wordIdx + 1, queue.length)}<span className="ms-word-counter__sep">/</span>{queue.length}
    </span>
  );

  // ── Results screen ─────────────────────────────────────────────────────────

  if (phase === 'results') {
    // Roll the per-attempt results up to one entry per word. Since
    // Phase 1 added in-session re-queue (a missed word gets a second
    // attempt at the end), a single word can appear up to twice in
    // `results` — once for its first try, once for the re-queued try.
    // The summary shows each word exactly once, classified by its
    // *most recent* outcome:
    //   wrong then right → "Words you got right"
    //   right (only) → "Words you got right"
    //   wrong (only) or wrong both times → "Words to practise"
    const byWord = new Map();
    for (const r of results) {
      const key = String(r.word).toLowerCase();
      // Later entries overwrite earlier ones — that's exactly the
      // rolling-most-recent semantic we want.
      byWord.set(key, { word: r.word, correct: !!r.correct });
    }
    const unique = Array.from(byWord.values());
    const correctWords = unique.filter(e =>  e.correct).map(e => e.word);
    const wrongWords   = unique.filter(e => !e.correct).map(e => e.word);

    return (
      <div className={wrapClass} style={BG_STYLE}>
        {topbar}
        {progressBar}
        <GameResults
          variant="A"
          correctWords={correctWords}
          practiceWords={wrongWords}
          total={words.length}
          onContinue={handleComplete}
        />
      </div>
    );
  }

  // ── Per-word phases ────────────────────────────────────────────────────────

  return (
    <div className={wrapClass} style={BG_STYLE}>
      {topbar}
      {progressBar}
      <DevCompleteButton onClick={handleDevComplete} />

      <div className="ms-stage">

        {/* ── Intro — shown only for the first word ── */}
        {phase === 'intro' && (
          <div className="ms-phase ms-phase--intro">
            <span className="ms-buddy" aria-hidden="true">
              <BuddyAvatar
                id={childCharacter?.id}
                size={120}
                fallback={childCharacter?.emoji}
              />
            </span>
            {wordCounterPill}
            <h1 className="ms-h1">Let's study this one together!</h1>
            <button className="ms-btn ms-btn--primary ms-btn--large" onClick={goReveal}>
              Show me the word ▶
            </button>
          </div>
        )}

        {/* ── Reveal ── */}
        {phase === 'reveal' && (
          <div className="ms-phase ms-phase--reveal">
            <span className="ms-buddy" aria-hidden="true">
              <BuddyAvatar
                id={childCharacter?.id}
                size={120}
                fallback={childCharacter?.emoji}
              />
            </span>
            {wordCounterPill}
            <h1 className="ms-h1">Study this word carefully</h1>
            <div className="ms-word-display">
              <span className="ms-word-big">{word}</span>
            </div>
            <div className="ms-chunk-display" aria-label={`Chunks: ${chunk}`}>
              {chunk}
            </div>
            <button className="ms-hint-btn" onClick={() => speak(word)} title="Hear this word">
              🔊 Hear it
            </button>
            <button className="ms-btn ms-btn--primary ms-btn--large" onClick={goRecall}>
              I'm ready — hide it! 🫣
            </button>
          </div>
        )}

        {/* ── Recall ── */}
        {phase === 'recall' && (
          <div className="ms-phase ms-phase--recall">
            <span className="ms-buddy" aria-hidden="true">
              <BuddyAvatar
                id={childCharacter?.id}
                size={120}
                fallback={childCharacter?.emoji}
                cheering={buddyCheering}
              />
            </span>
            {wordCounterPill}
            <h1 className="ms-h1">
              {lastResult?.correct === false
                ? "Almost — let's look at the tricky bit"
                : 'Your word has disappeared. Can you bring it back?'}
            </h1>

            <div className="ms-hint-reveals">
              {!lastResult?.correct && hints.firstLetter && (
                <span className="ms-hint-chip">
                  First letter: <strong>{word[0].toUpperCase()}</strong>
                </span>
              )}
              {!lastResult?.correct && hints.letterCount && (
                <span className="ms-hint-chip">{word.length} letters</span>
              )}
              {!lastResult?.correct && showChunkHint && (
                <span className="ms-hint-chip">
                  Chunks: <strong>{chunk}</strong>
                </span>
              )}
            </div>

            {/* Pre-submit: input + check + hints. Once submitted, the
                feedback layer below replaces these. */}
            {!lastResult && (
              <>
                <LetterBoxes
                  value={input}
                  target={word}
                  inputRef={inputRef}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                />

                <button
                  className="ms-btn ms-btn--primary"
                  onClick={handleSubmit}
                  disabled={input.length < word.length}
                >
                  Check ✓
                </button>

                <div className="ms-powerups">
                  <span className="ms-powerups-label">Need a hint?</span>
                  <button
                    className={`ms-hint-btn${hints.heard ? ' ms-hint-btn--used' : ''}`}
                    onMouseDown={keepFocus}
                    onClick={() => handleHint('heard')}
                    title="Hear the word again"
                  >
                    🔊 Hear it
                  </button>
                  <button
                    className={`ms-hint-btn${hints.firstLetter ? ' ms-hint-btn--used' : ''}`}
                    onMouseDown={keepFocus}
                    onClick={() => handleHint('firstLetter')}
                    disabled={hints.firstLetter}
                    title="Reveal the first letter"
                  >
                    🔤 First letter
                  </button>
                  <button
                    className={`ms-hint-btn${hints.letterCount ? ' ms-hint-btn--used' : ''}`}
                    onMouseDown={keepFocus}
                    onClick={() => handleHint('letterCount')}
                    disabled={hints.letterCount}
                    title="Show how many letters"
                  >
                    🔢 Letter count
                  </button>
                  <button
                    className={`ms-hint-btn${hints.chunk ? ' ms-hint-btn--used' : ''}`}
                    onMouseDown={keepFocus}
                    onClick={() => handleHint('chunk')}
                    disabled={hints.chunk}
                    title="Show word chunks"
                  >
                    🧩 Show chunks
                  </button>
                </div>
              </>
            )}

            {/* Correct: tinted-green success panel + auto-advancing Next. */}
            {lastResult?.correct && (
              <div className="ms-success-panel" role="status" aria-live="polite">
                <p className="ms-success-msg">🎉 You got it right!</p>
                <span className="ms-word-big ms-word-big--correct">{word}</span>
                <button
                  className="ms-btn ms-btn--primary ms-btn--large ms-btn--auto"
                  onClick={() => {
                    clearTimeout(autoAdvanceTimerRef.current);
                    nextWord();
                  }}
                >
                  <span className="ms-btn-auto-fill" aria-hidden="true" />
                  <span className="ms-btn-auto-label">
                    {wordIdx + 1 >= words.length ? 'See results ▶' : 'Next word ▶'}
                  </span>
                </button>
              </div>
            )}

            {/* Wrong: pink-tinted panel mirroring the success panel. */}
            {lastResult?.correct === false && (
              <div className="ms-wrong-panel" role="status" aria-live="polite">
                <LetterDiff typed={lastResult.typed} target={word} />
                <p className="ms-wrong-msg">Good try! The word was...</p>
                <span className="ms-word-big ms-word-big--wrong">{word}</span>
                <span className="ms-chunk-display">{chunk}</span>
                <button className="ms-btn ms-btn--primary ms-btn--large" onClick={nextWord}>
                  {wordIdx + 1 >= words.length ? 'See results ▶' : 'Next word ▶'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
