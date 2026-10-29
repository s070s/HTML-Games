// 06-instruments.js - M-06 FLM.Instruments (T04.06): the data-driven instrument table (128 General MIDI programs from 16
// family templates, 12 synthesized drum voices for the keys 35 to 81), the voices that realize them on the Web Audio
// graph of M-05, program change, controllers, pitch bend, the sustain pedal and the live note path.
// Separation rule: this file owns exactly one namespace and registers it once through FLM.Core.define. It uses only
// lower-numbered modules (Core, Theory, Model, Audio at run time through attach()). State lives inside the factory
// closure and belongs to the one engine that attach() was given (S-07); a second attach replaces it.
// Sound: every instrument is synthesized (ADR-04): subtractive, FM, Karplus-Strong pluck, noise and additive recipes.
// The word "sampled" never describes an instrument here. Real sound output is judged by the listening reviews LT-031,
// LT-041 and LT-042 (Phase 15); the unit tests render offline and check timing, pitch, level and node counts.
// Spec: docs/IMPLEMENTATION-PLAN.md Part 6.6 (API 6.6.2, tables 6.6.3, algorithms 6.6.4, tests 6.6.8).
// Voice contract with M-05 (VoiceAllocator): voice.release(at, rampS), voice.stop(at, fadeS), voice.dispose(),
// voice.levelAt(t). The Scheduler calls startLive, stopLive and applyLive for the live path; the public liveNoteOn,
// liveNoteOff and controlLive (called by M-08) go through Audio.Scheduler.liveNoteOn / liveNoteOff / liveControl so
// that every live note also announces itself as a sched.* event.
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Instruments', function (FLM) {
  const Core = FLM.Core;
  const Log = Core.Log;

  const VERSION = 1;
  const PROGRAM_COUNT = 128;
  const FAMILY_SIZE = 8;                     // programs per General MIDI family
  const A4_HZ = 440;
  const A4_MIDI = 69;
  const SEMITONES = 12;
  const MIDDLE_C_HZ = 261.63;
  const CENTS_PER_SEMITONE = 100;
  const MIN_RAMP_S = 0.002;                  // attack and release ramps are at least 2 ms (no clicks)
  const STOP_PAD_S = 0.02;                   // sources stop this long after the release ramp
  const STEAL_FADE_S = 0.005;                // default fade of stop()
  const MONO_RELEASE_S = 0.01;               // legato approximation: the previous voice ends in 10 ms
  const RETRIGGER_RELEASE_S = 0.01;
  const CHOKE_RELEASE_S = 0.02;              // a closed hat chokes an open hat in 20 ms
  const BEND_TIME_CONSTANT_S = 0.005;
  const BEND_RANGE_DEFAULT = 2;              // semitones (RPN 0)
  const BEND_RANGE_MAX = 24;
  const BEND_CENTER = 8192;
  const MOD_DEPTH_MAX_CENTS = 50;            // CC 1 at 127
  const VIBRATO_RAMP_S = 0.2;
  const MAX_VOICE_NODES = 11;                // UT-06-22: Part 6.6.6, with the mod wheel fully up (drum hits: 8)
  const MAX_DRUM_NODES = 8;
  const VOICE_MAX_S = 60;                    // the same cap as M-05 (scheduled and live notes)
  const PRIME_LEAD_S = 1000;                 // a primed voice would start far in the future and is never started
  const PRIME_MAX_VOICES = 48;
  const PRIME_PITCH = 60;
  const PRIME_STRIP = '__prime__';
  const PRIME_VELOCITY = 100;
  const PLUCK_FADE_S = 0.02;                 // the end of a pluck buffer fades out: no click when it runs out (RISK-70)
  const MIDI_MAX = 127;
  const MIDI_HALF = 64;
  const MIDI_PAN_SPAN = 63;
  const DRUM_MIN_KEY = 35;
  const DRUM_MAX_KEY = 81;
  const OUT_OF_MAP_VELOCITY = 0.6;           // keys outside 35..81: shakerMisc at 60 percent
  const DRUM_MAX_S = 2;
  const DECAY_DIVISOR = 5;                   // a drum decay of d seconds falls to under 1 percent in d seconds
  const DRUM_TAIL = 1.5;                     // a drum hit is silent after this many of its decay times
  const PLUCK_CAP_DESKTOP = 48;
  const PLUCK_CAP_MOBILE = 24;
  const PLUCK_PEAK = 0.9;
  const PLUCK_YIELD_EVERY = 8;
  const NOISE_SECONDS = 1;
  const NOISE_SEED = 0x5EED;
  const WATCHDOG_GRACE_S = 1;                // a slot whose release ended this long ago without onended is freed
  const SWEEP_EVERY_S = 1;
  const SHAPER_POINTS = 1024;
  const SHAPER_SPAN = 2;                     // the curve covers x in -1..1 through tanh(k x)
  const VEL_REFERENCE = 127;
  const GAIN_KEY_SCALE = 1000;
  const PROPS = Object.freeze({ keys: 'keyboard', percussion: 'mallets', guitar: 'guitar', bass: 'bass',
    strings: 'bowed', winds: 'horn', synth: 'keyboard', abstract: 'generic' });
  const CONTROLLERS = Object.freeze([1, 7, 10, 11, 64, 120, 121, 123]);
  const FAMILY_NAMES = Object.freeze(['Piano', 'Chromatic Percussion', 'Organ', 'Guitar', 'Bass', 'Strings',
    'Ensemble', 'Brass', 'Reed', 'Pipe', 'Synth Lead', 'Synth Pad', 'Synth Effects', 'Ethnic', 'Percussive',
    'Sound Effects']);
  const SYNTH_BASIC = Object.freeze([16, 17, 18, 19, 20, 109, 119, 120, 121, 122, 123, 124, 125, 126, 127]);

  // ---------------------------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------------------------
  const finiteOr = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const messageOf = (error) => (error && error.message ? String(error.message) : String(error));
  const frequencyOf = (pitch) => A4_HZ * Math.pow(2, (pitch - A4_MIDI) / SEMITONES);

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach((key) => deepFreeze(value[key]));
    }
    return value;
  }

  // ---------------------------------------------------------------------------------------------
  // The family templates (6.6.3): sixteen records in General MIDI family order
  // ---------------------------------------------------------------------------------------------
  const osc = (type, ratio, detune, gain) => ({ type, ratio, detune, gain });
  const fixedOsc = (type, hz, gain) => ({ type, ratio: 1, detune: 0, gain, hz });
  const layer = (maxVel, gainMul, cutoffMul) => ({ maxVel, gainMul, cutoffMul });
  const filter = (type, cutoff, velCutoff, keyTrack, q, env) => ({ type, cutoff, velCutoff, keyTrack, q, env });
  const filterEnv = (attack, decay, sustain) => ({ attack, decay, sustain });
  const amp = (a, d, s, r, decay2) => ({ a, d, s, r, decay2: decay2 === undefined ? null : decay2 });
  const noise = (color, gain, bandpassHz, q, decay) => ({ color, gain, bandpassHz, q, decay });
  const ONE_LAYER = Object.freeze([layer(127, 1, 1)]);

  function template(id, spec) {
    return Object.assign({ id, oscs: [], partials: null, noise: null, fm: null, pluck: null, shape: null, formant: null,
      ampLfo: null, drone: null, drop: null, echoes: null, pitch: 0, gain: 1, mono: false, releaseMax: 2.0,
      vibrato: { rate: 5.5, autoDepth: 0, delay: 0.3 }, layers: ONE_LAYER.slice() }, spec);
  }

  const TEMPLATES = deepFreeze([
    template('piano', { oscs: [osc('triangle', 1, 0, 1), osc('sawtooth', 1, 3, 0.35), osc('sine', 2, 0, 0.15)],
      filter: filter('lowpass', 1800, 3200, 0.5, 0.7, filterEnv(0.002, 0.5, 0.35)), amp: amp(0.002, 0.9, 0.30, 0.18, 3.0),
      vel: { exp: 1.6, min: 0.06 }, layers: [layer(48, 0.7, 0.6), layer(96, 0.9, 0.85), layer(127, 1, 1)],
      range: [21, 108], polyphonyHint: 24, animProfile: 'keys' }),
    template('chromatic', { oscs: [osc('sine', 1, 0, 1)], fm: { ratio: 3.5, index: 2.2, decay: 0.6 },
      filter: filter('lowpass', 6000, 2000, 0.3, 0.5, filterEnv(0.001, 0.4, 0.5)), amp: amp(0.001, 1.4, 0, 0.4),
      vel: { exp: 1.4, min: 0.1 }, layers: [layer(64, 0.8, 1), layer(127, 1, 1)], range: [48, 108], polyphonyHint: 12,
      animProfile: 'percussion' }),
    template('organ', { partials: [[0.5, 0.3], [1, 1], [2, 0.6], [3, 0.35], [4, 0.2]],
      filter: filter('lowpass', 5000, 0, 0, 0.3, null), amp: amp(0.006, 0, 1.0, 0.06), vel: { exp: 1, min: 1 },
      range: [36, 96], polyphonyHint: 16, animProfile: 'keys' }),
    template('guitar', { pluck: { damping: 0.996, brightness: 0.7, seconds: 2.5, pickPos: 0.2 },
      filter: filter('lowpass', 2600, 2400, 0.4, 0.8, filterEnv(0.001, 0.25, 0.4)), amp: amp(0.001, 0, 1.0, 0.08),
      vel: { exp: 1.5, min: 0.1 }, layers: [layer(70, 0.8, 0.7), layer(127, 1, 1)], range: [40, 88], polyphonyHint: 8,
      animProfile: 'guitar' }),
    template('bass', { pluck: { damping: 0.998, brightness: 0.45, seconds: 3.0, pickPos: 0.3 },
      filter: filter('lowpass', 900, 1200, 0.3, 1.2, filterEnv(0.002, 0.3, 0.3)), amp: amp(0.002, 0, 1.0, 0.10),
      vel: { exp: 1.4, min: 0.15 }, layers: [layer(80, 0.85, 0.7), layer(127, 1, 1)], range: [28, 67], polyphonyHint: 4,
      animProfile: 'bass' }),
    template('strings', { oscs: [osc('sawtooth', 1, -7, 0.6), osc('sawtooth', 1, 0, 0.7), osc('sawtooth', 1, 7, 0.6)],
      filter: filter('lowpass', 1600, 1800, 0.5, 0.6, filterEnv(0.08, 0.3, 0.7)), amp: amp(0.08, 0.25, 0.85, 0.35),
      vel: { exp: 1.2, min: 0.2 }, layers: [layer(90, 0.85, 0.8), layer(127, 1, 1)], range: [36, 100],
      polyphonyHint: 16, animProfile: 'strings' }),
    template('ensemble', { oscs: [osc('sawtooth', 1, -12, 0.5), osc('sawtooth', 1, 0, 0.6), osc('sawtooth', 1, 12, 0.5),
      osc('triangle', 1, 0, 0.3)], filter: filter('lowpass', 1400, 1200, 0.4, 0.7, filterEnv(0.15, 0.4, 0.75)),
    amp: amp(0.14, 0.3, 0.9, 0.5), vel: { exp: 1.1, min: 0.25 }, range: [36, 96], polyphonyHint: 24,
    animProfile: 'strings' }),
    template('brass', { oscs: [osc('sawtooth', 1, 0, 0.8), osc('square', 1, 5, 0.35)],
      filter: filter('lowpass', 1200, 2600, 0.4, 1.4, filterEnv(0.05, 0.12, 0.7)), amp: amp(0.035, 0.1, 0.8, 0.14),
      vel: { exp: 1.5, min: 0.12 }, layers: [layer(80, 0.8, 0.7), layer(127, 1, 1)], range: [40, 84], polyphonyHint: 8,
      animProfile: 'winds' }),
    template('reed', { oscs: [osc('square', 1, 0, 0.7), osc('sawtooth', 1, 0, 0.35)],
      noise: noise('white', 0.03, -2, 1, null), filter: filter('lowpass', 1500, 2000, 0.6, 1.0, filterEnv(0.04, 0.15, 0.65)),
      amp: amp(0.045, 0.1, 0.85, 0.12), vel: { exp: 1.3, min: 0.15 }, range: [48, 96], polyphonyHint: 8,
      animProfile: 'winds' }),
    template('pipe', { oscs: [osc('sine', 1, 0, 0.8), osc('triangle', 1, 0, 0.35)],
      noise: noise('white', 0.05, -1, 8, 0.08), filter: filter('lowpass', 3000, 1500, 0.5, 0.5, filterEnv(0.06, 0.1, 0.8)),
      amp: amp(0.06, 0.08, 0.9, 0.10), vel: { exp: 1.2, min: 0.2 }, range: [55, 103], polyphonyHint: 8,
      animProfile: 'winds' }),
    template('synthLead', { oscs: [osc('sawtooth', 1, -8, 0.6), osc('sawtooth', 1, 8, 0.6)],
      filter: filter('lowpass', 2400, 3000, 0.3, 1.8, filterEnv(0.005, 0.2, 0.5)), amp: amp(0.005, 0.1, 0.8, 0.10),
      vel: { exp: 1.3, min: 0.15 }, range: [36, 96], polyphonyHint: 8, animProfile: 'synth' }),
    template('synthPad', { oscs: [osc('sawtooth', 1, -10, 0.4), osc('triangle', 1, 0, 0.5), osc('sawtooth', 1, 10, 0.4)],
      filter: filter('lowpass', 1000, 900, 0.3, 0.9, filterEnv(0.6, 1.0, 0.6)), amp: amp(0.45, 0.6, 0.9, 0.9),
      vel: { exp: 1.1, min: 0.3 }, range: [36, 96], polyphonyHint: 16, animProfile: 'synth' }),
    template('synthFx', { oscs: [osc('sine', 1, 0, 0.6)], fm: { ratio: 2.01, index: 4, decay: 1.2 },
      noise: noise('pink', 0.1, null, 1, null), filter: filter('bandpass', 800, 2400, 0.2, 2.5, filterEnv(0.3, 1.5, 0.3)),
      amp: amp(0.2, 0.8, 0.6, 0.8), vel: { exp: 1.0, min: 0.3 }, range: [36, 96], polyphonyHint: 8, animProfile: 'synth' }),
    template('ethnic', { pluck: { damping: 0.993, brightness: 0.8, seconds: 1.5, pickPos: 0.1 },
      filter: filter('lowpass', 3200, 2000, 0.4, 0.9, filterEnv(0.001, 0.2, 0.4)), amp: amp(0.001, 0, 1.0, 0.07),
      vel: { exp: 1.5, min: 0.1 }, layers: [layer(70, 0.8, 0.7), layer(127, 1, 1)], range: [43, 91], polyphonyHint: 8,
      animProfile: 'guitar' }),
    template('percussive', { oscs: [osc('sine', 1, 0, 0.8)], drop: { oct: 1, s: 0.03 },
      noise: noise('white', 0.5, 3000, 1, 0.06), filter: filter('lowpass', 5000, 3000, 0.3, 0.7, filterEnv(0.001, 0.15, 0.3)),
      amp: amp(0.001, 0.35, 0, 0.12), vel: { exp: 1.4, min: 0.1 }, layers: [layer(64, 0.75, 0.9), layer(127, 1, 1)],
      range: [36, 96], polyphonyHint: 8, animProfile: 'percussion' }),
    template('sfx', { oscs: [osc('sine', 1, 0, 0.2)], noise: noise('pink', 0.6, 600, 0.8, 0.8),
      filter: filter('bandpass', 900, 1500, 0, 1.2, filterEnv(0.1, 0.6, 0.4)), amp: amp(0.05, 0.6, 0.3, 0.4),
      vel: { exp: 1.0, min: 0.3 }, range: [36, 96], polyphonyHint: 4, animProfile: 'abstract' })
  ]);

  // Program -> template index, as runs of equal templates (family order of TEMPLATES).
  const TEMPLATE_RUNS = Object.freeze([[0, 3, 0], [4, 5, 1], [6, 7, 3], [8, 11, 1], [12, 13, 14], [14, 14, 1],
    [15, 15, 3], [16, 19, 2], [20, 23, 8], [24, 31, 3], [32, 39, 4], [40, 44, 5], [45, 46, 3], [47, 47, 14],
    [48, 55, 6], [56, 63, 7], [64, 71, 8], [72, 79, 9], [80, 87, 10], [88, 95, 11], [96, 103, 12], [104, 107, 13],
    [108, 108, 14], [109, 109, 8], [110, 110, 5], [111, 111, 8], [112, 112, 1], [113, 113, 14], [114, 114, 1],
    [115, 118, 14], [119, 127, 15]]);

  const SFX_WIDE = { ftype: 'lowpass', cutoff: 12000, vel: 0, q: 0.5, kt: 0, fenv: null };
  const CHOIR_OSCS = [osc('sawtooth', 1, -12, 0.3), osc('triangle', 1, 0, 0.6), osc('sawtooth', 1, 12, 0.3),
    osc('triangle', 1, 7, 0.6)];
  const CHOIR_NOISE = { color: 'white', gain: 0.08, bp: null, q: 1, decay: null };
  const VIOLIN_OSCS = [osc('sawtooth', 1, -7, 0.5), osc('sawtooth', 1, 0, 0.8), osc('sawtooth', 1, 7, 0.5)];
  const ORGAN_BASE = [[0.5, 0.3], [1, 1], [2, 0.6], [3, 0.35], [4, 0.2]];
  const LEAD_BASE = { mono: true };
  const BRASS_SYNTH = { oscs: [osc('sawtooth', 1, -12, 0.8), osc('sawtooth', 1, 12, 0.8)], cutoff: 1500, q: 2.0,
    fenv: { d: 0.3 } };

  // Per-program overrides. Keys: cutoff, vel (velCutoff), q, kt, ftype, fenv {a, d, sustain}, amp {a, d, s, r, d2},
  // range, oscs (replace), addOscs, oscGain {index: gain}, partials, fm, noise (merge; null removes), pluck (merge; null
  // removes), vib {depth, rate, delay}, velFlat, shape, formant [hz, q], mono, pitch, gain, drone {ratio, gain},
  // drop {oct, s} (null removes), ampLfo {hz, depth}, echoes [[delay, gain]].
  const OVERRIDES = Object.freeze({
    1: { cutoff: 2400, vel: 3600 },
    2: { oscGain: { 1: 0.2 }, cutoff: 2200, amp: { d2: 2.0 } },
    3: { addOscs: [osc('triangle', 1, 9, 0.6)] },
    4: { fm: { ratio: 1.0, index: 1.4, decay: 0.8 }, amp: { d: 2.0, s: 0.2, r: 0.25 }, range: [28, 103] },
    5: { fm: { ratio: 2.0, index: 1.0, decay: 1.0 }, amp: { d: 2.5, s: 0.25, r: 0.3 }, range: [28, 103] },
    6: { pluck: { damping: 0.994, brightness: 0.95, seconds: 1.5 }, cutoff: 4000, amp: { r: 0.05 }, range: [29, 89] },
    7: { pluck: { damping: 0.992, brightness: 0.9, seconds: 1.0 }, cutoff: 2800, q: 2.0, range: [36, 96] },
    8: { fm: { ratio: 4.0, index: 1.5, decay: 0.4 }, amp: { d: 1.0 } },
    9: { fm: { ratio: 5.0, index: 1.8, decay: 0.5 }, amp: { d: 1.6 }, range: [72, 108] },
    10: { fm: { ratio: 3.0, index: 1.2, decay: 0.3 }, amp: { d: 1.0 }, range: [60, 100] },
    11: { fm: { ratio: 4.0, index: 0.8, decay: 1.0 }, amp: { d: 2.5 }, vib: { depth: 15, rate: 4.5, delay: 0 } },
    12: { drop: null, noise: { gain: 0.15 }, amp: { d: 0.25 }, cutoff: 3000, range: [45, 96] },
    13: { noise: { gain: 0.3, bp: 5000 }, amp: { d: 0.18 }, range: [65, 108] },
    14: { fm: { ratio: 1.41, index: 3.0, decay: 2.0 }, amp: { d: 4.0, r: 1.0 }, range: [48, 84] },
    15: { pluck: { damping: 0.995, brightness: 0.85, seconds: 2.0 }, range: [48, 96] },
    17: { amp: { a: 0.001 } },
    18: { partials: [[0.5, 0.3], [1, 1], [2, 0.8], [3, 0.5], [4, 0.3]], cutoff: 3500, q: 1.5 },
    19: { partials: ORGAN_BASE.concat([[0.25, 0.4], [8, 0.1]]), amp: { a: 0.04, r: 0.25 } },
    20: { amp: { a: 0.03, s: 1.0 }, cutoff: 1200, velFlat: true },
    21: { oscs: [osc('square', 1, 0, 0.6), osc('sawtooth', 1, -6, 0.4), osc('sawtooth', 1, 6, 0.4)], cutoff: 1800 },
    22: { cutoff: 2200, q: 1.6, amp: { a: 0.03 }, range: [60, 96] },
    23: { oscs: [osc('square', 1, 0, 0.6), osc('sawtooth', 1, -9, 0.4), osc('sawtooth', 1, 9, 0.4)], cutoff: 1800 },
    24: { pluck: { brightness: 0.5, damping: 0.995 }, cutoff: 2000 },
    26: { pluck: { brightness: 0.4, damping: 0.997 }, cutoff: 1600 },
    27: { pluck: { brightness: 0.75, damping: 0.997, seconds: 3.0 }, cutoff: 3200 },
    28: { pluck: { damping: 0.985, seconds: 0.6 }, amp: { r: 0.04 } },
    29: { pluck: { brightness: 0.9, damping: 0.998, seconds: 3.0 }, q: 3.0, cutoff: 1800, shape: 2 },
    30: { pluck: { brightness: 0.9, damping: 0.998, seconds: 3.0 }, q: 3.0, cutoff: 2600, shape: 5 },
    31: { pluck: { brightness: 0.3, damping: 0.998 }, pitch: 12, gain: 0.6, range: [52, 100] },
    32: { pluck: { brightness: 0.35, damping: 0.997 } },
    34: { pluck: { brightness: 0.7, pickPos: 0.15 }, cutoff: 1400 },
    35: { pluck: { brightness: 0.4, damping: 0.998 }, vib: { depth: 10, delay: 0.25 } },
    36: { pluck: { brightness: 0.9, pickPos: 0.1, damping: 0.996 }, cutoff: 1800, vel: 2400 },
    37: { pluck: { brightness: 0.9, pickPos: 0.1, damping: 0.996 }, cutoff: 2200, vel: 2400 },
    38: { pluck: null, oscs: [osc('sawtooth', 1, 0, 1), osc('square', 0.5, 0, 0.5)], cutoff: 700, vel: 1600, q: 2.0,
      fenv: { d: 0.25 }, amp: { d: 0.2, s: 0.6, r: 0.12 } },
    39: { pluck: null, oscs: [osc('square', 1, 0, 0.8), osc('sawtooth', 1, -5, 0.6)], cutoff: 900, q: 1.5, amp: { s: 0.8 } },
    40: { oscs: VIOLIN_OSCS, vib: { depth: 12, delay: 0.35 }, range: [55, 103] },
    41: { vib: { depth: 10 }, cutoff: 1400, range: [48, 91] },
    42: { cutoff: 1100, kt: 0.4, vib: { depth: 9 }, range: [36, 76] },
    43: { cutoff: 800, amp: { a: 0.1 }, vib: { depth: 6 }, range: [28, 62] },
    44: { ampLfo: { hz: 7, depth: 0.5 } },
    45: { pluck: { brightness: 0.5, damping: 0.992, seconds: 1.0 }, amp: { r: 0.06 }, range: [36, 96] },
    46: { pluck: { brightness: 0.6, damping: 0.997, seconds: 3.0 }, cutoff: 3000, range: [24, 103] },
    47: { drop: { oct: 0.5, s: 0.08 }, noise: { gain: 0.3, bp: 400 }, amp: { d: 1.2, r: 0.4 }, range: [36, 60] },
    49: { amp: { a: 0.25, r: 0.7 }, cutoff: 1200 },
    50: { oscs: [osc('sawtooth', 1, -15, 0.5), osc('sawtooth', 1, 0, 0.6), osc('sawtooth', 1, 15, 0.5)], cutoff: 1800,
      q: 1.0 },
    51: { oscs: [osc('sawtooth', 1, -15, 0.5), osc('sawtooth', 1, 0, 0.6), osc('sawtooth', 1, 15, 0.5)], cutoff: 1300,
      q: 1.0, amp: { a: 0.3 } },
    52: { oscs: CHOIR_OSCS, noise: CHOIR_NOISE, ftype: 'bandpass', cutoff: 900, q: 2, kt: 0, vel: 0 },
    53: { oscs: CHOIR_OSCS, noise: CHOIR_NOISE, ftype: 'bandpass', cutoff: 500, q: 2, kt: 0, vel: 0 },
    54: { oscs: CHOIR_OSCS, noise: CHOIR_NOISE, ftype: 'bandpass', cutoff: 1400, q: 2, kt: 0, vel: 0 },
    55: { oscs: [osc('sawtooth', 1, -12, 0.5), osc('sawtooth', 1, 0, 0.5), osc('sawtooth', 1, 12, 0.5), osc('triangle', 1, 0, 0.3)],
      amp: { a: 0.005, d: 0.4, s: 0, r: 0.3 }, noise: { color: 'white', gain: 0.4, bp: null, q: 1, decay: 0.1 } },
    56: { range: [55, 86] },
    57: { cutoff: 900, vel: 2000, amp: { a: 0.045 }, range: [40, 72] },
    58: { cutoff: 600, vel: 1200, amp: { a: 0.06 }, range: [28, 58] },
    59: { cutoff: 1800, q: 3.0, gain: 0.7, range: [55, 86] },
    60: { cutoff: 800, vel: 1400, amp: { a: 0.06, r: 0.2 }, range: [41, 77] },
    61: { addOscs: [osc('sawtooth', 1, -9, 0.5)], amp: { a: 0.04 }, range: [40, 86] },
    62: BRASS_SYNTH,
    63: Object.assign({}, BRASS_SYNTH, { amp: { a: 0.02 }, cutoff: 2000 }),
    64: { cutoff: 1800, range: [56, 88] },
    65: { cutoff: 1500, range: [49, 81] },
    66: { cutoff: 1200, amp: { a: 0.05 }, range: [44, 76] },
    67: { cutoff: 900, amp: { a: 0.06 }, range: [36, 69] },
    68: { oscs: [osc('square', 1, 0, 0.4), osc('sawtooth', 1, 0, 0.6)], cutoff: 2200, q: 1.8, range: [58, 91] },
    69: { oscs: [osc('square', 1, 0, 0.4), osc('sawtooth', 1, 0, 0.6)], cutoff: 1500, q: 1.8, range: [52, 81] },
    70: { cutoff: 900, q: 1.2, amp: { a: 0.05 }, range: [34, 72] },
    71: { oscs: [osc('square', 1, 0, 0.9), osc('sawtooth', 1, 0, 0.1)], cutoff: 1800, range: [50, 91] },
    72: { range: [74, 108], noise: { gain: 0.07 } },
    74: { oscs: [osc('triangle', 1, 0, 0.5)], cutoff: 2400, range: [60, 96] },
    75: { noise: { gain: 0.12, decay: 0.15 }, amp: { a: 0.08 }, range: [60, 96] },
    76: { noise: { gain: 0.2, q: 12 }, oscs: [osc('sine', 1, 0, 0.6)], range: [55, 91] },
    77: { noise: { gain: 0.15, decay: 0.3 }, vib: { depth: 20, delay: 0.4 }, range: [55, 91] },
    78: { oscs: [osc('sine', 1, 0, 0.9)], noise: null, cutoff: 6000, vib: { depth: 10 }, range: [72, 108] },
    79: { oscs: [osc('sine', 1, 0, 0.9), osc('triangle', 1, 0, 0.1)], cutoff: 3500, range: [60, 96] },
    80: { oscs: [osc('square', 1, -6, 0.6), osc('square', 1, 6, 0.6)], mono: true },
    81: LEAD_BASE,
    82: { oscs: [osc('triangle', 1, 0, 0.7), osc('sine', 2, 0, 0.3)], noise: { color: 'white', gain: 0.05, bp: null, q: 1,
      decay: null }, amp: { a: 0.03 }, mono: false },
    83: { noise: { color: 'white', gain: 0.15, bp: null, q: 1, decay: 0.04 }, cutoff: 2000, mono: true },
    84: { q: 3.0, cutoff: 1800, shape: 3, mono: true },
    85: { formant: [800, 2], amp: { a: 0.04 }, mono: true },
    86: { addOscs: [osc('sawtooth', 1.4983, 0, 0.5)], mono: true },
    87: { addOscs: [osc('square', 0.5, 0, 0.6)], cutoff: 1800, mono: true },
    88: { fm: { ratio: 2, index: 0.6, decay: 2.0 } },
    90: { amp: { a: 0.05, d: 0.4, s: 0.7, r: 0.5 }, cutoff: 1600, vel: 2000, fenv: { d: 0.5 } },
    91: { formant: [1000, 2], noise: { color: 'white', gain: 0.06, bp: null, q: 1, decay: null } },
    92: { oscs: [osc('sawtooth', 1, -5, 0.4), osc('sawtooth', 1, 0, 0.4), osc('sawtooth', 1, 5, 0.4)], amp: { a: 0.7 } },
    93: { fm: { ratio: 3.7, index: 2.0, decay: 3.0 } },
    94: { cutoff: 1400, addOscs: [osc('sine', 2, 0, 0.3)], amp: { r: 1.5 } },
    95: { fenv: { a: 2.0, d: 2.0, sustain: 0.4 }, cutoff: 600, vel: 2400 },
    96: { oscs: [], fm: null, noise: { color: 'pink', gain: 0.5, bp: null, q: 1, decay: null }, ftype: 'bandpass',
      cutoff: 2500, q: 1, kt: 0, amp: { a: 0.3 } },
    97: { oscs: [osc('sawtooth', 1, -20, 0.5), osc('sawtooth', 1, 20, 0.5)], fm: null, noise: null,
      amp: { a: 0.8, r: 1.5 } },
    98: { fm: { ratio: 5.0, index: 3.0, decay: 1.0 }, amp: { a: 0.005, d: 2.0, s: 0.1 } },
    99: { pluck: { damping: 0.996, brightness: 0.7, seconds: 2.5, pickPos: 0.2 }, oscs: [osc('sawtooth', 1, 0, 0.4)],
      fm: null, noise: null },
    100: { oscs: [osc('sine', 1, 0, 0.6)], fm: { ratio: 2, index: 1.5, decay: 1.2 }, noise: null, cutoff: 3000,
      amp: { a: 0.2 } },
    101: { fenv: { a: 1.5 }, vib: { depth: 40, rate: 3 } },
    102: { amp: { a: 0.01, d: 1.5, s: 0.3 }, echoes: [[0.25, 0.5], [0.5, 0.25]] },
    103: { fm: { ratio: 1.5, index: 6, decay: 2.0 }, q: 4 },
    104: { pluck: { brightness: 0.95, damping: 0.997, seconds: 2.5 }, drone: { ratio: 0.5, gain: 0.15 }, q: 3 },
    105: { pluck: { brightness: 0.9, damping: 0.990, seconds: 1.0 } },
    106: { pluck: { brightness: 0.85, damping: 0.991, seconds: 1.2 }, cutoff: 2800 },
    107: { pluck: { brightness: 0.7, damping: 0.996, seconds: 2.0 } },
    108: { oscs: [osc('sine', 1, 0, 0.9)], drop: null, noise: { gain: 0.1 }, amp: { d: 0.6 }, range: [48, 96] },
    109: { drone: { ratio: 0.5, gain: 0.35 }, cutoff: 1600, q: 1.5, velFlat: true },
    110: { oscs: VIOLIN_OSCS, cutoff: 2000, vib: { depth: 8 } },
    111: { cutoff: 2600, q: 2.5, range: [60, 91] },
    112: { fm: { ratio: 6.0, index: 2.0, decay: 0.3 }, amp: { d: 0.8 }, range: [72, 108] },
    113: { drop: null, noise: { gain: 0.2 }, amp: { d: 0.3 }, range: [60, 96] },
    114: { fm: { ratio: 2.0, index: 1.2, decay: 0.5 }, addOscs: [osc('sine', 3, 0, 0.2)], amp: { d: 1.2 }, range: [52, 88] },
    115: { noise: { gain: 0.6, bp: 2000, q: 2, decay: 0.03 }, oscs: [osc('sine', 1, 0, 0.3)], drop: null, amp: { d: 0.08 },
      range: [48, 84] },
    116: { drop: { oct: 1, s: 0.1 }, noise: { gain: 0.4, bp: 300 }, amp: { d: 0.9 }, range: [36, 60] },
    117: { drop: { oct: 0.5, s: 0.12 }, noise: null, amp: { d: 0.5 }, range: [40, 72] },
    118: { oscs: [osc('square', 1, 0, 0.6), osc('sine', 1, 0, 0.6)], drop: { oct: 2, s: 0.15 }, noise: null,
      amp: { d: 0.4 }, range: [36, 72] },
    119: Object.assign({ oscs: [], noise: { color: 'white', gain: 0.8, bp: 4000, q: 0.7, decay: null },
      amp: { a: 1.0, d: 0.05, s: 0, r: 0.05 } }, SFX_WIDE),
    120: Object.assign({ oscs: [], noise: { color: 'white', gain: 0.5, bp: 3000, q: 2, decay: 0.05 }, amp: { d: 0.08 } },
      SFX_WIDE),
    121: Object.assign({ oscs: [], noise: { color: 'pink', gain: 0.6, bp: 1500, q: 1, decay: null },
      amp: { a: 0.05, d: 0.3 } }, SFX_WIDE),
    122: { oscs: [], noise: { color: 'pink', gain: 0.7, bp: null, q: 1, decay: null }, ftype: 'lowpass', cutoff: 800,
      vel: 0, q: 0.5, kt: 0, fenv: null, ampLfo: { hz: 0.3, depth: 0.5 } },
    123: Object.assign({ oscs: [osc('sine', 1, 0, 0.6)], noise: null, pitch: 24, vib: { depth: 300, rate: 8, delay: 0 },
      amp: { d: 0.2 } }, { ftype: 'lowpass', cutoff: 12000, vel: 0, q: 0.5, kt: 0, fenv: null }),
    124: Object.assign({ oscs: [fixedOsc('square', 1000, 0.5), fixedOsc('square', 1200, 0.5)], noise: null,
      ampLfo: { hz: 20, depth: 1 } }, { ftype: 'lowpass', cutoff: 12000, vel: 0, q: 0.5, kt: 0, fenv: null }),
    125: { oscs: [], noise: { color: 'pink', gain: 0.8, bp: null, q: 1, decay: null }, ftype: 'lowpass', cutoff: 400,
      vel: 0, q: 0.5, kt: 0, fenv: null, ampLfo: { hz: 12, depth: 0.8 } },
    126: Object.assign({ oscs: [], noise: { color: 'white', gain: 0.7, bp: 2500, q: 0.5, decay: null },
      ampLfo: { hz: 40, depth: 0.9 } }, SFX_WIDE),
    127: Object.assign({ oscs: [], noise: { color: 'white', gain: 1.0, bp: null, q: 1, decay: null }, ftype: 'lowpass',
      cutoff: 1500, vel: 0, q: 0.5, kt: 0, fenv: null, amp: { a: 0.001, d: 0.25, s: 0, r: 0.1 } })
  });

  function templateIndexOf(program) {
    const run = TEMPLATE_RUNS.find((item) => program >= item[0] && program <= item[1]);
    return run[2];
  }

  /** Applies one override record to a cloned template (the keys are described above the OVERRIDES table). */
  function applyOverride(params, override) {
    const given = override || {};
    if (given.ftype) params.filter.type = given.ftype;
    if (given.cutoff !== undefined) params.filter.cutoff = given.cutoff;
    if (given.vel !== undefined) params.filter.velCutoff = given.vel;
    if (given.q !== undefined) params.filter.q = given.q;
    if (given.kt !== undefined) params.filter.keyTrack = given.kt;
    if (given.fenv === null) params.filter.env = null;
    else if (given.fenv) {
      const env = params.filter.env || filterEnv(0.001, 0.2, 0.5);
      params.filter.env = { attack: finiteOr(given.fenv.a, env.attack), decay: finiteOr(given.fenv.d, env.decay),
        sustain: finiteOr(given.fenv.sustain, env.sustain) };
    }
    if (given.amp) {
      const map = { a: 'a', d: 'd', s: 's', r: 'r', d2: 'decay2' };
      Object.keys(given.amp).forEach((key) => { params.amp[map[key]] = given.amp[key]; });
    }
    if (given.range) params.range = given.range.slice();
    if (given.oscs) params.oscs = deepClone(given.oscs);
    if (given.partials) params.partials = deepClone(given.partials);
    if (given.addOscs) params.oscs = params.oscs.concat(deepClone(given.addOscs));
    if (given.oscGain) Object.keys(given.oscGain).forEach((index) => { params.oscs[index].gain = given.oscGain[index]; });
    if (given.fm !== undefined) params.fm = given.fm === null ? null : deepClone(given.fm);
    if (given.noise === null) params.noise = null;
    else if (given.noise) params.noise = Object.assign(params.noise || { color: 'white', gain: 0.1, bandpassHz: null,
      q: 1, decay: null }, mapNoise(given.noise));
    if (given.pluck === null) params.pluck = null;
    else if (given.pluck) params.pluck = Object.assign(params.pluck || {}, given.pluck);
    if (given.vib) {
      const vib = given.vib;
      params.vibrato = { rate: finiteOr(vib.rate, params.vibrato.rate), autoDepth: finiteOr(vib.depth,
        params.vibrato.autoDepth), delay: finiteOr(vib.delay, params.vibrato.delay) };
    }
    if (given.velFlat) params.vel = { exp: 1, min: 1 };
    if (given.shape !== undefined) params.shape = given.shape;
    if (given.formant) params.formant = given.formant.slice();
    if (given.mono !== undefined) params.mono = given.mono;
    if (given.pitch !== undefined) params.pitch = given.pitch;
    if (given.gain !== undefined) params.gain = given.gain;
    if (given.drone) params.drone = deepClone(given.drone);
    if (given.drop !== undefined) params.drop = given.drop === null ? null : deepClone(given.drop);
    if (given.ampLfo) params.ampLfo = deepClone(given.ampLfo);
    if (given.echoes) params.echoes = deepClone(given.echoes);
    return params;
  }

  function mapNoise(source) {
    const mapped = {};
    Object.keys(source).forEach((key) => { mapped[key === 'bp' ? 'bandpassHz' : key] = source[key]; });
    return mapped;
  }

  function buildDefinition(program) {
    const base = TEMPLATES[templateIndexOf(program)];
    const params = applyOverride(deepClone(base), OVERRIDES[program]);
    delete params.id;
    const range = params.range;
    const family = Math.floor(program / FAMILY_SIZE);
    const fidelity = SYNTH_BASIC.includes(program) ? 'synth-basic' : 'synth-velocity';
    return deepFreeze({
      program, name: FLM.Theory.gmProgramName(program), family, template: base.id, fidelity, params, range,
      polyphonyHint: base.polyphonyHint, mono: params.mono === true, animProfile: base.animProfile,
      bank: null, defaultProfile: 'A', propId: PROPS[base.animProfile], controllers: CONTROLLERS,
      articulations: params.mono === true ? ['legato'] : []
    });
  }

  const DEFINITION_LIST = Object.freeze(Array.from({ length: PROGRAM_COUNT }, (unused, program) =>
    buildDefinition(program)));

  // ---------------------------------------------------------------------------------------------
  // Drum kit (6.6.3): 12 voices and the GM key map
  // ---------------------------------------------------------------------------------------------
  const DRUM_VOICE_NAMES = Object.freeze(['kick', 'snare', 'rimshot', 'clap', 'tom', 'closedHat', 'openHat', 'pedalHat',
    'crash', 'ride', 'cowbellMisc', 'shakerMisc']);
  const DRUM_VOICE_LIST = Object.freeze(DRUM_VOICE_NAMES.map((name, index) => Object.freeze({ index, name })));
  const DRUM_INDEX = Object.freeze(DRUM_VOICE_NAMES.reduce((table, name, index) => {
    table[name] = index;
    return table;
  }, {}));
  const MISC_INDEX = DRUM_INDEX.shakerMisc;
  // key -> [voice, per-key parameters]; hz, d (decay seconds), start (kick start Hz), lfo (Hz), sine (tone), bell, bp
  const DRUM_KEYS = Object.freeze({
    35: ['kick', { start: 120, d: 0.45 }], 36: ['kick', {}], 37: ['rimshot', {}], 38: ['snare', {}], 39: ['clap', {}],
    40: ['snare', { noise: 1.0, tone: 0.4 }], 41: ['tom', { hz: 90 }], 42: ['closedHat', {}], 43: ['tom', { hz: 110 }],
    44: ['pedalHat', {}], 45: ['tom', { hz: 135 }], 46: ['openHat', {}], 47: ['tom', { hz: 160 }],
    48: ['tom', { hz: 190 }], 49: ['crash', {}], 50: ['tom', { hz: 220 }], 51: ['ride', {}],
    52: ['crash', { bp: 3500, d: 1.2 }], 53: ['ride', { bell: true }], 54: ['shakerMisc', { tambourine: true }],
    55: ['crash', { d: 0.7, bp: 7000 }], 56: ['cowbellMisc', {}], 57: ['crash', { bp: 4200, d: 1.8 }],
    58: ['shakerMisc', { lfo: 30, d: 0.6 }], 59: ['ride', { d: 0.7 }], 60: ['cowbellMisc', { sine: 400, d: 0.12 }],
    61: ['cowbellMisc', { sine: 300, d: 0.14 }], 62: ['cowbellMisc', { sine: 260, d: 0.08 }],
    63: ['cowbellMisc', { sine: 230, d: 0.3 }], 64: ['cowbellMisc', { sine: 180, d: 0.35 }],
    65: ['cowbellMisc', { sine: 320, d: 0.25 }], 66: ['cowbellMisc', { sine: 250, d: 0.3 }],
    67: ['cowbellMisc', { hz: 1200 }], 68: ['cowbellMisc', { hz: 900 }], 69: ['shakerMisc', {}],
    70: ['shakerMisc', { d: 0.06 }], 71: ['shakerMisc', { whistle: 2000, d: 0.15 }],
    72: ['shakerMisc', { whistle: 2000, d: 0.5 }], 73: ['shakerMisc', { lfo: 25, d: 0.12 }],
    74: ['shakerMisc', { lfo: 25, d: 0.4 }], 75: ['cowbellMisc', { sine: 2500, d: 0.06 }],
    76: ['cowbellMisc', { sine: 1800, d: 0.07 }], 77: ['cowbellMisc', { sine: 1300, d: 0.08 }],
    78: ['shakerMisc', { whistle: 500, lfo: 25, d: 0.15 }], 79: ['shakerMisc', { whistle: 400, lfo: 25, d: 0.3 }],
    80: ['cowbellMisc', { sine: 4200, d: 0.08 }], 81: ['cowbellMisc', { sine: 4200, d: 1.2 }]
  });
  // A typed array cannot be frozen; the table is never written after this line.
  const DRUM_MAP = (() => {
    const map = new Uint8Array(PROGRAM_COUNT).fill(MISC_INDEX);
    Object.keys(DRUM_KEYS).forEach((key) => { map[key] = DRUM_INDEX[DRUM_KEYS[key][0]]; });
    return map;
  })();

  // ---------------------------------------------------------------------------------------------
  // The engine binding and its state (one engine at a time)
  // ---------------------------------------------------------------------------------------------
  let st = null;              // {engine, ctx, allocator, channels, noise, waves, curves, built, lastSweep}
  const pluckCache = new Map();
  const pluckState = { cap: PLUCK_CAP_DESKTOP, bytes: 0 };
  const unsupported = new Set();
  const WARMUP_OWNER = Symbol('instruments.warmup');
  const sustainCache = new WeakMap();
  const counters = { voicesBuilt: 0, buildMs: 0, fadingNodes: 0 };   // fadingNodes: nodes of stopped (stolen) voices that are still fading out       // buildMs: the time spent building voices (PT-012 reads the mean)

  function requireState() {
    if (!st) throw new Error('Instruments is not attached to an audio engine');
    return st;
  }

  function makeState(engine) {
    return { engine, get ctx() { return engine.ctx(); }, allocator: engine.VoiceAllocator, channels: new Map(),
      waves: new Map(), curves: new Map(), lastSweep: engine.now(), fallbackLevel: new Map() };
  }

  /** Binds to an Audio engine (M-29 after the context exists, and in tests). Replaces an earlier binding. */
  function attach(engine) {
    if (!engine || typeof engine.createStrip !== 'function') throw new Error('attach needs an audio engine');
    st = makeState(engine);
    if (st.ctx) ['white', 'pink'].forEach((color) => noiseBuffer(st, color));     // not in the middle of the first chord
    unsupported.clear();
    counters.voicesBuilt = 0;
    counters.buildMs = 0;
    counters.fadingNodes = 0;
    pluckState.cap = Core.Caps.isMobile() ? PLUCK_CAP_MOBILE : PLUCK_CAP_DESKTOP;
    return st.engine;
  }

  /** M-05 after a hard panic: every voice is gone, so channel bookkeeping starts over on the same engine. */
  function onGraphRebuilt(engine) {
    const target = engine || (st && st.engine);
    if (!target) return;
    const old = st;
    releaseAllLfos(old);
    st = makeState(target);
    if (old) {
      old.fallbackLevel.forEach((level, program) => st.fallbackLevel.set(program, level));   // a program that needed its fallback still does
      if (old.ctx === st.ctx) {                      // the same context: its wave and curve tables are still good
        old.waves.forEach((wave, key) => st.waves.set(key, wave));
        old.curves.forEach((curve, key) => st.curves.set(key, curve));
      } else if (warmSong !== null) {
        primeVoices(st, warmSong);                    // a new context (Restart audio): nothing is primed on it yet
      }
    }
  }

  function dispose() {
    if (st) st.channels.forEach((channels) => channels.forEach((cs) => cs.voices.forEach((voice) => voice.dispose())));
    releaseAllLfos(st);
    st = null;
  }

  // The vibrato LFO of a channel (Part 6.6.6: one per track and channel, made when a voice first needs it): a shared oscillator
  // that feeds the depth gain of every voice of the channel. It ends with the last voice of the channel.
  function channelLfo(state, cs, rate) {
    let entry = cs.lfos.get(rate);
    if (!entry) {
      const oscillator = state.ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = rate;
      oscillator.start();
      state.engine.countNodes(1);
      entry = oscillator;
      cs.lfos.set(rate, entry);
    }
    return entry;
  }

  function releaseChannelLfos(state, cs) {
    cs.lfos.forEach((oscillator) => {
      try {
        oscillator.stop();
        oscillator.disconnect();
      } catch (error) {
        Log.warn('instruments', 'ending a vibrato LFO failed: ' + messageOf(error));
      }
      state.engine.countNodes(-1);
    });
    cs.lfos.clear();
  }

  function releaseAllLfos(state) {
    if (state) state.channels.forEach((channels) => channels.forEach((cs) => releaseChannelLfos(state, cs)));
  }

  // ---------------------------------------------------------------------------------------------
  // Channel state
  // ---------------------------------------------------------------------------------------------
  function newChannelState(program) {
    return { program, programSeq: 0, programs: [], bends: [], bendCents: 0, bendRange: BEND_RANGE_DEFAULT,
      modDepthCents: 0, volumeCC: 100, expression: 127, pan: MIDI_HALF, sustain: false,
      rpn: { msb: MIDI_MAX, lsb: MIDI_MAX }, heldLive: new Map(), sustainedLive: new Set(), voices: new Set(),
      monoVoice: null, openHats: new Set(), lfos: new Map() };
  }

  function channelState(state, trackId, channel, program) {
    let channels = state.channels.get(trackId);
    if (!channels) {
      channels = new Map();
      state.channels.set(trackId, channels);
    }
    let cs = channels.get(channel);
    if (!cs) {
      cs = newChannelState(finiteOr(program, 0));
      channels.set(channel, cs);
    }
    return cs;
  }

  function latestAtOrBefore(list, time) {
    let found = null;
    list.forEach((entry) => {
      if (entry.at <= time && (found === null || entry.at >= found.at)) found = entry;
    });
    return found;
  }

  function programAt(cs, time) {
    const entry = latestAtOrBefore(cs.programs, time);
    return entry ? entry.program : cs.program;
  }

  function bendAt(cs, time) {
    const entry = latestAtOrBefore(cs.bends, time);
    return entry ? entry.cents : cs.bendCents;
  }

  function pushTimeline(list, entry) {
    list.push(entry);
    if (list.length > 16) list.shift();
  }

  // ---------------------------------------------------------------------------------------------
  // Buffers: pluck (Karplus-Strong), noise, additive waves, waveshaper curves
  // ---------------------------------------------------------------------------------------------
  function asDefinition(program) {
    return typeof program === 'object' && program !== null ? program : DEFINITION_LIST[clamp(program, 0, MIDI_MAX)];
  }

  function karplusStrong(sampleRate, frequency, pluck, seed) {
    const period = Math.max(2, Math.round(sampleRate / frequency));
    const length = Math.round(pluck.seconds * sampleRate);
    const random = new Core.Prng(seed);
    const ring = new Float32Array(period);
    let smooth = 0;
    for (let index = 0; index < period; index += 1) {
      smooth = pluck.brightness * (random.next() * 2 - 1) + (1 - pluck.brightness) * smooth;
      ring[index] = smooth;
    }
    const comb = Math.round(period * pluck.pickPos);
    const picked = Float32Array.from(ring, (value, index) => value - ring[(index + comb) % period] * 0.5);
    ring.set(picked);
    const out = new Float32Array(length);
    let peak = 0;
    for (let index = 0; index < length; index += 1) {
      const slot = index % period;
      out[index] = ring[slot];
      peak = Math.max(peak, Math.abs(ring[slot]));
      ring[slot] = pluck.damping * 0.5 * (ring[slot] + ring[(slot + 1) % period]);
    }
    const scale = peak > 0 ? PLUCK_PEAK / peak : 1;
    for (let index = 0; index < length; index += 1) out[index] *= scale;
    const fade = Math.min(length, Math.round(PLUCK_FADE_S * sampleRate));
    for (let index = 0; index < fade; index += 1) out[length - 1 - index] *= index / fade;
    return out;
  }

  /** The pluck buffer of a program at a pitch: cached by program, pitch and rate (LRU); the layer does not change it. */
  function pluckBuffer(program, pitch) {
    const state = requireState();
    const def = asDefinition(program);
    const key = def.program + ':' + pitch + ':' + state.ctx.sampleRate;
    if (pluckCache.has(key)) {
      const hit = pluckCache.get(key);
      pluckCache.delete(key);
      pluckCache.set(key, hit);
      return hit;
    }
    const pluck = def.params.pluck;
    const seed = Core.fnv1a32(def.program + ':' + pitch);
    const data = karplusStrong(state.ctx.sampleRate, frequencyOf(pitch), pluck, seed);
    const buffer = state.ctx.createBuffer(1, data.length, state.ctx.sampleRate);
    buffer.copyToChannel(data, 0);
    pluckCache.set(key, buffer);
    pluckState.bytes += data.length * Float32Array.BYTES_PER_ELEMENT;
    while (pluckCache.size > pluckState.cap) {
      const oldest = pluckCache.keys().next().value;
      pluckState.bytes -= pluckCache.get(oldest).length * Float32Array.BYTES_PER_ELEMENT;
      pluckCache.delete(oldest);
    }
    return buffer;
  }

  // One white and one pink buffer per context, made once (a hard panic keeps the context, so it keeps them too).
  const noiseByContext = new WeakMap();

  function noiseBuffer(state, color) {
    let table = noiseByContext.get(state.ctx);
    if (!table) {
      table = {};
      noiseByContext.set(state.ctx, table);
    }
    if (table[color]) return table[color];
    const rate = state.ctx.sampleRate;
    const length = Math.round(NOISE_SECONDS * rate);
    const random = new Core.Prng(NOISE_SEED);
    const data = new Float32Array(length);
    const poles = [0, 0, 0, 0, 0, 0, 0];
    for (let index = 0; index < length; index += 1) {
      const white = random.next() * 2 - 1;
      if (color === 'pink') {
        poles[0] = 0.99886 * poles[0] + white * 0.0555179;
        poles[1] = 0.99332 * poles[1] + white * 0.0750759;
        poles[2] = 0.96900 * poles[2] + white * 0.1538520;
        poles[3] = 0.86650 * poles[3] + white * 0.3104856;
        poles[4] = 0.55000 * poles[4] + white * 0.5329522;
        poles[5] = -0.7616 * poles[5] - white * 0.0168980;
        data[index] = (poles[0] + poles[1] + poles[2] + poles[3] + poles[4] + poles[5] + poles[6] + white * 0.5362) * 0.11;
        poles[6] = white * 0.115926;
      } else {
        data[index] = white;
      }
    }
    const buffer = state.ctx.createBuffer(1, length, rate);
    buffer.copyToChannel(data, 0);
    table[color] = buffer;
    return buffer;
  }

  function additiveWave(state, partials, base) {
    const key = partials.map((item) => item[0] + ':' + item[1]).join(',');
    if (state.waves.has(key)) return state.waves.get(key);
    const top = partials.reduce((highest, item) => Math.max(highest, Math.round(item[0] / base)), 1);
    const real = new Float32Array(top + 1);
    const imag = new Float32Array(top + 1);
    partials.forEach((item) => { imag[Math.round(item[0] / base)] = item[1]; });
    const wave = state.ctx.createPeriodicWave(real, imag);
    state.waves.set(key, wave);
    return wave;
  }

  function shaperCurve(state, strength) {
    if (state.curves.has(strength)) return state.curves.get(strength);
    const curve = new Float32Array(SHAPER_POINTS);
    for (let index = 0; index < SHAPER_POINTS; index += 1) {
      const x = index / (SHAPER_POINTS - 1) * SHAPER_SPAN - 1;
      curve[index] = Math.tanh(strength * x);
    }
    state.curves.set(strength, curve);
    return curve;
  }

  // ---------------------------------------------------------------------------------------------
  // Voice assembly: a node book that counts what it creates, and the Voice object
  // ---------------------------------------------------------------------------------------------
  class NodeBook {
    constructor(context) {
      this.context = context;
      this.nodes = [];
      this.sources = [];
      this.cleanups = null;                  // run by abort: inputs that other nodes (the channel LFO) hold on these nodes
      this.sharedKeys = null;                // the gain nodes that oscillators share, by level (sharedGain)
      this.sharedNodes = null;
    }

    gain(value) {
      const node = this.context.createGain();
      this.nodes.push(node);
      node.gain.value = value;
      return node;
    }

    filter(type, hz, q) {
      const node = this.context.createBiquadFilter();
      this.nodes.push(node);
      node.type = type;
      node.frequency.value = clamp(hz, 20, this.context.sampleRate / 2 - 100);
      node.Q.value = q;
      return node;
    }

    osc(type, hz) {
      const node = this.context.createOscillator();
      this.nodes.push(node);
      node.type = type;
      node.frequency.value = hz;
      this.sources.push(node);
      return node;
    }

    buffer(buffer, loop) {
      const node = this.context.createBufferSource();
      this.nodes.push(node);
      node.buffer = buffer;
      node.loop = loop === true;
      this.sources.push(node);
      return node;
    }

    shaper(curve) {
      const node = this.context.createWaveShaper();
      this.nodes.push(node);
      node.curve = curve;
      return node;
    }

    onAbort(cleanup) {
      if (this.cleanups === null) this.cleanups = [];
      this.cleanups.push(cleanup);
    }

    abort() {
      for (let index = 0; index < this.nodes.length; index += 1) {
        try {
          this.nodes[index].disconnect();
        } catch (error) { /* a node that never connected */ }
      }
      if (this.cleanups === null) return;
      this.cleanups.forEach((cleanup) => { try { cleanup(); } catch (error) { /* an input that was never connected */ } });
    }
  }

  const nodeBook = (context) => new NodeBook(context);

  // One gain node per distinct level (to 1/1000), shared by the oscillators of a voice and its drone; level 1 needs none.
  function sharedGain(book, target, value) {
    if (Math.abs(value - 1) < 1 / GAIN_KEY_SCALE) return target;
    const key = Math.round(value * GAIN_KEY_SCALE);
    if (book.sharedKeys === null) {
      book.sharedKeys = [];
      book.sharedNodes = [];
    }
    const found = book.sharedKeys.indexOf(key);
    if (found >= 0) return book.sharedNodes[found];
    const node = book.gain(value);
    node.connect(target);
    book.sharedKeys.push(key);
    book.sharedNodes.push(node);
    return node;
  }

  /**
   * The Voice of 6.6.2. `env` holds: book (the node book), out (the gain that feeds the strip), peak (the amp peak), amp (the
   * envelope numbers a, d, s, decay2 of the melodic definition) or drumSeconds (the drum model), the flat list of detune
   * parameters [param, base, param, base ...] and the channel link. The methods are on the prototype: a voice costs one object.
   */
  class NoteVoice {
    constructor(state, env) {
      this.state = state;
      this.env = env;
      this.book = env.book;
      this.slot = null;
      this.started = false;
      this.ended = false;
      this.releaseAt = null;
      this.releaseRamp = 0;
      this.stopAt = null;
      this.startAt = env.startAt;
      this.kind = env.kind;
      this.program = env.program;
      this.nodeCount = env.book.nodes.length;
      this.cs = env.cs;
      this.releaseMax = env.releaseMax;
      this.isOpenHat = env.isOpenHat === true;
      this.fading = false;
      this.running = env.book.sources.length;     // the voice is over when its last source has ended
      this.def = null;
      this.pendingStop = null;
      this.pitch = 0;
      this.peak = 0;
      this.layerIndex = 0;
      this.duration = 0;
      this.drumName = null;
      this.bend = 0;
    }

    // A source cannot be stopped before it is started (the browser throws): a drum voice asks for its end while it is built,
    // so the end waits for start().
    endAt(when) {
      if (this.started) this.stopSources(when);
      else this.pendingStop = when;
    }

    start(at) {
      if (this.started) return;
      this.started = true;
      const sources = this.book.sources;
      for (let index = 0; index < sources.length; index += 1) sources[index].start(at);
      if (this.pendingStop !== null) this.stopSources(this.pendingStop);
    }

    // The amp level 0..1 before any release: from the envelope numbers (melodic) or the straight decay (drums).
    modelAt(time) {
      const env = this.env;
      const age = time - this.startAt;
      if (env.drumSeconds > 0) return 1 - age / (env.drumSeconds * 1.5);
      const amp = env.amp;
      const a = Math.max(amp.a, MIN_RAMP_S);
      if (age < a) return age / a;
      if (amp.d > 0 && amp.s < 1 && age < a + amp.d) return 1 - (1 - amp.s) * (age - a) / amp.d;
      const held = amp.d > 0 ? amp.s : Math.min(1, amp.s);
      return amp.decay2 ? held * Math.exp(-(age - a - amp.d) / amp.decay2) : held;
    }

    // The level 0..1 of the amp at time t, release included (the allocator steals the quietest released voice).
    levelAt(time) {
      if (this.ended || time < this.startAt) return 0;
      if (this.releaseAt === null || time < this.releaseAt) return clamp(this.modelAt(time), 0, 1);
      const base = this.modelAt(this.releaseAt);
      return clamp(base * (1 - (time - this.releaseAt) / this.releaseRamp), 0, 1);
    }

    stopSources(when) {
      this.stopAt = when;
      const sources = this.book.sources;
      for (let index = 0; index < sources.length; index += 1) {
        try {
          sources[index].stop(when);
        } catch (error) {
          Log.warn('instruments', 'stopping a source failed: ' + messageOf(error));
        }
      }
    }

    rampDown(at, rampS) {
      const env = this.env;
      const gain = env.out.gain;
      const level = this.levelAt(at) * env.peak;
      // The earlier release ramp keeps running until `at` (cancelAndHold), then this release starts from the level reached.
      if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(at);
      else gain.cancelScheduledValues(at);
      gain.setValueAtTime(env.fromLevel ? level : env.peak, at);
      gain.linearRampToValueAtTime(0, at + rampS);
      this.releaseAt = at;
      this.releaseRamp = rampS;
      this.stopSources(at + rampS + STOP_PAD_S);
    }

    // A release that ends the sound earlier than the one in force replaces it (a soft panic shortens a 1.5 s tail).
    release(at, rampS) {
      if (this.ended) return;
      const ramp = Math.max(MIN_RAMP_S, rampS === undefined ? this.env.releaseRamp : rampS);
      const start = Math.max(at, this.startAt);
      if (this.releaseAt !== null && start + ramp >= this.releaseAt + this.releaseRamp) return;
      this.rampDown(start, ramp);
    }

    stop(at, fadeS) {
      if (this.ended) return;
      if (!this.fading) {
        this.fading = true;                // a stolen voice is a transient: the node budget of PT-012 does not count it
        counters.fadingNodes += this.nodeCount;
      }
      const fade = Math.max(MIN_RAMP_S, fadeS === undefined ? STEAL_FADE_S : fadeS);
      this.rampDown(Math.max(at, this.startAt), fade);
    }

    setBend(cents, at) {
      this.bend = cents;
      const detunes = this.env.detunes;
      for (let index = 0; index < detunes.length; index += 2) {
        detunes[index].setTargetAtTime(detunes[index + 1] + cents, at, BEND_TIME_CONSTANT_S);
      }
    }

    setVibratoDepth(cents, at) {
      const env = this.env;
      if (env.depthGain) env.depthGain.gain.setTargetAtTime(env.vibratoBase + cents, at, BEND_TIME_CONSTANT_S);
    }

    dispose() {
      if (this.ended) return;
      const state = this.state;
      const cs = this.cs;
      this.ended = true;
      if (this.fading) counters.fadingNodes -= this.nodeCount;
      this.book.abort();
      state.engine.countNodes(-this.nodeCount);
      if (cs) {
        cs.voices.delete(this);
        cs.sustainedLive.delete(this.slot);
        if (this.slot && cs.heldLive.get(this.pitch) === this.slot) cs.heldLive.delete(this.pitch);
        if (cs.monoVoice === this) cs.monoVoice = null;
        cs.openHats.delete(this);
        if (cs.voices.size === 0) releaseChannelLfos(state, cs);
      }
      if (this.slot) state.allocator.free(this.slot);
    }
  }

  function createVoice(state, env) {
    const voice = new NoteVoice(state, env);
    const sources = env.book.sources;
    if (sources.length > 0) {
      const onSourceEnded = () => {         // one callback for all the sources of the voice
        voice.running -= 1;
        if (voice.running <= 0) voice.dispose();
      };
      for (let index = 0; index < sources.length; index += 1) sources[index].onended = onSourceEnded;
    }
    state.engine.countNodes(voice.nodeCount);
    counters.voicesBuilt += 1;
    return voice;
  }

  // ---------------------------------------------------------------------------------------------
  // Melodic voices (6.6.4.2)
  // ---------------------------------------------------------------------------------------------
  function layerIndexFor(params, velocity) {
    const found = params.layers.findIndex((item) => velocity <= item.maxVel);
    return found < 0 ? params.layers.length - 1 : found;
  }

  function ampEnvelope(gain, params, peak, at) {
    const a = Math.max(params.amp.a, MIN_RAMP_S);
    gain.setValueAtTime(0, at);
    gain.linearRampToValueAtTime(peak, at + a);
    if (params.amp.d > 0 && params.amp.s < 1) gain.linearRampToValueAtTime(peak * params.amp.s, at + a + params.amp.d);
    if (params.amp.decay2) gain.setTargetAtTime(0, at + a + params.amp.d, params.amp.decay2);
    return a;
  }

  // wheelExpected: the track has CC 1 events, so the vibrato exists even while the wheel is down (D80).
  function addVibrato(state, book, params, cs, at, detunes, env, wheelExpected) {
    const depth = params.vibrato.autoDepth + cs.modDepthCents;
    if ((depth <= 0 && !wheelExpected) || detunes.length === 0) return;
    const lfo = channelLfo(state, cs, params.vibrato.rate);
    const depthGain = book.gain(0);
    lfo.connect(depthGain);
    book.onAbort(() => lfo.disconnect(depthGain));
    for (let index = 0; index < detunes.length; index += 2) depthGain.connect(detunes[index]);
    const delay = params.vibrato.delay;
    depthGain.gain.setValueAtTime(0, at);
    if (delay > 0) {
      depthGain.gain.setValueAtTime(0, at + delay);
      depthGain.gain.linearRampToValueAtTime(depth, at + delay + VIBRATO_RAMP_S);
    } else {
      depthGain.gain.setValueAtTime(depth, at);
    }
    env.depthGain = depthGain;
    env.vibratoBase = params.vibrato.autoDepth;
  }

  // One oscillator of a voice: its detune (with the pitch bend) is kept for later bends; the pitch drop of the template is booked.
  function trackOscillator(source, base, hz, params, at, bendCents, detunes) {
    source.detune.value = base + bendCents;
    detunes.push(source.detune, base);
    if (params.drop) {
      source.frequency.setValueAtTime(hz * Math.pow(2, params.drop.oct), at);
      source.frequency.exponentialRampToValueAtTime(hz, at + params.drop.s);
    }
  }

  /** @returns {(object|null)} the first oscillator, the carrier of the FM pair */
  function addOscillators(state, book, params, f0, at, target, detunes, bendCents) {
    let carrier = null;
    if (params.partials) {
      let base = Infinity;
      for (let index = 0; index < params.partials.length; index += 1) base = Math.min(base, params.partials[index][0]);
      const source = book.osc('sine', f0 * base);
      source.setPeriodicWave(additiveWave(state, params.partials, base));
      source.connect(target);
      trackOscillator(source, 0, f0 * base, params, at, bendCents, detunes);
      carrier = source;
    }
    for (let index = 0; index < params.oscs.length; index += 1) {
      const spec = params.oscs[index];
      const hz = spec.hz === undefined ? f0 * spec.ratio : spec.hz;
      const source = book.osc(spec.type, hz);
      source.connect(sharedGain(book, target, spec.gain));
      trackOscillator(source, spec.detune, hz, params, at, bendCents, detunes);
      if (carrier === null) carrier = source;
    }
    return carrier;
  }

  function addFm(book, params, f0, at, carrier) {
    if (!params.fm || !carrier) return;
    const modulator = book.osc('sine', f0 * params.fm.ratio);
    const depth = book.gain(params.fm.index * f0);
    modulator.connect(depth);
    depth.connect(carrier.frequency);
    depth.gain.setValueAtTime(params.fm.index * f0, at);
    depth.gain.exponentialRampToValueAtTime(params.fm.index * f0 * 0.1, at + Math.max(params.fm.decay, MIN_RAMP_S));
  }

  function addNoise(state, book, params, f0, at, target) {
    const spec = params.noise;
    if (!spec) return;
    const source = book.buffer(noiseBuffer(state, spec.color), true);
    const level = book.gain(spec.gain);
    level.connect(target);
    if (spec.decay) level.gain.setTargetAtTime(0, at, spec.decay / 3);
    let head = level;
    if (spec.bandpassHz !== null && spec.bandpassHz !== undefined) {
      const hz = spec.bandpassHz < 0 ? f0 * -spec.bandpassHz : spec.bandpassHz;
      head = book.filter('bandpass', hz, spec.q);
      head.connect(level);
    }
    source.connect(head);
  }

  function addPluck(state, book, def, sounding, target, detunes, bendCents) {
    const source = book.buffer(pluckBuffer(def, sounding), false);
    source.detune.value = bendCents;
    detunes.push(source.detune, 0);
    source.connect(target);
  }

  function addDrone(book, params, f0, target) {
    if (!params.drone) return;
    const source = book.osc('sawtooth', f0 * params.drone.ratio);
    source.connect(sharedGain(book, target, params.drone.gain));
  }

  // The tremolo is a gain node in series after the envelope, so it follows the envelope and ends with the release.
  function connectOutput(book, params, outGain, strip) {
    if (!params.ampLfo) {
      outGain.connect(strip.input);
      return;
    }
    const depth = clamp(params.ampLfo.depth, 0, 1);
    const tremolo = book.gain(1 - depth / 2);
    const lfo = book.osc('sine', params.ampLfo.hz);
    const swing = book.gain(depth / 2);
    lfo.connect(swing);
    swing.connect(tremolo.gain);
    outGain.connect(tremolo);
    tremolo.connect(strip.input);
  }

  function buildMelodic(state, def, pitch, velocity, strip, at, cs, gainMul, wheelExpected) {
    injectNodeFault();
    const ctx = state.ctx;
    const params = def.params;
    const sounding = pitch + params.pitch;
    const f0 = frequencyOf(sounding);
    const layerIndex = layerIndexFor(params, velocity);
    const layerDef = params.layers[layerIndex];
    const velGain = params.vel.min + (1 - params.vel.min) * Math.pow(velocity / VEL_REFERENCE, params.vel.exp);
    const book = nodeBook(ctx);
    const env = { book, kind: 'melodic', program: def.program, startAt: at, cs, peak: 0, detunes: [], fromLevel: true,
      releaseRamp: Math.max(params.amp.r, MIN_RAMP_S), releaseMax: params.releaseMax, amp: params.amp, drumSeconds: 0,
      out: null, depthGain: null, vibratoBase: 0, isOpenHat: false };
    try {
      const outGain = book.gain(0);
      connectOutput(book, params, outGain, strip);
      env.out = outGain;
      let head = outGain;
      if (params.shape) {
        const shaper = book.shaper(shaperCurve(state, params.shape));
        shaper.connect(head);
        head = shaper;
      }
      if (params.formant) {
        const formant = book.filter('bandpass', params.formant[0], params.formant[1]);
        formant.connect(head);
        head = formant;
      }
      const cutoff0 = params.filter.cutoff * layerDef.cutoffMul * Math.pow(f0 / MIDDLE_C_HZ, params.filter.keyTrack);
      const mainFilter = book.filter(params.filter.type, cutoff0, params.filter.q);
      mainFilter.connect(head);
      scheduleFilter(mainFilter, params, cutoff0, velocity, at);
      const bendCents = bendAt(cs, at);
      const carrier = addOscillators(state, book, params, f0, at, mainFilter, env.detunes, bendCents);
      addFm(book, params, f0, at, carrier);
      addNoise(state, book, params, f0, at, mainFilter);
      if (params.pluck) addPluck(state, book, def, sounding, mainFilter, env.detunes, bendCents);
      addDrone(book, params, f0, mainFilter);
      addVibrato(state, book, params, cs, at, env.detunes, env, wheelExpected === true);
      const peak = velGain * layerDef.gainMul * params.gain * gainMul;
      env.peak = peak;
      ampEnvelope(outGain.gain, params, peak, at);
      const voice = createVoice(state, env);
      voice.layerIndex = layerIndex;
      voice.peak = peak;
      if (voice.nodeCount > MAX_VOICE_NODES) Log.warn('instruments', 'voice of program ' + def.program + ' has ' +
        voice.nodeCount + ' nodes');
      return voice;
    } catch (error) {
      book.abort();
      if (cs.voices.size === 0) releaseChannelLfos(state, cs);
      throw error;
    }
  }

  function scheduleFilter(node, params, cutoff0, velocity, at) {
    const spec = params.filter.env;
    if (!spec) return;
    const peak = cutoff0 + params.filter.velCutoff * (velocity / VEL_REFERENCE);
    const attack = Math.max(spec.attack, MIN_RAMP_S);
    node.frequency.setValueAtTime(cutoff0, at);
    node.frequency.linearRampToValueAtTime(clamp(peak, 20, 20000), at + attack);
    node.frequency.setTargetAtTime(cutoff0 + (peak - cutoff0) * spec.sustain, at + attack, Math.max(spec.decay, MIN_RAMP_S) / 3);
  }

  // ---------------------------------------------------------------------------------------------
  // Drum voices (6.6.3): one recipe per hit, gains by 0.1 + 0.9 * (velocity / 127) ^ 1.3
  // ---------------------------------------------------------------------------------------------
  function decayGain(book, target, peak, at, seconds) {
    const node = book.gain(0);
    node.connect(target);
    node.gain.setValueAtTime(0, at);
    node.gain.linearRampToValueAtTime(peak, at + MIN_RAMP_S);
    node.gain.setTargetAtTime(0, at + MIN_RAMP_S, seconds / DECAY_DIVISOR);
    return node;
  }

  function noiseHit(state, book, target, color, kind, hz, q, peak, at, seconds) {
    const source = book.buffer(noiseBuffer(state, color), true);
    const shaped = book.filter(kind, hz, q);
    source.connect(shaped);
    shaped.connect(decayGain(book, target, peak, at, seconds));
  }

  function toneHit(book, target, type, hz, peak, at, seconds, endHz) {
    const source = book.osc(type, hz);
    if (endHz !== undefined) {
      source.frequency.setValueAtTime(hz, at);
      source.frequency.exponentialRampToValueAtTime(endHz, at + 0.05);
    }
    source.connect(decayGain(book, target, peak, at, seconds));
    return source;
  }

  const DRUM_RECIPES = {
    kick(state, book, out, vg, at, p) {
      const shaper = book.shaper(shaperCurve(state, 1.5));
      shaper.connect(out);
      const start = p.start || 150;
      toneHit(book, shaper, 'sine', start, vg, at, p.d || 0.35, 50);
      noiseHit(state, book, out, 'white', 'lowpass', 2000, 1, 0.25 * vg, at, 0.01);
      return p.d || 0.35;
    },
    snare(state, book, out, vg, at, p) {
      const body = book.filter('bandpass', 900, 1);
      body.connect(out);
      const tone = toneHit(book, body, 'triangle', 190, (p.tone || 0.6) * vg, at, 0.12);
      tone.frequency.setValueAtTime(190, at);
      tone.frequency.linearRampToValueAtTime(160, at + 0.02);
      noiseHit(state, book, out, 'white', 'highpass', 1200, 0.7, (p.noise || 0.9) * vg, at, 0.18);
      return 0.18;
    },
    rimshot(state, book, out, vg, at) {
      toneHit(book, out, 'sine', 400, 0.5 * vg, at, 0.04);
      noiseHit(state, book, out, 'white', 'bandpass', 2500, 2, 0.6 * vg, at, 0.05);
      return 0.05;
    },
    clap(state, book, out, vg, at) {
      const source = book.buffer(noiseBuffer(state, 'white'), true);
      const shaped = book.filter('bandpass', 1100, 1.5);
      const level = book.gain(0);
      source.connect(shaped);
      shaped.connect(level);
      level.connect(out);
      [0, 0.011, 0.022, 0.033].forEach((offset) => {
        level.gain.setValueAtTime(0.8 * vg, at + offset);
        level.gain.setTargetAtTime(0, at + offset, 0.02 / 3);
      });
      level.gain.setValueAtTime(0.5 * vg, at + 0.045);
      level.gain.setTargetAtTime(0, at + 0.045, 0.15 / 3);
      return 0.2;
    },
    tom(state, book, out, vg, at, p) {
      const hz = p.hz || 120;
      const tone = toneHit(book, out, 'sine', hz, 0.9 * vg, at, 0.45);
      tone.frequency.setValueAtTime(hz, at);
      tone.frequency.exponentialRampToValueAtTime(hz * 0.85, at + 0.08);
      noiseHit(state, book, out, 'white', 'lowpass', 1500, 1, 0.15 * vg, at, 0.03);
      return 0.45;
    },
    closedHat(state, book, out, vg, at) {
      noiseHit(state, book, out, 'white', 'highpass', 7000, 0.8, 0.6 * vg, at, 0.045);
      toneHit(book, out, 'square', 420, 0.08 * vg, at, 0.02);
      return 0.045;
    },
    openHat(state, book, out, vg, at) {
      noiseHit(state, book, out, 'white', 'highpass', 6500, 0.8, 0.6 * vg, at, 0.35);
      noiseHit(state, book, out, 'white', 'bandpass', 9000, 0.5, 0.18 * vg, at, 0.35);
      return 0.35;
    },
    pedalHat(state, book, out, vg, at) {
      noiseHit(state, book, out, 'white', 'highpass', 7000, 0.8, 0.4 * vg, at, 0.03);
      toneHit(book, out, 'square', 420, 0.05 * vg, at, 0.02);
      return 0.03;
    },
    crash(state, book, out, vg, at, p) {
      const seconds = p.d || 1.6;
      noiseHit(state, book, out, 'white', 'bandpass', p.bp || 5000, 0.3, 0.8 * vg, at, seconds);
      // Three metal partials into one decaying gain: 8 nodes, the limit of a drum hit (Part 6.6.6); the 7200 Hz partial is gone.
      const partials = decayGain(book, out, 0.04 * vg, at, 1.2);
      [3100, 4300, 5700].forEach((hz) => book.osc('square', hz).connect(partials));
      return seconds;
    },
    ride(state, book, out, vg, at, p) {
      const seconds = p.d || 0.9;
      noiseHit(state, book, out, 'white', 'bandpass', 6000, 0.8, 0.3 * vg, at, seconds);
      toneHit(book, out, 'sine', p.bell ? 2800 : 3400, (p.bell ? 0.35 : 0.15) * vg, at, p.bell ? 0.9 : 0.6);
      return seconds;
    },
    cowbellMisc(state, book, out, vg, at, p) {
      const seconds = p.d || 0.25;
      if (p.sine) {
        toneHit(book, out, 'sine', p.sine, 0.7 * vg, at, seconds);
        return seconds;
      }
      const hz = p.hz || 560;
      const tone = book.filter('bandpass', 1200, 2);
      tone.connect(decayGain(book, out, 0.5 * vg, at, seconds));
      book.osc('square', hz).connect(tone);
      book.osc('square', hz * 1.51).connect(tone);
      return seconds;
    },
    shakerMisc(state, book, out, vg, at, p) {
      const seconds = p.d || 0.08;
      if (p.whistle) {
        const whistle = book.osc('sine', p.whistle);
        const level = decayGain(book, out, 0.4 * vg, at, seconds);
        whistle.connect(level);
        return seconds;
      }
      const source = book.buffer(noiseBuffer(state, 'pink'), true);
      const shaped = book.filter('bandpass', 4500, 1.5);
      const level = decayGain(book, out, 0.5 * vg, at, seconds);
      source.connect(shaped);
      shaped.connect(level);
      if (p.lfo) {
        const lfo = book.osc('sine', p.lfo);
        const swing = book.gain(0.25 * vg);
        lfo.connect(swing);
        swing.connect(level.gain);
      }
      if (p.tambourine) {
        const partials = book.gain(0.08 * vg);
        partials.connect(decayGain(book, out, 1, at, 0.15));
        [6000, 8000].forEach((hz) => book.osc('square', hz).connect(partials));
        return 0.15;
      }
      return seconds;
    }
  };

  function drumKeyInfo(key) {
    const entry = DRUM_KEYS[key];
    if (entry) return { voice: DRUM_INDEX[entry[0]], params: entry[1], scale: 1 };
    return { voice: MISC_INDEX, params: {}, scale: OUT_OF_MAP_VELOCITY };
  }

  function buildDrum(state, key, velocity, strip, at, cs) {
    injectNodeFault();
    const info = drumKeyInfo(key);
    const name = DRUM_VOICE_NAMES[info.voice];
    const vg = (0.1 + 0.9 * Math.pow(velocity / VEL_REFERENCE, 1.3)) * info.scale;
    const book = nodeBook(state.ctx);
    const env = { book, kind: 'drum', program: 'drums', startAt: at, cs, peak: 1, detunes: [], fromLevel: false,
      releaseRamp: CHOKE_RELEASE_S, releaseMax: DRUM_MAX_S, amp: null, drumSeconds: 0, out: null, depthGain: null,
      vibratoBase: 0, isOpenHat: name === 'openHat' };
    try {
      const out = book.gain(1);
      out.connect(strip.input);
      env.out = out;
      const seconds = Math.min(DRUM_MAX_S, DRUM_RECIPES[name](state, book, out, vg, at, info.params));
      env.drumSeconds = seconds;
      const voice = createVoice(state, env);
      voice.endAt(at + seconds * DRUM_TAIL + STOP_PAD_S);
      voice.duration = seconds;
      voice.drumName = name;
      return voice;
    } catch (error) {
      book.abort();
      throw error;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Starting notes: scheduled and live
  // ---------------------------------------------------------------------------------------------
  function reportNodeFailure(state, error) {
    state.allocator.noteDropped();
    Core.ErrorReporter.report('E-AUD-004', error, { module: 'Instruments', origin: 'buildVoice' });
    if (typeof state.engine.recover === 'function') state.engine.recover();     // hard panic and rebuild (10.7.1)
  }

  // Fault audio.fail {phase:'node'} (Part 10.9.2): the next `count` voice builds throw as a failing node creation would.
  function injectNodeFault() {
    const fault = Core.Faults.active('audio.fail');
    if (!fault || (fault.phase !== 'node' && fault.phase !== 'definition')) return;
    Core.Faults.take('audio.fail');
    if (fault.phase === 'definition') throw new Error('injected instrument definition failure (audio.fail)');
    throw new DOMException('injected node creation failure (audio.fail)', 'InvalidStateError');
  }

  // A failing createOscillator() and its kin throw a DOMException: the graph is broken and the engine must rebuild it. Any
  // other error comes from the instrument's own definition and only means that a simpler voice is needed (R-P6.1-12).
  const isNodeFailure = (error) => typeof DOMException !== 'undefined' && error instanceof DOMException;

  const BASIC_TEMPLATE = deepFreeze(template('basic', { oscs: [osc('triangle', 1, 0, 1)],
    filter: filter('lowpass', 4000, 0, 0, 0.7, null), amp: amp(0.005, 0, 1.0, 0.1), vel: { exp: 1, min: 0.2 },
    range: [0, 127], polyphonyHint: 16, animProfile: 'abstract' }));

  // The fallbacks of a program: its family template without the program's own overrides, then one plain triangle voice.
  const fallbackCache = new Map();

  function fallbackDefinitions(program) {
    if (!fallbackCache.has(program)) {
      fallbackCache.set(program, [buildPlainDefinition(program, TEMPLATES[templateIndexOf(program)]),
        buildPlainDefinition(program, BASIC_TEMPLATE)]);
    }
    return fallbackCache.get(program);
  }

  function buildPlainDefinition(program, base) {
    const params = applyOverride(deepClone(base), undefined);
    delete params.id;
    return deepFreeze({ program, name: FLM.Theory.gmProgramName(program), family: Math.floor(program / FAMILY_SIZE),
      template: base.id, fidelity: 'synth-basic', params, range: params.range, polyphonyHint: base.polyphonyHint,
      mono: false, animProfile: base.animProfile, bank: null, defaultProfile: 'A', propId: PROPS[base.animProfile],
      controllers: CONTROLLERS, articulations: [] });
  }

  /**
   * Builds the voice of a program. When its own definition fails the family template is tried, then the basic voice;
   * the program remembers which one works so the failure is not repeated for every note. A node creation failure is
   * not a definition problem: it is thrown to the caller.
   */
  function buildMelodicWithFallback(state, def, pitch, velocity, strip, at, cs, gainMul, wheelExpected) {
    const known = state.fallbackLevel.get(def.program);
    if (known === undefined) {
      try {
        const voice = buildMelodic(state, def, pitch, velocity, strip, at, cs, gainMul, wheelExpected);
        voice.def = def;
        return voice;
      } catch (error) {
        if (isNodeFailure(error)) throw error;
        return buildFallbackVoice(state, def, 0, error, pitch, velocity, strip, at, cs, gainMul, wheelExpected);
      }
    }
    return buildFallbackVoice(state, def, known, null, pitch, velocity, strip, at, cs, gainMul, wheelExpected);
  }

  // The rungs below the definition: the family template (level 1), then the basic voice (level 2); `from` is the first to try.
  function buildFallbackVoice(state, def, from, firstError, pitch, velocity, strip, at, cs, gainMul, wheelExpected) {
    const rungs = fallbackDefinitions(def.program);
    let lastError = firstError;
    for (let level = Math.max(from, 1); level <= rungs.length; level += 1) {
      const candidate = rungs[level - 1];
      try {
        const voice = buildMelodic(state, candidate, pitch, velocity, strip, at, cs, gainMul, wheelExpected);
        state.fallbackLevel.set(def.program, level);
        Log.once('instruments.fallback.' + def.program, 'warn', 'instruments', 'Program ' + def.program + ' failed (' +
          messageOf(lastError) + '); the ' + (candidate.template === 'basic' ? 'basic voice' : 'family template') +
          ' plays instead');
        voice.def = candidate;
        return voice;
      } catch (error) {
        if (isNodeFailure(error)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  function rangeAdvisory(def, pitch) {
    if (pitch >= def.range[0] && pitch <= def.range[1]) return;
    Log.once('range-exceeded-' + def.program, 'info', 'instruments', 'Note outside the usual range of ' + def.name +
      ' still plays', { program: def.program, pitch, range: def.range });
  }

  function priorityOf(def) {
    if (def.program === 'drums' || def.template === 'bass') return 2;
    return def.template === 'synthPad' || def.template === 'sfx' ? 0 : 1;
  }

  // D80: a track with a CC 1 event above 0 gets a vibrato LFO on every note, so a wheel ramp reaches notes already
  // sounding. Found once per track version.
  const wheelCache = new WeakMap();

  function wheelUsed(track) {
    if (!track || !Array.isArray(track.events)) return false;
    let cached = wheelCache.get(track);
    if (!cached || cached.version !== track.version) {
      cached = { version: track.version, used: track.events.some((event) => event.kind === 'cc' && event.controller === 1 &&
        event.value > 0) };
      wheelCache.set(track, cached);
    }
    return cached.used;
  }

  /** The steal priority of a scheduled note (D84): drums and bass 2, melody 1, pads and effects 0. Used by M-05 for chords. */
  function priorityForNote(track, note, atAudio) {
    if (track.isDrums === true) return 2;
    const channels = st && st.channels.get(track.id);
    const cs = channels && channels.get(note.channel);
    const program = cs ? (Number.isFinite(atAudio) ? programAt(cs, atAudio) : cs.program) : track.program;     // the timeline of program changes
    return priorityOf(DEFINITION_LIST[clamp(finiteOr(program, 0), 0, MIDI_MAX)]);
  }

  /** The slot and voice of one note, or null when the voice could not be built (reported, counted dropped). */
  function startVoice(state, track, cs, channel, pitch, velocity, at, program, drums, gainMul) {
    const wanted = drums ? null : DEFINITION_LIST[clamp(program, 0, MIDI_MAX)];
    if (wanted) rangeAdvisory(wanted, pitch);
    let voice = null;
    try {
      const strip = state.engine.createStrip(track.id);
      if (drums) voice = buildDrum(state, pitch, velocity, strip, at, cs);
      else {
        voice = buildMelodicWithFallback(state, wanted, pitch, velocity, strip, at, cs,
          gainMul === undefined ? 1 : gainMul, wheelUsed(track));
      }
    } catch (error) {
      reportNodeFailure(state, error);
      return null;
    }
    scratchOwner.trackId = track.id;
    scratchOwner.channel = channel;
    scratchOwner.pitch = pitch;
    scratchOwner.priority = drums ? 2 : priorityOf(wanted);
    const slot = state.allocator.acquire(scratchOwner, at);       // the allocator copies the fields onto the slot
    voice.pitch = pitch;
    voice.slot = slot;
    slot.voice = voice;
    cs.voices.add(voice);
    voice.start(at);
    return voice;
  }

  const scratchOwner = { trackId: null, channel: 0, pitch: 0, priority: 0 };

  // A closed or pedal hat releases any open hat of the track within 20 ms.
  function applyChoke(cs, voice, at) {
    if (voice.drumName === 'closedHat' || voice.drumName === 'pedalHat') {
      cs.openHats.forEach((open) => open.release(at, CHOKE_RELEASE_S));
      cs.openHats.clear();
    } else if (voice.drumName === 'openHat') {
      cs.openHats.add(voice);
    }
  }

  function legato(cs, def, voice, at) {
    if (!def || !def.mono) return;
    if (cs.monoVoice && cs.monoVoice !== voice) cs.monoVoice.release(at, MONO_RELEASE_S);
    cs.monoVoice = voice;
  }

  // The pedal lengthens a scheduled note (E 3.2): effective duration from Model.deriveSustain, scaled to seconds.
  // The notes of a track that the pedal lengthens, found once per track version (a long track costs a few ms).
  function sustainTable(track) {
    let cached = sustainCache.get(track);
    if (!cached || cached.version !== track.version) {
      cached = { version: track.version, extra: new Map() };
      FLM.Model.deriveSustain(track).forEach((item) => {
        if (item.extendedBySustain) cached.extra.set(item.note, item.effectiveDurTicks);
      });
      sustainCache.set(track, cached);
    }
    return cached;
  }

  function sustainedEnd(track, note, at, end) {
    if (!FLM.Model || typeof FLM.Model.deriveSustain !== 'function' || !(note.durTicks > 0)) return end;
    const effective = sustainTable(track).extra.get(note);
    if (effective === undefined) return end;
    return Math.min(at + VOICE_MAX_S, at + (end - at) * effective / note.durTicks);
  }

  /**
   * Scheduled playback (called by Audio.Scheduler). Without an engine binding nothing sounds.
   * @returns {(object|null)} the VoiceSlot, null when silent by design
   */
  function noteOn(track, note, atAudio, endAudio) {
    const state = st;
    if (!state) return null;
    const cs = channelState(state, track.id, note.channel, track.program);
    const drums = track.isDrums === true;
    const program = drums ? 'drums' : programAt(cs, atAudio);
    const voice = startVoice(state, track, cs, note.channel, note.pitch, note.velocity, atAudio, program, drums);
    if (!voice) return null;
    const slot = voice.slot;
    const def = voice.def;
    if (drums) {
      applyChoke(cs, voice, atAudio);
      const over = atAudio + voice.duration;
      state.allocator.markReleased(slot, over, over + CHOKE_RELEASE_S);
      return slot;
    }
    legato(cs, def, voice, atAudio);
    const end = sustainedEnd(track, note, atAudio, endAudio);
    voice.release(end);
    state.allocator.markReleased(slot, end, end + Math.max(def.params.amp.r, MIN_RAMP_S));
    echoVoices(state, track, cs, note, atAudio, end, program, def);
    sweepLater(state, atAudio);
    return slot;
  }

  // Program 102: two quieter re-triggers at +0.25 s and +0.5 s (each takes its own voice).
  function echoVoices(state, track, cs, note, at, end, program, def) {
    if (!def.params.echoes) return;
    def.params.echoes.forEach((echo) => {
      const echoAt = at + echo[0];
      const echoed = startVoice(state, track, cs, note.channel, note.pitch, note.velocity, echoAt, program, false, echo[1]);
      if (!echoed) return;
      echoed.release(end + echo[0]);
      state.allocator.markReleased(echoed.slot, end + echo[0], end + echo[0] + Math.max(def.params.amp.r, MIN_RAMP_S));
    });
  }

  /** Scheduler live path: a voice held until stopLive (or the sustain pedal comes up). */
  function startLive(trackId, program, isDrums, channel, pitch, velocity, atAudio) {
    const state = st;
    if (!state) return null;
    const track = { id: trackId };
    const cs = channelState(state, trackId, channel, program);
    if (!isDrums) cs.program = finiteOr(program, cs.program);
    const old = cs.heldLive.get(pitch);
    if (old && old.voice) old.voice.release(atAudio, RETRIGGER_RELEASE_S);
    const voice = startVoice(state, track, cs, channel, pitch, velocity, atAudio, isDrums ? 'drums' : cs.program,
      isDrums === true);
    if (!voice) return null;
    cs.heldLive.set(pitch, voice.slot);
    if (isDrums) {
      applyChoke(cs, voice, atAudio);
      state.allocator.markReleased(voice.slot, atAudio + voice.duration, atAudio + voice.duration + 0.02);
      cs.heldLive.delete(pitch);
    } else {
      legato(cs, voice.def, voice, atAudio);
      voice.release(atAudio + VOICE_MAX_S);     // the 60 s cap of scheduled notes; the key coming up ends it earlier
    }
    sweepLater(state, atAudio);
    return voice.slot;
  }

  // The whole cost of starting a note in M-06: the build, the slot, start() and the release booking (Part 9.1.3 voice build).
  function timedNoteOn(track, note, atAudio, endAudio) {
    const begin = Core.now();
    try {
      return noteOn(track, note, atAudio, endAudio);
    } finally {
      counters.buildMs += Core.now() - begin;
    }
  }

  function timedStartLive(trackId, program, isDrums, channel, pitch, velocity, atAudio) {
    const begin = Core.now();
    try {
      return startLive(trackId, program, isDrums, channel, pitch, velocity, atAudio);
    } finally {
      counters.buildMs += Core.now() - begin;
    }
  }

  function releaseLiveSlot(state, slot, at) {
    const voice = slot && slot.voice;
    if (!voice || voice.ended) return;
    voice.release(at);
    state.allocator.markReleased(slot, at, at + voice.releaseRamp);
  }

  /** The key comes up. @returns {boolean} whether a live note was held */
  function stopLive(trackId, channel, pitch, atAudio) {
    const state = st;
    if (!state) return false;
    const cs = channelState(state, trackId, channel, 0);
    const slot = cs.heldLive.get(pitch);
    if (!slot) return false;
    cs.heldLive.delete(pitch);
    if (cs.sustain) cs.sustainedLive.add(slot);
    else releaseLiveSlot(state, slot, atAudio);
    return true;
  }

  // ---------------------------------------------------------------------------------------------
  // Controllers, bend, program (6.6.4.5 to 6.6.4.7)
  // ---------------------------------------------------------------------------------------------
  function allVoices(cs) {
    return Array.from(cs.voices);
  }

  function releaseSustained(state, cs, at) {
    cs.sustainedLive.forEach((slot) => releaseLiveSlot(state, slot, at));
    cs.sustainedLive.clear();
  }

  function applyBend(cs, value, at, live) {
    const range = cs.bendRange;
    const cents = clamp(value, -BEND_CENTER, BEND_CENTER - 1) / BEND_CENTER * range * CENTS_PER_SEMITONE;
    if (live) cs.bendCents = cents;
    else {
      pushTimeline(cs.bends, { at, cents });
      cs.bendCents = cents;
    }
    allVoices(cs).forEach((voice) => voice.setBend(cents, at));
  }

  function handleDataEntry(cs, controller, value) {
    if (cs.rpn.msb !== 0 || cs.rpn.lsb !== 0) return;
    if (controller === 6) cs.bendRange = clamp(value, 0, BEND_RANGE_MAX);
    else cs.bendRange = clamp(Math.floor(cs.bendRange) + value / 128, 0, BEND_RANGE_MAX);
  }

  function handleController(state, trackId, cs, controller, value, at, live) {
    if (controller === 1) {
      cs.modDepthCents = value / MIDI_MAX * MOD_DEPTH_MAX_CENTS;
      allVoices(cs).forEach((voice) => voice.setVibratoDepth(cs.modDepthCents, at));
    } else if (controller === 6 || controller === 38) handleDataEntry(cs, controller, value);
    else if (controller === 101) cs.rpn.msb = value;
    else if (controller === 100) cs.rpn.lsb = value;
    else if (controller === 7) {
      cs.volumeCC = value;
      state.engine.createStrip(trackId).setVolumeCC(value / MIDI_MAX, at);
    } else if (controller === 10) {
      cs.pan = value;
      state.engine.createStrip(trackId).setPan(clamp((value - MIDI_HALF) / MIDI_PAN_SPAN, -1, 1), at);
    } else if (controller === 11) {
      cs.expression = value;
      state.engine.createStrip(trackId).setExpression(value / MIDI_MAX, at);
    } else if (controller === 64) {
      cs.sustain = value >= MIDI_HALF;
      if (!cs.sustain && live) releaseSustained(state, cs, at);
    } else if (controller === 120) {
      allVoices(cs).forEach((voice) => voice.stop(at));
      cs.sustainedLive.clear();
    } else if (controller === 121) resetControllers(state, cs, at);
    else if (controller === 123) {
      allVoices(cs).forEach((voice) => voice.release(at));
      cs.heldLive.clear();
    } else if (controller === 0 || controller === 32) {
      Log.once('instruments.bank', 'info', 'instruments', 'Bank select is stored and ignored: one kit, one bank');
    } else {
      unsupported.add(controller);
      Log.once('cc-unsupported-' + controller, 'info', 'instruments', 'Unsupported controller ignored',
        { controller });
    }
  }

  function resetControllers(state, cs, at) {
    cs.bendCents = 0;
    cs.bends.length = 0;
    cs.modDepthCents = 0;
    cs.expression = MIDI_MAX;
    cs.sustain = false;
    allVoices(cs).forEach((voice) => {
      voice.setBend(0, at);
      voice.setVibratoDepth(0, at);
    });
    releaseSustained(state, cs, at);
  }

  /** Scheduled control event (cc, program, bend) of a track. */
  function control(track, event, atAudio) {
    const state = st;
    if (!state) return;
    const cs = channelState(state, track.id, event.channel, track.program);
    if (event.kind === 'program') {
      if (track.isDrums) Log.once('instruments.drum-program', 'info', 'instruments', 'A program change on a drum track is ' +
        'recorded and ignored: one GM kit');
      cs.programSeq += 1;
      pushTimeline(cs.programs, { at: atAudio, program: event.program, seq: cs.programSeq });
    } else if (event.kind === 'bend') applyBend(cs, event.value, atAudio, false);
    else if (event.kind === 'cc') handleController(state, track.id, cs, event.controller, event.value, atAudio, false);
  }

  /** Scheduler live path: a controller, bend or program change at once (kind 'cc', 'bend' or 'program'). */
  function applyLive(trackId, channel, kind, first, second, atAudio) {
    const state = st;
    if (!state) return;
    const cs = channelState(state, trackId, channel, 0);
    if (kind === 'program') {
      cs.program = clamp(Math.round(finiteOr(first, 0)), 0, MIDI_MAX);
      cs.programs.length = 0;
    } else if (kind === 'bend') applyBend(cs, finiteOr(first, 0), atAudio, true);
    else handleController(state, trackId, cs, first, finiteOr(second, 0), atAudio, true);
  }

  // ---------------------------------------------------------------------------------------------
  // Public live API (M-08, M-17): the Scheduler adds the sched.* events around the voice calls above
  // ---------------------------------------------------------------------------------------------
  function viaScheduler(state) {
    return state && state.engine.Scheduler && typeof state.engine.Scheduler.liveNoteOn === 'function';
  }

  /** Live key down (Free Play, recording). @returns {(object|null)} the VoiceSlot */
  function liveNoteOn(trackId, program, isDrums, channel, pitch, velocity, atAudio) {
    const state = requireState();
    if (!viaScheduler(state)) return startLive(trackId, program, isDrums, channel, pitch, velocity, atAudio);
    return state.engine.Scheduler.liveNoteOn(trackId, pitch, velocity, channel, atAudio, { program, isDrums });
  }

  function liveNoteOff(trackId, channel, pitch, atAudio) {
    const state = requireState();
    if (!viaScheduler(state)) return stopLive(trackId, channel, pitch, atAudio);
    return state.engine.Scheduler.liveNoteOff(trackId, pitch, channel, atAudio);
  }

  function controlLive(trackId, channel, kind, first, second, atAudio) {
    const state = requireState();
    if (!viaScheduler(state)) return applyLive(trackId, channel, kind, first, second, atAudio);
    const event = kind === 'cc' ? { channel, controller: first, value: second }
      : (kind === 'bend' ? { channel, value: first } : { channel, program: first, bankMsb: second });
    return state.engine.Scheduler.liveControl(trackId, kind, event, atAudio);
  }

  // ---------------------------------------------------------------------------------------------
  // Track-level calls
  // ---------------------------------------------------------------------------------------------
  /** The program most recently scheduled or set for a track (channel states of the track). */
  function programOf(trackId) {
    const state = requireState();
    const channels = state.channels.get(trackId);
    if (!channels) return 0;
    let best = null;
    channels.forEach((cs) => {
      if (best === null || cs.programSeq >= best.programSeq) best = cs;
    });
    const last = best.programs.length > 0 ? best.programs[best.programs.length - 1] : null;
    return last ? last.program : best.program;
  }

  /** Initial assignment (M-17, M-27): live notes already held keep their patch. */
  function setTrackProgram(trackId, program, isDrums) {
    const state = requireState();
    if (isDrums) return;
    const channels = state.channels.get(trackId);
    const wanted = clamp(Math.round(finiteOr(program, 0)), 0, MIDI_MAX);
    if (!channels) channelState(state, trackId, 0, wanted);
    else channels.forEach((cs) => { cs.program = wanted; cs.programs.length = 0; });
  }

  /** Releases every held, sustained and scheduled voice of a track. @returns {number} voices released */
  function releaseTrack(trackId, atAudio, rampS) {
    const state = requireState();
    const channels = state.channels.get(trackId);
    if (!channels) return 0;
    let released = 0;
    channels.forEach((cs) => {
      cs.voices.forEach((voice) => {
        voice.release(atAudio, rampS);
        if (voice.slot) state.allocator.markReleased(voice.slot, atAudio, atAudio + (rampS === undefined ? voice.releaseRamp : rampS));
        released += 1;
      });
      cs.heldLive.clear();
      cs.sustainedLive.clear();
      cs.sustain = false;
    });
    return released;
  }

  /** Every panic: the pedal goes up (CC 64 = 0) on every channel and live bookkeeping is forgotten (E 2.3). */
  function allNotesOff() {
    if (!st) return;
    st.channels.forEach((channels) => channels.forEach((cs) => {
      cs.sustain = false;
      cs.heldLive.clear();
      cs.sustainedLive.clear();
      cs.monoVoice = null;
      cs.openHats.clear();
    }));
  }

  /** Voices that are currently sounding or releasing. */
  function activeVoices() {
    let count = 0;
    if (st) st.channels.forEach((channels) => channels.forEach((cs) => { count += cs.voices.size; }));
    return count;
  }

  // The watchdog (6.6.5): a slot whose release ended more than a second ago without onended is freed.
  function sweep(now) {
    if (!st) return 0;
    let freed = 0;
    st.allocator.list().forEach((slot) => {
      const voice = slot.voice;
      if (!voice || voice.ended || slot.state !== 'released' || slot.releaseEndAt === null) return;
      if (now - slot.releaseEndAt <= WATCHDOG_GRACE_S) return;
      voice.dispose();
      freed += 1;
    });
    st.lastSweep = now;
    return freed;
  }

  function sweepLater(state, at) {
    if (at - state.lastSweep >= SWEEP_EVERY_S) sweep(state.engine.now());
  }

  // ---------------------------------------------------------------------------------------------
  // Definitions, fidelity, warm-up, statistics
  // ---------------------------------------------------------------------------------------------
  function definition(program) {
    const valid = Number.isInteger(program) && program >= 0 && program <= MIDI_MAX;
    if (!valid) Log.warn('instruments', 'W-INS-PROGRAM: program ' + program + ' is outside 0..127; the piano is used');
    return DEFINITION_LIST[valid ? program : 0];
  }

  function drumVoiceFor(key) {
    const valid = Number.isInteger(key) && key >= 0 && key <= MIDI_MAX;
    return DRUM_VOICE_LIST[valid ? DRUM_MAP[key] : MISC_INDEX];
  }

  /** Fidelity declaration shown in the UI (I 3.4): always synthesized, never sampled. */
  function fidelity(program) {
    const drums = program === 'drums';
    const def = drums ? null : definition(program);
    const level = drums ? 'synth-velocity' : def.fidelity;
    return Object.freeze({ level, sampled: false, velocityLayers: drums ? 1 : def.params.layers.length,
      controllers: CONTROLLERS, articulations: drums ? [] : def.articulations, percussion: drums,
      label: level === 'synth-basic' ? 'Synthesized' : 'Synthesized, velocity-sensitive' });
  }

  /** The usual range of a program as [low, high] (M-08 uses it for the default octave). */
  function range(program) {
    return definition(program).range;
  }

  /** Computes pluck buffers for a pitch range in the background, yielding every 8 buffers. */
  function warmup(requests) {
    const state = requireState();
    const jobs = [];
    (requests || []).forEach((item) => {
      const def = asDefinition(item.program);
      if (!def.params.pluck) return;
      for (let pitch = item.loPitch; pitch <= item.hiPitch; pitch += 1) jobs.push([def, pitch]);
    });
    return new Promise((resolve) => {
      let next = 0;
      const step = () => {
        const limit = Math.min(jobs.length, next + PLUCK_YIELD_EVERY);
        for (; next < limit; next += 1) pluckBuffer(jobs[next][0], jobs[next][1]);
        if (next >= jobs.length || st !== state) resolve();
        else Core.timers.setTimeout(step, 0, WARMUP_OWNER);
      };
      step();
    });
  }

  // One throw-away voice per program and per drum recipe the song uses, so the first real note of each does not pay for the first
  // use of the node types, the wave and curve tables (a cold build costs several ms, a tick has 4). The voice goes through a strip
  // of its own that is removed again; it is never started, never takes a slot and is not counted.
  function primeVoices(state, song) {
    const built = counters.voicesBuilt;
    const seen = new Set();
    const at = state.engine.now() + PRIME_LEAD_S;
    const strip = state.engine.createStrip(PRIME_STRIP);
    const prime = (label, make) => {
      if (seen.has(label) || seen.size >= PRIME_MAX_VOICES) return;
      seen.add(label);
      try {
        make().dispose();
      } catch (error) {
        Log.warn('instruments', 'priming ' + label + ' failed: ' + messageOf(error));
      }
    };
    try {
      ((song && song.tracks) || []).forEach((track) => {
        const events = track.events || [];
        if (track.isDrums === true) {
          events.forEach((event) => {
            if (event.kind === 'note') prime('drum ' + drumKeyInfo(event.pitch).voice, () => buildDrum(state, event.pitch,
              PRIME_VELOCITY, strip, at, newChannelState(0)));
          });
          return;
        }
        const first = events.find((event) => event.kind === 'note');
        const pitch = first ? first.pitch : PRIME_PITCH;     // a plucked program makes the buffer it needs anyway
        const programs = new Set([finiteOr(track.program, 0)]);
        events.forEach((event) => { if (event.kind === 'program') programs.add(event.program); });
        programs.forEach((program) => prime('program ' + program, () => buildMelodic(state,
          DEFINITION_LIST[clamp(program, 0, MIDI_MAX)], pitch, PRIME_VELOCITY, strip, at, newChannelState(program), 1,
          wheelUsed(track))));
      });
    } finally {
      state.engine.disposeStrip(PRIME_STRIP);
      counters.voicesBuilt = built;
    }
  }

  let warmSong = null;          // the song primed last: a new context needs it primed again (onGraphRebuilt)

  /**
   * Everything the first notes of a song need, made before play starts (the mode setup awaits it): one primed voice per program and
   * drum recipe, the sustain table of every track and the Karplus-Strong buffers of the plucked programs, at most as many buffers
   * as the cache holds (the mobile cache has 24: more would evict the ones just made).
   */
  function warmupSong(song) {
    warmSong = song;
    if (st) {
      ((song && song.tracks) || []).forEach((track) => {
        if (track.isDrums === true || !FLM.Model || typeof FLM.Model.deriveSustain !== 'function') return;
        try {
          sustainTable(track);
        } catch (error) {
          Log.warn('instruments', 'sustain warm-up failed: ' + messageOf(error));
        }
      });
      primeVoices(st, song);
    }
    const requests = [];
    ((song && song.tracks) || []).forEach((track) => {
      if (track.isDrums === true || !Array.isArray(track.events)) return;
      const programs = new Set([finiteOr(track.program, 0)]);
      track.events.forEach((event) => { if (event.kind === 'program') programs.add(event.program); });
      const pitches = new Set();
      track.events.forEach((event) => { if (event.kind === 'note') pitches.add(event.pitch); });
      programs.forEach((program) => {
        const def = DEFINITION_LIST[clamp(program, 0, MIDI_MAX)];
        if (!def.params.pluck) return;
        pitches.forEach((pitch) => requests.push({ program: def.program, loPitch: pitch + def.params.pitch,
          hiPitch: pitch + def.params.pitch }));
      });
    });
    return requests.length === 0 ? Promise.resolve() : warmup(requests.slice(0, pluckState.cap));
  }

  function stats() {
    if (st) sweep(st.engine.now());
    return { pluckCacheEntries: pluckCache.size, pluckCacheBytes: pluckState.bytes, voicesBuilt: counters.voicesBuilt,
      voiceBuildMs: counters.buildMs, fadingNodes: counters.fadingNodes, unsupportedCCs: Array.from(unsupported).sort((a, b) => a - b) };
  }

  /** Test and settings hook: the pluck cache cap (48 desktop, 24 mobile) and an empty cache. */
  function configurePluckCache(cap, clear) {
    if (Number.isInteger(cap) && cap > 0) pluckState.cap = cap;
    if (clear) {
      pluckCache.clear();
      pluckState.bytes = 0;
    }
  }

  const Voice = Object.freeze({ melodic: buildMelodic, drum: buildDrum, MAX_NODES: MAX_VOICE_NODES, MAX_DRUM_NODES });

  return Object.freeze({
    VERSION, FAMILIES: TEMPLATES, FAMILY_NAMES, DEFINITIONS: DEFINITION_LIST, DRUM_VOICES: DRUM_VOICE_LIST, DRUM_MAP,
    attach, onGraphRebuilt, definition, drumVoiceFor, fidelity, range, noteOn: timedNoteOn, noteOff: liveNoteOff, allNotesOff,
    program: setTrackProgram, controller: controlLive, pitchBend: (trackId, channel, value, at) => controlLive(trackId,
      channel, 'bend', value, undefined, at), liveNoteOn, liveNoteOff, startLive: timedStartLive, stopLive, applyLive, control,
    controlLive, programOf, setTrackProgram, warmup, warmupSong, priorityOf: priorityForNote, releaseTrack, activeVoices, stats, sweep, pluckBuffer,
    configurePluckCache, Voice, dispose
  });
});
})();
