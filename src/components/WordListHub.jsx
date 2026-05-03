import React, { useState } from 'react';
import './WordListHub.css';

const ACTIVITIES = [
  { id: 'wordsearch', name: 'Word Search',  icon: '🔍', timeEstimate: '5 mins',  available: true  },
  { id: 'quiz',       name: 'Quiz',          icon: '🎤', timeEstimate: '3 mins',  available: true  },
  { id: 'hangman',    name: 'Hangman',       icon: '🎯', timeEstimate: '5 mins',  available: true  },
  { id: 'crossword',  name: 'Crossword',    icon: '✏️',  timeEstimate: '10 mins', available: false },
];

const STATUS_LABEL = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed':   'Completed',
};

function WordListHub({ words, userAge = 8, activityStatuses, onLaunch, onChangeWords }) {
  const [difficulties, setDifficulties] = useState({
    wordsearch: 'medium',
    crossword:  'medium',
    quiz:       'medium',
    hangman:    'medium',
  });

  const setDifficulty = (id, level) =>
    setDifficulties((prev) => ({ ...prev, [id]: level }));

  const completedCount = Object.values(activityStatuses).filter((s) => s === 'completed').length;
  const masteredWords  = Math.round((completedCount / ACTIVITIES.length) * words.length);
  const progressPct    = Math.round((completedCount / ACTIVITIES.length) * 100);

  return (
    <div className="hub">
      {/* ── Word list ── */}
      <section className="hub-words">
        <div className="hub-section-header">
          <h2>Your Words</h2>
          <button className="hub-change-btn" onClick={onChangeWords}>
            Change Words
          </button>
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
          <span>{masteredWords} of {words.length} words mastered</span>
          <span>{completedCount} / {ACTIVITIES.length} activities</span>
        </div>
        <div className="hub-progress-track">
          <div className="hub-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </section>

      {/* ── Activity cards ── */}
      <section className="hub-activities">
        <h2>Activities</h2>
        <div className="hub-grid">
          {ACTIVITIES.map((activity) => {
            const status     = activityStatuses[activity.id] || 'not-started';
            const difficulty = difficulties[activity.id];

            return (
              <div
                key={activity.id}
                className={`hub-card hub-card--${status}${activity.available ? '' : ' hub-card--locked'}`}
                onClick={() => activity.available && onLaunch(activity.id, difficulty)}
                role={activity.available ? 'button' : undefined}
                tabIndex={activity.available ? 0 : undefined}
                onKeyDown={(e) =>
                  activity.available && e.key === 'Enter' && onLaunch(activity.id, difficulty)
                }
              >
                <div className="hub-card-icon">{activity.icon}</div>

                <div className="hub-card-body">
                  <h3 className="hub-card-name">{activity.name}</h3>

                  <span className={`hub-badge hub-badge--${status}`}>
                    {STATUS_LABEL[status]}
                  </span>

                  <p className="hub-card-time">⏱ {activity.timeEstimate}</p>

                  {activity.available && userAge >= 7 && (
                    <div
                      className="hub-difficulty"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {['easy', 'medium', 'hard'].map((level) => (
                        <button
                          key={level}
                          className={`hub-diff-btn${difficulty === level ? ' active' : ''}`}
                          onClick={() => setDifficulty(activity.id, level)}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}

                  {!activity.available && (
                    <p className="hub-card-soon">Coming soon</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default WordListHub;
