// 04-transport.js - M-04 FLM.Transport: transport state machine, audio-clock anchoring, seek, loop, count-in,
// speed, tempo source, visibility policy and the pullDue cursor the Scheduler consumes.
// Separation rule: this file owns exactly one namespace and registers it once through
// FLM.Core.define. It may use only lower-numbered modules (Part 4.2, R-DEP). It declares no
// module-level global state object (S-07): each transport keeps its state inside create().
// Spec: docs/IMPLEMENTATION-PLAN.md Part 6.4 (API 6.4.2, algorithms 6.4.4), ADR-05 (Part 2.5), Part 4.4 (events).
// Time: every read goes through the injected clock {now() -> seconds}; this file never reads performance.now()
// itself and never sets a timer (Part 6.4.1), so a FakeClock makes it fully deterministic.
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Transport', function (FLM) {
  const Core = FLM.Core;
  const Model = FLM.Model;
  const Log = Core.Log;

  const STATES = Object.freeze(['stopped', 'countin', 'playing', 'paused', 'recording']);
  const RUNNING_STATES = Object.freeze(['countin', 'playing', 'recording']);
  const LEAD_IN_SECONDS = 0.05;            // start, resume and seek anchor this far ahead: no event is ever late
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 2;
  const MIN_BPM = 20;
  const MAX_BPM = 300;
  const DEFAULT_BPM = 120;
  const MIN_LOOP_SECONDS = 0.25;           // Part 6.4.4.5
  const MAX_COUNT_IN_BARS = 2;
  const DRIFT_LIMIT_MS = 5;                // Part 6.4.4.9
  const END_STOP_DELAY_SECONDS = 0.05;     // the end item is sounded before the transport stops (Part 6.4.4.6)
  const MS_PER_SECOND = 1000;
  const TICK_EPSILON = 1e-7;               // float noise below this is not a real tick offset
  const SECONDS_EPSILON = 1e-9;
  const MAX_WRAPS_PER_PULL = 10000;        // a pull window never needs more; guards a runaway window length
  const POLICIES = Object.freeze(['pause', 'continue']);
  const CONTROL_ITEM_KINDS = Object.freeze(['cc', 'program', 'bend']);
  const FALLBACK_CLOCK = Object.freeze({ now: () => Core.now() / MS_PER_SECOND });   // until M-29 binds the audio clock

  // ---------------------------------------------------------------------------------------------
  // Pure helpers
  // ---------------------------------------------------------------------------------------------
  function codedError(code, text) {
    const error = new Error(code + ': ' + text);
    error.code = code;
    return error;
  }

  /** Removes float noise: 1823.9999999999998 becomes 1824 so Math.floor and tick lookups stay exact. */
  function snapTick(value) {
    const rounded = Math.round(value);
    return Math.abs(value - rounded) < TICK_EPSILON ? rounded : value;
  }

  function versionOf(track) {
    return track.version | 0;
  }

  function isCount(value, high) {
    return Number.isInteger(value) && value >= 0 && value <= high;
  }

  // First beat tick at or after `tick` on the meter grid; a meter change cuts the bar, so a beat never crosses it.
  function firstBeatAtOrAfter(meterMap, tick) {
    const start = Math.max(0, snapTick(tick));
    const bar = meterMap.barAt(start);
    const barStart = meterMap.tickOfBar(bar);
    const ticksPerBeat = meterMap.entryForBar(bar).ticksPerBeat;
    const candidate = barStart + Math.ceil((start - barStart) / ticksPerBeat) * ticksPerBeat;
    return Math.min(candidate, barStart + meterMap.barLengthTicks(bar));
  }

  function beatInfoAt(meterMap, tick) {
    const bar = meterMap.barAt(tick);
    const barStart = meterMap.tickOfBar(bar);
    const beat = Math.floor((tick - barStart) / meterMap.entryForBar(bar).ticksPerBeat);
    return { bar, beat };
  }

  function sortedMarkers(markers) {
    return markers.map((marker, index) => ({ marker, index }))
      .sort((a, b) => (a.marker.tick - b.marker.tick) || (a.index - b.index));
  }

  function byAudioTime(a, b) {
    return a.atAudio - b.atAudio;
  }

  // ---------------------------------------------------------------------------------------------
  // One transport instance
  // ---------------------------------------------------------------------------------------------
  /** Tests and the import preview player create their own with a FakeClock; the app uses `main`. */
  function create(options) {
    const settings = options || {};
    const bus = settings.bus || new Core.Emitter();
    let clock = settings.clock || null;
    let song = null;
    let state = 'stopped';
    let runTarget = 'playing';                  // state entered when the count-in ends: 'playing' or 'recording'
    let pausedInCountIn = false;
    let speed = 1;
    let tempoSource = 'song';
    let overrideBpm = DEFAULT_BPM;
    let overrideTempoMap = Model.TempoMap.fromBpm(DEFAULT_BPM);
    let overrideMeterMap = null;
    const fallbackTempoMap = new Model.TempoMap();
    const fallbackMeterMap = new Model.MeterMap();

    // The anchor pair (tick, audioTime): only reanchor() and rebase() write it (Part 6.4.3 invariants).
    const anchor = { audioTime: 0, songSeconds: 0, tick: 0 };
    let frozenTick = 0;                         // position while stopped or paused
    let stopTick = 0;                           // where stop() returns to
    let runStartTick = 0;                       // tick at which the run proper begins (after any count-in)
    let startEmitted = true;
    let lastPulledAudio = 0;                    // upper bound of the last pullDue window
    let pulledInclusive = true;                 // true right after a reanchor: an event exactly at the anchor is due
    let pendingEndAudio = null;                 // audio time of an emitted 'end' item awaiting its stop
    const countIn = { bars: 0, ticks: 0, runBars: 0 };
    const loop = { region: null, enabled: false, passIndex: 0 };
    const metronome = { enabled: false, countInOnly: true };
    const visibility = { policy: 'pause', hiddenAt: null };
    const cursor = { tracks: [], versions: [], events: [], markers: [], markerNext: 0, markerCount: 0, clickTick: 0 };

    // -------------------------------------------------------------------------------------------
    // Small accessors
    // -------------------------------------------------------------------------------------------
    function now() {
      return (clock || FALLBACK_CLOCK).now();
    }

    function isRunning() {
      return RUNNING_STATES.includes(state);
    }

    function countInActive() {
      return countIn.ticks > 0 && (state === 'countin' || pausedInCountIn);
    }

    function isCountInTick(tick) {
      return countInActive() && tick < runStartTick;
    }

    function loopActive() {
      return loop.region !== null && loop.enabled;
    }

    function durationTicks() {
      return song ? song.durationTicks : 0;
    }

    function tempoMap() {
      if (tempoSource === 'override') return overrideTempoMap;
      return song ? song.tempoMap : fallbackTempoMap;
    }

    function meterMap() {
      if (overrideMeterMap) return overrideMeterMap;
      return song ? song.meterMap : fallbackMeterMap;
    }

    function emit(topic, payload) {
      bus.emit(topic, payload);
    }

    // -------------------------------------------------------------------------------------------
    // Anchoring math (Part 6.4.4.1, ADR-05 decision 4)
    // -------------------------------------------------------------------------------------------
    function computePosition(audioTime) {
      const songSeconds = anchor.songSeconds + (audioTime - anchor.audioTime) * speed;
      return snapTick(tempoMap().secondsToTicks(songSeconds));
    }

    /** Musical position (float ticks, negative inside a count-in that starts at tick 0) at an audio time. */
    function positionAt(audioTime) {
      return isRunning() ? computePosition(audioTime) : frozenTick;
    }

    /** Audio time at which a tick sounds under the current anchor (future or past). */
    function audioTimeAt(tick) {
      return anchor.audioTime + (tempoMap().ticksToSeconds(tick) - anchor.songSeconds) / speed;
    }

    function position() {
      return positionAt(now());
    }

    // Position to report in events: never earlier than the anchor (the 50 ms lead-in has no earlier tick).
    function reportedTick() {
      const tick = isRunning() ? Math.max(anchor.tick, computePosition(now())) : frozenTick;
      return Math.round(tick);
    }

    /** The one place a new anchor is set with fresh cursors: tick `tick` sounds at `audioTime`. */
    function reanchor(tick, audioTime) {
      anchor.tick = tick;
      anchor.audioTime = audioTime;
      anchor.songSeconds = tempoMap().ticksToSeconds(tick);
      lastPulledAudio = audioTime;
      pulledInclusive = true;
      pendingEndAudio = null;
      rebuildCursors(tick, false);
    }

    // Speed and tempo-source changes keep the cursors: events already handed to the Scheduler stay handed over
    // (no replay), and only the events after them are timed by the new anchor (Part 6.4.4.7).
    function captureRunPoint() {
      const at = now();
      return { at, tick: computePosition(at), pulledTick: computePosition(lastPulledAudio) };
    }

    function rebase(point) {
      anchor.tick = point.tick;
      anchor.audioTime = point.at;
      anchor.songSeconds = tempoMap().ticksToSeconds(point.tick);
      lastPulledAudio = audioTimeAt(point.pulledTick);
    }

    // -------------------------------------------------------------------------------------------
    // Cursors: per-track event index, marker index and the next metronome click
    // -------------------------------------------------------------------------------------------
    function countInStartTick() {
      return runStartTick - countIn.ticks;
    }

    function countInTicksPerBeat() {
      return meterMap().meterAt(runStartTick).ticksPerBeat;
    }

    function firstClickAtOrAfter(tick) {
      if (isCountInTick(tick)) {
        const step = countInTicksPerBeat();
        const first = countInStartTick();
        const candidate = first + Math.ceil(snapTick((Math.max(tick, first) - first) / step)) * step;
        if (candidate < runStartTick) return candidate;
        return firstBeatAtOrAfter(meterMap(), runStartTick);
      }
      return firstBeatAtOrAfter(meterMap(), tick);
    }

    function nextClickTick(tick) {
      if (isCountInTick(tick)) {
        const next = tick + countInTicksPerBeat();
        return next < runStartTick ? next : firstBeatAtOrAfter(meterMap(), runStartTick);
      }
      return firstBeatAtOrAfter(meterMap(), tick + 1);
    }

    // True when an earlier pull already handed over the item at this tick (its audio time is not after the pull bound).
    function isPulled(tick) {
      return audioTimeAt(tick) <= lastPulledAudio;
    }

    function firstEventAtOrAfter(track, tick, skipPulled) {
      const events = track.events;
      let next = Model.indexFor(track).eventsAtOrAfter(tick);
      while (skipPulled && next < events.length && isPulled(events[next].tick)) next += 1;
      return next;
    }

    function firstMarkerAtOrAfter(tick, skipPulled) {
      let next = cursor.markers.findIndex((entry) => entry.marker.tick >= tick);
      if (next < 0) next = cursor.markers.length;
      while (skipPulled && next < cursor.markers.length && isPulled(cursor.markers[next].marker.tick)) next += 1;
      return next;
    }

    /**
     * Points every cursor at the first thing at or after `tick`. A count-in plays no song events, so track and
     * marker cursors start at the run start tick while it lasts. `skipPulled` drops what an earlier pull
     * already handed over (used when a track was edited mid-run).
     */
    function rebuildCursors(tick, skipPulled) {
      const tracks = song ? song.tracks : [];
      const eventTick = snapTick(isCountInTick(tick) ? runStartTick : tick);
      cursor.tracks = tracks.slice();
      cursor.versions = tracks.map(versionOf);
      cursor.events = tracks.map((track) => firstEventAtOrAfter(track, eventTick, skipPulled));
      cursor.markerCount = song ? song.markers.length : 0;
      cursor.markers = sortedMarkers(song ? song.markers : []);
      cursor.markerNext = firstMarkerAtOrAfter(eventTick, skipPulled);
      cursor.clickTick = firstClickAtOrAfter(snapTick(tick));
      while (skipPulled && isPulled(cursor.clickTick)) {
        cursor.clickTick = nextClickTick(cursor.clickTick);
      }
    }

    function cursorsAreStale() {
      if (!song) return false;
      if (cursor.tracks.length !== song.tracks.length || cursor.markerCount !== song.markers.length) return true;
      return song.tracks.some((track, index) => {
        return track !== cursor.tracks[index] || versionOf(track) !== cursor.versions[index];
      });
    }

    // A track or marker list changed under the cursors (Part 6.4.5, UT-04-24): rebuild after the last pull.
    function syncCursors() {
      if (!cursorsAreStale()) return;
      rebuildCursors(computePosition(lastPulledAudio), !pulledInclusive);
    }

    // -------------------------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------------------------
    function emitState(prev, reason) {
      const at = now();
      emit('transport.state', {
        prev, state, from: prev, to: state, tick: reportedTick(), audioTime: at, speed, reason
      });
    }

    function emitLoopSet() {
      const region = loop.region;
      emit('transport.loopSet', {
        a: region ? region.a : null, b: region ? region.b : null, enabled: loopActive()
      });
    }

    function emitLoaded() {
      emit('transport.loaded', {
        songId: song ? song.id : null,
        name: song ? song.title : '',
        durationTicks: durationTicks(),
        tempoOverride: tempoSource === 'override' ? overrideBpm : null,
        ppq: Model.PPQ
      });
    }

    // -------------------------------------------------------------------------------------------
    // Binding
    // -------------------------------------------------------------------------------------------
    function resetLoop() {
      loop.region = null;
      loop.enabled = false;
      loop.passIndex = 0;
    }

    /** Binds a song (or null): position 0, stopped, loop cleared (a running transport is stopped first). */
    function load(newSong, loadOptions) {
      Core.assert(newSong === null || (newSong !== undefined && Array.isArray(newSong.tracks)),
        'Transport.load needs a song or null');
      if (state !== 'stopped') stopRun('mode');
      const hadLoop = loop.region !== null;
      const given = loadOptions || {};
      song = newSong;
      tempoSource = given.tempoSource === 'override' ? 'override' : 'song';
      if (tempoSource === 'override') setOverrideBpm(given.overrideBpm === undefined ? overrideBpm : given.overrideBpm);
      overrideMeterMap = null;
      frozenTick = 0;
      stopTick = 0;
      runStartTick = 0;
      countIn.ticks = 0;
      pausedInCountIn = false;
      startEmitted = true;
      pendingEndAudio = null;
      resetLoop();
      rebuildCursors(0, false);
      emitLoaded();
      if (hadLoop) emitLoopSet();
    }

    function unload() {
      load(null);
    }

    /** Binds the audio clock {now()}; a running transport keeps its position across the swap. */
    function setClock(newClock) {
      Core.assert(newClock && typeof newClock.now === 'function', 'Transport.setClock needs a clock with now()');
      if (!isRunning()) {
        clock = newClock;
        return;
      }
      const tick = computePosition(now());
      clock = newClock;
      reanchor(tick, now() + LEAD_IN_SECONDS);
    }

    function setOverrideBpm(bpm) {
      if (!Number.isFinite(bpm)) return;
      overrideBpm = Core.clamp(bpm, MIN_BPM, MAX_BPM);
      overrideTempoMap = Model.TempoMap.fromBpm(overrideBpm);
    }

    function currentBpm() {
      return tempoMap().tempoAt(position()).bpm;
    }

    /**
     * 'song' uses the song's TempoMap; 'override' replaces it with one constant tempo (20 to 300 BPM).
     * Tempo-change rules (Part 6.4.4.8), by what is sounding when the tempo changes:
     *   sounding notes  : keep sounding; their release times already handed over keep their audio time
     *   future events   : timed by the new map from the next pull on (cursors are kept, nothing is replayed)
     *   position        : continuous - the current tick is re-anchored at the current audio time
     *   paused, stopped : only the map changes; ticks are unaffected and the next resume anchors with it
     */
    function setTempoSource(source, bpm) {
      if (source !== 'song' && source !== 'override') {
        Log.warn('transport', 'unknown tempo source ignored', { source });
        return;
      }
      const point = isRunning() ? captureRunPoint() : null;
      if (source === 'override') setOverrideBpm(bpm);
      tempoSource = source;
      if (point) rebase(point);
      emit('transport.tempoSource', { source, bpm: source === 'override' ? overrideBpm : currentBpm() });
    }

    /** Free Play and Studio without a song meter; null returns to the song's meter. */
    function setOverrideMeter(numerator, denominator) {
      overrideMeterMap = numerator === null || numerator === undefined
        ? null
        : new Model.MeterMap([{ tick: 0, numerator, denominator }]);
    }

    // -------------------------------------------------------------------------------------------
    // State machine (Part 6.4.4.2)
    // -------------------------------------------------------------------------------------------
    function clampTick(value) {
      if (!Number.isFinite(value)) return null;
      const rounded = Math.round(value);
      const clamped = Core.clamp(rounded, 0, durationTicks());
      if (clamped !== rounded) Log.info('transport', 'tick clamped to the song', { tick: value, clamped });
      return clamped;
    }

    function countInBarsFor(playOptions) {
      return isCount(playOptions.countInBars, MAX_COUNT_IN_BARS) ? playOptions.countInBars : countIn.bars;
    }

    function countInAudioSeconds() {
      const map = tempoMap();
      return (map.ticksToSeconds(runStartTick) - map.ticksToSeconds(runStartTick - countIn.ticks)) / speed;
    }

    // Audio time of the first anchored position: now plus the lead-in, or the scheduled start of a multiplayer
    // round (the first position after the count-in sounds at atAudio, never earlier than now).
    function startAudioFor(playOptions, leadSeconds) {
      const at = now();
      if (!Number.isFinite(playOptions.atAudio)) return at + LEAD_IN_SECONDS;
      return Math.max(playOptions.atAudio - leadSeconds, at);
    }

    // startRun: from stopped, `target` is 'playing' or 'recording'; a count-in comes first when bars > 0.
    function startRun(target, playOptions) {
      const prev = state;
      const startTick = clampTick(playOptions.fromTick === undefined ? frozenTick : playOptions.fromTick);
      runTarget = target;
      runStartTick = startTick === null ? frozenTick : startTick;
      stopTick = runStartTick;
      countIn.runBars = countInBarsFor(playOptions);
      countIn.ticks = countIn.runBars * meterMap().meterAt(runStartTick).ticksPerBar;
      pausedInCountIn = false;
      loop.passIndex = 0;
      if (countIn.runBars > 0) {
        state = 'countin';
        startEmitted = false;
        reanchor(runStartTick - countIn.ticks, startAudioFor(playOptions, countInAudioSeconds()));
      } else {
        state = target;
        startEmitted = true;
        reanchor(runStartTick, startAudioFor(playOptions, 0));
      }
      emitState(prev, 'user');
    }

    /** From stopped or paused. Returns false when no song is bound or the state does not allow it. */
    function play(playOptions) {
      const given = playOptions || {};
      if (state === 'paused') return resume({ atAudio: given.atAudio });
      if (state !== 'stopped' || !song) return false;
      startRun('playing', given);
      return true;
    }

    /** Like play but the final state is 'recording' (state only; the Recorder arrives in Phases 06 and 09). */
    function record(playOptions) {
      const given = playOptions || {};
      if (state === 'paused') return runTarget === 'recording' && resume({ atAudio: given.atAudio });
      if (state !== 'stopped' || !song) return false;
      startRun('recording', given);
      return true;
    }

    /**
     * Active notes on pause (ADR-05 decision 7, Part 6.4.4.2):
     *   notes sounding at the pause : the Scheduler soft-panics them on transport.state; they are not restarted
     *                                 at resume, because the cursor restarts at the first event at or after the
     *                                 frozen tick (a note that began earlier is not retriggered)
     *   notes pulled but not started: dropped by the panic; they start at or after the frozen tick, so the cursor
     *                                 hands them over again after resume
     *   held notes for the HUD      : activeNotesAt(frozen tick)
     * The frozen tick is never earlier than the anchor tick (the lead-in has no earlier position).
     */
    function pauseRun(reason) {
      if (!isRunning()) return false;
      const prev = state;
      frozenTick = Math.max(computePosition(now()), anchor.tick);
      pausedInCountIn = prev === 'countin';
      pendingEndAudio = null;
      state = 'paused';
      emitState(prev, reason);
      return true;
    }

    function pause() {
      return pauseRun('user');
    }

    // Audio time at which a resume or seek anchors: the given atAudio (never in the past) or now plus the lead-in.
    function resumeAudioFor(resumeOptions) {
      const at = now();
      return Number.isFinite(resumeOptions.atAudio) ? Math.max(resumeOptions.atAudio, at) : at + LEAD_IN_SECONDS;
    }

    /** From paused only; re-anchors the frozen tick at atAudio, or at audio now + 0.05. */
    function resume(resumeOptions) {
      if (state !== 'paused') return false;
      const given = resumeOptions || {};
      state = pausedInCountIn ? 'countin' : runTarget;
      pausedInCountIn = false;
      reanchor(frozenTick, resumeAudioFor(given));
      emitState('paused', 'user');
      return true;
    }

    function stopRun(reason) {
      const prev = state;
      state = 'stopped';
      frozenTick = stopTick;
      loop.passIndex = 0;
      pausedInCountIn = false;
      pendingEndAudio = null;
      if (prev !== 'stopped') emitState(prev, reason);
    }

    /** Any state -> stopped; the position returns to stopTick (the play start or the last seek made while stopped). */
    function stop() {
      stopRun('user');
    }

    /**
     * Active notes on seek (ADR-05 decision 7, Part 6.4.4.2):
     *   sounding notes : the Scheduler soft-panics on transport.seek (reason 'seek'); none is carried over
     *   spanning notes : a note that began before the target is not retriggered (cursor at the first event with
     *                    tick >= target)
     *   count-in       : a seek during the count-in aborts it and runs from the target
     *   stopped/paused : only the frozen tick moves; stopped also moves stopTick
     */
    function seek(tick, reason) {
      const target = clampTick(tick);
      if (target === null) return;
      const prev = state;
      const fromTick = reportedTick();
      if (isRunning()) {
        state = runTarget;
        startEmitted = true;
        reanchor(target, now() + LEAD_IN_SECONDS);
      } else {
        frozenTick = target;
        if (prev === 'stopped') stopTick = target;
        pausedInCountIn = false;
      }
      const audioTime = isRunning() ? audioTimeAt(target) : now();
      if (prev !== state) emitState(prev, 'seek');
      emit('transport.seek', { fromTick, toTick: target, state, audioTime, reason: reason || 'user' });
    }

    /** Speed multiplies elapsed audio seconds into song seconds; the TempoMap never changes (ADR-05 decision 6). */
    function setSpeed(value) {
      if (!Number.isFinite(value)) return;
      const next = Core.clamp(value, MIN_SPEED, MAX_SPEED);
      if (next === speed) return;
      const point = isRunning() ? captureRunPoint() : null;
      speed = next;
      if (point) rebase(point);
      emit('transport.speed', { speed, tick: reportedTick(), audioTime: now() });
    }

    // -------------------------------------------------------------------------------------------
    // Loop (Part 6.4.4.5)
    // -------------------------------------------------------------------------------------------
    function validateLoopRegion(region) {
      const valid = region && Number.isInteger(region.a) && Number.isInteger(region.b);
      if (!valid || region.a < 0 || region.a >= region.b) throw codedError('E-TRN-001', 'Loop region is too short');
      const map = tempoMap();
      if (map.ticksToSeconds(region.b) - map.ticksToSeconds(region.a) < MIN_LOOP_SECONDS - SECONDS_EPSILON) {
        throw codedError('E-TRN-001', 'Loop region is too short');
      }
    }

    /** Region [a, b) in ticks, at least 0.25 s long; null clears. Setting a region enables the loop. */
    function setLoop(region) {
      if (region === null) {
        clearLoop();
        return;
      }
      validateLoopRegion(region);
      loop.region = { a: region.a, b: region.b };
      loop.enabled = true;
      emitLoopSet();
    }

    function clearLoop() {
      const hadRegion = loop.region !== null;
      resetLoop();
      if (hadRegion) emitLoopSet();
    }

    function setLoopEnabled(flag) {
      const enabled = Boolean(flag);
      if (loop.region === null || loop.enabled === enabled) return;
      loop.enabled = enabled;
      emitLoopSet();
    }

    function setCountIn(bars) {
      if (isCount(bars, MAX_COUNT_IN_BARS)) countIn.bars = bars;
    }

    function setMetronome(metronomeOptions) {
      const given = metronomeOptions || {};
      if (given.enabled !== undefined) metronome.enabled = Boolean(given.enabled);
      if (given.countInOnly !== undefined) metronome.countInOnly = Boolean(given.countInOnly);
    }

    // -------------------------------------------------------------------------------------------
    // pullDue (Part 6.4.4.6)
    // -------------------------------------------------------------------------------------------
    function clickItem(tick) {
      const inCountIn = isCountInTick(tick);
      const info = inCountIn ? countInBeatInfo(tick) : beatInfoAt(meterMap(), tick);
      return {
        kind: 'click',
        atAudio: audioTimeAt(tick),
        accent: info.beat === 0,
        bar: info.bar,
        beat: info.beat,
        countIn: inCountIn,
        audible: metronome.enabled && (inCountIn || !metronome.countInOnly)
      };
    }

    // Count-in bars are negative (-2, -1 before bar 0), beats count from 0 inside each count-in bar.
    function countInBeatInfo(tick) {
      const beatsPerBar = meterMap().meterAt(runStartTick).numerator;
      const index = Math.round((tick - countInStartTick()) / countInTicksPerBeat());
      return { bar: -countIn.runBars + Math.floor(index / beatsPerBar), beat: index % beatsPerBar };
    }

    function collectClicks(items, limitAudio, tickCap) {
      while (cursor.clickTick < tickCap && audioTimeAt(cursor.clickTick) <= limitAudio) {
        items.push(clickItem(cursor.clickTick));
        cursor.clickTick = nextClickTick(cursor.clickTick);
      }
    }

    // The 'start' item marks the end of the count-in; the Recorder takes its atAudio as the take origin.
    function collectStart(items, limitAudio) {
      if (startEmitted) return;
      const startAudio = audioTimeAt(runStartTick);
      if (startAudio > limitAudio) return;
      items.push({ kind: 'start', atAudio: startAudio });
      startEmitted = true;
    }

    // A note spanning the loop end is released at the wrap time, never later (loop rules, Part 6.4.4.5).
    function noteEndAudio(event) {
      const endTick = event.tick + event.durTicks;
      const clampedToLoop = loopActive() && event.tick < loop.region.b && endTick > loop.region.b;
      return audioTimeAt(clampedToLoop ? loop.region.b : endTick);
    }

    function appendEvent(items, track, trackIndex, event) {
      const atAudio = audioTimeAt(event.tick);
      if (event.kind === 'note') {
        items.push({ kind: 'note', track, event, atAudio, endAudio: noteEndAudio(event), trackIndex });
      } else if (CONTROL_ITEM_KINDS.includes(event.kind)) {
        items.push({ kind: event.kind, track, event, atAudio });
      }
    }

    function collectTrackEvents(items, limitAudio, tickCap) {
      cursor.tracks.forEach((track, trackIndex) => {
        const events = track.events;
        let next = cursor.events[trackIndex];
        while (next < events.length && events[next].tick < tickCap && audioTimeAt(events[next].tick) <= limitAudio) {
          appendEvent(items, track, trackIndex, events[next]);
          next += 1;
        }
        cursor.events[trackIndex] = next;
      });
    }

    function collectMarkers(items, limitAudio, tickCap) {
      while (cursor.markerNext < cursor.markers.length) {
        const entry = cursor.markers[cursor.markerNext];
        const atAudio = audioTimeAt(entry.marker.tick);
        if (entry.marker.tick >= tickCap || atAudio > limitAudio) return;
        items.push({ kind: 'marker', atAudio, marker: entry.marker, index: entry.index });
        cursor.markerNext += 1;
      }
    }

    function collectItems(items, limitAudio, tickCap) {
      collectClicks(items, limitAudio, tickCap);
      collectStart(items, limitAudio);
      collectTrackEvents(items, limitAudio, tickCap);
      collectMarkers(items, limitAudio, tickCap);
    }

    // Audio time of the next loop wrap when it falls inside the window; null when the run does not wrap there.
    // A position already beyond b just continues to the song end (Part 6.4.4.5).
    function nextWrapAudio(limitAudio) {
      if (!loopActive() || state === 'countin') return null;
      if (computePosition(lastPulledAudio) >= loop.region.b) return null;
      const wrapAudio = audioTimeAt(loop.region.b);
      return wrapAudio <= limitAudio ? wrapAudio : null;
    }

    /**
     * Active notes at a loop wrap (Part 6.4.4.5, ADR-05 decision 8):
     *   notes starting before b and ending after it : endAudio is clamped to the wrap time (noteEndAudio)
     *   notes starting before a                     : not retriggered; the cursors restart at the first event
     *                                                 with tick >= a
     *   an event exactly at b                       : outside [a, b), never emitted while looping
     *   an event exactly at a                       : emitted at the wrap time on every pass
     * The wrap re-anchors from the previous anchor, never from the clock, so no error accumulates.
     */
    function applyWrap(items, wrapAudio) {
      const region = loop.region;
      items.push({ kind: 'loopWrap', atAudio: wrapAudio, fromTick: region.b, toTick: region.a });
      loop.passIndex += 1;
      reanchor(region.a, wrapAudio);
      emit('transport.loop', { a: region.a, b: region.b, pass: loop.passIndex, atAudioTime: wrapAudio });
      emit('transport.seek', { fromTick: region.b, toTick: region.a, state, audioTime: wrapAudio, reason: 'loop' });
    }

    // The song ends once; the stop itself happens in update() after the end item has sounded.
    function collectEnd(items, limitAudio) {
      const total = durationTicks();
      if (state !== 'playing' || loopActive() || total <= 0 || pendingEndAudio !== null) return;
      const endAudio = audioTimeAt(total);
      if (endAudio > limitAudio) return;
      items.push({ kind: 'end', atAudio: endAudio });
      pendingEndAudio = endAudio;
    }

    /**
     * Every due item with an audio time in (lastPulled, untilAudioTime] (the first window after a reanchor also
     * takes an event exactly at the anchor), advancing the cursors. Nothing beyond `until` and nothing already
     * handed over is returned.
     */
    function pullDue(untilAudioTime) {
      const items = [];
      if (!isRunning() || !(untilAudioTime > lastPulledAudio)) return items;
      syncCursors();
      let limitAudio = untilAudioTime;
      let wrapAudio = nextWrapAudio(limitAudio);
      let wraps = 0;
      while (wrapAudio !== null) {
        if (wraps >= MAX_WRAPS_PER_PULL) {
          Log.warn('transport', 'pull window too long; the rest is pulled next time', { wraps });
          limitAudio = lastPulledAudio;
          break;
        }
        collectItems(items, wrapAudio, loop.region.b);
        applyWrap(items, wrapAudio);
        wraps += 1;
        wrapAudio = nextWrapAudio(limitAudio);
      }
      collectItems(items, limitAudio, Infinity);
      collectEnd(items, limitAudio);
      lastPulledAudio = limitAudio;
      pulledInclusive = false;
      return items.sort(byAudioTime);
    }

    // -------------------------------------------------------------------------------------------
    // update (auto-transitions)
    // -------------------------------------------------------------------------------------------
    function finishSong() {
      const atAudioTime = pendingEndAudio;
      const tick = durationTicks();
      stopRun('end');
      emit('transport.end', { tick, atAudioTime });
    }

    /** Called by the Scheduler before each pullDue: count-in -> run, end-of-song stop, track edit resync. */
    function update(audioNow) {
      if (!isRunning()) return;
      syncCursors();
      if (state === 'countin' && computePosition(audioNow) >= runStartTick) {
        state = runTarget;
        emitState('countin', 'user');
      }
      if (pendingEndAudio !== null && audioNow >= pendingEndAudio + END_STOP_DELAY_SECONDS) finishSong();
    }

    // -------------------------------------------------------------------------------------------
    // Held notes, count-in position and cursor reset
    // -------------------------------------------------------------------------------------------
    /** Source notes sounding at `tick` (default: the current position) on visible tracks, for the HUD. */
    function activeNotesAt(tick) {
      const at = tick === undefined ? position() : tick;
      const held = [];
      (song ? song.tracks : []).filter((track) => track.visible !== false).forEach((track) => {
        Model.indexFor(track).activeAt(at).forEach((event) => held.push({ track, event }));
      });
      return held;
    }

    /** Negative ticks before the run start while a count-in lasts, else 0 (Part 4.5.1 name). */
    function countinTick(audioTime) {
      return countInActive() ? Math.min(0, computePosition(audioTime) - runStartTick) : 0;
    }

    /** Re-points the scheduler cursors at the position after the last pull (Part 4.4 name resetCursor). */
    function resetCursor() {
      if (isRunning()) rebuildCursors(computePosition(lastPulledAudio), !pulledInclusive);
    }

    // -------------------------------------------------------------------------------------------
    // Visibility (Part 6.4.4.9)
    // -------------------------------------------------------------------------------------------
    function setVisibilityPolicy(policy) {
      Core.assert(POLICIES.includes(policy), 'Transport visibility policy must be pause or continue');
      visibility.policy = policy;
    }

    /** M-28 calls this on visibilitychange or pagehide. Gameplay modes pause; Studio and Free Play continue. */
    function onHidden(audioNow, perfNow) {
      visibility.hiddenAt = { audio: audioNow, perf: perfNow, tick: positionAt(audioNow) };
      if (visibility.policy === 'pause') pauseRun('interrupt');
    }

    /**
     * Compares how long the page was hidden on the audio clock and on the performance clock. Under 'continue' a
     * difference over 5 ms re-anchors at the audio clock's position and moves the pull boundary forward, so events
     * that fell due while hidden are skipped instead of fired in a burst. Under 'pause' nothing moves.
     */
    function onVisible(audioNow, perfNow) {
      const hidden = visibility.hiddenAt;
      if (!hidden) return { drifted: false, driftMs: 0 };
      visibility.hiddenAt = null;
      const audioSeconds = audioNow - hidden.audio;
      const perfSeconds = (perfNow - hidden.perf) / MS_PER_SECOND;
      const driftMs = (perfSeconds - audioSeconds) * MS_PER_SECOND;
      const mustResync = visibility.policy === 'continue' && isRunning() && Math.abs(driftMs) > DRIFT_LIMIT_MS;
      if (!mustResync) return { drifted: false, driftMs };
      Log.warn('transport', 'W-TRANSPORT-DRIFT', { driftMs, dAudio: audioSeconds, dPerf: perfSeconds });
      reanchor(computePosition(audioNow), audioNow + LEAD_IN_SECONDS);
      return { drifted: true, driftMs };
    }

    function dispose() {
      if (state !== 'stopped') stopRun('mode');
      song = null;
      clock = null;
      visibility.hiddenAt = null;
      rebuildCursors(0, false);
    }

    return Object.freeze({
      load, unload, setClock, song: () => song, setTempoSource, tempoMap, meterMap, setOverrideMeter,
      state: () => state, play, record, pause, resume, stop, seek,
      setSpeed, speed: () => speed,
      setLoop, clearLoop, loop: () => (loop.region ? { a: loop.region.a, b: loop.region.b } : null),
      setLoopEnabled, loopEnabled: () => loopActive(),
      setCountIn, countInBars: () => countIn.bars,
      positionAt, tickAt: positionAt, audioTimeAt, position,
      positionSeconds: () => tempoMap().ticksToSeconds(position()),
      anchor: () => ({ audioTime: anchor.audioTime, songSeconds: anchor.songSeconds, speed, tick: anchor.tick }),
      pullDue, setMetronome, update, activeNotesAt, heldNotes: activeNotesAt, countinTick, resetCursor,
      setVisibilityPolicy, onHidden, onVisible, dispose
    });
  }

  return Object.freeze({
    STATES,
    create,
    main: create({ clock: null, bus: Core.bus })
  });
});
})();
