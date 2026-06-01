# Corpus Protection — Build Summary & Roadmap

**Date:** 2026-06-01 · **Status of this phase:** ✅ shipped to `main`
**Companion doc:** `docs/CORPUS_PROTECTION_DESIGN.md` (full architecture + schema/Edge-Function sketches)

This is a portable summary you can paste into other roadmaps. It covers (1) the
problem, (2) what was built and shipped, (3) what was deliberately deferred, and
(4) the future options with effort notes and the facts needed to pick them up.

---

## 1. The problem (plain English)

Spellify's word data — thousands of words with kid-friendly definitions, example
sentences, "tricky part" hints, common misspellings, phonics, etc. — is the
hand-made, proprietary core of the product. Until now the **entire collection
(~6,750 words / ~4.5 MB) was shipped to every visitor's browser**, where anyone
could open dev tools and copy the whole thing in one click. Goal: stop one-click
bulk extraction without losing offline play of the core curriculum.

---

## 2. What we built & shipped ✅

**Decision taken:** "rich-corpus-first" — protect the big rich dataset now;
defer the smaller definitions file as a fast-follow.

**The change:** the app now ships only a small **Tier-1 offline set** and no
longer bundles the wider corpus.

| | Before | After |
|---|---|---|
| Words shipped in browser | ~6,750 (full corpus) | **327** (Tier-1 only) |
| Rich data exposed | all ~4.5 MB, one-click grab | only the 327 core words |
| Main JS bundle (gzip) | ~1.37 MB | **~590 KB** (−784 KB, ~57% smaller) |

**Why 327 and not 309 (the statutory count):** Tier-1 = **all statutory words
∪ every word the offline picker (`selectWords`) can draw from**. 18 pool words
(circle, february, through, question, complete…) are statutory in the KS2 data
but the de-dup merge returns their non-statutory KS1 copy — a statutory-only set
would have dropped them and regressed enrichment. The union is the correct,
minimal offline boundary.

**Why it was safe (no regression):**
- No game reads the rich "moat" fields at runtime (the `getEnrichedLesson`
  `.enriched` path is dead code — nothing consumes it).
- Gameplay clues come from a separate, still-bundled file (`definitions.js`),
  which covers 99.9% of built-in lesson words.
- `selectWords` only ever uses the statutory pools — all in Tier-1.
- Built-in themed lessons render their own inline short definitions.

**Files (what changed):**
- `scripts/buildStatutoryTier1.mjs` — **new.** Generator that reads the source
  word data + curriculum pools and emits the Tier-1 set. Has an integrity guard
  that throws if any pool word is missing. Re-run after any word-data change:
  `node scripts/buildStatutoryTier1.mjs`
- `src/data/statutoryTier1.js` — **new, generated.** The 327 bundled entries
  (~216 KB). Do not hand-edit.
- `src/utils/wordLookup.js` — **changed.** Now imports only `statutoryTier1.js`
  instead of the full `ks1WordData_v14.js` + `ks2WordData_v30.js`. Added a
  `primeWords()` seam so future fetched words can be merged into the lookup.
- `docs/CORPUS_PROTECTION_DESIGN.md` — **updated** with corrected numbers and
  the decisions taken.

**Commits (on `main`):**
- `1ce80eb` — Unbundle wider word corpus: ship only Tier-1 offline set
- `50d11c8` — Update corpus-protection doc: real numbers + decisions

**The source files still exist** (`src/data/ks1WordData_v14.js`,
`ks2WordData_v30.js`) but are no longer imported by the app, so they tree-shake
out of the bundle. They remain as the source for the Tier-1 generator and any
future server-side seed.

---

## 3. What we deliberately deferred (and why)

The original design imagined a **Supabase "gate"** (a `words` table + a
`get-word-list` Edge Function with auth + rate-limits) to serve the wider words
on demand. **We did not build it**, because:

- The protection is already achieved by *not shipping* the data — the gate
  would have **no current consumer** (nothing in the app fetches wider words).
- An unused, deployed endpoint is maintenance + attack surface for zero benefit.
- Its exact contract should be shaped by its first real consumer, and tested
  end-to-end with that consumer attached.

So the gate is now **forward infrastructure** — build it the day a feature needs
to *serve* wider words.

---

## 4. Future roadmap

### Option A — Do nothing more (valid)
The bulk-extraction hole is sealed. This may be sufficient.

### Option B — Definitions phase (the tightest-security fast-follow) · ~1–2 days
Protect the one remaining medium-value file in the bundle: `src/data/definitions.js`
(~4,753 plain definitions, ~281 KB).
- **What:** move `definitions.js` server-side; bundle only the ~309 statutory
  definitions (~11 KB). Built-in lessons still show definitions offline via the
  `curriculumLists.js` inline copies.
- **Builds the gate:** this is the first real consumer of the Supabase gate, so
  it creates the `words` table + `get-word-list` Edge Function *and* exercises
  them for real.
- **Cost:** Crossword and Quiz Quest get a small "loading…" state for
  less-common (non-statutory) clues, because their clue lookup becomes async.
- **Net:** both moats (rich data + definitions) protected; only words that are
  neither statutory nor built-in need the network — and those are online
  activities anyway.

### Option C — Runtime custom-list enrichment · ~1 day (after gate exists)
If you later want grown-ups' **custom word lists** to get the same rich hints /
sentences as built-in lessons, that fetches from the same gate. Another natural
reason to build the gate.

### Backend gate — what it is when you build it (B or C triggers it)
Sketches already in `CORPUS_PROTECTION_DESIGN.md` §7–§8:
- **`words` table** (Postgres): the wider corpus, RLS locked so the anon/auth
  client **cannot** read it directly — only the Edge Function (service role) can.
- **`get-word-list` Edge Function:** auth required (Supabase JWT); takes a
  *named list / level*, never "all"; bounded response; rate-limited per user;
  no bulk endpoint.
- **Client:** a fetch + cache layer (session memory + IndexedDB with cap &
  expire — already the chosen cache policy) calling `primeWords()` in
  `wordLookup.js` to merge fetched words in. Prefetch the next list during play
  so the ~100–400 ms first-fetch is hidden.
- **Hardening (later):** per-account quotas, anomaly detection, canary words.

### Honest limit (worth keeping in the roadmap)
No architecture can stop someone *slowly* copying words they're legitimately
shown, one screen at a time. The realistic goal — already met for bulk theft,
and tightened further by Option B — is to make **one-click bulk extraction
impossible** and slow list-by-list harvesting tedious and not worth it.

---

## 5. Quick facts (for picking this up cold)

- Runtime corpus: **6,750 unique** entries (raw source rows 7,135 before de-dup).
- Statutory: **309**. Tier-1 (shipped): **327** (statutory ∪ selectWords pools).
- `definitions.js`: **4,753** plain defs, ~281 KB, covers 99.9% of built-in words.
- Only files that imported the wider corpus: `wordLookup.js` (now fixed) — it
  was the single choke point, which is why the change was surgical.
- Regenerate Tier-1: `node scripts/buildStatutoryTier1.mjs`
- Verify a clean build: `CI=true npm run build` → expect "Compiled successfully."
- Cache policy chosen for the future gate: **cap & expire** IndexedDB.
- Offline-boundary decision: **statutory ∪ selectWords pools** (advice accepted).
- Phasing decision: **rich-corpus-first**, definitions gating deferred.
