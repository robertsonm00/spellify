import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ACTIVITIES } from '../../data/activities';
import { getActivityAvailability } from '../../utils/activityAvailability';
import { renderExploreActivity } from './exploreActivityRunner';
import {
  getActiveWindow,
  getListProgressState,
} from '../../utils/wordSelectionEngine';
import { effectiveSenProfile } from '../../data/spelling/sessionSchema';
import {
  getMasteryState,
  saveMasteryState,
  getUnmasteredWords,
  recordWordResult,
  getAllStrugglingWords,
} from '../../utils/masteryEngine';
import { recordGameCompleted, getPlayerStats } from '../../utils/gamificationEngine';
import { recordPlayToday } from '../../utils/streakEngine';
import { fireBuddyCheer } from '../BuddyAvatar';
import confetti from 'canvas-confetti';
import CompletionTicks from '../CompletionTicks';
import PracticeWriteIt from '../PracticeWriteIt';
import { WordDetailModal, preSeedWordInfoCache } from '../WordListHub';
import '../WordListHub.css';
import './ListHub.css';
import './ListHubCards.css';

// Painted card art for the cards view. Prefers a dedicated *_gametile.png
// where supplied (Word Search, Memory Spell, Crossword, Quiz Quest), falls
// back to the matching full-scene background PNG otherwise, and finally to
// the emoji placeholder defined on the activity for games with no art yet.
// Filenames mirror the live public/adventure/ folder; URL-encoded at use
// site so spaces and the stray trailing space on some filenames are safe.
const GAME_ART = {
  wordsearch:  '/adventure/Wordsearch_gametile.png',
  memoryspell: '/adventure/Memory_spell_gametile.png',
  crossword:   '/adventure/Crossword_gametile.png',
  quizquest:   '/adventure/Quiz_quest_gametile.png',
  // Fallbacks — full-scene background images. Swap to *_gametile.png as
  // dedicated tiles are produced.
  hangman:     '/adventure/Spell Duel background .png',
  syllabletap: '/adventure/Sylaball tap background.png',
  writeit:     '/adventure/Write it background.png',
  // weakspot + wordforge currently have no painted art → emoji placeholder.
};
const encodeArtUrl = (path) =>
  path ? `${process.env.PUBLIC_URL || ''}${path.replace(/ /g, '%20')}` : null;

const MASTERY_LABELS = { new: 'Not tried yet', learning: 'Keep practising', mastered: 'Mastered!' };

// ── Animated reward counter — shown after game completion ────────────────────
// Phase 1: points count up (with tick sound).
// Phase 2: lumens count up (with cha-ching sound) ~0.5s after points settle.

function playTickSound(ctx) {
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05);
  } catch { /* noop */ }
}

function playChaChing(ctx) {
  try {
    // Rising "ca-" note then falling "ching" — classic cash register feel
    [[880, 0, 0.12, 0.14], [1320, 0.08, 0.18, 0.22], [660, 0.18, 0.22, 0.55]].forEach(([freq, start, peak, end]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + peak);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + end);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + end + 0.05);
    });
    // Sparkle top-notes
    [1760, 2200].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + 0.1 + i * 0.06;
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t); osc.stop(t + 0.3);
    });
  } catch { /* noop */ }
}

function RewardSequence({ fromPoints, toPoints, fromLumens, toLumens, onDone }) {
  const [displayPoints, setDisplayPoints] = useState(fromPoints);
  const [displayLumens, setDisplayLumens] = useState(fromLumens);
  const [phase, setPhase] = useState('points'); // 'points' | 'lumens' | 'done'
  const audioCtxRef = useRef(null);

  // Points counter — ticks up over ~1.2s
  useEffect(() => {
    let cancelled = false;
    const pointsDelta = toPoints - fromPoints;
    if (pointsDelta <= 0) { setPhase('lumens'); return; }

    try { audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* noop */ }

    const duration = Math.min(1400, Math.max(600, pointsDelta * 8));
    const start = performance.now();
    let lastTick = -1;
    const tick = (now) => {
      if (cancelled) return;
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 2;
      const current = Math.round(fromPoints + eased * pointsDelta);
      setDisplayPoints(current);
      // Play a tick every ~50ms
      const tickBucket = Math.floor(t * 20);
      if (tickBucket !== lastTick && audioCtxRef.current) {
        playTickSound(audioCtxRef.current);
        lastTick = tickBucket;
      }
      if (t < 1) requestAnimationFrame(tick);
      else setTimeout(() => { if (!cancelled) setPhase('lumens'); }, 500);
    };
    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lumens counter — fires after points settle
  useEffect(() => {
    if (phase !== 'lumens') return;
    let cancelled = false;
    const lumensDelta = toLumens - fromLumens;
    if (lumensDelta <= 0) { setPhase('done'); return; }

    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      playChaChing(ctx);
    } catch { /* noop */ }

    const duration = Math.min(1200, Math.max(500, lumensDelta * 40));
    const start = performance.now();
    const tick = (now) => {
      if (cancelled) return;
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 2;
      setDisplayLumens(Math.round(fromLumens + eased * lumensDelta));
      if (t < 1) requestAnimationFrame(tick);
      else setTimeout(() => { if (!cancelled) setPhase('done'); }, 900);
    };
    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss after 'done'
  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  const pointsGain = toPoints - fromPoints;
  const lumensGain = toLumens  - fromLumens;

  return (
    <div className="lh-reward-overlay" role="status" aria-live="polite" onClick={onDone}>
      <div className="lh-reward-card" onClick={e => e.stopPropagation()}>
        <p className="lh-reward-heading">🎉 Game complete!</p>

        {/* Points row */}
        <div className={`lh-reward-row${phase === 'points' ? ' lh-reward-row--active' : ''}`}>
          <span className="lh-reward-icon">⭐</span>
          <span className="lh-reward-label">Spell Points</span>
          <span className="lh-reward-num">{displayPoints.toLocaleString()}</span>
          {phase !== 'points' && pointsGain > 0 && (
            <span className="lh-reward-gain">+{pointsGain}</span>
          )}
        </div>

        {/* Lumens row */}
        <div className={`lh-reward-row${phase === 'lumens' ? ' lh-reward-row--active' : phase === 'done' && lumensGain > 0 ? ' lh-reward-row--settled' : ''}`}>
          <span className="lh-reward-icon">💎</span>
          <span className="lh-reward-label">Lumens</span>
          <span className="lh-reward-num">{displayLumens.toLocaleString()}</span>
          {phase === 'done' && lumensGain > 0 && (
            <span className="lh-reward-gain">+{lumensGain}</span>
          )}
        </div>

        <p className="lh-reward-dismiss">Tap anywhere to continue</p>
      </div>
    </div>
  );
}

const WORD_CHIP_COLORS = [
  { bg: '#fff0f0', border: '#ff6b6b' },
  { bg: '#fff8e1', border: '#ffd93d' },
  { bg: '#f0fff4', border: '#6bcb77' },
  { bg: '#e8f4ff', border: '#4d96ff' },
  { bg: '#f5f0ff', border: '#c77dff' },
  { bg: '#fff4ec', border: '#ff9f43' },
  { bg: '#f0ffff', border: '#00d2d3' },
  { bg: '#fff0f8', border: '#ff6b9d' },
];

function TestAllModal({ unmasteredWords, onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="hub-testall-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Choose a Test All game">
      <div className="hub-testall-modal" onClick={(e) => e.stopPropagation()}>
        <button className="hub-testall-modal-close" onClick={onClose} aria-label="Close">✕</button>
        <p className="hub-testall-modal-title">Pick a game</p>
        <p className="hub-testall-modal-sub">
          {unmasteredWords.length} word{unmasteredWords.length !== 1 ? 's' : ''} to test
        </p>
        <div className="hub-testall-modal-options">
          <button className="hub-testall-pick hub-testall-pick--quiz" onClick={() => onPick('quizquest')}>
            🏆 Quiz Quest
          </button>
          <button className="hub-testall-pick hub-testall-pick--memory" onClick={() => onPick('memoryspell')}>
            🧠 Memory Spell
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ListHub({
  list,
  listType = 'curriculum',
  session = null,
  onBack,
  getListProgress,
  markComplete,
  user,
  onCreateAccount = null,
  // 'map' when opened from the Adventure Map — shows "Next word list →" in
  // the mastery modal so the player returns to the map to advance the stage.
  // 'internal' (default) for lists opened from within ExploreDashboard.
  listOrigin = 'internal',
  /* Optional injection slots so wrappers (e.g. ExploreDashboard) can drop
     custom UI inside the WORD LIST panel without forking ListHub. */
  listNamePanel = null,
  listFooter   = null,
}) {
  const [activeActivity, setActiveActivity] = useState(null);
  const [progress,       setProgress]       = useState({});
  // Practice Quest — focused single-slot practice for struggling words.
  // Lives outside the normal activity-registry flow because it can be
  // launched from the hub layer too, not just the game grid.
  const [practiceItems,  setPracticeItems]  = useState(null);
  // Batched practice (PRAC-01 / SR-01 Rule 3): the global struggling pool is
  // surfaced in sets of 3. `practiceQueue` is the ordered snapshot taken at
  // launch; `practiceBatchStart` is the cursor into it; `nextSetModal` shows
  // the gentle "do another set?" prompt between batches.
  const [practiceQueue,    setPracticeQueue]    = useState([]);
  const [practiceBatchStart, setPracticeBatchStart] = useState(0);
  const [nextSetModal,     setNextSetModal]     = useState(false);
  // Test-All flow: 'idle' → user clicks → 'choose' → picks game → 'running' →
  // completes → back to 'idle'. While 'running', activity words are the
  // full unmastered list and isTestAll: true flows into recordGameCompleted.
  const [testAllStage, setTestAllStage] = useState('idle');
  const [activeWord, setActiveWord] = useState(null);
  // ── Reward sequence — animated points + lumens counter after a game ───────
  // null = hidden; object = { fromPoints, toPoints, fromLumens, toLumens }
  const [rewardSequence, setRewardSequence] = useState(null);

  // ── Mastery progress tooltip ──────────────────────────────────────────────
  const [masteryTipOpen, setMasteryTipOpen] = useState(false);

  // Words drawer open/closed in cards view (secondary panel — the user
  // explicitly asked for words to remain accessible but not dominate).
  const [wordsDrawerOpen, setWordsDrawerOpen] = useState(false);

  // ── Cards-view onboarding coach ───────────────────────────────────────────
  // First-visit tour: highlight Words button → open drawer → close drawer →
  // mastery prompt. Phases: 'find-words' | 'mastery' | 'off'.
  const COACH_LH_KEY = 'spellify.lh.cards.onboarding.v1';
  const [coachPhase, setCoachPhase] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem(COACH_LH_KEY)) {
        return 'off';
      }
    } catch { /* private mode — coach is fine to show */ }
    return 'find-words';
  });
  const dismissCoach = useCallback(() => {
    setCoachPhase('off');
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(COACH_LH_KEY, '1');
    } catch { /* ignore */ }
  }, []);
  // Once the user opens the drawer during 'find-words', flip this flag.
  // Closing the drawer afterwards advances to the mastery prompt.
  const coachDrawerSeenRef = useRef(false);
  useEffect(() => {
    if (coachPhase !== 'find-words') return;
    if (wordsDrawerOpen) {
      coachDrawerSeenRef.current = true;
    } else if (coachDrawerSeenRef.current) {
      setCoachPhase('mastery');
    }
  }, [coachPhase, wordsDrawerOpen]);

  // ── Word Mastery modal (Part 4) ───────────────────────────────────────────
  // Show once when ALL words in the list are mastered during this session.
  // We compare the previous listProgress.status to detect the transition.
  const [showMasteryModal, setShowMasteryModal] = useState(false);
  // Ref stores the status from the PREVIOUS render cycle so we can detect
  // a transition to 'completed' rather than re-showing on every render.
  const prevListStatusRef = useRef(null);   // null = not yet initialised

  // Track which activities the child has started but not finished, so we can
  // flip the card CTA from "Play ▶" to "Continue ▶". Persisted per-list.
  const startedKey = `spellify_started_${list.id}`;
  const [startedActivities, setStartedActivities] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(startedKey) || '[]')); }
    catch { return new Set(); }
  });
  useEffect(() => {
    localStorage.setItem(startedKey, JSON.stringify([...startedActivities]));
  }, [startedActivities, startedKey]);

  // Snapshot the word selection used at the moment a game was started, so
  // mastery changes (from OTHER games) don't shuffle the list mid-session.
  const lockedKey = `spellify_locked_words_${list.id}`;
  const [lockedWords, setLockedWords] = useState(() => {
    try { return JSON.parse(localStorage.getItem(lockedKey) || '{}'); }
    catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem(lockedKey, JSON.stringify(lockedWords));
  }, [lockedWords, lockedKey]);

  // Pre-seed the word-info cache with the inline definitions from this list so
  // the word detail modal never falls through to the external dictionary API
  // for words the curriculum list already defines.
  useEffect(() => { preSeedWordInfoCache(list.words || []); }, [list.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const fullWords = useMemo(
    () => (list.words || []).map(w => (typeof w === 'string' ? w : w.word)),
    [list.words]
  );

  // Bump this when a game finishes so we re-read mastery from localStorage
  // and rotate freshly-mastered words out of the active window.
  const [masteryTick, setMasteryTick] = useState(0);

  // Read mastery state and derive the active window of up-to-10 unmastered
  // words. For lists ≤ 10 words this reduces to "all words minus mastered".
  const masteryState = useMemo(
    () => getMasteryState(list.id),
    [list.id, masteryTick],   // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Pass the effective SEN profile derived from session.spellingConfidence
  // + session.senProfile so getActiveWindow applies the right schedule
  // multiplier (consolidating window x2, retained frequency x2 when the
  // child finds spelling often-tricky or self-reports dyslexia).
  const senProfileForSelection = useMemo(
    () => effectiveSenProfile(session),
    [session],
  );
  const adaptiveLearning = session?.adaptiveLearning !== false;
  const activeWindow = useMemo(
    () => getActiveWindow(list.id, fullWords, masteryState, masteryState.windowSize || 15, senProfileForSelection, adaptiveLearning),
    [list.id, fullWords, masteryState, senProfileForSelection, adaptiveLearning],
  );
  const listProgress = useMemo(
    () => getListProgressState(fullWords, masteryState),
    [fullWords, masteryState],
  );
  const unmasteredWords = useMemo(
    () => getUnmasteredWords(list.id, fullWords),
    [list.id, fullWords, masteryTick],   // eslint-disable-line react-hooks/exhaustive-deps
  );
  // The single GLOBAL struggling-word pool (PRAC-01) — every word the child
  // is currently struggling with, across ALL their lists, sorted most-missed
  // first. Surfaced in batches inside the practice tile / session. Re-read
  // when a game finishes (masteryTick) or the list changes.
  const strugglingEntries = useMemo(
    () => getAllStrugglingWords(),
    [list.id, masteryTick],   // eslint-disable-line react-hooks/exhaustive-deps
  );
  const masteryPct = listProgress.totalCount > 0
    ? Math.round((listProgress.masteredCount / listProgress.totalCount) * 100)
    : 0;

  // ── Detect list completion transition and show mastery modal (Part 4) ────
  // Fires once per session, only when the status CHANGES to 'completed'
  // (not when the list was already complete on mount).
  useEffect(() => {
    const current = listProgress.status;
    if (prevListStatusRef.current === null) {
      // First render — record initial status so we can detect a future change.
      prevListStatusRef.current = current;
      return;
    }
    if (current === 'completed' && prevListStatusRef.current !== 'completed') {
      // List just became fully mastered this session!
      setShowMasteryModal(true);
      // Celebration sequence: buddy cheer + confetti burst
      setTimeout(() => fireBuddyCheer(), 200);
      setTimeout(() => {
        confetti({
          particleCount: 160,
          spread: 100,
          origin: { y: 0.45 },
          colors: ['#6bcb77', '#ffd93d', '#c77dff', '#ec4899', '#60a5fa', '#fff'],
        });
      }, 300);
      // Tell AdventureMap to re-evaluate this list's stop state
      window.dispatchEvent(new CustomEvent('spellify-list-mastered', {
        detail: { listId: list.id },
      }));
    }
    prevListStatusRef.current = current;
  }, [listProgress.status, list.id]);

  // ── Practice Quest launch / completion ─────────────────────────────────
  // Practice is delivered in short, winnable batches (SR-01 Rule 3) drawn
  // from the global struggling pool. A child clears a set, then chooses
  // whether to do the next set — never forced to grind the whole pool.
  const PRACTICE_BATCH_SIZE = 3;
  const toPracticeItem = (e) => ({
    word:   e.word,
    listId: e.listId,
    // listName is null for the global pool — no per-word "From:" pill.
  });
  const launchPracticeQuest = () => {
    // Snapshot the ordered global pool now so the batch cursor steps through
    // a stable sequence even as words gain credit during the session.
    const pool = strugglingEntries;
    if (!pool.length) return;
    setPracticeQueue(pool);
    setPracticeBatchStart(0);
    setNextSetModal(false);
    setPracticeItems(pool.slice(0, PRACTICE_BATCH_SIZE).map(toPracticeItem));
  };
  const handlePracticeComplete = (results) => {
    // Persist each per-word outcome through the canonical credit framework
    // so cleanSessionsPostFlag advances correctly. Record against the word's
    // OWN list (global pool spans lists), falling back to the current list.
    // Practice Quest is its own "game type" for credit-by-game accounting.
    for (const r of results) {
      if (!r || !r.word) continue;
      const credit = r.correct
        ? (r.hintUsed ? 0.75 : 1.0)   // single-slot = 1st attempt
        : 0;                          // wrong on a 1-attempt task → 0, not -0.5
      recordWordResult(r.listId || list.id, r.word, 'practicequest', credit);
    }
    setMasteryTick(t => t + 1);
  };
  // Called from PracticeWriteIt's summary "Back". If the snapshot queue has
  // more words beyond the batch just finished, offer the next set; otherwise
  // close the practice flow cleanly.
  const finishPracticeBatch = () => {
    setPracticeItems(null);
    const nextStart = practiceBatchStart + PRACTICE_BATCH_SIZE;
    if (nextStart < practiceQueue.length) {
      setPracticeBatchStart(nextStart);
      setNextSetModal(true);
    } else {
      setPracticeQueue([]);
      setPracticeBatchStart(0);
    }
  };
  const startNextPracticeBatch = () => {
    setNextSetModal(false);
    setPracticeItems(
      practiceQueue
        .slice(practiceBatchStart, practiceBatchStart + PRACTICE_BATCH_SIZE)
        .map(toPracticeItem),
    );
  };
  const dismissNextSet = () => {
    setNextSetModal(false);
    setPracticeQueue([]);
    setPracticeBatchStart(0);
  };
  const practiceRemaining = Math.max(0, practiceQueue.length - practiceBatchStart);

  // DEV-only: directly write mastery state for all words in this list,
  // bypassing the credit-accumulation threshold. Useful for testing the
  // "list completed" and mastery-chip UI without having to play every
  // game twice. Dead-code-eliminated in production builds.
  const handleDevForceMastery = () => {
    const state = getMasteryState(list.id);
    const now = Date.now();
    for (const word of fullWords) {
      const key = String(word || '').toLowerCase().trim();
      state.words[key] = {
        ...(state.words[key] || {}),
        word,
        attempts: 4,
        creditByGame: { quizquest: 1.0, writeit: 1.0 },
        totalCredit: 2.0,
        lastAttempted: now,
        mastered: true,
        spacedRepetition: { masteredAtSession: 1, postMasterySessions: 0 },
        struggling: false,
        consecutiveMisses: 0,
        cleanSessionsPostFlag: 0,
      };
    }
    saveMasteryState(list.id, state);
    setMasteryTick(t => t + 1);
  };

  // Active window words drive normal game launches; chips render the full
  // list so the child sees everything (mastered chips can be styled later).
  const words = activeWindow.length > 0 ? activeWindow : fullWords;

  // Derived up-front so availableActivities can use it for filtering.
  const exploreSession = { year: list.year, words, age: list.ageRange?.[0] };

  useEffect(() => {
    (async () => {
      if (getListProgress) {
        const p = await getListProgress(list.id, listType);
        setProgress(p || {});
      }
    })();
  }, [list.id, listType, getListProgress]);

  const handleComplete = async (activityId, results = []) => {
    const accuracy = results.length > 0
      ? Math.round((results.filter(r => r.correct).length / results.length) * 100)
      : null;

    // ── Mastery + points + badges via the new gamification engine ─────
    // Snapshot stats BEFORE the update so we know the starting values
    // for the animated counter.
    const statsBefore = getPlayerStats();
    let rewardInfo = null;
    try {
      rewardInfo = recordGameCompleted(
        list.id,
        activityId,
        accuracy ?? 0,
        results,
        fullWords,
        { isTestAll: testAllStage === 'running' },
      );
    } catch (err) {
      // Engine is best-effort: a failure here must never block onComplete.
      console.error('[ListHub] gamification engine failed', err);
    }

    // Trigger animated reward counter ~1 s after the celebration fires
    if (rewardInfo && (rewardInfo.pointsAwarded > 0 || rewardInfo.lumensAwarded > 0)) {
      setTimeout(() => {
        setRewardSequence({
          fromPoints: statsBefore.totalPoints || 0,
          toPoints:   (statsBefore.totalPoints || 0) + (rewardInfo.pointsAwarded || 0),
          fromLumens: statsBefore.totalLumens  || 0,
          toLumens:   (statsBefore.totalLumens  || 0) + (rewardInfo.lumensAwarded || 0),
        });
      }, 1000);
    }
    // Daily-streak tracker — idempotent. Fires its own milestone event
    // which App.jsx picks up to trigger the confetti celebration.
    try { recordPlayToday(); } catch (err) { console.error('[ListHub] streak update failed', err); }
    setMasteryTick(t => t + 1);
    setTestAllStage('idle');
    setStartedActivities(prev => { const n = new Set(prev); n.delete(activityId); return n; });
    setLockedWords(prev => { const n = { ...prev }; delete n[activityId]; return n; });

    // ── Celebration on return from game ──────────────────────────────────
    // Buddy cheer + confetti burst so the player sees immediate positive
    // feedback when they land back on the hub.
    setTimeout(fireBuddyCheer, 150);
    setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.5 },
        colors: ['#FFD700', '#ec4899', '#c77dff', '#6bcb77', '#60a5fa'],
      });
    }, 200);
    // Notify App.jsx to re-read the live points from the engine.
    window.dispatchEvent(new CustomEvent('spellify-points-update'));

    // ── Existing progress tracking (per-list activity status) ─────────
    if (markComplete) {
      await markComplete(list.id, activityId, { accuracy, listType });
      setProgress(prev => ({
        ...prev,
        [activityId]: {
          status: 'completed',
          accuracy,
          completedAt: new Date().toISOString(),
          completions: (prev?.[activityId]?.completions || 0) + 1,
        },
      }));
    }
    setActiveActivity(null);
  };

  // ── Active game — rendered fullscreen, covering sidebar + nav ───────────
  if (practiceItems) {
    return (
      <div className="lh-game-fullscreen">
        <PracticeWriteIt
          items={practiceItems}
          onComplete={handlePracticeComplete}
          onExit={() => {           // header X — abandon the whole queue
            setPracticeItems(null);
            setPracticeQueue([]);
            setPracticeBatchStart(0);
          }}
          onBack={finishPracticeBatch}   // summary Back — offer the next set
        />
      </div>
    );
  }

  if (activeActivity) {
    const activityWords = testAllStage === 'running' && unmasteredWords.length > 0
      ? unmasteredWords
      : (lockedWords[activeActivity] ?? words);
    const sessionForActivity = {
      ...(session || {}),
      words: activityWords,
      isTestAll: testAllStage === 'running',
    };
    // Mid-game snapshot — persisted per list+activity so exit+resume
    // restores the in-progress board (found words, filled cells, etc.).
    const snapKey = `spellify_activity_snap_${list.id}_${activeActivity}`;
    const savedActivityProgress = (() => {
      try { return JSON.parse(localStorage.getItem(snapKey) || 'null'); }
      catch { return null; }
    })();
    const onSaveActivityProgress = (snap) => {
      if (snap == null) localStorage.removeItem(snapKey);
      else { try { localStorage.setItem(snapKey, JSON.stringify(snap)); } catch {} }
    };

    const rendered = renderExploreActivity(activeActivity, {
      list, words: activityWords, user,
      session: sessionForActivity,
      savedProgress: savedActivityProgress,
      onSaveProgress: onSaveActivityProgress,
      onComplete: handleComplete,
      onExit: () => { setActiveActivity(null); setTestAllStage('idle'); },
    });
    if (rendered) return <div className="lh-game-fullscreen">{rendered}</div>;
  }

  const launchTestAll = (gameId) => {
    setTestAllStage('running');
    setActiveActivity(gameId);
  };

  // ── Card hub (the only hub) ──────────────────────────────────────────────
  // Big centred title (matches the SpellShop heading treatment), photo-led
  // game cards as the primary affordance, and a collapsible secondary word
  // list panel that reuses all the existing chip/mastery functionality.
  // gamesNeeded — estimate of how many more games to full mastery: each
  // unmastered word needs ~ceil(2.0 - credit) more games.
  const gamesNeeded = listProgress.status === 'completed' ? 0
      : fullWords.reduce((acc, w) => {
          const entry = masteryState.words?.[w.toLowerCase()];
          if (entry?.mastered) return acc;
          const credit = entry?.totalCredit || 0;
          return acc + Math.max(1, Math.ceil(2.0 - credit));
        }, 0);
    return (
      <>
        <div className={`lh-cards-root${coachPhase !== 'off' ? ' lh-cards-root--coach-locked' : ''}`}>
          {/* Dev: re-trigger onboarding. Remove before shipping. */}
          <button
            type="button"
            className="lh-coach-devreset"
            onClick={() => {
              try { window.localStorage.removeItem(COACH_LH_KEY); } catch { /* ignore */ }
              coachDrawerSeenRef.current = false;
              setWordsDrawerOpen(false);
              setActiveWord(null);
              setCoachPhase('find-words');
            }}
          >
            ⟳ Replay tour
          </button>

          {/* Big centred title — pixel-font, glowing, matches Spell Shop. */}
          <header className="lh-cards-header">
            <h1 className="lh-cards-title">
              <span>{list.name}</span>
            </h1>
            {/* Mastery progress — ported from the classic hub (MAS-01/MAS-02):
                a progress-toward-mastery bar plus the hover/tap tooltip,
                replacing the old plain "X of N words mastered" subtitle so a
                child sees movement toward mastery, not just a count. */}
            <section
              className={`hub-mastery-pipeline lh-cards-mastery${listProgress.status === 'completed' ? ' hub-mastery-pipeline--complete' : ''}`}
              onMouseEnter={() => setMasteryTipOpen(true)}
              onMouseLeave={() => setMasteryTipOpen(false)}
              onClick={() => setMasteryTipOpen(o => !o)}
            >
              {listProgress.status === 'completed' && (
                <p className="hub-mastery-complete-msg">
                  🎉 You've mastered every word — well done! Keep practising to stay sharp.
                </p>
              )}
              <div className="hub-mastery-row">
                <span className="hub-mastery-text">
                  <strong>{listProgress.masteredCount}</strong>
                  <span className="hub-mastery-dim"> of {listProgress.totalCount} words mastered</span>
                </span>
                <span className="hub-mastery-pct">{masteryPct}%</span>
              </div>
              <div
                className="hub-mastery-bar"
                role="progressbar"
                aria-valuenow={listProgress.masteredCount}
                aria-valuemin={0}
                aria-valuemax={listProgress.totalCount}
              >
                <div className="hub-mastery-bar-fill" style={{ width: `${masteryPct}%` }} />
              </div>
              {/* Tooltip — hover (desktop) / tap (mobile). Restores MAS-01's
                  "Complete some more" pop-up that prompts how to progress. */}
              {masteryTipOpen && (
                <div className="hub-mastery-tip" role="tooltip">
                  <p className="hub-mastery-tip-static">Complete games to achieve Word Mastery</p>
                  {listProgress.status === 'completed' ? (
                    <p className="hub-mastery-tip-dynamic">You've achieved Word Mastery on this list! 🌟</p>
                  ) : (
                    <p className="hub-mastery-tip-dynamic">
                      Play {gamesNeeded} more game{gamesNeeded !== 1 ? 's' : ''} to reach Word Mastery
                    </p>
                  )}
                </div>
              )}
            </section>
          </header>

          {/* Game cards — rounded, photo-led tiles. One row of three on
              desktop, single column on mobile. Uses existing click +
              locked + completion logic so behaviour is identical to the
              classic grid. The Practice Quest tile (PRAC-01) is rendered
              FIRST, with the same visual treatment as the game tiles, when
              the child has any words on the global practice list. */}
          <section className="lh-cards-grid" aria-label="Games">
            {strugglingEntries.length > 0 && (
              <button
                type="button"
                className="lh-game-card lh-game-card--practice"
                style={{ '--card-accent': '#d97706', '--card-accent-light': '#fbbf24' }}
                onClick={launchPracticeQuest}
                title="Practise the spells you're still mastering"
              >
                <div
                  className="lh-game-card__art lh-game-card__art--placeholder"
                  aria-hidden="true"
                >
                  <span className="lh-game-card__art-emoji">🎯</span>
                </div>
                <div className="lh-game-card__body">
                  <h3 className="lh-game-card__name">Practice Quest</h3>
                  <p className="lh-game-card__time">
                    {strugglingEntries.length} spell
                    {strugglingEntries.length === 1 ? '' : 's'} to master
                  </p>
                  <span className="lh-game-card__cta">Start ▶</span>
                </div>
              </button>
            )}
            {ACTIVITIES
              .filter(a => getActivityAvailability(a, { session: exploreSession, user }).reason !== 'unsupported')
              .map(activity => {
                const avail = getActivityAvailability(activity, { session: exploreSession, user });
                const locked = avail.locked;
                const completions = progress?.[activity.id]?.completions
                  || (progress?.[activity.id]?.status === 'completed' ? 1 : 0);
                const inProgress = startedActivities.has(activity.id);
                const artUrl = encodeArtUrl(GAME_ART[activity.id]);
                const click = () => {
                  if (locked) return;
                  if (!lockedWords[activity.id]) {
                    setLockedWords(prev => ({ ...prev, [activity.id]: words }));
                  }
                  setStartedActivities(prev => new Set(prev).add(activity.id));
                  setActiveActivity(activity.id);
                };
                return (
                  <button
                    key={activity.id}
                    type="button"
                    className={`lh-game-card${locked ? ' lh-game-card--locked' : ''}${completions > 0 ? ' lh-game-card--complete' : ''}`}
                    style={{
                      '--card-accent': activity.dark,
                      '--card-accent-light': activity.color,
                    }}
                    onClick={click}
                    aria-disabled={locked}
                    title={locked ? avail.message : undefined}
                  >
                    {/* Painted card art, or accent-tinted gradient fallback. */}
                    <div
                      className={`lh-game-card__art${artUrl ? '' : ' lh-game-card__art--placeholder'}`}
                      style={artUrl ? { backgroundImage: `url("${artUrl}")` } : undefined}
                      aria-hidden="true"
                    >
                      {!artUrl && (
                        <span className="lh-game-card__art-emoji">{activity.icon}</span>
                      )}
                      {locked && <span className="lh-game-card__lock" aria-hidden="true">🔒</span>}
                    </div>
                    <div className="lh-game-card__body">
                      <h3 className="lh-game-card__name">{activity.name}</h3>
                      <p className="lh-game-card__time">⏱ {activity.timeEstimate}</p>
                      {!locked && <CompletionTicks count={completions} />}
                      {!locked && (
                        <span className="lh-game-card__cta">
                          {inProgress ? 'Continue ▶' : 'Play ▶'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
          </section>

          {/* Word list — collapsible secondary drawer. All existing chip
              functionality (definition modal, mastery dots) preserved. */}
          <button
            type="button"
            className={`lh-words-toggle${coachPhase === 'find-words' ? ' lh-words-toggle--coach' : ''}`}
            onClick={() => setWordsDrawerOpen(o => !o)}
            aria-expanded={wordsDrawerOpen}
          >
            <span aria-hidden="true">📜</span>
            <span>Words</span>
            <span className="lh-words-toggle__count">{fullWords.length}</span>
          </button>

          {/* ── Onboarding coach ── first-visit tour: highlight Words button,
              let them open + close the drawer, then show the mastery prompt.
              Arrow points from the coach card to the target element. The
              scrim is suppressed while the drawer is open because the
              drawer ships its own (darker) backdrop. */}
          {coachPhase !== 'off' && !(coachPhase === 'find-words' && wordsDrawerOpen) && (
            <div className="lh-coach-scrim" aria-hidden="true" />
          )}
          {coachPhase === 'find-words' && !wordsDrawerOpen && (
            <div
              key="find-words"
              className="lh-coach lh-coach--find-words"
              role="status"
              aria-live="polite"
            >
              <div className="lh-coach__body">
                <div className="lh-coach__title">Find your words</div>
                <div className="lh-coach__hint">Tap the glowing <strong>Words</strong> button to see them.</div>
              </div>
              <button type="button" className="lh-coach__skip" onClick={dismissCoach}>Skip</button>
              <span className="lh-coach__arrow" aria-hidden="true" />
            </div>
          )}
          {coachPhase === 'find-words' && wordsDrawerOpen && (
            <div
              key="close-drawer"
              className="lh-coach lh-coach--close-drawer"
              role="status"
              aria-live="polite"
            >
              <div className="lh-coach__body">
                <div className="lh-coach__title">Find out more about your words</div>
                <div className="lh-coach__hint">Tap <strong>✕</strong> to close the word list when you're done.</div>
              </div>
              <button type="button" className="lh-coach__skip" onClick={dismissCoach}>Skip</button>
              <span className="lh-coach__arrow" aria-hidden="true" />
            </div>
          )}
          {coachPhase !== 'off' && coachPhase !== 'find-words' && (
            <div
              key={coachPhase}
              className={`lh-coach lh-coach--${coachPhase}`}
              role="status"
              aria-live="polite"
            >
              {coachPhase === 'mastery' && (
                <>
                  <div className="lh-coach__body">
                    <div className="lh-coach__title">You're all set!</div>
                    <div className="lh-coach__hint">Play the games and practise to master every word to unlock the next level.</div>
                  </div>
                  <button type="button" className="lh-coach__skip lh-coach__skip--primary" onClick={dismissCoach}>Got it</button>
                </>
              )}
            </div>
          )}
          {wordsDrawerOpen && (
            <>
              <div
                className="lh-words-drawer-scrim"
                onClick={() => setWordsDrawerOpen(false)}
                aria-hidden="true"
              />
              <aside className="lh-words-drawer" role="dialog" aria-label="Word list">
                <header className="lh-words-drawer__header">
                  <div>
                    <span className="lh-words-drawer__label">WORD LIST</span>
                    <h2 className="lh-words-drawer__title">{list.name}</h2>
                  </div>
                  <button
                    type="button"
                    className="lh-words-drawer__close"
                    onClick={() => setWordsDrawerOpen(false)}
                    aria-label="Close word list"
                  >
                    ✕
                  </button>
                </header>
                {listNamePanel}
                <div className="hub-chips">
                  {fullWords.map((w, i) => {
                    const { bg, border } = WORD_CHIP_COLORS[i % WORD_CHIP_COLORS.length];
                    const entry = masteryState.words?.[w.toLowerCase()];
                    const mastered = !!entry?.mastered;
                    const level = mastered ? 'mastered' : (entry?.attempts > 0 ? 'learning' : 'new');
                    return (
                      <button
                        key={i}
                        className={`hub-chip${mastered ? ' hub-chip--mastered' : ''}`}
                        style={{ background: bg, borderColor: border }}
                        onClick={() => setActiveWord({ word: w, chipColor: border })}
                      >
                        <span className="hub-chip-word">{w}</span>
                        <span
                          className={`hub-chip-mastery hub-chip-mastery--${level}`}
                          aria-label={level}
                          title={MASTERY_LABELS[level]}
                        >★</span>
                      </button>
                    );
                  })}
                </div>
                {/* Test all words — ported from the classic hub. Tests every
                    still-unmastered word in one go via a chosen game; lives in
                    the word drawer because it operates on the listed words. */}
                {unmasteredWords.length > 0 && (
                  <button
                    type="button"
                    className="lh-drawer-testall"
                    onClick={() => { setWordsDrawerOpen(false); setTestAllStage('choose'); }}
                  >
                    <span className="lh-drawer-testall__icon" aria-hidden="true">📝</span>
                    <span className="lh-drawer-testall__label">Test all words</span>
                    <span className="lh-drawer-testall__count">{unmasteredWords.length}</span>
                  </button>
                )}
                {listFooter}
              </aside>
            </>
          )}
        </div>

        {/* Test-All game picker — ported from classic; opens after the drawer
            "Test all words" button. Reuses the same launch + completion path. */}
        {testAllStage === 'choose' && (
          <TestAllModal
            unmasteredWords={unmasteredWords}
            onPick={launchTestAll}
            onClose={() => setTestAllStage('idle')}
          />
        )}

        {/* Re-use the existing word definition modal mount from below. */}
        {activeWord && (
          <WordDetailModal
            word={activeWord.word}
            chipColor={activeWord.chipColor}
            userAge={session?.age || 8}
            onClose={() => setActiveWord(null)}
          />
        )}

        {/* ── Word Mastery modal (ported from classic) — fires once when every
            word in the list becomes mastered this session. */}
        {showMasteryModal && (
          <div
            className="lh-mastery-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lh-mastery-title-cards"
          >
            <div className="lh-mastery-card">
              <div className="lh-mastery-emoji" aria-hidden="true">🌟</div>
              <h2 id="lh-mastery-title-cards" className="lh-mastery-title">Word Master!</h2>
              <p className="lh-mastery-sub">
                You've mastered every word in <strong>{list.name}</strong>. Amazing work — keep going!
              </p>
              <div className="lh-mastery-actions">
                {listOrigin === 'map' && (
                  <button
                    className="lh-mastery-btn lh-mastery-btn--primary"
                    onClick={() => {
                      setShowMasteryModal(false);
                      window.dispatchEvent(new CustomEvent('spellify-map-return', {
                        detail: { listId: list.id },
                      }));
                      onBack();
                    }}
                  >
                    Next word list →
                  </button>
                )}
                <button
                  className="lh-mastery-btn lh-mastery-btn--secondary"
                  onClick={() => setShowMasteryModal(false)}
                >
                  Keep playing here
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Practice "next set" modal (PRAC-01 / SR-01 Rule 3) — shown
            between batches of 3. Always offers an easy way out so practice
            stays opt-in and never feels like a grind (gentle gamification). */}
        {nextSetModal && (
          <div
            className="lh-mastery-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lh-practice-nextset-title"
          >
            <div className="lh-mastery-card">
              <div className="lh-mastery-emoji" aria-hidden="true">🎯</div>
              <h2 id="lh-practice-nextset-title" className="lh-mastery-title">
                Nice practising!
              </h2>
              <p className="lh-mastery-sub">
                You've still got <strong>{practiceRemaining}</strong>{' '}
                spell{practiceRemaining === 1 ? '' : 's'} to master.
                Want to do {Math.min(PRACTICE_BATCH_SIZE, practiceRemaining)} more?
              </p>
              <div className="lh-mastery-actions">
                <button
                  className="lh-mastery-btn lh-mastery-btn--primary"
                  onClick={startNextPracticeBatch}
                >
                  Do {Math.min(PRACTICE_BATCH_SIZE, practiceRemaining)} more ▶
                </button>
                <button
                  className="lh-mastery-btn lh-mastery-btn--secondary"
                  onClick={dismissNextSet}
                >
                  I'm done for now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Animated reward sequence — points then lumens counter (RES-03).
            Ported so the post-game points/lumens readout appears on the card
            design (it previously rendered only in the classic branch). */}
        {rewardSequence && (
          <RewardSequence
            fromPoints={rewardSequence.fromPoints}
            toPoints={rewardSequence.toPoints}
            fromLumens={rewardSequence.fromLumens}
            toLumens={rewardSequence.toLumens}
            onDone={() => setRewardSequence(null)}
          />
        )}

        {/* DEV-only: force all words in this list to mastered state */}
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={handleDevForceMastery}
            style={{
              position: 'fixed', bottom: 16, left: 16, zIndex: 9999,
              background: '#6c3fc5', color: 'white', border: 'none',
              borderRadius: 8, padding: '8px 14px', fontSize: 13,
              cursor: 'pointer', fontFamily: 'monospace',
            }}
          >
            ⚡ DEV: Master all words
          </button>
        )}
      </>
    );
}
