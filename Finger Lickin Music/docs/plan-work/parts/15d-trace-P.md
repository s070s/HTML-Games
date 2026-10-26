### 15.4 Maximum-polish checklist (P)

Rows follow P sections 1 to 22 in spec order. P has no numbered section before 1; the three
obligations of its preamble (the "Mandatory agent instruction", spec line 2711) are numbered
`R-P0-01` to `R-P0-03` (the `0` is the section number, not a priority). Spec ref names the
section and the 1-based position of the bullet in it (`item n`); `intro` and `closing` mark
obligation sentences before or after a bullet list. The tracker counters and "Reset
checklist" labels of the spec are page furniture, not requirements. Priority: P items
default to P1 and P 21 items to P2; a row that guards the correctness or data safety of a
B 4.2 P0 feature (timing, stuck notes, scoring determinism, recording and save integrity,
single-file delivery, import limits) is P0. Module(s) may name a tool or document in
backticks where no source module carries the requirement; "none (plan)" marks obligations
this document itself satisfies.

| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |
|---|---|---|---|---|---|---|---|
| R-P0-01 | P preamble | Include every applicable P section 1-22 in the end-to-end table of contents (Part 11 Covers lines) | P0 | none (plan) | Phase 00 | AT-R-P0-01 | Unimplemented |
| R-P0-02 | P preamble | Give every P requirement a dependency, acceptance criteria, verification method and final status | P0 | none (plan) | Phase 00 | AT-R-P0-02 | Unimplemented |
| R-P0-03 | P preamble | Never mark a P item polished after one successful run; Implemented needs every named test passing in --all | P0 | M-31, `docs/STATUS.md` | Phase 16 | AT-R-P0-03 | Unimplemented |
| R-P1-01 | P 1 item 1 | Every primary action gives visible feedback in the next rendered frame, plus audible feedback where it sounds | P1 | M-26, M-07, M-21 | Phase 01 | AT-R-P1-01 | Unimplemented |
| R-P1-02 | P 1 item 2 | Low-power devices stay responsive: Balanced 60 FPS target, 45 floor, auto-downgrade at p95 > 33 ms over 5 s | P1 | M-18, M-26 | Phase 14 | AT-R-P1-02 | Unimplemented |
| R-P1-03 | P 1 item 3 | Every screen and mode uses the shared screen stack, Transport, theme tokens and HUD; no standalone sub-apps | P1 | M-26, M-27, M-28 | Phase 01 | AT-R-P1-03 | Unimplemented |
| R-P1-04 | P 1 item 4 | Mode transitions keep project, song and settings and never stop recording or discard unsaved work silently | P1 | M-28, M-15, M-26 | Phase 09 | AT-R-P1-04 | Unimplemented |
| R-P1-05 | P 1 item 5 | Quick Play demo playable within 5 s desktop and 8 s mobile of file open; main menu within 1.5 s and 3.0 s | P1 | M-29, M-30, M-27 | Phase 08 | AT-R-P1-05 | Unimplemented |
| R-P1-06 | P 1 item 6 | Advanced features stay discoverable: collapsed "Advanced" groups, contextual help per screen, SCR-Help index | P1 | M-26, M-27 | Phase 08 | AT-R-P1-06 | Unimplemented |
| R-P1-07 | P 1 item 7 | Loading, waiting, saving and failure states each have a designed view (indicator, progress, result, DLG-*) | P1 | M-26, M-27 | Phase 01 | AT-R-P1-07 | Unimplemented |
| R-P1-08 | P 1 item 8 | All modes share navigation, Part 7 terminology, the icon sprite, control keys and feedback patterns | P1 | M-26, M-27 | Phase 01 | AT-R-P1-08 | Unimplemented |
| R-P1-09 | P 1 item 9 | Buttons, menus, dialogs, sliders and panels are built only by FLM.UI.Widgets from shared CSS tokens | P1 | M-26, `src/shell.html` | Phase 01 | AT-R-P1-09 | Unimplemented |
| R-P1-10 | P 1 item 10 | Each setting has one key in the settings schema and identical behavior on every screen that shows it | P1 | M-26, M-27, M-16 | Phase 01 | AT-R-P1-10 | Unimplemented |
| R-P1-11 | P 1 item 11 | Keyboard, touch, gamepad and MIDI map to the same logical controls and produce identical results | P1 | M-07, M-08 | Phase 03 | AT-R-P1-11 | Unimplemented |
| R-P1-12 | P 1 item 12 | Every feature defines its empty, loading, success, error and disabled states where applicable (Part 7 table) | P1 | M-26, M-27 | Phase 01 | AT-R-P1-12 | Unimplemented |
| R-P2.1-01 | P 2.1 item 1 | One visual direction (lit live stage, music culture, modern 3D) stated in the Part 7 style rules and applied | P1 | M-26, M-21 | Phase 01 | AT-R-P2.1-01 | Unimplemented |
| R-P2.1-02 | P 2.1 item 2 | Restrained semantic palette as CSS tokens: accent, success, warning, danger, info and four lane colors | P1 | M-26, `src/shell.html` | Phase 01 | AT-R-P2.1-02 | Unimplemented |
| R-P2.1-03 | P 2.1 item 3 | Type scale tokens for headings, gameplay labels, tabular numerals, menus and diagnostics in the one font stack | P1 | M-26, `src/shell.html` | Phase 01 | AT-R-P2.1-03 | Unimplemented |
| R-P2.1-04 | P 2.1 item 4 | Spacing, alignment grid, corner radii, borders and shadows come only from shared CSS tokens | P1 | M-26, `src/shell.html` | Phase 01 | AT-R-P2.1-04 | Unimplemented |
| R-P2.1-05 | P 2.1 item 5 | Logo, menus, stage, character editor and HUD share palette, type and shape language | P1 | M-26, M-21, M-27 | Phase 10 | AT-R-P2.1-05 | Unimplemented |
| R-P2.1-06 | P 2.1 item 6 | Gameplay screens show no dashboard styling: no card grids or data tables over the stage during play | P1 | M-26, M-27 | Phase 08 | AT-R-P2.1-06 | Unimplemented |
| R-P2.1-07 | P 2.1 item 7 | No decorative gradients, blur or borders; glow and particles appear only for musical events | P1 | M-21, M-26 | Phase 05 | AT-R-P2.1-07 | Unimplemented |
| R-P2.1-08 | P 2.1 item 8 | Effects are triggered by musical events and never outshine or cover the highway targets | P1 | M-21, M-20 | Phase 05 | AT-R-P2.1-08 | Unimplemented |
| R-P2.1-09 | P 2.1 item 9 | Text contrast >= 4.5:1 (3:1 large text) over every stage theme, bright or dark, and in high-contrast mode | P1 | M-26, M-21 | Phase 01 | AT-R-P2.1-09 | Unimplemented |
| R-P2.2-01 | P 2.2 item 1 | No misaligned icons, text, panels or controls at the five reference viewports 360x640 to 1920x1080 | P1 | M-26, M-27 | Phase 15 | AT-R-P2.2-01 | Unimplemented |
| R-P2.2-02 | P 2.2 item 2 | No unintended clipping or overlapping elements at the reference viewports in both orientations | P1 | M-26, M-27 | Phase 15 | AT-R-P2.2-02 | Unimplemented |
| R-P2.2-03 | P 2.2 item 3 | Uniform button heights and padding from size tokens (44 px menu controls, 56 px gameplay pads) | P1 | M-26 | Phase 01 | AT-R-P2.2-03 | Unimplemented |
| R-P2.2-04 | P 2.2 item 4 | No text cut off at reference viewports; long text truncates with an ellipsis and keeps the full text in title | P1 | M-26, M-27 | Phase 15 | AT-R-P2.2-04 | Unimplemented |
| R-P2.2-05 | P 2.2 item 5 | No horizontal page scroll: overflow hidden on html and body, every layout fits a 320 px wide viewport | P1 | M-26, `src/shell.html` | Phase 01 | AT-R-P2.2-05 | Unimplemented |
| R-P2.2-06 | P 2.2 item 6 | No layout jumps when panels open or close: panels overlay or occupy space reserved in advance | P1 | M-26 | Phase 01 | AT-R-P2.2-06 | Unimplemented |
| R-P2.2-07 | P 2.2 item 7 | No flicker on mode switch: overlay cross-fade and the canvas cleared to the stage background in one frame | P1 | M-28, M-18, M-26 | Phase 05 | AT-R-P2.2-07 | Unimplemented |
| R-P2.2-08 | P 2.2 item 8 | Consistent capitalization (Title Case titles, sentence case labels) and Part 7 glossary terms in all strings | P1 | M-27, M-26 | Phase 16 | AT-R-P2.2-08 | Unimplemented |
| R-P2.2-09 | P 2.2 item 9 | No unexplained empty space or overly dense panels: each panel has an empty state and a density limit | P1 | M-26, M-27 | Phase 15 | AT-R-P2.2-09 | Unimplemented |
| R-P2.2-10 | P 2.2 item 10 | No low-resolution or distorted assets: canvases sized by devicePixelRatio, icons as SVG only | P1 | M-18, M-26 | Phase 05 | AT-R-P2.2-10 | Unimplemented |
| R-P2.3-01 | P 2.3 item 1 | Each screen shows its title and current task in a fixed header region | P1 | M-26, M-27 | Phase 01 | AT-R-P2.3-01 | Unimplemented |
| R-P2.3-02 | P 2.3 item 2 | One primary-styled action per screen; secondary actions use the secondary style | P1 | M-26, M-27 | Phase 01 | AT-R-P2.3-02 | Unimplemented |
| R-P2.3-03 | P 2.3 item 3 | Critical status (error, recording, network, save) uses semantic color plus icon plus text, never decoration | P1 | M-26 | Phase 01 | AT-R-P2.3-03 | Unimplemented |
| R-P2.3-04 | P 2.3 item 4 | Advanced settings sit behind a collapsed "Advanced" disclosure in each settings group | P1 | M-26, M-27 | Phase 01 | AT-R-P2.3-04 | Unimplemented |
| R-P2.3-05 | P 2.3 item 5 | Actionable controls have button styling and a focusable role; informational labels are not focusable | P1 | M-26 | Phase 01 | AT-R-P2.3-05 | Unimplemented |
| R-P2.3-06 | P 2.3 item 6 | Focus, hover, pressed, selected, disabled and loading states are visually distinct on every widget | P1 | M-26 | Phase 01 | AT-R-P2.3-06 | Unimplemented |
| R-P3-01 | P 3 item 1 | Launch opens SCR-MainMenu (SCR-FirstLaunch on first run) with the 12 entries in the fixed order | P1 | M-27, M-29 | Phase 01 | AT-R-P3-01 | Unimplemented |
| R-P3-02 | P 3 item 2 | Quick Play is the first main menu entry and holds initial focus | P1 | M-27 | Phase 01 | AT-R-P3-02 | Unimplemented |
| R-P3-03 | P 3 item 3 | Instrument Mode, Free Play, Studio, Import, Dance, Multiplayer and Characters each have one main menu entry | P1 | M-27 | Phase 01 | AT-R-P3-03 | Unimplemented |
| R-P3-04 | P 3 item 4 | Every mode is reachable from SCR-MainMenu in at most two transitions, without filler screens | P1 | M-26, M-27 | Phase 01 | AT-R-P3-04 | Unimplemented |
| R-P3-05 | P 3 item 5 | Escape, browser back and the on-screen Back button all return to the previous screen of the stack | P1 | M-26, M-28 | Phase 01 | AT-R-P3-05 | Unimplemented |
| R-P3-06 | P 3 item 6 | Unsaved work runs UI.confirmUnsaved before back, mode change, new import or project replace | P0 | M-26, M-15, M-28 | Phase 09 | AT-R-P3-06 | Unimplemented |
| R-P3-07 | P 3 item 7 | Opening and closing any dialog returns focus to the element that opened it | P1 | M-26 | Phase 01 | AT-R-P3-07 | Unimplemented |
| R-P3-08 | P 3 item 8 | Repeated navigation adds no listeners or running processes: Modes.assertClean() counters return to baseline | P1 | M-28, M-01 | Phase 01 | AT-R-P3-08 | Unimplemented |
| R-P3-09 | P 3 item 9 | The current project and song stay selected across navigation until the user closes or replaces them | P1 | M-15, M-28 | Phase 09 | AT-R-P3-09 | Unimplemented |
| R-P3-10 | P 3 item 10 | Unavailable online features stay visible but disabled with a one-line statement of what they need | P1 | M-24, M-27 | Phase 13 | AT-R-P3-10 | Unimplemented |
| R-P3-11 | P 3 item 11 | Returning to the main menu stops a recording with Recorder.stop, keeps the take and leaves the project valid | P0 | M-17, M-28 | Phase 09 | AT-R-P3-11 | Unimplemented |
| R-P3-12 | P 3 item 12 | Browser back and forward follow one pushState per screen; popstate runs the unsaved guard before popping | P1 | M-26, M-28 | Phase 01 | AT-R-P3-12 | Unimplemented |
| R-P4-01 | P 4 item 1 | First launch reaches a usable screen within the 1.5 s desktop and 3.0 s mobile budgets, one setup screen only | P1 | M-29, M-27 | Phase 08 | AT-R-P4-01 | Unimplemented |
| R-P4-02 | P 4 item 2 | The audio activation prompt appears only while the AudioContext is suspended and no gesture has occurred | P1 | M-05, M-29 | Phase 04 | AT-R-P4-02 | Unimplemented |
| R-P4-03 | P 4 item 3 | Capability checks disable only features whose required capability is missing; all others stay enabled | P0 | M-01, M-29 | Phase 01 | AT-R-P4-03 | Unimplemented |
| R-P4-04 | P 4 item 4 | A built-in demo starts from Quick Play without importing any file | P0 | M-30, M-27, M-28 | Phase 08 | AT-R-P4-04 | Unimplemented |
| R-P4-05 | P 4 item 5 | SCR-Tutorial uses the real gameplay controls: the active Input map, Mapper and Rhythm.Judge | P1 | M-27, M-07, M-09 | Phase 08 | AT-R-P4-05 | Unimplemented |
| R-P4-06 | P 4 item 6 | Every tutorial step offers Skip and Repeat | P1 | M-27 | Phase 08 | AT-R-P4-06 | Unimplemented |
| R-P4-07 | P 4 item 7 | Tutorial prompts show keys A S K L on desktop, the four pads on touch and buttons on gamepad | P1 | M-27, M-07 | Phase 08 | AT-R-P4-07 | Unimplemented |
| R-P4-08 | P 4 item 8 | The tutorial includes a two-lane simultaneous press step on every input that supports it | P1 | M-27 | Phase 08 | AT-R-P4-08 | Unimplemented |
| R-P4-09 | P 4 item 9 | SCR-FirstLaunch and SCR-Help explain Instrument Mode, Free Play, Studio and Dance Mode in one sentence each | P1 | M-27 | Phase 08 | AT-R-P4-09 | Unimplemented |
| R-P4-10 | P 4 item 10 | No permission is requested at launch; MIDI access is requested only when the user enables MIDI input | P1 | M-07, M-27 | Phase 03 | AT-R-P4-10 | Unimplemented |
| R-P4-11 | P 4 item 11 | First-launch choices (input layout, reduced motion, volume) are saved through Storage.saveSettings | P1 | M-16, M-27 | Phase 08 | AT-R-P4-11 | Unimplemented |
| R-P4-12 | P 4 item 12 | Completed onboarding is stored; returning users open SCR-MainMenu; the tutorial stays reachable from SCR-Help | P1 | M-16, M-29, M-27 | Phase 08 | AT-R-P4-12 | Unimplemented |
| R-P5.1-01 | P 5.1 item 1 | Every press shows pad and lane-receptor feedback in the next rendered frame | P1 | M-07, M-26, M-21 | Phase 03 | AT-R-P5.1-01 | Unimplemented |
| R-P5.1-02 | P 5.1 item 2 | Pressed and released states are visually distinct on touch pads and lane receptors | P1 | M-26, M-21 | Phase 03 | AT-R-P5.1-02 | Unimplemented |
| R-P5.1-03 | P 5.1 item 3 | Up to four simultaneous presses are timestamped individually and judged by the same rules | P0 | M-07, M-09 | Phase 03 | AT-R-P5.1-03 | Unimplemented |
| R-P5.1-04 | P 5.1 item 4 | Held notes never stick: every press ends by device release, focus loss, pause, panic or mode leave | P0 | M-07, M-06, M-08 | Phase 03 | AT-R-P5.1-04 | Unimplemented |
| R-P5.1-05 | P 5.1 item 5 | Window blur and visibility hidden release all held keyboard inputs through Input.releaseAll | P0 | M-07 | Phase 03 | AT-R-P5.1-05 | Unimplemented |
| R-P5.1-06 | P 5.1 item 6 | pointercancel and lost pointer capture release the pad and every note it holds | P0 | M-07, M-26 | Phase 03 | AT-R-P5.1-06 | Unimplemented |
| R-P5.1-07 | P 5.1 item 7 | Keyboard auto-repeat (event.repeat true) never creates a press, note or judgment | P0 | M-07 | Phase 03 | AT-R-P5.1-07 | Unimplemented |
| R-P5.1-08 | P 5.1 item 8 | Mapping changes apply from the next press; notes already held keep their mapping until released | P1 | M-07, M-08 | Phase 03 | AT-R-P5.1-08 | Unimplemented |
| R-P5.1-09 | P 5.1 item 9 | Remapping detects conflicts with Input.conflicts and names the clashing action before the map is saved | P1 | M-07, M-27 | Phase 03 | AT-R-P5.1-09 | Unimplemented |
| R-P5.1-10 | P 5.1 item 10 | DLG-Calibration shows each Calibration offset in ms with a tap test, live preview and reset to 0 | P1 | M-27, M-07, M-09 | Phase 03 | AT-R-P5.1-10 | Unimplemented |
| R-P5.1-11 | P 5.1 item 11 | Pause, resume, seek and mode change release held inputs; nothing is judged unless state is playing | P0 | M-07, M-09, M-28 | Phase 03 | AT-R-P5.1-11 | Unimplemented |
| R-P5.2-01 | P 5.2 item 1 | Note targets stay readable at every lead time 600-3,000 ms, minimum on-screen size 24 CSS px | P1 | M-21 | Phase 08 | AT-R-P5.2-01 | Unimplemented |
| R-P5.2-02 | P 5.2 item 2 | Chords are drawn with a bar joining their lanes, distinct from single notes | P1 | M-21 | Phase 08 | AT-R-P5.2-02 | Unimplemented |
| R-P5.2-03 | P 5.2 item 3 | Hold notes draw a tail whose length equals their duration at the current lead time | P1 | M-21 | Phase 08 | AT-R-P5.2-03 | Unimplemented |
| R-P5.2-04 | P 5.2 item 4 | No UI panel, effect or performer covers the highway hit zone or incoming notes | P1 | M-21, M-26 | Phase 08 | AT-R-P5.2-04 | Unimplemented |
| R-P5.2-05 | P 5.2 item 5 | Judgment windows are fixed per difficulty in Rhythm.WINDOWS and listed on SCR-Help | P0 | M-09, M-27 | Phase 03 | AT-R-P5.2-05 | Unimplemented |
| R-P5.2-06 | P 5.2 item 6 | Perfect, Great, Good and Miss appear as text plus a color flash in the frame after the judgment | P1 | M-26, M-21 | Phase 08 | AT-R-P5.2-06 | Unimplemented |
| R-P5.2-07 | P 5.2 item 7 | Identical input sequences on the same chart produce identical integer ScoreState values | P0 | M-09 | Phase 03 | AT-R-P5.2-07 | Unimplemented |
| R-P5.2-08 | P 5.2 item 8 | Combo is one HUD number with a short pulse only when the multiplier changes (every 10) | P1 | M-26 | Phase 08 | AT-R-P5.2-08 | Unimplemented |
| R-P5.2-09 | P 5.2 item 9 | A miss shows a muted flash and lane hint, with no screen shake and no harsh sound | P1 | M-26, M-21 | Phase 08 | AT-R-P5.2-09 | Unimplemented |
| R-P5.2-10 | P 5.2 item 10 | Song end always opens SCR-Results; Restart replays the same chart from tick 0 with count-in | P1 | M-27, M-28, M-09 | Phase 08 | AT-R-P5.2-10 | Unimplemented |
| R-P5.2-11 | P 5.2 item 11 | While paused no input is judged and no note is triggered | P0 | M-09, M-07 | Phase 03 | AT-R-P5.2-11 | Unimplemented |
| R-P5.2-12 | P 5.2 item 12 | Restart creates a fresh ScoreState and Judge cursor; no earlier judgment carries over | P0 | M-09 | Phase 08 | AT-R-P5.2-12 | Unimplemented |
| R-P5.3-01 | P 5.3 item 1 | Each difficulty shows measured metrics (notes per second, chord ratio, window) on the chart preview | P1 | M-08, M-27 | Phase 08 | AT-R-P5.3-01 | Unimplemented |
| R-P5.3-02 | P 5.3 item 2 | Beginner charts keep the melody contour and section structure of the source track | P1 | M-08 | Phase 08 | AT-R-P5.3-02 | Unimplemented |
| R-P5.3-03 | P 5.3 item 3 | Higher difficulties add density, chords and syncopation taken from the source, never invented notes | P1 | M-08 | Phase 08 | AT-R-P5.3-03 | Unimplemented |
| R-P5.3-04 | P 5.3 item 4 | Chord simplification follows the documented ChartGenerator rules (maximum lanes per difficulty) | P1 | M-08 | Phase 08 | AT-R-P5.3-04 | Unimplemented |
| R-P5.3-05 | P 5.3 item 5 | Any section can be practiced alone with a loop region and practice speed | P1 | M-04, M-27 | Phase 11 | AT-R-P5.3-05 | Unimplemented |
| R-P5.3-06 | P 5.3 item 6 | Personal bests and comparisons use only results with an equal chart settingsHash and speed | P1 | M-25, M-09 | Phase 10 | AT-R-P5.3-06 | Unimplemented |
| R-P5.3-07 | P 5.3 item 7 | Calibration shifts timing references only, never window widths; each result records the offsets used | P1 | M-09, M-25 | Phase 10 | AT-R-P5.3-07 | Unimplemented |
| R-P5.3-08 | P 5.3 item 8 | Scoring-relevant assists (wider windows, slower speed) mark the result Assisted on SCR-Results and in history | P1 | M-25, M-09, M-27 | Phase 10 | AT-R-P5.3-08 | Unimplemented |
| R-P6-01 | P 6 intro | Audio fidelity (P 6.1 to 6.3) is release-critical: any open failure in these rows blocks the release | P0 | M-05, M-06 | Phase 16 | AT-R-P6-01 | Unimplemented |
| R-P6.1-01 | P 6.1 item 1 | GM programs 0-127 select the matching entry of Instruments.DEFINITIONS on their channel | P0 | M-06 | Phase 04 | AT-R-P6.1-01 | Unimplemented |
| R-P6.1-02 | P 6.1 item 2 | Each of the 16 family templates is audibly distinct and fits its family, checked by an LT listening review | P1 | M-06 | Phase 14 | AT-R-P6.1-02 | Unimplemented |
| R-P6.1-03 | P 6.1 item 3 | Every definition declares attack and release; note on and off use ramps >= 2 ms, so no clicks | P1 | M-06 | Phase 04 | AT-R-P6.1-03 | Unimplemented |
| R-P6.1-04 | P 6.1 item 4 | Velocity scales gain and filter brightness on synth-velocity programs | P1 | M-06 | Phase 04 | AT-R-P6.1-04 | Unimplemented |
| R-P6.1-05 | P 6.1 item 5 | Sustained instruments hold until note off or sustain (CC 64) release; voices never end early | P1 | M-06, M-05 | Phase 04 | AT-R-P6.1-05 | Unimplemented |
| R-P6.1-06 | P 6.1 item 6 | Channel 10 keys 35-81 map to the 12 drum voices; other keys use the misc voice | P0 | M-06 | Phase 04 | AT-R-P6.1-06 | Unimplemented |
| R-P6.1-07 | P 6.1 item 7 | Pitches stay sounding pitch (MusicXML transposition applied at import); out-of-range notes play and log once | P1 | M-06, M-12 | Phase 04 | AT-R-P6.1-07 | Unimplemented |
| R-P6.1-08 | P 6.1 item 8 | Program changes take effect at their tick for all later notes on that channel | P1 | M-06, M-05 | Phase 07 | AT-R-P6.1-08 | Unimplemented |
| R-P6.1-09 | P 6.1 item 9 | Pitch bend (RPN 0 range, default 2 semitones) and CC 1, 7, 10, 11, 64, 121, 123 behave per the MIDI spec | P1 | M-06 | Phase 04 | AT-R-P6.1-09 | Unimplemented |
| R-P6.1-10 | P 6.1 item 10 | Voice allocation stays stable at 64 voices desktop and 32 mobile under dense polyphony | P0 | M-05 | Phase 04 | AT-R-P6.1-10 | Unimplemented |
| R-P6.1-11 | P 6.1 item 11 | Stealing order released-quietest then oldest, with a 10 ms fade, documented on SCR-About and logged | P1 | M-05 | Phase 04 | AT-R-P6.1-11 | Unimplemented |
| R-P6.1-12 | P 6.1 item 12 | A failed instrument definition falls back to its family template, then a basic voice, with a warning | P1 | M-06 | Phase 04 | AT-R-P6.1-12 | Unimplemented |
| R-P6.2-01 | P 6.2 item 1 | Master volume 0-100 % applies through Audio.setMasterGain with a 20 ms ramp in every mode | P1 | M-05 | Phase 04 | AT-R-P6.2-01 | Unimplemented |
| R-P6.2-02 | P 6.2 item 2 | Track gain and pan -1..1 on the ChannelStrip apply immediately and are stored in Track.mix | P1 | M-05, M-17 | Phase 04 | AT-R-P6.2-02 | Unimplemented |
| R-P6.2-03 | P 6.2 item 3 | Mute and solo silence the voices of affected tracks within 20 ms and leave no hanging notes | P1 | M-05, M-06 | Phase 04 | AT-R-P6.2-03 | Unimplemented |
| R-P6.2-04 | P 6.2 item 4 | The master limiter keeps the output at or below 0 dBFS with 32 tracks at full gain | P1 | M-05 | Phase 04 | AT-R-P6.2-04 | Unimplemented |
| R-P6.2-05 | P 6.2 item 5 | Gain changes ramp over 5-20 ms and stop or panic fades voices over 10 ms, so no clicks or pops | P1 | M-05, M-06 | Phase 04 | AT-R-P6.2-05 | Unimplemented |
| R-P6.2-06 | P 6.2 item 6 | Start and stop never spike volume: voices start from zero gain and stop releases through ramps | P1 | M-05, M-06 | Phase 04 | AT-R-P6.2-06 | Unimplemented |
| R-P6.2-07 | P 6.2 item 7 | Metronome volume 0-100 % adjusts through Audio.setMetronomeGain, independent of master | P1 | M-05, M-27 | Phase 04 | AT-R-P6.2-07 | Unimplemented |
| R-P6.2-08 | P 6.2 item 8 | Effects add no scheduling latency: reverb is a parallel send and only the limiter sits in series | P1 | M-05 | Phase 14 | AT-R-P6.2-08 | Unimplemented |
| R-P6.2-09 | P 6.2 item 9 | Audio stays stable during render slowdowns: 25 ms scheduler tick with 120 ms lookahead, independent of RAF | P1 | M-05 | Phase 04 | AT-R-P6.2-09 | Unimplemented |
| R-P6.2-10 | P 6.2 item 10 | Long sessions keep active voices bounded and memory growth <= 10 MB after 20 enter-leave cycles | P1 | M-05, M-06, M-28 | Phase 14 | AT-R-P6.2-10 | Unimplemented |
| R-P6.3-01 | P 6.3 item 1 | Playback follows TempoMap ticks on the audio clock; frame count never advances musical time | P0 | M-04, M-05 | Phase 02 | AT-R-P6.3-01 | Unimplemented |
| R-P6.3-02 | P 6.3 item 2 | Tempo changes cause no cumulative drift: absolute drift < 2 ms after a 10 min loop | P0 | M-03, M-04 | Phase 02 | AT-R-P6.3-02 | Unimplemented |
| R-P6.3-03 | P 6.3 item 3 | Resume continues from the paused tick; the song is not shifted by more than 1 ms | P0 | M-04 | Phase 02 | AT-R-P6.3-03 | Unimplemented |
| R-P6.3-04 | P 6.3 item 4 | Seek cancels scheduled future events, releases sounding voices and reschedules from the new tick | P0 | M-04, M-05 | Phase 04 | AT-R-P6.3-04 | Unimplemented |
| R-P6.3-05 | P 6.3 item 5 | At a loop wrap, notes sounding are released at the loop end; only note-ons inside the loop retrigger | P0 | M-04, M-05 | Phase 02 | AT-R-P6.3-05 | Unimplemented |
| R-P6.3-06 | P 6.3 item 6 | On return from background the drift check re-anchors when cursor and audio position differ by > 5 ms | P0 | M-28, M-04, M-05 | Phase 04 | AT-R-P6.3-06 | Unimplemented |
| R-P6.3-07 | P 6.3 item 7 | Each Calibration offset is applied exactly once: input in Rhythm.Judge, visual lead in the Highway | P0 | M-09, M-07, M-21 | Phase 03 | AT-R-P6.3-07 | Unimplemented |
| R-P6.3-08 | P 6.3 item 8 | Scheduling (setInterval) and rendering (RAF) run independently; RAF only reads Transport.positionAt | P0 | M-04, M-05, M-18 | Phase 05 | AT-R-P6.3-08 | Unimplemented |
| R-P6.3-09 | P 6.3 item 9 | Timing tests include a dense arrangement (8 tracks, 16-note chords) and a sparse one (1 note per 4 bars) | P0 | M-31 | Phase 02 | AT-R-P6.3-09 | Unimplemented |
| R-P6.3-10 | P 6.3 item 10 | Timing tests include the 10 min loop drift run and a 30 min continuous playback run | P0 | M-31, `tools/perf.mjs` | Phase 14 | AT-R-P6.3-10 | Unimplemented |
| R-P7.1-01 | P 7.1 item 1 | The stage has one focal performer area framed by backdrop, lighting truss and floor | P1 | M-21 | Phase 05 | AT-R-P7.1-01 | Unimplemented |
| R-P7.1-02 | P 7.1 item 2 | Directional key light plus ambient keeps every performer readable on every tier | P1 | M-18, M-21 | Phase 05 | AT-R-P7.1-02 | Unimplemented |
| R-P7.1-03 | P 7.1 item 3 | Lambert materials respond to the directional and point lights; the Abstract tier uses flat fills | P1 | M-18 | Phase 05 | AT-R-P7.1-03 | Unimplemented |
| R-P7.1-04 | P 7.1 item 4 | Camera motion is eased and jitter-free, with speed and acceleration limits per preset | P1 | M-21, M-20 | Phase 05 | AT-R-P7.1-04 | Unimplemented |
| R-P7.1-05 | P 7.1 item 5 | Stage elements never occlude the highway or HUD: the highway draws last without depth test | P1 | M-21 | Phase 05 | AT-R-P7.1-05 | Unimplemented |
| R-P7.1-06 | P 7.1 item 6 | Effects fire only on sched.noteOn, beats and section markers; no idle looping effects | P1 | M-21, M-20 | Phase 05 | AT-R-P7.1-06 | Unimplemented |
| R-P7.1-07 | P 7.1 item 7 | Background geometry is static and low-contrast; motion is reserved for active performers | P1 | M-21 | Phase 05 | AT-R-P7.1-07 | Unimplemented |
| R-P7.1-08 | P 7.1 item 8 | Stage SLOTS keep 1 to 5 performers centered and balanced for every count | P1 | M-21 | Phase 05 | AT-R-P7.1-08 | Unimplemented |
| R-P7.1-09 | P 7.1 item 9 | At 360 px width the full-band camera fits all performers and the highway stays readable | P1 | M-21 | Phase 05 | AT-R-P7.1-09 | Unimplemented |
| R-P7.1-10 | P 7.1 item 10 | Low and Abstract tiers use designed reduced looks (fewer lights, flat stage, visualizers), never broken views | P1 | M-18, M-20, M-21 | Phase 05 | AT-R-P7.1-10 | Unimplemented |
| R-P7.2-01 | P 7.2 item 1 | Joint rotations are smoothed; no joint jumps more than 30 degrees in one frame outside a beat-aligned cut | P1 | M-19, M-20 | Phase 05 | AT-R-P7.2-01 | Unimplemented |
| R-P7.2-02 | P 7.2 item 2 | Hands stay on instrument attachment points through two-bone IK every frame | P1 | M-19, M-20 | Phase 05 | AT-R-P7.2-02 | Unimplemented |
| R-P7.2-03 | P 7.2 item 3 | Feet stay planted unless a step or dance move moves them; no root sliding | P1 | M-19, M-20 | Phase 05 | AT-R-P7.2-03 | Unimplemented |
| R-P7.2-04 | P 7.2 item 4 | Each instrument family uses its own controller (keys, guitar, bass, drums, strings, winds, synth and others) | P1 | M-20 | Phase 05 | AT-R-P7.2-04 | Unimplemented |
| R-P7.2-05 | P 7.2 item 5 | Gestures are timed to sched.noteOn with 120 ms anticipation and scaled by note velocity | P0 | M-20 | Phase 05 | AT-R-P7.2-05 | Unimplemented |
| R-P7.2-06 | P 7.2 item 6 | Sustained notes hold the playing pose until their noteOff | P1 | M-20 | Phase 05 | AT-R-P7.2-06 | Unimplemented |
| R-P7.2-07 | P 7.2 item 7 | During rests performers settle to idle within 500 ms and keep only breathing motion | P1 | M-20 | Phase 05 | AT-R-P7.2-07 | Unimplemented |
| R-P7.2-08 | P 7.2 item 8 | Idle, playing and transition states blend over 150-300 ms | P1 | M-20, M-19 | Phase 05 | AT-R-P7.2-08 | Unimplemented |
| R-P7.2-09 | P 7.2 item 9 | Each performer moves from its own track events plus a per-slot phase seed, so different parts look different | P1 | M-20 | Phase 05 | AT-R-P7.2-09 | Unimplemented |
| R-P7.2-10 | P 7.2 item 10 | Every CharacterConfig option keeps a valid rig: Rig.validateAttachments passes for all combinations | P1 | M-19, M-22 | Phase 10 | AT-R-P7.2-10 | Unimplemented |
| R-P7.2-11 | P 7.2 item 11 | Poses are computed from positionAt(audio now) each frame, so frame drops skip motion and never lag it | P0 | M-20 | Phase 05 | AT-R-P7.2-11 | Unimplemented |
| R-P7.3-01 | P 7.3 item 1 | The full-band camera preset frames every active performer | P1 | M-21 | Phase 05 | AT-R-P7.3-01 | Unimplemented |
| R-P7.3-02 | P 7.3 item 2 | Focus presets center and enlarge the soloing or selected performer | P1 | M-21, M-20 | Phase 05 | AT-R-P7.3-02 | Unimplemented |
| R-P7.3-03 | P 7.3 item 3 | Camera transitions ease over >= 400 ms; hard cuts only on a beat and at most one per bar | P1 | M-20, M-21 | Phase 05 | AT-R-P7.3-03 | Unimplemented |
| R-P7.3-04 | P 7.3 item 4 | Solo highlighting follows StageDirector analysis of note density per track per section | P1 | M-20 | Phase 05 | AT-R-P7.3-04 | Unimplemented |
| R-P7.3-05 | P 7.3 item 5 | StageDirector cuts are deterministic for the same song and settings (seeded from the song id) | P1 | M-20 | Phase 05 | AT-R-P7.3-05 | Unimplemented |
| R-P7.3-06 | P 7.3 item 6 | Camera motion setting: full, reduced (no automatic cuts, slow eases) or off (one static preset) | P1 | M-21, M-26 | Phase 05 | AT-R-P7.3-06 | Unimplemented |
| R-P7.3-07 | P 7.3 item 7 | The highway and HUD stay visible in every camera preset and during transitions | P1 | M-21 | Phase 05 | AT-R-P7.3-07 | Unimplemented |
| R-P7.3-08 | P 7.3 item 8 | Camera changes never alter Transport position or animation time | P1 | M-20, M-21 | Phase 05 | AT-R-P7.3-08 | Unimplemented |
| R-P8-01 | P 8 item 1 | Every customization option visibly changes the preview; options without a visible effect are not offered | P1 | M-22, M-27 | Phase 10 | AT-R-P8-01 | Unimplemented |
| R-P8-02 | P 8 item 2 | The 8 built-in presets load, pass Character.validate and render as previewed | P1 | M-22, M-30 | Phase 10 | AT-R-P8-02 | Unimplemented |
| R-P8-03 | P 8 item 3 | Randomize draws only from the OPTIONS catalog and always yields a valid CharacterConfig | P1 | M-22 | Phase 10 | AT-R-P8-03 | Unimplemented |
| R-P8-04 | P 8 item 4 | Preview updates in the next frame for visual-only changes and within 100 ms for rig-affecting ones | P1 | M-22, M-19, M-27 | Phase 10 | AT-R-P8-04 | Unimplemented |
| R-P8-05 | P 8 item 5 | Characters persist in the IndexedDB characters store and inside projects | P1 | M-16, M-22 | Phase 10 | AT-R-P8-05 | Unimplemented |
| R-P8-06 | P 8 item 6 | Every CharacterConfig works with every instrument controller and its attachment set | P1 | M-19, M-20, M-22 | Phase 10 | AT-R-P8-06 | Unimplemented |
| R-P8-07 | P 8 item 7 | Skin, clothing colors and materials render correctly under stage lighting on every tier | P1 | M-18, M-22 | Phase 10 | AT-R-P8-07 | Unimplemented |
| R-P8-08 | P 8 item 8 | Accessories mount on attachment points with per-body offsets; no visible body or instrument intersection | P1 | M-19, M-22 | Phase 10 | AT-R-P8-08 | Unimplemented |
| R-P8-09 | P 8 item 9 | Invalid combinations are rejected by Character.validate or repaired by normalize, with a message | P1 | M-22, M-27 | Phase 10 | AT-R-P8-09 | Unimplemented |
| R-P8-10 | P 8 item 10 | Multiplayer avatars use Character.forNet (<= 4 KB) and render identically on every peer | P1 | M-22, M-24 | Phase 13 | AT-R-P8-10 | Unimplemented |
| R-P8-11 | P 8 item 11 | Character changes rebuild only the affected rig; the application never reloads | P1 | M-19, M-22 | Phase 10 | AT-R-P8-11 | Unimplemented |
| R-P8-12 | P 8 item 12 | SCR-Characters holds >= 30 FPS on mobile Balanced tier with a single-performer preview | P1 | M-27, M-18 | Phase 10 | AT-R-P8-12 | Unimplemented |
| R-P9-01 | P 9 item 1 | All 12 keys and every Theory.SCALES pattern map to the correct pitches in profiles B, C and D | P0 | M-02, M-08 | Phase 06 | AT-R-P9-01 | Unimplemented |
| R-P9-02 | P 9 item 2 | Octave keys KeyQ and KeyE shift by 12 semitones within MIDI 0-127, shown in the HUD | P1 | M-08, M-26 | Phase 06 | AT-R-P9-02 | Unimplemented |
| R-P9-03 | P 9 item 3 | Chord inversions (root, first, second, third) produce exactly the notes Theory.invert returns | P0 | M-02, M-08 | Phase 03 | AT-R-P9-03 | Unimplemented |
| R-P9-04 | P 9 item 4 | All notes of one press start at the same audio time | P0 | M-06, M-08 | Phase 06 | AT-R-P9-04 | Unimplemented |
| R-P9-05 | P 9 item 5 | Scale-constrained and chromatic mappings are labeled in the HUD and on SCR-FreePlay settings | P1 | M-26, M-27 | Phase 06 | AT-R-P9-05 | Unimplemented |
| R-P9-06 | P 9 item 6 | Free Play recording quantize is optional (default off) and names its grid in note values | P1 | M-17, M-27 | Phase 06 | AT-R-P9-06 | Unimplemented |
| R-P9-07 | P 9 item 7 | Metronome clicks land on the beats of the selected tempo within 1 ms of scheduled time | P1 | M-05 | Phase 06 | AT-R-P9-07 | Unimplemented |
| R-P9-08 | P 9 item 8 | Notes sound while held; the HUD Sustain toggle holds released notes until it is turned off | P1 | M-08, M-06 | Phase 06 | AT-R-P9-08 | Unimplemented |
| R-P9-09 | P 9 item 9 | Changing instrument releases the held notes of the previous instrument first | P0 | M-06, M-08 | Phase 06 | AT-R-P9-09 | Unimplemented |
| R-P9-10 | P 9 item 10 | Free Play works with no chart loaded | P0 | M-08, M-28 | Phase 06 | AT-R-P9-10 | Unimplemented |
| R-P9-11 | P 9 item 11 | Free Play performances are recorded by the Recorder and replay as a take | P0 | M-17 | Phase 06 | AT-R-P9-11 | Unimplemented |
| R-P9-12 | P 9 item 12 | Key and scale changes relabel the lanes at once and apply from the next press | P1 | M-08, M-26 | Phase 06 | AT-R-P9-12 | Unimplemented |
| R-P10-01 | P 10 item 1 | Recording starts at count-in end and stops on Stop; every Recorder state change is logged | P0 | M-17, M-04 | Phase 09 | AT-R-P10-01 | Unimplemented |
| R-P10-02 | P 10 item 2 | Count-in of 1 or 2 bars plays the metronome accented on beat 1; take ticks start at count-in end | P0 | M-04, M-05, M-17 | Phase 09 | AT-R-P10-02 | Unimplemented |
| R-P10-03 | P 10 item 3 | Overdub takes align to existing tracks within 1 tick at PPQ 960 with input calibration applied once | P1 | M-17, M-07 | Phase 09 | AT-R-P10-03 | Unimplemented |
| R-P10-04 | P 10 item 4 | Each track keeps its own program and channel; changing one never alters another | P1 | M-17, M-06 | Phase 09 | AT-R-P10-04 | Unimplemented |
| R-P10-05 | P 10 item 5 | Mute, solo, volume and pan behave identically in Studio and in every playback mode | P1 | M-17, M-05 | Phase 09 | AT-R-P10-05 | Unimplemented |
| R-P10-06 | P 10 item 6 | The timeline ruler shows bars and beats from MeterMap and TempoMap at every zoom level | P1 | M-27, M-03 | Phase 09 | AT-R-P10-06 | Unimplemented |
| R-P10-07 | P 10 item 7 | Piano roll selects by click, box and keyboard; edits snap to the grid, or to 1 tick when snap is off | P1 | M-17, M-27 | Phase 09 | AT-R-P10-07 | Unimplemented |
| R-P10-08 | P 10 item 8 | With quantize off, recorded ticks are stored exactly as captured | P1 | M-17 | Phase 09 | AT-R-P10-08 | Unimplemented |
| R-P10-09 | P 10 item 9 | Undo and redo restore the exact prior state for every command (UndoStack limit 100) | P1 | M-15 | Phase 09 | AT-R-P10-09 | Unimplemented |
| R-P10-10 | P 10 item 10 | Destructive operations (delete track, clear take, replace project) ask for confirmation and are undoable | P1 | M-17, M-26, M-15 | Phase 09 | AT-R-P10-10 | Unimplemented |
| R-P10-11 | P 10 item 11 | Deleting a playing track releases its voices; deleting the recording track aborts the take first | P1 | M-17, M-05 | Phase 09 | AT-R-P10-11 | Unimplemented |
| R-P10-12 | P 10 item 12 | An aborted or failed take never replaces the previous complete take (status aborted kept apart) | P0 | M-17, M-15 | Phase 09 | AT-R-P10-12 | Unimplemented |
| R-P10-13 | P 10 item 13 | Projects with 32 tracks and 100k events stay editable; the piano roll draws only visible notes | P1 | M-17, M-27 | Phase 09 | AT-R-P10-13 | Unimplemented |
| R-P10-14 | P 10 item 14 | Save and load round-trip every supported field of the flm-project v1 schema | P0 | M-15, M-16 | Phase 09 | AT-R-P10-14 | Unimplemented |
| R-P10-15 | P 10 item 15 | Exported .mid opens in standard MIDI tools; exported .flm.json reopens in this game unchanged | P1 | M-10, M-15, M-16 | Phase 09 | AT-R-P10-15 | Unimplemented |
| R-P11-01 | P 11 item 1 | The file picker accept list and hint name .mid .midi .xml .musicxml .mxl .gp3 .gp4 .gp5 and audio types | P1 | M-14, M-27 | Phase 07 | AT-R-P11-01 | Unimplemented |
| R-P11-02 | P 11 item 2 | Import shows progress from import.progress (bytes or events parsed) when it lasts over 300 ms | P1 | M-14, M-27 | Phase 07 | AT-R-P11-02 | Unimplemented |
| R-P11-03 | P 11 item 3 | Invalid files produce an error naming the file, the problem and what to try next | P0 | M-14, M-10, M-27 | Phase 07 | AT-R-P11-03 | Unimplemented |
| R-P11-04 | P 11 item 4 | Every MIDI set-tempo event lands in the TempoMap and drives playback timing | P0 | M-10, M-03 | Phase 07 | AT-R-P11-04 | Unimplemented |
| R-P11-05 | P 11 item 5 | Multitrack files keep every track (up to 128) with its name and channel | P1 | M-10, M-14 | Phase 07 | AT-R-P11-05 | Unimplemented |
| R-P11-06 | P 11 item 6 | Overlapping notes stay polyphonic; note pairing never truncates chords | P0 | M-03, M-10 | Phase 07 | AT-R-P11-06 | Unimplemented |
| R-P11-07 | P 11 item 7 | Program, bank and channel 10 percussion assignments are preserved per track | P1 | M-10, M-14 | Phase 07 | AT-R-P11-07 | Unimplemented |
| R-P11-08 | P 11 item 8 | Unsupported events (SysEx, unknown meta) produce ImportWarning entries shown in the InspectionReport | P1 | M-10, M-14 | Phase 07 | AT-R-P11-08 | Unimplemented |
| R-P11-09 | P 11 item 9 | MusicXML keeps notes, ties, tempo, dynamics, parts and transposition; each loss produces a warning | P1 | M-12, M-14 | Phase 12 | AT-R-P11-09 | Unimplemented |
| R-P11-10 | P 11 item 10 | Guitar Pro import accepts GP3, GP4 and GP5 only; .gpx and .gp are refused as Unsupported | P1 | M-13, M-14 | Phase 12 | AT-R-P11-10 | Unimplemented |
| R-P11-11 | P 11 item 11 | Audio files become audio tracks only, never note events or charts | P0 | M-14 | Phase 12 | AT-R-P11-11 | Unimplemented |
| R-P11-12 | P 11 item 12 | Files over 25 MB (audio 100 MB), 1,000,000 events or 128 tracks are refused; parsing aborts after 5 s | P0 | M-14, M-10 | Phase 07 | AT-R-P11-12 | Unimplemented |
| R-P11-13 | P 11 item 13 | Importing over unsaved work asks Save, Discard or Cancel before the project is replaced | P0 | M-14, M-26, M-15 | Phase 09 | AT-R-P11-13 | Unimplemented |
| R-P11-14 | P 11 item 14 | Source events stay in the Song (lockedSource) after chart generation; ChartNote keeps sourceEventIds | P1 | M-08, M-03 | Phase 08 | AT-R-P11-14 | Unimplemented |
| R-P11-15 | P 11 item 15 | SCR-ImportInspect previews the generated chart with audio before play starts | P1 | M-14, M-08, M-27 | Phase 07 | AT-R-P11-15 | Unimplemented |
| R-P11-16 | P 11 item 16 | Supported formats and known limits are listed in docs/COMPATIBILITY.md and on SCR-About | P1 | M-14, M-27, `docs/COMPATIBILITY.md` | Phase 12 | AT-R-P11-16 | Unimplemented |
| R-P12-01 | P 12 item 1 | Step arrows stay readable at every lead time and reach the hit zone at their tick time within 1 frame | P1 | M-23, M-21 | Phase 11 | AT-R-P12-01 | Unimplemented |
| R-P12-02 | P 12 item 2 | Dance controls work on keyboard (arrows and D F J K), touch pads and gamepad | P1 | M-23, M-07, M-26 | Phase 11 | AT-R-P12-02 | Unimplemented |
| R-P12-03 | P 12 item 3 | Simultaneous steps (two directions in one DanceStep) are judged as one step | P1 | M-23 | Phase 11 | AT-R-P12-03 | Unimplemented |
| R-P12-04 | P 12 item 4 | Dance holds are judged at head and release with the same windows as instrument holds | P1 | M-23, M-09 | Phase 11 | AT-R-P12-04 | Unimplemented |
| R-P12-05 | P 12 item 5 | ChoreographyController moves follow the DanceChart step ticks | P1 | M-23, M-20 | Phase 11 | AT-R-P12-05 | Unimplemented |
| R-P12-06 | P 12 item 6 | Easy, normal and hard differ in measured step density and jump ratio, shown on the chart preview | P1 | M-23, M-27 | Phase 11 | AT-R-P12-06 | Unimplemented |
| R-P12-07 | P 12 item 7 | The dance HUD (arrow receptors, dance score panel) is laid out distinctly from the instrument HUD | P1 | M-26, M-27 | Phase 11 | AT-R-P12-07 | Unimplemented |
| R-P12-08 | P 12 item 8 | Practice speed and loop regions work in Dance Mode with judgments still on song time | P1 | M-23, M-04 | Phase 11 | AT-R-P12-08 | Unimplemented |
| R-P12-09 | P 12 item 9 | DanceChart validation runs before play; an invalid chart shows its error and does not start | P1 | M-23, M-27 | Phase 11 | AT-R-P12-09 | Unimplemented |
| R-P12-10 | P 12 item 10 | Missing or failing choreography falls back to idle dance motion while scoring continues | P1 | M-23, M-20 | Phase 11 | AT-R-P12-10 | Unimplemented |
| R-P12-11 | P 12 item 11 | Reduced motion limits choreography to small moves and disables camera sweeps | P1 | M-23, M-20, M-26 | Phase 11 | AT-R-P12-11 | Unimplemented |
| R-P12-12 | P 12 item 12 | Pause and restart in Dance Mode behave exactly as in instrument play (frozen or fresh state) | P1 | M-23, M-28 | Phase 11 | AT-R-P12-12 | Unimplemented |
| R-P13-01 | P 13 item 1 | Create and join flows show numbered steps with Copy and Paste buttons for invite and answer codes | P1 | M-24, M-27 | Phase 13 | AT-R-P13-01 | Unimplemented |
| R-P13-02 | P 13 item 2 | Lobby and stage label every player with name, instrument and avatar | P1 | M-24, M-27, M-21 | Phase 13 | AT-R-P13-02 | Unimplemented |
| R-P13-03 | P 13 item 3 | The host sends one shared-clock start time at least 1.5 s ahead; every peer starts from it | P1 | M-24, M-04 | Phase 13 | AT-R-P13-03 | Unimplemented |
| R-P13-04 | P 13 item 4 | Timing uses Net.Clock offsets (8 samples, then every 10 s), never message arrival time alone | P1 | M-24 | Phase 13 | AT-R-P13-04 | Unimplemented |
| R-P13-05 | P 13 item 5 | Reconnection restores the player's slot, scores and position from the host's authoritative state | P1 | M-24 | Phase 13 | AT-R-P13-05 | Unimplemented |
| R-P13-06 | P 13 item 6 | Host departure ends the session and shows guests their results (host migration Deferred) | P1 | M-24, M-27 | Phase 13 | AT-R-P13-06 | Unimplemented |
| R-P13-07 | P 13 item 7 | Every NetMessage carries seq; duplicate or stale messages are dropped without changing state | P1 | M-24 | Phase 13 | AT-R-P13-07 | Unimplemented |
| R-P13-08 | P 13 item 8 | The host judges every player against the same chart settingsHash and judgment windows | P1 | M-24, M-09 | Phase 13 | AT-R-P13-08 | Unimplemented |
| R-P13-09 | P 13 item 9 | Collaborative Studio conflict handling is specified (Part 6.24 rules); the feature is not built in v1 | P2 | M-24 | Phase 13 | n/a | Deferred |
| R-P13-10 | P 13 item 10 | Invalid, oversized (> 64 KB) or rate-exceeding (> 60 per s) messages are rejected and logged | P0 | M-24 | Phase 13 | AT-R-P13-10 | Unimplemented |
| R-P13-11 | P 13 item 11 | Network errors show DLG-NetError naming the failed step and a next action | P1 | M-24, M-27 | Phase 13 | AT-R-P13-11 | Unimplemented |
| R-P13-12 | P 13 item 12 | Any multiplayer failure leaves every local mode fully usable | P0 | M-24, M-28 | Phase 13 | AT-R-P13-12 | Unimplemented |
| R-P13-13 | P 13 item 13 | SCR-Multiplayer states what data is sent and to whom (Net.PRIVACY_TEXT) | P1 | M-24, M-27 | Phase 13 | AT-R-P13-13 | Unimplemented |
| R-P13-14 | P 13 item 14 | Relay server requirements and operating limits are documented in README.md and on SCR-About | P1 | M-24, `server/relay.mjs` | Phase 13 | AT-R-P13-14 | Unimplemented |
| R-P14-01 | P 14 item 1 | Essential controls have hit areas >= 44x44 CSS px in menus and >= 56x56 for gameplay pads | P1 | M-26 | Phase 01 | AT-R-P14-01 | Unimplemented |
| R-P14-02 | P 14 item 2 | Touch targets keep gaps of at least 8 px | P1 | M-26 | Phase 01 | AT-R-P14-02 | Unimplemented |
| R-P14-03 | P 14 item 3 | Four simultaneous touches register on supported devices, with the Touch Events fallback of OQ-1 | P1 | M-07 | Phase 03 | AT-R-P14-03 | Unimplemented |
| R-P14-04 | P 14 item 4 | pointercancel, touchcancel and interrupted gestures release every active pad | P0 | M-07, M-26 | Phase 03 | AT-R-P14-04 | Unimplemented |
| R-P14-05 | P 14 item 5 | Portrait and landscape each have a designed layout with orientation-specific pad placement | P1 | M-26 | Phase 01 | AT-R-P14-05 | Unimplemented |
| R-P14-06 | P 14 item 6 | Safe-area insets pad the HUD, touch pads and dialogs | P1 | M-26, `src/shell.html` | Phase 01 | AT-R-P14-06 | Unimplemented |
| R-P14-07 | P 14 item 7 | Layout height follows the visual viewport (dvh with fallback) so browser bars never hide controls | P1 | M-26 | Phase 01 | AT-R-P14-07 | Unimplemented |
| R-P14-08 | P 14 item 8 | Orientation changes relayout without stopping, seeking or re-anchoring the Transport | P1 | M-26, M-28 | Phase 14 | AT-R-P14-08 | Unimplemented |
| R-P14-09 | P 14 item 9 | Audio unlocks through Audio.unlock on the first pointerup or keydown, including on iOS Safari | P0 | M-05, M-29 | Phase 04 | AT-R-P14-09 | Unimplemented |
| R-P14-10 | P 14 item 10 | UI scale 0.85-1.5 keeps text legible and layouts intact | P1 | M-26 | Phase 01 | AT-R-P14-10 | Unimplemented |
| R-P14-11 | P 14 item 11 | Mobile devices start on the Balanced or Low tier chosen by Render.pickTier | P1 | M-18 | Phase 05 | AT-R-P14-11 | Unimplemented |
| R-P14-12 | P 14 item 12 | Mobile steady memory <= 150 MB is measured on a mid-range physical device | P1 | M-18, M-05, `tools/perf.mjs` | Phase 15 | AT-R-P14-12 | Unimplemented |
| R-P14-13 | P 14 item 13 | Returning from background keeps the paused state, re-anchors clocks and restores GL if it was lost | P1 | M-28, M-04, M-18 | Phase 14 | AT-R-P14-13 | Unimplemented |
| R-P14-14 | P 14 item 14 | Menus, dialogs, sliders and editors are fully usable by touch or keyboard without a mouse | P1 | M-26 | Phase 01 | AT-R-P14-14 | Unimplemented |
| R-P15-01 | P 15 item 1 | All core actions are reachable by keyboard, touch and gamepad | P1 | M-07, M-26 | Phase 01 | AT-R-P15-01 | Unimplemented |
| R-P15-02 | P 15 item 2 | Every focusable element shows a visible focus ring (>= 2 px, >= 3:1 contrast) | P1 | M-26 | Phase 01 | AT-R-P15-02 | Unimplemented |
| R-P15-03 | P 15 item 3 | Dialogs trap focus, close on Escape and restore focus on close | P1 | M-26 | Phase 01 | AT-R-P15-03 | Unimplemented |
| R-P15-04 | P 15 item 4 | Lanes, judgments and status use shape and text in addition to color | P1 | M-21, M-26 | Phase 08 | AT-R-P15-04 | Unimplemented |
| R-P15-05 | P 15 item 5 | Reduced motion (setting or prefers-reduced-motion) disables non-essential animation | P1 | M-26, M-20 | Phase 01 | AT-R-P15-05 | Unimplemented |
| R-P15-06 | P 15 item 6 | Text stays readable at UI scale 0.85-1.5 and at 200 % browser zoom | P1 | M-26 | Phase 01 | AT-R-P15-06 | Unimplemented |
| R-P15-07 | P 15 item 7 | Every interactive control has an accessible name and role; status changes use an aria-live region | P1 | M-26 | Phase 01 | AT-R-P15-07 | Unimplemented |
| R-P15-08 | P 15 item 8 | Error messages name the operation that failed (for example "Save failed: ...") | P1 | M-01, M-27 | Phase 01 | AT-R-P15-08 | Unimplemented |
| R-P15-09 | P 15 item 9 | Disabled controls show a one-line reason for being unavailable | P1 | M-26 | Phase 01 | AT-R-P15-09 | Unimplemented |
| R-P15-10 | P 15 item 10 | Timing window scale and difficulty are adjustable where the mode allows; changed values mark Assisted | P1 | M-09, M-27 | Phase 08 | AT-R-P15-10 | Unimplemented |
| R-P15-11 | P 15 item 11 | Accessibility settings persist across sessions through Storage.saveSettings | P1 | M-16, M-26 | Phase 08 | AT-R-P15-11 | Unimplemented |
| R-P15-12 | P 15 item 12 | Reduced effects keep judgment flashes, lane highlights and note motion intact | P1 | M-21, M-26 | Phase 05 | AT-R-P15-12 | Unimplemented |
| R-P16-01 | P 16 item 1 | Save reports success only after read-back verification of the written record | P0 | M-16 | Phase 09 | AT-R-P16-01 | Unimplemented |
| R-P16-02 | P 16 item 2 | A failed save leaves the previously saved version and its .bak intact | P0 | M-16 | Phase 09 | AT-R-P16-02 | Unimplemented |
| R-P16-03 | P 16 item 3 | Every project file carries format flm-project and an explicit version | P0 | M-15 | Phase 09 | AT-R-P16-03 | Unimplemented |
| R-P16-04 | P 16 item 4 | Older versions migrate through Project.migrate; newer or unknown versions are refused with a message | P0 | M-15, M-27 | Phase 09 | AT-R-P16-04 | Unimplemented |
| R-P16-05 | P 16 item 5 | A corrupted project yields an error offering backup, checkpoint restore or raw export | P0 | M-15, M-16, M-27 | Phase 09 | AT-R-P16-05 | Unimplemented |
| R-P16-06 | P 16 item 6 | Quota errors open DLG-SaveFailed offering Export; Storage.estimateQuota runs before large writes | P0 | M-16, M-27 | Phase 09 | AT-R-P16-06 | Unimplemented |
| R-P16-07 | P 16 item 7 | Autosave runs only at safe points, never during recording or playback | P1 | M-16, M-17 | Phase 09 | AT-R-P16-07 | Unimplemented |
| R-P16-08 | P 16 item 8 | Any project can be exported as .flm.json at any time for backup | P0 | M-15, M-16 | Phase 09 | AT-R-P16-08 | Unimplemented |
| R-P16-09 | P 16 item 9 | Imported projects and assets pass Project.validate and the import limits before use | P0 | M-15, M-14 | Phase 09 | AT-R-P16-09 | Unimplemented |
| R-P16-10 | P 16 item 10 | Chart and track references are checked before playback; dangling ones are dropped with a warning | P1 | M-15, M-28 | Phase 09 | AT-R-P16-10 | Unimplemented |
| R-P16-11 | P 16 item 11 | Large projects stay within memory budgets; serialization <= 200 ms for 100k events | P1 | M-15, M-16 | Phase 09 | AT-R-P16-11 | Unimplemented |
| R-P16-12 | P 16 item 12 | Ten save-load cycles produce identical serialized content | P0 | M-15, M-16 | Phase 09 | AT-R-P16-12 | Unimplemented |
| R-P17-01 | P 17 item 1 | Load to main menu is measured by tools/perf.mjs against 1.5 s desktop and 3.0 s mobile | P1 | M-29, `tools/perf.mjs` | Phase 14 | AT-R-P17-01 | Unimplemented |
| R-P17-02 | P 17 item 2 | Time to first playable Quick Play is measured against 5 s desktop and 8 s mobile | P1 | M-29, M-30, `tools/perf.mjs` | Phase 14 | AT-R-P17-02 | Unimplemented |
| R-P17-03 | P 17 item 3 | Frame rate is measured in the five-performer full-band scene on every tier | P1 | M-18, M-21, `tools/perf.mjs` | Phase 14 | AT-R-P17-03 | Unimplemented |
| R-P17-04 | P 17 item 4 | Audio timing is tested under forced render load (busy frames) and keeps the scheduling budgets | P1 | M-05, M-31 | Phase 14 | AT-R-P17-04 | Unimplemented |
| R-P17-05 | P 17 item 5 | Polyphony (64 desktop, 32 mobile) and the 32-track limit are documented on SCR-About and in docs | P1 | M-05, M-27 | Phase 14 | AT-R-P17-05 | Unimplemented |
| R-P17-06 | P 17 item 6 | Instrument warmup is lazy per used program and bounded in time; no sound bank is bundled | P1 | M-06 | Phase 14 | AT-R-P17-06 | Unimplemented |
| R-P17-07 | P 17 item 7 | GL buffers, textures and programs are freed on performer removal and mode leave (Render.counters) | P1 | M-18, M-21 | Phase 05 | AT-R-P17-07 | Unimplemented |
| R-P17-08 | P 17 item 8 | All DOM listeners go through Core.dom; their count stays constant across repeated navigation | P1 | M-01, M-28 | Phase 01 | AT-R-P17-08 | Unimplemented |
| R-P17-09 | P 17 item 9 | 20 mode enter-leave cycles leave assertClean counters at baseline and memory growth <= 10 MB | P1 | M-28 | Phase 14 | AT-R-P17-09 | Unimplemented |
| R-P17-10 | P 17 item 10 | A 30 min playback session and a 10 min recording session are tested | P1 | M-31, `tools/perf.mjs` | Phase 14 | AT-R-P17-10 | Unimplemented |
| R-P17-11 | P 17 item 11 | Imports at the limits (25 MB file, 1,000,000 events, 128 tracks) are tested from test-corpus | P1 | M-14, M-31, `tools/make-corpus.mjs` | Phase 07 | AT-R-P17-11 | Unimplemented |
| R-P17-12 | P 17 item 12 | The tier is chosen from device capability and downgraded when p95 frame time > 33 ms over 5 s | P1 | M-18 | Phase 14 | AT-R-P17-12 | Unimplemented |
| R-P17-13 | P 17 item 13 | Context loss pauses drawing; restore rebuilds GL resources or falls back to the Abstract tier | P1 | M-18, M-21 | Phase 05 | AT-R-P17-13 | Unimplemented |
| R-P17-14 | P 17 item 14 | Performance targets are verified on representative physical devices (Part 9 device matrix) | P1 | M-31, `tools/perf.mjs` | Phase 15 | AT-R-P17-14 | Unimplemented |
| R-P18-01 | P 18 item 1 | The shipped artifact is one file, FingerLickinMusic.html | P0 | `tools/build.mjs`, `src/shell.html` | Phase 01 | AT-R-P18-01 | Unimplemented |
| R-P18-02 | P 18 item 2 | All code and styles are inlined by tools/build.mjs; no external script, style, font or image | P0 | `tools/build.mjs` | Phase 01 | AT-R-P18-02 | Unimplemented |
| R-P18-03 | P 18 item 3 | Embedded content (code, demo data, icons) is original or licensed and listed in the license inventory | P0 | M-30, `docs/FINAL-REPORT.md` | Phase 16 | AT-R-P18-03 | Unimplemented |
| R-P18-04 | P 18 item 4 | External dependencies (optional STUN server, optional relay) are named on SCR-About and in README.md | P0 | M-24, M-27, `README.md` | Phase 16 | AT-R-P18-04 | Unimplemented |
| R-P18-05 | P 18 item 5 | The delivered file opens directly from file:// and from http(s) in every browser claimed Supported | P0 | `FingerLickinMusic.html` | Phase 15 | AT-R-P18-05 | Unimplemented |
| R-P18-06 | P 18 item 6 | Every local mode works offline; the default configuration makes no network request at runtime | P0 | M-24, M-29 | Phase 15 | AT-R-P18-06 | Unimplemented |
| R-P18-07 | P 18 item 7 | Optional remote services (STUN, relay) fail with a message and never block another feature | P1 | M-24, M-27 | Phase 13 | AT-R-P18-07 | Unimplemented |
| R-P18-08 | P 18 item 8 | No credentials, keys or tokens are embedded; the build scans the output and fails on a match | P0 | `tools/build.mjs` | Phase 16 | AT-R-P18-08 | Unimplemented |
| R-P18-09 | P 18 item 9 | Storage behavior (localStorage, IndexedDB) is checked from file:// and http(s) in each tested browser | P1 | M-16 | Phase 15 | AT-R-P18-09 | Unimplemented |
| R-P18-10 | P 18 item 10 | Import and export are tested from the delivered file, not only the test build | P1 | M-14, M-16 | Phase 15 | AT-R-P18-10 | Unimplemented |
| R-P18-11 | P 18 item 11 | The final file is tested outside the development setup: fresh browser profile, no server, no repo files | P0 | `FingerLickinMusic.html` | Phase 16 | AT-R-P18-11 | Unimplemented |
| R-P18-12 | P 18 item 12 | No development tool is needed at runtime; Node is used only for build, tests and the optional relay | P0 | `tools/build.mjs`, `server/relay.mjs` | Phase 16 | AT-R-P18-12 | Unimplemented |
| R-P19-01 | P 19 item 1 | Every important async operation has a catch path that reports to ErrorReporter | P0 | M-01 | Phase 01 | AT-R-P19-01 | Unimplemented |
| R-P19-02 | P 19 item 2 | A failed import leaves the current project and song untouched | P0 | M-14, M-15 | Phase 07 | AT-R-P19-02 | Unimplemented |
| R-P19-03 | P 19 item 3 | A failed or aborted recording preserves all earlier takes | P0 | M-17 | Phase 09 | AT-R-P19-03 | Unimplemented |
| R-P19-04 | P 19 item 4 | Audio failures (suspended, closed, device change) offer Resume audio and Restart audio actions | P1 | M-05, M-27 | Phase 04 | AT-R-P19-04 | Unimplemented |
| R-P19-05 | P 19 item 5 | Rendering failures fall back WebGL2 -> WebGL1 -> Abstract tier with a notice | P1 | M-18, M-27 | Phase 05 | AT-R-P19-05 | Unimplemented |
| R-P19-06 | P 19 item 6 | Every network operation has a timeout; no session waits indefinitely | P1 | M-24 | Phase 13 | AT-R-P19-06 | Unimplemented |
| R-P19-07 | P 19 item 7 | Settings are validated against the schema on load; invalid values are clamped or reset and logged | P0 | M-16, M-26 | Phase 01 | AT-R-P19-07 | Unimplemented |
| R-P19-08 | P 19 item 8 | Unsupported formats and features are labeled Unsupported with the reason and an alternative | P1 | M-14, M-27 | Phase 12 | AT-R-P19-08 | Unimplemented |
| R-P19-09 | P 19 item 9 | User-facing errors never show stack traces, file paths or peer addresses; details stay in diagnostics | P0 | M-01, M-27 | Phase 01 | AT-R-P19-09 | Unimplemented |
| R-P19-10 | P 19 item 10 | Log ring buffer holds 500 entries, diagnostics export <= 200 KB, and logs are never persisted | P0 | M-01 | Phase 01 | AT-R-P19-10 | Unimplemented |
| R-P19-11 | P 19 item 11 | Each critical error path has a regression test (UT or FI) | P0 | M-31 | Phase 15 | AT-R-P19-11 | Unimplemented |
| R-P19-12 | P 19 item 12 | No important operation fails silently: each failure emits error and shows a message | P0 | M-01, M-27 | Phase 01 | AT-R-P19-12 | Unimplemented |
| R-P20-01 | P 20 item 1 | Unit tests cover timing (TempoMap, Transport, Scheduler) and mapping (profiles A-F, ChartGenerator) | P0 | M-31 | Phase 03 | AT-R-P20-01 | Unimplemented |
| R-P20-02 | P 20 item 2 | Integration tests cover audio, input, scoring and rendering in headless Chromium | P1 | M-31, `tools/selftest.mjs` | Phase 08 | AT-R-P20-02 | Unimplemented |
| R-P20-03 | P 20 item 3 | Import tests cover valid, malformed and oversized files from test-corpus | P0 | M-31, `tools/make-corpus.mjs` | Phase 07 | AT-R-P20-03 | Unimplemented |
| R-P20-04 | P 20 item 4 | Save and load tests verify data integrity through round trips and corrupted records | P0 | M-31 | Phase 09 | AT-R-P20-04 | Unimplemented |
| R-P20-05 | P 20 item 5 | Multiplayer tests cover added latency, disconnects and invalid messages | P1 | M-31, M-24 | Phase 13 | AT-R-P20-05 | Unimplemented |
| R-P20-06 | P 20 item 6 | Mobile tests run on physical devices, or are listed as owner actions with the reason | P1 | M-31 | Phase 15 | AT-R-P20-06 | Unimplemented |
| R-P20-07 | P 20 item 7 | Cross-browser tests run on every browser named in Part 1.6 | P1 | M-31 | Phase 15 | AT-R-P20-07 | Unimplemented |
| R-P20-08 | P 20 item 8 | Performance tests cover long (30 min) and demanding (5 performers, 64 voices) sessions | P1 | M-31, `tools/perf.mjs` | Phase 14 | AT-R-P20-08 | Unimplemented |
| R-P20-09 | P 20 item 9 | Accessibility checks are run: keyboard-only pass, screen reader pass, contrast check | P1 | M-26, M-31 | Phase 15 | AT-R-P20-09 | Unimplemented |
| R-P20-10 | P 20 item 10 | The license and dependency inventory is reviewed and published in docs/FINAL-REPORT.md | P1 | `docs/FINAL-REPORT.md` | Phase 16 | AT-R-P20-10 | Unimplemented |
| R-P20-11 | P 20 item 11 | The release has no open Critical defect in docs/STATUS.md | P0 | `docs/STATUS.md` | Phase 16 | AT-R-P20-11 | Unimplemented |
| R-P20-12 | P 20 item 12 | Every documented limitation matches tested behavior | P0 | M-27, `docs/COMPATIBILITY.md` | Phase 16 | AT-R-P20-12 | Unimplemented |
| R-P20-13 | P 20 item 13 | Every P0 and P1 requirement has an AT-R-ID acceptance test in Part 12 | P0 | none (plan) | Phase 00 | AT-R-P20-13 | Unimplemented |
| R-P20-14 | P 20 item 14 | The final HTML is validated independently: fresh profile, markup check and full acceptance run | P0 | `FingerLickinMusic.html`, M-31 | Phase 16 | AT-R-P20-14 | Unimplemented |
| R-P21-01 | P 21 item 1 | Buttons show a subtle pressed state (scale 0.97 for 80 ms) | P2 | M-26 | Phase 01 | n/a | Unimplemented |
| R-P21-02 | P 21 item 2 | Focus moves with a 120 ms ring transition (instant under reduced motion) | P2 | M-26 | Phase 01 | n/a | Unimplemented |
| R-P21-03 | P 21 item 3 | Panels open and close with 150-200 ms transitions and no layout jump | P2 | M-26 | Phase 01 | n/a | Unimplemented |
| R-P21-04 | P 21 item 4 | Loading indicators appear only after 300 ms of waiting | P2 | M-26 | Phase 01 | n/a | Unimplemented |
| R-P21-05 | P 21 item 5 | Progress bars reflect bytes or steps completed, never timers | P2 | M-14, M-26 | Phase 07 | n/a | Unimplemented |
| R-P21-06 | P 21 item 6 | Audio previews fade in and out over 30 ms, so they never click | P2 | M-05, M-14 | Phase 07 | n/a | Unimplemented |
| R-P21-07 | P 21 item 7 | Tooltips appear only on non-obvious controls such as icon-only buttons | P2 | M-26, M-27 | Phase 01 | n/a | Unimplemented |
| R-P21-08 | P 21 item 8 | Empty states name the next action (for example "Import a file or pick a demo song") | P2 | M-27 | Phase 07 | n/a | Unimplemented |
| R-P21-09 | P 21 item 9 | Confirmation dialogs state what will be lost and label the confirm button with its effect | P2 | M-26, M-27 | Phase 09 | n/a | Unimplemented |
| R-P21-10 | P 21 item 10 | Numeric controls show units and precision: ms integer, dB one decimal, BPM integer, percent integer | P2 | M-26 | Phase 01 | n/a | Unimplemented |
| R-P21-11 | P 21 item 11 | Sliders respond to arrow keys, PageUp, PageDown, Home, End and touch drag | P2 | M-26 | Phase 01 | n/a | Unimplemented |
| R-P21-12 | P 21 item 12 | Long track names truncate with an ellipsis and keep the full name in the title attribute | P2 | M-26, M-27 | Phase 09 | n/a | Unimplemented |
| R-P21-13 | P 21 item 13 | Songs without artwork show a generated cover from title initials and track color | P2 | M-27 | Phase 07 | n/a | Unimplemented |
| R-P21-14 | P 21 item 14 | All icons come from the one SVG sprite with the same stroke weight | P2 | M-26, `src/shell.html` | Phase 01 | n/a | Unimplemented |
| R-P21-15 | P 21 item 15 | SCR-Library keeps its filters and scroll position when the user returns from play | P2 | M-27 | Phase 07 | n/a | Unimplemented |
| R-P21-16 | P 21 item 16 | Volume, difficulty and input mappings persist and change only by user action | P2 | M-16, M-27 | Phase 08 | n/a | Unimplemented |
| R-P21-17 | P 21 item 17 | Completed operations (save, export, import) confirm with a toast | P2 | M-26, M-27 | Phase 09 | n/a | Unimplemented |
| R-P21-18 | P 21 item 18 | Visual effects stay on the beat and are capped in brightness and count | P2 | M-21 | Phase 05 | n/a | Unimplemented |
| R-P21-19 | P 21 item 19 | All five built-in demos are reviewed for musical and visual coherence | P2 | M-30 | Phase 16 | n/a | Unimplemented |
| R-P22-01 | P 22 intro | A subsystem counts as polished only when every applicable P 22 condition holds (final acceptance review) | P1 | M-01 to M-30 | Phase 16 | AT-R-P22-01 | Unimplemented |
| R-P22-02 | P 22 item 1 | Polished subsystem condition: functionally correct across its supported use cases | P1 | M-01 to M-30 | Phase 16 | AT-R-P22-02 | Unimplemented |
| R-P22-03 | P 22 item 2 | Polished subsystem condition: visually consistent with the product (P 2 rows hold) | P1 | M-26, M-27, M-21 | Phase 16 | AT-R-P22-03 | Unimplemented |
| R-P22-04 | P 22 item 3 | Polished subsystem condition: responsive under expected loads (Part 9 budgets met) | P1 | M-01 to M-30 | Phase 16 | AT-R-P22-04 | Unimplemented |
| R-P22-05 | P 22 item 4 | Polished subsystem condition: accessible through every supported input method | P1 | M-07, M-26 | Phase 16 | AT-R-P22-05 | Unimplemented |
| R-P22-06 | P 22 item 5 | Polished subsystem condition: resilient to malformed data, interruptions and recoverable failures | P1 | M-01 to M-30 | Phase 16 | AT-R-P22-06 | Unimplemented |
| R-P22-07 | P 22 item 6 | Polished subsystem condition: covered by automated or reproducible manual tests | P1 | M-31 | Phase 16 | AT-R-P22-07 | Unimplemented |
| R-P22-08 | P 22 item 7 | Polished subsystem condition: integrated with the rest of the application | P1 | M-27, M-28 | Phase 16 | AT-R-P22-08 | Unimplemented |
| R-P22-09 | P 22 item 8 | Polished subsystem condition: remaining limitations are documented | P1 | M-27, `docs/FINAL-REPORT.md` | Phase 16 | AT-R-P22-09 | Unimplemented |
| R-P22-10 | P 22 item 9 | Polished subsystem condition: checked in the target deployment (delivered file opened from file://) | P1 | `FingerLickinMusic.html` | Phase 16 | AT-R-P22-10 | Unimplemented |
| R-P22-11 | P 22 item 10 | Polished subsystem condition: no known release-blocking defect | P0 | `docs/STATUS.md` | Phase 16 | AT-R-P22-11 | Unimplemented |
| R-P22-12 | P 22 closing | Broken timing, confusing controls or lost recordings each block release, whatever else is polished | P0 | M-04, M-07, M-17 | Phase 16 | AT-R-P22-12 | Unimplemented |
| R-P22-13 | P 22 closing | Release bar: looks polished, sounds convincing, responds at once, keeps work, behaves predictably | P1 | M-01 to M-30 | Phase 16 | AT-R-P22-13 | Unimplemented |
