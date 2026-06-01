/**
 * wordLookup — single source of truth for rich per-word DATA.
 *
 * CORPUS PROTECTION (2026-06): the full curated corpus (~6,750 entries /
 * ~4.5 MB) is no longer bundled. The browser ships only the Tier-1 set
 * (src/data/statutoryTier1.js — every statutory word plus every word the
 * offline picker `selectWords` can surface, ~327 entries / ~216 KB). The
 * wider corpus lives server-side behind the get-word-list Edge Function and
 * is fetched on demand (see docs/CORPUS_PROTECTION_DESIGN.md).
 *
 * Lookups are case-insensitive. Words outside Tier-1 (and not yet primed via
 * `primeWords`) return null / sensible empties — callers MUST fall back
 * gracefully. In practice they already do:
 *   - curriculumLists games render the inline short definition.
 *   - clueResolver checks the bundled definitions.js first, then this lookup,
 *     then the dictionary API.
 *   - selectWords only ever draws from the statutory pools, all of which are
 *     in Tier-1, so its enrichment is unaffected.
 *
 * Tier-2 entries fetched at runtime can be merged in via `primeWords` so that
 * subsequent synchronous lookups for those words succeed (used by the gate
 * client's cache layer).
 *
 * Used by:
 *   - src/data/curriculumLists.js  (getEnrichedLesson)
 *   - src/utils/wordSelectionEngine.js  (selectWords' wordObjects)
 *   - src/utils/clueResolver.js  (getDefinition fallback)
 */

import { STATUTORY_TIER1 } from '../data/statutoryTier1.js';

const WORD_MAP = (() => {
  const map = new Map();
  for (const entry of STATUTORY_TIER1) {
    if (!entry || typeof entry.word !== 'string') continue;
    const key = entry.word.toLowerCase();
    if (!map.has(key)) map.set(key, entry);
  }
  return map;
})();

// Words in Tier-1 are protected from being overwritten by primed Tier-2 data.
const TIER1_KEYS = new Set(WORD_MAP.keys());

const norm = (w) => (typeof w === 'string' ? w.toLowerCase() : '');

/**
 * Merge runtime-fetched (Tier-2) entries into the lookup map so later
 * synchronous lookups for those words succeed. Tier-1 entries are never
 * overwritten. Safe to call repeatedly. Returns the number newly added.
 */
export function primeWords(entries) {
  if (!Array.isArray(entries)) return 0;
  let added = 0;
  for (const entry of entries) {
    if (!entry || typeof entry.word !== 'string') continue;
    const key = entry.word.toLowerCase();
    if (TIER1_KEYS.has(key)) continue; // never shadow Tier-1
    WORD_MAP.set(key, entry);
    added += 1;
  }
  return added;
}

/** Return the full entry, or null. */
export function getWordData(word) {
  return WORD_MAP.get(norm(word)) || null;
}

/**
 * Return the appropriate definition for the caller's age band.
 *   Y1 / Y2 (year <= 2) → definition_7to10 (the simpler form; fallback to 10to12)
 *   Y3+                 → definition_10to12 (fallback to 7to10)
 * v28 entries use flat fields; v14 KS1 entries may still carry the legacy
 * definitions object — we fall back to that transparently.
 * If no year is supplied, defaults to the older/richer definition.
 */
export function getDefinition(word, { year } = {}) {
  const entry = getWordData(word);
  if (!entry) return '';
  // v28 flat fields
  const young = entry.definition_7to10  || entry.definitions?.ages5to7  || '';
  const older = entry.definition_10to12 || entry.definitions?.ages7to10 || '';
  if (typeof year === 'number' && year <= 2) {
    return young || older;
  }
  return older || young;
}

export function getSentence(word) {
  return getWordData(word)?.sentence || '';
}

export function getSyllables(word) {
  return getWordData(word)?.syllables || '';
}

export function getTrickyPart(word) {
  return getWordData(word)?.trickyPart || '';
}

/**
 * Returns commonMistakes as a string[]. The underlying field is a single
 * string, sometimes containing multiple mistakes separated by ", ". We split
 * on comma+space (not bare comma — em-dash phrases can contain commas inside
 * a single mistake) and trim each segment. Empty string returns [].
 */
export function getCommonMistakes(word) {
  const raw = getWordData(word)?.commonMistakes;
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(', ')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getRelatedWords(word) {
  const r = getWordData(word)?.relatedWords;
  return Array.isArray(r) ? r : [];
}

export function getPatternGroup(word) {
  return getWordData(word)?.patternGroup || '';
}

export function getDifficulty(word) {
  return getWordData(word)?.difficulty || null;
}

export function isStatutory(word) {
  return Boolean(getWordData(word)?.statutory);
}

/** Internal — exposed for verification scripts. */
export function _debugSize() {
  return WORD_MAP.size;
}
