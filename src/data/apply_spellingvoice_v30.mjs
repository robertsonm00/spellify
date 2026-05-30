// apply_spellingvoice_v30.mjs
// Follow-up pass: applies spellingVoice from legacy_enrichment_patch_vFINAL.js
// onto the existing ks2WordData_v30.js, overwriting it in place.
//
// Rule: for every patch entry where spellingVoice !== null, write that value to
// the matching ks2WordData entry (case-insensitive), regardless of confidence.
// Patch entries with spellingVoice === null leave the existing value unchanged.
// No other fields are touched.

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DATA_DIR = path.dirname(fileURLToPath(import.meta.url));

async function loadExport(fileName, exportName) {
  const txt = await fs.readFile(path.join(DATA_DIR, fileName), 'utf8');
  const tmp = path.join(os.tmpdir(), `sv30load_${Date.now()}_${Math.random().toString(36).slice(2)}.mjs`);
  await fs.writeFile(tmp, txt);
  try {
    const mod = await import(pathToFileURL(tmp).href);
    return mod[exportName];
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
}

const patch = await loadExport('legacy_enrichment_patch_vFINAL.js', 'legacyEnrichmentPatch');
const words = await loadExport('ks2WordData_v30.js', 'ks2WordData');

const index = new Map();
words.forEach((w, i) => {
  const key = String(w.word).trim().toLowerCase();
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(i);
});

let patchEntriesWithSV = 0;
let recordsWritten = 0;
let recordsChanged = 0;
let unmatched = 0;
const spotChecks = [];

for (const entry of patch) {
  if (entry.spellingVoice == null) continue; // null/undefined → leave unchanged
  patchEntriesWithSV++;
  const targets = index.get(String(entry.word).trim().toLowerCase());
  if (!targets) { unmatched++; continue; }
  for (const idx of targets) {
    const rec = words[idx];
    const before = rec.spellingVoice;
    if (before !== entry.spellingVoice) recordsChanged++;
    rec.spellingVoice = entry.spellingVoice;
    recordsWritten++;
    if (spotChecks.length < 5) spotChecks.push({ word: rec.word, before, after: rec.spellingVoice });
  }
}

const header = `// ks2WordData_v30.js
// Generated: 2026-05-30
// v29 (5398 entries) + legacy_enrichment_patch_vFINAL (3195 entries)
// Applied fields: stressedSyl, elision, rareSpelling (high + review); spellingVoice (all non-null, follow-up pass).
// Review flags: 70 → see legacy_enrichment_review.csv
// DO NOT EDIT — regenerate via apply_patch_v30.mjs then apply_spellingvoice_v30.mjs
`;
const body = 'export const ks2WordData = [\n'
  + words.map(w => '  ' + JSON.stringify(w)).join(',\n')
  + '\n];\n';
await fs.writeFile(path.join(DATA_DIR, 'ks2WordData_v30.js'), header + '\n' + body);

console.log(JSON.stringify({
  patchEntriesWithSpellingVoice: patchEntriesWithSV,
  recordsWritten,
  recordsChangedFromPrevious: recordsChanged,
  unmatched,
  finalTotal: words.length,
  spotCheck: spotChecks,
}, null, 2));
