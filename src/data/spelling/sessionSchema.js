// Derived from the canonical activity registry so adding a new game
// in src/data/activities.js automatically extends INITIAL_STATUSES
// without needing a parallel edit here.
import { ACTIVITIES } from '../activities';

export const STORAGE_KEY   = 'spellify_session_v2';
export const LEGACY_KEY_V1 = 'spellify_session_v1';
export const LEGACY_KEY_V0 = 'spellify_session';      // bare key used by earliest builds

/** @deprecated kept for external references; prefer LEGACY_KEY_V1 */
export const LEGACY_KEY = LEGACY_KEY_V1;

export const INITIAL_STATUSES = Object.fromEntries(
  ACTIVITIES.map((a) => [a.id, 'not-started'])
);

/**
 * Build a fresh v2 session object.
 *
 * Note on the SEN/confidence model (added Phase 1 Step 5):
 *   - `spellingConfidence`: 'easy' | 'tricky' | 'often-tricky' — answer to
 *     the onboarding "How does your child find spelling?" question. Drives
 *     a default `dyslexiaMode` and `difficulty` mapping, both of which
 *     can be overridden later.
 *   - `senProfile`: string[] — optional self-reported SEN tags (e.g.
 *     'dyslexia', 'adhd'). When the array contains 'dyslexia' the
 *     effective Support Mode is forced on regardless of confidence.
 *
 * @param {{ year, age, words, wordObjects, sourceMode, dyslexiaMode,
 *           ruleKey, ruleLabel, spellingConfidence, senProfile }} opts
 * @returns {object}
 */
export function createSession({
  year, age, words = [], wordObjects = [],
  sourceMode = 'generated', dyslexiaMode = false,
  ruleKey = null, ruleLabel = null,
  spellingConfidence = 'tricky',
  senProfile = [],
}) {
  return {
    _version: 2,
    year,
    age,
    sourceMode,            // 'generated' | 'manual' | 'uploaded'
    dyslexiaMode,          // boolean — effective Support Mode
    spellingConfidence,    // 'easy' | 'tricky' | 'often-tricky'
    senProfile,            // string[] — e.g. ['dyslexia'], [] for none / prefer-not-to-say
    words,                 // string[]
    wordObjects,           // { word, year, difficulty }[]
    ruleKey,               // RULE_BUCKET_PICKER — null or e.g. 'splitDigraphs'
    ruleLabel,             // RULE_BUCKET_PICKER — null or e.g. 'Split digraphs (a-e / i-e / o-e)'
    activityStatuses: { ...INITIAL_STATUSES },
    activityProgress: {},
    activityCompletions: {},
    mastery:     {},
    reviewQueue: [],
  };
}

/**
 * Maps a spellingConfidence answer to default `dyslexiaMode` and
 * `difficulty` values. The Support Mode toggle on the same step (and in
 * Settings) can override `dyslexiaMode` independently; this is just the
 * default the answer suggests.
 */
export function confidenceToDefaults(confidence) {
  switch (confidence) {
    case 'easy':         return { dyslexiaMode: false, difficulty: 'hard'   };
    case 'often-tricky': return { dyslexiaMode: true,  difficulty: 'easy'   };
    case 'tricky':
    default:             return { dyslexiaMode: false, difficulty: 'medium' };
  }
}

/**
 * Derive the SEN-profile string consumed by wordSelectionEngine
 * (`getActiveWindow`) from the structured session fields. Returns one of
 * the existing SEN_PROFILES strings or null.
 *
 * Trigger: spellingConfidence === 'often-tricky' OR senProfile contains
 * 'dyslexia'. Either condition activates the SEN multiplier in the
 * selection schedule (consolidating window x2, retained frequency x2).
 */
export function effectiveSenProfile(session) {
  if (!session) return null;
  const sen = Array.isArray(session.senProfile) ? session.senProfile : [];
  if (sen.includes('dyslexia'))                    return 'dyslexia';
  if (session.spellingConfidence === 'often-tricky') return 'often-tricky';
  return null;
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
    if (v2Raw) {
      const s = JSON.parse(v2Raw);
      // Ensure fields added after the first v2 release have safe defaults
      // so sessions created before them still work correctly.
      return {
        childName:          '',
        childCharacter:     null,
        difficulty:         'medium',
        spellingConfidence: 'tricky',
        senProfile:         [],
        ...s,
      };
    }

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
        spellingConfidence: old.spellingConfidence ?? 'tricky',
        senProfile:         Array.isArray(old.senProfile) ? old.senProfile : [],
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

// ── Mastery tracking ───────────────────────────────────────────────────────

/**
 * Record the outcome of one word attempt.
 * Returns a new session with mastery[word] incremented.
 *
 * @param {object}  session
 * @param {string}  word
 * @param {boolean} correct
 * @returns {object}
 */
export function updateMastery(session, word, correct) {
  const key     = word.toLowerCase();
  const current = session?.mastery?.[key] || { attempts: 0, correct: 0 };
  return {
    ...session,
    mastery: {
      ...(session?.mastery || {}),
      [key]: {
        attempts: current.attempts + 1,
        correct:  current.correct + (correct ? 1 : 0),
      },
    },
  };
}

/**
 * Return the mastery rate (0–1) for a word, or null if never attempted.
 *
 * @param {object} session
 * @param {string} word
 * @returns {number|null}
 */
export function getMasteryRate(session, word) {
  const entry = session?.mastery?.[word.toLowerCase()];
  if (!entry || entry.attempts === 0) return null;
  return entry.correct / entry.attempts;
}

/**
 * Return the saved mid-session progress for an activity, or null.
 * @param {object} session
 * @param {string} id  activity key, e.g. 'memoryspell'
 */
export function getActivityProgress(session, id) {
  return session?.activityProgress?.[id] ?? null;
}

/**
 * Return a new session with the progress snapshot stored for an activity.
 * Pass null as progress to clear it.
 * @param {object} session
 * @param {string} id
 * @param {object|null} progress
 */
export function setActivityProgress(session, id, progress) {
  const next = { ...(session?.activityProgress || {}) };
  if (progress == null) {
    delete next[id];
  } else {
    next[id] = progress;
  }
  return { ...session, activityProgress: next };
}

/**
 * Rebuild session.reviewQueue — every word that has been attempted at least
 * once but whose mastery rate is below the 0.6 threshold.
 *
 * @param {object} session
 * @returns {object}  new session with updated reviewQueue
 */
export function rebuildReviewQueue(session) {
  const queue = (session.words || []).filter((w) => {
    const rate = getMasteryRate(session, w);
    return rate !== null && rate < 0.6;
  });
  return { ...session, reviewQueue: queue };
}
