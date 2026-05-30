# Spellify — Rhythm & Mastery Engine Spec (v1)

**Purpose:** A complete state model and behaviour spec for Spellify's redesigned engagement system, ready to hand to Claude Code for implementation. This replaces the current daily-streak approach (`streakEngine.js` + `gamificationEngine.rollStreak()`) with a gentler, child-appropriate **weekly rhythm** layer and a permanent **mastery** layer.

**Read this first, Claude Code:** Memories from a previous session may describe a *daily streak with Spell Shields, earn-back, and ramp-down*. That direction has been superseded. Build the weekly-rhythm / never-zero spine described here. The STRIKE/KEEP list in §2 says exactly what carries over and what does not.

---

## 1. The spine (the frame, so nothing drifts)

Spellify rewards **accumulation, never penalises absence**. A child does not control their own access (parent-gated devices, school nights, activities), so a daily consecutive streak that resets to zero punishes the child for an adult's decision. Instead:

- **Rhythm layer (the habit vehicle):** turn up a chosen number of days *per week* — like a gym membership. Hitting the weekly target keeps the rhythm alive. Missing a week makes the world *rest*, never wither. Nothing ever snaps to zero in front of a child.
- **Mastery layer (the hero):** the thing that genuinely accumulates and can never be lost is *words and lists mastered*, rendered as a permanently lighting-up map. This is the headline number for both child and parent.

Two governing rules, applied to every decision:
1. **Every number a child sees about themselves only ever goes up.**
2. **Escalation runs gentler and quieter, never louder.** (Applies to re-engagement messaging especially.)

The test for any copy string, animation, or state: *would this make a 7-year-old feel welcomed back, or judged?*

---

## 2. STRIKE / KEEP (relative to the prior session's plan)

**KEEP — carries over cleanly:**
- **Move the celebration into the loop.** The rhythm/mastery acknowledgement becomes a short in-loop post-game moment where `recordPlayToday()` currently fires silently — not an app-open afterthought. This is the highest-leverage build.
- **Consolidate to one engine.** Delete `gamificationEngine.rollStreak()`; route everything through the single rhythm/mastery engine so the points bonus and the rhythm counter cannot diverge.
- **Wire milestones to the Avatar Builder** as the reward layer (see §10).
- **Flip all copy from fear to warmth.** No warning triangles, no "at risk", no "save your streak".

**STRIKE — do NOT build:**
- ❌ Daily consecutive streak / reset-to-1 on a missed day.
- ❌ Spell Shields / freeze inventory. *(A freeze only exists to soften a punishment; weekly rhythm + never-zero removes the punishment, so the shield solves a problem we've designed out. The ownership instinct behind shields is redirected to lumens / avatar / the lit-up map — all can't-be-lost ownership.)*
- ❌ Earn-back mini-flow and ramp-down cliff. *(No daily reset means nothing to earn back or ramp down from.)*
- ❌ Any loss-framed notification to a child, ever.

---

## 3. Core definitions

| Term | Definition |
|---|---|
| **Qualifying day** | A local calendar day on which the child completes **≥1 activity** (one game). App-open alone does **not** count — we reward doing a little work, not logging in. |
| **Week** | Monday 00:00 → Sunday 23:59, **local time** (UK convention). Use stored/device timezone; the engine is already timezone-aware. |
| **Weekly target** | Parent/child-set: **2, 3, or 4** qualifying days per week. **Default 3.** Do **not** offer 5+ — that recreates near-daily pressure. |
| **Week met** | `qualifyingDaysThisWeek.length >= weeklyTarget`. Fires once per week; extra days do not re-fire it (see §8 guard). |
| **First partial week** | The week containing the child's very first activity auto-counts as **met** (generous onboarding — a guaranteed first win, à la "Day 1 starts now"). Full weeks thereafter require the target. |

---

## 4. The three rhythm numbers (all honest, none ever shown as a loss)

| Field | Behaviour |
|---|---|
| `currentWeeksInARow` | +1 at each week boundary where the week was met. On a single missed week it **rests** (holds its value, visually dims) — no penalty. It only restarts as a **fresh start** on *return after long absence* (see §7) — and even then it is framed as a new beginning, never as a subtraction. |
| `bestWeeksInARow` | Personal best. **Only ever rises.** The ownership anchor and the re-motivation target after a fresh start ("your best was 12 — let's beat it"). |
| `lifetimeWeeksMet` | Total weeks ever met. **Only ever rises.** |

> **Why not pure "never reset"?** A counter reading "12 weeks in a row" after a two-month absence is dishonest, and children notice ("they know it's fake"). The synthesis: the *in-a-row* genuinely restarts after long absence, but (a) it only happens at the welcome-back moment, never via a punishing midnight tick while the child is away, (b) it is framed as a fresh start, and (c) `best` and `lifetimeWeeksMet` never move, so nothing the child is proud of is ever taken away.

**Documented fallback toggle (`RHYTHM_MODE`):**
- `"resting"` *(recommended default)* — the model above; a little forward pull keeps the rhythm feeling alive.
- `"lifetime_only"` — no in-a-row counter at all; only `lifetimeWeeksMet` and the map tell the story. Maximally gentle, minimally engineered. Ship-ready as a config flip if we decide the in-a-row adds nothing.

---

## 5. State model

```js
// Rhythm (new — replaces daily-streak fields)
rhythmState: {
  weeklyTarget: 3,                       // 2 | 3 | 4, parent-set, default 3
  weekStartDate: "2026-05-25",           // Monday of the currently tracked week (local ISO date)
  qualifyingDaysThisWeek: ["2026-05-25","2026-05-27"], // ISO dates with >=1 activity this week
  currentWeeksInARow: 6,
  bestWeeksInARow: 9,
  lifetimeWeeksMet: 31,
  weekState: "active",                   // "active" | "met" | "resting" — drives world visuals
  lastActivityDate: "2026-05-27",        // drives re-engagement ladder + long-absence detection
  hasEverPlayed: true,                   // gates the first-partial-week auto-met rule
  timezone: "Europe/London",
  rhythmMode: "resting"                  // "resting" | "lifetime_only"
}

// Currencies (clarify existing — see §9)
points:  { lifetime, /* per-game accuracy-weighted; the heartbeat */ }
lumens:  { balance, lifetimeEarned }     // spendable on the world/cosmetics only
mastery: // DERIVED from the existing three-tier word/list records — permanent, unspendable
```

Mastery is **not** re-defined here — it reads from the existing learning→practising→mastered model. The map (§9) is a view over those records.

---

## 6. Transitions / functions

Single entry point, called from the post-game sequence (where `recordPlayToday()` lives today):

**`recordActivityCompletion(now)`**
1. `evaluateWeekBoundary(now)` (roll forward any elapsed weeks — see below).
2. `evaluateReturn(now)` (detect long absence → fresh-start framing — see §7).
3. If `today` not already in `qualifyingDaysThisWeek`, add it. Set `lastActivityDate = today`.
4. If `!hasEverPlayed`: set `hasEverPlayed = true`, treat current partial week as **met**, fire the "rhythm begins" moment.
5. If this addition crosses the target (`length === weeklyTarget`) and the week was not already met: set `weekState = "met"`, fire the **weekly bloom** (§8) once.
6. Return a payload describing what to celebrate in-loop (day added / week met / fresh start / nothing new) so the post-game UI shows the right short moment.

**`evaluateWeekBoundary(now)`** — handles the app being closed across one or many weeks:
- While `now` is in a later week than `weekStartDate`:
  - **Finalise the tracked week** using `qualifyingDaysThisWeek` we already hold: if met → `currentWeeksInARow += 1` (in `"resting"` mode), `lifetimeWeeksMet += 1`, update `bestWeeksInARow`; if not met → `weekState = "resting"`, leave `currentWeeksInARow` held.
  - Advance `weekStartDate` by one week, clear `qualifyingDaysThisWeek`.
  - Any fully-skipped intermediate week (app never opened) is trivially not-met → resting; no stored data needed.
- This must run on **app open** as well as post-game, so the world shows the correct rested/active state even before the child plays.

**`evaluateReturn(now)`** — long-absence handling:
- `daysSinceLastActivity = now - lastActivityDate`.
- If `>= LONG_ABSENCE_DAYS` (default **21**, tunable): on this return, convert `currentWeeksInARow` to a **fresh start** (set to 0, then it begins counting again) and surface the warm welcome-back + "best was N" message. `best` and `lifetimeWeeksMet` untouched. **Never** runs while the child is away — only at the return event.

**Edge cases to honour:**
- Mid-week first activity → first partial week auto-met (§3), so a child starting on a Saturday isn't penalised for a short week.
- Met-then-absent (e.g. met a week, gone 3 weeks, returns): the met week already earned its +1 (honoured in best/lifetime); intervening weeks rested; return after 21 days → fresh start. All consistent, no loss language anywhere.
- Timezone change (travel): use the stored timezone for boundary maths to avoid a day flicker; rare for the target user, low priority.

---

## 7. (folded into §6 — `evaluateReturn`)

---

## 8. How rhythm feeds the world

The **world** (Word Keeper's world/garden) responds to *rhythm*. The **map** (§9) responds to *mastery*. They are separate systems.

| Event | World reaction | Reward |
|---|---|---|
| Qualifying day (each) | Small ambient life — a flicker/sparkle. The world is "awake" today. | Normal per-game **points** (accuracy-weighted) + small per-game **lumens**. |
| **Week met** (fires once) | A "bloom" moment — the world visibly grows a step. | **Weekly lumen payout** (see ramp) + `currentWeeksInARow` ticks + possible minor cosmetic drop. This is the weekly celebration. |
| Missed week | World **rests** — gently dims, waits. **Never withers or dies.** No outbound message at this stage. | None. Nothing lost. |
| Return after rest | World springs back to life on first qualifying day. | Welcome-back moment (warm, see §11 copy). |

**Weekly lumen ramp (gentle ramp-up, tunable):** base **50** lumens for hitting target, **+10** per consecutive met week, **capped at +50** (so weeks 1..5+ pay 50/60/70/80/90/100, then flat 100). Because the in-a-row *rests* rather than resets, a missed week means you resume at the same tier — no loss.

> **Design guard — do not reward over-target.** Days beyond the weekly target earn only the normal per-game points/lumens (they're playing games, they get game rewards). The **weekly bloom does not multiply** for extra days. Rewarding "more days" would quietly drag the system back toward daily grind, which is the exact pressure we removed.

---

## 9. How mastery feeds the map — and the currency hierarchy

The **mastery line is the hero**: make it literal — the spine of the adventure map. Each mastered list permanently lights up a stop/region, the Word Keeper guarding the record. The child's map becomes a growing, can't-be-lost picture of everything they've learned. Points and lumens are texture; **the lit-up map is the story**, and it is the headline figure on the parent dashboard.

Map lighting reads directly from the existing three-tier mastery records and is **fully independent of rhythm** — you light up a stop by mastering, full stop, regardless of which days you played.

**Three currencies, distinct non-overlapping jobs:**

| Currency | Earned by | Spent on | Nature |
|---|---|---|---|
| **Points** | Per answer, accuracy-weighted | Nothing — pure feedback | The heartbeat: cheap, fast, motivating |
| **Lumens** | Slowly, via play + weekly blooms | The **world**: companions, decoration, cosmetics | Ownership & self-expression. **Never** learning advantage, never pay-to-win |
| **Mastery** | Genuinely mastering words/lists | Unspendable | Permanent prestige; what milestones celebrate and what content unlocks gate on |

**Hard rule:** anything learning-relevant (new islands, new word content) is gated on **mastery** and is **free**. Currency must never sit between a child and learning.

---

## 10. Milestone → reward tables (starting points — map to your real avatar inventory)

Two tracks. **Mastery = hero** (big reserved celebrations + meaningful unlocks). **Rhythm = supportive** (lumens + minor cosmetics, smaller moments, never the headline). Reserve the *big* custom animation for **mastery** landmarks so it never becomes wallpaper.

**Mastery track (hero):**

| Landmark | Celebration | Unlock (example — populate from Avatar Builder assets) |
|---|---|---|
| First word mastered | Word Keeper greets the child | Starter avatar item |
| **Every list mastered** | Map stop lights up permanently | Lumens; occasional avatar piece on notable lists |
| 10 words mastered | Standard mastery celebration | Avatar item (e.g. hat) |
| 25 words mastered | Standard | Avatar item + companion |
| 50 words mastered | Larger | Avatar item (e.g. cape) + new region teased |
| 100 words mastered | **Big reserved animation** | Avatar item (e.g. crown) + island unlock |
| Region / island fully mastered | Island-complete celebration | Signature unlock (companion / world flourish) |

**Rhythm track (supportive):**

| Landmark | Celebration | Reward |
|---|---|---|
| First week met | "Your rhythm begins" 🌱 | Lumens |
| 4 weeks in a row | Small | Lumens + minor cosmetic |
| 10 weeks in a row | Small | Lumens + cosmetic |
| 25 weeks in a row | Notable (still below mastery prestige) | Lumens + notable cosmetic |
| New `bestWeeksInARow` record | Brief "new best!" acknowledgement | (recognition only) |

---

## 11. Copy table (warm, child-facing — replace all fear copy)

| State | Old (strike) | New |
|---|---|---|
| Day added | — | "🔥 Nice one! That's [N] days this week." |
| Week met | — | "🌟 You hit your rhythm this week! The world is blooming." |
| Resting (in-app) | "⚠️ Your streak is at risk!" | (no warning) World quietly dims; "Your world's having a little rest — come play when you're ready." |
| Return after rest | "Play today to save your X-day streak" | "Welcome back! Let's wake the world up. 🌱" |
| Fresh start (long absence) | hard reset to 1 | "Welcome back! Fresh rhythm starting — your best ever was [best] weeks. Beat it? 💪" |
| First ever activity | — | "Your spelling rhythm begins! 🌱" |

No warning triangles anywhere in the child experience. The reminder channel is the **parent**, not guilt (§12).

---

## 12. Re-engagement ladder (parent-directed, launch-ready, escalates *gentler*)

All opt-in, configured in the parent dashboard, measured against the **weekly rhythm** (never a single missed day, never on a school night). Each tier is quieter and more useful than the last; then we go silent.

| Tier | Trigger (approx) | Action |
|---|---|---|
| **0 — Rest** | 1 missed day/two | Nothing outbound. World rests in-app. |
| **1 — Value-first** | ~1 missed week | One warm, *useful* note to the **parent**: "Maya was three words from finishing her Year 3 magic-e list — here's a five-minute game to finish together." Frames an easy good-parenting win **and primes the parent to say yes when the child asks** (the child-pull rally). |
| **2 — Curiosity hook** | ~2 weeks | Lower frequency. Surface something the *child* has waiting: "A new island is ready for Maya to discover." Pull = child's ownership/curiosity. |
| **3 — Graceful goodbye** | ~1 month | Go quiet, one final no-pressure note: "Everything Maya's mastered is saved exactly where she left it. No rush." Reaffirms the no-loss promise; then stop drip-messaging and only re-surface on genuinely new value (new term's words, new content). |

**Child-pull mechanics (the rally) to support this:**
- **Open loops the child cares about** ("three words from finishing", "a companion waiting") — Zeigarnik used ethically; if unresolved they wait calmly, never curdle into anxiety.
- **Co-play moments** — a few activities/rewards explicitly framed as "show a grown-up" / "do this together", giving the child a legitimate reason to recruit the parent and converting solo time into shared time (which parents green-light more readily).

**Guardrail metric (build from day one):** track **unsubscribes/uninstalls per re-engagement message** alongside return rate, so messaging that's quietly annoying families gets caught — not just the part that works.

---

## 13. Engine consolidation & persistence

- Single source of truth. Delete `gamificationEngine.rollStreak()`; the points bonus and all rhythm reads route through the consolidated engine.
- **Supabase `children` columns to add/sync:** `weekly_target`, `week_start_date`, `qualifying_days_this_week`, `current_weeks_in_a_row`, `best_weeks_in_a_row`, `lifetime_weeks_met`, `week_state`, `last_activity_date`, `has_ever_played`, `timezone`, `rhythm_mode`, `lumens_balance`, `lifetime_lumens`. (Points + mastery likely already synced — confirm.)
- localStorage-first as today; Supabase as progressive enhancement. Guest → authenticated migration must carry rhythm + lumens (watch for guest-bleed, per prior auth work).
- Remember the syllable-separator / migration discipline: audit before any field rename.

---

## 14. Open decisions for Martin (small)

1. **`RHYTHM_MODE` default** — `"resting"` (gentle in-a-row counter, recommended) vs `"lifetime_only"` (no in-a-row at all). Spec defaults to `"resting"`; flip is one config line once you've seen it.
2. **`LONG_ABSENCE_DAYS`** — fresh-start threshold. Default 21; 28 is also reasonable.
3. **Lumen ramp numbers** (§8) and **milestone thresholds/rewards** (§10) — illustrative; tune against your real avatar inventory and economy.

---

## 15. The honest trade (named, not hidden)

This model deliberately trades some raw retention *potency* for ethical fit. Duolingo's headline numbers come substantially from loss-aversion dread we are refusing to use on children. We lean instead on accumulation, curiosity hooks, weekly fresh starts, and the visible growing map — real drivers, but quieter ones. This is the trade already chosen in Spellify's own principles ("kids' wellbeing > engagement metrics"). It is the right call for this product; it should be a decision on the record, not an accident.
