// 91-test-audio.js - unit tests for M-05 FLM.Audio (group 'audio'; test build only).
// T04.01 delivers UT-05-01 to UT-05-05 and UT-05-33 (the context lifecycle and the unlock gesture); T04.02 delivers
// UT-05-06 to UT-05-11, UT-05-25, UT-05-26 and UT-05-28 (bus graph, strips, fades, metronome, peak meter). T04.03
// delivers UT-05-12 to UT-05-14 and UT-05-32 (VoiceAllocator, voices event); T04.04 delivers UT-05-15 to UT-05-21,
// UT-05-24, UT-05-29 and UT-05-31 (Scheduler: lookahead, late items, payloads, stalls, seek, loop) plus the bind and
// fault checks of its entry. UT-05-22, UT-05-23 and UT-05-30 belong to T04.05 and T04.06. Offline tests render on an
// OfflineAudioContext with an injected clock (Part 6.5.4.10); stand-in contexts come from t.fakes.fakeAudioContext;
// the Scheduler tests run on fake timers and tick by hand (tickOnce). A stand-in M-06 (stubInstruments) takes slots
// from the allocator the way Instruments will. A lower-case letter after an id marks an extra check of that row.
// Real sound output cannot be judged here (LT-033 runs at Phase 15); every onset is read from a rendered buffer.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('audio', (t) => {
  const Core = FLM.Core;
  const Audio = FLM.Audio;
  const SAMPLE_RATE = 48000;
  const QUANTUM_S = 128 / SAMPLE_RATE;
  const UNLOCK_WAIT_MS = 1000;
  const FADE_OUT_S = 0.03;
  const DC_LEVEL = 0.3;                      // below the limiter threshold (-6 dB = 0.5): the limiter stays linear
  const WINDOW_S = 0.002;
  const LIMITER_DELAY_S = 0.006;             // the limiter looks ahead about 6 ms, so its output trails the input
  const TONE_HZ = 440;
  const MUTE_AT = 1 + 0.25 / TONE_HZ;        // a quarter period after 1.0 s: the tone peaks there, a step would show
  const SILENCE = 0.0025;                    // the click envelope ends at 0.001; the limiter adds about 3 dB
  const engines = [];

  t.afterEach(() => {
    engines.splice(0).forEach((engine) => engine.close());
  });

  // ------------------------------------------------------------------------------------------- helpers
  /** An engine on a private bus and a fake clock; offline: render seconds long. Volumes start at 100 %. */
  function makeEngine(extra) {
    const settings = Object.assign({ seconds: 1, rate: SAMPLE_RATE }, extra);
    const context = new window.OfflineAudioContext(2, Math.ceil(settings.seconds * settings.rate), settings.rate);
    const clock = t.fakes.clock();
    const bus = new Core.Emitter();
    const readSetting = (path) => (path === 'audio.polyphonyCap' ? 0 : 1);      // 0: automatic polyphony
    const engine = Audio.createEngine({ context, clock, bus, mobile: false, readSetting });
    engines.push(engine);
    return { engine, context, clock, bus };
  }

  function record(bus, topic) {
    const list = [];
    bus.on(topic, (event) => list.push(event), t.owner);
    return list;
  }

  /** An engine on a stand-in context (the factory counts its calls); the engine is created, not yet initialized. */
  function makeStubbed(settings) {
    const fake = t.fakes.fakeAudioContext(settings);
    const bus = new Core.Emitter();
    const factory = t.fakes.spy(() => fake.context);
    const engine = Audio.createEngine({ contextFactory: factory, bus, mobile: false });
    engines.push(engine);
    return Object.assign({ engine, bus, factory }, fake);
  }

  const rendered = async (context) => (await context.startRendering()).getChannelData(0);

  function constantInto(context, node, level) {
    const source = context.createConstantSource();
    source.offset.value = level;
    source.connect(node);
    source.start(0);
    return source;
  }

  /** Mean absolute sample in the 2 ms after `seconds`. */
  function levelAt(data, seconds) {
    const first = Math.round(seconds * SAMPLE_RATE);
    const count = Math.round(WINDOW_S * SAMPLE_RATE);
    let sum = 0;
    for (let index = first; index < first + count; index += 1) sum += Math.abs(data[index]);
    return sum / count;
  }

  function largestStep(data, fromSeconds, toSeconds) {
    let step = 0;
    for (let index = Math.round(fromSeconds * SAMPLE_RATE); index < Math.round(toSeconds * SAMPLE_RATE); index += 1) {
      step = Math.max(step, Math.abs(data[index + 1] - data[index]));
    }
    return step;
  }

  function largestSample(data, fromSeconds, toSeconds) {
    let largest = 0;
    for (let index = Math.round(fromSeconds * SAMPLE_RATE); index < Math.round(toSeconds * SAMPLE_RATE); index += 1) {
      largest = Math.max(largest, Math.abs(data[index]));
    }
    return largest;
  }

  // ------------------------------------------------------------------------------------------- T04.01
  t.test('UT-05-01 unlock reports blocked state', async () => {
    const stub = makeStubbed();
    const unlocked = record(stub.bus, 'audio.unlocked');
    const result = await stub.engine.unlock();
    t.deepEq(result, { ok: false, state: 'suspended', reason: 'E-AUD-002' });
    t.eq(unlocked.length, 0, 'no audio.unlocked');
    t.eq(stub.engine.isUnlocked(), false);
    t.eq(stub.factory.count, 1, 'the context exists, suspended');
  });

  t.test('UT-05-01b a successful unlock resumes inside the call and publishes once', async () => {
    const stub = makeStubbed();
    const resume = t.fakes.spy(() => { stub.setState('running'); return Promise.resolve(); });
    stub.overrides.resume = resume;
    stub.overrides.baseLatency = 0.01;
    stub.overrides.outputLatency = 0.02;
    const unlocked = record(stub.bus, 'audio.unlocked');
    const states = record(stub.bus, 'audio.state');
    const pending = stub.engine.unlock();
    t.eq(resume.count, 1, 'resume() ran synchronously, inside the gesture handler');
    t.deepEq(await pending, { ok: true, state: 'running' });
    t.eq(stub.engine.isUnlocked(), true);
    t.eq(unlocked.length, 1);
    t.eq(unlocked[0].sampleRate, SAMPLE_RATE);
    t.near(unlocked[0].latencyMs, 30, 1e-6);
    t.eq(unlocked[0].attempts, 1);
    t.deepEq(states.map((event) => event.state), ['suspended', 'running']);
    t.eq(states[1].previous, 'suspended');
    await stub.engine.unlock();
    t.eq(resume.count, 1, 'a running context is not resumed again');
    t.eq(unlocked.length, 1, 'audio.unlocked only once');
  });

  t.test('UT-05-01c unlock stops waiting after one second without running', async () => {
    const stub = makeStubbed({ resume: () => new Promise(() => {}) });
    const timers = t.fakes.timers();
    timers.install();
    const pending = stub.engine.unlock();
    timers.advance(UNLOCK_WAIT_MS);
    timers.uninstall();
    t.deepEq(await pending, { ok: false, state: 'suspended', reason: 'E-AUD-002' });
    t.eq(stub.engine.isUnlocked(), false);
  });

  t.test('UT-05-01d the playback audio session is requested inside a try (RISK-71)', async () => {
    const session = { type: 'auto' };
    Object.defineProperty(window.navigator, 'audioSession', { configurable: true, value: session });
    try {
      await makeStubbed().engine.unlock();
      t.eq(session.type, 'playback');
      const refusing = { set type(value) { throw new Error('refused ' + value); } };
      Object.defineProperty(window.navigator, 'audioSession', { configurable: true, value: refusing });
      const result = await makeStubbed().engine.unlock();
      t.eq(result.reason, 'E-AUD-002', 'a throwing audioSession does not stop unlock');
    } finally {
      delete window.navigator.audioSession;
    }
  });

  t.test('UT-05-02 constructor failure', async () => {
    const bus = new Core.Emitter();
    const factory = t.fakes.spy(() => { throw new Error('AudioContext is not allowed'); });
    const engine = Audio.createEngine({ contextFactory: factory, bus });
    engines.push(engine);
    Core.ErrorReporter._resetForTests();
    try {
      t.throws(() => engine.init(), 'E-AUD-001');
      t.eq(engine.state(), 'none');
      const record = Core.ErrorReporter.records().find((item) => item.code === 'E-AUD-001');
      t.ok(record, 'E-AUD-001 was reported');
      t.eq(record.class, 'reload');
      const result = await engine.unlock();
      t.deepEq(result, { ok: false, state: 'none', reason: 'E-AUD-001' });
      t.eq(engine.isUnlocked(), false);
    } finally {
      Core.ErrorReporter._resetForTests();
    }
  });

  t.test('UT-05-03 statechange emits', () => {
    const stub = makeStubbed({ state: 'running' });
    const states = record(stub.bus, 'audio.state');
    stub.engine.init();
    t.deepEq(states.map((event) => event.state), ['running']);
    t.eq(states[0].reason, 'init');
    stub.setState('suspended');
    t.eq(states.length, 2);
    t.eq(states[1].state, 'suspended');
    t.eq(states[1].previous, 'running');
    t.eq(states[1].reason, 'statechange');
    stub.setState('suspended');
    t.eq(states.length, 2, 'a repeated state is not published again');
    stub.setState('interrupted');
    t.eq(states[2].state, 'interrupted');
    t.eq(stub.engine.state(), 'interrupted');
  });

  t.test('UT-05-04 stall detection', () => {
    const { engine, clock, bus } = makeEngine();
    const states = record(bus, 'audio.state');
    engine.init();
    const before = states.length;
    const stalls = () => states.slice(before).filter((event) => event.reason === 'stalled');
    clock.set(2);
    engine.observeTick(clock.now());
    engine.observeTick(clock.now());
    engine.observeTick(clock.now());
    t.eq(stalls().length, 0, 'two repeats are not a stall');
    t.eq(engine.observeTick(clock.now()), true, 'the third repeat announces it');
    t.eq(stalls().length, 1);
    t.eq(stalls()[0].state, engine.state());
    engine.observeTick(clock.now());
    engine.observeTick(clock.now());
    t.eq(stalls().length, 1, 'once per stall');
    clock.set(2.025);
    t.eq(engine.observeTick(clock.now()), false, 'a moving clock starts over');
    [1, 2, 3].forEach(() => engine.observeTick(clock.now()));
    t.eq(stalls().length, 2, 'a second stall is announced again');
  });

  t.test('UT-05-05 single context', async () => {
    const stub = makeStubbed();
    const first = stub.engine.unlock();
    const second = stub.engine.unlock();
    t.ok(first === second, 'the same promise while pending');
    await first;
    await stub.engine.unlock();
    t.eq(stub.factory.count, 1, 'one constructor call for concurrent and sequential unlocks');
    t.ok(stub.engine.init() === stub.engine.init(), 'init is idempotent and returns the engine');
    t.eq(stub.factory.count, 1);
    t.eq(stub.engine.ctxCount(), 1);
    t.ok(stub.engine.ctx() === stub.context);
  });

  t.test('UT-05-05b the app engine is one object with one context for the whole page', () => {
    const engine = Audio.init();
    t.ok(Audio.init({ mobile: true }) === engine, 'a second init returns the same engine');
    t.eq(Audio.ctxCount(), 1);
    t.ok(Audio.ctx() instanceof window.AudioContext, 'a real AudioContext');
    t.ok(Audio.clock() === Audio.clock(), 'one clock object');
    t.ok(Audio.clock().now() >= 0);
  });

  t.test('UT-05-05c resume() unlocks inside the call and answers with a boolean', async () => {
    const stub = makeStubbed();
    const resume = t.fakes.spy(() => { stub.setState('running'); return Promise.resolve(); });
    stub.overrides.resume = resume;
    const pending = stub.engine.resume();
    t.eq(resume.count, 1);
    t.eq(await pending, true);
    stub.setState('interrupted');
    t.eq(await stub.engine.resume(), true, 'an interrupted context is resumed again');
    t.eq(resume.count, 2);
    stub.overrides.resume = () => Promise.resolve();
    stub.setState('suspended');
    t.eq(await stub.engine.resume(), false, 'a context that stays suspended answers false');
  });

  t.test('UT-05-33 close closes', () => {
    const stub = makeStubbed({ state: 'running' });
    const close = t.fakes.spy(() => Promise.resolve());
    stub.overrides.close = close;
    stub.engine.init();
    const baseline = Core.timers.count();
    const off = stub.engine.subscribePeak(() => {}, t.owner);
    t.eq(Core.timers.count(), baseline + 1, 'the peak feed owns one interval');
    const states = record(stub.bus, 'audio.state');
    stub.engine.createStrip('a');
    stub.engine.close();
    t.eq(close.count, 1, 'ctx.close was called');
    t.eq(Core.timers.count(), baseline, 'the interval is gone');
    t.eq(stub.engine.stripCount(), 0);
    t.eq(stub.engine.state(), 'closed');
    t.eq(stub.engine.isUnlocked(), false);
    t.eq(states[states.length - 1].state, 'closed');
    off();
    stub.engine.close();
    t.eq(close.count, 1, 'a second close does nothing');
  });

  // ------------------------------------------------------------------------------------------- T04.02
  /** Records the connect() edges of every node the engine creates, so the topology can be read back. */
  function edgeRecorder(stub) {
    const edges = [];
    const nodes = {};
    ['createGain', 'createDynamicsCompressor', 'createAnalyser'].forEach((factoryName) => {
      stub.overrides[factoryName] = () => {
        const node = stub.inner[factoryName]();
        const connect = node.connect.bind(node);
        node.connect = (destination, ...rest) => {
          edges.push([node, destination]);
          return connect(destination, ...rest);
        };
        (nodes[factoryName] = nodes[factoryName] || []).push(node);
        return node;
      };
    });
    return { edges, nodes };
  }

  t.test('UT-05-06 graph topology', () => {
    const stub = makeStubbed({ state: 'running' });
    const rec = edgeRecorder(stub);
    stub.engine.init();
    const { master, limiter, metronomeBus } = stub.engine;
    const analyser = stub.engine.analyser;
    const has = (from, to) => rec.edges.some((edge) => edge[0] === from && edge[1] === to);
    t.ok(has(master, limiter), 'master -> limiter');
    t.ok(has(limiter, stub.inner.destination), 'limiter -> destination');
    t.ok(has(master, analyser), 'the analyser listens beside the path');
    t.ok(has(metronomeBus, master), 'the metronome bus joins at the master');
    t.ok(!rec.edges.some((edge) => edge[0] === analyser), 'nothing is connected after the analyser');
    t.ok(!rec.edges.some((edge) => edge[1] === stub.inner.destination && edge[0] !== limiter), 'only the limiter');
    t.eq(analyser.fftSize, 1024);
    Object.keys(Audio.LIMITER).forEach((name) => t.near(limiter[name].value, Audio.LIMITER[name], 1e-6, name));
    t.deepEq(Audio.LIMITER, { threshold: -6, knee: 6, ratio: 12, attack: 0.003, release: 0.25 });
  });

  t.test('UT-05-06b the app engine builds the graph on the real context', () => {
    t.ok(Audio.master instanceof window.GainNode);
    t.ok(Audio.limiter instanceof window.DynamicsCompressorNode);
    t.ok(Audio.metronomeBus instanceof window.GainNode);
    Object.keys(Audio.LIMITER).forEach((name) => t.near(Audio.limiter[name].value, Audio.LIMITER[name], 1e-6, name));
    t.eq(Audio.state(), 'running', 'the headless autoplay flag lets the unlock of boot succeed');
    t.eq(Audio.isUnlocked(), true);
    t.eq(Audio.stripCount(), 0, 'no strip is left over');
  });

  t.test('UT-05-07 strip creation and reuse', () => {
    const { engine } = makeEngine();
    const strip = engine.createStrip('t1');
    t.ok(engine.createStrip('t1') === strip, 'the same strip while it exists');
    t.eq(engine.stripCount(), 1);
    t.eq(strip.trackId, 't1');
    engine.createStrip('t2');
    t.deepEq(engine.strips().map((item) => item.trackId), ['t1', 't2']);
    engine.disposeStrip('t1');
    t.eq(engine.stripCount(), 1);
    t.deepEq(engine.strips().map((item) => item.trackId), ['t2']);
    const again = engine.createStrip('t1');
    t.ok(again !== strip, 'a new strip after the removal');
    strip.dispose();
    t.eq(engine.stripCount(), 2, 'disposing an old handle changes nothing');
    t.ok(engine.strips().includes(again));
    engine.disposeStrip('missing');
    t.throws(() => engine.createStrip(''), 'E-GEN-004');
    t.throws(() => engine.createStrip(7), 'E-GEN-004');
    t.throws(() => Audio.createEngine({ bus: new Core.Emitter() }).createStrip('x'), 'E-GEN-004');
  });

  t.test('UT-05-08 pan fallback', () => {
    const stub = makeStubbed({ state: 'running', createStereoPanner: undefined });
    stub.engine.init();
    const strip = stub.engine.createStrip('t1');
    t.ok(strip.pan instanceof window.PannerNode, 'a PannerNode without StereoPanner');
    t.eq(strip.pan.panningModel, 'equalpower');
    strip.setPan(-1);
    t.eq(strip.pan.positionX.value, -1);
    t.eq(strip.pan.positionY.value, 0);
    t.eq(strip.pan.positionZ.value, 0, 'z = 1 - abs(pan)');
    strip.setPan(0.5);
    t.eq(strip.pan.positionX.value, 0.5);
    t.eq(strip.pan.positionZ.value, 0.5);
    t.ok(makeEngine().engine.createStrip('s').pan instanceof window.StereoPannerNode, 'the usual case');
  });

  t.test('UT-05-09 solo set semantics', async () => {
    const { engine, context } = makeEngine();
    const a = engine.createStrip('a');
    const b = engine.createStrip('b');
    const c = engine.createStrip('c');
    const flags = () => [a, b, c].map((strip) => strip.effectiveMuted());
    t.deepEq(flags(), [false, false, false]);
    a.setSolo(true);
    t.deepEq(flags(), [false, true, true]);
    engine.setSolo('b', true);
    t.deepEq(flags(), [false, false, true]);
    t.deepEq(Array.from(engine.soloSet()), ['a', 'b']);
    engine.setSolo('a', false);
    engine.setSolo('b', false);
    t.deepEq(flags(), [false, false, false]);
    b.setMute(true);
    t.deepEq(flags(), [false, true, false], 'mute is separate from solo');
    a.setSolo(true);
    b.setMute(false);
    t.deepEq(flags(), [false, true, true]);
    engine.disposeStrip('a');
    t.deepEq([b, c].map((strip) => strip.effectiveMuted()), [false, false], 'removing the only solo lifts the others');
    engine.setSolo('c', true);
    constantInto(context, b.input, DC_LEVEL);
    const data = await rendered(context);
    t.ok(levelAt(data, 0.5) < 1e-4, 'a silenced strip makes no sound');
    t.eq(engine.setMute('nobody', true), false);
  });

  t.test('UT-05-10 mute ramps not steps', async () => {
    const { engine, context, clock } = makeEngine({ seconds: 1.5 });
    const strip = engine.createStrip('t1');
    const tone = context.createOscillator();
    tone.frequency.value = TONE_HZ;
    tone.connect(strip.input);
    tone.start(0);
    clock.set(MUTE_AT);
    t.eq(engine.setMute('t1', true), true);
    const data = await rendered(context);
    t.ok(largestSample(data, 0.5, 0.9) > 0.3, 'the tone sounds before the mute');
    t.ok(largestStep(data, 0.9, 1.1) <= 0.2, 'no sample-to-sample jump above 0.2 around 1.0 s');
    t.ok(largestSample(data, MUTE_AT + 0.02, 1.5) < 1e-3, 'silence within 20 ms of the mute (R-P6.2-03)');
  });

  t.test('UT-05-11 gain product CC7 x CC11 x fader', async () => {
    const strip = makeEngine().engine.createStrip('t1');
    strip.setGain(0.5);
    strip.setVolumeCC(0.5);
    strip.setExpression(0.5);
    t.eq(strip.commandedGain(), 0.125);
    strip.setGain(9);
    t.eq(strip.commandedGain(), 2 * 0.25, 'the fader stops at 200 %');
    t.throws(() => strip.setGain(NaN), 'E-GEN-004');
    t.throws(() => strip.setPan('left'), 'E-GEN-004');
    strip.setPan(7);
    t.eq(strip.mixState().pan, 1, 'pan is clamped to -1..1');
    const levels = [];
    for (const setup of [(item) => { item.setGain(0.5); item.setVolumeCC(0.5); item.setExpression(0.5); },
      (item) => item.setGain(0.125)]) {
      const { engine, context } = makeEngine();
      const probe = engine.createStrip('p');
      setup(probe);
      constantInto(context, probe.input, DC_LEVEL);
      levels.push(levelAt(await rendered(context), 0.5));
    }
    t.ok(levels[0] > 0.01, 'sound comes out');
    t.near(levels[0], levels[1], levels[1] * 0.001, 'the three controls make the same sound as one fader at 0.125');
  });

  t.test('UT-05-11b the strip keeps its mix for a later rebuild', () => {
    const { engine } = makeEngine();
    const strip = engine.createStrip('t1');
    strip.setGain(0.3);
    strip.setPan(-0.5);
    strip.setMute(true);
    strip.setSolo(true);
    t.deepEq(strip.mixState(), { gain: 0.3, pan: -0.5, ccVolume: 1, expression: 1, mute: true, solo: true });
  });

  t.test('UT-05-25 pause and stop fade', async () => {
    const { engine, context, clock, bus } = makeEngine({ seconds: 2 });
    const strip = engine.createStrip('t1');
    constantInto(context, strip.input, DC_LEVEL);
    clock.set(0.5);
    bus.emit('transport.state', { state: 'paused', prev: 'playing' });
    clock.set(1);
    bus.emit('transport.state', { state: 'playing', prev: 'paused' });
    const data = await rendered(context);
    const steady = levelAt(data, 0.4);
    t.ok(steady > 0.05, 'sound before the pause');
    t.near(levelAt(data, 0.5 + FADE_OUT_S / 2 + LIMITER_DELAY_S) / steady, 0.5, 0.1, 'halfway down after 15 ms');
    t.ok(levelAt(data, 0.5 + FADE_OUT_S + LIMITER_DELAY_S + 0.005) < steady * 0.001, 'silent after the 30 ms fade');
    t.ok(levelAt(data, 0.9) < steady * 0.001, 'held at silence while paused');
    t.near(levelAt(data, 1 + Audio.START_FADE_S / 2 + LIMITER_DELAY_S) / steady, 0.5, 0.1, 'halfway up after 10 ms');
    t.near(levelAt(data, 1 + Audio.START_FADE_S + LIMITER_DELAY_S + 0.005) / steady, 1, 0.01,
      'back to the volume after 20 ms');
    t.ok(largestStep(data, 0.45, 1.1) < steady * 0.05, 'the ramps have no step');
  });

  t.test('UT-05-25b stop dips the master and brings it back; a volume change while paused waits for the resume',
    async () => {
      const { engine, context, clock, bus } = makeEngine({ seconds: 2 });
      constantInto(context, engine.createStrip('t1').input, DC_LEVEL);
      clock.set(0.5);
      bus.emit('transport.state', { state: 'stopped', prev: 'playing' });
      clock.set(1);
      bus.emit('transport.state', { state: 'paused', prev: 'playing' });
      clock.set(1.2);
      engine.setMasterGain(0.5);
      clock.set(1.5);
      bus.emit('transport.state', { state: 'countin', prev: 'paused' });
      const data = await rendered(context);
      const steady = levelAt(data, 0.4);
      t.ok(levelAt(data, 0.5 + FADE_OUT_S + LIMITER_DELAY_S - 0.001) < steady * 0.05, 'the dip reaches silence');
      t.near(levelAt(data, 0.7) / steady, 1, 0.01, 'and returns to the volume');
      t.ok(levelAt(data, 1.4) < steady * 0.001, 'still silent while paused');
      t.near(levelAt(data, 1.7) / steady, 0.5, 0.01, 'the new volume applies after the resume');
    });

  t.test('UT-05-26 metronome click shape', async () => {
    const { engine, context } = makeEngine();
    engine.Metronome.click(0.1, true);
    engine.Metronome.click(0.5, false);
    const data = await rendered(context);
    const accent = largestSample(data, 0.1, 0.2);
    const normal = largestSample(data, 0.5, 0.6);
    t.ok(normal > 0.05, 'the normal click sounds');
    t.ok(accent > normal, 'the accent is louder');
    t.ok(largestSample(data, 0.1 + 0.07, 0.2) < SILENCE, 'the accent is over after 60 ms');
    t.ok(largestSample(data, 0.5 + 0.05, 0.6) < SILENCE, 'the normal click is over after 40 ms');
    t.ok(largestSample(data, 0.5 + 0.01, 0.5 + 0.02) > 0.01, 'the normal click is still sounding at 10 ms');
    t.throws(() => engine.Metronome.click('now', true), 'E-GEN-004');
  });

  t.test('UT-05-26b the metronome volume does not move the strips', async () => {
    const readings = [];
    for (const volume of [0.3, 0.15]) {
      const { engine, context } = makeEngine();
      engine.setMetronomeGain(volume);
      constantInto(context, engine.createStrip('t1').input, DC_LEVEL).stop(0.2);
      engine.Metronome.click(0.3, false);       // 0.7 x volume stays below the limiter threshold: linear
      const data = await rendered(context);
      readings.push({ strip: levelAt(data, 0.1), click: largestSample(data, 0.3, 0.38) });
    }
    t.near(readings[1].strip, readings[0].strip, readings[0].strip * 0.001, 'the strips keep their level');
    t.near(readings[1].click / readings[0].click, 0.5, 0.05, 'the click follows the metronome volume');
  });

  t.test('UT-05-06c master and metronome volumes ramp over 20 ms and follow settings.changed', async () => {
    const { engine, context, clock, bus } = makeEngine();
    constantInto(context, engine.createStrip('t1').input, DC_LEVEL);
    clock.set(0.2);
    bus.emit('settings.changed', { key: 'audio.masterVolume', value: 0.5, prev: 1, source: 'ui' });
    t.eq(engine.masterGain(), 0.5);
    bus.emit('settings.changed', { key: 'audio.metronomeVolume', value: 0.25, prev: 1, source: 'ui' });
    t.eq(engine.metronomeGain(), 0.25);
    engine.setMasterGain(7);
    t.eq(engine.masterGain(), 1, 'clamped to 0..1');
    engine.setMasterGain(0.5);
    t.throws(() => engine.setMasterGain('loud'), 'E-GEN-004');
    const data = await rendered(context);
    // The limiter adapts slowly to a constant input: the same render without the change is the reference.
    const steady = makeEngine();
    constantInto(steady.context, steady.engine.createStrip('t1').input, DC_LEVEL);
    const reference = await rendered(steady.context);
    const ratioAt = (seconds) => levelAt(data, seconds) / levelAt(reference, seconds);
    t.near(ratioAt(0.15), 1, 0.001, 'unchanged before the change');
    t.near(ratioAt(0.2 + 0.01 + LIMITER_DELAY_S), 0.75, 0.1, 'halfway after 10 ms');
    t.near(ratioAt(0.25), 0.5, 0.01, 'the new volume after the ramp');
    t.ok(largestStep(data, 0.19, 0.3) < levelAt(reference, 0.15) * 0.05, 'no step');
  });

  t.test('UT-05-28 peak meter', async () => {
    const { engine, context, clock } = makeEngine({ seconds: 2 });
    const square = context.createOscillator();
    square.type = 'square';
    square.connect(engine.master);
    square.start(0);
    square.stop(0.1);
    const readings = [];
    const readAt = (seconds, clockSeconds) => context.suspend(seconds).then(() => {
      clock.set(clockSeconds);
      readings.push(engine.peak());
      return context.resume();
    });
    const first = readAt(Math.round(0.08 / QUANTUM_S) * QUANTUM_S, 0.08);
    const second = readAt(Math.round(0.5 / QUANTUM_S) * QUANTUM_S, 0.08 + 1.5);
    await rendered(context);
    await Promise.all([first, second]);
    t.ok(readings[0].peak >= 0.98, 'a full-scale square reads at least 0.98, got ' + readings[0].peak);
    t.eq(readings[0].clip, true);
    t.ok(readings[0].holdPeak >= readings[0].peak);
    t.ok(readings[1].peak < 1e-3, 'silence after the tone');
    t.eq(readings[1].clip, false);
    t.ok(readings[1].holdPeak < 0.1, 'the held peak decays below 0.1 within 1.5 s, got ' + readings[1].holdPeak);
  });

  t.test('UT-05-28b audio.peak runs at 10 Hz only while somebody listens', () => {
    const { engine, bus } = makeEngine();
    const timers = t.fakes.timers();
    timers.install();
    const baseline = Core.timers.count();
    const seen = [];
    const off = engine.subscribePeak((event) => seen.push(event), t.owner);
    t.eq(Core.timers.count(), baseline + 1);
    timers.advance(1000);
    t.ok(seen.length >= 9 && seen.length <= 11, 'about ten per second, got ' + seen.length);
    t.deepEq(Object.keys(seen[0]).sort(), ['audioTime', 'clipped', 'l', 'r']);
    off();
    t.eq(Core.timers.count(), baseline, 'the feed stops with the last listener');
    t.eq(bus.listenerCount('audio.peak'), 0);
    const owner = Symbol('peak-owner');
    engine.subscribePeak(() => {}, owner);
    bus.removeOwner(owner);
    timers.advance(150);
    t.eq(Core.timers.count(), baseline, 'a listener removed by its owner stops the feed at the next tick');
  });

  // ------------------------------------------------------------------------------------------- T04.03
  const Events = FLM.Model.Events;
  const BEAT = 960;                          // ticks; at 120 BPM and PPQ 960 a beat is 0.5 s
  const TICK_S = Audio.TICK_MS / 1000;
  const LOOKAHEAD_S = Audio.LOOKAHEAD_S;
  const STEAL_FADE_S = 0.010;
  const SOFT_PANIC_S = 0.030;
  const VOICE_MAX_S = 60;
  const LATE_S = 0.005;
  const isStealLog = (entry) => String(entry.msg).startsWith('voice stealing started');

  /** A stand-in M-06 voice: it records its calls, and `level` is what its envelope model answers. */
  function fakeVoice(level) {
    const voice = { level: level === undefined ? 1 : level, stops: [], releases: [], disposed: 0 };
    voice.levelAt = () => voice.level;
    voice.stop = (at, fadeS) => voice.stops.push([at, fadeS]);
    voice.release = (at, rampS) => voice.releases.push([at, rampS]);
    voice.dispose = () => { voice.disposed += 1; };
    return voice;
  }

  /** Fills a pool with `count` active voices that start 0.1 s apart; returns the slots. */
  function fillPool(pool, count) {
    return Array.from({ length: count }, (unused, index) => {
      const slot = pool.acquire({ trackId: 't', channel: 0, pitch: 60 + index, priority: 1 }, index * 0.1);
      slot.voice = fakeVoice();
      return slot;
    });
  }

  /** An engine without a context: enough for the allocator, the settings and the bus. */
  function makeBare(extra) {
    const bus = new Core.Emitter();
    const engine = Audio.createEngine(Object.assign({ bus, clock: t.fakes.clock(), mobile: false }, extra));
    engines.push(engine);
    return { engine, bus };
  }

  t.test('UT-05-12 allocator steal order', () => {
    const pool = Audio.createVoiceAllocator({ capacity: 4 });
    const slots = fillPool(pool, 4);
    const voices = slots.map((slot) => slot.voice);
    t.eq(pool.markReleased(slots[2], 0.5, 0.7), true, 'one voice is released');
    const first = pool.acquire({ trackId: 'u', pitch: 72 }, 0.6);
    t.deepEq(voices[2].stops, [[0.6, STEAL_FADE_S]], 'the released voice is stolen, with a 10 ms fade (R-P6.1-11)');
    t.eq(voices.filter((voice) => voice.stops.length > 0).length, 1, 'no other voice was touched');
    const second = pool.acquire({ trackId: 'u', pitch: 74 }, 0.65);
    t.deepEq(voices[0].stops, [[0.65, STEAL_FADE_S]], 'the second steal takes the oldest active voice');
    t.eq(pool.stats().stolen, 2);
    t.eq(pool.activeCount(), 4, 'the pool never grows');
    t.ok(first.state === 'active' && second.state === 'active' && first !== second);
  });

  t.test('UT-05-12b the quietest released voice goes first, equal levels oldest first, then the oldest active', () => {
    const pool = Audio.createVoiceAllocator({ capacity: 4 });
    const slots = fillPool(pool, 4);
    const voices = slots.map((slot) => slot.voice);
    voices[1].level = 0.4;
    voices[2].level = 0.1;
    voices[3].level = 0.1;
    [1, 2, 3].forEach((index) => pool.markReleased(slots[index], 0.5, 0.9));
    const stolenOrder = [];
    for (let count = 0; count < 4; count += 1) {
      pool.acquire({ trackId: 'u' }, 0.6);
      stolenOrder.push(voices.findIndex((voice, index) => voice.stops.length > 0 && !stolenOrder.includes(index)));
    }
    t.deepEq(stolenOrder, [2, 3, 1, 0], 'released 0.1 (older), released 0.1, released 0.4, then the oldest active');
  });

  t.test('UT-05-12c without an envelope model a released slot fades linearly to its end', () => {
    const pool = Audio.createVoiceAllocator({ capacity: 2 });
    const slots = [pool.acquire({}, 0), pool.acquire({}, 0.1)];
    pool.markReleased(slots[0], 0.5, 0.7);
    pool.markReleased(slots[1], 0.5, 0.6);
    t.near(slots[0].levelAt(0.6), 0.5, 1e-9);
    t.eq(slots[1].levelAt(0.65), 0, 'already over');
    const taken = pool.acquire({}, 0.65);
    t.eq(taken.index, 1, 'the slot that is quietest at the steal time is reused');
  });

  t.test('UT-05-12d a stolen slot cannot be freed by its old owner; the first steal is logged once; counters', () => {
    const logged = () => Core.Log.entries().filter(isStealLog).length;
    const before = logged();
    const pool = Audio.createVoiceAllocator({ capacity: 2 });
    const slots = fillPool(pool, 2);
    pool.acquire({}, 1);
    t.eq(logged(), before + 1, 'Log.once on the first steal');
    t.eq(pool.free(slots[0]), false, 'the old handle is stale');
    t.eq(pool.markReleased(slots[0], 2, 3), false);
    t.eq(pool.activeCount(), 2);
    pool.acquire({}, 1.1);
    t.eq(logged(), before + 1, 'not logged again');
    pool.noteDropped();
    t.deepEq(pool.stats(), { capacity: 2, active: 2, released: 0, started: 4, stolen: 2, dropped: 1, peakActive: 2 });
    pool.resetStats();
    t.deepEq([pool.stats().started, pool.stats().stolen, pool.stats().dropped], [0, 0, 0], 'bind starts from zero');
    t.throws(() => pool.acquire({}, NaN), 'E-GEN-004');
  });

  t.test('UT-05-13 allocator counts', () => {
    const pool = Audio.createVoiceAllocator({ capacity: 6 });
    const slots = fillPool(pool, 3);
    t.eq(pool.list().length, 6, 'one slot per unit of capacity');
    t.eq(pool.markReleased(slots[0], 1, 1.2), true);
    t.deepEq([pool.activeCount(), pool.releasedCount()], [3, 1], 'a released voice holds its slot until it is freed');
    t.eq(pool.free(slots[0]), true);
    t.deepEq([pool.activeCount(), pool.releasedCount()], [2, 0]);
    t.eq(pool.free(slots[0]), false, 'a second free does nothing');
    t.eq(pool.list().length, 6);
    t.eq(pool.releaseAll(2, SOFT_PANIC_S), 2);
    t.deepEq(slots[1].voice.releases, [[2, SOFT_PANIC_S]], 'soft panic releases with the 30 ms ramp');
    t.eq(pool.releasedCount(), 2);
    const voices = [slots[1].voice, slots[2].voice];
    t.eq(pool.stopAll(3), 2);
    t.deepEq(voices.map((voice) => [voice.stops.length, voice.disposed]), [[1, 1], [1, 1]]);
    t.deepEq([pool.activeCount(), pool.list().length], [0, 6]);
  });

  t.test('UT-05-14 capacity by platform and setting', () => {
    t.eq(makeBare().engine.VoiceAllocator.capacity, 64, 'desktop');
    t.eq(makeBare({ mobile: true }).engine.VoiceAllocator.capacity, 32, 'mobile');
    t.deepEq([24, 100, 5, 0].map((setting) => makeBare({ polyphony: setting }).engine.VoiceAllocator.capacity),
      [24, 64, 16, 64], 'the setting is 16 to 64 and 0 means automatic');
    t.eq(makeBare({ mobile: true, polyphony: 0 }).engine.VoiceAllocator.capacity, 32);
    t.eq(makeBare({ readSetting: (path) => (path === 'audio.polyphonyCap' ? 48 : 1) }).engine.VoiceAllocator.capacity,
      48, 'read from the stored setting');
    const { engine, bus } = makeBare({ mobile: true });
    const pool = engine.VoiceAllocator;
    t.eq(pool.setCapacity(16), 16);
    t.eq(pool.capacity, 16);
    t.eq(pool.setCapacity(9999), 64, 'clamped to 64');
    t.eq(pool.setCapacity(0), 16, 'clamped to 16');
    bus.emit('settings.changed', { key: 'audio.polyphonyCap', value: 20 });
    t.eq(pool.capacity, 20, 'a settings change applies');
    bus.emit('settings.changed', { key: 'audio.polyphonyCap', value: 0 });
    t.eq(pool.capacity, 32, 'back to automatic on mobile');
    t.eq(Audio.polyphonyFor(0, false), 64);
    t.eq(pool.list().length, pool.capacity);
  });

  t.test('UT-05-14b a smaller capacity keeps sounding voices where it can and steals the rest', () => {
    const pool = makeBare().engine.VoiceAllocator;
    const slots = fillPool(pool, 20);
    pool.free(slots[0]);
    pool.free(slots[1]);
    pool.setCapacity(16);
    t.eq(pool.capacity, 16);
    t.eq(pool.list().length, 16);
    t.eq(pool.activeCount(), 16);
    t.eq(pool.stats().stolen, 2, '18 sounding voices, 16 slots: the two that did not fit were stolen');
    t.ok(pool.list().every((slot, index) => slot.index === index), 'every slot knows its place');
  });

  // ------------------------------------------------------------------------------------------- T04.04
  /** An engine on an offline context with a fake clock and fake timers: nothing ticks unless the test says so. */
  async function withRig(extra, body) {
    const timers = t.fakes.timers();
    timers.install();
    const rig = Object.assign({ timers }, makeEngine(extra));
    try {
      await body(rig);
    } finally {
      rig.engine.Scheduler.unbind();
      timers.uninstall();
    }
  }

  const fakeTransport = (items) => ({ update() {}, pullDue: () => items.splice(0) });

  /** A stand-in M-06: noteOn takes a slot from the allocator and records the call, as Instruments will. */
  function stubInstruments(engine) {
    const calls = { noteOn: [], control: [] };
    return { calls,
      noteOn(track, event, at, end) {
        calls.noteOn.push({ track, event, at, end });
        const slot = engine.VoiceAllocator.acquire({ trackId: track.id, channel: event.channel, pitch: event.pitch,
          priority: 1 }, at);
        slot.voice = fakeVoice();
        engine.VoiceAllocator.markReleased(slot, end, end + 0.05);
        return slot;
      },
      control(track, event, at) { calls.control.push({ track, event, at }); } };
  }

  /** Audible notes: a square wave at DC_LEVEL from `at` to `end` through the strip of the track. */
  function toneInstruments(rig) {
    return { noteOn(track, event, at, end) {
      const source = rig.context.createOscillator();
      source.type = 'square';
      source.frequency.value = 220;
      const level = rig.context.createGain();
      level.gain.value = DC_LEVEL;
      source.connect(level);
      level.connect(rig.engine.createStrip(track.id).input);
      source.onended = () => {              // a real voice disconnects itself when it ends
        source.disconnect();
        level.disconnect();
      };
      source.start(at);
      source.stop(end);
      return null;
    }, control() {} };
  }

  function songOf(trackEvents, durationTicks) {
    const Model = FLM.Model;
    const song = Model.Song.create({ title: 'Audio fixture' });
    trackEvents.forEach((events, index) => {
      const track = Model.Track.create({ name: 'track ' + index }, song);
      Model.replaceEvents(track, events);
      Model.Song.addTrack(song, track);
    });
    song.durationTicks = durationTicks;
    return song;
  }

  const beatNotes = (count, spacing, length) => Array.from({ length: count }, (unused, index) =>
    Events.note(index * (spacing || BEAT), length || BEAT / 2, 60 + (index % 12), 100));

  /** A real Transport on the rig's clock and bus, a song loaded and bound; playing from tick 0 without a count-in. */
  function startSong(rig, song, instruments, loopRegion) {
    const transport = FLM.Transport.create({ clock: rig.clock, bus: rig.bus });
    transport.load(song);
    if (loopRegion) transport.setLoop(loopRegion);
    rig.engine.Scheduler.setInstruments(instruments);
    rig.engine.Scheduler.bind(transport, song, {});
    transport.play({ countInBars: 0 });
    return transport;
  }

  /** 25 ms Scheduler ticks until the fake clock reads `seconds`. */
  function tickTo(rig, seconds) {
    while (rig.clock.now() < seconds - 1e-9) {
      rig.clock.advance(TICK_S);
      rig.engine.Scheduler.tickOnce(rig.clock.now());
    }
  }

  const topicLog = (rig, topic) => record(rig.bus, topic);

  t.test('UT-05-15 offline onset accuracy: 8 notes 0.5 s apart start where they were scheduled', async () => {
    await withRig({ seconds: 5 }, async (rig) => {
      const noteOns = topicLog(rig, 'sched.noteOn');
      startSong(rig, songOf([beatNotes(8)], 8 * BEAT), toneInstruments(rig));
      tickTo(rig, 4.5);
      t.eq(noteOns.length, 8);
      const found = t.fakes.onsets(await rig.context.startRendering(), { threshold: 0.01 });
      t.eq(found.length, 8, 'eight onsets in the rendered buffer');
      found.forEach((onset, index) => t.ok(Math.abs(onset - (noteOns[index].at + LIMITER_DELAY_S)) <=
        QUANTUM_S + 0.001, 'onset ' + index + ' is within one render quantum plus 1 ms (6.5.4.10); got ' +
        ((onset - noteOns[index].at) * 1000).toFixed(2) + ' ms after its at'));
    });
  });

  t.test('UT-05-16 lookahead bound: nothing is scheduled more than 120 ms ahead', async () => {
    await withRig({}, async (rig) => {
      const ahead = [];
      rig.bus.on('sched.noteOn', (event) => ahead.push(event.at - rig.clock.now()), t.owner);
      startSong(rig, songOf([beatNotes(8)], 8 * BEAT), stubInstruments(rig.engine));
      tickTo(rig, 4.2);
      t.eq(ahead.length, 8);
      t.ok(ahead.every((delta) => delta <= LOOKAHEAD_S + 1e-9), 'every at is within the lookahead: ' + ahead.join(' '));
      t.ok(ahead.every((delta) => delta > LATE_S), 'and none was clamped');
      t.ok(rig.engine.Scheduler.stats().lookaheadMaxMs <= 120 + 1e-6);
      t.eq(rig.engine.Scheduler.stats().stalls, 0);
    });
  });

  const fakeTrack = (extra) => Object.assign({ id: 't1', program: 5, isDrums: false, channel: 0 }, extra);
  const noteItem = (owner, atAudio, endAudio, pitch, tick) => ({ kind: 'note', track: owner, atAudio, endAudio,
    event: Events.note(tick === undefined ? 0 : tick, BEAT, pitch === undefined ? 60 : pitch, 90, 2, { id: 'e' +
      (pitch === undefined ? 60 : pitch) }), trackIndex: 0 });

  t.test('UT-05-17 never schedules in the past: an overdue item is booked at now + 5 ms and reported', async () => {
    await withRig({}, (rig) => {
      const instruments = stubInstruments(rig.engine);
      const stalls = topicLog(rig, 'sched.stall');
      const noteOns = topicLog(rig, 'sched.noteOn');
      rig.engine.Scheduler.setInstruments(instruments);
      rig.engine.Scheduler.start(fakeTransport([noteItem(fakeTrack(), 0.95, 2)]));
      rig.clock.set(1);
      rig.engine.Scheduler.tickOnce(1);
      t.near(instruments.calls.noteOn[0].at, 1 + LATE_S, 1e-12);
      t.near(noteOns[0].at, 1 + LATE_S, 1e-12);
      t.eq(stalls.length, 1);
      t.near(stalls[0].gapMs, 55, 1e-6);
      t.eq(stalls[0].eventsRescheduled, 1);
      t.eq(stalls[0].at, 1);
      t.ok(['timer', 'hidden', 'unknown'].includes(stalls[0].cause));
      t.deepEq([rig.engine.Scheduler.stats().stalls, rig.engine.Scheduler.stats().clamped], [1, 1]);
    });
  });

  t.test('UT-05-18 sched events payload: noteOn and noteOff carry what the instrument was called with', async () => {
    await withRig({}, (rig) => {
      const instruments = stubInstruments(rig.engine);
      const noteOns = topicLog(rig, 'sched.noteOn');
      const noteOffs = topicLog(rig, 'sched.noteOff');
      rig.engine.Scheduler.setInstruments(instruments);
      rig.engine.Scheduler.start(fakeTransport([noteItem(fakeTrack({ isDrums: true }), 1.05, 1.5, 64, 4800)]));
      rig.clock.set(1);
      rig.engine.Scheduler.tickOnce(1);
      const call = instruments.calls.noteOn[0];
      t.deepEq(noteOns[0], { trackId: 't1', channel: 2, eventId: 'e64', pitch: 64, velocity: 90, program: 5,
        isDrums: true, at: call.at, atOff: call.end, durTicks: BEAT, tick: 4800, live: false });
      t.deepEq(noteOffs[0], { trackId: 't1', channel: 2, eventId: 'e64', pitch: 64, at: call.end, reason: 'end' });
      t.near(call.at, 1.05, 1e-12);
      t.near(call.end, 1.5, 1e-12);
      t.eq(call.event.pitch, 64);
      t.eq(rig.engine.Scheduler.pending(), 1, 'one scheduled release is still to come');
      rig.clock.set(1.6);
      t.eq(rig.engine.Scheduler.pending(), 0, 'and it is forgotten once it is over');
    });
  });

  t.test('UT-05-19 cc, program and bend items go to instruments.control and out as sched events', async () => {
    await withRig({}, (rig) => {
      const instruments = stubInstruments(rig.engine);
      const topics = { cc: topicLog(rig, 'sched.cc'), program: topicLog(rig, 'sched.program'),
        bend: topicLog(rig, 'sched.bend') };
      const owner = fakeTrack();
      const events = { cc: Events.cc(0, 7, 90, 1), program: Events.program(0, 40, 1, 2, 1),
        bend: Events.bend(0, -512, 1) };
      const times = { cc: 1.02, program: 1.03, bend: 1.04 };
      const items = Object.keys(events).map((kind) => ({ kind, track: owner, event: events[kind],
        atAudio: times[kind] }));
      rig.engine.Scheduler.setInstruments(instruments);
      rig.engine.Scheduler.start(fakeTransport(items));
      rig.clock.set(1);
      rig.engine.Scheduler.tickOnce(1);
      t.deepEq(instruments.calls.control.map((call) => [call.event.kind, call.at]), [['cc', 1.02], ['program', 1.03],
        ['bend', 1.04]], 'the event and the audio time');
      t.deepEq(topics.cc, [{ trackId: 't1', channel: 1, controller: 7, value: 90, at: 1.02 }]);
      t.deepEq(topics.program, [{ trackId: 't1', channel: 1, program: 40, bankMsb: 1, bankLsb: 2, at: 1.03 }]);
      t.deepEq(topics.bend, [{ trackId: 't1', channel: 1, value: -512, at: 1.04 }]);
    });
  });

  t.test('UT-05-19b the program in force is reported with later notes of the track', async () => {
    await withRig({}, (rig) => {
      const noteOns = topicLog(rig, 'sched.noteOn');
      const owner = fakeTrack();
      const change = { kind: 'program', track: owner, event: Events.program(0, 73, 0, 0, 0), atAudio: 1.03 };
      const items = [noteItem(owner, 1.02, 2, 60), change, noteItem(owner, 1.04, 2, 62)];
      rig.engine.Scheduler.start(fakeTransport(items));
      rig.clock.set(1);
      rig.engine.Scheduler.tickOnce(1);
      t.deepEq(noteOns.map((event) => event.program), [5, 73]);
    });
  });

  t.test('UT-05-20 stall catch-up ordering: 20 overdue items keep their order at now + 5 ms', async () => {
    await withRig({}, (rig) => {
      const instruments = stubInstruments(rig.engine);
      const stalls = topicLog(rig, 'sched.stall');
      const items = Array.from({ length: 20 }, (unused, index) => noteItem(fakeTrack(), 0.8 + index * 0.01, 3,
        40 + index));
      rig.engine.Scheduler.setInstruments(instruments);
      rig.engine.Scheduler.start(fakeTransport(items));
      rig.clock.set(1);
      rig.engine.Scheduler.tickOnce(1);
      t.eq(instruments.calls.noteOn.length, 20);
      t.ok(instruments.calls.noteOn.every((call) => Math.abs(call.at - (1 + LATE_S)) < 1e-12), 'all at now + 5 ms');
      t.deepEq(instruments.calls.noteOn.map((call) => call.event.pitch), Array.from({ length: 20 }, (u, i) => 40 + i));
      t.eq(stalls.length, 1);
      t.near(stalls[0].gapMs, 205, 1e-6, 'the oldest item was 205 ms late');
      t.eq(stalls[0].eventsRescheduled, 20);
    });
  });

  t.test('UT-05-20b a note that is more than half a second late is skipped, not bunched at now', async () => {
    await withRig({}, (rig) => {
      const instruments = stubInstruments(rig.engine);
      const items = [[0.2, 50], [0.7, 51], [1.02, 52]].map((late) => noteItem(fakeTrack(), late[0], 9, late[1]));
      rig.engine.Scheduler.setInstruments(instruments);
      rig.engine.Scheduler.start(fakeTransport(items));
      rig.clock.set(1);
      rig.engine.Scheduler.tickOnce(1);
      t.deepEq(instruments.calls.noteOn.map((call) => call.event.pitch), [51, 52]);
      t.eq(rig.engine.Scheduler.stats().skipped, 1);
      t.eq(rig.engine.VoiceAllocator.stats().dropped, 1, 'a skipped note counts as dropped: started + dropped = notes');
    });
  });

  t.test('UT-05-21 voice maximum duration: a release 120 s away is booked at at + 60 s', async () => {
    await withRig({}, (rig) => {
      const instruments = stubInstruments(rig.engine);
      const noteOffs = topicLog(rig, 'sched.noteOff');
      rig.engine.Scheduler.setInstruments(instruments);
      rig.engine.Scheduler.start(fakeTransport([noteItem(fakeTrack(), 1.05, 121)]));
      rig.clock.set(1);
      rig.engine.Scheduler.tickOnce(1);
      t.near(instruments.calls.noteOn[0].end, 1.05 + VOICE_MAX_S, 1e-9);
      t.near(noteOffs[0].at, 1.05 + VOICE_MAX_S, 1e-9);
      t.eq(Audio.VOICE_MAX_S, VOICE_MAX_S);
    });
  });

  t.test('UT-05-21b the shortest booked note is 10 ms', async () => {
    await withRig({}, (rig) => {
      const instruments = stubInstruments(rig.engine);
      rig.engine.Scheduler.setInstruments(instruments);
      rig.engine.Scheduler.start(fakeTransport([noteItem(fakeTrack(), 1.05, 1.051)]));
      rig.clock.set(1);
      rig.engine.Scheduler.tickOnce(1);
      t.near(instruments.calls.noteOn[0].end, 1.06, 1e-12);
    });
  });

  t.test('UT-05-24 a seek triggers one soft panic; the loop wrap does not', async () => {
    await withRig({}, async (rig) => {
      const panics = topicLog(rig, 'audio.panic');
      const noteOffs = topicLog(rig, 'sched.noteOff');
      const instruments = stubInstruments(rig.engine);
      const transport = startSong(rig, songOf([[Events.note(0, 8 * BEAT, 60, 100), Events.note(0, 8 * BEAT, 64, 100)]],
        16 * BEAT), instruments);
      tickTo(rig, 0.5);
      t.eq(rig.engine.Scheduler.pending(), 2);
      const voices = instruments.calls.noteOn.length;
      t.eq(voices, 2);
      transport.seek(8 * BEAT);
      t.eq(panics.length, 1, 'panic(false) once');
      t.deepEq([panics[0].hard, panics[0].releasedCount, panics[0].reason], [false, 2, 'seek']);
      t.eq(rig.engine.Scheduler.pending(), 0, 'the scheduled releases are forgotten');
      const cut = noteOffs.filter((event) => event.reason === 'seek');
      t.eq(cut.length, 2, 'one sched.noteOff with reason seek per sounding note');
      t.ok(cut.every((event) => Math.abs(event.at - 0.5) < 1e-9), 'at the seek time');
      rig.engine.VoiceAllocator.list().filter((slot) => slot.state === 'released').forEach((slot) => {
        const last = slot.voice.releases[slot.voice.releases.length - 1];
        t.near(last[0], rig.clock.now(), 1e-12, 'released now');
        t.eq(last[1], SOFT_PANIC_S, '30 ms ramp');
      });
      transport.setLoop({ a: 8 * BEAT, b: 10 * BEAT });
      tickTo(rig, 6);
      t.eq(panics.length, 1, 'a loop wrap is not a seek for the panic');
      transport.pause();
      t.eq(panics.length, 2, 'a pause is another');
      t.eq(panics[1].reason, 'stop');
    });
  });

  t.test('UT-05-31 loopWrap releases every note that is still sounding at the wrap time', async () => {
    await withRig({}, (rig) => {
      const instruments = stubInstruments(rig.engine);
      const noteOffs = topicLog(rig, 'sched.noteOff');
      const owner = fakeTrack();
      const items = [noteItem(owner, 1.02, 5, 60), noteItem(owner, 1.03, 5, 62), noteItem(owner, 1.04, 1.06, 64),
        { kind: 'loopWrap', atAudio: 1.1, fromTick: 7680, toTick: 0 }];
      rig.engine.Scheduler.setInstruments(instruments);
      rig.engine.Scheduler.start(fakeTransport(items));
      rig.clock.set(1);
      rig.engine.Scheduler.tickOnce(1);
      const slots = rig.engine.VoiceAllocator.list().filter((slot) => slot.voice);
      t.eq(slots.length, 3);
      t.deepEq(slots.map((slot) => slot.voice.releases), [[[1.1, undefined]], [[1.1, undefined]], []],
        'the two long notes are released at the wrap; the short one had ended');
      const wrapped = noteOffs.filter((event) => event.reason === 'loop');
      t.deepEq(wrapped.map((event) => [event.pitch, event.at]), [[60, 1.1], [62, 1.1]]);
    });
  });

  t.test('UT-05-31b a sustained note is released at each loop wrap, not retriggered from before the loop', async () => {
    await withRig({}, (rig) => {
      const noteOns = topicLog(rig, 'sched.noteOn');
      const noteOffs = topicLog(rig, 'sched.noteOff');
      const wraps = topicLog(rig, 'transport.loop');
      const crossing = Events.note(BEAT, 8 * BEAT, 60, 100);           // starts before the loop and crosses its end
      const inside = Events.note(3 * BEAT, 8 * BEAT, 64, 100);         // starts inside the loop and crosses its end
      const song = songOf([[crossing, inside]], 16 * BEAT);
      startSong(rig, song, stubInstruments(rig.engine), { a: 2 * BEAT, b: 6 * BEAT });
      tickTo(rig, 8);
      t.eq(wraps.length >= 3, true, 'three passes at least');
      const wrapTimes = wraps.slice(0, 3).map((event) => event.atAudioTime);
      t.eq(noteOns.filter((event) => event.pitch === 60).length, 1, 'the note from before the loop is not retriggered');
      const secondPasses = noteOns.filter((event) => event.pitch === 64);
      t.eq(secondPasses.length, 4, 'the note inside the loop sounds in every pass');
      const loopOffs = noteOffs.filter((event) => event.pitch === 64 && event.reason === 'loop');
      t.ok(loopOffs.length >= 3);
      wrapTimes.forEach((wrap, index) => t.near(loopOffs[index].at, wrap, 1e-9, 'release ' + (index + 1) +
        ' at the wrap'));
      t.eq(noteOffs.filter((event) => event.pitch === 60)[0].reason, 'loop', 'the first note is cut by the loop end');
    });
  });

  t.test('UT-05-32 voices stats event: one audio.voices at the start, then on change, at most 10 Hz', async () => {
    await withRig({}, (rig) => {
      const voices = topicLog(rig, 'audio.voices');
      rig.engine.Scheduler.start(fakeTransport([]));
      for (let tick = 1; tick <= 40; tick += 1) {
        rig.clock.advance(TICK_S);
        rig.engine.Scheduler.tickOnce(rig.clock.now());
      }
      t.eq(voices.length, 1, 'nothing changed in 40 ticks');
      t.deepEq(Object.keys(voices[0]).sort(), ['active', 'capacity', 'dropped', 'max', 'peakActive', 'released',
        'started', 'stolen']);
      t.deepEq([voices[0].capacity, voices[0].active, voices[0].stolen], [64, 0, 0]);
      fillPool(rig.engine.VoiceAllocator, 3);
      rig.clock.advance(TICK_S);
      rig.engine.Scheduler.tickOnce(rig.clock.now());
      t.eq(voices.length, 2);
      t.deepEq([voices[1].active, voices[1].started, voices[1].peakActive], [3, 3, 3]);
      rig.engine.VoiceAllocator.noteDropped();
      for (let tick = 0; tick < 3; tick += 1) {
        rig.clock.advance(TICK_S);
        rig.engine.Scheduler.tickOnce(rig.clock.now());
        t.eq(voices.length, 2, 'inside the same 100 ms');
      }
      for (let tick = 0; tick < 2; tick += 1) {
        rig.clock.advance(TICK_S);
        rig.engine.Scheduler.tickOnce(rig.clock.now());
      }
      t.eq(voices.length, 3, 'the change goes out with the next 100 ms');
      t.eq(voices[2].dropped, 1);
    });
  });

  t.test('T04.04 bind makes one strip per track with its mix, unbind removes them, a second bind throws', async () => {
    await withRig({}, (rig) => {
      const song = songOf([beatNotes(2), beatNotes(2), beatNotes(2)], 4 * BEAT);
      song.tracks[0].mix = { gain: 0.5, pan: -0.25, mute: false, solo: true };
      song.tracks[1].mix = { gain: 1, pan: 0, mute: true, solo: false };
      const transport = FLM.Transport.create({ clock: rig.clock, bus: rig.bus });
      transport.load(song);
      const timers = Core.timers.count();
      rig.engine.Scheduler.bind(transport, song, { master: { gain: 0.5 } });
      t.eq(rig.engine.stripCount(), 3, 'one strip per track');
      t.eq(rig.engine.Scheduler.running(), true);
      t.eq(Core.timers.count(), timers + 1, 'one interval');
      const stripOf = (item) => rig.engine.strips().find((strip) => strip.trackId === item.id);
      const mixes = song.tracks.map((item) => stripOf(item).mixState());
      t.deepEq(mixes.map((mix) => [mix.gain, mix.pan, mix.mute, mix.solo]), [[0.5, -0.25, false, true],
        [1, 0, true, false], [1, 0, false, false]]);
      t.eq(rig.engine.strips().filter((strip) => strip.effectiveMuted()).length, 2, 'solo silences the other two');
      t.eq(rig.engine.masterGain(), 0.5, 'the project master gain');
      const bound = FLM.Transport.create({ clock: rig.clock, bus: rig.bus });
      t.throws(() => rig.engine.Scheduler.bind(bound, song, {}), 'E-AUD-005');
      t.eq(rig.engine.Scheduler.running(), true, 'the existing binding is kept');
      t.eq(rig.engine.stripCount(), 3);
      rig.engine.Scheduler.unbind();
      t.eq(rig.engine.stripCount(), 0, 'the strips this binding made are gone');
      t.eq(Core.timers.count(), timers, 'the interval is gone');
      t.eq(rig.engine.Scheduler.running(), false);
      t.deepEq([rig.engine.Scheduler.pending(), rig.engine.VoiceAllocator.activeCount()], [0, 0]);
      rig.engine.Scheduler.unbind();
      rig.engine.Scheduler.bind(bound, song, {});
      t.eq(rig.engine.stripCount(), 3, 'bind works again after unbind');
    });
  });

  t.test('T04.04 a strip that existed before bind is kept by unbind', async () => {
    await withRig({}, (rig) => {
      const kept = rig.engine.createStrip('keep');
      const song = songOf([beatNotes(1)], BEAT);
      const transport = FLM.Transport.create({ clock: rig.clock, bus: rig.bus });
      rig.engine.Scheduler.bind(transport, song, {});
      rig.engine.Scheduler.unbind();
      t.eq(rig.engine.stripCount(), 1);
      t.ok(rig.engine.createStrip('keep') === kept);
    });
  });

  t.test('S-10 the tick books at most 4 ms of work; the rest of a dense chord waits in the backlog', async () => {
    await withRig({}, (rig) => {
      const tickStats = () => rig.engine.Scheduler.stats();
      const booked = [];
      const owner = fakeTrack();
      const instruments = { noteOn(item, event, at) {
        rig.timers.virtualNow += 1;            // every note costs 1 ms of the (fake) performance clock
        booked.push([event.pitch, at]);
        return null;
      }, control() {} };
      const items = Array.from({ length: 10 }, (unused, index) => noteItem(owner, 1.1, 2, 40 + index));
      rig.engine.Scheduler.setInstruments(instruments);
      rig.engine.Scheduler.start(fakeTransport(items));
      const perTick = [];
      for (let tick = 0; tick < 3; tick += 1) {
        rig.clock.set(1 + tick * TICK_S);
        const before = booked.length;
        rig.engine.Scheduler.tickOnce(rig.clock.now());
        perTick.push(booked.length - before);
      }
      t.deepEq(perTick, [4, 4, 2], 'four notes a tick, the rest stays in the cursor (S-10)');
      t.deepEq(booked.map((call) => call[0]), Array.from({ length: 10 }, (u, i) => 40 + i), 'in order');
      t.ok(booked.every((call) => call[1] === 1.1), 'nobody was moved: they are still ahead');
      t.ok(tickStats().tickWorkMaxMs <= 4.0001, 'tick body ' + tickStats().tickWorkMaxMs + ' ms');
      t.eq(tickStats().backlog, 0);
    });
  });

  t.test('T04.04 beats, markers and the metronome: sched.beat every beat, a click only when audible', async () => {
    await withRig({ seconds: 3 }, async (rig) => {
      const beats = topicLog(rig, 'sched.beat');
      const markers = topicLog(rig, 'sched.marker');
      const song = songOf([[]], 4 * BEAT);
      song.markers.push(FLM.Model.Marker.create(2 * BEAT, 'Verse', 'section'));
      const transport = FLM.Transport.create({ clock: rig.clock, bus: rig.bus });
      transport.load(song);
      transport.setMetronome({ enabled: false });
      rig.engine.Scheduler.bind(transport, song, {});
      transport.play({ countInBars: 0 });
      tickTo(rig, 1.8);
      t.deepEq(beats.map((beat) => [beat.tick, beat.bar, beat.beat, beat.numerator, beat.denominator, beat.isDownbeat,
        beat.countin]), [0, 1, 2, 3].map((index) => [index * BEAT, 0, index, 4, 4, index === 0, false]),
      'the beat is announced while the metronome is silent');
      t.near(beats[1].at - beats[0].at, 0.5, 1e-9);
      t.deepEq(markers.map((marker) => [marker.tick, marker.label, marker.kind, marker.index]), [[2 * BEAT, 'Verse',
        'section', 0]]);
      t.near(markers[0].at, transport.audioTimeAt(2 * BEAT), 1e-9);
      const data = (await rig.context.startRendering()).getChannelData(0);
      t.ok(largestSample(data, 0, 3) < 1e-6, 'no click was heard');
    });
  });

  /** Plays a one-bar count-in with the metronome on; returns the beats and the peak of the first click. */
  async function playCountIn(accent) {
    let outcome = null;
    await withRig({ seconds: 4 }, async (rig) => {
      const beats = topicLog(rig, 'sched.beat');
      const song = songOf([[]], 8 * BEAT);
      const transport = FLM.Transport.create({ clock: rig.clock, bus: rig.bus });
      transport.load(song);
      transport.setMetronome({ enabled: true });
      rig.engine.Scheduler.bind(transport, song, {});
      rig.engine.Metronome.configure({ accent });
      transport.play({ countInBars: 1 });
      tickTo(rig, 3.4);
      const data = (await rig.context.startRendering()).getChannelData(0);
      const first = beats[0].at;
      outcome = { beats, firstPeak: largestSample(data, first, first + 0.05) };
    });
    return outcome;
  }

  t.test('T04.04 count-in beats have negative ticks and countin:true; the accent follows configure', async () => {
    const accented = await playCountIn(true);
    const plain = await playCountIn(false);
    const counted = accented.beats.filter((beat) => beat.countin);
    t.deepEq(counted.map((beat) => [beat.tick, beat.bar, beat.beat, beat.isDownbeat]), [[-4 * BEAT, -1, 0, true],
      [-3 * BEAT, -1, 1, false], [-2 * BEAT, -1, 2, false], [-BEAT, -1, 3, false]]);
    t.ok(accented.beats.slice(4).every((beat) => !beat.countin), 'after the count-in');
    t.ok(plain.firstPeak > 0.02, 'the clicks sound');
    t.ok(accented.firstPeak > plain.firstPeak * 1.1, 'the accent makes beat 1 louder than the plain click: ' +
      accented.firstPeak.toFixed(3) + ' against ' + plain.firstPeak.toFixed(3));
    t.ok(plain.beats[0].isDownbeat, 'the beat is still announced as a downbeat when the accent is off');
  });

  t.test('T04.04 the stall and error faults: skipped callbacks, busy waits, a throwing tick (10.9.2)', async () => {
    const timers = t.fakes.timers();
    timers.install();
    const context = new window.OfflineAudioContext(2, SAMPLE_RATE, SAMPLE_RATE);
    const bus = new Core.Emitter();
    const engine = Audio.createEngine({ context, bus, mobile: false, clock: { now: () => timers.virtualNow / 1000 } });
    engines.push(engine);
    Core.ErrorReporter._resetForTests();
    try {
      engine.Scheduler.start({ update() {}, pullDue: () => [] });
      Core.Faults.set('timer.stall', { ms: 0, skipTicks: 3, count: 1 });
      timers.advance(TICK_S * 1000 * 5);
      t.eq(engine.Scheduler.stats().ticks, 2, 'three callbacks skipped, then the stalled tick, then one more');
      t.eq(Core.Faults.active('timer.stall'), null, 'the counted fault is used up');
      Core.Faults.set('timer.stall', { ms: 20, count: 2 });
      const started = Date.now();
      timers.advance(TICK_S * 1000 * 3);
      t.ok(Date.now() - started >= 39, 'two ticks waited 20 ms each');
      t.eq(Core.Faults.active('timer.stall'), null);
      Core.Faults.set('error.throw', { origin: 'frame', count: 1 });
      timers.advance(TICK_S * 1000 * 2);
      t.eq(Core.ErrorReporter.records().length, 0, 'a frame fault is not the scheduler\'s');
      Core.Faults.clear('error.throw');
      Core.Faults.set('error.throw', { origin: 'scheduler', count: 1 });
      const before = engine.Scheduler.stats().ticks;
      timers.advance(TICK_S * 1000 * 3);
      t.eq(engine.Scheduler.stats().errors, 1, 'one tick threw');
      t.eq(engine.Scheduler.stats().ticks - before, 3, 'the next ticks went on');
      const report = Core.ErrorReporter.records().find((item) => item.code === 'E-AUD-004');
      t.ok(report, 'the failure is reported');
    } finally {
      Core.Faults.clearAll();
      Core.ErrorReporter._resetForTests();
      engine.Scheduler.unbind();
      timers.uninstall();
    }
  });

  t.test('T04.04 a failing instrument call drops that note, is reported once, and the others go on', async () => {
    await withRig({}, (rig) => {
      Core.ErrorReporter._resetForTests();
      try {
        const noteOns = topicLog(rig, 'sched.noteOn');
        const instruments = { noteOn(owner, event, at) {
          if (event.pitch === 61) throw new Error('node creation failed');
          return null;
        }, control() {} };
        rig.engine.Scheduler.setInstruments(instruments);
        rig.engine.Scheduler.start(fakeTransport([60, 61, 62].map((pitch) => noteItem(fakeTrack(), 1.05, 2, pitch))));
        rig.clock.set(1);
        rig.engine.Scheduler.tickOnce(1);
        t.deepEq(noteOns.map((event) => event.pitch), [60, 62]);
        t.eq(rig.engine.VoiceAllocator.stats().dropped, 1);
        t.eq(Core.ErrorReporter.records().filter((item) => item.code === 'E-AUD-004').length, 1);
      } finally {
        Core.ErrorReporter._resetForTests();
      }
    });
  });

  t.test('T04.04 the scheduler diagnostics: counts and the two histograms', async () => {
    await withRig({}, (rig) => {
      rig.engine.Scheduler.start(fakeTransport([]));
      tickTo(rig, 0.5);
      const report = rig.engine.Scheduler.diagnostics();
      t.eq(report.ticks, 20);
      t.eq(report.intervalHistogram.length, 201);
      t.eq(report.bodyHistogram.length, 201);
      t.eq(report.running, true);
      t.deepEq([report.lookaheadMs, report.tickMs], [120, 25]);
      t.eq(report.intervalHistogram.reduce((sum, count) => sum + count, 0), 19, 'one interval per pair of ticks');
      t.eq(report.bodyHistogram.reduce((sum, count) => sum + count, 0), 20);
      t.eq(JSON.parse(JSON.stringify(report)).ticks, 20, 'plain data');
      t.ok(typeof FLM.Core.Diagnostics.export().json === 'string');
    });
  });

  t.test('T04.04 a repeated clock reading books nothing; the third announces a stall once', async () => {
    await withRig({}, (rig) => {
      const states = topicLog(rig, 'audio.state');
      const pulls = t.fakes.spy(() => []);
      rig.engine.Scheduler.start({ update() {}, pullDue: pulls });
      [1, 1, 1, 1].forEach((now) => rig.engine.Scheduler.tickOnce(now));
      t.eq(pulls.count, 1, 'only the first reading pulls');
      t.eq(states.filter((event) => event.reason === 'stalled').length, 1);
    });
  });

  t.test('T04.03 FLM.Audio offers the allocator and the Scheduler; the scheduler provider reports counts', () => {
    t.ok(Audio.VoiceAllocator && typeof Audio.VoiceAllocator.acquire === 'function');
    t.ok(Audio.Scheduler && typeof Audio.Scheduler.bind === 'function');
    t.eq(Audio.VoiceAllocator.capacity, Audio.polyphonyFor(0, Core.Caps.isMobile()), 'automatic platform capacity');
    t.eq(Audio.Scheduler.running(), false);
    t.eq(Audio.Scheduler.pending(), 0);
    t.eq(Audio.VoiceAllocator.activeCount(), 0);
    t.deepEq([Audio.LOOKAHEAD_S, Audio.TICK_MS, Audio.SOFT_PANIC_S, Audio.VOICE_MAX_S], [0.12, 25, 0.03, 60]);
    const exported = JSON.parse(Core.Diagnostics.export().json);
    t.ok(exported.providers.scheduler && exported.providers.scheduler.tickMs === 25, 'the provider is in the export');
  });

  t.test('UT-05-29 sample-rate independence: onsets and click pitch at 44.1 kHz and 96 kHz', async () => {
    const onsetLists = [];
    const crossings = [];
    for (const rate of [44100, 96000]) {
      await withRig({ seconds: 3, rate }, async (rig) => {
        const noteOns = topicLog(rig, 'sched.noteOn');
        startSong(rig, songOf([beatNotes(4)], 4 * BEAT), toneInstruments(rig));
        rig.engine.Metronome.click(2.5, false);
        tickTo(rig, 2.2);
        const buffer = await rig.context.startRendering();
        const data = buffer.getChannelData(0);
        const found = t.fakes.onsets(buffer, { threshold: 0.01 });
        t.eq(found.length, 5, 'four notes and the click at ' + rate + ' Hz');
        onsetLists.push(found.map((onset, index) => onset - (index < 4 ? noteOns[index].at : 2.5)));
        let count = 0;
        const first = Math.round(2.5 * rate);
        const last = Math.round(2.53 * rate);
        for (let index = first + 1; index < last; index += 1) {
          if ((data[index - 1] < 0) !== (data[index] < 0)) count += 1;
        }
        crossings.push(count);
      });
    }
    onsetLists[0].forEach((delay, index) => t.ok(Math.abs(delay - onsetLists[1][index]) <= 0.001,
      'onset ' + index + ' differs by ' + (Math.abs(delay - onsetLists[1][index]) * 1000).toFixed(2) + ' ms'));
    t.ok(Math.abs(crossings[0] - crossings[1]) <= 2, 'the click pitch is the same: ' + crossings.join(' and ') +
      ' zero crossings in 30 ms');
    t.ok(crossings[0] >= 30, 'about 1 kHz: 60 crossings expected, got ' + crossings[0]);
  });
});
})();
