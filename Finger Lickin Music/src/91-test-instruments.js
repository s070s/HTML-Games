// 91-test-instruments.js - unit tests for M-06 FLM.Instruments (group 'instruments'; test build only).
// T04.06 delivers UT-06-01, UT-06-04 to UT-06-13, UT-06-16 to UT-06-24 and the T04.05 rows UT-06-14, UT-06-15 and
// UT-06-24; T04.07 adds UT-06-02, UT-06-03 and the fidelity checks. Sound is rendered on an OfflineAudioContext with an
// injected clock (Part 6.5.4.10); onsets and levels are read from the rendered buffer. Real sound output is judged by
// the listening reviews LT-031, LT-041 and LT-042 (Phase 15). A lower-case letter after an id marks an extra check.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('instruments', (t) => {
  const Core = FLM.Core;
  const Audio = FLM.Audio;
  const Instruments = FLM.Instruments;
  const Events = FLM.Model.Events;
  const SAMPLE_RATE = 48000;
  const QUANTUM_S = 128 / SAMPLE_RATE;
  const LIMITER_DELAY_S = 0.006;
  const BEAT = 960;
  const TICK_S = Audio.TICK_MS / 1000;
  const engines = [];

  t.after(() => {
    Instruments.attach(Audio.init());          // the boot binding of the app engine is back for the groups that follow
  });

  t.afterEach(() => {
    Instruments.dispose();
    Instruments.configurePluckCache(48, true);
    engines.splice(0).forEach((engine) => engine.close());
  });

  // ------------------------------------------------------------------------------------------- helpers
  /** An engine on an offline context with a fake clock, Instruments attached. */
  function makeRig(extra) {
    const settings = Object.assign({ seconds: 3, rate: SAMPLE_RATE }, extra);
    const context = new window.OfflineAudioContext(2, Math.ceil(settings.seconds * settings.rate), settings.rate);
    const clock = t.fakes.clock();
    const bus = new Core.Emitter();
    const engine = Audio.createEngine({ context, clock, bus, mobile: false, readSetting: () => 1, polyphony: 0 });
    engines.push(engine);
    Instruments.attach(engine);
    engine.Scheduler.setInstruments(Instruments);
    return { engine, context, clock, bus };
  }

  const track = (extra) => Object.assign({ id: 't1', program: 0, isDrums: false, version: 0, events: [] }, extra);
  const note = (pitch, velocity, extra) => Object.assign({ kind: 'note', tick: 0, durTicks: BEAT, pitch, velocity,
    channel: 0 }, extra);
  const slotsOf = (rig) => rig.engine.VoiceAllocator.list().filter((slot) => slot.voice);

  function allSamples(data, fromSeconds, toSeconds) {
    return data.subarray(Math.round(fromSeconds * SAMPLE_RATE), Math.round(toSeconds * SAMPLE_RATE));
  }

  function peakOf(data, fromSeconds, toSeconds) {
    return allSamples(data, fromSeconds, toSeconds).reduce((largest, sample) => Math.max(largest, Math.abs(sample)), 0);
  }

  /** Frequency by interpolated rising zero crossings between two times. */
  function frequencyOf(data, fromSeconds, toSeconds) {
    const crossings = [];
    const first = Math.round(fromSeconds * SAMPLE_RATE);
    const last = Math.round(toSeconds * SAMPLE_RATE);
    for (let index = first + 1; index < last; index += 1) {
      if (data[index - 1] < 0 && data[index] >= 0) {
        crossings.push(index - 1 + (-data[index - 1]) / (data[index] - data[index - 1]));
      }
    }
    return (crossings.length - 1) / ((crossings[crossings.length - 1] - crossings[0]) / SAMPLE_RATE);
  }

  // ------------------------------------------------------------------------------------------- the table
  t.test('UT-06-01 definition table integrity: 128 frozen definitions from 16 templates', () => {
    const defs = Instruments.DEFINITIONS;
    t.eq(defs.length, 128);
    const ids = Instruments.FAMILIES.map((family) => family.id);
    t.eq(new Set(ids).size, 16, 'sixteen distinct templates');
    defs.forEach((def, program) => {
      t.eq(def.program, program);
      t.eq(def.family, Math.floor(program / 8), 'family of ' + program);
      t.ok(ids.includes(def.template), 'template of ' + program + ' exists');
      t.ok(Object.isFrozen(def) && Object.isFrozen(def.params) && Object.isFrozen(def.params.filter), 'frozen ' + program);
      t.ok(def.range[0] >= 0 && def.range[1] <= 127 && def.range[0] < def.range[1], 'range of ' + program);
      const known = Object.keys(Instruments.FAMILIES[ids.indexOf(def.template)]);
      Object.keys(def.params).forEach((key) => t.ok(known.includes(key), 'field ' + key + ' of ' + program +
        ' is in the template schema'));
      t.eq(def.bank, null);
      t.ok(typeof def.propId === 'string' && def.defaultProfile === 'A');
    });
    t.eq(Instruments.VERSION, 1);
    t.eq(Instruments.DRUM_VOICES.length, 12);
  });

  t.test('UT-06-02 fidelity declarations: levels and exact labels; nothing is sampled', () => {
    const basic = [16, 17, 18, 19, 20, 109, 119, 120, 121, 122, 123, 124, 125, 126, 127];
    const cases = [[0, 'synth-velocity', 3], [16, 'synth-basic', 1], [109, 'synth-basic', 1], [127, 'synth-basic', 1],
      ['drums', 'synth-velocity', 1]];
    cases.forEach((item) => {
      const info = Instruments.fidelity(item[0]);
      t.eq(info.level, item[1], String(item[0]));
      t.eq(info.velocityLayers, item[2], 'layers of ' + item[0]);
      t.eq(info.label, item[1] === 'synth-basic' ? 'Synthesized' : 'Synthesized, velocity-sensitive');
      t.eq(info.sampled, false);
      t.eq(info.percussion, item[0] === 'drums');
      t.deepEq(info.controllers, [1, 7, 10, 11, 64, 120, 121, 123]);
    });
    for (let program = 0; program < 128; program += 1) {
      const info = Instruments.fidelity(program);
      t.eq(info.level === 'synth-basic', basic.includes(program), 'level of ' + program);
      t.ok(!/sampl/i.test(info.label), 'no label says sampled');
      t.eq(info.sampled, false);
    }
    t.deepEq(Instruments.fidelity(81).articulations, ['legato']);
    t.deepEq(Instruments.fidelity(0).articulations, []);
    t.deepEq([Instruments.range(0)[0], Instruments.range(0)[1]], [21, 108]);
  });

  t.test('UT-06-03 family coverage: each of the 16 templates is used by at least one program', () => {
    const used = new Set(Instruments.DEFINITIONS.map((def) => def.template));
    Instruments.FAMILIES.forEach((family) => t.ok(used.has(family.id), family.id + ' is used'));
  });

  t.test('UT-06-04 program clamp: an unknown program is the piano and W-INS-PROGRAM is logged', () => {
    Core.Log.clear();
    t.eq(Instruments.definition(200).program, 0);
    t.eq(Instruments.definition(-1).program, 0);
    t.eq(Instruments.definition(2.5).program, 0);
    const warned = Core.Log.entries().filter((entry) => String(entry.msg).includes('W-INS-PROGRAM'));
    t.eq(warned.length, 3);
    t.eq(Instruments.definition(40).name.length > 0, true);
  });

  t.test('UT-06-11 drum map table: the keys of the plan map to their voices; outside 35 to 81 is shakerMisc', () => {
    const names = [35, 42, 46, 49, 81, 20, 100].map((key) => Instruments.drumVoiceFor(key).name);
    t.deepEq(names, ['kick', 'closedHat', 'openHat', 'crash', 'cowbellMisc', 'shakerMisc', 'shakerMisc']);
    t.eq(Instruments.DRUM_MAP.length, 128);
    for (let key = 35; key <= 81; key += 1) t.ok(Instruments.DRUM_MAP[key] <= 11, 'key ' + key + ' is mapped');
    t.deepEq(Instruments.DRUM_VOICES.map((voice) => voice.name), ['kick', 'snare', 'rimshot', 'clap', 'tom', 'closedHat',
      'openHat', 'pedalHat', 'crash', 'ride', 'cowbellMisc', 'shakerMisc']);
  });

  // ------------------------------------------------------------------------------------------- sound
  t.test('UT-06-05 velocity curve and layers: piano gains rise with velocity in three layers; the organ is flat', () => {
    const rig = makeRig();
    const play = (program, velocity) => {
      const owner = track({ id: 'v' + program + velocity, program });
      return Instruments.noteOn(owner, note(60, velocity), 1, 2).voice;
    };
    const piano = [20, 64, 127].map((velocity) => play(0, velocity));
    t.ok(piano[0].peak < piano[1].peak && piano[1].peak < piano[2].peak, 'strictly increasing: ' +
      piano.map((voice) => voice.peak.toFixed(3)).join(' '));
    t.deepEq(piano.map((voice) => voice.layerIndex), [0, 1, 2]);
    const organ = [20, 64, 127].map((velocity) => play(16, velocity));
    t.ok(organ.every((voice) => Math.abs(voice.peak - organ[0].peak) < 1e-12), 'the organ ignores velocity');
    t.eq(rig.engine.VoiceAllocator.activeCount(), 6);
  });

  t.test('UT-06-06 offline onset and release timing: a piano note starts on time and has faded by its release', async () => {
    const rig = makeRig();
    const release = Instruments.definition(0).params.amp.r;
    Instruments.noteOn(track(), note(60, 100), 1.0, 1.5);
    const buffer = await rig.context.startRendering();
    const found = t.fakes.onsets(buffer, { threshold: 0.01 });
    t.eq(found.length, 1);
    t.ok(Math.abs(found[0] - (1.0 + LIMITER_DELAY_S)) <= QUANTUM_S + 0.001 + 0.002, 'onset ' +
      ((found[0] - 1) * 1000).toFixed(2) + ' ms after 1.0');
    const data = buffer.getChannelData(0);
    t.ok(peakOf(data, 1.5 + release + 0.02 + LIMITER_DELAY_S, 2) < 0.01, 'silent after the release');
    t.ok(peakOf(data, 1.05, 1.4) > 0.02, 'and audible while held');
  });

  t.test('UT-06-07 pitch accuracy: program 78 at A4 sounds 440 Hz within half a percent', async () => {
    const rig = makeRig({ seconds: 1.5 });
    Instruments.noteOn(track({ program: 78 }), note(69, 100), 0.1, 0.9);
    const data = (await rig.context.startRendering()).getChannelData(0);
    const hz = frequencyOf(data, 0.2, 0.39);
    t.ok(Math.abs(hz - 440) / 440 < 0.005, 'measured ' + hz.toFixed(2) + ' Hz');
  });

  t.test('UT-06-08 pluck buffer determinism: the same program and pitch give the same samples; 2.5 s long', () => {
    makeRig();
    const first = Instruments.pluckBuffer(25, 60, 1);
    const firstData = Float32Array.from(first.getChannelData(0));
    Instruments.configurePluckCache(48, true);
    const second = Instruments.pluckBuffer(25, 60, 1);
    t.eq(second.length, Math.round(2.5 * SAMPLE_RATE));
    t.ok(first !== second, 'rebuilt after the cache was cleared');
    t.ok(firstData.every((value, index) => value === second.getChannelData(0)[index]), 'identical sample data');
    t.ok(firstData.some((value) => Math.abs(value) > 0.5), 'and not silent');
  });

  t.test('UT-06-09 pluck cache LRU: with a cap of 4 the fifth request evicts the first', () => {
    makeRig();
    Instruments.configurePluckCache(4, true);
    const length = Math.round(2.5 * SAMPLE_RATE);
    [60, 61, 62, 63].forEach((pitch) => Instruments.pluckBuffer(25, pitch, 0));
    const second = Instruments.pluckBuffer(25, 61, 0);
    Instruments.pluckBuffer(25, 64, 0);
    t.eq(Instruments.stats().pluckCacheEntries, 4);
    t.eq(Instruments.stats().pluckCacheBytes, 4 * length * 4, 'the byte count follows the entries');
    t.ok(Instruments.pluckBuffer(25, 61, 0) === second, '61 was used recently and stays');
    const rebuilt = Instruments.pluckBuffer(25, 60, 0);
    t.ok(rebuilt.length === length && Instruments.stats().pluckCacheEntries === 4, '60 was the oldest and was evicted');
  });

  t.test('UT-06-10 mono legato: a second note on a mono lead releases the first with a 10 ms ramp at its onset', () => {
    const rig = makeRig();
    const first = Instruments.startLive('lead', 81, false, 0, 60, 100, 1.0);
    const second = Instruments.startLive('lead', 81, false, 0, 64, 100, 1.5);
    t.ok(first && second);
    t.near(first.voice.releaseAt, 1.5, 1e-9);
    t.near(first.voice.releaseRamp, 0.01, 1e-12);
    t.near(second.voice.releaseAt, 61.5, 1e-9, 'the new note is held, up to the 60 s cap');
    t.eq(rig.engine.VoiceAllocator.activeCount(), 2);
  });

  t.test('UT-06-12 drum recipes render: all twelve voices make sound, end within 2 s and stay below full scale',
    async () => {
      const keys = { kick: 36, snare: 38, rimshot: 37, clap: 39, tom: 45, closedHat: 42, openHat: 46, pedalHat: 44,
        crash: 49, ride: 51, cowbellMisc: 56, shakerMisc: 69 };
      for (const name of Object.keys(keys)) {
        const rig = makeRig({ seconds: 2.6 });
        const slot = Instruments.noteOn(track({ isDrums: true }), note(keys[name], 100, { channel: 9 }), 0.1, 0.2);
        const voice = slot.voice;
        t.eq(voice.drumName, name);
        t.ok(voice.duration <= 2, name + ' lasts at most 2 s');
        const data = (await rig.context.startRendering()).getChannelData(0);
        t.ok(peakOf(data, 0.1, 0.5) > 0.005, name + ' is audible: ' + peakOf(data, 0.1, 0.5).toFixed(4));
        t.ok(peakOf(data, 0, 2.5) <= 1.0, name + ' stays at or below 1.0');
        t.ok(peakOf(data, 2.2, 2.6) < 0.01, name + ' is silent after 2.2 s');
        engines.pop().close();
        Instruments.dispose();
      }
    });

  t.test('UT-06-13 hi-hat choke: a closed hat releases the open hat of the track within 20 ms', () => {
    makeRig();
    const owner = track({ isDrums: true });
    const open = Instruments.noteOn(owner, note(46, 100, { channel: 9 }), 0, 0.5);
    const closed = Instruments.noteOn(owner, note(42, 100, { channel: 9 }), 0.1, 0.2);
    t.near(open.voice.releaseAt, 0.1, 0.02);
    t.eq(closed.voice.releaseAt, null, 'the closed hat itself is not choked');
    const other = Instruments.noteOn(track({ id: 't2', isDrums: true }), note(46, 100, { channel: 9 }), 0.2, 0.5);
    Instruments.noteOn(owner, note(44, 100, { channel: 9 }), 0.3, 0.4);
    t.eq(other.voice.releaseAt, null, 'another track is not touched');
  });

  // ------------------------------------------------------------------------------------------- program, controllers
  t.test('UT-06-14 program change keeps sounding voices: the old note keeps program 0, the next uses 40', () => {
    makeRig();
    const owner = track();
    const first = Instruments.noteOn(owner, note(60, 100), 0, 1);
    Instruments.control(owner, Events.program(0, 40, 0, 0, 0), 0.2);
    const second = Instruments.noteOn(owner, note(62, 100), 0.3, 1);
    t.eq(first.voice.program, 0);
    t.eq(second.voice.program, 40);
    t.eq(Instruments.programOf('t1'), 40);
    t.eq(first.voice.releaseAt, 1, 'the first voice was not released by the program change');
  });

  t.test('UT-06-15 live sustain: the voice is released when the pedal comes up, not at the key release', () => {
    const rig = makeRig();
    const slot = Instruments.startLive('piano', 0, false, 0, 60, 100, 0.5);
    Instruments.applyLive('piano', 0, 'cc', 64, 127, 0.6);
    t.eq(Instruments.stopLive('piano', 0, 60, 0.8), true);
    t.near(slot.voice.releaseAt, 60.5, 1e-9, 'still sounding: the pedal holds it (only the 60 s cap is booked)');
    Instruments.applyLive('piano', 0, 'cc', 64, 0, 1.0);
    t.near(slot.voice.releaseAt, 1.0, 1e-9);
    Instruments.applyLive('piano', 0, 'cc', 64, 0, 1.2);
    t.eq(rig.engine.VoiceAllocator.releasedCount(), 1);
    const next = Instruments.startLive('piano', 0, false, 0, 62, 100, 1.3);
    Instruments.stopLive('piano', 0, 62, 1.4);
    t.near(next.voice.releaseAt, 1.4, 1e-9, 'with the pedal up a key release is immediate');
  });

  t.test('UT-06-16 unsupported controllers are logged once each and counted; nothing throws', () => {
    makeRig();
    Core.Log.clear();
    [91, 91, 91, 93].forEach((controller) => Instruments.applyLive('t1', 0, 'cc', controller, 64, 0));
    const logged = Core.Log.entries().filter((entry) => String(entry.msg).includes('Unsupported controller'));
    t.eq(logged.length, 2);
    t.deepEq(Instruments.stats().unsupportedCCs, [91, 93]);
  });

  t.test('UT-06-17 instrument change while holding: the old voice keeps its patch, the next note uses the new one', () => {
    makeRig();
    const held = Instruments.startLive('t1', 0, false, 0, 60, 100, 0.5);
    Instruments.setTrackProgram('t1', 56, false);
    Instruments.stopLive('t1', 0, 60, 0.9);
    t.eq(held.voice.program, 0);
    t.near(held.voice.releaseAt, 0.9, 1e-9);
    t.near(held.voice.releaseRamp, Instruments.definition(0).params.amp.r, 1e-9, 'it releases with the piano release');
    const next = Instruments.startLive('t1', 56, false, 0, 62, 100, 1.0);
    t.eq(next.voice.program, 56);
  });

  t.test('UT-06-18 bend and RPN: range 12 through data entry, bend +8191 is about 1200 cents, CC 121 resets', () => {
    makeRig();
    const slot = Instruments.startLive('t1', 0, false, 0, 60, 100, 0.5);
    [[101, 0], [100, 0], [6, 12], [101, 127], [100, 127]].forEach((pair) => Instruments.applyLive('t1', 0, 'cc', pair[0],
      pair[1], 0.5));
    Instruments.applyLive('t1', 0, 'bend', 8191, undefined, 0.6);
    t.near(slot.voice.bend, 1200, 1);
    const fresh = Instruments.startLive('t1', 0, false, 0, 64, 100, 0.7);
    Instruments.applyLive('t1', 0, 'bend', -8192, undefined, 0.8);
    t.near(fresh.voice.bend, -1200, 1e-9);
    Instruments.applyLive('t1', 0, 'cc', 121, 0, 0.9);
    t.eq(slot.voice.bend, 0);
    t.eq(fresh.voice.bend, 0);
  });

  t.test('UT-06-19 node failure isolation: one failing node is reported E-AUD-004 and the next note sounds', () => {
    const rig = makeRig();
    Core.ErrorReporter._resetForTests();
    try {
      const original = rig.context.createOscillator;
      let failures = 1;
      rig.context.createOscillator = function failingOnce() {
        if (failures > 0) {
          failures -= 1;
          throw new DOMException('out of nodes', 'InvalidStateError');
        }
        return original.call(rig.context);
      };
      const failed = Instruments.noteOn(track(), note(60, 100), 0, 1);
      t.eq(failed, null);
      t.eq(Core.ErrorReporter.records().filter((item) => item.code === 'E-AUD-004').length, 1);
      const next = Instruments.noteOn(track(), note(62, 100), 0.1, 1);
      t.ok(next && next.voice, 'the next note succeeds');
      t.eq(rig.engine.VoiceAllocator.activeCount(), 1, 'no slot leaked');
      t.eq(rig.engine.VoiceAllocator.stats().dropped, 1);
      t.eq(rig.engine.VoiceAllocator.stats().started, 1, 'started + dropped = notes');
      delete rig.context.createOscillator;
    } finally {
      Core.ErrorReporter._resetForTests();
    }
  });

  t.test('UT-06-20 slot watchdog: a voice whose onended never fires is freed by the next stats pass after a second', () => {
    const rig = makeRig();
    const slot = Instruments.noteOn(track(), note(60, 100), 0, 0.5);
    const voice = slot.voice;
    const release = Instruments.definition(0).params.amp.r;
    rig.clock.set(0.5 + release + 0.5);
    Instruments.stats();
    t.eq(rig.engine.VoiceAllocator.activeCount(), 1, 'half a second after the release: still held');
    rig.clock.set(0.5 + release + 1.2);
    Instruments.stats();
    t.eq(rig.engine.VoiceAllocator.activeCount(), 0, 'freed by the watchdog');
    t.eq(voice.ended, true);
    t.eq(rig.engine.nodeCount(), 4 + 4, 'and its nodes are gone from the count (graph and the track strip)');
  });

  t.test('UT-06-21 CC routing to the strip: CC 7 64, CC 10 0 and CC 11 127', () => {
    const rig = makeRig();
    const owner = track();
    rig.engine.createStrip('t1');
    [[7, 64], [10, 0], [11, 127]].forEach((pair) => Instruments.control(owner, Events.cc(0, pair[0], pair[1], 0), 0));
    const mix = rig.engine.strips()[0].mixState();
    t.near(mix.ccVolume, 64 / 127, 1e-9);
    t.eq(mix.pan, -1);
    t.eq(mix.expression, 1);
  });

  t.test('UT-06-22 all programs build: every program makes a voice of at most 11 nodes (mod wheel up) and every drum key one of at most 8', () => {
    const rig = makeRig({ seconds: 1 });
    t.deepEq([Instruments.Voice.MAX_NODES, Instruments.Voice.MAX_DRUM_NODES], [11, 8], 'Part 6.6.6: 11 nodes a voice, 8 a drum hit');
    for (let program = 0; program < 128; program += 1) {
      const owner = track({ id: 'p' + program, program });
      Instruments.control(owner, Events.cc(0, 1, 127, 0), 0);          // the worst case: the mod wheel is fully up
      const slot = Instruments.noteOn(owner, note(60, 100), 0.1, 0.4);
      t.ok(slot && slot.voice, 'program ' + program + ' builds');
      t.ok(slot.voice.nodeCount <= Instruments.Voice.MAX_NODES, 'program ' + program + ' uses ' + slot.voice.nodeCount + ' nodes');
    }
    for (let key = 35; key <= 81; key += 1) {
      const slot = Instruments.noteOn(track({ id: 'd' + key, isDrums: true }), note(key, 100, { channel: 9 }), 0.1, 0.2);
      t.ok(slot && slot.voice, 'drum key ' + key + ' builds');
      t.ok(slot.voice.nodeCount <= Instruments.Voice.MAX_DRUM_NODES, 'drum key ' + key + ' uses ' + slot.voice.nodeCount + ' nodes');
    }
    t.eq(Instruments.stats().voicesBuilt, 128 + 47 + 2, 'program 102 adds its two echoes');
    t.ok(rig.engine.VoiceAllocator.stats().stolen >= 175 - 64, 'the pool stayed at its cap');
  });

  t.test('UT-06-23 range advisory: a trumpet note at pitch 30 plays and range-exceeded-56 is logged once', () => {
    makeRig();
    Core.Log.clear();
    const slot = Instruments.noteOn(track({ program: 56 }), note(30, 100), 0, 1);
    Instruments.noteOn(track({ program: 56 }), note(31, 100), 0.1, 1);
    t.ok(slot && slot.voice, 'it plays');
    const logged = Core.Log.entries().filter((entry) => String(entry.msg).includes('outside the usual range'));
    t.eq(logged.length, 1);
  });

  t.test('UT-06-24 releaseTrack: the five voices of track A are released, track B is untouched', () => {
    makeRig();
    const a = track({ id: 'A' });
    const scheduled = [60, 62, 64].map((pitch, index) => Instruments.noteOn(a, note(pitch, 100), index * 0.01, 9));
    const live = [67, 69].map((pitch) => Instruments.startLive('A', 0, false, 0, pitch, 100, 0.1));
    const other = Instruments.noteOn(track({ id: 'B' }), note(60, 100), 0, 9);
    t.eq(Instruments.releaseTrack('A', 2, 0.03), 5);
    scheduled.concat(live).forEach((slot) => t.near(slot.voice.releaseAt, 2, 1e-9));
    t.near(other.voice.releaseAt, 9, 1e-9, 'track B keeps its own release');
  });

  // ------------------------------------------------------------------------------------------- the whole path
  t.test('T04.06 the sustain pedal in a song lengthens the scheduled note (E 3.2)', () => {
    makeRig();
    const events = [Events.cc(0, 64, 127, 0), Events.note(0, BEAT, 60, 100, 0), Events.cc(2 * BEAT, 64, 0, 0)];
    const owner = track({ events, version: 1 });
    const slot = Instruments.noteOn(owner, events[1], 1, 1.5);
    t.near(slot.voice.releaseAt, 1 + 0.5 * 2, 1e-9, 'one beat of 0.5 s held for two beats by the pedal');
  });

  t.test('T04.06 program 102 echoes: three voices from one note', () => {
    const rig = makeRig();
    Instruments.noteOn(track({ program: 102 }), note(60, 100), 1, 1.5);
    t.eq(rig.engine.VoiceAllocator.activeCount(), 3);
  });

  t.test('T04.06 a hard panic empties voices and nodes; the next note sounds on the rebuilt graph', async () => {
    const rig = makeRig();
    const base = rig.engine.nodeCount();
    for (let pitch = 40; pitch < 60; pitch += 1) Instruments.noteOn(track({ program: pitch % 4 }), note(pitch, 90), 0, 3);
    t.ok(rig.engine.nodeCount() > base);
    rig.engine.panic(true, 'mode');
    t.deepEq([rig.engine.VoiceAllocator.activeCount(), Instruments.activeVoices(), rig.engine.nodeCount()],
      [0, 0, base + 4], 'voices and voice nodes are gone; the track strip remains');
    Instruments.noteOn(track(), note(60, 100), 0.1, 0.6);
    const data = (await rig.context.startRendering()).getChannelData(0);
    t.ok(peakOf(data, 0.15, 0.5) > 0.02, 'sound reaches the output after the rebuild');
  });

  t.test('T04.06 the Scheduler plays a song through Instruments: onsets on time, polyphony bounded, nodes back', async () => {
    const rig = makeRig({ seconds: 5 });
    const Model = FLM.Model;
    const song = Model.Song.create({ title: 'Instruments fixture' });
    const keys = Model.Track.create({ name: 'Keys', program: 16 }, song);
    Model.replaceEvents(keys, Array.from({ length: 4 }, (unused, index) => Events.note(index * BEAT, BEAT / 2, 60 + index,
      100)));
    Model.Song.addTrack(song, keys);
    song.durationTicks = 4 * BEAT;
    const transport = FLM.Transport.create({ clock: rig.clock, bus: rig.bus });
    transport.load(song);
    const noteOns = [];
    rig.bus.on('sched.noteOn', (event) => noteOns.push(event), t.owner);
    rig.engine.Scheduler.bind(transport, song, {});
    transport.play({ countInBars: 0 });
    while (rig.clock.now() < 2.2) {
      rig.clock.advance(TICK_S);
      rig.engine.Scheduler.tickOnce(rig.clock.now());
    }
    t.eq(noteOns.length, 4);
    const found = t.fakes.onsets(await rig.context.startRendering(), { threshold: 0.01 });
    t.eq(found.length, 4);
    found.forEach((onset, index) => t.ok(Math.abs(onset - (noteOns[index].at + LIMITER_DELAY_S)) <= QUANTUM_S + 0.004,
      'onset ' + index + ' is ' + ((onset - noteOns[index].at) * 1000).toFixed(2) + ' ms after its at'));
    transport.stop();
    rig.engine.Scheduler.unbind();
    t.eq(rig.engine.stripCount(), 0);
  });

  t.test('T04.06 a 300-note chord through the Scheduler stays within 64 voices; started + dropped = 300',
    () => {
      const rig = makeRig();
      const owner = track();
      const items = Array.from({ length: 300 }, (unused, index) => ({ kind: 'note', track: owner, atAudio: 1.05,
        endAudio: 3, event: note(36 + (index % 60), 60 + (index % 60)), trackIndex: 0 }));
      rig.engine.Scheduler.start({ update() {}, pullDue: () => items.splice(0) });
      let tick = 0;
      while (tick < 200 && (tick === 0 || rig.engine.Scheduler.stats().backlog > 0)) {
        rig.clock.set(1 + tick * TICK_S);
        rig.engine.Scheduler.tickOnce(rig.clock.now());
        tick += 1;
      }
      t.eq(rig.engine.Scheduler.stats().backlog, 0, 'the whole chord was booked');
      const counts = rig.engine.VoiceAllocator.stats();
      t.ok(counts.peakActive <= 64, 'voices peaked at ' + counts.peakActive);
      t.eq(counts.started + counts.dropped, 300);
      rig.engine.Scheduler.unbind();
      rig.engine.panic(true);
      t.eq(rig.engine.VoiceAllocator.activeCount(), 0, 'the hard panic empties the pool (stolen voices end on their own)');
    });

  // ------------------------------------------------------------------------------------------- review fixes (Phase 04 gate)
  t.test('UT-06-25 held steel guitar: the key held after the 2.5 s buffer ended never cuts the next note (regression)', () => {
    const rig = makeRig();
    const first = Instruments.startLive('g', 25, false, 0, 60, 100, 0.1);
    t.ok(first && first.voice, 'the guitar sounds');
    first.voice.dispose();                      // the 2.5 s pluck buffer ran out: onended disposed the voice, the slot is free
    const second = Instruments.startLive('g', 25, false, 0, 62, 100, 2.7);
    t.ok(second && second.voice, 'the next note takes a slot');
    t.eq(Instruments.stopLive('g', 0, 60, 3.0), false, 'the first key has nothing left to release');
    t.near(second.voice.releaseAt, 62.7, 1e-9, 'the second note is untouched: only its 60 s cap is booked');
    t.eq(Instruments.stopLive('g', 0, 62, 3.5), true);
    t.near(second.voice.releaseAt, 3.5, 1e-9, 'its own key release still works');
    t.eq(rig.engine.VoiceAllocator.releasedCount(), 1);
  });

  t.test('UT-06-26 soft panic: a voice in a 1.5 s release tail is silenced within 30 ms (regression)', async () => {
    const rig = makeRig({ seconds: 2.5 });
    const slot = Instruments.noteOn(track({ program: 48 }), note(60, 100), 0.1, 0.5);
    t.ok(slot.voice.releaseRamp >= 0.5, 'the strings have a long release: ' + slot.voice.releaseRamp);
    rig.clock.set(0.7);
    rig.engine.panic(false, 'user');
    t.ok(slot.voice.releaseAt <= 0.7 + 1e-9 && slot.voice.releaseRamp <= 0.0301, 'the release was brought forward');
    t.ok(slot.voice.stopAt <= 0.7 + 0.03 + 0.021, 'and the sources stop soon after: ' + slot.voice.stopAt);
    const data = (await rig.context.startRendering()).getChannelData(0);
    t.ok(peakOf(data, 0.5, 0.69) > 0.003, 'the tail was audible before the panic: ' + peakOf(data, 0.5, 0.69).toFixed(4));
    t.ok(peakOf(data, 0.7 + 0.03 + LIMITER_DELAY_S + 0.01, 2.4) < 0.001,
      'silent 30 ms after it: ' + peakOf(data, 0.75, 2.4).toFixed(5));
  });

  t.test('UT-06-27 real engine: a soft panic in the middle of the release tails empties the pool within 350 ms', async () => {
    const engine = Audio.init();
    await Audio.unlock();
    Instruments.attach(engine);
    const wait = (ms) => new Promise((resolve) => Core.timers.setTimeout(resolve, ms, t.owner));
    try {
      const begin = engine.now() + 0.01;
      const slots = [0, 1, 2, 3].map((index) => Instruments.noteOn(track({ id: 'tail' + index, program: 94 }), note(60 + index, 100),
        begin, begin + 0.05));
      t.ok(slots.every((slot) => slot && slot.voice), 'four voices');
      while (engine.now() < begin + 0.2) await wait(10);               // the notes have started and their release began 150 ms ago
      t.ok(slots.every((slot) => slot.voice.releaseAt < engine.now() && slot.voice.stopAt > engine.now() + 0.8),
        'every voice is in the middle of a release tail of more than 0.8 s: ' + slots.map((slot) => slot.voice.releaseRamp));
      t.eq(engine.VoiceAllocator.activeCount(), 4, 'all four still hold their slot');
      engine.panic(false, 'mode');
      const started = Core.now();
      while (engine.VoiceAllocator.activeCount() > 0 && Core.now() - started < 350) await wait(10);
      t.eq(engine.VoiceAllocator.activeCount(), 0, 'no voice left after ' + Math.round(Core.now() - started) + ' ms');
    } finally {
      engine.panic(true, 'rebuild');
      for (let index = 0; index < 4; index += 1) engine.disposeStrip('tail' + index);
    }
  });

  t.test('UT-06-28 fallback chain: a failing definition plays the family template, then the basic voice; no recovery', () => {
    const rig = makeRig();
    Core.ErrorReporter._resetForTests();
    let panics = 0;
    rig.bus.on('audio.panic', () => { panics += 1; }, t.owner);
    try {
      const normal = Instruments.noteOn(track({ id: 'a', program: 40 }), note(60, 100), 0, 1);
      Core.Faults.set('audio.fail', { phase: 'definition', count: 1 });
      const family = Instruments.noteOn(track({ id: 'b', program: 41 }), note(60, 100), 0.1, 1);
      Core.Faults.set('audio.fail', { phase: 'definition', count: 2 });
      const basic = Instruments.noteOn(track({ id: 'c', program: 42 }), note(60, 100), 0.2, 1);
      t.ok(normal.voice && family.voice && basic.voice, 'every note sounds');
      t.ok(basic.voice.nodeCount < family.voice.nodeCount, 'the basic voice is the plainest: ' + basic.voice.nodeCount + ' < ' +
        family.voice.nodeCount);
      const again = Instruments.noteOn(track({ id: 'd', program: 42 }), note(62, 100), 0.3, 1);
      t.eq(again.voice.nodeCount, basic.voice.nodeCount, 'the program remembers the working fallback');
      t.eq(Core.ErrorReporter.records().filter((item) => item.code === 'E-AUD-004').length, 0, 'no audio error is filed');
      t.eq(panics, 0, 'and the graph is not rebuilt');
      t.eq(rig.engine.VoiceAllocator.stats().dropped, 0);
    } finally {
      Core.Faults.clearAll();
      Core.ErrorReporter._resetForTests();
    }
  });

  t.test('UT-06-29 pluck buffers: one buffer per program and pitch whatever the layer; the end fades; warmupSong fills the cache',
    async () => {
      makeRig({ seconds: 1 });
      const low = Instruments.pluckBuffer(25, 60, 0);
      t.ok(low === Instruments.pluckBuffer(25, 60, 2), 'the layer is not part of the key');
      const data = low.getChannelData(0);
      t.eq(data[data.length - 1], 0, 'the last sample is silent: no click when the buffer runs out');
      const peakWindow = (from, to) => data.slice(data.length - from, data.length - to).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      t.ok(peakWindow(48, 0) < 0.1 * peakWindow(2000, 1500), 'the last millisecond is a tenth of the level before the fade');
      const song = FLM.Model.Song.create({ title: 'Pluck' });
      const owner = FLM.Model.Track.create({ name: 'guitar', program: 25 }, song);
      FLM.Model.replaceEvents(owner, [62, 64, 62].map((pitch, index) => Events.note(index * BEAT, BEAT, pitch, 90)));
      FLM.Model.Song.addTrack(song, owner);
      Instruments.configurePluckCache(48, true);
      await Instruments.warmupSong(song);
      t.eq(Instruments.stats().pluckCacheEntries, 2, 'two distinct pitches were made before play');
    });

  t.test('UT-06-30 tremolo: it follows the envelope, so the sound ends with the release (regression)', async () => {
    const rig = makeRig({ seconds: 2.5 });
    const slot = Instruments.noteOn(track({ program: 44 }), note(60, 100), 0.1, 0.4);
    t.ok(slot.voice.nodeCount <= Instruments.Voice.MAX_NODES, 'tremolo strings use ' + slot.voice.nodeCount + ' nodes');
    const releaseEnd = 0.4 + slot.voice.releaseRamp + LIMITER_DELAY_S + 0.05;     // read before the render frees the voice
    const data = (await rig.context.startRendering()).getChannelData(0);
    t.ok(peakOf(data, 0.15, 0.4) > 0.003, 'it sounds');
    t.ok(peakOf(data, releaseEnd, 2.4) < 0.0005, 'silent after the release: ' + peakOf(data, releaseEnd, 2.4).toFixed(5));
  });

  t.test('UT-06-31 vibrato follows the track (D80): a track with CC 1 events has the vibrato from the first note', () => {
    makeRig();
    const plain = Instruments.noteOn(track({ id: 'plain', program: 0 }), note(60, 100), 0, 1);
    const wheel = track({ id: 'wheel', program: 0, version: 1, events: [Events.cc(1920, 1, 100, 0)] });
    const early = Instruments.noteOn(wheel, note(60, 100), 0, 1);
    t.eq(early.voice.nodeCount, plain.voice.nodeCount + 1, 'the depth gain exists before the wheel moves; the LFO is the channel\'s');
  });

  t.test('UT-06-33 the steal priority of a note follows the program timeline of its channel', () => {
    makeRig();
    const owner = track({ id: 'timeline', program: 0 });
    const early = note(60, 100);
    Instruments.noteOn(owner, early, 0, 0.1);
    Instruments.control(owner, Events.program(0, 33, 0, 0, 0), 1.0);        // from 1.0 s the channel plays the bass
    t.eq(Instruments.priorityOf(owner, early, 0.5), 1, 'a piano note is melody');
    t.eq(Instruments.priorityOf(owner, early, 2.0), 2, 'after the program change the same channel is bass');
    t.eq(Instruments.priorityOf(track({ isDrums: true }), early, 0.5), 2, 'drums are always 2');
  });

  t.test('UT-06-34 a drum voice stops its sources after they started: no warning, and the end is booked (regression)', async () => {
    const rig = makeRig({ seconds: 3 });
    Core.Log.clear();
    const slot = Instruments.noteOn(track({ isDrums: true }), note(49, 100, { channel: 9 }), 0.1, 0.2);     // a crash: noise and metal partials
    t.ok(slot && slot.voice, 'the crash sounds');
    const failures = Core.Log.entries().filter((entry) => String(entry.msg).includes('stopping a source failed'));
    t.eq(failures.length, 0, 'no source was stopped before it was started');
    t.ok(slot.voice.stopAt > 0.1 + 0.5, 'the end of the sources is booked: ' + slot.voice.stopAt);
    const data = (await rig.context.startRendering()).getChannelData(0);
    t.ok(peakOf(data, 0.15, 0.5) > 0.005, 'and it sounds');
  });

  t.test('UT-06-32 a voice lives until its last source ends: the oscillator of program 99 sounds after the pluck buffer ran out (regression)',
    async () => {
      const rig = makeRig({ seconds: 4.5 });
      const slot = Instruments.noteOn(track({ program: 99 }), note(60, 100), 0.1, 4);
      t.ok(slot.voice.nodeCount >= 4, 'a pluck buffer and an oscillator: ' + slot.voice.nodeCount + ' nodes');
      const data = (await rig.context.startRendering()).getChannelData(0);
      t.ok(peakOf(data, 0.2, 0.6) > 0.003, 'it sounds at the start: ' + peakOf(data, 0.2, 0.6).toFixed(4));
      t.ok(peakOf(data, 3.0, 3.9) > 0.001, 'and after the 2.5 s buffer ended: ' + peakOf(data, 3.0, 3.9).toFixed(4));
    });
});
})();
