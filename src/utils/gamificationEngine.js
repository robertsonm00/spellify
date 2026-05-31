/**
 * Gamification engine — points economy, badges, player stats.
 *
 * Single entry point used by the hub layer is `recordGameCompleted` which
 * fans out to mastery updates, point awards, and badge checks. Everything
 * is local-only (localStorage). No backend.
 *
 * Point values are placeholders — tune POINTS_CONFIG when the economy is
 * finalised. No game component should hardcode a point value; they all
 * flow through this file.
 */

import {
  recordWordResult,
  getMasteryState,
} from './masteryEngine';
import { getListProgressState } from './wordSelectionEngine';

const STATS_KEY = 'spellify_player_stats';

/* ── Mastery credit framework ─────────────────────────────────────────────
 *
 * Every result from any game is converted to a credit using this table.
 * The mastery engine sums credits per game and flips `mastered` once
 * the total ≥ 2.0 *and* credits have come from ≥ 2 distinct game types.
 *
 *   correct + 1st attempt + no hint  →  +1.00
 *   correct + 1st attempt + hint     →  +0.75
 *   correct + 2nd attempt + no hint  →  +0.50
 *   correct + 2nd attempt + hint     →  +0.25
 *   incorrect after ≥ 2 attempts     →  −0.50  (struggling)
 *   any other outcome                →   0     (1 wrong & moved on, 3+ attempts correct, …)
 *
 * Result entries should carry `{ word, correct, attempts, hintUsed }`.
 * If `attempts` / `hintUsed` are missing we fall back to the legacy
 * binary interpretation (correct → 1.0, incorrect → 0).
 */

const WORDSEARCH_RECOGNITION_FACTOR = 0.5;

export function creditForResult(r) {
  if (!r) return 0;
  const correct  = !!r.correct;
  const attempts = Number.isFinite(r.attempts) ? r.attempts : null;
  const hintUsed = !!r.hintUsed;

  // Legacy callers that only know about `correct` — preserve the old
  // 1.0 / 0 behaviour so partially-updated game components keep working
  // during the rollout.
  if (attempts === null) return correct ? 1.0 : 0;

  if (correct) {
    if (attempts <= 1) return hintUsed ? 0.75 : 1.0;
    if (attempts === 2) return hintUsed ? 0.25 : 0.5;
    return 0; // 3+ attempts to get it right — no credit, but no penalty either
  }
  // Wrong outcomes: only penalise once they tried at least twice.
  if (attempts >= 2) return -0.5;
  return 0;
}

/* ── Placeholder economy — tune in one place ──────────────────────────── */

export const POINTS_CONFIG = {
  gameCompleted:     50,
  wordMastered:      25,
  listCompleted:    200,
  testAllCompleted:  75,
  perfectGame:      100,   // bonus for 100% accuracy in a single game
  streakBonus:       10,   // per-day streak multiplier bonus
};

/* ── Badge taxonomy ───────────────────────────────────────────────────── */

export const BADGE_DEFINITIONS = [
  { id: 'first_game',     name: 'First Spell',     description: 'Completed your first game',          trigger: 'gameCompleted',    condition: { totalGames: 1 },        icon: 'star'    },
  { id: 'word_master_10', name: 'Word Master',     description: 'Mastered 10 words',                  trigger: 'wordMastered',     condition: { totalMastered: 10 },    icon: 'trophy'  },
  { id: 'list_complete',  name: 'List Champion',   description: 'Completed an entire word list',      trigger: 'listCompleted',    condition: {},                       icon: 'medal'   },
  { id: 'test_all_first', name: 'Brave Speller',   description: 'Completed your first Test All',      trigger: 'testAllCompleted', condition: { totalTestAlls: 1 },     icon: 'bolt'    },
  { id: 'perfect_game',   name: 'Perfect Round',   description: 'Got every word right in a single game', trigger: 'perfectGame',   condition: {},                       icon: 'crown'   },
  { id: 'words_50',       name: 'Half Century',    description: 'Mastered 50 words',                  trigger: 'wordMastered',     condition: { totalMastered: 50 },    icon: 'flame'   },
  { id: 'words_100',      name: 'Century Speller', description: 'Mastered 100 words',                 trigger: 'wordMastered',     condition: { totalMastered: 100 },   icon: 'rocket'  },
];

/* ── Player stats storage ─────────────────────────────────────────────── */

function emptyStats() {
  return {
    totalPoints: 0,
    totalLumens: 0,          // secondary currency — 1 per 5 Spell Points
    totalGames: 0,
    totalMastered: 0,
    totalTestAlls: 0,
    badges: [],
    streakDays: 0,
    lastPlayedDate: null,    // ISO yyyy-mm-dd
  };
}

/* ── Level milestones ─────────────────────────────────────────────────── */
// Level is derived from the number of GAMES COMPLETED, not points (LVL-01).
// One finished game = one step toward the next level. Early levels come
// quickly so a child feels momentum immediately, then the gap widens so
// levelling stays meaningful instead of rocketing (the old points curve gave
// Level 4 after just two games):
//
//   Level 2 at 1 game · L3 at 3 · L4 at 5 · L5 at 7, then the gap grows by
//   one each level — L6 at 10 (+3), L7 at 14 (+4), L8 at 19 (+5), L9 at 25…
//
// LEVEL_THRESHOLDS[i] = cumulative games needed to REACH level (i + 1).
// Derived, never stored: level is a pure view over totalGames.
function buildLevelThresholds(maxLevel = 120) {
  const thresholds = [0];          // Level 1 = 0 games
  const earlyGaps  = [1, 2, 2, 2]; // gaps to reach L2, L3, L4, L5
  let cumulative = 0;
  for (let level = 2; level <= maxLevel; level++) {
    const gap = level - 2 < earlyGaps.length
      ? earlyGaps[level - 2]
      : 3 + (level - 6);           // L6 gap = 3, then +1 each level after
    cumulative += gap;
    thresholds.push(cumulative);
  }
  return thresholds;
}

export const LEVEL_THRESHOLDS = buildLevelThresholds();

export function getLevelFromGames(games) {
  const g = Math.max(0, Math.floor(games || 0));
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (g >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

/**
 * Progress within the current level, for the footer XP bar (LVL-01). Each
 * completed game advances the bar by one, so a game that doesn't level the
 * player up still visibly moves them forward.
 *
 * @returns {{ level, gamesIntoLevel, gamesForLevel, percent, nextLevelAt, isMax }}
 */
export function getLevelProgress(games) {
  const g = Math.max(0, Math.floor(games || 0));
  const level     = getLevelFromGames(g);
  const currentAt = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextAt    = LEVEL_THRESHOLDS[level] ?? null;
  if (nextAt == null) {
    return { level, gamesIntoLevel: g - currentAt, gamesForLevel: 0, percent: 100, nextLevelAt: null, isMax: true };
  }
  const span = nextAt - currentAt;
  const into = g - currentAt;
  const percent = span > 0 ? Math.max(0, Math.min(100, Math.round((into / span) * 100))) : 0;
  return { level, gamesIntoLevel: into, gamesForLevel: span, percent, nextLevelAt: nextAt, isMax: false };
}

// Lumens per 5 points (integer floor).
export function lumensFromPoints(points) {
  return Math.floor(Math.max(0, points) / 5);
}

export function getPlayerStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    return { ...emptyStats(), ...JSON.parse(raw) };
  } catch {
    return emptyStats();
  }
}

function savePlayerStats(stats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* ignore */ }
}

/* ── Points ───────────────────────────────────────────────────────────── */

/**
 * Add points for a single named event. Returns the delta + new total.
 * Does NOT trigger badge checks — caller is responsible for orchestration
 * (typically via `recordGameCompleted`).
 */
export function awardPoints(eventType /* , metadata */) {
  const stats = getPlayerStats();
  const points = POINTS_CONFIG[eventType] || 0;
  const newTotal = stats.totalPoints + points;
  savePlayerStats({ ...stats, totalPoints: newTotal });
  return { pointsAwarded: points, newTotal };
}

/* ── Badges ───────────────────────────────────────────────────────────── */

function meetsCondition(condition, stats) {
  if (!condition) return true;
  if (condition.totalGames     != null && stats.totalGames     < condition.totalGames)     return false;
  if (condition.totalMastered  != null && stats.totalMastered  < condition.totalMastered)  return false;
  if (condition.totalTestAlls  != null && stats.totalTestAlls  < condition.totalTestAlls)  return false;
  if (condition.totalPoints    != null && stats.totalPoints    < condition.totalPoints)    return false;
  return true;
}

/**
 * Check every badge whose trigger matches `eventType`. Award any that the
 * player has just qualified for and hasn't already earned.
 */
export function checkAndAwardBadges(eventType, playerStats) {
  const currentStats = playerStats || getPlayerStats();
  const owned = new Set(currentStats.badges || []);
  const newBadges = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (badge.trigger !== eventType) continue;
    if (owned.has(badge.id))         continue;
    if (!meetsCondition(badge.condition, currentStats)) continue;
    newBadges.push(badge);
    owned.add(badge.id);
  }

  if (newBadges.length > 0) {
    savePlayerStats({ ...currentStats, badges: Array.from(owned) });
  }
  return { newBadges };
}

/* ── Streak helper ────────────────────────────────────────────────────── */

function today() { return new Date().toISOString().slice(0, 10); }

function rollStreak(stats) {
  const t = today();
  if (stats.lastPlayedDate === t) return stats.streakDays || 0;        // already counted today
  if (!stats.lastPlayedDate)      return 1;                            // first play
  const last = new Date(stats.lastPlayedDate);
  const now  = new Date(t);
  const diff = Math.round((now - last) / 86400000);
  return diff === 1 ? (stats.streakDays || 0) + 1 : 1;                 // contiguous = +1, else reset
}

/* ── Main entry point ─────────────────────────────────────────────────── */

/**
 * Called from the hub layer (e.g. ListHub's onComplete) at the end of
 * every game.
 *
 * @param {string}  listId
 * @param {string}  gameName    canonical activity id, e.g. 'quizquest'
 * @param {number}  accuracy    0–100
 * @param {Array}   wordResults array of { word, correct }
 * @param {Array<string>} [fullWordList]  whole list — required to detect
 *                                        list completion. If omitted,
 *                                        listCompleted is always false.
 * @param {object}  [opts]
 * @param {boolean} [opts.isTestAll]  flag this run as a Test-All session
 * @returns {{ pointsAwarded, newBadges, wordsMastered, listCompleted }}
 */
export function recordGameCompleted(
  listId,
  gameName,
  accuracy,
  wordResults = [],
  fullWordList = null,
  opts = {},
) {
  const safeAccuracy = Number.isFinite(accuracy) ? accuracy : 0;
  const isTestAll = !!opts.isTestAll;

  // 1) Mastery — write per-word results
  //
  // Each result is converted to a *credit* score using the framework
  // below and forwarded to the mastery engine. The engine accumulates
  // credit per game type and flips `mastered` when the credit hits 2.0
  // across at least 2 distinct game types.
  //
  // Word Search is recognition (find the word in a grid) rather than
  // recall, so its contribution is dialled down to 50%.
  let wordsMastered = 0;
  for (const r of wordResults) {
    if (!r || !r.word) continue;
    let credit = creditForResult(r);
    if (gameName === 'wordsearch') credit *= WORDSEARCH_RECOGNITION_FACTOR;
    const { wordMastered } = recordWordResult(listId, r.word, gameName, credit);
    if (wordMastered) wordsMastered += 1;
  }

  // 2) Player stats roll-forward (games, streak, mastered tally)
  let stats     = getPlayerStats();
  const streak  = rollStreak(stats);
  // Snapshot the games count BEFORE the increment so we can detect a
  // level-up (LVL-02). Level is derived purely from games completed.
  const gamesBefore = stats.totalGames || 0;
  stats = {
    ...stats,
    totalGames:     stats.totalGames + 1,
    totalMastered:  stats.totalMastered + wordsMastered,
    totalTestAlls:  stats.totalTestAlls + (isTestAll ? 1 : 0),
    streakDays:     streak,
    lastPlayedDate: today(),
  };
  savePlayerStats(stats);

  // 3) Detect list completion (needs fullWordList)
  let listCompleted = false;
  if (Array.isArray(fullWordList) && fullWordList.length > 0) {
    const prog = getListProgressState(fullWordList, getMasteryState(listId));
    listCompleted = prog.status === 'completed';
  }

  // 4) Award points — sum the relevant events
  let pointsAwarded = 0;
  pointsAwarded += POINTS_CONFIG.gameCompleted;
  pointsAwarded += wordsMastered * POINTS_CONFIG.wordMastered;
  if (safeAccuracy >= 100)        pointsAwarded += POINTS_CONFIG.perfectGame;
  if (isTestAll)                  pointsAwarded += POINTS_CONFIG.testAllCompleted;
  if (listCompleted)              pointsAwarded += POINTS_CONFIG.listCompleted;
  // Streak bonus — small recurring perk for daily play. Cap at 7 so the
  // economy isn't dominated by long streaks.
  pointsAwarded += POINTS_CONFIG.streakBonus * Math.min(streak, 7);

  const lumensAwarded = lumensFromPoints(pointsAwarded);
  stats = {
    ...stats,
    totalPoints: stats.totalPoints + pointsAwarded,
    totalLumens: (stats.totalLumens || 0) + lumensAwarded,
  };
  savePlayerStats(stats);

  // 5) Badge checks — fire each relevant trigger so condition sets compose
  const newBadges = [];
  const fire = (eventType) => {
    const { newBadges: earned } = checkAndAwardBadges(eventType, getPlayerStats());
    newBadges.push(...earned);
  };

  fire('gameCompleted');
  if (wordsMastered > 0)   fire('wordMastered');
  if (safeAccuracy >= 100) fire('perfectGame');
  if (isTestAll)           fire('testAllCompleted');
  if (listCompleted)       fire('listCompleted');

  // 6) Level transition (LVL-01/LVL-02) — derived from games completed.
  const previousLevel = getLevelFromGames(gamesBefore);
  const level         = getLevelFromGames(gamesBefore + 1);
  const leveledUp     = level > previousLevel;

  return {
    pointsAwarded, lumensAwarded, newBadges, wordsMastered, listCompleted,
    previousLevel, level, leveledUp,
  };
}
