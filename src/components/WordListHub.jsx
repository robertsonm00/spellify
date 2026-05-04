import React, { useState } from 'react';
import './WordListHub.css';
import Settings from './Settings';

const ACTIVITIES = [
  { id: 'wordsearch', name: 'Word Search',  icon: '🔍', timeEstimate: '5 mins'  },
  { id: 'quiz',       name: 'Spelling Quiz', icon: '🎤', timeEstimate: '3 mins'  },
  { id: 'hangman',    name: 'Hangman',       icon: '🎯', timeEstimate: '5 mins'  },
  { id: 'crossword',  name: 'Crossword',     icon: '✏️', timeEstimate: '10 mins' },
];

const STATUS_LABEL = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed':   'Completed ✓',
};

const DIFF_COLORS = { easy: '#6bcb77', medium: '#4d96ff', hard: '#ff6b6b' };

function WordListHub({
  words,
  userAge = 8,
  difficulty = 'medium',
  activityStatuses,
  onLaunch,
  onChangeWords,
  onSettingsUpdate,
  onClearProgress,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const completedCount = Object.values(activityStatuses).filter((s) => s === 'completed').length;
  const progressPct    = Math.round((completedCount / ACTIVITIES.length) * 100);

  return (
    <div className="hub">
      {/* ── Top bar ── */}
      <div className="hub-topbar">
        <div className="hub-diff-global">
          <span className="hub-diff-label">Difficulty:</span>
          {['easy', 'medium', 'hard'].map((d) => (
            <button
              key={d}
              className={`hub-diff-pill${difficulty === d ? ' hub-diff-pill--active' : ''}`}
              style={difficulty === d ? { background: DIFF_COLORS[d], borderColor: DIFF_COLORS[d] } : {}}
              onClick={() => onSettingsUpdate({ difficulty: d })}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <button
          className="hub-settings-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
        >
          ⚙️
        </button>
      </div>

      {/* ── Word list ── */}
      <section className="hub-words">
        <div className="hub-section-header">
          <h2>Your Words <span className="hub-word-count">({words.length})</span></h2>
          <button className="hub-change-btn" onClick={onChangeWords}>Change Words</button>
        </div>
        <div className="hub-chips">
          {words.map((w) => (
            <span key={w} className="hub-chip">{w}</span>
          ))}
        </div>
      </section>

      {/* ── Progress ── */}
      <section className="hub-progress">
        <div className="hub-progress-labels">
          <span>{completedCount} of {ACTIVITIES.length} activities completed</span>
          <span className="hub-progress-pct">{progressPct}%</span>
        </div>
        <div className="hub-progress-track">
          <div
            className="hub-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </section>

      {/* ── Activity cards ── */}
      <section className="hub-activities">
        <h2>Activities</h2>
        <div className="hub-grid">
          {ACTIVITIES.map((activity) => {
            const status = activityStatuses[activity.id] || 'not-started';
            return (
              <div
                key={activity.id}
                className={`hub-card hub-card--${status}`}
                onClick={() => onLaunch(activity.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onLaunch(activity.id)}
              >
                <div className="hub-card-icon">{activity.icon}</div>
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

      {/* ── Settings modal ── */}
      {settingsOpen && (
        <Settings
          userAge={userAge}
          difficulty={difficulty}
          onUpdate={onSettingsUpdate}
          onChangeWords={() => { setSettingsOpen(false); onChangeWords(); }}
          onClearProgress={() => { onClearProgress(); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default WordListHub;
