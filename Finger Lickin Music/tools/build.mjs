// tools/build.mjs - joins src/shell.html and src/*.js into FingerLickinMusic.html (and the test and online builds).
// Zero dependencies (Node built-ins only), Node 22 or newer. Spec: docs/IMPLEMENTATION-PLAN.md Part 3.3.
//
//   node tools/build.mjs [--check] [--online <relayUrl>] [--quiet]
//
// Exit codes: 0 ok, 1 at least one problem (nothing written), 2 usage error, 3 I/O error.
import { readFileSync, readdirSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'src');
const OUT_SHIP = join(ROOT, 'FingerLickinMusic.html');
const OUT_TEST = join(ROOT, 'FingerLickinMusic.test.html');
const OUT_ONLINE = join(ROOT, 'FingerLickinMusic.online.html');

const MARK = '/*@@SCRIPT@@*/';
const BOM = String.fromCharCode(0xFEFF);
const FILE_NAME_PATTERN = /^\d\d[a-z]?-[a-z0-9-]+\.js$/;
const TEST_FILE_PATTERN = /^9\d/;
const VERSION_PATTERN = /^const VERSION = '(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)';$/m;
const SIZE_FAIL_BYTES = 2621440;   // 2.5 MB hard limit (problem)
const SIZE_WARN_BYTES = 1572864;   // 1.5 MB target (warning)
const MB = 1048576;
const DUPLICATE_WINDOW = 8;
const DUPLICATE_MIN_LENGTH = 12;
const DUPLICATE_EXEMPT = ['30-content.js', '06-instruments.js', '02-theory.js'];
const CSP_CONNECT = "connect-src 'self'";
// RISK-60 envelopes for the shipped file, by phase gate (MB, label).
const ENVELOPES = [[0.55, 'Phase 05'], [0.95, 'Phase 09'], [1.20, 'Phase 12'], [1.35, 'Phase 13'], [1.50, 'Phase 16']];

// Namespace of each shipped module, keyed by the two-digit file prefix (Part 3.1).
const NAMESPACES = {
  '01': 'Core', '02': 'Theory', '03': 'Model', '04': 'Transport', '05': 'Audio', '06': 'Instruments',
  '07': 'Input', '08': 'Mapping', '09': 'Rhythm', '10': 'Midi', '11': 'Zip', '12': 'MusicXml',
  '13': 'GuitarPro', '14': 'Import', '15': 'Project', '16': 'Storage', '17': 'Studio', '18': 'Render',
  '19': 'Rig', '20': 'Animation', '21': 'Stage', '22': 'Character', '23': 'Dance', '24': 'Net',
  '25': 'Progress', '26': 'UI', '27': 'Screens', '28': 'Modes', '29': 'Boot', '30': 'Content'
};

// Banned text anywhere in a .js file (Part 3.3.4); comment text after // is ignored.
const BANNED_APIS = [
  'fetch(', 'XMLHttpRequest', 'import(', 'importScripts', 'navigator.sendBeacon', 'eval(', 'new Function(',
  'document.write', '.innerHTML', '.outerHTML', 'insertAdjacentHTML', "setTimeout('", "setInterval('"
];
const NET_ONLY_APIS = ['new WebSocket', 'RTCPeerConnection'];        // allowed only in 24-net.js
const WINDOW_ASSIGNMENT = /\bwindow\.[A-Za-z_$][\w$]*\s*=(?!=)/;     // allowed only in 01-core.js and 90-selftest.js
const SYNTAX_CEILING = [
  ['??=', (line) => line.includes('??=')],
  ['||=', (line) => line.includes('||=')],
  ['&&=', (line) => line.includes('&&=')],
  ['private field', (line) => /^\s*#\w+/.test(line) || /this\.#/.test(line)],
  ['static block', (line) => line.includes('static {')],
  ['import/export statement', (line) => /^(import|export) /.test(line)]
];
// Remote references (T01.02 decision): a shell or .js file must not load anything from outside.
const REMOTE_PATTERNS = [
  /<script\s+src=/i, /<link\s+rel="stylesheet"/i, /@import/i, /url\(\s*http/i, /src="http/i, /href="http/i
];
// Credential patterns (Part 10.4), case-insensitive, checked on the shipped set and the shell.
const CREDENTIAL_PATTERNS = [
  /api[_-]?key/i, /secret/i, /token=/i, /bearer /i, /password/i, /passwd/i, /authorization:/i,
  /private[_-]?key/i, /-----BEGIN/i
];

const problems = [];
const warnings = [];

function addProblem(text) {
  problems.push(text);
}

function exitWith(code, message) {
  if (message) process.stderr.write(message + '\n');
  process.exit(code);
}

function parseArgs(argv) {
  const args = { check: false, online: null, quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--check') args.check = true;
    else if (flag === '--quiet') args.quiet = true;
    else if (flag === '--online') {
      index += 1;
      if (index >= argv.length) exitWith(2, 'usage: --online needs a relay URL (ws: or wss:)');
      args.online = argv[index];
    } else exitWith(2, 'usage: node tools/build.mjs [--check] [--online <relayUrl>] [--quiet]; unknown flag ' + flag);
  }
  if (args.online !== null) {
    let parsed = null;
    try { parsed = new URL(args.online); } catch (error) { parsed = null; }
    if (!parsed || (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:')) {
      exitWith(2, 'usage: --online <relayUrl> must be a URL with scheme ws: or wss:');
    }
  }
  return args;
}

// Decode UTF-8, strip a leading BOM, normalize line endings, make sure the text ends with one newline.
function normalizeText(rawText) {
  let text = rawText.charCodeAt(0) === 0xFEFF ? rawText.slice(1) : rawText;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return text.endsWith('\n') ? text : text + '\n';
}

function readText(path) {
  try {
    return normalizeText(readFileSync(path, 'utf8'));
  } catch (error) {
    return exitWith(3, 'I/O error: cannot read ' + path + ' (' + error.code + ')');
  }
}

function listSources() {
  let names = [];
  try {
    names = readdirSync(SRC_DIR).filter((name) => name.endsWith('.js'));
  } catch (error) {
    exitWith(3, 'I/O error: cannot list ' + SRC_DIR + ' (' + error.code + ')');
  }
  names.sort((a, b) => a.localeCompare(b, 'en', { numeric: false }));
  return names.map((name) => {
    if (!FILE_NAME_PATTERN.test(name)) addProblem('bad file name: ' + name);
    return { name, text: readText(join(SRC_DIR, name)) };
  });
}

const isShipped = (file) => !TEST_FILE_PATTERN.test(file.name);

function stripLineComment(line) {
  const index = line.indexOf('//');
  return index < 0 ? line : line.slice(0, index);
}

// Same idea for the remote check, but a "//" inside "http://" is not a comment start.
function stripCommentsForRemote(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'));
}

function checkNonAscii(file, text) {
  text.split('\n').forEach((line, index) => {
    if (/[^\x00-\x7F]/.test(line)) addProblem('non-ASCII byte in ' + file + ':' + (index + 1));
  });
}

function checkRemote(file, text) {
  stripCommentsForRemote(text).forEach((line, index) => {
    const hit = REMOTE_PATTERNS.find((pattern) => pattern.test(line));
    if (hit) addProblem('remote reference ' + hit.source + ' in ' + file + ':' + (index + 1));
  });
}

function checkCredentials(file, text) {
  text.split('\n').forEach((line, index) => {
    const hit = CREDENTIAL_PATTERNS.find((pattern) => pattern.test(line));
    if (hit) addProblem('credential pattern ' + hit.source + ' in ' + file + ':' + (index + 1));
  });
}

function checkShell(shell) {
  const count = shell.split(MARK).length - 1;
  if (count !== 1) addProblem('marker: src/shell.html must contain ' + MARK + ' exactly once, found ' + count);
  checkNonAscii('shell.html', shell);
  checkRemote('shell.html', shell);
  checkCredentials('shell.html', shell);
}

// Lines of a file with comment-only lines removed (used by skeleton and strict checks).
function codeLines(text) {
  const result = [];
  let inBlockComment = false;
  text.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      return;
    }
    if (trimmed === '' || trimmed.startsWith('//')) return;
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      return;
    }
    result.push({ text: trimmed, raw: line, number: index + 1 });
  });
  return result;
}

function checkSkeleton(file) {
  const lines = codeLines(file.text);
  if (lines.length === 0) {
    addProblem('skeleton: ' + file.name + ' has no code');
    return;
  }
  if (lines[0].text !== '(function () {') addProblem('skeleton: first code line of ' + file.name + ' must be "(function () {"');
  if (lines[lines.length - 1].text !== '})();') addProblem('skeleton: last code line of ' + file.name + ' must be "})();"');
  if (!lines[1] || lines[1].text !== "'use strict';") addProblem("strict: second code line of " + file.name + " must be 'use strict';");
}

function checkTopLevelNames(file) {
  const lines = file.text.split('\n');
  const start = lines.indexOf('(function () {');
  const end = lines.lastIndexOf('})();');
  lines.forEach((line, index) => {
    const insideIife = start >= 0 && index > start && (end < 0 || index < end);
    if (insideIife) return;
    if (/^(const|let|var|function|class)\b/.test(line)) {
      addProblem('top-level names: declaration outside the IIFE in ' + file.name + ':' + (index + 1));
    }
  });
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function checkNamespace(file) {
  const prefix = file.name.slice(0, 2);
  const isModule = /^\d\d/.test(file.name) && NAMESPACES[prefix] !== undefined;
  if (isModule) {
    if (prefix === '01') {
      if (countMatches(file.text, /window\.FLM = /g) !== 1) addProblem('namespace: 01-core.js must contain "window.FLM = " exactly once');
      return;
    }
    const defineCount = countMatches(file.text, /FLM\.Core\.define\('/g);
    const expected = "FLM.Core.define('" + NAMESPACES[prefix] + "',";
    const isPart = /^\d\d[a-z]-/.test(file.name);   // split modules (18a-...) share one define call
    if (!isPart && (defineCount !== 1 || !file.text.includes(expected))) {
      addProblem('namespace: ' + file.name + ' must contain exactly one ' + expected);
    }
    if (isPart && defineCount > 1) addProblem('namespace: ' + file.name + ' contains more than one FLM.Core.define');
    return;
  }
  const testMatch = /^9[12]-test-([a-z0-9-]+)\.js$/.exec(file.name);
  if (testMatch) {
    const groupCount = countMatches(file.text, /FLM\.SelfTest\.group\('/g);
    const expected = "FLM.SelfTest.group('" + testMatch[1] + "',";
    if (groupCount !== 1 || !file.text.includes(expected)) addProblem('namespace: ' + file.name + ' must contain exactly one ' + expected);
  }
}

function checkBannedApis(file) {
  const allowNet = file.name === '24-net.js';
  const allowWindow = file.name === '01-core.js' || file.name === '90-selftest.js';
  file.text.split('\n').forEach((rawLine, index) => {
    const line = stripLineComment(rawLine);
    const where = file.name + ':' + (index + 1);
    BANNED_APIS.forEach((api) => {
      if (line.includes(api)) addProblem('banned API ' + api + ' in ' + where);
    });
    if (!allowNet) {
      NET_ONLY_APIS.forEach((api) => {
        if (line.includes(api)) addProblem('banned API ' + api + ' outside 24-net.js in ' + where);
      });
    }
    if (!allowWindow && WINDOW_ASSIGNMENT.test(line)) addProblem('banned API window property assignment in ' + where);
  });
}

function checkSyntaxCeiling(file) {
  file.text.split('\n').forEach((rawLine, index) => {
    const line = stripLineComment(rawLine);
    SYNTAX_CEILING.forEach(([label, test]) => {
      if (test(line)) addProblem('syntax ceiling: ' + label + ' (ES2021 or later) in ' + file.name + ':' + (index + 1));
    });
  });
}

function checkFile(file) {
  checkNonAscii(file.name, file.text);
  checkRemote(file.name, file.text);
  if (!FILE_NAME_PATTERN.test(file.name)) return;
  checkSkeleton(file);
  checkTopLevelNames(file);
  checkNamespace(file);
  checkBannedApis(file);
  checkSyntaxCeiling(file);
}

// Meaningful lines for the DRY check: trimmed, long enough, not a bracket, quote or comment start.
function meaningfulLines(file) {
  const result = [];
  file.text.split('\n').forEach((raw, index) => {
    const text = raw.trim();
    if (text.length < DUPLICATE_MIN_LENGTH) return;
    if (/^[{['"`]/.test(text) || text.startsWith('//') || text.startsWith('/*') || text.startsWith('*')) return;
    result.push({ text, number: index + 1 });
  });
  return result;
}

function checkDuplicates(shippedFiles) {
  const seen = new Map();
  shippedFiles.filter((file) => !DUPLICATE_EXEMPT.includes(file.name)).forEach((file) => {
    const lines = meaningfulLines(file);
    for (let start = 0; start + DUPLICATE_WINDOW <= lines.length; start += 1) {
      const block = lines.slice(start, start + DUPLICATE_WINDOW);
      const key = block.map((line) => line.text).join('\n');
      const here = file.name + ':' + block[0].number;
      if (!seen.has(key)) {
        seen.set(key, here);
        continue;
      }
      addProblem('DRY: duplicated block at ' + here + ' (same as ' + seen.get(key) + ')');
      start += DUPLICATE_WINDOW - 1;   // report overlapping windows of the same block once
    }
  });
}

function readVersion(files) {
  const core = files.find((file) => file.name === '01-core.js');
  if (!core) {
    addProblem('version: src/01-core.js is missing, so VERSION cannot be read');
    return '0.0.0';
  }
  const match = VERSION_PATTERN.exec(core.text);
  if (!match) {
    addProblem("version: 01-core.js has no line matching const VERSION = 'x.y.z';");
    return '0.0.0';
  }
  return match[1];
}

function replaceTokens(file, options) {
  if (file.name !== '01-core.js') return file.text;
  return file.text
    .split("'@@BUILD@@'").join("'" + options.buildStamp + "'")
    .split("'@@RELAY_URL@@'").join("'" + options.relayUrl + "'");
}

function joinPage(shell, set, options) {
  const header = '/* Finger Lickin Music ' + options.version + ' built ' + options.date + ' ' + options.edition + ' ' + options.kind + ' */\n';
  const body = set.map((file) => '// ==== ' + file.name + ' ====\n' + replaceTokens(file, options) + '\n').join('');
  const script = header + body;
  const page = BOM + shell.replace(MARK, () => script);   // function form: no $-pattern expansion
  return { script, page, bytes: Buffer.byteLength(page, 'utf8') };
}

function shellWithCsp(shell, origin) {
  return shell.replace(CSP_CONNECT, CSP_CONNECT + ' ' + origin);
}

function checkParse(script, kind) {
  const tempPath = join(tmpdir(), 'flm-build-' + process.pid + '-' + kind + '.js');
  try {
    writeFileSync(tempPath, script);
    const result = spawnSync(process.execPath, ['--check', tempPath], { encoding: 'utf8' });
    if (result.status !== 0) {
      const firstLines = String(result.stderr || result.error || '').split('\n').slice(0, 3).join(' | ');
      addProblem('the joined ' + kind + ' script does not parse: ' + firstLines);
    }
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
}

function checkSize(shipBytes) {
  if (shipBytes > SIZE_FAIL_BYTES) addProblem('size: shipped page is ' + shipBytes + ' bytes, above the ' + SIZE_FAIL_BYTES + ' byte limit');
  else if (shipBytes > SIZE_WARN_BYTES) warnings.push('  WARNING shipped page is above 1.5 MB (' + shipBytes + ' bytes, target ' + SIZE_WARN_BYTES + ')');
}

function envelopeLine(shipBytes) {
  const shipMb = shipBytes / MB;
  const envelope = ENVELOPES.find(([limit]) => shipMb <= limit);
  const text = envelope
    ? 'within the ' + envelope[0].toFixed(2) + ' MB envelope (first gate: ' + envelope[1] + ')'
    : 'above every RISK-60 envelope (largest 1.50 MB)';
  return 'envelope RISK-60: ship ' + shipBytes + ' bytes, ' + text;
}

function writeAtomic(path, text) {
  const tempPath = path + '.tmp';
  try {
    writeFileSync(tempPath, text);
    renameSync(tempPath, path);
  } catch (error) {
    exitWith(3, 'I/O error: cannot write ' + path + ' (' + error.code + ')');
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const shell = readText(join(SRC_DIR, 'shell.html'));
  const files = listSources();
  const shipped = files.filter(isShipped);
  const version = readVersion(files);

  checkShell(shell);
  files.forEach(checkFile);
  checkDuplicates(shipped);
  shipped.forEach((file) => checkCredentials(file.name, file.text));

  const now = new Date();
  const dateTime = now.toISOString().slice(0, 19) + 'Z';
  const common = { version, date: dateTime.slice(0, 10) };
  const ship = joinPage(shell, shipped, { ...common, edition: 'standalone', kind: 'ship', relayUrl: '', buildStamp: dateTime + ' standalone ship' });
  const test = joinPage(shell, files, { ...common, edition: 'standalone', kind: 'test', relayUrl: '', buildStamp: dateTime + ' standalone test' });
  const online = args.online === null ? null : joinPage(
    shellWithCsp(shell, new URL(args.online).origin), shipped,
    { ...common, edition: 'online', kind: 'ship', relayUrl: args.online, buildStamp: dateTime + ' online ship' }
  );
  checkParse(ship.script, 'ship');
  checkParse(test.script, 'test');
  checkSize(ship.bytes);

  const lines = [];
  lines.push('files ' + files.length + ' (ship ' + shipped.length + ', test ' + files.length + ')');
  lines.push('version ' + version + ' build ' + dateTime + ' standalone');
  lines.push('size ship ' + (ship.bytes / MB).toFixed(2) + ' MB, test ' + (test.bytes / MB).toFixed(2) + ' MB');
  lines.push(envelopeLine(ship.bytes));
  lines.push(...warnings);
  problems.forEach((problem) => lines.push('  PROBLEM ' + problem));

  const outputs = ['FingerLickinMusic.html', 'FingerLickinMusic.test.html'];
  if (online) outputs.push('FingerLickinMusic.online.html');
  if (problems.length > 0) lines.push('BUILD FAILED: ' + problems.length + ' problem(s)');
  else if (args.check) lines.push('CHECK OK');
  else lines.push('BUILD OK -> ' + outputs.join(', '));

  const printed = args.quiet ? lines.filter((line) => line.startsWith('  PROBLEM') || /^(BUILD|CHECK)/.test(line)) : lines;
  process.stdout.write(printed.join('\n') + '\n');

  if (problems.length > 0) process.exit(1);
  if (!args.check) {
    writeAtomic(OUT_SHIP, ship.page);
    writeAtomic(OUT_TEST, test.page);
    if (online) writeAtomic(OUT_ONLINE, online.page);
  }
  process.exit(0);
}

main();
