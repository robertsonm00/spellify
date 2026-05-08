/**
 * ListHubV2 — Explore list view that mirrors the My Words hub UI exactly.
 * Prototype: currently routed only for y1-ow-words.
 *
 * Game compatibility (20 words, all with definitions):
 *   Word Search  ✅
 *   Memory Spell ✅  uses built-in definitions
 *   Hangman      ✅
 *   Crossword    ⚠️  3-letter words may be skipped by layout engine (handled gracefully)
 *   Write It     ✅
 *   Quiz Quest   ✅  uses built-in definitions
 */

import React, { useState, useEffect } from 'react';
import { ACTIVITIES } from '../../data/activities';
import { getActivityAvailability } from '../../utils/activityAvailability';
import { renderExploreActivity } from './exploreActivityRunner';
import { scoreWord, scoreToBand } from '../../utils/difficultyEngine';
import DEFINITIONS from '../../data/definitions';
import { isSafeDefinition } from '../../utils/definitionSafety';
import { speakWord } from '../../utils/speech';
import '../WordListHub.css';
import './ListHub.css';
import './ListHubV2.css';

// ── Word info fetch with module-level cache (identical to WordListHub) ────────

const wordInfoCache = {};

function pickDefinitionForAge(meanings, userAge) {
  const PART_ORDER = { noun: 0, verb: 1 };
  const ordered = [...meanings].sort((a, b) => (PART_ORDER[a.partOfSpeech] ?? 2) - (PART_ORDER[b.partOfSpeech] ?? 2));
  for (const meaning of ordered) {
    for (const def of meaning.definitions || []) {
      const text = def.definition;
      if (!text || text.startsWith('(') || text.length < 5) continue;
      if (!isSafeDefinition(text)) continue;
      if (userAge < 7  && text.length > 80)  return text.slice(0, 77) + '…';
      if (userAge < 10 && text.length > 160) return text.slice(0, 157) + '…';
      return text;
    }
  }
  return null;
}

async function fetchWordInfo(word, userAge) {
  const key = word.toLowerCase();
  if (wordInfoCache[key]) return wordInfoCache[key];

  // Prefer local list definition if present (set by caller via the cache key)
  const localDef = DEFINITIONS[key];
  if (localDef) {
    const result = { definition: localDef, phonetic: null, partOfSpeech: null, example: null };
    wordInfoCache[key] = result;
    return result;
  }

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
    if (!res.ok) return { definition: null, phonetic: null, partOfSpeech: null, example: null };
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return { definition: null, phonetic: null, partOfSpeech: null, example: null };

    const phonetic     = data[0].phonetic || data[0].phonetics?.find(p => p.text)?.text || null;
    const allMeanings  = data.flatMap(e => e?.meanings || []);
    const definition   = pickDefinitionForAge(allMeanings, userAge);
    const partOfSpeech = allMeanings[0]?.partOfSpeech || null;

    let example = null;
    outer: for (const meaning of allMeanings) {
      for (const def of meaning.definitions || []) {
        if (def.example && isSafeDefinition(def.example)) { example = def.example; break outer; }
      }
    }

    const result = { definition, phonetic, partOfSpeech, example };
    wordInfoCache[key] = result;
    return result;
  } catch {
    return { definition: null, phonetic: null, partOfSpeech: null, example: null };
  }
}

// Pre-seed the cache with definitions already on the list so the modal is
// instant and doesn't need an API round-trip.
function preSeedCache(wordObjects, userAge) {
  for (const { word, definition } of wordObjects) {
    const key = word.toLowerCase();
    if (!wordInfoCache[key] && definition) {
      wordInfoCache[key] = { definition, phonetic: null, partOfSpeech: null, example: null };
    }
  }
}

// ── Word detail modal (identical to WordListHub's WordDetailModal) ─────────────

function WordDetailModal({ word, userAge, chipColor, onClose }) {
  const [info, setInfo] = useState({
    loading: true, definition: null, phonetic: null, partOfSpeech: null, example: null,
  });

  useEffect(() => {
    let cancelled = false;
    setInfo({ loading: true, definition: null, phonetic: null, partOfSpeech: null, example: null });
    fetchWordInfo(word, userAge).then(result => { if (!cancelled) setInfo({ loading: false, ...result }); });
    return () => { cancelled = true; };
  }, [word, userAge]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="hub-word-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="hub-word-modal" onClick={e => e.stopPropagation()}>
        <button className="hub-word-modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="hub-word-modal-header" style={{ borderBottomColor: chipColor }}>
          <h2 className="hub-word-modal-word" style={{ color: chipColor }}>{word}</h2>
          {!info.loading && info.phonetic    && <p className="hub-word-modal-phonetic">{info.phonetic}</p>}
          {!info.loading && info.partOfSpeech && <span className="hub-word-modal-pos">{info.partOfSpeech}</span>}
        </div>

        <div className="hub-word-modal-actions">
          <button className="hub-word-modal-speak" onClick={() => speakWord(word)}>
            🔊 Hear it
          </button>
          <button className="hub-word-modal-teacher" disabled title="Coming in a future update">
            🎤 Teacher's Recording
          </button>
        </div>

        <div className="hub-word-modal-body">
          {info.loading ? (
            <p className="hub-word-modal-loading">Looking it up…</p>
          ) : info.definition ? (
            <>
              <p className="hub-word-modal-def">{info.definition}</p>
              {info.example && (
                <p className="hub-word-modal-example">
                  <em className="hub-word-modal-example-label">e.g. </em>"{info.example}"
                </p>
              )}
            </>
          ) : (
            <p className="hub-word-modal-nodef">No definition available</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mastery dot (identical to WordListHub) ────────────────────────────────────

function MasteryDot({ rate }) {
  if (rate === null) return <span className="hub-mastery-dot hub-mastery-dot--new"      title="Not tried yet" />;
  if (rate >= 0.6)   return <span className="hub-mastery-dot hub-mastery-dot--mastered" title="Mastered!" />;
  return               <span className="hub-mastery-dot hub-mastery-dot--learning"    title="Keep practising" />;
}

// ── Constants ─────────────────────────────────────────────────────────────────
// ACTIVITIES is imported from the canonical registry in src/data/activities.js
// so adding a new game makes it appear here automatically.

const STATUS_LABEL = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed':   'Done ✓',
};

const WORD_CHIP_COLORS = [
  { bg: '#fff0f0', border: '#ff6b6b' },
  { bg: '#fff8e1', border: '#ffd93d' },
  { bg: '#f0fff4', border: '#6bcb77' },
  { bg: '#e8f4ff', border: '#4d96ff' },
  { bg: '#f5f0ff', border: '#c77dff' },
  { bg: '#fff4ec', border: '#ff9f43' },
  { bg: '#f0ffff', border: '#00d2d3' },
  { bg: '#fff0f8', border: '#ff6b9d' },
];

const CATEGORY_COLOURS = {
  'Statutory':   '#6b7280',
  'Phonics':     '#a855f7',
  'Patterns':    '#1D9E75',
  'Etymology':   '#EF9F27',
  'Vowels':      '#f97316',
  'Sight words': '#22c55e',
  'Custom':      '#6b7280',
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function ListHubV2({
  list,
  listType = 'curriculum',
  onBack,
  getListProgress,
  markComplete,
  user = null,
}) {
  const [activeActivity, setActiveActivity] = useState(null);
  const [progress,       setProgress]       = useState({});
  const [activeWord,     setActiveWord]      = useState(null); // { word, chipColor }

  const userAge     = list.ageRange?.[0] || 8;
  const wordObjects = (list.words || []).map(w =>
    typeof w === 'string' ? { word: w, definition: '' } : w
  );
  const words = wordObjects.map(w => w.word);

  // Pre-seed the word info cache with built-in definitions so the modal is instant
  preSeedCache(wordObjects, userAge);

  // ── Load progress ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (getListProgress) {
        const p = await getListProgress(list.id, listType);
        setProgress(p || {});
      }
    })();
  }, [list.id, listType, getListProgress]);

  const completedCount = ACTIVITIES.filter(a => progress[a.id]?.status === 'completed').length;
  const progressPct    = Math.round((completedCount / ACTIVITIES.length) * 100);
  const progressBlocks = ACTIVITIES.map(a => progress[a.id]?.status === 'completed');

  // ── Game complete ────────────────────────────────────────────────────────────
  const handleComplete = async (activityId, results = []) => {
    const accuracy = results.length > 0
      ? Math.round((results.filter(r => r.correct).length / results.length) * 100)
      : null;
    if (markComplete) {
      await markComplete(list.id, activityId, { accuracy, listType });
      setProgress(prev => ({
        ...prev,
        [activityId]: { status: 'completed', accuracy, completedAt: new Date().toISOString() },
      }));
    }
    setActiveActivity(null);
  };

  // ── Active game render — delegated to the canonical registry ─────────────────
  if (activeActivity) {
    const rendered = renderExploreActivity(activeActivity, {
      list,
      words,
      onComplete: handleComplete,
      onExit: () => setActiveActivity(null),
    });
    if (rendered) return rendered;
  }

  // ── Hub view ─────────────────────────────────────────────────────────────────
  const catColour = CATEGORY_COLOURS[list.category] || '#6b7280';

  return (
    <div className="lhv2-wrap">

      {/* ── Sub-header (original ListHub design) ── */}
      <div className="lh-header lhv2-subheader">
        <button className="lh-back" onClick={onBack}>← Back</button>
        <div className="lh-header-center">
          <h1 className="lh-title">{list.name}</h1>
          <div className="lh-meta">
            <span
              className="lh-badge"
              style={{ background: catColour + '22', color: catColour, border: `1.5px solid ${catColour}` }}
            >
              {list.category || 'Custom'}
            </span>
            <span className="lh-word-count">{words.length} words</span>
            {list.year && (
              <span className="lh-year">
                Year {list.year === 3 ? '3–4' : list.year === 5 ? '5–6' : list.year}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="lhv2-page">
      {/* ── Two-column body ── */}
      <div className="lhv2-body">

        {/* ── Left: word pills stacked vertically ── */}
        <aside className="lhv2-words-col">
          <div className="hub-section-header">
            <span className="hub-section-label">WORDS ({words.length})</span>
          </div>
          <div className="lhv2-chips-stack">
            {wordObjects.map((item, i) => {
              const { bg, border } = WORD_CHIP_COLORS[i % WORD_CHIP_COLORS.length];
              const band = scoreToBand(scoreWord(item.word));
              // No per-word mastery in Explore yet — show "not tried" (grey) for all
              const masteryRate = null;
              return (
                <button
                  key={item.word}
                  className="hub-chip lhv2-chip"
                  style={{ background: bg, borderColor: border }}
                  onClick={() => setActiveWord({ word: item.word, chipColor: border })}
                >
                  <MasteryDot rate={masteryRate} />
                  {item.word}
                  <span className={`hub-diff-star hub-diff-star--${band}`} title={band}>★</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Right: progress + game cards ── */}
        <main className="lhv2-games-col">

          {/* Progress bar */}
          <section className="hub-progress">
            <div className="hub-progress-labels">
              <span>{completedCount} of {ACTIVITIES.length} activities done</span>
              <span className="hub-progress-pct">{progressPct}%</span>
            </div>
            <div className="hub-pixel-progress">
              {progressBlocks.map((filled, i) => (
                <div
                  key={i}
                  className={`hub-pixel-block${filled ? ' hub-pixel-block--filled' : ''}`}
                  title={ACTIVITIES[i].name}
                />
              ))}
            </div>
          </section>

          {/* Game cards */}
          <section className="hub-activities">
            <span className="hub-section-label">ACTIVITIES</span>
            <div className="lhv2-grid">
              {ACTIVITIES.filter((act) => {
                const a = getActivityAvailability(act, { session: { year: list.year, words, age: userAge }, user });
                return a.reason !== 'unsupported';
              }).map((act) => {
                const status = progress[act.id]?.status || 'not-started';
                const done   = status === 'completed';
                const avail  = getActivityAvailability(act, { session: { year: list.year, words, age: userAge }, user });
                const locked = avail.locked;
                return (
                  <div
                    key={act.id}
                    className={`lhv2-card hub-card--${status}${locked ? ' hub-card--locked' : ''}`}
                    style={{
                      borderColor: act.dark,
                      boxShadow: done ? `4px 4px 0 ${act.dark}` : `6px 6px 0 ${act.dark}`,
                      opacity: locked ? 0.55 : 1,
                      cursor:  locked ? 'not-allowed' : 'pointer',
                    }}
                    onClick={() => { if (!locked) setActiveActivity(act.id); }}
                    role="button"
                    tabIndex={locked ? -1 : 0}
                    aria-disabled={locked}
                    title={locked ? avail.message : undefined}
                    onKeyDown={(e) => { if (!locked && e.key === 'Enter') setActiveActivity(act.id); }}
                  >
                    <div className="lhv2-card-header" style={{ background: act.color }}>
                      <span className="lhv2-card-icon">{act.icon}</span>
                      {locked && <span className="hub-card-lock" aria-hidden="true">🔒</span>}
                    </div>
                    <div className="lhv2-card-body">
                      <h3 className="lhv2-card-name">{act.name}</h3>
                      <span className={`hub-badge hub-badge--${status}`}>
                        {locked ? (avail.message || 'Locked') : STATUS_LABEL[status]}
                      </span>
                      <p className="lhv2-card-time">⏱ {act.timeEstimate}</p>
                      {progress[act.id]?.accuracy != null && (
                        <p className="lhv2-accuracy">{progress[act.id].accuracy}% accuracy</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>

      {/* ── Word detail modal ── */}
      {activeWord && (
        <WordDetailModal
          word={activeWord.word}
          userAge={userAge}
          chipColor={activeWord.chipColor}
          onClose={() => setActiveWord(null)}
        />
      )}
      </div>
    </div>
  );
}
