// 92-test-perf-smoke.js - PT smoke checks (Part 12.6) and in-page performance scenarios (Part 9.7.2).
// First rows: PT-001 and PT-002 (T01.05). A smoke pass never stands in for the PT result of tools/perf.mjs.
// In-page scenarios are registered with FLM.SelfTest.perf.register by the entries that own them.
// T03.10 registers `input-latency` (PT-009, input part): the `instrument` mode on a test chart, key presses from the
// tool (trusted events) or, without a tool, synthesized ones; the Free Play phase and liveSchedMaxMs wait for Phase 06.
// T04.05 registers `chord-stress-1000` (PT-012, Part 9.6.4).
(function () {
'use strict';
const FLM = window.FLM;

// The shipped file is limited to 2,621,440 bytes (PT-001). The test build also carries the 9*-*.js files, so
// this gross-regression check allows room for them; tools/build.mjs enforces the exact shipped limit.
const TEST_BUILD_SCRIPT_LIMIT = 4194304;
const BOOT_STAGE_COUNT = 16;

function inlineScriptLength() {
  return Array.from(document.scripts)
    .filter((script) => !script.src)
    .reduce((sum, script) => sum + script.textContent.length, 0);
}

function expectedStageNames() {
  return Array.from({ length: BOOT_STAGE_COUNT }, (unused, index) => 'B' + (index + 1));
}

FLM.SelfTest.group('perf-smoke', (t) => {
  t.test('PT-001 build-size smoke', () => {
    const length = inlineScriptLength();
    t.within(length, 1, TEST_BUILD_SCRIPT_LIMIT, 'inline script length of the running page');
  });

  t.test('PT-002 boot-to-menu smoke', () => {
    if (!FLM.Boot || typeof FLM.Boot.stage !== 'function') t.skip('FLM.Boot is not built yet (T01.10)');
    const stages = FLM.Boot.stage();
    t.deepEq(stages.map((record) => record.stage), expectedStageNames());
  });
});

// ------------------------------------------------------------------------------------------ input-latency (PT-009)
const INPUT_SONG_NOTES = 60;               // a 31 s song: longer than the 100 presses of the tool take
const ASSISTED_PRESSES = 100;              // the tool sends these (Part 9.7.3)
const SYNTHESIZED_PRESSES = 20;            // without a tool the scenario sends these itself, each with a known tPerf
const SYNTHESIZED_SPACING_MS = 60;
const PRESS_POLL_MS = 50;
const PRESS_WAIT_LIMIT_MS = 60000;
const P95 = 0.95;
const LANE_CONTROL = /^lane[0-3]$/;
const SYNTHESIZED_KEYS = Object.freeze(['KeyA', 'KeyS', 'KeyK', 'KeyL']);
const ROUND_DIGITS = 100;

const roundTo = (value) => Math.round(value * ROUND_DIGITS) / ROUND_DIGITS;

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

function wait(ms, owner) {
  return new Promise((resolve) => FLM.Core.timers.setTimeout(resolve, ms, owner));
}

/** Sends one lane press and release through Input.synthesize, with the stamp of this moment. */
function sendSynthesizedPress(index) {
  const code = SYNTHESIZED_KEYS[index % SYNTHESIZED_KEYS.length];
  FLM.Input.synthesize.key(code, true, FLM.Core.now());
  FLM.Input.synthesize.key(code, false, FLM.Core.now());
}

async function collectPresses(samples, wanted, assisted, owner) {
  const started = FLM.Core.now();
  let sent = 0;
  while (samples.length < wanted && FLM.Core.now() - started < PRESS_WAIT_LIMIT_MS) {
    if (!assisted && sent < wanted) {
      sendSynthesizedPress(sent);
      sent += 1;
    }
    await wait(assisted ? PRESS_POLL_MS : SYNTHESIZED_SPACING_MS, owner);
  }
}

/**
 * PT-009: processing time of a lane press = (performance.now() when input.event reaches the last listener) - tPerf.
 * options: {assisted: true when tools/perf.mjs sends the presses as trusted key events, presses: how many}.
 */
async function inputLatency(options) {
  const assisted = options.assisted === true;
  const defaultPresses = assisted ? ASSISTED_PRESSES : SYNTHESIZED_PRESSES;
  const wanted = Number.isFinite(options.presses) ? options.presses : defaultPresses;
  const owner = Symbol('perf-input-latency');
  const samples = [];
  const notes = [];
  const fixtures = FLM.SelfTest.fixtures;
  const entered = await FLM.Modes.enter('instrument', { song: fixtures.song(INPUT_SONG_NOTES),
    testChart: fixtures.chart(INPUT_SONG_NOTES, 'beginner'), countInBars: 0 });
  if (!entered.ok) throw new Error('the instrument mode did not start');
  FLM.Core.bus.on('input.event', (event) => {
    if (event.type === 'press' && LANE_CONTROL.test(event.control)) samples.push(FLM.Core.now() - event.tPerf);
  }, owner);
  await collectPresses(samples, wanted, assisted, owner);
  FLM.Core.bus.removeOwner(owner);
  const jitter = FLM.Input.anchor().spreadMs;
  await FLM.Modes.leave('user');
  const leaks = FLM.Modes.assertClean();
  if (leaks) notes.push('assertClean: ' + JSON.stringify(leaks));
  if (samples.length < wanted) notes.push('only ' + samples.length + ' of ' + wanted + ' presses arrived');
  const sorted = samples.slice().sort((a, b) => a - b);
  const metrics = sorted.length === 0 ? {} : { inputProcP95Ms: roundTo(percentile(sorted, P95)),
    inputProcMaxMs: roundTo(sorted[sorted.length - 1]), anchorJitterMs: roundTo(jitter) };
  return { metrics, samples: { inputProcP95Ms: sorted.length, inputProcMaxMs: sorted.length }, notes };
}

FLM.SelfTest.perf.register('input-latency', inputLatency);

// ------------------------------------------------------------------------------------------ chord-stress-1000 (PT-012)
// Part 9.6.4: 16 beats of 1,000 simultaneous notes over 8 tracks at 120 BPM, then 8 beats of silence, played through a
// Transport and the Scheduler of a private engine (a real context when the browser lets it run, else an offline one on
// the performance clock) with FLM.Instruments attached; the app engine is attached again at the end. A build without
// Instruments uses stand-in voices. The frame time waits for the renderer (Phase 05).
const CHORD_BEATS = 16;
const CHORD_SILENCE_BEATS = 8;
const CHORD_NOTES_PER_TRACK = 125;         // 8 tracks x 125 = 1,000 notes per beat
const CHORD_TRACKS = 8;
const CHORD_PROGRAMS = Object.freeze([0, 19, 48, 52, 61, 81, 89]);   // the eighth track is the drum kit
const CHORD_SEED = 0xF1A9;
const CHORD_BEAT_TICKS = 960;
const CHORD_NOTES_TOTAL = CHORD_BEATS * CHORD_TRACKS * CHORD_NOTES_PER_TRACK;
const DRUM_KEY_FIRST = 35;
const DRUM_KEY_COUNT = 47;                 // keys 35 to 81
const PITCH_FIRST = 21;
const PITCH_COUNT = 88;
const VELOCITY_MIN = 40;
const VELOCITY_SPAN = 81;                  // 40 to 120
const DRUM_CHANNEL = 9;
const STAND_IN_NODES = 2;                  // an oscillator and its gain: what a simple voice would hold
const STAND_IN_RELEASE_S = 0.05;
const SWEEP_MS = 20;
const SONG_END_LIMIT_MS = 30000;
const STOP_SETTLE_MS = 350;                // Part 9.1.2 rows 21 and 22: no voice 350 ms after stop
const LATE_TOLERANCE_S = 0.001;
const OVER_BUCKET = 41;                    // the first bucket above 4 ms
const SLOW_BUCKET = 30;                    // tick-body histogram bucket of 3 ms (0.1 ms buckets)
const MS_PER_SECOND = 1000;

function buildChordSong() {
  const Model = FLM.Model;
  const random = new FLM.Core.Prng(CHORD_SEED);
  const song = Model.Song.create({ title: 'Chord stress' });
  for (let index = 0; index < CHORD_TRACKS; index += 1) {
    const drums = index === CHORD_TRACKS - 1;
    const track = Model.Track.create({ name: 'Stress ' + (index + 1), program: drums ? 0 : CHORD_PROGRAMS[index],
      isDrums: drums }, song);
    const events = [];
    for (let beat = 0; beat < CHORD_BEATS; beat += 1) {
      for (let note = 0; note < CHORD_NOTES_PER_TRACK; note += 1) {
        const pitch = drums ? DRUM_KEY_FIRST + ((beat * CHORD_NOTES_PER_TRACK + note) % DRUM_KEY_COUNT)
          : PITCH_FIRST + random.int(PITCH_COUNT);
        events.push(Model.Events.note(beat * CHORD_BEAT_TICKS, CHORD_BEAT_TICKS, pitch,
          VELOCITY_MIN + random.int(VELOCITY_SPAN), drums ? DRUM_CHANNEL : 0));
      }
    }
    Model.replaceEvents(track, events);
    Model.Song.addTrack(song, track);
  }
  song.durationTicks = (CHORD_BEATS + CHORD_SILENCE_BEATS) * CHORD_BEAT_TICKS;
  return song;
}

/** Stand-in voices (a build without Instruments): a slot from the allocator and the node accounting of a small voice. */
function chordStandIn(engine, owner) {
  const pool = engine.VoiceAllocator;
  const sweep = () => {
    const now = engine.now();
    pool.list().forEach((slot) => {
      if (slot.state !== 'released' || slot.releaseEndAt > now) return;
      const voice = slot.voice;
      if (pool.free(slot) && voice) voice.dispose();
    });
  };
  FLM.Core.timers.setInterval(sweep, SWEEP_MS, owner);
  return { noteOn(track, event, atAudio, endAudio) {
    const slot = pool.acquire({ trackId: track.id, channel: event.channel, pitch: event.pitch, priority: 1 }, atAudio);
    engine.countNodes(STAND_IN_NODES);
    let ended = false;
    const end = () => {                      // stop (steal, hard panic) and dispose (sweep) both end the voice, once
      if (ended) return;
      ended = true;
      engine.countNodes(-STAND_IN_NODES);
    };
    slot.voice = { release() {}, stop: end, dispose: end, levelAt: () => 1 };
    pool.markReleased(slot, endAudio, endAudio + STAND_IN_RELEASE_S);
    return slot;
  }, control() {}, allNotesOff() {} };
}

/** A private engine for the scenario: a real context when the browser lets it run (voice nodes then end for real). */
async function chordEngine(bus, notes) {
  const Core = FLM.Core;
  try {
    const live = FLM.Audio.createEngine({ bus, mobile: Core.Caps.isMobile() });
    const result = await live.unlock();
    if (result.ok) return live;
    live.close();
    notes.push('the audio context did not run (' + result.reason + '): the scenario used an offline context');
  } catch (error) {
    notes.push('no live audio context: ' + error.message);
  }
  const context = new window.OfflineAudioContext(2, 48000, 48000);
  const clock = { now: () => Core.now() / MS_PER_SECOND };
  return FLM.Audio.createEngine({ context, clock, bus, mobile: Core.Caps.isMobile() });
}

async function chordStress() {
  const Core = FLM.Core;
  const owner = Symbol('perf-chord-stress');
  const notes = [];
  const bus = new Core.Emitter();
  const engine = await chordEngine(bus, notes);
  const clock = engine.clock();
  const appEngine = FLM.Audio.init();
  const real = FLM.Instruments && typeof FLM.Instruments.attach === 'function';
  const instruments = real ? FLM.Instruments : chordStandIn(engine, owner);
  if (real) FLM.Instruments.attach(engine);
  const song = buildChordSong();
  const transport = FLM.Transport.create({ clock, bus });
  transport.load(song);
  // The handler only records raw values; the lateness is worked out after the run, outside every tick (OI-37).
  const heard = { at: [], tick: [], voiced: [] };
  bus.on('sched.noteOn', (event) => {
    heard.at.push(event.at);
    heard.tick.push(event.tick);
    heard.voiced.push(event.voiced === true);
  }, owner);
  const baseNodes = engine.nodeCount();
  let nodesMax = baseNodes;
  engine.Scheduler.setInstruments(instruments);
  engine.Scheduler.bind(transport, song, {});
  if (real) await FLM.Instruments.warmupSong(song);        // as the mode setup does: nothing cold is left for the first tick
  transport.play({ countInBars: 1 });
  const timeline = { start: transport.audioTimeAt(0), perTick: (transport.audioTimeAt(CHORD_BEAT_TICKS) -
    transport.audioTimeAt(0)) / CHORD_BEAT_TICKS };      // constant tempo: the audio time of a tick is a straight line
  const builtBefore = real ? FLM.Instruments.stats() : null;
  const waitStarted = Core.now();
  while (transport.state() !== 'stopped' && Core.now() - waitStarted < SONG_END_LIMIT_MS) {
    await wait(SWEEP_MS, owner);
    nodesMax = Math.max(nodesMax, engine.nodeCount() - (real ? FLM.Instruments.stats().fadingNodes : 0));
  }
  if (transport.state() !== 'stopped') notes.push('the song did not reach its end in ' + SONG_END_LIMIT_MS + ' ms');
  await wait(STOP_SETTLE_MS, owner);
  const counts = engine.VoiceAllocator.stats();
  const scheduler = engine.Scheduler.stats();
  const histogram = engine.Scheduler.diagnostics().bodyHistogram;
  notes.push('items over 3 ms [end on the performance clock, ms, type]: ' + JSON.stringify(engine.Scheduler.diagnostics().slowItems));
  const sumFrom = (bucket) => histogram.slice(bucket).reduce((sum, count) => sum + count, 0);
  const slowTicks = sumFrom(SLOW_BUCKET);
  // Lateness counts the notes that got a voice; a note the chord rule left without one (D81) has no sound to be late.
  const late = { notes: 0, chords: 0, voiceless: 0 };
  const seenChords = new Set();
  for (let index = 0; index < heard.at.length; index += 1) {
    if (!heard.voiced[index]) {
      late.voiceless += 1;
      continue;
    }
    const isLate = heard.at[index] - (timeline.start + heard.tick[index] * timeline.perTick) > LATE_TOLERANCE_S;
    if (isLate) late.notes += 1;
    // The first note of a chord is late only when the backlog of the chord before it is still being booked.
    if (!seenChords.has(heard.tick[index])) {
      seenChords.add(heard.tick[index]);
      if (isLate) late.chords += 1;
    }
  }
  notes.push('ticks with a body over ' + SLOW_BUCKET / 10 + ' ms: ' + slowTicks + ' of ' + scheduler.ticks +
    ' (over 4 ms: ' + sumFrom(OVER_BUCKET) + ', over 8 ms: ' + sumFrom(OVER_BUCKET * 2) + '; late voiced notes: ' + late.notes + ', notes without a voice: ' + late.voiceless + ', chords that started late: ' + late.chords + ', clamped items: ' + scheduler.clamped + ', skipped: ' + scheduler.skipped + ', longest pull ' +
    roundTo(scheduler.pullMaxMs) + ' ms, longest item ' + roundTo(scheduler.itemMaxMs) + ' ms: ' + scheduler.itemMaxWhat + ')');
  const activeAfterStop = engine.VoiceAllocator.activeCount();
  engine.Scheduler.unbind();
  const nodesAfter = engine.nodeCount();
  // The cost of a voice: the time Instruments spent building voices, divided by the voices it built (Part 9.1).
  const after = real ? FLM.Instruments.stats() : null;
  const built = real ? after.voicesBuilt - builtBefore.voicesBuilt : counts.started;
  const buildMean = built > 0 && real ? (after.voiceBuildMs - builtBefore.voiceBuildMs) / built : 0;
  Core.timers.clearOwner(owner);
  bus.removeOwner(owner);
  engine.close();
  if (real) FLM.Instruments.attach(appEngine);
  notes.push(real ? 'voices: FLM.Instruments' : 'stand-in voices (no Instruments in this build)');
  notes.push('frameP95Ms waits for the renderer (Phase 05)');
  return { metrics: { voicesMax: counts.peakActive, stolen: counts.stolen, dropped: counts.dropped,
    started: counts.started, accountError: Math.abs(counts.started + counts.dropped - CHORD_NOTES_TOTAL),
    tickWorkMaxMs: roundTo(scheduler.tickWorkMaxMs), voiceBuildMeanMs: roundTo(buildMean), lateEvents: late.chords, lateNotes: late.notes,
    activeVoicesAfterStop: activeAfterStop, audioNodesExcess: nodesAfter - baseNodes,
    audioNodesMax: nodesMax - baseNodes, errors: scheduler.errors },
  samples: { tickWorkMaxMs: scheduler.ticks }, notes };
}

FLM.SelfTest.perf.register('chord-stress-1000', chordStress);

// ------------------------------------------------------------------------------------------ content-expand (PT-018)
// Part 9.7: the five demos expanded from their notation, cold; the chart generation half waits for Phase 08.
const EXPAND_RUNS = 3;

function contentExpand() {
  const Core = FLM.Core;
  const times = [];
  FLM.Content.ARRANGEMENTS.forEach((arrangement) => {
    let best = Infinity;
    for (let run = 0; run < EXPAND_RUNS; run += 1) {
      const started = Core.now();
      FLM.Content.expand(arrangement);
      best = Math.min(best, Core.now() - started);
    }
    times.push(best);
  });
  return { metrics: { expandMaxMs: roundTo(Math.max(...times)) }, samples: { expandMaxMs: times.length },
    notes: ['the best of ' + EXPAND_RUNS + ' runs per song; chartBuiltinMaxMs waits for Phase 08'] };
}

FLM.SelfTest.perf.register('content-expand', contentExpand);

// ------------------------------------------------------------------------------------------ playback-dense (PT-004)
// Part 9.7: the `instrument` mode on the electronic demo with every track audible, on the real audio clock. The chart bot
// and the frame metrics wait for Phase 08 and Phase 05; the scheduler metrics are the ones of PT-004.
const DENSE_SECONDS = 30;                  // at least this long
const DENSE_MIN_EVENTS = 5000;             // row 12: at least 5,000 emitted sched.noteOn events for lookaheadMaxMs and schedErrorMaxMs
const DENSE_MAX_SECONDS = 300;
const DENSE_SPEED = 2;                     // demo-electro has about 15 notes a second: at twice the speed, looped, 5,000 take about 3 minutes
const SETTLE_AUDIO_S = 0.5;                // events are checked this long after their time, when every loop wrap is known
const DENSE_POLL_MS = 250;
const DENSE_SONG = 'demo-electro';
const HISTOGRAM_P50 = 0.5;

function histogramQuantile(buckets, fraction) {
  const total = buckets.reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;
  let seen = 0;
  for (let index = 0; index < buckets.length; index += 1) {
    seen += buckets[index];
    if (seen >= total * fraction) return index;
  }
  return buckets.length - 1;
}

function histogramMax(buckets) {
  for (let index = buckets.length - 1; index >= 0; index -= 1) if (buckets[index] > 0) return index;
  return 0;
}

async function enterPlayback(songId, owner) {
  const unlocked = await FLM.Audio.unlock();
  if (!unlocked.ok) throw new Error('the audio context did not run (' + unlocked.reason + ')');
  const entered = await FLM.Modes.enter('instrument', { song: FLM.Project.Catalog.getSong(songId), testChart: null,
    countInBars: 0 });
  if (!entered.ok) throw new Error('the instrument mode did not start');
  void owner;
}

async function playbackDense() {
  const owner = Symbol('perf-playback-dense');
  await enterPlayback(DENSE_SONG, owner);
  const main = FLM.Transport.main;
  const bus = FLM.Core.bus;
  const song = FLM.Project.Catalog.getSong(DENSE_SONG);
  // The handlers only record raw values; schedErrorMaxMs is worked out between ticks, in the polling loop (OI-37).
  const heard = { at: [], tick: [], late: [] };
  const wraps = [];
  bus.on('sched.noteOn', (event) => {
    heard.at.push(event.at);
    heard.tick.push(event.tick);
    heard.late.push(event.late === true);
  }, owner);
  bus.on('transport.loop', (event) => wraps.push(event.atAudioTime), owner);
  main.setSpeed(DENSE_SPEED);
  main.setLoop({ a: 0, b: song.durationTicks });
  let cursor = 0;
  let passed = 0;                              // the loop wraps whose time is not after the event being checked
  let checked = 0;
  let schedErrorMax = 0;
  const checkEvents = () => {
    const limit = FLM.Audio.now() - SETTLE_AUDIO_S;
    for (; cursor < heard.at.length && heard.at[cursor] <= limit; cursor += 1) {
      if (heard.late[cursor]) continue;                     // a clamped event is counted by lateEvents, not here
      while (passed < wraps.length && wraps[passed] <= heard.at[cursor]) passed += 1;     // events come in time order
      if (passed !== wraps.length) continue;                // booked on an earlier pass of the loop: the mapping has moved on
      schedErrorMax = Math.max(schedErrorMax, Math.abs(heard.at[cursor] - main.audioTimeAt(heard.tick[cursor])));
      checked += 1;
    }
  };
  const started = FLM.Core.now();
  while (FLM.Core.now() - started < DENSE_MAX_SECONDS * MS_PER_SECOND) {
    await wait(DENSE_POLL_MS, owner);
    checkEvents();
    const enough = checked >= DENSE_MIN_EVENTS && FLM.Core.now() - started >= DENSE_SECONDS * MS_PER_SECOND;
    if (enough) break;
  }
  FLM.Core.bus.removeOwner(owner);
  const diagnostics = FLM.Audio.Scheduler.diagnostics();
  const voices = FLM.Audio.VoiceAllocator.stats();
  const dropped = diagnostics.skipped;
  await FLM.Modes.leave('user');
  const leaks = FLM.Modes.assertClean();
  const seconds = roundTo((FLM.Core.now() - started) / MS_PER_SECOND);
  const notes = ['frame metrics wait for the renderer (Phase 05), the chart bot for Phase 08; ' + seconds + ' s of ' + DENSE_SONG +
    ' looped at speed ' + DENSE_SPEED + ' (about 15 notes a second at speed 1, so 5,000 events need the longer run), ' +
    heard.at.length + ' events, ' + checked + ' checked for schedErrorMaxMs, ' + wraps.length + ' loop wraps; longest pull ' +
    roundTo(diagnostics.pullMaxMs) + ' ms, longest item ' + roundTo(diagnostics.itemMaxMs) + ' ms (' + diagnostics.itemMaxWhat + ')'];
  if (leaks) notes.push('assertClean: ' + JSON.stringify(leaks));
  return { metrics: { lookaheadMaxMs: roundTo(diagnostics.lookaheadMaxMs),
    tickIntervalP50Ms: histogramQuantile(diagnostics.intervalHistogram, HISTOGRAM_P50),
    tickIntervalP95Ms: histogramQuantile(diagnostics.intervalHistogram, P95),
    tickIntervalMaxMs: histogramMax(diagnostics.intervalHistogram), tickWorkMaxMs: roundTo(diagnostics.tickWorkMaxMs),
    schedErrorMaxMs: roundTo(schedErrorMax), lateEvents: diagnostics.clamped, stalls: diagnostics.stalls, droppedStale: dropped,
    voicesMax: voices.peakActive },
  samples: { lookaheadMaxMs: heard.at.length, tickIntervalP50Ms: diagnostics.ticks, tickIntervalP95Ms: diagnostics.ticks,
    tickIntervalMaxMs: diagnostics.ticks, tickWorkMaxMs: diagnostics.ticks, schedErrorMaxMs: checked, lateEvents: heard.at.length },
  notes };
}

FLM.SelfTest.perf.register('playback-dense', playbackDense);

// ------------------------------------------------------------------------------------------ loop-drift-short (PT-007)
// Part 9.7 row 15: a 4-bar loop (8 s) of the first verse of the pop-rock demo for 60 s on the real clock. driftMs is the
// largest distance of a wrap from where the first wrap plus whole loop lengths puts it.
const LOOP_SECONDS = 60;
const LOOP_SONG = 'demo-poprock';
const LOOP_BAR = 3840;
const LOOP_FIRST_BAR = 4;
const LOOP_BARS = 4;
const LOOP_LENGTH_S = 8;

async function loopDriftShort() {
  const owner = Symbol('perf-loop-drift');
  await enterPlayback(LOOP_SONG, owner);
  const main = FLM.Transport.main;
  const wraps = [];
  FLM.Core.bus.on('transport.loop', (event) => wraps.push(event.atAudioTime), owner);
  main.setLoop({ a: LOOP_FIRST_BAR * LOOP_BAR, b: (LOOP_FIRST_BAR + LOOP_BARS) * LOOP_BAR });
  main.seek(LOOP_FIRST_BAR * LOOP_BAR);
  const started = FLM.Core.now();
  while (FLM.Core.now() - started < LOOP_SECONDS * MS_PER_SECOND) await wait(DENSE_POLL_MS, owner);
  FLM.Core.bus.removeOwner(owner);
  const stalls = FLM.Audio.Scheduler.diagnostics().stalls;
  await FLM.Modes.leave('user');
  const notes = [wraps.length + ' wraps in ' + LOOP_SECONDS + ' s, ' + stalls + ' stalls'];
  if (wraps.length < 2) throw new Error('fewer than two loop wraps: ' + wraps.length);
  let worst = 0;
  wraps.forEach((time, index) => { worst = Math.max(worst, Math.abs(time - wraps[0] - index * LOOP_LENGTH_S)); });
  return { metrics: { driftMs: roundTo(worst * MS_PER_SECOND), wraps: wraps.length }, samples: { driftMs: wraps.length },
    notes };
}

FLM.SelfTest.perf.register('loop-drift-short', loopDriftShort);
})();
