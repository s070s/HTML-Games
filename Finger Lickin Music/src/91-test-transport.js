// 91-test-transport.js - unit tests for M-04 FLM.Transport (group 'transport'; test build only).
// UT-04-01 to UT-04-28 follow Part 6.4.8. The FakeClock-only parts of TT-006, TT-008, TT-010, TT-012, TT-013, TT-021
// and TT-022 are included because their harness is this one; the offline-engine parts and TT-007, TT-009, TT-011,
// TT-017 wait for M-05 (T04.x) and the timing group (T02.07). Every test uses a FakeClock, never the real one.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('transport', (t) => {
  const Transport = FLM.Transport;
  const Model = FLM.Model;
  const Core = FLM.Core;
  const Events = Model.Events;
  const BEAT = 960;
  const BAR = 3840;
  const TICKS_PER_SECOND = 1920;           // 120 BPM at PPQ 960
  const LEAD_IN = 0.05;
  const LOOKAHEAD = 0.12;
  const STEP = 0.025;                       // the Scheduler tick (25 ms)
  const EPS = 1e-6;
  const TOPICS = ['transport.loaded', 'transport.state', 'transport.seek', 'transport.loop', 'transport.loopSet',
    'transport.speed', 'transport.tempoSource', 'transport.end'];

  // ------------------------------------------------------------------------------------------- fixtures
  function songWith(events, duration, tempoEntries) {
    const song = Model.Song.create({ tempoMap: tempoEntries });
    const track = Model.Track.create({ name: 'solo' }, song);
    Model.replaceEvents(track, events);
    Model.Song.addTrack(song, track);
    song.durationTicks = duration;
    return song;
  }

  /** Part 6.4.8 song: track 0 has a note on every beat for 8 bars at 120 BPM, track 1 a CC and a 2-bar note. */
  function makeSong(tempoEntries) {
    const song = Model.Song.create({ title: 'Transport test', tempoMap: tempoEntries });
    const beats = Model.Track.create({ name: 'beats' }, song);
    const notes = [];
    for (let beat = 0; beat < 32; beat += 1) notes.push(Events.note(beat * BEAT, BEAT / 2, 60 + (beat % 12), 100));
    Model.replaceEvents(beats, notes);
    Model.Song.addTrack(song, beats);
    const pad = Model.Track.create({ name: 'pad' }, song);
    Model.replaceEvents(pad, [Events.cc(0, 7, 100), Events.note(2 * BEAT, 2 * BAR, 48, 90)]);
    Model.Song.addTrack(song, pad);
    song.durationTicks = 8 * BAR;
    return song;
  }

  function setup(options) {
    const settings = options || {};
    const clock = t.fakes.clock(settings.start || 0);
    const bus = new Core.Emitter();
    const log = [];
    TOPICS.forEach((topic) => bus.on(topic, (payload) => log.push({ topic, payload })));
    const transport = Transport.create({ clock, bus });
    const song = settings.song || makeSong();
    transport.load(song, settings.load);
    return { clock, bus, log, transport, song };
  }

  function events(harness, topic) {
    return harness.log.filter((entry) => entry.topic === topic).map((entry) => entry.payload);
  }

  /** Steps the FakeClock to `target` in 25 ms Scheduler ticks (update, then pullDue one lookahead ahead). */
  function advanceTo(harness, target, collected) {
    const items = collected || [];
    const start = harness.clock.now();
    const steps = Math.ceil((target - start) / STEP - 1e-9);
    for (let index = 1; index <= steps; index += 1) {
      harness.clock.set(Math.min(start + index * STEP, target));
      harness.transport.update(harness.clock.now());
      harness.transport.pullDue(harness.clock.now() + LOOKAHEAD).forEach((item) => items.push(item));
    }
    return items;
  }

  const ofKind = (items, kind) => items.filter((item) => item.kind === kind);
  const noteTicks = (items) => ofKind(items, 'note').map((item) => item.event.tick);

  // ------------------------------------------------------------------------------------------- UT-04-01..10
  t.test('UT-04-01 load resets', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    h.transport.setLoop({ a: 0, b: BAR });
    h.log.length = 0;
    const other = makeSong();
    h.transport.load(other);
    t.eq(h.transport.state(), 'stopped');
    t.eq(h.transport.position(), 0);
    t.eq(h.transport.loop(), null);
    t.eq(h.transport.loopEnabled(), false);
    t.ok(h.transport.song() === other);
    const stateEvents = events(h, 'transport.state');
    t.eq(stateEvents.length, 1);
    t.eq(stateEvents[0].prev, 'playing');
    t.eq(stateEvents[0].state, 'stopped');
    t.eq(events(h, 'transport.loaded')[0].songId, other.id);
    t.eq(events(h, 'transport.loopSet')[0].enabled, false);
    h.transport.unload();
    t.eq(h.transport.song(), null);
    t.eq(events(h, 'transport.loaded')[1].songId, null);
  });

  t.test('UT-04-02 invalid actions are ignored', () => {
    const h = setup();
    t.eq(h.transport.pause(), false);
    t.eq(h.transport.resume(), false);
    t.eq(events(h, 'transport.state').length, 0);
    t.eq(h.transport.play({ countInBars: 0 }), true);
    h.log.length = 0;
    t.eq(h.transport.resume(), false);
    t.eq(h.transport.play(), false);
    t.eq(h.transport.record(), false);
    t.eq(h.log.length, 0);
    const empty = setup();
    empty.transport.unload();
    t.eq(empty.transport.play(), false);
    t.eq(empty.transport.state(), 'stopped');
  });

  t.test('UT-04-03 default tempo without song entries', () => {
    const h = setup({ song: Model.Song.create() });
    h.transport.play({ countInBars: 0 });
    const anchorTime = h.transport.anchor().audioTime;
    t.near(h.transport.positionAt(anchorTime + 1), TICKS_PER_SECOND, EPS);
  });

  t.test('UT-04-04 play anchors 50 ms ahead', () => {
    const h = setup({ start: 10 });
    t.eq(h.transport.play({ countInBars: 0 }), true);
    t.near(h.transport.audioTimeAt(0), 10.05, 1e-12);
    t.eq(h.transport.state(), 'playing');
    const payload = events(h, 'transport.state')[0];
    t.eq(payload.to, 'playing');
    t.eq(payload.from, 'stopped');
    t.eq(payload.tick, 0);
  });

  t.test('UT-04-05 positionAt and audioTimeAt are inverse', () => {
    const tempo = [{ tick: 0, usPerQuarter: 500000 }, { tick: BAR, usPerQuarter: 400000 },
      { tick: 2.5 * BAR, usPerQuarter: 750000 }];
    const h = setup({ song: makeSong(tempo) });
    h.transport.play({ countInBars: 0 });
    h.transport.setSpeed(0.75);
    const random = new Core.Prng(45);
    for (let index = 0; index < 200; index += 1) {
      const tick = random.range(0, 30000);
      t.near(h.transport.positionAt(h.transport.audioTimeAt(tick)), tick, EPS);
    }
  });

  t.test('UT-04-06 speed math', () => {
    const h = setup();
    const mapBefore = JSON.stringify(h.song.tempoMap.toJSON());
    h.transport.play({ countInBars: 0, fromTick: 2 * BEAT });
    h.clock.set(LEAD_IN);
    h.transport.setSpeed(0.5);
    t.eq(h.transport.speed(), 0.5);
    t.near(h.transport.positionAt(LEAD_IN), 2 * BEAT, EPS);
    t.near(h.transport.positionAt(LEAD_IN + 1), 2 * BEAT + TICKS_PER_SECOND / 2, EPS);
    t.eq(JSON.stringify(h.song.tempoMap.toJSON()), mapBefore);
    t.eq(events(h, 'transport.speed')[0].speed, 0.5);
    h.transport.setSpeed(9);
    t.eq(h.transport.speed(), 2);
    h.transport.setSpeed(0.01);
    t.eq(h.transport.speed(), 0.25);
  });

  t.test('UT-04-07 pause freezes and resume re-anchors', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    h.clock.set(1.35);
    t.eq(h.transport.pause(), true);
    t.eq(h.transport.position(), 2496);
    h.clock.advance(5);
    t.eq(h.transport.position(), 2496);
    h.clock.set(20);
    t.eq(h.transport.resume(), true);
    t.eq(h.transport.state(), 'playing');
    t.near(h.transport.audioTimeAt(2496), 20.05, 1e-9);
    t.near(h.transport.positionAt(21.05), 4416, EPS);
  });

  t.test('UT-04-08 seek while playing', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    h.clock.set(5);
    h.log.length = 0;
    h.transport.seek(2 * BAR);
    t.eq(h.transport.state(), 'playing');
    t.near(h.transport.audioTimeAt(2 * BAR), 5.05, 1e-9);
    const seekEvent = events(h, 'transport.seek')[0];
    t.eq(seekEvent.fromTick, Math.round((5 - LEAD_IN) * TICKS_PER_SECOND));
    t.eq(seekEvent.toTick, 2 * BAR);
    const items = h.transport.pullDue(5.06);
    t.deepEq(noteTicks(items), [2 * BAR]);
    t.eq(ofKind(items, 'cc').length, 0);   // the CC at tick 0 and the spanning pad note are not replayed
  });

  t.test('UT-04-09 seek clamps', () => {
    const h = setup();
    const countClamped = () => Core.Log.entries().filter((entry) => entry.msg.includes('tick clamped')).length;
    const before = countClamped();
    h.transport.seek(-10);
    t.eq(h.transport.position(), 0);
    h.transport.seek(1e9);
    t.eq(h.transport.position(), h.song.durationTicks);
    t.eq(countClamped() - before, 2);
    h.transport.seek(NaN);
    t.eq(h.transport.position(), h.song.durationTicks);
  });

  t.test('UT-04-10 stop returns to stopTick', () => {
    const h = setup();
    h.transport.seek(BAR / 2);
    h.transport.play({ countInBars: 0 });
    advanceTo(h, 2);
    h.transport.stop();
    t.eq(h.transport.state(), 'stopped');
    t.eq(h.transport.position(), BAR / 2);
    h.transport.stop();
    t.eq(events(h, 'transport.state').length, 2);   // play and the first stop; the second stop changes nothing
  });

  // ------------------------------------------------------------------------------------------- UT-04-11..14
  t.test('UT-04-11 count-in emits clicks only', () => {
    const h = setup();
    h.transport.setMetronome({ enabled: true, countInOnly: true });
    h.transport.play({ countInBars: 1 });
    t.eq(h.transport.state(), 'countin');
    const items = h.transport.pullDue(1.8);
    const clicks = ofKind(items, 'click');
    t.eq(items.length, 4);
    t.deepEq(clicks.map((click) => click.countIn), [true, true, true, true]);
    t.deepEq(clicks.map((click) => click.accent), [true, false, false, false]);
    t.deepEq(clicks.map((click) => click.beat), [0, 1, 2, 3]);
    t.deepEq(clicks.map((click) => click.bar), [-1, -1, -1, -1]);
    t.deepEq(clicks.map((click) => click.audible), [true, true, true, true]);
    clicks.forEach((click, index) => t.near(click.atAudio, LEAD_IN + index * 0.5, 1e-9));
    t.ok(h.transport.positionAt(1.0) < 0, 'position is negative during the count-in');
    t.near(h.transport.countinTick(1.0), h.transport.positionAt(1.0), EPS);
  });

  t.test('UT-04-12 count-in to playing and the start item', () => {
    const h = setup();
    h.transport.setMetronome({ enabled: true, countInOnly: true });
    h.transport.play({ countInBars: 1 });
    h.transport.pullDue(1.8);
    h.clock.set(1.95);
    h.transport.update(1.95);
    t.eq(h.transport.state(), 'countin');
    const crossing = h.transport.pullDue(2.07);
    t.eq(ofKind(crossing, 'start').length, 1);
    t.near(ofKind(crossing, 'start')[0].atAudio, 2.05, 1e-9);
    t.deepEq(noteTicks(crossing), [0]);
    const firstClick = ofKind(crossing, 'click')[0];
    t.eq(firstClick.countIn, false);
    t.eq(firstClick.audible, false);   // metronome in count-in-only mode is silent after the count-in
    h.clock.set(2.06);
    h.transport.update(2.06);
    t.eq(h.transport.state(), 'playing');
    const stateEvent = events(h, 'transport.state').pop();
    t.eq(stateEvent.prev, 'countin');
    t.eq(stateEvent.state, 'playing');
    const rest = advanceTo(h, 5);
    t.eq(ofKind(rest, 'start').length, 0);
    t.eq(noteTicks(crossing.concat(rest)).filter((tick) => tick === 0).length, 1);
  });

  t.test('UT-04-13 pause during count-in resumes the count-in', () => {
    const h = setup();
    h.transport.play({ countInBars: 1 });
    const starts = [];
    h.transport.pullDue(1.67).forEach((item) => starts.push(item));
    h.clock.set(1.55);
    h.transport.pause();
    t.eq(h.transport.position(), -BEAT);
    t.eq(h.transport.state(), 'paused');
    h.clock.set(10);
    t.eq(h.transport.resume(), true);
    t.eq(h.transport.state(), 'countin');
    advanceTo(h, 13, starts);
    t.eq(h.transport.state(), 'playing');
    t.eq(ofKind(starts, 'start').length, 1);
    t.near(ofKind(starts, 'start')[0].atAudio, 10.55, 1e-9);
  });

  t.test('UT-04-14 setLoop validation', () => {
    const h = setup();
    t.throws(() => h.transport.setLoop({ a: BAR, b: BAR }), 'E-TRN-001');
    t.throws(() => h.transport.setLoop({ a: BAR, b: 0 }), 'E-TRN-001');
    t.throws(() => h.transport.setLoop({ a: 0, b: 100 }), 'E-TRN-001');
    t.throws(() => h.transport.setLoop({ a: 0.5, b: BAR }), 'E-TRN-001');
    t.eq(h.transport.loop(), null);
    h.transport.setLoop({ a: 0, b: BAR });
    t.deepEq(h.transport.loop(), { a: 0, b: BAR });
    t.throws(() => h.transport.setLoop({ a: 10, b: 20 }), 'E-TRN-001');
    t.deepEq(h.transport.loop(), { a: 0, b: BAR });
    h.transport.setLoop({ a: 0, b: BEAT / 2 });   // exactly 0.25 s is allowed
    t.deepEq(events(h, 'transport.loopSet').pop(), { a: 0, b: BEAT / 2, enabled: true });
    h.transport.setLoopEnabled(false);
    t.eq(h.transport.loopEnabled(), false);
    h.transport.clearLoop();
    t.deepEq(events(h, 'transport.loopSet').pop(), { a: null, b: null, enabled: false });
    t.eq(h.transport.loop(), null);
  });

  // ------------------------------------------------------------------------------------------- UT-04-15..21
  t.test('UT-04-15 loop wrap item and re-anchor', () => {
    const h = setup();
    h.transport.setLoop({ a: 0, b: BAR });
    h.transport.play({ countInBars: 0 });
    const items = advanceTo(h, 1.9);
    t.eq(ofKind(items, 'loopWrap').length, 0);
    const wrapItems = advanceTo(h, 2.1);
    const wrap = ofKind(wrapItems, 'loopWrap')[0];
    t.near(wrap.atAudio, 2.05, 1e-9);
    t.eq(wrap.fromTick, BAR);
    t.eq(wrap.toTick, 0);
    t.eq(h.transport.audioTimeAt(0), wrap.atAudio);
    advanceTo(h, 4.2);
    t.deepEq(events(h, 'transport.loop').map((event) => event.pass), [1, 2]);
    t.near(events(h, 'transport.loop')[0].atAudioTime, 2.05, 1e-9);
    const seeks = events(h, 'transport.seek');
    t.eq(seeks.length, 2);
    t.eq(seeks[0].reason, 'loop');
    t.eq(seeks[0].fromTick, BAR);
    t.eq(seeks[0].toTick, 0);
  });

  t.test('UT-04-16 loop clamps sustained notes', () => {
    const h = setup();
    h.transport.setLoop({ a: 0, b: BAR });
    h.transport.play({ countInBars: 0 });
    const items = advanceTo(h, 2.1);
    const wrap = ofKind(items, 'loopWrap')[0];
    const pad = ofKind(items, 'note').find((item) => item.event.tick === 2 * BEAT && item.trackIndex === 1);
    t.eq(pad.endAudio, wrap.atAudio);
    const beat = ofKind(items, 'note').find((item) => item.event.tick === 0 && item.trackIndex === 0);
    t.near(beat.endAudio, LEAD_IN + 0.25, 1e-9);   // a note ending inside the loop is not clamped
  });

  t.test('UT-04-17 loop does not retrigger notes that began before a', () => {
    const song = songWith([Events.note(BEAT, 2 * BEAT, 60, 100), Events.note(2 * BEAT, BEAT / 2, 62, 100),
      Events.note(3 * BEAT, BEAT / 2, 64, 100)], 2 * BAR);
    const h = setup({ song });
    h.transport.setLoop({ a: 2 * BEAT, b: BAR });
    h.transport.play({ countInBars: 0 });
    const items = advanceTo(h, 6);
    const wraps = ofKind(items, 'loopWrap');
    t.ok(wraps.length >= 2);
    t.deepEq(noteTicks(items).filter((tick) => tick === BEAT), [BEAT]);   // once, on the first pass only
    t.ok(noteTicks(items).filter((tick) => tick === 2 * BEAT).length >= 3);
  });

  t.test('UT-04-18 event exactly at b is not played while looping', () => {
    const song = songWith([Events.note(0, BEAT, 60, 100), Events.note(BAR, BEAT, 62, 100)], 2 * BAR);
    const h = setup({ song });
    h.transport.setLoop({ a: 0, b: BAR });
    h.transport.play({ countInBars: 0 });
    const looping = advanceTo(h, 9);
    t.eq(ofKind(looping, 'loopWrap').length >= 3, true);
    t.eq(noteTicks(looping).filter((tick) => tick === BAR).length, 0);
    h.transport.setLoopEnabled(false);
    const after = advanceTo(h, 12);
    t.eq(noteTicks(looping.concat(after)).filter((tick) => tick === BAR).length, 1);
  });

  t.test('UT-04-19 event exactly at a plays at every wrap', () => {
    const song = songWith([Events.note(0, BEAT, 60, 100)], 2 * BAR);
    const h = setup({ song });
    h.transport.setLoop({ a: 0, b: BAR });
    h.transport.play({ countInBars: 0 });
    const items = advanceTo(h, 6.2);
    const wraps = ofKind(items, 'loopWrap');
    const notes = ofKind(items, 'note');
    t.eq(wraps.length, 3);
    t.eq(notes.length, 4);
    t.near(notes[0].atAudio, LEAD_IN, 1e-9);
    wraps.forEach((wrap, index) => t.eq(notes[index + 1].atAudio, wrap.atAudio));
  });

  t.test('UT-04-20 ten-minute loop drift', () => {
    const h = setup();
    h.transport.setLoop({ a: 0, b: BAR });
    h.transport.play({ countInBars: 0 });
    const passes = [];
    const stepCount = 600 / STEP;
    for (let index = 1; index <= stepCount; index += 1) {
      h.clock.set(index * STEP);
      h.transport.update(h.clock.now());
      ofKind(h.transport.pullDue(h.clock.now() + LOOKAHEAD), 'loopWrap').forEach((wrap) => passes.push(wrap));
    }
    t.eq(passes.length, 300);
    let worst = 0;
    passes.forEach((wrap, index) => {
      worst = Math.max(worst, Math.abs(wrap.atAudio - (LEAD_IN + (index + 1) * 2)));
    });
    t.ok(worst < 0.002, 'worst drift ' + worst);
    t.eq(events(h, 'transport.loop').pop().pass, 300);
  });

  t.test('UT-04-21 pullDue stays inside its window and never repeats', () => {
    const h = setup();
    h.transport.play({ countInBars: 1 });
    h.transport.setMetronome({ enabled: true, countInOnly: false });
    const random = new Core.Prng(21);
    const seen = new Set();
    let from = h.clock.now();
    let lastAt = -Infinity;
    let firstWindow = true;
    while (from < 12) {
      const until = from + random.range(0.005, 0.2);
      const items = h.transport.pullDue(until);
      items.forEach((item) => {
        t.ok(firstWindow ? item.atAudio >= LEAD_IN - 1e-12 : item.atAudio > from, 'after the last pull');
        t.ok(item.atAudio <= until, 'not beyond until');
        t.ok(item.atAudio >= lastAt, 'monotonic');
        lastAt = item.atAudio;
        const key = item.kind + ':' + (item.event ? item.track.id + ':' + item.event.tick + ':' + item.event.kind +
          (item.event.pitch === undefined ? '' : item.event.pitch) : item.atAudio.toFixed(6));
        t.ok(!seen.has(key), 'duplicate ' + key);
        seen.add(key);
      });
      if (until > LEAD_IN) firstWindow = false;
      from = until;
    }
    t.ok(seen.size > 40);
    t.deepEq(h.transport.pullDue(from), []);
    t.deepEq(h.transport.pullDue(from - 1), []);
  });

  // ------------------------------------------------------------------------------------------- UT-04-22..28
  t.test('UT-04-22 visibility continue drift re-anchor (also the TT-022 FakeClock part)', () => {
    const h = setup();
    h.transport.setVisibilityPolicy('continue');
    h.transport.play({ countInBars: 0 });
    h.clock.set(1);
    h.transport.update(1);
    h.transport.pullDue(1 + LOOKAHEAD);
    h.transport.onHidden(1, 5000);
    t.eq(h.transport.state(), 'playing');
    const driftLogs = () => Core.Log.entries().filter((entry) => entry.msg === 'W-TRANSPORT-DRIFT').length;
    const before = driftLogs();
    h.clock.set(4);
    const result = h.transport.onVisible(4, 15000);
    t.eq(result.drifted, true);
    t.near(result.driftMs, 7000, 1e-6);
    t.near(h.transport.anchor().audioTime, 4.05, 1e-9);
    t.eq(driftLogs() - before, 1);
    const items = h.transport.pullDue(4 + LOOKAHEAD);
    items.forEach((item) => t.ok(item.atAudio >= 4.05 - 1e-12, 'no burst from the hidden time'));
    t.deepEq(noteTicks(items), [8 * BEAT]);
    // equal elapsed time on both clocks is no drift
    h.transport.onHidden(4, 15000);
    t.eq(h.transport.onVisible(4.5, 15500).drifted, false);
    t.deepEq(h.transport.onVisible(5, 16000), { drifted: false, driftMs: 0 });
  });

  t.test('UT-04-23 visibility pause policy (also the TT-021 FakeClock part)', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    h.clock.set(0.05 + 5000 / TICKS_PER_SECOND);
    h.transport.update(h.clock.now());
    h.transport.onHidden(h.clock.now(), 1000);
    t.eq(h.transport.state(), 'paused');
    t.eq(events(h, 'transport.state').pop().reason, 'interrupt');
    t.near(h.transport.position(), 5000, EPS);
    h.clock.advance(180);
    t.eq(h.transport.onVisible(h.clock.now(), 181000).drifted, false);
    t.eq(h.transport.state(), 'paused');
    t.deepEq(h.transport.pullDue(h.clock.now() + 1), []);
    t.near(h.transport.position(), 5000, EPS);
    h.transport.resume();
    t.near(h.transport.anchor().tick, 5000, EPS);
    t.near(h.transport.positionAt(h.clock.now() + LEAD_IN + 1), 5000 + TICKS_PER_SECOND, EPS);
  });

  t.test('UT-04-24 cursor rebuild on track mutation', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    h.clock.set(1);
    h.transport.update(1);
    h.transport.pullDue(1 + LOOKAHEAD);
    const track = h.song.tracks[0];
    Model.insertEvent(track, Events.note(500, 100, 70, 90));       // behind the cursor
    Model.insertEvent(track, Events.note(3000, 100, 71, 90));      // ahead of the cursor
    h.transport.update(1.1);
    const items = advanceTo(h, 3.3);
    t.eq(noteTicks(items).filter((tick) => tick === 500).length, 0);
    t.eq(noteTicks(items).filter((tick) => tick === 3000).length, 1);
    t.eq(noteTicks(items).filter((tick) => tick === 2 * BEAT).length, 0);   // already pulled before the edit
    t.eq(noteTicks(items).filter((tick) => tick === 3 * BEAT).length, 1);
  });

  t.test('UT-04-25 fake clock determinism', () => {
    const run = () => {
      const h = setup();
      h.transport.setMetronome({ enabled: true, countInOnly: false });
      h.transport.setLoop({ a: BAR, b: 3 * BAR });
      h.transport.play({ countInBars: 1 });
      const items = advanceTo(h, 9);
      h.transport.setSpeed(0.5);
      advanceTo(h, 12, items);
      const summary = items.map((item) => [item.kind, item.atAudio, item.event ? item.event.tick : item.fromTick]);
      return JSON.stringify(summary);
    };
    const first = run();
    t.ok(first.length > 500, 'script length ' + first.length);
    t.eq(run(), first);
  });

  t.test('UT-04-25 frames never advance musical time', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    const random = new Core.Prng(200);
    let audioNow = 0;
    for (let frame = 0; frame < 200; frame += 1) {
      audioNow += random.range(0, 0.5);
      h.clock.set(audioNow);
      h.transport.position();
      h.transport.positionAt(audioNow);
    }
    t.near(h.transport.position(), (audioNow - LEAD_IN) * TICKS_PER_SECOND, EPS);
  });

  t.test('UT-04-26 tempo source override', () => {
    const h = setup();
    h.transport.play({ countInBars: 0, fromTick: BEAT * 2 });
    h.clock.set(LEAD_IN);
    h.transport.setTempoSource('override', 60);
    t.near(h.transport.position(), 2 * BEAT, EPS);
    t.near(h.transport.positionAt(LEAD_IN + 1), 2 * BEAT + BEAT, EPS);
    t.deepEq(events(h, 'transport.tempoSource').pop(), { source: 'override', bpm: 60 });
    h.transport.setTempoSource('override', 900);
    t.eq(events(h, 'transport.tempoSource').pop().bpm, 300);
    h.transport.setTempoSource('override', 5);
    t.eq(events(h, 'transport.tempoSource').pop().bpm, 20);
    h.transport.setTempoSource('song');
    t.near(h.transport.position(), 2 * BEAT, EPS);
    t.near(h.transport.positionAt(LEAD_IN + 1), 2 * BEAT + TICKS_PER_SECOND, EPS);
    t.eq(h.song.tempoMap.toJSON().length, 1);   // the song map is untouched
    t.eq(events(h, 'transport.tempoSource').pop().source, 'song');
  });

  t.test('UT-04-27 end of song', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    const items = advanceTo(h, 16.07);
    t.eq(ofKind(items, 'end').length, 1);
    t.near(ofKind(items, 'end')[0].atAudio, 16.05, 1e-9);
    t.eq(h.transport.state(), 'playing');
    t.eq(events(h, 'transport.end').length, 0);
    advanceTo(h, 16.2);
    t.eq(h.transport.state(), 'stopped');
    const ended = events(h, 'transport.end');
    t.eq(ended.length, 1);
    t.eq(ended[0].tick, 8 * BAR);
    t.near(ended[0].atAudioTime, 16.05, 1e-9);
    t.eq(events(h, 'transport.state').pop().reason, 'end');
    t.eq(h.transport.position(), 0);
    const recording = setup();
    recording.transport.record({ countInBars: 0 });
    t.eq(ofKind(advanceTo(recording, 17), 'end').length, 0);
    t.eq(recording.transport.state(), 'recording');
  });

  t.test('UT-04-28 setSpeed while paused', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    h.clock.set(1);
    h.transport.pause();
    h.transport.setSpeed(2);
    t.eq(events(h, 'transport.speed')[0].speed, 2);
    h.clock.set(5);
    h.transport.resume();
    t.near(h.transport.audioTimeAt(1824), 5.05, 1e-9);
    t.near(h.transport.positionAt(6.05), 1824 + 2 * TICKS_PER_SECOND, EPS);
  });

  // ------------------------------------------------------------------------------------- TT rows (FakeClock parts)
  t.test('TT-006 pause and resume do not shift the timeline (FakeClock part)', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    advanceTo(h, LEAD_IN + 9600 / TICKS_PER_SECOND);
    h.transport.pause();
    t.eq(h.transport.position(), 9600);
    h.clock.advance(2);
    const resumeAt = h.clock.now();
    h.transport.resume();
    t.eq(h.transport.anchor().tick, 9600);
    const items = advanceTo(h, resumeAt + 5);
    t.eq(noteTicks(items)[0], 9600);
    t.near(ofKind(items, 'note')[0].atAudio, resumeAt + LEAD_IN, 1e-9);
    t.eq(noteTicks(items).filter((tick) => tick < 9600 && tick % BEAT === 0 && tick !== 2 * BEAT).length, 0);
    t.eq(new Set(noteTicks(items)).size, noteTicks(items).length);
  });

  t.test('TT-008 fifty pause and resume cycles accumulate no error (FakeClock part)', () => {
    const song = makeSong();
    song.durationTicks = 100 * BAR;
    const h = setup({ song });
    const random = new Core.Prng(50);
    h.transport.play({ countInBars: 0 });
    let playedSeconds = 0;
    for (let cycle = 0; cycle < 50; cycle += 1) {
      advanceTo(h, h.transport.anchor().audioTime + 0.7);
      h.transport.pause();
      playedSeconds += 0.7;
      h.clock.advance(0.1 + random.range(0, 0.4));
      t.deepEq(h.transport.pullDue(h.clock.now() + 1), []);
      h.transport.resume();
    }
    t.near(h.transport.anchor().tick, playedSeconds * TICKS_PER_SECOND, 1);
  });

  t.test('TT-010 seek while stopped, then play (FakeClock part)', () => {
    const h = setup();
    h.transport.seek(2 * BAR);
    h.transport.play({ countInBars: 1 });
    t.eq(h.transport.state(), 'countin');
    t.eq(h.transport.anchor().tick, BAR);
    const items = advanceTo(h, 1.9);
    t.eq(noteTicks(items).filter((tick) => tick < 2 * BAR).length, 0, 'no song events in the count-in');
    t.ok(ofKind(items, 'click').every((click) => click.countIn), 'only count-in clicks');
    t.ok(h.transport.countinTick(1.0) < 0, 'countinTick is negative');
    advanceTo(h, 4.2, items);
    t.eq(h.transport.state(), 'playing');
    t.eq(noteTicks(items)[0], 2 * BAR);
    h.transport.stop();
    t.eq(h.transport.position(), 2 * BAR);
  });

  t.test('TT-012 event exactly on the loop end is never played while looping (FakeClock part)', () => {
    const song = songWith([Events.note(0, BEAT, 60, 100), Events.note(2 * BAR, BEAT, 62, 100)], 3 * BAR);
    const h = setup({ song });
    h.transport.setLoop({ a: 0, b: 2 * BAR });
    h.transport.play({ countInBars: 0 });
    const items = advanceTo(h, 4 * 4 + 1);
    t.ok(ofKind(items, 'loopWrap').length >= 4);
    t.eq(noteTicks(items).filter((tick) => tick === 2 * BAR).length, 0);
    h.transport.setLoopEnabled(false);
    t.eq(noteTicks(advanceTo(h, 30)).filter((tick) => tick === 2 * BAR).length, 1);
  });

  t.test('TT-013 event exactly on the loop start plays every pass (FakeClock part)', () => {
    const song = songWith([Events.note(2 * BEAT, BEAT, 60, 100)], 4 * BAR);
    const h = setup({ song });
    h.transport.setLoop({ a: 2 * BEAT, b: 10 * BEAT });
    h.transport.play({ countInBars: 0 });
    const items = advanceTo(h, 0.05 + 1 + 4 * 4 + 0.2);
    const wraps = ofKind(items, 'loopWrap');
    const notes = ofKind(items, 'note');
    t.eq(wraps.length, 4);
    t.eq(notes.length, 5);
    t.near(notes[0].atAudio, LEAD_IN + 2 * BEAT / TICKS_PER_SECOND, 1e-9);
    wraps.forEach((wrap, index) => t.eq(notes[index + 1].atAudio, wrap.atAudio));
  });

  // ------------------------------------------------------------------------------- T02.04 and T02.05 behavior
  t.test('scheduled start: atAudio places the first position after the count-in', () => {
    const h = setup();
    h.transport.play({ countInBars: 1, atAudio: 20 });
    t.near(h.transport.audioTimeAt(0), 20, 1e-9);
    t.near(h.transport.anchor().audioTime, 18, 1e-9);
    const late = setup({ start: 30 });
    late.transport.play({ countInBars: 0, atAudio: 5 });
    t.near(late.transport.audioTimeAt(0), 30, 1e-9);   // never earlier than audio now
    late.transport.pause();
    late.clock.set(31);
    late.transport.resume({ atAudio: 40 });
    t.near(late.transport.anchor().audioTime, 40, 1e-9);
  });

  t.test('count-in: setCountIn applies to play; stop and seek leave the count-in', () => {
    const h = setup();
    h.transport.setCountIn(2);
    h.transport.setCountIn(7);
    t.eq(h.transport.countInBars(), 2);
    h.transport.play();
    t.eq(h.transport.state(), 'countin');
    t.eq(h.transport.anchor().tick, -2 * BAR);
    h.clock.set(1);
    h.transport.seek(BAR);
    t.eq(h.transport.state(), 'playing');
    t.eq(events(h, 'transport.state').pop().prev, 'countin');
    t.eq(ofKind(advanceTo(h, 3), 'start').length, 0);
    h.transport.stop();
    h.transport.play({ countInBars: 1 });
    h.transport.stop();
    t.eq(h.transport.state(), 'stopped');
    t.eq(h.transport.position(), 0);
  });

  t.test('record: state only; pause and resume keep the recording target', () => {
    const h = setup();
    t.eq(h.transport.record({ countInBars: 0 }), true);
    t.eq(h.transport.state(), 'recording');
    h.transport.pause();
    t.eq(h.transport.state(), 'paused');
    t.eq(h.transport.resume(), true);
    t.eq(h.transport.state(), 'recording');
    h.transport.stop();
    h.transport.play({ countInBars: 0 });
    h.transport.pause();
    t.eq(h.transport.record(), false);
    t.eq(h.transport.play(), true);
    t.eq(h.transport.state(), 'playing');
  });

  t.test('seek in paused and stopped states moves the frozen tick only', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    h.clock.set(1);
    h.transport.pause();
    h.log.length = 0;
    h.transport.seek(2 * BAR);
    t.eq(h.transport.state(), 'paused');
    t.eq(h.transport.position(), 2 * BAR);
    t.eq(events(h, 'transport.state').length, 0);
    t.eq(events(h, 'transport.seek')[0].state, 'paused');
    h.clock.set(3);
    h.transport.resume();
    t.eq(h.transport.anchor().tick, 2 * BAR);
    t.deepEq(noteTicks(h.transport.pullDue(3.06)), [2 * BAR]);
  });

  t.test('speed change keeps position and replays no event', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    h.clock.set(1);
    const first = h.transport.pullDue(1 + LOOKAHEAD);
    t.deepEq(noteTicks(first), [0, BEAT, 2 * BEAT, 2 * BEAT]);   // audio 1.12 is tick 2054: beats 0-2 and the pad note
    const positionBefore = h.transport.position();
    h.transport.setSpeed(0.5);
    t.near(h.transport.position(), positionBefore, EPS);
    t.deepEq(h.transport.pullDue(1.15), []);
    const later = h.transport.pullDue(3.3);
    const lastTickPulled = Math.max(...noteTicks(first));
    t.ok(noteTicks(later).every((tick) => tick > lastTickPulled), 'nothing pulled twice');
    const beats = ofKind(later, 'note').filter((item) => item.trackIndex === 0);
    t.near(beats[1].atAudio - beats[0].atAudio, 1, 1e-9);   // one beat lasts 1 s of audio at half speed
  });

  t.test('metronome audible flags follow the setting', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    const silent = ofKind(h.transport.pullDue(1), 'click');
    t.eq(silent.length, 2);
    t.ok(silent.every((click) => !click.audible));
    h.transport.setMetronome({ enabled: true, countInOnly: false });
    h.clock.set(1.2);
    h.transport.seek(0);
    const audible = ofKind(h.transport.pullDue(1.8), 'click');
    t.ok(audible.length > 0 && audible.every((click) => click.audible));
    t.eq(audible[0].accent, true);
  });

  t.test('markers are pulled in order with their index', () => {
    const song = makeSong();
    song.markers.push(Model.Marker.create(2 * BEAT, 'B', 'section'), Model.Marker.create(0, 'A', 'section'));
    const h = setup({ song });
    h.transport.play({ countInBars: 0 });
    const markers = ofKind(advanceTo(h, 2), 'marker');
    t.deepEq(markers.map((item) => item.marker.label), ['A', 'B']);
    t.deepEq(markers.map((item) => item.index), [1, 0]);
  });

  t.test('activeNotesAt, tempo-map song, meter override and heldNotes', () => {
    const h = setup();
    const held = h.transport.activeNotesAt(2 * BEAT + 10);
    t.eq(held.length, 2);
    t.deepEq(held.map((entry) => entry.event.pitch).sort((a, b) => a - b), [48, 62]);
    h.song.tracks[1].visible = false;
    t.eq(h.transport.heldNotes(2 * BEAT + 10).length, 1);
    h.transport.setOverrideMeter(3, 4);
    t.eq(h.transport.meterMap().meterAt(0).ticksPerBar, 3 * BEAT);
    h.transport.setOverrideMeter(null);
    t.eq(h.transport.meterMap().meterAt(0).ticksPerBar, BAR);
    t.throws(() => h.transport.setOverrideMeter(3, 5), 'E-MDL-008');
    h.transport.seek(BAR);
    t.near(h.transport.positionSeconds(), 2, 1e-12);
  });

  t.test('setClock keeps a running position; dispose releases the song', () => {
    const h = setup();
    h.transport.play({ countInBars: 0 });
    h.clock.set(1);
    const before = h.transport.position();
    const other = t.fakes.clock(500);
    h.transport.setClock(other);
    t.ok(h.transport.position() <= before + EPS);
    t.near(h.transport.positionAt(500 + LEAD_IN), before, EPS);
    t.throws(() => h.transport.setClock({}), 'E-GEN-004');
    h.transport.dispose();
    t.eq(h.transport.state(), 'stopped');
    t.eq(h.transport.song(), null);
  });

  t.test('main transport, names and the fake clock helpers', () => {
    t.deepEq(Array.from(Transport.STATES), ['stopped', 'countin', 'playing', 'paused', 'recording']);
    t.eq(Transport.main.state(), 'stopped');
    t.eq(Transport.main.song(), null);
    t.eq(typeof Transport.main.setClock, 'function');
    t.eq(typeof Transport.create, 'function');
    t.ok(Core.modules().some((item) => item.name === 'Transport'));
    const clock = t.fakes.clock(1);
    clock.advanceMs(250);
    t.eq(clock.now(), 1.25);
  });

  // ------------------------------------------------------------------------------- T02.06 read-only events
  t.test('T02.06 events of a loaded song are frozen in the test build and a whole run never writes to them', () => {
    const h = setup();
    const loaded = h.song.tracks.reduce((all, track) => all.concat(track.events), []);
    t.ok(loaded.length > 0 && loaded.every((event) => Object.isFrozen(event)), 'every event object is frozen');
    let caught = null;
    try {
      loaded[0].tick += 1;
    } catch (error) {
      caught = error;
    }
    t.ok(caught instanceof TypeError, 'a write to a loaded event throws a TypeError in strict mode');
    h.transport.setLoop({ a: BAR, b: 3 * BAR });
    h.transport.setSpeed(0.5);
    h.transport.play({ countInBars: 1 });
    const items = advanceTo(h, 40);
    h.transport.seek(BAR);
    advanceTo(h, 44, items);
    t.ok(ofKind(items, 'note').length > 20, 'notes were pulled');
    t.ok(ofKind(items, 'note').every((item) => Object.isFrozen(item.event)), 'items hand out the frozen events');
  });

  t.test('T02.06 a clone of a loaded song stays editable and independent (UT-03-27 with frozen events)', () => {
    const h = setup();
    const copy = Model.Song.clone(h.song);
    t.eq(Object.isFrozen(copy.tracks[0].events[0]), false);
    copy.tracks[0].events[0].tick = 7;
    t.eq(h.song.tracks[0].events[0].tick, 0);
    const added = Events.note(BAR, BEAT, 70, 90);
    Model.insertEvent(h.song.tracks[0], added);
    t.eq(h.song.tracks[0].events.includes(added), true, 'the Model still edits a loaded track (new events)');
    t.eq(copy.tracks[0].events.includes(added), false);
  });
});
})();
