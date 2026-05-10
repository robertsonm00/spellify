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

/**
 * Split a word into rough syllable chunks for spoken demonstration.
 * Uses the same vowel-group logic as syllableCount: each vowel group
 * (treating y as vowel, except as a leading letter) anchors a syllable,
 * and consonant clusters between them are split near their midpoint.
 *
 * Not phonetically perfect — "body" comes out as ["bo","dy"] rather than
 * dictionary "bod·y" — but it's good enough for TTS to read each chunk
 * as a separate utterance and let a child hear the syllable break.
 */
export function syllableChunks(word) {
  if (!word) return [];
  const w = String(word).toLowerCase().trim();
  if (w.length <= 2) return [w];

  const groups = [];
  const re = /[aeiouy]+/g;
  let m;
  while ((m = re.exec(w))) {
    if (m.index === 0 && m[0] === 'y') continue; // leading y acts consonantal
    groups.push({ start: m.index, end: m.index + m[0].length });
  }

  // Drop a silent trailing 'e' so "cake" stays one chunk, not "ca·ke".
  if (groups.length >= 2) {
    const last = groups[groups.length - 1];
    const isTrailingE = last.end === w.length && w[last.start] === 'e' && last.end - last.start === 1;
    if (isTrailingE && !/[^aeiouy]le$/.test(w)) groups.pop();
  }

  if (groups.length <= 1) return [w];

  const chunks = [];
  let prev = 0;
  for (let i = 0; i < groups.length - 1; i++) {
    const g    = groups[i];
    const next = groups[i + 1];
    const consLen = next.start - g.end;
    // 0-1 consonants between groups → keep with next syllable;
    // 2+ consonants → split between the cluster.
    const splitAt = consLen <= 1 ? g.end : g.end + Math.floor(consLen / 2);
    chunks.push(w.slice(prev, splitAt));
    prev = splitAt;
  }
  chunks.push(w.slice(prev));
  return chunks.filter(Boolean);
}

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
