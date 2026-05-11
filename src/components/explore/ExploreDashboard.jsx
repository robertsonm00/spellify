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
import { YEAR_GROUPS, getListsForYear, curriculumLists } from '../../data/curriculumLists';
import { useCustomLists } from '../../hooks/useCustomLists';
import { useProgress }    from '../../hooks/useProgress';
import { ACTIVITIES }     from '../../data/activities';
import ListHub            from './ListHub';
import CreateListModal    from './CreateListModal';
import SignInModal        from './SignInModal';
import { HubPlayerCard }  from '../WordListHub';
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

function ListCard({ list, onClick, progress, isFavourite, onToggleFavourite }) {
  const colour     = CATEGORY_COLOURS[list.category] || '#6b7280';
  const darkColour = CATEGORY_DARK[list.category]    || '#374151';
  const words      = list.words || [];
  const preview    = words.slice(0, 3).map(w => (typeof w === 'string' ? w : w.word)).join(', ');
  const more       = Math.max(0, words.length - 3);

  const ACTS          = ACTIVITIES.length;
  const completedActs = Object.values(progress || {}).filter(p => p?.status === 'completed').length;
  const done          = completedActs === ACTS;
  const status        = done ? 'completed' : completedActs > 0 ? 'in-progress' : 'not-started';
  const STATUS_LABEL  = { 'not-started': 'Not Started', 'in-progress': `${completedActs}/${ACTS} done`, 'completed': 'Done ✓' };

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
        title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
      >
        {isFavourite ? '★' : '☆'}
      </button>
      <div className="hub-card-body">
        <h3 className="hub-card-name">{list.name}</h3>
        <span className={`hub-badge hub-badge--${status}`}>{STATUS_LABEL[status]}</span>
        <p className="ep-card-preview">{preview}{more > 0 ? ` +${more} more` : ''}</p>
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

function PaneSection({ headerClass, label, hint, children }) {
  return (
    <section className={`hub-phase ${headerClass}`}>
      <div className="hub-phase-header">
        <div className="hub-phase-text">
          <strong className="hub-phase-label">{label}</strong>
          {hint && <span className="hub-phase-hint">{hint}</span>}
        </div>
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
  const [page,          setPage]          = useState('home');   // 'home'|'mylists'|'explore'|'favourites'|'recent'
  const [selectedList,  setSelectedList]  = useState(null);     // when set, ListHub takes the right pane
  const [showCreate,    setShowCreate]    = useState(false);
  const [showSignIn,    setShowSignIn]    = useState(false);
  const [progressCache, setProgressCache] = useState({});

  const [favourites, setFavourites] = useState(() => safeParse(localStorage.getItem(FAV_KEY), []));
  const [recent,     setRecent]     = useState(() => safeParse(localStorage.getItem(RECENT_KEY), []));

  useEffect(() => { localStorage.setItem(FAV_KEY, JSON.stringify(favourites)); }, [favourites]);
  useEffect(() => { localStorage.setItem(RECENT_KEY, JSON.stringify(recent));     }, [recent]);

  const { lists: customLists, addList } = useCustomLists(user);
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
    setSelectedList({ list, listType });
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
          />
        </main>
      );
    }

    if (page === 'home') {
      return (
        <main className="ed-main ed-main--home">
          <PaneSection headerClass="ep-assignments-phase" label="Assignments" hint="Word lists from your teacher">
            <p className="ep-phase-empty">No word lists assigned</p>
          </PaneSection>
          <PaneSection headerClass="ep-curriculum-phase" label="Curriculum Lists" hint={`${yearLabel} spelling lists`}>
            {renderGrid(
              curriculumForYear.map(l => ({ list: l, listType: 'curriculum' })),
              'No curriculum lists for this year.',
            )}
          </PaneSection>
          <PaneSection headerClass="ep-your-lists-phase" label="Your Lists" hint="Custom word lists">
            {user
              ? renderGrid(
                  normalisedCustom.map(l => ({ list: l, listType: 'custom' })),
                  'No lists yet — create one to get started.',
                )
              : <p className="ep-phase-empty">Sign in to create and save your own word lists.</p>}
          </PaneSection>
        </main>
      );
    }

    if (page === 'mylists') {
      return (
        <main className="ed-main ed-main--mylists">
          <PaneSection headerClass="ep-your-lists-phase" label="My Lists" hint="Your custom word lists">
            {user
              ? renderGrid(
                  normalisedCustom.map(l => ({ list: l, listType: 'custom' })),
                  'No lists yet. Use the + button below to create one.',
                )
              : <p className="ep-phase-empty">Sign in to create and save your own word lists.</p>}
            <div className="ep-phase-footer">
              <button
                className="ep-phase-add-btn"
                onClick={() => user ? setShowCreate(true) : setShowSignIn(true)}
              >
                ＋ Create a word list
              </button>
            </div>
          </PaneSection>
        </main>
      );
    }

    if (page === 'explore') {
      return (
        <main className="ed-main ed-main--explore">
          <PaneSection headerClass="ep-curriculum-phase" label="Explore" hint={`${yearLabel} curriculum lists`}>
            {renderGrid(
              curriculumForYear.map(l => ({ list: l, listType: 'curriculum' })),
              'No curriculum lists for this year.',
            )}
          </PaneSection>
        </main>
      );
    }

    if (page === 'favourites') {
      return (
        <main className="ed-main ed-main--favourites">
          <PaneSection headerClass="ep-curriculum-phase" label="Favourites" hint="Star lists to see them here">
            {renderGrid(favouriteEntries, 'No favourites yet — tap a star on a list to add it here.')}
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

      {showCreate && (
        <CreateListModal
          onClose={() => setShowCreate(false)}
          onSave={async (newList) => {
            await addList(newList);
            setShowCreate(false);
          }}
        />
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
