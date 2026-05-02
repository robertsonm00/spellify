import React, { useState } from 'react';
import './App.css';
import WordUpload from './components/WordUpload';

function App() {
  const [words, setWords] = useState([]);

  const handleWordsUploaded = (uploadedWords) => {
    setWords(uploadedWords);
    console.log('Words uploaded:', uploadedWords);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎯 Spellify</h1>
        <p>Learn to spell with fun interactive modes</p>
      </header>
      <main>
        <WordUpload onWordsUploaded={handleWordsUploaded} />
        {words.length > 0 && (
          <div className="words-preview">
            <h2>Words to Learn:</h2>
            <ul>
              {words.map((word, index) => (
                <li key={index}>{word}</li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;