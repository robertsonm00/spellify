/**
 * formatDuration — turn a number of seconds into a short, child-friendly
 * "Xm Ys" / "Ys" string for the Variant B results tiles (RES-01).
 *
 * Shared by every "find-them-all" game (Crossword, Word Search, Memory Match,
 * Write It) so the Time tile reads identically across all of them.
 *
 *   formatDuration(8)   → "8s"
 *   formatDuration(72)  → "1m 12s"
 *   formatDuration(125) → "2m 5s"
 */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
