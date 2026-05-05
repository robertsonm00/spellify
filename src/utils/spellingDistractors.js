/**
 * spellingDistractors.js
 *
 * Generates plausible misspellings of a word for use as multiple-choice
 * distractors. Strategies:
 *   1. Swap two adjacent letters       (beautiful → buetiful)
 *   2. Drop one letter                 (knowledge → nowledge — also covers silent letters)
 *   3. Double a consonant              (later → latter)
 *   4. Undouble a doubled consonant    (letter → leter)
 *   5. Replace tricky vowel patterns   (receive → recieve)
 *
 * Guarantees:
 *   - Never returns the real word
 *   - Returns unique distractors
 *   - Returns at most `count` distractors (may return fewer for short words)
 */

// Common ie/ei/ou/ai vowel-pattern swaps that learners frequently confuse.
const VOWEL_PATTERN_SWAPS = [
  ['ie', 'ei'],
  ['ei', 'ie'],
  ['ou', 'uo'],
  ['ai', 'ia'],
  ['ea', 'ae'],
];

const isCons = (c) => /[bcdfghjklmnpqrstvwxz]/i.test(c);

function swapAdjacent(word, i) {
  if (i < 0 || i >= word.length - 1) return null;
  return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
}

function dropChar(word, i) {
  if (i < 0 || i >= word.length) return null;
  return word.slice(0, i) + word.slice(i + 1);
}

function doubleChar(word, i) {
  if (i < 0 || i >= word.length) return null;
  return word.slice(0, i + 1) + word[i] + word.slice(i + 1);
}

function replacePattern(word, find, replace) {
  const idx = word.indexOf(find);
  if (idx === -1) return null;
  return word.slice(0, idx) + replace + word.slice(idx + find.length);
}

/**
 * Generate plausible misspellings of `word`.
 *
 * @param {string} word
 * @param {number} count   target number of distractors
 * @returns {string[]}     up to `count` unique misspellings, never including `word`
 */
export function generateDistractors(word, count = 2) {
  if (!word || word.length < 3) return [];
  const lower = word.toLowerCase();
  const candidates = new Set();

  // Strategy 1: swap each adjacent pair
  for (let i = 0; i < lower.length - 1; i++) {
    if (lower[i] === lower[i + 1]) continue; // swapping identical letters is a no-op
    const out = swapAdjacent(lower, i);
    if (out) candidates.add(out);
  }

  // Strategy 2: drop each letter (catches silent letters too)
  for (let i = 0; i < lower.length; i++) {
    const out = dropChar(lower, i);
    if (out && out.length >= 3) candidates.add(out);
  }

  // Strategy 3: double a consonant (one variant per consonant position)
  for (let i = 0; i < lower.length; i++) {
    if (!isCons(lower[i])) continue;
    // skip if already a doubled run
    if (lower[i] === lower[i + 1] || lower[i] === lower[i - 1]) continue;
    const out = doubleChar(lower, i);
    if (out) candidates.add(out);
  }

  // Strategy 4: undouble doubled consonants (covered by drop above, but leave
  // explicit so future tweaks can prioritise it)

  // Strategy 5: vowel-pattern swaps
  for (const [find, replace] of VOWEL_PATTERN_SWAPS) {
    const out = replacePattern(lower, find, replace);
    if (out) candidates.add(out);
  }

  // Never return the real word
  candidates.delete(lower);

  // Shuffle and trim
  const arr = [...candidates].sort(() => Math.random() - 0.5);
  return arr.slice(0, count);
}
