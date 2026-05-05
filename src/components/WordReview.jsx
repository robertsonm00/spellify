import React, { useState, useRef, useEffect, useCallback } from 'react';
import './WordReview.css';

const MAX_WORDS = 30;

const CHIP_COLORS = [
  { bg: '#fff0f6', border: '#f9a8d4', text: '#9d174d' },
  { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  { bg: '#f0fdf4', border: '#86efac', text: '#14532d' },
  { bg: '#fffbeb', border: '#fcd34d', text: '#78350f' },
  { bg: '#faf5ff', border: '#d8b4fe', text: '#6b21a8' },
  { bg: '#fff7ed', border: '#fdba74', text: '#9a3412' },
];

function sanitize(str) {
  return str.replace(/[^a-zA-Z'-]/g, '').toLowerCase().trim();
}

export default function WordReview({ initialWords, onConfirm, onBack }) {
  const uid  = useRef(0);
  const mkId = () => { uid.current += 1; return uid.current; };

  const [items, setItems] = useState(() =>
    initialWords.slice(0, MAX_WORDS).map((w) => ({ id: mkId(), word: w }))
  );
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showAdd,   setShowAdd]   = useState(false);
  const [addValue,  setAddValue]  = useState('');

  const editInputRef = useRef(null);
  const addInputRef  = useRef(null);

  // Focus the edit input whenever we enter edit mode
  useEffect(() => {
    if (editingId !== null) editInputRef.current?.select();
  }, [editingId]);

  // Focus the add input whenever it opens
  useEffect(() => {
    if (showAdd) addInputRef.current?.focus();
  }, [showAdd]);

  // ── Edit handlers ──────────────────────────────────────────────────────────

  const startEdit = (id, word) => {
    // Close any open add-input first
    if (showAdd) { setShowAdd(false); setAddValue(''); }
    setEditingId(id);
    setEditValue(word);
  };

  const commitEdit = useCallback(() => {
    setItems((prev) => {
      const clean = sanitize(editValue);
      return prev.map((it) =>
        it.id === editingId
          ? { ...it, word: clean.length >= 2 ? clean : it.word }
          : it
      );
    });
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue]);

  const cancelEdit = () => { setEditingId(null); setEditValue(''); };

  const deleteItem = (id, e) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (editingId === id) cancelEdit();
  };

  // ── Add-word handlers ──────────────────────────────────────────────────────

  const openAdd = () => {
    // Commit any open edit before opening the add input
    if (editingId !== null) commitEdit();
    setShowAdd(true);
    setAddValue('');
  };

  const commitAdd = useCallback(() => {
    const clean = sanitize(addValue);
    if (clean.length >= 2) {
      setItems((prev) => {
        if (prev.length >= MAX_WORDS) return prev;
        return [...prev, { id: mkId(), word: clean }];
      });
    }
    setAddValue('');
    setShowAdd(false);
  }, [addValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelAdd = () => { setAddValue(''); setShowAdd(false); };

  // ── Confirm ────────────────────────────────────────────────────────────────

  const handleConfirm = () => {
    // Fold in any uncommitted edit / add synchronously without relying on
    // setState having flushed, so the user never loses their last keystroke.
    let finalItems = [...items];

    if (editingId !== null) {
      const clean = sanitize(editValue);
      finalItems = finalItems.map((it) =>
        it.id === editingId ? { ...it, word: clean.length >= 2 ? clean : it.word } : it
      );
    }

    if (showAdd) {
      const clean = sanitize(addValue);
      if (clean.length >= 2 && finalItems.length < MAX_WORDS) {
        finalItems = [...finalItems, { id: -1, word: clean }];
      }
    }

    const finalWords = finalItems
      .map((it) => it.word)
      .filter((w) => w.length >= 2)
      .slice(0, MAX_WORDS);

    if (finalWords.length < 1) return;
    onConfirm(finalWords);
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const count      = items.length;
  const canAdd     = count < MAX_WORDS && !showAdd;
  const canConfirm = count >= 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="wr-wrap">

      {/* Header */}
      <div className="wr-header">
        <span className="wr-header-icon">✏️</span>
        <div>
          <p className="wr-header-title">Check your words</p>
          <p className="wr-header-sub">Tap a word to edit · ✕ to remove · add any the scanner missed</p>
        </div>
      </div>

      {/* Chip grid */}
      <div className="wr-chip-area">
        {items.map((item, i) => {
          const color   = CHIP_COLORS[i % CHIP_COLORS.length];
          const editing = editingId === item.id;

          return (
            <div
              key={item.id}
              className={`wr-chip${editing ? ' wr-chip--editing' : ''}`}
              style={{
                '--wc-bg':     color.bg,
                '--wc-border': color.border,
                '--wc-text':   color.text,
              }}
            >
              {editing ? (
                <input
                  ref={editInputRef}
                  className="wr-chip-input"
                  value={editValue}
                  size={Math.max(editValue.length + 1, 3)}
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
                  className="wr-chip-text"
                  onClick={() => startEdit(item.id, item.word)}
                  title="Tap to edit"
                >
                  {item.word}
                </span>
              )}

              <button
                className="wr-chip-delete"
                onMouseDown={(e) => e.preventDefault()} // prevent blur before delete fires
                onClick={(e) => deleteItem(item.id, e)}
                type="button"
                tabIndex={-1}
                aria-label={`Remove ${item.word}`}
              >
                ✕
              </button>
            </div>
          );
        })}

        {/* Inline add-word input — appears as a chip */}
        {showAdd && (
          <div
            className="wr-chip wr-chip--adding"
            style={{ '--wc-bg': '#f0f9ff', '--wc-border': '#7dd3fc', '--wc-text': '#0369a1' }}
          >
            <input
              ref={addInputRef}
              className="wr-chip-input"
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
              className="wr-chip-delete"
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

        {/* + Add word pill */}
        {canAdd && (
          <button className="wr-add-btn" onClick={openAdd} type="button">
            + Add word
          </button>
        )}
      </div>

      {/* Live word count */}
      <p className={`wr-count${count === 0 ? ' wr-count--zero' : ''}`}>
        {count === 0
          ? 'No words yet — add some!'
          : `${count} word${count !== 1 ? 's' : ''} ready`}
      </p>

      {/* Action bar */}
      <div className="wr-actions">
        <button className="wr-back-btn" onClick={onBack} type="button">
          ← Try Another File
        </button>
        <button
          className={`wr-confirm-btn${!canConfirm ? ' wr-confirm-btn--disabled' : ''}`}
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
