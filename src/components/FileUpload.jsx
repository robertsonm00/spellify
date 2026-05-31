import React, { useState, useRef, useCallback } from 'react';
import './FileUpload.css';
import { validateFile } from '../utils/fileValidator';
import { extractCandidatesFromImage, classifyTextWords } from '../utils/ocrExtract';
import { extractWordsFromPDF } from '../utils/pdfExtractor';
import { preprocessImageFile } from '../utils/imagePreprocess';
import { isSafeWord, logBlockedAttempt } from '../utils/contentFilter';
import ImageCropper from './ImageCropper';
import OcrReview   from './OcrReview';

const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const TEXT_TYPES  = new Set(['txt', 'csv']);

function getExt(file) {
  const parts = file.name.split('.');
  return (parts[parts.length - 1] || '').toLowerCase();
}

// ── Canvas crop helper (runs after the crop UI confirms) ──────────────────
function cropImageFile(file, { x, y, w, h }) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const sx = Math.round(x * img.naturalWidth);
      const sy = Math.round(y * img.naturalHeight);
      const sw = Math.max(Math.round(w * img.naturalWidth),  1);
      const sh = Math.max(Math.round(h * img.naturalHeight), 1);
      const canvas     = document.createElement('canvas');
      canvas.width     = sw;
      canvas.height    = sh;
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('toBlob returned null')); return; }
        resolve(new File([blob], 'cropped.png', { type: 'image/png' }));
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

// Strip non-letter junk from a raw text-file dump and return word tokens.
function tokenizeText(rawText, minLen = 2) {
  return rawText
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= minLen && t.length <= 20);
}

// ── states ─────────────────────────────────────────────────────────────────
const IDLE        = 'idle';
const VALIDATING  = 'validating';
const CROPPING    = 'cropping';
const PREPROCESS  = 'preprocess';   // “Scanning your list…”
const PROCESSING  = 'processing';   // OCR / PDF
const PREVIEW     = 'preview';
const NO_WORDS    = 'noWords';
const ERROR       = 'error';

export default function FileUpload({ onWordsConfirmed, onCancel }) {
  const [uiState,     setUiState]    = useState(IDLE);
  const [progress,    setProgress]   = useState(0);
  const [statusMsg,   setStatusMsg]  = useState('');
  const [errorMsg,    setErrorMsg]   = useState('');
  const [candidates,  setCandidates] = useState([]);
  const [isDragging,  setIsDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef   = useRef(null);

  // ── Run OCR / PDF / text extraction ──────────────────────────────────────
  const runExtraction = useCallback(async (file) => {
    const ext = getExt(file);
    let extracted = [];

    try {
      if (ext === 'pdf') {
        setUiState(PROCESSING);
        setStatusMsg('Reading your PDF…');
        setProgress(0);
        const words = await extractWordsFromPDF(file, setProgress);
        extracted = classifyTextWords(words);
      } else if (IMAGE_TYPES.has(ext)) {
        // Phase 1: preprocess (resize / greyscale / contrast / deskew).
        setUiState(PREPROCESS);
        setStatusMsg('Scanning your list…');
        setProgress(0);
        // Yield to the browser so the UI repaints before the synchronous
        // pixel work kicks off — otherwise the spinner doesn't appear on
        // older devices.
        await new Promise((r) => setTimeout(r, 30));
        const prepped = await preprocessImageFile(file, {
          deskew: true,
          contrast: 40,
          threshold: false,
        });

        // Phase 2: OCR.
        setUiState(PROCESSING);
        setStatusMsg('Reading the words…');
        extracted = await extractCandidatesFromImage(prepped, setProgress);
      } else if (TEXT_TYPES.has(ext)) {
        setUiState(PROCESSING);
        setStatusMsg('Reading your list…');
        const text = await file.text();
        const words = tokenizeText(text);
        extracted = classifyTextWords(words);
        setProgress(100);
      }
    } catch (err) {
      console.error('[FileUpload] Processing error:', err);
      setErrorMsg('Something went wrong reading the file. Please try again.');
      setUiState(ERROR);
      return;
    }

    if (!extracted || extracted.length === 0) {
      setUiState(NO_WORDS);
      return;
    }

    // Strip unsafe words before the user ever sees the OCR review pane.
    // Each dropped candidate is logged silently for later review.
    const safe = extracted.filter((c) => {
      const text = (c && typeof c === 'object') ? c.rawText : c;
      if (isSafeWord(text)) return true;
      logBlockedAttempt(text, 'ocr');
      return false;
    });

    if (safe.length === 0) {
      setUiState(NO_WORDS);
      return;
    }

    setCandidates(safe.slice(0, 60));
    setUiState(PREVIEW);
  }, []);

  // ── Validate then route ──────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    setUiState(VALIDATING);
    setProgress(0);
    setErrorMsg('');

    const { valid, reason } = await validateFile(file);
    if (!valid) {
      setErrorMsg(reason);
      setUiState(ERROR);
      return;
    }

    if (IMAGE_TYPES.has(getExt(file))) {
      setPendingFile(file);
      setUiState(CROPPING);
    } else {
      await runExtraction(file);
    }
  }, [runExtraction]);

  // ── Crop confirmed ───────────────────────────────────────────────────────
  const handleCropConfirm = useCallback(async (cropBox) => {
    const file = pendingFile;
    setPendingFile(null);
    setUiState(PREPROCESS);
    setStatusMsg('Scanning your list…');
    setProgress(0);
    try {
      const croppedFile = await cropImageFile(file, cropBox);
      await runExtraction(croppedFile);
    } catch (err) {
      console.error('[FileUpload] Crop error:', err);
      setErrorMsg('Could not crop the image. Please try again.');
      setUiState(ERROR);
    }
  }, [pendingFile, runExtraction]);

  // ── Drag & drop ──────────────────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  // ── File input ───────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ── Renders ──────────────────────────────────────────────────────────────

  if (uiState === CROPPING && pendingFile) {
    return (
      <div className="fu-wrap fu-wrap--crop">
        <ImageCropper
          imageFile={pendingFile}
          onConfirm={handleCropConfirm}
          onCancel={() => { setPendingFile(null); setUiState(IDLE); }}
        />
      </div>
    );
  }

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

        {/* WL-01: "Take Photo" (device camera capture) hidden for now —
            no working scan/OCR-from-camera path yet. On the post-QA
            roadmap; restore this button + the camera input then. */}

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.csv"
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

  if (uiState === PREPROCESS) {
    return (
      <div className="fu-wrap fu-wrap--center">
        <div className="fu-processing-icon">🔍</div>
        <p className="fu-processing-title">Scanning your list…</p>
        <p className="fu-processing-sub">Tidying up your photo so we can read it.</p>
      </div>
    );
  }

  if (uiState === PROCESSING) {
    return (
      <div className="fu-wrap fu-wrap--center">
        <div className="fu-processing-icon">⚙️</div>
        <p className="fu-processing-title">{statusMsg || 'Reading your file…'}</p>
        <div className="fu-progress-track">
          <div className="fu-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="fu-progress-label">{progress}%</p>
      </div>
    );
  }

  if (uiState === NO_WORDS) {
    return (
      <div className="fu-wrap fu-wrap--center">
        <div className="fu-error-icon">🔎</div>
        <p className="fu-error-title">No reliable words found</p>
        <p className="fu-error-msg">
          Try cropping the photo to just the word column, take a brighter
          shot, or type your words in by hand.
        </p>
        <button className="fu-retry-btn" onClick={() => setUiState(IDLE)} type="button">
          Try Again
        </button>
        <button className="fu-cancel-link" onClick={onCancel} type="button">
          ← Type words instead
        </button>
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

  // PREVIEW — review classified candidates before anything is added to
  // the app's word list. Confirmed words are the single source of truth.
  if (uiState === PREVIEW) {
    return (
      <div className="fu-wrap">
        <OcrReview
          candidates={candidates}
          onConfirm={(finalWords) => onWordsConfirmed(finalWords)}
          onBack={() => { setCandidates([]); setUiState(IDLE); }}
        />
      </div>
    );
  }

  return null;
}
