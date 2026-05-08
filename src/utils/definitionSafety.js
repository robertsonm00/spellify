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
  '\\bsexual\\b',     // catches "sexual maturity", "sexual intercourse", etc.
  '\\bsexually\\b',
  'genitalia',
  '\\bpenis\\b',
  '\\bvagina\\b',
  'masturbat',
  'pornograph',
  'erotic',
  'prostitut',
  'fornicat',
];

// ── Violence / disturbing content ─────────────────────────────────────────────
// Kept narrow on purpose — broad terms like "death" appear benignly in many
// definitions. We only reject clearly disturbing references.
const VIOLENCE_TERMS = [
  '\\bkill\\b',
  '\\bkilled\\b',
  '\\bkilling\\b',
  '\\bkills\\b',
  'murder',
  'suicide',
  'tortur',
  '\\brape\\b',
  'raping',
  'molest',
  '\\bcorpse',
  'dead\\s+body',
  'dead\\s+bodies',
  'genocide',
  'massacre',
  'beheading',
  'lynching',
  'shoot\\s+to\\s+kill',
  'self[-\\s]harm',
];

// ── Pejorative descriptions of people ────────────────────────────────────────
// Dictionary entries often include demeaning slang senses ("a dull, unattractive
// girl or woman" for "dog"). These aren't slurs, but they're not appropriate as
// clues in a children's spelling app.
const PEJORATIVE_TERMS = [
  '\\bunattractive\\b',
  '\\bugly\\b',
  '\\bstupid\\b',
  '\\bdimwit',
  '\\bidiot',
  '\\bmoron',
  '\\bimbecile',
  '\\bcoward\\b',
  '\\bcowardly\\b',
  'reprehensible',
  'despicable',
  'contemptible',
  'morally\\s+(loose|low|bankrupt|corrupt)',
  'low\\s+morals',
  '\\bsleaz',
  '\\bwhore\\b',
  '\\bbitch\\b',
  '\\bbastard\\b',
  '\\bslut\\b',
  '\\bhag\\b',
  '\\bcrone\\b',
  'feeble[-\\s]?minded',
  'mentally\\s+(deficient|defective)',
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
  ...VIOLENCE_TERMS,
  ...PEJORATIVE_TERMS,
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
