/**
 * buildStatutoryTier1.mjs — generator for the bundled Tier-1 statutory dataset.
 *
 * WHY: The full curated corpus (ks1WordData_v14 + ks2WordData_v30, ~6,750
 * unique entries / ~4.5 MB) is Spellify's proprietary asset and must NOT ship
 * wholesale in the browser bundle (see docs/CORPUS_PROTECTION_DESIGN.md).
 *
 * The Tier-1 offline set is the precise set of words the app can surface with
 * rich enrichment while offline:
 *   (a) every entry flagged statutory:true, PLUS
 *   (b) every word in the wordSelectionEngine.selectWords pools
 *       (YEAR1_CEW / YEAR2_CEW / YEAR3_4 / YEAR5_6 in spelling/index.js).
 *
 * (b) matters because some pool words (e.g. "circle", "february", "through")
 * exist in BOTH the KS1 and KS2 source arrays; wordLookup's first-wins merge
 * returns the KS1 copy, which is flagged statutory:false. A statutory-only set
 * would drop those, regressing selectWords' enrichment. The union guarantees
 * getWordData() returns, for every selectable word, exactly the entry it
 * returns today.
 *
 * Built-in themed lessons (curriculumLists.js) do NOT need Tier-1 entries: the
 * games render the inline short definition, and clues come from the bundled
 * definitions.js — neither path reads the rich corpus.
 *
 * This script writes those entries — with full enrichment — into
 * src/data/statutoryTier1.js, which wordLookup.js imports in place of the
 * full corpus.
 *
 * The wider ~6,441 entries live server-side behind the get-word-list Edge
 * Function and are never bundled.
 *
 * Regenerate after any change to the source word data:
 *   node scripts/buildStatutoryTier1.mjs
 *
 * Output is deterministic (sorted by lower-cased word, one entry per line) so
 * the generated file diffs cleanly in git. DO NOT edit statutoryTier1.js by
 * hand — change the source data and re-run this script.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'src', 'data');
const OUT_FILE = resolve(DATA_DIR, 'statutoryTier1.js');

// The source data files are ES modules but the package is type:commonjs, so a
// plain `import` of a .js path would be treated as CJS. We sidestep extension
// resolution by evaluating each module from a base64 data: URL (they have no
// top-level relative imports, so this is safe).
async function loadModule(file) {
  const src = readFileSync(resolve(DATA_DIR, file), 'utf8');
  const url = 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
  return import(url);
}

const norm = (w) => (typeof w === 'string' ? w.toLowerCase().trim() : '');

async function main() {
  const ks1 = await loadModule('ks1WordData_v14.js');
  const ks2 = await loadModule('ks2WordData_v30.js');
  const spelling = await loadModule('spelling/index.js');

  // Replicate wordLookup.js's merge precedence exactly (first-wins dedup).
  const map = new Map();
  const ingest = (arr) => {
    for (const entry of arr || []) {
      if (!entry || typeof entry.word !== 'string') continue;
      const key = norm(entry.word);
      if (!map.has(key)) map.set(key, entry);
    }
  };
  ingest(ks1.Y1_WORD_DATA);
  ingest(ks1.Y2_WORD_DATA);
  ingest(ks1.KS1_GAP_WORDS);
  ingest(ks2.ks2WordData);

  // (b) words selectWords can draw from — the statutory NC pools.
  const poolWords = new Set();
  for (const pool of [spelling.YEAR1_CEW, spelling.YEAR2_CEW, spelling.YEAR3_4, spelling.YEAR5_6]) {
    for (const item of pool || []) {
      const w = typeof item === 'string' ? item : item && item.word;
      if (w) poolWords.add(norm(w));
    }
  }

  // Tier-1 = (a) statutory:true  ∪  (b) any pool word present in the corpus.
  const tier1 = [...map.values()]
    .filter((e) => e.statutory === true || poolWords.has(norm(e.word)))
    .sort((a, b) => norm(a.word).localeCompare(norm(b.word)));

  if (tier1.length === 0) {
    throw new Error('No Tier-1 entries found — source data may have changed shape.');
  }

  // Integrity guard: every pool word that exists in the corpus MUST be in Tier-1.
  const tier1Set = new Set(tier1.map((e) => norm(e.word)));
  const missing = [...poolWords].filter((w) => map.has(w) && !tier1Set.has(w));
  if (missing.length) {
    throw new Error('Pool words missing from Tier-1: ' + missing.join(', '));
  }

  const statutoryCount = tier1.filter((e) => e.statutory === true).length;
  const totalUnique = map.size;
  const generatedAt = new Date().toISOString().slice(0, 10);

  const lines = tier1.map((e) => '  ' + JSON.stringify(e) + ',');

  const out = `// statutoryTier1.js — AUTO-GENERATED. DO NOT EDIT BY HAND.
//
// Source     : ks1WordData_v14.js + ks2WordData_v30.js + spelling/index.js pools
// Generated  : ${generatedAt}
// Entries    : ${tier1.length} Tier-1 (${statutoryCount} statutory + selectWords pool
//              words) of ${totalUnique} unique corpus entries
// Regenerate : node scripts/buildStatutoryTier1.mjs
//
// This is the Tier-1 offline word data bundled into the app: every statutory
// word plus every word the offline picker (selectWords) can surface. The wider
// corpus is served at runtime by the get-word-list Edge Function and is NOT
// bundled. See docs/CORPUS_PROTECTION_DESIGN.md.

export const STATUTORY_TIER1 = [
${lines.join('\n')}
];

export default STATUTORY_TIER1;
`;

  writeFileSync(OUT_FILE, out, 'utf8');
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`  ${tier1.length} Tier-1 entries (${statutoryCount} statutory + pool words) of ${totalUnique} unique corpus`);
  const bytes = Buffer.byteLength(out, 'utf8');
  console.log(`  file size: ${(bytes / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
