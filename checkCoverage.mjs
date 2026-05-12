// checkCoverage.mjs
// ──────────────────────────────────────────────────────────────────────────────
// Coverage check: how well do the v25 KS1+KS2 word databases cover the words
// currently used in Spellify's curriculumLists.js and spelling/index.js?
//
// USAGE — drop this file into the project root and run:
//   node checkCoverage.mjs
//
// REQUIREMENTS — these files should be present (place v25 files in src/data/):
//   src/data/ks1WordData_v12.js
//   src/data/ks2WordData_v25.js
//   src/data/curriculumLists.js
//   src/data/spelling/index.js
//
// The script reports:
//   1. Total words in each source
//   2. Per-source overlap with v25 (what % of curriculum words have rich data)
//   3. Missing words list (curriculum words not in v25)
//   4. Per-year breakdown
//   5. Per-pattern-group breakdown for missing words (so we can see if a whole
//      pattern needs adding to v25, or if these are mostly oddities)
// ──────────────────────────────────────────────────────────────────────────────

import { Y34_WORD_DATA, Y56_WORD_DATA } from './src/data/ks2WordData_v26.js';
import * as KS1Module from './src/data/ks1WordData_v13.js';
import { curriculumLists } from './src/data/curriculumLists.js';
import { YEAR_DATA, YEAR1_CEW, YEAR2_CEW, YEAR3_4, YEAR5_6 } from './src/data/spelling/index.js';

// ─── Build a unified v25 lookup set ────────────────────────────────────────────
const ks2Words = new Set([...Y34_WORD_DATA, ...Y56_WORD_DATA].map(w => w.word.toLowerCase()));

// Try to pull KS1 words from a few likely export names
const ks1Source =
  KS1Module.Y1_WORD_DATA && KS1Module.Y2_WORD_DATA
    ? [...KS1Module.Y1_WORD_DATA, ...KS1Module.Y2_WORD_DATA]
    : KS1Module.KS1_WORD_DATA
    ? KS1Module.KS1_WORD_DATA
    : KS1Module.default?.ks1?.words
    ? KS1Module.default.ks1.words
    : [];
const ks1Words = new Set(ks1Source.map(w => w.word.toLowerCase()));

const v25Words = new Set([...ks1Words, ...ks2Words]);

console.log('═══════════════════════════════════════════════════════════════════════');
console.log('SPELLIFY WORD COVERAGE CHECK — v25 vs. existing app data');
console.log('═══════════════════════════════════════════════════════════════════════\n');

console.log(`v25 KS1 words loaded: ${ks1Words.size}`);
console.log(`v25 KS2 words loaded: ${ks2Words.size}`);
console.log(`v25 combined unique:  ${v25Words.size}\n`);

if (ks1Words.size === 0) {
  console.warn('⚠️  KS1 word data did not load — check the export name in ks1WordData_v12.js.');
  console.warn('   Expected one of: Y1_WORD_DATA + Y2_WORD_DATA, KS1_WORD_DATA, or default.ks1.words.\n');
}

// ─── Source 1: curriculumLists.js ──────────────────────────────────────────────
console.log('─── Source 1: curriculumLists.js ──────────────────────────────────────');
const curriculumWords = new Map();   // word → list of lesson IDs it appears in
for (const lesson of curriculumLists) {
  for (const entry of lesson.words) {
    const w = entry.word.toLowerCase();
    if (!curriculumWords.has(w)) curriculumWords.set(w, []);
    curriculumWords.get(w).push(lesson.id);
  }
}
const curriculumCovered = [...curriculumWords.keys()].filter(w => v25Words.has(w));
const curriculumMissing = [...curriculumWords.keys()].filter(w => !v25Words.has(w));

console.log(`Total unique words across all curriculum lessons: ${curriculumWords.size}`);
console.log(`Covered by v25:    ${curriculumCovered.length} (${pct(curriculumCovered.length, curriculumWords.size)})`);
console.log(`MISSING from v25:  ${curriculumMissing.length} (${pct(curriculumMissing.length, curriculumWords.size)})\n`);

// Per-year breakdown
console.log('Per-year breakdown:');
for (let year = 1; year <= 6; year++) {
  const yearLessons = curriculumLists.filter(l => l.year === year);
  const yearWords = new Set();
  for (const lesson of yearLessons) {
    for (const entry of lesson.words) yearWords.add(entry.word.toLowerCase());
  }
  const covered = [...yearWords].filter(w => v25Words.has(w)).length;
  const missing = yearWords.size - covered;
  console.log(`  Year ${year}: ${yearWords.size} words   covered=${covered} (${pct(covered, yearWords.size)})   missing=${missing}`);
}
console.log();

// Per-category breakdown
console.log('Per-category breakdown:');
const byCategory = new Map();
for (const lesson of curriculumLists) {
  if (!byCategory.has(lesson.category)) byCategory.set(lesson.category, new Set());
  for (const entry of lesson.words) byCategory.get(lesson.category).add(entry.word.toLowerCase());
}
for (const [cat, words] of [...byCategory.entries()].sort()) {
  const covered = [...words].filter(w => v25Words.has(w)).length;
  console.log(`  ${cat.padEnd(15)} total=${String(words.size).padStart(4)}   covered=${String(covered).padStart(4)} (${pct(covered, words.size)})`);
}
console.log();

// ─── Source 2: spelling/index.js statutory pools ───────────────────────────────
console.log('─── Source 2: spelling/index.js statutory pools ───────────────────────');
const checkPool = (name, pool) => {
  const lower = pool.map(w => w.toLowerCase());
  const covered = lower.filter(w => v25Words.has(w)).length;
  const missing = lower.filter(w => !v25Words.has(w));
  console.log(`${name.padEnd(18)} total=${String(pool.length).padStart(4)}   covered=${String(covered).padStart(4)} (${pct(covered, pool.length)})`);
  if (missing.length > 0 && missing.length <= 20) {
    console.log(`  missing: ${missing.join(', ')}`);
  } else if (missing.length > 20) {
    console.log(`  missing (first 20 of ${missing.length}): ${missing.slice(0, 20).join(', ')}`);
  }
};
checkPool('YEAR1_CEW',   YEAR1_CEW);
checkPool('YEAR2_CEW',   YEAR2_CEW);
checkPool('YEAR3_4',     YEAR3_4);
checkPool('YEAR5_6',     YEAR5_6);
console.log();

// ─── Detailed missing-words list for curriculumLists ───────────────────────────
console.log('─── Missing words in curriculumLists (not in v25) ─────────────────────');
if (curriculumMissing.length === 0) {
  console.log('🎉 Every curriculum word is covered by v25.\n');
} else {
  console.log(`Total missing: ${curriculumMissing.length}\n`);
  // Group missing words by year
  for (let year = 1; year <= 6; year++) {
    const yearMissing = curriculumMissing.filter(w => {
      const lessons = curriculumWords.get(w);
      return lessons.some(id => {
        const lesson = curriculumLists.find(l => l.id === id);
        return lesson && lesson.year === year;
      });
    });
    if (yearMissing.length > 0) {
      console.log(`Year ${year} missing (${yearMissing.length}):`);
      // Show in chunks of 8 per line
      for (let i = 0; i < yearMissing.length; i += 8) {
        console.log('  ' + yearMissing.slice(i, i + 8).map(w => w.padEnd(15)).join(''));
      }
      console.log();
    }
  }
}

console.log('═══════════════════════════════════════════════════════════════════════');
console.log('Coverage check complete.');
console.log('═══════════════════════════════════════════════════════════════════════');

function pct(part, whole) {
  if (whole === 0) return '0%';
  return `${(part / whole * 100).toFixed(1)}%`;
}
