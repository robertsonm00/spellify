import React from 'react';

// Standard progress strip — fixed to the very top of the viewport so it's
// always visible, even as the game content scrolls beneath it.
// Renders a zero-height spacer in the document flow so the layout below
// stays in the right place (nothing jumps up to fill the gap).
//
//   <GameProgressStrip percent={50}>5 of 10 words found</GameProgressStrip>
// Progress strip is hidden across all games for now. The component is kept
// as a no-op (instead of editing every callsite) so it can be reinstated by
// restoring the body below.
export default function GameProgressStrip(/* { percent = 0, children } */) {
  return null;
  // --- Original implementation (kept for easy revert) ---
  // const clamped = Math.max(0, Math.min(100, percent));
  // return (
  //   <>
  //     <div className="game-progress-strip game-progress-strip--fixed">
  //       <div className="game-progress-fill" style={{ width: `${clamped}%` }} />
  //       <span className="game-progress-label">{children}</span>
  //     </div>
  //     <div className="game-progress-strip-spacer" aria-hidden="true" />
  //   </>
  // );
}
