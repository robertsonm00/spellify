import React, { useState, useEffect } from 'react';
import './App.css';
import Welcome        from './components/Welcome';
import OnboardingFlow from './components/OnboardingFlow';
import WordListHub    from './components/WordListHub';
import WordSearch     from './components/WordSearch';
import SpellingQuiz   from './components/SpellingQuiz';
import Hangman        from './components/Hangman';
import Crossword      from './components/Crossword';
import { loadSession, saveSession, createSession, INITIAL_STATUSES } from './data/spelling/sessionSchema';

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
    setSession((prev) => ({
      ...prev,
      activityStatuses: {
        ...prev.activityStatuses,
        [id]: prev.activityStatuses[id] === 'not-started' ? 'in-progress' : prev.activityStatuses[id],
      },
    }));
    setActiveActivity({ id });
  };

  const handleComplete = (id) => {
    setSession((prev) => ({
      ...prev,
      activityStatuses: { ...prev.activityStatuses, [id]: 'completed' },
    }));
    setActiveActivity(null);
  };

  const handleExit = () => setActiveActivity(null);

  const handleChangeWords = () => {
    setSession((prev) => prev ? { ...prev, words: [], activityStatuses: INITIAL_STATUSES } : null);
    setActiveActivity(null);
    setScreen('onboarding');
  };

  const handleSettingsUpdate = (updates) => setSession((prev) => ({ ...prev, ...updates }));
  const handleClearProgress  = () => setSession((prev) => ({ ...prev, activityStatuses: INITIAL_STATUSES }));

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
    const { words, difficulty, age, dyslexiaMode = false } = session;
    let Activity = null;

    if (id === 'wordsearch') {
      Activity = (
        <WordSearch
          words={words}
          initialDifficulty={difficulty}
          dyslexiaMode={dyslexiaMode}
          onComplete={() => handleComplete('wordsearch')}
          onExit={handleExit}
        />
      );
    } else if (id === 'quiz') {
      Activity = (
        <SpellingQuiz
          words={words}
          difficulty={difficulty}
          dyslexiaMode={dyslexiaMode}
          onComplete={() => handleComplete('quiz')}
          onExit={handleExit}
        />
      );
    } else if (id === 'hangman') {
      Activity = (
        <Hangman
          words={words}
          difficulty={difficulty}
          dyslexiaMode={dyslexiaMode}
          onComplete={() => handleComplete('hangman')}
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
          onComplete={() => handleComplete('crossword')}
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
          difficulty={session.difficulty || 'medium'}
          activityStatuses={session.activityStatuses}
          onLaunch={handleLaunch}
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
