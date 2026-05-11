import React, { useState, useEffect, useRef } from 'react';
import './WordListHub.css';
import { scoreWord, scoreToBand } from '../utils/difficultyEngine';
import DEFINITIONS from '../data/definitions';
import { isSafeDefinition } from '../utils/definitionSafety';
import { speakWordWithInfo } from '../utils/speech';
import { ACTIVITIES, PHASES } from '../data/activities';
import { getActivityAvailability } from '../utils/activityAvailability';
import ActivityIcon from './ActivityIcon';
import BuddyAvatar from './BuddyAvatar';

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

// ── LockedActivityModal ──────────────────────────────────────────────────────
// Reuses the WordDetail modal shell so the popup style stays consistent.

function LockedActivityModal({ name, message, color, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="hub-word-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="hub-word-modal" style={{ '--modal-color': color }} onClick={(e) => e.stopPropagation()}>
        <div className="hub-word-modal-header" style={{ background: color }}>
          <span className="hub-word-modal-icon">🔒</span>
          <h2 className="hub-word-modal-name">{name}</h2>
          <button className="hub-word-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="hub-word-modal-body">
          <p className="hub-word-modal-badge">Locked</p>
          <p className="hub-word-modal-def">{message}</p>
        </div>
      </div>
    </div>
  );
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
      <div className="hub-word-modal" style={{ '--modal-color': chipColor }} onClick={e => e.stopPropagation()}>
        <div className="hub-word-modal-header" style={{ background: chipColor }}>
          <span className="hub-word-modal-icon">📖</span>
          <h2 className="hub-word-modal-name">{word}</h2>
          <button className="hub-word-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {!info.loading && (info.phonetic || info.partOfSpeech) && (
          <div className="hub-word-modal-meta">
            {info.phonetic && <span className="hub-word-modal-phonetic">{info.phonetic}</span>}
            {info.partOfSpeech && <span className="hub-word-modal-pos">{info.partOfSpeech}</span>}
          </div>
        )}

        <div className="hub-word-modal-actions">
          <button
            className="hub-word-modal-speak"
            onClick={() => {
              // Speak the word, then read the definition + example aloud
              // so the child gets the full help context.
              const lines = [];
              if (info.definition) lines.push(info.definition);
              if (info.example)    lines.push(`For example, ${info.example}`);
              speakWordWithInfo(word, lines);
            }}
          >
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

// ACTIVITIES + PHASES are imported from src/data/activities.js — that
// file is the single source of truth for which games exist. Adding a
// new game there makes it appear here automatically.

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

// ── Player profile card ──────────────────────────────────────────────────────

// 10-rung level ladder. The fourth rung deliberately uses the example name
// the brief called out ("Wizard's Apprentice"). Level + points are derived
// from the existing mastery / activity data — placeholder formula that will
// be replaced once a real points system lands.
const LEVEL_NAMES = [
  'Spelling Initiate',
  'Letter Scout',
  'Word Cadet',
  "Wizard's Apprentice",
  'Rune Reader',
  'Spell Weaver',
  'Word Sorcerer',
  'Phonics Mage',
  'Master Speller',
  'Grand Wordmancer',
];
const POINTS_PER_LEVEL = 250;

function computeProfileStats(activityStatuses = {}, mastery = {}) {
  const completed = Object.values(activityStatuses).filter((s) => s === 'completed').length;
  const correct   = Object.values(mastery).reduce((s, m) => s + (m?.correct || 0), 0);
  const points    = completed * 100 + correct * 10;
  const levelIdx  = Math.min(Math.floor(points / POINTS_PER_LEVEL), LEVEL_NAMES.length - 1);
  const intoLevel = points - levelIdx * POINTS_PER_LEVEL;
  const levelPct  = Math.min(100, Math.round((intoLevel / POINTS_PER_LEVEL) * 100));
  return { points, levelIdx, levelName: LEVEL_NAMES[levelIdx], levelPct };
}

export function HubPlayerCard({ childName, childCharacter, year, activityStatuses, mastery, welcomeBonus = 0, isFirstVisit = false, onWelcomeSeen, user = null, onCreateAccount = null }) {
  const { points: rawPoints, levelIdx, levelName, levelPct } = computeProfileStats(activityStatuses, mastery);
  const points = rawPoints + welcomeBonus;

  const [collapsed,     setCollapsed]     = useState(false);
  const [displayPoints, setDisplayPoints] = useState(isFirstVisit ? 0 : points);
  const rafRef = useRef(null);

  // Animate 0 → points on first visit; otherwise sync immediately.
  useEffect(() => {
    if (!isFirstVisit) {
      setDisplayPoints(points);
      return;
    }
    const duration = 1600;
    const startTime = performance.now();
    const target = points;
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3; // cubic ease-out
      setDisplayPoints(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onWelcomeSeen?.();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isFirstVisit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep display in sync with actual points after animation.
  useEffect(() => {
    if (!isFirstVisit) setDisplayPoints(points);
  }, [points, isFirstVisit]); // eslint-disable-line react-hooks/exhaustive-deps

  const isGuest = !user;

  return (
    <section className={`hub-player-card${collapsed ? ' hub-player-card--collapsed' : ''}`}>
      <div className="hub-player-header">
        <span>PLAYER</span>
        <button
          className="hub-player-toggle"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Show player card' : 'Hide player card'}
        >
          {/* Chevron SVG — rotates to point right when collapsed */}
          <svg className="hub-player-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0.715064 6L4.99494e-07 6.67273L12.0886 18L24 6.6702L23.2796 6.00253L12.0839 16.6515L0.715064 6Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div className="hub-player-body">
        <div className="hub-player-buddy">
          {/* Click the buddy → cheer pose + confetti + sound for ~3s */}
          <BuddyAvatar
            id={childCharacter?.id}
            size={88}
            interactive
            fallback={childCharacter?.emoji || '⭐'}
          />
        </div>
        {/* Guest pill — only shown when not signed in */}
        {isGuest && (
          <div className="hub-guest-pill">
            GUEST
            <span className="hub-guest-pill-tip">Progress lost when you leave — create an account to keep it.</span>
          </div>
        )}
        <div className="hub-player-info">
          <div className="hub-player-name">
            {/* Swap hyphens for non-breaking hyphens so names like
                "Ernest-Wren" never split across two lines. */}
            {(childName || 'PLAYER').toUpperCase().replace(/-/g, '‑')}
          </div>
          <div className="hub-player-year">Year {year ?? '—'}</div>
        </div>
        <div className="hub-player-points">
          <div className="hub-player-points-num">{displayPoints.toLocaleString()}</div>
          <div className="hub-player-points-label">POINTS</div>
        </div>
        <div className="hub-player-level">
          <div className="hub-player-level-name">⚡ {levelName} ⚡</div>
          <div className="hub-player-level-bar" aria-label={`Level progress ${levelPct}%`}>
            <div className="hub-player-level-fill" style={{ width: `${levelPct}%` }} />
          </div>
          <div className="hub-player-level-num">Level {levelIdx + 1}</div>
        </div>
      </div>
      {/* Guest footer — only shown when not signed in */}
      {isGuest && (
        <div className="hub-player-footer">
          <p className="hub-player-footer-text">Save your progress and word lists.</p>
          <button className="hub-player-footer-btn" onClick={onCreateAccount}>
            Create account →
          </button>
        </div>
      )}
    </section>
  );
}

// ── Mastery dot ───────────────────────────────────────────────────────────────
export function MasteryDot({ rate }) {
  if (rate === null) return <span className="hub-mastery-dot hub-mastery-dot--new"    title="Not tried yet" />;
  if (rate >= 0.6)   return <span className="hub-mastery-dot hub-mastery-dot--mastered" title="Mastered!" />;
  return               <span className="hub-mastery-dot hub-mastery-dot--learning"  title="Keep practising" />;
}

function WordListHub({
  words,
  userAge = 8,
  year = null,
  ruleLabel = null,
  dyslexiaMode = false,
  difficulty = 'medium',
  activityStatuses,
  mastery = {},
  reviewQueue = [],
  childName = '',
  childCharacter = null,
  welcomeBonus = 0,
  isFirstVisit = false,
  onWelcomeSeen,
  session = null,   // full session — passed to availability checks
  user = null,      // current user — passed to availability checks
  onLaunch,
  onReview,
  onChangeWords,
  onSettingsUpdate,
  onClearProgress,
  onBackToWelcome,
  onOpenChangeWords,
  onOpenWordLists,
}) {
  const [activeWord,      setActiveWord]      = useState(null); // { word, chipColor }
  const [lockedInfo,      setLockedInfo]      = useState(null); // { name, message, color }

  // Only count activities that are applicable to this list (exclude 'unsupported').
  const availableActivities = ACTIVITIES.filter(
    a => getActivityAvailability(a, { session, user }).reason !== 'unsupported'
  );
  const completedCount = availableActivities.filter((a) => activityStatuses[a.id] === 'completed').length;
  const progressPct    = Math.round((completedCount / availableActivities.length) * 100);

  const [progressRevealed, setProgressRevealed] = useState(completedCount > 0);

  useEffect(() => {
    if (completedCount > 0 && !progressRevealed) {
      setProgressRevealed(true);
    }
  }, [completedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="hub-shell hub-shell--split">
    <div className="hub hub--split">
      {/* In split mode the left/right wrappers become independent flex columns
          so progress isn't tied to the player card's row height. In classic
          mode they use `display: contents` (see CSS) so the children flatten
          back into the natural single-column flow. */}
      <div className="hub-split-left">
      {/* ── Player profile card (replaces the old welcome + practising header) ── */}
      <HubPlayerCard
        childName={childName}
        childCharacter={childCharacter}
        year={year}
        activityStatuses={activityStatuses}
        mastery={mastery}
        welcomeBonus={welcomeBonus}
        isFirstVisit={isFirstVisit}
        onWelcomeSeen={onWelcomeSeen}
        user={user}
      />

      {/* Word list + Word lists CTA travel together as a sticky group:
          once the word list hits the top, everything below it stops
          scrolling alongside it. */}
      <div className="hub-sticky-block">
      {/* ── Word list ── */}
      <section className="hub-words">
        <div className="hub-section-header">
          <div className="hub-section-title-block">
            <span className="hub-section-label">WORD LIST</span>
            <span className="hub-list-title">{ruleLabel || 'Untitled list'}</span>
          </div>
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

      {/* ── Word lists CTA — entry point to the wider list browser ── */}
      <section className="hub-word-lists">
        <div className="hub-word-lists-header">BROWSE</div>
        <button
          className="hub-word-lists-btn"
          onClick={() => onOpenWordLists?.()}
        >
          📋 Word lists →
        </button>
      </section>
      </div>{/* /hub-sticky-block */}
      </div>{/* /hub-split-left */}

      <div className="hub-split-right">
      {/* ── Pixel progress bar ── */}
      <section className={`hub-progress${!progressRevealed ? ' hub-progress--hidden' : ''}`}>
        <div className="hub-progress-labels">
          <span>{completedCount} of {availableActivities.length} activities done</span>
          <span className="hub-progress-pct">{progressPct}%</span>
        </div>
        <div className="hub-pixel-progress">
          {availableActivities.map((activity) => {
            const filled = activityStatuses[activity.id] === 'completed';
            const avail  = getActivityAvailability(activity, { session, user });
            const locked = avail.locked;
            return (
              <button
                key={activity.id}
                type="button"
                className={`hub-pixel-block${filled ? ' hub-pixel-block--filled' : ''}${locked ? ' hub-pixel-block--locked' : ''}`}
                aria-label={locked ? `${activity.name} — locked. Tap for details.` : `Open ${activity.name}`}
                onClick={() => {
                  if (locked) {
                    setLockedInfo({
                      name:    activity.name,
                      message: avail.message || 'This activity is currently unavailable.',
                      color:   activity.color,
                    });
                  } else {
                    onLaunch(activity.id);
                  }
                }}
              >
                <span className="hub-pixel-tip">
                  {activity.name}{locked ? ' — Locked' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Activity cards (grouped by phase: Warm-Up → Explore → Consolidate) ── */}
      <section className="hub-activities">
        <span className="hub-section-label">ACTIVITIES</span>
        {PHASES.map((phase, phaseIdx) => {
          // Hide activities marked unsupported for this session (e.g. WordForge
          // when no word in the list has prefix/suffix structure).
          const phaseActivities = ACTIVITIES.filter((a) => {
            if (a.phase !== phase.key) return false;
            const avail = getActivityAvailability(a, { session, user });
            return avail.reason !== 'unsupported';
          });
          if (phaseActivities.length === 0) return null;
          return (
            <div key={phase.key} className="hub-phase">
              <div className="hub-phase-header">
                <span className="hub-phase-num">{phaseIdx + 1}</span>
                <div className="hub-phase-text">
                  <strong className="hub-phase-label">{phase.label}</strong>
                  <span className="hub-phase-hint">{phase.hint}</span>
                </div>
              </div>
              <div className="hub-grid">
                {phaseActivities.map((activity) => {
                  const status = activityStatuses[activity.id] || 'not-started';
                  const done   = status === 'completed';
                  const avail  = getActivityAvailability(activity, { session, user });
                  const locked = avail.locked;
                  return (
                    <div
                      key={activity.id}
                      className={`hub-card hub-card--${status}${locked ? ' hub-card--locked' : ''}`}
                      style={{
                        borderColor:  activity.dark,
                        boxShadow:    done
                          ? `3px 3px 0 ${activity.color}`
                          : `5px 5px 0 ${activity.color}`,
                        '--card-color': activity.color,
                        opacity: locked ? 0.55 : 1,
                        cursor:  locked ? 'not-allowed' : 'pointer',
                      }}
                      onClick={() => { if (!locked) onLaunch(activity.id); }}
                      role="button"
                      tabIndex={locked ? -1 : 0}
                      aria-disabled={locked}
                      title={locked ? avail.message : undefined}
                      onKeyDown={(e) => { if (!locked && e.key === 'Enter') onLaunch(activity.id); }}
                    >
                      <div
                        className="hub-card-header"
                        style={{ background: activity.color }}
                      >
                        <span className="hub-card-icon hub-card-icon--emoji">{activity.icon}</span>
                        <span className="hub-card-icon hub-card-icon--svg" aria-hidden="true">
                          <ActivityIcon id={activity.id} size={28} />
                        </span>
                        {locked && <span className="hub-card-lock" aria-hidden="true">🔒</span>}
                      </div>
                      <div className="hub-card-body">
                        <h3 className="hub-card-name">{activity.name}</h3>
                        <span className={`hub-badge hub-badge--${status}`}>
                          {locked ? (avail.message || 'Locked') : STATUS_LABEL[status]}
                        </span>
                        <p className="hub-card-time">⏱ {activity.timeEstimate}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Review callout — last item in the right column ── */}
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
      </div>{/* /hub-split-right */}

      {/* ── Word detail modal ── */}
      {activeWord && (
        <WordDetailModal
          word={activeWord.word}
          userAge={userAge}
          chipColor={activeWord.chipColor}
          onClose={() => setActiveWord(null)}
        />
      )}

      {/* ── Locked-activity info modal ── */}
      {lockedInfo && (
        <LockedActivityModal
          name={lockedInfo.name}
          message={lockedInfo.message}
          color={lockedInfo.color}
          onClose={() => setLockedInfo(null)}
        />
      )}

    </div>
    </div>
  );
}

export default WordListHub;
