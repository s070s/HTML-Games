// 05-audio.js - M-05 FLM.Audio (T04.01 to T04.06): the one AudioContext of the page, the unlock gesture and the audio
// state machine; the bus graph (master gain, limiter, analyser, metronome bus); channel strips with gain, pan, mute
// and solo; the metronome click; the peak meter; the master fades; the VoiceAllocator (polyphony caps, note stealing);
// the lookahead Scheduler that turns Transport.pullDue items into instrument calls and sched.* events.
// Separation rule: this file owns exactly one namespace and registers it once through FLM.Core.define. It may use
// only lower-numbered modules (Part 4.2, R-DEP). It declares no module-level global state object (S-07): every engine
// keeps its state inside createEngine(), and FLM.Audio forwards to the one app engine that init() creates.
// T04.05 added the note lifecycle: panic(hard, reason), the node counter (nodeCount, countNodes), the retrigger and
// song-end rules and the live note path (Scheduler.liveNoteOn, liveNoteOff, liveControl). M-06 (FLM.Instruments) is the
// instrument table the Scheduler calls: noteOn, control, startLive, stopLive, applyLive, allNotesOff, onGraphRebuilt.
// Diagnostics Audio panel and the recovery matrix come with T04.08 and T04.09.
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
  const HEAVY_ITEM_MS = 0.25;                // an item that costs more than this is a voice build (counted per tick)
  const MAX_HEAVY_PER_TICK = 6;              // at most this many voice builds in one tick (OI-37)
  const LATE_EPSILON_S = 1e-9;               // a note booked later than the time the Transport gave it is late (clamped)
  const SLOW_ITEM_MS = 3;
  const SLOW_ITEM_KEEP = 40;
  const COST_SAMPLE_CAP_MS = 2;              // one slow build (a preempted thread) must not become the estimate of every build
  const URGENT_S = 0.06;                     // a note due within about two ticks is never held back by the estimate
  const COST_SMOOTHING = 0.2;                // weight of a new cost sample in the running estimate per item type
  const CHORD_WINDOW_S = 0.001;              // notes within 1 ms of the first note of a chord are one chord
  const COMPACT_AFTER = 1024;                // the end queue is cut down when this many records at its front are used
  const SUB_CHANNEL_SPAN = 128;              // a (channel, pitch) pair as one number: channel * 128 + pitch
  const TICK_TAIL_RESERVE_MS = 0.5;          // booking stops this early: the item in flight and the tick's tail stay inside 4 ms
  const STALL_REPORT_MS = 1;                 // lateness above this is a stall and emits sched.stall
  const STALE_NOTE_S = 0.5;                  // a note this late is dropped, not bunched at "now"
  const WRAP_EPSILON_S = 1e-6;
  const MAX_FAULT_WAIT_MS = 2000;            // timer.stall fault: longest busy wait
  const INTERVAL_BUCKETS = 200;              // tick-interval histogram: 1 ms buckets plus one overflow bucket
  const BODY_BUCKETS = 200;                  // tick-body histogram: 0.1 ms buckets plus one overflow bucket
  const BODY_BUCKET_MS = 0.1;
  const CONTROL_TOPICS = Object.freeze({ cc: 'sched.cc', program: 'sched.program', bend: 'sched.bend' });
  const RECOVERY_GAP_S = 0.25;               // two recoveries (hard panics after E-AUD-004) are at least this far apart
  const TEST_TONE_HZ = 440;
  const TEST_TONE_S = 0.5;
  const TEST_TONE_LEVEL = 0.4;
  const LIVE_LEAD_S = 0.002;                 // a live note starts no earlier than this after "now" (6.5.4.3)
  const SUSTAIN_CONTROLLER = 0x40;           // CC 64, released by every panic (E 2.3)
  const GRAPH_NODES = 4;                     // master, limiter, analyser, metronome bus
  const STRIP_NODES = 4;                     // input, gain, pan, mute gain
  const CLICK_NODES = 2;                     // oscillator and envelope of one metronome click
  const PANIC_REASONS = Object.freeze(['user', 'stop', 'seek', 'mode', 'fatal', 'rebuild']);
  const NOTE_OFF_REASON = Object.freeze({ seek: 'seek' });   // every other panic reason ends notes with 'stop'

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
      return { node, set: (value, at) => rampThrough(holder, node.pan, at, [[value, RAMP_S]]),
        reset: (value) => { node.pan.value = value; holder.last = value; } };
    }
    const node = context.createPanner();
    node.panningModel = 'equalpower';
    placeEqualPower(node, 0);
    return { node, set: (value) => placeEqualPower(node, value), reset: (value) => placeEqualPower(node, value) };
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
    const mix = { gain: 1, pan: 0, ccVolume: 1, expression: 1, mute: false };
    const gainState = { last: 1 };
    const muteState = { last: 1 };
    let chain = null;                        // {input, gain, panner, muteGain}; replaced as a whole by rebuild()

    const effectiveMuted = () => mix.mute || env.silencedBySolo(trackId);
    const commandedGain = () => mix.gain * mix.ccVolume * mix.expression;
    const startOf = (at) => (at === undefined ? env.now() : at);

    /** New nodes carrying the cached mix values at once: a hard panic restores the strip exactly (6.5.3). */
    function assemble() {
      const context = env.context();
      const next = { input: context.createGain(), gain: context.createGain(), panner: createPanner(context),
        muteGain: context.createGain() };
      next.input.connect(next.gain);
      next.gain.connect(next.panner.node);
      next.panner.node.connect(next.muteGain);
      next.muteGain.connect(env.master());
      gainState.last = commandedGain();
      next.gain.gain.value = gainState.last;
      next.panner.reset(mix.pan);
      muteState.last = effectiveMuted() ? 0 : 1;
      next.muteGain.gain.value = muteState.last;
      chain = next;
    }

    function applyGain(at) {
      rampThrough(gainState, chain.gain.gain, startOf(at), [[commandedGain(), RAMP_S]]);
    }

    function refreshMute(at) {
      rampThrough(muteState, chain.muteGain.gain, startOf(at), [[effectiveMuted() ? 0 : 1, RAMP_S]]);
    }

    function disconnectChain() {
      [chain.input, chain.gain, chain.panner.node, chain.muteGain].forEach((node) => node.disconnect());
    }

    const strip = {
      trackId,
      get input() { return chain.input; },
      get gain() { return chain.gain; },
      get pan() { return chain.panner.node; },
      get muteGain() { return chain.muteGain; },
      setGain(value, at) {
        mix.gain = Core.clamp(requireFinite(value, 'gain'), 0, MAX_STRIP_GAIN);
        applyGain(at);
      },
      setPan(value, at) {
        mix.pan = Core.clamp(requireFinite(value, 'pan'), -1, 1);
        chain.panner.set(mix.pan, startOf(at));
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
      release: disconnectChain,
      /** Engine use (hard panic): the old chain is disconnected and a new one built from the cached mix state. */
      rebuild() {
        disconnectChain();
        assemble();
      }
    };
    assemble();
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
    let stealLogged = false;                 // the log line (and its data object) is made once, not at every steal
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

    function noteStealingStarted() {
      if (stealLogged) return;
      stealLogged = true;
      Log.once(stealLogKey, 'info', 'audio', 'voice stealing started: the quietest released voice goes first, then ' +
        'the oldest', { capacity: slots.length });
    }

    function steal(time) {
      const victim = pickVictim(slots, time);
      callVoice(victim, 'stop', time, STEAL_FADE_S);
      counters.stolen += 1;
      noteStealingStarted();
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

    // The slot object is replaced, as steal() does: every handle kept by a caller (a booked note, a held live key) is
    // stale from now on and cannot release or free the next voice that takes this place.
    function free(slot) {
      if (!isLive(slot) || slot.state === 'free') return false;
      clearSlot(slot);
      slotSerial += 1;
      slots[slot.index] = createSlot(slot.index, slotSerial);
      onChange();
      return true;
    }

    /** Releases one voice at `atAudio` (the voice's own release time when `rampS` is undefined). */
    function releaseSlot(slot, atAudio, rampS) {
      if (!isLive(slot) || slot.state === 'free') return false;
      const time = requireFinite(atAudio, 'release time');
      callVoice(slot, 'release', time, rampS);
      if (slot.state === 'free') return true;     // the voice ended at once and freed its own slot
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

    /**
     * A note of a same-instant chord that the later notes of that chord would steal at once (more notes than voices) is
     * counted as started and stolen without a voice ever being built (E 2.2: a dense chord never makes unbounded nodes).
     */
    function noteSkipped() {
      counters.started += 1;
      counters.stolen += 1;
      noteStealingStarted();
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
      releaseAll, stopAll, setCapacity, list: () => slots.slice(), stats, resetStats, noteDropped, noteSkipped
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
    const sounding = new Map();              // trackId -> Map(channel * 128 + pitch -> the latest booked note), retrigger
    const liveHeld = new Map();              // trackId -> Map(channel * 128 + pitch -> a live note waiting for liveNoteOff)
    let endQueue = [];                       // {entry, end} sorted by end time: the notes that will be over soon
    let endHead = 0;
    const costs = new Map();                 // item type -> running estimate of its booking cost in ms
    const slowItems = [];                   // [end time on the performance clock, ms, type] of the first items over 3 ms (diagnosis of load spikes)
    let starved = false;                     // the last tick booked nothing although items were waiting
    const ownedStrips = new Set();           // strips this binding made: disposed at unbind
    const subscriptions = [];                // off() functions while the timer runs
    const stats = { ticks: 0, stalls: 0, maxLateMs: 0, scheduled: 0, clamped: 0, skipped: 0, errors: 0,
      lookaheadMaxMs: 0, tickWorkMaxMs: 0, tickWorkSumMs: 0, notesScheduled: 0, pullMaxMs: 0, arrangeMaxMs: 0, itemMaxMs: 0, itemMaxWhat: '' };
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
    // The cost estimates belong to one binding: a new song starts with none, and the next tick may book an item at once.
    function resetCostModel() {
      costs.clear();
      starved = false;
      slowItems.length = 0;
    }

    function unbind() {
      stop();
      resetCostModel();
      Array.from(ownedStrips).forEach((trackId) => env.disposeStrip(trackId));
      ownedStrips.clear();
      programs.clear();
      sounding.clear();
      transport = null;
      song = null;
    }

    function start(boundTransport) {
      requireTransport(boundTransport);
      if (timer !== null) return;
      transport = boundTransport;
      resetCostModel();
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

    // ---- panic (6.5.4.4) -------------------------------------------------------------------------
    function noteOffPayload(entry, at, reason) {
      return { trackId: entry.trackId, channel: entry.channel, eventId: entry.eventId, pitch: entry.pitch, at, reason };
    }

    function panicPayload(hard, reason, count, at) {
      return { hard, reason, voicesStopped: count, releasedCount: count, audioTime: at };
    }

    /**
     * Every booked and live note is forgotten; each one still due to sound gets a sched.noteOff with the panic as the
     * reason ('seek' for a seek, else 'stop'), and the unbooked backlog is dropped.
     */
    function forgetAllNotes(at, reason) {
      const why = NOTE_OFF_REASON[reason] || 'stop';
      pending.forEach((entry) => {
        if (entry.endAudio > at) bus.emit('sched.noteOff', noteOffPayload(entry, at, why));
      });
      liveHeld.forEach((table) => table.forEach((entry) => bus.emit('sched.noteOff', noteOffPayload(entry, at, why))));
      pending.clear();
      sounding.clear();
      liveHeld.clear();
      endQueue = [];
      endHead = 0;
      backlog = [];
      backlogHead = 0;
    }

    // CC 64 goes to 0 on every channel and the instruments forget held live notes (E 2.3). A failing instrument is logged.
    function resetInstruments(at) {
      if (!instruments || typeof instruments.allNotesOff !== 'function') return;
      try {
        instruments.allNotesOff(at);
      } catch (error) {
        Log.warn('audio', 'instruments.allNotesOff failed: ' + messageOf(error));
      }
    }

    /**
     * Soft panic: every sounding or booked voice is released with the 30 ms ramp, booked notes and clicks are
     * forgotten, the sustain pedal goes up. Wired to seek, pause, stop, the panic key and the mode leave.
     * @returns {number} voices released
     */
    function softPanic(reason) {
      const at = env.now();
      forgetAllNotes(at, reason);
      env.cancelClicks(at);
      const released = allocator.releaseAll(at, SOFT_PANIC_S);
      resetInstruments(at);
      bus.emit('audio.panic', panicPayload(false, reason, released, at));
      return released;
    }

    /**
     * Hard panic: every voice is stopped and disposed, the graph is rebuilt on the same context from the cached mix
     * state, and the instruments drop their node references (Instruments.onGraphRebuilt). @returns {number} voices stopped
     */
    function hardPanic(reason) {
      const at = env.now();
      forgetAllNotes(at, reason);
      const stopped = allocator.stopAll(at);
      resetInstruments(at);
      try {
        env.rebuildGraph();
        if (instruments && typeof instruments.onGraphRebuilt === 'function') instruments.onGraphRebuilt(env.engine());
      } finally {
        bus.emit('audio.panic', panicPayload(true, reason, stopped, at));
      }
      if (reason === 'rebuild') resyncTransport(at);
      return stopped;
    }

    // After a recovery rebuild the notes that were booked ahead are gone: the cursor restarts at the position now.
    /** The tick a playing transport is at now, or null: taken before a context is replaced, while the old clock still answers. */
    function heldPosition() {
      const playing = transport !== null && typeof transport.state === 'function' && transport.state() === 'playing';
      if (!playing || typeof transport.positionAt !== 'function') return null;
      return Math.round(transport.positionAt(env.now()));
    }

    /** Puts the playing transport at `tick` on the clock of the new context (a 'resync' seek: no panic, no restart of the song). */
    function reanchor(tick) {
      if (tick === null || transport === null || typeof transport.seek !== 'function') return;
      try {
        transport.seek(tick, 'resync');
      } catch (error) {
        Log.warn('audio', 'anchoring the transport on the new context failed: ' + messageOf(error));
      }
    }

    function resyncTransport(at) {
      const playing = transport !== null && typeof transport.state === 'function' && transport.state() === 'playing';
      if (!playing || typeof transport.positionAt !== 'function' || typeof transport.seek !== 'function') return;
      try {
        transport.seek(Math.round(transport.positionAt(at)), 'resync');
      } catch (error) {
        Log.warn('audio', 'resync after the rebuild failed: ' + messageOf(error));
      }
    }

    // A loop wrap re-emits transport.seek with reason 'loop' from inside pullDue; the loopWrap item handles that one.
    function onSeek(event) {
      if (event && event.reason !== 'loop' && event.reason !== 'resync') softPanic('seek');
    }

    // Playing starts (or resumes) 50 ms ahead (Transport lead-in): the notes at the start are booked at once, in the call that
    // started the transport. Waiting for the next 25 ms tick lets a busy main thread (the mode set-up that follows) delay it past
    // the first notes, and they are late.
    function bookAtStart() {
      if (timer === null || transport === null) return;
      try {
        pullAndBook(env.now(), env.perfNow());     // not a tick: the stall detection and the interval histogram do not see it
      } catch (error) {
        stats.errors += 1;
        env.reportError(error);
      }
    }

    function onState(event) {
      if (!event) return;
      if (event.state === 'paused' || event.state === 'stopped') softPanic('stop');
      else if (event.state === 'playing') bookAtStart();
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
        env.pollFaults();
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
      pullAndBook(audioNow, tickStart);
    }

    // Pulls what is due within the lookahead and books what the budget allows (one tick of the Scheduler, without the clock reading).
    function pullAndBook(audioNow, tickStart) {
      const gapSeconds = lastTickAt === null ? 0 : audioNow - lastTickAt;
      lastTickAt = audioNow;
      // A stand-in transport without update() or pullDue() (a module-presence stub in tests) schedules nothing.
      if (typeof transport.update === 'function') transport.update(audioNow);
      if (typeof transport.pullDue === 'function') {
        const pullStart = env.perfNow();
        const due = transport.pullDue(audioNow + LOOKAHEAD_S);
        const arrangeStart = env.perfNow();
        const pulled = arrangeChords(due);
        const pullEnd = env.perfNow();
        if (backlogHead >= backlog.length) {
          backlog = pulled.slice();          // a copy: the booking loop clears the entries it has used
          backlogHead = 0;
        } else {
          for (let index = 0; index < pulled.length; index += 1) backlog.push(pulled[index]);
        }
        stats.pullMaxMs = Math.max(stats.pullMaxMs, pullEnd - pullStart);
        stats.arrangeMaxMs = Math.max(stats.arrangeMaxMs, pullEnd - arrangeStart);
      }
      bookBacklog(audioNow, gapSeconds, tickStart);
      forgetEnded(audioNow);
    }

    // The priority of a note for the choice of survivors (D84): drums and bass 2, melody 1, pads and effects 0. Asked once
    // per track and channel in a call, not once per note.
    function priorityOf(item, known) {
      const key = (item.trackIndex || 0) * SUB_CHANNEL_SPAN + item.event.channel;
      let priority = known.get(key);
      if (priority === undefined) {
        priority = instruments && typeof instruments.priorityOf === 'function' ?
          instruments.priorityOf(item.track, item.event, item.atAudio) : 1;
        priority = Core.clamp(priority, 0, 2);
        known.set(key, priority);
      }
      return priority;
    }

    /** The runs of notes that start within 1 ms of each other (the pulled items are sorted by time): {first, last, count}. */
    function chordRuns(items) {
      const runs = [];
      let run = null;
      let start = 0;
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (item.kind !== 'note') continue;
        if (run === null || item.atAudio - start > CHORD_WINDOW_S) {
          start = item.atAudio;
          run = { first: index, last: index, count: 1 };
          runs.push(run);
        } else {
          run.last = index;
          run.count += 1;
        }
      }
      return runs;
    }

    // The key of a note on one track and channel: a second note on it at the same instant would only cut the first.
    const noteKeyOf = (item) => (item.trackIndex || 0) * SUB_CHANNEL_SPAN * SUB_CHANNEL_SPAN +
      item.event.channel * SUB_CHANNEL_SPAN + item.event.pitch;

    // The notes of the chord by priority and track, in one pass: {items, velocity (of the first), mixed (velocities differ)}.
    function bucketNotes(notes, known) {
      const tiers = [new Map(), new Map(), new Map()];
      let bucket = null;
      let lastTrack = -1;
      let lastChannel = -1;
      let tier = 1;
      for (let index = 0; index < notes.length; index += 1) {
        const item = notes[index];
        const trackIndex = item.trackIndex || 0;
        if (bucket === null || trackIndex !== lastTrack || item.event.channel !== lastChannel) {
          lastTrack = trackIndex;
          lastChannel = item.event.channel;
          tier = priorityOf(item, known);
          bucket = tiers[tier].get(trackIndex);
          if (bucket === undefined) {
            bucket = { items: [], velocity: item.event.velocity, mixed: false };
            tiers[tier].set(trackIndex, bucket);
          }
        }
        bucket.items.push(item);
        if (item.event.velocity !== bucket.velocity) bucket.mixed = true;
      }
      return tiers;
    }

    // The loudest note of a track first; equal velocities keep their order.
    function loudestFirst(bucket) {
      if (!bucket.mixed) return bucket.items;
      return bucket.items.map((item, index) => ({ item, index })).sort((first, second) => second.item.event.velocity -
        first.item.event.velocity || first.index - second.index).map((entry) => entry.item);
    }

    // Round-robin over the tracks of one priority: the loudest note of each track in turn. A note whose key is already
    // taken is a duplicate of a louder (or earlier) one and is skipped. @returns {number} the room that is left
    function takeRoundRobin(table, room, survivors, taken) {
      const lists = Array.from(table.keys()).sort((first, second) => first - second).map((key) => loudestFirst(table.get(key)));
      const next = lists.map(() => 0);
      let left = room;
      let progress = true;
      while (left > 0 && progress) {
        progress = false;
        for (let at = 0; at < lists.length && left > 0; at += 1) {
          const list = lists[at];
          while (next[at] < list.length && taken.has(noteKeyOf(list[next[at]]))) next[at] += 1;
          if (next[at] >= list.length) continue;
          const item = list[next[at]];
          next[at] += 1;
          taken.add(noteKeyOf(item));
          survivors.add(item);
          left -= 1;
          progress = true;
        }
      }
      return left;
    }

    // Same track, channel and pitch twice at one instant: only the louder one sounds (the other would only cut it). @returns {Set}
    function loudestPerKey(notes) {
      const best = new Map();
      for (let index = 0; index < notes.length; index += 1) {
        const key = noteKeyOf(notes[index]);
        const held = best.get(key);
        if (held === undefined || notes[index].event.velocity > held.event.velocity) best.set(key, notes[index]);
      }
      return new Set(best.values());
    }

    // Survivors of a chord with more notes than voices: by priority, then round-robin over the tracks (D81, D84).
    function chooseSurvivors(notes, capacity, known) {
      const tiers = bucketNotes(notes, known);
      const survivors = new Set();
      const taken = new Set();
      let room = capacity;
      for (let tier = 2; tier >= 0 && room > 0; tier -= 1) {
        if (tiers[tier].size > 0) room = takeRoundRobin(tiers[tier], room, survivors, taken);
      }
      return survivors;
    }

    /**
     * A chord of the same instant (1 ms), whatever its size (E 2.2): duplicates of one key lose to the loudest, and with more notes
     * than voices the others lose by priority, then round-robin over the tracks; the notes that lose are marked and never get a voice. The survivors are booked first (in their original order), the voiceless notes are announced after them
     * (D81); a control item inside the 1 ms of the chord goes before the notes. @returns {Array} the items in booking order
     */
    function arrangeChords(items) {
      const capacity = allocator.capacity;
      if (items.length < 2) return items;
      const runs = chordRuns(items).filter((run) => run.count > 1);
      if (runs.length === 0) return items;
      let arranged = [];
      let copied = 0;
      runs.forEach((run) => {
        const span = items.slice(run.first, run.last + 1);
        const notes = span.length === run.count ? span : span.filter((item) => item.kind === 'note');
        const survivors = run.count > capacity ? chooseSurvivors(notes, capacity, new Map()) : loudestPerKey(notes);
        if (survivors.size === run.count) return;                                   // nothing is cut: the order stays as it is
        arranged = arranged.concat(items.slice(copied, run.first));
        const controls = [];
        const front = [];
        const voiceless = [];
        for (let index = 0; index < span.length; index += 1) {
          const item = span[index];
          if (item.kind !== 'note') controls.push(item);
          else if (survivors.has(item)) front.push(item);
          else {
            item.overflow = true;
            voiceless.push(item);
          }
        }
        arranged = arranged.concat(controls, front, voiceless);
        copied = run.last + 1;
      });
      return copied === 0 ? items : arranged.concat(items.slice(copied));
    }

    /**
     * Books items in order until the 4 ms of the whole tick are spent (the pull counts); the rest waits in the
     * backlog for the next tick (S-10). A tick whose pull already used the budget books nothing, but the tick after it
     * always books at least one item, so the backlog always shrinks.
     */
    function bookBacklog(audioNow, gapSeconds, tickStart) {
      const round = { lateMs: 0, clamped: 0, error: null, loopEnd: loopEndOf(), songEnd: songEndAudio() };
      const budgetEnd = tickStart + TICK_BUDGET_MS - TICK_TAIL_RESERVE_MS;
      const hardEnd = tickStart + TICK_BUDGET_MS;
      const worst = new Map();             // the most expensive item of each type in this tick
      let handled = 0;
      let heavy = 0;
      while (backlogHead < backlog.length) {
        const before = env.perfNow();
        const next = backlog[backlogHead];
        const type = costType(next);
        // Stop when the 3.5 ms are spent, when the next item (at its estimated cost) would pass the 4 ms, or after six
        // voice builds (S-10, OI-37). After a tick that booked nothing one item is always booked.
        // A note due within about two ticks goes by the clock alone (the 4 ms), never by the estimate or the build cap.
        const predicted = Math.max(costs.get(type) || 0, worst.get(type) || 0);
        const urgent = next.atAudio - audioNow < URGENT_S;
        const holdBack = urgent ? before >= hardEnd : before >= budgetEnd || before + predicted > hardEnd ||
          heavy >= MAX_HEAVY_PER_TICK;
        if ((handled > 0 || !starved) && holdBack) break;
        backlog[backlogHead] = undefined;
        backlogHead += 1;
        handled += 1;
        bookItem(next, audioNow, round);
        const cost = env.perfNow() - before;
        if (cost > HEAVY_ITEM_MS) heavy += 1;
        if (cost > SLOW_ITEM_MS && slowItems.length < SLOW_ITEM_KEEP) slowItems.push([Math.round((before + cost) * 10) / 10, Math.round(cost * 10) / 10, type]);
        if (cost > stats.itemMaxMs) {
          stats.itemMaxMs = cost;
          stats.itemMaxWhat = type + (next.track ? ' ' + next.track.id + ' program ' + next.track.program : '') + ' at tick ' +
            (next.event ? next.event.tick : '-') + ' of tick ' + stats.ticks;
        }
        const sample = Math.min(cost, COST_SAMPLE_CAP_MS);
        worst.set(type, Math.max(worst.get(type) || 0, sample));
        const known = costs.get(type);
        costs.set(type, known === undefined ? sample : known + (sample - known) * COST_SMOOTHING);
      }
      if (backlogHead >= backlog.length) {
        backlog = [];
        backlogHead = 0;
      }
      stats.scheduled += handled;
      starved = handled === 0 && backlogHead < backlog.length;
      finishRound(round, audioNow, gapSeconds);
    }

    // Notes without a voice cost next to nothing; every other kind of item has its own running estimate.
    const costType = (item) => (item.overflow === true ? 'voiceless' : item.kind);

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
        injectScheduleFault(item);
        dispatchItem(item, at, audioNow, round);
      } catch (error) {
        round.error = round.error || error;
        if (item.kind === 'note') allocator.noteDropped();
      }
    }

    // Fault audio.fail {phase:'schedule'} (Part 10.9.2): the next `count` note bookings throw, as a failing start() would.
    function injectScheduleFault(item) {
      if (item.kind !== 'note') return;
      const fault = Core.Faults.active('audio.fail');
      if (!fault || fault.phase !== 'schedule') return;
      Core.Faults.take('audio.fail');
      throw new Error('injected scheduling failure (audio.fail)');
    }

    function dispatchItem(item, at, audioNow, round) {
      if (item.kind === 'note') bookNote(item, at, audioNow, round);
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
        env.recover();                       // E-AUD-004: hard panic, then scheduling goes on from the position now
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

    const subKeyOf = (channel, pitch) => channel * SUB_CHANNEL_SPAN + pitch;

    function tableOf(map, trackId) {
      let table = map.get(trackId);
      if (table === undefined) {
        table = new Map();
        map.set(trackId, table);
      }
      return table;
    }

    // The audio time at which the song ends, or null: a note still held then is closed there (the end item stops the run).
    function songEndAudio() {
      const boundSong = typeof transport.song === 'function' ? transport.song() : song;
      const total = boundSong ? boundSong.durationTicks : 0;
      const looping = typeof transport.loopEnabled === 'function' && transport.loopEnabled();
      if (looping || !(total > 0) || typeof transport.audioTimeAt !== 'function') return null;
      return transport.audioTimeAt(total);
    }

    // A new note on a key that still sounds releases the earlier voice first (retrigger, sched.noteOff 'overlap').
    function releaseEarlier(table, sub, at) {
      const earlier = table.get(sub);
      if (!earlier || earlier.endAudio <= at + WRAP_EPSILON_S) return;
      if (earlier.slot) allocator.releaseSlot(earlier.slot, at);
      earlier.endAudio = at;
      queueEnd(earlier);
      bus.emit('sched.noteOff', noteOffPayload(earlier, at, 'overlap'));
    }

    function bookNote(item, at, audioNow, round) {
      const track = item.track;
      const event = item.event;
      const wanted = round.songEnd === null ? item.endAudio : Math.min(item.endAudio, round.songEnd);
      const end = Math.min(Math.max(wanted, at + MIN_NOTE_S), at + VOICE_MAX_S);
      ensureStrip(track.id);                 // a muted strip still schedules: mute is audibility only (6.5.4.3)
      const table = tableOf(sounding, track.id);
      const sub = subKeyOf(event.channel, event.pitch);
      const voiceless = item.overflow === true;     // a note cut by the chord rule never touches the sounding notes
      if (!voiceless) releaseEarlier(table, sub, at);
      let slot = null;
      const canPlay = instruments && typeof instruments.noteOn === 'function';
      if (canPlay && voiceless) allocator.noteSkipped();
      else if (canPlay) slot = instruments.noteOn(track, event, at, end);
      const entry = { trackId: track.id, channel: event.channel, eventId: noteIdOf(track, event), pitch: event.pitch,
        endAudio: end, slot, table, sub, seq: 0, done: false };
      noteSeq += 1;
      entry.seq = noteSeq;
      pending.set(noteSeq, entry);
      if (!voiceless) table.set(sub, entry);
      queueEnd(entry);
      stats.notesScheduled += 1;
      stats.lookaheadMaxMs = Math.max(stats.lookaheadMaxMs, (at - audioNow) * MS_PER_SECOND);
      const program = programs.has(track.id) ? programs.get(track.id) : track.program;
      bus.emit('sched.noteOn', { trackId: track.id, channel: event.channel, eventId: entry.eventId, pitch: event.pitch,
        velocity: event.velocity, program, isDrums: track.isDrums === true, at, atOff: end, durTicks: event.durTicks,
        tick: event.tick, live: false, voiced: slot !== null && slot !== undefined, late: at - item.atAudio > LATE_EPSILON_S });
      bus.emit('sched.noteOff', noteOffPayload(entry, end, releaseReason(event, round.loopEnd)));
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
        queueEnd(entry);
        bus.emit('sched.noteOff', noteOffPayload(entry, at, 'loop'));
      });
    }

    // The notes sorted by the time they end: forgetting the finished ones looks at the front of the queue only.
    function queueEnd(entry) {
      const record = { entry, end: entry.endAudio };
      let low = endHead;
      let high = endQueue.length;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (endQueue[middle].end <= record.end) low = middle + 1;
        else high = middle;
      }
      endQueue.splice(low, 0, record);
    }

    function forgetEnded(audioNow) {
      while (endHead < endQueue.length && endQueue[endHead].end <= audioNow) {
        const entry = endQueue[endHead].entry;
        endQueue[endHead] = undefined;
        endHead += 1;
        if (entry.done) continue;           // an earlier record of the same note already ended it
        entry.done = true;
        pending.delete(entry.seq);
        if (entry.table.get(entry.sub) === entry) entry.table.delete(entry.sub);
      }
      if (endHead > COMPACT_AFTER && endHead * 2 > endQueue.length) {
        endQueue = endQueue.slice(endHead);
        endHead = 0;
      }
    }

    // ---- live input: Free Play and Studio recording (6.5.4.3) ------------------------------------
    function liveInfo(trackId, options) {
      const given = options || {};
      const found = song && Array.isArray(song.tracks) ? song.tracks.find((candidate) => candidate.id === trackId) : null;
      let program = found ? found.program : 0;
      if (programs.has(trackId)) program = programs.get(trackId);
      if (given.program !== undefined) program = given.program;
      const isDrums = given.isDrums !== undefined ? given.isDrums === true : Boolean(found && found.isDrums);
      return { program: finiteOr(program, 0), isDrums };
    }

    // A live event never starts in the past: at least 2 ms after "now" (UT-05-30).
    const liveStart = (atAudio) => Math.max(finiteOr(atAudio, env.now()), env.now() + LIVE_LEAD_S);

    function liveTick(at) {
      try {
        return transport && typeof transport.tickAt === 'function' ? finiteOr(transport.tickAt(at), 0) : 0;
      } catch (error) {
        return 0;
      }
    }

    function releaseLiveEarlier(table, sub, at) {
      const earlier = table.get(sub);
      if (!earlier) return;
      if (earlier.slot) allocator.releaseSlot(earlier.slot, at);
      table.delete(sub);
      bus.emit('sched.noteOff', noteOffPayload(earlier, at, 'overlap'));
    }

    function startLiveVoice(trackId, info, channel, pitch, velocity, at) {
      if (!instruments || typeof instruments.startLive !== 'function') return null;
      try {
        return instruments.startLive(trackId, info.program, info.isDrums, channel, pitch, velocity, at);
      } catch (error) {
        allocator.noteDropped();
        stats.errors += 1;
        env.reportError(error);
        return null;
      }
    }

    /**
     * A key goes down on a track: the instrument voice starts at max(atAudio, now + 2 ms) and is held until
     * liveNoteOff (or a panic). options: {program?, isDrums?} when the track is not in the bound song.
     * @returns {(object|null)} the voice slot, or null when no voice was made
     */
    function liveNoteOn(trackId, pitch, velocity, channel, atAudio, options) {
      requireTrackId(trackId);
      requireFinite(pitch, 'pitch');
      const lane = finiteOr(channel, 0);
      const at = liveStart(atAudio);
      const table = tableOf(liveHeld, trackId);
      const sub = subKeyOf(lane, pitch);
      releaseLiveEarlier(table, sub, at);
      const info = liveInfo(trackId, options);
      ensureStrip(trackId);
      const slot = startLiveVoice(trackId, info, lane, pitch, velocity, at);
      noteSeq += 1;
      const entry = { trackId, channel: lane, eventId: 'live:' + noteSeq, pitch, endAudio: Infinity, slot };
      table.set(sub, entry);
      bus.emit('sched.noteOn', { trackId, channel: lane, eventId: entry.eventId, pitch, velocity, program: info.program,
        isDrums: info.isDrums, at, atOff: null, durTicks: 0, tick: liveTick(at), live: true });
      return slot;
    }

    /** The key comes up: the instrument releases the live voice (a held sustain pedal may keep it sounding). */
    function liveNoteOff(trackId, pitch, channel, atAudio) {
      requireTrackId(trackId);
      const lane = finiteOr(channel, 0);
      const at = liveStart(atAudio);
      const table = tableOf(liveHeld, trackId);
      const sub = subKeyOf(lane, pitch);
      const entry = table.get(sub);
      if (!entry) return false;
      table.delete(sub);
      if (instruments && typeof instruments.stopLive === 'function') instruments.stopLive(trackId, lane, pitch, at);
      else if (entry.slot) allocator.releaseSlot(entry.slot, at);
      bus.emit('sched.noteOff', noteOffPayload(entry, at, 'live'));
      return true;
    }

    /** A controller, bend or program change from a live source: {channel, controller?, value?, program?, bank*?}. */
    function liveControl(trackId, kind, event, atAudio) {
      requireTrackId(trackId);
      if (!CONTROL_TOPICS[kind]) throw codedError('E-GEN-004', 'liveControl kind must be cc, program or bend');
      const given = event || {};
      const at = liveStart(atAudio);
      const lane = finiteOr(given.channel, 0);
      if (instruments && typeof instruments.applyLive === 'function') {
        const first = kind === 'cc' ? given.controller : (kind === 'bend' ? given.value : given.program);
        const second = kind === 'cc' ? given.value : given.bankMsb;
        instruments.applyLive(trackId, lane, kind, first, second, at);
      }
      if (kind === 'program') programs.set(trackId, given.program);
      bus.emit(CONTROL_TOPICS[kind], controlPayload({ kind, track: { id: trackId },
        event: Object.assign({}, given, { channel: lane }) }, at));
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
      notesScheduled: stats.notesScheduled, lookaheadMaxMs: stats.lookaheadMaxMs, tickWorkMaxMs: stats.tickWorkMaxMs, pullMaxMs: stats.pullMaxMs,
      arrangeMaxMs: stats.arrangeMaxMs, itemMaxMs: stats.itemMaxMs, itemMaxWhat: stats.itemMaxWhat, backlog: backlog.length - backlogHead });

    /** Counts only, nothing to redact: the `scheduler` provider of SCR-Diagnostics and the perf harness (9.7.2). */
    function diagnostics() {
      const voices = allocator.stats();
      return Object.assign(publicStats(), { running: running(), bound: transport !== null,
        lookaheadMs: LOOKAHEAD_S * 1000, tickMs: TICK_MS, voicesStarted: voices.started,
        tickWorkSumMs: stats.tickWorkSumMs, slowItems: slowItems.slice(), intervalHistogram: Array.from(intervalBuckets),
        bodyHistogram: Array.from(bodyBuckets) });
    }

    return Object.freeze({ bind, unbind, start, stop, running, pending: pendingCount, tickOnce, stats: publicStats,
      diagnostics, setInstruments, softPanic, hardPanic, heldPosition, reanchor, liveNoteOn, liveNoteOff, liveControl,
      bound: () => transport !== null, song: () => song });
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
    let externalNodes = 0;                   // nodes M-06 reports through countNodes (voices)
    const recovery = { blockedUntil: 0, lastAt: -Infinity, closedReported: false, expectClosed: false };
    const liveClicks = new Set();            // metronome clicks that have not ended: {oscillator, envelope}

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
      master.gain.value = fadeHeld ? 0 : levels.master;      // a rebuild during a pause stays silent
      masterState.last = master.gain.value;
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

    // A context closed behind the engine's back is E-AUD-008 (return to the menu, the project stays in memory). An
    // offline context closes itself when its rendering ends: that is not a failure.
    function onContextState() {
      publishState('statechange');
      if (stateNow() !== 'closed' || isClosed || recovery.closedReported) return;
      if (typeof ctx.startRendering === 'function' && !recovery.expectClosed) return;
      recovery.closedReported = true;
      Core.ErrorReporter.report('E-AUD-008', null, { module: 'Audio' });
    }

    // The output device changed: latency may differ, so audio.sink tells M-07 to sample its input anchor again. The audio
    // is not unlocked a second time, so nobody that waits for the first unlock runs twice.
    function publishSink() {
      const info = latency();
      bus.emit('audio.sink', { audioTime: now(), sampleRate: sampleRate(), latencyMs: info.seconds * MS_PER_SECOND,
        baseLatency: info.base, outputLatency: info.output });
    }

    function onSinkChange() {
      Core.ErrorReporter.report('E-AUD-011', null, { module: 'Audio' });
      if (unlocked) publishSink();
    }

    function adoptContext(context) {
      ctx = context;
      ctx.onstatechange = onContextState;
      if (typeof ctx.addEventListener === 'function') ctx.addEventListener('sinkchange', onSinkChange);
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
      if (ctx && Core.now() < recovery.blockedUntil) {      // fault audio.suspend {blockResumeMs}: resume() is refused
        Log.info('audio', 'E-AUD-002: sound is blocked by an injected fault', { state: ctx.state });
        return blocked('E-AUD-002');
      }
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

    /** What SCR-Diagnostics shows about the engine: plain data, latency labeled as an estimate (I 3.5). */
    function info() {
      return { state: stateNow(), unlocked: isUnlocked(), attempts, sampleRate: sampleRate(), latency: latency(),
        contexts: ctx ? 1 : 0 };
    }

    /** A short sine through the master chain (SCR-Diagnostics "Test tone"); the nodes end by themselves. */
    function testTone(hz, seconds) {
      requireGraph();
      const length = Core.clamp(finiteOr(seconds, TEST_TONE_S), 0.05, 2);
      const at = now() + LIVE_LEAD_S;
      const source = ctx.createOscillator();
      source.frequency.value = finiteOr(hz, TEST_TONE_HZ);
      const level = ctx.createGain();
      level.gain.setValueAtTime(0, at);
      level.gain.linearRampToValueAtTime(TEST_TONE_LEVEL, at + RAMP_S);
      level.gain.setValueAtTime(TEST_TONE_LEVEL, at + length - STOP_FADE_S);
      level.gain.linearRampToValueAtTime(0, at + length);
      source.connect(level);
      level.connect(graph.master);
      source.onended = () => {
        source.disconnect();
        level.disconnect();
      };
      source.start(at);
      source.stop(at + length + RAMP_S);
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

    /**
     * "Restart audio" (R-P19-04), called inside the click: a context closed behind the engine is replaced by a new one, the
     * graph and the strips are rebuilt, then the context is resumed. @returns {Promise<boolean>} whether sound runs now
     */
    function restart() {
      if (isClosed) return Promise.resolve(false);
      if (ctx && ctx.state === 'closed') {
        const held = scheduler.heldPosition();      // the position on the old clock, before the new context has another time base
        const dead = ctx;
        dead.onstatechange = null;
        strips.forEach((strip) => strip.release());
        try {
          createContext();
        } catch (error) {
          Log.warn('audio', 'restart could not create a context: ' + messageOf(error));
          return Promise.resolve(false);
        }
        recovery.closedReported = false;
        recovery.expectClosed = false;
        strips.forEach((strip) => strip.rebuild());
        lastPublished = null;
        publishState('init');
        scheduler.reanchor(held);                   // the song goes on from where it was, on the clock of the new context
        publishSink();                              // M-07 samples its input anchor on the new context (07-input listens)
      }
      const resumed = unlock();                 // resume() is called before anything is awaited
      if (ctx && stateNow() !== 'closed') panic(true, 'rebuild');
      return resumed.then((result) => result.ok);
    }

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
    function click(atAudio, accent, booked) {
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
      const live = { oscillator, envelope, booked: booked === true, at, cancelled: false };
      liveClicks.add(live);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
        liveClicks.delete(live);
      };
      oscillator.start(at);
      oscillator.stop(at + CLICK_STOP_S);
    }

    /**
     * The clicks the Scheduler booked ahead (a seek or a stop makes them wrong): one that has not started never sounds,
     * one that is sounding fades over RAMP_S and stops. Clicks played by hand (calibration) are left alone.
     */
    // everything: also the clicks that a caller of Metronome.click booked itself (the calibration wizard cancels its own).
    function cancelClicks(atAudio, everything) {
      const at = atAudio === undefined ? now() : atAudio;
      liveClicks.forEach((live) => {
        if (!live.booked && everything !== true) return;
        live.cancelled = true;
        try {
          live.envelope.gain.cancelScheduledValues(at);
          live.envelope.gain.setValueAtTime(live.envelope.gain.value, at);
          live.envelope.gain.linearRampToValueAtTime(0, at + RAMP_S);
          live.oscillator.stop(at + RAMP_S);
        } catch (error) {
          Log.warn('audio', 'cancelling a click failed: ' + messageOf(error));
        }
      });
    }

    /** The audio times of the clicks that are booked and neither cancelled nor played yet, in order. */
    function scheduledClicks() {
      const pending = [];
      liveClicks.forEach((live) => { if (!live.cancelled && live.at >= now()) pending.push(live.at); });
      return pending.sort((first, second) => first - second);
    }

    function dropClicks() {
      liveClicks.forEach((live) => {
        try {
          live.oscillator.onended = null;
          live.oscillator.stop(now());
        } catch (error) {
          // a click that never started cannot be stopped twice; it is disconnected below either way
        }
        live.oscillator.disconnect();
        live.envelope.disconnect();
      });
      liveClicks.clear();
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

    // ---- nodes and panic (6.5.4.4) ------------------------------------------------------------
    /**
     * The audio nodes that stay: the four of the master graph, four per channel strip, and the nodes M-06 reports with
     * countNodes (voices). Metronome clicks live at most 80 ms and end by themselves: see transientNodeCount.
     */
    function nodeCount() {
      return (graph ? GRAPH_NODES : 0) + strips.size * STRIP_NODES + externalNodes;
    }

    /** M-06 reports the nodes of a voice it builds (+n) and disposes (-n); the count never goes below 0. */
    function countNodes(change) {
      externalNodes = Math.max(0, externalNodes + Math.round(requireFinite(change, 'node change')));
      return externalNodes;
    }

    const transientNodeCount = () => liveClicks.size * CLICK_NODES;

    /**
     * Hard panic, graph part: master, limiter, analyser, metronome bus and every strip get new nodes on the same context
     * with the cached mix state (identical settings, same strip objects). Strips and the soloSet are kept.
     */
    function rebuildGraph() {
      if (!ctx || isClosed || !graph) return;
      dropClicks();
      strips.forEach((strip) => strip.release());
      const old = graph;
      [old.master, old.limiter, old.analyser, old.metronomeBus].forEach((node) => node.disconnect());
      buildGraph();
      strips.forEach((strip) => strip.rebuild());
    }

    /**
     * Soft (hard = false): every voice is released with a 30 ms ramp. Hard: every node stopped and the graph rebuilt.
     * reason: 'user' (default), 'stop', 'seek', 'mode', 'fatal' or 'rebuild'. Never throws: a failure is reported E-AUD-004.
     * @returns {number} voices released or stopped
     */
    function panic(hard, reason) {
      const why = PANIC_REASONS.includes(reason) ? reason : 'user';
      try {
        return hard === true ? scheduler.hardPanic(why) : scheduler.softPanic(why);
      } catch (error) {
        Core.ErrorReporter.report('E-AUD-004', error, { module: 'Audio', origin: 'panic', hard: hard === true });
        return 0;
      }
    }

    // ---- faults and recovery (Part 10.7.1, 10.9.2) ---------------------------------------------
    /** Fault audio.suspend: the live context is suspended as an OS interruption would; resume may be blocked a while. */
    function simulateSuspend(fault) {
      Core.Faults.clear('audio.suspend');
      recovery.blockedUntil = Core.now() + finiteOr(fault.blockResumeMs, 0);
      try {
        Promise.resolve(ctx.suspend()).catch((error) => Log.warn('audio', 'suspend failed: ' + messageOf(error)));
      } catch (error) {
        Log.warn('audio', 'suspend failed: ' + messageOf(error));
      }
    }

    /** Fault audio.fail {phase:'closed'}: the context is closed behind the engine (E-AUD-008 follows from statechange). */
    function closeBehind() {
      Core.Faults.take('audio.fail');
      recovery.expectClosed = true;
      try {
        Promise.resolve(ctx.close()).catch((error) => Log.warn('audio', 'closing behind failed: ' + messageOf(error)));
      } catch (error) {
        Log.warn('audio', 'closing behind failed: ' + messageOf(error));
      }
    }

    /** Polled at every Scheduler tick (the check points of audio.suspend and audio.fail closed). */
    function pollFaults() {
      if (!ctx || isClosed) return;
      const suspend = Core.Faults.active('audio.suspend');
      if (suspend) simulateSuspend(suspend);
      const fail = Core.Faults.active('audio.fail');
      if (fail && fail.phase === 'closed') closeBehind();
    }

    /** E-AUD-004 recovery: a hard panic rebuilds the graph; two recoveries are at least 250 ms apart. */
    function recover() {
      const at = now();
      if (at - recovery.lastAt < RECOVERY_GAP_S) return false;
      recovery.lastAt = at;
      panic(true, 'rebuild');
      return true;
    }

    // ---- close --------------------------------------------------------------------------------
    function close() {
      if (isClosed) return;
      stopPeakFeed();
      scheduler.unbind();
      dropClicks();
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
      hasStrip: (trackId) => strips.has(trackId), createStrip, disposeStrip, click: (at, accent) => click(at, accent, true), cancelClicks, rebuildGraph,
      engine: () => engine, pollFaults, recover,
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
      Metronome: Object.freeze({ click, configure: configureMetronome, cancel: () => cancelClicks(now(), true),
        scheduled: scheduledClicks }), peak, subscribePeak, fadeOut, fadeIn,
      panic, nodeCount, countNodes, transientNodeCount, recover, restart, info, testTone,
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
    restart: () => (appEngine ? appEngine.restart() : Promise.resolve(false)),
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
    fadeIn: forward('fadeIn'), panic: forward('panic', 0), nodeCount: forward('nodeCount', 0),
    countNodes: forward('countNodes', 0), transientNodeCount: forward('transientNodeCount', 0),
    info: forward('info', { state: 'none', unlocked: false, attempts: 0, sampleRate: 0, latency: NO_LATENCY, contexts: 0 }),
    testTone: forward('testTone')
  });
});
})();
