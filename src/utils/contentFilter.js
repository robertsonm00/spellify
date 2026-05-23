/**
 * Content-safety filter for every word entry point in Spellify.
 *
 * Runs every word through `leo-profanity` (English dictionary, UK-aware,
 * basic obfuscation handling) before the word is accepted into a list,
 * a game, or the OCR review pane.
 *
 * Curriculum exceptions: a handful of words are commonly profane in
 * other contexts but appear in UK primary spellings (e.g. "hell"
 * referenced in many curriculum lists). They are explicitly allowed.
 *
 * Blocked attempts are logged silently to localStorage so the team can
 * review patterns later; the child never sees the rejected word.
 */
import filter from 'leo-profanity';

filter.loadDictionary('en');

// Extra words to block beyond the leo-profanity dictionary. Add as needed.
const ADDITIONAL_BLOCKED = [];

// Words that the default dictionary flags but are legitimate in a UK
// primary curriculum context. Leaving the rationale next to each entry
// so future tuning can revisit.
const CURRICULUM_EXCEPTIONS = [
  'ass',   // donkey / curriculum literature references
  'damn',  // appears in classic texts taught at KS2
  'hell',  // common in narrative writing prompts
  'die',   // verb conjugations, biology, narrative
  'kill',  // narrative writing, history
  'sex',   // biology (Y5/6 PSHE / science)
];

filter.add(ADDITIONAL_BLOCKED);
filter.remove(CURRICULUM_EXCEPTIONS);

/**
 * True when the word passes the safety filter. Case-insensitive.
 */
export function isSafeWord(word) {
  if (typeof word !== 'string' || !word.trim()) return true;
  return !filter.check(word.toLowerCase());
}

/**
 * Drops every unsafe word from `words`. Caller is responsible for
 * logging dropped attempts if it wants attribution.
 */
export function sanitiseWordList(words) {
  if (!Array.isArray(words)) return [];
  return words.filter((w) => isSafeWord(w));
}

const STORAGE_KEY = 'spellify_blocked_attempts';

/**
 * Silently records a blocked attempt for later review. `source` is a
 * short string identifying the entry point (e.g. 'manual', 'ocr',
 * 'custom-list', 'ocr-manual', 'unknown-word').
 */
export function logBlockedAttempt(word, source) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (typeof word !== 'string' || !word.trim()) return;
  let log;
  try {
    log = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(log)) log = [];
  } catch {
    log = [];
  }
  const normalised = word.toLowerCase();
  const existing = log.find((e) => e.word === normalised);
  const now = Date.now();
  if (existing) {
    existing.count += 1;
    existing.lastSeen = now;
  } else {
    log.push({ word: normalised, firstSeen: now, lastSeen: now, count: 1, source });
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    /* storage full / disabled — fail silently per spec */
  }
}

/**
 * Returns the blocked-attempt log sorted by count (descending).
 */
export function getBlockedAttemptLog() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const log = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(log)) return [];
    return log.slice().sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

// ── Unknown-word logger ─────────────────────────────────────────────────────
//
// When the 3-step dictionary chain (DEFINITIONS → wordLookup → external API)
// can't resolve a definition for a word the child is asked to learn, we
// record it so the team can fill the gap later. Unsafe words skip this
// list entirely and are routed to the blocked-attempts log instead — we
// don't want anything offensive surfaced on a curriculum-gap report.

const UNKNOWN_KEY = 'spellify_unknown_words';

/**
 * Records a word that the dictionary chain couldn't define. `source` is a
 * short string identifying the lookup context (e.g. 'clue-resolver',
 * 'word-info').
 *
 * If the word fails the safety filter, this routes to the blocked-attempt
 * log only — it never appears in the unknown-words gap report.
 */
export function logUnknownWord(word, source = 'clue-resolver') {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (typeof word !== 'string' || !word.trim()) return;

  if (!isSafeWord(word)) {
    logBlockedAttempt(word, source);
    return;
  }

  let log;
  try {
    log = JSON.parse(localStorage.getItem(UNKNOWN_KEY) || '[]');
    if (!Array.isArray(log)) log = [];
  } catch {
    log = [];
  }
  const normalised = word.toLowerCase();
  const existing = log.find((e) => e.word === normalised);
  const now = Date.now();
  if (existing) {
    existing.count += 1;
    existing.lastSeen = now;
  } else {
    log.push({ word: normalised, firstSeen: now, lastSeen: now, count: 1, source });
  }
  try {
    localStorage.setItem(UNKNOWN_KEY, JSON.stringify(log));
  } catch {
    /* storage full / disabled — fail silently */
  }
}

/**
 * Returns the unknown-words gap log sorted by count (descending).
 */
export function getUnknownWordLog() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const log = JSON.parse(localStorage.getItem(UNKNOWN_KEY) || '[]');
    if (!Array.isArray(log)) return [];
    return log.slice().sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}
