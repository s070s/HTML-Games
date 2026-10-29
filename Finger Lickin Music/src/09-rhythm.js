// 09-rhythm.js - M-09 FLM.Rhythm: judgment windows, the Judge (input against chart time, calibration applied once),
// Score, combo, accuracy, sections, PerformanceSummary and deterministic replay.
// Separation rule: this file owns exactly one namespace and registers it once through
// FLM.Core.define. It may use only lower-numbered modules (Part 4.2, R-DEP). It declares no
// module-level global state object (S-07): each Judge keeps its state inside createJudge().
// Spec: docs/IMPLEMENTATION-PLAN.md Part 6.9 (API 6.9.2, algorithms 6.9.4), Part 5.12 (calibration), B 9.3 and 9.4.
// Time: the Judge never reads a clock. Every time comes from InputEvent.tAudio or the audioNow argument of tick(),
// so a fixed time map and a logged input make a run fully reproducible (I 2.4, B 9.4).
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Rhythm', function (FLM) {
  const Core = FLM.Core;
  const Log = Core.Log;

  const MS_PER_SECOND = 1000;
  const LANE_COUNT = 4;
  const CHORD_TOLERANCE_MS = 50;
  const LANE_PATTERN = /^(?:lane|dance)([0-3])$/;
  const SNAP_SCALE = 1e6;                    // deltas are snapped to 1e-6 ms so float noise never flips a rounding
  const ZERO_LENGTH_HOLD_SECONDS = 0.001;    // a hold shorter than this after truncation is judged at its head
  const BARS_PER_SECTION = 4;
  const MIN_SECTION_JUDGED = 4;              // a section needs this many judgments to be the "worst" one
  const REPLAY_TAIL_SECONDS = 10;            // replay ends by ticking this far past the last logged event
  const ENDED_BY = Object.freeze(['end', 'user', 'fail', 'net']);
  const STRAY_PENALTIES = Object.freeze(['none', 'combo']);
  const CUSTOM_PRESET = 'custom';
  const NARROWEST_DIFFICULTY = 'expert';     // floor for custom windows when the chart names no known difficulty
  const CALIBRATION_LIMITS = Object.freeze({
    inputOffsetMs: Object.freeze({ min: -500, max: 500, fallback: 0 }),   // 500: the host bound of Part 5.12
    audioLatencyMs: Object.freeze({ min: 0, max: 500, fallback: 0 }),
    visualLeadMs: Object.freeze({ min: 600, max: 3000, fallback: 1500 })
  });
  const NO_INPUT = Object.freeze({ held: () => [] });

  function deepFreeze(value) {
    Object.keys(value).forEach((key) => {
      if (typeof value[key] === 'object' && value[key] !== null) deepFreeze(value[key]);
    });
    return Object.freeze(value);
  }

  /** Half-width windows in ms (BRIEF 6). */
  const WINDOWS = deepFreeze({
    beginner: { perfect: 45, great: 90, good: 135 },
    intermediate: { perfect: 35, great: 70, good: 110 },
    advanced: { perfect: 25, great: 55, good: 90 },
    expert: { perfect: 18, great: 40, good: 70 }
  });

  /** Window multipliers of the judgment presets (Part 5.11). */
  const PRESETS = deepFreeze({ standard: 1, relaxed: 1.5, strict: 0.75 });

  const SCORING = deepFreeze({
    points: { perfect: 100, great: 70, good: 40, miss: 0 },
    comboPerStep: 10,                        // the multiplier rises by 1 every 10 combo, from the combo before the note
    maxMultiplier: 4
  });
  const POINTS = SCORING.points;

  // ---------------------------------------------------------------------------------------------
  // Pure helpers
  // ---------------------------------------------------------------------------------------------
  function codedError(code, text) {
    const error = new Error(code + ': ' + text);
    error.code = code;
    return error;
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  /** Symmetric rounding used everywhere: sign(x) * round(abs(x)); never returns -0. */
  function roundMs(x) {
    const rounded = Math.round(Math.abs(x));
    return rounded === 0 ? 0 : Math.sign(x) * rounded;
  }

  /** Integer ms from `earlier` to `later` (seconds); late is positive. */
  function deltaMsBetween(later, earlier) {
    const exact = (later - earlier) * MS_PER_SECOND;
    return roundMs(Math.round(exact * SNAP_SCALE) / SNAP_SCALE);
  }

  /** 'lane0'..'lane3' or 'dance0'..'dance3' -> 0..3; anything else -> -1. */
  function laneOf(control) {
    const match = typeof control === 'string' ? LANE_PATTERN.exec(control) : null;
    return match ? Number(match[1]) : -1;
  }

  /** Judgment for an integer delta given windows: 'perfect' | 'great' | 'good' | null (outside). */
  function judgmentFor(absDeltaMs, windows) {
    if (absDeltaMs <= windows.perfect) return 'perfect';
    if (absDeltaMs <= windows.great) return 'great';
    return absDeltaMs <= windows.good ? 'good' : null;
  }

  function scaledWindows(base, factor) {
    return {
      perfect: Math.round(base.perfect * factor),
      great: Math.round(base.great * factor),
      good: Math.round(base.good * factor)
    };
  }

  /** @returns {{perfect,great,good}} copy for a difficulty and preset; throws E-INP-011 on an unknown name. */
  function windowsFor(difficulty, preset) {
    const presetName = preset === undefined ? 'standard' : preset;
    if (!hasOwn(WINDOWS, difficulty)) throw codedError('E-INP-011', 'unknown difficulty ' + String(difficulty));
    if (!hasOwn(PRESETS, presetName)) throw codedError('E-INP-011', 'unknown preset ' + String(presetName));
    return scaledWindows(WINDOWS[difficulty], PRESETS[presetName]);
  }

  function validWindows(windows) {
    if (!windows || typeof windows !== 'object') return false;
    const widths = [windows.perfect, windows.great, windows.good];
    if (!widths.every((width) => Number.isFinite(width) && width > 0)) return false;
    return windows.perfect <= windows.great && windows.great <= windows.good;
  }

  function clampInteger(value, limits) {
    if (!Number.isFinite(value)) return limits.fallback;
    return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
  }

  /** Fills missing keys from `base`, clamps every value to its range (Part 5.11). */
  function normalizeCalibration(given, base) {
    const source = Object.assign({}, base, given);
    return {
      inputOffsetMs: clampInteger(source.inputOffsetMs, CALIBRATION_LIMITS.inputOffsetMs),
      audioLatencyMs: clampInteger(source.audioLatencyMs, CALIBRATION_LIMITS.audioLatencyMs),
      visualLeadMs: clampInteger(source.visualLeadMs, CALIBRATION_LIMITS.visualLeadMs)
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Chart validation and runtime notes
  // ---------------------------------------------------------------------------------------------
  function lanesProblem(lanes) {
    if (!Array.isArray(lanes) || lanes.length < 1 || lanes.length > LANE_COUNT) return 'lanes must hold 1 to 4 values';
    const valid = lanes.every((lane, index) => Number.isInteger(lane) && lane >= 0 && lane < LANE_COUNT
      && (index === 0 || lane > lanes[index - 1]));
    return valid ? '' : 'lanes must be distinct ascending values 0 to 3';
  }

  function noteProblem(note, previousTick, seenIds) {
    if (!note || typeof note !== 'object') return 'not an object';
    if (!Number.isInteger(note.tick) || note.tick < 0) return 'tick must be an integer >= 0';
    if (note.tick < previousTick) return 'notes are not sorted by tick';
    if (!Number.isInteger(note.durTicks) || note.durTicks < 1) return 'durTicks must be an integer >= 1';
    if (seenIds.has(note.id)) return 'duplicate id ' + String(note.id);
    return lanesProblem(note.lanes);
  }

  /** Throws E-INP-012 for an unsorted chart, bad lanes or duplicate ids (Part 6.9.5). */
  function validateChart(chart) {
    if (!chart || !Array.isArray(chart.notes)) throw codedError('E-INP-012', 'chart has no notes array');
    const seenIds = new Set();
    let previousTick = 0;
    chart.notes.forEach((note, index) => {
      const problem = noteProblem(note, previousTick, seenIds);
      if (problem) throw codedError('E-INP-012', 'note ' + index + ': ' + problem);
      previousTick = note.tick;
      seenIds.add(note.id);
    });
  }

  function laneMaskOf(lanes) {
    return lanes.reduce((mask, lane) => mask | (1 << lane), 0);
  }

  function buildNotes(chart) {
    return chart.notes.map((ref, idx) => ({
      ref,
      idx,
      lanes: Object.freeze(ref.lanes.slice()),
      laneMask: laneMaskOf(ref.lanes),
      isChord: ref.lanes.length > 1,
      hasTail: ref.isHold === true,
      headJudged: false,
      tailJudged: false
    }));
  }

  function buildLaneIndex(notes) {
    const byLane = [[], [], [], []];
    notes.forEach((note) => note.lanes.forEach((lane) => byLane[lane].push(note.idx)));
    return byLane;
  }

  // ---------------------------------------------------------------------------------------------
  // Sections (Part 6.9.4 F)
  // ---------------------------------------------------------------------------------------------
  function markerSections(song) {
    const markers = (song.markers || []).map((marker, index) => ({ marker, index }))
      .filter((item) => item.marker.kind === 'section')
      .sort((a, b) => (a.marker.tick - b.marker.tick) || (a.index - b.index))
      .map((item) => ({ label: item.marker.label, startTick: item.marker.tick }));
    const isNewTick = (section, index) => index === 0 || section.startTick !== markers[index - 1].startTick;
    const unique = markers.filter(isNewTick);
    if (unique.length > 0 && unique[0].startTick > 0) unique.unshift({ label: 'Intro', startTick: 0 });
    return unique;
  }

  function barSections(song, endTick) {
    const barCount = song.meterMap.barCount(endTick);
    const sections = [];
    for (let first = 0; first < barCount; first += BARS_PER_SECTION) {
      sections.push({
        label: 'Bars ' + (first + 1) + '-' + (first + BARS_PER_SECTION),
        startTick: song.meterMap.tickOfBar(first)
      });
    }
    return sections;
  }

  /** Markers of kind 'section', else every 4 bars. @returns {[{index,label,startTick,endTick}]} */
  function sectionsOf(song, minEndTick) {
    const endTick = Math.max(song.durationTicks || 0, minEndTick || 0);
    const markers = markerSections(song);
    const starts = markers.length > 0 ? markers : barSections(song, endTick);
    return starts.map((section, index) => {
      const next = starts[index + 1];
      return {
        index,
        label: section.label,
        startTick: section.startTick,
        endTick: next ? next.startTick : Math.max(endTick, section.startTick)
      };
    });
  }

  /** Index of the last section whose startTick is <= tick (binary search). */
  function sectionIndexAt(sections, tick) {
    let low = 0;
    let high = sections.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (sections[middle].startTick <= tick) low = middle;
      else high = middle - 1;
    }
    return low;
  }

  function wholeSongSection(endTick) {
    return [{ index: 0, label: 'Song', startTick: 0, endTick }];
  }

  /** Section list, per-note section index (a tail belongs to its head's section) and per-section totals. */
  function planSections(song, notes) {
    const lastEnd = notes.reduce((end, note) => Math.max(end, note.ref.tick + note.ref.durTicks), 0);
    const sections = song ? sectionsOf(song, lastEnd) : wholeSongSection(lastEnd);
    const noteSection = new Int32Array(notes.length);
    const totals = sections.map(() => 0);
    notes.forEach((note) => {
      const index = sectionIndexAt(sections, note.ref.tick);
      noteSection[note.idx] = index;
      totals[index] += note.hasTail ? 2 : 1;
    });
    const withTotals = sections.map((section, index) => Object.assign({}, section, { total: totals[index] }));
    return { sections: withTotals, noteSection };
  }

  // ---------------------------------------------------------------------------------------------
  // Score (Part 6.9.4 E)
  // ---------------------------------------------------------------------------------------------
  function blankCounts() {
    return { perfect: 0, great: 0, good: 0, miss: 0 };
  }

  function multiplierFor(combo) {
    return Math.min(SCORING.maxMultiplier, 1 + Math.floor(combo / SCORING.comboPerStep));
  }

  function accuracyOf(pointsSum, judged) {
    return judged === 0 ? 0 : pointsSum / (POINTS.perfect * judged);
  }

  function completionOf(judged, total) {
    return total === 0 ? 0 : judged / total;
  }

  /** Integer scoring accumulator. `sections` is [{index,label,startTick,endTick,total}]. */
  function createScore(total, sections) {
    const sectionData = sections.map((section) => Object.assign({}, section, {
      judged: 0, pointsSum: 0, counts: blankCounts()
    }));
    const data = {
      score: 0, combo: 0, maxCombo: 0, judged: 0, pointsSum: 0, stray: 0, holdBreaks: 0, lastStrayLane: null,
      counts: blankCounts(), deltaSum: 0, absDeltaSum: 0, deltaCount: 0, early: 0, late: 0
    };

    function recordDelta(deltaMs) {
      data.deltaSum += deltaMs;
      data.absDeltaSum += Math.abs(deltaMs);
      data.deltaCount += 1;
      if (deltaMs < 0) data.early += 1;
      if (deltaMs > 0) data.late += 1;
    }

    function recordSection(judgment, points, sectionIndex) {
      const section = sectionData[sectionIndex];
      if (!section) return;
      section.judged += 1;
      section.pointsSum += points;
      section.counts[judgment] += 1;
    }

    /** Applies one head or tail judgment; points use the combo before this note. */
    function apply(judgment, deltaMs, sectionIndex, isHoldBreak) {
      const points = POINTS[judgment];
      data.score += points * multiplierFor(data.combo);
      data.pointsSum += points;
      data.counts[judgment] += 1;
      data.judged += 1;
      recordSection(judgment, points, sectionIndex);
      if (judgment === 'miss') {
        data.combo = 0;
        if (isHoldBreak) data.holdBreaks += 1;
        return;
      }
      data.combo += 1;
      data.maxCombo = Math.max(data.maxCombo, data.combo);
      recordDelta(deltaMs);
    }

    /** A press with no note to judge: counted, no points; the combo drops by 1 only with the 'combo' penalty. */
    function addStray(lane, penalty) {
      data.stray += 1;
      data.lastStrayLane = lane;
      if (penalty === 'combo') data.combo = Math.max(0, data.combo - 1);
    }

    function state() {
      return {
        score: data.score,
        combo: data.combo,
        maxCombo: data.maxCombo,
        counts: Object.assign({}, data.counts),
        judged: data.judged,
        total,
        accuracy: accuracyOf(data.pointsSum, data.judged),
        completion: completionOf(data.judged, total),
        pointsSum: data.pointsSum,
        stray: data.stray,
        holdBreaks: data.holdBreaks,
        lastStrayLane: data.lastStrayLane
      };
    }

    function sectionStats() {
      return sectionData.map((section) => Object.assign({}, section, {
        counts: Object.assign({}, section.counts),
        accuracy: accuracyOf(section.pointsSum, section.judged)
      }));
    }

    function deltaStats() {
      const mean = (sum) => (data.deltaCount > 0 ? roundMs(sum / data.deltaCount) : 0);
      return {
        earlyCount: data.early,
        lateCount: data.late,
        meanDeltaMs: mean(data.deltaSum),
        absMeanDeltaMs: mean(data.absDeltaSum)
      };
    }

    return Object.freeze({ apply, addStray, state, sectionStats, deltaStats });
  }

  /** Lowest accuracy among sections with enough judgments; ties go to the earlier section. */
  function worstSectionIndex(sectionStats) {
    let worst = null;
    sectionStats.forEach((section) => {
      if (section.judged < MIN_SECTION_JUDGED) return;
      if (worst === null || section.accuracy < worst.accuracy) worst = section;
    });
    return worst === null ? null : worst.index;
  }

  // ---------------------------------------------------------------------------------------------
  // PerformanceSummary (Part 6.9.2, 6.9.4 G)
  // ---------------------------------------------------------------------------------------------
  const PerformanceSummary = Object.freeze({
    VERSION: 1,
    /** parts: {chart, song, meta, preset, comparable, calibration, strayPenalty, score}; score is a createScore(). */
    build(parts) {
      const state = parts.score.state();
      const sections = parts.score.sectionStats();
      const meta = parts.meta || {};
      const chart = parts.chart;
      return Object.assign({
        version: PerformanceSummary.VERSION,
        songId: meta.songId !== undefined ? meta.songId : (parts.song ? parts.song.id : null),
        chartId: meta.chartId !== undefined ? meta.chartId : chart.id,
        trackId: chart.trackId !== undefined ? chart.trackId : null,
        difficulty: chart.difficulty !== undefined ? chart.difficulty : null,
        profile: chart.profile !== undefined ? chart.profile : null,
        settingsHash: chart.settingsHash !== undefined ? chart.settingsHash : null,
        windowsPreset: parts.preset,
        comparable: parts.comparable,
        calibration: {
          inputOffsetMs: parts.calibration.inputOffsetMs,
          audioLatencyMs: parts.calibration.audioLatencyMs
        },
        strayPenalty: parts.strayPenalty
      }, state, parts.score.deltaStats(), {
        sections,
        worstSectionIndex: worstSectionIndex(sections),
        startedAt: meta.startedAt !== undefined ? meta.startedAt : null,
        completedAt: meta.completedAt !== undefined ? meta.completedAt : null,
        durationSec: meta.durationSec !== undefined ? meta.durationSec : null
      });
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Shared calibration (Part 5.12): the one stored copy; each bound Judge applies it once in setCalibration
  // ---------------------------------------------------------------------------------------------
  let sharedCalibration = normalizeCalibration({}, {});
  const followingJudges = new Set();

  function calibration() {
    return Object.assign({}, sharedCalibration);
  }

  /** Stores the calibration (missing keys keep their value) and hands it to every bound Judge. */
  function setCalibration(given) {
    sharedCalibration = normalizeCalibration(given, sharedCalibration);
    followingJudges.forEach((judge) => judge.setCalibration(sharedCalibration));
    return calibration();
  }

  // ---------------------------------------------------------------------------------------------
  // The Judge
  // ---------------------------------------------------------------------------------------------
  /** opts: {timeMap, strayPenalty, windowsPreset, bus, input, kind, followCalibration}; see Part 6.9.2. */
  function createJudge(opts) {
    const settings = opts || {};
    const bus = settings.bus || Core.bus;
    const input = settings.input || FLM.Input || NO_INPUT;
    const timeMap = settings.timeMap || FLM.Transport.main;
    const strayPenalty = settings.strayPenalty === undefined ? 'none' : settings.strayPenalty;
    const defaultPreset = settings.windowsPreset === undefined ? 'standard' : settings.windowsPreset;
    const kind = settings.kind || 'instrument';
    const owner = { module: 'Rhythm' };
    Core.assert(STRAY_PENALTIES.includes(strayPenalty), 'strayPenalty must be none or combo');
    Core.assert(hasOwn(PRESETS, defaultPreset), 'windowsPreset must be standard, relaxed or strict');

    let loaded = null;             // {chart, song, notes, byLane, sections, noteSection, total}; survives restart()
    let run = null;                // everything restart() clears
    let windows = null;
    let preset = defaultPreset;
    let baseDifficulty = null;
    let judgeCalibration = { inputOffsetMs: 0, audioLatencyMs: 0 };
    let offsetSec = 0;             // the ONLY calibration value the Judge uses (S-04)
    let active = false;
    let attached = false;
    let disposed = false;
    const api = {};

    // ---- small accessors -------------------------------------------------------------------------
    const goodMs = () => windows.good;
    const noteTime = (note) => timeMap.audioTimeAt(note.ref.tick);
    const endTime = (note) => timeMap.audioTimeAt(note.ref.tick + note.ref.durTicks);

    function isAnchored() {
      return Number.isFinite(timeMap.audioTimeAt(0));
    }

    function isReady() {
      return loaded !== null && !disposed;
    }

    function freshRun() {
      loaded.notes.forEach((note) => {
        note.headJudged = false;
        note.tailJudged = !note.hasTail;
      });
      return {
        missCursor: 0,
        laneCursor: [0, 0, 0, 0],
        pending: new Map(),
        holds: new Map(),
        held: new Set(),
        results: [],
        log: [],
        score: createScore(loaded.total, loaded.sections),
        finished: false,
        calibrationChanged: false,
        began: false                 // true once the judge was active: a change while paused still counts
      };
    }

    function comparable() {
      return preset === 'standard' && strayPenalty === 'none' && !run.calibrationChanged;
    }

    // ---- events ----------------------------------------------------------------------------------
    function currentSectionIndex() {
      const { notes, noteSection, sections } = loaded;
      if (run.missCursor < notes.length) return noteSection[run.missCursor];
      return sections.length - 1;
    }

    function emitScore(sectionIndex) {
      const payload = Object.assign(run.score.state(), { chartId: loaded.chart.id, sectionIndex });
      bus.emit('score.update', payload);
    }

    /** Scores one head or tail judgment, then emits judge.result before score.update (one HUD frame). */
    function record(note, part, judgment, deltaMs, tInput, isHoldBreak) {
      const sectionIndex = loaded.noteSection[note.idx];
      run.score.apply(judgment, deltaMs, sectionIndex, isHoldBreak === true);
      const result = Object.freeze({
        noteId: note.ref.id,
        judgment,
        deltaMs,
        tInput,
        part,
        lanes: note.lanes,
        tick: part === 'tail' ? note.ref.tick + note.ref.durTicks : note.ref.tick,
        combo: run.score.state().combo,
        isHold: note.hasTail,
        holdPhase: note.hasTail ? part : null
      });
      run.results.push(result);
      bus.emit('judge.result', result);
      emitScore(sectionIndex);
      return result;
    }

    function recordStray(lane) {
      run.score.addStray(lane, strayPenalty);
      emitScore(currentSectionIndex());
    }

    // ---- holds (Part 6.9.4 C) --------------------------------------------------------------------
    function recordTail(note, judgment, deltaMs, tInput, isHoldBreak) {
      note.tailJudged = true;
      return record(note, 'tail', judgment, deltaMs, tInput, isHoldBreak);
    }

    function startHold(note) {
      const degenerate = endTime(note) <= noteTime(note) + ZERO_LENGTH_HOLD_SECONDS;
      if (degenerate) {
        recordTail(note, 'perfect', 0, null, false);
        return;
      }
      run.holds.set(note.idx, { note, lanesHeld: note.laneMask });
    }

    /** The first released lane of a hold ends it: judged with the same windows, or a hold break when too early. */
    function releaseHold(hold, tAdj, tInput) {
      run.holds.delete(hold.note.idx);
      const releaseDelta = deltaMsBetween(tAdj, endTime(hold.note));
      if (releaseDelta < -goodMs()) return recordTail(hold.note, 'miss', releaseDelta, tInput, true);
      return recordTail(hold.note, judgmentFor(Math.abs(releaseDelta), windows), releaseDelta, tInput, false);
    }

    function heldMask() {
      let mask = 0;
      run.held.forEach((lane) => { mask |= 1 << lane; });
      return mask;
    }

    /** Holding through the end is the ideal: perfect, and a late release is never penalized. */
    function completeHold(hold) {
      run.holds.delete(hold.note.idx);
      const stillHeld = (hold.lanesHeld & heldMask()) === hold.lanesHeld;
      if (stillHeld) return [recordTail(hold.note, 'perfect', 0, null, false)];
      return [recordTail(hold.note, 'miss', null, null, true)];
    }

    // ---- deterministic ordering (Part 6.9.4 A) ---------------------------------------------------
    function isWindowClosed(baseTime, tLimit) {
      return deltaMsBetween(tLimit, baseTime) > goodMs();
    }

    function declareMiss(note) {
      run.missCursor += 1;
      run.pending.delete(note.idx);
      note.headJudged = true;
      const results = [record(note, 'head', 'miss', null, null, false)];
      // A missed hold head cannot be held, so its tail is missed with it; `total` counts both.
      if (note.hasTail) results.push(recordTail(note, 'miss', null, null, false));
      return results;
    }

    function dueMiss(tLimit) {
      const { notes } = loaded;
      while (run.missCursor < notes.length && notes[run.missCursor].headJudged) run.missCursor += 1;
      if (run.missCursor >= notes.length) return null;
      const note = notes[run.missCursor];
      const time = noteTime(note);
      return isWindowClosed(time, tLimit) ? { time, declare: () => declareMiss(note) } : null;
    }

    function dueHold(tLimit) {
      let earliest = null;
      run.holds.forEach((hold) => {
        const time = endTime(hold.note);
        if (!isWindowClosed(time, tLimit)) return;
        if (earliest === null || time < earliest.time) earliest = { time, declare: () => completeHold(hold) };
      });
      return earliest;
    }

    /** Next window to close: a miss and a hold end are taken in close-time order, so tick cadence never matters. */
    function nextDue(tLimit) {
      const miss = dueMiss(tLimit);
      const hold = dueHold(tLimit);
      if (!hold) return miss;
      if (!miss) return hold;
      return miss.time <= hold.time ? miss : hold;
    }

    /** Declares every miss and hold completion whose window closed before tLimit; returns the results. */
    function advance(tLimit) {
      const declared = [];
      let due = nextDue(tLimit);
      while (due) {
        declared.push(...due.declare());
        due = nextDue(tLimit);
      }
      return declared;
    }

    // ---- input (Part 6.9.4 B) --------------------------------------------------------------------
    function skipJudgedHeads(lane) {
      const indexes = loaded.byLane[lane];
      let cursor = run.laneCursor[lane];
      while (cursor < indexes.length && loaded.notes[indexes[cursor]].headJudged) cursor += 1;
      run.laneCursor[lane] = cursor;
      return cursor;
    }

    /** Nearest unjudged note of the lane inside the good window; ties go to the earlier tick. */
    function findCandidate(lane, tAdj) {
      const indexes = loaded.byLane[lane];
      let best = null;
      for (let position = skipJudgedHeads(lane); position < indexes.length; position += 1) {
        const note = loaded.notes[indexes[position]];
        if (note.headJudged) continue;
        const deltaMs = deltaMsBetween(tAdj, noteTime(note));
        if (deltaMs < -goodMs()) break;             // notes ascend in time: every later one is further ahead
        if (deltaMs > goodMs()) continue;
        if (best === null || Math.abs(deltaMs) < Math.abs(best.deltaMs)) best = { note, deltaMs };
      }
      return best;
    }

    function hitHead(note, deltaMs, tInput) {
      note.headJudged = true;
      const result = record(note, 'head', judgmentFor(Math.abs(deltaMs), windows), deltaMs, tInput, false);
      if (note.hasTail) startHold(note);
      return result;
    }

    function worstDelta(deltas) {
      return deltas.reduce((worst, delta) => (Math.abs(delta) >= Math.abs(worst) ? delta : worst));
    }

    /** A chord needs every lane within the tolerance of its first press; partial presses wait or miss. */
    function pressChord(note, lane, tAdj, deltaMs, tInput) {
      const bit = 1 << lane;
      const pending = run.pending.get(note.idx);
      if (!pending) {
        run.pending.set(note.idx, { firstTAdj: tAdj, lanesPressed: bit, deltas: [deltaMs] });
        return null;
      }
      if (pending.lanesPressed & bit) return null;                       // duplicate lane press: not a stray
      if (deltaMsBetween(tAdj, pending.firstTAdj) > CHORD_TOLERANCE_MS) {
        recordStray(lane);
        return null;
      }
      pending.lanesPressed |= bit;
      pending.deltas.push(deltaMs);
      if (pending.lanesPressed !== note.laneMask) return null;
      run.pending.delete(note.idx);
      return hitHead(note, worstDelta(pending.deltas), tInput);
    }

    function handlePress(lane, tAdj, tInput) {
      run.held.add(lane);
      const candidate = findCandidate(lane, tAdj);
      if (!candidate) {
        recordStray(lane);
        return null;
      }
      const { note, deltaMs } = candidate;
      if (note.isChord) return pressChord(note, lane, tAdj, deltaMs, tInput);
      return hitHead(note, deltaMs, tInput);
    }

    function handleRelease(lane, tAdj, tInput) {
      run.held.delete(lane);
      const bit = 1 << lane;
      Array.from(run.holds.values()).filter((hold) => hold.lanesHeld & bit)
        .forEach((hold) => releaseHold(hold, tAdj, tInput));
      return null;
    }

    function logInput(evt, ignored) {
      const entry = {
        source: evt.source, control: evt.control, type: evt.type, tPerf: evt.tPerf, tAudio: evt.tAudio,
        pressure: evt.pressure
      };
      if (ignored) entry.ignored = true;
      run.log.push(entry);
    }

    function onInput(evt) {
      if (!isReady() || !evt) return null;
      const lane = laneOf(evt.control);
      const isEdge = evt.type === 'press' || evt.type === 'release';
      if (lane < 0 || !isEdge) return null;
      logInput(evt, !active);
      if (!active) return null;                                         // paused: no stray, no judgment (P 5.2)
      if (!Number.isFinite(evt.tAudio)) {
        Log.once('RHY_NO_TAUDIO', 'warn', 'rhythm', 'RHY_NO_TAUDIO', { control: evt.control });
        return null;
      }
      if (!isAnchored()) return null;
      const tAdj = evt.tAudio - offsetSec;                              // calibration is applied here and nowhere else
      advance(tAdj);
      if (evt.type === 'release') return handleRelease(lane, tAdj, evt.tAudio);
      return handlePress(lane, tAdj, evt.tAudio);
    }

    function tick(audioNow) {
      if (!isReady() || !active || !Number.isFinite(audioNow) || !isAnchored()) return [];
      return advance(audioNow - offsetSec);
    }

    // ---- activity, pause and resume (Part 6.9.4 C.4) ---------------------------------------------
    function lanesFromInput() {
      return input.held().map(laneOf).filter((lane) => lane >= 0);
    }

    function resumeTime() {
      const canRead = typeof timeMap.position === 'function' && isAnchored();
      return canRead ? timeMap.audioTimeAt(timeMap.position()) : null;
    }

    /** Lanes no longer physically held are released at the resume position; lanes still held carry on. */
    function resumeHolds(resumeAt, heldLanes) {
      run.held = new Set(heldLanes);
      if (!Number.isFinite(resumeAt)) return;
      advance(resumeAt);
      Array.from(run.holds.values()).forEach((hold) => {
        const lost = (hold.lanesHeld & ~heldMask()) !== 0;
        if (lost) releaseHold(hold, resumeAt, null);
      });
    }

    /** options (both optional): {tAudio, held:[lane]}; replay passes the logged values, the mode passes none. */
    function setActive(on, options) {
      const next = Boolean(on);
      if (!isReady() || next === active) return;
      const given = options || {};
      const resumeAt = next ? (given.tAudio !== undefined ? given.tAudio : resumeTime()) : given.tAudio;
      const heldLanes = next ? (given.held !== undefined ? given.held : lanesFromInput()) : [];
      active = next;
      if (next) run.began = true;
      run.log.push({ marker: 'active', on: next, tAudio: Number.isFinite(resumeAt) ? resumeAt : null,
        held: heldLanes.slice() });
      if (next) resumeHolds(resumeAt, heldLanes);
    }

    // ---- loading, windows and calibration --------------------------------------------------------
    function narrowestAllowed() {
      const name = hasOwn(WINDOWS, baseDifficulty) ? baseDifficulty : NARROWEST_DIFFICULTY;
      return windowsFor(name, 'strict');
    }

    /** Custom windows may not be narrower than the strict table (UT-09-24); named presets are taken as given. */
    function setWindows(given, presetName) {
      const name = presetName === undefined ? CUSTOM_PRESET : presetName;
      const known = name === CUSTOM_PRESET || hasOwn(PRESETS, name);
      if (!known) throw codedError('E-INP-011', 'unknown preset ' + String(name));
      if (!validWindows(given)) throw codedError('E-INP-011', 'windows need ascending positive perfect, great, good');
      const floor = narrowestAllowed();
      const tooNarrow = name === CUSTOM_PRESET
        && (given.perfect < floor.perfect || given.great < floor.great || given.good < floor.good);
      if (tooNarrow) throw codedError('E-INP-011', 'custom windows are narrower than the strict table');
      windows = { perfect: given.perfect, great: given.great, good: given.good };
      preset = name;
    }

    /** Resolves the windows argument of load(): a difficulty name, a windows object, or the chart's difficulty. */
    function windowsForLoad(chart, windowsOrDifficulty) {
      const choice = windowsOrDifficulty === undefined ? chart.difficulty : windowsOrDifficulty;
      if (typeof choice === 'string') return { windows: windowsFor(choice, defaultPreset), difficulty: choice };
      if (!validWindows(choice)) throw codedError('E-INP-011', 'load needs a difficulty name or valid windows');
      return { windows: choice, difficulty: hasOwn(WINDOWS, chart.difficulty) ? chart.difficulty : null };
    }

    /** Validates first, so a failing load leaves the previous chart loaded (UT-09-02). */
    function load(chart, song, windowsOrDifficulty) {
      Core.assert(!disposed, 'Judge was disposed');
      validateChart(chart);
      const chosen = windowsForLoad(chart, windowsOrDifficulty);
      const notes = buildNotes(chart);
      const plan = planSections(song, notes);
      loaded = {
        chart, song, notes, byLane: buildLaneIndex(notes), sections: plan.sections, noteSection: plan.noteSection,
        total: notes.length + notes.filter((note) => note.hasTail).length
      };
      baseDifficulty = chosen.difficulty;
      windows = null;
      if (typeof windowsOrDifficulty === 'object' && windowsOrDifficulty !== null) {
        setWindows(chosen.windows, defaultPreset);
      } else {
        windows = chosen.windows;
        preset = defaultPreset;
      }
      run = freshRun();
      emitScore(0);
    }

    /** The ONLY application point of calibration: offsetSec is read from it here and nowhere else. */
    function setCalibrationValues(given) {
      const next = normalizeCalibration(given, judgeCalibration);
      const unchanged = next.inputOffsetMs === judgeCalibration.inputOffsetMs
        && next.audioLatencyMs === judgeCalibration.audioLatencyMs;
      if (unchanged || disposed) return;
      judgeCalibration = { inputOffsetMs: next.inputOffsetMs, audioLatencyMs: next.audioLatencyMs };
      offsetSec = (next.inputOffsetMs + next.audioLatencyMs) / MS_PER_SECOND;
      if (!run) return;
      run.log.push({ marker: 'calibration', inputOffsetMs: next.inputOffsetMs, audioLatencyMs: next.audioLatencyMs });
      // E 4.1: earlier results keep their value; the run is no longer comparable.
      if (active || run.began) run.calibrationChanged = true;
    }

    // ---- results, summary, restart, finish -------------------------------------------------------
    function summary(meta) {
      Core.assert(isReady(), 'Judge has no chart loaded');
      return PerformanceSummary.build({
        chart: loaded.chart, song: loaded.song, meta, preset, comparable: comparable(), calibration: judgeCalibration,
        strayPenalty, score: run.score
      });
    }

    function restart() {
      if (!isReady()) return;
      run = freshRun();
      emitScore(0);
    }

    function finish(endedBy, meta) {
      Core.assert(ENDED_BY.includes(endedBy), 'finish needs end, user, fail or net');
      if (!isReady() || run.finished) return;
      run.finished = true;
      bus.emit('chart.finished', { chartId: loaded.chart.id, kind, summary: summary(meta), endedBy });
    }

    function nextNotes(lane, count) {
      if (!isReady() || lane < 0 || lane >= LANE_COUNT) return [];
      const indexes = loaded.byLane[lane];
      const upcoming = [];
      for (let position = skipJudgedHeads(lane); position < indexes.length && upcoming.length < count; position += 1) {
        const note = loaded.notes[indexes[position]];
        if (!note.headJudged) upcoming.push(note.ref);
      }
      return upcoming;
    }

    function cursor() {
      if (!isReady()) return { noteIndex: 0, lanes: [0, 0, 0, 0] };
      return { noteIndex: run.missCursor, lanes: run.laneCursor.map((unused, lane) => skipJudgedHeads(lane)) };
    }

    // ---- bus subscription and lifetime -----------------------------------------------------------
    function onInputEvent(evt) {
      onInput(evt);
    }

    function attach() {
      if (attached || disposed) return;
      attached = true;
      bus.on('input.event', onInputEvent, owner);
    }

    function detach() {
      if (!attached) return;
      attached = false;
      bus.off('input.event', onInputEvent);
    }

    function dispose() {
      detach();
      followingJudges.delete(api);
      disposed = true;
      active = false;
      loaded = null;
      run = null;
    }

    const readState = (read) => (isReady() ? read() : null);

    Object.assign(api, {
      load, setCalibration: setCalibrationValues, setWindows, attach, detach, setActive, onInput, tick, restart,
      finish, summary, nextNotes, cursor, dispose,
      state: () => readState(() => run.score.state()),
      sections: () => readState(() => run.score.sectionStats()),
      results: () => readState(() => run.results.slice()),
      inputLog: () => readState(() => run.log.map((entry) => Object.assign({}, entry)))
    });
    if (settings.followCalibration !== false) {
      followingJudges.add(api);
      setCalibrationValues(sharedCalibration);
    }
    return Object.freeze(api);
  }

  /** Part 4.1 `Judge.bind`; Part 4.7.1 step 8 follows it with load(), setCalibration() and attach(). */
  const Judge = Object.freeze({ bind: createJudge });

  // ---------------------------------------------------------------------------------------------
  // Replay (Part 6.9.4 H)
  // ---------------------------------------------------------------------------------------------
  function replayEntry(judge, entry) {
    if (entry.marker === 'active') judge.setActive(entry.on, { tAudio: entry.tAudio, held: entry.held });
    else if (entry.marker === 'calibration') judge.setCalibration(entry);
    else if (!entry.ignored) judge.onInput(entry);
  }

  function lastEventTime(inputLog) {
    const later = (latest, entry) => (Number.isFinite(entry.tAudio) ? Math.max(latest, entry.tAudio) : latest);
    return inputLog.reduce(later, 0);
  }

  /** Judges a logged input against a chart with a fixed time map (speed 1, anchor 0). Deterministic. */
  function replay(chart, song, difficulty, inputLog, calibrationValues, opts) {
    const settings = opts || {};
    const tempoMap = song.tempoMap;
    const judge = createJudge({
      timeMap: {
        audioTimeAt: (tick) => tempoMap.ticksToSeconds(tick),
        tickAt: (seconds) => tempoMap.secondsToTicks(seconds)
      },
      strayPenalty: settings.strayPenalty,
      windowsPreset: settings.windowsPreset,
      bus: new Core.Emitter(),
      input: NO_INPUT,
      followCalibration: false
    });
    judge.load(chart, song, settings.windows !== undefined ? settings.windows : difficulty);
    judge.setCalibration(calibrationValues || {});
    judge.setActive(true, { tAudio: null, held: [] });
    inputLog.forEach((entry) => replayEntry(judge, entry));
    judge.tick(lastEventTime(inputLog) + REPLAY_TAIL_SECONDS);
    const outcome = { state: judge.state(), results: judge.results() };
    judge.dispose();
    return outcome;
  }

  return Object.freeze({
    WINDOWS,
    PRESETS,
    SCORING,
    POINTS,
    CHORD_TOLERANCE_MS,
    windowsFor,
    laneOf,
    judgmentFor,
    roundMs,
    Judge,
    Score: Object.freeze({ create: createScore, multiplierFor }),
    PerformanceSummary,
    sectionsOf,
    replay,
    calibration,
    setCalibration
  });
});
})();
