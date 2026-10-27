// 05-audio.js - M-05 FLM.Audio (T04.01 to T04.04): the one AudioContext of the page, the unlock gesture and the audio
// state machine; the bus graph (master gain, limiter, analyser, metronome bus); channel strips with gain, pan, mute
// and solo; the metronome click; the peak meter; the master fades; the VoiceAllocator (polyphony caps, note stealing);
// the lookahead Scheduler that turns Transport.pullDue items into instrument calls and sched.* events.
// Separation rule: this file owns exactly one namespace and registers it once through FLM.Core.define. It may use
// only lower-numbered modules (Part 4.2, R-DEP). It declares no module-level global state object (S-07): every engine
// keeps its state inside createEngine(), and FLM.Audio forwards to the one app engine that init() creates.
// Not here yet (later Phase 4 entries): panic(hard) and nodeCount (T04.05), the live note path (T04.06). The Scheduler
// has an internal soft panic (every pause, stop and seek needs one); T04.05 builds the public panic on top of it.
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
  // VoiceAllocator (6.5.4.5, Part 9 rows 21 and 22)
  const DESKTOP_VOICES = 64;
  const MOBILE_VOICES = 32;
  const MIN_POLYPHONY = 16;                  // the setting audio.polyphonyCap runs from 16 to 64 (Part 5.11)
  const MAX_POLYPHONY = 64;
  const STEAL_FADE_S = 0.010;                // a stolen voice fades out over 10 ms (R-P6.1-11)
  const SOFT_PANIC_S = 0.030;                // soft panic ramp (E 2.3)
  const VOICE_MAX_S = 60;                    // a note never sounds longer than this (pedal never released, E 2.3)
  const SETTING_POLYPHONY = 'audio.polyphonyCap';
  const VOICES_FEED_S = 0.1;                 // audio.voices at most 10 Hz (Part 4.4)
  // Scheduler (6.5.4.3, ADR-05, S-09, S-10)
  const LOOKAHEAD_S = 0.120;
  const TICK_MS = 25;
  const LATE_CLAMP_S = 0.005;                // an overdue event is scheduled this far after "now", never in the past
  const MIN_NOTE_S = 0.010;                  // shortest audible note
  const TICK_BUDGET_MS = 4;                  // scheduling work per tick (S-10); the rest stays in the backlog
  const STALL_REPORT_MS = 1;                 // lateness above this is a stall and emits sched.stall
  const STALE_NOTE_S = 0.5;                  // a note this late is dropped, not bunched at "now"
  const WRAP_EPSILON_S = 1e-6;
  const MAX_FAULT_WAIT_MS = 2000;            // timer.stall fault: longest busy wait
  const INTERVAL_BUCKETS = 200;              // tick-interval histogram: 1 ms buckets plus one overflow bucket
  const BODY_BUCKETS = 200;                  // tick-body histogram: 0.1 ms buckets plus one overflow bucket
  const BODY_BUCKET_MS = 0.1;
  const CONTROL_TOPICS = Object.freeze({ cc: 'sched.cc', program: 'sched.program', bend: 'sched.bend' });

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

  const finiteOr = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

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
  // VoiceAllocator (6.5.4.5): a bounded pool of voice slots with a deterministic steal order
  // ---------------------------------------------------------------------------------------------
  /** The setting audio.polyphonyCap (0 = automatic, else 16 to 64) or the platform default. */
  function polyphonyFor(setting, mobile) {
    if (Number.isInteger(setting) && setting > 0) return Core.clamp(setting, MIN_POLYPHONY, MAX_POLYPHONY);
    return mobile ? MOBILE_VOICES : DESKTOP_VOICES;
  }

  /** Level of a slot whose voice has no envelope model: full until released, then a linear fade to its end. */
  function fallbackLevel(slot, time) {
    if (slot.state === 'free') return 0;
    if (slot.state === 'active' || time <= slot.releasedAt) return 1;
    const span = slot.releaseEndAt - slot.releasedAt;
    return span > 0 ? Core.clamp(1 - (time - slot.releasedAt) / span, 0, 1) : 0;
  }

  function levelOf(slot, time) {
    const voice = slot.voice;
    if (voice && typeof voice.levelAt === 'function') {
      const level = voice.levelAt(time);
      if (typeof level === 'number' && Number.isFinite(level)) return Core.clamp(level, 0, 1);
    }
    return fallbackLevel(slot, time);
  }

  function createSlot(index, id) {
    const slot = { id, index, owner: null, voice: null, seq: 0, startedAt: 0, releasedAt: null, releaseEndAt: null,
      state: 'free' };
    slot.levelAt = (time) => levelOf(slot, time);
    return slot;
  }

  function clearSlot(slot) {
    slot.state = 'free';
    slot.owner = null;
    slot.voice = null;
    slot.releasedAt = null;
    slot.releaseEndAt = null;
  }

  /** A voice that throws must not break the allocator: the failure is logged and the slot is handled anyway. */
  function callVoice(slot, method, ...args) {
    const voice = slot.voice;
    if (!voice || typeof voice[method] !== 'function') return;
    try {
      voice[method](...args);
    } catch (error) {
      Log.warn('audio', 'voice.' + method + ' failed: ' + messageOf(error));
    }
  }

  /** True when `first` is the better victim of two released slots: quieter at `time`, then older. */
  function quieterThan(first, second, time) {
    const levelFirst = first.levelAt(time);
    const levelSecond = second.levelAt(time);
    if (levelFirst !== levelSecond) return levelFirst < levelSecond;
    return first.seq < second.seq;
  }

  const olderThan = (first, second) => first.startedAt < second.startedAt ||
    (first.startedAt === second.startedAt && first.seq < second.seq);

  /**
   * The slot to steal when none is free: the quietest released voice, else the oldest active one (R-P6.1-11). One
   * pass without allocation: a 2,000-note chord steals this often inside a 4 ms tick.
   */
  function pickVictim(slots, time) {
    let quietest = null;
    let oldest = null;
    for (const slot of slots) {
      if (slot.state === 'free') continue;
      if (slot.state === 'released' && (quietest === null || quieterThan(slot, quietest, time))) quietest = slot;
      if (oldest === null || olderThan(slot, oldest)) oldest = slot;
    }
    return quietest !== null ? quietest : oldest;
  }

  /**
   * options: {capacity (1 to 64, default 64), onChange(), now()}. The counters are cumulative since resetStats()
   * (the Scheduler resets them at bind): `started` counts every acquire (stolen voices included), `dropped` the notes
   * for which no voice could be made.
   */
  function createVoiceAllocator(options) {
    const given = options || {};
    const onChange = typeof given.onChange === 'function' ? given.onChange : () => {};
    const clockNow = typeof given.now === 'function' ? given.now : () => 0;
    const stealLogKey = 'audio.steal.' + Core.uid();
    const slots = [];
    const counters = { started: 0, stolen: 0, dropped: 0, peakActive: 0 };
    let slotSerial = 0;
    let acquireSerial = 0;

    const isLive = (slot) => Boolean(slot) && slots[slot.index] === slot;
    const busyCount = () => slots.filter((slot) => slot.state !== 'free').length;
    const releasedCount = () => slots.filter((slot) => slot.state === 'released').length;

    function addSlot() {
      slotSerial += 1;
      slots.push(createSlot(slots.length, slotSerial));
    }

    function steal(time) {
      const victim = pickVictim(slots, time);
      callVoice(victim, 'stop', time, STEAL_FADE_S);
      counters.stolen += 1;
      Log.once(stealLogKey, 'info', 'audio', 'voice stealing started: the quietest released voice goes first, then ' +
        'the oldest', { capacity: slots.length });
      // A fresh slot object: a late free() or markReleased() of the old handle must not touch the new owner.
      slotSerial += 1;
      const fresh = createSlot(victim.index, slotSerial);
      clearSlot(victim);
      slots[victim.index] = fresh;
      return fresh;
    }

    /** Returns a slot for a note starting at `atAudio`; steals one when the pool is full, never returns null. */
    function acquire(owner, atAudio) {
      const time = requireFinite(atAudio, 'voice start time');
      const slot = slots.find((candidate) => candidate.state === 'free') || steal(time);
      acquireSerial += 1;
      slot.owner = owner;
      slot.seq = acquireSerial;
      slot.startedAt = time;
      slot.releasedAt = null;
      slot.releaseEndAt = null;
      slot.state = 'active';
      counters.started += 1;
      counters.peakActive = Math.max(counters.peakActive, busyCount());
      onChange();
      return slot;
    }

    /** The voice is released at `atAudio` and has faded out by `releaseEndAudio`; the slot stays held until free(). */
    function markReleased(slot, atAudio, releaseEndAudio) {
      if (!isLive(slot) || slot.state !== 'active') return false;
      const time = requireFinite(atAudio, 'release time');
      slot.state = 'released';
      slot.releasedAt = time;
      slot.releaseEndAt = typeof releaseEndAudio === 'number' ? Math.max(time, releaseEndAudio) : time;
      onChange();
      return true;
    }

    function free(slot) {
      if (!isLive(slot) || slot.state === 'free') return false;
      clearSlot(slot);
      onChange();
      return true;
    }

    /** Releases one voice at `atAudio` (the voice's own release time when `rampS` is undefined). */
    function releaseSlot(slot, atAudio, rampS) {
      if (!isLive(slot) || slot.state === 'free') return false;
      const time = requireFinite(atAudio, 'release time');
      callVoice(slot, 'release', time, rampS);
      slot.state = 'released';
      slot.releasedAt = time;
      slot.releaseEndAt = time + (typeof rampS === 'number' ? rampS : 0);
      onChange();
      return true;
    }

    /** Soft panic: every sounding voice is released with a `rampS` ramp. @returns {number} the voices released */
    function releaseAll(atAudio, rampS) {
      const ramp = rampS === undefined ? SOFT_PANIC_S : rampS;
      const sounding = slots.filter((slot) => slot.state !== 'free');
      sounding.forEach((slot) => releaseSlot(slot, atAudio, ramp));
      return sounding.length;
    }

    /** Hard stop: every voice is stopped and disposed and every slot becomes free. @returns {number} voices stopped */
    function stopAll(atAudio) {
      const time = atAudio === undefined ? clockNow() : atAudio;
      const sounding = slots.filter((slot) => slot.state !== 'free');
      sounding.forEach((slot) => {
        callVoice(slot, 'stop', time);
        callVoice(slot, 'dispose');
        clearSlot(slot);
      });
      if (sounding.length > 0) onChange();
      return sounding.length;
    }

    // Shrinking keeps sounding voices by moving them into free slots below the new size; the rest are stolen.
    function shrinkTo(target) {
      while (slots.length > target) {
        const top = slots[slots.length - 1];
        if (top.state !== 'free') {
          const room = slots.find((slot, index) => index < target && slot.state === 'free');
          if (room) {
            slots[room.index] = top;
            top.index = room.index;
          } else {
            callVoice(top, 'stop', clockNow(), STEAL_FADE_S);
            counters.stolen += 1;
          }
        }
        slots.pop();
      }
    }

    /** The setting range applies: 16 to 64. @returns {number} the capacity now in force */
    function setCapacity(count) {
      const target = Core.clamp(Math.round(requireFinite(count, 'capacity')), MIN_POLYPHONY, MAX_POLYPHONY);
      resize(target);
      return target;
    }

    function resize(target) {
      while (slots.length < target) addSlot();
      shrinkTo(target);
      onChange();
    }

    function resetStats() {
      counters.started = 0;
      counters.stolen = 0;
      counters.dropped = 0;
      counters.peakActive = busyCount();
      onChange();
    }

    /** A note that could not get a voice (the instrument call failed) is counted here: started + dropped = notes. */
    function noteDropped() {
      counters.dropped += 1;
      onChange();
    }

    const stats = () => Object.assign({ capacity: slots.length, active: busyCount(), released: releasedCount() },
      counters);

    resize(Core.clamp(Math.round(finiteOr(given.capacity, DESKTOP_VOICES)), 1, MAX_POLYPHONY));
    return Object.freeze({
      get capacity() { return slots.length; },
      activeCount: busyCount, releasedCount, acquire, markReleased, release: markReleased, free, releaseSlot,
      releaseAll, stopAll, setCapacity, list: () => slots.slice(), stats, resetStats, noteDropped
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Scheduler (6.5.4.3): a 25 ms timer books every due event 120 ms ahead on the audio clock (S-09, S-10)
  // ---------------------------------------------------------------------------------------------
  const noteIdOf = (track, event) => (event.id !== undefined ? event.id
    : track.id + ':' + event.tick + ':' + event.pitch);

  function requireTransport(transport) {
    if (!transport || typeof transport !== 'object') throw codedError('E-GEN-004', 'the Scheduler needs a transport');
    return transport;
  }

  /** Spins for `ms` of real time (fault timer.stall). Date.now(): fake timers do not move it. */
  function busyWait(ms) {
    const until = Date.now() + Core.clamp(finiteOr(ms, 0), 0, MAX_FAULT_WAIT_MS);
    while (Date.now() < until) { /* the stall is the point */ }
  }

  function applyMix(strip, mix) {
    const given = mix || {};
    strip.setGain(finiteOr(given.gain, 1));
    strip.setPan(finiteOr(given.pan, 0));
    strip.setMute(given.mute === true);
    if (given.solo === true) strip.setSolo(true);
  }

  /**
   * env: {bus, owner, allocator, now(), perfNow(), readTick(audioNow), hasStrip(id), createStrip(id), disposeStrip(id),
   * click(at, accent), accentOn(), fadeIn(at), fadeOut(at), setMasterGain(value), publishVoices(force),
   * reportError(error)}. All state lives in this closure: one Scheduler per engine (S-18).
   */
  function createScheduler(env) {
    const bus = env.bus;
    const allocator = env.allocator;
    const pending = new Map();               // sequence -> a scheduled note whose release is still to come
    const programs = new Map();              // trackId -> the program in force
    const ownedStrips = new Set();           // strips this binding made: disposed at unbind
    const subscriptions = [];                // off() functions while the timer runs
    const stats = { ticks: 0, stalls: 0, maxLateMs: 0, scheduled: 0, clamped: 0, skipped: 0, errors: 0,
      lookaheadMaxMs: 0, tickWorkMaxMs: 0, tickWorkSumMs: 0, notesScheduled: 0 };
    const intervalBuckets = new Uint32Array(INTERVAL_BUCKETS + 1);
    const bodyBuckets = new Uint32Array(BODY_BUCKETS + 1);
    let backlog = [];                        // pulled items not yet booked (the remainder of the 4 ms budget)
    let backlogHead = 0;
    let transport = null;
    let song = null;
    let instruments = null;
    let timer = null;
    let noteSeq = 0;
    let lastTickAt = null;                   // audio time of the previous tick
    let lastTickPerf = null;                 // performance time of the previous tick (histogram only)
    let hiddenInGap = false;

    const running = () => timer !== null;

    // ---- strips and binding (Part 4.7.1 step 6) --------------------------------------------------
    function ensureStrip(trackId) {
      if (!env.hasStrip(trackId)) ownedStrips.add(trackId);
      return env.createStrip(trackId);
    }

    function bindStrips(boundSong, mixer) {
      const overrides = (mixer && mixer.tracks) || {};
      boundSong.tracks.forEach((track) => applyMix(ensureStrip(track.id), overrides[track.id] || track.mix));
      const master = mixer && mixer.master;
      if (master && Number.isFinite(master.gain)) env.setMasterGain(master.gain);
    }

    /** One strip per track with Track.mix applied, then start(). A second bind throws E-AUD-005 (S-18). */
    function bind(boundTransport, boundSong, mixer) {
      if (transport !== null) {
        Log.warn('audio', 'E-AUD-005: the Scheduler is already bound; the existing binding is kept');
        throw codedError('E-AUD-005', 'the Scheduler is already bound to a transport');
      }
      requireTransport(boundTransport);
      if (!boundSong || !Array.isArray(boundSong.tracks)) throw codedError('E-GEN-004', 'bind needs a song');
      try {
        song = boundSong;
        bindStrips(boundSong, mixer);
        allocator.resetStats();
        clearStats();
        start(boundTransport);
      } catch (error) {
        unbind();
        throw error;
      }
    }

    /** stop() and every strip this binding made. Safe when nothing is bound. */
    function unbind() {
      stop();
      Array.from(ownedStrips).forEach((trackId) => env.disposeStrip(trackId));
      ownedStrips.clear();
      programs.clear();
      transport = null;
      song = null;
    }

    function start(boundTransport) {
      requireTransport(boundTransport);
      if (timer !== null) return;
      transport = boundTransport;
      resetCursor();
      subscriptions.push(bus.on('transport.seek', onSeek, env.owner), bus.on('transport.state', onState, env.owner),
        Core.dom.on(window.document, 'visibilitychange', onVisibility, undefined, env.owner));
      timer = Core.timers.setInterval(onTimer, TICK_MS, env.owner);
      env.publishVoices(true);
    }

    function stop() {
      if (timer === null) return;
      Core.timers.clearInterval(timer);
      timer = null;
      subscriptions.splice(0).forEach((off) => off());
      softPanic('stop');
      resetCursor();
      env.publishVoices(false);
    }

    function resetCursor() {
      backlog = [];
      backlogHead = 0;
      lastTickAt = null;
      lastTickPerf = null;
      hiddenInGap = false;
    }

    function clearStats() {
      Object.keys(stats).forEach((name) => { stats[name] = 0; });
      intervalBuckets.fill(0);
      bodyBuckets.fill(0);
    }

    // ---- soft panic (6.5.4.4) --------------------------------------------------------------------
    function noteOffPayload(entry, at, reason) {
      return { trackId: entry.trackId, channel: entry.channel, eventId: entry.eventId, pitch: entry.pitch, at, reason };
    }

    /**
     * Every sounding or booked voice is released with the 30 ms ramp, the booked notes are forgotten, and each note
     * still due to sound gets a sched.noteOff with the reason now. Wired to seek, pause and stop; T04.05 adds the
     * public panic and the hard variant. @returns {number} voices released
     */
    function softPanic(reason) {
      const at = env.now();
      pending.forEach((entry) => {
        if (entry.endAudio > at) bus.emit('sched.noteOff', noteOffPayload(entry, at, reason));
      });
      pending.clear();
      backlog = [];
      backlogHead = 0;
      const released = allocator.releaseAll(at, SOFT_PANIC_S);
      bus.emit('audio.panic', { hard: false, releasedCount: released, reason });
      return released;
    }

    // A loop wrap re-emits transport.seek with reason 'loop' from inside pullDue; the loopWrap item handles that one.
    function onSeek(event) {
      if (event && event.reason !== 'loop') softPanic('seek');
    }

    function onState(event) {
      if (event && (event.state === 'paused' || event.state === 'stopped')) softPanic('stop');
    }

    function onVisibility() {
      if (window.document.hidden === true) hiddenInGap = true;
    }

    // ---- the tick --------------------------------------------------------------------------------
    // Fault timer.stall (Part 10.9.2): `skipTicks` interval callbacks are skipped (a throttled background tab); the
    // next `count` ticks busy-wait `ms` before they run. @returns {boolean} true when this callback is skipped
    function applyStallFault() {
      const fault = Core.Faults.active('timer.stall');
      if (!fault) return false;
      if (fault.skipTicks > 0) {
        fault.skipTicks -= 1;
        return true;
      }
      const taken = Core.Faults.take('timer.stall');
      busyWait(taken.ms);
      return false;
    }

    // Fault error.throw {origin:'scheduler'}: the next tick throws before it pulls anything.
    function throwInjectedFault() {
      const fault = Core.Faults.active('error.throw');
      if (!fault || fault.origin !== 'scheduler') return;
      Core.Faults.take('error.throw');
      throw new Error('injected scheduler failure (error.throw)');
    }

    function onTimer() {
      if (applyStallFault()) return;
      runTick(env.now(), true);
    }

    /** One tick with `audioNow` as the time (tests: the clock is injected, so ctx.currentTime is not read). */
    function tickOnce(audioNow) {
      return runTick(requireFinite(audioNow, 'audioNow'), false);
    }

    function noteInterval(perfNow) {
      if (lastTickPerf !== null) {
        const bucket = Math.min(Math.floor(perfNow - lastTickPerf), INTERVAL_BUCKETS);
        intervalBuckets[Math.max(0, bucket)] += 1;
      }
      lastTickPerf = perfNow;
    }

    function noteWork(milliseconds) {
      stats.tickWorkMaxMs = Math.max(stats.tickWorkMaxMs, milliseconds);
      stats.tickWorkSumMs += milliseconds;
      bodyBuckets[Math.max(0, Math.min(Math.floor(milliseconds / BODY_BUCKET_MS), BODY_BUCKETS))] += 1;
    }

    function runTick(audioNow, fromTimer) {
      const started = env.perfNow();
      noteInterval(started);
      try {
        if (fromTimer) throwInjectedFault();
        scheduleDue(audioNow, started);
      } catch (error) {
        stats.errors += 1;
        env.reportError(error);
      }
      noteWork(env.perfNow() - started);
      stats.ticks += 1;
      env.publishVoices(false);
      return stats.ticks;
    }

    function scheduleDue(audioNow, tickStart) {
      if (transport === null) return;
      const reading = env.readTick(audioNow);
      if (reading.repeated) return;          // a frozen clock: nothing new is due (stall detection counts these)
      const gapSeconds = lastTickAt === null ? 0 : audioNow - lastTickAt;
      lastTickAt = audioNow;
      // A stand-in transport without update() or pullDue() (a module-presence stub in tests) schedules nothing.
      if (typeof transport.update === 'function') transport.update(audioNow);
      if (typeof transport.pullDue === 'function') {
        transport.pullDue(audioNow + LOOKAHEAD_S).forEach((item) => backlog.push(item));
      }
      bookBacklog(audioNow, gapSeconds, tickStart);
      forgetEnded(audioNow);
    }

    /**
     * Books items in order until the 4 ms of the whole tick are spent (the pull counts); the rest waits in the
     * backlog for the next tick (S-10). One item is always booked, so the backlog always shrinks.
     */
    function bookBacklog(audioNow, gapSeconds, tickStart) {
      const round = { lateMs: 0, clamped: 0, error: null, loopEnd: loopEndOf() };
      const budgetEnd = tickStart + TICK_BUDGET_MS;
      let handled = 0;
      while (backlogHead < backlog.length) {
        if (handled > 0 && env.perfNow() >= budgetEnd) break;
        const item = backlog[backlogHead];
        backlog[backlogHead] = undefined;
        backlogHead += 1;
        handled += 1;
        bookItem(item, audioNow, round);
      }
      if (backlogHead >= backlog.length) {
        backlog = [];
        backlogHead = 0;
      }
      stats.scheduled += handled;
      finishRound(round, audioNow, gapSeconds);
    }

    function bookItem(item, audioNow, round) {
      const earliest = audioNow + LATE_CLAMP_S;
      let at = item.atAudio;
      if (at < earliest) {
        if (item.kind === 'note' && audioNow - at > STALE_NOTE_S) {
          stats.skipped += 1;
          allocator.noteDropped();           // started + dropped still counts every note (PT-012)
          return;
        }
        round.lateMs = Math.max(round.lateMs, (earliest - at) * MS_PER_SECOND);
        round.clamped += 1;
        at = earliest;
      }
      try {
        dispatchItem(item, at, audioNow, round);
      } catch (error) {
        round.error = round.error || error;
        if (item.kind === 'note') allocator.noteDropped();
      }
    }

    function dispatchItem(item, at, audioNow, round) {
      if (item.kind === 'note') bookNote(item, at, audioNow, round.loopEnd);
      else if (CONTROL_TOPICS[item.kind]) bookControl(item, at);
      else if (item.kind === 'click') bookClick(item, at);
      else if (item.kind === 'marker') bookMarker(item, at);
      else if (item.kind === 'loopWrap') releaseAtWrap(at);
      else if (item.kind === 'start') env.fadeIn(at);
      else if (item.kind === 'end') env.fadeOut(at);
    }

    function finishRound(round, audioNow, gapSeconds) {
      stats.clamped += round.clamped;
      if (round.lateMs > STALL_REPORT_MS) {
        stats.stalls += 1;
        stats.maxLateMs = Math.max(stats.maxLateMs, round.lateMs);
        Log.warn('sched', 'stall catch-up', { lateMs: round.lateMs, events: round.clamped });
        bus.emit('sched.stall', { gapMs: round.lateMs, eventsRescheduled: round.clamped, at: audioNow,
          cause: stallCause(gapSeconds) });
      }
      if (round.error) {
        stats.errors += 1;
        env.reportError(round.error);
      }
    }

    function stallCause(gapSeconds) {
      const hidden = hiddenInGap || window.document.hidden === true;
      hiddenInGap = false;
      if (hidden) return 'hidden';
      return gapSeconds * MS_PER_SECOND > TICK_MS * 2 ? 'timer' : 'unknown';
    }

    // ---- items -----------------------------------------------------------------------------------
    // The loop end of this round, or null: a note that crosses it is released by the wrap, not by its own end.
    function loopEndOf() {
      const looping = typeof transport.loopEnabled === 'function' && transport.loopEnabled();
      const region = looping && typeof transport.loop === 'function' ? transport.loop() : null;
      return region ? region.b : null;
    }

    function releaseReason(event, loopEnd) {
      const crossesEnd = loopEnd !== null && event.tick < loopEnd && event.tick + event.durTicks > loopEnd;
      return crossesEnd ? 'loop' : 'end';
    }

    function bookNote(item, at, audioNow, loopEnd) {
      const track = item.track;
      const event = item.event;
      const end = Math.min(Math.max(item.endAudio, at + MIN_NOTE_S), at + VOICE_MAX_S);
      ensureStrip(track.id);                 // a muted strip still schedules: mute is audibility only (6.5.4.3)
      const slot = instruments && typeof instruments.noteOn === 'function' ? instruments.noteOn(track, event, at, end)
        : null;
      const entry = { trackId: track.id, channel: event.channel, eventId: noteIdOf(track, event), pitch: event.pitch,
        endAudio: end, slot };
      noteSeq += 1;
      pending.set(noteSeq, entry);
      stats.notesScheduled += 1;
      stats.lookaheadMaxMs = Math.max(stats.lookaheadMaxMs, (at - audioNow) * MS_PER_SECOND);
      const program = programs.has(track.id) ? programs.get(track.id) : track.program;
      bus.emit('sched.noteOn', { trackId: track.id, channel: event.channel, eventId: entry.eventId, pitch: event.pitch,
        velocity: event.velocity, program, isDrums: track.isDrums === true, at, atOff: end, durTicks: event.durTicks,
        tick: event.tick, live: false });
      bus.emit('sched.noteOff', noteOffPayload(entry, end, releaseReason(event, loopEnd)));
    }

    function controlPayload(item, at) {
      const event = item.event;
      const base = { trackId: item.track.id, channel: event.channel };
      if (item.kind === 'cc') return Object.assign(base, { controller: event.controller, value: event.value, at });
      if (item.kind === 'bend') return Object.assign(base, { value: event.value, at });
      return Object.assign(base, { program: event.program, bankMsb: event.bankMsb, bankLsb: event.bankLsb, at });
    }

    function bookControl(item, at) {
      if (instruments && typeof instruments.control === 'function') instruments.control(item.track, item.event, at);
      if (item.kind === 'program') programs.set(item.track.id, item.event.program);
      bus.emit(CONTROL_TOPICS[item.kind], controlPayload(item, at));
    }

    // The beat is announced even while the metronome is silent; only the click itself depends on `audible`.
    function bookClick(item, at) {
      if (item.audible) env.click(at, item.accent && env.accentOn());
      bus.emit('sched.beat', { tick: item.tick, bar: item.bar, beat: item.beat, numerator: item.numerator,
        denominator: item.denominator, at, isDownbeat: item.accent, countin: item.countIn });
    }

    function bookMarker(item, at) {
      const marker = item.marker;
      bus.emit('sched.marker', { tick: marker.tick, label: marker.label, kind: marker.kind, at, index: item.index });
    }

    // Notes that cross the loop end already have their release clamped to the wrap; this is the safety net.
    function releaseAtWrap(at) {
      pending.forEach((entry) => {
        if (entry.endAudio <= at + WRAP_EPSILON_S) return;
        if (entry.slot) allocator.releaseSlot(entry.slot, at);
        entry.endAudio = at;
        bus.emit('sched.noteOff', noteOffPayload(entry, at, 'loop'));
      });
    }

    function forgetEnded(audioNow) {
      pending.forEach((entry, sequence) => {
        if (entry.endAudio <= audioNow) pending.delete(sequence);
      });
    }

    // ---- public surface --------------------------------------------------------------------------
    /** Number of scheduled releases still to come. */
    function pendingCount() {
      forgetEnded(env.now());
      return pending.size;
    }

    function setInstruments(instrumentsApi) {
      if (instrumentsApi !== null && typeof instrumentsApi !== 'object') {
        throw codedError('E-GEN-004', 'setInstruments needs an object or null');
      }
      instruments = instrumentsApi;
    }

    const publicStats = () => ({ ticks: stats.ticks, stalls: stats.stalls, maxLateMs: stats.maxLateMs,
      scheduled: stats.scheduled, clamped: stats.clamped, skipped: stats.skipped, errors: stats.errors,
      notesScheduled: stats.notesScheduled, lookaheadMaxMs: stats.lookaheadMaxMs, tickWorkMaxMs: stats.tickWorkMaxMs,
      backlog: backlog.length - backlogHead });

    /** Counts only, nothing to redact: the `scheduler` provider of SCR-Diagnostics and the perf harness (9.7.2). */
    function diagnostics() {
      const voices = allocator.stats();
      return Object.assign(publicStats(), { running: running(), bound: transport !== null,
        lookaheadMs: LOOKAHEAD_S * 1000, tickMs: TICK_MS, voicesStarted: voices.started,
        tickWorkSumMs: stats.tickWorkSumMs, intervalHistogram: Array.from(intervalBuckets),
        bodyHistogram: Array.from(bodyBuckets) });
    }

    return Object.freeze({ bind, unbind, start, stop, running, pending: pendingCount, tickOnce, stats: publicStats,
      diagnostics, setInstruments, softPanic, bound: () => transport !== null, song: () => song });
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
    const metronomeLook = { accent: true };  // audio.metronomeAccent: false makes beat 1 sound like the other beats
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

    // ---- voices (6.5.4.5) ---------------------------------------------------------------------
    const voiceFeed = { dirty: true, lastAt: null };
    const allocator = createVoiceAllocator({ capacity: polyphonyFor(polyphonySetting(), isMobile()), now,
      onChange: () => { voiceFeed.dirty = true; } });

    function polyphonySetting() {
      return options.polyphony !== undefined ? options.polyphony : readSettingRaw(SETTING_POLYPHONY);
    }

    function voicesPayload() {
      const counts = allocator.stats();
      return { active: counts.active, released: counts.released, capacity: counts.capacity, max: counts.capacity,
        stolen: counts.stolen, dropped: counts.dropped, started: counts.started, peakActive: counts.peakActive };
    }

    /**
     * audio.voices (Part 4.4): cumulative counters since bind, emitted only when they changed and at most 10 Hz
     * of audio time. `force` publishes the current state now (the first one after start).
     * @returns {boolean} true when it emitted
     */
    function publishVoices(force) {
      if (!force && !voiceFeed.dirty) return false;
      const at = now();
      if (!force && voiceFeed.lastAt !== null && at - voiceFeed.lastAt < VOICES_FEED_S) return false;
      voiceFeed.dirty = false;
      voiceFeed.lastAt = at;
      bus.emit('audio.voices', voicesPayload());
      return true;
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
      return readTick(audioNow).announced;
    }

    /** The same detection for the Scheduler, which also needs to know that the reading did not move. */
    function readTick(audioNow) {
      if (audioNow !== stall.lastNow) {
        stall.lastNow = audioNow;
        stall.same = 0;
        return { repeated: false, announced: false };
      }
      stall.same += 1;
      if (stall.same !== STALL_TICKS) return { repeated: true, announced: false };
      const current = stateNow();
      bus.emit('audio.state', statePayload(current, current, 'stalled'));
      return { repeated: true, announced: true };
    }

    // ---- the bus graph (6.5.4.2) --------------------------------------------------------------
    function readSettingRaw(path) {
      if (typeof options.readSetting !== 'function') return undefined;
      try {
        return options.readSetting(path);
      } catch (error) {
        Log.warn('audio', 'reading ' + path + ' failed: ' + messageOf(error));
        return undefined;
      }
    }

    function settingOr(path, fallback) {
      const value = readSettingRaw(path);
      return typeof value === 'number' && Number.isFinite(value) ? Core.clamp(value, 0, 1) : fallback;
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
      else if (event.key === SETTING_POLYPHONY) setPolyphony(event.value);
      else if (event.key === '*') {
        setMasterGain(settingOr(SETTING_MASTER, levels.master));
        setMetronomeGain(settingOr(SETTING_METRONOME, levels.metronome));
        setPolyphony(readSettingRaw(SETTING_POLYPHONY));
      }
    }

    // 0 (or anything else that is not a whole number) means "automatic": 64 on desktop, 32 on mobile.
    function setPolyphony(setting) {
      allocator.setCapacity(polyphonyFor(setting, isMobile()));
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

    /** M-28 enter step 6: the metronome settings of the mode, `{accent?:boolean, volume?:0..1}`. */
    function configureMetronome(settings) {
      const given = settings || {};
      if (typeof given.accent === 'boolean') metronomeLook.accent = given.accent;
      if (typeof given.volume === 'number') setMetronomeGain(given.volume);
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
      scheduler.unbind();
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
    const scheduler = createScheduler({ bus, owner, allocator, now, perfNow: Core.now, readTick,
      hasStrip: (trackId) => strips.has(trackId), createStrip, disposeStrip, click,
      accentOn: () => metronomeLook.accent, fadeIn, fadeOut, setMasterGain, publishVoices,
      reportError: (error) => Core.ErrorReporter.report('E-AUD-004', error,
        { module: 'Audio', origin: 'scheduler' }) });
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
      Metronome: Object.freeze({ click, configure: configureMetronome }), peak, subscribePeak, fadeOut, fadeIn,
      VoiceAllocator: allocator, Scheduler: scheduler
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

  // The `scheduler` provider of SCR-Diagnostics and the perf harness (Part 9.7.2): counts only, nothing to redact.
  Core.Diagnostics.provide('scheduler', () => (appEngine ? appEngine.Scheduler.diagnostics() : { bound: false }));

  return Object.freeze({
    createEngine, createVoiceAllocator, polyphonyFor, init, LIMITER, RAMP_S, START_FADE_S, STOP_FADE_S, LOOKAHEAD_S,
    TICK_MS, SOFT_PANIC_S, VOICE_MAX_S, STEAL_FADE_S,
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
    get VoiceAllocator() { return nodeOf('VoiceAllocator'); },
    get Scheduler() { return nodeOf('Scheduler'); },
    peak: forward('peak'), subscribePeak: forward('subscribePeak'), fadeOut: forward('fadeOut'),
    fadeIn: forward('fadeIn')
  });
});
})();
