// 08-mapping.js - M-08 FLM.Mapping: the live mapper that turns InputEvents into musical actions through the six
// profiles A-F (four-note lanes, interval, chord, scale, instrument-specific, rhythm), with octave and register
// control, a range policy, held, fixed-length and sustained notes, chord labels and quantized recorded ticks.
// Separation rule: this file owns exactly one namespace (Mapping) and registers it once through FLM.Core.define.
// It may use only lower-numbered modules (Part 4.2, R-DEP). It declares no module-level global state object (S-07):
// every mapper keeps its state in its own closure. It writes to no Song or Track (S-08): the source arrangement is
// never touched, a profile only changes what the four buttons play. FLM.Transport and FLM.Instruments are read
// lazily, because M-06 is built later (T04.06) and tests swap both namespaces.
// Delivered so far: T03.05 (profiles A-F, actions, dispatch) and T03.06 (scales, chords, intervals, range policy,
// hold and sustain, labels, quantization). EXTENSION POINT: Phase 08 adds ChartGenerator and settingsHash here.
// Spec: docs/IMPLEMENTATION-PLAN.md Part 6.8 (API 6.8.2, algorithms 6.8.4 A-F), B 8.3, I 2.1.
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Mapping', function (FLM) {
  const Core = FLM.Core;
  const Theory = FLM.Theory;
  const Log = Core.Log;

  const PROFILES = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);
  const PROFILE_TITLES = Object.freeze({ A: 'Four-note lanes', B: 'Interval', C: 'Chord', D: 'Scale',
    E: 'Instrument-specific', F: 'Rhythm or percussion' });
  const PROFILE_CONTROLS = Object.freeze({ profile1: 'A', profile2: 'B', profile3: 'C', profile4: 'D', profile5: 'E',
    profile6: 'F' });
  const LANE_CONTROLS = Object.freeze(['lane0', 'lane1', 'lane2', 'lane3']);
  const LANE_COUNT = LANE_CONTROLS.length;
  const MIDI_CONTROL_PATTERN = /^midi:(\d{1,3})$/;
  const RUNNING_STATES = Object.freeze(['countin', 'playing', 'recording']);
  const NOTE_LENGTH_MODES = Object.freeze(['hold', 'fixed']);
  const VOICINGS = Object.freeze(['close', 'open', 'spread']);

  const MIDI_MAX = 127;
  const OCTAVE_SIZE = 12;
  const OCTAVE_MIN = -1;
  const OCTAVE_MAX = 9;
  const DEFAULT_OCTAVE = 4;
  const REGISTER_LIMIT = 7;                    // profile D shifts by single degrees, -7..7
  const DRUM_PAGE_LIMIT = 1;                   // profile F pages -1, 0, 1
  const DEFAULT_VELOCITY = 100;
  const NEUTRAL_PRESSURE = 0.5;                // what pointer events report when the device has no pressure
  const SUSTAIN_CONTROLLER = 64;
  const CONTROLLER_ON = 127;
  const DRUM_CHANNEL = 9;                      // MIDI channel 10, zero-based
  const DEFAULT_RANGE = Object.freeze({ low: 21, high: 108 });   // Acoustic Grand Piano
  const QUANTIZE_GRID_TICKS = 240;             // 1/16 note at 960 ticks per quarter
  const DEFAULT_FIXED_TICKS = 240;
  const TICKS_PER_SECOND_FALLBACK = 1920;      // 120 BPM at 960 ticks per quarter, used when no transport exists
  const FIXED_MIN_SECONDS = 0.05;              // note length 'fixed' is 50 to 2,000 ms whatever the tempo
  const FIXED_MAX_SECONDS = 2;
  const CHORD_WINDOW_SECONDS = 0.03;
  const WINDOW_PITCH_LIMIT = 10;               // chord recognition looks at no more than ten pitches
  const DISPATCH_LEAD_SECONDS = 0.005;
  const MS_PER_SECOND = 1000;
  const RECORDED_LIMIT = 256;
  const VOICING_DROP_LIMIT = 9;                // see lowerHighChord
  const SCALE_THIRD_MAJOR = 4;
  const SCALE_THIRD_MINOR = 3;
  const PERFECT_FIFTH = 7;
  const INTERVAL_LIMIT = 24;                   // P1 to P15
  const BASS_FAMILY = 4;
  const GUITAR_FAMILY = 3;
  const EFFECT_FAMILIES = Object.freeze([12, 15]);   // synth effects, sound effects
  const BASS_OCTAVE = 2;
  const GUITAR_OCTAVE = 3;
  const DEFAULT_SLOT_DEGREES = Object.freeze([1, 4, 5, 6]);   // I IV V vi, or i iv v VI
  const TRIAD_SHAPES = Object.freeze([
    { third: 4, fifth: 7, type: 'major' }, { third: 3, fifth: 7, type: 'minor' },
    { third: 3, fifth: 6, type: 'dim' }, { third: 4, fifth: 8, type: 'aug' }]);

  // Profile F pages (B 8.3): page -> the four GM drum keys. Profile E uses page 0 when the track is a drum kit.
  const DRUM_LANES = Object.freeze({
    '-1': Object.freeze([35, 37, 44, 46]),
    '0': Object.freeze([36, 38, 42, 49]),
    '1': Object.freeze([45, 50, 51, 56])
  });
  // GM drum key -> lane for chart generation (6.8.4 K): kick, snare family, hats, everything else.
  const DRUM_KEY_LANES = Object.freeze({ 35: 0, 36: 0, 37: 1, 38: 1, 39: 1, 40: 1, 42: 2, 44: 2, 46: 2 });
  const DRUM_OTHER_LANE = 3;

  function codedError(code, text) {
    const error = new Error(code + ': ' + text);
    error.code = code;
    return error;
  }

  function requireInteger(value, low, high, label) {
    if (!Number.isInteger(value) || value < low || value > high) {
      throw codedError('E-GEN-005', label + ' must be an integer from ' + low + ' to ' + high);
    }
    return value;
  }

  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }

  function has(object, name) {
    return Object.prototype.hasOwnProperty.call(object, name);
  }

  function addUnique(list, value) {
    if (!list.includes(value)) list.push(value);
  }

  function nowSeconds() {
    const audio = FLM.Audio;
    const context = audio && typeof audio.ctx === 'function' ? audio.ctx() : null;
    return context ? context.currentTime : Core.now() / MS_PER_SECOND;
  }

  // ---------------------------------------------------------------------------------------------
  // Context pieces: key, scale, octave, range, channel
  // ---------------------------------------------------------------------------------------------
  function checkKey(key) {
    const tonic = requireInteger(key && key.tonic, 0, OCTAVE_SIZE - 1, 'key.tonic');
    if (key.mode !== 'major' && key.mode !== 'minor') throw codedError('E-GEN-005', 'key.mode must be major or minor');
    return { tonic, mode: key.mode };
  }

  function scaleIdOf(state) {
    const modeDefault = state.key.mode === 'minor' ? 'naturalMinor' : 'major';
    return state.scaleId !== null && Theory.scale(state.scaleId) ? state.scaleId : modeDefault;
  }

  function scaleIntervals(state) {
    return Theory.scale(scaleIdOf(state)).intervals;
  }

  function familyOf(program) {
    return Theory.gmFamily(program).index;
  }

  // Profile E starts a bass in octave 2 and a guitar in octave 3 (the octave of the instrument's range midpoint).
  function defaultOctave(state) {
    if (state.profile !== 'E' || state.isDrums) return DEFAULT_OCTAVE;
    const family = familyOf(state.program);
    if (family === BASS_FAMILY) return BASS_OCTAVE;
    return family === GUITAR_FAMILY ? GUITAR_OCTAVE : DEFAULT_OCTAVE;
  }

  function effectiveOctave(state) {
    return state.octave === null ? defaultOctave(state) : state.octave;
  }

  function drumsActive(state) {
    return state.profile === 'F' || (state.profile === 'E' && state.isDrums);
  }

  function channelOf(state) {
    return state.isDrums || state.profile === 'F' ? DRUM_CHANNEL : state.channel;
  }

  function toRange(value) {
    const low = Array.isArray(value) ? value[0] : value && value.low;
    const high = Array.isArray(value) ? value[1] : value && value.high;
    const isValid = Number.isInteger(low) && Number.isInteger(high) && low >= 0 && high <= MIDI_MAX && low <= high;
    return isValid ? { low, high } : null;
  }

  function rangeOf(state) {
    if (state.range !== null) return state.range;
    const instruments = FLM.Instruments;
    const canReport = instruments && typeof instruments.range === 'function';
    const reported = canReport ? toRange(instruments.range(state.program)) : null;
    return reported || DEFAULT_RANGE;
  }

  function transportOf(state) {
    if (state.transport) return state.transport;
    return FLM.Transport && FLM.Transport.main ? FLM.Transport.main : null;
  }

  // ---------------------------------------------------------------------------------------------
  // Lane tables for each profile (6.8.4 B). Each returns four arrays of raw pitches, before the range policy.
  // ---------------------------------------------------------------------------------------------
  const LANE_INDEXES = Object.freeze([0, 1, 2, 3]);

  function tonicPitch(state) {
    return OCTAVE_SIZE * (effectiveOctave(state) + 1) + state.key.tonic;
  }

  function degreePitch(state, degreeIndex) {
    return Theory.scaleNote(state.key.tonic, scaleIdOf(state), effectiveOctave(state), degreeIndex);
  }

  function degreeLanes(state, indexes) {
    return indexes.map((index) => [degreePitch(state, index)]);
  }

  function lanesA(state) {
    return degreeLanes(state, LANE_INDEXES);
  }

  function defaultIntervals(state) {
    const third = scaleIntervals(state)[2] === SCALE_THIRD_MAJOR ? SCALE_THIRD_MAJOR : SCALE_THIRD_MINOR;
    return [0, third, PERFECT_FIFTH, OCTAVE_SIZE];
  }

  function currentIntervals(state) {
    return state.intervals === null ? defaultIntervals(state) : state.intervals;
  }

  function lanesB(state) {
    const root = tonicPitch(state);
    return currentIntervals(state).map((semitones) => [root + semitones]);
  }

  /** The triad quality built on a scale degree (1-based): 'major', 'minor', 'dim' or 'aug'. */
  function diatonicTriad(scaleId, degree) {
    const intervals = (Theory.scale(scaleId) || Theory.scale('major')).intervals;
    const length = intervals.length;
    const semitonesAt = (index) => intervals[index % length] + OCTAVE_SIZE * Math.floor(index / length);
    const start = degree - 1;
    const third = semitonesAt(start + 2) - semitonesAt(start);
    const fifth = semitonesAt(start + 4) - semitonesAt(start);
    const shape = TRIAD_SHAPES.find((candidate) => candidate.third === third && candidate.fifth === fifth);
    return shape ? shape.type : 'major';
  }

  function defaultChordSlots(state) {
    const scaleId = scaleIdOf(state);
    return DEFAULT_SLOT_DEGREES.map((degree) => (
      { degree, type: diatonicTriad(scaleId, degree), inversion: 0, voicing: 'close' }));
  }

  function currentChordSlots(state) {
    return state.chordSlots === null ? defaultChordSlots(state) : state.chordSlots;
  }

  // Keeps the hands near the root: a chord whose lowest note sits more than 9 semitones above the tonic's nearest
  // octave root drops by one octave. (Plan text says 7 but its own examples need 9; see the ledger note.)
  function lowerHighChord(state, notes) {
    const tonic = state.key.tonic;
    const nearTonic = tonic > OCTAVE_SIZE / 2 ? tonic - OCTAVE_SIZE : tonic;
    const reference = OCTAVE_SIZE * (effectiveOctave(state) + 1) + nearTonic;
    return notes[0] - reference > VOICING_DROP_LIMIT ? notes.map((note) => note - OCTAVE_SIZE) : notes;
  }

  function chordPitches(state, slot) {
    const intervals = scaleIntervals(state);
    const rootClass = Theory.pitchClass(state.key.tonic + intervals[(slot.degree - 1) % intervals.length]);
    const notes = Theory.chordNotes(rootClass, slot.type, slot.inversion, effectiveOctave(state), slot.voicing);
    return lowerHighChord(state, notes);
  }

  function lanesC(state) {
    return currentChordSlots(state).map((slot) => chordPitches(state, slot));
  }

  function lanesD(state) {
    const first = state.register + state.page * LANE_COUNT;
    return degreeLanes(state, LANE_INDEXES.map((lane) => first + lane));
  }

  function drumPage(state) {
    return DRUM_LANES[String(clamp(state.page, -DRUM_PAGE_LIMIT, DRUM_PAGE_LIMIT))];
  }

  function lanesF(state) {
    return drumPage(state).map((key) => [key]);
  }

  function powerChord(root) {
    return [root, root + PERFECT_FIFTH, root + OCTAVE_SIZE];
  }

  function lanesBass(state) {
    const root = degreePitch(state, 0);
    return [[root], [root + PERFECT_FIFTH], [root + OCTAVE_SIZE], [degreePitch(state, 6)]];
  }

  function lanesGuitar(state) {
    return [powerChord(degreePitch(state, 0)), powerChord(degreePitch(state, 3)), powerChord(degreePitch(state, 4)),
      [degreePitch(state, 0)]];
  }

  function lanesE(state) {
    if (state.isDrums) return DRUM_LANES['0'].map((key) => [key]);
    const family = familyOf(state.program);
    if (family === BASS_FAMILY) return lanesBass(state);
    if (family === GUITAR_FAMILY) return lanesGuitar(state);
    if (EFFECT_FAMILIES.includes(family)) return lanesA(state);
    return degreeLanes(state, [0, 2, 4, 7]);          // degrees 1, 3, 5 and 8
  }

  const PROFILE_LANES = Object.freeze({ A: lanesA, B: lanesB, C: lanesC, D: lanesD, E: lanesE, F: lanesF });

  // ---------------------------------------------------------------------------------------------
  // Range policy (6.8.4 C)
  // ---------------------------------------------------------------------------------------------
  function foldPitch(pitch, range) {
    let folded = pitch;
    while (folded < range.low) folded += OCTAVE_SIZE;
    while (folded > range.high) folded -= OCTAVE_SIZE;
    return clamp(folded, range.low, range.high);          // a range narrower than an octave ends here
  }

  function warnRangeOnce(state, pitch) {
    if (state.rangeWarned.includes(state.program)) return;
    state.rangeWarned.push(state.program);
    Log.warn('mapping', 'MAP_RANGE_CLAMP', { program: state.program, pitch });
  }

  /** Moves every pitch into the instrument range by octaves; drum keys and duplicates are handled here too. */
  function applyRangePolicy(state, pitches, shouldWarn) {
    if (drumsActive(state)) return pitches.slice();
    const range = rangeOf(state);
    const result = [];
    pitches.forEach((pitch) => {
      const folded = foldPitch(pitch, range);
      if (folded !== pitch && shouldWarn) warnRangeOnce(state, pitch);
      addUnique(result, folded);
    });
    return result;
  }

  function lanePitches(state, lane, shouldWarn) {
    return applyRangePolicy(state, PROFILE_LANES[state.profile](state)[lane], shouldWarn);
  }

  // ---------------------------------------------------------------------------------------------
  // Octave, page and profile changes
  // ---------------------------------------------------------------------------------------------
  /** Total distance, in semitones, by which the four lanes of a state fall outside the instrument range. */
  function overshoot(state) {
    if (drumsActive(state)) return 0;
    const range = rangeOf(state);
    let total = 0;
    PROFILE_LANES[state.profile](state).forEach((pitches) => pitches.forEach((pitch) => {
      total += Math.max(0, range.low - pitch, pitch - range.high);
    }));
    return total;
  }

  function usesPages(state) {
    return state.profile === 'D' || state.profile === 'F';
  }

  function movedCopy(state, step) {
    const moved = Object.assign({}, state);
    if (usesPages(state)) moved.page = state.page + step;
    else moved.octave = clamp(effectiveOctave(state) + step, OCTAVE_MIN, OCTAVE_MAX);
    return moved;
  }

  function canMove(state, moved) {
    if (state.profile === 'E' && state.isDrums) return false;             // a drum kit has no octaves
    if (state.profile === 'F' && Math.abs(moved.page) > DRUM_PAGE_LIMIT) return false;
    const after = overshoot(moved);
    return after === 0 || after < overshoot(state);                      // never walk a page out of range
  }

  /** Octave (profiles A, B, C, E) or page (D, F) steps; the move is refused when it would leave the range. */
  function stepOctave(state, step) {
    const moved = movedCopy(state, step);
    if (!canMove(state, moved)) return;
    state.octave = moved.octave;
    state.page = moved.page;
  }

  function shiftOctaveAction(state, step, stamp, control) {
    stepOctave(state, step);
    return makeAction(state, 'octave', stamp, { control, page: state.page });
  }

  function setProfileOn(state, profile, stamp, control) {
    if (!PROFILES.includes(profile)) throw codedError('E-GEN-005', 'unknown profile: ' + String(profile));
    state.profile = profile;
    return makeAction(state, 'profile', stamp, { control });
  }

  // ---------------------------------------------------------------------------------------------
  // Actions, stamps, velocity
  // ---------------------------------------------------------------------------------------------
  function snapToGrid(tick) {
    return Math.floor(tick / QUANTIZE_GRID_TICKS + 0.5) * QUANTIZE_GRID_TICKS;
  }

  /** tick and rawTick at an audio time; both null when the transport is not running or the time is unknown. */
  function stampAt(state, tAudio) {
    const transport = transportOf(state);
    const isRunning = typeof tAudio === 'number' && transport !== null && RUNNING_STATES.includes(transport.state());
    const rawTick = isRunning ? Math.round(transport.tickAt(tAudio)) : null;
    const tick = state.quantize && rawTick !== null ? snapToGrid(rawTick) : rawTick;
    return { tAudio: typeof tAudio === 'number' ? tAudio : null, rawTick, tick };
  }

  function makeAction(state, kind, stamp, fields) {
    return Object.assign({
      kind, pitches: [], velocity: 0, controller: 0, value: 0, profile: state.profile,
      octave: effectiveOctave(state), label: '', control: '', tAudio: stamp.tAudio, tick: stamp.tick,
      rawTick: stamp.rawTick, channel: channelOf(state), program: state.program
    }, fields);
  }

  function velocityOf(state, event) {
    const pressure = event.pressure;
    if (typeof pressure !== 'number' || !(pressure > 0)) return state.velocity;
    const isMidi = event.source === 'midi';
    const isPointerPressure = event.source === 'pointer' && pressure !== NEUTRAL_PRESSURE;
    const isGamepadAnalog = event.source === 'gamepad' && pressure < 1;
    if (!isMidi && !isPointerPressure && !isGamepadAnalog) return state.velocity;
    return clamp(Math.round(pressure * MIDI_MAX), 1, MIDI_MAX);
  }

  // ---------------------------------------------------------------------------------------------
  // Chord label (6.8.4 D.7): presses within 30 ms form one group; the label never delays the sound
  // ---------------------------------------------------------------------------------------------
  function chordName(found) {
    const names = Theory.PITCH_CLASS_SHARP;
    const slash = found.inversion > 0 ? '/' + names[Theory.pitchClass(found.bass)] : '';
    return names[found.root] + Theory.chord(found.type).symbol + slash;
  }

  function intervalLabel(low, high) {
    let semitones = high - low;
    while (semitones > INTERVAL_LIMIT) semitones -= OCTAVE_SIZE;
    return Theory.intervals()[semitones].name;
  }

  function labelFor(pitches) {
    const sorted = pitches.slice().sort((a, b) => a - b);
    if (sorted.length === 1) return Theory.noteName(sorted[0]);
    const found = Theory.recognizeChord(sorted);
    if (found) return chordName(found);
    const classes = new Set(sorted.map(Theory.pitchClass)).size;
    if (classes <= 2) return intervalLabel(sorted[0], sorted[sorted.length - 1]);
    return sorted.map((pitch) => Theory.noteName(pitch)).join(' ');
  }

  function labelAction(state, stamp, pitches, control) {
    const group = state.chordWindow;
    const at = stamp.tAudio !== null ? stamp.tAudio : Core.now() / MS_PER_SECOND;
    if (group.t0 === null || at - group.t0 > CHORD_WINDOW_SECONDS) {
      group.t0 = at;
      group.pitches = [];
    }
    pitches.forEach((pitch) => {
      if (group.pitches.length < WINDOW_PITCH_LIMIT) addUnique(group.pitches, pitch);
    });
    state.lastChordLabel = labelFor(group.pitches);
    return makeAction(state, 'label', stamp, { label: state.lastChordLabel, pitches: group.pitches.slice(), control });
  }

  // ---------------------------------------------------------------------------------------------
  // Press and release (6.8.4 D)
  // ---------------------------------------------------------------------------------------------
  /** Seconds a fixed-length note lasts at the current tempo and speed, held to 50..2,000 ms. */
  function fixedSeconds(state, rawTick) {
    const transport = transportOf(state);
    const start = rawTick === null ? 0 : rawTick;
    let seconds = state.fixedDurTicks / TICKS_PER_SECOND_FALLBACK;
    if (transport && typeof transport.tempoMap === 'function') {
      const tempoMap = transport.tempoMap();
      const speed = typeof transport.speed === 'function' ? transport.speed() : 1;
      seconds = (tempoMap.ticksToSeconds(start + state.fixedDurTicks) - tempoMap.ticksToSeconds(start)) / speed;
    }
    return clamp(seconds, FIXED_MIN_SECONDS, FIXED_MAX_SECONDS);
  }

  // The note-off of a fixed-length note is emitted at press time with its own audio time (no JS timer, invariant 2).
  function fixedOffAction(state, stamp, pitches, control) {
    const base = stamp.tAudio !== null ? stamp.tAudio : nowSeconds() + DISPATCH_LEAD_SECONDS;
    const offAt = base + fixedSeconds(state, stamp.rawTick);
    state.pendingOffs = state.pendingOffs.filter((pending) => pending.tAudio > base);
    state.pendingOffs.push({ pitches: pitches.slice(), tAudio: offAt });
    return makeAction(state, 'noteOff', stampAt(state, offAt), { pitches: pitches.slice(), control });
  }

  /** A pitch that is pressed again is released first (retrigger); returns the pitches that were still sounding. */
  function takeOverPitches(state, pitches) {
    const taken = [];
    const keepOthers = (pitch) => {
      if (!pitches.includes(pitch)) return true;
      addUnique(taken, pitch);
      return false;
    };
    state.sounding.forEach((entry) => { entry.pitches = entry.pitches.filter(keepOthers); });
    state.deferred = state.deferred.filter(keepOthers);
    return taken;
  }

  function pressNote(state, control, pitches, event) {
    if (state.sounding.has(control)) return [];
    const stamp = stampAt(state, event.tAudio);
    const actions = [];
    const taken = takeOverPitches(state, pitches);
    if (taken.length > 0) actions.push(makeAction(state, 'noteOff', stamp, { pitches: taken, control }));
    const velocity = velocityOf(state, event);
    actions.push(makeAction(state, 'noteOn', stamp, { pitches: pitches.slice(), velocity, control }));
    const isFixed = state.noteLength === 'fixed';
    if (isFixed) actions.push(fixedOffAction(state, stamp, pitches, control));
    state.sounding.set(control, { pitches: pitches.slice(), tAudio: stamp.tAudio, autoOff: isFixed });
    actions.push(labelAction(state, stamp, pitches, control));
    return actions;
  }

  function releaseNote(state, control, event) {
    const entry = state.sounding.get(control);
    if (!entry) return [];
    state.sounding.delete(control);
    if (entry.autoOff || entry.pitches.length === 0) return [];
    if (state.sustain) {
      entry.pitches.forEach((pitch) => addUnique(state.deferred, pitch));
      return [];
    }
    return [makeAction(state, 'noteOff', stampAt(state, event.tAudio), { pitches: entry.pitches, control })];
  }

  function pressSustain(state, event) {
    state.sustain = true;
    const controller = { controller: SUSTAIN_CONTROLLER, value: CONTROLLER_ON, control: 'sustain' };
    return [makeAction(state, 'cc', stampAt(state, event.tAudio), controller)];
  }

  function releaseSustain(state, event) {
    if (!state.sustain) return [];
    state.sustain = false;
    const stamp = stampAt(state, event.tAudio);
    const actions = [makeAction(state, 'cc', stamp, { controller: SUSTAIN_CONTROLLER, value: 0, control: 'sustain' })];
    if (state.deferred.length > 0) {
      actions.push(makeAction(state, 'noteOff', stamp, { pitches: state.deferred, control: 'sustain' }));
    }
    state.deferred = [];
    return actions;
  }

  /** Pitches for a control: a lane of the active profile, or a MIDI key passed straight through; null otherwise. */
  function pitchesFor(state, control) {
    const lane = LANE_CONTROLS.indexOf(control);
    if (lane >= 0) return lanePitches(state, lane, true);
    const match = MIDI_CONTROL_PATTERN.exec(control);
    const key = match === null ? NaN : Number(match[1]);
    return key >= 0 && key <= MIDI_MAX ? [key] : null;
  }

  function onPress(state, event) {
    const control = event.control;
    if (control === 'octUp' || control === 'octDown') {
      return [shiftOctaveAction(state, control === 'octUp' ? 1 : -1, stampAt(state, event.tAudio), control)];
    }
    if (has(PROFILE_CONTROLS, control)) {
      return [setProfileOn(state, PROFILE_CONTROLS[control], stampAt(state, event.tAudio), control)];
    }
    if (control === 'sustain') return pressSustain(state, event);
    const pitches = pitchesFor(state, control);
    return pitches === null ? [] : pressNote(state, control, pitches, event);
  }

  function onRelease(state, event) {
    if (event.control === 'sustain') return releaseSustain(state, event);
    return releaseNote(state, event.control, event);
  }

  /** Note-offs for everything still sounding, deferred or scheduled, then cc 64 value 0 when sustain was on. */
  function releaseEverything(state, tAudio) {
    const stamp = stampAt(state, tAudio);
    const pitches = [];
    const addAll = (list) => list.forEach((pitch) => addUnique(pitches, pitch));
    state.sounding.forEach((entry) => { if (!entry.autoOff) addAll(entry.pitches); });   // their off is scheduled
    addAll(state.deferred);
    state.pendingOffs.forEach((pending) => {
      if (stamp.tAudio === null || pending.tAudio > stamp.tAudio) addAll(pending.pitches);
    });
    const actions = [];
    if (pitches.length > 0) actions.push(makeAction(state, 'noteOff', stamp, { pitches, control: 'panic' }));
    if (state.sustain) {
      actions.push(makeAction(state, 'cc', stamp, { controller: SUSTAIN_CONTROLLER, value: 0, control: 'panic' }));
    }
    state.sounding.clear();
    state.deferred = [];
    state.pendingOffs = [];
    state.sustain = false;
    state.chordWindow = { t0: null, pitches: [] };
    return actions;
  }

  // ---------------------------------------------------------------------------------------------
  // Validation of context values
  // ---------------------------------------------------------------------------------------------
  function checkSlot(slot) {
    const degree = requireInteger(slot && slot.degree, 1, 7, 'chord slot degree');
    if (!Theory.chord(slot.type)) throw codedError('E-GEN-006', 'unknown chord type: ' + String(slot.type));
    const inversion = slot.inversion === undefined ? 0 : requireInteger(slot.inversion, 0, 3, 'chord slot inversion');
    const voicing = slot.voicing === undefined ? 'close' : slot.voicing;
    if (!VOICINGS.includes(voicing)) throw codedError('E-GEN-005', 'unknown voicing: ' + String(voicing));
    return { degree, type: slot.type, inversion, voicing };
  }

  function checkChordSlots(slots) {
    if (slots === null) return null;
    if (!Array.isArray(slots) || slots.length !== LANE_COUNT) {
      throw codedError('E-GEN-005', 'chordSlots must hold exactly four slots');
    }
    return slots.map(checkSlot);
  }

  function checkIntervals(intervals) {
    if (intervals === null) return null;
    if (!Array.isArray(intervals) || intervals.length !== LANE_COUNT) {
      throw codedError('E-GEN-005', 'intervals must hold exactly four semitone counts');
    }
    return intervals.map((semitones) => requireInteger(semitones, 0, INTERVAL_LIMIT, 'interval'));
  }

  function newState(transport) {
    return {
      profile: 'A', key: { tonic: 0, mode: 'major' }, scaleId: null, octave: null, page: 0, register: 0,
      program: 0, isDrums: false, channel: 0, velocity: DEFAULT_VELOCITY, noteLength: 'hold',
      fixedDurTicks: DEFAULT_FIXED_TICKS, quantize: false, chordSlots: null, intervals: null, range: null,
      transport: transport || null, sounding: new Map(), sustain: false, deferred: [], pendingOffs: [],
      chordWindow: { t0: null, pitches: [] }, lastChordLabel: '', rangeWarned: [], recorded: [], disposed: false
    };
  }

  function setKeyOn(state, key) {
    state.key = checkKey(key);
  }

  function setScaleOn(state, scaleId) {
    if (scaleId !== null && !Theory.scale(scaleId)) throw codedError('E-GEN-006', 'unknown scale: ' + String(scaleId));
    state.scaleId = scaleId;
  }

  function setProgramOn(state, program, isDrums) {
    state.program = requireInteger(program, 0, MIDI_MAX, 'program');
    state.isDrums = isDrums === true;
  }

  function setRangeOn(state, range) {
    const checked = range === null ? null : toRange(range);
    if (range !== null && checked === null) throw codedError('E-GEN-005', 'range must be {low, high} within 0..127');
    state.range = checked;
  }

  function setNoteLengthOn(state, mode, durTicks) {
    if (!NOTE_LENGTH_MODES.includes(mode)) throw codedError('E-GEN-005', 'note length must be hold or fixed');
    state.noteLength = mode;
    if (durTicks !== undefined) state.fixedDurTicks = requireInteger(durTicks, 1, Number.MAX_SAFE_INTEGER, 'durTicks');
  }

  /** Applies the fields of a context object that are present; used by createLive and setContext. */
  function applyContext(state, context) {
    if (has(context, 'key')) setKeyOn(state, context.key);
    if (has(context, 'root')) setKeyOn(state, { tonic: context.root, mode: state.key.mode });
    if (has(context, 'scale')) setScaleOn(state, context.scale);
    if (has(context, 'program') || has(context, 'isDrums')) {
      setProgramOn(state, has(context, 'program') ? context.program : state.program,
        has(context, 'isDrums') ? context.isDrums : state.isDrums);
    }
    if (has(context, 'channel')) state.channel = requireInteger(context.channel, 0, 15, 'channel');
    if (has(context, 'range')) setRangeOn(state, context.range);
    if (has(context, 'profile')) setProfileOn(state, context.profile, stampAt(state, null), '');
    if (has(context, 'octave')) state.octave = requireInteger(context.octave, OCTAVE_MIN, OCTAVE_MAX, 'octave');
    if (has(context, 'register')) {
      state.register = requireInteger(context.register, -REGISTER_LIMIT, REGISTER_LIMIT, 'register');
    }
    if (has(context, 'velocity')) state.velocity = requireInteger(context.velocity, 1, MIDI_MAX, 'velocity');
    if (has(context, 'noteLength') || has(context, 'fixedDurTicks')) {
      setNoteLengthOn(state, has(context, 'noteLength') ? context.noteLength : state.noteLength, context.fixedDurTicks);
    }
    if (has(context, 'quantize')) state.quantize = context.quantize === true;
    if (has(context, 'chordSlots')) state.chordSlots = checkChordSlots(context.chordSlots);
    if (has(context, 'intervals')) state.intervals = checkIntervals(context.intervals);
  }

  // ---------------------------------------------------------------------------------------------
  // LiveMapper
  // ---------------------------------------------------------------------------------------------
  function heldPitches(state) {
    const held = [];
    state.sounding.forEach((entry) => entry.pitches.forEach((pitch) => addUnique(held, pitch)));
    return held.sort((a, b) => a - b);
  }

  function snapshot(state) {
    return {
      profile: state.profile, key: { tonic: state.key.tonic, mode: state.key.mode }, scaleId: scaleIdOf(state),
      scale: scaleIdOf(state), octave: effectiveOctave(state), page: state.page, register: state.register,
      program: state.program, isDrums: state.isDrums, channel: channelOf(state), velocity: state.velocity,
      noteLength: state.noteLength, fixedDurTicks: state.fixedDurTicks, quantize: state.quantize,
      chordSlots: currentChordSlots(state).map((slot) => Object.assign({}, slot)),
      intervals: currentIntervals(state).slice(), range: Object.assign({}, rangeOf(state)),
      held: heldPitches(state),
      sounding: Array.from(state.sounding, ([control, entry]) => ({ control, pitches: entry.pitches.slice() })),
      sustain: state.sustain, deferred: state.deferred.slice(), lastChordLabel: state.lastChordLabel,
      chordWindow: { t0: state.chordWindow.t0, pitches: state.chordWindow.pitches.slice() }
    };
  }

  function isHandleable(event) {
    return Boolean(event) && typeof event.control === 'string' && (event.type === 'press' || event.type === 'release');
  }

  function notify(listeners, action) {
    listeners.slice().forEach((listener) => {
      try {
        listener(action);
      } catch (error) {
        Core.ErrorReporter.report('E-GEN-001', error, { module: 'Mapping', phase: 'onAction' });
      }
    });
  }

  function record(state, action) {
    state.recorded.push(action);
    if (state.recorded.length > RECORDED_LIMIT) state.recorded.shift();
  }

  /** The mapper for Free Play, Studio recording and Instrument-mode lane hits (6.8.2). */
  function createLive(context) {
    const options = context || {};
    const state = newState(options.transport);
    const listeners = [];
    applyContext(state, options);

    function publish(actions) {
      actions.forEach((action) => {
        record(state, action);
        notify(listeners, action);
      });
      return actions;
    }

    function handle(event) {
      if (state.disposed || !isHandleable(event)) return [];
      return publish(event.type === 'press' ? onPress(state, event) : onRelease(state, event));
    }

    function releaseAll(tAudio) {
      return state.disposed ? [] : publish(releaseEverything(state, tAudio));
    }

    function setProfile(profile) {
      return publish([setProfileOn(state, profile, stampAt(state, null), '')])[0];
    }

    function shiftOctave(step) {
      requireInteger(step, -OCTAVE_SIZE, OCTAVE_SIZE, 'step');
      return publish([shiftOctaveAction(state, step, stampAt(state, null), '')])[0];
    }

    function onAction(callback) {
      if (typeof callback !== 'function') throw codedError('E-GEN-005', 'onAction needs a function');
      listeners.push(callback);
      return () => {
        const index = listeners.indexOf(callback);
        if (index >= 0) listeners.splice(index, 1);
      };
    }

    function dispose() {
      state.disposed = true;
      listeners.length = 0;
      state.sounding.clear();
      state.deferred = [];
      state.pendingOffs = [];
    }

    return Object.freeze({
      handle, onInput: handle, onAction, releaseAll, release: releaseAll, dispose,
      setProfile, shiftOctave,
      setContext: (changes) => applyContext(state, changes || {}),
      setKey: (key) => setKeyOn(state, key),
      setScale: (scaleId) => setScaleOn(state, scaleId),
      setOctave: (octave) => applyContext(state, { octave }),
      setRegister: (register) => applyContext(state, { register }),
      setProgram: (program, isDrums) => setProgramOn(state, program, isDrums),
      setRange: (range) => setRangeOn(state, range),
      setVelocity: (velocity) => applyContext(state, { velocity }),
      setNoteLength: (mode, durTicks) => setNoteLengthOn(state, mode, durTicks),
      setQuantize: (isOn) => applyContext(state, { quantize: isOn }),
      setChordSlots: (slots) => applyContext(state, { chordSlots: slots }),
      setIntervals: (intervals) => applyContext(state, { intervals }),
      state: () => snapshot(state),
      actions: () => state.recorded.slice()
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Dispatch to Instruments (the only audio call in this module) and the profile tables for Help
  // ---------------------------------------------------------------------------------------------
  function callInstruments(action, trackId, at) {
    const instruments = FLM.Instruments;
    const isDrums = action.channel === DRUM_CHANNEL;
    if (action.kind === 'noteOn' && typeof instruments.liveNoteOn === 'function') {
      action.pitches.forEach((pitch) => instruments.liveNoteOn(
        trackId, action.program, isDrums, action.channel, pitch, action.velocity, at));
    } else if (action.kind === 'noteOff' && typeof instruments.liveNoteOff === 'function') {
      action.pitches.forEach((pitch) => instruments.liveNoteOff(trackId, action.channel, pitch, at));
    } else if (action.kind === 'cc' && typeof instruments.controlLive === 'function') {
      instruments.controlLive(trackId, action.channel, 'cc', action.controller, action.value, at);
    }
  }

  /**
   * Plays one action at action.tAudio (or now + 5 ms when it is null). Guarded: until M-06 exists (T04.06) nothing
   * is called. A failing voice is reported once as recoverable and never stops the mapper's bookkeeping.
   * @returns {boolean} true when the call reached Instruments without an error
   */
  function dispatch(action, trackId) {
    if (!action || !FLM.Instruments) return false;
    const at = typeof action.tAudio === 'number' ? action.tAudio : nowSeconds() + DISPATCH_LEAD_SECONDS;
    try {
      callInstruments(action, trackId, at);
      return true;
    } catch (error) {
      Core.ErrorReporter.report('E-GEN-001', error, { module: 'Mapping', phase: 'dispatch', kind: action.kind });
      return false;
    }
  }

  const INSTRUMENT_LABELS = Object.freeze({
    bass: ['root', 'fifth', 'octave', 'degree 7'],
    guitar: ['power chord I', 'power chord IV', 'power chord V', 'root'],
    melodic: ['degree 1', 'degree 3', 'degree 5', 'degree 8'],
    effects: ['degree 1', 'degree 2', 'degree 3', 'degree 4']
  });

  function instrumentLabels(state) {
    const family = familyOf(state.program);
    if (family === BASS_FAMILY) return INSTRUMENT_LABELS.bass;
    if (family === GUITAR_FAMILY) return INSTRUMENT_LABELS.guitar;
    return EFFECT_FAMILIES.includes(family) ? INSTRUMENT_LABELS.effects : INSTRUMENT_LABELS.melodic;
  }

  function laneLabel(state, lane, pitches) {
    if (drumsActive(state)) return Theory.gmDrumName(pitches[0]);
    if (state.profile === 'A') return 'degree ' + (lane + 1);
    if (state.profile === 'B') return Theory.intervals()[currentIntervals(state)[lane]].name;
    if (state.profile === 'C') return labelFor(pitches);
    if (state.profile === 'D') return 'degree ' + (state.register + state.page * LANE_COUNT + lane + 1);
    return instrumentLabels(state)[lane];
  }

  /** What each of the four lane controls plays: [{control, action, pitches}] for Help and the pad labels. */
  function profileTable(profile, context) {
    const state = newState(context && context.transport);
    applyContext(state, Object.assign({}, context, { profile }));
    return LANE_INDEXES.map((lane) => {
      const pitches = lanePitches(state, lane, false);
      return { control: LANE_CONTROLS[lane], action: laneLabel(state, lane, pitches), pitches };
    });
  }

  /** The chart lane (0 kick, 1 snare family, 2 hats, 3 everything else) of a GM drum key. */
  function laneForPitch(pitch) {
    return has(DRUM_KEY_LANES, pitch) ? DRUM_KEY_LANES[pitch] : DRUM_OTHER_LANE;
  }

  return Object.freeze({
    PROFILES,
    PROFILE_TITLES,
    DRUM_LANES,
    QUANTIZE_GRID_TICKS,
    CHORD_WINDOW_SECONDS,
    createLive,
    dispatch,
    profileTable,
    diatonicTriad,
    laneForPitch
  });
});
})();
