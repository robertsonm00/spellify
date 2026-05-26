import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { buildQuiz } from '../utils/quizQuestionBuilder';
import { getClueSync } from '../utils/clueResolver';
import { letterBoxSize } from '../utils/letterBoxSize';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import RestartButton from './RestartButton';
import BuddyAvatar from './BuddyAvatar';
import './QuizQuest.css';
import { speakWord as speak } from '../utils/speech';

const QUESTION_H1 = {
  choose_spelling:  'Which is the right spelling?',
  hear_and_choose:  'Which word did you hear?',
  match_definition: 'Match the word to its meaning',
  fix_the_word:     'Fix the spelling!',
  missing_letters:  'Fill in the missing letters',
};

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

function MissingLettersBoxes({ question, onAnswer, year }) {
  const [typed,    setTyped]    = useState('');
  const [showClue, setShowClue] = useState(false);
  const inputRef = useRef(null);

  const target  = question.answer;
  const display = question.displayText;
  const def     = getClueSync(target, year);

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
        onAnswer(full, { hintUsed: showClue });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onAnswer(reconstruct(typed), { hintUsed: showClue }); }
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
        onClick={() => onAnswer(reconstruct(typed), { hintUsed: showClue })}
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

function QuestionCard({ question, onAnswer, dyslexiaMode, year }) {
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
        <MissingLettersBoxes question={question} onAnswer={onAnswer} year={year} />
      </div>
    );
  }

  return null;
}


// ── Main component ───────────────────────────────────────────────────────────

export default function QuizQuest({
  words,
  wordObjects = [],
  year = null,
  childCharacter = null,
  savedProgress = null,
  onSaveProgress,
  onComplete,
  onExit,
  dyslexiaMode = false,
}) {
  // Build the quiz once per mount. useMemo ensures we don't reshuffle on
  // every state change.
  const baseQuestions = useMemo(
    () => buildQuiz(words, { count: 10, year, wordObjects }),
    [words], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [phase,      setPhase]      = useState(savedProgress ? 'question' : 'start');
  const [qIdx,       setQIdx]       = useState(savedProgress?.qIdx ?? 0);
  const [results,    setResults]    = useState(savedProgress?.results ?? []);
  const [lastResult,      setLastResult]      = useState(null);
  // Silent re-queue: questions appended to the back of the quiz when the
  // child gets a word wrong for the first time. Capped at one re-queue
  // per word per session.
  const [extraQuestions, setExtraQuestions] = useState(savedProgress?.extraQuestions ?? []);
  const requeuedRef = useRef(new Set(savedProgress?.requeued ?? []));

  // Effective question list = base quiz + any silent re-queues.
  const questions = useMemo(
    () => [...baseQuestions, ...extraQuestions],
    [baseQuestions, extraQuestions],
  );

  const question = questions[qIdx] ?? null;

  const autoAdvanceTimerRef = useRef(null);
  const [buddyCheering, setBuddyCheering] = useState(false);

  // Auto-advance 3 s after a correct answer, matching MemorySpell behaviour.
  useEffect(() => {
    if (phase === 'feedback' && lastResult?.correct) {
      autoAdvanceTimerRef.current = setTimeout(handleNext, 3000);
      return () => clearTimeout(autoAdvanceTimerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lastResult]);

  // Buddy cheer pose for ~1 s on correct answer.
  useEffect(() => {
    if (lastResult?.correct) {
      setBuddyCheering(true);
      const t = setTimeout(() => setBuddyCheering(false), 1000);
      return () => clearTimeout(t);
    }
    setBuddyCheering(false);
  }, [lastResult]);

  // ── Phase transitions ──────────────────────────────────────────────────────

  const handleStart = () => setPhase('question');

  const handleAnswer = useCallback(
    (given, meta = {}) => {
      if (!question) return;
      const correct = isCorrectAnswer(given, question.answer);
      if (correct) {
        playChime();
        fireConfetti();
      }
      // `hintUsed` flows up from question subcomponents that expose a
      // 💡 affordance (currently only MissingLettersBoxes — others
      // either have no hint or supply false implicitly).
      const result = { word: question.word, correct, given, hintUsed: !!meta.hintUsed };
      const next = [...results, result];

      // Silent re-queue: on the first wrong answer for this word in the
      // session, append a fresh question for that word to the end of
      // the quiz. The child gets one more shot before the session ends.
      let nextExtras = extraQuestions;
      const lower = String(question.word || '').toLowerCase();
      if (!correct && !requeuedRef.current.has(lower)) {
        const followUps = buildQuiz([question.word], { count: 1, year, wordObjects });
        if (followUps.length > 0) {
          requeuedRef.current.add(lower);
          nextExtras = [...extraQuestions, ...followUps];
          setExtraQuestions(nextExtras);
        }
      }

      setLastResult(result);
      setResults(next);
      onSaveProgress?.({
        qIdx: qIdx + 1,
        results: next,
        extraQuestions: nextExtras,
        requeued: Array.from(requeuedRef.current),
      });
      setPhase('feedback');
    },
    [question, qIdx, results, extraQuestions, year, wordObjects, onSaveProgress]
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

  // ── DEV-only: instant complete ─────────────────────────────────────────────
  // process.env.NODE_ENV is 'production' in CRA prod builds — webpack dead-
  // code-eliminates this entire block. (Note: this project uses CRA/react-
  // scripts, not Vite; process.env.NODE_ENV is the correct CRA equivalent of
  // import.meta.env.DEV.)
  const handleDevComplete = () => {
    const fakeResults = words.map(w => ({
      word:     w,
      correct:  true,
      given:    w,
      hintUsed: false,
    }));
    setResults(fakeResults);
    setQIdx(words.length - 1);
    setPhase('results');
  };

  const restartHasProgress = (qIdx > 0 || results.length > 0) && phase !== 'results';

  const handleComplete = () => {
    onSaveProgress?.(null);
    // Collapse multiple per-question results into a single per-word entry
    // shaped for the credit-mastery framework:
    //   - attempts:  count of questions the word appeared in (capped at 3+)
    //   - correct:   the *final* outcome on the last question for that word
    //                (rolling — getting it wrong then right counts as correct
    //                on the 2nd attempt)
    //   - hintUsed:  true if any question for that word used the 💡 affordance
    const byWord = {};
    for (const r of results) {
      const key = r.word.toLowerCase();
      const prev = byWord[key];
      if (!prev) {
        byWord[key] = {
          word: r.word,
          correct: !!r.correct,
          attempts: 1,
          hintUsed: !!r.hintUsed,
        };
      } else {
        prev.attempts += 1;
        prev.correct  = !!r.correct;            // most-recent outcome
        prev.hintUsed = prev.hintUsed || !!r.hintUsed;
      }
    }
    onComplete(Object.values(byWord));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const wrapClass = `qq-wrap${dyslexiaMode ? ' qq-wrap--es' : ''}`;

  const topbar = (
    <>
      <GameHeader
        title="Quiz Quest"
        onExit={onExit}
        rightSlot={
          <RestartButton hasProgress={restartHasProgress} onRestart={handlePlayAgain} label="Restart quiz" />
        }
      />
      {questions.length > 0 && (
        <GameProgressStrip percent={(results.length / questions.length) * 100}>
          {results.length} of {questions.length} questions answered
        </GameProgressStrip>
      )}
    </>
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
          <div className="qq-phase">
            <span className="qq-buddy" aria-hidden="true">
              <BuddyAvatar id={childCharacter?.id} size={120} fallback={childCharacter?.emoji} />
            </span>
            <h1 className="qq-h1">Let's do Quiz Quest!</h1>
            <p className="qq-start-sub">Solve quick word challenges with your buddy</p>
            <p className="qq-start-meta">{questions.length} questions</p>
            <button className="qq-btn qq-btn--primary qq-btn--large" onClick={handleStart}>
              Start quest ▶
            </button>
          </div>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <button onClick={handleDevComplete} style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, background: '#ff6b35', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'monospace' }}>
            ⚡ DEV: Complete
          </button>
        )}
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

  return (
    <div className={wrapClass}>
      {topbar}

      <div className="qq-stage">
        <div className="qq-phase">
          {process.env.NODE_ENV === 'development' && (
            <button onClick={handleDevComplete} style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, background: '#ff6b35', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'monospace' }}>
              ⚡ DEV: Complete
            </button>
          )}
          <span className="qq-buddy" aria-hidden="true">
            <BuddyAvatar
              id={childCharacter?.id}
              size={120}
              fallback={childCharacter?.emoji}
              cheering={buddyCheering}
            />
          </span>

          {phase === 'question' && question && (
            <>
              <h1 className="qq-h1">{QUESTION_H1[question.type] ?? 'Answer the question'}</h1>
              <QuestionCard
                key={question.id}
                question={question}
                onAnswer={handleAnswer}
                dyslexiaMode={dyslexiaMode}
                year={year}
              />
            </>
          )}

          {phase === 'feedback' && lastResult && (
            <>
              <h1 className="qq-h1">
                {lastResult.correct ? 'Brilliant — you nailed it!' : "Good try — let's look at this one"}
              </h1>

              {lastResult.correct ? (
                <div className="qq-success-panel" role="status" aria-live="polite">
                  <p className="qq-success-msg">🎉 You got it right!</p>
                  <span className="qq-word-big qq-word-big--correct">{question.answer}</span>
                  <button
                    className="qq-btn qq-btn--primary qq-btn--large qq-btn--auto"
                    onClick={() => { clearTimeout(autoAdvanceTimerRef.current); handleNext(); }}
                  >
                    <span className="qq-btn-auto-fill" aria-hidden="true" />
                    <span className="qq-btn-auto-label">
                      {qIdx + 1 >= questions.length ? 'See results ▶' : 'Next ▶'}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="qq-wrong-panel" role="status" aria-live="polite">
                  <p className="qq-wrong-msg">Good try! The answer was...</p>
                  <span className="qq-word-big">{question.answer}</span>
                  {lastResult.given && (
                    <p className="qq-wrong-detail">
                      You answered: <strong>{lastResult.given}</strong>
                    </p>
                  )}
                  <button className="qq-btn qq-btn--primary qq-btn--large" onClick={handleNext}>
                    {qIdx + 1 >= questions.length ? 'See results ▶' : 'Next ▶'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
