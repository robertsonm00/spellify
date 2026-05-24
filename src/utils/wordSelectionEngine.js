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
import { getMorphology } from '../data/morphology';
import { getWordData } from './wordLookup.js';
import { incrementSessionCount } from './sessionCounter';
import { recordSessionAppearance } from './masteryEngine';

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
// Bucket key for "this word is essentially the same as another already picked".
// Uses the morphological root when available (so equip/equipment/equipped all
// resolve to "equip"), falling back to the first 5 chars for words without a
// detected breakdown (catches close cousins like teach/teacher even if the
// morphology table didn't fire).
function stemKey(word) {
  const w    = String(word).toLowerCase();
  const root = getMorphology(w)?.root?.toLowerCase() ?? w;
  return root.slice(0, 5);
}

// Take up to `count` words from `candidates`, skipping any whose stem already
// appeared. If the pool runs out of unique stems before we reach `count`,
// top up with remaining duplicates so we always return a full list.
function dedupeByStem(candidates, count) {
  const picked  = [];
  const skipped = [];
  const seen    = new Set();
  for (const word of candidates) {
    if (picked.length >= count) break;
    const key = stemKey(word);
    if (seen.has(key)) { skipped.push(word); continue; }
    seen.add(key);
    picked.push(word);
  }
  if (picked.length < count) {
    picked.push(...skipped.slice(0, count - picked.length));
  }
  return picked;
}

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

  const words = dedupeByStem(candidates, count);

  // Each wordObject merges the full v13/v26 entry (definitions, sentence,
  // syllables, trickyPart, commonMistakes, relatedWords, patternGroup,
  // statutory, etc.) with the session's yearGroup. Words missing from the
  // database fall back to the legacy length-based difficulty heuristic and
  // get the minimal shape, so callers never see undefined.
  const wordObjects = words.map((word) => {
    const entry = getWordData(word);
    const fallbackDifficulty =
      word.length <= 4 ? 'easy' : word.length <= 7 ? 'medium' : 'hard';
    if (!entry) {
      return {
        word,
        yearGroup: Number(yearGroup),
        difficulty: fallbackDifficulty,
      };
    }
    return {
      ...entry,
      word,
      yearGroup: Number(yearGroup),
      difficulty: entry.difficulty || fallbackDifficulty,
    };
  });

  return { words, wordObjects };
}

/* ════════════════════════════════════════════════════════════════════════
 * ACTIVE-WINDOW HELPERS
 * Added for the large-list management layer (masteryEngine + gamification).
 * Pure functions; no side effects. They consume a mastery state shape
 * (see src/utils/masteryEngine.js) and a plain array of words.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Three-state word selection for a new session.
 *
 * Words are bucketed by their mastery / reinforcement state:
 *
 *   active        attempted-but-not-mastered  +  untouched
 *   consolidating mastered, postMasterySessions < CONSOLIDATING_LIMIT
 *   retained      mastered, postMasterySessions ≥ CONSOLIDATING_LIMIT
 *
 * Selection rules:
 *   - active words are always included (priority practice)
 *   - consolidating words are included on a regular schedule
 *     (every CONSOLIDATING_FREQ-th session) OR when the pool would
 *     otherwise be under MIN_POOL words
 *   - retained words are included on a slower schedule (every
 *     RETAINED_FREQ-th session) OR when the pool is still under MIN_POOL
 *
 * SEN profiles (`'dyslexia' | 'often-tricky' | 'support-mode'`) get a
 * multiplier that increases reinforcement: consolidating runs longer
 * before becoming retained, retained words appear more often.
 *
 * Side effects:
 *   - Increments the global session counter once per call.
 *   - For each consolidating / retained word actually included, ticks its
 *     `postMasterySessions` so it eventually graduates from one pool to
 *     the next.
 *
 * Evergreen mode: if every word is mastered (no active words at all), we
 * still return a fresh shuffled window so the child can keep playing.
 * All mastered words are treated as retained for the tick.
 *
 * @param {string} listId
 * @param {Array<string>} fullWordList
 * @param {object} masteryState  see masteryEngine.getMasteryState
 * @param {number} [windowSize=15]
 * @param {string|null} [senProfile]  override; falls back to
 *                                    localStorage 'spellify_sen_profile'
 * @returns {Array<string>}
 */

// Default schedule — tuneable in one place.
const ACTIVE_WINDOW_DEFAULTS = {
  CONSOLIDATING_LIMIT: 3,   // mastered + < 3 post-sessions  → consolidating
  CONSOLIDATING_FREQ:  3,   // include consolidating words every 3rd session
  RETAINED_FREQ:      10,   // include retained words every 10th session
  MIN_POOL:            4,   // never let the available pool drop below this
};

// SEN profile multipliers (dyslexia / often-tricky / support-mode).
// Consolidating words stay in the consolidating pool for twice as long,
// retained words rotate back in more frequently (every 5 vs every 10).
const ACTIVE_WINDOW_SEN = {
  CONSOLIDATING_LIMIT: 6,
  CONSOLIDATING_FREQ:  6,
  RETAINED_FREQ:       5,
  MIN_POOL:            4,
};

const SEN_PROFILES = new Set(['dyslexia', 'often-tricky', 'support-mode']);

function readSenProfile() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem('spellify_sen_profile');
    return raw && SEN_PROFILES.has(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function getActiveWindow(listId, fullWordList, masteryState, windowSize = 15, senProfile = undefined, adaptiveLearning = true) {
  if (!Array.isArray(fullWordList) || fullWordList.length === 0) return [];

  // Resolve SEN profile: explicit param wins; otherwise read localStorage.
  // `undefined` means "no override supplied" → consult storage.
  // `null` means "explicitly no profile" → skip storage.
  const resolvedSen = senProfile === undefined ? readSenProfile() : senProfile;
  const sched = (resolvedSen && SEN_PROFILES.has(resolvedSen))
    ? ACTIVE_WINDOW_SEN
    : ACTIVE_WINDOW_DEFAULTS;

  // Advance the global session counter. Every call increments — see file
  // header for the rationale. (Still ticks when adaptive learning is off
  // so any non-adaptive analytics that depend on a session ordinal stay
  // consistent.)
  const currentSession = incrementSessionCount();

  // ── Non-adaptive branch ────────────────────────────────────────────────
  // When the parent has turned adaptive learning off, every word is
  // surfaced every session — no three-state model, no consolidating /
  // retained spacing, no postMasterySessions tick. Struggling words still
  // get safety-net reinforcement: they're promoted to the head of the
  // shuffled output so they're seen first, just like in the adaptive
  // path. The SEN multiplier is intentionally still respected at the
  // schedule level so struggling-prone children get extra reinforcement
  // even with adaptive scheduling off (it never gets turned off — see
  // adaptiveLearning field doc on the session).
  if (adaptiveLearning === false) {
    const struggling = [];
    const rest       = [];
    for (const w of fullWordList) {
      const entry = masteryState?.words?.[String(w).toLowerCase()];
      if (entry?.struggling) struggling.push(w);
      else rest.push(w);
    }
    const shuffleArr = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    return [...struggling, ...shuffleArr(rest)].slice(0, windowSize);
  }

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const wordEntry = (w) => masteryState?.words?.[String(w).toLowerCase()];

  // Bucket the list into active / consolidating / retained.
  //
  // Struggling words ALWAYS go into the active bucket, regardless of
  // mastery status. The whole point of the struggling flag is that
  // these words need extra practice — they take precedence over the
  // spaced-repetition schedule until they recover.
  const attempted     = [];
  const untouched     = [];
  const consolidating = [];
  const retained      = [];
  for (const w of fullWordList) {
    const entry = wordEntry(w);
    if (entry?.struggling) {
      attempted.push(w);     // promote into active, head of practice
      continue;
    }
    if (entry?.mastered) {
      const postMaster = entry.spacedRepetition?.postMasterySessions ?? 0;
      if (postMaster < sched.CONSOLIDATING_LIMIT) consolidating.push(w);
      else                                        retained.push(w);
    } else if ((entry?.attempts || 0) > 0) {
      attempted.push(w);
    } else {
      untouched.push(w);
    }
  }

  // Evergreen — every word is mastered. Shuffle the full list as before;
  // tick every selected word's postMasterySessions (treating them all as
  // retained, since the original three-state spec asks for that).
  if (attempted.length === 0 && untouched.length === 0) {
    const out = shuffle(fullWordList).slice(0, windowSize);
    recordSessionAppearance(listId, out);
    return out;
  }

  // Active = attempted (in-list order, keeps a stable practice sequence) +
  // untouched (shuffled for variety).
  const active = [...attempted, ...shuffle(untouched)];

  // Schedule decisions for this session.
  const onConsolidatingTick =
    sched.CONSOLIDATING_FREQ > 0 && (currentSession % sched.CONSOLIDATING_FREQ === 0);
  const onRetainedTick =
    sched.RETAINED_FREQ > 0 && (currentSession % sched.RETAINED_FREQ === 0);

  // Pool builder — fill in active first, then consolidating per schedule
  // (or to keep the pool ≥ MIN_POOL), then retained per schedule (or to
  // still meet MIN_POOL).
  const out = [];
  const reinforcementPicked = []; // mastered words we actually included

  for (const w of active) {
    if (out.length >= windowSize) break;
    out.push(w);
  }

  const needConsolidatingForMin = out.length < sched.MIN_POOL;
  if (onConsolidatingTick || needConsolidatingForMin) {
    for (const w of shuffle(consolidating)) {
      if (out.length >= windowSize) break;
      out.push(w);
      reinforcementPicked.push(w);
    }
  }

  const needRetainedForMin = out.length < sched.MIN_POOL;
  if (onRetainedTick || needRetainedForMin) {
    for (const w of shuffle(retained)) {
      if (out.length >= windowSize) break;
      out.push(w);
      reinforcementPicked.push(w);
    }
  }

  // Tick postMasterySessions for every mastered word that actually
  // appeared in the window. Words selected purely to hit MIN_POOL count
  // too — they're still session appearances for the child.
  if (reinforcementPicked.length > 0) {
    recordSessionAppearance(listId, reinforcementPicked);
  }

  // Final shuffle so reinforcement words aren't always at the tail.
  return shuffle(out);
}

// Exposed for tests / verification — no side effects.
export const _activeWindowInternals = {
  ACTIVE_WINDOW_DEFAULTS,
  ACTIVE_WINDOW_SEN,
  SEN_PROFILES,
};

/**
 * Summarise a list's progress against its mastery state.
 *
 * @param {Array<string>} fullWordList
 * @param {object} masteryState
 * @returns {{ status: 'notStarted'|'inProgress'|'completed',
 *             masteredCount: number,
 *             totalCount: number,
 *             inWindowCount: number }}
 */
export function getListProgressState(fullWordList, masteryState) {
  const total = Array.isArray(fullWordList) ? fullWordList.length : 0;
  if (total === 0) {
    return { status: 'notStarted', masteredCount: 0, totalCount: 0, inWindowCount: 0 };
  }
  let masteredCount  = 0;
  let attemptedCount = 0;
  for (const w of fullWordList) {
    const entry = masteryState?.words?.[String(w).toLowerCase()];
    if (entry?.mastered)         masteredCount  += 1;
    if ((entry?.attempts || 0) > 0) attemptedCount += 1;
  }
  let status;
  if (masteredCount === total)   status = 'completed';
  else if (attemptedCount === 0) status = 'notStarted';
  else                           status = 'inProgress';

  const remaining = total - masteredCount;
  const windowSize = masteryState?.windowSize || 15;
  const inWindowCount = Math.min(windowSize, remaining);

  return { status, masteredCount, totalCount: total, inWindowCount };
}
