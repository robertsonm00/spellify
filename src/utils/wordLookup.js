/**
 * wordLookup — single source of truth for rich per-word DATA.
 *
 * Merges Y1 + Y2 (from ks1WordData_v14) and KS2 (from ks2WordData_v28)
 * into a single case-insensitive Map keyed on word.toLowerCase(). Built once
 * at module load.
 *
 * Lookups are case-insensitive. Words not found return null / sensible empties.
 * Callers are expected to fall back gracefully (e.g. show the curated short
 * definition from curriculumLists.js when no enriched entry exists).
 *
 * Used by:
 *   - src/data/curriculumLists.js  (getEnrichedLesson)
 *   - src/utils/wordSelectionEngine.js  (selectWords' wordObjects)
 *   - future game/session UI for hints, tricky parts, common mistakes, etc.
 */

import { Y1_WORD_DATA, Y2_WORD_DATA, KS1_GAP_WORDS } from '../data/ks1WordData_v14.js';
import { ks2WordData } from '../data/ks2WordData_v28.js';

const WORD_MAP = (() => {
  const map = new Map();
  const ingest = (arr) => {
    for (const entry of arr) {
      if (!entry || typeof entry.word !== 'string') continue;
      const key = entry.word.toLowerCase();
      if (!map.has(key)) map.set(key, entry);
    }
  };
  ingest(Y1_WORD_DATA);
  ingest(Y2_WORD_DATA);
  ingest(KS1_GAP_WORDS);
  ingest(ks2WordData);
  return map;
})();

const norm = (w) => (typeof w === 'string' ? w.toLowerCase() : '');

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
