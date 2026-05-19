import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import './SpellDuel.css';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import RestartButton from './RestartButton';
import BuddyAvatar from './BuddyAvatar';
import { getSupportTip } from '../data/spelling/dyslexiaPatterns';
import { resolveDefinition } from '../utils/wordDefinitions';
import { generateSpellDuelKeyboard } from '../utils/generateSpellDuelKeyboard';

function playWordChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  } catch {}
}

// Ascending magic shimmer — four sine overtones in a major-pentatonic run.
function playCorrectChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [1108.73, 0.07], [1318.51, 0.14], [1760, 0.21]].forEach(([freq, delay]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.13, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {}
}

// Soft descending fizzle — triangle sweep, low volume, not a buzzer.
function playFizzleSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.26);
  } catch {}
}

function fireWordConfetti() {
  confetti({ particleCount: 90, spread: 65, origin: { y: 0.4 },
    colors: ['#22c55e', '#86efac', '#ffd93d', '#c77dff', '#4d96ff'] });
}

// Wizard sparkles — star-shaped, purple/gold palette, from the word-box area.
function fireCorrectSparkles() {
  confetti({
    particleCount: 24,
    angle: 90,
    spread: 55,
    origin: { x: 0.62, y: 0.44 },
    colors: ['#c77dff', '#ffffff', '#ffd93d', '#a78bfa', '#f9a8d4', '#7f77dd'],
    ticks: 65,
    gravity: 0.72,
    scalar: 0.88,
    shapes: ['star'],
    startVelocity: 24,
  });
}

// Wrong fizzle — tiny soft circles drifting up from the keyboard, barely there.
function fireWrongFizzle() {
  confetti({
    particleCount: 10,
    angle: 90,
    spread: 38,
    origin: { x: 0.5, y: 0.84 },
    colors: ['#d8b4fe', '#c4b5fd', '#a78bfa', '#ede9fe'],
    ticks: 26,
    gravity: 1.5,
    scalar: 0.5,
    shapes: ['circle'],
    startVelocity: 9,
    drift: 0,
  });
}

const MAX_WRONG = { easy: 8, medium: 6, hard: 4 };

const SEGMENTS = 6;

// Individual gem-style spell charges. Drains from the right on each wrong guess.
function SpellEnergyBar({ wrongCount, maxWrong, won, lost }) {
  const charges = maxWrong - wrongCount;
  const dimCount = lost
    ? SEGMENTS
    : Math.round((Math.min(wrongCount, maxWrong) / maxWrong) * SEGMENTS);

  return (
    <div className="sd-energy-panel">
      <div
        className="sd-energy-gems"
        role="meter"
        aria-label={`${charges} spell charges remaining`}
        aria-valuenow={charges}
        aria-valuemin={0}
        aria-valuemax={maxWrong}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const isLit = !lost && i < (SEGMENTS - dimCount);
          let cls = 'sd-energy-gem';
          if (isLit && won) cls += ' sd-energy-gem--gold';
          else if (isLit)   cls += ' sd-energy-gem--lit';
          return <div key={i} className={cls} />;
        })}
      </div>
      <div className="sd-charges-display">
        <span className={`sd-charges-number${won ? ' sd-charges-number--won' : lost ? ' sd-charges-number--lost' : ''}`}>
          {won ? '⚡' : lost ? '✗' : charges}
        </span>
        <span className="sd-charges-label">
          {won
            ? 'You won the duel!'
            : lost
            ? 'The spell is broken…'
            : `spell charge${charges === 1 ? '' : 's'} remaining`}
        </span>
      </div>
    </div>
  );
}

function SpellDuel({
  words,
  difficulty = 'medium',
  yearGroup = null,
  dyslexiaMode = false,
  childName = '',
  childCharacter = null,
  savedProgress = null,
  onSaveProgress,
  onComplete,
  onExit,
}) {
  const maxWrong = MAX_WRONG[difficulty] ?? 6;

  const savedIsValid = (() => {
    if (!savedProgress?.queue) return false;
    const savedSet   = new Set(savedProgress.queue.map(w => w.toLowerCase()));
    const currentSet = new Set(words.map(w => w.toLowerCase()));
    return savedSet.size === currentSet.size && [...savedSet].every(w => currentSet.has(w));
  })();

  const [queue]          = useState(() => savedIsValid ? savedProgress.queue : [...words].sort(() => Math.random() - 0.5));
  const [wordIndex,      setWordIndex]      = useState(savedIsValid ? (savedProgress.wordIndex ?? 0) : 0);
  const [guessed,        setGuessed]        = useState(() => new Set(savedIsValid ? (savedProgress.guessed ?? []) : []));
  const [wordResults,    setWordResults]    = useState(savedIsValid ? (savedProgress.wordResults ?? []) : []);
  const [phase,          setPhase]          = useState('playing'); // playing | word-result | complete
  const [clue,           setClue]           = useState(null);
  const [lastWrongLetter,   setLastWrongLetter]   = useState(null);
  const [lastCorrectLetter, setLastCorrectLetter] = useState(null);
  const shakeTimerRef   = useRef(null);
  const sparkleTimerRef = useRef(null);

  useEffect(() => {
    if (savedProgress != null && !savedIsValid) onSaveProgress?.(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentWord = queue[wordIndex].toUpperCase();
  const wordLetters = new Set(currentWord.split(''));
  const wrongCount  = [...guessed].filter((l) => !wordLetters.has(l)).length;
  const won         = [...wordLetters].every((l) => guessed.has(l));
  const lost        = wrongCount >= maxWrong;

  // Battle HP — player drains on wrong guesses, opponent on correct letters revealed.
  const playerHpPct   = Math.max(0, Math.round(((maxWrong - wrongCount) / maxWrong) * 100));
  const revealedCount = [...wordLetters].filter(l => guessed.has(l)).length;
  const opponentHpPct = Math.max(0, Math.round(((wordLetters.size - revealedCount) / wordLetters.size) * 100));

  // Brief lunge animation on the last guess outcome.
  const playerAttack   = lastCorrectLetter != null;
  const opponentAttack = lastWrongLetter != null;

  // Cheer pose lingers a beat longer than the lunge so the swapped frame reads,
  // then snaps back to the default still pose.
  const [playerCheering, setPlayerCheering] = useState(false);
  const cheerTimerRef = useRef(null);
  useEffect(() => {
    if (lastCorrectLetter == null) return;
    setPlayerCheering(true);
    clearTimeout(cheerTimerRef.current);
    cheerTimerRef.current = setTimeout(() => setPlayerCheering(false), 1200);
    // No cleanup: the cheer timer must outlive the brief lastCorrectLetter
    // window (~480ms) so the cheer pose visibly snaps back to default.
  }, [lastCorrectLetter]);

  // Hard reset whenever we leave the playing phase or move to a new word —
  // prevents the cheer pose lingering into the result/next-word screen.
  useEffect(() => {
    clearTimeout(cheerTimerRef.current);
    setPlayerCheering(false);
  }, [phase, wordIndex]);

  const adaptiveKeys = useMemo(
    () => generateSpellDuelKeyboard(currentWord, yearGroup, difficulty),
    [currentWord, yearGroup, difficulty] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (phase !== 'playing') return;
    if (won || lost) setPhase('word-result');
  }, [won, lost, phase]);

  useEffect(() => {
    if (phase !== 'word-result') return;
    const hasTip = dyslexiaMode && !won && getSupportTip(queue[wordIndex]);
    const id = setTimeout(() => {
      const updatedResults = [...wordResults, { word: queue[wordIndex], won }];
      if (wordIndex + 1 >= queue.length) {
        setWordResults(updatedResults);
        setPhase('complete');
      } else {
        setWordResults(updatedResults);
        setWordIndex((i) => i + 1);
        setGuessed(new Set());
        setPhase('playing');
      }
    }, hasTip ? 4500 : 2000);
    return () => clearTimeout(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const celebratedRef = useRef(false);
  useEffect(() => {
    if (phase === 'playing') { celebratedRef.current = false; return; }
    if (phase === 'word-result' && won && !celebratedRef.current) {
      celebratedRef.current = true;
      playWordChime();
      fireWordConfetti();
    }
  }, [phase, won]);

  const handleGuess = useCallback(
    (letter) => {
      if (phase !== 'playing' || guessed.has(letter)) return;
      const letters = new Set(queue[wordIndex].toUpperCase().split(''));
      const isWrong = !letters.has(letter);
      setGuessed((prev) => new Set([...prev, letter]));
      if (isWrong) {
        playFizzleSound();
        fireWrongFizzle();
        setLastWrongLetter(letter);
        clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(() => setLastWrongLetter(null), 310);
      } else {
        // Only play the per-letter chime when this guess doesn't complete the word —
        // the word-complete fanfare (playWordChime) fires separately and would overlap.
        const newGuessed = new Set([...guessed, letter]);
        const wordLettersLocal = new Set(queue[wordIndex].toUpperCase().split(''));
        const willWin = [...wordLettersLocal].every(l => newGuessed.has(l));
        if (!willWin) playCorrectChime();
        fireCorrectSparkles();
        setLastCorrectLetter(letter);
        clearTimeout(sparkleTimerRef.current);
        sparkleTimerRef.current = setTimeout(() => setLastCorrectLetter(null), 480);
      }
    },
    [phase, guessed, queue, wordIndex]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (/^[a-zA-Z]$/.test(e.key)) handleGuess(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleGuess]);

  useEffect(() => {
    onSaveProgress?.({ queue, wordIndex, wordResults, guessed: [...guessed] });
  }, [wordResults, wordIndex, guessed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setClue(null);
    resolveDefinition(currentWord).then(def => {
      if (!cancelled) setClue(def);
    });
    return () => { cancelled = true; };
  }, [currentWord]);

  const restart = () => {
    onSaveProgress?.(null);
    setWordIndex(0);
    setGuessed(new Set());
    setWordResults([]);
    setPhase('playing');
  };

  const restartHasProgress = wordIndex > 0 || guessed.size > 0 || wordResults.length > 0;

  const topbar = (
    <GameHeader
      title="Spell Duel"
      onExit={onExit}
      rightSlot={
        <RestartButton hasProgress={restartHasProgress} onRestart={restart} />
      }
    />
  );

  // ── Complete screen ────────────────────────────────────────────────────────

  if (phase === 'complete') {
    const wins = wordResults.filter((r) => r.won).length;
    const encouragements = [
      'Fantastic!', 'Great work!', "You're amazing!",
      'Brilliant playing!', 'Well done!', 'Awesome job!',
    ];
    const encouragement = encouragements[Math.floor(Math.random() * encouragements.length)];

    return (
      <div className="hm-wrap">
        {topbar}
        <GameProgressStrip percent={100}>
          {wordResults.filter(r => r.won).length} of {wordResults.length} words guessed
        </GameProgressStrip>
        <div className="hm-complete">
          {childCharacter && <div className="hm-complete-emoji">{childCharacter.emoji}</div>}
          <h2>Duel Complete!</h2>
          {childName && <p className="hm-child-name">{childName}, {encouragement}</p>}
          <p className="hm-score-big">{wins} / {wordResults.length} words guessed</p>
          <ul className="hm-result-list">
            {wordResults.map((r, i) => (
              <li key={i} className={r.won ? 'won' : 'lost'}>
                <span>{r.word}</span>
                <span className="hm-result-icon">{r.won ? '✓' : '✗'}</span>
              </li>
            ))}
          </ul>
          <div className="hm-done-actions">
            <button onClick={restart}>Play Again</button>
            <button onClick={() => {
              onSaveProgress?.(null);
              onComplete(wordResults.map(r => ({ word: r.word, correct: r.won })));
            }}>
              Back to Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing / word-result screen ──────────────────────────────────────────

  const blanks = currentWord.split('').map((l) =>
    guessed.has(l) || (phase === 'word-result' && lost) ? l : null
  );

  return (
    <div className="hm-wrap">
      {topbar}
      <GameProgressStrip percent={queue.length > 0 ? (wordResults.length / queue.length) * 100 : 0}>
        {wordResults.length} of {queue.length} words done
      </GameProgressStrip>

      {/* ── Battle bar (Street Fighter style) ── */}
      <div className="sd-battle-bar">

        {/* Player portrait (left) */}
        <div className={[
          'sd-portrait sd-portrait--player',
          playerAttack ? 'sd-portrait--attack' : '',
          phase === 'word-result' && lost ? 'sd-portrait--ko' : '',
        ].filter(Boolean).join(' ')}>
          <BuddyAvatar
            id={childCharacter?.id}
            size={88}
            fallback={childCharacter?.emoji}
            cheering={playerCheering}
          />
        </div>

        {/* Player HP strip — drains right→left */}
        <div className="sd-hp-strip sd-hp-strip--player">
          <div
            className="sd-hp-fill"
            style={{ width: `${playerHpPct}%` }}
          />
        </div>

        {/* Round badge (middle) */}
        <div className="sd-round-badge">
          <span className="sd-round-label">ROUND</span>
          <span className="sd-round-num">{wordIndex + 1}</span>
        </div>

        {/* Opponent HP strip — drains left→right */}
        <div className="sd-hp-strip sd-hp-strip--opponent">
          <div
            className="sd-hp-fill"
            style={{ width: `${opponentHpPct}%` }}
          />
        </div>

        {/* Opponent portrait (right) */}
        <div className={[
          'sd-portrait sd-portrait--opponent',
          opponentAttack ? 'sd-portrait--attack' : '',
          phase === 'word-result' && won ? 'sd-portrait--ko' : '',
        ].filter(Boolean).join(' ')}>
          <span className="sd-portrait-emoji">🧙‍♂️</span>
        </div>
      </div>

      {/* ── Clue + word blanks — centred ── */}
      <div className="sd-word-area">
        {clue && (
          <div className="hm-clue">
            <p className="hm-clue-label">Use this clue to find your answer.</p>
            <p className="hm-clue-text">{clue}</p>
          </div>
        )}

        <div className="hm-blanks">
          {blanks.map((ch, i) => (
            <div
              key={i}
              className={[
                'hm-letter-box',
                ch ? 'revealed' : '',
                ch && ch === lastCorrectLetter ? 'sparkle' : '',
              ].filter(Boolean).join(' ')}
            >
              {ch ?? ''}
            </div>
          ))}
        </div>

        {phase === 'word-result' && (
          <div className={`hm-word-result ${won ? 'won' : 'lost'}`}>
            {won ? '🎉 Nice one!' : `The word was ${currentWord}`}
            {!won && dyslexiaMode && (() => {
              const tip = getSupportTip(queue[wordIndex]);
              return tip ? (
                <div className="support-tip">
                  <span className="support-tip-icon">💡</span>
                  <span>{tip.support_strategy}</span>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* ── A–Z keyboard ── */}
      <div className="hm-keyboard-area">
        <p className="hm-keyboard-label">Choose your next letter</p>
        {(() => {
          const topCount  = Math.ceil(adaptiveKeys.length / 2);
          const rows = [adaptiveKeys.slice(0, topCount), adaptiveKeys.slice(topCount)];
          return rows.map((row, ri) => (
            <div key={ri} className="hm-key-row hm-key-row--adaptive">
              {row.map((letter) => {
                const isGuessed = guessed.has(letter);
                const isWrong   = isGuessed && !wordLetters.has(letter);
                const isRight   = isGuessed && wordLetters.has(letter);
                const isShaking = letter === lastWrongLetter;
                return (
                  <button
                    key={letter}
                    className={[
                      'hm-key',
                      isWrong   ? 'wrong' : '',
                      isRight   ? 'right' : '',
                      isShaking ? 'shake' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={isGuessed || phase !== 'playing'}
                    onClick={() => handleGuess(letter)}
                    aria-label={`${letter}${isGuessed ? (isWrong ? ', incorrect' : ', correct') : ''}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          ));
        })()}
        {process.env.NODE_ENV === 'development' && (
          <p className="hm-keyboard-label" style={{ opacity: 0.45, fontSize: '0.65rem' }}>
            {adaptiveKeys.length} of 26 letters shown
          </p>
        )}
      </div>
    </div>
  );
}

export default SpellDuel;
