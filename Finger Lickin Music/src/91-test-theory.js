// 91-test-theory.js - unit tests for M-02 FLM.Theory (group 'theory'; test build only).
// UT-02-01 to UT-02-22 follow Part 6.2.8; UT-02-23 and UT-02-24 are extra checks for T02.01.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('theory', (t) => {
  const Theory = FLM.Theory;
  const MIDI_COUNT = 128;
  const KEY_FLATS = -3;                    // E-flat major, used for the round-trip test
  const BUILT_IN_SCALE_COUNT = 14;
  const CHORD_COUNT = 18;

  // The user-scale registry is private and cannot be reset, so a test that registers a scale uses a unique id.

  t.test('UT-02-01 noteName sharps', () => {
    t.deepEq([60, 61, 71, 0, 127].map((midi) => Theory.noteName(midi)), ['C4', 'C#4', 'B4', 'C-1', 'G9']);
  });

  t.test('UT-02-02 noteName flats by key', () => {
    t.eq(Theory.noteName(61, -2), 'Db4');
    t.eq(Theory.noteName(61, { fifths: -1 }), 'Db4');
  });

  t.test('UT-02-03 midiFromName parse', () => {
    t.deepEq(['C4', 'c#4', 'Db-1', 'E##3', 'Fb5'].map(Theory.midiFromName), [60, 61, 1, 54, 76]);
    // Part 6.2.8 lists 64 for 'Fb5', which contradicts its own formula (4 + 12 * 6 = 76); 64 is 'Fb4'.
    t.eq(Theory.midiFromName('Fb4'), 64);
    t.throws(() => Theory.midiFromName('H4'), 'E-GEN-005');
    t.throws(() => Theory.midiFromName('C10'), 'E-GEN-005');
  });

  t.test('UT-02-04 round trip names', () => {
    [0, KEY_FLATS].forEach((fifths) => {
      for (let midi = 0; midi < MIDI_COUNT; midi += 1) {
        t.eq(Theory.midiFromName(Theory.noteName(midi, fifths)), midi);
      }
    });
  });

  t.test('UT-02-05 scale table integrity', () => {
    const builtIn = Theory.scales().filter((def) => !def.userDefined);
    t.eq(builtIn.length, BUILT_IN_SCALE_COUNT);
    builtIn.forEach((def) => {
      t.eq(def.intervals[0], 0, def.id);
      def.intervals.forEach((interval, index) => {
        t.within(interval, 0, 11, def.id);
        if (index > 0) t.ok(interval > def.intervals[index - 1], def.id + ' ascending and unique');
      });
    });
    t.eq(Theory.scale('major').intervals.length, 7);
  });

  t.test('UT-02-06 defineScale validation', () => {
    t.throws(() => Theory.defineScale('bad1', 'Bad', [0, 2, 2]), 'E-GEN-006');
    t.throws(() => Theory.defineScale('bad2', 'Bad', [1, 3]), 'E-GEN-006');
    t.throws(() => Theory.defineScale('bad3', 'Bad', []), 'E-GEN-006');
    t.throws(() => Theory.defineScale('bad4', 'Bad', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'E-GEN-006');
    t.throws(() => Theory.defineScale('major', 'Bad', [0, 3, 7]), 'E-GEN-006');
    const def = Theory.defineScale('ut0206', 'Triad scale', [0, 3, 7]);
    t.deepEq(def.intervals, [0, 3, 7]);
    t.eq(def.userDefined, true);
    t.ok(Theory.scales().includes(def));
    t.eq(Theory.scale('ut0206'), def);
  });

  t.test('UT-02-07 unknown ids', () => {
    t.eq(Theory.scale('nope'), undefined);
    t.eq(Theory.chord('nope'), undefined);
    t.throws(() => Theory.scaleDegrees(0, 'nope', 4, 8), 'E-GEN-006');
  });

  t.test('UT-02-08 scaleDegrees C major', () => {
    t.deepEq(Theory.scaleDegrees(0, 'major', 4, 8), [60, 62, 64, 65, 67, 69, 71, 72]);
  });

  t.test('UT-02-09 scaleDegrees truncates at 127', () => {
    t.deepEq(Theory.scaleDegrees(0, 'major', 9, 8), [120, 122, 124, 125, 127]);
  });

  t.test('UT-02-10 scaleNote negative degree', () => {
    t.eq(Theory.scaleNote(0, 'major', 4, -1), 59);
  });

  t.test('UT-02-11 snapToScale', () => {
    t.eq(Theory.snapToScale(61, 0, 'major'), 60);
    t.eq(Theory.snapToScale(66, 0, 'major'), 65);
    t.eq(Theory.snapToScale(63, 0, 'minorPentatonic'), 63);
  });

  t.test('UT-02-12 chordNotes close', () => {
    t.deepEq(Theory.chordNotes(0, 'major', 0, 4), [60, 64, 67]);
    t.deepEq(Theory.chordNotes(0, 'major', 1, 4), [64, 67, 72]);
    t.deepEq(Theory.chordNotes(0, 'major', 2, 4), [67, 72, 76]);
  });

  t.test('UT-02-13 chordNotes voicings', () => {
    t.deepEq(Theory.chordNotes(0, 'maj7', 0, 4, 'open'), [55, 60, 64, 71]);
    t.deepEq(Theory.chordNotes(0, 'maj7', 0, 4, 'spread'), [48, 60, 64, 67, 71]);
  });

  t.test('UT-02-14 chord table integrity', () => {
    const table = Theory.chords();
    t.eq(table.length, CHORD_COUNT);
    table.forEach((def) => {
      t.eq(def.intervals[0], 0, def.type);
      t.within(def.intervals.length, 3, 5, def.type);
      def.intervals.forEach((interval, index) => {
        if (index > 0) t.ok(interval > def.intervals[index - 1], def.type + ' ascending');
      });
    });
  });

  t.test('UT-02-15 key tables', () => {
    const majorNames = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
    const minorNames = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];
    for (let fifths = -7; fifths <= 7; fifths += 1) {
      const major = Theory.keyTonic(fifths, 'major');
      const minor = Theory.keyTonic(fifths, 'minor');
      t.eq(major.name, majorNames[fifths + 7]);
      t.eq(minor.name, minorNames[fifths + 7]);
      t.eq(minor.pc, (major.pc + 9) % 12);
      if (Math.abs(fifths) <= 5) {
        t.eq(Theory.keyFifths(major.pc, 'major'), fifths);
        t.eq(Theory.keyFifths(minor.pc, 'minor'), fifths);
      }
    }
    t.eq(Theory.keyFifths(6, 'major'), -6);
    t.eq(Theory.keyFifths(3, 'minor'), -6);
    t.eq(Theory.keyFifths(1, 'major'), -5);
    t.eq(Theory.keyFifths(10, 'minor'), -5);
    t.eq(Theory.keyFifths(8, 'major'), -4);
    t.eq(Theory.keyFifths(5, 'minor'), -4);
    t.eq(Theory.keyName(1, 'major'), 'G major');
    t.eq(Theory.keyName(1, 'minor'), 'E minor');
  });

  t.test('UT-02-16 recognizeChord basics', () => {
    t.deepEq(Theory.recognizeChord([60, 64, 67]), { root: 0, type: 'major', inversion: 0, bass: 60, exact: true });
    t.deepEq(Theory.recognizeChord([64, 67, 72]), { root: 0, type: 'major', inversion: 1, bass: 64, exact: true });
    t.deepEq(Theory.recognizeChord([60, 63, 67, 70]), { root: 0, type: 'min7', inversion: 0, bass: 60, exact: true });
    t.eq(Theory.recognizeChord([60, 64]), null);
  });

  t.test('UT-02-17 recognizeChord tie rules', () => {
    const found = Theory.recognizeChord([60, 63, 66, 69]);
    t.eq(found.root, 0);
    t.eq(found.type, 'dim7');
    t.eq(found.inversion, 0);
  });

  t.test('UT-02-18 intervals', () => {
    t.eq(Theory.intervalName(7), 'P5');
    t.eq(Theory.intervalName(6), 'A4');
    t.eq(Theory.intervalSemitones('m3'), 3);
    t.eq(Theory.intervalSemitones('d5'), 6);
    t.eq(Theory.intervals().length, 25);
  });

  t.test('UT-02-19 GM names', () => {
    t.eq(Theory.gmProgramName(0), 'Acoustic Grand Piano');
    t.eq(Theory.gmProgramName(24), 'Acoustic Guitar (nylon)');
    t.eq(Theory.gmProgramName(127), 'Gunshot');
    t.eq(Theory.gmProgramName(128), 'Program 128');
    t.eq(Theory.gmFamily(40).name, 'Strings');
    t.eq(Theory.gmFamilies().length, 16);
  });

  t.test('UT-02-20 GM drum names', () => {
    t.deepEq([35, 42, 81, 34, 82].map(Theory.gmDrumName),
      ['Acoustic Bass Drum', 'Closed Hi-Hat', 'Open Triangle', 'Percussion 34', 'Percussion 82']);
  });

  t.test('UT-02-21 all 128 program names unique and present', () => {
    const names = new Set();
    for (let program = 0; program < MIDI_COUNT; program += 1) {
      const name = Theory.gmProgramName(program);
      t.ok(typeof name === 'string' && name !== '' && !name.startsWith('Program '), 'program ' + program);
      names.add(name);
    }
    t.eq(names.size, MIDI_COUNT);
    t.eq(Theory.GM_PROGRAMS.length, MIDI_COUNT);
  });

  t.test('UT-02-22 aliases', () => {
    t.eq(Theory.scale('ionian'), Theory.scale('major'));
    t.eq(Theory.scale('aeolian'), Theory.scale('naturalMinor'));
  });

  t.test('UT-02-23 tables are deep-frozen and the T02.01 names exist', () => {
    t.ok(Object.isFrozen(Theory));
    t.ok(Object.isFrozen(Theory.SCALES) && Object.isFrozen(Theory.SCALES[0].intervals));
    t.ok(Object.isFrozen(Theory.CHORDS) && Object.isFrozen(Theory.CHORDS[0].intervals));
    t.ok(Object.isFrozen(Theory.INTERVALS) && Object.isFrozen(Theory.GM_PROGRAMS) && Object.isFrozen(Theory.GM_DRUMS));
    t.eq(Theory.PITCH_CLASSES.length, 12);
    t.eq(Theory.GM_FAMILIES.length, 16);
    t.eq(Object.keys(Theory.GM_DRUMS).length, 47);
    t.eq(Theory.familyOf(0).name, 'Piano');
    t.deepEq(Theory.keyFromFifths(-2, 'major'), { pc: 10, name: 'Bb' });
    t.eq(Theory.fifthsFromKey(10, 'major'), -2);
  });

  t.test('UT-02-24 spell, invert and transpose', () => {
    t.eq(Theory.spell(70, -2), 'Bb4');
    t.eq(Theory.spell(70, 2), 'A#4');
    t.deepEq(Theory.invert([60, 64, 67], 2), [67, 72, 76]);
    t.deepEq(Theory.invert([60, 64, 67], 9), [67, 72, 76]);
    t.deepEq(Theory.transpose([60, 127], 5), [65, 127]);
    t.eq(Theory.transpose(60, -12), 48);
    t.eq(Theory.inScale(62, 0, 'major'), true);
    t.eq(Theory.inScale(61, 0, 'major'), false);
  });
});
})();
