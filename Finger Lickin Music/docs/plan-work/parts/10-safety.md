## 10. Security, privacy, accessibility, and failure recovery

This part fixes the rules that keep untrusted data inert (10.1), states exactly what the
game stores and transmits (10.2), inventories content and licenses (10.3), rules out
embedded credentials (10.4), lists every accessibility requirement with its mechanism
(10.5), owns the error-code taxonomy (10.6), answers the nine E 11 recovery questions per
subsystem group (10.7), fixes interruption behavior (10.8), defines the fault-injection
hooks (10.9) and the diagnostics content (10.10).

Ownership and precedence:

- 10.6 is the single source of error codes, user texts and classes. `FLM.Core.ErrorReporter`
  (M-01) carries the 10.6 table as data (`CLASS_TABLE`, Part 4.9) and Part 7.11 reproduces
  the user texts verbatim. Where a Part 6 section or Part 5 names a different code or text for
  the same condition, 10.6.12 states which one the implementation uses.
- 10.9 is the single list of fault names accepted by `FLM.debug.inject`; Part 12 FI tests use
  only these names.
- Test categories cited here are the Part 12 categories (UT, IT, FT, TT, PT, XT, FI, LT, AT);
  test IDs are assigned in Part 12.

### 10.1 Untrusted input rules

Untrusted inputs are: every imported file (MIDI, MusicXML, `.mxl`, Guitar Pro, audio), every
project, dance chart, character and settings file the user opens, every stored record read
back from localStorage or IndexedDB (another tab, an older build or a browser extension may
have written it), every network message and pasted invite or answer code, URL parameters,
clipboard text pasted into fields, and every string inside those (titles, track names,
lyrics, markers, display names, file names). The rules below apply to all of them; the
parser-specific algorithms are in Part 6.10 to 6.14 and must satisfy these rules.

#### 10.1.1 Principles

1. Data never becomes code. No input is evaluated, compiled, inserted as markup, used as a
   URL to load, used as a CSS value, used as an object key that can reach a prototype, or
   used as a function or property name to call.
2. Check before allocate. Every length, count or offset read from an input is compared with
   the remaining bytes and with the limits table (10.1.2) before any array, buffer or string
   of that size is created.
3. Bounded work. Every parse loop is bounded by the input size and by the limits; the whole
   import pipeline is bounded by the 5 s budget and yields to the event loop (10.1.4).
4. Typed failure. Every rejection is an `Error` with a `.code` from 10.6; nothing throws an
   untyped exception out of a public parser entry point (`parseAsync`, `importFile`,
   `Project.load`, `Net.validateMessage`).
5. No partial effect. A failed import, load or message leaves the current project, the
   transport and the session state exactly as they were (S-12, Part 4.6).
6. Inert display. Untrusted strings reach the DOM only through `textContent` or
   `createTextNode` (10.1.9) and reach the WebGL glyph atlas only as characters drawn with
   `fillText` on a 2D canvas.

#### 10.1.2 Limits (restated; these numbers are binding everywhere)

| Input | Limit | Enforced by | Check point | Code on violation |
|---|---|---|---|---|
| MIDI, MusicXML (`.xml`, `.musicxml`, `.mxl`), Guitar Pro file size | <= 25 MB (26,214,400 bytes) | M-14 `validateFile` | `File.size` before any byte is read | E-IMP-001 |
| Audio file size | <= 100 MB (104,857,600 bytes) | M-14 `validateFile` | `File.size` before reading | E-IMP-001 |
| Empty file | size 0 refused | M-14 `validateFile` | before reading | E-IMP-003 |
| Events per imported song (channel, meta, notes, directions) | <= 1,000,000 | M-10, M-12, M-13 counters; M-03 `validate` | incremented per event; checked before append | E-IMP-004 (E-MDL-011 inside validation) |
| Tracks declared or parsed | <= 128 (MTrk chunks, MusicXML parts, GP tracks); 32 kept in the model, selection UI above 32 | M-10, M-12, M-13; M-14 | header value before allocation | E-IMP-004 |
| Simultaneous notes per chord in gameplay mapping | 16 (excess kept in the song, flagged) | M-14, M-08 | normalize | warning W-IMP-CHORD-LIMIT |
| Import time budget | 5,000 ms wall time from `importFile` start (parse + normalize + inspect) | M-14 deadline checked at every yield | every 20,000 events and every part or track | E-IMP-005 |
| Song length after rescale to PPQ 960 | tick <= 2,147,483,647 | M-10, M-12, M-13 | per delta accumulation | E-IMP-004 |
| SMF variable-length quantity | at most 4 bytes; value <= 0x0FFFFFFF | M-10 VLQ reader | per read | E-IMP-003 |
| SMF chunk length | <= remaining bytes | M-10 | per chunk header | E-IMP-003 (truncated chunk is read up to the file end with warning W-MIDI-TRUNCATED where Part 6.10 allows recovery) |
| ZIP central directory entries | <= 256 | M-11 `read` | before allocating the entry list | E-IMP-004 |
| ZIP uncompressed size per entry and in total | <= 50 MB each, <= 50 MB summed | M-11 | declared sizes before inflating; actual output counted during inflate | E-IMP-004 |
| ZIP compression ratio per entry | uncompressed / compressed <= 100 | M-11 | declared sizes before inflating | E-IMP-004 |
| ZIP features | ZIP64, encryption, methods other than 0 (stored) and 8 (deflate) refused | M-11 | central directory parse | E-IMP-006 |
| ZIP entry name | <= 512 bytes; never used as a file-system path, URL or DOM id | M-11 | decode | truncation, no error |
| MusicXML text | <= 25 MB UTF-8 after `.mxl` extraction | M-12 | before `DOMParser` | E-IMP-001 |
| MusicXML structure | <= 128 parts, <= 10,000 measures per part, <= 40,000 measures after repeat expansion, `times` clamped to 16, grace chain <= 8 | M-12 | per element | E-IMP-004, or warning W-XML-REPEAT-CAP for the expansion cap |
| MusicXML DOCTYPE with `<!ENTITY` | refused | M-12 | text pre-scan before `DOMParser` | E-IMP-014 |
| Guitar Pro structure | <= 128 tracks, <= 10,000 measures, <= 1,000,000 notes; every string length prefix <= remaining bytes | M-13 | per header and per string | E-IMP-004 or E-IMP-003 |
| Decoded audio buffer | <= 192 MB desktop (`Caps.maxTouchPoints === 0`), <= 64 MB otherwise; <= 7,200 s | M-14 `decodeAudio` | after decode, before the buffer is retained | E-IMP-004 |
| Project JSON text (`.flm.json` or a stored record) | <= 64 MB (`text.length` UTF-16 units; checked before `JSON.parse`) | M-15 `parse` | first step | E-PRJ-010 |
| Project JSON structure | nesting depth <= 32; object and array count <= 5,000,000 | M-15 pre-scan (counts `{` and `[` outside strings) | before `JSON.parse` | E-PRJ-010 |
| Project content | <= 32 tracks, <= 1,000,000 events in total, <= 100,000 events per track for edits, <= 5 characters (extras dropped with warning W-PRJ-SLOT-FIXED) | M-15 `validate`, M-15 commands | after migration; per command | E-PRJ-009, E-PRJ-020, E-PRJ-023 |
| Project unknown fields | kept under `x`; `x` > 64 KB truncated | M-15 | validation step 21 (Part 5.6) | warning W-PRJ-X-TRUNCATED |
| Settings document | <= 64 KB; unknown keys kept under `x`; out-of-range values clamped | M-16 `loadSettings` | before parse | defaults plus E-STO-008 when unreadable |
| Dance chart file (`.flmdance.json`) | <= 2 MB text, <= 20,000 steps, depth <= 8 | M-23 `importChart` | before parse | E-IMP-017 |
| Character file (`.flmchar.json`) | <= 16 KB text; validated by `Character.validate` | M-22 | before parse | E-IMP-018 |
| Settings backup (`.flmsettings.json`) | <= 64 KB text | M-16 | before parse | E-IMP-018 |
| Network message | <= 65,536 bytes UTF-8, JSON depth <= 8, strict per-type schema (Part 5.16) | M-24 `validateMessage` | before `JSON.parse` (byte length) and after (schema) | dropped and counted; E-NET-010 on disconnect |
| Avatar payload (`CharacterConfig` over the network) | <= 4 KB | M-24 | `hello` and `avatar` | dropped and counted |
| Messages per peer | 60 per second (1 s sliding window); excess dropped (`input` first); over the rate in 3 consecutive seconds -> disconnect that peer | M-24 `RateLimiter` | per message | E-NET-011 |
| Invalid messages per peer | 20 in 10 s -> disconnect that peer | M-24 | per invalid message | E-NET-010 |
| Pasted invite or answer code | <= 16,384 characters, alphabet `A-Z a-z 0-9 - _` only, decoded JSON <= 12,288 bytes with exactly `{v, role, sdp}` | M-24 `decodeCode` | before base64url decode | E-NET-001 |
| Display name | 1-24 characters after trimming; code points below 0x20 removed | M-24, M-27 field | on input and on receive | normalized, no error |
| Relay URL (`net.relayUrl`, `?online=`) | `ws:` or `wss:` scheme, <= 200 characters, parsed by `new URL` | M-16 settings validation, M-29 `applyUrlParams` | on set and at boot | value rejected with a Log warning |
| URL parameters | whitelist `test`, `tier`, `diag`, `online`, `perf`; `tier` in the tier list | M-29 | boot step B2 | ignored with a Log warning |
| Strings shown in the UI | any length stored; display truncated by `UI.truncate(text, max)` with an ellipsis and the full text in the element `title` attribute (set with `setAttribute`, which is inert) | M-26 | render | none |

#### 10.1.3 Bounds-checked reading

1. Binary readers (M-10, M-11, M-13) read through one cursor object per buffer:
   `{bytes:Uint8Array, pos:int, end:int}` with methods `u8()`, `u16be()`, `u32be()`,
   `u16le()`, `u32le()`, `i8()`, `vlq()`, `bytes(n)`, `skip(n)`, `ascii(n)`, `latin1(n)`.
   Every method checks `pos + width <= end` before reading and throws `ParseError` with
   `.code = 'E-IMP-003'` and `.offset = pos` otherwise. `bytes(n)` returns a `subarray` (no
   copy) after checking `n >= 0 && pos + n <= end`. No code reads `bytes[i]` directly outside
   the cursor except the inflate inner loop of M-11, which checks its own window bounds per
   symbol.
2. Sub-cursors: a chunk or record with a declared length gets its own cursor with `end =
   min(parent.end, parent.pos + declared)`; overrunning the sub-cursor never reads into the
   next chunk.
3. Declared counts are checked against the limits table and against the remaining bytes
   divided by the minimum record size before allocation (for example a GP track count `n`
   must satisfy `n <= 128` and `n * minTrackBytes <= remaining`).
4. Integers are kept within the safe range: 32-bit values are read with `>>> 0`; products
   used as sizes are checked with `Number.isSafeInteger` before use.
5. No recursion depends on input depth. XML is walked with an explicit stack; JSON depth is
   checked before `JSON.parse` (10.1.8); MusicXML repeat expansion is iterative with the
   40,000-measure cap.
6. Text decoding uses `TextDecoder('utf-8', {fatal:false})` (replacement characters, never an
   exception) or the Latin-1 table for Guitar Pro strings; decoded strings are length-capped
   by the declared length, never by a terminator search beyond `end`.

#### 10.1.4 Time budgets and yielding

- `FLM.Import.importFile` sets `deadline = Core.now() + 5000`. Parsers run as `parseAsync`
  and yield with `await new Promise(r => Core.timers.setTimeout(r, 0, owner))` after every
  20,000 events and after each track or part; at each yield they check the deadline
  (E-IMP-005) and the cancel flag (E-IMP-011). The longest synchronous slice is therefore
  bounded by 20,000 events of work; the target for one slice is <= 50 ms on the desktop
  reference device of Part 9 (checked by a PT test).
- `decodeAudioData` is asynchronous in the browser and is not time-sliced by the game; the
  5 s budget does not apply to it, the size limits do. A decode that takes longer than 30 s
  is abandoned (the promise result is ignored) with E-IMP-005 and the text variant "Decoding
  this audio file took too long."
- `Project.load` stays synchronous (`JSON.parse` cannot be time-sliced); the 64 MB text cap
  bounds the block. SCR-Library and the file-open path show their "Opening project" state
  and call `Project.load` from a `Core.timers.setTimeout(fn, 0, owner)` so the state paints
  first. The serialization target of the brief (<= 200 ms for 100,000 events) is the PT
  check for this path.
- Chart generation (`ChartGenerator.generateAsync`) yields every 20,000 source events and
  refuses tracks above 50,000 chart notes (E-INP-011, Part 6.8).
- Network validation is O(message size) and runs synchronously; the 64 KB cap bounds it.

#### 10.1.5 File size pre-checks before reading

1. Every file reaches the game as a `File` from `<input type="file">` or from a `drop`
   event's `dataTransfer.files`. `Import.validateFile({name, size})` runs on `File.size`
   before `arrayBuffer()` or `FileReader` is called, so an oversized file is refused without
   being read into memory.
2. The extension and the first bytes decide the format (content first, Part 6.14); the
   size limit used is the one for the presumed kind (`notes` 25 MB, `audio` 100 MB). A file
   with an audio extension whose content identifies as MIDI is held to the 25 MB limit after
   the first 64 bytes are read (`File.slice(0, 64)`), still before the full read.
3. Project and other JSON files (`.flm.json`, `.flmdance.json`, `.flmchar.json`,
   `.flmsettings.json`) are size-checked against their limits (10.1.2) on `File.size` before
   `File.text()`.
4. File names are sanitized for display and for export names (`[A-Za-z0-9 _-]`, 60
   characters) and never used to build a path, URL or selector.

#### 10.1.6 ZIP (`.mxl`) rules

- Only the central directory is trusted for layout; each local header is re-read and must
  agree on method, compressed size and name length, else E-IMP-003.
- The ratio and size checks of 10.1.2 run on declared sizes before inflation, and the
  inflater (M-11) stops with E-IMP-004 as soon as the produced bytes exceed the declared
  uncompressed size or the 50 MB cap, whichever is lower, so a lying header cannot expand
  past the cap.
- CRC32 of every extracted entry is verified (E-IMP-003 on mismatch).
- Only the score named by `META-INF/container.xml` (or the first `.musicxml`/`.xml` entry
  outside `META-INF/`) is extracted; other entries are listed by name only and never
  inflated.

#### 10.1.7 XML (MusicXML) rules

- Parsing uses `new DOMParser().parseFromString(text, 'application/xml')` only. Never
  `text/html`, never XSLT, never `document.implementation.createHTMLDocument` with the text.
- A DOCTYPE is allowed only when it declares no entities; any `<!ENTITY` in the prolog is
  refused before parsing (E-IMP-014). External DTDs are never fetched (CSP `default-src
  'none'` also forbids it).
- The parsed document is never adopted into the page document; elements are read with
  `localName`, `getAttribute` and `textContent` only. A `<script>` or `on*` attribute inside
  the score is inert data.
- `parsererror` documents are refused with E-IMP-015 and the first 160 characters of the
  parser message.

#### 10.1.8 Project, settings and other JSON documents

1. Size check on the text (10.1.2), then the depth and container pre-scan, then
   `JSON.parse` inside try/catch (E-PRJ-001 on a SyntaxError). No reviver function is used.
2. Prototype safety: every deep merge and every copy of untrusted objects (settings merge
   over defaults, `x` namespaces, character options, network payloads) skips the keys
   `__proto__`, `constructor` and `prototype` and logs `W-JSON-PROTO-KEY` once per document.
   Lookups of untrusted keys in tables use `Object.prototype.hasOwnProperty.call(table, key)`
   or `Map`.
3. Schema validation is strict for known fields (type, range, enum, pattern, Part 5.5) and
   unknown fields are preserved under `x` (never interpreted). Validation and migration run
   on a deep clone; the input object and the currently open project are never mutated.
4. Stored records are untrusted: records read from localStorage or IndexedDB pass the same
   `Project.load` path as files, plus the hash check of Part 6.16 (E-STO-003).
5. Newer versions are refused (E-PRJ-002, E-IMP-012, E-IMP-013), never "best-effort" loaded.

#### 10.1.9 DOM insertion rules

- Untrusted strings are inserted only with `node.textContent = s`, `document.createTextNode(s)`,
  `input.value = s`, or `el.setAttribute(name, s)` for the attribute names `title`,
  `aria-label`, `aria-valuetext`, `aria-describedby` (ids generated by the UI, never from data),
  `value`, `placeholder` and `data-*`. No other attribute receives untrusted data; in
  particular never `href`, `src`, `style`, `on*`, `id` or `class`.
- `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` and `DOMParser` with
  `text/html` do not appear in `src/` (build check, Part 3.3.4). Static markup lives in
  `shell.html`; dynamic structure is built with `UI.el(tag, props, children)` (M-26), which
  sets only `textContent` and the whitelisted attributes.
- Downloads use Blob URLs created from game-produced bytes; `URL.revokeObjectURL` runs 60 s
  after the click. Imported data is never turned into a navigable URL.
- Clipboard: the game writes to the clipboard (codes, diagnostics) and reads pasted text
  only through `paste` into a `<textarea>` the user focuses; the text is then validated as
  untrusted (10.1.2). `navigator.clipboard.readText` is not used (it triggers a permission
  prompt; P 4 "permissions only when required").

#### 10.1.10 No code execution; CSP

- The page carries exactly the CSP of ADR-12: `default-src 'none'; script-src
  'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:;
  connect-src 'self'` (Online edition: `connect-src 'self' <relay origin>`). Consequences:
  no network fetch of any resource, no external scripts, fonts, images or frames; WebRTC is
  not governed by `connect-src` and is used only by M-24.
- Banned in `src/` (build check, Part 3.3.4, applies to shipped and test builds): `eval(`,
  `new Function(`, `setTimeout('`, `setInterval('`, `import(`, `importScripts`, `fetch(`,
  `XMLHttpRequest`, `navigator.sendBeacon`, `document.write`, `.innerHTML`, `.outerHTML`,
  `insertAdjacentHTML`, inline event-handler attributes, and `javascript:` URLs. Allowed only
  in `24-net.js`: `new WebSocket`, `RTCPeerConnection`.
- No Workers, no `Worklet` modules loaded from strings, no `blob:` script URLs.
- Credential patterns are a build problem (10.4).
- Verification: FT static scan of `FingerLickinMusic.html` for every banned token, for any
  `http:`, `https:`, `ws:` or `wss:` URL (the Standalone file contains none; the only
  network string is `stun:stun.l.google.com:19302`; the Online file adds only its relay URL),
  and for a byte-exact CSP meta; XT console check for zero CSP violations per browser.

#### 10.1.11 Network input

- Every received text passes, in order: byte length <= 65,536 (else drop, count invalid),
  `JSON.parse` in try/catch (drop, count), `validateMessage` against Part 5.16 (`v === 1`,
  known `type`, `from` bound to the channel, `seq` strictly increasing per peer, `tSend`
  finite, strict payload fields, depth <= 8, strings without code points below 0x20), then
  the per-type rules (Part 5.16). Only then is any field read by game code.
- Duplicates and stale `seq` values are dropped and counted as `dupes` (not as invalid);
  they never cause a disconnect. Malformed, oversize, unknown-type or wrong-sender messages
  count as invalid; 20 invalid in 10 s disconnects the peer (E-NET-010).
- Scores, judgments and room state are computed by the host only. A guest's `scoreUpdate`,
  `roomState`, `start`, `resume` or `selectChart` is invalid (wrong sender). Host-side input
  validation: `tShared` within +/- 2 s of the host position, `iSeq` strictly increasing,
  `control` in the lane or dance set; the host judges inputs with its own copy of the chart
  (equal `settingsHash`), so impossible scores cannot be submitted (E 8.3).
- A guest's `judgeOffsetMs` is clamped to -500..500 by the host; local clocks of guests are
  never trusted for judgment (clock offset is estimated by the host-side ping exchange, so
  changing the local system clock has no effect: audio clocks are used, not `Date.now()`).
- Messages for a song that is not active (`songId` or `settingsHash` mismatch with the
  current room state) are dropped and counted as stale.

#### 10.1.12 Verification summary

| Rule | Test categories |
|---|---|
| Limits table (every row) | UT per module (Part 6 tests); FT with the in-memory oversize buffers built by `92-test-files.js` and the committed "huge declared count over a short body" corpus files (Part 3.6.2, Part 8.9) |
| Bounds-checked reading | UT cursor overrun tests; FT on the truncated corpus variants (`*.trunc-<n>.*`, Part 8.9), each returning a result or a typed error and never throwing out of `parseAsync` |
| Time budget and yielding | PT 25 MB SMF built in memory; UT `budgetMs:0` |
| ZIP bomb and lying headers | FT corpus rows for a ratio bomb and for a local header that disagrees with the central directory (Part 8.9 names the files) |
| XML entities and inert script | FT corpus rows for an entity-declaring DOCTYPE and for a `<script>` inside `<credit-words>` (sentinel `window.__pwned` stays undefined) |
| Prototype keys | UT settings merge and project `x` with `__proto__` keys; `({}).polluted === undefined` afterwards |
| DOM insertion | UT DOM audit: rendering a song titled `<img src=x onerror=alert(1)>` produces a text node with that literal text and no element |
| CSP and banned APIs | FT static scan of the shipped file; XT console |
| Network validation | UT one test per malformed-message class; FI `net.duplicate`, `net.reorder`; IT flooding peer is disconnected after the thresholds |

### 10.2 Privacy

Decisions (B 23.2, I 9.4, I 10.5, I 13.2, P 13, P 19): no telemetry, no analytics, no
accounts, no crash reporting to any server, no third-party requests. The Standalone edition
sends nothing over any network unless the user opens SCR-Multiplayer and connects. The CSP
`connect-src 'self'` and the build ban on `fetch(`, `XMLHttpRequest` and `sendBeacon`
(10.1.10) make this mechanical, not a promise.

#### 10.2.1 What the game stores, and where

Everything below stays in the browser profile on the user's device under the origin of the
page (for `file://` that is the browser's file origin, Part 6.16). Nothing is copied
elsewhere.

| Data | Location | Contents | Contains personal data | Removed by |
|---|---|---|---|---|
| Settings | localStorage `flm.v1.settings` (+ `.bak`) | Part 5.11 document, including `net.displayName` and `net.relayUrl` | the display name the user typed | "Delete all local data"; browser site-data clearing |
| Project index | localStorage `flm.v1.projects.index` | names, dates, sizes of saved projects | project names the user chose | same |
| Projects and checkpoints | IndexedDB `flm-db` store `projects`; localStorage mirror `flm.v1.project.<id>` (+ `.bak`) | song data, recordings (MIDI takes), charts, characters, mixer | imported song titles, artist names and lyrics from the user's files | deleting the project; "Delete all local data" |
| Rendered audio captures | IndexedDB `recordings` | `AudioCapture` blobs (Part 5.15) | audio the user rendered | deleting the project; same |
| Imported custom dance charts | IndexedDB `charts` | `DanceChart` documents | chart names | same |
| Character roster | localStorage `flm.v1.characters`; IndexedDB `characters` | `CharacterConfig` presets | preset names | same |
| Progression | localStorage `flm.v1.progress.*` | performance history (song id, difficulty, instrument, score, accuracy, settings flags, date), personal bests, unlocks, daily challenge | dates of play | "Reset progress" in SCR-Settings; same |
| Concurrent-tab lock and last session | localStorage `flm.v1.lock`, `flm.v1.lastSession` | tab id, project id, timestamps | none | same |
| Crash recovery copy | localStorage `flm.v1.recovery` (Part 4.9) | the unsaved project at a `reload`-class error | as projects | offered once at next boot (E-PRJ-014); removed after Open or Discard |
| Log ring buffer and error list | memory only (500 entries, 50 errors) | events, codes, timings | none by construction (no song content) | page close; never persisted |

"Delete all local data" (SCR-Settings > Privacy, confirmation dialog listing the items
above, destructive button "Delete everything"): removes every localStorage key starting
with `flm.v1.` and clears all four IndexedDB stores, then reloads the page. It never runs
without the confirmation and offers "Export projects first" as the dialog's secondary
action.

SCR-Settings > Privacy shows this exact text:

```text
Privacy
Finger Lickin Music does not collect, send or sell any data. It has no accounts, no
analytics and no advertising. Your settings, projects, recordings and scores are stored
only in this browser on this device. Clearing this browser's site data deletes them, so use
Export to keep backups.
Nothing is sent over the network unless you start or join a multiplayer session.
```

#### 10.2.2 What multiplayer transmits

Transmitted data is exactly the Part 5.16 message set. Grouped for the user:

| Data | Message types | Sent to | Why | Retained by the receiver |
|---|---|---|---|---|
| Display name (1-24 characters) | `hello`, `roomState` | every player in the room | identify players in the lobby and results | in memory for the session; never stored |
| Avatar configuration (`CharacterConfig`, <= 4 KB; colors, body, clothing options, instrument) | `hello`, `avatar`, `roomState` | every player | show remote performers | in memory for the session |
| Inputs (lane or dance control, press or release, shared time stamp, sequence number) | `input` | the host | host-authoritative judging | in memory until results; not stored |
| Scores and judgments | `scoreUpdate` | every player (from the host) | shared scoring | the results screen; each player's own result is stored locally in their progression history, others' are not stored |
| Room state (room code, mode, song id, song title, duration, chart settings hash, position, ready flags, latency and clock offset estimates) | `roomState`, `ready`, `selectChart`, `start`, `pause`, `resume`, `ping`, `pong`, `leave`, `error` | every player | synchronization | in memory for the session |
| Connection metadata (session descriptions with ICE candidates: local and, with STUN, public IP addresses and ports) | invite and answer codes, exchanged by the users themselves | the other player, through whatever channel the users use to share the code | establish the peer-to-peer connection | wherever the users pasted the code |
| ICE binding requests (public IP discovery) | STUN, only when the STUN toggle is on | `stun.l.google.com` (operated by Google) | NAT traversal | per Google's policy; the game sends nothing else there |

Never transmitted: song files or song content (players must have the same built-in song or
a song matched by `sourceHash`; Part 5.16 `selectChart`), project data, recordings, settings
other than those listed, calibration values other than the clamped `judgeOffsetMs`, file
names, browser or device details other than the `mobile` flag in `hello`, the log or
diagnostics.

Peer-to-peer sessions involve no server storage at all. The optional relay
(`server/relay.mjs`, Online edition) forwards message texts without parsing them, keeps
rooms only in memory, writes nothing to disk, and logs no IP address, room code, user agent
or payload at any log level (Part 3.7.5).

Privacy statement shown on SCR-Multiplayer above the Create and Join controls, every time
the screen opens (constant `FLM.Net.PRIVACY_TEXT`; Part 7.11 reproduces it):

```text
What multiplayer shares
When you create or join a session, these are sent to the other players: your display
name, your character's appearance, your button presses during songs, your scores, and the
room state (song, settings, ready status, timing). Nothing else is sent, and nothing is
stored by any server.
Direct sessions connect your device to the other players' devices. The invite and answer
codes contain network addresses; share them only with people you want to play with.
With "Use public STUN server" on, your device also contacts stun.l.google.com (a Google
service) to find its public address.
Online edition only: messages pass through the relay server at {relayUrl}, which forwards
them and keeps nothing.
```

The last paragraph is omitted in the Standalone edition; `{relayUrl}` is the configured
relay URL inserted with `textContent`.

#### 10.2.3 Diagnostics and privacy

The diagnostics export (10.10) is produced only when the user presses "Export diagnostics"
or "Copy diagnostics"; it is a local file or clipboard text the user decides to share. It
contains no song content, titles, file names, display names, room codes or session
descriptions unless the user ticks "Attach current song" (which adds only the song, not the
other items). Error messages shown to users never include stack traces, file-system paths
or raw exception text; the only user-visible text derived from a library message is the
first 160 characters of a browser XML parser message about the user's own file (E-IMP-015).

#### 10.2.4 Verification

| Check | Category |
|---|---|
| No network request during a full offline session of every local mode (Playwright request interception counts 0 requests after page load) | IT, XT |
| Static scan: no `fetch(`, `XMLHttpRequest`, `sendBeacon`, external URLs (10.1.10) | FT |
| Message set equals Part 5.16; a test enumerates `MESSAGE_TYPES` and the payload fields and compares with the 10.2.2 table | UT |
| Relay logs contain no IP, room code or payload at `debug` level (relay `--selftest` greps its own output) | IT |
| "Delete all local data" leaves zero `flm.v1.` keys and empty stores | IT |
| Diagnostics redaction (10.10.2 content rules) | UT |
| Privacy texts present verbatim on SCR-Settings and SCR-Multiplayer | UT (screen text audit) |

### 10.3 Licensing

#### 10.3.1 Included content inventory

Every byte of `FingerLickinMusic.html` is original to this project. There are no
third-party libraries, fonts, sound samples, sound banks, images, 3D models, textures,
shaders or melodies (ADR-02; runtime dependency inventory has zero rows, Part 2.17).

| Content | Origin | License | Where |
|---|---|---|---|
| Application code (all `src/*.js`, `shell.html`) | written for this project | the game's license (10.3.3) | whole file |
| Instrument patches, drum voices, reverb impulse | procedurally synthesized at runtime from parameters written for this project | the game's license | `06-instruments.js`, `05-audio.js` |
| Five demo arrangements and the tutorial sequence | composed for this project as compact note data; no existing melody, chord-progression-plus-melody pairing, riff or lyric is reproduced | the game's license | `30-content.js` |
| Character options and presets, stage props | procedural geometry from capsules and boxes, parameters written for this project | the game's license | `19-rig.js`, `21-stage.js`, `22-character.js`, `30-content.js` |
| Glyphs and icons (SVG paths in the shell sprite) | drawn for this project | the game's license | `shell.html` |
| Fonts | none embedded; the system font stack is used | not applicable | CSS |
| General MIDI program and drum names | the GM 1 sound set names (factual identifiers used for interoperability) | not copyrightable data; no MMA document text is copied | `02-theory.js` |
| Format knowledge (SMF, MusicXML, ZIP, Guitar Pro 3-5 layouts) | written from public format descriptions; no third-party source code is copied | not applicable | `10-midi.js` to `13-guitarpro.js` |
| Trademarks named in the UI (Guitar Pro, MusicXML, General MIDI, Google STUN, browser names) | used only to name formats, services and browsers | nominative use; no logos | text only |
| Test corpus (`test-corpus/`) | generated by `tools/make-corpus.mjs` from seeds | the game's license; not shipped in the HTML | repository only |

Rules that keep the inventory true:

1. Adding any third-party asset or code requires a new row in Part 2.17 and in this table
   with license text, and an owner decision recorded in `docs/LEDGER.md`; the default answer
   in v1 is no.
2. Demo content review (Phase 16 gate item): each demo arrangement's lead melody is checked
   by the implementer against the rule "no 8 consecutive notes of pitch-and-rhythm identical
   to a known melody the implementer can name"; the check and its result are recorded in
   `docs/FINAL-REPORT.md`. Titles are original (no existing song titles).
3. The FT static scan fails on `@license`, `Copyright (c)` strings other than the game's own
   notice, and on base64 `data:` payloads larger than 4 KB (none are planned), which would
   indicate an embedded asset.

#### 10.3.2 About screen license text

SCR-About shows, in this order: the game name and `FLM.VERSION`, build date, edition
sentence (Part 1.4), the license notice of 10.3.3, then this block verbatim:

```text
Credits and licenses
Finger Lickin Music is a single file. All code, sounds, music, characters and graphics in
it were made for this game. It contains no third-party libraries, fonts, sound banks,
samples or 3D models, so there are no third-party licenses to list.
Instrument sounds are synthesized in real time; they approximate General MIDI instruments
and are not recordings of real instruments.
General MIDI, MusicXML and Guitar Pro are named only to describe file formats and
instrument sets. They are trademarks of their respective owners. This game is not
affiliated with or endorsed by them.
The optional public STUN server stun.l.google.com is operated by Google and is used only
when you turn it on in Multiplayer.
```

followed by the "Limits of this version" block of Part 1.5.

#### 10.3.3 License of the game itself (owner decision)

The license under which the game is published is an owner decision, not a plan decision.
Until the owner records a choice in `docs/LEDGER.md`, the repository and the About screen
use this notice, stamped by the build from the constant `LICENSE_NOTICE` in `01-core.js`:

```text
Copyright (c) 2026 the Finger Lickin Music authors. All rights reserved.
```

When the owner chooses a license (for example MIT), the implementer replaces
`LICENSE_NOTICE` with the license's short notice, adds the full license text as
`Finger Lickin Music/LICENSE` and to SCR-About below the notice, and updates `README.md`.
The final report lists the notice in force (final release checklist item). The game's own license
never affects the content inventory above because no third-party content exists.

### 10.4 Online credentials

1. No credentials of any kind are embedded: no API keys, tokens, passwords, client
   secrets, signed URLs or private server addresses. The build fails (Part 3.3.4 banned-text
   check extended with these patterns, as ADR-12 decision 6 requires) when the joined script
   or the shell matches any of, case-insensitive: `api[_-]?key`, `secret`, `token=`,
   `bearer `, `password`, `passwd`, `authorization:`, `private[_-]?key`, `-----BEGIN`.
   The patterns are chosen so that legitimate identifiers such as the Part 5.16 field
   `resumeToken` do not match.
2. The only network endpoints in the shipped Standalone file are the STUN constant
   `stun:stun.l.google.com:19302` (public, unauthenticated, used only when the user enables
   it; off by default) and no relay. The Online edition additionally embeds the relay URL
   given to `--online` at build time; that URL is public by nature (any player must reach
   it) and grants nothing by itself.
3. The relay URL is a user setting (`net.relayUrl`), validated as `ws:` or `wss:` and <= 200
   characters (10.1.2). The game never sends credentials to it; the relay has no
   authentication, no admin endpoint and no configuration file (Part 3.7.5).
4. Security model for a publicly distributed client (B 23.4, E 8.3):
   - Authority: the host's client is authoritative for room state, start times and scores;
     guests cannot change them (10.1.11). The relay is a dumb pipe and is never trusted.
   - Room access, direct sessions: possession of an invite code is the authorization; each
     invite code is single-use (one guest slot, one offer) and the host sees each joining
     player's name before the lobby admits them.
   - Room access, relay sessions: room codes have 32^6 (about 1.07 x 10^9) values and expire
     after 10 minutes idle; because a code can be guessed or forwarded, a player joining by
     room code appears in the host's lobby as "Waiting for approval" and is admitted only
     when the host presses "Admit"; "Decline" sends `error E-NET-020` and closes that peer.
     A declined or kicked `peerId` cannot rejoin the same room for 60 s.
   - Abuse limits: message size, rate and invalid-message thresholds of 10.1.2 apply to every
     peer, including the host as seen by guests (a guest disconnects from a host that floods
     it or sends invalid data, with E-NET-011 or E-NET-010).
   - Repeated reconnection attempts: a host accepts at most 3 reconnect handshakes per
     `peerId` per 60 s window; further attempts are refused with E-NET-015.
5. Verification: FT credential-pattern scan of the shipped and online files; UT admission
   flow (unadmitted peer's messages other than `hello`, `ping`, `pong` and `leave` are
   dropped); IT relay session where a third client joins with the code and is declined; FI
   `net.duplicate` with replayed `hello` from a declined peer.

### 10.5 Accessibility requirements

Targets used below: text contrast >= 4.5:1 against its background (>= 3:1 for text >= 24 px
or >= 18.66 px bold), non-text indicators that carry required information (focus ring, lane
glyphs, slider track and thumb, text-field boundary, toggle state) >= 3:1, both in the
default and the high-contrast token sets of Part 3.2.2. Decorative borders (`--c-line`) carry
no required information; the essential boundary of a slider track, text field or unchecked
toggle is drawn with `--c-text-dim` or stronger. Gameplay itself (hitting notes in time) is
not made screen-reader playable; menus, settings, library, results, help and dialogs are.

#### 10.5.1 Requirement table

| Spec | Requirement | Implementation | Where (module, screen) | Test category |
|---|---|---|---|---|
| B 22, I 15, P 5.1 | Remappable controls (keyboard and touch) | Keyboard: every action of `input.keys.*` (lanes, dance, dance alternates, pause, panic, octave up and down, six profile keys, sustain) is rebindable by "press a key" capture; MIDI lane notes; conflicts are detected and offered as a swap in DLG-RemapConflict ("{key} is already used for {action}. Swap the two?"); keys the browser reserves (`Tab`, `F5`, `F11`, `F12`, `MetaLeft`, `MetaRight`, `ContextMenu`) are refused with E-INP-005; "Reset controls" restores the brief defaults. Gamepad: the standard-mapping layout of Part 6.7 is fixed in v1 (not remappable; stated on SCR-Settings Controls). Touch: pad placement (`input.padLayout`), size, opacity | M-07 (`remap`, `conflicts`), M-16 settings, SCR-Settings Controls | UT, IT |
| B 22, I 15 | Adjustable note speed | `calibration.visualLeadMs` 600-3,000 ms shown as "Note speed x0.5 to x2.5" (`1500 / visualLeadMs`); applies to instrument and dance highways and to the Abstract tier | M-21, M-18 `Flat2D`, SCR-Settings Gameplay, SCR-Pause | UT, IT |
| B 22, P 15 | Adjustable difficulty | four instrument difficulties, three dance difficulties, practice speed 0.25-2.0 (Transport speed), section loop | M-08, M-23, M-04, SCR-QuickPlay, SCR-Instrument, SCR-Dance | UT, IT |
| B 22, I 15, P 15 | Configurable timing windows where appropriate | `gameplay.judgmentPreset`: standard, relaxed (windows x1.5), strict (x0.75); results with a non-standard preset or speed != 1.0 are stored `comparable:false` and labeled "Practice settings" on SCR-Results; multiplayer requires `standard` (E-NET-006) | M-09, M-25, SCR-Settings Gameplay, SCR-Results | UT |
| P 5.3 | Accessibility adjustments distinguished where they affect competitive scoring | the "Practice settings" badge (text plus icon) on results and history rows; personal bests compare only comparable results | M-25, SCR-Results, SCR-Library | UT |
| B 22, I 15 | High-contrast gameplay indicators | `video.highContrast` sets `html.high-contrast` (token set of Part 3.2.2): white 2 px lane outlines, pure black surfaces, white focus ring; the WebGL highway and `Flat2D` read the same tokens through `getComputedStyle` at stage build and on `settings.changed`; `accessibility.laneGlyphs` is forced on | M-26, M-21, M-18, SCR-Settings Accessibility | UT (token resolution and contrast computation), LT |
| B 22, B 3.3 | Visual feedback for audio events | every gameplay sound has a visual: hit flash on the lane, judgment word, combo counter, beat indicator driven by `sched.beat`, metronome visual pulse in Free Play and Studio, count-in numbers, peak meters in the mixer; `accessibility.flashOnBeat` adds a HUD border pulse on downbeats | M-21, M-26 HUD, M-20 `BeatIndicator` | IT |
| B 22, I 15, P 15, P 12 | Optional reduced motion | `video.reducedMotion` (`system`, `on`, `off`); effective reduced motion sets `html.reduced-motion`: camera cuts become instant and camera drift stops, particles are off, judgment pop scaling and panel slides are off, stage light sweeps stop; the highway scroll, hit flash and beat indicator stay (gameplay information, Part 3.2.2); dance choreography amplitude is scaled to 40 percent | M-26, M-20 `StageDirector`, M-21, M-23 `ChoreographyController` | UT, IT |
| B 22, I 15, P 15 | Scalable UI; text readable at supported scaling | `video.uiScale` 0.8-1.5 drives `--ui` (all sizes in rem); at every scale and at 360 x 640 and 640 x 360 CSS px no horizontal scrolling and no clipped text (P 2.2); text carrying required information uses `--fs-2` or larger (>= 11.2 px at scale 0.8); `--fs-1` is used only for captions and diagnostics | M-26 `Layout.setScale`, CSS S05, SCR-Settings Accessibility | IT (Playwright layout audit at scales 0.8, 1.0, 1.5), XT |
| B 22, I 15, P 15, P 14 | Keyboard navigation for menus; usable without a mouse | `Tab`/`Shift+Tab` move through controls in DOM order; menus and lists use one tab stop with `ArrowUp`/`ArrowDown` (roving `tabindex`), `Home`/`End`; `Enter` and `Space` activate; `Escape` closes the top dialog or goes back one screen (never leaves gameplay without SCR-Pause); tabs use `ArrowLeft`/`ArrowRight`; the main menu has the first entry focused on open | M-26 `Focus`, `Widgets`, every SCR-* in M-27 | IT (keyboard-only walk of every screen) |
| P 14, P 21 | Sliders, numeric fields and editors usable with keyboard and touch | sliders are `<input type="range">` with `ArrowLeft`/`ArrowDown` -1 step, `ArrowRight`/`ArrowUp` +1 step, `PageUp`/`PageDown` 10 steps, `Home`/`End` min and max, and touch drag; `aria-valuetext` carries the value with its unit ("120 BPM", "-30 ms", "80 percent"). Piano roll: arrows move the selection by one grid step or one semitone, `Shift+ArrowLeft`/`Shift+ArrowRight` shorten or lengthen by one grid step, `Delete` removes, `Ctrl+C`/`Ctrl+V` copy and paste, `Ctrl+Z`/`Ctrl+Shift+Z` undo and redo, `N` adds a note at the cursor; touch long-press selects, drag moves | M-26 `Widgets.slider`, `Widgets.number`; SCR-Studio piano roll (M-27, M-17) | UT, IT |
| B 22, P 15 | Accessible labels for controls; screen-reader labels | every interactive element has an accessible name: visible text, or `aria-label` for icon buttons (for example "Play", "Mute track {name}"); fields have `<label for>`; disabled controls use `aria-disabled="true"` plus `aria-describedby` pointing to the visible reason text; canvases are `aria-hidden`; each screen has one `<h1>` title; with `accessibility.screenReaderLabels` the HUD exposes a polite live region updated at most once per second with "Score {n}, combo {n}, accuracy {n} percent" and section names | M-26, M-27, `#overlay` (`role="main"`), `#toast` (`role="status"`) | UT (DOM audit: no focusable element without an accessible name) |
| B 22, B 22 last line, I 15, P 15, P 12 | Non-color-only indication; lanes and directions not identified by color alone | lanes 0-3 carry glyphs circle, triangle, square, diamond and fixed positions; dance directions carry arrows; judgments are words ("Perfect", "Great", "Good", "Miss") with distinct shapes of the hit flash (ring, double ring, dot, cross); success and failure states pair an icon and a word ("Saved", "Save failed", "Connected"); compatibility badges are the words Supported, Partial, Conversion, Unsupported | M-21, M-18 `Flat2D`, M-26 HUD, Part 3.2.5 glyph sprite | UT (render audit in a grayscale filter: every lane distinguishable by glyph id) |
| B 22, I 15, P 15 | Adjustable visual effects; effects reducible without breaking musical feedback | `video.effectsLevel` 0 (off), 1 (reduced: one third of particles, no light sweeps), 2 (full); level 0 keeps hit flash, judgment word, beat indicator and highway | M-21 effects, M-20, SCR-Settings Video | UT |
| I 15 | Optional simplified visualization for lower-powered devices | `video.tier` `abstract` forces the 2D Abstract tier; Low tier for reduced 3D | M-18, SCR-Settings Video | UT, PT |
| B 22, P 15, I 11.4 | Clear error messages that identify the affected operation | every 10.6 user text names what failed and what to do next; dialogs titled "<operation> failed" or "<operation> stopped"; the code is shown in small text for support | M-27 dialogs, 10.6 catalog | UT (catalog lint: every code with a user text has a non-empty action) |
| I 15, P 15 | Clear focus indicators; keyboard focus visible | `:focus-visible` outline 2 px `--c-focus` with 2 px offset (white in high contrast, `--bw` 2 px); focus is never hidden by `outline:none` without the replacement; the focused element is scrolled into view | CSS S01 (Part 3.2.4), M-26 | UT (computed style audit), LT |
| P 3, P 15 | Dialogs manage focus correctly | on open: focus moves to the first field or, without fields, to the primary button, except destructive dialogs, which focus "Cancel"; `Focus.trap` keeps `Tab` inside; `Escape` resolves as Cancel for non-blocking dialogs; on close focus returns to the element that opened the dialog (or the screen's first control if it no longer exists); `aria-modal="true"`, `aria-labelledby` the title | M-26 `dialog`, `Focus` | IT |
| I 15, B 21.1 | Configurable control sizes; large touch targets | pad sizes small 56 px, medium 72 px, large 88 px minimum side; every touch target >= 56 x 56 CSS px with >= 8 px gaps (`--touch-min`, `--sp-2`); no essential control depends on hover | M-26 `TouchPads`, CSS S04 | IT (layout audit of target sizes), XT |
| P 15 | All core actions accessible through supported alternative inputs | equivalence table 10.5.2: every core action has a keyboard, a touch and (in gameplay) a gamepad route | M-07, M-26, M-27 | IT |
| I 15, P 15 | Accessibility settings persist and apply consistently across modes | all keys above live in the settings document (Part 5.11), are applied at boot step B6 before the first screen, and are read by every mode through `settings.changed`; instrument, studio and dance HUDs use the same tokens, glyphs and pads | M-16, M-26, M-28 | IT (set, reload, verify in each mode) |
| P 15 | Disabled controls explain why | the disabled main-menu entries and settings rows show their one-line reason (Part 4.3 gate texts) as visible text, not only a tooltip | M-26, SCR-MainMenu, SCR-Settings | UT |
| P 4 | Permissions requested only when required | Web MIDI access is requested only when the user enables MIDI input; clipboard read is never requested; no other permission exists | M-07, M-24 | UT |
| B 6.4 | Minimal text entry during gameplay | no text fields on gameplay screens; names are entered before or after play | M-27 | IT |

The viewport meta disables pinch zoom (`user-scalable=no`, Part 3.2.1) so a double tap on a
pad never zooms; the in-app `video.uiScale` setting replaces browser zoom for UI scaling and
is reachable from SCR-FirstLaunch step 5 and SCR-Settings Accessibility. Desktop browser zoom
(`Ctrl` plus `+`) remains functional and the layout rules above hold at 200 percent browser
zoom on a 1280 x 800 window.

#### 10.5.2 Input equivalence for core actions (P 1, P 15)

| Action | Keyboard | Touch | Gamepad (standard mapping) |
|---|---|---|---|
| Lanes 0-3 | `KeyA KeyS KeyK KeyL` (remappable) | four pads | face buttons 0, 1, 2, 3 |
| Dance directions | arrows, alternates `KeyD KeyF KeyJ KeyK` | four direction pads | d-pad 14, 13, 12, 15 (left, down, up, right) and face buttons 2, 0, 3, 1 |
| Pause and resume | `Escape` | pause button in the HUD corner (56 px) | button 9 (start) |
| Panic | `KeyP`, `Space` while paused | SCR-Pause "Stop all sound" button | button 8 (select) |
| Octave down and up (Free Play, Studio) | `KeyQ`, `KeyE` | octave buttons beside the pads | buttons 4 and 5 (LB, RB), d-pad down and up |
| Profile switch (Free Play, Studio) | `Digit1`-`Digit6` | profile selector in the collapsible panel | not mapped (keyboard or touch route) |
| Sustain | `ShiftLeft`, `ShiftRight` | sustain toggle button | triggers 6 and 7 |
| Menu navigation | `Tab`, arrows, `Enter`, `Escape` | tap | not mapped in v1 (menus are reached by keyboard or touch; Part 6.7 menu context has no gamepad controls) |
| Transport play, stop, record (Studio) | transport bar buttons reached with `Tab` and activated with `Enter` (no single-key shortcut, because `Space` is panic while paused, Part 6.7) | transport bar buttons | not mapped (keyboard or touch route) |

The gamepad column restates Part 6.7 `DEFAULT_MAPS`; Part 6.7 governs if they ever differ.

### 10.6 Error taxonomy

#### 10.6.1 Code format and rules

- Format `E-<FAMILY>-<nnn>`: three upper-case letters (four for `MODE`) and three digits.
  Families for user-visible conditions: `CAP` capabilities, `AUD` audio, `REN` rendering,
  `IMP` import, `STO` storage, `PRJ` project, `NET` multiplayer, `INP` input and chart
  mapping, `EXP` export. Internal families (never shown as such; they surface through a
  user-visible code or only in the log): `GEN` general, `MODE` mode manager, `MDL` model
  validation, `TRN` transport. Warnings use `W-<AREA>-<NAME>` and are not errors (they are
  `ImportWarning` or `Log` entries, owned by Part 5 and Part 6).
- Classes (Part 4.9): `recoverable` (the operation failed, the mode continues),
  `returnToMenu` (the mode is left with full teardown and a dialog on SCR-MainMenu),
  `reload` (`#fatal`; the page state cannot be trusted).
- "Shown as": `toast` (M-26, `#toast`, 6 s, at most once per code per 10 s), `dialog` (M-27,
  `DLG-*` named), `notice` (persistent one-line bar on the named screen until the condition
  ends), `inline` (error state inside the screen that started the operation, for example
  SCR-ImportInspect), `fatal` (`#fatal`), `log` (Log and Diagnostics only, no UI).
- User text rules: one or two sentences; first names what failed, then what the user can do;
  no stack traces, internal identifiers, file-system paths or exception text (10.2.3); the
  code itself is shown below the text in `--fs-1` monospace for support ("Code: E-STO-001").
  Placeholders `{name}` are filled with `textContent`.
- "Data at risk" answers E 11 "whether user data is at risk" for that condition: `none`,
  `unsaved edits` (the in-memory project is intact and exportable, but not persisted), `the
  take` (the recording in progress), `the saved copy` (a damaged stored record), or a
  stated item.
- `ErrorReporter.classify(code)` returns the class from these tables (`CLASS_TABLE` in
  `01-core.js` is generated from them by hand and checked by a UT that compares it with a
  copy of this part's code list); unknown codes are logged as E-GEN-000 with the original
  code in `context.original` and class `recoverable`.

#### 10.6.2 E-CAP capabilities

| Code | Raised by | Condition | User text | Class | Shown as; recovery action | Data at risk |
|---|---|---|---|---|---|---|
| E-CAP-001 | M-29 gate B4 | no `AudioContext` or `webkitAudioContext` | This browser has no Web Audio support, so nothing could play. Use a current version of Chrome, Edge, Firefox or Safari. | reload | fatal; Reload, Copy diagnostics | none (nothing was loaded) |
| E-CAP-002 | M-29 gate B4 | 2D canvas context unavailable | This browser cannot draw graphics. Use a current version of Chrome, Edge, Firefox or Safari. | reload | fatal | none |
| E-CAP-003 | M-29 gate B4 | `requestAnimationFrame` missing | This browser is missing animation support. Use a current version of Chrome, Edge, Firefox or Safari. | reload | fatal | none |
| E-CAP-004 | shell early handler | the joined script failed to parse or `01-core.js` threw (ES2020 not supported) | This browser is too old to run Finger Lickin Music. | reload | fatal, shown by the shell early handler (Part 3.2.5) | none |
| E-CAP-005 | M-29 gate B4 | `RTCPeerConnection` missing | Multiplayer needs WebRTC, which this browser does not provide. | recoverable | disabled main-menu entry with this reason; relay path still offered in the Online edition | none |
| E-CAP-006 | M-29 gate B4 | `navigator.maxTouchPoints` between 1 and 3 | This device reports fewer than 4 simultaneous touches; chords may need fewer fingers. | recoverable | notice on the HUD the first time touch pads show | none |

#### 10.6.3 E-AUD audio

| Code | Raised by | Condition | User text | Class | Shown as; recovery action | Data at risk |
|---|---|---|---|---|---|---|
| E-AUD-001 | M-05 `init` | the `AudioContext` constructor throws | Audio could not start in this browser. Reload the page; if this keeps happening, try another browser. | reload | fatal; the recovery copy of a dirty project is written first (Part 4.9) | none (recovery copy) |
| E-AUD-002 | M-05 `unlock`, M-28 `enter` | the unlock gesture did not bring the context to `running` within 1,000 ms, or the user cancelled DLG-AudioBlocked | Sound is blocked by the browser until you tap or press a key. Tap Try again. | recoverable | dialog DLG-AudioBlocked with "Try again" and "Cancel"; Cancel keeps the menu | none |
| E-AUD-003 | M-05 | a second context creation was attempted | (none) | recoverable | log | none |
| E-AUD-004 | M-05 Scheduler, M-06 `buildVoice` | a Web Audio node creation or scheduling call threw | Audio was reset after an error. Playback continues. | recoverable | toast; hard panic rebuilds the bus graph (`panic(true)`), the Scheduler re-schedules from the current position | none |
| E-AUD-005 | M-05 `Scheduler.bind` | bind while already bound (programming error) | (none) | recoverable | log; the existing binding is kept | none |
| E-AUD-006 | M-28 leave step 5 | voices still active 350 ms after the soft panic | (none) | recoverable | log; hard panic | none |
| E-AUD-007 | M-05 `statechange`, M-28 | the context left `running` (suspended or interrupted) while the transport was playing or recording, or `resume()` rejected | Sound was paused by the browser. Tap Resume to continue. | recoverable | dialog DLG-ResumeAudio; Resume calls `Audio.unlock()` inside the click handler; gameplay stays paused until it succeeds | the take (stopped and kept for review, 10.8) |
| E-AUD-008 | M-05 | the context reached `closed` without `Audio.close()`, or a hard rebuild failed twice within 10 s | The audio device stopped responding. Your work is safe in memory. Reload the page to restore sound. | returnToMenu | dialog on SCR-MainMenu with "Export project" and "Reload"; the recovery copy is written | unsaved edits (exportable) |
| E-AUD-009 | M-28 visibility return, M-05 | drift between the Scheduler cursor and `positionAt(audioNow)` > 5 ms of song time, re-anchored | (none) | recoverable | log; counted in Diagnostics | none |
| E-AUD-010 | M-17 `Recorder.start` | recording requested before audio was unlocked | Sound must be enabled before recording. Tap or press a key, then press Record again. | recoverable | dialog DLG-AudioBlocked; Recorder returns to `armed` | none |
| E-AUD-011 | M-05, on the context's `sinkchange` event where the browser fires it, or a changed `baseLatency` or `outputLatency` read at a scheduler tick | the output device changed during playback | Audio output changed. If timing feels off, run calibration again. | recoverable | toast once per session; the anchor ring is cleared and refilled (Part 4.5.1) | none |

#### 10.6.4 E-REN rendering

| Code | Raised by | Condition | User text | Class | Shown as; recovery action | Data at risk |
|---|---|---|---|---|---|---|
| E-REN-001 | M-18 `init` | neither WebGL2 nor WebGL1 initializes | 3D stage unavailable in this browser; using the flat visualizer. | recoverable | notice on SCR-MainMenu (once per boot); Abstract tier | none |
| E-REN-002 | M-18 | shader compile or link failure in the current tier | Graphics were simplified to {tier} after a graphics error. | recoverable | toast; next lower tier | none |
| E-REN-003 | M-18 `webglcontextlost` | the GL context was lost | Graphics paused. Music and scoring continue. | recoverable | HUD note while lost; audio, transport and judging unaffected (S-15) | none |
| E-REN-004 | M-18 | the context was not restored within 3,000 ms, or restore failed | Graphics could not be restored; using the flat visualizer. | recoverable | toast; Abstract tier for the rest of the page life (user may pick another tier in Settings, which retries) | none |
| E-REN-005 | M-18 | `gl.getError()` returned `OUT_OF_MEMORY`, or buffer or texture creation returned null | Reduced visual quality to keep audio stable. | recoverable | toast; one tier down, resources of the old tier disposed | none |
| E-REN-006 | M-28 auto-tier check | p95 frame time > 33 ms over 5 s (or the low-memory heuristic of Part 4.7.4) | Reduced visual quality to keep audio stable. | recoverable | toast; one tier down; at most one automatic step per 10 s | none |
| E-REN-007 | M-28 auto-tier check | still over budget for 10 s at the Abstract tier | Playback may stutter on this device. Closing other tabs and apps can help. | recoverable | toast once per mode | none |
| E-REN-008 | M-18 frame wrapper | the frame callback threw (origin `frame`, Part 4.9 rule 2) | The stage stopped drawing because of an internal error. Your work is safe. | recoverable (first two in 10 s), returnToMenu (third in 10 s) | log, then the returnToMenu dialog | none |
| E-REN-009 | M-20, M-21 | an instrument has no rig controller or the character lacks an attachment point | (none) | recoverable | log; that performer uses the abstract visualizer for its instrument (E 6.1) | none |

#### 10.6.5 E-IMP import and file opening

Texts for E-IMP-001 to E-IMP-016 are the M-14 catalog of Part 6.14.5 verbatim; the action
column is the button set of SCR-ImportInspect's error state. All E-IMP codes are
`recoverable` except E-IMP-010; none puts user data at risk, because import never touches
the current project (S-12).

| Code | Raised by | Condition | User text | Class | Shown as; recovery action | Data at risk |
|---|---|---|---|---|---|---|
| E-IMP-001 | M-14 `validateFile`, M-12 | file larger than 25 MB (100 MB audio), or MusicXML text > 25 MB | Files larger than 25 MB (100 MB for audio) cannot be imported. | recoverable | inline; Choose another file | none |
| E-IMP-002 | M-14 `identify` | format not recognized | This file type is not recognized. Supported: MIDI (.mid), MusicXML (.xml, .musicxml, .mxl), Guitar Pro 3-5 (.gp3, .gp4, .gp5) and audio files. | recoverable | inline; Choose another file, link to the compatibility matrix | none |
| E-IMP-003 | M-10 to M-14 | malformed, truncated beyond recovery, empty, or an internal parser exception | The file is damaged or not in the expected layout. {detail} | recoverable | inline; Choose another file | none |
| E-IMP-004 | M-10 to M-14 | a limit of 10.1.2 exceeded | The file exceeds an import limit: {detail} | recoverable | inline; Choose another file, limits listed | none |
| E-IMP-005 | M-14 | the 5 s budget (or the 30 s audio decode cap) elapsed | Importing took longer than 5 seconds and was stopped. Try a smaller file or a faster device. | recoverable | inline; Retry, Choose another file | none |
| E-IMP-006 | M-14 `identify`, M-11, M-13 | recognized but unsupported (GP6/GP7, GP1/GP2, RMID, opus, ZIP64, encrypted ZIP) | {format-specific sentence}; for GP6/GP7 exactly: This is a Guitar Pro 6 or 7 file (.gpx or .gp). Only Guitar Pro 3, 4 and 5 files (.gp3, .gp4, .gp5) can be imported. Export the file as GP5 or as MIDI from Guitar Pro and import that. | recoverable | inline; Choose another file | none |
| E-IMP-007 | M-12 `parseMxl` | `.mxl` without a score | The compressed MusicXML archive contains no score. | recoverable | inline | none |
| E-IMP-008 | M-14 `decodeAudio` | `decodeAudioData` rejected | Your browser cannot decode this audio file. WAV files work in every supported browser. | recoverable | inline | none |
| E-IMP-009 | M-14, M-16 `readFile` | reading the file failed | The file cannot be read. Check that it still exists and try again. | recoverable | inline; Retry | none |
| E-IMP-010 | M-28 enter step 7 | chart generation failed for the chosen track and settings | A playable chart could not be made from this track. Choose another track or difficulty. | returnToMenu | dialog on SCR-MainMenu; the song stays in the library | none |
| E-IMP-011 | M-14 `cancel` | user cancelled | Import cancelled. | recoverable | inline message without error styling; returns to the previous screen | none |
| E-IMP-012 | M-23 `importChart` | dance chart file version newer than 1 | This dance chart file needs a newer version of Finger Lickin Music. | recoverable | inline | none |
| E-IMP-013 | M-22 import | character file version newer than 1 | This character file needs a newer version of Finger Lickin Music. | recoverable | inline | none |
| E-IMP-014 | M-12 | DOCTYPE declares entities | This XML declares custom entities, which are not allowed for safety. Re-export the file without a DOCTYPE. | recoverable | inline | none |
| E-IMP-015 | M-12 | XML not well-formed | The XML is not well-formed: {detail} | recoverable | inline | none |
| E-IMP-016 | M-14 | an import is already running | An import is already running. | recoverable | inline; Wait or cancel | none |
| E-IMP-017 | M-23 `importChart` | dance chart file over its limits, not `flm-dance`, or failing `Dance.validate` (contradictory steps that cannot be resolved, unknown step type) | This dance chart file is invalid: {detail} | recoverable | inline on SCR-Dance chart import | none |
| E-IMP-018 | M-22, M-16 | character or settings backup file not valid (format, size, schema) | This file is not a valid {kind} file: {detail} | recoverable | inline on the screen that opened it | none |
| E-IMP-019 | M-16 `pickFile`, drop handler | the browser refused the file picker or the dropped item is not a file (E 9) | The browser blocked access to the file. Try dragging the file onto this window, or use the file picker button. | recoverable | toast | none |

#### 10.6.6 E-STO storage

| Code | Raised by | Condition | User text | Class | Shown as; recovery action | Data at risk |
|---|---|---|---|---|---|---|
| E-STO-001 | M-16 safe write | quota exceeded, the pre-check found too little space, or the project exceeds 2 MB on the localStorage-only path | Save failed: there is not enough browser storage for this project. Export it to a file to keep your work, or delete old projects. | recoverable | dialog DLG-SaveFailed with "Export", "Manage projects", "Cancel" (DLG-ProjectTooLarge variant on the 2 MB path) | unsaved edits |
| E-STO-002 | M-16 | IndexedDB open failed or timed out, a transaction errored or timed out (10 s), or the database was closed by another tab's upgrade | Save failed: the browser database is not available right now. Export the project to a file to keep your work. | recoverable | dialog DLG-SaveFailed; the next operation reopens the database | unsaved edits |
| E-STO-003 | M-16 load | a stored record fails its hash or JSON parse | The saved copy of this project is damaged. A backup from the previous save may be available. | recoverable | dialog with "Open backup", "Cancel" | the saved copy |
| E-STO-004 | M-16 safe write | read-back verification failed | Save failed: the saved copy could not be verified, so the previous version was kept. Try again or export the project. | recoverable | dialog DLG-SaveFailed | unsaved edits |
| E-STO-005 | M-16 `open` | localStorage probe failed (private mode, disabled storage) | Settings and projects cannot be saved in this browser mode. Use Export to keep your work. | recoverable | notice on SCR-MainMenu, SCR-Studio, SCR-Library; Save buttons read "Export" | unsaved edits (every session) |
| E-STO-006 | M-16 `lock` | another tab holds the project lock | Another tab has this project open. Studio opens read-only. | recoverable | notice in SCR-Studio with "Take over" | none |
| E-STO-007 | M-16 `projects.save` | a newer copy of the project was saved by another tab since this one loaded it | A newer copy of this project was saved in another tab. Save this version as a copy, or reload the newer one. | recoverable | dialog DLG-SaveConflict with "Save as copy", "Load newer", "Cancel" | unsaved edits |
| E-STO-008 | M-16 `loadSettings` | the settings record and its `.bak` are unreadable | Settings were reset because the saved settings could not be read. | recoverable | toast at boot; defaults written | the old settings |
| E-STO-009 | M-16 `open` | IndexedDB unavailable at boot, localStorage available | Large projects cannot be stored in this browser mode; projects are limited to 2 MB. Use Export for backups. | recoverable | notice on SCR-Library and SCR-Studio | none |

#### 10.6.7 E-PRJ project

E-PRJ-001 to E-PRJ-012 are owned by Part 5.6 (texts verbatim from there). E-PRJ-020 to
E-PRJ-031 are command refusals of M-15 (Part 6.15) with the texts below; they never change
the project (a refused command leaves the revision unchanged).

| Code | Raised by | Condition | User text | Class | Shown as; recovery action | Data at risk |
|---|---|---|---|---|---|---|
| E-PRJ-001 | M-15 `load` | `JSON.parse` failed | This project file is not valid JSON and cannot be opened. | recoverable | dialog; current project untouched | none |
| E-PRJ-002 | M-15 `load` | `version` newer than 1 | This project was saved by a newer version of Finger Lickin Music (format version {v}; this build reads up to version 1). Open it with the newer version or export it from there as MIDI. | recoverable | dialog | none |
| E-PRJ-003 | M-15 `load` | root `format` is not `flm-project` | This file is not a Finger Lickin Music project (expected format 'flm-project', found '{format}'). | recoverable | dialog | none |
| E-PRJ-004 | M-15 `validate` | required field missing | The project is missing required data at {pointer} and cannot be opened. | recoverable | dialog; "Open backup" when a `.bak` exists | none |
| E-PRJ-005 | M-15 `validate` | type, range, enum or pattern violation | The project contains an invalid value at {pointer} and cannot be opened. | recoverable | dialog; "Open backup" when available | none |
| E-PRJ-006 | M-15 `validate` | duplicate identifiers | The project contains duplicate identifiers ({pointer}) and cannot be opened. | recoverable | dialog | none |
| E-PRJ-007 | M-15 `validate` with `strict:true` (tests only) | dangling reference | The project refers to data that does not exist ({pointer}). | recoverable | dialog (tests) | none |
| E-PRJ-008 | M-15 repair step 12 | events cannot be re-sorted (non-integer ticks) | The project's musical events are out of order and could not be repaired. | recoverable | dialog | none |
| E-PRJ-009 | M-15 `validate` | more than 32 tracks or 1,000,000 events | The project exceeds the supported size: {detail} (limits: 32 tracks, 1,000,000 events). | recoverable | dialog | none |
| E-PRJ-010 | M-15 `load` | text > 64 MB, depth > 32 or > 5,000,000 containers | The project file is too large or too deeply nested to open safely. | recoverable | dialog | none |
| E-PRJ-011 | M-15 repair step 14 | tempo or meter maps unrepairable | The project's tempo or meter data is invalid and could not be repaired. | recoverable | dialog | none |
| E-PRJ-012 | M-15 `migrate` | a migration step failed | The project could not be upgraded from format version {from} to version 1: {detail}. | recoverable | dialog; the original file or record is unchanged | none |
| E-PRJ-013 | M-15 load, M-14 | a track's `audioRef` names audio not present in storage | This project uses an audio file that is not stored on this device ({name}). That track stays silent until you import the audio again. | recoverable | toast after load; track shown with a "missing audio" badge | none |
| E-PRJ-014 | M-29 boot | a recovery copy (`flm.v1.recovery`) exists | An unsaved project from your last session was recovered. Open it or discard it? | recoverable | dialog on SCR-MainMenu with "Open", "Discard"; Open loads it as a dirty project | none |
| E-PRJ-020 | M-15 `addTrack`, `duplicateTrack` | 32 tracks reached | Track limit reached (32). Delete a track to add another. | recoverable | toast | none |
| E-PRJ-021 | M-15 commands | target id or index unknown | That item no longer exists. | recoverable | toast | none |
| E-PRJ-022 | M-15 `setTrackInstrument` | program outside 0..127 | That instrument is not available. | recoverable | toast | none |
| E-PRJ-023 | M-15 `addEvents` | more than 100,000 events on a track | Track event limit reached (100,000). | recoverable | toast | none |
| E-PRJ-024 | M-15 `addEvents` | pitch or velocity outside 0..127 | That note is outside the playable range. | recoverable | toast | none |
| E-PRJ-025 | M-15 `quantize` | unknown grid | That quantize grid is not available. | recoverable | toast | none |
| E-PRJ-026 | M-15 `setTempo` | BPM outside 20..400 | Tempo must be between 20 and 400 BPM. | recoverable | inline on the tempo field | none |
| E-PRJ-027 | M-15 `setMeter` | numerator not 1..32 or denominator not a power of two up to 32 | That time signature is not supported. | recoverable | inline | none |
| E-PRJ-028 | M-15 `setKeyScale` | key or scale unknown | That key or scale is not available. | recoverable | inline | none |
| E-PRJ-029 | M-15 `replaceTake` | the take is not complete | That take was not completed and cannot be used. | recoverable | toast | none |
| E-PRJ-030 | M-15 `UndoStack.push` | a command's apply threw (partial changes reverted) | That edit could not be applied. | recoverable | toast; project deep-equals its pre-command state | none |
| E-PRJ-031 | M-15 command factories | a command targeted a locked source track or received bad parameters (programming error) | (none) | recoverable | log | none |

#### 10.6.8 E-NET multiplayer

All E-NET codes leave local gameplay, projects and storage untouched (Part 1.4 graceful
failure rule 4). "Session" below means the multiplayer session only.

| Code | Raised by | Condition | User text | Class | Shown as; recovery action | Data at risk |
|---|---|---|---|---|---|---|
| E-NET-001 | M-24 `decodeCode` | pasted code too long, wrong alphabet, wrong `v` or `role`, not decodable | This is not a valid {expected} code. Copy the whole code and paste it again. | recoverable | inline under the paste field | none |
| E-NET-002 | M-24 | ICE failed, or no DataChannel open within 15 s of applying the answer | Could not connect to the other player. Without the STUN option, players usually need to be on the same network. | recoverable | dialog DLG-NetError with "Retry" (new invite) and "Back" | none |
| E-NET-003 | M-24 `hello` | protocol version mismatch | The other player uses an incompatible multiplayer version. Both players need the same version of the game. | recoverable | dialog DLG-NetError; that peer closed | none |
| E-NET-004 | M-24 `hello` | `appVersion` major differs | The other player has a different version of Finger Lickin Music ({version}). Both players need the same version. | recoverable | dialog DLG-NetError | none |
| E-NET-005 | M-24 `ready` | `settingsHash` differs from the host's in Synchronized Play | Your chart differs from the host's. The host's chart settings were applied; press Ready again. | recoverable | toast on the guest; the host re-sends `selectChart` | none |
| E-NET-006 | M-24 `ready` | judgment preset not `standard` | Multiplayer uses standard timing windows. Your timing preset was set to Standard for this session. | recoverable | toast | none |
| E-NET-007 | M-24 `selectChart` | the guest does not have the selected song | You do not have this song. Ask the host to choose a built-in song or one you both imported. | recoverable | toast on both sides; the host's lobby marks that player "Missing song" | none |
| E-NET-008 | M-24 `start` | `tStartShared` less than 1.0 s ahead on arrival | (none) | recoverable | log; the guest requests a restart; the host re-issues `start` | none |
| E-NET-009 | M-24 | the host left or its connection closed during a session | The host has left. The session has ended; here are the results so far. | returnToMenu | dialog DLG-NetError variant, then SCR-Results with local results, then SCR-Multiplayer create-or-join | none |
| E-NET-010 | M-24 | 20 invalid messages in 10 s from one peer | Disconnected {name} because their game sent invalid data. | recoverable | toast on the host (guest side: DLG-NetError "The connection was closed because of invalid data.") | none |
| E-NET-011 | M-24 `RateLimiter` | a peer exceeded 60 messages per second for 3 consecutive seconds | Disconnected {name} because their game sent too many messages. | recoverable | toast on the host | none |
| E-NET-012 | M-24 relay transport | relay unreachable or the socket closed unexpectedly | Could not reach the relay server at {relayUrl}. You can still play by exchanging invite codes directly. | recoverable | dialog DLG-NetError; the lobby switches to invite codes | none |
| E-NET-013 | M-24 relay transport | relay error `BAD_CODE` or `ROOM_NOT_FOUND` | No room with this code exists. Check the code and try again. | recoverable | inline | none |
| E-NET-014 | M-24 | room full (`ROOM_FULL` or the host's 4-player limit) | This room is full (4 players). | recoverable | inline | none |
| E-NET-015 | M-24 | the 60 s reconnection window expired, or more than 3 reconnect attempts in 60 s | Could not reconnect within 60 seconds. You have left the session. | returnToMenu (guest); recoverable (host, the player is removed) | dialog DLG-NetError on the guest | none |
| E-NET-016 | M-24 host | a guest's connection dropped | {name} disconnected. They have 60 seconds to reconnect. | recoverable | toast on the host; the player's slot shows "Reconnecting" | none |
| E-NET-017 | M-24 relay transport | relay sent `closed` with `expired` or `shutdown` | The relay closed this room ({reason}). Local results were kept. | returnToMenu | dialog DLG-NetError | none |
| E-NET-018 | M-24 sync | sync quality poor for 30 s | Connection is unstable; timing between players may be less accurate. | recoverable | toast once per session; HUD sync badge "poor" | none |
| E-NET-019 | M-24 | a joiner tried to enter while a song is in progress | A song is in progress. You will join the room when it ends. | recoverable | lobby status line | none |
| E-NET-020 | M-24 host | the host declined the joiner | The host did not admit you to the room. | recoverable | dialog DLG-NetError | none |

#### 10.6.9 E-INP input and chart mapping

| Code | Raised by | Condition | User text | Class | Shown as; recovery action | Data at risk |
|---|---|---|---|---|---|---|
| E-INP-001 | M-07 `enableMidi` | Web MIDI missing or not a secure context | MIDI devices are not available here. Web MIDI needs a supporting browser and a secure page (https:// or localhost). Keyboard, touch and gamepad controls are unaffected. | recoverable | inline on the MIDI row; toggle stays off | none |
| E-INP-002 | M-07 `enableMidi` | permission denied | MIDI access was denied. | recoverable | toast; toggle stays off | none |
| E-INP-003 | M-28 on `input.device` | a gamepad disconnected while one of its controls was held in a gameplay mode | Controller disconnected. Reconnect it or use another input, then resume. | recoverable | SCR-Pause reason line | none |
| E-INP-004 | M-07 `remap` | the chosen key is already used in the same context | {key} is already used for {action}. Swap the two? | recoverable | dialog DLG-RemapConflict with "Swap", "Cancel" | none |
| E-INP-005 | M-07 `remap` | the key is reserved by the browser or system | {key} cannot be used because the browser or system reserves it. | recoverable | inline in the capture prompt | none |
| E-INP-006 | M-07 MIDI | a MIDI input device disconnected | MIDI device {name} disconnected. | recoverable | toast | none |
| E-INP-010 | M-08 `generate` | unknown track id | (none; surfaced as E-IMP-010 or the SCR-ImportInspect row text "Chart could not be generated for this track") | recoverable | inline | none |
| E-INP-011 | M-08 `generate`, M-09 windows | bad difficulty, profile or options, or a track above 50,000 chart notes | Track too dense to chart (more than 50,000 notes). Choose another track or a lower difficulty. | recoverable | inline on SCR-ImportInspect | none |
| E-INP-012 | M-09 `load`, M-08 | a stored chart failed validation | Chart data is invalid; regenerating. | recoverable | toast; the chart is regenerated from the source song | none |

#### 10.6.10 E-EXP export

| Code | Raised by | Condition | User text | Class | Shown as; recovery action | Data at risk |
|---|---|---|---|---|---|---|
| E-EXP-001 | M-10 `write` | no MIDI tracks to export | There are no MIDI tracks to export. | recoverable | toast | none |
| E-EXP-002 | M-10 `write` | a delta time exceeds 0x0FFFFFFF | A MIDI delta time exceeds the maximum encodable value. | recoverable | toast | none |
| E-EXP-003 | M-05 `renderWav` | the mix is longer than the WAV cap of Part 5.14.3 | The mix is longer than the {cap} supported for WAV export on this device. Export a shorter loop region. | recoverable | dialog | none |
| E-EXP-004 | M-05 `renderWav` | `OfflineAudioContext` unavailable | WAV export is not available in this browser. | recoverable | disabled export row with this reason; MediaRecorder capture offered where available (OQ-2) | none |
| E-EXP-005 | M-16 `download` | the download and the data-URL fallback were both blocked | The browser blocked the download. Allow downloads for this page, or use Copy to clipboard. | recoverable | dialog with "Copy to clipboard" for JSON formats | none |
| E-EXP-006 | M-16 `download` | the export blob exceeds 256 MB | Export too large for this browser. | recoverable | toast | none |
| E-EXP-007 | M-05 `renderWav` | offline rendering rejected or ran out of memory | The audio mix could not be rendered. Try a shorter section. | recoverable | dialog | none |
| E-EXP-008 | M-05 capture | MediaRecorder capture failed or was stopped by the browser | Audio capture stopped unexpectedly. The part recorded so far was discarded. | recoverable | toast | none |

#### 10.6.11 Internal families

| Code | Raised by | Condition | User text | Class | Shown as; recovery action | Data at risk |
|---|---|---|---|---|---|---|
| E-GEN-000 | M-01 | a module reported a code missing from these tables | Something went wrong ({original}). | recoverable | toast; logged with `context.original` | none |
| E-GEN-001 | M-01, any wrapper | uncaught exception (`window.onerror`), a module factory threw (Phase A), a bus listener threw (`context.topic`), or a missing module at boot B1 | Something went wrong. Your work is safe. | by origin, Part 4.9 (boot: reload; frame or scheduler: recoverable then returnToMenu at the third in 10 s; listener and other: recoverable) | log, toast or fatal by class; B1: fatal "A part of the game failed to load: {name}. Reload the page." | none (recovery copy on reload) |
| E-GEN-002 | M-01 | unhandled promise rejection | Something went wrong. Your work is safe. | as E-GEN-001 | as E-GEN-001 | none |
| E-GEN-003 | M-01 | error storm: more than 20 reports in 10 s, or more than 3 returnToMenu in 60 s | The game hit repeated errors and returned to the menu. Your work is safe in memory. | returnToMenu (second rule: reload) | dialog or fatal | unsaved edits (exportable; recovery copy on reload) |
| E-GEN-004 | M-01 `assert` | an internal assertion failed | (none) | recoverable (boot: reload) | log | none |
| E-MODE-001 | M-28 leave step 15 | `assertClean()` found leaks | (none) | recoverable | log; Diagnostics lists the counters; integration tests fail on it | none |
| E-MODE-002 | M-28 `enter` | a step of the enter sequence threw | {mode} could not start: {message} | returnToMenu | dialog on SCR-MainMenu | none |
| E-MODE-003 | M-28 `leave` | a step of the leave sequence threw (the sequence continues) | (none) | recoverable | log | none |
| E-MDL-001 to E-MDL-011 | M-03 `validate`, `addTrack` | model invariants (Part 6.3 table) | (none directly) | recoverable | surfaced as E-IMP-003 "The file produced an invalid arrangement ({code})" during import, as E-PRJ-005 or E-PRJ-009 during load, as E-PRJ-020 for E-MDL-010 | none |
| E-TRN-001 | M-04 `setLoop` | loop region shorter than one beat or inverted | Loop region is too short. | recoverable | toast | none |

#### 10.6.12 Reconciliation with other parts

The implementation uses the codes of 10.6.2 to 10.6.11. Where another part, drafted in
parallel, names a different code for the same condition, the left column is replaced by the
right column when the code is written; the condition and behavior described in the other
part stay as written unless this table says otherwise.

| Other part says | Condition | Implementation uses |
|---|---|---|
| Part 6.1 `E-CORE-UNCAUGHT`, `E-CORE-UNHANDLED`, `E-CORE-LISTENER`, `E-CORE-BOOT`, `E-CORE-DUP` | uncaught error, unhandled rejection, throwing listener, early boot error, duplicate `define` | E-GEN-001, E-GEN-002, E-GEN-001 (`context.topic`), E-GEN-001 (`context.phase:'boot'`, class reload), E-GEN-001 (`context.module`) |
| Part 6.1 `E-CORE-ASSERT` | assertion | E-GEN-004 |
| Part 6.1 6.1.4.5 class rules and UT-01-13 expectations (`E-AUD-*` all recoverable, `E-MODE-*` returnToMenu, unknown returnToMenu, second uncaught within 2 s of returnToMenu -> reload) | classification | the class columns of 10.6 and the Part 4.9 origin and storm rules: `E-AUD-001` reload, `E-MODE-001` and `E-MODE-003` recoverable, `E-MODE-002` returnToMenu, unknown codes -> E-GEN-000 recoverable; UT-01-13 asserts these values |
| Part 6.5 `E-AUD-001` (unlock left the context suspended) | unlock failure | E-AUD-002 |
| Part 6.5 `E-AUD-002` (constructor throws; "app usable silently") | context creation failure | E-AUD-001 with class reload and the Part 4.3 B7 behavior (`#fatal`), because no mode works without Web Audio |
| Part 5.2 `E-MODEL-UNSORTED` | unsorted events | E-MDL-004 |
| Part 6.15 parse error table E-PRJ-001 to E-PRJ-008 | project load failures | the Part 5.6 codes and texts (10.6.7): "not valid JSON" E-PRJ-001; "not a project" E-PRJ-003; damaged or schema E-PRJ-005 (E-PRJ-004 for missing required data); references E-PRJ-007 (strict) or repaired with warnings; limits E-PRJ-009; migration failure E-PRJ-012; too large or too deep E-PRJ-010 |
| Part 6.15 `maxJsonDepth: 12` and the 64 MB text cap; Part 5.6 50 MB; ADR-12 32 MB | project JSON limits | 64 MB text, depth 32, 5,000,000 containers (10.1.2); reason: 1,000,000 events at the Part 5.8 estimate of 48 bytes each plus charts needs more than 50 MB, and depth 32 leaves room for `x` namespaces |
| Part 6.15 `E-PRJ-011` for a throwing command apply | command apply failure | E-PRJ-030 (E-PRJ-011 is the Part 5.6 tempo repair failure) |
| Part 6.15 `E-PRJ-010` for programming errors in command factories | bad command parameters | E-PRJ-031 (E-PRJ-010 is the Part 5.6 size limit) |
| Part 6.16 `E-IMP-size`, `E-EXP-size` | oversized file read, oversized export blob | E-IMP-001, E-EXP-006 |
| ADR-12 decision 5 "3 invalid messages in 10 s" | disconnect threshold | Part 5.16 value: 20 invalid in 10 s (10.1.11); duplicates and stale messages are not invalid |
| Part 4.3 B2 relay URL length <= 256 | relay URL | Part 5.11 value: <= 200 characters |
| Part 6.17 interrupted take "treated as stop()" with toast "The take was kept." | recording interrupted by audio suspension or pause by interruption | the take is stored (`status:'complete', interrupted:true`) but not applied to the track until the user chooses "Keep take" in the take review; the toast reads "Recording stopped: audio was interrupted. The take was kept for review." (E 11 rule "interrupted recording must not overwrite the previous successful take"; 10.7.11 rule 7) |
| Part 5.6 validation step 17 (at most one complete take per track; newest kept) | pending interrupted take next to the previous take | a take with `interrupted:true` that the user has not kept is excluded from step 17 and at most one such pending take per track is kept (the newest); "Keep take" clears `interrupted` and applies `replaceTake`, after which step 17 applies normally |
| Part 3.2.5 early handler shows only the browser's message | script parse failure before M-01 | the early handler shows the E-CAP-004 text, then the browser message on a second line (both through `textContent`) |
| Part 4.3 gate text "This browser has no WebRTC support." | `RTCPeerConnection` missing | the Part 1.4 wording used by E-CAP-005: "Multiplayer needs WebRTC, which this browser does not provide." |
| Part 4.1 M-01 API list (no fault registry) | fault injection | M-01 adds `FLM.Core.Faults` (10.9.1); `FLM.debug.inject` delegates to it |

### 10.7 Failure-recovery matrix (E 11)

Each group table answers the nine E 11 questions for its main failure cases. Part 6 module
sections carry the module-level rows; these tables are the cross-module view used by the
Phase 15 failure-recovery review (E 12 "Final failure-recovery acceptance review"). Codes
refer to 10.6; "known-good" names the state the system returns to.

#### 10.7.1 Audio (M-05, M-06)

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Audio blocked before the first gesture | context `suspended` after `init`; `unlock()` resolves false after 1,000 ms | everything; menus usable | yes, any later gesture | none | banner "Tap or press a key to enable sound"; DLG-AudioBlocked (E-AUD-002) on gameplay entry | menus, library, settings, help and the character editor (modes that do not need sound, Part 4.7) | `audio.unlocked` resumes the pending transition | UT, XT, LT |
| Context suspended or interrupted while running (tab switch, screen lock, call) | `statechange`; `visibilitychange` | project, transport position (frozen clock), charts, scores | yes (Resume button gesture) | the take in progress (stopped and kept for review) | DLG-ResumeAudio (E-AUD-007); SCR-Pause reason | paused | Resume -> `unlock()` -> re-anchor (Part 4.5.1) -> user resumes | FI `audio.suspend`, TT, XT |
| Context creation fails | constructor throws | stored projects | reload | none (recovery copy) | fatal (E-AUD-001) | none | reload | UT (stub), FI `audio.fail` with `{phase:'init'}` |
| Node creation or scheduling throws mid-song | try/catch in Scheduler and `buildVoice` | transport, project, the other voices | automatic | none | toast (E-AUD-004) | none | hard panic rebuild, re-schedule from `positionAt(now)` | FI `audio.fail` with `{phase:'node'}`, UT |
| Stuck voice after stop or mode leave | `activeCount() > 0` 350 ms after soft panic | everything | automatic | none | log (E-AUD-006) | none | hard panic | IT (20 mode cycles), UT |
| Repeated start and stop, double init | `created` flag; Scheduler binding check | single context, single binding (S-18) | n/a | none | log (E-AUD-003, E-AUD-005) | none | existing engine kept | UT |
| Output device change | `sinkchange`, latency change | everything | n/a | none | toast (E-AUD-011) | none | anchor ring cleared and refilled within 500 ms | LT, XT |

#### 10.7.2 Transport (M-04)

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Timer throttled or main thread stalled (100-500 ms frames, background tab) | Scheduler tick lateness (`sched.stall`) | anchor `{anchorTick, anchorAudio, speed}`; positions are computed, not accumulated | automatic | none | log; gameplay pauses when the gap > 500 ms while playing ("Playback stalled") | late events clamped to now + 5 ms (Part 6.5) | next tick schedules from `positionAt(now)`; gameplay resumes by user | FI `timer.stall`, TT |
| Invalid loop region | `setLoop` validation (E-TRN-001) | previous loop | user adjusts | none | toast | none | unchanged loop | UT |
| Seek or loop wrap with active notes | transport events | song, cursor | n/a | none | none | none | `sched.noteOff reason:'seek'` or `'loop'` for every sounding note, then re-schedule | UT, TT |
| Clock frozen (context not running) | `audio.state` | frozen tick | when running again | none | DLG-ResumeAudio | paused | re-anchor at the frozen tick | UT (FakeClock), FI `audio.suspend` |
| Render failure | `render.contextLost` | transport state unchanged (S-15) | n/a | none | HUD note (E-REN-003) | flat visualizer after 3 s | not needed: the transport never stopped | FI `render.contextLoss` |

#### 10.7.3 Input (M-07, M-08)

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Lost keyup (focus loss, OS shortcut) | `blur`, `visibilitychange`, `pagehide` | maps, anchor | automatic | none | none (silent release) | none | `releaseAll('system')`: one release per held control | UT, IT |
| Touch cancelled, finger leaves the pad, pointerup never arrives | `pointercancel`, `pointermove` outside, 10-pointer cap | other pads | automatic | none | pad pressed state clears | none | release that pointer's control | UT, XT (OQ-1) |
| Gamepad disconnects mid-song | `gamepaddisconnected`, null slot in poll | keyboard and touch | re-plug | none | SCR-Pause reason (E-INP-003) | other sources | release gamepad-held controls; gameplay paused | FI `input.disconnect`, UT |
| Remap conflict or reserved key | `conflicts()`; reserved list | previous map | user chooses | none | DLG-RemapConflict (E-INP-004), inline (E-INP-005) | none | map unchanged until confirmed | UT |
| Corrupt stored maps | `setMaps` validation | defaults | n/a | the custom map | toast once | defaults | `resetMap()` | UT |
| Mapping cannot represent the source (more than four simultaneous notes, excluded scale notes) | generator rules (Part 6.8) | the full source arrangement (S-08) | n/a | none | SCR-ImportInspect simplification report | lossy chart, source intact | regenerate with other settings | UT |

#### 10.7.4 Import (M-10 to M-14)

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Oversized, empty or unreadable file | `validateFile`, reader rejection | current project, transport, mode | another file | none | inline E-IMP-001, -003, -009 | n/a | picker | UT, FT |
| Malformed or truncated content | typed parser errors; truncation warnings | current project | another file | none | inline E-IMP-003, or warnings with the partial song when recovery is allowed (W-MIDI-TRUNCATED) | partial import with warnings shown | picker or inspection | FT corpus, FI `import.truncate` |
| Limits or time budget exceeded | counters, deadline | current project | smaller file | none | inline E-IMP-004, -005 | n/a | picker | FT, PT |
| Unsupported version (GP6/7, ZIP64) | identification | current project | export from the authoring tool | none | inline E-IMP-006 with the exact wording | n/a | picker | FT |
| Parser bug (untyped exception) | top-level catch | current project | another file | none | inline E-IMP-003 "(internal)", Log entry | n/a | picker | UT (fake adapter) |
| Import while a dirty project is open | SCR-ImportInspect checks `Project.isDirty()` | current project until confirmed | n/a | none until confirmed | DLG-ImportReplace "Save, Discard or Cancel" | n/a | Cancel keeps everything (S-12) | IT |

#### 10.7.5 Project and storage (M-15, M-16)

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Quota exceeded | `QuotaExceededError`, pre-check | live record and `.bak` untouched; project in memory | after export or deletion | unsaved edits | DLG-SaveFailed (E-STO-001) with Export | memory plus export | live record unchanged | FI `storage.quota`, UT |
| Write fails or is interrupted (tab closed mid-save) | rejected request; leftover `.tmp` at next open | previous live record | next save | the interrupted save only | DLG-SaveFailed (E-STO-002 or E-STO-004) on failure; silent cleanup of `.tmp` at open | n/a | `.tmp` removed; live record is the last verified save | FI `storage.writeFail` (all stages), UT |
| Read-back mismatch | hash or string compare | previous version kept | user retries | unsaved edits | E-STO-004 | export | previous live record restored | FI `storage.writeFail` with `{stage:'verify'}` |
| Corrupt stored record | hash or parse on load | `.bak` | "Open backup" | the saved copy | dialog (E-STO-003) | n/a | load `.bak` and save under the same id | UT |
| Older schema, unknown fields, newer version | `migrate`, `hoistUnknown`, version check | original file or record never modified | n/a | none | migration on a clone; E-PRJ-002 for newer | n/a | unchanged storage | UT, FT |
| Storage backends unavailable (private mode, `file://` differences) | probes at boot | memory | n/a | everything unsaved | notices E-STO-005, E-STO-009 | memory-only or localStorage-only with the 2 MB cap | n/a | IT, XT (`file://` per browser) |
| Two tabs edit the same project | `flm.v1.lock`; `storage` event; revision compare | both copies | "Take over", "Save as copy" | the other tab's unsaved edits if taken over | notice E-STO-006; DLG-SaveConflict (E-STO-007) | read-only | lock acquired or a copy saved | IT (two pages), UT |
| Save reports success wrongly | design: `project.saved` only after verify (S-14) | n/a | n/a | n/a | n/a | n/a | n/a | UT, FI |

#### 10.7.6 Studio and recording (M-17)

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Record pressed before audio unlock | `isUnlocked()` false | project | after gesture | none | DLG-AudioBlocked (E-AUD-010) | n/a | Recorder back to `armed` | UT |
| Audio suspended or interruption during a take | `audio.state`, interruption pause | previous take on the track; captured events | record again | the interrupted take (kept for review) | toast "Recording stopped: audio was interrupted. The take was kept for review." | playback paused | take review: "Keep take" applies `replaceTake` (undoable), "Discard" drops it; the track is unchanged until Keep | FI `audio.suspend` during recording, UT |
| Mode leave, navigation or reload during a take | leave step 2; `pagehide` | previous take; saved project | n/a | the current take (discarded) | toast "Recording discarded" on leave; nothing on page close | n/a | `Recorder.abort()`; aborted takes are never committed (E-PRJ-029) | IT, UT |
| Track deleted while recording on it | `deleteTrack` path | other tracks, previous takes | n/a | the current take | toast "Recording aborted: the track was deleted" | n/a | abort then delete (undoable) | UT |
| Take too long (memory) | 100,000 events on the track | captured events | n/a | events beyond the limit | toast "Recording stopped at 100,000 notes (track limit)" | n/a | `stop()` path | UT |
| Edit command throws | try/catch in `UndoStack.push` | project deep-equals pre-command state | user retries | none | toast (E-PRJ-030) | n/a | revert of partial changes | UT |
| Autosave would interrupt playback or recording | autosave scheduler checks transport and Recorder state | n/a | at the next safe point | none | none | n/a | autosave only on stop, track add or delete, and 60 s idle (brief) | UT, IT |

#### 10.7.7 Render and animation (M-18 to M-21)

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| WebGL unavailable | init returns null contexts | everything else | n/a | none | notice (E-REN-001) | Abstract tier (`#flat`) | n/a | UT, XT |
| Context lost | `webglcontextlost` | transport, audio, judging (S-15); CPU-side scene descriptions | restore event within 3 s | none | HUD note (E-REN-003), toast on fallback (E-REN-004) | Abstract tier | rebuild buffers, textures and programs from CPU descriptions on `webglcontextrestored` | FI `render.contextLoss` |
| Insufficient performance | p95 > 33 ms over 5 s | timeline (audio clock master) | n/a | none | toast (E-REN-006, E-REN-007) | one tier down per step | tier persists for the session; user may raise it in Settings | FI `render.slowFrames`, PT |
| GPU memory exhausted | `OUT_OF_MEMORY`, null allocations | timeline | n/a | none | toast (E-REN-005) | one tier down | disposal of the old tier's resources | FI `render.contextLoss` with `{oom:true}`, UT |
| Frame callback throws | wrapper try/catch | timeline, audio | next frame | none | log; dialog at the third error in 10 s (E-REN-008) | frame skipped | returnToMenu on repetition | FI `error.throw` `{origin:'frame'}` |
| Missing rig controller or attachment point | `controllerFor` returns null; `validateAttachments` | other performers | n/a | none | log (E-REN-009) | abstract visualizer for that performer | n/a | UT |
| Character customized during playback | `character.changed` | transport, animation timeline | n/a | none | none | one performer rebuilt, no scene reload (I 8) | n/a | IT |

#### 10.7.8 Dance (M-23)

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Invalid or contradictory imported chart | `Dance.validate` | the song, built-in charts | another file | none | inline (E-IMP-017) | generated chart offered | n/a | UT, FT |
| Choreography controller unavailable or throws | null controller; frame wrapper | dance chart, scoring, step input (E 7) | n/a | none | none (log) | avatar idle with beat sway; scoring unaffected | n/a | UT, FI `error.throw` `{origin:'frame'}` in dance |
| Hold across pause or interruption | Judge `setActive` rules (Part 6.9 C.2 to C.4) | holds of lanes still physically held | n/a | none | HUD hold state | n/a | hold continues or breaks per the rule | UT |
| Touch active during interruption | `releaseAll('system')` | other inputs | n/a | none | pads clear | n/a | pause; user resumes | FI `input.disconnect`, XT |
| Many consecutive misses | Judge | score state | n/a | none | HUD; failure rule per `gameplay.lifeBar` | n/a | results with the configured failure rule | UT |

#### 10.7.9 Multiplayer (M-24)

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Connection cannot be established | ICE failure, 15 s timeout | local game | new invite, STUN toggle | none | DLG-NetError (E-NET-002) | standalone play | SCR-Multiplayer create-or-join | IT, XT (OQ-3), FI `net.drop` before open |
| Guest drops mid-song | DataChannel close, `iceConnectionState` `failed`, or no message from the guest for 12 s (guests ping every 10 s) | host session, other guests, the dropped guest's last scores | 60 s reconnect window | none | toast on host (E-NET-016); guest sees reconnect state | session continues without that guest | `roomState` and position resync on reconnect; slot freed after 60 s (E-NET-015) | FI `net.drop`, IT |
| Host drops | channel close, `iceConnectionState` `failed`, or no `roomState` for 6 s (the host sends it every 2 s) | guests' local results | no (host migration Deferred) | none | DLG-NetError (E-NET-009) then SCR-Results | n/a | SCR-Multiplayer create-or-join | FI `net.drop` on host, IT |
| Latency spikes, reordering, duplicates | sync rounds; `seq` checks | shared timeline (scheduled, never on arrival) | n/a | none | sync badge, toast at poor for 30 s (E-NET-018) | n/a | stale and duplicate messages dropped; `roomState` resync on an out-of-order control message | FI `net.delay`, `net.reorder`, `net.duplicate` |
| Invalid, oversized or flooding peer | validator, rate limiter | session for the other peers | n/a | none | toast (E-NET-010, E-NET-011) | n/a | offending peer disconnected | UT, IT |
| Relay unreachable or restarted | socket error or close; `closed` frame | local game, local results | invite codes | none | DLG-NetError (E-NET-012, E-NET-017) | invite-code flow | SCR-Multiplayer | IT (relay `--selftest` plus a killed relay) |
| Network failure in any form | any of the above | standalone gameplay, projects and storage untouched (Part 1.4 rule 4) | n/a | none | as above | standalone play | n/a | IT (offline session), FI |

#### 10.7.10 UI and modes (M-26 to M-29)

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Mode enter step throws | try/catch in `enter` | project in memory, storage | user re-enters | none | dialog (E-MODE-002) | n/a | partial leave sequence, then SCR-MainMenu | IT, FI `error.throw` |
| Leave step throws | per-step try/catch | the remaining steps run | n/a | none | log (E-MODE-003) | n/a | `assertClean()` reports any residue (E-MODE-001) | IT |
| Resource leak across transitions | `assertClean()` counters | n/a | n/a | none | log; tests fail | n/a | counters back to baseline required by tests | IT (20 cycles per mode), PT memory |
| Error storm | M-01 counters | project in memory | n/a | unsaved edits (exportable) | E-GEN-003 dialog or fatal | n/a | SCR-MainMenu, or reload with the recovery copy | UT, FI `error.throw` repeated |
| Browser back during gameplay | `popstate` | mode state | n/a | none | SCR-Pause opens instead of leaving; a second back confirms leave with DLG-UnsavedChanges when dirty | n/a | normal leave sequence | IT |
| Navigation away with unsaved work | `beforeunload` while dirty or recording | n/a | n/a | unsaved edits | the browser's leave prompt (no custom text possible); `pagehide` autosave on the localStorage path when not recording | n/a | recovery copy offered at next boot when the synchronous write succeeded | LT, IT |
| Uncaught error at boot | Phase A or B errors | stored data | reload | none | fatal (E-GEN-001, E-CAP-004) | n/a | reload | UT, XT |

#### 10.7.11 Minimum recovery rules (E 11) and E 13 release gate links

| No. | Rule (E 11) | Mechanism | Modules | Test categories | E 13 gate line it protects |
|---|---|---|---|---|---|
| 1 | Audio failure must not destroy project data | `audio.state` changes, panics and rebuilds never reference `Project` (S-16); E-AUD-008 and reload classes write the recovery copy first | M-05, M-06, M-01, M-16 | FI `audio.fail`, `audio.suspend`; UT | "Saving can silently destroy an existing project" |
| 2 | Rendering failure must not permanently stop the musical transport | the render loop is not on the scheduling path; context loss leaves `Transport.state()` unchanged (S-15); Abstract fallback after 3 s | M-18, M-21, M-28 | FI `render.contextLoss`, `render.slowFrames`; TT | "A rendering failure permanently disables audio or transport" |
| 3 | File-import failure must not corrupt the current project | import returns an `InspectionReport` with a new `Song`; only SCR-ImportInspect after DLG-ImportReplace changes the project (S-12) | M-14, M-27, M-15 | IT dirty-project import and cancel; FT malformed corpus | "Valid supported MIDI files lose musical events" (by keeping failures isolated) |
| 4 | Save failure must not falsely report success | `project.saved` only after read-back verification; `markClean` only on `project.saved` (S-14); DLG-SaveFailed on every failure | M-16, M-15, M-27 | FI `storage.quota`, `storage.writeFail` at every stage; UT | "Critical errors are silently ignored or reported as successful operations" |
| 5 | Network failure must not disable standalone gameplay | M-24 is used only in `multiplayer`; no other mode references it at runtime; network errors never stop the transport or touch storage | M-24, M-28 | IT offline session of every local mode; FI `net.drop` | "The advertised standalone file cannot perform its documented core functions" |
| 6 | Invalid input must not crash the application | typed errors at every untrusted boundary (10.1); listener isolation in the bus; frame and scheduler wrappers | M-01, M-07, M-10 to M-16, M-24 | FT malformed corpus; UT network fuzz classes; FI `import.truncate` | "Critical errors are silently ignored or reported as successful operations" |
| 7 | Interrupted recording must not overwrite the previous successful take | aborted takes never commit (E-PRJ-029); interrupted takes wait for "Keep take" before `replaceTake` (a pending take is saved inside `recordings` with `interrupted:true` and offered again on reopen); `replaceTake` is undoable | M-17, M-15, M-16 | FI `audio.suspend` during recording; UT | "Saving can silently destroy an existing project" |
| 8 | An unrecoverable mode transition must return to a valid application state | `enter` failure runs the leave sequence and resolves to `menu`; `leave` never throws; `assertClean()` verifies the result | M-28 | IT; FI `error.throw` during enter | "Stuck notes can persist after stopping or changing modes" |

### 10.8 Interruptions (B 21.4, E 2.1)

"Gameplay" is the modes `quickplay`, `instrument`, `dance`, `tutorial` and `multiplayer`
(multiplayer exceptions are stated in the cells); "Studio" is `studio` and `freeplay`
playback; "Recording" is a Recorder in `countin` or `recording`. M-28 owns the reactions
(`Modes.onInterrupt`, Part 4.7.4); this table is the normative behavior. Every interruption
emits `mode.interrupted {mode, cause, action}` and is logged.

| Event | Detection | Gameplay behavior | Studio behavior | Recording behavior | Recovery |
|---|---|---|---|---|---|
| Tab hidden, app switch, incoming call (page goes to background) | `visibilitychange` with `document.hidden` | `Transport.pause()`, `Input.releaseAll('system')`, SCR-Pause with reason "Paused because the game went to the background". Multiplayer guest: no pause of the shared session; inputs stop, the player shows "Away" in the host's lobby; multiplayer host: authoritative `pause` to all | playback continues where the browser allows; held inputs released | stopped; the take is kept for review (10.7.6) | gameplay stays paused on return until the user resumes; Studio drift check on return (row "Return after minutes") |
| Screen lock or power saving | `visibilitychange`; `audio.state` `suspended` or `interrupted` (iOS, Safari) | as tab hidden; DLG-ResumeAudio on return when the context is not running | playback stops (context frozen); DLG-ResumeAudio on return | stopped; take kept for review | Resume button gesture -> `Audio.unlock()` -> re-anchor at the frozen tick |
| Page hide (navigation, tab close, mobile app termination) | `pagehide` | as hidden; synchronous localStorage autosave of a dirty project when it fits in 2 MB and no recording is active | same autosave | stopped at the hide that precedes page hide and kept for review; the pending take is written with the autosave (`status:'complete', interrupted:true`, not applied to the track) and offered for review when the project is reopened; the previous take stays on the track | next boot offers the recovery copy or the last checkpoint (DLG-RecoverCheckpoint) |
| Audio context suspended or interrupted by the system while visible (Siri, alarm, other app taking audio) | `statechange` to `suspended` or `interrupted` | `Transport.pause()` (`reason:'interrupt'`), DLG-ResumeAudio (E-AUD-007) | playback paused (editor stays usable), DLG-ResumeAudio | stopped; take kept for review | Resume -> unlock -> re-anchor; the user restarts playback |
| Return after several minutes in the background | `visibilitychange` to visible | stays paused; anchor ring cleared and refilled; the Scheduler cursor is reset to the paused tick | drift check: if the Scheduler cursor differs from `positionAt(audioNow)` by more than 5 ms of song time, re-anchor and log E-AUD-009; `audio.state` re-checked | n/a (stopped at hide) | Autosave timer notified so a long background stay produces a checkpoint on return (Part 6.17) |
| Window blur without hiding (desktop alt-tab, devtools focus) | `blur` | `Input.releaseAll('system')`; no pause (audio and video continue); holds of released lanes follow the Judge rules (Part 6.9) | release held notes (note-offs) | held notes closed at the blur time; recording continues | none needed |
| OS or browser shortcut swallows a keyup | next `keydown` of the same code, `blur` | the control is released when detected; never stuck | same | same | none needed |
| System gesture or touch cancellation (edge swipe, notification shade) | `pointercancel` | release that pad; play continues | release | note-off at the cancel time | none needed |
| Device orientation change | `orientationchange`, `resize` -> `ui.layout` (debounced 100 ms) | no pause; highway, pads and stage relayout; rotate recommendation per Part 7.5 for landscape-preferred modes; held pads released by `pointercancel` when the browser cancels them | relayout | continues (input lifecycle rules apply) | none needed; the timeline is unaffected (P 14) |
| Viewport resize, mobile browser toolbar show or hide | `resize`, `visualViewport` `resize` | relayout; safe-area insets re-read | relayout | continues | none needed |
| Temporary memory pressure | `performance.memory` above 80 percent of `jsHeapSizeLimit` (Chromium), or two consecutive `sched.stall` gaps > 500 ms | one tier down, toast "Reduced visual quality to keep audio stable."; decoded preview buffers released | same | continues; if the event limit is reached the take stops (10.7.6) | tier stays reduced for the session |
| Main-thread stall or throttled timers (100-500 ms frames) | `sched.stall` | gap > 500 ms while playing: `Transport.pause()` with reason "Playback stalled"; shorter gaps: catch-up rule, no pause | log; catch-up rule (late events clamped to now + 5 ms) | gap > 500 ms: stopped, take kept for review; shorter gaps: continues | user resumes; nothing accumulated drifts (positions are computed from the anchor) |
| Headphones connected or disconnected, default output changed | `sinkchange` where fired; latency change at a scheduler tick; or the context going `suspended` | continues when the context stays running (toast E-AUD-011); otherwise as "Audio context suspended" | same | continues when running; otherwise stopped, take kept | recalibration suggested by the toast |
| Gamepad disconnected | `gamepaddisconnected`, null slot | if a gamepad control was held or the gamepad was the last used source: pause with "Controller disconnected" (E-INP-003); otherwise continue | release its controls | its held notes closed; continues | user reconnects or switches input and resumes |
| MIDI input device disconnected | `MIDIAccess` `statechange` | release its controls; toast E-INP-006; continue | same | its held notes closed; continues | re-plug; the device reappears in Settings |
| Graphics context lost | `webglcontextlost` | music, input and scoring continue; HUD "Graphics paused"; Abstract after 3 s without restore | same | continues | restore or Abstract (10.7.7) |
| Network connection lost (multiplayer) | channel close, ICE `failed`, message silence (10.7.9) | guest: the local transport keeps playing the song to its end on the shared timeline, inputs are judged locally for display, results are marked "Disconnected"; host: the session continues for the others | n/a | n/a | reconnect within 60 s with `roomState` resync |
| Browser back or forward | `popstate` | opens SCR-Pause instead of leaving; a second back leaves (DLG-UnsavedChanges when dirty) | panel back navigation; leaving Studio while dirty asks DLG-UnsavedChanges | back is ignored while recording (the toast "Stop recording first" appears) | normal leave sequence |

Rules common to every row:

1. No interruption advances musical time by itself: positions are computed from the anchor
   and the audio clock, so a frozen clock freezes the position and a resumed clock continues
   from the same tick (ADR-05).
2. Every held control is released on hide, blur, page hide, device loss and pause, with one
   release event per control (S-13).
3. Recording never continues across a gap of unknown length; a stopped take is kept for
   review and never applied automatically (10.7.11 rule 7).
4. Autosave never runs during playback or recording; the page-hide autosave is the only
   synchronous write and uses the localStorage safe write.
5. Gameplay never resumes by itself after an interruption; the user resumes from SCR-Pause
   (M-04 resume rules apply).

### 10.9 Fault-injection hooks (I 13.1)

#### 10.9.1 Mechanism

The fault registry lives in M-01 so every module can check it without referencing a higher
module (R-DEP, Part 4.2). `FLM.debug.inject` (M-29, Part 4.8) is the only public entry point.

```js
// M-01 (added to the FLM.Core API of Part 4.1)
FLM.Core.Faults = {
  NAMES: [/* the 14 names of 10.9.2, frozen */],
  /** Arms a fault. Unknown name -> false. args are merged over the defaults of 10.9.2.
   *  Logs Log.warn('fault', name, args). Returns true. */
  set(name /*:string*/, args /*:object?*/) /*: boolean */ {},
  /** Disarms one fault; no-op when not armed. */
  clear(name) /*: void */ {},
  clearAll() /*: void */ {},
  /** Check point for continuous faults: the armed args or null. Cost: one Map lookup. */
  active(name) /*: object|null */ {},
  /** Check point for counted faults: returns args and decrements args.count; disarms at 0. */
  take(name) /*: object|null */ {},
  /** [{name, args, hits}] for diagnostics and tests. */
  list() /*: Array */ {},
};
// M-29
FLM.debug.inject = (name, args) => FLM.debug.enabled ? FLM.Core.Faults.set(name, args) : false;
FLM.debug.clear  = (name) => FLM.Core.Faults.clear(name);
```

Rules:

1. `FLM.debug.enabled` is true in the test build and with `?diag` in the shipped build;
   otherwise `inject` returns false and arms nothing. Faults are never persisted and end
   with the page.
2. Check points are compiled into both builds (the code under test is the code that ships); each
   is a single `active()` or `take()` call at the location named in 10.9.2. No fault changes
   behavior when not armed.
3. Random choices inside a fault (probabilities, jitter) use `new FLM.Core.Prng(args.seed)`
   with `seed` default 1, so FI runs are reproducible.
4. A fault simulates the failure at the lowest layer that can observe it (the DOM event, the
   Web Audio call, the storage request) so that detection, reporting and recovery run through
   the production paths.
5. Every FI test ends with `FLM.Core.Faults.clearAll()` and `Modes.assertClean()` returning
   null.

#### 10.9.2 Fault list

| Name | Args (defaults) | What it does | Check point | Primary tests |
|---|---|---|---|---|
| `audio.suspend` | `{blockResumeMs:0}` | calls `ctx.suspend()` on the live context and marks the next `statechange` as system-caused (`reason:'statechange'`), exactly as an OS interruption; with `blockResumeMs > 0`, `Audio.unlock()` resolves false (E-AUD-002) until that time has passed | M-05 internal `simulateSuspend`, polled at each Scheduler tick | FI: during playback -> transport paused, DLG-ResumeAudio, Resume re-anchors with no position jump > 1 tick; during recording -> take kept for review, previous take intact; during a dirty Studio session -> project deep-equal before and after |
| `audio.fail` | `{phase:'node', count:1}`; phases `node`, `schedule`, `closed`, `init` | `node`: the next `count` Web Audio node creations in `buildVoice` throw; `schedule`: the next `count` `start()`/`setValueAtTime` calls in the Scheduler throw; `closed`: the context is closed behind the engine's back; `init`: the next `Audio.init()` on a fresh engine instance (tests create it with an injected context factory) throws | M-06 `buildVoice`, M-05 `scheduleNote`, M-05 `init` | FI: E-AUD-004 toast and hard panic, playback continues, no leaked voice slots; `closed` -> E-AUD-008 returnToMenu with the project intact; `init` -> E-AUD-001 fatal path in a test page |
| `render.contextLoss` | `{restoreAfterMs:1000, oom:false}`; `restoreAfterMs:null` never restores | uses `WEBGL_lose_context.loseContext()` (Abstract-tier tests skip); after `restoreAfterMs` calls `restoreContext()`; with `oom:true` the next buffer or texture allocation behaves as `OUT_OF_MEMORY` instead | M-18 renderer and allocation wrappers | FI: transport state and `sched.noteOn` rate unchanged during loss (S-15); restore rebuilds counters to the pre-loss values; `null` -> Abstract after 3 s (E-REN-004); `oom` -> one tier down (E-REN-005) |
| `render.slowFrames` | `{ms:300, everyN:1, durationMs:null}` | the frame wrapper busy-waits `ms` milliseconds (a `performance.now()` loop) inside every `everyN`-th RAF callback, for `durationMs` or until cleared | M-18 frame wrapper | FI and TT: highway tick equals `positionAt(audioNow)` within 1 tick after 120 s (S-01); auto-downgrade fires within 6 s (E-REN-006); audio onsets stay within 1 ms in the OfflineAudioContext check of the same schedule |
| `storage.quota` | `{target:'both'}`; `idb`, `ls`, `both` | the next writes to the target throw a `QuotaExceededError` `DOMException` at the request that writes the `.tmp` copy | M-16 `safeWrite` (both backends) | FI: DLG-SaveFailed with Export; no `project.saved`; `isDirty()` stays true; live record and `.bak` byte-identical to before; Export still produces a valid `.flm.json` |
| `storage.writeFail` | `{stage:'swap', count:1}`; stages `open`, `tmp`, `verify`, `swap`, `bak` | `open`: IndexedDB open fires `error`; `tmp`: the `.tmp` write rejects; `verify`: the read-back returns altered text; `swap`: the write of the live record rejects after a good `.tmp` (an interrupted save); `bak`: copying the old record to `.bak` rejects | M-16 `safeWrite`, `openDb` | FI per stage: correct code (E-STO-002 or E-STO-004), previous live record intact, `.tmp` removed at the next `Storage.open()`; I 13.1 "Interrupt a save" is `stage:'swap'` |
| `net.drop` | `{peer:'all', silent:false}` | `silent:false` closes the DataChannel (or relay socket) of the peer; `silent:true` keeps it open but discards every incoming message (silence timeout path) | M-24 transport adapter | FI: guest drop -> host toast E-NET-016, 60 s window, reconnect resync; host drop -> E-NET-009 and results; standalone modes usable afterwards |
| `net.delay` | `{ms:200, jitterMs:0, peer:'all'}` | delays delivery of each incoming message by `ms` plus a uniform jitter in `[-jitterMs, jitterMs]` (via `Core.timers`) | M-24 receive path, before validation | FI: sync quality classification, `start` still lands on the shared timeline (not on arrival), late `input` messages outside +/- 2 s dropped |
| `net.duplicate` | `{probability:1, peer:'all'}` | delivers each incoming message twice (second copy after 0 ms) with the given probability | M-24 receive path | FI: duplicates dropped by `(from, seq)`; scores identical to a run without the fault |
| `net.reorder` | `{window:3, peer:'all'}` | buffers incoming messages and delivers each group of `window` in reverse order | M-24 receive path | FI: stale `seq` dropped; a pause older than a resume ignored; out-of-order control message triggers a `roomState` resync |
| `input.disconnect` | `{source:'gamepad'}`; `gamepad`, `midi`, `pointer` | `gamepad`: the next poll reports the slot as null and the disconnect path runs; `midi`: the MIDI input fires `statechange` disconnected; `pointer`: a `pointercancel` is dispatched for every active pointer | M-07 `pollGamepad`, MIDI handler, pointer handler | FI: held controls released (one release each), gameplay paused for gamepad (E-INP-003), no stuck note (`activeVoices` returns to 0) |
| `import.truncate` | `{fraction:0.5}` or `{bytes:n}` | cuts the bytes returned by `readBytes` before identification | M-14 `readBytes` | FI: every corpus base file truncated at 0.25, 0.5, 0.75, 0.99 returns a typed error or a song with truncation warnings, within 5 s, and leaves `Project.current()` unchanged |
| `timer.stall` | `{ms:300, count:1, skipTicks:0}` | the next `count` Scheduler ticks busy-wait `ms` before running; with `skipTicks > 0` that many interval callbacks are skipped (background throttling) | M-05 Scheduler tick | FI and TT: `sched.stall` emitted with the gap; gap > 500 ms pauses gameplay; no cumulative drift after recovery |
| `error.throw` | `{origin:'frame', count:1}`; `frame`, `scheduler`, `listener`, `enter` | makes the next frame callback, Scheduler tick, `error` bus listener or `Modes.enter` step 9 throw | M-18 frame wrapper, M-05 tick, M-01 emitter, M-28 `enter` | FI: Part 4.9 origin rules (skip, escalation at the third in 10 s); `enter` -> E-MODE-002 and a clean menu |

#### 10.9.3 Coverage of I 13.1

| I 13.1 item | Fault or method |
|---|---|
| Drop network connections | `net.drop` |
| Suspend audio | `audio.suspend` |
| Force a rendering interruption | `render.contextLoss`, `render.slowFrames` |
| Load malformed files | the malformed and truncated corpus (Part 8.9) plus `import.truncate` |
| Exhaust storage | `storage.quota` |
| Interrupt a save | `storage.writeFail` with `stage:'swap'` (and the other stages) |
| Disconnect an input device | `input.disconnect` |
| Switch modes while notes are active | no fault needed: `Input.synthesize` holds lanes and a sustain, then `Modes.enter('menu')`; assert `activeVoices === 0` within 350 ms and `assertClean()` null |

Every FI test asserts the three E 11 outcomes in addition to its specific checks: no
exception escaped to `window.onerror` other than the injected one, user data equals its
pre-fault snapshot (or the documented at-risk item only), and the application ends in a
known-good state (`Modes.current().mode` is a valid mode and `assertClean()` passes after
leaving).

### 10.10 Diagnostics (B 24, I 3.5, I 13.2)

#### 10.10.1 SCR-Diagnostics

Reached from SCR-Settings > Advanced > "Diagnostics" and from the `#fatal` and
returnToMenu dialogs ("Copy diagnostics"). It is a panel mode (`diagnostics`); live values
update at 2 Hz from the owning modules' APIs (never by computing positions itself). Sections
and metrics:

| Section | Metrics | Source |
|---|---|---|
| Build | version, build date, edition (Standalone or Online and relay host), test build flag, boot time to menu (ms), degraded capabilities list | `FLM.VERSION`, `FLM.BUILD`, `boot.ready` |
| Capabilities | every `Caps` flag with Yes or No, secure context, `file://` flag, device pixel ratio, hardware concurrency, touch points | `Core.Caps.get()` |
| Audio | context state, sample rate, base and output latency (ms, "not reported" when absent), polyphony cap, active voices, peak active, stolen and dropped voices, scheduler lookahead and tick, scheduler stalls (count, max gap ms), last hard panic reason, calibration values in force | `Audio.*`, `audio.voices`, `sched.stall` counters, settings |
| Timing | clock anchor method (`outputTimestamp` or `currentTime`), anchor jitter (ms), drift re-anchors (E-AUD-009 count), transport state, speed, current tick and bar | `input.anchor`, `Transport.main` |
| Input | connected devices (keyboard, pointer, gamepads by index and name, MIDI devices by name), last 20 input events (source, control, type, tAudio rounded to 0.1 ms), held controls | `Input.devices()`, `Input.held()` |
| Rendering | tier and tier history with reasons, WebGL version, max texture size, FPS, p50 and p95 frame time, draw calls, triangles, context losses, GL resource counters | `Render.stats()`, `Render.counters()`, `render.tier` history |
| Storage | storage mode (both, localStorage-only, memory), localStorage bytes used by `flm.v1.*`, quota estimate (usage, quota, percent, or "unknown"), project count, last save result (ok or code, bytes, ms), lock state | `Storage.state()`, `estimateQuota()` |
| Network | state, role, transport (p2p or relay), peers, per-peer RTT, clock offset, jitter, sync quality, messages sent, received, invalid, duplicates, dropped by rate limit | `Net.diagnostics()` |
| Modes and resources | current mode, the `assertClean` counter snapshot, last leak report, heap used (Chromium only) | `Modes`, `FLM.debug.counters()` |
| Errors and log | the last 50 error records (code, class, count, time) and the last 100 log lines with a level filter | `ErrorReporter.recent()`, `Log` |

Actions on the screen: "Export diagnostics" (downloads `<date>-flm.flmdiag.json` through
`Storage.download`), "Copy diagnostics" (clipboard, textarea fallback), checkbox "Attach
current song" (default off, resets to off every time the screen opens), "Run audio check"
(plays a 1 s test tone sequence and reports `audio.state` and voice counts), "Open
calibration" (DLG-Calibration), "Show stats overlay" (toggles `video.showStats`).

Development overlay (`?diag` or `video.showStats`): a corner panel in `--font-mono` showing
FPS and p95, tier, active voices of the cap, scheduler stalls, anchor jitter, transport
tick, and the network sync badge when connected; updated at 2 Hz; never covers the highway
hit line or the touch pads (positioned top-left inside the safe area).

Audio diagnostics honesty (I 3.5): the Audio section and DLG-Calibration state "Latency
values reported by the browser are estimates. Use the calibration test to tune what you
hear and feel." The game never labels `audioLatencyMs` from the tap test as a measurement of
hardware latency; it is labeled "Calibrated audio offset".

#### 10.10.2 Bug report export content

`FLM.diagnostics({includeSong})` calls `Core.Diagnostics.export({includeContent:false,
includeSong})`; modules contribute through `Diagnostics.provide(key, fn)` (Part 6.1). The
document:

```json
{
  "format": "flm-diagnostics",
  "version": 1,
  "app": {"version": "1.0.0", "build": {"date": "YYYY-MM-DD", "test": false, "edition": "standalone"}},
  "exportedAt": "ISO-8601",
  "caps": {"webgl2": true, "audioContext": true, "secureContext": false, "isFile": true, "mobile": false, "dpr": 2, "userAgent": "<= 200 chars"},
  "mode": {"current": "studio", "enteredAt": 12345.6, "lastLeave": {"mode": "quickplay", "reason": "finished", "leaks": null}},
  "settings": {"audio": {}, "calibration": {}, "input": {}, "gameplay": {}, "video": {}, "accessibility": {}, "net": {"stunEnabled": false, "relayConfigured": false}},
  "providers": {
    "audio": {"state": "running", "sampleRate": 48000, "baseLatencyMs": 10.7, "outputLatencyMs": null, "voices": {"active": 0, "max": 64, "stolen": 0, "dropped": 0, "peakActive": 23}, "stalls": {"count": 1, "maxGapMs": 180}},
    "timing": {"anchorMethod": "outputTimestamp", "jitterMs": 0.4, "reanchors": 0},
    "input": {"devices": [{"source": "gamepad", "index": 0}], "recent": [{"source": "keyboard", "control": "lane0", "type": "press", "tAudio": 12.3456}]},
    "render": {"tier": "Balanced", "history": [{"tier": "High", "reason": "initial"}, {"tier": "Balanced", "reason": "auto"}], "fps": 58.9, "p95": 21.4, "contextLosses": 0, "gl": {"version": 2, "maxTextureSize": 8192}},
    "storage": {"mode": "both", "lsBytes": 41234, "quota": {"usage": 1200000, "quota": 300000000}, "projects": 3, "lastSave": {"ok": true, "ms": 41}},
    "net": {"state": "idle", "peers": 0, "messages": {"sent": 0, "received": 0, "invalid": 0, "dupes": 0, "rateDropped": 0}},
    "counters": {"activeVoices": 0, "timers": 4, "glBuffers": 12}
  },
  "faults": [],
  "errors": [{"code": "E-REN-006", "class": "recoverable", "count": 1, "t": 81234.5, "module": "Modes", "stack": "<redacted paths>"}],
  "log": [{"t": 0.0, "level": "info", "tag": "boot", "msg": "1.0.0"}],
  "truncated": false,
  "song": null
}
```

Content rules:

1. Included by default: build and version, capabilities (including the truncated user agent
   string, which identifies the browser), mode, settings without personal fields, provider
   metrics, active faults, the last 50 error records, the 500-entry log.
2. Never included: song content (notes, events, charts, lyrics, markers), titles, artists,
   track names, file names, project names, display names (own or other players'), room
   codes, invite or answer codes and session descriptions, IP addresses, the relay URL
   (replaced by `relayConfigured: true or false`), `location.href` (it contains the local
   file path under `file://`), the clipboard.
3. Redaction is applied to the whole document (Part 6.1.4.6 step 3): keys matching
   `/^(title|artist|fileName|name|text|lyric|lyrics|displayName|roomCode|sdp|relayUrl|projectName|trackName)$/i`
   are deleted; strings longer than 200 characters are truncated; arrays longer than 200
   elements are cut. Stack traces have every URL replaced by `<page>` and are cut to 2,000
   characters. Log entries never contain song content by construction (modules log ids,
   counts and codes only; a UT scans the log after importing a corpus song for its title).
4. "Attach current song" (opt-in per export): adds `"song"` with the current project
   serialized by `Project.serialize` (names included, because the user chose to attach
   them) only if the whole document then stays within 200 KB; otherwise `"song": null`,
   `"songOmitted": "too large"` and the screen says "The song is too large to attach.
   Export the project separately if you want to share it."
5. Size cap 200 KB (`json.length`): when exceeded, the oldest 25 percent of log entries are
   removed repeatedly, then stacks are dropped, then error records beyond the newest 20;
   `truncated:true` records that this happened.
6. The export is produced only on the user's action and only to a download or the
   clipboard; nothing is sent anywhere (10.2).
7. Persistent growth is impossible: the log and error list live in memory with fixed
   capacities (500 and 50 entries); nothing diagnostic is written to storage except the
   `flm.v1.recovery` project copy of Part 4.9 (P 19).

#### 10.10.3 Verification

| Check | Category |
|---|---|
| Export of a session with an imported song, a named project and a multiplayer display name contains none of those strings (search the JSON for each) | UT, IT |
| Export with "Attach current song" contains the song only when it fits; otherwise `songOmitted` | UT |
| Export size <= 200 KB after 10,000 log writes and 500 errors | UT |
| Stack traces contain no `file:` or `http` URL | UT |
| Every SCR-Diagnostics section renders with each capability absent (fake `Caps`) without throwing | UT |
| The overlay never overlaps the highway hit line or the touch pads at 360 x 640 and 1280 x 800 | IT |
| Real-device runs export the file for the Part 12 device matrix records | XT, LT |
