// Avatar character sets — the data behind the (set-based) Avatar selector.
//
// Unlike the AvatarBuilder (mix-and-match pieces), this model is "pick a
// whole character from a set". The Starter Squad ships with 10 ready-made
// characters that are free and always unlocked. Additional themed sets
// (Royals, Explorers, Mythical, …) are shown as locked cards the child can
// unlock with lumens once their art is illustrated.
//
// ── Customization ────────────────────────────────────────────────────
// Customization (skin/hair/outfit colour variants) is a property of the
// SET, not a global. Each set can define its own palette + axes — a Mythical
// set might offer green "Body" tones; a plain set can omit `customization`
// entirely and be pick-only. Within a customizable set, a character opts in
// by carrying a `slug` (its variant-art folder) + `base` (the recipe that
// matches how it's already drawn). Characters without a `slug` are pick-only
// even inside a customizable set, so you can customize select characters.
//
// Variants are pre-rendered per-combination images (not layered overlays),
// chosen by a filename recipe built from the set's own axes:
//   <set.dir>/<slug>/<slug>-<code><idx>-….webp
//   e.g. starter-set/sprout/sprout-s0-h2-o0.webp
// File growth is MULTIPLICATIVE (skin × hair × outfit), so keep axes capped
// (~3 axes, ~5 options) and dial depth per set. Real variant art doesn't
// exist yet, so resolveAvatarSrc() falls back to the base image until the
// matching webp is dropped in (so the combo equal to `base` can be omitted).
//
// ── Asset paths ──────────────────────────────────────────────────────
// Character webps live under public/adventure/avatars/<set.dir>/. Paths are
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

// Per-character variant opt-in for the Starter set. Only listed characters
// are customizable; `slug` is their variant-art folder and `base` is the
// recipe matching their as-drawn art (so the picker opens on the right
// swatches and the base combo can be skipped from the art set). Pilot: Sprout.
const STARTER_VARIANTS = {
  'starter-01': { slug: 'sprout', base: { skin: 0, hair: 2, outfit: 0 } }, // light skin, blonde hair, look 1
};

const STARTER_AVATARS = STARTER_NAMES.map((name, i) => {
  const n = String(i + 1).padStart(2, '0');
  const id = `starter-${n}`;
  return {
    id,
    name,
    src: asset(`adventure/avatars/starter-set/avatar-starter-${n}.webp`),
    ...(STARTER_VARIANTS[id] || {}),   // adds slug + base for customizable chars
  };
});

// The free, always-unlocked set the child starts with. `customization` holds
// the set's shared axes/palette; `dir` is the asset subfolder.
export const STARTER_SET = {
  id: 'starter',
  name: 'Starter Squad',
  blurb: 'Your first crew — pick whoever feels like you.',
  emoji: '🌟',
  accent: '#a5f3fc',
  dir: 'starter-set',
  customization: {
    axes: [
      { key: 'skin',   label: 'Skin',   type: 'swatch', options: ['#f3d2b6', '#d49a6a', '#8d5524', '#4a2c17'] },
      { key: 'hair',   label: 'Hair',   type: 'swatch', options: ['#3a2a1d', '#c8732e', '#ecd27a', '#141414'] },
      { key: 'outfit', label: 'Outfit', type: 'choice', options: ['1', '2', '3', '4'] },
    ],
  },
  avatars: STARTER_AVATARS,
};

// Themed sets shown beneath the starter row. These don't have art yet —
// each is represented by its emoji + accent and a lumens price. Unlocking
// is "Coming soon"; the price/`size` data is here so wiring real purchases
// later is a small change. `size` is the planned number of characters.
// A set becomes customizable the day it's given a `customization` block +
// avatars with `slug`/`base`; until then it's pick-only.
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

// First-visit default — Sprout in their as-drawn look (light skin, blonde
// hair, look 1). Mirrors STARTER_VARIANTS['starter-01'].base so the picker's
// pre-selected swatches match the base art.
export const DEFAULT_SELECTION = { setId: 'starter', avatarId: 'starter-01', skin: 0, hair: 2, outfit: 0 };

// Sets that have real characters today (locked sets have no art yet). Lookups
// search this list, so adding a playable themed set is a one-line append.
const PLAYABLE_SETS = [STARTER_SET];

export function findSet(setId) {
  return PLAYABLE_SETS.find((s) => s.id === setId) || STARTER_SET;
}

export const findAvatar = (avatarId) => {
  for (const set of PLAYABLE_SETS) {
    const a = set.avatars.find((x) => x.id === avatarId);
    if (a) return a;
  }
  return STARTER_SET.avatars[0];
};

// The set an avatar belongs to.
export function findAvatarSet(avatarId) {
  return PLAYABLE_SETS.find((s) => s.avatars.some((x) => x.id === avatarId)) || STARTER_SET;
}

// The customization axes for an avatar — null when the avatar's set has no
// customization or the avatar hasn't opted in (no slug). Drives both whether
// the picker shows and what swatches/looks it offers.
export function customizationAxes(avatarId) {
  const set = findAvatarSet(avatarId);
  const avatar = findAvatar(avatarId);
  if (!set.customization || !avatar.slug) return null;
  return set.customization.axes;
}

export const isCustomizable = (avatarId) => customizationAxes(avatarId) != null;

// The as-drawn recipe for a character (neutral all-zeros if it doesn't
// declare one). Used as the starting point when a character is chosen, so
// switching avatars always shows that avatar's own default look.
export function baseRecipe(avatarId) {
  return findAvatar(avatarId)?.base ?? { skin: 0, hair: 0, outfit: 0 };
}

// Build the variant image path for a recipe from the SET's own axes, so the
// filename adapts if a set ever defines different axes (each axis can carry
// an explicit one-letter `code`, defaulting to the key's first letter).
// Returns null when the avatar isn't customizable.
export function variantSrc(avatarId, variant = {}) {
  const avatar = findAvatar(avatarId);
  const set = findAvatarSet(avatarId);
  if (!avatar.slug || !set.customization) return null;
  const parts = set.customization.axes
    .map((ax) => `${ax.code || ax.key[0]}${variant[ax.key] ?? 0}`)
    .join('-');
  return asset(`adventure/avatars/${set.dir}/${avatar.slug}/${avatar.slug}-${parts}.webp`);
}

// Resolve image sources for a full selection: the variant src to try first
// (null when not customizable) and the always-safe base fallback the <img>
// drops to onError until real variant art exists.
export function resolveAvatarSrc(selection = {}) {
  const base = findAvatar(selection.avatarId);
  return { variant: variantSrc(selection.avatarId, selection), base: base.src, name: base.name };
}

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
