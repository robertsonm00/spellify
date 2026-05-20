# Spellify — Master Working Plan
**Last updated: 2026-05-19 | Update this file at the start of every session**

---

## Current state snapshot

| Item | Status |
|---|---|
| `curriculumLists.js` | ✅ v1.3 installed — 175 lessons, 2,388 words, Y1–Y6 |
| `ks1WordData_v13.js` | ✅ Installed — 1,368 words (Y1: 770, Y2: 598) |
| `ks2WordData_v26.js` | ✅ Installed — 2,917 words (Y3/4: 1,852, Y5/6: 1,065) |
| Coverage check | ✅ 100% — every curriculum word has rich data |
| Explore filter UI | ⏳ In progress — strand + difficulty pill filters being built |
| Word banks | ❌ Not yet authored |
| `definitions.js` pre-population | ❌ Not done — app still calls Free Dictionary API at runtime |
| `spelling/index.js` cleanup | ❌ Deprecated functions not yet removed |
| Alien word logic | ❌ Not yet built |
| Gamification engine | ❌ Not started |
| Adaptive learning | ❌ Not started |
| Supabase auth | ❌ Not started |

---

## Decisions log

| Decision | Detail |
|---|---|
| Year filtering removed from Explore | Year is set in Settings. Explore shows the user's year group only — no switching |
| Strand + difficulty filters | Pill toggle buttons, no labels. Strand row / divider / difficulty row. Tap to select, tap again to deselect. AND logic across both axes |
| Word banks scope | hf-ks1 (Y1/Y2), hf-y34 (Y3/Y4), hf-y56 (Y5/Y6) — live inside Explore section |
| Word banks data | Every word must have full data set matching v13/v26 schema before being added |
| Alien words | Any word not in v13/v26 is alien. Can be used in spelling activities + word search. Excluded from all clue-based games (Crossword + any future clue-dependent game) |
| Custom list words | Cross-referenced against v13/v26 at entry point. Known = full experience. Unknown = alien rules apply |
| Custom list alien words | Can be used in: Word Search. Cannot be used in: Crossword, any clue-dependent game |
| Single source of truth (future) | All words to derive from v13/v26 only. `spelling/index.js` statutory arrays to be replaced by filtering v13/v26 on `ncSource: 'statutory'` |
| `spelling/index.js` | Keep for now. Remove deprecated functions (`getWordObjects`, `selectWords`, `getWordsForYear`) in Phase 1. Flat word arrays removed once v13/v26 is full source |

---

## Game compatibility rules

| Game | Known words | Alien/custom words |
|---|---|---|
| Word Search | ✅ Yes | ✅ Yes |
| Crossword | ✅ Yes | ❌ No — requires clue |
| Quiz Quest | ✅ Yes | ❌ No — requires definition |
| Hangman | ✅ Yes | ✅ Yes (no clue needed) |
| Memory Spell | ✅ Yes | ✅ Yes |
| Write It | ✅ Yes | ✅ Yes |

*Update this table as new games are added.*

---

## Work phases

---

### PHASE 1 — Data integrity
*Do first. Everything else depends on clean, unified data.*

- [ ] **1.1** Author hf-ks1 word list (~100 words, Y1/Y2 high-frequency)
  - Must include: full definition (age-banded 5–7), example sentence, difficulty, spelling rule, pattern group, tricky part, syllables
  - Cross-reference every word against v13 — note any gaps
- [ ] **1.2** Author hf-y34 word list (~80 words, Y3/Y4 academic vocabulary)
  - Same data requirements as above
  - Cross-reference against v13/v26
- [ ] **1.3** Author hf-y56 word list (~100 words, Y5/Y6 SATs vocabulary)
  - Same data requirements
  - Cross-reference against v26
- [ ] **1.4** Batch any words missing from v13/v26 → produce v14/v27 with full data set
- [ ] **1.5** Pre-populate `definitions.js` from v13/v26 — removes Free Dictionary API runtime dependency for all curriculum words
- [ ] **1.6** Remove deprecated functions from `spelling/index.js` (`getWordObjects`, `selectWords`, `getWordsForYear`, `YEAR1_WORDS`)
- [ ] **1.7** Update `checkCoverage.mjs` to derive statutory pools from v13/v26 directly rather than importing from `spelling/index.js`
- [ ] **1.8** Audit all components for words with no database entry — flag and fix
- [ ] **Commit:** `feat(data): Phase 1 data integrity complete — unified source, definitions pre-populated`

---

### PHASE 2 — Explore section: filters + word banks

- [ ] **2.1** Strand + difficulty filter pills — finish and test (in progress via Claude Code)
  - Strand: Phonics / Patterns / Morphology / Etymology / Statutory
  - Difficulty: Easy / Medium / Hard
  - No labels. Divider between rows. Active = CATEGORY_COLOURS highlight. AND logic
  - Result count shown. Zero results = friendly message
- [ ] **2.2** Build Word Banks section inside Explore
  - Visibility rules: hf-ks1 → Y1+Y2 only, hf-y34 → Y3+Y4 only, hf-y56 → Y5+Y6 only
  - Separate section from curriculum lessons — clearly labelled "Word Banks"
  - Same card UI as curriculum lessons
- [ ] **2.3** Wire word bank lists into ListHub so games can be launched from them
- [ ] **Commit:** `feat(explore): strand/difficulty filters + word banks section`

---

### PHASE 3 — Alien word logic

- [ ] **3.1** Build `wordValidator.js` utility
  - Takes a word string, returns `{ known: boolean, data: object|null }`
  - Checks against v13/v26 lookup (via `wordLookup.js`)
- [ ] **3.2** Wire into custom list creation — flag alien words at entry point
  - Show visual indicator on word pill (e.g. subtle grey border vs coloured border)
  - Tooltip: "This word isn't in our library — it can be used in some games"
- [ ] **3.3** Wire alien word exclusion into Crossword — remove alien words from word pool before grid generation
- [ ] **3.4** Wire into Quiz Quest — exclude alien words from clue-based rounds
- [ ] **3.5** Update all activity launchers to pass `knownWords` and `alienWords` as separate arrays
- [ ] **Commit:** `feat(words): alien word detection and game exclusion logic`

---

### PHASE 4 — Gamification engine

*Design documented. Not yet built.*

- [ ] **4.1** Build `gamificationEngine.js`
  - Spell points (accuracy-tied, not attempt-tied)
  - No deductions for wrong answers — growth mindset throughout
  - Positive-only streaks
- [ ] **4.2** Unlockable character avatars (mastery-milestone-tied)
- [ ] **4.3** Anonymised leaderboards (peers shown as character aliases, not real names)
- [ ] **4.4** Wire points into all activity completion flows
- [ ] **Commit:** `feat(gamification): points, avatars, streaks`

---

### PHASE 5 — Adaptive learning

*Phase 2 system designed and documented. Not yet built.*

- [ ] **5.1** Teacher/parent baseline input
- [ ] **5.2** In-session performance signals (actual errors captured, not just pass/fail)
- [ ] **5.3** Cross-game pattern detection
- [ ] **5.4** Difficulty auto-adjustment (±1 tier per session max)
- [ ] **5.5** Cross-game mastery rules (word mastered = correct in 2+ different activity types)
- [ ] **5.6** Teacher/parent dashboard
- [ ] **Commit:** `feat(adaptive): Phase 2 adaptive learning system`

---

### PHASE 6 — Auth + profiles

*Requires Supabase configuration.*

- [ ] **6.1** Supabase auth setup (already scaffolded, inactive)
- [ ] **6.2** User profiles — persistent progress across devices
- [ ] **6.3** Teacher dashboard — class management, list assignment
- [ ] **6.4** Teacher List Builder — custom weekly lists deployed to class
  - Research question first: *"How do you choose your class's spelling words each week?"*
- [ ] **Commit:** `feat(auth): Supabase auth + user profiles`

---

## Architecture reference

| File | Purpose | Status |
|---|---|---|
| `src/data/curriculumLists.js` | 175 curriculum lessons with words + definitions | ✅ v1.3 |
| `src/data/ks1WordData_v13.js` | Rich word database — Y1/Y2, 1,368 words | ✅ Live |
| `src/data/ks2WordData_v26.js` | Rich word database — Y3-Y6, 2,917 words | ✅ Live |
| `src/data/spelling/index.js` | Legacy statutory pools + utilities | ⚠️ Partial legacy |
| `src/data/definitions.js` | Local definition cache for Crossword | ⚠️ Not pre-populated |
| `src/utils/wordLookup.js` | Per-word data lookup from v13/v26 | ✅ Live |
| `src/utils/wordSelectionEngine.js` | Session word selection | ✅ Live |
| `src/utils/crosswordEngine.js` | Crossword grid generation | ✅ Live |
| `src/utils/masteryEngine.js` | Word mastery tracking | ✅ Live |
| `src/components/explore/ExploreDashboard.jsx` | Main Explore UI | ⏳ Filters in progress |
| `scripts/checkCoverage.mjs` | Coverage verification script | ⚠️ Imports need updating |
| `docs/CURRICULUM_STRUCTURE.md` | Canonical curriculum reference | ✅ v1.4 |

---

## How to use this file

- **Start of every session:** paste this file into the chat so context is current
- **End of every session:** update statuses, add any new decisions to the decisions log, tick completed items
- **Save to:** `docs/SPELLIFY_WORKING_PLAN.md` in the repo
