// 03-model.js - M-03 FLM.Model: Song, Track, events, TempoMap, MeterMap, KeyMap, pairing, validation.
// Separation rule: this file owns exactly one namespace and registers it once through
// FLM.Core.define. It may use only lower-numbered modules (Part 4.2, R-DEP). It declares no
// module-level global state object (S-07): state lives inside the factory closure.
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Model', function (FLM) {
  const PPQ = 960;                           // the one internal resolution (Part 5.1.1)
  const MAX_TRACKS = 32;
  const MAX_EVENTS_TOTAL = 1000000;
  const MAX_MAP_ENTRIES = 10000;
  const MAX_MARKERS = 1000;
  const MAX_REPORTED_ERRORS = 200;           // keeps a badly broken import from building a huge error list
  const MIN_US_PER_QUARTER = 1;
  const MAX_US_PER_QUARTER = 16777215;       // 3-byte MIDI range
  const DEFAULT_US_PER_QUARTER = 500000;     // 120 BPM
  const MICROSECONDS_PER_MINUTE = 60e6;
  const TEMPO_DIVISOR = PPQ * 1e6;           // ticks x us per quarter / this = seconds
  const MAX_METER_NUMERATOR = 64;            // Part 6.3.4.5 (Part 5.1.4 says 32; the wider range is accepted)
  const MAX_METER_DENOMINATOR = 64;
  const DEFAULT_TITLE = 'Untitled';
  const MAX_TITLE_LENGTH = 120;
  const MAX_MARKER_LABEL = 80;
  const MAX_MESSAGE_LENGTH = 200;
  const PEDAL_CONTROLLER = 64;
  const PEDAL_DOWN_VALUE = 64;               // CC 64 values at or above this mean pedal down
  const BULK_INSERT_DIVISOR = 8;             // Part 6.3.4.2: sort path when m > n / 8
  const DEFAULT_VELOCITY = 100;
  const DEFAULT_OFF_VELOCITY = 64;
  const BEND_MIN = -8192;
  const BEND_MAX = 8191;
  const TICK_PAD_WIDTH = 3;

  const KIND_PRIORITY = Object.freeze({ program: 0, cc: 1, bend: 2, note: 3, text: 4 });
  // The first eight are the Part 7.1.2 palette; the second eight are darker companions (ledger decision).
  const TRACK_COLORS = Object.freeze(['#7aa2f7', '#9ece6a', '#e0af68', '#f7768e', '#bb9af7', '#2ac3de', '#ff9e64',
    '#c0caf5', '#3d59a1', '#5a7d2c', '#a07a2e', '#b04a5f', '#7b5fbf', '#1c7f94', '#c46a2a', '#7f89b8']);

  const Core = FLM.Core;

  // ---------------------------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------------------------
  function codedError(code, text) {
    const error = new Error(code + ': ' + text);
    error.code = code;
    return error;
  }

  function isIntegerIn(value, low, high) {
    return Number.isInteger(value) && value >= low && value <= high;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isPowerOfTwo(value) {
    return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function cleanText(value, fallback, maxLength) {
    const text = typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
    return text === '' ? fallback : text;
  }

  // Index of the last element with getValue(element) <= value, or -1 (binary search).
  function lastIndexAtOrBefore(list, value, getValue) {
    let low = 0;
    let high = list.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (getValue(list[middle]) <= value) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return found;
  }

  // Sorted copy by tick where a later entry at the same tick replaces the earlier one (last wins).
  function sortedLastWins(entries) {
    const sorted = entries.slice().sort((a, b) => a.tick - b.tick);
    const result = [];
    sorted.forEach((entry) => {
      const last = result.length - 1;
      if (last >= 0 && result[last].tick === entry.tick) result[last] = entry;
      else result.push(entry);
    });
    return result;
  }

  function entriesFromSource(source, errorCode) {
    if (Array.isArray(source)) return source;
    if (isPlainObject(source) && Array.isArray(source.entries)) return source.entries;
    throw codedError(errorCode, 'map entries must be an array');
  }

  function requireTick(tick, errorCode) {
    if (!Number.isInteger(tick) || tick < 0) throw codedError(errorCode, 'tick must be an integer >= 0');
    return tick;
  }

  // ---------------------------------------------------------------------------------------------
  // ImportWarning and Marker
  // ---------------------------------------------------------------------------------------------
  const ImportWarning = Object.freeze({
    /** Warning record of Part 5.1.4; message is cut to 200 characters. */
    create(code, message, severity, location) {
      return {
        code,
        message: String(message).slice(0, MAX_MESSAGE_LENGTH),
        severity: severity || 'warn',
        location: Object.assign({ track: null, tick: null }, location),
        count: 1
      };
    }
  });

  const Marker = Object.freeze({
    /** kind is 'section' or 'cue'. */
    create(tick, label, kind) {
      return {
        tick: requireTick(tick, 'E-MDL-005'),
        label: cleanText(label, 'Marker', MAX_MARKER_LABEL),
        kind: kind === 'cue' ? 'cue' : 'section'
      };
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Events and ordering (Part 5.2)
  // ---------------------------------------------------------------------------------------------
  function compareEvents(a, b) {
    if (a.tick !== b.tick) return a.tick - b.tick;
    const priorityA = KIND_PRIORITY[a.kind];
    const priorityB = KIND_PRIORITY[b.kind];
    if (priorityA !== priorityB) return priorityA - priorityB;
    const channelA = a.channel === undefined ? -1 : a.channel;
    const channelB = b.channel === undefined ? -1 : b.channel;
    if (channelA !== channelB) return channelA - channelB;
    if (a.kind === 'note' && a.pitch !== b.pitch) return a.pitch - b.pitch;
    if (a.kind === 'cc' && a.controller !== b.controller) return a.controller - b.controller;
    const idA = a.id === undefined ? '' : a.id;
    const idB = b.id === undefined ? '' : b.id;
    if (idA < idB) return -1;
    return idA > idB ? 1 : 0;
  }

  function endTick(event) {
    return event.kind === 'note' ? event.tick + event.durTicks : event.tick;
  }

  const Events = Object.freeze({
    note(tick, durTicks, pitch, velocity, channel, extra) {
      const options = extra || {};
      const event = {
        kind: 'note',
        tick,
        durTicks: durTicks === undefined ? 1 : durTicks,
        pitch,
        velocity: velocity === undefined ? DEFAULT_VELOCITY : velocity,
        offVelocity: options.offVelocity === undefined ? DEFAULT_OFF_VELOCITY : options.offVelocity,
        channel: channel === undefined ? 0 : channel
      };
      if (options.id !== undefined) event.id = options.id;
      return event;
    },
    cc(tick, controller, value, channel) {
      return { kind: 'cc', tick, controller, value, channel: channel === undefined ? 0 : channel };
    },
    program(tick, program, bankMsb, bankLsb, channel) {
      return {
        kind: 'program',
        tick,
        program,
        bankMsb: bankMsb === undefined ? 0 : bankMsb,
        bankLsb: bankLsb === undefined ? 0 : bankLsb,
        channel: channel === undefined ? 0 : channel
      };
    },
    bend(tick, value, channel) {
      return { kind: 'bend', tick, value, channel: channel === undefined ? 0 : channel };
    },
    text(tick, type, text) {
      return { kind: 'text', tick, type, text };
    },
    compare: compareEvents,
    endTick
  });

  // ---------------------------------------------------------------------------------------------
  // Track version, ordered insertion and removal
  // ---------------------------------------------------------------------------------------------
  // The version counter is not enumerable so JSON.stringify and spreads skip it (Part 6.3.9).
  function ensureVersion(track) {
    if (!Object.prototype.hasOwnProperty.call(track, 'version')) {
      Object.defineProperty(track, 'version', { value: 0, enumerable: false, writable: true, configurable: true });
    }
  }

  /** Bumps the track version so cached indexes are rebuilt. */
  function touch(track) {
    ensureVersion(track);
    track.version += 1;
  }

  function assignNoteId(track, event) {
    if (event.kind !== 'note' || event.id !== undefined) return;
    const sequence = Number.isInteger(track.idSeq) && track.idSeq >= 1 ? track.idSeq : 1;
    event.id = track.id + '.' + sequence.toString(36);
    track.idSeq = sequence + 1;
  }

  function isSorted(events) {
    for (let index = 1; index < events.length; index += 1) {
      if (compareEvents(events[index - 1], events[index]) > 0) return false;
    }
    return true;
  }

  function sortEvents(events) {
    return events.sort(compareEvents);
  }

  // First index whose event sorts after `event` (upper bound).
  function insertionIndex(events, event) {
    let low = 0;
    let high = events.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (compareEvents(events[middle], event) > 0) high = middle;
      else low = middle + 1;
    }
    return low;
  }

  function insertEvent(track, event) {
    assignNoteId(track, event);
    const index = insertionIndex(track.events, event);
    track.events.splice(index, 0, event);
    touch(track);
    return index;
  }

  function insertEvents(track, events) {
    events.forEach((event) => assignNoteId(track, event));
    if (events.length > track.events.length / BULK_INSERT_DIVISOR) {
      track.events = sortEvents(track.events.concat(events));
      touch(track);
      return;
    }
    events.forEach((event) => {
      track.events.splice(insertionIndex(track.events, event), 0, event);
      touch(track);
    });
  }

  /** Replaces all events with a sorted copy of `events` (Part 5.2 rule 3). */
  function replaceEvents(track, events) {
    const copy = events.slice();
    copy.forEach((event) => assignNoteId(track, event));
    track.events = sortEvents(copy);
    touch(track);
  }

  function removeEvent(track, eventOrId) {
    const index = typeof eventOrId === 'string'
      ? track.events.findIndex((event) => event.id === eventOrId)
      : track.events.indexOf(eventOrId);
    if (index < 0) return false;
    track.events.splice(index, 1);
    touch(track);
    return true;
  }

  function removeEvents(track, predicate) {
    const kept = track.events.filter((event) => !predicate(event));
    const removed = track.events.length - kept.length;
    if (removed > 0) {
      track.events = kept;
      touch(track);
    }
    return removed;
  }

  // ---------------------------------------------------------------------------------------------
  // TempoMap (Part 5.3, 6.3.4.7)
  // ---------------------------------------------------------------------------------------------
  function checkTempoEntry(entry) {
    if (!isPlainObject(entry)) throw codedError('E-MDL-007', 'tempo entry must be an object');
    requireTick(entry.tick, 'E-MDL-007');
    if (!isIntegerIn(entry.usPerQuarter, MIN_US_PER_QUARTER, MAX_US_PER_QUARTER)) {
      throw codedError('E-MDL-007', 'usPerQuarter must be an integer from 1 to 16777215');
    }
  }

  class TempoMap {
    /** entries: [{tick, usPerQuarter}]; unsorted input is sorted, same-tick duplicates keep the last. */
    constructor(entries) {
      Object.defineProperty(this, 'warnings', { value: [], enumerable: false, writable: true });
      const source = entries === undefined ? [{ tick: 0, usPerQuarter: DEFAULT_US_PER_QUARTER }] : entries;
      if (!Array.isArray(source)) throw codedError('E-MDL-007', 'tempo entries must be an array');
      source.forEach(checkTempoEntry);
      this.entries = source.map((entry) => ({ tick: entry.tick, usPerQuarter: entry.usPerQuarter, secondsAt: 0 }));
      this.rebuild();
    }

    static fromBpm(bpm) {
      const microseconds = Math.round(MICROSECONDS_PER_MINUTE / bpm);
      return new TempoMap([{ tick: 0, usPerQuarter: microseconds }]);
    }

    static fromJSON(source) {
      return new TempoMap(entriesFromSource(source, 'E-MDL-007'));
    }

    /** Sort, last-wins, implicit start entry and cumulative seconds. */
    rebuild() {
      this.entries = sortedLastWins(this.entries);
      if (this.entries.length === 0 || this.entries[0].tick !== 0) {
        this.entries.unshift({ tick: 0, usPerQuarter: DEFAULT_US_PER_QUARTER, secondsAt: 0 });
        this.warnings.push(ImportWarning.create('W-TEMPO-IMPLICIT-START',
          'The tempo map had no entry at tick 0; 120 BPM was assumed at the start.', 'info', { tick: 0 }));
      }
      let seconds = 0;
      this.entries.forEach((entry, index) => {
        if (index > 0) {
          const previous = this.entries[index - 1];
          seconds += (entry.tick - previous.tick) * previous.usPerQuarter / TEMPO_DIVISOR;
        }
        entry.secondsAt = seconds;
      });
      return this;
    }

    /** Inserts or replaces the entry at `tick`. */
    set(tick, usPerQuarter) {
      checkTempoEntry({ tick, usPerQuarter });
      const existing = this.entries.find((entry) => entry.tick === tick);
      if (existing) existing.usPerQuarter = usPerQuarter;
      else this.entries.push({ tick, usPerQuarter, secondsAt: 0 });
      return this.rebuild();
    }

    /** Removes the entry at `tick`; the entry at tick 0 cannot be removed. */
    remove(tick) {
      const index = this.entries.findIndex((entry) => entry.tick === tick);
      if (index <= 0) return false;
      this.entries.splice(index, 1);
      this.rebuild();
      return true;
    }

    // Negative ticks use the first entry, which gives negative seconds for the count-in.
    ticksToSeconds(tick) {
      const entry = this.entries[Math.max(0, lastIndexAtOrBefore(this.entries, tick, (item) => item.tick))];
      return entry.secondsAt + (tick - entry.tick) * entry.usPerQuarter / TEMPO_DIVISOR;
    }

    /** Returns float ticks; callers that need an integer round. */
    secondsToTicks(seconds) {
      const entry = this.entries[Math.max(0, lastIndexAtOrBefore(this.entries, seconds, (item) => item.secondsAt))];
      return entry.tick + (seconds - entry.secondsAt) * TEMPO_DIVISOR / entry.usPerQuarter;
    }

    tempoAt(tick) {
      const entry = this.entries[Math.max(0, lastIndexAtOrBefore(this.entries, tick, (item) => item.tick))];
      return { usPerQuarter: entry.usPerQuarter, bpm: MICROSECONDS_PER_MINUTE / entry.usPerQuarter };
    }

    /** Serialized form: secondsAt is derived and never written. */
    toJSON() {
      return this.entries.map((entry) => ({ tick: entry.tick, usPerQuarter: entry.usPerQuarter }));
    }
  }

  // ---------------------------------------------------------------------------------------------
  // MeterMap (Part 5.4, 6.3.4.8)
  // ---------------------------------------------------------------------------------------------
  function checkMeterEntry(entry) {
    if (!isPlainObject(entry)) throw codedError('E-MDL-008', 'meter entry must be an object');
    requireTick(entry.tick, 'E-MDL-008');
    if (!isIntegerIn(entry.numerator, 1, MAX_METER_NUMERATOR)) {
      throw codedError('E-MDL-008', 'meter numerator must be an integer from 1 to ' + MAX_METER_NUMERATOR);
    }
    if (!isPowerOfTwo(entry.denominator) || entry.denominator > MAX_METER_DENOMINATOR) {
      throw codedError('E-MDL-008', 'meter denominator must be a power of two up to ' + MAX_METER_DENOMINATOR);
    }
  }

  class MeterMap {
    constructor(entries) {
      const source = entries === undefined ? [{ tick: 0, numerator: 4, denominator: 4 }] : entries;
      if (!Array.isArray(source)) throw codedError('E-MDL-008', 'meter entries must be an array');
      source.forEach(checkMeterEntry);
      this.entries = source.map((entry) => ({
        tick: entry.tick, numerator: entry.numerator, denominator: entry.denominator
      }));
      this.rebuild();
    }

    static fromJSON(source) {
      return new MeterMap(entriesFromSource(source, 'E-MDL-008'));
    }

    /** Sort, last-wins, implicit 4/4 at tick 0, and the cached bar and beat counts per entry. */
    rebuild() {
      this.entries = sortedLastWins(this.entries);
      if (this.entries.length === 0 || this.entries[0].tick !== 0) {
        this.entries.unshift({ tick: 0, numerator: 4, denominator: 4 });
      }
      this.entries.forEach((entry, index) => {
        entry.ticksPerBeat = PPQ * 4 / entry.denominator;
        entry.ticksPerBar = entry.numerator * entry.ticksPerBeat;
        if (index === 0) {
          entry.barAtEntry = 0;
          entry.beatsAtEntry = 0;
          return;
        }
        const previous = this.entries[index - 1];
        const span = entry.tick - previous.tick;
        // A change inside a bar starts a new bar at its own tick; the partial bar counts as one.
        entry.barAtEntry = previous.barAtEntry + Math.ceil(span / previous.ticksPerBar);
        entry.beatsAtEntry = previous.beatsAtEntry + span / previous.ticksPerBeat;
      });
      return this;
    }

    set(tick, numerator, denominator) {
      checkMeterEntry({ tick, numerator, denominator });
      const existing = this.entries.find((entry) => entry.tick === tick);
      if (existing) {
        existing.numerator = numerator;
        existing.denominator = denominator;
      } else {
        this.entries.push({ tick, numerator, denominator });
      }
      return this.rebuild();
    }

    /** Removes the entry at `tick`; the entry at tick 0 cannot be removed. */
    remove(tick) {
      const index = this.entries.findIndex((entry) => entry.tick === tick);
      if (index <= 0) return false;
      this.entries.splice(index, 1);
      this.rebuild();
      return true;
    }

    /** Last entry at or before `tick` (the first entry for negative ticks). */
    entryAt(tick) {
      return this.entries[Math.max(0, lastIndexAtOrBefore(this.entries, tick, (item) => item.tick))];
    }

    meterAt(tick) {
      const entry = this.entryAt(tick);
      return {
        numerator: entry.numerator,
        denominator: entry.denominator,
        tick: entry.tick,
        ticksPerBar: entry.ticksPerBar,
        ticksPerBeat: entry.ticksPerBeat
      };
    }

    /** 0-based bar index; count-in bars before tick 0 are negative. */
    barAt(tick) {
      if (tick < 0) return -Math.ceil(-tick / this.entries[0].ticksPerBar);
      const entry = this.entryAt(tick);
      return entry.barAtEntry + Math.floor((tick - entry.tick) / entry.ticksPerBar);
    }

    /** {bar, beat (0-based), frac 0..1} of the tick inside its bar. */
    beatAt(tick) {
      const bar = this.barAt(tick);
      const entry = this.entryForBar(bar);
      const remainder = tick - this.tickOfBar(bar);
      const beat = Math.floor(remainder / entry.ticksPerBeat);
      return { bar, beat, frac: (remainder - beat * entry.ticksPerBeat) / entry.ticksPerBeat };
    }

    // The entry whose meter governs a bar (negative bars use the first entry).
    entryForBar(bar) {
      return this.entries[Math.max(0, lastIndexAtOrBefore(this.entries, bar, (item) => item.barAtEntry))];
    }

    tickOfBar(bar) {
      const entry = this.entryForBar(bar);
      return entry.tick + (bar - entry.barAtEntry) * entry.ticksPerBar;
    }

    tickOfBeat(bar, beat) {
      return this.tickOfBar(bar) + beat * this.entryForBar(bar).ticksPerBeat;
    }

    /** Length of a bar in ticks; a bar cut short by the next meter change is shorter than its nominal length. */
    barLengthTicks(bar) {
      const entry = this.entryForBar(bar);
      const start = this.tickOfBar(bar);
      const next = this.entries[this.entries.indexOf(entry) + 1];
      const nominalEnd = start + entry.ticksPerBar;
      return (next && next.tick < nominalEnd ? next.tick : nominalEnd) - start;
    }

    /** Part 5.4 position: {bar, beat, tickInBeat, barStartTick, ticksPerBar, ticksPerBeat}. */
    positionAt(tick) {
      const position = this.beatAt(tick);
      const entry = this.entryForBar(position.bar);
      return {
        bar: position.bar,
        beat: position.beat,
        tickInBeat: position.frac * entry.ticksPerBeat,
        barStartTick: this.tickOfBar(position.bar),
        ticksPerBar: entry.ticksPerBar,
        ticksPerBeat: entry.ticksPerBeat
      };
    }

    /** Float beats counted from tick 0, summed per meter segment (for grid snapping). */
    totalBeatsAt(tick) {
      if (tick < 0) return tick / this.entries[0].ticksPerBeat;
      const entry = this.entryAt(tick);
      return entry.beatsAtEntry + (tick - entry.tick) / entry.ticksPerBeat;
    }

    /** Start ticks of every subdivision slot in a bar (`perBeat` slots per beat, cut at the next meter change). */
    subdivisionTicks(bar, perBeat) {
      if (!isIntegerIn(perBeat, 1, PPQ)) throw codedError('E-GEN-005', 'perBeat must be an integer from 1 to 960');
      const entry = this.entryForBar(bar);
      const start = this.tickOfBar(bar);
      const length = this.barLengthTicks(bar);
      const step = entry.ticksPerBeat / perBeat;
      const ticks = [];
      for (let offset = 0; offset < length; offset += step) ticks.push(start + offset);
      return ticks;
    }

    /** Number of bars needed to hold `durationTicks` (at least 1). */
    barCount(durationTicks) {
      return durationTicks <= 0 ? 1 : this.barAt(durationTicks - 1) + 1;
    }

    toJSON() {
      return this.entries.map((entry) => ({
        tick: entry.tick, numerator: entry.numerator, denominator: entry.denominator
      }));
    }
  }

  // ---------------------------------------------------------------------------------------------
  // KeyMap
  // ---------------------------------------------------------------------------------------------
  const DEFAULT_KEY = Object.freeze({ tick: 0, fifths: 0, mode: 'major' });

  function checkKeyEntry(entry) {
    if (!isPlainObject(entry)) throw codedError('E-MDL-009', 'key entry must be an object');
    requireTick(entry.tick, 'E-MDL-009');
    if (!isIntegerIn(entry.fifths, -7, 7)) throw codedError('E-MDL-009', 'fifths must be an integer from -7 to 7');
    if (entry.mode !== 'major' && entry.mode !== 'minor') throw codedError('E-MDL-009', 'mode must be major or minor');
  }

  class KeyMap {
    constructor(entries) {
      const source = entries === undefined ? [DEFAULT_KEY] : entries;
      if (!Array.isArray(source)) throw codedError('E-MDL-009', 'key entries must be an array');
      source.forEach(checkKeyEntry);
      this.entries = sortedLastWins(source.map((entry) => ({
        tick: entry.tick, fifths: entry.fifths, mode: entry.mode
      })));
    }

    static fromJSON(source) {
      return new KeyMap(entriesFromSource(source, 'E-MDL-009'));
    }

    set(tick, fifths, mode) {
      checkKeyEntry({ tick, fifths, mode });
      const existing = this.entries.find((entry) => entry.tick === tick);
      if (existing) {
        existing.fifths = fifths;
        existing.mode = mode;
      } else {
        this.entries = sortedLastWins(this.entries.concat([{ tick, fifths, mode }]));
      }
      return this;
    }

    remove(tick) {
      const index = this.entries.findIndex((entry) => entry.tick === tick);
      if (index < 0) return false;
      this.entries.splice(index, 1);
      return true;
    }

    /** Last entry at or before `tick`; C major when there is none. */
    keyAt(tick) {
      const index = lastIndexAtOrBefore(this.entries, tick, (item) => item.tick);
      const entry = index < 0 ? DEFAULT_KEY : this.entries[index];
      return { fifths: entry.fifths, mode: entry.mode, tick: entry.tick };
    }

    toJSON() {
      return this.entries.map((entry) => ({ tick: entry.tick, fifths: entry.fifths, mode: entry.mode }));
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Source resolution and position formatting
  // ---------------------------------------------------------------------------------------------
  /**
   * Exact rescale of an absolute source tick to PPQ 960, rounding half up (Part 6.10.3 rule),
   * applied once to the absolute tick at import so there is no cumulative rounding.
   */
  function rescaleTicks(tick, sourcePpq) {
    if (!isIntegerIn(sourcePpq, 1, 65535)) {
      throw codedError('E-MDL-001', 'source PPQ must be an integer from 1 to 65535');
    }
    return Math.floor((tick * PPQ * 2 + sourcePpq) / (2 * sourcePpq));
  }

  // Count-in bars are shown as -1, -2 (there is no bar 0); other bars and beats count from 1.
  function displayBar(bar) {
    return bar >= 0 ? bar + 1 : bar;
  }

  /** "<bar>.<beat>" for the TransportBar, both 1-based. */
  function formatBarBeat(meterMap, tick) {
    const position = meterMap.beatAt(tick);
    return displayBar(position.bar) + '.' + (position.beat + 1);
  }

  /** "<bar>.<beat>.<tick>" with the tick inside the beat padded to three digits. */
  function formatBarBeatTick(meterMap, tick) {
    const position = meterMap.positionAt(tick);
    const tickText = String(Math.floor(position.tickInBeat)).padStart(TICK_PAD_WIDTH, '0');
    return displayBar(position.bar) + '.' + (position.beat + 1) + '.' + tickText;
  }

  // ---------------------------------------------------------------------------------------------
  // Pairing note on and off messages (Part 6.3.4.3 as amended by decision D10)
  // ---------------------------------------------------------------------------------------------
  const PAIR_WARNING_TEXT = Object.freeze({
    'W-NOTE-UNMATCHED': ['warn', 'A note was never released; it was ended at the end of the track.'],
    'W-NOTE-OFF-WITHOUT-ON': ['warn', 'A note-off had no matching note-on and was dropped.'],
    'W-NOTE-OVERLAP': ['info', 'The same pitch started again before it ended; the earlier note was cut short.'],
    'W-NOTE-ZERO-DURATION': ['info', 'A note had no length and was given the shortest length.'],
    'W-NOTE-VELOCITY-CLAMP': ['info', 'A velocity above 127 was set to 127.'],
    'W-NOTE-PITCH-RANGE': ['warn', 'A note outside the range 0 to 127 was dropped.']
  });

  function createPairingContext(options) {
    const warnings = new Map();
    return {
      open: new Map(),
      notes: [],
      warnings,
      maxTick: 0,
      trackEndTick: options.trackEndTick,
      trackIndex: options.trackIndex,
      warn(code, location) {
        const known = warnings.get(code);
        if (known) {
          known.count += 1;
          return;
        }
        const text = PAIR_WARNING_TEXT[code];
        const where = Object.assign({}, location);
        if (this.trackIndex !== undefined) where.trackIndex = this.trackIndex;
        warnings.set(code, ImportWarning.create(code, text[1], text[0], where));
      }
    };
  }

  function pushNote(context, start, durTicks, message, offVelocity) {
    const note = Events.note(start.tick, durTicks, message.pitch, start.velocity, message.channel, { offVelocity });
    context.notes.push(note);
  }

  function offVelocityOf(message) {
    return isIntegerIn(message.velocity, 0, 127) ? message.velocity : DEFAULT_OFF_VELOCITY;
  }

  // Step 1 of D10: close the most recent open note of the key that started at an earlier tick.
  function closeEarlierNote(context, message) {
    const stack = context.open.get(message.channel * 128 + message.pitch);
    if (!stack || stack.length === 0) return false;
    const start = stack.pop();
    pushNote(context, start, Math.max(1, message.tick - start.tick), message, offVelocityOf(message));
    return true;
  }

  // Step 2 of D10: a same-pitch on while one is open ends the earlier note at this start (no stacking).
  function openNote(context, message) {
    const key = message.channel * 128 + message.pitch;
    const stack = context.open.get(key) || [];
    if (stack.length > 0) {
      const previous = stack.pop();
      pushNote(context, previous, Math.max(1, message.tick - previous.tick), message, DEFAULT_OFF_VELOCITY);
      context.warn('W-NOTE-OVERLAP', { tick: message.tick, pitch: message.pitch, channel: message.channel });
    }
    stack.push({ tick: message.tick, velocity: message.velocity });
    context.open.set(key, stack);
  }

  // Step 3 of D10: an off with no earlier note closes a note opened at the same tick with length 1.
  function closeSameTickNote(context, message) {
    const stack = context.open.get(message.channel * 128 + message.pitch);
    const location = { tick: message.tick, pitch: message.pitch, channel: message.channel };
    if (!stack || stack.length === 0 || stack[stack.length - 1].tick !== message.tick) {
      context.warn('W-NOTE-OFF-WITHOUT-ON', location);
      return;
    }
    pushNote(context, stack.pop(), 1, message, offVelocityOf(message));
    context.warn('W-NOTE-ZERO-DURATION', location);
  }

  // Returns a cleaned copy of a raw message, or null when it must be dropped (the warning is recorded).
  function cleanRawMessage(context, raw) {
    const location = { tick: raw.tick, pitch: raw.pitch, channel: raw.channel };
    if (!isIntegerIn(raw.pitch, 0, 127) || !Number.isFinite(raw.tick)) {
      context.warn('W-NOTE-PITCH-RANGE', location);
      return null;
    }
    const message = { tick: raw.tick, pitch: raw.pitch, channel: (raw.channel | 0) & 15, velocity: raw.velocity };
    const isOff = raw.type === 'off' || (raw.type === 'on' && !(raw.velocity > 0));
    message.isOff = isOff;
    if (!isOff && raw.velocity > 127) {
      message.velocity = 127;
      context.warn('W-NOTE-VELOCITY-CLAMP', location);
    }
    return message;
  }

  function processTickGroup(context, group) {
    const deferred = [];
    group.filter((message) => message.isOff).forEach((message) => {
      if (!closeEarlierNote(context, message)) deferred.push(message);
    });
    group.filter((message) => !message.isOff).forEach((message) => openNote(context, message));
    deferred.forEach((message) => closeSameTickNote(context, message));
  }

  function closeUnmatched(context) {
    const end = context.trackEndTick === undefined ? context.maxTick : context.trackEndTick;
    context.open.forEach((stack, key) => {
      stack.forEach((start) => {
        const message = { pitch: key % 128, channel: Math.floor(key / 128) };
        pushNote(context, start, Math.max(1, end - start.tick), message, 0);
        context.warn('W-NOTE-UNMATCHED', { tick: start.tick, pitch: message.pitch, channel: message.channel });
      });
    });
  }

  /**
   * Pairs raw on/off messages into NoteEvents. raw is in tick order (a stable sort fixes any disorder).
   * @returns {{notes: object[], warnings: object[]}}
   */
  function pairNotes(raw, options) {
    const context = createPairingContext(options || {});
    const messages = [];
    raw.forEach((item) => {
      const message = cleanRawMessage(context, item);
      if (message) messages.push(message);
    });
    messages.sort((a, b) => a.tick - b.tick);
    let index = 0;
    while (index < messages.length) {
      const tick = messages[index].tick;
      let stop = index;
      while (stop < messages.length && messages[stop].tick === tick) stop += 1;
      processTickGroup(context, messages.slice(index, stop));
      context.maxTick = Math.max(context.maxTick, tick);
      index = stop;
    }
    closeUnmatched(context);
    sortEvents(context.notes);
    return { notes: context.notes, warnings: Array.from(context.warnings.values()) };
  }

  // ---------------------------------------------------------------------------------------------
  // Sustain pedal derived layer (Part 6.3.4.4)
  // ---------------------------------------------------------------------------------------------
  // Per channel: pedal events in order plus, for each position, the index of the next pedal-up event.
  function buildPedalChannels(events) {
    const channels = new Map();
    events.forEach((event) => {
      if (event.kind !== 'cc' || event.controller !== PEDAL_CONTROLLER) return;
      const list = channels.get(event.channel) || { events: [], nextUp: [] };
      list.events.push(event);
      channels.set(event.channel, list);
    });
    channels.forEach((list) => {
      let nextUp = -1;
      list.nextUp = new Array(list.events.length + 1).fill(-1);
      for (let position = list.events.length - 1; position >= 0; position -= 1) {
        if (list.events[position].value < PEDAL_DOWN_VALUE) nextUp = position;
        list.nextUp[position] = nextUp;
      }
    });
    return channels;
  }

  // For every note, the start of the next note with the same pitch and channel (or Infinity).
  function nextSamePitchStarts(notes) {
    const upcoming = new Map();
    const result = new Array(notes.length);
    for (let position = notes.length - 1; position >= 0; position -= 1) {
      const key = notes[position].channel * 128 + notes[position].pitch;
      result[position] = upcoming.has(key) ? upcoming.get(key) : Infinity;
      upcoming.set(key, notes[position].tick);
    }
    return result;
  }

  function trackEndOf(events) {
    return events.reduce((latest, event) => Math.max(latest, endTick(event)), 0);
  }

  // Tick at which the pedal releases a note that ended while the pedal was down, or null when it is up.
  function pedalReleaseTick(list, note, trackEnd) {
    if (!list) return null;
    const noteEnd = note.tick + note.durTicks;
    const state = lastIndexAtOrBefore(list.events, noteEnd - 1, (item) => item.tick);
    if (state < 0 || list.events[state].value < PEDAL_DOWN_VALUE) return null;
    const up = list.nextUp[state + 1];
    return up < 0 ? trackEnd : list.events[up].tick;
  }

  /** Non-destructive sustain layer; one DerivedNote per note of the track, in note order. */
  function deriveSustain(track) {
    const notes = track.events.filter((event) => event.kind === 'note');
    const pedals = buildPedalChannels(track.events);
    const nextStarts = nextSamePitchStarts(notes);
    const trackEnd = trackEndOf(track.events);
    return notes.map((note, position) => {
      const release = pedalReleaseTick(pedals.get(note.channel), note, trackEnd);
      const effectiveEnd = release === null ? note.tick + note.durTicks : Math.min(release, nextStarts[position]);
      const effectiveDurTicks = Math.max(note.durTicks, effectiveEnd - note.tick);
      return {
        note,
        noteId: note.id,
        tick: note.tick,
        pitch: note.pitch,
        velocity: note.velocity,
        channel: note.channel,
        effectiveDurTicks,
        extendedBySustain: effectiveDurTicks > note.durTicks
      };
    });
  }

  // ---------------------------------------------------------------------------------------------
  // TrackIndex
  // ---------------------------------------------------------------------------------------------
  class TrackIndex {
    constructor(track) {
      this.track = track;
      this.builtVersion = -1;
      this.refresh();
    }

    /** Rebuilds the lookup tables when the track version changed. */
    refresh() {
      ensureVersion(this.track);
      if (this.builtVersion === this.track.version) return this;
      this.notes = this.track.events.filter((event) => event.kind === 'note');
      this.starts = Float64Array.from(this.notes, (note) => note.tick);
      this.noteById = new Map(this.notes.filter((note) => note.id !== undefined).map((note) => [note.id, note]));
      this.runningMaxDuration = new Float64Array(this.notes.length);
      let longest = 0;
      this.notes.forEach((note, position) => {
        longest = Math.max(longest, note.durTicks);
        this.runningMaxDuration[position] = longest;
      });
      this.maxEnd = this.notes.reduce((latest, note) => Math.max(latest, note.tick + note.durTicks), 0);
      this.builtVersion = this.track.version;
      return this;
    }

    /** Index into notes of the first note starting at or after `tick`. */
    firstAtOrAfter(tick) {
      let low = 0;
      let high = this.starts.length;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (this.starts[middle] < tick) low = middle + 1;
        else high = middle;
      }
      return low;
    }

    /** Notes starting in [from, to). */
    notesBetween(from, to) {
      return this.notes.slice(this.firstAtOrAfter(from), this.firstAtOrAfter(to));
    }

    /** Notes with tick <= t < tick + durTicks, in note order. */
    activeAt(tick) {
      const active = [];
      for (let position = this.firstAtOrAfter(tick + 1) - 1; position >= 0; position -= 1) {
        // No earlier note can still sound once the longest duration so far no longer reaches `tick`.
        if (this.starts[position] + this.runningMaxDuration[position] <= tick) break;
        const note = this.notes[position];
        if (note.tick + note.durTicks > tick) active.push(note);
      }
      return active.reverse();
    }

    /** Most notes sounding at once (an end and a start at the same tick do not overlap). */
    maxPolyphony() {
      const ends = Float64Array.from(this.notes, (note) => note.tick + note.durTicks).sort();
      let endPosition = 0;
      let sounding = 0;
      let peak = 0;
      for (let position = 0; position < this.starts.length; position += 1) {
        while (endPosition < ends.length && ends[endPosition] <= this.starts[position]) {
          sounding -= 1;
          endPosition += 1;
        }
        sounding += 1;
        peak = Math.max(peak, sounding);
      }
      return peak;
    }

    pitchRange() {
      if (this.notes.length === 0) return null;
      let lo = 127;
      let hi = 0;
      this.notes.forEach((note) => {
        lo = Math.min(lo, note.pitch);
        hi = Math.max(hi, note.pitch);
      });
      return { lo, hi };
    }

    /** Index into track.events of the first event at or after `tick`. */
    eventsAtOrAfter(tick) {
      const events = this.track.events;
      let low = 0;
      let high = events.length;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (events[middle].tick < tick) low = middle + 1;
        else high = middle;
      }
      return low;
    }
  }

  // Cached per track object and version; a WeakMap cannot collide when two songs reuse ids like 't1'.
  const indexCache = new WeakMap();

  function indexFor(track) {
    ensureVersion(track);
    const cached = indexCache.get(track);
    if (cached && cached.version === track.version) return cached.index;
    const index = new TrackIndex(track);
    indexCache.set(track, { version: track.version, index });
    return index;
  }

  // ---------------------------------------------------------------------------------------------
  // Track
  // ---------------------------------------------------------------------------------------------
  const Track = Object.freeze({
    /**
     * Defaults per Part 5.1.2. With `song`, the id comes from song.idSeq and the color from the
     * number of tracks already in the song; without it the id is unique and the color index is
     * partial.colorIndex or 0.
     */
    create(partial, song) {
      const given = partial || {};
      const position = song ? song.tracks.length : (given.colorIndex | 0);
      const program = given.program === undefined ? 0 : given.program;
      const track = {
        id: given.id !== undefined ? given.id : (song ? 't' + (song.idSeq++).toString(36) : 't' + Core.uid()),
        name: cleanText(given.name, 'Track ' + (position + 1) + ' (' + FLM.Theory.gmProgramName(program) + ')', 80),
        kind: given.kind === 'audio' ? 'audio' : 'midi',
        channel: given.channel === undefined ? 0 : given.channel,
        program,
        bankMsb: given.bankMsb === undefined ? 0 : given.bankMsb,
        bankLsb: given.bankLsb === undefined ? 0 : given.bankLsb,
        isDrums: Boolean(given.isDrums),
        events: Array.isArray(given.events) ? sortEvents(given.events.slice()) : [],
        mix: Object.assign({ gain: 1, pan: 0, mute: false, solo: false }, given.mix),
        color: given.color !== undefined ? given.color : TRACK_COLORS[position % TRACK_COLORS.length],
        visible: given.visible === undefined ? true : Boolean(given.visible),
        lockedSource: given.lockedSource === undefined ? true : Boolean(given.lockedSource),
        derived: Boolean(given.derived),
        sourceTrackId: given.sourceTrackId === undefined ? null : given.sourceTrackId,
        idSeq: Number.isInteger(given.idSeq) && given.idSeq >= 1 ? given.idSeq : 1,
        audioRef: given.audioRef === undefined ? null : given.audioRef
      };
      ensureVersion(track);
      return track;
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Song
  // ---------------------------------------------------------------------------------------------
  function hydrateMap(MapClass, value) {
    if (value === undefined) return new MapClass();
    return value instanceof MapClass ? value : MapClass.fromJSON(value);
  }

  function defaultSource() {
    return { format: 'empty', fileName: '', version: '', warnings: [], warningsDropped: 0, importedAt: null,
      fileSizeBytes: 0, fileHash: '' };
  }

  function createSong(partial) {
    const given = partial || {};
    const stamp = nowIso();
    return {
      id: given.id !== undefined ? given.id : 'song_' + Core.uid(),
      title: cleanText(given.title, DEFAULT_TITLE, MAX_TITLE_LENGTH),
      artist: cleanText(given.artist, '', MAX_TITLE_LENGTH),
      source: Object.assign(defaultSource(), given.source),
      ppq: PPQ,
      tempoMap: hydrateMap(TempoMap, given.tempoMap),
      meterMap: hydrateMap(MeterMap, given.meterMap),
      keyMap: hydrateMap(KeyMap, given.keyMap),
      tracks: Array.isArray(given.tracks) ? given.tracks.slice() : [],
      markers: Array.isArray(given.markers) ? given.markers.map((marker) => Object.assign({}, marker)) : [],
      durationTicks: Number.isInteger(given.durationTicks) && given.durationTicks >= 0 ? given.durationTicks : 0,
      createdAt: given.createdAt !== undefined ? given.createdAt : stamp,
      modifiedAt: given.modifiedAt !== undefined ? given.modifiedAt : stamp,
      idSeq: Number.isInteger(given.idSeq) && given.idSeq >= 1 ? given.idSeq : 1
    };
  }

  function audioTrackEnd(song, track) {
    const ref = track.audioRef;
    if (track.kind !== 'audio' || !ref) return 0;
    const seconds = (ref.durationS || 0) + (ref.syncOffsetMs || 0) / 1000;
    return Math.ceil(song.tempoMap.secondsToTicks(seconds));
  }

  /** Duration implied by all tracks (decision D11 adds audio tracks) and markers; does not change the song. */
  function durationTicks(song) {
    let duration = 0;
    song.tracks.forEach((track) => {
      duration = Math.max(duration, trackEndOf(track.events), audioTrackEnd(song, track));
    });
    song.markers.forEach((marker) => {
      duration = Math.max(duration, marker.tick);
    });
    return duration;
  }

  function computeDuration(song) {
    song.durationTicks = durationTicks(song);
    return song.durationTicks;
  }

  function addTrack(song, track) {
    if (song.tracks.length >= MAX_TRACKS) throw codedError('E-MDL-010', 'Projects are limited to 32 tracks.');
    if (song.tracks.some((existing) => existing.id === track.id)) {
      throw codedError('E-MDL-003', 'duplicate track id: ' + track.id);
    }
    song.tracks.push(track);
    return track;
  }

  function removeTrack(song, trackId) {
    const index = song.tracks.findIndex((track) => track.id === trackId);
    if (index < 0) return false;
    song.tracks.splice(index, 1);
    return true;
  }

  function trackById(song, trackId) {
    return song.tracks.find((track) => track.id === trackId);
  }

  // Track copy for serialization or cloning: the non-enumerable version stays behind.
  function copyTrack(track, copyEvent) {
    const copy = Object.assign({}, track, {
      events: track.events.map(copyEvent),
      mix: Object.assign({}, track.mix),
      audioRef: track.audioRef ? Object.assign({}, track.audioRef) : null
    });
    return copy;
  }

  function songToJSON(song) {
    const plain = Object.assign({}, song, {
      source: JSON.parse(JSON.stringify(song.source)),
      tempoMap: song.tempoMap.toJSON(),
      meterMap: song.meterMap.toJSON(),
      keyMap: song.keyMap.toJSON(),
      tracks: song.tracks.map((track) => {
        const copy = copyTrack(track, (event) => Object.assign({}, event));
        if (copy.audioRef) delete copy.audioRef.buffer;
        return copy;
      }),
      markers: song.markers.map((marker) => Object.assign({}, marker))
    });
    return JSON.parse(JSON.stringify(plain));
  }

  function songClone(song) {
    const copy = Object.assign({}, song, {
      source: JSON.parse(JSON.stringify(song.source)),
      tempoMap: new TempoMap(song.tempoMap.toJSON()),
      meterMap: new MeterMap(song.meterMap.toJSON()),
      keyMap: new KeyMap(song.keyMap.toJSON()),
      tracks: song.tracks.map((track) => {
        const trackCopy = copyTrack(track, (event) => Object.assign({}, event));
        ensureVersion(trackCopy);
        trackCopy.version = track.version | 0;
        return trackCopy;
      }),
      markers: song.markers.map((marker) => Object.assign({}, marker))
    });
    return copy;
  }

  // Structural checks that must pass before a plain object can become a Song.
  function checkSongShape(obj) {
    if (!isPlainObject(obj)) throw codedError('E-MDL-001', 'a song must be an object');
    if (obj.ppq !== PPQ) throw codedError('E-MDL-001', 'ppq must be ' + PPQ);
    if (!Array.isArray(obj.tracks)) throw codedError('E-MDL-002', 'tracks must be an array');
    if (obj.tracks.length > MAX_TRACKS) throw codedError('E-MDL-002', 'more than ' + MAX_TRACKS + ' tracks');
    obj.tracks.forEach((track) => {
      if (!isPlainObject(track) || !Array.isArray(track.events)) {
        throw codedError('E-MDL-003', 'every track needs an events array');
      }
    });
    if (obj.markers !== undefined && !Array.isArray(obj.markers)) {
      throw codedError('E-MDL-005', 'markers must be an array');
    }
  }

  function songFromJSON(obj) {
    checkSongShape(obj);
    const song = createSong(Object.assign({}, obj, { tracks: [] }));
    song.tracks = obj.tracks.map((track) => {
      const restored = Track.create(Object.assign({}, track, { id: track.id }));
      restored.events = track.events.map((event) => Object.assign({}, event));
      restored.name = typeof track.name === 'string' ? track.name : restored.name;
      return restored;
    });
    const result = validate(song);
    if (!result.ok) throw codedError(result.errors[0].code, result.errors[0].message);
    return song;
  }

  const Song = Object.freeze({
    create: createSong,
    fromJSON: songFromJSON,
    toJSON: songToJSON,
    clone: songClone,
    computeDuration,
    addTrack,
    removeTrack,
    trackById
  });

  // ---------------------------------------------------------------------------------------------
  // Validation (Part 6.3.4.5)
  // ---------------------------------------------------------------------------------------------
  function createReport() {
    return {
      errors: [],
      warnings: [],
      error(code, message, location) {
        if (this.errors.length < MAX_REPORTED_ERRORS) this.errors.push({ code, message, location: location || {} });
      }
    };
  }

  function validateNote(report, event, location) {
    const goodNote = isIntegerIn(event.durTicks, 1, Infinity) && isIntegerIn(event.pitch, 0, 127) &&
      isIntegerIn(event.velocity, 1, 127) && isIntegerIn(event.channel, 0, 15);
    if (!goodNote) report.error('E-MDL-005', 'note fields out of range', location);
  }

  function validateControl(report, event, location) {
    const ok = event.kind === 'cc'
      ? isIntegerIn(event.controller, 0, 127) && isIntegerIn(event.value, 0, 127)
      : event.kind === 'bend'
        ? isIntegerIn(event.value, BEND_MIN, BEND_MAX)
        : isIntegerIn(event.program, 0, 127);
    if (!ok) report.error('E-MDL-006', event.kind + ' event fields out of range', location);
  }

  function validateEvent(report, event, location) {
    if (!isIntegerIn(event.tick, 0, Infinity)) {
      report.error('E-MDL-005', 'event tick must be an integer >= 0', location);
      return;
    }
    if (event.kind === 'note') validateNote(report, event, location);
    else if (event.kind === 'cc' || event.kind === 'bend' || event.kind === 'program') {
      validateControl(report, event, location);
    } else if (event.kind !== 'text') report.error('E-MDL-006', 'unknown event kind', location);
  }

  function validateTrack(report, track, seenTrackIds) {
    if (seenTrackIds.has(track.id)) report.error('E-MDL-003', 'duplicate track id ' + track.id, { track: track.id });
    seenTrackIds.add(track.id);
    if (!isSorted(track.events)) report.error('E-MDL-004', 'events are not in order', { track: track.id });
    const seenEventIds = new Set();
    track.events.forEach((event, index) => {
      const location = { track: track.id, index, tick: event.tick };
      validateEvent(report, event, location);
      if (event.id === undefined) return;
      if (seenEventIds.has(event.id)) report.error('E-MDL-003', 'duplicate event id ' + event.id, location);
      seenEventIds.add(event.id);
    });
  }

  function validateEntryOrder(report, code, entries, label) {
    if (!Array.isArray(entries) || entries.length === 0) {
      report.error(code, label + ' is empty');
      return false;
    }
    if (entries[0].tick !== 0) report.error(code, label + ' must start at tick 0');
    for (let index = 1; index < entries.length; index += 1) {
      if (!(entries[index].tick > entries[index - 1].tick)) report.error(code, label + ' ticks must ascend');
    }
    return true;
  }

  function validateMaps(report, song) {
    const tempo = song.tempoMap.entries;
    if (validateEntryOrder(report, 'E-MDL-007', tempo, 'tempoMap')) {
      tempo.forEach((entry) => {
        if (!isIntegerIn(entry.usPerQuarter, MIN_US_PER_QUARTER, MAX_US_PER_QUARTER)) {
          report.error('E-MDL-007', 'usPerQuarter out of range', { tick: entry.tick });
        }
      });
    }
    const meter = song.meterMap.entries;
    if (validateEntryOrder(report, 'E-MDL-008', meter, 'meterMap')) {
      meter.forEach((entry) => {
        const good = isIntegerIn(entry.numerator, 1, MAX_METER_NUMERATOR) && isPowerOfTwo(entry.denominator) &&
          entry.denominator <= MAX_METER_DENOMINATOR;
        if (!good) report.error('E-MDL-008', 'meter out of range', { tick: entry.tick });
      });
    }
    song.keyMap.entries.forEach((entry) => {
      const good = isIntegerIn(entry.fifths, -7, 7) && (entry.mode === 'major' || entry.mode === 'minor');
      if (!good) report.error('E-MDL-009', 'key out of range', { tick: entry.tick });
    });
  }

  function addSongWarnings(report, song) {
    let noteCount = 0;
    song.tracks.forEach((track) => {
      if (track.events.length === 0) {
        report.warnings.push(ImportWarning.create('W-MDL-EMPTY-TRACK', 'A track has no events.', 'info',
          { track: track.id }));
      }
      noteCount += track.events.filter((event) => event.kind === 'note').length;
    });
    if (noteCount === 0) report.warnings.push(ImportWarning.create('W-MDL-NO-NOTES', 'The song has no notes.', 'warn'));
    if (song.durationTicks < durationTicks(song)) {
      report.warnings.push(ImportWarning.create('W-MDL-DURATION', 'The song duration was shorter than its content.',
        'info'));
    }
  }

  /** Checks a Song against Part 5 and 6.3.4.5; errors stop loading, warnings do not. */
  function validate(song) {
    const report = createReport();
    if (song.ppq !== PPQ) report.error('E-MDL-001', 'ppq must be ' + PPQ);
    if (song.tracks.length > MAX_TRACKS) report.error('E-MDL-002', 'more than ' + MAX_TRACKS + ' tracks');
    const totalEvents = song.tracks.reduce((sum, track) => sum + track.events.length, 0);
    if (totalEvents > MAX_EVENTS_TOTAL) {
      report.error('E-MDL-011', 'more than ' + MAX_EVENTS_TOTAL + ' events');
      return { ok: false, errors: report.errors, warnings: report.warnings };
    }
    const seenTrackIds = new Set();
    song.tracks.forEach((track) => validateTrack(report, track, seenTrackIds));
    validateMaps(report, song);
    addSongWarnings(report, song);
    return { ok: report.errors.length === 0, errors: report.errors, warnings: report.warnings };
  }

  return Object.freeze({
    PPQ,
    KIND_PRIORITY,
    TRACK_COLORS,
    MAX_TRACKS,
    MAX_MARKERS,
    MAX_MAP_ENTRIES,
    Song,
    Track,
    Events,
    Marker,
    ImportWarning,
    compareEvents,
    insertEvent,
    insertEvents,
    replaceEvents,
    removeEvent,
    removeEvents,
    isSorted,
    sortEvents,
    pairNotes,
    deriveSustain,
    validate,
    durationTicks,
    computeDuration,
    recomputeDuration: computeDuration,
    clone: songClone,
    fromJSON: songFromJSON,
    TempoMap,
    MeterMap,
    KeyMap,
    TrackIndex,
    indexFor,
    touch,
    rescaleTicks,
    formatBarBeat,
    formatBarBeatTick
  });
});
})();
