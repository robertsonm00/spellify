// Avatar character sets — the data behind the (set-based) Avatar selector.
//
// Unlike the AvatarBuilder (mix-and-match pieces), this model is "pick a
// whole character from a set". The Starter Squad ships with 10 ready-made
// characters that are free and always unlocked. Additional themed sets
// (Royals, Explorers, Mythical, …) are shown as locked cards the child can
// unlock with lumens once their art is illustrated.
//
// ── Asset paths ─────────────────────────────────────────────────────
// Character webps live under public/adventure/avatars/<set>/. Paths are
// resolved against process.env.PUBLIC_URL, matching avatarAssets.js.

const PUBLIC = process.env.PUBLIC_URL || '';
const asset = (path) => `${PUBLIC}/${path}`;

// Build the starter character list from the 10 webp files that ship in
// public/adventure/avatars/starter-set/. Nicknames are gender-neutral
// placeholders — purely cosmetic labels, safe to rename later.
const STARTER_NAMES = [
  'Sprout', 'Pip', 'Sunny', 'Ziggy', 'Robin',
  'Scout', 'Pixel', 'Maple', 'Echo', 'Nova',
];

const STARTER_AVATARS = STARTER_NAMES.map((name, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    id: `starter-${n}`,
    name,
    src: asset(`adventure/avatars/starter-set/avatar-starter-${n}.webp`),
  };
});

// The free, always-unlocked set the child starts with.
export const STARTER_SET = {
  id: 'starter',
  name: 'Starter Squad',
  blurb: 'Your first crew — pick whoever feels like you.',
  emoji: '🌟',
  accent: '#a5f3fc',
  avatars: STARTER_AVATARS,
};

// Themed sets shown beneath the starter row. These don't have art yet —
// each is represented by its emoji + accent and a lumens price. Unlocking
// is "Coming soon"; the price/`size` data is here so wiring real purchases
// later is a small change. `size` is the planned number of characters.
export const LOCKED_SETS = [
  { id: 'royal',     name: 'Royals',      emoji: '👑', accent: '#fbbf24', price: 250, size: 10, blurb: 'Kings, queens and palace guards.' },
  { id: 'explorers', name: 'Explorers',   emoji: '🧭', accent: '#86efac', price: 200, size: 10, blurb: 'Adventurers ready for any quest.' },
  { id: 'mythical',  name: 'Mythical',    emoji: '🐉', accent: '#c77dff', price: 500, size: 10, blurb: 'Dragons, fairies and legends.' },
  { id: 'cosmic',    name: 'Cosmic Crew', emoji: '🚀', accent: '#7dd3fc', price: 350, size: 10, blurb: 'Astronauts and starship pilots.' },
  { id: 'heroes',    name: 'Super Squad', emoji: '🦸', accent: '#fca5a5', price: 400, size: 10, blurb: 'Caped heroes with super spelling.' },
  { id: 'critters',  name: 'Critter Pals',emoji: '🦊', accent: '#bef264', price: 200, size: 10, blurb: 'Friendly animal characters.' },
];

// localStorage keys — kept separate from the AvatarBuilder's
// 'spellify_avatar' so the two selectors never clash.
export const SELECTION_KEY     = 'spellify_avatar_character';
export const UNLOCKED_SETS_KEY = 'spellify_avatar_sets_unlocked';

// First-visit default — the opening character in the starter squad.
export const DEFAULT_SELECTION = { setId: 'starter', avatarId: 'starter-01' };

export const findAvatar = (avatarId) =>
  STARTER_SET.avatars.find((a) => a.id === avatarId) || STARTER_SET.avatars[0];

// Selection persistence — shared by the AvatarCharacters screen (writer)
// and App (reader, so the footer can mirror the chosen character).
export function loadSelection() {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (!raw) return DEFAULT_SELECTION;
    return { ...DEFAULT_SELECTION, ...JSON.parse(raw) };
  } catch { return DEFAULT_SELECTION; }
}
export function saveSelection(sel) {
  try { localStorage.setItem(SELECTION_KEY, JSON.stringify(sel)); } catch { /* ignore */ }
}
