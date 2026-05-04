/**
 * ocrEngine.js
 * Wrapper around Tesseract.js for browser-based OCR.
 * Accepts an image File and returns an array of extracted words.
 */

import { createWorker, PSM } from 'tesseract.js';

/**
 * Parse words out of raw OCR text.
 * Keeps sequences of 3–20 letters; strips punctuation, numbers and noise.
 * minLen=3 avoids header fragments like "ow" from "ow Spelling List".
 */
export function parseWordsFromText(rawText, minLen = 3) {
  const tokens = rawText
    .replace(/[^a-zA-Z\s]/g, ' ')   // strip everything except letters & whitespace
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= minLen && t.length <= 20);

  // Deduplicate while preserving order
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
    // SPARSE_TEXT (PSM 11): treats text as scattered — perfect for word-grid images
    // where words sit inside bordered boxes with no clear reading order.
    // AUTO mode tries to find columns/paragraphs and fails badly on grids.
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      // Only recognise letters — prevents box borders being misread as |, [, ] etc.
      // which then corrupt adjacent letter clusters.
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
    });

    const url = URL.createObjectURL(file);
    const { data } = await worker.recognize(url);
    URL.revokeObjectURL(url);
    return parseWordsFromText(data.text);
  } finally {
    await worker.terminate();
  }
}
