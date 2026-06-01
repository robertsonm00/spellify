import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Welcome        from './components/Welcome';
import OnboardingFlow from './components/OnboardingFlow';
import SpellingQuiz   from './components/SpellingQuiz';
import { loadSession, saveSession, createSession, INITIAL_STATUSES, updateMastery, rebuildReviewQueue, getActivityProgress, setActivityProgress } from './data/spelling/sessionSchema';
import { getActivity } from './data/activities';
import { isActivityAvailable } from './utils/activityAvailability';
import { recordGameCompleted, getPlayerStats, getLevelFromGames, getLevelProgress } from './utils/gamificationEngine';
import { recordPlayToday, getStreak, getStreakStatus } from './utils/streakEngine';
import SpellifyLogo   from './components/SpellifyLogo';
import { fireBuddyCheer } from './components/BuddyAvatar';
import ExploreDashboard from './components/explore/ExploreDashboard';
import AdventureMap from './components/AdventureMap';
import HFWIsland from './components/HFWIsland';
import SpellShop from './components/SpellShop';
import AvatarBuilder from './components/AvatarBuilder';
import ArcadeFooter from './components/ArcadeFooter';
import MobileBottomNav from './components/MobileBottomNav';
// MobileTopBar removed — SpellifyLogo is the single floating wordmark.
import AuthModal      from './components/auth/AuthModal';
import CreateChildProfile from './components/auth/CreateChildProfile';
import MigratePrompt from './components/auth/MigratePrompt';
import { hasGuestData } from './lib/migrationService';
import ProfileSelector from './components/ProfileSelector/ProfileSelector';
import PINEntry from './components/auth/PINEntry';
import PINSetup from './components/auth/PINSetup';
import PINLocked from './components/auth/PINLocked';
import ParentDashboard from './components/ParentDashboard/ParentDashboard';
import { hashPin, verifyPin } from './lib/pin';
import { readLockout, recordFailure, clearLockout, isLocked, attemptsLeft } from './lib/pinLockout';
import { getSession, onAuthStateChange } from './lib/auth';
import { supabase, isSupabaseEnabled } from './lib/supabase';
import Settings       from './components/Settings';
import { GeneratedWords } from './components/OnboardingFlow';
import GameWordPanel  from './components/GameWordPanel';
import { useUser }    from './hooks/useUser';

function hasProgress(activityStatuses) {
  return Object.values(activityStatuses || {}).some(
    (s) => s === 'in-progress' || s === 'completed'
  );
}

function App() {
  const [section,        setSection]        = useState('home'); // 'home' | 'assignments' | 'mylists' | 'exploreDashboard' | 'favourites' | 'recent'
  // When AdventureMap taps a stop, we hand the list off to ExploreDashboard
  // via this prop. ED clears it (via onPendingHandled) once consumed.
  const [pendingMapList, setPendingMapList] = useState(null);
  const handleAdventureOpenList = (list) => {
    setPendingMapList({ list, listType: 'curriculum', origin: 'map' });
    setSection('exploreDashboard');
    setNavTick(t => t + 1);
  };
  // Back from a list opened externally — route to the right place.
  // For now only 'map' is wired (returns to the home/Adventure Map).
  const handleListExit = (origin) => {
    if (origin === 'map') {
      setSection('home');
      setNavTick(t => t + 1);
    }
  };
  // Increments on every top-nav tab click so ExploreDashboard can clear its
  // internal selectedList even when the user clicks the tab they're already on.
  const [navTick,        setNavTick]        = useState(0);
  const [hfwFromIsleId,  setHfwFromIsleId]  = useState(null);
  const [showSignIn,     setShowSignIn]     = useState(false);
  const [signInView,     setSignInView]     = useState('signin'); // 'signin' | 'signup'
  const openAuth = (view = 'signin') => { setSignInView(view); setShowSignIn(true); };

  // ── New auth state — independent of the legacy useUser hook ──────
  // `authUser` is the Supabase auth.users record (null when not signed
  // in). After first sign-in we look up children rows: if none we show
  // CreateChildProfile, then optionally the localStorage MigratePrompt.
  const [authUser,        setAuthUser]        = useState(null);
  const [createChildOpen, setCreateChildOpen] = useState(false);
  const [migrateChild,    setMigrateChild]    = useState(null);  // child row after creation
  // Snapshot of the guest session captured BEFORE we wipe localStorage
  // on first sign-in — handed to CreateChildProfile so the parent
  // doesn't have to retype what Quick Start already collected
  // (nickname, year, confidence, character, SEN profile, adaptive).
  const [guestPrefill,    setGuestPrefill]    = useState(null);
  // Full list of children rows for the signed-in parent (Prompt 3):
  // ProfileSelector renders one card per row. Refreshed on sign-in and
  // after CreateChildProfile / MigratePrompt land new data.
  const [childrenRows,    setChildrenRows]    = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(false);

  // Grown-up area PIN gate state (Prompt 2):
  //   parentProfile  : profiles row for the signed-in parent (has the
  //                    parent_pin_hash column).
  //   pinGateMode    : 'closed' | 'entry' | 'setup' | 'change' | 'locked'
  //   pinSetupMandatory : true when a PIN-less parent first opens the
  //                    grown-up area — setup then has no skip/cancel so
  //                    the gate can't be left open (R2-06). False for the
  //                    optional "Change PIN" flow inside the dashboard.
  //   pinBusy        : disable inputs while we hash/write
  //   pinError       : surfaced under the PIN inputs
  //   pinLockUntil   : epoch ms the wrong-attempt lockout lifts at; drives
  //                    the 'locked' gate (5 wrong tries → 10-min cooldown).
  const [parentProfile, setParentProfile] = useState(null);
  const [pinGateMode,   setPinGateMode]   = useState('closed');
  const [pinSetupMandatory, setPinSetupMandatory] = useState(false);
  const [pinBusy,       setPinBusy]       = useState(false);
  const [pinError,      setPinError]      = useState(null);
  // Positive/confirmation message (green), kept separate from pinError (red)
  // so a "reset email sent" success isn't styled like a failure.
  const [pinNotice,     setPinNotice]     = useState(null);
  const [pinLockUntil,  setPinLockUntil]  = useState(null);
  // Set when the parent has come back through the email PIN-reset link
  // (?reset=1 or a Supabase PASSWORD_RECOVERY event). An effect picks it up
  // once the session is known, wipes the stored PIN hash and drops the
  // grown-up into mandatory fresh-PIN setup — closing the "it asked me to
  // ENTER my PIN, never let me reset it" gap.
  const [pinResetPending, setPinResetPending] = useState(false);
  // Set true right after a child profile is created so a brand-new account
  // is made to set its grown-up PIN straight away (R2-06 — every account
  // must be PIN-protected). An effect picks this up once the profile row
  // has loaded; it self-cancels if a PIN already exists, so adding a second
  // child to an already-protected account never re-prompts.
  const [pinSetupAfterSignup, setPinSetupAfterSignup] = useState(false);

  // Tracks the user.id we last handled SIGNED_IN for. Supabase fires
  // SIGNED_IN more than once in some flows (initial subscription +
  // tab focus + token refresh in some SDK versions, and React 18
  // StrictMode in dev double-invokes the subscribe effect), which
  // would otherwise re-route + re-query children + re-clear state on
  // every fire. We only act on the first SIGNED_IN for a given user.
  const lastSignedInUserIdRef = useRef(null);
  // Mirrors the active child's Supabase id so progress-sync can run from
  // callbacks defined before the `session` state itself, and survives a
  // restore-from-localStorage session (kept current by an effect below).
  const activeChildIdRef = useRef(null);

  useEffect(() => {
  let cancelled = false;
  getSession().then((s) => { if (!cancelled) setAuthUser(s?.user ?? null); });

  const unsub = onAuthStateChange((session, event) => {
  if (cancelled) return;
  setAuthUser(session?.user ?? null);
  if (event === 'SIGNED_IN' && session?.user) {
    if (lastSignedInUserIdRef.current === session.user.id) {
      console.info('[auth] SIGNED_IN duplicate for', session.user.id, '— ignored');
      return;
    }
    lastSignedInUserIdRef.current = session.user.id;
    // Per Prompt 3 spec: every signed-in user lands on the
    // ProfileSelector ("Who's playing?"), no matter what was in
    // localStorage. Previously this respected the initial 'hub' state
    // when a stale session was cached locally, which let returning
    // users bypass the selector and drop straight into the game.
    setShowSignIn(false);
    setScreen('profileSelector');
    setSection('home');
    setActiveActivity(null);
    // NB: do NOT setSession(null) here — the guest-upgrade flow
    // depends on the localStorage session being intact so
    // openChildSetup can snapshot it for CreateChildProfile prefill
    // (see `guestPrefill`). The profileSelector route renders based
    // on `screen` state alone, so an in-memory session can't bleed
    // through.
    console.info('[auth] SIGNED_IN → routing to ProfileSelector');
  }
  if (event === 'PASSWORD_RECOVERY' && session?.user) {
    // The parent followed the "Reset PIN by email" link. Land them on the
    // selector and flag the reset so the effect below clears the old PIN
    // and forces a fresh setup, rather than silently asking them to ENTER
    // a PIN they no longer remember.
    setShowSignIn(false);
    setScreen('profileSelector');
    setSection('home');
    setActiveActivity(null);
    setPinResetPending(true);
    console.info('[auth] PASSWORD_RECOVERY → PIN reset pending');
  }
  if (event === 'SIGNED_OUT') {
    // Sign-out → return to a clean welcome screen and wipe the
    // in-memory + persisted session/stats so the next user (guest or
    // another parent) doesn't see the previous account's data.
    setCreateChildOpen(false);
    setMigrateChild(null);
    setActiveActivity(null);
    setSection('home');
    setScreen('welcome');
    setSession(null);
    setChildrenRows([]);
    setChildrenLoading(false);
    lastSignedInUserIdRef.current = null;
    setParentProfile(null);
    setPinGateMode('closed');
    setPinSetupMandatory(false);
    setPinError(null);
    setPinNotice(null);
    setPinResetPending(false);
    try {
      localStorage.removeItem('spellify_session_v2');
      localStorage.removeItem('spellify_session');
      localStorage.removeItem('spellify_player_stats');
      localStorage.removeItem('spellify_streak');
      localStorage.removeItem('spellify_explore_recent');
      localStorage.removeItem('spellify_explore_favourites');
      // Also clear any leftover Supabase auth keys so a stale cached
      // session can't restore the previous user's email on next render.
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-'))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    setPointsTick((t) => t + 1);
    // Force the legacy useUser hook (and any cached getSession()) to
    // re-read — null after the wipe above.
    setAuthUser(null);
  }
});
  
  return () => { cancelled = true; unsub(); };
}, []);

  // Catch the PIN-reset return link. The reset email points back at
  // /?reset=1; Supabase also fires PASSWORD_RECOVERY, but the query flag is
  // a belt-and-braces signal in case the SDK has already swallowed the
  // recovery event by the time this mounts. Either way we flag the reset
  // and strip the param so a refresh doesn't re-trigger it.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset') === '1') {
        setPinResetPending(true);
        params.delete('reset');
        const qs = params.toString();
        const clean = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
        window.history.replaceState({}, '', clean);
      }
    } catch { /* ignore */ }
  }, []);

  // Honour a pending PIN reset: once we know who's signed in, wipe the
  // stored hash, clear any lockout, and drop the parent into mandatory
  // fresh-PIN setup. This is what makes the email link actually let them
  // CHANGE the PIN rather than be asked to enter the forgotten one.
  useEffect(() => {
    if (!pinResetPending || !authUser?.id || !isSupabaseEnabled) return;
    let cancelled = false;
    (async () => {
      const { error: err } = await supabase
        .from('profiles')
        .update({ parent_pin_hash: null })
        .eq('id', authUser.id)
        .select('id');
      if (cancelled) return;
      if (err) {
        console.warn('[pin] reset clear failed', err);
        setPinNotice(null);
        setPinError('Could not reset your PIN — please try again.');
        setPinResetPending(false);
        return;
      }
      clearLockout(authUser.id);
      setParentProfile((prev) => ({ ...(prev || {}), id: authUser.id, parent_pin_hash: null }));
      setPinError(null);
      setPinLockUntil(null);
      setPinResetPending(false);
      setPinNotice('PIN reset — choose a new 4-digit PIN.');
      setPinSetupMandatory(true);
      setPinGateMode('setup');
    })();
    return () => { cancelled = true; };
  }, [pinResetPending, authUser?.id]);

  // Drop any lingering green notice once the gate is fully closed, so it
  // doesn't flash back the next time the gate opens.
  useEffect(() => {
    if (pinGateMode === 'closed') setPinNotice(null);
  }, [pinGateMode]);

  // When the signed-in parent has no children, prompt for child setup.
  //
  // Bug fix: if this is the parent's first sign-in (no child rows yet),
  // wipe the guest-mode localStorage so an old guest session can't
  // bleed into the freshly-authenticated account. Mastery records are
  // intentionally LEFT in place so MigratePrompt (after child setup)
  // can offer to import them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authUser?.id || !isSupabaseEnabled) {
        setCreateChildOpen(false);
        return;
      }
      // Helper — actually open the child-creation modal + wipe guest
      // state. Pulled out so error paths can call it too: if we can't
      // tell whether the user has children (RLS blocks SELECT, query
      // errors out, network drops), we treat that as "no children yet"
      // for first-run UX — better to show the setup screen than to
      // silently leave the user on a blank dashboard.
      const openChildSetup = (why) => {
        console.info('[auth] opening CreateChildProfile —', why);
        // Snapshot the guest session BEFORE we wipe it — so the
        // CreateChildProfile form can prefill from it and the
        // MigratePrompt that follows can write the captured points /
        // lumens / streak to the new child row. Without this snapshot
        // we'd lose everything the guest entered during onboarding.
        let snap = null;
        try {
          const sessionRaw = localStorage.getItem('spellify_session_v2')
            || localStorage.getItem('spellify_session');
          const statsRaw   = localStorage.getItem('spellify_player_stats');
          const streakRaw  = localStorage.getItem('spellify_streak');
          snap = {
            session: sessionRaw ? JSON.parse(sessionRaw) : null,
            stats:   statsRaw   ? JSON.parse(statsRaw)   : null,
            streak:  streakRaw  ? JSON.parse(streakRaw)  : null,
          };
        } catch (e) {
          console.warn('[auth] could not snapshot guest session', e);
        }
        // Flatten the session fields the form actually needs.
        setGuestPrefill(snap?.session ? {
          childName:          snap.session.childName,
          year:               snap.session.year,
          spellingConfidence: snap.session.spellingConfidence,
          childCharacter:     snap.session.childCharacter,
          senProfile:         snap.session.senProfile,
          adaptiveLearning:   snap.session.adaptiveLearning,
          // Gameplay state — handed through verbatim so the migration
          // step has everything it needs in one object.
          _stats:             snap?.stats,
          _streak:            snap?.streak,
          _rawSession:        snap.session,
        } : null);

        // NOTE: we deliberately do NOT wipe localStorage here any more.
        // The wipe happens after a successful CreateChildProfile + (yes
        // or no) MigratePrompt resolution — see handleChildCreated /
        // MigratePrompt's onDone path. That way a failed sign-up flow
        // can't lose the guest's progress mid-stream.
        setSession(null);
        setPointsTick((t) => t + 1);
        setCreateChildOpen(true);
      };

      // (Prompt 3) The auto-adopt path used to live here — we now
      // route to ProfileSelector instead and let the user explicitly
      // pick "who's playing?". Adoption logic moved to the top-level
      // `handleSelectChild` callback so the selector card-tap can
      // re-use it.

      // Returning-parent race: Supabase sometimes resolves SIGNED_IN
      // a hair before RLS sees the row, so a single SELECT can return
      // zero rows for a parent who definitely has a child. Retry up
      // to 3 times with backoff before deciding it's a genuine
      // first-sign-up and opening the setup modal.
      const queryChildren = async () => {
        const { data, error: err } = await supabase
          .from('children')
          .select('*')
          .eq('parent_id', authUser.id)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false });
        return { data, err };
      };

      const RETRY_DELAYS_MS = [0, 300, 700, 1500];
      let lastErr = null;
      setChildrenLoading(true);
      for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
        if (cancelled) return;
        if (RETRY_DELAYS_MS[attempt] > 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          if (cancelled) return;
        }
        console.info(`[auth] querying children for ${authUser.id} (attempt ${attempt + 1})`);
        let res;
        try { res = await queryChildren(); }
        catch (e) {
          // Network exception — treat as retryable.
          console.warn(`[auth] children query attempt ${attempt + 1} threw`, e);
          lastErr = e;
          continue;
        }
        if (cancelled) return;
        const { data, err } = res;
        if (err) {
          // Hard error from PostgREST (RLS, schema, etc.) — stop
          // retrying since further attempts will fail the same way.
          console.warn('[auth] children query failed — opening setup as fallback', err);
          setChildrenLoading(false);
          openChildSetup('children query error: ' + (err.message || err.code));
          return;
        }
        if (Array.isArray(data) && data.length > 0) {
          console.info(`[auth] found ${data.length} child profile(s) — landing on ProfileSelector`);
          setChildrenRows(data);
          setChildrenLoading(false);
          // Per spec (Prompt 3): App opens → ProfileSelector. We do
          // NOT auto-adopt the first child; the parent (or older
          // child) explicitly picks who's playing. Adoption happens
          // when a card is tapped via handleSelectChild.
          setScreen('profileSelector');
          return;
        }
        // Zero rows — could be (a) genuinely a brand-new parent or
        // (b) RLS hasn't propagated yet. Retry a couple of times
        // before assuming (a).
        console.info(`[auth] children query attempt ${attempt + 1} returned 0 rows`);
        lastErr = null;
      }

      if (cancelled) return;
      console.info('[auth] no children after retries — opening CreateChildProfile', lastErr || '');
      setChildrenLoading(false);
      openChildSetup('zero children after retries');
    })();
    return () => { cancelled = true; };
    // setSession / setPointsTick are stable React setters; including
    // them in deps would TDZ since they're declared further down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  // Build a fresh App-level session from a Supabase children row.
  // Hydration source-of-truth so the footer / gameplay / streak all
  // reflect the active child instead of falling back to the parent's
  // email. Keeps localStorage authoritative for in-game state; the
  // child row is just the seed.
  const sessionFromChild = React.useCallback((child, opts = {}) => {
    if (!child) return null;
    const { stats } = opts;
    return {
      childName:        child.nickname || '',
      // Supabase column is `active_buddy_id`; the in-memory session
      // keeps the historical `childCharacter` shape the rest of the
      // app reads.
      childCharacter:   child.active_buddy_id ? { id: child.active_buddy_id, emoji: '' } : null,
      year:             child.school_year ?? null,
      age:              null,
      words:            [],
      wordObjects:      [],
      sourceMode:       'generated',
      dyslexiaMode:     !!child.dyslexia_mode,
      difficulty:       'medium',
      activityStatuses: {},
      activityProgress: {},
      activityCompletions: {},
      mastery:          {},
      reviewQueue:      [],
      // Existing `points` / `lumens` columns on children are the
      // canonical totals; fall back to the guest snapshot if the row
      // hasn't been updated yet.
      lumens:           child.lumens ?? stats?.totalLumens ?? 0,
      spellingConfidence: child.spelling_confidence || 'tricky',
      senProfile:       Array.isArray(child.sen_profile) ? child.sen_profile : [],
      adaptiveLearning: child.adaptive_learning !== false,
      // Mark this session as belonging to a Supabase child so future
      // sync code can tell it apart from a pure-guest local session.
      _childId:         child.id,
    };
  }, []);

  // After child profile creation, offer to migrate local mastery rows
  // (only if there's anything to migrate). Regardless of the migration
  // choice, we hydrate the session from the new child row so the
  // footer and gameplay show the child's name + year immediately.
  const handleChildCreated = (child) => {
    setCreateChildOpen(false);
    if (!child) return;
    // Optimistic add to the in-memory list so the ProfileSelector
    // shows the new card without a round-trip.
    setChildrenRows((prev) => {
      if (prev.some((c) => c.id === child.id)) return prev;
      return [child, ...prev];
    });
    const stats  = guestPrefill?._stats;
    const streak = guestPrefill?._streak;
    setSession(sessionFromChild(child, { stats, streak }));
    if (hasGuestData(stats, streak)) {
      setMigrateChild(child);
    } else {
      // Nothing to save — safe to wipe leftover guest keys now.
      finaliseGuestWipe();
    }
    // Require a grown-up PIN now that the account has a child profile. The
    // effect above waits for the profile fetch (and any migrate prompt) and
    // bails if a PIN already exists, so this is safe to set unconditionally.
    setPinSetupAfterSignup(true);
  };

  // ── ProfileSelector → Game (Prompt 3) ───────────────────────────
  // Tapping a child card in ProfileSelector hydrates the session from
  // that row and routes into the game. Re-seeds local engine keys so
  // the footer reads the correct points/lumens/streak immediately.
  const handleSelectChild = React.useCallback((child) => {
    if (!child) return;
    setSession(sessionFromChild(child));
    try {
      localStorage.setItem('spellify_player_stats', JSON.stringify({
        totalPoints:    child.points ?? 0,
        totalLumens:    child.lumens ?? 0,
        // Level is derived from totalGames, so it MUST be seeded too or the
        // footer recomputes Level 1 on every re-login. total_games /
        // total_mastered come from the children-progress migration; they
        // fall back to 0 on deployments that predate it.
        totalGames:     child.total_games ?? 0,
        totalMastered:  child.total_mastered ?? 0,
        lastPlayedDate: child.last_played_date ?? null,
      }));
      localStorage.setItem('spellify_streak', JSON.stringify({
        currentStreak:  child.current_streak ?? 0,
        longestStreak:  child.longest_streak ?? 0,
        lastPlayedDate: child.last_played_date ?? null,
        graceUsed:      false,
      }));
    } catch { /* storage disabled — engine falls back to defaults */ }
    setPointsTick((t) => t + 1);
    window.dispatchEvent(new CustomEvent('spellify-points-update'));
    setSection('home');
    setScreen('hub');
    setActiveActivity(null);
  }, [sessionFromChild]);

  // Persist the active child's progression (points / lumens / level /
  // games / streak) back to their Supabase row. Without this, gameplay
  // only ever updated localStorage, so the canonical child row stayed at
  // 0 — and handleSelectChild then re-seeded localStorage FROM that row on
  // the next login, wiping the child back to Level 1 / 0 points / 0 lumens.
  // Best-effort and non-blocking: localStorage remains the in-session
  // source of truth; this just makes it durable across logins/devices.
  const syncActiveChildProgress = React.useCallback(async () => {
    const childId = activeChildIdRef.current;
    if (!childId || !isSupabaseEnabled || !supabase) return;
    try {
      const s      = getPlayerStats();
      const streak = getStreak();
      // Columns that exist on every deployment of `children`.
      const safe = {
        points:           s.totalPoints ?? 0,
        lumens:           s.totalLumens ?? 0,
        level:            getLevelFromGames(s.totalGames ?? 0),
        last_played_date: s.lastPlayedDate ?? streak.lastPlayedDate ?? null,
        current_streak:   streak.currentStreak ?? 0,
        longest_streak:   streak.longestStreak ?? 0,
      };
      // total_games / total_mastered arrived with the children-progress
      // migration; needed so level can be reconstructed on re-login.
      const full = {
        ...safe,
        total_games:    s.totalGames ?? 0,
        total_mastered: s.totalMastered ?? 0,
      };
      // `.select('id')` lets us see how many rows the UPDATE actually touched.
      // With RLS enabled but no UPDATE *policy* on `children`, an update
      // returns NO error yet matches ZERO rows — it silently writes nothing,
      // which is exactly why progress kept resetting: the sync "succeeded",
      // the row stayed at 0, and the next login re-seeded localStorage from
      // those zeros. Detect that case explicitly instead of trusting !error.
      let { data, error } = await supabase
        .from('children').update(full).eq('id', childId).select('id');
      if (error) {
        // Older deployments lack the two extra columns — retry with only
        // the always-present set so points/lumens/level/streak still persist.
        ({ data, error } = await supabase
          .from('children').update(safe).eq('id', childId).select('id'));
      }
      if (error) {
        console.error('[progress] child sync failed', error);
      } else if (!data || data.length === 0) {
        console.error(
          '[progress] child sync wrote 0 rows — the row exists but the UPDATE ' +
          'matched nothing, which means `children` is missing an RLS UPDATE ' +
          'policy. Apply supabase/migrations/2026_06_01_children_update_policy.sql.',
          { childId }
        );
      }
    } catch (err) {
      console.error('[progress] child sync threw', err);
    }
  }, []);

  // Exit button (in-game) → returns to ProfileSelector. Does NOT sign
  // out: the parent stays authenticated, we just clear the active
  // child so the selector can show "who's playing?" again.
  const handleExitToSelector = React.useCallback(() => {
    // Flush the latest totals to the child row before we drop the session,
    // so leaving mid-progress (without finishing a game) still persists.
    syncActiveChildProgress();
    setSession(null);
    setActiveActivity(null);
    setShowExitModal(false);
    setSection('home');
    setScreen('profileSelector');
  }, [syncActiveChildProgress]);

  // Quick Start from the selector (guest path) → onboarding.
  const handleQuickStart = React.useCallback(() => {
    setScreen('onboarding');
  }, []);

  // ProfileSelector → "Add profile" (Prompt 1). Opens the existing
  // CreateChildProfile flow without any guest-prefill — this is a
  // signed-in parent adding a *new* child, so the form starts blank.
  // Tier ceiling (free = 1) is enforced inside ProfileSelector before
  // this callback fires; here we just open the modal.
  const handleAddProfile = React.useCallback(() => {
    setGuestPrefill(null);
    setCreateChildOpen(true);
  }, []);

  // ── Grown-up PIN gate (Prompt 2) ────────────────────────────────
  //
  // Adult / parent card on the selector now routes through here.
  // Flow:
  //   1. Tap card → handleParentCardTap
  //   2. If profile.parent_pin_hash is null → render <PINSetup>
  //                                            (parent can also Skip)
  //   3. If a hash exists → render <PINEntry>; verifyPin() compares
  //   4. On pass / setup-save → setScreen('parentDashboard')
  //
  // Hashing is client-side PBKDF2 (see src/lib/pin.js). Salt is the
  // parent's profiles.id (== auth.uid).

  // Fetch the parent's profile row whenever the auth user changes so
  // we know whether a PIN is set. Done lazily — gracefully no-ops if
  // the row doesn't exist yet (returning user before profile insert
  // landed, or RLS hiccup).
  useEffect(() => {
    if (!authUser?.id || !isSupabaseEnabled) { setParentProfile(null); return; }
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('profiles')
        // NB: do NOT select `display_name` — that column does not exist on
        // public.profiles. Selecting it made this fetch error every time, so
        // parentProfile fell back to null and the grown-up gate re-prompted
        // for PIN *setup* on every entry (even with a PIN already saved) —
        // a security hole, since "set a new PIN" replaced "enter your PIN".
        .select('id, parent_pin_hash')
        .eq('id', authUser.id)
        .maybeSingle();
      if (cancelled) return;
      if (err) {
        console.warn('[pin] profile fetch failed', err);
        setParentProfile(null);
        return;
      }
      setParentProfile(data || { id: authUser.id, parent_pin_hash: null });
    })();
    return () => { cancelled = true; };
  }, [authUser?.id]);

  // Force grown-up PIN setup straight after sign-up (R2-06). Waits for the
  // profile row to load and for any guest-migration prompt to clear first,
  // so we don't stack two modals. Self-cancels if a PIN already exists —
  // adding a second child to a protected account won't re-prompt.
  useEffect(() => {
    if (!pinSetupAfterSignup || migrateChild) return;
    if (!parentProfile) return;            // wait for the profile fetch
    setPinSetupAfterSignup(false);
    if (!parentProfile.parent_pin_hash) {
      setPinSetupMandatory(true);
      setPinGateMode('setup');
    }
  }, [pinSetupAfterSignup, migrateChild, parentProfile]);

  const handleParentCardTap = React.useCallback(() => {
    setPinError(null);
    if (!parentProfile) {
      // Profile row missing — open setup so the parent can set a PIN
      // from scratch. The first save will upsert the row. Mandatory:
      // a profile with no PIN can't be allowed past this gate (R2-06).
      setPinSetupMandatory(true);
      setPinGateMode('setup');
      return;
    }
    if (parentProfile.parent_pin_hash) {
      // Honour any active wrong-attempt lockout first — a reload during
      // the cooldown must still land on the locked screen, not a fresh
      // entry prompt (the count lives in localStorage, keyed per user).
      const lock = readLockout(authUser?.id);
      if (isLocked(lock)) {
        setPinLockUntil(lock.lockedUntil);
        setPinGateMode('locked');
        return;
      }
      setPinGateMode('entry');
      return;
    }
    // PIN-less parent (e.g. account created before R2-06) — force them
    // to set one before the grown-up area opens. No skip, no back-door.
    setPinSetupMandatory(true);
    setPinGateMode('setup');
  }, [parentProfile, authUser?.id]);

  const handlePinSubmit = React.useCallback(async (pin) => {
    if (!parentProfile?.parent_pin_hash || !authUser?.id) return false;
    setPinBusy(true); setPinError(null); setPinNotice(null);
    const ok = await verifyPin(pin, authUser.id, parentProfile.parent_pin_hash);
    setPinBusy(false);
    if (!ok) {
      // Count the miss. After MAX_PIN_ATTEMPTS wrong tries the record locks
      // for 10 minutes; before that we warn how many tries remain so the
      // grown-up isn't surprised by a sudden lockout.
      const record = recordFailure(authUser.id);
      if (isLocked(record)) {
        setPinLockUntil(record.lockedUntil);
        setPinError(null);
        setPinGateMode('locked');
        return false;
      }
      const left = attemptsLeft(record);
      setPinError(`That PIN didn't match. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
      return false;
    }
    // Correct — wipe the failure tally so a future slip starts fresh.
    clearLockout(authUser.id);
    setPinGateMode('closed');
    setScreen('parentDashboard');
    return true;
  }, [authUser?.id, parentProfile?.parent_pin_hash]);

  const handlePinSave = React.useCallback(async (pin) => {
    if (!authUser?.id) return;
    setPinBusy(true); setPinError(null);
    try {
      const hash = await hashPin(pin, authUser.id);
      // upsert so a brand-new account with no profiles row still
      // gets one written here. `.select('id')` makes the write echo back
      // the affected row: if profiles RLS lacks an insert/update policy
      // scoped to auth.uid(), the upsert returns NO error but matches ZERO
      // rows — a silent failure that would close the gate yet persist
      // nothing, so the PIN would re-prompt on the next login. Treat an
      // empty result as a hard error rather than a false success.
      const { data, error: err } = await supabase
        .from('profiles')
        .upsert({ id: authUser.id, parent_pin_hash: hash }, { onConflict: 'id' })
        .select('id');
      if (err) {
        console.error('[pin] save failed', err);
        setPinError(err.message || 'Could not save PIN. Please try again.');
        return;
      }
      if (!data || data.length === 0) {
        console.error('[pin] save wrote 0 rows — profiles RLS likely blocks this write', { id: authUser.id });
        setPinError('Could not save PIN (permission issue). Please try again.');
        return;
      }
      setParentProfile((prev) => ({ ...(prev || {}), id: authUser.id, parent_pin_hash: hash }));
      setPinSetupMandatory(false);
      setPinGateMode('closed');
      setScreen('parentDashboard');
    } catch (e) {
      console.error('[pin] hash failed', e);
      setPinError(e.message || 'Could not save PIN.');
    } finally {
      setPinBusy(false);
    }
  }, [authUser?.id]);

  const handlePinSkip = React.useCallback(() => {
    setPinSetupMandatory(false);
    setPinGateMode('closed');
    // Only reachable from the optional "Change PIN" flow (mandatory
    // first-time setup passes no onSkip — R2-06). Backing out keeps the
    // existing PIN and returns to the dashboard.
    setScreen('parentDashboard');
  }, []);

  const handlePinForgot = React.useCallback(async () => {
    if (!authUser?.email || !supabase) return;
    try {
      // Re-use Supabase's password-reset email — the spec ties PIN
      // reset to email confirmation (the parent owns the email so
      // that's the right out-of-band channel). redirectTo carries the
      // ?reset=1 flag back so the link drops them straight into fresh-PIN
      // setup instead of the (now-forgotten) entry prompt.
      await supabase.auth.resetPasswordForEmail(authUser.email, {
        redirectTo: `${window.location.origin}/?reset=1`,
      });
      setPinError(null);
      setPinNotice('Reset email sent. Open it on this device to set a new PIN.');
    } catch (e) {
      console.warn('[pin] reset email failed', e);
      setPinNotice(null);
      setPinError('Could not send reset email — try again later.');
    }
  }, [authUser?.email]);

  // Fired by PINLocked once the 10-minute cooldown elapses: clear the
  // failure tally and re-open the normal entry prompt so the grown-up can
  // try again with a full fresh allowance.
  const handlePinLockExpire = React.useCallback(() => {
    if (authUser?.id) clearLockout(authUser.id);
    setPinLockUntil(null);
    setPinError(null);
    setPinGateMode((m) => (m === 'locked' ? 'entry' : m));
  }, [authUser?.id]);

  // ParentDashboard → Remove PIN. Wipes the hash so the gate is open
  // again. No re-verify required because the parent is already
  // inside the gate.
  const handleRemovePin = React.useCallback(async () => {
    if (!authUser?.id) return;
    if (!window.confirm('Remove the grown-up area PIN? Anyone on this device will be able to open this area.')) return;
    const { error: err } = await supabase
      .from('profiles')
      .update({ parent_pin_hash: null })
      .eq('id', authUser.id);
    if (err) { console.warn('[pin] remove failed', err); return; }
    setParentProfile((prev) => prev ? { ...prev, parent_pin_hash: null } : prev);
  }, [authUser?.id]);

  // ParentDashboard → Change PIN. Already inside the gate, so jump
  // straight to PINSetup (re-confirm flow inside the component). This is
  // the one setup path that stays skippable — backing out just returns
  // to the dashboard with the existing PIN intact (R2-06).
  const handleChangePin = React.useCallback(() => {
    setPinError(null);
    setPinSetupMandatory(false);
    setPinGateMode('setup');
  }, []);

  // Centralised "guest data has been migrated (or there was nothing to
  // migrate) — drop the local keys we've now replaced" step. Called at
  // the END of the first-sign-in flow, never before, so any failure
  // earlier preserves the data for retry.
  //
  // We deliberately KEEP `spellify_player_stats` and `spellify_streak`
  // in place. Even after migration they represent the live state of
  // the current player (now a Supabase-backed child), and the existing
  // gamification + streak engines read straight from those keys. The
  // migration step also re-seeds them with the merged values so the
  // footer reflects the migrated totals immediately.
  const finaliseGuestWipe = React.useCallback(() => {
    try {
      localStorage.removeItem('spellify_session_v2');
      localStorage.removeItem('spellify_session');                 // legacy
      localStorage.removeItem('spellify_explore_recent');
      localStorage.removeItem('spellify_explore_favourites');
      // Custom lists — if migrated, already removed by migrationService;
      // if skipped, remove now so stale guest lists don't bleed through
      // to the signed-in useCustomLists hook.
      localStorage.removeItem('spellify_custom_lists');
      // Mastery keys — migrated to Supabase (or skipped)
      Object.keys(localStorage)
        .filter((k) =>
          k.startsWith('spellify_mastery_') ||
          k.startsWith('spellify_started_') ||
          k.startsWith('spellify_locked_words_')
        )
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    setGuestPrefill(null);
  }, []);
  const [settingsOpen,     setSettingsOpen]     = useState(false);
  const [changeWordsOpen,  setChangeWordsOpen]  = useState(false);
  const { user, profile, signIn, signUp, signInWithGoogle, signOut } = useUser();

  // Live points — read from the gamification engine; re-reads on any game
  // completion (both My Words and Explore flows dispatch 'spellify-points-update').
  const [pointsTick, setPointsTick] = useState(0);
  useEffect(() => {
    const onUpdate = () => setPointsTick(t => t + 1);
    window.addEventListener('spellify-points-update', onUpdate);
    return () => window.removeEventListener('spellify-points-update', onUpdate);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const livePoints = React.useMemo(() => getPlayerStats().totalPoints, [pointsTick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liveLumens = React.useMemo(() => getPlayerStats().totalLumens || 0, [pointsTick]);
  // Level is derived from games completed, not points (LVL-01). The footer XP
  // bar shows progress within the level — one game = one notch toward the next.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liveGames  = React.useMemo(() => getPlayerStats().totalGames || 0, [pointsTick]);
  const liveLevel  = React.useMemo(() => getLevelFromGames(liveGames), [liveGames]);
  const levelXp    = React.useMemo(() => {
    const p = getLevelProgress(liveGames);
    // Max level reached → show a full bar rather than "/ 0".
    return p.isMax ? { current: 1, max: 1 } : { current: p.gamesIntoLevel, max: p.gamesForLevel };
  }, [liveGames]);

  // Keep session.lumens mirrored to the gamification engine so it
  // persists with the rest of the session (Supabase syncs from here).
  useEffect(() => {
    setSession((prev) => {
      if (!prev) return prev;
      if (prev.lumens === liveLumens) return prev;
      return { ...prev, lumens: liveLumens };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLumens]);

  // ── Streak popup (once per app open) + milestone confetti ──────────
  // The popup state stores an absolute `dismissAt` (epoch ms) rather
  // than a countdown — this means the StreakPopup effect re-targets
  // the same deadline if its parent re-renders (so a fresh-on-every-
  // render `onDismiss` callback can't bug-restart the timer in dev
  // StrictMode). `dismissAt: null` means sticky (at_risk).
  //
  // milestoneShownRef ensures the same milestone doesn't re-fire
  // confetti if the user games again on the same day. streakShownRef
  // ensures the once-per-app-open popup fires exactly once.
  const [streakPopup,     setStreakPopup]     = useState(null);
  const streakShownRef    = useRef(false);
  const milestoneShownRef = useRef(0);
  // Stable dismiss ref — `onDismiss` passed to <StreakPopup> reads
  // this so the effect's dep array never sees a new function ref.
  const dismissPopupRef = useRef(() => setStreakPopup(null));

  useEffect(() => {
    const onMilestone = (e) => {
      const m = e?.detail?.milestone;
      if (!m || milestoneShownRef.current === m) return;
      milestoneShownRef.current = m;
      // Confetti burst — uses the same lib the rest of the app uses.
      // R2-07: this burst fires as the child lands back on the home/map
      // screen, so it competed for the main thread with that screen's
      // mount render (and previously a heavy PNG background decode). The
      // oversized backgrounds are now WebP (R2-08), removing the main
      // cause of the stutter. Two defensive tweaks keep it smooth:
      //   1) particleCount trimmed 160 → 110 (still a big celebration;
      //      every other confetti call in the app uses ≤ 90) so each
      //      animation frame has less to draw over the map.
      //   2) fire on the next frame via requestAnimationFrame so the
      //      home screen has painted before the animation loop starts,
      //      instead of starting mid-mount.
      import('canvas-confetti').then(({ default: confetti }) => {
        requestAnimationFrame(() => confetti({
          particleCount: 110,
          spread: 110,
          origin: { y: 0.45 },
          colors: ['#ffd93d', '#ff9f43', '#c77dff', '#6bcb77', '#4d96ff', '#ff6b6b'],
        }));
      }).catch(() => {});
      setStreakPopup({ kind: 'milestone', streak: m, dismissAt: Date.now() + 4500 });
    };
    window.addEventListener('spellify-streak-milestone', onMilestone);
    return () => window.removeEventListener('spellify-streak-milestone', onMilestone);
  }, []);

  const [session,        setSession]        = useState(() => loadSession());

  // Keep the active-child ref in lockstep with the session, no matter how
  // the session was set (profile selection, child creation, or a
  // restore-from-localStorage on reload). syncActiveChildProgress reads
  // this ref, so progress persists in every one of those cases.
  useEffect(() => {
    activeChildIdRef.current = session?._childId ?? null;
  }, [session]);

  // Once-per-app-open streak popup — runs in a useEffect (not in the
  // render body) so render-time setState can't conflict with
  // StrictMode's double-invoke. Depends only on `session` so it fires
  // exactly when the session first becomes available.
  useEffect(() => {
    if (!session)                  return;
    if (streakShownRef.current)    return;
    streakShownRef.current = true;
    const status = getStreakStatus();
    const s = getStreak();
    if (status === 'none')                                   return;
    if (status === 'played' && s.currentStreak <= 1)         return;
    const ttl =
      status === 'at_risk' ? null  :
      status === 'played'  ? 3000  : 4000;
    setStreakPopup({
      kind:      status,
      streak:    s.currentStreak,
      dismissAt: ttl == null ? null : Date.now() + ttl,
    });
  }, [session]);
  const [screen,         setScreen]         = useState(() => {
    const s = loadSession();
    return s && s.words && s.words.length > 0 ? 'hub' : 'welcome';
  });
  const [activeActivity, setActiveActivity] = useState(null);
  const [showExitModal,  setShowExitModal]  = useState(false);
  const [, setIsFirstVisit] = useState(false);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  // Apply/remove extra-support body class whenever dyslexiaMode changes
  useEffect(() => {
    document.body.classList.toggle('extra-support', !!(session?.dyslexiaMode));
  }, [session?.dyslexiaMode]);

  const handleWelcomeStart = () => {
    // Quick Start is NON-DESTRUCTIVE for returning guests (QA PROF-04).
    //
    // This previously wiped EVERY spellify_* key — custom lists, mastery,
    // points, badges, streak, even the mute preference — to give a "clean
    // slate". But the welcome screen is also where returning guests land
    // after Exit-to-welcome or sign-out, so that blanket clear silently
    // destroyed their saved work. A brand-new device has nothing to wipe,
    // so the wipe only ever harmed people who had data to lose.
    //
    // We reset the in-memory session so onboarding starts fresh; completing
    // onboarding writes a new spellify_session_v2. All other persisted guest
    // data (lists, progress, points, streak, preferences) is left intact so
    // a returning child keeps everything they earned.
    setSession(null);
    setPointsTick((t) => t + 1);   // re-read live points after the reset
    setScreen('onboarding');
  };

  const handleOnboardingComplete = ({ name, character, year, age, words, wordObjects = [], dyslexiaMode = false, sourceMode = 'generated', ruleKey = null, ruleLabel = null, difficulty, spellingConfidence = 'tricky', senProfile = [], wantAddList = false }) => {
    setSession({
      ...createSession({
        year, age, words, wordObjects, sourceMode, dyslexiaMode,
        ruleKey, ruleLabel,
        spellingConfidence, senProfile,
      }),
      childName: name || '',
      childCharacter: character || null,
      difficulty: difficulty || 'medium',
      activityStatuses: INITIAL_STATUSES,
      welcomeBonus: 100,
    });
    setIsFirstVisit(true);
    // Default: land on Home (Adventure Map). If the parent picked
    // "Yes — add my own list" on the final onboarding step, route to
    // My Lists instead so they can add their list immediately.
    setSection(wantAddList ? 'mylists' : 'home');
    setScreen('hub');
    setTimeout(fireBuddyCheer, 600);
  };

  // Inspect a saved-progress snapshot for "did the child complete at least
  // one word?". Each game stores results under a slightly different key, so
  // we check the shapes we know about.
  const hasMeaningfulProgress = (progress) => {
    if (!progress) return false;
    if (Array.isArray(progress.wordResults) && progress.wordResults.length > 0) return true;
    if (Array.isArray(progress.results)     && progress.results.length     > 0) return true;
    if (Array.isArray(progress.foundWords)  && progress.foundWords.length  > 0) return true;
    if (progress.filled && (progress.filled.size > 0 || progress.filled.length > 0)) return true;
    if (Array.isArray(progress.rows) && progress.rows.some((r) => r.practices?.some((p) => p.done))) return true;
    return false;
  };

  // The My Words flow uses a stable synthetic list id so the new per-list
  // mastery / points / badges engines work the same way they do for explore
  // lists. Activated when an activity finishes — see gamificationEngine.
  const MY_WORDS_LIST_ID = 'mywords';

  const handleComplete = (id, results = []) => {
    // ── New engine: per-word mastery + points + badges ─────────────────
    try {
      const accuracy = results.length > 0
        ? Math.round((results.filter(r => r.correct).length / results.length) * 100)
        : 0;
      recordGameCompleted(
        MY_WORDS_LIST_ID,
        id,
        accuracy,
        results,
        session?.words || [],
        { isTestAll: !!activeActivity?.isTestAll },
      );
    } catch (err) {
      // Best-effort; never block the existing completion flow.
      console.error('[App] gamification engine failed', err);
    }

    setSession((prev) => {
      // Mark activity as completed (review doesn't affect activityStatuses)
      let next;
      if (id === 'review') {
        next = { ...prev };
      } else {
        const prevCompletions = prev.activityCompletions || {};
        next = {
          ...prev,
          activityStatuses: { ...prev.activityStatuses, [id]: 'completed' },
          activityCompletions: { ...prevCompletions, [id]: (prevCompletions[id] || 0) + 1 },
        };
      }
      // Clear any mid-session snapshot now the activity is finished
      next = setActivityProgress(next, id, null);
      // Apply mastery updates for every word result
      for (const { word, correct } of results) {
        next = updateMastery(next, word, correct);
      }
      // Rebuild review queue based on updated mastery
      next = rebuildReviewQueue(next);
      return next;
    });
    setActiveActivity(null);
    // Record today's play on the daily-streak ledger (idempotent — safe
    // to call multiple times in a day). Fires its own milestone event
    // which the App-level effect picks up to trigger confetti.
    try { recordPlayToday(); } catch (err) { console.error('[App] streak update failed', err); }
    // Trigger the buddy-cheer celebration once we're back on the hub. The
    // small delay gives React a frame to mount the hub + BuddyAvatar so the
    // event listener is attached when we dispatch.
    setTimeout(fireBuddyCheer, 150);
    // Notify the footer to re-read live points from the engine.
    window.dispatchEvent(new CustomEvent('spellify-points-update'));
    // Persist the freshly-earned totals to the child's Supabase row so they
    // survive sign-out / re-login / another device (the engines above only
    // wrote localStorage).
    syncActiveChildProgress();
  };

  const handleExit = () => setActiveActivity(null);

  const handleChangeWords = ({ words, wordObjects = [], dyslexiaMode, sourceMode = 'generated', ruleKey = null, ruleLabel = null } = {}) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        words,
        wordObjects,
        sourceMode,
        dyslexiaMode: dyslexiaMode ?? prev.dyslexiaMode ?? false,
        ruleKey,
        ruleLabel,
        activityStatuses: { ...INITIAL_STATUSES },
        activityProgress: {},
        activityCompletions: {},
      };
      return rebuildReviewQueue(next);
    });
    setActiveActivity(null);
  };

  const handleSettingsUpdate = (updates) => setSession((prev) => (prev ? { ...prev, ...updates } : prev));
  const handleClearProgress  = () => setSession((prev) => ({ ...prev, activityStatuses: INITIAL_STATUSES, activityProgress: {}, activityCompletions: {}, mastery: {}, reviewQueue: [] }));

  const handleSaveProgress = (id, progress) =>
    setSession((prev) => {
      // Lock the words this run is using into the snapshot. First save
      // captures the launch's words (overrideWords for Test-All / active
      // window, falling back to session.words); subsequent saves inherit
      // whatever was locked previously so the list can't shift mid-game.
      let wrapped = progress;
      if (progress != null) {
        const prevLocked = getActivityProgress(prev, id)?._words;
        const runWords = (Array.isArray(activeActivity?.overrideWords) && activeActivity.overrideWords.length > 0)
          ? activeActivity.overrideWords
          : (prev?.words || []);
        wrapped = { ...progress, _words: prevLocked ?? runWords };
      }
      let next = setActivityProgress(prev, id, wrapped);
      // First time we see real progress (≥ 1 word completed) → mark the
      // activity in-progress. Skip review and never downgrade.
      if (id !== 'review'
          && hasMeaningfulProgress(progress)
          && prev.activityStatuses[id] === 'not-started') {
        next = {
          ...next,
          activityStatuses: { ...next.activityStatuses, [id]: 'in-progress' },
        };
      }
      return next;
    });

  // Consolidated exit (Prompt 3 / pre-Prompt 1):
  //   • For a signed-in child session → always routes to ProfileSelector
  //     (single exit path; spec requirement).
  //   • For a guest session → still drops back to the Welcome screen
  //     so guests have somewhere coherent to land.
  // The "Are you sure?" confirmation modal only fires when there's
  // unsaved local progress AND we're heading to Welcome (where the
  // session would be discarded). Heading to ProfileSelector keeps the
  // session intact in localStorage so no confirmation is needed.
  const handleBackToWelcome = () => {
    if (authUser) {
      // Signed-in child session → same destination as the Exit pill.
      handleExitToSelector();
      return;
    }
    if (session && hasProgress(session.activityStatuses)) {
      setShowExitModal(true);
    } else {
      confirmExit();
    }
  };

  const confirmExit = () => {
    setShowExitModal(false);
    setSession(null);
    setActiveActivity(null);
    setScreen('welcome');
  };

  // ── Footer identity (real values, not hardcoded placeholders) ────
  // Priority for the name: child profile nickname → parent display
  // name → email local-part → 'GUEST'. Uppercased for arcade type.
  const footerName = (
    session?.childName ||
    profile?.display_name ||
    authUser?.email?.split('@')[0] ||
    'GUEST'
  );
  const footerPlayerName = String(footerName).toUpperCase();
  const footerYear       = session?.year ?? null;
  const footerIsGuest    = !authUser;

  // ── Exit-to-Selector button (Prompt 3) ──────────────────────────
  // Always-available control on in-game surfaces. Returns to the
  // ProfileSelector ("Who's playing?") screen — does NOT sign out;
  // the parent stays authenticated. Hidden on welcome, onboarding,
  // and the selector itself. Hidden for guests (no selector to land
  // on yet — Prompt 1 changes that).
  // Exit-to-profile-selector is only shown on the Adventure Map (home).
  // Everywhere else (dashboard sub-pages, HFW island, Spell Shop, in-game
  // chrome) hides it to keep those screens focused.
  const showExitBtn = !!authUser
    && screen !== 'welcome'
    && screen !== 'onboarding'
    && screen !== 'profileSelector'
    && section === 'home';

  const exitToSelectorBtn = showExitBtn ? (
    <button
      type="button"
      className="exit-to-selector-btn"
      onClick={handleExitToSelector}
      aria-label="Exit to profile selector"
      title="Who's playing?"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Door + arrow — the universal "exit" glyph */}
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <span>Exit</span>
    </button>
  ) : null;

  // ── Global streak popup ──────────────────────────────────────────
  // Same hoist as the auth modals: previously the <StreakPopup> was
  // only mounted in the session-with-words branch, so a dev-streak
  // click (or a real milestone) in the dashboard / guest branch set
  // `streakPopup` state but had nothing to render it. Now every render
  // branch mounts it from this shared fragment.
  const globalStreakPopup = streakPopup ? (
    <StreakPopup
      kind={streakPopup.kind}
      streak={streakPopup.streak}
      dismissAt={streakPopup.dismissAt}
      onDismissRef={dismissPopupRef}
    />
  ) : null;

  // ── Global auth modals (rendered in every branch that needs them) ──
  // Previously these were nested inside the main return only — meaning
  // the no-session dashboard branch couldn't show CreateChildProfile
  // post-signin. Hoisting them into a shared fragment fixes bug 1.
  const globalAuthModals = (
    <>
      {showSignIn && (
        <AuthModal
          initialView={signInView}
          onClose={() => setShowSignIn(false)}
          onSignedIn={() => setShowSignIn(false)}
        />
      )}
      {createChildOpen && authUser && (
        <CreateChildProfile
          authUser={authUser}
          prefill={guestPrefill}
          onCreated={handleChildCreated}
          onCancel={() => setCreateChildOpen(false)}
        />
      )}
      {/* ── Grown-up PIN gate (Prompt 2) ───────────────────────────
          Single source of truth for both "entry" (verify) and "setup"
          (create / change). Mounted globally so the gate can be
          triggered from ProfileSelector AND from inside the parent
          dashboard (Change PIN action). */}
      {pinGateMode === 'entry' && (
        <PINEntry
          title="Enter your PIN"
          subtitle="Tap in the 4-digit PIN to open the grown-up area."
          onSubmit={handlePinSubmit}
          onCancel={() => { setPinGateMode('closed'); setPinError(null); setPinNotice(null); }}
          onForgot={handlePinForgot}
          busy={pinBusy}
          errorMessage={pinNotice || pinError}
          noticeTone={pinNotice ? 'success' : 'error'}
        />
      )}
      {pinGateMode === 'locked' && (
        <PINLocked
          lockedUntil={pinLockUntil}
          onExpire={handlePinLockExpire}
          onReset={handlePinForgot}
          onClose={() => { setPinGateMode('closed'); setPinError(null); setPinNotice(null); }}
          busy={pinBusy}
          notice={pinNotice || pinError}
          noticeTone={pinNotice ? 'success' : 'error'}
        />
      )}
      {pinGateMode === 'setup' && (
        <PINSetup
          onSave={handlePinSave}
          onSkip={pinSetupMandatory ? undefined : handlePinSkip}
          onCancel={() => {
            // Back out of the gate without entering. Mandatory setup
            // leaves the parent safely OUTSIDE the grown-up area (no PIN
            // was set, so the area stays locked); the optional change-PIN
            // flow drops back to the dashboard with its PIN unchanged.
            setPinSetupMandatory(false);
            setPinError(null);
            if (pinSetupMandatory) {
              setPinGateMode('closed');
            } else {
              handlePinSkip();
            }
          }}
          isMandatory={pinSetupMandatory}
          busy={pinBusy}
        />
      )}

      {migrateChild && (
        <MigratePrompt
          child={migrateChild}
          user={user}
          guestStats={guestPrefill?._stats}
          guestStreak={guestPrefill?._streak}
          onDone={(result) => {
            // result: { ok: boolean, skipped?: boolean }. We only wipe
            // the guest data when the migration fully succeeded or the
            // parent explicitly skipped — never on partial failure.
            setMigrateChild(null);
            if (result?.ok || result?.skipped) {
              finaliseGuestWipe();
            }
            // If the migration wrote new totals back to the child row,
            // refresh the in-memory session so the footer points/lumens
            // reflect them, AND update childrenRows so that selecting this
            // card from ProfileSelector reads the migrated values rather
            // than the zero-value row that was appended at creation time.
            if (result?.refreshChild) {
              setChildrenRows((prev) =>
                prev.map((c) =>
                  c.id === result.refreshChild.id ? result.refreshChild : c
                )
              );
              setSession(sessionFromChild(result.refreshChild, {
                stats: guestPrefill?._stats,
                streak: guestPrefill?._streak,
              }));
            }
          }}
        />
      )}
      {settingsOpen && (
        <Settings
          userAge={session?.age || 8}
          year={session?.year ?? null}
          dyslexiaMode={session?.dyslexiaMode || false}
          spellingConfidence={session?.spellingConfidence || 'tricky'}
          adaptiveLearning={session?.adaptiveLearning !== false}
          childName={session?.childName || ''}
          childCharacter={session?.childCharacter || null}
          onUpdate={handleSettingsUpdate}
          onChangeWords={() => { setSettingsOpen(false); setSection('mylists'); setChangeWordsOpen(true); }}
          onClearProgress={handleClearProgress}
          /* Prompt 3 spec: ONE exit path from a signed-in child
             session — the Exit pill (top-right). So Settings only
             surfaces "Back to welcome" for GUEST sessions where the
             pill isn't rendered. Signed-in children get no
             alternate exit affordance. */
          onExit={(session && !authUser) ? handleBackToWelcome : undefined}
          onClose={() => setSettingsOpen(false)}
          authUser={authUser}
          onSignInClick={() => { setSettingsOpen(false); openAuth('signin'); }}
          onSignUpClick={() => { setSettingsOpen(false); openAuth('signup'); }}
          /* Prompt 3 (May 2026): sign-out is intentionally NOT passed
             when there's an active child session. The nuclear sign-out
             lives only in the Parent Dashboard (Prompt 2 area). For
             guest sessions (no authUser, no session.id) it's still
             accessible from the Welcome / AuthModal flows. */
          onSignOut={(!authUser || !session) ? signOut : undefined}
        />
      )}
    </>
  );

  // ── Activity screen ──────────────────────────────────────────────────────

  if (activeActivity && session) {
    const { id, overrideWords } = activeActivity;
    const { difficulty, dyslexiaMode = false, reviewQueue = [] } = session;
    // Test-All path replaces session.words with the unmastered list for the
    // duration of this run. handleComplete reads `isTestAll` straight off
    // activeActivity (no session mutation needed).
    const words = Array.isArray(overrideWords) && overrideWords.length > 0
      ? overrideWords
      : session.words;
    let Activity = null;

    if (id === 'review') {
      // Review is a special pseudo-activity — fixed component, not in the registry.
      Activity = (
        <SpellingQuiz
          words={reviewQueue.length > 0 ? reviewQueue : words}
          difficulty={difficulty}
          dyslexiaMode={dyslexiaMode}
          onComplete={(results) => handleComplete('review', results)}
          onExit={handleExit}
        />
      );
    } else {
      const activity = getActivity(id);
      // Refuse to render an activity that isn't available for this session.
      // (Today every activity is available; future paid/locked/age gates
      // route through utils/activityAvailability.js — see that file.)
      if (activity && isActivityAvailable(activity, { session, user })) {
        const Component  = activity.component;
        const extraProps = activity.buildProps ? activity.buildProps(session) : {};
        Activity = (
          <Component
            words={words}
            dyslexiaMode={dyslexiaMode}
            savedProgress={getActivityProgress(session, id)}
            onSaveProgress={(p) => handleSaveProgress(id, p)}
            onComplete={(results) => handleComplete(id, results || [])}
            onExit={handleExit}
            {...extraProps}
          />
        );
      }
    }

    if (Activity) {
      // Activities own their own header via <GameHeader>. Don't wrap in TopNav.
      // R2-04: the word list rides along in every game via a shared collapsible
      // panel, so the child can always glance back at the words being learnt.
      const panelWords = (id === 'review' && reviewQueue.length > 0) ? reviewQueue : words;
      return (
        <main className="app-game-main">
          {Activity}
          {exitToSelectorBtn}
          <GameWordPanel words={panelWords} userAge={session?.age || 8} />
        </main>
      );
    }
  }

  // ── Screen routing ───────────────────────────────────────────────────────

  if (screen === 'welcome') {
    return (
      <>
        <Welcome
          onStart={handleWelcomeStart}
          onSignIn={() => openAuth('signin')}
          onCreateAccount={() => openAuth('signup')}
        />
        {globalAuthModals}
        {globalStreakPopup}
      </>
    );
  }

  // ── Profile Selector (Prompt 3) ──────────────────────────────────
  // Landing screen for signed-in users (and an entry point for guests
  // when Prompt 1 fleshes it out). Tapping a child card adopts the
  // row and routes into the game; the parent card is the placeholder
  // for the PIN-gated parent dashboard (Prompt 2 wires that in).
  if (screen === 'profileSelector') {
    return (
      <>
        <ProfileSelector
          authUser={authUser}
          children={childrenRows}
          loading={childrenLoading}
          onSelectChild={handleSelectChild}
          onQuickStart={handleQuickStart}
          onOpenAuth={openAuth}
          onAddProfile={handleAddProfile}
          onParentEnter={() => {
            // Wired below in Prompt 2 — calls handleParentCardTap
            // which routes through the PIN gate.
            handleParentCardTap();
          }}
          onSignOut={signOut}
        />
        {globalAuthModals}
        {globalStreakPopup}
      </>
    );
  }
  if (screen === 'onboarding') {
    return (
      <>
        <OnboardingFlow onComplete={handleOnboardingComplete} />
        {globalAuthModals}
        {globalStreakPopup}
      </>
    );
  }

  // ── Grown-up area (Prompt 2) ─────────────────────────────────────
  // Reached only after the PIN gate clears. The dashboard exposes
  // sign-out (the nuclear control that lives only here) plus PIN
  // management. Future progress reports / parent-teacher exports
  // will land in this same screen.
  if (screen === 'parentDashboard') {
    return (
      <>
        <ParentDashboard
          authUser={authUser}
          hasPin={!!parentProfile?.parent_pin_hash}
          children={childrenRows}
          onEditChild={(updated) => {
            setChildrenRows((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            );
          }}
          onDeleteChild={(id) => {
            setChildrenRows((prev) => prev.filter((c) => c.id !== id));
          }}
          onChangePin={handleChangePin}
          onRemovePin={handleRemovePin}
          onSignOut={signOut}
          onBackToSelector={handleExitToSelector}
        />
        {globalAuthModals}
        {globalStreakPopup}
      </>
    );
  }

  if (!session || !session.words || session.words.length === 0) {
    // No session: render the dashboard so guests can browse Home / Explore /
    // Favourites etc. Onboarding is launched from inside those flows.
    const dashboardSections = ['home', 'hfwIsland', 'assignments', 'mylists', 'exploreDashboard', 'spellShop', 'favourites', 'recent', 'alerts', 'avatar'];
    if (dashboardSections.includes(section)) {
      const dashboardPage = section === 'exploreDashboard' ? 'explore' : section;
      return (
        <>
          <SpellifyLogo
            onHomeClick={() => { setSection('home'); setNavTick(t => t + 1); }}
            variant={(section === 'home' || section === 'hfwIsland') ? 'adventure' : undefined}
          />
          {section === 'hfwIsland' ? (
            <HFWIsland
              session={session}
              fromIsleId={hfwFromIsleId}
              onBack={(isleId) => { setSection('home'); setNavTick(t => t + 1); }}
              onOpenList={handleAdventureOpenList}
            />
          ) : section === 'home' ? (
            <AdventureMap
              session={session}
              onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
              onOpenList={handleAdventureOpenList}
              onGoToHFW={(isleId) => { setHfwFromIsleId(isleId); setSection('hfwIsland'); setNavTick(t => t + 1); }}
              initialIsleId={hfwFromIsleId}
            />
          ) : section === 'spellShop' ? (
            <SpellShop
              session={session}
              lumens={liveLumens}
              onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
            />
          ) : section === 'avatar' ? (
            <AvatarBuilder lumens={liveLumens} />
          ) : (
            <ExploreDashboard
              page={dashboardPage}
              navTick={navTick}
              session={session}
              user={user}
              profile={profile}
              signIn={signIn}
              signUp={signUp}
              signInWithGoogle={signInWithGoogle}
              onOpenSettings={() => setSettingsOpen(true)}
              pendingOpenList={pendingMapList}
              onPendingHandled={() => setPendingMapList(null)}
              onListExit={handleListExit}
            />
          )}
          <ArcadeFooter
            playerName={footerPlayerName}
            year={footerYear}
            isGuest={footerIsGuest}
            points={livePoints}
            lumens={liveLumens}
            level={liveLevel}
            levelTitle={`LVL ${liveLevel}`}
            xpCurrent={levelXp.current}
            xpMax={levelXp.max}
            buddyId={session?.childCharacter?.id || 'raccoon'}
            buddyFallback={session?.childCharacter?.emoji || '🦝'}
            section={section}
            onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
            onSettings={() => setSettingsOpen(true)}
          />
          <MobileBottomNav
            section={section}
            onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
            points={livePoints}
            lumens={liveLumens}
            level={liveLevel}
            levelTitle={`LVL ${liveLevel}`}
            xpCurrent={levelXp.current}
            xpMax={levelXp.max}
            buddyId={session?.childCharacter?.id || 'raccoon'}
            buddyFallback={session?.childCharacter?.emoji || '🦝'}
            onSignInClick={() => setShowSignIn(true)}
            onSignUpClick={() => setShowSignIn(true)}
            onSettingsClick={() => setSettingsOpen(true)}
          />
          {exitToSelectorBtn}
          {globalAuthModals}
        {globalStreakPopup}
        </>
      );
    }
    return (
      <>
        <OnboardingFlow onComplete={handleOnboardingComplete} />
        {globalAuthModals}
        {globalStreakPopup}
      </>
    );
  }

  return (
    <>
      {/* ── Top navigation (minimal — logo only, clicks → Home) ── */}
      <SpellifyLogo
        onHomeClick={() => { setSection('home'); setNavTick(t => t + 1); }}
        variant={(section === 'home' || section === 'hfwIsland') ? 'adventure' : undefined}
      />

      {/* ── Dashboard pages (home / assignments / mylists / explore /
            favourites / recent / alerts) ─ All routed through
            ExploreDashboard so they share the same purple starfield
            chrome + arcade-style headings on every viewport. */}
      {section === 'hfwIsland' ? (
        <HFWIsland
          session={session}
          fromIsleId={hfwFromIsleId}
          onBack={(isleId) => { setSection('home'); setNavTick(t => t + 1); }}
          onOpenList={handleAdventureOpenList}
        />
      ) : section === 'home' ? (
        <AdventureMap
          session={session}
          onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
          onOpenList={handleAdventureOpenList}
          onGoToHFW={(isleId) => { setHfwFromIsleId(isleId); setSection('hfwIsland'); setNavTick(t => t + 1); }}
          initialIsleId={hfwFromIsleId}
        />
      ) : section === 'spellShop' ? (
        <SpellShop
          session={session}
          lumens={liveLumens}
          onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
        />
      ) : section === 'avatar' ? (
        <AvatarBuilder lumens={liveLumens} />
      ) : (
        <ExploreDashboard
          page={section === 'exploreDashboard' ? 'explore' : section}
          navTick={navTick}
          session={session}
          user={user}
          profile={profile}
          signIn={signIn}
          signUp={signUp}
          signInWithGoogle={signInWithGoogle}
          onOpenSettings={() => setSettingsOpen(true)}
          pendingOpenList={pendingMapList}
          onPendingHandled={() => setPendingMapList(null)}
          onListExit={handleListExit}
        />
      )}

      {showExitModal && (
        <ExitConfirmModal
          onConfirm={confirmExit}
          onCancel={() => setShowExitModal(false)}
        />
      )}

      {/* ── Change Words modal ── */}
      {changeWordsOpen && session?.year != null && (
        <div className="hub-change-overlay" onClick={() => setChangeWordsOpen(false)}>
          <div className="hub-change-modal" onClick={(e) => e.stopPropagation()}>
            <button className="hub-change-close" onClick={() => setChangeWordsOpen(false)} aria-label="Close">✕</button>
            <GeneratedWords
              yearGroup={session.year}
              initialDyslexiaMode={session.dyslexiaMode || false}
              onConfirm={(payload) => { handleChangeWords(payload); setChangeWordsOpen(false); }}
            />
          </div>
        </div>
      )}

      {/* Auth + child-profile + migration modals (shared via
          `globalAuthModals` so every render branch mounts them) */}
      {globalAuthModals}
      {globalStreakPopup}

      {/* ── Arcade footer (nav + stats) ── */}
      <ArcadeFooter
        playerName={footerPlayerName}
        year={footerYear}
        isGuest={footerIsGuest}
        points={livePoints}
        lumens={liveLumens}
        level={liveLevel}
        levelTitle={`LVL ${liveLevel}`}
        xpCurrent={levelXp.current}
        xpMax={levelXp.max}
        buddyId={session?.childCharacter?.id || 'raccoon'}
        buddyFallback={session?.childCharacter?.emoji || '🦝'}
        section={section}
        onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
        onSettings={() => setSettingsOpen(true)}
      />
      <MobileBottomNav
        section={section}
        onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
        points={livePoints}
        lumens={liveLumens}
        level={liveLevel}
        levelTitle={`LVL ${liveLevel}`}
        xpCurrent={levelXp.current}
        xpMax={levelXp.max}
        buddyId={session?.childCharacter?.id || 'raccoon'}
        buddyFallback={session?.childCharacter?.emoji || '🦝'}
      />
      {exitToSelectorBtn}
    </>
  );
}

// ── Exit confirmation modal ────────────────────────────────────────────────

// ── Streak popup ───────────────────────────────────────────────────────────
// Centred above the mobile bottom-nav. Tap anywhere on the card to dismiss.
// If `autoDismiss` is a number it disappears after that many ms; otherwise
// (`at_risk`) it stays until the user taps it or starts a game.

function StreakPopup({ kind, streak, dismissAt, onDismissRef }) {
  // The React render path (both inline and via ReactDOM.createPortal)
  // was committing the popup to the DOM but never producing a visible
  // paint in the dashboard branch — the element existed at opacity:1
  // with a high z-index but was never rasterized. Imperative DOM
  // injection bypasses the React reconciler for the visible node and
  // paints immediately (verified by cloning the element into body
  // during debugging — the clone was always visible, the React node
  // never was).
  //
  // The hook below builds a plain DIV in document.body on mount,
  // attaches the click + auto-dismiss timer to it, and removes it on
  // unmount. The component returns null so React's reconciler has
  // nothing to manage.
  useEffect(() => {
    let icon = '🔥';
    let msg  = '';
    if (kind === 'milestone') {
      icon = '🎉';
      msg  = `${streak}-day streak! You're incredible!`;
    } else if (kind === 'played') {
      msg = `${streak}-day streak! You've already played today — amazing!`;
    } else if (kind === 'at_risk') {
      icon = '⚠️';
      msg  = `Your streak is at risk! Play today to save your ${streak}-day streak.`;
    } else if (kind === 'active') {
      msg = `${streak}-day streak! Play today to keep it going.`;
    }

    const el = document.createElement('div');
    el.className = `streak-popup streak-popup--${kind}`;
    el.setAttribute('role', 'status');
    el.innerHTML =
      `<span class="streak-popup__icon" aria-hidden="true">${icon}</span>` +
      `<span class="streak-popup__msg">${msg.replace(/[<>&]/g, (c) => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[c]))}</span>`;
    el.addEventListener('click', () => onDismissRef?.current?.());
    document.body.appendChild(el);

    let timer = null;
    if (dismissAt) {
      const remaining = dismissAt - Date.now();
      if (remaining <= 0) {
        onDismissRef?.current?.();
      } else {
        timer = setTimeout(() => onDismissRef?.current?.(), remaining);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
      el.remove();
    };
  }, [kind, streak, dismissAt, onDismissRef]);

  return null;
}

function ExitConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="exit-overlay" onClick={onCancel}>
      <div className="exit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="exit-modal-icon">⚠️</div>
        <h2 className="exit-modal-title">Are you sure?</h2>
        <p className="exit-modal-body">
          You'll lose your progress if you go back to the welcome screen.
        </p>
        <div className="exit-modal-btns">
          <button className="exit-btn exit-btn--cancel" onClick={onCancel}>
            Continue Learning
          </button>
          <button className="exit-btn exit-btn--confirm" onClick={onConfirm}>
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
