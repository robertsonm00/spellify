/**
 * definitionSafety.js
 * Content-safety filter for dictionary definitions shown to children.
 *
 * Rejects any definition that contains drug references, slurs, explicit
 * sexual content, or is labelled offensive/vulgar by the source dictionary.
 *
 * Used by the crossword clue fetcher before a definition is shown to the user.
 * If a definition fails the check, the caller falls back to the generic safe
 * prompt ("Can you spell this word?") rather than showing harmful content.
 */

// ── Editorial markers ─────────────────────────────────────────────────────────
// Many dictionary APIs annotate sensitive definitions with these labels.
// We reject any definition that contains them.
const UNSAFE_MARKERS = [
  'offensive',
  'vulgar',
  'derogatory',
  'taboo',
  'racial slur',
  'ethnic slur',
  'pejorative',
  'disparaging',
  'obscene',
  'profanity',
  'expletive',
];

// ── Drug / substance terms ────────────────────────────────────────────────────
const DRUG_TERMS = [
  'cannabis',
  'marijuana',
  'cocaine',
  'heroin',
  'opium',
  'methamphetamine',
  'amphetamine',
  'ecstasy',
  '\\bmdma\\b',
  '\\blsd\\b',
  'crack cocaine',
  'narcotic',
  'hallucinogen',
  'psychedelic',
  'controlled substance',
  'illicit drug',
  'substance abuse',
  'intoxicant',
  'getting high',
];

// ── Explicit / adult content ──────────────────────────────────────────────────
const ADULT_TERMS = [
  'sexual intercourse',
  'genitalia',
  '\\bpenis\\b',
  '\\bvagina\\b',
  'masturbat',
  'pornograph',
  'erotic',
  'prostitut',
];

// ── Racial / ethnic slurs ─────────────────────────────────────────────────────
// Listed here purely to enable detection and rejection — never displayed.
const SLUR_TERMS = [
  'nigger',
  'nigga',
  '\\bcoon\\b',
  '\\bspic\\b',
  '\\bwetback\\b',
  '\\bgook\\b',
  '\\bchink\\b',
  '\\bkike\\b',
  '\\bwop\\b',
  '\\bdago\\b',
  '\\bpaki\\b',
  '\\brag\\s?head\\b',
  '\\btowel\\s?head\\b',
  '\\bpickaninny\\b',
  '\\bcoon\\b',
  '\\bjigaboo\\b',
  '\\bsambo\\b',
  '\\bzipper\\s?head\\b',
  '\\bslant\\b',
  'a black person',   // definition pattern that appeared for "crow"
  'black person',
];

// ── Build combined regex ──────────────────────────────────────────────────────
const ALL_PATTERNS = [
  ...UNSAFE_MARKERS,
  ...DRUG_TERMS,
  ...ADULT_TERMS,
  ...SLUR_TERMS,
];

const UNSAFE_REGEX = new RegExp(ALL_PATTERNS.join('|'), 'i');

/**
 * Returns true if a definition is safe to show to a child.
 * Returns false if it contains any flagged content.
 *
 * @param {string|null|undefined} text
 * @returns {boolean}
 */
export function isSafeDefinition(text) {
  if (!text || typeof text !== 'string') return false;
  return !UNSAFE_REGEX.test(text);
}
