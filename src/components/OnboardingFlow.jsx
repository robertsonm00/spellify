import React, { useState } from 'react';
import './OnboardingFlow.css';
import { YEAR_DATA, getWordsForYear, getAgeRangeLabel } from '../data/ukCurriculum';
import AddWordsManual from './AddWordsManual';

const YEAR_COLORS = {
  1: { bg: '#fff0f0', border: '#ff6b6b', accent: '#ff6b6b', dark: '#c0392b' },
  2: { bg: '#fff4ec', border: '#ff9f43', accent: '#ff9f43', dark: '#c05700' },
  3: { bg: '#fffbe6', border: '#ffd93d', accent: '#ffd93d', dark: '#8a6f00' },
  4: { bg: '#f0fff4', border: '#6bcb77', accent: '#6bcb77', dark: '#1e7e34' },
  5: { bg: '#e8f4ff', border: '#4d96ff', accent: '#4d96ff', dark: '#1a5cbf' },
  6: { bg: '#f5f0ff', border: '#c77dff', accent: '#c77dff', dark: '#6b21a8' },
};

const WORD_CARD_COLORS = [
  { bg: '#fff0f0', border: '#ff6b6b' },
  { bg: '#fff8e1', border: '#ffd93d' },
  { bg: '#f0fff4', border: '#6bcb77' },
  { bg: '#e8f4ff', border: '#4d96ff' },
  { bg: '#f5f0ff', border: '#c77dff' },
  { bg: '#fff4ec', border: '#ff9f43' },
  { bg: '#f0ffff', border: '#00d2d3' },
  { bg: '#fff0f8', border: '#ff6b9d' },
];

// ── Step 1: Year group picker ──────────────────────────────────────────────

function YearPicker({ onSelect }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="ob-step ob-year">
      <div className="ob-step-header">
        <div className="ob-step-icon">👋</div>
        <h2 className="ob-step-title">What year are you in?</h2>
        <p className="ob-step-sub">We'll pick the right words for you</p>
      </div>

      <div className="ob-year-grid">
        {Object.values(YEAR_DATA).map(({ year, label }) => {
          const colors    = YEAR_COLORS[year];
          const isSelected = selected === year;
          return (
            <button
              key={year}
              className={`ob-year-card${isSelected ? ' ob-year-card--selected' : ''}`}
              style={{
                background:   isSelected ? colors.accent : colors.bg,
                borderColor:  isSelected ? colors.dark   : colors.border,
                boxShadow:    isSelected
                  ? `3px 3px 0 ${colors.dark}`
                  : `3px 3px 0 ${colors.border}`,
                color: isSelected ? '#fff' : '#1a1a2e',
              }}
              onClick={() => setSelected(year)}
            >
              <span className="ob-year-label">{label}</span>
              <span
                className="ob-year-ages"
                style={{ color: isSelected ? 'rgba(255,255,255,0.85)' : colors.dark }}
              >
                {getAgeRangeLabel(year)}
              </span>
            </button>
          );
        })}
      </div>

      <button
        className={`ob-next-btn${selected !== null ? ' ob-next-btn--ready' : ''}`}
        onClick={() => selected !== null && onSelect(selected)}
        disabled={selected === null}
      >
        Next →
      </button>
    </div>
  );
}

// ── Step 2: Word source choice ─────────────────────────────────────────────

function WordSourcePicker({ onGenerate, onManual }) {
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
        <button className="ob-source-card ob-source-card--manual" onClick={onManual}>
          <span className="ob-source-icon">✏️</span>
          <strong>Add my own</strong>
          <span className="ob-source-desc">Type, upload a file, or take a photo</span>
        </button>
      </div>
    </div>
  );
}

// ── Step 3a: Generated word preview ───────────────────────────────────────

function GeneratedWords({ year, onConfirm }) {
  const [count,    setCount]    = useState(20);
  const [allWords, setAllWords] = useState(() => getWordsForYear(year, 20));

  const words = allWords.slice(0, count);

  const reshuffle = () => setAllWords(getWordsForYear(year, 20));

  return (
    <div className="ob-step ob-words">
      <div className="ob-step-header">
        <div className="ob-step-icon">🎉</div>
        <h2 className="ob-step-title">Your words!</h2>
        <p className="ob-step-sub">{YEAR_DATA[year]?.label} · {words.length} words ready</p>
      </div>

      {/* 10 / 20 toggle */}
      <div className="ob-count-toggle">
        <button
          className={`ob-count-btn${count === 10 ? ' ob-count-btn--active' : ''}`}
          onClick={() => setCount(10)}
        >
          10 words
        </button>
        <button
          className={`ob-count-btn${count === 20 ? ' ob-count-btn--active' : ''}`}
          onClick={() => setCount(20)}
        >
          20 words
        </button>
      </div>

      <div className="ob-word-grid">
        {words.map((w, i) => {
          const { bg, border } = WORD_CARD_COLORS[i % WORD_CARD_COLORS.length];
          return (
            <span
              key={w}
              className="ob-word-card"
              style={{ background: bg, borderColor: border, animationDelay: `${(i * 0.04).toFixed(2)}s` }}
            >
              {w}
            </span>
          );
        })}
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

// ── Main orchestrator ──────────────────────────────────────────────────────

function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState('year');   // year | source | generate | manual
  const [year, setYear] = useState(null);

  const handleYear = (y) => { setYear(y); setStep('source'); };

  const handleConfirmWords = (words) => {
    const ageRange = YEAR_DATA[year]?.ageRange || [8, 9];
    onComplete({ year, age: ageRange[0], words, difficulty: 'medium' });
  };

  const back = () => {
    if (step === 'source')                      setStep('year');
    else if (step === 'generate' || step === 'manual') setStep('source');
  };

  return (
    <div className="ob-wrap">
      <div className="ob-card">
        {step === 'year'     && <YearPicker onSelect={handleYear} />}
        {step === 'source'   && (
          <WordSourcePicker
            onGenerate={() => setStep('generate')}
            onManual={() => setStep('manual')}
          />
        )}
        {step === 'generate' && year !== null && (
          <GeneratedWords year={year} onConfirm={handleConfirmWords} />
        )}
        {step === 'manual' && (
          <div className="ob-step">
            <div className="ob-step-header">
              <div className="ob-step-icon">✏️</div>
              <h2 className="ob-step-title">Add your words</h2>
              <p className="ob-step-sub">Type one at a time · min 3 words</p>
            </div>
            <AddWordsManual onWordsReady={handleConfirmWords} />
          </div>
        )}

        {step !== 'year' && (
          <button className="ob-back-btn" onClick={back}>← Back</button>
        )}
      </div>
    </div>
  );
}

export default OnboardingFlow;
