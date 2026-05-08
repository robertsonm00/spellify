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

  // ── 3. Age / word-list gating ─────────────────────────────────
  // Example for the future:
  //   if (activity.id === 'crossword' && (ctx.session?.words?.length ?? 0) < 6) {
  //     return { available: false, locked: true, reason: 'unsupported',
  //              message: 'Need at least 6 words for a crossword' };
  //   }
  //   if (activity.id === 'wordforge' && ctx.session?.year === 1) {
  //     return { available: false, locked: true, reason: 'unsupported',
  //              message: 'Best from Year 3 onwards' };
  //   }

  return OPEN;
}

/**
 * True iff getActivityAvailability returns available: true.
 * Convenience for code paths that don't need the reason.
 */
export function isActivityAvailable(activity, ctx) {
  return getActivityAvailability(activity, ctx).available;
}
