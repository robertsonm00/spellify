import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { getWeakSpot } from '../../data/weakSpots';
import GameHeader from '../GameHeader';
import GameProgressStrip from '../GameProgressStrip';
import BuddyAvatar from '../BuddyAvatar';
import RestartButton from '../RestartButton';
import { speakWord } from '../../utils/speech';
import { letterBoxSize } from '../../utils/letterBoxSize';
import '../MemorySpell.css';
import './WeakSpot.css';

const FLASH_MS = 1800;

function fireConfetti() {
  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.55 },
    colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f43'],
  });
}

function WeakSpot({ words, childCharacter = null, onComplete, onExit }) {
  const queue = words || [];
  const [wordIndex, setWordIndex] = useState(0);
  const [phase,     setPhase]     = useState('flash');
  const [input,     setInput]     = useState('');
  const [results,   setResults]   = useState([]);
  const [buddyCheering, setBuddyCheering] = useState(false);
  const inputRef = useRef(null);

  const word    = queue[wordIndex];
  const spot    = word ? getWeakSpot(word) : null;
  const missing = word && spot ? word.slice(spot.start, spot.end) : '';
  const before  = word && spot ? word.slice(0, spot.start)        : '';
  const after   = word && spot ? word.slice(spot.end)             : '';

  // Flash → type: speak word then auto-advance
  useEffect(() => {
    if (phase !== 'flash' || !word) return;
    speakWord(word);
    const id = setTimeout(() => setPhase('type'), FLASH_MS);
    return () => clearTimeout(id);
  }, [phase, wordIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus hidden input when typing begins
  useEffect(() => {
    if (phase === 'type') inputRef.current?.focus();
  }, [phase]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (phase !== 'type' || input.length < missing.length) return;
    const isCorrect = input.trim().toLowerCase() === missing.toLowerCase();
    if (isCorrect) {
      fireConfetti();
      setBuddyCheering(true);
      setTimeout(() => setBuddyCheering(false), 1000);
    }
    setResults(prev => [...prev, { word, correct: isCorrect, attempt: input.trim(), missing, spot }]);
    setPhase('result');
  };

  const handleNext = () => {
    if (wordIndex + 1 >= queue.length) {
      setPhase('complete');
    } else {
      setWordIndex(i => i + 1);
      setInput('');
      setPhase('flash');
    }
  };

  const restart = () => {
    setWordIndex(0);
    setInput('');
    setResults([]);
    setPhase('flash');
  };

  const hasProgress = wordIndex > 0 || results.length > 0;

  // ── Complete screen ──────────────────────────────────────────────────────

  if (phase === 'complete') {
    const wins = results.filter(r => r.correct).length;
    const perfect = wins === results.length;
    return (
      <>
        <GameHeader title="Weak Spot" onExit={onExit}
          rightSlot={<RestartButton hasProgress onRestart={restart} />} />
        <GameProgressStrip percent={100}>
          {results.length} of {queue.length} words done
        </GameProgressStrip>
        <div className="ws-stage">
          <div className="ws-phase">
            <span className="ms-buddy" aria-hidden="true">
              <BuddyAvatar id={childCharacter?.id} size={120} fallback={childCharacter?.emoji || '⭐'} cheering={buddyCheering} />
            </span>
            <h1 className="ms-h1">You Did It!</h1>
            <div className="ms-results-score">
              <span className="ms-score-emoji">{perfect ? '⭐' : wins >= Math.ceil(results.length / 2) ? '🌟' : '💪'}</span>
              <span className="ms-score-num">{wins} / {results.length}</span>
              <span className="ms-score-label">{perfect ? 'Perfect — every word correct!' : 'words correct'}</span>
            </div>
            <ul className="ws-summary">
              {results.map((r, i) => (
                <li key={i} className={r.correct ? 'ws-summary-row ws-summary-row--ok' : 'ws-summary-row ws-summary-row--bad'}>
                  <span className="ws-summary-word">{r.word}</span>
                  {!r.correct && (
                    <span className="ws-summary-attempt">you typed "{r.attempt || '—'}" · was "{r.missing}"</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="ws-done-actions">
              <button className="ms-btn ms-btn--secondary" onClick={restart}>↺ Play again</button>
              <button className="ms-btn ms-btn--primary" onClick={() =>
                onComplete(results.map(r => ({ word: r.word, correct: r.correct })))
              }>Back to Hub ▶</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!word) {
    return (
      <>
        <GameHeader title="Weak Spot" onExit={onExit} />
        <div className="ws-stage"><p>No words available.</p></div>
      </>
    );
  }

  const boxSize = letterBoxSize(word.length);
  const last = results[results.length - 1];

  return (
    <>
      <GameHeader title="Weak Spot" onExit={onExit}
        rightSlot={<RestartButton hasProgress={hasProgress} onRestart={restart} />} />
      <GameProgressStrip percent={(wordIndex / queue.length) * 100}>
        Word {wordIndex + 1} of {queue.length}
      </GameProgressStrip>

      <div className="ws-stage">
        <div className="ws-phase">
          <span className="ms-buddy" aria-hidden="true">
            <BuddyAvatar id={childCharacter?.id} size={120} fallback={childCharacter?.emoji || '⭐'}
              cheering={buddyCheering} />
          </span>

          {/* ── Flash: all letters visible ── */}
          {phase === 'flash' && (
            <>
              <h1 className="ms-h1">Look carefully…</h1>
              <div className="ws-letter-row" style={{ '--box-size': `${boxSize}px` }}>
                {word.split('').map((ch, i) => (
                  <div key={i} className="ws-box ws-box--flash">{ch.toUpperCase()}</div>
                ))}
              </div>
            </>
          )}

          {/* ── Type: missing section becomes input boxes ── */}
          {phase === 'type' && (
            <>
              <h1 className="ms-h1">Fill in the missing letters.</h1>
              <form onSubmit={handleSubmit} className="ws-form">
                <div className="ws-letter-row" style={{ '--box-size': `${boxSize}px` }}>
                  {before.split('').map((ch, i) => (
                    <div key={`b${i}`} className="ws-box ws-box--fixed">{ch.toUpperCase()}</div>
                  ))}
                  <div
                    className="ws-missing-group"
                    onClick={() => inputRef.current?.focus()}
                    role="group"
                    aria-label="Type the missing letters"
                  >
                    {Array.from({ length: missing.length }, (_, i) => {
                      const char  = input[i] || '';
                      const state = !char
                        ? (i === input.length ? 'cursor' : 'empty')
                        : 'filled';
                      return (
                        <div key={i} className={`ws-box ws-box--input ws-box--${state}`}>
                          {char.toUpperCase()}
                        </div>
                      );
                    })}
                    <input
                      ref={inputRef}
                      className="ws-hidden-input"
                      value={input}
                      onChange={e => setInput(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, missing.length))}
                      onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                      maxLength={missing.length}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      aria-label="Type the missing letters"
                    />
                  </div>
                  {after.split('').map((ch, i) => (
                    <div key={`a${i}`} className="ws-box ws-box--fixed">{ch.toUpperCase()}</div>
                  ))}
                </div>
                <button
                  className="ms-btn ms-btn--primary ms-btn--large"
                  type="submit"
                  disabled={input.length < missing.length}
                >
                  Check ✓
                </button>
              </form>
            </>
          )}

          {/* ── Result: success or wrong panel ── */}
          {phase === 'result' && last?.correct && (
            <div className="ms-success-panel" role="status" aria-live="polite">
              <p className="ms-success-msg">🎉 Spot on!</p>
              <div className="ws-letter-row" style={{ '--box-size': `${boxSize}px` }}>
                {word.split('').map((ch, i) => (
                  <div key={i} className="ws-box ws-box--ok">{ch.toUpperCase()}</div>
                ))}
              </div>
              <button className="ms-btn ms-btn--primary ms-btn--large" onClick={handleNext}>
                {wordIndex + 1 >= queue.length ? 'See results ▶' : 'Next word ▶'}
              </button>
            </div>
          )}

          {phase === 'result' && last?.correct === false && (
            <div className="ms-wrong-panel" role="status" aria-live="polite">
              <p className="ms-wrong-msg">
                The tricky bit was <strong>"{missing}"</strong> — full word:
              </p>
              <div className="ws-letter-row" style={{ '--box-size': `${boxSize}px` }}>
                {word.split('').map((ch, i) => {
                  const isMissing = i >= last.spot.start && i < last.spot.end;
                  return (
                    <div key={i} className={`ws-box ${isMissing ? 'ws-box--highlight' : 'ws-box--ok'}`}>
                      {ch.toUpperCase()}
                    </div>
                  );
                })}
              </div>
              <p className="ws-attempt-note">You typed: <strong>"{last.attempt || '—'}"</strong></p>
              <button className="ms-btn ms-btn--primary ms-btn--large" onClick={handleNext}>
                {wordIndex + 1 >= queue.length ? 'See results ▶' : 'Next word ▶'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default WeakSpot;
