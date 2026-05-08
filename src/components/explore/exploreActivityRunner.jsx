// Shared launcher for activities inside the Explore section.
//
// Explore lists don't have a full session object, so we build a
// pseudo-session that satisfies the registry's buildProps contract
// (e.g. Crossword needs userAge, Hangman needs difficulty). All three
// ListHub variants (ListHub, ListHubV2, ListHubV3) call this so they
// stay aligned with the canonical activity registry from
// src/data/activities.js.
//
// If a new game is added to the registry, every Explore list picks
// it up automatically.

import React from 'react';
import { getActivity } from '../../data/activities';
import { isActivityAvailable } from '../../utils/activityAvailability';

/**
 * Build a pseudo-session from an Explore list. Used by buildProps()
 * functions on registry entries (e.g. Crossword reads .age).
 */
function buildPseudoSession({ list, words }) {
  const age = list?.ageRange?.[0] ?? 8;
  return {
    year: list?.year ?? null,
    age,
    words,
    wordObjects: (list?.words || []).map((w) => {
      const word = typeof w === 'string' ? w : w.word;
      return { word, year: list?.year ?? 3, difficulty: 'medium' };
    }),
    sourceMode: 'curriculum',
    dyslexiaMode: false,
    difficulty: 'medium',
    childName: '',
    activityStatuses: {},     // Explore tracks progress per-list, not per-session
    mastery: {},
    reviewQueue: [],
    ruleKey: null,
    ruleLabel: null,
  };
}

/**
 * Render the active activity component for an Explore list, or null
 * if the activity id is unknown / unavailable.
 *
 * @param {string} activityId  registry id, e.g. 'wordsearch'
 * @param {{ list, words, user, onComplete, onExit }} ctx
 * @returns {React.ReactElement|null}
 */
export function renderExploreActivity(activityId, { list, words, user, onComplete, onExit }) {
  const activity = getActivity(activityId);
  if (!activity) return null;

  const session = buildPseudoSession({ list, words });
  if (!isActivityAvailable(activity, { session, user })) return null;

  const Component  = activity.component;
  const extraProps = activity.buildProps ? activity.buildProps(session) : {};

  return (
    <Component
      words={words}
      dyslexiaMode={false}
      onComplete={(results) => onComplete(activityId, results || [])}
      onExit={onExit}
      {...extraProps}
    />
  );
}
