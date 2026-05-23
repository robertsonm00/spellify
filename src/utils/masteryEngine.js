/**
 * Per-list, per-word mastery tracking — credit-based framework.
 *
 * Every result a child produces in a game is converted (in
 * `gamificationEngine.recordGameCompleted`) into a *credit* value:
 *
 *   correct, 1st attempt, no hint  →  +1.00
 *   correct, 1st attempt, hint     →  +0.75
 *   correct, 2nd attempt, no hint  →  +0.50
 *   correct, 2nd attempt, hint     →  +0.25
 *   incorrect after ≥2 attempts    →  −0.50  (struggling signal)
 *   other outcomes                 →   0     (e.g. one wrong try and moved on)
 *
 * Word Search is recognition (not recall), so its credits are scaled to
 * 0.5x in `recordGameCompleted` before reaching this layer.
 *
 * A word is mastered once both conditions hold:
 *   1. total accumulated credit ≥ 2.0
 *   2. credit came from ≥ 2 distinct game types
 *
 * Word state shape (current):
 *   {
 *     word, attempts, creditByGame: Record<game, number>, totalCredit,
 *     lastAttempted, mastered, spacedRepetition: false
 *   }
 *
 * Backward compatibility: states stored under the old shape
 * (`correctGames: string[]`) are migrated on read — each entry in
 * `correctGames` becomes 1.0 credit under that game in `creditByGame`.
 * This means legacy "correct in ≥2 games" mastery decisions are
 * preserved (each contributing 1.0 → 2.0 total).
 *
 * This engine is deliberately separate from `gamificationEngine.js` —
 * mastery is "what the child has learned"; gamification is "what they earn
 * for it". Keeping them separate so a future redesign of the points economy
 * doesn't risk corrupting learning state.
 */

const STORAGE_PREFIX = 'spellify_mastery_';
const DEFAULT_WINDOW_SIZE = 15;
const MASTERY_CREDIT_THRESHOLD = 2.0; // total credit needed to count as mastered
const MASTERY_GAME_DIVERSITY    = 2;  // must come from ≥ this many game types

const storageKey = (listId) => `${STORAGE_PREFIX}${listId}`;
const normalise  = (word) => String(word || '').toLowerCase().trim();

/* ── Empty-state factory ──────────────────────────────────────────────── */

function emptyState(listId) {
  return {
    listId,
    words: {},
    windowSize: DEFAULT_WINDOW_SIZE,
    progressionMode: 'open',         // 'open' | 'sequential' — sequential reserved
    lastUpdated: Date.now(),
  };
}

function emptyWord(word) {
  return {
    word,
    attempts: 0,
    creditByGame: {},        // { wordsearch: 0.5, crossword: 1.0, ... }
    totalCredit: 0,
    lastAttempted: 0,
    mastered: false,
    spacedRepetition: false,
  };
}

/**
 * Bring a stored word entry up to the current shape. Legacy entries used
 * `correctGames: string[]`; we treat each entry there as 1.0 credit (one
 * correct first attempt) so legacy mastery decisions hold.
 */
function migrateWord(stored) {
  if (!stored || typeof stored !== 'object') return null;
  const out = emptyWord(stored.word);
  out.attempts       = Number(stored.attempts) || 0;
  out.lastAttempted  = Number(stored.lastAttempted) || 0;
  out.spacedRepetition = !!stored.spacedRepetition;

  if (stored.creditByGame && typeof stored.creditByGame === 'object') {
    // Current shape — copy through.
    out.creditByGame = { ...stored.creditByGame };
  } else if (Array.isArray(stored.correctGames)) {
    // Legacy shape — promote each game name to 1.0 credit.
    for (const g of stored.correctGames) {
      if (typeof g === 'string') out.creditByGame[g] = (out.creditByGame[g] || 0) + 1.0;
    }
  }
  out.totalCredit = Object.values(out.creditByGame).reduce((s, v) => s + v, 0);
  out.mastered = isMastered(out);
  return out;
}

function isMastered(entry) {
  if (!entry) return false;
  if (entry.totalCredit < MASTERY_CREDIT_THRESHOLD) return false;
  // Only count game types that contributed positive credit toward diversity.
  const contributingGames = Object.entries(entry.creditByGame)
    .filter(([, v]) => v > 0)
    .length;
  return contributingGames >= MASTERY_GAME_DIVERSITY;
}

/* ── Storage ──────────────────────────────────────────────────────────── */

/**
 * Load the mastery state for a list. Returns an empty state if nothing is
 * stored. Safe against malformed JSON. Migrates legacy word shapes on read.
 */
export function getMasteryState(listId) {
  if (!listId) return emptyState('');
  try {
    const raw = localStorage.getItem(storageKey(listId));
    if (!raw) return emptyState(listId);
    const parsed = JSON.parse(raw);
    const words = {};
    const stored = parsed?.words || {};
    for (const [k, v] of Object.entries(stored)) {
      const migrated = migrateWord(v);
      if (migrated) words[k] = migrated;
    }
    return {
      ...emptyState(listId),
      ...parsed,
      words,
    };
  } catch {
    return emptyState(listId);
  }
}

/**
 * Persist a mastery state. Stamps `lastUpdated`. Silent on storage errors
 * (e.g. quota exceeded) — losing a single result is preferable to crashing
 * the activity.
 */
export function saveMasteryState(listId, state) {
  if (!listId) return;
  try {
    localStorage.setItem(
      storageKey(listId),
      JSON.stringify({ ...state, lastUpdated: Date.now() }),
    );
  } catch {
    /* localStorage full / disabled — ignore */
  }
}

/* ── Word-level updates ───────────────────────────────────────────────── */

/**
 * Record a single attempt for one word, adding the supplied `credit` to
 * the word's `creditByGame[gameName]`. Credit may be negative (struggling
 * signal). Mastery flips on once the total ≥ 2.0 AND credit has come
 * from ≥ 2 different game types.
 *
 * Returns `{ wordMastered, listCompleted }`. `listCompleted` is always
 * `false` here — true list completion is determined by the caller via
 * `getListProgressState(fullWordList, masteryState)` because the engine
 * doesn't know the full word list at this layer.
 *
 * The legacy 4-arg signature `recordWordResult(listId, word, gameName,
 * correctBool)` is still accepted: a `true` boolean is treated as 1.0
 * credit and `false` as 0. New call sites should pass an explicit number.
 */
export function recordWordResult(listId, word, gameName, credit) {
  if (!listId || !word || !gameName) return { wordMastered: false, listCompleted: false };

  // Backward compat: callers passing a boolean (legacy shape) get the
  // simplest mapping — true → 1.0 credit, false → 0 (no penalty).
  let creditAmount;
  if (typeof credit === 'boolean')      creditAmount = credit ? 1.0 : 0;
  else if (Number.isFinite(credit))     creditAmount = credit;
  else                                  creditAmount = 0;

  const state = getMasteryState(listId);
  const key   = normalise(word);
  const prev  = state.words[key] || emptyWord(word);

  const creditByGame = {
    ...prev.creditByGame,
    [gameName]: (prev.creditByGame[gameName] || 0) + creditAmount,
  };
  const totalCredit = Object.values(creditByGame).reduce((s, v) => s + v, 0);
  const updated = {
    ...prev,
    word,
    attempts: prev.attempts + 1,
    creditByGame,
    totalCredit,
    lastAttempted: Date.now(),
  };
  updated.mastered = isMastered(updated);

  const wordMastered = updated.mastered && !prev.mastered;

  state.words[key] = updated;
  saveMasteryState(listId, state);
  return { wordMastered, listCompleted: false };
}

/* ── Read helpers ─────────────────────────────────────────────────────── */

export function isWordMastered(listId, word) {
  const state = getMasteryState(listId);
  return !!state.words[normalise(word)]?.mastered;
}

export function getMasteredWords(listId) {
  const state = getMasteryState(listId);
  return Object.values(state.words)
    .filter(entry => entry.mastered)
    .map(entry => entry.word);
}

export function getUnmasteredWords(listId, fullWordList) {
  if (!Array.isArray(fullWordList)) return [];
  const state = getMasteryState(listId);
  return fullWordList.filter(w => !state.words[normalise(w)]?.mastered);
}

/**
 * Reset a list's mastery — useful for the "play this list again" flow once
 * the list is completed. Not called automatically.
 */
export function resetMasteryState(listId) {
  if (!listId) return;
  try { localStorage.removeItem(storageKey(listId)); } catch { /* ignore */ }
}

/* ── Test hooks ───────────────────────────────────────────────────────── */

// Exposed for unit tests / verification. Not part of the public surface
// that game / hub code should reach for.
export const _internals = {
  MASTERY_CREDIT_THRESHOLD,
  MASTERY_GAME_DIVERSITY,
  isMastered,
};
