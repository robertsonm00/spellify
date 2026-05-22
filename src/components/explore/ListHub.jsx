import React, { useState, useEffect, useMemo } from 'react';
import { ACTIVITIES, PHASES } from '../../data/activities';
import { getActivityAvailability } from '../../utils/activityAvailability';
import { renderExploreActivity } from './exploreActivityRunner';
import {
  getActiveWindow,
  getListProgressState,
} from '../../utils/wordSelectionEngine';
import {
  getMasteryState,
  getUnmasteredWords,
} from '../../utils/masteryEngine';
import { recordGameCompleted } from '../../utils/gamificationEngine';
import ActivityIcon from '../ActivityIcon';
import CompletionTicks from '../CompletionTicks';
import { HubPlayerCard, WordDetailModal, preSeedWordInfoCache } from '../WordListHub';
import '../WordListHub.css';
import './ListHub.css';

const MASTERY_LABELS = { new: 'Not tried yet', learning: 'Keep practising', mastered: 'Mastered!' };

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

function TestAllModal({ unmasteredWords, onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="hub-testall-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Choose a Test All game">
      <div className="hub-testall-modal" onClick={(e) => e.stopPropagation()}>
        <button className="hub-testall-modal-close" onClick={onClose} aria-label="Close">✕</button>
        <p className="hub-testall-modal-title">Pick a game</p>
        <p className="hub-testall-modal-sub">
          {unmasteredWords.length} word{unmasteredWords.length !== 1 ? 's' : ''} to test
        </p>
        <div className="hub-testall-modal-options">
          <button className="hub-testall-pick hub-testall-pick--quiz" onClick={() => onPick('quizquest')}>
            🏆 Quiz Quest
          </button>
          <button className="hub-testall-pick hub-testall-pick--memory" onClick={() => onPick('memoryspell')}>
            🧠 Memory Spell
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ListHub({
  list,
  listType = 'curriculum',
  session = null,
  onBack,
  getListProgress,
  markComplete,
  user,
  onCreateAccount = null,
  /* Optional injection slots so wrappers (e.g. ExploreDashboard) can drop
     custom UI inside the WORD LIST panel without forking ListHub. */
  listNamePanel = null,
  listFooter   = null,
}) {
  const [activeActivity, setActiveActivity] = useState(null);
  const [progress,       setProgress]       = useState({});
  // Test-All flow: 'idle' → user clicks → 'choose' → picks game → 'running' →
  // completes → back to 'idle'. While 'running', activity words are the
  // full unmastered list and isTestAll: true flows into recordGameCompleted.
  const [testAllStage, setTestAllStage] = useState('idle');
  const [activeWord, setActiveWord] = useState(null);

  // Track which activities the child has started but not finished, so we can
  // flip the card CTA from "Play ▶" to "Continue ▶". Persisted per-list.
  const startedKey = `spellify_started_${list.id}`;
  const [startedActivities, setStartedActivities] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(startedKey) || '[]')); }
    catch { return new Set(); }
  });
  useEffect(() => {
    localStorage.setItem(startedKey, JSON.stringify([...startedActivities]));
  }, [startedActivities, startedKey]);

  // Snapshot the word selection used at the moment a game was started, so
  // mastery changes (from OTHER games) don't shuffle the list mid-session.
  const lockedKey = `spellify_locked_words_${list.id}`;
  const [lockedWords, setLockedWords] = useState(() => {
    try { return JSON.parse(localStorage.getItem(lockedKey) || '{}'); }
    catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem(lockedKey, JSON.stringify(lockedWords));
  }, [lockedWords, lockedKey]);

  // Pre-seed the word-info cache with the inline definitions from this list so
  // the word detail modal never falls through to the external dictionary API
  // for words the curriculum list already defines.
  useEffect(() => { preSeedWordInfoCache(list.words || []); }, [list.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const fullWords = useMemo(
    () => (list.words || []).map(w => (typeof w === 'string' ? w : w.word)),
    [list.words]
  );

  // Bump this when a game finishes so we re-read mastery from localStorage
  // and rotate freshly-mastered words out of the active window.
  const [masteryTick, setMasteryTick] = useState(0);

  // Read mastery state and derive the active window of up-to-10 unmastered
  // words. For lists ≤ 10 words this reduces to "all words minus mastered".
  const masteryState = useMemo(
    () => getMasteryState(list.id),
    [list.id, masteryTick],
  );
  const activeWindow = useMemo(
    () => getActiveWindow(list.id, fullWords, masteryState, masteryState.windowSize || 15),
    [list.id, fullWords, masteryState],
  );
  const listProgress = useMemo(
    () => getListProgressState(fullWords, masteryState),
    [fullWords, masteryState],
  );
  const unmasteredWords = useMemo(
    () => getUnmasteredWords(list.id, fullWords),
    [list.id, fullWords, masteryTick],   // eslint-disable-line react-hooks/exhaustive-deps
  );
  const masteryPct = listProgress.totalCount > 0
    ? Math.round((listProgress.masteredCount / listProgress.totalCount) * 100)
    : 0;

  // Active window words drive normal game launches; chips render the full
  // list so the child sees everything (mastered chips can be styled later).
  const words = activeWindow.length > 0 ? activeWindow : fullWords;

  // Derived up-front so availableActivities can use it for filtering.
  const exploreSession = { year: list.year, words, age: list.ageRange?.[0] };

  useEffect(() => {
    (async () => {
      if (getListProgress) {
        const p = await getListProgress(list.id, listType);
        setProgress(p || {});
      }
    })();
  }, [list.id, listType, getListProgress]);

  const handleComplete = async (activityId, results = []) => {
    const accuracy = results.length > 0
      ? Math.round((results.filter(r => r.correct).length / results.length) * 100)
      : null;

    // ── Mastery + points + badges via the new gamification engine ─────
    // Game components don't know about the list — the hub layer is the
    // only place that can wire this up. Safe even when results is empty
    // (Word Search etc. that don't track per-word).
    try {
      recordGameCompleted(
        list.id,
        activityId,
        accuracy ?? 0,
        results,
        fullWords,
        { isTestAll: testAllStage === 'running' },
      );
    } catch (err) {
      // Engine is best-effort: a failure here must never block onComplete.
      console.error('[ListHub] gamification engine failed', err);
    }
    setMasteryTick(t => t + 1);
    setTestAllStage('idle');
    setStartedActivities(prev => { const n = new Set(prev); n.delete(activityId); return n; });
    setLockedWords(prev => { const n = { ...prev }; delete n[activityId]; return n; });

    // ── Existing progress tracking (per-list activity status) ─────────
    if (markComplete) {
      await markComplete(list.id, activityId, { accuracy, listType });
      setProgress(prev => ({
        ...prev,
        [activityId]: {
          status: 'completed',
          accuracy,
          completedAt: new Date().toISOString(),
          completions: (prev?.[activityId]?.completions || 0) + 1,
        },
      }));
    }
    setActiveActivity(null);
  };

  // ── Active game — rendered fullscreen, covering sidebar + nav ───────────
  if (activeActivity) {
    const activityWords = testAllStage === 'running' && unmasteredWords.length > 0
      ? unmasteredWords
      : (lockedWords[activeActivity] ?? words);
    const sessionForActivity = {
      ...(session || {}),
      words: activityWords,
      isTestAll: testAllStage === 'running',
    };
    // Mid-game snapshot — persisted per list+activity so exit+resume
    // restores the in-progress board (found words, filled cells, etc.).
    const snapKey = `spellify_activity_snap_${list.id}_${activeActivity}`;
    const savedActivityProgress = (() => {
      try { return JSON.parse(localStorage.getItem(snapKey) || 'null'); }
      catch { return null; }
    })();
    const onSaveActivityProgress = (snap) => {
      if (snap == null) localStorage.removeItem(snapKey);
      else { try { localStorage.setItem(snapKey, JSON.stringify(snap)); } catch {} }
    };

    const rendered = renderExploreActivity(activeActivity, {
      list, words: activityWords, user,
      session: sessionForActivity,
      savedProgress: savedActivityProgress,
      onSaveProgress: onSaveActivityProgress,
      onComplete: handleComplete,
      onExit: () => { setActiveActivity(null); setTestAllStage('idle'); },
    });
    if (rendered) return <div className="lh-game-fullscreen">{rendered}</div>;
  }

  const launchTestAll = (gameId) => {
    setTestAllStage('running');
    setActiveActivity(gameId);
  };

  // ── List hub view ────────────────────────────────────────────────────────
  return (
    <div className="hub-shell hub-shell--split">
    <div className="hub hub--split">

      {/* ── Left column ── */}
      <div className="hub-split-left">

        {/* Player card — uses the active My Words session if available */}
        <HubPlayerCard
          childName={session?.childName || ''}
          childCharacter={session?.childCharacter || null}
          year={session?.year ?? null}
          activityStatuses={session?.activityStatuses || {}}
          mastery={session?.mastery || {}}
          welcomeBonus={session?.welcomeBonus || 0}
          user={user}
          onCreateAccount={onCreateAccount}
        />

        <div className="hub-sticky-block">
          {/* Word list — the only thing in the left column on the list page;
              Test All and the back CTA have moved to the right column under
              the games (see below). */}
          <section className="hub-words">
            <div className="hub-section-header">
              <div className="hub-section-title-block">
                <span className="hub-section-label">WORD LIST</span>
                <span className="hub-list-title">{list.name}</span>
              </div>
              <span className="hub-section-count" aria-label={`${fullWords.length} words`}>
                {fullWords.length}
              </span>
            </div>
            {listNamePanel}
            <div className="hub-chips">
              {fullWords.map((w, i) => {
                const { bg, border } = WORD_CHIP_COLORS[i % WORD_CHIP_COLORS.length];
                const entry = masteryState.words?.[w.toLowerCase()];
                const mastered = !!entry?.mastered;
                const level = mastered ? 'mastered' : (entry?.attempts > 0 ? 'learning' : 'new');
                return (
                  <button
                    key={i}
                    className={`hub-chip${mastered ? ' hub-chip--mastered' : ''}`}
                    style={{ background: bg, borderColor: border }}
                    onClick={() => setActiveWord({ word: w, chipColor: border })}
                  >
                    <span className="hub-chip-word">{w}</span>
                    <span
                      className={`hub-chip-mastery hub-chip-mastery--${level}`}
                      aria-label={level}
                      title={MASTERY_LABELS[level]}
                    >★</span>
                  </button>
                );
              })}
            </div>
            {listFooter}
          </section>
        </div>
      </div>

      {/* ── Right column ── */}
      <div className="hub-split-right">

        {/* Mastery progress — words mastered only. When every word in the
            list is mastered the bar renders at 100% with a green-tint and
            a celebratory line appears above it. Crucially nothing locks:
            the child can keep playing every game to stay sharp. */}
        <section className={`hub-mastery-pipeline${listProgress.status === 'completed' ? ' hub-mastery-pipeline--complete' : ''}`}>
          {listProgress.status === 'completed' && (
            <p className="hub-mastery-complete-msg">
              🎉 You've mastered every word — well done! Keep practising to stay sharp.
            </p>
          )}
          <div className="hub-mastery-row">
            <span className="hub-mastery-text">
              <strong>{listProgress.masteredCount}</strong>
              <span className="hub-mastery-dim"> of {listProgress.totalCount} words mastered</span>
            </span>
            <span className="hub-mastery-pct">{masteryPct}%</span>
          </div>
          <div
            className="hub-mastery-bar"
            role="progressbar"
            aria-valuenow={listProgress.masteredCount}
            aria-valuemin={0}
            aria-valuemax={listProgress.totalCount}
          >
            <div
              className="hub-mastery-bar-fill"
              style={{ width: `${masteryPct}%` }}
            />
          </div>
        </section>

        {/* Activity cards grouped by phase */}
        <section className="hub-activities">
          <span className="hub-section-label">ACTIVITIES</span>
          {PHASES.map((phase, phaseIdx) => {
            const phaseActivities = ACTIVITIES.filter((a) => {
              if (a.phase !== phase.key) return false;
              const avail = getActivityAvailability(a, { session: exploreSession, user });
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
                    const avail  = getActivityAvailability(activity, { session: exploreSession, user });
                    const locked = avail.locked;
                    const completions = progress?.[activity.id]?.completions
                      || (progress?.[activity.id]?.status === 'completed' ? 1 : 0);
                    const inProgress = startedActivities.has(activity.id);
                    return (
                      <div
                        key={activity.id}
                        className={`hub-card${locked ? ' hub-card--locked' : ''}${completions > 0 ? ' hub-card--complete' : ''}`}
                        style={{
                          borderColor:    activity.dark,
                          boxShadow:      `5px 5px 0 ${activity.color}`,
                          '--card-color': activity.color,
                          opacity:        locked ? 0.55 : 1,
                          cursor:         locked ? 'not-allowed' : 'pointer',
                        }}
                        onClick={() => {
                          if (locked) return;
                          if (!lockedWords[activity.id]) {
                            setLockedWords(prev => ({ ...prev, [activity.id]: words }));
                          }
                          setStartedActivities(prev => new Set(prev).add(activity.id));
                          setActiveActivity(activity.id);
                        }}
                        role="button"
                        tabIndex={locked ? -1 : 0}
                        aria-disabled={locked}
                        title={locked ? avail.message : undefined}
                        onKeyDown={(e) => {
                          if (locked || e.key !== 'Enter') return;
                          if (!lockedWords[activity.id]) {
                            setLockedWords(prev => ({ ...prev, [activity.id]: words }));
                          }
                          setStartedActivities(prev => new Set(prev).add(activity.id));
                          setActiveActivity(activity.id);
                        }}
                      >
                        <div className="hub-card-header" style={{ background: activity.color }}>
                          <span className="hub-card-icon hub-card-icon--emoji">{activity.icon}</span>
                          <span className="hub-card-icon hub-card-icon--svg" aria-hidden="true">
                            <ActivityIcon id={activity.id} size={28} />
                          </span>
                          {locked && <span className="hub-card-lock" aria-hidden="true">🔒</span>}
                        </div>
                        <div className="hub-card-body">
                          <h3 className="hub-card-name">{activity.name}</h3>
                          <p className="hub-card-time">⏱ {activity.timeEstimate}</p>
                          {!locked && <CompletionTicks count={completions} />}
                          {!locked && (
                            <span
                              className="hub-card-play"
                              style={{ background: activity.dark }}
                              aria-hidden="true"
                            >
                              {inProgress ? 'Continue ▶' : 'Play ▶'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        {/* Test All Words — floating round button fixed at the bottom-right
            of the viewport. Hidden once every word is mastered. */}
        {unmasteredWords.length > 0 && (
          <section className="hub-testall">
            <button
              type="button"
              className="hub-testall-btn"
              onClick={() => setTestAllStage('choose')}
            >
              <span className="hub-testall-icon" aria-hidden="true">▶</span>
              <span className="hub-testall-label">Test All Words</span>
              <span className="hub-testall-meta">
                {unmasteredWords.length}{' '}
                {unmasteredWords.length === 1 ? 'word' : 'words'} to go
              </span>
            </button>
          </section>
        )}

        {/* Word detail modal */}
        {activeWord && (
          <WordDetailModal
            word={activeWord.word}
            chipColor={activeWord.chipColor}
            onClose={() => setActiveWord(null)}
          />
        )}

        {/* Test All game picker modal */}
        {testAllStage === 'choose' && (
          <TestAllModal
            unmasteredWords={unmasteredWords}
            onPick={launchTestAll}
            onClose={() => setTestAllStage('idle')}
          />
        )}
      </div>

    </div>
    </div>
  );
}
