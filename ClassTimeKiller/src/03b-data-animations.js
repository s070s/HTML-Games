// ==== S03 DATA: WEAPON ANIMATIONS (P6) ====
// Reload sets (P6-01, Appendix C) and melee strikes (P6-03). Visual only: the renderer reads sim state and plays these rows as
// fractions of the reload or of the melee cycle in progress, so attachments and perks scale them; nothing here changes a
// reload time, a damage time or a recoil value. Built by 07g-render-weapon-anim.js; mapped to weapons by `reloadAnim` /
// `meleeAnim` (03c). Offsets are view-model metres, angles degrees: pose vectors are [x right, y up, z forward, pitch (+ muzzle up),
// yaw (+ left), roll (+ top to the right)]. Part and hand points are in weapon model units (the weapon's own space), not view metres.
//
// Reload set row:
//   partial / empty: [[kind, end fraction], ...] in order; the last is 'raise' and ends at 1 (the refill step). `empty` null = the
//     same phases. kinds: lower, open, out, fetch (reach), in, rack, close, prime, raise.
//   work: the weapon pose during the work phases (x y z = where the magazine well, `about`, else `seat`, is moved to, in metres; then pitch, yaw, roll in degrees:
//     the gun tilts about the well: the muzzle rises and turns in, the back end drops away from the eye); keys { kind: pose } replaces it at the end of that kind.
//   part: the moving part { role (MODEL_ROLES), mode, move, out, turn, lock }: mode 'mag' = leaves in `out` along `move` (a vector, else
//     `out` units away from the gun's middle), is gone while the off-hand fetches the spare (the same part, drawn a second time) and
//     comes back in `in`; 'latch' = swings open in `open` (else lower) and shuts in `close` (else rack); 'pulse' = back and forth in the
//     rack phases (`holdBack`: an empty reload starts with it back). `turn` = [pitch, yaw, roll] when open; `lock` = degrees of roll it
//     twists back through during rack (the drum). A model without the role draws a procedural spare box of size `spare` instead.
//   second: another moving part, same fields. seat / belt / rack: where the off-hand works, fetches from and racks.
//   glow: the weapon's glow parts ramp (20 % partial, 0 % empty) to 100 % in rack / prime. jolt: [y, z] weapon kick at the last
//     rack / close. tp: third person [gun pitch, gun drop m, torso pitch, armL work, armL fetch, armR jerk, armR fetch] degrees.
//   marks: cue fractions [partial, empty] of the reload (0 = none) for the P7 reload cues (11a emits 'weapon.cue' when the reload passes one): out, in, rack, open,
//     close, shellIn, cellCharge are sounds (06b); fx is the particle moment of the set (fxKind, or the weapon's own `reloadFx`): casings (R2: one per spent round),
//     shells (R6: red), eject (R4: the live round at the bolt), vent (W36), flare (W35).
//   fxKind: what the fx mark makes for every weapon of the set ('' = nothing unless the weapon names its own `reloadFx`).
//   shell (R5 only): cycles [[kind, end], ...] and the click fraction, instead of partial / empty.
//   cycle: the motion between shots (W19 pump, W24 bolt), a role and keyframes [fraction of the shot interval, move, turn] (0..1 of the
//     moving part's own `move` and `turn`); only while the weapon is idle and not scoped. `eject` = the fraction of the shot interval at which the cycle
//     ejects (a rack sound and the particle `particle`: 'shells' = a red shell, 'eject' = a live round).
//   bow: a charged draw (W27): the part of `role` moves by `move` (model units) with the charge fraction and the weapon cants `cant` degrees.
const RELOAD_FX_CUE = '@fx';   // the cue name of a set's particle mark in cueMarks
const RELOAD_PHASE_KINDS = ['lower', 'open', 'out', 'fetch', 'in', 'rack', 'close', 'prime', 'raise', 'reach', 'enter', 'insert', 'hold', 'exit', 'port'];
const RELOAD_PART_MODES = ['mag', 'latch', 'pulse'];
const MODEL_ROLES = ['', 'mag', 'slide', 'bolt', 'pump', 'cyl', 'barrel', 'lid', 'cell', 'string', 'arrow'];   // part `role` values (03b MODEL_SCHEMA parts), code = index
const RELOAD_FADE_SWAP = 0.1, RELOAD_FADE_MELEE = 0.05, RELOAD_FADE_FIRE = 0.06;   // render seconds a cancelled reload pose blends out in (P6-04 priority table)
const SWAP_LOWER_SHARE = 0.35;                    // the swap time's share the current weapon lowers in; the pending one rises in the rest (P6-04)

const NO_POSE = [0, 0, 0, 0, 0, 0];
Data.define('reloadAnims', {
  id: REQUIRED, name: REQUIRED, partial: REQUIRED, empty: null, work: NO_POSE, keys: {}, about: null, part: null, second: null, spare: [0.035, 0.09, 0.05],
  seat: [-0.04, -0.07, 0.0], belt: [-0.18, -0.4, -0.05], rack: [-0.03, 0.03, -0.1], glow: false, jolt: [0, 0], tp: {}, marks: {}, fxKind: '', cueMarks: null, shell: null, cycle: null, bow: null, index: 0,
}, [
  { id: 'R1', name: 'Pistol magazine',
    partial: [['lower', 0.12], ['out', 0.28], ['fetch', 0.50], ['in', 0.68], ['raise', 1]],
    empty: [['lower', 0.10], ['out', 0.24], ['fetch', 0.44], ['in', 0.60], ['rack', 0.78], ['raise', 1]],
    work: [-0.04, 0.05, 0, 14, 10, -20], part: { role: 'mag', mode: 'mag', out: 0.2 }, second: { role: 'slide', mode: 'pulse', move: [0, 0, -0.07], holdBack: true },
    seat: [-0.03, -0.07, -0.01], belt: [-0.15, -0.4, -0.1], rack: [-0.03, 0.04, -0.12],
    tp: { gun: -20, armLFetch: -45 }, marks: { out: [0.14, 0.12], in: [0.66, 0.58], rack: [0, 0.76] } },
  { id: 'R2', name: 'Revolver',
    partial: [['lower', 0.10], ['out', 0.30], ['fetch', 0.50], ['in', 0.70], ['rack', 0.82], ['raise', 1]],
    work: [-0.04, 0.05, 0, 12, 10, -15], keys: { out: [-0.04, 0.05, 0, 32, 10, -15], in: [-0.04, 0.05, 0, 0, 10, -10] },
    part: { role: 'cyl', mode: 'latch', move: [-0.07, 0, 0], turn: [0, 0, -25] }, spare: [0.045, 0.05, 0.045],
    seat: [-0.04, -0.02, 0.03], belt: [-0.15, -0.4, -0.1], rack: [-0.04, 0.02, 0.02],
    tp: { gun: 30, armLFetch: -45 }, marks: { out: [0.12, 0.12], in: [0.68, 0.68], rack: [0.80, 0.80], fx: [0.20, 0.20] }, fxKind: 'casings' },
  { id: 'R3', name: 'Long-gun magazine',
    partial: [['lower', 0.12], ['out', 0.30], ['fetch', 0.50], ['in', 0.68], ['raise', 1]],
    empty: [['lower', 0.10], ['out', 0.25], ['fetch', 0.42], ['in', 0.58], ['rack', 0.80], ['raise', 1]],
    work: [-0.05, 0.045, 0, 12, 8, 10], part: { role: 'mag', mode: 'mag', out: 0.22 }, second: { role: 'bolt', mode: 'pulse', move: [0, 0, -0.09] },
    seat: [-0.04, -0.1, 0.06], belt: [-0.18, -0.42, -0.05], rack: [-0.04, 0.03, -0.1], jolt: [0.008, -0.03],
    tp: { gun: -15, gunDrop: -0.05, armLFetch: -40, armRJerk: -15 }, marks: { out: [0.14, 0.12], in: [0.66, 0.56], rack: [0, 0.72] } },
  { id: 'R4', name: 'Bolt and magazine',
    partial: [['lower', 0.10], ['open', 0.20], ['out', 0.34], ['fetch', 0.52], ['in', 0.66], ['close', 0.78], ['raise', 1]],
    work: [-0.05, 0.04, 0, 10, 8, 10], part: { role: 'mag', mode: 'mag', out: 0.2 }, second: { role: 'bolt', mode: 'latch', move: [0, 0.02, -0.1], turn: [0, 0, 60] },
    cycle: { role: 'bolt', keys: [[0, 0, 0], [0.20, 0, 0], [0.35, 0, 1], [0.50, 1, 1], [0.62, 0, 1], [0.72, 0, 0], [1, 0, 0]], eject: 0.45, particle: 'eject' },
    seat: [-0.03, -0.07, 0.0], belt: [-0.16, -0.4, -0.05], rack: [0.03, 0.03, -0.08],
    tp: { gun: -15, armLFetch: -40, armRJerk: -12 }, marks: { open: [0.12, 0.12], out: [0.22, 0.22], in: [0.64, 0.64], close: [0.76, 0.76], fx: [0.15, 0] }, fxKind: 'eject' },
  { id: 'R5', name: 'Shell by shell',
    partial: [['enter', 0.25], ['insert', 0.85], ['hold', 1]], work: [-0.05, 0.04, 0, 10, 8, -20],
    shell: { first: [['enter', 0.25], ['insert', 0.85], ['hold', 1]], middle: [['fetch', 0.35], ['insert', 0.85], ['hold', 1]], last: [['fetch', 0.30], ['insert', 0.65], ['exit', 1]],
      only: [['enter', 0.20], ['insert', 0.60], ['exit', 1]], emptyFirst: [['enter', 0.20], ['port', 0.60], ['rack', 0.85], ['hold', 1]],
      emptyLast: [['enter', 0.20], ['port', 0.60], ['rack', 0.80], ['exit', 1]], click: { first: 0.70, middle: 0.70, last: 0.60, only: 0.55, emptyFirst: 0.55, emptyLast: 0.55 } },
    part: { role: 'pump', mode: 'pulse', move: [0, 0, -0.1] }, spare: [0.02, 0.02, 0.06], cycle: { role: 'pump', keys: [[0, 0, 0], [0.25, 0, 0], [0.45, 1, 0], [0.60, 0, 0], [1, 0, 0]], eject: 0.42, particle: 'shells' },
    seat: [-0.02, 0.02, 0.05], belt: [-0.15, -0.3, 0.0], rack: [-0.03, -0.02, 0.1],
    tp: { gun: -20, armLFetch: -30 }, marks: { shellIn: [0.70, 0.70] } },
  { id: 'R6', name: 'Break action',
    partial: [['lower', 0.15], ['out', 0.30], ['fetch', 0.45], ['in', 0.70], ['close', 0.82], ['raise', 1]],
    work: [-0.05, 0.04, 0, 10, 8, 0], part: { role: 'barrel', mode: 'latch', move: [0, -0.098, -0.031], turn: [-35, 0, 0] }, spare: [0.04, 0.04, 0.08],
    seat: [-0.03, -0.03, 0.04], belt: [-0.15, -0.35, 0.0], rack: [-0.03, 0.0, 0.1], jolt: [0.012, -0.03],
    tp: { gun: -25, armLFetch: -35 }, marks: { out: [0.18, 0.18], in: [0.62, 0.62], close: [0.76, 0.76], fx: [0.20, 0.20] }, fxKind: 'shells' },
  { id: 'R7', name: 'Drum or canister',
    partial: [['lower', 0.15], ['out', 0.32], ['fetch', 0.50], ['in', 0.70], ['rack', 0.82], ['raise', 1]],
    work: [-0.05, 0.04, 0, 10, 8, -15], part: { role: 'mag', mode: 'mag', move: [-0.18, -0.12, 0], lock: 60 }, spare: [0.1, 0.06, 0.1],
    seat: [-0.04, -0.06, 0.05], belt: [-0.22, -0.3, 0.0], rack: [-0.05, -0.05, 0.05],
    tp: { gun: -15, armLWork: -20, armLFetch: -35 }, marks: { out: [0.18, 0.18], in: [0.68, 0.68], rack: [0.80, 0.80] } },
  { id: 'R8', name: 'Cell swap',
    partial: [['lower', 0.12], ['out', 0.35], ['fetch', 0.50], ['in', 0.66], ['rack', 0.86], ['raise', 1]], work: [-0.05, 0.045, 0, 12, 8, -10],
    part: { role: 'cell', mode: 'mag', out: 0.22 }, spare: [0.02, 0.06, 0.04], glow: true,
    seat: [-0.05, -0.02, 0.03], belt: [-0.2, -0.2, 0.0], rack: [-0.04, 0.03, 0.0],
    tp: { gun: -15, armLFetch: -30 }, marks: { out: [0.14, 0.14], in: [0.64, 0.64], cellCharge: [0.68, 0.68], fx: [0.20, 0.20] } },
  { id: 'R9', name: 'Top clip and crank',
    partial: [['lower', 0.12], ['out', 0.28], ['fetch', 0.46], ['in', 0.64], ['raise', 1]],
    empty: [['lower', 0.10], ['out', 0.24], ['fetch', 0.40], ['in', 0.56], ['rack', 0.80], ['raise', 1]],
    work: [-0.05, 0.04, 0, 10, 8, 0], part: { role: 'mag', mode: 'mag', out: 0.12 }, second: { role: 'string', mode: 'pulse', move: [0, 0, -0.07] }, spare: [0.03, 0.03, 0.3],
    seat: [-0.03, 0.08, 0.05], belt: [-0.16, 0.05, -0.05], rack: [-0.04, 0.03, -0.05],
    tp: { gun: -10, armLFetch: 10 }, marks: { out: [0.14, 0.12], in: [0.62, 0.54], rack: [0, 0.70] } },
  { id: 'R10', name: 'Nock',
    partial: [['reach', 0.35], ['in', 0.75], ['raise', 1]], work: [-0.04, 0.04, 0, 5, 5, 0],
    part: { role: 'arrow', mode: 'mag', out: 0, hidden: true }, spare: [0.012, 0.5, 0.012], bow: { role: 'string', move: [0, 0, -0.12], cant: 5 },
    seat: [-0.02, 0.0, 0.1], belt: [-0.18, -0.05, -0.1], rack: [-0.02, 0.0, 0.1],
    tp: { gun: -10, armRFetch: 150 }, marks: { in: [0.70, 0.70] } },
  { id: 'R11', name: 'Belt box',
    partial: [['lower', 0.10], ['open', 0.20], ['out', 0.35], ['fetch', 0.55], ['in', 0.70], ['rack', 0.80], ['close', 0.88], ['raise', 1]],
    work: [-0.05, 0.04, 0, 8, 6, 15], part: { role: 'mag', mode: 'mag', out: 0.25 }, second: { role: 'lid', mode: 'latch', move: [0, 0.05, 0], turn: [-70, 0, 0] }, spare: [0.1, 0.08, 0.1],
    seat: [-0.04, -0.12, 0.0], belt: [-0.25, -0.4, 0.1], rack: [-0.05, 0.05, 0.05], jolt: [-0.012, 0],
    tp: { gun: 0, gunDrop: -0.12, torso: 8, armLFetch: -50 }, marks: { out: [0.22, 0.22], in: [0.68, 0.68], rack: [0.86, 0.86] } },
  { id: 'R12', name: 'Tank',
    partial: [['lower', 0.10], ['open', 0.20], ['out', 0.35], ['fetch', 0.55], ['in', 0.72], ['rack', 0.82], ['prime', 0.92], ['raise', 1]],
    work: [-0.05, 0.04, 0, 8, 6, 0], part: { role: 'cell', mode: 'mag', out: 0.2 }, spare: [0.05, 0.2, 0.05], glow: true,
    seat: [-0.04, -0.06, 0.02], belt: [-0.2, -0.35, 0.0], rack: [-0.04, 0.0, 0.1],
    tp: { gun: 0, gunDrop: -0.10, torso: 8, armLFetch: -40 }, marks: { out: [0.12, 0.12], in: [0.70, 0.70], rack: [0.80, 0.80], fx: [0.87, 0.87] } },
  { id: 'R13', name: 'Tube',
    partial: [['lower', 0.12], ['open', 0.22], ['out', 0.32], ['fetch', 0.52], ['in', 0.72], ['close', 0.82], ['raise', 1]],
    work: [-0.05, 0.0, 0, 20, 6, 0], about: [-0.04, -0.09, 0.05], part: { role: 'mag', mode: 'mag', move: [0, 0, -0.25] }, second: { role: 'lid', mode: 'latch', move: [0, 0.06, 0], turn: [-60, 0, 0] }, spare: [0.07, 0.07, 0.25],
    seat: [-0.04, -0.02, -0.12], belt: [-0.12, -0.12, -0.25], rack: [-0.04, -0.02, -0.12],
    tp: { gun: 25, armLFetch: 30 }, marks: { out: [0.24, 0.24], in: [0.70, 0.70], rack: [0.80, 0.80] } },
  { id: 'R14', name: 'Breech',
    partial: [['lower', 0.12], ['open', 0.24], ['fetch', 0.46], ['in', 0.66], ['close', 0.78], ['prime', 0.92], ['raise', 1]],
    work: [-0.05, 0.04, 0, 15, 8, 0], part: { role: 'mag', mode: 'mag', move: [0, 0.05, 0] }, second: { role: 'lid', mode: 'latch', move: [0, 0.05, -0.02], turn: [-50, 0, 0] }, spare: [0.07, 0.07, 0.07], glow: true,
    seat: [-0.03, 0.02, 0.15], belt: [-0.2, -0.3, 0.0], rack: [-0.03, 0.0, 0.0],
    tp: { gun: -20, armLFetch: -35 }, marks: { out: [0.14, 0.14], in: [0.64, 0.64], cellCharge: [0.80, 0.80] } },
]);
CAT.reloadAnims.forEach((row, index) => { row.index = index; });

// The cue of each sound mark of a reload set; 'fx' (the particle moment) is resolved per weapon (11a emitCue).
const RELOAD_MARK_CUES = { open: 'reloadRack', out: 'reloadOut', in: 'reloadIn', rack: 'reloadRack', close: 'reloadRack', shellIn: 'shellIn', cellCharge: 'cellCharge', fx: RELOAD_FX_CUE };
CAT.reloadAnims.forEach((row) => {
  row.cueMarks = Object.keys(row.marks).map((name) => ({ cue: RELOAD_MARK_CUES[name], partial: row.marks[name][0], empty: row.marks[name][1] }));
});

// Melee strike row. A strike is the contact pose (drawn on the first frame at or after the hit tick, so the swing arc is one
// frame: a smear), then the follow-through to `through` (0..follow of the cycle T), then the recovery to the guard pose (the hold)
// by `recover` (T = 1 is the moment the weapon may act again). While the trigger of an auto weapon stays held the pose winds up
// to `cocked` from `wind` on. `alternate`: repeated strikes mirror (forehand / backhand). `charge`: the hold raises the weapon
// to `cocked` by the charge fraction (W01 alt). `twoHand`: the off-hand rides on the weapon. `tp`: third person degrees
// { arms: [windup, contact, follow], torso, gun: [pitch, forward m], oneHand }. `classes`: the gun classes whose quick melee uses it.
const MELEE_FADE_RELOAD = 0.08;                   // render seconds a melee pose blends out in when a reload takes over (P6-04)
const MELEE_HIT_STOP = 0.03;                      // seconds the first-person contact pose holds after a melee hit the local player lands (P6-03)
Data.define('meleeAnims', {
  id: REQUIRED, name: REQUIRED, strike: REQUIRED, through: REQUIRED, cocked: NO_POSE, follow: 0.3, recover: 1, wind: 0.8, alternate: false, charge: false,
  twoHand: false, block: null, tp: {}, classes: [], index: 0,
}, [
  { id: 'maul', name: 'Maul chop', strike: [-0.13, 0.05, 0.02, -65, 20, -20], through: [-0.18, -0.02, 0.06, -85, 28, -28], cocked: [0.02, 0.1, -0.05, 50, -10, 20],
    follow: 0.30, recover: 0.80, wind: 0.80, alternate: true, twoHand: true, tp: { arms: [100, -20, -35], torso: 10, gun: [-30, 0.1] } },
  { id: 'maulAlt', name: 'Maul slam', strike: [-0.13, 0.02, 0.05, -80, 0, 0], through: [-0.13, -0.05, 0.08, -95, 0, 0], cocked: [-0.05, 0.16, -0.08, 55, 0, 0],
    follow: 0.35, recover: 1, charge: true, twoHand: true, tp: { arms: [130, -20, -40], torso: 12, gun: [-40, 0.1] } },
  { id: 'tanto', name: 'Tanto slash', strike: [-0.15, 0.1, 0.12, -30, 30, -60], through: [-0.2, 0.08, 0.14, -30, 45, -75], cocked: [-0.02, 0.08, 0, -10, -30, 30],
    follow: 0.25, recover: 1, wind: 0.8, alternate: true, tp: { arms: [60, -10, -30], torso: 6, gun: [0, 0.1], oneHand: true } },
  { id: 'tantoAlt', name: 'Tanto thrust', strike: [-0.13, 0.1, 0.1, -85, 0, 0], through: [-0.13, 0.1, 0.14, -85, 0, 20],
    follow: 0.15, recover: 0.60, tp: { arms: [30, 0, 0], torso: 4, gun: [0, 0.25], oneHand: true } },
  { id: 'bulwark', name: 'Shield shove', strike: [-0.1, 0.02, 0.15, 0, 0, 0], through: [-0.1, 0.02, 0.18, 0, 0, 0], cocked: [0.01, 0, -0.04, 0, 0, 0],
    follow: 0.30, recover: 1, wind: 0.85, twoHand: false, block: [-0.13, 0.03, 0.06, 0, 0, 0], tp: { arms: [20, 0, 0], torso: 6, gun: [0, 0.2] } },
  { id: 'bashSidearm', name: 'Pistol whip', strike: [-0.12, 0.05, 0.08, 0, 25, -40], through: [-0.17, 0.05, 0.06, 0, 35, -45], follow: 0.25, recover: 1, classes: ['sidearm'],
    tp: { arms: [0, 0, 0], torso: 6, gun: [30, 0.2] } },
  { id: 'bashLong', name: 'Butt-stroke', strike: [-0.1, 0.05, 0.12, 0, 30, 0], through: [-0.13, 0.04, 0.14, 0, 40, 0], follow: 0.25, recover: 1,
    classes: ['smg', 'rifle', 'marksman', 'sniper', 'shotgun', 'energy'], tp: { arms: [0, 0, 0], torso: 6, gun: [30, 0.2] } },
  { id: 'bashHeavy', name: 'Shoulder shove', strike: [-0.12, 0.05, 0.1, -10, 12, 0], through: [-0.14, 0.05, 0.13, -12, 14, 0], follow: 0.25, recover: 1,
    classes: ['heavy', 'explosive', 'power', 'exotic', 'tool'], tp: { arms: [0, 0, 0], torso: 8, gun: [30, 0.2] } },
]);
CAT.meleeAnims.forEach((row, index) => { row.index = index; });
const QUICK_MELEE_HELD_DIP = [0, -0.06, 0, 0, 0, 15];   // quick melee by another owned melee weapon: the held gun dips out of the way (P6-03)
