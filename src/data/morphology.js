// Morphological breakdowns for Y3-6 statutory words with clear
// prefix + root + suffix structure. Used by the WordForge activity.
//
// Each entry: { word, root, prefix?, suffix?, definitionHint? }
// All words listed here also exist in src/data/spelling/index.js.

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

/** All words that have a morphological breakdown defined. */
export function getMorphologyWords() {
  return MORPHOLOGY.map((m) => m.word);
}

/** Lookup by word; returns null if no breakdown is available. */
export function getMorphology(word) {
  return BY_WORD[String(word).toLowerCase()] || null;
}

/** Pick `n` distractor morphemes from the relevant bank, excluding the answer. */
export function pickDistractors(kind, answer, n = 3) {
  const bank = (kind === 'prefix' ? PREFIX_BANK : SUFFIX_BANK).filter((m) => m !== answer);
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export default MORPHOLOGY;
