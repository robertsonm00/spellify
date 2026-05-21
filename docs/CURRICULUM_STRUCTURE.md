# Spellify — Curriculum Structure Reference
**Version 1.0 — Phase A: Strand Taxonomy, Lesson Schema & Full Skeleton**
*Authored: 2026-05-12. This document is the canonical reference for all curriculumLists.js authoring.*

---

## 1. Purpose

This document defines how Spellify structures its spelling curriculum. It serves as:

- The authoritative reference for anyone authoring or modifying lessons in `src/data/curriculumLists.js`
- The design rationale for the curriculum browser's filtering and progressive disclosure system
- The alignment record against the UK National Curriculum 2014, English Appendix 1 (Spelling)

Any deviation from this structure must be documented here before implementation.

---

## 2. NC 2014 Foundation

The curriculum is grounded in **English Appendix 1: Spelling** from the UK National Curriculum 2014 framework. All statutory word lists, teaching sequences, and terminology follow this document.

Key principles from the NC that Spellify's structure reflects:

> *"Pupils should be taught to apply their growing knowledge of root words, prefixes and suffixes (morphology and etymology) as listed in Appendix 1 of the National Curriculum both to read aloud and to understand the meaning of new words they meet."*

> *"The focus in Years 1 and 2 is on securing knowledge of grapheme-phoneme correspondences; in KS2 the focus shifts progressively toward morphology and etymology."*

This progression — phonics → orthographic patterns → morphology → etymology — is the spine of Spellify's strand taxonomy.

---

## 3. Strand Taxonomy

Lessons belong to exactly **one primary strand**. Words within a lesson may carry multiple `patternGroup` tags in the v13/v26 word databases, but the lesson itself has one strand for navigation purposes.

### 3.1 The Five Teaching Strands

| Strand | Code | Colour | Years active | Description |
|---|---|---|---|---|
| `phonics` | `ph` | Purple | Y1–Y2 (primary), Y3 (extension) | Letter-sound correspondences, grapheme-phoneme relationships, phonics programme content |
| `patterns` | `pt` | Teal | Y1–Y6 | Orthographic rules and spelling conventions (doubling, split digraph, homophones, -ough, ei/ie) |
| `morphology` | `mo` | Blue | Y2–Y6 | Prefixes, suffixes, word building, inflection, derivation, compound words |
| `etymology` | `et` | Amber | Y3–Y6 | Word origins — Greek roots, Latin roots, French loanwords, British conventions, silent letters from history |
| `statutory` | `st` | Grey | Y1–Y6 | NC-mandated word lists (Y1 CEW, Y2 CEW, Y3/4 Statutory, Y5/6 Statutory) |

### 3.2 High-Frequency Reference Sets

These are **not lessons** — they are large reference collections that sit alongside the structured curriculum. They do not appear in the regular lesson browser. They are accessed via a dedicated "Word Banks" section.

| Set | Code | Size | Purpose |
|---|---|---|---|
| Y1/Y2 High-Frequency Words | `hf-ks1` | ~100 words | The 100 most common words in written English; sight-reading priority |
| Y3/Y4 Academic Vocabulary | `hf-y34` | ~80 words | High-frequency words in primary school writing and reading |
| Y5/Y6 Academic Vocabulary | `hf-y56` | ~100 words | SATs-level vocabulary; secondary readiness |

---

## 4. Lesson Schema

Every lesson in `curriculumLists.js` must conform to this schema exactly.

```js
{
  // REQUIRED FIELDS
  id: String,           // See Section 4.1 — ID Convention
  name: String,         // Display name — clear, child-friendly, max 35 chars
  year: Number,         // 1–6 (school year)
  strand: String,       // 'phonics' | 'patterns' | 'morphology' | 'etymology' | 'statutory'
  ageRange: [Number, Number], // e.g. [5, 6] for Y1, [7, 8] for Y3
  category: String,     // Display category label (see Section 4.3)
  categoryColour: String, // See Section 4.3
  difficulty: String,   // 'easy' | 'medium' | 'hard' — see Section 4.4
  ncReference: String,  // NC 2014 English Appendix 1 reference string
  description: String,  // 1–2 sentence teaching rationale, child-accessible, max 120 chars
  wordCount: Number,    // Actual count of words[] entries
  words: Array,         // Array of {word, definition} — see Section 4.2

  // OPTIONAL FIELDS (used by filtering system)
  isRevision: Boolean,  // true if this is a revision/consolidation lesson
  prerequisiteIds: Array, // lesson IDs that should be completed first (future adaptive use)
}
```

### 4.1 ID Convention

Format: `y[year]-[strandCode]-[slug]`

- `year`: 1–6 (school year number)
- `strandCode`: `ph`, `pt`, `mo`, `et`, `st`
- `slug`: kebab-case description of the lesson content, max 4 words

Examples:
- `y1-ph-ck-words` — Year 1 Phonics: CK digraph words
- `y3-pt-ough-family` — Year 3 Patterns: -ough spelling family
- `y5-mo-ology-roots` — Year 5 Morphology: -ology Greek roots
- `y4-st-statutory-a-d` — Year 4 Statutory: A–D words

IDs are permanent. Once assigned, they must not be changed (they are used as keys in mastery tracking, localStorage, and future Supabase session records).

### 4.2 Word Entry Schema

Each entry in `words[]` follows this shape:

```js
{ word: String, definition: String }
```

- `word`: lowercase, matches the headword in v13/v26 exactly
- `definition`: the curated short definition from `curriculumLists.js` — this is the fallback shown in lesson cards. Rich data (sentences, syllables, tricky parts) comes from `wordLookup.js` at render time.

**Word count target: 12–15 per lesson.** Exceptions: statutory lessons may contain up to 20 if the alphabetical range demands it.

### 4.3 Category Labels and Colours

| `category` | `categoryColour` | Used by strand(s) |
|---|---|---|
| `'Phonics'` | `'purple'` | phonics |
| `'Patterns'` | `'teal'` | patterns |
| `'Morphology'` | `'blue'` | morphology |
| `'Etymology'` | `'amber'` | etymology |
| `'Statutory'` | `'gray'` | statutory |
| `'Sight Words'` | `'green'` | (high-frequency sets only) |

The `CATEGORY_COLOURS` export in `curriculumLists.js` must be updated to include all of the above.

### 4.4 Difficulty Derivation

Lesson difficulty is **derived** from the modal (most frequent) difficulty of its constituent words, using the v13/v26 word entries. The derivation rule:

- **easy**: ≥ 60% of words in the lesson have `difficulty: 'easy'` in v13/v26
- **hard**: ≥ 60% of words have `difficulty: 'hard'`
- **medium**: everything else (mixed or majority medium)

For lessons whose words are not yet in v13/v26 (unlikely given 100% coverage, but as a fallback), difficulty should default to `'medium'`.

In practice, Y1–Y2 lessons will mostly be `'easy'`; Y5–Y6 lessons will mostly be `'hard'`.

---

## 5. Progressive Disclosure Rules

These rules determine which lessons a user sees by default, based on their year group setting.

| User's year | Default visible years | Rationale |
|---|---|---|
| Y1 | Y1 only | Foundation phase — don't overwhelm |
| Y2 | Y1, Y2 | Y1 revision is common and expected |
| Y3 | Y1, Y2, Y3 | KS2 entry; Y1/Y2 phonics remains useful |
| Y4 | Y2, Y3, Y4 | Y1 phonics can be archived (optional) |
| Y5 | Y3, Y4, Y5 | KS2 mid-point; earlier years as revision |
| Y6 | Y4, Y5, Y6 | Exam-year focus; Y4 accessible as revision |

Users can always manually browse earlier years. These are defaults, not locks.

**Teacher/parent override (future):** When the teacher dashboard ships, teachers can restrict to a narrower band (e.g. "only Y6 lessons") or expand it (e.g. "show all years for a SEN pupil revising from foundations").

---

## 6. Filtering System Design

The curriculum browser supports filtering on three independent axes:

| Axis | Options | Notes |
|---|---|---|
| **Year** | Y1 / Y2 / Y3 / Y4 / Y5 / Y6 / All | Progressive disclosure applies as default |
| **Strand** | Phonics / Patterns / Morphology / Etymology / Statutory / All | Any combination |
| **Difficulty** | Easy / Medium / Hard / All | Based on lesson-level difficulty (Section 4.4) |

A fourth future axis:

| **Statutory only** | Toggle | Surfaces NC-mandated content only — useful for test prep |

Combinations that return zero results should show a clear "no lessons match" state, not a blank screen.

---

## 7. Strand Rationale (for educational reference)

### 7.1 Phonics (Y1–Y2)

Phonics is the decoding layer. Children learn to map sounds (phonemes) to their written representations (graphemes). This follows the Systematic Synthetic Phonics (SSP) approach required by the NC since 2012.

Teaching sequence follows Letters & Sounds Phases 2–6 / Read Write Inc. ordering:
1. Simple CVC words with short vowels
2. Consonant digraphs (sh, ch, th, ng, ck)
3. Vowel digraphs and long vowel sounds (ai, ee, igh, oa, oo, ar, or, ur)
4. Consonant blends
5. Split digraphs (magic e: a-e, i-e, o-e, u-e, e-e)
6. Alternative spellings of sounds learned earlier

Phonics lessons are primarily Y1/Y2. Some extend into Y3 for alternative grapheme representations (e.g. ch = /k/ as in school, or sc = /s/ as in science).

### 7.2 Patterns (Y1–Y6)

Patterns are orthographic rules — the conventions that govern how sounds are represented in different word positions or letter combinations. Unlike pure phonics, patterns often require the child to understand context (e.g. -dge vs -ge depends on preceding vowel length).

Key pattern groups covered across Y1–Y6:
- Doubling consonants before vowel suffixes
- Dropping the silent e before vowel suffixes
- y → i transformations
- The -ough spelling family (eight distinct pronunciations)
- ei vs ie (the "i before e" rule and its exceptions)
- Homophones and near-homophones
- -cious/-tious, -cial/-tial, -ance/-ence, -able/-ible

### 7.3 Morphology (Y2–Y6)

Morphology — the study of meaningful word parts — is the single biggest lever for vocabulary acquisition in KS2. Research consistently shows that morphological awareness predicts reading comprehension more strongly than phonics knowledge by Y3/4.

Spellify's morphology strand covers:
- **Prefixes** (un-, dis-, mis-, re-, pre-, sub-, super-, anti-, auto-, in-, im-, il-, ir-, over-, under-, de-, e-)
- **Derivational suffixes** (-ly, -ful, -less, -ness, -ment, -tion, -sion, -ous, -ious, -ation, -able, -ible, -ance, -ence, -ary, -ory, -al, -ial, -ical, -ify, -ise, -ize, -en)
- **Inflectional suffixes** (-s, -es, -ed, -ing, -er, -est — primarily Y1/Y2 via Patterns strand)
- **Compound words** (compound formation and recognition)
- **Word families** (groups of words sharing a root: act → action, react, transact, actor, active)

### 7.4 Etymology (Y3–Y6)

Etymology — the study of word origins — is introduced in Y3 and deepens progressively. It explains *why* English words are spelled in apparently illogical ways (silent letters from older pronunciations; Greek ph = f; Latin roots; French loanwords).

Spellify's etymology strand covers:
- **Greek roots**: -graph, -logy, -phone, -scope, -photo, -micro, -tele, -meter, -chrono, -geo, -bio, -hydro, -thermo, -poly, -anti-
- **Latin roots**: aqua-, terra-, port-, dict-, scrib-/script-, struct-/stru-, rupt-, vis-/vid-, aud-, lum-, ject-
- **French loanwords**: the /sh/ sound from ch (chef, chauffeur), silent terminal consonants (ballet, bouquet), -que endings (antique, critique)
- **British spelling conventions**: -our endings (colour, favour, behaviour), -re endings (centre, theatre), -ise vs -ize
- **Silent letters from history**: kn- (knight, knee), wr- (write, wrist), mb (lamb, comb), gn- (gnome, gnat), ps- (psychology, psalm)

### 7.5 Statutory (Y1–Y6)

The statutory word lists are mandated by NC 2014 English Appendix 1. Children are expected to learn these words for their year group and be able to spell them correctly in their writing by the end of the key stage.

- **Y1 CEW**: 45 words (common exception words — irregular or tricky)
- **Y2 CEW**: 63 words (common exception words — extending irregularity)
- **Y3/4 Statutory**: 100 words (expanded to 109 when compound entries like accident/accidentally are separated)
- **Y5/6 Statutory**: 100 words (expanded to 104 when compound entries like immediate/immediately are separated)

Statutory lessons present words in **alphabetical groups of 12–15** within their year band. Y3/4 words appear in Y3 and can be revised in Y4. Y5/6 words appear in Y5 and are revised in Y6.

Many statutory words also appear in other strands. A word like *accommodation* is both statutory (Y5/6) AND a morphology lesson word (double c + double m pattern). It should appear in both. This is intentional — statutory lessons are for test-prep; strand lessons are for pattern-teaching.

---

## 8. Full Lesson Skeleton

This is the complete list of all planned lessons, organised by year and strand. **Status**: Skeleton only — word lists to be authored in Phase C.

Target total: **~145 lessons** across all six years.

---

### YEAR 1 (ages 5–6) — 28 lessons

#### Phonics (18 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y1-ph-short-a-cvc` | Short A Words | Y1 phonics programme: short vowels | easy |
| `y1-ph-short-e-cvc` | Short E Words | Y1 phonics programme: short vowels | easy |
| `y1-ph-short-i-cvc` | Short I Words | Y1 phonics programme: short vowels | easy |
| `y1-ph-short-o-cvc` | Short O Words | Y1 phonics programme: short vowels | easy |
| `y1-ph-short-u-cvc` | Short U Words | Y1 phonics programme: short vowels | easy |
| `y1-ph-ch-sh-digraphs` | CH and SH Words | Y1 phonics: consonant digraphs | easy |
| `y1-ph-th-ng-digraphs` | TH and NG Words | Y1 phonics: consonant digraphs | easy |
| `y1-ph-ck-digraph` | CK Words | Y1 phonics: consonant digraphs | easy |
| `y1-ph-ll-ss-ff-zz` | Double Endings | Y1 phonics: final doubles | easy |
| `y1-ph-ai-ay-long-a` | AI and AY Words | Y1 phonics: vowel digraphs — long a | easy |
| `y1-ph-ee-ea-long-e` | EE and EA Words | Y1 phonics: vowel digraphs — long e | easy |
| `y1-ph-igh-long-i` | IGH Words | Y1 phonics: vowel digraphs — long i | easy |
| `y1-ph-oa-ow-long-o` | OA and OW Words | Y1 phonics: vowel digraphs — long o | easy |
| `y1-ph-oo-vowel` | OO Words | Y1 phonics: vowel digraph oo (both sounds) | easy |
| `y1-ph-ar-or-sounds` | AR and OR Words | Y1 phonics: vowel sounds ar, or | easy |
| `y1-ph-er-ir-ur` | ER, IR and UR Words | Y1 phonics: the /ɜː/ sound | easy |
| `y1-ph-initial-blends-1` | Blends — BL, CL, FL, GL, PL, SL | Y1 phonics: consonant clusters | easy |
| `y1-ph-initial-blends-2` | Blends — BR, CR, DR, FR, GR, TR | Y1 phonics: consonant clusters | easy |

#### Patterns (6 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y1-pt-split-digraph-ae` | Magic E — A-E Words | Y1 patterns: split digraph a-e | easy |
| `y1-pt-split-digraph-ie` | Magic E — I-E Words | Y1 patterns: split digraph i-e | easy |
| `y1-pt-split-digraph-oe` | Magic E — O-E and U-E Words | Y1 patterns: split digraph o-e, u-e | easy |
| `y1-pt-plurals` | Making Plurals | Y1 patterns: adding -s and -es | easy |
| `y1-pt-adding-ing` | Adding -ING | Y1 patterns: inflectional suffix -ing | easy |
| `y1-pt-adding-ed` | Adding -ED | Y1 patterns: inflectional suffix -ed | easy |

#### Statutory (4 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y1-st-cew-a-m` | Y1 Exception Words A–M | Y1 CEW statutory list | easy |
| `y1-st-cew-n-z` | Y1 Exception Words N–Z | Y1 CEW statutory list | easy |
| `y1-st-cew-tricky` | Trickiest Y1 Words | Y1 CEW: highest-frequency exceptions | easy |
| `y1-st-number-colour-words` | Numbers and Colours | Y1 high-frequency thematic set | easy |

---

### YEAR 2 (ages 6–7) — 26 lessons

#### Phonics (8 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y2-ph-dge-ge-j` | DGE, GE and J Words | Y2 phonics: the /dʒ/ sound | easy |
| `y2-ph-soft-c` | Soft C Words | Y2 phonics: the /s/ sound spelt c | easy |
| `y2-ph-kn-gn-silent` | KN and GN Words | Y2 phonics: silent k and g | easy |
| `y2-ph-wr-silent` | WR Words | Y2 phonics: silent w | easy |
| `y2-ph-le-el-al-endings` | -LE, -EL and -AL Endings | Y2 phonics: word endings | easy |
| `y2-ph-y-ie-long-i` | Y and IE for Long I | Y2 phonics: /aɪ/ sound at word end | easy |
| `y2-ph-ey-long-e` | EY Words | Y2 phonics: /iː/ sound spelt ey | easy |
| `y2-ph-ow-two-sounds` | OW — Two Sounds | Y2 phonics: ow as in cow and snow | easy |

#### Patterns (10 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y2-pt-doubling-ing-ed` | Doubling Before -ING and -ED | Y2 patterns: doubling rule | easy |
| `y2-pt-drop-e-before-suffix` | Drop the E | Y2 patterns: final e before vowel suffix | easy |
| `y2-pt-y-to-i` | Changing Y to I | Y2 patterns: y → i before suffix | easy |
| `y2-pt-a-before-l` | The /AW/ Sound — A Before L | Y2 patterns: /ɔː/ spelt a before l/ll | easy |
| `y2-pt-o-for-u-sound` | O Making the /U/ Sound | Y2 patterns: /ʌ/ spelt o | easy |
| `y2-pt-ou-for-u-sound` | OU Making the /U/ Sound | Y2 patterns: /ʌ/ spelt ou | easy |
| `y2-pt-homophones-1` | Homophones — Set 1 | Y2 patterns: there/their/they're, here/hear | easy |
| `y2-pt-homophones-2` | Homophones — Set 2 | Y2 patterns: quite/quiet, which/witch | easy |
| `y2-pt-tion-intro` | -TION Endings — First Steps | Y2 patterns: introduction to /ʃn/ | medium |
| `y2-pt-er-est-er` | Adding -ER and -EST | Y2 patterns: comparative suffixes | easy |

#### Morphology (4 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y2-mo-prefix-un` | The Prefix UN- | Y2 morphology: prefix un- | easy |
| `y2-mo-suffix-ful-less` | -FUL and -LESS | Y2 morphology: suffixes -ful and -less | easy |
| `y2-mo-suffix-ness-ment` | -NESS and -MENT | Y2 morphology: suffixes -ness and -ment | easy |
| `y2-mo-suffix-ly` | The -LY Suffix | Y2 morphology: adverb suffix -ly | easy |

#### Statutory (4 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y2-st-cew-a-m` | Y2 Exception Words A–M | Y2 CEW statutory list | easy |
| `y2-st-cew-n-z` | Y2 Exception Words N–Z | Y2 CEW statutory list | easy |
| `y2-st-cew-tricky` | Trickiest Y2 Words | Y2 CEW: most commonly misspelt | medium |
| `y2-st-days-months` | Days and Months | High-frequency thematic: calendar words | easy |

---

### YEAR 3 (ages 7–8) — 28 lessons

#### Phonics — extended (5 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y3-ph-ch-as-k` | CH Making the /K/ Sound | Y3 phonics: ch in Greek-origin words | medium |
| `y3-ph-sc-as-s` | SC Making the /S/ Sound | Y3 phonics: sc in Latin-origin words | medium |
| `y3-ph-ei-eigh-ey` | EI, EIGH and EY Words | Y3 phonics: the /eɪ/ sound | medium |
| `y3-ph-y-as-i` | Y Making the /I/ Sound | Y3 phonics: y in Greek-origin words | medium |
| `y3-ph-ough-family` | The -OUGH Family | Y3 phonics: 6+ sounds from -ough | hard |

#### Patterns (8 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y3-pt-silent-kn-wr` | Silent KN and WR | Y3 patterns: silent consonants | medium |
| `y3-pt-silent-mb-gn` | Silent MB and GN | Y3 patterns: silent consonants | medium |
| `y3-pt-tion-sion` | -TION and -SION Endings | Y3 patterns: the /ʃn/ sound | medium |
| `y3-pt-ture-ending` | -TURE Endings | Y3 patterns: creature, nature, picture | medium |
| `y3-pt-ous-ending` | -OUS Endings | Y3 patterns: adjective suffix -ous | medium |
| `y3-pt-ie-ei-rule` | I Before E | Y3 patterns: the ie/ei rule | medium |
| `y3-pt-homophones-3` | Homophones — Set 3 | Y3 patterns: missed/mist, knot/not, kneed/need | medium |
| `y3-pt-ation-ending` | -ATION Endings | Y3 patterns: noun suffix -ation | medium |

#### Morphology (7 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y3-mo-prefix-re` | The Prefix RE- | Y3 morphology: re- (again/back) | easy |
| `y3-mo-prefix-sub-super` | SUB- and SUPER- | Y3 morphology: sub- and super- | medium |
| `y3-mo-prefix-pre-anti` | PRE- and ANTI- | Y3 morphology: pre- and anti- | medium |
| `y3-mo-prefix-auto` | The Prefix AUTO- | Y3 morphology: auto- (self) | medium |
| `y3-mo-suffix-ly-extending` | -LY Words — Going Further | Y3 morphology: -ly with various root types | medium |
| `y3-mo-suffix-ous` | Making -OUS Words | Y3 morphology: deriving adjectives with -ous | medium |
| `y3-mo-compound-words` | Compound Words | Y3 morphology: compound word formation | easy |

#### Etymology (3 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y3-et-greek-tele-micro` | Greek Roots — TELE and MICRO | Y3 etymology: tele- and micro- roots | medium |
| `y3-et-greek-photo-scope` | Greek Roots — PHOTO and SCOPE | Y3 etymology: photo- and -scope roots | medium |
| `y3-et-silent-letters-history` | Why Silent Letters Exist | Y3 etymology: historical pronunciation | hard |

#### Statutory (5 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y3-st-y34-a-b` | Y3/4 Statutory: A–B | Y3/4 statutory list | medium |
| `y3-st-y34-c-e` | Y3/4 Statutory: C–E | Y3/4 statutory list | medium |
| `y3-st-y34-f-k` | Y3/4 Statutory: F–K | Y3/4 statutory list | medium |
| `y3-st-y34-l-p` | Y3/4 Statutory: L–P | Y3/4 statutory list | medium |
| `y3-st-y34-q-z` | Y3/4 Statutory: Q–Z | Y3/4 statutory list | medium |

---

### YEAR 4 (ages 8–9) — 22 lessons

#### Patterns (10 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y4-pt-cious-tious` | -CIOUS and -TIOUS Endings | Y4 patterns: /ʃəs/ spellings | hard |
| `y4-pt-cial-tial` | -CIAL and -TIAL Endings | Y4 patterns: /ʃl/ spellings | hard |
| `y4-pt-ssion-cian` | -SSION and -CIAN Endings | Y4 patterns: /ʃn/ extending | hard |
| `y4-pt-ance-ence` | -ANCE and -ENCE Endings | Y4 patterns: unstressed vowel endings | hard |
| `y4-pt-ant-ent` | -ANT and -ENT Endings | Y4 patterns: agent/quality suffixes | medium |
| `y4-pt-able-endings` | -ABLE Endings | Y4 patterns: adjectival suffix -able | medium |
| `y4-pt-ible-endings` | -IBLE Endings | Y4 patterns: adjectival suffix -ible | hard |
| `y4-pt-ably-ibly` | -ABLY and -IBLY Adverbs | Y4 patterns: adverb suffixes | hard |
| `y4-pt-homophones-4` | Homophones — Set 4 | Y4 patterns: accept/except, affect/effect | hard |
| `y4-pt-homophones-5` | Homophones — Set 5 | Y4 patterns: stationary/stationery, desert/dessert | hard |

#### Morphology (7 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y4-mo-prefix-in-im-il-ir` | IN-, IM-, IL- and IR- | Y4 morphology: negative prefixes | medium |
| `y4-mo-prefix-dis-mis` | DIS- and MIS- | Y4 morphology: negative/wrong prefixes | medium |
| `y4-mo-suffix-ment-extending` | -MENT Words — Going Further | Y4 morphology: -ment with complex roots | medium |
| `y4-mo-suffix-ion-extending` | -ION Words — Going Further | Y4 morphology: -ion noun formation | hard |
| `y4-mo-words-with-fer` | Words with -FER | Y4 morphology: transfer, prefer, refer, infer | medium |
| `y4-mo-word-families-1` | Word Families — Act and Form | Y4 morphology: act/action/active; form/formal | medium |
| `y4-mo-word-families-2` | Word Families — Port and Dict | Y4 morphology: transport/export; dictate/predict | medium |

#### Etymology (2 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y4-et-latin-aqua-terra` | Latin Roots — AQUA and TERRA | Y4 etymology: aqua- and terra- | medium |
| `y4-et-french-que-gue` | French Endings — -QUE and -GUE | Y4 etymology: French-derived endings | hard |

#### Statutory (3 lessons — Y3/4 revision)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y4-st-y34-revision-1` | Y3/4 Statutory Revision — Set 1 | Y3/4 statutory revision | medium |
| `y4-st-y34-revision-2` | Y3/4 Statutory Revision — Set 2 | Y3/4 statutory revision | medium |
| `y4-st-y34-patterns` | Y3/4 Statutory by Pattern | Y3/4 statutory: grouped by spelling pattern | hard |

---

### YEAR 5 (ages 9–10) — 30 lessons

#### Patterns (8 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y5-pt-ei-after-c` | EI After C | Y5 patterns: receive, deceive, ceiling | hard |
| `y5-pt-able-extending` | -ABLE Words — Advanced | Y5 patterns: adorable, noticeable, justifiable | hard |
| `y5-pt-ible-extending` | -IBLE Words — Advanced | Y5 patterns: eligible, permissible, reversible | hard |
| `y5-pt-ance-ency-extending` | -ANCE, -ANCY and -ENCY | Y5 patterns: tolerance, infancy, urgency | hard |
| `y5-pt-ent-ence-extending` | -ENT and -ENCE — Advanced | Y5 patterns: diligent, persistence, evidence | hard |
| `y5-pt-british-our-endings` | British -OUR Endings | Y5 patterns: colour, favour, behaviour, harbour | medium |
| `y5-pt-homophones-6` | Homophones — Set 6 | Y5 patterns: advice/advise, practise/practice | hard |
| `y5-pt-ough-revisited` | The -OUGH Family — Full Set | Y5 patterns: all 8 sounds systematically | hard |

#### Morphology (10 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y5-mo-prefix-over-under` | OVER- and UNDER- | Y5 morphology: over- and under- prefixes | medium |
| `y5-mo-prefix-de` | The Prefix DE- | Y5 morphology: de- (undo/remove) | medium |
| `y5-mo-suffix-ify` | -IFY Verbs | Y5 morphology: classify, identify, justify | medium |
| `y5-mo-suffix-ise-ize` | -ISE and -IZE Verbs | Y5 morphology: recognise, organise, characterise | medium |
| `y5-mo-suffix-ation-extending` | -ATION Words — Advanced | Y5 morphology: classification, transformation | hard |
| `y5-mo-suffix-tion-sion-full` | -TION and -SION — Full Range | Y5 morphology: all four /ʃn/ spellings | hard |
| `y5-mo-word-families-sign` | Word Family — SIGN | Y5 morphology: sign, signal, signature, design | hard |
| `y5-mo-word-families-scribe` | Word Family — SCRIB/SCRIPT | Y5 morphology: describe, prescription, scripture | hard |
| `y5-mo-number-prefixes` | Number Prefixes | Y5 morphology: uni-, bi-, tri-, quad-, pent-, hex- | medium |
| `y5-mo-word-families-act` | Word Family — ACT | Y5 morphology: act, action, react, transact, actor | medium |

#### Etymology (7 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y5-et-greek-ology` | Greek Root — -OLOGY | Y5 etymology: biology, geology, mythology | hard |
| `y5-et-greek-ography` | Greek Root — -OGRAPHY | Y5 etymology: photography, geography, bibliography | hard |
| `y5-et-greek-meter-phone` | Greek Roots — -METER and -PHONE | Y5 etymology: thermometer, barometer, microphone | hard |
| `y5-et-latin-rupt-struct` | Latin Roots — -RUPT and -STRUCT | Y5 etymology: interrupt, construct, destruction | hard |
| `y5-et-latin-vis-vid` | Latin Roots — VIS and VID | Y5 etymology: visible, evidence, provide | hard |
| `y5-et-french-loanwords` | French Loanwords | Y5 etymology: ballet, chauffeur, bouquet, silhouette | hard |
| `y5-et-british-vs-american` | British vs American Spelling | Y5 etymology: -our/-or, -re/-er, -ise/-ize | medium |

#### Statutory (5 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y5-st-y56-a-c` | Y5/6 Statutory: A–C | Y5/6 statutory list | hard |
| `y5-st-y56-d-f` | Y5/6 Statutory: D–F | Y5/6 statutory list | hard |
| `y5-st-y56-g-m` | Y5/6 Statutory: G–M | Y5/6 statutory list | hard |
| `y5-st-y56-n-r` | Y5/6 Statutory: N–R | Y5/6 statutory list | hard |
| `y5-st-y56-s-z` | Y5/6 Statutory: S–Z | Y5/6 statutory list | hard |

---

### YEAR 6 (ages 10–11) — 20 lessons

#### Patterns (4 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y6-pt-words-often-confused` | Words Often Confused | Y6 patterns: practice/practise, licence/license | hard |
| `y6-pt-homophones-7` | Homophones — Set 7 | Y6: complement/compliment, principal/principle | hard |
| `y6-pt-formal-informal` | Formal vs Informal Spelling | Y6: -ise/-ize, -our/-or, -ogue/-og | hard |
| `y6-pt-ie-ei-comprehensive` | I Before E — Comprehensive | Y6 revision: all ie/ei words | hard |

#### Morphology (6 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y6-mo-word-families-number` | Word Families — Numbers | Y6: decimal, century, millennium, annual | hard |
| `y6-mo-word-families-time` | Word Families — Time | Y6: annual, chronological, contemporary | hard |
| `y6-mo-tion-sion-review` | -TION and -SION — Review | Y6 revision: all four /ʃn/ spellings | hard |
| `y6-mo-word-families-light` | Word Family — Light Roots | Y6: illuminate, luminous, translucent | hard |
| `y6-mo-word-families-port` | Word Family — PORT | Y6: transport, export, portable, portfolio | hard |
| `y6-mo-complex-prefixes` | Complex Prefixes | Y6: e-, circum-, counter-, inter- | hard |

#### Etymology (5 lessons)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y6-et-greek-science` | Greek Roots in Science | Y6: photosynthesis, metamorphosis, decomposition | hard |
| `y6-et-latin-aud-vis` | Latin Roots — AUD and VIS | Y6: audience, auditory, vision, evidence | hard |
| `y6-et-silent-comprehensive` | Silent Letters — Full Set | Y6: psalm, pneumonia, mnemonics, island | hard |
| `y6-et-world-languages` | Words from World Languages | Y6: algebra, piano, kayak, bungalow, safari | hard |
| `y6-et-word-origins-detective` | Be a Word Detective | Y6: mixed etymology — tracing word roots | hard |

#### Statutory (5 lessons — Y5/6 revision)
| ID | Name | NC Reference | Difficulty |
|---|---|---|---|
| `y6-st-y56-revision-1` | Y5/6 Statutory Revision — Set 1 | Y5/6 statutory revision | hard |
| `y6-st-y56-revision-2` | Y5/6 Statutory Revision — Set 2 | Y5/6 statutory revision | hard |
| `y6-st-y56-revision-3` | Y5/6 Statutory Revision — Set 3 | Y5/6 statutory revision | hard |
| `y6-st-y56-patterns` | Y5/6 Statutory by Pattern | Y5/6 statutory: grouped by spelling rule | hard |
| `y6-st-y56-sats-prep` | Statutory Words — SATs Focus | Y5/6: most commonly tested in KS2 SATs | hard |

---

## 9. Lesson Count Summary

| Year | Phonics | Patterns | Morphology | Etymology | Statutory | Total |
|---|---|---|---|---|---|---|
| Y1 | 18 | 6 | 0 | 0 | 4 | **28** |
| Y2 | 8 | 10 | 4 | 0 | 4 | **26** |
| Y3 | 5 | 8 | 7 | 3 | 5 | **28** |
| Y4 | 0 | 10 | 7 | 2 | 3 | **22** |
| Y5 | 0 | 8 | 10 | 7 | 5 | **30** |
| Y6 | 0 | 4 | 6 | 5 | 5 | **20** |
| **Total** | **31** | **46** | **34** | **17** | **26** | **154** |

Plus ~4 high-frequency reference sets (not counted as lessons).

**Estimated word-list entries:** 154 lessons × 13 words average = ~2,000 word-slot entries (with cross-strand duplication for words that appear in both a strand lesson and a statutory lesson).

---

## 10. Cross-Reference: Words in Multiple Lessons

Some words intentionally appear in more than one lesson. This is by design — the statutory lesson is for test-prep (knowing the word exists), while the strand lesson teaches the rule behind its spelling.

Examples of intended duplication:
- `accommodation` → `y5-st-y56-a-c` AND `y5-mo-suffix-tion-sion-full`
- `favourite` → `y5-pt-british-our-endings` AND `y5-st-y56-d-f`
- `receive` → `y5-pt-ei-after-c` AND `y6-pt-ie-ei-comprehensive`
- `photograph` → `y5-et-greek-ography` AND `y5-et-greek-meter-phone`
- `silence` → `y5-mo-suffix-tion-sion-full` AND `y5-st-y56-s-z`

---

## 11. Amendment Log

| Date | Version | Change | Reason |
|---|---|---|---|
| 2026-05-12 | 1.0 | Initial schema, strand taxonomy, and full 154-lesson skeleton | Phase A completion |

---

*This document lives in the Spellify project. The canonical file is `docs/curriculum-structure.md` in the repo. Any changes to lesson IDs, strand definitions, or schema fields must be reflected here before implementation.*

---

## 9 (revised)  Lesson Count Summary

Updated following HeadStart Primary review and gap-patch session (2026-05-12).

| Year | Phonics | Patterns | Morphology | Etymology | Statutory | Total |
|---|---|---|---|---|---|---|
| Y1 | 27 | 7 | 0 | 0 | 4 | **37** |
| Y2 | 8 | 12 | 6 | 0 | 4 | **32** |
| Y3 | 5 | 9 | 7 | 3 | 5 | **29** |
| Y4 | 0 | 12 | 8 | 2 | 3 | **25** |
| Y5 | 0 | 8 | 10 | 7 | 5 | **30** |
| Y6 | 0 | 5 | 6 | 5 | 5 | **21** |
| **Total** | **40** | **53** | **37** | **17** | **26** | **174** |

---

## 12  Patch Lessons Added (Gap-Patch Session, 2026-05-12)

Following review against the HeadStart Primary Spelling Overview (Y1-Y6), 20 lessons were added
to close NC 2014 curriculum gaps. Reviewed by an experienced primary school teacher.

### Year 1 additions (9 lessons)

| ID | Name | Gap closed |
|---|---|---|
| `y1-ph-ue-ew` | UE and EW Words | /ue/ and /ew/ vowel digraphs missing |
| `y1-ph-oe-ore` | OE and ORE Words | /oe/ and /ore/ word endings missing |
| `y1-ph-air-vowel` | AIR Words | /air/ vowel sound missing |
| `y1-ph-ear-vowel` | EAR Words - Two Sounds | /ear/ two-sound distinction missing |
| `y1-ph-are-vowel` | ARE Words | /are/ vowel sound missing |
| `y1-ph-wh-ph-digraphs` | WH and PH Words | wh- and ph- digraphs missing |
| `y1-ph-tch-trigraph` | -TCH Words | -tch trigraph missing |
| `y1-ph-au-aw-sounds` | AU and AW Words | /au/ vowel sound missing |
| `y1-pt-adding-er-est` | Adding -ER and -EST | Comparative/superlative suffixes missing |

### Year 2 additions (6 lessons)

| ID | Name | Gap closed |
|---|---|---|
| `y2-pt-a-after-w` | A After W (WA- Words) | /o/ spelt a after w (want, wash) missing |
| `y2-pt-or-after-w` | OR and AR After W | /er/ spelt or after w (word, work) missing |
| `y2-pt-zh-sound-s` | S Making the /ZH/ Sound | /zh/ sound spelt s (treasure) missing |
| `y2-mo-contractions-1` | Contractions - Set 1 | Contractions entirely absent |
| `y2-mo-contractions-2` | Contractions - Set 2 | Contractions set 2 (won't etc) |
| `y2-mo-apostrophe` | Possessive Apostrophe | Possessive apostrophe entirely absent |

### Year 3 addition (1 lesson)

| ID | Name | Gap closed |
|---|---|---|
| `y3-pt-ou-for-u` | OU Making the /U/ Sound | /u/ sound spelt ou (touch, young) missing |

### Year 4 additions (3 lessons)

| ID | Name | Gap closed |
|---|---|---|
| `y4-mo-suffix-ally` | -ALLY Words | -ally suffix (basically, dramatically) missing |
| `y4-pt-ous-our-drops` | -OUS When -OUR Drops the U | humour->humorous transformation missing |
| `y4-pt-ous-keeps-e` | -OUS/-ABLE Keeping E After G or C | courageous, noticeable pattern missing |

### Year 6 addition (1 lesson)

| ID | Name | Gap closed |
|---|---|---|
| `y6-pt-ei-not-after-c` | EI Not After C | ei exceptions (weird, forfeit, caffeine) missing |

---

## 13  Amendment Log

| Date | Version | Change | Reason |
|---|---|---|---|
| 2026-05-12 | 1.0 | Initial schema, strand taxonomy, 154-lesson skeleton | Phase A + B completion |
| 2026-05-12 | 1.1 | 174-lesson skeleton + complete word lists (Phase C) | Phase C completion |
| 2026-05-12 | 1.2 | 20 gap-patch lessons added (174 total) | HeadStart Primary review by experienced teacher |

---

## 14  Design Principles

*Added 2026-05-12. These are the core educational and product design principles that govern how Spellify's curriculum is structured and how it should be experienced. Any future curriculum authoring, product feature, or content decision should be checked against these.*

---

### 14.1  Statutory Word Embedding

**The principle:** Statutory words have two homes in the curriculum — not one.

Their first home is the standalone statutory lessons (`y1-st-*`, `y2-st-*`, `y3-st-y34-*`, `y5-st-y56-*`). These exist for test-prep, teacher reference, and parent communication. A teacher or parent should be able to open the statutory lessons and find the complete NC word list for their year group, ready to practise.

Their second home is inside pattern, morphology, and etymology lessons — wherever a statutory word exemplifies the target rule. `occasion` belongs in the `-sion` lesson. `accommodation` belongs in the double-consonant lesson. `embarrass` belongs in the double-consonant lesson. `programme` belongs in the French loanwords lesson. These placements are deliberate, not accidental.

**Why this matters:** Research on vocabulary acquisition consistently shows that words are retained through multiple encounters across different contexts, not through a single dedicated lesson. A child who meets `possession` in a statutory list, then again in a `-ssion` pattern lesson, then again in a game that week, is far more likely to own that word than a child who drills it once in isolation. The dual-home structure is how Spellify replicates what good teachers do naturally — weaving high-value words through the whole curriculum.

**Implementation rule:** When authoring or reviewing word lists for pattern lessons, actively check whether any statutory words for that year group fit the target pattern. If they do, include them. The standalone statutory lessons remain unchanged — the words simply also appear elsewhere.

---

### 14.2  NC Floor, Enrichment Ceiling

**The principle:** The National Curriculum is Spellify's floor, not its ceiling.

Every Spellify lesson maps to NC 2014. All statutory word lists are covered. All required spelling patterns and rules across Y1–Y6 are represented. A teacher can use Spellify as a homework tool or class supplement and be confident it covers what the NC requires.

But Spellify is not limited to what the NC requires. The Etymology strand (Greek roots, Latin roots, French loanwords, word origins) and the advanced Morphology strand (word families, complex prefixes, derivational patterns) exist to stretch children who are ready to go further — and to make spelling genuinely interesting rather than merely compliant.

**The three tiers this creates:**

| Tier | Who it serves | Content |
|---|---|---|
| **Accountability** | Teachers, parents, schools | Statutory lessons, NC pattern coverage, curriculum alignment |
| **Grade-level mastery** | Every child at the target year | Pattern lessons, morphology basics, CEW practice |
| **Enrichment and stretch** | Curious children who want more | Etymology, word families, word origins, British vs American, register |

**Why this matters commercially:** Every spelling app on the market is NC-compliant. Spelling Shed, Spelling Frame, EdShed — all cover the statutory lists. None of them take a Y5 child deep into Greek roots, or explain why `salary` comes from the Latin word for salt, or why `photograph` and `photosynthesis` share the same ancestor. That enrichment tier is Spellify's differentiation. It's what makes the product worth choosing over a cheaper competitor, and it's what gives a genuinely curious child a reason to keep coming back.

**Design implication:** The product experience should reflect all three tiers without one dominating. A child should be able to open Spellify and find what they need whether they're doing homework, preparing for a spelling test, or just curious about words. The curriculum browser, filtering system, and difficulty settings exist to make all three tiers navigable.

---

### 14.3  Teacher List Builder (Future Feature — Deferred)

*Flagged 2026-05-12. Not for current development phase. Requires teacher workflow research before design begins.*

**The concept:** A teacher-facing interface that allows teachers to build custom weekly spelling lists for their class by selecting from the statutory word pool, the curriculum catalogue, or their own custom words — and deploy that list to their class in Spellify.

**The problem it solves:** Primary teachers spend 20–40 minutes per week selecting or building spelling lists. St Richard's Catholic Primary School does this manually using three-column Word documents. HeadStart Primary does it with term-by-term pre-built sheets. Every school does some version of this task. Spellify should be the place where teachers do that work — not a separate tool they use after they've done their planning elsewhere.

**The strategic importance:** A teacher who builds lists inside Spellify is using Spellify as infrastructure, not just as a resource. That changes adoption, retention, and the commercial model. It also makes Spellify a genuine classroom tool rather than a homework supplement, which is a significant step up in the product's role in a school's workflow.

**What needs to be learned before building:**
- When do teachers select words — start of half-term, start of each week, or reactively?
- Do teachers work from a school-wide programme or personal professional judgement?
- Do they want to browse words by pattern, statutory membership, difficulty, or topic?
- Does the headteacher or literacy coordinator want oversight of what lists are set?
- Is the list output for Spellify games only, or also for printing, parent communication, working walls?

**Interview question to keep in your back pocket for any teacher conversation:**
*"How do you choose your class's spelling words each week — what does that process look like for you?"*

**Dependencies:** Requires teacher authentication (Supabase auth), teacher dashboard, and class management features. Not before those ship.

---

## 15  Amendment Log (continued)

| Date | Version | Change | Reason |
|---|---|---|---|
| 2026-05-12 | 1.0 | Initial schema, strand taxonomy, 154-lesson skeleton | Phase A + B |
| 2026-05-12 | 1.1 | 174-lesson skeleton + complete word lists | Phase C |
| 2026-05-12 | 1.2 | 20 gap-patch lessons (174 total) | HeadStart Primary review |
| 2026-05-12 | 1.3 | St Richard's review — confirmed same NC source, 2 minor gaps noted | School docs review |
| 2026-05-12 | 1.4 | Design Principles section added (14.1, 14.2, 14.3) | Product philosophy capture |
| 2026-05-21 | 1.5 | Database gap-close: KS1 v13→v14 (+167 words, 1,707 total), KS2 v26→v27 (+384 words, 3,396 total). 100% curriculum coverage confirmed across Y1–Y6. | Coverage audit found 170 curriculum words missing from databases |
