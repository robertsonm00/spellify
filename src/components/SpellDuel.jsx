import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import './SpellDuel.css';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import RestartButton from './RestartButton';
import BuddyAvatar from './BuddyAvatar';
import GameResults from './GameResults';
import DevCompleteButton from './DevCompleteButton';
import { getSupportTip } from '../data/spelling/dyslexiaPatterns';
import { resolveDefinition } from '../utils/wordDefinitions';
import { generateSpellDuelKeyboard } from '../utils/generateSpellDuelKeyboard';
import { SESSION_RETRY_CEILING } from '../utils/retryCeiling';

// Themed background — injected via CSS custom property at runtime.
const BG_STYLE = {
  '--bg-image-url': `url("${process.env.PUBLIC_URL || ''}/adventure/Spell%20Duel%20background%20.png")`,
};

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

  const [queue, setQueue] = useState(() => savedIsValid ? savedProgress.queue : [...words].sort(() => Math.random() - 0.5));
  // Track which words have already been silently re-queued so we never
  // push the same word back a second time. Survives a mid-session
  // restore via savedProgress.requeued.
  const requeuedRef = useRef(new Set(savedProgress?.requeued ?? []));
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
      const currentWordText = queue[wordIndex];
      const updatedResults  = [...wordResults, { word: currentWordText, won, wrongCount }];

      // Silent re-queue (SR-01 / SD-02): on the first lost word of the
      // session push it to the end of the queue for a second attempt.
      // Rule 1 — one retry per word (requeuedRef guards repeats). Rule 2 —
      // stop adding retry rounds once SESSION_RETRY_CEILING distinct words
      // have already been re-queued; further lost words just finish the
      // session and land on the practice list via the mastery-credit flow.
      let nextQueue = queue;
      const lower   = currentWordText.toLowerCase();
      if (!won &&
          !requeuedRef.current.has(lower) &&
          requeuedRef.current.size < SESSION_RETRY_CEILING) {
        requeuedRef.current.add(lower);
        nextQueue = [...queue, currentWordText];
        setQueue(nextQueue);
      }

      if (wordIndex + 1 >= nextQueue.length) {
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
    onSaveProgress?.({ queue, wordIndex, wordResults, guessed: [...guessed], requeued: Array.from(requeuedRef.current) });
  }, [wordResults, wordIndex, guessed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setClue(null);
    resolveDefinition(currentWord, { year: yearGroup }).then(def => {
      if (!cancelled) setClue(def);
    });
    return () => { cancelled = true; };
  }, [currentWord, yearGroup]);

  const restart = () => {
    onSaveProgress?.(null);
    setWordIndex(0);
    setGuessed(new Set());
    setWordResults([]);
    setPhase('playing');
  };

  // ── DEV-only: instant complete ─────────────────────────────────────────────
  // Mark every word as won and jump straight to the complete screen, so the
  // shared results + Continue → onComplete (points / lumens / reward) flow can
  // be tested without duelling each word.
  const handleDevComplete = () => {
    onSaveProgress?.(null);
    setWordResults(words.map((word) => ({ word, won: true, wrongCount: 0 })));
    setPhase('complete');
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
    // Roll the per-attempt list down to one entry per word, keeping the
    // most-recent outcome (a word can appear twice via the in-session
    // re-queue). This feeds both the on-screen boxes and the credit payload.
    const byWord = new Map();
    for (const r of wordResults) {
      byWord.set(String(r.word).toLowerCase(), { word: r.word, won: !!r.won });
    }
    const unique        = Array.from(byWord.values());
    const correctWords  = unique.filter((e) =>  e.won).map((e) => e.word);
    const practiceWords = unique.filter((e) => !e.won).map((e) => e.word);

    const handleComplete = () => {
      onSaveProgress?.(null);
      // Aggregate per-word for the credit framework. A word may appear twice
      // in wordResults because of the in-session re-queue (first loss, second
      // attempt). For the credit framework we want:
      //   - attempts: total tries (1 or 2)
      //   - correct:  most-recent outcome
      //   - wrongCount drives the attempts bucket on a single try: ≤2 wrong =
      //     1st-attempt feel, 3+ = 2nd-attempt feel. Re-queued runs always
      //     carry attempts ≥ 2.
      const credit = {};
      for (const r of wordResults) {
        const key = r.word.toLowerCase();
        const wc  = Number.isFinite(r.wrongCount) ? r.wrongCount : 0;
        const prev = credit[key];
        if (!prev) {
          let attempts;
          if (!r.won)        attempts = 2;
          else if (wc <= 2)  attempts = 1;
          else               attempts = 2;
          credit[key] = { word: r.word, correct: !!r.won, attempts, hintUsed: false };
        } else {
          prev.attempts = Math.min(prev.attempts + 1, 3);
          prev.correct  = !!r.won; // most-recent outcome wins
        }
      }
      onComplete(Object.values(credit));
    };

    return (
      <div className="hm-wrap game-magical-bg" style={BG_STYLE}>
        {topbar}
        <GameProgressStrip percent={100}>
          {correctWords.length} of {unique.length} words guessed
        </GameProgressStrip>
        <GameResults
          variant="A"
          correctWords={correctWords}
          practiceWords={practiceWords}
          total={unique.length}
          onContinue={handleComplete}
        />
      </div>
    );
  }

  // ── Playing / word-result screen ──────────────────────────────────────────

  const blanks = currentWord.split('').map((l) =>
    guessed.has(l) || (phase === 'word-result' && lost) ? l : null
  );

  return (
    <div className="hm-wrap game-magical-bg" style={BG_STYLE}>
      {topbar}
      <DevCompleteButton onClick={handleDevComplete} />
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
          <span className="sd-round-num">
            {wordIndex + 1}<span className="sd-round-sep">/</span>{queue.length}
          </span>
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
