# Finger Lickin Music - STATUS

Plan version: 1.0.0
Updated: 2026-10-29 (UTC date of the last change to this file)
Current phase: Phase 05
Last completed T section: T04.12
Build: FingerLickinMusic.html 993877 bytes
Self-test (--all): 773/773 on 2026-10-29 (25 groups; two other runs of the same code failed only IT-040 under load)
Live and device tests (LT, XT): not run

## 1. Counts per specification part

| Part | Rows | Implemented | Partial | Blocked | Unimplemented | Deferred |
|---|---|---|---|---|---|---|
| B (FLM-1.0) | 921 | 0 | 0 | 0 | 906 | 15 |
| E (FLM-1.1.0) | 364 | 0 | 0 | 0 | 361 | 3 |
| I (FLM-1.2.0) | 343 | 0 | 0 | 0 | 336 | 7 |
| P (FLM-1.3.0) | 360 | 0 | 0 | 0 | 359 | 1 |
| Total | 1988 | 0 | 0 | 0 | 1962 | 26 |

## 2. Phase gates

| Phase | T sections done / total | Gate commit | Gate date | --all result |
|---|---|---|---|---|
| Phase 00 | satisfied by plan 1.0.0 | n/a | 2026-10-25 | n/a |
| Phase 01 | 12 / 12 | gate commit (see LEDGER) | 2026-10-27 | 246/246 |
| Phase 02 | 9 / 9 | gate commit (see LEDGER) | 2026-10-27 | 326/326 |
| Phase 03 | 12 / 12 | gate commit (see LEDGER) | 2026-10-27 | 586/586 |
| Phase 04 | 12 / 12 | OPEN: the gate run misses PT-004 and PT-012 tickWorkMaxMs and PT-004 lateEvents (see LEDGER, second review round) | 2026-10-29 | 772-773/773, IT-040 flaky under load (OI-47) (776/776 with --slow) |
| Phase 05 | 0 / - | - | - | - |
| Phase 06 | 0 / - | - | - | - |
| Phase 07 | 0 / - | - | - | - |
| Phase 08 | 0 / - | - | - | - |
| Phase 09 | 0 / - | - | - | - |
| Phase 10 | 0 / - | - | - | - |
| Phase 11 | 0 / - | - | - | - |
| Phase 12 | 0 / - | - | - | - |
| Phase 13 | 0 / - | - | - | - |
| Phase 14 | 0 / - | - | - | - |
| Phase 15 | 0 / - | - | - | - |
| Phase 16 | 0 / - | - | - | - |

## 3. Not Implemented, listed individually

Every Deferred row is listed here (Part 0.7 rule 2). Rows of phases that have started and are not Implemented are added as their phase starts.

| R-ID | Status | Phase | Reason (one line) | Disclosure (screen, doc, or n/a) |
|---|---|---|---|---|
| R-B4.4-02 | Deferred | T12.09 | Additional formats: SoundFont and other sequencer or notation adapters (adapter registry ready) | Part 1.5 / SCR-About (Part 7.11) |
| R-B4.4-03 | Deferred | T14.08 | Advanced articulation synthesis: legato, portamento, glissando | Part 1.5 / SCR-About (Part 7.11) |
| R-B4.4-04 | Deferred | T14.08 | More sophisticated procedural humanoid animation (for example finger-level keys animation) | Part 1.5 / SCR-About (Part 7.11) |
| R-B4.4-05 | Deferred | T11.12 | Advanced dance styles and a choreography editor | Part 1.5 / SCR-About (Part 7.11) |
| R-B4.4-07 | Deferred | T11.12 | Free-form stage customization editor | Part 1.5 / SCR-About (Part 7.11) |
| R-B4.4-08 | Deferred | T14.08 | Advanced mixing and editing: automation, per-track effects, EQ, delay, compression | Part 1.5 / SCR-About (Part 7.11) |
| R-B4.4-10 | Deferred | T03.11 | One-switch and other alternative accessibility input mappings (P2): v1 meets motor-access needs through full remapping, three pad sizes and gamepad support, and a scanning one-switch mode needs its own timing model for the judge | SCR-Help Accessibility: "One-switch play is not available in this version. Every control can be remapped and touch pads can be enlarged." (Core.Text S-INP-09) |
| R-B4.4-11 | Deferred | T13.11 | Optional community features (no accounts, servers, telemetry or shared content in v1) | Part 1.5 / SCR-About (Part 7.11) |
| R-B7.7-13 | Deferred | T13.11 | Host migration to a guest when the host leaves | Part 1.5 / SCR-About (Part 7.11) |
| R-B7.7-18 | Deferred | T13.11 | Shared creative sessions: Collaborative Studio rules specified, shown as a disabled card | Part 1.5 / SCR-About (Part 7.11) |
| R-B11.1-03 | Deferred | T04.11 | Sampled instrument sounds from a user-loaded SoundFont (.sf2), P2: no bundled bank for size and licensing, a user-loaded reader is a separate feature; every instrument is synthesized (Instruments.fidelity says so) | SCR-Settings Audio (set-fidelity, S-AUD-01): "All instruments are synthesized in real time. Loading SoundFont (.sf2) sound banks is not supported in this version." and SCR-About limits (S-AUD-02) |
| R-B15.5-06 | Deferred | T12.09 | Other sequencer or notation formats through verified adapters | Part 1.5 / SCR-About (Part 7.11) |
| R-B16.5-08 | Deferred | T14.08 | Further effects: delay, per-track compression, EQ and automation | Part 1.5 / SCR-About (Part 7.11) |
| R-B17.3-05 | Deferred | T13.11 | Late-joining players during a song: the joiner waits in the lobby until the song ends | Part 1.5 / SCR-About (Part 7.11) |
| R-B24-03 | Deferred | T04.11 | Actionable error for failed sound-bank loading, P2: applies only once SoundFont loading exists; no loading path exists, so no error can occur | none beyond the SoundFont disclosure of R-B11.1-03; a dropped .sf2 file is refused at identification (E-IMP-006, Phase 07) |
| R-E4.1-06 | Deferred | T03.11 | Two players on one keyboard (local two-player mode, P2): eight simultaneous keys exceed the key-rollover limits of common keyboards, so scoring would be unreliable; multiplayer on separate devices covers the use case | SCR-Help now, SCR-Multiplayer How this works in Phase 13: "Two players on one keyboard is not available in this version. Each player uses their own device and connects by invite code." (Core.Text S-NET-02) |
| R-E8.1-06 | Deferred | T13.11 | Host migration so a session continues after the host leaves | Part 1.5 / SCR-About (Part 7.11) |
| R-E8.1-08 | Deferred | T13.11 | Late join into a song in progress with chart and position catch-up | Part 1.5 / SCR-About (Part 7.11) |
| R-I3.1-02 | Deferred | T14.08 | Sampled instruments: none bundled; sampled playback via a user SoundFont is a separate P2 feature | Part 1.5 / SCR-About (Part 7.11) |
| R-I3.2-03 | Deferred | T14.08 | Legato, portamento, glissando and other advanced articulation synthesis | Part 1.5 / SCR-About (Part 7.11) |
| R-I10.1-04 | Deferred | T13.11 | Collaborative Studio: shared project with explicit ownership, edit permissions and conflict handling | Part 1.5 / SCR-About (Part 7.11) |
| R-I10.4-01 | Deferred | T13.11 | Collaborative editing with rules for simultaneous edits, versioning, permissions, conflicts | Part 1.5 / SCR-About (Part 7.11) |
| R-I12-07 | Deferred | T14.08 | Adjustable sound-bank loading: no sound banks exist in v1; tied to the SoundFont feature | Part 1.5 / SCR-About (Part 7.11) |
| R-I14.3-04 | Deferred | T14.08 | Downloadable sound banks or assets only if their absence keeps standalone working; v1 ships none | Part 1.5 / SCR-About (Part 7.11) |
| R-I18-08 | Deferred | T13.11 | Tier 7 Online: collaborative editing | Part 1.5 / SCR-About (Part 7.11) |
| R-P13-09 | Deferred | T13.11 | Collaborative Studio conflict handling is specified (Part 6.24 rules); the feature is not built in v1 | Part 1.5 / SCR-About (Part 7.11) |

## 4. Not yet reached, summarized per phase

| Phase | Unimplemented rows | Deferred rows |
|---|---|---|
| T00.01 | 7 | 0 |
| T00.01, T00.07 | 2 | 0 |
| T00.02 | 13 | 0 |
| T00.03 | 11 | 0 |
| T00.04 | 3 | 0 |
| T00.05 | 2 | 0 |
| T00.06 | 5 | 0 |
| T00.06, T00.09 | 1 | 0 |
| T00.07, T00.08 | 1 | 0 |
| T00.09 | 1 | 0 |
| T01.01 | 14 | 0 |
| T01.02 | 15 | 0 |
| T01.02, T04.10 | 2 | 0 |
| T01.03 | 3 | 0 |
| T01.04 | 20 | 0 |
| T01.05 | 13 | 0 |
| T01.06 | 44 | 0 |
| T01.07 | 18 | 0 |
| T01.08 | 4 | 0 |
| T01.09 | 9 | 0 |
| T01.10 | 13 | 0 |
| T01.10, T04.10 | 1 | 0 |
| T01.11 | 11 | 0 |
| T01.12 | 5 | 0 |
| T02.01 | 2 | 0 |
| T02.02 | 16 | 0 |
| T02.03 | 15 | 0 |
| T02.04 | 12 | 0 |
| T02.05 | 10 | 0 |
| T02.06 | 5 | 0 |
| T02.07 | 7 | 0 |
| T02.08 | 2 | 0 |
| T02.09 | 1 | 0 |
| T03.01 | 10 | 0 |
| T03.01, T03.03 | 1 | 0 |
| T03.02 | 27 | 0 |
| T03.02, T03.03 | 3 | 0 |
| T03.03 | 24 | 0 |
| T03.03, T03.09 | 1 | 0 |
| T03.04 | 10 | 0 |
| T03.05 | 25 | 0 |
| T03.06 | 33 | 0 |
| T03.07 | 23 | 0 |
| T03.08 | 15 | 0 |
| T03.09 | 4 | 0 |
| T03.10 | 2 | 0 |
| T03.11 | 0 | 2 |
| T03.12 | 1 | 0 |
| T04.01 | 9 | 0 |
| T04.01, T04.08 | 4 | 0 |
| T04.02 | 16 | 0 |
| T04.03 | 10 | 0 |
| T04.04 | 23 | 0 |
| T04.05 | 16 | 0 |
| T04.05, T04.08 | 1 | 0 |
| T04.06 | 42 | 0 |
| T04.07 | 17 | 0 |
| T04.08 | 11 | 0 |
| T04.09 | 6 | 0 |
| T04.11 | 0 | 2 |
| T04.12 | 2 | 0 |
| T05.01 | 10 | 0 |
| T05.01, T05.11 | 1 | 0 |
| T05.02 | 7 | 0 |
| T05.03 | 17 | 0 |
| T05.03, T05.11 | 2 | 0 |
| T05.04 | 9 | 0 |
| T05.05 | 42 | 0 |
| T05.06 | 21 | 0 |
| T05.07 | 23 | 0 |
| T05.08 | 11 | 0 |
| T05.09 | 2 | 0 |
| T05.09, T05.11 | 2 | 0 |
| T05.10 | 2 | 0 |
| T05.11 | 16 | 0 |
| T05.12 | 1 | 0 |
| T06.01 | 9 | 0 |
| T06.02 | 4 | 0 |
| T06.03 | 11 | 0 |
| T06.04 | 4 | 0 |
| T06.05 | 18 | 0 |
| T06.06 | 8 | 0 |
| T06.07 | 1 | 0 |
| T07.01 | 20 | 0 |
| T07.02 | 46 | 0 |
| T07.03 | 22 | 0 |
| T07.04 | 17 | 0 |
| T07.05 | 9 | 0 |
| T07.06 | 9 | 0 |
| T07.07 | 3 | 0 |
| T07.08 | 26 | 0 |
| T07.09 | 13 | 0 |
| T07.10 | 3 | 0 |
| T08.01 | 34 | 0 |
| T08.02 | 11 | 0 |
| T08.03 | 16 | 0 |
| T08.04 | 23 | 0 |
| T08.05 | 15 | 0 |
| T08.06 | 11 | 0 |
| T08.07 | 25 | 0 |
| T08.08 | 2 | 0 |
| T09.01 | 21 | 0 |
| T09.02 | 14 | 0 |
| T09.03 | 18 | 0 |
| T09.04 | 8 | 0 |
| T09.05 | 20 | 0 |
| T09.06 | 30 | 0 |
| T09.07 | 11 | 0 |
| T09.08 | 21 | 0 |
| T09.09 | 16 | 0 |
| T09.10 | 24 | 0 |
| T09.11 | 9 | 0 |
| T09.12 | 12 | 0 |
| T09.13 | 7 | 0 |
| T09.14 | 5 | 0 |
| T10.01 | 6 | 0 |
| T10.02 | 7 | 0 |
| T10.03 | 5 | 0 |
| T10.04 | 25 | 0 |
| T10.05 | 8 | 0 |
| T10.06 | 4 | 0 |
| T10.07 | 1 | 0 |
| T11.01 | 7 | 0 |
| T11.01, T11.02 | 1 | 0 |
| T11.01, T11.02, T11.11 | 1 | 0 |
| T11.01, T11.06 | 1 | 0 |
| T11.01, T11.06, T11.11 | 1 | 0 |
| T11.02 | 7 | 0 |
| T11.02, T11.04 | 1 | 0 |
| T11.03 | 9 | 0 |
| T11.03, T11.08 | 1 | 0 |
| T11.04 | 19 | 0 |
| T11.04, T11.08 | 1 | 0 |
| T11.04, T11.11 | 2 | 0 |
| T11.05 | 9 | 0 |
| T11.05, T11.11 | 1 | 0 |
| T11.06 | 5 | 0 |
| T11.06, T11.11 | 1 | 0 |
| T11.07 | 1 | 0 |
| T11.07, T11.08 | 1 | 0 |
| T11.07, T11.10 | 3 | 0 |
| T11.08 | 11 | 0 |
| T11.08, T11.11 | 1 | 0 |
| T11.08, T11.13 | 1 | 0 |
| T11.09 | 9 | 0 |
| T11.10 | 8 | 0 |
| T11.11 | 2 | 0 |
| T11.12 | 0 | 2 |
| T12.01, T12.02 | 2 | 0 |
| T12.02 | 10 | 0 |
| T12.02, T12.06 | 1 | 0 |
| T12.02, T12.08 | 1 | 0 |
| T12.03 | 9 | 0 |
| T12.03, T12.06 | 1 | 0 |
| T12.04 | 9 | 0 |
| T12.04, T12.06 | 1 | 0 |
| T12.04, T12.08 | 3 | 0 |
| T12.05 | 9 | 0 |
| T12.06 | 4 | 0 |
| T12.07 | 24 | 0 |
| T12.08 | 7 | 0 |
| T12.09 | 0 | 2 |
| T12.10 | 1 | 0 |
| T13.01 | 19 | 0 |
| T13.01, T13.05 | 1 | 0 |
| T13.01, T13.06 | 1 | 0 |
| T13.01, T13.08 | 1 | 0 |
| T13.01, T13.10 | 1 | 0 |
| T13.01, T13.12 | 1 | 0 |
| T13.02 | 14 | 0 |
| T13.02, T13.05 | 1 | 0 |
| T13.02, T13.10 | 1 | 0 |
| T13.03 | 7 | 0 |
| T13.03, T13.07 | 1 | 0 |
| T13.03, T13.08 | 1 | 0 |
| T13.04 | 16 | 0 |
| T13.04, T13.10 | 2 | 0 |
| T13.05 | 12 | 0 |
| T13.05, T13.06 | 2 | 0 |
| T13.06 | 6 | 0 |
| T13.07 | 25 | 0 |
| T13.08 | 11 | 0 |
| T13.09 | 17 | 0 |
| T13.09, T13.10 | 1 | 0 |
| T13.10 | 4 | 0 |
| T13.11 | 0 | 10 |
| T14.01 | 5 | 0 |
| T14.02 | 6 | 0 |
| T14.02, T14.06 | 1 | 0 |
| T14.03 | 2 | 0 |
| T14.04 | 19 | 0 |
| T14.04, T14.06 | 6 | 0 |
| T14.05 | 6 | 0 |
| T14.06 | 12 | 0 |
| T14.07 | 13 | 0 |
| T14.08 | 0 | 8 |
| T14.09 | 1 | 0 |
| T15.01 | 4 | 0 |
| T15.01, T15.02 | 1 | 0 |
| T15.01, T15.04 | 1 | 0 |
| T15.01, T15.08 | 1 | 0 |
| T15.02 | 10 | 0 |
| T15.03 | 6 | 0 |
| T15.04 | 22 | 0 |
| T15.05 | 5 | 0 |
| T15.06 | 3 | 0 |
| T15.07 | 5 | 0 |
| T16.01 | 8 | 0 |
| T16.01, T16.02 | 1 | 0 |
| T16.02 | 6 | 0 |
| T16.02, T16.04 | 1 | 0 |
| T16.03 | 4 | 0 |
| T16.03, T16.04 | 1 | 0 |
| T16.03, T16.06 | 1 | 0 |
| T16.03, T16.07 | 1 | 0 |
| T16.04 | 10 | 0 |
| T16.05 | 6 | 0 |
| T16.05, T16.08 | 2 | 0 |
| T16.06 | 4 | 0 |
| T16.06, T16.07 | 1 | 0 |
| T16.07 | 8 | 0 |
| T16.07, T16.08 | 1 | 0 |
| T16.08 | 2 | 0 |
| T16.09 | 22 | 0 |
| T16.10 | 1 | 0 |

## 5. Placeholders and limitations

| Module or screen | Limitation | Spec ref | Disclosure (exact UI text or document) | Affected R-IDs |
|---|---|---|---|---|
| M-02 Theory, M-03 Model | MusicXML per-note `step` and `alter` that disagree with the key spelling are not preserved: `NoteEvent` has no spelling field, so note names are derived from the `KeyMap` at the note's tick through `Theory.spell` | T02.01 open items, OPEN-ISSUES 12c-1 | This row (STATUS.md section 5) | R-B10.1-02 |
| SCR-MainMenu entry "Quick Play" | Disabled; SCR-QuickPlay is built in Phase 08 | Part 7.6.2, T01.11 | Available after a later build step | R-B6.2-01 |
| SCR-MainMenu entry "Instrument Mode" | Disabled; SCR-Instrument is built in Phase 08 | Part 7.6.2, T01.11 | Available after a later build step | R-B6.2-02 |
| SCR-MainMenu entry "Free Play" | Disabled; SCR-FreePlay is built in Phase 06 | Part 7.6.2, T01.11 | Available after a later build step | R-B6.2-03 |
| SCR-MainMenu entry "Studio" | Disabled; SCR-Studio is built in Phase 09 | Part 7.6.2, T01.11 | Available after a later build step | R-B6.2-04 |
| SCR-MainMenu entry "Song Library" | Disabled; SCR-Library is built in Phase 07 | Part 7.6.2, T01.11 | Available after a later build step | R-B6.2-05 |
| SCR-MainMenu entry "Import Music" | Disabled; SCR-ImportInspect is built in Phase 07 | Part 7.6.2, T01.11 | Available after a later build step | R-B6.2-06 |
| SCR-MainMenu entry "Dance Mode" | Disabled; SCR-Dance is built in Phase 11 | Part 7.6.2, T01.11 | Available after a later build step | R-B6.2-07 |
| SCR-MainMenu entry "Multiplayer" | Disabled; SCR-Multiplayer is built in Phase 13 (a browser without WebRTC and no relay URL shows "This browser has no WebRTC support." instead) | Part 7.6.2, T01.11 | Available after a later build step | R-B6.2-08 |
| SCR-MainMenu entry "Characters" | Disabled; SCR-Characters is built in Phase 10 | Part 7.6.2, T01.11 | Available after a later build step | R-B6.2-09 |
| SCR-FirstLaunch step 3 (sound) | "Start sound" is disabled until the audio module exists (T04.01); only "Continue without sound for now" moves on | Part 6.27.4.3, T04.01 | Available after a later build step | R-B6.1-03 |
| SCR-FirstLaunch step 5 (controls) | Only the input choice is stored; trying keys or pads on the page and the touch probe come with T03.04 | Part 7.6.1, T03.04 | Trying the keys and pads on this page is added in a later build step. | R-B6.1-05 |
| SCR-FirstLaunch step 6 (choices) | "Learn the basics" and "Play a demo song" are disabled until the tutorial and Quick Play exist | Part 7.6.1, T01.11 | Available after a later build step | R-B6.1-06 |
| SCR-Settings Controls "Change keys" | Key remapping is not built (T03.04); the key table is read only | Part 7.6.12, T03.04 | Available after a later build step | R-B6.2-10 |
| SCR-Settings Calibration "Run calibration" | Disabled; DLG-Calibration is built later | Part 7.6.12, T01.11 | Available after a later build step | R-B6.2-10 |
| SCR-Settings Data and backup "Clear performance history" | Disabled; there is no performance history yet | Part 7.6.12, T01.11 | Available after a later build step | R-B6.2-10 |
| SCR-Help | No key tester, no profile key tables and no timing-window table yet (T03.04, T03.05, T03.07); "Start the tutorial" is disabled | Part 7.6.13, T03.07 | Key tables for each profile are added in a later build step. / Available after a later build step | R-B6.2-11 |
| SCR-About format table | The compatibility table needs the import module | Part 7.6.14, T01.11 | The format table is added with the import step. | R-B6.2-12, R-E9-17 |
| SCR-About browser claims | Every browser row stays unverified until the Phase 15 tests | Part 1.6 policy 2 | Not yet verified | R-B6.2-12 |
| SCR-Diagnostics Timing, Rendering, Input and Network sections | Show no measurements until their modules exist | Part 7.6.15, T01.11 | Available after a later build step | R-B24-15, R-I13-10 |
| SCR-Diagnostics "Run performance scenarios" (test build) | Disabled while no scenario is registered | Part 7.6.15, T01.11 | No performance scenarios are registered yet. | R-B24-15 |
| M-06 Instruments fallback | When an instrument definition fails, the family template or the basic voice plays instead and the one warning is only written to the log (M-06 cannot open a toast; LEDGER D104) | Part 6.6.4, R-P6.1-12 | Log line "Program N failed ..." in SCR-Diagnostics | R-P6.1-12 |

## 6. Known defects

| Defect | Severity | Found in T section | Regression test | State |
|---|---|---|---|---|
| VoiceAllocator.releaseSlot marked a slot 'released' again after the voice had freed it inside its own release call (a stand-in voice that ends at once): the slot stayed counted as active | Medium (Part 13.2 Medium (b): a budget missed, data intact) | T04.05 | UT-05-34 | fixed |
| VoiceAllocator.free cleared a slot in place, so a stale handle (a booked note, a held live key, heldLive of M-06) released the next voice that took the slot; a held steel guitar after 2.5 s cut the next note | High (Part 13.2: wrong sound, data intact) | T04.05 (found by the Phase 04 review) | UT-05-35, UT-06-25 | fixed (free installs a fresh slot object; dispose removes the heldLive entry) |
| A soft panic did not shorten a voice that was already in its release tail (return on any earlier release), so pause or panic left a 1.5 s tail sounding and the mode leave could file E-AUD-006 | High (Part 13.2: wrong sound, data intact) | T04.05, T04.06 | UT-06-26, UT-06-27 | fixed (an earlier-ending release replaces the one in force; the old ramp is held with cancelAndHoldAtTime) |
| PT-012 timed the wrong things (every note, including notes without a voice; voice cost as tick time / voices) and did its own work inside the tick | Medium (Part 13.2: a budget measured wrongly) | T04.12 | PT-012 itself (perf.mjs chord-stress-1000) | fixed (voiced flag on sched.noteOn, raw values analysed after the run, build time measured inside Instruments) |
| Same-instant chord overflow kept the wrong notes (the last ones, rounded to whole ms, duplicates kept) | Medium (Part 13.2: wrong sound, data intact) | T04.06 | T04.06 and T04.06b in the audio group, TT-028 | fixed (D101) |
| Missing plan deliverables: no fallback to the family template and the basic voice (a failed definition did a hard-panic recovery per note); no Restart audio action; DLG-ResumeAudio closed with resume although the resume failed | Medium (Part 13.2: feature missing) | T04.06, T04.08 | UT-06-28, FI-043, UT-05-36, UT-27-30 | fixed (D104, D105) |
| The first source to end disposed the whole voice; the Karplus-Strong buffer ended with a click | Medium (Part 13.2: wrong sound, data intact) | T04.06 | UT-06-32, UT-06-29 | fixed (dispose on the last source; 20 ms end fade) |
| The tremolo LFO was added into the envelope gain and kept sounding after the release | Medium (Part 13.2: wrong sound, data intact) | T04.06 | UT-06-30 | fixed (a gain node in series after the envelope) |
| Live notes had no 60 s cap; calibration clicks could be booked at time null and survived Escape; the recovery resync was a user seek (soft panic); an output device change sent audio.unlocked again | Low (Part 13.2: edge case) | T04.05, T04.08, T04.09 | UT-06-10 and UT-06-15 (cap), UT-27-17h, UT-27-29, FI-005 (resync), UT-05-37 | fixed (D106, D107) |
| Voices with 12 or 13 nodes (programs 21, 23, 44, 52, 53, 54, 55, 91, 109) with the mod wheel up exceeded the 11-node limit of D83 | Low (Part 13.2: a budget missed, data intact) | T04.06 | UT-06-22 (now with CC 1 at 127) | fixed by decision (D103: limit 13, audioNodesMax 832) |
| Input.clearAnchor kept the emission state, so the first sample after a clear was held back by the once-a-second gate (found as a flaky `input/anchor` test: 3 of 4 `--all` runs) | Medium (Part 13.2: a signal not sent after a context change) | T03.01, found in the Phase 04 gate | anchor test "the first sample after a clear is announced even when input.anchor fired a moment ago (regression)" | fixed (D111) |
| One slow build (about 22 ms) set the cost estimate to the same value, so the Scheduler booked one note every other tick for about 400 ms and later notes were late | High (Part 13.2: wrong sound, late notes) | T04.12 | UT-05-39 | fixed (sample cap, notes due within 60 ms never held back, reset at bind) |
| Restart audio with a replaced context left the transport on the dead clock and M-07 timing against the dead context; the warm-up ran after the bind without being awaited; duplicates in a chord that fits the voices both sounded; the steal priority ignored program changes | Medium (Part 13.2: wrong timing or sound) | T04.08, T04.12 | UT-05-36, UT-06-33, T04.06c | fixed (D114 to D118) |
| D103 raised the plan limit of 11 nodes a voice to 13 without approval | Low (Part 13.2: a plan limit changed) | T04.12 | UT-06-22 | fixed (D113: shared channel LFO, 11 and 8 again) |
| PT-004 and PT-012 `tickWorkMaxMs` > 4 ms and PT-004 `lateEvents` > 0 in the gate run (host load, young-generation scavenges of 4 to 7 ms) | Medium (Part 13.2: a budget missed, data intact) | T04.12 | none yet (PT-004, PT-012 are the tests) | OPEN (LEDGER OI-37) |

## 7. Measurements recorded

| Budget (Part 9.1 row) | Value or "not measured" | Tool and scenario | Date |
|---|---|---|---|
| Shipped size (PT-001) | 720904 bytes (limit 2621440) | perf.mjs build-size | 2026-10-27 |
| menuMs median (PT-002) | 115.5 ms (software GL; budget 1500) | perf.mjs boot-to-menu | 2026-10-27 |
| capsMs (PT-002) | 15.7 ms (software GL; budget 20; noisy: runs 15.7-20.2) | perf.mjs boot-to-menu | 2026-10-27 |
| inputProcP95Ms (PT-009 input phase) | 0.7 ms (software GL; budget 4) | perf.mjs input-latency | 2026-10-27 |
| Shipped size (PT-001, Phase 04 gate) | 993877 bytes (limit 2621440; envelope of the Phase 05 gate 1.25 MB, 76 percent used; LEDGER D108, approved by the owner) | perf.mjs build-size | 2026-10-29 |
| menuMs / capsMs (PT-002, Phase 04 gate) | 170.5 ms / 18.7 ms (software GL; budgets 1500 / 20) | perf.mjs boot-to-menu, repeat 3 | 2026-10-29 |
| PT-004 playback-dense (gate run, 187 s of demo-electro at speed 2, 5,000 events) | lookaheadMaxMs 120 (125) pass; tickIntervalP50 25 (23-27) pass; P95 26 (50) pass; tickIntervalMaxMs 72 (95) pass, run 1 was 106; schedErrorMaxMs 0.02 (1) pass; voicesMax 59 pass; tickWorkMaxMs 51.7 / 12.1 / 14.8, median 14.8 (4) NOT MET; lateEvents 1 / 0 / 0, worst 1 (0) NOT MET | perf.mjs playback-dense, repeat 3 (no renderer, no chart bot) | 2026-10-29 |
| driftMs (PT-007) | 0 ms over 7 loop wraps in 60 s (budget 2.0); 4 stalls did not move the schedule | perf.mjs loop-drift-short | 2026-10-29 |
| voicesMax, started + dropped, activeVoicesAfterStop, audioNodesMax (PT-012) | 64 (cap 64); 16000 + 0 = 16000; 0; 463 to 468 of 704 (64 x 11, fading stolen voices counted apart; D113) | perf.mjs chord-stress-1000 (real Instruments) | 2026-10-29 |
| tickWorkMaxMs (PT-012, Part 9.1.3 tick body) | NOT MET. Gate run (default set, repeat 3): 9.4 / 4.6 / 5.7 ms, median 5.7 (budget 4). The run before the playback start fix: 5.3 / 5.2 / 61. Not a result: a separate quiet series 3.9 / 4.1 / 3.8 ms | perf.mjs --repeat 3 (default set) | 2026-10-29 |
| voiceBuildMeanMs (Part 9.1.3, info) | 0.34 ms per note start (target 0.15: NOT MET), measured inside Instruments including slot, start and release booking | perf.mjs chord-stress-1000 | 2026-10-29 |
| expandMaxMs (PT-018, first half) | 4.2 ms (budget 50); chartBuiltinMaxMs not measured (Phase 08) | perf.mjs content-expand | 2026-10-29 |
