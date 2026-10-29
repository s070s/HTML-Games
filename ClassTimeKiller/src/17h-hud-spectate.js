// ==== S17 HUD: SPECTATE (P2-01) ====
// When the local player is dead and no respawn will come (Modes.respawnIn is -1: Detonate, Last Squad, Last Ring, Ghost Ops,
// Ravager vs Fiends until the next round, Last Standing after the last life), or the match has no local player, the camera is
// the spectator's through Render.cameraOverride, after the killcam has played. Two views:
//   follow: a chase camera behind and above a living player, who stays on screen with the weapon in hand. Fire (touch NEXT) or
//     the next-weapon control picks the next player, Alt (PREV) or previous-weapon the one before. In team modes the cycle holds
//     the player's living teammates; with none left it holds everybody (the round is about over); in other modes everybody.
//     Only players and bots can be followed (not dummies, PvE enemies or players waiting in a queue).
//   free: a flying camera (the move keys or stick along the look direction, Jump up, Crouch down, Sprint faster) kept inside the
//     map bounds, with no collision. Reload (touch VIEW) switches between the two; Fire or Alt in the free camera follow a player.
// The audio listener rides the camera (Sound.listenerSource). The spectator ends at a respawn, a new round or the end of the match.
// Input.spectate calls frame() once per input frame while the player's actor is dead, or there is none.

const SPECTATE_FOLLOW_DISTANCE = 3.4;    // m behind the followed player's eye
const SPECTATE_FOLLOW_LIFT = 0.5;        // m above it
const SPECTATE_FOLLOW_MAX_PITCH = 40 * DEG;   // the chase camera does not tip further than this with the followed player's aim
const SPECTATE_WALL_MARGIN = 0.3;        // m kept between the chase camera and a wall behind it
const SPECTATE_MIN_DISTANCE = 0.6;       // m: closest the chase camera is pulled to the player
const SPECTATE_GLIDE = 10;               // 1/s: how fast the chase camera follows (a new target is glided to)
const SPECTATE_TURN = 12;                // 1/s: how fast it turns with the followed player's aim
const SPECTATE_SNAP_DISTANCE = 30;       // m: farther than this the camera jumps (a teleport, a respawn across the map)
const SPECTATE_FREE_SPEED = 9;           // m/s
const SPECTATE_FREE_SPRINT = 2.5;        // speed multiplier with Sprint held
const SPECTATE_BOUNDS_MARGIN = 3;        // m outside the walls the free camera may go
const SPECTATE_FLOOR = 0.4;              // m above the lowest brush
const SPECTATE_CEILING = 25;             // m above the highest brush
const SPECTATE_START_HEIGHT = 8;         // m above the lowest brush: a spectator with no player and nobody to follow starts over the map centre
const SPECTATE_HUD_Y = 0.8;              // share of the screen height of the title line
const SPECTATE_TITLE_SIZE = 16, SPECTATE_NAME_SIZE = 24, SPECTATE_HINT_SIZE = 14;   // design px
const SPECTATE_ACTIONS = ['fire', 'alt', 'reload', 'nextWeapon', 'prevWeapon'];     // next player, previous player, switch view; the weapon pair also cycles
const SPECTATE_LATCHED = ['fire', 'alt', 'jump', 'crouch', 'sprint'];               // actions whose Toggle setting could leave them on after an odd number of presses

const Spectate = {
  active: false, free: false, target: -1, placed: false, snap: true,
  targets: new Int8Array(MAX_ACTORS), count: 0,                       // the players the cycle holds, by actor id
  fly: Vec.make(),                                                    // the free camera's place (its look is Input.aim)
  pivot: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },                      // the eased point the chase camera looks along from
  view: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },                       // the camera as last placed: the audio listener and a switch to the free camera start there
  seen: new Uint32Array(SPECTATE_ACTIONS.length), taken: new Uint32Array(SPECTATE_ACTIONS.length),
  next: 0, previous: 0, switchView: 0,                                // presses since the last frame
  dir: Vec.make(), hit: makeHit(),
  text: { subject: '', subjectName: '', subjectPlace: 0, subjectCount: 0, hint: '', hintNext: null, hintPrevious: null, hintView: null, hintFree: false },   // the HUD strings, kept until what they say changes

  // True while the local player has no more life in this round (or there is no local player) in a match that runs.
  wanted() {
    if (Game.state !== 'playing' || !Game.match) return false;
    const id = Game.playerId;
    if (id < 0) return true;
    return Actors.kind[id] !== ACTOR_KIND.NONE && !Actors.alive[id] && Modes.respawnIn(id, Sim.time) < 0;
  },
  // Input.spectate: starts and ends the spectator, reads the presses, moves the free camera.
  frame(seconds) {
    if (!this.wanted()) { if (this.active) this.stop(); return; }
    if (!this.active) this.begin();
    this.takePresses();
    if (!Killcam.playing) this.step(seconds);   // the replay shows first; a press that skipped it is not a switch
    this.syncTouch();
  },
  step(seconds) {
    this.refreshTargets();
    this.keepTarget();
    if (this.next || this.previous) this.cycle(this.next >= this.previous ? 1 : -1);
    if (this.switchView) this.toggleView();
    if (this.free) this.moveFree(seconds);
  },
  begin() {
    this.active = true; this.free = false; this.target = -1; this.placed = false; this.snap = true;
    Input.spectating = true;
    this.releaseLatches();
    this.takePresses();
    this.startView(this.view);
    Vec.set(this.fly, this.view.x, this.view.y, this.view.z);
    this.refreshTargets();
    this.target = this.nearest(this.view.x, this.view.y, this.view.z);
    if (this.target < 0) this.enterFree();
  },
  stop() {
    this.active = false; this.free = false; this.target = -1; this.placed = false; this.count = 0;
    Input.spectating = false;
    this.releaseLatches();   // the player respawns firing, aiming or crouched otherwise
    TouchInput.setFlag('spectateFree', false);
    TouchInput.setFlag('spectate', false);
  },
  // A Hold / Toggle setting set to Toggle keeps an action on after its press: NEXT, PREV and the free camera's keys would stay latched.
  releaseLatches() {
    for (let i = 0; i < SPECTATE_LATCHED.length; i++) Input.resetToggle(SPECTATE_LATCHED[i]);
  },
  // Where the spectator starts: at the dead player's eye looking where they looked, else over the middle of the map.
  startView(view) {
    const id = Game.playerId;
    if (id >= 0 && Actors.kind[id] !== ACTOR_KIND.NONE) {
      view.x = Actors.x[id]; view.y = Actors.eyeY(id); view.z = Actors.z[id];   // fields, not Vec.set: see Muzzle.launch
      view.yaw = Input.aim.yaw; view.pitch = Input.aim.pitch;
      return;
    }
    const low = World.boundsMin, high = World.boundsMax, known = low.x <= high.x;
    view.x = known ? (low.x + high.x) / 2 : 0; view.y = SPECTATE_START_HEIGHT + (known ? low.y : 0); view.z = known ? (low.z + high.z) / 2 : 0;
    view.yaw = 0; view.pitch = 0;
  },
  // Presses of the cycle and view actions since the last call (Input.presses counts taps shorter than a frame, and toggled holds too).
  takePresses() {
    const presses = Input.presses, seen = this.seen, taken = this.taken;
    for (let i = 0; i < SPECTATE_ACTIONS.length; i++) {
      const total = presses[Input.actionIndex[SPECTATE_ACTIONS[i]]];
      taken[i] = total - seen[i]; seen[i] = total;
    }
    this.next = taken[0] + taken[3]; this.previous = taken[1] + taken[4]; this.switchView = taken[2];
  },
  syncTouch() {
    TouchInput.setFlag('spectate', !Killcam.playing);
    TouchInput.setFlag('spectateFree', this.free);
  },

  // ---- Who can be followed ----
  eligible(id) {
    if (id === Game.playerId || !Actors.alive[id]) return false;
    const kind = Actors.kind[id];
    return (kind === ACTOR_KIND.PLAYER || kind === ACTOR_KIND.BOT) && (!Modes.active || Modes.isActive(id));
  },
  // The cycle: the living teammates of the player; with none (or in a mode without teams) every living player, in actor order.
  refreshTargets() {
    const player = Game.playerId, team = player >= 0 ? Actors.team[player] : NO_TEAM;
    let mates = 0;
    this.count = 0;
    if (team >= 0) for (let id = 0; id < Actors.count; id++) if (Actors.team[id] === team && this.eligible(id)) mates++;
    for (let id = 0; id < Actors.count; id++) {
      if (this.eligible(id) && (!mates || Actors.team[id] === team)) this.targets[this.count++] = id;
    }
  },
  // The followed player stays in the cycle; when they die or leave, the next one after them (or the free camera when nobody is left).
  keepTarget() {
    if (this.free || this.indexOfTarget(this.target) >= 0) return;
    const old = this.target;
    this.target = -1;
    for (let i = 0; i < this.count; i++) if (this.targets[i] > old) { this.target = this.targets[i]; break; }
    if (this.target < 0 && this.count > 0) this.target = this.targets[0];
    if (this.target < 0) this.enterFree();
  },
  // Position of an actor in the cycle, -1 when it is not in it.
  indexOfTarget(id) {
    for (let i = 0; i < this.count; i++) if (this.targets[i] === id) return i;
    return -1;
  },
  // The player of the cycle nearest to a point, -1 when it is empty.
  nearest(x, y, z) {
    let best = -1, bestSquared = Infinity;
    for (let i = 0; i < this.count; i++) {
      const id = this.targets[i], squared = distanceSquared3(x, y, z, Actors.x[id], Actors.y[id], Actors.z[id]);
      if (squared < bestSquared) { best = id; bestSquared = squared; }
    }
    return best;
  },
  // Next (1) or previous (-1) player; from the free camera the nearest one is followed first.
  cycle(step) {
    if (this.count === 0) return;
    if (this.free) { this.follow(this.nearest(this.fly.x, this.fly.y, this.fly.z)); return; }
    this.follow(this.targets[(this.indexOfTarget(this.target) + step + this.count) % this.count]);
  },
  follow(id) {
    this.free = false; this.target = id;
  },
  toggleView() {
    if (!this.free) { this.enterFree(); return; }
    if (this.count > 0) this.follow(this.nearest(this.fly.x, this.fly.y, this.fly.z));
  },
  // The free camera starts where the camera is now, looking the same way.
  enterFree() {
    this.free = true; this.target = -1;
    Vec.set(this.fly, this.view.x, this.view.y, this.view.z);
    Input.setAim(this.view.yaw, this.view.pitch);
  },
  moveFree(seconds) {
    const move = Input.moveAxes(), aim = Input.aim, fly = this.fly, dir = Vec.fromAngles(this.dir, aim.yaw, aim.pitch);
    const rightX = -Math.cos(aim.yaw), rightZ = Math.sin(aim.yaw), index = Input.actionIndex;
    const up = (Input.effective[index.jump] ? 1 : 0) - (Input.effective[index.crouch] ? 1 : 0);
    const step = SPECTATE_FREE_SPEED * (Input.effective[index.sprint] ? SPECTATE_FREE_SPRINT : 1) * seconds;
    fly.x += (dir.x * move.z + rightX * move.x) * step;
    fly.y += (dir.y * move.z + up) * step;
    fly.z += (dir.z * move.z + rightZ * move.x) * step;
    this.keepInBounds(fly);
  },
  // Inside the map's brushes grown by a margin (no brushes: free).
  keepInBounds(point) {
    const low = World.boundsMin, high = World.boundsMax;
    if (low.x > high.x) return;
    point.x = clamp(point.x, low.x - SPECTATE_BOUNDS_MARGIN, high.x + SPECTATE_BOUNDS_MARGIN);
    point.y = clamp(point.y, low.y + SPECTATE_FLOOR, high.y + SPECTATE_CEILING);
    point.z = clamp(point.z, low.z - SPECTATE_BOUNDS_MARGIN, high.z + SPECTATE_BOUNDS_MARGIN);
  },

  // ---- Camera (Render.cameraOverride) ----
  place(camera) {
    if (this.free) {
      camera.x = this.fly.x; camera.y = this.fly.y; camera.z = this.fly.z;
      camera.yaw = Input.aim.yaw; camera.pitch = Input.aim.pitch;
    } else this.placeChase(camera, Hud.frameSeconds);
    camera.roll = 0;
    const view = this.view;
    view.x = camera.x; view.y = camera.y; view.z = camera.z; view.yaw = camera.yaw; view.pitch = camera.pitch;
    this.placed = true;
    return true;
  },
  // Behind and above the followed player, looking where they look, pulled in by a wall behind them.
  placeChase(camera, seconds) {
    this.easePivot(seconds);
    const pivot = this.pivot, dir = Vec.fromAngles(this.dir, pivot.yaw, pivot.pitch);
    const wantX = -dir.x * SPECTATE_FOLLOW_DISTANCE, wantY = -dir.y * SPECTATE_FOLLOW_DISTANCE + SPECTATE_FOLLOW_LIFT, wantZ = -dir.z * SPECTATE_FOLLOW_DISTANCE;   // from the pivot
    const length = length3(wantX, wantY, wantZ);
    let share = 1;
    if (World.raycast(pivot.x, pivot.y, pivot.z, wantX / length, wantY / length, wantZ / length, length, this.hit)) {
      share = clamp(this.hit.distance - SPECTATE_WALL_MARGIN, Math.min(SPECTATE_MIN_DISTANCE, length), length) / length;
    }
    camera.x = pivot.x + wantX * share; camera.y = pivot.y + wantY * share; camera.z = pivot.z + wantZ * share;
    camera.yaw = pivot.yaw; camera.pitch = pivot.pitch;
  },
  // The point the chase camera hangs from follows the followed player's interpolated eye and aim; a new target is glided to.
  easePivot(seconds) {
    const id = this.target, pivot = this.pivot, alpha = Render.view.alpha;
    if (id < 0 || Actors.kind[id] === ACTOR_KIND.NONE) { if (this.snap) this.snapPivotToView(); return; }
    const x = lerp(Actors.prevX[id], Actors.x[id], alpha), y = lerp(Actors.prevY[id], Actors.y[id], alpha) + Actors.eye[id], z = lerp(Actors.prevZ[id], Actors.z[id], alpha);
    const yaw = lerpAngle(Actors.prevYaw[id], Actors.yaw[id], alpha), pitch = clamp(lerp(Actors.prevPitch[id], Actors.pitch[id], alpha), -SPECTATE_FOLLOW_MAX_PITCH, SPECTATE_FOLLOW_MAX_PITCH);
    if (this.snap || distanceSquared3(pivot.x, pivot.y, pivot.z, x, y, z) > SPECTATE_SNAP_DISTANCE * SPECTATE_SNAP_DISTANCE) {
      pivot.x = x; pivot.y = y; pivot.z = z; pivot.yaw = yaw; pivot.pitch = pitch;
      this.snap = false;
      return;
    }
    const glide = Math.min(1, seconds * SPECTATE_GLIDE), turn = Math.min(1, seconds * SPECTATE_TURN);
    pivot.x += (x - pivot.x) * glide; pivot.y += (y - pivot.y) * glide; pivot.z += (z - pivot.z) * glide;
    pivot.yaw += wrapAngle(yaw - pivot.yaw) * turn; pivot.pitch += (pitch - pivot.pitch) * turn;
  },
  // No one to follow yet (the frame before the first target is set): the pivot stays at the camera's last place.
  snapPivotToView() {
    const pivot = this.pivot, view = this.view;
    pivot.x = view.x; pivot.y = view.y; pivot.z = view.z; pivot.yaw = view.yaw; pivot.pitch = view.pitch;
  },

  // ---- HUD text ----
  title() { return this.free ? 'FREE CAMERA' : 'SPECTATING'; },
  // The name line: the followed player and their place in the cycle, '' in the free camera.
  // The text is made again only when the player, their place in the cycle, the cycle's size or the name changed (not every frame).
  subject() {
    if (this.free || this.target < 0) return '';
    const name = Actors.name[this.target] || HUD_FALLBACK_NAME, place = this.indexOfTarget(this.target) + 1, text = this.text;
    if (text.subjectName !== name || text.subjectPlace !== place || text.subjectCount !== this.count) {
      text.subjectName = name; text.subjectPlace = place; text.subjectCount = this.count;
      text.subject = name + (this.count > 1 ? '  ' + place + '/' + this.count : '');
    }
    return text.subject;
  },
  // The keys line (not on touch: the buttons say it themselves).
  hint() {
    const next = Hud.keyLabel('fire'), previous = Hud.keyLabel('alt'), view = Hud.keyLabel('reload'), text = this.text;
    if (text.hintNext !== next || text.hintPrevious !== previous || text.hintView !== view || text.hintFree !== this.free) {
      text.hintNext = next; text.hintPrevious = previous; text.hintView = view; text.hintFree = this.free;
      if (!next && !previous && !view) text.hint = '';
      else text.hint = this.free ? next + ' / ' + previous + ': follow a player   ' + view + ': follow' : next + ': next   ' + previous + ': previous   ' + view + ': free camera';
    }
    return text.hint;
  },
};

Bus.on('match.start', () => Spectate.stop());
Bus.on('match.stop', () => Spectate.stop());
Bus.on('match.end', () => Spectate.stop());
Bus.on('actor.spawn', (event) => { if (event.id === Game.playerId && Spectate.active) Spectate.stop(); });
Input.spectate = (seconds) => Spectate.frame(seconds);

// ---- Hooks (chained: an earlier owner keeps working): the camera and the audio listener ----
const spectatePreviousOverride = Render.cameraOverride;
Render.cameraOverride = (camera) => {
  if (!Spectate.active || Game.state !== 'playing') return spectatePreviousOverride ? spectatePreviousOverride(camera) : false;
  if (Killcam.playing && spectatePreviousOverride && spectatePreviousOverride(camera)) return true;   // the replay first; one that just ended hands over in this very frame
  return Spectate.place(camera);
};
const spectatePreviousListener = Sound.listenerSource;
Sound.listenerSource = (out) => {
  if (Spectate.active && Spectate.placed && !Killcam.playing) {
    const view = Spectate.view;
    out.x = view.x; out.y = view.y; out.z = view.z; out.yaw = view.yaw; out.pitch = view.pitch;
    return true;
  }
  return spectatePreviousListener ? spectatePreviousListener(out) : false;
};

// ---- Spectator text: what is watched and the keys (the player's own ELIMINATED line stays in 17c) ----
function hudDrawSpectate(pen, layout) {
  if (!Spectate.active || Killcam.playing) return;
  const unit = layout.unit, x = layout.centerX, y = layout.height * SPECTATE_HUD_Y, subject = Spectate.subject(), hint = Spectate.hint();
  pen.label(Spectate.title(), x, y, SPECTATE_TITLE_SIZE * unit, HUD_COLOR.text, 'center');   // white: the followed body (a team colour) is right behind the text
  if (subject) pen.label(subject, x, y + 26 * unit, SPECTATE_NAME_SIZE * unit, HUD_COLOR.text, 'center');
  if (hint) pen.label(hint, x, y + (subject ? 54 : 28) * unit, SPECTATE_HINT_SIZE * unit, HUD_COLOR.text, 'center');
}
Hud.register('front', 'spectate', 'respawnText', hudDrawSpectate);
