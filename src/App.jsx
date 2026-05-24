import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Welcome        from './components/Welcome';
import OnboardingFlow from './components/OnboardingFlow';
import SpellingQuiz   from './components/SpellingQuiz';
import { loadSession, saveSession, createSession, INITIAL_STATUSES, updateMastery, rebuildReviewQueue, getActivityProgress, setActivityProgress } from './data/spelling/sessionSchema';
import { getActivity, getActivityTitle } from './data/activities';
import { isActivityAvailable } from './utils/activityAvailability';
import { recordGameCompleted, getPlayerStats } from './utils/gamificationEngine';
import TopNav         from './components/TopNav';
import { fireBuddyCheer } from './components/BuddyAvatar';
import ExploreDashboard from './components/explore/ExploreDashboard';
import ArcadeFooter from './components/ArcadeFooter';
import SignInModal    from './components/explore/SignInModal';
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
  // Increments on every top-nav tab click so ExploreDashboard can clear its
  // internal selectedList even when the user clicks the tab they're already on.
  const [navTick,        setNavTick]        = useState(0);
  const [showSignIn,     setShowSignIn]     = useState(false);
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

  const [session,        setSession]        = useState(() => loadSession());
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

  const handleWelcomeStart = () => setScreen('onboarding');

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

  if (screen === 'welcome')    return <Welcome onStart={handleWelcomeStart} />;
  if (screen === 'onboarding') return <OnboardingFlow onComplete={handleOnboardingComplete} />;

  if (!session || !session.words || session.words.length === 0) {
    // No session: render the dashboard so guests can browse Home / Explore /
    // Favourites etc. Onboarding is launched from inside those flows.
    const dashboardSections = ['home', 'assignments', 'mylists', 'exploreDashboard', 'favourites', 'recent'];
    if (dashboardSections.includes(section)) {
      const dashboardPage = section === 'exploreDashboard' ? 'explore' : section;
      return (
        <>
          <TopNav
            section={section}
            onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
            user={user}
            profile={profile}
            onSignInClick={() => setShowSignIn(true)}
            onSignOut={signOut}
            onExit={() => setScreen('welcome')}
            onSettings={() => setSettingsOpen(true)}
          />
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
          />
          <ArcadeFooter
            playerName="ERNEST-WREN"
            year={5}
            isGuest={true}
            points={livePoints}
            level={10}
            levelTitle="Grand Wordmancer"
            xpCurrent={650}
            xpMax={1000}
          />
        </>
      );
    }
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      {/* ── Top navigation ── */}
      <TopNav
        section={section}
        onSectionChange={(s) => { setSection(s); setNavTick(t => t + 1); }}
        user={user}
        profile={profile}
        onSignInClick={() => setShowSignIn(true)}
        onSignOut={signOut}
        onExit={handleBackToWelcome}
        onSettings={() => setSettingsOpen(true)}
      />

      {/* ── Dashboard pages (home / assignments / mylists / explore / favourites / recent) ── */}
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
      />

      {showExitModal && (
        <ExitConfirmModal
          onConfirm={confirmExit}
          onCancel={() => setShowExitModal(false)}
        />
      )}

      {/* ── Settings modal (triggered from TopNav settings button) ── */}
      {settingsOpen && session && (
        <Settings
          userAge={session.age || 8}
          year={session.year ?? null}
          dyslexiaMode={session.dyslexiaMode || false}
          spellingConfidence={session.spellingConfidence || 'tricky'}
          adaptiveLearning={session.adaptiveLearning !== false}
          childName={session.childName || ''}
          childCharacter={session.childCharacter || null}
          onUpdate={handleSettingsUpdate}
          onChangeWords={() => { setSettingsOpen(false); setSection('mylists'); setChangeWordsOpen(true); }}
          onClearProgress={handleClearProgress}
          onClose={() => setSettingsOpen(false)}
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

      {/* ── Global sign-in modal (triggered from TopNav) ── */}
      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          signIn={signIn}
          signUp={signUp}
          signInWithGoogle={signInWithGoogle}
        />
      )}

      {/* ── Arcade footer (placeholder values for now) ── */}
      <ArcadeFooter
        playerName="ERNEST-WREN"
        year={5}
        isGuest={true}
        points={livePoints}
        level={10}
        levelTitle="Grand Wordmancer"
        xpCurrent={650}
        xpMax={1000}
      />
    </>
  );
}

// ── Exit confirmation modal ────────────────────────────────────────────────

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
