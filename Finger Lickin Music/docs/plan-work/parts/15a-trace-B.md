## 15. Requirements traceability matrix

### 15.0 How to read the matrix

This part is the requirements traceability matrix required by B 1.2 item 2 and B 28 item 2.
It maps every obligation of the specification to its spec section, the module(s) that
satisfy it, the implementation phase that delivers it, and its verification test. It owns
the `R-*` identifiers (Part 0.9.1). It has four subsections, one per specification part:
15.1 base specification (B), 15.2 edge cases and failure modes (E), 15.3 essential product
improvements (I), 15.4 maximum-polish checklist (P). Inside each subsection there is one
table per top-level spec section, under a heading `#### 15.<s>.<n>`; every table has the
same header row.

Nothing in this matrix is implemented at plan version 1.0.0. Every row is Unimplemented or
Deferred. Statuses change only in `docs/STATUS.md` during implementation (Part 0.7) and are
copied back into this Status column by hand in the final phase, B 27 phase 16 (Part 0.7
rule 7).

#### 15.0.1 Columns

| Column | Content |
|---|---|
| R-ID | `R-<part><section>-<nn>`, for example `R-B7.3-04`. `<section>` is the spec's own section number (the deepest numbered heading that contains the obligation, for example `7.3`, `12.6`, `2`). `<nn>` counts rows from `01` in spec order within that section. IDs are stable: they are never renumbered or reused. A later spec change appends the next free number to its section and is recorded as a plan change (Part 0.1). |
| Spec ref | Part code, space, section number: `B 7.3`. The spec text at that reference is authoritative for intent; the Requirement column is a short paraphrase. |
| Requirement | One obligation, at most 110 characters, ASCII, no pipe character. Where the plan has decided a value (a number, a name, a key, a file type), the text states it and the decision is binding on the implementation. |
| Priority | `P0`, `P1` or `P2` by the rules in 15.0.2. |
| Module(s) | The M-IDs of the brief's module map (Part 4.1) that carry the requirement, primary module first. `none` means the requirement is satisfied by a document or a procedure rather than by source code (this plan, `docs/LEDGER.md`, `docs/STATUS.md`, `docs/COMPATIBILITY.md`, `docs/FINAL-REPORT.md`, `README.md`); its acceptance test is a document review step defined in Part 12. Tooling that is not an M-ID (`tools/build.mjs`, `tools/selftest.mjs`, `tools/perf.mjs`, `tools/make-corpus.mjs`, `server/relay.mjs`, `src/shell.html`) is named in the Requirement text when it is the main carrier, and the closest M-ID is listed. |
| Phase | The word Phase, a space and a two-digit B 27 phase number (00 to 16), naming the phase whose deliverables complete the requirement (rules in 15.0.3). This column holds nothing else, because it is rewritten mechanically: once Part 11 exists, a script replaces each such value with the T-ID of the Part 11 section that delivers the row (for example `T08.03`). Do not add notes to this column. |
| Tests | `AT-<R-ID>` for every P0 and P1 row (B 25.7: every P0 and P1 requirement has a specific acceptance test; Part 12 defines each procedure under exactly this name). `n/a` for P2 rows: P2 rows are to be verified by the unit and integration tests Part 12 maps to the R-ID, not by a dedicated acceptance test. Part 12 maps UT, IT, FT, TT, PT, XT, FI and LT tests to R-IDs in its own tables; this column carries only the acceptance test name so that it stays deterministic. |
| Status | `Unimplemented`, or `Deferred` for the items Part 1.5 and Part 1.3 decide as Deferred (Collaborative Studio, SoundFont loading and sampled fidelity, two players on one keyboard, effects beyond the limiter and global reverb, host migration, late join during a song, and the Deferred B 4.4 items). No other status word appears at plan time. |

#### 15.0.2 Priority rules

1. A row that restates a B 4.2 item is P0, a B 4.3 item P1, a B 4.4 item P2 (B 4.1).
2. Any other row inherits the priority of the B 4 feature it belongs to. Examples: Free
   Play rows are P0 (B 4.2 "Free-play instrument mode"); Dance Mode and multiplayer rows
   are P1 (B 4.3); MusicXML and Guitar Pro rows are P1; Web MIDI input is P2 (B 4.4
   "optional controller integrations").
3. A row with no B 4 feature is derived: core correctness, musical timing, data safety,
   security, standalone operation and the process obligations of B 1 are P0; a full
   product feature or a documentation obligation of the full product is P1; an optional,
   advanced or "may" / "where practical" item is P2.
4. Within one feature a narrower sub-capability can take a lower priority than the
   feature when B 4 names it separately (for example multitrack overdub P1 inside the P0
   recording feature).
5. For 15.4 (P): checklist items default to P1; P 21 micro-polish items are P2.
6. Deferred rows keep the priority the item would have had; all Deferred items in v1 are
   P2 (Part 1.5).

#### 15.0.3 Phase rules

1. The phase is the B 27 phase whose listed deliverables complete the requirement, as
   fixed by Part 1.3 (feature tiers) and the module ownership of Part 4.
2. A requirement built across several phases takes the phase in which it becomes fully
   verifiable (for example four-button instrument gameplay: input in B 27 phase 3, charts
   and highway in phase 8 -> phase 8).
3. Cross-cutting process rows (B 1.4) take phase 1, the first implementation phase,
   and apply to every later phase; completion and delivery rows (B 1.5, B 26.8, B 28)
   take phase 16; cross-browser, device and local-file verification rows take
   phase 15.
4. Phase-0 rows are planning obligations answered by this document; they are checked
   when phase 1 starts (Part 0.4 Step 3).
5. A Deferred row takes the phase that writes its disclosure text or its specified rules
   (for example Collaborative Studio rules in phase 13).

#### 15.0.4 Granularity and coverage rules

1. Every bullet, numbered item and sentence of the spec that states an obligation (must,
   should, may, required, never, do not) is one row. Headings and explanatory prose are
   not rows.
2. Exception: a list whose items are the fields of one schema or the members of one
   definition set, verified together by one acceptance test, is one row that names every
   member (for example the joints of B 12.2 and the build contents of B 5.3). Every member
   of such a list appears in the row text.
3. A spec item that has a v1 part and a Deferred part is split into two adjacent rows so
   that each row has exactly one status.
4. Spec sentences that only repeat an obligation already captured in the same section
   (for example a summary sentence after a list) are not repeated as rows.
5. Coverage notes for B: the document preamble (lines 5-13: single standalone HTML,
   avoid external dependencies) is captured by the rows of B 3.7, B 5.3 and B 19.5.
   B 1.1 to B 1.3 (table of contents first, the thirteen planning artifacts, the approval
   gate) are the obligations this plan document answers as a whole (Part 0 maps the
   artifacts to Parts 1 to 15) and are not repeated as rows; B 1.4 and B 1.5 are rows.
6. Row counts per part are carried into `docs/STATUS.md` section 1 (Part 0.7 rule 1); the
   count for B is stated at the end of 15.1.

### 15.1 Base specification (B)

Rows for B sections 1.4 and 1.5 and B sections 2 to 29, in spec order.

#### 15.1.1 B 1 Mandatory instructions for the implementing agent (1.4 and 1.5)

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B1.4-01 | B 1.4 | Follow the Part 11 table of contents in dependency order; record any order change in docs/LEDGER.md | P0 | none | Phase 01 | AT-R-B1.4-01 | Unimplemented |
| R-B1.4-02 | B 1.4 | Keep traceability: every T section names its R-IDs and tests; every test is registered against R-IDs | P0 | M-31 | Phase 01 | AT-R-B1.4-02 | Unimplemented |
| R-B1.4-03 | B 1.4 | Build the smallest independently testable subsystem first, following module load order M-01 upward | P0 | none | Phase 01 | AT-R-B1.4-03 | Unimplemented |
| R-B1.4-04 | B 1.4 | Validate each subsystem with its self-test group passing before the next subsystem is integrated | P0 | M-31 | Phase 01 | AT-R-B1.4-04 | Unimplemented |
| R-B1.4-05 | B 1.4 | Preserve accepted functionality: node tools/selftest.mjs --all passes at every phase gate before commit | P0 | M-31 | Phase 01 | AT-R-B1.4-05 | Unimplemented |
| R-B1.4-06 | B 1.4 | Keep docs/STATUS.md current with Implemented, Partial, Blocked and Unimplemented requirements | P0 | none | Phase 01 | AT-R-B1.4-06 | Unimplemented |
| R-B1.4-07 | B 1.4 | Never report a feature complete because its UI exists; Implemented needs every named test passing | P0 | none | Phase 01 | AT-R-B1.4-07 | Unimplemented |
| R-B1.4-08 | B 1.4 | No placeholder for a required system unless the limitation is recorded in STATUS.md section 5 | P0 | none | Phase 01 | AT-R-B1.4-08 | Unimplemented |
| R-B1.4-09 | B 1.4 | No claim of format support, multiplayer sync, offline use or performance without recorded test evidence | P0 | none | Phase 01 | AT-R-B1.4-09 | Unimplemented |
| R-B1.4-10 | B 1.4 | On a conflict with the single-file rule, record it and the smallest exception in the LEDGER before acting | P0 | none | Phase 01 | AT-R-B1.4-10 | Unimplemented |
| R-B1.5-01 | B 1.5 | Completion requires the final artifact tested against all acceptance tests (every AT for P0 and P1) | P0 | M-31 | Phase 16 | AT-R-B1.5-01 | Unimplemented |
| R-B1.5-02 | B 1.5 | Completion requires supported formats and limitations documented (docs/COMPATIBILITY.md, About limits) | P0 | M-14 | Phase 16 | AT-R-B1.5-02 | Unimplemented |
| R-B1.5-03 | B 1.5 | Completion requires desktop and mobile controls working, shown by recorded XT and LT results | P0 | M-07, M-26 | Phase 15 | AT-R-B1.5-03 | Unimplemented |
| R-B1.5-04 | B 1.5 | Completion requires every core gameplay system operating: instrument, free play, studio, import, dance | P0 | M-28 | Phase 16 | AT-R-B1.5-04 | Unimplemented |
| R-B1.5-05 | B 1.5 | Completion requires the delivered FingerLickinMusic.html to meet the standalone single-file rule | P0 | M-29 | Phase 16 | AT-R-B1.5-05 | Unimplemented |
| R-B1.5-06 | B 1.5 | A mockup, partial prototype or set of nonfunctional screens is never accepted as the final product | P0 | none | Phase 16 | AT-R-B1.5-06 | Unimplemented |

#### 15.1.2 B 2 Product vision

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B2-01 | B 2 | Players play instruments using four primary buttons | P0 | M-07, M-08, M-09 | Phase 03 | AT-R-B2-01 | Unimplemented |
| R-B2-02 | B 2 | Players perform notes, intervals, chords, riffs and rhythmic patterns with the four buttons | P0 | M-08 | Phase 03 | AT-R-B2-02 | Unimplemented |
| R-B2-03 | B 2 | Players play freely without predefined notes (Free Play) | P0 | M-08, M-27 | Phase 06 | AT-R-B2-03 | Unimplemented |
| R-B2-04 | B 2 | Players record performances and layer multiple instruments into complete tracks | P1 | M-17 | Phase 09 | AT-R-B2-04 | Unimplemented |
| R-B2-05 | B 2 | Players compose using musical key, scale, tempo, time signature and other musical settings | P0 | M-17, M-02, M-03 | Phase 09 | AT-R-B2-05 | Unimplemented |
| R-B2-06 | B 2 | Players import existing musical arrangements and play along with them | P0 | M-14, M-10, M-09 | Phase 08 | AT-R-B2-06 | Unimplemented |
| R-B2-07 | B 2 | Performances are shown by animated 3D musicians whose movements follow actual musical events | P0 | M-20, M-21 | Phase 05 | AT-R-B2-07 | Unimplemented |
| R-B2-08 | B 2 | Players play a dance mode inspired by dance rhythm games | P1 | M-23 | Phase 11 | AT-R-B2-08 | Unimplemented |
| R-B2-09 | B 2 | Players customize the appearance of band members and avatars | P0 | M-22 | Phase 10 | AT-R-B2-09 | Unimplemented |
| R-B2-10 | B 2 | Players play alone, locally where supported, or online with other players (2-4 by invite code) | P1 | M-24, M-28 | Phase 13 | AT-R-B2-10 | Unimplemented |
| R-B2-11 | B 2 | The game is usable on desktop and mobile devices | P0 | M-07, M-26 | Phase 01 | AT-R-B2-11 | Unimplemented |
| R-B2-12 | B 2 | Players save, load and export projects in the supported formats | P0 | M-15, M-16 | Phase 09 | AT-R-B2-12 | Unimplemented |
| R-B2-13 | B 2 | The application runs from one HTML file with zero runtime dependencies (ADR-01, ADR-02) | P0 | M-29 | Phase 01 | AT-R-B2-13 | Unimplemented |
| R-B2-14 | B 2 | Game first: scoring, feedback, results and progression wrap meaningful musical capability | P1 | M-09, M-25, M-27 | Phase 08 | AT-R-B2-14 | Unimplemented |

#### 15.1.3 B 3 Product principles

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B3.1-01 | B 3.1 | Preserve pitches, velocities, timing, programs, articulation and polyphony as source and engine allow | P0 | M-03, M-10, M-05 | Phase 07 | AT-R-B3.1-01 | Unimplemented |
| R-B3.2-01 | B 3.2 | A beginner makes satisfying music with four buttons (beginner charts, scale-locked Free Play default) | P0 | M-08, M-09 | Phase 03 | AT-R-B3.2-01 | Unimplemented |
| R-B3.2-02 | B 3.2 | Advanced users reach chords, alternate voicings, free play and precise control (profiles C, E; expert) | P1 | M-08 | Phase 06 | AT-R-B3.2-02 | Unimplemented |
| R-B3.3-01 | B 3.3 | The 3D performance shows which instruments play, which notes, the intensity and the song structure | P0 | M-20, M-21 | Phase 05 | AT-R-B3.3-01 | Unimplemented |
| R-B3.4-01 | B 3.4 | Desktop keyboard and controller input and mobile touch give equivalent access to the core game | P0 | M-07, M-26 | Phase 03 | AT-R-B3.4-01 | Unimplemented |
| R-B3.5-01 | B 3.5 | Imported arrangements keep their musical structure: tracks, events, tempo, meter, key, markers | P0 | M-14, M-03 | Phase 07 | AT-R-B3.5-01 | Unimplemented |
| R-B3.5-02 | B 3.5 | Never silently reduce polyphonic or multitrack music to an inaccurate monophonic representation | P0 | M-14, M-08 | Phase 07 | AT-R-B3.5-02 | Unimplemented |
| R-B3.6-01 | B 3.6 | Label every format and feature Supported, Partial, Conversion or Unsupported, in the UI and docs | P0 | M-14, M-27 | Phase 07 | AT-R-B3.6-01 | Unimplemented |
| R-B3.7-01 | B 3.7 | The primary deliverable is one HTML document: FingerLickinMusic.html | P0 | M-29 | Phase 01 | AT-R-B3.7-01 | Unimplemented |
| R-B3.7-02 | B 3.7 | The optional relay service is separate from the standalone core and documented (server/relay.mjs) | P1 | M-24 | Phase 13 | AT-R-B3.7-02 | Unimplemented |

#### 15.1.4 B 4 Scope and feature priorities

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B4.1-01 | B 4.1 | Priorities set sequencing only; nothing is omitted silently; each omission is a Deferred row with a reason | P0 | none | Phase 00 | AT-R-B4.1-01 | Unimplemented |
| R-B4.2-01 | B 4.2 | Standalone HTML application shell (src/shell.html built by tools/build.mjs) | P0 | M-29, M-01, M-26 | Phase 01 | AT-R-B4.2-01 | Unimplemented |
| R-B4.2-02 | B 4.2 | Desktop and mobile responsive UI | P0 | M-26, M-27 | Phase 01 | AT-R-B4.2-02 | Unimplemented |
| R-B4.2-03 | B 4.2 | Four-button instrument gameplay | P0 | M-07, M-08, M-09, M-21 | Phase 08 | AT-R-B4.2-03 | Unimplemented |
| R-B4.2-04 | B 4.2 | Free-play instrument mode | P0 | M-08, M-17, M-27 | Phase 06 | AT-R-B4.2-04 | Unimplemented |
| R-B4.2-05 | B 4.2 | Basic note, interval and chord mapping (profiles A, B, C) | P0 | M-08, M-02 | Phase 03 | AT-R-B4.2-05 | Unimplemented |
| R-B4.2-06 | B 4.2 | Audio playback by real-time synthesis (no bundled instrument bank, ADR-04) | P0 | M-05, M-06 | Phase 04 | AT-R-B4.2-06 | Unimplemented |
| R-B4.2-07 | B 4.2 | MIDI file import and playback | P0 | M-10, M-14, M-03 | Phase 07 | AT-R-B4.2-07 | Unimplemented |
| R-B4.2-08 | B 4.2 | Tempo, key and scale configuration | P0 | M-02, M-03, M-04, M-27 | Phase 06 | AT-R-B4.2-08 | Unimplemented |
| R-B4.2-09 | B 4.2 | Basic 3D band visualization | P0 | M-18, M-19, M-21 | Phase 05 | AT-R-B4.2-09 | Unimplemented |
| R-B4.2-10 | B 4.2 | Note-synchronized instrument animation | P0 | M-20 | Phase 05 | AT-R-B4.2-10 | Unimplemented |
| R-B4.2-11 | B 4.2 | Basic character selection and customization | P0 | M-22, M-27 | Phase 10 | AT-R-B4.2-11 | Unimplemented |
| R-B4.2-12 | B 4.2 | Recording and playback of basic performances | P0 | M-17, M-04 | Phase 06 | AT-R-B4.2-12 | Unimplemented |
| R-B4.2-13 | B 4.2 | Local project persistence and export (.flm.json and .mid) | P0 | M-15, M-16 | Phase 09 | AT-R-B4.2-13 | Unimplemented |
| R-B4.2-14 | B 4.2 | Input calibration and latency configuration | P0 | M-07, M-09, M-27 | Phase 03 | AT-R-B4.2-14 | Unimplemented |
| R-B4.2-15 | B 4.2 | Automated tests for musical timing and file handling (self-test groups timing and files) | P0 | M-31 | Phase 15 | AT-R-B4.2-15 | Unimplemented |
| R-B4.3-01 | B 4.3 | Multitrack recording and mixing (up to 32 tracks) | P1 | M-17, M-05, M-15 | Phase 09 | AT-R-B4.3-01 | Unimplemented |
| R-B4.3-02 | B 4.3 | Full MIDI event and track preservation | P1 | M-10, M-03 | Phase 07 | AT-R-B4.3-02 | Unimplemented |
| R-B4.3-03 | B 4.3 | MusicXML import (.xml, .musicxml, .mxl) | P1 | M-12, M-11, M-14 | Phase 12 | AT-R-B4.3-03 | Unimplemented |
| R-B4.3-04 | B 4.3 | Guitar Pro import for GP3, GP4, GP5; GP6 and GP7 identified and reported Unsupported | P1 | M-13, M-14 | Phase 12 | AT-R-B4.3-04 | Unimplemented |
| R-B4.3-05 | B 4.3 | Expanded General MIDI coverage: all 128 programs via 16 family templates, tuned in phase 14 | P1 | M-06 | Phase 14 | AT-R-B4.3-05 | Unimplemented |
| R-B4.3-06 | B 4.3 | Polyphonic instrument animation | P1 | M-20 | Phase 05 | AT-R-B4.3-06 | Unimplemented |
| R-B4.3-07 | B 4.3 | Dance gameplay with configurable step patterns | P1 | M-23, M-27 | Phase 11 | AT-R-B4.3-07 | Unimplemented |
| R-B4.3-08 | B 4.3 | Expanded avatar customization (full options catalog) | P1 | M-22 | Phase 10 | AT-R-B4.3-08 | Unimplemented |
| R-B4.3-09 | B 4.3 | Online multiplayer with synchronization (Synchronized Play, Cooperative Band) | P1 | M-24, M-27 | Phase 13 | AT-R-B4.3-09 | Unimplemented |
| R-B4.3-10 | B 4.3 | More complete export and import: .flmdance.json, .flmchar.json, .flmsettings.json, WAV mix | P1 | M-15, M-16 | Phase 09 | AT-R-B4.3-10 | Unimplemented |
| R-B4.3-11 | B 4.3 | Mobile-specific interaction optimization (touch pads, pad layout and size, rotate hint) | P1 | M-07, M-26 | Phase 14 | AT-R-B4.3-11 | Unimplemented |
| R-B4.3-12 | B 4.3 | Performance profiling and fallback rendering modes (tiers, auto-downgrade, tools/perf.mjs) | P1 | M-18, M-01 | Phase 14 | AT-R-B4.3-12 | Unimplemented |
| R-B4.4-01 | B 4.4 | Additional formats: .wav .mp3 .ogg .flac imported as audio tracks via decodeAudioData | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-B4.4-02 | B 4.4 | Additional formats: SoundFont and other sequencer or notation adapters (adapter registry ready) | P2 | M-14 | Phase 12 | n/a | Deferred |
| R-B4.4-03 | B 4.4 | Advanced articulation synthesis: legato, portamento, glissando | P2 | M-06 | Phase 14 | n/a | Deferred |
| R-B4.4-04 | B 4.4 | More sophisticated procedural humanoid animation (for example finger-level keys animation) | P2 | M-20, M-19 | Phase 14 | n/a | Deferred |
| R-B4.4-05 | B 4.4 | Advanced dance styles and a choreography editor | P2 | M-23 | Phase 11 | n/a | Deferred |
| R-B4.4-06 | B 4.4 | Expanded stage visuals: 3 unlockable stage themes and 2 unlockable effects | P2 | M-21, M-25 | Phase 11 | n/a | Unimplemented |
| R-B4.4-07 | B 4.4 | Free-form stage customization editor | P2 | M-21 | Phase 11 | n/a | Deferred |
| R-B4.4-08 | B 4.4 | Advanced mixing and editing: automation, per-track effects, EQ, delay, compression | P2 | M-17, M-05 | Phase 14 | n/a | Deferred |
| R-B4.4-09 | B 4.4 | Optional controller integration: Web MIDI input where Caps.webMidi and Caps.secureContext are true | P2 | M-07 | Phase 03 | n/a | Unimplemented |
| R-B4.4-10 | B 4.4 | Additional accessibility input mappings (for example one-switch play) | P2 | M-07 | Phase 03 | n/a | Deferred |
| R-B4.4-11 | B 4.4 | Optional community features (no accounts, servers, telemetry or shared content in v1) | P2 | none | Phase 13 | n/a | Deferred |

#### 15.1.5 B 5 Platform and deployment requirements

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B5.1-01 | B 5.1 | Target modern desktop Chromium-based browsers | P0 | M-01, M-29 | Phase 15 | AT-R-B5.1-01 | Unimplemented |
| R-B5.1-02 | B 5.1 | Target modern desktop Firefox | P0 | M-01, M-29 | Phase 15 | AT-R-B5.1-02 | Unimplemented |
| R-B5.1-03 | B 5.1 | Target modern desktop Safari | P0 | M-01, M-29 | Phase 15 | AT-R-B5.1-03 | Unimplemented |
| R-B5.1-04 | B 5.1 | Target modern Mobile Safari on iOS | P0 | M-01, M-29 | Phase 15 | AT-R-B5.1-04 | Unimplemented |
| R-B5.1-05 | B 5.1 | Target modern mobile Chromium-based browsers on Android | P0 | M-01, M-29 | Phase 15 | AT-R-B5.1-05 | Unimplemented |
| R-B5.1-06 | B 5.1 | Browser compatibility is stated only from recorded XT results with versions, never from browser names | P0 | none | Phase 15 | AT-R-B5.1-06 | Unimplemented |
| R-B5.2-01 | B 5.2 | The game runs when FingerLickinMusic.html is opened directly from file:// with no server | P0 | M-29, M-16 | Phase 01 | AT-R-B5.2-01 | Unimplemented |
| R-B5.2-02 | B 5.2 | Record actual file:// behavior per supported browser: storage, file picker, download, audio, WebGL | P0 | M-16, M-01 | Phase 15 | AT-R-B5.2-02 | Unimplemented |
| R-B5.2-03 | B 5.2 | Core gameplay, UI, local audio, visualization and local projects need no remote server | P0 | M-28, M-29 | Phase 15 | AT-R-B5.2-03 | Unimplemented |
| R-B5.3-01 | B 5.3 | The final HTML inlines all markup, CSS and application logic; no external script, style or font | P0 | M-29 | Phase 01 | AT-R-B5.3-01 | Unimplemented |
| R-B5.3-02 | B 5.3 | It contains game systems, timing and mapping, audio synthesis and rendering logic (M-01 to M-30) | P0 | M-29 | Phase 01 | AT-R-B5.3-02 | Unimplemented |
| R-B5.3-03 | B 5.3 | It contains built-in presets and configuration: 5 demos, tutorial, character presets, defaults | P0 | M-30 | Phase 01 | AT-R-B5.3-03 | Unimplemented |
| R-B5.3-04 | B 5.3 | Resources are embedded: geometry, textures, impulses and sounds are procedural; nothing is fetched | P0 | M-18, M-30 | Phase 01 | AT-R-B5.3-04 | Unimplemented |
| R-B5.3-05 | B 5.3 | No external library is included (ADR-02); any future one needs license and size review first | P0 | none | Phase 00 | AT-R-B5.3-05 | Unimplemented |
| R-B5.3-06 | B 5.3 | Remote resources only with documented limits: v1 uses only the optional STUN toggle and relay | P1 | M-24 | Phase 13 | AT-R-B5.3-06 | Unimplemented |
| R-B5.3-07 | B 5.3 | The shipped file needs no build pipeline or separate JavaScript files to run (build is source-only) | P0 | M-29 | Phase 01 | AT-R-B5.3-07 | Unimplemented |
| R-B5.4-01 | B 5.4 | Standalone mode: no server; all local gameplay and local projects work | P0 | M-29, M-28 | Phase 01 | AT-R-B5.4-01 | Unimplemented |
| R-B5.4-02 | B 5.4 | Online mode: optional network use for multiplayer only (P2P invite codes; relay in the Online edition) | P1 | M-24 | Phase 13 | AT-R-B5.4-02 | Unimplemented |
| R-B5.4-03 | B 5.4 | Document that the single file is not a server: rooms need P2P peers or the optional relay process | P1 | none | Phase 13 | AT-R-B5.4-03 | Unimplemented |
| R-B5.4-04 | B 5.4 | Standalone features stay usable when the relay or STUN service is unavailable | P0 | M-24, M-28 | Phase 13 | AT-R-B5.4-04 | Unimplemented |

#### 15.1.6 B 6 User experience and navigation

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B6.1-01 | B 6.1 | First launch displays the game identity: name Finger Lickin Music and VERSION | P0 | M-27, M-29 | Phase 01 | AT-R-B6.1-01 | Unimplemented |
| R-B6.1-02 | B 6.1 | First launch checks required browser capabilities through the Caps gate before any mode starts | P0 | M-01, M-29 | Phase 01 | AT-R-B6.1-02 | Unimplemented |
| R-B6.1-03 | B 6.1 | First launch requests audio activation through a user gesture (Audio.unlock on a tap or key) | P0 | M-05, M-29 | Phase 04 | AT-R-B6.1-03 | Unimplemented |
| R-B6.1-04 | B 6.1 | First launch determines rendering capabilities: WebGL2, WebGL1 or 2D canvas only | P0 | M-01, M-18 | Phase 01 | AT-R-B6.1-04 | Unimplemented |
| R-B6.1-05 | B 6.1 | First launch offers desktop or touch input configuration where the device needs it | P0 | M-27, M-07 | Phase 03 | AT-R-B6.1-05 | Unimplemented |
| R-B6.1-06 | B 6.1 | First launch lets the user choose a gameplay mode | P0 | M-27 | Phase 01 | AT-R-B6.1-06 | Unimplemented |
| R-B6.1-07 | B 6.1 | Unavailable functionality is explained without blocking supported modes | P0 | M-27, M-29 | Phase 01 | AT-R-B6.1-07 | Unimplemented |
| R-B6.1-08 | B 6.1 | No account is required for any standalone feature | P0 | M-29 | Phase 01 | AT-R-B6.1-08 | Unimplemented |
| R-B6.2-01 | B 6.2 | Main menu entry: Quick Play | P0 | M-27 | Phase 08 | AT-R-B6.2-01 | Unimplemented |
| R-B6.2-02 | B 6.2 | Main menu entry: Instrument Mode | P0 | M-27 | Phase 08 | AT-R-B6.2-02 | Unimplemented |
| R-B6.2-03 | B 6.2 | Main menu entry: Free Play | P0 | M-27 | Phase 06 | AT-R-B6.2-03 | Unimplemented |
| R-B6.2-04 | B 6.2 | Main menu entry: Studio | P0 | M-27 | Phase 09 | AT-R-B6.2-04 | Unimplemented |
| R-B6.2-05 | B 6.2 | Main menu entry: Song Library | P0 | M-27 | Phase 07 | AT-R-B6.2-05 | Unimplemented |
| R-B6.2-06 | B 6.2 | Main menu entry: Import Music | P0 | M-27 | Phase 07 | AT-R-B6.2-06 | Unimplemented |
| R-B6.2-07 | B 6.2 | Main menu entry: Dance Mode | P1 | M-27 | Phase 11 | AT-R-B6.2-07 | Unimplemented |
| R-B6.2-08 | B 6.2 | Main menu entry: Multiplayer | P1 | M-27 | Phase 13 | AT-R-B6.2-08 | Unimplemented |
| R-B6.2-09 | B 6.2 | Main menu entry: Characters (character customization) | P0 | M-27 | Phase 10 | AT-R-B6.2-09 | Unimplemented |
| R-B6.2-10 | B 6.2 | Main menu entry: Settings | P0 | M-27 | Phase 01 | AT-R-B6.2-10 | Unimplemented |
| R-B6.2-11 | B 6.2 | Main menu entry: Help and Controls | P0 | M-27 | Phase 03 | AT-R-B6.2-11 | Unimplemented |
| R-B6.2-12 | B 6.2 | Main menu entry: About (credits and licenses) | P0 | M-27 | Phase 01 | AT-R-B6.2-12 | Unimplemented |
| R-B6.2-13 | B 6.2 | Unavailable entries show a disabled state plus a one-line reason, distinct from working entries | P0 | M-27, M-26 | Phase 01 | AT-R-B6.2-13 | Unimplemented |
| R-B6.3-01 | B 6.3 | Shared interface shows the current mode | P0 | M-26, M-27 | Phase 01 | AT-R-B6.3-01 | Unimplemented |
| R-B6.3-02 | B 6.3 | Shared interface shows the current song or project name | P0 | M-26, M-27 | Phase 07 | AT-R-B6.3-02 | Unimplemented |
| R-B6.3-03 | B 6.3 | Shared transport bar offers play, pause, resume and stop | P0 | M-26, M-04 | Phase 02 | AT-R-B6.3-03 | Unimplemented |
| R-B6.3-04 | B 6.3 | Shared interface offers master volume | P0 | M-26, M-05 | Phase 04 | AT-R-B6.3-04 | Unimplemented |
| R-B6.3-05 | B 6.3 | Shared interface offers instrument selection | P0 | M-26, M-27 | Phase 06 | AT-R-B6.3-05 | Unimplemented |
| R-B6.3-06 | B 6.3 | Shared interface offers tempo and musical configuration where the mode allows it | P0 | M-26, M-27 | Phase 06 | AT-R-B6.3-06 | Unimplemented |
| R-B6.3-07 | B 6.3 | Shared interface shows input status (active devices: keyboard, touch, gamepad, MIDI) | P0 | M-26, M-07 | Phase 03 | AT-R-B6.3-07 | Unimplemented |
| R-B6.3-08 | B 6.3 | Shared interface shows loading progress | P0 | M-26, M-14 | Phase 01 | AT-R-B6.3-08 | Unimplemented |
| R-B6.3-09 | B 6.3 | Shared interface shows error notifications as toasts or dialogs | P0 | M-26, M-01 | Phase 01 | AT-R-B6.3-09 | Unimplemented |
| R-B6.3-10 | B 6.3 | Performance indicators (FPS, frame time, voices, tier) shown when video.showStats is on | P1 | M-26, M-18 | Phase 05 | AT-R-B6.3-10 | Unimplemented |
| R-B6.3-11 | B 6.3 | Every screen offers navigation back to the main menu (Escape or back control) | P0 | M-26, M-28 | Phase 01 | AT-R-B6.3-11 | Unimplemented |
| R-B6.4-01 | B 6.4 | Desktop layouts may use multiple panels, a larger stage and a dedicated editor area | P1 | M-26 | Phase 01 | AT-R-B6.4-01 | Unimplemented |
| R-B6.4-02 | B 6.4 | Mobile gameplay is full-screen | P0 | M-26, M-27 | Phase 08 | AT-R-B6.4-02 | Unimplemented |
| R-B6.4-03 | B 6.4 | Mobile touch targets are at least 56x56 CSS px with 8 px gaps | P0 | M-26 | Phase 01 | AT-R-B6.4-03 | Unimplemented |
| R-B6.4-04 | B 6.4 | Four touch pads keep essential visuals clear: bottom 28% portrait, right or bottom 24% landscape | P0 | M-26, M-07 | Phase 03 | AT-R-B6.4-04 | Unimplemented |
| R-B6.4-05 | B 6.4 | Settings and editing panels are collapsible on mobile | P1 | M-26 | Phase 09 | AT-R-B6.4-05 | Unimplemented |
| R-B6.4-06 | B 6.4 | Transport controls are touch-friendly | P0 | M-26 | Phase 02 | AT-R-B6.4-06 | Unimplemented |
| R-B6.4-07 | B 6.4 | Layouts are orientation-aware (portrait and landscape classes, reflow on change) | P0 | M-26 | Phase 01 | AT-R-B6.4-07 | Unimplemented |
| R-B6.4-08 | B 6.4 | Layouts respect safe areas (env(safe-area-inset-*) padding) | P0 | M-26 | Phase 01 | AT-R-B6.4-08 | Unimplemented |
| R-B6.4-09 | B 6.4 | Gameplay screens need no text entry while play is active | P1 | M-27 | Phase 08 | AT-R-B6.4-09 | Unimplemented |
| R-B6.4-10 | B 6.4 | Every mode stays usable in both portrait and landscape | P0 | M-26 | Phase 01 | AT-R-B6.4-10 | Unimplemented |
| R-B6.4-11 | B 6.4 | A mode may show a rotate recommendation (#rotate) that never blocks unrelated features | P1 | M-26 | Phase 03 | AT-R-B6.4-11 | Unimplemented |

#### 15.1.7 B 7 Core gameplay modes

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B7.1-01 | B 7.1 | Quick Play is the shortest path to playing: first playable demo <= 5 s desktop, <= 8 s mobile | P0 | M-27, M-28 | Phase 08 | AT-R-B7.1-01 | Unimplemented |
| R-B7.1-02 | B 7.1 | Quick Play selects a built-in song or an imported arrangement | P0 | M-27, M-15 | Phase 08 | AT-R-B7.1-02 | Unimplemented |
| R-B7.1-03 | B 7.1 | Quick Play selects a playable instrument (track) | P0 | M-27, M-08 | Phase 08 | AT-R-B7.1-03 | Unimplemented |
| R-B7.1-04 | B 7.1 | Quick Play selects Dance Mode as the play type for the chosen song | P1 | M-27, M-23 | Phase 11 | AT-R-B7.1-04 | Unimplemented |
| R-B7.1-05 | B 7.1 | Quick Play selects difficulty: beginner, intermediate, advanced, expert (dance: easy, normal, hard) | P0 | M-27 | Phase 08 | AT-R-B7.1-05 | Unimplemented |
| R-B7.1-06 | B 7.1 | Quick Play selects the control layout: mapping profile and key or pad layout | P0 | M-27, M-08 | Phase 08 | AT-R-B7.1-06 | Unimplemented |
| R-B7.1-07 | B 7.1 | Quick Play turns optional backing tracks on or off | P0 | M-27, M-05 | Phase 08 | AT-R-B7.1-07 | Unimplemented |
| R-B7.1-08 | B 7.1 | Quick Play selects the visualization: camera preset FullBand, Focus, Side, Overhead or Player | P1 | M-27, M-21 | Phase 08 | AT-R-B7.1-08 | Unimplemented |
| R-B7.1-09 | B 7.1 | Quick Play reaches audio and input settings (volume, calibration, controls) before play | P0 | M-27 | Phase 08 | AT-R-B7.1-09 | Unimplemented |
| R-B7.1-10 | B 7.1 | Quick Play goes from song selection to active play without entering the Studio | P0 | M-27, M-28 | Phase 08 | AT-R-B7.1-10 | Unimplemented |
| R-B7.2-01 | B 7.2 | Instrument Mode: four buttons pressed in time with incoming chart notes perform the chosen instrument | P0 | M-09, M-08 | Phase 08 | AT-R-B7.2-01 | Unimplemented |
| R-B7.2-02 | B 7.2 | Instrument Mode supports single notes | P0 | M-08, M-09 | Phase 08 | AT-R-B7.2-02 | Unimplemented |
| R-B7.2-03 | B 7.2 | Instrument Mode supports multiple simultaneous notes (multi-lane ChartNote) | P0 | M-08, M-09 | Phase 08 | AT-R-B7.2-03 | Unimplemented |
| R-B7.2-04 | B 7.2 | Instrument Mode supports chords | P0 | M-08, M-09 | Phase 08 | AT-R-B7.2-04 | Unimplemented |
| R-B7.2-05 | B 7.2 | Instrument Mode supports intervals | P0 | M-08, M-09 | Phase 08 | AT-R-B7.2-05 | Unimplemented |
| R-B7.2-06 | B 7.2 | Instrument Mode supports repeated-note patterns | P0 | M-08, M-09 | Phase 08 | AT-R-B7.2-06 | Unimplemented |
| R-B7.2-07 | B 7.2 | Instrument Mode supports sustained notes as hold notes judged at head and tail | P0 | M-09 | Phase 08 | AT-R-B7.2-07 | Unimplemented |
| R-B7.2-08 | B 7.2 | Instrument Mode supports rests (empty highway spans; no notes generated in rests) | P0 | M-08, M-21 | Phase 08 | AT-R-B7.2-08 | Unimplemented |
| R-B7.2-09 | B 7.2 | Instrument Mode supports rhythmic subdivisions down to the chart grid of each difficulty | P0 | M-08 | Phase 08 | AT-R-B7.2-09 | Unimplemented |
| R-B7.2-10 | B 7.2 | Instrument Mode follows tempo changes in the arrangement (TempoMap drives judging and highway) | P0 | M-03, M-09, M-21 | Phase 08 | AT-R-B7.2-10 | Unimplemented |
| R-B7.2-11 | B 7.2 | Instrument Mode offers four difficulty levels per instrument chart | P0 | M-08 | Phase 08 | AT-R-B7.2-11 | Unimplemented |
| R-B7.2-12 | B 7.2 | Instrument Mode offers optional automatic accompaniment: non-target tracks play as backing | P0 | M-05, M-28 | Phase 08 | AT-R-B7.2-12 | Unimplemented |
| R-B7.2-13 | B 7.2 | Instrument Mode shows scoring and feedback: judgment text, combo, score, SCR-Results | P0 | M-09, M-27 | Phase 08 | AT-R-B7.2-13 | Unimplemented |
| R-B7.2-14 | B 7.2 | Input layer is instrument-independent; instrument-specific behavior lives only in mapping profiles | P0 | M-07, M-08 | Phase 03 | AT-R-B7.2-14 | Unimplemented |
| R-B7.3-01 | B 7.3 | Free Play triggers notes and chords from the four buttons | P0 | M-08, M-06 | Phase 06 | AT-R-B7.3-01 | Unimplemented |
| R-B7.3-02 | B 7.3 | Free Play selects an instrument (any of the 128 GM programs or the drum kit) | P0 | M-27, M-06 | Phase 06 | AT-R-B7.3-02 | Unimplemented |
| R-B7.3-03 | B 7.3 | Free Play selects a musical key (12 roots) | P0 | M-02, M-27 | Phase 06 | AT-R-B7.3-03 | Unimplemented |
| R-B7.3-04 | B 7.3 | Free Play selects a scale or chromatic mode | P0 | M-02, M-08 | Phase 06 | AT-R-B7.3-04 | Unimplemented |
| R-B7.3-05 | B 7.3 | Free Play adjusts the playable register | P0 | M-08 | Phase 06 | AT-R-B7.3-05 | Unimplemented |
| R-B7.3-06 | B 7.3 | Free Play adjusts octave (KeyQ down, KeyE up) | P0 | M-08, M-07 | Phase 06 | AT-R-B7.3-06 | Unimplemented |
| R-B7.3-07 | B 7.3 | Free Play controls note duration: held while pressed, or fixed length 50-2000 ms | P0 | M-08 | Phase 06 | AT-R-B7.3-07 | Unimplemented |
| R-B7.3-08 | B 7.3 | Free Play controls velocity or intensity where supported (MIDI velocity, pointer pressure, setting) | P0 | M-08, M-07 | Phase 06 | AT-R-B7.3-08 | Unimplemented |
| R-B7.3-09 | B 7.3 | Free Play enables sustain (sustain key ShiftLeft or toggle, equivalent to CC 64) | P0 | M-08, M-06 | Phase 06 | AT-R-B7.3-09 | Unimplemented |
| R-B7.3-10 | B 7.3 | Free Play uses a metronome with beat 1 accented | P0 | M-05 | Phase 06 | AT-R-B7.3-10 | Unimplemented |
| R-B7.3-11 | B 7.3 | Free Play adjusts tempo (20-300 BPM) | P0 | M-04 | Phase 06 | AT-R-B7.3-11 | Unimplemented |
| R-B7.3-12 | B 7.3 | Free Play records and replays a performance (Recorder take) | P0 | M-17 | Phase 06 | AT-R-B7.3-12 | Unimplemented |
| R-B7.3-13 | B 7.3 | Free Play switches musical layouts: profiles A-F with Digit1 to Digit6 | P0 | M-08 | Phase 06 | AT-R-B7.3-13 | Unimplemented |
| R-B7.3-14 | B 7.3 | Free Play disables scale constraints for unrestricted chromatic playing | P0 | M-08 | Phase 06 | AT-R-B7.3-14 | Unimplemented |
| R-B7.3-15 | B 7.3 | Free Play distinguishes quantized from unquantized playing with a visible quantize toggle | P0 | M-08, M-17 | Phase 06 | AT-R-B7.3-15 | Unimplemented |
| R-B7.4-01 | B 7.4 | Studio creates tracks (up to 32 per project) | P1 | M-17 | Phase 09 | AT-R-B7.4-01 | Unimplemented |
| R-B7.4-02 | B 7.4 | Studio assigns an instrument to each track | P1 | M-17, M-06 | Phase 09 | AT-R-B7.4-02 | Unimplemented |
| R-B7.4-03 | B 7.4 | Studio records MIDI events onto a track | P0 | M-17 | Phase 09 | AT-R-B7.4-03 | Unimplemented |
| R-B7.4-04 | B 7.4 | Studio plays back the project | P0 | M-17, M-04 | Phase 09 | AT-R-B7.4-04 | Unimplemented |
| R-B7.4-05 | B 7.4 | Studio overdubs onto existing material | P1 | M-17 | Phase 09 | AT-R-B7.4-05 | Unimplemented |
| R-B7.4-06 | B 7.4 | Studio mutes and solos tracks | P1 | M-17, M-05 | Phase 09 | AT-R-B7.4-06 | Unimplemented |
| R-B7.4-07 | B 7.4 | Studio sets track volume and pan | P1 | M-17, M-05 | Phase 09 | AT-R-B7.4-07 | Unimplemented |
| R-B7.4-08 | B 7.4 | Studio names tracks | P1 | M-17 | Phase 09 | AT-R-B7.4-08 | Unimplemented |
| R-B7.4-09 | B 7.4 | Studio configures tempo and time signature | P0 | M-17, M-03 | Phase 09 | AT-R-B7.4-09 | Unimplemented |
| R-B7.4-10 | B 7.4 | Studio configures musical key and scale | P0 | M-17, M-02 | Phase 09 | AT-R-B7.4-10 | Unimplemented |
| R-B7.4-11 | B 7.4 | Studio offers basic positioning and timing edits of events | P1 | M-17 | Phase 09 | AT-R-B7.4-11 | Unimplemented |
| R-B7.4-12 | B 7.4 | Studio loops a region and plays a section (section markers) | P1 | M-17, M-04 | Phase 09 | AT-R-B7.4-12 | Unimplemented |
| R-B7.4-13 | B 7.4 | Studio offers undo and redo for supported operations (UndoStack, 100 entries) | P1 | M-15, M-17 | Phase 09 | AT-R-B7.4-13 | Unimplemented |
| R-B7.4-14 | B 7.4 | Studio saves, loads and exports projects | P0 | M-15, M-16 | Phase 09 | AT-R-B7.4-14 | Unimplemented |
| R-B7.4-15 | B 7.4 | Studio offers a basic mixer | P1 | M-17, M-05 | Phase 09 | AT-R-B7.4-15 | Unimplemented |
| R-B7.4-16 | B 7.4 | Studio separates MIDI-event editing from audio rendering (separate labels and export actions) | P1 | M-17, M-27 | Phase 09 | AT-R-B7.4-16 | Unimplemented |
| R-B7.4-17 | B 7.4 | Studio recording and playback are reliable: no lost events, autosave only at safe points | P0 | M-17, M-16 | Phase 09 | AT-R-B7.4-17 | Unimplemented |
| R-B7.5-01 | B 7.5 | Imported songs are playable as rhythm-game experiences | P0 | M-08, M-09 | Phase 08 | AT-R-B7.5-01 | Unimplemented |
| R-B7.5-02 | B 7.5 | Imported Song Mode imports a supported music file (picker or drag and drop) | P0 | M-14 | Phase 07 | AT-R-B7.5-02 | Unimplemented |
| R-B7.5-03 | B 7.5 | The user inspects detected tracks and instruments on SCR-ImportInspect | P0 | M-14, M-27 | Phase 07 | AT-R-B7.5-03 | Unimplemented |
| R-B7.5-04 | B 7.5 | The user selects the track or tracks to play | P0 | M-27, M-08 | Phase 08 | AT-R-B7.5-04 | Unimplemented |
| R-B7.5-05 | B 7.5 | The user chooses the target instrument | P0 | M-27, M-08 | Phase 08 | AT-R-B7.5-05 | Unimplemented |
| R-B7.5-06 | B 7.5 | Imported notes map to the four-button layout by the deterministic ChartGenerator | P0 | M-08 | Phase 08 | AT-R-B7.5-06 | Unimplemented |
| R-B7.5-07 | B 7.5 | The user selects a difficulty or automatic mapping (recommended track and difficulty) | P0 | M-08, M-27 | Phase 08 | AT-R-B7.5-07 | Unimplemented |
| R-B7.5-08 | B 7.5 | The user plays along with the source arrangement | P0 | M-05, M-09 | Phase 08 | AT-R-B7.5-08 | Unimplemented |
| R-B7.5-09 | B 7.5 | The user mutes or lowers the target instrument in the backing mix (targetTrackMode mute, lower, full) | P0 | M-05 | Phase 08 | AT-R-B7.5-09 | Unimplemented |
| R-B7.5-10 | B 7.5 | The user slows down or speeds up playback (0.25x to 2.0x) without changing pitch of MIDI parts | P0 | M-04 | Phase 08 | AT-R-B7.5-10 | Unimplemented |
| R-B7.5-11 | B 7.5 | The user seeks to a musical position (bar and beat) | P0 | M-04 | Phase 07 | AT-R-B7.5-11 | Unimplemented |
| R-B7.5-12 | B 7.5 | The user loops a section | P0 | M-04 | Phase 07 | AT-R-B7.5-12 | Unimplemented |
| R-B7.5-13 | B 7.5 | Pause and resume cause no timing drift (re-anchor to the audio clock) | P0 | M-04 | Phase 02 | AT-R-B7.5-13 | Unimplemented |
| R-B7.5-14 | B 7.5 | The user views score and performance feedback | P0 | M-09, M-27 | Phase 08 | AT-R-B7.5-14 | Unimplemented |
| R-B7.5-15 | B 7.5 | The user views the virtual band performing the arrangement during play | P0 | M-21, M-20 | Phase 08 | AT-R-B7.5-15 | Unimplemented |
| R-B7.5-16 | B 7.5 | The source arrangement stays intact internally when the chart is simplified (Chart separate from Song) | P0 | M-03, M-08 | Phase 08 | AT-R-B7.5-16 | Unimplemented |
| R-B7.6-01 | B 7.6 | Dance Mode uses four directional or position-based step inputs (layout arrows or pads) | P1 | M-23 | Phase 11 | AT-R-B7.6-01 | Unimplemented |
| R-B7.6-02 | B 7.6 | Dance Mode supports keyboard (arrows, alternates KeyD KeyF KeyJ KeyK) and touch controls | P1 | M-23, M-07 | Phase 11 | AT-R-B7.6-02 | Unimplemented |
| R-B7.6-03 | B 7.6 | Dance Mode supports optional gamepad input | P1 | M-23, M-07 | Phase 11 | AT-R-B7.6-03 | Unimplemented |
| R-B7.6-04 | B 7.6 | Dance step charts are aligned to musical time in ticks | P1 | M-23 | Phase 11 | AT-R-B7.6-04 | Unimplemented |
| R-B7.6-05 | B 7.6 | Dance Mode offers difficulty levels easy, normal and hard | P1 | M-23 | Phase 11 | AT-R-B7.6-05 | Unimplemented |
| R-B7.6-06 | B 7.6 | Dance Mode gives timing judgments | P1 | M-23 | Phase 11 | AT-R-B7.6-06 | Unimplemented |
| R-B7.6-07 | B 7.6 | Dance Mode keeps combo and score | P1 | M-23 | Phase 11 | AT-R-B7.6-07 | Unimplemented |
| R-B7.6-08 | B 7.6 | Dance Mode shows miss and accuracy feedback | P1 | M-23, M-27 | Phase 11 | AT-R-B7.6-08 | Unimplemented |
| R-B7.6-09 | B 7.6 | Dance Mode shows song progress | P1 | M-23, M-26 | Phase 11 | AT-R-B7.6-09 | Unimplemented |
| R-B7.6-10 | B 7.6 | Dance Mode offers optional avatar choreography | P1 | M-23, M-20 | Phase 11 | AT-R-B7.6-10 | Unimplemented |
| R-B7.6-11 | B 7.6 | Dance Mode input layouts are configurable (remappable keys, arrows or pads layout) | P1 | M-23, M-07 | Phase 11 | AT-R-B7.6-11 | Unimplemented |
| R-B7.6-12 | B 7.6 | Dance Mode loads custom or imported dance charts (.flmdance.json) | P1 | M-23, M-16 | Phase 11 | AT-R-B7.6-12 | Unimplemented |
| R-B7.6-13 | B 7.6 | The dance chart system is independent of instrument note mapping | P1 | M-23 | Phase 11 | AT-R-B7.6-13 | Unimplemented |
| R-B7.7-01 | B 7.7 | Multiplayer creates and joins rooms | P1 | M-24, M-27 | Phase 13 | AT-R-B7.7-01 | Unimplemented |
| R-B7.7-02 | B 7.7 | Join mechanism: invite and answer codes; 6-character room codes in the Online edition | P1 | M-24 | Phase 13 | AT-R-B7.7-02 | Unimplemented |
| R-B7.7-03 | B 7.7 | Each player has an identity (display name) and an avatar | P1 | M-24, M-22 | Phase 13 | AT-R-B7.7-03 | Unimplemented |
| R-B7.7-04 | B 7.7 | The host selects song and mode for the room | P1 | M-24, M-27 | Phase 13 | AT-R-B7.7-04 | Unimplemented |
| R-B7.7-05 | B 7.7 | Players set ready states; start needs every player ready | P1 | M-24, M-27 | Phase 13 | AT-R-B7.7-05 | Unimplemented |
| R-B7.7-06 | B 7.7 | Session settings are host-controlled (song, mode, difficulty rules, start, pause) | P1 | M-24 | Phase 13 | AT-R-B7.7-06 | Unimplemented |
| R-B7.7-07 | B 7.7 | Start and pause are synchronized across players at a scheduled shared time | P1 | M-24, M-04 | Phase 13 | AT-R-B7.7-07 | Unimplemented |
| R-B7.7-08 | B 7.7 | Players share tempo and song position (shared clock, target sync error <= 20 ms) | P1 | M-24, M-04 | Phase 13 | AT-R-B7.7-08 | Unimplemented |
| R-B7.7-09 | B 7.7 | Each player has a separate performance state (judge, score, combo) | P1 | M-24, M-09 | Phase 13 | AT-R-B7.7-09 | Unimplemented |
| R-B7.7-10 | B 7.7 | Multiplayer scoring with per-player results and ranking computed by the host | P1 | M-24, M-09 | Phase 13 | AT-R-B7.7-10 | Unimplemented |
| R-B7.7-11 | B 7.7 | Reconnection is handled: a dropped peer may rejoin the room and keeps its identity | P1 | M-24 | Phase 13 | AT-R-B7.7-11 | Unimplemented |
| R-B7.7-12 | B 7.7 | A disconnected host ends the session gracefully for guests, with results so far | P1 | M-24, M-27 | Phase 13 | AT-R-B7.7-12 | Unimplemented |
| R-B7.7-13 | B 7.7 | Host migration to a guest when the host leaves | P2 | M-24 | Phase 13 | n/a | Deferred |
| R-B7.7-14 | B 7.7 | Session cleanup closes peer connections and channels, timers and listeners on leave | P1 | M-24, M-28 | Phase 13 | AT-R-B7.7-14 | Unimplemented |
| R-B7.7-15 | B 7.7 | Distinguish shared-song synchronized play: Synchronized Play experience | P1 | M-24, M-27 | Phase 13 | AT-R-B7.7-15 | Unimplemented |
| R-B7.7-16 | B 7.7 | Distinguish cooperative performance: Cooperative Band (different tracks of one arrangement) | P1 | M-24, M-27 | Phase 13 | AT-R-B7.7-16 | Unimplemented |
| R-B7.7-17 | B 7.7 | Distinguish competitive scoring: Synchronized Play ranks players by host-validated score | P1 | M-24, M-09 | Phase 13 | AT-R-B7.7-17 | Unimplemented |
| R-B7.7-18 | B 7.7 | Shared creative sessions: Collaborative Studio rules specified, shown as a disabled card | P2 | M-24, M-27 | Phase 13 | n/a | Deferred |
| R-B7.7-19 | B 7.7 | Multiplayer features not in v1 are scoped and documented in About limits and the How this works panel | P1 | M-27, M-24 | Phase 13 | AT-R-B7.7-19 | Unimplemented |

#### 15.1.8 B 8 Four-button input and musical mapping

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B8.1-01 | B 8.1 | All physical and virtual inputs feed one shared input abstraction (FLM.Input) | P0 | M-07 | Phase 03 | AT-R-B8.1-01 | Unimplemented |
| R-B8.1-02 | B 8.1 | Keyboard input source using KeyboardEvent.code, key repeat suppressed | P0 | M-07 | Phase 03 | AT-R-B8.1-02 | Unimplemented |
| R-B8.1-03 | B 8.1 | Mouse input source through Pointer Events where applicable | P0 | M-07 | Phase 03 | AT-R-B8.1-03 | Unimplemented |
| R-B8.1-04 | B 8.1 | Touchscreen input source through Pointer Events with touch-action none on controls | P0 | M-07, M-26 | Phase 03 | AT-R-B8.1-04 | Unimplemented |
| R-B8.1-05 | B 8.1 | Standard game controller source through the Gamepad API, polled in the render loop | P1 | M-07 | Phase 03 | AT-R-B8.1-05 | Unimplemented |
| R-B8.1-06 | B 8.1 | Optional MIDI input devices through Web MIDI where the browser permits it | P2 | M-07 | Phase 03 | n/a | Unimplemented |
| R-B8.1-07 | B 8.1 | Every source normalizes to InputEvent press and release with tPerf and tAudio; holds derive from state | P0 | M-07 | Phase 03 | AT-R-B8.1-07 | Unimplemented |
| R-B8.2-01 | B 8.2 | Default desktop lane keys are four adjacent keys: KeyA KeyS KeyK KeyL | P0 | M-07 | Phase 03 | AT-R-B8.2-01 | Unimplemented |
| R-B8.2-02 | B 8.2 | Every key binding is configurable (remap with conflict detection, reset to defaults) | P0 | M-07, M-27 | Phase 03 | AT-R-B8.2-02 | Unimplemented |
| R-B8.2-03 | B 8.2 | Mobile shows four large touch pads (#touch) | P0 | M-26, M-07 | Phase 03 | AT-R-B8.2-03 | Unimplemented |
| R-B8.2-04 | B 8.2 | Touch pads accept simultaneous presses on up to four pointers where the device allows | P0 | M-07, M-26 | Phase 03 | AT-R-B8.2-04 | Unimplemented |
| R-B8.3-01 | B 8.3 | The mapping system supports multiple selectable profiles (A-F) | P0 | M-08 | Phase 03 | AT-R-B8.3-01 | Unimplemented |
| R-B8.3-02 | B 8.3 | Profile A Four-note lanes: each button is a lane or note group; simultaneous buttons form chords | P0 | M-08 | Phase 03 | AT-R-B8.3-02 | Unimplemented |
| R-B8.3-03 | B 8.3 | Profile B Interval: buttons play intervals relative to a selected root | P0 | M-08, M-02 | Phase 03 | AT-R-B8.3-03 | Unimplemented |
| R-B8.3-04 | B 8.3 | Profile C Chord: buttons play selected chord types or voicings with a configurable root | P0 | M-08, M-02 | Phase 03 | AT-R-B8.3-04 | Unimplemented |
| R-B8.3-05 | B 8.3 | Profile D Scale: buttons play scale notes with configurable octave and register | P0 | M-08, M-02 | Phase 03 | AT-R-B8.3-05 | Unimplemented |
| R-B8.3-06 | B 8.3 | Profile E Instrument-specific: mapping adapted to the instrument and its playable range | P1 | M-08, M-06 | Phase 03 | AT-R-B8.3-06 | Unimplemented |
| R-B8.3-07 | B 8.3 | Profile F Rhythm: buttons trigger rhythmic or percussive actions (drum lanes) | P1 | M-08 | Phase 03 | AT-R-B8.3-07 | Unimplemented |
| R-B8.3-08 | B 8.3 | Switching profiles never modifies the source arrangement | P0 | M-08 | Phase 03 | AT-R-B8.3-08 | Unimplemented |
| R-B8.4-01 | B 8.4 | Input supports simultaneous button presses | P0 | M-07 | Phase 03 | AT-R-B8.4-01 | Unimplemented |
| R-B8.4-02 | B 8.4 | Input supports multiple active notes at once | P0 | M-08, M-06 | Phase 03 | AT-R-B8.4-02 | Unimplemented |
| R-B8.4-03 | B 8.4 | Input produces paired note-on and note-off events | P0 | M-07, M-08 | Phase 03 | AT-R-B8.4-03 | Unimplemented |
| R-B8.4-04 | B 8.4 | Input supports held notes for as long as the button is down | P0 | M-07, M-08 | Phase 03 | AT-R-B8.4-04 | Unimplemented |
| R-B8.4-05 | B 8.4 | Input supports sustained notes (sustain keeps notes after release until sustain ends) | P0 | M-08, M-06 | Phase 03 | AT-R-B8.4-05 | Unimplemented |
| R-B8.4-06 | B 8.4 | Input supports repeated notes: retrigger releases the previous voice of that pitch first | P0 | M-08, M-06 | Phase 03 | AT-R-B8.4-06 | Unimplemented |
| R-B8.4-07 | B 8.4 | Chord recognition of simultaneous input where relevant (Theory.recognizeChord, chord window 30 ms) | P1 | M-02, M-08 | Phase 03 | AT-R-B8.4-07 | Unimplemented |
| R-B8.4-08 | B 8.4 | Instrument-specific note limits where needed: range folding and per-instrument polyphony caps | P1 | M-08 | Phase 03 | AT-R-B8.4-08 | Unimplemented |
| R-B8.4-09 | B 8.4 | Polyphonic source is never discarded: ChartNote keeps pitches and sourceEventIds of every note | P0 | M-08 | Phase 08 | AT-R-B8.4-09 | Unimplemented |
| R-B8.5-01 | B 8.5 | The user configures input offset (Calibration.inputOffsetMs) | P0 | M-07, M-09 | Phase 03 | AT-R-B8.5-01 | Unimplemented |
| R-B8.5-02 | B 8.5 | The user configures audio output latency compensation (Calibration.audioLatencyMs) | P0 | M-05, M-09 | Phase 03 | AT-R-B8.5-02 | Unimplemented |
| R-B8.5-03 | B 8.5 | The user configures visual lead time (default 1,500 ms, range 600-3,000 ms) | P0 | M-21, M-09 | Phase 03 | AT-R-B8.5-03 | Unimplemented |
| R-B8.5-04 | B 8.5 | Touch-control behavior: pad size 56/72/88 px, landscape placement bottom or right, opacity | P1 | M-26, M-07 | Phase 03 | AT-R-B8.5-04 | Unimplemented |
| R-B8.5-05 | B 8.5 | Hold and release behavior: stray-press penalty toggle; hold tails judged with the same windows | P0 | M-09 | Phase 03 | AT-R-B8.5-05 | Unimplemented |
| R-B8.5-06 | B 8.5 | Note sustain handling: note length hold or fixed (50-2000 ms) plus sustain key ShiftLeft | P1 | M-08, M-06 | Phase 03 | AT-R-B8.5-06 | Unimplemented |
| R-B8.5-07 | B 8.5 | Latency compensation is applied exactly once, inside Rhythm.Judge only | P0 | M-09 | Phase 03 | AT-R-B8.5-07 | Unimplemented |

#### 15.1.9 B 9 Rhythm engine and scoring

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B9.1-01 | B 9.1 | The rhythm engine runs on integer ticks at internal PPQ 960 | P0 | M-03 | Phase 02 | AT-R-B9.1-01 | Unimplemented |
| R-B9.1-02 | B 9.1 | The timeline supports tempo (usPerQuarter entries) | P0 | M-03 | Phase 02 | AT-R-B9.1-02 | Unimplemented |
| R-B9.1-03 | B 9.1 | The timeline supports time signature (MeterMap) | P0 | M-03 | Phase 02 | AT-R-B9.1-03 | Unimplemented |
| R-B9.1-04 | B 9.1 | The timeline has a defined tick resolution; source resolutions are rescaled to 960 exactly | P0 | M-03, M-10 | Phase 02 | AT-R-B9.1-04 | Unimplemented |
| R-B9.1-05 | B 9.1 | The timeline gives beat and subdivision positions (MeterMap.barAt and beatAt) | P0 | M-03 | Phase 02 | AT-R-B9.1-05 | Unimplemented |
| R-B9.1-06 | B 9.1 | The timeline supports note-on and note-off as NoteEvent tick plus durTicks | P0 | M-03 | Phase 02 | AT-R-B9.1-06 | Unimplemented |
| R-B9.1-07 | B 9.1 | The timeline supports chords (several notes at one tick) | P0 | M-03 | Phase 02 | AT-R-B9.1-07 | Unimplemented |
| R-B9.1-08 | B 9.1 | The timeline supports tempo maps: piecewise-constant segments with cumulative seconds | P0 | M-03 | Phase 02 | AT-R-B9.1-08 | Unimplemented |
| R-B9.1-09 | B 9.1 | The timeline supports time-signature changes | P0 | M-03 | Phase 02 | AT-R-B9.1-09 | Unimplemented |
| R-B9.1-10 | B 9.1 | The timeline exposes song position (Transport.positionAt) | P0 | M-04 | Phase 02 | AT-R-B9.1-10 | Unimplemented |
| R-B9.1-11 | B 9.1 | The timeline supports loop regions (minimum 0.25 s) | P0 | M-04 | Phase 02 | AT-R-B9.1-11 | Unimplemented |
| R-B9.1-12 | B 9.1 | The timeline supports count-in of 1 or 2 bars | P0 | M-04 | Phase 02 | AT-R-B9.1-12 | Unimplemented |
| R-B9.1-13 | B 9.1 | The timeline supports pause and resume | P0 | M-04 | Phase 02 | AT-R-B9.1-13 | Unimplemented |
| R-B9.1-14 | B 9.1 | The timeline supports seeking | P0 | M-04 | Phase 02 | AT-R-B9.1-14 | Unimplemented |
| R-B9.1-15 | B 9.1 | The timeline supports playback speed changes (0.25 to 2.0) | P0 | M-04 | Phase 02 | AT-R-B9.1-15 | Unimplemented |
| R-B9.1-16 | B 9.1 | Musical time is separate from rendering frame time; frame count never advances the timeline | P0 | M-04, M-18 | Phase 02 | AT-R-B9.1-16 | Unimplemented |
| R-B9.2-01 | B 9.2 | Audio and visuals share one timing model anchored to AudioContext.currentTime | P0 | M-04, M-05 | Phase 04 | AT-R-B9.2-01 | Unimplemented |
| R-B9.2-02 | B 9.2 | The scheduler books events ahead on the audio clock: 120 ms lookahead, 25 ms tick | P0 | M-05 | Phase 04 | AT-R-B9.2-02 | Unimplemented |
| R-B9.2-03 | B 9.2 | The render loop reads Transport.positionAt(audio time) and never uses frame count as the clock | P0 | M-18, M-21 | Phase 05 | AT-R-B9.2-03 | Unimplemented |
| R-B9.2-04 | B 9.2 | Background-tab throttling or dropped frames never permanently shift the musical timeline | P0 | M-04, M-05 | Phase 04 | AT-R-B9.2-04 | Unimplemented |
| R-B9.3-01 | B 9.3 | Judgments perfect, great, good, miss; windows configurable (preset standard, relaxed x1.5, strict x0.75) | P0 | M-09 | Phase 03 | AT-R-B9.3-01 | Unimplemented |
| R-B9.3-02 | B 9.3 | Windows per difficulty in ms: 45/90/135, 35/70/110, 25/55/90, 18/40/70, documented in Help | P0 | M-09 | Phase 03 | AT-R-B9.3-02 | Unimplemented |
| R-B9.3-03 | B 9.3 | A judgment compares the input timestamp with the event time after calibration is applied | P0 | M-09 | Phase 03 | AT-R-B9.3-03 | Unimplemented |
| R-B9.4-01 | B 9.4 | Scoring records a judgment per note | P0 | M-09 | Phase 03 | AT-R-B9.4-01 | Unimplemented |
| R-B9.4-02 | B 9.4 | Scoring keeps combo | P0 | M-09 | Phase 03 | AT-R-B9.4-02 | Unimplemented |
| R-B9.4-03 | B 9.4 | Scoring keeps maximum combo | P0 | M-09 | Phase 03 | AT-R-B9.4-03 | Unimplemented |
| R-B9.4-04 | B 9.4 | Scoring gives accuracy percentage = points / (100 * judged) | P0 | M-09 | Phase 03 | AT-R-B9.4-04 | Unimplemented |
| R-B9.4-05 | B 9.4 | Score is an integer: 100/70/40/0 points times multiplier 1 + floor(combo/10), capped at 4 | P0 | M-09 | Phase 03 | AT-R-B9.4-05 | Unimplemented |
| R-B9.4-06 | B 9.4 | Scoring gives the miss count | P0 | M-09 | Phase 03 | AT-R-B9.4-06 | Unimplemented |
| R-B9.4-07 | B 9.4 | Scoring gives song completion percentage | P0 | M-09 | Phase 03 | AT-R-B9.4-07 | Unimplemented |
| R-B9.4-08 | B 9.4 | Scoring gives per-player statistics in multiplayer | P1 | M-24, M-09 | Phase 13 | AT-R-B9.4-08 | Unimplemented |
| R-B9.4-09 | B 9.4 | Scoring is deterministic: equal input event sequences give equal results | P0 | M-09 | Phase 03 | AT-R-B9.4-09 | Unimplemented |
| R-B9.4-10 | B 9.4 | Frame timing is never scored: judging uses event timestamps mapped to audio time | P0 | M-09 | Phase 03 | AT-R-B9.4-10 | Unimplemented |

#### 15.1.10 B 10 Music theory and configuration

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B10.1-01 | B 10.1 | Represent all twelve chromatic pitch classes | P0 | M-02 | Phase 02 | AT-R-B10.1-01 | Unimplemented |
| R-B10.1-02 | B 10.1 | Keep enharmonic spelling where the source provides it (MusicXML step and alter; key context) | P1 | M-02, M-12 | Phase 02 | AT-R-B10.1-02 | Unimplemented |
| R-B10.2-01 | B 10.2 | Scale table includes Major | P0 | M-02 | Phase 03 | AT-R-B10.2-01 | Unimplemented |
| R-B10.2-02 | B 10.2 | Scale table includes Natural minor | P0 | M-02 | Phase 03 | AT-R-B10.2-02 | Unimplemented |
| R-B10.2-03 | B 10.2 | Scale table includes Harmonic minor | P0 | M-02 | Phase 03 | AT-R-B10.2-03 | Unimplemented |
| R-B10.2-04 | B 10.2 | Scale table includes Melodic minor | P0 | M-02 | Phase 03 | AT-R-B10.2-04 | Unimplemented |
| R-B10.2-05 | B 10.2 | Scale table includes Major pentatonic | P0 | M-02 | Phase 03 | AT-R-B10.2-05 | Unimplemented |
| R-B10.2-06 | B 10.2 | Scale table includes Minor pentatonic | P0 | M-02 | Phase 03 | AT-R-B10.2-06 | Unimplemented |
| R-B10.2-07 | B 10.2 | Scale table includes Blues | P0 | M-02 | Phase 03 | AT-R-B10.2-07 | Unimplemented |
| R-B10.2-08 | B 10.2 | Scale table includes Chromatic | P0 | M-02 | Phase 03 | AT-R-B10.2-08 | Unimplemented |
| R-B10.2-09 | B 10.2 | User-defined scale patterns (up to 64, persisted under flm.v1.settings.userScales) | P1 | M-02, M-27 | Phase 06 | AT-R-B10.2-09 | Unimplemented |
| R-B10.2-10 | B 10.2 | Further modes are data-driven SCALES entries (dorian, mixolydian and the rest of the table) | P1 | M-02 | Phase 03 | AT-R-B10.2-10 | Unimplemented |
| R-B10.3-01 | B 10.3 | Configurable chord definitions include major and minor triads | P0 | M-02 | Phase 03 | AT-R-B10.3-01 | Unimplemented |
| R-B10.3-02 | B 10.3 | Chord definitions include diminished and augmented triads | P0 | M-02 | Phase 03 | AT-R-B10.3-02 | Unimplemented |
| R-B10.3-03 | B 10.3 | Chord definitions include suspended chords (sus2, sus4) | P0 | M-02 | Phase 03 | AT-R-B10.3-03 | Unimplemented |
| R-B10.3-04 | B 10.3 | Chord definitions include seventh chords | P0 | M-02 | Phase 03 | AT-R-B10.3-04 | Unimplemented |
| R-B10.3-05 | B 10.3 | Chord definitions include extended chords where practical (add9, 9, maj9, m9, 6, m6) | P1 | M-02 | Phase 03 | AT-R-B10.3-05 | Unimplemented |
| R-B10.3-06 | B 10.3 | Interval definitions cover the common intervals from unison to two octaves (P1 to P15) | P0 | M-02 | Phase 03 | AT-R-B10.3-06 | Unimplemented |
| R-B10.3-07 | B 10.3 | Chords support inversions and voicings | P1 | M-02, M-08 | Phase 03 | AT-R-B10.3-07 | Unimplemented |
| R-B10.4-01 | B 10.4 | Scale mapping defines the root pitch | P0 | M-08 | Phase 03 | AT-R-B10.4-01 | Unimplemented |
| R-B10.4-02 | B 10.4 | Scale mapping defines the scale interval pattern | P0 | M-08, M-02 | Phase 03 | AT-R-B10.4-02 | Unimplemented |
| R-B10.4-03 | B 10.4 | Scale mapping defines the octave | P0 | M-08 | Phase 03 | AT-R-B10.4-03 | Unimplemented |
| R-B10.4-04 | B 10.4 | Scale mapping defines the register (low and high pitch bounds) | P0 | M-08 | Phase 03 | AT-R-B10.4-04 | Unimplemented |
| R-B10.4-05 | B 10.4 | Scale mapping defines button-to-note and button-to-chord assignment | P0 | M-08 | Phase 03 | AT-R-B10.4-05 | Unimplemented |
| R-B10.4-06 | B 10.4 | Out-of-range policy: a pitch outside the range is folded by octaves into the range | P0 | M-08 | Phase 03 | AT-R-B10.4-06 | Unimplemented |
| R-B10.4-07 | B 10.4 | Scale mapping offers optional note quantization to the grid | P1 | M-08 | Phase 06 | AT-R-B10.4-07 | Unimplemented |
| R-B10.5-01 | B 10.5 | Tempo is configurable (20-300 BPM) and common time signatures are selectable | P0 | M-04, M-03 | Phase 06 | AT-R-B10.5-01 | Unimplemented |
| R-B10.5-02 | B 10.5 | The model holds tempo and time-signature changes contained in imported arrangements | P0 | M-03 | Phase 02 | AT-R-B10.5-02 | Unimplemented |

#### 15.1.11 B 11 Audio engine

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B11.1-01 | B 11.1 | Reliable playback of synthesized notes | P0 | M-05, M-06 | Phase 04 | AT-R-B11.1-01 | Unimplemented |
| R-B11.1-02 | B 11.1 | Sample playback path: decoded AudioBuffer playback for imported audio tracks | P1 | M-14, M-05 | Phase 12 | AT-R-B11.1-02 | Unimplemented |
| R-B11.1-03 | B 11.1 | Sampled instrument sounds from a user-loaded SoundFont (.sf2); UI says synthesized | P2 | M-06 | Phase 04 | n/a | Deferred |
| R-B11.1-04 | B 11.1 | Reliable percussion playback: GM channel 10, keys 35-81 on 12 synthesized drum voices | P0 | M-06 | Phase 04 | AT-R-B11.1-04 | Unimplemented |
| R-B11.1-05 | B 11.1 | Reliable playback of polyphonic sequences | P0 | M-05, M-06 | Phase 04 | AT-R-B11.1-05 | Unimplemented |
| R-B11.1-06 | B 11.1 | Reliable playback of multitrack arrangements (one ChannelStrip per track) | P0 | M-05 | Phase 04 | AT-R-B11.1-06 | Unimplemented |
| R-B11.1-07 | B 11.1 | Reliable playback of live input (Instruments.liveNoteOn started immediately on press) | P0 | M-06, M-08 | Phase 06 | AT-R-B11.1-07 | Unimplemented |
| R-B11.1-08 | B 11.1 | Reliable playback of recorded performances | P0 | M-05, M-17 | Phase 06 | AT-R-B11.1-08 | Unimplemented |
| R-B11.1-09 | B 11.1 | Reliable playback of imported MIDI | P0 | M-05, M-10 | Phase 07 | AT-R-B11.1-09 | Unimplemented |
| R-B11.1-10 | B 11.1 | Metronome clicks on their own bus, beat 1 accented | P0 | M-05 | Phase 06 | AT-R-B11.1-10 | Unimplemented |
| R-B11.1-11 | B 11.1 | Reliable playback of backing tracks (non-target tracks and imported audio tracks) | P0 | M-05 | Phase 08 | AT-R-B11.1-11 | Unimplemented |
| R-B11.1-12 | B 11.1 | Independent per-track volume and mute state (ChannelStrip gain and mute) | P0 | M-05 | Phase 04 | AT-R-B11.1-12 | Unimplemented |
| R-B11.2-01 | B 11.2 | Audio is built on the Web Audio API only (ADR-04) | P0 | M-05 | Phase 04 | AT-R-B11.2-01 | Unimplemented |
| R-B11.2-02 | B 11.2 | Evaluate oscillator synthesis, sample playback, GM bank playback, bank size and load time (ADR-04) | P1 | none | Phase 00 | AT-R-B11.2-02 | Unimplemented |
| R-B11.2-03 | B 11.2 | Polyphony limits: 64 voices desktop, 32 mobile (audio.polyphonyCap 16-64 override) | P0 | M-05 | Phase 04 | AT-R-B11.2-03 | Unimplemented |
| R-B11.2-04 | B 11.2 | VoiceAllocator assigns voices from a bounded pool | P0 | M-05 | Phase 04 | AT-R-B11.2-04 | Unimplemented |
| R-B11.2-05 | B 11.2 | Note stealing order: released voices quietest first, then oldest, with a short fade | P0 | M-05 | Phase 04 | AT-R-B11.2-05 | Unimplemented |
| R-B11.2-06 | B 11.2 | Envelope handling: ADSR per patch with click-free attack and release ramps | P0 | M-06 | Phase 04 | AT-R-B11.2-06 | Unimplemented |
| R-B11.2-07 | B 11.2 | Audio scheduling by the lookahead Scheduler on AudioContext.currentTime | P0 | M-05 | Phase 04 | AT-R-B11.2-07 | Unimplemented |
| R-B11.2-08 | B 11.2 | Mixing and master output: channel strips, master gain, limiter, metronome bus | P0 | M-05 | Phase 04 | AT-R-B11.2-08 | Unimplemented |
| R-B11.2-09 | B 11.2 | Combine synthesis methods beyond plain oscillators: subtractive, FM, Karplus-Strong, noise, additive | P1 | M-06 | Phase 04 | AT-R-B11.2-09 | Unimplemented |
| R-B11.3-01 | B 11.3 | Broad GM coverage: all 128 melodic programs plus GM percussion keys 35-81 | P1 | M-06 | Phase 04 | AT-R-B11.3-01 | Unimplemented |
| R-B11.3-02 | B 11.3 | Fidelity level 1: correct program assignment from ProgramEvent per channel | P0 | M-06 | Phase 04 | AT-R-B11.3-02 | Unimplemented |
| R-B11.3-03 | B 11.3 | Fidelity level 2: correct note pitches and timing | P0 | M-05, M-06 | Phase 04 | AT-R-B11.3-03 | Unimplemented |
| R-B11.3-04 | B 11.3 | Fidelity level 3: correct percussion channel (10) and drum key mapping | P0 | M-06 | Phase 04 | AT-R-B11.3-04 | Unimplemented |
| R-B11.3-05 | B 11.3 | Fidelity level 4: reasonable timbral similarity via 16 family templates and program overrides | P1 | M-06 | Phase 14 | AT-R-B11.3-05 | Unimplemented |
| R-B11.3-06 | B 11.3 | Fidelity level 5: articulation and expression reproduced only from events that carry them | P1 | M-06 | Phase 14 | AT-R-B11.3-06 | Unimplemented |
| R-B11.3-07 | B 11.3 | Fidelity declared per program (synth-basic or synth-velocity) and shown in the instrument picker | P1 | M-06, M-27 | Phase 04 | AT-R-B11.3-07 | Unimplemented |
| R-B11.3-08 | B 11.3 | GM is presented as an assignment standard; no text implies identical or sampled sound | P0 | M-27 | Phase 04 | AT-R-B11.3-08 | Unimplemented |
| R-B11.3-09 | B 11.3 | GM program mapping table for all programs (FLM.Instruments.DEFINITIONS) | P0 | M-06 | Phase 04 | AT-R-B11.3-09 | Unimplemented |
| R-B11.3-10 | B 11.3 | Documented strategy: reduced built-in synthesized set; never claim full acoustic fidelity | P0 | M-06, M-27 | Phase 04 | AT-R-B11.3-10 | Unimplemented |
| R-B11.4-01 | B 11.4 | Playback preserves pitch | P0 | M-06 | Phase 04 | AT-R-B11.4-01 | Unimplemented |
| R-B11.4-02 | B 11.4 | Playback preserves velocity (gain and brightness by velocity layer) | P0 | M-06 | Phase 04 | AT-R-B11.4-02 | Unimplemented |
| R-B11.4-03 | B 11.4 | Playback preserves duration | P0 | M-05, M-06 | Phase 04 | AT-R-B11.4-03 | Unimplemented |
| R-B11.4-04 | B 11.4 | Playback applies program selection per channel at event time | P0 | M-06 | Phase 04 | AT-R-B11.4-04 | Unimplemented |
| R-B11.4-05 | B 11.4 | Playback preserves channel (16 ChannelState records per song) | P0 | M-06 | Phase 04 | AT-R-B11.4-05 | Unimplemented |
| R-B11.4-06 | B 11.4 | Playback applies sustain pedal CC 64 | P0 | M-06 | Phase 04 | AT-R-B11.4-06 | Unimplemented |
| R-B11.4-07 | B 11.4 | Playback applies pitch bend with RPN 0 range (default 2 semitones, 0-24) | P0 | M-06 | Phase 04 | AT-R-B11.4-07 | Unimplemented |
| R-B11.4-08 | B 11.4 | Playback applies modulation CC 1 as vibrato depth | P1 | M-06 | Phase 04 | AT-R-B11.4-08 | Unimplemented |
| R-B11.4-09 | B 11.4 | Playback applies volume CC 7 and expression CC 11 | P0 | M-06 | Phase 04 | AT-R-B11.4-09 | Unimplemented |
| R-B11.4-10 | B 11.4 | Playback applies pan CC 10 | P0 | M-06 | Phase 04 | AT-R-B11.4-10 | Unimplemented |
| R-B11.4-11 | B 11.4 | Playback applies controllers 121 reset all and 123 all notes off, and RPN data entry 6 and 38 | P1 | M-06 | Phase 04 | AT-R-B11.4-11 | Unimplemented |
| R-B11.4-12 | B 11.4 | Unsupported controllers are ignored deterministically, kept in data, warned once per number, documented | P0 | M-06, M-14 | Phase 07 | AT-R-B11.4-12 | Unimplemented |
| R-B11.5-01 | B 11.5 | MIDI-event recording captures editable NoteEvents into a RecordingTake | P0 | M-17 | Phase 06 | AT-R-B11.5-01 | Unimplemented |
| R-B11.5-02 | B 11.5 | Recording of the player's input events (InputEvent log) for replay and score verification | P1 | M-09, M-17 | Phase 08 | AT-R-B11.5-02 | Unimplemented |
| R-B11.5-03 | B 11.5 | Recording the rendered output: WAV render by OfflineAudioContext (MediaRecorder fallback, OQ-2) | P1 | M-05, M-16 | Phase 09 | AT-R-B11.5-03 | Unimplemented |
| R-B11.5-04 | B 11.5 | Export a final mixed track as a WAV download | P1 | M-05, M-16 | Phase 09 | AT-R-B11.5-04 | Unimplemented |
| R-B11.5-05 | B 11.5 | UI separates editable MIDI recording from rendered audio (distinct labels, actions, file types) | P1 | M-17, M-27 | Phase 09 | AT-R-B11.5-05 | Unimplemented |
| R-B11.5-06 | B 11.5 | Audio capture starts only from a user gesture and only when Caps reports support | P1 | M-05, M-01 | Phase 09 | AT-R-B11.5-06 | Unimplemented |
| R-B11.6-01 | B 11.6 | Playback never blocks the UI thread: each scheduler tick handles only the 120 ms lookahead window | P0 | M-05 | Phase 04 | AT-R-B11.6-01 | Unimplemented |
| R-B11.6-02 | B 11.6 | No unbounded voice creation: the pool never exceeds the polyphony cap | P0 | M-05 | Phase 04 | AT-R-B11.6-02 | Unimplemented |
| R-B11.6-03 | B 11.6 | No uncontrolled memory growth: <= 10 MB growth after 20 enter and leave cycles | P0 | M-05, M-28 | Phase 14 | AT-R-B11.6-03 | Unimplemented |
| R-B11.6-04 | B 11.6 | No large synchronous decoding: decodeAudioData is asynchronous; audio files <= 100 MB | P0 | M-14 | Phase 12 | AT-R-B11.6-04 | Unimplemented |
| R-B11.6-05 | B 11.6 | Events are scheduled by audio time, never only when they become visible on screen | P0 | M-05 | Phase 04 | AT-R-B11.6-05 | Unimplemented |
| R-B11.6-06 | B 11.6 | Define and test polyphony and track limits per device class (64 or 32 voices, 32 tracks) | P1 | M-05, M-17 | Phase 14 | AT-R-B11.6-06 | Unimplemented |

#### 15.1.12 B 12 3D rendering and performance visualization

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B12.1-01 | B 12.1 | Real-time 3D stage with camera control | P0 | M-18, M-21 | Phase 05 | AT-R-B12.1-01 | Unimplemented |
| R-B12.1-02 | B 12.1 | Stage lighting: one directional light, ambient, up to 4 point lights on High | P0 | M-18, M-21 | Phase 05 | AT-R-B12.1-02 | Unimplemented |
| R-B12.1-03 | B 12.1 | Ground or stage geometry | P0 | M-21 | Phase 05 | AT-R-B12.1-03 | Unimplemented |
| R-B12.1-04 | B 12.1 | Optional environmental elements (backdrop, truss, risers), dropped on Low | P1 | M-21 | Phase 05 | AT-R-B12.1-04 | Unimplemented |
| R-B12.1-05 | B 12.1 | Musicians and instrument props on the stage | P0 | M-21, M-19 | Phase 05 | AT-R-B12.1-05 | Unimplemented |
| R-B12.1-06 | B 12.1 | Visual effects (light pulses, particles), scaled by video.effectsLevel | P1 | M-21 | Phase 05 | AT-R-B12.1-06 | Unimplemented |
| R-B12.1-07 | B 12.1 | Performance-reactive elements driven by beats, sections and intensity | P1 | M-21, M-20 | Phase 05 | AT-R-B12.1-07 | Unimplemented |
| R-B12.1-08 | B 12.1 | Camera perspectives FullBand, Focus, Side, Overhead, Player, incl. full-band and focused musician | P0 | M-21 | Phase 05 | AT-R-B12.1-08 | Unimplemented |
| R-B12.2-01 | B 12.2 | Rig animates torso, head, neck, shoulders, upper and lower arms, hands, hips, upper and lower legs, feet | P0 | M-19 | Phase 05 | AT-R-B12.2-01 | Unimplemented |
| R-B12.2-02 | B 12.2 | Procedural skeletons built from capsules and boxes; no imported character models | P0 | M-19 | Phase 05 | AT-R-B12.2-02 | Unimplemented |
| R-B12.2-03 | B 12.2 | One rig interface shared by every instrument controller and every appearance | P0 | M-19, M-20 | Phase 05 | AT-R-B12.2-03 | Unimplemented |
| R-B12.3-01 | B 12.3 | Animation follows actual musical events (sched.noteOn and noteOff), not generic loops alone | P0 | M-20 | Phase 05 | AT-R-B12.3-01 | Unimplemented |
| R-B12.3-02 | B 12.3 | Piano and keyboard: hand motion correlated with notes and chord density | P0 | M-20 | Phase 05 | AT-R-B12.3-02 | Unimplemented |
| R-B12.3-03 | B 12.3 | Guitar and bass: fretting-hand position from pitch, strumming or picking per note | P0 | M-20 | Phase 05 | AT-R-B12.3-03 | Unimplemented |
| R-B12.3-04 | B 12.3 | Drums: limb motion coordinated with drum and cymbal events | P0 | M-20 | Phase 05 | AT-R-B12.3-04 | Unimplemented |
| R-B12.3-05 | B 12.3 | Strings: bow or plucking motion per note | P1 | M-20 | Phase 05 | AT-R-B12.3-05 | Unimplemented |
| R-B12.3-06 | B 12.3 | Winds and brass: instrument-specific hand and breath gestures | P1 | M-20 | Phase 05 | AT-R-B12.3-06 | Unimplemented |
| R-B12.3-07 | B 12.3 | Percussion: strikes aligned to percussion events | P1 | M-20 | Phase 05 | AT-R-B12.3-07 | Unimplemented |
| R-B12.3-08 | B 12.3 | Synthesizers: keyboard performance or control gestures | P1 | M-20 | Phase 05 | AT-R-B12.3-08 | Unimplemented |
| R-B12.3-09 | B 12.3 | No single generic arm motion for all instruments: controllerFor selects one controller per family | P0 | M-20 | Phase 05 | AT-R-B12.3-09 | Unimplemented |
| R-B12.4-01 | B 12.4 | Abstract visual representation for events without a practical humanoid animation | P1 | M-20 | Phase 05 | AT-R-B12.4-01 | Unimplemented |
| R-B12.4-02 | B 12.4 | Abstract visual: floating notes | P1 | M-20 | Phase 05 | AT-R-B12.4-02 | Unimplemented |
| R-B12.4-03 | B 12.4 | Abstract visual: pitch or frequency indicators | P1 | M-20 | Phase 05 | AT-R-B12.4-03 | Unimplemented |
| R-B12.4-04 | B 12.4 | Abstract visual: animated shapes | P1 | M-20 | Phase 05 | AT-R-B12.4-04 | Unimplemented |
| R-B12.4-05 | B 12.4 | Abstract visual: particles | P1 | M-20, M-21 | Phase 05 | AT-R-B12.4-05 | Unimplemented |
| R-B12.4-06 | B 12.4 | Abstract visual: rings or waves | P1 | M-20 | Phase 05 | AT-R-B12.4-06 | Unimplemented |
| R-B12.4-07 | B 12.4 | Abstract visual: instrument-specific visual motifs | P1 | M-20 | Phase 05 | AT-R-B12.4-07 | Unimplemented |
| R-B12.4-08 | B 12.4 | Abstract visual: motion trails | P1 | M-20 | Phase 05 | AT-R-B12.4-08 | Unimplemented |
| R-B12.4-09 | B 12.4 | Abstract visual: beat-synchronized stage effects | P1 | M-21, M-20 | Phase 05 | AT-R-B12.4-09 | Unimplemented |
| R-B12.4-10 | B 12.4 | Each abstract visual maps one event to one visual at event time (pitch to height, velocity to size) | P1 | M-20 | Phase 05 | AT-R-B12.4-10 | Unimplemented |
| R-B12.5-01 | B 12.5 | Visualization supports multiple simultaneous notes and multiple performers | P0 | M-20, M-21 | Phase 05 | AT-R-B12.5-01 | Unimplemented |
| R-B12.5-02 | B 12.5 | Animation intensity from note density, velocity and rhythmic activity (INTENSITY) | P1 | M-20 | Phase 05 | AT-R-B12.5-02 | Unimplemented |
| R-B12.5-03 | B 12.5 | No humanoid per MIDI note: one performer per track slot, at most 5 slots | P0 | M-21 | Phase 05 | AT-R-B12.5-03 | Unimplemented |
| R-B12.6-01 | B 12.6 | Compare a compact 3D library with custom WebGL and record the choice (ADR-02, ADR-03: own renderer) | P1 | none | Phase 00 | AT-R-B12.6-01 | Unimplemented |
| R-B12.6-02 | B 12.6 | Rendering architecture defines the scene graph (Node, Mesh, Material) | P0 | M-18 | Phase 05 | AT-R-B12.6-02 | Unimplemented |
| R-B12.6-03 | B 12.6 | Rendering architecture defines the camera system | P0 | M-18 | Phase 05 | AT-R-B12.6-03 | Unimplemented |
| R-B12.6-04 | B 12.6 | Rendering architecture defines geometry and material management (Primitives, shared buffers) | P0 | M-18 | Phase 05 | AT-R-B12.6-04 | Unimplemented |
| R-B12.6-05 | B 12.6 | Rendering architecture defines the avatar rig (FLM.Rig) | P0 | M-19 | Phase 05 | AT-R-B12.6-05 | Unimplemented |
| R-B12.6-06 | B 12.6 | Rendering architecture defines the procedural animation scheduler (Animation.Mixer) | P0 | M-20 | Phase 05 | AT-R-B12.6-06 | Unimplemented |
| R-B12.6-07 | B 12.6 | Rendering architecture defines event-to-animation mapping (controllers, 120 ms anticipation) | P0 | M-20 | Phase 05 | AT-R-B12.6-07 | Unimplemented |
| R-B12.6-08 | B 12.6 | Rendering architecture defines lighting | P0 | M-18 | Phase 05 | AT-R-B12.6-08 | Unimplemented |
| R-B12.6-09 | B 12.6 | Asset loading: every asset generated at startup from code; no network asset loading | P0 | M-18 | Phase 05 | AT-R-B12.6-09 | Unimplemented |
| R-B12.6-10 | B 12.6 | Resource disposal: buffers, textures and programs freed on leave and counted by Render.counters | P0 | M-18 | Phase 05 | AT-R-B12.6-10 | Unimplemented |
| R-B12.6-11 | B 12.6 | Render scaling: resolution scale per tier, override video.resolutionScale 0.5-1.0 | P0 | M-18 | Phase 05 | AT-R-B12.6-11 | Unimplemented |
| R-B12.6-12 | B 12.6 | Quality settings: tiers High, Balanced, Low, Abstract (video.tier, default auto) | P0 | M-18 | Phase 05 | AT-R-B12.6-12 | Unimplemented |
| R-B12.6-13 | B 12.6 | Device capability detection picks the starting tier (Render.pickTier from Caps) | P0 | M-18, M-01 | Phase 05 | AT-R-B12.6-13 | Unimplemented |
| R-B12.7-01 | B 12.7 | Degrade gracefully: auto-downgrade one tier when p95 frame time > 33 ms over 5 s | P1 | M-18 | Phase 14 | AT-R-B12.7-01 | Unimplemented |
| R-B12.7-02 | B 12.7 | Fallback level 1 (High): full 3D stage and skeletal animation | P1 | M-18, M-20 | Phase 05 | AT-R-B12.7-02 | Unimplemented |
| R-B12.7-03 | B 12.7 | Fallback level 2 (Balanced): reduced geometry and lighting | P1 | M-18 | Phase 05 | AT-R-B12.7-03 | Unimplemented |
| R-B12.7-04 | B 12.7 | Fallback level 3 (Low): reduced animation complexity | P1 | M-20 | Phase 05 | AT-R-B12.7-04 | Unimplemented |
| R-B12.7-05 | B 12.7 | Fallback level 4 (Low): simplified stage with abstract instrument visualizations | P1 | M-21, M-20 | Phase 05 | AT-R-B12.7-05 | Unimplemented |
| R-B12.7-06 | B 12.7 | Fallback level 5 (Abstract): 2D canvas visualization and highway on canvas#flat | P1 | M-18, M-21 | Phase 05 | AT-R-B12.7-06 | Unimplemented |
| R-B12.7-07 | B 12.7 | Audio and musical timing take priority over rendering; render work never delays the scheduler | P0 | M-18, M-05 | Phase 05 | AT-R-B12.7-07 | Unimplemented |

#### 15.1.13 B 13 Character customization

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B13.1-01 | B 13.1 | A dedicated character editor screen (SCR-Characters) | P0 | M-27, M-22 | Phase 10 | AT-R-B13.1-01 | Unimplemented |
| R-B13.1-02 | B 13.1 | Editor sets body or silhouette: slim, average, broad, with heightScale 0.9-1.1 | P0 | M-22, M-19 | Phase 10 | AT-R-B13.1-02 | Unimplemented |
| R-B13.1-03 | B 13.1 | Editor sets skin or surface color | P0 | M-22 | Phase 10 | AT-R-B13.1-03 | Unimplemented |
| R-B13.1-04 | B 13.1 | Editor sets hair style and color | P0 | M-22 | Phase 10 | AT-R-B13.1-04 | Unimplemented |
| R-B13.1-05 | B 13.1 | Editor sets facial features (face option) | P1 | M-22 | Phase 10 | AT-R-B13.1-05 | Unimplemented |
| R-B13.1-06 | B 13.1 | Editor sets clothing: top, bottom and shoes, each with style and color | P1 | M-22 | Phase 10 | AT-R-B13.1-06 | Unimplemented |
| R-B13.1-07 | B 13.1 | Editor sets accessories | P1 | M-22 | Phase 10 | AT-R-B13.1-07 | Unimplemented |
| R-B13.1-08 | B 13.1 | Editor sets instrument assignment | P0 | M-22, M-21 | Phase 10 | AT-R-B13.1-08 | Unimplemented |
| R-B13.1-09 | B 13.1 | Editor sets stage position (slot 0-4) | P1 | M-22, M-21 | Phase 10 | AT-R-B13.1-09 | Unimplemented |
| R-B13.1-10 | B 13.1 | Editor sets animation style: calm, normal, energetic | P1 | M-22, M-20 | Phase 10 | AT-R-B13.1-10 | Unimplemented |
| R-B13.1-11 | B 13.1 | Editor applies preset appearances (8 built-in presets) | P0 | M-22, M-30 | Phase 10 | AT-R-B13.1-11 | Unimplemented |
| R-B13.2-01 | B 13.2 | Character options are configuration data (OPTIONS catalog, CharacterConfig), not per-avatar code | P0 | M-22 | Phase 10 | AT-R-B13.2-01 | Unimplemented |
| R-B13.3-01 | B 13.3 | Appearance changes never break the skeleton or instrument animation (validateAttachments) | P0 | M-19, M-22 | Phase 10 | AT-R-B13.3-01 | Unimplemented |
| R-B13.3-02 | B 13.3 | Define visual-only versus rig-affecting properties (body and heightScale affect rig; isRigAffecting) | P0 | M-22 | Phase 10 | AT-R-B13.3-02 | Unimplemented |
| R-B13.4-01 | B 13.4 | Character configuration is saved in the project or settings and restored on reopen | P0 | M-22, M-16 | Phase 10 | AT-R-B13.4-01 | Unimplemented |
| R-B13.4-02 | B 13.4 | Multiplayer syncs the appearance needed for remote players, at most 4 KB (Character.forNet) | P1 | M-22, M-24 | Phase 13 | AT-R-B13.4-02 | Unimplemented |

#### 15.1.14 B 14 Dance system

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B14.1-01 | B 14.1 | DanceChart defines the song identifier and reference timeline (songId; the Song TempoMap) | P1 | M-23 | Phase 11 | AT-R-B14.1-01 | Unimplemented |
| R-B14.1-02 | B 14.1 | DanceChart defines step positions and directions (0 left, 1 down, 2 up, 3 right) | P1 | M-23 | Phase 11 | AT-R-B14.1-02 | Unimplemented |
| R-B14.1-03 | B 14.1 | DanceChart defines step times in musical ticks | P1 | M-23 | Phase 11 | AT-R-B14.1-03 | Unimplemented |
| R-B14.1-04 | B 14.1 | DanceChart defines hold duration where relevant (isHold, durTicks >= 1920) | P1 | M-23 | Phase 11 | AT-R-B14.1-04 | Unimplemented |
| R-B14.1-05 | B 14.1 | DanceChart defines difficulty: easy, normal, hard | P1 | M-23 | Phase 11 | AT-R-B14.1-05 | Unimplemented |
| R-B14.1-06 | B 14.1 | DanceChart carries optional metadata (generatorVersion, layout) | P1 | M-23 | Phase 11 | AT-R-B14.1-06 | Unimplemented |
| R-B14.2-01 | B 14.2 | Dance gameplay plays four-button step sequences | P1 | M-23 | Phase 11 | AT-R-B14.2-01 | Unimplemented |
| R-B14.2-02 | B 14.2 | Dance gameplay has simultaneous steps (max directions: easy 1, normal 2, hard 2) | P1 | M-23 | Phase 11 | AT-R-B14.2-02 | Unimplemented |
| R-B14.2-03 | B 14.2 | Dance gameplay has holds | P1 | M-23 | Phase 11 | AT-R-B14.2-03 | Unimplemented |
| R-B14.2-04 | B 14.2 | Dance gameplay has timing judgments reusing the Rhythm windows (WINDOW_MAP) | P1 | M-23, M-09 | Phase 11 | AT-R-B14.2-04 | Unimplemented |
| R-B14.2-05 | B 14.2 | Dance gameplay keeps combos | P1 | M-23 | Phase 11 | AT-R-B14.2-05 | Unimplemented |
| R-B14.2-06 | B 14.2 | Dance gameplay keeps score | P1 | M-23 | Phase 11 | AT-R-B14.2-06 | Unimplemented |
| R-B14.2-07 | B 14.2 | Dance gameplay shows song progress | P1 | M-23, M-26 | Phase 11 | AT-R-B14.2-07 | Unimplemented |
| R-B14.2-08 | B 14.2 | Failure or completion rules configurable per mode (FAILURE_RULES; gameplay.lifeBar) | P1 | M-23 | Phase 11 | AT-R-B14.2-08 | Unimplemented |
| R-B14.3-01 | B 14.3 | The avatar performs moves synchronized to the dance chart (ChoreographyController) | P1 | M-23, M-20 | Phase 11 | AT-R-B14.3-01 | Unimplemented |
| R-B14.3-02 | B 14.3 | Choreography is generated or preset, each move tied explicitly to a chart step tick | P1 | M-23 | Phase 11 | AT-R-B14.3-02 | Unimplemented |
| R-B14.4-01 | B 14.4 | Dance input goes through the same FLM.Input system as instrument input | P1 | M-07, M-23 | Phase 11 | AT-R-B14.4-01 | Unimplemented |
| R-B14.4-02 | B 14.4 | Dance mapping and scoring are independent of instrument mapping and scoring (DanceJudge) | P1 | M-23 | Phase 11 | AT-R-B14.4-02 | Unimplemented |

#### 15.1.15 B 15 File import and export

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B15.1-01 | B 15.1 | Every supported format is converted into the common internal model (Song) | P0 | M-14, M-03 | Phase 07 | AT-R-B15.1-01 | Unimplemented |
| R-B15.1-02 | B 15.1 | Pipeline step 1: validate the input (size <= 25 MB, audio <= 100 MB, non-empty, readable) | P0 | M-14 | Phase 07 | AT-R-B15.1-02 | Unimplemented |
| R-B15.1-03 | B 15.1 | Pipeline step 2: identify the format by signature bytes, not by extension alone | P0 | M-14 | Phase 07 | AT-R-B15.1-03 | Unimplemented |
| R-B15.1-04 | B 15.1 | Pipeline step 3: parse the source with the registered adapter | P0 | M-14 | Phase 07 | AT-R-B15.1-04 | Unimplemented |
| R-B15.1-05 | B 15.1 | Pipeline step 4: normalize tracks and events (PPQ 960, sorted, paired notes) | P0 | M-14, M-03 | Phase 07 | AT-R-B15.1-05 | Unimplemented |
| R-B15.1-06 | B 15.1 | Pipeline step 5: preserve supported metadata (title, artist, track names, copyright, markers) | P0 | M-14 | Phase 07 | AT-R-B15.1-06 | Unimplemented |
| R-B15.1-07 | B 15.1 | Pipeline step 6: report unsupported features as ImportWarning entries | P0 | M-14 | Phase 07 | AT-R-B15.1-07 | Unimplemented |
| R-B15.1-08 | B 15.1 | Pipeline step 7: present imported tracks for inspection (InspectionReport on SCR-ImportInspect) | P0 | M-14, M-27 | Phase 07 | AT-R-B15.1-08 | Unimplemented |
| R-B15.1-09 | B 15.1 | Pipeline step 8: make the song available to playback, visualization and gameplay (Catalog) | P0 | M-14, M-15 | Phase 07 | AT-R-B15.1-09 | Unimplemented |
| R-B15.2-01 | B 15.2 | Read Standard MIDI Files (.mid, .midi) | P0 | M-10 | Phase 07 | AT-R-B15.2-01 | Unimplemented |
| R-B15.2-02 | B 15.2 | MIDI parser handles format 0 | P0 | M-10 | Phase 07 | AT-R-B15.2-02 | Unimplemented |
| R-B15.2-03 | B 15.2 | MIDI parser handles format 1 | P0 | M-10 | Phase 07 | AT-R-B15.2-03 | Unimplemented |
| R-B15.2-04 | B 15.2 | MIDI parser handles format 2: one Song per sequence and a chooser (W-MIDI-FORMAT2) | P1 | M-10, M-14 | Phase 07 | AT-R-B15.2-04 | Unimplemented |
| R-B15.2-05 | B 15.2 | MIDI parser handles track events (MTrk chunks; unknown chunks skipped with a warning) | P0 | M-10 | Phase 07 | AT-R-B15.2-05 | Unimplemented |
| R-B15.2-06 | B 15.2 | MIDI parser handles delta times | P0 | M-10 | Phase 07 | AT-R-B15.2-06 | Unimplemented |
| R-B15.2-07 | B 15.2 | MIDI parser handles tempo maps (FF 51) | P0 | M-10 | Phase 07 | AT-R-B15.2-07 | Unimplemented |
| R-B15.2-08 | B 15.2 | MIDI parser handles time signatures (FF 58) | P0 | M-10 | Phase 07 | AT-R-B15.2-08 | Unimplemented |
| R-B15.2-09 | B 15.2 | MIDI parser handles key signatures (FF 59) | P0 | M-10 | Phase 07 | AT-R-B15.2-09 | Unimplemented |
| R-B15.2-10 | B 15.2 | MIDI parser handles program changes | P0 | M-10 | Phase 07 | AT-R-B15.2-10 | Unimplemented |
| R-B15.2-11 | B 15.2 | MIDI parser handles note-on and note-off, note-on velocity 0 as note-off | P0 | M-10 | Phase 07 | AT-R-B15.2-11 | Unimplemented |
| R-B15.2-12 | B 15.2 | MIDI parser keeps note-on velocity and release velocity | P0 | M-10 | Phase 07 | AT-R-B15.2-12 | Unimplemented |
| R-B15.2-13 | B 15.2 | MIDI parser handles controllers | P0 | M-10 | Phase 07 | AT-R-B15.2-13 | Unimplemented |
| R-B15.2-14 | B 15.2 | MIDI parser handles pitch bend | P0 | M-10 | Phase 07 | AT-R-B15.2-14 | Unimplemented |
| R-B15.2-15 | B 15.2 | MIDI parser handles the sustain pedal (CC 64) | P0 | M-10 | Phase 07 | AT-R-B15.2-15 | Unimplemented |
| R-B15.2-16 | B 15.2 | MIDI parser keeps track names and metadata (FF 01, FF 02, FF 03, FF 05, FF 06) | P0 | M-10 | Phase 07 | AT-R-B15.2-16 | Unimplemented |
| R-B15.2-17 | B 15.2 | MIDI parser marks percussion channels (channel 10 tracks get isDrums true) | P0 | M-10 | Phase 07 | AT-R-B15.2-17 | Unimplemented |
| R-B15.2-18 | B 15.2 | MIDI parser keeps simultaneous and overlapping notes (pairing per channel and pitch) | P0 | M-10, M-03 | Phase 07 | AT-R-B15.2-18 | Unimplemented |
| R-B15.2-19 | B 15.2 | MIDI parser handles running status | P0 | M-10 | Phase 07 | AT-R-B15.2-19 | Unimplemented |
| R-B15.2-20 | B 15.2 | MIDI parser handles variable-length quantities (at most 4 bytes) | P0 | M-10 | Phase 07 | AT-R-B15.2-20 | Unimplemented |
| R-B15.2-21 | B 15.2 | MIDI parser handles end-of-track, chunk lengths, SMPTE division and other structure correctly | P0 | M-10 | Phase 07 | AT-R-B15.2-21 | Unimplemented |
| R-B15.2-22 | B 15.2 | Malformed or truncated MIDI never crashes: a coded error or a partial import with warnings | P0 | M-10, M-14 | Phase 07 | AT-R-B15.2-22 | Unimplemented |
| R-B15.3-01 | B 15.3 | MusicXML import keeps parts and instruments | P1 | M-12 | Phase 12 | AT-R-B15.3-01 | Unimplemented |
| R-B15.3-02 | B 15.3 | MusicXML import keeps measures | P1 | M-12 | Phase 12 | AT-R-B15.3-02 | Unimplemented |
| R-B15.3-03 | B 15.3 | MusicXML import keeps notes and rests | P1 | M-12 | Phase 12 | AT-R-B15.3-03 | Unimplemented |
| R-B15.3-04 | B 15.3 | MusicXML import keeps durations (divisions rescaled to PPQ 960) | P1 | M-12 | Phase 12 | AT-R-B15.3-04 | Unimplemented |
| R-B15.3-05 | B 15.3 | MusicXML import keeps chords | P1 | M-12 | Phase 12 | AT-R-B15.3-05 | Unimplemented |
| R-B15.3-06 | B 15.3 | MusicXML import keeps ties | P1 | M-12 | Phase 12 | AT-R-B15.3-06 | Unimplemented |
| R-B15.3-07 | B 15.3 | MusicXML import keeps time signatures | P1 | M-12 | Phase 12 | AT-R-B15.3-07 | Unimplemented |
| R-B15.3-08 | B 15.3 | MusicXML import keeps key signatures | P1 | M-12 | Phase 12 | AT-R-B15.3-08 | Unimplemented |
| R-B15.3-09 | B 15.3 | MusicXML import keeps tempo markings (sound tempo and metronome) | P1 | M-12 | Phase 12 | AT-R-B15.3-09 | Unimplemented |
| R-B15.3-10 | B 15.3 | MusicXML import keeps articulations and dynamics as velocity and duration | P1 | M-12 | Phase 12 | AT-R-B15.3-10 | Unimplemented |
| R-B15.3-11 | B 15.3 | MusicXML repeats and endings are expanded; da capo, dal segno, coda reported (W-XML-NAV-UNSUPPORTED) | P1 | M-12 | Phase 12 | AT-R-B15.3-11 | Unimplemented |
| R-B15.3-12 | B 15.3 | Define container support: .xml and .musicxml plain, .mxl ZIP (stored and deflate), both layouts | P1 | M-12, M-11 | Phase 12 | AT-R-B15.3-12 | Unimplemented |
| R-B15.3-13 | B 15.3 | Notation rendering and engraving are not provided and never implied; imports are events only | P1 | M-12, M-27 | Phase 12 | AT-R-B15.3-13 | Unimplemented |
| R-B15.4-01 | B 15.4 | Name the supported Guitar Pro versions and extensions: GP3, GP4, GP5 (.gp3 .gp4 .gp5) only | P1 | M-13, M-14 | Phase 12 | AT-R-B15.4-01 | Unimplemented |
| R-B15.4-02 | B 15.4 | Guitar Pro support is an own parser verified by FT tests on corpus files for each version | P1 | M-13 | Phase 12 | AT-R-B15.4-02 | Unimplemented |
| R-B15.4-03 | B 15.4 | Never claim universal Guitar Pro support: .gpx and .gp are identified and reported Unsupported | P1 | M-14, M-13 | Phase 12 | AT-R-B15.4-03 | Unimplemented |
| R-B15.4-04 | B 15.4 | Guitar Pro import keeps string and fret per note | P1 | M-13 | Phase 12 | AT-R-B15.4-04 | Unimplemented |
| R-B15.4-05 | B 15.4 | Guitar Pro import keeps tuning | P1 | M-13 | Phase 12 | AT-R-B15.4-05 | Unimplemented |
| R-B15.4-06 | B 15.4 | Guitar Pro import keeps capo | P1 | M-13 | Phase 12 | AT-R-B15.4-06 | Unimplemented |
| R-B15.4-07 | B 15.4 | Guitar Pro import keeps rhythmic duration (including tuplets and dotted values) | P1 | M-13 | Phase 12 | AT-R-B15.4-07 | Unimplemented |
| R-B15.4-08 | B 15.4 | Guitar Pro import keeps bends as PitchBendEvent points | P1 | M-13 | Phase 12 | AT-R-B15.4-08 | Unimplemented |
| R-B15.4-09 | B 15.4 | Guitar Pro import keeps slides as x.art slide flags (type per version encoding) | P1 | M-13 | Phase 12 | AT-R-B15.4-09 | Unimplemented |
| R-B15.4-10 | B 15.4 | Guitar Pro import keeps hammer-ons and pull-offs as x.art hammer flags | P1 | M-13 | Phase 12 | AT-R-B15.4-10 | Unimplemented |
| R-B15.4-11 | B 15.4 | Guitar Pro import keeps palm muting (as shortened duration and lower velocity) | P1 | M-13 | Phase 12 | AT-R-B15.4-11 | Unimplemented |
| R-B15.4-12 | B 15.4 | Guitar Pro import keeps harmonics (as pitch offsets) | P1 | M-13 | Phase 12 | AT-R-B15.4-12 | Unimplemented |
| R-B15.4-13 | B 15.4 | Guitar Pro import keeps track and instrument information (name, program, channel, strings) | P1 | M-13 | Phase 12 | AT-R-B15.4-13 | Unimplemented |
| R-B15.4-14 | B 15.4 | Unsupported Guitar Pro notation features are reported as warnings, never dropped silently | P1 | M-13, M-14 | Phase 12 | AT-R-B15.4-14 | Unimplemented |
| R-B15.5-01 | B 15.5 | Adapter registry (Import.adapters.register) allows future format adapters | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-B15.5-02 | B 15.5 | WAV adapter where the browser decodes it | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-B15.5-03 | B 15.5 | MP3 adapter where the browser decodes it | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-B15.5-04 | B 15.5 | OGG adapter where the browser decodes it | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-B15.5-05 | B 15.5 | FLAC adapter where the browser decodes it | P2 | M-14 | Phase 12 | n/a | Unimplemented |
| R-B15.5-06 | B 15.5 | Other sequencer or notation formats through verified adapters | P2 | M-14 | Phase 12 | n/a | Deferred |
| R-B15.5-07 | B 15.5 | Audio files become audio tracks only, never note events (no transcription in v1) | P0 | M-14 | Phase 12 | AT-R-B15.5-07 | Unimplemented |
| R-B15.5-08 | B 15.5 | Never claim audio files become playable note charts; SCR-ImportInspect says backing audio only | P0 | M-14, M-27 | Phase 12 | AT-R-B15.5-08 | Unimplemented |
| R-B15.6-01 | B 15.6 | Export MIDI performances as format 1 .mid | P0 | M-10, M-16 | Phase 09 | AT-R-B15.6-01 | Unimplemented |
| R-B15.6-02 | B 15.6 | Export project data as .flm.json (flm-project v1) | P0 | M-15, M-16 | Phase 09 | AT-R-B15.6-02 | Unimplemented |
| R-B15.6-03 | B 15.6 | Export audio mixes as WAV where the browser permits (OfflineAudioContext) | P1 | M-05, M-16 | Phase 09 | AT-R-B15.6-03 | Unimplemented |
| R-B15.6-04 | B 15.6 | Export dance charts as .flmdance.json | P1 | M-23, M-16 | Phase 11 | AT-R-B15.6-04 | Unimplemented |
| R-B15.6-05 | B 15.6 | Download character presets (.flmchar.json) and settings presets (.flmsettings.json) | P1 | M-22, M-16 | Phase 10 | AT-R-B15.6-05 | Unimplemented |
| R-B15.6-06 | B 15.6 | Every export format has a defined schema and a round-trip test where round trip applies | P0 | M-15, M-10 | Phase 09 | AT-R-B15.6-06 | Unimplemented |
| R-B15.7-01 | B 15.7 | Model holds song metadata (Song id, title, artist, createdAt, modifiedAt) | P0 | M-03 | Phase 02 | AT-R-B15.7-01 | Unimplemented |
| R-B15.7-02 | B 15.7 | Model holds tempo maps | P0 | M-03 | Phase 02 | AT-R-B15.7-02 | Unimplemented |
| R-B15.7-03 | B 15.7 | Model holds time-signature maps | P0 | M-03 | Phase 02 | AT-R-B15.7-03 | Unimplemented |
| R-B15.7-04 | B 15.7 | Model holds key-signature information (KeyMap) | P0 | M-03 | Phase 02 | AT-R-B15.7-04 | Unimplemented |
| R-B15.7-05 | B 15.7 | Model holds track collections | P0 | M-03 | Phase 02 | AT-R-B15.7-05 | Unimplemented |
| R-B15.7-06 | B 15.7 | Model holds instrument assignments (Track program, isDrums, ProgramEvent) | P0 | M-03 | Phase 02 | AT-R-B15.7-06 | Unimplemented |
| R-B15.7-07 | B 15.7 | Model holds ordered musical events (compareEvents total order) | P0 | M-03 | Phase 02 | AT-R-B15.7-07 | Unimplemented |
| R-B15.7-08 | B 15.7 | Model holds note-on and note-off as NoteEvent with durTicks and offVelocity | P0 | M-03 | Phase 02 | AT-R-B15.7-08 | Unimplemented |
| R-B15.7-09 | B 15.7 | Model holds controllers (ControlEvent, PitchBendEvent) | P0 | M-03 | Phase 02 | AT-R-B15.7-09 | Unimplemented |
| R-B15.7-10 | B 15.7 | Model holds track mute and solo state (Track.mix) | P0 | M-03 | Phase 02 | AT-R-B15.7-10 | Unimplemented |
| R-B15.7-11 | B 15.7 | Model holds track mixing properties (gain, pan) | P0 | M-03 | Phase 02 | AT-R-B15.7-11 | Unimplemented |
| R-B15.7-12 | B 15.7 | Model holds source-file metadata (Song.source format, fileName, version) | P0 | M-03 | Phase 02 | AT-R-B15.7-12 | Unimplemented |
| R-B15.7-13 | B 15.7 | Model holds import warnings (ImportWarning list) | P0 | M-03 | Phase 02 | AT-R-B15.7-13 | Unimplemented |
| R-B15.7-14 | B 15.7 | Model holds project editing state (Project.history, selection excluded) | P1 | M-15 | Phase 09 | AT-R-B15.7-14 | Unimplemented |
| R-B15.7-15 | B 15.7 | Model holds recording data (RecordingTake) | P0 | M-15, M-17 | Phase 06 | AT-R-B15.7-15 | Unimplemented |
| R-B15.7-16 | B 15.7 | Source events (Song) stay separate from gameplay mappings (Chart) and rendered audio | P0 | M-03, M-08, M-05 | Phase 08 | AT-R-B15.7-16 | Unimplemented |

#### 15.1.16 B 16 Recording and multitrack studio

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B16.1-01 | B 16.1 | Users create tracks (at most 32 per project) | P1 | M-17 | Phase 09 | AT-R-B16.1-01 | Unimplemented |
| R-B16.1-02 | B 16.1 | Users rename tracks | P1 | M-17 | Phase 09 | AT-R-B16.1-02 | Unimplemented |
| R-B16.1-03 | B 16.1 | Users duplicate tracks | P1 | M-17 | Phase 09 | AT-R-B16.1-03 | Unimplemented |
| R-B16.1-04 | B 16.1 | Users mute tracks | P1 | M-17, M-05 | Phase 09 | AT-R-B16.1-04 | Unimplemented |
| R-B16.1-05 | B 16.1 | Users solo tracks | P1 | M-17, M-05 | Phase 09 | AT-R-B16.1-05 | Unimplemented |
| R-B16.1-06 | B 16.1 | Users delete tracks (undoable) | P1 | M-17 | Phase 09 | AT-R-B16.1-06 | Unimplemented |
| R-B16.1-07 | B 16.1 | Every track has an instrument (program or drum kit) or an audio-source assignment | P0 | M-17, M-03 | Phase 09 | AT-R-B16.1-07 | Unimplemented |
| R-B16.2-01 | B 16.2 | Recording workflow step 1: select or create a track | P0 | M-17 | Phase 09 | AT-R-B16.2-01 | Unimplemented |
| R-B16.2-02 | B 16.2 | Recording workflow step 2: select an instrument | P0 | M-17 | Phase 09 | AT-R-B16.2-02 | Unimplemented |
| R-B16.2-03 | B 16.2 | Recording workflow step 3: set tempo and meter | P0 | M-17, M-04 | Phase 09 | AT-R-B16.2-03 | Unimplemented |
| R-B16.2-04 | B 16.2 | Recording workflow step 4: configure count-in (1 or 2 bars) and metronome | P0 | M-17, M-05 | Phase 09 | AT-R-B16.2-04 | Unimplemented |
| R-B16.2-05 | B 16.2 | Recording workflow step 5: start recording (Transport record after count-in) | P0 | M-17, M-04 | Phase 09 | AT-R-B16.2-05 | Unimplemented |
| R-B16.2-06 | B 16.2 | Recording workflow step 6: capture note events with timing from InputEvent.tAudio | P0 | M-17 | Phase 09 | AT-R-B16.2-06 | Unimplemented |
| R-B16.2-07 | B 16.2 | Recording workflow step 7: stop recording; held notes are closed at the stop tick | P0 | M-17 | Phase 09 | AT-R-B16.2-07 | Unimplemented |
| R-B16.2-08 | B 16.2 | Recording workflow step 8: review the take (play back, keep or discard) | P0 | M-17, M-27 | Phase 09 | AT-R-B16.2-08 | Unimplemented |
| R-B16.2-09 | B 16.2 | Recording workflow step 9: re-record (replace take) or overdub (merge into the track) | P1 | M-17 | Phase 09 | AT-R-B16.2-09 | Unimplemented |
| R-B16.2-10 | B 16.2 | Recording workflow step 10: save the project | P0 | M-17, M-16 | Phase 09 | AT-R-B16.2-10 | Unimplemented |
| R-B16.3-01 | B 16.3 | Record instruments one after another while hearing previously recorded tracks | P1 | M-17, M-05 | Phase 09 | AT-R-B16.3-01 | Unimplemented |
| R-B16.3-02 | B 16.3 | Playback of all tracks stays synchronized on the shared Transport during layering | P1 | M-04, M-05 | Phase 09 | AT-R-B16.3-02 | Unimplemented |
| R-B16.4-01 | B 16.4 | Editing moves events (undoable command) | P1 | M-17, M-15 | Phase 09 | AT-R-B16.4-01 | Unimplemented |
| R-B16.4-02 | B 16.4 | Editing adjusts event duration | P1 | M-17, M-15 | Phase 09 | AT-R-B16.4-02 | Unimplemented |
| R-B16.4-03 | B 16.4 | Editing deletes events | P1 | M-17, M-15 | Phase 09 | AT-R-B16.4-03 | Unimplemented |
| R-B16.4-04 | B 16.4 | Editing quantizes notes: grid 1/4 to 1/32 and triplets, strength 0-100 | P1 | M-17 | Phase 09 | AT-R-B16.4-04 | Unimplemented |
| R-B16.4-05 | B 16.4 | Editing copies and pastes event groups (clipboard <= 100,000 events) | P1 | M-17 | Phase 09 | AT-R-B16.4-05 | Unimplemented |
| R-B16.4-06 | B 16.4 | Editing sets loop regions | P1 | M-17, M-04 | Phase 09 | AT-R-B16.4-06 | Unimplemented |
| R-B16.4-07 | B 16.4 | Editing supports undo and redo (UndoStack depth 100) | P1 | M-15 | Phase 09 | AT-R-B16.4-07 | Unimplemented |
| R-B16.4-08 | B 16.4 | Editing granularity and limits fixed: tick precision, grid snap, 100,000 events per track | P1 | M-17 | Phase 09 | AT-R-B16.4-08 | Unimplemented |
| R-B16.5-01 | B 16.5 | Mixer sets per-track volume | P1 | M-05, M-17 | Phase 09 | AT-R-B16.5-01 | Unimplemented |
| R-B16.5-02 | B 16.5 | Mixer sets per-track pan | P1 | M-05, M-17 | Phase 09 | AT-R-B16.5-02 | Unimplemented |
| R-B16.5-03 | B 16.5 | Mixer mutes tracks | P1 | M-05, M-17 | Phase 09 | AT-R-B16.5-03 | Unimplemented |
| R-B16.5-04 | B 16.5 | Mixer solos tracks | P1 | M-05, M-17 | Phase 09 | AT-R-B16.5-04 | Unimplemented |
| R-B16.5-05 | B 16.5 | Mixer sets master volume | P0 | M-05 | Phase 04 | AT-R-B16.5-05 | Unimplemented |
| R-B16.5-06 | B 16.5 | Mixer shows peak and clipping indicators (Audio.peak per strip and master) | P1 | M-05, M-26 | Phase 09 | AT-R-B16.5-06 | Unimplemented |
| R-B16.5-07 | B 16.5 | Effects added incrementally: one global synthesized-IR reverb, off on Low and Abstract by default | P1 | M-05 | Phase 14 | AT-R-B16.5-07 | Unimplemented |
| R-B16.5-08 | B 16.5 | Further effects: delay, per-track compression, EQ and automation | P2 | M-05 | Phase 14 | n/a | Deferred |

#### 15.1.17 B 17 Multiplayer architecture

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B17.1-01 | B 17.1 | The single HTML file acts as the game client | P1 | M-24 | Phase 13 | AT-R-B17.1-01 | Unimplemented |
| R-B17.1-02 | B 17.1 | A network role provides joining, session state, sync messages and validation (host peer or relay) | P1 | M-24 | Phase 13 | AT-R-B17.1-02 | Unimplemented |
| R-B17.1-03 | B 17.1 | Document protocol v1, transport, relay hosting needs and operating cost (Part 3.7, README) | P1 | none | Phase 13 | AT-R-B17.1-03 | Unimplemented |
| R-B17.2-01 | B 17.2 | Sync model defines a shared session clock (Net.Clock.sharedNow) | P1 | M-24 | Phase 13 | AT-R-B17.2-01 | Unimplemented |
| R-B17.2-02 | B 17.2 | Sync model defines host authority over clock, start, pause and scores | P1 | M-24 | Phase 13 | AT-R-B17.2-02 | Unimplemented |
| R-B17.2-03 | B 17.2 | Sync model defines scheduled start times on the shared clock | P1 | M-24, M-04 | Phase 13 | AT-R-B17.2-03 | Unimplemented |
| R-B17.2-04 | B 17.2 | Sync model defines clock-offset estimation: 8 samples at start, then every 10 s | P1 | M-24 | Phase 13 | AT-R-B17.2-04 | Unimplemented |
| R-B17.2-05 | B 17.2 | Sync model defines input event timestamps in shared time | P1 | M-24, M-07 | Phase 13 | AT-R-B17.2-05 | Unimplemented |
| R-B17.2-06 | B 17.2 | Sync model defines latency measurement (round-trip time per peer) | P1 | M-24 | Phase 13 | AT-R-B17.2-06 | Unimplemented |
| R-B17.2-07 | B 17.2 | Sync model defines reconnection behavior | P1 | M-24 | Phase 13 | AT-R-B17.2-07 | Unimplemented |
| R-B17.2-08 | B 17.2 | Sync model defines pause and resume semantics (host-scheduled, all peers at one shared time) | P1 | M-24, M-04 | Phase 13 | AT-R-B17.2-08 | Unimplemented |
| R-B17.2-09 | B 17.2 | Sync model defines state reconciliation (host state at 10 Hz is authoritative) | P1 | M-24 | Phase 13 | AT-R-B17.2-09 | Unimplemented |
| R-B17.2-10 | B 17.2 | Musical events run on the shared timeline, never triggered by network message arrival | P1 | M-24, M-05 | Phase 13 | AT-R-B17.2-10 | Unimplemented |
| R-B17.3-01 | B 17.3 | Handle temporary disconnection | P1 | M-24 | Phase 13 | AT-R-B17.3-01 | Unimplemented |
| R-B17.3-02 | B 17.3 | Handle duplicate messages (drop by sender and seq) | P1 | M-24 | Phase 13 | AT-R-B17.3-02 | Unimplemented |
| R-B17.3-03 | B 17.3 | Handle out-of-order messages (stale seq ignored for state) | P1 | M-24 | Phase 13 | AT-R-B17.3-03 | Unimplemented |
| R-B17.3-04 | B 17.3 | Handle missing state updates (next 10 Hz state replaces the gap) | P1 | M-24 | Phase 13 | AT-R-B17.3-04 | Unimplemented |
| R-B17.3-05 | B 17.3 | Late-joining players during a song: the joiner waits in the lobby until the song ends | P2 | M-24 | Phase 13 | n/a | Deferred |
| R-B17.3-06 | B 17.3 | Handle host departure: guests see the session-ended notice and results | P1 | M-24, M-27 | Phase 13 | AT-R-B17.3-06 | Unimplemented |
| R-B17.3-07 | B 17.3 | Handle server (relay) errors: DLG-NetError and fallback to invite codes | P1 | M-24, M-27 | Phase 13 | AT-R-B17.3-07 | Unimplemented |
| R-B17.3-08 | B 17.3 | Handle session expiration (relay room idle expiry 10 min, then return to create-or-join) | P1 | M-24 | Phase 13 | AT-R-B17.3-08 | Unimplemented |
| R-B17.4-01 | B 17.4 | Validate every incoming message (validateMessage) and enforce <= 64 KB and 60 messages/s per peer | P0 | M-24 | Phase 13 | AT-R-B17.4-01 | Unimplemented |
| R-B17.4-02 | B 17.4 | Competitive scores and permissions are host-authoritative; client-claimed scores are not trusted | P1 | M-24, M-09 | Phase 13 | AT-R-B17.4-02 | Unimplemented |
| R-B17.4-03 | B 17.4 | Imported music files are never executed as code (data parsing only, no eval) | P0 | M-14 | Phase 07 | AT-R-B17.4-03 | Unimplemented |
| R-B17.5-01 | B 17.5 | Without multiplayer, all local gameplay and local project functions keep working | P0 | M-28, M-24 | Phase 13 | AT-R-B17.5-01 | Unimplemented |

#### 15.1.18 B 18 Data persistence and project format

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B18.1-01 | B 18.1 | Local project saving and restoration | P0 | M-16, M-15 | Phase 09 | AT-R-B18.1-01 | Unimplemented |
| R-B18.1-02 | B 18.1 | Evaluate storage options and file downloads: localStorage, IndexedDB flm-db, export (ADR-08) | P0 | none | Phase 00 | AT-R-B18.1-02 | Unimplemented |
| R-B18.1-03 | B 18.1 | Account for quotas, privacy modes and file:// versus http origin storage (fallback chain, notices) | P0 | M-16 | Phase 09 | AT-R-B18.1-03 | Unimplemented |
| R-B18.2-01 | B 18.2 | Saved project contains metadata (id, name, createdAt, modifiedAt, sizeBytes) | P0 | M-15 | Phase 09 | AT-R-B18.2-01 | Unimplemented |
| R-B18.2-02 | B 18.2 | Saved project contains tracks | P0 | M-15 | Phase 09 | AT-R-B18.2-02 | Unimplemented |
| R-B18.2-03 | B 18.2 | Saved project contains instrument assignments | P0 | M-15 | Phase 09 | AT-R-B18.2-03 | Unimplemented |
| R-B18.2-04 | B 18.2 | Saved project contains musical events | P0 | M-15 | Phase 09 | AT-R-B18.2-04 | Unimplemented |
| R-B18.2-05 | B 18.2 | Saved project contains tempo and time-signature maps | P0 | M-15 | Phase 09 | AT-R-B18.2-05 | Unimplemented |
| R-B18.2-06 | B 18.2 | Saved project contains key and scale configuration (settings.key, settings.scale) | P0 | M-15 | Phase 09 | AT-R-B18.2-06 | Unimplemented |
| R-B18.2-07 | B 18.2 | Saved project contains mixer settings | P0 | M-15 | Phase 09 | AT-R-B18.2-07 | Unimplemented |
| R-B18.2-08 | B 18.2 | Saved project contains recording metadata (RecordingTake) | P0 | M-15 | Phase 09 | AT-R-B18.2-08 | Unimplemented |
| R-B18.2-09 | B 18.2 | Saved project contains character configurations | P0 | M-15, M-22 | Phase 10 | AT-R-B18.2-09 | Unimplemented |
| R-B18.2-10 | B 18.2 | Saved project contains dance charts | P1 | M-15, M-23 | Phase 11 | AT-R-B18.2-10 | Unimplemented |
| R-B18.2-11 | B 18.2 | Saved project contains references to audio resources (IndexedDB recordings, never inline audio) | P1 | M-15, M-16 | Phase 12 | AT-R-B18.2-11 | Unimplemented |
| R-B18.2-12 | B 18.2 | Saved project contains version and migration information (format flm-project, version 1) | P0 | M-15 | Phase 09 | AT-R-B18.2-12 | Unimplemented |
| R-B18.3-01 | B 18.3 | The project format has a version identifier and a migration framework (migrate per version step) | P0 | M-15 | Phase 09 | AT-R-B18.3-01 | Unimplemented |
| R-B18.3-02 | B 18.3 | Unsupported project versions give a clear error and leave stored data untouched | P0 | M-15, M-27 | Phase 09 | AT-R-B18.3-02 | Unimplemented |
| R-B18.4-01 | B 18.4 | Large recordings and samples are stored only after size accounting (2 MB localStorage cap) | P0 | M-16 | Phase 09 | AT-R-B18.4-01 | Unimplemented |
| R-B18.4-02 | B 18.4 | A project too large to persist is reported (DLG-SaveFailed) with an export or download path | P0 | M-16, M-27 | Phase 09 | AT-R-B18.4-02 | Unimplemented |

#### 15.1.19 B 19 Technical architecture

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B19.1-01 | B 19.1 | Concerns are separated logically into modules even though one file is shipped | P0 | M-01 | Phase 01 | AT-R-B19.1-01 | Unimplemented |
| R-B19.1-02 | B 19.1 | Layer 1 application shell and navigation | P0 | M-26, M-27, M-29 | Phase 01 | AT-R-B19.1-02 | Unimplemented |
| R-B19.1-03 | B 19.1 | Layer 2 input abstraction | P0 | M-07 | Phase 03 | AT-R-B19.1-03 | Unimplemented |
| R-B19.1-04 | B 19.1 | Layer 3 musical data model | P0 | M-03 | Phase 02 | AT-R-B19.1-04 | Unimplemented |
| R-B19.1-05 | B 19.1 | Layer 4 music import and export | P0 | M-14, M-10 | Phase 07 | AT-R-B19.1-05 | Unimplemented |
| R-B19.1-06 | B 19.1 | Layer 5 musical timeline and transport | P0 | M-04 | Phase 02 | AT-R-B19.1-06 | Unimplemented |
| R-B19.1-07 | B 19.1 | Layer 6 audio engine | P0 | M-05, M-06 | Phase 04 | AT-R-B19.1-07 | Unimplemented |
| R-B19.1-08 | B 19.1 | Layer 7 rhythm gameplay | P0 | M-09 | Phase 03 | AT-R-B19.1-08 | Unimplemented |
| R-B19.1-09 | B 19.1 | Layer 8 free-play mapping | P0 | M-08 | Phase 03 | AT-R-B19.1-09 | Unimplemented |
| R-B19.1-10 | B 19.1 | Layer 9 recording and studio | P0 | M-17 | Phase 09 | AT-R-B19.1-10 | Unimplemented |
| R-B19.1-11 | B 19.1 | Layer 10 dance gameplay | P1 | M-23 | Phase 11 | AT-R-B19.1-11 | Unimplemented |
| R-B19.1-12 | B 19.1 | Layer 11 3D rendering | P0 | M-18, M-21 | Phase 05 | AT-R-B19.1-12 | Unimplemented |
| R-B19.1-13 | B 19.1 | Layer 12 avatar and instrument animation | P0 | M-19, M-20 | Phase 05 | AT-R-B19.1-13 | Unimplemented |
| R-B19.1-14 | B 19.1 | Layer 13 character customization | P0 | M-22 | Phase 10 | AT-R-B19.1-14 | Unimplemented |
| R-B19.1-15 | B 19.1 | Layer 14 project persistence | P0 | M-15, M-16 | Phase 09 | AT-R-B19.1-15 | Unimplemented |
| R-B19.1-16 | B 19.1 | Layer 15 multiplayer client | P1 | M-24 | Phase 13 | AT-R-B19.1-16 | Unimplemented |
| R-B19.1-17 | B 19.1 | Layer 16 settings and diagnostics | P0 | M-27, M-01 | Phase 01 | AT-R-B19.1-17 | Unimplemented |
| R-B19.1-18 | B 19.1 | Layer 17 error handling and recovery (ErrorReporter, coded errors) | P0 | M-01, M-28 | Phase 01 | AT-R-B19.1-18 | Unimplemented |
| R-B19.1-19 | B 19.1 | Layer 18 automated tests and validation (window.FLM.selfTest, tools/selftest.mjs) | P0 | M-31 | Phase 01 | AT-R-B19.1-19 | Unimplemented |
| R-B19.2-01 | B 19.2 | Stable interfaces between subsystems: one FLM namespace per module, lower-numbered dependencies only | P0 | M-01 | Phase 01 | AT-R-B19.2-01 | Unimplemented |
| R-B19.2-02 | B 19.2 | Boundary: the input system emits normalized events (EVT-input.event) | P0 | M-07 | Phase 03 | AT-R-B19.2-02 | Unimplemented |
| R-B19.2-03 | B 19.2 | Boundary: the mapping system turns applicable inputs into musical actions | P0 | M-08 | Phase 03 | AT-R-B19.2-03 | Unimplemented |
| R-B19.2-04 | B 19.2 | Boundary: the musical data model stores and orders events | P0 | M-03 | Phase 02 | AT-R-B19.2-04 | Unimplemented |
| R-B19.2-05 | B 19.2 | Boundary: the transport owns the authoritative musical position | P0 | M-04 | Phase 02 | AT-R-B19.2-05 | Unimplemented |
| R-B19.2-06 | B 19.2 | Boundary: the audio engine schedules playback | P0 | M-05 | Phase 04 | AT-R-B19.2-06 | Unimplemented |
| R-B19.2-07 | B 19.2 | Boundary: the rhythm engine evaluates player input | P0 | M-09 | Phase 03 | AT-R-B19.2-07 | Unimplemented |
| R-B19.2-08 | B 19.2 | Boundary: the renderer reads musical state and never controls audio timing | P0 | M-18, M-21 | Phase 05 | AT-R-B19.2-08 | Unimplemented |
| R-B19.2-09 | B 19.2 | Boundary: the animation system converts instrument events into skeletal motion | P0 | M-20 | Phase 05 | AT-R-B19.2-09 | Unimplemented |
| R-B19.2-10 | B 19.2 | Boundary: the persistence system serializes supported project state | P0 | M-15, M-16 | Phase 09 | AT-R-B19.2-10 | Unimplemented |
| R-B19.3-01 | B 19.3 | Compare native Web Audio with additional audio engines; record the choice (ADR-04) | P1 | none | Phase 00 | AT-R-B19.3-01 | Unimplemented |
| R-B19.3-02 | B 19.3 | Compare native WebGL with a compact 3D library; record the choice (ADR-02, ADR-03) | P1 | none | Phase 00 | AT-R-B19.3-02 | Unimplemented |
| R-B19.3-03 | B 19.3 | Compare custom parsers with verified MIDI, MusicXML and Guitar Pro parsers (ADR-06) | P1 | none | Phase 00 | AT-R-B19.3-03 | Unimplemented |
| R-B19.3-04 | B 19.3 | Compare embedded with remotely loaded resources (ADR-01, ADR-02) | P1 | none | Phase 00 | AT-R-B19.3-04 | Unimplemented |
| R-B19.3-05 | B 19.3 | Compare native browser APIs with optional compatibility layers (none adopted) | P1 | none | Phase 00 | AT-R-B19.3-05 | Unimplemented |
| R-B19.3-06 | B 19.3 | Criteria: compatibility, mobile performance, size, license, maintenance, security, offline, single file | P1 | none | Phase 00 | AT-R-B19.3-06 | Unimplemented |
| R-B19.4-01 | B 19.4 | Source is organized as clearly separated sections (src/NN-name.js concatenated in name order) | P1 | M-29 | Phase 01 | AT-R-B19.4-01 | Unimplemented |
| R-B19.4-02 | B 19.4 | Clear names, stable interfaces and an explicit initialization order (Boot init sequence) | P1 | M-29 | Phase 01 | AT-R-B19.4-02 | Unimplemented |
| R-B19.4-03 | B 19.4 | No minification: the shipped source stays readable (ADR-09) | P1 | M-29 | Phase 01 | AT-R-B19.4-03 | Unimplemented |
| R-B19.5-01 | B 19.5 | Any dependency records purpose, license, version, loading, failure handling and justification | P0 | none | Phase 00 | AT-R-B19.5-01 | Unimplemented |
| R-B19.5-02 | B 19.5 | No dependency for convenience when a small native implementation suffices (v1 has none) | P0 | none | Phase 00 | AT-R-B19.5-02 | Unimplemented |
| R-B19.5-03 | B 19.5 | Own parsers and renderer chosen on evidence, not to avoid dependencies (ADR-02, ADR-06 reasons) | P1 | none | Phase 00 | AT-R-B19.5-03 | Unimplemented |

#### 15.1.20 B 20 Performance and resource management

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B20.1-01 | B 20.1 | Budget initial load to main menu: <= 1.5 s desktop, <= 3.0 s mid-range mobile | P0 | M-29, M-01 | Phase 14 | AT-R-B20.1-01 | Unimplemented |
| R-B20.1-02 | B 20.1 | Budget HTML size: target <= 1.5 MB; tools/build.mjs warns above 1.5 MB and fails above 2.5 MB | P0 | M-29 | Phase 01 | AT-R-B20.1-02 | Unimplemented |
| R-B20.1-03 | B 20.1 | Budget time to first playable interaction: <= 5 s desktop, <= 8 s mobile from file open | P0 | M-28, M-29 | Phase 14 | AT-R-B20.1-03 | Unimplemented |
| R-B20.1-04 | B 20.1 | Budget frame rate: High 60 FPS; Balanced 60 target, 45 floor; Low 30 | P1 | M-18 | Phase 14 | AT-R-B20.1-04 | Unimplemented |
| R-B20.1-05 | B 20.1 | Budget scheduling precision: start within 1 ms of intended time; drift < 2 ms after 10 min loop | P0 | M-05 | Phase 04 | AT-R-B20.1-05 | Unimplemented |
| R-B20.1-06 | B 20.1 | Budget input latency: event.timeStamp mapped to audio time; added processing <= 1 frame | P0 | M-07 | Phase 03 | AT-R-B20.1-06 | Unimplemented |
| R-B20.1-07 | B 20.1 | Budget memory: <= 300 MB desktop, <= 150 MB mobile steady state | P0 | M-28, M-01 | Phase 14 | AT-R-B20.1-07 | Unimplemented |
| R-B20.1-08 | B 20.1 | Budget maximum active notes: 64 voices desktop, 32 mobile | P0 | M-05 | Phase 04 | AT-R-B20.1-08 | Unimplemented |
| R-B20.1-09 | B 20.1 | Budget maximum tracks: 32 per project (import up to 128 tracks for inspection) | P1 | M-17, M-15 | Phase 09 | AT-R-B20.1-09 | Unimplemented |
| R-B20.1-10 | B 20.1 | Budget multiplayer update rate: state 10 Hz, inputs immediate, 60 messages/s per peer cap | P1 | M-24 | Phase 13 | AT-R-B20.1-10 | Unimplemented |
| R-B20.1-11 | B 20.1 | Budget project serialization: <= 200 ms for 100,000 events | P0 | M-15 | Phase 09 | AT-R-B20.1-11 | Unimplemented |
| R-B20.1-12 | B 20.1 | Measure every budget on representative desktop and mobile devices and record it (tools/perf.mjs, XT) | P0 | M-31 | Phase 15 | AT-R-B20.1-12 | Unimplemented |
| R-B20.2-01 | B 20.2 | Smooth 60 FPS on capable devices, lower adaptive targets on constrained mobile hardware | P1 | M-18 | Phase 14 | AT-R-B20.2-01 | Unimplemented |
| R-B20.2-02 | B 20.2 | Responsiveness and stable audio come before holding a fixed frame rate (tier drops, never audio) | P0 | M-18, M-05 | Phase 14 | AT-R-B20.2-02 | Unimplemented |
| R-B20.3-01 | B 20.3 | Release audio voices on stop, panic and mode leave | P0 | M-05, M-28 | Phase 04 | AT-R-B20.3-01 | Unimplemented |
| R-B20.3-02 | B 20.3 | Release decoded audio buffers when no longer needed (Import.releaseAudio) | P0 | M-14 | Phase 12 | AT-R-B20.3-02 | Unimplemented |
| R-B20.3-03 | B 20.3 | Release GPU resources (buffers, textures, programs) on leave and context loss | P0 | M-18 | Phase 05 | AT-R-B20.3-03 | Unimplemented |
| R-B20.3-04 | B 20.3 | Release event listeners through Core.dom wrappers counted by Modes.assertClean | P0 | M-01, M-28 | Phase 01 | AT-R-B20.3-04 | Unimplemented |
| R-B20.3-05 | B 20.3 | Release animation state (Animation.Mixer.dispose) | P0 | M-20 | Phase 05 | AT-R-B20.3-05 | Unimplemented |
| R-B20.3-06 | B 20.3 | Release network connections (RTCPeerConnection, DataChannel, relay socket) | P1 | M-24 | Phase 13 | AT-R-B20.3-06 | Unimplemented |
| R-B20.3-07 | B 20.3 | Release temporary recording buffers after a take is kept or discarded | P0 | M-17 | Phase 06 | AT-R-B20.3-07 | Unimplemented |
| R-B20.3-08 | B 20.3 | Release imported-file buffers after parsing | P0 | M-14 | Phase 07 | AT-R-B20.3-08 | Unimplemented |
| R-B20.3-09 | B 20.3 | Repeated enter and leave of gameplay causes no unbounded growth (<= 10 MB after 20 cycles) | P0 | M-28 | Phase 14 | AT-R-B20.3-09 | Unimplemented |
| R-B20.4-01 | B 20.4 | Large resources load progressively (chunked parsing and chart generation with progress events) | P1 | M-29, M-14 | Phase 01 | AT-R-B20.4-01 | Unimplemented |
| R-B20.4-02 | B 20.4 | Critical startup resources are separated from optional presets and generated content (lazy build) | P1 | M-29 | Phase 01 | AT-R-B20.4-02 | Unimplemented |
| R-B20.4-03 | B 20.4 | Loading screens show measured progress only; unmeasurable steps show a named step, no fake percent | P0 | M-26, M-29 | Phase 01 | AT-R-B20.4-03 | Unimplemented |

#### 15.1.21 B 21 Mobile-specific requirements

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B21.1-01 | B 21.1 | Touch controls give reliable press and release (pointer capture, pointercancel handled) | P0 | M-07, M-26 | Phase 03 | AT-R-B21.1-01 | Unimplemented |
| R-B21.1-02 | B 21.1 | Touch controls support simultaneous input where possible | P0 | M-07, M-26 | Phase 03 | AT-R-B21.1-02 | Unimplemented |
| R-B21.1-03 | B 21.1 | Touch controls prevent accidental browser gestures (touch-action none, preventDefault on gameplay) | P0 | M-26 | Phase 03 | AT-R-B21.1-03 | Unimplemented |
| R-B21.1-04 | B 21.1 | Touch controls show visible pressed states | P0 | M-26 | Phase 03 | AT-R-B21.1-04 | Unimplemented |
| R-B21.1-05 | B 21.1 | Touch controls recover from interrupted touch sequences (system release of stuck pointers) | P0 | M-07 | Phase 03 | AT-R-B21.1-05 | Unimplemented |
| R-B21.1-06 | B 21.1 | Touch controls handle orientation changes (pads re-laid out, held pointers released) | P0 | M-26, M-07 | Phase 03 | AT-R-B21.1-06 | Unimplemented |
| R-B21.1-07 | B 21.1 | Touch controls never rely on hover | P0 | M-26 | Phase 03 | AT-R-B21.1-07 | Unimplemented |
| R-B21.2-01 | B 21.2 | Accommodate browser autoplay restrictions (DLG-AudioBlocked when the context stays suspended) | P0 | M-05 | Phase 04 | AT-R-B21.2-01 | Unimplemented |
| R-B21.2-02 | B 21.2 | The first AudioContext resume happens inside a user gesture handler | P0 | M-05, M-29 | Phase 04 | AT-R-B21.2-02 | Unimplemented |
| R-B21.3-01 | B 21.3 | Mobile adapts rendering resolution | P1 | M-18 | Phase 14 | AT-R-B21.3-01 | Unimplemented |
| R-B21.3-02 | B 21.3 | Mobile adapts shadow quality (blob shadows reduced or off) | P1 | M-18, M-21 | Phase 14 | AT-R-B21.3-02 | Unimplemented |
| R-B21.3-03 | B 21.3 | Mobile adapts lighting complexity (point lights per tier) | P1 | M-18 | Phase 14 | AT-R-B21.3-03 | Unimplemented |
| R-B21.3-04 | B 21.3 | Mobile adapts particle count | P1 | M-21 | Phase 14 | AT-R-B21.3-04 | Unimplemented |
| R-B21.3-05 | B 21.3 | Mobile adapts animation complexity | P1 | M-20 | Phase 14 | AT-R-B21.3-05 | Unimplemented |
| R-B21.3-06 | B 21.3 | Mobile adapts audio polyphony (32 voices) | P1 | M-05 | Phase 14 | AT-R-B21.3-06 | Unimplemented |
| R-B21.3-07 | B 21.3 | No quality reduction ever changes the musical timeline (tier change keeps Transport position) | P0 | M-04, M-18 | Phase 14 | AT-R-B21.3-07 | Unimplemented |
| R-B21.4-01 | B 21.4 | Defined behavior for incoming calls or app switching: gameplay pauses | P0 | M-28 | Phase 14 | AT-R-B21.4-01 | Unimplemented |
| R-B21.4-02 | B 21.4 | Defined behavior for screen locking: gameplay pauses, recording stops and keeps the take | P0 | M-28 | Phase 14 | AT-R-B21.4-02 | Unimplemented |
| R-B21.4-03 | B 21.4 | Defined behavior for browser backgrounding (visibilitychange hidden): pause and release inputs | P0 | M-28 | Phase 14 | AT-R-B21.4-03 | Unimplemented |
| R-B21.4-04 | B 21.4 | Defined behavior for audio context suspension: pause and offer resume by gesture (DLG-ResumeAudio) | P0 | M-28, M-05 | Phase 14 | AT-R-B21.4-04 | Unimplemented |
| R-B21.4-05 | B 21.4 | Defined behavior for orientation changes: relayout without moving the timeline | P0 | M-28, M-26 | Phase 14 | AT-R-B21.4-05 | Unimplemented |
| R-B21.4-06 | B 21.4 | Defined behavior for memory pressure or context loss: drop tier, release caches, keep work | P1 | M-28, M-18 | Phase 14 | AT-R-B21.4-06 | Unimplemented |
| R-B21.4-07 | B 21.4 | When uninterrupted timing cannot be guaranteed the game pauses or recovers safely | P0 | M-28 | Phase 14 | AT-R-B21.4-07 | Unimplemented |

#### 15.1.22 B 22 Accessibility and usability

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B22-01 | B 22 | Remappable controls for every action | P0 | M-07, M-27 | Phase 03 | AT-R-B22-01 | Unimplemented |
| R-B22-02 | B 22 | Adjustable note speed (visual lead 600-3,000 ms) and difficulty | P0 | M-21, M-08 | Phase 08 | AT-R-B22-02 | Unimplemented |
| R-B22-03 | B 22 | Configurable timing windows: judgment preset standard, relaxed, strict | P1 | M-09 | Phase 08 | AT-R-B22-03 | Unimplemented |
| R-B22-04 | B 22 | High-contrast gameplay indicators (video.highContrast) | P1 | M-21, M-26 | Phase 08 | AT-R-B22-04 | Unimplemented |
| R-B22-05 | B 22 | Visual feedback for audio events (beat indicator, hit flashes) | P1 | M-26, M-21 | Phase 08 | AT-R-B22-05 | Unimplemented |
| R-B22-06 | B 22 | Optional reduced motion (video.reducedMotion system, on, off) | P1 | M-26, M-20 | Phase 05 | AT-R-B22-06 | Unimplemented |
| R-B22-07 | B 22 | Scalable UI (video.uiScale 0.8-1.5) | P1 | M-26 | Phase 01 | AT-R-B22-07 | Unimplemented |
| R-B22-08 | B 22 | Keyboard navigation for all menus and dialogs (focus order, Enter, Escape, arrows) | P0 | M-26 | Phase 01 | AT-R-B22-08 | Unimplemented |
| R-B22-09 | B 22 | Accessible labels on every control (aria-label or visible label) | P1 | M-26 | Phase 01 | AT-R-B22-09 | Unimplemented |
| R-B22-10 | B 22 | Success and failure never shown by color alone (judgment text, glyphs, shapes) | P0 | M-21, M-26 | Phase 08 | AT-R-B22-10 | Unimplemented |
| R-B22-11 | B 22 | Adjustable visual effects (video.effectsLevel off, reduced, full) | P1 | M-21 | Phase 05 | AT-R-B22-11 | Unimplemented |
| R-B22-12 | B 22 | Clear error messages naming the problem and the next action | P0 | M-27, M-01 | Phase 01 | AT-R-B22-12 | Unimplemented |
| R-B22-13 | B 22 | Lanes and dance directions identifiable without color (lane glyphs, arrow shapes) | P0 | M-21, M-23 | Phase 08 | AT-R-B22-13 | Unimplemented |

#### 15.1.23 B 23 Security, privacy, and licensing

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B23.1-01 | B 23.1 | Imported files are treated as untrusted input | P0 | M-14 | Phase 07 | AT-R-B23.1-01 | Unimplemented |
| R-B23.1-02 | B 23.1 | Parsers validate lengths, offsets, event counts and structure before use | P0 | M-10, M-11, M-12, M-13 | Phase 07 | AT-R-B23.1-02 | Unimplemented |
| R-B23.1-03 | B 23.1 | Defend against huge or hostile files: 25 MB, 1,000,000 events, 128 tracks, 5 s parse budget | P0 | M-14 | Phase 07 | AT-R-B23.1-03 | Unimplemented |
| R-B23.1-04 | B 23.1 | Imported HTML, XML, metadata and text are never executed; inserted only via textContent | P0 | M-14, M-26 | Phase 07 | AT-R-B23.1-04 | Unimplemented |
| R-B23.2-01 | B 23.2 | Standalone mode needs no telemetry or account creation (none exist) | P0 | M-29 | Phase 01 | AT-R-B23.2-01 | Unimplemented |
| R-B23.2-02 | B 23.2 | Multiplayer states what is transmitted: name, room state, inputs, scores, avatar (PRIVACY_TEXT) | P1 | M-24, M-27 | Phase 13 | AT-R-B23.2-02 | Unimplemented |
| R-B23.3-01 | B 23.3 | Verify licenses of all included code, fonts, sounds and models (v1: all original; inventory) | P0 | none | Phase 16 | AT-R-B23.3-01 | Unimplemented |
| R-B23.3-02 | B 23.3 | No copyrighted sound banks, commercial models or third-party content are bundled | P0 | M-30, M-06 | Phase 16 | AT-R-B23.3-02 | Unimplemented |
| R-B23.4-01 | B 23.4 | No private server credentials or secret API keys in the HTML (build check for key patterns) | P0 | M-24, M-29 | Phase 13 | AT-R-B23.4-01 | Unimplemented |
| R-B23.4-02 | B 23.4 | Multiplayer security model fits a public client: no secrets, host validation, relay forwards only | P1 | M-24 | Phase 13 | AT-R-B23.4-02 | Unimplemented |

#### 15.1.24 B 24 Error handling and diagnostics

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B24-01 | B 24 | Actionable error for unsupported browser capabilities (names the capability and what still works) | P0 | M-29, M-27 | Phase 01 | AT-R-B24-01 | Unimplemented |
| R-B24-02 | B 24 | Actionable error for audio initialization failure | P0 | M-05, M-27 | Phase 04 | AT-R-B24-02 | Unimplemented |
| R-B24-03 | B 24 | Actionable error for failed sound-bank loading (applies only once SoundFont loading exists) | P2 | M-06, M-27 | Phase 04 | n/a | Deferred |
| R-B24-04 | B 24 | Actionable error for invalid imported files (coded E-IMP-* messages) | P0 | M-14, M-27 | Phase 07 | AT-R-B24-04 | Unimplemented |
| R-B24-05 | B 24 | Actionable error for unsupported file versions (GP6/GP7, project versions above 1) | P0 | M-14, M-15 | Phase 07 | AT-R-B24-05 | Unimplemented |
| R-B24-06 | B 24 | Actionable error for missing assets (a missing built-in demo or preset is reported and skipped) | P1 | M-29, M-27 | Phase 01 | AT-R-B24-06 | Unimplemented |
| R-B24-07 | B 24 | Actionable error for storage quota errors (DLG-SaveFailed offering Export) | P0 | M-16, M-27 | Phase 09 | AT-R-B24-07 | Unimplemented |
| R-B24-08 | B 24 | Actionable error for corrupted projects (load refused, .bak or checkpoint offered) | P0 | M-15, M-27 | Phase 09 | AT-R-B24-08 | Unimplemented |
| R-B24-09 | B 24 | Actionable error for multiplayer connection failure (DLG-NetError with Retry) | P1 | M-24, M-27 | Phase 13 | AT-R-B24-09 | Unimplemented |
| R-B24-10 | B 24 | Actionable error for rendering initialization failure (falls back to the Abstract tier) | P0 | M-18, M-27 | Phase 05 | AT-R-B24-10 | Unimplemented |
| R-B24-11 | B 24 | Actionable notice for insufficient performance (tier lowered, how to change it) | P1 | M-18, M-27 | Phase 14 | AT-R-B24-11 | Unimplemented |
| R-B24-12 | B 24 | Actionable error for unsupported export functionality (WAV or download unavailable, alternative named) | P1 | M-16, M-27 | Phase 09 | AT-R-B24-12 | Unimplemented |
| R-B24-13 | B 24 | User work is preserved whenever possible (autosave checkpoints, .bak, export offered) | P0 | M-16, M-15 | Phase 09 | AT-R-B24-13 | Unimplemented |
| R-B24-14 | B 24 | Diagnostics separate recoverable errors from those needing a return to menu or a reload | P0 | M-01, M-27 | Phase 01 | AT-R-B24-14 | Unimplemented |
| R-B24-15 | B 24 | Diagnostics mode (SCR-Diagnostics) shows timing, rendering, audio and network metrics | P1 | M-01, M-27 | Phase 01 | AT-R-B24-15 | Unimplemented |

#### 15.1.25 B 25 Testing strategy

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B25.1-01 | B 25.1 | Unit tests: musical time conversion (ticks, bars, beats) | P0 | M-31, M-03 | Phase 02 | AT-R-B25.1-01 | Unimplemented |
| R-B25.1-02 | B 25.1 | Unit tests: tempo-map conversion (ticksToSeconds and secondsToTicks round trip) | P0 | M-31, M-03 | Phase 02 | AT-R-B25.1-02 | Unimplemented |
| R-B25.1-03 | B 25.1 | Unit tests: note scheduling (Scheduler on an OfflineAudioContext or fake clock) | P0 | M-31, M-05 | Phase 04 | AT-R-B25.1-03 | Unimplemented |
| R-B25.1-04 | B 25.1 | Unit tests: input normalization (all sources to InputEvent) | P0 | M-31, M-07 | Phase 03 | AT-R-B25.1-04 | Unimplemented |
| R-B25.1-05 | B 25.1 | Unit tests: four-button mapping (profiles A-F) | P0 | M-31, M-08 | Phase 03 | AT-R-B25.1-05 | Unimplemented |
| R-B25.1-06 | B 25.1 | Unit tests: chord generation | P0 | M-31, M-02 | Phase 03 | AT-R-B25.1-06 | Unimplemented |
| R-B25.1-07 | B 25.1 | Unit tests: scale mapping | P0 | M-31, M-08 | Phase 03 | AT-R-B25.1-07 | Unimplemented |
| R-B25.1-08 | B 25.1 | Unit tests: score calculation | P0 | M-31, M-09 | Phase 03 | AT-R-B25.1-08 | Unimplemented |
| R-B25.1-09 | B 25.1 | Unit tests: MIDI parsing | P0 | M-31, M-10 | Phase 07 | AT-R-B25.1-09 | Unimplemented |
| R-B25.1-10 | B 25.1 | Unit tests: project serialization | P0 | M-31, M-15 | Phase 09 | AT-R-B25.1-10 | Unimplemented |
| R-B25.1-11 | B 25.1 | Unit tests: project migration | P0 | M-31, M-15 | Phase 09 | AT-R-B25.1-11 | Unimplemented |
| R-B25.1-12 | B 25.1 | Unit tests: dance chart parsing and validation (.flmdance.json) | P1 | M-31, M-23 | Phase 11 | AT-R-B25.1-12 | Unimplemented |
| R-B25.1-13 | B 25.1 | Unit tests: error handling (coded errors, ErrorReporter, recovery paths) | P0 | M-31, M-01 | Phase 01 | AT-R-B25.1-13 | Unimplemented |
| R-B25.2-01 | B 25.2 | Integration test: input to audio playback | P0 | M-31 | Phase 04 | AT-R-B25.2-01 | Unimplemented |
| R-B25.2-02 | B 25.2 | Integration test: input to scoring | P0 | M-31 | Phase 03 | AT-R-B25.2-02 | Unimplemented |
| R-B25.2-03 | B 25.2 | Integration test: imported MIDI to playback | P0 | M-31 | Phase 07 | AT-R-B25.2-03 | Unimplemented |
| R-B25.2-04 | B 25.2 | Integration test: imported MIDI to 3D animation | P0 | M-31 | Phase 07 | AT-R-B25.2-04 | Unimplemented |
| R-B25.2-05 | B 25.2 | Integration test: recording to project save and reload | P0 | M-31 | Phase 09 | AT-R-B25.2-05 | Unimplemented |
| R-B25.2-06 | B 25.2 | Integration test: multitrack playback and mixing | P1 | M-31 | Phase 09 | AT-R-B25.2-06 | Unimplemented |
| R-B25.2-07 | B 25.2 | Integration test: dance chart to scoring | P1 | M-31 | Phase 11 | AT-R-B25.2-07 | Unimplemented |
| R-B25.2-08 | B 25.2 | Integration test: character customization to saved appearance | P0 | M-31 | Phase 10 | AT-R-B25.2-08 | Unimplemented |
| R-B25.2-09 | B 25.2 | Integration test: multiplayer session synchronization (host and guest peers) | P1 | M-31 | Phase 13 | AT-R-B25.2-09 | Unimplemented |
| R-B25.2-10 | B 25.2 | Integration test: offline operation without the multiplayer service | P0 | M-31 | Phase 13 | AT-R-B25.2-10 | Unimplemented |
| R-B25.3-01 | B 25.3 | Corpus in test-corpus/ (tools/make-corpus.mjs): simple monophonic MIDI | P0 | M-31 | Phase 07 | AT-R-B25.3-01 | Unimplemented |
| R-B25.3-02 | B 25.3 | Corpus: polyphonic MIDI | P0 | M-31 | Phase 07 | AT-R-B25.3-02 | Unimplemented |
| R-B25.3-03 | B 25.3 | Corpus: multitrack MIDI | P0 | M-31 | Phase 07 | AT-R-B25.3-03 | Unimplemented |
| R-B25.3-04 | B 25.3 | Corpus: percussion-heavy MIDI | P0 | M-31 | Phase 07 | AT-R-B25.3-04 | Unimplemented |
| R-B25.3-05 | B 25.3 | Corpus: MIDI with tempo changes | P0 | M-31 | Phase 07 | AT-R-B25.3-05 | Unimplemented |
| R-B25.3-06 | B 25.3 | Corpus: MIDI with controller events | P0 | M-31 | Phase 07 | AT-R-B25.3-06 | Unimplemented |
| R-B25.3-07 | B 25.3 | Corpus: valid MusicXML (partwise, timewise and .mxl) | P1 | M-31 | Phase 12 | AT-R-B25.3-07 | Unimplemented |
| R-B25.3-08 | B 25.3 | Corpus: valid Guitar Pro files for each claimed version (GP3, GP4, GP5) | P1 | M-31 | Phase 12 | AT-R-B25.3-08 | Unimplemented |
| R-B25.3-09 | B 25.3 | Corpus: malformed files for every parser | P0 | M-31 | Phase 07 | AT-R-B25.3-09 | Unimplemented |
| R-B25.3-10 | B 25.3 | Corpus: truncated files for every parser | P0 | M-31 | Phase 07 | AT-R-B25.3-10 | Unimplemented |
| R-B25.3-11 | B 25.3 | Corpus: large files near and above the import limits | P0 | M-31 | Phase 07 | AT-R-B25.3-11 | Unimplemented |
| R-B25.3-12 | B 25.3 | Corpus: files containing unsupported features | P0 | M-31 | Phase 07 | AT-R-B25.3-12 | Unimplemented |
| R-B25.3-13 | B 25.3 | File tests assert unsupported data is reported and parse failures never crash the page | P0 | M-31, M-14 | Phase 07 | AT-R-B25.3-13 | Unimplemented |
| R-B25.4-01 | B 25.4 | Timing test: scheduled audio-event timing | P0 | M-31, M-05 | Phase 04 | AT-R-B25.4-01 | Unimplemented |
| R-B25.4-02 | B 25.4 | Timing test: input judgment timing | P0 | M-31, M-09 | Phase 03 | AT-R-B25.4-02 | Unimplemented |
| R-B25.4-03 | B 25.4 | Timing test: pause and resume | P0 | M-31, M-04 | Phase 02 | AT-R-B25.4-03 | Unimplemented |
| R-B25.4-04 | B 25.4 | Timing test: seeking | P0 | M-31, M-04 | Phase 02 | AT-R-B25.4-04 | Unimplemented |
| R-B25.4-05 | B 25.4 | Timing test: looping (abs drift < 2 ms after 10 min) | P0 | M-31, M-04 | Phase 02 | AT-R-B25.4-05 | Unimplemented |
| R-B25.4-06 | B 25.4 | Timing test: tempo changes | P0 | M-31, M-03 | Phase 02 | AT-R-B25.4-06 | Unimplemented |
| R-B25.4-07 | B 25.4 | Timing test: rendering stalls do not move the timeline | P0 | M-31, M-18 | Phase 05 | AT-R-B25.4-07 | Unimplemented |
| R-B25.4-08 | B 25.4 | Timing test: background and foreground transitions | P0 | M-31, M-28 | Phase 14 | AT-R-B25.4-08 | Unimplemented |
| R-B25.5-01 | B 25.5 | Cross-device test on representative desktop and mobile configurations | P0 | M-31 | Phase 15 | AT-R-B25.5-01 | Unimplemented |
| R-B25.5-02 | B 25.5 | Device matrix row: Chromium desktop | P0 | M-31 | Phase 15 | AT-R-B25.5-02 | Unimplemented |
| R-B25.5-03 | B 25.5 | Device matrix row: Firefox desktop | P0 | M-31 | Phase 15 | AT-R-B25.5-03 | Unimplemented |
| R-B25.5-04 | B 25.5 | Device matrix row: Safari desktop | P0 | M-31 | Phase 15 | AT-R-B25.5-04 | Unimplemented |
| R-B25.5-05 | B 25.5 | Device matrix row: iOS Safari | P0 | M-31 | Phase 15 | AT-R-B25.5-05 | Unimplemented |
| R-B25.5-06 | B 25.5 | Device matrix row: Android Chrome | P0 | M-31 | Phase 15 | AT-R-B25.5-06 | Unimplemented |
| R-B25.5-07 | B 25.5 | Record browser versions and actual test devices for every matrix result | P0 | none | Phase 15 | AT-R-B25.5-07 | Unimplemented |
| R-B25.6-01 | B 25.6 | Performance test: startup | P0 | M-31 | Phase 14 | AT-R-B25.6-01 | Unimplemented |
| R-B25.6-02 | B 25.6 | Performance test: sustained playback | P0 | M-31 | Phase 14 | AT-R-B25.6-02 | Unimplemented |
| R-B25.6-03 | B 25.6 | Performance test: dense polyphonic passages | P0 | M-31 | Phase 14 | AT-R-B25.6-03 | Unimplemented |
| R-B25.6-04 | B 25.6 | Performance test: full-band visualization | P1 | M-31 | Phase 14 | AT-R-B25.6-04 | Unimplemented |
| R-B25.6-05 | B 25.6 | Performance test: mobile rendering fallback | P1 | M-31 | Phase 14 | AT-R-B25.6-05 | Unimplemented |
| R-B25.6-06 | B 25.6 | Performance test: long sessions (slow-test long-session scenarios) | P0 | M-31 | Phase 14 | AT-R-B25.6-06 | Unimplemented |
| R-B25.6-07 | B 25.6 | Performance test: large project loading | P0 | M-31 | Phase 14 | AT-R-B25.6-07 | Unimplemented |
| R-B25.6-08 | B 25.6 | Performance test: memory after repeated mode changes (20 cycles) | P0 | M-31 | Phase 14 | AT-R-B25.6-08 | Unimplemented |
| R-B25.7-01 | B 25.7 | Every P0 and P1 requirement has a specific acceptance test AT-<R-ID> | P0 | M-31 | Phase 15 | AT-R-B25.7-01 | Unimplemented |
| R-B25.7-02 | B 25.7 | No feature is marked complete because it compiles or the page loads | P0 | none | Phase 15 | AT-R-B25.7-02 | Unimplemented |

#### 15.1.26 B 26 Acceptance criteria

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B26.1-01 | B 26.1 | The HTML file opens in supported desktop browsers | P0 | M-29 | Phase 15 | AT-R-B26.1-01 | Unimplemented |
| R-B26.1-02 | B 26.1 | Core functionality needs no build process to run | P0 | M-29 | Phase 16 | AT-R-B26.1-02 | Unimplemented |
| R-B26.1-03 | B 26.1 | Local gameplay remains usable without network access | P0 | M-28 | Phase 15 | AT-R-B26.1-03 | Unimplemented |
| R-B26.1-04 | B 26.1 | Optional network failures never disable standalone features | P0 | M-24, M-28 | Phase 15 | AT-R-B26.1-04 | Unimplemented |
| R-B26.2-01 | B 26.2 | Four-button input triggers the intended mapped musical actions | P0 | M-08 | Phase 08 | AT-R-B26.2-01 | Unimplemented |
| R-B26.2-02 | B 26.2 | Chords and simultaneous inputs work within documented limits (4 buttons, chord <= 16 notes) | P0 | M-08, M-07 | Phase 08 | AT-R-B26.2-02 | Unimplemented |
| R-B26.2-03 | B 26.2 | Timing judgments are based on the musical timeline | P0 | M-09 | Phase 08 | AT-R-B26.2-03 | Unimplemented |
| R-B26.2-04 | B 26.2 | Input calibration changes scoring predictably (offset shifts deltaMs by exactly that amount) | P0 | M-09 | Phase 08 | AT-R-B26.2-04 | Unimplemented |
| R-B26.2-05 | B 26.2 | Keyboard and touch controls work | P0 | M-07, M-26 | Phase 15 | AT-R-B26.2-05 | Unimplemented |
| R-B26.3-01 | B 26.3 | Imported supported MIDI keeps the intended track and note structure | P0 | M-10, M-14 | Phase 07 | AT-R-B26.3-01 | Unimplemented |
| R-B26.3-02 | B 26.3 | Tempo changes are respected in playback | P0 | M-03, M-05 | Phase 07 | AT-R-B26.3-02 | Unimplemented |
| R-B26.3-03 | B 26.3 | Polyphonic passages remain polyphonic in playback | P0 | M-05, M-06 | Phase 07 | AT-R-B26.3-03 | Unimplemented |
| R-B26.3-04 | B 26.3 | Instrument program assignments are applied as documented | P0 | M-06 | Phase 07 | AT-R-B26.3-04 | Unimplemented |
| R-B26.3-05 | B 26.3 | Playback pauses, resumes, seeks and loops without cumulative timing drift | P0 | M-04, M-05 | Phase 07 | AT-R-B26.3-05 | Unimplemented |
| R-B26.4-01 | B 26.4 | Instrument animations respond to actual events | P0 | M-20 | Phase 07 | AT-R-B26.4-01 | Unimplemented |
| R-B26.4-02 | B 26.4 | Multiple instruments perform simultaneously | P0 | M-20, M-21 | Phase 07 | AT-R-B26.4-02 | Unimplemented |
| R-B26.4-03 | B 26.4 | The renderer handles dense passages without blocking audio scheduling | P0 | M-18, M-05 | Phase 14 | AT-R-B26.4-03 | Unimplemented |
| R-B26.4-04 | B 26.4 | Reduced-quality modes keep the musical event timeline | P0 | M-18, M-04 | Phase 14 | AT-R-B26.4-04 | Unimplemented |
| R-B26.5-01 | B 26.5 | Users can record a performance | P0 | M-17 | Phase 09 | AT-R-B26.5-01 | Unimplemented |
| R-B26.5-02 | B 26.5 | Users can create multiple tracks | P1 | M-17 | Phase 09 | AT-R-B26.5-02 | Unimplemented |
| R-B26.5-03 | B 26.5 | Previously recorded tracks play during overdubbing | P1 | M-17, M-05 | Phase 09 | AT-R-B26.5-03 | Unimplemented |
| R-B26.5-04 | B 26.5 | Projects can be saved and reopened | P0 | M-15, M-16 | Phase 09 | AT-R-B26.5-04 | Unimplemented |
| R-B26.5-05 | B 26.5 | Exported supported formats pass their validation and round-trip tests | P0 | M-15, M-10 | Phase 09 | AT-R-B26.5-05 | Unimplemented |
| R-B26.6-01 | B 26.6 | Dance steps are aligned to the musical timeline | P1 | M-23 | Phase 11 | AT-R-B26.6-01 | Unimplemented |
| R-B26.6-02 | B 26.6 | Four-button dance inputs are evaluated correctly | P1 | M-23 | Phase 11 | AT-R-B26.6-02 | Unimplemented |
| R-B26.6-03 | B 26.6 | Dance scores and judgments are deterministic | P1 | M-23 | Phase 11 | AT-R-B26.6-03 | Unimplemented |
| R-B26.6-04 | B 26.6 | Avatar movement remains synchronized with the dance chart | P1 | M-23, M-20 | Phase 11 | AT-R-B26.6-04 | Unimplemented |
| R-B26.7-01 | B 26.7 | Players can join a session when the configured service or peer is available | P1 | M-24 | Phase 13 | AT-R-B26.7-01 | Unimplemented |
| R-B26.7-02 | B 26.7 | Session start and musical position are synchronized within 20 ms | P1 | M-24 | Phase 13 | AT-R-B26.7-02 | Unimplemented |
| R-B26.7-03 | B 26.7 | Disconnection and reconnection never corrupt local state, projects or settings | P1 | M-24, M-16 | Phase 13 | AT-R-B26.7-03 | Unimplemented |
| R-B26.7-04 | B 26.7 | Standalone gameplay remains functional when multiplayer is unavailable | P0 | M-28 | Phase 13 | AT-R-B26.7-04 | Unimplemented |
| R-B26.8-01 | B 26.8 | The final standalone HTML (FingerLickinMusic.html) is delivered | P0 | M-29 | Phase 16 | AT-R-B26.8-01 | Unimplemented |
| R-B26.8-02 | B 26.8 | External services and optional resources are documented (STUN, relay) | P0 | none | Phase 16 | AT-R-B26.8-02 | Unimplemented |
| R-B26.8-03 | B 26.8 | Dependency licenses are documented (inventory: none external; own code license) | P0 | none | Phase 16 | AT-R-B26.8-03 | Unimplemented |
| R-B26.8-04 | B 26.8 | Supported file formats and limitations are listed (docs/COMPATIBILITY.md) | P0 | none | Phase 16 | AT-R-B26.8-04 | Unimplemented |
| R-B26.8-05 | B 26.8 | Automated test results and known issues are included (docs/FINAL-REPORT.md) | P0 | none | Phase 16 | AT-R-B26.8-05 | Unimplemented |
| R-B26.8-06 | B 26.8 | No feature is falsely described as complete | P0 | none | Phase 16 | AT-R-B26.8-06 | Unimplemented |

#### 15.1.27 B 27 Implementation roadmap

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B27-01 | B 27 | Every phase has entry criteria, deliverables, exit criteria and regression tests in Part 11 | P0 | none | Phase 00 | AT-R-B27-01 | Unimplemented |
| R-B27-02 | B 27 | Roadmap phase 0: table of contents, planning artifacts, decisions, acceptance criteria, matrix, risks | P0 | none | Phase 00 | AT-R-B27-02 | Unimplemented |
| R-B27-03 | B 27 | No implementation code is written during Roadmap phase 0 | P0 | none | Phase 00 | AT-R-B27-03 | Unimplemented |
| R-B27-04 | B 27 | Roadmap phase 1: shell, navigation, responsive layout, capability detection, source structure, diagnostics | P0 | M-29, M-01, M-26 | Phase 01 | AT-R-B27-04 | Unimplemented |
| R-B27-05 | B 27 | Roadmap phase 2: music model, tempo and meter, position conversion, transport, pause/seek/loop tests | P0 | M-03, M-04 | Phase 02 | AT-R-B27-05 | Unimplemented |
| R-B27-06 | B 27 | Roadmap phase 3: input abstraction, configurable controls, profiles, notes and chords, scoring, calibration | P0 | M-07, M-08, M-09 | Phase 03 | AT-R-B27-06 | Unimplemented |
| R-B27-07 | B 27 | Roadmap phase 4: synthesis, scheduling, polyphony, instrument assignment, percussion, mixing and volume | P0 | M-05, M-06 | Phase 04 | AT-R-B27-07 | Unimplemented |
| R-B27-08 | B 27 | Roadmap phase 5: render init, stage and camera, rigs, event animation, abstract visuals, quality tiers | P0 | M-18, M-19, M-20, M-21 | Phase 05 | AT-R-B27-08 | Unimplemented |
| R-B27-09 | B 27 | Roadmap phase 6: key and scale, instrument choice, live notes, sustain and chords, metronome, recording | P0 | M-08, M-17, M-27 | Phase 06 | AT-R-B27-09 | Unimplemented |
| R-B27-10 | B 27 | Roadmap phase 7: MIDI parser, track and event preservation, assignment, audio and visuals, seek and loop | P0 | M-10, M-14 | Phase 07 | AT-R-B27-10 | Unimplemented |
| R-B27-11 | B 27 | Roadmap phase 8: chart mapping, difficulty, judgments, score and combo, performance summaries | P0 | M-08, M-09 | Phase 08 | AT-R-B27-11 | Unimplemented |
| R-B27-12 | B 27 | Roadmap phase 9: tracks, record and overdub, editing, mixer, project save and load, MIDI and project export | P0 | M-17, M-15, M-16 | Phase 09 | AT-R-B27-12 | Unimplemented |
| R-B27-13 | B 27 | Roadmap phase 10: customization UI, presets, data-driven configuration, persistence, rig compatibility | P0 | M-22 | Phase 10 | AT-R-B27-13 | Unimplemented |
| R-B27-14 | B 27 | Roadmap phase 11: dance chart model, step mapping, dance scoring, choreography, difficulty settings | P1 | M-23 | Phase 11 | AT-R-B27-14 | Unimplemented |
| R-B27-15 | B 27 | Roadmap phase 12: MusicXML and GP parsers, versions and features, warnings, validation on reference files | P1 | M-12, M-13 | Phase 12 | AT-R-B27-15 | Unimplemented |
| R-B27-16 | B 27 | Roadmap phase 13: protocol, room lifecycle, shared timing, player state and scoring, recovery, fallback | P1 | M-24 | Phase 13 | AT-R-B27-16 | Unimplemented |
| R-B27-17 | B 27 | Roadmap phase 14: instruments, fidelity review, voice allocation, rendering, mobile tuning, long sessions | P1 | M-06, M-05, M-18 | Phase 14 | AT-R-B27-17 | Unimplemented |
| R-B27-18 | B 27 | Roadmap phase 15: unit, integration, file-format, browser, timing, local-file and recovery validation | P0 | M-31 | Phase 15 | AT-R-B27-18 | Unimplemented |
| R-B27-19 | B 27 | Roadmap phase 16: final HTML, license check, independent validation, acceptance suite, docs, instructions | P0 | M-29, M-31 | Phase 16 | AT-R-B27-19 | Unimplemented |
| R-B27-20 | B 27 | The roadmap changes only through recorded changes to this matrix and the plan (version bump) | P0 | none | Phase 00 | AT-R-B27-20 | Unimplemented |

#### 15.1.28 B 28 Final implementation report

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B28-01 | B 28 | Final report item 1: the final standalone HTML artifact | P0 | M-29 | Phase 16 | AT-R-B28-01 | Unimplemented |
| R-B28-02 | B 28 | Final report item 2: complete requirements traceability matrix with final statuses | P0 | none | Phase 16 | AT-R-B28-02 | Unimplemented |
| R-B28-03 | B 28 | Final report item 3: updated implementation table of contents | P0 | none | Phase 16 | AT-R-B28-03 | Unimplemented |
| R-B28-04 | B 28 | Final report item 4: feature-completion report | P0 | none | Phase 16 | AT-R-B28-04 | Unimplemented |
| R-B28-05 | B 28 | Final report item 5: supported file-format and version matrix | P0 | M-14 | Phase 16 | AT-R-B28-05 | Unimplemented |
| R-B28-06 | B 28 | Final report item 6: external dependency and license inventory | P0 | none | Phase 16 | AT-R-B28-06 | Unimplemented |
| R-B28-07 | B 28 | Final report item 7: multiplayer service requirements (relay hosting, STUN) | P1 | none | Phase 16 | AT-R-B28-07 | Unimplemented |
| R-B28-08 | B 28 | Final report item 8: browser and device compatibility report | P0 | none | Phase 16 | AT-R-B28-08 | Unimplemented |
| R-B28-09 | B 28 | Final report item 9: performance measurements against the Part 9 budgets | P0 | none | Phase 16 | AT-R-B28-09 | Unimplemented |
| R-B28-10 | B 28 | Final report item 10: automated test results | P0 | M-31 | Phase 16 | AT-R-B28-10 | Unimplemented |
| R-B28-11 | B 28 | Final report item 11: known issues and unsupported features | P0 | none | Phase 16 | AT-R-B28-11 | Unimplemented |
| R-B28-12 | B 28 | Final report item 12: instructions for launching and using the application | P0 | none | Phase 16 | AT-R-B28-12 | Unimplemented |
| R-B28-13 | B 28 | Final report item 13: instructions for optional multiplayer relay deployment | P1 | none | Phase 16 | AT-R-B28-13 | Unimplemented |
| R-B28-14 | B 28 | Final report item 14: verification that the final HTML meets the packaging requirements | P0 | none | Phase 16 | AT-R-B28-14 | Unimplemented |
| R-B28-15 | B 28 | The report separates implemented and tested work from partial, unverified and future work | P0 | none | Phase 16 | AT-R-B28-15 | Unimplemented |

#### 15.1.29 B 29 Final product definition

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-B29-01 | B 29 | Architecture keeps musical data, scheduling, input, scoring, animation, rendering, persistence apart | P0 | M-01 | Phase 01 | AT-R-B29-01 | Unimplemented |
| R-B29-02 | B 29 | Musical timing stays accurate independently of rendering performance | P0 | M-04, M-05 | Phase 14 | AT-R-B29-02 | Unimplemented |
| R-B29-03 | B 29 | Polyphonic source material is preserved | P0 | M-03, M-14 | Phase 07 | AT-R-B29-03 | Unimplemented |
| R-B29-04 | B 29 | The 3D band reacts to actual musical events | P0 | M-20 | Phase 05 | AT-R-B29-04 | Unimplemented |
| R-B29-05 | B 29 | Desktop and mobile controls are fully usable | P0 | M-07, M-26 | Phase 15 | AT-R-B29-05 | Unimplemented |
| R-B29-06 | B 29 | Standalone gameplay does not depend on online services | P0 | M-28, M-24 | Phase 15 | AT-R-B29-06 | Unimplemented |
| R-B29-07 | B 29 | Online multiplayer uses an explicitly documented network architecture | P1 | M-24 | Phase 13 | AT-R-B29-07 | Unimplemented |
| R-B29-08 | B 29 | Test the single HTML file as a real deliverable (the shipped file, not the test build) | P0 | M-29, M-31 | Phase 16 | AT-R-B29-08 | Unimplemented |
| R-B29-09 | B 29 | The complete table of contents is generated and validated before any implementation code | P0 | none | Phase 00 | AT-R-B29-09 | Unimplemented |

#### 15.1.30 Row counts for B

| Measure | Count |
|---|---|
| Rows in 15.1 | 921 |
| P0 | 606 |
| P1 | 291 |
| P2 | 24 |
| Unimplemented | 906 |
| Deferred | 15 |
| Acceptance tests named (AT-R-B*) | 897 |

Rows per phase (before the Phase column is rewritten to T-IDs):

| Phase | Rows |
|---|---|
| 00 (B 27 phase) | 19 |
| 01 (B 27 phase) | 66 |
| 02 (B 27 phase) | 46 |
| 03 (B 27 phase) | 105 |
| 04 (B 27 phase) | 56 |
| 05 (B 27 phase) | 70 |
| 06 (B 27 phase) | 33 |
| 07 (B 27 phase) | 78 |
| 08 (B 27 phase) | 55 |
| 09 (B 27 phase) | 100 |
| 10 (B 27 phase) | 24 |
| 11 (B 27 phase) | 48 |
| 12 (B 27 phase) | 46 |
| 13 (B 27 phase) | 69 |
| 14 (B 27 phase) | 48 |
| 15 (B 27 phase) | 27 |
| 16 (B 27 phase) | 31 |

These counts are the B row of `docs/STATUS.md` section 1 at plan version 1.0.0 (Part 0.7
rule 1). Any change to 15.1 updates this table in the same commit.

