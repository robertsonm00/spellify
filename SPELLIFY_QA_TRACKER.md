# Spellify — QA Tracker

**Working document.** Bugs, changes, and fixes logged during full-site QA. Add items in this thread and this file gets updated.

_Last updated: 31 May 2026_

---

## ⭐ Design direction (decided 30 May)

**The card design is the keeper. The classic hub is being retired.**

Consequences for the items below:
- **RES-03** (levels/lumens counter on classic hub) → don't fix the classic popup; instead make sure the **card design** has an equivalent post-game points/level/lumens readout. Reframed below.
- **MAS-02** (port classic mastered bar onto card) → no longer just a test; the card is the destination, so the mastered bar should land there properly.
- New item **DESIGN-01** below tracks the actual removal of the classic hub.
- General rule for Claude Code: when classic and card differ, **bring any worthwhile classic element onto the card**, then remove classic. Don't invest in classic-only fixes.

---

## How to read this

- **ID** — stable reference for Claude Code handoff (e.g. "SD-01 is done").
- **Type** — `Bug` (broken), `Enhancement` (new/changed behaviour), `Polish` (feel/feedback).
- **Priority** — `High` / `Med` / `Low`.
- **Status** — `Open` / `In progress` / `Done`.

**ID prefixes:** `SD` Spell Duel · `SDR` Spell Draw · `RES` End-of-game results · `LVL` Levelling · `MAS` Mastery & progress · `ONB` Onboarding · `MAP` Home / Adventure map · `NAV` Footer navigation · `PROF` Profiles & persistence · `WL` Word lists (add your own) · `SYL` Syllable Tap · `SR` Spaced repetition / retry loop · `WRT` Write It · `PRAC` Practice list · `DESIGN` Design direction / hub consolidation

---

## Index

| ID | Area | Title | Type | Priority | Status |
|----|------|-------|------|----------|--------|
| DESIGN-01 | Design direction | Retire classic hub; commit to card design | Change | High | ✅ Done |
| SD-01 | Spell Duel | Add distractor letters to keyboard | Bug / Enhancement | High | Open |
| SD-02 | Spell Duel | Stop adding rounds after 3 words wrong (matches SR-01) | Enhancement | Med | Open |
| SDR-01 | Crossword | Read the Crossword clue aloud (TTS, site voice) | Enhancement | Med | Open |
| RES-01 | Results | Unified end-of-game results — full 2-variant spec (Memory Spell base) | Enhancement | High | Specced |
| RES-02 | Results | Every completed game returns with a celebration | Enhancement / Polish | High | Open |
| RES-03 | Results | Post-game levels/lumens readout — ensure it exists on card design | Bug | High | ✅ Done |
| PRAC-01 | Practice list | Reintroduce the practice list for struggling words | Enhancement | High | Open |
| LVL-01 | Levelling | Rebalance the level-up curve | Bug | High | Open |
| LVL-02 | Levelling | Add a level-up celebration moment | Enhancement / Polish | High | Open |
| MAS-01 | Mastery & progress | Show progress toward mastery + restore hover pop-up (0/14 is correct) | Enhancement | High | ✅ Done |
| MAS-02 | Mastery & progress | Port classic "mastered" bar onto the card design | Enhancement | Med | ✅ Done |
| ONB-01 | Onboarding | Raccoon mascot slow to load (blank first) | Bug | Med | Open |
| MAP-01 | Home / Map | Map image not visible on home load (black flash) | Bug | High | Open |
| MAP-02 | Home / Map | Ember Isle badge glow too strong on mobile | Bug / Polish | Med | Open |
| MAP-03 | Home / Map | Remove dev streak from home page | Change | Med | Open |
| NAV-01 | Footer nav | Footer navigation not working | Bug | High | Open |
| NAV-02 | Footer nav | Move "Shop" from footer nav into hamburger (mobile) | Change | Med | Open |
| NAV-03 | Footer nav | Add 8px top padding to footer nav icons | Polish | Low | Open |
| PROF-01 | Profiles & persistence | Name not shown on Map/home (display only — data is saved) | Bug | Med | ✅ Done |
| WL-01 | Word lists | Hide "Take photo" until feature exists (roadmap after QA) | Change | Med | Open |
| WL-02 | Word lists | Created lists don't save or appear in My Lists (photo + random) | Bug | **Critical** | ✅ Done (via PROF-04) |
| PROF-02 | Profiles & persistence | Hide avatar from menu (not deployable yet) | Change | Med | Open |
| SYL-01 | Syllable Tap | Hide game when word set lacks syllable variety | Enhancement | Med | Open |
| PROF-03 | Profiles & persistence | Persisted progress not shown until point-status refresh (stale UI) | Bug | Low | Not reproduced |
| PROF-04 | Profiles & persistence | "Quick Start" wipes all saved data for returning users | Bug | **Critical** | ✅ Done |
| SR-01 | Spaced repetition | Cap retry rounds for wrong words (currently unbounded → round 22) | Enhancement | High | Open |
| WRT-01 | Write It | One practise per visit, locked in, spaced over days (4 then opt-in) | Change | Med | Open |
| WRT-02 | Write It | Practise labels wrap to two lines on desktop (widen column) | Bug / Polish | Low | Open |

---

## Design direction

### DESIGN-01 — Retire classic hub; commit to card design
**Type:** Change · **Priority:** High · **Status:** ✅ Done

Decision (30 May): **the card design is the product going forward; the classic hub is retired.**

This is a strategic call, so sequence it carefully rather than ripping classic out immediately:
1. **First, port anything worthwhile from classic onto the card** — the post-game levels/lumens readout (RES-03) and the mastered bar (MAS-02) are the known ones. Audit for anything else classic does that the card doesn't.
2. **Then remove** the classic hub: routes, components, and any toggle/entry point that exposes it.
3. **Check for orphans** — code that only the classic hub used, and any settings/links pointing at it.

> **Action for Claude Code:** before deleting anything, list what the classic hub currently provides that the card design doesn't yet, so nothing useful is lost in the switch. Report that list, port the gaps, *then* remove classic.

> **Resolved (31 May):** **remove outright after reporting** — Claude Code reports the gap list, ports the gaps (RES-03 counter, MAS-01/02 mastery bar, plus anything else found), *then* removes classic. No need to keep it behind a setting.

---

## Spell Duel

### SD-01 — Add distractor letters to keyboard
**Type:** Bug / Enhancement · **Priority:** High · **Status:** Open

Right now a player can spell the target word by selecting **every** letter on the keyboard — there's no real fail state because all the needed letters are present and there aren't enough extras to force a wrong choice.

**Interim fix:** add **at least 4 more letters** (decoys/distractors) to the keyboard so the player has to actually choose correctly.

**Future / proper fix:** replace with smarter distractor logic instead of random extras — e.g. pull from the word's `commonMistakes` field or use visually/phonetically similar letters so the wrong options are pedagogically meaningful.

### SD-02 — Stop adding rounds after the wrong-word ceiling
**Type:** Enhancement · **Priority:** Med · **Status:** Open

Same rule as SR-01, applied to **Spell Duel**: once a player hits the **ceiling of 3 wrong words**, stop adding any further rounds. Remaining wrong words go to the practice list (PRAC-01) rather than extending the session.

Use the **same ceiling (3)** and the same bounded-retry logic as SR-01 — one shared rule across games, not per-game-custom.

> **Resolved (31 May):** ceiling = **3**, matching SR-01.

---

## Crossword

### SDR-01 — Read the Crossword clue aloud (TTS)
**Type:** Enhancement · **Priority:** Med · **Status:** Open

Read the **Crossword clue** aloud to the player. Auto-play on reveal plus a replay button.

> **Resolved (31 May):** the phantom "Spell Draw" was a voice slip — this is **Crossword clue audio**. Use the **same warmer, more-human voice used elsewhere on the site**, not a separate/robotic TTS voice. Consistency of voice across the app.

---

## End-of-game results

### RES-01 — Unified end-of-game results (full spec)
**Type:** Enhancement (cross-cutting) · **Priority:** High · **Status:** Specced — ready to build

**Template decided:** **Memory Spell** is the canonical end screen. Every game uses **one shared results component** with **two variants**. The big parked question (which template) is now answered.

**Shared across both variants:**
- A **star** at the top
- A status line (differs per variant — see below)
- A results **container**
- A single **"Continue"** CTA → returns to hub. This **replaces** the old "Play Again" + "Back to Hub" pair everywhere. (Remove "Play Again" entirely.) **The Continue button always sits *outside* all the content containers** — below the word boxes (Variant A) or the stat boxes (Variant B), never inside any of them. Same in both variants.

---

#### Variant A — Word Results
For games where words are individually right/wrong.

**Games:** Memory Spell (the template), Spell Duel, Syllable Tap, Quiz Quest.

**Layout (top → bottom):**
1. Star
2. **"X of X words"**
3. Heading: **"Correct words"** — *renamed from "Words we called correctly"* so the one label works across all these screens
4. Box: **words you got right**
5. Box: **words you need to practise**
6. **Continue** CTA

Per-game notes:
- **Memory Spell** — already closest to target; becomes the reference build.
- **Spell Duel** — adopt wholesale.
- **Quiz Quest** — already structurally the same; the gap is it **doesn't play back the correct words** — add that so it matches.
- **Syllable Tap** — adopt the same layout. It **does** have genuine right/wrong words, so both boxes populate normally. The **only** thing left out for now is the tap-count detail ("you tapped 2; it was 1") — parked, revisit later.

#### Variant B — Completion
For "find-them-all" games where there's no per-word wrong state (you only finish by getting everything) — so no word playback; show **stats** instead.

**Games:** Word Search, Memory Match (a.k.a. Spell Book), Crossword, **Write It**.

**Layout:**
1. Star
2. Status line: **"Completed"** (instead of "X of X words")
3. **Inside the container:** stat tiles — each a **big number** with its **label underneath**
4. **Continue** CTA — **sitting outside the container**

Stat tiles per game:

| Game | Tile 1 | Tile 2 | Tile 3 | Word playback? |
|------|--------|--------|--------|----------------|
| Crossword | Time | Hints used | — | No |
| Memory Match (Spell Book) | Time | Moves | — | No |
| Word Search | Time | Words found | — | No |
| Write It | Time | Number of words | — | No |

(No "number of words" readout on Crossword — explicitly not wanted.)

---

**Net effect:** one component, two variants, ~7 games unified. Same star, same Continue CTA, same visual shell — only the middle (word boxes vs stat tiles) and the status line ("X of X words" vs "Completed") differ.

> **Resolved (31 May):**
> 1. **"Spell Jewel" = Spell Duel** — confirmed (voice transcription consistently mishears "Duel").
> 2. **Syllable Tap** has real right/wrong words — both boxes populate normally. (Earlier "always empty" worry was wrong.) Tap-count detail left out for now.
> 3. **Hangman = Spell Duel** — Hangman no longer exists as a separate game; it *is* Spell Duel. No separate treatment needed.
> 4. **Continue CTA** sits **outside all containers in both variants** — below everything, never inside a box.
> 5. **Star** — keep a **single star for now**. (1–3 stars by performance is an interesting future idea but the per-game scoring logic isn't worked out — deliberately cautious, parked as backlog.)
> 6. **"Spell Draw" = Crossword clue audio** (SDR-01) — the phantom game was a voice slip; the request is clue audio for Crossword, using the **same warmer/more-human voice used elsewhere on the site**.
> 7. **Write It is *included*** — its **end screen uses Variant B** (same component as Word Search & Crossword), showing **Time + Number of words**. (Its in-game Practise 1/2/3 flow is separate — WRT-01.)

**Final game → variant map:**

| Game | Treatment |
|------|-----------|
| Memory Spell | Variant A (template) |
| Spell Duel (formerly Hangman) | Variant A |
| Syllable Tap | Variant A |
| Quiz Quest | Variant A (add correct-word playback) |
| Word Search | Variant B (Time + Words found) |
| Memory Match / Spell Book | Variant B (Time + Moves) |
| Crossword | Variant B (Time + Hints) + clue audio (SDR-01) |
| Write It | **Variant B (Time + Number of words)** — end screen; in-game flow is WRT-01 |

> **Integrates with:** RES-02 (completion celebration), RES-03 (points/level/lumens readout), LVL-02 (level-up flourish) — these layer into this same shared moment. Worth confirming the **order** on screen: e.g. celebration → results screen → Continue, with the points/level readout shown where? Parked until the shell is built.

### RES-02 — Every completed game returns with a celebration
**Type:** Enhancement / Polish · **Priority:** High · **Status:** Open

**Universal requirement:** *every* completed game returns the child with a celebration moment — not just on level-up. Confirmed missing on **Syllable Tap** and **Write It**; assume it's missing or inconsistent across the board until verified.

Distinction to keep clear:
- **RES-02 (this) — completion celebration:** fires on **every** finished game, every time. The "you did it!" payoff.
- **LVL-02 — level-up flourish:** fires **only** when that completion also crosses a level threshold. Layers *on top of* the completion celebration when it happens.

Build both in the shared RES-01 flow so they're identical everywhere and no game can silently skip them. Ingredients already in the stack: `canvas-confetti`, AudioContext chime, retro-arcade overlay.

> **Action for Claude Code:** audit every game's completion path and confirm the shared celebration fires on each. List any game where the completion hook is missing.

> **Resolved (31 May):** **same warm celebration every time** — does not scale with performance. A child who struggled still gets the same encouraging finish.

### RES-03 — Post-game levels/lumens readout (ensure it exists on card design)
**Type:** Bug · **Priority:** High · **Status:** ✅ Done

The **levels + lumens counter** that popped up after completing a game stopped appearing. It lived on the **classic hub** — which is now being retired (see DESIGN-01).

**Reframed:** don't fix the classic popup. Instead, make sure the **card design** has an equivalent post-game readout showing points awarded + current level + lumens, built into the shared results sequence (RES-01).

Areas for Claude Code to check:
- Does the card design already surface points/level/lumens on completion? If not, add it.
- Confirm points/lumens are still awarded under the hood (likely yes per earlier diagnosis) — this is about *showing* them on the card surface.
- Reuse the classic counter's logic/styling where it helps, since it's being ported, not reinvented.

> Part of the same shared-results work — RES-01/02/03 + LVL-02 should be one coherent completion sequence on the card design.

---

## Levelling

### LVL-01 — Rebalance the level-up curve
**Type:** Bug · **Priority:** High · **Status:** Open

Currently far too fast: one Word Search + one Spell Draw and the player was already at **Level 4**. Completion should grant progress, not instant levels.

**Intended curve** (unit = one completed game; "boost toward" implies a progress/XP bar between levels, not a plain counter):

| Reach | Games completed (cumulative) | Notes |
|-------|------------------------------|-------|
| Level 2 | 1 | First completion = a level-up |
| Level 3 | 3 | Game 2 = partial boost toward L3; game 3 completes it |
| Level 4 | 5 | Two more games |
| Level 5 | 7 | Two more games |
| Level 6 | 10 | +3 games |
| Level 7 | 14 | +4 games |
| Level 8 | 19 | +5 games |
| Level 9+ | widening | gap grows by +1 each level (+6, +7, …) |

This maps cleanly to a points model: each completed game = 1 point; thresholds at 1 / 3 / 5 / 7 / 10 / 14 / 19 …, with the gap growing by one game each level after L5. The in-between points fill the progress bar so a non-levelling game still visibly advances the player toward the next level.

> **Resolved (31 May):** curve past L5 = **+3, +4, +5, growing by one each level**. Unit = **one completed game**.

> **Resolved (31 May):** **one global level** — every game feeds the same shared level (recommended option taken). Unit = one completed game. Saved in localStorage now, Supabase later.

### LVL-02 — Add a level-up celebration moment
**Type:** Enhancement / Polish · **Priority:** High · **Status:** Open

Nothing currently signals a level-up — needs "a piece of magic" that clearly announces it, in the pixelated retro-arcade style.

Suggested ingredients (all already in the stack):
- "LEVEL UP!" overlay/banner showing the new level number
- `canvas-confetti` burst (already bundled)
- A chime via AudioContext
- Make it a **reusable** moment so it fires identically across all games (build it inside the RES-01 shared results flow).

> **Observed (30 May):** returning from **Syllable Tap** *and* **Write It** produced **no celebration at all**. Two distinct moments are involved — see **RES-02** (a completion celebration on *every* finished game) vs LVL-02 here (the *level-up* flourish, only when a threshold is crossed). Both should live in the shared RES-01 flow so they fire consistently across all games rather than per-game.

---

## Mastery & progress

### MAS-01 — Show progress toward mastery + restore hover pop-up
**Type:** Enhancement · **Priority:** High · **Status:** ✅ Done

The only mastery signal is "X of 14 words mastered", which gives children no sense of *being on their way*. After two completed games it still reads **0 of 14**, so it feels like nothing happened.

Two parts:
- **Restore the hover pop-up** on the "0 of 14 words mastered" indicator — the one used previously that prompts **"Complete some more"** — so tapping/hovering explains how to progress.
- **Show partial progress** via the **mastery progress bar that already exists on the classic word-list hub** — port it onto the card so a child can see movement *toward* mastery, not just a 0/14 count.

> **Clarified (31 May):** the "show progress" piece specifically means **the classic word-list-hub mastery progress bar**, ported to the card. This is the **same port as MAS-02** — treat them together. The separate **seen → practising → mastered** tiers live on the **word lists themselves** (already exist) and are *not* what this item is about.

> **Update (30 May — diagnosed):** "0 of 14" is **correct behaviour** — mastery requires ≥2.0 credit across **≥2 different game types**, so two games can legitimately leave it at 0. **Not a bug**; the work is the feature gap above (progress bar + hover tip).

### MAS-02 — Port classic "mastered" bar onto the card design
**Type:** Enhancement · **Priority:** Med · **Status:** ✅ Done

Bring the **"mastered" bar from the classic design** onto the **card design**. Originally framed as a test — but with the card design now confirmed as the keeper (DESIGN-01), this is a proper port, not just an experiment.

- Reuse the **existing classic mastered-bar** component/styling rather than rebuilding.
- Place it on the card layout where it reads naturally.

This dovetails with **MAS-01** — the bar is a concrete way to "show progress toward mastery" on the card, and may simply *be* the MAS-01 solution on the card surface.

> Still worth a quick look once it's on the card to confirm it sits well, but no longer a throwaway test — it's part of consolidating onto the card design.

---

## Onboarding

### ONB-01 — Raccoon mascot slow to load (blank first)
**Type:** Bug · **Priority:** Med · **Status:** Open

On the onboarding flow the raccoon takes a long time to appear — it renders **blank first**, then the mascot pops in later. Rough first impression.

Likely fixes for Claude Code to check:
- Preload/bundle the asset so it's ready before the screen shows (rather than fetched on render).
- Reserve its dimensions / show a lightweight placeholder to avoid the blank flash and layout shift.
- Optimise/compress the asset (and confirm it's not being pulled from a slow remote source).

---

## Home / Adventure map

### MAP-01 — Map image not visible on home load (black flash)
**Type:** Bug · **Priority:** High · **Status:** Open

When the home screen loads, the map image isn't rendered straight away — you get a **black screen** for a moment, then the image pops in. It should be visible first, with no black flash. Seen on the primary screen every load, so it's a prominent first impression.

Likely fixes for Claude Code to check:
- Preload the map asset so it's ready before the screen paints.
- Set the screen/container background to the map's base colour (not black) so any gap doesn't flash black.
- Reduce/compress the image — if it's the file size causing the delay, shrink it (and reserve its dimensions to avoid layout shift).
- Consider a low-res placeholder that swaps to full-res once loaded.

> Same class of issue as ONB-01 (asset-load flash) — worth fixing both with one preload/placeholder approach.

### MAP-02 — Ember Isle badge glow too strong on mobile
**Type:** Bug / Polish · **Priority:** Med · **Status:** Open

On mobile, the **Ember Isle** badge has too much glow/halo (the blue) — it spreads so far it renders as a visible **outer box** around the badge. Pull it right back so there's no outer box.

The **HFW island ("The Enchanted Words")** badge is correct — match that one.

> **Resolved (31 May):** confirmed — it's the **glow/box-shadow spreading to the edge of the visible box**. Just reduce the spread so it no longer reaches/forms the box edge.

### MAP-03 — Remove dev streak from home page
**Type:** Change · **Priority:** Med · **Status:** Open

Remove the **dev streak** indicator from the home page — a development/debug artifact that shouldn't be showing.

> If it's a temporary stand-in for a real streak feature later, note it for the backlog rather than deleting the concept entirely.

---

## Footer navigation

### NAV-01 — Footer navigation not working
**Type:** Bug · **Priority:** High · **Status:** Open

The footer nav doesn't function — taps/clicks aren't routing as expected.

> **Note (31 May):** Shop is moving to the hamburger on mobile (NAV-02), not deleted — so it's not the "broken item." Claude Code should still diagnose whether *all* footer items fail or only some, and confirm each remaining item's destination.

### NAV-02 — Move "Shop" from footer nav into the hamburger (mobile)
**Type:** Change · **Priority:** Med · **Status:** Open

On **mobile**, take the **Shop** entry **out of the footer nav** and **into the hamburger menu**. Not deleted — relocated, so the footer is less crowded while Shop stays reachable.

### NAV-03 — Add 8px top padding to footer nav icons
**Type:** Polish · **Priority:** Low · **Status:** Open

Add **8px padding at the top** of the footer nav icons for better spacing.

---

## Profiles & persistence

### PROF-01 — Name not shown on Map/home (display only — data is saved)
**Type:** Bug · **Priority:** Med · **Status:** Diagnosed (30 May)

**Originally logged as "the big one — profile doesn't persist." Diagnosis showed it's a display gap, not data loss.** Live test (create profile → hard reload → inspect storage) confirmed name, avatar, the spelling-confidence baseline, and game progress are **all saved and survive reload**.

Why it looked broken: the screen you land on after reload is the **Adventure Map, which never shows the name** — only the buddy sprite. The name is correct in **Settings** and on the **Explore** player card. Persistence is sound (whole session saved as one blob under one key, read back whole on load — there's no path where avatar saves but name doesn't).

The actual fix (small, display-only):
- Show the child's **name on the Map/home view**.
- Fix the **Explore card's "PLAYER" default label** so it uses `childName` instead of the generic placeholder.

> ~~Earlier "partial save" / "stale UI" theories~~ — superseded by the live diagnosis above. Data is not lost.

### PROF-02 — Hide avatar from menu (not deployable yet)
**Type:** Change · **Priority:** Med · **Status:** Open

Hide the **avatar** from the menu for now — it needs a lot more work before it's deployable. Hide rather than remove, so it can be switched back on when ready.

### PROF-03 — Persisted progress not shown until point-status refresh (stale UI)
**Type:** Bug · **Priority:** Low · **Status:** Not reproduced (30 May)

Hypothesised from Syllable Tap testing (progress appearing to "return" only after a point-status update).

**Diagnosis:** could not reproduce in the normal game-completion flow. Both completion paths dispatch the `spellify-points-update` event correctly, and values read fresh on reload. If it's real, it's on a narrower path.

> **Action:** parked unless you can give the exact steps that produced the "stale until refresh" behaviour. If you hit it again, note exactly which game and what you did.

### PROF-04 — "Quick Start" wipes all saved data for returning users
**Type:** Bug · **Priority:** Critical · **Status:** Open

**Real data-loss vector found during diagnosis.** When a returning user taps **Quick Start** again, the start handler clears **all `spellify_*` keys** — which would wipe saved lists and progress.

This is the genuine "I lost my stuff" bug (as opposed to PROF-01, which only looked like loss). It's also the **prime suspect for WL-02** — if creating a list works but a later Quick Start nukes storage, lists would vanish.

Action for Claude Code:
- Don't wipe all storage on Quick Start for a returning user — only initialise a fresh session when there's genuinely no existing one, or confirm with the user before clearing.
- Re-test WL-02 with this in mind.

---

## Syllable Tap

### SYL-01 — Hide game when word set lacks syllable variety
**Type:** Enhancement · **Priority:** Med · **Status:** Open

Don't offer **Syllable Tap** as an available game when the word set makes it trivial. Don't show it if **either**:
- **≥ 50% of the words are one syllable (monosyllabic)**, or
- **all the words have the same syllable count**.

In those cases there's no meaningful syllable challenge, so the game shouldn't appear for that session/list.

This is computable from the existing `syllables` field on each word, so no new data needed.

> **Resolved (31 May):** **either** condition triggers the hide — ≥50% one-syllable **OR** all words the same syllable count. Applies to **both** curriculum sessions **and** custom word lists.

---

## Spaced repetition / retry loop

### SR-01 — Cap retry rounds for wrong words
**Type:** Enhancement (design rethink) · **Priority:** High · **Status:** Open

**Current behaviour:** a 14-word session adds a fresh round to the **end** every time a word is wrong, with no apparent ceiling — a few mistakes pushed the session to **round 21, then 22**. It behaves like an endless retry loop (Hangman-style "keep going until right") rather than true spaced repetition, and a struggling child gets stuck in the game indefinitely.

**Redesign — one retry per word, plus a session ceiling:**

**Rule 1 — one second chance per word (not repeated re-queuing).**
- When a word is wrong, it comes back **once**, at the **end** of the session, for **a single retry**.
- Get it right on that retry → resolved. Get it wrong again → it goes to the **"needs practice" list** (RES-01). It does **not** keep reappearing in the same session.
- No word is ever queued more than once. (Replaces the old "up to 4 attempts" idea — that was a misread; the cap is **1**.)

**Rule 2 — session-level ceiling = 3 wrong words.**
- The concern isn't 4 mistakes on *one* word — it's a child getting **several different words wrong** and still being kept going. That's the signal something else is up (word set too hard, tired, a pattern not landing).
- Cap at **3 wrong words** getting a retry round. Beyond 3, **stop adding retry rounds** — remaining wrong words go straight to the practice list so the child can finish rather than being stuck.

**Rule 3 — practice works in batches of 3, with a modal to continue.**
- The practice set is capped at **3 words**. Once the child completes those 3, **if they come back in**, show a **small modal offering to add another practice set** (the next batch of words they're struggling with). So practice is bounded into digestible sets of 3 rather than one endless list.

**Pedagogical rationale:** one fair second attempt respects the child without drilling them; if they're missing words across the board, more in-session repetition won't fix it, and finishing on a win then revisiting later (proper spacing, across days) is healthier than an endless session. Batching into 3s keeps each practice burst short and winnable.

**Cross-refs:**
- Ties into **RES-01** — both "failed the one retry" and "over the ceiling" words land on the practice list (**PRAC-01**).
- Interim only — the long-term date-based spaced-repetition system (across days) is the real fix; this just makes the in-session loop humane and bounded.

> **Resolved (31 May):** ceiling = **3**. Practice set size = **3**, with a modal offering the next set on return. Same ceiling applies to Spell Duel (SD-02).

---

## Practice list

### PRAC-01 — Reintroduce the practice list for struggling words
**Type:** Enhancement · **Priority:** High · **Status:** Open

Bring back the **practice list**: the place words go once a child has had their attempts (the SR-01 single retry, or once over the session ceiling) and is still getting them wrong. This is the destination that SR-01, SD-02, and RES-01 all refer to — so it needs to actually exist and be wired up.

**Resolved placement & behaviour (31 May):**
- **Lives as a tile** in the word-list hub — sits as **a `div` above all the word games**, **underneath the headline and the "words mastered" count**. Make it **the first tile**, with the **same visual treatment** as the game tiles. **Placeholder image is fine for now.**
- **Single global pool** — one practice list of everything the child is currently struggling with (not per word-list), surfaced in **batches of 3** (see SR-01 Rule 3): clear a set of 3 → modal offers the next set.
- **Where words come from:** any word that fails its one retry (SR-01) or is pushed past the ceiling of 3.
- **How a word leaves:** get it right / reach a mastery tier → it graduates off the practice list.
- **Persistence:** must survive reload and must **not** be wiped by Quick Start (now fixed via PROF-04 ✅).

**Action for Claude Code:** investigate what the practice list *used* to be (git history / existing components) — this is a *re*introduction, so there may be code to restore rather than build fresh. Report what was there, then build the first-tile version above.

**Cross-refs:** the shared sink for **SR-01** (failed retry / over ceiling) and **SD-02** (Spell Duel ceiling), and the practice destination referenced by **RES-01**. Tied to **MAS-01/02** — a word on the practice list is, by definition, not yet mastered.

---

## Write It

### WRT-01 — One practise per visit, locked in, spaced over days
**Type:** Change · **Priority:** Med · **Status:** Open

(Not a bug — Write It on **mobile** works really well. This is a refinement.)

**Intended flow (revised 31 May):** Write It practises are meant to be done **over days, not all in one sitting** — so each practise returns the child to the hub rather than rolling straight into the next.

1. Child does **Practise 1** → on completion, show the results screen → **Continue returns them to the hub**. Practise 1 is now **locked in** (done).
2. **Next time they enter** Write It, they get **Practise 2** (because Practise 1 is locked in). Complete → back to hub.
3. Same for **Practise 3** and **Practise 4** — one per visit, each locking in.
4. **Beyond Practise 4**, don't keep auto-presenting — just **ask via a prompt whether they'd like to do a new practise**.

So the four core practises are **sequential and spaced** (one per visit, each locked in on completion), then further practise is **opt-in**.

- **Lock buttons:** show only the **current available practise**; completed ones read as locked-in/done, and future ones aren't dangled as locked buttons up front.
- **End screen:** each completed practise shows the **RES-01 Variant B** results (Completed · Time · Number of words · Continue → hub) — same component as Word Search/Crossword.

> **Resolved (31 May):** four structured practises (1→4), **one per visit**, returning to hub each time (spacing over days); past 4, prompt to start a new practise. End screen = RES-01 Variant B.

> This makes Write It the clearest embodiment of the spacing philosophy behind SR-01 — practice spread across days rather than crammed.

> **Minor open detail (Claude Code can decide sensibly):** exactly how completed/locked-in practises are shown vs the current one (e.g. ticked + greyed vs hidden). Keep it uncluttered.

### WRT-02 — Practise labels wrap to two lines on desktop
**Type:** Bug / Polish · **Priority:** Low · **Status:** Open

On **desktop**, the "Practise" labels (1–4) wrap onto **two lines** when completed. Widen those columns a little so each label sits on **one line**.

Tested fix: **~120px** column width got "Practise 1" onto a single line (with the others stacking neatly beneath). Use that as the starting value.

> Desktop-specific — mobile is unaffected (and per WRT-01, mobile works well). Confirm the widen doesn't disrupt the mobile layout.

---

## Word lists (add your own)

### WL-01 — Hide "Take photo" until the feature exists
**Type:** Change · **Priority:** Med · **Status:** Open

The "Take photo" option has **no working camera/OCR path behind it** — the photo references are just tile styling.

> **Resolved (31 May):** **hide the "Take photo" option for now** (so children/parents aren't offered a dead button). The actual photo/scan-a-word-list feature goes on the **roadmap to build after this QA phase** — it aligns with the scan-a-list spin-off concept. Not net-new work during QA.

### WL-02 — Created lists don't save or appear in My Lists
**Type:** Bug · **Priority:** Critical · **Status:** Open

Creating a word list is broken across **both** entry paths:
- **From a photo:** add the list → add the words → save (10–12 words) → the list **does not appear** in My Lists. Reproduced twice, failed both times.
- **Random list:** also fails — it **doesn't load** the list and **doesn't save** it.

**Expected flow:** after creating a list → go straight into a **word-list "world"** to play the games → tapping **back** returns to **My Lists** → the new list **appears** in My Lists. None of this is happening — neither the save nor the navigation.

Areas for Claude Code to check:
- Is the list written to storage on save? (key present, correct shape, all words captured.)
- Does **My Lists** read from that store and render saved lists?
- Post-save navigation: does it route into the word-list world to play? Does **back** return to My Lists rather than elsewhere?
- The **random list** has two distinct failures — it doesn't *load* (generation/fetch) *and* doesn't *save*. Separate the load failure from the save failure when debugging.

**Cross-ref:** PROF-01 turned out *not* to be a persistence failure, so the old "same broken layer" theory is out. The real suspect is now **PROF-04** — Quick Start wiping all `spellify_*` keys. Re-test WL-02 after PROF-04 is addressed: it's plausible lists *do* save but a later Quick Start deletes them. Still verify the save and the random-list *load* paths independently.

---

## Open questions / decisions parked

**All resolved 31 May except one** (the levelling scope question below).

1. ~~SDR-01 game name~~ → **Crossword clue audio**, site voice.
2. ~~RES-01 template~~ → **Memory Spell**, two-variant spec.
3. ~~Retry/practice ceiling~~ → **3**; practice in sets of 3 with a modal for the next set (SR-01, SD-02).
4. ~~Practice list location~~ → **first tile** above the word games, under the headline + words-mastered count; **global pool**; placeholder image OK (PRAC-01).
5. ~~Write It cap / end screen~~ → **one practise per visit, locked in, spaced over days**; 4 structured then opt-in; end screen = Variant B (WRT-01).
6. ~~Quiz Quest / Syllable Tap variants~~ → both **Variant A** (RES-01).
7. ~~Level curve past L5~~ → **+3, +4, +5 …** growing by one (LVL-01).
8. ~~Mastery display~~ → port the **classic word-list-hub mastery bar** to the card (MAS-01 = MAS-02).
9. ~~Celebration scaling~~ → **same every time** (RES-02).
10. ~~Syllable Tap gating~~ → either condition triggers; both contexts (SYL-01).
11. ~~"Take photo"~~ → **hide now**, build post-QA (WL-01).
12. ~~Shop in footer~~ → **move to hamburger on mobile** (NAV-02).
13. ~~Ember Isle glow~~ → reduce box-shadow spread (MAP-02).
14. ~~Classic removal~~ → **port → report → remove outright** (DESIGN-01).
15. ~~Clear test data~~ → yes (Claude Code housekeeping).

16. ~~Levelling scope~~ → **one global level** across all games (LVL-01).

**✅ All product decisions resolved.** Nothing left for you to decide.

**Still requires Claude Code investigation (not a you-decision):**
- **NAV-01** — diagnose whether *all* footer items fail or only some.
- **PRAC-01 / RES-03 / MAS bar** — find what existed before in git history and restore vs rebuild.
