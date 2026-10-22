// ==== S06 AUDIO: GENERATIVE MUSIC ====
// AUD-006: three layers over one chord progression, driven by recent combat intensity.
//   calm   = soft pad (three oscillators gliding between chords)
//   combat = bass + arpeggio + hi-hat pattern
//   boss   = low drone + tritone stabs on top of the combat layer
// Every oscillator exists once and runs while music plays; the scheduler only writes parameter events a quarter second ahead,
// so music never creates nodes per note (AUD-007). Off on Potato (Quality.current().music) and when the music volume is 0.

const MUSIC_BPM = 100;
const MUSIC_STEP_SECONDS = 60 / MUSIC_BPM / 4;     // sixteenth notes
const MUSIC_STEPS_PER_BAR = 16;
const MUSIC_BARS_PER_CHORD = 2;
const MUSIC_LOOKAHEAD = 0.25;                      // seconds of steps scheduled ahead of the audio clock
const MUSIC_STALL_SECONDS = 0.5;                   // a scheduler this far behind the clock restarts instead of replaying the past
const MUSIC_ROOT_HZ = 55;                          // A1
const MUSIC_MOODS = ['auto', 'calm', 'combat', 'boss'];
const MUSIC_LAYER_UPDATE_SECONDS = 0.2;            // layer gains are retargeted 5 times a second
const MUSIC_LAYER_FADE = 0.8;                      // seconds, time constant of a layer cross-fade
const MUSIC_INTENSITY_DECAY = 0.08;                // intensity per second back towards calm
const MUSIC_COMBAT_FROM = 0.15;                    // intensity where the combat layer starts to fade in
const MUSIC_COMBAT_TO = 0.55;                      // intensity where it is fully in
const MUSIC_CALM_UNDER_COMBAT = 0.65;              // how much the calm layer drops when combat is fully in
const MUSIC_MIN_WEIGHT = 0.02;                     // layers quieter than this are not scheduled
const MUSIC_IDLE_CUT_SECONDS = 4;                  // a layer silent this long (5 fade time constants) is cut from the output
const MUSIC_NEAR_DAMAGE_SQ = 25 * 25;              // damage this close to the listener excites the music
const MUSIC_DRONE_DETUNE = 1.007;
const MUSIC_CHORDS = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];   // semitones above A: Am, F, C, G
const MUSIC_BASS_STEPS = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
const MUSIC_ARP_NOTES = [0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 3, 2, 1, 0];  // chord tone index; 3 = the root an octave up
const MUSIC_HAT_STEPS = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0];
const MUSIC_STAB_STEPS = [0, 10];
const MUSIC_STAB_SEMITONES = 6;                    // tritone above the chord root
const MUSIC_LAYER_LEVELS = { calm: 0.9, combat: 0.8, boss: 0.7 };

const musicHz = (semitones, octaveFactor) => MUSIC_ROOT_HZ * octaveFactor * Math.pow(2, semitones / 12);

// One always-running oscillator -> low-pass -> gain -> destination.
function makeMusicVoice(context, wave, cutoff, level, destination) {
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  oscillator.type = wave;
  filter.type = 'lowpass'; filter.frequency.value = cutoff;
  gain.gain.value = level;
  oscillator.connect(filter); filter.connect(gain); gain.connect(destination);
  oscillator.start();
  return { oscillator, filter, gain };
}

function makeMusicHat(context, noiseBuffer, destination) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = noiseBuffer; source.loop = true;
  filter.type = 'highpass'; filter.frequency.value = 7000;
  gain.gain.value = AUDIO_FLOOR_GAIN;
  source.connect(filter); filter.connect(gain); gain.connect(destination);
  source.start();
  return { oscillator: source, gain };
}

// One short note: the voice's gain follows an envelope, its pitch jumps to hz.
function playMusicNote(voice, hz, time, peak, length) {
  voice.oscillator.frequency.setValueAtTime(hz, time);
  scheduleEnvelope(voice.gain.gain, time, peak, 0.01, length);
}

const SoundMusic = {
  mood: 'auto',          // 'auto' follows the intensity, the others force a layer mix (boss fights, menus)
  intensity: 0,          // 0..1, raised by damage near the listener, decays over seconds
  bosses: 0,             // boss fights going on ('pve.boss' start minus defeated; 0 again when the match ends or stops)
  nodes: null, layerClock: 0, step: 0, bar: 0, nextStepTime: 0,
  weights: { calm: 1, combat: 0, boss: 0 },

  setMood(name) {
    if (!MUSIC_MOODS.includes(name)) return false;
    this.mood = name;
    return true;
  },
  // Menus are always calm; during a match the mood decides, and 'auto' plays the boss layer while a boss fights (AUD-006).
  effectiveMood() {
    if (Game.state !== 'playing') return 'calm';
    return this.mood === 'auto' && this.bosses > 0 ? 'boss' : this.mood;
  },
  onBoss(payload) {
    if (payload.kind === 'start') this.bosses++;
    if (payload.kind === 'defeated') this.bosses = Math.max(0, this.bosses - 1);
  },
  resetMatch() { this.intensity = 0; this.bosses = 0; },

  onDamage(payload) {
    if (!Sound.live()) return;
    if (isLocalPlayer(payload.source) || isLocalPlayer(payload.target)) { this.excite(payload.amount / 150, 0.35); return; }
    const near = audioListener.valid && distanceSquared3(payload.x, payload.y, payload.z, audioListener.x, audioListener.y, audioListener.z) < MUSIC_NEAR_DAMAGE_SQ;
    if (near) this.excite(payload.amount / 400, 0.15);
  },
  excite(amount, cap) {
    if (!(amount > 0)) return;                     // also rejects NaN from a payload without an amount
    this.intensity = Math.min(1, this.intensity + Math.min(amount, cap));
  },

  update(seconds) {
    this.intensity = Math.max(0, this.intensity - seconds * MUSIC_INTENSITY_DECAY);
    const allowed = Sound.musicAllowed && Sound.levels.music > 0;
    if (allowed && !this.nodes && Sound.canPlay()) this.build();
    if (!allowed && this.nodes) this.stop();
    if (!this.nodes || !Sound.canPlay()) return;
    this.updateLayers(seconds);
    this.scheduleUntil(Sound.context.currentTime + MUSIC_LOOKAHEAD);
  },
  // Target mix for the current mood (pure: tests read it without a context).
  targetWeights(out) {
    const mood = this.effectiveMood();
    const forced = mood === 'calm' ? 0 : 1;
    const combat = mood === 'auto' ? smoothstep(MUSIC_COMBAT_FROM, MUSIC_COMBAT_TO, this.intensity) : forced;
    out.combat = combat;
    out.boss = mood === 'boss' ? 1 : 0;
    out.calm = 1 - MUSIC_CALM_UNDER_COMBAT * combat;
    return out;
  },
  updateLayers(seconds) {
    this.layerClock += seconds;
    if (this.layerClock < MUSIC_LAYER_UPDATE_SECONDS) return;
    const elapsed = this.layerClock;
    this.layerClock = 0;
    const weights = this.targetWeights(this.weights);
    const now = Sound.context.currentTime;
    for (const name in MUSIC_LAYER_LEVELS) {
      this.nodes[name].gain.setTargetAtTime(weights[name] * MUSIC_LAYER_LEVELS[name], now, MUSIC_LAYER_FADE);
      this.linkLayer(name, weights[name] >= MUSIC_MIN_WEIGHT, elapsed);
    }
  },
  // A layer that stayed silent long enough is cut from the output (the audio thread then skips its oscillators) and
  // reconnected the moment it is wanted again; its gain is still near 0 then, so it fades in without a click.
  linkLayer(name, wanted, seconds) {
    const nodes = this.nodes;
    nodes.silentFor[name] = wanted ? 0 : nodes.silentFor[name] + seconds;
    const shouldLink = nodes.silentFor[name] < MUSIC_IDLE_CUT_SECONDS;
    if (nodes.linked[name] === shouldLink) return;
    if (shouldLink) nodes[name].connect(nodes.output);
    else nodes[name].disconnect();
    nodes.linked[name] = shouldLink;
  },

  build() {
    const context = Sound.context;
    const output = context.createGain();
    output.connect(Sound.buses.music);
    const layer = () => { const node = context.createGain(); node.gain.value = 0; node.connect(output); return node; };
    const nodes = { output, calm: layer(), combat: layer(), boss: layer() };
    nodes.linked = { calm: true, combat: true, boss: true };
    nodes.silentFor = { calm: MUSIC_IDLE_CUT_SECONDS, combat: MUSIC_IDLE_CUT_SECONDS, boss: MUSIC_IDLE_CUT_SECONDS };   // the first update cuts what is not wanted
    nodes.pad = Array.from({ length: 3 }, () => makeMusicVoice(context, 'triangle', 900, 0.12, nodes.calm));
    nodes.bass = makeMusicVoice(context, 'sawtooth', 500, AUDIO_FLOOR_GAIN, nodes.combat);
    nodes.arp = makeMusicVoice(context, 'square', 2200, AUDIO_FLOOR_GAIN, nodes.combat);
    nodes.hat = makeMusicHat(context, Sound.noiseBuffer, nodes.combat);
    nodes.drone = Array.from({ length: 2 }, () => makeMusicVoice(context, 'sawtooth', 260, 0.1, nodes.boss));
    nodes.stab = makeMusicVoice(context, 'square', 1800, AUDIO_FLOOR_GAIN, nodes.boss);
    this.nodes = nodes;
    this.step = 0; this.bar = 0; this.layerClock = MUSIC_LAYER_UPDATE_SECONDS;
    this.nextStepTime = context.currentTime + 0.1;
    this.setChord(0, context.currentTime, 0.001);
    this.updateLayers(0);
  },
  stop() {
    const nodes = this.nodes;
    this.nodes = null;
    const oscillators = [...nodes.pad, ...nodes.drone, nodes.bass, nodes.arp, nodes.hat, nodes.stab];
    for (const voice of oscillators) voice.oscillator.stop();
    nodes.output.disconnect();
  },

  chordAt(bar) { return MUSIC_CHORDS[Math.floor(bar / MUSIC_BARS_PER_CHORD) % MUSIC_CHORDS.length]; },
  // The pad glides to the chord's three notes, the drone to its root.
  setChord(bar, time, glide) {
    const chord = this.chordAt(bar);
    this.nodes.pad.forEach((voice, index) => voice.oscillator.frequency.setTargetAtTime(musicHz(chord[index], 4), time, glide));
    this.nodes.drone.forEach((voice, index) => voice.oscillator.frequency.setTargetAtTime(musicHz(chord[0], 2) * (index ? MUSIC_DRONE_DETUNE : 1), time, glide));
  },
  // Schedules every sixteenth-note step that starts before `horizon` (seconds on the audio clock).
  scheduleUntil(horizon) {
    const now = Sound.context.currentTime;
    if (this.nextStepTime < now - MUSIC_STALL_SECONDS) this.nextStepTime = now + 0.05;
    while (this.nextStepTime < horizon) {
      this.scheduleStep(this.nextStepTime);
      this.nextStepTime += MUSIC_STEP_SECONDS;
    }
  },
  scheduleStep(time) {
    const chord = this.chordAt(this.bar);
    if (this.step === 0 && this.bar % MUSIC_BARS_PER_CHORD === 0) this.setChord(this.bar, time, 0.4);
    if (this.weights.combat > MUSIC_MIN_WEIGHT) this.scheduleCombat(time, chord);
    if (this.weights.boss > MUSIC_MIN_WEIGHT && MUSIC_STAB_STEPS.includes(this.step)) {
      playMusicNote(this.nodes.stab, musicHz(chord[0] + MUSIC_STAB_SEMITONES, 8), time, 0.3, MUSIC_STEP_SECONDS * 3);
    }
    this.step++;
    if (this.step < MUSIC_STEPS_PER_BAR) return;
    this.step = 0;
    this.bar++;
  },
  scheduleCombat(time, chord) {
    if (MUSIC_BASS_STEPS[this.step]) playMusicNote(this.nodes.bass, musicHz(chord[0], 2), time, 0.5, MUSIC_STEP_SECONDS * 1.8);
    if (MUSIC_HAT_STEPS[this.step]) scheduleEnvelope(this.nodes.hat.gain.gain, time, 0.25, 0.002, 0.04);
    const index = MUSIC_ARP_NOTES[this.step];
    const semitones = chord[index % 3] + 12 * Math.floor(index / 3);
    playMusicNote(this.nodes.arp, musicHz(semitones, 8), time, 0.12, MUSIC_STEP_SECONDS * 0.9);
  },
};

Sound.setMusicMood = (name) => SoundMusic.setMood(name);
Sound.frameHooks.push((seconds) => SoundMusic.update(seconds));
Bus.on('damage', (payload) => SoundMusic.onDamage(payload));
Bus.on('pve.boss', (payload) => SoundMusic.onBoss(payload));
Bus.on('match.start', () => SoundMusic.resetMatch());
Bus.on('match.end', () => { SoundMusic.bosses = 0; });
Bus.on('match.stop', () => SoundMusic.resetMatch());
