import React, { useState } from 'react';
import './Settings.css';
import { YEAR_LABELS, ageToYear } from '../data/ukCurriculum';

const DIFF_LABELS = { easy: '😊 Easy', medium: '😤 Medium', hard: '💪 Hard' };

function Settings({ userAge, difficulty, onUpdate, onChangeWords, onClearProgress, onClose }) {
  const [localDiff, setLocalDiff] = useState(difficulty);
  const year = ageToYear(userAge);

  const handleDiff = (d) => {
    setLocalDiff(d);
    onUpdate({ difficulty: d });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose} aria-label="Close settings">✕</button>

        <h2 className="settings-title">⚙️ Settings</h2>

        <div className="settings-row">
          <span className="settings-label">School Year</span>
          <span className="settings-value">
            {YEAR_LABELS[year]} <span className="settings-muted">(age {userAge})</span>
          </span>
        </div>

        <div className="settings-section">
          <span className="settings-label">Difficulty</span>
          <div className="settings-diff-row">
            {Object.entries(DIFF_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`settings-diff-btn${localDiff === key ? ' settings-diff-btn--active' : ''}`}
                onClick={() => handleDiff(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-actions">
          <button className="settings-action-btn" onClick={onChangeWords}>
            📝 Change Words
          </button>
          <button className="settings-action-btn settings-action-btn--danger" onClick={() => { onClearProgress(); onClose(); }}>
            🔄 Reset Progress
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
