import { hasMorphology } from '../data/morphology';
import { getClueSync } from './clueResolver';

// Crossword needs enough clue-available words to make a meaningful puzzle.
// Sync check — getClueSync covers DEFINITIONS + word database (no API).
// Words that only resolve via the dictionary API count as clueless here
// so the gate is deterministic and doesn't depend on network.
const CROSSWORD_MIN_CLUE_WORDS = 6;
const CROSSWORD_LOCK_MESSAGE =
  'You need at least 6 words with definitions to play Crossword — keep adding words to unlock it.';

function countClueAvailable(words, year) {
  if (!Array.isArray(words)) return 0;
  let count = 0;
  for (const w of words) {
    const clue = getClueSync(w, year);
    if (typeof clue === 'string' && clue.trim().length > 0) count += 1;
  }
  return count;
}

// Single point of truth for "is this activity available right now?"
//
// Every UI surface that renders or launches an activity calls this
// function. Today it returns { available: true } for every activity
// in every context — every game is available for every word list,
// regardless of how the words were generated (random, manual entry,
// upload, curriculum list).
//
// FUTURE EXTENSION POINTS (currently no-ops, intentionally documented):
//
//   1. Paid plan gating
//      Add a check on `user.plan` (or similar). Free plans might get
//      e.g. wordsearch + memoryspell + hangman; paid plans get the
//      full set. Return { available: false, locked: true,
//      reason: 'paid', message: 'Upgrade to unlock this game' }.
//
//   2. Progression / unlock gating
//      Add a check on `session.activityStatuses` so a game only
//      unlocks once a prerequisite is completed. e.g. "Quiz Quest
//      unlocks after Memory Spell is done". Return locked: true with
//      reason: 'locked' and a message naming the prerequisite.
//
//   3. Age / word-list gating
//      Add a check on `session.year`, `session.ruleKey`, or the
//      content of `session.words`. e.g. "Word Forge requires words
//      with morphological structure — hidden for Y1 sessions" or
//      "Crossword needs ≥6 words". Return locked: true with reason:
//      'unsupported' and a message explaining why.
//
// All three return shapes follow the same contract so the UI can
// render the activity card consistently regardless of why it's locked.

/**
 * @typedef {Object} ActivityContext
 * @property {object|null}  session  the current session ({words, year, ruleKey, activityStatuses, ...})
 * @property {object|null}  user     the signed-in user (or null for guests)
 */

/**
 * @typedef {Object} ActivityAvailability
 * @property {boolean} available  true → can launch; false → blocked (still rendered, possibly locked)
 * @property {boolean} locked     true → show locked badge; false → fully open
 * @property {string|null} reason machine code describing the block ('paid' | 'locked' | 'unsupported' | null)
 * @property {string|null} message human-readable explanation (e.g. "Complete Memory Spell first")
 */

const OPEN = { available: true, locked: false, reason: null, message: null };

/**
 * Decide whether an activity is available for the given session/user.
 * Today every activity is open. Layer in restrictions here.
 *
 * @param {object} activity   an entry from src/data/activities.js
 * @param {ActivityContext} ctx
 * @returns {ActivityAvailability}
 */
export function getActivityAvailability(activity, ctx = {}) {
  // ── 0. Year-group gating ──────────────────────────────────────
  // Activities declare a [minYear, maxYear] range in src/data/activities.js.
  // Games outside the child's year are hidden entirely (reason:
  // 'unsupported') — ListHub's phaseActivities filter drops these from the
  // grid before rendering. This is how Reception sees only Word Search &
  // Memory Spell, and how Syllable Tap disappears for Y4+.
  const year = ctx.session?.year;
  if (typeof year === 'number') {
    if (typeof activity.minYear === 'number' && year < activity.minYear) {
      return { available: false, locked: true, reason: 'unsupported',
               message: 'Available in older year groups' };
    }
    if (typeof activity.maxYear === 'number' && year > activity.maxYear) {
      return { available: false, locked: true, reason: 'unsupported',
               message: 'Made for younger year groups' };
    }
  }

  // ── 1. Paid plan gating ───────────────────────────────────────
  // Example for the future:
  //   const FREE_GAMES = ['wordsearch', 'memoryspell', 'hangman'];
  //   if (ctx.user?.plan === 'free' && !FREE_GAMES.includes(activity.id)) {
  //     return { available: false, locked: true, reason: 'paid',
  //              message: 'Upgrade to unlock' };
  //   }

  // ── 2. Progression / unlock gating ────────────────────────────
  // Example for the future:
  //   const PREREQ = { quizquest: 'memoryspell', wordforge: 'writeit' };
  //   const prereq = PREREQ[activity.id];
  //   if (prereq && ctx.session?.activityStatuses?.[prereq] !== 'completed') {
  //     return { available: false, locked: true, reason: 'locked',
  //              message: `Finish ${prereq} first` };
  //   }

  // ── 3. Word-list gating ───────────────────────────────────────
  // Word Forge only makes sense for words with prefix/suffix structure.
  // Hide it entirely when no word in the session qualifies — better than
  // running the activity on unrelated words via a silent fallback.
  if (activity.id === 'wordforge') {
    const words = ctx.session?.words ?? [];
    if (!words.some(hasMorphology)) {
      return { available: false, locked: true, reason: 'unsupported',
               message: 'Needs prefix/suffix words' };
    }
  }

  // Crossword needs at least 6 clue-available words. Without enough
  // definitions the puzzle would have empty clue boxes — we keep the
  // card visible in a locked state so the child sees the unlock
  // criterion rather than the game vanishing from the grid. (Using
  // reason: 'locked' rather than 'unsupported' is what keeps the card
  // rendered — see ListHub's phaseActivities filter.)
  if (activity.id === 'crossword') {
    const words = ctx.session?.words ?? [];
    const year  = ctx.session?.year ?? null;
    if (countClueAvailable(words, year) < CROSSWORD_MIN_CLUE_WORDS) {
      return {
        available: false,
        locked:    true,
        reason:    'locked',
        message:   CROSSWORD_LOCK_MESSAGE,
      };
    }
  }

  return OPEN;
}

/**
 * True iff getActivityAvailability returns available: true.
 * Convenience for code paths that don't need the reason.
 */
export function isActivityAvailable(activity, ctx) {
  return getActivityAvailability(activity, ctx).available;
}
