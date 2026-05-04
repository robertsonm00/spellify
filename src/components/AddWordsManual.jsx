import React, { useState, useRef } from 'react';
import './AddWordsManual.css';

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

function AddWordsManual({ onWordsReady }) {
  const [input, setInput]   = useState('');
  const [words, setWords]   = useState([]);
  const [toast, setToast]   = useState(null);
  const fileRef             = useRef(null);

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

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.name.endsWith('.pdf')) {
      showToast('PDF upload coming soon — use TXT or CSV for now');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = ev.target.result
        .split(/[\n,;\t]+/)
        .map((w) => w.trim().toLowerCase().replace(/[^a-z'-]/g, ''))
        .filter((w) => w.length >= 2 && w.length <= 20);
      const unique = [...new Set([...words, ...parsed])].slice(0, 30);
      setWords(unique);
      showToast(`Added ${unique.length - words.length} words from file`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePhoto = () => {
    showToast('📷 Photo OCR coming soon! Type words manually for now.');
  };

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
        <label className="aw-upload-btn">
          <span>📁</span> Upload from File
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
        <button className="aw-upload-btn aw-camera-btn" onClick={handlePhoto}>
          <span>📷</span> Take Photo
        </button>
      </div>

      {/* ── Done ── */}
      {words.length >= 3 && (
        <button className="aw-done-btn" onClick={() => onWordsReady(words)}>
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
