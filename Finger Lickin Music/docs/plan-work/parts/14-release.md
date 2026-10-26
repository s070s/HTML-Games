## 14. Release checklist, polish gates, and final report

This part is the release contract of version 1.0.0 (`FLM.VERSION = '1.0.0'`, T16.01). It
holds the delivery checklist ticked at the final gate (14.1, B 26.8, P 18), the polish gates
with every P checklist line (14.2, P 1-22), the release-blocking gate summary (14.3, E 13,
pointer to Part 12.10), and the templates of the documents the implementing session writes:
`docs/COMPATIBILITY.md` (14.4, Phase 12 and Phase 16), `docs/FINAL-REPORT.md` (14.5, B 28),
the dependency and license inventory (14.6), the known limitations published at v1 (14.7),
the launch and usage instructions (14.8) and the relay deployment instructions (14.9). The
Phase 16 entries T16.01 to T16.10 execute this part.

At plan version 1.0.0 nothing is implemented. Every status below is Unimplemented or
Deferred, every checkbox is unticked, and every result cell of a template is a placeholder.

Rules for this part:

1. Evidence only. A box is ticked, a status changed or a template cell filled only from a
   record of Part 12.11 (LEDGER record line, results JSON of `tools/selftest.mjs` or
   `tools/perf.mjs`, XT or LT record line) made on the release candidate's commit and file
   hash. The "not run", "not measured" and "not yet verified" rules of 12.11.3 apply to
   every template here.
2. Vocabulary. Requirement and T-entry statuses use only Implemented, Partial, Blocked,
   Unimplemented, Deferred (Part 0.9.2); format and browser claims use only Supported,
   Partial, Conversion, Unsupported (Part 0.9.3), plus the qualifier "(not yet verified)".
3. Files. Every document written from a template is UTF-8 with BOM, LF line endings and
   ASCII text (ADR-09). Placeholders are written `<like this>`; no placeholder survives into
   a delivered document, and the result words "not run", "not measured" and "not yet
   verified" are not placeholders.
4. Sources. A template restates numbers and sentences owned by other parts (Part 1.5
   wording, Part 8.7 format matrix, Part 9.1.2 budgets, Part 10.3 licensing, Part 12.10 gate,
   Part 3.7 relay). Where a restated value and its owning part differ, the owning part
   governs and the template is corrected; the difference is a STATUS.md section 6 defect of
   severity Low.
5. Local labels. `RC-nn` (14.1) and `L-nn` (14.7) are labels local to this part; they are not
   requirement or test IDs and are not traced in Part 15.

### 14.1 Delivery checklist (B 26.8, P 18)

Ticked once, in T16.10, on the final commit. Each item names its source, the 12.10 gate row
it feeds (when it has one), the T sections that produce it, the evidence that must exist
before the box is ticked, and the tests whose recorded results decide it (`AT-<R-ID>` with
the Method of Parts 12.12 and 12.13). An item left unticked at delivery is listed in
`docs/FINAL-REPORT.md` item 11 with its reason; an unticked item that feeds a gate row makes
that row unresolved, and the release is then delivered as "not production-ready" (14.3).
The ticked checklist is copied into the Phase 16 LEDGER entry.

#### 14.1.1 Delivery items of B 26.8

- [ ] RC-01 The final standalone HTML is provided.
  Source: B 26.8 item 1, R-B26.8-01, B 28 item 1. Gate: D-01. T: T16.01, T16.10.
  Evidence: `Finger Lickin Music/FingerLickinMusic.html` in the Phase 16 commit; commit hash,
  file SHA-256 and byte size (<= 1,572,864 bytes target, never above 2,621,440 bytes); the
  build report ending `BUILD OK`; the `node tools/selftest.mjs --smoke` summary line.
  Tests: AT-R-B26.8-01 (auto: PT-001; manual: LT-090); AT-R-B28-01 (review); AT-R-B28-14
  (auto: PT-001; review; manual: LT-090).
- [ ] RC-02 External services and optional resources are documented.
  Source: B 26.8 item 2, R-B26.8-02. Gate: D-02. T: T16.05, T16.08.
  Evidence: the optional STUN toggle (`stun:stun.l.google.com:19302`, off by default) and the
  optional relay (`server/relay.mjs`, Online edition only) named in the SCR-About "Credits and
  licenses" block (Part 10.3.2), in `README.md` (14.8) and in `docs/FINAL-REPORT.md` item 7;
  the statement that the shipped file loads nothing at runtime (Part 2.17).
  Tests: AT-R-B26.8-02 (review; manual: LT-091); AT-R-B28-07 (review); AT-R-P18-04 (review);
  IT-031; LT-078; LT-095.
- [ ] RC-03 Dependency licenses are documented.
  Source: B 26.8 item 3, R-B26.8-03. Gate: D-03. T: T16.05.
  Evidence: the 14.6 inventory filled in `docs/FINAL-REPORT.md` item 6: zero runtime
  dependencies, the development tools with their recorded versions, the content inventory of
  Part 10.3.1 with its review result, and the game license notice in force (Part 10.3.3).
  Tests: AT-R-B26.8-03 (review; manual: LT-094); AT-R-B28-06 (review; manual: LT-094);
  AT-R-P18-03 (manual: LT-094; review).
- [ ] RC-04 Supported file formats and limitations are listed.
  Source: B 26.8 item 4, R-B26.8-04. Gate: D-04. T: T12.08, T16.06.
  Evidence: `docs/COMPATIBILITY.md` written from 14.4 with every format, version and browser
  cell citing its tests; the SCR-About "Limits of this version" block equal to Part 1.5 plus
  the Part 9.9 line; the 14.7 limitations published where 14.7 says.
  Tests: AT-R-B26.8-04 (auto: UT-14-19; review; manual: LT-091); AT-R-B28-05 (review);
  FT-095.
- [ ] RC-05 Automated test results and known issues are included.
  Source: B 26.8 item 5, R-B26.8-05. Gate: D-05. T: T16.03, T16.07.
  Evidence: `docs/FINAL-REPORT.md` items 10 and 11 filled from the `node tools/selftest.mjs
  --all --slow --json` and `node tools/perf.mjs --slow --json` results of the final commit,
  both stored verbatim in the Phase 16 LEDGER entry; STATUS.md section 6 copied into item 11.
  Tests: AT-R-B26.8-05 (review); AT-R-B28-10 (review); AT-R-B28-11 (review); AT-R-P20-11
  (review).
- [ ] RC-06 No feature is falsely described as complete.
  Source: B 26.8 item 6, R-B26.8-06, B 28 last paragraph. Gate: D-06. T: T16.03, T16.07.
  Evidence: STATUS.md section 1 counts equal to the Part 15 Status column counts per part
  (Part 0.7 rule 7); every Implemented row lists passing tests; the five-group separation of
  14.5 rule 2 applied; LT-091 and LT-096 recorded.
  Tests: AT-R-B26.8-06 (review; manual: LT-091, LT-096); AT-R-B28-15 (review); AT-R-P20-12
  (review); AT-R-P0-03 (review).

#### 14.1.2 Packaging and offline items of P 18

- [ ] RC-07 The final artifact is one HTML file.
  Source: P 18 item 1, R-P18-01. Gate: D-01. T: T01.02, T16.01, T16.02.
  Evidence: the delivered file copied alone into an empty folder outside the repository runs
  every core function (T16.02 checklist); no sidecar file is read.
  Tests: AT-R-P18-01 (auto: PT-001; review).
- [ ] RC-08 Required code is embedded.
  Source: P 18 item 2, R-P18-02. Gate: D-01. T: T01.02, T16.01.
  Evidence: the Part 3.3.4 build checks pass (banned APIs, no external script, style, font or
  image reference); the XT Network panel shows exactly one request, the document (12.8.1 rule
  10).
  Tests: AT-R-P18-02 (auto: PT-001; manual: XT-001; review).
- [ ] RC-09 Embedded assets are complete and correctly licensed.
  Source: P 18 item 3, R-P18-03. Gate: D-03. T: T16.05.
  Evidence: the Part 10.3.1 inventory checked against the final file; the static scan of Part
  10.3.1 rule 3 passes; the demo originality review of Part 10.3.1 rule 2 recorded.
  Tests: AT-R-P18-03 (manual: LT-094; review); LT-032.
- [ ] RC-10 External dependencies are explicitly documented.
  Source: P 18 item 4, R-P18-04. Gate: D-02. T: T16.05, T16.08.
  Evidence: as RC-02, plus the 14.6 development-tool table.
  Tests: AT-R-P18-04 (review).
- [ ] RC-11 The file opens directly in every claimed compatible environment.
  Source: P 18 item 5, R-P18-05. Gate: G-05. T: T15.04, T16.02.
  Evidence: XT-001 to XT-005 records in every context of 12.8.1 rule 4 that the browser's
  claim names; a browser without complete passing records is published Partial or "not yet
  verified" (Part 1.6 policy 1).
  Tests: AT-R-P18-05 (manual: XT-001, XT-002, XT-003, XT-004, XT-005).
- [ ] RC-12 Core offline features work without a network connection.
  Source: P 18 item 6, R-P18-06. Gate: G-05. T: T15.03.
  Evidence: IT-030 result; every C1 run of the XT rows made with the network disconnected
  (12.8.1 rule 8); no network request in the default configuration.
  Tests: AT-R-P18-06 (auto: IT-030; manual: XT-001, XT-004, XT-058).
- [ ] RC-13 Optional remote services fail gracefully.
  Source: P 18 item 7, R-P18-07. Gate: D-02. T: T13.08, T15.03.
  Evidence: v1 ships no remote assets; the optional remote services are the STUN server and
  the relay, and their failure paths of Part 1.4 (lobby note, DLG-NetError, fall back to
  invite codes) are recorded.
  Tests: AT-R-P18-07 (auto: IT-031; manual: LT-078, XT-064).
- [ ] RC-14 No private credentials are embedded.
  Source: P 18 item 8, R-P18-08. Gate: D-01. T: T13.08, T16.01.
  Evidence: the build report of the final commit shows the credential-pattern check and the
  static scan passing (no test ID exists for these build checks; the report line is the
  evidence).
  Tests: AT-R-P18-08 (review).
- [ ] RC-15 Browser storage behavior is verified for the actual deployment context.
  Source: P 18 item 9, R-P18-09. Gate: G-04. T: T15.04.
  Evidence: XT-020 to XT-024 records per browser with separate `file://` and `http(s)` cells;
  the storage mode reached per browser in `docs/COMPATIBILITY.md` section 8; the RISK-58
  sentence on SCR-Library and in `README.md` (14.7 L-14).
  Tests: AT-R-P18-09 (manual: XT-020, XT-021, XT-022, XT-023, XT-024).
- [ ] RC-16 File import and export are tested from the delivered file.
  Source: P 18 item 10, R-P18-10. Gate: D-04. T: T15.04.
  Evidence: XT import and export records made on the shipped file's hash, not on the test
  build.
  Tests: AT-R-P18-10 (manual: XT-025, XT-028, XT-030, XT-033).
- [ ] RC-17 The final file is tested independently of the development environment.
  Source: P 18 item 11, R-P18-11. Gate: G-05. T: T16.02.
  Evidence: LT-090 on a clean computer with a fresh browser profile, no server, no repository
  files and no network; the session's headless run of T16.02 is recorded as a pre-check only.
  Tests: AT-R-P18-11 (manual: LT-090).
- [ ] RC-18 No development-only dependency is required at runtime.
  Source: P 18 item 12, R-P18-12. Gate: D-01. T: T16.01.
  Evidence: Node is used only for build, tests, corpus generation and the optional relay; the
  shipped file contains no `90-` to `92-` module and `FLM.selfTest` is undefined in it.
  Tests: AT-R-P18-12 (manual: LT-090; review); UT-29-11.

#### 14.1.3 Final documents and release decision

- [ ] RC-19 `docs/FINAL-REPORT.md` exists with the fourteen B 28 items in the 14.5 layout.
  Source: B 28, R-B28-01 to R-B28-15. Gate: D-05, D-06. T: T16.07.
  Evidence: every field of 14.5 filled or carrying a 12.11.3 result word; the five-group
  separation of 14.5 rule 2 present in items 2, 4 and 11.
  Tests: AT-R-B28-01 to AT-R-B28-15 (review; LT-090, LT-094, LT-095 where 12.12 names them).
- [ ] RC-20 `docs/COMPATIBILITY.md` is final.
  Source: B 28 items 5 and 8, R-B28-05, R-B28-08. Gate: D-04. T: T16.06.
  Evidence: 14.4 sections 1 to 9 filled; "(not yet verified)" on every cell without a passing
  record.
  Tests: AT-R-B28-05 (review); AT-R-B28-08 (review); FT-095; LT-091.
- [ ] RC-21 `README.md` is updated with the 14.8 instructions.
  Source: B 28 item 12, R-B28-12. Gate: D-02. T: T16.08.
  Evidence: the Part 3.10 structure kept, first paragraph replaced, 14.8 sections present,
  release status sentence of 14.3 present.
  Tests: AT-R-B28-12 (review; manual: LT-090); LT-093.
- [ ] RC-22 `docs/STATUS.md` is final.
  Source: Part 0.7, R-P20-11, R-P22-11. Gate: D-06. T: T16.03, T16.10.
  Evidence: counts per part equal to Part 15; section 6 has no open Critical defect, or the
  release is marked "not production-ready" (14.3).
  Tests: AT-R-P20-11 (review); AT-R-P22-11 (review).
- [ ] RC-23 Part 15 Status column and the Part 11 table of contents carry final statuses.
  Source: B 28 items 2 and 3, R-B28-02, R-B28-03. T: T16.03.
  Evidence: the Part 0.7 rule 7 script output with equal counts; each T entry annotated with a
  status word (14.5 item 3 rule).
  Tests: AT-R-B28-02 (review); AT-R-B28-03 (review).
- [ ] RC-24 The release-blocking gate is decided.
  Source: E 13, Part 12.10. Gate: all rows. T: T16.04, T16.10.
  Evidence: the 17 rows of 12.10.2 and 12.10.3 and the three supplementary checks of 14.3.3
  each marked "resolved" or "unresolved: <reason>" in the Phase 16 LEDGER entry and in
  `docs/FINAL-REPORT.md` item 4; the release status sentence of 14.3.4 written.
  Tests: AT-R-E13-01 to AT-R-E13-11; AT-R-P22-12.
- [ ] RC-25 The polish gates of 14.2 are filled.
  Source: P 22, P preamble. T: T16.09.
  Evidence: the Status column of every 14.2 table copied from STATUS.md; the 14.2.23 summary
  filled; the T16.09 per-subsystem review table in `docs/FINAL-REPORT.md` item 4.
  Tests: AT-R-P0-03 (review); AT-R-P22-01 to AT-R-P22-13; LT-096.
- [ ] RC-26 The final risk review is recorded.
  Source: Part 13.3 rule 6. T: T16.10.
  Evidence: risk state counts in `docs/FINAL-REPORT.md` item 11; open Medium and Low risks
  listed as accepted.
  Tests: review.
- [ ] RC-27 The license notice in force is recorded.
  Source: Part 10.3.3 (owner decision). T: T16.05.
  Evidence: either the interim notice "Copyright (c) 2026 the Finger Lickin Music authors. All
  rights reserved." from `LICENSE_NOTICE`, or the owner's chosen license recorded in the
  LEDGER with `Finger Lickin Music/LICENSE` added and README and SCR-About updated; the
  notice in force is quoted in 14.6.
  Tests: AT-R-B28-06 (review; manual: LT-094).
- [ ] RC-28 The relay passes its self-test and the 14.9 instructions are filled.
  Source: B 28 items 7 and 13, R-B28-07, R-B28-13. Gate: D-02. T: T13.08, T16.08.
  Evidence: `node server/relay.mjs --selftest` prints `RELAY SELFTEST <n>/<n>` on the final
  commit; 14.9 written into `docs/FINAL-REPORT.md` item 13 and referenced from `README.md`.
  Tests: AT-R-B28-13 (review; manual: LT-095).
- [ ] RC-29 The final tool runs pass on the final commit.
  Source: Part 3.9, T16.10. T: T16.10.
  Evidence: summary lines of `node tools/build.mjs`, `node tools/selftest.mjs --all --slow`,
  `node tools/selftest.mjs --smoke`, `node tools/make-corpus.mjs --check`,
  `node tools/perf.mjs --slow` and `node server/relay.mjs --selftest` in the final LEDGER
  entry.
  Tests: AT-R-B27-19 (manual: LT-090, LT-094; review).
- [ ] RC-30 The final LEDGER entry is written.
  Source: ADR-16, Part 3.8. T: T16.10.
  Evidence: the entry ends with `RESUME: none (delivered)` and lists the owner actions: push
  and merge approval, XT and LT rows still "not run", the game license choice, and the OQ-1,
  OQ-2 and OQ-3 results still open.
  Tests: review.
- [ ] RC-31 The Phase 16 commit is made and nothing is pushed without the owner.
  Source: Part 3.9 rule 6, BRIEF 8. T: T16.10.
  Evidence: one commit "Finger Lickin Music: Phase 16 - packaging and final delivery" with
  `FingerLickinMusic.html`, `docs/COMPATIBILITY.md`, `docs/FINAL-REPORT.md`,
  `docs/STATUS.md`, `docs/LEDGER.md` and `README.md`; `git status --porcelain` empty after it.
  Tests: review.

### 14.2 Polish gates

Every P checklist line appears here: one row per R-P row of Part 15.4, in matrix order, from
R-P0-01 to R-P22-13 (360 rows: 88 P0, 252 P1, 20 P2, of which 1 Deferred). P sections with
numbered subsections (P 2, 5, 6, 7) have one table per subsection under the section heading.

Columns:

- R-ID and Pri: the Part 15.4 row and its priority (B 4.1).
- Checklist item: the Part 15.4 requirement text, which restates the spec line as a testable
  item with the plan's numbers.
- Owning module(s): the Part 15.4 Module(s) cell (a tool or document in backticks where no
  source module carries the item; "none (plan)" where this document satisfies it).
- T section(s): every Part 11 entry whose `Covers:` line names the R-ID (from the 11x
  indexes).
- Verification: `AT-<R-ID>` with its Method from Part 12.13.3 for P0 and P1 rows; P2 rows have
  no AT (Part 12 writes ATs for P0 and P1 only) and name the review evidence instead, taken
  from the owning T entry's Verification or Open items line and the 12.9.15 area mapping.
- Status at v1.0.0: Unimplemented, or Deferred where Part 15.4 says so.

Gate rules:

1. A row becomes Implemented only by Part 0.7 rule 3: every test its Verification cell names
   passes in one `node tools/selftest.mjs --all --slow` run on the gated commit and every named
   XT and LT has a passing record on the release candidate hash (AT-R-P0-03: never after one
   successful run). P2 rows follow the same rule with their review evidence.
2. A P section or subsection gate is "met" when every row in it is Implemented, or Deferred
   with its STATUS.md section 3 row and user-facing wording (Part 0.6). Otherwise it reads
   "not met: <R-IDs>". P2 rows count toward the gate like any other row.
3. The P 6 tables are release-critical (R-P6-01): an open failure in them blocks the release
   through T16.09. The P 22 rows are the subsystem review of T16.09; R-P22-11 and R-P22-12
   are also supplementary release checks (14.3.3).
4. In T16.09 the Status column of every table is overwritten from STATUS.md, the "Gate at
   delivery" column of 14.2.23 is filled, and the same summary is copied into
   `docs/FINAL-REPORT.md` item 4. The tables are never edited to remove or merge rows.


#### 14.2.0 P preamble

The three obligations of the "Mandatory agent instruction" before P 1 (section number 0 in Part 15.4).

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P0-01 | P0 | Include every applicable P section 1-22 in the end-to-end table of contents (Part 11 Covers lines) | none (plan) | T00.01 | AT-R-P0-01 (review) | Unimplemented |
| R-P0-02 | P0 | Give every P requirement a dependency, acceptance criteria, verification method and final status | none (plan) | T00.06 | AT-R-P0-02 (review) | Unimplemented |
| R-P0-03 | P0 | Never mark a P item polished after one successful run; Implemented needs every named test passing in --all | M-31, `docs/STATUS.md` | T16.03 | AT-R-P0-03 (review) | Unimplemented |

#### 14.2.1 P 1 Overall game feel

Spec groups: "Core experience" is R-P1-01 to R-P1-07, "Consistency" is R-P1-08 to R-P1-12.

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P1-01 | P1 | Every primary action gives visible feedback in the next rendered frame, plus audible feedback where it sounds | M-26, M-07, M-21 | T01.06 | AT-R-P1-01 (auto: UT-26-12, UT-26-20, IT-001; manual: LT-020) | Unimplemented |
| R-P1-02 | P1 | Low-power devices stay responsive: Balanced 60 FPS target, 45 floor, auto-downgrade at p95 > 33 ms over 5 s | M-18, M-26 | T14.04 | AT-R-P1-02 (auto: PT-005, PT-006, UT-18-13, UT-18-14; manual: LT-087) | Unimplemented |
| R-P1-03 | P1 | Every screen and mode uses the shared screen stack, Transport, theme tokens and HUD; no standalone sub-apps | M-26, M-27, M-28 | T01.06 | AT-R-P1-03 (auto: UT-26-01, IT-047, IT-032; review) | Unimplemented |
| R-P1-04 | P1 | Mode transitions keep project, song and settings and never stop recording or discard unsaved work silently | M-28, M-15, M-26 | T09.13 | AT-R-P1-04 (auto: IT-042, UT-27-24, UT-28-15, UT-17-24; manual: LT-006) | Unimplemented |
| R-P1-05 | P1 | Quick Play demo playable within 5 s desktop and 8 s mobile of file open; main menu within 1.5 s and 3.0 s | M-29, M-30, M-27 | T08.05 | AT-R-P1-05 (auto: PT-002, PT-003; manual: LT-001, LT-002) | Unimplemented |
| R-P1-06 | P1 | Advanced features stay discoverable: collapsed "Advanced" groups, contextual help per screen, SCR-Help index | M-26, M-27 | T08.07 | AT-R-P1-06 (manual: LT-007) | Unimplemented |
| R-P1-07 | P1 | Loading, waiting, saving and failure states each have a designed view (indicator, progress, result, DLG-*) | M-26, M-27 | T01.06 | AT-R-P1-07 (auto: UT-27-18, UT-27-28, UT-14-12, FI-013; manual: LT-066) | Unimplemented |
| R-P1-08 | P1 | All modes share navigation, Part 7 terminology, the icon sprite, control keys and feedback patterns | M-26, M-27 | T01.06 | AT-R-P1-08 (auto: UT-26-23; manual: LT-011) | Unimplemented |
| R-P1-09 | P1 | Buttons, menus, dialogs, sliders and panels are built only by FLM.UI.Widgets from shared CSS tokens | M-26, `src/shell.html` | T01.06 | AT-R-P1-09 (auto: UT-26-12, UT-26-13; review) | Unimplemented |
| R-P1-10 | P1 | Each setting has one key in the settings schema and identical behavior on every screen that shows it | M-26, M-27, M-16 | T01.08 | AT-R-P1-10 (auto: UT-27-13, UT-27-14, IT-060; manual: LT-085) | Unimplemented |
| R-P1-11 | P1 | Keyboard, touch, gamepad and MIDI map to the same logical controls and produce identical results | M-07, M-08 | T03.02 | AT-R-P1-11 (auto: IT-003, UT-07-20, UT-07-21, UT-07-24; manual: LT-026) | Unimplemented |
| R-P1-12 | P1 | Every feature defines its empty, loading, success, error and disabled states where applicable (Part 7 table) | M-26, M-27 | T01.06 | AT-R-P1-12 (auto: UT-27-02, UT-26-14; manual: LT-008) | Unimplemented |

#### 14.2.2 P 2 Visual design and art direction

P 2.1 Establish one recognizable visual identity:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P2.1-01 | P1 | One visual direction (lit live stage, music culture, modern 3D) stated in the Part 7 style rules and applied | M-26, M-21 | T01.06 | AT-R-P2.1-01 (manual: LT-011) | Unimplemented |
| R-P2.1-02 | P1 | Restrained semantic palette as CSS tokens: accent, success, warning, danger, info and four lane colors | M-26, `src/shell.html` | T01.06 | AT-R-P2.1-02 (manual: LT-011; review) | Unimplemented |
| R-P2.1-03 | P1 | Type scale tokens for headings, gameplay labels, tabular numerals, menus and diagnostics in the one font stack | M-26, `src/shell.html` | T01.06 | AT-R-P2.1-03 (manual: LT-011; review) | Unimplemented |
| R-P2.1-04 | P1 | Spacing, alignment grid, corner radii, borders and shadows come only from shared CSS tokens | M-26, `src/shell.html` | T01.06 | AT-R-P2.1-04 (manual: LT-011; review) | Unimplemented |
| R-P2.1-05 | P1 | Logo, menus, stage, character editor and HUD share palette, type and shape language | M-26, M-21, M-27 | T10.04 | AT-R-P2.1-05 (manual: LT-011) | Unimplemented |
| R-P2.1-06 | P1 | Gameplay screens show no dashboard styling: no card grids or data tables over the stage during play | M-26, M-27 | T08.05 | AT-R-P2.1-06 (auto: UT-26-22; manual: LT-011) | Unimplemented |
| R-P2.1-07 | P1 | No decorative gradients, blur or borders; glow and particles appear only for musical events | M-21, M-26 | T05.07 | AT-R-P2.1-07 (auto: UT-21-15, UT-20-29; manual: LT-011) | Unimplemented |
| R-P2.1-08 | P1 | Effects are triggered by musical events and never outshine or cover the highway targets | M-21, M-20 | T05.07 | AT-R-P2.1-08 (auto: UT-21-15; manual: LT-009) | Unimplemented |
| R-P2.1-09 | P1 | Text contrast >= 4.5:1 (3:1 large text) over every stage theme, bright or dark, and in high-contrast mode | M-26, M-21 | T01.07 | AT-R-P2.1-09 (manual: LT-013) | Unimplemented |

P 2.2 Pixel-level interface quality:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P2.2-01 | P1 | No misaligned icons, text, panels or controls at the five reference viewports 360x640 to 1920x1080 | M-26, M-27 | T15.07 | AT-R-P2.2-01 (manual: LT-008) | Unimplemented |
| R-P2.2-02 | P1 | No unintended clipping or overlapping elements at the reference viewports in both orientations | M-26, M-27 | T15.07 | AT-R-P2.2-02 (manual: LT-008) | Unimplemented |
| R-P2.2-03 | P1 | Uniform button heights and padding from size tokens (44 px menu controls, 56 px gameplay pads) | M-26 | T01.06 | AT-R-P2.2-03 (auto: UT-26-12, PT-024; manual: LT-008) | Unimplemented |
| R-P2.2-04 | P1 | No text cut off at reference viewports; long text truncates with an ellipsis and keeps the full text in title | M-26, M-27 | T15.07 | AT-R-P2.2-04 (auto: UT-26-25; manual: LT-008) | Unimplemented |
| R-P2.2-05 | P1 | No horizontal page scroll: overflow hidden on html and body, every layout fits a 320 px wide viewport | M-26, `src/shell.html` | T01.06 | AT-R-P2.2-05 (auto: UT-26-16; manual: LT-008) | Unimplemented |
| R-P2.2-06 | P1 | No layout jumps when panels open or close: panels overlay or occupy space reserved in advance | M-26 | T01.06 | AT-R-P2.2-06 (manual: LT-012) | Unimplemented |
| R-P2.2-07 | P1 | No flicker on mode switch: overlay cross-fade and the canvas cleared to the stage background in one frame | M-28, M-18, M-26 | T05.11 | AT-R-P2.2-07 (manual: LT-012) | Unimplemented |
| R-P2.2-08 | P1 | Consistent capitalization (Title Case titles, sentence case labels) and Part 7 glossary terms in all strings | M-27, M-26 | T16.09 | AT-R-P2.2-08 (auto: UT-26-23; manual: LT-011) | Unimplemented |
| R-P2.2-09 | P1 | No unexplained empty space or overly dense panels: each panel has an empty state and a density limit | M-26, M-27 | T15.07 | AT-R-P2.2-09 (manual: LT-008) | Unimplemented |
| R-P2.2-10 | P1 | No low-resolution or distorted assets: canvases sized by devicePixelRatio, icons as SVG only | M-18, M-26 | T05.02 | AT-R-P2.2-10 (auto: UT-18-25; manual: LT-016) | Unimplemented |

P 2.3 Visual hierarchy:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P2.3-01 | P1 | Each screen shows its title and current task in a fixed header region | M-26, M-27 | T01.06 | AT-R-P2.3-01 (manual: LT-011) | Unimplemented |
| R-P2.3-02 | P1 | One primary-styled action per screen; secondary actions use the secondary style | M-26, M-27 | T01.06 | AT-R-P2.3-02 (auto: UT-26-12; manual: LT-011) | Unimplemented |
| R-P2.3-03 | P1 | Critical status (error, recording, network, save) uses semantic color plus icon plus text, never decoration | M-26 | T01.06 | AT-R-P2.3-03 (manual: LT-011, LT-014) | Unimplemented |
| R-P2.3-04 | P1 | Advanced settings sit behind a collapsed "Advanced" disclosure in each settings group | M-26, M-27 | T01.08 | AT-R-P2.3-04 (manual: LT-011) | Unimplemented |
| R-P2.3-05 | P1 | Actionable controls have button styling and a focusable role; informational labels are not focusable | M-26 | T01.06 | AT-R-P2.3-05 (auto: UT-26-15; manual: LT-079) | Unimplemented |
| R-P2.3-06 | P1 | Focus, hover, pressed, selected, disabled and loading states are visually distinct on every widget | M-26 | T01.06 | AT-R-P2.3-06 (auto: UT-26-12; manual: LT-011) | Unimplemented |

#### 14.2.3 P 3 Main menu and navigation

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P3-01 | P1 | Launch opens SCR-MainMenu (SCR-FirstLaunch on first run) with the 12 entries in the fixed order | M-27, M-29 | T01.11 | AT-R-P3-01 (auto: UT-27-01, UT-27-07, UT-29-08; manual: LT-003) | Unimplemented |
| R-P3-02 | P1 | Quick Play is the first main menu entry and holds initial focus | M-27 | T01.11 | AT-R-P3-02 (auto: UT-27-01; manual: LT-005) | Unimplemented |
| R-P3-03 | P1 | Instrument Mode, Free Play, Studio, Import, Dance, Multiplayer and Characters each have one main menu entry | M-27 | T01.11 | AT-R-P3-03 (auto: UT-27-01; manual: LT-005) | Unimplemented |
| R-P3-04 | P1 | Every mode is reachable from SCR-MainMenu in at most two transitions, without filler screens | M-26, M-27 | T01.11 | AT-R-P3-04 (manual: LT-005) | Unimplemented |
| R-P3-05 | P1 | Escape, browser back and the on-screen Back button all return to the previous screen of the stack | M-26, M-28 | T01.09 | AT-R-P3-05 (auto: UT-26-05, UT-26-06, UT-28-19, IT-056; manual: LT-005) | Unimplemented |
| R-P3-06 | P0 | Unsaved work runs UI.confirmUnsaved before back, mode change, new import or project replace | M-26, M-15, M-28 | T09.13 | AT-R-P3-06 (auto: UT-27-24, IT-042; manual: LT-006) | Unimplemented |
| R-P3-07 | P1 | Opening and closing any dialog returns focus to the element that opened it | M-26 | T01.07 | AT-R-P3-07 (auto: UT-26-08; manual: LT-081) | Unimplemented |
| R-P3-08 | P1 | Repeated navigation adds no listeners or running processes: Modes.assertClean() counters return to baseline | M-28, M-01 | T01.09 | AT-R-P3-08 (auto: IT-032, UT-28-02, UT-28-07, PT-011) | Unimplemented |
| R-P3-09 | P1 | The current project and song stay selected across navigation until the user closes or replaces them | M-15, M-28 | T09.04 | AT-R-P3-09 (auto: IT-048; manual: LT-005) | Unimplemented |
| R-P3-10 | P1 | Unavailable online features stay visible but disabled with a one-line statement of what they need | M-24, M-27 | T13.09 | AT-R-P3-10 (auto: UT-27-02, UT-26-14; manual: XT-058, XT-061) | Unimplemented |
| R-P3-11 | P0 | Returning to the main menu stops a recording with Recorder.stop, keeps the take and leaves the project valid | M-17, M-28 | T09.07 | AT-R-P3-11 (auto: UT-17-07, UT-17-24, UT-28-15, IT-014; manual: LT-056) | Unimplemented |
| R-P3-12 | P1 | Browser back and forward follow one pushState per screen; popstate runs the unsaved guard before popping | M-26, M-28 | T01.09 | AT-R-P3-12 (auto: UT-26-06, UT-26-07, UT-27-24, IT-056; manual: LT-005) | Unimplemented |

#### 14.2.4 P 4 First launch and onboarding

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P4-01 | P1 | First launch reaches a usable screen within the 1.5 s desktop and 3.0 s mobile budgets, one setup screen only | M-29, M-27 | T08.05 | AT-R-P4-01 (auto: PT-002, PT-003, UT-27-07; manual: LT-001, LT-002) | Unimplemented |
| R-P4-02 | P1 | The audio activation prompt appears only while the AudioContext is suspended and no gesture has occurred | M-05, M-29 | T04.01 | AT-R-P4-02 (auto: UT-05-01, UT-27-28, UT-29-09; manual: XT-006, XT-009) | Unimplemented |
| R-P4-03 | P0 | Capability checks disable only features whose required capability is missing; all others stay enabled | M-01, M-29 | T01.04 | AT-R-P4-03 (auto: UT-29-02, UT-29-03, UT-29-05, IT-059) | Unimplemented |
| R-P4-04 | P0 | A built-in demo starts from Quick Play without importing any file | M-30, M-27, M-28 | T08.05 | AT-R-P4-04 (auto: UT-27-04, PT-003; manual: LT-001) | Unimplemented |
| R-P4-05 | P1 | SCR-Tutorial uses the real gameplay controls: the active Input map, Mapper and Rhythm.Judge | M-27, M-07, M-09 | T08.07 | AT-R-P4-05 (auto: UT-27-08, UT-27-09; manual: LT-004) | Unimplemented |
| R-P4-06 | P1 | Every tutorial step offers Skip and Repeat | M-27 | T08.07 | AT-R-P4-06 (auto: UT-27-08; manual: LT-004) | Unimplemented |
| R-P4-07 | P1 | Tutorial prompts show keys A S K L on desktop, the four pads on touch and buttons on gamepad | M-27, M-07 | T08.07 | AT-R-P4-07 (auto: UT-27-10; manual: LT-004) | Unimplemented |
| R-P4-08 | P1 | The tutorial includes a two-lane simultaneous press step on every input that supports it | M-27 | T08.07 | AT-R-P4-08 (auto: UT-27-09, UT-27-10; manual: LT-004) | Unimplemented |
| R-P4-09 | P1 | SCR-FirstLaunch and SCR-Help explain Instrument Mode, Free Play, Studio and Dance Mode in one sentence each | M-27 | T08.07 | AT-R-P4-09 (manual: LT-007, LT-093) | Unimplemented |
| R-P4-10 | P1 | No permission is requested at launch; MIDI access is requested only when the user enables MIDI input | M-07, M-27 | T03.02 | AT-R-P4-10 (auto: UT-07-23; manual: LT-001, XT-053) | Unimplemented |
| R-P4-11 | P1 | First-launch choices (input layout, reduced motion, volume) are saved through Storage.saveSettings | M-16, M-27 | T08.07 | AT-R-P4-11 (auto: UT-27-07, IT-060; manual: LT-003) | Unimplemented |
| R-P4-12 | P1 | Completed onboarding is stored; returning users open SCR-MainMenu; the tutorial stays reachable from SCR-Help | M-16, M-29, M-27 | T08.07 | AT-R-P4-12 (auto: UT-27-07, UT-27-12, UT-29-08; manual: LT-003) | Unimplemented |

#### 14.2.5 P 5 Gameplay responsiveness and feel

P 5.1 Input quality:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P5.1-01 | P1 | Every press shows pad and lane-receptor feedback in the next rendered frame | M-07, M-26, M-21 | T03.02 | AT-R-P5.1-01 (auto: UT-26-20, UT-21-10; manual: LT-020) | Unimplemented |
| R-P5.1-02 | P1 | Pressed and released states are visually distinct on touch pads and lane receptors | M-26, M-21 | T03.02 | AT-R-P5.1-02 (auto: UT-26-20; manual: LT-020, LT-014) | Unimplemented |
| R-P5.1-03 | P0 | Up to four simultaneous presses are timestamped individually and judged by the same rules | M-07, M-09 | T03.03 | AT-R-P5.1-03 (auto: UT-07-20, IT-002, IT-005, TT-029, UT-09-14; manual: XT-012, XT-014) | Unimplemented |
| R-P5.1-04 | P0 | Held notes never stick: every press ends by device release, focus loss, pause, panic or mode leave | M-07, M-06, M-08 | T03.03 | AT-R-P5.1-04 (auto: UT-07-12, UT-28-03, IT-033, UT-05-22; manual: LT-035) | Unimplemented |
| R-P5.1-05 | P0 | Window blur and visibility hidden release all held keyboard inputs through Input.releaseAll | M-07 | T03.03 | AT-R-P5.1-05 (auto: UT-07-12, UT-07-13; manual: XT-071) | Unimplemented |
| R-P5.1-06 | P0 | pointercancel and lost pointer capture release the pad and every note it holds | M-07, M-26 | T03.03 | AT-R-P5.1-06 (auto: UT-07-19, FI-029; manual: XT-016, XT-018) | Unimplemented |
| R-P5.1-07 | P0 | Keyboard auto-repeat (event.repeat true) never creates a press, note or judgment | M-07 | T03.01 | AT-R-P5.1-07 (auto: UT-07-06, UT-07-07) | Unimplemented |
| R-P5.1-08 | P1 | Mapping changes apply from the next press; notes already held keep their mapping until released | M-07, M-08 | T03.05 | AT-R-P5.1-08 (auto: UT-08-09, UT-08-13; manual: LT-027) | Unimplemented |
| R-P5.1-09 | P1 | Remapping detects conflicts with Input.conflicts and names the clashing action before the map is saved | M-07, M-27 | T03.04 | AT-R-P5.1-09 (auto: UT-07-26, UT-27-16; manual: LT-084) | Unimplemented |
| R-P5.1-10 | P1 | DLG-Calibration shows each Calibration offset in ms with a tap test, live preview and reset to 0 | M-27, M-07, M-09 | T03.09 | AT-R-P5.1-10 (auto: UT-27-17; manual: LT-019) | Unimplemented |
| R-P5.1-11 | P0 | Pause, resume, seek and mode change release held inputs; nothing is judged unless state is playing | M-07, M-09, M-28 | T03.03 | AT-R-P5.1-11 (auto: UT-09-21, UT-07-29, UT-27-27, UT-28-03; manual: LT-030) | Unimplemented |

P 5.2 Rhythm gameplay:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P5.2-01 | P1 | Note targets stay readable at every lead time 600-3,000 ms, minimum on-screen size 24 CSS px | M-21 | T08.03 | AT-R-P5.2-01 (auto: UT-21-09; manual: LT-015) | Unimplemented |
| R-P5.2-02 | P1 | Chords are drawn with a bar joining their lanes, distinct from single notes | M-21 | T08.03 | AT-R-P5.2-02 (auto: UT-21-11, UT-21-13; manual: LT-015) | Unimplemented |
| R-P5.2-03 | P1 | Hold notes draw a tail whose length equals their duration at the current lead time | M-21 | T08.03 | AT-R-P5.2-03 (auto: UT-21-09, TT-033; manual: LT-015) | Unimplemented |
| R-P5.2-04 | P1 | No UI panel, effect or performer covers the highway hit zone or incoming notes | M-21, M-26 | T08.03 | AT-R-P5.2-04 (manual: LT-009) | Unimplemented |
| R-P5.2-05 | P0 | Judgment windows are fixed per difficulty in Rhythm.WINDOWS and listed on SCR-Help | M-09, M-27 | T03.07 | AT-R-P5.2-05 (auto: UT-09-01, UT-09-06, UT-09-35, IT-037; manual: LT-093) | Unimplemented |
| R-P5.2-06 | P1 | Perfect, Great, Good and Miss appear as text plus a color flash in the frame after the judgment | M-26, M-21 | T08.03 | AT-R-P5.2-06 (auto: UT-26-22; manual: LT-022) | Unimplemented |
| R-P5.2-07 | P0 | Identical input sequences on the same chart produce identical integer ScoreState values | M-09 | T03.08 | AT-R-P5.2-07 (auto: UT-09-27, IT-003; manual: XT-065) | Unimplemented |
| R-P5.2-08 | P1 | Combo is one HUD number with a short pulse only when the multiplier changes (every 10) | M-26 | T08.03 | AT-R-P5.2-08 (auto: UT-26-22, UT-09-08; manual: LT-022) | Unimplemented |
| R-P5.2-09 | P1 | A miss shows a muted flash and lane hint, with no screen shake and no harsh sound | M-26, M-21 | T08.03 | AT-R-P5.2-09 (manual: LT-022) | Unimplemented |
| R-P5.2-10 | P1 | Song end always opens SCR-Results; Restart replays the same chart from tick 0 with count-in | M-27, M-28, M-09 | T08.04 | AT-R-P5.2-10 (auto: UT-28-14, UT-27-21, IT-053; manual: LT-030) | Unimplemented |
| R-P5.2-11 | P0 | While paused no input is judged and no note is triggered | M-09, M-07 | T03.07 | AT-R-P5.2-11 (auto: UT-27-27, UT-09-21; manual: LT-030) | Unimplemented |
| R-P5.2-12 | P0 | Restart creates a fresh ScoreState and Judge cursor; no earlier judgment carries over | M-09 | T08.02 | AT-R-P5.2-12 (auto: UT-09-28; manual: LT-030) | Unimplemented |

P 5.3 Difficulty and fairness:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P5.3-01 | P1 | Each difficulty shows measured metrics (notes per second, chord ratio, window) on the chart preview | M-08, M-27 | T08.01 | AT-R-P5.3-01 (auto: UT-08-33, UT-08-24; manual: LT-028) | Unimplemented |
| R-P5.3-02 | P1 | Beginner charts keep the melody contour and section structure of the source track | M-08 | T08.01 | AT-R-P5.3-02 (auto: UT-08-23, UT-08-26; manual: LT-028) | Unimplemented |
| R-P5.3-03 | P1 | Higher difficulties add density, chords and syncopation taken from the source, never invented notes | M-08 | T08.01 | AT-R-P5.3-03 (auto: UT-08-24, IT-038; manual: LT-028) | Unimplemented |
| R-P5.3-04 | P1 | Chord simplification follows the documented ChartGenerator rules (maximum lanes per difficulty) | M-08 | T08.01 | AT-R-P5.3-04 (auto: UT-08-29, UT-08-34, UT-08-27) | Unimplemented |
| R-P5.3-05 | P1 | Any section can be practiced alone with a loop region and practice speed | M-04, M-27 | T11.09 | AT-R-P5.3-05 (auto: IT-051, UT-28-17, UT-04-15; manual: LT-029) | Unimplemented |
| R-P5.3-06 | P1 | Personal bests and comparisons use only results with an equal chart settingsHash and speed | M-25, M-09 | T10.06 | AT-R-P5.3-06 (auto: UT-25-02, UT-25-03, UT-25-04; manual: LT-029) | Unimplemented |
| R-P5.3-07 | P1 | Calibration shifts timing references only, never window widths; each result records the offsets used | M-09, M-25 | T10.06 | AT-R-P5.3-07 (auto: UT-09-23, UT-09-29, IT-004, UT-25-01; manual: LT-019) | Unimplemented |
| R-P5.3-08 | P1 | Scoring-relevant assists (wider windows, slower speed) mark the result Assisted on SCR-Results and in history | M-25, M-09, M-27 | T10.06 | AT-R-P5.3-08 (auto: UT-27-21, UT-25-03; manual: LT-029) | Unimplemented |

#### 14.2.6 P 6 Audio fidelity and sound quality

P 6 is release-critical (spec statement R-P6-01): an open failure of any P 6.1 to 6.3 row blocks the release in T16.09, whatever its priority.

P 6 Audio fidelity and sound quality (section statement):

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P6-01 | P0 | Audio fidelity (P 6.1 to 6.3) is release-critical: any open failure in these rows blocks the release | M-05, M-06 | T16.09 | AT-R-P6-01 (manual: LT-031; review) | Unimplemented |

P 6.1 Instrument sound:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P6.1-01 | P0 | GM programs 0-127 select the matching entry of Instruments.DEFINITIONS on their channel | M-06 | T04.06 | AT-R-P6.1-01 (auto: UT-06-01, UT-06-04, UT-06-22, IT-006) | Unimplemented |
| R-P6.1-02 | P1 | Each of the 16 family templates is audibly distinct and fits its family, checked by an LT listening review | M-06 | T14.01 | AT-R-P6.1-02 (auto: UT-06-03; manual: LT-031) | Unimplemented |
| R-P6.1-03 | P1 | Every definition declares attack and release; note on and off use ramps >= 2 ms, so no clicks | M-06 | T04.06 | AT-R-P6.1-03 (auto: UT-06-01, UT-06-06; manual: LT-033) | Unimplemented |
| R-P6.1-04 | P1 | Velocity scales gain and filter brightness on synth-velocity programs | M-06 | T04.06 | AT-R-P6.1-04 (auto: UT-06-05; manual: LT-042) | Unimplemented |
| R-P6.1-05 | P1 | Sustained instruments hold until note off or sustain (CC 64) release; voices never end early | M-06, M-05 | T04.06 | AT-R-P6.1-05 (auto: UT-06-15, UT-03-14, TT-031; manual: LT-041) | Unimplemented |
| R-P6.1-06 | P0 | Channel 10 keys 35-81 map to the 12 drum voices; other keys use the misc voice | M-06 | T04.06 | AT-R-P6.1-06 (auto: UT-06-11, UT-06-12, UT-30-06; manual: LT-031) | Unimplemented |
| R-P6.1-07 | P1 | Pitches stay sounding pitch (MusicXML transposition applied at import); out-of-range notes play and log once | M-06, M-12 | T04.06 | AT-R-P6.1-07 (auto: UT-12-16, UT-06-23, FT-061) | Unimplemented |
| R-P6.1-08 | P1 | Program changes take effect at their tick for all later notes on that channel | M-06, M-05 | T07.05 | AT-R-P6.1-08 (auto: UT-06-14, UT-05-19, FT-009) | Unimplemented |
| R-P6.1-09 | P1 | Pitch bend (RPN 0 range, default 2 semitones) and CC 1, 7, 10, 11, 64, 121, 123 behave per the MIDI spec | M-06 | T04.06 | AT-R-P6.1-09 (auto: UT-06-18, UT-05-11, UT-06-21, FT-001; manual: LT-041) | Unimplemented |
| R-P6.1-10 | P0 | Voice allocation stays stable at 64 voices desktop and 32 mobile under dense polyphony | M-05 | T04.03 | AT-R-P6.1-10 (auto: PT-012, UT-05-12, UT-05-13, UT-05-14, IT-040; manual: LT-034) | Unimplemented |
| R-P6.1-11 | P1 | Stealing order released-quietest then oldest, with a 10 ms fade, documented on SCR-About and logged | M-05 | T04.03 | AT-R-P6.1-11 (auto: UT-05-12, UT-05-32; review) | Unimplemented |
| R-P6.1-12 | P1 | A failed instrument definition falls back to its family template, then a basic voice, with a warning | M-06 | T04.06 | AT-R-P6.1-12 (auto: UT-06-19, FI-005) | Unimplemented |

P 6.2 Audio mixing:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P6.2-01 | P1 | Master volume 0-100 % applies through Audio.setMasterGain with a 20 ms ramp in every mode | M-05 | T04.02 | AT-R-P6.2-01 (auto: UT-05-10, UT-05-06; manual: LT-039) | Unimplemented |
| R-P6.2-02 | P1 | Track gain and pan -1..1 on the ChannelStrip apply immediately and are stored in Track.mix | M-05, M-17 | T04.02 | AT-R-P6.2-02 (auto: UT-05-07, UT-05-08, IT-016; manual: LT-039) | Unimplemented |
| R-P6.2-03 | P1 | Mute and solo silence the voices of affected tracks within 20 ms and leave no hanging notes | M-05, M-06 | T04.02 | AT-R-P6.2-03 (auto: UT-05-09, UT-05-10, IT-016; manual: LT-039) | Unimplemented |
| R-P6.2-04 | P1 | The master limiter keeps the output at or below 0 dBFS with 32 tracks at full gain | M-05 | T04.02 | AT-R-P6.2-04 (auto: IT-017, UT-05-06; manual: LT-034) | Unimplemented |
| R-P6.2-05 | P1 | Gain changes ramp over 5-20 ms and stop or panic fades voices over 10 ms, so no clicks or pops | M-05, M-06 | T04.02 | AT-R-P6.2-05 (auto: UT-05-10, UT-05-22, UT-05-25; manual: LT-033) | Unimplemented |
| R-P6.2-06 | P1 | Start and stop never spike volume: voices start from zero gain and stop releases through ramps | M-05, M-06 | T04.02 | AT-R-P6.2-06 (auto: UT-05-25, UT-06-06; manual: LT-033) | Unimplemented |
| R-P6.2-07 | P1 | Metronome volume 0-100 % adjusts through Audio.setMetronomeGain, independent of master | M-05, M-27 | T04.02 | AT-R-P6.2-07 (auto: UT-05-06, UT-05-26; manual: LT-039) | Unimplemented |
| R-P6.2-08 | P1 | Effects add no scheduling latency: reverb is a parallel send and only the limiter sits in series | M-05 | T14.03 | AT-R-P6.2-08 (auto: UT-05-06, UT-05-15; manual: LT-040) | Unimplemented |
| R-P6.2-09 | P1 | Audio stays stable during render slowdowns: 25 ms scheduler tick with 120 ms lookahead, independent of RAF | M-05 | T04.04 | AT-R-P6.2-09 (auto: PT-004, IT-011, TT-020; manual: LT-045) | Unimplemented |
| R-P6.2-10 | P1 | Long sessions keep active voices bounded and memory growth <= 10 MB after 20 enter-leave cycles | M-05, M-06, M-28 | T14.07 | AT-R-P6.2-10 (auto: PT-022, PT-011, UT-05-21; manual: LT-086) | Unimplemented |

P 6.3 Audio timing:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P6.3-01 | P0 | Playback follows TempoMap ticks on the audio clock; frame count never advances musical time | M-04, M-05 | T02.04 | AT-R-P6.3-01 (auto: IT-013, IT-039, UT-18-20, UT-04-05) | Unimplemented |
| R-P6.3-02 | P0 | Tempo changes cause no cumulative drift: absolute drift < 2 ms after a 10 min loop | M-03, M-04 | T02.07 | AT-R-P6.3-02 (auto: TT-004, TT-005, TT-014, UT-04-20, PT-008; manual: LT-037) | Unimplemented |
| R-P6.3-03 | P0 | Resume continues from the paused tick; the song is not shifted by more than 1 ms | M-04 | T02.04 | AT-R-P6.3-03 (auto: TT-006, TT-007, TT-008, UT-04-07) | Unimplemented |
| R-P6.3-04 | P0 | Seek cancels scheduled future events, releases sounding voices and reschedules from the new tick | M-04, M-05 | T04.04 | AT-R-P6.3-04 (auto: TT-009, TT-010, UT-04-08, UT-05-24) | Unimplemented |
| R-P6.3-05 | P0 | At a loop wrap, notes sounding are released at the loop end; only note-ons inside the loop retrigger | M-04, M-05 | T02.05 | AT-R-P6.3-05 (auto: TT-011, TT-012, TT-013, UT-04-16, UT-04-17, UT-05-31) | Unimplemented |
| R-P6.3-06 | P0 | On return from background the drift check re-anchors when cursor and audio position differ by > 5 ms | M-28, M-04, M-05 | T04.04 | AT-R-P6.3-06 (auto: TT-021, TT-022, UT-04-22, FI-034; manual: XT-043, XT-046) | Unimplemented |
| R-P6.3-07 | P0 | Each Calibration offset is applied exactly once: input in Rhythm.Judge, visual lead in the Highway | M-09, M-07, M-21 | T03.07 | AT-R-P6.3-07 (auto: TT-023, TT-024, IT-035, UT-09-23, UT-07-32; manual: LT-017) | Unimplemented |
| R-P6.3-08 | P0 | Scheduling (setInterval) and rendering (RAF) run independently; RAF only reads Transport.positionAt | M-04, M-05, M-18 | T05.03 | AT-R-P6.3-08 (auto: UT-18-20, IT-013, TT-019, TT-020) | Unimplemented |
| R-P6.3-09 | P0 | Timing tests include a dense arrangement (8 tracks, 16-note chords) and a sparse one (1 note per 4 bars) | M-31 | T02.07 | AT-R-P6.3-09 (auto: TT-001, TT-028, PT-004; review) | Unimplemented |
| R-P6.3-10 | P0 | Timing tests include the 10 min loop drift run and a 30 min continuous playback run | M-31, `tools/perf.mjs` | T14.07 | AT-R-P6.3-10 (auto: TT-004, PT-008, PT-022) | Unimplemented |

#### 14.2.7 P 7 3D stage and visualizer

P 7.1 Scene quality:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P7.1-01 | P1 | The stage has one focal performer area framed by backdrop, lighting truss and floor | M-21 | T05.07 | AT-R-P7.1-01 (auto: UT-21-04; manual: LT-049) | Unimplemented |
| R-P7.1-02 | P1 | Directional key light plus ambient keeps every performer readable on every tier | M-18, M-21 | T05.07 | AT-R-P7.1-02 (manual: LT-049, LT-047) | Unimplemented |
| R-P7.1-03 | P1 | Lambert materials respond to the directional and point lights; the Abstract tier uses flat fills | M-18 | T05.02 | AT-R-P7.1-03 (auto: UT-18-11; manual: LT-049) | Unimplemented |
| R-P7.1-04 | P1 | Camera motion is eased and jitter-free, with speed and acceleration limits per preset | M-21, M-20 | T05.07 | AT-R-P7.1-04 (auto: UT-18-23; manual: LT-046) | Unimplemented |
| R-P7.1-05 | P1 | Stage elements never occlude the highway or HUD: the highway draws last without depth test | M-21 | T05.09 | AT-R-P7.1-05 (manual: LT-009, LT-049; review) | Unimplemented |
| R-P7.1-06 | P1 | Effects fire only on sched.noteOn, beats and section markers; no idle looping effects | M-21, M-20 | T05.07 | AT-R-P7.1-06 (auto: UT-21-15, UT-21-14; manual: LT-049) | Unimplemented |
| R-P7.1-07 | P1 | Background geometry is static and low-contrast; motion is reserved for active performers | M-21 | T05.07 | AT-R-P7.1-07 (manual: LT-049) | Unimplemented |
| R-P7.1-08 | P1 | Stage SLOTS keep 1 to 5 performers centered and balanced for every count | M-21 | T05.07 | AT-R-P7.1-08 (auto: UT-21-01, UT-21-02, UT-21-05; manual: LT-044) | Unimplemented |
| R-P7.1-09 | P1 | At 360 px width the full-band camera fits all performers and the highway stays readable | M-21 | T05.07 | AT-R-P7.1-09 (auto: UT-21-05; manual: LT-044) | Unimplemented |
| R-P7.1-10 | P1 | Low and Abstract tiers use designed reduced looks (fewer lights, flat stage, visualizers), never broken views | M-18, M-20, M-21 | T05.07 | AT-R-P7.1-10 (auto: UT-20-32, UT-18-09; manual: LT-047) | Unimplemented |

P 7.2 Character animation:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P7.2-01 | P1 | Joint rotations are smoothed; no joint jumps more than 30 degrees in one frame outside a beat-aligned cut | M-19, M-20 | T05.04 | AT-R-P7.2-01 (auto: UT-19-05, UT-20-24; manual: LT-043) | Unimplemented |
| R-P7.2-02 | P1 | Hands stay on instrument attachment points through two-bone IK every frame | M-19, M-20 | T05.04 | AT-R-P7.2-02 (auto: UT-19-04, UT-19-06, UT-19-07; manual: LT-043) | Unimplemented |
| R-P7.2-03 | P1 | Feet stay planted unless a step or dance move moves them; no root sliding | M-19, M-20 | T05.04 | AT-R-P7.2-03 (manual: LT-043) | Unimplemented |
| R-P7.2-04 | P1 | Each instrument family uses its own controller (keys, guitar, bass, drums, strings, winds, synth and others) | M-20 | T05.05 | AT-R-P7.2-04 (auto: UT-20-01, UT-20-02, UT-20-31; manual: LT-043) | Unimplemented |
| R-P7.2-05 | P0 | Gestures are timed to sched.noteOn with 120 ms anticipation and scaled by note velocity | M-20 | T05.05 | AT-R-P7.2-05 (auto: UT-20-04, UT-20-09, UT-20-22, UT-20-25, IT-009; manual: LT-043) | Unimplemented |
| R-P7.2-06 | P1 | Sustained notes hold the playing pose until their noteOff | M-20 | T05.05 | AT-R-P7.2-06 (auto: UT-20-09, UT-20-15; manual: LT-043) | Unimplemented |
| R-P7.2-07 | P1 | During rests performers settle to idle within 500 ms and keep only breathing motion | M-20 | T05.05 | AT-R-P7.2-07 (auto: UT-20-18, IT-034; manual: LT-043) | Unimplemented |
| R-P7.2-08 | P1 | Idle, playing and transition states blend over 150-300 ms | M-20, M-19 | T05.05 | AT-R-P7.2-08 (auto: UT-19-05; manual: LT-043) | Unimplemented |
| R-P7.2-09 | P1 | Each performer moves from its own track events plus a per-slot phase seed, so different parts look different | M-20 | T05.05 | AT-R-P7.2-09 (auto: UT-20-20; manual: LT-043) | Unimplemented |
| R-P7.2-10 | P1 | Every CharacterConfig option keeps a valid rig: Rig.validateAttachments passes for all combinations | M-19, M-22 | T10.02 | AT-R-P7.2-10 (auto: UT-19-14, UT-22-01, IT-022) | Unimplemented |
| R-P7.2-11 | P0 | Poses are computed from positionAt(audio now) each frame, so frame drops skip motion and never lag it | M-20 | T05.05 | AT-R-P7.2-11 (auto: UT-20-19, IT-034, IT-013) | Unimplemented |

P 7.3 Cameras and stage direction:

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P7.3-01 | P1 | The full-band camera preset frames every active performer | M-21 | T05.08 | AT-R-P7.3-01 (auto: UT-21-05; manual: LT-044) | Unimplemented |
| R-P7.3-02 | P1 | Focus presets center and enlarge the soloing or selected performer | M-21, M-20 | T05.08 | AT-R-P7.3-02 (auto: UT-21-06; manual: LT-046) | Unimplemented |
| R-P7.3-03 | P1 | Camera transitions ease over >= 400 ms; hard cuts only on a beat and at most one per bar | M-20, M-21 | T05.08 | AT-R-P7.3-03 (auto: UT-20-26, UT-18-23; manual: LT-046) | Unimplemented |
| R-P7.3-04 | P1 | Solo highlighting follows StageDirector analysis of note density per track per section | M-20 | T05.08 | AT-R-P7.3-04 (auto: UT-20-26, UT-20-27; manual: LT-046) | Unimplemented |
| R-P7.3-05 | P1 | StageDirector cuts are deterministic for the same song and settings (seeded from the song id) | M-20 | T05.08 | AT-R-P7.3-05 (auto: UT-20-26; manual: LT-046) | Unimplemented |
| R-P7.3-06 | P1 | Camera motion setting: full, reduced (no automatic cuts, slow eases) or off (one static preset) | M-21, M-26 | T05.08 | AT-R-P7.3-06 (auto: UT-20-27; manual: LT-046) | Unimplemented |
| R-P7.3-07 | P1 | The highway and HUD stay visible in every camera preset and during transitions | M-21 | T05.08 | AT-R-P7.3-07 (manual: LT-009) | Unimplemented |
| R-P7.3-08 | P1 | Camera changes never alter Transport position or animation time | M-20, M-21 | T05.08 | AT-R-P7.3-08 (auto: UT-21-07; manual: LT-046) | Unimplemented |

#### 14.2.8 P 8 Character customization

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P8-01 | P1 | Every customization option visibly changes the preview; options without a visible effect are not offered | M-22, M-27 | T10.04 | AT-R-P8-01 (auto: UT-22-01, UT-22-07; manual: LT-051) | Unimplemented |
| R-P8-02 | P1 | The 8 built-in presets load, pass Character.validate and render as previewed | M-22, M-30 | T10.03 | AT-R-P8-02 (auto: UT-22-08, UT-30-12; manual: LT-051) | Unimplemented |
| R-P8-03 | P1 | Randomize draws only from the OPTIONS catalog and always yields a valid CharacterConfig | M-22 | T10.01 | AT-R-P8-03 (auto: UT-22-10; manual: LT-051) | Unimplemented |
| R-P8-04 | P1 | Preview updates in the next frame for visual-only changes and within 100 ms for rig-affecting ones | M-22, M-19, M-27 | T10.04 | AT-R-P8-04 (auto: UT-19-16, UT-19-17, UT-22-14; manual: LT-051) | Unimplemented |
| R-P8-05 | P1 | Characters persist in the IndexedDB characters store and inside projects | M-16, M-22 | T10.05 | AT-R-P8-05 (auto: UT-22-16, IT-022, IT-024, FT-104; manual: LT-052) | Unimplemented |
| R-P8-06 | P1 | Every CharacterConfig works with every instrument controller and its attachment set | M-19, M-20, M-22 | T10.02 | AT-R-P8-06 (auto: UT-21-03, UT-19-14, IT-022; manual: LT-052) | Unimplemented |
| R-P8-07 | P1 | Skin, clothing colors and materials render correctly under stage lighting on every tier | M-18, M-22 | T10.04 | AT-R-P8-07 (auto: UT-22-07; manual: LT-051) | Unimplemented |
| R-P8-08 | P1 | Accessories mount on attachment points with per-body offsets; no visible body or instrument intersection | M-19, M-22 | T10.02 | AT-R-P8-08 (auto: UT-22-05, UT-19-04; manual: LT-051) | Unimplemented |
| R-P8-09 | P1 | Invalid combinations are rejected by Character.validate or repaired by normalize, with a message | M-22, M-27 | T10.01 | AT-R-P8-09 (auto: UT-22-03, UT-22-04, UT-22-06, UT-22-12) | Unimplemented |
| R-P8-10 | P1 | Multiplayer avatars use Character.forNet (<= 4 KB) and render identically on every peer | M-22, M-24 | T13.05 | AT-R-P8-10 (auto: UT-22-13, UT-24-35, IT-025; manual: XT-063) | Unimplemented |
| R-P8-11 | P1 | Character changes rebuild only the affected rig; the application never reloads | M-19, M-22 | T10.05 | AT-R-P8-11 (auto: IT-023, UT-21-16) | Unimplemented |
| R-P8-12 | P1 | SCR-Characters holds >= 30 FPS on mobile Balanced tier with a single-performer preview | M-27, M-18 | T10.04 | AT-R-P8-12 (manual: LT-051) | Unimplemented |

#### 14.2.9 P 9 Free Play and music theory

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P9-01 | P0 | All 12 keys and every Theory.SCALES pattern map to the correct pitches in profiles B, C and D | M-02, M-08 | T06.01 | AT-R-P9-01 (auto: UT-02-08, UT-08-03, UT-08-04, UT-08-06; manual: LT-027) | Unimplemented |
| R-P9-02 | P1 | Octave keys KeyQ and KeyE shift by 12 semitones within MIDI 0-127, shown in the HUD | M-08, M-26 | T06.03 | AT-R-P9-02 (auto: UT-08-02, UT-08-10; manual: LT-027) | Unimplemented |
| R-P9-03 | P0 | Chord inversions (root, first, second, third) produce exactly the notes Theory.invert returns | M-02, M-08 | T03.06 | AT-R-P9-03 (auto: UT-08-05, UT-02-13; manual: LT-027) | Unimplemented |
| R-P9-04 | P0 | All notes of one press start at the same audio time | M-06, M-08 | T06.04 | AT-R-P9-04 (auto: UT-05-30, TT-028, IT-005) | Unimplemented |
| R-P9-05 | P1 | Scale-constrained and chromatic mappings are labeled in the HUD and on SCR-FreePlay settings | M-26, M-27 | T06.06 | AT-R-P9-05 (manual: LT-027) | Unimplemented |
| R-P9-06 | P1 | Free Play recording quantize is optional (default off) and names its grid in note values | M-17, M-27 | T06.05 | AT-R-P9-06 (auto: UT-08-17, UT-15-23; manual: LT-027) | Unimplemented |
| R-P9-07 | P1 | Metronome clicks land on the beats of the selected tempo within 1 ms of scheduled time | M-05 | T06.02 | AT-R-P9-07 (auto: UT-05-26, UT-04-11, TT-016; manual: LT-038) | Unimplemented |
| R-P9-08 | P1 | Notes sound while held; the HUD Sustain toggle holds released notes until it is turned off | M-08, M-06 | T06.03 | AT-R-P9-08 (auto: UT-08-14, UT-06-15; manual: LT-027) | Unimplemented |
| R-P9-09 | P0 | Changing instrument releases the held notes of the previous instrument first | M-06, M-08 | T06.04 | AT-R-P9-09 (auto: UT-06-17, UT-08-19; manual: LT-027) | Unimplemented |
| R-P9-10 | P0 | Free Play works with no chart loaded | M-08, M-28 | T06.06 | AT-R-P9-10 (auto: UT-28-01, IT-001) | Unimplemented |
| R-P9-11 | P0 | Free Play performances are recorded by the Recorder and replay as a take | M-17 | T06.05 | AT-R-P9-11 (auto: UT-17-06, IT-014; manual: LT-053) | Unimplemented |
| R-P9-12 | P1 | Key and scale changes relabel the lanes at once and apply from the next press | M-08, M-26 | T06.06 | AT-R-P9-12 (auto: UT-26-21; manual: LT-027) | Unimplemented |

#### 14.2.10 P 10 Studio and recording

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P10-01 | P0 | Recording starts at count-in end and stops on Stop; every Recorder state change is logged | M-17, M-04 | T09.06 | AT-R-P10-01 (auto: UT-17-05, UT-04-12, TT-030; manual: LT-053) | Unimplemented |
| R-P10-02 | P0 | Count-in of 1 or 2 bars plays the metronome accented on beat 1; take ticks start at count-in end | M-04, M-05, M-17 | T09.06 | AT-R-P10-02 (auto: UT-04-11, UT-17-05, TT-030; manual: LT-038) | Unimplemented |
| R-P10-03 | P1 | Overdub takes align to existing tracks within 1 tick at PPQ 960 with input calibration applied once | M-17, M-07 | T09.06 | AT-R-P10-03 (auto: UT-17-11, TT-023, IT-015; manual: LT-054) | Unimplemented |
| R-P10-04 | P1 | Each track keeps its own program and channel; changing one never alters another | M-17, M-06 | T09.05 | AT-R-P10-04 (auto: UT-15-06, IT-016; manual: LT-054) | Unimplemented |
| R-P10-05 | P1 | Mute, solo, volume and pan behave identically in Studio and in every playback mode | M-17, M-05 | T09.09 | AT-R-P10-05 (auto: UT-17-25, IT-016; manual: LT-039) | Unimplemented |
| R-P10-06 | P1 | The timeline ruler shows bars and beats from MeterMap and TempoMap at every zoom level | M-27, M-03 | T09.08 | AT-R-P10-06 (auto: UT-03-19; manual: LT-055) | Unimplemented |
| R-P10-07 | P1 | Piano roll selects by click, box and keyboard; edits snap to the grid, or to 1 tick when snap is off | M-17, M-27 | T09.08 | AT-R-P10-07 (auto: UT-17-29, UT-17-21; manual: LT-055) | Unimplemented |
| R-P10-08 | P1 | With quantize off, recorded ticks are stored exactly as captured | M-17 | T09.06 | AT-R-P10-08 (auto: UT-17-06, UT-08-17) | Unimplemented |
| R-P10-09 | P1 | Undo and redo restore the exact prior state for every command (UndoStack limit 100) | M-15 | T09.02 | AT-R-P10-09 (auto: UT-15-18, UT-15-20, IT-018; manual: LT-055) | Unimplemented |
| R-P10-10 | P1 | Destructive operations (delete track, clear take, replace project) ask for confirmation and are undoable | M-17, M-26, M-15 | T09.13 | AT-R-P10-10 (auto: UT-15-07, UT-26-09; manual: LT-062) | Unimplemented |
| R-P10-11 | P1 | Deleting a playing track releases its voices; deleting the recording track aborts the take first | M-17, M-05 | T09.05 | AT-R-P10-11 (auto: UT-17-14, UT-06-24) | Unimplemented |
| R-P10-12 | P0 | An aborted or failed take never replaces the previous complete take (status aborted kept apart) | M-17, M-15 | T09.07 | AT-R-P10-12 (auto: UT-17-08, UT-17-12, FI-002; manual: LT-056) | Unimplemented |
| R-P10-13 | P1 | Projects with 32 tracks and 100k events stay editable; the piano roll draws only visible notes | M-17, M-27 | T09.08 | AT-R-P10-13 (auto: PT-013, UT-17-30; manual: LT-089) | Unimplemented |
| R-P10-14 | P0 | Save and load round-trip every supported field of the flm-project v1 schema | M-15, M-16 | T09.10 | AT-R-P10-14 (auto: UT-15-04, UT-15-30, FT-111; manual: LT-057) | Unimplemented |
| R-P10-15 | P1 | Exported .mid opens in standard MIDI tools; exported .flm.json reopens in this game unchanged | M-10, M-15, M-16 | T09.10 | AT-R-P10-15 (auto: FT-110, FT-107, UT-10-34; manual: LT-058) | Unimplemented |

#### 14.2.11 P 11 Music import and compatibility

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P11-01 | P1 | The file picker accept list and hint name .mid .midi .xml .musicxml .mxl .gp3 .gp4 .gp5 and audio types | M-14, M-27 | T07.09 | AT-R-P11-01 (auto: UT-27-03; manual: LT-067) | Unimplemented |
| R-P11-02 | P1 | Import shows progress from import.progress (bytes or events parsed) when it lasts over 300 ms | M-14, M-27 | T07.08 | AT-R-P11-02 (auto: UT-14-12; manual: LT-066) | Unimplemented |
| R-P11-03 | P0 | Invalid files produce an error naming the file, the problem and what to try next | M-14, M-10, M-27 | T07.03 | AT-R-P11-03 (auto: FT-025, FT-032, FT-055, FT-082, FT-103, IT-041; manual: LT-066) | Unimplemented |
| R-P11-04 | P0 | Every MIDI set-tempo event lands in the TempoMap and drives playback timing | M-10, M-03 | T07.02 | AT-R-P11-04 (auto: FT-016, UT-10-24, IT-007; manual: LT-036) | Unimplemented |
| R-P11-05 | P1 | Multitrack files keep every track (up to 128) with its name and channel | M-10, M-14 | T07.02 | AT-R-P11-05 (auto: FT-010, FT-047, UT-10-28, IT-006) | Unimplemented |
| R-P11-06 | P0 | Overlapping notes stay polyphonic; note pairing never truncates chords | M-03, M-10 | T07.02 | AT-R-P11-06 (auto: FT-012, FT-014, UT-03-11, UT-10-12, IT-008) | Unimplemented |
| R-P11-07 | P1 | Program, bank and channel 10 percussion assignments are preserved per track | M-10, M-14 | T07.02 | AT-R-P11-07 (auto: FT-002, FT-009, UT-10-29, UT-10-30) | Unimplemented |
| R-P11-08 | P1 | Unsupported events (SysEx, unknown meta) produce ImportWarning entries shown in the InspectionReport | M-10, M-14 | T07.02 | AT-R-P11-08 (auto: FT-019, UT-10-39, UT-14-05, UT-27-19; manual: LT-065) | Unimplemented |
| R-P11-09 | P1 | MusicXML keeps notes, ties, tempo, dynamics, parts and transposition; each loss produces a warning | M-12, M-14 | T12.03 | AT-R-P11-09 (auto: FT-050, FT-053, FT-054, FT-061, FT-062, UT-12-08, UT-12-24; manual: LT-063) | Unimplemented |
| R-P11-10 | P1 | Guitar Pro import accepts GP3, GP4 and GP5 only; .gpx and .gp are refused as Unsupported | M-13, M-14 | T12.04 | AT-R-P11-10 (auto: FT-075, FT-076, FT-080, FT-088, FT-089, FT-074, UT-13-01, UT-13-02; manual: LT-064) | Unimplemented |
| R-P11-11 | P0 | Audio files become audio tracks only, never note events or charts | M-14 | T12.07 | AT-R-P11-11 (auto: FT-093, UT-14-15, UT-14-16; manual: LT-065) | Unimplemented |
| R-P11-12 | P0 | Files over 25 MB (audio 100 MB), 1,000,000 events or 128 tracks are refused; parsing aborts after 5 s | M-14, M-10 | T07.03 | AT-R-P11-12 (auto: FT-042, FT-038, FT-036, FT-039, FT-044, UT-10-31, UT-10-32, PT-014; manual: LT-066) | Unimplemented |
| R-P11-13 | P0 | Importing over unsaved work asks Save, Discard or Cancel before the project is replaced | M-14, M-26, M-15 | T09.13 | AT-R-P11-13 (auto: IT-042, UT-27-24; manual: LT-006) | Unimplemented |
| R-P11-14 | P1 | Source events stay in the Song (lockedSource) after chart generation; ChartNote keeps sourceEventIds | M-08, M-03 | T08.01 | AT-R-P11-14 (auto: IT-038, UT-15-02, UT-23-32) | Unimplemented |
| R-P11-15 | P1 | SCR-ImportInspect previews the generated chart with audio before play starts | M-14, M-08, M-27 | T07.08 | AT-R-P11-15 (auto: UT-27-19, UT-27-20; manual: LT-065) | Unimplemented |
| R-P11-16 | P1 | Supported formats and known limits are listed in docs/COMPATIBILITY.md and on SCR-About | M-14, M-27, `docs/COMPATIBILITY.md` | T12.08 | AT-R-P11-16 (auto: UT-14-19, FT-095; review) | Unimplemented |

#### 14.2.12 P 12 Dance mode

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P12-01 | P1 | Step arrows stay readable at every lead time and reach the hit zone at their tick time within 1 frame | M-23, M-21 | T11.07 | AT-R-P12-01 (auto: UT-21-08, UT-21-21, TT-033; manual: LT-015, LT-071) | Unimplemented |
| R-P12-02 | P1 | Dance controls work on keyboard (arrows and D F J K), touch pads and gamepad | M-23, M-07, M-26 | T11.03 | AT-R-P12-02 (auto: UT-23-01, UT-07-22, IT-019; manual: LT-069) | Unimplemented |
| R-P12-03 | P1 | Simultaneous steps (two directions in one DanceStep) are judged as one step | M-23 | T11.04 | AT-R-P12-03 (auto: UT-23-21, UT-09-33; manual: LT-069) | Unimplemented |
| R-P12-04 | P1 | Dance holds are judged at head and release with the same windows as instrument holds | M-23, M-09 | T11.04 | AT-R-P12-04 (auto: UT-23-22, UT-09-17, UT-09-19, TT-036; manual: LT-069) | Unimplemented |
| R-P12-05 | P1 | ChoreographyController moves follow the DanceChart step ticks | M-23, M-20 | T11.05 | AT-R-P12-05 (auto: UT-23-26, IT-020; manual: LT-070) | Unimplemented |
| R-P12-06 | P1 | Easy, normal and hard differ in measured step density and jump ratio, shown on the chart preview | M-23, M-27 | T11.02 | AT-R-P12-06 (auto: UT-23-10, UT-23-11, UT-23-12; manual: LT-069) | Unimplemented |
| R-P12-07 | P1 | The dance HUD (arrow receptors, dance score panel) is laid out distinctly from the instrument HUD | M-26, M-27 | T11.07, T11.08 | AT-R-P12-07 (auto: UT-23-33, UT-26-22; manual: LT-071) | Unimplemented |
| R-P12-08 | P1 | Practice speed and loop regions work in Dance Mode with judgments still on song time | M-23, M-04 | T11.09 | AT-R-P12-08 (auto: UT-23-25, UT-09-35; manual: LT-072) | Unimplemented |
| R-P12-09 | P1 | DanceChart validation runs before play; an invalid chart shows its error and does not start | M-23, M-27 | T11.08 | AT-R-P12-09 (auto: UT-23-02, UT-23-03, UT-23-04, UT-23-29) | Unimplemented |
| R-P12-10 | P1 | Missing or failing choreography falls back to idle dance motion while scoring continues | M-23, M-20 | T11.05 | AT-R-P12-10 (auto: IT-021, UT-23-27) | Unimplemented |
| R-P12-11 | P1 | Reduced motion limits choreography to small moves and disables camera sweeps | M-23, M-20, M-26 | T11.05 | AT-R-P12-11 (auto: UT-20-29; manual: LT-048) | Unimplemented |
| R-P12-12 | P1 | Pause and restart in Dance Mode behave exactly as in instrument play (frozen or fresh state) | M-23, M-28 | T11.08 | AT-R-P12-12 (auto: UT-23-22, UT-23-24, UT-09-28; manual: LT-072) | Unimplemented |

#### 14.2.13 P 13 Multiplayer

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P13-01 | P1 | Create and join flows show numbered steps with Copy and Paste buttons for invite and answer codes | M-24, M-27 | T13.03 | AT-R-P13-01 (auto: UT-27-22, UT-27-23; manual: LT-073) | Unimplemented |
| R-P13-02 | P1 | Lobby and stage label every player with name, instrument and avatar | M-24, M-27, M-21 | T13.05 | AT-R-P13-02 (auto: UT-27-22; manual: LT-073, XT-063) | Unimplemented |
| R-P13-03 | P1 | The host sends one shared-clock start time at least 1.5 s ahead; every peer starts from it | M-24, M-04 | T13.04 | AT-R-P13-03 (auto: UT-24-19, UT-24-20, IT-025, PT-020) | Unimplemented |
| R-P13-04 | P1 | Timing uses Net.Clock offsets (8 samples, then every 10 s), never message arrival time alone | M-24 | T13.04 | AT-R-P13-04 (auto: UT-24-11, UT-24-12, UT-24-13, FI-024, PT-020) | Unimplemented |
| R-P13-05 | P1 | Reconnection restores the player's slot, scores and position from the host's authoritative state | M-24 | T13.07 | AT-R-P13-05 (auto: UT-24-26, IT-027, FI-020; manual: LT-076) | Unimplemented |
| R-P13-06 | P1 | Host departure ends the session and shows guests their results (host migration Deferred) | M-24, M-27 | T13.07 | AT-R-P13-06 (auto: UT-24-28, FI-021; manual: LT-076) | Unimplemented |
| R-P13-07 | P1 | Every NetMessage carries seq; duplicate or stale messages are dropped without changing state | M-24 | T13.02 | AT-R-P13-07 (auto: UT-24-08, UT-24-09, FI-025, FI-026) | Unimplemented |
| R-P13-08 | P1 | The host judges every player against the same chart settingsHash and judgment windows | M-24, M-09 | T13.05, T13.06 | AT-R-P13-08 (auto: UT-24-22, UT-28-16, IT-026) | Unimplemented |
| R-P13-09 | P2 | Collaborative Studio conflict handling is specified (Part 6.24 rules); the feature is not built in v1 | M-24 | T13.11 | no AT (P2, Deferred); review: STATUS.md section 3 row, UT-24-38, LT-091 | Deferred |
| R-P13-10 | P0 | Invalid, oversized (> 64 KB) or rate-exceeding (> 60 per s) messages are rejected and logged | M-24 | T13.02 | AT-R-P13-10 (auto: UT-24-03, UT-24-04, UT-24-05, UT-24-15, UT-24-16, IT-028) | Unimplemented |
| R-P13-11 | P1 | Network errors show DLG-NetError naming the failed step and a next action | M-24, M-27 | T13.09 | AT-R-P13-11 (auto: UT-24-39, FI-023; manual: XT-064) | Unimplemented |
| R-P13-12 | P0 | Any multiplayer failure leaves every local mode fully usable | M-24, M-28 | T13.09 | AT-R-P13-12 (auto: IT-030, IT-031, IT-027; manual: LT-077) | Unimplemented |
| R-P13-13 | P1 | SCR-Multiplayer states what data is sent and to whom (Net.PRIVACY_TEXT) | M-24, M-27 | T13.09 | AT-R-P13-13 (auto: UT-24-35; manual: LT-073) | Unimplemented |
| R-P13-14 | P1 | Relay server requirements and operating limits are documented in README.md and on SCR-About | M-24, `server/relay.mjs` | T13.08 | AT-R-P13-14 (manual: LT-095; review) | Unimplemented |

#### 14.2.14 P 14 Mobile and responsive polish

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P14-01 | P1 | Essential controls have hit areas >= 44x44 CSS px in menus and >= 56x56 for gameplay pads | M-26 | T01.06 | AT-R-P14-01 (auto: PT-024, UT-26-18, UT-26-19; manual: XT-075) | Unimplemented |
| R-P14-02 | P1 | Touch targets keep gaps of at least 8 px | M-26 | T01.06 | AT-R-P14-02 (auto: PT-024, UT-26-18; manual: XT-075) | Unimplemented |
| R-P14-03 | P1 | Four simultaneous touches register on supported devices, with the Touch Events fallback of OQ-1 | M-07 | T03.02 | AT-R-P14-03 (auto: UT-07-20, IT-002; manual: XT-011, XT-012, XT-013, XT-014, XT-015) | Unimplemented |
| R-P14-04 | P0 | pointercancel, touchcancel and interrupted gestures release every active pad | M-07, M-26 | T03.03 | AT-R-P14-04 (auto: UT-07-19, FI-029; manual: XT-016, XT-017, XT-018, XT-019) | Unimplemented |
| R-P14-05 | P1 | Portrait and landscape each have a designed layout with orientation-specific pad placement | M-26 | T01.06 | AT-R-P14-05 (auto: UT-26-16, UT-26-18, UT-26-19, PT-024; manual: XT-040) | Unimplemented |
| R-P14-06 | P1 | Safe-area insets pad the HUD, touch pads and dialogs | M-26, `src/shell.html` | T01.06 | AT-R-P14-06 (manual: LT-010) | Unimplemented |
| R-P14-07 | P1 | Layout height follows the visual viewport (dvh with fallback) so browser bars never hide controls | M-26 | T01.06 | AT-R-P14-07 (manual: LT-010) | Unimplemented |
| R-P14-08 | P1 | Orientation changes relayout without stopping, seeking or re-anchoring the Transport | M-26, M-28 | T14.06 | AT-R-P14-08 (auto: UT-26-16; manual: XT-040, XT-041, XT-042) | Unimplemented |
| R-P14-09 | P0 | Audio unlocks through Audio.unlock on the first pointerup or keydown, including on iOS Safari | M-05, M-29 | T04.01 | AT-R-P14-09 (auto: UT-05-01, UT-29-09; manual: XT-006, XT-007, XT-008, XT-009, XT-010) | Unimplemented |
| R-P14-10 | P1 | UI scale 0.85-1.5 keeps text legible and layouts intact | M-26 | T01.07 | AT-R-P14-10 (auto: UT-26-17; manual: XT-076) | Unimplemented |
| R-P14-11 | P1 | Mobile devices start on the Balanced or Low tier chosen by Render.pickTier | M-18 | T05.01 | AT-R-P14-11 (auto: UT-18-08, UT-28-20; manual: LT-087, XT-038, XT-039) | Unimplemented |
| R-P14-12 | P1 | Mobile steady memory <= 150 MB is measured on a mid-range physical device | M-18, M-05, `tools/perf.mjs` | T15.06 | AT-R-P14-12 (auto: PT-010; manual: LT-086) | Unimplemented |
| R-P14-13 | P1 | Returning from background keeps the paused state, re-anchors clocks and restores GL if it was lost | M-28, M-04, M-18 | T14.06 | AT-R-P14-13 (auto: TT-021, UT-28-09, UT-28-12, FI-009; manual: XT-046, XT-047) | Unimplemented |
| R-P14-14 | P1 | Menus, dialogs, sliders and editors are fully usable by touch or keyboard without a mouse | M-26 | T01.07 | AT-R-P14-14 (auto: UT-26-13; manual: LT-079, LT-083, LT-061) | Unimplemented |

#### 14.2.15 P 15 Accessibility and interaction details

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P15-01 | P1 | All core actions are reachable by keyboard, touch and gamepad | M-07, M-26 | T01.07 | AT-R-P15-01 (manual: LT-079, LT-083, LT-026) | Unimplemented |
| R-P15-02 | P1 | Every focusable element shows a visible focus ring (>= 2 px, >= 3:1 contrast) | M-26 | T01.07 | AT-R-P15-02 (manual: LT-013, LT-079) | Unimplemented |
| R-P15-03 | P1 | Dialogs trap focus, close on Escape and restore focus on close | M-26 | T01.07 | AT-R-P15-03 (auto: UT-26-08, UT-26-09; manual: LT-081) | Unimplemented |
| R-P15-04 | P1 | Lanes, judgments and status use shape and text in addition to color | M-21, M-26 | T08.03 | AT-R-P15-04 (auto: UT-26-21; manual: LT-014) | Unimplemented |
| R-P15-05 | P1 | Reduced motion (setting or prefers-reduced-motion) disables non-essential animation | M-26, M-20 | T01.07 | AT-R-P15-05 (auto: UT-26-26, UT-20-29; manual: LT-048) | Unimplemented |
| R-P15-06 | P1 | Text stays readable at UI scale 0.85-1.5 and at 200 % browser zoom | M-26 | T01.07 | AT-R-P15-06 (auto: UT-26-17; manual: XT-076) | Unimplemented |
| R-P15-07 | P1 | Every interactive control has an accessible name and role; status changes use an aria-live region | M-26 | T01.07 | AT-R-P15-07 (manual: LT-080) | Unimplemented |
| R-P15-08 | P1 | Error messages name the operation that failed (for example "Save failed: ...") | M-01, M-27 | T01.04 | AT-R-P15-08 (auto: UT-27-26, UT-27-18; manual: LT-092) | Unimplemented |
| R-P15-09 | P1 | Disabled controls show a one-line reason for being unavailable | M-26 | T01.07 | AT-R-P15-09 (auto: UT-26-14, UT-27-02; manual: LT-080) | Unimplemented |
| R-P15-10 | P1 | Timing window scale and difficulty are adjustable where the mode allows; changed values mark Assisted | M-09, M-27 | T08.02 | AT-R-P15-10 (auto: UT-09-24, UT-27-21; manual: LT-029) | Unimplemented |
| R-P15-11 | P1 | Accessibility settings persist across sessions through Storage.saveSettings | M-16, M-26 | T08.07 | AT-R-P15-11 (auto: IT-060, UT-27-15; manual: LT-085) | Unimplemented |
| R-P15-12 | P1 | Reduced effects keep judgment flashes, lane highlights and note motion intact | M-21, M-26 | T05.09 | AT-R-P15-12 (auto: UT-20-29; manual: LT-048) | Unimplemented |

#### 14.2.16 P 16 Persistence and project safety

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P16-01 | P0 | Save reports success only after read-back verification of the written record | M-16 | T09.03 | AT-R-P16-01 (auto: UT-16-07, UT-16-12, UT-16-13, FI-017, IT-044, PT-017) | Unimplemented |
| R-P16-02 | P0 | A failed save leaves the previously saved version and its .bak intact | M-16 | T09.03 | AT-R-P16-02 (auto: UT-16-07, FI-013, FI-016, FI-018, FI-019) | Unimplemented |
| R-P16-03 | P0 | Every project file carries format flm-project and an explicit version | M-15 | T09.01 | AT-R-P16-03 (auto: UT-15-03, UT-15-11, FT-111) | Unimplemented |
| R-P16-04 | P0 | Older versions migrate through Project.migrate; newer or unknown versions are refused with a message | M-15, M-27 | T09.12 | AT-R-P16-04 (auto: UT-15-13, UT-15-14) | Unimplemented |
| R-P16-05 | P0 | A corrupted project yields an error offering backup, checkpoint restore or raw export | M-15, M-16, M-27 | T09.04 | AT-R-P16-05 (auto: UT-16-08, UT-15-12) | Unimplemented |
| R-P16-06 | P0 | Quota errors open DLG-SaveFailed offering Export; Storage.estimateQuota runs before large writes | M-16, M-27 | T09.12 | AT-R-P16-06 (auto: FI-013, FI-014, UT-16-05, UT-16-23, UT-27-18) | Unimplemented |
| R-P16-07 | P1 | Autosave runs only at safe points, never during recording or playback | M-16, M-17 | T09.11 | AT-R-P16-07 (auto: UT-15-25, UT-17-22, IT-055) | Unimplemented |
| R-P16-08 | P0 | Any project can be exported as .flm.json at any time for backup | M-15, M-16 | T09.10 | AT-R-P16-08 (auto: UT-16-19, FT-111; manual: XT-025, XT-028) | Unimplemented |
| R-P16-09 | P0 | Imported projects and assets pass Project.validate and the import limits before use | M-15, M-14 | T09.01 | AT-R-P16-09 (auto: UT-15-15, UT-15-16, FT-099, FT-112) | Unimplemented |
| R-P16-10 | P1 | Chart and track references are checked before playback; dangling ones are dropped with a warning | M-15, M-28 | T09.01 | AT-R-P16-10 (auto: UT-15-15) | Unimplemented |
| R-P16-11 | P1 | Large projects stay within memory budgets; serialization <= 200 ms for 100k events | M-15, M-16 | T09.01 | AT-R-P16-11 (auto: PT-016, PT-013, PT-010) | Unimplemented |
| R-P16-12 | P0 | Ten save-load cycles produce identical serialized content | M-15, M-16 | T09.10 | AT-R-P16-12 (auto: FT-111, UT-15-04) | Unimplemented |

#### 14.2.17 P 17 Performance and resource management

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P17-01 | P1 | Load to main menu is measured by tools/perf.mjs against 1.5 s desktop and 3.0 s mobile | M-29, `tools/perf.mjs` | T14.05 | AT-R-P17-01 (auto: PT-002) | Unimplemented |
| R-P17-02 | P1 | Time to first playable Quick Play is measured against 5 s desktop and 8 s mobile | M-29, M-30, `tools/perf.mjs` | T14.05 | AT-R-P17-02 (auto: PT-003; manual: LT-001, LT-002) | Unimplemented |
| R-P17-03 | P1 | Frame rate is measured in the five-performer full-band scene on every tier | M-18, M-21, `tools/perf.mjs` | T14.04 | AT-R-P17-03 (auto: PT-005; manual: LT-044) | Unimplemented |
| R-P17-04 | P1 | Audio timing is tested under forced render load (busy frames) and keeps the scheduling budgets | M-05, M-31 | T14.04 | AT-R-P17-04 (auto: PT-004, PT-006, TT-020, IT-011) | Unimplemented |
| R-P17-05 | P1 | Polyphony (64 desktop, 32 mobile) and the 32-track limit are documented on SCR-About and in docs | M-05, M-27 | T14.02 | AT-R-P17-05 (auto: UT-05-14, UT-03-03; review) | Unimplemented |
| R-P17-06 | P1 | Instrument warmup is lazy per used program and bounded in time; no sound bank is bundled | M-06 | T14.01 | AT-R-P17-06 (auto: UT-06-22, UT-06-09, PT-001; review) | Unimplemented |
| R-P17-07 | P1 | GL buffers, textures and programs are freed on performer removal and mode leave (Render.counters) | M-18, M-21 | T05.11 | AT-R-P17-07 (auto: UT-18-18, UT-21-17, UT-19-18) | Unimplemented |
| R-P17-08 | P1 | All DOM listeners go through Core.dom; their count stays constant across repeated navigation | M-01, M-28 | T01.03 | AT-R-P17-08 (auto: UT-07-03, IT-032, UT-28-07; review) | Unimplemented |
| R-P17-09 | P1 | 20 mode enter-leave cycles leave assertClean counters at baseline and memory growth <= 10 MB | M-28 | T14.07 | AT-R-P17-09 (auto: PT-011, IT-032, UT-28-02) | Unimplemented |
| R-P17-10 | P1 | A 30 min playback session and a 10 min recording session are tested | M-31, `tools/perf.mjs` | T14.07 | AT-R-P17-10 (auto: PT-022, PT-023; manual: LT-086, LT-088) | Unimplemented |
| R-P17-11 | P1 | Imports at the limits (25 MB file, 1,000,000 events, 128 tracks) are tested from test-corpus | M-14, M-31, `tools/make-corpus.mjs` | T07.04 | AT-R-P17-11 (auto: FT-036, FT-039, FT-041, FT-042, FT-048, PT-014) | Unimplemented |
| R-P17-12 | P1 | The tier is chosen from device capability and downgraded when p95 frame time > 33 ms over 5 s | M-18 | T14.04 | AT-R-P17-12 (auto: UT-18-08, UT-18-13, PT-006; manual: XT-035) | Unimplemented |
| R-P17-13 | P1 | Context loss pauses drawing; restore rebuilds GL resources or falls back to the Abstract tier | M-18, M-21 | T05.11 | AT-R-P17-13 (auto: UT-18-15, UT-18-16, FI-009, FI-010; manual: XT-035) | Unimplemented |
| R-P17-14 | P1 | Performance targets are verified on representative physical devices (Part 9 device matrix) | M-31, `tools/perf.mjs` | T15.06 | AT-R-P17-14 (manual: LT-086, LT-087, XT-065; review) | Unimplemented |

#### 14.2.18 P 18 Single-file packaging and offline operation

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P18-01 | P0 | The shipped artifact is one file, FingerLickinMusic.html | `tools/build.mjs`, `src/shell.html` | T01.02 | AT-R-P18-01 (auto: PT-001; review) | Unimplemented |
| R-P18-02 | P0 | All code and styles are inlined by tools/build.mjs; no external script, style, font or image | `tools/build.mjs` | T01.02 | AT-R-P18-02 (auto: PT-001; manual: XT-001; review) | Unimplemented |
| R-P18-03 | P0 | Embedded content (code, demo data, icons) is original or licensed and listed in the license inventory | M-30, `docs/FINAL-REPORT.md` | T16.05 | AT-R-P18-03 (manual: LT-094; review) | Unimplemented |
| R-P18-04 | P0 | External dependencies (optional STUN server, optional relay) are named on SCR-About and in README.md | M-24, M-27, `README.md` | T16.05, T16.08 | AT-R-P18-04 (review) | Unimplemented |
| R-P18-05 | P0 | The delivered file opens directly from file:// and from http(s) in every browser claimed Supported | `FingerLickinMusic.html` | T15.04 | AT-R-P18-05 (manual: XT-001, XT-002, XT-003, XT-004, XT-005) | Unimplemented |
| R-P18-06 | P0 | Every local mode works offline; the default configuration makes no network request at runtime | M-24, M-29 | T15.03 | AT-R-P18-06 (auto: IT-030; manual: XT-001, XT-004, XT-058) | Unimplemented |
| R-P18-07 | P1 | Optional remote services (STUN, relay) fail with a message and never block another feature | M-24, M-27 | T13.09 | AT-R-P18-07 (auto: IT-031; manual: LT-078, XT-064) | Unimplemented |
| R-P18-08 | P0 | No credentials, keys or tokens are embedded; the build scans the output and fails on a match | `tools/build.mjs` | T16.01 | AT-R-P18-08 (review) | Unimplemented |
| R-P18-09 | P1 | Storage behavior (localStorage, IndexedDB) is checked from file:// and http(s) in each tested browser | M-16 | T15.04 | AT-R-P18-09 (manual: XT-020, XT-021, XT-022, XT-023, XT-024) | Unimplemented |
| R-P18-10 | P1 | Import and export are tested from the delivered file, not only the test build | M-14, M-16 | T15.04 | AT-R-P18-10 (manual: XT-025, XT-028, XT-030, XT-033) | Unimplemented |
| R-P18-11 | P0 | The final file is tested outside the development setup: fresh browser profile, no server, no repo files | `FingerLickinMusic.html` | T16.02 | AT-R-P18-11 (manual: LT-090) | Unimplemented |
| R-P18-12 | P0 | No development tool is needed at runtime; Node is used only for build, tests and the optional relay | `tools/build.mjs`, `server/relay.mjs` | T16.01 | AT-R-P18-12 (manual: LT-090; review) | Unimplemented |

#### 14.2.19 P 19 Error handling and recovery

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P19-01 | P0 | Every important async operation has a catch path that reports to ErrorReporter | M-01 | T01.04 | AT-R-P19-01 (auto: UT-01-14, UT-01-15, FI-039; review) | Unimplemented |
| R-P19-02 | P0 | A failed import leaves the current project and song untouched | M-14, M-15 | T07.09 | AT-R-P19-02 (auto: IT-042, FI-031, UT-14-18, IT-041) | Unimplemented |
| R-P19-03 | P0 | A failed or aborted recording preserves all earlier takes | M-17 | T09.07 | AT-R-P19-03 (auto: UT-17-08, FI-002, FI-042; manual: LT-056) | Unimplemented |
| R-P19-04 | P1 | Audio failures (suspended, closed, device change) offer Resume audio and Restart audio actions | M-05, M-27 | T04.08 | AT-R-P19-04 (auto: FI-001, FI-004, FI-007, UT-05-23; manual: XT-073) | Unimplemented |
| R-P19-05 | P1 | Rendering failures fall back WebGL2 -> WebGL1 -> Abstract tier with a notice | M-18, M-27 | T05.01 | AT-R-P19-05 (auto: UT-18-10, IT-059, FI-010; manual: XT-035) | Unimplemented |
| R-P19-06 | P1 | Every network operation has a timeout; no session waits indefinitely | M-24 | T13.03, T13.07 | AT-R-P19-06 (auto: UT-24-27, FI-022, FI-023) | Unimplemented |
| R-P19-07 | P0 | Settings are validated against the schema on load; invalid values are clamped or reset and logged | M-16, M-26 | T01.08 | AT-R-P19-07 (auto: UT-27-13, UT-07-28, FT-113) | Unimplemented |
| R-P19-08 | P1 | Unsupported formats and features are labeled Unsupported with the reason and an alternative | M-14, M-27 | T12.06 | AT-R-P19-08 (auto: FT-088, FT-102, UT-12-24; manual: LT-092) | Unimplemented |
| R-P19-09 | P0 | User-facing errors never show stack traces, file paths or peer addresses; details stay in diagnostics | M-01, M-27 | T01.04 | AT-R-P19-09 (auto: UT-01-16, UT-01-19; manual: LT-092) | Unimplemented |
| R-P19-10 | P0 | Log ring buffer holds 500 entries, diagnostics export <= 200 KB, and logs are never persisted | M-01 | T01.03 | AT-R-P19-10 (auto: UT-01-08, UT-01-20, FT-106) | Unimplemented |
| R-P19-11 | P0 | Each critical error path has a regression test (UT or FI) | M-31 | T15.01, T15.02 | AT-R-P19-11 (review) | Unimplemented |
| R-P19-12 | P0 | No important operation fails silently: each failure emits error and shows a message | M-01, M-27 | T01.04 | AT-R-P19-12 (auto: UT-01-14, FI-008, FI-013, FI-031, FI-038) | Unimplemented |

#### 14.2.20 P 20 Testing and release quality

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P20-01 | P0 | Unit tests cover timing (TempoMap, Transport, Scheduler) and mapping (profiles A-F, ChartGenerator) | M-31 | T03.10 | AT-R-P20-01 (auto: UT-03-16, UT-04-05, UT-05-15, UT-08-01, UT-08-22; review) | Unimplemented |
| R-P20-02 | P1 | Integration tests cover audio, input, scoring and rendering in headless Chromium | M-31, `tools/selftest.mjs` | T08.08 | AT-R-P20-02 (auto: IT-001, IT-003, IT-010, IT-012) | Unimplemented |
| R-P20-03 | P0 | Import tests cover valid, malformed and oversized files from test-corpus | M-31, `tools/make-corpus.mjs` | T07.04 | AT-R-P20-03 (auto: FT-008, FT-023, FT-036, FT-042, FI-030) | Unimplemented |
| R-P20-04 | P0 | Save and load tests verify data integrity through round trips and corrupted records | M-31 | T09.14 | AT-R-P20-04 (auto: FT-111, UT-16-08, IT-014, FI-017) | Unimplemented |
| R-P20-05 | P1 | Multiplayer tests cover added latency, disconnects and invalid messages | M-31, M-24 | T13.10 | AT-R-P20-05 (auto: FI-024, FI-020, IT-027, IT-028) | Unimplemented |
| R-P20-06 | P1 | Mobile tests run on physical devices, or are listed as owner actions with the reason | M-31 | T15.05 | AT-R-P20-06 (manual: XT-004, XT-005, LT-002; review) | Unimplemented |
| R-P20-07 | P1 | Cross-browser tests run on every browser named in Part 1.6 | M-31 | T15.04 | AT-R-P20-07 (manual: XT-001, XT-002, XT-003, XT-004, XT-005, XT-065) | Unimplemented |
| R-P20-08 | P1 | Performance tests cover long (30 min) and demanding (5 performers, 64 voices) sessions | M-31, `tools/perf.mjs` | T14.07 | AT-R-P20-08 (auto: PT-022, PT-005, PT-012) | Unimplemented |
| R-P20-09 | P1 | Accessibility checks are run: keyboard-only pass, screen reader pass, contrast check | M-26, M-31 | T15.07 | AT-R-P20-09 (manual: LT-079, LT-080, LT-013) | Unimplemented |
| R-P20-10 | P1 | The license and dependency inventory is reviewed and published in docs/FINAL-REPORT.md | `docs/FINAL-REPORT.md` | T16.05 | AT-R-P20-10 (manual: LT-094; review) | Unimplemented |
| R-P20-11 | P0 | The release has no open Critical defect in docs/STATUS.md | `docs/STATUS.md` | T16.07 | AT-R-P20-11 (review) | Unimplemented |
| R-P20-12 | P0 | Every documented limitation matches tested behavior | M-27, `docs/COMPATIBILITY.md` | T16.06 | AT-R-P20-12 (manual: LT-091) | Unimplemented |
| R-P20-13 | P0 | Every P0 and P1 requirement has an AT-R-ID acceptance test in Part 12 | none (plan) | T00.06 | AT-R-P20-13 (review) | Unimplemented |
| R-P20-14 | P0 | The final HTML is validated independently: fresh profile, markup check and full acceptance run | `FingerLickinMusic.html`, M-31 | T16.02 | AT-R-P20-14 (manual: LT-090; review) | Unimplemented |

#### 14.2.21 P 21 Micro-polish that separates good from excellent

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P21-01 | P2 | Buttons show a subtle pressed state (scale 0.97 for 80 ms) | M-26 | T01.06 | no AT (P2); review: UT-26-12, LT-020 | Unimplemented |
| R-P21-02 | P2 | Focus moves with a 120 ms ring transition (instant under reduced motion) | M-26 | T01.06 | no AT (P2); review: UT-26-26, LT-079 | Unimplemented |
| R-P21-03 | P2 | Panels open and close with 150-200 ms transitions and no layout jump | M-26 | T01.06 | no AT (P2); review: LT-012 | Unimplemented |
| R-P21-04 | P2 | Loading indicators appear only after 300 ms of waiting | M-26 | T01.06 | no AT (P2); review: LT-012, LT-066 | Unimplemented |
| R-P21-05 | P2 | Progress bars reflect bytes or steps completed, never timers | M-14, M-26 | T07.08 | no AT (P2); review: LT-066 | Unimplemented |
| R-P21-06 | P2 | Audio previews fade in and out over 30 ms, so they never click | M-05, M-14 | T07.08 | no AT (P2); review: LT-066, LT-033 | Unimplemented |
| R-P21-07 | P2 | Tooltips appear only on non-obvious controls such as icon-only buttons | M-26, M-27 | T01.06 | no AT (P2); review: LT-011, LT-079 | Unimplemented |
| R-P21-08 | P2 | Empty states name the next action (for example "Import a file or pick a demo song") | M-27 | T07.09 | no AT (P2); review: LT-005, UT-27-25 | Unimplemented |
| R-P21-09 | P2 | Confirmation dialogs state what will be lost and label the confirm button with its effect | M-26, M-27 | T09.13 | no AT (P2); review: LT-006, LT-062 | Unimplemented |
| R-P21-10 | P2 | Numeric controls show units and precision: ms integer, dB one decimal, BPM integer, percent integer | M-26 | T01.06 | no AT (P2); review: LT-011 | Unimplemented |
| R-P21-11 | P2 | Sliders respond to arrow keys, PageUp, PageDown, Home, End and touch drag | M-26 | T01.06 | no AT (P2); review: UT-26-13, LT-079, LT-083 | Unimplemented |
| R-P21-12 | P2 | Long track names truncate with an ellipsis and keep the full name in the title attribute | M-26, M-27 | T09.13 | no AT (P2); review: UT-26-25, LT-006 | Unimplemented |
| R-P21-13 | P2 | Songs without artwork show a generated cover from title initials and track color | M-27 | T07.09 | no AT (P2); review: LT-005, LT-011 | Unimplemented |
| R-P21-14 | P2 | All icons come from the one SVG sprite with the same stroke weight | M-26, `src/shell.html` | T01.06 | no AT (P2); review: LT-011, LT-016 | Unimplemented |
| R-P21-15 | P2 | SCR-Library keeps its filters and scroll position when the user returns from play | M-27 | T07.09 | no AT (P2); review: UT-27-25, LT-005 | Unimplemented |
| R-P21-16 | P2 | Volume, difficulty and input mappings persist and change only by user action | M-16, M-27 | T08.07 | no AT (P2); review: IT-060, LT-003, LT-085 | Unimplemented |
| R-P21-17 | P2 | Completed operations (save, export, import) confirm with a toast | M-26, M-27 | T09.10 | no AT (P2); review: UT-26-11, LT-060 | Unimplemented |
| R-P21-18 | P2 | Visual effects stay on the beat and are capped in brightness and count | M-21 | T05.07 | no AT (P2); review: LT-048, LT-049 | Unimplemented |
| R-P21-19 | P2 | All five built-in demos are reviewed for musical and visual coherence | M-30 | T16.09 | no AT (P2); review: LT-032 | Unimplemented |

#### 14.2.22 P 22 Definition of maximum polish

| R-ID | Pri | Checklist item | Owning module(s) | T section(s) | Verification | Status at v1.0.0 |
|---|---|---|---|---|---|---|
| R-P22-01 | P1 | A subsystem counts as polished only when every applicable P 22 condition holds (final acceptance review) | M-01 to M-30 | T16.09 | AT-R-P22-01 (manual: LT-096; review) | Unimplemented |
| R-P22-02 | P1 | Polished subsystem condition: functionally correct across its supported use cases | M-01 to M-30 | T16.09 | AT-R-P22-02 (manual: LT-096; review) | Unimplemented |
| R-P22-03 | P1 | Polished subsystem condition: visually consistent with the product (P 2 rows hold) | M-26, M-27, M-21 | T16.09 | AT-R-P22-03 (manual: LT-011, LT-096) | Unimplemented |
| R-P22-04 | P1 | Polished subsystem condition: responsive under expected loads (Part 9 budgets met) | M-01 to M-30 | T16.09 | AT-R-P22-04 (auto: PT-002, PT-004, PT-005, PT-011; manual: LT-096) | Unimplemented |
| R-P22-05 | P1 | Polished subsystem condition: accessible through every supported input method | M-07, M-26 | T16.09 | AT-R-P22-05 (manual: LT-079, LT-083, LT-026, LT-096) | Unimplemented |
| R-P22-06 | P1 | Polished subsystem condition: resilient to malformed data, interruptions and recoverable failures | M-01 to M-30 | T16.09 | AT-R-P22-06 (auto: FI-030, FI-031, FI-013, FI-033; manual: LT-096) | Unimplemented |
| R-P22-07 | P1 | Polished subsystem condition: covered by automated or reproducible manual tests | M-31 | T16.09 | AT-R-P22-07 (review) | Unimplemented |
| R-P22-08 | P1 | Polished subsystem condition: integrated with the rest of the application | M-27, M-28 | T16.09 | AT-R-P22-08 (auto: IT-032, IT-014, IT-025; manual: LT-096) | Unimplemented |
| R-P22-09 | P1 | Polished subsystem condition: remaining limitations are documented | M-27, `docs/FINAL-REPORT.md` | T16.09 | AT-R-P22-09 (manual: LT-091; review) | Unimplemented |
| R-P22-10 | P1 | Polished subsystem condition: checked in the target deployment (delivered file opened from file://) | `FingerLickinMusic.html` | T16.09 | AT-R-P22-10 (manual: LT-090, XT-001, XT-004, XT-005) | Unimplemented |
| R-P22-11 | P0 | Polished subsystem condition: no known release-blocking defect | `docs/STATUS.md` | T16.09 | AT-R-P22-11 (review) | Unimplemented |
| R-P22-12 | P0 | Broken timing, confusing controls or lost recordings each block release, whatever else is polished | M-04, M-07, M-17 | T16.09 | AT-R-P22-12 (auto: TT-004, FI-002, FI-042; manual: LT-056, LT-096) | Unimplemented |
| R-P22-13 | P1 | Release bar: looks polished, sounds convincing, responds at once, keeps work, behaves predictably | M-01 to M-30 | T16.09 | AT-R-P22-13 (manual: LT-096, LT-011, LT-031, LT-020, LT-057) | Unimplemented |

#### 14.2.23 Polish gate summary

Row counts per P section and subsection of the tables above (360 rows, equal to the 360 R-P rows of Part 15.4). The last two columns are filled in T16.09 from STATUS.md and the T16.09 review; at plan version 1.0.0 every gate reads "not met" because every row is Unimplemented or Deferred.

| P section | Rows | P0 | P1 | P2 | Deferred | T sections | Gate at v1.0.0 | Gate at delivery |
|---|---|---|---|---|---|---|---|---|
| P preamble (Mandatory agent instruction) | 3 | 3 | 0 | 0 | 0 | T00.01, T00.06, T16.03 | not met | <met, or not met: R-IDs not Implemented> |
| P 1 Overall game feel | 12 | 0 | 12 | 0 | 0 | T01.06, T01.08, T03.02, T08.05, T08.07, T09.13, T14.04 | not met | <met, or not met: R-IDs not Implemented> |
| P 2.1 Establish one recognizable visual identity | 9 | 0 | 9 | 0 | 0 | T01.06, T01.07, T05.07, T08.05, T10.04 | not met | <met, or not met: R-IDs not Implemented> |
| P 2.2 Pixel-level interface quality | 10 | 0 | 10 | 0 | 0 | T01.06, T05.02, T05.11, T15.07, T16.09 | not met | <met, or not met: R-IDs not Implemented> |
| P 2.3 Visual hierarchy | 6 | 0 | 6 | 0 | 0 | T01.06, T01.08 | not met | <met, or not met: R-IDs not Implemented> |
| P 3 Main menu and navigation | 12 | 2 | 10 | 0 | 0 | T01.07, T01.09, T01.11, T09.04, T09.07, T09.13, T13.09 | not met | <met, or not met: R-IDs not Implemented> |
| P 4 First launch and onboarding | 12 | 2 | 10 | 0 | 0 | T01.04, T03.02, T04.01, T08.05, T08.07 | not met | <met, or not met: R-IDs not Implemented> |
| P 5.1 Input quality | 11 | 6 | 5 | 0 | 0 | T03.01, T03.02, T03.03, T03.04, T03.05, T03.09 | not met | <met, or not met: R-IDs not Implemented> |
| P 5.2 Rhythm gameplay | 12 | 4 | 8 | 0 | 0 | T03.07, T03.08, T08.02, T08.03, T08.04 | not met | <met, or not met: R-IDs not Implemented> |
| P 5.3 Difficulty and fairness | 8 | 0 | 8 | 0 | 0 | T08.01, T10.06, T11.09 | not met | <met, or not met: R-IDs not Implemented> |
| P 6 Audio fidelity and sound quality (section statement) | 1 | 1 | 0 | 0 | 0 | T16.09 | not met | <met, or not met: R-IDs not Implemented> |
| P 6.1 Instrument sound | 12 | 3 | 9 | 0 | 0 | T04.03, T04.06, T07.05, T14.01 | not met | <met, or not met: R-IDs not Implemented> |
| P 6.2 Audio mixing | 10 | 0 | 10 | 0 | 0 | T04.02, T04.04, T14.03, T14.07 | not met | <met, or not met: R-IDs not Implemented> |
| P 6.3 Audio timing | 10 | 10 | 0 | 0 | 0 | T02.04, T02.05, T02.07, T03.07, T04.04, T05.03, T14.07 | not met | <met, or not met: R-IDs not Implemented> |
| P 7.1 Scene quality | 10 | 0 | 10 | 0 | 0 | T05.02, T05.07, T05.09 | not met | <met, or not met: R-IDs not Implemented> |
| P 7.2 Character animation | 11 | 2 | 9 | 0 | 0 | T05.04, T05.05, T10.02 | not met | <met, or not met: R-IDs not Implemented> |
| P 7.3 Cameras and stage direction | 8 | 0 | 8 | 0 | 0 | T05.08 | not met | <met, or not met: R-IDs not Implemented> |
| P 8 Character customization | 12 | 0 | 12 | 0 | 0 | T10.01, T10.02, T10.03, T10.04, T10.05, T13.05 | not met | <met, or not met: R-IDs not Implemented> |
| P 9 Free Play and music theory | 12 | 6 | 6 | 0 | 0 | T03.06, T06.01, T06.02, T06.03, T06.04, T06.05, T06.06 | not met | <met, or not met: R-IDs not Implemented> |
| P 10 Studio and recording | 15 | 4 | 11 | 0 | 0 | T09.02, T09.05, T09.06, T09.07, T09.08, T09.09, T09.10, T09.13 | not met | <met, or not met: R-IDs not Implemented> |
| P 11 Music import and compatibility | 16 | 6 | 10 | 0 | 0 | T07.02, T07.03, T07.08, T07.09, T08.01, T09.13, T12.03, T12.04, T12.07, T12.08 | not met | <met, or not met: R-IDs not Implemented> |
| P 12 Dance mode | 12 | 0 | 12 | 0 | 0 | T11.02, T11.03, T11.04, T11.05, T11.07, T11.08, T11.09 | not met | <met, or not met: R-IDs not Implemented> |
| P 13 Multiplayer | 14 | 2 | 11 | 1 | 1 | T13.02, T13.03, T13.04, T13.05, T13.06, T13.07, T13.08, T13.09, T13.11 | not met | <met, or not met: R-IDs not Implemented> |
| P 14 Mobile and responsive polish | 14 | 2 | 12 | 0 | 0 | T01.06, T01.07, T03.02, T03.03, T04.01, T05.01, T14.06, T15.06 | not met | <met, or not met: R-IDs not Implemented> |
| P 15 Accessibility and interaction details | 12 | 0 | 12 | 0 | 0 | T01.04, T01.07, T05.09, T08.02, T08.03, T08.07 | not met | <met, or not met: R-IDs not Implemented> |
| P 16 Persistence and project safety | 12 | 9 | 3 | 0 | 0 | T09.01, T09.03, T09.04, T09.10, T09.11, T09.12 | not met | <met, or not met: R-IDs not Implemented> |
| P 17 Performance and resource management | 14 | 0 | 14 | 0 | 0 | T01.03, T05.11, T07.04, T14.01, T14.02, T14.04, T14.05, T14.07, T15.06 | not met | <met, or not met: R-IDs not Implemented> |
| P 18 Single-file packaging and offline operation | 12 | 9 | 3 | 0 | 0 | T01.02, T13.09, T15.03, T15.04, T16.01, T16.02, T16.05, T16.08 | not met | <met, or not met: R-IDs not Implemented> |
| P 19 Error handling and recovery | 12 | 8 | 4 | 0 | 0 | T01.03, T01.04, T01.08, T04.08, T05.01, T07.09, T09.07, T12.06, T13.03, T13.07, T15.01, T15.02 | not met | <met, or not met: R-IDs not Implemented> |
| P 20 Testing and release quality | 14 | 7 | 7 | 0 | 0 | T00.06, T03.10, T07.04, T08.08, T09.14, T13.10, T14.07, T15.04, T15.05, T15.07, T16.02, T16.05, T16.06, T16.07 | not met | <met, or not met: R-IDs not Implemented> |
| P 21 Micro-polish that separates good from excellent | 19 | 0 | 0 | 19 | 0 | T01.06, T05.07, T07.08, T07.09, T08.07, T09.10, T09.13, T16.09 | not met | <met, or not met: R-IDs not Implemented> |
| P 22 Definition of maximum polish | 13 | 2 | 11 | 0 | 0 | T16.09 | not met | <met, or not met: R-IDs not Implemented> |
| Total | 360 | 88 | 252 | 20 | 1 | all of the above | not met | <met, or not met: count> |

### 14.3 Release-blocking gate summary

The binding gate is Part 12.10: its rules (12.10.1), the E 13 rows G-01 to G-11 (12.10.2),
the B 26.8 rows D-01 to D-06 (12.10.3) with their automated, device and manual tests, and the
procedure (12.10.4). This section restates the list so the release decision can be read in one
place, names the T entry that decides each row, adds three supplementary checks from P 20 and
P 22, and fixes the release status sentences. When this list and 12.10 differ, 12.10 governs
(rule 4 of this part).

#### 14.3.1 E 13 conditions (12.10.2)

| Gate | Condition that blocks the release | AT tests (12.10.2) | Decided in | Evidence summary |
|---|---|---|---|---|
| G-01 | Audio timing drifts during normal gameplay | AT-R-E13-01, AT-R-B26.3-05, AT-R-P6.3-01, AT-R-P6.3-02, AT-R-P6.3-03, AT-R-P6.3-06, AT-R-P6.3-08 | T16.04 | `--all` JSON; perf JSON `driftMs`, `schedErrorMaxMs`, `lateEvents`; device JSON per browser |
| G-02 | Stuck notes can persist after stopping or changing modes | AT-R-E13-02, AT-R-P5.1-04, AT-R-P5.1-11 | T16.04 | `assertClean()` results of IT-032 and PT-011; `voicesMax` and active voices after stop (PT-012); LT-035 case table |
| G-03 | Valid supported MIDI files lose musical events | AT-R-E13-03, AT-R-B26.3-01, AT-R-B26.3-03, AT-R-P11-04, AT-R-P11-05, AT-R-P11-06 | T16.04 | FT event, track and warning comparisons per corpus file; empty round-trip diffs; LT-036 findings |
| G-04 | Saving can silently destroy an existing project | AT-R-E13-04, AT-R-E11-13, AT-R-E11-16, AT-R-P16-01, AT-R-P16-02, AT-R-P16-12 | T16.04 | FI table per stage with the previous version and `.bak` intact and no `project.saved` event; XT storage mode per browser; LT-056 and LT-060 |
| G-05 | The advertised standalone file cannot perform its documented core functions | AT-R-E13-05, AT-R-B26.1-01, AT-R-B26.1-03, AT-R-B26.1-04, AT-R-E9-01, AT-R-E9-16, AT-R-P18-05, AT-R-P18-06, AT-R-P18-11, AT-R-B5.2-01 | T16.02, T16.04 | file hash and size; XT-001 to XT-005 cells per browser and context; LT-090 core function list |
| G-06 | A rendering failure permanently disables audio or transport | AT-R-E13-06, AT-R-E11-11, AT-R-E9-15, AT-R-I12.1-05 | T16.04 | transport state and scheduled-event log across each injected failure; tier and context type per browser; LT-050 |
| G-07 | Mobile controls fail to release inputs reliably | AT-R-E13-07, AT-R-P14-04, AT-R-I12-04, AT-R-P5.1-05, AT-R-P5.1-06 | T16.04 | per device the 80 case runs of XT-016 to XT-019 with held-control counts; the OQ-1 outcome in the LEDGER |
| G-08 | Multiplayer accepts invalid authoritative results without the intended validation | AT-R-E13-08, AT-R-P13-07, AT-R-P13-08, AT-R-P13-10 | T16.04 | IT-028 table of forged results and rejection codes; rejected and dropped message counters |
| G-09 | Required supported file formats have not been tested against a representative corpus | AT-R-E13-09, AT-R-P20-03, AT-R-P11-16 | T16.04, T16.06 | FT IDs and real-file LT results per `docs/COMPATIBILITY.md` cell; a version with fewer than two passing valid FT files and one passing malformed FT file is published Partial, not Supported |
| G-10 | Critical errors are silently ignored or reported as successful operations | AT-R-E13-10, AT-R-P19-01, AT-R-P19-11, AT-R-P19-12, AT-R-E11-15 | T16.04 | FI table with the message shown per hook; STATUS.md section 6 with no open Critical defect |
| G-11 | A lower-priority feature is deferred without documented status while core criteria fail | AT-R-E13-11 | T16.04 | STATUS.md section 3 and section 5 rows for every Deferred item of Part 1.5; the same list in `docs/FINAL-REPORT.md` item 11 |

#### 14.3.2 B 26.8 delivery conditions (12.10.3)

| Gate | Delivery condition | AT tests (12.10.3) | Decided in | 14.1 items |
|---|---|---|---|---|
| D-01 | The final standalone HTML is provided | AT-R-B26.8-01, AT-R-B28-01, AT-R-B28-14, AT-R-P18-01, AT-R-P18-02, AT-R-B5.3-01 | T16.01 | RC-01, RC-07, RC-08, RC-14, RC-18 |
| D-02 | Any external services or optional resources are documented | AT-R-B26.8-02, AT-R-P18-04, AT-R-B28-07, AT-R-B28-13 | T16.05, T16.08 | RC-02, RC-10, RC-13, RC-21, RC-28 |
| D-03 | Dependency licenses are documented | AT-R-B26.8-03, AT-R-B28-06, AT-R-P18-03, AT-R-P20-10, AT-R-B19.5-01 | T16.05 | RC-03, RC-09, RC-27 |
| D-04 | Supported file formats and limitations are listed | AT-R-B26.8-04, AT-R-B28-05, AT-R-B1.5-02, AT-R-P11-16 | T16.06 | RC-04, RC-16, RC-20 |
| D-05 | Automated test results and known issues are included | AT-R-B26.8-05, AT-R-B28-10, AT-R-B28-11, AT-R-P20-11 | T16.03, T16.07 | RC-05, RC-19 |
| D-06 | No feature is falsely described as complete | AT-R-B26.8-06, AT-R-B28-15, AT-R-B1.5-06, AT-R-P20-12 | T16.03, T16.07 | RC-06, RC-19, RC-22 |

#### 14.3.3 Supplementary release checks (P 20, P 22)

The 17 rows above are necessary for "production-ready" (12.10.4 step 6). These three checks
are also necessary; they are evaluated in T16.04 and T16.09 and written under the gate table
of `docs/FINAL-REPORT.md` item 4 with the same "resolved" or "unresolved: <reason>" words.

| Check | Condition | AT test | Evidence |
|---|---|---|---|
| Supplementary check 1 | No open Critical defect in STATUS.md section 6 | AT-R-P20-11 (review) | the defect table at the gate commit |
| Supplementary check 2 | No open release-blocking defect in any subsystem | AT-R-P22-11 (review) | the defect table and the T16.09 review table |
| Supplementary check 3 | No open finding of broken timing, confusing controls or recording loss | AT-R-P22-12 (auto: TT-004, FI-002, FI-042; manual: LT-056, LT-096) | TT and PT drift rows; findings of LT-004, LT-005, LT-084; LT-056, FI-002, FI-042 results |

#### 14.3.4 Release status sentences

Exactly one of these sentences is written, at T16.10, at the top of `docs/FINAL-REPORT.md`,
in `README.md` under the first paragraph, and in the STATUS.md header block (as a line
"Release status: ..."):

```text
Release status: production-ready. All 17 release-blocking conditions and the 3 supplementary checks are resolved for build <FLM.VERSION>, file SHA-256 <hash>.
```

```text
Release status: not production-ready. Unresolved release conditions for build <FLM.VERSION>, file SHA-256 <hash>: <comma-separated gate rows and checks, each with "tests failing: <IDs>" or "awaiting owner device test: <IDs>">.
```

SCR-About shows the one-line form "Release status: production-ready." or "Release status:
not production-ready; see docs/FINAL-REPORT.md." under the version line; its text id is
added to the Part 7.11 catalog. No document, screen or commit message calls the release
complete, final or production-ready while the second sentence applies (12.10 preamble).

### 14.4 `docs/COMPATIBILITY.md` template

Written first in T12.08 (Phase 12) with every evidence cell "not run" and every claim
"(not yet verified)", extended with the browser and device sections in T15.04 and T15.06,
and finalized in T16.06. Sections 1 to 7 are the Part 8.7.2 layout in its order; sections 8
and 9 hold the browser matrix and the device matrix that Part 12.11.1 and Part 9.2.2 place in
this file. Filling rules:

1. Section 2 copies the Part 8.7.1 summary matrix row for row (13 rows); only the Status
   cell may gain the suffix " (not yet verified)", which it carries until section 5 holds a
   passing evidence row for that row on the release candidate.
2. Publication rule (G-09): a format version is written Supported (or Conversion, for the
   rows 8.7.1 marks Conversion) without the suffix only with at least two passing valid FT
   files and one passing malformed FT file of that version in section 5; otherwise it is
   published Partial with the missing evidence named.
3. A browser is written Supported in section 8 only when every XT ID of its 12.8.18 column
   passes in every context its claim names on every tested version (Part 1.6 policy 1);
   otherwise Partial with the failing or untested capabilities named, or Unsupported. Until
   then the claim is "not yet verified".
4. Every result cell is "pass", "fail: <reason>", "n/a: <reason>" or "not run" (12.11.2);
   measured values carry their unit; headless values carry "(software GL)" where rendering is
   involved and never fill a device row (12.11.3).
5. `FLM.Import.COMPATIBILITY` (Part 6.14.4.9) and the SCR-About rendering (Part 8.7.3) are
   compared with sections 2 and 4 line by line in T16.06 (FT-095, UT-14-19); a difference is
   fixed in the code or the document before delivery, never by editing the test.

```text
# Finger Lickin Music - file compatibility

Build: <FLM.VERSION> (<BUILD stamp>), file SHA-256 <hash>, date <YYYY-MM-DD>.
Status words: Supported, Partial, Conversion, Unsupported. A claim is listed only with the
test evidence in section 5.

## 1. How to read this file
- Supported: imported without loss into the same kind of representation.
- Conversion: imported into a different representation (notation becomes events, audio
  becomes a backing audio track, SMPTE frames become ticks).
- Partial: works with the limits or failures named in the row.
- Unsupported: refused with a message; nothing is imported.
- "(not yet verified)" after a status: no passing test record exists yet for this build.

## 2. Summary matrix
| Format | Versions | Status | Preserved | Not preserved | Limits | Verifying tests |
|---|---|---|---|---|---|---|
| Standard MIDI File | SMF format 0 and 1, PPQ division (.mid .midi .smf .kar) | Supported<suffix> | <8.7.1 cell> | <8.7.1 cell> | <8.7.1 cell> | <FT IDs>; <XT IDs>; <LT IDs> |
| Standard MIDI File | SMF format 2 | Conversion<suffix> | <8.7.1 cell> | <8.7.1 cell> | <8.7.1 cell> | <test IDs> |
| Standard MIDI File | SMPTE time division (24, 25, 29.97, 30 fps) | Conversion<suffix> | <8.7.1 cell> | <8.7.1 cell> | <8.7.1 cell> | <test IDs> |
| RIFF MIDI | .rmi | Unsupported | nothing | everything (refused with a message) | n/a | <test IDs> |
| MusicXML | 1.0 to 4.0, partwise and timewise, uncompressed (.musicxml .xml) | Conversion<suffix> | <8.7.1 cell> | <8.7.1 cell> | <8.7.1 cell> | <test IDs> |
| MusicXML compressed | .mxl, entries stored or deflated | Conversion<suffix> | as uncompressed MusicXML | as uncompressed MusicXML | <8.7.1 cell> | <test IDs> |
| MusicXML | opus collections; .mxl with ZIP64, encryption or other compression; documents declaring entities | Unsupported | nothing | everything (refused with a message) | n/a | <test IDs> |
| Guitar Pro | GP3 v3.00; GP4 v4.00, v4.06, L4.06; GP5 v5.00, v5.10 (.gp3 .gp4 .gp5) | Conversion<suffix> | <8.7.1 cell> | <8.7.1 cell> | <8.7.1 cell> | <test IDs> |
| Guitar Pro | GP1, GP2, clipboard data, unlisted version strings, GP6 (.gpx), GP7 and GP8 (.gp) | Unsupported | nothing | everything (refused with the version named) | n/a | <test IDs> |
| Audio | WAV PCM | Conversion<suffix> | <8.7.1 cell> | <8.7.1 cell> | <8.7.1 cell> | <test IDs> |
| Audio | MP3, Ogg Vorbis and Opus, FLAC, AAC and M4A | Conversion where the browser decodes the codec, otherwise Unsupported in that browser<suffix> | as WAV | as WAV | as WAV | <test IDs> |
| SoundFont | .sf2 | Unsupported | nothing | everything (sound banks cannot be loaded in this version) | n/a | <test IDs> |
| Anything else | unknown content | Unsupported | nothing | everything | n/a | <test IDs> |

## 3. Feature tables
### 3.1 Standard MIDI File (Part 8.3.1 to 8.3.3)
| Feature | Status | Note |
|---|---|---|
| <one row per feature row of 8.3.1, 8.3.2 and 8.3.3> | <status word> | <note> |
### 3.2 MusicXML (Part 8.4.1 and 8.4.3)
| Feature | Status | Note |
|---|---|---|
| <one row per row of 8.4.1 and 8.4.3> | <status word> | <note> |
### 3.3 Guitar Pro (Part 8.5.1 and 8.5.2)
| Feature | Status | Note |
|---|---|---|
| <one row per row of 8.5.1 and 8.5.2> | <status word> | <note> |
### 3.4 Audio files by browser (Part 8.6.2)
| Feature | Status | Note |
|---|---|---|
| <one row per container and codec of 8.6.2> | <decode status> | <browsers in which decoding is recorded as pass, with versions> |

## 4. Fixed statements
- Audio files are imported as backing audio only. Notes cannot be generated from audio in
  this version; use a MIDI, MusicXML or Guitar Pro file for a playable chart.
- MusicXML files are imported as musical events (notes, timing, dynamics, tempo). Sheet
  music is not displayed.
- This is a Guitar Pro 6 or 7 file (.gpx or .gp). Only Guitar Pro 3, 4 and 5 files (.gp3,
  .gp4, .gp5) can be imported. Export the file as GP5 or as MIDI from Guitar Pro and import
  that.
- Instruments are synthesized; timbres approximate General MIDI programs.
- Import never changes the open project until you confirm.

## 5. Evidence
| Format or version | Test group or LT id | Browser and version | Device | Date | Result (pass or fail) | Notes |
|---|---|---|---|---|---|---|
| <format and version> | <files.<subgroup>.<file> or FT-nnn or LT-nnn or XT-nnn> | <browser and full version, or "Chromium headless <version>"> | <class and model, or "headless"> | <YYYY-MM-DD> | <pass, fail: reason, or not run> | <commit and file hash prefix> |

## 6. Limits
| Limit | Value | Error code |
|---|---|---|
| MIDI, MusicXML or Guitar Pro file size | 25 MB | E-IMP-001 |
| Audio file size | 100 MB | E-IMP-001 |
| Events per imported file | 1,000,000 | E-IMP-004 |
| Tracks (MTrk chunks, parts or Guitar Pro tracks) per file | 128 | E-IMP-004 |
| Tracks kept per song | 32 (selection above 32) | none (selection step) |
| Notes in one chord | 16 | none (warning of Part 6.14) |
| MusicXML measures per part; expanded measures | 10,000; 40,000 | E-IMP-004 |
| .mxl archive entries; uncompressed size; compression ratio | 256; 50 MB; 100 | E-IMP-004 |
| Guitar Pro strings | 7 | E-IMP-004 |
| Audio duration; audio tracks per project | 2 h; 4 | E-IMP-004 |
| Decoded audio per project | 192 MB desktop, 64 MB mobile | E-IMP-004 |
| Import time budget for MIDI, MusicXML and Guitar Pro; audio decode watchdog | 5 s; 60 s | E-IMP-005 |
| <any further limit of 8.3 to 8.6 and 10.1.2> | <value> | <code> |

## 7. Reporting a file that fails
Open Settings > Advanced > "Open diagnostics", choose "Export diagnostics" and send the
.flmdiag.json file together with the warning codes shown on the import screen. Song
content is not included unless you tick "Attach the file".

## 8. Browsers and the standalone file
### 8.1 Claims
| Browser | Floor | Versions tested | Contexts tested (file://, http://localhost, https, LAN http) | Claim | Failing or untested capabilities |
|---|---|---|---|---|---|
| Desktop Chromium (Chrome, Edge) | 110 | <versions> | <contexts> | <Supported, Partial, Unsupported or not yet verified> | <list or none> |
| Desktop Firefox | 115 (ESR) | <versions> | <contexts> | <claim> | <list> |
| Desktop Safari | 16.4 | <versions> | <contexts> | <claim> | <list> |
| iOS Safari | 16.4 | <versions> | <contexts; C1 "n/a: platform cannot open local HTML files" where 12.8.1 rule 6 applies> | <claim> | <list> |
| Android Chrome | 110 | <versions> | <contexts> | <claim> | <list> |

Other Chromium-based browsers are not tested and not claimed.

### 8.2 Capability matrix (one row per browser version and device; each cell "file: <result>; http(s): <result>")
| Browser and version | OS build | Device (class, model) | Date | Open, boot, offline core | Audio unlock | Four simultaneous touches (OQ-1) | Touch release lifecycle | IndexedDB and localStorage | Download and export | File import | WebGL init, tier, context loss | Orientation change | Background return | Screen lock and power saving | Web MIDI availability message | WebRTC availability | Two-device sessions | Self-test and device scenarios | Floor versions | Non-US keyboard layouts | Ring and silent switch | Output changes and calibration | Same project in two tabs | Touch targets measured | UI scale and zoom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| <browser version> | <OS build> | <class, model> | <YYYY-MM-DD> | <file: r; http(s): r> | <cell> | <cell or -> | <cell or -> | <cell> | <cell> | <cell> | <cell> | <cell or -> | <cell> | <cell> | <cell> | <cell> | <cell or -> | <cell> | <cell> | <cell or -> | <cell or -> | <cell or -> | <cell or -> | <cell or -> | <cell> |

### 8.3 Storage behavior reached per browser and context
| Browser and version | Context | Storage mode (IndexedDB, localStorage only, session only) | Survives reload | Survives moving the file | XT IDs |
|---|---|---|---|---|---|
| <browser version> | <C1 to C4> | <mode> | <pass or fail> | <pass, fail or n/a> | <XT-020 to XT-024> |

Keep this file in one folder. Some browsers tie saved projects to the file's location;
export your projects before moving the file.

## 9. Devices and performance (Part 9.2.2)
| Device | OS | Browser + version | Tier assigned | Load (ms) | TTI (ms) | FPS p50/p95 | Audio glitches | Memory (MB) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| <one row per Part 9.2.2 row; every cell "not measured" until a device JSON is transcribed> | | | | | | | | | |

Measured values come from the shipped file and the device's "Run performance scenarios"
report; the headless row is a regression signal marked "(software GL)", not a device result.
```

### 14.5 `docs/FINAL-REPORT.md` template

Written in T16.07 (items 4.3 and 4.4 completed by T16.09 and T16.04, items 12 and 13 by
T16.08) and committed in T16.10. Its fourteen numbered sections are the fourteen items of
B 28 in their order; Part 12.11.1 maps every kind of result to its item.

Rules:

1. Evidence only (rule 1 of this part). Every number, result word and claim cites the record
   it comes from (LEDGER entry date, results JSON file, XT or LT record line, test IDs).
2. Separation (B 28 last paragraph, R-B28-15). Every row of the Part 15 matrix belongs to
   exactly one of five groups, decided from its final STATUS.md status:

   | Group | Label in the report | Rows in the group |
   |---|---|---|
   | A | Implemented and tested | Status Implemented: every test named for the row passed in the final `--all --slow` run, every named XT and LT has a passing record on the release candidate hash, and for P0 and P1 the `AT-<R-ID>` passes (Part 0.7 rule 3) |
   | B | Partial | Status Partial with a reason other than "awaiting owner device test": code exists and a named test fails or a named part is missing |
   | C | Unverified | Status Partial with the reason "awaiting owner device test": code exists, the automated tests pass, and a named XT or LT row is "not run" (12.11.3 rule 6) |
   | D | Not implemented | Status Unimplemented or Blocked at delivery (Blocked rows name the blocker) |
   | E | Future work | Status Deferred (Part 1.5 and the Deferred registers T03.11, T04.11, T11.12, T12.09, T13.11, T14.08), plus every Unsupported row of `docs/COMPATIBILITY.md` |

   Wording: only group A rows are described as "implemented and tested". Groups B to E are
   never described as complete, done, working, verified or supported; group C rows are
   described as "implemented, not yet verified on devices". A feature in item 4 takes the
   lowest group of its rows (A highest, E lowest).
3. Item 4 ends with the LT result table (4.2) and the "Release-blocking gate" table (4.4) as
   Part 12.11.1 places them; every unresolved gate row and check is repeated in item 11.
4. The report is regenerated, not patched, when a new release candidate supersedes the
   evidence (12.11.3 rule 7); superseded results are not copied.

```text
# Finger Lickin Music - final implementation report

Build: <FLM.VERSION> (<BUILD stamp>), edition Standalone
Commit: <full hash>    File: Finger Lickin Music/FingerLickinMusic.html    SHA-256: <hash>
Report date: <YYYY-MM-DD>    Plan: docs/IMPLEMENTATION-PLAN.md version 1.0.0
<release status sentence of Part 14.3.4>

How to read this report: every requirement is in exactly one group.
A - Implemented and tested: every named test passed on this build.
B - Partial: code exists; a named test fails or a part is missing.
C - Unverified: code exists and automated tests pass; a device or manual test has not been run.
D - Not implemented: not built in this release, or blocked.
E - Future work: deferred by decision, or a format that is not supported.

## 1. Final standalone HTML artifact
| Field | Value |
|---|---|
| Path | Finger Lickin Music/FingerLickinMusic.html |
| Commit | <hash> |
| SHA-256 | <hash> |
| Size | <bytes> bytes (target 1,572,864; limit 2,621,440): <within target, over target, or over limit> |
| Build report | <the final report line of node tools/build.mjs> |
| Smoke run | <node tools/selftest.mjs --smoke summary line> |
| Online edition | <"not built" or "built for <relayUrl>, not committed"> |

## 2. Requirements traceability matrix
Final statuses are in Part 15 of docs/IMPLEMENTATION-PLAN.md and in docs/STATUS.md; the
counts below are equal in both (Part 0.7 rule 7).

| Part | Rows | Implemented | Partial | Blocked | Unimplemented | Deferred |
|---|---|---|---|---|---|---|
| B (FLM-1.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| E (FLM-1.1.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| I (FLM-1.2.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| P (FLM-1.3.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| Total | <n> | <n> | <n> | <n> | <n> | <n> |

| Part | A Implemented and tested | B Partial | C Unverified | D Not implemented | E Future work |
|---|---|---|---|---|---|
| B | <n> | <n> | <n> | <n> | <n> |
| E | <n> | <n> | <n> | <n> | <n> |
| I | <n> | <n> | <n> | <n> | <n> |
| P | <n> | <n> | <n> | <n> | <n> |

Acceptance tests: <n> AT tests for P0 and P1 rows; <n> pass, <n> fail, <n> not run. The AT
evaluation table (AT-ID, R-ID, result, tests relied on) is in the Phase 16 LEDGER entry of
<date>.

## 3. Updated implementation table of contents
A T entry's status: Implemented when every R-ID it covers is Implemented; Deferred when every
R-ID it covers is Deferred; Blocked when one covered R-ID is Blocked; Unimplemented when none
is Implemented or Partial; Partial otherwise.

| T-ID | Title | Status | Covered R-IDs not Implemented | Notes |
|---|---|---|---|---|
| <T00.01 to T16.10, one row each> | <title> | <status word> | <R-IDs or none> | <note> |

## 4. Feature-completion report
### 4.1 Features
| Feature | Group | Rows Implemented / total | Evidence | Notes |
|---|---|---|---|---|
| Quick Play | <A to E> | <n>/<n> | <test IDs> | <note> |
| Instrument Mode | | | | |
| Free Play | | | | |
| Studio: recording, overdub, loop record | | | | |
| Studio: piano roll, quantize, undo and redo | | | | |
| Studio: mixer and global reverb | | | | |
| Projects: save, open, autosave, recovery, export | | | | |
| Song Library | | | | |
| Import: MIDI | | | | |
| Import: MusicXML and .mxl | | | | |
| Import: Guitar Pro 3, 4, 5 | | | | |
| Import: audio files as backing tracks | | | | |
| Import inspection and chart preview | | | | |
| Four-button mapping profiles A to F and chart generation | | | | |
| Judging, scoring and calibration | | | | |
| Dance Mode | | | | |
| Multiplayer: Synchronized Play | | | | |
| Multiplayer: Cooperative Band | | | | |
| Multiplayer: Collaborative Studio | E | 0/<n> | Part 1.5 | Deferred |
| Online edition relay | | | | |
| Characters | | | | |
| Progression, history, achievements, daily challenge | | | | |
| Tutorial and onboarding | | | | |
| Settings, Help, About, Diagnostics | | | | |
| Audio engine and 128 GM programs with the drum kit | | | | |
| 3D stage, animation and the Abstract tier | | | | |
| Touch, gamepad and Web MIDI input | | | | |
| Accessibility | | | | |

### 4.2 Live manual test results by area
| Area | LT IDs | Run | Pass | Fail | Not run | Open findings (severity) | Record dates |
|---|---|---|---|---|---|---|---|
| Launch, onboarding and navigation | LT-001 to LT-007 | <n> | <n> | <n> | <n> | <list or none> | <dates> |
| Visual quality and layout | LT-008 to LT-016 | | | | | | |
| Gameplay feel and timing | LT-017 to LT-030 | | | | | | |
| Audio quality | LT-031 to LT-042 | | | | | | |
| Stage, animation and characters | LT-043 to LT-052 | | | | | | |
| Studio, recording and export | LT-053 to LT-062 | | | | | | |
| Import | LT-063 to LT-068 | | | | | | |
| Dance Mode | LT-069 to LT-072 | | | | | | |
| Multiplayer | LT-073 to LT-078 | | | | | | |
| Accessibility | LT-079 to LT-085 | | | | | | |
| Mobile endurance and performance feel | LT-086 to LT-089 | | | | | | |
| Delivery, documentation and final review | LT-090 to LT-096 | | | | | | |
| Total | LT-001 to LT-096 | | | | | | |

### 4.3 Polish review (P 22, T16.09)
Each condition cell: "yes: <evidence IDs>" or "no: <gap>".

| Subsystem | Correct | Consistent | Responsive | Accessible | Resilient | Covered by tests | Integrated | Limits documented | Checked from file:// | No release blocker | Polished |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Audio engine and instruments | | | | | | | | | | | <yes or no> |
| Timing and transport | | | | | | | | | | | |
| Input | | | | | | | | | | | |
| Four-button play and charts | | | | | | | | | | | |
| Rhythm and scoring | | | | | | | | | | | |
| Free Play | | | | | | | | | | | |
| Studio | | | | | | | | | | | |
| Import | | | | | | | | | | | |
| Render and stage | | | | | | | | | | | |
| Characters | | | | | | | | | | | |
| Dance | | | | | | | | | | | |
| Multiplayer | | | | | | | | | | | |
| Progression | | | | | | | | | | | |
| UI and accessibility | | | | | | | | | | | |
| Storage and recovery | | | | | | | | | | | |
| Packaging | | | | | | | | | | | |

Polish gates per P section: <copy of the Part 14.2.23 table with the "Gate at delivery" column>.
Demo content review (Part 10.3.1 rule 2, LT-032): <result per demo>.

### 4.4 Release-blocking gate
| Gate | Condition | State | Tests passing | Tests failing or not run | Evidence record |
|---|---|---|---|---|---|
| G-01 | Audio timing drifts during normal gameplay | <resolved, or unresolved: reason> | <IDs> | <IDs or none> | <LEDGER date, files> |
| G-02 | Stuck notes can persist after stopping or changing modes | | | | |
| G-03 | Valid supported MIDI files lose musical events | | | | |
| G-04 | Saving can silently destroy an existing project | | | | |
| G-05 | The advertised standalone file cannot perform its documented core functions | | | | |
| G-06 | A rendering failure permanently disables audio or transport | | | | |
| G-07 | Mobile controls fail to release inputs reliably | | | | |
| G-08 | Multiplayer accepts invalid authoritative results without the intended validation | | | | |
| G-09 | Required supported file formats have not been tested against a representative corpus | | | | |
| G-10 | Critical errors are silently ignored or reported as successful operations | | | | |
| G-11 | A lower-priority feature is deferred without documented status while core criteria fail | | | | |
| D-01 | The final standalone HTML is provided | | | | |
| D-02 | Any external services or optional resources are documented | | | | |
| D-03 | Dependency licenses are documented | | | | |
| D-04 | Supported file formats and limitations are listed | | | | |
| D-05 | Automated test results and known issues are included | | | | |
| D-06 | No feature is falsely described as complete | | | | |
| Supplementary check 1 | No open Critical defect | | | | |
| Supplementary check 2 | No open release-blocking defect in any subsystem | | | | |
| Supplementary check 3 | No open finding of broken timing, confusing controls or recording loss | | | | |

<release status sentence of Part 14.3.4, repeated>

## 5. Supported file-format and version matrix
<copy of docs/COMPATIBILITY.md section 2 for this build>
Evidence per row: <n> FT tests passing, <n> malformed FT tests passing, real-file LT results
<IDs>; rows below the publication rule are published Partial. Full evidence and limits:
docs/COMPATIBILITY.md sections 3 to 6.

## 6. External dependency and license inventory
<Part 14.6 tables, filled>

## 7. Multiplayer service requirements
| Service | Needed for | Requirement | Default | When unavailable | Recorded values |
|---|---|---|---|---|---|
| None (peer-to-peer by invite codes) | Synchronized Play and Cooperative Band, both editions | WebRTC in the browser; players exchange invite and answer codes through any channel; same network, or the STUN toggle | available | Multiplayer disabled on the main menu with "Multiplayer needs WebRTC, which this browser does not provide." | <XT-058 to XT-064 results> |
| Google public STUN (stun:stun.l.google.com:19302) | connecting players on different networks | reachability of the service from both networks | off | host candidates only after the 3 s gathering timeout; lobby note "STUN server not reachable; connections may only work on the same network." | <XT and LT results> |
| server/relay.mjs (owner-hosted) | room codes in the Online edition only | Node 22 or newer; one TCP port; TLS by a reverse proxy for wss://; no persistence, no credentials, no personal logging; memory <= 64 MB at 100 concurrent rooms; <= 100 KB/s per room; room idle expiry 10 min | not configured | DLG-NetError naming the relay URL; the lobby switches to invite codes | <relay --selftest line; LT-078 and LT-095 results> |

Synchronization quality (I 19, target <= 20 ms): syncErrorMaxMs <value or "not measured">
(net-loopback, <date>); start skew <value or "not measured">; two-device sessions
<XT-063 and XT-064 results>.

## 8. Browser and device compatibility report
<copy of docs/COMPATIBILITY.md sections 8.1, 8.2 and 9 for this build>
XT rows not run, per browser: <list with "awaiting owner device test">.

## 9. Performance measurements
| No. | Budget | Target | Measured value | Device and browser | Tool and scenario | Date | Result |
|---|---|---|---|---|---|---|---|
| <1 to 48, one row per Part 9.1.2 row> | <budget> | <value> | <value with unit, or "not measured"> | <device class, model, browser version, or "headless (software GL)"> | <tool and scenario> | <date> | <pass, fail, or not measured> |

Release-blocking rows (Part 9.1.2): 2, 14, 15, 20, 21, 22. <state of each>.

## 10. Automated test results
Run: node tools/selftest.mjs --all --slow on commit <hash>, <date>; Node <version>,
Playwright <version>, Chromium <version>; node tools/perf.mjs --slow --repeat 3 on the same
commit.

| Category | Defined | Passed | Failed | Skipped | Not run |
|---|---|---|---|---|---|
| UT unit tests | <n> | <n> | <n> | <n> | <n> |
| IT integration tests | | | | | |
| FT file-format tests | | | | | |
| TT timing tests | | | | | |
| FI fault-injection tests | | | | | |
| PT performance tests | | | | | |
| Relay self-test (node server/relay.mjs --selftest) | | | | | |
| Corpus check (node tools/make-corpus.mjs --check) | | | | | |
| Build checks (node tools/build.mjs) | | | | | |
| Smoke run of the shipped file (node tools/selftest.mjs --smoke) | | | | | |

| Self-test group | Tests | Passed | Failed | Minimum count from Part 6 |
|---|---|---|---|---|
| <one row per group> | <n> | <n> | <n> | <n> |

Failures: <test ID, message, STATUS.md defect, or none>.

## 11. Known issues and unsupported features
### 11.1 Open defects (STATUS.md section 6)
| Defect | Severity | Found in T section | Regression test | State |
|---|---|---|---|---|
### 11.2 Unresolved release conditions
<gate rows and supplementary checks of 4.4 that are unresolved, or "none">
### 11.3 Partial (group B)
| R-ID | Requirement | Failing test or missing part |
|---|---|---|
### 11.4 Unverified (group C) and device and manual tests not run
| R-ID or test | What is not yet verified | Owner action |
|---|---|---|
### 11.5 Not implemented (group D)
| R-ID | Requirement | Status | Reason or blocker |
|---|---|---|---|
### 11.6 Future work (group E): deferred features
| Item | Priority | Reason | Where the game says so |
|---|---|---|---|
| <every Part 1.5 Deferred row and every Deferred register row> | | | |
### 11.7 Unsupported formats and features
<the Unsupported rows of docs/COMPATIBILITY.md section 2, and audio-to-notes transcription and notation display>
### 11.8 Published known limitations
<Part 14.7 L-01 to L-21 with their exact sentences>
### 11.9 Risks
Risk state counts (Part 13.3): <open n, retired n, realized n, accepted n>; accepted risks:
<RISK IDs with one line each>.
### 11.10 Owner actions
<push and merge approval; XT and LT rows not run; the game license choice; OQ-1, OQ-2,
OQ-3 results>

## 12. Launch and usage instructions
<Part 14.8 text, filled>

## 13. Optional multiplayer deployment
<Part 14.9 text, filled>

## 14. Packaging verification
| Requirement | Rule | Check | Result | Evidence |
|---|---|---|---|---|
| One file | the game is FingerLickinMusic.html alone | file copied alone to an empty folder runs the core functions | <result> | T16.02 record; LT-090 |
| No build needed to play | players open the file; no tool runs at play time | LT-090 on a clean computer | <result> | LT-090 |
| No runtime dependency | no external script, style, font, image or fetch | build checks (banned APIs, references); XT Network panel shows one request | <result> | build report; XT-001 to XT-005 |
| Encoding | one UTF-8 BOM, LF only, ends with </html> and a newline | build output check | <result> | build report |
| Size | <= 1,572,864 bytes target; never above 2,621,440 bytes | PT-001 | <bytes, result> | PT-001 |
| CSP | exactly one CSP meta with the ADR-12 string | markup check of selftest --smoke | <result> | smoke output |
| Markup | unique ids, html lang, one title, every shell scaffold id present | markup check of selftest --smoke | <result> | smoke output |
| No test code | no 90- to 92- module; FLM.selfTest undefined | selftest --smoke; UT-29-11 | <result> | smoke output |
| No credentials | no key, token or password pattern | build credential-pattern check and static scan | <result> | build report |
| Parses | node --check of the joined shipped and test scripts | build parse check | <result> | build report |
| Works offline from file:// | every local mode with the network disconnected, fresh profile | XT C1 runs; LT-090; IT-030 | <result per browser> | XT and LT records |
| Online edition | differs only by connect-src and RELAY_URL | selftest --smoke --file FingerLickinMusic.online.html | <result or "not built"> | smoke output |
```

### 14.6 Dependency and license inventory template

Filled in T16.05 and copied into `docs/FINAL-REPORT.md` item 6. The expected content is fixed
by ADR-02, Part 2.17 and Part 10.3: zero runtime dependencies, all embedded content original,
four development tools, two optional external services, and the game license notice in force.
A row whose "Checked" cell is not "pass" keeps gate D-03 unresolved. Versions are read, never
assumed: Node from `process.versions.node`, Playwright from
`require('playwright/package.json').version` (recorded in every results JSON), Chromium from
`browser.version()`, Git from `git --version`.

```text
## 6. External dependency and license inventory

### 6.1 Runtime dependencies (shipped in or loaded by FingerLickinMusic.html)
| Dependency | Purpose | Version | License | Loading | Checked |
|---|---|---|---|---|---|
| (none) | - | - | - | - | <pass: build checks found no external reference; XT Network panel showed one request> |

The shipped file loads nothing at runtime: no library, font, sound bank, sample, image,
model or script from any network or file.

### 6.2 Embedded content (Part 10.3.1)
| Content | Origin | License | Where | Checked |
|---|---|---|---|---|
| Application code (all src/*.js, shell.html) | written for this project | the game license (6.5) | whole file | <pass or fail> |
| Instrument patches, drum voices, reverb impulse | procedurally synthesized at runtime from parameters written for this project | the game license | 06-instruments.js, 05-audio.js | <result> |
| Five demo arrangements and the tutorial sequence | composed for this project as compact note data | the game license | 30-content.js | <result; originality review of 6.4> |
| Character options and presets, stage props | procedural geometry from capsules and boxes | the game license | 19-rig.js, 21-stage.js, 22-character.js, 30-content.js | <result> |
| Glyphs and icons (SVG paths in the shell sprite) | drawn for this project | the game license | shell.html | <result> |
| Fonts | none embedded; system font stack | not applicable | CSS | <result> |
| General MIDI program and drum names | GM 1 sound set names used as identifiers | not copyrightable data; no MMA document text copied | 02-theory.js | <result> |
| Format knowledge (SMF, MusicXML, ZIP, Guitar Pro 3-5) | written from public format descriptions; no third-party source code | not applicable | 10-midi.js to 13-guitarpro.js | <result> |
| Trademarks named in the UI (Guitar Pro, MusicXML, General MIDI, Google STUN, browser names) | nominative use only; no logos | not applicable | text only | <result> |
| Test corpus (test-corpus/, not shipped) | generated by tools/make-corpus.mjs from seeds | the game license | repository only | <result> |

Static scan of the shipped file (Part 10.3.1 rule 3: no "@license", no "Copyright (c)" other
than the game notice, no base64 data: payload above 4 KB): <pass or fail with findings>.

### 6.3 Development tools (not shipped, not needed to play)
| Tool | Purpose | Version recorded | License | Used by |
|---|---|---|---|---|
| Node.js | runs tools/*.mjs and server/relay.mjs | <process.versions.node; 22.0 or newer required> | MIT (Node.js license) | build, self-test driver, perf, corpus, relay |
| Playwright (Node module, preinstalled) | drives headless Chromium | <version from playwright/package.json> | Apache-2.0 | tools/selftest.mjs, tools/perf.mjs |
| Chromium (Playwright build, preinstalled) | browser under test | <browser.version()> | BSD-3-Clause and bundled component licenses | tools/selftest.mjs, tools/perf.mjs |
| Git | version control | <git --version> | GPL-2.0 | repository |

No npm package is installed: there is no package.json and no node_modules folder in
Finger Lickin Music/. The tools use only Node built-in modules plus the preinstalled
Playwright module.

### 6.4 Optional external services (off by default; not dependencies of the code)
| Service | Used by | Default | What is sent | When unavailable |
|---|---|---|---|---|
| stun:stun.l.google.com:19302 (Google public STUN) | Multiplayer, "Connect across networks (STUN)" toggle | off | ICE binding requests (public IP discovery) | host candidates only; lobby note "STUN server not reachable; connections may only work on the same network." |
| server/relay.mjs instance hosted by the operator | Online edition room codes only | not configured | the game's multiplayer messages as text frames | DLG-NetError; invite codes still work; every other feature unaffected |

Demo originality review (Part 10.3.1 rule 2): <per demo: reviewer, date, "no 8 consecutive
notes identical in pitch and rhythm to a melody the reviewer can name": pass or fail>;
LT-032 record <date>.

### 6.5 License of Finger Lickin Music
Notice in force: <one of the two lines below>
- Interim (no owner decision recorded): "Copyright (c) 2026 the Finger Lickin Music authors. All rights reserved."
- Owner decision recorded in docs/LEDGER.md on <date>: "<license short notice>"; full text in Finger Lickin Music/LICENSE and on SCR-About.
Review record: LT-094 <date, result>.
```

The interim notice is the build constant `LICENSE_NOTICE` of `src/01-core.js` (Part 10.3.3).
Choosing the license is an owner decision; the implementing session never chooses one and
lists the choice under owner actions (RC-27, RC-30) until the owner records it.

### 14.7 Known limitations to publish at v1

Every limitation below is published at v1 with the exact sentence given, in every place its
row names, and in `docs/FINAL-REPORT.md` item 11.8 and the `README.md` section "Known
limitations" (14.8). Rows L-01 to L-11 are the decided Deferred and Unsupported items of Part
1.5 with its wording; L-12 to L-19 are sentences decided in Parts 2.18, 7.11, 8.6.5, 9.9 and
13 (RISK-58, RISK-64, RISK-71); L-20 and L-21 are decided here (RISK-49 asks Part 14 to list
forged guest timestamps; Part 11 records that MusicXML per-note spelling is not stored).
Sentences are ASCII and are copied character for character into the Part 7.11 text catalog
where a screen shows them; UT-26-23 (text catalog) and LT-091 check the match. A limitation
removed by a later fix is removed from every place at once and from STATUS.md section 5.

| Label | Limitation | Status at v1 | Exact sentence | Source | Where published |
|---|---|---|---|---|---|
| L-01 | Collaborative Studio (shared project editing) is not built | Deferred (P2) | Collaborative Studio is not in this version. Synchronized Play and Cooperative Band are available. | Part 1.5 | SCR-Multiplayer disabled third card; README |
| L-02 | No SoundFont loading; no sampled fidelity level | Deferred (P2) | All instruments are synthesized in real time. Loading SoundFont (.sf2) sound banks is not supported in this version. | Part 1.5 | SCR-Settings Audio note; README |
| L-03 | Instrument timbres are synthesized approximations | design limit (declared fidelity `synth-basic` or `synth-velocity`; `sampled` none) | Instrument sounds are synthesized by this file; no sampled sound bank is included, so timbres approximate General MIDI instruments rather than reproduce recordings. | Part 1.5 | SCR-About limits; README; `docs/COMPATIBILITY.md` section 4 (short form) |
| L-04 | Guitar Pro 6 and 7 files cannot be imported | Unsupported | This is a Guitar Pro 6 or 7 file (.gpx or .gp). Only Guitar Pro 3, 4 and 5 files (.gp3, .gp4, .gp5) can be imported. Export the file as GP5 or as MIDI from Guitar Pro and import that. | Part 1.5 | SCR-ImportInspect error state; SCR-Library picker hint; `docs/COMPATIBILITY.md` section 4 |
| L-05 | Audio files never become notes | Unsupported | Audio files are imported as backing audio only. Notes cannot be generated from audio in this version; use a MIDI, MusicXML or Guitar Pro file for a playable chart. | Part 1.5 | SCR-ImportInspect info row; SCR-About limits; `docs/COMPATIBILITY.md` section 4 |
| L-06 | MusicXML notation is not displayed | Unsupported | MusicXML files are imported as musical events (notes, timing, dynamics, tempo). Sheet music is not displayed. | Part 1.5 | SCR-ImportInspect info row; SCR-About limits; `docs/COMPATIBILITY.md` section 4 |
| L-07 | Web MIDI only in supporting browsers on secure pages | capability-gated: available only where `Caps.webMidi` and `Caps.secureContext` are true | MIDI devices are not available here. Web MIDI needs a supporting browser and a secure page (https:// or localhost). Keyboard, touch and gamepad controls are unaffected. | Part 1.5 | SCR-Settings Input MIDI row (disabled with reason); SCR-Help |
| L-08 | No two players on one keyboard | Deferred (P2) | Two players on one keyboard is not available in this version. Each player uses their own device and connects by invite code. | Part 1.5 | SCR-Multiplayer "How this works"; SCR-Help |
| L-09 | Studio effects are a master limiter and one global reverb | Deferred (P2) for per-track EQ, delay, compression, automation | Effects: Reverb (global, one mix control). Per-track EQ, delay, compression and automation are not in this version. | Part 1.5 | SCR-Studio mixer panel footer |
| L-10 | No host migration; the session ends when the host leaves | Deferred (P2) | The host has left. The session has ended; here are the results so far. | Part 1.5 | DLG-NetError variant for guests, then SCR-Results |
| L-11 | No late join while a song is in progress | Deferred (P2) | A song is in progress. You will join the room when it ends. | Part 1.5 | SCR-Multiplayer lobby status line |
| L-12 | Polyphony, track and import limits | enforced limits | Up to {cap} notes can sound at once on this device ({capReason}). When more notes are needed, the note that is already fading and quietest stops first, then the oldest note. A project holds up to 32 tracks, 100,000 notes per track and 1,000,000 events in total. Imported files may be up to 25 MB (audio files up to 100 MB) with up to 1,000,000 events and 128 tracks. | Part 9.9 | SCR-About limits (placeholders filled at runtime); README and `docs/COMPATIBILITY.md` with {cap} written "64 on computers and 32 on phones and tablets (adjustable in Settings)" and "({capReason})" omitted |
| L-13 | Plain HTTP pages lose Web MIDI | capability-gated | Opening the file directly or over HTTPS gives the full feature set; plain HTTP disables MIDI input. | Part 2.18 | SCR-About; README |
| L-14 | Saved projects may be tied to the file's folder | browser behavior, documented | Keep this file in one folder. Some browsers tie saved projects to the file's location; export your projects before moving the file. | Part 13 RISK-58 | SCR-Library; README; `docs/COMPATIBILITY.md` section 8.3 |
| L-15 | Background-tab playback may stutter | browser behavior, documented | Playback in a background tab may stutter in some browsers. | Part 13 RISK-64 | SCR-Help; README |
| L-16 | The iOS ring and silent switch can mute the game | platform behavior, documented | No sound on iPhone or iPad? Check that the ring and silent switch is not set to silent, and raise the volume. | Part 13 RISK-71 | SCR-Help; README |
| L-17 | Backing audio tracks play only at speed 1.0x | decided limit (Part 8.6.5) | Audio tracks are silent at speeds other than 1.0x. | Part 8.6.5 | speed control on the practice panel and SCR-Studio; README |
| L-18 | Gamepad buttons cannot be remapped | decided limit | Gamepad buttons are fixed in this version. | Part 7.11 S-INP-03 | SCR-Settings Controls; README |
| L-19 | Support claims follow recorded tests only | policy | Browser and file-format support is listed in docs/COMPATIBILITY.md and reflects recorded tests, not assumptions. | Part 1.5 About block | SCR-About limits; README |
| L-20 | A modified guest client can forge input timings inside the validation window | accepted limitation (RISK-49) | Multiplayer scores are computed by the host from every player's inputs and checked against the shared song position. A modified copy of the game could still send altered input timings that pass these checks, so multiplayer results are meant for friendly play and are not protected against cheating. | decided here (RISK-49) | SCR-Multiplayer "How this works"; README |
| L-21 | MusicXML per-note spelling is not kept | decided limit | Note names from MusicXML files are spelled from the key signature; the spelling of individual notes in the file (for example G sharp or A flat) is not kept. | decided here (Part 11 decision) | SCR-ImportInspect info row for MusicXML; `docs/COMPATIBILITY.md` section 3.2 |

The SCR-About "Limits of this version" block is the Part 1.5 block followed by the L-12
line, and gains the sentence "Measured device results are listed in docs/COMPATIBILITY.md."
only under the condition of Part 9.9 rule 1:

```text
Limits of this version
- Instrument sounds are synthesized by this file; no sampled sound bank is included, so
  timbres approximate General MIDI instruments rather than reproduce recordings.
- Import: MIDI (.mid, .midi) format 0, 1 and 2; MusicXML (.xml, .musicxml, .mxl);
  Guitar Pro 3, 4 and 5 (.gp3, .gp4, .gp5). Guitar Pro 6 and 7 files (.gpx, .gp) cannot
  be imported. Audio files (.wav, .mp3, .ogg, .flac, where this browser can decode them)
  are imported as backing audio only; notes are never generated from audio.
- MusicXML and Guitar Pro files are imported as musical events; sheet music and
  tablature are not displayed.
- Studio effects are a master limiter and one global reverb. Per-track EQ, delay,
  compression and automation are not included.
- Multiplayer: 2 to 4 players in Synchronized Play or Cooperative Band. Shared studio
  editing, two players on one keyboard, joining a song in progress and continuing after
  the host leaves are not included.
- MIDI devices are used only where the browser offers Web MIDI on a secure page.
- Browser and file-format support is listed in docs/COMPATIBILITY.md and reflects
  recorded tests, not assumptions.
- Up to {cap} notes can sound at once on this device ({capReason}). When more notes are
  needed, the note that is already fading and quietest stops first, then the oldest
  note. A project holds up to 32 tracks, 100,000 notes per track and 1,000,000 events in
  total. Imported files may be up to 25 MB (audio files up to 100 MB) with up to
  1,000,000 events and 128 tracks.
```

### 14.8 Launch and usage instructions template

Filled in T16.08. The same text becomes the "Play" part of `README.md` (keeping the Part 3.10
structure: the "Develop" section stays after it) and `docs/FINAL-REPORT.md` item 12. Rules:

1. Screen, button and setting names are the Part 7 labels; key names are the default codes of
   BRIEF 7 and Part 6.7.1. When Part 7 or 6.7.1 changes a label or a default, this text follows.
2. Conditional sentences marked `<if ...>` are kept only when the named record exists with a
   pass result; otherwise the sentence is removed. No browser, device or context is named as
   working without its XT record (Part 1.6 policy).
3. The release status sentence of 14.3.4 stands under the first paragraph of `README.md`.

```text
## Play

### Opening the game
- On a computer, double-click FingerLickinMusic.html, or drag it onto an open browser
  window. Nothing is installed and no internet connection is needed. Everything runs from
  this one file.
- Browsers: <the claims of docs/COMPATIBILITY.md section 8.1, each with its tested versions,
  for example "Desktop Firefox <version>: Supported">. Browsers not listed there have not
  been tested.
- Keep this file in one folder. Some browsers tie saved projects to the file's location;
  export your projects before moving the file.
- On a phone or tablet, open the file from a web address: put FingerLickinMusic.html on any
  web server you control and open it over https://. On the same Wi-Fi network you can also
  serve it from your computer: in the folder "Finger Lickin Music" run
  node -e "<the serving command of Part 12.8.1 rule 5>"
  and open http://<your computer's network address>:8080/ on the phone. Over plain http://
  from another computer, MIDI devices are not available.
- <if the XT-005 C1 result is pass:> On Android you can also download the file and open it
  with Chrome from the Files app.
- <if an iOS C1 cell reads "n/a: platform cannot open local HTML files":> On iPhone and iPad
  open the game from a web address; iOS does not run HTML files from the Files app.
- Landscape is recommended on phones. The game asks you to rotate when the screen is too
  narrow for the chosen mode.

### Turning on sound
- Sound starts after your first click, tap or key press; browsers do not allow sound before
  that. If the browser still blocks it, the game shows a dialog with a button to try again.
- When you switch to another app or tab, a song you are playing pauses (Free Play and the
  Studio keep playing). If the sound stopped when you come back, tap once or press a key
  to resume it.
- No sound on iPhone or iPad? Check that the ring and silent switch is not set to silent, and
  raise the volume.
- Playback in a background tab may stutter in some browsers.
- All instruments are synthesized in real time; they approximate General MIDI instruments.
- If your notes sound late or early against the music, open Settings > Calibration and
  choose "Run calibration" (also offered on the pause screen and in Quick Play).

### Controls
| Action | Keyboard (default) | Touch | Gamepad |
|---|---|---|---|
| Four lanes (instrument play, Free Play, Studio) | A, S, K, L | the four pads at the bottom (portrait) or at the side or bottom (landscape); several fingers at once | buttons 0, 1, 2, 3 (bottom, right, left, top face) |
| Four dance directions (left, down, up, right) | Arrow Left, Arrow Down, Arrow Up, Arrow Right; also D, F, J, K | the four dance pads | buttons 2, 0, 3, 1 or the d-pad |
| Octave down, octave up | Q, E | the Octave stepper on the Free Play screen | LB, RB (or d-pad down, up) |
| Sustain | Left Shift or Right Shift | as shown in Help and Controls for the current mode | either trigger |
| Mapping profile 1 to 6 (Free Play and Studio) | 1 to 6 | the profile selector on the Free Play screen | none |
| Pause | Escape | pause button | Start (button 9) |
| Stop all sound | P, or Space while paused | "Stop all sound" on the pause screen | Select (button 8) |
| Menus | Tab and arrow keys to move, Enter to choose, Escape to go back | tap | d-pad to move, button 0 to choose, button 1 to go back, Start for the main button |

- Keys can be changed in Settings > Controls (up to 3 keys per control; conflicts are
  explained). Gamepad buttons are fixed in this version.
- MIDI keyboards: where available, MIDI notes 60, 62, 64 and 65 play the four lanes and the
  sustain pedal holds notes; change them in Settings > Controls. Where MIDI cannot be used
  the game says: "MIDI devices are not available here. Web MIDI needs a supporting browser
  and a secure page (https:// or localhost). Keyboard, touch and gamepad controls are
  unaffected."

### Starting to play
- Quick Play is the first entry of the main menu: pick a built-in song and play right away.
- Instrument Mode plays a chart of one part while the band plays the rest; Free Play lets you
  play without a chart in a key and scale you choose; Studio records tracks; Dance Mode plays
  dance steps; Characters changes the band's look. Help and Controls explains every mode.

### Importing music
- Choose Import Music on the main menu, or drag a file onto the game window.
- MIDI (.mid, .midi), MusicXML (.xml, .musicxml, .mxl) and Guitar Pro 3, 4 and 5 (.gp3, .gp4,
  .gp5) become playable songs. Audio files (.wav, and .mp3, .ogg, .flac where your browser
  can decode them) become backing audio only. See docs/COMPATIBILITY.md for what is kept.
- The import screen shows the tracks, the warnings and a preview of the generated chart.
  Import never changes the open project until you confirm.
- Imported files may be up to 25 MB (audio files up to 100 MB) with up to 1,000,000 events
  and 128 tracks.

### Saving and exporting
- The Studio saves automatically when you stop, when you add or delete a track, and every
  60 seconds while nothing plays; it never saves during recording or playback.
- Projects are stored in this browser on this device. Clearing the browser's site data
  deletes them. If the browser offers no database storage, projects up to 2 MB are kept and
  a notice says so.
- Exporting is the real backup: projects (.flm.json), MIDI (.mid), audio mix (.wav), dance
  charts (.flmdance.json), characters (.flmchar.json) and settings (.flmsettings.json). Open a
  saved project file again with Import Music or from the Song Library.
- When saving fails, the game says so and offers Export; it never reports a failed save as
  saved.

### Playing together (Multiplayer)
Two to four players, each on their own device, in Synchronized Play (everyone plays the
same chart and scores are compared) or Cooperative Band (each player plays a different part
of the same song). Open Multiplayer and read "What is shared" first.

Standalone edition (this file), by invite codes:
1. Host: enter your name, choose "Create room", then "Copy invite code" and send the code to
   the other player by any message app or e-mail.
2. Guest: choose "Join room", paste the invite code, choose "Create answer", then copy the
   answer code and send it back to the host.
3. Host: paste the answer code and choose "Connect". For a third and fourth player choose
   "Invite another player" and repeat.
4. Everyone chooses "Ready"; the host picks the experience, the song and the difficulty and
   chooses "Start".
- Same network: works without anything else. Different networks: turn on "Connect across
  networks (STUN)" before creating the codes; it uses Google's public STUN server.
- The host keeps the shared clock and the scores. If the host leaves, the session ends and
  shows the results so far.

Online edition (a separate file built by the operator of a relay server):
1. Open the Online edition file at the address the operator gives you.
2. Host: choose "Create room with a room code" and tell the others the 6-character code.
3. Guests: choose "Join with a room code" and type the code.
4. If the relay server cannot be reached, the game says so and you can still play by
   exchanging invite codes as above.

### When something goes wrong
- Settings > Advanced > "Open diagnostics" shows what this browser supports and offers
  "Export diagnostics" (a .flmdiag.json file without your songs) for a bug report.

### Known limitations
<the exact sentences of Part 14.7 L-01 to L-21, one bullet each; L-12 with {cap} written "64
on computers and 32 on phones and tablets (adjustable in Settings)">
```

### 14.9 Relay deployment instructions template

Filled in T16.08 and written as `docs/FINAL-REPORT.md` item 13; the `README.md` "Develop"
line for the relay points to it. All values restate Part 3.7 (server behavior) and Part 1.4
(hosting requirements and budgets); Part 3.7 governs. The relay is optional: the Standalone
edition never needs it, and the Online edition keeps invite codes when it is unreachable.
Recorded values (memory, bandwidth) come from a relay run during LT-078 or LT-095, or read
"not measured". LT-095 is the walkthrough of exactly these steps by someone other than the
implementer.

```text
## 13. Optional multiplayer deployment (relay server for the Online edition)

What the relay does: it forwards text messages between the 2 to 4 members of a room that
players join by a 6-character room code. It stores nothing, computes nothing about the game
(the host player's game keeps the clock and the scores), has no accounts, no credentials, no
admin endpoint, no configuration file and no outbound connection. The Standalone edition
(FingerLickinMusic.html) does not use it.

Requirements
- A machine reachable by the players with Node.js 22 or newer. No npm install: the relay is
  the single file server/relay.mjs and uses only Node built-in modules.
- One TCP port (default 8787).
- For game pages served over https://: TLS terminated by a reverse proxy so players connect
  with wss://. A game file opened from file:// may also use ws://.
- Budgets: memory <= 64 MB at 100 concurrent rooms; outbound bandwidth <= 100 KB/s per room
  at the worst-case rate limits. Recorded on this release: memory <value or "not measured">,
  bandwidth <value or "not measured">.
- Operating cost: one small always-on process.

Steps
1. Copy server/relay.mjs to the machine, for example to /opt/flm-relay/relay.mjs.
2. Check it: node /opt/flm-relay/relay.mjs --selftest
   It prints RELAY SELFTEST <passed>/<total> and exits 0 when every check passes.
3. Start it: PORT=8787 HOST=0.0.0.0 node /opt/flm-relay/relay.mjs
   Behind a reverse proxy on the same machine use HOST=127.0.0.1.
   | Variable | Default | Meaning |
   |---|---|---|
   | PORT | 8787 | TCP port |
   | HOST | 0.0.0.0 | bind address |
   | MAX_ROOMS | 200 | creating a room fails with SERVER_FULL above this |
   | LOG_LEVEL | info | silent, error, warn, info or debug |
4. Check health: open http://<host>:8787/health; the answer is
   {"ok":true,"rooms":0,"connections":0}. Any other path answers 404.
5. For wss://, put the reverse proxy in front (snippet A) and open only the proxy's port to
   the internet.
6. Keep it running across reboots (snippet B), or with any process manager that restarts it
   on failure.
7. Build the matching game file in the repository:
   node tools/build.mjs --online wss://<your relay host>/
   This writes Finger Lickin Music/FingerLickinMusic.online.html. It is the shipped game with
   the relay address added and the page's connect-src allowing that address; it is not
   committed because it names your server.
8. Give players FingerLickinMusic.online.html, or host it over https:// and give them its
   address. In Multiplayer they choose "Create room with a room code" or "Join with a room
   code".
9. Test it: two devices create and join a room, play one song, then stop the relay and check
   that both see the relay error and can continue with invite codes (LT-078).

Limits the relay enforces
| Limit | Value | When exceeded |
|---|---|---|
| Members per room | 4 | ROOM_FULL |
| Rooms | MAX_ROOMS (default 200) | SERVER_FULL |
| Message size | 65,536 bytes | connection closed (code 1009) |
| Messages per connection | 60 per second | message dropped with RATE_LIMIT; the fourth RATE_LIMIT within 10 s closes the connection (1008) |
| Malformed frames | third BAD_FRAME on a connection | connection closed (1008) |
| Room idle time | 10 minutes without any message | room closed with reason "expired" |
| Keepalive | ping every 30 s; no pong within 30 s | connection dropped (counts as leaving) |
| Send backlog | 1 MB per connection | connection closed (1008) |

Operating notes
- A restart or crash drops every room; players see the relay error, keep their local
  results and can reconnect by room code or invite codes. Stopping with SIGTERM tells every
  room "shutdown" first.
- When the host (member 1) leaves, the relay closes the room with reason "host-left".
- Logging never contains IP addresses, user agents, room codes or message contents at any
  level; info logs startup, room counts and shutdown; warn logs limit violations by code.
- The relay does not check the page origin, because the game is a distributed file that
  may run from file:// or any host; the rate and size limits protect it instead.
- Privacy: players' messages pass through your server unread and are never stored. Tell
  your players who operates the relay.
```

Snippet A (nginx reverse proxy for `wss://`, Part 3.7.1 directives; certificate paths are
the operator's):

```text
server {
  listen 443 ssl;
  server_name <your relay host>;
  ssl_certificate     <path to certificate>;
  ssl_certificate_key <path to key>;
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 120s;
  }
}
```

Snippet B (systemd service; the operator creates the unprivileged user `flmrelay`):

```text
[Unit]
Description=Finger Lickin Music relay
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/flm-relay/relay.mjs
Environment=PORT=8787 HOST=127.0.0.1 LOG_LEVEL=info
Restart=on-failure
User=flmrelay
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

