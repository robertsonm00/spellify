/**
 * speech.js — Centralised text-to-speech utility.
 *
 * Voice quality priority (high → low):
 *   1. Google UK English  (Chrome desktop — neural, very natural)
 *   2. Google US English  (Chrome, fallback if no UK)
 *   3. Any other Google English (Chrome)
 *   4. Apple Enhanced en-GB (Safari / macOS — "Daniel (Enhanced)" etc.)
 *   5. Apple Enhanced any English (Safari / macOS)
 *   6. Any en-GB system voice
 *   7. Any English system voice
 *
 * Chrome's Google voices and Safari's Enhanced voices are genuinely
 * close-to-human neural synthesis. Basic system voices (Tier 6–7) are
 * more robotic but still intelligible as a last resort.
 */

import { isMuted } from './audioMute';

let _cachedVoice = null;

function _pickBestVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  if (!voices.length) return null;

  return (
    // ── Tier 1–3: Google neural voices (Chrome) ──────────────────────────
    voices.find(v => /google/i.test(v.name) && v.lang === 'en-GB') ||
    voices.find(v => /google/i.test(v.name) && v.lang === 'en-US') ||
    voices.find(v => /google/i.test(v.name) && v.lang?.startsWith('en')) ||
    // ── Tier 4–5: Apple Enhanced voices (Safari / macOS) ─────────────────
    voices.find(v => /enhanced/i.test(v.name) && v.lang === 'en-GB') ||
    voices.find(v => /enhanced/i.test(v.name) && v.lang?.startsWith('en')) ||
    // ── Tier 6–7: System voices ───────────────────────────────────────────
    voices.find(v => v.lang === 'en-GB') ||
    voices.find(v => v.lang?.startsWith('en')) ||
    null
  );
}

// Browsers load voices asynchronously; cache is invalidated when the list
// changes so the next speak() call re-picks with the full voice list.
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices?.(); // trigger async load
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    _cachedVoice = null;
  });
}

/** Returns the best available voice, caching the result between calls. */
export function getBestVoice() {
  if (_cachedVoice) return _cachedVoice;
  _cachedVoice = _pickBestVoice();
  return _cachedVoice;
}

/**
 * Speak a word using the best available voice.
 * @param {string} word
 * @param {{ rate?: number, lang?: string }} opts
 */
export function speakWord(word, { rate = 0.85, lang = 'en-GB' } = {}) {
  if (!('speechSynthesis' in window)) return;
  if (isMuted()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = lang;
  u.rate = rate;
  const v = getBestVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

/**
 * Speak a word broken into syllable chunks — each chunk is queued as its
 * own utterance so the speech engine pauses between them, demonstrating
 * the syllable structure to the listener.
 *
 * For single-syllable words it just speaks the whole word slowly.
 *
 * @param {string}   word
 * @param {string[]} chunks  pre-split chunks (e.g. from syllableChunks)
 */
export function speakSyllables(word, chunks) {
  if (!('speechSynthesis' in window)) return;
  if (isMuted()) return;
  window.speechSynthesis.cancel();
  const v = getBestVoice();

  const queue = (text, rate) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = rate;
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };

  if (!chunks || chunks.length <= 1) {
    queue(word, 0.55);
    return;
  }
  // Each chunk as a separate utterance — the engine inserts a natural pause
  // between them, exaggerating the syllable break.
  chunks.forEach((c) => queue(c, 0.7));
  // Then the whole word once at a normal-slow rate to tie it back together.
  queue(word, 0.75);
}

/**
 * Speak a full sentence / phrase (e.g. a Crossword clue) using the best
 * available voice. Reads at a slightly quicker, more natural rate than the
 * word-by-word `speakWord` so a clue sounds like speech rather than a
 * laboured single word. Honours the global mute and cancels any in-flight
 * utterance first so a replay tap interrupts cleanly.
 *
 * @param {string} text
 * @param {{ rate?: number, lang?: string }} opts
 */
export function speakSentence(text, { rate = 0.92, lang = 'en-GB' } = {}) {
  if (!('speechSynthesis' in window)) return;
  if (isMuted()) return;
  if (!text || !String(text).trim()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text));
  u.lang = lang;
  u.rate = rate;
  const v = getBestVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

/**
 * Speak a word and then immediately queue follow-up sentences (e.g. the
 * definition and an example). Each sentence reads at a slightly faster
 * rate than the word itself so the explanation feels like natural speech
 * rather than a slow word-by-word reading.
 *
 * @param {string}   word
 * @param {string[]} extraLines  sentences to read after the word
 */
export function speakWordWithInfo(word, extraLines = []) {
  if (!('speechSynthesis' in window)) return;
  if (isMuted()) return;
  window.speechSynthesis.cancel();
  const v = getBestVoice();

  const speak = (text, rate) => {
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = rate;
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };

  speak(word, 0.85);
  for (const line of extraLines) speak(line, 0.95);
}
