import React, { useState } from 'react';
import './WordUpload.css';

function WordUpload({ onWordsUploaded }) {
  const [words, setWords] = useState('');
  const [uploadedWords, setUploadedWords] = useState([]);

  const handleInputChange = (e) => {
    setWords(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Split by newline and filter empty lines
    const wordList = words
      .split('\n')
      .map(word => word.trim())
      .filter(word => word.length > 0);

    if (wordList.length === 0) {
      alert('Please enter at least one word');
      return;
    }

    if (wordList.length > 50) {
      alert('Maximum 50 words allowed');
      return;
    }

    setUploadedWords(wordList);
    onWordsUploaded(wordList);
    setWords(''); // Clear input
  };

  return (
    <div className="word-upload">
      <h2>Upload Your Spelling Words</h2>
      <p>Enter one word per line, or upload a photo (coming soon)</p>
      
      <form onSubmit={handleSubmit}>
        <textarea
          value={words}
          onChange={handleInputChange}
          placeholder="beautiful, different, exercise, friend"
          rows="8"
        />
        <button type="submit">Add Words to Learn</button>
      </form>

      {uploadedWords.length > 0 && (
        <div className="success-message">
          ✅ Great! You've added {uploadedWords.length} words to learn.
        </div>
      )}
    </div>
  );
}

export default WordUpload;