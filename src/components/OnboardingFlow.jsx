import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import './OnboardingFlow.css';
import { YEAR_GROUPS, selectWords, getRuleGroups } from '../utils/wordSelectionEngine';
import { confidenceToDefaults } from '../data/spelling/sessionSchema';
import AddWordsManual from './AddWordsManual';
import BuddyAvatar, { hasBuddyAvatar } from './BuddyAvatar';

// ── Buddy-pick celebration ──────────────────────────────────────────────
// Triumphant ascending fanfare (C5 → E5 → G5 → C6) — kid-friendly "ta-da!"
function playBuddyFanfare() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const NOTES = [
      { f: 523.25, t: 0.00, d: 0.18, v: 0.18 },
      { f: 659.25, t: 0.10, d: 0.18, v: 0.20 },
      { f: 783.99, t: 0.20, d: 0.20, v: 0.22 },
      { f: 1046.5, t: 0.32, d: 0.55, v: 0.28 },
    ];
    NOTES.forEach(({ f, t, d, v }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = f;
      const at = ctx.currentTime + t;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(v, at + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, at + d);
      osc.start(at);
      osc.stop(at + d);
    });
  } catch { /* AudioContext unavailable */ }
}

function fireBuddyConfetti() {
  confetti({
    particleCount: 120,
    spread: 90,
    origin: { y: 0.5 },
    colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f43'],
  });
}

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
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: 0.5, y: 0.35 },
        colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f43'],
      });
      // Replace ASCII hyphens with U+2011 (NON-BREAKING HYPHEN) so names
      // like "Peter-Parker" never split across two lines anywhere downstream.
      // Visually identical, but the line-break rule ignores it.
      onSubmit(name.trim().replace(/-/g, '‑'));
    }
  };

  return (
    <div className="ob-step ob-name">
      <div className="ob-step-header">
        <div className="ob-step-icon">👋</div>
        <h2 className="ob-step-title">Who's playing?</h2>
        <p className="ob-step-sub">What should we call you?</p>
      </div>

      <form onSubmit={handleSubmit} className="ob-name-form">
        <input
          type="text"
          className="ob-name-input"
          placeholder="Type your name..."
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
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
  const [pickedId, setPickedId] = useState(null);

  const initialCharacters = CHARACTERS.slice(0, 7);
  const charactersToShow = showMore ? CHARACTERS : initialCharacters;

  const handlePick = (char) => {
    if (pickedId) return;            // ignore double-taps while celebrating
    setPickedId(char.id);
    playBuddyFanfare();
    fireBuddyConfetti();
    // Hold on the picked card for ~1s so the celebration is visible before
    // advancing to the next onboarding step.
    setTimeout(() => onSelect(char), 1000);
  };

  return (
    <div className="ob-step ob-character">
      <div className="ob-step-header">
        <h2 className="ob-step-title" style={{ paddingTop: '2.5rem' }}>
          Welcome <span style={{ whiteSpace: 'nowrap' }}>{name}</span>.
          <br />
          Choose your learning buddy.
        </h2>
      </div>

      <div className={`ob-character-grid${showMore ? ' ob-character-grid--expanded' : ''}`} style={showMore ? { maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' } : {}}>
        {charactersToShow.map((char) => (
          <button
            key={char.id}
            className={`ob-character-card${pickedId === char.id ? ' ob-character-card--picked' : ''}`}
            onClick={() => handlePick(char)}
            disabled={!!pickedId && pickedId !== char.id}
          >
            <span className={`ob-character-emoji${hasBuddyAvatar(char.id) ? ' ob-character-emoji--svg' : ''}`}>
              {hasBuddyAvatar(char.id)
                ? <BuddyAvatar id={char.id} size={56} />
                : char.emoji}
            </span>
            <span className="ob-character-name">{char.name}</span>
          </button>
        ))}
        {!showMore && (
          <button
            className="ob-character-card ob-character-card--show-more"
            onClick={() => setShowMore(true)}
            disabled={!!pickedId}
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
        <h2 className="ob-step-title">
          What's your age, <span style={{ whiteSpace: 'nowrap' }}>{name}</span>?
        </h2>
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

// ── Step 4: Spelling confidence + optional SEN follow-up ───────────────────
//
// Asked of every child between the year picker and the word-source picker
// so it's reached on BOTH the generated-words and manual-entry paths.
// Drives `spellingConfidence`, a default `dyslexiaMode` (via
// confidenceToDefaults), and an optional `senProfile` array.
//
// Important UX rules:
//   • The SEN follow-up is collapsed by default and entirely optional —
//     the child must be able to skip past it with no friction.
//   • Picking a confidence card never auto-advances; the parent might
//     want to also flip the Support Mode override or expand the SEN
//     section before moving on. "Continue" advances.

const CONFIDENCE_OPTIONS = [
  { id: 'easy',         emoji: '😊', label: 'Pretty easy most of the time' },
  { id: 'tricky',       emoji: '🤔', label: 'Sometimes tricky, sometimes okay' },
  { id: 'often-tricky', emoji: '😰', label: 'Often finds it tricky' },
];

const SEN_OPTIONS = [
  { id: 'dyslexia',            label: 'Dyslexia' },
  { id: 'dyscalculia',         label: 'Dyscalculia' },
  { id: 'adhd',                label: 'ADHD' },
  { id: 'other',               label: 'Other' },
  { id: 'prefer-not-to-say',   label: 'Prefer not to say' },
];

function ConfidencePicker({ name, initialConfidence, initialDyslexiaMode, initialSenProfile, onSubmit }) {
  const [confidence,   setConfidence]   = useState(initialConfidence || 'tricky');
  const [dyslexiaMode, setDyslexiaMode] = useState(initialDyslexiaMode || false);
  const [senProfile,   setSenProfile]   = useState(initialSenProfile || []);
  const [senOpen,      setSenOpen]      = useState(false);
  // Track whether the parent has manually overridden the Support Mode
  // toggle since the last confidence pick. If they haven't, switching
  // confidence auto-updates the toggle from confidenceToDefaults; if
  // they have, we leave their explicit choice alone.
  const [supportManual, setSupportManual] = useState(false);

  const pickConfidence = (id) => {
    setConfidence(id);
    if (!supportManual) {
      const { dyslexiaMode: derived } = confidenceToDefaults(id);
      setDyslexiaMode(derived || senProfile.includes('dyslexia'));
    }
  };

  const toggleSupport = (val) => {
    setDyslexiaMode(val);
    setSupportManual(true);
  };

  const toggleSen = (id) => {
    setSenProfile((prev) => {
      const has = prev.includes(id);
      let next  = has ? prev.filter(x => x !== id) : [...prev, id];
      // "Prefer not to say" is mutually exclusive with anything else.
      if (id === 'prefer-not-to-say' && !has) next = ['prefer-not-to-say'];
      else if (id !== 'prefer-not-to-say' && next.includes('prefer-not-to-say')) {
        next = next.filter(x => x !== 'prefer-not-to-say');
      }
      // If dyslexia is now on, force Support Mode on regardless of the
      // confidence-derived default. (Spec: dyslexia → dyslexiaMode true.)
      if (!has && id === 'dyslexia') setDyslexiaMode(true);
      return next;
    });
  };

  const handleContinue = () => {
    onSubmit({ spellingConfidence: confidence, dyslexiaMode, senProfile });
  };

  return (
    <div className="ob-step ob-confidence">
      <div className="ob-step-header">
        <h2 className="ob-step-title">
          How does <span style={{ whiteSpace: 'nowrap' }}>{name}</span> find spelling?
        </h2>
      </div>

      <div className="ob-confidence-grid">
        {CONFIDENCE_OPTIONS.map(opt => (
          <button
            key={opt.id}
            className={`ob-confidence-card${confidence === opt.id ? ' ob-confidence-card--picked' : ''}`}
            onClick={() => pickConfidence(opt.id)}
            type="button"
          >
            <span className="ob-confidence-emoji" aria-hidden="true">{opt.emoji}</span>
            <span className="ob-confidence-label">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Extra Support Mode — auto-derived from confidence answer, but
            parent can override before continuing. */}
      <label className="ob-support-toggle ob-support-toggle--inline">
        <div className="ob-support-switch">
          <input
            type="checkbox"
            checked={dyslexiaMode}
            onChange={(e) => toggleSupport(e.target.checked)}
          />
          <span className="ob-support-slider" />
        </div>
        <div className="ob-support-text">
          <span className="ob-support-name">⭐ Extra Support Mode</span>
          <span className="ob-support-hint">Bigger fonts, simpler words, gentler activities</span>
        </div>
      </label>

      {/* Optional, collapsible SEN follow-up. Genuinely skippable. */}
      <details
        className="ob-sen-details"
        open={senOpen}
        onToggle={(e) => setSenOpen(e.currentTarget.open)}
      >
        <summary className="ob-sen-summary">
          <span className="ob-sen-summary-plus">+</span>
          <span>
            Does <span style={{ whiteSpace: 'nowrap' }}>{name}</span> have any
            additional learning needs?{' '}
            <span className="ob-sen-summary-optional">(optional)</span>
          </span>
        </summary>
        <div className="ob-sen-options">
          {SEN_OPTIONS.map(opt => (
            <label key={opt.id} className="ob-sen-option">
              <input
                type="checkbox"
                checked={senProfile.includes(opt.id)}
                onChange={() => toggleSen(opt.id)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </details>

      <div className="ob-confidence-actions">
        <button className="ob-play-btn" onClick={handleContinue} type="button">
          Continue →
        </button>
      </div>
    </div>
  );
}

// ── Step 5: Word source choice ─────────────────────────────────────────────

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
}) {
  const [count,        setCount]        = useState(10);
  const [extraSupport, setExtraSupport] = useState(initialDyslexiaMode);

  // RULE_BUCKET_PICKER ── Y1/Y2 can practise by phonics rule instead of by year
  const ruleBuckets   = getRuleGroups(yearGroup);
  const [groupBy,     setGroupBy] = useState('year');             // 'year' | 'rule'
  const [ruleKey,     setRuleKey] = useState(ruleBuckets[0]?.key || null);
  const ruleLabel     = ruleBuckets.find((b) => b.key === ruleKey)?.label || null;

  const buildArgs = (overrides = {}) => ({
    yearGroup,
    count: 20,
    dyslexiaMode: extraSupport,
    groupBy,
    rule: groupBy === 'rule' ? ruleKey : null,
    ...overrides,
  });

  const [result, setResult] = useState(() =>
    selectWords(buildArgs({ dyslexiaMode: initialDyslexiaMode, groupBy: 'year', rule: null }))
  );

  const words       = result.words.slice(0, count);
  const wordObjects = result.wordObjects.slice(0, count);

  const reshuffle = () =>
    setResult(selectWords(buildArgs()));

  const handleExtraSupportToggle = (val) => {
    setExtraSupport(val);
    setResult(selectWords(buildArgs({ dyslexiaMode: val })));
  };

  const handleGroupByChange = (mode) => {
    setGroupBy(mode);
    setResult(selectWords(buildArgs({ groupBy: mode, rule: mode === 'rule' ? ruleKey : null })));
  };

  const handleRuleChange = (key) => {
    setRuleKey(key);
    setResult(selectWords(buildArgs({ groupBy: 'rule', rule: key })));
  };

  const groupMeta = YEAR_GROUPS.find((g) => g.yearGroup === yearGroup) || YEAR_GROUPS[1];

  return (
    <div className="ob-step ob-words">
      <div className="ob-step-header">
        <div className="ob-step-icon">🎉</div>
        <h2 className="ob-step-title">Your words!</h2>
        <p className="ob-step-sub">{groupMeta.label} · {words.length} words ready</p>
      </div>

      {/* RULE_BUCKET_PICKER ── By year / By rule (Y1 & Y2 only) */}
      {ruleBuckets.length > 0 && (
        <div className="ob-rule-picker">
          <div className="ob-rule-toggle">
            <button
              className={`ob-rule-toggle-btn${groupBy === 'year' ? ' ob-rule-toggle-btn--active' : ''}`}
              onClick={() => handleGroupByChange('year')}
            >
              By year
            </button>
            <button
              className={`ob-rule-toggle-btn${groupBy === 'rule' ? ' ob-rule-toggle-btn--active' : ''}`}
              onClick={() => handleGroupByChange('rule')}
            >
              By spelling rule
            </button>
          </div>
          {groupBy === 'rule' && (
            <div className="ob-rule-chips">
              {ruleBuckets.map(({ key, label }) => (
                <button
                  key={key}
                  className={`ob-rule-chip${ruleKey === key ? ' ob-rule-chip--active' : ''}`}
                  onClick={() => handleRuleChange(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
          onClick={() => onConfirm({
            words,
            wordObjects,
            dyslexiaMode: extraSupport,
            sourceMode: 'generated',
            ruleKey:   groupBy === 'rule' ? ruleKey   : null,
            ruleLabel: groupBy === 'rule' ? ruleLabel : null,
          })}
        >
          Let's Play! ▶
        </button>
      </div>
    </div>
  );
}

// ── Main orchestrator ──────────────────────────────────────────────────────

function OnboardingFlow({ onComplete, initialName = '', initialCharacter = null, initialYear = null, startStep = 'name' }) {
  // step flow: name → character → year → confidence → source → generate | manual
  const [step, setStep]         = useState(startStep);
  const [name, setName]         = useState(initialName);
  const [character, setCharacter] = useState(initialCharacter);
  const [year, setYear]         = useState(initialYear);
  // Confidence step state — drives default dyslexiaMode + difficulty.
  // Stored at the OnboardingFlow level so both the generate and manual
  // branches can consume them on submit (fixes the previous
  // manual-path bug that hardcoded dyslexiaMode: false).
  const [spellingConfidence, setSpellingConfidence] = useState('tricky');
  const [dyslexiaMode,       setDyslexiaMode]       = useState(false);
  const [senProfile,         setSenProfile]         = useState([]);

  const handleName = (n) => { setName(n); setStep('character'); };
  const handleCharacter = (c) => { setCharacter(c); setStep('year'); };
  const handleYear = (y) => { setYear(y); setStep('confidence'); };
  const handleConfidence = ({ spellingConfidence: sc, dyslexiaMode: dm, senProfile: sen }) => {
    setSpellingConfidence(sc);
    setDyslexiaMode(dm);
    setSenProfile(sen);
    setStep('source');
  };

  // Called by GeneratedWords with { words, wordObjects, dyslexiaMode (latest), sourceMode, ruleKey?, ruleLabel? }
  // and by AddWordsManual (wrapped below) with sourceMode: 'manual'.
  //
  // dyslexiaMode flows in here from the most recent source:
  //   - generate path: GeneratedWords' own toggle (initialised from this
  //     component's state) — latest local override wins
  //   - manual path: this component's state (set during the confidence step)
  const handleConfirmWords = ({ words, wordObjects = [], dyslexiaMode: dmFromStep, sourceMode = 'generated', ruleKey = null, ruleLabel = null }) => {
    const group = YEAR_GROUPS.find((g) => g.yearGroup === year);
    const age   = group?.ageRange[0] ?? 8;
    // Use step-supplied dyslexiaMode if provided (generate path); otherwise
    // fall back to our state (manual path).
    const finalDyslexia = typeof dmFromStep === 'boolean' ? dmFromStep : dyslexiaMode;
    // If senProfile includes dyslexia, force Support Mode on regardless.
    const dyslexiaModeOut = finalDyslexia || senProfile.includes('dyslexia');
    const { difficulty } = confidenceToDefaults(spellingConfidence);
    onComplete({
      name, character, year, age,
      words, wordObjects,
      dyslexiaMode: dyslexiaModeOut,
      sourceMode, ruleKey, ruleLabel,
      difficulty,
      spellingConfidence,
      senProfile,
    });
  };

  const back = () => {
    if (step === 'character')                      setStep('name');
    else if (step === 'year')                      setStep('character');
    else if (step === 'confidence')                setStep('year');
    else if (step === 'source')                    setStep('confidence');
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
        {step === 'name'      && <NameInput onSubmit={handleName} />}
        {step === 'character' && <CharacterPicker name={name} onSelect={handleCharacter} />}
        {step === 'year'      && <YearPicker name={name} onSelect={handleYear} />}
        {step === 'confidence' && (
          <ConfidencePicker
            name={name}
            initialConfidence={spellingConfidence}
            initialDyslexiaMode={dyslexiaMode}
            initialSenProfile={senProfile}
            onSubmit={handleConfidence}
          />
        )}
        {step === 'source'    && (
          <WordSourcePicker
            onGenerate={() => setStep('generate')}
            onManual={() => setStep('manual')}
          />
        )}
        {step === 'generate' && year !== null && (
          <GeneratedWords
            yearGroup={year}
            initialDyslexiaMode={dyslexiaMode}
            onConfirm={handleConfirmWords}
          />
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
                // Pass dyslexiaMode through from the confidence step state
                // (was previously hardcoded to false). handleConfirmWords
                // also folds in senProfile.includes('dyslexia') as a
                // belt-and-braces override.
                handleConfirmWords({ words, wordObjects: [], sourceMode: 'manual' })
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
