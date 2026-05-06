import React, { useState, useEffect } from 'react';
import WordSearch from '../WordSearch';
import Crossword  from '../Crossword';
import './ListHub.css';

const ACTIVITIES = [
  { id: 'wordSearch', label: 'Word Search', icon: '🔍', color: '#4d96ff', dark: '#1a5cbf', live: true  },
  { id: 'crossword',  label: 'Crossword',   icon: '✏️', color: '#c77dff', dark: '#6b21a8', live: true  },
  { id: 'hangman',    label: 'Hangman',      icon: '🎯', color: '#ff9f43', dark: '#c05700', live: false },
  { id: 'quiz',       label: 'Quiz',         icon: '🏆', color: '#ec4899', dark: '#9d174d', live: false },
];

const CATEGORY_COLOURS = {
  'Statutory':    '#6b7280',
  'Phonics':      '#a855f7',
  'Patterns':     '#1D9E75',
  'Etymology':    '#EF9F27',
  'Vowels':       '#f97316',
  'Sight words':  '#22c55e',
};

export default function ListHub({ list, listType = 'curriculum', onBack, getListProgress, markComplete, user }) {
  const [activeActivity, setActiveActivity] = useState(null);
  const [progress, setProgress] = useState({});

  const words = (list.words || []).map(w => (typeof w === 'string' ? w : w.word));

  // ── Load progress ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (getListProgress) {
        const p = await getListProgress(list.id, listType);
        setProgress(p || {});
      }
    })();
  }, [list.id, listType, getListProgress]);

  const completedCount = ACTIVITIES.filter(a => progress[a.id]?.status === 'completed').length;

  // ── Handle game complete ─────────────────────────────────────────────────
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

  // ── Render active game ───────────────────────────────────────────────────
  if (activeActivity === 'wordSearch') {
    return (
      <WordSearch
        words={words}
        hideTopbar
        onComplete={(results) => handleComplete('wordSearch', results)}
        onExit={() => setActiveActivity(null)}
      />
    );
  }
  if (activeActivity === 'crossword') {
    return (
      <Crossword
        words={words}
        userAge={10}
        hideTopbar
        onComplete={(results) => handleComplete('crossword', results || [])}
        onExit={() => setActiveActivity(null)}
      />
    );
  }

  // ── List Hub view ────────────────────────────────────────────────────────
  const categoryColour = CATEGORY_COLOURS[list.category] || '#6b7280';

  return (
    <div className="lh-wrap">
      {/* Header */}
      <div className="lh-header">
        <button className="lh-back" onClick={onBack}>← Back</button>

        <div className="lh-header-center">
          <h1 className="lh-title">{list.name}</h1>
          <div className="lh-meta">
            <span className="lh-badge" style={{ background: categoryColour + '22', color: categoryColour, border: `1.5px solid ${categoryColour}` }}>
              {list.category || 'Custom'}
            </span>
            <span className="lh-word-count">{words.length} words</span>
            {list.year && <span className="lh-year">Year {list.year === 3 ? '3–4' : list.year === 5 ? '5–6' : list.year}</span>}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="lh-progress-strip">
        <div className="lh-progress-fill" style={{ width: `${(completedCount / ACTIVITIES.length) * 100}%` }} />
        <span className="lh-progress-label">{completedCount} of {ACTIVITIES.length} activities done</span>
      </div>

      <div className="lh-body">
        {/* ── Word sidebar ── */}
        <aside className="lh-sidebar">
          <h3 className="lh-sidebar-title">Words</h3>
          <ul className="lh-word-list">
            {(list.words || []).map((item, i) => {
              const word = typeof item === 'string' ? item : item.word;
              const def  = typeof item === 'object' ? item.definition : '';
              return (
                <li key={i} className="lh-word-item">
                  <span className="lh-word-text">{word}</span>
                  {def && <span className="lh-word-def">{def}</span>}
                </li>
              );
            })}
          </ul>
        </aside>

        {/* ── Activity cards ── */}
        <main className="lh-activities">
          <h2 className="lh-section-title">Choose an activity</h2>
          <div className="lh-grid">
            {ACTIVITIES.map((act) => {
              const status  = progress[act.id]?.status || 'not_started';
              const done    = status === 'completed';
              const locked  = !act.live;

              return (
                <div
                  key={act.id}
                  className={`lh-card${locked ? ' lh-card--locked' : ''}${done ? ' lh-card--done' : ''}`}
                  style={{
                    borderColor: locked ? '#e0e0e0' : act.dark,
                    boxShadow:   locked ? '4px 4px 0 #e0e0e0' : `4px 4px 0 ${act.dark}`,
                  }}
                  onClick={() => !locked && setActiveActivity(act.id)}
                  role={locked ? undefined : 'button'}
                  tabIndex={locked ? -1 : 0}
                  onKeyDown={e => !locked && e.key === 'Enter' && setActiveActivity(act.id)}
                  aria-label={locked ? `${act.label} — coming soon` : act.label}
                >
                  {/* Coloured header */}
                  <div
                    className="lh-card-header"
                    style={{ background: locked ? '#f0f0f0' : act.color }}
                  >
                    <span className="lh-card-icon">{locked ? '🔒' : act.icon}</span>
                    {done && <span className="lh-card-check">✓</span>}
                  </div>

                  <div className="lh-card-body">
                    <h3 className="lh-card-name">{act.label}</h3>
                    {locked ? (
                      <span className="lh-card-soon">Coming soon</span>
                    ) : (
                      <>
                        <span className={`lh-card-status lh-card-status--${status}`}>
                          {status === 'completed' ? '★ Completed'
                           : status === 'in_progress' ? '► Playing'
                           : 'Not started'}
                        </span>
                        {progress[act.id]?.accuracy != null && (
                          <span className="lh-card-accuracy">{progress[act.id].accuracy}% accuracy</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
