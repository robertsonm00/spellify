import React, { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { chunkWord } from '../utils/wordChunking';
import { letterBoxSize } from '../utils/letterBoxSize';
import './MemorySpell.css';

// ── Speech (en-GB) ───────────────────────────────────────────────────────────

let cachedUkVoice = null;
function pickUkVoice() {
  if (cachedUkVoice) return cachedUkVoice;
  const voices = window.speechSynthesis?.getVoices?.() || [];
  cachedUkVoice =
    voices.find(v => v.lang === 'en-GB') ||
    voices.find(v => v.lang?.startsWith('en-GB')) ||
    null;
  return cachedUkVoice;
}

function speak(word) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-GB';
  u.rate = 0.85;
  const v = pickUkVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

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

const BUDDY_LINES = [
  "Let's study this one together!",
  "Take a good look — I'll hide it in a moment!",
  "Ready to memorise this word?",
  "You've got this — study hard!",
];

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
  onComplete,
  onExit,
  dyslexiaMode = false,
}) {
  const [phase,      setPhase]      = useState('intro');
  const [wordIdx,    setWordIdx]    = useState(0);
  const [input,      setInput]      = useState('');
  const [results,    setResults]    = useState([]);
  const [hints,      setHints]      = useState({ ...INITIAL_HINTS });
  const [lastResult, setLastResult] = useState(null);
  const inputRef  = useRef(null);
  const hintsRef  = useRef(hints);
  hintsRef.current = hints; // always current without stale-closure issues

  const word  = words[wordIdx] ?? '';
  const chunk = chunkWord(word);

  // Warm up speech voices (Chrome loads them asynchronously).
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    pickUkVoice();
    const onChange = () => { cachedUkVoice = null; pickUkVoice(); };
    window.speechSynthesis.addEventListener?.('voiceschanged', onChange);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', onChange);
  }, []);

  useEffect(() => {
    if (phase === 'recall') inputRef.current?.focus();
  }, [phase]);

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
    setLastResult(result);
    setResults(prev => [...prev, result]);
    setPhase('feedback');
  }, [word]);

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
  };

  const nextWord = () => {
    if (wordIdx + 1 >= words.length) {
      setPhase('results');
    } else {
      setWordIdx(i => i + 1);
      // Skip the intro screen after the first word.
      setPhase('reveal');
    }
  };

  const handlePlayAgain = () => {
    setWordIdx(0);
    setResults([]);
    setLastResult(null);
    setInput('');
    setHints({ ...INITIAL_HINTS });
    setPhase('intro');
  };

  const handleComplete = () => {
    onComplete(results.map(r => ({ word: r.word, correct: r.correct })));
  };

  // Chunk hint hides once the user starts typing.
  const showChunkHint = hints.chunk && input.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  const wrapClass = `ms-wrap${dyslexiaMode ? ' ms-wrap--es' : ''}`;

  // Topbar is shared across all phases.
  const topbar = (
    <div className="ms-topbar">
      <button className="ms-back" onClick={onExit}>← Hub</button>
      <h2 className="ms-title">Memory Spell</h2>
    </div>
  );

  // Progress bar fills as results accumulate; 100% when all words are done.
  const progressBar = (
    <>
      <div className="ms-progress-bar-track">
        <div
          className="ms-progress-bar-fill"
          style={{ width: `${(results.length / words.length) * 100}%` }}
        />
      </div>
      <p className="ms-progress-label">Word {Math.min(wordIdx + 1, words.length)} of {words.length}</p>
    </>
  );

  // ── Results screen ─────────────────────────────────────────────────────────

  if (phase === 'results') {
    const correctWords = results.filter(r =>  r.correct).map(r => r.word);
    const wrongWords   = results.filter(r => !r.correct).map(r => r.word);
    const score        = correctWords.length;
    const perfect      = score === words.length;

    return (
      <div className={wrapClass}>
        {topbar}
        {progressBar}
        <div className="ms-results">
          <div className="ms-results-score">
            <span className="ms-score-emoji">
              {perfect ? '⭐' : score >= Math.ceil(words.length / 2) ? '🌟' : '💪'}
            </span>
            <span className="ms-score-num">{score} / {words.length}</span>
            <span className="ms-score-label">
              {perfect ? 'Perfect — every word recalled!' : 'words recalled correctly'}
            </span>
          </div>

          {correctWords.length > 0 && (
            <div className="ms-results-section">
              <h3 className="ms-results-heading ms-results-heading--good">✅ Words you got right</h3>
              <div className="ms-results-chips">
                {correctWords.map(w => (
                  <span key={w} className="ms-results-chip ms-results-chip--good">{w}</span>
                ))}
              </div>
            </div>
          )}

          {wrongWords.length > 0 && (
            <div className="ms-results-section">
              <h3 className="ms-results-heading ms-results-heading--practice">📝 Words to practise</h3>
              <div className="ms-results-chips">
                {wrongWords.map(w => (
                  <span key={w} className="ms-results-chip ms-results-chip--practice">{w}</span>
                ))}
              </div>
            </div>
          )}

          <div className="ms-results-btns">
            <button className="ms-btn ms-btn--secondary" onClick={handlePlayAgain}>↺ Play again</button>
            <button className="ms-btn ms-btn--primary"   onClick={handleComplete}>Back to Hub ▶</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Per-word phases ────────────────────────────────────────────────────────

  const buddyLine = BUDDY_LINES[wordIdx % BUDDY_LINES.length];

  return (
    <div className={wrapClass}>
      {topbar}
      {progressBar}

      <div className="ms-stage">

        {/* ── Intro — shown only for the first word ── */}
        {phase === 'intro' && (
          <div className="ms-card ms-card--intro">
            {/* FUTURE: swap for animated buddy character */}
            <span className="ms-buddy-emoji" aria-hidden="true">🦉</span>
            <p className="ms-buddy-line">{buddyLine}</p>
            <button className="ms-btn ms-btn--primary ms-btn--large" onClick={goReveal}>
              Show me the word ▶
            </button>
          </div>
        )}

        {/* ── Reveal ── */}
        {phase === 'reveal' && (
          <div className="ms-card ms-card--reveal">
            {/* FUTURE: swap for animated buddy character */}
            <span className="ms-buddy-emoji" aria-hidden="true">🦉</span>
            <p className="ms-phase-hint">Study this word carefully</p>
            {/* FUTURE: add letter-by-letter reveal animation on entry */}
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
          <div className="ms-card ms-card--recall">
            <p className="ms-phase-hint">
              The word has disappeared! Can you bring it back?
            </p>

            <div className="ms-hint-reveals">
              {hints.firstLetter && (
                <span className="ms-hint-chip">
                  First letter: <strong>{word[0].toUpperCase()}</strong>
                </span>
              )}
              {hints.letterCount && (
                <span className="ms-hint-chip">{word.length} letters</span>
              )}
              {showChunkHint && (
                <span className="ms-hint-chip">
                  Chunks: <strong>{chunk}</strong>
                </span>
              )}
            </div>

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
                onClick={() => handleHint('heard')}
                title="Hear the word again"
              >
                🔊 Hear it
              </button>
              <button
                className={`ms-hint-btn${hints.firstLetter ? ' ms-hint-btn--used' : ''}`}
                onClick={() => handleHint('firstLetter')}
                disabled={hints.firstLetter}
                title="Reveal the first letter"
              >
                🔤 First letter
              </button>
              <button
                className={`ms-hint-btn${hints.letterCount ? ' ms-hint-btn--used' : ''}`}
                onClick={() => handleHint('letterCount')}
                disabled={hints.letterCount}
                title="Show how many letters"
              >
                🔢 Letter count
              </button>
              <button
                className={`ms-hint-btn${hints.chunk ? ' ms-hint-btn--used' : ''}`}
                onClick={() => handleHint('chunk')}
                disabled={hints.chunk}
                title="Show word chunks"
              >
                🧩 Show chunks
              </button>
            </div>
          </div>
        )}

        {/* ── Feedback ── */}
        {phase === 'feedback' && lastResult && (
          <div className={`ms-card ms-card--feedback${lastResult.correct ? ' ms-card--correct' : ' ms-card--wrong'}`}>
            {lastResult.correct ? (
              <>
                <span className="ms-feedback-emoji">🎉</span>
                <p className="ms-feedback-msg ms-feedback-msg--correct">You brought it back!</p>
                <span className="ms-word-answer">{word}</span>
              </>
            ) : (
              <>
                {/* FUTURE: trigger gentle near-miss sound here */}
                <span className="ms-feedback-emoji">🤔</span>
                <p className="ms-feedback-msg ms-feedback-msg--wrong">
                  Almost — let's look at the tricky bit
                </p>
                <LetterDiff typed={lastResult.typed} target={word} />
                <div className="ms-answer-reveal">
                  <span className="ms-answer-label">The word was:</span>
                  <span className="ms-word-answer">{word}</span>
                  <span className="ms-chunk-display">{chunk}</span>
                </div>
              </>
            )}

            {Object.values(lastResult.hintsUsed).some(Boolean) && (
              <p className="ms-hints-used">
                Hints used: {[
                  lastResult.hintsUsed.heard       && '🔊 heard',
                  lastResult.hintsUsed.firstLetter && '🔤 first letter',
                  lastResult.hintsUsed.letterCount && '🔢 letter count',
                  lastResult.hintsUsed.chunk       && '🧩 chunks',
                ].filter(Boolean).join(', ')}
              </p>
            )}

            <button className="ms-btn ms-btn--primary ms-btn--large" onClick={nextWord}>
              {wordIdx + 1 >= words.length ? 'See results ▶' : 'Next word ▶'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
