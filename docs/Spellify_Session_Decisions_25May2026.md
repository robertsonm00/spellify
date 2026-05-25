# Spellify — Session Decisions & Implementation Prompts
**Date:** 25 May 2026  
**Status:** Ready to implement

---

## Decisions captured this session

### 1. Profile architecture — Netflix model

The app adopts a Netflix-style profile system. The **profile selector is the primary landing screen** for all signed-in users — not a "home screen", not an account page.

**Structure:**
```
Parent account (email + password)
    ├── 🔒 Parent profile  ← PIN-protected (4-digit PIN)
    └── 🎮 Child profile(s) ← drops straight into game
```

**Behaviour:**
- App opens → profile selector screen
- Tap child profile → straight into game, zero friction, no auth awareness
- Tap parent profile → 4-digit PIN prompt → parent dashboard
- Within game: small **Exit** button (padlock icon or similar) → returns to profile selector
- **Sign out** is a nuclear option only — buried in parent dashboard, not surfaced to children
- Children never see email addresses, account settings, or sign-out controls

**PIN storage:** Hashed 4-digit PIN stored against parent profile record in Supabase. Separate from account password.

---

### 2. Three-tier model — finalised

#### Guest (Quick Start)
- No profile, no persistence
- Enter name + year group → play immediately
- Nothing saved after session ends
- 1 custom word list maximum per session
- If they try to add a second list → prompt to delete current list or create free account

#### Free account (one child profile)
- Progress, points, streaks all save
- 1 child profile
- 5 custom word lists maximum
- Access to custom/personal word lists forever — this is the core utility, never restricted
- High-frequency word lists always accessible, never paywalled
- First world (Ember Isle / Y1) fully accessible
- Limited game modes or curriculum depth beyond Y1/Y2 (TBD)
- If they try to add a 6th list → prompt to delete a list or unlock premium

#### Premium (paid — monthly or annual subscription)
- Multiple child profiles
- All worlds and curriculum (Y1–Y6)
- All game modes
- Full buddy and customisation catalogue
- Parent dashboard with progress reporting
- Unlimited custom word lists
- Advanced list features (test date reminders, word set sharing with teacher)
- Printable word mats and activity sheets

---

### 3. Freemium / progression model — not a hard paywall

The free tier is **progression-gated freemium**, not a crippled product. The free experience is genuinely useful and hooks the child before the ceiling is reached.

**Free tier feels generous:**
- Ember Isle (Y1) fully accessible
- Word batches unlock in sets of 10 within each world — free users experience the unlock dopamine within their accessible range
- Buddy customisation limited to base options on free; full catalogue on premium
- First world completion → natural upgrade moment: *"Unlock Flare Isle to continue your adventure"*

**Upsell framing is always positive:**
- "Unlock the next world" — never "pay to remove restrictions"
- The free tier does the selling: child engages, hits ceiling at moment of maximum motivation, parent sees genuine usage, upgrade is the obvious next step

---

### 4. Core utility — always free, no exceptions

The original use case (weekly school spellings practice) must always be free. A family should be able to use Spellify for years without ever paying.

**Always free, no time limit:**
- Custom word list creation, deletion, and replacement
- High-frequency word lists (HFW, KS1, KS2 core)
- All games playable against any free-tier list
- Progress and points save for active lists
- One child profile

**Rationale:** This solves the immediate real-world problem parents have every week. Restricting it would undermine trust and remove the primary acquisition engine.

---

### 5. List management UX — inline, not in parent dashboard

List management lives **in the game experience**, not behind a parent login. The parent looks over the child's shoulder — the flow must be seamless without requiring profile switching.

**List management surface:** Word List Hub (existing component)
- Each word list card has a **three-dot menu or trash icon**
- Tap trash / delete option → confirmation prompt → list removed
- Confirmation is required to prevent accidental deletion

**Ceiling prompt — Guest (1 list max):**
> "Want to add another word list? You can delete your current list to start fresh, or create a free account to save up to 5 lists."
> 
> [Delete current list] [Create free account]

Choosing "Delete current list" → confirms deletion → moves straight into new list upload flow  
Choosing "Create free account" → sign-up flow → lands back at list management with current list migrated

**Ceiling prompt — Free account (5 list max):**
> "You've got 5 word lists saved. To add another, you can delete one of your existing lists or unlock Premium for unlimited lists."
>
> [Manage my lists] [Unlock Premium]

"Manage my lists" → surfaces existing list cards with trash icons inline so they can choose which to remove → slot freed → new list upload flow

---

### 6. Migration — non-negotiable contract

Everything from a guest session **must port over** on account creation. No exceptions, no starting again. Losing progress at the sign-up moment is a trust-killer.

**What migrates:**
- Current word list(s)
- Progress on those lists (words mastered, words in progress)
- Spell Points earned
- Streak (if applicable)
- Name and year group entered at Quick Start

**How it should feel:** Account creation is framed as *saving progress*, not *creating an account*. The existing `MigratePrompt` component handles the localStorage → Supabase sync — ensure it covers all of the above data points.

---

### 7. Sign-up nudge strategy — confirmed

**Principle:** Never block, always pull. Nudges appear at natural high-motivation moments.

**Primary trigger:** After enjoying the app and completing something — after a win, never mid-game, never as a wall.

**Hero copy (from roadmap):**
> *"You repaired the first part of Spellify World!"*  
> *Save your progress and unlock 3 more adventures.*  
> *Parent email required.*

**Framing rule:** Never say "Create an account" or "Sign up". Always frame as saving progress and unlocking more. The child has earned something — the ask is to protect what they earned.

**If parent isn't present:** Show "Save later — remind me" option. Sets a flag in localStorage. Prompt reappears next session. Progress is safe in localStorage in the meantime.

---

## Claude Code implementation prompts

### Prompt 1 — Profile selector screen

```
Build the Profile Selector screen for Spellify. This replaces the current auth-aware landing screen and becomes the primary entry point for all signed-in users.

Requirements:

LAYOUT
- Full screen, centred, arcade aesthetic consistent with existing Spellify design
- Title: "Who's playing?" (or similar child-friendly prompt)
- Display all profiles as circular avatar cards in a row (max ~4 before wrapping)
- Each card: avatar image/emoji, profile name below, year group sub-label
- One card is always the Parent profile — visually distinct (padlock icon overlay or different border)
- "Add profile" card at the end of the row — shows a + icon, greyed out with tooltip if free tier limit reached

CHILD PROFILE behaviour
- Tap child profile card → immediately enter game experience as that child
- No PIN, no friction
- Set active child profile in app state

PARENT PROFILE behaviour  
- Tap parent profile card → show a 4-digit PIN entry overlay/modal
- PIN is stored as a hashed value — retrieve from Supabase parent profile record
- Correct PIN → enter parent dashboard
- Wrong PIN → shake animation, "Try again"
- "Forgot PIN?" link → sends reset email via Supabase

GUEST state (no account)
- Show a single "Quick Start" card instead of profiles
- Plus a "Sign in" option in the corner

ADD PROFILE
- Free tier: max 1 child profile — tapping Add Profile triggers premium upsell modal
- Premium: add up to [N] child profiles

TECHNICAL
- Component: src/components/ProfileSelector/ProfileSelector.jsx + .css
- Read profiles from Supabase children table filtered by parent auth user
- Parent profile uses auth.user metadata
- On successful child selection: set selectedProfile in app context, navigate to game home
- On successful parent PIN: navigate to ParentDashboard
```

---

### Prompt 2 — Parent PIN setup and storage

```
Add parent PIN functionality to Spellify.

Requirements:

DATABASE
- Add column parent_pin_hash (text, nullable) to the profiles or auth user metadata in Supabase
- Use bcrypt or Supabase's built-in hashing — do not store PIN in plain text

FIRST-TIME PIN SETUP
- On first visit to parent dashboard (after account creation), prompt parent to set a 4-digit PIN
- Show: "Set a PIN to protect your parent profile"
- Input: 4-digit PIN entry → confirm PIN entry → save hashed value to Supabase
- Can be skipped (PIN remains null) — parent profile is accessible without PIN if none set
- PIN can be changed or removed from parent dashboard settings

PIN ENTRY COMPONENT
- Reusable PINEntry component: 4 large circular digit inputs, arcade-style
- Auto-advances between digits
- Backspace support
- Submit on 4th digit entry
- Shake + error state on wrong PIN
- "Forgot PIN?" link triggers password reset email

COMPONENT LOCATIONS
- src/components/auth/PINEntry.jsx + .css
- src/components/auth/PINSetup.jsx + .css
- Update ParentDashboard to include PIN management in settings section
```

---

### Prompt 3 — Exit button and navigation flow

```
Add an Exit control to the in-game experience that returns the user to the Profile Selector screen.

Requirements:

EXIT BUTTON
- Small, unobtrusive — padlock icon or home/exit icon
- Position: top-left or top-right corner of the main game nav/header
- Should not distract from gameplay but always accessible
- Tapping Exit → returns to ProfileSelector screen
- Does NOT sign out — session remains active, parent account stays authenticated
- Child profile selection is cleared from app state

SIGN OUT
- Remove any sign-out button from child-facing screens entirely
- Sign out lives only in the Parent Dashboard → Settings section
- Sign out clears full session, returns to initial landing/auth screen

NAVIGATION FLOW (update App.jsx routing):
Guest → ProfileSelector (Quick Start card) → Game
Signed in → ProfileSelector → [child card] → Game → [Exit] → ProfileSelector
Signed in → ProfileSelector → [parent card] → PIN entry → ParentDashboard → [Sign out] → Auth screen
```

---

### Prompt 4 — List management UX and tier ceiling prompts

```
Update the Word List Hub to support tier-based list limits with inline management and contextual ceiling prompts.

Requirements:

TIER LIMITS
- Guest: 1 custom word list
- Free account: 5 custom word lists  
- Premium: unlimited

LIST CARD ACTIONS
- Add a three-dot menu (⋮) or trash icon to each word list card
- Menu options: "Play this list", "Delete list"
- Delete → show confirmation modal: "Delete [List Name]? This can't be undone." → [Cancel] [Delete]
- On confirm: remove list from Supabase (or localStorage for guest), update UI

CEILING PROMPT — Guest
Triggered when guest tries to add a second list.
Show modal:
  Title: "Want to save more lists?"
  Body: "You can delete your current list to start fresh, or create a free account to save up to 5 lists."
  Buttons: [Delete current list] [Create free account]
  
  "Delete current list" flow: confirm deletion → opens new list upload/creation flow
  "Create free account" flow: trigger sign-up modal → on completion migrate existing list → return to Word List Hub

CEILING PROMPT — Free account (5 list limit)
Triggered when free user tries to add a 6th list.
Show modal:
  Title: "You've got 5 lists saved"
  Body: "Delete one of your existing lists to make room, or unlock Premium for unlimited lists."
  Buttons: [Manage my lists] [Unlock Premium]
  
  "Manage my lists": dismiss modal, highlight existing list cards with delete affordance visually active
  "Unlock Premium": trigger premium upsell flow (placeholder for now — just a modal saying "Coming soon")

TECHNICAL
- Tier status comes from auth context (guest / free / premium)
- List count check runs before opening the "Add list" flow, not after
- Components to update: src/components/WordListHub/WordListHub.jsx + .css
- New component: src/components/WordListHub/ListCeilingModal.jsx
```

---

### Prompt 5 — Migration flow audit and completion

```
Audit and complete the localStorage → Supabase migration flow to ensure all guest session data ports over on account creation.

Current state: MigratePrompt component exists and handles basic profile creation. Needs to be extended.

Requirements:

WHAT MUST MIGRATE (check each is handled):
- Custom word list(s) — list name, all words, any metadata
- Word progress per list — mastered words, words in progress, attempt counts
- Spell Points total
- Current streak and streak start date
- Child name and year group entered at Quick Start
- Active buddy selection (if any)

MIGRATION FLOW
1. Account creation completes (email confirmed, signed in)
2. Detect existing localStorage session data
3. Show migration prompt: "We found your progress — save it to your account?"
   - Show summary: X words mastered, X Spell Points, current streak
   - Button: "Save my progress" 
   - Small link: "Start fresh instead"
4. On confirm: write all localStorage data to correct Supabase tables under new user/child profile
5. Verify write success before clearing localStorage
6. Clear localStorage after confirmed sync
7. Navigate to ProfileSelector with child profile pre-selected

FRAMING RULE
- Never use the word "migrate" in user-facing copy
- "Save my progress" / "Keep my progress" / "Save to my account" only
- If migration fails: show friendly error, do NOT clear localStorage, allow retry

TECHNICAL
- Update: src/components/auth/MigratePrompt.jsx
- New utility: src/lib/migrationService.js — handles all data transfer logic, separated from UI
- Add error handling and retry logic
- Log migration events to Supabase events table
```

---

## Summary of files to create / update

| File | Action |
|---|---|
| `src/components/ProfileSelector/ProfileSelector.jsx` | Create |
| `src/components/ProfileSelector/ProfileSelector.css` | Create |
| `src/components/auth/PINEntry.jsx` | Create |
| `src/components/auth/PINEntry.css` | Create |
| `src/components/auth/PINSetup.jsx` | Create |
| `src/components/auth/MigratePrompt.jsx` | Update |
| `src/lib/migrationService.js` | Create |
| `src/components/WordListHub/WordListHub.jsx` | Update |
| `src/components/WordListHub/ListCeilingModal.jsx` | Create |
| `App.jsx` | Update routing and navigation flow |
| Supabase schema | Add `parent_pin_hash` column |

**Recommended order:** Prompt 3 (navigation/exit) → Prompt 1 (profile selector) → Prompt 2 (PIN) → Prompt 4 (list management) → Prompt 5 (migration audit)
