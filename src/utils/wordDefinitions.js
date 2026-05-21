/**
 * wordDefinitions.js — backward-compatibility shim.
 *
 * The canonical implementation now lives in clueResolver.js.
 * Hangman and SpellDuel call resolveDefinition(); that still works via this
 * re-export.  New code should import getClue / getClueSync from clueResolver.
 */

import { getClue } from './clueResolver.js';

/**
 * Resolve a kid-friendly clue for `word`.
 * Delegates to the central 3-step chain in clueResolver.
 *
 * @param {string} word
 * @param {{ year?: number }} [opts]
 * @returns {Promise<string|null>}
 */
export async function resolveDefinition(word, { year } = {}) {
  return getClue(word, year);
}
