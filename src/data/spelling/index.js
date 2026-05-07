// UK National Curriculum statutory spelling word lists, organised by year group.
//
// Authoritative source for the full Y3&4 (100) and Y5&6 (100) statutory lists
// from English Appendix 1 of the NC 2014 framework. Where the published lists
// use compound entries (e.g. "accident(ally)", "busy/business") we expand each
// form into its own word so each variant can be practised independently.
//
// Y1 and Y2 use the existing high-frequency / common exception word lists.
// Y3 and Y4 share the same 100-word statutory pool (year3_4).
// Y5 and Y6 share the same 100-word statutory pool (year5_6).

// ── Statutory category pools ───────────────────────────────────────────────

/**
 * Year 1 Common Exception Words (NC 2014, English Appendix 1).
 * 45 words taught and assessed in Year 1.
 */
export const YEAR1_CEW = [
  'the', 'a', 'do', 'to', 'today', 'of', 'said', 'says', 'are', 'were',
  'was', 'is', 'his', 'has', 'I', 'you', 'your', 'they', 'be', 'he',
  'me', 'she', 'we', 'no', 'go', 'so', 'by', 'my', 'here', 'there',
  'where', 'love', 'come', 'some', 'one', 'once', 'ask', 'friend',
  'school', 'put', 'push', 'pull', 'full', 'house', 'our',
];

/**
 * Year 3 & 4 statutory spelling list (NC 2014, English Appendix 1).
 * The published list contains 100 entries; compound entries
 * (e.g. accident(ally), busy/business) are expanded so every form
 * appears as its own word — yielding 109 individually-practiseable words.
 */
export const YEAR3_4 = [
  'accident', 'accidentally', 'actual', 'actually', 'address', 'although',
  'answer', 'appear', 'arrive', 'believe', 'bicycle', 'breath', 'breathe',
  'build', 'business', 'busy', 'calendar', 'caught', 'centre', 'century',
  'certain', 'circle', 'complete', 'consider', 'continue', 'decide',
  'describe', 'different', 'difficult', 'disappear', 'early', 'earth',
  'eight', 'eighth', 'enough', 'exercise', 'experience', 'experiment',
  'extreme', 'famous', 'favourite', 'February', 'forward', 'forwards',
  'fruit', 'grammar', 'group', 'guard', 'guide', 'heard', 'heart',
  'height', 'history', 'imagine', 'important', 'increase', 'interest',
  'island', 'knowledge', 'learn', 'length', 'library', 'material',
  'medicine', 'mention', 'minute', 'natural', 'naughty', 'notice',
  'occasion', 'occasionally', 'often', 'opposite', 'ordinary',
  'particular', 'peculiar', 'perhaps', 'popular', 'position', 'possess',
  'possession', 'possible', 'potatoes', 'pressure', 'probably', 'promise',
  'purpose', 'quarter', 'question', 'recent', 'regular', 'reign',
  'remember', 'sentence', 'separate', 'special', 'straight', 'strange',
  'strength', 'suppose', 'surprise', 'therefore', 'though', 'thought',
  'through', 'various', 'weight', 'woman', 'women',
];

/**
 * Year 5 & 6 statutory spelling list (NC 2014, English Appendix 1).
 * Compound entries (equip/equipped/equipment, immediate/immediately,
 * sincere/sincerely) are expanded so every form is practiseable —
 * yielding 104 individual words.
 */
export const YEAR5_6 = [
  'accommodate', 'accompany', 'according', 'achieve', 'aggressive', 'amateur',
  'ancient', 'apparent', 'appreciate', 'attached', 'available', 'average',
  'awkward', 'bargain', 'bruise', 'category', 'cemetery', 'committee',
  'communicate', 'community', 'competition', 'conscience', 'conscious',
  'controversy', 'convenience', 'correspond', 'criticise', 'curiosity',
  'definite', 'desperate', 'determined', 'develop', 'dictionary',
  'disastrous', 'embarrass', 'environment', 'equip', 'equipped', 'equipment',
  'especially', 'exaggerate', 'excellent', 'existence', 'explanation',
  'familiar', 'foreign', 'forty', 'frequently', 'government', 'guarantee',
  'harass', 'hindrance', 'identity', 'immediate', 'immediately',
  'individual', 'interfere', 'interrupt', 'language', 'leisure', 'lightning',
  'marvellous', 'mischievous', 'muscle', 'necessary', 'neighbour',
  'nuisance', 'occupy', 'occur', 'opportunity', 'parliament', 'persuade',
  'physical', 'prejudice', 'privilege', 'profession', 'programme',
  'pronunciation', 'queue', 'recognise', 'recommend', 'relevant',
  'restaurant', 'rhyme', 'rhythm', 'sacrifice', 'secretary', 'shoulder',
  'signature', 'sincere', 'sincerely', 'soldier', 'stomach', 'sufficient',
  'suggest', 'symbol', 'system', 'temperature', 'thorough', 'twelfth',
  'variety', 'vegetable', 'vehicle', 'yacht',
];

// ── Y1 / Y2 working lists (existing high-frequency / CEW pools) ────────────

const YEAR1_WORDS = [
  'the','a','do','to','today','of','said','says','are','were','was','is',
  'his','has','you','your','they','be','he','she','we','me','no','my',
  'by','all','sure','come','some','here','there','when','what','one','out',
  'like','little','look','have','put','day','made','make','came','home',
  'old','time','back','very','much','door','only','who',
];

const YEAR2_WORDS = [
  'door','floor','poor','because','find','kind','mind','behind','child',
  'children','wild','climb','most','only','both','cold','gold','hold','told',
  'every','great','break','pretty','beautiful','after','fast','last','past',
  'father','class','grass','plant','path','bath','hour','move','prove',
  'improve','sure','sugar','eye','could','should','would','whole','any',
  'many','clothes','busy','people','water','again','half','money','everybody',
];

// ── YEAR_DATA — keyed by school year for backwards compatibility ───────────
// Y3 and Y4 both pull from YEAR3_4; Y5 and Y6 both pull from YEAR5_6.

export const YEAR_DATA = {
  1: { year: 1, label: 'Year 1', ageRange: [5, 6],  words: YEAR1_WORDS },
  2: { year: 2, label: 'Year 2', ageRange: [6, 7],  words: YEAR2_WORDS },
  3: { year: 3, label: 'Year 3', ageRange: [7, 8],  words: YEAR3_4 },
  4: { year: 4, label: 'Year 4', ageRange: [8, 9],  words: YEAR3_4 },
  5: { year: 5, label: 'Year 5', ageRange: [9, 10], words: YEAR5_6 },
  6: { year: 6, label: 'Year 6', ageRange: [10, 11], words: YEAR5_6 },
};

/** Convert age (5-11) to the most likely school year (1-6). */
export function ageToYear(age) {
  return Math.max(1, Math.min(6, age - 4));
}

/** Pick `count` random words from the given year (1-6). */
export function getWordsForYear(year, count = 20) {
  const data = YEAR_DATA[Math.max(1, Math.min(6, year))] || YEAR_DATA[3];
  const shuffled = [...data.words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Get the age range string for a year, e.g. "ages 7–8" */
export function getAgeRangeLabel(year) {
  const data = YEAR_DATA[year];
  if (!data) return '';
  return `ages ${data.ageRange[0]}–${data.ageRange[1]}`;
}

export const YEAR_LABELS = Object.fromEntries(
  Object.values(YEAR_DATA).map(({ year, label }) => [year, label])
);

/**
 * Return words as objects with difficulty derived from word length.
 * length <= 4 → 'easy', length <= 7 → 'medium', else 'hard'
 */
export function getWordObjects(year, count = 20) {
  const words = getWordsForYear(year, count);
  return words.map((word) => ({
    word,
    year: Math.max(1, Math.min(6, year)),
    difficulty: word.length <= 4 ? 'easy' : word.length <= 7 ? 'medium' : 'hard',
  }));
}

/**
 * Select words for a session.
 * dyslexiaMode is accepted but currently a no-op.
 */
export function selectWords({ year, count = 20, dyslexiaMode }) {
  return getWordsForYear(year, count);
}

export default YEAR_DATA;
