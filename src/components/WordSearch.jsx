import React, { useState } from 'react';
import { generateWordSearch, checkWord } from '../utils/wordSearchEngine';
import './WordSearch.css';

function getGridSize(userAge, difficulty) {
  if (userAge < 7) return 10;
  if (userAge < 10) return difficulty === 'easy' ? 12 : 15;
  return difficulty === 'easy' ? 15 : 20;
}

function getCellsBetween(start, end) {
  const rowDiff = end.row - start.row;
  const colDiff = end.col - start.col;

  if (rowDiff !== 0 && colDiff !== 0 && Math.abs(rowDiff) !== Math.abs(colDiff)) {
    return [start];
  }

  const steps   = Math.max(Math.abs(rowDiff), Math.abs(colDiff));
  const rowStep = rowDiff === 0 ? 0 : rowDiff / Math.abs(rowDiff);
  const colStep = colDiff === 0 ? 0 : colDiff / Math.abs(colDiff);

  return Array.from({ length: steps + 1 }, (_, i) => ({
    row: start.row + i * rowStep,
    col: start.col + i * colStep,
  }));
}

function WordSearch({ words, userAge = 8, initialDifficulty, onComplete, onExit }) {
  const [difficulty, setDifficulty] = useState(initialDifficulty || 'medium');

  // When launched from the hub with a difficulty, skip setup and start immediately
  const [gameState, setGameState] = useState(() =>
    initialDifficulty
      ? generateWordSearch(words, getGridSize(userAge, initialDifficulty))
      : null
  );
  const [gameStarted, setGameStarted] = useState(!!initialDifficulty);

  const [selectionAnchor, setSelectionAnchor] = useState(null);
  const [selectionCells, setSelectionCells] = useState([]);
  const [foundWords, setFoundWords]   = useState([]);
  const [foundCells, setFoundCells]   = useState([]);
  const [toast, setToast]             = useState(null);

  const startGame = () => {
    setGameState(generateWordSearch(words, getGridSize(userAge, difficulty)));
    setFoundWords([]);
    setFoundCells([]);
    setSelectionAnchor(null);
    setSelectionCells([]);
    setToast(null);
    setGameStarted(true);
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 1400);
  };

  const handleCellClick = (row, col) => {
    if (!gameStarted || !gameState) return;

    if (!selectionAnchor) {
      setSelectionAnchor({ row, col });
      setSelectionCells([{ row, col }]);
    } else {
      const cells = getCellsBetween(selectionAnchor, { row, col });
      const start = cells[0];
      const end   = cells[cells.length - 1];

      const matched = checkWord(
        gameState.grid,
        start.row, start.col,
        end.row,   end.col,
        gameState.placedWords
      );

      if (matched && !foundWords.includes(matched.word)) {
        setFoundWords((prev) => [...prev, matched.word]);
        setFoundCells((prev) => [...prev, ...cells]);
        showToast(`✓ ${matched.word}`);
      }

      setSelectionAnchor(null);
      setSelectionCells([]);
    }
  };

  const handleCellHover = (row, col) => {
    if (!selectionAnchor) return;
    setSelectionCells(getCellsBetween(selectionAnchor, { row, col }));
  };

  const handleCancel = (e) => {
    e.preventDefault();
    setSelectionAnchor(null);
    setSelectionCells([]);
  };

  // ── Setup screen (shown only when launched standalone, not from hub) ──
  if (!gameStarted) {
    return (
      <div className="word-search-setup">
        <h2>Word Search</h2>
        <p>Find all {words.length} words hidden in the grid!</p>

        {userAge >= 7 && (
          <div className="difficulty-selector">
            <label>Choose Difficulty:</label>
            <div className="difficulty-buttons">
              {['easy', 'medium', 'hard'].map((level) => (
                <button
                  key={level}
                  className={`difficulty-btn ${difficulty === level ? 'active' : ''}`}
                  onClick={() => setDifficulty(level)}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="start-btn" onClick={startGame}>
          Start Game
        </button>
      </div>
    );
  }

  if (!gameState) return <div>Loading...</div>;

  const progress = Math.round((foundWords.length / words.length) * 100);

  return (
    <div className="word-search-container">
      <div className="word-search-header">
        {onExit && (
          <button className="ws-back-btn" onClick={onExit}>
            ← Hub
          </button>
        )}
        <h2>Word Search</h2>
        <div className="progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p>{foundWords.length} of {words.length} words found</p>
        </div>
      </div>

      {toast && <div className="word-toast">{toast}</div>}

      <div className="word-search-main">
        <div
          className={`grid-container${selectionAnchor ? ' selecting' : ''}`}
          onContextMenu={handleCancel}
        >
          {gameState.grid.map((row, rowIndex) => (
            <div key={rowIndex} className="grid-row">
              {row.map((letter, colIndex) => {
                const isSelected = selectionCells.some(
                  (c) => c.row === rowIndex && c.col === colIndex
                );
                const isFound = foundCells.some(
                  (c) => c.row === rowIndex && c.col === colIndex
                );

                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`grid-cell${isFound ? ' found' : isSelected ? ' selected' : ''}`}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    onMouseEnter={() => handleCellHover(rowIndex, colIndex)}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="word-list">
          <h3>Words to Find:</h3>
          <ul>
            {words.map((word) => (
              <li
                key={word}
                className={foundWords.includes(word.toUpperCase()) ? 'found' : ''}
              >
                {word}
                {foundWords.includes(word.toUpperCase()) && ' ✓'}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {foundWords.length === words.length && (
        <div className="completion-screen">
          <h2>🎉 You found all the words!</h2>
          <button onClick={startGame}>Play Again</button>
          <button onClick={onComplete}>Back to Hub</button>
        </div>
      )}
    </div>
  );
}

export default WordSearch;
