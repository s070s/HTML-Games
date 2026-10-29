// 30-content.js - M-30 FLM.Content (T04.10): the five original demo arrangements and the tutorial song as compact data in
// the FLM notation (Part 6.30.4.1), the deterministic expander from notation to Song, the tutorial steps and their authored
// charts, the eight character presets, and the load-time registration into FLM.Project.Catalog (Part 4.3 A4).
// Separation rule: this file owns exactly one namespace and registers it once through FLM.Core.define. It uses only
// lower-numbered modules (Core, Theory, Model, Project.Catalog, Character when it exists). It keeps only frozen tables;
// the expanded Song of a demo is cached by the Catalog. All music is original (B 23.3): no copyrighted melody.
// The data below is typed exactly as in the plan (6.30.4.6): bar checks (|) and the count table of the tests catch typos.
// Errors: E-CNT-001 bar check or grid length, E-CNT-002 part length, E-CNT-003 unknown chord, pattern or token,
// E-CNT-004 pitch out of range, E-CNT-005 model validation failed.
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Content', function (FLM) {
  const Core = FLM.Core;
  const Model = FLM.Model;
  const Theory = FLM.Theory;

  const VERSION = 1;
  const NOTATION = Object.freeze({ VERSION: 1, DUR: Object.freeze({ w: 3840, h: 1920, q: 960, e: 480, s: 240, t: 120 }),
    CREATED_AT: '2026-10-23T00:00:00.000Z', RPN_BEND_SEMIS: 2 });
  const PPQ = 960;
  const DOTTED = 1.5;
  const TRIPLET_NUMERATOR = 2;
  const TRIPLET_DENOMINATOR = 3;
  const SWING_SHIFT = 160;
  const EIGHTH = 480;
  const DRUM_NOTE_TICKS = 120;
  const DRUM_STEP = Object.freeze({ s: 240, e3: 320 });
  const GHOST_VELOCITY = 30;
  const FEATHER_VELOCITY = 25;
  const ACCENT_BOOST = 20;
  const DEFAULT_VELOCITY = 90;
  const DEFAULT_GATE = 0.92;
  const CRASH_KEY = 49;
  const PEDAL_DELAY = 60;
  const PEDAL_END_BEFORE = 30;
  const BEND_PEAK = 8191;
  const BEND_STEPS = 4;
  const DIP_VALUES = Object.freeze([40, 68, 96, 127]);
  const DIP_SPACING = 120;
  const MIDI_TOP = 127;
  const MAX_TRACK_ID_RADIX = 36;
  const SECONDS_ROUND = 1000;
  const LANE_PITCHES = Object.freeze([60, 64, 67, 72]);
  const TUTORIAL_INSTRUMENTS = Object.freeze([0, 25, 80, 12]);
  const STEP_TAIL = 'Step';

  // ---------------------------------------------------------------------------------------------
  // The arrangements (6.30.4.6)
  // ---------------------------------------------------------------------------------------------
  const POPROCK = {
    id: 'demo-poprock', title: 'Neon Boulevard', artist: 'Finger Lickin Music', style: 'Pop-rock band', contentVersion: 1,
    key: { fifths: 1, mode: 'major' }, tempo: [[1, 120]], meter: [[1, 4, 4]],
    sections: [{ label: 'Intro', bars: 4, dyn: -10 }, { label: 'Verse', bars: 8, dyn: -10 },
      { label: 'Chorus', bars: 8, dyn: 20 }, { label: 'Verse', bars: 8, dyn: -10 }, { label: 'Chorus', bars: 8, dyn: 20 },
      { label: 'Bridge', bars: 4, dyn: 0 }, { label: 'Chorus', bars: 8, dyn: 20 }],
    harmony: { Intro: 'G D Em C', Verse: 'G D Em C G D C D', Chorus: 'C D G Em C D G G', Bridge: 'Em C Am D' },
    chords: {
      G: { root: 'G2', comp: 'G3.B3.D4.G4', keys: 'B3.D4.G4' },
      D: { root: 'D2', comp: 'F#3.A3.D4.F#4', keys: 'A3.D4.F#4' },
      Em: { root: 'E2', q: 'min', comp: 'G3.B3.E4.G4', keys: 'B3.E4.G4' },
      C: { root: 'C2', comp: 'G3.C4.E4.G4', keys: 'C4.E4.G4' },
      Am: { root: 'A2', q: 'min', comp: 'A3.C4.E4.A4', keys: 'C4.E4.A4' }
    },
    drumVel: { 36: 100, 38: 100, 41: 95, 42: 80, 43: 95, 45: 95, 46: 85, 47: 95, 48: 95, 49: 110, 50: 95, 51: 80, 54: 70 },
    patterns: {
      drIntro: { grid: { 36: 'x.......x.......', 42: 'x.x.x.x.x.x.x.x.' } },
      drVerse: { grid: { 36: 'x.....x.x.......', 38: '....x.......x...', 42: 'x.x.x.x.x.x.x.x.' } },
      drChorus: { grid: { 36: 'x.....x.x.x.....', 38: '....x.......x...', 42: 'x...x...x...x...',
        46: '..x...x...x...x.', 54: '....x.......x...' } },
      drBridgeA: { grid: { 36: 'x.......x.......', 38: '........x.......', 51: 'x.x.x.x.x.x.x.x.' } },
      drFill: { grid: { 36: 'x...............', 50: '..xx............', 48: '....xx..........', 47: '......xx........',
        45: '........xx......', 43: '..........xx....', 41: '............xx..', 38: '..............xx' } },
      bsIntro: { vel: 90, gate: 0.95, notes: 'R/w' },
      bsVerse: { vel: 90, gate: 0.85, notes: 'R/e R/e R/e R/e R/e R/e R/e R/e' },
      bsChorus: { vel: 90, gate: 0.85, notes: 'R/e R/e O/e R/e F/e R/e O/e A/e' },
      bsBridge: { vel: 90, gate: 0.9, notes: 'R/q R/q F/q A/q' },
      rgIntro: { set: 'comp', vel: 80, gate: 0.95, notes: 'x/w' },
      rgVerse: { set: 'comp', vel: 85, gate: 0.9, notes: 'x/h x/q x/q' },
      rgChorus: { set: 'comp', vel: 90, gate: 0.9, notes: 'x/q x/q x/q x/q' },
      rgBridge: { set: 'comp', vel: 85, gate: 0.95, notes: 'x/h x/h' },
      kIntro: { set: 'keys', vel: 75, gate: 0.95, notes: 'x/w' },
      kVerse: { set: 'keys', vel: 80, gate: 0.9, notes: 'x/h x/h' },
      kChorus: { set: 'keys', vel: 85, gate: 0.95, notes: 'x/w' },
      kBridge: { set: 'keys', vel: 80, gate: 0.95, notes: 'x/w' },
      ldChorus: { vel: 95, gate: 0.95, notes: 'E4/q D4/e E4/e G4/q E4/q | F#4/q E4/e F#4/e A4/h | ' +
        'B4/q A4/e B4/e D5/q B4/q | B4/h. r/q | E4/q D4/e E4/e G4/q E4/q | F#4/q E4/e F#4/e A4/q D5/q | ' +
        'D5/q. B4/e A4/q G4/q | G4/w |' },
      ldBridge: { vel: 90, gate: 0.95, notes: 'G4/h E4/h | E4/h G4/h | A4/q G4/q E4/q C4/q | D4/h F#4/h |' }
    },
    tracks: [
      { name: 'Drums', drums: true, channel: 9, slot: 0, preset: 'preset-ace', crash: true,
        parts: { Intro: 'drIntro', Verse: 'drVerse', Chorus: 'drChorus', Bridge: [['drBridgeA', 3], ['drFill', 1]] } },
      { name: 'Bass', program: 33, channel: 0, slot: 1, preset: 'preset-blue',
        parts: { Intro: 'bsIntro', Verse: 'bsVerse', Chorus: 'bsChorus', Bridge: 'bsBridge' } },
      { name: 'Rhythm Guitar', program: 27, channel: 1, slot: 2, preset: 'preset-riff',
        parts: { Intro: 'rgIntro', Verse: 'rgVerse', Chorus: 'rgChorus', Bridge: 'rgBridge' } },
      { name: 'Lead Guitar', program: 29, channel: 2, slot: 3, preset: 'preset-nova',
        parts: { Intro: null, Verse: null, Chorus: 'ldChorus', Bridge: 'ldBridge' } },
      { name: 'Keys', program: 4, channel: 3, slot: 4, preset: 'preset-ivy',
        parts: { Intro: 'kIntro', Verse: 'kVerse', Chorus: 'kChorus', Bridge: 'kBridge' } }
    ],
    cc: [], pedal: null, bend: null
  };

  const PIANO = {
    id: 'demo-piano', title: 'Rain on Glass Street', artist: 'Finger Lickin Music', style: 'Piano solo', contentVersion: 1,
    key: { fifths: -1, mode: 'minor' }, tempo: [[1, 76], [29, 73], [30, 70], [31, 67], [32, 64]], meter: [[1, 4, 4]],
    sections: [{ label: 'Intro', bars: 4, dyn: -20 }, { label: 'A', bars: 8, dyn: -6 }, { label: 'B', bars: 8, dyn: 18 },
      { label: 'A2', bars: 8, dyn: 0 }, { label: 'Coda', bars: 4, dyn: -30 }],
    harmony: { Intro: 'Dm Bb Gm A', A: 'Dm Bb F C Gm Dm A A', B: 'Bb F Gm Dm Bb F Gm A',
      A2: 'Dm Bb F C Gm Dm A -', Coda: 'Dm Gm A Dm' },
    chords: {
      Dm: { root: 'D3', q: 'min', lh: 'D2.A2.D3.F3' }, Bb: { root: 'Bb2', lh: 'Bb1.F2.Bb2.D3' },
      F: { root: 'F2', lh: 'F2.C3.F3.A3' }, C: { root: 'C3', lh: 'C2.G2.C3.E3' },
      Gm: { root: 'G2', q: 'min', lh: 'G2.D3.G3.Bb3' }, A: { root: 'A2', lh: 'A1.E2.A2.C#3' }
    },
    drumVel: {},
    patterns: {
      lhIntro: { set: 'lh', vel: 66, gate: 1.0, notes: '1/q 2/q 3/q 4/q' },
      lhA: { set: 'lh', vel: 66, gate: 1.0, notes: '1/e 2/e 3/e 4/e 3/e 2/e 3/e 4/e' },
      lhB: { set: 'lh', vel: 66, gate: 1.0, notes: '1/q. 2/e 3/h' },
      lhCoda: { set: 'lh', vel: 66, gate: 1.0, notes: 'x/w' },
      rhIntro: { vel: 74, gate: 0.98, notes: 'r/w | r/w | A4/h. G4/q | A4/w |' },
      rhA: { vel: 74, gate: 0.98, notes: 'D5/q. C5/e A4/h | Bb4/q. A4/e F4/h | A4/q C5/q F5/q. E5/e | E5/h G4/h | ' +
        '_/q Bb4/q D5/q Bb4/q | A4/h F4/h | E4/q A4/q C#5/q E5/q | C#5/h. r/q |' },
      rhB: { vel: 74, gate: 0.98, notes: 'F5/q. D5/e Bb4/h | C5/q. A4/e F4/h | G4/q Bb4/q D5/q G5/q!112 | F5/h D5/h | ' +
        'D5/q. C5/e Bb4/q D5/q | C5/q A4/q F4/q A4/q | Bb4/h G4/h | A4/h. C#5/q |' },
      rhA2: { vel: 74, gate: 0.98, notes: 'D5/q. C5/e A4/h | Bb4/q. A4/e F4/h | A4/q C5/q F5/q. E5/e | E5/h G4/h | ' +
        '_/q Bb4/q D5/q Bb4/q | A4/h F4/h | E4/q A4/q C#5/q E5/q | r/w |' },
      rhCoda: { vel: 74, gate: 0.98, notes: 'D5/h A4/h | Bb4/h G4/h | A4/h C#5/h | D5/w!36 |' }
    },
    tracks: [
      { name: 'Piano', program: 0, channel: 0, slot: 0, preset: 'preset-sol',
        parts: { Intro: { layers: ['lhIntro', 'rhIntro'] }, A: { layers: ['lhA', 'rhA'] }, B: { layers: ['lhB', 'rhB'] },
          A2: { layers: ['lhA', 'rhA2'] }, Coda: { layers: ['lhCoda', 'rhCoda'] } } }
    ],
    cc: [], pedal: { track: 0, modes: { Intro: 'bar', A: 'bar', B: 'twoBars', A2: 'bar', Coda: 'bar' } }, bend: null
  };

  const ELECTRO = {
    id: 'demo-electro', title: 'Circuit Bloom', artist: 'Finger Lickin Music', style: 'Electronic', contentVersion: 1,
    key: { fifths: 0, mode: 'minor' }, tempo: [[1, 110]], meter: [[1, 4, 4]],
    sections: [{ label: 'Intro', bars: 8, h: 'cyc', dyn: -10 }, { label: 'Build', bars: 8, h: 'cyc', dyn: 0 },
      { label: 'Drop', bars: 16, h: 'cyc', dyn: 15 }, { label: 'Break', bars: 4, h: 'cyc', dyn: -15 },
      { label: 'Drop', bars: 8, h: 'cyc', p: 'Drop2', dyn: 15 }],
    harmony: { cyc: 'Am Am F F C C G G' },
    chords: {
      Am: { root: 'A1', q: 'min', pad: 'A3.C4.E4.G4', arp: 'A4.C5.E5.A5' },
      F: { root: 'F1', pad: 'F3.A3.C4.E4', arp: 'F4.A4.C5.F5' },
      C: { root: 'C2', pad: 'G3.C4.E4', arp: 'C5.E5.G5.C6' },
      G: { root: 'G1', pad: 'G3.B3.D4', arp: 'G4.B4.D5.G5' }
    },
    drumVel: { 36: 105, 38: 90, 39: 95, 42: 75, 46: 85, 49: 110, 70: 55 },
    patterns: {
      drIntroA: { grid: { 42: 'x.x.x.x.x.x.x.x.' } },
      drIntroB: { grid: { 36: 'x...x...x...x...', 42: 'x.x.x.x.x.x.x.x.' } },
      drBuild: { grid: { 36: 'x...x...x...x...', 39: '....x.......x...', 42: 'xxxxxxxxxxxxxxxx' } },
      drRoll: { grid: { 36: 'x...x...x...x...', 38: 'xxxxxxxxxxxxxxxx' } },
      drDrop: { grid: { 36: 'x...x...x...x...', 39: '....x.......x...', 46: '..x...x...x...x.' } },
      drDrop2: { grid: { 36: 'x...x...x...x...', 39: '....x.......x...', 46: '..x...x...x...x.', 70: '.x.x.x.x.x.x.x.x' } },
      bsW: { vel: 95, gate: 0.95, notes: 'R/w' },
      bsQ: { vel: 95, gate: 0.85, notes: 'R/q R/q R/q R/q' },
      bsDrop: { vel: 95, gate: 0.85, notes: 'r/e R/e r/e R/e r/e O/e r/e R/e' },
      arpE: { set: 'arp', vel: 80, gate: 0.8, notes: '1/e 2/e 3/e 4/e 1/e 2/e 3/e 4/e' },
      arpS: { set: 'arp', vel: 80, gate: 0.8, notes: '1/s 2/s 3/s 4/s 3/s 2/s 1/s 2/s 1/s 2/s 3/s 4/s 3/s 2/s 1/s 2/s' },
      padW: { set: 'pad', vel: 70, gate: 1.0, notes: 'x/w _/w' },
      ldDrop: { vel: 90, gate: 0.95, notes: 'E5/q. D5/e C5/q A4/q | C5/h~b A4/h | A4/q. G4/e A4/q C5/q | F4/w~b | ' +
        'G4/q. A4/e C5/q E5/q | G5/h E5/h | D5/q. C5/e B4/q D5/q | B4/h~b r/h |' }
    },
    tracks: [
      { name: 'Drums', drums: true, channel: 9, slot: 0, preset: 'preset-pixel', crash: true,
        parts: { Intro: [['drIntroA', 4], ['drIntroB', 4]], Build: [['drBuild', 7], ['drRoll', 1]], Drop: 'drDrop',
          Break: null, Drop2: 'drDrop2' } },
      { name: 'Synth Bass', program: 39, channel: 0, slot: 1, preset: 'preset-blue',
        parts: { Intro: [['rest', 4], ['bsW', 4]], Build: 'bsQ', Drop: 'bsDrop', Break: null, Drop2: 'bsDrop' } },
      { name: 'Arp', program: 80, channel: 1, slot: 2, preset: 'preset-nova',
        parts: { Intro: [['rest', 4], ['arpE', 4]], Build: 'arpE', Drop: 'arpS', Break: null, Drop2: 'arpS' } },
      { name: 'Pad', program: 88, channel: 2, slot: 3, preset: 'preset-ivy',
        parts: { Intro: 'padW', Build: 'padW', Drop: 'padW', Break: 'padW', Drop2: 'padW' } },
      { name: 'Lead', program: 81, channel: 3, slot: 4, preset: 'preset-riff',
        parts: { Intro: null, Build: null, Drop: 'ldDrop', Break: null, Drop2: 'ldDrop' } }
    ],
    cc: [{ track: 3, sections: ['Intro'], controller: 1, shape: 'set', value: 0 },
      { track: 3, sections: ['Build'], controller: 1, shape: 'ramp', from: 0, to: 100, everyTicks: 960 },
      { track: 3, sections: ['Drop'], controller: 1, shape: 'set', value: 100 },
      { track: 3, sections: ['Break'], controller: 1, shape: 'ramp', from: 100, to: 0, everyTicks: 960 }],
    pedal: null, bend: { track: 4, semis: 2 }
  };

  const JAZZ = {
    id: 'demo-jazz', title: 'Three Over Four', artist: 'Finger Lickin Music', style: 'Jazz trio', contentVersion: 1,
    key: { fifths: -1, mode: 'major' }, tempo: [[1, 150]],
    meter: [[1, 4, 4], [17, 3, 4], [25, 4, 4], [49, 3, 4], [57, 4, 4]],
    sections: [{ label: 'A1', bars: 8, h: 'A', p: 'A' }, { label: 'A2', bars: 8, h: 'A', p: 'A', crash: false },
      { label: 'B', bars: 8, h: 'B', p: 'B', crash: false }, { label: 'A3', bars: 8, h: 'A', p: 'A', crash: false },
      { label: 'Solo A1', bars: 8, h: 'A', p: 'SoloA', dyn: 5 },
      { label: 'Solo A2', bars: 8, h: 'A', p: 'SoloA', dyn: 5, crash: false },
      { label: 'Solo B', bars: 8, h: 'B', p: 'B', dyn: 5, crash: false },
      { label: 'Solo A3', bars: 8, h: 'End', p: 'End', crash: false }],
    harmony: { A: 'Fmaj7 Dm7 Gm7 C7 Am7,D7 Gm7,C7 Fmaj7 Gm7,C7', B: 'Bbmaj7 Bbmaj7 Am7 D7 Gm7 Gm7 C7 C7',
      End: 'Fmaj7 Dm7 Gm7 C7 Am7,D7 Gm7,C7 Fmaj7 Fmaj7' },
    chords: {
      Fmaj7: { root: 'F2', comp: 'A3.C4.E4.G4' }, Dm7: { root: 'D2', q: 'min', comp: 'F3.A3.C4.E4' },
      Gm7: { root: 'G2', q: 'min', comp: 'Bb3.D4.F4.A4' }, C7: { root: 'C2', comp: 'Bb3.D4.E4.A4' },
      Am7: { root: 'A2', q: 'min', comp: 'C4.E4.G4.B4' }, D7: { root: 'D2', comp: 'C4.E4.F#4.B4' },
      Bbmaj7: { root: 'Bb1', comp: 'D4.F4.A4.C5' }
    },
    drumVel: { 36: 25, 37: 70, 38: 30, 44: 60, 49: 100, 51: 75 },
    patterns: {
      compA: { set: 'comp', vel: 64, gate: 0.9, swing: true, notes: 'x/q. x/e r/q x/q' },
      compB: { set: 'comp', vel: 64, gate: 0.9, swing: true, notes: 'x/q r/q x/q' },
      melA: { vel: 80, gate: 0.9, swing: true, notes: 'C5/q A4/e C5/e r/e A4/e G4/q | F4/h r/h | ' +
        'D5/q Bb4/e D5/e r/e Bb4/e A4/q | G4/h. r/q | E5/q C5/e E5/e F#5/q D5/q | F5/q D5/e Bb4/e E5/q C5/q | ' +
        'A4/w | r/w |' },
      melAEnd: { vel: 80, gate: 0.95, swing: true, notes: 'C5/q A4/e C5/e r/e A4/e G4/q | F4/h r/h | ' +
        'D5/q Bb4/e D5/e r/e Bb4/e A4/q | G4/h. r/q | E5/q C5/e E5/e F#5/q D5/q | F5/q D5/e Bb4/e E5/q C5/q | ' +
        'A4/w | F4/w |' },
      melB: { vel: 80, gate: 0.9, swing: true, notes: 'D5/q F5/q A5/q | G5/h. | E5/q G5/q C5/q | F#5/h. | ' +
        'D5/q F5/q Bb4/q | A4/h. | E5/q G5/q Bb5/q | C5/h. |' },
      solA: { vel: 84, gate: 0.85, swing: true, notes: 'F4/e A4/e C5/e E5/e G5/e E5/e C5/e A4/e | ' +
        'D5/e C5/e A4/e F4/e E4/q r/q | G4/e Bb4/e D5/e F5/e A5/e F5/e D5/e Bb4/e | E5/e D5/e Bb4/e G4/e E4/h | ' +
        'C5/e E5/e G5/e E5/e F#5/e A5/e F#5/e D5/e | F5/e D5/e Bb4/e G4/e E5/e C5/e Bb4/e G4/e | ' +
        'A4/q C5/q E5/q G5/q | F5/h r/h |' },
      walkA: { vel: 85, gate: 0.9, notes: 'R/q T/q V/q A/q' },
      walkB: { vel: 85, gate: 0.9, notes: 'R/q F/q A/q' },
      drA: { step: 'e3', grid: { 51: 'x..x.xx..x.x', 44: '...x.....x..', 38: '.....g.....g', 36: 'f.....f.....' } },
      drSolo: { step: 'e3', grid: { 51: 'x..x.xx..x.x', 44: '...x.....x..', 38: '.....g.....g', 36: 'f.....f.....',
        37: '.........x..' } },
      drB: { step: 'e3', grid: { 51: 'x..x.xx.x', 44: '...x..x..', 36: 'f........' } }
    },
    tracks: [
      { name: 'Piano', program: 0, channel: 0, slot: 1, preset: 'preset-mo',
        parts: { A: { layers: ['compA', 'melA'] }, B: { layers: ['compB', 'melB'] },
          SoloA: { layers: ['compA', 'solA'] }, End: { layers: ['compA', 'melAEnd'] } } },
      { name: 'Acoustic Bass', program: 32, channel: 1, slot: 2, preset: 'preset-blue',
        parts: { A: 'walkA', B: 'walkB', SoloA: 'walkA', End: 'walkA' } },
      { name: 'Drums', drums: true, channel: 9, slot: 0, preset: 'preset-ace', crash: true,
        parts: { A: 'drA', B: 'drB', SoloA: 'drSolo', End: 'drSolo' } }
    ],
    cc: [], pedal: null, bend: null
  };

  const DANCE = {
    id: 'demo-dance', title: 'Four Floors Up', artist: 'Finger Lickin Music', style: 'Dance, 128 BPM', contentVersion: 1,
    key: { fifths: 1, mode: 'minor' }, tempo: [[1, 128]], meter: [[1, 4, 4]],
    sections: [{ label: 'Intro', bars: 8, h: 'cyc', dyn: -10 }, { label: 'Verse', bars: 16, h: 'cyc', dyn: 0 },
      { label: 'Build', bars: 8, h: 'cyc', dyn: 5 }, { label: 'Drop', bars: 16, h: 'cyc', dyn: 15 },
      { label: 'Outro', bars: 12, h: 'out', dyn: -5 }],
    harmony: { cyc: 'Em Em C C G G D D', out: 'Em Em C C G G D D Em Em Em Em' },
    chords: {
      Em: { root: 'E2', q: 'min', pad: 'E3.G3.B3', stab: 'E4.G4.B4' }, C: { root: 'C2', pad: 'E3.G3.C4', stab: 'E4.G4.C5' },
      G: { root: 'G2', pad: 'D3.G3.B3', stab: 'D4.G4.B4' }, D: { root: 'D2', pad: 'D3.F#3.A3', stab: 'D4.F#4.A4' }
    },
    drumVel: { 36: 110, 38: 85, 39: 95, 46: 80, 49: 110, 56: 75 },
    patterns: {
      drIn: { grid: { 36: 'x...x...x...x...', 46: '..x...x...x...x.' } },
      drV: { grid: { 36: 'x...x...x...x...', 46: '..x...x...x...x.', 39: '....x.......x...' } },
      drBuildA: { grid: { 36: 'x...x...x...x...', 38: 'x.x.x.x.x.x.x.x.' } },
      drBuildB: { grid: { 36: 'x...x...x...x...', 38: 'xxxxxxxxxxxxxxxx' } },
      drDrop: { grid: { 36: 'x...x...x...x...', 46: '..x...x...x...x.', 39: '....x.......x...',
        56: '...x.......x....' } },
      bsE: { vel: 95, gate: 0.8, notes: 'R/e R/e R/e R/e R/e R/e R/e R/e' },
      hook: { vel: 100, gate: 0.85, notes: 'E4/e G4/e B4/e r/e A4/e G4/e E4/q | D4/e E4/e G4/e r/e B4/q r/q |' },
      padW: { set: 'pad', vel: 70, gate: 1.0, notes: 'x/w _/w' },
      stab: { set: 'stab', vel: 90, gate: 0.5, notes: 'r/h r/q r/e x/e' }
    },
    tracks: [
      { name: 'Drums', drums: true, channel: 9, slot: 0, preset: 'preset-pixel', crash: true,
        parts: { Intro: 'drIn', Verse: 'drV', Build: [['drBuildA', 4], ['drBuildB', 4]], Drop: 'drDrop', Outro: 'drIn' } },
      { name: 'Synth Bass', program: 38, channel: 0, slot: 1, preset: 'preset-blue',
        parts: { Intro: null, Verse: 'bsE', Build: 'bsE', Drop: 'bsE', Outro: [['bsE', 8], ['rest', 4]] } },
      { name: 'Hook', program: 87, channel: 1, slot: 2, preset: 'preset-nova',
        parts: { Intro: null, Verse: null, Build: null, Drop: [['hook', 2, 0], ['hook', 2, 12]],
          Outro: [['hook', 2, 0], ['hook', 2, 12], ['hook', 2, 0], ['hook', 2, 12], ['rest', 4]] } },
      { name: 'Pad', program: 89, channel: 2, slot: 3, preset: 'preset-ivy',
        parts: { Intro: 'padW', Verse: 'padW', Build: 'padW', Drop: 'padW', Outro: 'padW' } },
      { name: 'Stab', program: 7, channel: 3, slot: 4, preset: 'preset-riff',
        parts: { Intro: null, Verse: 'stab', Build: null, Drop: 'stab', Outro: null } }
    ],
    cc: [{ track: 3, sections: ['Intro', 'Build', 'Outro'], controller: 11, shape: 'set', value: 127 },
      { track: 3, sections: ['Verse', 'Drop'], controller: 11, shape: 'beatDip' }],
    pedal: null, bend: null
  };

  const TUTORIAL_SONG = {
    id: 'tut-basics', title: 'First Steps', artist: 'Finger Lickin Music', style: 'Tutorial', contentVersion: 1,
    key: { fifths: 0, mode: 'major' }, tempo: [[1, 100]], meter: [[1, 4, 4]],
    sections: [{ label: 'Step 1', bars: 4, crash: false }, { label: 'Step 2', bars: 4, crash: false },
      { label: 'Step 3', bars: 4, crash: false }, { label: 'Record', bars: 4, crash: false }],
    harmony: {}, chords: {},
    drumVel: { 36: 70, 38: 70, 42: 55 },
    patterns: {
      tp1: { vel: 90, gate: 0.9, notes: 'C4/h C4/h' },
      tp2: { vel: 90, gate: 0.9, notes: '[C4.E4]/h [G4.C5]/h' },
      tp3: { vel: 90, gate: 0.85, notes: 'C4/q E4/q G4/e G4/e C5/q' },
      tdr: { grid: { 36: 'x.......x.......', 38: '....x.......x...', 42: 'x.x.x.x.x.x.x.x.' } }
    },
    tracks: [
      { name: 'Piano', program: 0, channel: 0, slot: 0, preset: 'preset-sol',
        parts: { 'Step 1': 'tp1', 'Step 2': 'tp2', 'Step 3': 'tp3', Record: null } },
      { name: 'Drums', drums: true, channel: 9, slot: 1, preset: 'preset-ace', crash: false,
        parts: { 'Step 1': 'tdr', 'Step 2': 'tdr', 'Step 3': 'tdr', Record: 'tdr' } }
    ],
    cc: [], pedal: null, bend: null
  };

  const CHARACTER_ROWS = [
    ['preset-ace', 'Ace', 'broad', 1.05, 'skin5', 'short', '#1b1b1b', 'face2', 'tank', '#c0392b', 'jeans', '#2d3a4a',
      'sneakers', '#f2f2f2', ['wristband'], 'energetic'],
    ['preset-blue', 'Blue', 'average', 1.08, 'skin2', 'long', '#3b2a1a', 'face1', 'shirt', '#2e5e8c', 'jeans', '#1f2833',
      'boots', '#4a3020', [], 'calm'],
    ['preset-riff', 'Riff', 'slim', 1.00, 'skin4', 'mohawk', '#d6336c', 'face3', 'jacket', '#222222', 'jeans', '#333a44',
      'boots', '#111111', ['scarf'], 'energetic'],
    ['preset-nova', 'Nova', 'slim', 0.95, 'skin6', 'curly', '#f5b041', 'face4', 'hoodie', '#7d3c98', 'shorts', '#2c3e50',
      'sneakers', '#ffffff', ['glasses'], 'normal'],
    ['preset-ivy', 'Ivy', 'average', 0.97, 'skin3', 'medium', '#6e2c00', 'face1', 'dress', '#16a085', 'none', '#000000',
      'sneakers', '#ecf0f1', [], 'normal'],
    ['preset-mo', 'Mo', 'broad', 1.02, 'skin7', 'none', '#000000', 'face2', 'shirt', '#f0e6d2', 'jeans', '#3e2723',
      'boots', '#5d4037', ['hat'], 'calm'],
    ['preset-pixel', 'Pixel', 'average', 0.92, 'skin1', 'short', '#48c9b0', 'face3', 'tee', '#1abc9c', 'shorts', '#34495e',
      'sneakers', '#ff9f43', ['headphones', 'wristband'], 'energetic'],
    ['preset-sol', 'Sol', 'slim', 1.04, 'skin8', 'long', '#0b0b0b', 'face4', 'jacket', '#8e44ad', 'skirt', '#2c2c54',
      'boots', '#2d2d2d', ['glasses'], 'calm']
  ];

  const CHARACTER_PRESETS = CHARACTER_ROWS.map((row) => ({ format: 'flm-character', version: 1, presetId: row[0],
    builtIn: true, character: { name: row[1], body: row[2], heightScale: row[3], skin: row[4],
      hair: { style: row[5], color: row[6] }, face: row[7], top: { style: row[8], color: row[9] },
      bottom: { style: row[10], color: row[11] }, shoes: { style: row[12], color: row[13] }, accessories: row[14],
      animationStyle: row[15], version: 1 } }));

  const TUTORIAL_STEPS = [
    { index: 1, id: 'tut-note', title: 'Trigger a note', kind: 'chart', segment: { fromBar: 0, bars: 4 },
      keyboardText: 'Press {lane0} when a circle reaches the line.',
      touchText: 'Tap the {lane0} pad when a circle reaches the line.', success: { minHits: 4 } },
    { index: 2, id: 'tut-two', title: 'Play two notes together', kind: 'chart', segment: { fromBar: 4, bars: 4 },
      keyboardText: 'Press {lane0} and {lane1} together, then {lane2} and {lane3} together.',
      touchText: 'Tap the {lane0} and {lane1} pads together, then the {lane2} and {lane3} pads.',
      success: { minChordHits: 4 } },
    { index: 3, id: 'tut-rhythm', title: 'Follow a simple rhythm', kind: 'chart', segment: { fromBar: 8, bars: 4 },
      keyboardText: 'Follow the rhythm: quarter, quarter, two quick ones, quarter.',
      touchText: 'Follow the rhythm: quarter, quarter, two quick ones, quarter.',
      success: { minHits: 8, minAccuracy: 0.60 } },
    { index: 4, id: 'tut-instrument', title: 'Pick a different instrument', kind: 'instrument',
      segment: { fromBar: 0, bars: 4, loop: true, drumsOnly: true },
      keyboardText: 'Choose another instrument, then play a few notes with {lane0} to {lane3}.',
      touchText: 'Choose another instrument, then tap a few pads.', success: { programChanged: true, minPresses: 2 } },
    { index: 5, id: 'tut-record', title: 'Record a short performance', kind: 'record', segment: { fromBar: 12, bars: 4 },
      keyboardText: 'Press Record, wait for the count-in, then play anything for four bars.',
      touchText: 'Tap Record, wait for the count-in, then tap the pads for four bars.', success: { minTakeNotes: 4 } },
    { index: 6, id: 'tut-import', title: 'Import a song', kind: 'import', segment: null,
      keyboardText: 'Imported files are checked before you play. Here is an example.',
      touchText: 'Imported files are checked before you play. Here is an example.',
      success: { playable: true, confirmed: true } },
    { index: 7, id: 'tut-next', title: 'Make music', kind: 'choose', segment: null,
      keyboardText: 'Open the Studio to build a song, or try Dance Mode.',
      touchText: 'Open the Studio to build a song, or try Dance Mode.', success: { choice: ['studio', 'dance', 'menu'] } }
  ];

  const ARRANGEMENT_LIST = [POPROCK, PIANO, ELECTRO, JAZZ, DANCE];

  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach((key) => deepFreeze(value[key]));
    }
    return value;
  }

  const ARRANGEMENTS = deepFreeze(ARRANGEMENT_LIST);
  deepFreeze(TUTORIAL_SONG);
  deepFreeze(CHARACTER_PRESETS);
  deepFreeze(TUTORIAL_STEPS);
  const TUTORIAL = deepFreeze({ arrangement: TUTORIAL_SONG, steps: TUTORIAL_STEPS, lanePitches: LANE_PITCHES,
    instruments: TUTORIAL_INSTRUMENTS });

  // ---------------------------------------------------------------------------------------------
  // Notation: the token grammar (6.30.4.1)
  // ---------------------------------------------------------------------------------------------
  const TOKEN = /^(r|_|x|[1-4]|[RTFOVA]|\[[A-G][#b]?\d(?:\.[A-G][#b]?\d)*\]|[A-G][#b]?\d)(?:\/([whqest](?:\.|3)?|\d+))?(?:!(\d+))?(~b)?$/;
  const CHORD_BRACKETS = /^\[(.*)\]$/;

  function contentError(code, text) {
    return new Error(code + ' ' + text);
  }

  function durationOf(text, owner) {
    if (/^\d+$/.test(text)) return Number(text);
    const base = NOTATION.DUR[text[0]];
    if (text.length === 1) return base;
    return text[1] === '.' ? Math.round(base * DOTTED) : Math.round(base * TRIPLET_NUMERATOR / TRIPLET_DENOMINATOR);
  }

  function noteNumber(name) {
    const midi = Theory.midiFromName(name);
    if (!Number.isInteger(midi) || midi < 0 || midi > MIDI_TOP) throw contentError('E-CNT-004', 'pitch ' + name);
    return midi;
  }

  /** Splits a melodic pattern into tokens: {kind, step, dur, vel, bend} or {kind:'bar'}; E-CNT-003 for an unknown token. */
  function parsePattern(text) {
    return String(text).split(/\s+/).filter((piece) => piece !== '').map((piece) => {
      if (piece === '|') return { kind: 'bar' };
      const match = TOKEN.exec(piece);
      if (!match) throw contentError('E-CNT-003', 'token ' + piece);
      const step = match[1];
      let kind = 'note';
      if (step === 'r') kind = 'rest';
      else if (step === '_') kind = 'tie';
      else if (step === 'x') kind = 'set';
      else if (/^[1-4]$/.test(step)) kind = 'nth';
      else if (/^[RTFOVA]$/.test(step)) kind = 'degree';
      else if (step[0] === '[') kind = 'chord';
      return { kind, step, dur: match[2], vel: match[3] === undefined ? null : Number(match[3]), bend: match[4] === '~b' };
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Expansion (6.30.4.2 and 6.30.4.3)
  // ---------------------------------------------------------------------------------------------
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  /** Bar starts and sizes: barTick[b] is the tick of 0-based bar b, barSize[b] its ticks, from the meter list. */
  function barLayout(arr, totalBars) {
    const barTick = [0];
    const barSize = [];
    const barBeat = [];
    let meter = arr.meter[0];
    let next = 0;
    for (let bar = 0; bar < totalBars; bar += 1) {
      if (next < arr.meter.length && arr.meter[next][0] === bar + 1) {
        meter = arr.meter[next];
        next += 1;
      }
      const beat = PPQ * 4 / meter[2];
      barBeat.push(beat);
      barSize.push(beat * meter[1]);
      barTick.push(barTick[bar] + barSize[bar]);
    }
    return { barTick, barSize, barBeat, meter };
  }

  function sectionIndex(arr) {
    let start = 0;
    return arr.sections.map((section) => {
      const entry = Object.assign({}, section, { startBar: start, h: section.h || section.label,
        p: section.p || section.label, dyn: section.dyn || 0 });
      start += section.bars;
      return entry;
    });
  }

  function voicing(arr, symbol, setName) {
    const chord = arr.chords[symbol];
    if (!chord || !chord[setName]) throw contentError('E-CNT-003', 'chord ' + symbol + ' set ' + setName);
    return chord[setName].split('.').map(noteNumber).sort((a, b) => a - b);
  }

  /** The chord segments of the whole song: [{from, to, symbol}] in tick order (symbol null = no chord). */
  function chordTimeline(arr, sections, layout) {
    const segments = [];
    sections.forEach((section) => {
      const tokens = (arr.harmony[section.h] || '').split(/\s+/).filter((piece) => piece !== '');
      for (let k = 0; k < section.bars; k += 1) {
        const bar = section.startBar + k;
        const from = layout.barTick[bar];
        const to = layout.barTick[bar + 1];
        if (tokens.length === 0) {
          segments.push({ from, to, symbol: null });
          continue;
        }
        const token = tokens[k % tokens.length];
        const parts = token.split(',');
        if (parts.length === 2) {
          const middle = from + layout.barSize[bar] / 2;
          segments.push({ from, to: middle, symbol: parts[0] }, { from: middle, to, symbol: parts[1] });
        } else {
          segments.push({ from, to, symbol: token === '-' ? null : token });
        }
      }
    });
    return segments;
  }

  function chordAt(segments, tick) {
    const found = segments.find((segment) => tick >= segment.from && tick < segment.to);
    return found ? found.symbol : null;
  }

  function checkSymbol(arr, symbol) {
    if (symbol !== null && !arr.chords[symbol]) throw contentError('E-CNT-003', 'chord ' + symbol);
    return symbol;
  }

  /** Pitches of one melodic token at tick `pos` with duration `dur`; [] when the step needs a chord that is missing. */
  function pitchesOf(arr, pattern, token, pos, dur, segments) {
    if (token.kind === 'note') return [noteNumber(token.step)];
    if (token.kind === 'chord') return CHORD_BRACKETS.exec(token.step)[1].split('.').map(noteNumber);
    const symbol = checkSymbol(arr, chordAt(segments, pos));
    if (symbol === null) return [];
    if (token.kind === 'set') return voicing(arr, symbol, pattern.set);
    if (token.kind === 'nth') {
      const notes = voicing(arr, symbol, pattern.set);
      const index = Number(token.step) - 1;
      if (index >= notes.length) throw contentError('E-CNT-003', 'voicing note ' + token.step + ' of ' + symbol);
      return [notes[index]];
    }
    return [bassPitch(arr, token.step, symbol, pos, dur, segments)];
  }

  function bassPitch(arr, degree, symbol, pos, dur, segments) {
    const chord = arr.chords[symbol];
    const root = noteNumber(chord.root);
    if (degree === 'R') return root;
    if (degree === 'T') return root + (chord.q === 'min' ? 3 : 4);
    if (degree === 'F') return root + 7;
    if (degree === 'O') return root + 12;
    if (degree === 'V') return chordAt(segments, pos - 1) !== symbol ? root : root + 7;
    const later = chordAt(segments, pos + dur);          // A: chromatic approach to the next chord
    return later === null ? root : noteNumber(arr.chords[checkSymbol(arr, later)].root) - 1;
  }

  function patternBars(pattern, ticksPerBar, id) {
    if (pattern.grid) return 1;
    const total = parsePattern(pattern.notes).reduce((sum, token) => {
      return token.kind === 'bar' ? sum : sum + durationOf(token.dur || pattern.step || 'q');
    }, 0);
    if (total % ticksPerBar !== 0) throw contentError('E-CNT-001', id + ' is not a whole number of bars');
    return total / ticksPerBar;
  }

  /** Renders one melodic pattern pass from t0; returns the note events (swing applied). */
  function renderMelodic(arr, id, pattern, t0, section, transpose, segments, channel, layout, notes) {
    const tokens = parsePattern(pattern.notes);
    const gate = pattern.gate === undefined ? DEFAULT_GATE : pattern.gate;
    const stepDur = pattern.step || 'q';
    const made = [];
    let pos = t0;
    let tied = null;                         // the events of the last sounding token and their running length
    tokens.forEach((token, index) => {
      if (token.kind === 'bar') {
        if (!layout.barTick.includes(pos)) throw contentError('E-CNT-001', id + ' at token ' + (index + 1));
        return;
      }
      const dur = durationOf(token.dur || stepDur);
      if (token.kind === 'rest') {
        tied = null;
      } else if (token.kind === 'tie') {
        if (tied) {
          tied.span += dur;
          tied.last = dur;
          const length = tied.span - tied.last + Math.max(1, Math.round(dur * gate));
          tied.events.forEach((event) => { event.durTicks = length; });
        }
      } else {
        const pitches = pitchesOf(arr, pattern, token, pos, dur, segments);
        const velocity = token.vel !== null ? token.vel : clamp((pattern.vel || DEFAULT_VELOCITY) + section.dyn, 1, MIDI_TOP);
        const events = pitches.map((pitch) => {
          const shifted = pitch + transpose;
          if (shifted < 0 || shifted > MIDI_TOP) throw contentError('E-CNT-004', 'pitch ' + shifted);
          return Model.Events.note(pos, Math.max(1, Math.round(dur * gate)), shifted, velocity, channel);
        });
        events.forEach((event) => { event.bend = token.bend; });
        made.push(...events);
        tied = events.length > 0 ? { events, span: dur, last: dur } : null;
      }
      pos += dur;
    });
    if (!layout.barTick.includes(pos)) throw contentError('E-CNT-001', id + ' ends inside a bar');
    if (pattern.swing) made.forEach(swingNote);
    notes.push(...made);
    return pos - t0;
  }

  function swingNote(event) {
    const start = event.tick;
    const end = start + event.durTicks;
    const start2 = start + (start % PPQ === EIGHTH ? SWING_SHIFT : 0);
    const end2 = end + (end % PPQ === EIGHTH ? SWING_SHIFT : 0);
    event.tick = start2;
    event.durTicks = Math.max(1, end2 - start2);
  }

  function barAt(layout, tick) {
    let bar = 0;
    while (bar + 1 < layout.barSize.length && layout.barTick[bar + 1] <= tick) bar += 1;
    return bar;
  }

  function drumVelocity(arr, key, character, section) {
    if (character === 'g') return GHOST_VELOCITY;
    if (character === 'f') return FEATHER_VELOCITY;
    const base = (arr.drumVel[key] === undefined ? DEFAULT_VELOCITY : arr.drumVel[key]) + section.dyn;
    return clamp(character === 'X' ? base + ACCENT_BOOST : base, 1, MIDI_TOP);
  }

  function renderDrums(arr, id, pattern, t0, section, channel, layout, notes) {
    const stepTicks = DRUM_STEP[pattern.step || 's'];
    const barSize = layout.barSize[barAt(layout, t0)];
    Object.keys(pattern.grid).forEach((key) => {
      const row = pattern.grid[key];
      if (row.length * stepTicks !== barSize) throw contentError('E-CNT-001', id + ' grid ' + key + ' length');
      for (let index = 0; index < row.length; index += 1) {
        if (row[index] === '.') continue;
        if (!'xXgf'.includes(row[index])) throw contentError('E-CNT-003', id + ' grid character ' + row[index]);
        notes.push(Model.Events.note(t0 + index * stepTicks, DRUM_NOTE_TICKS, Number(key),
          drumVelocity(arr, key, row[index], section), channel));
      }
    });
    return barSize;
  }

  /** One list entry [pattern, bars, transpose] placed from `t0`; returns the tick after it. */
  function renderEntry(arr, entry, t0, section, td, segments, layout, notes) {
    const id = entry[0];
    if (id === 'rest') return layout.barTick[barAt(layout, t0) + entry[1]];
    const pattern = arr.patterns[id];
    if (!pattern) throw contentError('E-CNT-003', 'pattern ' + id);
    const size = layout.barSize[barAt(layout, t0)];
    const length = patternBars(pattern, size, id);
    if (entry[1] % length !== 0) throw contentError('E-CNT-002', arr.id + '/' + td.name + '/' + section.label);
    let pos = t0;
    for (let pass = 0; pass < entry[1] / length; pass += 1) {
      if (pattern.grid) pos += renderDrums(arr, id, pattern, pos, section, td.channel, layout, notes);
      else pos += renderMelodic(arr, id, pattern, pos, section, entry[2] || 0, segments, td.channel, layout, notes);
    }
    return pos;
  }

  function normalizePart(arr, part, section, td, layout) {
    if (typeof part === 'string') {
      const pattern = arr.patterns[part];
      if (!pattern) throw contentError('E-CNT-003', 'pattern ' + part);
      const length = patternBars(pattern, layout.barSize[section.startBar], part);
      return [[part, length]];
    }
    return part;
  }

  function renderPart(arr, part, section, td, segments, layout, notes) {
    if (part && part.layers) {
      part.layers.forEach((layer) => renderPart(arr, layer, section, td, segments, layout, notes));
      return;
    }
    const list = normalizePart(arr, part, section, td, layout);
    const total = list.reduce((sum, entry) => sum + entry[1], 0);
    if (total === 0 || section.bars % total !== 0) throw contentError('E-CNT-002', arr.id + '/' + td.name + '/' + section.label);
    let tick = layout.barTick[section.startBar];
    for (let repeat = 0; repeat < section.bars / total; repeat += 1) {
      list.forEach((entry) => { tick = renderEntry(arr, entry, tick, section, td, segments, layout, notes); });
    }
  }

  // ---- controllers, pedal and bends (6.30.4.4)
  function ccEvents(arr, sections, layout, tracks) {
    const byTrack = tracks.map(() => []);
    arr.cc.forEach((def) => {
      const channel = tracks[def.track].channel;
      sections.forEach((section) => {
        if (def.sections !== 'all' && !def.sections.includes(section.label)) return;
        const a = layout.barTick[section.startBar];
        const b = layout.barTick[section.startBar + section.bars];
        const out = byTrack[def.track];
        if (def.shape === 'set') out.push(Model.Events.cc(a, def.controller, def.value, channel));
        else if (def.shape === 'ramp') {
          const count = (b - a) / def.everyTicks;
          for (let k = 0; k < count; k += 1) {
            out.push(Model.Events.cc(a + k * def.everyTicks, def.controller,
              Math.round(def.from + (def.to - def.from) * k / (count - 1)), channel));
          }
        } else {
          for (let bar = section.startBar; bar < section.startBar + section.bars; bar += 1) {
            for (let beat = layout.barTick[bar]; beat < layout.barTick[bar + 1]; beat += layout.barBeat[bar]) {
              DIP_VALUES.forEach((value, step) => out.push(Model.Events.cc(beat + step * DIP_SPACING, def.controller,
                value, channel)));
            }
          }
        }
      });
    });
    return byTrack;
  }

  function pedalEvents(arr, sections, layout, notes, channel, totalTicks) {
    const out = [];
    const startsIn = (from, to) => notes.some((note) => note.tick >= from && note.tick < to);
    sections.forEach((section) => {
      const mode = arr.pedal.modes[section.label] || 'none';
      const first = section.startBar;
      if (mode === 'none') {
        out.push(Model.Events.cc(layout.barTick[first], 64, 0, channel));
        return;
      }
      const span = mode === 'bar' ? 1 : 2;
      for (let k = 0; k < section.bars; k += span) {
        const from = layout.barTick[first + k];
        const to = layout.barTick[Math.min(first + k + span, first + section.bars)];
        out.push(Model.Events.cc(from, 64, 0, channel));
        if (startsIn(from, to)) out.push(Model.Events.cc(from + PEDAL_DELAY, 64, MIDI_TOP, channel));
      }
    });
    out.push(Model.Events.cc(totalTicks - PEDAL_END_BEFORE, 64, 0, channel));
    return out;
  }

  function bendEvents(notes, channel) {
    const out = [];
    notes.filter((note) => note.bend).forEach((note) => {
      const start = note.tick;
      const length = note.durTicks;
      out.push(Model.Events.bend(start, 0, channel));
      for (let k = 1; k <= BEND_STEPS; k += 1) {
        out.push(Model.Events.bend(start + Math.floor(length / 2) + Math.floor(k * length / 8),
          Math.round(BEND_PEAK * k / BEND_STEPS), channel));
      }
      out.push(Model.Events.bend(start + length, 0, channel));
    });
    return out;
  }

  /** Deterministic: the same arrangement always gives a deep-equal Song (ids included). */
  function expand(source) {
    const arr = typeof source === 'string' ? ARRANGEMENT_LIST.concat([TUTORIAL_SONG]).find((item) => item.id === source) : source;
    if (!arr) throw contentError('E-CNT-003', 'arrangement ' + source);
    const sections = sectionIndex(arr);
    const totalBars = sections.reduce((sum, section) => sum + section.bars, 0);
    const layout = barLayout(arr, totalBars);
    const totalTicks = layout.barTick[totalBars];
    const meterEntries = arr.meter.map((item) => ({ tick: layout.barTick[item[0] - 1], numerator: item[1], denominator: item[2] }));
    const tempoEntries = arr.tempo.map((item) => ({ tick: layout.barTick[item[0] - 1], usPerQuarter: Math.round(60e6 / item[1]) }));
    const song = Model.Song.create({ id: arr.id, title: arr.title, artist: arr.artist,
      source: { format: 'builtin', fileName: '', version: 'FLM content ' + arr.contentVersion, warnings: [] },
      tempoMap: new Model.TempoMap(tempoEntries), meterMap: new Model.MeterMap(meterEntries),
      keyMap: new Model.KeyMap([{ tick: 0, fifths: arr.key.fifths, mode: arr.key.mode }]),
      createdAt: NOTATION.CREATED_AT, modifiedAt: NOTATION.CREATED_AT });
    const segments = chordTimeline(arr, sections, layout);
    const controllers = ccEvents(arr, sections, layout, arr.tracks);
    arr.tracks.forEach((td, index) => {
      const track = Model.Track.create({ id: 't' + (index + 1).toString(MAX_TRACK_ID_RADIX), name: td.name,
        channel: td.channel, program: td.drums ? 0 : td.program, isDrums: Boolean(td.drums), lockedSource: true,
        color: Model.TRACK_COLORS[index % Model.TRACK_COLORS.length] }, song);
      const notes = [];
      sections.forEach((section) => {
        const part = td.parts[section.p];
        if (part) renderPart(arr, part, section, td, segments, layout, notes);
      });
      if (td.drums && td.crash) addCrashes(arr, td, sections, layout, notes);
      let events = notes.slice();
      if (!td.drums) events.push(Model.Events.program(0, td.program, 0, 0, td.channel));
      if (arr.bend && arr.bend.track === index) {
        [[101, 0], [100, 0], [6, arr.bend.semis], [38, 0]].forEach((pair) => {
          events.push(Model.Events.cc(0, pair[0], pair[1], td.channel));
        });
        events = events.concat(bendEvents(notes, td.channel));
      }
      events = events.concat(controllers[index]);
      if (arr.pedal && arr.pedal.track === index) events = events.concat(pedalEvents(arr, sections, layout, notes, td.channel, totalTicks));
      events.forEach((event) => { delete event.bend; });
      const sorted = Model.sortEvents(events);
      let ordinal = 0;
      sorted.forEach((event) => {
        if (event.kind !== 'note') return;
        ordinal += 1;
        event.id = track.id + '.' + ordinal.toString(MAX_TRACK_ID_RADIX);
      });
      track.idSeq = ordinal + 1;
      Model.replaceEvents(track, sorted);
      Model.Song.addTrack(song, track);
    });
    sections.forEach((section) => song.markers.push(Model.Marker.create(layout.barTick[section.startBar], section.label, 'section')));
    song.markers.push(Model.Marker.create(totalTicks, 'End', 'cue'));
    Model.computeDuration(song);
    const verdict = Model.validate(song);
    if (!verdict.ok) throw contentError('E-CNT-005', arr.id + ' ' + JSON.stringify(verdict.errors && verdict.errors[0]));
    return song;
  }

  function addCrashes(arr, td, sections, layout, notes) {
    sections.forEach((section) => {
      if (!td.parts[section.p] || section.crash === false) return;
      const tick = layout.barTick[section.startBar];
      if (notes.some((note) => note.pitch === CRASH_KEY && note.tick === tick)) return;
      notes.push(Model.Events.note(tick, DRUM_NOTE_TICKS, CRASH_KEY, drumVelocity(arr, CRASH_KEY, 'x', section), td.channel));
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Tutorial charts, catalog entries, statistics
  // ---------------------------------------------------------------------------------------------
  function tutorialChart(stepIndex, song) {
    const step = TUTORIAL_STEPS[stepIndex - 1];
    if (!step || step.kind !== 'chart') throw contentError('E-CNT-003', 'tutorial step ' + stepIndex);
    const layout = barLayout(TUTORIAL_SONG, sectionIndex(TUTORIAL_SONG).reduce((sum, section) => sum + section.bars, 0));
    const from = layout.barTick[step.segment.fromBar];
    const to = layout.barTick[step.segment.fromBar + step.segment.bars];
    const piano = song.tracks[0];
    const groups = new Map();
    piano.events.filter((event) => event.kind === 'note' && event.tick >= from && event.tick < to).forEach((event) => {
      if (!groups.has(event.tick)) groups.set(event.tick, []);
      groups.get(event.tick).push(event);
    });
    const notes = Array.from(groups.keys()).sort((a, b) => a - b).map((tick, index) => {
      const group = groups.get(tick);
      const lanes = group.map((event) => LANE_PITCHES.indexOf(event.pitch)).sort((a, b) => a - b);
      if (lanes.some((lane) => lane < 0)) throw contentError('E-CNT-003', 'tutorial pitch outside the lanes');
      return { id: 'c' + (index + 1).toString(MAX_TRACK_ID_RADIX), tick, durTicks: Math.max(...group.map((event) => event.durTicks)),
        isHold: false, lanes, sourceEventIds: group.map((event) => event.id), pitches: group.map((event) => event.pitch) };
    });
    const generator = FLM.Mapping && FLM.Mapping.ChartGenerator ? FLM.Mapping.ChartGenerator.VERSION : 1;
    return { id: 'tut-basics:step' + stepIndex, songId: 'tut-basics', trackId: 't1', instrument: 0, difficulty: 'beginner',
      profile: 'A', notes, generatorVersion: generator, settingsHash: Core.fnv1a32Hex('tutorial|' + stepIndex),
      omittedSourceEventIds: 0, source: 'imported' };
  }

  function meterLabel(arr) {
    const labels = [];
    arr.meter.forEach((item) => {
      const label = item[1] + '/' + item[2];
      if (!labels.includes(label)) labels.push(label);
    });
    return labels.join(', ');
  }

  // The playing time from the tempo and meter data alone, without expanding a single note.
  function durationSeconds(arr) {
    const sections = sectionIndex(arr);
    const totalBars = sections.reduce((sum, section) => sum + section.bars, 0);
    const layout = barLayout(arr, totalBars);
    const tempo = new Model.TempoMap(arr.tempo.map((item) => ({ tick: layout.barTick[item[0] - 1],
      usPerQuarter: Math.round(60e6 / item[1]) })));
    return { seconds: tempo.ticksToSeconds(layout.barTick[totalBars]), bars: totalBars };
  }

  function catalogEntryOf(arr) {
    const length = durationSeconds(arr);
    const tracks = arr.tracks.map((td, index) => ({ trackId: 't' + (index + 1).toString(MAX_TRACK_ID_RADIX), name: td.name,
      program: td.drums ? 0 : td.program, isDrums: Boolean(td.drums), slot: td.slot, preset: td.preset }));
    const firstMelodic = tracks.find((track) => !track.isDrums);
    const keys = tracks.find((track) => track.name === 'Keys');
    const presets = [null, null, null, null, null];
    tracks.forEach((track) => { presets[track.slot] = track.preset; });
    return { id: arr.id, kind: 'builtin', title: arr.title, artist: arr.artist, style: arr.style, contentVersion: VERSION,
      bpm: arr.tempo[0][1], keyName: Theory.keyName(arr.key.fifths, arr.key.mode), meterLabel: meterLabel(arr),
      bars: length.bars, durationS: length.seconds, tracks,
      defaultTrackId: arr.id === 'demo-poprock' && keys ? keys.trackId : firstMelodic.trackId, presetsBySlot: presets,
      expand: () => expand(arr) };
  }

  const list = () => ARRANGEMENT_LIST.map(catalogEntryOf);

  /** Counts for tests and the About screen: {notes, perTrack: {trackId: n}, durationS, ranges: {trackId: {lo, hi}}}. */
  function stats(song) {
    const perTrack = {};
    const ranges = {};
    let notes = 0;
    song.tracks.forEach((track) => {
      const pitches = track.events.filter((event) => event.kind === 'note').map((event) => event.pitch);
      perTrack[track.id] = pitches.length;
      notes += pitches.length;
      if (pitches.length > 0) ranges[track.id] = { lo: Math.min(...pitches), hi: Math.max(...pitches) };
    });
    return { notes, perTrack, durationS: song.tempoMap.ticksToSeconds(song.durationTicks), ranges };
  }

  // Load-time registration (Part 4.3 A4): the only side effect of this module. A failure leaves the catalog empty.
  function registerAtLoad() {
    try {
      if (FLM.Project && FLM.Project.Catalog) {
        FLM.Project.Catalog.registerBuiltin(list());
        FLM.Project.Catalog.registerTutorial(Object.assign({}, catalogEntryOf(TUTORIAL_SONG), { kind: 'tutorial', steps: TUTORIAL_STEPS }));
      }
      if (FLM.Character && typeof FLM.Character.registerPresets === 'function') FLM.Character.registerPresets(CHARACTER_PRESETS);
    } catch (error) {
      Core.Log.warn('content', 'registration failed: ' + (error && error.message ? error.message : String(error)));
    }
  }
  registerAtLoad();
  void STEP_TAIL;
  void SECONDS_ROUND;

  return Object.freeze({ VERSION, NOTATION, ARRANGEMENTS, TUTORIAL, CHARACTER_PRESETS, expand, parsePattern,
    tutorialChart, list, stats, durationSeconds });
});
})();
