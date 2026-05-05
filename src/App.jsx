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
import { loadSession, saveSession, createSession, INITIAL_STATUSES, updateMastery, rebuildReviewQueue } from './data/spelling/sessionSchema';

function hasProgress(activityStatuses) {
  return Object.values(activityStatuses || {}).some(
    (s) => s === 'in-progress' || s === 'completed'
  );
}

function App() {
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

  const handleOnboardingComplete = ({ year, age, words, wordObjects = [], dyslexiaMode = false, sourceMode = 'generated', difficulty }) => {
    setSession({
      ...createSession({ year, age, words, wordObjects, sourceMode, dyslexiaMode }),
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

  const handleChangeWords = ({ words, wordObjects = [], dyslexiaMode, sourceMode = 'generated' } = {}) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        words,
        wordObjects,
        sourceMode,
        dyslexiaMode: dyslexiaMode ?? prev.dyslexiaMode ?? false,
        activityStatuses: { ...INITIAL_STATUSES },
      };
      return rebuildReviewQueue(next);
    });
    setActiveActivity(null);
  };

  const handleSettingsUpdate = (updates) => setSession((prev) => ({ ...prev, ...updates }));
  const handleClearProgress  = () => setSession((prev) => ({ ...prev, activityStatuses: INITIAL_STATUSES, mastery: {}, reviewQueue: [] }));

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
          initialDifficulty={difficulty}
          dyslexiaMode={dyslexiaMode}
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
          onComplete={(results) => handleComplete('quizquest', results || [])}
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

    if (Activity) return <AppShell>{Activity}</AppShell>;
  }

  // ── Screen routing ───────────────────────────────────────────────────────

  if (screen === 'welcome')    return <Welcome onStart={handleWelcomeStart} />;
  if (screen === 'onboarding') return <OnboardingFlow onComplete={handleOnboardingComplete} />;

  if (!session || !session.words || session.words.length === 0) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      <AppShell>
        <WordListHub
          words={session.words}
          userAge={session.age || 8}
          year={session.year ?? null}
          dyslexiaMode={session.dyslexiaMode || false}
          difficulty={session.difficulty || 'medium'}
          activityStatuses={session.activityStatuses}
          mastery={session.mastery || {}}
          reviewQueue={session.reviewQueue || []}
          onLaunch={handleLaunch}
          onReview={() => handleLaunch('review')}
          onChangeWords={handleChangeWords}
          onSettingsUpdate={handleSettingsUpdate}
          onClearProgress={handleClearProgress}
          onBackToWelcome={handleBackToWelcome}
        />
      </AppShell>

      {showExitModal && (
        <ExitConfirmModal
          onConfirm={confirmExit}
          onCancel={() => setShowExitModal(false)}
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

function AppShell({ children }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-header-logo">🎯</span>
        <span className="app-header-title">Spellify</span>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}

export default App;
