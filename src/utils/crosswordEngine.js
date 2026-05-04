// Crossword layout engine
// Generates a connected crossword grid from a list of words.

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
      // Empty cell: no letter may exist in any perpendicular neighbour.
      // If such a neighbour existed, this cell would have to be an intersection
      // (already handled above), so any adjacent letter here is a rule violation.
      if (dir === 'across') {
        if (map.has(`${r - 1},${c}`)) return false;
        if (map.has(`${r + 1},${c}`)) return false;
      } else {
        if (map.has(`${r},${c - 1}`)) return false;
        if (map.has(`${r},${c + 1}`)) return false;
      }
    }
  }

  // All words after the first must intersect at least one existing word
  return placed.length === 0 || hasIntersection;
}

function scoreCandidate(row, col, dir, word, placed) {
  // Prefer placements that keep the grid compact
  const allRows = placed.flatMap(pw => [
    pw.row,
    pw.direction === 'down' ? pw.row + pw.word.length - 1 : pw.row,
  ]);
  const allCols = placed.flatMap(pw => [
    pw.col,
    pw.direction === 'across' ? pw.col + pw.word.length - 1 : pw.col,
  ]);

  const newRows = [row, dir === 'down' ? row + word.length - 1 : row];
  const newCols = [col, dir === 'across' ? col + word.length - 1 : col];

  const minR = Math.min(...allRows, ...newRows);
  const maxR = Math.max(...allRows, ...newRows);
  const minC = Math.min(...allCols, ...newCols);
  const maxC = Math.max(...allCols, ...newCols);

  return -((maxR - minR) + (maxC - minC));
}

function findPlacement(word, placed) {
  const candidates = [];
  const perpDir = (d) => (d === 'across' ? 'down' : 'across');

  for (const existing of placed) {
    const dir = perpDir(existing.direction);
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
          candidates.push({ row, col, direction: dir, score: scoreCandidate(row, col, dir, word, placed) });
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

  // First word placed across at origin
  placed.push({ id: 0, word: words[0], row: 0, col: 0, direction: 'across' });

  for (let i = 1; i < words.length; i++) {
    const placement = findPlacement(words[i], placed);
    if (placement) placed.push({ id: i, word: words[i], ...placement });
  }

  // Normalise: shift everything so min row/col = 0
  let minRow = Infinity, minCol = Infinity;
  for (const pw of placed) {
    minRow = Math.min(minRow, pw.row);
    minCol = Math.min(minCol, pw.col);
  }
  const shifted = placed.map(pw => ({ ...pw, row: pw.row - minRow, col: pw.col - minCol }));

  // Assign clue numbers
  const numbered = assignClueNumbers(shifted);

  // Compute grid dimensions
  let rows = 0, cols = 0;
  for (const pw of numbered) {
    rows = Math.max(rows, pw.direction === 'down' ? pw.row + pw.word.length : pw.row + 1);
    cols = Math.max(cols, pw.direction === 'across' ? pw.col + pw.word.length : pw.col + 1);
  }

  return { placedWords: numbered, rows, cols };
}
