import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Welcome        from './components/Welcome';
import OnboardingFlow from './components/OnboardingFlow';
import SpellingQuiz   from './components/SpellingQuiz';
import { loadSession, saveSession, createSession, INITIAL_STATUSES, updateMastery, rebuildReviewQueue, getActivityProgress, setActivityProgress } from './data/spelling/sessionSchema';
import { getActivity, getActivityTitle } from './data/activities';
import { isActivityAvailable } from './utils/activityAvailability';
import { recordGameCompleted, getPlayerStats, getLevelFromPoints } from './utils/gamificationEngine';
import { recordPlayToday, getStreak, getStreakStatus } from './utils/streakEngine';
import SpellifyLogo   from './components/SpellifyLogo';
import { fireBuddyCheer } from './components/BuddyAvatar';
import ExploreDashboard from './components/explore/ExploreDashboard';
import AdventureMap from './components/AdventureMap';
import ArcadeFooter from './components/ArcadeFooter';
import MobileBottomNav from './components/MobileBottomNav';
import MobileTopBar from './components/MobileTopBar';
import AuthModal      from './components/auth/AuthModal';
import CreateChildProfile from './components/auth/CreateChildProfile';
import MigratePrompt, { hasLocalMastery } from './components/auth/MigratePrompt';
import { getSession, onAuthStateChange } from './lib/auth';
import { supabase, isSupabaseEnabled } from './lib/supabase';
import Settings       from './components/Settings';
import { GeneratedWords } from './components/OnboardingFlow';
import { useUser }    from './hooks/useUser';

function hasProgress(activityStatuses) {
  return Object.values(activityStatuses || {}).some(
    (s) => s === 'in-progress' || s === 'completed'
  );
}

// Title for the Review pseudo-activity (real activities pull their title
// from the canonical registry via getActivityTitle()).
const REVIEW_TITLE = 'Spelling Quiz';

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

  useEffect(() => {
  let cancelled = false;
  getSession().then((s) => { if (!cancelled) setAuthUser(s?.user ?? null); });
  
  const unsub = onAuthStateChange((session, event) => {
  if (cancelled) return;
  setAuthUser(session?.user ?? null);
  if (event === 'SIGNED_IN' && session?.user) {
    // Close the modal AND advance past the welcome screen. Otherwise
    // the user lands back on the same welcome view and nothing
    // visible changes after a successful sign-in.
    setShowSignIn(false);
    setScreen((prev) => (prev === 'welcome' ? 'hub' : prev));
    setSection('home');
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
      try {
        const { data, error: err } = await supabase
          .from('children')
          .select('id')
          .eq('parent_id', authUser.id)
          .limit(1);
        if (cancelled) return;
        if (!err && Array.isArray(data) && data.length === 0) {
          // Wipe guest state before showing the child-creation modal so
          // the dashboard / footer behind it doesn't render the previous
          // guest's points, lumens, session, or streak.
          try {
            localStorage.removeItem('spellify_session_v2');
            localStorage.removeItem('spellify_session');         // legacy key
            localStorage.removeItem('spellify_player_stats');    // points + lumens
            localStorage.removeItem('spellify_streak');
            localStorage.removeItem('spellify_explore_recent');
            localStorage.removeItem('spellify_explore_favourites');
          } catch { /* storage full / disabled — ignore */ }
          setSession(null);
          setPointsTick((t) => t + 1);   // force getPlayerStats() re-read → 0/0
          setCreateChildOpen(true);
        }
      } catch { /* offline — skip silently */ }
    })();
    return () => { cancelled = true; };
    // setSession / setPointsTick are stable React setters; including
    // them in deps would TDZ since they're declared further down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  // After child profile creation, offer to migrate local mastery rows
  // (only if there's anything to migrate).
  const handleChildCreated = (child) => {
    setCreateChildOpen(false);
    if (child && hasLocalMastery()) setMigrateChild(child);
  };
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
  const liveLevel  = React.useMemo(() => getLevelFromPoints(livePoints), [livePoints]);

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
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({
          particleCount: 160,
          spread: 110,
          origin: { y: 0.45 },
          colors: ['#ffd93d', '#ff9f43', '#c77dff', '#6bcb77', '#4d96ff', '#ff6b6b'],
        });
      }).catch(() => {});
      setStreakPopup({ kind: 'milestone', streak: m, dismissAt: Date.now() + 4500 });
    };
    window.addEventListener('spellify-streak-milestone', onMilestone);
    return () => window.removeEventListener('spellify-streak-milestone', onMilestone);
  }, []);

  const [session,        setSession]        = useState(() => loadSession());

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
  const [isFirstVisit,   setIsFirstVisit]   = useState(false);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  // Apply/remove extra-support body class whenever dyslexiaMode changes
  useEffect(() => {
    document.body.classList.toggle('extra-support', !!(session?.dyslexiaMode));
  }, [session?.dyslexiaMode]);

  const handleWelcomeStart = () => {
    // Brand-new profile via Quick Start → wipe ALL leftover guest data
    // so old custom lists, mastery, points etc. from a previous local
    // session don't bleed into the new one. We don't touch sb-* (Supabase
    // auth) keys — a signed-in parent choosing Quick Start would already
    // have been signed out via the welcome flow.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('spellify_'))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    setSession(null);
    setPointsTick((t) => t + 1);   // force getPlayerStats() re-read → 0
    setScreen('onboarding');
  };

  const handleOnboardingComplete = ({ name, character, year, age, words, wordObjects = [], dyslexiaMode = false, sourceMode = 'generated', ruleKey = null, ruleLabel = null, difficulty, spellingConfidence = 'tricky', senProfile = [] }) => {
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
    setSection('mylists');
    setScreen('hub');
    setTimeout(fireBuddyCheer, 600);
  };

  const handleLaunch = (id, opts = {}) => {
    // Don't mark as in-progress on launch — only after the child has actually
    // completed at least one word. That bump happens in handleSaveProgress
    // once the snapshot shows real progress.
    //
    // `opts.words` overrides session.words for this launch (used by Test All
    // to send the whole unmastered list). `opts.isTestAll` flags the run so
    // gamification points the streak / badge bonus.
    //
    // Resuming: if there's an in-progress snapshot for this activity, the
    // word list it was started with takes precedence over a freshly-computed
    // active window — otherwise mastery shifts could drop or reorder words
    // mid-game and break the saved index.
    const existing = getActivityProgress(session, id);
    const lockedWords = existing?._words;
    const words = (Array.isArray(lockedWords) && lockedWords.length > 0)
      ? lockedWords
      : opts.words;
    setActiveActivity({ id, overrideWords: words, isTestAll: !!opts.isTestAll });
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

  const handleSettingsUpdate = (updates) => setSession((prev) => ({ ...prev, ...updates }));
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

  const handleBackToWelcome = () => {
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
          onCreated={handleChildCreated}
          onCancel={() => setCreateChildOpen(false)}
        />
      )}
      {migrateChild && (
        <MigratePrompt
          child={migrateChild}
          onDone={() => setMigrateChild(null)}
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
    let title    = '';

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
      title = REVIEW_TITLE;
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
        title = getActivityTitle(id);
      }
    }

    if (Activity) {
      // Activities own their own header via <GameHeader>. Don't wrap in TopNav.
      return <main className="app-game-main">{Activity}</main>;
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
      </>
    );
  }
  if (screen === 'onboarding') {
    return (
      <>
        <OnboardingFlow onComplete={handleOnboardingComplete} />
        {globalAuthModals}
      </>
    );
  }

  if (!session || !session.words || session.words.length === 0) {
    // No session: render the dashboard so guests can browse Home / Explore /
    // Favourites etc. Onboarding is launched from inside those flows.
    const dashboardSections = ['home', 'assignments', 'mylists', 'exploreDashboard', 'favourites', 'recent', 'alerts'];
    if (dashboardSections.includes(section)) {
      const dashboardPage = section === 'exploreDashboard' ? 'explore' : section;
      return (
        <>
          <SpellifyLogo
            onHomeClick={() => { setSection('home'); setNavTick(t => t + 1); }}
          />
          <MobileTopBar />
          {section === 'home' ? (
            <AdventureMap
              session={session}
              onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
              onOpenList={handleAdventureOpenList}
            />
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
            xpCurrent={650}
            xpMax={1000}
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
            xpCurrent={650}
            xpMax={1000}
            buddyId={session?.childCharacter?.id || 'raccoon'}
            buddyFallback={session?.childCharacter?.emoji || '🦝'}
            onSignInClick={() => setShowSignIn(true)}
            onSignUpClick={() => setShowSignIn(true)}
            onSettingsClick={() => setSettingsOpen(true)}
          />
          {globalAuthModals}
        </>
      );
    }
    return (
      <>
        <OnboardingFlow onComplete={handleOnboardingComplete} />
        {globalAuthModals}
      </>
    );
  }

  return (
    <>
      {/* ── Top navigation (minimal — logo only, clicks → Home) ── */}
      <SpellifyLogo
        onHomeClick={() => { setSection('home'); setNavTick(t => t + 1); }}
      />
      <MobileTopBar
        onSignInClick={() => setShowSignIn(true)}
        onSignUpClick={() => setShowSignIn(true)}
        onSettingsClick={() => setSettingsOpen(true)}
        onNavigate={(key) => { setSection(key); setNavTick(t => t + 1); }}
      />

      {/* ── Dashboard pages (home / assignments / mylists / explore /
            favourites / recent / alerts) ─ All routed through
            ExploreDashboard so they share the same purple starfield
            chrome + arcade-style headings on every viewport. */}
      {section === 'home' ? (
        <AdventureMap
          session={session}
          onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
          onOpenList={handleAdventureOpenList}
        />
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

      {/* ── Settings modal (triggered from footer profile icon) ──
          Available whether or not there's a session — guests need it
          to access Sign In / Sign Up, which now lives here. */}
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
          onExit={handleBackToWelcome}
          onClose={() => setSettingsOpen(false)}
          authUser={authUser}
          onSignInClick={() => { setSettingsOpen(false); openAuth('signin'); }}
          onSignOut={signOut}
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

      {/* ── Streak popup — once per app open, plus milestones ── */}
      {streakPopup && (
        <StreakPopup
          kind={streakPopup.kind}
          streak={streakPopup.streak}
          dismissAt={streakPopup.dismissAt}
          onDismissRef={dismissPopupRef}
        />
      )}

      {/* ── Arcade footer (nav + stats) ── */}
      <ArcadeFooter
        playerName={footerPlayerName}
        year={footerYear}
        isGuest={footerIsGuest}
        points={livePoints}
        lumens={liveLumens}
        level={liveLevel}
        levelTitle={`LVL ${liveLevel}`}
        xpCurrent={650}
        xpMax={1000}
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
        xpCurrent={650}
        xpMax={1000}
        buddyId={session?.childCharacter?.id || 'raccoon'}
        buddyFallback={session?.childCharacter?.emoji || '🦝'}
      />
    </>
  );
}

// ── Exit confirmation modal ────────────────────────────────────────────────

// ── Streak popup ───────────────────────────────────────────────────────────
// Centred above the mobile bottom-nav. Tap anywhere on the card to dismiss.
// If `autoDismiss` is a number it disappears after that many ms; otherwise
// (`at_risk`) it stays until the user taps it or starts a game.

function StreakPopup({ kind, streak, dismissAt, onDismissRef }) {
  // Use an absolute deadline (epoch ms) — if the parent re-renders
  // and this effect re-runs, it computes `remaining` from `dismissAt`
  // and schedules a SHORTER timer, not a fresh full-length one. That
  // means the popup can't be kept alive forever by parent churn, and
  // also can't be dismissed early by StrictMode's mount-unmount-mount
  // in dev. `dismissAt == null` → sticky (at_risk).
  // onDismissRef is a stable ref; reading .current inside the timer
  // avoids the dep-array thrash that the old `onDismiss` prop caused.
  useEffect(() => {
    if (!dismissAt) return;
    const remaining = dismissAt - Date.now();
    if (remaining <= 0) {
      onDismissRef?.current?.();
      return;
    }
    const t = setTimeout(() => onDismissRef?.current?.(), remaining);
    return () => clearTimeout(t);
  }, [dismissAt, onDismissRef]);

  const handleTap = () => { onDismissRef?.current?.(); };

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

  return (
    <div
      className={`streak-popup streak-popup--${kind}`}
      role="status"
      onClick={handleTap}
    >
      <span className="streak-popup__icon" aria-hidden="true">{icon}</span>
      <span className="streak-popup__msg">{msg}</span>
    </div>
  );
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
