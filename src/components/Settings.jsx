import React from 'react';
import './Settings.css';
import { YEAR_LABELS, ageToYear } from '../data/ukCurriculum';

function Settings({ userAge, onUpdate, onChangeWords, onClearProgress, onClose }) {
  const year = ageToYear(userAge);

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
