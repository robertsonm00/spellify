# Spellify — Phase C Delivery
## Complete Curriculum Catalogue + Integration Instructions

**Delivered:** 2026-05-12
**Status:** Phase C complete — all 154 lessons populated

---

## What's in this delivery

| File | Description |
|---|---|
| `curriculumLists_COMPLETE.js` | The complete replacement `curriculumLists.js` — 154 lessons, 2,099 word entries, all six year groups |
| `ks1WordData_v13.js` | KS1 word database — 1,368 words, Y1+Y2, fully integrated |
| `ks2WordData_v26.js` | KS2 word database — 2,917 words, Y3/4+Y5/6, fully integrated |
| `CURRICULUM_STRUCTURE.md` | Canonical reference document — strand taxonomy, lesson schema, progressive disclosure rules |
| `checkCoverage.mjs` | Node script to verify word database coverage against curriculum lists |

---

## Catalogue summary

| Year | Phonics | Patterns | Morphology | Etymology | Statutory | Total lessons | Word entries |
|---|---|---|---|---|---|---|---|
| Y1 | 18 | 6 | 0 | 0 | 4 | 28 | 385 |
| Y2 | 8 | 10 | 4 | 0 | 4 | 26 | 354 |
| Y3 | 5 | 8 | 7 | 3 | 5 | 28 | 381 |
| Y4 | 0 | 10 | 7 | 2 | 3 | 22 | 302 |
| Y5 | 0 | 8 | 10 | 7 | 5 | 30 | 407 |
| Y6 | 0 | 4 | 6 | 5 | 5 | 20 | 270 |
| **Total** | **31** | **46** | **34** | **17** | **26** | **154** | **2,099** |

---

## Integration steps

### Step 1 — Install the word database files (already done if you completed the earlier integration)

If `src/data/ks1WordData_v13.js` and `src/data/ks2WordData_v26.js` are already in the project from the previous session, skip this step. If not:

```bash
cp ~/Downloads/ks1WordData_v13.js src/data/
cp ~/Downloads/ks2WordData_v26.js src/data/
```

### Step 2 — Replace curriculumLists.js

```bash
cp ~/Downloads/curriculumLists_COMPLETE.js src/data/curriculumLists.js
```

This replaces the Phase B skeleton (154 empty stubs) with the fully populated version.

### Step 3 — Verify the app still runs

```bash
npm start
```

The app should start cleanly. The Explore section will now show all 154 lessons across all six year groups. No other component code needs to change — the file exports the same functions (`curriculumLists`, `getListsForYear`, `YEAR_GROUPS`, `CATEGORY_COLOURS`, `getEnrichedLesson`) that the existing components import.

### Step 4 — Run the coverage check

```bash
node checkCoverage.mjs
```

Expected output: all six year groups and all five categories at 100% coverage. This confirms every word in every lesson has rich data available via `wordLookup.js`.

### Step 5 — Commit

```bash
git add src/data/curriculumLists.js
git commit -m "feat(curriculum): populate all 154 lessons with word lists (Phase C complete)

154 lessons across Y1-Y6 now fully populated with 2,099 word entries.
Lessons span five strands: Phonics (31), Patterns (46), Morphology (34),
Etymology (17) and Statutory (26). All lessons aligned to NC 2014
English Appendix 1. Word counts: Y1=385, Y2=354, Y3=381, Y4=302,
Y5=407, Y6=270.

Structure reference: docs/CURRICULUM_STRUCTURE.md"
```

---

## Schema changes in this delivery

The new `curriculumLists.js` adds two fields to every lesson object that were not in the original:

| New field | Type | Values | Purpose |
|---|---|---|---|
| `strand` | String | `phonics`, `patterns`, `morphology`, `etymology`, `statutory` | Enables strand-based filtering in the curriculum browser |
| `ncReference` | String | Free text | Traceability back to NC 2014 English Appendix 1 |

The `CATEGORY_COLOURS` export now includes `'Morphology': 'blue'` which was not previously defined. If any component checks `CATEGORY_COLOURS` keys and throws on unknown values, add `'Morphology': 'blue'` handling.

---

## What the new `strand` field enables

The `strand` field is the key to building the filtering system described in `CURRICULUM_STRUCTURE.md`. Once you're ready to build the filter UI, you can filter lessons like this:

```js
// All phonics lessons
curriculumLists.filter(l => l.strand === 'phonics')

// All Y3 morphology lessons
curriculumLists.filter(l => l.year === 3 && l.strand === 'morphology')

// All hard Y5/6 lessons
curriculumLists.filter(l => l.year >= 5 && l.difficulty === 'hard')

// All statutory lessons across all years
curriculumLists.filter(l => l.strand === 'statutory')
```

No code changes needed now — the data is ready whenever the filter UI gets built.

---

## Notes on lesson content

### Statutory lessons and duplication
Many words appear in both a strand lesson and a statutory lesson. This is intentional — statutory lessons are for test-prep coverage; strand lessons teach the underlying pattern. For example, `accommodation` appears in both `y5-st-y56-a-c` (statutory) and in `y5-mo-suffix-tion-sion-full` (morphology). This mirrors how teachers use the NC lists.

### Year 4 statutory lessons
The Year 4 statutory lessons are Y3/4 revision sets (not new words). This reflects the NC structure — Y3 and Y4 share the same 100-word statutory pool, so Y4 focuses on consolidating what Y3 introduced.

### High-frequency reference sets
The curriculum structure document describes future "Word Banks" (hf-ks1, hf-y34, hf-y56) — large reference collections outside the regular lesson structure. These are **not yet authored** and are a future Phase D task. The existing `YEAR_DATA` pools in `src/data/spelling/index.js` serve this purpose for now.

### Y6 SATs prep lesson
`y6-st-y56-sats-prep` contains the 14 words most commonly tested in KS2 spelling assessments, with mnemonic hints embedded in the definitions. This is a pedagogically useful lesson for Y6 test preparation.

---

## Future work (not in this delivery)

In priority order:

1. **Filtering UI** — Year, strand and difficulty filters in the Explore section. The `strand` and `difficulty` fields are ready; the UI needs building. See `CURRICULUM_STRUCTURE.md` Section 6 for the full filtering spec.

2. **Progressive disclosure** — Default lesson visibility by year group (Y3 child sees Y1-Y3 by default; Y6 child sees Y4-Y6). See `CURRICULUM_STRUCTURE.md` Section 5.

3. **High-frequency word banks** — Large reference sets (hf-ks1, hf-y34, hf-y56) sitting outside the regular lesson browser. Not yet authored.

4. **`wordCount` sync** — The `wordCount` field in each lesson is set at build time (it matches `words.length`). If words are ever added or removed from a lesson, `wordCount` must be kept in sync. Consider deriving it at read time (`lesson.words.length`) rather than storing it.

5. **`definitions.js` pre-population** — The Free Dictionary API is still used as a runtime dependency for crossword clues. Pre-populating `src/data/definitions.js` from the v13/v26 data would remove this dependency and make the app work offline. The `getDefinition` function in `wordLookup.js` already provides this data.

---

## Spellify database state (as of this delivery)

| Database | Version | Words | Year bands | Statutory words | Coverage |
|---|---|---|---|---|---|
| KS1 | v13 | 1,368 | Y1: 770, Y2: 598 | 109 | 100% of curriculumLists Y1/Y2 |
| KS2 | v26 | 2,917 | Y3/4: 1,852, Y5/6: 1,065 | 214 | 100% of curriculumLists Y3-Y6 |
| **Combined** | | **4,285** | | **323** | **100% overall** |

---

*This document should be saved as `docs/PHASE_C_DELIVERY.md` in the repo.*

---

## 6  Educational Philosophy & Design Principles

*These principles govern how the curriculum is structured, how content decisions should be made, and what Spellify is for. They should be readable by a developer, teacher partner, or investor.*

---

### The NC is the floor, not the ceiling

Spellify covers everything the National Curriculum 2014 English Appendix 1 requires across Y1–Y6. All statutory word lists are present. All required spelling patterns, rules, and morphological sequences are represented. A teacher can use Spellify as a class supplement or homework tool and be confident it covers what the NC mandates.

But Spellify is not bounded by the NC. The Etymology strand and the advanced Morphology strand exist to stretch children who are ready to go further — and to make spelling interesting rather than merely compliant. A curious Y5 child should be able to find out why `photography`, `photosynthesis` and `photon` all share the same Greek ancestor, or why English spells `colour` differently from `color`. None of that is in the NC. All of it builds a child who finds language fascinating rather than threatening.

This creates three distinct tiers the product must serve simultaneously:

| Tier | Audience | What Spellify provides |
|---|---|---|
| **Accountability** | Teachers, parents, schools | NC alignment, statutory word coverage, curriculum mapping |
| **Grade-level mastery** | Every child at the target year | Pattern lessons, CEW practice, games that build accurate recall |
| **Enrichment and stretch** | Curious children ready for more | Etymology, word families, word origins, register, British vs American |

The enrichment tier is Spellify's commercial differentiator. Every competitor covers the NC. None of them take a child deep into Greek roots or explain why `salary` comes from the Latin word for salt. That depth is the reason a curious child keeps coming back, and the reason a school chooses Spellify over a cheaper alternative.

---

### Statutory words live in two places

Statutory words have two homes in the curriculum — not one.

Their first home is the standalone statutory lessons, which exist for test-prep, teacher reference, and parent communication. A teacher should be able to open the Year 5/6 statutory lessons and find the complete NC word list ready to practise.

Their second home is inside pattern, morphology, and etymology lessons — wherever a statutory word exemplifies the target rule. `occasion` belongs in the `-sion` lesson. `accommodation` belongs in the double-consonant lesson. `embarrass` too. `programme` belongs in the French loanwords lesson. These are deliberate placements, not accidents.

Words are retained through multiple encounters across different contexts. A child who meets `possession` in a statutory list, then again in a `-ssion` pattern lesson, then in a game that week, is far more likely to own that word than a child who sees it once in isolation. The two-home structure replicates what good teachers do naturally — threading high-value words through the whole curriculum.

**Implementation rule for future content work:** when authoring pattern lessons, actively check whether statutory words for that year group fit the target pattern. If they do, include them. The standalone statutory lessons are unchanged — the words simply also appear elsewhere.

---

### The product works for schools AND beyond them

Spellify should function as a reliable classroom-aligned tool that teachers can trust and recommend. It should also function as something a child wants to use outside school — not because it feels like homework, but because it's genuinely engaging and rewards curiosity.

These two modes are not in tension. The statutory and pattern lessons serve the school use case. The etymology, word families, and enrichment content serve the child-led use case. The games serve both — accurate spelling builds through repetition that doesn't feel like repetition.

The curriculum browser, filtering system, and difficulty settings exist to make all three tiers navigable without one dominating the experience. A child doing homework, a child preparing for a test, and a child who just wants to know where the word `disaster` came from should each find what they need without having to wade through what they don't.

---

### Future: Teacher List Builder

A teacher-facing list builder is on the product roadmap — not for the current development phase, but an important future feature.

The concept: teachers select from the statutory word pool, the curriculum catalogue, or their own words to build a custom weekly list, then deploy it to their class inside Spellify. This is the digital version of what St Richard's Catholic Primary School does manually every week with three-column Word documents.

The strategic importance: a teacher who builds lists inside Spellify is using it as infrastructure, not just a resource. That changes adoption, retention, and the product's role in a school's workflow.

Requires: teacher authentication (Supabase), teacher dashboard, class management features. Requires teacher workflow research before design begins. Key research question: *"How do you choose your class's spelling words each week — what does that process look like for you?"*

---

*Last updated: 2026-05-12 — v1.4, following HeadStart Primary and St Richard's curriculum reviews.*
