/**
 * Per-list, per-word mastery tracking.
 *
 * A word is "mastered" when it has been answered correctly across two or
 * more *distinct* activity types (e.g. correct in quizQuest AND wordSearch).
 * The mastery state lives in localStorage under `spellify_mastery_${listId}`
 * so each list (curriculum or custom) tracks its own progress independently.
 *
 * Word state shape:
 *   {
 *     word, attempts, correctGames: string[],
 *     lastAttempted, mastered, spacedRepetition: false
 *   }
 *
 * This engine is deliberately separate from `gamificationEngine.js` —
 * mastery is "what the child has learned"; gamification is "what they earn
 * for it". Keeping them separate so a future redesign of the points economy
 * doesn't risk corrupting learning state.
 */

const STORAGE_PREFIX = 'spellify_mastery_';
const DEFAULT_WINDOW_SIZE = 15;
const MASTERY_GAME_THRESHOLD = 2;   // number of distinct games needed to master

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

/* ── Storage ──────────────────────────────────────────────────────────── */

/**
 * Load the mastery state for a list. Returns an empty state if nothing is
 * stored. Safe against malformed JSON.
 */
export function getMasteryState(listId) {
  if (!listId) return emptyState('');
  try {
    const raw = localStorage.getItem(storageKey(listId));
    if (!raw) return emptyState(listId);
    const parsed = JSON.parse(raw);
    return {
      ...emptyState(listId),
      ...parsed,
      words: parsed?.words || {},
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
 * Record a single attempt for one word. Updates attempt count, tracks the
 * game in `correctGames` if the answer was correct, and flips `mastered`
 * once the threshold is met.
 *
 * Returns `{ wordMastered, listCompleted }`. `listCompleted` is always
 * `false` here — true list completion is determined by the caller via
 * `getListProgressState(fullWordList, masteryState)` because the engine
 * doesn't know the full word list at this layer.
 */
export function recordWordResult(listId, word, gameName, correct) {
  if (!listId || !word || !gameName) return { wordMastered: false, listCompleted: false };
  const state = getMasteryState(listId);
  const key   = normalise(word);
  const prev  = state.words[key] || {
    word,
    attempts: 0,
    correctGames: [],
    lastAttempted: 0,
    mastered: false,
    spacedRepetition: false,
  };

  // Only add the game name once per word — diversity of games is the signal.
  const correctGames = (correct && !prev.correctGames.includes(gameName))
    ? [...prev.correctGames, gameName]
    : prev.correctGames;

  const masteredNow = correctGames.length >= MASTERY_GAME_THRESHOLD;
  const wordMastered = masteredNow && !prev.mastered;

  state.words[key] = {
    ...prev,
    word,
    attempts: prev.attempts + 1,
    correctGames,
    lastAttempted: Date.now(),
    mastered: masteredNow,
  };

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
