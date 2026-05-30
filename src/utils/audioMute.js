// audioMute.js — Global "all sound off" preference.
//
// Every sound producer in the app (Web Speech voice-overs, per-game
// Web Audio chimes, future SFX) calls `isMuted()` before emitting.
// The footer mute toggle writes the preference here and dispatches a
// 'spellify-mute-change' window event so React surfaces can re-render.
//
// Default: false (sound enabled) — first-time visitors hear the app.
// Persists across reloads in localStorage.
//
// API:
//   isMuted()                 → boolean
//   setMuted(boolean)         → persist + broadcast
//   toggleMuted()             → flip + persist + broadcast
//   useMuted()  (React hook)  → live boolean, re-renders on change

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'spellify_muted';
const EVENT_NAME  = 'spellify-mute-change';

export function isMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setMuted(value) {
  const next = !!value;
  try { localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false'); } catch { /* ignore */ }
  // Stop anything currently speaking the moment we mute, so an in-flight
  // utterance doesn't keep talking after the toggle flips.
  if (next && typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { muted: next } }));
  } catch { /* SSR / non-browser */ }
}

export function toggleMuted() {
  setMuted(!isMuted());
}

/** React hook — returns the current mute state, re-renders on change. */
export function useMuted() {
  const [muted, set] = useState(() => isMuted());
  useEffect(() => {
    const onChange = (e) => set(!!e.detail?.muted);
    window.addEventListener(EVENT_NAME, onChange);
    // Pick up cross-tab changes via the storage event too.
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) set(isMuted());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return muted;
}
