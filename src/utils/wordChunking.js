/**
 * wordChunking.js
 *
 * Algorithmically splits a word into pronunciation chunks joined with '·'.
 *   chunkWord('beautiful')   → 'beau·ti·ful'
 *   chunkWord('interesting') → 'inter·est·ing'
 *   chunkWord('accident')    → 'ac·cid·ent'
 *
 * Strategy (applied in order, first match wins per sub-word):
 *   1. Known morpheme prefix  — un·, re·, pre·, dis·, mis·, over·, out·, sub·, inter·, super·
 *   2. Known morpheme suffix  — ·ing, ·ed, ·er, ·est, ·ful, ·less, ·ness, ·tion, ·sion, ·ment, ·ly, ·ous, ·ive, ·able, ·ible
 *   3. VCCV rule              — split between two consecutive consonants flanked by vowels (e.g. ac·cident)
 *   4. Fallback               — split near the midpoint at the nearest consonant boundary
 *
 * This is a heuristic approximation, NOT a phonics engine.
 * For accurate syllabification replace splitIntoChunks() with a
 * Knuth–Liang hyphenation pattern library (e.g. 'hypher') in the future.
 */

// Longest-first so 'inter' is checked before 're' when scanning prefixes.
const PREFIXES = ['inter', 'super', 'over', 'out', 'sub', 'pre', 'dis', 'mis', 'un', 're'];
const SUFFIXES = ['tion', 'sion', 'ment', 'ness', 'less', 'ful', 'able', 'ible', 'ing', 'est', 'ous', 'ive', 'er', 'ed', 'ly'];

// Common consonant digraphs that represent one sound and should not be split.
const DIGRAPHS = new Set([
  'th', 'sh', 'ch', 'wh', 'ph',
  'bl', 'cl', 'fl', 'gl', 'pl', 'sl',
  'br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr',
  'sc', 'sk', 'sm', 'sn', 'sp', 'st', 'sw',
]);

const isVowel = (c) => /[aeiou]/i.test(c);
const isCons  = (c) => /[a-z]/i.test(c) && !isVowel(c);

/**
 * VCCV rule: find vowel–cons–cons–vowel and split between the two consonants.
 * Returns [left, right] or null.
 */
function vcCvSplit(word) {
  for (let i = 1; i < word.length - 2; i++) {
    if (
      isVowel(word[i - 1]) &&
      isCons(word[i]) &&
      isCons(word[i + 1]) &&
      isVowel(word[i + 2])
    ) {
      const pair = word.slice(i, i + 2).toLowerCase();
      if (DIGRAPHS.has(pair)) continue;
      return [word.slice(0, i + 1), word.slice(i + 1)];
    }
  }
  return null;
}

/**
 * Fallback: walk outward from the midpoint to find the nearest consonant, split there.
 */
function fallbackSplit(word) {
  const mid = Math.floor(word.length / 2);
  for (let offset = 0; offset < mid; offset++) {
    const rPos = mid + offset;
    if (rPos < word.length - 1 && isCons(word[rPos])) {
      return [word.slice(0, rPos), word.slice(rPos)];
    }
    const lPos = mid - offset;
    if (offset > 0 && lPos > 0 && isCons(word[lPos])) {
      return [word.slice(0, lPos), word.slice(lPos)];
    }
  }
  return [word.slice(0, mid), word.slice(mid)];
}

/**
 * Recursively split a (lowercase) word into an array of chunks.
 * @param {string} word
 * @returns {string[]}
 */
function splitIntoChunks(word) {
  if (word.length <= 3) return [word];

  // 1. Known prefix
  for (const pfx of PREFIXES) {
    if (word.startsWith(pfx) && word.length - pfx.length >= 3) {
      return [pfx, ...splitIntoChunks(word.slice(pfx.length))];
    }
  }

  // 2. Known suffix
  for (const sfx of SUFFIXES) {
    const stemLen = word.length - sfx.length;
    if (word.endsWith(sfx) && stemLen >= 3) {
      return [...splitIntoChunks(word.slice(0, stemLen)), sfx];
    }
  }

  // 3. VCCV rule
  const vcParts = vcCvSplit(word);
  if (vcParts && vcParts[0].length > 0 && vcParts[1].length > 0) {
    return [
      ...splitIntoChunks(vcParts[0]),
      ...splitIntoChunks(vcParts[1]),
    ];
  }

  // 4. Fallback — only worth splitting words longer than 5 characters
  if (word.length > 5) {
    const [left, right] = fallbackSplit(word);
    if (left.length > 0 && right.length > 0 && left !== word) {
      return [left, right];
    }
  }

  return [word];
}

/**
 * Split a word into visual pronunciation chunks joined by '·'.
 *
 * @param {string} word
 * @returns {string}  e.g. 'beau·ti·ful'
 */
export function chunkWord(word) {
  if (!word || word.length <= 3) return word.toLowerCase();
  const chunks = splitIntoChunks(word.toLowerCase());
  return chunks.filter(Boolean).join('·');
}
