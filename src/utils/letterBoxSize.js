/**
 * letterBoxSize.js
 *
 * Shared sizing for the letter-box inputs used across activities
 * (MemorySpell, QuizQuest fix_the_word, QuizQuest missing_letters).
 * Keeps box scale consistent between games.
 *
 * Scales boxes to fit a card with ~480px inner width, while keeping short
 * words from rendering boxes that look comically large.
 *
 *  length   px per box
 *  ─────    ──────────
 *    4–7      56
 *    8        55
 *    9        48
 *   10        44
 *   11        40
 *   12        36
 *   13        33
 *   14+       32
 */
export function letterBoxSize(length) {
  if (!length || length < 1) return 56;
  return Math.max(32, Math.min(56, Math.floor(440 / length)));
}
