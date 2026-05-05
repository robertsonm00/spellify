import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ImageCropper.css';

// Minimum crop side as a fraction of the image dimension
const MIN_FRAC = 0.06;

// The 8 handles: id encodes which edges move
const HANDLES = [
  { id: 'nw', cx: 0,   cy: 0,   cursor: 'nw-resize' },
  { id: 'n',  cx: 0.5, cy: 0,   cursor: 'n-resize'  },
  { id: 'ne', cx: 1,   cy: 0,   cursor: 'ne-resize'  },
  { id: 'e',  cx: 1,   cy: 0.5, cursor: 'e-resize'   },
  { id: 'se', cx: 1,   cy: 1,   cursor: 'se-resize'  },
  { id: 's',  cx: 0.5, cy: 1,   cursor: 's-resize'   },
  { id: 'sw', cx: 0,   cy: 1,   cursor: 'sw-resize'  },
  { id: 'w',  cx: 0,   cy: 0.5, cursor: 'w-resize'   },
];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function clientPos(e) {
  const src = e.touches ? e.touches[0] : e;
  return { cx: src.clientX, cy: src.clientY };
}

export default function ImageCropper({ imageFile, onConfirm, onCancel }) {
  // Create a stable object URL for the preview; clean up on unmount
  const [imageUrl] = useState(() => URL.createObjectURL(imageFile));
  useEffect(() => () => URL.revokeObjectURL(imageUrl), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Crop box: all values are 0–1 fractions of the rendered image dimensions
  const [cropBox, setCropBox] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });

  // Active drag stored in a ref so move/up handlers never stale-close over cropBox
  const dragRef      = useRef(null);
  const containerRef = useRef(null);

  // ── Drag start ─────────────────────────────────────────────────────────────

  const startDrag = useCallback((type, e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect      = containerRef.current.getBoundingClientRect();
    const { cx, cy } = clientPos(e);
    dragRef.current = {
      type,
      startFX:  (cx - rect.left) / rect.width,
      startFY:  (cy - rect.top)  / rect.height,
      startBox: { ...cropBox },
      rect,
    };
  }, [cropBox]);

  // ── Drag move ─────────────────────────────────────────────────────────────

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const { type, startFX, startFY, startBox: b, rect } = dragRef.current;
    const { cx, cy } = clientPos(e);
    const dx = (cx - rect.left) / rect.width  - startFX;
    const dy = (cy - rect.top)  / rect.height - startFY;

    let { x, y, w, h } = b;

    if (type === 'move') {
      x = clamp(b.x + dx, 0, 1 - b.w);
      y = clamp(b.y + dy, 0, 1 - b.h);
    } else {
      // Left edge moves (w-handles)
      if (type === 'nw' || type === 'w' || type === 'sw') {
        const newX = clamp(b.x + dx, 0, b.x + b.w - MIN_FRAC);
        w = b.w - (newX - b.x);
        x = newX;
      }
      // Right edge moves (e-handles)
      if (type === 'ne' || type === 'e' || type === 'se') {
        w = clamp(b.w + dx, MIN_FRAC, 1 - b.x);
      }
      // Top edge moves (n-handles)
      if (type === 'nw' || type === 'n' || type === 'ne') {
        const newY = clamp(b.y + dy, 0, b.y + b.h - MIN_FRAC);
        h = b.h - (newY - b.y);
        y = newY;
      }
      // Bottom edge moves (s-handles)
      if (type === 'sw' || type === 's' || type === 'se') {
        h = clamp(b.h + dy, MIN_FRAC, 1 - b.y);
      }
    }

    setCropBox({ x, y, w, h });
  }, []);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  // Attach global listeners so dragging works when the pointer moves fast
  useEffect(() => {
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup',   onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend',  onPointerUp);
    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup',   onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend',  onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // ── Confirm: pass crop coordinates up immediately (canvas work done in parent) ──

  const handleConfirm = useCallback(() => {
    // Synchronous — the parent transitions to PROCESSING straight away,
    // then does the canvas crop while the loading animation is showing.
    onConfirm(cropBox);
  }, [cropBox, onConfirm]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Convert a 0–1 fraction to a CSS percentage string
  const pct = (v) => `${(v * 100).toFixed(3)}%`;
  const { x, y, w, h } = cropBox;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="ic-wrap">
      <p className="ic-hint">📐 Drag the box to frame just your spelling words, then hit Extract</p>

      {/* Dark stage so the image pops */}
      <div className="ic-stage">
        <div ref={containerRef} className="ic-container">

          {/* The image itself */}
          <img src={imageUrl} alt="Upload preview" className="ic-img" draggable={false} />

          {/* Four dim regions outside the crop box */}
          <div className="ic-dim" style={{ top: 0, left: 0, right: 0, height: pct(y) }} />
          <div className="ic-dim" style={{ top: pct(y + h), left: 0, right: 0, bottom: 0 }} />
          <div className="ic-dim" style={{ top: pct(y), left: 0, width: pct(x), height: pct(h) }} />
          <div className="ic-dim" style={{ top: pct(y), left: pct(x + w), right: 0, height: pct(h) }} />

          {/* The crop box — drag to reposition */}
          <div
            className="ic-box"
            style={{ left: pct(x), top: pct(y), width: pct(w), height: pct(h) }}
            onMouseDown={(e) => startDrag('move', e)}
            onTouchStart={(e) => startDrag('move', e)}
          >
            {/* Rule-of-thirds guide lines */}
            <div className="ic-grid ic-grid--h" style={{ top: '33.33%' }} />
            <div className="ic-grid ic-grid--h" style={{ top: '66.66%' }} />
            <div className="ic-grid ic-grid--v" style={{ left: '33.33%' }} />
            <div className="ic-grid ic-grid--v" style={{ left: '66.66%' }} />

            {/* 8 resize handles */}
            {HANDLES.map(({ id, cx, cy, cursor }) => (
              <div
                key={id}
                className={`ic-handle ic-handle--${id.length === 1 ? 'edge' : 'corner'}`}
                style={{ left: pct(cx), top: pct(cy), cursor }}
                onMouseDown={(e) => { e.stopPropagation(); startDrag(id, e); }}
                onTouchStart={(e) => { e.stopPropagation(); startDrag(id, e); }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="ic-actions">
        <button className="ic-back-btn" onClick={onCancel} type="button">
          ← Try Another File
        </button>
        <button className="ic-confirm-btn" onClick={handleConfirm} type="button">
          ✂️ Extract Words
        </button>
      </div>
    </div>
  );
}
