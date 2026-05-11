// Canonical activity registry — the single source of truth for which
// games exist in Spellify. Adding a new game means adding ONE entry
// to this array; INITIAL_STATUSES, the hub grid, and the App.jsx
// activity router all derive from this.
//
// Each entry shape:
//   id            unique key, used as the activityStatuses key and route id
//   name          display name on the hub card
//   icon          emoji shown on the card
//   color, dark   hub-card colours (header bg, border)
//   timeEstimate  shown on the card
//   phase         'warmup' | 'explore' | 'consolidate' — drives section order
//   component     the React component to render
//   buildProps    (session) → extra props to pass to the component
//                 (the canonical {words, dyslexiaMode,
//                 savedProgress, onSaveProgress, onComplete, onExit}
//                 shape is added by App.jsx automatically — only list
//                 game-specific extras here, e.g. childName, userAge)

import WordSearch  from '../components/WordSearch';
import MemorySpell from '../components/MemorySpell';
import SpellDuel   from '../components/SpellDuel';
import Crossword   from '../components/Crossword';
import WriteIt     from '../components/WriteIt';
import QuizQuest   from '../components/QuizQuest';
import SyllableTap from '../components/activities/SyllableTap';
import WordForge   from '../components/activities/WordForge';
import WeakSpot    from '../components/activities/WeakSpot';

export const ACTIVITIES = [
  // ── Warm-Up: low-stakes recognition ─────────────────────────────
  {
    id: 'wordsearch', name: 'Word Search', icon: '🔍',
    timeEstimate: '5 mins', color: '#b3d4f5', dark: '#4d80c8',
    phase: 'warmup', component: WordSearch,
    buildProps: (s) => ({ year: s.year ?? null }),
  },
  {
    id: 'memoryspell', name: 'Memory Spell', icon: '🧠',
    timeEstimate: '5 mins', color: '#b8e4be', dark: '#5fa269',
    phase: 'warmup', component: MemorySpell,
    buildProps: (s) => ({
      wordObjects: s.wordObjects || [],
      childCharacter: s.childCharacter || null,
    }),
  },
  {
    id: 'hangman', name: 'Spell Duel', icon: '⚔️',
    timeEstimate: '5 mins', color: '#d4b8f5', dark: '#7c3aed',
    phase: 'warmup', component: SpellDuel,
    buildProps: (s) => ({ difficulty: s.difficulty || 'medium', yearGroup: s.year ?? null }),
  },
  {
    id: 'syllabletap', name: 'Syllable Tap', icon: '👂',
    timeEstimate: '5 mins', color: '#9fdfc4', dark: '#4f9d80',
    phase: 'warmup', component: SyllableTap,
    buildProps: () => ({}),
  },

  // ── Explore: active production with cues ────────────────────────
  {
    id: 'writeit', name: 'Write It', icon: '✏️',
    timeEstimate: '10 mins', color: '#d9c0f7', dark: '#8c5fc9',
    phase: 'explore', component: WriteIt,
    buildProps: (s) => ({ childName: s.childName || '' }),
  },
  {
    id: 'weakspot', name: 'Weak Spot', icon: '🎯',
    timeEstimate: '5 mins', color: '#fbe1a4', dark: '#b88828',
    phase: 'explore', component: WeakSpot,
    buildProps: (s) => ({ childCharacter: s.childCharacter || null }),
  },
  {
    id: 'crossword', name: 'Crossword', icon: '✏️',
    timeEstimate: '10 mins', color: '#e2c5f5', dark: '#9a5dc7',
    phase: 'explore', component: Crossword,
    buildProps: (s) => ({ userAge: s.age || 8, difficulty: s.difficulty || 'medium' }),
  },

  // ── Consolidate: generative / creative recall ───────────────────
  {
    id: 'quizquest', name: 'Quiz Quest', icon: '🏆',
    timeEstimate: '5 mins', color: '#f5b9d3', dark: '#c95d8a',
    phase: 'consolidate', component: QuizQuest,
    buildProps: (s) => ({ wordObjects: s.wordObjects || [] }),
  },
  {
    id: 'wordforge', name: 'Word Forge', icon: '🔨',
    timeEstimate: '5 mins', color: '#fbc4a3', dark: '#c25e30',
    phase: 'consolidate', component: WordForge,
    buildProps: () => ({}),
  },
];

export const PHASES = [
  { key: 'warmup',      label: 'Warm-Up',     hint: 'Spot the words' },
  { key: 'explore',     label: 'Explore',     hint: 'Try writing them' },
  { key: 'consolidate', label: 'Consolidate', hint: 'Show what you know' },
];

/** Lookup an activity by id. Returns null if unknown. */
export function getActivity(id) {
  return ACTIVITIES.find((a) => a.id === id) || null;
}

/** Display title for an activity id, or the id itself if unknown. */
export function getActivityTitle(id) {
  return getActivity(id)?.name || id;
}
