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

import React, { useState, useEffect, useMemo } from 'react';
import { YEAR_GROUPS, getListsForYear, curriculumLists, getEnrichedLesson } from '../../data/curriculumLists';
import { useCustomLists } from '../../hooks/useCustomLists';
import { useProgress }    from '../../hooks/useProgress';
import { ACTIVITIES }     from '../../data/activities';
import { getMasteryState } from '../../utils/masteryEngine';
import ListHub            from './ListHub';
import SignInModal        from './SignInModal';
import { HubPlayerCard }  from '../WordListHub';
import { GeneratedWords } from '../OnboardingFlow';
import AddWordsManual     from '../AddWordsManual';
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

function ListCard({ list, listType = 'curriculum', onClick, progress, isFavourite, onToggleFavourite }) {
  const colour     = CATEGORY_COLOURS[list.category] || '#6b7280';
  const darkColour = CATEGORY_DARK[list.category]    || '#374151';
  const words      = list.words || [];
  const wordStrings = words.map(w => (typeof w === 'string' ? w : w.word));
  const preview    = wordStrings.slice(0, 3).join(', ');
  const more       = Math.max(0, words.length - 3);

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

  return (
    <div
      className={`hub-card hub-card--${status} ep-list-card`}
      style={{
        borderColor:    darkColour,
        boxShadow:      done ? `3px 3px 0 ${colour}` : `5px 5px 0 ${colour}`,
        '--card-color': colour,
        cursor: 'pointer',
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <button
        className={`ed-fav-btn${isFavourite ? ' ed-fav-btn--on' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleFavourite(list.id); }}
        aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
        aria-pressed={isFavourite}
        data-tooltip={isFavourite ? 'Remove from favourites' : 'Add to favourite list'}
      >
        ♥
      </button>
      <div className="hub-card-body">
        <div className="ep-card-title-row">
          <h3 className="hub-card-name">{list.name}</h3>
          <div className="ep-card-badges">
            {masteredCount > 0 && (
              <span className={`hub-badge hub-badge--tl-${masteryLight}`}>
                {masteredCount} of {totalWords} words mastered
              </span>
            )}
            {completedActs > 0 && (
              <span className={`hub-badge hub-badge--tl-${gamesLight}`}>
                {completedActs} {completedActs === 1 ? 'game' : 'games'} completed
              </span>
            )}
            {listType === 'custom' && (() => {
              const { label, tone } = testDatePill(list.testDate);
              return (
                <span className={`hub-badge hub-badge--td-${tone}`}>
                  {label}
                </span>
              );
            })()}
          </div>
        </div>
        <p className="ep-card-preview">{preview}{more > 0 ? ` +${more} more` : ''}</p>
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

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ExploreDashboard({
  session = null,
  user,
  profile,
  signIn,
  signUp,
  signInWithGoogle,
  onOpenSettings,
}) {
  const [page,          setPage]          = useState('home');   // 'home'|'assignments'|'mylists'|'explore'|'favourites'|'recent'
  const [selectedList,  setSelectedList]  = useState(null);     // when set, ListHub takes the right pane
  const [creator,       setCreator]       = useState(null);     // null | 'random' | 'manual' | 'edit'
  const [showChooser,   setShowChooser]   = useState(false);
  const [showSignIn,    setShowSignIn]    = useState(false);
  const [progressCache, setProgressCache] = useState({});

  const [favourites, setFavourites] = useState(() => safeParse(localStorage.getItem(FAV_KEY), []));
  const [recent,     setRecent]     = useState(() => safeParse(localStorage.getItem(RECENT_KEY), []));
  // Explore page filter — by curriculum word category. 'all' shows everything.
  // Placeholder for now; when the richer word-type taxonomy lands this hook
  // becomes the place to swap in a more granular filter.
  const [exploreFilter, setExploreFilter] = useState('all');

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

  const openList = (list, listType) => {
    pushRecent(list.id);
    // Lazy-enrich curriculum lessons on open so the detail view has access to
    // the rich v13/v26 data. Custom lists pass through unchanged.
    const enriched = listType === 'curriculum'
      ? (getEnrichedLesson(list.id) || list)
      : list;
    setSelectedList({ list: enriched, listType });
    setListNameDraft(list.name);
  };

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

  // Render a grid of list cards from { list, listType } entries.
  const renderGrid = (entries, emptyMsg) => {
    if (!entries.length) return <p className="ep-phase-empty">{emptyMsg}</p>;
    return (
      <div className="hub-grid">
        {entries.map(({ list, listType }) => (
          <ListCard
            key={list.id}
            list={list}
            listType={listType}
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
      const backHome = () => setSelectedList(null);
      const isCustom = selectedList.listType === 'custom';
      const meta = isCustom
        ? formatBannerDate(selectedList.list.created_at)
        : (selectedList.list.category || '');
      return (
        <main className="ed-main ed-main--list">
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
          <div className="ed-home-left">
            <PaneSection headerClass="ep-assignments-phase" label="Assignments" hint="Word lists from your teacher">
              <p className="ep-phase-empty">No word lists assigned</p>
            </PaneSection>
            <PaneSection headerClass="ep-curriculum-phase" label="Curriculum Lists" hint={`${yearLabel} spelling lists`}>
              {renderGrid(
                curriculumForYear.map(l => ({ list: l, listType: 'curriculum' })),
                'No curriculum lists for this year.',
              )}
            </PaneSection>
          </div>
          <div className="ed-home-right">
            <PaneSection headerClass="ep-your-lists-phase" label="My Lists" hint="Your custom word lists">
              {renderGrid(
                normalisedCustom.map(l => ({ list: l, listType: 'custom' })),
                'No lists yet — go to My Lists to create one.',
              )}
            </PaneSection>
          </div>
        </main>
      );
    }

    if (page === 'assignments') {
      return (
        <main className="ed-main ed-main--assignments">
          <PaneSection headerClass="ep-assignments-phase" label="Assignments" hint="Word lists from your teacher">
            <p className="ep-phase-empty">No word lists assigned</p>
          </PaneSection>
        </main>
      );
    }

    if (page === 'mylists') {
      const hasLists = normalisedCustom.length > 0;
      return (
        <main className="ed-main ed-main--mylists">
          <PaneSection headerClass="ep-your-lists-phase" label="My Lists" hint="Your custom word lists">
            <div className="hub-grid">
              {hasLists && normalisedCustom.map(list => (
                <ListCard
                  key={list.id}
                  list={list}
                  listType="custom"
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
          </PaneSection>
        </main>
      );
    }

    if (page === 'explore') {
      // Categories present in the current year's curriculum lists. The
      // dropdown only offers options that actually have lists to filter to,
      // so it never resolves to an empty grid through user action.
      const presentCategories = Array.from(
        new Set(curriculumForYear.map(l => l.category).filter(Boolean)),
      );
      const filteredCurriculum = exploreFilter === 'all'
        ? curriculumForYear
        : curriculumForYear.filter(l => l.category === exploreFilter);

      const filterDropdown = (
        <label className="ed-filter">
          <span className="ed-filter-label">Filter</span>
          <select
            className="ed-filter-select"
            value={exploreFilter}
            onChange={(e) => setExploreFilter(e.target.value)}
            aria-label="Filter word lists by category"
          >
            <option value="all">All word types</option>
            {presentCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </label>
      );

      return (
        <main className="ed-main ed-main--explore">
          <PaneSection
            headerClass="ep-curriculum-phase"
            label="Explore"
            hint={`${yearLabel} curriculum lists`}
            rightSlot={filterDropdown}
          >
            {renderGrid(
              filteredCurriculum.map(l => ({ list: l, listType: 'curriculum' })),
              'No curriculum lists for this filter.',
            )}
          </PaneSection>
        </main>
      );
    }

    if (page === 'favourites') {
      return (
        <main className="ed-main ed-main--favourites">
          <PaneSection headerClass="ep-curriculum-phase" label="Favourites" hint="Heart lists to see them here">
            {renderGrid(favouriteEntries, 'No favourites yet — tap the heart on a list to add it here.')}
          </PaneSection>
        </main>
      );
    }

    if (page === 'recent') {
      return (
        <main className="ed-main ed-main--recent">
          <PaneSection headerClass="ep-assignments-phase" label="Recently viewed" hint="Lists you've opened lately">
            {renderGrid(recentEntries, 'Nothing here yet — open a list to start your history.')}
          </PaneSection>
        </main>
      );
    }

    return null;
  };

  return (
    <div className="ed-shell">
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
