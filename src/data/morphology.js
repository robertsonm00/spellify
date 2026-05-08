// Morphological breakdowns for words with clear prefix + root + suffix
// structure. Used by the WordForge activity.
//
// The curated MORPHOLOGY table handles awkward irregular cases (e.g.
// "probably" = "probable" + "ly" with e-drop). detectMorphology() then
// covers the common regular cases algorithmically by checking known
// prefixes/suffixes against curriculum-list roots.

import {
  YEAR1_CEW,
  YEAR2_CEW,
  YEAR3_4,
  YEAR5_6,
} from './spelling/index';

const MORPHOLOGY = [
  // ── Prefix words ───────────────────────────────────────────────
  { word: 'disappear',    prefix: 'dis', root: 'appear' },
  { word: 'impossible',   prefix: 'im',  root: 'possible' },
  { word: 'unhappy',      prefix: 'un',  root: 'happy' },
  { word: 'unfair',       prefix: 'un',  root: 'fair' },
  { word: 'unkind',       prefix: 'un',  root: 'kind' },
  { word: 'preview',      prefix: 'pre', root: 'view' },
  { word: 'incorrect',    prefix: 'in',  root: 'correct' },

  // ── Suffix words ───────────────────────────────────────────────
  { word: 'happiness',    root: 'happy',     suffix: 'ness' },
  { word: 'kindness',     root: 'kind',      suffix: 'ness' },
  { word: 'friendship',   root: 'friend',    suffix: 'ship' },
  { word: 'arrival',      root: 'arrive',    suffix: 'al' },
  { word: 'careful',      root: 'care',      suffix: 'ful' },
  { word: 'hopeful',      root: 'hope',      suffix: 'ful' },
  { word: 'sadness',      root: 'sad',       suffix: 'ness' },
  { word: 'marvellous',   root: 'marvel',    suffix: 'lous' },
  { word: 'dangerous',    root: 'danger',    suffix: 'ous' },
  { word: 'occasionally', root: 'occasion',  suffix: 'ally' },
  { word: 'accidentally', root: 'accident',  suffix: 'ally' },
  { word: 'actually',     root: 'actual',    suffix: 'ly' },
  { word: 'probably',     root: 'probable',  suffix: 'ly' },
];

const PREFIX_BANK = ['dis', 'im', 'in', 'un', 'pre', 're', 'mis'];
const SUFFIX_BANK = ['ness', 'ship', 'al', 'ful', 'lous', 'ous', 'ally', 'ly', 'ment', 'able'];

const BY_WORD = Object.fromEntries(MORPHOLOGY.map((m) => [m.word.toLowerCase(), m]));

// ── Algorithmic detection ───────────────────────────────────────────────────

// Affixes recognised by detectMorphology(). Longer suffixes are tried first
// so e.g. "ness" beats "s", "ation" beats "tion".
const DETECT_PREFIXES = ['under', 'over', 'inter', 'super', 'anti', 'auto', 'sub', 'pre', 'dis', 'mis', 'un', 're', 'in', 'im'];
const DETECT_SUFFIXES = ['ation', 'ously', 'ally', 'ness', 'ment', 'less', 'able', 'ible', 'ship', 'hood', 'ous', 'ful', 'ing', 'tion', 'sion', 'est', 'al', 'ly', 'ed', 'er'];

// Suffixes that produce many false positives ("shoulder = should + er") if
// any curriculum word is accepted as a root. For these we restrict the
// root pool to COMMON_ROOTS — verbs and adjectives that genuinely take
// these inflections.
const NOISY_SUFFIXES = new Set(['ed', 'ing', 'er', 'est']);

// Common verb and adjective roots that take -ed / -ing / -er / -est.
// Hand-picked: covers the suffix-pattern words a primary-school list is
// likely to include without admitting modal verbs ("should") or function
// words that share a tail. Add to this list rather than relaxing the gate.
const COMMON_ROOTS = new Set([
  // Verbs
  'add', 'ask', 'bake', 'bark', 'bath', 'beg', 'blow', 'boil', 'box', 'brush',
  'build', 'burn', 'buzz', 'call', 'camp', 'care', 'carry', 'catch', 'chat',
  'cheer', 'chop', 'clap', 'clean', 'climb', 'close', 'cook', 'count', 'cover',
  'crash', 'cross', 'cry', 'dance', 'dare', 'dip', 'dive', 'draw', 'dream',
  'dress', 'drink', 'drip', 'drive', 'drop', 'dry', 'dust', 'eat', 'enjoy',
  'fall', 'fan', 'farm', 'feed', 'feel', 'fight', 'fill', 'find', 'finish',
  'fish', 'fit', 'fix', 'flap', 'flash', 'float', 'flow', 'fly', 'fold', 'fry',
  'gain', 'give', 'glow', 'grab', 'grin', 'grow', 'guess', 'guide', 'hand',
  'hang', 'hate', 'head', 'hear', 'heat', 'help', 'hide', 'hike', 'hint',
  'hit', 'hold', 'hop', 'hope', 'hug', 'hunt', 'hurry', 'hurt', 'jam', 'jog',
  'join', 'joke', 'jump', 'kick', 'kiss', 'kneel', 'knit', 'knock', 'land',
  'laugh', 'lead', 'lean', 'leap', 'learn', 'leave', 'lend', 'lick', 'lift',
  'like', 'list', 'live', 'lock', 'look', 'lose', 'love', 'mail', 'make',
  'mark', 'match', 'mean', 'meet', 'melt', 'mend', 'mix', 'move', 'munch',
  'nail', 'name', 'nap', 'need', 'note', 'open', 'pack', 'paint', 'pass',
  'pat', 'pause', 'peek', 'peel', 'phone', 'pick', 'plan', 'plant', 'play',
  'plot', 'pluck', 'plug', 'point', 'poke', 'pop', 'post', 'pour', 'pray',
  'press', 'print', 'pull', 'punch', 'push', 'race', 'rain', 'reach', 'read',
  'rest', 'ride', 'ring', 'rip', 'rise', 'roar', 'roll', 'rub', 'run', 'rush',
  'sail', 'save', 'see', 'sell', 'send', 'serve', 'sew', 'shake', 'share',
  'shave', 'shine', 'shop', 'shout', 'show', 'shut', 'sing', 'sink', 'sip',
  'sit', 'skate', 'sketch', 'ski', 'skip', 'slam', 'sleep', 'slide', 'slip',
  'smell', 'smile', 'snap', 'sneak', 'sneeze', 'snore', 'snow', 'soak', 'sob',
  'sort', 'spell', 'spend', 'spill', 'spin', 'splash', 'spoil', 'spot',
  'spray', 'squeeze', 'stack', 'stamp', 'stand', 'stare', 'start', 'stay',
  'steal', 'step', 'stir', 'stop', 'storm', 'study', 'sweep', 'swim', 'swing',
  'switch', 'tag', 'take', 'talk', 'tap', 'taste', 'teach', 'tear', 'tell',
  'thank', 'think', 'throw', 'tie', 'tip', 'touch', 'train', 'trap', 'travel',
  'treat', 'trick', 'trip', 'try', 'turn', 'twist', 'use', 'visit', 'wait',
  'wake', 'walk', 'wander', 'want', 'warn', 'wash', 'watch', 'wave', 'wear',
  'weep', 'whip', 'whisper', 'win', 'wink', 'wipe', 'wish', 'wonder', 'work',
  'worry', 'wrap', 'write', 'yell',
  // Adjectives
  'bad', 'big', 'bold', 'brave', 'bright', 'broad', 'busy', 'calm', 'cheap',
  'clear', 'cold', 'cool', 'cute', 'damp', 'dark', 'deep', 'dim', 'dirty',
  'dull', 'easy', 'fair', 'fast', 'fat', 'few', 'fine', 'firm', 'flat',
  'free', 'fresh', 'full', 'good', 'great', 'green', 'happy', 'hard', 'high',
  'hot', 'huge', 'kind', 'large', 'late', 'lazy', 'light', 'long', 'loose',
  'loud', 'low', 'mild', 'narrow', 'near', 'neat', 'new', 'nice', 'noisy',
  'odd', 'old', 'plain', 'poor', 'proud', 'quick', 'quiet', 'rich', 'rough',
  'round', 'rude', 'sad', 'safe', 'sharp', 'shiny', 'short', 'shy', 'sick',
  'silly', 'slim', 'slow', 'small', 'smart', 'smooth', 'soft', 'sore', 'sour',
  'spicy', 'steep', 'sticky', 'still', 'strong', 'sunny', 'sweet', 'tall',
  'thick', 'thin', 'tight', 'tired', 'tiny', 'tough', 'true', 'ugly', 'warm',
  'weak', 'wet', 'wide', 'wild', 'windy', 'wise', 'witty', 'young',
]);

// Set of curriculum + curated roots. Used for non-noisy suffix probing
// (so words like "marvellous" → "marvel" still resolve via the morphology
// table even though "marvel" isn't a noisy-suffix root).
const KNOWN_WORDS = new Set(
  [
    ...YEAR1_CEW, ...YEAR2_CEW, ...YEAR3_4, ...YEAR5_6,
    ...MORPHOLOGY.map((m) => m.word),
    ...MORPHOLOGY.map((m) => m.root),
  ].map((w) => String(w).toLowerCase())
);

// Try `candidate` as a root, allowing common spelling tweaks (e-drop, i↔y,
// consonant doubling). `pool` controls which root set we accept against.
function resolveRoot(candidate, pool) {
  if (pool.has(candidate))                       return candidate;
  if (pool.has(candidate + 'e'))                 return candidate + 'e';   // arriv → arrive
  if (candidate.endsWith('i')) {
    const swapped = candidate.slice(0, -1) + 'y';
    if (pool.has(swapped)) return swapped;                                 // happi → happy
  }
  if (candidate.length >= 4
      && candidate[candidate.length - 1] === candidate[candidate.length - 2]) {
    const undoubled = candidate.slice(0, -1);
    if (pool.has(undoubled)) return undoubled;                             // runn → run
  }
  return null;
}

// Detect a prefix+root or root+suffix breakdown for `word`. Returns the
// same shape as the curated table, or null if the word isn't decomposable.
function detectMorphology(word) {
  const w = String(word).toLowerCase();
  if (BY_WORD[w]) return BY_WORD[w];

  for (const p of DETECT_PREFIXES) {
    if (w.length - p.length < 3 || !w.startsWith(p)) continue;
    const root = resolveRoot(w.slice(p.length), KNOWN_WORDS);
    if (root) return { word, prefix: p, root };
  }
  for (const s of DETECT_SUFFIXES) {
    if (w.length - s.length < 3 || !w.endsWith(s)) continue;
    const pool = NOISY_SUFFIXES.has(s) ? COMMON_ROOTS : KNOWN_WORDS;
    const root = resolveRoot(w.slice(0, w.length - s.length), pool);
    if (root) return { word, root, suffix: s };
  }
  return null;
}

/** All words that have a morphological breakdown defined. */
export function getMorphologyWords() {
  return MORPHOLOGY.map((m) => m.word);
}

/** Lookup by word; returns null if no breakdown is available. */
export function getMorphology(word) {
  return BY_WORD[String(word).toLowerCase()] || detectMorphology(word);
}

/** True if `word` has a morphological breakdown (curated or detected). */
export function hasMorphology(word) {
  return getMorphology(word) !== null;
}

/** Pick `n` distractor morphemes from the relevant bank, excluding the answer. */
export function pickDistractors(kind, answer, n = 3) {
  const bank = (kind === 'prefix' ? PREFIX_BANK : SUFFIX_BANK).filter((m) => m !== answer);
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export default MORPHOLOGY;
