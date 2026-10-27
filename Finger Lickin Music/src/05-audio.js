// 05-audio.js - M-05 FLM.Audio (T04.01, T04.02): the one AudioContext of the page, the unlock gesture and the audio
// state machine; the bus graph (master gain, limiter, analyser, metronome bus); channel strips with gain, pan, mute
// and solo; the metronome click; the peak meter; the master fades.
// Separation rule: this file owns exactly one namespace and registers it once through FLM.Core.define. It may use
// only lower-numbered modules (Part 4.2, R-DEP). It declares no module-level global state object (S-07): every engine
// keeps its state inside createEngine(), and FLM.Audio forwards to the one app engine that init() creates.
// Not here yet (later Phase 4 entries): VoiceAllocator (T04.03), Scheduler (T04.04), panic and nodeCount (T04.05).
// Spec: docs/IMPLEMENTATION-PLAN.md Part 6.5 (API 6.5.2, algorithms 6.5.4), Part 4.4 (events), Part 10.6 (E-AUD codes).
// Time: every read goes through the engine clock {now() -> seconds}; an injected clock and an injected context
// (OfflineAudioContext) make the engine fully deterministic in tests (6.5.4.10).
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Audio', function (FLM) {
  const Core = FLM.Core;
  const Log = Core.Log;

  const LIMITER = Object.freeze({ threshold: -6, knee: 6, ratio: 12, attack: 0.003, release: 0.25 });
  const RAMP_S = 0.005;                      // strip gain, pan and mute ramps (6.5.4.8)
  const START_FADE_S = 0.020;                // master fade-in on start
  const STOP_FADE_S = 0.030;                 // master fade-out on pause and stop (E 2.3)
  const VOLUME_RAMP_S = 0.020;               // master and metronome volume changes (R-P6.2-01)
  const UNLOCK_TIMEOUT_MS = 1000;            // Part 4.3 B15: unlock stops waiting for 'running' after 1 s
  const STALL_TICKS = 3;                     // identical clock readings in a row that mean "frozen" (6.5.4.3)
  const ANALYSER_SIZE = 1024;
  const CLIP_LEVEL = 0.99;
  const HOLD_DECAY_S = 0.5;                  // time constant of the held peak
  const PEAK_FEED_MS = 100;                  // audio.peak at 10 Hz
  const MS_PER_SECOND = 1000;
  const MOBILE_LATENCY_S = 0.040;            // estimates when the browser reports neither latency (6.5.4.7)
  const DESKTOP_LATENCY_S = 0.020;
  const DEFAULT_MASTER_VOLUME = 0.8;         // Part 5.11 defaults
  const DEFAULT_METRONOME_VOLUME = 0.6;
  const MAX_STRIP_GAIN = 2;                  // the mixer fader goes to 200 %
  const SETTING_MASTER = 'audio.masterVolume';
  const SETTING_METRONOME = 'audio.metronomeVolume';
  const CLICK_ATTACK_S = 0.002;              // metronome click envelope (6.5.4.6)
  const CLICK_FLOOR = 0.001;                 // exponential ramps cannot reach 0
  const CLICK_STOP_S = 0.08;
  const CLICKS = Object.freeze({
    accent: Object.freeze({ hz: 1600, level: 1, decayS: 0.06 }),
    normal: Object.freeze({ hz: 1000, level: 0.7, decayS: 0.04 })
  });

  // ---------------------------------------------------------------------------------------------
  // Pure helpers
  // ---------------------------------------------------------------------------------------------
  function codedError(code, text, cause) {
    const error = new Error(code + ': ' + text);
    error.code = code;
    if (cause !== undefined) error.cause = cause;
    return error;
  }

  const messageOf = (error) => (error && error.message ? String(error.message) : String(error));

  function requireFinite(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw codedError('E-GEN-004', name + ' must be a number');
    return value;
  }

  function requireTrackId(trackId) {
    if (typeof trackId !== 'string' || trackId === '') throw codedError('E-GEN-004', 'a track id must be a string');
    return trackId;
  }

  /**
   * Moves an AudioParam to `steps` (a list of [target, seconds]) starting at `at` from its last commanded value.
   * param.value is unreliable during a ramp, so the holder keeps the last commanded value (6.5.4.8).
   */
  function rampThrough(holder, param, at, steps) {
    param.cancelScheduledValues(at);
    param.setValueAtTime(holder.last, at);
    let when = at;
    steps.forEach((step) => {
      when += step[1];
      param.linearRampToValueAtTime(step[0], when);
    });
    holder.last = steps[steps.length - 1][0];
  }

  function placeEqualPower(node, value) {
    const depth = 1 - Math.abs(value);
    if (node.positionX) {
      node.positionX.value = value;
      node.positionY.value = 0;
      node.positionZ.value = depth;
      return;
    }
    node.setPosition(value, 0, depth);       // older Safari has no positionX
  }

  /** StereoPannerNode when the browser has it, else an equal-power PannerNode (6.5.4.2, UT-05-08). */
  function createPanner(context) {
    if (typeof context.createStereoPanner === 'function') {
      const node = context.createStereoPanner();
      const holder = { last: 0 };
      return { node, set: (value, at) => rampThrough(holder, node.pan, at, [[value, RAMP_S]]) };
    }
    const node = context.createPanner();
    node.panningModel = 'equalpower';
    placeEqualPower(node, 0);
    return { node, set: (value) => placeEqualPower(node, value) };
  }

  function defaultContextFactory() {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    if (typeof Constructor !== 'function') throw new Error('this browser has no AudioContext');
    return new Constructor({ latencyHint: 'interactive' });     // no sampleRate option: the device rate is used
  }

  /** A 1-frame silent buffer: iOS Safari leaves 'suspended' or 'interrupted' reliably only after one plays. */
  function playSilentKick(context) {
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      source.connect(context.destination);
      source.onended = () => source.disconnect();
      source.start(0);
    } catch (error) {
      Log.warn('audio', 'silent kick failed: ' + messageOf(error));
    }
  }

  // RISK-71: on iOS the silent switch mutes Web Audio unless the page asks for the playback session.
  function requestPlaybackSession() {
    try {
      const session = window.navigator.audioSession;
      if (session) session.type = 'playback';
    } catch (error) {
      Log.warn('audio', 'audioSession.type failed: ' + messageOf(error));
    }
  }

  // ---------------------------------------------------------------------------------------------
  // ChannelStrip (6.5.4.2): input -> gain -> pan -> muteGain -> master
  // ---------------------------------------------------------------------------------------------
  /**
   * env: {context(), master(), now(), silencedBySolo(trackId), isSolo(trackId), setSolo(trackId, flag),
   * dispose(trackId, strip)}. The strip keeps its mix values so that a graph rebuild can restore them (6.5.3).
   */
  function buildStrip(env, trackId) {
    const context = env.context();
    const mix = { gain: 1, pan: 0, ccVolume: 1, expression: 1, mute: false };
    const input = context.createGain();
    const gain = context.createGain();
    const panner = createPanner(context);
    const muteGain = context.createGain();
    const gainState = { last: 1 };
    const muteState = { last: 1 };
    input.connect(gain);
    gain.connect(panner.node);
    panner.node.connect(muteGain);
    muteGain.connect(env.master());

    const effectiveMuted = () => mix.mute || env.silencedBySolo(trackId);
    const commandedGain = () => mix.gain * mix.ccVolume * mix.expression;
    const startOf = (at) => (at === undefined ? env.now() : at);

    function applyGain(at) {
      rampThrough(gainState, gain.gain, startOf(at), [[commandedGain(), RAMP_S]]);
    }

    function refreshMute(at) {
      rampThrough(muteState, muteGain.gain, startOf(at), [[effectiveMuted() ? 0 : 1, RAMP_S]]);
    }

    const strip = {
      trackId, input, gain, pan: panner.node, muteGain,
      setGain(value, at) {
        mix.gain = Core.clamp(requireFinite(value, 'gain'), 0, MAX_STRIP_GAIN);
        applyGain(at);
      },
      setPan(value, at) {
        mix.pan = Core.clamp(requireFinite(value, 'pan'), -1, 1);
        panner.set(mix.pan, startOf(at));
      },
      setMute(flag, at) {
        mix.mute = Boolean(flag);
        refreshMute(at);
      },
      setSolo: (flag) => env.setSolo(trackId, flag),
      /** CC 7 as 0..1; the strip gain is fader x CC7 x CC11. */
      setVolumeCC(value, at) {
        mix.ccVolume = Core.clamp(requireFinite(value, 'CC7'), 0, 1);
        applyGain(at);
      },
      /** CC 11 as 0..1. */
      setExpression(value, at) {
        mix.expression = Core.clamp(requireFinite(value, 'CC11'), 0, 1);
        applyGain(at);
      },
      effectiveMuted,
      commandedGain,
      mixState: () => Object.assign({}, mix, { solo: env.isSolo(trackId) }),
      refreshMute,
      dispose: () => env.dispose(trackId, strip),
      /** Engine use: disconnects the chain. Voices that still feed `input` go quiet with it. */
      release() {
        [input, gain, panner.node, muteGain].forEach((node) => node.disconnect());
      }
    };
    muteGain.gain.value = effectiveMuted() ? 0 : 1;
    muteState.last = muteGain.gain.value;
    return Object.freeze(strip);
  }

  // ---------------------------------------------------------------------------------------------
  // The engine
  // ---------------------------------------------------------------------------------------------
  /**
   * @param {{context?:BaseAudioContext, contextFactory?:function, clock?:{now():number}, bus?:object,
   *   mobile?:boolean, readSetting?:function}=} opts context: an injected context (OfflineAudioContext in tests).
   *   contextFactory: replaces `new AudioContext` (tests). bus: an Emitter (tests keep Core.bus clean).
   *   readSetting(path): the stored setting, read for the first volumes and after a settings reset.
   */
  function createEngine(opts) {
    const options = opts || {};
    const bus = options.bus || Core.bus;
    const owner = Symbol('audio');
    const factory = typeof options.contextFactory === 'function' ? options.contextFactory : defaultContextFactory;
    const strips = new Map();
    const soloSet = new Set();
    const stall = { lastNow: null, same: 0 };
    const levels = { master: DEFAULT_MASTER_VOLUME, metronome: DEFAULT_METRONOME_VOLUME, hold: 0, lastReadAt: null };
    const masterState = { last: DEFAULT_MASTER_VOLUME };
    const metronomeState = { last: DEFAULT_METRONOME_VOLUME };
    const scratch = new Float32Array(ANALYSER_SIZE);
    let ctx = null;
    let graph = null;                        // {master, limiter, analyser, metronomeBus}
    let isClosed = false;
    let unlocked = false;
    let attempts = 0;
    let unlocking = null;                    // the shared promise of concurrent unlock() calls
    let lastPublished = 'none';
    let fadeHeld = false;                    // master is faded out by a pause and waits for fadeIn
    let peakTimer = null;
    let engine = null;

    // ---- clock and facts ----------------------------------------------------------------------
    const clock = Object.freeze({ now: () => now() });

    function now() {
      if (options.clock) return options.clock.now();
      return ctx ? ctx.currentTime : 0;
    }

    function stateNow() {
      if (isClosed) return 'closed';
      return ctx ? ctx.state : 'none';
    }

    const sampleRate = () => (ctx ? ctx.sampleRate : 0);
    const finiteOrZero = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
    const isMobile = () => (typeof options.mobile === 'boolean' ? options.mobile : Core.Caps.isMobile());

    /** 6.5.4.7: base + output latency; an estimate when the browser reports neither. Informative only (I 3.5). */
    function latency() {
      const base = ctx ? finiteOrZero(ctx.baseLatency) : 0;
      const output = ctx ? finiteOrZero(ctx.outputLatency) : 0;
      if (base + output > 0) return { seconds: base + output, estimated: false, base, output };
      return { seconds: isMobile() ? MOBILE_LATENCY_S : DESKTOP_LATENCY_S, estimated: true, base, output };
    }

    // ---- events -------------------------------------------------------------------------------
    function statePayload(state, previous, reason) {
      const info = latency();
      const payload = { state, previous, unlocked, sampleRate: sampleRate(), baseLatencyMs: info.base * MS_PER_SECOND,
        reason };
      if (info.output > 0) payload.outputLatencyMs = info.output * MS_PER_SECOND;
      return payload;
    }

    /** Emits audio.state when the state changed since the last emission; returns whether it emitted. */
    function publishState(reason) {
      const current = stateNow();
      if (current === lastPublished) return false;
      const previous = lastPublished;
      lastPublished = current;
      bus.emit('audio.state', statePayload(current, previous, reason));
      return true;
    }

    function publishUnlocked() {
      const info = latency();
      bus.emit('audio.unlocked', { audioTime: now(), sampleRate: sampleRate(), latencyMs: info.seconds * MS_PER_SECOND,
        attempts, baseLatency: info.base, outputLatency: info.output });
    }

    /**
     * Stall detection (6.5.4.3): the Scheduler calls this with the clock reading of every tick. The third identical
     * reading in a row emits audio.state with reason 'stalled' once; any change of the reading starts over.
     * @returns {boolean} true when the stall was announced by this call
     */
    function observeTick(audioNow) {
      if (audioNow !== stall.lastNow) {
        stall.lastNow = audioNow;
        stall.same = 0;
        return false;
      }
      stall.same += 1;
      if (stall.same !== STALL_TICKS) return false;
      const current = stateNow();
      bus.emit('audio.state', statePayload(current, current, 'stalled'));
      return true;
    }

    // ---- the bus graph (6.5.4.2) --------------------------------------------------------------
    function settingOr(path, fallback) {
      if (typeof options.readSetting !== 'function') return fallback;
      try {
        const value = options.readSetting(path);
        return typeof value === 'number' && Number.isFinite(value) ? Core.clamp(value, 0, 1) : fallback;
      } catch (error) {
        Log.warn('audio', 'reading ' + path + ' failed: ' + messageOf(error));
        return fallback;
      }
    }

    function buildGraph() {
      const master = ctx.createGain();
      master.gain.value = levels.master;
      masterState.last = levels.master;
      const limiter = ctx.createDynamicsCompressor();
      Object.keys(LIMITER).forEach((name) => { limiter[name].value = LIMITER[name]; });
      master.connect(limiter);
      limiter.connect(ctx.destination);
      const analyser = ctx.createAnalyser();     // beside the signal path: nothing flows on from it
      analyser.fftSize = ANALYSER_SIZE;
      master.connect(analyser);
      const metronomeBus = ctx.createGain();
      metronomeBus.gain.value = levels.metronome;
      metronomeState.last = levels.metronome;
      metronomeBus.connect(master);
      graph = { master, limiter, analyser, metronomeBus };
    }

    function adoptContext(context) {
      ctx = context;
      ctx.onstatechange = () => { publishState('statechange'); };
      levels.master = settingOr(SETTING_MASTER, DEFAULT_MASTER_VOLUME);
      levels.metronome = settingOr(SETTING_METRONOME, DEFAULT_METRONOME_VOLUME);
      buildGraph();
    }

    function requireGraph() {
      if (isClosed || !graph) throw codedError('E-GEN-004', 'the audio engine has no running graph');
      return graph;
    }

    // Every caller checks `ctx` first, so a second context cannot be made (E-AUD-003 never happens by construction).
    /** Creates the one context. Throws a coded E-AUD-001 on failure. */
    function createContext() {
      let created = null;
      try {
        const fault = Core.Faults.active('audio.fail');
        if (fault && fault.phase === 'init') {
          Core.Faults.take('audio.fail');
          throw new Error('injected audio initialization failure');
        }
        created = factory();
        adoptContext(created);
      } catch (error) {
        discardContext(created);
        ctx = null;
        graph = null;
        throw codedError('E-AUD-001', messageOf(error), error);
      }
    }

    // A context whose graph could not be built must not stay open: a retry would then make a second one.
    function discardContext(context) {
      if (!context || typeof context.close !== 'function') return;
      try {
        Promise.resolve(context.close()).catch(() => {});
      } catch (error) {
        Log.warn('audio', 'discarding the context failed: ' + messageOf(error));
      }
    }

    function reportInitFailure(error) {
      Core.ErrorReporter.fatal('E-AUD-001', error, { module: 'Audio' });
    }

    /** B7: creates the context (suspended until the gesture) and publishes the first state. Idempotent. */
    function init() {
      if (isClosed) throw codedError('E-GEN-004', 'the audio engine is closed');
      if (!ctx) {
        try {
          createContext();
        } catch (error) {
          reportInitFailure(error);
          throw error;
        }
      }
      publishState('init');
      return engine;
    }

    // ---- unlock (6.5.4.1) ---------------------------------------------------------------------
    function blocked(reason) {
      return { ok: false, state: stateNow(), reason };
    }

    function resumeContext() {
      if (ctx.state === 'running') return Promise.resolve();
      try {
        return Promise.resolve(ctx.resume()).catch((error) => {
          Log.warn('audio', 'resume rejected: ' + messageOf(error));
        });
      } catch (error) {
        Log.warn('audio', 'resume failed: ' + messageOf(error));
        return Promise.resolve();
      }
    }

    // Waits for the promise, but never longer than the limit: some browsers never settle a blocked resume().
    function settleWithin(promise, limitMs) {
      return new Promise((resolve) => {
        const timer = Core.timers.setTimeout(resolve, limitMs, owner);
        promise.then(() => {
          Core.timers.clearTimeout(timer);
          resolve();
        });
      });
    }

    function markUnlocked() {
      const first = !unlocked;
      unlocked = true;
      publishState('gesture');
      if (first) publishUnlocked();
    }

    async function runUnlock() {
      requestPlaybackSession();
      if (!ctx) {
        try {
          createContext();
        } catch (error) {
          reportInitFailure(error);
          return blocked('E-AUD-001');
        }
        publishState('init');
      }
      const needed = ctx.state !== 'running';
      const resumed = resumeContext();           // called before any await: the gesture is still active
      if (needed) playSilentKick(ctx);
      await settleWithin(resumed, UNLOCK_TIMEOUT_MS);
      if (isClosed) return blocked('E-AUD-002');
      if (ctx.state === 'running') {
        markUnlocked();
        return { ok: true, state: 'running' };
      }
      publishState('gesture');
      Log.info('audio', 'E-AUD-002: sound is still blocked', { state: ctx.state });
      return blocked('E-AUD-002');
    }

    /** Must run inside a user gesture handler. Concurrent calls share one promise; never creates a second context. */
    function unlock() {
      if (unlocking) return unlocking;
      if (isClosed) return Promise.resolve(blocked('E-AUD-002'));
      attempts += 1;
      unlocking = runUnlock().finally(() => { unlocking = null; });
      return unlocking;
    }

    /** DLG-ResumeAudio: resumes a suspended or interrupted context inside the click. */
    const resume = () => unlock().then((result) => result.ok);
    const isUnlocked = () => unlocked && !isClosed && stateNow() !== 'closed';

    // ---- volumes and fades (6.5.4.8) ----------------------------------------------------------
    function setMasterGain(value) {
      levels.master = Core.clamp(requireFinite(value, 'master volume'), 0, 1);
      if (!graph || fadeHeld) return;
      rampThrough(masterState, graph.master.gain, now(), [[levels.master, VOLUME_RAMP_S]]);
    }

    function setMetronomeGain(value) {
      levels.metronome = Core.clamp(requireFinite(value, 'metronome volume'), 0, 1);
      if (!graph) return;
      rampThrough(metronomeState, graph.metronomeBus.gain, now(), [[levels.metronome, VOLUME_RAMP_S]]);
    }

    /** Master to 0 over STOP_FADE_S and held there until fadeIn (a pause). */
    function fadeOut(at) {
      requireGraph();
      fadeHeld = true;
      rampThrough(masterState, graph.master.gain, at === undefined ? now() : at, [[0, STOP_FADE_S]]);
    }

    /** Master back to the volume over START_FADE_S. */
    function fadeIn(at) {
      requireGraph();
      fadeHeld = false;
      rampThrough(masterState, graph.master.gain, at === undefined ? now() : at, [[levels.master, START_FADE_S]]);
    }

    // A stop dips the master and brings it back, so live notes (Free Play) stay audible after the song ends.
    function dipMaster(at) {
      fadeHeld = false;
      rampThrough(masterState, graph.master.gain, at, [[0, STOP_FADE_S], [levels.master, START_FADE_S]]);
    }

    function onTransportState(event) {
      if (!event || !graph) return;
      if (event.state === 'paused') fadeOut(now());
      else if (event.state === 'stopped') dipMaster(now());
      else if (fadeHeld) fadeIn(now());
    }

    function onSettingsChanged(event) {
      if (!event) return;
      if (event.key === SETTING_MASTER) setMasterGain(event.value);
      else if (event.key === SETTING_METRONOME) setMetronomeGain(event.value);
      else if (event.key === '*') {
        setMasterGain(settingOr(SETTING_MASTER, levels.master));
        setMetronomeGain(settingOr(SETTING_METRONOME, levels.metronome));
      }
    }

    // ---- strips and solo (6.5.4.2) ------------------------------------------------------------
    const silencedBySolo = (trackId) => soloSet.size > 0 && !soloSet.has(trackId);

    function refreshAllMutes() {
      strips.forEach((strip) => strip.refreshMute());
    }

    function setSolo(trackId, flag) {
      requireTrackId(trackId);
      if (flag) soloSet.add(trackId);
      else soloSet.delete(trackId);
      refreshAllMutes();
    }

    function setMute(trackId, flag) {
      const strip = strips.get(requireTrackId(trackId));
      if (!strip) return false;
      strip.setMute(flag);
      return true;
    }

    function disposeStrip(trackId) {
      const strip = strips.get(trackId);
      if (!strip) return;
      strips.delete(trackId);
      soloSet.delete(trackId);
      strip.release();
      refreshAllMutes();
    }

    // A handle that was disposed before must not dispose the newer strip of the same track.
    function disposeOwnStrip(trackId, strip) {
      if (strips.get(trackId) === strip) disposeStrip(trackId);
    }

    const stripEnv = Object.freeze({
      context: () => ctx, master: () => graph.master, now, silencedBySolo,
      isSolo: (trackId) => soloSet.has(trackId), setSolo, dispose: disposeOwnStrip
    });

    /** The strip of a track; the same object until it is disposed. */
    function createStrip(trackId) {
      requireTrackId(trackId);
      requireGraph();
      if (strips.has(trackId)) return strips.get(trackId);
      const strip = buildStrip(stripEnv, trackId);
      strips.set(trackId, strip);
      return strip;
    }

    // ---- metronome (6.5.4.6) ------------------------------------------------------------------
    function click(atAudio, accent) {
      requireGraph();
      const shape = accent ? CLICKS.accent : CLICKS.normal;
      const at = requireFinite(atAudio, 'click time');
      const oscillator = ctx.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = shape.hz;
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(shape.level, at + CLICK_ATTACK_S);
      envelope.gain.exponentialRampToValueAtTime(CLICK_FLOOR, at + shape.decayS);
      oscillator.connect(envelope);
      envelope.connect(graph.metronomeBus);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
      oscillator.start(at);
      oscillator.stop(at + CLICK_STOP_S);
    }

    // ---- peak meter (6.5.4.9) -----------------------------------------------------------------
    function readSamples() {
      const analyser = requireGraph().analyser;
      if (typeof analyser.getFloatTimeDomainData === 'function') {
        analyser.getFloatTimeDomainData(scratch);
        return;
      }
      const bytes = new Uint8Array(ANALYSER_SIZE);
      analyser.getByteTimeDomainData(bytes);
      for (let index = 0; index < ANALYSER_SIZE; index += 1) scratch[index] = (bytes[index] - 128) / 128;
    }

    /** Peak of the master output now, a clip flag, and a held peak that decays with HOLD_DECAY_S. */
    function peak() {
      readSamples();
      let level = 0;
      for (let index = 0; index < ANALYSER_SIZE; index += 1) level = Math.max(level, Math.abs(scratch[index]));
      const at = now();
      const elapsed = levels.lastReadAt === null ? 0 : Math.max(0, at - levels.lastReadAt);
      levels.lastReadAt = at;
      levels.hold = Math.max(level, levels.hold * Math.exp(-elapsed / HOLD_DECAY_S));
      return { peak: level, clip: level >= CLIP_LEVEL, holdPeak: levels.hold };
    }

    function emitPeak() {
      if (bus.listenerCount('audio.peak') === 0 || !graph) {
        stopPeakFeed();
        return;
      }
      const reading = peak();
      bus.emit('audio.peak', { l: reading.peak, r: reading.peak, clipped: reading.clip, audioTime: now() });
    }

    function stopPeakFeed() {
      if (peakTimer === null) return;
      Core.timers.clearInterval(peakTimer);
      peakTimer = null;
    }

    /** audio.peak runs at 10 Hz only while somebody listens; the returned function stops listening. */
    function subscribePeak(listener, listenerOwner) {
      requireGraph();
      const off = bus.on('audio.peak', listener, listenerOwner);
      if (peakTimer === null) peakTimer = Core.timers.setInterval(emitPeak, PEAK_FEED_MS, owner);
      return () => {
        off();
        if (bus.listenerCount('audio.peak') === 0) stopPeakFeed();
      };
    }

    // ---- close --------------------------------------------------------------------------------
    function close() {
      if (isClosed) return;
      stopPeakFeed();
      bus.removeOwner(owner);
      Array.from(strips.keys()).forEach(disposeStrip);
      const closing = ctx;
      isClosed = true;
      if (closing) closing.onstatechange = null;
      publishState('statechange');
      if (!closing || typeof closing.close !== 'function') return;
      Promise.resolve(closing.close()).catch((error) => Log.warn('audio', 'close failed: ' + messageOf(error)));
    }

    // ---- assembly -----------------------------------------------------------------------------
    if (options.context) adoptContext(options.context);
    bus.on('transport.state', onTransportState, owner);
    bus.on('settings.changed', onSettingsChanged, owner);

    engine = Object.freeze({
      init, unlock, resume, isUnlocked, ctx: () => ctx, clock: () => clock, state: stateNow, now, latency, sampleRate,
      ctxCount: () => (ctx ? 1 : 0), close, observeTick,
      get master() { return graph ? graph.master : null; },
      get limiter() { return graph ? graph.limiter : null; },
      get analyser() { return graph ? graph.analyser : null; },
      get metronomeBus() { return graph ? graph.metronomeBus : null; },
      setMasterGain, masterGain: () => levels.master, setMetronomeGain, metronomeGain: () => levels.metronome,
      createStrip, disposeStrip, strips: () => Array.from(strips.values()), stripCount: () => strips.size,
      setSolo, setMute, soloSet: () => new Set(soloSet),
      Metronome: Object.freeze({ click }), peak, subscribePeak, fadeOut, fadeIn
    });
    return engine;
  }

  // ---------------------------------------------------------------------------------------------
  // FLM.Audio: the factory and the members of the one app engine (6.5.2)
  // ---------------------------------------------------------------------------------------------
  let appEngine = null;
  const NO_CLOCK = Object.freeze({ now: () => 0 });
  const NO_LATENCY = Object.freeze({ seconds: DESKTOP_LATENCY_S, estimated: true, base: 0, output: 0 });

  /** M-29 B7: creates the app-wide engine (once) and its context. A second call returns the same engine. */
  function init(opts) {
    if (!appEngine) appEngine = createEngine(opts);
    return appEngine.init();
  }

  const forward = (name, fallback) => (...args) => (appEngine ? appEngine[name](...args) : fallback);
  const nodeOf = (name) => (appEngine ? appEngine[name] : null);

  /** Never throws: it runs inside gesture handlers. Without init() it starts the engine with default options. */
  function unlock() {
    try {
      if (!appEngine) init();
      return appEngine.unlock();
    } catch (error) {
      return Promise.resolve({ ok: false, state: 'none', reason: error.code || 'E-AUD-001' });
    }
  }

  return Object.freeze({
    createEngine, init, LIMITER, RAMP_S, START_FADE_S, STOP_FADE_S,
    unlock, resume: () => unlock().then((result) => result.ok),
    ctx: forward('ctx', null), isUnlocked: forward('isUnlocked', false),
    clock: () => (appEngine ? appEngine.clock() : NO_CLOCK), state: forward('state', 'none'),
    now: forward('now', 0), latency: forward('latency', NO_LATENCY), sampleRate: forward('sampleRate', 0),
    ctxCount: forward('ctxCount', 0), close: forward('close'), observeTick: forward('observeTick', false),
    get master() { return nodeOf('master'); },
    get limiter() { return nodeOf('limiter'); },
    get metronomeBus() { return nodeOf('metronomeBus'); },
    setMasterGain: forward('setMasterGain'), masterGain: forward('masterGain', DEFAULT_MASTER_VOLUME),
    setMetronomeGain: forward('setMetronomeGain'), metronomeGain: forward('metronomeGain', DEFAULT_METRONOME_VOLUME),
    createStrip: forward('createStrip'), disposeStrip: forward('disposeStrip'), strips: forward('strips', []),
    stripCount: forward('stripCount', 0), setSolo: forward('setSolo'), setMute: forward('setMute', false),
    soloSet: forward('soloSet', new Set()),
    get Metronome() { return nodeOf('Metronome'); },
    peak: forward('peak'), subscribePeak: forward('subscribePeak'), fadeOut: forward('fadeOut'),
    fadeIn: forward('fadeIn')
  });
});
})();
