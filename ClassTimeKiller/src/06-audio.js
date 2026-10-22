// ==== S06 AUDIO ====
// Web Audio synth only, no audio files (AUD-001..AUD-007, ACC-002, ACC-003). Files of this section:
//   06-audio.js           engine: settings, context unlock, buses, voice pool, spatial maths, sound queue, frame update
//   06b-audio-recipes.js  data: one recipe table, lookup tables and event rows, plus the generic event glue
//   06c-audio-music.js    generative music layers (calm / combat / boss)
// Game code never touches Web Audio: it emits events (docs/ARCHITECTURE.md) or calls Sound.play(recipeId, ...).
// Events become typed-array rows in a queue; once per frame the queue is turned into at most a few voices (no node-creation storms).
// Voices are persistent node chains reused from a pool; only the short-lived source nodes are created per sound.

const AUDIO_PRIORITY = { ui: 6, own: 5, near: 4, explosion: 3, far: 2, ambient: 1 }; // AUD-002: own weapon > close fire > explosions > far > ambience
const AUDIO_MAX_SLOTS = 32;                   // array size of the voice pool; Quality.current().voices says how many are used
const AUDIO_QUEUE_SIZE = 64;                  // sound requests collected per frame
const AUDIO_NEW_VOICE_DIVISOR = 3;            // at most voices / 3 new voices per frame (8, Potato 4)
const AUDIO_FLOOR_GAIN = 0.0001;              // exponential ramps cannot reach 0
const AUDIO_AUDIBLE_GAIN = 0.02;              // quieter sounds are dropped instead of using a voice
const AUDIO_START_DELAY = 0.004;              // seconds between "now" and the scheduled start (avoids clicks)
const AUDIO_STEAL_FADE = 0.012;               // seconds a stolen voice needs to fade out first
const AUDIO_NOISE_SECONDS = 2;                // length of the shared noise buffer (every voice loops it)
const AUDIO_PITCH_JITTER = 0.06;              // +-3% random pitch so repeated sounds are not identical
const AUDIO_CLIP_KNEE = 0.8;                  // output level where the soft clipper starts to bend
const AUDIO_CLIP_POINTS = 2049;               // resolution of the clipper curve
const AUDIO_PAN_WIDTH =0.95;                 // strongest pan; keeps a trace of the other ear
const AUDIO_CUTOFF_MAX = 18000;               // low-pass cutoff of a sound next to the listener
const AUDIO_CUTOFF_DISTANCE = 30;             // metres over which the cutoff halves
const AUDIO_REAR_CUTOFF = 0.65;               // head shadow: sounds behind the listener are duller (front/back cue on one speaker)
const AUDIO_OCCLUDED_CUTOFF = 0.15;           // cutoff factor when a wall is between listener and source
const AUDIO_OCCLUDED_GAIN = 0.7;
const AUDIO_OCCLUSION_RAYS = 4;               // line-of-sight rays per frame (AUD-007)
const AUDIO_OCCLUSION_MIN_DISTANCE = 3;       // closer sounds are never occluded
const AUDIO_COALESCE_DISTANCE_SQ = 4;         // same sound from the same actor within 2 m in one frame plays once (shotgun pellets)
const AUDIO_VOLUME_SMOOTHING = 0.03;          // seconds, volume changes glide (no zipper noise)
const AUDIO_PAUSE_TAU = 0.02;                 // seconds, fade of the game buses on pause
const AUDIO_SUSPEND_DELAY_MS = 150;           // the context is suspended after the pause fade finished
const AUDIO_BLOCKED_CHECK_MS = 1500;          // still not running this long after a gesture = blocked
const AUDIO_HRTF_QUALITY = ['high', 'ultra']; // AUD-004: head-related panning only where the CPU can afford it
const AUDIO_LOW_HEALTH = 0.3;                 // heartbeat below this health fraction
const AUDIO_HEARTBEAT_SLOW = 1.0;             // seconds between beats at the threshold
const AUDIO_HEARTBEAT_FAST = 0.5;             // seconds between beats at 0 health
const AUDIO_GAMEPAD_POLL_SECONDS = 0.1;
const AUDIO_GESTURES = ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click'];
const AUDIO_DIRECTIONS = ['ahead', 'right', 'behind', 'left'];
const AUDIO_CAPTION_KINDS = ['footstep', 'gunfire', 'explosion', 'item', 'voice', 'alert']; // HUD icon / colour per kind (ACC-003)

// ---- Settings (ACC-006, AUD-001, Q3). Volumes are slider positions 0..1; the bus gain is the square (perceived loudness). ----
const AUDIO_VOLUME_SETTINGS = [
  ['master', 0.8, 'Master volume'], ['sfx', 1, 'Effects volume'], ['music', 0.5, 'Music volume'],
  ['ui', 0.8, 'Menu sound volume'], ['announcer', 0.9, 'Announcer and voice volume'],
];
const AUDIO_BUS_LEVEL = { master: 'master', sfx: 'sfx', music: 'music', ui: 'ui', voice: 'announcer' };   // bus -> volume setting it follows
const AUDIO_TOGGLE_OPTIONS = { options: [false, true], optionLabels: ['Off', 'On'] };
for (const [name, fallback, label] of AUDIO_VOLUME_SETTINGS) Settings.define('audio.' + name, fallback, { label, category: 'audio', min: 0, max: 1, step: 0.05 });
Settings.define('audio.mono', false, Object.assign({ label: 'Mono audio', category: 'accessibility' }, AUDIO_TOGGLE_OPTIONS));
Settings.define('audio.hrtf', true, Object.assign({ label: '3D headphone sound (High quality and up)', category: 'audio' }, AUDIO_TOGGLE_OPTIONS));
Settings.define('audio.speech', false, Object.assign({ label: 'Spoken announcer (browser voice)', category: 'audio' }, AUDIO_TOGGLE_OPTIONS));

// ---- Voice allocator: pure bookkeeping, no Web Audio, so the stealing rules are testable without a context ----
function makeVoiceAllocator(capacity) {
  return {
    capacity, limit: capacity, stolen: 0, rejected: 0, lastWasSteal: false,
    priority: new Int8Array(capacity), distance: new Float32Array(capacity),
    startTime: new Float64Array(capacity), endTime: new Float64Array(capacity),
    // A free slot, else the most expendable playing slot, else -1 when every playing sound matters more than the new one.
    acquire(priority, distance, now, duration) {
      this.lastWasSteal = false;
      let victim = -1;
      for (let slot = 0; slot < this.limit; slot++) {
        if (this.endTime[slot] <= now) return this.claim(slot, priority, distance, now, duration);
        if (victim < 0 || this.moreExpendable(slot, victim)) victim = slot;
      }
      if (!this.mayReplace(victim, priority, distance)) { this.rejected++; return -1; }
      this.stolen++;
      this.lastWasSteal = true;
      return this.claim(victim, priority, distance, now, duration);
    },
    claim(slot, priority, distance, now, duration) {
      this.priority[slot] = priority; this.distance[slot] = distance;
      this.startTime[slot] = now; this.endTime[slot] = now + duration;
      return slot;
    },
    // Lower priority goes first, then the farther one, then the older one.
    moreExpendable(a, b) {
      if (this.priority[a] !== this.priority[b]) return this.priority[a] < this.priority[b];
      if (this.distance[a] !== this.distance[b]) return this.distance[a] > this.distance[b];
      return this.startTime[a] < this.startTime[b];
    },
    mayReplace(victim, priority, distance) {
      if (victim < 0) return false;
      if (this.priority[victim] !== priority) return this.priority[victim] < priority;
      return this.distance[victim] >= distance;
    },
    activeCount(now) {
      let count = 0;
      for (let slot = 0; slot < this.limit; slot++) if (this.endTime[slot] > now) count++;
      return count;
    },
    reset() { this.endTime.fill(0); this.startTime.fill(0); this.stolen = 0; this.rejected = 0; },
  };
}

// ---- Listener and spatial maths (pure functions over module scratch objects: no allocation per sound) ----
const audioListener = { valid: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, rightX: 0, rightZ: 0, forwardX: 0, forwardZ: 0, lookX: 0, lookY: 0, lookZ: 1, upX: 0, upY: 1, upZ: 0 };
const audioSpatial = { distance: 0, gain: 1, cutoff: AUDIO_CUTOFF_MAX, pan: 0, front: 1, direction: 0, localX: 0, localY: 0, localZ: 0, occluded: false };

function setAudioListener(x, y, z, yaw, pitch) {
  const listener = audioListener;
  const sinYaw = Math.sin(yaw), cosYaw = Math.cos(yaw), sinPitch = Math.sin(pitch), cosPitch = Math.cos(pitch);
  listener.x = x; listener.y = y; listener.z = z; listener.yaw = yaw; listener.pitch = pitch;
  listener.rightX = -cosYaw; listener.rightZ = sinYaw;               // DATA-002: right = (-cos yaw, 0, sin yaw)
  listener.forwardX = sinYaw; listener.forwardZ = cosYaw;
  listener.lookX = sinYaw * cosPitch; listener.lookY = sinPitch; listener.lookZ = cosYaw * cosPitch;
  listener.upX = -sinYaw * sinPitch; listener.upY = cosPitch; listener.upZ = -cosYaw * sinPitch;
  listener.valid = true;
}

// The local player's eye; Sound.listenerSource (fn(out) -> bool, set by spectate / killcam code) overrides it.
const audioListenerScratch = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
function refreshAudioListener() {
  audioListener.valid = false;
  const custom = Sound.listenerSource;
  if (custom && custom(audioListenerScratch)) {
    setAudioListener(audioListenerScratch.x, audioListenerScratch.y, audioListenerScratch.z, audioListenerScratch.yaw, audioListenerScratch.pitch);
    return;
  }
  const id = Game.playerId;
  if (id < 0 || Actors.kind[id] === ACTOR_KIND.NONE) return;
  setAudioListener(Actors.x[id], Actors.y[id] + Actors.eye[id], Actors.z[id], Actors.yaw[id], Actors.pitch[id]);
}

const isLocalPlayer = (id) => id >= 0 && id === Game.playerId;

// Loudness over distance: full level up to recipe.ref metres, then ref / (ref + rolloff * extra distance).
function audioAttenuation(recipe, distance) {
  if (distance <= recipe.ref) return 1;
  return recipe.ref / (recipe.ref + recipe.rolloff * (distance - recipe.ref));
}

// Sound with no position (menus, own feedback): centred, full level, no filtering.
function centerAudioSpatial(out) {
  out.distance = 0; out.gain = 1; out.cutoff = AUDIO_CUTOFF_MAX; out.pan = 0; out.front = 1; out.direction = 0;
  out.localX = 0; out.localY = 0; out.localZ = 0; out.occluded = false;
  return out;
}

// Direction index into AUDIO_DIRECTIONS from the pan (right is +) and the front/back component (front is +).
function audioDirection(pan, front) {
  if (Math.abs(pan) >= Math.abs(front)) return pan > 0 ? 1 : 3;
  return front > 0 ? 0 : 2;
}

// Fills `out` for a source at (x, y, z): distance, level, low-pass cutoff, equal-power pan and listener-space position (HRTF panner).
function computeAudioSpatial(out, recipe, x, y, z) {
  const listener = audioListener;
  const dx = x - listener.x, dy = y - listener.y, dz = z - listener.z;
  const horizontal = Math.hypot(dx, dz);
  out.distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  out.gain = audioAttenuation(recipe, out.distance);
  out.occluded = false;
  if (horizontal < 0.05) {
    out.pan = 0; out.front = 1;
  } else {
    out.pan = ((dx * listener.rightX + dz * listener.rightZ) / horizontal) * AUDIO_PAN_WIDTH * Math.min(1, out.distance);
    out.front = (dx * listener.forwardX + dz * listener.forwardZ) / horizontal;
  }
  out.direction = audioDirection(out.pan, out.front);
  out.cutoff = (AUDIO_CUTOFF_MAX / (1 + out.distance / AUDIO_CUTOFF_DISTANCE)) * lerp(AUDIO_REAR_CUTOFF, 1, (out.front + 1) / 2);
  out.localX = dx * listener.rightX + dz * listener.rightZ;
  out.localY = dx * listener.upX + dy * listener.upY + dz * listener.upZ;
  out.localZ = -(dx * listener.lookX + dy * listener.lookY + dz * listener.lookZ);   // Web Audio listeners look down -Z
  return out;
}

// Priority of one sound (AUD-002): UI first, the player's own sounds, then close fire, explosions, everything far away, ambience.
function audioPriorityFor(recipe, distance, own) {
  if (recipe.priorityValue === AUDIO_PRIORITY.ui) return AUDIO_PRIORITY.ui;
  if (own) return AUDIO_PRIORITY.own;
  const demotable = recipe.priorityValue === AUDIO_PRIORITY.near || recipe.priorityValue === AUDIO_PRIORITY.explosion;
  return demotable && distance > recipe.nearRange ? AUDIO_PRIORITY.far : recipe.priorityValue;
}

// ---- Payloads reused for emitted events (listeners copy what they keep) ----
const audioToastPayload = { text: '' };
const audioCaptionPayload = { text: '', x: 0, y: 0, z: 0, kind: '' };
function audioToast(text) { audioToastPayload.text = text; Bus.emit('toast', audioToastPayload); }

const isAppleTouchDevice = (nav) => /iPad|iPhone|iPod/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);

// ---- Sound request queue: typed-array rows filled by event handlers, drained once per frame ----
const SoundQueue = {
  recipe: new Int16Array(AUDIO_QUEUE_SIZE), positional: new Uint8Array(AUDIO_QUEUE_SIZE),
  x: new Float32Array(AUDIO_QUEUE_SIZE), y: new Float32Array(AUDIO_QUEUE_SIZE), z: new Float32Array(AUDIO_QUEUE_SIZE),
  source: new Int16Array(AUDIO_QUEUE_SIZE), gain: new Float32Array(AUDIO_QUEUE_SIZE), pitch: new Float32Array(AUDIO_QUEUE_SIZE),
  priority: new Int8Array(AUDIO_QUEUE_SIZE), distance: new Float32Array(AUDIO_QUEUE_SIZE), taken: new Uint8Array(AUDIO_QUEUE_SIZE),
  count: 0, dropped: 0,
  push(recipeIndex, positional, x, y, z, source, gain, pitch) {
    if (this.isDuplicate(recipeIndex, positional, x, y, z, source)) return false;
    if (this.count >= AUDIO_QUEUE_SIZE) { this.dropped++; return false; }
    const row = this.count++;
    this.recipe[row] = recipeIndex; this.positional[row] = positional ? 1 : 0;
    this.x[row] = x; this.y[row] = y; this.z[row] = z;
    this.source[row] = source; this.gain[row] = gain; this.pitch[row] = pitch; this.taken[row] = 0;
    return true;
  },
  isDuplicate(recipeIndex, positional, x, y, z, source) {
    for (let row = 0; row < this.count; row++) {
      if (this.recipe[row] !== recipeIndex || this.source[row] !== source) continue;
      if (!positional) return true;
      if (distanceSquared3(x, y, z, this.x[row], this.y[row], this.z[row]) <= AUDIO_COALESCE_DISTANCE_SQ) return true;
    }
    return false;
  },
  // Row of the most important untaken sound: highest priority, then nearest. -1 when all are taken.
  pickBest() {
    let best = -1;
    for (let row = 0; row < this.count; row++) {
      if (this.taken[row]) continue;
      if (best < 0 || this.priority[row] > this.priority[best]) best = row;
      else if (this.priority[row] === this.priority[best] && this.distance[row] < this.distance[best]) best = row;
    }
    return best;
  },
};

// ---- Persistent voice chain (one per pool slot) and the helpers that fill it ----
// Creating a source node costs about 30 microseconds on the main thread, so each slot owns its sources for the whole session:
// a noise source and two oscillators that run (only while the slot is connected) and are shaped by gains, filters and frequency automation.
// noise -> noiseFilter -> noiseGain \
// osc 1 ---------------> toneGain  -> mix -> lowpass (distance / occlusion) -> panner -> bus
// osc 2 -> partialGain ->/
function createVoiceSlot(context) {
  const slot = {
    mix: context.createGain(), lowpass: context.createBiquadFilter(), noiseFilter: context.createBiquadFilter(),
    noiseGain: context.createGain(), toneGain: context.createGain(), partialGain: context.createGain(),
    noiseSource: context.createBufferSource(), oscillators: [context.createOscillator(), context.createOscillator()],
    spatial: null, spatialKind: '', bus: null, connected: false, params: null,
  };
  slot.lowpass.type = 'lowpass';
  slot.noiseGain.gain.value = AUDIO_FLOOR_GAIN; slot.toneGain.gain.value = AUDIO_FLOOR_GAIN;
  slot.noiseSource.buffer = Sound.noiseBuffer; slot.noiseSource.loop = true;
  slot.noiseSource.connect(slot.noiseFilter); slot.noiseFilter.connect(slot.noiseGain); slot.noiseGain.connect(slot.mix);
  slot.oscillators[0].connect(slot.toneGain); slot.oscillators[1].connect(slot.partialGain); slot.partialGain.connect(slot.toneGain);
  slot.toneGain.connect(slot.mix);
  slot.noiseSource.start(0); slot.oscillators[0].start(0); slot.oscillators[1].start(0);
  slot.params = [slot.mix.gain, slot.lowpass.frequency, slot.noiseFilter.frequency, slot.noiseFilter.Q, slot.noiseGain.gain, slot.toneGain.gain, slot.partialGain.gain];
  return slot;
}

// While no voice plays, the slot is cut from the output so the audio thread skips its sources.
function setSlotConnected(slot, connected) {
  if (slot.connected === connected) return;
  if (connected) slot.mix.connect(slot.lowpass);
  else slot.mix.disconnect();
  slot.connected = connected;
}

// 'stereo' = equal-power StereoPanner (default), 'hrtf' = head-related PannerNode (High+), 'equalpower' = PannerNode fallback for old browsers.
function attachSlotSpatial(context, slot, kind) {
  if (slot.spatial) { slot.spatial.disconnect(); slot.lowpass.disconnect(); }
  if (kind === 'stereo') {
    slot.spatial = context.createStereoPanner();
  } else {
    slot.spatial = context.createPanner();
    slot.spatial.panningModel = kind === 'hrtf' ? 'HRTF' : 'equalpower';
    slot.spatial.distanceModel = 'linear';
    slot.spatial.rolloffFactor = 0;            // distance level is applied by audioAttenuation, not by the panner
    slot.spatial.maxDistance = 10000;
  }
  slot.lowpass.connect(slot.spatial);
  slot.spatialKind = kind;
  slot.bus = null;
}

function routeSlot(slot, busNode) {
  if (slot.bus === busNode) return;
  slot.spatial.disconnect();
  slot.spatial.connect(busNode);
  slot.bus = busNode;
}

function placeSlot(slot, spatial, time) {
  slot.lowpass.frequency.setValueAtTime(spatial.cutoff, time);
  if (slot.spatialKind === 'stereo') { slot.spatial.pan.setValueAtTime(spatial.pan, time); return; }
  const panner = slot.spatial;
  if (!panner.positionX) { panner.setPosition(spatial.localX, spatial.localY, spatial.localZ); return; }
  panner.positionX.setValueAtTime(spatial.localX, time);
  panner.positionY.setValueAtTime(spatial.localY, time);
  panner.positionZ.setValueAtTime(spatial.localZ, time);
}

// Attack ramp up, exponential decay down to silence.
function scheduleEnvelope(param, time, peak, attack, decay) {
  param.setValueAtTime(AUDIO_FLOOR_GAIN, time);
  param.linearRampToValueAtTime(Math.max(peak, AUDIO_FLOOR_GAIN), time + attack);
  param.exponentialRampToValueAtTime(AUDIO_FLOOR_GAIN, time + attack + decay);
}

// Noise burst: the slot's looping noise through a sweeping filter, once per pulse.
function startNoiseLayer(slot, recipe, layer, pitch, start) {
  slot.noiseFilter.type = layer.filter;
  slot.noiseFilter.Q.setValueAtTime(layer.q, start);
  for (let pulse = 0; pulse < recipe.pulses.length; pulse++) {
    const time = start + recipe.pulses[pulse];
    slot.noiseFilter.frequency.setValueAtTime(layer.from * pitch, time);
    slot.noiseFilter.frequency.exponentialRampToValueAtTime(layer.to * pitch, time + layer.attack + layer.decay);
    scheduleEnvelope(slot.noiseGain.gain, time, layer.gain, layer.attack, layer.decay);
  }
}

// Tonal body: one oscillator (two when the layer has a partial) gliding from `from` to `to` Hz, once per pulse.
function startToneLayer(slot, recipe, layer, pitch, start) {
  const oscillatorCount = layer.partial ? 2 : 1;
  slot.partialGain.gain.setValueAtTime(layer.partial ? 1 : 0, start);
  for (let k = 0; k < oscillatorCount; k++) {
    const oscillator = slot.oscillators[k];
    oscillator.type = layer.wave;
    for (let pulse = 0; pulse < recipe.pulses.length; pulse++) {
      const time = start + recipe.pulses[pulse];
      const scale = pitch * recipe.pitchSteps[pulse] * (k === 0 ? 1 : layer.partial);
      oscillator.frequency.setValueAtTime(layer.from * scale, time);
      oscillator.frequency.exponentialRampToValueAtTime(layer.to * scale, time + layer.attack + layer.decay);
    }
  }
  for (let pulse = 0; pulse < recipe.pulses.length; pulse++) {
    scheduleEnvelope(slot.toneGain.gain, start + recipe.pulses[pulse], layer.gain, layer.attack, layer.decay);
  }
}

function buildAudioBuses(context) {
  const makeBus = (parent) => { const node = context.createGain(); node.connect(parent); return node; };
  const limiter = context.createDynamicsCompressor();     // keeps explosion pile-ups from clipping (LT-H-069)
  limiter.threshold.value = -10; limiter.knee.value = 10; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.15;
  const clipper = context.createWaveShaper();            // last line of defence: nothing leaves above 0 dBFS
  clipper.curve = buildSoftClipCurve();
  limiter.connect(clipper); clipper.connect(context.destination);
  const master = makeBus(limiter), game = makeBus(master);
  return { limiter, clipper, master, game, sfx: makeBus(game), music: makeBus(game), voice: makeBus(game), ui: makeBus(master) };
}

// Straight up to AUDIO_CLIP_KNEE, then a smooth bend towards (but never reaching) 1.
function buildSoftClipCurve() {
  const curve = new Float32Array(AUDIO_CLIP_POINTS);
  for (let i = 0; i < curve.length; i++) {
    const input = (i / (curve.length - 1)) * 2 - 1;
    const excess = Math.max(0, Math.abs(input) - AUDIO_CLIP_KNEE);
    curve[i] = Math.sign(input) * (Math.min(Math.abs(input), AUDIO_CLIP_KNEE) + (1 - AUDIO_CLIP_KNEE) * Math.tanh(excess / (1 - AUDIO_CLIP_KNEE)));
  }
  return curve;
}

function buildNoiseBuffer(context) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * AUDIO_NOISE_SECONDS), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Rng.fx.next() * 2 - 1;
  return buffer;
}

const audioQuietCall = () => {};  // swallows the rejection of resume() when the browser still wants a gesture

const Sound = {
  enabled: false,           // true while a running AudioContext exists
  forceActive: false,       // tests: lets handlers and update run although Game.headless is set
  assumeRunning: false,     // tests: an OfflineAudioContext never reports 'running'
  listenerSource: null,     // fn(out {x,y,z,yaw,pitch}) -> bool, set by spectate / killcam code when the listener is not the player
  speechSynth: null,        // tests: replacement for window.speechSynthesis
  contextFactory: null,     // tests: returns the AudioContext to use
  context: null, buses: null, noiseBuffer: null, slots: [],
  allocator: makeVoiceAllocator(AUDIO_MAX_SLOTS),
  recipes: [], recipeById: new Map(), triggerCounts: new Int32Array(0),   // filled by 06b
  frameHooks: [],           // fn(seconds) called each audio frame (music)
  levels: { master: 0.8, sfx: 1, music: 0.5, ui: 0.8, announcer: 0.9 },    // slider positions 0..1
  mono: false, hrtf: false, voiceLimit: 24, musicAllowed: true, hrtfAllowed: false,
  paused: false, pauseSuspended: false, suspendTimer: 0, blockedTimer: 0, blockedShown: false, sessionHint: '',
  clock: 0, occlusionRays: 0, startedThisFrame: 0, maxStartedPerFrame: 0, updateMs: 0, peakUpdateMs: 0, started: 0,
  heartbeatClock: 0, gamepadClock: 0,
  lastShield: new Float32Array(MAX_ACTORS),
  captionClock: new Float64Array((MAX_ACTORS + 1) * AUDIO_CAPTION_KINDS.length),

  live() { return !Game.headless || this.forceActive; },
  canPlay() { return !!this.context && (this.assumeRunning || this.context.state === 'running'); },
  recipeIndex(id) { const recipe = this.recipeById.get(id); return recipe ? recipe.index : -1; },
  useHrtf() { return this.hrtf && this.hrtfAllowed && !this.mono; },

  // ---- Settings, quality ----
  onSetting(key) {
    if (key.startsWith('audio.')) this.applyVolumes();
    else if (key.startsWith('video.')) this.refreshQuality();
  },
  refreshQuality() {
    const quality = Quality.current();
    this.voiceLimit = Math.min(quality.voices, AUDIO_MAX_SLOTS);
    this.allocator.limit = this.voiceLimit;
    this.musicAllowed = quality.music;
    this.hrtfAllowed = AUDIO_HRTF_QUALITY.includes(quality.id);
  },
  applyVolumes() {
    for (const name in this.levels) this.levels[name] = Settings.get('audio.' + name);
    this.mono = Settings.get('audio.mono');
    this.hrtf = Settings.get('audio.hrtf');
    if (!this.buses) return;
    const now = this.context.currentTime;
    const buses = this.buses;
    for (const busName in AUDIO_BUS_LEVEL) {
      const level = this.levels[AUDIO_BUS_LEVEL[busName]];
      buses[busName].gain.setTargetAtTime(level * level, now, AUDIO_VOLUME_SMOOTHING);
    }
    buses.master.channelCount = this.mono ? 1 : 2;               // mono: the mix is folded to one channel (ACC-006)
    buses.master.channelCountMode = this.mono ? 'explicit' : 'max';
  },

  // ---- Context: created on the first user gesture (AUD-001) ----
  installGestureListeners() {
    const unlock = () => this.unlock();
    for (const name of AUDIO_GESTURES) window.addEventListener(name, unlock, { passive: true });
  },
  unlock() {
    if (!this.live()) return false;
    if (!this.context && !this.createContext()) return false;
    this.resumeContext();
    if (!this.blockedTimer && !this.canPlay()) this.blockedTimer = setTimeout(() => this.checkBlocked(), AUDIO_BLOCKED_CHECK_MS);
    return true;
  },
  createContext() {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    if (!this.contextFactory && !Constructor) { audioToast('Sound is not supported by this browser.'); return false; }
    this.sessionHint = this.configureSession(navigator);
    try {
      this.attach(this.contextFactory ? this.contextFactory() : new Constructor({ latencyHint: 'interactive' }));
      this.playSilence();
    } catch (error) {
      ErrorLog.add('audio.createContext', error);
      audioToast('Sound could not start on this device.');
      this.context = null; this.buses = null;
      return false;
    }
    return true;
  },
  // Older iOS only starts the audio hardware after a buffer was played inside the gesture handler.
  playSilence() {
    const source = this.context.createBufferSource();
    source.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
    source.connect(this.context.destination);
    source.start(0);
  },
  // iOS 17+: "playback" makes sound play with the silent switch on. Older iOS: tell the player once (AUD-001).
  configureSession(nav) {
    if (nav.audioSession) { nav.audioSession.type = 'playback'; return 'playback'; }
    if (!isAppleTouchDevice(nav)) return 'none';
    audioToast('Tip: turn off the silent switch, or your iPhone keeps the game sound muted.');
    return 'hint';
  },
  resumeContext() {
    if (!this.context || this.pauseSuspended || this.context.state === 'running') return;
    const attempt = this.context.resume();
    if (attempt && attempt.catch) attempt.catch(audioQuietCall);
  },
  checkBlocked() {
    this.blockedTimer = 0;
    if (this.canPlay() || this.pauseSuspended || this.blockedShown) return;
    this.blockedShown = true;
    audioToast('Sound is blocked by your browser. Tap or click the page to turn it on.');
  },
  attach(context) {
    this.context = context;
    this.buses = buildAudioBuses(context);
    this.noiseBuffer = buildNoiseBuffer(context);
    this.slots.length = 0;
    this.allocator.reset();
    this.refreshQuality();
    this.applyVolumes();
    for (let index = 0; index < this.voiceLimit; index++) this.ensureSlot(index);   // build the voice chains now, not in the middle of a fight
    this.enabled = context.state === 'running';
    context.onstatechange = () => { this.enabled = this.canPlay(); };
  },
  // Drops the context (tests, and the end of the page's life); event handling keeps working without it.
  detach() {
    clearTimeout(this.suspendTimer); clearTimeout(this.blockedTimer);
    this.suspendTimer = 0; this.blockedTimer = 0;
    this.context = null; this.buses = null; this.noiseBuffer = null; this.slots.length = 0;
    this.enabled = false; this.paused = false; this.pauseSuspended = false;
    this.allocator.reset();
  },
  // Game.pause: game sounds fade out (menu pause keeps menu clicks audible); any other pause also suspends the context.
  setPaused(paused, reason) {
    this.paused = paused;
    if (!this.buses) return;
    this.buses.game.gain.setTargetAtTime(paused ? 0 : 1, this.context.currentTime, AUDIO_PAUSE_TAU);
    clearTimeout(this.suspendTimer);
    if (paused && reason !== 'menu') {
      this.suspendTimer = setTimeout(() => this.suspendContext(), AUDIO_SUSPEND_DELAY_MS);
      return;
    }
    this.pauseSuspended = false;
    this.resumeContext();
  },
  suspendContext() {
    if (!this.context || !this.paused) return;
    this.pauseSuspended = true;
    const attempt = this.context.suspend();
    if (attempt && attempt.catch) attempt.catch(audioQuietCall);
  },

  // ---- Requests ----
  // The one entry point for sounds: recipe index, optional world position, the actor that makes it, level and pitch factors.
  enqueue(recipeIndex, positional, x, y, z, source, gain, pitch) {
    if (recipeIndex < 0 || !this.live()) return false;
    return SoundQueue.push(recipeIndex, positional, x, y, z, source, gain, pitch);
  },
  // Convenience for other sections: Sound.play('uiClick') or Sound.play('powerChime', x, y, z, ownerId).
  play(recipeId, x, y, z, source) {
    const positional = x !== undefined;
    return this.enqueue(this.recipeIndex(recipeId), positional, positional ? x : 0, positional ? y : 0, positional ? z : 0, source === undefined ? -1 : source, 1, 1);
  },
  speak(text) {
    if (!this.live() || typeof text !== 'string' || !text || !Settings.get('audio.speech')) return false;
    const synth = this.speechSynth || window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return false;
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.volume = clamp(this.levels.master * this.levels.announcer, 0, 1);
    utterance.rate = 1.05;
    synth.cancel();
    synth.speak(utterance);
    return true;
  },

  // ---- Frame update (Loop phase 'audio'): listener, player cues, queue -> voices. Budget 0.3 ms (AUD-007). ----
  update(seconds) {
    if (!this.live()) return;
    const started = performance.now();
    this.clock += seconds;
    this.occlusionRays = 0;
    this.startedThisFrame = 0;
    refreshAudioListener();
    this.pollGamepads(seconds);
    this.watchPlayerCues(seconds);
    for (let i = 0; i < this.frameHooks.length; i++) this.frameHooks[i](seconds);
    this.processQueue();
    if (this.context) this.releaseIdleSlots();
    this.maxStartedPerFrame = Math.max(this.maxStartedPerFrame, this.startedThisFrame);
    this.updateMs = performance.now() - started;
    this.peakUpdateMs = Math.max(this.updateMs, this.peakUpdateMs * 0.99);
  },
  // A button press on a gamepad is a user activation too (until the context runs).
  pollGamepads(seconds) {
    if (this.canPlay() || !navigator.getGamepads) return;
    this.gamepadClock += seconds;
    if (this.gamepadClock < AUDIO_GAMEPAD_POLL_SECONDS) return;
    this.gamepadClock = 0;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) if (pads[i] && padHasPressedButton(pads[i])) this.unlock();
  },
  // Heartbeat while the local player is low on health; shield-break cue when any actor's shield just ran out.
  watchPlayerCues(seconds) {
    this.watchShields();
    const id = Game.playerId;
    if (id < 0 || !Actors.alive[id] || Actors.maxHealth[id] <= 0) { this.heartbeatClock = 0; return; }
    const fraction = Actors.health[id] / Actors.maxHealth[id];
    if (fraction >= AUDIO_LOW_HEALTH) { this.heartbeatClock = 0; return; }
    this.heartbeatClock += seconds;
    const period = lerp(AUDIO_HEARTBEAT_FAST, AUDIO_HEARTBEAT_SLOW, fraction / AUDIO_LOW_HEALTH);
    if (this.heartbeatClock < period) return;
    this.heartbeatClock -= period;
    this.enqueue(this.recipeIndex('heartbeat'), false, 0, 0, 0, id, 1, 1);
  },
  watchShields() {
    const shieldBreak = this.recipeIndex('shieldBreak');
    for (let id = 0; id < Actors.count; id++) {
      const shield = Actors.alive[id] ? Actors.shield[id] : 0;
      const broke = this.lastShield[id] > 0.01 && shield <= 0.01 && Actors.alive[id];
      this.lastShield[id] = shield;
      if (broke) this.enqueue(shieldBreak, true, Actors.x[id], Actors.y[id] + Actors.height[id] * 0.5, Actors.z[id], id, 1, 1);
    }
  },
  processQueue() {
    const queue = SoundQueue;
    this.rankQueue();
    const cap = Math.max(2, Math.floor(this.voiceLimit / AUDIO_NEW_VOICE_DIVISOR));
    let started = 0;
    for (let row = queue.pickBest(); row >= 0 && started < cap; row = queue.pickBest()) {
      queue.taken[row] = 1;
      if (this.playRow(row)) started++;
    }
    queue.count = 0;
  },
  // Pass 1: distance and priority of every queued sound, so the cap keeps the most important ones.
  rankQueue() {
    const queue = SoundQueue;
    for (let row = 0; row < queue.count; row++) {
      const recipe = this.recipes[queue.recipe[row]];
      const positional = queue.positional[row] === 1 && audioListener.valid;
      queue.distance[row] = positional ? Math.sqrt(distanceSquared3(queue.x[row], queue.y[row], queue.z[row], audioListener.x, audioListener.y, audioListener.z)) : 0;
      queue.priority[row] = audioPriorityFor(recipe, queue.distance[row], isLocalPlayer(queue.source[row]));
    }
  },
  // Pass 2: spatial values, cull, occlusion, caption, voice. Returns true when a voice was started.
  playRow(row) {
    const queue = SoundQueue, spatial = audioSpatial;
    const recipe = this.recipes[queue.recipe[row]];
    const positional = queue.positional[row] === 1 && audioListener.valid;
    if (positional) computeAudioSpatial(spatial, recipe, queue.x[row], queue.y[row], queue.z[row]);
    else centerAudioSpatial(spatial);
    const level = spatial.gain * recipe.gain * queue.gain[row];
    if (level < AUDIO_AUDIBLE_GAIN || (positional && spatial.distance > recipe.range)) return false;
    if (positional && recipe.occludes && this.isOccluded(spatial, queue.x[row], queue.y[row], queue.z[row])) {
      spatial.occluded = true; spatial.cutoff *= AUDIO_OCCLUDED_CUTOFF; spatial.gain *= AUDIO_OCCLUDED_GAIN;
    }
    this.triggerCounts[recipe.index]++;
    const source = queue.source[row];
    if (positional && !isLocalPlayer(source)) this.emitCaption(recipe, spatial, source, queue.x[row], queue.y[row], queue.z[row]);
    if (!this.canPlay()) return false;
    return this.startVoice(recipe, spatial, spatial.gain * recipe.gain * queue.gain[row], queue.pitch[row], queue.priority[row]);
  },
  // Line of sight between listener and source; a few rays per frame, further requests count as unoccluded.
  isOccluded(spatial, x, y, z) {
    if (spatial.distance < AUDIO_OCCLUSION_MIN_DISTANCE || this.occlusionRays >= AUDIO_OCCLUSION_RAYS) return false;
    this.occlusionRays++;
    return !World.lineClear(audioListener.x, audioListener.y, audioListener.z, x, y, z);
  },
  // ACC-002 / ACC-003: caption text with direction plus the position for the visual sound ring, throttled per actor and kind.
  emitCaption(recipe, spatial, source, x, y, z) {
    if (recipe.captionKind < 0) return;
    const key = (source < 0 ? MAX_ACTORS : source) * AUDIO_CAPTION_KINDS.length + recipe.captionKind;
    if (this.clock - this.captionClock[key] < recipe.captionGap) return;
    this.captionClock[key] = this.clock;
    const payload = audioCaptionPayload;
    payload.text = recipe.captionTexts[spatial.direction];
    payload.x = x; payload.y = y; payload.z = z; payload.kind = AUDIO_CAPTION_KINDS[recipe.captionKind];
    Bus.emit('caption', payload);
  },

  // ---- Voices ----
  startVoice(recipe, spatial, level, pitch, priority) {
    const context = this.context, now = context.currentTime;
    const slotIndex = this.allocator.acquire(priority, spatial.distance, now, recipe.duration + AUDIO_STEAL_FADE + AUDIO_START_DELAY);
    if (slotIndex < 0) return false;
    const slot = this.ensureSlot(slotIndex);
    const stolen = this.allocator.lastWasSteal;
    const start = now + (stolen ? AUDIO_STEAL_FADE : AUDIO_START_DELAY);
    this.clearSlot(slot, now, stolen);
    routeSlot(slot, this.buses[recipe.bus]);
    placeSlot(slot, spatial, start);
    slot.mix.gain.setValueAtTime(level, start);
    const voicePitch = pitch * (1 + (Rng.fx.next() - 0.5) * AUDIO_PITCH_JITTER);
    if (recipe.noise) startNoiseLayer(slot, recipe, recipe.noise, voicePitch, start);
    else slot.noiseGain.gain.setValueAtTime(AUDIO_FLOOR_GAIN, start);
    if (recipe.tone) startToneLayer(slot, recipe, recipe.tone, voicePitch, start);
    else slot.toneGain.gain.setValueAtTime(AUDIO_FLOOR_GAIN, start);
    this.startedThisFrame++;
    this.started++;
    return true;
  },
  ensureSlot(index) {
    if (!this.slots[index]) this.slots[index] = createVoiceSlot(this.context);
    const slot = this.slots[index];
    const kind = this.useHrtf() ? 'hrtf' : (this.context.createStereoPanner ? 'stereo' : 'equalpower');
    if (slot.spatialKind !== kind) attachSlotSpatial(this.context, slot, kind);
    return slot;
  },
  // Prepares a reused slot. A voice that ended by itself has no automation left to clear; a stolen one fades out quickly
  // and every pending automation event is dropped (the sources keep running, the gains decide what is heard).
  clearSlot(slot, now, stolen) {
    setSlotConnected(slot, true);
    if (!stolen) return;
    slot.mix.gain.cancelScheduledValues(now);
    slot.mix.gain.setValueAtTime(slot.mix.gain.value, now);
    slot.mix.gain.linearRampToValueAtTime(0, now + AUDIO_STEAL_FADE * 0.8);
    for (let i = 1; i < slot.params.length; i++) slot.params[i].cancelScheduledValues(now);
  },
  // Slots whose voice ended are cut from the output (no audio-thread work while idle).
  releaseIdleSlots() {
    const now = this.context.currentTime;
    for (let index = 0; index < this.slots.length; index++) {
      if (this.slots[index] && this.allocator.endTime[index] <= now) setSlotConnected(this.slots[index], false);
    }
  },

  stats() {
    return { voices: this.context ? this.allocator.activeCount(this.context.currentTime) : 0, voiceLimit: this.voiceLimit, started: this.started,
      stolen: this.allocator.stolen, rejected: this.allocator.rejected, queueDropped: SoundQueue.dropped, updateMs: this.updateMs,
      peakUpdateMs: this.peakUpdateMs, maxStartedPerFrame: this.maxStartedPerFrame, enabled: this.enabled };
  },
  // Clean slate between matches and between tests. Voices that still ring out keep their pool slots.
  resetState() {
    SoundQueue.count = 0; SoundQueue.dropped = 0;
    this.lastShield.fill(0); this.captionClock.fill(-1000); this.heartbeatClock = 0;
    this.clock = 0; this.started = 0; this.maxStartedPerFrame = 0; this.peakUpdateMs = 0;
    this.triggerCounts.fill(0);
  },
};

function padHasPressedButton(pad) {
  for (let i = 0; i < pad.buttons.length; i++) if (pad.buttons[i].pressed) return true;
  return false;
}

Sound.captionClock.fill(-1000);
Bus.on('setting', (key) => Sound.onSetting(key));
Bus.on('game.pause', (reason) => Sound.setPaused(true, reason));
Bus.on('game.resume', () => Sound.setPaused(false, ''));
Bus.on('match.start', () => { Sound.resetState(); Sound.refreshQuality(); });
Bus.on('match.stop', () => Sound.resetState());
Bus.on('boot', () => {
  Loop.onFrame('audio', (seconds) => {
    Sound.update(seconds);
    Perf.counters.audioMs = Sound.updateMs;
  });
  Sound.installGestureListeners();
});
