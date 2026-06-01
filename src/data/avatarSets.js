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

// First-visit default — Sprout, shown in their as-drawn look (light skin,
// blonde hair, look 1). Mirrors VARIANT_CHARACTERS['starter-01'].base so the
// picker's pre-selected swatches match the base art.
export const DEFAULT_SELECTION = { setId: 'starter', avatarId: 'starter-01', skin: 0, hair: 2, outfit: 0 };

export const findAvatar = (avatarId) =>
  STARTER_SET.avatars.find((a) => a.id === avatarId) || STARTER_SET.avatars[0];

// ── Per-character variant customization (PILOT: Sprout / starter-01) ───
// Each customizable character has a small grid of pre-rendered combination
// images selected by a filename recipe. We picked pre-rendered combos over
// layered overlays because flat per-image colour variants are far easier to
// produce than pixel-registered layers.
//
// File growth is MULTIPLICATIVE (skin × hair × outfit), so the axes are
// capped hard: 3 axes, 4 options each = 64 files per character. Resist
// adding a 4th axis or widening past ~5 options, and only opt select
// characters into customization — not the whole squad.
//
// Axis render types:
//   'swatch' — a single flat colour (skin, hair) shown as a colour dot.
//   'choice' — a whole different look that isn't one colour (outfits can be
//              recoloured OR wholly different garments), shown as a numbered
//              chip rather than a misleading colour dot.
//
// Filename recipe:  <slug>/<slug>-s{skin}-h{hair}-o{outfit}.webp
//   e.g. starter-set/sprout/sprout-s0-h2-o1.webp
// Real variant art doesn't exist yet, so resolveAvatarSrc() falls back to
// the character's base image until the matching webp is dropped in.

export const VARIANT_AXES = [
  { key: 'skin',   label: 'Skin',   type: 'swatch', options: ['#f3d2b6', '#d49a6a', '#8d5524', '#4a2c17'] },
  { key: 'hair',   label: 'Hair',   type: 'swatch', options: ['#3a2a1d', '#c8732e', '#ecd27a', '#141414'] },
  { key: 'outfit', label: 'Outfit', type: 'choice', options: ['1', '2', '3', '4'] },
];

// Which avatars expose customization → the folder slug their variant files
// live under, plus the `base` recipe: the index on each axis that matches
// how the character is *already drawn* in their base art. The picker starts
// on `base` so the selected swatches mirror reality, and the combo equal to
// `base` can be omitted from the art set — it falls back to the existing
// base image automatically (so `base` ≠ all-zeros is fine and not redundant).
// Pilot ships Sprout only.
export const VARIANT_CHARACTERS = {
  'starter-01': { slug: 'sprout', base: { skin: 0, hair: 2, outfit: 0 } }, // light skin, blonde hair, look 1
};

export const isCustomizable = (avatarId) => Boolean(VARIANT_CHARACTERS[avatarId]);

// The as-drawn recipe for a character (neutral all-zeros for anything that
// doesn't declare one). Used as the starting point when a character is
// chosen, so switching avatars always shows that avatar's own default look.
export function baseRecipe(avatarId) {
  return VARIANT_CHARACTERS[avatarId]?.base ?? { skin: 0, hair: 0, outfit: 0 };
}

// Build the strict variant path for a recipe. Returns null for avatars
// that aren't customizable.
export function variantSrc(avatarId, variant = {}) {
  const cfg = VARIANT_CHARACTERS[avatarId];
  if (!cfg) return null;
  const { skin = 0, hair = 0, outfit = 0 } = variant;
  return asset(`adventure/avatars/starter-set/${cfg.slug}/${cfg.slug}-s${skin}-h${hair}-o${outfit}.webp`);
}

// Resolve the image sources for a full selection. `variant` is the recipe
// src to try first (null when not customizable); `base` is the always-safe
// fallback the <img> drops to onError until real variant art exists.
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
