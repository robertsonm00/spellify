// AvatarBuilder — single-panel "Customize Your Avatar" screen.
//
// One dark background. Big avatar preview on the left, a tab bar +
// options pane on the right. Each option cell renders the FULL avatar
// at thumbnail size with that one slot swapped in, so the child sees
// what they'd look like with that hair / top / etc. before committing.
//
// All piece data lives in src/data/avatarAssets.js. The page falls
// back to emoji-composed sprites when PNGs are missing so the screen
// stays usable while the art library is being built up.

import React, { useEffect, useMemo, useState } from 'react';
import './AvatarBuilder.css';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  LAYER_ORDER,
  BACKGROUNDS,
  SKIN_TONES,
  HAIRSTYLES,
  HAIR_COLORS,
  TOPS,
  BOTTOMS,
  ACCESSORIES,
  FACES,
  EXPRESSIONS,
  BUDDIES,
  STARTER_STYLES,
  DEFAULT_AVATAR,
  findById,
} from '../data/avatarAssets';

const TABS = [
  { id: 'face',        label: 'Face',        icon: '😊' },
  { id: 'hair',        label: 'Hair',        icon: '💇' },
  { id: 'clothes',     label: 'Clothes',     icon: '👕' },
  { id: 'accessories', label: 'Accessories', icon: '⭐' },
  { id: 'color',       label: 'Color',       icon: '🎨' },
  { id: 'buddy',       label: 'Buddy',       icon: '🦝' },
];

const STORAGE_KEY = 'spellify_avatar';

function loadAvatar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AVATAR;
    return { ...DEFAULT_AVATAR, ...JSON.parse(raw) };
  } catch { return DEFAULT_AVATAR; }
}
function saveAvatar(a) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); } catch { /* ignore */ }
}
function loadUnlocks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + '_unlocks');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveUnlocks(u) {
  try { localStorage.setItem(STORAGE_KEY + '_unlocks', JSON.stringify(u)); } catch { /* ignore */ }
}
function randomFrom(arr, unlocks, key) {
  const avail = arr.filter((o) => !o.lumens || unlocks[`${key}:${o.id}`]);
  return avail[Math.floor(Math.random() * avail.length)]?.id;
}

// ── Avatar canvas (layered <img> composition) ───────────────────────
// `override` lets a parent ask for "this avatar but with `hair`
// swapped to X" — used by the picker cells to render thumbnail
// previews of each option.

function AvatarCanvas({ avatar, override, small }) {
  const merged = override ? { ...avatar, ...override } : avatar;
  const bg     = findById(BACKGROUNDS,  merged.background);
  const skin   = findById(SKIN_TONES,   merged.skin);
  const hair   = findById(HAIRSTYLES,   merged.hair);
  const hairCol= findById(HAIR_COLORS,  merged.hairColor);
  const top    = findById(TOPS,         merged.top);
  const bottom = findById(BOTTOMS,      merged.bottom);
  const acc    = findById(ACCESSORIES,  merged.accessory);
  const face   = findById(FACES,        merged.face);
  const exp    = findById(EXPRESSIONS,  merged.expression);
  const buddy  = findById(BUDDIES,      merged.buddy);

  const layerFor = (key) => {
    switch (key) {
      case 'background': return { src: bg.src,        fallback: <FallbackBackground /> };
      case 'buddy':      return { src: buddy.src,     fallback: <FallbackBuddy buddy={buddy} /> };
      case 'bottom':     return { src: bottom.src,    fallback: <FallbackBottom bottom={bottom} /> };
      case 'top':        return { src: top.src,       fallback: <FallbackTop top={top} /> };
      case 'skin':       return { src: skin.src,      fallback: <FallbackHead skin={skin} /> };
      case 'hairBack':   return { src: hair.srcBack,  fallback: null };
      case 'hairFront':  return { src: hair.srcFront, fallback: <FallbackHair hair={hair} color={hairCol} /> };
      case 'face':       return { src: face.src,      fallback: null };
      case 'expression': return { src: exp.src,       fallback: <FallbackFace expression={exp} face={face} /> };
      case 'accessory':  return acc.id === 'none'
        ? { src: null, fallback: null }
        : { src: acc.src, fallback: <FallbackAccessory accessory={acc} /> };
      default: return { src: null, fallback: null };
    }
  };

  return (
    <div
      className={`av-canvas${small ? ' av-canvas--small' : ''}`}
      style={{
        aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
        '--hair-color': hairCol.color,
        '--skin-color': skin.color,
        '--top-accent': top.accent,
        '--bot-accent': bottom.accent,
      }}
    >
      {LAYER_ORDER.map((key) => {
        const { src, fallback } = layerFor(key);
        if (!src && !fallback) return null;
        return (
          <div key={key} className={`av-layer av-layer--${key}`}>
            {src && (
              <img
                src={src}
                alt=""
                className="av-layer__img"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                draggable={false}
              />
            )}
            {fallback}
          </div>
        );
      })}
    </div>
  );
}

// ── Fallback layer renderers (active only when a PNG is missing) ────

function FallbackBackground() {
  return (
    <div className="av-fb-bg">
      <div className="av-fb-sky" />
      <div className="av-fb-ground" />
    </div>
  );
}
function FallbackHead({ skin }) {
  return <div className="av-fb-head" style={{ background: skin.color }} aria-hidden="true" />;
}
function FallbackHair({ hair, color }) {
  return (
    <div className="av-fb-hair" style={{ background: color.color }}>
      <span className="av-fb-hair-glyph">{hair.emoji}</span>
    </div>
  );
}
function FallbackFace({ expression, face }) {
  return (
    <div className="av-fb-face">
      <span>{expression?.emoji || face?.emoji || '🙂'}</span>
    </div>
  );
}
function FallbackTop({ top }) {
  return (
    <div className="av-fb-top" style={{ background: top.accent }}>
      <span className="av-fb-top-glyph">{top.emoji}</span>
    </div>
  );
}
function FallbackBottom({ bottom }) {
  return (
    <div className="av-fb-bottom" style={{ background: bottom.accent }}>
      <span className="av-fb-bot-glyph">{bottom.emoji}</span>
    </div>
  );
}
function FallbackAccessory({ accessory }) {
  return (
    <div className="av-fb-accessory" title={accessory.label}>
      <span>{accessory.emoji}</span>
    </div>
  );
}
function FallbackBuddy({ buddy }) {
  return (
    <div className="av-fb-buddy" title={buddy.label}>
      <span>{buddy.emoji}</span>
    </div>
  );
}

// ── Option grids ────────────────────────────────────────────────────
//
// `previewSlot` switches the cell from a flat glyph to a mini avatar
// thumbnail where this option is swapped in. So on the Hair tab every
// cell shows YOUR avatar with that hair, not just an isolated hair
// piece — matches the reference mock.

function OptionGrid({
  items, selectedId, onSelect,
  unlocks, unlockKey,
  swatch = false,
  previewSlot = null,   // e.g. 'hair' → cell renders avatar with hair: item.id
  baseAvatar = null,
}) {
  return (
    <div className={`av-grid${previewSlot ? ' av-grid--preview' : ''}${swatch ? ' av-grid--swatch' : ''}`}>
      {items.map((item) => {
        const locked   = !!item.lumens && !unlocks[`${unlockKey}:${item.id}`];
        const selected = item.id === selectedId;
        return (
          <button
            key={item.id}
            type="button"
            className={`av-cell${selected ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`}
            onClick={() => onSelect(item, locked)}
            aria-pressed={selected}
            aria-label={item.label || item.id}
            title={item.label || item.id}
          >
            {previewSlot && baseAvatar ? (
              <div className="av-cell__preview">
                <AvatarCanvas
                  avatar={baseAvatar}
                  override={{ [previewSlot]: item.id }}
                  small
                />
              </div>
            ) : swatch ? (
              <span className="av-cell__swatch" style={{ background: item.color }} />
            ) : (
              <span className="av-cell__glyph">{item.emoji}</span>
            )}
            {locked && (
              <span className="av-cell__lock" aria-hidden="true">
                <span>🔒</span><span>✦{item.lumens}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────

export default function AvatarBuilder({ lumens = 0 }) {
  const [avatar,  setAvatar]    = useState(loadAvatar);
  const [unlocks, setUnlocks]   = useState(loadUnlocks);
  const [tab,     setTab]       = useState('hair');
  const [history, setHistory]   = useState([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [startersOpen, setStartersOpen] = useState(false);

  useEffect(() => { saveAvatar(avatar); },  [avatar]);
  useEffect(() => { saveUnlocks(unlocks); },[unlocks]);

  const updateAvatar = (patch) => {
    setHistory((h) => [...h, avatar]);
    setAvatar((prev) => ({ ...prev, ...patch }));
  };

  const handleStarter = (s) => {
    updateAvatar({ starter: s.id, ...s.preset });
    setStartersOpen(false);
  };

  const handleOptionPick = (kind, item, locked) => {
    if (locked) {
      const ok = window.confirm(
        `Unlock "${item.label || item.id}" for ✦${item.lumens} lumens?\n\n(Lumens spending isn't wired up yet — this just unlocks the item locally so you can preview it.)`
      );
      if (!ok) return;
      setUnlocks((u) => ({ ...u, [`${kind}:${item.id}`]: true }));
    }
    updateAvatar({ [kind]: item.id });
  };

  const handleUndo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const next = [...h];
      const prev = next.pop();
      setAvatar(prev);
      return next;
    });
  };

  const handleRandomize = () => {
    updateAvatar({
      skin:       randomFrom(SKIN_TONES,   unlocks, 'skin'),
      face:       randomFrom(FACES,        unlocks, 'face'),
      hair:       randomFrom(HAIRSTYLES,   unlocks, 'hair'),
      hairColor:  randomFrom(HAIR_COLORS,  unlocks, 'hairColor'),
      top:        randomFrom(TOPS,         unlocks, 'top'),
      bottom:     randomFrom(BOTTOMS,      unlocks, 'bottom'),
      accessory:  randomFrom(ACCESSORIES,  unlocks, 'accessory'),
      expression: randomFrom(EXPRESSIONS,  unlocks, 'expression'),
    });
  };

  const handleReset = () => {
    if (!window.confirm('Reset your avatar to the default look?')) return;
    setHistory((h) => [...h, avatar]);
    setAvatar(DEFAULT_AVATAR);
  };

  const handleSave = () => {
    saveAvatar(avatar);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  };

  // ── Tab bodies — kept tiny. Each is just a section heading + grid. ──
  const tabBody = useMemo(() => {
    const base = avatar;
    switch (tab) {
      case 'face':
        return (
          <>
            <Section title="Expression">
              <OptionGrid items={EXPRESSIONS} selectedId={avatar.expression}
                onSelect={(it,l) => handleOptionPick('expression', it, l)}
                unlocks={unlocks} unlockKey="expression"
                previewSlot="expression" baseAvatar={base} />
            </Section>
            <Section title="Face">
              <OptionGrid items={FACES} selectedId={avatar.face}
                onSelect={(it,l) => handleOptionPick('face', it, l)}
                unlocks={unlocks} unlockKey="face"
                previewSlot="face" baseAvatar={base} />
            </Section>
          </>
        );
      case 'hair':
        return (
          <>
            <Section title="Hairstyle">
              <OptionGrid items={HAIRSTYLES} selectedId={avatar.hair}
                onSelect={(it,l) => handleOptionPick('hair', it, l)}
                unlocks={unlocks} unlockKey="hair"
                previewSlot="hair" baseAvatar={base} />
            </Section>
            <Section title="Hair Color">
              <OptionGrid items={HAIR_COLORS} selectedId={avatar.hairColor}
                onSelect={(it,l) => handleOptionPick('hairColor', it, l)}
                unlocks={unlocks} unlockKey="hairColor" swatch />
            </Section>
          </>
        );
      case 'clothes':
        return (
          <>
            <Section title="Tops">
              <OptionGrid items={TOPS} selectedId={avatar.top}
                onSelect={(it,l) => handleOptionPick('top', it, l)}
                unlocks={unlocks} unlockKey="top"
                previewSlot="top" baseAvatar={base} />
            </Section>
            <Section title="Bottoms">
              <OptionGrid items={BOTTOMS} selectedId={avatar.bottom}
                onSelect={(it,l) => handleOptionPick('bottom', it, l)}
                unlocks={unlocks} unlockKey="bottom"
                previewSlot="bottom" baseAvatar={base} />
            </Section>
          </>
        );
      case 'accessories':
        return (
          <>
            <Section title="Accessories">
              <OptionGrid items={ACCESSORIES} selectedId={avatar.accessory}
                onSelect={(it,l) => handleOptionPick('accessory', it, l)}
                unlocks={unlocks} unlockKey="accessory"
                previewSlot="accessory" baseAvatar={base} />
            </Section>
            <Section title="Background">
              <OptionGrid items={BACKGROUNDS} selectedId={avatar.background}
                onSelect={(it,l) => handleOptionPick('background', it, l)}
                unlocks={unlocks} unlockKey="background"
                previewSlot="background" baseAvatar={base} />
            </Section>
          </>
        );
      case 'color':
        return (
          <>
            <Section title="Skin Tone">
              <OptionGrid items={SKIN_TONES} selectedId={avatar.skin}
                onSelect={(it,l) => handleOptionPick('skin', it, l)}
                unlocks={unlocks} unlockKey="skin" swatch />
            </Section>
            <Section title="Hair Color">
              <OptionGrid items={HAIR_COLORS} selectedId={avatar.hairColor}
                onSelect={(it,l) => handleOptionPick('hairColor', it, l)}
                unlocks={unlocks} unlockKey="hairColor" swatch />
            </Section>
          </>
        );
      case 'buddy':
        return (
          <Section title="Choose your buddy">
            <OptionGrid items={BUDDIES} selectedId={avatar.buddy}
              onSelect={(it,l) => handleOptionPick('buddy', it, l)}
              unlocks={unlocks} unlockKey="buddy"
              previewSlot="buddy" baseAvatar={base} />
          </Section>
        );
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, avatar, unlocks]);

  return (
    <div className="av-page">
      {/* ── Title bar (one line, replaces the old banner + cards) ── */}
      <header className="av-titlebar">
        <button
          type="button"
          className="av-titlebar__starters"
          onClick={() => setStartersOpen((v) => !v)}
          aria-expanded={startersOpen}
        >
          ✨ <span>Quick Start</span>
        </button>

        <h1 className="av-titlebar__title">
          <span aria-hidden="true">★</span>
          Customize Your Avatar
          <span aria-hidden="true">★</span>
        </h1>

        <div className="av-titlebar__lumens" title="Your lumens">
          <span aria-hidden="true">✦</span>
          <span>{lumens.toLocaleString()}</span>
        </div>
      </header>

      {/* ── Quick Start tray (collapsed by default) ── */}
      {startersOpen && (
        <div className="av-starters-tray">
          <p className="av-starters-tray__hint">Pick a starter look — you can still customise everything after.</p>
          <div className="av-starters-tray__row">
            {STARTER_STYLES.map((s) => {
              const active = s.id === avatar.starter;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`av-starter-pill${active ? ' is-active' : ''}`}
                  style={{ '--accent': s.accent }}
                  onClick={() => handleStarter(s)}
                >
                  <span className="av-starter-pill__emoji">{s.emoji}</span>
                  <span className="av-starter-pill__label">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main stage (preview | editor) ── */}
      <div className="av-stage">
        <div className="av-preview-card">
          <AvatarCanvas avatar={avatar} />
        </div>

        <div className="av-editor-card">
          <nav className="av-tabbar" role="tablist">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`av-tabpill${active ? ' is-active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <span className="av-tabpill__icon" aria-hidden="true">{t.icon}</span>
                  <span className="av-tabpill__label">{t.label}</span>
                  {active && <span className="av-tabpill__notch" aria-hidden="true" />}
                </button>
              );
            })}
          </nav>

          <div className="av-editor-body">
            {tabBody}
          </div>

          <div className="av-toolbar">
            <button type="button" className="av-tool" onClick={handleUndo} disabled={history.length === 0}>
              <span aria-hidden="true">↶</span><span>Undo</span>
            </button>
            <button type="button" className="av-tool" onClick={handleRandomize}>
              <span aria-hidden="true">🎲</span><span>Randomize</span>
            </button>
            <button type="button" className="av-tool" onClick={handleReset}>
              <span aria-hidden="true">↺</span><span>Reset</span>
            </button>
            <button
              type="button"
              className={`av-tool av-tool--save${savedFlash ? ' is-flash' : ''}`}
              onClick={handleSave}
            >
              <span aria-hidden="true">✓</span>
              <span>{savedFlash ? 'Saved!' : 'Save Avatar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small subtitle row used between option grids. Pulled out so each
// tab body stays declarative and readable.
function Section({ title, children }) {
  return (
    <section className="av-section">
      <h3 className="av-section__title">{title}</h3>
      {children}
    </section>
  );
}
