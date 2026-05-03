// Word Search Engine - Generates and manages word search puzzles

export const generateWordSearch = (words, gridSize) => {
  // Create empty grid
  const grid = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(''));

  // Shuffle words by length (longer words first - easier to place)
  const sortedWords = [...words].sort((a, b) => b.length - a.length);

  // Directions: 0=right, 1=down, 2=diagonal-down-right, 3=diagonal-down-left
  const directions = [
    { dx: 1, dy: 0 }, // right
    { dx: 0, dy: 1 }, // down
    { dx: 1, dy: 1 }, // diagonal down-right
    { dx: -1, dy: 1 }, // diagonal down-left
  ];

  const placedWords = [];

  // Try to place each word
  sortedWords.forEach((word) => {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 100) {
      const dirIndex = Math.floor(Math.random() * directions.length);
      const dir = directions[dirIndex];
      const startRow = Math.floor(Math.random() * gridSize);
      const startCol = Math.floor(Math.random() * gridSize);

      if (canPlaceWord(grid, word, startRow, startCol, dir, gridSize)) {
        placeWord(grid, word, startRow, startCol, dir);
        placedWords.push({
          word: word.toUpperCase(),
          startRow,
          startCol,
          direction: dirIndex,
          length: word.length,
        });
        placed = true;
      }

      attempts++;
    }
  });

  // Fill remaining cells with random letters
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      if (grid[i][j] === '') {
        grid[i][j] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      }
    }
  }

  return {
    grid,
    placedWords,
    foundWords: [],
  };
};

const canPlaceWord = (grid, word, startRow, startCol, direction, gridSize) => {
  const { dx, dy } = direction;

  for (let i = 0; i < word.length; i++) {
    const row = startRow + dy * i;
    const col = startCol + dx * i;

    // Check bounds
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
      return false;
    }

    // Check cell is empty or matches letter
    if (grid[row][col] !== '' && grid[row][col] !== word[i].toUpperCase()) {
      return false;
    }
  }

  return true;
};

const placeWord = (grid, word, startRow, startCol, direction) => {
  const { dx, dy } = direction;

  for (let i = 0; i < word.length; i++) {
    const row = startRow + dy * i;
    const col = startCol + dx * i;
    grid[row][col] = word[i].toUpperCase();
  }
};

export const checkWord = (grid, startRow, startCol, endRow, endCol, placedWords) => {
  // Find which word was selected (if any)
  for (let word of placedWords) {
    if (isWordMatch(word, startRow, startCol, endRow, endCol)) {
      return word;
    }
  }
  return null;
};

const isWordMatch = (word, startRow, startCol, endRow, endCol) => {
  const { startRow: wStartRow, startCol: wStartCol, direction } = word;

  const directions = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
  ];

  const { dx, dy } = directions[direction];

  // Check if selection matches this word
  const length = word.length;
  const wEndRow = wStartRow + dy * (length - 1);
  const wEndCol = wStartCol + dx * (length - 1);

  // Selection could be in either direction
  const match1 =
    (startRow === wStartRow && startCol === wStartCol && endRow === wEndRow && endCol === wEndCol);
  const match2 =
    (startRow === wEndRow && startCol === wEndCol && endRow === wStartRow && endCol === wStartCol);

  return match1 || match2;
};