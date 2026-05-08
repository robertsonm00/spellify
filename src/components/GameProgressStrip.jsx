import React from 'react';

// Standard progress strip rendered just under the GameHeader.
//   <GameProgressStrip percent={50}>5 of 10 words found</GameProgressStrip>
export default function GameProgressStrip({ percent = 0, children }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="game-progress-strip">
      <div className="game-progress-fill" style={{ width: `${clamped}%` }} />
      <span className="game-progress-label">{children}</span>
    </div>
  );
}
