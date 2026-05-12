// scripts/verify-word-data.mjs
//
// Verifies the v13 + v26 word databases against the app's existing pools.
// Run: node scripts/verify-word-data.mjs
// Exit code 0 on pass, 1 on any failure.

import { Y1_WORD_DATA, Y2_WORD_DATA } from '../src/data/ks1WordData_v13.js';
import { Y34_WORD_DATA, Y56_WORD_DATA } from '../src/data/ks2WordData_v26.js';
import {
  YEAR1_CEW,
  YEAR2_CEW,
  YEAR3_4,
  YEAR5_6,
} from '../src/data/spelling/index.js';
import { curriculumLists } from '../src/data/curriculumLists.js';

const REQUIRED_FIELDS = [
  'word',
  'sentence',
  'wordType',
  'spellingRule',
  'patternGroup',
  'difficulty',
];

const failures = [];
const fail = (msg) => failures.push(msg);

const heading = (label) => `\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`;
const tick = (ok) => (ok ? '✓' : '✗');
const norm = (w) => String(w).toLowerCase();

// ── 1. Parse + counts ────────────────────────────────────────────────────────
console.log(heading('Parse + counts'));
const ks1Count = Y1_WORD_DATA.length + Y2_WORD_DATA.length;
const ks2Count = Y34_WORD_DATA.length + Y56_WORD_DATA.length;
console.log(`KS1 (Y1 + Y2): ${ks1Count}  ${tick(ks1Count >= 1300)} (>=1300)`);
console.log(`KS2 (Y3/4 + Y5/6): ${ks2Count}  ${tick(ks2Count >= 2900)} (>=2900)`);
if (ks1Count < 1300) fail(`KS1 count ${ks1Count} < 1300`);
if (ks2Count < 2900) fail(`KS2 count ${ks2Count} < 2900`);

// ── 2. Required fields on every entry ────────────────────────────────────────
console.log(heading('Required fields on every entry'));
const all = [
  ...Y1_WORD_DATA.map((e) => ({ ...e, _bucket: 'Y1' })),
  ...Y2_WORD_DATA.map((e) => ({ ...e, _bucket: 'Y2' })),
  ...Y34_WORD_DATA.map((e) => ({ ...e, _bucket: 'Y34' })),
  ...Y56_WORD_DATA.map((e) => ({ ...e, _bucket: 'Y56' })),
];

let missingFieldCount = 0;
const sampleMissing = [];
for (const entry of all) {
  for (const f of REQUIRED_FIELDS) {
    if (entry[f] === undefined || entry[f] === null || entry[f] === '') {
      missingFieldCount += 1;
      if (sampleMissing.length < 5) sampleMissing.push(`${entry._bucket} "${entry.word}" missing ${f}`);
      break;
    }
  }
  if (!entry.definitions || typeof entry.definitions.ages7to10 !== 'string' || entry.definitions.ages7to10 === '') {
    missingFieldCount += 1;
    if (sampleMissing.length < 5) sampleMissing.push(`${entry._bucket} "${entry.word}" missing definitions.ages7to10`);
  }
}
console.log(`Entries missing required fields: ${missingFieldCount}  ${tick(missingFieldCount === 0)}`);
if (missingFieldCount > 0) {
  fail(`${missingFieldCount} entries missing required fields`);
  for (const s of sampleMissing) console.log(`  • ${s}`);
}

// ── 3. Y5/6 ages5to7 EMPTY by convention ────────────────────────────────────
console.log(heading('Y5/6 ages5to7 convention (must be empty)'));
let y56NonEmpty = 0;
const y56Bad = [];
for (const e of Y56_WORD_DATA) {
  const v = e.definitions?.ages5to7;
  if (typeof v === 'string' && v.length > 0) {
    y56NonEmpty += 1;
    if (y56Bad.length < 5) y56Bad.push(`"${e.word}" has ages5to7: "${v.slice(0, 40)}"`);
  }
}
console.log(`Y5/6 entries with non-empty ages5to7: ${y56NonEmpty}  ${tick(y56NonEmpty === 0)}`);
if (y56NonEmpty > 0) {
  fail(`${y56NonEmpty} Y5/6 entries have non-empty ages5to7`);
  for (const s of y56Bad) console.log(`  • ${s}`);
}

// ── 4. Y1/Y2 ages5to7 NON-EMPTY by convention ───────────────────────────────
console.log(heading('Y1/Y2 ages5to7 convention (must be non-empty)'));
let y12Empty = 0;
const y12Bad = [];
for (const e of [...Y1_WORD_DATA, ...Y2_WORD_DATA]) {
  const v = e.definitions?.ages5to7;
  if (!v || (typeof v === 'string' && v.length === 0)) {
    y12Empty += 1;
    if (y12Bad.length < 5) y12Bad.push(`"${e.word}" (Y${e.year}) has empty ages5to7`);
  }
}
console.log(`Y1/Y2 entries with empty ages5to7: ${y12Empty}  ${tick(y12Empty === 0)}`);
if (y12Empty > 0) {
  fail(`${y12Empty} Y1/Y2 entries have empty ages5to7`);
  for (const s of y12Bad) console.log(`  • ${s}`);
}

// ── 5. Statutory pool coverage ──────────────────────────────────────────────
console.log(heading('Statutory pool coverage'));
const combinedMap = new Map();
for (const e of all) {
  const k = norm(e.word);
  if (!combinedMap.has(k)) combinedMap.set(k, e);
}

function checkPool(name, pool) {
  const missing = pool.filter((w) => !combinedMap.has(norm(w)));
  const pct = ((pool.length - missing.length) / pool.length * 100).toFixed(1);
  console.log(`${name.padEnd(11)}: ${pool.length - missing.length}/${pool.length} (${pct}%)  ${tick(missing.length === 0)}`);
  if (missing.length > 0) {
    fail(`${name} missing ${missing.length} words`);
    console.log(`  missing: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ', …' : ''}`);
  }
}
checkPool('YEAR1_CEW', YEAR1_CEW);
checkPool('YEAR2_CEW', YEAR2_CEW);
checkPool('YEAR3_4',   YEAR3_4);
checkPool('YEAR5_6',   YEAR5_6);

// ── 6. curriculumLists coverage ──────────────────────────────────────────────
console.log(heading('curriculumLists coverage'));
const curriculumWords = new Set();
for (const lesson of curriculumLists) {
  for (const w of lesson.words || []) {
    const word = typeof w === 'string' ? w : w.word;
    if (word) curriculumWords.add(norm(word));
  }
}
const curriculumArr = [...curriculumWords];
const curriculumMissing = curriculumArr.filter((w) => !combinedMap.has(w));
const curriculumPct = ((curriculumArr.length - curriculumMissing.length) / curriculumArr.length * 100).toFixed(1);
console.log(`curriculumLists unique words: ${curriculumArr.length}`);
console.log(`covered: ${curriculumArr.length - curriculumMissing.length}/${curriculumArr.length} (${curriculumPct}%)  ${tick(curriculumMissing.length === 0)}`);
if (curriculumMissing.length > 0) {
  fail(`curriculumLists has ${curriculumMissing.length} uncovered words`);
  console.log(`  missing (first 20): ${curriculumMissing.slice(0, 20).join(', ')}`);
}

// ── 7. Sample 10 random words ────────────────────────────────────────────────
console.log(heading('Sample 10 random entries'));
const sample = [];
const allArr = [...combinedMap.values()];
const seenIdx = new Set();
while (sample.length < 10 && seenIdx.size < allArr.length) {
  const i = Math.floor(Math.random() * allArr.length);
  if (seenIdx.has(i)) continue;
  seenIdx.add(i);
  sample.push(allArr[i]);
}
for (const e of sample) {
  console.log(`\n  ▸ ${e.word}  (year=${e.year ?? '—'}, band=${e.yearBand ?? '—'}, ${e.difficulty}, ${e.patternGroup})`);
  console.log(`    type:        ${e.wordType}`);
  console.log(`    syllables:   ${e.syllables}`);
  console.log(`    tricky:      ${e.trickyPart}`);
  console.log(`    ages5to7:    ${e.definitions?.ages5to7 || '(empty)'}`);
  console.log(`    ages7to10:   ${e.definitions?.ages7to10}`);
  console.log(`    sentence:    ${e.sentence}`);
  console.log(`    common-mis:  ${e.commonMistakes || '(empty)'}`);
  console.log(`    related:     ${(e.relatedWords || []).join(', ') || '(none)'}`);
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(heading('Summary'));
if (failures.length === 0) {
  console.log('✓ All checks passed.');
  process.exit(0);
} else {
  console.log(`✗ ${failures.length} failure(s):`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
