// Joins src/shell.html and src/*.js (sorted by file name) into the single playable ClassTimeKiller.html, without the
// self-test blocks (20b-*), and into ClassTimeKiller.test.html with them, the page the test tools load (not committed).
// Also checks: duplicate top-level names across files, duplicated code blocks (DRY), banned network APIs, Math.hypot outside the
// cold files (PERF-006), the file size (D07: a warning above 3.0 MB, a failure above 3.5 MB), that the
// comment stripper keeps its known tricky lines whole and that the joined script parses.
// The shipped file leaves out blank and comment-only lines and the // comments after code and indents with tabs (about 15% of the size,
// less to parse on phones);
// src/ keeps them and the shipped code stays readable (no minifier, D06).
// Usage: node tools/build.mjs [--check]   (--check: run the checks and print the report, write nothing)
// No dependencies. Exit code 1 when a check fails.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'ClassTimeKiller.html');
const TEST_OUT = join(ROOT, 'ClassTimeKiller.test.html');
const TEST_FILES = /^20b-/;   // the test build split: the test blocks ship in the test build only; 20a (Test, window.__CTK) is in both
const SCRIPT_MARK = '/*@@SCRIPT@@*/';
const DUP_WINDOW = 8;            // lines in a row that count as a duplicated block
const MIN_LINE_CHARS = 12;       // shorter lines (braces, "return;") never count toward a duplicate
const VALUE_EXPECTED = '(,=:[!&|?{};+-*%<>~^';   // after one of these a / starts a regex literal (withoutEndComment)
// After one of these words a / starts a regex literal too (return /x/.test(s)), not a division.
const KEYWORD_BEFORE_VALUE = /(?:^|[^\w$.])(?:return|typeof|case|in|of|void|delete|else|do|yield|await|throw|new|instanceof)\s*$/;
// Lines withoutEndComment must give back as shown on the right: a wrong cut would ship broken code.
const STRIP_CASES = [
  ["if (ok) return /'/.test(s) ? 'a // b' : 'c';", "if (ok) return /'/.test(s) ? 'a // b' : 'c';"],
  ["z = typeof /re'/ + 'q // r'", "z = typeof /re'/ + 'q // r'"],
  ["w = x /* it's */ + 'u // v' // t", "w = x /* it's */ + 'u // v' // t"],
  [' * comment // with */ code();', ' * comment // with */ code();'],
  ['const half = total / 2; // half of it', 'const half = total / 2;'],
  ["const path = 'a//b'; // the string stays", "const path = 'a//b';"],
];
const SIZE_WARN_BYTES = 3.0 * 1024 * 1024;   // D07: past 3.0 MB the build warns (the release target is 3.5 MB)
const SIZE_LIMIT_BYTES = 3.5 * 1024 * 1024;  // D07: past 3.5 MB the build fails (readable code, comment-only lines stripped)
const BANNED_APIS = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bimport\s*\(/, /new\s+WebSocket/, /navigator\.sendBeacon/, /\beval\s*\(/, /new\s+Function\s*\(/];
// PERF-006: Math.hypot is a built-in call that boxes its result on every call; every file uses length2 / length3 except the
// cold ones named here (save, progress, maps, map generator, editor, menus, self-tests), which never run per frame or step.
const COLD_FILES = /^(04-save|15[a-d]-|16[a-z]-|18[a-z]-ui|20[ab]-)/;
const HOT_BANNED_APIS = [/Math\.hypot\s*\(/];

const checkOnly = process.argv.includes('--check');
const problems = [];
checkStripCases();

const jsFiles = readdirSync(SRC).filter((name) => name.endsWith('.js')).sort();
const sources = jsFiles.map((name) => ({ name, text: readFileSync(join(SRC, name), 'utf8').replace(/\r\n/g, '\n') }));

checkTopLevelNames(sources);
checkBannedApis(sources);
const duplicates = findDuplicateBlocks(sources);
duplicates.forEach((d) => problems.push('DRY: ' + d));

const shell = readFileSync(join(SRC, 'shell.html'), 'utf8').replace(/\r\n/g, '\n');
if (!shell.includes(SCRIPT_MARK)) problems.push('shell.html has no ' + SCRIPT_MARK + ' marker');
const html = joinedPage(sources.filter((s) => !TEST_FILES.test(s.name)));
const testHtml = joinedPage(sources);

const bytes = Buffer.byteLength(html), kb = (bytes / 1024).toFixed(1);
console.log('files ' + sources.length + ', size ' + kb + ' KB (test build ' + (Buffer.byteLength(testHtml) / 1024).toFixed(1) + ' KB)');
checkSize(bytes);
problems.forEach((p) => console.log('  ' + p));
if (problems.length) {
  console.log('BUILD FAILED: ' + problems.length + ' problem(s)');
  process.exit(1);
}
if (!checkOnly) { writeFileSync(OUT, html); writeFileSync(TEST_OUT, testHtml); }
console.log(checkOnly ? 'CHECK OK' : 'BUILD OK -> ClassTimeKiller.html, ClassTimeKiller.test.html');

// The page with these files' script in it (the script must parse).
function joinedPage(files) {
  const body = files.map((s) => '// ==== ' + s.name + ' ====\n' + withoutCommentLines(s.text).trimEnd() + '\n').join('\n');
  const script = "(() => {\n'use strict';\n" + body + '})();\n';
  checkParses(script);
  return shell.replace(SCRIPT_MARK, () => script);
}

// D07 size checkpoint: warn above 3.0 MB, fail above the 3.5 MB release target.
function checkSize(size) {
  const megabytes = (size / 1048576).toFixed(2) + ' MB';
  if (size > SIZE_LIMIT_BYTES) problems.push('size ' + megabytes + ' is over the ' + SIZE_LIMIT_BYTES / 1048576 + ' MB release limit (D07)');
  else if (size > SIZE_WARN_BYTES) console.log('  WARNING size ' + megabytes + ' is over ' + SIZE_WARN_BYTES / 1048576 + ' MB (D07 release limit ' + SIZE_LIMIT_BYTES / 1048576 + ' MB)');
}

// Drops blank lines and lines that hold only a // comment, and ships each two spaces of leading indentation as one tab (about 70 KB less,
// still readable). A line inside a template literal that spans lines is text, so it stays exactly as written.
function withoutCommentLines(text) {
  let insideTemplate = false;
  const kept = [];
  for (const line of text.split('\n')) {
    const wasInside = insideTemplate;
    if ((line.match(/(?<!\\)`/g) || []).length % 2 === 1) insideTemplate = !insideTemplate;
    if (wasInside) kept.push(line);
    else if (!/^\s*(\/\/.*)?$/.test(line)) kept.push(withTabIndent(withoutEndComment(line)));
  }
  if (insideTemplate) problems.push('a template literal is never closed: comment stripping is not safe');
  return kept.join('\n');
}

function withTabIndent(line) {
  return line.replace(/^(?: {2})+/, (indent) => '\t'.repeat(indent.length / 2));
}

// Cuts a " // comment" after code. It walks the line and skips strings and regex literals, so a // inside them stays;
// only a // with a space before it counts. A / starts a regex where a value is expected (at the line start, after one
// of VALUE_EXPECTED or after a KEYWORD_BEFORE_VALUE word), else it is a division. A line that opens or sits inside a
// block comment (/* or a leading *) stays whole: a cut there could drop the */ and the code after it.
function withoutEndComment(line) {
  if (line.includes('/*') || /^\s*\*/.test(line)) return line;
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
    if (char === '/') { inRegex = previous === '' || VALUE_EXPECTED.includes(previous) || KEYWORD_BEFORE_VALUE.test(line.slice(0, i)); continue; }
    if (!/\s/.test(char)) previous = char;
  }
  return line;
}

function checkStripCases() {
  for (const [line, expected] of STRIP_CASES) {
    const got = withoutEndComment(line);
    if (got !== expected) problems.push('comment stripper cut "' + line + '" to "' + got + '"');
  }
}

// The shipped script must compile: a wrong cut would otherwise show only as a blank or fatal page (PLT-002).
function checkParses(code) {
  try { new Script(code, { filename: 'ClassTimeKiller.html' }); } catch (error) { problems.push('the joined script does not parse: ' + error.message); }
}

// A name declared at column 0 in two files would be a load-time SyntaxError (or a silent override). One declaration per
// line: a second one after a ; would escape the column-0 match.
function checkTopLevelNames(files) {
  const owner = new Map();
  const declaration = /^(?:const|let|var|function\*?|class|async\s+function)\s+([A-Za-z_$][\w$]*)/;
  for (const file of files) {
    file.text.split('\n').forEach((line, index) => {
      const match = declaration.exec(line);
      if (!match) return;
      if (/;\s*(?:const|let|var|function|class)\s/.test(outsideBrackets(line))) problems.push('two top-level declarations on one line in ' + file.name + ':' + (index + 1));
      const name = match[1];
      if (owner.has(name)) problems.push('duplicate top-level name "' + name + '" in ' + file.name + ':' + (index + 1) + ' (first in ' + owner.get(name) + ')');
      else owner.set(name, file.name + ':' + (index + 1));
    });
  }
}

// The line without its strings and bracketed parts: what stays is the line's top level.
function outsideBrackets(line) {
  let depth = 0, quote = '', kept = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quote = char;
    else if ('([{'.includes(char)) depth++;
    else if (')]}'.includes(char)) depth--;
    else if (depth === 0) kept += char;
  }
  return kept;
}

function checkBannedApis(files) {
  for (const file of files) {
    const banned = COLD_FILES.test(file.name) ? BANNED_APIS : BANNED_APIS.concat(HOT_BANNED_APIS);
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
