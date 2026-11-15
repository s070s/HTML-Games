// Moves the data files of Mizamon/data/ to the data version of this code (reference section 13.1, "Data version"). Node built-ins only.
//
//   node Mizamon/tools/migrate-data.mjs [--check] [--root <Mizamon folder>]
//
// The data version is `dataVersion` in data/game.json; this code knows DATA_VERSION (shared/schemas.mjs).
//   - Data of the same version: without --check every file that is not exactly what the one writer (shared/json-format.mjs) writes is
//     rewritten; with --check nothing is changed and a file that differs, a file that no kind has and a missing file are problems
//     (exit 1). Both say how many files were looked at.
//   - Data of an older version: without --check the steps MIGRATIONS[version] run one after the other on the data (each turns the shape of
//     version n into the shape of n + 1) and every file is rewritten through the writer; with --check it is a problem that says to run
//     the tool without --check.
//   - Data of a newer version, or an older one for which there is no step: refused (exit 1), nothing is changed.
// A change to the shape of a kind raises DATA_VERSION in the same commit and adds one step here, with a test from a fixture of the
// old shape (tools/run-tests.mjs, "data version"). The server, the assembler and the tests refuse data of another version the same way.
// Exit codes: 0 done, 1 a problem, 2 usage error, 3 input/output error.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataError, dataFiles, dataVersionProblem, listDataPaths, readData, writeData } from '../shared/data-files.mjs';
import { DATA_VERSION } from '../shared/schemas.mjs';
import { MIZAMON_ROOT } from './assemble.mjs';

// MIGRATIONS[n] turns the data of version n (the DATA object read without the version check) into the data of version n + 1.
// Data version 1 is the first one: there is no step yet.
export const MIGRATIONS = Object.freeze({});

const USAGE = 'usage: node Mizamon/tools/migrate-data.mjs [--check] [--root <Mizamon folder>]';

const readText = (path) => readFileSync(path, 'utf8').split('\r\n').join('\n');

// The files that are not what the writer writes: [{ path, kind: 'extra' | 'missing' | 'different', problem }].
function fileProblems(root, data) {
  const problems = [];
  const expected = dataFiles(data);
  const expectedPaths = new Set(expected.map((file) => file.path));
  for (const path of listDataPaths(root)) {
    if (!expectedPaths.has(path)) problems.push({ path, kind: 'extra', problem: `${path} is not a file of the data (no kind has it)` });
  }
  for (const file of expected) {
    const fullPath = join(root, 'data', ...file.path.split('/'));
    if (!existsSync(fullPath)) problems.push({ path: file.path, kind: 'missing', problem: `${file.path} is missing` });
    else if (readText(fullPath) !== file.text) problems.push({ path: file.path, kind: 'different', problem: `${file.path} is not what the writer writes` });
  }
  return problems;
}

// Runs the migration. Returns { from, to, files, rewritten }; throws DataError for a problem.
export function migrateData(root = MIZAMON_ROOT, { check = false, steps = MIGRATIONS } = {}) {
  const gamePath = join(root, 'data', 'game.json');
  if (!existsSync(gamePath)) throw new DataError(`${gamePath} does not exist`);
  const from = JSON.parse(readText(gamePath)).dataVersion;
  if (!Number.isInteger(from) || from > DATA_VERSION) throw new DataError(dataVersionProblem(from)); // no dataVersion, or newer than this code
  if (from < DATA_VERSION && check) throw new DataError(`the data is version ${from}, older: run without --check to migrate it to version ${DATA_VERSION}`);
  let { data } = readData(root, { checkVersion: false });
  for (let version = from; version < DATA_VERSION; version += 1) {
    if (!steps[version]) throw new DataError(`no migration step from data version ${version} (this code is at version ${DATA_VERSION})`);
    data = steps[version](data);
    data.game.dataVersion = version + 1;
  }
  const problems = fileProblems(root, data);
  const total = dataFiles(data).length;
  if (check) {
    if (problems.length > 0) throw new DataError(problems.map((entry) => entry.problem).join('\n'));
    return { from, to: from, files: total, rewritten: 0 };
  }
  const extra = problems.filter((entry) => entry.kind === 'extra');
  if (extra.length > 0) throw new DataError(extra.map((entry) => entry.problem).join('\n'));
  const rewritten = from < DATA_VERSION ? total : problems.length;
  if (rewritten > 0) writeData(root, data);
  return { from, to: DATA_VERSION, files: total, rewritten };
}

function parseArguments(argv) {
  const options = { check: false, root: MIZAMON_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--check') {
      options.check = true;
    } else if (argv[index] === '--root' && index + 1 < argv.length) {
      index += 1;
      options.root = resolve(argv[index]);
    } else {
      return null;
    }
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options) {
    console.error(USAGE);
    process.exit(2);
  }
  try {
    const result = migrateData(options.root, { check: options.check });
    if (options.check) console.log(`data version ${result.to} is current; ${result.files} files, all as the writer writes them`);
    else if (result.from < result.to) console.log(`data migrated from version ${result.from} to ${result.to}; ${result.files} files written`);
    else console.log(`data version ${result.to} is current; ${result.files} files checked, ${result.rewritten} rewritten`);
  } catch (error) {
    console.error(error.message);
    process.exit(error.code ? 3 : 1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
