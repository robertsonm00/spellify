/**
 * Global monotonic session counter.
 *
 * Used by the word-selection / mastery layer to tag mastery events and to
 * decide when consolidating / retained words should rotate back into the
 * active window. The counter does not represent calendar time — it's just
 * a strictly increasing integer.
 *
 * Incremented exactly once per `getActiveWindow` invocation. Stored in a
 * dedicated localStorage key so we don't tangle it with the per-list
 * mastery records or the v2 session document.
 */

const STORAGE_KEY = 'spellify_session_count';

function readCount() {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeCount(n) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* storage full / disabled — fail silently */
  }
}

/**
 * Read the current session count without mutating it. Returns 0 before any
 * session has been started.
 */
export function getSessionCount() {
  return readCount();
}

/**
 * Increment the session count and return the new value. Call once at the
 * start of a session (from `getActiveWindow`).
 */
export function incrementSessionCount() {
  const next = readCount() + 1;
  writeCount(next);
  return next;
}

/**
 * Reset the counter — only used by tests / verification flows. Not wired
 * into the normal app.
 */
export function _resetSessionCount() {
  writeCount(0);
}
