import React, { useMemo, useEffect, useState, useRef } from 'react';
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
  { x: 55, y: 67 },
  { x: 49, y: 73 },
];

// Per-isle chapter configuration. Each chapter is one painted
// panoramic + its calibrated coords. When the chapter index runs
// past the array length we modulo back to chapter 0.
const ISLE_CHAPTERS = {
  ember: [
    {
      bg:     '/adventure/ember-isle-vertical.png',
      ratio:  941 / 1672,
      coords: DEFAULT_CHAPTER_COORDS,
      landmarks: {
        1: { label: 'Word Search Forest', icon: '🌲' },
        4: { label: 'Crossword Castle',   icon: '🏰' },
        7: { label: 'Quiz Quest Cave',    icon: '🕳️' },
      },
    },
    {
      bg:     '/adventure/ember-isle-vertical-2.png',
      ratio:  941 / 1672,
      coords: DEFAULT_CHAPTER_COORDS,
      landmarks: {},
    },
    {
      bg:     '/adventure/ember-isle-vertical-3.png',
      ratio:  941 / 1672,
      coords: DEFAULT_CHAPTER_COORDS,
      landmarks: {},
    },
  ],
};

// Star count (0–3) derived from real mastery ratio. Completion is at
// the existing 80% threshold; star tiers above that reward perfection.
function starsForList(list) {
  const total = list?.wordCount || list?.words?.length || 0;
  if (!total) return 0;
  const mastered = getMasteredWords(list.id).length;
  const ratio = mastered / total;
  if (ratio >= 0.95) return 3;
  if (ratio >= 0.85) return 2;
  if (ratio >= 0.6)  return 1;
  return 0;
}

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

export default function AdventureMap({ session, onSectionChange, onOpenList }) {
  const sessionYear = Number(session?.year) || 1;
  const currentIsle = isleForYear(sessionYear);
  const [selectedIsleId, setSelectedIsleId] = useState(currentIsle.id);
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

  // Listen for the global 'spellify-list-mastered' event (fired by ListHub
  // when the mastery modal first appears). Re-read mastery data and schedule
  // the reveal animation for the now-completed stop + newly unlocked next stop.
  useEffect(() => {
    const onMastered = (e) => {
      const masteredId = e.detail?.listId || null;
      setMasteryVersion(v => v + 1);
      if (masteredId) {
        // Mark this stop for reveal; the actual reveal fires in the
        // effect below once stops re-evaluates with the new mastery data.
        setRevealingIds(prev => new Set([...prev, masteredId]));
      }
    };
    window.addEventListener('spellify-list-mastered', onMastered);
    return () => window.removeEventListener('spellify-list-mastered', onMastered);
  }, []);

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

  // Detect stop state transitions (e.g. locked→completed, locked→active)
  // and fire the map-return celebration + reveal animation (Part 6).
  useEffect(() => {
    const snap = stops.map(s => ({ id: s.list?.id || null, state: s.state }));
    const prev = prevStopsSnap.current;
    if (prev) {
      const newlyCompleted = snap.filter((s, i) =>
        s.state === 'completed' && prev[i]?.state !== 'completed'
      );
      const newlyUnlocked = snap.filter((s, i) =>
        s.state === 'active' && (prev[i]?.state === 'locked' || prev[i]?.state === 'next')
      );
      if (newlyCompleted.length > 0) {
        // Staggered celebration: buddy + confetti burst
        setTimeout(() => fireBuddyCheer(), 200);
        setTimeout(() => {
          confetti({
            particleCount: 130,
            spread: 85,
            origin: { y: 0.48 },
            colors: ['#6bcb77', '#ffd93d', '#c77dff', '#ec4899', '#60a5fa', '#fff'],
          });
        }, 350);
        // Reveal animation for newly-transitioned stops
        const ids = new Set([
          ...newlyCompleted.map(s => s.id),
          ...newlyUnlocked.map(s => s.id),
        ].filter(Boolean));
        setRevealingIds(ids);
        setTimeout(() => setRevealingIds(new Set()), 700);
      }
    }
    prevStopsSnap.current = snap;
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
      const focusY = activeStop?.y ?? 5;
      const yPx = (focusY / 100) * scene.clientHeight;
      const targetY = yPx - vp.clientHeight * 0.42;
      vp.scrollTo({ top: Math.max(0, targetY), behavior: 'auto' });
    });
  }, [activeStop?.x, activeStop?.y, selectedIsleId, chapterIdx]);

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
    if (typeof onOpenList === 'function') onOpenList(stop.list);
    else onSectionChange?.('exploreDashboard');
  };

  // Vertical click-and-drag scrolling for desktop (touch is native).
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);
  const onViewportPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return;
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

  return (
    <main className={`am-root am-theme--${selectedIsle.theme}`}>
      {/* Floating topbar — isle pill + HFW pin */}
      <header className="am-topbar">
        <button
          type="button"
          className="am-isle-pill"
          onClick={() => setSwitcherOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={switcherOpen}
        >
          <span className="am-isle-pill__emoji" aria-hidden="true">{selectedIsle.emoji}</span>
          <span className="am-isle-pill__name">{selectedIsle.name}</span>
          <span className="am-isle-pill__chev" aria-hidden="true">▾</span>
        </button>
      </header>

      {/* Painted panoramic map with nodes positioned on the painted path */}
      <div className="am-v2-wrap">
        <button
          type="button"
          className="am-v2-hfw"
          onClick={() => onSectionChange?.('exploreDashboard')}
          aria-label="HFW Island"
        >
          <span className="am-v2-hfw__emoji" aria-hidden="true">🏝️</span>
          <span className="am-v2-hfw__name">HFW</span>
        </button>

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
                className="am-v2-bg"
                src={bg}
                alt={`${selectedIsle.name} map`}
                draggable={false}
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
                let d = `M ${stops[0].x} ${stops[0].y}`;
                for (let i = 1; i < stops.length; i++) {
                  const a = stops[i - 1], b = stops[i];
                  const midY = (a.y + b.y) / 2;
                  d += ` C ${a.x} ${midY} ${b.x} ${midY} ${b.x} ${b.y}`;
                }
                // Extend past the last stop — the path snakes onward
                // toward the bottom of the panoramic to signal that
                // more world lies beyond.
                if (lastStop && hasNextChapter) {
                  const exitX = lastStop.x < 50 ? lastStop.x + 12 : lastStop.x - 12;
                  const exitY = 96;            // just past the painted dock
                  const midY = (lastStop.y + exitY) / 2;
                  d += ` C ${lastStop.x} ${midY} ${exitX} ${midY} ${exitX} ${exitY}`;
                }
                return (
                  <>
                    {/* Outer violet aura — wider, softer, sets the
                        magical purple atmosphere around the path */}
                    <path d={d} className="am-v2-magic-path__aura" />
                    {/* Warm amber halo on top of it */}
                    <path d={d} className="am-v2-magic-path__halo" />
                    {/* Dark grounding shadow */}
                    <path d={d} className="am-v2-magic-path__shadow" />
                    {/* (rope + core layers stay hidden — the path is
                        ALL ember dashes; see CSS) */}
                    <path d={d} className="am-v2-magic-path__rope" />
                    <path d={d} className="am-v2-magic-path__core" />
                    {/* Three layered moving dash currents:
                        amber (slow), magenta (medium), white (fast) */}
                    <path d={d} className="am-v2-magic-path__embers" />
                    <path d={d} className="am-v2-magic-path__shimmer" />
                    <path d={d} className="am-v2-magic-path__sparks" />
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
              const stars = isCompleted ? starsForList(stop.list) : 0;
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
                    <span className="am-v2-node__glow" />
                    <span className="am-v2-node__face">
                      {isActive
                        ? <span className="am-v2-node__num">{idx + 1}</span>
                        : isCompleted
                          ? <span className="am-v2-node__tick">✓</span>
                          : <span className="am-v2-node__lock">🔒</span>}
                    </span>
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

                  {isCompleted && stars > 0 && (
                    <span className="am-v2-node__stars" aria-label={`${stars} of 3 stars`}>
                      {Array.from({ length: 3 }, (_, i) => (
                        <span
                          key={i}
                          className={`am-v2-node__star${i < stars ? ' am-v2-node__star--on' : ''}`}
                        >★</span>
                      ))}
                    </span>
                  )}

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

            {/* Buddy sits on the active disc */}
            {activeStop && (
              <div className="am-v2-buddy" style={{ left: `${activeStop.x}%`, top: `${activeStop.y}%` }}>
                <BuddyAvatar
                  id={session?.childCharacter?.id || 'raccoon'}
                  fallback={session?.childCharacter?.emoji || '🦝'}
                  size={56}
                />
              </div>
            )}

            {/* ── Chapter advance CTA — bottom of the panoramic ── */}
            {hasNextChapter && (
              <button
                type="button"
                className={`am-v2-next-chapter${chapterAllComplete ? ' am-v2-next-chapter--ready' : ''}`}
                onClick={advanceChapter}
                disabled={!chapterAllComplete}
                aria-label={chapterAllComplete
                  ? `Continue to Chapter ${chapterIdx + 2}`
                  : `Finish this chapter to unlock Chapter ${chapterIdx + 2}`}
                style={{ left: `${(lastStop?.x ?? 50) < 50 ? (lastStop?.x ?? 50) + 12 : (lastStop?.x ?? 50) - 12}%` }}
              >
                <span className="am-v2-next-chapter__icon" aria-hidden="true">
                  {chapterAllComplete ? '✦' : '🔒'}
                </span>
                <span className="am-v2-next-chapter__label">
                  {chapterAllComplete
                    ? `Continue to Chapter ${chapterIdx + 2}`
                    : `Complete all ${STOPS_PER_CHAPTER} to unlock`}
                </span>
              </button>
            )}

            {/* ── Previous chapter pill — top-right of the scene ── */}
            {chapterIdx > 0 && (
              <button
                type="button"
                className="am-v2-prev-chapter"
                onClick={previousChapter}
                aria-label={`Back to Chapter ${chapterIdx}`}
              >
                <span aria-hidden="true">↑</span> Chapter {chapterIdx}
              </button>
            )}
          </div>
        </div>

        {/* Chapter pill — shown beside the isle pill (sticky top) */}
        <div className="am-v2-chapter-badge" aria-hidden="true">
          Chapter {chapterIdx + 1} <span className="am-v2-chapter-badge__div">·</span> {chapterIdx + 1} / {totalChapters}
        </div>
      </div>

      {lockedMsg && (
        <div className="am-locked-msg" role="status">{lockedMsg}</div>
      )}

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
