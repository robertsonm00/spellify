export const STORAGE_KEY = 'spellify_session_v2';
export const LEGACY_KEY  = 'spellify_session_v1';

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
 * Tries v2 key first; falls back to v1 and migrates to v2 shape.
 * Returns null if nothing is found.
 */
export function loadSession() {
  try {
    const v2Raw = localStorage.getItem(STORAGE_KEY);
    if (v2Raw) return JSON.parse(v2Raw);

    const v1Raw = localStorage.getItem(LEGACY_KEY);
    if (v1Raw) {
      const v1 = JSON.parse(v1Raw);
      // Migrate v1 → v2
      return {
        _version: 2,
        year:    v1.year   ?? null,
        age:     v1.age    ?? null,
        sourceMode:   'generated',
        dyslexiaMode: false,
        words:        v1.words           ?? [],
        wordObjects:  [],
        activityStatuses: v1.activityStatuses ?? { ...INITIAL_STATUSES },
        mastery:     {},
        reviewQueue: [],
      };
    }
  } catch {
    // corrupted storage — fall through
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
