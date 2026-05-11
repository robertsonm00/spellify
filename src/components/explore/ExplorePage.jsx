import React, { useState, useEffect } from 'react';
import { YEAR_GROUPS, getListsForYear } from '../../data/curriculumLists';
import { useCustomLists } from '../../hooks/useCustomLists';
import { useProgress }    from '../../hooks/useProgress';
import { ACTIVITIES }     from '../../data/activities';
import ListHub            from './ListHub';
import CreateListModal    from './CreateListModal';
import SignInModal        from './SignInModal';
import { HubPlayerCard } from '../WordListHub';
import '../WordListHub.css';
import './ExplorePage.css';

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

// ── List card — hub activity card style ───────────────────────────────────────

function ListCard({ list, onClick, progress }) {
  const colour     = CATEGORY_COLOURS[list.category] || '#6b7280';
  const darkColour = CATEGORY_DARK[list.category]    || '#374151';
  const words      = list.words || [];
  const preview    = words.slice(0, 3).map(w => (typeof w === 'string' ? w : w.word)).join(', ');
  const more       = Math.max(0, words.length - 3);

  const ACTS          = ACTIVITIES.length;
  const completedActs = Object.values(progress || {}).filter(p => p?.status === 'completed').length;
  const done          = completedActs === ACTS;
  const status        = done ? 'completed' : completedActs > 0 ? 'in-progress' : 'not-started';

  const STATUS_LABEL = { 'not-started': 'Not Started', 'in-progress': `${completedActs}/${ACTS} done`, 'completed': 'Done ✓' };

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
      <div className="hub-card-body">
        <h3 className="hub-card-name">{list.name}</h3>
        <span className={`hub-badge hub-badge--${status}`}>{STATUS_LABEL[status]}</span>
        <p className="ep-card-preview">{preview}{more > 0 ? ` +${more} more` : ''}</p>
      </div>
    </div>
  );
}

// ── Unsaved-list warning popup ────────────────────────────────────────────────

function AddListPrompt({ onGenerate, onGenerateAnyway, onSignIn, onClose }) {
  return (
    <div className="ep-prompt-overlay" onClick={onClose}>
      <div className="ep-prompt-modal" onClick={e => e.stopPropagation()}>
        <p className="ep-prompt-heading">Lists won't be saved</p>
        <p className="ep-prompt-text">
          Lists will not be saved unless you have an account.
        </p>
        <div className="ep-prompt-actions">
          <button className="ep-prompt-btn ep-prompt-btn--generate" onClick={onGenerate}>
            Generate list
          </button>
          <button className="ep-prompt-btn ep-prompt-btn--anyway" onClick={onGenerateAnyway}>
            Generate list anyway
          </button>
          <button className="ep-prompt-btn ep-prompt-btn--signin" onClick={onSignIn}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ExplorePage ───────────────────────────────────────────────────────────

const MAX_VISIBLE_LISTS = 8;

export default function ExplorePage({ session = null, user, profile, signIn, signUp, signInWithGoogle }) {
  const [selectedList,     setSelectedList]     = useState(null);
  const [view,             setView]             = useState('yearHub');
  const [showCreate,       setShowCreate]       = useState(false);
  const [showSignIn,       setShowSignIn]       = useState(false);
  const [showAddListPrompt, setShowAddListPrompt] = useState(false);
  const [progressCache,    setProgressCache]    = useState({});

  const { lists: customLists, addList } = useCustomLists(user);
  const { getListProgress, markComplete } = useProgress(user);

  const selectedYear      = session?.year ?? 1;
  const curriculumForYear = getListsForYear(selectedYear);

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

  const openList = (list, listType) => {
    setSelectedList({ list, listType });
    setView('listHub');
  };

  const handleMarkComplete = async (listId, activity, opts) => {
    await markComplete(listId, activity, opts);
    const p = await getListProgress(listId, opts.listType);
    setProgressCache(prev => ({ ...prev, [listId]: p || {} }));
  };

  const handleAddList = () => {
    if (user) {
      setShowCreate(true);
    } else {
      setShowAddListPrompt(true);
    }
  };

  // ── ListHub view ──────────────────────────────────────────────────────────
  if (view === 'listHub' && selectedList) {
    const backToYearHub = () => { setView('yearHub'); setSelectedList(null); };
    return (
      <ListHub
        list={selectedList.list}
        listType={selectedList.listType}
        session={session}
        user={user}
        getListProgress={getListProgress}
        markComplete={handleMarkComplete}
        onBack={backToYearHub}
        onCreateAccount={() => setShowSignIn(true)}
      />
    );
  }

  const yearGroup = YEAR_GROUPS.find(g => g.year === selectedYear);
  const yearLabel = yearGroup ? yearGroup.label : `Year ${selectedYear}`;

  const curriculumCapped = curriculumForYear.length > MAX_VISIBLE_LISTS;
  const customCapped     = customLists.length > MAX_VISIBLE_LISTS;

  // ── Year Hub view ─────────────────────────────────────────────────────────
  return (
    <>
    <div className="hub-shell hub-shell--split">
    <div className="hub hub--split hub--split-explore">

      {/* ── Left column ── */}
      <div className="hub-split-left">

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

        {/* Guest sign-in panel */}
        {!user && (
          <section className="ep-guest-panel">
            <div className="ep-guest-panel-header">GUEST MODE</div>
            <div className="ep-guest-panel-body">
              <p className="ep-guest-panel-text">
                Sign in to save your progress and create your own word lists.
              </p>
              <button className="ep-guest-panel-btn" onClick={() => setShowSignIn(true)}>
                Sign In →
              </button>
            </div>
          </section>
        )}

        {/* Add a word list panel */}
        <section className="ep-add-list-panel">
          <div className="ep-add-list-header">ADD A LIST</div>
          <div className="ep-add-list-body">
            <button className="ep-add-list-btn" onClick={handleAddList}>
              ＋ Create a word list
            </button>
          </div>
        </section>

      </div>

      {/* ── Right column ── */}
      <div className="hub-split-right">

        {/* Assignments */}
        <section className="hub-phase ep-assignments-phase">
          <div className="hub-phase-header">
            <div className="hub-phase-text">
              <strong className="hub-phase-label">Assignments</strong>
              <span className="hub-phase-hint">Word lists from your teacher</span>
            </div>
          </div>
          <p className="ep-phase-empty">No word lists assigned</p>
        </section>

        {/* Curriculum Lists */}
        <section className="hub-phase ep-curriculum-phase">
          <div className="hub-phase-header">
            <div className="hub-phase-text">
              <strong className="hub-phase-label">Curriculum Lists</strong>
              <span className="hub-phase-hint">{yearLabel} spelling lists</span>
            </div>
          </div>
          <div className={`hub-grid${curriculumCapped ? ' ep-list-grid--capped' : ''}`}>
            {curriculumForYear.slice(0, curriculumCapped ? MAX_VISIBLE_LISTS : undefined).map(list => (
              <ListCard
                key={list.id}
                list={list}
                progress={progressCache[list.id] || {}}
                onClick={() => openList(list, 'curriculum')}
              />
            ))}
          </div>
        </section>

        {/* Your Lists */}
        <section className="hub-phase ep-your-lists-phase">
          <div className="hub-phase-header">
            <div className="hub-phase-text">
              <strong className="hub-phase-label">Your Lists</strong>
              <span className="hub-phase-hint">Custom word lists</span>
            </div>
          </div>
          {user ? (
            customLists.length > 0 ? (
              <div className={`hub-grid${customCapped ? ' ep-list-grid--capped' : ''}`}>
                {customLists.map(list => {
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
                      progress={progressCache[list.id] || {}}
                      onClick={() => openList(normalised, 'custom')}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="ep-phase-empty">No lists yet — add one using the button on the left.</p>
            )
          ) : (
            <p className="ep-phase-empty">Sign in to create and save your own word lists.</p>
          )}
          <div className="ep-phase-footer">
            <button className="ep-phase-add-btn" onClick={handleAddList}>
              ＋ Add a word list
            </button>
          </div>
        </section>

      </div>

    </div>
    </div>

    {showAddListPrompt && (
      <AddListPrompt
        onGenerate={() => { setShowAddListPrompt(false); setShowCreate(true); }}
        onGenerateAnyway={() => { setShowAddListPrompt(false); setShowCreate(true); }}
        onSignIn={() => { setShowAddListPrompt(false); setShowSignIn(true); }}
        onClose={() => setShowAddListPrompt(false)}
      />
    )}
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
    </>
  );
}
