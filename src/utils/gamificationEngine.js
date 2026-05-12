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
    totalGames: 0,
    totalMastered: 0,
    totalTestAlls: 0,
    badges: [],
    streakDays: 0,
    lastPlayedDate: null,    // ISO yyyy-mm-dd
  };
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
  let wordsMastered = 0;
  for (const r of wordResults) {
    if (!r || !r.word) continue;
    const { wordMastered } = recordWordResult(listId, r.word, gameName, !!r.correct);
    if (wordMastered) wordsMastered += 1;
  }

  // 2) Player stats roll-forward (games, streak, mastered tally)
  let stats     = getPlayerStats();
  const streak  = rollStreak(stats);
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

  stats = { ...stats, totalPoints: stats.totalPoints + pointsAwarded };
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

  return { pointsAwarded, newBadges, wordsMastered, listCompleted };
}
