/**
 * Word Selection Engine
 *
 * Canonical source for per-session word lists. Wraps the statutory NC 2014
 * curriculum data from src/data/spelling/index.js and exposes:
 *   • Reception (Year R / yearGroup 0) words
 *   • CATEGORIES — named statutory pools (year1_cew, year3_4, year5_6)
 *   • Year-group-aware routing into the correct category
 *   • Extra Support Mode — prefers shorter, phonically simpler words
 *   • WordObject output shape for future mastery / review features
 *
 * Public API
 * ----------
 * YEAR_GROUPS  — metadata array (yearGroup 0–6, label, ageRange)
 * CATEGORIES   — { year1_cew, year3_4, year5_6 } statutory pools
 * categoryForYearGroup(yearGroup) → category key string
 * selectWords({ yearGroup, count?, dyslexiaMode? })
 *   → { words: string[], wordObjects: WordObject[] }
 *
 * WordObject: { word: string, yearGroup: number, difficulty: 'easy'|'medium'|'hard' }
 */

import { YEAR_DATA, YEAR1_CEW, YEAR2_CEW, YEAR3_4, YEAR5_6 } from '../data/spelling/index.js';

// ── Y1 / Y2 phonics rule buckets ───────────────────────────────────────────
// Drawn from the NC 2014 English Appendix 1 example words for each rule.
// Used when selectWords is called with groupBy: 'rule'.

const Y1_RULE_GROUPS = {
  vowelDigraphs: {
    label: 'Vowel digraphs (ai / oi / ay / oy)',
    words: [
      'rain', 'paid', 'snail', 'train', 'chain', 'wait', 'tail',
      'oil', 'coin', 'soil', 'join', 'point', 'spoil',
      'day', 'play', 'say', 'may', 'way', 'stay', 'away',
      'boy', 'toy', 'joy', 'enjoy',
    ],
  },
  splitDigraphs: {
    label: 'Split digraphs (a-e / i-e / o-e)',
    words: [
      'cake', 'name', 'made', 'late', 'gate', 'save', 'game',
      'time', 'like', 'ride', 'hide', 'smile', 'kite', 'side',
      'home', 'hope', 'rose', 'those', 'note', 'rode', 'bone',
    ],
  },
  commonException: {
    label: 'Common exception words',
    words: YEAR1_CEW,
  },
  suffixes: {
    label: 'Words with suffixes (-ing / -ed / -er)',
    words: [
      'helping', 'jumping', 'hunting', 'buzzing', 'sitting',
      'hunted', 'jumped', 'helped', 'landed', 'shouted',
      'hunter', 'jumper', 'faster', 'taller', 'quicker', 'smaller',
    ],
  },
  compoundWords: {
    label: 'Compound words',
    words: [
      'football', 'playground', 'farmyard', 'bedroom',
      'blackbird', 'sunhat', 'pancake', 'sandpit',
      'cowboy', 'snowman', 'lunchbox', 'starfish',
    ],
  },
  prefixUn: {
    label: 'Prefix un-',
    words: [
      'unfair', 'unkind', 'undo', 'unhappy', 'unwell',
      'untie', 'unpack', 'unload', 'unlock', 'unsafe',
    ],
  },
};

const Y2_RULE_GROUPS = {
  softJ: {
    label: '/dʒ/ sound spelt -ge / -dge',
    words: [
      'badge', 'edge', 'bridge', 'fudge', 'dodge',
      'age', 'huge', 'change', 'charge', 'large', 'gem',
    ],
  },
  softC: {
    label: '/s/ sound spelt c before e / i / y',
    words: [
      'race', 'ice', 'cell', 'city', 'fancy',
      'face', 'place', 'circle', 'cycle', 'centre',
    ],
  },
  silentLetters: {
    label: 'Silent letters (kn / wr / gn)',
    words: [
      'knock', 'know', 'knee', 'knew', 'knife',
      'write', 'wrote', 'wrong', 'wrap', 'wrist',
      'gnat', 'gnaw',
    ],
  },
  syllableLe: {
    label: '/əl/ sound spelt -le at the end of words',
    words: [
      'table', 'apple', 'bottle', 'little', 'middle',
      'cattle', 'kettle', 'paddle', 'puddle', 'bubble',
    ],
  },
  yToIes: {
    label: 'Adding -es to words ending in y',
    words: [
      'flies', 'tries', 'replies', 'copies', 'babies',
      'carries', 'hurries', 'cries', 'parties', 'studies',
    ],
  },
  contractions: {
    label: 'Contractions',
    words: [
      "can't", "didn't", "hasn't", "couldn't", "it's",
      "I'll", "I'm", "we'll", "they're", "won't",
    ],
  },
  commonException: {
    label: 'Common exception words',
    words: YEAR_DATA[2].words,
  },
};

export const RULE_GROUPS = {
  year1: Y1_RULE_GROUPS,
  year2: Y2_RULE_GROUPS,
};

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

// ── Statutory categories ───────────────────────────────────────────────────
// Named pools that map directly to NC 2014 English Appendix 1 lists.
// Pupils are routed into a category based on their selected year group.

export const CATEGORIES = {
  reception: RECEPTION_WORDS,
  year1_cew: YEAR1_CEW,                 // Year 1 Common Exception Words (45)
  year2_cew: YEAR2_CEW,                 // Year 2 Common Exception Words (63)
  year3_4:   YEAR3_4,                   // Y3 & Y4 statutory list (100 → 109 expanded)
  year5_6:   YEAR5_6,                   // Y5 & Y6 statutory list (100 → 104 expanded)
};

/**
 * Map a year group (0–6) to its statutory category key.
 * @param {number} yearGroup
 * @returns {keyof typeof CATEGORIES}
 */
export function categoryForYearGroup(yearGroup) {
  const yg = Number(yearGroup);
  if (yg === 0) return 'reception';
  if (yg === 1) return 'year1_cew';
  if (yg === 2) return 'year2_cew';
  if (yg === 3 || yg === 4) return 'year3_4';
  if (yg === 5 || yg === 6) return 'year5_6';
  return 'year3_4';
}

// ── Word pool ──────────────────────────────────────────────────────────────

function getWordPool(yearGroup) {
  const key = categoryForYearGroup(yearGroup);
  const pool = CATEGORIES[key];
  return pool ? [...pool] : [...CATEGORIES.year3_4];
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
 * List the rule-bucket keys available for a given year group.
 * Returns [] if the year group has no rule buckets defined.
 * @param {number} yearGroup
 * @returns {Array<{ key: string, label: string }>}
 */
export function getRuleGroups(yearGroup) {
  const yg = Number(yearGroup);
  const groups = yg === 1 ? Y1_RULE_GROUPS
               : yg === 2 ? Y2_RULE_GROUPS
               : null;
  if (!groups) return [];
  return Object.entries(groups).map(([key, { label }]) => ({ key, label }));
}

function getRulePool(yearGroup, rule) {
  const yg = Number(yearGroup);
  const groups = yg === 1 ? Y1_RULE_GROUPS
               : yg === 2 ? Y2_RULE_GROUPS
               : null;
  if (!groups || !groups[rule]) return null;
  return [...groups[rule].words];
}

/**
 * Select words for a session.
 *
 * @param {{
 *   yearGroup: number,
 *   count?: number,
 *   dyslexiaMode?: boolean,
 *   groupBy?: 'year' | 'rule',
 *   rule?: string,         // required when groupBy === 'rule'
 * }} opts
 * @returns {{ words: string[], wordObjects: WordObject[] }}
 */
export function selectWords({ yearGroup, count = 10, dyslexiaMode = false, groupBy = 'year', rule = null }) {
  let pool;
  if (groupBy === 'rule' && rule) {
    pool = getRulePool(yearGroup, rule);
    // Fall back to the year-group pool if the rule isn't defined for this year.
    if (!pool) pool = getWordPool(yearGroup);
  } else {
    pool = getWordPool(yearGroup);
  }

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
