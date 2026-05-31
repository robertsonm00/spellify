/**
 * SR-01 — session-level retry ceiling.
 *
 * The maximum number of DISTINCT wrong words that get a one-time retry
 * round within a single game session.
 *
 * Two rules work together to keep the in-session retry loop humane and
 * bounded (rather than the old "keep going until right" loop that pushed a
 * 14-word session out to round 21/22):
 *
 *   Rule 1 — one retry per word. Enforced per game by a `requeued` Set:
 *            a word that's already been re-queued is never re-queued again.
 *   Rule 2 — this ceiling. Once `requeued.size` reaches SESSION_RETRY_CEILING,
 *            stop adding retry rounds entirely. Further wrong words simply
 *            finish the session and land on the practice list (PRAC-01) via
 *            the normal mastery-credit flow — a child missing words across
 *            the board is better served by finishing and revisiting later
 *            (proper spacing) than by an ever-lengthening session.
 *
 * Shared by Memory Spell, Quiz Quest and Spell Duel (SD-02) so the three
 * games can never disagree on the bound.
 */
export const SESSION_RETRY_CEILING = 3;
