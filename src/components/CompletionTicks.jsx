import React from 'react';

const TICK_MAX = 3;

export default function CompletionTicks({ count = 0, max = TICK_MAX }) {
  const filled = Math.max(0, Math.min(count, max));
  return (
    <span
      className="hub-card-ticks"
      aria-label={`${filled} of ${max} completions`}
      title={`${filled} of ${max} completions`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`hub-card-tick hub-card-tick--${i < filled ? 'on' : 'off'}`}
          aria-hidden="true"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 12.5L10 17.5L19 7.5"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ))}
    </span>
  );
}
