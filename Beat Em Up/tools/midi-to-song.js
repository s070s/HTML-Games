/* Makes the song data blocks of breakpoint.html from the owner's MIDI files in music/ (the files are the only source).
   usage (from the Beat Em Up folder):
     node tools/midi-to-song.js            print both blocks
     node tools/midi-to-song.js --check    exit 1 unless the blocks in breakpoint.html are the ones the .mid files give (and report the facts of every file)
     node tools/midi-to-song.js --write    replace the blocks in breakpoint.html (the file's line endings and BOM stay as they are)
   Two blocks, two formats, each between its own markers:
   1. song-data: the title song (music/hikari-samurai.mid, P18-60). Every note of this file starts on a sixteenth (120 ticks) and lasts whole sixteenths,
      every velocity is 76, the pitch bends are all 0 and the rhythm guitar plays one chord shape (root, fifth, octave), so a note is three characters.
      Characters are base 64 digits (A-Z a-z 0-9 + /). Drums: one character per sixteenth, a bit per drum. Voices: 3 characters per onset =
      steps since the last onset, 2 * length in steps + 1 for the power chord, pitch - 24.
   2. loops-data: the stage soundtrack (BP-P19-18), one entry of LOOPS per file, in rotation order; a fourth song is one more entry and a --write.
      Any chords, lengths (whole half sixteenths), pitches, velocities, several voices and a pitch wheel; the drums on channel 10 map to the game's drum voices.
      Notes: 8 digits = steps since the last note started, length in half sixteenths, pitch, velocity (2 digits each). Bends: 6 digits = ticks since the last bend, value 0-16383 (3 each).
   Anything a format cannot hold (an onset off the sixteenth grid, a length off the half grid, a tempo change, an unknown drum, a controller, a note
   that rings past the end of the loop, a bend left open at the end ...) stops the script with a message: nothing is rounded or dropped. */
'use strict';
const fs = require('fs');
const path = require('path');

const GAME_DIR = path.join(__dirname, '..');
const MUSIC_DIR = path.join(GAME_DIR, 'music');
const MIDI_FILE = path.join(MUSIC_DIR, 'hikari-samurai.mid');
const HTML_FILE = path.join(GAME_DIR, 'breakpoint.html');
const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const TICKS_PER_QUARTER = 480;
const TICKS_PER_STEP = 120; // a sixteenth at 480 ticks per quarter
const TICKS_PER_HALF_STEP = 60;
const DRUM_BITS = { 35: 1, 38: 2, 46: 4, 50: 8, 57: 16 }; // the title song: kick, snare, open hat, high tom, crash
const VOICES = [['rhythm', 2], ['lead', 3], ['high', 4], ['bass', 5]]; // [name, index of the track in the file]
const POWER_CHORD = [0, 7, 12];
const BEGIN = '// song-data:begin';
const END = '// song-data:end';

// The stage soundtrack, in the order of the rotation. voices: [role, index of the track in the file]; the drums are the track on channel 10. The title of the file (its first track's name) is the name of the loop:
// a stage whose name equals it (without a trailing "Loop") plays it when the rotation allows. Roles are the instruments the game has (LOOP_VOICES in breakpoint.html).
// melody: the level of the lead, chords and bass against the drums (1 = the instrument rows as they are); the three of the owner were set so that every loop is about as loud as the fight bed they replace (Appendix C, P19-18). A new file starts at 1.
const LOOPS = [
  { file: 'construction-site-loop.mid', voices: [['lead', 1], ['chords', 3], ['bass', 6]], melody: 1.8 },
  { file: 'parking-garage.mid', voices: [['lead', 1], ['chords', 3], ['bass', 6]], melody: 1 },
  { file: 'nightclub-loop.mid', voices: [['lead', 1], ['chords', 3], ['bass', 6]], melody: 0.6 },
];
const LOOP_ROLES = ['lead', 'chords', 'bass'];
const LOOP_DRUM_BITS = { 35: 1, 36: 1, 38: 2, 40: 2, 42: 32, 44: 32, 46: 4, 50: 8, 49: 16, 57: 16 }; // General MIDI: kicks, snares, closed hats, open hat, high tom, crashes -> the bits of the drum digit (1 kick, 2 snare, 4 open hat, 8 high tom, 16 crash, 32 closed hat)
const DRUM_CHANNEL = 9; // channel 10
const BEND_CENTER = 8192;
const BEND_MAX = 16383;
const DEFAULT_BEND_RANGE = 2; // semitones, the General MIDI default when the file sets none
const LOOP_BEGIN = '// loops-data:begin';
const LOOP_END = '// loops-data:end';
const CONTROLLERS = { 101: 'RPN', 100: 'RPN', 6: 'data entry', 38: 'data entry fine' };

function readMidi(buffer) {
  let pos = 0;
  const u32 = () => { const v = buffer.readUInt32BE(pos); pos += 4; return v; };
  const u16 = () => { const v = buffer.readUInt16BE(pos); pos += 2; return v; };
  const vlq = () => { let value = 0, byte; do { byte = buffer[pos++]; value = (value << 7) | (byte & 127); } while (byte & 128); return value; };
  if (buffer.toString('latin1', 0, 4) !== 'MThd') throw new Error('not a MIDI file');
  pos = 4; const headLength = u32(); u16(); const trackCount = u16(), division = u16(); pos = 8 + headLength;
  const tracks = [], tempoEvents = [], signatures = [];
  let tempo = 500000;
  for (let i = 0; i < trackCount; i++) {
    if (buffer.toString('latin1', pos, pos + 4) !== 'MTrk') throw new Error('track ' + i + ' is missing');
    pos += 4;
    const length = u32(), end = pos + length, notes = [], open = {}, bends = [], controllers = [], channels = new Set();
    let tick = 0, status = 0, lastTick = 0, name = '';
    while (pos < end) {
      tick += vlq();
      let first = buffer[pos];
      if (first < 0x80) first = status; else { pos++; if (first < 0xF0) status = first; }
      if (first === 0xFF) {
        const type = buffer[pos++], length = vlq();
        if (type === 0x03) name = buffer.toString('latin1', pos, pos + length);
        if (type === 0x51) { tempo = buffer.readUIntBE(pos, 3); tempoEvents.push({ tick, tempo }); }
        if (type === 0x58) signatures.push({ tick, numerator: buffer[pos], denominator: 1 << buffer[pos + 1] });
        pos += length;
      }
      else if (first === 0xF0 || first === 0xF7) pos += vlq();
      else {
        const kind = first & 0xF0, channel = first & 15, a = buffer[pos++], b = kind === 0xC0 || kind === 0xD0 ? 0 : buffer[pos++];
        if (kind === 0x90 && b > 0) { if (open[a]) throw new Error('track ' + i + ': pitch ' + a + ' starts again before it ends'); open[a] = { tick, velocity: b, channel }; channels.add(channel); }
        else if (kind === 0x80 || (kind === 0x90 && b === 0)) { if (open[a]) { notes.push({ tick: open[a].tick, length: tick - open[a].tick, pitch: a, velocity: open[a].velocity, channel: open[a].channel }); delete open[a]; } }
        else if (kind === 0xB0) controllers.push({ tick, number: a, value: b });
        else if (kind === 0xE0) bends.push({ tick, value: a | (b << 7) });
        else if (kind === 0xA0 || kind === 0xD0) throw new Error('track ' + i + ': pressure messages are not played');
      }
      lastTick = tick;
    }
    if (Object.keys(open).length) throw new Error('track ' + i + ': a note is never switched off');
    tracks.push({ name, notes, lastTick, bends, controllers, channels: [...channels] });
  }
  return { division, tempo, tempoEvents, signatures, tracks };
}

function stepOf(ticks, what) {
  if (ticks % TICKS_PER_STEP !== 0) throw new Error(what + ' is not on the sixteenth grid: ' + ticks + ' ticks');
  return ticks / TICKS_PER_STEP;
}
const digit = (value, what) => { if (!(value >= 0 && value < 64 && Number.isInteger(value))) throw new Error(what + ' does not fit one digit: ' + value); return DIGITS[value]; };
const digits = (value, count, what) => {
  if (!(value >= 0 && value < Math.pow(64, count) && Number.isInteger(value))) throw new Error(what + ' does not fit ' + count + ' digits: ' + value);
  let text = '';
  for (let i = count - 1; i >= 0; i--) text += DIGITS[Math.floor(value / Math.pow(64, i)) % 64];
  return text;
};

// --- 1. the title song (unchanged format)
function build(midi) {
  if (midi.division !== 480) throw new Error('480 ticks per quarter expected, found ' + midi.division);
  const bpm = Math.round(60000000 / midi.tempo);
  const steps = stepOf(Math.max(...midi.tracks.map((t) => t.lastTick)), 'the length');
  const drums = new Array(steps).fill(0);
  for (const n of midi.tracks[1].notes) {
    if (!DRUM_BITS[n.pitch]) throw new Error('a drum with no bit: ' + n.pitch);
    drums[stepOf(n.tick, 'a drum hit')] |= DRUM_BITS[n.pitch];
  }
  const voices = [];
  for (const [name, index] of VOICES) {
    const byStep = new Map();
    for (const n of midi.tracks[index].notes) {
      if (n.velocity !== 76) throw new Error(name + ': velocity ' + n.velocity + ' (the player plays every note at one level)');
      const step = stepOf(n.tick, name + ' note');
      if (!byStep.has(step)) byStep.set(step, []);
      byStep.get(step).push(n);
    }
    const onsets = [...byStep.keys()].sort((x, y) => x - y);
    let text = '', previous = onsets[0];
    for (const step of onsets) {
      const group = byStep.get(step).sort((x, y) => x.pitch - y.pitch), root = group[0].pitch, length = stepOf(group[0].length, name + ' length');
      const chord = group.length > 1;
      if (chord && (group.length !== POWER_CHORD.length || !group.every((n, i) => n.pitch === root + POWER_CHORD[i] && n.length === group[0].length))) throw new Error(name + ': a chord that is not a power chord at step ' + step);
      if (!chord && group.length !== 1) throw new Error(name + ': two notes at step ' + step);
      text += digit(step - previous, name + ' gap') + digit(2 * length + (chord ? 1 : 0), name + ' length') + digit(root - 24, name + ' pitch');
      previous = step;
    }
    voices.push([name, onsets[0], text, midi.tracks[index].notes.length]);
  }
  return { bpm, steps, drums: drums.map((mask) => digit(mask, 'a drum mask')).join(''), voices, drumNotes: midi.tracks[1].notes.length };
}

function block(song) {
  const lines = [
    BEGIN + ' (generated by tools/midi-to-song.js from music/hikari-samurai.mid: do not edit by hand)',
    'const SONG_DATA = {',
    '  bpm: ' + song.bpm + ', steps: ' + song.steps + ', // steps are sixteenths',
    '  drums: \'' + song.drums + '\', // a digit per step, a bit per drum: 1 kick, 2 snare, 4 open hat, 8 high tom, 16 crash',
    '  voices: [ // [name, step of the first onset, notes]: 3 digits per onset = steps since the last onset, 2 * length in steps + 1 for a power chord (root, fifth, octave), pitch - 24',
  ];
  for (const [name, first, text] of song.voices) lines.push('    [\'' + name + '\', ' + first + ', \'' + text + '\'],');
  lines.push('  ],', '};', END);
  return lines.join('\n');
}

// --- 2. the stage loops
// The pitch wheel range of a track in semitones: the data entry of RPN 0 (cents are not played), the General MIDI default of 2 without one
function bendRangeOf(track, label) {
  let selected = [127, 127], range = DEFAULT_BEND_RANGE;
  for (const { number, value } of track.controllers) {
    if (!CONTROLLERS[number]) throw new Error(label + ': controller ' + number + ' is not played (only the pitch range is read)');
    if (number === 101) selected[0] = value;
    else if (number === 100) selected[1] = value;
    else if (selected[0] === 0 && selected[1] === 0) {
      if (number === 6) range = value;
      else if (value !== 0) throw new Error(label + ': a pitch range in cents is not played');
    }
  }
  return range;
}

function loopTicksOf(midi, label) {
  if (midi.division !== TICKS_PER_QUARTER) throw new Error(label + ': ' + TICKS_PER_QUARTER + ' ticks per quarter expected, found ' + midi.division);
  if (midi.tempoEvents.length !== 1 || midi.tempoEvents[0].tick !== 0) throw new Error(label + ': exactly one tempo, set at the start, is played (found ' + midi.tempoEvents.length + ')');
  if (midi.signatures.length > 1) throw new Error(label + ': a change of the time signature is not played');
  const signature = midi.signatures[0] || { numerator: 4, denominator: 4 };
  const barTicks = signature.numerator * TICKS_PER_QUARTER * 4 / signature.denominator;
  if (!Number.isInteger(barTicks) || barTicks % TICKS_PER_STEP !== 0) throw new Error(label + ': a bar of ' + barTicks + ' ticks is not whole sixteenths');
  const lastTick = Math.max(...midi.tracks.map((track) => Math.max(track.lastTick, ...track.notes.map((n) => n.tick + n.length))));
  return { barTicks, ticks: Math.ceil(lastTick / barTicks) * barTicks, signature }; // the loop is the file's whole bars: the last bar may end in rests
}

function buildLoop(midi, entry) {
  const label = entry.file, { barTicks, ticks: loopTicks } = loopTicksOf(midi, label);
  const bpm = Math.round(60000000 / midi.tempo * 1000) / 1000;
  const used = new Set(entry.voices.map(([, index]) => index));
  entry.voices.forEach(([role, index]) => { if (!LOOP_ROLES.includes(role)) throw new Error(label + ': the role ' + role + ' has no instrument'); if (!midi.tracks[index]) throw new Error(label + ': there is no track ' + index); });
  const drumTracks = midi.tracks.map((track, index) => [track, index]).filter(([track]) => track.notes.some((n) => n.channel === DRUM_CHANNEL));
  if (drumTracks.length !== 1) throw new Error(label + ': one track of drums (channel 10) expected, found ' + drumTracks.length);
  const [drumTrack, drumIndex] = drumTracks[0];
  used.add(drumIndex);
  midi.tracks.forEach((track, index) => { if (track.notes.length && !used.has(index)) throw new Error(label + ': track ' + index + ' has notes and no role in LOOPS'); });
  const drums = new Array(loopTicks / TICKS_PER_STEP).fill(0), hits = new Set(drumTrack.notes.map((n) => n.velocity));
  if (hits.size > 1) throw new Error(label + ': the drums play at several velocities (' + [...hits].join(', ') + '): the kit plays every hit at one level');
  if (drumTrack.notes.some((n) => n.channel !== DRUM_CHANNEL)) throw new Error(label + ': the drum track has notes on another channel');
  for (const n of drumTrack.notes) {
    if (!LOOP_DRUM_BITS[n.pitch]) throw new Error(label + ': a drum with no voice: ' + n.pitch);
    drums[stepOf(n.tick, label + ' drum hit')] |= LOOP_DRUM_BITS[n.pitch];
  }
  const voices = [], counts = [];
  for (const [role, index] of entry.voices) {
    const track = midi.tracks[index], where = label + ' ' + role;
    if (track.channels.length > 1) throw new Error(where + ': notes on several channels (the pitch wheel is per channel)');
    if (track.channels[0] === DRUM_CHANNEL) throw new Error(where + ': a drum channel');
    const notes = track.notes.slice().sort((x, y) => x.tick - y.tick || x.pitch - y.pitch);
    let text = '', previous = 0;
    for (const n of notes) {
      if (!(n.velocity >= 1 && n.velocity <= 127)) throw new Error(where + ': velocity ' + n.velocity);
      if (n.length <= 0 || n.length % TICKS_PER_HALF_STEP !== 0) throw new Error(where + ': a length off the half sixteenth grid: ' + n.length + ' ticks at ' + n.tick);
      if (n.tick + n.length > loopTicks) throw new Error(where + ': a note rings past the end of the loop at ' + n.tick);
      const step = stepOf(n.tick, where + ' note');
      text += digits(step - previous, 2, where + ' gap') + digits(n.length / TICKS_PER_HALF_STEP, 2, where + ' length') + digits(n.pitch, 2, where + ' pitch') + digits(n.velocity, 2, where + ' velocity');
      previous = step;
    }
    const range = bendRangeOf(track, where), changes = [];
    for (const bend of track.bends.slice().sort((x, y) => x.tick - y.tick)) { // a later message at the same tick wins; one that changes nothing is left out
      if (bend.value > BEND_MAX) throw new Error(where + ': a bend value of ' + bend.value);
      if (bend.tick >= loopTicks) throw new Error(where + ': a bend after the end of the loop');
      if (changes.length && changes[changes.length - 1].tick === bend.tick) changes.pop();
      if (bend.value !== (changes.length ? changes[changes.length - 1].value : BEND_CENTER)) changes.push(bend);
    }
    if (changes.length && changes[changes.length - 1].value !== BEND_CENTER) throw new Error(where + ': the pitch wheel is left bent at the end of the loop (the loop would not be seamless)');
    let bendText = '', last = 0;
    for (const bend of changes) { bendText += digits(bend.tick - last, 3, where + ' bend gap') + digits(bend.value, 3, where + ' bend value'); last = bend.tick; }
    voices.push([role, text, bendText, changes.length ? range : 0]);
    counts.push(role + ' ' + notes.length + (changes.length ? ' (' + changes.length + ' bends, +-' + range + ' semitones)' : ''));
  }
  const melody = entry.melody === undefined ? 1 : entry.melody;
  if (!(melody >= 0.1 && melody <= 4)) throw new Error(label + ': melody ' + entry.melody + ' is not a level between 0.1 and 4');
  const name = midi.tracks[0].name;
  if (!name) throw new Error(label + ': the first track has no name (it is the name of the loop)');
  return { name, bpm, melody, steps: loopTicks / TICKS_PER_STEP, bars: loopTicks / barTicks, drums: drums.map((mask) => digit(mask, 'a drum mask')).join(''), voices, drumNotes: drumTrack.notes.length, counts };
}

function loopsBlock(loops) {
  const quote = (text) => '\'' + text + '\'';
  const lines = [
    LOOP_BEGIN + ' (generated by tools/midi-to-song.js from the files of LOOPS in that script, in that order: do not edit by hand)',
    '// name: the title in the file; bpm; steps: sixteenths (whole bars); melody: the level of the voices against the drums (LOOPS in that script); drums: a digit per step, a bit per drum (1 kick, 2 snare, 4 open hat, 8 high tom, 16 crash, 32 closed hat);',
    '// voices: [role, notes, bends, pitch wheel range in semitones]: a note is 8 digits = sixteenths since the last note began, length in half sixteenths, pitch, velocity (2 digits each);',
    '// a bend is 6 digits = ticks (480 to a quarter) since the last bend, wheel value 0 to 16383 (3 digits each; 8192 = none)',
    'const STAGE_TRACKS = [',
  ];
  for (const loop of loops) {
    lines.push('  {', '    name: ' + quote(loop.name) + ', bpm: ' + loop.bpm + ', steps: ' + loop.steps + ', melody: ' + loop.melody + ',', '    drums: ' + quote(loop.drums) + ',', '    voices: [');
    for (const [role, text, bends, range] of loop.voices) lines.push('      [' + quote(role) + ', ' + quote(text) + ', ' + quote(bends) + ', ' + range + '],');
    lines.push('    ],', '  },');
  }
  lines.push('];', LOOP_END);
  return lines.join('\n');
}

function replaceBlock(raw, begin, end, text, eol) {
  const start = raw.indexOf(begin), finish = raw.indexOf(end);
  if (start < 0 || finish < start) throw new Error('the ' + begin + ' markers are not in breakpoint.html');
  return { current: raw.slice(start, finish + end.length).replace(/\r\n/g, '\n'), next: raw.slice(0, start) + text.replace(/\n/g, eol) + raw.slice(finish + end.length) };
}

function main() {
  const mode = process.argv[2] || '';
  const midi = readMidi(fs.readFileSync(MIDI_FILE)), song = build(midi), text = block(song);
  const loops = LOOPS.map((entry) => buildLoop(readMidi(fs.readFileSync(path.join(MUSIC_DIR, entry.file))), entry)), loopText = loopsBlock(loops);
  const facts = ['bpm ' + song.bpm + ', ' + song.steps + ' steps (' + (song.steps * 60 / song.bpm / 4) + ' s), notes: drums ' + song.drumNotes + ', ' + song.voices.map((v) => v[0] + ' ' + v[3]).join(', ') + '; block ' + text.length + ' characters']
    .concat(loops.map((loop, i) => LOOPS[i].file + ' "' + loop.name + '": bpm ' + loop.bpm + ', ' + loop.bars + ' bars = ' + loop.steps + ' steps (' + (loop.steps * 60 / loop.bpm / 4).toFixed(3) + ' s), notes: drums ' + loop.drumNotes + ', ' + loop.counts.join(', ')))
    .concat('loops block ' + loopText.length + ' characters');
  if (!mode) { console.log(text + '\n' + loopText); return; }
  const raw = fs.readFileSync(HTML_FILE, 'utf8'), eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const intro = replaceBlock(raw, BEGIN, END, text, eol), withIntro = intro.next, stage = replaceBlock(withIntro, LOOP_BEGIN, LOOP_END, loopText, eol);
  if (mode === '--check') {
    console.log(facts.join('\n'));
    const before = replaceBlock(raw, LOOP_BEGIN, LOOP_END, loopText, eol).current;
    let failed = false;
    if (intro.current !== text) { console.error('breakpoint.html holds other title song data than the .mid gives (run with --write)'); failed = true; }
    if (before !== loopText) { console.error('breakpoint.html holds other stage loop data than the .mid files give (run with --write)'); failed = true; }
    if (failed) process.exit(1);
    console.log('breakpoint.html holds the data of the .mid files (title song and ' + loops.length + ' loops)');
    return;
  }
  if (mode === '--write') {
    fs.writeFileSync(HTML_FILE, stage.next);
    console.log('written:\n' + facts.join('\n'));
    return;
  }
  throw new Error('unknown option ' + mode);
}
main();
