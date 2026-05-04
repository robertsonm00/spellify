import React, { useState, useEffect } from 'react';
import './App.css';
import Welcome       from './components/Welcome';
import OnboardingFlow from './components/OnboardingFlow';
import WordListHub   from './components/WordListHub';
import WordSearch    from './components/WordSearch';
import SpellingQuiz  from './components/SpellingQuiz';
import Hangman       from './components/Hangman';
import Crossword     from './components/Crossword';

const STORAGE_KEY = 'spellify_session_v1';
const INITIAL_STATUSES = {
  wordsearch: 'not-started',
  quiz:       'not-started',
  hangman:    'not-started',
  crossword:  'not-started',
};

function loadSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { return null; }
}

function App() {
  const [session, setSession] = useState(() => loadSession());
  const [screen,  setScreen]  = useState(() => {
    const s = loadSession();
    return s && s.words && s.words.length > 0 ? 'hub' : 'welcome';
  });
  const [activeActivity, setActiveActivity] = useState(null);

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  const handleWelcomeStart = () => setScreen('onboarding');

  const handleOnboardingComplete = ({ age, year, words, difficulty }) => {
    const newSession = {
      age,
      year,
      difficulty: difficulty || 'medium',
      words,
      activityStatuses: INITIAL_STATUSES,
    };
    setSession(newSession);
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

  const handleSettingsUpdate = (updates) => {
    setSession((prev) => ({ ...prev, ...updates }));
  };

  const handleClearProgress = () => {
    setSession((prev) => ({ ...prev, activityStatuses: INITIAL_STATUSES }));
  };

  // Activity screen
  if (activeActivity && session) {
    const { id }                  = activeActivity;
    const { words, difficulty, age } = session;
    let Activity = null;

    if (id === 'wordsearch') {
      Activity = (
        <WordSearch
          words={words}
          initialDifficulty={difficulty}
          onComplete={() => handleComplete('wordsearch')}
          onExit={handleExit}
        />
      );
    } else if (id === 'quiz') {
      Activity = (
        <SpellingQuiz
          words={words}
          difficulty={difficulty}
          onComplete={() => handleComplete('quiz')}
          onExit={handleExit}
        />
      );
    } else if (id === 'hangman') {
      Activity = (
        <Hangman
          words={words}
          difficulty={difficulty}
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
          onComplete={() => handleComplete('crossword')}
          onExit={handleExit}
        />
      );
    }

    if (Activity) return <AppShell>{Activity}</AppShell>;
  }

  if (screen === 'welcome')    return <Welcome onStart={handleWelcomeStart} />;
  if (screen === 'onboarding') return <OnboardingFlow onComplete={handleOnboardingComplete} />;

  if (!session || !session.words || session.words.length === 0) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
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
      />
    </AppShell>
  );
}

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
