/**
 * ListHubV3 — Arcade Dashboard design.
 * Retro arcade neon aesthetics fused with modern dashboard structure.
 * Currently routed for y1-ck-words.
 */

import React, { useState, useEffect } from 'react';
import { ACTIVITIES } from '../../data/activities';
import { getActivityAvailability } from '../../utils/activityAvailability';
import { renderExploreActivity } from './exploreActivityRunner';
import { scoreWord, scoreToBand } from '../../utils/difficultyEngine';
import DEFINITIONS from '../../data/definitions';
import { isSafeDefinition } from '../../utils/definitionSafety';
import { speakWord } from '../../utils/speech';
import '../WordListHub.css';   // hub-word-modal styles
import './ListHubV3.css';

// ── Word info cache ───────────────────────────────────────────────────────────

const wordInfoCache = {};

function pickDefinitionForAge(meanings, userAge) {
  const PART_ORDER = { noun: 0, verb: 1 };
  const ordered = [...meanings].sort(
    (a, b) => (PART_ORDER[a.partOfSpeech] ?? 2) - (PART_ORDER[b.partOfSpeech] ?? 2),
  );
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
  const localDef = DEFINITIONS[key];
  if (localDef) {
    const result = { definition: localDef, phonetic: null, partOfSpeech: null, example: null };
    wordInfoCache[key] = result;
    return result;
  }
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`,
    );
    if (!res.ok) return { definition: null, phonetic: null, partOfSpeech: null, example: null };
    const data = await res.json();
    if (!Array.isArray(data) || !data[0])
      return { definition: null, phonetic: null, partOfSpeech: null, example: null };
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

function preSeedCache(wordObjects) {
  for (const { word, definition } of wordObjects) {
    const key = word.toLowerCase();
    if (!wordInfoCache[key] && definition) {
      wordInfoCache[key] = { definition, phonetic: null, partOfSpeech: null, example: null };
    }
  }
}

// ── Word detail modal (reuses hub-word-* classes from WordListHub.css) ────────

function WordDetailModal({ word, userAge, chipColor, onClose }) {
  const [info, setInfo] = useState({
    loading: true, definition: null, phonetic: null, partOfSpeech: null, example: null,
  });

  useEffect(() => {
    let cancelled = false;
    setInfo({ loading: true, definition: null, phonetic: null, partOfSpeech: null, example: null });
    fetchWordInfo(word, userAge).then(result => {
      if (!cancelled) setInfo({ loading: false, ...result });
    });
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
          {!info.loading && info.phonetic     && <p className="hub-word-modal-phonetic">{info.phonetic}</p>}
          {!info.loading && info.partOfSpeech && <span className="hub-word-modal-pos">{info.partOfSpeech}</span>}
        </div>
        <div className="hub-word-modal-actions">
          <button className="hub-word-modal-speak" onClick={() => speakWord(word)}>🔊 Hear it</button>
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

// ── LED mastery dot ───────────────────────────────────────────────────────────

function LedDot({ rate }) {
  if (rate === null) return <span className="lhv3-led lhv3-led--new"      title="Not tried yet" />;
  if (rate >= 0.6)   return <span className="lhv3-led lhv3-led--mastered" title="Mastered!" />;
  return               <span className="lhv3-led lhv3-led--learning"    title="Keep practising" />;
}

// ── Constants ─────────────────────────────────────────────────────────────────
// ACTIVITIES is imported from the canonical registry in src/data/activities.js.
// V3's arcade theme overrides the registry's `color` with a brighter neon for
// each known game; new games fall back to the registry color + a derived glow.

const NEON_OVERRIDES = {
  wordsearch:  { neon: '#00e5ff', glow: 'rgba(0,229,255,0.35)'   },
  memoryspell: { neon: '#39ff14', glow: 'rgba(57,255,20,0.35)'   },
  hangman:     { neon: '#ff9f43', glow: 'rgba(255,159,67,0.35)'  },
  crossword:   { neon: '#c77dff', glow: 'rgba(199,125,255,0.35)' },
  writeit:     { neon: '#ff6bff', glow: 'rgba(255,107,255,0.35)' },
  quizquest:   { neon: '#ffd93d', glow: 'rgba(255,217,61,0.35)'  },
};

/** Hex `#rrggbb` → `rgba(r,g,b,alpha)` glow string. */
function deriveGlow(hex, alpha = 0.35) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 'rgba(255,255,255,0.35)';
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function neonFor(act) {
  return NEON_OVERRIDES[act.id] || { neon: act.color, glow: deriveGlow(act.color) };
}

const STATUS_LABEL = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed':   'Done ✓',
};

const PILL_NEONS = [
  '#00e5ff', '#ff6bff', '#39ff14', '#ffd93d',
  '#ff9f43', '#c77dff', '#ff6b6b', '#00ffcc',
];

const CATEGORY_NEONS = {
  'Statutory':   '#94a3b8',
  'Phonics':     '#c77dff',
  'Patterns':    '#39ff14',
  'Etymology':   '#ffd93d',
  'Vowels':      '#ff9f43',
  'Sight words': '#6bcb77',
  'Custom':      '#94a3b8',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ListHubV3({
  list,
  listType = 'curriculum',
  onBack,
  getListProgress,
  markComplete,
  user = null,
}) {
  const [activeActivity, setActiveActivity] = useState(null);
  const [progress,       setProgress]       = useState({});
  const [activeWord,     setActiveWord]      = useState(null);
  const [theme,          setTheme]          = useState('dark');

  const userAge     = list.ageRange?.[0] || 8;
  const wordObjects = (list.words || []).map(w =>
    typeof w === 'string' ? { word: w, definition: '' } : w,
  );
  const words = wordObjects.map(w => w.word);

  preSeedCache(wordObjects);

  // ── Load progress ───────────────────────────────────────────────────────────
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

  // ── Game complete ───────────────────────────────────────────────────────────
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

  // ── Active game render — delegated to the canonical registry ────────────────
  if (activeActivity) {
    const rendered = renderExploreActivity(activeActivity, {
      list,
      words,
      onComplete: handleComplete,
      onExit: () => setActiveActivity(null),
    });
    if (rendered) return rendered;
  }

  // ── Hub view ────────────────────────────────────────────────────────────────
  const catNeon = CATEGORY_NEONS[list.category] || '#94a3b8';

  return (
    <div className={`lhv3-wrap${theme === 'light' ? ' lhv3-wrap--light' : ''}`}>

      {/* ── Sub-header ── */}
      <div className="lhv3-subheader">
        <button className="lhv3-back" onClick={onBack}>← BACK</button>
        <div className="lhv3-header-center">
          <h1 className="lhv3-title">{list.name}</h1>
          <div className="lhv3-meta">
            <span
              className="lhv3-badge"
              style={{ color: catNeon, borderColor: catNeon, textShadow: theme === 'dark' ? `0 0 8px ${catNeon}` : 'none' }}
            >
              {list.category || 'Custom'}
            </span>
            <span className="lhv3-word-count">{words.length} WORDS</span>
            {list.year && (
              <span className="lhv3-year">
                YEAR {list.year === 3 ? '3–4' : list.year === 5 ? '5–6' : list.year}
              </span>
            )}
          </div>
        </div>
        <button
          className="lhv3-theme-toggle"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* ── Page content ── */}
      <div className="lhv3-page">
        <div className="lhv3-body">

          {/* ── Left: word panel ── */}
          <aside className="lhv3-words-panel">
            <div className="lhv3-panel-header">
              <span className="lhv3-panel-title">WORDS</span>
              <span className="lhv3-panel-count">{words.length}</span>
            </div>
            <div className="lhv3-words-list">
              {wordObjects.map((item, i) => {
                const neon = PILL_NEONS[i % PILL_NEONS.length];
                const band = scoreToBand(scoreWord(item.word));
                return (
                  <button
                    key={item.word}
                    className="lhv3-word-pill"
                    style={{ '--neon': neon }}
                    onClick={() => setActiveWord({ word: item.word, chipColor: neon })}
                  >
                    <LedDot rate={null} />
                    <span className="lhv3-pill-word">{item.word}</span>
                    <span className={`lhv3-star lhv3-star--${band}`} title={band}>★</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ── Right: score + games ── */}
          <main className="lhv3-games-col">

            {/* Score / progress panel */}
            <div className="lhv3-score-panel">
              <div className="lhv3-score-inner">
                <span className="lhv3-score-label">PROGRESS</span>
                <span className="lhv3-score-value">
                  {completedCount}
                  <span className="lhv3-score-denom"> / {ACTIVITIES.length}</span>
                </span>
              </div>
              <div className="lhv3-pixel-bar">
                {progressBlocks.map((filled, i) => {
                  const theme = neonFor(ACTIVITIES[i]);
                  return (
                    <div
                      key={i}
                      className={`lhv3-pixel-block${filled ? ' lhv3-pixel-block--on' : ''}`}
                      style={filled ? { '--act-neon': theme.neon, '--act-glow': theme.glow } : {}}
                      title={ACTIVITIES[i].name}
                    />
                  );
                })}
              </div>
              <span className="lhv3-score-pct">{progressPct}%</span>
            </div>

            {/* Activities */}
            <p className="lhv3-section-label">ACTIVITIES</p>
            <div className="lhv3-grid">
              {ACTIVITIES.map((act) => {
                const status = progress[act.id]?.status || 'not-started';
                const done   = status === 'completed';
                const { neon, glow } = neonFor(act);
                const avail  = getActivityAvailability(act, { session: { year: list.year, words, age: userAge }, user });
                const locked = avail.locked;
                return (
                  <div
                    key={act.id}
                    className={`lhv3-card${done ? ' lhv3-card--done' : ''}${locked ? ' lhv3-card--locked' : ''}`}
                    style={{
                      '--neon': neon,
                      '--glow': glow,
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
                    <div
                      className="lhv3-card-face"
                      style={{
                        background: theme === 'light'
                          ? `radial-gradient(ellipse at 50% 110%, ${glow.replace('0.35)', '0.12)')} 0%, transparent 65%), #fafafe`
                          : `radial-gradient(ellipse at 50% 110%, ${glow} 0%, transparent 65%), #0d0d20`,
                      }}
                    >
                      <span className="lhv3-card-icon">{locked ? '🔒' : act.icon}</span>
                      {done && <span className="lhv3-checkmark">✓</span>}
                    </div>
                    <div className="lhv3-card-body">
                      <h3 className="lhv3-card-name">{act.name}</h3>
                      <span className={`lhv3-status lhv3-status--${status}`}>
                        {locked ? (avail.message || 'Locked') : STATUS_LABEL[status]}
                      </span>
                      <p className="lhv3-time">⏱ {act.timeEstimate}</p>
                      {progress[act.id]?.accuracy != null && (
                        <p className="lhv3-accuracy">{progress[act.id].accuracy}% accuracy</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
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
  );
}
