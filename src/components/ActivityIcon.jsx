import React from 'react';

// Simple line-art icons for each activity, drawn to match the retro 90s
// pastel aesthetic used in the split-layout hub. Stroke uses currentColor so
// the icon inherits whatever colour the wrapping element sets.

const STROKE = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };

export default function ActivityIcon({ id, size = 32, ...rest }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    stroke: 'currentColor', ...STROKE, ...rest,
  };
  switch (id) {
    case 'wordsearch':
      return (
        <svg {...props} aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" />
          <line x1="15" y1="15" x2="20" y2="20" />
        </svg>
      );
    case 'memoryspell':
      return (
        <svg {...props} aria-hidden="true">
          <rect x="6.5" y="3.5" width="11" height="14" rx="1" />
          <rect x="3.5" y="6.5" width="11" height="14" rx="1" />
        </svg>
      );
    case 'hangman':
      return (
        <svg {...props} aria-hidden="true">
          <rect x="2.5" y="8.5"  width="6" height="7" />
          <rect x="9"   y="8.5"  width="6" height="7" />
          <rect x="15.5" y="8.5" width="6" height="7" />
          <line x1="11.5" y1="12" x2="13.5" y2="12" />
        </svg>
      );
    case 'syllabletap':
      return (
        <svg {...props} aria-hidden="true">
          <path d="M3 10v4h3l5 4V6L6 10H3z" />
          <path d="M14 8c2 1.5 2 6.5 0 8" />
          <path d="M17 5c4 2 4 12 0 14" />
        </svg>
      );
    case 'writeit':
      return (
        <svg {...props} aria-hidden="true">
          <path d="M3.5 20.5l3-1 12-12-2-2-12 12-1 3z" />
          <line x1="14.5" y1="5.5" x2="18.5" y2="9.5" />
        </svg>
      );
    case 'weakspot':
      return (
        <svg {...props} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'crossword':
      return (
        <svg {...props} aria-hidden="true">
          <rect x="2.5" y="2.5" width="19" height="19" />
          <line x1="9"   y1="2.5" x2="9"   y2="21.5" />
          <line x1="15"  y1="2.5" x2="15"  y2="21.5" />
          <line x1="2.5" y1="9"   x2="21.5" y2="9" />
          <line x1="2.5" y1="15"  x2="21.5" y2="15" />
        </svg>
      );
    case 'quizquest':
      return (
        <svg {...props} aria-hidden="true">
          <path d="M6 3.5h12v3.5a6 6 0 01-12 0V3.5z" />
          <path d="M3 5.5h3M18 5.5h3" />
          <line x1="12" y1="13" x2="12" y2="17.5" />
          <rect x="8" y="17.5" width="8" height="3" />
        </svg>
      );
    case 'wordforge':
      return (
        <svg {...props} aria-hidden="true">
          <rect x="2.5" y="2.5"   width="8" height="8" />
          <rect x="13.5" y="13.5" width="8" height="8" />
          <line x1="10.5" y1="6.5"  x2="15"   y2="6.5" />
          <line x1="6.5"  y1="10.5" x2="6.5"  y2="15" />
          <line x1="17.5" y1="13.5" x2="17.5" y2="11" />
          <line x1="13.5" y1="17.5" x2="11"   y2="17.5" />
        </svg>
      );
    default:
      return null;
  }
}
