# Corpus Protection — Design Document (v1, draft)

**Status:** Draft for review · **Date:** 2026-06-01 · **Owner:** TBC
**Decision pending:** approve architecture before any code is written.

---

## 1. Problem & goal

The curated word corpus is Spellify's core proprietary asset. Today it is
**bundled wholesale into the browser**: `src/utils/wordLookup.js` imports the
full KS1 (`ks1WordData_v14.js`) and KS2 (`ks2WordData_v30.js`) data and builds
an in-memory `Map` at module load. Anyone can open DevTools, find the bundle,
and extract the **entire corpus in one action**.

**Measured size of the asset (2026-06-01):**

| | Entries | JSON size |
|---|---:|---:|
| Full corpus | **7,135** | **~4.9 MB** |
| Statutory subset (`statutory: true`) | **324** | **~218 KB** |
| Wider/proprietary remainder | ~6,811 | ~4.7 MB |

Each entry carries 18 enrichment fields: `word, year, yearBand, statutory,
yearsApplicable, difficulty, ncSource, spellingRule, patternGroup,
corePatternWord, wordType, phonicsPattern, syllables, trickyPart, definitions,
sentence, relatedWords, commonMistakes`. The **enrichment** (definitions,
sentences, tricky parts, common mistakes, phonics) is the real moat — the bare
word lists are partly public.

**Goal:** stop one-click bulk extraction of the wider corpus **without** losing
offline play of the core curriculum.

---

## 2. Key decision — two-tier hybrid

The 324 statutory words are the **national-curriculum default** that most games
are built around. They are ~4.4% of the corpus, ~218 KB, already flagged in the
data (`statutory: true` + `isStatutory()` helper), and the underlying word
*lists* are public DfE content. So:

- **Tier 1 — baked in, offline, zero latency.** Ship the 324 statutory entries
  (with enrichment) in the bundle. The core experience runs fully offline.
  Exposure cost: ~218 KB of enrichment for commodity words — acceptable.
- **Tier 2 — server-gated, online, low latency.** The ~6,811 wider entries move
  to a Supabase table behind an Edge Function that only ever returns the
  **specific list for the current activity** — no bulk endpoint. This is custom
  lists + the "evergreen" content we author.

This is **strictly better than the static-chunk middle ground** we discussed:
static JSON chunks are still publicly fetchable by URL (open extraction). The
hybrid keeps the wider corpus un-fetchable in bulk while preserving offline core
play. It directly matches the "offline core, protected moat" intuition.

```
                         ┌─────────────────────────────┐
   Statutory (324) ──────►  Bundled in app (Tier 1)     │  offline, 0 latency
                         └─────────────────────────────┘
                         ┌─────────────────────────────┐
   Wider (~6,811) ───────►  Supabase table             │
                         │   ↑ Edge Function gate       │  online, ~100–400ms
                         │   (auth + scoped + rate-limit)│  cached after 1st fetch
                         └─────────────────────────────┘
```

---

## 3. Latency — how big a wait?

Supabase Edge Functions run on Deno's edge network; deployed to a UK/EU region
for a UK user:

- **Warm call:** ~80–200 ms (function exec + network round-trip); the DB query
  for 10–20 words is single-digit ms.
- **Cold start:** occasionally +100–300 ms.
- **Realistic fresh fetch:** ~**100–400 ms** — comparable to a screen
  transition.

**Mitigations make the perceived wait ~0 at point of need:**
1. **Prefetch** the next list while the child plays the current one.
2. **Session cache** — never refetch a list already loaded this session.
3. **Persistent cache (IndexedDB)** — see §4.

The only unavoidable wait is the very first fetch of a never-seen wider/custom
list at activity start. With prefetch + cache, gameplay is not latency-bound.

---

## 4. Offline strategy

Offline play matters (kids on tablets without signal). The hybrid handles it:

- **Tier 1 (statutory):** bundled → always offline. Covers the majority of
  lessons.
- **Tier 2 (wider/custom):** cache each fetched list in **IndexedDB** on first
  load. Once a child has played a list online, it replays offline. New,
  never-fetched wider lists are the only thing that needs connectivity.
- **Security note:** caching Tier 2 locally means *those specific lists* a user
  has legitimately loaded now sit on their device — unavoidable for offline, and
  no worse than them having seen the words. The bulk corpus is still never
  delivered. Optionally cap/expire the IndexedDB cache so the whole corpus can't
  be slowly accreted into local storage.

---

## 5. What "multi-day project with real testing" means

It is not algorithmically hard — it is **broad**, because the corpus is the root
data dependency that every game reads from. Work items:

1. **Schema + migration** — model the 18 fields in Postgres; write a one-time
   loader that exports `v30` + `v14`, replicates the current merge/precedence
   logic, and verifies integrity (count + spot-check).
2. **Edge Function** — auth check, input validation, scoped query (return only a
   named list/level), rate limiting, error handling.
3. **Async rewrite of `wordLookup.js`** — today all 10 exports are *synchronous*
   (`getWordData`, `getDefinition`, `getSentence`, `getSyllables`,
   `getTrickyPart`, `getCommonMistakes`, `getRelatedWords`, `getPatternGroup`,
   `getDifficulty`, `isStatutory`). Tier 1 stays sync; Tier 2 becomes async. The
   ripple: direct importers are `wordSelectionEngine.js`, `clueResolver.js`, and
   `curriculumLists.js` — but those feed the games, so each game that resolves
   words at runtime needs a loading state.
4. **Caching layer** — session + IndexedDB.
5. **Real testing** = hands-on functional QA, not just "it compiles":
   - Play every game mode end-to-end; words/definitions/clues resolve.
   - Offline: statutory plays with no network; a previously-loaded wider list
     replays; a brand-new wider list degrades gracefully.
   - Security: confirm a raw bulk query is blocked by RLS; confirm the rate
     limit trips; confirm no bulk endpoint exists.

**Rough estimate:** ~2–4 focused days, dominated by the async ripple in step 3
and the QA in step 5.

---

## 6. Can slow, list-by-list extraction be stopped? (the "D" question)

**Honest answer: not absolutely.** Any word the app legitimately shows a child
has, by definition, been delivered to that device and can be captured. There is
no architecture that prevents capture of content a user is shown.

**But the hybrid eliminates the threat you actually care about** — "scrape the
whole site in seconds." What remains is slow, authenticated, rate-limited
harvesting, which we make economically impractical:

- **Auth-gated** — must be a signed-in account; no anonymous bulk pull.
- **No bulk endpoint** — only named lists, bounded size.
- **Rate limits / per-account quotas** — e.g. N list fetches per hour; harvesting
  7k words becomes days/weeks of scripted play across many accounts.
- **Anomaly detection** — flag accounts whose fetch pattern looks like scraping.
- **Canary words** — seed a few unique marker entries so we can *prove* copying
  if our data shows up elsewhere.
- **ToS + legal** — extraction becomes a contract/IP breach with a paper trail.

The realistic security goal is **"raise the cost of extraction far above its
value,"** not "make it impossible." The hybrid achieves that for 95.6% of the
corpus while keeping the core fully offline.

---

## 7. Proposed schema (sketch)

```
table words (
  id            bigint primary key generated always as identity,
  word          text not null,
  word_lc       text not null,              -- lower-cased key, indexed
  year          int,
  year_band     text,
  statutory     boolean not null default false,
  difficulty    text,
  nc_source     text,
  spelling_rule text,
  pattern_group text,
  phonics       text,
  syllables     text,
  tricky_part   text,
  word_type     text,
  definitions   jsonb,                       -- {def_7to10, def_10to12, ...}
  sentence      text,
  related_words text[],
  common_mistakes text,
  list_keys     text[]                       -- which curated lists it belongs to
);
-- index on word_lc; index on list_keys (GIN); statutory rows may stay in-bundle.
-- RLS: authenticated read ONLY via the Edge Function's service path; no direct
-- table SELECT for the anon/auth client.
```

---

## 8. Edge Function contract (sketch)

```
POST /functions/v1/get-word-list
  auth:    required (Supabase JWT)
  body:    { listKey: string }   // or { level, yearBand } — never "all"
  returns: { words: WordEntry[] } // bounded (one list, ~10–30 words)
  guards:  reject missing/invalid listKey; rate-limit per user;
           never accept an unbounded/"select all" request.
```

`wordLookup` becomes a thin client: Tier-1 sync lookups hit the bundled
statutory map; Tier-2 lookups call this function (via cache).

---

## 9. Rollout phases

1. **Phase 0 — prep (low risk):** generate the bundled Tier-1 statutory dataset
   (324 entries) from current data; add a build step so it can't drift.
2. **Phase 1 — backend:** create table, migration loader, Edge Function, RLS.
   No client change yet; verify via direct function calls.
3. **Phase 2 — client:** async `wordLookup` + caching + loading states; ripple
   through `wordSelectionEngine` / `clueResolver` / games.
4. **Phase 3 — cutover:** stop bundling the wider corpus; ship Tier-1 only.
   Wider words now come exclusively from the gate.
5. **Phase 4 — hardening:** rate limits, anomaly detection, canary words.

Each phase is independently shippable and reversible.

---

## 10. Open questions for sign-off

1. **Tier-1 boundary:** is "statutory-flagged (324)" the right offline set, or
   should a few high-use non-statutory lists also be baked in?
2. **IndexedDB cache:** cap/expire it (slows local accretion) or unlimited
   (best offline UX)?
3. **Latency budget:** is ~100–400 ms on first fetch of a *new* wider list
   acceptable, given prefetch hides it elsewhere?
4. **Phasing:** build the whole thing, or ship Phase 0 (offline statutory split)
   first as a quick win and schedule the backend separately?
