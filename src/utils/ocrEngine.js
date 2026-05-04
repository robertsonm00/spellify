/**
 * ocrEngine.js
 * Wrapper around Tesseract.js for browser-based OCR.
 * Accepts an image File and returns an array of extracted words.
 */

import { createWorker } from 'tesseract.js';

/**
 * Parse words out of raw OCR text.
 * Keeps sequences of 2–20 letters only; strips punctuation and numbers.
 */
export function parseWordsFromText(rawText) {
  const tokens = rawText
    .replace(/[^a-zA-Z\s'-]/g, ' ')  // keep letters, hyphens, apostrophes
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z]/g, '').toLowerCase())
    .filter((t) => t.length >= 2 && t.length <= 20);

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
    // Convert file to object URL for Tesseract
    const url = URL.createObjectURL(file);
    const { data } = await worker.recognize(url);
    URL.revokeObjectURL(url);
    return parseWordsFromText(data.text);
  } finally {
    await worker.terminate();
  }
}
