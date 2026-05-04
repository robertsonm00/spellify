/**
 * pdfExtractor.js
 * Wrapper around pdfjs-dist for browser-based PDF text extraction.
 * Extracts text from all pages and returns an array of unique words.
 */

import * as pdfjsLib from 'pdfjs-dist';
import { parseWordsFromText } from './ocrEngine';

// Point to the worker we copied into /public
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

/**
 * Extract words from a PDF File.
 * @param {File} file  - validated PDF file
 * @param {(pct: number) => void} onProgress - progress callback 0–100
 * @returns {Promise<string[]>} - array of unique extracted words
 */
export async function extractWordsFromPDF(file, onProgress = () => {}) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  let fullText = '';

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    fullText += ' ' + pageText;
    onProgress(Math.round((pageNum / totalPages) * 100));
  }

  return parseWordsFromText(fullText);
}
