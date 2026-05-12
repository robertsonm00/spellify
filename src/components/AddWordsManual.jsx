import React, { useState } from 'react';
import './AddWordsManual.css';
import FileUpload from './FileUpload';

const WORD_COLORS = [
  { bg: '#fff0f0', border: '#ff6b6b' },
  { bg: '#fff8e1', border: '#ffd93d' },
  { bg: '#f0fff4', border: '#6bcb77' },
  { bg: '#e8f4ff', border: '#4d96ff' },
  { bg: '#f5f0ff', border: '#c77dff' },
  { bg: '#fff4ec', border: '#ff9f43' },
  { bg: '#f0ffff', border: '#00d2d3' },
  { bg: '#fff0f8', border: '#ff6b9d' },
];

function AddWordsManual({ onWordsReady, collectTestDate = false }) {
  // Optional "Spelling test date" — only surfaced for list-creation flows
  // (Explore Dashboard new-list manual entry). Edit-existing flows pass
  // collectTestDate={false} so the field stays hidden.
  const [testDate, setTestDate] = useState('');
  const todayIso = new Date().toISOString().slice(0, 10);
  const [input,       setInput]       = useState('');
  const [words,       setWords]       = useState([]);
  const [toast,       setToast]       = useState(null);
  const [showUpload,  setShowUpload]  = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const commitWord = () => {
    const w = input.trim().toLowerCase().replace(/[^a-z'-]/g, '');
    if (!w) return;
    if (words.includes(w)) { showToast(`"${w}" is already in your list`); setInput(''); return; }
    if (words.length >= 30) { showToast('Maximum 30 words reached'); return; }
    setWords((prev) => [...prev, w]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitWord(); }
  };

  const removeWord = (idx) => setWords((prev) => prev.filter((_, i) => i !== idx));

  // Called by FileUpload once the user picks their words
  const handleFileWordsConfirmed = (extracted) => {
    const merged = [...new Set([...words, ...extracted])].slice(0, 30);
    setWords(merged);
    setShowUpload(false);
    showToast(`Added words from file! ${merged.length} total.`);
  };

  // ── File upload view ──────────────────────────────────────────────────────
  if (showUpload) {
    return (
      <div className="aw-wrap">
        <FileUpload
          onWordsConfirmed={handleFileWordsConfirmed}
          onCancel={() => setShowUpload(false)}
        />
      </div>
    );
  }

  // ── Manual entry view ─────────────────────────────────────────────────────
  return (
    <div className="aw-wrap">
      {toast && <div className="aw-toast">{toast}</div>}

      {/* ── Input ── */}
      <div className="aw-input-row">
        <input
          className="aw-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a word and press Enter…"
          autoFocus
          maxLength={20}
        />
        <button
          className="aw-add-btn"
          onClick={commitWord}
          disabled={!input.trim()}
          aria-label="Add word"
        >
          +
        </button>
      </div>

      {/* ── Word cards ── */}
      {words.length > 0 && (
        <div className="aw-cards">
          {words.map((w, i) => {
            const { bg, border } = WORD_COLORS[i % WORD_COLORS.length];
            return (
              <div
                key={`${w}-${i}`}
                className="aw-card"
                style={{ background: bg, borderColor: border }}
              >
                <span className="aw-card-word">{w}</span>
                <button
                  className="aw-card-x"
                  onClick={() => removeWord(i)}
                  aria-label={`Remove ${w}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {words.length === 0 && (
        <p className="aw-empty">Your words will appear here as cards</p>
      )}

      {/* ── Upload / Photo ── */}
      <div className="aw-upload-row">
        <button
          className="aw-upload-btn"
          onClick={() => setShowUpload(true)}
          type="button"
        >
          <span>📁</span> Upload from File
        </button>
        {/* Camera: opens FileUpload which handles the camera input internally */}
        <button
          className="aw-upload-btn aw-camera-btn"
          onClick={() => setShowUpload(true)}
          type="button"
        >
          <span>📷</span> Take Photo
        </button>
      </div>

      {/* ── Optional test date (creation flow only) ── */}
      {collectTestDate && (
        <div className="aw-testdate">
          <label className="aw-testdate-label" htmlFor="aw-testdate-input">
            Spelling test date
          </label>
          <p className="aw-testdate-sub">When do you need to know these words by? (optional)</p>
          <input
            id="aw-testdate-input"
            type="date"
            className="aw-testdate-input"
            min={todayIso}
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
          />
        </div>
      )}

      {/* ── Done ── */}
      {words.length >= 3 && (
        <button
          className="aw-done-btn"
          onClick={() => onWordsReady(
            words,
            collectTestDate ? { testDate: testDate || null } : undefined,
          )}
        >
          Use These {words.length} Words ▶
        </button>
      )}
      {words.length > 0 && words.length < 3 && (
        <p className="aw-min-hint">Add {3 - words.length} more word{3 - words.length !== 1 ? 's' : ''} to continue</p>
      )}
    </div>
  );
}

export default AddWordsManual;
