// Crossword layout engine
// Tries multiple word orderings and returns the layout that places the most words.

const GRID_SIZE = 20; // internal canvas; normalised before return

export function wordCells(word, row, col, direction) {
  return Array.from({ length: word.length }, (_, i) => ({
    row: direction === 'down'   ? row + i : row,
    col: direction === 'across' ? col + i : col,
  }));
}

function buildCellMap(placed) {
  const map = new Map();
  for (const pw of placed) {
    for (let i = 0; i < pw.word.length; i++) {
      const r = pw.direction === 'down'   ? pw.row + i : pw.row;
      const c = pw.direction === 'across' ? pw.col + i : pw.col;
      const key = `${r},${c}`;
      if (!map.has(key)) map.set(key, { letter: pw.word[i], across: false, down: false });
      map.get(key)[pw.direction] = true;
    }
  }
  return map;
}

function isValidPlacement(word, row, col, dir, map) {
  if (dir === 'across' && col + word.length > GRID_SIZE) return false;
  if (dir === 'down'   && row + word.length > GRID_SIZE) return false;
  if (row < 0 || col < 0) return false;

  // No existing cell immediately before or after in the same direction
  const [br, bc] = dir === 'across' ? [row, col - 1]            : [row - 1, col];
  const [ar, ac] = dir === 'across' ? [row, col + word.length]  : [row + word.length, col];
  if (map.has(`${br},${bc}`) || map.has(`${ar},${ac}`)) return false;

  let hasIntersection = false;

  for (let i = 0; i < word.length; i++) {
    const r = dir === 'down'   ? row + i : row;
    const c = dir === 'across' ? col + i : col;
    const key = `${r},${c}`;
    const cell = map.get(key);

    if (cell) {
      if (cell.letter !== word[i]) return false; // letter mismatch
      if (cell[dir])               return false; // same-direction overlap
      hasIntersection = true;
    } else {
      // Empty cell must not be adjacent to a letter perpendicularly
      if (dir === 'across') {
        if (map.has(`${r - 1},${c}`) || map.has(`${r + 1},${c}`)) return false;
      } else {
        if (map.has(`${r},${c - 1}`) || map.has(`${r},${c + 1}`)) return false;
      }
    }
  }

  return hasIntersection;
}

function findCandidates(word, placed, map) {
  const candidates = [];
  const center = Math.floor(GRID_SIZE / 2);
  const perpDir = d => (d === 'across' ? 'down' : 'across');

  for (const existing of placed) {
    const dir = perpDir(existing.direction);

    for (let ni = 0; ni < word.length; ni++) {
      for (let ei = 0; ei < existing.word.length; ei++) {
        if (word[ni] !== existing.word[ei]) continue;

        let row, col;
        if (existing.direction === 'across') {
          row = existing.row - ni;
          col = existing.col + ei;
        } else {
          row = existing.row + ei;
          col = existing.col - ni;
        }

        if (!isValidPlacement(word, row, col, dir, map)) continue;

        // Score: favour placements closer to the grid centre
        const midR = dir === 'down'   ? row + word.length / 2 : row;
        const midC = dir === 'across' ? col + word.length / 2 : col;
        const dist = Math.abs(midR - center) + Math.abs(midC - center);
        candidates.push({ row, col, direction: dir, score: -dist });
      }
    }
  }

  return candidates;
}

function tryLayout(words) {
  const placed = [];
  const center = Math.floor(GRID_SIZE / 2);

  // First word: centred horizontally, across
  const firstCol = Math.max(0, center - Math.floor(words[0].length / 2));
  placed.push({ word: words[0], row: center, col: firstCol, direction: 'across' });

  for (let wi = 1; wi < words.length; wi++) {
    const word = words[wi];
    const map  = buildCellMap(placed);
    const candidates = findCandidates(word, placed, map);

    if (candidates.length) {
      candidates.sort((a, b) => b.score - a.score);
      placed.push({ word, ...candidates[0] });
    }
  }

  return placed;
}

// Deterministic Fisher-Yates using a simple LCG seed
function seededShuffle(arr, seed) {
  const result = [...arr];
  let s = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function assignClueNumbers(placed) {
  const starts = [...new Set(placed.map(pw => `${pw.row},${pw.col}`))]
    .map(k => { const [r, c] = k.split(',').map(Number); return { row: r, col: c }; })
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const numMap = new Map(starts.map(({ row, col }, i) => [`${row},${col}`, i + 1]));
  return placed.map(pw => ({ ...pw, number: numMap.get(`${pw.row},${pw.col}`) }));
}

function normaliseLayout(placed) {
  let minRow = Infinity, minCol = Infinity;
  for (const pw of placed) {
    minRow = Math.min(minRow, pw.row);
    minCol = Math.min(minCol, pw.col);
  }
  const shifted = placed.map((pw, idx) => ({
    ...pw,
    id:  idx,
    row: pw.row - minRow,
    col: pw.col - minCol,
  }));

  const numbered = assignClueNumbers(shifted);

  const rows = Math.max(...numbered.map(pw =>
    pw.direction === 'down' ? pw.row + pw.word.length : pw.row + 1
  ));
  const cols = Math.max(...numbered.map(pw =>
    pw.direction === 'across' ? pw.col + pw.word.length : pw.col + 1
  ));

  return { placedWords: numbered, rows, cols };
}

export function generateCrossword(inputWords, maxWords = 15) {
  const words = [...new Set(inputWords.map(w => w.toUpperCase()))]
    .filter(w => w.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, maxWords);

  if (!words.length) return null;

  let best = null;
  const MAX_ATTEMPTS = 25;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // attempt 0: original length-sorted order
    // subsequent: keep longest first, shuffle the rest with a different seed each time
    const ordered = attempt === 0
      ? words
      : [words[0], ...seededShuffle(words.slice(1), attempt * 7919)];

    const placed = tryLayout(ordered);

    if (!best || placed.length > best.length) {
      best = placed;
    }
    if (best.length === words.length) break; // all words placed — done
  }

  if (!best || best.length < 2) return null;
  return normaliseLayout(best);
}
