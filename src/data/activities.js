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
//                 (the canonical {words, dyslexiaMode, hideTopbar,
//                 savedProgress, onSaveProgress, onComplete, onExit}
//                 shape is added by App.jsx automatically — only list
//                 game-specific extras here, e.g. childName, userAge)

import WordSearch  from '../components/WordSearch';
import MemorySpell from '../components/MemorySpell';
import Hangman     from '../components/Hangman';
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
    timeEstimate: '5 mins', color: '#4d96ff', dark: '#1a5cbf',
    phase: 'warmup', component: WordSearch,
    buildProps: () => ({}),
  },
  {
    id: 'memoryspell', name: 'Memory Spell', icon: '🧠',
    timeEstimate: '5 mins', color: '#6bcb77', dark: '#1e7e34',
    phase: 'warmup', component: MemorySpell,
    buildProps: (s) => ({ wordObjects: s.wordObjects || [] }),
  },
  {
    id: 'hangman', name: 'Hangman', icon: '🎯',
    timeEstimate: '5 mins', color: '#ff9f43', dark: '#c05700',
    phase: 'warmup', component: Hangman,
    buildProps: (s) => ({ difficulty: s.difficulty || 'medium' }),
  },
  {
    id: 'syllabletap', name: 'Syllable Tap', icon: '👂',
    timeEstimate: '5 mins', color: '#34d399', dark: '#0e7c52',
    phase: 'warmup', component: SyllableTap,
    buildProps: () => ({}),
  },

  // ── Explore: active production with cues ────────────────────────
  {
    id: 'writeit', name: 'Write It', icon: '✏️',
    timeEstimate: '10 mins', color: '#a855f7', dark: '#581c87',
    phase: 'explore', component: WriteIt,
    buildProps: (s) => ({ childName: s.childName || '' }),
  },
  {
    id: 'weakspot', name: 'Weak Spot', icon: '🎯',
    timeEstimate: '5 mins', color: '#fbbf24', dark: '#92400e',
    phase: 'explore', component: WeakSpot,
    buildProps: () => ({}),
  },
  {
    id: 'crossword', name: 'Crossword', icon: '✏️',
    timeEstimate: '10 mins', color: '#c77dff', dark: '#6b21a8',
    phase: 'explore', component: Crossword,
    buildProps: (s) => ({ userAge: s.age || 8, difficulty: s.difficulty || 'medium' }),
  },

  // ── Consolidate: generative / creative recall ───────────────────
  {
    id: 'quizquest', name: 'Quiz Quest', icon: '🏆',
    timeEstimate: '5 mins', color: '#ec4899', dark: '#9d174d',
    phase: 'consolidate', component: QuizQuest,
    buildProps: (s) => ({ wordObjects: s.wordObjects || [] }),
  },
  {
    id: 'wordforge', name: 'Word Forge', icon: '🔨',
    timeEstimate: '5 mins', color: '#f97316', dark: '#9a3412',
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
