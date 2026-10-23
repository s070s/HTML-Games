// ==== S17 HUD: KILLCAM-LITE (UI-011) ====
// A fixed ring buffer records every actor's transform at 20 Hz while a match runs (typed arrays, nothing allocated per step).
// When the local player is killed by someone, the last 2 s are replayed from the killer's eyes through Render.cameraOverride, with
// the recorded bodies drawn through their own models and held weapons and the live ones hidden. The player can skip it; the option can be turned off.

const KILLCAM_RATE = 20;                                    // recorded frames per second
const KILLCAM_STEP_TICKS = TICK_RATE / KILLCAM_RATE;        // sim steps between two recorded frames
const KILLCAM_SECONDS = 2;                                  // length of the replay
const KILLCAM_HOLD = 0.25;                                  // the last frame stays this long before control returns
const KILLCAM_FRAMES = KILLCAM_RATE * KILLCAM_SECONDS + 4;  // ring size: the replay plus a margin
const KILLCAM_MIN_SECONDS = 0.3;                            // less history than this: no replay
const KILLCAM_SKIP_GRACE = 0.35;                            // a skip press counts only after this many seconds
const KILLCAM_SKIP_BUTTONS = BTN.FIRE | BTN.JUMP | BTN.USE;
const KILLCAM_FIELDS = 6;                                   // x y z yaw pitch eye
const KILLCAM_BAR = 0.08;                                   // letterbox bar height as a share of the screen
const KILLCAM_ORDER = 95;                                   // sim system order: after every other bookkeeping

Settings.define('hud.killcam', true, { label: 'Killcam replay after you are killed', category: 'hud' });

const Killcam = {
  enabled: true,
  transforms: new Float32Array(KILLCAM_FRAMES * MAX_ACTORS * KILLCAM_FIELDS),
  living: new Uint8Array(KILLCAM_FRAMES * MAX_ACTORS),
  weapons: new Int16Array(KILLCAM_FRAMES * MAX_ACTORS),     // the held weapon index (Render.heldWeapon), -1 = none
  frameTime: new Float64Array(KILLCAM_FRAMES),
  head: 0, filled: 0,
  // playback
  playing: false, clock: 0, startTime: 0, length: 0, killer: -1, skipHeld: false,
  killerName: '', weaponName: '', weaponClass: '', headshot: false, killerHealth: 0, killerArmor: 0, killerShield: 0,
  sampleScratch: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, eye: 0, alive: false },
  lower: 0, upper: 0, mix: 0,

  reset() { this.head = 0; this.filled = 0; this.stop(); },
  // Stores one frame of every actor. `forceAlive` keeps a just-killed actor visible in the final frame.
  record(forceAlive) {
    const previous = (this.head - 1 + KILLCAM_FRAMES) % KILLCAM_FRAMES;
    const reuse = this.filled > 0 && this.frameTime[previous] === Sim.time;
    const frame = reuse ? previous : this.head;
    if (!reuse) { this.head = (this.head + 1) % KILLCAM_FRAMES; if (this.filled < KILLCAM_FRAMES) this.filled++; }
    this.frameTime[frame] = Sim.time;
    const base = frame * MAX_ACTORS;
    for (let id = 0; id < Actors.count; id++) {
      const o = (base + id) * KILLCAM_FIELDS;
      this.transforms[o] = Actors.x[id]; this.transforms[o + 1] = Actors.y[id]; this.transforms[o + 2] = Actors.z[id];
      this.transforms[o + 3] = Actors.yaw[id]; this.transforms[o + 4] = Actors.pitch[id]; this.transforms[o + 5] = Actors.eye[id];
      this.living[base + id] = Actors.kind[id] !== ACTOR_KIND.NONE && (Actors.alive[id] === 1 || id === forceAlive) ? 1 : 0;
      this.weapons[base + id] = killcamLiveHeld ? killcamLiveHeld(id) : -1;
    }
    for (let id = Actors.count; id < MAX_ACTORS; id++) this.living[base + id] = 0;
  },
  // Ring slot of the i-th stored frame counting from the oldest.
  slotOf(i) { return (this.head - this.filled + i + KILLCAM_FRAMES) % KILLCAM_FRAMES; },
  oldestTime() { return this.filled ? this.frameTime[this.slotOf(0)] : 0; },
  newestTime() { return this.filled ? this.frameTime[this.slotOf(this.filled - 1)] : 0; },
  // Finds the two stored frames around `time` (lower/upper ring slots and the mix between them).
  bracket(time) {
    let lower = this.slotOf(0), upper = lower;
    for (let i = 0; i < this.filled; i++) {
      const slot = this.slotOf(i);
      if (this.frameTime[slot] > time) { upper = slot; break; }
      lower = slot; upper = slot;
    }
    const span = this.frameTime[upper] - this.frameTime[lower];
    this.lower = lower; this.upper = upper; this.mix = span > 0 ? clamp((time - this.frameTime[lower]) / span, 0, 1) : 0;
  },
  // Interpolated transform of an actor at a sim time inside the recorded window. Returns the reused scratch object.
  sample(id, time) {
    this.bracket(time);
    const a = (this.lower * MAX_ACTORS + id) * KILLCAM_FIELDS, b = (this.upper * MAX_ACTORS + id) * KILLCAM_FIELDS, t = this.transforms, out = this.sampleScratch, mix = this.mix;
    out.x = lerp(t[a], t[b], mix); out.y = lerp(t[a + 1], t[b + 1], mix); out.z = lerp(t[a + 2], t[b + 2], mix);
    out.yaw = lerpAngle(t[a + 3], t[b + 3], mix); out.pitch = lerp(t[a + 4], t[b + 4], mix); out.eye = lerp(t[a + 5], t[b + 5], mix);
    out.alive = this.living[this.lower * MAX_ACTORS + id] === 1;
    return out;
  },

  // Starts the replay for a kill event of the local player; returns false when there is nothing to show.
  begin(event) {
    if (!this.enabled || this.playing || event.victim !== Game.playerId || event.killer < 0 || event.killer === event.victim) return false;
    if (Actors.kind[event.killer] === ACTOR_KIND.NONE) return false;
    this.record(event.victim);
    const end = this.newestTime(), start = Math.max(this.oldestTime(), end - KILLCAM_SECONDS);
    if (end - start < KILLCAM_MIN_SECONDS) return false;
    this.startTime = start; this.length = end - start; this.clock = 0; this.killer = event.killer; this.playing = true; Hud.replaying = true; Render.replayPose = killcamPose;
    this.skipHeld = (Actors.buttons[event.victim] & KILLCAM_SKIP_BUTTONS) !== 0;   // a button still held from the fight does not skip
    this.describeKill(event);
    TouchInput.applyAll();   // the touch buttons give way to the letterbox bars
    return true;
  },
  describeKill(event) {
    const killer = event.killer, weapon = CAT.weapons.byId(event.weapon);
    this.killerName = Actors.name[killer] || HUD_FALLBACK_NAME;
    this.weaponName = weapon ? weapon.name : ''; this.weaponClass = weapon ? weapon.class : '';
    this.headshot = event.zone === 'head';
    this.killerHealth = Actors.health[killer]; this.killerArmor = Actors.armor[killer]; this.killerShield = Actors.shield[killer];
  },
  stop() { this.playing = false; Hud.replaying = false; Render.replayPose = null; this.clock = 0; this.killer = -1; TouchInput.applyAll(); },   // touch buttons back in place
  // Moves the replay clock (render frames, not sim time) and ends it when it is over or skipped.
  advance(seconds) {
    if (!this.playing || Game.paused) return;
    this.clock += seconds;
    const player = Game.playerId, held = player >= 0 && (Actors.buttons[player] & KILLCAM_SKIP_BUTTONS) !== 0;
    const pressed = held && !this.skipHeld;
    this.skipHeld = held;
    if (this.clock >= this.length + KILLCAM_HOLD || (pressed && this.clock > KILLCAM_SKIP_GRACE)) this.stop();
  },
  // Render.cameraOverride: the killer's eyes at the replay time.
  place(camera) {
    if (!this.playing) return false;
    this.advance(Hud.frameSeconds);
    if (!this.playing) return false;
    const view = this.sample(this.killer, this.startTime + Math.min(this.clock, this.length));
    camera.x = view.x; camera.y = view.y + view.eye; camera.z = view.z;
    camera.yaw = view.yaw; camera.pitch = view.pitch; camera.roll = 0;
    return true;
  },
  progress() { return this.length > 0 ? clamp(this.clock / this.length, 0, 1) : 0; },
};

Bus.on('match.start', () => { Killcam.reset(); Killcam.enabled = Settings.get('hud.killcam'); });
Bus.on('match.stop', () => Killcam.reset());
Bus.on('match.end', () => Killcam.stop());
Bus.on('setting', (key) => {
  if (key !== 'hud.killcam') return;
  Killcam.enabled = Settings.get('hud.killcam');
  if (!Killcam.enabled) Killcam.stop();
});
Bus.on('actor.spawn', (event) => { if (event.id === Game.playerId) Killcam.stop(); });
Bus.on('kill', (event) => Killcam.begin(event));

Sim.addSystem('killcamRecord', KILLCAM_ORDER, () => {
  if (!Game.match || Game.playerId < 0 || !Killcam.enabled || Sim.tick % KILLCAM_STEP_TICKS !== 0) return;
  Killcam.record(-1);
});

// ---- Hooks (chained: an earlier owner keeps working): the replay camera, the recorded weapons and bodies ----
const killcamPreviousOverride = Render.cameraOverride;
Render.cameraOverride = (camera) => (Killcam.playing ? Killcam.place(camera) : killcamPreviousOverride ? killcamPreviousOverride(camera) : false);
const killcamLiveHeld = Render.heldWeapon;   // S11's; while replaying, a body holds its weapon of the frame last sampled
Render.heldWeapon = (id) => (Killcam.playing ? Killcam.weapons[Killcam.lower * MAX_ACTORS + id] : killcamLiveHeld ? killcamLiveHeld(id) : -1);
// Render.replayPose while it plays: every body (actors 07c, PvE enemies 14h) stands where the recording has it. The killer's is
// not drawn (the camera is inside it), nor one that was not alive then.
function killcamPose(id, pose) {
  const body = Killcam.sample(id, Killcam.startTime + Math.min(Killcam.clock, Killcam.length));
  if (id === Killcam.killer || !body.alive) return false;
  pose.x = body.x; pose.y = body.y; pose.z = body.z; pose.yaw = body.yaw; pose.pitch = body.pitch;
  return true;
}

// ---- Killcam panel: letterbox, killer name, weapon, the killer's health and armor, skip hint ----
function hudDrawKillcamPanel(pen, layout) {
  if (!Killcam.playing) return;
  const unit = layout.unit, bar = layout.height * KILLCAM_BAR, x = layout.centerX;
  pen.rect(0, 0, layout.width, bar, HUD_COLOR.black, 0.92);
  pen.rect(0, layout.height - bar, layout.width, bar, HUD_COLOR.black, 0.92);
  pen.rect(0, layout.height - 3 * unit, layout.width * Killcam.progress(), 3 * unit, HUD_COLOR.gold, 1);
  pen.text('KILLED BY', x - 8 * unit, bar / 2, 16 * unit, HUD_COLOR.dim, 'right');
  pen.text(Killcam.killerName, x + 8 * unit, bar / 2, 24 * unit, HUD_COLOR.text, 'left');
  const y = layout.height - bar / 2;
  if (Killcam.weaponClass) pen.weaponIcon(Killcam.weaponClass, x - 150 * unit, y, 44 * unit, HUD_COLOR.text);
  pen.text(Killcam.weaponName, x - 120 * unit, y, 18 * unit, HUD_COLOR.text, 'left');
  if (Killcam.headshot) hudDrawHeadIcon(pen, x + 30 * unit, y, 18 * unit, 1);
  pen.text('♥', x + 70 * unit, y, 16 * unit, Hud.colors.health, 'left');
  pen.text(hudNumber(Killcam.killerHealth), x + 90 * unit, y, 18 * unit, HUD_COLOR.text, 'left');
  pen.text('▲', x + 130 * unit, y, 16 * unit, HUD_COLOR.armor, 'left');
  pen.text(hudNumber(Killcam.killerArmor + Killcam.killerShield), x + 150 * unit, y, 18 * unit, HUD_COLOR.text, 'left');
  pen.text('TO SKIP', layout.right, bar / 2, 14 * unit, HUD_COLOR.dim, 'right');
  pen.text(Hud.keyLabel('fire') || 'TAP FIRE', layout.right - HudPen.measure('TO SKIP', 14 * unit) - 8 * unit, bar / 2, 14 * unit, HUD_COLOR.text, 'right');
}
Hud.register('front', 'killcam', '', hudDrawKillcamPanel);
// While the replay plays, touch buttons give way to its letterbox bars (05b keepClear, touch-01).
TouchInput.keepClear.push((width, height) => {
  const bar = height * KILLCAM_BAR;
  if (Killcam.playing) { TouchInput.addClear(0, 0, width, bar); TouchInput.addClear(0, height - bar, width, height); }
});
