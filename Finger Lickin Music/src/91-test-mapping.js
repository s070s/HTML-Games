// 91-test-mapping.js - unit tests for M-08 FLM.Mapping (group 'mapping'; test build only).
// T03.05: UT-08-01 to UT-08-09, UT-08-11, UT-08-13, UT-08-15, UT-08-16, UT-08-19 (the profile rows).
// T03.06: UT-08-10, UT-08-12, UT-08-14, UT-08-17, UT-08-18 plus the retrigger, label-window, range and octave rules.
// UT-08-20 to UT-08-34 (ChartGenerator) belong to Phase 08; IT-005 needs M-09 and waits for T03.07 and Phase 08.
// Every test uses a private fake Transport (120 BPM, 960 ticks per quarter) and a recording fake Instruments.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('mapping', (t) => {
  const Core = FLM.Core;
  const Mapping = FLM.Mapping;
  const TICKS_PER_SECOND = 1920;           // 120 BPM at 960 ticks per quarter
  const C_MAJOR = { tonic: 0, mode: 'major' };
  const A_MINOR = { tonic: 9, mode: 'minor' };
  const MS = 0.001;

  let restores = [];
  let instrumentCalls = [];

  // ------------------------------------------------------------------------------------------ helpers
  function fakeTransport(stateName) {
    return {
      state: () => stateName || 'playing',
      tickAt: (seconds) => seconds * TICKS_PER_SECOND,
      tempoMap: () => ({ ticksToSeconds: (tick) => tick / TICKS_PER_SECOND }),
      speed: () => 1
    };
  }

  function standIn(name, value) {
    const had = Object.prototype.hasOwnProperty.call(FLM, name);
    const original = FLM[name];
    FLM[name] = value;
    restores.push(() => {
      if (had) FLM[name] = original;
      else delete FLM[name];
    });
  }

  function recordingInstruments(failing) {
    instrumentCalls = [];
    const record = (name) => (...args) => {
      if (failing === name) throw new Error('voice allocation failed');
      instrumentCalls.push({ name, args });
    };
    standIn('Instruments', { liveNoteOn: record('liveNoteOn'), liveNoteOff: record('liveNoteOff'),
      controlLive: record('controlLive') });
  }

  function live(context) {
    return Mapping.createLive(Object.assign({ key: C_MAJOR, transport: fakeTransport() }, context));
  }

  function inputEvent(control, type, tAudio, extra) {
    return Object.assign({ source: 'keyboard', control, type, tPerf: tAudio * 1000, tAudio,
      pressure: type === 'press' ? 1 : 0 }, extra);
  }

  const press = (mapper, control, tAudio, extra) => mapper.handle(inputEvent(control, 'press', tAudio, extra));
  const release = (mapper, control, tAudio, extra) => mapper.handle(inputEvent(control, 'release', tAudio, extra));
  const ofKind = (actions, kind) => actions.filter((action) => action.kind === kind);
  const onPitches = (actions) => ofKind(actions, 'noteOn').map((action) => action.pitches);
  const lastLabel = (actions) => ofKind(actions, 'label').pop().label;

  /** Presses and releases one control and returns the pitches of its note-on. */
  function played(mapper, control, tAudio) {
    const pitches = onPitches(press(mapper, control, tAudio))[0];
    release(mapper, control, tAudio + 0.1);
    return pitches;
  }

  const lanePitches = (mapper) => ['lane0', 'lane1', 'lane2', 'lane3'].map((lane, index) => (
    played(mapper, lane, 1 + index)));

  t.beforeEach(() => {
    restores = [];
    instrumentCalls = [];
    Core.ErrorReporter._resetForTests();
    Core.Log.clear();
  });

  t.afterEach(() => {
    restores.reverse().forEach((restore) => restore());
    restores = [];
    Core.ErrorReporter._resetForTests();
  });

  // ------------------------------------------------------------------------------------------ T03.05 profiles
  t.test('UT-08-01 profile A pitches C major', () => {
    t.deepEq(lanePitches(live({ profile: 'A' })), [[60], [62], [64], [65]]);
  });

  t.test('UT-08-02 profile A octave shift', () => {
    const mapper = live({ profile: 'A' });
    const shift = press(mapper, 'octUp', 1);
    t.eq(shift.length, 1);
    t.eq(shift[0].kind, 'octave');
    t.eq(shift[0].octave, 5);
    t.deepEq(onPitches(press(mapper, 'lane0', 2)), [[72]]);
  });

  t.test('UT-08-03 profile B intervals major and minor', () => {
    t.deepEq(lanePitches(live({ profile: 'B' })), [[60], [64], [67], [72]]);
    const minor = live({ profile: 'B', key: A_MINOR });
    t.deepEq(played(minor, 'lane0', 1), [69], 'root A4');
    t.deepEq(played(minor, 'lane1', 2), [72], 'a minor third above A: C5');
    t.deepEq(Mapping.profileTable('B', { key: C_MAJOR, intervals: [0, 2, 7, 12] }).map((row) => row.pitches[0]),
      [60, 62, 67, 72], 'intervals are configurable');
  });

  t.test('UT-08-04 profile C chords and voicing', () => {
    t.deepEq(lanePitches(live({ profile: 'C' })), [[60, 64, 67], [65, 69, 72], [67, 71, 74], [69, 72, 76]]);
    const minor = live({ profile: 'C', key: A_MINOR });
    t.deepEq(played(minor, 'lane0', 1), [57, 60, 64], 'the i chord drops an octave to stay near the root');
    t.deepEq(played(minor, 'lane3', 2), [65, 69, 72], 'VI of A minor');
  });

  t.test('UT-08-05 profile C inversion', () => {
    const mapper = live({ profile: 'C' });
    mapper.setChordSlots([{ degree: 1, type: 'major', inversion: 1 }, { degree: 4, type: 'major' },
      { degree: 5, type: 'major' }, { degree: 6, type: 'minor' }]);
    t.deepEq(played(mapper, 'lane0', 1), [64, 67, 72]);
    t.deepEq(played(mapper, 'lane1', 2), [65, 69, 72], 'a slot without an inversion stays in root position');
  });

  t.test('UT-08-06 profile D paging and register', () => {
    const mapper = live({ profile: 'D' });
    t.deepEq(played(mapper, 'lane0', 1), [60]);
    const paged = press(mapper, 'octUp', 2);
    t.eq(paged[0].kind, 'octave');
    t.deepEq(played(mapper, 'lane0', 3), [67], 'page 1 starts at degree 5');
    mapper.setRegister(1);
    t.deepEq(played(mapper, 'lane0', 4), [69], 'register 1 on page 1');
    release(mapper, 'octUp', 5);
    press(mapper, 'octDown', 6);
    t.deepEq(played(mapper, 'lane0', 7), [62], 'page 0 with register 1');
  });

  t.test('UT-08-07 profile E by family', () => {
    t.deepEq(played(live({ profile: 'E', program: 33 }), 'lane0', 1), [36], 'bass lane0 is C2');
    const bass = live({ profile: 'E', program: 33 });
    t.deepEq(lanePitches(bass), [[36], [43], [48], [47]], 'C2 G2 C3 B2');
    const guitar = live({ profile: 'E', program: 27 });
    t.deepEq(lanePitches(guitar), [[48, 55, 60], [53, 60, 65], [55, 62, 67], [48]], 'power chords and the root');
    const piano = live({ profile: 'E', program: 0 });
    t.deepEq(lanePitches(piano), [[60], [64], [67], [72]], 'degrees 1, 3, 5, 8');
    t.deepEq(lanePitches(live({ profile: 'E', program: 100 })), [[60], [62], [64], [65]], 'synth effects as profile A');
    t.deepEq(played(live({ profile: 'E', program: 0, isDrums: true }), 'lane1', 1), [38], 'drum kit snare');
  });

  t.test('UT-08-08 profile F pages', () => {
    const mapper = live({ profile: 'F', program: 40 });
    t.deepEq(played(mapper, 'lane2', 1), [42], 'closed hat on page 0');
    press(mapper, 'octDown', 2);
    t.deepEq(played(mapper, 'lane2', 3), [44], 'pedal hat on page -1');
    release(mapper, 'octDown', 3.5);
    press(mapper, 'octUp', 4);
    release(mapper, 'octUp', 4.5);
    press(mapper, 'octUp', 5);
    t.deepEq(played(mapper, 'lane2', 6), [51], 'ride on page 1');
    const refused = press(mapper, 'octUp', 7);
    release(mapper, 'octUp', 7.5);
    t.eq(refused[0].kind, 'octave', 'a page beyond 1 is reported unchanged');
    t.deepEq(played(mapper, 'lane2', 8), [51]);
    t.eq(press(mapper, 'lane0', 9)[0].channel, 9, 'the drum kit plays on channel 10');
  });

  t.test('UT-08-09 profile switch via controls', () => {
    const mapper = live({ profile: 'A' });
    const switched = press(mapper, 'profile3', 1);
    t.eq(switched.length, 1);
    t.eq(switched[0].kind, 'profile');
    t.eq(switched[0].profile, 'C');
    t.deepEq(onPitches(press(mapper, 'lane0', 2)), [[60, 64, 67]]);
    ['profile1', 'profile2', 'profile4', 'profile5', 'profile6'].forEach((control, index) => {
      t.eq(press(mapper, control, 3 + index)[0].profile, ['A', 'B', 'D', 'E', 'F'][index]);
    });
  });

  t.test('mapping: a profile change applies from the next press while held notes keep their mapping', () => {
    const mapper = live({ profile: 'A' });
    press(mapper, 'lane0', 1);
    press(mapper, 'profile3', 2);
    t.deepEq(mapper.state().held, [60], 'the held note is unchanged');
    const off = release(mapper, 'lane0', 3);
    t.deepEq(off.map((action) => action.pitches), [[60]], 'release ends the note that was pressed, not a chord');
    t.deepEq(onPitches(press(mapper, 'lane0', 4)), [[60, 64, 67]]);
  });

  t.test('mapping: profileTable lists the four lanes and never needs a mapper', () => {
    const table = Mapping.profileTable('C', { key: C_MAJOR });
    t.deepEq(table.map((row) => row.control), ['lane0', 'lane1', 'lane2', 'lane3']);
    t.deepEq(table.map((row) => row.action), ['C', 'F', 'G', 'Am']);
    t.deepEq(Mapping.profileTable('F', {}).map((row) => row.action),
      ['Bass Drum 1', 'Acoustic Snare', 'Closed Hi-Hat', 'Crash Cymbal 1']);
    t.deepEq(Mapping.PROFILES, ['A', 'B', 'C', 'D', 'E', 'F']);
    t.eq(Mapping.diatonicTriad('major', 7), 'dim');
    t.eq(Mapping.diatonicTriad('naturalMinor', 6), 'major');
    t.eq(Mapping.laneForPitch(36), 0);
    t.eq(Mapping.laneForPitch(39), 1);
    t.eq(Mapping.laneForPitch(46), 2);
    t.eq(Mapping.laneForPitch(49), 3);
    t.eq(Mapping.laneForPitch(10), 3);
  });

  t.test('UT-08-10 range policy', () => {
    const mapper = live({ profile: 'A', program: 33, range: { low: 28, high: 55 }, octave: 6 });
    t.deepEq(onPitches(press(mapper, 'lane0', 1)), [[48]], 'C6 (84) folds down by octaves into 28..55');
    release(mapper, 'lane0', 1.5);
    t.deepEq(onPitches(press(mapper, 'lane0', 2)), [[48]]);
    const warnings = Core.Log.entries().filter((entry) => entry.msg === 'MAP_RANGE_CLAMP');
    t.eq(warnings.length, 1, 'logged once per program');
    t.eq(warnings[0].data.program, 33);
    const narrow = live({ profile: 'A', range: { low: 60, high: 64 }, octave: 6 });
    t.deepEq(onPitches(press(narrow, 'lane3', 1)), [[60]],
      'a range narrower than an octave clamps to the nearest bound');
  });

  t.test('mapping: an octave step that would leave the instrument range is refused', () => {
    const mapper = live({ profile: 'A', octave: 7 });
    t.eq(press(mapper, 'octUp', 1)[0].octave, 7, 'C8 to F8 do not all fit under 108');
    t.eq(mapper.state().octave, 7);
    t.eq(press(mapper, 'octDown', 2)[0].octave, 6);
    const stray = live({ profile: 'A', range: { low: 28, high: 55 }, octave: 6 });
    t.eq(press(stray, 'octDown', 1)[0].octave, 5, 'a state already out of range may step toward the range');
  });

  t.test('UT-08-11 velocity from pressure', () => {
    const mapper = live({ profile: 'A' });
    const velocityOf = (actions) => ofKind(actions, 'noteOn')[0].velocity;
    t.eq(velocityOf(press(mapper, 'lane0', 1, { source: 'pointer', pressure: 0.8 })), 102);
    t.eq(velocityOf(press(mapper, 'lane1', 2)), 100);
    t.eq(velocityOf(press(mapper, 'lane2', 3, { source: 'midi', pressure: 100 / 127 })), 100);
    t.eq(velocityOf(press(mapper, 'lane3', 4, { source: 'pointer', pressure: 0.5 })), 100, 'neutral touch pressure');
    release(mapper, 'lane0', 5);
    t.eq(velocityOf(press(mapper, 'lane0', 6, { source: 'gamepad', pressure: 0.25 })), 32);
    mapper.setVelocity(80);
    release(mapper, 'lane1', 7);
    t.eq(velocityOf(press(mapper, 'lane1', 8)), 80, 'the configured velocity replaces the default 100');
  });

  t.test('UT-08-12 fixed note length', () => {
    const mapper = live({ profile: 'A' });
    mapper.setNoteLength('fixed', 480);
    const actions = press(mapper, 'lane0', 10);
    t.deepEq(actions.map((action) => action.kind), ['noteOn', 'noteOff', 'label']);
    t.near(actions[1].tAudio, 10.25, 1e-9, '480 ticks at 120 BPM and 960 ticks per quarter is 0.25 s');
    t.deepEq(actions[1].pitches, [60]);
    t.deepEq(release(mapper, 'lane0', 10.1), [], 'release emits nothing');
    const bounds = live({ profile: 'A' });
    bounds.setNoteLength('fixed', 1);
    t.near(press(bounds, 'lane0', 1)[1].tAudio, 1.05, 1e-9, 'never shorter than 50 ms');
    release(bounds, 'lane0', 2);
    bounds.setNoteLength('fixed', 960000);
    t.near(press(bounds, 'lane0', 3)[1].tAudio, 5, 1e-9, 'never longer than 2,000 ms');
    t.throws(() => bounds.setNoteLength('long'), 'E-GEN-005');
  });

  t.test('UT-08-13 release without press', () => {
    const mapper = live({ profile: 'A' });
    t.deepEq(release(mapper, 'lane1', 1), []);
    t.deepEq(release(mapper, 'sustain', 2), []);
    t.deepEq(mapper.handle({ control: 'nonsense', type: 'press' }), [], 'unknown controls are ignored');
    t.deepEq(mapper.handle(null), []);
  });

  t.test('UT-08-14 sustain defers note offs', () => {
    const mapper = live({ profile: 'A' });
    const on = press(mapper, 'sustain', 1);
    t.deepEq([on[0].kind, on[0].controller, on[0].value], ['cc', 64, 127]);
    t.deepEq(onPitches(press(mapper, 'lane0', 2)), [[60]]);
    t.deepEq(release(mapper, 'lane0', 3), [], 'no note off while sustain is held');
    t.deepEq(mapper.state().deferred, [60]);
    const off = release(mapper, 'sustain', 4);
    t.deepEq(off.map((action) => action.kind), ['cc', 'noteOff']);
    t.eq(off[0].value, 0);
    t.deepEq(off[1].pitches, [60]);
    t.eq(off[1].tAudio, 4);
    t.deepEq(mapper.state().deferred, []);
  });

  t.test('mapping: retriggering a pitch releases the previous voice of that pitch first', () => {
    const mapper = live({ profile: 'A' });
    press(mapper, 'lane0', 1);
    const again = press(mapper, 'midi:60', 2, { source: 'midi', pressure: 0.5 });
    t.deepEq(again.map((action) => action.kind), ['noteOff', 'noteOn', 'label']);
    t.deepEq(again[0].pitches, [60]);
    t.deepEq(release(mapper, 'lane0', 3), [], 'the first control no longer owns the pitch');
    t.deepEq(release(mapper, 'midi:60', 4).map((action) => action.pitches), [[60]]);
    const sustained = live({ profile: 'A' });
    press(sustained, 'sustain', 1);
    press(sustained, 'lane0', 2);
    release(sustained, 'lane0', 3);
    const retrigger = press(sustained, 'lane0', 4);
    t.deepEq(retrigger.map((action) => action.kind), ['noteOff', 'noteOn', 'label'],
      'a deferred pitch is released too');
    t.deepEq(sustained.state().deferred, []);
  });

  t.test('mapping: MIDI pass-through sends the pitch as played, without the range policy', () => {
    const mapper = live({ profile: 'A' });
    t.deepEq(onPitches(press(mapper, 'midi:10', 1, { source: 'midi', pressure: 0.5 })), [[10]]);
    t.deepEq(onPitches(press(mapper, 'midi:127', 2, { source: 'midi', pressure: 0.5 })), [[127]]);
    t.deepEq(press(mapper, 'midi:200', 3, { source: 'midi', pressure: 0.5 }), []);
  });

  t.test('UT-08-15 tick null when stopped', () => {
    const mapper = live({ profile: 'A', transport: fakeTransport('stopped') });
    const action = press(mapper, 'lane0', 1)[0];
    t.eq(action.kind, 'noteOn');
    t.eq(action.tick, null);
    t.eq(action.rawTick, null);
    t.eq(action.tAudio, 1, 'the audio time is kept');
    const running = live({ profile: 'A', transport: fakeTransport('countin') });
    t.eq(press(running, 'lane0', 1)[0].rawTick, 1920, 'a count-in counts as running');
  });

  t.test('UT-08-16 dispatch isolates Instruments errors', () => {
    recordingInstruments('liveNoteOn');
    const action = { kind: 'noteOn', pitches: [60], velocity: 100, channel: 0, program: 0, tAudio: 1 };
    t.eq(Mapping.dispatch(action, 'fp'), false);
    const reports = Core.ErrorReporter.records();
    t.eq(reports.length, 1);
    t.eq(reports[0].class, 'recoverable');
    t.eq(Mapping.dispatch({ kind: 'noteOff', pitches: [60], channel: 0, program: 0, tAudio: 2 }, 'fp'), true,
      'the next call still works');
  });

  t.test('mapping: dispatch is guarded until M-06 exists and maps actions to the live Instruments calls', () => {
    const action = { kind: 'noteOn', pitches: [60, 64], velocity: 90, channel: 9, program: 5, tAudio: 3 };
    standIn('Instruments', undefined);
    t.eq(Mapping.dispatch(action, 'fp'), false, 'no Instruments: nothing is called and nothing throws');
    recordingInstruments();
    t.eq(Mapping.dispatch(action, 'fp'), true);
    Mapping.dispatch({ kind: 'noteOff', pitches: [60], channel: 9, program: 5, tAudio: 4 }, 'fp');
    Mapping.dispatch({ kind: 'cc', controller: 64, value: 127, channel: 0, program: 0, tAudio: 5 }, 'fp');
    Mapping.dispatch({ kind: 'label', pitches: [], tAudio: 6 }, 'fp');
    t.deepEq(instrumentCalls.map((call) => call.name),
      ['liveNoteOn', 'liveNoteOn', 'liveNoteOff', 'controlLive'], 'one voice per pitch; labels are not played');
    t.deepEq(instrumentCalls[0].args, ['fp', 5, true, 9, 60, 90, 3]);
    t.deepEq(instrumentCalls[2].args, ['fp', 9, 60, 4]);
    t.deepEq(instrumentCalls[3].args, ['fp', 0, 'cc', 64, 127, 5]);
    Mapping.dispatch({ kind: 'noteOn', pitches: [60], velocity: 100, channel: 0, program: 0, tAudio: null }, 'fp');
    t.ok(instrumentCalls[4].args[6] > 0, 'a null audio time plays at now + 5 ms');
  });

  t.test('UT-08-17 quantization snaps the recorded tick only', () => {
    const mapper = live({ profile: 'A' });
    mapper.setQuantize(true);
    const tAudio = 250 / TICKS_PER_SECOND;
    const on = press(mapper, 'lane0', tAudio)[0];
    t.eq(on.rawTick, 250);
    t.eq(on.tick, 240);
    t.eq(on.tAudio, tAudio, 'the sound is not moved');
    release(mapper, 'lane0', 1);
    const half = press(mapper, 'lane0', 120 / TICKS_PER_SECOND)[0];
    t.eq(half.tick, 240, 'halfway rounds up');
    release(mapper, 'lane0', 2);
    mapper.setQuantize(false);
    const free = press(mapper, 'lane0', tAudio)[0];
    t.eq(free.tick, 250);
    t.eq(free.rawTick, 250);
  });

  t.test('UT-08-18 chord label within 30 ms', () => {
    const mapper = live({ profile: 'A' });
    const first = press(mapper, 'lane0', 1);
    const second = press(mapper, 'lane1', 1 + 10 * MS);
    const third = press(mapper, 'lane2', 1 + 20 * MS);
    t.eq(lastLabel(first), 'C4', 'one pitch is labelled by its note name');
    t.eq(lastLabel(second), 'Major 2nd', 'two pitch classes by their interval');
    t.eq(lastLabel(third), 'C4 D4 E4', 'three unrelated pitches by their note names');
    t.deepEq(ofKind(third, 'label')[0].pitches, [60, 62, 64]);
    mapper.releaseAll(2);
    mapper.setProfile('C');
    t.eq(lastLabel(press(mapper, 'lane0', 3)), 'C', 'the major triad is recognized');
  });

  t.test('mapping: a press 31 ms after the first starts a new label group', () => {
    const mapper = live({ profile: 'A' });
    press(mapper, 'lane0', 1);
    t.eq(lastLabel(press(mapper, 'lane1', 1 + 29 * MS)), 'Major 2nd');
    t.eq(lastLabel(press(mapper, 'lane2', 1 + 31 * MS)), 'E4', 'a new group names only its own pitch');
    t.eq(mapper.state().lastChordLabel, 'E4');
    const inversion = live({ profile: 'C' });
    inversion.setChordSlots([{ degree: 1, type: 'major', inversion: 1 }, { degree: 4, type: 'major' },
      { degree: 5, type: 'major' }, { degree: 6, type: 'minor' }]);
    t.eq(lastLabel(press(inversion, 'lane0', 1)), 'C/E', 'an inversion names its bass');
  });

  t.test('UT-08-19 releaseAll closes everything', () => {
    const mapper = live({ profile: 'A' });
    press(mapper, 'lane0', 1);
    press(mapper, 'lane2', 1.01);
    press(mapper, 'sustain', 1.02);
    const closed = mapper.releaseAll(2);
    t.deepEq(closed.map((action) => action.kind), ['noteOff', 'cc']);
    t.deepEq(closed[0].pitches, [60, 64]);
    t.deepEq([closed[1].controller, closed[1].value], [64, 0]);
    const state = mapper.state();
    t.deepEq(state.sounding, []);
    t.deepEq(state.deferred, []);
    t.eq(state.sustain, false);
    t.deepEq(mapper.releaseAll(3), [], 'a second call has nothing to close');
  });

  t.test('mapping: every note-on has exactly one matching note-off (invariant 1)', () => {
    const mapper = live({ profile: 'A' });
    const all = [];
    const run = (actions) => all.push.apply(all, actions);
    run(press(mapper, 'lane0', 1));
    run(press(mapper, 'lane1', 1.1));
    run(press(mapper, 'sustain', 1.2));
    run(release(mapper, 'lane0', 1.3));
    run(press(mapper, 'lane0', 1.4));
    run(release(mapper, 'lane1', 1.5));
    run(press(mapper, 'midi:60', 1.55, { source: 'midi', pressure: 0.5 }));
    mapper.setNoteLength('fixed', 480);
    run(press(mapper, 'lane2', 1.6));
    run(release(mapper, 'sustain', 1.7));
    run(release(mapper, 'lane0', 1.8));
    run(mapper.releaseAll(2));
    const balance = {};
    all.forEach((action) => {
      const step = action.kind === 'noteOn' ? 1 : action.kind === 'noteOff' ? -1 : 0;
      action.pitches.forEach((pitch) => {
        balance[pitch] = (balance[pitch] || 0) + step;
      });
    });
    t.deepEq(Object.keys(balance).filter((pitch) => balance[pitch] !== 0), [],
      'every pitch is switched on and off the same number of times');
  });

  t.test('mapping: key, scale and context changes', () => {
    const mapper = live({ profile: 'A' });
    mapper.setKey(A_MINOR);
    t.eq(mapper.state().scale, 'naturalMinor', 'the scale follows the mode');
    t.deepEq(lanePitches(mapper), [[69], [71], [72], [74]]);
    mapper.setScale('minorPentatonic');
    t.deepEq(lanePitches(mapper), [[69], [72], [74], [76]], 'an explicit scale replaces the mode default');
    mapper.setContext({ root: 2, octave: 3 });
    t.deepEq(played(mapper, 'lane0', 9), [50], 'D3 as the root of D minor pentatonic');
    mapper.setScale(null);
    t.eq(mapper.state().scale, 'naturalMinor');
    t.throws(() => mapper.setKey({ tonic: 12, mode: 'major' }), 'E-GEN-005');
    t.throws(() => mapper.setKey({ tonic: 0, mode: 'dorian' }), 'E-GEN-005');
    t.throws(() => mapper.setScale('no-such-scale'), 'E-GEN-006');
    t.throws(() => mapper.setProfile('G'), 'E-GEN-005');
    t.throws(() => mapper.setChordSlots([{ degree: 1, type: 'major' }]), 'E-GEN-005');
    t.throws(() => mapper.setChordSlots([1, 2, 3, 4]), 'E-GEN-005');
    t.throws(() => mapper.setIntervals([0, 4, 7, 99]), 'E-GEN-005');
    t.throws(() => Mapping.createLive({ profile: 'Z' }), 'E-GEN-005');
    t.eq(Mapping.createLive().state().profile, 'A', 'the Free Play default is profile A in C major');
    t.deepEq(Mapping.createLive().state().key, C_MAJOR);
  });

  t.test('mapping: onAction listeners, recorded actions and dispose', () => {
    const mapper = live({ profile: 'A' });
    const heard = [];
    const unsubscribe = mapper.onAction((action) => heard.push(action.kind));
    mapper.onAction(() => { throw new Error('listener failed'); });
    const actions = press(mapper, 'lane0', 1);
    t.deepEq(heard, actions.map((action) => action.kind), 'listeners hear every action in order');
    t.eq(Core.ErrorReporter.records().length, 1, 'a throwing listener is reported and does not stop the others');
    unsubscribe();
    release(mapper, 'lane0', 2);
    t.eq(heard.length, actions.length, 'an unsubscribed listener hears nothing more');
    t.eq(mapper.actions().length, actions.length + 1, 'every action is recorded');
    mapper.dispose();
    t.deepEq(press(mapper, 'lane1', 3), [], 'a disposed mapper is silent');
  });

  t.test('mapping: handle never writes to its input and is deterministic', () => {
    const event = Object.freeze(inputEvent('lane0', 'press', 1));
    const first = live({ profile: 'C' }).handle(event);
    const second = live({ profile: 'C' }).handle(event);
    t.eq(JSON.stringify(first), JSON.stringify(second));
    t.eq(Object.isFrozen(Mapping), true);
    t.eq(Object.isFrozen(Mapping.PROFILES), true);
  });
});
})();
