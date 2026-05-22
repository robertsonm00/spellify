/**
 * Spellify Word Banks
 * ===================
 * Three high-frequency reference collections that sit alongside the
 * curriculum lesson browser in the Explore section.
 *
 * These are NOT lessons — they are browsable word reference banks.
 * Full word data (definitions, sentences, difficulty etc.) is resolved
 * at runtime via wordLookup.js from ks1WordData_v14.js / ks2WordData_v27.js.
 *
 * Visibility rules (enforced by the Explore UI):
 *   hf-ks1  → Y1 and Y2 only
 *   hf-y34  → Y3 and Y4 only
 *   hf-y56  → Y5 and Y6 only
 *
 * All words in these banks must exist in the word database.
 * Run checkCoverage.mjs after any changes to verify.
 *
 * Last updated: 2026-05-21 — Fix 1: replace HF_KS1 with canonical DfE/Letters and Sounds 100 HFW list
 *                           Fix 2: add 23 displaced words to HF_Y34
 */

// ── Bank 1: KS1 High-Frequency Words (Y1/Y2) ────────────────────────────────
// The ~100 most common words in UK primary reading and writing.
// Many overlap with the Y1/Y2 statutory CEW lists — this bank gives
// children a single browsable reference for all the words they will
// encounter most often in books and their own writing.

export const HF_KS1 = {
  id: 'hf-ks1',
  name: 'High-Frequency Words',
  description: 'The most common words in books and writing — learn these and reading gets much easier.',
  yearsVisible: [1, 2],
  category: 'Word Bank',
  words: [
    'the', 'and', 'a', 'to', 'said', 'in', 'he', 'I', 'of', 'it',
    'was', 'you', 'they', 'on', 'she', 'is', 'for', 'at', 'his', 'but',
    'that', 'with', 'all', 'we', 'can', 'are', 'up', 'had', 'my', 'her',
    'what', 'there', 'out', 'this', 'have', 'went', 'be', 'like', 'some', 'so',
    'not', 'then', 'were', 'go', 'little', 'as', 'no', 'mum', 'one', 'them',
    'do', 'me', 'down', 'dad', 'big', 'when', "it's", 'see', 'looked', 'very',
    'look', "don't", 'come', 'will', 'into', 'back', 'from', 'children', 'him', 'Mr',
    'get', 'just', 'now', 'came', 'oh', 'about', 'got', 'their', 'people', 'your',
    'put', 'could', 'house', 'old', 'too', 'by', 'day', 'made', 'time', "I'm",
    'if', 'help', 'Mrs', 'called', 'here', 'off', 'asked', 'saw', 'make', 'an',
  ],
};

// ── Bank 2: Y3/4 Academic Vocabulary ────────────────────────────────────────
// ~80 words that appear constantly in KS2 reading and writing across
// all subjects. These are the words children need to read fluently and
// spell accurately to access the curriculum at Y3/Y4 level.

export const HF_Y34 = {
  id: 'hf-y34',
  name: 'Key Vocabulary',
  description: 'Words you will see again and again in reading and writing across all subjects.',
  yearsVisible: [3, 4],
  category: 'Word Bank',
  words: [
    'because', 'before', 'between', 'below', 'both', 'call', 'came', 'great',
    'group', 'hand', 'hard', 'high', 'home', 'however', 'important', 'just',
    'keep', 'kind', 'know', 'large', 'last', 'learn', 'left', 'life', 'light',
    'long', 'look', 'made', 'make', 'might', 'move', 'much', 'must', 'name',
    'need', 'never', 'new', 'next', 'night', 'old', 'once', 'only', 'open',
    'own', 'part', 'place', 'play', 'point', 'put', 'read', 'right', 'round',
    'same', 'say', 'show', 'small', 'still', 'such', 'take', 'tell', 'through',
    'try', 'turn', 'under', 'until', 'very', 'water', 'well', 'went', 'while',
    'work', 'world', 'write', 'year', 'also', 'back', 'away', 'each', 'every',
    'after', 'any', 'been', 'did', 'good', 'has', 'how', 'its',
    'many', 'may', 'more', 'or', 'other', 'our', 'over', 'than',
    'these', 'two', 'use', 'way', 'where', 'which', 'would',
  ],
};

// ── Bank 3: Y5/6 SATs Vocabulary ────────────────────────────────────────────
// The complete Y5/6 statutory word list plus additional high-value vocabulary
// that appears in KS2 SATs assessments and advanced reading at this level.
// Knowing these words — and being able to spell them — is a significant
// advantage in Y6 assessments.

export const HF_Y56 = {
  id: 'hf-y56',
  name: 'SATs Vocabulary',
  description: 'The most important words for Y5 and Y6 — many of these come up in assessments.',
  yearsVisible: [5, 6],
  category: 'Word Bank',
  words: [
    'accommodate', 'accompany', 'according', 'achieve', 'aggressive', 'amateur',
    'ancient', 'apparent', 'appreciate', 'attached', 'available', 'average',
    'awkward', 'bargain', 'bruise', 'category', 'cemetery', 'committee',
    'communicate', 'community', 'competition', 'conscience', 'conscious',
    'correspond', 'criticise', 'curiosity', 'definite', 'desperate',
    'determined', 'develop', 'dictionary', 'embarrass', 'environment',
    'especially', 'exaggerate', 'excellent', 'existence', 'explanation',
    'familiar', 'foreign', 'frequently', 'government', 'guarantee',
    'harass', 'hindrance', 'identity', 'immediate', 'individual',
    'interfere', 'interrupt', 'language', 'leisure', 'lightning',
    'marvellous', 'mischievous', 'muscle', 'necessary', 'neighbour',
    'nuisance', 'occupy', 'occur', 'opportunity', 'parliament',
    'persuade', 'physical', 'prejudice', 'privilege', 'profession',
    'programme', 'pronunciation', 'queue', 'recognise', 'recommend',
    'relevant', 'restaurant', 'rhyme', 'rhythm', 'sacrifice',
    'secretary', 'shoulder', 'sincere', 'soldier', 'stomach',
    'sufficient', 'suggest', 'symbol', 'system', 'temperature',
    'thorough', 'variety', 'vegetable', 'vehicle', 'yacht',
  ],
};

// ── Exports ──────────────────────────────────────────────────────────────────

export const WORD_BANKS = [HF_KS1, HF_Y34, HF_Y56];

export function getWordBanksForYear(year) {
  return WORD_BANKS.filter(bank => bank.yearsVisible.includes(year));
}
