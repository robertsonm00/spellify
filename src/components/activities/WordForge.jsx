import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { getMorphology, pickDistractors } from '../../data/morphology';
import GameHeader from '../GameHeader';
import BuddyAvatar from '../BuddyAvatar';
import GameResults from '../GameResults';
import DevCompleteButton from '../DevCompleteButton';
import '../MemorySpell.css';
import './WordForge.css';

// Themed background — Word Forge reuses Memory Spell's look/layout (R2-01),
// so it inherits the same dark glowing card on a themed backdrop. A bespoke
// word-forge background can be dropped in later by swapping the filename.
const BG_STYLE = {
  '--bg-image-url': `url("${process.env.PUBLIC_URL || ''}/adventure/backgrounds/memory-spell-background.png")`,
};

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
 * Word Forge — pupil taps prefix/suffix tiles onto a root to build a word.
 * Only runs on session words that have a prefix/suffix breakdown; the
 * activityAvailability gate hides the game when no word qualifies.
 *
 * R2-01: restyled to share Memory Spell's look (themed dark card, buddy,
 * white H1, "Word X / Y" pill) and finishes on the shared RES-01 Variant A
 * results screen (GameResults) like every other game.
 */
function WordForge({ words, childCharacter = null, dyslexiaMode = false, onComplete, onExit }) {
  const queue = useMemo(
    () => (words || []).filter((w) => getMorphology(w)),
    [words]
  );

  const [wordIndex,     setWordIndex]     = useState(0);
  const [pickedPre,     setPickedPre]     = useState(null);
  const [pickedSuf,     setPickedSuf]     = useState(null);
  const [phase,         setPhase]         = useState('build'); // build | result | complete
  const [results,       setResults]       = useState([]);
  const [buddyCheering, setBuddyCheering] = useState(false);

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
      setBuddyCheering(true);
      setTimeout(() => setBuddyCheering(false), 1000);
    }
    setResults((prev) => [...prev, { word: target, correct: isCorrect, attempt }]);
    setPhase('result');
  }, [phase, pickedPre, pickedSuf, morph, target]);

  const wrapClass = `ms-wrap game-magical-bg${dyslexiaMode ? ' ms-wrap--es' : ''}`;
  const topbar    = <GameHeader title="Word Forge" onExit={onExit} />;

  // ── DEV-only: instant complete ─────────────────────────────────────────────
  // Mark every word correct and jump to the shared results screen, so the
  // Continue → onComplete (points / lumens / reward) flow can be tested without
  // forging each word.
  const handleDevComplete = () => {
    setResults(queue.map((w) => ({ word: w, correct: true, attempt: w })));
    setPhase('complete');
  };

  // ── Results screen (RES-01 Variant A — shared with Memory Spell) ───────────
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
        {topbar}
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

  if (!morph) {
    return (
      <div className={wrapClass} style={BG_STYLE}>
        {topbar}
        <div className="ms-stage">
          <div className="ms-phase">
            <h1 className="ms-h1">No prefix or suffix words here.</h1>
          </div>
        </div>
      </div>
    );
  }

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

  // Live preview shown beneath the slots. Once the picks are right the
  // effect transitions to 'result' phase, so this only matters mid-build.
  const built = `${pickedPre || ''}${morph.root}${pickedSuf || ''}`;
  const last  = results[results.length - 1];

  return (
    <div className={wrapClass} style={BG_STYLE}>
      {topbar}
      <DevCompleteButton onClick={handleDevComplete} />

      <div className="ms-stage">
        <div className="ms-phase">
          <span className="ms-buddy" aria-hidden="true">
            <BuddyAvatar
              id={childCharacter?.id}
              size={120}
              fallback={childCharacter?.emoji}
              cheering={buddyCheering}
            />
          </span>

          <span className="ms-word-counter" aria-label={`Word ${wordIndex + 1} of ${queue.length}`}>
            Word {wordIndex + 1}<span className="ms-word-counter__sep">/</span>{queue.length}
          </span>

          <h1 className="ms-h1">Build the word!</h1>
          <p className="wf-instructions">
            Tap a {morph.prefix && morph.suffix ? 'prefix and suffix' : morph.prefix ? 'prefix' : 'suffix'} to add to the root.
          </p>

          <div className="wf-target">
            <span className="wf-target-label">TARGET</span>
            <strong className="wf-target-word">{target}</strong>
          </div>

          {/* Build slots */}
          <div className="wf-slots">
            {morph.prefix && (
              <div
                className={`wf-slot ${pickedPre ? 'wf-slot--filled' : ''}`}
                onClick={() => { if (phase === 'build') setPickedPre(null); }}
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
                onClick={() => { if (phase === 'build') setPickedSuf(null); }}
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
              <span className="wf-bank-label">PREFIXES</span>
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
              <span className="wf-bank-label">SUFFIXES</span>
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

          {/* Result — success / wrong panels mirror Memory Spell's. */}
          {phase === 'result' && last?.correct && (
            <div className="ms-success-panel" role="status" aria-live="polite">
              <p className="ms-success-msg">🎉 You forged it!</p>
              <span className="ms-word-big ms-word-big--correct">{target}</span>
              <button className="ms-btn ms-btn--primary ms-btn--large" onClick={handleNext}>
                {wordIndex + 1 >= queue.length ? 'See results ▶' : 'Next word ▶'}
              </button>
            </div>
          )}

          {phase === 'result' && last && !last.correct && (
            <div className="ms-wrong-panel" role="status" aria-live="polite">
              <p className="ms-wrong-msg">Good try! The word was…</p>
              <span className="ms-word-big ms-word-big--wrong">{target}</span>
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

export default WordForge;
