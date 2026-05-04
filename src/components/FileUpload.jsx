import React, { useState, useRef, useCallback } from 'react';
import './FileUpload.css';
import { validateFile } from '../utils/fileValidator';
import { ocrImageFile } from '../utils/ocrEngine';
import { extractWordsFromPDF } from '../utils/pdfExtractor';

const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const TEXT_TYPES  = new Set(['txt', 'csv']);

const WORD_COLORS = [
  { bg: '#fff0f6', border: '#f9a8d4', text: '#9d174d' },
  { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  { bg: '#f0fdf4', border: '#86efac', text: '#14532d' },
  { bg: '#fffbeb', border: '#fcd34d', text: '#78350f' },
  { bg: '#faf5ff', border: '#d8b4fe', text: '#6b21a8' },
  { bg: '#fff7ed', border: '#fdba74', text: '#9a3412' },
];

function getExt(file) {
  const parts = file.name.split('.');
  return (parts[parts.length - 1] || '').toLowerCase();
}

// ── states ─────────────────────────────────────────────────────────────────
const IDLE        = 'idle';
const VALIDATING  = 'validating';
const PROCESSING  = 'processing';
const PREVIEW     = 'preview';
const ERROR       = 'error';

export default function FileUpload({ onWordsConfirmed, onCancel }) {
  const [uiState,    setUiState]    = useState(IDLE);
  const [progress,   setProgress]   = useState(0);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [words,      setWords]      = useState([]);       // extracted words
  const [selected,   setSelected]   = useState(new Set()); // which are checked
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // ── core process ─────────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    setUiState(VALIDATING);
    setProgress(0);
    setErrorMsg('');

    // 1. Validate
    const { valid, reason } = await validateFile(file);
    if (!valid) {
      setErrorMsg(reason);
      setUiState(ERROR);
      return;
    }

    setUiState(PROCESSING);
    const ext = getExt(file);
    let extracted = [];

    try {
      if (ext === 'pdf') {
        extracted = await extractWordsFromPDF(file, setProgress);
      } else if (IMAGE_TYPES.has(ext)) {
        extracted = await ocrImageFile(file, setProgress);
      } else if (TEXT_TYPES.has(ext)) {
        // Plain text: read directly
        const text = await file.text();
        // Replace commas/semicolons with spaces then parse
        const cleaned = text.replace(/[,;|]/g, ' ');
        const { parseWordsFromText } = await import('../utils/ocrEngine');
        extracted = parseWordsFromText(cleaned);
        setProgress(100);
      }
    } catch (err) {
      console.error('[FileUpload] Processing error:', err);
      setErrorMsg('Something went wrong reading the file. Please try again.');
      setUiState(ERROR);
      return;
    }

    if (extracted.length === 0) {
      setErrorMsg('No words could be found in this file. Try a different file.');
      setUiState(ERROR);
      return;
    }

    // Pre-select all words (up to 30)
    const limited = extracted.slice(0, 60);
    setWords(limited);
    setSelected(new Set(limited.slice(0, 30)));
    setUiState(PREVIEW);
  }, []);

  // ── drag & drop ──────────────────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  // ── file input ───────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ── preview toggles ──────────────────────────────────────────────────────
  const toggleWord = (word) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        if (next.size >= 30) return prev; // max 30
        next.add(word);
      }
      return next;
    });
  };

  const selectAll   = () => setSelected(new Set(words.slice(0, 30)));
  const deselectAll = () => setSelected(new Set());

  const handleConfirm = () => {
    const chosen = [...selected];
    if (chosen.length < 1) return;
    onWordsConfirmed(chosen);
  };

  // ── renders ───────────────────────────────────────────────────────────────

  if (uiState === IDLE || uiState === VALIDATING) {
    return (
      <div className="fu-wrap">
        <div
          className={`fu-dropzone${isDragging ? ' fu-dropzone--over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          aria-label="Upload file"
        >
          <div className="fu-dropzone-icon">📁</div>
          <p className="fu-dropzone-title">Drop a file here</p>
          <p className="fu-dropzone-sub">or click to browse</p>
          <p className="fu-dropzone-types">JPG · PNG · PDF · TXT · CSV — max 5 MB</p>
        </div>

        {/* Camera button */}
        <button
          className="fu-camera-btn"
          onClick={() => cameraInputRef.current?.click()}
          type="button"
        >
          📷 Take Photo
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.csv"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {uiState === VALIDATING && (
          <p className="fu-status-msg">Checking file…</p>
        )}

        <button className="fu-cancel-link" onClick={onCancel} type="button">
          ← Back
        </button>
      </div>
    );
  }

  if (uiState === PROCESSING) {
    return (
      <div className="fu-wrap fu-wrap--center">
        <div className="fu-processing-icon">⚙️</div>
        <p className="fu-processing-title">Reading your file…</p>
        <div className="fu-progress-track">
          <div className="fu-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="fu-progress-label">{progress}%</p>
      </div>
    );
  }

  if (uiState === ERROR) {
    return (
      <div className="fu-wrap fu-wrap--center">
        <div className="fu-error-icon">⚠️</div>
        <p className="fu-error-title">Oops!</p>
        <p className="fu-error-msg">{errorMsg}</p>
        <button className="fu-retry-btn" onClick={() => setUiState(IDLE)} type="button">
          Try Again
        </button>
        <button className="fu-cancel-link" onClick={onCancel} type="button">
          ← Back
        </button>
      </div>
    );
  }

  // PREVIEW state
  const selectedCount = selected.size;
  return (
    <div className="fu-wrap">
      <div className="fu-preview-header">
        <p className="fu-preview-title">
          Found <strong>{words.length}</strong> words — pick up to 30
        </p>
        <div className="fu-preview-actions">
          <button className="fu-sel-btn" onClick={selectAll}   type="button">Select 30</button>
          <button className="fu-sel-btn" onClick={deselectAll} type="button">Clear</button>
        </div>
      </div>

      <div className="fu-word-grid">
        {words.map((word, i) => {
          const color = WORD_COLORS[i % WORD_COLORS.length];
          const active = selected.has(word);
          return (
            <button
              key={word}
              className={`fu-word-chip${active ? ' fu-word-chip--active' : ''}`}
              style={{
                '--chip-bg':     active ? color.bg     : '#f5f5f5',
                '--chip-border': active ? color.border : '#ddd',
                '--chip-text':   active ? color.text   : '#aaa',
              }}
              onClick={() => toggleWord(word)}
              type="button"
              disabled={!active && selectedCount >= 30}
              title={active ? 'Click to deselect' : selectedCount >= 30 ? 'Max 30 reached' : 'Click to select'}
            >
              {active ? '✓ ' : ''}{word}
            </button>
          );
        })}
      </div>

      <div className="fu-confirm-row">
        <button
          className="fu-cancel-link"
          onClick={() => setUiState(IDLE)}
          type="button"
        >
          ← Try Another File
        </button>
        <button
          className={`fu-confirm-btn${selectedCount < 1 ? ' fu-confirm-btn--disabled' : ''}`}
          onClick={handleConfirm}
          disabled={selectedCount < 1}
          type="button"
        >
          Use {selectedCount} Word{selectedCount !== 1 ? 's' : ''} ▶
        </button>
      </div>
    </div>
  );
}
