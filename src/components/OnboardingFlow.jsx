import React, { useState } from 'react';
import './OnboardingFlow.css';
import { ageToYear, getWordsForYear, YEAR_LABELS } from '../data/ukCurriculum';
import WordUpload from './WordUpload';

const AGES = [5, 6, 7, 8, 9, 10, 11, 12];

const BUBBLE_COLORS = [
  '#ff6b6b', '#ff9f43', '#ffd93d', '#6bcb77',
  '#4d96ff', '#c77dff', '#ff6b9d', '#00d2d3',
];

const CARD_COLORS = [
  '#fff0f0', '#fff8e1', '#f0fff4', '#e8f4ff',
  '#f5f0ff', '#fff0f8', '#f0ffff', '#fffaf0',
];

const CARD_BORDERS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
  '#c77dff', '#ff9f43', '#00d2d3', '#ff6b9d',
];

// Step 1: age picker
function AgePicker({ onSelect }) {
  const [selected, setSelected] = useState(null);

  const handleNext = () => {
    if (selected !== null) onSelect(selected);
  };

  return (
    <div className="ob-step ob-age">
      <div className="ob-step-header">
        <div className="ob-step-icon">👋</div>
        <h2 className="ob-step-title">How old are you?</h2>
        <p className="ob-step-sub">We'll pick the right words for you</p>
      </div>

      <div className="ob-age-grid">
        {AGES.map((age, i) => {
          const year = ageToYear(age);
          const isSelected = selected === age;
          return (
            <button
              key={age}
              className={`ob-age-bubble${isSelected ? ' ob-age-bubble--selected' : ''}`}
              style={{
                '--bubble-color': BUBBLE_COLORS[i],
                borderColor: isSelected ? BUBBLE_COLORS[i] : '#e0e0e0',
                background:  isSelected ? BUBBLE_COLORS[i] : '#fff',
                color:       isSelected ? '#fff' : '#333',
              }}
              onClick={() => setSelected(age)}
            >
              <span className="ob-age-num">{age}</span>
              <span className="ob-age-year">{YEAR_LABELS[year]}</span>
            </button>
          );
        })}
      </div>

      <button
        className={`ob-next-btn${selected !== null ? ' ob-next-btn--ready' : ''}`}
        onClick={handleNext}
        disabled={selected === null}
      >
        Next →
      </button>
    </div>
  );
}

// Step 2: word source choice
function WordSourcePicker({ onGenerate, onUpload }) {
  return (
    <div className="ob-step ob-source">
      <div className="ob-step-header">
        <div className="ob-step-icon">📚</div>
        <h2 className="ob-step-title">Get your words</h2>
        <p className="ob-step-sub">How would you like to choose?</p>
      </div>

      <div className="ob-source-cards">
        <button className="ob-source-card ob-source-card--generate" onClick={onGenerate}>
          <span className="ob-source-icon">✨</span>
          <strong>Generate for me</strong>
          <span className="ob-source-desc">UK curriculum words for your year group</span>
        </button>
        <button className="ob-source-card ob-source-card--upload" onClick={onUpload}>
          <span className="ob-source-icon">📝</span>
          <strong>My own words</strong>
          <span className="ob-source-desc">Type or paste your spelling list</span>
        </button>
      </div>
    </div>
  );
}

// Step 3a: generated word preview
function GeneratedWords({ year, onConfirm }) {
  const [words, setWords] = useState(() => getWordsForYear(year, 20));

  const reshuffle = () => setWords(getWordsForYear(year, 20));

  return (
    <div className="ob-step ob-words">
      <div className="ob-step-header">
        <div className="ob-step-icon">🎉</div>
        <h2 className="ob-step-title">Your words!</h2>
        <p className="ob-step-sub">{YEAR_LABELS[year]} · {words.length} words ready</p>
      </div>

      <div className="ob-word-chips">
        {words.map((w, i) => (
          <span
            key={w}
            className="ob-word-chip"
            style={{
              background:   CARD_COLORS[i % CARD_COLORS.length],
              borderColor:  CARD_BORDERS[i % CARD_BORDERS.length],
              animationDelay: `${(i * 0.05).toFixed(2)}s`,
            }}
          >
            {w}
          </span>
        ))}
      </div>

      <div className="ob-words-actions">
        <button className="ob-reshuffle-btn" onClick={reshuffle}>🔀 Shuffle</button>
        <button className="ob-play-btn" onClick={() => onConfirm(words)}>
          Let's Play! ▶
        </button>
      </div>
    </div>
  );
}

// Main onboarding orchestrator
function OnboardingFlow({ onComplete }) {
  const [step, setStep]   = useState('age');      // age | source | generate | upload
  const [age,  setAge]    = useState(null);

  const year = age ? ageToYear(age) : null;

  const handleAge = (selectedAge) => {
    setAge(selectedAge);
    setStep('source');
  };

  const handleConfirmWords = (words) => {
    onComplete({ age, year, words, difficulty: 'medium' });
  };

  const handleUploadWords = (words) => {
    onComplete({ age: age || 8, year: year || 3, words, difficulty: 'medium' });
  };

  return (
    <div className="ob-wrap">
      <div className="ob-card">
        {step === 'age' && (
          <AgePicker onSelect={handleAge} />
        )}
        {step === 'source' && (
          <WordSourcePicker
            onGenerate={() => setStep('generate')}
            onUpload={() => setStep('upload')}
          />
        )}
        {step === 'generate' && year !== null && (
          <GeneratedWords year={year} onConfirm={handleConfirmWords} />
        )}
        {step === 'upload' && (
          <div className="ob-step">
            <div className="ob-step-header">
              <div className="ob-step-icon">📝</div>
              <h2 className="ob-step-title">Add your words</h2>
              <p className="ob-step-sub">Enter one word per line</p>
            </div>
            <WordUpload onWordsUploaded={handleUploadWords} />
          </div>
        )}

        {/* Step back */}
        {step !== 'age' && (
          <button
            className="ob-back-btn"
            onClick={() => setStep(step === 'generate' || step === 'upload' ? 'source' : 'age')}
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

export default OnboardingFlow;
