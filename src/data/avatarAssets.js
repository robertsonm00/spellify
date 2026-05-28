// Avatar piece manifest.
//
// Every piece is listed once here so the builder UI, the in-game avatar
// renderer, and any future "preview this on my avatar" surfaces all
// read from the same source.
//
// ── Canvas contract ─────────────────────────────────────────────────
//   All sprites are authored on a 512 × 640 px transparent canvas.
//   The figure's feet are centred at (256, 600). The buddy sits to the
//   right of the figure with its feet on the same ground line.
//
//   Stacking order (back → front) is set by LAYER_ORDER below. Each
//   layer image fills the whole canvas; only the layer's piece is
//   opaque. The page renders pieces as absolutely-positioned <img>
//   elements on top of each other, so swapping any one layer (e.g.
//   replacing the hair PNG) doesn't touch the others.
//
// ── Asset paths ─────────────────────────────────────────────────────
//   `src` is resolved relative to `process.env.PUBLIC_URL` so the path
//   "avatar/hair/curly-puffs.png" maps to /public/avatar/hair/...
//
//   When `src` is omitted the renderer falls back to the emoji glyph /
//   colour swatch so the page is usable while the art library is being
//   built up. Drop a PNG into the right folder, add its `src` here,
//   and the next reload picks it up.

const PUBLIC = process.env.PUBLIC_URL || '';
const asset = (path) => `${PUBLIC}/${path}`;

export const CANVAS_WIDTH  = 512;
export const CANVAS_HEIGHT = 640;
export const FEET_ANCHOR   = { x: 256, y: 600 };

// Render order, back → front. The builder iterates this array when
// composing the preview, so adding a new layer (e.g. "cape") is a
// one-line edit.
export const LAYER_ORDER = [
  'background',
  'buddy',
  'bottom',
  'top',
  'skin',
  'hairBack',   // reserved — long hair that falls behind the shoulders
  'hairFront',
  'face',
  'expression',
  'accessory',
];

// ── Backgrounds ─────────────────────────────────────────────────────
export const BACKGROUNDS = [
  { id: 'meadow',    label: 'Meadow',    emoji: '🌳', src: asset('avatar/backgrounds/meadow.png') },
  { id: 'castle',    label: 'Castle',    emoji: '🏰', lumens: 100,  src: asset('avatar/backgrounds/castle.png') },
  { id: 'space',     label: 'Galaxy',    emoji: '🌌', lumens: 200,  src: asset('avatar/backgrounds/space.png') },
  { id: 'underwater',label: 'Reef',      emoji: '🐠', lumens: 200,  src: asset('avatar/backgrounds/underwater.png') },
];

// ── Skin tones ──────────────────────────────────────────────────────
// `color` is the swatch shown in the picker. `src` is a pre-coloured
// silhouette PNG when available; without it the renderer falls back
// to a circular CSS shape filled with `color`.
export const SKIN_TONES = [
  { id: 'tone-1', color: '#f6d2b3', src: asset('avatar/skin/tone-1.png') },
  { id: 'tone-2', color: '#e9b890', src: asset('avatar/skin/tone-2.png') },
  { id: 'tone-3', color: '#d59870', src: asset('avatar/skin/tone-3.png') },
  { id: 'tone-4', color: '#b87b51', src: asset('avatar/skin/tone-4.png') },
  { id: 'tone-5', color: '#8b5a36', src: asset('avatar/skin/tone-5.png') },
  { id: 'tone-6', color: '#5a3a22', src: asset('avatar/skin/tone-6.png') },
];

// ── Hairstyles ──────────────────────────────────────────────────────
// Each hairstyle ideally ships with two layers — `srcBack` (the part
// that sits behind the head/shoulders) and `srcFront` (the part on top
// of the head). For short hair `srcBack` can be omitted.
//
// Colour: hair is recoloured by combining the chosen `HAIR_COLORS`
// entry with the hair layer. If the hair PNGs are already coloured,
// ship one file per (style × colour) combination — easiest path. The
// builder doesn't care which approach you take; it just looks up
// `src` (or falls back to the emoji).
export const HAIRSTYLES = [
  { id: 'curly-puffs',  label: 'Curly Puffs', emoji: '🧒', srcFront: asset('avatar/hair/curly-puffs.png') },
  { id: 'short-spike',  label: 'Short Spike', emoji: '👦', srcFront: asset('avatar/hair/short-spike.png') },
  { id: 'bob',          label: 'Bob',         emoji: '👧', srcFront: asset('avatar/hair/bob.png') },
  { id: 'long-wavy',    label: 'Long Wavy',   emoji: '👩', srcFront: asset('avatar/hair/long-wavy.png'),    srcBack: asset('avatar/hair/long-wavy-back.png') },
  { id: 'side-sweep',   label: 'Side Sweep',  emoji: '🧑', srcFront: asset('avatar/hair/side-sweep.png') },
  { id: 'long-sleek',   label: 'Long Sleek',  emoji: '👱', srcFront: asset('avatar/hair/long-sleek.png'),   srcBack: asset('avatar/hair/long-sleek-back.png') },
  { id: 'pixie',        label: 'Pixie',       emoji: '💇', srcFront: asset('avatar/hair/pixie.png') },
  { id: 'braids',       label: 'Braids',      emoji: '👩‍🦱', lumens: 75,  srcFront: asset('avatar/hair/braids.png'),       srcBack: asset('avatar/hair/braids-back.png') },
  { id: 'afro',         label: 'Afro',        emoji: '🧑‍🦱', lumens: 75,  srcFront: asset('avatar/hair/afro.png') },
  { id: 'buzz',         label: 'Buzz',        emoji: '🧑‍🦲', lumens: 100, srcFront: asset('avatar/hair/buzz.png') },
  { id: 'mohawk',       label: 'Mohawk',      emoji: '🤘',   lumens: 150, srcFront: asset('avatar/hair/mohawk.png') },
  { id: 'rainbow',      label: 'Rainbow',     emoji: '🌈',   lumens: 200, srcFront: asset('avatar/hair/rainbow.png') },
];

export const HAIR_COLORS = [
  { id: 'brown',     label: 'Brown',      color: '#7a4a26' },
  { id: 'darkBrown', label: 'Dark Brown', color: '#3e2412' },
  { id: 'sandy',     label: 'Sandy',      color: '#c9a26a' },
  { id: 'black',     label: 'Black',      color: '#1a1a1a' },
  { id: 'red',       label: 'Red',        color: '#d94d2a' },
  { id: 'purple',    label: 'Purple',     color: '#9f5bd8', lumens: 50 },
  { id: 'blue',      label: 'Blue',       color: '#3d6cd9', lumens: 50 },
  { id: 'teal',      label: 'Teal',       color: '#2ea3a3', lumens: 75 },
  { id: 'blonde',    label: 'Blonde',     color: '#e6c98a' },
  { id: 'white',     label: 'Snowy',      color: '#f1ece2', lumens: 100 },
];

// ── Tops, bottoms, accessories, faces ───────────────────────────────
// All follow the same shape: an `id`, a `label`, a swatch/emoji for
// the picker, an optional `src` for the rendered layer PNG, and an
// optional `lumens` lock cost.
export const TOPS = [
  { id: 'green-tee',     label: 'Green Tee',     emoji: '👕', accent: '#65c66c', src: asset('avatar/tops/green-tee.png') },
  { id: 'red-hoodie',    label: 'Red Hoodie',    emoji: '🧥', accent: '#d94d2a', src: asset('avatar/tops/red-hoodie.png') },
  { id: 'pink-tee',      label: 'Pink Tee',      emoji: '👕', accent: '#f9a8d4', src: asset('avatar/tops/pink-tee.png') },
  { id: 'robe-purple',   label: 'Mage Robe',     emoji: '🥋', accent: '#9f5bd8', src: asset('avatar/tops/robe-purple.png') },
  { id: 'yellow-tee',    label: 'Yellow Tee',    emoji: '👕', accent: '#fde68a', src: asset('avatar/tops/yellow-tee.png') },
  { id: 'orange-hoodie', label: 'Orange Hoodie', emoji: '🧥', accent: '#fb923c', src: asset('avatar/tops/orange-hoodie.png') },
  { id: 'green-hoodie',  label: 'Forest Hoodie', emoji: '🧥', accent: '#3f9d4f', src: asset('avatar/tops/green-hoodie.png') },
  { id: 'aviator-jkt',   label: 'Aviator',       emoji: '🧥', accent: '#5c8aaf', lumens: 75,  src: asset('avatar/tops/aviator-jkt.png') },
  { id: 'cloak-purple',  label: 'Star Cloak',    emoji: '🦸', accent: '#6a3aa3', lumens: 100, src: asset('avatar/tops/cloak-purple.png') },
];

export const BOTTOMS = [
  { id: 'shorts-grey',   label: 'Grey Shorts',   emoji: '🩳', accent: '#9aa3ad', src: asset('avatar/bottoms/shorts-grey.png') },
  { id: 'shorts-green',  label: 'Green Shorts',  emoji: '🩳', accent: '#65c66c', src: asset('avatar/bottoms/shorts-green.png') },
  { id: 'jeans',         label: 'Blue Jeans',    emoji: '👖', accent: '#3d6cd9', src: asset('avatar/bottoms/jeans.png') },
  { id: 'pants-purple',  label: 'Purple Pants',  emoji: '👖', accent: '#9f5bd8', src: asset('avatar/bottoms/pants-purple.png') },
  { id: 'pants-brown',   label: 'Brown Pants',   emoji: '👖', accent: '#7a4a26', src: asset('avatar/bottoms/pants-brown.png') },
  { id: 'shorts-blue',   label: 'Blue Shorts',   emoji: '🩳', accent: '#5c8aaf', src: asset('avatar/bottoms/shorts-blue.png') },
  { id: 'skirt-pink',    label: 'Pink Skirt',    emoji: '👗', accent: '#f9a8d4', lumens: 50,  src: asset('avatar/bottoms/skirt-pink.png') },
  { id: 'pants-rainbow', label: 'Rainbow Pants', emoji: '🌈', accent: '#c77dff', lumens: 150, src: asset('avatar/bottoms/pants-rainbow.png') },
];

export const ACCESSORIES = [
  { id: 'none',       label: 'None',        emoji: '✖' },
  { id: 'glasses',    label: 'Glasses',     emoji: '👓', src: asset('avatar/accessories/glasses.png') },
  { id: 'headphones', label: 'Headphones',  emoji: '🎧', src: asset('avatar/accessories/headphones.png') },
  { id: 'wizard-hat', label: 'Wizard Hat',  emoji: '🎩', src: asset('avatar/accessories/wizard-hat.png') },
  { id: 'cap',        label: 'Cap',         emoji: '🧢', src: asset('avatar/accessories/cap.png') },
  { id: 'flower',     label: 'Flower',      emoji: '🌸', src: asset('avatar/accessories/flower.png') },
  { id: 'crown',      label: 'Crown',       emoji: '👑', lumens: 100, src: asset('avatar/accessories/crown.png') },
  { id: 'backpack',   label: 'Backpack',    emoji: '🎒', src: asset('avatar/accessories/backpack.png') },
  { id: 'goggles',    label: 'Goggles',     emoji: '🥽', lumens: 50,  src: asset('avatar/accessories/goggles.png') },
  { id: 'bear-hood',  label: 'Bear Hood',   emoji: '🐻', lumens: 75,  src: asset('avatar/accessories/bear-hood.png') },
  { id: 'spellbook',  label: 'Spellbook',   emoji: '📖', lumens: 100, src: asset('avatar/accessories/spellbook.png') },
  { id: 'wand',       label: 'Magic Wand',  emoji: '🪄', lumens: 150, src: asset('avatar/accessories/wand.png') },
];

export const FACES = [
  { id: 'smile',   label: 'Smile',   emoji: '🙂', src: asset('avatar/faces/smile.png') },
  { id: 'grin',    label: 'Grin',    emoji: '😄', src: asset('avatar/faces/grin.png') },
  { id: 'wink',    label: 'Wink',    emoji: '😉', src: asset('avatar/faces/wink.png') },
  { id: 'cool',    label: 'Cool',    emoji: '😎', src: asset('avatar/faces/cool.png') },
  { id: 'star',    label: 'Star',    emoji: '🤩', src: asset('avatar/faces/star.png') },
  { id: 'heart',   label: 'Heart',   emoji: '🥰', lumens: 50, src: asset('avatar/faces/heart.png') },
  { id: 'tongue',  label: 'Tongue',  emoji: '😛', lumens: 50, src: asset('avatar/faces/tongue.png') },
  { id: 'thinker', label: 'Thinker', emoji: '🤔', lumens: 75, src: asset('avatar/faces/thinker.png') },
];

export const EXPRESSIONS = [
  { id: 'happy',   label: 'Happy',   emoji: '🙂', src: asset('avatar/expressions/happy.png') },
  { id: 'grin',    label: 'Grin',    emoji: '😄', src: asset('avatar/expressions/grin.png') },
  { id: 'focused', label: 'Focused', emoji: '😌', src: asset('avatar/expressions/focused.png') },
  { id: 'cool',    label: 'Cool',    emoji: '😎', src: asset('avatar/expressions/cool.png') },
  { id: 'gentle',  label: 'Gentle',  emoji: '☺',  src: asset('avatar/expressions/gentle.png') },
  { id: 'brave',   label: 'Brave',   emoji: '😤', src: asset('avatar/expressions/brave.png') },
  { id: 'wise',    label: 'Wise',    emoji: '🧐', src: asset('avatar/expressions/wise.png') },
  { id: 'wink',    label: 'Wink',    emoji: '😉', src: asset('avatar/expressions/wink.png') },
  { id: 'sparkle', label: 'Sparkle', emoji: '🤩', lumens: 50, src: asset('avatar/expressions/sparkle.png') },
  { id: 'love',    label: 'Love',    emoji: '🥰', lumens: 50, src: asset('avatar/expressions/love.png') },
];

// ── Buddies ─────────────────────────────────────────────────────────
// Buddy art occupies the same 512×640 canvas — drawn standing/sitting
// at roughly (380, 600) so it sits to the right of the character's
// feet. Picker tiles use the emoji as a fallback chip.
export const BUDDIES = [
  { id: 'raccoon',   label: 'Raccoon',   emoji: '🦝', src: asset('avatar/buddies/raccoon.png') },
  { id: 'alpaca',    label: 'Alpaca',    emoji: '🦙', src: asset('avatar/buddies/alpaca.png') },
  { id: 'hedgehog',  label: 'Hedgehog',  emoji: '🦔', src: asset('avatar/buddies/hedgehog.png') },
  { id: 'owl',       label: 'Owl',       emoji: '🦉', src: asset('avatar/buddies/owl.png') },
  { id: 'red-panda', label: 'Red Panda', emoji: '🐼', lumens: 100, src: asset('avatar/buddies/red-panda.png') },
  { id: 'fox',       label: 'Fox',       emoji: '🦊', lumens: 100, src: asset('avatar/buddies/fox.png') },
  { id: 'dragon',    label: 'Dragon',    emoji: '🐉', lumens: 250, src: asset('avatar/buddies/dragon.png') },
  { id: 'unicorn',   label: 'Unicorn',   emoji: '🦄', lumens: 250, src: asset('avatar/buddies/unicorn.png') },
];

// ── Starter style presets ───────────────────────────────────────────
// Each starter sets every piece in one go. New starters added here
// pick up automatically in the picker row.
export const STARTER_STYLES = [
  { id: 'explorer',        label: 'Explorer',        emoji: '🧒', accent: '#86efac',
    preset: { background: 'meadow', skin: 'tone-3', hair: 'curly-puffs', hairColor: 'brown',  top: 'green-tee',    bottom: 'shorts-grey',  accessory: 'backpack',   face: 'smile', expression: 'happy',   buddy: 'raccoon' } },
  { id: 'mini-mage',       label: 'Mini Mage',       emoji: '🧙', accent: '#c77dff',
    preset: { background: 'meadow', skin: 'tone-2', hair: 'long-wavy',   hairColor: 'purple', top: 'robe-purple',  bottom: 'pants-purple', accessory: 'wizard-hat', face: 'smile', expression: 'focused', buddy: 'owl'     } },
  { id: 'arcade-hero',     label: 'Arcade Hero',     emoji: '🎮', accent: '#fca5a5',
    preset: { background: 'meadow', skin: 'tone-4', hair: 'short-spike', hairColor: 'black',  top: 'red-hoodie',   bottom: 'jeans',        accessory: 'headphones', face: 'cool',  expression: 'cool',    buddy: 'fox'     } },
  { id: 'woodland-friend', label: 'Woodland Friend', emoji: '🦊', accent: '#bef264',
    preset: { background: 'meadow', skin: 'tone-2', hair: 'bob',         hairColor: 'brown',  top: 'green-hoodie', bottom: 'pants-brown',  accessory: 'bear-hood',  face: 'smile', expression: 'gentle',  buddy: 'hedgehog'} },
  { id: 'sky-adventurer',  label: 'Sky Adventurer',  emoji: '🪂', accent: '#a5f3fc',
    preset: { background: 'meadow', skin: 'tone-2', hair: 'side-sweep',  hairColor: 'blonde', top: 'aviator-jkt',  bottom: 'jeans',        accessory: 'goggles',    face: 'grin',  expression: 'brave',   buddy: 'alpaca'  } },
  { id: 'spell-keeper',    label: 'Spell Keeper',    emoji: '📖', accent: '#fde68a',
    preset: { background: 'meadow', skin: 'tone-1', hair: 'long-sleek',  hairColor: 'blonde', top: 'cloak-purple', bottom: 'pants-purple', accessory: 'spellbook',  face: 'smile', expression: 'wise',    buddy: 'owl'     } },
];

// Default avatar — used on first visit and as the Reset target.
export const DEFAULT_AVATAR = {
  starter:    'explorer',
  background: 'meadow',
  skin:       'tone-3',
  face:       'smile',
  expression: 'happy',
  hair:       'curly-puffs',
  hairColor:  'brown',
  top:        'green-tee',
  bottom:     'shorts-grey',
  accessory:  'backpack',
  buddy:      'raccoon',
};

// Helpers ────────────────────────────────────────────────────────────
export const findById = (list, id) => list.find((x) => x.id === id) || list[0];
