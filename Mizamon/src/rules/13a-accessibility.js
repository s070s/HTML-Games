// ---- Accessibility options (MZ-A11Y-01; reference section 12) ------------------------------------------------------------
const SCREEN_W = 240;
const SCREEN_H = 160;
const TOUCH_SIDE_WIDTH = 160; // CSS px a landscape button pad needs (the d-pad is 152 px wide)
// Large text: 0 off, 1 large, 2 largest. The text being read is shown again in big letters in a bar under the picture; the factor is
// the size of that text against the text of the picture itself (8 logical px times the picture scale).
const LARGE_TEXT_FACTORS = [0, 1.4, 1.9];
const CAPTION_MIN_FONT = 12; // CSS px
const CAPTION_MIN_HEIGHT = 56; // CSS px
const CAPTION_MAX_HEIGHT = 260;
// The room the bar needs so that the longest page of text (a dialog page is three lines of about 40 characters) fits at the smallest letters:
// the letters are taken as 0.6 em wide on average and the lines are 1.25 em apart (the style sheet), with 10 px of padding and border.
const CAPTION_LONGEST_PAGE = 130; // characters
function captionHeightFor(cssW) {
  const perLine = Math.max(1, Math.floor((cssW - 20) / (0.6 * CAPTION_MIN_FONT)));
  const lines = Math.ceil(CAPTION_LONGEST_PAGE / perLine);
  return Math.min(CAPTION_MAX_HEIGHT, Math.max(CAPTION_MIN_HEIGHT, Math.ceil(lines * CAPTION_MIN_FONT * 1.25 + 10)));
}
// Hold to repeat in menus: level 0 off (one step per press), 1 slow, 2 normal (the values the game had before this option), 3 fast. Frames at 60 per second.
const HOLD_REPEAT_LEVELS = [null, { delay: 36, every: 12 }, { delay: 20, every: 5 }, { delay: 12, every: 3 }];
const HOLD_REPEAT_DEFAULT = 2;
// Touch controls: 0 both hands (a pad on each side), 1 one hand on the right side, 2 one hand on the left side.
const TOUCH_HANDS = 3;
const ONE_HAND_PAD_HEIGHT = 284; // the tallest one-hand layout in portrait (CSS px); the picture leaves this much room under it
const HIT_STEADY_ALPHA = 0.6;
// True on the frames when a held button repeats (the press itself is not counted: it is a press).
function repeatFires(level, heldFrames) {
  const timing = HOLD_REPEAT_LEVELS[level];
  if (!timing) return false;
  return heldFrames > timing.delay && (heldFrames - timing.delay) % timing.every === 0;
}
// A creature that is hit, frame t of its animation: how far it is pushed sideways and how see-through it is. Normally it shakes and blinks (15 times a
// second); Flashes off keeps it still and dims it steadily; Reduced motion leaves it alone.
// The result is one of four frozen objects (nothing is allocated per frame); callers read it and never change it.
const HIT_LOOK_STILL = Object.freeze({ dx: 0, alpha: 1 });
const HIT_LOOK_STEADY = Object.freeze({ dx: 0, alpha: HIT_STEADY_ALPHA });
const HIT_LOOK_SHAKE_RIGHT = Object.freeze({ dx: 3, alpha: 0.4 });
const HIT_LOOK_SHAKE_LEFT = Object.freeze({ dx: -3, alpha: 1 });
function hitLook(t, flashesOff, reduceMotion) {
  if (reduceMotion) return HIT_LOOK_STILL;
  if (flashesOff) return HIT_LOOK_STEADY;
  return (t >> 1) % 2 === 0 ? HIT_LOOK_SHAKE_RIGHT : HIT_LOOK_SHAKE_LEFT;
}
// The evolution screen draws the creature as a white shape from frame 30 to 79: blinking normally, steady with Flashes off, not at all with Reduced motion.
function evolveGlows(frame, flashesOff, reduceMotion) {
  if (reduceMotion || frame <= 30 || frame >= 80) return false;
  return flashesOff ? true : (frame >> 2) % 2 === 0;
}
// A blinking mark is shown on the first half of every 2^(shift+1) frames, or always when steady.
function blinkShows(frame, shift, steady) { return steady || (frame >> shift) % 2 === 0; }
// One 5 x 5 shape for every type, drawn beside its colour. Not one of them is a cross or any other sign of a faith.
const TYPE_MARK_SIZE = 5;
const TYPE_MARKS = {
  pol: ['..#..', '.###.', '#####', '.###.', '..#..'], // diamond
  asf: ['#####', '.###.', '..#..', '.###.', '#####'], // hourglass
  ekk: ['.###.', '#...#', '#...#', '#...#', '.###.'], // ring
  cel: ['..#..', '.###.', '.###.', '#####', '#####'], // triangle
  inf: ['.###.', '#####', '#####', '#####', '.###.'], // disc
  biz: ['#####', '.....', '#####', '.....', '#####'], // three bars
  mem: ['#####', '.###.', '.###.', '..#..', '..#..'], // triangle pointing down
};
// Where the picture, the large-text bar and the touch pads go in a window of viewW x viewH CSS pixels (touch: the button pads are shown).
function screenLayout(viewW, viewH, touch, largeText, touchHand) {
  const portrait = viewH > viewW;
  const captionOn = largeText > 0;
  const padNeed = touch && portrait && touchHand > 0 ? ONE_HAND_PAD_HEIGHT : 0;
  const reservedBottom = touch && portrait ? Math.min(Math.max(Math.round(viewH * 0.4), padNeed), 300) : 0;
  // Landscape with touch: the two button pads stand beside the game, never over it.
  const reservedSides = touch && !portrait ? 2 * TOUCH_SIDE_WIDTH : 0;
  const fit = function (spare) {
    const wanted = Math.min((viewW - reservedSides) / SCREEN_W, (viewH - reservedBottom - spare) / SCREEN_H);
    const scale = Math.max(wanted, 0.5); // a tiny window must still give a drawable canvas
    return scale >= 2 ? Math.floor(scale) : scale; // whole-number scaling when there is room (crisp pixels)
  };
  let scale = fit(captionOn ? CAPTION_MIN_HEIGHT : 0);
  let bar = 0;
  if (captionOn) { // a narrow picture means a narrow bar: more lines, more height, and a bar that grows makes the picture smaller: three rounds settle it
    for (let round = 0; round < 3; round++) {
      bar = captionHeightFor(Math.floor(SCREEN_W * scale));
      const next = fit(bar);
      if (next === scale) break;
      scale = next;
    }
  }
  const cssW = Math.floor(SCREEN_W * scale);
  const cssH = Math.floor(SCREEN_H * scale);
  const captionHeight = captionOn ? Math.max(bar, Math.min(CAPTION_MAX_HEIGHT, viewH - reservedBottom - cssH)) : 0;
  const captionFont = captionOn ? Math.max(CAPTION_MIN_FONT, Math.round(8 * scale * LARGE_TEXT_FACTORS[largeText])) : 0;
  return { portrait: portrait, scale: scale, cssW: cssW, cssH: cssH, reservedBottom: reservedBottom, reservedSides: reservedSides, captionHeight: captionHeight, captionFont: captionFont, padHeight: portrait ? viewH - cssH : viewH };
}
// The one-hand touch layouts: every button within the reach of one thumb. x is the distance from the chosen side of the window to the near edge of
// the button, y the distance from the bottom of the pad, w and h the size (CSS px); font is the size of the letters.
const ONE_HAND_BUTTONS = {
  portrait: {
    right: { x: 8, y: 74, w: 60, h: 60, font: 24 }, down: { x: 72, y: 10, w: 60, h: 60, font: 24 }, up: { x: 72, y: 138, w: 60, h: 60, font: 24 }, left: { x: 136, y: 74, w: 60, h: 60, font: 24 },
    a: { x: 8, y: 206, w: 60, h: 60, font: 26 }, b: { x: 72, y: 206, w: 60, h: 60, font: 24 },
    menu: { x: 140, y: 206, w: 64, h: 34, font: 13 }, map: { x: 140, y: 244, w: 64, h: 34, font: 11 },
  },
  landscape: {
    right: { x: 8, y: 57, w: 46, h: 46, font: 18 }, down: { x: 57, y: 8, w: 46, h: 46, font: 18 }, up: { x: 57, y: 106, w: 46, h: 46, font: 18 }, left: { x: 106, y: 57, w: 46, h: 46, font: 18 },
    a: { x: 8, y: 162, w: 50, h: 50, font: 20 }, b: { x: 62, y: 162, w: 46, h: 46, font: 18 },
    menu: { x: 8, y: 218, w: 70, h: 28, font: 12 }, map: { x: 82, y: 218, w: 70, h: 28, font: 10 },
  },
};
// The rectangles of the one-hand layout (hand 1 right, 2 left) as left/bottom/width/height inside a pad of padWidth CSS px.
// The pad moves to the other side but the arrows keep their order (the left arrow stays left of the right arrow): on the left hand those two specs trade places.
function oneHandRects(portrait, hand, padWidth) {
  const specs = ONE_HAND_BUTTONS[portrait ? 'portrait' : 'landscape'];
  const swappedArrow = { left: 'right', right: 'left' };
  const rects = {};
  for (const name of Object.keys(specs)) {
    const spec = specs[hand === 2 && swappedArrow[name] ? swappedArrow[name] : name];
    rects[name] = { left: hand === 1 ? padWidth - spec.x - spec.w : spec.x, bottom: spec.y, width: spec.w, height: spec.h };
  }
  return rects;
}
function serializeMon(mon) {
  return { sp: mon.sp, lv: mon.lv, xp: mon.xp, hp: mon.hp, moves: mon.moves.slice(), pend: mon.pend.slice() };
}
function restoreMon(raw) {
  if (!raw || !SPECIES[raw.sp]) return null;
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(raw.lv) || 1)));
  const mon = makeMon(raw.sp, lv);
  if (Number.isFinite(raw.xp)) mon.xp = Math.max(xpForLevel(lv), raw.xp);
  if (Array.isArray(raw.moves)) {
    const moves = raw.moves.filter(function (id) { return MOVES[id]; }).slice(0, MOVES_MAX);
    if (moves.length > 0) mon.moves = moves;
  }
  if (Array.isArray(raw.pend)) mon.pend = raw.pend.filter(function (id) { return MOVES[id]; });
  if (Number.isFinite(raw.hp)) mon.hp = Math.max(0, Math.min(maxHp(mon), Math.floor(raw.hp)));
  return mon;
}
// A version 0 save is the shape of the first prototype: flat fields, "team" and "items".
function migrateV0(old) {
  const bag = {};
  for (const id of Object.keys(old.items || {})) if (ITEMS[id]) bag[id] = Math.max(0, Math.floor(Number(old.items[id]) || 0));
  const seen = {};
  const got = {};
  for (const id of old.seen || []) seen[id] = true;
  for (const id of old.got || []) { got[id] = true; seen[id] = true; }
  // The first prototype had no story flags. Rebuild the ones that can be told from the data:
  // a creature on the team means the starter was chosen; a player outside the lab has met the
  // rival (the meeting happens on the doorstep when leaving the lab).
  const flags = {};
  const team = Array.isArray(old.team) ? old.team : [];
  if (team.length > 0) flags.gotStarter = true;
  if (team.length > 0 && MAPS[old.map] && old.map !== START_MAP.map) { flags.rival1 = true; flags.t_rival1 = true; }
  return {
    version: 1,
    player: { name: String(old.name || 'ΝΙΚΟΣ').slice(0, NAME_MAX), gender: old.girl ? 'f' : 'm', map: old.map, x: old.x, y: old.y, dir: 'down' },
    party: (old.team || []).map(function (member) { return { sp: member.id, lv: member.lv, xp: member.xp, hp: member.hp }; }),
    money: old.drachmas, bag: bag, dex: { seen: seen, got: got }, flags: flags, lastHeal: null, options: null, rngState: 12345, starter: old.starter,
  };
}
// Returns a clean current-version save object (version 3), or null when the data is unusable or from a newer game.
// Version 0 goes through migrateV0 (to the version-1 shape) first. Version 1 had no archive and healed at the ΚΕΠ:
// the archive starts empty and a heal spot on the kep map becomes the hospital spot. Version 2 had no world part
// (the map screen): it is rebuilt from the flags and the position (worldFromOldSave).
function migrateSave(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let save = raw;
  const version = typeof raw.version === 'number' ? raw.version : (typeof raw.v === 'number' ? raw.v : 0);
  if (version > SAVE_VERSION) return null;
  if (version < 1) save = migrateV0(raw);
  const party = (Array.isArray(save.party) ? save.party : []).map(restoreMon).filter(Boolean).slice(0, PARTY_MAX);
  if (party.length === 0) return null;
  const archive = (Array.isArray(save.archive) ? save.archive : []).map(restoreMon).filter(Boolean).slice(0, ARCHIVE_MAX);
  const player = save.player || {};
  const startMap = MAPS[player.map] ? player.map : START_MAP.map;
  const map = MAPS[startMap];
  const walkable = !!MAPS[player.map] && tileWalkable(map, player.x, player.y, save.flags || {});
  // A version-1 save standing on the lot the hospital now covers goes to the pavement in front of its door, not to the lab.
  const hospitalDoor = MAPS.town.warps.find((warp) => warp.to === 'hospital');
  const onHospitalLot = version < 2 && player.map === 'town' && !walkable;
  const useStart = !walkable && !onHospitalLot;
  const bag = {};
  for (const id of ITEM_IDS) bag[id] = Math.max(0, Math.floor(Number((save.bag || {})[id]) || 0));
  const dex = { seen: {}, got: {} };
  const owned = {}; // creatures on the team or in the archive always count as recruited
  for (const mon of party.concat(archive)) owned[mon.sp] = true;
  for (const id of DEX_ORDER) {
    if (save.dex && save.dex.seen && save.dex.seen[id]) dex.seen[id] = true;
    if ((save.dex && save.dex.got && save.dex.got[id]) || owned[id]) { dex.got[id] = true; dex.seen[id] = true; }
  }
  const oldKepSpot = !!save.lastHeal && save.lastHeal.map === 'kep';
  const heal = save.lastHeal && MAPS[save.lastHeal.map] && !oldKepSpot ? save.lastHeal : DEFAULT_HEAL_SPOT;
  const flags = (save.flags && typeof save.flags === 'object') ? Object.assign({}, save.flags) : {};
  const finalMap = useStart ? START_MAP.map : player.map;
  // what the flags and the position tell is always added, so a damaged or missing world part does not lose walked routes
  const world = version >= 3 ? normalizeWorld(save.world) : newWorldState();
  const fromFlags = worldFromOldSave(finalMap, flags);
  for (const part of Object.keys(fromFlags)) Object.assign(world[part], fromFlags[part]);
  worldVisit(world, finalMap, flags);
  return {
    version: SAVE_VERSION,
    player: {
      name: String(player.name || 'ΝΙΚΟΣ').slice(0, NAME_MAX), gender: player.gender === 'f' ? 'f' : 'm',
      map: finalMap, x: useStart ? START_MAP.x : (onHospitalLot ? hospitalDoor.x : player.x), y: useStart ? START_MAP.y : (onHospitalLot ? hospitalDoor.y + 1 : player.y),
      dir: onHospitalLot ? 'down' : (['up', 'down', 'left', 'right'].includes(player.dir) ? player.dir : 'down'),
    },
    party: party.map(serializeMon),
    archive: archive.map(serializeMon),
    money: Math.max(0, Math.floor(Number(save.money) || 0)),
    bag: bag, dex: dex, flags: flags, world: world,
    lastHeal: { map: heal.map, x: heal.x, y: heal.y, dir: heal.dir || 'up' },
    options: normalizeOptions(save.options),
    rngState: Number.isFinite(save.rngState) ? save.rngState >>> 0 : 12345,
    starter: STARTERS.includes(save.starter) ? save.starter : party[0].sp,
  };
}

