# Spellify — Auth Flow QA Checklist

Use this file to run a structured code-level and browser QA check after any changes to auth, App.jsx, or Supabase configuration.

---

## How to use this in Claude Code

Paste this prompt:

> "Run through QA_AUTH.md. Read App.jsx, src/lib/auth.js, src/lib/supabase.js, src/components/auth/AuthModal.jsx, src/components/auth/CreateChildProfile.jsx. Check every item and report pass / fail / not-found for each one."

---

## Section 1 — Environment & Connection

- [ ] `REACT_APP_SUPABASE_URL` is set in `.env.local`
- [ ] `REACT_APP_SUPABASE_ANON_KEY` is set in `.env.local`
- [ ] `src/lib/supabase.js` reads `process.env.REACT_APP_SUPABASE_URL` (not `import.meta.env.VITE_*`)
- [ ] `isSupabaseEnabled` correctly reflects whether the client is initialised
- [ ] No Supabase keys are hardcoded in any source file

---

## Section 2 — Sign Up Flow

- [ ] AuthModal renders on all App.jsx return branches (not just the main return)
- [ ] `globalAuthModals` (or equivalent) is included in: no-session dashboard branch, no-session onboarding branch, and main return
- [ ] Sign up calls `signUp()` from `src/lib/auth.js`
- [ ] On success, UI shows "Check your email" confirmation state
- [ ] Password generator fills both password and confirm fields
- [ ] Supabase `handle_new_user` trigger exists to auto-create `profiles` row on signup

---

## Section 3 — Email Confirmation & Sign In

- [ ] `onAuthStateChange` in `src/lib/auth.js` passes both `session` and `event` to the callback
- [ ] `onAuthStateChange` in App.jsx closes the auth modal on `SIGNED_IN` event
- [ ] Old tab detects sign-in from email confirmation link without requiring a manual page refresh
- [ ] Sign in calls `signIn()` from `src/lib/auth.js`
- [ ] `authUser` state is set correctly after sign in

---

## Section 4 — Child Profile Creation

- [ ] After sign in, App.jsx queries `children` table for rows matching `parent_id = authUser.id`
- [ ] If zero children rows returned, `createChildOpen` is set to `true`
- [ ] `CreateChildProfile` component mounts when `createChildOpen` is true AND `authUser` is set
- [ ] `CreateChildProfile` is mounted in all render branches (not just main return)
- [ ] On submission, a row is inserted into the `children` table with correct `parent_id`
- [ ] `alias_id` is generated and stored on the child row
- [ ] After creation, `handleChildCreated` is called and `createChildOpen` is set to false

---

## Section 5 — localStorage Wipe on First Sign In

- [ ] When `children` query returns empty (first sign in), the following keys are cleared:
  - `spellify_session_v2`
  - `spellify_session` (legacy)
  - `spellify_player_stats`
  - `spellify_streak`
  - `spellify_explore_recent`
  - `spellify_explore_favourites`
- [ ] `setSession(null)` is called to clear in-memory session state
- [ ] Points/lumens display updates immediately after wipe (re-render triggered)
- [ ] Mastery records (`spellify_mastery_*`) are deliberately NOT wiped (preserved for migration)

---

## Section 6 — Sign Out

- [ ] Sign out calls `signOut()` from `src/lib/auth.js`
- [ ] `authUser` is set to `null` on `SIGNED_OUT` event
- [ ] `createChildOpen` is reset to `false` on sign out
- [ ] `migrateChild` is reset to `null` on sign out
- [ ] Guest mode is accessible after sign out (no stale auth state)

---

## Section 7 — Guest Mode

- [ ] App works fully without any auth (incognito / no account)
- [ ] No Supabase calls are made when `isSupabaseEnabled` is false or user is not signed in
- [ ] localStorage session persists correctly in guest mode
- [ ] Sign in button is visible and opens AuthModal in guest mode

---

## Section 8 — RLS Policies (Supabase)

Run this in Supabase SQL Editor to verify all required policies exist:

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
and tablename in ('profiles', 'children')
order by tablename, cmd;
```

Expected policies:

| Table | Operation | Policy name |
|-------|-----------|-------------|
| profiles | SELECT | Users can read own profile |
| profiles | INSERT | Users can insert own profile |
| profiles | UPDATE | Users can update own profile |
| children | SELECT | Parents can read own children |
| children | INSERT | Parents can insert own children |
| children | UPDATE | Parents can update own children |

Also verify the new-user trigger:

```sql
select trigger_name from information_schema.triggers
where event_object_table = 'users'
and trigger_schema = 'auth';
```

Should return `on_auth_user_created`.

---

## Section 9 — Browser QA (manual)

Run through these manually in the browser after any auth-related change:

- [ ] Sign up with a new email → confirmation email arrives
- [ ] Click confirmation link → old tab updates automatically (modal closes)
- [ ] Sign in → child profile creation screen appears
- [ ] Complete child profile → row appears in Supabase children table
- [ ] Sign out → app returns to guest state, no stale data
- [ ] Guest mode in incognito → no auth errors in console
- [ ] Forgot password → reset email arrives and link works

---

*Last updated: May 2026*
