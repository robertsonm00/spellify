import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { getMorphology, pickDistractors } from '../../data/morphology';
import GameHeader from '../GameHeader';
import GameProgressStrip from '../GameProgressStrip';
import './WordForge.css';

// ── Word-correct celebration (mirrors Hangman / Crossword / WordSearch) ─────

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
  } catch { /* AudioContext unavailable */ }
}

function fireWordConfetti() {
  confetti({
    particleCount: 90,
    spread: 65,
    origin: { y: 0.4 },
    colors: ['#22c55e', '#86efac', '#ffd93d', '#c77dff', '#4d96ff'],
  });
}

/**
 * Word Forge — pupil drags prefix/suffix tiles onto a root to build a word.
 * Only runs on session words that have a prefix/suffix breakdown; the
 * activityAvailability gate hides the game when no word qualifies.
 */
function WordForge({ words, onComplete, onExit }) {
  const queue = useMemo(
    () => (words || []).filter((w) => getMorphology(w)),
    [words]
  );

  const [wordIndex,  setWordIndex] = useState(0);
  const [pickedPre,  setPickedPre] = useState(null);
  const [pickedSuf,  setPickedSuf] = useState(null);
  const [phase,      setPhase]     = useState('build'); // build | result | complete
  const [results,    setResults]   = useState([]);

  const target = queue[wordIndex];
  const morph  = getMorphology(target);

  // Build distractor banks once per word
  const tiles = useMemo(() => {
    if (!morph) return { prefixes: [], suffixes: [] };
    const prefixes = morph.prefix
      ? [morph.prefix, ...pickDistractors('prefix', morph.prefix, 3)].sort(() => Math.random() - 0.5)
      : [];
    const suffixes = morph.suffix
      ? [morph.suffix, ...pickDistractors('suffix', morph.suffix, 3)].sort(() => Math.random() - 0.5)
      : [];
    return { prefixes, suffixes };
  }, [morph]);

  // Auto-submit the moment all required slots are filled. Inline the logic
  // so the effect doesn't reference functions declared later (rules-of-hooks
  // requires this hook to sit above the early returns below).
  useEffect(() => {
    if (!morph || phase !== 'build') return;
    const filled = (!morph.prefix || pickedPre) && (!morph.suffix || pickedSuf);
    if (!filled) return;
    const isCorrect = (!morph.prefix || pickedPre === morph.prefix)
                   && (!morph.suffix || pickedSuf === morph.suffix);
    const attempt   = isCorrect
      ? target
      : `${pickedPre || ''}${morph.root}${pickedSuf || ''}`;
    if (isCorrect) {
      playWordChime();
      fireWordConfetti();
    }
    setResults((prev) => [...prev, { word: target, correct: isCorrect, attempt }]);
    setPhase('result');
  }, [phase, pickedPre, pickedSuf, morph, target]);

  if (!morph) {
    return (
      <>
        <GameHeader title="Word Forge" onExit={onExit} />
        <div className="wf-shell">
          <p>No morphology data for this word.</p>
        </div>
      </>
    );
  }

  // Live preview shown beneath the slots. Once the picks are right the
  // effect transitions to 'result' phase, so this only matters mid-build.
  const built = `${pickedPre || ''}${morph.root}${pickedSuf || ''}`;

  const handleNext = () => {
    if (wordIndex + 1 >= queue.length) {
      setPhase('complete');
    } else {
      setWordIndex(wordIndex + 1);
      setPickedPre(null);
      setPickedSuf(null);
      setPhase('build');
    }
  };

  if (phase === 'complete') {
    const wins = results.filter((r) => r.correct).length;
    return (
      <>
        <GameHeader title="Word Forge" onExit={onExit} />
        <GameProgressStrip percent={100}>
          {results.length} of {queue.length} words done
        </GameProgressStrip>
        <div className="wf-shell wf-complete">
          <h2 className="wf-title">Word Forge complete!</h2>
        <p className="wf-score">{wins} / {results.length} correct</p>
        <ul className="wf-summary">
          {results.map((r, i) => (
            <li key={i} className={r.correct ? 'wf-summary-row wf-summary-row--ok' : 'wf-summary-row wf-summary-row--bad'}>
              <span className="wf-summary-word">{r.word}</span>
              {!r.correct && <span className="wf-summary-attempt">you built: {r.attempt || '(empty)'}</span>}
            </li>
          ))}
        </ul>
        <button className="wf-cta" onClick={() => onComplete(results.map((r) => ({ word: r.word, correct: r.correct })))}>
          Back to Hub
        </button>
        </div>
      </>
    );
  }

  return (
    <>
      <GameHeader title="Word Forge" onExit={onExit} />
      <GameProgressStrip percent={(wordIndex / queue.length) * 100}>
        Word {wordIndex + 1} of {queue.length}
      </GameProgressStrip>
      <div className="wf-shell">
      <p className="wf-instructions">
        Build the target word by tapping a {morph.prefix && morph.suffix ? 'prefix and suffix' : morph.prefix ? 'prefix' : 'suffix'} to add to the root.
      </p>

      <div className="wf-target">
        <span className="wf-target-label">Target:</span>
        <strong className="wf-target-word">{target}</strong>
      </div>

      {/* Build slots */}
      <div className="wf-slots">
        {morph.prefix && (
          <div
            className={`wf-slot ${pickedPre ? 'wf-slot--filled' : ''}`}
            onClick={() => setPickedPre(null)}
            role="button"
            aria-label="Prefix slot — tap to clear"
          >
            {pickedPre || 'prefix'}
          </div>
        )}
        <div className="wf-slot wf-slot--root">{morph.root}</div>
        {morph.suffix && (
          <div
            className={`wf-slot ${pickedSuf ? 'wf-slot--filled' : ''}`}
            onClick={() => setPickedSuf(null)}
            role="button"
            aria-label="Suffix slot — tap to clear"
          >
            {pickedSuf || 'suffix'}
          </div>
        )}
      </div>

      <p className="wf-preview">Preview: <span>{built || '...'}</span></p>

      {/* Tile banks */}
      {morph.prefix && (
        <div className="wf-bank">
          <span className="wf-bank-label">Prefixes</span>
          <div className="wf-tiles">
            {tiles.prefixes.map((p) => (
              <button
                key={p}
                className={`wf-tile ${pickedPre === p ? 'wf-tile--picked' : ''}`}
                onClick={() => setPickedPre(p)}
                disabled={phase === 'result'}
              >
                {p}-
              </button>
            ))}
          </div>
        </div>
      )}

      {morph.suffix && (
        <div className="wf-bank">
          <span className="wf-bank-label">Suffixes</span>
          <div className="wf-tiles">
            {tiles.suffixes.map((s) => (
              <button
                key={s}
                className={`wf-tile ${pickedSuf === s ? 'wf-tile--picked' : ''}`}
                onClick={() => setPickedSuf(s)}
                disabled={phase === 'result'}
              >
                -{s}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div className="wf-result">
          {results[results.length - 1]?.correct ? (
            <p className="wf-result-ok">✅ Forged it! "{target}" = {morph.prefix ? `${morph.prefix} + ` : ''}{morph.root}{morph.suffix ? ` + ${morph.suffix}` : ''}</p>
          ) : (
            <p className="wf-result-bad">
              Almost — the answer was <strong>{target}</strong>.
            </p>
          )}
          <button className="wf-cta" onClick={handleNext}>Next →</button>
        </div>
      )}
      </div>
    </>
  );
}

export default WordForge;
