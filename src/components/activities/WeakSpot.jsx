import React, { useState, useEffect, useRef } from 'react';
import { getWeakSpot } from '../../data/weakSpots';
import './WeakSpot.css';

const FLASH_MS = 1500;

/**
 * Weak Spot — flash a word for ~1.5s, then show it again with the
 * statistically tricky segment blanked out. Pupil types the missing letters.
 */
function WeakSpot({ words, onComplete, onExit }) {
  const queue = words || [];
  const [wordIndex, setWordIndex] = useState(0);
  const [phase,     setPhase]     = useState('flash'); // flash | type | result | complete
  const [input,     setInput]     = useState('');
  const [results,   setResults]   = useState([]);
  const inputRef = useRef(null);

  const word = queue[wordIndex];
  const spot = word ? getWeakSpot(word) : null;
  const missing = word && spot ? word.slice(spot.start, spot.end) : '';
  const before  = word && spot ? word.slice(0, spot.start) : '';
  const after   = word && spot ? word.slice(spot.end) : '';

  // Flash → type transition
  useEffect(() => {
    if (phase !== 'flash') return;
    const id = setTimeout(() => setPhase('type'), FLASH_MS);
    return () => clearTimeout(id);
  }, [phase, wordIndex]);

  // Focus the input once typing phase begins
  useEffect(() => {
    if (phase === 'type') inputRef.current?.focus();
  }, [phase]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (phase !== 'type') return;
    const isCorrect = input.trim().toLowerCase() === missing.toLowerCase();
    setResults([...results, { word, correct: isCorrect, attempt: input.trim(), missing }]);
    setPhase('result');
  };

  const handleNext = () => {
    if (wordIndex + 1 >= queue.length) {
      setPhase('complete');
    } else {
      setWordIndex(wordIndex + 1);
      setInput('');
      setPhase('flash');
    }
  };

  if (phase === 'complete') {
    const wins = results.filter((r) => r.correct).length;
    return (
      <div className="ws-shell ws-complete">
        <h2 className="ws-title">Weak Spot complete!</h2>
        <p className="ws-score">{wins} / {results.length} correct</p>
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
        <button className="ws-cta" onClick={() => onComplete(results.map((r) => ({ word: r.word, correct: r.correct })))}>
          Back to Hub
        </button>
      </div>
    );
  }

  if (!word) {
    return (
      <div className="ws-shell">
        <p>No words available.</p>
        <button className="ws-cta" onClick={onExit}>Back</button>
      </div>
    );
  }

  return (
    <div className="ws-shell">
      <div className="ws-header">
        <button className="ws-exit" onClick={onExit}>← Exit</button>
        <span className="ws-progress">{wordIndex + 1} / {queue.length}</span>
      </div>

      <h2 className="ws-title">Weak Spot</h2>

      {phase === 'flash' && (
        <>
          <p className="ws-instructions">Look carefully...</p>
          <div className="ws-word-flash">{word}</div>
        </>
      )}

      {phase === 'type' && (
        <>
          <p className="ws-instructions">Fill in the missing letters.</p>
          <form onSubmit={handleSubmit} className="ws-form">
            <div className="ws-word-blank">
              <span className="ws-letters">{before}</span>
              <input
                ref={inputRef}
                className="ws-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                size={Math.max(missing.length, 2)}
                maxLength={missing.length + 2}
                autoComplete="off"
                spellCheck="false"
              />
              <span className="ws-letters">{after}</span>
            </div>
            <button className="ws-cta" type="submit" disabled={!input.trim()}>
              Check ✓
            </button>
          </form>
        </>
      )}

      {phase === 'result' && (
        <div className="ws-result">
          {results[results.length - 1]?.correct ? (
            <p className="ws-result-ok">✅ Spot on! "{word}"</p>
          ) : (
            <p className="ws-result-bad">
              The tricky bit was <strong>"{missing}"</strong> — full word: <strong>{word}</strong>
            </p>
          )}
          <button className="ws-cta" onClick={handleNext}>Next →</button>
        </div>
      )}
    </div>
  );
}

export default WeakSpot;
