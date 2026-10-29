// 92-test-files.js - FT file-handling tests (Part 12.4). First row: FT-106 (T01.05). Later entries append rows.
(function () {
'use strict';
const FLM = window.FLM;

const LOG_ENTRY_COUNT = 600;           // more than the 500-entry ring, so the oldest entries must disappear
const LOG_RING_SIZE = 500;
const EXPORT_LIMIT_BYTES = 204800;     // Part 6.1.4.6: the export stays at or below 200 KB
const SECRET_TITLE = 'Secret Song Title';
const SECRET_FILE = 'secret-file-name.mid';

/** The number in a message written by this test: 'entry 123 end'. */
function entryIndex(entry) {
  return Number(entry.msg.split(' ')[1]);
}

FLM.SelfTest.group('files', (t) => {
  t.test('FT-106 files.roundtrip.diag-export', () => {
    const core = FLM.Core;
    if (!core.Log || !core.Diagnostics) t.skip('Core.Log or Core.Diagnostics is not available');
    core.Log.clear();
    try {
      for (let index = 0; index < LOG_ENTRY_COUNT; index += 1) {
        core.Log.info('ft-106', 'entry ' + index + ' end', { title: SECRET_TITLE, fileName: SECRET_FILE, index });
      }
      const exported = core.Diagnostics.export();
      const bytes = new TextEncoder().encode(exported.json).length;
      t.ok(bytes <= EXPORT_LIMIT_BYTES, 'export is ' + bytes + ' bytes');
      t.eq(exported.bytes, exported.json.length);
      const doc = JSON.parse(exported.json);
      t.ok(doc.log.length <= LOG_RING_SIZE, 'at most ' + LOG_RING_SIZE + ' log entries, got ' + doc.log.length);
      // The redaction step may cut the array to 200 entries and append a '[+N more]' text (Part 6.1.4.6 step 3),
      // so only the entries that are objects are checked: none of the 100 oldest, and in ascending order.
      const indexes = doc.log.filter((entry) => typeof entry === 'object').map((entry) => entryIndex(entry));
      t.ok(indexes.length > 0, 'the export holds log entries');
      t.ok(indexes[0] >= LOG_ENTRY_COUNT - LOG_RING_SIZE, 'oldest entries dropped first, first kept is ' + indexes[0]);
      t.deepEq(indexes, indexes.slice().sort((a, b) => a - b));
      t.ok(!exported.json.includes(SECRET_TITLE), 'no song title in the export');
      t.ok(!exported.json.includes(SECRET_FILE), 'no file name in the export');
    } finally {
      core.Log.clear();
    }
  });
});
})();
