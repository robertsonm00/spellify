import React, { useState } from 'react';
import './OnboardingFlow.css';
import { YEAR_DATA, getWordsForYear, getAgeRangeLabel } from '../data/ukCurriculum';
import AddWordsManual from './AddWordsManual';

const CHARACTERS = [
  { id: 'lion',      emoji: '🦁', name: 'Lion' },
  { id: 'tiger',     emoji: '🐯', name: 'Tiger' },
  { id: 'elephant',  emoji: '🐘', name: 'Elephant' },
  { id: 'raccoon',   emoji: '🦝', name: 'Raccoon' },
  { id: 'penguin',   emoji: '🐧', name: 'Penguin' },
  { id: 'octopus',   emoji: '🐙', name: 'Octopus' },
  { id: 'unicorn',   emoji: '🦄', name: 'Unicorn' },
  { id: 'dragon',    emoji: '🐉', name: 'Dragon' },
  { id: 'panda',     emoji: '🐼', name: 'Panda' },
  { id: 'koala',     emoji: '🐨', name: 'Koala' },
  { id: 'bear',      emoji: '🐻', name: 'Bear' },
  { id: 'fox',       emoji: '🦊', name: 'Fox' },
  { id: 'wolf',      emoji: '🐺', name: 'Wolf' },
  { id: 'rabbit',    emoji: '🐰', name: 'Rabbit' },
  { id: 'squirrel',  emoji: '🐿️', name: 'Squirrel' },
  { id: 'otter',     emoji: '🦦', name: 'Otter' },
  { id: 'beaver',    emoji: '🦫', name: 'Beaver' },
  { id: 'deer',      emoji: '🦌', name: 'Deer' },
  { id: 'giraffe',   emoji: '🦒', name: 'Giraffe' },
  { id: 'zebra',     emoji: '🦓', name: 'Zebra' },
  { id: 'hippo',     emoji: '🦛', name: 'Hippo' },
  { id: 'rhino',     emoji: '🦏', name: 'Rhino' },
  { id: 'camel',     emoji: '🐫', name: 'Camel' },
  { id: 'llama',     emoji: '🦙', name: 'Llama' },
  { id: 'sheep',     emoji: '🐑', name: 'Sheep' },
  { id: 'goat',      emoji: '🐐', name: 'Goat' },
  { id: 'pig',       emoji: '🐷', name: 'Pig' },
  { id: 'dog',       emoji: '🐶', name: 'Dog' },
  { id: 'cat',       emoji: '🐱', name: 'Cat' },
  { id: 'mouse',     emoji: '🐭', name: 'Mouse' },
  { id: 'hamster',   emoji: '🐹', name: 'Hamster' },
  { id: 'frog',      emoji: '🐸', name: 'Frog' },
  { id: 'turtle',    emoji: '🐢', name: 'Turtle' },
  { id: 'crocodile', emoji: '🐊', name: 'Crocodile' },
  { id: 'parrot',    emoji: '🦜', name: 'Parrot' },
  { id: 'flamingo',  emoji: '🦩', name: 'Flamingo' },
  { id: 'peacock',   emoji: '🦚', name: 'Peacock' },
  { id: 'owl',       emoji: '🦉', name: 'Owl' },
  { id: 'eagle',     emoji: '🦅', name: 'Eagle' },
  { id: 'bat',       emoji: '🦇', name: 'Bat' },
  { id: 'bee',       emoji: '🐝', name: 'Bee' },
  { id: 'butterfly', emoji: '🦋', name: 'Butterfly' },
  { id: 'ladybug',   emoji: '🐞', name: 'Ladybug' },
  { id: 'fish',      emoji: '🐠', name: 'Fish' },
  { id: 'jellyfish', emoji: '🪼', name: 'Jellyfish' },
  { id: 'crab',      emoji: '🦀', name: 'Crab' },
  { id: 'lobster',   emoji: '🦞', name: 'Lobster' },
  { id: 'shark',     emoji: '🦈', name: 'Shark' },
  { id: 'dolphin',   emoji: '🐬', name: 'Dolphin' },
  { id: 'whale',     emoji: '🐳', name: 'Whale' },
  { id: 'swan',      emoji: '🦢', name: 'Swan' },
  { id: 'duck',      emoji: '🦆', name: 'Duck' },
  { id: 'chicken',   emoji: '🐔', name: 'Chicken' },
  { id: 'cow',       emoji: '🐄', name: 'Cow' },
  { id: 'horse',     emoji: '🐴', name: 'Horse' },
];

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

// ── Step 1: Name input ─────────────────────────────────────────────────────

function NameInput({ onSubmit }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="ob-step ob-name">
      <div className="ob-step-header">
        <div className="ob-step-icon">👋</div>
        <h2 className="ob-step-title">What's your name?</h2>
      </div>

      <form onSubmit={handleSubmit} className="ob-name-form">
        <input
          type="text"
          className="ob-name-input"
          placeholder="Type your name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <button
          type="submit"
          className={`ob-next-btn${name.trim() ? ' ob-next-btn--ready' : ''}`}
          disabled={!name.trim()}
        >
          Next →
        </button>
      </form>
    </div>
  );
}

// ── Step 2: Character picker ───────────────────────────────────────────────

function CharacterPicker({ name, onSelect }) {
  const [selected, setSelected] = useState(null);
  const [showMore, setShowMore] = useState(false);

  const initialCharacters = CHARACTERS.slice(0, 7);
  const moreCharacters = CHARACTERS.slice(7);
  const charactersToShow = showMore ? CHARACTERS : initialCharacters;

  return (
    <div className="ob-step ob-character">
      <div className="ob-step-header">
        <h2 className="ob-step-title" style={{ paddingTop: '2.5rem' }}>Choose your learning buddy, {name}.</h2>
      </div>

      <div className={`ob-character-grid${showMore ? ' ob-character-grid--expanded' : ''}`} style={showMore ? { maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' } : {}}>
        {charactersToShow.map((char) => (
          <button
            key={char.id}
            className={`ob-character-card${selected === char.id ? ' ob-character-card--selected' : ''}`}
            onClick={() => setSelected(char.id)}
          >
            <span className="ob-character-emoji">{char.emoji}</span>
            <span className="ob-character-name">{char.name}</span>
          </button>
        ))}
        {!showMore && (
          <button
            className="ob-character-card ob-character-card--show-more"
            onClick={() => setShowMore(true)}
          >
            <span className="ob-character-emoji">➕</span>
            <span className="ob-character-name">Show more</span>
          </button>
        )}
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

// ── Step 3: Year group picker ──────────────────────────────────────────────

function YearPicker({ name, onSelect }) {
  return (
    <div className="ob-step ob-year">
      <div className="ob-step-header">
        <h2 className="ob-step-title">What's your age, {name}?</h2>
      </div>

      <div className="ob-year-grid">
        {Object.values(YEAR_DATA).map(({ year, label }) => {
          const colors = YEAR_COLORS[year];
          return (
            <button
              key={year}
              className="ob-year-card"
              style={{
                background:  colors.bg,
                borderColor: colors.border,
                boxShadow:   `3px 3px 0 ${colors.border}`,
                color:       '#1a1a2e',
              }}
              onClick={() => onSelect(year)}
            >
              <span className="ob-year-ages" style={{ color: colors.dark }}>
                {getAgeRangeLabel(year)}
              </span>
              <span className="ob-year-label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 4: Word source choice ─────────────────────────────────────────────

function WordSourcePicker({ onGenerate, onManual }) {
  return (
    <div className="ob-step ob-source">
      <div className="ob-step-header">
        <h2 className="ob-step-title">Choose your spellings</h2>
      </div>

      <div className="ob-source-cards">
        <button className="ob-source-card ob-source-card--generate" onClick={onGenerate}>
          <span className="ob-source-icon">✨</span>
          <strong>Random spellings</strong>
          <span className="ob-source-desc">UK curriculum words for your year group</span>
        </button>
        <button className="ob-source-card ob-source-card--manual" onClick={onManual}>
          <span className="ob-source-icon">✏️</span>
          <strong>Add my spellings</strong>
          <span className="ob-source-desc">Type, upload a file, or take a photo</span>
        </button>
      </div>
    </div>
  );
}

// ── Step 5a: Generated word preview ───────────────────────────────────────

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

function OnboardingFlow({ onComplete, initialName = '', initialCharacter = null, initialYear = null, startStep = 'name' }) {
  const [step, setStep] = useState(startStep);   // name | character | year | source | generate | manual
  const [name, setName] = useState(initialName);
  const [character, setCharacter] = useState(initialCharacter);
  const [year, setYear] = useState(initialYear);

  const handleName = (n) => { setName(n); setStep('character'); };
  const handleCharacter = (c) => { setCharacter(c); setStep('year'); };
  const handleYear = (y) => { setYear(y); setStep('source'); };

  const handleConfirmWords = (words) => {
    const ageRange = YEAR_DATA[year]?.ageRange || [8, 9];
    onComplete({ name, character, year, age: ageRange[0], words, difficulty: 'medium' });
  };

  const back = () => {
    if (step === 'character')                      setStep('name');
    else if (step === 'year')                      setStep('character');
    else if (step === 'source')                    setStep('year');
    else if (step === 'generate' || step === 'manual') setStep('source');
  };

  return (
    <div className="ob-wrap">
      <div className="ob-card">
        {step === 'name'     && <NameInput onSubmit={handleName} />}
        {step === 'character' && <CharacterPicker name={name} onSelect={handleCharacter} />}
        {step === 'year'     && <YearPicker name={name} onSelect={handleYear} />}
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

        {step !== 'name' && (
          <button className="ob-back-btn" onClick={back}>← Back</button>
        )}
      </div>
    </div>
  );
}

export default OnboardingFlow;
