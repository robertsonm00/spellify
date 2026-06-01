// pinLockout.js — client-side throttle for the grown-up PIN gate.
//
// The grown-up gate guards the parent area from a curious child, not from a
// determined attacker with the DB dump (see pin.js threat model), so a
// localStorage-backed lockout is the right proportion: it survives a page
// reload — a child can't simply refresh to wipe the counter — while staying
// dependency-free. State is keyed per Supabase user id so two accounts on a
// shared device don't share one lockout.
//
// Record shape (JSON in localStorage): { fails: number, lockedUntil: number|null }
//   fails        running count of consecutive wrong PINs
//   lockedUntil  epoch ms the lock lifts at, or null when not locked

export const MAX_PIN_ATTEMPTS = 5;            // wrong tries before lockout
export const PIN_LOCKOUT_MS    = 10 * 60 * 1000; // 10 minutes

const keyFor = (userId) => `spellify.pinGate.${userId}`;
const EMPTY  = { fails: 0, lockedUntil: null };

// localStorage can throw (private mode, disabled storage) or be absent in
// non-browser contexts — never let the gate crash over a throttle detail.
function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function write(userId, record) {
  const store = safeStorage();
  if (!store || !userId) return;
  try {
    store.setItem(keyFor(userId), JSON.stringify(record));
  } catch { /* storage full / disabled — lockout is best-effort */ }
}

// Read the live lockout record. A lock whose deadline has already passed is
// treated as a clean slate: the wrong attempts have "served their time", so
// the next try starts fresh from a full allowance.
export function readLockout(userId, now = Date.now()) {
  if (!userId) return { ...EMPTY };
  const store = safeStorage();
  if (!store) return { ...EMPTY };
  try {
    const raw = store.getItem(keyFor(userId));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    const lockedUntil = parsed.lockedUntil ? Number(parsed.lockedUntil) : null;
    if (lockedUntil && lockedUntil <= now) return { ...EMPTY };
    return { fails: Number(parsed.fails) || 0, lockedUntil };
  } catch {
    return { ...EMPTY };
  }
}

// True when a record's lock is set and still in the future.
export function isLocked(record, now = Date.now()) {
  return !!(record && record.lockedUntil && record.lockedUntil > now);
}

// Attempts remaining before a lock kicks in (never negative).
export function attemptsLeft(record) {
  return Math.max(0, MAX_PIN_ATTEMPTS - (record?.fails || 0));
}

// Register a wrong attempt and persist it. Returns the updated record; once
// the failure count reaches MAX_PIN_ATTEMPTS the record locks for
// PIN_LOCKOUT_MS.
export function recordFailure(userId, now = Date.now()) {
  const current = readLockout(userId, now);
  const fails   = current.fails + 1;
  const record  = fails >= MAX_PIN_ATTEMPTS
    ? { fails, lockedUntil: now + PIN_LOCKOUT_MS }
    : { fails, lockedUntil: null };
  write(userId, record);
  return record;
}

// Clear all lockout state — call on a correct PIN or once a lock expires.
export function clearLockout(userId) {
  const store = safeStorage();
  if (!store || !userId) return;
  try { store.removeItem(keyFor(userId)); } catch { /* noop */ }
}
