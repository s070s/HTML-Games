// 91-test-audio.js - unit tests for M-05 FLM.Audio (group 'audio'; test build only).
// T04.01 delivers UT-05-01 to UT-05-05 and UT-05-33 (the context lifecycle and the unlock gesture); T04.02 delivers
// UT-05-06 to UT-05-11, UT-05-25, UT-05-26 and UT-05-28 (bus graph, strips, fades, metronome, peak meter). The rows
// UT-05-12 onward belong to T04.03 and later. Offline tests render on an OfflineAudioContext with an injected clock
// (Part 6.5.4.10); stand-in contexts come from t.fakes.fakeAudioContext. A lower-case letter after an id marks an
// extra check of that row. Real sound output cannot be judged here (LT-033 runs at Phase 15).
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
    const engine = Audio.createEngine({ context, clock, bus, mobile: false, readSetting: () => 1 });
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
});
})();
