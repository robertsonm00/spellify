import React, { useState, useEffect, useMemo } from 'react';
import './WordListHub.css';
import Settings from './Settings';
import { GeneratedWords } from './OnboardingFlow';
import { scoreWord, scoreToBand } from '../utils/difficultyEngine';
import DEFINITIONS from '../data/definitions';
import { isSafeDefinition } from '../utils/definitionSafety';

// ── Speech ────────────────────────────────────────────────────────────────────

let cachedHubVoice = null;
function pickHubVoice() {
  if (cachedHubVoice) return cachedHubVoice;
  const voices = window.speechSynthesis?.getVoices?.() || [];
  cachedHubVoice = voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang?.startsWith('en')) || null;
  return cachedHubVoice;
}
function speakHubWord(word) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-GB'; u.rate = 0.85;
  const v = pickHubVoice(); if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

// ── Word info fetch (with module-level cache) ─────────────────────────────────

const wordInfoCache = {};

function pickDefinitionForAge(meanings, userAge) {
  const PART_ORDER = { noun: 0, verb: 1 };
  const ordered = [...meanings].sort((a, b) => (PART_ORDER[a.partOfSpeech] ?? 2) - (PART_ORDER[b.partOfSpeech] ?? 2));
  for (const meaning of ordered) {
    for (const def of (meaning.definitions || [])) {
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
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
    if (!res.ok) return { definition: null, phonetic: null, partOfSpeech: null, example: null };
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return { definition: null, phonetic: null, partOfSpeech: null, example: null };

    const phonetic = data[0].phonetic || data[0].phonetics?.find(p => p.text)?.text || null;
    const allMeanings = data.flatMap(e => e?.meanings || []);
    const definition  = pickDefinitionForAge(allMeanings, userAge);
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

// ── WordDetailModal ───────────────────────────────────────────────────────────

function WordDetailModal({ word, userAge, chipColor, onClose }) {
  const [info, setInfo] = useState({ loading: true, definition: null, phonetic: null, partOfSpeech: null, example: null });

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
          {!info.loading && info.phonetic && (
            <p className="hub-word-modal-phonetic">{info.phonetic}</p>
          )}
          {!info.loading && info.partOfSpeech && (
            <span className="hub-word-modal-pos">{info.partOfSpeech}</span>
          )}
        </div>

        <div className="hub-word-modal-actions">
          <button className="hub-word-modal-speak" onClick={() => speakHubWord(word)}>
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

const HEADER_STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left:  (i * 37 + 13) % 100,
  top:   (i * 53 + 7)  % 100,
  delay: ((i * 0.31) % 3).toFixed(2),
  size:  6 + (i % 4) * 3,
  dim:   i % 3 === 0,
}));

const BRAND_LETTERS = [
  { letter: 'S', color: '#ff6b6b' },
  { letter: 'P', color: '#ffd93d' },
  { letter: 'E', color: '#6bcb77' },
  { letter: 'L', color: '#4d96ff' },
  { letter: 'L', color: '#c77dff' },
  { letter: 'I', color: '#ff9f43' },
  { letter: 'F', color: '#ff6b6b' },
  { letter: 'Y', color: '#ffd93d' },
];

const ACTIVITIES = [
  { id: 'wordsearch',  name: 'Word Search',   icon: '🔍', timeEstimate: '5 mins',  color: '#4d96ff', dark: '#1a5cbf' },
  { id: 'memoryspell', name: 'Memory Spell',  icon: '🧠', timeEstimate: '5 mins',  color: '#6bcb77', dark: '#1e7e34' },
  { id: 'hangman',     name: 'Hangman',       icon: '🎯', timeEstimate: '5 mins',  color: '#ff9f43', dark: '#c05700' },
  { id: 'crossword',   name: 'Crossword',     icon: '✏️', timeEstimate: '10 mins', color: '#c77dff', dark: '#6b21a8' },
  { id: 'writeit',     name: 'Write It',      icon: '✏️', timeEstimate: '10 mins', color: '#a855f7', dark: '#581c87' },
  { id: 'quizquest',   name: 'Quiz Quest',    icon: '🏆', timeEstimate: '5 mins',  color: '#ec4899', dark: '#9d174d' },
];

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

// ── Mastery dot ───────────────────────────────────────────────────────────────
function MasteryDot({ rate }) {
  if (rate === null) return <span className="hub-mastery-dot hub-mastery-dot--new"    title="Not tried yet" />;
  if (rate >= 0.6)   return <span className="hub-mastery-dot hub-mastery-dot--mastered" title="Mastered!" />;
  return               <span className="hub-mastery-dot hub-mastery-dot--learning"  title="Keep practising" />;
}

function WordListHub({
  words,
  userAge = 8,
  year = null,
  dyslexiaMode = false,
  difficulty = 'medium',
  activityStatuses,
  mastery = {},
  reviewQueue = [],
  childName = '',
  childCharacter = null,
  onLaunch,
  onReview,
  onChangeWords,
  onSettingsUpdate,
  onClearProgress,
  onBackToWelcome,
}) {
  const [settingsOpen,    setSettingsOpen]    = useState(false);
  const [changeWordsOpen, setChangeWordsOpen] = useState(false);
  const [activeWord,      setActiveWord]      = useState(null); // { word, chipColor }

  const completedCount = ACTIVITIES.filter((a) => activityStatuses[a.id] === 'completed').length;
  const progressPct    = Math.round((completedCount / ACTIVITIES.length) * 100);

  // Pixel progress: 4 blocks, one per activity
  const progressBlocks = ACTIVITIES.map((a) => activityStatuses[a.id] === 'completed');

  return (
    <div className="hub-shell">
      {/* ── Header ── */}
      <header className="hub-header">
        <div className="hub-header-stars" aria-hidden="true">
          {HEADER_STARS.map((s) => (
            <span
              key={s.id}
              className={`hub-header-star${s.dim ? ' hub-header-star--dim' : ''}`}
              style={{ left: `${s.left}%`, top: `${s.top}%`, fontSize: `${s.size}px`, animationDelay: `${s.delay}s` }}
            >★</span>
          ))}
        </div>

        <button className="hub-exit-btn" onClick={onBackToWelcome}>
          ← Exit
        </button>

        <div className="hub-brand" aria-label="Spellify">
          {BRAND_LETTERS.map(({ letter, color }, i) => (
            <span
              key={i}
              className="hub-brand-letter"
              style={{ color, animationDelay: `${i * 0.08}s` }}
            >{letter}</span>
          ))}
        </div>

        <button className="hub-settings-trigger" onClick={() => setSettingsOpen(true)}>
          <span className="hub-settings-trigger-icon">⚙️</span> Settings
        </button>
      </header>

    <div className="hub">
      {/* ── Welcome section ── */}
      {childName && (
        <h1 className="hub-welcome-heading">
          Welcome {childName} &amp; {childCharacter?.emoji || '⭐'}!
        </h1>
      )}

      {/* ── Word list ── */}
      <section className="hub-words">
        <div className="hub-section-header">
          <span className="hub-section-label">YOUR WORDS ({words.length})</span>
          <button className="hub-change-btn" onClick={() => setChangeWordsOpen(true)}>Change Words</button>
        </div>
        <div className="hub-chips">
          {words.map((w, i) => {
            const { bg, border } = WORD_CHIP_COLORS[i % WORD_CHIP_COLORS.length];
            const band  = scoreToBand(scoreWord(w));
            const entry = mastery[w.toLowerCase()];
            const rate  = entry && entry.attempts > 0 ? entry.correct / entry.attempts : null;
            return (
              <button
                key={w}
                className="hub-chip"
                style={{ background: bg, borderColor: border }}
                onClick={() => setActiveWord({ word: w, chipColor: border })}
              >
                <MasteryDot rate={rate} />
                {w}
                <span className={`hub-diff-star hub-diff-star--${band}`} title={band}>★</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Review callout ── */}
      {reviewQueue.length > 0 && (
        <section className="hub-review-callout">
          <div className="hub-review-inner">
            <span className="hub-review-emoji">⭐</span>
            <div className="hub-review-text">
              <strong>{reviewQueue.length} word{reviewQueue.length > 1 ? 's' : ''} to practise</strong>
              <span>Keep going — you're almost there!</span>
            </div>
            <button className="hub-review-btn" onClick={onReview}>
              Practise →
            </button>
          </div>
        </section>
      )}

      {/* ── Pixel progress bar ── */}
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

      {/* ── Activity cards ── */}
      <section className="hub-activities">
        <span className="hub-section-label">ACTIVITIES</span>
        <div className="hub-grid">
          {ACTIVITIES.map((activity) => {
            const status = activityStatuses[activity.id] || 'not-started';
            const done   = status === 'completed';
            return (
              <div
                key={activity.id}
                className={`hub-card hub-card--${status}`}
                style={{
                  borderColor:  activity.dark,
                  boxShadow:    done
                    ? `3px 3px 0 ${activity.dark}`
                    : `5px 5px 0 ${activity.dark}`,
                }}
                onClick={() => onLaunch(activity.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onLaunch(activity.id)}
              >
                <div
                  className="hub-card-header"
                  style={{ background: activity.color }}
                >
                  <span className="hub-card-icon">{activity.icon}</span>
                </div>
                <div className="hub-card-body">
                  <h3 className="hub-card-name">{activity.name}</h3>
                  <span className={`hub-badge hub-badge--${status}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  <p className="hub-card-time">⏱ {activity.timeEstimate}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Word detail modal ── */}
      {activeWord && (
        <WordDetailModal
          word={activeWord.word}
          userAge={userAge}
          chipColor={activeWord.chipColor}
          onClose={() => setActiveWord(null)}
        />
      )}

      {/* ── Settings modal ── */}
      {settingsOpen && (
        <Settings
          userAge={userAge}
          year={year}
          dyslexiaMode={dyslexiaMode}
          childName={childName}
          childCharacter={childCharacter}
          onUpdate={onSettingsUpdate}
          onChangeWords={() => { setSettingsOpen(false); setChangeWordsOpen(true); }}
          onClearProgress={() => { onClearProgress(); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* ── Change Words modal ── */}
      {changeWordsOpen && year !== null && (
        <ChangeWordsModal
          yearGroup={year}
          dyslexiaMode={dyslexiaMode}
          onConfirm={(payload) => {
            onChangeWords(payload);
            setChangeWordsOpen(false);
          }}
          onClose={() => setChangeWordsOpen(false)}
        />
      )}
    </div>
    </div>
  );
}

function ChangeWordsModal({ yearGroup, dyslexiaMode, onConfirm, onClose }) {
  return (
    <div className="hub-change-overlay" onClick={onClose}>
      <div className="hub-change-modal" onClick={(e) => e.stopPropagation()}>
        <button className="hub-change-close" onClick={onClose} aria-label="Close">✕</button>
        <GeneratedWords
          yearGroup={yearGroup}
          initialDyslexiaMode={dyslexiaMode}
          showSupportToggle={false}
          confirmLabel="Use these words ▶"
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}

export default WordListHub;
