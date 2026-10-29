// 91-test-content.js - unit tests for M-30 FLM.Content and the Project.Catalog subset (group 'content'; test build only).
// T04.10 delivers UT-30-01 to UT-30-11, UT-30-14, and UT-30-12 / UT-30-13 in their structural form (UT-30-12 completes with
// Character.validate in Phase 10, UT-30-13 with the Phase 08 chart checks). The counts below are the table of Part 6.30.4.6.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('content', (t) => {
  const Content = FLM.Content;
  const Model = FLM.Model;
  const Catalog = FLM.Project.Catalog;
  const DEMO_IDS = ['demo-poprock', 'demo-piano', 'demo-electro', 'demo-jazz', 'demo-dance'];
  const DURATIONS = [96.0, 102.47, 96.0, 96.0, 112.5];
  const COUNTS = { 'demo-poprock': [687, 340, 624, 100, 192], 'demo-piano': [253],
    'demo-electro': [562, 132, 480, 78, 66], 'demo-jazz': [923, 240, 730], 'demo-dance': [645, 384, 120, 90, 96],
    'tut-basics': [44, 192] };
  const TOTAL_DEMO_NOTES = 6742;
  const BAR = 3840;
  const songs = new Map();

  function songOf(id) {
    if (!songs.has(id)) songs.set(id, Content.expand(id));
    return songs.get(id);
  }

  const eventsOf = (song, trackIndex, kind) => song.tracks[trackIndex].events.filter((event) => event.kind === kind);

  t.test('UT-30-01 expansion determinism: the same arrangement always gives the same Song, ids included', () => {
    DEMO_IDS.concat(['tut-basics']).forEach((id) => {
      const first = Content.expand(id);
      const second = Content.expand(id);
      t.eq(JSON.stringify(first), JSON.stringify(second), id);
      t.eq(first.createdAt, Content.NOTATION.CREATED_AT);
      t.eq(first.id, id);
      t.ok(first.tracks.every((track) => track.id === 't' + (first.tracks.indexOf(track) + 1)), 'track ids t1, t2, ...');
    });
  });

  t.test('UT-30-02 durations: 96.0, 102.47, 96.0, 96.0, 112.5 and 38.4 seconds; every demo lasts 60 to 120 s', () => {
    DEMO_IDS.forEach((id, index) => {
      const song = songOf(id);
      const seconds = song.tempoMap.ticksToSeconds(song.durationTicks);
      t.near(seconds, DURATIONS[index], 0.01, id);
      t.ok(seconds >= 60 && seconds <= 120, id + ' is within 60 to 120 s');
    });
    t.near(songOf('tut-basics').tempoMap.ticksToSeconds(songOf('tut-basics').durationTicks), 38.4, 0.01);
  });

  t.test('UT-30-03 note counts: per track and in total, 6,742 for the demos', () => {
    let total = 0;
    Object.keys(COUNTS).forEach((id) => {
      const info = Content.stats(songOf(id));
      t.deepEq(songOf(id).tracks.map((track) => info.perTrack[track.id]), COUNTS[id], id);
      if (id !== 'tut-basics') total += info.notes;
    });
    t.eq(total, TOTAL_DEMO_NOTES);
  });

  t.test('UT-30-04 tempo and meter changes: demo-piano slows at bars 29 to 32, demo-jazz alternates 4/4 and 3/4', () => {
    const piano = songOf('demo-piano');
    const bpm = piano.tempoMap.entries.map((entry) => Math.round(60e6 / entry.usPerQuarter));
    t.deepEq(bpm, [76, 73, 70, 67, 64]);
    t.deepEq(piano.tempoMap.entries.slice(1).map((entry) => entry.tick / BAR + 1), [29, 30, 31, 32]);
    const jazz = songOf('demo-jazz');
    const bars = jazz.meterMap.entries.map((entry) => [entry.numerator + '/' + entry.denominator]);
    t.deepEq(bars, [['4/4'], ['3/4'], ['4/4'], ['3/4'], ['4/4']]);
    t.deepEq(jazz.meterMap.entries.slice(1).map((entry) => entry.tick), [61440, 84480, 176640, 199680],
      'entries at bars 17, 25, 49 and 57');
  });

  t.test('UT-30-05 pitch ranges: every melodic note is inside the range of its program', () => {
    DEMO_IDS.forEach((id) => {
      const song = songOf(id);
      const info = Content.stats(song);
      song.tracks.forEach((track) => {
        if (track.isDrums) return;
        const range = FLM.Instruments.definition(track.program).range;
        t.ok(info.ranges[track.id].lo >= range[0] && info.ranges[track.id].hi <= range[1],
          id + ' ' + track.name + ' ' + JSON.stringify(info.ranges[track.id]) + ' in ' + JSON.stringify(range));
      });
    });
    const pitches = eventsOf(songOf('demo-piano'), 0, 'note').map((event) => event.pitch);
    t.deepEq([pitches.filter((pitch) => pitch >= 60).length, pitches.filter((pitch) => pitch < 60).length], [77, 176],
      'right hand 77 notes from C4 up, left hand 176 below');
  });

  t.test('UT-30-06 drum voice coverage: all 12 voices of the kit occur in the five demos', () => {
    const used = new Set();
    DEMO_IDS.forEach((id) => songOf(id).tracks.filter((track) => track.isDrums).forEach((track) => {
      eventsOf(songOf(id), songOf(id).tracks.indexOf(track), 'note').forEach((event) => {
        used.add(FLM.Instruments.drumVoiceFor(event.pitch).index);
      });
    }));
    t.eq(used.size, 12, 'voices used: ' + Array.from(used).sort((a, b) => a - b).join(' '));
  });

  t.test('UT-30-07 swing and ties: jazz off-beats start at 640; the tied G4 of demo-piano bar 4 is 2861 ticks', () => {
    const jazz = eventsOf(songOf('demo-jazz'), 0, 'note');
    t.ok(jazz.some((event) => event.tick % 960 === 640), 'swung eighths sit on the triplet grid');
    t.ok(!jazz.some((event) => event.tick % 960 === 480), 'no straight off-beat eighth is left');
    const piano = eventsOf(songOf('demo-piano'), 0, 'note');
    const tied = piano.filter((event) => event.pitch === 67 && event.tick === 7 * BAR + 1920);
    t.eq(tied.length, 1);
    t.eq(tied[0].durTicks, 1920 + Math.round(960 * 0.98), 'the half note plus the gated quarter');
    t.ok(!piano.some((event) => event.pitch === 67 && event.tick === 8 * BAR), 'the next bar starts with no new G4');
  });

  t.test('UT-30-08 controllers: nine bend gestures, the RPN set-up, the CC 1 ramp and the CC 11 dips', () => {
    const electro = songOf('demo-electro');
    const lead = electro.tracks[4];
    const bends = lead.events.filter((event) => event.kind === 'bend');
    t.eq(bends.length, 54, 'nine gestures of six events');
    t.deepEq(bends.slice(0, 6).map((event) => event.value), [0, 2048, 4096, 6143, 8191, 0]);
    const rpn = lead.events.filter((event) => event.kind === 'cc' && event.tick === 0).map((event) => [event.controller,
      event.value]);
    t.deepEq(rpn, [[6, 2], [38, 0], [100, 0], [101, 0]], 'CC 6, 38, 100 and 101 at tick 0 (controller order)');
    const modulation = electro.tracks[3].events.filter((event) => event.kind === 'cc' && event.controller === 1);
    t.eq(modulation.length, 51, 'Intro 1, Build 32, both Drops 1 each, Break 16');
    const ramp = modulation.filter((event) => event.tick >= 8 * BAR && event.tick < 16 * BAR);
    t.deepEq([ramp.length, ramp[0].value, ramp[ramp.length - 1].value], [32, 0, 100]);
    const dance = songOf('demo-dance');
    const dips = dance.tracks[3].events.filter((event) => event.kind === 'cc' && event.controller === 11);
    t.eq(dips.length, 515, '3 sets and 512 dips');
    const verseStart = 8 * BAR;
    t.deepEq(dips.filter((event) => event.tick >= verseStart && event.tick < verseStart + 960).map((event) => event.value),
      [40, 68, 96, 127]);
  });

  t.test('UT-30-09 notation errors: a bar check mid-bar, an unknown token and a part list of the wrong length', () => {
    const base = (patterns, parts, bars) => ({ id: 'bad', title: 'Bad', artist: 'x', style: 'x', contentVersion: 1,
      key: { fifths: 0, mode: 'major' }, tempo: [[1, 120]], meter: [[1, 4, 4]], sections: [{ label: 'S', bars }],
      harmony: {}, chords: {}, drumVel: {}, patterns, tracks: [{ name: 'T', program: 0, channel: 0, slot: 0, preset: 'p',
        parts }], cc: [], pedal: null, bend: null });
    t.throws(() => Content.expand(base({ p: { notes: 'C4/q | C4/h. |' } }, { S: 'p' }, 1)), 'E-CNT-001');
    t.throws(() => Content.expand(base({ p: { notes: 'H4/q' } }, { S: 'p' }, 1)), 'E-CNT-003');
    t.throws(() => Content.expand(base({ p: { notes: 'C4/w' } }, { S: [['p', 3]] }, 8)), 'E-CNT-002');
    t.throws(() => Content.expand(base({ p: { notes: 'C4/w' } }, { S: 'nope' }, 1)), 'E-CNT-003');
    t.eq(Content.parsePattern('C4/q. r/e _/h x/q 3/e R/e [C4.E4]/h C5/q!100~b |').length, 9);
  });

  t.test('UT-30-10 model validity: every song validates, events are sorted, the duration is the End marker', () => {
    DEMO_IDS.concat(['tut-basics']).forEach((id) => {
      const song = songOf(id);
      t.eq(Model.validate(song).ok, true, id);
      song.tracks.forEach((track) => t.ok(Model.isSorted(track.events), id + ' ' + track.name + ' is sorted'));
      const end = song.markers[song.markers.length - 1];
      t.deepEq([end.label, end.tick], ['End', song.durationTicks]);
    });
  });

  t.test('UT-30-11 catalog registration: the five demos in order, durations known without expanding', () => {
    const before = Catalog.cacheSize();
    const entries = Catalog.list('builtin');
    t.deepEq(entries.map((entry) => entry.id), DEMO_IDS);
    entries.forEach((entry, index) => t.near(entry.durationS, DURATIONS[index], 0.01, entry.id));
    t.eq(Catalog.cacheSize(), before, 'listing expanded nothing');
    t.eq(Catalog.tutorial().id, 'tut-basics');
    t.ok(!Catalog.list('builtin').some((entry) => entry.id === 'tut-basics'), 'the tutorial is not a Quick Play entry');
    const entry = Catalog.get('demo-poprock');
    t.deepEq([entry.defaultTrackId, entry.bpm, entry.keyName, entry.meterLabel, entry.bars], ['t5', 120, 'G major', '4/4', 48]);
    t.deepEq(Catalog.get('demo-jazz').meterLabel, '4/4, 3/4');
    t.deepEq(entry.presetsBySlot, ['preset-ace', 'preset-blue', 'preset-riff', 'preset-nova', 'preset-ivy']);
    const song = Catalog.getSong('demo-piano');
    t.ok(Catalog.getSong('demo-piano') === song, 'expanded once, then cached');
    t.eq(Catalog.getSong('missing'), null);
    t.eq(Catalog.get('demo-piano').defaultTrackId, 't1');
    t.eq(Catalog.get('demo-electro').defaultTrackId, 't2', 'the first melodic track');
  });

  t.test('UT-30-12 presets (structural): eight unique records of at most 4,096 bytes with the fields of Part 5.10', () => {
    const presets = Content.CHARACTER_PRESETS;
    t.eq(presets.length, 8);
    t.eq(new Set(presets.map((preset) => preset.presetId)).size, 8);
    presets.forEach((preset) => {
      t.deepEq([preset.format, preset.version, preset.builtIn], ['flm-character', 1, true]);
      t.ok(JSON.stringify(preset).length <= 4096, preset.presetId);
      ['name', 'body', 'heightScale', 'skin', 'hair', 'face', 'top', 'bottom', 'shoes', 'accessories', 'animationStyle']
        .forEach((field) => t.ok(field in preset.character, preset.presetId + ' ' + field));
    });
    if (FLM.Character && typeof FLM.Character.validate === 'function') {
      presets.forEach((preset) => t.eq(FLM.Character.validate(preset).ok, true, preset.presetId));
    }
    DEMO_IDS.forEach((id) => Catalog.get(id).tracks.forEach((track) => t.ok(presets.some((preset) =>
      preset.presetId === track.preset), id + ' uses a known preset')));
  });

  t.test('UT-30-13 tutorial charts (structural): 8, 8 and 20 notes, lanes from the lane pitches, sources exist', () => {
    const song = songOf('tut-basics');
    const charts = [1, 2, 3].map((step) => Content.tutorialChart(step, song));
    t.deepEq(charts.map((chart) => chart.notes.length), [8, 8, 20]);
    t.deepEq(charts[1].notes.slice(0, 2).map((note) => note.lanes), [[0, 1], [2, 3]]);
    const ids = new Set(eventsOf(song, 0, 'note').map((event) => event.id));
    charts.forEach((chart) => chart.notes.forEach((note) => {
      note.sourceEventIds.forEach((id) => t.ok(ids.has(id), 'source ' + id));
      note.pitches.forEach((pitch, index) => t.eq(Content.TUTORIAL.lanePitches[note.lanes[index]], pitch));
    }));
    t.deepEq([charts[0].id, charts[0].songId, charts[0].difficulty, charts[0].source], ['tut-basics:step1', 'tut-basics',
      'beginner', 'imported']);
    t.eq(Content.TUTORIAL.steps.length, 7);
    t.deepEq(Content.TUTORIAL.instruments, [0, 25, 80, 12]);
    t.throws(() => Content.tutorialChart(4, song), 'E-CNT-003');
  });

  t.test('UT-30-14 pedal derivation: the B section of demo-piano reaches across chord changes; bar 28 is silent', () => {
    const song = songOf('demo-piano');
    const track = song.tracks[0];
    const derived = Model.deriveSustain(track);
    const inB = derived.filter((item) => item.tick >= 12 * BAR && item.tick < 20 * BAR);
    t.ok(inB.some((item) => item.effectiveDurTicks > item.note.durTicks), 'a B note is held by the pedal');
    const bar28 = [27 * BAR, 28 * BAR];
    t.eq(eventsOf(song, 0, 'note').filter((event) => event.tick >= bar28[0] && event.tick < bar28[1]).length, 0);
    t.eq(eventsOf(song, 0, 'cc').filter((event) => event.controller === 64 && event.value > 0 && event.tick >= bar28[0] &&
      event.tick < bar28[1]).length, 0, 'no pedal-down event in bar 28');
    t.eq(eventsOf(song, 0, 'cc').filter((event) => event.controller === 64).pop().value, 0, 'the pedal ends up');
  });

  t.test('T04.10 the Catalog accepts and removes entries; a failing expand reaches the caller', () => {
    const entry = { id: 'x-test', kind: 'imported', title: 'x', expand: () => { throw new Error('E-CNT-005 broken'); } };
    Catalog.register(entry);
    t.throws(() => Catalog.getSong('x-test'), 'E-CNT-005');
    t.eq(Catalog.unregister('x-test'), true);
    t.eq(Catalog.get('x-test'), null);
    t.throws(() => Catalog.register({ id: '', expand() {} }), 'E-GEN-004');
  });
});
})();
