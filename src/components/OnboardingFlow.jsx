import React, { useState } from 'react';
import './OnboardingFlow.css';
import { YEAR_GROUPS, selectWords } from '../utils/wordSelectionEngine';
import AddWordsManual from './AddWordsManual';

const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  left: (i * 37 + 13) % 100,
  top:  (i * 53 + 7)  % 100,
  delay: ((i * 0.31) % 3).toFixed(2),
  size:  8 + (i % 4) * 4,
  dim:   i % 3 === 0,
}));

export const CHARACTERS = [
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
  0: { bg: '#f0fffc', border: '#2ec4b6', accent: '#2ec4b6', dark: '#147f74' },  // Reception — teal
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
  const [showMore, setShowMore] = useState(false);

  const initialCharacters = CHARACTERS.slice(0, 7);
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
            className="ob-character-card"
            onClick={() => onSelect(char)}
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
        {YEAR_GROUPS.map(({ yearGroup, label, ageRange }) => {
          const colors     = YEAR_COLORS[yearGroup];
          const isRecep    = yearGroup === 0;
          return (
            <button
              key={yearGroup}
              className={`ob-year-card${isRecep ? ' ob-year-card--reception' : ''}`}
              style={{
                background:  colors.bg,
                borderColor: colors.border,
                boxShadow:   `3px 3px 0 ${colors.border}`,
                color:       '#1a1a2e',
              }}
              onClick={() => onSelect(yearGroup)}
            >
              <span className="ob-year-ages" style={{ color: colors.dark }}>
                Ages {ageRange[0]}–{ageRange[1]}
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
          <span className="ob-source-desc">We'll surprise you</span>
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

export function GeneratedWords({
  yearGroup,
  onConfirm,
  initialDyslexiaMode = false,
  showSupportToggle   = true,
  confirmLabel        = "Let's Play! ▶",
}) {
  const [count,        setCount]        = useState(10);
  const [extraSupport, setExtraSupport] = useState(initialDyslexiaMode);
  // Pre-fetch 20 so the 10/20 toggle is instant; re-run on mode or shuffle change
  const [result, setResult] = useState(() =>
    selectWords({ yearGroup, count: 20, dyslexiaMode: initialDyslexiaMode })
  );

  const words       = result.words.slice(0, count);
  const wordObjects = result.wordObjects.slice(0, count);

  const reshuffle = () =>
    setResult(selectWords({ yearGroup, count: 20, dyslexiaMode: extraSupport }));

  const handleExtraSupportToggle = (val) => {
    setExtraSupport(val);
    setResult(selectWords({ yearGroup, count: 20, dyslexiaMode: val }));
  };

  const groupMeta = YEAR_GROUPS.find((g) => g.yearGroup === yearGroup) || YEAR_GROUPS[1];

  return (
    <div className="ob-step ob-words">
      <div className="ob-step-header">
        <div className="ob-step-icon">🎉</div>
        <h2 className="ob-step-title">Your words!</h2>
        <p className="ob-step-sub">{groupMeta.label} · {words.length} words ready</p>
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

      {/* Extra Support Mode */}
      {showSupportToggle && (
        <label className="ob-support-toggle">
          <div className="ob-support-switch">
            <input
              type="checkbox"
              checked={extraSupport}
              onChange={(e) => handleExtraSupportToggle(e.target.checked)}
            />
            <span className="ob-support-slider" />
          </div>
          <div className="ob-support-text">
            <span className="ob-support-name">⭐ Extra Support Mode</span>
            <span className="ob-support-hint">Support your learning journey</span>
          </div>
        </label>
      )}

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
        <button
          className="ob-play-btn"
          onClick={() => onConfirm({ words, wordObjects, dyslexiaMode: extraSupport, sourceMode: 'generated' })}
        >
          {confirmLabel}
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

  // Called by GeneratedWords with { words, wordObjects, dyslexiaMode, sourceMode }
  // and by AddWordsManual (wrapped below) with sourceMode: 'manual'
  const handleConfirmWords = ({ words, wordObjects = [], dyslexiaMode = false, sourceMode = 'generated' }) => {
    const group = YEAR_GROUPS.find((g) => g.yearGroup === year);
    const age   = group?.ageRange[0] ?? 8;
    onComplete({ name, character, year, age, words, wordObjects, dyslexiaMode, sourceMode, difficulty: 'medium' });
  };

  const back = () => {
    if (step === 'character')                      setStep('name');
    else if (step === 'year')                      setStep('character');
    else if (step === 'source')                    setStep('year');
    else if (step === 'generate' || step === 'manual') setStep('source');
  };

  return (
    <div className="ob-wrap">
      <div className="ob-stars" aria-hidden="true">
        {STARS.map((s) => (
          <span
            key={s.id}
            className={`ob-star${s.dim ? ' ob-star--dim' : ''}`}
            style={{
              left:           `${s.left}%`,
              top:            `${s.top}%`,
              fontSize:       `${s.size}px`,
              animationDelay: `${s.delay}s`,
            }}
          >★</span>
        ))}
      </div>
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
          <GeneratedWords yearGroup={year} onConfirm={handleConfirmWords} />
        )}
        {step === 'manual' && (
          <div className="ob-step">
            <div className="ob-step-header">
              <div className="ob-step-icon">✏️</div>
              <h2 className="ob-step-title">Add your words</h2>
              <p className="ob-step-sub">Type one at a time · min 3 words</p>
            </div>
            <AddWordsManual
              onWordsReady={(words) =>
                handleConfirmWords({ words, wordObjects: [], dyslexiaMode: false, sourceMode: 'manual' })
              }
            />
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
