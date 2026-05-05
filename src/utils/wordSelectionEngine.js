/**
 * Word Selection Engine
 *
 * Canonical source for per-session word lists. Wraps the statutory curriculum
 * data from src/data/spelling/index.js and adds:
 *   • Reception (Year R / yearGroup 0) words
 *   • Extra Support Mode — prefers shorter, phonically simpler words
 *   • WordObject output shape for future mastery / review features
 *
 * Public API
 * ----------
 * YEAR_GROUPS  — metadata array (yearGroup 0–6, label, ageRange)
 * selectWords({ yearGroup, count?, dyslexiaMode? })
 *   → { words: string[], wordObjects: WordObject[] }
 *
 * WordObject: { word: string, yearGroup: number, difficulty: 'easy'|'medium'|'hard' }
 */

import { YEAR_DATA } from '../data/spelling/index.js';

// ── Reception word list ────────────────────────────────────────────────────
// Based on DfE Letters and Sounds Phase 2–4 high-frequency / common
// exception words, typically introduced in Early Years Foundation Stage.

const RECEPTION_WORDS = [
  // Phase 2 tricky words
  'I', 'no', 'go', 'to', 'the', 'into',
  // Phase 3 tricky words
  'he', 'she', 'me', 'be', 'we', 'was', 'you', 'your', 'they', 'are',
  'all', 'said', 'so', 'do', 'some', 'come', 'have', 'like', 'here', 'there',
  // Phase 4 tricky words / sight words
  'saw', 'were', 'little', 'one', 'out', 'what', 'when', 'my', 'by',
  // Simple decodable words (CVC / CCVC)
  'is', 'his', 'has', 'of', 'it', 'in', 'as', 'at', 'an', 'if', 'up',
  'on', 'not', 'can', 'but', 'and', 'get', 'had', 'did', 'let', 'big',
  'him', 'run', 'sit', 'hot', 'met', 'set', 'ten', 'yes', 'put', 'see',
];

// ── Year group metadata ────────────────────────────────────────────────────

export const YEAR_GROUPS = [
  { yearGroup: 0, label: 'Reception', shortLabel: 'R', ageRange: [4, 5] },
  { yearGroup: 1, label: 'Year 1',    shortLabel: '1', ageRange: [5, 6] },
  { yearGroup: 2, label: 'Year 2',    shortLabel: '2', ageRange: [6, 7] },
  { yearGroup: 3, label: 'Year 3',    shortLabel: '3', ageRange: [7, 8] },
  { yearGroup: 4, label: 'Year 4',    shortLabel: '4', ageRange: [8, 9] },
  { yearGroup: 5, label: 'Year 5',    shortLabel: '5', ageRange: [9, 10] },
  { yearGroup: 6, label: 'Year 6',    shortLabel: '6', ageRange: [10, 11] },
];

// ── Word pool ──────────────────────────────────────────────────────────────

function getWordPool(yearGroup) {
  if (yearGroup === 0) {
    return RECEPTION_WORDS.map((w) => w.toLowerCase());
  }
  const data = YEAR_DATA[Math.max(1, Math.min(6, Number(yearGroup)))];
  return data ? [...data.words] : [...YEAR_DATA[1].words];
}

// ── Dyslexia-friendly scoring ──────────────────────────────────────────────
// Lower score = more accessible.
// Prefers: short words, regular CVC phonics, no confusable letter pairs.
// Penalises: b/d/p/q clusters, silent-letter digraphs (kn, wr, mb),
//            triple consonant clusters, double letters.

const CONFUSE_RE  = /[bdpq].*[bdpq]/i;   // letters that reverse/rotate easily
const SILENT_RE   = /kn|wr|mb|gn|gh/i;   // silent-letter digraphs
const CLUSTER_RE  = /[bcdfghjklmnpqrstvwxyz]{3}/i; // triple consonant run
const DOUBLE_RE   = /(.)\1/;             // doubled letter

function dyslexiaScore(word) {
  let score = word.length * 2;
  if (CONFUSE_RE.test(word))  score += 4;
  if (SILENT_RE.test(word))   score += 4;
  if (CLUSTER_RE.test(word))  score += 3;
  if (DOUBLE_RE.test(word))   score += 2;
  return score;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Select words for a session.
 *
 * @param {{ yearGroup: number, count?: number, dyslexiaMode?: boolean }} opts
 * @returns {{ words: string[], wordObjects: WordObject[] }}
 */
export function selectWords({ yearGroup, count = 10, dyslexiaMode = false }) {
  const pool = getWordPool(yearGroup);

  let candidates;
  if (dyslexiaMode) {
    // Sort the whole pool by accessibility score, then shuffle the top 2× band
    // so the user still sees variety while staying within simpler words.
    const sorted = [...pool].sort((a, b) => dyslexiaScore(a) - dyslexiaScore(b));
    const band   = sorted.slice(0, Math.min(sorted.length, count * 2));
    candidates   = band.sort(() => Math.random() - 0.5);
  } else {
    candidates = [...pool].sort(() => Math.random() - 0.5);
  }

  const words = candidates.slice(0, count);

  const wordObjects = words.map((word) => ({
    word,
    yearGroup: Number(yearGroup),
    difficulty: word.length <= 4 ? 'easy' : word.length <= 7 ? 'medium' : 'hard',
  }));

  return { words, wordObjects };
}
