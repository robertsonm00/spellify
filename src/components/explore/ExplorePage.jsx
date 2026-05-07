import React, { useState, useEffect } from 'react';
import { YEAR_GROUPS, getListsForYear } from '../../data/curriculumLists';
import { useCustomLists } from '../../hooks/useCustomLists';
import { useProgress }    from '../../hooks/useProgress';
import ListHub            from './ListHub';
import ListHubV2          from './ListHubV2';
import ListHubV3          from './ListHubV3';
import CreateListModal    from './CreateListModal';
import SignInModal        from './SignInModal';
import './ExplorePage.css';

const CATEGORY_COLOURS = {
  'Statutory':    '#6b7280',
  'Phonics':      '#a855f7',
  'Patterns':     '#1D9E75',
  'Etymology':    '#EF9F27',
  'Vowels':       '#f97316',
  'Sight words':  '#22c55e',
};

// ── List card ──────────────────────────────────────────────────────────────────

function ListCard({ list, listType, onClick, progress }) {
  const colour      = CATEGORY_COLOURS[list.category] || '#6b7280';
  const words       = list.words || [];
  const previewWords = words.slice(0, 3).map(w => (typeof w === 'string' ? w : w.word));
  const moreCount   = Math.max(0, words.length - 3);
  const ACTS        = 4; // total activities per list
  const completedActs = Object.values(progress || {}).filter(p => p?.status === 'completed').length;
  const pct         = Math.round((completedActs / ACTS) * 100);
  const allDone     = completedActs === ACTS;

  return (
    <button className={`ep-list-card${allDone ? ' ep-list-card--done' : ''}`} onClick={onClick}>
      {/* Category bar */}
      <div className="ep-list-card-top" style={{ background: colour + '22', borderColor: colour }}>
        <span className="ep-list-cat" style={{ color: colour }}>{list.category || 'Custom'}</span>
        {allDone && <span className="ep-list-done-badge">★ Done</span>}
        {!allDone && completedActs > 0 && <span className="ep-list-progress-badge">{completedActs}/{ACTS}</span>}
      </div>

      {/* Name & meta */}
      <div className="ep-list-card-body">
        <h3 className="ep-list-name">{list.name}</h3>
        <p className="ep-list-preview">
          {previewWords.join(', ')}{moreCount > 0 ? ` +${moreCount} more` : ''}
        </p>
        <div className="ep-list-footer">
          <span className="ep-list-count">{words.length} words</span>
          {/* Progress bar */}
          <div className="ep-list-pbar-wrap">
            <div className="ep-list-pbar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Add-list card ──────────────────────────────────────────────────────────────

function AddListCard({ onClick, locked }) {
  return (
    <button
      className={`ep-list-card ep-add-card${locked ? ' ep-add-card--locked' : ''}`}
      onClick={locked ? undefined : onClick}
      disabled={locked}
      title={locked ? 'Sign in to save your own lists' : 'Create a new word list'}
    >
      <div className="ep-add-icon">{locked ? '🔒' : '＋'}</div>
      <p className="ep-add-label">{locked ? 'Sign in to create lists' : 'Add a list'}</p>
    </button>
  );
}

// ── Main ExplorePage ───────────────────────────────────────────────────────────

export default function ExplorePage({ user, profile, signIn, signUp, signInWithGoogle }) {
  const [selectedYear,  setSelectedYear]  = useState(1);
  const [selectedList,  setSelectedList]  = useState(null);   // { list, listType }
  const [view,          setView]          = useState('yearHub'); // 'yearHub' | 'listHub'
  const [showCreate,    setShowCreate]    = useState(false);
  const [showSignIn,    setShowSignIn]    = useState(false);
  const [progressCache, setProgressCache] = useState({});     // { [listId]: { ... } }

  const { lists: customLists, addList } = useCustomLists(user);
  const { getListProgress, markComplete }            = useProgress(user);

  const curriculumForYear = getListsForYear(selectedYear);

  // ── Load progress for visible lists ──────────────────────────────────────
  useEffect(() => {
    const allIds = [
      ...curriculumForYear.map(l => l.id),
      ...customLists.map(l => l.id),
    ];
    allIds.forEach(async (id) => {
      if (!progressCache[id]) {
        const p = await getListProgress(id);
        setProgressCache(prev => ({ ...prev, [id]: p || {} }));
      }
    });
  }, [selectedYear, customLists.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open list ─────────────────────────────────────────────────────────────
  const openList = (list, listType) => {
    setSelectedList({ list, listType });
    setView('listHub');
  };

  // ── Handle progress update from ListHub ───────────────────────────────────
  const handleMarkComplete = async (listId, activity, opts) => {
    await markComplete(listId, activity, opts);
    // Refresh progress for this list
    const p = await getListProgress(listId, opts.listType);
    setProgressCache(prev => ({ ...prev, [listId]: p || {} }));
  };

  // ── ListHub view ──────────────────────────────────────────────────────────
  if (view === 'listHub' && selectedList) {
    const backToYearHub = () => { setView('yearHub'); setSelectedList(null); };
    const sharedProps = {
      list:            selectedList.list,
      listType:        selectedList.listType,
      user,
      getListProgress,
      markComplete:    handleMarkComplete,
      onBack:          backToYearHub,
    };

    if (selectedList.list.id === 'y1-ow-words') {
      return <ListHubV2 {...sharedProps} />;
    }
    if (selectedList.list.id === 'y1-ck-words') {
      return <ListHubV3 {...sharedProps} />;
    }

    return <ListHub {...sharedProps} />;
  }

  // ── Year Hub view ─────────────────────────────────────────────────────────
  return (
    <div className="ep-wrap">
      {/* ── Guest banner ── */}
      {!user && (
        <div className="ep-guest-banner">
          <span>🎮 Playing as guest — </span>
          <button className="ep-guest-signin" onClick={() => setShowSignIn(true)}>
            sign in to save your progress
          </button>
        </div>
      )}

      <div className="ep-content">
        {/* ── Year group tabs ── */}
        <nav className="ep-year-tabs" aria-label="Year groups">
          {YEAR_GROUPS.map(({ year, label, ageRange }) => (
            <button
              key={year}
              className={`ep-year-tab${selectedYear === year ? ' ep-year-tab--active' : ''}`}
              onClick={() => setSelectedYear(year)}
            >
              {label}
              <span className="ep-year-age">{ageRange}</span>
            </button>
          ))}
        </nav>

        {/* ── Curriculum lists ── */}
        <section className="ep-section">
          <h2 className="ep-section-heading">
            📚 Curriculum Lists
            <span className="ep-section-sub">{curriculumForYear.length} lists</span>
          </h2>
          <div className="ep-grid">
            {curriculumForYear.map(list => (
              <ListCard
                key={list.id}
                list={list}
                listType="curriculum"
                progress={progressCache[list.id] || {}}
                onClick={() => openList(list, 'curriculum')}
              />
            ))}
          </div>
        </section>

        {/* ── My Lists ── */}
        <section className="ep-section">
          <h2 className="ep-section-heading">
            ✏️ My Lists
            {user && <span className="ep-section-sub">{customLists.length} lists</span>}
          </h2>
          <div className="ep-grid">
            {/* Custom list cards (logged-in users only) */}
            {user && customLists.map(list => {
              const normalised = {
                ...list,
                category: 'Custom',
                words: Array.isArray(list.words)
                  ? list.words.map(w => (typeof w === 'string' ? { word: w, definition: '' } : w))
                  : [],
              };
              return (
                <ListCard
                  key={list.id}
                  list={normalised}
                  listType="custom"
                  progress={progressCache[list.id] || {}}
                  onClick={() => openList(normalised, 'custom')}
                />
              );
            })}

            {/* Add a list card */}
            <AddListCard
              locked={!user}
              onClick={() => setShowCreate(true)}
            />
          </div>

          {/* Guest locked hint */}
          {!user && (
            <p className="ep-my-lists-hint">
              <button className="ep-inline-link" onClick={() => setShowSignIn(true)}>
                Sign in
              </button>{' '}
              to create and save your own word lists.
            </p>
          )}
        </section>
      </div>

      {/* ── Modals ── */}
      {showCreate && (
        <CreateListModal
          isGuest={!user}
          onClose={() => setShowCreate(false)}
          onSave={async ({ name, words }) => {
            await addList({ name, words });
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
