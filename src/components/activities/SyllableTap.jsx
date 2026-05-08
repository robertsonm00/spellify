import React, { useState, useEffect, useCallback } from 'react';
import { speakWord } from '../../utils/speech';
import { syllableCount } from '../../utils/syllableCount';
import './SyllableTap.css';

/**
 * Syllable Tap — pupil hears a word and taps once per syllable.
 * Compares tap count against the heuristic syllable count for the word.
 */
function SyllableTap({ words, onComplete, onExit }) {
  const queue = words || [];
  const [wordIndex, setWordIndex] = useState(0);
  const [taps,      setTaps]      = useState(0);
  const [phase,     setPhase]     = useState('listen'); // listen | tap | result | complete
  const [results,   setResults]   = useState([]);

  const word    = queue[wordIndex];
  const correct = word ? syllableCount(word) : 0;

  const playWord = useCallback(() => {
    if (!word) return;
    speakWord(word, { rate: 0.7 });
  }, [word]);

  // Auto-play the word when each new round starts
  useEffect(() => {
    if (phase === 'listen' && word) {
      const id = setTimeout(playWord, 250);
      return () => clearTimeout(id);
    }
  }, [phase, word, playWord]);

  const handleTap = () => {
    if (phase === 'listen') setPhase('tap');
    setTaps((t) => t + 1);
  };

  const handleDone = () => {
    if (phase === 'listen') return;
    const isCorrect = taps === correct;
    const next = [...results, { word, correct: isCorrect, taps, expected: correct }];
    setResults(next);
    setPhase('result');
  };

  const handleNext = () => {
    if (wordIndex + 1 >= queue.length) {
      setPhase('complete');
    } else {
      setWordIndex(wordIndex + 1);
      setTaps(0);
      setPhase('listen');
    }
  };

  if (phase === 'complete') {
    const wins = results.filter((r) => r.correct).length;
    return (
      <div className="st-shell st-complete">
        <h2 className="st-title">All done!</h2>
        <p className="st-score">{wins} / {results.length} correct</p>
        <ul className="st-summary">
          {results.map((r, i) => (
            <li key={i} className={r.correct ? 'st-summary-row st-summary-row--ok' : 'st-summary-row st-summary-row--bad'}>
              <span className="st-summary-word">{r.word}</span>
              <span className="st-summary-counts">you tapped {r.taps} · was {r.expected}</span>
            </li>
          ))}
        </ul>
        <div className="st-cta-row">
          <button className="st-cta" onClick={() => onComplete(results.map((r) => ({ word: r.word, correct: r.correct })))}>
            Back to Hub
          </button>
        </div>
      </div>
    );
  }

  if (!word) {
    return (
      <div className="st-shell">
        <p>No words available.</p>
        <button className="st-cta" onClick={onExit}>Back</button>
      </div>
    );
  }

  return (
    <div className="st-shell">
      <div className="st-header">
        <button className="st-exit" onClick={onExit}>← Exit</button>
        <span className="st-progress">{wordIndex + 1} / {queue.length}</span>
      </div>

      <h2 className="st-title">Syllable Tap</h2>
      <p className="st-instructions">
        Listen to the word, then tap once for each syllable you hear.
      </p>

      <button className="st-play" onClick={playWord}>
        🔊 Hear it again
      </button>

      <button
        className={`st-tap-btn st-tap-btn--${phase}`}
        onClick={handleTap}
        disabled={phase === 'result'}
      >
        TAP
      </button>

      <p className="st-tap-count" aria-live="polite">
        {taps === 0 ? 'Tap to count syllables' : `${taps} tap${taps === 1 ? '' : 's'}`}
      </p>

      {phase === 'tap' && (
        <button className="st-cta" onClick={handleDone}>Done ✓</button>
      )}

      {phase === 'result' && (
        <div className="st-result">
          {taps === correct ? (
            <p className="st-result-ok">✅ Right! "{word}" has {correct} syllable{correct === 1 ? '' : 's'}.</p>
          ) : (
            <p className="st-result-bad">
              Not quite — "{word}" has <strong>{correct}</strong> syllable{correct === 1 ? '' : 's'}.
            </p>
          )}
          <button className="st-cta" onClick={handleNext}>Next →</button>
        </div>
      )}
    </div>
  );
}

export default SyllableTap;
