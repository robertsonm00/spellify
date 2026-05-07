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
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = lang;
  u.rate = rate;
  const v = getBestVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}
