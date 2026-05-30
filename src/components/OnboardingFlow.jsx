import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import './OnboardingFlow.css';
import { YEAR_GROUPS, selectWords, getRuleGroups } from '../utils/wordSelectionEngine';
import { confidenceToDefaults } from '../data/spelling/sessionSchema';
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
        <h2 className="ob-step-title">What shall we call you?</h2>
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
  // Quick-start buddy model:
  //   • Raccoon is pre-selected by default — every guest gets the raccoon
  //     (it's the canonical buddy with the full sprite + cheer pose).
  //   • All other buddies render in the picker so kids can see the roster,
  //     but they're padlocked. Tapping one shows a brief "create a free
  //     account to unlock more buddies" toast — no selection occurs.
  //   • Tapping the raccoon plays the celebratory fanfare and advances
  //     to the next step. The Continue button advances immediately without
  //     a tap, since raccoon is already selected.
  const RACCOON = CHARACTERS.find((c) => c.id === 'raccoon') || CHARACTERS[0];

  const [showMore, setShowMore]   = useState(false);
  const [pickedId, setPickedId]   = useState(RACCOON.id);   // raccoon preselected
  const [lockToast, setLockToast] = useState(false);
  const lockToastTimer = useRef(null);

  const initialCharacters = CHARACTERS.slice(0, 7);
  const charactersToShow = showMore ? CHARACTERS : initialCharacters;

  const advance = () => {
    if (pickedId !== RACCOON.id) return;
    setPickedId(RACCOON.id);
    playBuddyFanfare();
    fireBuddyConfetti();
    setTimeout(() => onSelect(RACCOON), 1000);
  };

  const handleCardTap = (char) => {
    if (char.id === RACCOON.id) {
      advance();
      return;
    }
    // Locked buddy — flash the unlock-via-account hint.
    setLockToast(true);
    clearTimeout(lockToastTimer.current);
    lockToastTimer.current = setTimeout(() => setLockToast(false), 2000);
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

      {/* Hero row — raccoon is the centred featured card. */}
      <div className="ob-character-hero">
        <button
          type="button"
          className={`ob-character-card ob-character-card--hero${pickedId === RACCOON.id ? ' ob-character-card--picked' : ''}`}
          onClick={() => handleCardTap(RACCOON)}
          aria-label={RACCOON.name}
        >
          <span className={`ob-character-emoji${hasBuddyAvatar(RACCOON.id) ? ' ob-character-emoji--svg' : ''}`}>
            {hasBuddyAvatar(RACCOON.id)
              ? <BuddyAvatar id={RACCOON.id} size={84} />
              : RACCOON.emoji}
          </span>
          <span className="ob-character-name">{RACCOON.name}</span>
        </button>
      </div>

      {/* Locked grid — every other buddy, displayed beneath the hero. */}
      <div className={`ob-character-grid ob-character-grid--locked${showMore ? ' ob-character-grid--expanded' : ''}`} style={showMore ? { maxHeight: '320px', overflowY: 'auto', paddingRight: '8px' } : {}}>
        {charactersToShow
          .filter((char) => char.id !== RACCOON.id)
          .map((char) => (
            <button
              key={char.id}
              type="button"
              className="ob-character-card ob-character-card--locked"
              onClick={() => handleCardTap(char)}
              aria-disabled="true"
              aria-label={`${char.name} (locked)`}
            >
              <span className={`ob-character-emoji${hasBuddyAvatar(char.id) ? ' ob-character-emoji--svg' : ''}`}>
                {hasBuddyAvatar(char.id)
                  ? <BuddyAvatar id={char.id} size={56} />
                  : char.emoji}
              </span>
              <span className="ob-character-name">{char.name}</span>
              <span className="ob-character-lock" aria-hidden="true">🔒</span>
            </button>
          ))}
        {!showMore && (
          <button
            type="button"
            className="ob-character-card ob-character-card--show-more"
            onClick={() => setShowMore(true)}
          >
            <span className="ob-character-emoji">➕</span>
            <span className="ob-character-name">Show more</span>
          </button>
        )}
      </div>

      {/* Locked-buddy toast — brief inline message, no dismiss UI. */}
      <p className={`ob-character-locktoast${lockToast ? ' ob-character-locktoast--show' : ''}`}>
        Create a free account to unlock more buddies
      </p>

      {/* Continue button — available immediately because raccoon is
          pre-selected. Tapping it runs the same fanfare/advance flow. */}
      <div className="ob-confidence-actions">
        <button type="button" className="ob-play-btn" onClick={advance}>
          Continue →
        </button>
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

      {/* Friendly footnote for Reception — same word is used by parents
          when picking the option, so naming the year group keeps the note
          relevant rather than alarming. */}
      <p className="ob-year-note">
        Reception: best played with a grown-up nearby.
      </p>
    </div>
  );
}

// ── Step 4: Spelling confidence ────────────────────────────────────────────
//
// Final onboarding step. Three large emoji cards — picking one auto-derives
// `dyslexiaMode` + `difficulty` from `confidenceToDefaults()` and submits
// straight away. No Extra Support toggle and no SEN follow-up here — those
// are parent overrides exposed in Settings, not part of quick-start onboarding.
// `senProfile` defaults to [] on session creation.

const CONFIDENCE_OPTIONS = [
  // 🧐 is deliberate — focused / thinking, not anxious or distressed.
  { id: 'easy',         emoji: '🙂', label: 'Usually pretty easy' },
  { id: 'tricky',       emoji: '🤔', label: 'Sometimes easy, sometimes hard' },
  { id: 'often-tricky', emoji: '🧐', label: 'Often feels tricky' },
];

function ConfidencePicker({ name, onSubmit }) {
  const [picked, setPicked] = useState(null);

  const handlePick = (id) => {
    if (picked) return;          // ignore double-taps while transitioning
    setPicked(id);
    // Brief hold so the picked card flashes its selected state before
    // we generate words and advance to play.
    setTimeout(() => onSubmit({ spellingConfidence: id }), 350);
  };

  return (
    <div className="ob-step ob-confidence">
      <div className="ob-step-header">
        <h2 className="ob-step-title">
          How does spelling feel?
        </h2>
      </div>

      <div className="ob-confidence-grid">
        {CONFIDENCE_OPTIONS.map(opt => (
          <button
            key={opt.id}
            className={`ob-confidence-card${picked === opt.id ? ' ob-confidence-card--picked' : ''}`}
            onClick={() => handlePick(opt.id)}
            disabled={!!picked && picked !== opt.id}
            type="button"
          >
            <span className="ob-confidence-emoji" aria-hidden="true">{opt.emoji}</span>
            <span className="ob-confidence-label">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── GeneratedWords (exported, no longer used in quick-start flow) ─────────
// Still rendered by App.jsx's fallback path and by ExploreDashboard when a
// parent edits a list's words. The per-screen Extra Support toggle was
// removed (Settings is the canonical override) but the component still
// honours `initialDyslexiaMode` for selection.

export function GeneratedWords({
  yearGroup,
  onConfirm,
  initialDyslexiaMode = false,
}) {
  const [count,        setCount]        = useState(10);
  const [extraSupport] = useState(initialDyslexiaMode);

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

      {/* Extra Support Mode is no longer a per-screen toggle — parents
            manage it from Settings. Word selection still respects whatever
            `initialDyslexiaMode` was passed in. */}

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

// ── Step 5: Own lists? ─────────────────────────────────────────────────────
//
// Final onboarding step. Asks the parent whether they have their own
// word lists (school spellings, homework, etc.) they want to add.
// "Yes" → after onComplete, App.jsx routes to My Lists with the
// add-list flow opened. "Maybe later" → straight to Home.

function OwnListsStep({ name, character, onChoose }) {
  const buddyId = character?.id || 'raccoon';
  return (
    <div className="ob-step ob-own-lists">
      <div className="ob-step-header">
        {hasBuddyAvatar(buddyId) ? (
          <div className="ob-own-lists-buddy" aria-hidden="true">
            <BuddyAvatar id={buddyId} size={88} />
          </div>
        ) : (
          <div className="ob-step-icon">📝</div>
        )}
        <h2 className="ob-step-title">
          Do you have a spelling list to add?
        </h2>
        <p className="ob-step-sub">
          You can add school spellings, weekly words, or anything you like.
          Spellify will use them alongside the curriculum lists.
        </p>
      </div>

      <div className="ob-own-lists-grid">
        <button
          type="button"
          className="ob-own-lists-card ob-own-lists-card--primary"
          onClick={() => onChoose(true)}
        >
          <span className="ob-own-lists-emoji" aria-hidden="true">✨</span>
          <span className="ob-own-lists-label">Yes — add my own list</span>
          <span className="ob-own-lists-sub">Take me to add words now</span>
        </button>
        <button
          type="button"
          className="ob-own-lists-card"
          onClick={() => onChoose(false)}
        >
          <span className="ob-own-lists-emoji" aria-hidden="true">🏝️</span>
          <span className="ob-own-lists-label">Maybe later</span>
          <span className="ob-own-lists-sub">Just take me to the map</span>
        </button>
      </div>
    </div>
  );
}

// ── Main orchestrator ──────────────────────────────────────────────────────

function OnboardingFlow({ onComplete, initialName = '', initialCharacter = null, initialYear = null, startStep = 'name' }) {
  // 5-step quick start: name → character → year → confidence → ownLists.
  // The final "ownLists" step asks whether the parent has their own
  // word lists to add. If yes, App.jsx routes straight to the My Lists
  // add-flow after the session is created; if no, lands on Home.
  const [step,       setStep]       = useState(startStep);
  const [name,       setName]       = useState(initialName);
  const [character,  setCharacter]  = useState(initialCharacter);
  const [year,       setYear]       = useState(initialYear);
  const [confidence, setConfidence] = useState(null);

  const handleName      = (n) => { setName(n);      setStep('character');  };
  const handleCharacter = (c) => { setCharacter(c); setStep('year');       };
  const handleYear      = (y) => { setYear(y);      setStep('confidence'); };
  const handleConfidence = ({ spellingConfidence }) => {
    setConfidence(spellingConfidence);
    setStep('ownLists');
  };

  // Finalise — generate words inline from year + confidence mapping
  // and hand the session + the parent's lists choice back to App.jsx.
  const finishOnboarding = (wantAddList) => {
    const sc = confidence || 'tricky';
    const { dyslexiaMode, difficulty } = confidenceToDefaults(sc);
    const group = YEAR_GROUPS.find((g) => g.yearGroup === year);
    const age   = group?.ageRange[0] ?? 8;
    const result = selectWords({
      yearGroup:    year,
      count:        20,
      dyslexiaMode,
      groupBy:      'year',
      rule:         null,
    });
    onComplete({
      name, character, year, age,
      words:       result.words,
      wordObjects: result.wordObjects,
      dyslexiaMode,
      sourceMode:  'generated',
      ruleKey:     null,
      ruleLabel:   null,
      difficulty,
      spellingConfidence: sc,
      senProfile:  [],
      wantAddList,                // ← App.jsx routes off this flag
    });
  };

  const back = () => {
    if      (step === 'character')  setStep('name');
    else if (step === 'year')       setStep('character');
    else if (step === 'confidence') setStep('year');
    else if (step === 'ownLists')   setStep('confidence');
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
        {step === 'name'       && <NameInput      onSubmit={handleName}      />}
        {step === 'character'  && <CharacterPicker name={name} onSelect={handleCharacter} />}
        {step === 'year'       && <YearPicker     name={name} onSelect={handleYear} />}
        {step === 'confidence' && <ConfidencePicker name={name} onSubmit={handleConfidence} />}
        {step === 'ownLists'   && <OwnListsStep    name={name} character={character} onChoose={finishOnboarding} />}

        {step !== 'name' && (
          <button className="ob-back-btn" onClick={back}>← Back</button>
        )}
      </div>
    </div>
  );
}

export default OnboardingFlow;
