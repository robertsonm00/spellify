// apply_patch_v30.mjs
// Applies legacy_enrichment_patch_vFINAL.js to ks2WordData_v29.js → ks2WordData_v30.js
//
// Rules (per field: stressedSyl, elision, spellingVoice, rareSpelling):
//   <field>_confidence === "high"   → apply value
//   <field>_confidence === "review" → apply value + log to legacy_enrichment_review.csv
//   <field>_confidence === "skip"   → leave unchanged
//   <field>_confidence absent/other → leave unchanged (no instruction to apply)
//
// Matching: patch.word ↔ ks2WordData.word, case-insensitive (trimmed).

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DATA_DIR = path.dirname(fileURLToPath(import.meta.url));

// The data files use ESM `export const` syntax, but the package is CJS-default,
// so copy each to a temp `.mjs` and dynamic-import to faithfully parse values.
async function loadExport(fileName, exportName) {
  const txt = await fs.readFile(path.join(DATA_DIR, fileName), 'utf8');
  const tmp = path.join(os.tmpdir(), `v30load_${Date.now()}_${Math.random().toString(36).slice(2)}.mjs`);
  await fs.writeFile(tmp, txt);
  try {
    const mod = await import(pathToFileURL(tmp).href);
    return mod[exportName];
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
}

const patch = await loadExport('legacy_enrichment_patch_vFINAL.js', 'legacyEnrichmentPatch');
const words = await loadExport('ks2WordData_v29.js', 'ks2WordData');

const FIELDS = ['stressedSyl', 'elision', 'spellingVoice', 'rareSpelling'];

// Index ks2WordData by lowercased word (handles potential duplicates).
const index = new Map();
words.forEach((w, i) => {
  const key = String(w.word).trim().toLowerCase();
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(i);
});

const reviewRows = [];
const unmatched = [];
let matchedEntries = 0;
const modifiedRecords = new Set();
const valueChangedRecords = new Set();
let valueChanges = 0;
const perFieldHigh = Object.fromEntries(FIELDS.map(f => [f, 0]));
const perFieldReview = Object.fromEntries(FIELDS.map(f => [f, 0]));
const perFieldValueChanges = Object.fromEntries(FIELDS.map(f => [f, 0]));

for (const entry of patch) {
  const key = String(entry.word).trim().toLowerCase();
  const targets = index.get(key);
  if (!targets) { unmatched.push(entry.word); continue; }
  matchedEntries++;

  for (const field of FIELDS) {
    const conf = entry[`${field}_confidence`];
    if (conf !== 'high' && conf !== 'review') continue; // skip / absent → leave unchanged
    const value = entry[field];
    for (const idx of targets) {
      const rec = words[idx];
      if (rec[field] !== value) { valueChanges++; perFieldValueChanges[field]++; valueChangedRecords.add(idx); }
      rec[field] = value;
      modifiedRecords.add(idx);
    }
    if (conf === 'high') perFieldHigh[field]++;
    if (conf === 'review') {
      perFieldReview[field]++;
      reviewRows.push({ word: entry.word, field, proposed_value: value, confidenceNote: entry.confidenceNote ?? '' });
    }
  }
}

// --- write review CSV ---
const csvCell = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = ['word,field,proposed_value,confidenceNote',
  ...reviewRows.map(r => [r.word, r.field, r.proposed_value, r.confidenceNote].map(csvCell).join(','))
].join('\n') + '\n';
await fs.writeFile(path.join(DATA_DIR, 'legacy_enrichment_review.csv'), csv);

// --- write ks2WordData_v30.js (same single-export format as v29) ---
const header = `// ks2WordData_v30.js
// Generated: 2026-05-29
// v29 (${words.length} entries) + legacy_enrichment_patch_vFINAL (${patch.length} entries)
// Applied fields: stressedSyl, elision, rareSpelling (high + review).
// spellingVoice left unchanged — patch carries no spellingVoice_confidence field.
// Review flags: ${reviewRows.length} → see legacy_enrichment_review.csv
// DO NOT EDIT — regenerate via apply_patch_v30.mjs
`;
const body = 'export const ks2WordData = [\n'
  + words.map(w => '  ' + JSON.stringify(w)).join(',\n')
  + '\n];\n';
await fs.writeFile(path.join(DATA_DIR, 'ks2WordData_v30.js'), header + '\n' + body);

// --- report ---
const report = {
  patchEntries: patch.length,
  matchedEntries,
  unmatchedEntries: unmatched.length,
  unmatchedSample: unmatched.slice(0, 25),
  recordsTouched: modifiedRecords.size,
  recordsValueChanged: valueChangedRecords.size,
  totalValueChanges: valueChanges,
  perFieldHigh,
  perFieldReview,
  perFieldValueChanges,
  reviewFlagsLogged: reviewRows.length,
  finalTotal: words.length,
};
console.log(JSON.stringify(report, null, 2));
