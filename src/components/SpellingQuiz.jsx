import React, { useState, useEffect, useRef } from 'react';
import './SpellingQuiz.css';
import { getSupportTip } from '../data/spelling/dyslexiaPatterns';

// Seconds to memorise the word per difficulty
const MEMORISE_TIME = { easy: 4, medium: 3, hard: 2 };

const ENCOURAGEMENTS = [
  "Amazing work!",
  "You're a spelling star!",
  "Fantastic job!",
  "Brilliant effort!",
  "Fantastic spelling!",
  "You nailed it!",
  "Outstanding!",
];

function SpellingQuiz({ words, difficulty = 'medium', dyslexiaMode = false, childName = '', childCharacter = null, onComplete, onExit }) {
  const memoriseTime = MEMORISE_TIME[difficulty] ?? 3;

  const [queue]     = useState(() => [...words].sort(() => Math.random() - 0.5));
  const [index,     setIndex]     = useState(0);
  const [phase,     setPhase]     = useState('memorise'); // memorise | type | feedback | complete
  const [countdown, setCountdown] = useState(memoriseTime);
  const [input,     setInput]     = useState('');
  const [results,   setResults]   = useState([]);
  const inputRef = useRef(null);

  const currentWord = queue[index];

  // Drive the memorise countdown and phase transitions
  useEffect(() => {
    let id;
    if (phase === 'memorise') {
      if (countdown > 0) {
        id = setTimeout(() => setCountdown((c) => c - 1), 1000);
      } else {
        setPhase('type');
      }
    } else if (phase === 'feedback') {
      const last = results[results.length - 1];
      const hasTip = dyslexiaMode && last && !last.correct && getSupportTip(last.word);
      id = setTimeout(() => {
        const next = index + 1;
        if (next >= queue.length) {
          setPhase('complete');
        } else {
          setIndex(next);
          setCountdown(memoriseTime);
          setInput('');
          setPhase('memorise');
        }
      }, hasTip ? 4500 : 1500);
    }
    return () => clearTimeout(id);
  }, [phase, countdown, index, queue.length, memoriseTime]);

  useEffect(() => {
    if (phase === 'type') inputRef.current?.focus();
  }, [phase]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const answer  = input.trim();
    const correct = answer.toLowerCase() === currentWord.toLowerCase();
    setResults((prev) => [...prev, { word: currentWord, answer, correct }]);
    setPhase('feedback');
  };

  if (phase === 'complete') {
    const score = results.filter((r) => r.correct).length;
    const encouragement = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    
    return (
      <div className="quiz-wrap">
        {onExit && <button className="quiz-back" onClick={onExit}>← Hub</button>}
        <div className="quiz-complete">
          {childCharacter && <div className="quiz-complete-emoji">{childCharacter.emoji}</div>}
          <h2>Quiz complete!</h2>
          {childName && <p className="quiz-child-name">{childName}, {encouragement}</p>}
          <p className="quiz-score-big">{score} / {results.length} correct</p>
          <ul className="quiz-result-list">
            {results.map((r, i) => (
              <li key={i} className={r.correct ? 'correct' : 'wrong'}>
                <span className="ql-word">{r.word}</span>
                {!r.correct && (
                  <span className="ql-answer"> — you wrote: <em>{r.answer || '(nothing)'}</em></span>
                )}
                <span className="ql-icon">{r.correct ? '✓' : '✗'}</span>
              </li>
            ))}
          </ul>
          <div className="quiz-done-actions">
            <button
              onClick={() => {
                setIndex(0);
                setResults([]);
                setCountdown(memoriseTime);
                setInput('');
                setPhase('memorise');
              }}
            >
              Try Again
            </button>
            <button onClick={onComplete}>Back to Hub</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-wrap">
      {onExit && <button className="quiz-back" onClick={onExit}>← Hub</button>}

      <p className="quiz-progress">Word {index + 1} of {queue.length}</p>

      {phase === 'memorise' && (
        <div className="quiz-stage quiz-memorise">
          <p className="quiz-instruction">Remember this word!</p>
          <div className="quiz-word-display">{currentWord}</div>
          <div className="quiz-countdown">{countdown}</div>
        </div>
      )}

      {phase === 'type' && (
        <div className="quiz-stage quiz-type">
          <p className="quiz-instruction">Now spell it!</p>
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type the word…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="submit">Check ✓</button>
          </form>
        </div>
      )}

      {phase === 'feedback' && (() => {
        const last = results[results.length - 1];
        const tip  = !last.correct && dyslexiaMode ? getSupportTip(last.word) : null;
        return (
          <div className={`quiz-stage quiz-feedback ${last.correct ? 'correct' : 'wrong'}`}>
            <span className="feedback-icon">{last.correct ? '✓' : '✗'}</span>
            {last.correct
              ? <p>Correct!</p>
              : <p>The word was <strong>{last.word}</strong></p>
            }
            {tip && (
              <div className="support-tip">
                <span className="support-tip-icon">💡</span>
                <span>{tip.support_strategy}</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default SpellingQuiz;
