/**
 * ocrEngine.js
 * Wrapper around Tesseract.js for browser-based OCR.
 * Accepts an image File and returns an array of extracted words.
 */

import { createWorker, PSM } from 'tesseract.js';

/**
 * Words that commonly appear in spelling-list titles / headers but are NOT
 * spelling words themselves. Filtered out of OCR results.
 */
const TITLE_NOISE_WORDS = new Set([
  'spelling', 'list', 'words', 'word', 'worksheet', 'wordlist',
  'grade', 'year', 'class', 'week', 'term', 'unit', 'lesson',
  'test', 'quiz', 'practice', 'activity', 'homework', 'revision',
  'vocabulary', 'vocab', 'name', 'date', 'teacher', 'student', 'pupil',
]);

/**
 * Parse words out of raw OCR text (fallback path).
 * Keeps sequences of 3–20 letters; strips punctuation and numbers.
 */
export function parseWordsFromText(rawText, minLen = 3) {
  const tokens = rawText
    .replace(/[^a-zA-Z\s]/g, ' ')   // strip non-letter, non-space
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= minLen && t.length <= 20)
    .filter((t) => !TITLE_NOISE_WORDS.has(t));

  const seen = new Set();
  return tokens.filter((w) => {
    if (seen.has(w)) return false;
    seen.add(w);
    return true;
  });
}

/**
 * Run OCR on an image File.
 * @param {File} file  - validated image file
 * @param {(pct: number) => void} onProgress - progress callback 0–100
 * @returns {Promise<string[]>} - array of unique extracted words
 */
export async function ocrImageFile(file, onProgress = () => {}) {
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });

  try {
    await worker.setParameters({
      // SPARSE_TEXT: treats text as scattered — ideal for word-grid images
      // where words sit inside bordered boxes with no clear reading order.
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,

      // ⚠️  NO character whitelist here.
      //
      // With a letters-only whitelist, Tesseract MUST map every pixel to a
      // letter — so a box border (a thin vertical line) gets mapped to the
      // nearest match: "l" or "I". This produces "lthrow" instead of "throw".
      //
      // Without the whitelist, the border is read as "|" or "[", which our
      // parseWordsFromText regex then strips cleanly back to "throw".
    });

    const url = URL.createObjectURL(file);
    const { data } = await worker.recognize(url);
    URL.revokeObjectURL(url);

    // ── Word-level filtering (primary path) ────────────────────────────────
    // Tesseract returns each word with: { text, confidence, bbox:{x0,y0,x1,y1} }
    if (data.words && data.words.length > 0) {

      // Calculate the vertical extent of all detected words so we can derive
      // a title cutoff as a fraction of the content height rather than a fixed
      // pixel value. Titles almost always live in the top ~12% of the image.
      const yValues = data.words.map((w) => w.bbox.y1).filter(Boolean);
      const maxY    = yValues.length ? Math.max(...yValues) : 0;
      const titleCutoff = maxY * 0.12;  // skip anything above 12% mark

      const seen  = new Set();
      const words = [];

      for (const w of data.words) {
        const clean = w.text.replace(/[^a-zA-Z]/g, '').toLowerCase();
        if (
          clean.length >= 3 &&
          clean.length <= 20 &&
          w.confidence   >= 50 &&        // reject low-confidence guesses
          w.bbox.y0       > titleCutoff  && // reject title / header zone
          !TITLE_NOISE_WORDS.has(clean) &&
          !seen.has(clean)
        ) {
          words.push(clean);
          seen.add(clean);
        }
      }

      if (words.length > 0) return words;
    }

    // ── Fallback: parse raw text string ───────────────────────────────────
    return parseWordsFromText(data.text);
  } finally {
    await worker.terminate();
  }
}
