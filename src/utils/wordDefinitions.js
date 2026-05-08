// Shared word-to-clue resolver.
// Local DEFINITIONS map wins; falls back to api.dictionaryapi.dev with the
// same kid-friendly + safety filter Crossword uses. Results are memoised
// per-word so repeated lookups during a session don't refetch.

import DEFINITIONS from '../data/definitions';
import { isSafeDefinition } from './definitionSafety';

const cache = new Map(); // key: lower-case word → string | null

const MAX_CLUE_LEN = 110;

// Academic / encyclopaedic register — these words signal a definition style
// that's hard for kids even when the underlying meaning is fine.
const ACADEMIC_RE = /\b(denoting|pertaining|comprising|consequently|whereby|nominally|figuratively|whereas|thereof|herein|hereby|heretofore|insofar|inasmuch|hitherto|aforementioned|so[-\s]called)\b/i;

function truncate(text) {
  if (text.length <= MAX_CLUE_LEN) return text;
  const cut = text.slice(0, MAX_CLUE_LEN);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '') + '…';
}

// Drop leading parentheticals like "(Of a person)" or "(Especially in formal
// writing)" and re-capitalise the remaining first letter.
function stripLead(text) {
  const stripped = text.replace(/^\s*\([^)]+\)\s*/, '');
  return stripped.replace(/^./, c => c.toUpperCase());
}

// True if the definition gives away the answer (target word or its stem).
function isSpoiler(text, word) {
  if (!text || !word) return false;
  const w = word.toLowerCase();
  if (new RegExp(`\\b${w}\\w*`, 'i').test(text)) return true;
  // Crude stem match — strips a single inflectional suffix.
  const stem = w.replace(/(ies|ied|ing|es|ed|s|y|e)$/i, '');
  if (stem.length >= 4 && stem !== w) {
    if (new RegExp(`\\b${stem}\\w*`, 'i').test(text)) return true;
  }
  return false;
}

// Collect every safe + kid-friendly candidate, then return the shortest.
// Filtering layers, in order: structural → safety → spoiler → academic style.
function pickKidFriendly(word, meanings) {
  const PART_ORDER = { noun: 0, verb: 1 };
  const ordered = [...meanings].sort((a, b) =>
    (PART_ORDER[a.partOfSpeech] ?? 2) - (PART_ORDER[b.partOfSpeech] ?? 2)
  );
  const candidates = [];
  for (const meaning of ordered) {
    for (const def of (meaning.definitions || [])) {
      const raw = def.definition;
      if (!raw || raw.length < 5) continue;
      const text = stripLead(raw);
      if (text.length < 5) continue;
      if (!isSafeDefinition(text)) continue;
      if (ACADEMIC_RE.test(text))  continue;
      if (isSpoiler(text, word))   continue;
      candidates.push(text);
    }
  }
  if (candidates.length === 0) return null;
  // Prefer the first sense that fits the budget — that's usually the primary
  // meaning. If nothing fits, truncate the FIRST candidate rather than the
  // shortest: the first sense is canonical (e.g. "A mammal, Canis…" for dog)
  // while shortest tends to be obscure (e.g. "Tense" for time).
  const firstInBudget = candidates.find(c => c.length <= MAX_CLUE_LEN);
  return firstInBudget ?? truncate(candidates[0]);
}

async function lookupApi(word) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const allMeanings = data.flatMap(entry => entry?.meanings || []);
    if (allMeanings.length === 0) return null;
    return pickKidFriendly(word, allMeanings);
  } catch {
    return null;
  }
}

/**
 * Resolve a kid-friendly clue for `word`. Returns a string, or null if
 * none could be found (curated map missing + API miss/failure).
 */
export async function resolveDefinition(word) {
  const key = word.toLowerCase();
  if (DEFINITIONS[key]) return DEFINITIONS[key];
  if (cache.has(key))   return cache.get(key);
  const api = await lookupApi(key);
  cache.set(key, api);
  return api;
}
