// ==== S11 WEAPONS: MUZZLE (P2-03) ====
// Where a weapon's shots leave. The muzzle is the weapon model's own muzzle point (07c measureMuzzle, or the row's `muzzle`),
// carried into the world the way the model is drawn: the local player's weapon is the view model (the hold or ADS pose of its
// class row, the model scaled by VIEWMODEL_SCALE, in front of the eye), anybody else's is the held model at the actor's gun part
// (07c drawHeldWeapon: HELD_MODEL_SCALE, the crouch sink, the aim pitch). Pure arithmetic on sim state, so headless matches and
// bots use the same point; the settings of the player's view (view model offset, field of view) and the look of the body (scale,
// the second pistol) only move the drawn start of tracers and flashes (visual()), never the simulated shot.
// Projectiles start at the muzzle and fly to the point under the crosshair (the nearest actor or wall on the eye ray); lobbed
// ones (gravity) keep the eye direction. A shot leaves the eye instead when the muzzle cannot be used: a wall between the eye and
// the muzzle, a wall or actor on the eye ray closer than MUZZLE_MIN_CONVERGE, or a wall on the way from the muzzle to the aim
// point (a pillar edge the eye ray clears), so nothing passes through a wall in front of the player and a player at arm's length
// is not behind the muzzle. Hitscan damage is still traced from the eye along the aim ray; only the tracer and the muzzle flash
// start at the muzzle.

const MUZZLE_CONVERGE_RANGE = 120;       // m: how far the eye ray is searched for the point projectiles aim at (none found: this far)
const MUZZLE_MIN_CONVERGE = 1.5;         // m: with a wall or an actor on the eye ray closer than this the shot leaves the eye (the muzzle reaches 0.5 to 0.9 m ahead)
const LOB_MIN_GRAVITY = 10;              // m/s2: a projectile row with this much gravity or more is lobbed: it is aimed on an arc to the crosshair point (P8-04); the Talon Bow arrow (9) keeps its drop, a listed drawback

const MUZZLE_PATH_SLACK = 0.3;           // m: a wall this close to the aim point is the aim point itself, not something in the way
const MUZZLE_LOBBED_CHECK = 2;           // m: how far a lobbed shot's start is checked along its direction
const MUZZLE_SIGNATURE_FIELDS = 10;      // id, weapon, x, y, z, yaw, pitch, ADS share, height, first person: what prepare() depends on

const muzzleLine = makeLine();
const muzzleHit = makeHit();

const Muzzle = {
  point: Vec.make(),                     // the geometric muzzle of the last locate(), world metres
  offset: Vec.make(),                    // its place from the eye: x right, y up, z forward (view model case)
  start: Vec.make(),                     // prepare(): the geometric muzzle of the actor and weapon in hand (kept apart from point, which locate() overwrites)
  usable: false,                         // prepare(): the weapon has a model and the eye reaches its muzzle
  signature: new Float64Array(MUZZLE_SIGNATURE_FIELDS),
  visualPoint: Vec.make(),               // visual(): where tracers and flashes start (the drawn muzzle)
  eyePoint: Vec.make(),                  // visual(): the eye, when the muzzle is not used
  visualFresh: false,                    // visualPoint holds this shot's muzzle (newShot() clears it)
  launchFrom: { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 },   // launch(): the start point and the unit flight direction
  drawn: false,                          // locate() is placing the drawn muzzle (visual), not the simulated one
  fovRatio: 1,                           // drawn, first person: world view tan(fov / 2) over the view model's, so a flash lands on the drawn barrel tip
  hand: 1,                               // drawn, first person: -1 for the left gun of a W04 pair
  bodyScale: 1,                          // drawn, held: the actor's body scale (growth mutators, PvE size)

  // The muzzle of actor id holding `weapon` into this.point. False when the weapon has no model.
  locate(id, weapon) {
    const model = WeaponModels.weapon[weapon.index];
    if (!model) return false;
    if (id === Game.playerId) this.locateView(id, model); else this.locateHeld(id, model);
    return true;
  },
  // First person: pose of the view model (07e poseWeapon: hold to ADS by the ADS share), the model's muzzle on top. Drawn: also the
  // player's view model offset (it fades out with the ADS share), the left gun mirrored, and the field of view of the view model.
  locateView(id, model) {
    const pose = model.pose, ads = Weapons.ads[id], muzzle = model.muzzle, offset = this.offset, hand = this.drawn ? this.hand : 1;
    offset.x = hand * (lerp(pose.hold[0], pose.ads[0], ads) + muzzle[0] * VIEWMODEL_SCALE);
    offset.y = lerp(pose.hold[1], pose.ads[1], ads) + muzzle[1] * VIEWMODEL_SCALE;
    offset.z = lerp(pose.hold[2], pose.ads[2], ads) + muzzle[2] * VIEWMODEL_SCALE;
    if (this.drawn) {
      const shift = Render.config.viewmodelOffset, hip = 1 - ads;
      offset.x = (offset.x - shift[0] * hip) * this.fovRatio;
      offset.y = (offset.y + shift[1] * hip) * this.fovRatio;
      offset.z += shift[2] * hip;
    }
    this.fromEye(id);
  },
  // offset (right, up, forward) from the eye along the actor's view angles into this.point.
  fromEye(id) {
    const yaw = Actors.yaw[id], pitch = Actors.pitch[id], offset = this.offset, point = this.point;
    const sinYaw = Math.sin(yaw), cosYaw = Math.cos(yaw), sinPitch = Math.sin(pitch), cosPitch = Math.cos(pitch);
    const rightX = -cosYaw, rightZ = sinYaw, forwardX = sinYaw * cosPitch, forwardY = sinPitch, forwardZ = cosYaw * cosPitch;
    const upX = -rightZ * forwardY, upY = rightZ * forwardX - rightX * forwardZ, upZ = rightX * forwardY;   // right x forward (07e)
    point.x = Actors.x[id] + rightX * offset.x + upX * offset.y + forwardX * offset.z;
    point.y = Actors.eyeY(id) + upY * offset.y + forwardY * offset.z;
    point.z = Actors.z[id] + rightZ * offset.x + upZ * offset.y + forwardZ * offset.z;
  },
  // Third person: the model hangs on the 'gun' part of the body (placeActorPart: the part centre pitched with the aim, sunk by the
  // crouch), is scaled by HELD_MODEL_SCALE about the grip and pitched with the aim (drawHeldWeapon); the whole body by its scale.
  locateHeld(id, model) {
    const part = HELD_GUN_PART, muzzle = model.muzzle, point = this.point, scale = this.drawn ? this.bodyScale : 1;
    const pitch = Actors.pitch[id] * part.aim + part.hold * DEG, yaw = Actors.yaw[id];
    const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch), cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
    const sink = (1 - clamp(Actors.height[id] / STAND_HEIGHT, 0.3, 1)) * STAND_HEIGHT * CROUCH_UPPER_SHARE;
    // From the feet, x to the left: the part centre, then the model point turned by the pitch about its grip.
    const gunX = part.pivot[0] + part.offset[0];
    const gunY = part.pivot[1] - sink + part.offset[1] * cosPitch + part.offset[2] * sinPitch;
    const gunZ = part.pivot[2] - part.offset[1] * sinPitch + part.offset[2] * cosPitch;
    const modelX = -muzzle[0] * HELD_MODEL_SCALE, modelY = (muzzle[1] - HELD_GRIP_Y) * HELD_MODEL_SCALE, modelZ = (muzzle[2] - HELD_GRIP_Z) * HELD_MODEL_SCALE;
    const localX = (gunX + modelX) * scale, localY = (gunY + modelY * cosPitch + modelZ * sinPitch) * scale, localZ = (gunZ - modelY * sinPitch + modelZ * cosPitch) * scale;
    point.x = Actors.x[id] + localX * cosYaw + localZ * sinYaw;
    point.y = Actors.y[id] + localY;
    point.z = Actors.z[id] - localX * sinYaw + localZ * cosYaw;
  },
  // True when nothing solid lies between the eye and this.point.
  reachable(id) {
    const line = muzzleLine, point = this.point;
    line.ax = Actors.x[id]; line.ay = Actors.eyeY(id); line.az = Actors.z[id]; line.bx = point.x; line.by = point.y; line.bz = point.z;
    return World.lineClearOf(line);
  },
  // The simulated muzzle of the actor and weapon in hand into this.start, and whether the eye reaches it (this.usable): worked out
  // once per trigger pull (newShot) and while the actor, the weapon and the pose stay as they are (every pellet, the tracer and the flash).
  prepare(id, weapon) {
    const sig = this.signature;
    if (sig[0] === id && sig[1] === weapon.index && sig[2] === Actors.x[id] && sig[3] === Actors.y[id] && sig[4] === Actors.z[id]
      && sig[5] === Actors.yaw[id] && sig[6] === Actors.pitch[id] && sig[7] === Weapons.ads[id] && sig[8] === Actors.height[id] && sig[9] === (id === Game.playerId ? 1 : 0)) return this.usable;
    sig[0] = id; sig[1] = weapon.index; sig[2] = Actors.x[id]; sig[3] = Actors.y[id]; sig[4] = Actors.z[id];
    sig[5] = Actors.yaw[id]; sig[6] = Actors.pitch[id]; sig[7] = Weapons.ads[id]; sig[8] = Actors.height[id]; sig[9] = id === Game.playerId ? 1 : 0;
    this.visualFresh = false;
    this.usable = this.locate(id, weapon) && this.reachable(id);
    Vec.copy(this.start, this.point);
    return this.usable;
  },
  // A new trigger pull: its muzzle (what the eye reaches now, which gun of a pair, the settings) is worked out again.
  newShot() { this.signature[0] = -1; this.visualFresh = false; },
  // Where tracers and muzzle flashes start: the drawn muzzle, or the eye when the muzzle is not used (not reachable, or the shot
  // ended `reach` metres from the eye, closer than the muzzle's reach: a point-blank tracer would run backwards). Visual only.
  visual(id, weapon, reach = MUZZLE_CONVERGE_RANGE) {
    if (!this.prepare(id, weapon) || reach < MUZZLE_MIN_CONVERGE) return Vec.set(this.eyePoint, Actors.x[id], Actors.eyeY(id), Actors.z[id]);
    if (!this.visualFresh) this.placeDrawn(id, weapon);
    return this.visualPoint;
  },
  // visualPoint: locate() with what only the picture needs (the rest of the state is this.point's, which prepare() has copied away).
  placeDrawn(id, weapon) {
    const first = id === Game.playerId;
    this.drawn = true;
    if (first) {
      this.fovRatio = this.viewFovRatio();
      this.hand = Weapons.dual[Weapons.slotIndex(id, weapon.index)] === 1 && (Weapons.recoilShot[id] & 1) === 1 ? -1 : 1;
    } else this.bodyScale = readActorStyle(id).scale;
    this.locate(id, weapon);
    this.drawn = false; this.fovRatio = 1; this.hand = 1; this.bodyScale = 1;
    Vec.copy(this.visualPoint, this.point);
    this.visualFresh = true;
  },
  // The view model is drawn with its own field of view (07e drawViewModel): a point that sits at a screen position there sits at
  // the same one in the world view when its right and up shrink or grow by the ratio of the two tangents.
  viewFovRatio() {
    const world = Render.camera.fov, view = Render.config.viewmodelFov;
    if (!(world > 0) || !(view > 0)) return 1;
    const ratio = Math.tan(verticalFov(world) / 2) / Math.tan(verticalFov(view) / 2);
    return ratio > 0 && ratio < Infinity ? ratio : 1;
  },
  // The start and the unit flight direction of a projectile of `direction` (the unit eye-ray direction of the shot) into
  // launchFrom: the muzzle when it can be used, else the eye. `converge`: aim from the muzzle at the point under the crosshair
  // (the nearest actor or wall on the eye ray); lobbed shots keep `direction`.
  launch(id, weapon, direction, converge) {
    const out = this.launchFrom, eyeY = Actors.eyeY(id);
    this.leaveFromEye(id, eyeY, direction);
    if (!this.prepare(id, weapon)) return out;
    const distance = this.aimDistance(id, eyeY, direction), start = this.start;
    if (distance < MUZZLE_MIN_CONVERGE) return out;   // a wall or a player at arm's length: the shot leaves the eye, so the muzzle is never behind what it aims at
    out.x = start.x; out.y = start.y; out.z = start.z;
    let reach = Math.min(distance - MUZZLE_PATH_SLACK, MUZZLE_LOBBED_CHECK);
    if (converge) {
      const dx = Actors.x[id] + direction.x * distance - start.x, dy = eyeY + direction.y * distance - start.y, dz = Actors.z[id] + direction.z * distance - start.z;
      const length = length3(dx, dy, dz) || 1;
      out.dx = dx / length; out.dy = dy / length; out.dz = dz / length;
      reach = length - MUZZLE_PATH_SLACK;
    }
    if (World.raycast(out.x, out.y, out.z, out.dx, out.dy, out.dz, reach, muzzleHit)) this.leaveFromEye(id, eyeY, direction);   // a pillar edge on the way
    return out;
  },
  lobRange: null,   // fn(id) -> the metres to the point a bot aims at (14d: its target, with its aim error), or -1: the eye ray decides
  // P8-04 (F0-13): the low arc from the muzzle (launchFrom) through the point under the crosshair for a projectile of this speed and gravity, into
  // launchFrom's direction. The point is where the eye ray ends: the nearest wall or actor, else MUZZLE_CONVERGE_RANGE ahead; a bot's is its own
  // aim distance along its (erring) ray, so a wall in front of it does not pull the shot short. A point out of reach gets the farthest arc, not a flat
  // shot. False (the direction stays the eye ray's) only when the point is closer than MUZZLE_MIN_CONVERGE or the numbers are not usable.
  solveLob(id, direction, speed, gravity) {
    if (!(speed > 0) || !(gravity > 0)) return false;
    const out = this.launchFrom, eyeY = Actors.eyeY(id), own = this.lobRange ? this.lobRange(id) : -1;
    const distance = own > 0 ? own : this.aimDistance(id, eyeY, direction);
    if (distance < MUZZLE_MIN_CONVERGE) return false;
    const dx = Actors.x[id] + direction.x * distance - out.x, dy = eyeY + direction.y * distance - out.y, dz = Actors.z[id] + direction.z * distance - out.z;
    const flat = length2(dx, dz), square = speed * speed, root = square * square - gravity * (gravity * flat * flat + 2 * dy * square);
    if (flat < 0.01) return false;
    const eyeSlope = direction.y / (length2(direction.x, direction.z) || 1e-6);
    const slope = root >= 0 ? (square - Math.sqrt(root)) / (gravity * flat) : Math.max(1, eyeSlope), cosine = 1 / Math.sqrt(1 + slope * slope);   // root < 0 (or NaN): out of reach, the farthest arc is 45 deg, or the eye's own pitch when that is steeper (a sky shot is never lowered)
    out.dx = dx / flat * cosine; out.dy = slope * cosine; out.dz = dz / flat * cosine;
    return true;
  },
  // launchFrom: the eye, along `direction`.
  leaveFromEye(id, eyeY, direction) {
    const out = this.launchFrom;
    out.x = Actors.x[id]; out.y = eyeY; out.z = Actors.z[id];   // fields, not Vec.set: an object of another shape in the shared helper makes every Vec store allocate (PERF-006)
    out.dx = direction.x; out.dy = direction.y; out.dz = direction.z;
  },
  // Distance along the eye ray to the nearest actor or wall (MUZZLE_CONVERGE_RANGE when there is none).
  aimDistance(id, eyeY, direction) {
    const x = Actors.x[id], z = Actors.z[id];
    let distance = World.raycast(x, eyeY, z, direction.x, direction.y, direction.z, MUZZLE_CONVERGE_RANGE, muzzleHit) ? muzzleHit.distance : MUZZLE_CONVERGE_RANGE;
    if (RayHits.collect(id, x, eyeY, z, direction.x, direction.y, direction.z, distance, 1, 0, true)) distance = RayHits.distances[0];
    return distance;
  },
};

Bus.on('world.load', () => Muzzle.newShot());   // another world: what the eye reached there says nothing here
