# Plan: Write the complete implementation plan for "Finger Lickin Music"

## Context

The uploaded specification (Finger_Lickin_Music.txt, 3,194 lines, four versioned parts: base spec FLM-1.0, Edge Cases FLM-1.1.0, Essential Improvements FLM-1.2.0, Maximum-Polish Checklist FLM-1.3.0) describes a single-file browser music game. Its section 1 mandates that, before any code is written, a complete end-to-end table of contents plus 13 planning artifacts are produced.

The user's revised request: do not implement the game now. Produce one complete implementation plan document, start to finish (Phase 0 planning through Phase 16 delivery and the final report), in a new folder alongside the three existing games. A later session running Opus 5.5 at high effort will execute it.

Repo facts the plan must respect (verified):
- Three games, each one self-contained HTML, own WebGL renderer, Web Audio, zero libraries, zero network requests, CSP meta, safe-area CSS, in-page self-test, versioned localStorage keys wrapped in try/catch.
- ClassTimeKiller is the precedent for a documented project: `src/shell.html` + `src/NN-name.js` joined by `node tools/build.mjs` into one HTML; committed `docs/` (SPECIFICATION, ARCHITECTURE, IMPLEMENTATION-STEPS with phases and gates, LIVE-TESTS with ID'd tests, PERFORMANCE); `tools/selftest.mjs` drives headless Chrome with no npm deps.
- IRON HORIZON is the precedent for serverless multiplayer: WebRTC DataChannel, copy-paste invite codes, optional Google STUN toggle, host authority, 2-4 players.
- Breakpoint and IRON HORIZON are UTF-8 with BOM, LF. `.claude/project-profile.md`: push only after owner's go; checks are in-browser self-tests plus a node syntax parse.
- Environment: Node 22, Playwright + Chromium present, npm registry reachable, all CDNs blocked (403). Confirms the zero-dependency, nothing-remote design.
- Git: branch `claude/modest-ramanujan-pgmwvt` exists locally and remotely at `d2360a1` (same as `main`). Clean tree.

## Deliverable

Folder: `/home/user/HTML-Games/Finger Lickin Music/` (product name, like `ClassTimeKiller/`).

Files:
1. `Finger Lickin Music/docs/IMPLEMENTATION-PLAN.md` -- the single complete plan (Markdown: tables are needed for the traceability matrix and test plans; faster to produce and read than txt).
2. `Finger Lickin Music/docs/SPECIFICATION.txt` -- the uploaded spec copied verbatim, so the plan's spec references resolve inside the repo for the implementing session. (Supporting input, not new content.)
3. `Finger Lickin Music/README.md` -- 10-15 lines: status "specification and plan only, no game yet", where the plan is, how to start implementing (the plan's Section 0 operating instructions).

Format rules (user preference + repo convention): UTF-8 with BOM, LF line endings, ASCII-only characters (no em-dashes, arrows, curly quotes, box drawing), consistent terminology. Status vocabulary fixed to: Implemented / Partial / Blocked / Unimplemented / Deferred.

Expected size: 250-400 KB, 6,000-10,000 lines. One file as requested.

## Document outline (what IMPLEMENTATION-PLAN.md will contain)

Section 0. Front matter and operating instructions for the implementing agent
- Plan version, date, spec versions covered, how to read, ID conventions, status vocabulary.
- Repo conventions to follow: folder, source layout, build, BOM/LF, in-page self-test entry `window.FLM.selfTest()`, commit message prefix `Finger Lickin Music: ...`, push only after owner's go.
- Session segmentation guidance for Opus 5.5 High: one phase (or half phase) per session, a `docs/LEDGER.md` resume log (IRON HORIZON pattern: newest first, RESUME line), the implementation-discipline rules from spec 1.4 restated as a checklist, the autonomy clause from spec 1.3.

Section 1. End-to-end Table of Contents (spec 1.1) -- the executable roadmap
- Phases 0-16 per spec 27, each broken into sections `T<pp>.<nn>`.
- Every entry carries the 8 mandatory fields: ID; title and position; purpose and outcome; requirements covered (REQ IDs); dependencies (T IDs); deliverables (files, functions, UI, docs); verification (test IDs); open decisions, assumptions, risks.
- Includes as dedicated sections the 17 additions required by FLM-1.1.0 section 12 and the 18 additions required by FLM-1.2.0 section 20 (risk register, audio lifecycle matrix, drift test plan, MIDI edge corpus, MusicXML/GP matrix, input lifecycle tests, scoring boundaries, recording integrity, rendering degradation, dance validation, multiplayer sync/security, browser/standalone matrix, storage/migration, dependency/offline tests, fault injection, traceability, failure-recovery review; unified engine, adaptive difficulty, GM strategy, animation/direction, non-destructive editing, import inspection/chart generator, dance, progression, multiplayer modes, onboarding, mobile profiles, autosave/recovery, packaging budget, accessibility, data-driven instruments, quality gates, quantitative targets, final quality review).

Section 2. Requirements Traceability Matrix (spec 1.2 item 2)
- One row per requirement bullet across all four spec parts. Columns: REQ ID | Spec ref | Requirement (short) | Priority P0/P1/P2 | Subsystem/module | Phase and T section | Tests | Status (all Unimplemented at plan time).
- Grouped by spec part: B (base), E (edge cases), I (improvements), P (polish).

Section 3. Architecture and Technology Decision Record (ADR-01..ADR-~20)
Decisions to record, each with alternatives compared on the spec 19.3 criteria:
- ADR Single-file delivery: `src/` modules + `tools/build.mjs` -> `FingerLickinMusic.html` (CTK precedent); dev build also emits gitignored `FingerLickinMusic.test.html` with self-tests. Build strips per-file BOMs and emits one leading BOM. Hard size ceiling in build (recommend 2.5 MB fail, 1.5 MB target).
- ADR Zero runtime dependencies (repo convention; CDNs blocked; offline edge cases). three.js (MIT, ~650 KB) rejected with reasons; own WebGL2 renderer with WebGL1 path and 2D-canvas fallback tier.
- ADR Audio: Web Audio API, data-driven instrument definitions by GM family (layered oscillator/FM/noise patches, velocity layers, ADSR, per-instrument declared fidelity level), synthesized GM drum kit on channel 10, voice allocator with documented note stealing, lookahead scheduler on `AudioContext.currentTime`. No bundled sampled bank (licensing and size); optional user-loaded SoundFont (.sf2) reader listed as P2 and not promised.
- ADR Parsers: own SMF parser (format 0/1/2, SMPTE timing), own MusicXML importer (DOMParser for .xml/.musicxml; .mxl via own ZIP/inflate reader), own Guitar Pro reader for GP3/GP4/GP5 only (.gp3/.gp4/.gp5); GP6/7 (.gpx/.gp) explicitly Unsupported. Audio files via `decodeAudioData` as audio tracks only, never note data.
- ADR Multiplayer: WebRTC DataChannel P2P with copy-paste invite codes and optional public STUN toggle (IRON HORIZON precedent), host-authoritative shared clock; plus a documented optional zero-dependency Node relay server `server/relay.mjs` (Online edition, Profile B). Standalone edition never needs either.
- ADR Timeline: integer ticks at PPQ 960 internally, tempo map to seconds, audio clock authoritative, render loop interpolates; lookahead ~120 ms, scheduler tick ~25 ms.
- ADR Storage: localStorage (settings, index) + IndexedDB (projects, recordings), versioned keys, safe-write with verify and .bak, export/download as the real backup; quota handling.
- ADR Encoding/line endings: UTF-8 BOM + LF for all new files.
- ADR Input: Pointer Events primary, keyboard, Gamepad API, optional Web MIDI (secure context only).
- ADR Testing: in-page self-test groups (CTK pattern) + `tools/selftest.mjs` via Playwright/Chromium + `tools/perf.mjs`; test corpus generated by `tools/make-corpus.mjs` (synthetic MIDI/MusicXML/GP files, malformed and truncated variants) checked into `test-corpus/`.

Section 4. System dependency graph and subsystem integration map
- Module list `M-01..M-~24` mapping to `src/NN-name.js` files with load order, public interface per module, allowed dependency directions (ASCII diagram), event bus contracts, init sequence, mode transition teardown contract.

Section 5. Data model and serialization specification
- Internal music representation (Song, TempoMap, MeterMap, KeyMap, Track, Event types, Controller events, import warnings) with field tables.
- Project file format `flm-project` v1 JSON schema, migration rules, size accounting.
- Mapping profile schema (A-F), chart schema (generated gameplay chart separate from source), dance chart schema, character config schema, settings schema, performance history schema, multiplayer message envelope schema with versioning.
- Export schemas: .mid writer, project JSON, dance chart JSON, character preset JSON, WAV mix; round-trip test references.

Section 6. User interface and navigation specification
- Screen inventory and flow (first launch, main menu with 12 entries, Quick Play, Instrument Mode, Free Play, Studio, Song Library, Import inspection, Dance, Multiplayer, Customization, Settings, Help, About/Licenses, Diagnostics).
- Three complexity levels, contextual controls, responsive rules (portrait/landscape, safe areas, touch target sizes), empty/loading/success/error/disabled states per screen, tutorial steps, keyboard navigation and focus rules, reduced motion.

Section 7. Audio, timing, input, rendering, multiplayer architecture
- Transport state machine (stopped/playing/paused/recording/count-in), pause/seek/loop rules for active notes, speed change rule, background-tab recovery.
- Scheduler design, voice allocation and limits, panic/all-notes-off, sustain pedal semantics, program change during sustain.
- Input lifecycle state machine (press/hold/release/cancel, focus-loss release, key-repeat suppression, duplicate pointer/touch suppression), calibration model (input offset, audio latency, visual lead; applied once).
- Judgment windows in ms per difficulty (Beginner/Intermediate/Advanced/Expert) and scoring formula (deterministic), combo rules, boundary rules.
- Renderer tiers (High/Balanced/Low/Abstract/2D), rig definition (joint list, attachment points), per-instrument animation controllers (keys, guitar/bass, drums, strings, winds/brass, percussion, synth, abstract), stage director rules, resource disposal.
- Multiplayer protocol: message types, clock-offset estimation (NTP-style), scheduled start, input timestamping, duplicate/out-of-order handling, reconnection, host departure, payload limits, what is authoritative.

Section 8. File import/parsing/conversion/export and compatibility strategy
- Import pipeline stages (validate, identify, parse, normalize, metadata, warnings, inspect, publish), limits (max file size, event counts, track counts), per-format feature preservation tables, compatibility matrix with Supported/Partial/Conversion/Unsupported statuses, corpus definition.

Section 9. Performance budgets and target-device matrix
- Concrete numeric budgets set now (as spec FLM-1.2.0 section 19 requires they be set in planning): file size, load time, time to first playable, FPS per tier, scheduler precision, input latency, memory, max voices (desktop/mobile), max tracks, multiplayer update rate, serialization time. Device matrix: Chromium desktop, Firefox desktop, Safari desktop, iOS Safari, Android Chrome, with recording fields for versions and devices.

Section 10. Security, privacy, accessibility, error handling
- Parser hardening rules, CSP, no credentials, privacy statement for multiplayer, accessibility requirement list with tests, error taxonomy (recoverable vs return-to-menu vs reload), failure-recovery matrix per subsystem using the 9 questions of FLM-1.1.0 section 11, the minimum recovery rules.

Section 11. Phased implementation plan with gates
- Table: Phase | Entry criteria | Exit criteria | Dependencies | Regression suite to run | Suggested session count. Phase 0 marked Complete-by-this-document.

Section 12. Comprehensive testing and acceptance plan
- Unit (UT), integration (IT), file-format (FT), timing (TT), performance (PT), cross-device (XT), fault-injection (FI), live manual (LT), acceptance (AT) test tables with ID | Area | Setup | Steps | Expected | Pass criterion. Every P0/P1 REQ gets at least one AT. Release-blocking gate list (FLM-1.1.0 section 13).

Section 13. Risk register
- RISK-nn | Severity | Description | Impact | Mitigation | Owning phase/T section | Verifying tests. Seeds from FLM-1.1.0 section 1 plus prohibited-mistakes list (section 10) turned into guards.

Section 14. Release and delivery checklist; Final Implementation Report template
- Delivery checklist, dependency/license inventory template (expected: none at runtime), supported-format matrix template, the 14-item final report template (spec 28), maximum-polish checklist (FLM-1.3.0 sections 1-22) mapped to subsystems as polish gates, known-limitations list to publish.

Appendices: A. Spec coverage map (every spec section -> plan sections). B. Glossary. C. Prohibited mistakes checklist with the guard for each.

## ID conventions (fixed before drafting so cross-references are consistent)
- Requirements: `R-B<sec>-<nn>` base spec, `R-E<sec>-<nn>` edge cases, `R-I<sec>-<nn>` improvements, `R-P<sec>-<nn>` polish. Example `R-B7.3-04`.
- TOC sections: `T<pp>.<nn>` (phase two digits). Modules: `M-nn`. Decisions: `ADR-nn`. Risks: `RISK-nn`.
- Tests: `UT-nnn`, `IT-nnn`, `FT-nnn`, `TT-nnn`, `PT-nnn`, `XT-nnn`, `FI-nnn`, `LT-nnn`, `AT-nnn`.

## Production method (Ultracode: orchestrated workflow)

1. Inline: write the skeleton, ID conventions, architecture decisions above, and a repo-conventions brief into a shared brief file in the scratchpad. Copy the spec into the scratchpad for agents to read.
2. Workflow, phase "Draft": ~14 agents in parallel, one per plan section (Section 1 split into Phases 0-5, 6-10, 11-16), each writing its part to `scratchpad/plan-parts/NN-<name>.md` using the shared brief and the spec. Agents return a structured summary (IDs defined, IDs referenced, spec sections covered).
3. Workflow, phase "Cover" (barrier is justified: cross-part coverage): 4 critic agents, one per spec part (B, E, I, P), each checks every requirement bullet in its spec part appears in the traceability matrix and is assigned to a T section and tests; returns gaps. Then fix agents patch the parts. Repeat until a round finds no gaps (max 3 rounds; log what remains).
4. Workflow, phase "Verify": 3 skeptic agents check cross-reference integrity (every referenced T/R/ADR/test ID is defined once), the 8 mandatory fields on every TOC entry, ASCII-only text, consistent terminology, no feature claimed as implemented. Fix agents patch.
5. Inline: concatenate parts in order into `IMPLEMENTATION-PLAN.md`, generate the contents list, write README.md, copy SPECIFICATION.txt. Node script adds BOM, normalizes LF, and runs the mechanical checks (see Verification).
6. Git: commit on `claude/modest-ramanujan-pgmwvt` with message `Finger Lickin Music: complete implementation plan (spec FLM-1.0 to 1.3.0), no game code yet`; push with `git push -u origin claude/modest-ramanujan-pgmwvt` (branch was created for this session; the project-profile push rule applies to `main`). No pull request.

## Verification
- `node` script over the final file: BOM present, LF only, zero non-ASCII bytes after the BOM, every `T`, `R-`, `ADR-`, `RISK-`, test ID referenced is defined exactly once, every TOC entry has the 8 field labels, every spec section number from all four parts appears in Appendix A, Markdown tables have consistent column counts.
- Coverage count reported: number of requirement rows per spec part, number of TOC sections, number of tests, number of P0/P1 requirements lacking an AT (must be 0).
- `git status` clean after commit; `git log -1` shows the commit; push confirmed.

## Recovery note (added after the first drafting run)

The first drafting run started while plan mode was still active. Its agents could not write
to the scratchpad, so ten completed drafts (Parts 0, 1, 2, 3, 4, 5, 6a, 6b, 6c, 6d; about
1 MB) were stored verbatim inside agent plan files under `/root/.claude/plans/`. The run was
stopped before later stages ran against missing inputs. After plan mode ends: extract those
drafts into the scratchpad `parts/` directory (strip the agents' wrapper notes and
BEGIN/END markers), then resume the same workflow run; completed agents return cached
results and the remaining parts, tests, roadmap, coverage and consistency stages run live.

## Out of scope for this session
- No game code, no `src/`, no build tools, no HTML. The plan documents them; the later Opus 5.5 session creates them.
