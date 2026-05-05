export const STORAGE_KEY   = 'spellify_session_v2';
export const LEGACY_KEY_V1 = 'spellify_session_v1';
export const LEGACY_KEY_V0 = 'spellify_session';      // bare key used by earliest builds

/** @deprecated kept for external references; prefer LEGACY_KEY_V1 */
export const LEGACY_KEY = LEGACY_KEY_V1;

export const INITIAL_STATUSES = {
  wordsearch: 'not-started',
  quiz:       'not-started',
  hangman:    'not-started',
  crossword:  'not-started',
};

/**
 * Build a fresh v2 session object.
 * @param {{ year, age, words, wordObjects, sourceMode, dyslexiaMode }} opts
 * @returns {object}
 */
export function createSession({ year, age, words = [], wordObjects = [], sourceMode = 'generated', dyslexiaMode = false }) {
  return {
    _version: 2,
    year,
    age,
    sourceMode,      // 'generated' | 'manual' | 'uploaded'
    dyslexiaMode,    // boolean
    words,           // string[]
    wordObjects,     // { word, year, difficulty }[]
    activityStatuses: { ...INITIAL_STATUSES },
    mastery:     {},
    reviewQueue: [],
  };
}

/**
 * Load a session from localStorage.
 *
 * Priority:
 *   1. spellify_session_v2  — current format, returned as-is
 *   2. spellify_session_v1  — written by App.jsx before the data-layer refactor
 *   3. spellify_session     — bare key used by the earliest builds
 *
 * When a legacy record is found it is migrated to the v2 shape and
 * immediately written under STORAGE_KEY so the next load is instant.
 *
 * Returns null if no stored session exists.
 */
export function loadSession() {
  try {
    // ── 1. Current key ───────────────────────────────────────────────────────
    const v2Raw = localStorage.getItem(STORAGE_KEY);
    if (v2Raw) return JSON.parse(v2Raw);

    // ── 2 & 3. Legacy keys (v1 then bare) ───────────────────────────────────
    const legacyRaw =
      localStorage.getItem(LEGACY_KEY_V1) ??
      localStorage.getItem(LEGACY_KEY_V0);

    if (legacyRaw) {
      const old = JSON.parse(legacyRaw);

      const migrated = {
        _version: 2,
        // 'year' field is the same in both v0 and v1
        year:         old.year          ?? null,
        age:          old.age           ?? null,
        difficulty:   old.difficulty    ?? 'medium',
        sourceMode:   old.sourceMode    ?? 'generated',
        dyslexiaMode: old.dyslexiaMode  ?? false,
        words:        old.words         ?? [],
        wordObjects:  old.wordObjects   ?? [],
        activityStatuses: old.activityStatuses ?? { ...INITIAL_STATUSES },
        mastery:      old.mastery       ?? {},
        reviewQueue:  old.reviewQueue   ?? [],
      };

      // Persist immediately so future loads hit the v2 key
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));

      return migrated;
    }
  } catch {
    // Corrupted storage — start fresh
  }
  return null;
}

/**
 * Persist a session to localStorage under the v2 key.
 * Pass null to remove the stored session.
 */
export function saveSession(session) {
  if (session == null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

/**
 * Shim for components that expect a plain string array.
 * @param {object|null} session
 * @returns {string[]}
 */
export function toWordArray(session) {
  return session?.words ?? [];
}
