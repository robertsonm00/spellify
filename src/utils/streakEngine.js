// streakEngine — daily-streak tracking, localStorage only.
//
// One key, one object:
//   spellify_streak = {
//     currentStreak:  number,
//     longestStreak:  number,
//     lastPlayedDate: 'YYYY-MM-DD' | null,
//     graceUsed:      boolean,        // grace day used in the current run
//     lastUpdated:    timestamp
//   }
//
// Rules:
//   • played today again → no change (idempotent)
//   • played yesterday   → +1, graceUsed resets to false
//   • played 2 days ago + no grace yet → +1, graceUsed becomes true
//   • played 2 days ago + grace already used → reset to 1
//   • played 3+ days ago → reset to 1
//   • first ever play    → 1
// longestStreak always tracks max(currentStreak, longestStreak).
//
// recordPlayToday() also fires a 'spellify-streak-milestone' window
// event when the streak crosses 3/7/14/30/50, so the top-level App can
// hook celebration confetti regardless of which surface launched the
// game.

const STORAGE_KEY = 'spellify_streak';
const MILESTONES  = [3, 7, 14, 30, 50];

function defaultStreak() {
  return {
    currentStreak:  0,
    longestStreak:  0,
    lastPlayedDate: null,
    graceUsed:      false,
    lastUpdated:    0,
  };
}

// Normalise to a stable 'YYYY-MM-DD' in the local timezone (so a
// midnight rollover behaves the way a child experiences it on their
// device, not in UTC).
function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(isoA, isoB) {
  if (!isoA || !isoB) return Infinity;
  const a = new Date(isoA + 'T00:00:00');
  const b = new Date(isoB + 'T00:00:00');
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStreak();
    const parsed = JSON.parse(raw);
    return {
      ...defaultStreak(),
      ...parsed,
    };
  } catch {
    return defaultStreak();
  }
}

function write(streak) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(streak));
  } catch {
    /* ignore storage failures */
  }
}

/** Reads the persisted streak (or returns a fresh zero object). */
export function getStreak() {
  return read();
}

/**
 * Idempotent: call after every completed game session.
 * Returns the updated streak object. When a milestone is crossed the
 * returned object includes a `milestoneReached: number` field and a
 * 'spellify-streak-milestone' window event is dispatched with that
 * milestone in `event.detail.milestone`.
 */
export function recordPlayToday(now = new Date()) {
  const today = todayISO(now);
  const prev  = read();

  // Already counted today — nothing to do.
  if (prev.lastPlayedDate === today) {
    return { ...prev };
  }

  let { currentStreak, longestStreak, lastPlayedDate, graceUsed } = prev;

  if (!lastPlayedDate) {
    // First play ever.
    currentStreak = 1;
    graceUsed     = false;
  } else {
    const gap = daysBetween(lastPlayedDate, today);
    if (gap === 1) {
      // Played yesterday — continue and reset grace.
      currentStreak += 1;
      graceUsed = false;
    } else if (gap === 2 && !graceUsed) {
      // Missed one day, grace not yet used this streak.
      currentStreak += 1;
      graceUsed = true;
    } else {
      // Streak broken — either missed two days with grace already used,
      // missed three or more days, or any negative/zero gap from a
      // device clock change.
      currentStreak = 1;
      graceUsed     = false;
    }
  }

  if (currentStreak > longestStreak) longestStreak = currentStreak;

  const next = {
    currentStreak,
    longestStreak,
    lastPlayedDate: today,
    graceUsed,
    lastUpdated:    Date.now(),
  };
  write(next);

  // Milestone celebration hook — single-day crossings only (we don't
  // re-fire 7 if the child somehow jumped from 5 to 7 in one tick, but
  // in normal use the streak grows one day at a time so this is fine).
  if (MILESTONES.includes(currentStreak) && currentStreak !== prev.currentStreak) {
    next.milestoneReached = currentStreak;
    try {
      window.dispatchEvent(new CustomEvent('spellify-streak-milestone', {
        detail: { milestone: currentStreak, streak: next },
      }));
    } catch { /* SSR / non-browser */ }
  }

  return next;
}

/**
 * Status used by the App-level streak pop-up to pick a message.
 *
 *   'played'  — already counted today
 *   'at_risk' — missed yesterday, grace still available (urgent)
 *   'active'  — streak alive, haven't played today yet
 *   'none'    — no streak (zero or never played)
 */
export function getStreakStatus(now = new Date()) {
  const s = read();
  if (!s.currentStreak || !s.lastPlayedDate) return 'none';

  const today = todayISO(now);
  if (s.lastPlayedDate === today) return 'played';

  const gap = daysBetween(s.lastPlayedDate, today);
  if (gap === 2 && !s.graceUsed) return 'at_risk';
  if (gap >= 1) return 'active';
  return 'active';
}

/**
 * Return an array of length 7 representing Mon→Sun of the current
 * week (locale Monday-start), with each entry:
 *   { iso, dayLabel, isToday, isFuture, played }
 *
 * "played" is true if that day equals (or is at most one day before)
 * `lastPlayedDate` AND falls within the run of `currentStreak` days.
 * It's an approximation — we don't persist a per-day log — but it's
 * accurate for the active streak window which is what kids care about.
 */
export function getWeekView(now = new Date()) {
  const s = read();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Monday of the current week (JS getDay: 0=Sun..6=Sat).
  const dow = today.getDay();
  const mondayOffset = (dow + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const last = s.lastPlayedDate ? new Date(s.lastPlayedDate + 'T00:00:00') : null;
  const streakStart = last
    ? new Date(last.getTime() - (s.currentStreak - 1) * 86400000)
    : null;

  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = todayISO(d);
    const isToday  = d.getTime() === today.getTime();
    const isFuture = d.getTime() > today.getTime();
    const played   = !!streakStart && d >= streakStart && (last && d <= last);
    return { iso, dayLabel: labels[i], isToday, isFuture, played };
  });
}

// Exposed for tests / verification.
export const _streakInternals = {
  STORAGE_KEY,
  MILESTONES,
  todayISO,
  daysBetween,
  defaultStreak,
};
