/**
 * ocrExtract.js
 *
 * Safer OCR extraction for handwritten / photographed spelling lists.
 *
 * Strategy:
 *   - Run Tesseract twice with different page-segmentation modes
 *     (SPARSE_TEXT and SINGLE_BLOCK). SPARSE_TEXT handles boxed-grid
 *     worksheets where words sit in scattered cells; SINGLE_BLOCK handles
 *     clean column lists.
 *   - Restrict the character whitelist to letters only — numbers and
 *     symbols are filtered out at the engine level rather than after the
 *     fact.
 *   - Keep word-level data (text, confidence, bbox) and emit *candidates*,
 *     not finished words. Final classification + de-noising happens in
 *     wordValidation.js.
 *
 * The classifier (wordValidation.classifyCandidate) is the single
 * authority for whether a candidate ends up shown as confident or
 * needsReview, so we deliberately do NOT discard low-confidence candidates
 * here — the user might still want to confirm one.
 */

import { createWorker, PSM } from 'tesseract.js';
import { classifyCandidates } from './wordValidation.js';

// Words that show up in worksheet headers but aren't spelling words.
const HEADER_NOISE = new Set([
  'spelling','list','words','word','worksheet','wordlist',
  'grade','year','class','week','term','unit','lesson',
  'test','quiz','practice','activity','homework','revision',
  'vocabulary','vocab','name','date','teacher','student','pupil','title',
]);

/**
 * Run Tesseract once with the given PSM and return the full data block,
 * including word-level results.
 */
export async function recognizeWithPsm(file, psm, onProgress) {
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof onProgress === 'function') {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });
  try {
    // NOTE: deliberately no `tessedit_char_whitelist`. Forcing the LSTM
    // engine to map every pixel to a letter destroys accuracy on boxed
    // worksheets — box borders get re-mapped to "l" / "I" and the engine
    // generally loses confidence. Instead, we filter non-letters out of
    // the recognised tokens after the fact (see candidatesFromData).
    await worker.setParameters({
      tessedit_pageseg_mode:     psm,
      preserve_interword_spaces: '1',
    });
    const url = URL.createObjectURL(file);
    // tesseract.js v6+ leaves the top-level `data.words` array empty
    // unless you explicitly request blocks. Pass it so we get the full
    // hierarchy (blocks → paragraphs → lines → words).
    const { data } = await worker.recognize(url, {}, { blocks: true });
    URL.revokeObjectURL(url);
    return data;
  } finally {
    await worker.terminate();
  }
}

/**
 * Tesseract.js v7 returns words nested under
 * blocks → paragraphs → lines → words. Flatten that into the same shape
 * older code expected on `data.words`.
 */
function flattenWords(data) {
  const out = [];
  for (const block of (data?.blocks || [])) {
    for (const para of (block.paragraphs || [])) {
      for (const line of (para.lines || [])) {
        for (const word of (line.words || [])) {
          if (word) out.push(word);
        }
      }
    }
  }
  return out;
}

/**
 * Pull word-level candidates from a Tesseract `data` block.
 * Each candidate has: rawText, ocrConfidence, boundingBox, source.
 */
function candidatesFromData(data) {
  const words = flattenWords(data);
  if (words.length === 0) return [];

  // Title-band heuristic: skip words sitting in the very top of the
  // detected content area, but only if there's enough vertical spread
  // for the heuristic to mean something. A worksheet where OCR only
  // managed to read the title would otherwise have its entire output
  // filtered away.
  const yMaxRaw = words.map((w) => w.bbox?.y1 ?? 0);
  const yMinRaw = words.map((w) => w.bbox?.y0 ?? 0);
  const maxY    = yMaxRaw.length ? Math.max(...yMaxRaw) : 0;
  const minY    = yMinRaw.length ? Math.min(...yMinRaw) : 0;
  const span    = maxY - minY;
  const useTitleCutoff = span > 200; // px — only meaningful for full-page captures
  const titleCutoff    = minY + span * 0.10;

  const out = [];
  for (const w of words) {
    const text = (w.text || '').trim();
    if (!text) continue;

    const cleaned = text.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (!cleaned) continue;
    if (cleaned.length < 2) continue;
    if (HEADER_NOISE.has(cleaned)) continue;

    if (useTitleCutoff && w.bbox && w.bbox.y0 < titleCutoff) continue;

    out.push({
      rawText:       cleaned,
      ocrConfidence: typeof w.confidence === 'number' ? w.confidence : 70,
      boundingBox:   w.bbox || null,
      source:        'ocr',
    });
  }
  return out;
}

/**
 * Merge two candidate lists by rawText, keeping the higher confidence
 * occurrence. This lets two PSM passes corroborate each other — a word
 * that shows up in both runs ends up with the better of the two
 * confidences and we don't end up with duplicates.
 */
function mergeCandidates(a, b) {
  const map = new Map();
  for (const c of [...a, ...b]) {
    const key = c.rawText;
    const existing = map.get(key);
    if (!existing || c.ocrConfidence > existing.ocrConfidence) {
      map.set(key, c);
    }
  }
  return [...map.values()];
}

/**
 * Run the full OCR extraction pipeline on a *preprocessed* image File.
 * Returns an array of classified candidates (see wordValidation.js for
 * shape).
 *
 * @param {File} file
 * @param {(pct:number) => void} onProgress  0–100 across both passes
 */
export async function extractCandidatesFromImage(file, onProgress = () => {}) {
  // Two-pass OCR. We weight progress so the user sees a smooth bar.
  const passOne = (p) => onProgress(Math.round(p * 0.55));
  const passTwo = (p) => onProgress(55 + Math.round(p * 0.4));

  let primary  = [];
  let fallback = [];
  let primaryRaw = '';
  let fallbackRaw = '';

  try {
    const data = await recognizeWithPsm(file, PSM.SPARSE_TEXT, passOne);
    primary    = candidatesFromData(data);
    primaryRaw = (data?.text || '').slice(0, 400);
  } catch (err) {
    console.warn('[ocrExtract] SPARSE_TEXT pass failed:', err);
  }

  // Always run the second pass — even when the first looks healthy it
  // often catches additional rows that SPARSE_TEXT skips on tight grids.
  try {
    const data = await recognizeWithPsm(file, PSM.SINGLE_BLOCK, passTwo);
    fallback   = candidatesFromData(data);
    fallbackRaw = (data?.text || '').slice(0, 400);
  } catch (err) {
    console.warn('[ocrExtract] SINGLE_BLOCK pass failed:', err);
  }

  onProgress(95);
  const merged = mergeCandidates(primary, fallback);
  const classified = classifyCandidates(merged);
  onProgress(100);

  // Surface a one-shot summary so the dev console makes it obvious where
  // the pipeline lost words when a user reports "no words found".
  console.info(
    '[ocrExtract] sparse=%d single=%d merged=%d kept=%d',
    primary.length,
    fallback.length,
    merged.length,
    classified.length,
  );
  if (classified.length === 0) {
    console.info('[ocrExtract] sparse raw text →', primaryRaw);
    console.info('[ocrExtract] single raw text →', fallbackRaw);
  }

  return classified;
}

/**
 * Convenience wrapper for non-OCR sources (PDF text layer, plain text
 * files). Treats every word as `source: 'ocr'` with high confidence so
 * the same validation pipeline runs over them — anything that doesn't
 * match the dictionary still surfaces as needsReview rather than being
 * silently accepted. The user remains the source of truth.
 */
export function classifyTextWords(words, ocrConfidence = 95) {
  const candidates = words.map((w) => ({
    rawText:       w,
    ocrConfidence,
    boundingBox:   null,
    source:        'ocr',
  }));
  return classifyCandidates(candidates);
}
