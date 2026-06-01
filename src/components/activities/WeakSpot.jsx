import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { getWeakSpot } from '../../data/weakSpots';
import GameHeader from '../GameHeader';
import BuddyAvatar from '../BuddyAvatar';
import GameResults from '../GameResults';
import RestartButton from '../RestartButton';
import DevCompleteButton from '../DevCompleteButton';
import { speakWord } from '../../utils/speech';
import { letterBoxSize } from '../../utils/letterBoxSize';
import '../MemorySpell.css';
import './WeakSpot.css';

const FLASH_MS = 1800;

// Themed background — Weak Spot shares Memory Spell's look/layout (R2-02),
// inheriting the same dark glowing card on a themed backdrop, now over its
// own bespoke Weak Spot background.
const BG_STYLE = {
  '--bg-image-url': `url("${process.env.PUBLIC_URL || ''}/adventure/backgrounds/weak-spot-background.webp")`,
};

function fireConfetti() {
  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.55 },
    colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f43'],
  });
}

/**
 * Weak Spot — plays a word, then hides its tricky letters for the child to
 * type back in (audio-led gap-fill). The spoken word uses the shared site
 * voice via speakWord (same path standardised in SDR-01).
 *
 * R2-02: restyled to Memory Spell's look (themed dark card, buddy, white H1,
 * "Word X / Y" pill) and finishes on the shared RES-01 Variant A results
 * screen (GameResults) — the old bespoke summary + "Play again" are retired.
 */
function WeakSpot({ words, childCharacter = null, dyslexiaMode = false, onComplete, onExit }) {
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

  // ── DEV-only: instant complete ─────────────────────────────────────────────
  // Mark every word correct and jump to the shared results screen, so the
  // Continue → onComplete (points / lumens / reward) flow can be tested without
  // filling in each word's tricky spot.
  const handleDevComplete = () => {
    setResults(queue.map((w) => ({ word: w, correct: true })));
    setPhase('complete');
  };

  const hasProgress = wordIndex > 0 || results.length > 0;
  const wrapClass   = `ms-wrap game-magical-bg${dyslexiaMode ? ' ms-wrap--es' : ''}`;

  // ── Complete screen (RES-01 Variant A — shared with Memory Spell) ──────────

  if (phase === 'complete') {
    const byWord = new Map();
    for (const r of results) {
      byWord.set(String(r.word).toLowerCase(), { word: r.word, correct: !!r.correct });
    }
    const unique        = Array.from(byWord.values());
    const correctWords  = unique.filter((e) =>  e.correct).map((e) => e.word);
    const practiceWords = unique.filter((e) => !e.correct).map((e) => e.word);

    return (
      <div className={wrapClass} style={BG_STYLE}>
        <GameHeader title="Weak Spot" onExit={onExit} />
        <GameResults
          variant="A"
          correctWords={correctWords}
          practiceWords={practiceWords}
          total={queue.length}
          onContinue={() => onComplete(unique.map((e) => ({ word: e.word, correct: e.correct })))}
        />
      </div>
    );
  }

  if (!word) {
    return (
      <div className={wrapClass} style={BG_STYLE}>
        <GameHeader title="Weak Spot" onExit={onExit} />
        <div className="ms-stage"><div className="ms-phase"><p>No words available.</p></div></div>
      </div>
    );
  }

  const boxSize = letterBoxSize(word.length);
  const last = results[results.length - 1];

  const wordCounterPill = (
    <span className="ms-word-counter" aria-label={`Word ${wordIndex + 1} of ${queue.length}`}>
      Word {wordIndex + 1}<span className="ms-word-counter__sep">/</span>{queue.length}
    </span>
  );

  return (
    <div className={wrapClass} style={BG_STYLE}>
      <GameHeader title="Weak Spot" onExit={onExit}
        rightSlot={<RestartButton hasProgress={hasProgress} onRestart={restart} />} />
      <DevCompleteButton onClick={handleDevComplete} />

      <div className="ms-stage">
        <div className="ms-phase">
          <span className="ms-buddy" aria-hidden="true">
            <BuddyAvatar id={childCharacter?.id} size={120} fallback={childCharacter?.emoji}
              cheering={buddyCheering} />
          </span>

          {wordCounterPill}

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
    </div>
  );
}

export default WeakSpot;
