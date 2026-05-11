import React, { useState, useEffect } from 'react';
import { ACTIVITIES, PHASES } from '../../data/activities';
import { getActivityAvailability } from '../../utils/activityAvailability';
import { renderExploreActivity } from './exploreActivityRunner';
import { scoreWord, scoreToBand } from '../../utils/difficultyEngine';
import ActivityIcon from '../ActivityIcon';
import { HubPlayerCard, MasteryDot } from '../WordListHub';
import '../WordListHub.css';
import './ListHub.css';

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

const STATUS_LABEL = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed':   'Done ✓',
};

export default function ListHub({ list, listType = 'curriculum', session = null, onBack, getListProgress, markComplete, user, onCreateAccount = null }) {
  const [activeActivity, setActiveActivity] = useState(null);
  const [progress,       setProgress]       = useState({});

  const words = (list.words || []).map(w => (typeof w === 'string' ? w : w.word));

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

  // Only count activities applicable to this list (exclude 'unsupported').
  const availableActivities = ACTIVITIES.filter(
    a => getActivityAvailability(a, { session: exploreSession, user }).reason !== 'unsupported'
  );
  const completedCount = availableActivities.filter(a => progress[a.id]?.status === 'completed').length;
  const progressPct    = Math.round((completedCount / availableActivities.length) * 100);

  const [progressRevealed, setProgressRevealed] = useState(completedCount > 0);

  useEffect(() => {
    if (completedCount > 0 && !progressRevealed) {
      setProgressRevealed(true);
    }
  }, [completedCount]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Active game ──────────────────────────────────────────────────────────
  if (activeActivity) {
    const rendered = renderExploreActivity(activeActivity, {
      list, words, user,
      onComplete: handleComplete,
      onExit: () => setActiveActivity(null),
    });
    if (rendered) return rendered;
  }

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
          {/* Word list */}
          <section className="hub-words">
            <div className="hub-section-header">
              <div className="hub-section-title-block">
                <span className="hub-section-label">WORD LIST</span>
                <span className="hub-list-title">{list.name}</span>
              </div>
            </div>
            <div className="hub-chips">
              {words.map((w, i) => {
                const { bg, border } = WORD_CHIP_COLORS[i % WORD_CHIP_COLORS.length];
                const band = scoreToBand(scoreWord(w));
                return (
                  <button
                    key={i}
                    className="hub-chip"
                    style={{ background: bg, borderColor: border }}
                  >
                    <MasteryDot rate={null} />
                    {w}
                    <span className={`hub-diff-star hub-diff-star--${band}`} title={band}>★</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Back to lists CTA — mirrors the Browse section in the master hub */}
          <section className="hub-word-lists">
            <div className="hub-word-lists-header">EXPLORE</div>
            <button className="hub-word-lists-btn" onClick={onBack}>
              ← All Word Lists
            </button>
          </section>
        </div>
      </div>

      {/* ── Right column ── */}
      <div className="hub-split-right">

        {/* Progress */}
        <section className={`hub-progress${!progressRevealed ? ' hub-progress--hidden' : ''}`}>
          <div className="hub-progress-labels">
            <span>{completedCount} of {availableActivities.length} activities done</span>
            <span className="hub-progress-pct">{progressPct}%</span>
          </div>
          <div className="hub-pixel-progress">
            {availableActivities.map((activity) => {
              const filled = progress[activity.id]?.status === 'completed';
              const avail  = getActivityAvailability(activity, { session: exploreSession, user });
              const locked = avail.locked;
              return (
                <button
                  key={activity.id}
                  type="button"
                  className={`hub-pixel-block${filled ? ' hub-pixel-block--filled' : ''}${locked ? ' hub-pixel-block--locked' : ''}`}
                  aria-label={locked ? `${activity.name} — locked` : `Open ${activity.name}`}
                  onClick={() => { if (!locked) setActiveActivity(activity.id); }}
                >
                  <span className="hub-pixel-tip">
                    {activity.name}{locked ? ' — Locked' : ''}
                  </span>
                </button>
              );
            })}
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
                    const raw    = progress[activity.id]?.status;
                    const status = raw === 'completed'   ? 'completed'
                                 : raw === 'in_progress' ? 'in-progress'
                                 : 'not-started';
                    const done   = status === 'completed';
                    const avail  = getActivityAvailability(activity, { session: exploreSession, user });
                    const locked = avail.locked;
                    return (
                      <div
                        key={activity.id}
                        className={`hub-card hub-card--${status}${locked ? ' hub-card--locked' : ''}`}
                        style={{
                          borderColor:    activity.dark,
                          boxShadow:      done
                            ? `3px 3px 0 ${activity.color}`
                            : `5px 5px 0 ${activity.color}`,
                          '--card-color': activity.color,
                          opacity:        locked ? 0.55 : 1,
                          cursor:         locked ? 'not-allowed' : 'pointer',
                        }}
                        onClick={() => { if (!locked) setActiveActivity(activity.id); }}
                        role="button"
                        tabIndex={locked ? -1 : 0}
                        aria-disabled={locked}
                        title={locked ? avail.message : undefined}
                        onKeyDown={(e) => { if (!locked && e.key === 'Enter') setActiveActivity(activity.id); }}
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
                          <span className={`hub-badge hub-badge--${status}`}>
                            {locked ? (avail.message || 'Locked') : STATUS_LABEL[status]}
                          </span>
                          <p className="hub-card-time">⏱ {activity.timeEstimate}</p>
                          {!locked && progress[activity.id]?.accuracy != null && (
                            <p className="lh-card-accuracy">{progress[activity.id].accuracy}% accuracy</p>
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
      </div>

    </div>
    </div>
  );
}
