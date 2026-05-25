/**
 * ExploreDashboard — experimental Explore variant with a fixed left-hand
 * dashboard sidebar. The sidebar contains:
 *
 *   • Player card (always open)
 *   • Nav tabs: Home / My lists / Explore / Favourites / Recently viewed
 *   • Footer: Profile + Settings (icon-only retro buttons) + Sign in
 *
 * Each nav tab swaps the right pane. Home shows the original Explore Home
 * (Assignments + Curriculum + Your Lists). The other tabs are dedicated
 * pages that show only their own list type.
 *
 * Favourites and Recently-viewed are stored in localStorage so they persist
 * across sessions even for guests.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { YEAR_GROUPS, getListsForYear, curriculumLists, getEnrichedLesson } from '../../data/curriculumLists';
import { useCustomLists } from '../../hooks/useCustomLists';
import { useProgress }    from '../../hooks/useProgress';
import { ACTIVITIES }     from '../../data/activities';
import {
  getMasteryState,
  getStrugglingWordsAcrossLists,
  recordWordResult,
} from '../../utils/masteryEngine';
import ListHub            from './ListHub';
import SignInModal        from './SignInModal';
import { HubPlayerCard }  from '../WordListHub';
import { GeneratedWords } from '../OnboardingFlow';
import { getStreak, getWeekView } from '../../utils/streakEngine';
import AddWordsManual     from '../AddWordsManual';
import PracticeWriteIt    from '../PracticeWriteIt';
import '../PracticeWriteIt.css';
import '../WordListHub.css';
import './ExplorePage.css';
import './ExploreDashboard.css';

const CATEGORY_COLOURS = {
  'Statutory':   '#6b7280',
  'Phonics':     '#a855f7',
  'Patterns':    '#1D9E75',
  'Etymology':   '#EF9F27',
  'Vowels':      '#f97316',
  'Sight words': '#22c55e',
  'Custom':      '#4d96ff',
};
const CATEGORY_DARK = {
  'Statutory':   '#374151',
  'Phonics':     '#7c3aed',
  'Patterns':    '#0f6b50',
  'Etymology':   '#b45309',
  'Vowels':      '#c2410c',
  'Sight words': '#15803d',
  'Custom':      '#1a5cbf',
};

const FAV_KEY    = 'spellify_explore_favourites';
const RECENT_KEY = 'spellify_explore_recent';
const RECENT_MAX = 12;
// LocalStorage key for the dismissible "extra support" banner shown on
// the Explore page to children whose spelling confidence is 'tricky'
// or 'often-tricky'. Once dismissed, it never returns.
const EXPLORE_SUPPORT_BANNER_KEY = 'spellify_explore_banner_dismissed';

// Confidence-aware sort weight for difficulty labels — lower comes first.
// For 'often-tricky' / 'tricky' children we surface easier content first
// (easy → medium → hard); for 'easy' or unset we leave the curriculum in
// its natural order. Lists without an explicit difficulty fall in the
// middle so they don't sink to the bottom of the page.
const DIFFICULTY_WEIGHT = { easy: 0, medium: 1, hard: 2 };
function diffWeight(list) {
  const d = (list?.difficulty || '').toLowerCase();
  return d in DIFFICULTY_WEIGHT ? DIFFICULTY_WEIGHT[d] : 1.5;
}

// Strand pills — colours mirror the existing CATEGORY_COLOURS map so an
// active strand button visually echoes the ListCard it filters to.
const STRAND_PILLS = [
  { value: 'phonics',    label: 'Phonics',    color: '#a855f7', dark: '#7c3aed' },
  { value: 'patterns',   label: 'Patterns',   color: '#1D9E75', dark: '#0f6b50' },
  { value: 'morphology', label: 'Morphology', color: '#4d96ff', dark: '#1a5cbf' },
  { value: 'etymology',  label: 'Etymology',  color: '#EF9F27', dark: '#b45309' },
  { value: 'statutory',  label: 'Statutory',  color: '#6b7280', dark: '#374151' },
];

// Difficulty pills — traffic-light palette: green / amber / dark pink.
const DIFFICULTY_PILLS = [
  { value: 'easy',   label: 'Easy',   color: '#22c55e', dark: '#15803d' },
  { value: 'medium', label: 'Medium', color: '#f59e0b', dark: '#b45309' },
  { value: 'hard',   label: 'Hard',   color: '#be185d', dark: '#831843' },
];

function safeParse(raw, fallback) {
  try { return JSON.parse(raw) ?? fallback; } catch { return fallback; }
}

// ── List card with favourite star ────────────────────────────────────────────

// Traffic-light bucket from a 0..1 ratio. We deliberately use pink (not red)
// for the "starting" bucket — it stays warm and encouraging on a kids' card.
function trafficLight(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0)   return 'low';
  if (ratio >= 1)                              return 'high';
  if (ratio >= 0.66)                           return 'high';
  if (ratio >= 0.33)                           return 'mid';
  return 'low';
}

// Days until an ISO date string, calendar-wise (whole-day deltas, not 24h
// windows). Negative when the date is in the past. Returns null if the
// input isn't parseable.
function daysUntil(iso) {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const startOf = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOf(target) - startOf(new Date())) / 86400000);
}

// Long-form "Friday 23 May" style. Used in the hub headline.
function formatPrettyDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

// Child-friendly countdown sentence for the My Words hub. Returns:
//   { copy: string, tone: 'past'|'today'|'tomorrow'|'soon'|'this-week'|'future' }
// where the tone drives colour styling. Returns null when no date is set
// so callers can render nothing.
function testDateHeadline(testDate) {
  const days = daysUntil(testDate);
  if (days === null) return null;
  if (days < 0)  return { copy: `Your spelling test was on ${formatPrettyDate(testDate)}`, tone: 'past' };
  if (days === 0) return { copy: "Your spelling test is today — you've got this!", tone: 'today' };
  if (days === 1) return { copy: 'Your spelling test is tomorrow',           tone: 'tomorrow' };
  if (days <= 3)  return { copy: `Your spelling test is in ${days} days`,    tone: 'soon' };
  if (days <= 7)  return { copy: `Your spelling test is in ${days} days`,    tone: 'this-week' };
  return            { copy: `Your spelling test is on ${formatPrettyDate(testDate)}`, tone: 'future' };
}

// Pill content + colour bucket for the test-date display.
//   missing → muted grey ("No test date")
//   1 day   → alert (pink)         ← "in 1 day" / "Today"
//   2–4     → amber
//   5–7     → green
//   >7      → green (still ample time)
function testDatePill(testDate) {
  const days = daysUntil(testDate);
  if (days === null || days < 0) {
    return { label: 'No test date', tone: 'muted' };
  }
  if (days === 0) return { label: 'Test today',         tone: 'alert' };
  if (days === 1) return { label: 'Test in 1 day',      tone: 'alert' };
  if (days <= 4)  return { label: `Test in ${days} days`, tone: 'warn' };
  return            { label: `Test in ${days} days`, tone: 'ok'   };
}

// Inline test-date editor for the list header (custom lists only). Shows
// a child-friendly countdown headline when a date is set, or a low-key
// "+ Add test date" link when not. Clicking either opens an inline date
// picker; saving emits `onChange(iso|null)` so the parent can persist.
function TestDateLine({ testDate, onChange }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft]     = React.useState(testDate || '');
  const todayIso = new Date().toISOString().slice(0, 10);

  React.useEffect(() => { setDraft(testDate || ''); }, [testDate]);

  if (editing) {
    return (
      <div className="ed-testdate ed-testdate--editing">
        <input
          type="date"
          className="ed-testdate-input"
          min={todayIso}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <button
          type="button"
          className="ed-testdate-action ed-testdate-action--primary"
          onClick={() => { onChange(draft || null); setEditing(false); }}
        >Save</button>
        {testDate && (
          <button
            type="button"
            className="ed-testdate-action"
            onClick={() => { onChange(null); setEditing(false); }}
          >Clear</button>
        )}
        <button
          type="button"
          className="ed-testdate-action"
          onClick={() => { setDraft(testDate || ''); setEditing(false); }}
        >Cancel</button>
      </div>
    );
  }

  const headline = testDateHeadline(testDate);
  if (!headline) {
    return (
      <button type="button" className="ed-testdate-add" onClick={() => setEditing(true)}>
        + Add test date
      </button>
    );
  }
  return (
    <div className={`ed-testdate ed-testdate--${headline.tone}`}>
      <span className="ed-testdate-copy">{headline.copy}</span>
      <button
        type="button"
        className="ed-testdate-edit"
        onClick={() => setEditing(true)}
        aria-label="Edit test date"
        title="Edit test date"
      >✎</button>
    </div>
  );
}

// One icon + tint per category/strand so cards only differ by the word
// type they belong to. Falls back to a generic book + blue tint for any
// list whose strand/category isn't recognised (e.g. custom lists).
const CATEGORY_ICON = {
  phonics:     '🔤',
  patterns:    '🧩',
  morphology:  '🌱',
  etymology:   '📜',
  statutory:   '📚',
  vowels:      '🎵',
  'sight words': '👁',
  custom:      '⭐',
};
const CATEGORY_TINT = {
  phonics:     'purple',
  patterns:    'green',
  morphology:  'blue',
  etymology:   'amber',
  statutory:   'gray',
  vowels:      'amber',
  'sight words': 'green',
  custom:      'blue',
};
function categoryKey(list) {
  return (list.strand || list.category || '').toString().toLowerCase();
}

function ListCard({ list, listType = 'curriculum', index = 0, onClick, progress, isFavourite, onToggleFavourite }) {
  const colour     = CATEGORY_COLOURS[list.category] || '#6b7280';
  const darkColour = CATEGORY_DARK[list.category]    || '#374151';
  const words      = list.words || [];
  const wordStrings = words.map(w => (typeof w === 'string' ? w : w.word));
  const preview    = wordStrings.slice(0, 5).join(', ');
  const more       = Math.max(0, words.length - 5);

  // Word mastery — read straight from the engine for this list id.
  const mastery       = getMasteryState(list.id);
  const totalWords    = wordStrings.length;
  const masteredCount = wordStrings.reduce((n, w) => {
    return n + (mastery?.words?.[String(w).toLowerCase()]?.mastered ? 1 : 0);
  }, 0);
  const masteryRatio = totalWords > 0 ? masteredCount / totalWords : 0;
  const masteryLight = trafficLight(masteryRatio);

  // Games completed — count of activities marked complete in the per-list
  // progress map. We show the raw count (not "X of Y"); the colour bucket
  // is derived against the full activity registry so the traffic light
  // still has a sensible high-water mark.
  const completedActs = Object.values(progress || {}).filter(p => p?.status === 'completed').length;
  const gamesRatio    = ACTIVITIES.length > 0 ? completedActs / ACTIVITIES.length : 0;
  const gamesLight    = trafficLight(gamesRatio);

  const done   = masteryRatio >= 1 && completedActs === ACTIVITIES.length;
  const status = done ? 'completed' : (masteredCount > 0 || completedActs > 0) ? 'in-progress' : 'not-started';

  const rawDifficulty   = (list.difficulty || 'medium').toString().toLowerCase();
  const difficultyKey   = ['easy', 'medium', 'hard'].includes(rawDifficulty) ? rawDifficulty : 'medium';
  const difficultyLabel = difficultyKey.charAt(0).toUpperCase() + difficultyKey.slice(1);
  const catKey   = categoryKey(list);
  const cardIcon = CATEGORY_ICON[catKey] || '📖';
  const cardTint = CATEGORY_TINT[catKey] || 'blue';

  return (
    <div
      className={`ed-listcard ed-listcard--${cardTint} hub-card--${status}`}
      style={{ '--card-color': colour, '--card-dark': darkColour }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <div className="ed-listcard__icon" aria-hidden="true">{cardIcon}</div>

      <div className="ed-listcard__body">
        <h3 className="ed-listcard__title">{list.name}</h3>
        <p className="ed-listcard__preview">{preview}{more > 0 ? ` +${more} more` : ''}</p>
      </div>

      <div className="ed-listcard__meta">
        {/* Custom-list status badges (mastery + test-date) sit inline with
            the difficulty + heart so the card stays single-line tall. */}
        {masteredCount > 0 && (
          <span className={`hub-badge hub-badge--tl-${masteryLight} ed-listcard__meta-badge`}>
            {masteredCount}/{totalWords} mastered
          </span>
        )}
        {listType === 'custom' && (() => {
          const { label, tone } = testDatePill(list.testDate);
          return (
            <span className={`hub-badge hub-badge--td-${tone} ed-listcard__meta-badge`}>
              {label}
            </span>
          );
        })()}
        <span className={`ed-listcard__diff ed-listcard__diff--${difficultyKey}`}>
          {difficultyLabel}
        </span>
        <button
          className={`ed-listcard__fav${isFavourite ? ' ed-listcard__fav--on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavourite(list.id); }}
          aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={isFavourite}
          data-tooltip={isFavourite ? 'Remove from favourites' : 'Add to favourite list'}
        >
          <svg
            className="ed-listcard__fav-icon"
            viewBox="0 0 32 32"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M16 28.2c-1.6-1.1-13-7.9-13-16.3 0-3.7 2.7-6.8 6.3-6.8 2.6 0 4.7 1.3 6.7 3.5 2-2.2 4.1-3.5 6.7-3.5 3.6 0 6.3 3.1 6.3 6.8 0 8.4-11.4 15.2-13 16.3z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Add-list chooser modal ───────────────────────────────────────────────────

function AddListChooser({ isGuest, onPickRandom, onPickManual, onSignIn, onClose }) {
  return (
    <div className="ed-chooser-overlay" onClick={onClose}>
      <div className="ed-chooser" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Create a word list">
        <button className="ed-chooser-close" onClick={onClose} aria-label="Close">✕</button>
        <h2 className="ed-chooser-heading">Create a word list</h2>
        {isGuest && (
          <p className="ed-chooser-warn">
            You're not signed in — your list will be saved on this device only.
            {' '}<button className="ed-chooser-link" onClick={onSignIn}>Sign in to save permanently</button>.
          </p>
        )}
        <div className="ed-chooser-options">
          <button className="ed-chooser-option" onClick={onPickRandom}>
            <span className="ed-chooser-option-icon" aria-hidden="true">🎲</span>
            <span className="ed-chooser-option-title">Create a random list</span>
            <span className="ed-chooser-option-hint">Picks 8 words for your year</span>
          </button>
          <button className="ed-chooser-option" onClick={onPickManual}>
            <span className="ed-chooser-option-icon" aria-hidden="true">✍️</span>
            <span className="ed-chooser-option-title">Create my own list</span>
            <span className="ed-chooser-option-hint">Type your own words</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar nav link ─────────────────────────────────────────────────────────

function NavLink({ icon, label, count, active, onClick }) {
  return (
    <button
      className={`ed-nav-link${active ? ' ed-nav-link--active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <span className="ed-nav-icon" aria-hidden="true">{icon}</span>
      <span className="ed-nav-label">{label}</span>
      {typeof count === 'number' && <span className="ed-nav-count">{count}</span>}
    </button>
  );
}

// ── Explore filter bar (strand / difficulty pills) ──────────────────────────

// Pixel-arcade filter pill — every chip (strand AND difficulty) shares
// identical default, hover, and active styling so the UI doesn't lean on
// per-category colour to communicate filter state. Colour-coding lives
// only on the cards' icon orbs.
function StrandPill({ pill, on, onToggle }) {
  return (
    <button
      type="button"
      className={`ed-arcade-pill${on ? ' ed-arcade-pill--on' : ''}`}
      onClick={() => onToggle(on ? 'all' : pill.value)}
      aria-pressed={on}
    >
      {pill.label}
    </button>
  );
}

function DifficultyPill({ pill, on, onToggle }) {
  return (
    <button
      type="button"
      className={`ed-arcade-pill${on ? ' ed-arcade-pill--on' : ''}`}
      onClick={() => onToggle(on ? 'all' : pill.value)}
      aria-pressed={on}
    >
      {pill.label}
    </button>
  );
}

// Lean filter row shared across My Lists / Assignments / Favourites / Recent.
// Mirrors the structure of ExploreFilters (just the toggle + the count) so
// every dashboard page lines up.
function FilterRow({
  hideCompleted,
  onHideCompletedChange,
  resultCount,
  noun = 'list',
  sortOrder,
  onSortOrderChange,
}) {
  return (
    <div className="ed-filters">
      <div className="ed-filters-row" role="group" aria-label="Filter lists">
        <HideCompletedToggle on={hideCompleted} onChange={onHideCompletedChange} />
        {onSortOrderChange && (
          <label className="ed-sort">
            <span className="ed-sort-label">Sort by</span>
            <select
              className="ed-sort-select"
              value={sortOrder}
              onChange={(e) => onSortOrderChange(e.target.value)}
            >
              <option value="newest">Newest to oldest</option>
              <option value="oldest">Oldest to newest</option>
            </select>
          </label>
        )}
      </div>
      {resultCount !== undefined && (
        <p className="ed-filters-count" aria-live="polite">
          {resultCount} {resultCount === 1 ? noun : `${noun}s`}
        </p>
      )}
    </div>
  );
}

// Shared "Hide completed" toggle — no pill background, no selected fill;
// just a label + a small track/thumb switch. The whole row is one button
// so clicking the words OR the switch toggles state.
function HideCompletedToggle({ on, onChange }) {
  return (
    <button
      type="button"
      className={`ed-toggle${on ? ' ed-toggle--on' : ''}`}
      onClick={() => onChange(!on)}
      aria-pressed={on}
      role="switch"
    >
      <span className="ed-toggle-track" aria-hidden="true">
        <span className="ed-toggle-thumb" />
      </span>
      <span className="ed-toggle-label">Hide completed</span>
    </button>
  );
}

function ExploreFilters({
  strand,
  onStrandChange,
  difficulty,
  onDifficultyChange,
  hideCompleted,
  onHideCompletedChange,
  resultCount,
  availableStrands,
  availableDifficulties,
}) {
  // Only render filter chips for strands/difficulties that have at least one
  // matching list in the current curriculum. Falls back to showing every chip
  // when the caller hasn't provided sets (defensive).
  const visibleStrands = availableStrands
    ? STRAND_PILLS.filter(p => availableStrands.has(p.value))
    : STRAND_PILLS;
  // Difficulty filter chips were removed — per-card Easy/Medium/Hard badges
  // still show, but the filter UI is gone. We keep the related props on the
  // function signature so callers don't break; they're simply not rendered.

  return (
    <div className="ed-filters">
      <div className="ed-filters-row" role="group" aria-label="Filter lessons">
        {visibleStrands.map(p => (
          <StrandPill
            key={p.value}
            pill={p}
            on={strand === p.value}
            onToggle={onStrandChange}
          />
        ))}
        {onHideCompletedChange && (
          <HideCompletedToggle
            on={hideCompleted}
            onChange={onHideCompletedChange}
          />
        )}
      </div>
      <p className="ed-filters-count" aria-live="polite">
        {resultCount} {resultCount === 1 ? 'lesson' : 'lessons'}
      </p>
    </div>
  );
}

// ── Section block for the right pane ─────────────────────────────────────────

function PaneSection({ headerClass, label, hint, rightSlot, children }) {
  return (
    <section className={`hub-phase ${headerClass}`}>
      <div className="hub-phase-header">
        <div className="hub-phase-text">
          <strong className="hub-phase-label">{label}</strong>
          {hint && <span className="hub-phase-hint">{hint}</span>}
        </div>
        {rightSlot && <div className="hub-phase-right">{rightSlot}</div>}
      </div>
      {children}
    </section>
  );
}

// Returns true when a list is fully mastered AND every activity has been
// completed at least once. Mirrors the `done` calculation inside ListCard
// so the page-level "hide completed" filter agrees with the card itself.
function isListCompleted(list, progress) {
  const words = list.words || [];
  const wordStrings = words.map(w => (typeof w === 'string' ? w : w.word));
  const totalWords = wordStrings.length;
  if (totalWords === 0) return false;
  const mastery = getMasteryState(list.id);
  const masteredCount = wordStrings.reduce(
    (n, w) => n + (mastery?.words?.[String(w).toLowerCase()]?.mastered ? 1 : 0),
    0,
  );
  if (masteredCount < totalWords) return false;
  const completedActs = Object.values(progress || {})
    .filter(p => p?.status === 'completed').length;
  return completedActs === ACTIVITIES.length;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ExploreDashboard({
  page: pageProp = null,
  navTick = 0,
  session = null,
  user,
  profile,
  signIn,
  signUp,
  signInWithGoogle,
  onOpenSettings,
  // Optional: parent can request a specific list be opened (e.g. the
  // Adventure Map taps a stop). When this changes to a non-null value,
  // we openList() it and call onPendingHandled to let parent clear.
  pendingOpenList = null,
  onPendingHandled = null,
  // Called when the user backs out of a list that was opened from an
  // external origin (e.g. the Adventure Map). The parent decides where
  // to send them. If omitted, back falls through to the default
  // behaviour (return to the explore list grid).
  onListExit = null,
}) {
  const [page,          setPage]          = useState(pageProp || 'home');   // 'home'|'assignments'|'mylists'|'explore'|'favourites'|'recent'

  // Sync the page state when the parent flips `pageProp` (top-nav tab click).
  // Internal setPage still works for transient navigation (e.g. opening a list).
  useEffect(() => {
    if (pageProp && pageProp !== page) setPage(pageProp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageProp]);
  const [selectedList,  setSelectedList]  = useState(null);     // when set, ListHub takes the right pane

  // Any top-nav tab click (even the same tab again) bumps navTick. When that
  // happens, drop out of the list-detail view and land on the requested page.
  const firstNavTick = useRef(true);
  useEffect(() => {
    if (firstNavTick.current) { firstNavTick.current = false; return; }
    setSelectedList(null);
  }, [navTick]);

  const [creator,       setCreator]       = useState(null);     // null | 'random' | 'manual' | 'edit'
  const [showChooser,   setShowChooser]   = useState(false);
  const [showSignIn,    setShowSignIn]    = useState(false);
  const [progressCache, setProgressCache] = useState({});

  const [favourites, setFavourites] = useState(() => safeParse(localStorage.getItem(FAV_KEY), []));
  const [recent,     setRecent]     = useState(() => safeParse(localStorage.getItem(RECENT_KEY), []));
  // Dismissible "extra support" banner on the Explore page. Shown to
  // children whose spelling confidence is 'tricky' or 'often-tricky'.
  // Persists the dismissal so the banner doesn't return on next visit.
  const [supportBannerDismissed, setSupportBannerDismissed] = useState(
    () => localStorage.getItem(EXPLORE_SUPPORT_BANNER_KEY) === 'true'
  );
  const dismissSupportBanner = () => {
    setSupportBannerDismissed(true);
    try { localStorage.setItem(EXPLORE_SUPPORT_BANNER_KEY, 'true'); } catch {}
  };

  // Streak snapshot — read once per render of the Alerts page. The
  // streakEngine writes a milestone event when crossed, so the App
  // shell already handles celebration; here we just need the data
  // for the Alerts surface itself.
  const streakSnapshot = useMemo(() => getStreak(), [page]);
  const streakWeek     = useMemo(() => getWeekView(), [page]);
  // Explore page filters — strand and difficulty pills, AND-combined.
  // 'all' means no filter on that axis.
  const [exploreStrand,     setExploreStrand]     = useState('all');
  const [exploreDifficulty, setExploreDifficulty] = useState('all');
  const [hideCompleted,     setHideCompleted]     = useState(false);
  // Sort order used by My Lists (and any other list-shaped page that opts in).
  // 'newest' = most recently created first.
  const [sortOrder,         setSortOrder]         = useState('newest');

  useEffect(() => { localStorage.setItem(FAV_KEY, JSON.stringify(favourites)); }, [favourites]);
  useEffect(() => { localStorage.setItem(RECENT_KEY, JSON.stringify(recent));     }, [recent]);

  const { lists: customLists, addList, updateList } = useCustomLists(user);
  const { getListProgress, markComplete } = useProgress(user);

  const selectedYear      = session?.year ?? 1;
  const curriculumForYear = getListsForYear(selectedYear);
  const yearGroup         = YEAR_GROUPS.find(g => g.year === selectedYear);
  const yearLabel         = yearGroup ? yearGroup.label : `Year ${selectedYear}`;

  // Normalise custom lists once so downstream code doesn't repeat the work.
  const normalisedCustom = useMemo(() => customLists.map(list => ({
    ...list,
    category: 'Custom',
    words: Array.isArray(list.words)
      ? list.words.map(w => (typeof w === 'string' ? { word: w, definition: '' } : w))
      : [],
  })), [customLists]);

  // Unified lookup so favourites/recent can resolve IDs from any year + custom.
  const listsById = useMemo(() => {
    const map = new Map();
    curriculumLists.forEach(l => map.set(l.id, { list: l, listType: 'curriculum' }));
    normalisedCustom.forEach(l => map.set(l.id, { list: l, listType: 'custom' }));
    return map;
  }, [normalisedCustom]);

  // ── Practice Quest ───────────────────────────────────────────────────
  // Three scopes per Layer 1 / 2 / 3 model:
  //
  //   Home    (Layer 3) → ALL lists: curriculum + custom + 'mywords'
  //                       (the synthetic listId used by App.jsx's My Words
  //                        session is included as { id: 'mywords',
  //                        name: 'Your Words' })
  //   MyLists (Layer 2) → custom lists only
  //   Explore (Layer 2) → curriculum-for-year only
  //
  // All three are computed up-front; renderPracticeQuestBanner(scope)
  // picks the right aggregate per page.
  const [practiceItems, setPracticeItems] = useState(null);
  const [practiceTick,  setPracticeTick]  = useState(0);
  const PRACTICE_QUEST_MAX = 5;

  const curriculumYearRefs = useMemo(
    () => curriculumForYear.map(l => ({ id: l.id, name: l.name || l.title || 'Curriculum list' })),
    [curriculumForYear],
  );
  const customListRefs = useMemo(
    () => normalisedCustom.map(l => ({ id: l.id, name: l.name || 'My list' })),
    [normalisedCustom],
  );
  // Home scope — everything we know about. `mywords` is the synthetic
  // list created by App.jsx for the post-onboarding session; it has no
  // list-card UI today but its mastery state is real, so we include it
  // here under a child-friendly label.
  const allListRefs = useMemo(
    () => [
      { id: 'mywords', name: 'Your Words' },
      ...curriculumYearRefs,
      ...customListRefs,
    ],
    [curriculumYearRefs, customListRefs],
  );

  // Build the three aggregates. practiceTick forces recomputation after
  // a session writes results back to localStorage.
  const buildAggregate = (refs) => getStrugglingWordsAcrossLists(refs);
  const homeAggregate = useMemo(
    () => buildAggregate(allListRefs),
    [allListRefs, practiceTick], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const myListsAggregate = useMemo(
    () => buildAggregate(customListRefs),
    [customListRefs, practiceTick], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const exploreAggregate = useMemo(
    () => buildAggregate(curriculumYearRefs),
    [curriculumYearRefs, practiceTick], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Practice Quest banner shows whenever a scope has ≥1 struggling word.
  // The 3-attempt minimum in masteryEngine (STRUGGLING_MIN_ATTEMPTS) is
  // sufficient protection against day-one false positives — no extra
  // mastered-word gate is needed.

  const launchPracticeQuestWith = (aggregate) => {
    const items = aggregate.slice(0, PRACTICE_QUEST_MAX).map(e => ({
      word:     e.word,
      listId:   e.listId,
      listName: e.listName,
    }));
    if (items.length === 0) return;
    setPracticeItems(items);
  };
  const handlePracticeComplete = (results) => {
    for (const r of results) {
      if (!r || !r.word || !r.listId) continue;
      const credit = r.correct ? (r.hintUsed ? 0.75 : 1.0) : 0;
      recordWordResult(r.listId, r.word, 'practicequest', credit);
    }
    setPracticeTick(t => t + 1);
  };

  const favouriteEntries = useMemo(
    () => favourites.map(id => listsById.get(id)).filter(Boolean),
    [favourites, listsById],
  );
  const recentEntries = useMemo(
    () => recent.map(id => listsById.get(id)).filter(Boolean),
    [recent, listsById],
  );

  useEffect(() => {
    const allIds = [
      ...curriculumForYear.map(l => l.id),
      ...normalisedCustom.map(l => l.id),
    ];
    allIds.forEach(async (id) => {
      if (!progressCache[id]) {
        const p = await getListProgress(id);
        setProgressCache(prev => ({ ...prev, [id]: p || {} }));
      }
    });
  }, [selectedYear, normalisedCustom.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFavourite = (listId) => {
    setFavourites(prev => prev.includes(listId) ? prev.filter(id => id !== listId) : [...prev, listId]);
  };

  const pushRecent = (listId) => {
    setRecent(prev => [listId, ...prev.filter(id => id !== listId)].slice(0, RECENT_MAX));
  };

  const openList = (list, listType, origin = 'internal') => {
    pushRecent(list.id);
    // Lazy-enrich curriculum lessons on open so the detail view has access to
    // the rich v13/v26 data. Custom lists pass through unchanged.
    const enriched = listType === 'curriculum'
      ? (getEnrichedLesson(list.id) || list)
      : list;
    // `origin` records where we came from — 'internal' means the user
    // landed on this list from inside ExploreDashboard (so back returns
    // to the list grid), 'map' means they entered from the Adventure
    // Map (so back returns to the map via `onListExit`).
    setSelectedList({ list: enriched, listType, origin });
    setListNameDraft(list.name);
  };

  // Parent-requested list open (e.g. tap a stop on the Adventure Map).
  // Runs once per non-null pendingOpenList value, then clears it so the
  // next request fires even for the same list id.
  useEffect(() => {
    if (!pendingOpenList) return;
    const listType = pendingOpenList.listType || 'curriculum';
    const origin   = pendingOpenList.origin   || 'map';
    openList(pendingOpenList.list || pendingOpenList, listType, origin);
    if (typeof onPendingHandled === 'function') onPendingHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpenList]);

  // ── Editable list name (custom lists only) ────────────────────────────
  const [listNameDraft, setListNameDraft] = useState('');

  const saveListName = async () => {
    if (!selectedList || selectedList.listType !== 'custom') return;
    const trimmed = listNameDraft.trim();
    if (!trimmed || trimmed === selectedList.list.name) {
      setListNameDraft(selectedList.list.name);
      return;
    }
    await updateList(selectedList.list.id, { name: trimmed });
    setSelectedList(prev => prev ? { ...prev, list: { ...prev.list, name: trimmed } } : null);
  };

  // Pretty-formatted date for the banner.
  const formatBannerDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  // Sidebar / dotted-card entry point: opens the chooser, which then routes
  // to one of the onboarding's existing list-creation screens.
  const startAddList = () => setShowChooser(true);

  // Single create-list handler — same path for random + manual.
  // Names progress as "My word list 1", "My word list 2", ... — we scan the
  // existing custom lists for the next free index so reused/renamed lists
  // don't create collisions. The creation date lives separately in the
  // banner so the title stays clean.
  const nextCustomListName = () => {
    const used = new Set();
    customLists.forEach((l) => {
      const m = (l?.name || '').match(/^My word list (\d+)$/i);
      if (m) used.add(parseInt(m[1], 10));
    });
    let n = 1;
    while (used.has(n)) n += 1;
    return `My word list ${n}`;
  };

  const handleCreate = async ({ words, testDate = null }) => {
    if (!words || words.length === 0) return;
    const { list } = await addList({ name: nextCustomListName(), words, testDate });
    setCreator(null);
    if (list) {
      const normalised = {
        ...list,
        category: 'Custom',
        words: Array.isArray(list.words)
          ? list.words.map(w => (typeof w === 'string' ? { word: w, definition: '' } : w))
          : [],
      };
      openList(normalised, 'custom');
    }
  };

  // "Edit list" replaces the words of the currently-open custom list, then
  // stays on the activity page so the user immediately sees the new chips.
  const handleEditListWords = async (words) => {
    if (!selectedList || selectedList.listType !== 'custom' || !words?.length) return;
    await updateList(selectedList.list.id, { words });
    setSelectedList(prev => prev ? {
      ...prev,
      list: {
        ...prev.list,
        words: words.map(w => (typeof w === 'string' ? { word: w, definition: '' } : w)),
      },
    } : null);
    setCreator(null);
  };

  const handleMarkComplete = async (listId, activity, opts) => {
    await markComplete(listId, activity, opts);
    const p = await getListProgress(listId, opts.listType);
    setProgressCache(prev => ({ ...prev, [listId]: p || {} }));
  };

  // Render a Practice Quest banner for the given scope. Pure presentation;
  // pass one of homeAggregate / myListsAggregate / exploreAggregate plus
  // the matching has-mastered gate. Hidden when either condition fails.
  const renderPracticeQuestBanner = ({ aggregate }) => {
    if (!aggregate || aggregate.length === 0) return null;
    const distinctLists = new Set(aggregate.map(e => e.listId)).size;
    const preview = aggregate.length <= 3
      ? aggregate.map(e => e.word).join(', ')
      : `including ${aggregate.slice(0, 2).map(e => e.word).join(', ')}…`;
    return (
      <section className="hub-practice-quest ed-practice-quest-banner">
        <div
          className="pq-card pq-card--compact"
          role="button"
          tabIndex={0}
          onClick={() => launchPracticeQuestWith(aggregate)}
          onKeyDown={(e) => { if (e.key === 'Enter') launchPracticeQuestWith(aggregate); }}
        >
          <div className="pq-card-row pq-card-row--top">
            <div className="pq-card-headline">
              <span className="pq-card-icon" aria-hidden="true">🎯</span>
              <h3 className="pq-card-title">Practice Quest</h3>
            </div>
            <div className="pq-card-meta">
              <span className="pq-card-subtitle">Spells to Master</span>
              <span className="pq-card-count">
                {aggregate.length} word{aggregate.length === 1 ? '' : 's'}{' '}
                across {distinctLists} list{distinctLists === 1 ? '' : 's'} need practice
              </span>
            </div>
          </div>
          <div className="pq-card-row pq-card-row--bottom">
            <p className="pq-card-preview">{preview}</p>
            <span className="pq-card-go">Start ▶</span>
          </div>
        </div>
      </section>
    );
  };

  // Render a grid of list cards from { list, listType } entries.
  const renderGrid = (entries, emptyMsg) => {
    if (!entries.length) return <p className="ep-phase-empty">{emptyMsg}</p>;
    return (
      <div className="hub-grid">
        {entries.map(({ list, listType }, i) => (
          <ListCard
            key={list.id}
            list={list}
            listType={listType}
            index={i}
            progress={progressCache[list.id] || {}}
            isFavourite={favourites.includes(list.id)}
            onToggleFavourite={toggleFavourite}
            onClick={() => openList(list, listType)}
          />
        ))}
      </div>
    );
  };

  // Right pane content per page.
  const renderPage = () => {
    if (selectedList) {
      const backHome = () => {
        // If we got here from an external origin (e.g. the Adventure
        // Map), let the parent send the user back to the right place.
        if (selectedList?.origin && selectedList.origin !== 'internal' && typeof onListExit === 'function') {
          setSelectedList(null);
          onListExit(selectedList.origin);
          return;
        }
        setSelectedList(null);
      };
      const isCustom = selectedList.listType === 'custom';
      const meta = isCustom
        ? formatBannerDate(selectedList.list.created_at)
        : (selectedList.list.category || '');
      return (
        <main className="ed-main ed-main--list">
          {/* Page-level back button — replaces the TopNav while a list is
              open. Returns to whichever dashboard page the user came from
              because setSelectedList(null) leaves `page` state untouched. */}
          <div className="ed-list-backbar">
            <button
              type="button"
              className="ed-list-back-btn"
              onClick={backHome}
              aria-label="Back"
            >
              <span className="ed-list-back-arrow" aria-hidden="true">←</span>
              Back
            </button>
            <span className="ed-list-back-title">{selectedList.list.name}</span>
          </div>
          <ListHub
            list={selectedList.list}
            listType={selectedList.listType}
            session={session}
            user={user}
            getListProgress={getListProgress}
            markComplete={handleMarkComplete}
            onBack={backHome}
            onCreateAccount={() => setShowSignIn(true)}
            listNamePanel={
              <div className="ed-listname-panel">
                {isCustom ? (
                  <input
                    className="ed-listname-input"
                    value={listNameDraft}
                    onChange={(e) => setListNameDraft(e.target.value)}
                    onBlur={saveListName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.blur();
                      if (e.key === 'Escape') {
                        setListNameDraft(selectedList.list.name);
                        e.target.blur();
                      }
                    }}
                    aria-label="List name (click to rename)"
                    spellCheck={false}
                  />
                ) : (
                  <span className="ed-listname-static">{selectedList.list.name}</span>
                )}
                {isCustom && (
                  <TestDateLine
                    testDate={selectedList.list.testDate || null}
                    onChange={async (newDate) => {
                      await updateList(selectedList.list.id, { testDate: newDate });
                      setSelectedList(prev => prev
                        ? { ...prev, list: { ...prev.list, testDate: newDate } }
                        : null);
                    }}
                  />
                )}
              </div>
            }
            listFooter={
              isCustom ? (
                <div className="ed-listfoot">
                  <button
                    className="ed-listfoot-btn"
                    type="button"
                    onClick={() => setCreator('edit')}
                  >
                    ✎ Edit list
                  </button>
                  {meta && <span className="ed-listfoot-date">{meta}</span>}
                </div>
              ) : null
            }
          />
        </main>
      );
    }

    if (page === 'home') {
      return (
        <main className="ed-main ed-main--home">
          {renderPracticeQuestBanner({ aggregate: homeAggregate })}
          <PaneSection headerClass="ep-home-phase" label="Home" hint="Coming soon">
            <div className="ed-list-frame">
              <p className="ep-phase-empty">
                Placeholder — the new Home view will live here.
              </p>
            </div>
          </PaneSection>
        </main>
      );
    }

    if (page === 'assignments') {
      // (No assignments backend yet — the array is empty for now. Hide-completed
      //  toggle still renders so the filter row is consistent across pages.)
      const assignmentEntries = [];
      return (
        <main className="ed-main ed-main--assignments">
          <PaneSection headerClass="ep-assignments-phase" label="Assignments" hint="Word lists from your teacher">
            <div className="ed-list-frame">
              <FilterRow
                hideCompleted={hideCompleted}
                onHideCompletedChange={setHideCompleted}
                resultCount={assignmentEntries.length}
                noun="assignment"
              />
              <p className="ep-phase-empty">No word lists assigned</p>
            </div>
          </PaneSection>
        </main>
      );
    }

    if (page === 'mylists') {
      const sortFn = (a, b) => {
        // Lists may carry created_at (ISO string) or fall back to insertion
        // order. Higher index = newer in the source array.
        const ta = new Date(a.created_at || 0).getTime() || 0;
        const tb = new Date(b.created_at || 0).getTime() || 0;
        return sortOrder === 'oldest' ? (ta - tb) : (tb - ta);
      };
      const filteredCustom = normalisedCustom
        .filter(l => !hideCompleted || !isListCompleted(l, progressCache[l.id]))
        .slice()
        .sort(sortFn);
      const hasLists = filteredCustom.length > 0;
      return (
        <main className="ed-main ed-main--mylists">
          {renderPracticeQuestBanner({ aggregate: myListsAggregate })}
          <PaneSection headerClass="ep-your-lists-phase" label="My Lists" hint="Your custom word lists">
            <div className="ed-list-frame">
              <FilterRow
                hideCompleted={hideCompleted}
                onHideCompletedChange={setHideCompleted}
                resultCount={filteredCustom.length}
                noun="list"
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
              />
              <div className="hub-grid">
                {hasLists && filteredCustom.map((list, i) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    listType="custom"
                    index={i}
                    progress={progressCache[list.id] || {}}
                    isFavourite={favourites.includes(list.id)}
                    onToggleFavourite={toggleFavourite}
                    onClick={() => openList(list, 'custom')}
                  />
                ))}
                <button
                  className={`ed-create-card${hasLists ? '' : ' ed-create-card--solo'}`}
                  onClick={startAddList}
                  type="button"
                >
                  <span className="ed-create-card-plus" aria-hidden="true">＋</span>
                  <span className="ed-create-card-text">
                    {hasLists ? 'Add another list' : 'Create your first list'}
                  </span>
                </button>
              </div>
            </div>
          </PaneSection>
        </main>
      );
    }

    if (page === 'explore') {
      // Confidence-aware ordering — when the child finds spelling tricky,
      // float easier difficulties to the top of the year's catalogue so
      // they aren't met with a wall of "Hard" badges. No lists are
      // hidden; the difficulty badges and content are unchanged.
      const sc = session?.spellingConfidence;
      const shouldSortByEasiestFirst = sc === 'often-tricky' || sc === 'tricky';
      const exploreResults = curriculumForYear
        .filter(l => exploreStrand     === 'all' || l.strand     === exploreStrand)
        .filter(l => exploreDifficulty === 'all' || l.difficulty === exploreDifficulty)
        .filter(l => !hideCompleted || !isListCompleted(l, progressCache[l.id]))
        .slice()
        .sort((a, b) => {
          if (!shouldSortByEasiestFirst) return 0;       // stable, preserves curriculum order
          return diffWeight(a) - diffWeight(b);
        });

      // Sets of strand/difficulty values that actually appear in this year's
      // curriculum — used to hide filter chips that have no associated lists.
      const availableStrands = new Set(
        curriculumForYear.map(l => (l.strand || '').toString().toLowerCase()).filter(Boolean)
      );
      const availableDifficulties = new Set(
        curriculumForYear.map(l => (l.difficulty || '').toString().toLowerCase()).filter(Boolean)
      );

      // Supportive banner — only for children who find spelling tricky
      // and only until they dismiss it (persisted in localStorage).
      const showSupportBanner = shouldSortByEasiestFirst && !supportBannerDismissed;

      return (
        <main className="ed-main ed-main--explore">
          {renderPracticeQuestBanner({ aggregate: exploreAggregate })}
          {showSupportBanner && (
            <div className="ed-support-banner" role="note">
              <span className="ed-support-banner__icon" aria-hidden="true">✨</span>
              <p className="ed-support-banner__text">
                Spellify gives you extra support on tricky words.
                Start with any list — we'll help you along the way.
              </p>
              <button
                type="button"
                className="ed-support-banner__close"
                onClick={dismissSupportBanner}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}
          <PaneSection
            headerClass="ep-curriculum-phase"
            label="Explore"
            hint={`${yearLabel} curriculum`}
          >
            <div className="ed-list-frame">
              <ExploreFilters
                strand={exploreStrand}
                onStrandChange={setExploreStrand}
                difficulty={exploreDifficulty}
                onDifficultyChange={setExploreDifficulty}
                hideCompleted={hideCompleted}
                onHideCompletedChange={setHideCompleted}
                resultCount={exploreResults.length}
                availableStrands={availableStrands}
                availableDifficulties={availableDifficulties}
              />
              {exploreResults.length === 0 ? (
                <p className="ep-phase-empty">
                  No lessons match — try a different filter.
                </p>
              ) : (
                renderGrid(
                  exploreResults.map(l => ({ list: l, listType: 'curriculum' })),
                  'No lessons match — try a different filter.',
                )
              )}
            </div>
          </PaneSection>
        </main>
      );
    }

    if (page === 'favourites') {
      const filteredFavs = favouriteEntries
        .filter(({ list }) => !hideCompleted || !isListCompleted(list, progressCache[list.id]));
      return (
        <main className="ed-main ed-main--favourites">
          <PaneSection headerClass="ep-curriculum-phase" label="Favourites" hint="Lists you've hearted">
            <div className="ed-list-frame">
              <FilterRow
                hideCompleted={hideCompleted}
                onHideCompletedChange={setHideCompleted}
                resultCount={filteredFavs.length}
                noun="list"
              />
              {renderGrid(filteredFavs, 'No favourites yet — tap the heart on a list to add it here.')}
            </div>
          </PaneSection>
        </main>
      );
    }

    if (page === 'alerts') {
      // Real streak display, replaces the earlier "coming soon" placeholder.
      const s = streakSnapshot;
      const week = streakWeek;
      const motiv =
        s.currentStreak >= 7   ? 'Legendary streak! 🌟' :
        s.currentStreak >= 3   ? "You're on a roll!" :
        s.currentStreak >= 1   ? 'Great start!' :
                                  'Start your streak today!';
      return (
        <main className="ed-main ed-main--alerts">
          <PaneSection headerClass="ep-assignments-phase" label="Alerts" hint="Daily challenges and streak">
            <div className="ed-streak">
              <div className="ed-streak__hero">
                <span className="ed-streak__flame" aria-hidden="true">🔥</span>
                <div className="ed-streak__hero-text">
                  <div className="ed-streak__count">
                    {s.currentStreak}{' '}
                    <span className="ed-streak__count-unit">
                      day{s.currentStreak === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="ed-streak__motiv">{motiv}</div>
                </div>
              </div>

              <div className="ed-streak__week" role="list" aria-label="This week">
                {week.map((d) => (
                  <div
                    key={d.iso}
                    role="listitem"
                    className={
                      'ed-streak__day' +
                      (d.isToday  ? ' ed-streak__day--today'  : '') +
                      (d.isFuture ? ' ed-streak__day--future' : '') +
                      (d.played   ? ' ed-streak__day--played' : '')
                    }
                  >
                    <span className="ed-streak__dot" aria-hidden="true" />
                    <span className="ed-streak__label">{d.dayLabel}</span>
                  </div>
                ))}
              </div>

              {s.graceUsed && (
                <p className="ed-streak__grace">
                  Grace day used — one missed day is forgiven 💜
                </p>
              )}

              <div className="ed-streak__record">
                Longest streak: <strong>{s.longestStreak} day{s.longestStreak === 1 ? '' : 's'}</strong>
              </div>
            </div>
          </PaneSection>
        </main>
      );
    }

    if (page === 'recent') {
      const filteredRecent = recentEntries
        .filter(({ list }) => !hideCompleted || !isListCompleted(list, progressCache[list.id]));
      return (
        <main className="ed-main ed-main--recent">
          <PaneSection headerClass="ep-assignments-phase" label="Recently viewed" hint="Lists you've opened lately">
            <div className="ed-list-frame">
              <FilterRow
                hideCompleted={hideCompleted}
                onHideCompletedChange={setHideCompleted}
                resultCount={filteredRecent.length}
                noun="list"
              />
              {renderGrid(filteredRecent, 'Nothing here yet — open a list to start your history.')}
            </div>
          </PaneSection>
        </main>
      );
    }

    return null;
  };

  // Practice Quest session takes over the dashboard area when active.
  // The sidebar still renders so the child can exit / navigate, but the
  // main pane is the practice flow.
  if (practiceItems) {
    return (
      <div className="lh-game-fullscreen">
        <PracticeWriteIt
          items={practiceItems}
          onComplete={handlePracticeComplete}
          onExit={() => setPracticeItems(null)}
          onBack={() => setPracticeItems(null)}
        />
      </div>
    );
  }

  return (
    <div className="ed-shell">
      {/* Decorative shooting stars — three independent paths with staggered
          timing so they fire roughly every 4-6 seconds, never together. */}
      <div className="ed-shooting-stars" aria-hidden="true">
        <span className="ed-shooting-star ed-shooting-star--1" />
        <span className="ed-shooting-star ed-shooting-star--2" />
        <span className="ed-shooting-star ed-shooting-star--3" />
      </div>
      <aside className="ed-sidebar">
        <div className="ed-sidebar-inner">
          <div className="ed-playercard">
            <HubPlayerCard
              childName={session?.childName || ''}
              childCharacter={session?.childCharacter || null}
              year={session?.year ?? null}
              activityStatuses={session?.activityStatuses || {}}
              mastery={session?.mastery || {}}
              welcomeBonus={session?.welcomeBonus || 0}
              user={user}
              onCreateAccount={() => setShowSignIn(true)}
            />
          </div>

          <nav className="ed-nav" aria-label="Explore navigation">
            <NavLink icon="🏠" label="Home"            active={page === 'home'        && !selectedList} onClick={() => { setSelectedList(null); setPage('home'); }} />
            <NavLink icon="📬" label="Assignments"     count={0}                                          active={page === 'assignments' && !selectedList} onClick={() => { setSelectedList(null); setPage('assignments'); }} />
            <NavLink icon="📝" label="My lists"        count={user ? normalisedCustom.length : null}     active={page === 'mylists'     && !selectedList} onClick={() => { setSelectedList(null); setPage('mylists'); }} />
            <NavLink icon="🔭" label="Explore"         count={curriculumForYear.length}                  active={page === 'explore'     && !selectedList} onClick={() => { setSelectedList(null); setPage('explore'); }} />
            <NavLink icon="⭐" label="Favourites"      count={favouriteEntries.length}                   active={page === 'favourites'  && !selectedList} onClick={() => { setSelectedList(null); setPage('favourites'); }} />
            <NavLink icon="🕒" label="Recently viewed" count={recentEntries.length}                      active={page === 'recent'      && !selectedList} onClick={() => { setSelectedList(null); setPage('recent'); }} />
          </nav>


          <div className="ed-footer">
            {!user && (
              <button className="ed-footer-signin" onClick={() => setShowSignIn(true)}>
                Sign in
              </button>
            )}
            <button
              className="ed-icon-btn"
              disabled
              aria-label="Profile (coming soon)"
              title="Profile (coming soon)"
            >
              <span aria-hidden="true">👤</span>
            </button>
            <button
              className="ed-icon-btn"
              onClick={onOpenSettings}
              disabled={!onOpenSettings}
              aria-label="Settings"
              title="Settings"
            >
              <span aria-hidden="true">⚙</span>
            </button>
          </div>
        </div>
      </aside>

      {renderPage()}

      {showChooser && (
        <AddListChooser
          isGuest={!user}
          onPickRandom={() => { setShowChooser(false); setCreator('random'); }}
          onPickManual={() => { setShowChooser(false); setCreator('manual'); }}
          onSignIn={() => { setShowChooser(false); setShowSignIn(true); }}
          onClose={() => setShowChooser(false)}
        />
      )}
      {creator && (
        <div className="ob-wrap ed-creator-overlay">
          <button
            className="ed-creator-close"
            onClick={() => setCreator(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <div className="ob-card">
            {creator === 'random' && (
              <GeneratedWords
                yearGroup={selectedYear}
                onConfirm={({ words }) => handleCreate({ words })}
              />
            )}
            {creator === 'manual' && (
              <div className="ob-step">
                <div className="ob-step-header">
                  <div className="ob-step-icon">✏️</div>
                  <h2 className="ob-step-title">Add your words</h2>
                  <p className="ob-step-sub">Type one at a time · min 3 words</p>
                </div>
                <AddWordsManual
                  collectTestDate
                  onWordsReady={(words, extras) => handleCreate({ words, testDate: extras?.testDate ?? null })}
                />
              </div>
            )}
            {creator === 'edit' && selectedList && (
              <div className="ob-step">
                <div className="ob-step-header">
                  <div className="ob-step-icon">✏️</div>
                  <h2 className="ob-step-title">Edit {selectedList.list.name}</h2>
                  <p className="ob-step-sub">Replace the words for this list · min 3 words</p>
                </div>
                <AddWordsManual onWordsReady={handleEditListWords} />
              </div>
            )}
          </div>
        </div>
      )}
      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          signIn={signIn}
          signUp={signUp}
          signInWithGoogle={signInWithGoogle}
        />
      )}
    </div>
  );
}
