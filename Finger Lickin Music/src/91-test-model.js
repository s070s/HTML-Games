// 91-test-model.js - unit tests for M-03 FLM.Model (group 'model'; test build only).
// UT-03-01 to UT-03-27 follow Part 6.3.8; UT-03-28 to UT-03-32 are extra checks for T02.02 and T02.03.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('model', (t) => {
  const Model = FLM.Model;
  const Events = Model.Events;
  const Prng = FLM.Core.Prng;
  const PPQ = 960;
  const BAR_4_4 = 3840;
  const BIG_NOTE_COUNT = 100000;
  const RANDOM_EVENT_COUNT = 1000;
  const SEED = 12345;
  const FOUR_THEN_THREE = [{ tick: 0, numerator: 4, denominator: 4 },
    { tick: BAR_4_4, numerator: 3, denominator: 4 }];

  function newTrack(song) {
    return Model.Track.create({}, song || Model.Song.create());
  }

  function randomEvent(random) {
    const tick = random.int(20000);
    const channel = random.int(4);
    switch (random.int(5)) {
      case 0: return Events.program(tick, random.int(128), 0, 0, channel);
      case 1: return Events.cc(tick, random.int(128), random.int(128), channel);
      case 2: return Events.bend(tick, random.int(100) - 50, channel);
      case 3: return Events.text(tick, 'text', 'x');
      default: return Events.note(tick, 1 + random.int(500), random.int(128), 1 + random.int(127), channel);
    }
  }

  function raw(tick, type, pitch, velocity, channel) {
    return { tick, type, pitch, velocity, channel: channel || 0, order: 0 };
  }

  function codes(warnings) {
    return warnings.map((warning) => warning.code);
  }

  t.test('UT-03-01 Song.create defaults', () => {
    const song = Model.Song.create({ title: 'x' });
    t.eq(song.title, 'x');
    t.eq(song.ppq, PPQ);
    t.deepEq(song.tempoMap.toJSON(), [{ tick: 0, usPerQuarter: 500000 }]);
    t.deepEq(song.meterMap.toJSON(), [{ tick: 0, numerator: 4, denominator: 4 }]);
    t.deepEq(song.keyMap.toJSON(), [{ tick: 0, fifths: 0, mode: 'major' }]);
    t.eq(song.durationTicks, 0);
    t.eq(typeof song.id, 'string');
    t.eq(Model.Song.create({ title: '  ' }).title, 'Untitled');
  });

  t.test('UT-03-02 Track.create defaults and colors', () => {
    const song = Model.Song.create();
    const tracks = [0, 1, 2].map(() => Model.Song.addTrack(song, Model.Track.create({}, song)));
    tracks.forEach((track) => {
      t.deepEq(track.mix, { gain: 1, pan: 0, mute: false, solo: false });
      t.eq(track.lockedSource, true);
      t.ok(Model.TRACK_COLORS.includes(track.color));
    });
    t.eq(new Set(tracks.map((track) => track.color)).size, 3);
    t.eq(tracks[0].name, 'Track 1 (Acoustic Grand Piano)');
    t.eq(Model.TRACK_COLORS.length, 16);
    t.eq(JSON.stringify(tracks[0]).includes('version'), false);
  });

  t.test('UT-03-03 32-track limit', () => {
    const song = Model.Song.create();
    for (let index = 0; index < 32; index += 1) Model.Song.addTrack(song, Model.Track.create({}, song));
    t.throws(() => Model.Song.addTrack(song, Model.Track.create({}, song)), 'E-MDL-010');
    t.eq(song.tracks.length, 32);
  });

  t.test('UT-03-04 compare ordering', () => {
    const events = [
      Events.text(0, 'text', 'a'),
      Events.note(0, 10, 64, 90, 1, { id: 'b' }),
      Events.note(0, 10, 60, 90, 1, { id: 'z' }),
      Events.note(0, 10, 60, 90, 1, { id: 'a' }),
      Events.note(0, 10, 72, 90, 0, { id: 'c' }),
      Events.bend(0, 5, 0),
      Events.cc(0, 7, 100, 0),
      Events.program(0, 5, 0, 0, 0)
    ];
    Model.sortEvents(events);
    t.deepEq(events.map((event) => event.kind), ['program', 'cc', 'bend', 'note', 'note', 'note', 'note', 'text']);
    t.deepEq(events.filter((event) => event.kind === 'note').map((event) => event.id), ['c', 'a', 'z', 'b']);
    t.ok(Model.compareEvents(Events.note(0, 1, 60, 1, 0), Events.note(1, 1, 60, 1, 0)) < 0);
  });

  t.test('UT-03-05 insertEvent keeps order', () => {
    const track = newTrack();
    const random = new Prng(SEED);
    for (let index = 0; index < RANDOM_EVENT_COUNT; index += 1) {
      Model.insertEvent(track, randomEvent(random));
      if (index % 100 === 0) t.ok(Model.isSorted(track.events));
    }
    t.ok(Model.isSorted(track.events));
    t.eq(track.events.length, RANDOM_EVENT_COUNT);
    t.eq(track.version, RANDOM_EVENT_COUNT);
    const ids = track.events.filter((event) => event.kind === 'note').map((event) => event.id);
    t.eq(new Set(ids).size, ids.length);
    t.ok(ids[0].startsWith(track.id + '.'));
  });

  t.test('UT-03-06 insertEvents bulk', () => {
    const track = newTrack();
    const random = new Prng(SEED);
    const notes = [];
    for (let index = 0; index < BIG_NOTE_COUNT; index += 1) {
      notes.push(Events.note(random.int(1000000), 1 + random.int(960), random.int(128), 100, 0));
    }
    Model.insertEvents(track, notes);
    t.eq(track.events.length, BIG_NOTE_COUNT);
    t.ok(Model.isSorted(track.events));
    Model.insertEvents(track, [Events.cc(5, 7, 100, 0)]);
    t.ok(Model.isSorted(track.events));
    t.eq(track.events.length, BIG_NOTE_COUNT + 1);
  });

  t.test('UT-03-07 removeEvent by id and object', () => {
    const track = newTrack();
    const events = [];
    for (let index = 0; index < 10; index += 1) events.push(Events.note(index * 100, 50, 60 + index, 90, 0));
    Model.insertEvents(track, events);
    const byObject = track.events[3];
    const byId = track.events[5].id;
    t.eq(Model.removeEvent(track, byObject), true);
    t.eq(Model.removeEvent(track, byId), true);
    t.eq(Model.removeEvent(track, 'unknown'), false);
    t.eq(Model.removeEvent(track, Events.cc(0, 1, 1, 0)), false);
    t.eq(track.events.length, 8);
    t.ok(Model.isSorted(track.events));
    t.eq(Model.removeEvents(track, (event) => event.pitch > 65), 4);
    t.eq(track.events.length, 4);
  });

  t.test('UT-03-08 pairNotes unmatched on', () => {
    const result = Model.pairNotes([raw(0, 'on', 60, 100)], { trackEndTick: 3840 });
    t.eq(result.notes.length, 1);
    t.eq(result.notes[0].durTicks, 3840);
    t.deepEq(codes(result.warnings), ['W-NOTE-UNMATCHED']);
  });

  t.test('UT-03-09 pairNotes off before on', () => {
    const result = Model.pairNotes([raw(10, 'off', 60, 0), raw(20, 'on', 60, 100), raw(30, 'off', 60, 0)]);
    t.eq(result.notes.length, 1);
    t.eq(result.notes[0].tick, 20);
    t.eq(result.notes[0].durTicks, 10);
    t.deepEq(codes(result.warnings), ['W-NOTE-OFF-WITHOUT-ON']);
  });

  t.test('UT-03-10 pairNotes velocity 0 as off', () => {
    const result = Model.pairNotes([raw(0, 'on', 60, 100), raw(480, 'on', 60, 0)]);
    t.eq(result.notes.length, 1);
    t.eq(result.notes[0].durTicks, 480);
    t.eq(result.notes[0].offVelocity, 0);
    t.eq(result.warnings.length, 0);
  });

  t.test('UT-03-11 pairNotes same-pitch overlap', () => {
    const result = Model.pairNotes([raw(0, 'on', 60, 100), raw(240, 'on', 60, 100), raw(480, 'off', 60, 0),
      raw(600, 'off', 60, 0)]);
    t.deepEq(result.notes.map((note) => [note.tick, note.durTicks]), [[0, 240], [240, 240]]);
    t.ok(codes(result.warnings).includes('W-NOTE-OVERLAP'));
  });

  t.test('UT-03-12 pairNotes zero duration', () => {
    const result = Model.pairNotes([raw(100, 'on', 60, 100), raw(100, 'off', 60, 0)]);
    t.eq(result.notes.length, 1);
    t.eq(result.notes[0].durTicks, 1);
    t.deepEq(codes(result.warnings), ['W-NOTE-ZERO-DURATION']);
  });

  t.test('UT-03-13 pairNotes channels independent', () => {
    const result = Model.pairNotes([raw(0, 'on', 60, 100, 0), raw(0, 'on', 60, 100, 1), raw(480, 'off', 60, 0, 0),
      raw(480, 'off', 60, 0, 1)]);
    t.eq(result.notes.length, 2);
    t.deepEq(result.notes.map((note) => note.channel), [0, 1]);
    t.eq(result.warnings.length, 0);
  });

  t.test('UT-03-14 deriveSustain extends', () => {
    const track = newTrack();
    Model.insertEvents(track, [Events.note(0, 480, 60, 100, 0), Events.cc(0, 64, 127, 0), Events.cc(1920, 64, 0, 0)]);
    const derived = Model.deriveSustain(track);
    t.eq(derived.length, 1);
    t.eq(derived[0].effectiveDurTicks, 1920);
    t.eq(derived[0].extendedBySustain, true);
    t.eq(track.events.find((event) => event.kind === 'note').durTicks, 480);
    // A pedal that is never released extends to the end of the track.
    const open = newTrack();
    Model.insertEvents(open, [Events.note(0, 480, 60, 100, 0), Events.cc(0, 64, 127, 0),
      Events.note(4000, 100, 72, 90, 0)]);
    t.eq(Model.deriveSustain(open)[0].effectiveDurTicks, 4100);
  });

  t.test('UT-03-15 deriveSustain retrigger cap', () => {
    const track = newTrack();
    Model.insertEvents(track, [Events.note(0, 480, 60, 100, 0), Events.note(960, 480, 60, 100, 0),
      Events.cc(0, 64, 127, 0), Events.cc(5000, 64, 0, 0)]);
    const derived = Model.deriveSustain(track);
    t.eq(derived[0].effectiveDurTicks, 960);
    t.eq(derived[1].effectiveDurTicks, 4040);
  });

  t.test('UT-03-16 TempoMap conversions', () => {
    const map = new Model.TempoMap([{ tick: 0, usPerQuarter: 500000 }, { tick: 1920, usPerQuarter: 1000000 }]);
    t.near(map.ticksToSeconds(1920), 1.0, 1e-12);
    t.near(map.ticksToSeconds(3840), 3.0, 1e-12);
    t.near(map.secondsToTicks(2.0), 2880, 1e-9);
    t.near(map.ticksToSeconds(-960), -0.5, 1e-12);
    t.near(map.secondsToTicks(-0.5), -960, 1e-9);
    t.eq(map.tempoAt(2000).bpm, 60);
    t.eq(Model.TempoMap.fromBpm(120).entries[0].usPerQuarter, 500000);
  });

  t.test('UT-03-17 TempoMap implicit start and last-wins', () => {
    const late = new Model.TempoMap([{ tick: 960, usPerQuarter: 400000 }]);
    t.deepEq(late.toJSON(), [{ tick: 0, usPerQuarter: 500000 }, { tick: 960, usPerQuarter: 400000 }]);
    t.deepEq(codes(late.warnings), ['W-TEMPO-IMPLICIT-START']);
    const duplicate = new Model.TempoMap([{ tick: 0, usPerQuarter: 500000 }, { tick: 960, usPerQuarter: 400000 },
      { tick: 960, usPerQuarter: 300000 }]);
    t.eq(duplicate.entries.length, 2);
    t.eq(duplicate.entries[1].usPerQuarter, 300000);
    duplicate.set(960, 250000);
    t.eq(duplicate.entries.length, 2);
    t.eq(duplicate.entries[1].usPerQuarter, 250000);
    t.eq(duplicate.remove(0), false);
    t.eq(duplicate.remove(960), true);
    t.eq(new Model.TempoMap().warnings.length, 0);
  });

  t.test('UT-03-18 TempoMap precision', () => {
    const slow = Model.TempoMap.fromBpm(30);
    const lastTick = 24 * 3600 * 2 * PPQ;
    const random = new Prng(SEED);
    for (let step = 0; step < 1000; step += 1) {
      const tick = random.int(lastTick);
      t.near(slow.secondsToTicks(slow.ticksToSeconds(tick)), tick, 1e-6);
    }
    t.near(slow.secondsToTicks(slow.ticksToSeconds(lastTick)), lastTick, 1e-6);
  });

  t.test('UT-03-19 MeterMap bars and beats', () => {
    const map = new Model.MeterMap(FOUR_THEN_THREE);
    t.eq(map.barAt(3839), 0);
    t.eq(map.barAt(3840), 1);
    t.eq(map.barAt(6720), 2);
    t.deepEq(map.beatAt(480), { bar: 0, beat: 0, frac: 0.5 });
    t.eq(map.tickOfBar(2), 6720);
    t.eq(map.barAt(-1), -1);
    t.eq(map.tickOfBeat(1, 2), 3840 + 1920);
    t.eq(map.meterAt(4000).ticksPerBar, 2880);
    t.eq(map.barCount(6721), 3);
    t.deepEq(map.subdivisionTicks(1, 2), [3840, 4320, 4800, 5280, 5760, 6240]);
  });

  t.test('UT-03-20 validate catches unsorted', () => {
    const song = Model.Song.create();
    const track = newTrack(song);
    track.events.push(Events.note(100, 10, 60, 90, 0, { id: 'a' }), Events.note(50, 10, 62, 90, 0, { id: 'b' }));
    Model.Song.addTrack(song, track);
    const result = Model.validate(song);
    t.eq(result.ok, false);
    t.ok(result.errors.some((error) => error.code === 'E-MDL-004'));
  });

  t.test('UT-03-21 validate limits', () => {
    const song = Model.Song.create();
    song.tracks.push({ id: 't1', events: { length: 1000001 } });
    const result = Model.validate(song);
    t.eq(result.ok, false);
    t.deepEq(result.errors.map((error) => error.code), ['E-MDL-011']);
    const bad = Model.Song.create();
    bad.tracks.push(Model.Track.create({ id: 'tb', events: [Events.note(0, 0, 200, 0, 20, { id: 'n' })] }, bad));
    t.ok(Model.validate(bad).errors.some((error) => error.code === 'E-MDL-005'));
    const control = Model.Song.create();
    control.tracks.push(Model.Track.create({ id: 'tc', events: [Events.cc(0, 200, 0, 0)] }, control));
    t.ok(Model.validate(control).errors.some((error) => error.code === 'E-MDL-006'));
  });

  t.test('UT-03-22 fromJSON rejects bad shapes', () => {
    t.throws(() => Model.Song.fromJSON({}), 'E-MDL-');
    t.throws(() => Model.Song.fromJSON(null), 'E-MDL-');
    const song = Model.Song.create({ title: 'Round trip' });
    const track = Model.Track.create({ name: 'Lead' }, song);
    Model.Song.addTrack(song, track);
    Model.insertEvents(track, [Events.note(0, 480, 60, 100, 0), Events.cc(0, 7, 100, 0), Events.text(0, 'text', 'hi')]);
    Model.Song.computeDuration(song);
    const json = Model.Song.toJSON(song);
    const badTempo = Object.assign({}, json, { tempoMap: [{ tick: 0, usPerQuarter: 0 }] });
    t.throws(() => Model.Song.fromJSON(badTempo), 'E-MDL-007');
    t.throws(() => Model.Song.fromJSON(Object.assign({}, json, { tracks: 'none' })), 'E-MDL-');
    t.throws(() => Model.Song.fromJSON(Object.assign({}, json, { ppq: 480 })), 'E-MDL-001');
    t.deepEq(Model.Song.toJSON(Model.Song.fromJSON(json)), json);
  });

  t.test('UT-03-23 computeDuration uses last event end', () => {
    const song = Model.Song.create();
    const track = newTrack(song);
    Model.Song.addTrack(song, track);
    Model.insertEvents(track, [Events.note(0, 480, 60, 100, 0), Events.cc(10000, 7, 100, 0)]);
    t.eq(Model.Song.computeDuration(song), 10000);
    t.eq(song.durationTicks, 10000);
    const other = Model.Song.create();
    const longNote = newTrack(other);
    Model.Song.addTrack(other, longNote);
    Model.insertEvent(longNote, Events.note(9000, 2000, 60, 100, 0));
    t.eq(Model.durationTicks(other), 11000);
    other.markers.push(Model.Marker.create(12000, 'End', 'cue'));
    t.eq(Model.Song.computeDuration(other), 12000);
  });

  t.test('UT-03-24 TrackIndex queries', () => {
    const track = newTrack();
    const random = new Prng(SEED);
    const notes = [];
    for (let index = 0; index < RANDOM_EVENT_COUNT; index += 1) {
      notes.push(Events.note(random.int(20000), 1 + random.int(3000), random.int(128), 100, 0));
    }
    Model.insertEvents(track, notes);
    const index = Model.indexFor(track);
    const all = track.events;
    [0, 1, 5000, 10000, 19999, 25000].forEach((tick) => {
      t.eq(index.firstAtOrAfter(tick), all.findIndex((event) => event.tick >= tick) < 0 ? all.length
        : all.findIndex((event) => event.tick >= tick), 'firstAtOrAfter ' + tick);
      t.deepEq(index.notesBetween(tick, tick + 700).map((note) => note.id),
        all.filter((event) => event.tick >= tick && event.tick < tick + 700).map((note) => note.id));
      t.deepEq(index.activeAt(tick).map((note) => note.id),
        all.filter((event) => event.tick <= tick && tick < event.tick + event.durTicks).map((note) => note.id));
      t.eq(index.eventsAtOrAfter(tick), all.findIndex((event) => event.tick >= tick) < 0 ? all.length
        : all.findIndex((event) => event.tick >= tick));
    });
    let brute = 0;
    all.forEach((note) => {
      const sounding = all.filter((other) => other.tick <= note.tick && note.tick < other.tick + other.durTicks).length;
      brute = Math.max(brute, sounding);
    });
    t.eq(index.maxPolyphony(), brute);
    const pitches = all.map((note) => note.pitch);
    t.deepEq(index.pitchRange(), { lo: Math.min.apply(null, pitches), hi: Math.max.apply(null, pitches) });
    t.eq(Model.indexFor(newTrack()).pitchRange(), null);
  });

  t.test('UT-03-25 indexFor cache invalidation', () => {
    const track = newTrack();
    Model.insertEvent(track, Events.note(0, 100, 60, 100, 0));
    const first = Model.indexFor(track);
    t.eq(Model.indexFor(track), first);
    Model.insertEvent(track, Events.note(200, 100, 62, 100, 0));
    const second = Model.indexFor(track);
    t.ok(second !== first);
    t.eq(second.notes.length, 2);
    t.eq(first.refresh().notes.length, 2);
  });

  t.test('UT-03-26 KeyMap keyAt', () => {
    const map = new Model.KeyMap([{ tick: 0, fifths: 0, mode: 'major' }, { tick: 1920, fifths: 1, mode: 'major' }]);
    t.eq(map.keyAt(1919).fifths, 0);
    t.eq(map.keyAt(1920).fifths, 1);
    t.eq(map.keyAt(1920).tick, 1920);
    t.deepEq(new Model.KeyMap([]).keyAt(500), { fifths: 0, mode: 'major', tick: 0 });
    t.throws(() => new Model.KeyMap([{ tick: 0, fifths: 9, mode: 'major' }]), 'E-MDL-009');
  });

  t.test('UT-03-27 Song.clone independence', () => {
    const song = Model.Song.create({ title: 'Original' });
    const track = newTrack(song);
    Model.Song.addTrack(song, track);
    Model.insertEvent(track, Events.note(0, 480, 60, 100, 0));
    const copy = Model.Song.clone(song);
    t.eq(copy.tracks[0].events[0].id, track.events[0].id);
    copy.title = 'Changed';
    copy.tracks[0].events[0].pitch = 99;
    copy.tracks[0].mix.gain = 0.5;
    copy.tempoMap.set(960, 400000);
    Model.insertEvent(copy.tracks[0], Events.note(10, 10, 61, 100, 0));
    t.eq(song.title, 'Original');
    t.eq(track.events[0].pitch, 60);
    t.eq(track.mix.gain, 1);
    t.eq(song.tempoMap.entries.length, 1);
    t.eq(track.events.length, 1);
    t.eq(copy.tracks[0].version, track.version + 1);
  });

  t.test('UT-03-28 rescaleTicks rounds once on the absolute tick', () => {
    t.eq(Model.rescaleTicks(480, 480), 960);
    t.eq(Model.rescaleTicks(1, 480), 2);
    t.eq(Model.rescaleTicks(1, 96), 10);
    t.eq(Model.rescaleTicks(1, 7), 137);
    t.eq(Model.rescaleTicks(0, 960), 0);
    t.throws(() => Model.rescaleTicks(10, 0), 'E-MDL-001');
  });

  t.test('UT-03-29 position formatting', () => {
    const map = new Model.MeterMap(FOUR_THEN_THREE);
    t.eq(Model.formatBarBeat(map, 0), '1.1');
    t.eq(Model.formatBarBeat(map, 5760), '2.3');
    t.eq(Model.formatBarBeatTick(map, 5760 + 45), '2.3.045');
    t.eq(Model.formatBarBeatTick(map, -960), '-1.4.000');
  });

  t.test('UT-03-30 pairNotes same-tick on and off follow decision D10', () => {
    const result = Model.pairNotes([raw(0, 'on', 60, 100), raw(480, 'on', 60, 100), raw(480, 'off', 60, 0),
      raw(960, 'off', 60, 0)]);
    t.deepEq(result.notes.map((note) => [note.tick, note.durTicks]), [[0, 480], [480, 480]]);
    t.eq(result.warnings.length, 0);
    const clamp = Model.pairNotes([raw(0, 'on', 60, 200), raw(10, 'off', 60, 0), raw(0, 'on', 300, 90)]);
    t.eq(clamp.notes[0].velocity, 127);
    t.deepEq(codes(clamp.warnings).sort(), ['W-NOTE-PITCH-RANGE', 'W-NOTE-VELOCITY-CLAMP']);
    const repeated = Model.pairNotes([raw(5, 'off', 60, 0), raw(6, 'off', 60, 0)]);
    t.eq(repeated.warnings.length, 1);
    t.eq(repeated.warnings[0].count, 2);
  });

  t.test('UT-03-31 tempo round trip across 100 tempo changes (AT-R-E2.2-04)', () => {
    const entries = [];
    for (let index = 0; index < 100; index += 1) {
      entries.push({ tick: index * 9600, usPerQuarter: 200000 + index * 7919 });
    }
    const map = new Model.TempoMap(entries);
    const random = new Prng(SEED);
    for (let step = 0; step < 10000; step += 1) {
      const tick = random.int(100 * 9600 + 50000);
      t.near(map.secondsToTicks(map.ticksToSeconds(tick)), tick, 1e-6);
      const seconds = random.range(0, map.ticksToSeconds(1000000));
      t.near(map.ticksToSeconds(map.secondsToTicks(seconds)), seconds, 1e-9);
    }
  });

  t.test('UT-03-32 meter change inside a bar starts a new bar', () => {
    const map = new Model.MeterMap([{ tick: 0, numerator: 4, denominator: 4 },
      { tick: 5000, numerator: 6, denominator: 8 }]);
    t.eq(map.barAt(4999), 1);
    t.eq(map.barAt(5000), 2);
    t.eq(map.tickOfBar(2), 5000);
    t.eq(map.barLengthTicks(1), 1160);
    t.eq(map.meterAt(5000).ticksPerBeat, 480);
    t.eq(map.positionAt(5480).beat, 1);
    t.near(map.totalBeatsAt(5480), 5000 / 960 + 1, 1e-9);
  });
});
})();
