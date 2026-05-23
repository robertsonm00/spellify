import React, { useState, useRef } from 'react';
import './CreateListModal.css';
import { isSafeWord, logBlockedAttempt } from '../../utils/contentFilter';

const MIN_WORDS = 3;
const MAX_WORDS = 50;
const UNSAFE_MESSAGE = "That word couldn't be added — try another";

export default function CreateListModal({ onClose, onSave, isGuest }) {
  const [listName, setListName]   = useState('');
  const [words,    setWords]      = useState([]);
  const [input,    setInput]      = useState('');
  const [error,    setError]      = useState('');
  const [saving,   setSaving]     = useState(false);
  const inputRef = useRef(null);

  const addWord = () => {
    const w = input.trim().replace(/[^a-zA-Z'-]/g, '');
    if (!w) return;
    if (!isSafeWord(w)) {
      logBlockedAttempt(w, 'custom-list');
      setError(UNSAFE_MESSAGE);
      setInput('');
      inputRef.current?.focus();
      return;
    }
    if (words.some(x => x.toLowerCase() === w.toLowerCase())) {
      setError(`"${w}" is already in your list.`); return;
    }
    if (words.length >= MAX_WORDS) {
      setError(`Maximum ${MAX_WORDS} words allowed.`); return;
    }
    setWords(prev => [...prev, w]);
    setInput('');
    setError('');
    inputRef.current?.focus();
  };

  const removeWord = (idx) => setWords(prev => prev.filter((_, i) => i !== idx));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addWord(); }
    if (e.key === 'Backspace' && !input && words.length > 0) {
      setWords(prev => prev.slice(0, -1));
    }
  };

  const handleSave = async () => {
    if (!listName.trim()) { setError('Please give your list a name.'); return; }
    if (words.length < MIN_WORDS) { setError(`Add at least ${MIN_WORDS} words to continue.`); return; }
    setSaving(true);
    await onSave({ name: listName.trim(), words: words.map(w => ({ word: w, definition: '' })) });
    setSaving(false);
    onClose();
  };

  return (
    <div className="clm-backdrop" onClick={onClose}>
      <div className="clm-wrap" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create list">
        <button className="clm-close" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="clm-heading">✏️ Create a Word List</h2>

        {isGuest && (
          <div className="clm-guest-notice">
            📌 This list will only be saved for this session — sign in to keep it forever!
          </div>
        )}

        {/* List name */}
        <label className="clm-label">List name</label>
        <input
          className="clm-name-input"
          type="text"
          placeholder="e.g. My tricky words"
          value={listName}
          onChange={e => setListName(e.target.value)}
          maxLength={60}
        />

        {/* Word entry */}
        <label className="clm-label">
          Add words <span className="clm-count">({words.length}/{MAX_WORDS})</span>
        </label>
        <div className="clm-chip-box" onClick={() => inputRef.current?.focus()}>
          {words.map((w, i) => (
            <span key={i} className="clm-chip">
              {w}
              <button
                className="clm-chip-remove"
                onClick={e => { e.stopPropagation(); removeWord(i); }}
                aria-label={`Remove ${w}`}
              >×</button>
            </span>
          ))}
          <input
            ref={inputRef}
            className="clm-word-input"
            type="text"
            placeholder={words.length === 0 ? 'Type a word and press Enter…' : ''}
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            disabled={words.length >= MAX_WORDS}
          />
        </div>
        <p className="clm-hint">Press Enter to add each word • Backspace to remove the last</p>

        {error && <p className="clm-error">{error}</p>}

        {words.length > 0 && words.length < MIN_WORDS && (
          <p className="clm-warning">Add {MIN_WORDS - words.length} more word{MIN_WORDS - words.length > 1 ? 's' : ''} to save</p>
        )}

        <div className="clm-actions">
          <button className="clm-btn clm-btn--cancel" onClick={onClose}>Cancel</button>
          <button
            className="clm-btn clm-btn--save"
            onClick={handleSave}
            disabled={saving || words.length < MIN_WORDS || !listName.trim()}
          >
            {saving ? 'Saving…' : `Save list (${words.length} words)`}
          </button>
        </div>
      </div>
    </div>
  );
}
