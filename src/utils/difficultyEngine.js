/**
 * Difficulty Engine
 *
 * scoreWord(word)   → numeric score (higher = harder)
 * scoreToBand(score) → 'easy' | 'moderate' | 'hard' | 'challenge'
 *
 * Scoring heuristics
 * ──────────────────
 * Base: word length × 4 (primary driver)
 *
 * Phonemic complexity bonuses
 *   +8   Three or more consecutive consonants (strength, scream)
 *   +8   Silent-letter digraph: kn wr mb gn gh ph (knight, climb, phone)
 *   +10  Irregular vowel cluster: ough aigh eigh eau (thought, straight, eight)
 *   +5   Double letter (embarrass, accommodate)
 *   +6   Tricky suffix: -tion -sion -cious -tious -eous (station, precious)
 *   +5   High consonant density — length/vowelCount > 2.5 (rhythm, strength)
 *
 * Bands
 *   easy      ≤ 20   green
 *   moderate  21–34  yellow
 *   hard      35–48  orange
 *   challenge 49+    red
 */

const CLUSTER_RE  = /[bcdfghjklmnpqrstvwxyz]{3}/i;
const SILENT_RE   = /kn|wr|mb|gn|gh|ph/i;
const IRREG_RE    = /ough|aigh|eigh|eau/i;
const DOUBLE_RE   = /(.)\1/;
const SUFFIX_RE   = /tion|sion|cious|tious|eous/i;

/**
 * Return a numeric difficulty score for a single word.
 * @param {string} word
 * @returns {number}
 */
export function scoreWord(word) {
  const w = word.toLowerCase();
  let score = w.length * 4;

  if (CLUSTER_RE.test(w)) score += 8;
  if (SILENT_RE.test(w))  score += 8;
  if (IRREG_RE.test(w))   score += 10;
  if (DOUBLE_RE.test(w))  score += 5;
  if (SUFFIX_RE.test(w))  score += 6;

  const vowels = (w.match(/[aeiou]/g) || []).length;
  if (vowels > 0 && w.length / vowels > 2.5) score += 5;

  return score;
}

/**
 * Map a numeric score to a named difficulty band.
 * @param {number} score
 * @returns {'easy'|'moderate'|'hard'|'challenge'}
 */
export function scoreToBand(score) {
  if (score <= 20) return 'easy';
  if (score <= 34) return 'moderate';
  if (score <= 48) return 'hard';
  return 'challenge';
}
