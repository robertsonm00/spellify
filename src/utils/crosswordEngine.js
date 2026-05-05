// Crossword layout engine - Enhanced for 15x15 grids with balanced word distribution
// Generates a connected crossword grid from a list of words, ensuring both horizontal and vertical placement

export function wordCells(word, row, col, direction) {
  return Array.from({ length: word.length }, (_, i) => ({
    row: direction === 'down' ? row + i : row,
    col: direction === 'across' ? col + i : col,
  }));
}

function buildCellMap(placed) {
  const map = new Map();
  for (const pw of placed) {
    for (let i = 0; i < pw.word.length; i++) {
      const r = pw.direction === 'down' ? pw.row + i : pw.row;
      const c = pw.direction === 'across' ? pw.col + i : pw.col;
      const key = `${r},${c}`;
      if (!map.has(key)) map.set(key, { letter: pw.word[i], across: false, down: false });
      map.get(key)[pw.direction] = true;
    }
  }
  return map;
}

function isValidPlacement(word, row, col, dir, placed) {
  // Bounds check for 15x15 grid
  if (dir === 'across' && col + word.length > 15) return false;
  if (dir === 'down' && row + word.length > 15) return false;
  if (row < 0 || col < 0) return false;

  const map = buildCellMap(placed);

  // Reject if there is a cell in the same direction immediately before or after
  const beforeKey = dir === 'across' ? `${row},${col - 1}` : `${row - 1},${col}`;
  const afterKey  = dir === 'across' ? `${row},${col + word.length}` : `${row + word.length},${col}`;
  if (map.has(beforeKey) || map.has(afterKey)) return false;

  let hasIntersection = false;

  for (let i = 0; i < word.length; i++) {
    const r = dir === 'down' ? row + i : row;
    const c = dir === 'across' ? col + i : col;
    const key = `${r},${c}`;

    if (map.has(key)) {
      const cell = map.get(key);
      if (cell.letter !== word[i]) return false;   // letter conflict
      if (cell[dir]) return false;                  // same-direction overlap
      hasIntersection = true;
    } else {
      // Empty cell: no letter may exist in any perpendicular neighbour
      if (dir === 'across') {
        if (map.has(`${r - 1},${c}`)) return false;
        if (map.has(`${r + 1},${c}`)) return false;
      } else {
        if (map.has(`${r},${c - 1}`)) return false;
        if (map.has(`${r},${c + 1}`)) return false;
      }
    }
  }

  return placed.length === 0 || hasIntersection;
}

function scoreCandidate(row, col, dir, word, placed) {
  // Prefer placements that keep words distributed within 15x15 bounds
  // Weight vertical placement slightly higher to encourage better distribution
  const verticalBonus = dir === 'down' ? 50 : 0;
  
  // Prefer placements that are more centered and distributed
  const distFromEdge = Math.min(row, col, 14 - row, 14 - col);
  const spreadScore = distFromEdge * 10;
  
  return verticalBonus + spreadScore;
}

function findPlacement(word, placed, preferredDir = null) {
  const candidates = [];
  const perpDir = (d) => (d === 'across' ? 'down' : 'across');

  // If no words placed yet, use preferred direction or alternate between across/down
  if (placed.length === 0) {
    // Place first word based on preference or default to across
    return null;
  }

  // Try perpendicular placement with respect to existing words
  for (const existing of placed) {
    let tryDirections = [perpDir(existing.direction)];
    
    // Also try same direction for longer crosswords
    if (placed.length > 5) {
      tryDirections.push(existing.direction);
    }

    for (const dir of tryDirections) {
      for (let wi = 0; wi < word.length; wi++) {
        for (let ei = 0; ei < existing.word.length; ei++) {
          if (word[wi] !== existing.word[ei]) continue;

          let row, col;
          if (existing.direction === 'across') {
            row = existing.row - wi;
            col = existing.col + ei;
          } else {
            row = existing.row + ei;
            col = existing.col - wi;
          }

          if (isValidPlacement(word, row, col, dir, placed)) {
            candidates.push({ 
              row, 
              col, 
              direction: dir, 
              score: scoreCandidate(row, col, dir, word, placed) 
            });
          }
        }
      }
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function assignClueNumbers(placed) {
  const starts = [...new Set(placed.map(pw => `${pw.row},${pw.col}`))]
    .map(k => { const [r, c] = k.split(',').map(Number); return { row: r, col: c }; })
    .sort((a, b) => a.row - b.row || a.col - b.col);

  const numMap = new Map(starts.map(({ row, col }, i) => [`${row},${col}`, i + 1]));

  return placed.map(pw => ({ ...pw, number: numMap.get(`${pw.row},${pw.col}`) }));
}

export function generateCrossword(inputWords, maxWords = 15) {
  const words = inputWords
    .slice(0, maxWords)
    .map(w => w.toUpperCase())
    .filter(w => w.length >= 2)
    .sort((a, b) => b.length - a.length);

  if (!words.length) return null;

  const placed = [];
  const GRID_SIZE = 15;
  const centerOffset = Math.floor(GRID_SIZE / 2);

  // First word placed across at center
  const firstStartCol = Math.max(0, centerOffset - Math.floor(words[0].length / 2));
  placed.push({ 
    id: 0, 
    word: words[0], 
    row: centerOffset, 
    col: firstStartCol, 
    direction: 'across' 
  });

  // Alternate direction preference for better distribution
  let directionPreference = 'down';
  
  for (let i = 1; i < words.length; i++) {
    const placement = findPlacement(words[i], placed, directionPreference);
    if (placement) {
      placed.push({ id: i, word: words[i], ...placement });
      // Alternate preference
      directionPreference = directionPreference === 'across' ? 'down' : 'across';
    }
  }

  if (placed.length < 2) return null;

  // Normalize to fit within 15x15 grid if needed
  let minRow = Infinity, minCol = Infinity;
  let maxRow = 0, maxCol = 0;
  
  for (const pw of placed) {
    minRow = Math.min(minRow, pw.row);
    minCol = Math.min(minCol, pw.col);
    maxRow = Math.max(maxRow, pw.direction === 'down' ? pw.row + pw.word.length - 1 : pw.row);
    maxCol = Math.max(maxCol, pw.direction === 'across' ? pw.col + pw.word.length - 1 : pw.col);
  }

  // Shift to ensure grid fits within bounds
  let shiftRow = 0, shiftCol = 0;
  if (minRow < 0) shiftRow = -minRow;
  if (minCol < 0) shiftCol = -minCol;
  if (maxRow - minRow + 1 > GRID_SIZE) return null;
  if (maxCol - minCol + 1 > GRID_SIZE) return null;

  const shifted = placed.map(pw => ({ 
    ...pw, 
    row: pw.row - minRow + shiftRow, 
    col: pw.col - minCol + shiftCol 
  }));

  // Assign clue numbers
  const numbered = assignClueNumbers(shifted);

  // Tight grid dimensions — only as many rows/cols as the placed words occupy.
  // Avoids dead-square padding around the active footprint.
  const rows = Math.max(...numbered.map(pw =>
    pw.direction === 'down' ? pw.row + pw.word.length : pw.row + 1
  ));

  const cols = Math.max(...numbered.map(pw =>
    pw.direction === 'across' ? pw.col + pw.word.length : pw.col + 1
  ));

  return { placedWords: numbered, rows, cols };
}