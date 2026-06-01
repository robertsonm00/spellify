/**
 * PracticeWriteIt — single-slot Write-It used by Practice Quest.
 *
 * Purpose-built wrapper around the spelling-practice mechanic for the
 * struggling-word pool. Differs from `WriteIt` in three ways:
 *
 *   1. One attempt per word (vs three practice slots).
 *   2. Text-to-speech fires automatically as each word is presented;
 *      no "Hear it" tap needed (a 🔊 replay button is still offered).
 *   3. Syllable chunking is shown by default underneath the word.
 *   4. A "Show first letter" hint is available — using it stamps the
 *      result with `hintUsed: true`.
 *
 * The component is intentionally standalone — Practice Quest is hub-
 * launched and never appears in the activity registry. Hosts pass a
 * plain array of practice items:
 *
 *   { word: string, listId?: string, listName?: string }
 *
 * The optional `listName` is rendered as a small "From: …" label
 * beneath the word, used by the hub-level layer that spans lists.
 *
 * Props
 * -----
 *   items            (required) array of practice items (see shape above)
 *   onComplete       (required) (results) => void — final results array,
 *                    one entry per word with the credit-framework shape
 *                    { word, listId, correct, attempts, hintUsed }.
 *   onExit           (required) () => void — close without saving.
 *   onBack           (required) () => void — called from the summary's
 *                    Back button after the parent has processed onComplete.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './PracticeWriteIt.css';
import GameHeader from './GameHeader';
import GameProgressStrip from './GameProgressStrip';
import { speakWord as speak } from '../utils/speech';
import { chunkWord } from '../utils/wordChunking';

// Themed background — injected via CSS custom property at runtime.
const BG_STYLE = {
  '--bg-image-url': `url("${process.env.PUBLIC_URL || ''}/adventure/backgrounds/write-it-background.webp")`,
};

const FEEDBACK_DELAY_MS = 1400;

export default function PracticeWriteIt({ items = [], onComplete, onExit, onBack }) {
  const safeItems = Array.isArray(items) ? items.filter(it => it && it.word) : [];

  const [idx,        setIdx]        = useState(0);
  const [input,      setInput]      = useState('');
  const [hintUsed,   setHintUsed]   = useState(false);
  const [feedback,   setFeedback]   = useState(null); // 'correct' | 'wrong' | null
  const [results,    setResults]    = useState([]);   // accumulated outcomes
  const [phase,      setPhase]      = useState('play'); // 'play' | 'summary'
  const inputRef = useRef(null);

  const current = safeItems[idx] || null;
  const total   = safeItems.length;

  // Auto-TTS each time we land on a fresh word. Browsers typically allow
  // speech synthesis without a user gesture inside the same task as a
  // previous gesture (the click that opened Practice Quest counts).
  useEffect(() => {
    if (phase !== 'play' || !current) return;
    speak(current.word);
    // Reset per-word UI state when the word changes.
    setInput('');
    setHintUsed(false);
    setFeedback(null);
    // Tiny delay so the input is mounted before we focus.
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [idx, phase, current]);

  // ── Submission ─────────────────────────────────────────────────────────
  const submit = useCallback(() => {
    if (!current || feedback) return; // ignore double-taps during feedback
    const guess   = input.trim().toLowerCase();
    const target  = current.word.toLowerCase();
    const correct = guess === target;

    const result = {
      word:     current.word,
      listId:   current.listId || null,
      correct,
      attempts: 1,           // single-slot — exactly one attempt
      hintUsed,
    };
    const next = [...results, result];
    setResults(next);
    setFeedback(correct ? 'correct' : 'wrong');

    setTimeout(() => {
      if (idx + 1 >= total) {
        setPhase('summary');
        // Fire onComplete with the full results array so the host can
        // record per-word mastery before the summary's Back button
        // takes the child back to where they came from.
        onComplete?.(next);
      } else {
        setIdx(i => i + 1);
      }
    }, FEEDBACK_DELAY_MS);
  }, [current, input, hintUsed, results, idx, total, feedback, onComplete]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  // ── Render — empty / done states ───────────────────────────────────────
  if (total === 0) {
    return (
      <div className="pq-wrap" style={BG_STYLE}>
        <GameHeader title="Spells to Master" onExit={onExit} />
        <p className="pq-empty">No words to practise right now — well done!</p>
        <div className="pq-summary-actions">
          <button className="pq-back-btn" onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  if (phase === 'summary') {
    const correct = results.filter(r => r.correct).map(r => r.word);
    const wrong   = results.filter(r => !r.correct).map(r => r.word);
    return (
      <div className="pq-wrap pq-wrap--summary" style={BG_STYLE}>
        <GameHeader title="Spells to Master" onExit={onExit} />
        <div className="pq-summary">
          <h2 className="pq-summary-title">Well done for practising!</h2>

          {correct.length > 0 && (
            <section className="pq-summary-block pq-summary-block--correct">
              <p className="pq-summary-label">Spells getting stronger</p>
              <ul className="pq-summary-list">
                {correct.map(w => (
                  <li key={w}><span className="pq-mark">✓</span> {w}</li>
                ))}
              </ul>
            </section>
          )}

          {wrong.length > 0 && (
            <section className="pq-summary-block pq-summary-block--keep">
              <p className="pq-summary-label">Keep going</p>
              <ul className="pq-summary-list">
                {wrong.map(w => (
                  <li key={w}><span className="pq-mark pq-mark--keep">✗</span> {w}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="pq-summary-actions">
            <button className="pq-back-btn" onClick={onBack}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render — play screen ───────────────────────────────────────────────
  const chunked = chunkWord(current.word);
  const showHint = hintUsed;
  const firstLetter = current.word[0]?.toUpperCase() || '';

  const inputClass =
    'pq-input' +
    (feedback === 'correct' ? ' pq-input--correct' : '') +
    (feedback === 'wrong'   ? ' pq-input--wrong'   : '');

  return (
    <div className="pq-wrap" style={BG_STYLE}>
      <GameHeader title="Spells to Master" onExit={onExit} />

      <GameProgressStrip percent={(idx / total) * 100}>
        Word {idx + 1} of {total}
      </GameProgressStrip>

      <div className="pq-play">
        {/* Syllable chunking shown by default beneath the word.
            The actual word is NOT shown — that's the point of the
            practice. We do show the chunked syllable shape so the
            child has phonetic structure to lean on. */}
        <div className="pq-chunk" aria-label="Syllable shape">
          {chunked.split('·').map((piece, i, arr) => (
            <React.Fragment key={i}>
              <span className="pq-chunk-piece">{'•'.repeat(piece.length)}</span>
              {i < arr.length - 1 && <span className="pq-chunk-sep">·</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Source list label — only when listName is present */}
        {current.listName && (
          <p className="pq-source">From: <strong>{current.listName}</strong></p>
        )}

        {/* Hear-it replay (auto-played on word change; kept for replay) */}
        <button
          type="button"
          className="pq-hear-btn"
          onClick={() => speak(current.word)}
          title="Hear it again"
        >
          🔊 Hear it again
        </button>

        {/* Optional first-letter hint */}
        <button
          type="button"
          className="pq-hint-btn"
          onClick={() => {
            if (hintUsed) return;
            setHintUsed(true);
          }}
          disabled={hintUsed || !!feedback}
        >
          💡 {hintUsed ? `Starts with "${firstLetter}"` : 'Show first letter'}
        </button>

        <input
          ref={inputRef}
          className={inputClass}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/[^a-zA-Z]/g, ''))}
          onKeyDown={handleKeyDown}
          maxLength={current.word.length + 2}
          autoFocus
          disabled={!!feedback}
          aria-label="Type the word"
          placeholder={showHint ? `${firstLetter}…` : ''}
        />

        <div className="pq-actions">
          <button
            className="pq-submit-btn"
            onClick={submit}
            disabled={!!feedback || input.length === 0}
          >
            Check ▶
          </button>
        </div>

        {feedback === 'correct' && (
          <p className="pq-feedback pq-feedback--correct">Nice one! 🌟</p>
        )}
        {feedback === 'wrong' && (
          <p className="pq-feedback pq-feedback--wrong">
            The word was <strong>{current.word}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
