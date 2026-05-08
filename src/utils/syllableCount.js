// Heuristic English syllable counter, with overrides for words the
// heuristic mis-counts. Used by the SyllableTap activity.

const OVERRIDES = {
  // Words where the vowel-group rule under- or over-counts.
  every: 2, everyone: 3, everybody: 4, beautiful: 3, library: 3,
  february: 4, family: 3, chocolate: 3, vegetable: 3, restaurant: 3,
  business: 2, different: 3, difficult: 3, separate: 3, interest: 3,
  comfortable: 3, environment: 4, secretary: 4, naturally: 4,
  temperature: 4, accidentally: 5, occasionally: 5, marvellous: 3,
  mischievous: 3, miscellaneous: 5, parliament: 3, rhythm: 2,
  // Single-syllable look-likes
  rhyme: 1, queue: 1, who: 1, sure: 1,
};

export function syllableCount(word) {
  if (!word) return 0;
  const w = String(word).toLowerCase().trim();
  if (OVERRIDES[w] != null) return OVERRIDES[w];
  if (w.length <= 3) return 1;

  // Strip a silent trailing -e (but not -le after a consonant)
  let stripped = w;
  if (stripped.endsWith('e') && !/[^aeiouy]le$/.test(stripped)) {
    stripped = stripped.slice(0, -1);
  }

  // Count vowel groups (consecutive vowels = one syllable)
  const groups = stripped.match(/[aeiouy]+/g) || [];
  return Math.max(1, groups.length);
}
