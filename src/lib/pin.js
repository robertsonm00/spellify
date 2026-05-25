// pin.js — client-side hash + verify for the grown-up area PIN.
//
// We use PBKDF2-SHA256 with 100,000 iterations, the user's
// profiles.id (== auth.uid) as the salt, and a 256-bit derived hash
// stored hex-encoded. Why these choices:
//
//   • PBKDF2 is supported natively by Web Crypto in every modern
//     browser — no bcrypt build dependency. 100k iterations adds
//     ~50–100ms of CPU on a typical laptop, fine for a one-shot
//     PIN check and slow enough to make offline brute-force of the
//     ~10,000-combo PIN space tedious if the hash leaks.
//
//   • The salt is the parent's user id. Non-secret but unique per
//     account — stops a single rainbow table from cracking all PINs
//     in the database at once.
//
//   • Threat model is "kid pokes around on shared device", not
//     "determined attacker with the DB dump". For the second case
//     we'd add server-side rate limiting + a longer-PIN option.
//
// API:
//   hashPin(pin, salt)   → Promise<string>   — hex digest
//   verifyPin(pin, salt, hash) → Promise<boolean>
//   isValidPinShape(pin) → boolean            — "4 digits"

const ITERATIONS = 100_000;
const HASH_BITS  = 256;

export function isValidPinShape(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

export async function hashPin(pin, salt) {
  if (!isValidPinShape(pin)) throw new Error('PIN must be exactly 4 digits');
  if (!salt) throw new Error('hashPin requires a salt (use the parent user id)');
  if (!window?.crypto?.subtle) throw new Error('Web Crypto is unavailable in this browser');

  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name:       'PBKDF2',
      salt:       enc.encode(String(salt)),
      iterations: ITERATIONS,
      hash:       'SHA-256',
    },
    baseKey,
    HASH_BITS,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPin(pin, salt, hash) {
  if (!hash) return false;
  try {
    const candidate = await hashPin(pin, salt);
    // Constant-time-ish compare (length is fixed so a length check
    // first is fine). Doesn't matter much for a 4-digit PIN but
    // costs nothing.
    if (candidate.length !== hash.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) {
      diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    return diff === 0;
  } catch (e) {
    console.warn('[pin] verify failed', e);
    return false;
  }
}
