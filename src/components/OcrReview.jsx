import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './OcrReview.css';
import { STATUS, classifyCandidate, normalizeWord } from '../utils/wordValidation.js';

const MAX_WORDS = 30;

/**
 * OcrReview
 *
 * The user's gatekeeping step between OCR output and the rest of the app.
 * No word leaves this screen until the parent receives `onConfirm`.
 *
 * Props:
 *  - candidates: array of classified candidate objects from
 *    wordValidation.classifyCandidates().
 *  - onConfirm(words: string[]): called with the final confirmed list.
 *  - onBack(): user wants to scan a different file.
 */
export default function OcrReview({ candidates, onConfirm, onBack }) {
  const uid = useRef(0);
  const mkId = () => { uid.current += 1; return uid.current; };

  // Each item carries the full candidate plus a stable id and an
  // editable `confirmedText`. `status` can change as the user edits.
  const [items, setItems] = useState(() =>
    (candidates || [])
      .slice(0, MAX_WORDS)
      .map((c) => ({ id: mkId(), ...c })),
  );

  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showAdd,   setShowAdd]   = useState(false);
  const [addValue,  setAddValue]  = useState('');

  const editInputRef = useRef(null);
  const addInputRef  = useRef(null);

  useEffect(() => { if (editingId !== null) editInputRef.current?.select(); }, [editingId]);
  useEffect(() => { if (showAdd) addInputRef.current?.focus(); }, [showAdd]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const startEdit = (id, text) => {
    if (showAdd) { setShowAdd(false); setAddValue(''); }
    setEditingId(id);
    setEditValue(text);
  };

  const commitEdit = useCallback(() => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== editingId) return it;
      const cleaned = normalizeWord(editValue);
      if (cleaned.length < 2) return it; // ignore empty edits
      // Re-classify as a manual entry so the status reflects user trust.
      const reclassified = classifyCandidate({
        rawText: cleaned,
        source: 'manual',
        ocrConfidence: 100,
      });
      return { ...it, ...reclassified, id: it.id };
    }));
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue]);

  const cancelEdit = () => { setEditingId(null); setEditValue(''); };

  const deleteItem = (id, e) => {
    e?.stopPropagation();
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (editingId === id) cancelEdit();
  };

  const acceptSuggestion = (id) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      if (!it.suggestedText) return it;
      const reclassified = classifyCandidate({
        rawText: it.suggestedText,
        source: 'fuzzy',
        ocrConfidence: 100,
      });
      return { ...it, ...reclassified, id: it.id };
    }));
  };

  const dismissSuggestion = (id) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      // Keep the original candidate text; downgrade to needsReview only if
      // it isn't already in the dictionary.
      const reclassified = classifyCandidate({
        rawText: it.candidateText,
        source: 'manual',           // user has vouched for it
        ocrConfidence: 100,
      });
      return { ...it, ...reclassified, id: it.id };
    }));
  };

  // ── Add ───────────────────────────────────────────────────────────────────

  const openAdd = () => {
    if (editingId !== null) commitEdit();
    setShowAdd(true);
    setAddValue('');
  };

  const commitAdd = useCallback(() => {
    const cleaned = normalizeWord(addValue);
    if (cleaned.length >= 2) {
      setItems((prev) => {
        if (prev.length >= MAX_WORDS) return prev;
        const reclassified = classifyCandidate({
          rawText: cleaned,
          source: 'manual',
          ocrConfidence: 100,
        });
        return [...prev, { id: mkId(), ...reclassified }];
      });
    }
    setAddValue('');
    setShowAdd(false);
  }, [addValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelAdd = () => { setAddValue(''); setShowAdd(false); };

  // ── Confirm ───────────────────────────────────────────────────────────────

  const handleConfirm = () => {
    // Fold any in-flight edit / add so the user doesn't lose their last keystroke.
    let finalItems = [...items];
    if (editingId !== null) {
      const cleaned = normalizeWord(editValue);
      if (cleaned.length >= 2) {
        finalItems = finalItems.map((it) =>
          it.id === editingId ? { ...it, confirmedText: cleaned } : it,
        );
      }
    }
    if (showAdd) {
      const cleaned = normalizeWord(addValue);
      if (cleaned.length >= 2 && finalItems.length < MAX_WORDS) {
        finalItems.push({ id: -1, confirmedText: cleaned });
      }
    }

    const seen  = new Set();
    const final = [];
    for (const it of finalItems) {
      const w = (it.confirmedText || '').toLowerCase();
      if (w.length < 2) continue;
      if (seen.has(w)) continue;
      seen.add(w);
      final.push(w);
      if (final.length >= MAX_WORDS) break;
    }
    if (final.length === 0) return;
    onConfirm(final);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const c = { confident: 0, needsReview: 0, total: items.length };
    for (const it of items) {
      if (it.status === STATUS.CONFIDENT)    c.confident++;
      if (it.status === STATUS.NEEDS_REVIEW) c.needsReview++;
    }
    return c;
  }, [items]);

  const canAdd     = counts.total < MAX_WORDS && !showAdd;
  const canConfirm = counts.total >= 1;

  // Bucket items: confident (no decision needed) vs. review (needs a choice).
  // Order is preserved within each bucket so the user can still scan top→bottom.
  const confidentItems = items.filter((it) => it.status === STATUS.CONFIDENT);
  const reviewItems    = items.filter((it) => it.status !== STATUS.CONFIDENT);

  // Shared chip renderer — used by both the cloud and the review list.
  const renderChip = (item) => {
    const editing = editingId === item.id;
    const isReview = item.status === STATUS.NEEDS_REVIEW;

    return (
      <div
        key={item.id}
        className={[
          'ocr-chip',
          `ocr-chip--${item.status}`,
          editing ? 'ocr-chip--editing' : '',
        ].filter(Boolean).join(' ')}
        title={
          isReview
            ? `OCR confidence ${Math.round(item.confidence)}% — please check`
            : `OCR confidence ${Math.round(item.confidence)}%`
        }
      >
        <span className="ocr-chip-status" aria-hidden="true">
          {item.status === STATUS.CONFIDENT    ? '✓' : ''}
          {item.status === STATUS.NEEDS_REVIEW ? '⚠' : ''}
        </span>

        {editing ? (
          <input
            ref={editInputRef}
            className="ocr-chip-input"
            value={editValue}
            size={Math.max(editValue.length + 1, 4)}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            onBlur={commitEdit}
            maxLength={20}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
          />
        ) : (
          <span
            className="ocr-chip-text"
            onClick={() => startEdit(item.id, item.confirmedText)}
          >
            {item.confirmedText}
          </span>
        )}

        <button
          className="ocr-chip-delete"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => deleteItem(item.id, e)}
          type="button"
          tabIndex={-1}
          aria-label={`Remove ${item.confirmedText}`}
        >
          ✕
        </button>
      </div>
    );
  };

  // ── Header copy ───────────────────────────────────────────────────────────

  let headerTitle, headerSub, headerIcon;
  if (counts.total === 0) {
    headerIcon  = '🔎';
    headerTitle = 'No reliable words found';
    headerSub   = 'Try cropping just the word column — or type your words in.';
  } else if (counts.needsReview > 0) {
    headerIcon  = '🟡';
    headerTitle = 'Some words need checking';
    headerSub   = `Tap any ⚠️ word to fix it · ${counts.confident} look great so far`;
  } else {
    headerIcon  = '🎉';
    headerTitle = 'We found these words — please check them';
    headerSub   = 'Tap a word to edit · ✕ to remove · add anything we missed';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ocr-wrap">

      {/* Header */}
      <div className="ocr-header">
        <span className="ocr-header-icon" aria-hidden="true">{headerIcon}</span>
        <div>
          <p className="ocr-header-title">{headerTitle}</p>
          <p className="ocr-header-sub">{headerSub}</p>
        </div>
      </div>

      {/* Empty state */}
      {counts.total === 0 && !showAdd && (
        <div className="ocr-empty">
          <p className="ocr-empty-msg">
            We couldn't reliably read any words from that image.
            Try a clearer photo, crop tighter to the word column,
            or add the words yourself.
          </p>
          <button className="ocr-empty-add-btn" onClick={openAdd} type="button">
            + Add a word
          </button>
        </div>
      )}

      {/* Chip area — split into a confident cloud and a review list */}
      {(counts.total > 0 || showAdd) && (
        <div className="ocr-chip-area">

          {/* Confident cloud (no decisions needed) */}
          {(confidentItems.length > 0 || showAdd || canAdd) && (
            <div className="ocr-confident-cloud">
              {confidentItems.map((item) => renderChip(item))}

              {showAdd && (
                <div className="ocr-chip ocr-chip--adding">
                  <input
                    ref={addInputRef}
                    className="ocr-chip-input"
                    value={addValue}
                    size={Math.max(addValue.length + 1, 6)}
                    placeholder="new word…"
                    onChange={(e) => setAddValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')  { e.preventDefault(); commitAdd(); }
                      if (e.key === 'Escape') { e.preventDefault(); cancelAdd(); }
                    }}
                    onBlur={commitAdd}
                    maxLength={20}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                  />
                  <button
                    className="ocr-chip-delete"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={cancelAdd}
                    type="button"
                    tabIndex={-1}
                    aria-label="Cancel add"
                  >
                    ✕
                  </button>
                </div>
              )}

              {canAdd && (
                <button className="ocr-add-btn" onClick={openAdd} type="button">
                  + Add word
                </button>
              )}
            </div>
          )}

          {/* Review list — one row per word that needs a decision */}
          {reviewItems.length > 0 && (
            <div
              className="ocr-review-list"
              role="list"
              aria-label="Words that need checking"
            >
              {reviewItems.map((item) => {
                const editing = editingId === item.id;
                const showSuggestion =
                  !editing &&
                  item.suggestedText &&
                  item.suggestedText !== item.confirmedText;

                return (
                  <div className="ocr-review-row" role="listitem" key={item.id}>
                    {renderChip(item)}
                    {showSuggestion ? (
                      <div className="ocr-review-suggest">
                        <span className="ocr-review-suggest-label">Did you mean</span>
                        <button
                          className="ocr-chip-suggest-yes"
                          onClick={() => acceptSuggestion(item.id)}
                          type="button"
                        >
                          “{item.suggestedText}”?
                        </button>
                        <button
                          className="ocr-chip-suggest-no"
                          onClick={() => dismissSuggestion(item.id)}
                          type="button"
                          aria-label="Keep my version"
                        >
                          no, keep
                        </button>
                      </div>
                    ) : (
                      <span className="ocr-review-hint">Tap to edit</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stats line */}
      {counts.total > 0 && (
        <p className="ocr-count">
          {counts.total} word{counts.total !== 1 ? 's' : ''}
          {counts.needsReview > 0 && (
            <span className="ocr-count-warn">
              {' · '}{counts.needsReview} need{counts.needsReview === 1 ? 's' : ''} a check
            </span>
          )}
        </p>
      )}

      {/* Action bar */}
      <div className="ocr-actions">
        <button className="ocr-back-btn" onClick={onBack} type="button">
          ← Try Another File
        </button>
        <button
          className={`ocr-confirm-btn${!canConfirm ? ' ocr-confirm-btn--disabled' : ''}`}
          onClick={handleConfirm}
          disabled={!canConfirm}
          type="button"
        >
          Use These Words ▶
        </button>
      </div>
    </div>
  );
}
