/**
 * Visual Confusion Pairs
 *
 * Letters that are rotations, reflections, or near-identical shapes of each
 * other. Used by:
 *   • wordSearchEngine — to avoid placing confusing pairs adjacent in filler
 *   • (future) quiz hint rendering — to highlight risky letter combos
 *
 * Each sub-array is an unordered pair [a, b].
 */

export const VISUAL_CONFUSION_PAIRS = [
  ['b', 'd'],  // horizontal mirror
  ['b', 'p'],  // vertical mirror
  ['b', 'q'],  // 180° rotation
  ['d', 'q'],  // vertical mirror of b/p
  ['d', 'p'],  // 180° of b/d
  ['p', 'q'],  // horizontal mirror
  ['m', 'n'],  // similar arch shapes
  ['m', 'w'],  // vertical mirror
  ['n', 'u'],  // 180° rotation
  ['h', 'n'],  // near-identical arches
  ['i', 'j'],  // single stem; dot position only difference
  ['i', 'l'],  // single vertical stroke
  ['f', 't'],  // similar crossing strokes
  ['v', 'u'],  // open-top similarity
  ['v', 'w'],  // doubled-v
  ['o', 'c'],  // open vs closed circle
  ['o', 'e'],  // similar enclosed shape
  ['a', 'd'],  // similar bowl + stem
  ['g', 'q'],  // descender confusion
  ['s', 'z'],  // mirrored diagonal direction
  ['r', 'n'],  // short arch
];

// ── Flat Set for O(1) pair lookup ──────────────────────────────────────────

const _set = new Set();
for (const [a, b] of VISUAL_CONFUSION_PAIRS) {
  _set.add(`${a}${b}`);
  _set.add(`${b}${a}`);
}

/**
 * Returns true if placing letter `a` next to letter `b` in the grid
 * risks visual confusion for readers who reverse or mirror letters.
 *
 * @param {string} a  single letter (any case)
 * @param {string} b  single letter (any case)
 * @returns {boolean}
 */
export function isConfusingPair(a, b) {
  return _set.has(`${a.toLowerCase()}${b.toLowerCase()}`);
}
