// checkCoverage.mjs
// ──────────────────────────────────────────────────────────────────────────────
// Coverage check: how well do the v14 KS1 + v27 KS2 word databases cover the
// words currently used in Spellify's curriculumLists.js and spelling/index.js?
//
// USAGE:
//   node checkCoverage.mjs
//
// REQUIREMENTS:
//   src/data/ks1WordData_v14.js   (Y1_WORD_DATA, Y2_WORD_DATA, KS1_GAP_WORDS)
//   src/data/ks2WordData_v27.js   (Y34_WORD_DATA, Y56_WORD_DATA, KS2_GAP_WORDS)
//   src/data/curriculumLists.js
//   src/data/spelling/index.js
//
// The script reports:
//   1. Total words in each database array
//   2. Per-source overlap (what % of curriculum words have rich data)
//   3. Missing words list (curriculum words not in the database)
//   4. Per-year breakdown
//   5. Per-category breakdown
// ──────────────────────────────────────────────────────────────────────────────

import {
  Y1_WORD_DATA,
  Y2_WORD_DATA,
  KS1_GAP_WORDS,
} from './src/data/ks1WordData_v14.js';

import {
  Y34_WORD_DATA,
  Y56_WORD_DATA,
  KS2_GAP_WORDS,
} from './src/data/ks2WordData_v27.js';

import { curriculumLists } from './src/data/curriculumLists.js';
import { YEAR1_CEW, YEAR2_CEW, YEAR3_4, YEAR5_6 } from './src/data/spelling/index.js';

// ─── Build unified lookup set (mirrors wordLookup.js WORD_MAP order) ──────────
const toSet = (...arrays) =>
  new Set(arrays.flat().map(e => (typeof e === 'string' ? e : e.word).toLowerCase()));

const ks1Words = toSet(Y1_WORD_DATA, Y2_WORD_DATA, KS1_GAP_WORDS);
const ks2Words = toSet(Y34_WORD_DATA, Y56_WORD_DATA, KS2_GAP_WORDS);
const allWords = new Set([...ks1Words, ...ks2Words]);

console.log('═══════════════════════════════════════════════════════════════════════');
console.log('SPELLIFY WORD COVERAGE CHECK — v14 (KS1) + v27 (KS2)');
console.log('═══════════════════════════════════════════════════════════════════════\n');

console.log('Database arrays loaded:');
console.log(`  Y1_WORD_DATA:   ${Y1_WORD_DATA.length}`);
console.log(`  Y2_WORD_DATA:   ${Y2_WORD_DATA.length}`);
console.log(`  KS1_GAP_WORDS:  ${KS1_GAP_WORDS.length}`);
console.log(`  Y34_WORD_DATA:  ${Y34_WORD_DATA.length}`);
console.log(`  Y56_WORD_DATA:  ${Y56_WORD_DATA.length}`);
console.log(`  KS2_GAP_WORDS:  ${KS2_GAP_WORDS.length}`);
console.log(`  KS1 unique:     ${ks1Words.size}`);
console.log(`  KS2 unique:     ${ks2Words.size}`);
console.log(`  Combined unique: ${allWords.size}\n`);

// ─── Source 1: curriculumLists.js ────────────────────────────────────────────
console.log('─── Source 1: curriculumLists.js ──────────────────────────────────────');
const curriculumWords = new Map();   // word → list of lesson IDs it appears in
for (const lesson of curriculumLists) {
  for (const entry of lesson.words) {
    const w = (typeof entry === 'string' ? entry : entry.word).toLowerCase();
    if (!curriculumWords.has(w)) curriculumWords.set(w, []);
    curriculumWords.get(w).push(lesson.id);
  }
}
const curriculumCovered = [...curriculumWords.keys()].filter(w => allWords.has(w));
const curriculumMissing = [...curriculumWords.keys()].filter(w => !allWords.has(w));

console.log(`Total unique words across all curriculum lessons: ${curriculumWords.size}`);
console.log(`Covered by database: ${curriculumCovered.length} (${pct(curriculumCovered.length, curriculumWords.size)})`);
console.log(`MISSING from database: ${curriculumMissing.length} (${pct(curriculumMissing.length, curriculumWords.size)})\n`);

// Per-year breakdown
console.log('Per-year breakdown:');
for (let year = 1; year <= 6; year++) {
  const yearLessons = curriculumLists.filter(l => l.year === year);
  const yearWords = new Set();
  for (const lesson of yearLessons) {
    for (const entry of lesson.words) {
      yearWords.add((typeof entry === 'string' ? entry : entry.word).toLowerCase());
    }
  }
  const covered = [...yearWords].filter(w => allWords.has(w)).length;
  const missing = yearWords.size - covered;
  const flag = missing > 0 ? ' ⚠️' : ' ✅';
  console.log(`  Year ${year}: ${String(yearWords.size).padStart(3)} words   covered=${String(covered).padStart(3)} (${pct(covered, yearWords.size)})   missing=${missing}${flag}`);
}
console.log();

// Per-category breakdown
console.log('Per-category breakdown:');
const byCategory = new Map();
for (const lesson of curriculumLists) {
  if (!byCategory.has(lesson.category)) byCategory.set(lesson.category, new Set());
  for (const entry of lesson.words) {
    byCategory.get(lesson.category).add((typeof entry === 'string' ? entry : entry.word).toLowerCase());
  }
}
for (const [cat, words] of [...byCategory.entries()].sort()) {
  const covered = [...words].filter(w => allWords.has(w)).length;
  const flag = covered < words.size ? ' ⚠️' : ' ✅';
  console.log(`  ${cat.padEnd(15)} total=${String(words.size).padStart(4)}   covered=${String(covered).padStart(4)} (${pct(covered, words.size)})${flag}`);
}
console.log();

// ─── Source 2: spelling/index.js statutory pools ─────────────────────────────
console.log('─── Source 2: spelling/index.js statutory pools ───────────────────────');
const checkPool = (name, pool) => {
  const lower = pool.map(w => w.toLowerCase());
  const covered = lower.filter(w => allWords.has(w)).length;
  const missing = lower.filter(w => !allWords.has(w));
  const flag = missing.length > 0 ? ' ⚠️' : ' ✅';
  console.log(`${name.padEnd(18)} total=${String(pool.length).padStart(4)}   covered=${String(covered).padStart(4)} (${pct(covered, pool.length)})${flag}`);
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

// ─── Detailed missing-words list ──────────────────────────────────────────────
console.log('─── Missing words in curriculumLists ──────────────────────────────────');
if (curriculumMissing.length === 0) {
  console.log('🎉 Every curriculum word is covered by the database.\n');
} else {
  console.log(`Total missing: ${curriculumMissing.length}\n`);
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
