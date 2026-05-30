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
//   minYear,maxYear  inclusive year-group bounds (Reception = 0, Y1 = 1, …).
//                 Read by activityAvailability — a game whose minYear is
//                 above or maxYear is below the session's year is silently
//                 hidden from the hub grid (reason: 'unsupported').
//   component     the React component to render
//   buildProps    (session) → extra props to pass to the component
//                 (the canonical {words, dyslexiaMode,
//                 savedProgress, onSaveProgress, onComplete, onExit}
//                 shape is added by App.jsx automatically — only list
//                 game-specific extras here, e.g. childName, userAge)

import WordSearch  from '../components/WordSearch';
import MemorySpell from '../components/MemorySpell';
import MemoryMatch from '../components/MemoryMatch';
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
    minYear: 0, maxYear: 6,
    buildProps: (s) => ({ year: s.year ?? null }),
  },
  {
    id: 'memoryspell', name: 'Memory Spell', icon: '🧠',
    timeEstimate: '5 mins', color: '#b8e4be', dark: '#5fa269',
    phase: 'warmup', component: MemorySpell,
    minYear: 0, maxYear: 6,
    buildProps: (s) => ({
      wordObjects: s.wordObjects || [],
      childCharacter: s.childCharacter || null,
    }),
  },
  {
    id: 'hangman', name: 'Spell Duel', icon: '⚔️',
    timeEstimate: '5 mins', color: '#d4b8f5', dark: '#7c3aed',
    phase: 'warmup', component: SpellDuel,
    minYear: 1, maxYear: 6,
    buildProps: (s) => ({ difficulty: s.difficulty || 'medium', yearGroup: s.year ?? null }),
  },
  {
    id: 'memorymatch', name: 'Memory Match', icon: '🃏',
    timeEstimate: '5 mins', color: '#d4b8f5', dark: '#6a3aa3',
    phase: 'warmup', component: MemoryMatch,
    minYear: 0, maxYear: 6,
    buildProps: () => ({}),
  },
  {
    id: 'syllabletap', name: 'Syllable Tap', icon: '👂',
    /* Aqua — distinct from Memory Spell's mint so the two warm-up panels
       don't read as the same colour. */
    timeEstimate: '5 mins', color: '#a8e0e0', dark: '#4a9da8',
    phase: 'warmup', component: SyllableTap,
    minYear: 1, maxYear: 3,
    buildProps: () => ({}),
  },

  // ── Explore: active production with cues ────────────────────────
  {
    id: 'writeit', name: 'Write It', icon: '✏️',
    /* Coral — keeps Spell Duel as the only purple game and gives the
     "Explore" phase its own warm anchor. */
    timeEstimate: '10 mins', color: '#f5c2b8', dark: '#c95d4d',
    phase: 'explore', component: WriteIt,
    minYear: 1, maxYear: 6,
    buildProps: (s) => ({ childName: s.childName || '' }),
  },
  {
    id: 'weakspot', name: 'Weak Spot', icon: '🎯',
    timeEstimate: '5 mins', color: '#fbe1a4', dark: '#b88828',
    phase: 'explore', component: WeakSpot,
    minYear: 2, maxYear: 6,
    buildProps: (s) => ({ childCharacter: s.childCharacter || null }),
  },
  {
    id: 'crossword', name: 'Crossword', icon: '✏️',
    /* Soft lime/sage — distinct from the mint of Memory Spell and aqua of
     Syllable Tap so the trio of green-family tiles each read differently. */
    timeEstimate: '10 mins', color: '#d4ea9c', dark: '#7a9a3d',
    phase: 'explore', component: Crossword,
    minYear: 1, maxYear: 6,
    // year is forwarded so Crossword can auto-read clues for Y1 children
    // (reading help — they may spell well but not yet decode the clue).
    buildProps: (s) => ({ userAge: s.age || 8, difficulty: s.difficulty || 'medium', year: s.year ?? null }),
  },

  // ── Consolidate: generative / creative recall ───────────────────
  {
    id: 'quizquest', name: 'Quiz Quest', icon: '🏆',
    timeEstimate: '5 mins', color: '#f5b9d3', dark: '#c95d8a',
    phase: 'consolidate', component: QuizQuest,
    minYear: 1, maxYear: 6,
    buildProps: (s) => ({ wordObjects: s.wordObjects || [], year: s.year ?? null }),
  },
  {
    id: 'wordforge', name: 'Word Forge', icon: '🔨',
    timeEstimate: '5 mins', color: '#fbc4a3', dark: '#c25e30',
    phase: 'consolidate', component: WordForge,
    minYear: 2, maxYear: 6,
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
