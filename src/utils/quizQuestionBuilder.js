/**
 * quizQuestionBuilder.js
 *
 * Builds a mixed-type quiz from a session's word list. The quiz is the
 * source of truth for the QuizQuest activity.
 *
 * Output shape (per question):
 *   {
 *     id, type, word, prompt,
 *     displayText?, options?, answer, definition?, difficulty?
 *   }
 *
 * Constraints enforced (best-effort, in order):
 *   1. Mixed types — no two same type in a row when possible
 *   2. No word over-used — at most ceil(count/words.length) questions per word
 *   3. match_definition only when clueResolver can produce a curated definition
 *   4. Falls back gracefully for short word lists or words with no usable distractors
 */

import { getClueSync } from './clueResolver.js';
import { generateDistractors } from './spellingDistractors.js';

const QUESTIONS_DEFAULT = 10;

// ── Per-type builders ────────────────────────────────────────────────────────

function makeChooseSpelling(word) {
  const distractors = generateDistractors(word, 2);
  if (distractors.length < 2) return null;
  const options = [word, ...distractors].sort(() => Math.random() - 0.5);
  return {
    id: `cs-${word}`,
    type: 'choose_spelling',
    word,
    prompt: 'Which spelling is correct?',
    options,
    answer: word,
  };
}

function makeFixTheWord(word) {
  // Only use same-length distractors — drop-letter/double-consonant distractors
  // change the word length and confuse children expecting matching box count.
  const candidates = generateDistractors(word, 6);
  const misspelling = candidates.find(d => d.length === word.length);
  if (!misspelling) return null;
  return {
    id: `fix-${word}`,
    type: 'fix_the_word',
    word,
    prompt: 'Buddy made a mistake. Fix it!',
    displayText: misspelling,
    answer: word,
  };
}

function makeMissingLetters(word) {
  if (word.length < 4) return null;
  const lower = word.toLowerCase();
  // Hide ~25% of letters, capped to 3 and floored to 1.
  const num = Math.max(1, Math.min(3, Math.floor(lower.length / 4)));
  const positions = Array.from({ length: lower.length }, (_, i) => i)
    .sort(() => Math.random() - 0.5)
    .slice(0, num);
  const display = lower
    .split('')
    .map((ch, i) => (positions.includes(i) ? '_' : ch))
    .join('');
  return {
    id: `ml-${word}`,
    type: 'missing_letters',
    word,
    prompt: 'Fill in the missing letters',
    displayText: display,
    answer: word,
  };
}

function makeHearAndChoose(word) {
  // Distractors are misspellings of the same word so the child must rely
  // on hearing the word and picking the correct spelling.
  const distractors = generateDistractors(word, 2);
  if (distractors.length < 2) return null;
  const options = [word, ...distractors].sort(() => Math.random() - 0.5);
  return {
    id: `hac-${word}`,
    type: 'hear_and_choose',
    word,
    prompt: 'Listen and choose the word',
    options,
    answer: word,
  };
}

function makeMatchDefinition(word, definition, otherWords) {
  // Distractors are other session words, not misspellings — the child is
  // matching meaning, not spelling.
  const distractors = otherWords
    .filter((w) => w.toLowerCase() !== word.toLowerCase())
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
  if (distractors.length < 1) return null;
  const options = [word, ...distractors].sort(() => Math.random() - 0.5);
  return {
    id: `md-${word}`,
    type: 'match_definition',
    word,
    prompt: 'Which word means…',
    definition,
    options,
    answer: word,
  };
}

// ── Quiz builder ─────────────────────────────────────────────────────────────

/**
 * Build a quiz of mixed-type questions for a session word list.
 *
 * @param {string[]} words       confirmed session words (string array)
 * @param {object}   opts
 * @param {number}   opts.count  target number of questions (default 10)
 * @param {number}   opts.year   school year group (1–6) for age-banded definitions
 * @param {object[]} opts.wordObjects  enriched word entries — inline definitions take priority
 * @returns {object[]} array of question objects
 */
export function buildQuiz(words, { count = QUESTIONS_DEFAULT, year, wordObjects = [] } = {}) {
  if (!Array.isArray(words) || words.length === 0) return [];

  // Build a definition lookup: inline curriculum definition → central clue chain.
  const inlineMap = new Map(
    wordObjects.map(e => [
      (typeof e === 'string' ? e : e.word).toLowerCase(),
      typeof e === 'string' ? null : e.definition || null,
    ])
  );
  const resolveDef = (word) =>
    inlineMap.get(word.toLowerCase()) || getClueSync(word, year);

  // 1. Build every viable question for every word.
  const pool = [];
  for (const word of words) {
    const def = resolveDef(word);
    const cs  = makeChooseSpelling(word);    if (cs)  pool.push(cs);
    const fix = makeFixTheWord(word);        if (fix) pool.push(fix);
    const ml  = makeMissingLetters(word);    if (ml)  pool.push(ml);
    const hac = makeHearAndChoose(word);     if (hac) pool.push(hac);
    if (def) {
      const md = makeMatchDefinition(word, def, words);
      if (md) pool.push(md);
    }
  }

  if (pool.length === 0) return [];

  // 2. Shuffle, then pick respecting constraints.
  const shuffled    = pool.sort(() => Math.random() - 0.5);
  const target      = Math.min(count, pool.length);
  const maxPerWord  = Math.max(1, Math.ceil(target / words.length));
  const wordCount   = {};
  const picked      = [];

  // Pass 1 — strict: respect both type-adjacency and per-word cap.
  for (const q of shuffled) {
    if (picked.length >= target) break;
    if ((wordCount[q.word] || 0) >= maxPerWord) continue;
    if (picked.length > 0 && picked[picked.length - 1].type === q.type) continue;
    picked.push(q);
    wordCount[q.word] = (wordCount[q.word] || 0) + 1;
  }

  // Pass 2 — relax type-adjacency if still short.
  for (const q of shuffled) {
    if (picked.length >= target) break;
    if (picked.includes(q)) continue;
    if ((wordCount[q.word] || 0) >= maxPerWord) continue;
    picked.push(q);
    wordCount[q.word] = (wordCount[q.word] || 0) + 1;
  }

  // Pass 3 — relax per-word cap as last resort.
  for (const q of shuffled) {
    if (picked.length >= target) break;
    if (picked.includes(q)) continue;
    picked.push(q);
  }

  return picked;
}
