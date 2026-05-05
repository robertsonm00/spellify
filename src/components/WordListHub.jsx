import React, { useState } from 'react';
import './WordListHub.css';
import Settings from './Settings';
import { GeneratedWords } from './OnboardingFlow';
import { scoreWord, scoreToBand } from '../utils/difficultyEngine';

const ACTIVITIES = [
  { id: 'wordsearch', name: 'Word Search',   icon: '🔍', timeEstimate: '5 mins',  color: '#4d96ff', dark: '#1a5cbf' },
  { id: 'quiz',       name: 'Spelling Quiz',  icon: '🎤', timeEstimate: '3 mins',  color: '#6bcb77', dark: '#1e7e34' },
  { id: 'hangman',    name: 'Hangman',        icon: '🎯', timeEstimate: '5 mins',  color: '#ff9f43', dark: '#c05700' },
  { id: 'crossword',  name: 'Crossword',      icon: '✏️', timeEstimate: '10 mins', color: '#c77dff', dark: '#6b21a8' },
  { id: 'writeit',    name: 'Write It',       icon: '✏️', timeEstimate: '10 mins', color: '#a855f7', dark: '#581c87' },
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

  const completedCount = Object.values(activityStatuses).filter((s) => s === 'completed').length;
  const progressPct    = Math.round((completedCount / ACTIVITIES.length) * 100);

  // Pixel progress: 4 blocks, one per activity
  const progressBlocks = ACTIVITIES.map((a) => activityStatuses[a.id] === 'completed');

  return (
    <div className="hub">
      {/* ── Top bar ── */}
      <div className="hub-topbar">
        <button className="hub-home-btn" onClick={onBackToWelcome} title="Back to welcome">
          🏠
        </button>

        <button
          className="hub-settings-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>

      {/* ── Welcome section ── */}
      {childName && (
        <section className="hub-welcome">
          <div className="hub-welcome-content">
            <span className="hub-welcome-character">{childCharacter?.emoji || '⭐'}</span>
            <div className="hub-welcome-text">
              <p className="hub-welcome-greeting">Welcome, <strong>{childName}</strong>!</p>
              <p className="hub-welcome-subtext">Ready to master some spellings?</p>
            </div>
          </div>
        </section>
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
              <span key={w} className="hub-chip" style={{ background: bg, borderColor: border }}>
                <MasteryDot rate={rate} />
                {w}
                <span className={`hub-diff-star hub-diff-star--${band}`} title={band}>★</span>
              </span>
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

      {/* ── Settings modal ── */}
      {settingsOpen && (
        <Settings
          userAge={userAge}
          dyslexiaMode={dyslexiaMode}
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
