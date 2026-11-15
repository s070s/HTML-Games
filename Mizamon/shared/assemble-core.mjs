// Pure text assembly of the Mizamon page (reference section 13.3). Node built-ins only, no file access.
// The page is src/shell.html with three marker lines, each on a line of its own, replaced by text:
//   /*@@DATA@@*/    the data block: the DATA line built from data/ (13.2), empty when there is no data/
//   /*@@RULES@@*/   src/rules/*.js joined in name order
//   /*@@ENGINE@@*/  src/engine/*.js joined in name order
// A marker line is replaced together with its line break, so empty text removes the line.
// The text is inserted by building a list of chunks and joining it, never with String.replace and a
// string argument: "$&", "$`" and "$'" in a data string would be expanded there.
import { createHash } from 'node:crypto';
import { assertNoMarkerTexts } from './validate.mjs';

export const SHELL_MARKERS = Object.freeze({ data: '/*@@DATA@@*/', rules: '/*@@RULES@@*/', engine: '/*@@ENGINE@@*/' });
export const RULES_BEGIN = '// RULES-BEGIN';
export const RULES_END = '// RULES-END';
export const DATA_BEGIN = '/*DATA-BEGIN*/';
export const DATA_END = '/*DATA-END*/';
export const FRAGMENT_NAME = /^\d\d[a-z]?-[a-z0-9-]+\.js$/;
// Every text that marks a place in the page; a fragment or a data string may not contain one on a line of its own.
const MARKER_LINES = [RULES_BEGIN, RULES_END, DATA_BEGIN, DATA_END];
const SHELL_MARKER_PATTERN = /^\/\*@@[A-Z]+@@\*\/$/;
const BINARY_PATH = /^data\/audio\//;

// A CRLF checkout and an LF checkout must give the same bytes.
export function toLf(text) {
  return text.split('\r\n').join('\n');
}

export function sha256Hex(bytesOrText) {
  return createHash('sha256').update(bytesOrText).digest('hex');
}

function compareNames(left, right) {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

function isMarkerLine(line) {
  return MARKER_LINES.includes(line) || SHELL_MARKER_PATTERN.test(line);
}

// Joins fragments ({ name, text }) in name order; every fragment must end with a line break.
export function joinFragments(fragments, kind) {
  const sorted = [...fragments].sort((left, right) => compareNames(left.name, right.name));
  const seen = new Set();
  const pieces = [];
  for (const fragment of sorted) {
    if (!FRAGMENT_NAME.test(fragment.name)) throw new Error(`bad fragment name in ${kind}: ${fragment.name}`);
    if (seen.has(fragment.name)) throw new Error(`fragment ${fragment.name} listed twice in ${kind}`);
    seen.add(fragment.name);
    const text = toLf(fragment.text);
    if (text === '' || !text.endsWith('\n')) throw new Error(`fragment ${kind}/${fragment.name} must end with a line break`);
    const markerLine = text.split('\n').find(isMarkerLine);
    if (markerLine !== undefined) throw new Error(`fragment ${kind}/${fragment.name} contains the marker line "${markerLine}"`);
    pieces.push(text);
  }
  return pieces.join('');
}

function countLines(text, wanted) {
  return text.split('\n').filter((line) => line === wanted).length;
}

// The three lines at the data marker (reference 13.2): /*DATA-BEGIN*/, `const DATA = {...};` and /*DATA-END*/. data is the DATA object.
// The JSON is one line with every "<" written as < (the JSON still parses to the same strings), so no text can close the
// script or open "<!--"; a data string that holds a marker text of the page is refused (the marker-text rule of validate.mjs).
export function dataBlockText(data) {
  assertNoMarkerTexts(data);
  const json = JSON.stringify(data).split('<').join('\\u003c');
  return `${DATA_BEGIN}\nconst DATA = ${json};\n${DATA_END}\n`;
}

// shell: the text of src/shell.html; data: text for the data marker (empty or ending with a line break);
// rules and engine: lists of { name, text }. Returns the page as LF text.
export function assemblePage({ shell, data = '', rules, engine }) {
  const insertions = {
    [SHELL_MARKERS.data]: toLf(data),
    [SHELL_MARKERS.rules]: joinFragments(rules, 'rules'),
    [SHELL_MARKERS.engine]: joinFragments(engine, 'engine'),
  };
  if (insertions[SHELL_MARKERS.data] !== '' && !insertions[SHELL_MARKERS.data].endsWith('\n')) {
    throw new Error('the data text must end with a line break');
  }
  const lines = toLf(shell).split('\n');
  const remainder = lines.pop(); // the text after the last line break ('' when the file ends with one)
  const used = new Set();
  const chunks = [];
  for (const line of lines) {
    if (Object.hasOwn(insertions, line)) {
      if (used.has(line)) throw new Error(`the shell holds the marker ${line} more than once`);
      used.add(line);
      chunks.push(insertions[line]);
    } else if (SHELL_MARKER_PATTERN.test(line)) {
      throw new Error(`the shell holds an unknown marker ${line}`);
    } else {
      chunks.push(line + '\n');
    }
  }
  chunks.push(remainder);
  for (const marker of Object.values(SHELL_MARKERS)) {
    if (!used.has(marker)) throw new Error(`the shell has no marker line ${marker}`);
  }
  const page = chunks.join('');
  for (const wanted of [RULES_BEGIN, RULES_END]) {
    if (countLines(page, wanted) !== 1) throw new Error(`${wanted} must be on a line of its own exactly once in the page`);
  }
  if (page.indexOf(`\n${RULES_BEGIN}\n`) > page.indexOf(`\n${RULES_END}\n`)) throw new Error(`${RULES_END} comes before ${RULES_BEGIN}`);
  // The data markers are whole lines too: both once or neither, in order, inside the rules block.
  const dataMarkerCounts = [countLines(page, DATA_BEGIN), countLines(page, DATA_END)];
  if (dataMarkerCounts[0] !== dataMarkerCounts[1] || dataMarkerCounts[0] > 1) throw new Error(`${DATA_BEGIN} and ${DATA_END} must each be on a line of their own, once or not at all, in the page`);
  if (dataMarkerCounts[0] === 1) {
    const begin = page.indexOf(`\n${DATA_BEGIN}\n`);
    const end = page.indexOf(`\n${DATA_END}\n`);
    if (begin > end || begin < page.indexOf(`\n${RULES_BEGIN}\n`) || end > page.indexOf(`\n${RULES_END}\n`)) throw new Error(`${DATA_BEGIN} and ${DATA_END} must come in this order inside the rules block`);
  }
  return page;
}

// entries: [{ path, bytes }] with paths relative to the Mizamon folder, '/' separated. SHA-256 over the files in sorted
// path order: path, NUL, content. Text has CRLF turned into LF; audio files are hashed as their bytes.
export function sourceHash(entries) {
  const hash = createHash('sha256');
  const sorted = [...entries].sort((left, right) => compareNames(left.path, right.path));
  for (const entry of sorted) {
    hash.update(entry.path);
    hash.update('\0');
    hash.update(BINARY_PATH.test(entry.path) ? entry.bytes : toLf(entry.bytes.toString('utf8')));
  }
  return hash.digest('hex');
}
