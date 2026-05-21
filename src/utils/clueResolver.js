/**
 * clueResolver.js — single source of truth for child-friendly clue resolution.
 *
 * Every game that shows a clue to a child should call getClue() or getWordInfo()
 * from here.  No component should implement its own lookup chain.
 *
 * Lookup order (all three are tried in sequence; first hit wins):
 *   1. DEFINITIONS static map  — comprehensive; covers ~4750 curriculum words.
 *   2. wordLookup.getDefinition() — age-banded fallback from the word database.
 *   3. dictionaryapi.dev API — last resort; only for non-curriculum words.
 *
 * Exports
 * ───────
 *   getClueSync(word, year)          sync  – steps 1 & 2 only
 *   getClue(word, year)              async – full 3-step chain
 *   getWordInfo(word, userAge)       async – { definition, phonetic, partOfSpeech, example }
 *   preSeedClueCache(wordObjects)          – warm cache from inline defs
 */

import DEFINITIONS      from '../data/definitions.js';
import { isSafeDefinition } from './definitionSafety.js';
import { getDefinition as getWordLookupDef } from './wordLookup.js';

// ── Internal API-result cache ─────────────────────────────────────────────────
// Only API (step 3) results are cached here — DEFINITIONS and wordLookup are
// already O(1) in-memory lookups and need no additional caching.

const apiCache    = new Map(); // `${word}:${band}` → string | null
const wordInfoCache = new Map(); // word.toLowerCase() → { definition, phonetic, … }

// ── Year → band helpers ───────────────────────────────────────────────────────

/**
 * Normalise any year/yearBand input to a numeric year for wordLookup.
 * Returns 2 (KS1) or 4 (KS2+).
 */
function resolveYear(yearOrBand) {
  if (typeof yearOrBand === 'number') return yearOrBand;
  if (yearOrBand === 'y12' || yearOrBand === 'y1' || yearOrBand === 'y2') return 2;
  return 4; // default: KS2
}

function cacheKey(word, yearOrBand) {
  const band = resolveYear(yearOrBand) <= 2 ? 'y' : 'o';
  return `${word.toLowerCase()}:${band}`;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const MAX_CLUE_LEN = 110;

// Patterns that signal a definition is written for an adult audience rather
// than a child — skip these even if they pass the safety filter.
const ACADEMIC_RE = /\b(denoting|pertaining|comprising|consequently|whereby|nominally|figuratively|whereas|thereof|herein|hereby|heretofore|insofar|inasmuch|hitherto|aforementioned|so[-\s]called)\b/i;

function truncate(text) {
  if (text.length <= MAX_CLUE_LEN) return text;
  const cut = text.slice(0, MAX_CLUE_LEN);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut)
    .replace(/[,;:.\s]+$/, '') + '…';
}

// Drop leading parentheticals like "(Of a person)" or "(Especially in formal
// writing)" and re-capitalise the remaining first letter.
function stripLead(text) {
  return text.replace(/^\s*\([^)]+\)\s*/, '').replace(/^./, c => c.toUpperCase());
}

// True if the definition gives away the answer (contains the target word
// or its root stem).
function isSpoiler(text, word) {
  if (!text || !word) return false;
  const w = word.toLowerCase();
  if (new RegExp(`\\b${w}\\w*`, 'i').test(text)) return true;
  const stem = w.replace(/(ies|ied|ing|es|ed|s|y|e)$/i, '');
  if (stem.length >= 4 && stem !== w) {
    if (new RegExp(`\\b${stem}\\w*`, 'i').test(text)) return true;
  }
  return false;
}

/**
 * Walk the API meanings in noun → verb → other order. Return the first
 * definition that is safe, non-academic, non-spoiler, and fits the clue budget.
 */
function pickKidFriendly(word, meanings) {
  const PART_ORDER = { noun: 0, verb: 1 };
  const ordered = [...meanings].sort(
    (a, b) => (PART_ORDER[a.partOfSpeech] ?? 2) - (PART_ORDER[b.partOfSpeech] ?? 2),
  );
  const candidates = [];
  for (const meaning of ordered) {
    for (const def of meaning.definitions || []) {
      const raw = def.definition;
      if (!raw || raw.length < 5) continue;
      const text = stripLead(raw);
      if (text.length < 5)          continue;
      if (!isSafeDefinition(text))  continue;
      if (ACADEMIC_RE.test(text))   continue;
      if (isSpoiler(text, word))    continue;
      candidates.push(text);
    }
  }
  if (candidates.length === 0) return null;
  // First sense that fits the budget; truncate the first sense if nothing fits.
  return candidates.find(c => c.length <= MAX_CLUE_LEN) ?? truncate(candidates[0]);
}

/** Truncate an API definition to an age-appropriate length. */
function ageClamp(text, userAge) {
  if (!text) return text;
  if (userAge < 7  && text.length > 80)  return text.slice(0, 77) + '…';
  if (userAge < 10 && text.length > 160) return text.slice(0, 157) + '…';
  return text;
}

/**
 * Call dictionaryapi.dev.
 * Returns { definition: string|null, phonetic, partOfSpeech, example }
 * or null on network failure / 404.
 * The `word` field in the result shape is kept internal — callers see the
 * higher-level return values from getClue / getWordInfo.
 */
async function fetchApi(word, userAge = 8) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;

    const phonetic = data[0].phonetic
      || data[0].phonetics?.find(p => p.text)?.text
      || null;
    const allMeanings  = data.flatMap(e => e?.meanings || []);
    const definition   = ageClamp(pickKidFriendly(word, allMeanings), userAge);
    const partOfSpeech = allMeanings[0]?.partOfSpeech || null;
    let example = null;
    outer: for (const meaning of allMeanings) {
      for (const def of meaning.definitions || []) {
        if (def.example && isSafeDefinition(def.example)) {
          example = def.example;
          break outer;
        }
      }
    }
    return { definition, phonetic, partOfSpeech, example };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Synchronous clue lookup — covers steps 1 & 2 only (no async API call).
 *
 * Suitable for synchronous contexts such as quiz question builders and
 * crossword word validators.  Returns null when neither the DEFINITIONS map
 * nor the word database has a curated entry.
 *
 * @param {string}        word
 * @param {number|string} [yearOrBand]  school year (1–6) or yearBand key
 * @returns {string|null}
 */
export function getClueSync(word, yearOrBand) {
  if (!word) return null;
  const key  = word.toLowerCase();
  const year = resolveYear(yearOrBand);
  return DEFINITIONS[key] || getWordLookupDef(word, { year }) || null;
}

/**
 * Async clue lookup — full 3-step chain.
 *
 * @param {string}        word
 * @param {number|string} [yearOrBand]  school year (1–6) or yearBand key
 * @returns {Promise<string|null>}
 */
export async function getClue(word, yearOrBand) {
  if (!word) return null;
  const key  = word.toLowerCase();
  const year = resolveYear(yearOrBand);

  // Step 1 — static map (hits for ~4750 curriculum words)
  if (DEFINITIONS[key]) return DEFINITIONS[key];

  // Step 2 — word database
  const curated = getWordLookupDef(word, { year });
  if (curated) return curated;

  // Step 3 — external API (last resort; only for non-curriculum words)
  const ck = cacheKey(word, yearOrBand);
  if (apiCache.has(ck)) return apiCache.get(ck);
  const apiResult = await fetchApi(word);
  const def = apiResult?.definition ?? null;
  apiCache.set(ck, def);
  return def;
}

/**
 * Async lookup that returns the full word-info shape used by modals
 * throughout the app: { definition, phonetic, partOfSpeech, example }.
 *
 * Definition follows the 3-step chain; phonetic / partOfSpeech / example
 * are populated only when the external API is reached (i.e. for non-
 * curriculum words).  Results are module-level cached.
 *
 * @param {string} word
 * @param {number} [userAge=8]   used for KS1/KS2 banding and API text length
 * @returns {Promise<{definition:string|null, phonetic:string|null, partOfSpeech:string|null, example:string|null}>}
 */
export async function getWordInfo(word, userAge = 8) {
  if (!word) return { definition: null, phonetic: null, partOfSpeech: null, example: null };
  const key  = word.toLowerCase();

  if (wordInfoCache.has(key)) return wordInfoCache.get(key);

  // Steps 1 + 2 (sync — no API needed for curriculum words)
  const approxYear = userAge <= 7 ? 2 : 4;
  const curated = getClueSync(key, approxYear);
  if (curated) {
    const result = { definition: curated, phonetic: null, partOfSpeech: null, example: null };
    wordInfoCache.set(key, result);
    return result;
  }

  // Step 3 — API (only for non-curriculum words)
  const apiResult = await fetchApi(key, userAge);
  const result = apiResult
    ? apiResult
    : { definition: null, phonetic: null, partOfSpeech: null, example: null };
  wordInfoCache.set(key, result);
  return result;
}

/**
 * Pre-seed the word-info cache from a list's inline word objects so that
 * the word-detail modal resolves instantly and never hits the external API
 * for words the list already carries definitions for.
 *
 * Call this when a word list or game is opened.  Does not overwrite existing
 * cache entries (avoids stomping over a DEFINITIONS-backed hit).
 *
 * @param {(string|{word:string,definition?:string})[]} wordObjects
 */
export function preSeedClueCache(wordObjects) {
  for (const entry of wordObjects) {
    const word       = typeof entry === 'string' ? entry : entry?.word;
    const definition = typeof entry === 'string' ? null  : entry?.definition || null;
    if (!word || !definition) continue;
    const key = word.toLowerCase();
    if (!wordInfoCache.has(key)) {
      wordInfoCache.set(key, { definition, phonetic: null, partOfSpeech: null, example: null });
    }
  }
}
