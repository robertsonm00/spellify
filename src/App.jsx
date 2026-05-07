import React, { useState, useEffect } from 'react';
import './App.css';
import Welcome        from './components/Welcome';
import OnboardingFlow from './components/OnboardingFlow';
import WordListHub    from './components/WordListHub';
import WordSearch     from './components/WordSearch';
import SpellingQuiz   from './components/SpellingQuiz';
import Hangman        from './components/Hangman';
import Crossword      from './components/Crossword';
import WriteIt        from './components/WriteIt';
import MemorySpell    from './components/MemorySpell';
import QuizQuest      from './components/QuizQuest';
import SyllableTap    from './components/activities/SyllableTap';
import WordForge      from './components/activities/WordForge';
import WeakSpot       from './components/activities/WeakSpot';
import { loadSession, saveSession, createSession, INITIAL_STATUSES, updateMastery, rebuildReviewQueue, getActivityProgress, setActivityProgress } from './data/spelling/sessionSchema';
import TopNav         from './components/TopNav';
import ExplorePage    from './components/explore/ExplorePage';
import SignInModal    from './components/explore/SignInModal';
import Settings       from './components/Settings';
import { GeneratedWords } from './components/OnboardingFlow';
import { useUser }    from './hooks/useUser';

function hasProgress(activityStatuses) {
  return Object.values(activityStatuses || {}).some(
    (s) => s === 'in-progress' || s === 'completed'
  );
}

const GAME_TITLES = {
  wordsearch:  'Word Search',
  memoryspell: 'Memory Spell',
  hangman:     'Hangman',
  syllabletap: 'Syllable Tap',
  crossword:   'Crossword',
  writeit:     'Write It',
  weakspot:    'Weak Spot',
  quizquest:   'Quiz Quest',
  wordforge:   'Word Forge',
  review:      'Spelling Quiz',
};

function App() {
  const [section,        setSection]        = useState('myWords'); // 'myWords' | 'explore'
  const [showSignIn,     setShowSignIn]     = useState(false);
  const [settingsOpen,     setSettingsOpen]     = useState(false);
  const [changeWordsOpen,  setChangeWordsOpen]  = useState(false);
  const { user, profile, signIn, signUp, signInWithGoogle, signOut } = useUser();

  const [session,        setSession]        = useState(() => loadSession());
  const [screen,         setScreen]         = useState(() => {
    const s = loadSession();
    return s && s.words && s.words.length > 0 ? 'hub' : 'welcome';
  });
  const [activeActivity, setActiveActivity] = useState(null);
  const [showExitModal,  setShowExitModal]  = useState(false);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  // Apply/remove extra-support body class whenever dyslexiaMode changes
  useEffect(() => {
    document.body.classList.toggle('extra-support', !!(session?.dyslexiaMode));
  }, [session?.dyslexiaMode]);

  const handleWelcomeStart = () => setScreen('onboarding');

  const handleOnboardingComplete = ({ name, character, year, age, words, wordObjects = [], dyslexiaMode = false, sourceMode = 'generated', ruleKey = null, ruleLabel = null, difficulty }) => {
    setSession({
      ...createSession({ year, age, words, wordObjects, sourceMode, dyslexiaMode, ruleKey, ruleLabel }),
      childName: name || '',
      childCharacter: character || null,
      difficulty: difficulty || 'medium',
      activityStatuses: INITIAL_STATUSES,
    });
    setScreen('hub');
  };

  const handleLaunch = (id) => {
    if (id !== 'review') {
      setSession((prev) => ({
        ...prev,
        activityStatuses: {
          ...prev.activityStatuses,
          [id]: prev.activityStatuses[id] === 'not-started' ? 'in-progress' : prev.activityStatuses[id],
        },
      }));
    }
    setActiveActivity({ id });
  };

  const handleComplete = (id, results = []) => {
    setSession((prev) => {
      // Mark activity as completed (review doesn't affect activityStatuses)
      let next = id === 'review'
        ? { ...prev }
        : { ...prev, activityStatuses: { ...prev.activityStatuses, [id]: 'completed' } };
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
      };
      return rebuildReviewQueue(next);
    });
    setActiveActivity(null);
  };

  const handleSettingsUpdate = (updates) => setSession((prev) => ({ ...prev, ...updates }));
  const handleClearProgress  = () => setSession((prev) => ({ ...prev, activityStatuses: INITIAL_STATUSES, activityProgress: {}, mastery: {}, reviewQueue: [] }));

  const handleSaveProgress = (id, progress) =>
    setSession((prev) => setActivityProgress(prev, id, progress));

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
    const { id }                     = activeActivity;
    const { words, difficulty, age, dyslexiaMode = false, reviewQueue = [] } = session;
    let Activity = null;

    if (id === 'wordsearch') {
      Activity = (
        <WordSearch
          words={words}
          dyslexiaMode={dyslexiaMode}
          hideTopbar
          savedProgress={getActivityProgress(session, 'wordsearch')}
          onSaveProgress={(p) => handleSaveProgress('wordsearch', p)}
          onComplete={(results) => handleComplete('wordsearch', results)}
          onExit={handleExit}
        />
      );
    } else if (id === 'memoryspell') {
      Activity = (
        <MemorySpell
          words={words}
          wordObjects={session.wordObjects || []}
          dyslexiaMode={dyslexiaMode}
          hideTopbar
          savedProgress={getActivityProgress(session, 'memoryspell')}
          onSaveProgress={(p) => handleSaveProgress('memoryspell', p)}
          onComplete={(results) => handleComplete('memoryspell', results)}
          onExit={handleExit}
        />
      );
    } else if (id === 'hangman') {
      Activity = (
        <Hangman
          words={words}
          difficulty={difficulty}
          dyslexiaMode={dyslexiaMode}
          hideTopbar
          savedProgress={getActivityProgress(session, 'hangman')}
          onSaveProgress={(p) => handleSaveProgress('hangman', p)}
          onComplete={(results) => handleComplete('hangman', results)}
          onExit={handleExit}
        />
      );
    } else if (id === 'crossword') {
      Activity = (
        <Crossword
          words={words}
          userAge={age || 8}
          difficulty={difficulty}
          dyslexiaMode={dyslexiaMode}
          hideTopbar
          savedProgress={getActivityProgress(session, 'crossword')}
          onSaveProgress={(p) => handleSaveProgress('crossword', p)}
          onComplete={(results) => handleComplete('crossword', results || [])}
          onExit={handleExit}
        />
      );
    } else if (id === 'writeit') {
      Activity = (
        <WriteIt
          words={words}
          childName={session.childName || ''}
          dyslexiaMode={dyslexiaMode}
          hideTopbar
          savedProgress={getActivityProgress(session, 'writeit')}
          onSaveProgress={(p) => handleSaveProgress('writeit', p)}
          onComplete={(results) => handleComplete('writeit', results || [])}
          onExit={handleExit}
        />
      );
    } else if (id === 'quizquest') {
      Activity = (
        <QuizQuest
          words={words}
          wordObjects={session.wordObjects || []}
          dyslexiaMode={dyslexiaMode}
          hideTopbar
          savedProgress={getActivityProgress(session, 'quizquest')}
          onSaveProgress={(p) => handleSaveProgress('quizquest', p)}
          onComplete={(results) => handleComplete('quizquest', results || [])}
          onExit={handleExit}
        />
      );
    } else if (id === 'syllabletap') {
      Activity = (
        <SyllableTap
          words={words}
          dyslexiaMode={dyslexiaMode}
          onComplete={(results) => handleComplete('syllabletap', results || [])}
          onExit={handleExit}
        />
      );
    } else if (id === 'wordforge') {
      Activity = (
        <WordForge
          words={words}
          dyslexiaMode={dyslexiaMode}
          onComplete={(results) => handleComplete('wordforge', results || [])}
          onExit={handleExit}
        />
      );
    } else if (id === 'weakspot') {
      Activity = (
        <WeakSpot
          words={words}
          dyslexiaMode={dyslexiaMode}
          onComplete={(results) => handleComplete('weakspot', results || [])}
          onExit={handleExit}
        />
      );
    } else if (id === 'review') {
      Activity = (
        <SpellingQuiz
          words={reviewQueue.length > 0 ? reviewQueue : words}
          difficulty={difficulty}
          dyslexiaMode={dyslexiaMode}
          onComplete={(results) => handleComplete('review', results)}
          onExit={handleExit}
        />
      );
    }

    if (Activity) {
      return (
        <>
          <TopNav
            user={user}
            profile={profile}
            onSignInClick={() => setShowSignIn(true)}
            onSignOut={signOut}
            onExit={handleExit}
            gameTitle={GAME_TITLES[id] || ''}
          />
          <main className="app-game-main">{Activity}</main>
        </>
      );
    }
  }

  // ── Screen routing ───────────────────────────────────────────────────────

  if (screen === 'welcome')    return <Welcome onStart={handleWelcomeStart} />;
  if (screen === 'onboarding') return <OnboardingFlow onComplete={handleOnboardingComplete} />;

  if (!session || !session.words || session.words.length === 0) {
    // Show Explore even without a session — welcome screen not needed if they go via Explore
    if (section === 'explore') {
      return (
        <>
          <TopNav
            section={section}
            onSectionChange={(s) => { setSection(s); if (s === 'myWords') setScreen('welcome'); }}
            user={user}
            profile={profile}
            onSignInClick={() => setShowSignIn(true)}
            onSignOut={signOut}
            onExit={() => setScreen('welcome')}
          />
          <ExplorePage
            user={user}
            profile={profile}
            signIn={signIn}
            signUp={signUp}
            signInWithGoogle={signInWithGoogle}
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
        onSectionChange={setSection}
        user={user}
        profile={profile}
        onSignInClick={() => setShowSignIn(true)}
        onSignOut={signOut}
        onExit={handleBackToWelcome}
        onSettings={() => setSettingsOpen(true)}
      />

      {/* ── My Words ── */}
      {section === 'myWords' && (
        <>
          <AppShell hideHeader>
            <WordListHub
              words={session.words}
              userAge={session.age || 8}
              year={session.year ?? null}
              ruleLabel={session.ruleLabel || null}
              dyslexiaMode={session.dyslexiaMode || false}
              difficulty={session.difficulty || 'medium'}
              activityStatuses={session.activityStatuses}
              mastery={session.mastery || {}}
              reviewQueue={session.reviewQueue || []}
              childName={session.childName || ''}
              childCharacter={session.childCharacter || null}
              onLaunch={handleLaunch}
              onReview={() => handleLaunch('review')}
              onChangeWords={handleChangeWords}
              onSettingsUpdate={handleSettingsUpdate}
              onClearProgress={handleClearProgress}
              onBackToWelcome={handleBackToWelcome}
              onOpenChangeWords={() => setChangeWordsOpen(true)}
            />
          </AppShell>

          {showExitModal && (
            <ExitConfirmModal
              onConfirm={confirmExit}
              onCancel={() => setShowExitModal(false)}
            />
          )}
        </>
      )}

      {/* ── Explore ── */}
      {section === 'explore' && (
        <ExplorePage
          user={user}
          profile={profile}
          signIn={signIn}
          signUp={signUp}
          signInWithGoogle={signInWithGoogle}
        />
      )}

      {/* ── Settings modal (triggered from TopNav settings button) ── */}
      {settingsOpen && session && (
        <Settings
          userAge={session.age || 8}
          year={session.year ?? null}
          dyslexiaMode={session.dyslexiaMode || false}
          childName={session.childName || ''}
          childCharacter={session.childCharacter || null}
          onUpdate={handleSettingsUpdate}
          onChangeWords={() => { setSettingsOpen(false); setSection('myWords'); setChangeWordsOpen(true); }}
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
              showSupportToggle={false}
              confirmLabel="Use these words ▶"
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

// ── App shell ─────────────────────────────────────────────────────────────

function AppShell({ children, hideHeader = false }) {
  return (
    <div className="app-shell">
      {!hideHeader && (
        <header className="app-header">
          <span className="app-header-logo">🎯</span>
          <span className="app-header-title">Spellify</span>
        </header>
      )}
      <main className="app-main">{children}</main>
    </div>
  );
}

export default App;
