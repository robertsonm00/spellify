import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { speakWord, speakSyllables } from '../../utils/speech';
import { syllableCount, syllableChunks } from '../../utils/syllableCount';
import GameHeader from '../GameHeader';
import GameProgressStrip from '../GameProgressStrip';
import GameResults from '../GameResults';
import DevCompleteButton from '../DevCompleteButton';
import './SyllableTap.css';

// Themed background — injected via CSS custom property at runtime.
const BG_STYLE = {
  '--bg-image-url': `url("${process.env.PUBLIC_URL || ''}/adventure/backgrounds/syllable-tap-background.png")`,
};

// ── Correct-guess celebration (matches Hangman / Crossword feel) ─────────
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
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch { /* AudioContext unavailable */ }
}

function fireWordConfetti() {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.45 },
    colors: ['#a855f7', '#c084fc', '#6bcb77', '#ffd93d', '#4d96ff', '#ec4899'],
  });
}

/**
 * Syllable Tap — pupil hears a word and taps once per syllable.
 * Compares tap count against the heuristic syllable count for the word.
 */
function SyllableTap({ words, onComplete, onExit, savedProgress = null, onSaveProgress }) {
  const queue = words || [];

  // Validate saved snapshot — drop it if the word list has changed.
  const savedIsValid = (() => {
    if (!savedProgress?.queue) return false;
    const a = new Set(savedProgress.queue.map((w) => String(w).toLowerCase()));
    const b = new Set(queue.map((w) => String(w).toLowerCase()));
    return a.size === b.size && [...a].every((w) => b.has(w));
  })();

  const initIndex   = savedIsValid ? (savedProgress.wordIndex ?? 0) : 0;
  const initResults = savedIsValid ? (savedProgress.results   ?? []) : [];

  const initPhase = savedIsValid && initIndex >= queue.length ? 'complete' : 'listen';

  const [wordIndex, setWordIndex] = useState(initIndex);
  const [taps,      setTaps]      = useState(0);
  const [phase,     setPhase]     = useState(initPhase); // listen | tap | result | complete
  const [results,   setResults]   = useState(initResults);

  const word    = queue[wordIndex];
  const correct = word ? syllableCount(word) : 0;
  const chunks  = useMemo(() => (word ? syllableChunks(word) : []), [word]);

  const playSyllables = useCallback(() => {
    if (!word) return;
    speakSyllables(word, chunks);
  }, [word, chunks]);

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

  // Persist progress so exit-then-return resumes mid-game.
  useEffect(() => {
    if (results.length === 0) return;
    onSaveProgress?.({ queue, wordIndex, results });
  }, [results, wordIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTap = () => {
    if (phase === 'listen') setPhase('tap');
    setTaps((t) => t + 1);
  };

  const handleUndo = () => {
    if (phase !== 'tap') return;
    setTaps((t) => {
      const next = Math.max(0, t - 1);
      // If we undid the only tap, drop back to the listen phase
      if (next === 0) setPhase('listen');
      return next;
    });
  };

  const handleDone = () => {
    if (phase === 'listen') return;
    const isCorrect = taps === correct;
    if (isCorrect) {
      playWordChime();
      fireWordConfetti();
    }
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

  // ── DEV-only: instant complete ─────────────────────────────────────────────
  // Mark every word correct and jump to the shared results screen, so the
  // celebration + Continue → onComplete (points / lumens / reward) flow can be
  // tested without tapping out every word.
  const handleDevComplete = () => {
    setResults(queue.map((w) => {
      const expected = syllableCount(w);
      return { word: w, correct: true, taps: expected, expected };
    }));
    setPhase('complete');
  };

  // When the answer is wrong, auto-play the word broken into syllables so
  // the child hears the structure they missed.
  useEffect(() => {
    if (phase !== 'result') return;
    if (taps === correct) return;
    const id = setTimeout(playSyllables, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Auto-advance after a correct tap result, mirroring MemorySpell.
  const autoAdvanceTimerRef = useRef(null);
  const lastResult = phase === 'result' ? results[results.length - 1] : null;
  useEffect(() => {
    if (lastResult?.correct) {
      autoAdvanceTimerRef.current = setTimeout(handleNext, 3000);
      return () => clearTimeout(autoAdvanceTimerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastResult]);

  // Allow the spacebar as a tap; ignore when typing in a control or when
  // the round is already in result/complete state.
  useEffect(() => {
    if (phase !== 'listen' && phase !== 'tap') return;
    const onKey = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      handleTap();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === 'complete') {
    // Roll to one entry per word (most-recent outcome) and split into the two
    // boxes. The per-word tap-count detail ("you tapped 2 · was 1") is left
    // out for now — parked, see RES-01.
    const byWord = new Map();
    for (const r of results) {
      byWord.set(String(r.word).toLowerCase(), { word: r.word, correct: !!r.correct });
    }
    const unique        = Array.from(byWord.values());
    const correctWords  = unique.filter((e) =>  e.correct).map((e) => e.word);
    const practiceWords = unique.filter((e) => !e.correct).map((e) => e.word);

    return (
      <div className="st-wrap game-magical-bg" style={BG_STYLE}>
        <GameHeader title="Syllable Tap" onExit={onExit} />
        <GameProgressStrip percent={100}>
          {results.length} of {queue.length} words done
        </GameProgressStrip>
        <GameResults
          variant="A"
          correctWords={correctWords}
          practiceWords={practiceWords}
          total={unique.length}
          onContinue={() => onComplete(results.map((r) => ({ word: r.word, correct: r.correct })))}
        />
      </div>
    );
  }

  if (!word) {
    return (
      <div className="st-wrap game-magical-bg" style={BG_STYLE}>
        <GameHeader title="Syllable Tap" onExit={onExit} />
        <div className="st-shell">
          <p>No words available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="st-wrap game-magical-bg" style={BG_STYLE}>
      <GameHeader title="Syllable Tap" onExit={onExit} />
      <DevCompleteButton onClick={handleDevComplete} />
      <GameProgressStrip percent={(wordIndex / queue.length) * 100}>
        Word {wordIndex + 1} of {queue.length}
      </GameProgressStrip>
      <div className="st-shell">
        <span
          className="st-word-counter"
          aria-label={`Word ${Math.min(wordIndex + 1, queue.length)} of ${queue.length}`}
        >
          Word {Math.min(wordIndex + 1, queue.length)}<span className="st-word-counter__sep">/</span>{queue.length}
        </span>
        <h1 className="st-instructions">
          Listen to the word, then tap once for each syllable you hear.
        </h1>

        {phase !== 'result' && (
          <button className="st-play" onClick={playWord}>
            🔊 Hear it again
          </button>
        )}

        {phase !== 'result' && (
          <div className="st-tap-row">
            {/* Undo only appears once a real correction is possible — i.e.
                from the second tap onwards. */}
            {taps >= 2 ? (
              <button
                className="st-undo"
                onClick={handleUndo}
                aria-label="Undo last tap"
              >
                ↩ Undo
              </button>
            ) : (
              <span className="st-tap-row-spacer" aria-hidden="true" />
            )}

            <button
              className={`st-tap-btn st-tap-btn--${phase}`}
              onClick={handleTap}
              disabled={phase === 'result'}
              aria-label={taps === 0 ? 'Tap once for each syllable' : `${taps} tap${taps === 1 ? '' : 's'}`}
            >
              {taps === 0 ? 'TAP' : `${taps} tap${taps === 1 ? '' : 's'}`}
            </button>

            {/* Done appears after the first tap. */}
            {taps >= 1 ? (
              <button className="st-cta st-cta--done" onClick={handleDone}>
                Done ✓
              </button>
            ) : (
              <span className="st-tap-row-spacer" aria-hidden="true" />
            )}
          </div>
        )}

        {taps === 0 && phase !== 'result' && (
          <p className="st-tap-count">Tap the button or press space</p>
        )}

        {phase === 'result' && taps === correct && (
          <div className="st-success-panel" role="status" aria-live="polite">
            <p className="st-success-msg">🎉 You got it right!</p>
            <span className="st-word-big st-word-big--correct">{word}</span>
            <p className="st-result-detail">
              {correct} syllable{correct === 1 ? '' : 's'}
            </p>
            <button
              className="st-cta st-cta--auto"
              onClick={() => {
                clearTimeout(autoAdvanceTimerRef.current);
                handleNext();
              }}
            >
              <span className="st-cta-auto-fill" aria-hidden="true" />
              <span className="st-cta-auto-label">
                {wordIndex + 1 >= queue.length ? 'See results ▶' : 'Next word ▶'}
              </span>
            </button>
          </div>
        )}

        {phase === 'result' && taps !== correct && (
          <div className="st-wrong-panel" role="status" aria-live="polite">
            <p className="st-wrong-msg">Good try! The word was...</p>
            <span className="st-word-big">
              {chunks.length > 1 ? chunks.join('·') : word}
            </span>
            <p className="st-result-detail">
              You tapped <strong>{taps}</strong> · was <strong>{correct}</strong> syllable{correct === 1 ? '' : 's'}
            </p>
            <button className="st-play" onClick={playSyllables}>
              🔊 Hear it by syllable
            </button>
            <button className="st-cta" onClick={handleNext}>
              {wordIndex + 1 >= queue.length ? 'See results ▶' : 'Next word ▶'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SyllableTap;
