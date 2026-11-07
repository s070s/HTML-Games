/* Picks the self-tests a change touches, so a task can run those instead of all of them (tools/run-tests.js --affected).
   usage: node tools/affected-tests.js [base]     prints the picked test names (base: a commit; default where HEAD left main)
   How it picks, from git diff base (committed and uncommitted changes) of breakpoint.html and breakpoint-tests.js:
   1. The words of every changed line of the game (names, level and item ids, keys; comments left out) and the names of the
      functions, methods, objects and level rows those lines sit in. Only rare words pick: a word of a line in at most
      WORD_MAX_SHARE of the tests, a definition name in at most OWNER_MAX_SHARE (common words such as window or objects would
      pick almost every test).
   2. Every test whose own lines changed in breakpoint-tests.js; a changed shared helper picks its callers, and changed shared
      code with no usable name (the SelfTest methods, the test wrapper, a two-letter helper) picks every test.
   3. Every test whose text holds one of those words. A shared helper of the test file (a const or function between the tests)
      whose text holds one passes its own name on, so the tests that call the helper are picked too.
   4. When the game changed: the determinism and fingerprint tests, because any change in the simulation can move them.
   It is a fast first check, not proof: the full run (Chrome) stays the gate before a merge. */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

const GAME_DIR = process.env.BREAKPOINT_DIR || path.join(__dirname, '..');   // the Beat Em Up folder; BREAKPOINT_DIR points at another copy (a worktree)
const GAME_FILE = 'breakpoint.html';
const TEST_FILE = 'breakpoint-tests.js';
const WORD_MAX_SHARE = 0.03;        // a word of a changed line picks only if at most this share of the tests holds it
const OWNER_MAX_SHARE = 0.05;       // the same for the name of the definition a changed line sits in
const MIN_WORD_LENGTH = 3;          // level ids such as pit and gym are three letters
const OWNER_SCAN_LINES = 400;       // how far up a changed line looks for the definition it sits in
const HELPER_PASSES = 3;            // helpers that call helpers: this many rounds of passing names on
const TEST_START = /^\s*test\('((?:[^'\\]|\\.)*)'/;
const RUN_ALL_INDENT = 4;           // the tests and their shared helpers sit four spaces in, inside run_all
const HELPER_DECLARATION = /^ {4}(?:const|let|function)\s+([A-Za-z_$][\w$]*)/;
const RUN_ALL_START = /^ {2}run_all\(/;
const GUARD_TEST = /fingerprint\(|^\s*test\('Deterministic simulation/;
const WORD = /[A-Za-z_$][\w$]*/g;
const IGNORED_WORDS = new Set(('this that then than with from into const function return true false null undefined else case break '
  + 'continue typeof instanceof while for new let var class extends static async await default switch delete void yield length push '
  + 'slice splice filter map some every forEach reduce join split concat indexOf includes keys values entries assign floor round '
  + 'ceil abs min max sqrt Math Object Array String Number JSON test when only each name '
  + 'the and not if do try catch are but all any one two has its was out off get set add sum key row col end run '
  + 'top low mid lap hit dir pos val obj arr str num len idx tmp res err bad got want ok').split(' '));
// Lines that name the definition they open: function f(, const X =, Obj.method = function, method(...) {, key: {, key: (
const OWNER_PATTERNS = [
  /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
  /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/,
  /^\s*class\s+([A-Za-z_$][\w$]*)/,
  /^\s+(?:static\s+|async\s+|get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/,
  /^\s+([A-Za-z_$][\w$]*)\s*:\s*(?:\{|\[|function|\(|[A-Za-z_$][\w$]*\s*=>)/,
];

function git(args) {
  return execFileSync('git', args, { cwd: GAME_DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function defaultBase() {
  try { return git(['merge-base', 'HEAD', 'main']).trim(); } catch (error) { return 'HEAD'; }
}

// The text of a file at a commit, as lines (empty when the file did not exist there)
function linesAt(commit, file) {
  try { return git(['show', commit + ':./' + file]).replace(/\r\n/g, '\n').split('\n'); } catch (error) { return []; }
}

function linesNow(file) {
  return require('fs').readFileSync(path.join(GAME_DIR, file), 'utf8').replace(/\r\n/g, '\n').split('\n');
}

/* Changed line numbers of a file since base (1-based): removed (old file), added (new file), and hunks, each
   { removed: [...], added: [...] } for one changed place */
function changedLines(base, file) {
  const diff = git(['diff', '-U0', '--no-color', '--no-ext-diff', base, '--', file]);
  const hunks = [];
  for (const line of diff.split('\n')) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!header) continue;
    const oldStart = Number(header[1]), oldCount = header[2] === undefined ? 1 : Number(header[2]);
    const newStart = Number(header[3]), newCount = header[4] === undefined ? 1 : Number(header[4]);
    const hunk = { removed: [], added: [], at: newStart };   // at: where a hunk that only deletes lines sits in the new file
    for (let k = 0; k < oldCount; k++) hunk.removed.push(oldStart + k);
    for (let k = 0; k < newCount; k++) hunk.added.push(newStart + k);
    hunks.push(hunk);
  }
  return { hunks, removed: hunks.flatMap((h) => h.removed), added: hunks.flatMap((h) => h.added) };
}

// The words one changed place really changed: those whose count differs between its old and its new lines
function changedWords(oldText, newText) {
  const count = (text) => wordsOf(text).reduce((counts, word) => counts.set(word, (counts.get(word) || 0) + 1), new Map());
  const before = count(oldText), after = count(newText);
  const changed = [];
  new Set([...before.keys(), ...after.keys()]).forEach((word) => { if (before.get(word) !== after.get(word)) changed.push(word); });
  return changed;
}

function wordsOf(text) {
  return (text.match(WORD) || []).filter((word) => word.length >= MIN_WORD_LENGTH && !IGNORED_WORDS.has(word));
}

/* The lines with their comments blanked out (block comments across lines, line comments), strings kept: comment prose would
   match almost every test. A '/' that opens a regex literal is read as code; a regex that ends in an escaped slash (\/) is not
   taken for a line comment. */
function codeOnly(lines) {
  let inBlock = false;
  return lines.map((line) => {
    let out = '', quote = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i], pair = line.slice(i, i + 2);
      if (inBlock) { if (pair === '*/') { inBlock = false; i++; } continue; }
      if (quote) { out += ch; if (ch === '\\') { out += line[i + 1] || ''; i++; } else if (ch === quote) quote = ''; continue; }
      if (pair === '/*') { inBlock = true; i++; continue; }
      if (pair === '//' && line[i - 1] !== '\\') break;
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      out += ch;
    }
    return out;
  });
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

// The names of the definitions a line sits in: the nearest one less indented than the line, and the top-level one
function ownersOf(lines, index) {
  const ownerAt = (i) => OWNER_PATTERNS.map((pattern) => pattern.exec(lines[i] || '')).find(Boolean);
  const names = [];
  const own = ownerAt(index);   // a changed line that opens a definition names it
  if (own) names.push(...own.slice(1).filter(Boolean));
  let indent = indentOf(lines[index] || '');
  for (let i = index - 1; i >= 0 && i > index - OWNER_SCAN_LINES && indent > 0; i--) {
    const line = lines[i];
    if (!line.trim() || indentOf(line) >= indent) continue;   // only a less indented line can enclose this one
    const owner = ownerAt(i);
    if (!owner) continue;
    names.push(...owner.slice(1).filter(Boolean));
    indent = indentOf(line);
  }
  return names;
}

/* The end of a statement that starts at run_all level (four spaces in) on line start: the line that closes it at that level
   with }, ) or ], or the line before the next statement at that level. */
function statementEnd(code, start) {
  for (let i = start + 1; i < code.length; i++) {
    const text = code[i].trim();
    if (!text || indentOf(code[i]) > RUN_ALL_INDENT) continue;
    return '})]'.includes(text[0]) ? i : i - 1;
  }
  return code.length - 1;
}

/* The test file cut into pieces inside run_all: tests ({ name, first, last, words, text } with 1-based lines) and the shared
   helpers between them ({ name, first, last, words }); firstLine is the 1-based line where run_all starts (code above it, the
   SelfTest methods and the file's own helpers, is shared by every test) */
function testPieces(lines) {
  const code = codeOnly(lines);
  const tests = [], helpers = [];
  const runAll = lines.findIndex((line) => RUN_ALL_START.test(line));
  for (let i = runAll + 1; runAll >= 0 && i < lines.length; i++) {
    const start = TEST_START.exec(lines[i]);
    const helper = start ? null : HELPER_DECLARATION.exec(code[i]);
    if (!start && !helper) continue;
    const end = statementEnd(code, i);
    const body = code.slice(i, end + 1);
    if (start) body[0] = body[0].replace(TEST_START, '');   // the test's own name is prose, not code
    const piece = { first: i + 1, last: end + 1, words: new Set(wordsOf(body.join('\n'))), text: lines.slice(i, end + 1).join('\n') };
    if (start) tests.push(Object.assign(piece, { name: start[1].replace(/\\'/g, "'") }));
    else helpers.push(Object.assign(piece, { name: helper[1] }));
    i = Math.max(i, end);
  }
  return { tests, helpers, firstLine: runAll + 1 };
}

function pickAffected(options) {
  const base = (options && options.base) || defaultBase();
  const testLines = linesNow(TEST_FILE);
  const { tests: blocks, helpers } = testPieces(testLines);
  const picked = new Map();   // test name -> why
  const pick = (block, why) => { if (!picked.has(block.name)) picked.set(block.name, why); };

  // 1. words of the changed game lines and the definitions they sit in
  const game = changedLines(base, GAME_FILE);
  const oldGame = game.removed.length ? codeOnly(linesAt(base, GAME_FILE)) : [];
  const newGame = game.added.length ? codeOnly(linesNow(GAME_FILE)) : [];
  const lineWords = new Set(), owners = new Set();
  const textOf = (lines, numbers) => numbers.map((n) => lines[n - 1] || '').join('\n');
  for (const hunk of game.hunks) {
    changedWords(textOf(oldGame, hunk.removed), textOf(newGame, hunk.added)).forEach((w) => lineWords.add(w));
    hunk.removed.forEach((n) => wordsOf(ownersOf(oldGame, n - 1).join(' ')).forEach((w) => owners.add(w)));   // wordsOf drops if, for and short names
    hunk.added.forEach((n) => wordsOf(ownersOf(newGame, n - 1).join(' ')).forEach((w) => owners.add(w)));
  }
  const testsHolding = (word) => blocks.filter((block) => block.words.has(word)).length;
  const isRare = (word, maxShare) => testsHolding(word) <= blocks.length * maxShare;
  const words = new Set(), tooCommon = [];
  const keepRare = (word, maxShare) => { if (isRare(word, maxShare)) words.add(word); else tooCommon.push(word); };
  owners.forEach((word) => keepRare(word, OWNER_MAX_SHARE));
  lineWords.forEach((word) => { if (!words.has(word)) keepRare(word, WORD_MAX_SHARE); });

  /* 2. a changed line of the test file: a test is picked itself, a shared helper passes its name on (all its callers run);
     shared code with no usable name (the SelfTest methods, the test wrapper, a helper named mk) picks every test */
  const tests = changedLines(base, TEST_FILE);
  const testCode = codeOnly(testLines);
  const inside = (piece, n) => n >= piece.first && n <= piece.last;
  let sharedCodeChanged = false;
  for (const hunk of tests.hunks) {
    const numbers = hunk.added.length ? hunk.added : [hunk.at, hunk.at + 1];   // a deletion counts at the lines around it
    for (const n of numbers) {
      const block = blocks.find((b) => inside(b, n));
      const helper = block ? null : helpers.find((h) => inside(h, n));
      if (block) pick(block, 'test changed');
      else if (helper && wordsOf(helper.name).length) words.add(helper.name);
      else if ((testCode[n - 1] || '').trim() || !hunk.added.length) sharedCodeChanged = true;
    }
  }
  if (sharedCodeChanged) blocks.forEach((block) => pick(block, 'shared test code changed'));

  // 3. a helper that holds a word passes its name on (helpers that call helpers: a few rounds), then every test that holds a word
  for (let pass = 0; pass < HELPER_PASSES; pass++) {
    const passing = [...words].filter((word) => !lineWords.has(word) || owners.has(word));   // a long helper holds many plain words: only definition and helper names pass on
    const grown = helpers.filter((h) => !words.has(h.name) && passing.some((word) => h.words.has(word)) && isRare(h.name, OWNER_MAX_SHARE));
    grown.forEach((h) => words.add(h.name));
    if (!grown.length) break;
  }
  for (const block of blocks) {
    const hit = [...words].find((word) => block.words.has(word));
    if (hit) pick(block, 'uses ' + hit);
  }

  // 4. the determinism and fingerprint tests whenever the game changed
  if (game.removed.length || game.added.length) blocks.filter((block) => GUARD_TEST.test(block.text)).forEach((block) => pick(block, 'guard'));

  const names = [...picked.keys()];
  const summary = 'Affected tests since ' + base.slice(0, 10) + ': ' + names.length + ' of ' + blocks.length
    + ' (game lines changed: ' + (game.removed.length + game.added.length) + ', test lines changed: ' + (tests.removed.length + tests.added.length)
    + (words.size ? '; picked by: ' + [...words].slice(0, 30).join(' ') + (words.size > 30 ? ' ...' : '') : '')
    + (tooCommon.length ? '; too common to pick by: ' + tooCommon.slice(0, 12).join(' ') + (tooCommon.length > 12 ? ' ...' : '') : '') + ')';
  return { base, names, reasons: picked, summary };
}

module.exports = { pickAffected };

if (require.main === module) {
  const result = pickAffected({ base: process.argv[2] });
  console.log(result.summary);
  result.names.forEach((name) => console.log('  ' + name + '   [' + result.reasons.get(name) + ']'));
}
