import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import './Hangman.css';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import { getSupportTip } from '../data/spelling/dyslexiaPatterns';
import { resolveDefinition } from '../utils/wordDefinitions';

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

function fireWordConfetti() {
  confetti({ particleCount: 90, spread: 65, origin: { y: 0.4 },
    colors: ['#22c55e', '#86efac', '#ffd93d', '#c77dff', '#4d96ff'] });
}

const MAX_WRONG = { easy: 8, medium: 6, hard: 4 };

const KEYBOARD_ROWS = [
  ['A','B','C','D','E','F','G','H','I','J','K','L','M'],
  ['N','O','P','Q','R','S','T','U','V','W','X','Y','Z'],
];

// Map wrong-guess count to 0-6 SVG body stages proportionally
function bodyStage(wrongCount, maxWrong) {
  return Math.ceil((Math.min(wrongCount, maxWrong) / maxWrong) * 6);
}

function HangmanSVG({ stage }) {
  return (
    <svg className="hangman-svg" viewBox="0 0 160 200" aria-hidden="true">
      {/* Gallows */}
      <line x1="10"  y1="190" x2="130" y2="190" />
      <line x1="30"  y1="190" x2="30"  y2="15"  />
      <line x1="30"  y1="15"  x2="110" y2="15"  />
      <line x1="110" y1="15"  x2="110" y2="45"  />
      {/* Head */}
      {stage >= 1 && <circle cx="110" cy="62" r="17" />}
      {/* Body */}
      {stage >= 2 && <line x1="110" y1="79"  x2="110" y2="125" />}
      {/* Left arm */}
      {stage >= 3 && <line x1="110" y1="92"  x2="85"  y2="115" />}
      {/* Right arm */}
      {stage >= 4 && <line x1="110" y1="92"  x2="135" y2="115" />}
      {/* Left leg */}
      {stage >= 5 && <line x1="110" y1="125" x2="88"  y2="158" />}
      {/* Right leg */}
      {stage >= 6 && <line x1="110" y1="125" x2="132" y2="158" />}
    </svg>
  );
}

function Hangman({ words, difficulty = 'medium', dyslexiaMode = false, childName = '', childCharacter = null, savedProgress = null, onSaveProgress, onComplete, onExit }) {
  const maxWrong = MAX_WRONG[difficulty] ?? 6;

  // Validate saved progress belongs to the current word list — wipe it if the list changed.
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

  // Clear stale savedProgress from the hub if the word list has changed.
  useEffect(() => {
    if (savedProgress != null && !savedIsValid) onSaveProgress?.(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentWord  = queue[wordIndex].toUpperCase();
  const wordLetters  = new Set(currentWord.split(''));
  const wrongCount   = [...guessed].filter((l) => !wordLetters.has(l)).length;
  const won          = [...wordLetters].every((l) => guessed.has(l));
  const lost         = wrongCount >= maxWrong;
  const stage        = bodyStage(wrongCount, maxWrong);

  // Detect win/lose and transition
  useEffect(() => {
    if (phase !== 'playing') return;
    if (won || lost) setPhase('word-result');
  }, [won, lost, phase]);

  // Auto-advance after showing word result
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

  // Celebration on correct word
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
      setGuessed((prev) => new Set([...prev, letter]));
    },
    [phase, guessed]
  );

  // Keyboard support
  useEffect(() => {
    const onKey = (e) => {
      if (/^[a-zA-Z]$/.test(e.key)) handleGuess(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleGuess]);

  // Persist mid-game state after the first guess so hub-exit → resume works.
  useEffect(() => {
    if (wordResults.length === 0 && guessed.size === 0) return;
    onSaveProgress?.({ queue, wordIndex, wordResults, guessed: [...guessed] });
  }, [wordResults, wordIndex, guessed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve clue for the current word — local map first, then API fallback.
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

  const topbar = (
    <GameHeader
      title="Hangman"
      onExit={onExit}
      rightSlot={
        <button className="game-header-btn" onClick={restart} title="Restart game">↺ Restart</button>
      }
    />
  );

  // ── Complete screen ──
  if (phase === 'complete') {
    const wins = wordResults.filter((r) => r.won).length;
    const encouragements = [
      "Fantastic!",
      "Great work!",
      "You're amazing!",
      "Brilliant playing!",
      "Well done!",
      "Awesome job!",
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
          <h2>Game Over!</h2>
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
            <button onClick={() => { onSaveProgress?.(null); onComplete(wordResults.map(r => ({ word: r.word, correct: r.won }))); }}>Back to Hub</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing / word-result screen ──
  const blanks = currentWord.split('').map((l) =>
    guessed.has(l) || (phase === 'word-result' && lost) ? l : null
  );

  return (
    <div className="hm-wrap">
      {topbar}
      <GameProgressStrip percent={queue.length > 0 ? (wordResults.length / queue.length) * 100 : 0}>
        {wordResults.length} of {queue.length} words done
      </GameProgressStrip>

      {/* ── Game area: hangman left, clue + word right ── */}
      <div className="hm-game-area">
        <div className="hm-left">
          <HangmanSVG stage={phase === 'word-result' && lost ? 6 : stage} />
          <p className="hm-wrong-count">{wrongCount} / {maxWrong} wrong</p>
        </div>

        <div className="hm-right">
          {clue && (
            <div className="hm-clue">
              <p className="hm-clue-label">Clue</p>
              <p className="hm-clue-text">{clue}</p>
            </div>
          )}

          <div className="hm-blanks">
            {blanks.map((ch, i) => (
              <div key={i} className={`hm-letter-box${ch ? ' revealed' : ''}`}>
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
      </div>

      {/* ── A–Z keyboard at the bottom ── */}
      <div className="hm-keyboard-area">
        <p className="hm-keyboard-label">Choose your next letter</p>
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="hm-key-row">
            {row.map((letter) => {
              const isGuessed = guessed.has(letter);
              const isWrong   = isGuessed && !wordLetters.has(letter);
              const isRight   = isGuessed && wordLetters.has(letter);
              return (
                <button
                  key={letter}
                  className={`hm-key${isWrong ? ' wrong' : isRight ? ' right' : ''}`}
                  disabled={isGuessed || phase !== 'playing'}
                  onClick={() => handleGuess(letter)}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Hangman;
