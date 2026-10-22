// Joins src/shell.html and src/*.js (sorted by file name) into the single playable ClassTimeKiller.html.
// Also checks: duplicate top-level names across files, duplicated code blocks (DRY), banned network APIs.
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
const BANNED_APIS = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bimport\s*\(/, /new\s+WebSocket/, /navigator\.sendBeacon/, /\beval\s*\(/, /new\s+Function\s*\(/];

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
const body = sources.map((s) => '// ==== ' + s.name + ' ====\n' + s.text.trimEnd() + '\n').join('\n');
const script = "(() => {\n'use strict';\n" + body + '})();\n';
const html = shell.replace(SCRIPT_MARK, () => script);

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log('files ' + sources.length + ', lines ' + body.split('\n').length + ', size ' + kb + ' KB');
problems.forEach((p) => console.log('  ' + p));
if (problems.length) {
  console.log('BUILD FAILED: ' + problems.length + ' problem(s)');
  process.exit(1);
}
if (!checkOnly) writeFileSync(OUT, html);
console.log(checkOnly ? 'CHECK OK' : 'BUILD OK -> ClassTimeKiller.html');

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
    file.text.split('\n').forEach((line, index) => {
      const code = line.replace(/\/\/.*$/, '');
      for (const pattern of BANNED_APIS) {
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
