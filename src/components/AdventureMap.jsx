import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import BuddyAvatar, { fireBuddyCheer } from './BuddyAvatar';
import { curriculumLists } from '../data/curriculumLists';
import { getMasteredWords } from '../utils/masteryEngine';
import './AdventureMap.css';

const SPELL_ISLES = [
  { id: 'ember',  name: 'Ember Isle',  emoji: '🔥', years: [1],    theme: 'ember'  },
  { id: 'flare',  name: 'Flare Isle',  emoji: '✨', years: [2],    theme: 'flare'  },
  { id: 'blaze',  name: 'Blaze Isle',  emoji: '🌟', years: [3, 4], theme: 'blaze'  },
  { id: 'aurora', name: 'Aurora Isle', emoji: '🌌', years: [5, 6], theme: 'aurora' },
];

// Stops are organised into CHAPTERS of 10. The child plays through
// chapter 1, completes its 10 stops, then unlocks chapter 2 (which
// uses a different painted panoramic) and so on. Once the supplied
// chapter art is exhausted, chapters cycle back to chapter 0 — so
// the world stays evergreen no matter how many word lists exist.
const STOPS_PER_CHAPTER = 10;

// Reusable 10-stop sine snake — every chapter uses the same coord
// shape until each individual panoramic is calibrated independently.
const DEFAULT_CHAPTER_COORDS = [
  { x: 50, y: 19 },
  { x: 39, y: 25 },
  { x: 61, y: 31 },
  { x: 38, y: 37 },
  { x: 62, y: 43 },
  { x: 40, y: 49 },
  { x: 60, y: 55 },
  { x: 39, y: 61 },
  { x: 55, y: 65 },
  { x: 49, y: 73 },
];

// Per-isle chapter configuration. Each chapter is one painted
// panoramic + its calibrated coords. When the chapter index runs
// past the array length we modulo back to chapter 0.
const ISLE_CHAPTERS = {
  ember: [
    {
      bg:     '/adventure/backgrounds/ember-isle-vertical.webp',
      ratio:  941 / 1672,
      coords: DEFAULT_CHAPTER_COORDS,
      landmarks: {
        1: { label: 'Word Search Forest', icon: '🌲' },
        4: { label: 'Crossword Castle',   icon: '🏰' },
        7: { label: 'Quiz Quest Cave',    icon: '🕳️' },
      },
    },
    {
      bg:     '/adventure/backgrounds/ember-isle-vertical-2.webp',
      ratio:  941 / 1672,
      coords: DEFAULT_CHAPTER_COORDS,
      landmarks: {},
    },
    {
      bg:     '/adventure/backgrounds/ember-isle-vertical-3.webp',
      ratio:  941 / 1672,
      coords: DEFAULT_CHAPTER_COORDS,
      landmarks: {},
    },
  ],
};

// Sign board image for each isle — drop in a new entry when new art arrives.
// Keyed by isle theme; value is the public path to the sign image.
const ISLE_SIGNS = {
  ember: '/adventure/characters/ember-isle-sign.webp',
  flare: '/adventure/characters/flare-isle-sign.webp',
  // blaze, aurora: add sign art here when ready
};

// Fixed right-hand sign for the HFW Island — always visible on the map.
const HFW_SIGN = '/adventure/characters/high-frequency-island-sign.png';

// ── Module-level persistence (survives React unmount/remount cycles) ─────────
// When the user taps an active stop the orb position is saved here so the
// hop animation knows where Buddy was sitting even after the component
// unmounts while the list screen is showing.
let _lastActiveStopPos = null; // { x, y } | null

function isleForYear(year) {
  const y = Number(year);
  return SPELL_ISLES.find(i => i.years.includes(y)) || SPELL_ISLES[0];
}

function isListComplete(list) {
  const total = list.wordCount || (list.words?.length || 0);
  if (!total) return false;
  const mastered = getMasteredWords(list.id).length;
  return mastered / total >= 0.8;
}

export default function AdventureMap({ session, onSectionChange, onOpenList, onGoToHFW, initialIsleId }) {
  const sessionYear = Number(session?.year) || 1;
  const currentIsle = isleForYear(sessionYear);
  const [selectedIsleId, setSelectedIsleId] = useState(initialIsleId || currentIsle.id);
  const [switcherOpen,   setSwitcherOpen]   = useState(false);
  const [lockedMsg,      setLockedMsg]      = useState(null);

  const viewportRef = useRef(null);

  // Bumped whenever we detect a list was just mastered (event or mount).
  // Adding this to the `stops` memo dependency forces it to re-read
  // mastery from localStorage so newly-completed stops show green.
  const [masteryVersion, setMasteryVersion] = useState(0);
  // IDs of stops currently playing the reveal animation (Part 6).
  const [revealingIds, setRevealingIds] = useState(new Set());
  // Snapshot of previous stop states — used to detect transitions.
  const prevStopsSnap = useRef(null);

  // { fromX, fromY, midX, midY, toX, toY } while the hop is in progress.
  const [buddyHop, setBuddyHop] = useState(null);

  // Pre-hop override for buddy's position. Initialised lazily so the VERY
  // FIRST render already shows buddy at the "from" orb when returning from
  // mastery — this prevents a visible flash of buddy at the destination
  // before the hop animation starts.
  // No window-flag check needed: if _lastActiveStopPos is set the user left
  // via an active stop (regardless of whether mastery happened). The mount
  // effect below decides whether a hop is warranted via position comparison.
  const [buddyHopFrom, setBuddyHopFrom] = useState(() =>
    _lastActiveStopPos ? { ..._lastActiveStopPos } : null
  );

  // Mirror of `stops` readable inside event-listener / setTimeout closures
  // without stale-closure risk.
  const stopsRef = useRef([]);

  // Helper — fires the full map reveal celebration (confetti + buddy cheer +
  // revealing-ring animation + buddy hop). Called either immediately (when
  // the map is already visible) or deferred via 'spellify-map-return'.
  const fireCelebration = useCallback((ids, hopFrom, hopTo) => {
    setTimeout(() => fireBuddyCheer(), 200);
    setTimeout(() => {
      confetti({
        particleCount: 130,
        spread: 85,
        origin: { y: 0.48 },
        colors: ['#6bcb77', '#ffd93d', '#c77dff', '#ec4899', '#60a5fa', '#fff'],
      });
    }, 350);
    setRevealingIds(ids);
    setTimeout(() => setRevealingIds(new Set()), 700);

    // Buddy hop — arc from completed orb to newly active orb.
    // Clear buddyHopFrom at the same time so the CSS animation's 0% keyframe
    // (left: var(--bh-from-x)) is the only thing positioning buddy — the
    // inline `left/top` fall back to activeStop which the animation overrides.
    if (hopFrom && hopTo) {
      // Apply the same -2 % vertical offset used in the buddy's inline style
      // so the hop keyframes start/end exactly where the static buddy sits.
      const adjFromY = hopFrom.y - 2;
      const adjToY   = hopTo.y   - 2;
      const midX = (hopFrom.x + hopTo.x) / 2;
      const midY = Math.min(adjFromY, adjToY) - 8; // apex above both orbs
      setBuddyHopFrom(null);
      setBuddyHop({ fromX: hopFrom.x, fromY: adjFromY, midX, midY, toX: hopTo.x, toY: adjToY });
      setTimeout(() => setBuddyHop(null), 1100);
    } else {
      setBuddyHopFrom(null);
    }
  }, []);

  // ── spellify-list-mastered ────────────────────────────────────────────────
  // Fired by ListHub when all words are mastered. Bumps masteryVersion so
  // the stops memo re-reads localStorage and the stop flips to 'completed'.
  useEffect(() => {
    const onMastered = () => setMasteryVersion(v => v + 1);
    window.addEventListener('spellify-list-mastered', onMastered);
    return () => window.removeEventListener('spellify-list-mastered', onMastered);
  }, []);

  // ── Mount effect — deferred celebration on return from mastery ────────────
  // Problem: 'spellify-map-return' fires from ListHub/backHome BEFORE this
  // component mounts (React batches the section-switch after the button click,
  // so the event is dispatched before the new tree renders). We can't receive
  // an event that fires before our listener is wired up.
  //
  // Solution — position comparison (no window flag):
  //   _lastActiveStopPos stores the orb Buddy was sitting on when the user
  //   left for a list. On mount, compare that saved position with the current
  //   active stop. If they differ the list was mastered (active advanced) →
  //   fire the celebration. If they are the same → no mastery → just clear.
  //
  // React 18 Strict Mode runs useEffect(fn, []) twice (run → cleanup → run).
  // The outer body must NOT clear _lastActiveStopPos — only the timer callback
  // does, so the second StrictMode run still finds the value intact.
  useEffect(() => {
    const hopFrom = _lastActiveStopPos ? { ..._lastActiveStopPos } : null;
    if (!hopFrom) return; // Nothing pending — buddy is already in the right place.

    // 150 ms gives stopsRef time to be populated by the sync effect below.
    const t = setTimeout(() => {
      _lastActiveStopPos = null; // Clear INSIDE the timer — Strict Mode safe.
      const currentStops = stopsRef.current;
      const hopTo = currentStops.find(s => s.state === 'active');

      if (!hopTo) { setBuddyHopFrom(null); return; }

      // Position comparison — did the active orb change while we were away?
      const posChanged = hopTo.x !== hopFrom.x || hopTo.y !== hopFrom.y;
      if (!posChanged) {
        // Same orb → user exited without mastering. No hop needed.
        setBuddyHopFrom(null);
        return;
      }

      // Active orb moved → list was mastered → celebrate + hop.
      const recentCompleted = currentStops
        .filter(s => s.state === 'completed')
        .slice(-1)
        .map(s => s.list?.id)
        .filter(Boolean);
      const ids = new Set([...recentCompleted, hopTo.list?.id].filter(Boolean));
      fireCelebration(ids, hopFrom, { x: hopTo.x, y: hopTo.y });
    }, 150);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── spellify-map-return event ─────────────────────────────────────────────
  // Belt-and-braces for the case where AdventureMap stays mounted in the
  // background (e.g. future rendering architectures). The mount effect handles
  // the common unmount→remount path; this listener handles the stay-mounted
  // path. _lastActiveStopPos is cleared immediately to prevent double-fire if
  // both ListHub and backHome dispatch the event in the same tick.
  useEffect(() => {
    const onMapReturn = () => {
      const hopFrom = _lastActiveStopPos ? { ..._lastActiveStopPos } : null;
      _lastActiveStopPos = null; // Immediate clear — prevents double-fire.

      if (!hopFrom) return; // No position recorded — nothing to animate.

      // Park buddy at the "from" orb right away so there's no flash at
      // the destination before the hop animation kicks off.
      setBuddyHopFrom(hopFrom);

      setTimeout(() => {
        const currentStops = stopsRef.current;
        const hopTo = currentStops.find(s => s.state === 'active');

        if (!hopTo) { setBuddyHopFrom(null); return; }

        // Position comparison — only hop if the active orb actually moved.
        const posChanged = hopTo.x !== hopFrom.x || hopTo.y !== hopFrom.y;
        if (!posChanged) { setBuddyHopFrom(null); return; }

        const recentCompleted = currentStops
          .filter(s => s.state === 'completed')
          .slice(-1)
          .map(s => s.list?.id)
          .filter(Boolean);
        const ids = new Set([...recentCompleted, hopTo.list?.id].filter(Boolean));
        fireCelebration(ids, hopFrom, { x: hopTo.x, y: hopTo.y });
      }, 150);
    };
    window.addEventListener('spellify-map-return', onMapReturn);
    return () => window.removeEventListener('spellify-map-return', onMapReturn);
  }, [fireCelebration]);

  useEffect(() => { setSelectedIsleId(isleForYear(sessionYear).id); }, [sessionYear]);

  const selectedIsle = SPELL_ISLES.find(i => i.id === selectedIsleId) || currentIsle;

  const lists = useMemo(
    () => curriculumLists.filter(l => selectedIsle.years.includes(Number(l.year))),
    [selectedIsle]
  );

  // ── Chapter handling ────────────────────────────────────────────
  // 10 word-lists per chapter. The "natural" chapter for the player
  // is the one containing their first non-mastered list. The user
  // can opt in to the next chapter (via the bottom CTA) only once
  // every list in their current chapter is mastered.
  const isleChapters = ISLE_CHAPTERS[selectedIsle.theme] || ISLE_CHAPTERS.ember;
  const totalChapters = Math.max(1, Math.ceil(lists.length / STOPS_PER_CHAPTER));

  const naturalChapter = useMemo(() => {
    const firstUnmastered = lists.findIndex(l => !isListComplete(l));
    if (firstUnmastered < 0) return totalChapters - 1; // all done → last
    return Math.floor(firstUnmastered / STOPS_PER_CHAPTER);
  }, [lists, totalChapters]);

  const [chapterIdx, setChapterIdx] = useState(naturalChapter);
  // Re-sync when the isle changes or the natural chapter shifts (e.g.
  // the player completes a chapter while on it — we keep them on that
  // chapter and let them tap the CTA to advance manually).
  useEffect(() => { setChapterIdx(naturalChapter); }, [selectedIsleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Active chapter config (backdrop, coords, landmarks) — modulo the
  // array length so we cycle backdrops once we run out of unique art.
  const chapter = isleChapters[chapterIdx % isleChapters.length] || isleChapters[0];
  const bg        = chapter.bg;
  const ratio     = chapter.ratio || (9 / 16);
  const coords    = chapter.coords || DEFAULT_CHAPTER_COORDS;
  const landmarks = chapter.landmarks || {};

  // ── Backdrop load handling (MAP-01) ──────────────────────────────────
  // The painted panoramas are large (~2–3 MB). Without this the scene
  // showed the near-black page colour for a beat before the image painted
  // (a "black flash" on every home load). We keep a themed twilight base
  // under the scene (see .am-v2-scene in the CSS) so any gap reads as sky,
  // never black, and fade each backdrop in once it has decoded. `bgReady`
  // is derived from the loaded src so switching chapters resets the fade
  // synchronously (no stale frame of the previous map).
  const bgImgRef = useRef(null);
  const [loadedBg, setLoadedBg] = useState(null);
  const bgReady = loadedBg === bg;
  useEffect(() => {
    // Cached images can be `complete` before onLoad attaches.
    const el = bgImgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoadedBg(bg);
    // Warm the next chapter's backdrop so forward navigation is seamless.
    const next = isleChapters[(chapterIdx + 1) % isleChapters.length];
    if (next?.bg && next.bg !== bg) {
      const warm = new Image();
      warm.src = next.bg;
    }
  }, [bg, chapterIdx, isleChapters]);

  // Slice this chapter's 10 lists out of the full list array.
  const chapterListStart = chapterIdx * STOPS_PER_CHAPTER;
  const chapterLists = lists.slice(chapterListStart, chapterListStart + STOPS_PER_CHAPTER);

  // Whole-chapter completion (drives the bottom Unlock CTA).
  const chapterAllComplete =
    chapterLists.length > 0 && chapterLists.every(isListComplete);
  // Is there anything past this chapter?
  const hasNextChapter = chapterListStart + STOPS_PER_CHAPTER < lists.length
                      || isleChapters.length > 1;   // evergreen cycle

  // One stop per coord, mapped to its list in this chapter's slice.
  // masteryVersion is in the dependency array so re-reads localStorage
  // when a list is mastered (even if chapterLists reference hasn't changed).
  const { stops, activeIdx } = useMemo(() => {
    let activeAssigned = false;
    const built = coords.map((c, i) => {
      const list = chapterLists[i] || null;
      let state;
      if (!list) {
        state = 'unassigned';
      } else if (isListComplete(list)) {
        state = 'completed';
      } else if (!activeAssigned) {
        state = 'active';
        activeAssigned = true;
      } else {
        state = 'locked';
      }
      return { list, state, slotIdx: i, x: c.x, y: c.y, landmark: landmarks[i] || null };
    });
    const aIdx = built.findIndex(s => s.state === 'active');
    if (aIdx >= 0 && built[aIdx + 1]?.state === 'locked') {
      built[aIdx + 1].state = 'next';
    }
    return { stops: built, activeIdx: aIdx };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, chapterLists, landmarks, masteryVersion]);

  // Keep stopsRef in sync so event-listener closures (spellify-map-return)
  // can read the latest orb positions without a stale-closure risk.
  useEffect(() => { stopsRef.current = stops; }, [stops]);

  // Keep a snapshot of stop states so we can detect transitions in future
  // renders (currently used by stopsRef; kept for forward-compatibility).
  useEffect(() => {
    prevStopsSnap.current = stops.map(s => ({ id: s.list?.id || null, state: s.state }));
  }, [stops]);

  const activeStop = activeIdx >= 0 ? stops[activeIdx] : null;
  const lastStop   = stops[stops.length - 1];

  const advanceChapter = () => {
    if (!chapterAllComplete) return;
    setChapterIdx(c => (c + 1));   // can grow past art length — modulo on read
  };
  const previousChapter = () => {
    if (chapterIdx === 0) return;
    setChapterIdx(c => Math.max(0, c - 1));
  };

  // Auto-centre on the buddy (or top of chapter if the active stop
  // isn't in this chapter slice — e.g. when the player advances to a
  // chapter they haven't started yet).
  useEffect(() => {
    if (!viewportRef.current) return;
    const vp = viewportRef.current;
    requestAnimationFrame(() => {
      const scene = vp.querySelector('.am-v2-scene');
      if (!scene) return;
      // Browsing a previous chapter (no active stop here) → land at the
      // bottom so the last completed stop is in view, not the top.
      // Browsing the active chapter or advancing forward → centre on buddy.
      const focusY = activeStop?.y
        ?? (chapterIdx < naturalChapter ? (lastStop?.y ?? 95) : 5);
      const yPx = (focusY / 100) * scene.clientHeight;
      // For previous-chapter landings push the target toward the bottom
      // of the viewport so the last orb sits comfortably in view.
      const viewportFraction = (chapterIdx < naturalChapter && !activeStop) ? 0.7 : 0.42;
      const targetY = yPx - vp.clientHeight * viewportFraction;
      vp.scrollTo({ top: Math.max(0, targetY), behavior: 'auto' });
    });
  }, [activeStop?.x, activeStop?.y, selectedIsleId, chapterIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const isleStatus = (isle) => {
    const isleMin = Math.min(...isle.years);
    const isleMax = Math.max(...isle.years);
    if (isle.id === currentIsle.id) return 'current';
    if (isleMax < sessionYear) return 'past';
    if (isleMin > sessionYear) return 'future';
    return 'current';
  };

  const onIsleChoose = (isle) => {
    if (isleStatus(isle) === 'future') {
      setLockedMsg(`Keep spelling to unlock ${isle.name}`);
      setTimeout(() => setLockedMsg(null), 2500);
      return;
    }
    setSelectedIsleId(isle.id);
    setSwitcherOpen(false);
  };

  // Active and completed stops are both tappable. Completed lists can
  // still be revisited for practice. Locked stops show a brief toast.
  const onStopActivate = (stop) => {
    if (stop.state !== 'active' && stop.state !== 'completed') {
      setLockedMsg('Complete earlier stops to unlock');
      setTimeout(() => setLockedMsg(null), 1800);
      return;
    }
    // Save buddy's current orb position so the hop animation knows its
    // starting point when the user returns after mastering the list.
    if (stop.state === 'active') {
      _lastActiveStopPos = { x: stop.x, y: stop.y };
    }
    if (typeof onOpenList === 'function') onOpenList(stop.list);
    else onSectionChange?.('exploreDashboard');
  };

  // Vertical click-and-drag scrolling for desktop (touch uses native pan-y
  // so momentum scrolling and the OS-native scroll-wheel both work).
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);
  const onViewportPointerDown = (e) => {
    // Only initiate JS drag for primary mouse button. Touch + pen rely on
    // `touch-action: pan-y` for native, momentum-preserving scrolling.
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (e.target.closest('.am-v2-node')) return;
    if (!viewportRef.current) return;
    dragRef.current = {
      startY: e.clientY,
      scrollTop: viewportRef.current.scrollTop,
    };
    dragMovedRef.current = false;
    viewportRef.current.classList.add('am-viewport--dragging');
  };
  const onViewportPointerMove = (e) => {
    if (!dragRef.current || !viewportRef.current) return;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dy) > 4) dragMovedRef.current = true;
    viewportRef.current.scrollTop = dragRef.current.scrollTop - dy;
  };
  // Smoothed wheel scrolling: accumulate deltaY into a target scrollTop
  // and ease current → target each rAF tick. Gives trackpads a buttery
  // feel instead of the snap-per-event jank of native overflow scrolling.
  const wheelTargetRef = useRef(null);
  const wheelRafRef = useRef(0);
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e) => {
      if (e.deltaY === 0) return;
      // Normalise line/page deltas to pixels.
      const px = e.deltaMode === 1 ? e.deltaY * 16
               : e.deltaMode === 2 ? e.deltaY * vp.clientHeight
               : e.deltaY;
      e.preventDefault();
      const max = vp.scrollHeight - vp.clientHeight;
      const current = wheelTargetRef.current == null ? vp.scrollTop : wheelTargetRef.current;
      wheelTargetRef.current = Math.max(0, Math.min(max, current + px));
      if (!wheelRafRef.current) {
        const step = () => {
          if (!viewportRef.current || wheelTargetRef.current == null) {
            wheelRafRef.current = 0;
            return;
          }
          const v = viewportRef.current;
          const target = wheelTargetRef.current;
          const diff = target - v.scrollTop;
          if (Math.abs(diff) < 0.5) {
            v.scrollTop = target;
            wheelTargetRef.current = null;
            wheelRafRef.current = 0;
            return;
          }
          v.scrollTop += diff * 0.24;
          wheelRafRef.current = requestAnimationFrame(step);
        };
        wheelRafRef.current = requestAnimationFrame(step);
      }
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      vp.removeEventListener('wheel', onWheel);
      if (wheelRafRef.current) cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = 0;
      wheelTargetRef.current = null;
    };
  }, []);
  const onViewportPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    viewportRef.current?.classList.remove('am-viewport--dragging');
  };
  const onViewportClickCapture = (e) => {
    if (dragMovedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      dragMovedRef.current = false;
    }
  };

  return (
    <main className={`am-root am-theme--${selectedIsle.theme}`}>
      {/* Shooting stars — three staggered streaks across the backdrop */}
      <div className="am-shooting-stars" aria-hidden="true">
        <span className="am-shooting-star am-shooting-star--1" />
        <span className="am-shooting-star am-shooting-star--2" />
        <span className="am-shooting-star am-shooting-star--3" />
      </div>

      {/* Painted panoramic map with nodes positioned on the painted path */}
      <div className="am-v2-wrap">
        <div
          className="am-viewport am-viewport--v2"
          ref={viewportRef}
          onPointerDown={onViewportPointerDown}
          onPointerMove={onViewportPointerMove}
          onPointerUp={onViewportPointerUp}
          onPointerCancel={onViewportPointerUp}
          onPointerLeave={onViewportPointerUp}
          onClickCapture={onViewportClickCapture}
        >
          <div className="am-v2-scene" style={{ aspectRatio: `${ratio}` }}>
            {bg && (
              <img
                ref={bgImgRef}
                className={`am-v2-bg${bgReady ? ' am-v2-bg--loaded' : ''}`}
                src={bg}
                alt={`${selectedIsle.name} map`}
                draggable={false}
                onLoad={() => setLoadedBg(bg)}
              />
            )}

            {/* Magical pathway connecting all stops — layered SVG strokes */}
            <svg
              className="am-v2-magic-path"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="am-v2-magicGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0"    stopColor="#fff5b8" />
                  <stop offset="0.35" stopColor="#ffd93d" />
                  <stop offset="0.6"  stopColor="#ff8cb8" />
                  <stop offset="1"    stopColor="#c77dff" />
                </linearGradient>
                <linearGradient id="am-v2-violetGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0"   stopColor="#ffb8d8" />
                  <stop offset="0.5" stopColor="#c77dff" />
                  <stop offset="1"   stopColor="#8a4fd6" />
                </linearGradient>
              </defs>
              {(() => {
                if (stops.length < 2) return null;

                // ── Past trail: curves off the top of the scene on chapters 2+ ──
                // Gives the visual sense that the path continues upward into the
                // previous chapter, mirroring the bottom extension for next chapter.
                let dPast = null;
                if (chapterIdx > 0) {
                  const f = stops[0];
                  const topX = f.x < 50 ? f.x + 9 : f.x - 9;
                  const midY = (f.y + 2) / 2;
                  dPast = `M ${f.x} ${f.y} C ${f.x} ${midY} ${topX} ${midY} ${topX} 2`;
                }

                // ── Active / future split ──────────────────────────────────────
                // Extend the animated path one stop beyond the active orb
                // so the magic trail reaches the next stage, not just the current one.
                const splitIdx = activeIdx >= 0
                  ? Math.min(activeIdx + 1, stops.length - 1)
                  : stops.length - 1;

                let dActive = `M ${stops[0].x} ${stops[0].y}`;
                for (let i = 1; i <= splitIdx; i++) {
                  const a = stops[i - 1], b = stops[i];
                  const midY = (a.y + b.y) / 2;
                  dActive += ` C ${a.x} ${midY} ${b.x} ${midY} ${b.x} ${b.y}`;
                }

                let dFuture = null;
                if (splitIdx < stops.length - 1) {
                  dFuture = `M ${stops[splitIdx].x} ${stops[splitIdx].y}`;
                  for (let i = splitIdx + 1; i < stops.length; i++) {
                    const a = stops[i - 1], b = stops[i];
                    const midY = (a.y + b.y) / 2;
                    dFuture += ` C ${a.x} ${midY} ${b.x} ${midY} ${b.x} ${b.y}`;
                  }
                  if (lastStop && hasNextChapter) {
                    const exitX = lastStop.x < 50 ? lastStop.x + 12 : lastStop.x - 12;
                    const exitY = 96;
                    const mY = (lastStop.y + exitY) / 2;
                    dFuture += ` C ${lastStop.x} ${mY} ${exitX} ${mY} ${exitX} ${exitY}`;
                  }
                } else {
                  if (lastStop && hasNextChapter) {
                    const exitX = lastStop.x < 50 ? lastStop.x + 12 : lastStop.x - 12;
                    const exitY = 96;
                    const mY = (lastStop.y + exitY) / 2;
                    dActive += ` C ${lastStop.x} ${mY} ${exitX} ${mY} ${exitX} ${exitY}`;
                  }
                }

                return (
                  <>
                    {/* ── Past trail — curves off the top edge to previous chapter ── */}
                    {dPast && <path d={dPast} className="am-v2-magic-path__past" />}
                    {/* ── Completed / active path — full magical animated trail ── */}
                    <path d={dActive} className="am-v2-magic-path__aura" />
                    <path d={dActive} className="am-v2-magic-path__halo" />
                    <path d={dActive} className="am-v2-magic-path__shadow" />
                    <path d={dActive} className="am-v2-magic-path__rope" />
                    <path d={dActive} className="am-v2-magic-path__core" />
                    <path d={dActive} className="am-v2-magic-path__embers" />
                    <path d={dActive} className="am-v2-magic-path__shimmer" />
                    <path d={dActive} className="am-v2-magic-path__sparks" />
                    {/* ── Future / locked path — static muted trail ── */}
                    {dFuture && <path d={dFuture} className="am-v2-magic-path__future" />}
                  </>
                );
              })()}
            </svg>

            {stops.map((stop, idx) => {
              const labelSide   = stop.x < 50 ? 'right' : 'left';
              const isActive    = stop.state === 'active';
              const isCompleted = stop.state === 'completed';
              // Use the real stop state as the CSS modifier so colours are
              // always driven by state (active/completed/locked/next/unassigned),
              // never by hard-coded index.
              const renderState = stop.state;
              const isRevealing = stop.list?.id && revealingIds.has(stop.list.id);
              return (
                <button
                  key={stop.list?.id || `slot-${stop.slotIdx}`}
                  type="button"
                  className={[
                    'am-v2-node',
                    `am-v2-node--${renderState}`,
                    stop.landmark ? 'am-v2-node--landmark' : '',
                    isRevealing   ? 'am-v2-node--revealing' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={(e) => { e.stopPropagation(); onStopActivate(stop); }}
                  aria-label={stop.list ? `${stop.list.name} — ${renderState}` : 'Locked stop'}
                  style={{ left: `${stop.x}%`, top: `${stop.y}%` }}
                  disabled={!isActive && !isCompleted}
                >
                  <span className="am-v2-node__disc" aria-hidden="true">
                    <span className="am-v2-node__rim" />
                    <span className="am-v2-node__face">
                      {isActive
                        ? <span className="am-v2-node__num">{chapterIdx * STOPS_PER_CHAPTER + idx + 1}</span>
                        : isCompleted
                          ? <span className="am-v2-node__num am-v2-node__num--done">{chapterIdx * STOPS_PER_CHAPTER + idx + 1}</span>
                          : <span className="am-v2-node__lock" aria-label="Locked">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <rect x="5" y="11" width="14" height="10" rx="2" fill="rgba(230,210,255,0.9)" />
                                <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="rgba(230,210,255,0.9)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                                <circle cx="12" cy="16" r="1.5" fill="rgba(120,60,180,0.7)" />
                              </svg>
                            </span>}
                    </span>
                    {isCompleted && (
                      <span className="am-v2-node__done-pill" aria-hidden="true">MASTERED</span>
                    )}
                    {isActive && (
                      <span className="am-v2-node__sparks" aria-hidden="true">
                        <span className="am-v2-node__spark am-v2-node__spark--1">✦</span>
                        <span className="am-v2-node__spark am-v2-node__spark--2">✧</span>
                        <span className="am-v2-node__spark am-v2-node__spark--3">✦</span>
                        <span className="am-v2-node__spark am-v2-node__spark--4">✧</span>
                        <span className="am-v2-node__spark am-v2-node__spark--5">✦</span>
                      </span>
                    )}
                  </span>


                  {(stop.list || stop.landmark) && (
                    <span
                      className={`am-v2-node__label am-v2-node__label--${labelSide}${isActive ? ' am-v2-node__label--always' : ''}`}
                    >
                      {stop.landmark?.label || stop.list?.name}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Buddy sits on the active disc — only rendered on the chapter
                where the child's active stop lives. When browsing a previous
                chapter Buddy is hidden (those stops are all completed, so
                activeStop is null, and we also gate on chapterIdx). */}
            {chapterIdx === naturalChapter && (activeStop || buddyHopFrom) && (() => {
              const bPos = buddyHopFrom || { x: activeStop.x, y: activeStop.y };
              return (
              <div
                className={`am-v2-buddy${buddyHop ? ' am-v2-buddy--hopping' : ''}`}
                style={{
                  left: `${bPos.x}%`,
                  top:  `${bPos.y - 2}%`,
                  ...(buddyHop ? {
                    '--bh-from-x': `${buddyHop.fromX}%`,
                    '--bh-from-y': `${buddyHop.fromY}%`,
                    '--bh-mid-x':  `${buddyHop.midX}%`,
                    '--bh-mid-y':  `${buddyHop.midY}%`,
                    '--bh-to-x':   `${buddyHop.toX}%`,
                    '--bh-to-y':   `${buddyHop.toY}%`,
                  } : {}),
                }}
              >
                <BuddyAvatar
                  id={session?.childCharacter?.id || 'raccoon'}
                  fallback={session?.childCharacter?.emoji || '🦝'}
                  size={86}
                />
              </div>
              );
            })()}

            {/* ── Chapter advance CTA — bottom of the panoramic ── */}
            {hasNextChapter && (
              <button
                type="button"
                className={`am-v2-next-chapter${chapterAllComplete ? ' am-v2-next-chapter--ready' : ''}`}
                onClick={() => {
                  if (chapterAllComplete) {
                    advanceChapter();
                  } else if (viewportRef.current && activeStop) {
                    // Scroll smoothly back up to the active stop
                    const vp = viewportRef.current;
                    const scene = vp.querySelector('.am-v2-scene');
                    if (scene) {
                      const yPx = (activeStop.y / 100) * scene.clientHeight;
                      vp.scrollTo({ top: Math.max(0, yPx - vp.clientHeight * 0.42), behavior: 'smooth' });
                    }
                  }
                }}
                aria-label={chapterAllComplete
                  ? `Continue to Chapter ${chapterIdx + 2}`
                  : `Go to current level`}
                style={{ left: `${(lastStop?.x ?? 50) < 50 ? (lastStop?.x ?? 50) + 12 : (lastStop?.x ?? 50) - 12}%` }}
              >
                <span className="am-v2-next-chapter__icon" aria-hidden="true">✦</span>
                <span className="am-v2-next-chapter__label">
                  {chapterAllComplete
                    ? `Continue to Chapter ${chapterIdx + 2}`
                    : `Complete all ${STOPS_PER_CHAPTER} to unlock`}
                </span>
              </button>
            )}

            {/* ── Previous chapter button — top-centre of the scene ── */}
            {chapterIdx > 0 && (
              <button
                type="button"
                className="am-v2-prev-chapter"
                onClick={previousChapter}
                aria-label={`Back to Chapter ${chapterIdx}`}
              >
                <span className="am-v2-prev-chapter__arrow" aria-hidden="true">↑</span>
                Back to Chapter {chapterIdx}
              </button>
            )}
          </div>
        </div>

        {/* Chapter pill — shown beside the isle pill (sticky top) */}
        <div className="am-v2-chapter-badge" aria-hidden="true">
          Chapter {chapterIdx + 1}
        </div>
      </div>

      {lockedMsg && (
        <div className="am-locked-msg" role="status">{lockedMsg}</div>
      )}

      {/* ── "Back to Latest Level" widget ───────────────────────────────────
          Floats at the bottom of the screen whenever the child is browsing
          a chapter that isn't their current active one. Tapping it jumps
          straight to the chapter where Buddy is. */}
      {chapterIdx !== naturalChapter && (
        <button
          type="button"
          className="am-v2-back-to-latest"
          onClick={() => setChapterIdx(naturalChapter)}
          aria-label="Return to your current chapter"
        >
          <span className="am-v2-back-to-latest__icon" aria-hidden="true">🗺️</span>
          <span className="am-v2-back-to-latest__label">Back to Latest Level</span>
        </button>
      )}

      {/* ── Isle sign — bottom-left, clicks open the island switcher ── */}
      {ISLE_SIGNS[selectedIsle.theme] && (
        <button
          type="button"
          className="am-isle-sign"
          onClick={() => setSwitcherOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={switcherOpen}
          aria-label={`${selectedIsle.name} — switch island`}
        >
          <img
            src={ISLE_SIGNS[selectedIsle.theme]}
            alt={`${selectedIsle.name} sign`}
          />
        </button>
      )}

      {/* ── HFW Island sign — fixed bottom-right, navigates to HFW hub ── */}
      <button
        type="button"
        className="am-hfw-sign"
        onClick={() => onGoToHFW?.(selectedIsleId)}
        aria-label="Go to High-Frequency Island"
      >
        <img src={HFW_SIGN} alt="High-Frequency Island sign" />
      </button>

      {switcherOpen && (
        <div className="am-switcher-overlay" onClick={() => setSwitcherOpen(false)}>
          <div
            className="am-switcher-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Choose isle"
          >
            <h2 className="am-switcher-title">Spell Isles</h2>
            <div className="am-switcher-list">
              {SPELL_ISLES.map(isle => {
                const status = isleStatus(isle);
                return (
                  <button
                    key={isle.id}
                    type="button"
                    className={`am-switcher-item am-switcher-item--${status}`}
                    onClick={() => onIsleChoose(isle)}
                    aria-current={isle.id === selectedIsleId ? 'true' : undefined}
                  >
                    <span className="am-switcher-emoji" aria-hidden="true">{isle.emoji}</span>
                    <span className="am-switcher-name">{isle.name}</span>
                    {status === 'future'  && <span className="am-switcher-meta">🔒</span>}
                    {status === 'past'    && <span className="am-switcher-meta am-switcher-meta--past">✓</span>}
                    {status === 'current' && <span className="am-switcher-meta am-switcher-meta--current">Here</span>}
                  </button>
                );
              })}
            </div>
            <button type="button" className="am-switcher-close" onClick={() => setSwitcherOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
