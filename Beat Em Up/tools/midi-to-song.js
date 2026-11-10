/* Makes the title song's data block of breakpoint.html from the owner's MIDI file (the one source: music/hikari-samurai.mid).
   usage (from the Beat Em Up folder):
     node tools/midi-to-song.js            print the block
     node tools/midi-to-song.js --check    exit 1 unless the block in breakpoint.html is the one the .mid gives (and report the facts of the file)
     node tools/midi-to-song.js --write    replace the block in breakpoint.html (the file's line endings and BOM stay as they are)
   The song is stored as a table, not as the .mid bytes: every note of this file starts on a sixteenth (120 ticks) and lasts whole sixteenths,
   every velocity is 76, the pitch bends are all 0 and the rhythm guitar plays one chord shape (root, fifth, octave), so a note is three characters.
   Characters are base 64 digits (A-Z a-z 0-9 + /). Drums: one character per sixteenth, a bit per drum. Voices: 3 characters per onset =
   steps since the last onset, 2 * length in steps + 1 for the power chord, pitch - 24. */
'use strict';
const fs = require('fs');
const path = require('path');

const GAME_DIR = path.join(__dirname, '..');
const MIDI_FILE = path.join(GAME_DIR, 'music', 'hikari-samurai.mid');
const HTML_FILE = path.join(GAME_DIR, 'breakpoint.html');
const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const TICKS_PER_STEP = 120; // a sixteenth at 480 ticks per quarter
const DRUM_BITS = { 35: 1, 38: 2, 46: 4, 50: 8, 57: 16 }; // kick, snare, open hat, high tom, crash
const VOICES = [['rhythm', 2], ['lead', 3], ['high', 4], ['bass', 5]]; // [name, index of the track in the file]
const POWER_CHORD = [0, 7, 12];
const BEGIN = '// song-data:begin';
const END = '// song-data:end';

function readMidi(buffer) {
  let pos = 0;
  const u32 = () => { const v = buffer.readUInt32BE(pos); pos += 4; return v; };
  const u16 = () => { const v = buffer.readUInt16BE(pos); pos += 2; return v; };
  const vlq = () => { let value = 0, byte; do { byte = buffer[pos++]; value = (value << 7) | (byte & 127); } while (byte & 128); return value; };
  if (buffer.toString('latin1', 0, 4) !== 'MThd') throw new Error('not a MIDI file');
  pos = 4; const headLength = u32(); u16(); const trackCount = u16(), division = u16(); pos = 8 + headLength;
  const tracks = [];
  let tempo = 500000;
  for (let i = 0; i < trackCount; i++) {
    if (buffer.toString('latin1', pos, pos + 4) !== 'MTrk') throw new Error('track ' + i + ' is missing');
    pos += 4;
    const length = u32(), end = pos + length, notes = [], open = {};
    let tick = 0, status = 0, lastTick = 0;
    while (pos < end) {
      tick += vlq();
      let first = buffer[pos];
      if (first < 0x80) first = status; else { pos++; if (first < 0xF0) status = first; }
      if (first === 0xFF) { const type = buffer[pos++], length = vlq(); if (type === 0x51) tempo = buffer.readUIntBE(pos, 3); pos += length; }
      else if (first === 0xF0 || first === 0xF7) pos += vlq();
      else {
        const kind = first & 0xF0, a = buffer[pos++], b = kind === 0xC0 || kind === 0xD0 ? 0 : buffer[pos++];
        if (kind === 0x90 && b > 0) open[a] = { tick, velocity: b };
        else if (kind === 0x80 || (kind === 0x90 && b === 0)) { if (open[a]) { notes.push({ tick: open[a].tick, length: tick - open[a].tick, pitch: a, velocity: open[a].velocity }); delete open[a]; } }
      }
      lastTick = tick;
    }
    tracks.push({ notes, lastTick });
  }
  return { division, tempo, tracks };
}

function stepOf(ticks, what) {
  if (ticks % TICKS_PER_STEP !== 0) throw new Error(what + ' is not on the sixteenth grid: ' + ticks + ' ticks');
  return ticks / TICKS_PER_STEP;
}
const digit = (value, what) => { if (!(value >= 0 && value < 64 && Number.isInteger(value))) throw new Error(what + ' does not fit one digit: ' + value); return DIGITS[value]; };

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

function main() {
  const mode = process.argv[2] || '';
  const midi = readMidi(fs.readFileSync(MIDI_FILE)), song = build(midi), text = block(song);
  const facts = 'bpm ' + song.bpm + ', ' + song.steps + ' steps (' + (song.steps * 60 / song.bpm / 4) + ' s), notes: drums ' + song.drumNotes + ', ' + song.voices.map((v) => v[0] + ' ' + v[3]).join(', ') + '; block ' + text.length + ' characters';
  if (!mode) { console.log(text); return; }
  const raw = fs.readFileSync(HTML_FILE, 'utf8'), eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const start = raw.indexOf(BEGIN), finish = raw.indexOf(END);
  if (start < 0 || finish < start) throw new Error('the song-data markers are not in breakpoint.html');
  const current = raw.slice(start, finish + END.length).replace(/\r\n/g, '\n');
  if (mode === '--check') { console.log(facts); if (current !== text) { console.error('breakpoint.html holds other song data than the .mid gives (run with --write)'); process.exit(1); } console.log('breakpoint.html holds the data of the .mid'); return; }
  if (mode === '--write') {
    fs.writeFileSync(HTML_FILE, raw.slice(0, start) + text.replace(/\n/g, eol) + raw.slice(finish + END.length));
    console.log('written: ' + facts);
    return;
  }
  throw new Error('unknown option ' + mode);
}
main();
