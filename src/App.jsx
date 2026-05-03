import React, { useState } from 'react';
import './App.css';
import WordUpload   from './components/WordUpload';
import WordListHub  from './components/WordListHub';
import WordSearch   from './components/WordSearch';
import SpellingQuiz from './components/SpellingQuiz';
import Hangman      from './components/Hangman';

const INITIAL_STATUSES = {
  wordsearch: 'not-started',
  quiz:       'not-started',
  hangman:    'not-started',
  crossword:  'not-started',
};

function App() {
  const [words,            setWords]            = useState([]);
  const [activeActivity,   setActiveActivity]   = useState(null); // { id, difficulty } | null
  const [activityStatuses, setActivityStatuses] = useState(INITIAL_STATUSES);

  const handleLaunch = (id, difficulty) => {
    setActivityStatuses((prev) => ({
      ...prev,
      [id]: prev[id] === 'not-started' ? 'in-progress' : prev[id],
    }));
    setActiveActivity({ id, difficulty });
  };

  const handleComplete = (id) => {
    setActivityStatuses((prev) => ({ ...prev, [id]: 'completed' }));
    setActiveActivity(null);
  };

  const handleExit = () => setActiveActivity(null);

  const handleChangeWords = () => {
    setWords([]);
    setActiveActivity(null);
    setActivityStatuses(INITIAL_STATUSES);
  };

  // ── Routing ──
  if (words.length === 0) {
    return (
      <AppShell>
        <WordUpload onWordsUploaded={setWords} />
      </AppShell>
    );
  }

  if (activeActivity) {
    const { id, difficulty } = activeActivity;
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
    }

    if (Activity) return <AppShell>{Activity}</AppShell>;
  }

  return (
    <AppShell>
      <WordListHub
        words={words}
        activityStatuses={activityStatuses}
        onLaunch={handleLaunch}
        onChangeWords={handleChangeWords}
      />
    </AppShell>
  );
}

function AppShell({ children }) {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🎯 Spellify</h1>
        <p>Learn to spell with fun interactive modes</p>
      </header>
      <main>{children}</main>
    </div>
  );
}

export default App;
