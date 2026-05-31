# Spellify — QA Tracker (Round 2)

**Working document.** New bugs, UI changes, and feature ideas spotted while Round 1 fixes are still in progress. Companion to `SPELLIFY_QA_TRACKER.md` (Round 1) — kept separate so in-flight work and newly-found items don't get tangled.

_Created: 31 May 2026_

---

## How to read this

- **ID** — stable reference for Claude Code handoff. **R2-** prefix throughout so these never clash with Round 1 IDs.
- **Type** — `Bug` (broken), `Enhancement` (new/changed behaviour), `Feature` (net-new), `UI` (visual/layout), `Polish` (feel/feedback), `Change` (adjust existing).
- **Priority** — `High` / `Med` / `Low`.
- **Status** — `Open` / `In progress` / `Done`.

---

## Index

| ID | Area | Title | Type | Priority | Status |
|----|------|-------|------|----------|--------|
| R2-01 | Word Forge | Gate when list lacks prefixes/suffixes; restyle to Memory Spell | Enhancement / UI | Med | ✅ Done |
| R2-02 | Weak Spot | Restyle to Memory Spell + new background; Variant A end screen | UI | Med | Open |
| R2-03 | Word Mastery | Hover text describes mastery wrongly ("play 14 more games") | Bug | High | ✅ Done (removed) |
| R2-04 | Cross-game | Persistent word-list panel (right side) in all games, collapsible | Feature | High | Open |
| R2-05 | Avatars / Profile | Avatar packs — pick a character, unlock/buy themed packs with lumens | Feature | Med | → Moved to R3-02 |
| R2-06 | Parent / Auth | Force parent PIN setup at profile creation (not deferred) | Bug / Security | High | Open |
| R2-07 | Performance | Confetti slow/janky returning to home after mastering a list | Bug | High | ✅ Done |
| R2-08 | Performance | Audit asset/file sizes site-wide; convert world backgrounds to WebP | Enhancement | High | ✅ Done |
| R2-09 | Quiz Quest / Memory Spell | Align in-game header UI (font, colour, pill) | UI | Med | ✅ Done |

---

## Items

### R2-01 — Word Forge: gate when list lacks prefixes/suffixes; UI update
**Type:** Enhancement / UI · **Priority:** Med · **Status:** ✅ Done (31 May)

> **Resolved (31 May):**
> - **Gating** was already live in `utils/activityAvailability.js` — Word Forge is dropped from the grid when no word in the set has a prefix/suffix breakdown (`!words.some(hasMorphology)`). Threshold = **zero** qualifying words hides it (it only ever operates on the qualifying subset, so any ≥1 is playable). Shares the same availability predicate pattern as Syllable Tap (SYL-01).
> - **UI** rebuilt to Memory Spell's look/layout: themed dark glowing card on a backdrop, buddy avatar (now passed via `buildProps`), white Nunito H1, the "Word X / Y" pixel-font pill, and Memory-Spell success/wrong panels.
> - **End screen** now uses the shared **RES-01 Variant A** `GameResults` (star · X of X words · Correct words · Words to practise · Continue) — identical to Memory Spell, replacing the old bespoke summary list.
> - Background currently reuses `memory-spell-background.png`; a bespoke Word Forge backdrop is a one-line swap when art is ready.

Word Forge is a **prefix/suffix** game. If the words in a list don't contain prefixes/suffixes, the game has nothing to work with — so it **shouldn't show** for that list.

- **Gating:** don't offer Word Forge when the word set has no (or too few) prefix/suffix words. Same pattern as the Round 1 Syllable Tap gating (**SYL-01**) — worth building both gates on a shared "is this game viable for this word set?" check rather than two bespoke ones.
- **UI update:** style the front end to **match Memory Spell** — adapt Word Forge into the same look/layout. `[Memory Spell style]`
- **End screen:** uses the **RES-01 Variant A** results (star · X of X words · "Correct words" · got-right box · to-practise box · Continue) — same as Memory Spell.

> **Cross-ref:** mirrors **SYL-01** (R1). Both are "hide the game when the word set makes it pointless." Flag to Claude Code that a single reusable game-availability predicate would serve Syllable Tap, Word Forge, and likely future games.

> **Open question:** what's the threshold — hide only if **zero** prefix/suffix words, or below some percentage (as Syllable Tap uses ≥50%)? Awaiting your steer with the UI detail.

### R2-02 — Weak Spot: new background + front-end UI refresh
**Type:** UI · **Priority:** Med · **Status:** Open

Weak Spot: plays the word, then plays it back with **some letters/parts missing** for the child to complete (audio-led gap-fill).

- The current UI is **old** — refresh it to **match Memory Spell's style** (adapt Weak Spot into the same look/layout), including a fitting **background image**.
- **End screen:** uses the **RES-01 Variant A** results (star · X of X words · "Correct words" · got-right box · to-practise box · Continue) — same as Memory Spell.

> **Cross-ref:** the audio here (playing the word) should use the **same warmer, human voice** being standardised in **SDR-01** (R1, Crossword clue audio). Worth confirming Weak Spot pulls from the same voice/TTS path so the whole app sounds consistent.

> **Note:** when the UI detail comes, the refresh should align with the **card design** direction (DESIGN-01, R1) since classic is being retired.

### R2-03 — Word Mastery hover text describes mastery incorrectly
**Type:** Bug · **Priority:** High · **Status:** ✅ Done — removed (31 May)

> **Resolved (31 May):** the misleading hover ("play X more games to reach Word Mastery") has been **removed entirely** rather than rewritten. The investigation into the true mastery rule is no longer needed for this item. If a mastery-progress message is wanted later, it can be re-specced then against the confirmed rule.

Hovering over Word Mastery shows **"play 14 more games to reach Word Mastery."** That contradicts how mastery is actually meant to work.

**What's wrong with the copy:**
- Mastery is **not** a count of games played. Per the design, a word is mastered when answered correctly across **two or more *different* game types** (the rule that stops a child gaming it by replaying one activity).
- "**14**" is almost certainly the **number of words in the list** (sessions are 14 words) being mislabelled as a "games to play" figure — a wrong variable feeding the string.

**What needs verifying in code before fixing the copy** (don't assume — confirm against the actual mastery logic):
1. The real unlock rule. Design notes say **≥2 different game types**. Martin recalls it as **3 specific games, correct without hints**. These don't match — the code is the source of truth. Confirm: how many, which games count, and does "without hints" / "correct first attempt" factor in?
2. What the hover string is currently computing (where "14" comes from).

**Then:** rewrite the hover copy to describe the *actual* rule in child-friendly terms (e.g. "Spell this word correctly in 2 different games to master it!" — exact wording once the rule is confirmed).

> **Cross-ref:** related to R1 **MAS-01** (mastery progress display) — both are about surfacing the true mastery model honestly. If MAS-01's progress bar and this hover are driven by the same logic, fix them from one verified source.

> **Open question (for Claude Code to answer from code, then Martin to confirm):** what is the *actual* coded mastery rule? Martin's recollection (3 games, no hints) vs design notes (2+ game types) need reconciling against the implementation.

### R2-04 — Persistent word-list panel in all games (collapsible)
**Type:** Feature · **Priority:** High · **Status:** Open

Bring the **word list** (the one from the word-list hub) **into every game**, pinned in the **same fixed position on the far right-hand side** across all games. The child can **open and close it** to refresh their memory of the words at any point during play.

**Why (the guiding principle):** Spellify is a **spelling** app, not a test of how good a child is at crosswords / word searches / etc. The words they're learning should always be **available to look at** — the game is the vehicle for practising spelling, not a memory test of the word set. Hiding the words once a game starts works against the core purpose.

**Requirements:**
- **Desktop:** fixed panel on the far right, consistent position and behaviour across all games.
- **Mobile:** the critical part — it **must not obstruct or interfere** with any components the game needs (grid, keyboard, tiles, input). Likely a collapsed-by-default drawer/tab that slides in over empty space, not a permanent column. It must never cover interactive game elements.
- **Collapsible** everywhere — open to study the words, close to play.
- **Consistent** component reused across every game (don't reimplement per game).

**Reuse:** this is the **same word-list component already on the hub** — port it into a shared in-game panel rather than building new.

> **Cross-refs:**
> - Pairs naturally with the word **detail modal** (tap a word → meaning/audio/syllables) if that's wanted in-game too — confirm whether tapping a word in the panel should open the full modal or just show the spelling.
> - Audio tie-in: if words are tappable-to-hear here, use the same human voice being standardised (SDR-01, R1).

> **Open questions:**
> 1. **Mobile pattern** — collapsed drawer with a pull-tab on the right edge? Confirm the interaction (tap tab to slide open, tap away/close to dismiss).
> 2. **Default state** — open or closed when a game first loads? (Closed on mobile to protect game space; possibly open on desktop where there's room.)
> 3. **Tappable words** — does tapping a word in the panel do nothing, speak it, or open the full word detail modal?
> 4. **Spelling visible during play** — is there any game where showing the exact spelling defeats the point (e.g. a "spell from memory" mode), or is the word always fair to show? (Per the principle above, leaning: always show — it's a spelling aid, not a cheat.)

### R2-05 — Avatar packs (pick a character; unlock/buy themed packs with lumens)
**Type:** Feature · **Priority:** Med · **Status:** → Moved to R3 (R3-02) — paused 31 May

> **Moved to Round 3 (31 May):** paused for now; the full spec below lives on as **R3-02**. Kept here for history.

**Evolved from an interim picker into a progression system.** Instead of just "choose from 80," characters are grouped into **themed packs** that children **unlock with lumens** (or are awarded through progress). This plugs the existing avatar art straight into the **lumens economy** and the **mastery-unlock** idea already in the gamification design.

**Background prep (decided):** **remove all backgrounds** — characters go on transparent so they sit cleanly on any picker card / in-game surface. (One-time batch job over the full set — see asset offer below.)

**The system:**
- **Choose your avatar** from whatever you currently have access to.
- **Themed packs** unlocked or bought with **lumens** (e.g. progress → afford a new pack → new set of characters). Packs can also be milestone rewards.
- **A "my packs" view** — see unlocked packs, browse characters within each, switch between them.
- Packs get **names/themes** (TBD) — see theming question below.

**Theming the packs (open thinking):** the 80 variants differ in character — examples spotted: an **adventurer**, a **king**, a **"normal" everyday kid**, ones with **dinosaur jumpers**, etc. Possible grouping axes to consider:
- **By costume/role theme** — Explorers, Royalty, Everyday, Dino Squad, etc. (most child-legible; "I want the dinosaur pack").
- **By visual rarity tier** — common → rare → legendary (drives the lumens economy, but less meaningful to a young child than a theme).
- **By colour/world** — tie packs to the adventure-map worlds.
- Likely **theme-based naming with a rarity/price layered underneath** is the sweet spot: kids pick by theme, the economy works on price.

**Decisions to make:**
1. **Pack size** — how many characters per pack? (e.g. 6–10.)
2. ~~Free starter pack~~ **DECIDED:** a **free starter pack of 10–15 characters** available day one, so a new child has real choice before earning anything.
3. **Placeholder packs (DECIDED):** Claude Code should **stub out the other packs as locked placeholders** from the start — visible but not yet filled — so the progression/shelf is shown immediately. A locked "Dino Squad" a child can't afford yet is what makes earning lumens feel worthwhile. Use working titles based on the themes below (e.g. Explorers, Royals, Dino Squad, Everyday). Art for these gets dropped in later.
4. **Unlock model** — lumens-purchase only, milestone-award only, or both? (Both is richest: some packs buyable, some earned.)
5. **Lumens pricing** — needs the lumens economy understood first (how fast a child earns them). Cross-ref the points/lumens logic.
6. **Pack themes + names** — pending a look at the sample set (Martin sending 10–15).

**Cross-refs:**
- **PROF-02 (R1)** — avatar was hidden "until it needs work"; this system is what un-hides it. Confirm R2-05 supersedes PROF-02.
- **PROF-01 (R1)** — avatar already renders on map badge / footer / Explore card; packs just change which image is active.
- **Lumens / gamification** — this is a major sink for lumens. Ties into the "no pay-to-win, rewards reinforce learning" principle: packs are cosmetic, never affect learning or difficulty.
- **Business model** — note the "buy a pack" wording. Keep cosmetic-only purchases clearly separate from the **no-paywall-on-learning** principle. If real-money pack purchases are ever considered (vs lumens-only), that's a business-model decision, not just a feature — flag before building any real-money path.

> **Asset / batch-processing offer:** once you confirm, I can produce a **script** to: strip backgrounds → standardise size → generate picker thumbnails → optionally auto-group by dominant colour or output a manifest for you to tag themes. Concrete deliverable whenever you're ready.

> **Sample set:** Martin sending **10–15 characters** to form the free starter pack + inform pack theming. Placeholder locked packs stubbed alongside (decision 3).

### R2-06 — Force parent PIN setup at profile creation
**Type:** Bug / Security · **Priority:** High · **Status:** Open

The parent PIN is currently set **only when the parent later taps into the parent profile** — which means a parent might **never set it**, leaving the parent area (and whatever it gates) **open to the child**.

**Fix:** prompt for the PIN **at the point of parent-profile creation**, as a required step in that flow — so a parent profile can't exist without a PIN.

Requirements:
- PIN setup is a **mandatory step** in parent-profile creation, before the flow completes.
- Existing parent profiles created **without** a PIN need handling too — prompt them to set one on next entry (don't leave a back-door open for accounts made before this fix).
- Standard PIN hygiene: confirm-entry (enter twice), and a recovery/reset path (tied to the parent's authenticated account, since parent profiles sit behind sign-in).

**Why High:** this is the gate that keeps children out of parent-only areas (settings, account, any future purchase/spend controls — note the lumens pack purchases in R2-05 may want to sit behind this). A gate that's optional after the fact isn't a gate.

> **Cross-ref:** sits in the Supabase auth flow (R1 work). The parent profile is the authenticated layer above the child's localStorage profile.

> **Open questions:**
> 1. **PIN length / format** — 4 digits is the familiar standard for this; confirm.
> 2. **What exactly the PIN gates** — just the parent profile/settings, or also spend actions (lumens packs, any future purchases) and account changes? Worth listing the protected surfaces.
> 3. **Reset flow** — confirm it goes via the parent's signed-in account (email), not something a child could trigger.

### R2-07 — Confetti slow/janky returning home after mastering a list
**Type:** Bug · **Priority:** High · **Status:** ✅ Done (31 May)

> **Resolved (31 May):** root cause was the milestone confetti burst firing over the heavy home/map background as that screen mounted. **R2-08** (world backgrounds → WebP) removed the main culprit — the large PNG decode that starved the main thread. Two defensive tweaks added on top so the burst stays smooth regardless: particle count trimmed from 160 → 110 (every other confetti call in the app already uses ≤ 90), and the burst now fires on the next `requestAnimationFrame` so the home screen has painted before the animation loop starts (no longer competing with the mount render). `src/App.jsx` milestone listener.

On mastering a word list and returning to the home screen, the **confetti explosion runs really slowly** (low frame rate / stutter).

**Likely cause:** `canvas-confetti` animates frame-by-frame on the main thread, so slow confetti is a **symptom of the page being starved** — usually large images still decoding/holding memory, too much happening on the main thread at that moment, or many particles over a heavy background. It's rarely the confetti itself.

Areas for Claude Code to check:
- What's loading/decoding at the moment confetti fires — is a large world background or other heavy asset mounting at the same time?
- Particle count / duration of the confetti call — can be tuned down if needed, but treat the root cause (assets/memory) first.
- Any layout thrash or heavy re-render on the home screen mount that competes for the main thread.

> **Cross-ref:** almost certainly the same root cause as **R2-08** (oversized assets). Fix the asset sizes first, then re-test confetti — it may resolve without touching the confetti code. Also related to R1 **MAP-01** (map image black-flash on load) — both point at heavy/unoptimised images on the home/map screen.

### R2-08 — Audit asset sizes site-wide; convert world backgrounds to WebP
**Type:** Enhancement · **Priority:** High · **Status:** ✅ Done (31 May — WebP backgrounds sorted)

Suspected performance drag from **oversized assets**, especially **world background images**. Plan: provide **WebP versions of all world backgrounds** (much smaller than PNG/JPG at equivalent quality) and audit file sizes across the app.

**Two parts:**
1. **Audit** — measure the heavy elements: every background image, avatar art, any bundled media, and the JS bundle. Produce a list of the biggest offenders by file size + dimensions, and flag anything being served far larger than its display size.
2. **Convert** — Martin providing **WebP** world backgrounds. Also worth: serving images at display resolution (not full-res scaled down), lazy-loading offscreen images, and confirming backgrounds aren't all loaded up front.

**Why High:** likely the root cause behind **R2-07** (slow confetti) and **MAP-01** (map black-flash, R1). One asset-optimisation pass could fix multiple visible symptoms.

> **Concrete offer:** I can run an **asset audit script** over the repo (or a folder of assets you give me) that reports every image's file size + pixel dimensions + format, flags oversized ones, and can **batch-convert to WebP** at a sensible quality. Same toolchain as the avatar background-stripping (R2-05) — worth doing in one go. Tell me where the assets live or upload a sample.

> **Open question:** do you want a hard budget per asset (e.g. "no background over 200KB")? Useful as a standard to hold the line on going forward.

### R2-09 — Align Quiz Quest & Memory Spell in-game header UI
**Type:** UI · **Priority:** Med · **Status:** ✅ Done (31 May)

> **Resolved (31 May):** both games now share one header style. Memory Spell's H1 (`.ms-phase .ms-h1`) and Quiz Quest's H1 (`.qq-h1`) are identical — Nunito, weight 800, white (`#ffffff`) with a soft drop-shadow (no more pixel font / yellow). The pixel-font amber pill is kept only on the small counter above each H1: Memory Spell's "Word 1 / 14" (`.ms-word-counter`) and Quiz Quest's "10 questions" (`.qq-question-pill`) share the same styling.

Make the two games' in-game headers consistent.

**Memory Spell changes:**
- H1 → **normal font** (not pixel) and **white** (not yellow).
- Keep the pill treatment as-is.

**Quiz Quest changes (match Memory Spell):**
- H1 in the **same normal/white** style.
- Replace the "10 questions" text with the **same pill** Memory Spell uses (the "Word 1 of 14" pill), reading **"10 questions"** instead.

> Net: both games share one header style — normal white H1 + the same pill, label varying per game.

---

## Open questions / decisions parked

_None yet._

---

## Notes

- This is **Round 2**. Round 1 (`SPELLIFY_QA_TRACKER.md`) is the one Claude Code is actively working through — don't hand this one over until Round 1 is far enough along that it's worth batching.
- If a new item turns out to be the **same root cause** as a Round 1 item, it gets cross-referenced to it rather than duplicated.
- Same working rule as Round 1: authoring/structuring happens in chat; once handed over, Claude Code updates only the status column.
