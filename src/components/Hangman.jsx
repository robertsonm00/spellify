import React, { useState, useEffect, useCallback } from 'react';
import './Hangman.css';
import { getSupportTip } from '../data/spelling/dyslexiaPatterns';

const MAX_WRONG = { easy: 8, medium: 6, hard: 4 };
const ALPHABET  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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

function Hangman({ words, difficulty = 'medium', dyslexiaMode = false, childName = '', childCharacter = null, onComplete, onExit }) {
  const maxWrong = MAX_WRONG[difficulty] ?? 6;

  const [queue]          = useState(() => [...words].sort(() => Math.random() - 0.5));
  const [wordIndex,      setWordIndex]      = useState(0);
  const [guessed,        setGuessed]        = useState(new Set());
  const [wordResults,    setWordResults]    = useState([]);
  const [phase,          setPhase]          = useState('playing'); // playing | word-result | complete

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

  const restart = () => {
    setWordIndex(0);
    setGuessed(new Set());
    setWordResults([]);
    setPhase('playing');
  };

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
        {onExit && <button className="hm-back" onClick={onExit}>← Hub</button>}
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
            <button onClick={() => onComplete(wordResults.map(r => ({ word: r.word, correct: r.won })))}>Back to Hub</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing / word-result screen ──
  const blanks = currentWord.split('').map((l) =>
    guessed.has(l) || (phase === 'word-result' && lost) ? l : '_'
  );

  return (
    <div className="hm-wrap">
      {onExit && <button className="hm-back" onClick={onExit}>← Hub</button>}

      <p className="hm-progress">Word {wordIndex + 1} of {queue.length}</p>

      <div className="hm-main">
        <div className="hm-left">
          <HangmanSVG stage={phase === 'word-result' && lost ? 6 : stage} />
          <p className="hm-wrong-count">{wrongCount} / {maxWrong} wrong</p>
        </div>

        <div className="hm-right">
          {/* Word blanks */}
          <div className="hm-blanks">
            {blanks.map((ch, i) => (
              <span key={i} className={`hm-letter${ch !== '_' ? ' revealed' : ''}`}>
                {ch}
              </span>
            ))}
          </div>

          {/* Inline result banner */}
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

          {/* Letter keyboard */}
          <div className="hm-keyboard">
            {ALPHABET.map((letter) => {
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
        </div>
      </div>
    </div>
  );
}

export default Hangman;
