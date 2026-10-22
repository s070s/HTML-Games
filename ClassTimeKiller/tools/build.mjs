// Joins src/shell.html and src/*.js (sorted by file name) into the single playable ClassTimeKiller.html.
// Also checks: duplicate top-level names across files, duplicated code blocks (DRY), banned network APIs, Math.hypot in the
// per-frame and per-step files (PERF-006), the file size (D07: a warning above 3.0 MB, a failure above 3.5 MB).
// The shipped file leaves out comment-only lines and the // comments after code (about 13% of the size, less to parse on phones);
// src/ keeps them and the shipped code stays readable (no minifier, D06).
// Usage: node tools/build.mjs [--check]   (--check: run the checks and print the report, write nothing)
// No dependencies. Exit code 1 when a check fails.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'ClassTimeKiller.html');
const SCRIPT_MARK = '/*@@SCRIPT@@*/';
const DUP_WINDOW = 8;            // lines in a row that count as a duplicated block
const MIN_LINE_CHARS = 12;       // shorter lines (braces, "return;") never count toward a duplicate
const VALUE_EXPECTED = '(,=:[!&|?{};+-*%<>~^';   // after one of these a / starts a regex literal (withoutEndComment)
const SIZE_WARN_BYTES = 3.0 * 1024 * 1024;   // D07: past 3.0 MB the build warns (the release target is 3.5 MB)
const SIZE_LIMIT_BYTES = 3.5 * 1024 * 1024;  // D07: past 3.5 MB the build fails (readable code, comment-only lines stripped)
const BANNED_APIS = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bimport\s*\(/, /new\s+WebSocket/, /navigator\.sendBeacon/, /\beval\s*\(/, /new\s+Function\s*\(/];
// PERF-006: Math.hypot is a built-in call that boxes its result on every call; per-frame and per-step files use length2 / length3.
const HOT_FILES = /^(07[a-f]-render|08a-world|08b-world-collide|08c-world-triggers|08d-world-bodies|10a-move|11a-weapons|11b-projectiles|14a-bots|14b-bots-perception|14c-bots-move|14d-bots-combat|14e-bots-decide|14h-pve|14i-pve-enemies|17[a-g]-hud)/;
const HOT_BANNED_APIS = [/Math\.hypot\s*\(/];

const checkOnly = process.argv.includes('--check');
const problems = [];

const jsFiles = readdirSync(SRC).filter((name) => name.endsWith('.js')).sort();
const sources = jsFiles.map((name) => ({ name, text: readFileSync(join(SRC, name), 'utf8').replace(/\r\n/g, '\n') }));

checkTopLevelNames(sources);
checkBannedApis(sources);
const duplicates = findDuplicateBlocks(sources);
duplicates.forEach((d) => problems.push('DRY: ' + d));

const shell = readFileSync(join(SRC, 'shell.html'), 'utf8').replace(/\r\n/g, '\n');
if (!shell.includes(SCRIPT_MARK)) problems.push('shell.html has no ' + SCRIPT_MARK + ' marker');
const body = sources.map((s) => '// ==== ' + s.name + ' ====\n' + withoutCommentLines(s.text).trimEnd() + '\n').join('\n');
const script = "(() => {\n'use strict';\n" + body + '})();\n';
const html = shell.replace(SCRIPT_MARK, () => script);

const bytes = Buffer.byteLength(html), kb = (bytes / 1024).toFixed(1);
console.log('files ' + sources.length + ', lines ' + body.split('\n').length + ', size ' + kb + ' KB');
checkSize(bytes);
problems.forEach((p) => console.log('  ' + p));
if (problems.length) {
  console.log('BUILD FAILED: ' + problems.length + ' problem(s)');
  process.exit(1);
}
if (!checkOnly) writeFileSync(OUT, html);
console.log(checkOnly ? 'CHECK OK' : 'BUILD OK -> ClassTimeKiller.html');

// D07 size checkpoint: warn above 3.0 MB, fail above the 3.5 MB release target.
function checkSize(size) {
  const megabytes = (size / 1048576).toFixed(2) + ' MB';
  if (size > SIZE_LIMIT_BYTES) problems.push('size ' + megabytes + ' is over the ' + SIZE_LIMIT_BYTES / 1048576 + ' MB release limit (D07)');
  else if (size > SIZE_WARN_BYTES) console.log('  WARNING size ' + megabytes + ' is over ' + SIZE_WARN_BYTES / 1048576 + ' MB (D07 release limit ' + SIZE_LIMIT_BYTES / 1048576 + ' MB)');
}

// Drops lines that hold only a // comment. Safe only while no template literal spans lines, so that is checked here.
function withoutCommentLines(text) {
  let insideTemplate = false;
  const kept = text.split('\n').filter((line) => {
    const wasInside = insideTemplate;
    if ((line.match(/(?<!\\)`/g) || []).length % 2 === 1) insideTemplate = !insideTemplate;
    return wasInside || !/^\s*\/\//.test(line);
  });
  if (insideTemplate) problems.push('a template literal spans lines: comment stripping is not safe');
  return kept.map(withoutEndComment).join('\n');
}

// Cuts a " // comment" after code. It walks the line and skips strings and regex literals, so a // inside them stays;
// only a // with a space before it counts. A / starts a regex where a value is expected (at the line start or after one
// of VALUE_EXPECTED), else it is a division.
function withoutEndComment(line) {
  let quote = '', inRegex = false, inClass = false, previous = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote || inRegex) {
      if (char === '\\') { i++; continue; }
      if (quote && char === quote) quote = '';
      else if (inRegex && char === '[') inClass = true;
      else if (inRegex && char === ']') inClass = false;
      else if (inRegex && char === '/' && !inClass) inRegex = false;
      if (!quote && !inRegex) previous = 'a';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '/' && line[i + 1] === '/') return /\s/.test(line[i - 1] || '') ? line.slice(0, i).trimEnd() : line;
    if (char === '/') { inRegex = previous === '' || VALUE_EXPECTED.includes(previous); continue; }
    if (!/\s/.test(char)) previous = char;
  }
  return line;
}

// A name declared at column 0 in two files would be a load-time SyntaxError (or a silent override).
function checkTopLevelNames(files) {
  const owner = new Map();
  const declaration = /^(?:const|let|var|function\*?|class|async\s+function)\s+([A-Za-z_$][\w$]*)/;
  for (const file of files) {
    file.text.split('\n').forEach((line, index) => {
      const match = declaration.exec(line);
      if (!match) return;
      const name = match[1];
      if (owner.has(name)) problems.push('duplicate top-level name "' + name + '" in ' + file.name + ':' + (index + 1) + ' (first in ' + owner.get(name) + ')');
      else owner.set(name, file.name + ':' + (index + 1));
    });
  }
}

function checkBannedApis(files) {
  for (const file of files) {
    const banned = HOT_FILES.test(file.name) ? BANNED_APIS.concat(HOT_BANNED_APIS) : BANNED_APIS;
    file.text.split('\n').forEach((line, index) => {
      const code = line.replace(/\/\/.*$/, '');
      for (const pattern of banned) {
        if (pattern.test(code)) problems.push('banned API ' + pattern + ' in ' + file.name + ':' + (index + 1));
      }
    });
  }
}

// Reports every run of DUP_WINDOW meaningful lines that appears twice (whitespace-insensitive).
// Data rows (lines starting with "{" or "[" or a quote) are skipped: catalogues are similar by design.
function findDuplicateBlocks(files) {
  const seen = new Map();
  const reported = new Set();
  const found = [];
  for (const file of files) {
    const lines = file.text.split('\n').map((text, index) => ({ text: text.trim().replace(/\s+/g, ' '), number: index + 1 }));
    const meaningful = lines.filter((l) => l.text.length >= MIN_LINE_CHARS && !/^(\/\/|\*|\/\*|\{|\[|'|"|`)/.test(l.text));
    for (let i = 0; i + DUP_WINDOW <= meaningful.length; i++) {
      const window = meaningful.slice(i, i + DUP_WINDOW);
      const key = window.map((l) => l.text).join('\n');
      const here = file.name + ':' + window[0].number;
      const first = seen.get(key);
      if (!first) { seen.set(key, here); continue; }
      if (reported.has(here)) continue;
      reported.add(here);
      found.push('duplicated block at ' + here + ' (same as ' + first + ')');
      i += DUP_WINDOW - 1; // one report per duplicated block, not one per overlapping window
    }
  }
  return found;
}
