// Reads and writes the data folder (reference section 13.1): Mizamon/data/. Every file is written by the one writer
// (json-format.mjs). A kind is a folder with index.json (the ordered list of ids) and <id>.json per entry, or one file
// (game.json, world.json), or the string groups (strings/index.json and strings/<group>.json).
// The result of reading is the DATA object the page inlines: { game, types: { id: entry }, ..., strings: { group: { key: { el, en } } } }.
// A kind with no folder or file is left out (the data moves in kind by kind); `missingKinds` lists them.
// Node built-ins only.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { formatEntry, formatJson } from './json-format.mjs';
import { fileIdProblem } from './ids.mjs';
import { DATA_VERSION, KINDS } from './schemas.mjs';

export class DataError extends Error {}

const INDEX_FILE = 'index.json';
const TEMPORARY_FILE = /\.tmp-[A-Za-z0-9]+$/; // an unfinished write of the editor: ignored (13.4)
const MIGRATE_COMMAND = 'node Mizamon/tools/migrate-data.mjs';

// The refusal the server, the assembler and the tests share (13.1, "Data version").
export function dataVersionProblem(version) {
  if (!Number.isInteger(version)) return 'game.json has no dataVersion';
  if (version > DATA_VERSION) return `the data is version ${version}, newer than this code knows (version ${DATA_VERSION}): update the code`;
  if (version < DATA_VERSION) return `the data is version ${version}, older than this code needs (version ${DATA_VERSION}): run ${MIGRATE_COMMAND}`;
  return null;
}

const readText = (path) => readFileSync(path, 'utf8').split('\r\n').join('\n');

function readJson(path) {
  try {
    return JSON.parse(readText(path));
  } catch (error) {
    throw new DataError(`${path}: ${error.message}`);
  }
}

function listIds(folder, extension) {
  return readdirSync(folder).filter((name) => name.endsWith(extension) && name !== INDEX_FILE && !TEMPORARY_FILE.test(name)).map((name) => name.slice(0, -extension.length)).sort();
}

// The ordered ids of a folder: index.json must list exactly the files that are there.
function readIndexedIds(folder, label) {
  const indexPath = join(folder, INDEX_FILE);
  if (!existsSync(indexPath)) throw new DataError(`${label} has no ${INDEX_FILE}`);
  const ids = readJson(indexPath);
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) throw new DataError(`${label}/${INDEX_FILE} must be a list of ids`);
  const seen = new Set();
  for (const id of ids) {
    const problem = fileIdProblem(id);
    if (problem) throw new DataError(`${label}/${INDEX_FILE}: ${problem}`);
    if (seen.has(id)) throw new DataError(`${label}/${INDEX_FILE} lists "${id}" twice`);
    seen.add(id);
  }
  const files = listIds(folder, '.json');
  for (const id of ids) if (!files.includes(id)) throw new DataError(`${label}/${INDEX_FILE} lists "${id}" but ${label}/${id}.json does not exist`);
  for (const id of files) if (!seen.has(id)) throw new DataError(`${label}/${id}.json is not in ${label}/${INDEX_FILE}`);
  return ids;
}

// root: the Mizamon folder. Returns { data, missingKinds }. checkVersion: false reads data of another version as it is (the migration tool).
export function readData(root, { checkVersion = true } = {}) {
  const dataRoot = join(root, 'data');
  const data = {};
  const missingKinds = [];
  if (checkVersion && existsSync(join(dataRoot, 'game.json'))) {
    const problem = dataVersionProblem(readJson(join(dataRoot, 'game.json')).dataVersion);
    if (problem) throw new DataError(problem);
  }
  for (const [kind, definition] of Object.entries(KINDS)) {
    if (definition.storage === 'single') {
      const path = join(dataRoot, definition.file);
      if (existsSync(path)) data[kind] = readJson(path); else missingKinds.push(kind);
      continue;
    }
    const folder = join(dataRoot, definition.folder);
    if (!existsSync(folder)) {
      missingKinds.push(kind);
      continue;
    }
    const ids = readIndexedIds(folder, definition.folder);
    data[kind] = {};
    for (const id of ids) data[kind][id] = readJson(join(folder, `${id}.json`));
  }
  return { data, missingKinds };
}

// The files of a DATA object as [{ path, text }] (paths relative to the data folder, '/' separated), through the one writer.
export function dataFiles(data) {
  const files = [];
  for (const [kind, definition] of Object.entries(KINDS)) {
    if (!Object.hasOwn(data, kind)) continue;
    if (definition.storage === 'single') {
      files.push({ path: definition.file, text: formatEntry(definition.schema, data[kind]) });
      continue;
    }
    const ids = Object.keys(data[kind]);
    files.push({ path: `${definition.folder}/${INDEX_FILE}`, text: formatJson(ids) });
    for (const id of ids) {
      const problem = fileIdProblem(id);
      if (problem) throw new DataError(`${kind}: ${problem}`);
      files.push({ path: `${definition.folder}/${id}.json`, text: formatEntry(definition.schema, data[kind][id]) });
    }
  }
  return files;
}

// Writes every file of the DATA object into <root>/data.
export function writeData(root, data) {
  for (const { path, text } of dataFiles(data)) {
    const target = join(root, 'data', ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
}

// Every file under data/ as a list of relative paths ('/' separated), for the migration check.
export function listDataPaths(root) {
  const dataRoot = join(root, 'data');
  const paths = [];
  const walk = (folder, prefix) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (TEMPORARY_FILE.test(entry.name)) continue;
      if (entry.isDirectory()) walk(join(folder, entry.name), `${prefix}${entry.name}/`);
      else paths.push(`${prefix}${entry.name}`);
    }
  };
  if (existsSync(dataRoot)) walk(dataRoot, '');
  return paths.sort();
}
