import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { buildQuiz } from '../utils/quizQuestionBuilder';
import DEFINITIONS from '../data/definitions.js';
import { letterBoxSize } from '../utils/letterBoxSize';
import './QuizQuest.css';

// ── Speech (en-GB) ───────────────────────────────────────────────────────────

let cachedUkVoice = null;
function pickUkVoice() {
  if (cachedUkVoice) return cachedUkVoice;
  const voices = window.speechSynthesis?.getVoices?.() || [];
  cachedUkVoice =
    voices.find((v) => v.lang === 'en-GB') ||
    voices.find((v) => v.lang?.startsWith('en-GB')) ||
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

// ── Success fanfare ──────────────────────────────────────────────────────────

// Two-note ascending chime; lighter than MemorySpell's 3-note fanfare
// because Quiz Quest fires on every correct answer.
// FUTURE: replace with a recorded sample.
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[659, 0], [988, 0.1]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch {
    // AudioContext unavailable — silent fail
  }
}

function fireConfetti() {
  confetti({
    particleCount: 60,
    spread: 60,
    origin: { y: 0.55 },
    colors: ['#ec4899', '#a855f7', '#4d96ff', '#ffd93d', '#6bcb77'],
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const isCorrectAnswer = (given, expected) =>
  (given || '').trim().toLowerCase() === expected.trim().toLowerCase();

// ── Letter-box helpers (typed-answer questions) ─────────────────────────────
//
// FixWordBoxes        — every letter is editable
// MissingLettersBoxes — pre-filled letters are locked; only the underscores
//                       receive typed input
//
// Both use a single hidden <input> to capture keystrokes and render the
// child's input as a row of styled boxes with live position-correct feedback
// (green = right letter, red = wrong letter). Auto-submit fires the moment
// the typed answer matches the target.

function FixWordBoxes({ question, onAnswer }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const target = question.answer;
  const boxSize = letterBoxSize(target.length);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e) => {
    const clean = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, target.length);
    setInput(clean);
    // Auto-submit the moment the typed answer matches.
    if (clean.length === target.length && clean.toLowerCase() === target.toLowerCase()) {
      onAnswer(clean);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onAnswer(input); }
  };

  return (
    <>
      <div
        className="qq-letter-boxes-wrap"
        onClick={() => inputRef.current?.focus()}
        role="group"
        aria-label="Letter input boxes"
      >
        <div className="qq-letter-boxes" style={{ '--box-size': `${boxSize}px` }}>
          {Array.from({ length: target.length }, (_, i) => {
            const char = input[i] || '';
            const state = !char
              ? i === input.length ? 'cursor' : 'empty'
              : char.toLowerCase() === target[i].toLowerCase() ? 'ok' : 'wrong';
            return (
              <div key={i} className={`qq-letter-box qq-letter-box--${state}`}>
                {char.toUpperCase()}
              </div>
            );
          })}
        </div>
        <input
          ref={inputRef}
          className="qq-input-hidden"
          type="text"
          inputMode="text"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={target.length}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          aria-label="Type the correct spelling"
        />
      </div>
      <button
        className="qq-submit"
        onClick={() => onAnswer(input)}
        disabled={input.length < target.length}
      >
        Submit
      </button>
    </>
  );
}

function MissingLettersBoxes({ question, onAnswer }) {
  const [typed,    setTyped]    = useState('');
  const [showClue, setShowClue] = useState(false);
  const inputRef = useRef(null);

  const target  = question.answer;
  const display = question.displayText;
  const def     = DEFINITIONS[target.toLowerCase()];

  // Indices in `display` that are blanks (in left-to-right order).
  const blankPositions = useMemo(() => {
    const out = [];
    for (let i = 0; i < display.length; i++) {
      if (display[i] === '_') out.push(i);
    }
    return out;
  }, [display]);

  const boxSize = letterBoxSize(display.length);

  useEffect(() => {
    // Pre-focus the first blank so the child can start typing immediately.
    inputRef.current?.focus();
  }, []);

  // Rebuild the full word with currently-typed gap letters slotted in.
  const reconstruct = (gaps) => {
    const arr = display.split('');
    blankPositions.forEach((pos, idx) => {
      arr[pos] = gaps[idx] || '';
    });
    return arr.join('');
  };

  const handleChange = (e) => {
    const clean = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, blankPositions.length);
    setTyped(clean);
    // Auto-submit when every blank is filled AND the result is correct.
    if (clean.length === blankPositions.length) {
      const full = reconstruct(clean);
      if (full.toLowerCase() === target.toLowerCase()) {
        onAnswer(full);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onAnswer(reconstruct(typed)); }
  };

  return (
    <>
      <div
        className="qq-letter-boxes-wrap"
        onClick={() => inputRef.current?.focus()}
        role="group"
        aria-label="Word with missing letters"
      >
        <div className="qq-letter-boxes" style={{ '--box-size': `${boxSize}px` }}>
          {display.split('').map((ch, i) => {
            // Locked, pre-filled letter
            if (ch !== '_') {
              return (
                <div key={i} className="qq-letter-box qq-letter-box--filled">
                  {ch.toUpperCase()}
                </div>
              );
            }
            // Blank position — display the corresponding typed letter (if any)
            const blankIdx = blankPositions.indexOf(i);
            const t = typed[blankIdx] || '';
            const targetChar = target[i].toLowerCase();
            const state = !t
              ? blankIdx === typed.length ? 'cursor' : 'empty'
              : t.toLowerCase() === targetChar ? 'ok' : 'wrong';
            return (
              <div key={i} className={`qq-letter-box qq-letter-box--${state}`}>
                {t.toUpperCase()}
              </div>
            );
          })}
        </div>
        <input
          ref={inputRef}
          className="qq-input-hidden"
          type="text"
          inputMode="text"
          value={typed}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={blankPositions.length}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          aria-label="Fill in the missing letters"
        />
      </div>

      {/* Clue affordances: definition (when available) + audio playback */}
      <div className="qq-clue-area">
        {def && !showClue && (
          <button className="qq-clue-btn" onClick={() => setShowClue(true)}>
            💡 Need a clue?
          </button>
        )}
        <button className="qq-clue-btn" onClick={() => speak(target)}>
          🔊 Hear it
        </button>
      </div>
      {showClue && def && (
        <p className="qq-clue-def">"{def}"</p>
      )}

      <button
        className="qq-submit"
        onClick={() => onAnswer(reconstruct(typed))}
        disabled={typed.length < blankPositions.length}
      >
        Submit
      </button>
    </>
  );
}

// ── Question card ────────────────────────────────────────────────────────────
//
// Renders the appropriate UI for the active question type and surfaces the
// child's answer via onAnswer(value). Internal input/selection state is reset
// by changing the React `key` whenever the question advances.

function QuestionCard({ question, onAnswer, dyslexiaMode }) {
  const [selected, setSelected] = useState(null);

  // Auto-play audio for hear_and_choose on mount.
  useEffect(() => {
    if (question.type === 'hear_and_choose') {
      const t = setTimeout(() => speak(question.answer), 250);
      return () => clearTimeout(t);
    }
  }, [question]);

  const handleOptionClick = (opt) => {
    if (selected) return; // freeze once chosen
    setSelected(opt);
    onAnswer(opt);
  };

  // ── Multiple-choice types ──────────────────────────────────────────────────
  const isChoice =
    question.type === 'choose_spelling' ||
    question.type === 'hear_and_choose' ||
    question.type === 'match_definition';

  if (isChoice) {
    return (
      <div className="qq-card">
        <p className="qq-prompt">{question.prompt}</p>

        {question.type === 'match_definition' && (
          <p className="qq-definition">"{question.definition}"</p>
        )}

        {question.type === 'hear_and_choose' && (
          <button
            className="qq-replay-btn"
            onClick={() => speak(question.answer)}
            title="Hear the word again"
          >
            🔊 Replay
          </button>
        )}

        <div className={`qq-options${dyslexiaMode ? ' qq-options--es' : ''}`}>
          {question.options.map((opt) => (
            <button
              key={opt}
              className={`qq-option${selected === opt ? ' qq-option--selected' : ''}`}
              onClick={() => handleOptionClick(opt)}
              disabled={!!selected}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Typed-answer types ─────────────────────────────────────────────────────

  if (question.type === 'fix_the_word') {
    return (
      <div className="qq-card">
        <p className="qq-prompt">{question.prompt}</p>
        {/* FUTURE: shake animation on the misspelled word */}
        <div className="qq-display qq-display--wrong">{question.displayText}</div>
        <p className="qq-display-hint">Type the correct spelling below</p>
        <FixWordBoxes question={question} onAnswer={onAnswer} />
      </div>
    );
  }

  if (question.type === 'missing_letters') {
    return (
      <div className="qq-card">
        <p className="qq-prompt">{question.prompt}</p>
        <MissingLettersBoxes question={question} onAnswer={onAnswer} />
      </div>
    );
  }

  return null;
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

// ── Main component ───────────────────────────────────────────────────────────

export default function QuizQuest({
  words,
  wordObjects = [],
  savedProgress = null,
  onSaveProgress,
  onComplete,
  onExit,
  dyslexiaMode = false,
}) {
  // Build the quiz once per mount. useMemo ensures we don't reshuffle on
  // every state change.
  const questions = useMemo(() => buildQuiz(words, { count: 10 }), [words]);

  const [phase,      setPhase]      = useState(savedProgress ? 'question' : 'start');
  const [qIdx,       setQIdx]       = useState(savedProgress?.qIdx ?? 0);
  const [results,    setResults]    = useState(savedProgress?.results ?? []);
  const [lastResult,      setLastResult]      = useState(null);
  const [confirmRestart,  setConfirmRestart]  = useState(false);

  const question = questions[qIdx] ?? null;

  // ── Phase transitions ──────────────────────────────────────────────────────

  const handleStart = () => setPhase('question');

  const handleAnswer = useCallback(
    (given) => {
      if (!question) return;
      const correct = isCorrectAnswer(given, question.answer);
      if (correct) {
        playChime();
        fireConfetti();
      }
      const result = { word: question.word, correct, given };
      const next = [...results, result];
      setLastResult(result);
      setResults(next);
      onSaveProgress?.({ qIdx: qIdx + 1, results: next });
      setPhase('feedback');
    },
    [question, qIdx, results, onSaveProgress]
  );

  const handleNext = () => {
    if (qIdx + 1 >= questions.length) {
      setPhase('results');
    } else {
      setQIdx((i) => i + 1);
      setPhase('question');
    }
  };

  const handlePlayAgain = () => {
    onSaveProgress?.(null);
    setQIdx(0);
    setResults([]);
    setLastResult(null);
    setPhase('start');
  };

  const handleRestartClick = () => {
    const hasProgress = qIdx > 0 || results.length > 0;
    if (hasProgress && phase !== 'results') setConfirmRestart(true);
    else handlePlayAgain();
  };

  const handleComplete = () => {
    onSaveProgress?.(null);
    // Collapse multiple results-per-word into a single { word, correct } per
    // unique word so mastery tracking sees the right outcome.
    const byWord = {};
    for (const r of results) {
      const key = r.word.toLowerCase();
      if (!(key in byWord)) byWord[key] = { word: r.word, correct: r.correct };
      else byWord[key].correct = byWord[key].correct && r.correct;
    }
    onComplete(Object.values(byWord));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const wrapClass = `qq-wrap${dyslexiaMode ? ' qq-wrap--es' : ''}`;

  const topbar = (
    <div className="qq-topbar">
      <div className="qq-topbar-stars" aria-hidden="true">
        {HEADER_STARS.map((s) => (
          <span key={s.id} className={`qq-topbar-star${s.dim ? ' qq-topbar-star--dim' : ''}`}
            style={{ left: `${s.left}%`, top: `${s.top}%`, fontSize: `${s.size}px` }}>★</span>
        ))}
      </div>
      <button className="qq-back" onClick={onExit}>← Exit</button>
      <div className="qq-topbar-center">
        <span className="qq-topbar-brand" aria-label="Spellify">
          {BRAND_LETTERS.map(({ letter, color }, i) => (
            <span key={i} className="qq-brand-letter" style={{ color, animationDelay: `${i * 0.08}s` }}>{letter}</span>
          ))}
        </span>
        <h2 className="qq-title">Quiz Quest</h2>
      </div>
      <div className="qq-topbar-right">
        <button className="qq-restart" onClick={handleRestartClick} title="Restart quiz">↺ Restart</button>
      </div>
    </div>
  );

  // Empty / no-questions state — happens if words array is empty or every
  // word was too short for any question type to build.
  if (questions.length === 0) {
    return (
      <div className={wrapClass}>
        {topbar}
        <div className="qq-stage">
          <div className="qq-card">
            <p className="qq-prompt">No quiz questions could be built from your word list.</p>
            <button className="qq-btn qq-btn--primary" onClick={onExit}>← Back to Hub</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Start screen ───────────────────────────────────────────────────────────

  if (phase === 'start') {
    return (
      <div className={wrapClass}>
        {topbar}
        <div className="qq-stage">
          <div className="qq-card qq-card--start">
            {/* FUTURE: replace emoji with animated buddy character */}
            <span className="qq-buddy-emoji" aria-hidden="true">🦉</span>
            <h3 className="qq-start-heading">Quiz Quest</h3>
            <p className="qq-start-sub">Solve quick word challenges with your buddy</p>
            <p className="qq-start-meta">{questions.length} questions</p>
            <button className="qq-btn qq-btn--primary qq-btn--large" onClick={handleStart}>
              Start quest ▶
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Results screen ─────────────────────────────────────────────────────────

  if (phase === 'results') {
    const correctCount = results.filter((r) => r.correct).length;
    const total        = results.length;
    const pct          = Math.round((correctCount / total) * 100);
    const wrongWords   = [...new Set(results.filter((r) => !r.correct).map((r) => r.word))];

    let summary = "Keep practising — you're getting stronger!";
    let emoji   = '💪';
    if (pct === 100)      { summary = 'A perfect quest!'; emoji = '⭐'; }
    else if (pct >= 70)   { summary = 'Great work!';      emoji = '🌟'; }
    else if (pct >= 50)   { summary = 'Nice progress!';   emoji = '👍'; }

    return (
      <div className={wrapClass}>
        {topbar}
        <div className="qq-results">
          <div className="qq-results-score">
            <span className="qq-score-emoji">{emoji}</span>
            <span className="qq-score-num">{correctCount} / {total}</span>
            <span className="qq-score-label">{summary}</span>
          </div>

          {wrongWords.length > 0 && (
            <div className="qq-results-section">
              <h3 className="qq-results-heading">📝 Words to practise</h3>
              <div className="qq-results-chips">
                {wrongWords.map((w) => (
                  <span key={w} className="qq-results-chip">{w}</span>
                ))}
              </div>
            </div>
          )}

          <div className="qq-results-btns">
            <button className="qq-btn qq-btn--secondary" onClick={handlePlayAgain}>↺ Play again</button>
            <button className="qq-btn qq-btn--primary"   onClick={handleComplete}>Back to Hub ▶</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Question / feedback ────────────────────────────────────────────────────

  const progressPct = (results.length / questions.length) * 100;

  return (
    <div className={wrapClass}>
      {topbar}

      <div className="qq-progress-bar-track">
        <div className="qq-progress-bar-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="qq-progress-label">Question {qIdx + 1} of {questions.length}</p>

      <div className="qq-stage">

        {phase === 'question' && question && (
          // key={question.id} resets internal state when the question changes
          <QuestionCard
            key={question.id}
            question={question}
            onAnswer={handleAnswer}
            dyslexiaMode={dyslexiaMode}
          />
        )}

        {phase === 'feedback' && lastResult && (
          <div className={`qq-card qq-card--feedback${lastResult.correct ? ' qq-card--correct' : ' qq-card--wrong'}`}>
            {lastResult.correct ? (
              <>
                {/* FUTURE: bigger animated reaction here */}
                <span className="qq-feedback-emoji">🎉</span>
                <p className="qq-feedback-msg qq-feedback-msg--correct">Nice one!</p>
                <span className="qq-feedback-answer">{question.answer}</span>
              </>
            ) : (
              <>
                {/* FUTURE: gentle near-miss sound */}
                <span className="qq-feedback-emoji">🤔</span>
                <p className="qq-feedback-msg qq-feedback-msg--wrong">
                  Good try — let's look again
                </p>
                <div className="qq-feedback-detail">
                  <span className="qq-feedback-label">You answered:</span>
                  <span className="qq-feedback-given">{lastResult.given || '—'}</span>
                  <span className="qq-feedback-label">Correct answer:</span>
                  <span className="qq-feedback-answer">{question.answer}</span>
                </div>
              </>
            )}

            <button className="qq-btn qq-btn--primary qq-btn--large" onClick={handleNext}>
              {qIdx + 1 >= questions.length ? 'See results ▶' : 'Next ▶'}
            </button>
          </div>
        )}

      </div>

      {confirmRestart && (
        <div className="exit-overlay" onClick={() => setConfirmRestart(false)}>
          <div className="exit-modal" onClick={e => e.stopPropagation()}>
            <div className="exit-modal-icon">↺</div>
            <h2 className="exit-modal-title">Restart?</h2>
            <p className="exit-modal-body">You'll lose your progress so far.</p>
            <div className="exit-modal-btns">
              <button className="exit-btn exit-btn--cancel" onClick={() => setConfirmRestart(false)}>Keep going</button>
              <button className="exit-btn exit-btn--confirm" onClick={() => { setConfirmRestart(false); handlePlayAgain(); }}>Yes, restart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
