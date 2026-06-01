import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import BuddyAvatar, { fireBuddyCheer } from './BuddyAvatar';
import { curriculumLists } from '../data/curriculumLists';
import { getMasteredWords } from '../utils/masteryEngine';
import './HFWIsland.css';

const STOPS_PER_CHAPTER = 10;

// Reversed relative to AdventureMap — journey starts at the bottom and
// climbs upward, so orb 1 is at the bottom of the image.
const DEFAULT_CHAPTER_COORDS = [
  { x: 49, y: 73 },
  { x: 55, y: 65 },
  { x: 39, y: 61 },
  { x: 60, y: 55 },
  { x: 40, y: 49 },
  { x: 62, y: 43 },
  { x: 38, y: 37 },
  { x: 61, y: 31 },
  { x: 39, y: 25 },
  { x: 50, y: 19 },
];

const HFW_BG = '/adventure/backgrounds/high-frequency-island.webp';
const HFW_RATIO = 1402 / 1122; // actual image dimensions (landscape)

// Per-list coordinate overrides — keyed by list id.
// Use these to pin individual orbs to specific spots on the island image.
const HFW_COORD_OVERRIDES = {
  'y1-st-cew-tricky': { x: 32, y: 67 },
};

// ── Module-level persistence (separate from AdventureMap's variable) ─────────
let _hfwLastActiveStopPos = null; // { x, y } | null

function isListComplete(list) {
  const total = list.wordCount || (list.words?.length || 0);
  if (!total) return false;
  const mastered = getMasteredWords(list.id).length;
  return mastered / total >= 0.8;
}

export default function HFWIsland({ session, fromIsleId, onBack, onOpenList }) {
  const [lockedMsg, setLockedMsg] = useState(null);
  const viewportRef = useRef(null);

  const [masteryVersion, setMasteryVersion] = useState(0);
  const [revealingIds, setRevealingIds] = useState(new Set());
  const prevStopsSnap = useRef(null);

  const [buddyHop, setBuddyHop] = useState(null);
  const [buddyHopFrom, setBuddyHopFrom] = useState(() =>
    _hfwLastActiveStopPos ? { ..._hfwLastActiveStopPos } : null
  );

  const stopsRef = useRef([]);

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

    if (hopFrom && hopTo) {
      const adjFromY = hopFrom.y - 2;
      const adjToY   = hopTo.y   - 2;
      const midX = (hopFrom.x + hopTo.x) / 2;
      const midY = Math.min(adjFromY, adjToY) - 8;
      setBuddyHopFrom(null);
      setBuddyHop({ fromX: hopFrom.x, fromY: adjFromY, midX, midY, toX: hopTo.x, toY: adjToY });
      setTimeout(() => setBuddyHop(null), 1100);
    } else {
      setBuddyHopFrom(null);
    }
  }, []);

  // ── spellify-list-mastered ────────────────────────────────────────────────
  useEffect(() => {
    const onMastered = () => setMasteryVersion(v => v + 1);
    window.addEventListener('spellify-list-mastered', onMastered);
    return () => window.removeEventListener('spellify-list-mastered', onMastered);
  }, []);

  // ── Mount effect — deferred celebration on return from mastery ────────────
  useEffect(() => {
    const hopFrom = _hfwLastActiveStopPos ? { ..._hfwLastActiveStopPos } : null;
    if (!hopFrom) return;

    const t = setTimeout(() => {
      _hfwLastActiveStopPos = null;
      const currentStops = stopsRef.current;
      const hopTo = currentStops.find(s => s.state === 'active');

      if (!hopTo) { setBuddyHopFrom(null); return; }

      const posChanged = hopTo.x !== hopFrom.x || hopTo.y !== hopFrom.y;
      if (!posChanged) {
        setBuddyHopFrom(null);
        return;
      }

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
  useEffect(() => {
    const onMapReturn = () => {
      const hopFrom = _hfwLastActiveStopPos ? { ..._hfwLastActiveStopPos } : null;
      _hfwLastActiveStopPos = null;

      if (!hopFrom) return;

      setBuddyHopFrom(hopFrom);

      setTimeout(() => {
        const currentStops = stopsRef.current;
        const hopTo = currentStops.find(s => s.state === 'active');

        if (!hopTo) { setBuddyHopFrom(null); return; }

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

  // ── HFW lists: strand === 'statutory', sorted by year ───────────────────
  const lists = useMemo(
    () => curriculumLists
      .filter(l => l.strand === 'statutory')
      .sort((a, b) => Number(a.year) - Number(b.year)),
    []
  );

  // ── Chapter handling ─────────────────────────────────────────────────────
  const totalChapters = Math.max(1, Math.ceil(lists.length / STOPS_PER_CHAPTER));

  const naturalChapter = useMemo(() => {
    const firstUnmastered = lists.findIndex(l => !isListComplete(l));
    if (firstUnmastered < 0) return totalChapters - 1;
    return Math.floor(firstUnmastered / STOPS_PER_CHAPTER);
  }, [lists, totalChapters]);

  const [chapterIdx, setChapterIdx] = useState(naturalChapter);

  const coords  = DEFAULT_CHAPTER_COORDS;

  const chapterListStart = chapterIdx * STOPS_PER_CHAPTER;
  const chapterLists = lists.slice(chapterListStart, chapterListStart + STOPS_PER_CHAPTER);

  const chapterAllComplete =
    chapterLists.length > 0 && chapterLists.every(isListComplete);
  const hasNextChapter = chapterListStart + STOPS_PER_CHAPTER < lists.length;

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
      const override = list?.id ? HFW_COORD_OVERRIDES[list.id] : null;
      return { list, state, slotIdx: i, x: override?.x ?? c.x, y: override?.y ?? c.y, landmark: null };
    });
    const aIdx = built.findIndex(s => s.state === 'active');
    if (aIdx >= 0 && built[aIdx + 1]?.state === 'locked') {
      built[aIdx + 1].state = 'next';
    }
    return { stops: built, activeIdx: aIdx };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, chapterLists, masteryVersion]);

  useEffect(() => { stopsRef.current = stops; }, [stops]);

  useEffect(() => {
    prevStopsSnap.current = stops.map(s => ({ id: s.list?.id || null, state: s.state }));
  }, [stops]);

  const activeStop = activeIdx >= 0 ? stops[activeIdx] : null;
  const lastStop   = stops[stops.length - 1];

  const advanceChapter = () => {
    if (!chapterAllComplete) return;
    setChapterIdx(c => c + 1);
  };
  const previousChapter = () => {
    if (chapterIdx === 0) return;
    setChapterIdx(c => Math.max(0, c - 1));
  };

  // Auto-centre on buddy
  useEffect(() => {
    if (!viewportRef.current) return;
    const vp = viewportRef.current;
    requestAnimationFrame(() => {
      const scene = vp.querySelector('.am-v2-scene');
      if (!scene) return;
      const focusY = activeStop?.y
        ?? (chapterIdx < naturalChapter ? (lastStop?.y ?? 95) : 5);
      const yPx = (focusY / 100) * scene.clientHeight;
      const viewportFraction = (chapterIdx < naturalChapter && !activeStop) ? 0.7 : 0.42;
      const targetY = yPx - vp.clientHeight * viewportFraction;
      vp.scrollTo({ top: Math.max(0, targetY), behavior: 'auto' });
    });
  }, [activeStop?.x, activeStop?.y, chapterIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const onStopActivate = (stop) => {
    if (stop.state !== 'active' && stop.state !== 'completed') {
      setLockedMsg('Complete earlier stops to unlock');
      setTimeout(() => setLockedMsg(null), 1800);
      return;
    }
    if (stop.state === 'active') {
      _hfwLastActiveStopPos = { x: stop.x, y: stop.y };
    }
    if (typeof onOpenList === 'function') onOpenList(stop.list);
  };

  // Drag-to-scroll (desktop mouse only — touch uses native pan-y so
  // mobile users get momentum scrolling and OS-native wheel both work).
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);
  const onViewportPointerDown = (e) => {
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
  // Smoothed trackpad/mouse-wheel scroll — eases scrollTop toward an
  // accumulated target each rAF tick so the map glides instead of snapping.
  const wheelTargetRef = useRef(null);
  const wheelRafRef = useRef(0);
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e) => {
      if (e.deltaY === 0) return;
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

  return (
    <main className="am-root am-theme--hfw">
      {/* Shooting stars */}
      <div className="am-shooting-stars" aria-hidden="true">
        <span className="am-shooting-star am-shooting-star--1" />
        <span className="am-shooting-star am-shooting-star--2" />
        <span className="am-shooting-star am-shooting-star--3" />
      </div>

      {/* Island name badge — top-centre */}
      <div className="hfw-island-badge" aria-hidden="true">High Frequency Island</div>

      {/* Painted panoramic map */}
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
          <div className="am-v2-scene" style={{ aspectRatio: `${HFW_RATIO}` }}>
            <img
              className="am-v2-bg"
              src={HFW_BG}
              alt="High Frequency Island map"
              draggable={false}
            />

            {/* Magical pathway */}
            <svg
              className="am-v2-magic-path"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="hfw-magicGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0"    stopColor="#b2f5ea" />
                  <stop offset="0.35" stopColor="#67e8f9" />
                  <stop offset="0.6"  stopColor="#06b6d4" />
                  <stop offset="1"    stopColor="#0891b2" />
                </linearGradient>
              </defs>
              {(() => {
                if (stops.length < 2) return null;

                let dPast = null;
                if (chapterIdx > 0) {
                  const f = stops[0];
                  const topX = f.x < 50 ? f.x + 9 : f.x - 9;
                  const midY = (f.y + 2) / 2;
                  dPast = `M ${f.x} ${f.y} C ${f.x} ${midY} ${topX} ${midY} ${topX} 2`;
                }

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
                    {dPast && <path d={dPast} className="am-v2-magic-path__past" />}
                    <path d={dActive} className="am-v2-magic-path__aura" />
                    <path d={dActive} className="am-v2-magic-path__halo" />
                    <path d={dActive} className="am-v2-magic-path__shadow" />
                    <path d={dActive} className="am-v2-magic-path__rope" />
                    <path d={dActive} className="am-v2-magic-path__core" />
                    <path d={dActive} className="am-v2-magic-path__embers" />
                    <path d={dActive} className="am-v2-magic-path__shimmer" />
                    <path d={dActive} className="am-v2-magic-path__sparks" />
                    {dFuture && <path d={dFuture} className="am-v2-magic-path__future" />}
                  </>
                );
              })()}
            </svg>

            {stops.map((stop, idx) => {
              const labelSide   = stop.x < 50 ? 'right' : 'left';
              const isActive    = stop.state === 'active';
              const isCompleted = stop.state === 'completed';
              const renderState = stop.state;
              const isRevealing = stop.list?.id && revealingIds.has(stop.list.id);
              return (
                <button
                  key={stop.list?.id || `slot-${stop.slotIdx}`}
                  type="button"
                  className={[
                    'am-v2-node',
                    `am-v2-node--${renderState}`,
                    isRevealing ? 'am-v2-node--revealing' : '',
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

                  {stop.list && (
                    <span
                      className={`am-v2-node__label am-v2-node__label--${labelSide}${isActive ? ' am-v2-node__label--always' : ''}`}
                    >
                      {stop.list.name}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Buddy sits on the active disc */}
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

            {/* Chapter advance CTA — only shown once the chapter is fully
                complete. The locked "Complete all N to unlock" prompt is
                suppressed on HFW Island: the child stays on this island
                so the lock messaging adds friction without value. */}
            {hasNextChapter && chapterAllComplete && (
              <button
                type="button"
                className="am-v2-next-chapter am-v2-next-chapter--ready"
                onClick={advanceChapter}
                aria-label={`Continue to Chapter ${chapterIdx + 2}`}
                style={{ left: `${(lastStop?.x ?? 50) < 50 ? (lastStop?.x ?? 50) + 12 : (lastStop?.x ?? 50) - 12}%` }}
              >
                <span className="am-v2-next-chapter__icon" aria-hidden="true">✦</span>
                <span className="am-v2-next-chapter__label">
                  Continue to Chapter {chapterIdx + 2}
                </span>
              </button>
            )}

            {/* Previous chapter button */}
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

        {/* Chapter badge */}
        <div className="am-v2-chapter-badge" aria-hidden="true">
          Chapter {chapterIdx + 1}
        </div>
      </div>

      {lockedMsg && (
        <div className="am-locked-msg" role="status">{lockedMsg}</div>
      )}

      {/* Back to Latest Level widget */}
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

      {/* Back to Isle button */}
      <button
        type="button"
        className="hfw-back-btn"
        onClick={() => onBack?.(fromIsleId)}
        aria-label="Back to Isle"
      >
        ← Back to Isle
      </button>
    </main>
  );
}
