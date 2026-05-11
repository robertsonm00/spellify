// Visual similarity pairs — high-confusion letters for early readers.
const VISUAL_PAIRS = {
  b: ['d'], d: ['b'],
  p: ['q'], q: ['p'],
  m: ['n'], n: ['m'],
  u: ['v'], v: ['u', 'w'],
  i: ['l'], l: ['i'],
  h: ['n'],
  c: ['e'], e: ['c'],
  f: ['t'], t: ['f'],
};

// Phonetic similarity pairs.
const PHONETIC_PAIRS = {
  c: ['k'], k: ['c'],
  s: ['z'], z: ['s'],
  f: ['v'],
  j: ['g'], g: ['j'],
  w: ['v'],
  y: ['i'],
};

// Letters avoided for the youngest readers (visually complex or rare).
const EXCLUDE_YEAR12 = new Set(['q', 'x', 'z']);

function fisherYates(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Returns a shuffled array of uppercase letters for the Spell Duel keyboard.
 *
 * Always includes every unique letter of the word.
 * The total key count scales with word length to guarantee the keyboard
 * always contains a meaningful number of distractors (wrong letters),
 * so there is always a real chance of making a mistake.
 *
 * Year 1–2 : base 12 keys, min 4 distractors
 * Year 3–4 : base 18 keys, min 5 distractors
 * Year 5–6 : base 22 keys, min 5 distractors
 * hard / null-yr5+ : all 26
 *
 * If the word is long enough that its unique letters exceed the base budget
 * minus the minimum distractors, the total expands (up to 26) to fit.
 */
export function generateSpellDuelKeyboard(word, yearGroup, difficulty) {
  const yr = yearGroup ?? 5;

  if (difficulty === 'hard') {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  }

  const wordLetters = new Set(word.toUpperCase().split(''));
  const uniqueCount = wordLetters.size;

  // Year-group base budget and minimum guaranteed wrong letters.
  const baseTotal     = yr <= 2 ? 12 : yr <= 4 ? 18 : 22;
  const minDistractors = yr <= 2 ? 4  : 5;

  // Scale total up if the word's unique letters would crowd out distractors.
  // Cap at 26.
  const total = Math.min(26, Math.max(baseTotal, uniqueCount + minDistractors));

  // If that reaches 26, just return the full alphabet.
  if (total >= 26) {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  }

  // Exact number of distractor slots after reserving space for word letters.
  const distractorsNeeded = total - uniqueCount;

  const pool = new Set();

  // Priority 1: visual confusables for each word letter.
  for (const letter of wordLetters) {
    for (const conf of (VISUAL_PAIRS[letter.toLowerCase()] ?? [])) {
      const uc = conf.toUpperCase();
      if (!wordLetters.has(uc) && !(yr <= 2 && EXCLUDE_YEAR12.has(conf))) {
        pool.add(uc);
      }
    }
  }

  // Priority 2: phonetic confusables.
  if (pool.size < distractorsNeeded) {
    outer: for (const letter of wordLetters) {
      for (const conf of (PHONETIC_PAIRS[letter.toLowerCase()] ?? [])) {
        const uc = conf.toUpperCase();
        if (!wordLetters.has(uc) && !pool.has(uc) && !(yr <= 2 && EXCLUDE_YEAR12.has(conf))) {
          pool.add(uc);
          if (pool.size >= distractorsNeeded) break outer;
        }
      }
    }
  }

  // Priority 3: random fill from remaining alphabet.
  if (pool.size < distractorsNeeded) {
    const remaining = fisherYates(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l =>
        !wordLetters.has(l) &&
        !pool.has(l) &&
        !(yr <= 2 && EXCLUDE_YEAR12.has(l.toLowerCase()))
      )
    );
    for (const l of remaining) {
      pool.add(l);
      if (pool.size >= distractorsNeeded) break;
    }
  }

  // Take exactly what we need (pool may be over from priority 1).
  const distractors = [...pool].slice(0, distractorsNeeded);

  return fisherYates([...wordLetters, ...distractors]);
}
