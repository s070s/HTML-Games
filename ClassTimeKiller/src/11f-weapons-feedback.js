// ==== S11 WEAPONS: SHOT AND RELOAD FEEDBACK (P7-02, F03 F04 F06 F11) ====
// The pictures that go with a shot, a hit on a surface and a reload moment: the muzzle flash and its short light, spent casings, the particles of
// a bullet or a melee blow on each kind of surface, and the particles of the reload sets (R2 casings, the R4 live round, the W36 vent, the W35
// pilot flare). Everything is pooled particles and light slots (07d Fx): nothing is allocated per shot, no asset is loaded. Visual only: the sim
// never reads any of it, and a headless match (Game.headless) skips all of it. The sound of the same moments is in 06b (event 'weapon.cue').

const MUZZLE_FORWARD = 0.1;                // metres: the flash burst starts this far past the muzzle along the aim, clear of the barrel and of the view model drawn over the effects
const MUZZLE_BASE_COUNT = 3;                // particles of a flash of size 1, before the class size and the particle intensity setting
const MUZZLE_OWN_SIZE = 0.4;                // the player's own flash, a multiple of the kind's 14 cm: about 5 cm at half a metre from the eye (other bodies keep 14 cm so a far flash stays seen)
const MUZZLE_REDUCED_SIZE = 0.5, MUZZLE_REDUCED_ALPHA = 0.5;   // "reduced": one particle at half the size and half the alpha, no light
const MUZZLE_TOTAL_ALPHA = 1.2, MUZZLE_MAX_ALPHA = 0.6;      // the particles of one flash share this much alpha (a sum above 1 at the centre burns to white), none above the max
const FLASH_SAFE_RATE = 3;                  // photosensitivity mode (ACC-005): a gun firing faster than this many shots a second shows no flash, a slower one a reduced flash
const MUZZLE_LIGHT_SECONDS = 0.05;
const MUZZLE_LIGHT_RADIUS = 3;              // metres, times the class flash size
const MUZZLE_LIGHT_MIN_LIGHTS = 2;          // presets with fewer dynamic lights (Low, Potato) get no muzzle light
const MUZZLE_LIGHT_OTHERS_RANGE = 25;       // metres: the muzzle light of another body only this close to the camera
const MUZZLE_FLASH_WARM = 0xffcf6a, MUZZLE_LIGHT_WARM = 0xffc870;   // a kinetic gun's flash and light; an energy gun's flash and light are in its own (lightened) colour
const MUZZLE_LEVEL = { off: 0, reduced: 1, full: 2 };   // Render.config.muzzleFlash
const CASING_INTERVAL = 0.1;                // seconds: a body ejects at most ten casings a second (a fast gun every second or third shot)
const CASING_BACK = 0.12, CASING_SIDE = 0.03, CASING_UP = 0.02;   // the ejection port: behind the muzzle along the aim, to the right, a little up
const CASING_OUT = [1, 0.7, 0.15];          // the direction a casing leaves in: right, up, back (before the kind's spread)
const CASING_BRASS = 0xd9a441, CASING_RED = 0xc0392b;
const CASING_ROUND_SIZE = 1.6;              // the live round of the R4 bolt is this many times a casing
const REPORT_MAX_CASINGS = 6;               // the W05 cylinder drops at most this many casings (P6-01)
const VENT_COUNT = 4;
const VENT_COLOR = 0xdfeaf0;
const FLARE_COLOR = 0xffb050;

const feedbackPoint = makeFxPoint();        // the scratch record of every effect below (burstAt / muzzleLight read it)
const feedbackAim = Vec.make();
const cueTypes = { casings: 1, eject: 1, shells: 1, vent: 1, flare: 1 };   // the cues that are particles (the others are sounds only)

const ShotFx = {
  casingAt: new Float64Array(MAX_ACTORS).fill(-1e9),   // Sim.time of the last casing of each body

  level() { return Render.config.muzzleFlash; },

  // Everything a shot adds to the picture; `muzzle` is the drawn muzzle (Muzzle.visual). The aim is the one announceShot just worked out (aimScratch).
  shot(id, weapon, mode, muzzle) {
    feedbackAim.x = aimScratch.x; feedbackAim.y = aimScratch.y; feedbackAim.z = aimScratch.z;
    this.flash(id, weapon, mode, muzzle);
    if (mode.type === 'hitscan' && weapon.casingKind) this.casing(id, weapon, muzzle);
  },

  // F04: the flash burst (count by class, 5 cm for the player's own flash and 14 cm for another body's), and a 0.05 s light on presets with two or more lights. Full: the
  // class's particles sharing an alpha; reduced: one particle at half the size and half the alpha, no light; off: nothing. Photosensitivity mode lowers the level (see
  // FLASH_SAFE_RATE).
  flash(id, weapon, mode, muzzle) {
    let level = this.level();
    const size = weapon.muzzleFlash;
    if (Render.config.flashSafe) { const ceiling = mode.rate > FLASH_SAFE_RATE ? MUZZLE_LEVEL.off : MUZZLE_LEVEL.reduced; if (level > ceiling) level = ceiling; }
    if (level === MUZZLE_LEVEL.off || size <= 0) return;
    const own = id === Game.playerId, reduced = level === MUZZLE_LEVEL.reduced;
    let count = (MUZZLE_BASE_COUNT * size + 0.5) | 0;   // an integer, not a float, to burstAt
    if (count < 1) count = 1;
    let alpha = MUZZLE_TOTAL_ALPHA / count;
    if (alpha > MUZZLE_MAX_ALPHA) alpha = MUZZLE_MAX_ALPHA;
    let scale = own ? MUZZLE_OWN_SIZE : 1;
    if (reduced) { count = 1; alpha *= MUZZLE_REDUCED_ALPHA; scale *= MUZZLE_REDUCED_SIZE; }
    const point = feedbackPoint;
    point[FP_X] = muzzle.x + feedbackAim.x * MUZZLE_FORWARD; point[FP_Y] = muzzle.y + feedbackAim.y * MUZZLE_FORWARD; point[FP_Z] = muzzle.z + feedbackAim.z * MUZZLE_FORWARD;
    point[FP_NX] = feedbackAim.x; point[FP_NY] = feedbackAim.y; point[FP_NZ] = feedbackAim.z; point[FP_SIZE] = scale; point[FP_ALPHA] = alpha;
    const energy = weapon.class === 'energy';
    Fx.burstAt('muzzle', point, count, energy ? weapon.family.color | 0x404040 : MUZZLE_FLASH_WARM);   // a rifle's flash was its dark body colour, hardly visible
    if (level !== MUZZLE_LEVEL.full || Render.quality.lights < MUZZLE_LIGHT_MIN_LIGHTS) return;
    if (!own && !this.nearCamera(muzzle, MUZZLE_LIGHT_OTHERS_RANGE)) return;
    point[FP_SIZE] = MUZZLE_LIGHT_RADIUS * size; point[FP_ALPHA] = 1;
    Fx.muzzleLight(id, point, energy ? weapon.family.color | 0x606060 : MUZZLE_LIGHT_WARM, MUZZLE_LIGHT_SECONDS);
  },

  nearCamera(point, range) {
    const camera = Render.camera, dx = point.x - camera.x, dy = point.y - camera.y, dz = point.z - camera.z;
    return dx * dx + dy * dy + dz * dz <= range * range;
  },

  // F06: one brass casing from the right side of the gun. Own shots always; another body's only on a preset that shows them and inside the near LOD.
  casing(id, weapon, muzzle) {
    if (Sim.time - this.casingAt[id] < CASING_INTERVAL) return;
    if (id !== Game.playerId && (!Render.quality.otherCasings || !this.nearCamera(muzzle, Render.quality.lodNear))) return;
    this.casingAt[id] = Sim.time;
    this.eject(id, muzzle, CASING_BRASS, 1, 1);
  },

  // `count` casings (a shell, a round, brass) from the port of the gun of body `id` whose muzzle is `muzzle`, size a multiple of a casing.
  eject(id, muzzle, color, count, size) {
    const yaw = Actors.yaw[id], aim = feedbackAim, point = feedbackPoint;
    const rightX = -Math.cos(yaw), rightZ = Math.sin(yaw);
    point[FP_X] = muzzle.x - aim.x * CASING_BACK + rightX * CASING_SIDE;
    point[FP_Y] = muzzle.y - aim.y * CASING_BACK + CASING_UP;
    point[FP_Z] = muzzle.z - aim.z * CASING_BACK + rightZ * CASING_SIDE;
    point[FP_NX] = rightX * CASING_OUT[0] - aim.x * CASING_OUT[2]; point[FP_NY] = CASING_OUT[1]; point[FP_NZ] = rightZ * CASING_OUT[0] - aim.z * CASING_OUT[2];
    point[FP_SIZE] = size; point[FP_ALPHA] = 1;
    Fx.burstAt('casing', point, count, color);
  },

  // F03: what a hit on a surface makes: the material's particles and, for a bullet, the decal (some materials leave none: water).
  surface(hit, withDecal) {
    const row = hit.brush ? CAT.materials.byId(hit.brush.material) : null, effect = row ? row.effect : IMPACT_DEFAULT, point = feedbackPoint;
    point[FP_X] = hit.x; point[FP_Y] = hit.y; point[FP_Z] = hit.z; point[FP_NX] = hit.nx; point[FP_NY] = hit.ny; point[FP_NZ] = hit.nz; point[FP_SIZE] = 1; point[FP_ALPHA] = 1;
    Fx.burstAt(effect.kind, point, effect.count, row ? row.effectColor : effect.color);
    if (withDecal && effect.decal) Fx.decalAt(point, 'bullet');
  },

  // F11 and the particles of the reload sets: the local player's cue (11a emits 'weapon.cue' at the marks of the reload set and the action cycles).
  onCue(event) {
    if (Game.headless || !cueTypes[event.cue]) return;
    const id = event.id, weapon = CAT.weapons.byId(event.weapon);
    if (!weapon || !Actors.alive[id] || !Muzzle.locate(id, weapon)) return;
    const muzzle = Muzzle.point;   // the geometric muzzle: the reload effects need no drawn-offset correction
    const yaw = Actors.yaw[id], pitch = Actors.pitch[id], cosPitch = Math.cos(pitch);   // the aim, worked out here: Vec.fromAngles would box its two float arguments
    feedbackAim.x = Math.sin(yaw) * cosPitch; feedbackAim.y = Math.sin(pitch); feedbackAim.z = Math.cos(yaw) * cosPitch;
    const point = feedbackPoint;
    point[FP_X] = muzzle.x; point[FP_Y] = muzzle.y; point[FP_Z] = muzzle.z; point[FP_NX] = 0; point[FP_NY] = 1; point[FP_NZ] = 0; point[FP_SIZE] = 1; point[FP_ALPHA] = 1;
    switch (event.cue) {
      case 'casings': this.eject(id, muzzle, CASING_BRASS, Math.min(event.count, REPORT_MAX_CASINGS), 1); break;
      case 'shells': this.eject(id, muzzle, CASING_RED, event.count, 1.5); break;
      case 'eject': this.eject(id, muzzle, CASING_BRASS, event.count, CASING_ROUND_SIZE); break;
      case 'vent': Fx.burstAt('smoke', pointBehind(muzzle, 0.1), VENT_COUNT, VENT_COLOR); break;
      case 'flare': Fx.burstAt('fire', pointBehind(muzzle, 0), 1, FLARE_COLOR); break;
    }
  },
};

// The scratch point `distance` metres behind the muzzle along the aim, its normal up (a puff rises, a flare flickers).
function pointBehind(muzzle, distance) {
  const point = feedbackPoint, aim = feedbackAim;
  point[FP_X] = muzzle.x - aim.x * distance; point[FP_Y] = muzzle.y - aim.y * distance; point[FP_Z] = muzzle.z - aim.z * distance;
  point[FP_NX] = 0; point[FP_NY] = 1; point[FP_NZ] = 0; point[FP_SIZE] = 1; point[FP_ALPHA] = 1;
  return point;
}

Bus.on('weapon.cue', (event) => ShotFx.onCue(event));
