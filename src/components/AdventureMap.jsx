import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import BuddyAvatar from './BuddyAvatar';
import { curriculumLists } from '../data/curriculumLists';
import { getMasteredWords } from '../utils/masteryEngine';
import './AdventureMap.css';

const SPELL_ISLES = [
  { id: 'ember',  name: 'Ember Isle',  emoji: '🔥', years: [1],    theme: 'ember'  },
  { id: 'flare',  name: 'Flare Isle',  emoji: '✨', years: [2],    theme: 'flare'  },
  { id: 'blaze',  name: 'Blaze Isle',  emoji: '🌟', years: [3, 4], theme: 'blaze'  },
  { id: 'aurora', name: 'Aurora Isle', emoji: '🌌', years: [5, 6], theme: 'aurora' },
];

const ISLE_BACKDROP = {
  ember:  '/adventure/ember-isle.png',
  flare:  '/adventure/flare-isle.png',
  blaze:  '/adventure/blaze-isle.png',
  aurora: '/adventure/aurora-isle.png',
};

// View 2 — vertical panoramic per isle. The painted dirt path IS the
// path; nodes are placed directly on it at per-isle calibrated coords.
const ISLE_BACKDROP_V2 = {
  ember:  '/adventure/ember-isle-vertical.png',
  // flare/blaze/aurora panoramics to be added.
};
const ISLE_BACKDROP_V2_RATIO = {
  ember:  941 / 1672,   // intrinsic width/height
};

// Per-isle calibrated stop coordinates (x%, y% of the panoramic).
// Ember coords — 9 stops on the painted dirt path (the original first
// coord floated above the isle and has been removed; what was #2 is
// now slot #0 where the buddy stands).
const V2_STOP_COORDS = {
  ember: [
    // Tighter vertical spacing so the path feels compact on the
    // painted island rather than stretched out, plus a stronger side
    // swing so the snake is unmistakable.
    { x: 50, y: 22 },
    { x: 39, y: 28 },
    { x: 61, y: 34 },
    { x: 38, y: 40 },
    { x: 62, y: 46 },
    { x: 40, y: 52 },
    { x: 60, y: 58 },
    { x: 39, y: 64 },
    { x: 55, y: 70 },
  ],
};

// Named landmarks reserved as special "location" stops along the path.
// Indices shift up by one to keep landmarks roughly where they were.
const V2_LANDMARK_BY_INDEX = {
  ember: {
    1: { label: 'Word Search Forest', icon: '🌲' },
    4: { label: 'Crossword Castle',   icon: '🏰' },
    7: { label: 'Quiz Quest Cave',    icon: '🕳️' },
  },
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

// View 1 (painted map) stop coords. Sine-wave seed; refine via the
// calibration tool (⊕ button) and paste captured values here.
const EMBER_SLOT_COUNT = 50;
const EMBER_COORDS = Array.from({ length: EMBER_SLOT_COUNT }, (_, i) => {
  const n = i / (EMBER_SLOT_COUNT - 1);
  const x = 8 + n * 86;
  const y = 47 + Math.sin(n * Math.PI * 5) * 16;
  return { x: +x.toFixed(2), y: +y.toFixed(2) };
});

const STOP_COORDS = {
  ember: EMBER_COORDS,
};

// ── View 2 (Candy Crush snake) layout constants ─────────────────────
// Strip is fixed-width on desktop; on mobile it expands via min(95vw, …).
// Vertical spacing + 3-column snake pattern produces a smooth zigzag.
const V2_STRIP_W   = 380;        // px
const V2_TOP_PAD   = 110;        // px before first stop
const V2_VERT_GAP  = 130;        // px between consecutive stops
const V2_COL_PCT   = [20, 50, 80]; // % of strip width per column
const V2_SNAKE     = [0, 1, 2, 1]; // column index cycle → smooth zigzag

function v2StopPos(i) {
  const col = V2_SNAKE[i % V2_SNAKE.length];
  return {
    xPct: V2_COL_PCT[col],
    yPx:  V2_TOP_PAD + i * V2_VERT_GAP,
    col,
  };
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
  const [hoveredIdx,     setHoveredIdx]     = useState(null);
  const [poppedIdx,      setPoppedIdx]      = useState(null);

  // View toggle — 1 = painted map, 2 = Candy-Crush snake
  const [view, setView] = useState(1);

  // Calibration only applies to View 1.
  const [calibrate,      setCalibrate]      = useState(false);
  const [calibPoints,    setCalibPoints]    = useState([]);

  const viewportRef = useRef(null);
  const sceneRef    = useRef(null);

  useEffect(() => { setSelectedIsleId(isleForYear(sessionYear).id); }, [sessionYear]);
  useEffect(() => { setPoppedIdx(null); setHoveredIdx(null); setCalibPoints([]); }, [selectedIsleId]);
  // Leaving View 2 should not leave calibration on either.
  useEffect(() => { if (view !== 1) setCalibrate(false); }, [view]);

  const selectedIsle = SPELL_ISLES.find(i => i.id === selectedIsleId) || currentIsle;

  const lists = useMemo(
    () => curriculumLists.filter(l => selectedIsle.years.includes(Number(l.year))),
    [selectedIsle]
  );

  const coords = STOP_COORDS[selectedIsle.theme] || [];

  // For View 2 we always show one slot per *list* (no "unassigned"
  // placeholders — there's no painted disc to fill). View 1 uses the
  // longer coords array so unassigned slots fill the painted island.
  const slotCount = view === 2
    ? lists.length
    : Math.max(coords.length, lists.length);

  const stops = useMemo(() => {
    let activeAssigned = false;
    return Array.from({ length: slotCount }, (_, i) => {
      const list = lists[i] || null;
      const c    = coords[i];
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
      return {
        list, state, slotIdx: i,
        x: c?.x ?? 50,
        y: c?.y ?? 50,
      };
    });
  }, [lists, coords, slotCount]);

  const activeIdx  = stops.findIndex(s => s.state === 'active');
  const activeStop = activeIdx >= 0 ? stops[activeIdx] : null;

  // Auto-centre on the buddy. Different maths per view.
  useEffect(() => {
    if (!viewportRef.current) return;
    const vp = viewportRef.current;
    if (view === 1) {
      if (!activeStop || !sceneRef.current) return;
      const scene = sceneRef.current;
      const targetX = (activeStop.x / 100) * scene.clientWidth  - vp.clientWidth  / 2;
      const targetY = (activeStop.y / 100) * scene.clientHeight - vp.clientHeight / 2;
      vp.scrollTo({ left: Math.max(0, targetX), top: Math.max(0, targetY), behavior: 'auto' });
      return;
    }
    // View 2: find the active stop in the per-isle V2 coord list and
    // scroll so it lands ~42% down the viewport.
    const coordsV2 = V2_STOP_COORDS[selectedIsle.theme] || [];
    let v2ActiveIdx = -1;
    let assigned = false;
    for (let i = 0; i < coordsV2.length; i++) {
      const list = lists[i];
      if (!list) continue;
      if (isListComplete(list)) continue;
      if (!assigned) { v2ActiveIdx = i; assigned = true; break; }
    }
    if (v2ActiveIdx < 0) return;
    // The scene's height = vp.scrollWidth (panoramic is full-width).
    // Use a tick-deferred read so it's measured after layout.
    requestAnimationFrame(() => {
      const scene = vp.querySelector('.am-v2-scene');
      if (!scene) return;
      const yPx = (coordsV2[v2ActiveIdx].y / 100) * scene.clientHeight;
      const targetY = yPx - vp.clientHeight * 0.42;
      vp.scrollTo({ top: Math.max(0, targetY), behavior: 'auto' });
    });
  }, [view, activeStop?.slotIdx, activeStop?.x, activeStop?.y, selectedIsleId, lists.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const onStopActivate = (stop, idx) => {
    if (calibrate) return;
    if (stop.state === 'locked') {
      // View 2 brief: "Complete earlier stops to unlock"
      const msg = view === 2
        ? 'Complete earlier stops to unlock'
        : stop.list?.name;
      if (view === 2) {
        setLockedMsg(msg);
        setTimeout(() => setLockedMsg(null), 1800);
      } else {
        setPoppedIdx(idx);
        setTimeout(() => setPoppedIdx(p => (p === idx ? null : p)), 1600);
      }
      return;
    }
    if (stop.state === 'unassigned') {
      setPoppedIdx(idx);
      setTimeout(() => setPoppedIdx(p => (p === idx ? null : p)), 1600);
      return;
    }
    if (stop.state === 'active' || poppedIdx === idx || hoveredIdx === idx) {
      if (typeof onOpenList === 'function') onOpenList(stop.list);
      else onSectionChange?.('exploreDashboard');
      return;
    }
    setPoppedIdx(idx);
  };

  // ── Click-and-drag scroll for the viewport (both views) ──────────
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);
  const onViewportPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    if (e.target.closest('.am-stop')) return;
    if (!viewportRef.current) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop:  viewportRef.current.scrollTop,
    };
    dragMovedRef.current = false;
    viewportRef.current.classList.add('am-viewport--dragging');
  };
  const onViewportPointerMove = (e) => {
    if (!dragRef.current || !viewportRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMovedRef.current = true;
    viewportRef.current.scrollLeft = dragRef.current.scrollLeft - dx;
    viewportRef.current.scrollTop  = dragRef.current.scrollTop  - dy;
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

  // Calibration (View 1 only): click scene to capture (%x, %y).
  const onSceneClick = useCallback((e) => {
    if (!calibrate || !sceneRef.current) return;
    const rect = sceneRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    setCalibPoints(prev => [...prev, { x: +x.toFixed(2), y: +y.toFixed(2) }]);
  }, [calibrate]);

  const copyCalibration = async () => {
    const out = calibPoints
      .map(p => `    { x: ${p.x.toString().padStart(5, ' ')}, y: ${p.y.toString().padStart(5, ' ')} },`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(out);
      setLockedMsg(`Copied ${calibPoints.length} coords to clipboard`);
      setTimeout(() => setLockedMsg(null), 2200);
    } catch {
      console.log('STOP_COORDS:\n' + out);
      setLockedMsg('Coords printed to console');
      setTimeout(() => setLockedMsg(null), 2200);
    }
  };

  const popoverVisible = (idx, state) =>
    state === 'active' || hoveredIdx === idx || poppedIdx === idx;

  // ── View 2 SVG snake path between consecutive stops ──────────────
  const v2StripHeight = V2_TOP_PAD * 2 + Math.max(0, stops.length - 1) * V2_VERT_GAP;
  const v2PathD = useMemo(() => {
    if (view !== 2 || stops.length === 0) return '';
    let d = '';
    stops.forEach((_, i) => {
      const p = v2StopPos(i);
      const xPx = (p.xPct / 100) * V2_STRIP_W;
      if (i === 0) { d = `M ${xPx} ${p.yPx}`; return; }
      const prev = v2StopPos(i - 1);
      const prevX = (prev.xPct / 100) * V2_STRIP_W;
      const midY  = (prev.yPx + p.yPx) / 2;
      d += ` C ${prevX} ${midY} ${xPx} ${midY} ${xPx} ${p.yPx}`;
    });
    return d;
  }, [view, stops.length]);

  const showStopLabelV2 = (idx, state) => {
    if (state === 'active') return true;
    if (state === 'completed') return Math.abs(idx - activeIdx) <= 1;
    if (state === 'locked')    return idx === activeIdx + 1;
    return false;
  };

  return (
    <main className={`am-root am-theme--${selectedIsle.theme} am-view-${view}`}>
      {/* Floating topbar */}
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

        <div className="am-topbar__right">
          {/* Calibration toolbar — View 1 only */}
          {view === 1 && (
            <>
              <button
                type="button"
                className={`am-calib-btn${calibrate ? ' am-calib-btn--on' : ''}`}
                onClick={() => setCalibrate(c => !c)}
                title="Calibrate stop coordinates"
                aria-pressed={calibrate}
              >
                {calibrate ? `● ${calibPoints.length}` : '⊕'}
              </button>
              {calibrate && calibPoints.length > 0 && (
                <>
                  <button type="button" className="am-calib-btn" onClick={copyCalibration} title="Copy captured coords">⧉</button>
                  <button type="button" className="am-calib-btn" onClick={() => setCalibPoints(p => p.slice(0, -1))} title="Undo last point">↶</button>
                  <button type="button" className="am-calib-btn" onClick={() => setCalibPoints([])} title="Clear all">✕</button>
                </>
              )}
            </>
          )}

          {/* View toggle */}
          <button
            type="button"
            className="am-view-toggle"
            onClick={() => setView(v => (v === 1 ? 2 : 1))}
            aria-label={`Switch to view ${view === 1 ? 2 : 1}`}
            title={`Switch to view ${view === 1 ? 2 : 1}`}
          >
            View {view} / {view === 1 ? 2 : 1}
          </button>

          {/* HFW — View 1 only (View 2 has its own pinned HFW node) */}
          {view === 1 && (
            <button
              type="button"
              className="am-hfw-btn"
              onClick={() => onSectionChange?.('exploreDashboard')}
              aria-label="HFW Island"
            >
              <span className="am-hfw-btn__emoji" aria-hidden="true">🏝️</span>
              <span className="am-hfw-btn__name">HFW</span>
            </button>
          )}
        </div>
      </header>

      {/* ── VIEW 1 — painted island map ──────────────────────────── */}
      {view === 1 && (
        <div
          className="am-viewport am-viewport--v1"
          ref={viewportRef}
          onPointerDown={onViewportPointerDown}
          onPointerMove={onViewportPointerMove}
          onPointerUp={onViewportPointerUp}
          onPointerCancel={onViewportPointerUp}
          onPointerLeave={onViewportPointerUp}
          onClickCapture={onViewportClickCapture}
        >
          <div
            className={`am-scene${calibrate ? ' am-scene--calibrating' : ''}`}
            ref={sceneRef}
            onClick={onSceneClick}
          >
            <img
              className="am-bg-img"
              src={ISLE_BACKDROP[selectedIsle.theme]}
              alt={`${selectedIsle.name} map`}
              draggable={false}
            />

            {!calibrate && stops.map((stop, idx) => (
              <button
                key={stop.list?.id || `slot-${stop.slotIdx}`}
                type="button"
                className={`am-stop am-stop--${stop.state}`}
                onClick={(e) => { e.stopPropagation(); onStopActivate(stop, idx); }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(p => (p === idx ? null : p))}
                aria-label={stop.list ? `${stop.list.name} — ${stop.state}` : 'Locked stop — coming soon'}
                style={{ left: `${stop.x}%`, top: `${stop.y}%` }}
              >
                <span className="am-stop__ring" aria-hidden="true" />
                {stop.state === 'completed' && (
                  <span className="am-stop__check" aria-hidden="true">✓</span>
                )}
                {(stop.state === 'locked' || stop.state === 'unassigned') && (
                  <span className="am-stop__lock" aria-hidden="true">🔒</span>
                )}
                {popoverVisible(idx, stop.state) && (
                  <span className={`am-stop__popover am-stop__popover--${stop.state}`}>
                    {stop.list ? stop.list.name : 'Coming soon'}
                  </span>
                )}
              </button>
            ))}

            {!calibrate && activeStop && (
              <div
                className="am-buddy"
                style={{ left: `${activeStop.x}%`, top: `${activeStop.y}%` }}
              >
                <BuddyAvatar
                  id={session?.childCharacter?.id || 'raccoon'}
                  fallback={session?.childCharacter?.emoji || '🦝'}
                  size={56}
                />
              </div>
            )}

            {calibrate && calibPoints.map((p, i) => (
              <div key={i} className="am-calib-dot" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <span>{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VIEW 2 — Panoramic island map ────────────────────────── */}
      {view === 2 && (() => {
        const v2Bg     = ISLE_BACKDROP_V2[selectedIsle.theme];
        const v2Ratio  = ISLE_BACKDROP_V2_RATIO[selectedIsle.theme] || (9 / 16);
        const v2Coords = V2_STOP_COORDS[selectedIsle.theme] || [];
        const v2Landmarks = V2_LANDMARK_BY_INDEX[selectedIsle.theme] || {};

        // One stop per calibrated coord, mapped to the matching list in
        // journey order. Coords without a list → unassigned (locked, no
        // list). Lists beyond the coords list still don't appear — the
        // calibration array is the source of truth for what's on the path.
        let activeAssignedV2 = false;
        const v2Stops = v2Coords.map((c, i) => {
          const list = lists[i] || null;
          let state;
          if (!list) {
            state = 'unassigned';
          } else if (isListComplete(list)) {
            state = 'completed';
          } else if (!activeAssignedV2) {
            state = 'active';
            activeAssignedV2 = true;
          } else {
            state = 'locked';
          }
          // First locked after active = "next" — gentle bob animation.
          return { list, state, slotIdx: i, x: c.x, y: c.y, landmark: v2Landmarks[i] || null };
        });
        // Mark the first locked stop after the active one as "next".
        const v2ActiveIdx = v2Stops.findIndex(s => s.state === 'active');
        if (v2ActiveIdx >= 0 && v2Stops[v2ActiveIdx + 1]?.state === 'locked') {
          v2Stops[v2ActiveIdx + 1].state = 'next';
        }

        return (
          <div className="am-v2-wrap">
            {/* Floating HFW pin — always accessible, pinned top-right */}
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
              {/* Scene = panoramic image at full width; height derived
                  from intrinsic aspect ratio so coords stay correct. */}
              <div
                className="am-v2-scene"
                style={{ aspectRatio: `${v2Ratio}` }}
              >
                {v2Bg && (
                  <img
                    className="am-v2-bg"
                    src={v2Bg}
                    alt={`${selectedIsle.name} map`}
                    draggable={false}
                  />
                )}

                {/* Magical pathway connecting all stops. Four layered
                    strokes give it depth: outer warm halo (huge & soft),
                    mid amber rope, inner bright core, and a moving
                    "marching embers" dash that animates along the path
                    to suggest progress/flow. Wider snake amplitude in
                    the coords means the path swings noticeably. */}
                <svg
                  className="am-v2-magic-path"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="am-v2-magicGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0"   stopColor="#fff5b8" />
                      <stop offset="0.5" stopColor="#ffd93d" />
                      <stop offset="1"   stopColor="#ff8c3d" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    if (v2Stops.length < 2) return null;
                    let d = `M ${v2Stops[0].x} ${v2Stops[0].y}`;
                    for (let i = 1; i < v2Stops.length; i++) {
                      const a = v2Stops[i - 1], b = v2Stops[i];
                      const midY = (a.y + b.y) / 2;
                      d += ` C ${a.x} ${midY} ${b.x} ${midY} ${b.x} ${b.y}`;
                    }
                    return (
                      <>
                        {/* 1. Soft glow halo — large diffuse band */}
                        <path d={d} className="am-v2-magic-path__halo" />
                        {/* 2. Dark rope shadow — gives the path weight */}
                        <path d={d} className="am-v2-magic-path__shadow" />
                        {/* 3. Mid amber rope — main visible line */}
                        <path d={d} className="am-v2-magic-path__rope" />
                        {/* 4. Bright core — hot inner highlight */}
                        <path d={d} className="am-v2-magic-path__core" />
                        {/* 5. Marching embers — animated dash flowing
                            forwards toward the next stop, "guiding" the
                            player up the path. Two layers: warm amber
                            dashes (slow) + bright white sparks (fast)
                            travelling along the same curve. */}
                        <path d={d} className="am-v2-magic-path__embers" />
                        <path d={d} className="am-v2-magic-path__sparks" />
                      </>
                    );
                  })()}
                </svg>

                {v2Stops.map((stop, idx) => {
                  const labelSide = stop.x < 50 ? 'right' : 'left';
                  const isActive = stop.state === 'active';
                  // View 2: only the active stop is clickable. Everything
                  // else renders locked (visually + behaviourally).
                  const renderState = isActive ? 'active' : 'locked';
                  const stars = renderState === 'completed' ? starsForList(stop.list) : 0;
                  return (
                    <button
                      key={stop.list?.id || `slot-${stop.slotIdx}`}
                      type="button"
                      className={`am-v2-node am-v2-node--${renderState}${stop.landmark ? ' am-v2-node--landmark' : ''}`}
                      onClick={(e) => { e.stopPropagation(); if (isActive) onStopActivate(stop, idx); }}
                      aria-label={stop.list ? `${stop.list.name} — ${renderState}` : 'Locked stop'}
                      style={{ left: `${stop.x}%`, top: `${stop.y}%` }}
                      disabled={!isActive}
                    >
                      <span className="am-v2-node__disc" aria-hidden="true">
                        <span className="am-v2-node__rim" />
                        <span className="am-v2-node__glow" />
                        <span className="am-v2-node__face">
                          {isActive
                            ? <span className="am-v2-node__num">{idx + 1}</span>
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

                      {renderState === 'completed' && stars > 0 && (
                        <span className="am-v2-node__stars" aria-label={`${stars} of 3 stars`}>
                          {Array.from({ length: 3 }, (_, i) => (
                            <span
                              key={i}
                              className={`am-v2-node__star${i < stars ? ' am-v2-node__star--on' : ''}`}
                            >★</span>
                          ))}
                        </span>
                      )}

                      {/* Label: always shown for the active stop;
                          for everything else it appears on hover only. */}
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
                {v2ActiveIdx >= 0 && (() => {
                  const a = v2Stops[v2ActiveIdx];
                  return (
                    <div
                      className="am-v2-buddy"
                      style={{ left: `${a.x}%`, top: `${a.y}%` }}
                    >
                      <BuddyAvatar
                        id={session?.childCharacter?.id || 'raccoon'}
                        fallback={session?.childCharacter?.emoji || '🦝'}
                        size={56}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}

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
