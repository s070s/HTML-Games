// 92-test-timing.js - TT timing tests (Part 12.5; group 'timing'; test build only), T02.07.
// Harness: "FakeClock transport" = Transport.create({clock, bus}) with the Scheduler's update and pullDue called by
// hand every few milliseconds of fake time. Every assertion uses scheduled audio times (atAudio, endAudio, anchors),
// never wall-clock observation.
// Rows run here (Phase 2): TT-005 to TT-013, TT-021, TT-022, plus the FakeClock parts of TT-004 (slow) and IT-039.
// Their offline-engine halves (rendered onsets, soft-panic releases, noteOff on seek) wait for M-05 (Phase 04);
// the input anchor ring of TT-021 waits for M-07 (Phase 03); the `E-AUD-009` log of TT-022 is M-28's and is
// tested in 91-test-modes.js. SCHEDULE below fixes the phase that makes every later TT row binding.
// Two fixtures satisfy R-P6.3-09: dense (8 tracks with 16-note chords, seed 0xF1A9) and sparse (1 note per 4 bars);
// the sparse one is a second case of TT-005 and TT-011 rather than a new row (OPEN-ISSUES 12d-P).
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('timing', (t) => {
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
  const MAX_DRIFT_SECONDS = 0.002;          // BRIEF 6: absolute drift under 2 ms
  const LOOP_BARS = 4;
  const LOOP_SECONDS = 8;                   // four bars at 120 BPM
  const RUN_SECONDS = 600;                  // ten minutes of fake time
  const JITTER_SEED = 7;
  const JITTER_MIN = 0.010;
  const JITTER_MAX = 0.090;
  const DENSE_SEED = 0xF1A9;
  const DENSE_TRACKS = 8;
  const CHORD_SIZE = 16;
  const DENSE_BARS = 4;
  const PITCH_LOW = 36;
  const PITCH_SPAN = 61;
  const SPARSE_GAP_BARS = 4;
  const SPARSE_NOTES = 6;
  const FNV_OFFSET = 0x811C9DC5;
  const FNV_PRIME = 0x01000193;
  const WORD_RANGE = 4294967296;
  const NANOSECONDS = 1e9;
  const KIND_CODES = Object.freeze({ note: 1, cc: 2, program: 3, bend: 4, click: 5, marker: 6, loopWrap: 7, end: 8,
    start: 9 });

  // Part 12.5: the phase that makes each TT row binding. Rows of Phase 2 are registered in this file.
  const SCHEDULE = Object.freeze({
    'TT-001': 4, 'TT-002': 4, 'TT-003': 4, 'TT-004': 4, 'TT-005': 2, 'TT-006': 2, 'TT-007': 2, 'TT-008': 2,
    'TT-009': 2, 'TT-010': 2, 'TT-011': 2, 'TT-012': 2, 'TT-013': 2, 'TT-014': 7, 'TT-015': 4, 'TT-016': 4,
    'TT-017': 4, 'TT-018': 8, 'TT-019': 4, 'TT-020': 5, 'TT-021': 2, 'TT-022': 2, 'TT-023': 3, 'TT-024': 3,
    'TT-025': 3, 'TT-026': 3, 'TT-027': 8, 'TT-028': 4, 'TT-029': 3, 'TT-030': 9, 'TT-031': 7, 'TT-032': 4,
    'TT-033': 8, 'TT-034': 9, 'TT-035': 11, 'TT-036': 11
  });
  const registered = [];

  /** Registers one timing row; the id is the first word of the name and is checked against SCHEDULE. */
  function row(name, options, body) {
    registered.push(name.split(' ')[0]);
    if (body === undefined) t.test(name, options);
    else t.test(name, options, body);
  }

  // ------------------------------------------------------------------------------------------- fixtures
  function songFromTracks(trackEvents, durationTicks) {
    const song = Model.Song.create({ title: 'Timing fixture' });
    trackEvents.forEach((events, index) => {
      const track = Model.Track.create({ name: 'track ' + index }, song);
      Model.replaceEvents(track, events);
      Model.Song.addTrack(song, track);
    });
    song.durationTicks = durationTicks;
    return song;
  }

  /** One track with a short note on every beat of `bars` bars at 120 BPM. */
  function beatSong(bars) {
    const notes = [];
    for (let beat = 0; beat < bars * 4; beat += 1) notes.push(Events.note(beat * BEAT, BEAT / 2, 60, 100));
    return songFromTracks([notes], bars * BAR);
  }

  /** Dense fixture: 8 tracks, a 16-note chord of distinct pitches on every beat of 4 bars (R-P6.3-09). */
  function denseSong() {
    const random = new Core.Prng(DENSE_SEED);
    const pitches = Array.from({ length: PITCH_SPAN }, (unused, index) => PITCH_LOW + index);
    const tracks = [];
    for (let trackIndex = 0; trackIndex < DENSE_TRACKS; trackIndex += 1) {
      const notes = [];
      for (let beat = 0; beat < DENSE_BARS * 4; beat += 1) {
        random.shuffle(pitches.slice()).slice(0, CHORD_SIZE)
          .forEach((pitch) => notes.push(Events.note(beat * BEAT, BEAT / 2, pitch, 100)));
      }
      tracks.push(notes);
    }
    return songFromTracks(tracks, DENSE_BARS * BAR);
  }

  /** Sparse fixture: one long note every 4 bars (R-P6.3-09). */
  function sparseSong() {
    const notes = [];
    for (let index = 0; index < SPARSE_NOTES; index += 1) {
      notes.push(Events.note(index * SPARSE_GAP_BARS * BAR, 3 * BAR, 60, 100));
    }
    return songFromTracks([notes], SPARSE_NOTES * SPARSE_GAP_BARS * BAR);
  }

  // ------------------------------------------------------------------------------------------- harness
  function harness(song, start) {
    const clock = t.fakes.clock(start || 0);
    const bus = new Core.Emitter();
    const log = [];
    ['transport.state', 'transport.seek', 'transport.loop'].forEach((topic) => {
      bus.on(topic, (payload) => log.push({ topic, payload }));
    });
    const transport = Transport.create({ clock, bus });
    transport.load(song);
    return { clock, bus, log, transport, song };
  }

  const payloads = (h, topic) => h.log.filter((entry) => entry.topic === topic).map((entry) => entry.payload);
  const ofKind = (items, kind) => items.filter((item) => item.kind === kind);
  const noteItems = (items) => ofKind(items, 'note');
  const noteTicks = (items) => noteItems(items).map((item) => item.event.tick);

  /** Scheduler ticks from now to `endSeconds` (the last one lands exactly on it); each pulls one lookahead ahead. */
  function drive(h, endSeconds, nextInterval, onItems) {
    while (h.clock.now() < endSeconds) {
      h.clock.set(Math.min(h.clock.now() + nextInterval(), endSeconds));
      h.transport.update(h.clock.now());
      onItems(h.transport.pullDue(h.clock.now() + LOOKAHEAD));
    }
  }

  const fixedTicks = () => STEP;

  function collect(h, endSeconds, nextInterval) {
    const items = [];
    drive(h, endSeconds, nextInterval || fixedTicks, (batch) => batch.forEach((item) => items.push(item)));
    return items;
  }

  // A running hash of every item, so two ten-minute runs with hundreds of thousands of items compare cheaply.
  function foldNumber(hash, value) {
    const low = value % WORD_RANGE;
    const high = Math.floor(value / WORD_RANGE);
    return Math.imul(Math.imul(hash ^ (low | 0), FNV_PRIME) ^ (high | 0), FNV_PRIME);
  }

  function createDigest() {
    let hash = FNV_OFFSET;
    let count = 0;
    return {
      add(item) {
        const tick = item.event ? item.event.tick : (item.fromTick || 0);
        const pitch = item.event && item.event.pitch !== undefined ? item.event.pitch : 0;
        [KIND_CODES[item.kind], Math.round(item.atAudio * NANOSECONDS), tick, pitch, item.trackIndex || 0]
          .forEach((value) => { hash = foldNumber(hash, value); });
        count += 1;
      },
      value: () => hash >>> 0,
      count: () => count
    };
  }

  // ------------------------------------------------------------------------------------------- TT-005
  function runLoop(song, nextInterval) {
    const h = harness(song);
    h.transport.setLoop({ a: 0, b: LOOP_BARS * BAR });
    h.transport.play({ countInBars: 0 });
    const digest = createDigest();
    const wraps = [];
    drive(h, RUN_SECONDS, nextInterval, (items) => items.forEach((item) => {
      digest.add(item);
      if (item.kind === 'loopWrap') wraps.push(item.atAudio);
    }));
    return { wraps, digest: digest.value(), count: digest.count() };
  }

  function checkNoDrift(wraps) {
    t.eq(wraps.length, RUN_SECONDS / LOOP_SECONDS, 'one wrap per pass');
    let worst = 0;
    wraps.forEach((wrap, index) => {
      worst = Math.max(worst, Math.abs(wrap - (wraps[0] + index * LOOP_SECONDS)));
    });
    t.ok(worst < MAX_DRIFT_SECONDS, 'worst drift ' + worst + ' s');
  }

  function jitteredTicks() {
    const random = new Core.Prng(JITTER_SEED);
    return () => random.range(JITTER_MIN, JITTER_MAX);
  }

  function checkJitterRun(song) {
    const jittered = runLoop(song, jitteredTicks());
    checkNoDrift(jittered.wraps);
    const fixed = runLoop(song, fixedTicks);
    t.eq(jittered.count, fixed.count, 'same number of items');
    t.eq(jittered.digest, fixed.digest, 'the item sequence equals the one of fixed 25 ms ticks');
    return jittered.count;
  }

  row('TT-005 no cumulative drift with jittered scheduler ticks (dense fixture)', () => {
    t.ok(checkJitterRun(denseSong()) > 100000, 'the dense run handles a large item stream');
  });

  row('TT-005 no cumulative drift with jittered scheduler ticks (sparse fixture)', () => {
    t.ok(checkJitterRun(sparseSong()) >= RUN_SECONDS / LOOP_SECONDS, 'one note at least per pass');
  });

  row('TT-004 loop drift of the scheduled times over ten minutes (FakeClock part; offline onsets in Phase 04)',
    { slow: true }, () => {
      const h = harness(songFromTracks([[Events.note(0, BEAT, 60, 100)]], LOOP_BARS * BAR));
      h.transport.setLoop({ a: 0, b: LOOP_BARS * BAR });
      h.transport.play({ countInBars: 0 });
      const clicks = noteItems(collect(h, RUN_SECONDS + 1));
      t.ok(clicks.length >= RUN_SECONDS / LOOP_SECONDS, 'a click per pass: ' + clicks.length);
      clicks.forEach((click, index) => t.near(click.atAudio, clicks[0].atAudio + index * LOOP_SECONDS, EPS));
    });

  // ------------------------------------------------------------------------------------------- TT-006 to TT-008
  row('TT-006 pause and resume do not shift the timeline (FakeClock part)', () => {
    const h = harness(beatSong(16));
    h.transport.play({ countInBars: 0 });
    const before = collect(h, LEAD_IN + 5);
    h.transport.pause();
    t.near(h.transport.position(), 9600, EPS);
    h.clock.advance(2);
    t.deepEq(h.transport.pullDue(h.clock.now() + 1), [], 'nothing is scheduled while paused');
    const resumeAt = h.clock.now();
    h.transport.resume();
    t.eq(h.transport.anchor().tick, 9600, 'no tick lost or added');
    const after = collect(h, resumeAt + 5);
    t.eq(noteTicks(after)[0], 9600);
    t.near(noteItems(after)[0].atAudio, resumeAt + LEAD_IN, 1e-9);
    const started = noteTicks(before).filter((tick) => tick < 9600).concat(noteTicks(after));
    t.deepEq(started.slice(0, 14), Array.from({ length: 14 }, (unused, beat) => beat * BEAT),
      'every beat once, in order: none duplicated, none skipped');
  });

  row('TT-007 pause during a sustained note (FakeClock part; the soft-panic fade is rendered in Phase 04)', () => {
    const song = songFromTracks([[Events.note(0, 8 * BEAT, 60, 100), Events.note(8 * BEAT, BEAT, 64, 100)]],
      12 * BEAT);
    const h = harness(song);
    h.transport.play({ countInBars: 0 });
    const before = collect(h, LEAD_IN + 4 * BEAT / TICKS_PER_SECOND);
    t.deepEq(noteTicks(before), [0], 'the sustained note was handed over once');
    h.transport.pause();
    const pausedEvent = payloads(h, 'transport.state').pop();
    t.eq(pausedEvent.to, 'paused');
    t.near(pausedEvent.tick, 4 * BEAT, 1, 'the pause event carries the tick the Scheduler soft-panics at');
    t.eq(h.transport.activeNotesAt().length, 1, 'the HUD still sees the held note');
    h.clock.advance(1);
    const resumeAt = h.clock.now();
    h.transport.resume();
    const after = collect(h, resumeAt + 3);
    t.deepEq(noteTicks(after), [8 * BEAT], 'the sustained note is not restarted at resume');
    const expected = resumeAt + LEAD_IN + (8 * BEAT - 4 * BEAT) / TICKS_PER_SECOND;
    t.near(noteItems(after)[0].atAudio, expected, 0.001);
  });

  row('TT-008 fifty pause and resume cycles accumulate no error (FakeClock part)', () => {
    const song = beatSong(60);
    const h = harness(song);
    const random = new Core.Prng(50);
    h.transport.play({ countInBars: 0 });
    for (let cycle = 1; cycle <= 50; cycle += 1) {
      drive(h, h.transport.anchor().audioTime + 0.7, fixedTicks, () => {});
      h.transport.pause();
      t.near(h.transport.position(), cycle * 0.7 * TICKS_PER_SECOND, 1, 'position at pause ' + cycle);
      h.clock.advance(0.3 + random.range(0, 0.05));
      t.deepEq(h.transport.pullDue(h.clock.now() + 1), [], 'no item while paused');
      h.transport.resume();
    }
    t.near(h.transport.anchor().tick, 50 * 0.7 * TICKS_PER_SECOND, 1);
  });

  // ------------------------------------------------------------------------------------------- TT-009, TT-010
  /** 4 tracks; 6 notes start at tick 0 and sound until bar 13; every track plays again at bars 9 and 10. */
  function sustainedSong() {
    const pitchesByTrack = [[48, 52], [55, 59], [64], [67]];
    const tracks = pitchesByTrack.map((pitches, index) => pitches
      .map((pitch) => Events.note(0, 12 * BAR, pitch, 90))
      .concat([Events.note(8 * BAR, BEAT, 72 + index, 100), Events.note(9 * BAR, BEAT, 72 + index, 100)]));
    return songFromTracks(tracks, 14 * BAR);
  }

  row('TT-009 seek while notes are active (FakeClock part; noteOff reasons are rendered in Phase 04)', () => {
    const h = harness(sustainedSong());
    h.transport.play({ countInBars: 0 });
    collect(h, LEAD_IN + 2 * BAR / TICKS_PER_SECOND);
    t.eq(h.transport.activeNotesAt().length, 6, 'six notes sound');
    const seekAt = h.clock.now();
    const target = 8 * BAR;
    h.transport.seek(target);
    const seekEvent = payloads(h, 'transport.seek').pop();
    t.eq(seekEvent.toTick, target);
    t.eq(seekEvent.reason, 'user', 'the Scheduler soft-panics every sounding note on this event');
    t.near(h.transport.audioTimeAt(target), seekAt + LEAD_IN, 1e-9);
    const after = collect(h, seekAt + 4);
    t.ok(noteTicks(after).every((tick) => tick >= target), 'no event before bar 9 after the seek');
    t.deepEq(noteTicks(after).slice(0, 4), [target, target, target, target]);
    noteItems(after).slice(0, 4).forEach((item) => t.near(item.atAudio, seekAt + LEAD_IN, 1e-9));
    t.eq(noteItems(after).filter((item) => item.event.durTicks === 12 * BAR).length, 0, 'no spanning note restarts');
  });

  row('TT-010 seek while stopped, then play (FakeClock part)', () => {
    const h = harness(beatSong(8));
    h.transport.seek(7680);
    t.eq(h.transport.state(), 'stopped');
    h.transport.setCountIn(1);
    h.transport.play();
    t.eq(h.transport.state(), 'countin');
    t.eq(h.transport.anchor().tick, 7680 - BAR, 'the count-in lies before the seek position');
    const items = collect(h, 6);
    t.ok(ofKind(items, 'click').length >= 4, 'count-in clicks');
    t.eq(noteTicks(items)[0], 7680, 'the first song note is the one at the seek position');
    t.near(noteItems(items)[0].atAudio, h.transport.audioTimeAt(7680), 1e-9);
    h.transport.stop();
    t.eq(h.transport.position(), 7680, 'stop returns to the seek position');
    h.transport.setCountIn(0);
    h.transport.play();
    t.eq(h.transport.anchor().tick, 7680);
  });

  // ------------------------------------------------------------------------------------------- TT-011
  /**
   * Plays three passes of `region` and checks the loop rules for sustained notes (Part 6.4.4.5): the probe note
   * starts inside the loop and spans its end, so each pass releases it at the wrap time; a note that began before
   * `a` is heard in the first pass only; nothing is released later than the wrap that ends its pass.
   */
  function checkLoopedSustain(song, region, probeTick) {
    const h = harness(song);
    h.transport.setLoop(region);
    h.transport.play({ countInBars: 0 });
    const passSeconds = (region.b - region.a) / TICKS_PER_SECOND;
    const items = collect(h, LEAD_IN + region.b / TICKS_PER_SECOND + 2 * passSeconds + LEAD_IN);
    const wraps = ofKind(items, 'loopWrap');
    t.ok(wraps.length >= 3, 'three passes');
    const spansEnd = (item) => item.event.tick === probeTick && item.event.tick + item.event.durTicks > region.b;
    const probes = noteItems(items).filter((item) => spansEnd(item) && item.atAudio <= wraps[2].atAudio);
    t.eq(probes.length, 3, 'the sustained note starts once per pass and never at a wrap');
    probes.forEach((probe, index) => t.near(probe.endAudio, wraps[index].atAudio, 1e-9, 'release at wrap ' + index));
    noteItems(items).filter((item) => item.event.tick < region.a)
      .forEach((item) => t.ok(item.atAudio < wraps[0].atAudio, 'a note from before a is not retriggered'));
    noteItems(items).forEach((item) => {
      const ending = wraps.find((wrap) => wrap.atAudio > item.atAudio);   // a note at a wrap time starts the next pass
      if (ending) t.ok(item.endAudio <= ending.atAudio + 1e-9, 'no release after the wrap ending its pass');
    });
  }

  row('TT-011 loop boundary with a sustained note (FakeClock part)', () => {
    const song = songFromTracks([[Events.note(BAR, 2 * BAR, 60, 100)]], 6 * BAR);
    checkLoopedSustain(song, { a: 0, b: 2 * BAR }, BAR);
  });

  row('TT-011 loop boundary with a sustained note (dense fixture)', () => {
    const song = denseSong();
    Model.insertEvent(song.tracks[0], Events.note(2 * BAR, 4 * BAR, 19, 100));
    song.durationTicks = 8 * BAR;
    checkLoopedSustain(song, { a: BAR, b: 3 * BAR }, 2 * BAR);
  });

  row('TT-011 loop boundary with a sustained note (sparse fixture)', () => {
    checkLoopedSustain(sparseSong(), { a: 2 * BAR, b: 6 * BAR }, 4 * BAR);
  });

  // ------------------------------------------------------------------------------------------- TT-012, TT-013
  row('TT-012 event exactly on the loop end is never played while looping (FakeClock part)', () => {
    const song = songFromTracks([[Events.note(0, BEAT, 60, 100), Events.note(7680, BEAT, 62, 100)]], 3 * BAR);
    const h = harness(song);
    h.transport.setLoop({ a: 0, b: 7680 });
    h.transport.play({ countInBars: 0 });
    const passSeconds = 7680 / TICKS_PER_SECOND;
    const items = collect(h, LEAD_IN + 4 * passSeconds + 1);
    t.ok(ofKind(items, 'loopWrap').length >= 4, 'four passes are over');
    t.eq(noteTicks(items).filter((tick) => tick === 7680).length, 0, 'zero emissions in passes 1 to 4');
    h.transport.setLoopEnabled(false);
    const rest = collect(h, LEAD_IN + 5 * passSeconds + 2);
    t.eq(noteTicks(rest).filter((tick) => tick === 7680).length, 1, 'once after the loop is disabled');
  });

  row('TT-013 event exactly on the loop start plays every pass (FakeClock part)', () => {
    const song = songFromTracks([[Events.note(1920, BEAT, 60, 100)]], 6 * BAR);
    const h = harness(song);
    h.transport.setLoop({ a: 1920, b: 9600 });
    h.transport.play({ countInBars: 0 });
    const passSeconds = (9600 - 1920) / TICKS_PER_SECOND;
    const items = collect(h, LEAD_IN + 1 + 4 * passSeconds + 0.2);
    const wraps = ofKind(items, 'loopWrap');
    const notes = noteItems(items);
    t.eq(notes.length, 5, 'five passes, five emissions');
    t.near(notes[0].atAudio, LEAD_IN + 1, 1e-9, 'pass 1 at audioTimeAt(1920)');
    wraps.forEach((wrap, index) => t.eq(notes[index + 1].atAudio, wrap.atAudio, 'pass ' + (index + 2) + ' at wrap'));
  });

  // ------------------------------------------------------------------------------------------- TT-021, TT-022
  const PERF_START_MS = 1000;
  const BACKGROUND_SECONDS = 180;

  row('TT-021 background and foreground in a gameplay mode (FakeClock part; the input anchor ring is Phase 03)', () => {
    const h = harness(beatSong(40));
    h.transport.setVisibilityPolicy('pause');
    h.transport.play({ countInBars: 0 });
    collect(h, LEAD_IN + 5000 / TICKS_PER_SECOND);
    h.transport.onHidden(h.clock.now(), PERF_START_MS);
    t.eq(h.transport.state(), 'paused');
    t.near(h.transport.position(), 5000, EPS, 'paused at the hide tick');
    for (let minute = 1; minute <= 3; minute += 1) {
      h.clock.advance(BACKGROUND_SECONDS / 3);
      t.deepEq(h.transport.pullDue(h.clock.now() + 1), [], 'nothing scheduled while hidden');
    }
    const shown = h.transport.onVisible(h.clock.now(), PERF_START_MS + BACKGROUND_SECONDS * 1000);
    t.eq(shown.drifted, false);
    t.eq(h.transport.state(), 'paused', 'stays paused until the user resumes');
    t.near(h.transport.position(), 5000, EPS);
    const resumeAt = h.clock.now();
    h.transport.resume();
    t.near(h.transport.anchor().tick, 5000, EPS);
    t.near(h.transport.audioTimeAt(5000), resumeAt + LEAD_IN, 1e-9);
    const ticks = noteTicks(collect(h, resumeAt + 3));
    t.eq(ticks[0], 6 * BEAT, 'the song continues from tick 5000, with no burst of the hidden minutes');
    t.deepEq(ticks.slice(0, 3), [6 * BEAT, 7 * BEAT, 8 * BEAT]);
  });

  row('TT-022 background and foreground in the Studio, continue policy (FakeClock part; E-AUD-009 is M-28)', () => {
    const h = harness(beatSong(40));
    h.transport.setVisibilityPolicy('continue');
    h.transport.play({ countInBars: 0 });
    collect(h, 1);
    h.transport.onHidden(1, PERF_START_MS);
    t.eq(h.transport.state(), 'playing');
    const driftLogs = () => Core.Log.entries().filter((entry) => entry.msg === 'W-TRANSPORT-DRIFT').length;
    const logged = driftLogs();
    h.clock.set(4);
    const shown = h.transport.onVisible(4, PERF_START_MS + 10000);
    t.eq(shown.drifted, true);
    t.near(shown.driftMs, 7000, EPS);
    t.near(h.transport.anchor().audioTime, 4 + LEAD_IN, 1e-9, 're-anchored at the current audio time');
    t.near(h.transport.anchor().tick, (4 - LEAD_IN) * TICKS_PER_SECOND, EPS, 'the position follows the audio clock');
    t.eq(driftLogs() - logged, 1, 'the drift is logged once');
    const items = collect(h, 4.5);
    t.ok(items.length > 0, 'playback goes on');
    items.forEach((item) => t.ok(item.atAudio >= 4 + LEAD_IN - 1e-12, 'no burst from the time spent hidden'));
  });

  // ------------------------------------------------------------------------------------------- IT-039 (partial)
  row('IT-039 (partial) the audio clock alone drives the position (FakeClock part; real clock: T04.04)', () => {
    const h = harness(beatSong(8));
    h.transport.play({ countInBars: 0 });
    const realNow = window.performance.now.bind(window.performance);
    const jump = t.fakes.stub(window.performance, 'now', () => realNow() + 5000);
    let previous = h.transport.position();
    for (let frame = 0; frame < 80; frame += 1) {
      h.clock.advance(0.025);
      const tick = h.transport.positionAt(h.clock.now());
      t.near(tick - previous, 0.025 * TICKS_PER_SECOND, 1, 'continuous at frame ' + frame);
      previous = tick;
    }
    jump.restore();
    t.near(h.transport.position(), (h.clock.now() - LEAD_IN) * TICKS_PER_SECOND, EPS);
  });

  // ------------------------------------------------------------------------------------------- schedule
  row('TT-schedule every TT row has an owning phase and the Phase 2 rows are the ones registered here', () => {
    const ids = Object.keys(SCHEDULE);
    t.eq(ids.length, 36);
    const phaseTwo = ids.filter((id) => SCHEDULE[id] === 2);
    const here = Array.from(new Set(registered.filter((id) => /^TT-\d+$/.test(id) && SCHEDULE[id] === 2)));
    t.deepEq(here.sort(), phaseTwo.sort(), 'TT-005 to TT-013, TT-021 and TT-022 run in this group');
    t.deepEq(['TT-023', 'TT-024', 'TT-025', 'TT-026', 'TT-029'].map((id) => SCHEDULE[id]), [3, 3, 3, 3, 3]);
    t.deepEq(['TT-001', 'TT-002', 'TT-003', 'TT-004', 'TT-015', 'TT-016', 'TT-017', 'TT-019', 'TT-028', 'TT-032']
      .map((id) => SCHEDULE[id]), new Array(10).fill(4));
    t.eq(SCHEDULE['TT-020'], 5);
  });
});
})();
