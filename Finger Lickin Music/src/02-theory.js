// 02-theory.js - M-02 FLM.Theory: pitch classes, spelling, scales, chords, intervals, keys, GM names.
// Separation rule: this file owns exactly one namespace and registers it once through
// FLM.Core.define. It may use only lower-numbered modules (Part 4.2, R-DEP). It declares no
// module-level global state object (S-07): state lives inside the factory closure.
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Theory', function (FLM) {
  const TABLE_VERSION = 1;                  // Part 5.17 table version
  const MIDI_MAX = 127;
  const OCTAVE_SIZE = 12;
  const MAX_USER_SCALES = 64;               // Part 6.2.3
  const MAX_CHORD_PITCHES = 5;
  const NOTE_NAME_PATTERN = /^([A-Ga-g])(#{1,2}|b{1,2}|x)?(-?\d{1,2})$/;
  const LETTER_PITCH_CLASS = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
  const USER_PREFIX = 'user:';

  // Recursively freezes tables so no caller can mutate shared theory data (Part 6.2.9).
  function deepFreeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach((key) => deepFreeze(value[key]));
    return value;
  }

  function codedError(code, text) {
    const error = new Error(code + ': ' + text);
    error.code = code;
    return error;
  }

  function isIntegerIn(value, low, high) {
    return Number.isInteger(value) && value >= low && value <= high;
  }

  function requireInteger(value, low, high, label) {
    if (!isIntegerIn(value, low, high)) {
      throw codedError('E-GEN-005', label + ' must be an integer from ' + low + ' to ' + high);
    }
    return value;
  }

  function clampMidi(midi) {
    return Math.min(MIDI_MAX, Math.max(0, midi));
  }

  // ---------------------------------------------------------------------------------------------
  // Tables
  // ---------------------------------------------------------------------------------------------
  const PITCH_CLASS_SHARP = deepFreeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
  const PITCH_CLASS_FLAT = deepFreeze(['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']);
  const PITCH_CLASSES = deepFreeze(PITCH_CLASS_SHARP.map((sharp, pc) => ({ pc, sharp, flat: PITCH_CLASS_FLAT[pc] })));

  const SCALES = deepFreeze([
    { id: 'major', name: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11], userDefined: false },
    { id: 'naturalMinor', name: 'Natural minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10], userDefined: false },
    { id: 'harmonicMinor', name: 'Harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11], userDefined: false },
    { id: 'melodicMinor', name: 'Melodic minor', intervals: [0, 2, 3, 5, 7, 9, 11], userDefined: false },
    { id: 'majorPentatonic', name: 'Major pentatonic', intervals: [0, 2, 4, 7, 9], userDefined: false },
    { id: 'minorPentatonic', name: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10], userDefined: false },
    { id: 'blues', name: 'Blues', intervals: [0, 3, 5, 6, 7, 10], userDefined: false },
    { id: 'chromatic', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], userDefined: false },
    { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], userDefined: false },
    { id: 'phrygian', name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], userDefined: false },
    { id: 'lydian', name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], userDefined: false },
    { id: 'mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], userDefined: false },
    { id: 'locrian', name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], userDefined: false },
    { id: 'wholeTone', name: 'Whole tone', intervals: [0, 2, 4, 6, 8, 10], userDefined: false }
  ]);
  const SCALE_ALIASES = Object.freeze({ ionian: 'major', aeolian: 'naturalMinor' });

  const CHORDS = deepFreeze([
    { type: 'major', name: 'Major', symbol: '', intervals: [0, 4, 7] },
    { type: 'minor', name: 'Minor', symbol: 'm', intervals: [0, 3, 7] },
    { type: 'dim', name: 'Diminished', symbol: 'dim', intervals: [0, 3, 6] },
    { type: 'aug', name: 'Augmented', symbol: 'aug', intervals: [0, 4, 8] },
    { type: 'sus2', name: 'Suspended 2nd', symbol: 'sus2', intervals: [0, 2, 7] },
    { type: 'sus4', name: 'Suspended 4th', symbol: 'sus4', intervals: [0, 5, 7] },
    { type: 'maj7', name: 'Major 7th', symbol: 'maj7', intervals: [0, 4, 7, 11] },
    { type: 'min7', name: 'Minor 7th', symbol: 'm7', intervals: [0, 3, 7, 10] },
    { type: 'dom7', name: 'Dominant 7th', symbol: '7', intervals: [0, 4, 7, 10] },
    { type: 'dim7', name: 'Diminished 7th', symbol: 'dim7', intervals: [0, 3, 6, 9] },
    { type: 'halfDim7', name: 'Half-diminished 7th', symbol: 'm7b5', intervals: [0, 3, 6, 10] },
    { type: 'minMaj7', name: 'Minor-major 7th', symbol: 'mMaj7', intervals: [0, 3, 7, 11] },
    { type: 'add9', name: 'Add 9', symbol: 'add9', intervals: [0, 4, 7, 14] },
    { type: 'six', name: 'Major 6th', symbol: '6', intervals: [0, 4, 7, 9] },
    { type: 'min6', name: 'Minor 6th', symbol: 'm6', intervals: [0, 3, 7, 9] },
    { type: 'nine', name: 'Dominant 9th', symbol: '9', intervals: [0, 4, 7, 10, 14] },
    { type: 'maj9', name: 'Major 9th', symbol: 'maj9', intervals: [0, 4, 7, 11, 14] },
    { type: 'min9', name: 'Minor 9th', symbol: 'm9', intervals: [0, 3, 7, 10, 14] }
  ]);

  // P1 to P15 (0 to 24 semitones); semitone 6 is named A4 with d5 accepted as an alias.
  const INTERVAL_IDS = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8', 'm9', 'M9',
    'm10', 'M10', 'P11', 'A11', 'P12', 'm13', 'M13', 'm14', 'M14', 'P15'];
  const INTERVAL_NAMES = ['Perfect unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th',
    'Augmented 4th', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Perfect octave',
    'Minor 9th', 'Major 9th', 'Minor 10th', 'Major 10th', 'Perfect 11th', 'Augmented 11th', 'Perfect 12th',
    'Minor 13th', 'Major 13th', 'Minor 14th', 'Major 14th', 'Perfect 15th'];
  const INTERVALS = deepFreeze(INTERVAL_IDS.map((id, semitones) => (
    { id, name: INTERVAL_NAMES[semitones], semitones })));
  const INTERVAL_ALIASES = Object.freeze({ d5: 6 });

  // Key signatures by fifths -7..7 (index = fifths + 7): major tonic and minor tonic names.
  const KEY_FIFTHS_MIN = -7;
  const KEY_FIFTHS_MAX = 7;
  const MAJOR_TONICS = deepFreeze(['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']);
  const MINOR_TONICS = deepFreeze(['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#']);
  const MAJOR_TONIC_PCS = deepFreeze([11, 6, 1, 8, 3, 10, 5, 0, 7, 2, 9, 4, 11, 6, 1]);
  const MINOR_TONIC_PCS = deepFreeze(MAJOR_TONIC_PCS.map((pc) => (pc + 9) % OCTAVE_SIZE));

  const GM_FAMILIES = deepFreeze(['Piano', 'Chromatic Percussion', 'Organ', 'Guitar', 'Bass', 'Strings', 'Ensemble',
    'Brass', 'Reed', 'Pipe', 'Synth Lead', 'Synth Pad', 'Synth Effects', 'Ethnic', 'Percussive', 'Sound Effects']);
  const PROGRAMS_PER_FAMILY = 8;

  const GM_PROGRAMS = deepFreeze([
    'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
    'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
    'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
    'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica',
    'Tango Accordion',
    'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
    'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
    'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1',
    'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
    'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
    'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2', 'Choir Aahs', 'Voice Oohs',
    'Synth Voice', 'Orchestra Hit',
    'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'Synth Brass 1',
    'Synth Brass 2',
    'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
    'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
    'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)', 'Lead 5 (charang)',
    'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
    'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)', 'Pad 5 (bowed)', 'Pad 6 (metallic)',
    'Pad 7 (halo)', 'Pad 8 (sweep)',
    'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)', 'FX 5 (brightness)',
    'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
    'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bag pipe', 'Fiddle', 'Shanai',
    'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum',
    'Reverse Cymbal',
    'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause',
    'Gunshot'
  ]);

  const GM_DRUM_FIRST_KEY = 35;
  const GM_DRUM_NAME_LIST = ['Acoustic Bass Drum', 'Bass Drum 1', 'Side Stick', 'Acoustic Snare', 'Hand Clap',
    'Electric Snare', 'Low Floor Tom', 'Closed Hi-Hat', 'High Floor Tom', 'Pedal Hi-Hat', 'Low Tom',
    'Open Hi-Hat', 'Low-Mid Tom', 'Hi-Mid Tom', 'Crash Cymbal 1', 'High Tom', 'Ride Cymbal 1', 'Chinese Cymbal',
    'Ride Bell', 'Tambourine', 'Splash Cymbal', 'Cowbell', 'Crash Cymbal 2', 'Vibraslap', 'Ride Cymbal 2',
    'Hi Bongo', 'Low Bongo', 'Mute Hi Conga', 'Open Hi Conga', 'Low Conga', 'High Timbale', 'Low Timbale',
    'High Agogo', 'Low Agogo', 'Cabasa', 'Maracas', 'Short Whistle', 'Long Whistle', 'Short Guiro', 'Long Guiro',
    'Claves', 'Hi Wood Block', 'Low Wood Block', 'Mute Cuica', 'Open Cuica', 'Mute Triangle', 'Open Triangle'];
  const GM_DRUMS = deepFreeze(Object.fromEntries(
    GM_DRUM_NAME_LIST.map((name, offset) => [GM_DRUM_FIRST_KEY + offset, name])));
  const GM_DRUM_LAST_KEY = GM_DRUM_FIRST_KEY + GM_DRUM_NAME_LIST.length - 1;

  // User-defined scales registered at runtime (persisted by M-16, re-registered at boot).
  const userScales = new Map();

  // ---------------------------------------------------------------------------------------------
  // Pitch names
  // ---------------------------------------------------------------------------------------------
  function fifthsOf(key) {
    if (typeof key === 'number') return key;
    return key && typeof key.fifths === 'number' ? key.fifths : 0;
  }

  /** Middle C = 60 = 'C4'. fifths < 0 spells with flats, otherwise sharps. */
  function noteName(midi, key) {
    requireInteger(midi, 0, MIDI_MAX, 'midi');
    const names = fifthsOf(key) < 0 ? PITCH_CLASS_FLAT : PITCH_CLASS_SHARP;
    return names[midi % OCTAVE_SIZE] + (Math.floor(midi / OCTAVE_SIZE) - 1);
  }

  const ACCIDENTAL_OFFSET = Object.freeze({ '#': 1, '##': 2, x: 2, b: -1, bb: -2 });

  /** Parses 'C4', 'c#4', 'Db-1', 'E##3'. Throws E-GEN-005 for any other text or a result outside 0..127. */
  function midiFromName(name) {
    const match = typeof name === 'string' ? NOTE_NAME_PATTERN.exec(name) : null;
    if (match === null) throw codedError('E-GEN-005', 'not a note name: ' + String(name));
    const accidental = match[2] === undefined ? 0 : ACCIDENTAL_OFFSET[match[2]];
    const midi = LETTER_PITCH_CLASS[match[1].toUpperCase()] + accidental + OCTAVE_SIZE * (Number(match[3]) + 1);
    if (midi < 0 || midi > MIDI_MAX) throw codedError('E-GEN-005', 'note out of range: ' + name);
    return midi;
  }

  function pitchClass(midi) {
    return ((midi % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE;
  }

  function octaveOf(midi) {
    return Math.floor(midi / OCTAVE_SIZE) - 1;
  }

  /** Enharmonic spelling of a pitch from its key context (KeyMap entry fifths). */
  function spell(midi, key) {
    return noteName(midi, key);
  }

  /** Moves a pitch, or every pitch of an array, by semitones; results are clamped to 0..127. */
  function transpose(pitches, semitones) {
    requireInteger(semitones, -MIDI_MAX, MIDI_MAX, 'semitones');
    if (Array.isArray(pitches)) return pitches.map((pitch) => clampMidi(pitch + semitones));
    return clampMidi(requireInteger(pitches, 0, MIDI_MAX, 'midi') + semitones);
  }

  // ---------------------------------------------------------------------------------------------
  // Scales
  // ---------------------------------------------------------------------------------------------
  function aliasTarget(id) {
    return Object.prototype.hasOwnProperty.call(SCALE_ALIASES, id) ? SCALE_ALIASES[id] : undefined;
  }

  function scales() {
    return SCALES.concat(Array.from(userScales.values()));
  }

  function scale(id) {
    if (typeof id !== 'string') return undefined;
    const builtInId = aliasTarget(id) || id;
    const builtIn = SCALES.find((def) => def.id === builtInId);
    if (builtIn) return builtIn;
    return userScales.get(id.startsWith(USER_PREFIX) ? id : USER_PREFIX + id);
  }

  function isValidScaleIntervals(intervals) {
    if (!Array.isArray(intervals) || intervals.length < 1 || intervals.length > OCTAVE_SIZE) return false;
    if (intervals[0] !== 0) return false;
    return intervals.every((value, index) => isIntegerIn(value, 0, OCTAVE_SIZE - 1) &&
      (index === 0 || value > intervals[index - 1]));
  }

  /** Registers a user scale; intervals ascending, unique, 0..11, start at 0, length 1..12. */
  function defineScale(id, name, intervals) {
    const bareId = typeof id === 'string' && id.startsWith(USER_PREFIX) ? id.slice(USER_PREFIX.length) : id;
    if (typeof bareId !== 'string' || !/^[A-Za-z0-9_.-]{1,40}$/.test(bareId)) {
      throw codedError('E-GEN-006', 'scale id must be 1-40 letters, digits, dot, dash or underscore');
    }
    if (SCALES.some((def) => def.id === bareId) || aliasTarget(bareId)) {
      throw codedError('E-GEN-006', 'built-in scale ids cannot be replaced: ' + bareId);
    }
    if (!isValidScaleIntervals(intervals)) {
      throw codedError('E-GEN-006', 'Scale must list 1-12 ascending semitones starting at 0');
    }
    const fullId = USER_PREFIX + bareId;
    if (!userScales.has(fullId) && userScales.size >= MAX_USER_SCALES) {
      throw codedError('E-GEN-006', 'at most ' + MAX_USER_SCALES + ' user scales');
    }
    const label = typeof name === 'string' && name.trim() !== '' ? name.trim() : bareId;
    const def = deepFreeze({ id: fullId, name: label, intervals: intervals.slice(), userDefined: true });
    userScales.set(fullId, def);
    return def;
  }

  function requireScale(scaleId) {
    const def = scale(scaleId);
    if (!def) throw codedError('E-GEN-006', 'unknown scale: ' + String(scaleId));
    return def;
  }

  /** count notes ascending from root in octave; truncated at the top of the MIDI range. */
  function scaleDegrees(root, scaleId, octave, count) {
    requireInteger(root, 0, OCTAVE_SIZE - 1, 'root');
    requireInteger(octave, -1, 9, 'octave');
    requireInteger(count, 1, MIDI_MAX + 1, 'count');
    const def = requireScale(scaleId);
    const length = def.intervals.length;
    const base = root + OCTAVE_SIZE * (octave + 1);
    const result = [];
    for (let index = 0; index < count; index += 1) {
      const midi = base + OCTAVE_SIZE * Math.floor(index / length) + def.intervals[index % length];
      if (midi > MIDI_MAX) break;
      result.push(midi);
    }
    return result;
  }

  /** Degree is 0-based and may be negative or beyond the scale length (octave wrap). */
  function scaleNote(root, scaleId, octave, degree) {
    requireInteger(root, 0, OCTAVE_SIZE - 1, 'root');
    requireInteger(octave, -1, 9, 'octave');
    requireInteger(degree, -100000, 100000, 'degree');
    const def = requireScale(scaleId);
    const length = def.intervals.length;
    const base = root + OCTAVE_SIZE * (octave + 1);
    const step = def.intervals[((degree % length) + length) % length];
    return clampMidi(base + OCTAVE_SIZE * Math.floor(degree / length) + step);
  }

  /** Nearest scale member to midi; ties go to the lower pitch. */
  function snapToScale(midi, root, scaleId) {
    const def = requireScale(scaleId);
    const relative = pitchClass(midi - root);
    let best = null;
    def.intervals.forEach((interval) => {
      [interval - OCTAVE_SIZE, interval, interval + OCTAVE_SIZE].forEach((candidate) => {
        const distance = Math.abs(candidate - relative);
        const isBetter = best === null || distance < best.distance ||
          (distance === best.distance && candidate < best.candidate);
        if (isBetter) best = { candidate, distance };
      });
    });
    return clampMidi(midi + (best.candidate - relative));
  }

  function inScale(midi, root, scaleId) {
    return requireScale(scaleId).intervals.includes(pitchClass(midi - root));
  }

  // ---------------------------------------------------------------------------------------------
  // Chords
  // ---------------------------------------------------------------------------------------------
  function chords() {
    return CHORDS;
  }

  function chord(type) {
    return CHORDS.find((def) => def.type === type);
  }

  /** Rotates the lowest note up an octave, `times` times (ascending input, ascending output). */
  function invert(notes, times) {
    const count = Math.min(Math.max(0, times | 0), notes.length - 1);
    const rotated = notes.slice();
    for (let step = 0; step < count; step += 1) rotated.push(rotated.shift() + OCTAVE_SIZE);
    return rotated;
  }

  function applyVoicing(notes, voicing) {
    if (voicing === 'open' && notes.length >= 3) {
      const opened = notes.slice();
      opened[opened.length - 2] -= OCTAVE_SIZE;
      return opened.sort((a, b) => a - b);
    }
    if (voicing === 'spread') return [notes[0] - OCTAVE_SIZE].concat(notes);
    return notes;
  }

  /** inversion 0..(size-1); voicing 'close' (default), 'open' or 'spread'; ascending, clamped to 0..127. */
  function chordNotes(root, type, inversion, octave, voicing) {
    requireInteger(root, 0, OCTAVE_SIZE - 1, 'root');
    const def = chord(type);
    if (!def) throw codedError('E-GEN-006', 'unknown chord: ' + String(type));
    const base = root + OCTAVE_SIZE * ((octave === undefined ? 4 : octave) + 1);
    const closed = invert(def.intervals.map((interval) => base + interval), inversion === undefined ? 0 : inversion);
    return applyVoicing(closed, voicing).map(clampMidi).sort((a, b) => a - b);
  }

  function chordPitchClasses(root, def) {
    return Array.from(new Set(def.intervals.map((interval) => (root + interval) % OCTAVE_SIZE)));
  }

  function sameSet(left, right) {
    return left.length === right.length && left.every((value) => right.includes(value));
  }

  /** Finds the chord whose pitch classes equal the set; returns null when none matches. */
  function recognizeChord(pitchSet) {
    if (!Array.isArray(pitchSet) || pitchSet.length === 0) return null;
    const pitchClasses = Array.from(new Set(pitchSet.map(pitchClass))).sort((a, b) => a - b);
    if (pitchClasses.length < 2 || pitchClasses.length > MAX_CHORD_PITCHES) return null;
    const bass = Math.min.apply(null, pitchSet);
    const bassClass = pitchClass(bass);
    const matches = [];
    pitchClasses.forEach((root) => {
      CHORDS.forEach((def, order) => {
        if (sameSet(chordPitchClasses(root, def), pitchClasses)) {
          matches.push({ root, def, order, rootIsBass: root === bassClass });
        }
      });
    });
    if (matches.length === 0) return null;
    // Smallest chord, then table order, then root equal to the bass, then lowest root.
    matches.sort((a, b) => (a.def.intervals.length - b.def.intervals.length) || (a.order - b.order) ||
      (Number(b.rootIsBass) - Number(a.rootIsBass)) || (a.root - b.root));
    const best = matches[0];
    const inversion = best.def.intervals.map((interval) => (best.root + interval) % OCTAVE_SIZE).indexOf(bassClass);
    return { root: best.root, type: best.def.type, inversion, bass, exact: true };
  }

  // ---------------------------------------------------------------------------------------------
  // Intervals
  // ---------------------------------------------------------------------------------------------
  function intervals() {
    return INTERVALS;
  }

  function intervalName(semitones) {
    requireInteger(semitones, 0, INTERVALS.length - 1, 'semitones');
    return INTERVALS[semitones].id;
  }

  function intervalSemitones(id) {
    const found = INTERVALS.find((interval) => interval.id === id);
    if (found) return found.semitones;
    if (Object.prototype.hasOwnProperty.call(INTERVAL_ALIASES, id)) return INTERVAL_ALIASES[id];
    throw codedError('E-GEN-005', 'unknown interval: ' + String(id));
  }

  // ---------------------------------------------------------------------------------------------
  // Keys
  // ---------------------------------------------------------------------------------------------
  function keyTonic(fifths, mode) {
    requireInteger(fifths, KEY_FIFTHS_MIN, KEY_FIFTHS_MAX, 'fifths');
    const index = fifths - KEY_FIFTHS_MIN;
    if (mode === 'minor') return { pc: MINOR_TONIC_PCS[index], name: MINOR_TONICS[index] };
    return { pc: MAJOR_TONIC_PCS[index], name: MAJOR_TONICS[index] };
  }

  /** Inverse of keyTonic: the fewest accidentals, flats on a tie (Gb, Eb minor, Db, Bb minor, Ab, F minor). */
  function keyFifths(tonicPc, mode) {
    requireInteger(tonicPc, 0, OCTAVE_SIZE - 1, 'tonicPc');
    const pcs = mode === 'minor' ? MINOR_TONIC_PCS : MAJOR_TONIC_PCS;
    let best = null;
    pcs.forEach((pc, index) => {
      const fifths = index + KEY_FIFTHS_MIN;
      if (pc !== tonicPc) return;
      const isBetter = best === null || Math.abs(fifths) < Math.abs(best) ||
        (Math.abs(fifths) === Math.abs(best) && fifths < best);
      if (isBetter) best = fifths;
    });
    return best;
  }

  function keyName(fifths, mode) {
    return keyTonic(fifths, mode).name + ' ' + (mode === 'minor' ? 'minor' : 'major');
  }

  // ---------------------------------------------------------------------------------------------
  // General MIDI names
  // ---------------------------------------------------------------------------------------------
  function gmProgramName(program) {
    return isIntegerIn(program, 0, MIDI_MAX) ? GM_PROGRAMS[program] : 'Program ' + program;
  }

  function gmFamily(program) {
    const clamped = Math.min(MIDI_MAX, Math.max(0, Math.floor(Number(program)) || 0));
    const index = Math.floor(clamped / PROGRAMS_PER_FAMILY);
    return { index, name: GM_FAMILIES[index] };
  }

  function gmFamilies() {
    return GM_FAMILIES;
  }

  function gmDrumName(key) {
    return isIntegerIn(key, GM_DRUM_FIRST_KEY, GM_DRUM_LAST_KEY) ? GM_DRUMS[key] : 'Percussion ' + key;
  }

  return Object.freeze({
    VERSION: TABLE_VERSION,
    PITCH_CLASS_SHARP,
    PITCH_CLASS_FLAT,
    PITCH_CLASSES,
    SCALES,
    CHORDS,
    INTERVALS,
    GM_PROGRAMS,
    GM_DRUMS,
    GM_FAMILIES,
    noteName,
    midiFromName,
    pitchClass,
    octaveOf,
    spell,
    transpose,
    scales,
    scale,
    defineScale,
    scaleDegrees,
    scaleNote,
    snapToScale,
    inScale,
    chords,
    chord,
    chordNotes,
    invert,
    recognizeChord,
    intervals,
    intervalName,
    intervalSemitones,
    keyTonic,
    tonicOf: keyTonic,
    keyFromFifths: keyTonic,
    keyFifths,
    fifthsFromKey: keyFifths,
    keyName,
    gmProgramName,
    gmFamily,
    familyOf: gmFamily,
    gmFamilies,
    gmDrumName
  });
});
})();
