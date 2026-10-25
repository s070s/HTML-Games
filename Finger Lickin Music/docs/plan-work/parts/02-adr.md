## 2. Architecture and technology decisions

This part elaborates the sixteen fixed architecture decisions ADR-01 to ADR-16. Each decision
is final; later parts cite them as `ADR-NN` and may cite a numbered sub-decision as
"ADR-NN decision k". Every "Alternatives considered" table scores each alternative on the
nine B 19.3 criteria with an integer 1-5 (5 = best for this product), total out of 45. The
scores are planning judgments made at plan version 1.0.0, not measurements; the chosen row is
marked `(chosen)`. "Verification" names the test categories of Part 12 (UT, IT, FT, TT, PT,
XT, FI, LT, AT) and the observable each must establish; test IDs are assigned in Part 12.

Browser floor assumed throughout this part (the support policy itself is 1.6): Chromium 90,
Firefox 90, Safari 14.1, iOS Safari 14.5, Android Chrome 90. A claim about any browser is
published only after its XT tests pass (B 5.1).

### 2.1 ADR-01 Single-file delivery via a build step

Context: B 5.2, 5.3, 5.4, 19.4, E 9, I 14.1, 14.3, P 18. The primary artifact must open
directly from disk without a build pipeline, yet the source must stay maintainable as about
31 modules plus tests. `ClassTimeKiller/` in this repository already uses a concatenating
build with a marker and is the precedent.

Decision:

1. Source lives in `Finger Lickin Music/src/`: `shell.html` plus module files
   `NN-name.js` (two-digit prefix, lower-case kebab name, exactly the names in BRIEF
   section 4 / Part 3.1). Test modules are `90-selftest.js` and `91-test-<group>.js`.
2. `node tools/build.mjs` reads `shell.html`, finds the marker `/*@@SCRIPT@@*/` (which must
   occur exactly once, inside the single application `<script>`), and replaces it with the
   module files joined in byte-wise ascending file-name order. Before each file the build
   inserts one banner line `/* @@FILE src/NN-name.js @@ */` so a line number in a stack
   trace can be mapped back; the build prints a "file -> first output line" table to stdout.
3. Two outputs in `Finger Lickin Music/`: `FingerLickinMusic.html` (modules `0*`-`3*` only;
   committed to the repository so players never need Node) and
   `FingerLickinMusic.test.html` (same plus `9*-*.js`; gitignored). No other output files.
4. Every input file may carry a UTF-8 BOM; the build strips them all and emits exactly one
   BOM at byte 0 of each output. All CRLF and lone CR are normalized to LF. Output encoding
   is UTF-8.
5. Size gate on each output: warn above 1.5 MB, fail (exit code 3, no file written) above
   2.5 MB. The gate applies to the shipped file; the test file is reported but not failed.
6. Syntax gate: the joined script (without the HTML wrapper) is written to a temporary file
   in the OS temp directory and checked with `node --check`; a failure aborts the build with
   exit code 2 and the node error text.
7. Version stamping: the build reads the `VERSION = 'x.y.z'` constant from `01-core.js`
   (regular expression `/VERSION\s*=\s*'(\d+\.\d+\.\d+)'/`), fails if absent, and writes
   an HTML comment `<!-- Finger Lickin Music vX.Y.Z built YYYY-MM-DDTHH:MM:SSZ -->` as the
   first line after the doctype. `FLM.VERSION` at runtime comes from the constant, not from
   the comment.
8. Flags: `--check` builds to memory only (all gates, no files); `--online <relayUrl>`
   widens `connect-src` in the CSP meta to include the relay origin (`ws:` or `wss:` scheme
   as given) and sets `FLM.Core.BUILD.relayUrl`; without the flag the Standalone edition is
   built. The build never fetches anything.
9. Exit codes: 0 success, 1 usage or missing input, 2 syntax gate, 3 size gate.
10. The shipped file is a plain HTML document: one `<style>`, one inline SVG symbol sprite,
    the DOM scaffold, one tiny early error-handler `<script>` (fewer than 40 lines, no
    dependency on modules) and the single application `<script>`. No `<script src>`, no
    `<link>`, no `@import`, no `url()` other than `data:`.
11. Working with the source is optional for anyone but the implementing session; a change to
    the game is a change to `src/` followed by a rebuild and a commit of both source and the
    rebuilt shipped file in the same commit.

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Hand-edit one monolithic HTML file, no build | 5 | 5 | 4 | 5 | 1 | 4 | 5 | 5 | 5 | 39 |
| ES modules, many files served from a folder | 3 | 5 | 4 | 5 | 5 | 4 | 5 | 2 | 1 | 34 |
| npm bundler (esbuild or rollup) | 5 | 5 | 5 | 4 | 4 | 3 | 5 | 3 | 5 | 39 |
| Own Node concatenation at a marker (chosen) | 5 | 5 | 4 | 5 | 4 | 5 | 5 | 5 | 5 | 43 |

Notes: ES modules fail on `file://` (module scripts are blocked by CORS in Chromium and
Firefox). An npm bundler needs network installs that are not available (ADR-02). Hand-editing
one 1 MB file is not maintainable for 31 modules and a test suite.

Consequences: easier - players open one file; stack traces stay readable (no minification);
tests ship separately without touching the player build. Harder - every edit needs a rebuild
before testing in the browser; the repository stores the built artifact, so the shipped file
and `src/` must be committed together (the T sections in Part 11 make the rebuild part of
every step). Limits the UI must disclose: none; the About screen states "Single file, no
build needed to play".

Verification: FT (the shipped file is byte-checked: single BOM, LF only, size, marker
absent, no external references); UT for `tools/build.mjs` run through `node` (ordering,
BOM stripping, size gate, exit codes); XT (the delivered file opens from `file://` in the five
browsers); LT (final file validated independently of the development folder, P 18).

### 2.2 ADR-02 Zero runtime dependencies

Context: B 5.3, 11.2, 12.6, 19.3, 19.5, 23.3, E 9, I 14.2, P 18. The spec permits libraries
when licensing and size allow, but demands a documented loading and failure strategy. The
development environment blocks CDNs, so no library can be fetched during implementation;
all three existing games in the repository ship their own renderers with zero dependencies.

Decision:

1. The shipped HTML contains no third-party code, fonts, images, sound data or models. The
   runtime dependency inventory (2.17) has exactly zero rows.
2. three.js was evaluated and rejected: MIT licensed, about 650 KB minified (43 percent of the
   1.5 MB target), its UMD build was discontinued after r160 so embedding a current release
   needs a module-to-IIFE wrapping step, and it cannot be fetched in the development
   environment. The own renderer (ADR-03) covers the required feature set (capsules and
   boxes, Lambert shading, blob shadows, instancing).
3. Audio libraries (Tone.js, WebAudioFont, soundfont-player), parser libraries (midi-file,
   @tonejs/midi, alphaTab, opensheetmusicdisplay) and compression libraries (pako, fflate,
   JSZip) are all rejected for the same reasons: unavailable offline in development, and each
   would still need the game's own scheduler, model and limits around it.
4. Reference use is allowed, copying is not: a public specification or a library's documented
   behavior may be consulted to understand a format; no third-party source text is pasted
   into `src/`. Every line in `src/` is original to this project.
5. The About screen (SCR-About) lists "Third-party code: none" and "Fonts, sounds, models:
   none; all content is original and synthesized".
6. Optional external resources remain exactly three and are all network services, never
   code: the public STUN server (ADR-07, off by default), the optional relay (ADR-07) and a
   user-loaded SoundFont file (ADR-04, Deferred P2). None is fetched without an explicit user
   action.

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Embed three.js (r160 UMD) for rendering | 5 | 4 | 2 | 5 | 3 | 4 | 5 | 5 | 4 | 37 |
| Embed Tone.js for audio | 4 | 3 | 2 | 5 | 3 | 4 | 3 | 5 | 4 | 33 |
| Embed alphaTab for GP and MusicXML | 4 | 3 | 1 | 3 | 3 | 3 | 5 | 5 | 3 | 30 |
| Load libraries from a CDN at runtime | 4 | 4 | 5 | 4 | 3 | 2 | 5 | 1 | 1 | 29 |
| Embed pako or fflate for inflate | 5 | 5 | 4 | 5 | 4 | 4 | 5 | 5 | 4 | 41 |
| No third-party code at all (chosen) | 5 | 5 | 5 | 5 | 4 | 5 | 4 | 5 | 5 | 43 |

Notes: fflate scores well but cannot be obtained in the development environment and an RFC
1951 inflate is about 300 lines (M-11). alphaTab is MPL-2.0 and over 1 MB because it is an
engraver, which the spec explicitly separates from event import (B 15.3).

Consequences: easier - licensing review is trivial; offline and `file://` behavior is
deterministic; no supply-chain risk. Harder - every parser, the renderer, inflate and the
synthesizer are own code with own tests (Parts 6 and 12 size the test minimums
accordingly); timbral fidelity is limited to synthesis (ADR-04). Limits the UI must
disclose: "All instrument sounds are synthesized" on SCR-About, SCR-Settings (audio section)
and SCR-ImportInspect.

Verification: FT (static scan of the shipped file: no `<script src`, `<link`, `@import`,
`http://`, `https://` outside the About text and the STUN constant; a grep gate in
`tools/build.mjs`); XT (offline open: network disabled, every mode but Multiplayer works);
LT (license inventory review, P 20).

### 2.3 ADR-03 Rendering: own WebGL renderer with a 2D Abstract tier

Context: B 12.1-12.7, 20.2, 21.3, E 6.1, 6.2, I 4.1-4.4, 12.1, P 7.1-7.3, 17. The spec
requires a scene graph, camera system, rig, event-driven animation, quality tiers, capability
detection, resource disposal and graceful fallback down to a non-3D visualization, and asks
for a comparison of a library against custom WebGL (resolved in ADR-02).

Decision:

1. Context acquisition order in M-18: `canvas#view.getContext('webgl2', attrs)`, then
   `getContext('webgl', attrs)`, then `getContext('experimental-webgl', attrs)`; if all
   return null or throw, the Abstract tier is selected and `canvas#flat` (2D context) is
   shown instead of `#view`. `attrs = {alpha:false, antialias:<tier>, depth:true,
   stencil:false, premultipliedAlpha:false, preserveDrawingBuffer:false,
   powerPreference:'high-performance', failIfMajorPerformanceCaveat:false}`.
2. Four quality tiers: `High`, `Balanced`, `Low`, `Abstract`. Parameters (the full table is
   9.3; these values are normative):

| Parameter | High | Balanced | Low | Abstract |
|---|---|---|---|---|
| Resolution scale (of CSS px x devicePixelRatio) | 1.0 (DPR capped at 2) | 0.75 (DPR capped at 2) | 0.5 (DPR capped at 1.5) | n/a (2D canvas at DPR capped 2) |
| MSAA (`antialias` attr) | on | on | off | n/a |
| Lights | 1 directional + ambient + 4 point | 1 directional + ambient + 2 point | 1 directional + ambient | n/a |
| Blob shadows | on | on | off | n/a |
| Capsule segments (radial x height) | 16 x 8 | 10 x 6 | 6 x 4 | n/a |
| Particles cap (perfect sparks, beat pulses) | 256 | 96 | 0 | 0 |
| Performers animated per frame | 5 | 5 | 3 (others idle pose) | 0 (visualizer only) |
| Highway | 3D lanes in `#view` | 3D lanes | 3D lanes, no glow | 2D lanes in `#flat` |
| Animation update rate | every frame | every frame | every 2nd frame | n/a |

3. Initial tier selection at boot (M-29 reads `Caps`): WebGL2 present and not a touch device
   (`navigator.maxTouchPoints === 0`) and `min(innerWidth, innerHeight) >= 600` -> High;
   WebGL2 present otherwise -> Balanced; WebGL1 only -> Low; no WebGL -> Abstract. A stored
   setting `video.tier` other than `auto` overrides the pick and disables auto-downgrade.
   URL parameter `?tier=<name>` (M-29) overrides both for that session.
4. Auto-downgrade: M-18 keeps a 300-frame ring of frame times; when the p95 over the last
   5 s exceeds 33 ms the tier drops by one step (`High -> Balanced -> Low -> Abstract`),
   at most once per 10 s, with a toast "Graphics quality lowered to <tier> to keep the music
   smooth". There is no automatic upgrade; the user can raise the tier in SCR-Settings. The
   check is suspended during the first 3 s after a mode enter and while a dialog is open.
5. Shading: flat or Lambert per material, one directional light, ambient term, up to 4
   point lights (High), simple linear fog, per-instance color. No shadow maps; shadows are
   blob quads with a radial gradient texture generated at init on a 64 x 64 canvas. No
   post-processing passes.
6. Geometry: procedural primitives only (box, capsule, cylinder, sphere, plane, ring).
   Humanoids are capsules (limbs), a box torso and a sphere head built by M-19 from
   `CharacterConfig`. Instrument props are compositions of the same primitives (M-21).
7. Instancing: WebGL2 `drawArraysInstanced`; WebGL1 via `ANGLE_instanced_arrays` when
   present; otherwise one draw per instance (Low tier has at most 600 draws per frame).
8. Context loss: `webglcontextlost` calls `preventDefault()`, stops drawing, emits
   `render.contextLost`; `webglcontextrestored` rebuilds all GL objects from CPU-side
   descriptions (meshes keep their typed arrays; textures are regenerated) and emits
   `render.contextRestored`. If restore has not happened 3 s after loss the renderer switches
   to Abstract and shows a toast "3D graphics were lost; showing the simplified view". The
   transport, audio and scoring are never touched by any of this (E 6.2, E 11).
9. The renderer reads the musical position only through
   `FLM.Transport.positionAt(audioCtx.currentTime)` and the `sched.noteOn`/`sched.noteOff`
   events; it never advances or writes musical time (ADR-05).
10. Text is never rendered in WebGL (no font atlas): all text, judgment flashes and the HUD
    are DOM (ADR-13). Lane identification in 3D uses glyph meshes (circle, triangle, square,
    diamond) in addition to color (B 22).
11. Every GL object is created through counted wrappers so `FLM.Render.stats()` reports
    live buffers, textures, programs and vertex arrays; `dispose()` must return all counters
    to zero (Part 4.7 `assertClean()`).

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| three.js embedded | 5 | 4 | 2 | 5 | 3 | 4 | 5 | 5 | 4 | 37 |
| Babylon.js embedded | 4 | 3 | 1 | 5 | 3 | 4 | 5 | 5 | 3 | 33 |
| 2D canvas only (no 3D at all) | 5 | 5 | 5 | 5 | 5 | 5 | 2 | 5 | 5 | 42 |
| CSS 3D transforms for characters | 3 | 2 | 5 | 5 | 2 | 5 | 2 | 5 | 5 | 34 |
| Own WebGL2/WebGL1 renderer plus 2D fallback (chosen) | 5 | 4 | 4 | 5 | 3 | 5 | 4 | 5 | 5 | 40 |

Notes: 2D-only scores high on the criteria but fails B 12.1 (real-time 3D stage), so it is
kept as the Abstract tier rather than the product. The own renderer's maintenance cost is
bounded by the small feature set (no materials beyond color and emissive, no skinning
shaders: limbs are rigid primitives posed by the CPU).

Consequences: easier - full control over draw cost per tier; no dependency on a library's
WebGL1 fallback; deterministic resource counting. Harder - shader, matrix and scene-graph
code are own code with UT coverage; headless SwiftShader differs from real GPUs (XT tests
on devices are mandatory before any FPS claim). Limits the UI must disclose: the active tier
and the reason for an automatic downgrade (toast plus SCR-Diagnostics); "Simplified view"
label when Abstract is active.

Verification: UT (shader compile under SwiftShader, mat4/quat math, scene graph matrices,
GL counters back to zero after dispose, tier selection table); PT (frame time p95 per tier
in `tools/perf.mjs`; auto-downgrade fires under `render.slowFrames` injection); FI
(`render.contextLoss` injection: audio and transport unaffected, restore or Abstract within
3 s); XT (each browser: which context initializes, tier chosen, highway readable); LT (visual
checks of P 7.1-7.3 items).

### 2.4 ADR-04 Audio: Web Audio API synthesis, no bundled sample bank

Context: B 11.1-11.6, 8.5, E 2.1-2.3, I 3.1-3.5, P 6.1-6.3. The spec asks for broad GM
coverage, distinguishes five fidelity levels (B 11.3) and permits a documented alternative
when a sound bank is too large for the single-file budget. A full GM sample bank is 30-140 MB
(GeneralUser GS, FluidR3); even a heavily reduced bank exceeds the 1.5 MB target.

Decision:

1. One `AudioContext` per page lifetime, created in M-05 on the first user gesture with
   `{latencyHint:'interactive'}` and the device default sample rate (never forced). It is
   never closed; `panic(true)` rebuilds the node graph below the master, not the context.
   Repeated unlock attempts are idempotent (E 2.1).
2. Instruments are data: 16 family patch templates (BRIEF section 6) parameterized per
   program; all 128 GM programs declare fidelity `synth-basic` or `synth-velocity`; none is
   `sampled`. Channel 10 uses 12 synthesized drum voices covering keys 35-81. Full tables
   are in Part 6 M-06.
3. Node types used (and nothing else): `OscillatorNode` (with `PeriodicWave` for organ
   additive partials), `GainNode`, `BiquadFilterNode`, `AudioBufferSourceNode` (noise bursts
   and precomputed pluck buffers), `WaveShaperNode` (soft clip in the Guitar family),
   `StereoPannerNode` (fallback: `PannerNode` with `panningModel:'equalpower'` when
   `StereoPannerNode` is absent), `DynamicsCompressorNode` (master limiter),
   `ConvolverNode` (one global synthesized-IR reverb, P1 in Phase 14), `AnalyserNode` (peak
   meter), `DelayNode` (chorus in the Ensemble family). No `AudioWorklet`, no
   `ScriptProcessorNode` in v1: worklet modules need a `blob:` URL plus `worker-src`, which
   is unreliable from `file://` across the five browsers.
4. Pluck (Karplus-Strong) family: because a `DelayNode` feedback loop cannot go below one
   render quantum (128 frames), strings are synthesized in JS into an `AudioBuffer` (up to
   3 s) per (pitch, velocity layer) on first use and cached (cap 256 buffers, LRU), played
   through `AudioBufferSourceNode` with `playbackRate` for pitch bend.
5. Scheduler: `setInterval` every 25 ms, lookahead 120 ms, all starts and stops given as
   absolute `AudioContext.currentTime` values; events are never started "now" except after
   a stall, when overdue events are scheduled at `now + 0.005` and the stall is logged.
6. Polyphony: `VoiceAllocator` pool of 64 voices on desktop, 32 on touch devices (from
   `Caps`), stealing released-quietest first, then oldest. The cap is a setting
   (`audio.polyphony`, Part 5.11) within 16-64.
7. Click-free rules: every gain change uses `setTargetAtTime` or linear ramps of at least
   5 ms; note release uses the patch release time (minimum 20 ms); soft panic ramps all
   voices to zero in 30 ms; start and stop of the transport fade the master over 20 ms.
8. Master chain: per-track `ChannelStrip` (gain, pan, mute, solo) -> master gain ->
   `DynamicsCompressorNode` (threshold -6 dB, knee 6, ratio 12, attack 0.003 s, release
   0.25 s) -> `AnalyserNode` -> destination. Metronome has its own bus into the master gain.
9. Recording of rendered audio: WAV export renders the project with `OfflineAudioContext`
   at 48 kHz stereo 16-bit (Part 5.14); the MediaRecorder capture path is the OQ-2
   alternative, implemented behind the same export API and chosen at runtime on iOS when
   the estimated render size exceeds 60 MB.
10. Sampled playback is Deferred P2 as an optional user-loaded `.sf2` reader; nothing in v1
    reads or ships samples. UI wording everywhere is "synthesized"; the words "realistic",
    "sampled" or "studio quality" never appear in the UI.
11. Fidelity API: `FLM.Instruments.fidelity(program)` returns
    `{level:'synth-basic'|'synth-velocity', velocityLayers:n, articulations:[...],
    controllers:[1,7,10,11,64,121,123]}`; SCR-ImportInspect and SCR-FreePlay show the level
    next to each instrument name (I 3.4).
12. Latency estimate: `baseLatency + outputLatency` when both exist, else `baseLatency`,
    else 0.02 s on desktop and 0.06 s on iOS as declared defaults; the calibration wizard
    (DLG-Calibration) is the authoritative source and the estimate only pre-fills it.

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Embedded GM sample bank (GeneralUser GS or FluidR3 subset) | 5 | 3 | 1 | 3 | 4 | 5 | 5 | 5 | 1 | 32 |
| Remote sound bank fetched on demand | 4 | 3 | 5 | 3 | 3 | 3 | 5 | 1 | 2 | 29 |
| WebAudioFont-style compressed per-instrument samples | 4 | 3 | 2 | 3 | 3 | 4 | 4 | 5 | 2 | 30 |
| AudioWorklet custom DSP synthesizer | 3 | 3 | 5 | 5 | 2 | 4 | 4 | 4 | 3 | 33 |
| Native-node data-driven synthesis (chosen) | 5 | 4 | 5 | 5 | 4 | 5 | 3 | 5 | 5 | 41 |
| Native-node synthesis plus optional user `.sf2` (v2 path) | 5 | 3 | 5 | 5 | 3 | 4 | 5 | 5 | 5 | 40 |

Notes: the `.sf2` row is the agreed Deferred P2 extension and is specified only as a reader
interface (Part 6 M-06) so it does not disturb v1.

Consequences: easier - zero decoding at startup, so time to first interaction is bounded by
script parse; deterministic voice accounting; `OfflineAudioContext` makes scheduler tests
exact. Harder - timbral similarity (B 11.3 level 4) is limited and must be disclosed; 128
program overrides are authoring work (Part 6 M-06 table); no sampled articulations (level 5
is Partial by declaration). Limits the UI must disclose: "synthesized" label per instrument,
the polyphony cap in SCR-Settings and SCR-About, note stealing in SCR-Diagnostics counters.

Verification: UT (OfflineAudioContext scheduling within 1 ms, allocator stealing order,
panic leaves zero active voices, ramps have no discontinuities, every program resolves to a
template); TT (10 min loop drift < 2 ms; pause/resume; seek; speed change); PT (64 voices
with full band at High tier without scheduler stalls); FI (`audio.suspend`, `audio.fail`
injections recover without touching project data); XT (unlock gesture on iOS Safari and
Android Chrome; `StereoPannerNode` fallback on the oldest supported Safari); LT (timbre
review of all 16 families, P 6.1).

### 2.5 ADR-05 Timeline: integer ticks at PPQ 960, audio clock as master

Context: B 9.1, 9.2, 10.5, 15.7, E 2.2, I 1.1, 1.3, 16.3, P 6.3. Musical time must be
separate from frame time; tempo and meter maps must be exact; pause, seek, loop and speed
need explicit rules; background throttling must not shift the timeline.

Decision:

1. All musical positions are non-negative integers in ticks at PPQ 960 (`Song.ppq` is
   always 960). 960 divides exactly by 2, 3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 30, 32, 40,
   48, 60, 64, 80, 96, 120, 160, 192, 240, 320 and 480, so 1/64 triplets (20 ticks),
   quintuplet sixteenths (48 ticks) and 1/128 notes (30 ticks) are exact, and the common
   source PPQs 96, 120, 192, 240, 384, 480 and 960 rescale without rounding.
2. Rescaling from a source PPQ `p`: `tick960 = Math.floor((tick * 960 + Math.floor(p / 2)) / p)`
   in Number arithmetic (exact below 2^53; parsers reject ticks above 2^40). SMPTE
   division converts to seconds first, then to ticks at the default tempo.
3. `TempoMap.entries` are sorted by tick, piecewise-constant, each with `usPerQuarter`
   (integer, 1..16,777,215) and a precomputed `secondsAt`. Two entries at the same tick:
   the last one in source order wins and the earlier is dropped with a warning. An empty map
   is treated as one entry `{tick:0, usPerQuarter:500000}` (120 BPM). `ticksToSeconds` and
   `secondsToTicks` are binary searches over `entries` (Part 5.3); conversions are doubles
   with error below 1 us over 24 h.
4. The audio clock (`AudioContext.currentTime`) is the only master clock for playback.
   `FLM.Transport` anchors a (tick, audioTime) pair on every start, resume, seek, speed
   change and loop wrap; `positionAt(audioTime)` returns
   `secondsToTicks(secondsAt(anchorTick) + (audioTime - anchorAudio) * speed)` for
   `playing` and `recording`, a constant for `paused`, `stopped` and `countin`
   (count-in positions are negative ticks reported separately as `countinTick`).
5. The render loop and every visual system read `Transport.positionAt(audioCtx.currentTime)`
   each frame and never accumulate frame deltas into musical time. Animation interpolation
   between frames uses the audio-time difference, never `requestAnimationFrame` counts.
6. Speed is a Transport property (0.25..2.0, step 0.05) applied outside the TempoMap, so the
   map stays identical to the source; speed changes re-anchor at the current position.
   `Project.settings.tempoOverride` (BPM or null) is honored only for songs whose
   `source.format` is `flm` (created in Free Play or Studio) and replaces the whole map with
   one entry; imported songs expose speed only (their maps are source facts, E 3.2).
7. Pause records the tick, soft-panics voices, and keeps the set of held chart notes for the
   HUD; resume re-anchors at `audioNow + 0.05` so the first scheduled event is never in the
   past. Seek soft-panics, re-anchors, resets the scheduler cursor and emits
   `transport.seek`.
8. Loop region `[a, b)`: a note starting before `b` and ending after it is released at `b`;
   a note starting before `a` is not retriggered at the wrap; the wrap re-anchors exactly
   (`anchorAudio = audioTimeAt(b)`, `anchorTick = a`) so there is no cumulative error; a
   note exactly at tick `b` belongs to the next pass and is scheduled after the wrap.
9. Scheduling is "pull": `Transport.pullDue(untilAudioTime)` yields events whose audio time
   is below the horizon (including across loop wraps); M-05 calls it every 25 ms with
   `audioNow + 0.12`.
10. Background throttling: timers may slow to 1 Hz in background tabs. Gameplay modes
    (quickplay, instrument, dance, multiplayer, tutorial) auto-pause on `visibilitychange`
    to hidden; Studio and Free Play keep playing and, on return, compare the scheduler cursor
    with `positionAt(audioNow)`; if events were skipped the gap is logged and scheduling
    resumes from the current position without replaying missed notes. Audio hardware keeps
    the clock, so no drift accrues.
11. Determinism: Transport accepts an injected clock object `{now()}` so UT and TT tests run
    with a fake clock; the real clock is `audioCtx.currentTime`.

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Floating-point seconds as the primary timeline | 5 | 5 | 5 | 5 | 2 | 5 | 3 | 5 | 5 | 40 |
| Integer ticks at PPQ 480 | 5 | 5 | 5 | 5 | 4 | 5 | 4 | 5 | 5 | 43 |
| Integer ticks at PPQ 960 with audio-clock anchoring (chosen) | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 44 |
| `performance.now()` as master clock | 5 | 5 | 5 | 5 | 3 | 5 | 2 | 5 | 5 | 40 |
| Frame-count or `requestAnimationFrame` time as master | 5 | 5 | 5 | 5 | 3 | 5 | 1 | 5 | 5 | 39 |

Notes: seconds-only timelines lose exact grid positions after quantize and tempo edits;
`performance.now()` drifts from the audio hardware clock by tens of ms per hour on some
devices; frame timing is prohibited by B 9.2 and E 10 item 2.

Consequences: easier - exact quantize and editing; tempo edits never move recorded ticks;
loops are drift-free by construction; tests run on a fake clock. Harder - every component
that displays time needs a conversion; imported SMPTE files pass through a tempo
assumption that must be disclosed as a warning. Limits the UI must disclose: the speed
range 0.25-2.0; the tempo override being unavailable for imported songs (disabled slider
with the reason "Imported songs keep their tempo map; use speed instead").

Verification: UT (tick conversions, rescaling table, TempoMap search, state machine table,
loop and seek rules, pull cursor across wraps, fake-clock determinism); TT (scheduled start
within 1 ms, 10 min loop abs drift < 2 ms, pause/resume shift < 1 ms, tempo-change songs,
background tab return); IT (render loop never writes transport state: a frozen-RAF harness
leaves `positionAt` unchanged).

### 2.6 ADR-06 Parsers: own implementations with explicit format boundaries

Context: B 15.1-15.5, 23.1, E 3.1-3.4, I 6.1-6.4, 16.2, P 11. Formats must pass through one
internal representation, be validated as untrusted input, report unsupported features and be
described by a precise compatibility matrix (docs/COMPATIBILITY.md, Part 8).

Decision:

1. Supported inputs and their adapters: SMF `.mid .midi .smf .kar` -> M-10; MusicXML
   `.xml .musicxml` (uncompressed) and `.mxl` (ZIP via M-11) -> M-12; Guitar Pro
   `.gp3 .gp4 .gp5` -> M-13; audio `.wav .mp3 .ogg .flac .m4a .aac` -> audio adapter in
   M-14 (becomes an audio track only). Identification is by magic bytes first, extension
   second (table in Part 8.2); a mismatch between the two is a warning, and the bytes win.
2. SMF: formats 0, 1 and 2; PPQ and SMPTE divisions; running status; VLQ up to 4 bytes;
   unknown chunks skipped; truncated tracks keep parsed events with `W-MIDI-TRUNCATED`;
   format 2 produces one Song per track offered on SCR-ImportInspect.
3. MusicXML: `DOMParser` with MIME `text/xml` only (never `text/html`), partwise and
   timewise, repeats and endings expanded, `dacapo`/`dalsegno`/`fine`/`coda` not expanded
   (warning `W-XML-NAV-UNSUPPORTED`), engraving never attempted. A document whose DOCTYPE
   declares internal entities (`<!ENTITY`) is rejected before parsing (entity-expansion
   defense). `.mxl` is read through `META-INF/container.xml`; stored and deflate methods
   only.
4. Guitar Pro: GP3, GP4, GP5 binary formats (version strings whitelisted in Part 6 M-13).
   GP6 (`.gpx`, magic `BCFZ`) and GP7/GP8 (`.gp`, ZIP containing `Content/score.gpif`) are
   identified by the format identifier and reported as Unsupported with the text
   "Guitar Pro 6 and newer files (.gpx, .gp) are not supported. Export as GP5 or MusicXML
   from Guitar Pro and import that file." They never enter a parser.
5. Audio files decode with `decodeAudioData` into an audio track with `syncOffsetMs`; no
   transcription exists and the inspection screen states "Audio files play as backing
   audio only; they do not provide notes".
6. Limits enforced by every adapter before and during parsing (BRIEF section 6): file
   <= 25 MB (audio <= 100 MB), events <= 1,000,000, tracks <= 128, chord size <= 16, text
   fields truncated (names 128 chars, text events 1,000 chars, control characters removed),
   ZIP entries <= 256, uncompressed <= 50 MB, ratio <= 100, parse wall-clock budget 5 s
   checked at each yield, after which the import aborts with an error.
7. Parsing runs on the main thread, time-sliced: every 20,000 events (or every ZIP entry,
   or every MusicXML part) the adapter awaits `setTimeout(0)` and reports progress
   (bytes or events consumed, which is measurable, B 20.4). No Web Workers in v1 (CSP and
   `file://` limits, ADR-12).
8. Import never touches the current project until the user confirms DLG-ImportReplace; a
   failed import leaves the project untouched (E 11).
9. Every unsupported element produces an `ImportWarning` with a stable code (catalogs in
   Part 8.8) and appears on SCR-ImportInspect; nothing is dropped silently (B 15.4, E 3.3).
10. Compatibility vocabulary per feature is exactly Supported, Partial, Conversion,
    Unsupported; the matrix is data in M-14 (`COMPATIBILITY`) rendered on SCR-About and
    published as `docs/COMPATIBILITY.md` in Phase 12.

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Embedded `midi-file` or `@tonejs/midi` (MIT) | 5 | 5 | 4 | 5 | 3 | 3 | 4 | 5 | 4 | 38 |
| Embedded alphaTab for GP3-7 and MusicXML (MPL-2.0) | 4 | 3 | 1 | 3 | 3 | 3 | 5 | 5 | 3 | 30 |
| Server-side conversion service | 5 | 5 | 5 | 4 | 3 | 2 | 5 | 1 | 1 | 31 |
| Own parsers with declared boundaries (chosen) | 5 | 5 | 4 | 5 | 3 | 5 | 4 | 5 | 5 | 41 |

Notes: embedded libraries are unobtainable in the development environment (ADR-02) and
would still need the limits, warnings and model mapping written around them. GP6/GP7 are
excluded rather than approximated because their formats (GPX binary tree and GPIF XML)
would each be a parser the size of M-13 again.

Consequences: easier - one warning model and one limit set across formats; honest matrix.
Harder - the GP5 reader is the most intricate module (RISK register); the synthetic corpus
generator (M-31 tooling, Part 8.9) must stand in for real-world files until LT tests with
real files are run. Limits the UI must disclose: the accepted extension list in the file
picker, the GP6/GP7 message, the "audio is not notes" sentence, and the matrix on
SCR-About.

Verification: UT (per-parser primitives and structures); FT (the whole `test-corpus/`:
valid, malformed, truncated, large, unsupported-feature files; expected events, tracks and
warnings per file); FI (`import.truncate` injection mid-read); PT (25 MB SMF within the 5 s
budget with yields); LT (at least three real-world files per format imported and listened
to, recorded with browser and result).

### 2.7 ADR-07 Multiplayer: WebRTC DataChannel peer-to-peer with manual signaling

Context: B 5.4, 7.7, 17.1-17.5, 23.2, 23.4, E 8.1-8.3, I 10.1-10.5, 14.3, P 13. A single
HTML file cannot host a public server; the standalone edition must stay fully usable without
any service; competitive results need an authority; messages must be validated and rate
limited; the protocol must be defined before gameplay content (E 10 item 8).

Decision:

1. Topology is a star: the host owns the room and holds one `RTCPeerConnection` per guest
   (2-4 players total); guests never connect to each other. The host is authoritative for
   room state, start time, pause/resume and scores (B 17.4).
2. Signaling is manual by default: the host creates an invite code per guest slot, the guest
   pastes it, produces an answer code, and the host pastes that back. Codes are
   base64url-encoded JSON `{v:1, role:'offer'|'answer', sdp:<string>}` of a non-trickle
   session description: ICE gathering runs until `iceGatheringState === 'complete'` or 3 s,
   whichever is first. Codes are shown in a read-only textarea with a Copy button
   (`navigator.clipboard.writeText` when available, else select-and-`execCommand('copy')`,
   else the user selects manually) and a Share button when `navigator.share` exists.
3. `iceServers` is `[]` by default (LAN or directly reachable peers only). A Settings toggle
   "Use public STUN server (stun:stun.l.google.com:19302)" adds that single server; the
   toggle text names it as an external service operated by Google and states that only
   connection metadata is sent to it. The decision whether STUN is reachable in the owner's
   network is OQ-3.
4. One `RTCDataChannel` named `flm`, `{ordered:true}` (reliable), carrying UTF-8 JSON text
   messages of the `NetMessage` envelope (BRIEF section 5, schemas in Part 5.16). Message
   size cap 64 KB, 60 messages per second per peer; violations disconnect the offending peer
   with `error` type `rateLimit` (E 8.3).
5. Shared clock = the host's audio clock. Each guest estimates its offset with 8 ping/pong
   samples at join (median of `((t1 - t0) + (t2 - t3)) / 2`) and 1 sample every 10 s
   thereafter (sliding median of the last 8). Target sync error <= 20 ms, shown in the lobby
   as "Sync: good (<= 20 ms) / fair (<= 50 ms) / poor".
6. Scheduled start: the host sends `start {tStart}` with `tStart = hostNow + 2.0 s` in
   shared time; every peer converts to its own audio clock and anchors its Transport there.
   Nothing is ever triggered on message arrival (B 17.2).
7. Inputs are judged locally for immediate feedback and also sent (type `input`, shared
   time stamps) to the host, which judges them against the same `Chart` (equal
   `settingsHash` is required at `selectChart`; a mismatch is an error and the chart is
   re-sent by the host) and broadcasts authoritative `scoreUpdate` at 10 Hz. Results screens
   show host scores; a local score that differs is replaced when the final `scoreUpdate`
   arrives.
8. Pause and resume carry `seq`; a pause with a `seq` lower than the last resume is ignored.
   Duplicates are dropped by `(from, seq)`. Control messages must arrive in order on the
   reliable channel; an out-of-order control message triggers a `roomState` resync request.
9. Reconnection: a dropped guest gets 60 s to complete a new invite/answer exchange; on
   success the host sends `roomState` and the current shared position. A dropped host ends
   the session for everyone with a results screen (no host migration; Deferred, Part 1.5).
10. Optional Online edition: `server/relay.mjs` (Part 3.7) relays the identical JSON
    messages as WebSocket text frames; a 6-character room code from the alphabet
    `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` replaces the invite/answer exchange. The relay URL is
    a user setting (`net.relayUrl`) or the `--online` build default; the relay stores
    nothing and holds no credentials (B 23.4). The relay is documented, not required.
11. v1 experiences: Synchronized Play (same chart, competitive scoring) and Cooperative Band
    (one arrangement, different tracks, one combined accuracy). Collaborative Studio rules
    are specified in Part 6 M-24 and are Deferred P2.
12. Privacy statement shown on SCR-Multiplayer before any connection: display name, avatar
    configuration (<= 4 KB), inputs, scores and room state are transmitted to the other
    players (and through the relay in the Online edition); nothing is stored by any server;
    the standalone edition sends nothing anywhere (B 23.2, exact text in Part 10.2).

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Authoritative WebSocket game server for all play | 5 | 5 | 5 | 5 | 3 | 4 | 5 | 1 | 1 | 34 |
| WebRTC through a public signaling service (PeerJS cloud) | 4 | 5 | 4 | 4 | 3 | 2 | 5 | 1 | 2 | 30 |
| WebRTC with manual copy-paste signaling (chosen) | 4 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 5 | 40 |
| Manual-signaling WebRTC plus optional own relay (chosen as Online edition) | 4 | 5 | 5 | 5 | 3 | 4 | 5 | 4 | 4 | 39 |
| Local two players on one keyboard only | 5 | 5 | 5 | 5 | 5 | 5 | 1 | 5 | 5 | 41 |

Notes: the same-keyboard option scores high but is not multiplayer in the B 7.7 sense; it is
Deferred P2 (Part 1.5). Manual signaling has the usability cost of long codes (1-4 KB) and
is the smallest exception to the single-file rule that still yields real online play.

Consequences: easier - no server is needed for LAN play; no credentials exist; the protocol
is testable offline with two in-page endpoints. Harder - NAT traversal without STUN fails for
most internet pairs (disclosed); codes are long; host departure ends the session. Limits the
UI must disclose: "Without the STUN option, players usually need to be on the same network";
"If the host leaves, the session ends"; the relay being optional and external; the privacy
statement.

Verification: UT (envelope validation, code encode/decode, clock-offset math with synthetic
samples, dedupe, ordering, pause/resume seq, rate limit); IT (two in-page `RTCPeerConnection`
endpoints in one Chromium page complete a 60 s synchronized session with sync error <= 20 ms
measured against a shared `OfflineAudioContext` substitute clock); FI (`net.drop`,
`net.delay`, `net.duplicate`, `net.reorder`); XT (real two-device LAN session per browser
pair; STUN on and off); LT (relay deployment walkthrough from Part 3.7).

### 2.8 ADR-08 Storage: localStorage plus IndexedDB with safe writes

Context: B 18.1-18.4, 7.4, E 5.3, 9, 10 item 7, I 5.3, 13, P 16. Browser storage is neither
permanent nor unlimited; `file://` and private modes behave differently; a failed save must
never report success nor destroy the previous version.

Decision:

1. Two stores with fixed roles: `localStorage` for settings, progression, onboarding flags,
   the project index, and projects whose serialized size is <= 2 MB and that contain no
   recordings; IndexedDB `flm-db` version 1 (object stores `projects`, `recordings`,
   `charts`, `characters`; schema in Part 5.15) for every project (small ones are written
   to both) and all recordings. Every key is prefixed `flm.v1.`; the catalog is Part 5.15.
2. Safe write (both stores): serialize -> write to a temporary key or record (`<key>.tmp`)
   -> read it back and compare byte length and a 32-bit FNV-1a checksum -> rename: move
   the previous value to `<key>.bak` (one generation kept), move `.tmp` to `<key>` ->
   emit `project.saved`. Any failure before the final move leaves the previous value and
   emits `project.saveFailed`; success is reported only after the final read-back (P 16).
3. IndexedDB wrapper: `open` with a 3 s timeout (Safari may hang on `file://`); every
   transaction wrapped in a promise with a 10 s timeout; `onversionchange` closes the
   connection and shows the concurrent-tab notice; `onblocked` reports E-STO-002.
4. Fallback: when IndexedDB is unavailable or fails to open, the app runs in
   "localStorage only" mode: projects above 2 MB or containing recordings cannot be saved
   locally and DLG-ProjectTooLarge offers Export immediately; a persistent notice on
   SCR-Studio and SCR-Library reads "Browser storage is limited in this context; export your
   projects to keep them".
5. Quota: `navigator.storage.estimate()` when present (shown on SCR-Diagnostics);
   `QuotaExceededError` or a failed write surfaces DLG-SaveFailed (E-STO-001) with the
   buttons "Export project" (primary), "Retry", "Discard changes". Autosave failures show a
   toast once and set the dirty indicator; they never loop.
6. Export is the real backup: Blob + anchor `download` (fallback: open a `data:` URL in a new
   tab when `download` is unsupported, which is the iOS Safari < 13 path); import by
   `<input type="file">` and drag-and-drop. The UI never calls local storage a backup
   (I 5.3).
7. Concurrent tabs: a lock record `flm.v1.lock` `{tabId, ts}` refreshed every 5 s by the tab
   that owns a project in Studio; another tab seeing a fresh lock (< 15 s) opens the project
   read-only with the notice "This project is open in another tab; opened read-only".
   `storage` events propagate index changes to SCR-Library.
8. Autosave checkpoints (ring of 3 per project, stripped of recording buffers) go to
   IndexedDB only, at safe points (BRIEF section 6), never during recording or playback.
9. Versioned data: every record carries `version`; loading validates before use and migrates
   a copy (Part 5.7); a newer version than the app knows is refused with the exact message
   of Part 5.7 and the record is left untouched.
10. `file://` specifics verified at runtime by `Caps` and disclosed on SCR-Diagnostics: in
    Chromium all `file://` pages share one storage origin (another local HTML game in the
    same browser profile shares the quota but not the keys, because of the prefix); Firefox
    scopes `file://` storage per directory; Safari may deny IndexedDB on `file://` (then
    decision 4 applies).

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| localStorage only | 5 | 5 | 5 | 5 | 5 | 4 | 2 | 5 | 5 | 41 |
| IndexedDB only | 3 | 5 | 5 | 5 | 4 | 4 | 4 | 5 | 5 | 40 |
| File System Access API (`showSaveFilePicker`) | 2 | 3 | 5 | 5 | 3 | 4 | 4 | 5 | 4 | 35 |
| Cache API or Service Worker storage | 1 | 4 | 5 | 5 | 3 | 4 | 3 | 2 | 2 | 29 |
| localStorage plus IndexedDB with routing and safe writes (chosen) | 5 | 5 | 5 | 5 | 3 | 4 | 5 | 5 | 5 | 42 |

Notes: localStorage alone caps at about 5 MB per origin and blocks the main thread on large
strings; IndexedDB alone is missing in some private modes and on Safari `file://`; the File
System Access API is Chromium-only and unavailable on `file://` without a gesture per save.

Consequences: easier - small projects survive even when IndexedDB is absent; the `.bak`
generation gives a recovery path (SCR-Library "Restore previous version"). Harder - two code
paths to test; size estimation must run before each save (Part 5.8). Limits the UI must
disclose: the 2 MB localStorage-only cap, the "not a backup" sentence, the concurrent-tab
read-only state, quota figures when available.

Verification: UT (safe-write state machine with an in-memory fake, routing rule, checksum
verification, lock logic, migration refusal); IT (real IndexedDB round trips in headless
Chromium; `storage` event between two pages); FI (`storage.quota`, `storage.writeFail`:
previous record intact, no false success); XT (`file://` behavior per browser recorded in
the device matrix); LT (export, clear site data, re-import).

### 2.9 ADR-09 Encoding, line endings, and language level

Context: B 19.4 (maintainability over minification), 5.3 (no build pipeline required to run),
E 9 (an external resource incompatible with the current browser), repository conventions
(BRIEF section 8). The five target browsers at the floor versions must parse the single
script without a transpiler.

Decision:

1. Every new text file (source, docs, tools, corpus text files) is UTF-8 with BOM and LF line
   endings. The build strips per-file BOMs and emits one (ADR-01 decision 4). Binary corpus
   files are bytes as generated.
2. JavaScript and HTML style: 2-space indentation; every module file begins with a BOM, a
   banner comment naming the module and ADR scope, then `(function () { 'use strict'; ... })();`;
   semicolons are mandatory; single quotes for strings; `const` by default, `let` when
   reassigned, never `var`; no trailing whitespace; lines <= 110 characters.
3. Language ceiling is ES2020. Allowed: optional chaining, nullish coalescing, `BigInt`,
   `globalThis`, `Promise.allSettled`, `String.prototype.matchAll`, dynamic `import()` is
   NOT used, named capture groups, async iteration, rest/spread, classes without fields.
   Forbidden (newer than ES2020 or weak on the Safari floor): class fields and `static`
   blocks, `#private` members, logical assignment (`??=`, `||=`, `&&=`), numeric separators,
   `String.prototype.replaceAll`, `Array.prototype.at`, `Object.hasOwn`, `Promise.any`,
   `structuredClone`, top-level `await`, regular-expression lookbehind, the `d` and `v`
   regex flags, decorators, `import`/`export` in the browser bundle.
4. Browser APIs are used only when `Caps` reports them or behind an inline existence check;
   there are no polyfills and no transpiled output. Own helpers replace `structuredClone`
   (`FLM.Core.deepClone`) and `replaceAll` (split/join).
5. `tools/*.mjs` and `server/relay.mjs` run on Node 22+ and may use any syntax Node 22
   supports; they are not shipped.
6. `node --check` in the build is the syntax gate; a pre-commit review step (Part 3.9)
   greps the joined script for the forbidden constructs listed in decision 3 and fails the
   T section if any is found.
7. Comments explain intent and cite plan sections (`// ADR-05 decision 8`); no commented-out
   code is committed.

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| TypeScript transpiled to ES2017 | 5 | 5 | 4 | 5 | 5 | 4 | 5 | 3 | 4 | 40 |
| Babel-transpiled modern JS | 5 | 5 | 3 | 5 | 4 | 4 | 5 | 3 | 4 | 38 |
| Native ES modules in the browser | 3 | 5 | 5 | 5 | 5 | 4 | 5 | 2 | 1 | 35 |
| Latest syntax without a ceiling | 2 | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 5 | 40 |
| Plain ES2020, IIFE modules, no transpiler (chosen) | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 44 |

Notes: TypeScript and Babel need npm installs (not available, ADR-02). Module scripts fail
from `file://`. An uncapped syntax level breaks Safari 14-15 users silently (a single
`SyntaxError` disables the whole game because it is one script).

Consequences: easier - the shipped file runs where the floor browsers run; stack traces map
to source; no toolchain. Harder - no static types (JSDoc types in every public API, Part 6);
authors must avoid habits like class fields. Limits the UI must disclose: none.

Verification: UT (the build's forbidden-construct grep against a fixture that contains each
construct); FT (shipped file: BOM, LF, `node --check` passes); XT (the floor Safari and iOS
Safari versions load the script without a `SyntaxError`, observed via the early error
handler's `#fatal` path staying hidden).

### 2.10 ADR-10 Input: Pointer Events, key codes, polled gamepad, optional Web MIDI

Context: B 8.1, 8.2, 8.4, 8.5, 21.1, 22, E 4.1, 9, I 2.3, 12, P 5.1, 14. Every source must
normalize to press/release with timestamps; duplicate events must be suppressed; held inputs
must be released on focus loss, cancellation and pause; Web MIDI is optional and secure
context only.

Decision:

1. All sources normalize to `InputEvent {source, control, type:'press'|'release', tPerf,
   tAudio, pressure}` and flow through one `FLM.Input` emitter (`input.event`). Control
   names are fixed: `lane0..lane3`, `dance0..dance3`, `pause`, `panic`, `octUp`,
   `octDown`, `profile1..profile6`, `sustain`, plus `midi:<n>` for raw MIDI notes in Free
   Play. Each control has a lifecycle `idle -> pressed -> idle`; a press while pressed is
   ignored, a release while idle is ignored.
2. Pointer Events are the primary touch and mouse path: `pointerdown`, `pointermove`,
   `pointerup`, `pointercancel` on `#touch` (pads) and `#view`. Hit testing on every
   `pointermove` against pad rectangles (not `setPointerCapture`, so a finger dragged from
   one pad to another releases the old pad and presses the new one). `pointercancel` and a
   move outside every pad release the pad. One pad may be held by several `pointerId`s; it
   releases when the last one leaves.
3. Gesture suppression on the gameplay surface only: CSS `touch-action: none` on `#touch`
   and `#view`; `touchstart` and `touchmove` listeners with `{passive:false}` that call
   `preventDefault()` on those elements (this blocks scroll, pinch and double-tap zoom
   without disabling Pointer Events); `contextmenu` is prevented on pads; `user-select:
   none` and `-webkit-touch-callout: none` on `#touch`. Menus keep default touch behavior.
4. Keyboard uses `KeyboardEvent.code` (layout independent). `event.repeat === true` is
   ignored. If `code` is the empty string (some Android soft keyboards), the event is
   mapped from `key` only for single letters and digits, else ignored. Default maps are
   BRIEF section 7; remapping with conflict detection is in Part 6 M-07; browser shortcuts
   are not intercepted except `Space` and arrow keys on the gameplay surface
   (`preventDefault` to stop page scroll).
5. System releases: `blur`, `visibilitychange` to hidden, `pagehide`, and
   `gamepaddisconnected` release every pressed control with `source:'system'`; a pause also
   releases all controls and ignores presses until the pause screen is dismissed (P 5.2
   "pausing does not register notes").
6. Gamepad: `navigator.getGamepads()` polled once per render frame (and from the scheduler
   tick when the page is hidden, so pause works); standard mapping buttons 0-3 -> lanes
   (0 = `lane0` (A/cross), 1 = `lane1`, 2 = `lane2`, 3 = `lane3`), d-pad buttons 14/13/12/15
   -> `dance0..3` (left, down, up, right), button 9 (start) -> `pause`, button 8 (select) ->
   `panic`; edge detection per button; a connected gamepad shows a toast once.
7. Web MIDI: requested only when the user enables "MIDI input" in SCR-Settings and only if
   `navigator.requestMIDIAccess` exists and `window.isSecureContext` is true;
   `{sysex:false}`. Note-on with velocity > 0 maps to controls through a per-profile note
   table (defaults: lanes C4 E4 G4 B4, dance C3 D3 E3 F3); in Free Play every note is
   forwarded as `midi:<n>` with `pressure = velocity / 127`. The setting is disabled with
   the reason "Web MIDI needs a secure context and a supporting browser" otherwise.
8. Timestamps: `tPerf = event.timeStamp` when `Math.abs(event.timeStamp -
   performance.now()) < 5000` (a performance-origin stamp), else `performance.now()`
   (epoch-style stamps in older WebKit). Gamepad presses use `performance.now()` at the
   poll. `tAudio = Input.perfToAudio(tPerf)` using the anchor of Part 4.5. Added processing
   between the DOM event and `input.event` emission must be < 1 frame; the emitter is
   synchronous.
9. Two players on one keyboard is Deferred P2 (Part 1.5); the control model reserves the
   namespace `p2:<control>` for it and nothing else.
10. OQ-1: if the XT tests show that iOS Safari does not deliver four simultaneous Pointer
    Events, M-07 switches the pad surface to Touch Events (`touchstart/move/end/cancel`
    with `changedTouches` and the same hit-test and lifecycle) on devices where
    `Caps.pointerEvents` is true but a runtime probe counts fewer than 4 concurrent
    `pointerId`s during the first-launch "press all four pads" step.

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Touch Events plus Mouse Events (two code paths) | 5 | 5 | 5 | 5 | 3 | 5 | 5 | 5 | 5 | 43 |
| Pointer Events only (chosen), Touch Events as OQ-1 fallback | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 44 |
| `KeyboardEvent.key` instead of `code` | 5 | 5 | 5 | 5 | 4 | 5 | 3 | 5 | 5 | 42 |
| Gamepad via `gamepadbuttondown` events | 1 | 5 | 5 | 5 | 4 | 5 | 3 | 5 | 5 | 38 |
| Web MIDI required for instrument play | 2 | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 5 | 40 |

Notes: `key` is layout dependent, so the same physical keys produce different names on
AZERTY or Cyrillic layouts; gamepad button events are non-standard. Web MIDI is absent in
Safari and gated in Firefox, so it can only be optional (E 9).

Consequences: easier - one normalization point, one lifecycle, one timestamp rule; focus loss
is handled centrally. Harder - the pad hit-test must run on every move at touch rates; iOS
behavior must be probed (OQ-1). Limits the UI must disclose: MIDI availability reason;
"Simultaneous touches depend on your device" sentence in SCR-Help when fewer than 4
concurrent pointers were observed.

Verification: UT (lifecycle table, repeat suppression, synthesized pointer sequences
including drag between pads and `pointercancel`, timestamp rule with both stamp styles,
mapping of gamepad snapshots, system release on `blur`); IT (input to audio within one
frame; input to judge uses `tAudio`); FI (`input.disconnect`); XT (four simultaneous
touches on iOS Safari and Android Chrome; key codes on non-US layouts; one gamepad per
browser); LT (touch pads in portrait and landscape on real devices).

### 2.11 ADR-11 Testing: in-page self-test runner driven by headless Chromium

Context: B 1.4, 4.2 (automated tests for timing and file handling are P0), 25.1-25.7, E 12,
13, I 13.1, 17, P 20. The repository convention is an in-browser self-test entry point per
game; the implementing environment has Node and a preinstalled Playwright Chromium but no
network and no npm installs.

Decision:

1. Tests run inside the real page: `window.FLM.selfTest(groupName?)` (test build only)
   executes the registered groups and resolves to the results array, also stored in
   `window.__FLM_RESULTS` as `[{group, name, pass, ms, message}]`. `window.FLM.selfTestReady`
   becomes `true` after boot reaches the main menu in the test build.
2. Groups: one per module (`core`, `theory`, `model`, `transport`, `audio`, `instruments`,
   `input`, `mapping`, `rhythm`, `midi`, `zip`, `musicxml`, `guitarpro`, `import`,
   `project`, `storage`, `studio`, `render`, `rig`, `animation`, `stage`, `character`,
   `dance`, `net`, `progress`, `ui`, `screens`, `modes`, `boot`, `content`, `selftest`)
   plus `integration`, `timing`, `files`, `faults`, `perf-smoke`. Unit tests are
   `UT-<MM>-<nn>` (Part 6); the other categories are Part 12.
3. Test sources are `src/90-selftest.js` (runner, assertions, fakes) and
   `src/91-test-<group>.js`; the build excludes `9*-*.js` from the shipped file and includes
   them in `FingerLickinMusic.test.html`. The shipped file contains no test code and no
   `selfTest` function (the property is absent, not a stub).
4. `node tools/selftest.mjs` launches Chromium through `require('playwright')` with the
   flags `--autoplay-policy=no-user-gesture-required --use-gl=angle
   --use-angle=swiftshader --enable-unsafe-swiftshader`, opens the test build via a
   `file://` URL, waits for `selfTestReady`, calls `FLM.selfTest(group)`, prints a table and
   exits 0 (all pass), 1 (any failure), or 2 (launch or infrastructure error). Options:
   `--group <name>`, `--all`, `--json <path>`, `--slow`, `--headed`, `--cdp <wsUrl>`.
5. Launch fallbacks in order: `chromium.launch()`; `chromium.launch({executablePath:
   '/opt/pw-browsers/chromium'})`; and when `require('playwright')` itself fails or `--cdp`
   is given, a raw CDP driver: spawn `/opt/pw-browsers/chromium --headless=new
   --remote-debugging-port=9222 <flags>` (or use the given URL), connect with Node 22's
   global `WebSocket`, and use `Target.createTarget`, `Page.navigate` and
   `Runtime.evaluate({awaitPromise:true})` to run the same steps. No npm package is
   installed for any path.
6. Determinism aids built into the product for tests: an injectable clock in Transport
   (ADR-05 decision 11), `OfflineAudioContext` acceptance in M-05 (`Audio.createForTest`),
   an in-memory IndexedDB fake in M-31, seeded `Prng` everywhere randomness exists,
   `FLM.debug.inject(fault)` hooks (Part 10.9), and synthesized `InputEvent` helpers.
7. Timeouts: 10 s per test (30 s with `--slow`), 15 min per run (45 min with `--slow`);
   a timed-out test is a failure with message `timeout`.
8. `node tools/perf.mjs` runs the Part 9.7 scenarios in the same browser and writes JSON
   with the measured budgets; `node tools/make-corpus.mjs` regenerates `test-corpus/`
   deterministically (checked in, so FT tests run without regenerating).
9. Headless GL (SwiftShader) proves correctness, not speed: FPS and timing budgets are
   final only when measured on the physical devices of the Part 9.2 matrix (XT, PT on
   devices). The runner records `navigator.userAgent` and the GL renderer string in every
   JSON output.
10. The test build exposes "Run self-test" on SCR-Diagnostics so LT testers can run groups
    on real devices and copy the JSON.

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Jest or Mocha under Node with jsdom | 2 | 3 | 5 | 5 | 4 | 5 | 2 | 3 | 4 | 33 |
| Node-only tests of pure modules, browser untested | 2 | 3 | 5 | 5 | 4 | 5 | 2 | 5 | 5 | 36 |
| Puppeteer | 4 | 4 | 5 | 5 | 4 | 5 | 5 | 2 | 5 | 39 |
| Manual testing only | 3 | 3 | 5 | 5 | 1 | 3 | 2 | 5 | 5 | 32 |
| In-page runner plus Playwright Chromium with CDP fallback (chosen) | 5 | 4 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 43 |

Notes: jsdom has no WebGL, Web Audio or IndexedDB; Puppeteer is not preinstalled and needs
a download. The in-page runner tests the exact code that ships, including browser quirks.

Consequences: easier - the same tests run headlessly and on real devices; fakes make timing
tests exact. Harder - test code must stay out of the shipped bundle (build gate); audio
tests must use `OfflineAudioContext` since headless real-time audio has no hardware clock.
Limits the UI must disclose: none in the shipped build; the test build shows a "TEST BUILD"
badge on the main menu.

Verification: UT (the runner tests itself: pass, fail, throw, timeout, async, results
shape); FT (shipped file contains no `selfTest`, `__FLM_RESULTS` or `91-test`); IT (the whole
`--all` run passes headlessly at every phase gate); LT (one `--all` run on each physical
device in the matrix, JSON attached to the final report).

### 2.12 ADR-12 Security: strict CSP, text-only insertion, enforced parser limits

Context: B 17.4, 23.1-23.4, E 3, 8.3, 9, I 13, P 19. Imported files are untrusted; the
single-file client is public; no credentials may exist; imported text must never execute.

Decision:

1. The `<head>` carries exactly:
   `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src
   'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:;
   connect-src 'self'">`. The Online edition build appends the relay origin to
   `connect-src` (for example `connect-src 'self' wss://relay.example.org`). Nothing else
   changes between editions.
2. Consequences of that policy that the implementation relies on: no `eval`, `new Function`,
   `setTimeout(string)` or `javascript:` URLs anywhere; no inline event-handler attributes
   (all listeners through `addEventListener`); no `<img src="http...">`; WebRTC is not
   governed by `connect-src`; `blob:` download navigation is not governed; `frame-ancestors`
   and `sandbox` cannot be expressed in a meta tag and are not relied upon; no Workers (CSP
   would need `worker-src blob:` and `file://` worker loading is inconsistent).
3. Imported or user text (track names, titles, lyrics, markers, player names, file names,
   warnings) is inserted only with `textContent` or `createTextNode`; `innerHTML`,
   `outerHTML`, `insertAdjacentHTML` and `document.write` do not appear in `src/` (the build
   greps for them and fails if found outside `shell.html`). SVG icons are static markup in
   the shell, never built from strings at runtime.
4. Parsers enforce the BRIEF section 6 limits (restated in ADR-06 decision 6) with
   bounds-checked readers (`DataView` access wrapped in a cursor that throws a typed
   `ParseError` on overrun); every length field is checked against the remaining bytes
   before allocation; ZIP uncompressed sizes and ratios are checked before inflating; JSON
   project documents are limited to 32 MB of text and nesting depth 32; MusicXML with
   `<!ENTITY` is rejected (ADR-06 decision 3).
5. Network messages are validated structurally against the Part 5.16 schemas before any
   field is read: unknown `type`, wrong `v`, missing fields, wrong types, oversize (> 64 KB)
   and rate-limit violations each drop the message and count toward disconnecting the peer
   (3 invalid messages in 10 s). Scores are computed by the host only (ADR-07 decision 7).
6. No credentials: the only URLs in the shipped file are the STUN constant and the optional
   relay default; a grep gate in the build fails on strings matching `api[_-]?key`,
   `secret`, `token=` or `Bearer `.
7. Diagnostics export (Part 10.10) contains capabilities, version, mode, settings, the log
   ring buffer with file names and song titles redacted, and no song content unless the
   user ticks "Attach current song".
8. `history.pushState` payloads contain only screen names; URL parameters read at boot are
   whitelisted (`test`, `tier`, `diag`, `online`) and validated (`tier` against the tier
   list; `online` must be a `ws:` or `wss:` URL and only pre-fills the relay setting).

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| No CSP, rely on code review | 5 | 5 | 5 | 5 | 4 | 2 | 5 | 5 | 5 | 41 |
| CSP with hashes or nonces | 5 | 5 | 5 | 5 | 2 | 5 | 5 | 5 | 3 | 40 |
| Parsers inside a sandboxed iframe or Worker | 3 | 4 | 5 | 5 | 2 | 5 | 5 | 4 | 3 | 36 |
| Strict meta CSP with `'unsafe-inline'`, text-only DOM insertion, parser limits (chosen) | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 44 |

Notes: a hash-based CSP would need the hash of a 1 MB script recomputed per build and
breaks the early error-handler script unless hashed too; it adds nothing because the whole
application is the one inline script. Sandboxed Workers fail from `file://` in some browsers.

Consequences: easier - a static policy that holds identically on `file://`, `http` and
`https`; the text-only rule is mechanically checkable. Harder - no Workers, so parsing is
time-sliced on the main thread (ADR-06 decision 7). Limits the UI must disclose: none.

Verification: FT (static scans of the shipped file for the forbidden APIs, inline handlers,
external URLs and credential patterns; CSP meta byte-exact); UT (bounds-checked reader
throws on every overrun; schema validator rejects each malformed network message class;
entity-bearing XML rejected); FI (`import.truncate`, malformed corpus files, oversized and
flooding network peers); XT (CSP violations are zero in the console on every browser,
checked by the LT script).

### 2.13 ADR-13 UI: DOM overlay over one canvas, CSS custom properties, system fonts

Context: B 6.3, 6.4, 21.1, 22, I 11.1-11.4, 15, P 1, 2.1-2.3, 3, 14, 15, 21. Menus, dialogs,
HUD text and touch pads need accessibility (labels, focus, screen readers, scaling); the
stage and highway need the GPU; no web fonts may be fetched or embedded (size).

Decision:

1. Layers (fixed `z-index`, all inside `#app`): `canvas#view` (0, 3D stage and highway),
   `canvas#flat` (0, shown only in the Abstract tier), `#hud` (10, `pointer-events: none`
   except on children marked `data-interactive`), `#touch` (20, the four pads and dance
   pads), `#overlay` (30, the screen stack and dialogs), `#toast` (40), `#rotate` (50, the
   rotate recommendation banner, never blocking), `#fatal` (60, shown only by
   `ErrorReporter`). `<noscript>` text sits after `#app`.
2. All text is DOM. The highway is drawn in the canvas so it moves in the same frame as the
   stage; judgment flashes, combo and score are DOM nodes in `#hud` updated at most once
   per frame via a single `requestAnimationFrame` batch owned by M-26.
3. Theme is CSS custom properties on `:root` (names and values in Part 3.2): semantic
   palette, four lane colors, typography scale, spacing, radii, shadows, motion durations,
   safe-area insets (`env(safe-area-inset-*)`), `--ui` scale (0.85-1.5, user setting).
   One dark theme in v1 plus a high-contrast toggle; no light theme.
4. Font stack `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; numerals in the
   HUD use `font-variant-numeric: tabular-nums`. No `@font-face`.
5. Icons are one inline `<svg>` sprite of `<symbol>` elements in `shell.html` (list in Part
   7.1) referenced by `<use href="#i-play">`; lane glyphs and dance arrows exist both as
   SVG symbols (DOM) and as meshes (3D highway).
6. Widgets are plain elements built by M-26 helpers (button, toggle, slider, select, number,
   list, tabs) with ARIA roles and labels, keyboard operation, a visible focus ring (never
   `outline: none` without a replacement) and minimum 44 x 44 CSS px hit area in menus
   (56 x 56 for gameplay pads). Dialogs trap focus and restore it on close.
7. Responsive rules: breakpoints at 600 px and 1024 px of `min(innerWidth, innerHeight)`
   and width respectively; body classes `.portrait` or `.landscape` and `.touch` or
   `.pointer` updated on `resize` and `orientationchange`; pads span the bottom 28 percent in
   portrait and the right or bottom 24 percent in landscape (setting); layouts never allow
   horizontal page scroll (`overflow: hidden` on `html, body`).
8. Motion: `@media (prefers-reduced-motion: reduce)` and the `.reduced-motion` class disable
   non-essential transitions, camera motion and particle effects while keeping judgment
   feedback and note movement (which are information, not decoration).
9. Browser history: each screen push calls `history.pushState({screen})`; `popstate` calls
   `FLM.UI.back()`; the unsaved-changes guard runs before a pop completes (Part 7.4).
10. Text entry is limited to names (project, track, player) and never required during active
    gameplay (B 6.4).

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Canvas-drawn UI (everything in WebGL or 2D) | 5 | 4 | 4 | 5 | 2 | 5 | 2 | 5 | 5 | 37 |
| DOM UI with a framework (React, Vue, Preact) | 5 | 4 | 3 | 5 | 4 | 4 | 5 | 5 | 3 | 38 |
| Web Components with Shadow DOM | 4 | 4 | 5 | 5 | 3 | 5 | 5 | 5 | 5 | 41 |
| Embedded base64 web font plus DOM | 5 | 4 | 2 | 4 | 4 | 5 | 5 | 5 | 5 | 39 |
| Plain DOM overlay, CSS custom properties, system fonts (chosen) | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 44 |

Notes: a canvas UI defeats screen readers, focus and text scaling (B 22); frameworks are
unavailable offline (ADR-02); Shadow DOM complicates global theming and focus traps for no
gain here; a single embedded font weight costs 100-300 KB.

Consequences: easier - accessibility comes from the platform; theming is one token block;
the stage canvas never competes with text rendering. Harder - the HUD must be throttled to
one DOM write batch per frame; `#hud` must stay transparent to pointer events for the pads
below. Limits the UI must disclose: none; typography differs slightly per OS (system fonts).

Verification: UT (DOM-level tests in headless Chromium: focus trap, keyboard navigation,
slider precision, screen stack, `popstate` back, layout classes at both orientations); XT
(no horizontal scroll, pad sizes >= 56 px, safe areas on notched iOS devices); LT (P 2.2
pixel checks at 360 x 640, 390 x 844, 768 x 1024, 1366 x 768, 1920 x 1080; screen reader
pass on one desktop and one mobile browser).

### 2.14 ADR-14 Built-in content: five original arrangements as compact data

Context: B 7.1 (Quick Play without import), 23.3 (no copyrighted content), P 4 (built-in
demo without a file), P 21 (coherent demo content), I 11.3 (tutorial). The game must be
playable within seconds of opening without any file.

Decision:

1. `src/30-content.js` defines five original arrangements (60-120 s each) in the compact
   notation specified in Part 6 M-30, covering pop-rock band, piano solo, electronic, jazz
   trio and a 128 BPM dance track; across the set at least one tempo change and one meter
   change occur. Titles, ids and metadata are listed in Part 1.7; melodies, progressions and
   patterns are original (no quotations of existing works).
2. Expansion to `Song` objects is lazy: on first selection, cached in memory for the page
   lifetime, and must take <= 50 ms per song on the desktop reference device; expansion is
   deterministic (same bytes in, same `Song` out, including event ids derived from position).
3. Charts for built-in songs are not hand-authored: `FLM.Mapping.ChartGenerator` and
   `FLM.Dance.DanceChartGenerator` produce them on first use for every (difficulty,
   profile) pair and cache them by `settingsHash` in memory; nothing is persisted, so a
   generator change (`generatorVersion`) is picked up automatically. Built-in songs are
   `lockedSource:true` on every track.
4. The tutorial sequence (I 11.3, seven steps) is content data in the same module: a short
   8-bar exercise song plus per-step target definitions (Part 6 M-30 and Part 7.9).
5. The eight character presets (Part 6 M-22) live in `30-content.js` as `CharacterConfig`
   objects, versioned with `version:1`.
6. All built-in content carries `contentVersion: 1` (`FLM.Content.VERSION`); records keyed
   by song id (personal bests, achievements) also store `contentVersion` so a later content
   edit can invalidate comparisons explicitly rather than silently.
7. Size budget for the content module: <= 60 KB of source.

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Embedded SMF files as base64 strings | 5 | 5 | 3 | 5 | 2 | 5 | 5 | 5 | 5 | 40 |
| Public-domain classical pieces as MIDI | 5 | 5 | 3 | 3 | 3 | 5 | 5 | 5 | 5 | 39 |
| Runtime procedural song generation only | 5 | 5 | 5 | 5 | 3 | 5 | 2 | 5 | 5 | 40 |
| Hand-authored charts per difficulty | 5 | 5 | 3 | 5 | 2 | 5 | 5 | 5 | 5 | 40 |
| Original arrangements as compact data, generated charts (chosen) | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 44 |

Notes: base64 SMF is opaque and three times larger than notation; public-domain works have
clear composition rights but arrangement provenance must still be proven; hand-authored
charts drift from generator behavior and would not test the generator.

Consequences: easier - demo content doubles as the deterministic fixture for IT and TT
tests; no licensing review beyond "original". Harder - authoring five coherent pieces in
notation is real composition work (Part 6 M-30 gives the material). Limits the UI must
disclose: "Built-in songs are original demo arrangements" on SCR-Library.

Verification: UT (expansion determinism, durations within 60-120 s, pitch ranges inside the
assigned instruments' playable ranges, tempo and meter change present in the set, charts
regenerate identically); PT (expansion time, time to first playable interaction from file
open <= 5 s desktop / 8 s mobile); LT (musical coherence review of all five, P 21).

### 2.15 ADR-15 Progression: local only, deterministic daily challenge

Context: B 23.2 (no telemetry, no accounts), I 9.1-9.4, P 5.3 (comparability), 15. Rewards
must motivate without gating creation tools and without any service.

Decision:

1. All progression data is local (`flm.v1.progress` in localStorage; Part 5.13 types). No
   accounts, no network, no telemetry; nothing in the progression module touches
   `FLM.Net`.
2. Performance history keeps at most 500 `PerformanceRecord`s (oldest pruned); personal
   bests are keyed by `(songId, chartHash)` where `chartHash = Chart.settingsHash`; every
   record stores `comparable:boolean` computed from the settings flagged in Part 5.11
   (adjusted judgment windows or a stray-press penalty change make a record
   non-comparable and it is shown with the label "custom windows").
3. Twenty achievements and a cosmetic unlock catalog (3 stage themes, 5 accessories, 2
   effects) are defined in Part 6 M-25; unlocks never change timing, windows, audio or
   input (I 9.3) and are purely `CharacterConfig.accessories` entries and `Stage` theme
   ids.
4. Daily challenge: `seed = fnv1a32('flm-daily-' + yyyymmdd)` where `yyyymmdd` is the
   local calendar date from `getFullYear`, `getMonth` + 1 and `getDate` (local time, so the
   challenge changes at the user's midnight); the seeded `Prng` picks song, instrument,
   difficulty and a goal from fixed tables; the same date yields the same challenge on every
   device. Completion is recorded locally; nothing is notified or scheduled.
5. Core tools are never locked: every mode, instrument, song, difficulty and editor is
   available from first launch; progression only adds cosmetics and records.
6. Records are exported inside `.flmsettings.json` backups (Part 5.14) so users can move
   them between browsers manually.

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Online leaderboards and cloud saves | 5 | 5 | 5 | 4 | 2 | 2 | 5 | 1 | 1 | 30 |
| No progression at all | 5 | 5 | 5 | 5 | 5 | 5 | 1 | 5 | 5 | 41 |
| Local-only records, achievements, cosmetics, seeded daily (chosen) | 5 | 5 | 5 | 5 | 4 | 5 | 4 | 5 | 5 | 43 |

Consequences: easier - no privacy surface; deterministic tests for the daily challenge.
Harder - records are lost with cleared browser data unless exported (disclosed). Limits the
UI must disclose: "Progress is stored in this browser only; export settings to keep it";
"custom windows" label on non-comparable records.

Verification: UT (pruning at 500, personal-best keying, comparability flag, daily seed
determinism across time zones with fixed date inputs, unlock conditions); IT (a finished
Quick Play run produces one record and updates bests); LT (unlock catalog visible and
cosmetic-only).

### 2.16 ADR-16 Development ledger

Context: B 1.4 (continuously updated status list), 1.3 (record assumptions), 28 (final
report inputs), E 12 (traceability), BRIEF section 8 (single-session implementation that may
be interrupted by context limits).

Decision:

1. `docs/LEDGER.md` is the running log of the implementing session: newest entry first,
   under a fixed header (template in Appendix D). Every entry has: UTC timestamp, the T
   sections completed, the build result (size, warnings), the self-test groups run with
   pass/fail counts, decisions taken that the plan did not already decide, assumptions
   added (also mirrored into the "Assumptions" section at the top of the ledger), open
   issues, and a final line `RESUME: T<pp>.<nn>` naming the next T section.
2. Update points: at every phase gate (Part 11), before any deliberate pause, and whenever
   the session detects that its remaining context is low; the `RESUME:` line is written
   before anything else in that situation.
3. `docs/STATUS.md` (Part 0.7) is the live requirement status list; the ledger references
   it but does not duplicate it.
4. A fresh session resumes by reading Part 0, the newest ledger entry and STATUS, then
   continuing from the `RESUME:` T section; it never re-plans.
5. Commits at phase gates include the ledger and STATUS updates and use the message
   conventions of BRIEF section 8; nothing is pushed unless the owner says so.

Alternatives considered:

| Alternative | Browser compat | Mobile perf | File size | License | Maint | Security | Func compl | Offline | Single-file | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| Git history only | 5 | 5 | 5 | 5 | 2 | 5 | 2 | 5 | 5 | 39 |
| Issue tracker (GitHub issues) | 5 | 5 | 5 | 5 | 3 | 4 | 4 | 1 | 5 | 37 |
| Newest-first ledger file with RESUME line (chosen) | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 45 |

Notes: the criteria apply loosely to a process artifact; the deciding factors are offline
operation and resumability without tools.

Consequences: easier - interruption-safe execution; the final report (Part 14) is assembled
from ledger entries. Harder - discipline cost at every gate (the Part 0.4 procedure makes it
a step). Limits the UI must disclose: none.

Verification: LT (the Phase 16 review checks that every phase gate has a ledger entry with a
`RESUME:` line and that STATUS counts match the Part 15 matrix).

### 2.17 Dependency inventory and policy

Policy (B 19.5, I 14.2): every dependency, runtime or development, has a row below with
purpose, version, license, loading strategy, failure handling and justification. A
dependency without a row is a defect. The runtime inventory has zero rows by ADR-02 and
stays at zero through v1; the About screen states this. No npm package is installed at any
point: there is no `package.json` in `Finger Lickin Music/`, no `node_modules/`, and the
tools use only Node built-ins (`fs`, `path`, `url`, `child_process`, `http`, `crypto`,
`zlib` for corpus generation only, the global `WebSocket` client) plus the preinstalled
Playwright module resolved by `require('playwright')` from the environment.

Runtime dependencies:

| Dependency | Purpose | Version | License | Loading | Failure handling | Justification |
|---|---|---|---|---|---|---|
| (none) | - | - | - | - | - | ADR-02 |

Development dependencies (not shipped, not required to play):

| Dependency | Purpose | Version | License | Loading strategy | Failure handling | Justification |
|---|---|---|---|---|---|---|
| Node.js | runs `tools/*.mjs` and `server/relay.mjs` | 22.0 or newer (checked by `process.versions.node` at tool start) | MIT (Node.js license file) | preinstalled on the implementing machine | tools exit 2 with "Node 22 or newer required" | build, tests, corpus, relay; no alternative without npm |
| Playwright (Node module) | launches headless Chromium for `tools/selftest.mjs` and `tools/perf.mjs` | the preinstalled version; recorded by `require('playwright/package.json').version` into every JSON result | Apache-2.0 | `require('playwright')` from the environment's global module path | if `require` throws: CDP fallback driver (ADR-11 decision 5) | only available browser automation; never installed by the project |
| Chromium (Playwright build) | the browser under test | the preinstalled build at Playwright's default path, fallback `/opt/pw-browsers/chromium`; version read from `browser.version()` or CDP `Browser.getVersion` | BSD-3-Clause and bundled component licenses | launched by Playwright, or spawned with `--headless=new --remote-debugging-port=9222` for the CDP driver | if neither path exists: tool exits 2 with the message "No Chromium found; run the test build manually in a browser and copy __FLM_RESULTS" | headless gate for every T section |
| Git | version control | any 2.x | GPL-2.0 | preinstalled | n/a | repository convention |

External network services (not dependencies in the code sense; each is optional, off by
default, user-enabled, and documented in Part 1.4 and Part 10.4):

| Service | Used by | Default | What is sent | Failure handling |
|---|---|---|---|---|
| `stun:stun.l.google.com:19302` (Google public STUN) | ADR-07 decision 3 | off | ICE binding requests (public IP discovery) | ICE proceeds with host candidates only; lobby shows "STUN unreachable; same-network play only" |
| `server/relay.mjs` instance (owner-hosted) | Online edition only | not configured | the Part 5.16 messages as text frames | DLG-NetError "Relay not reachable"; Standalone features unaffected |

Loading strategy statement: nothing is downloaded by the shipped file. There is no
progressive asset loading because there are no assets (B 20.4 is satisfied by lazy
instrument patch compilation and lazy content expansion inside the file, Part 9.4).

### 2.18 Single-file constraint analysis

Spec basis: B 5.2 (run from the file directly, verify per browser), 5.3 (everything in one
file), 5.4 (standalone versus online), E 9 (the fifteen file and browser cases), I 14.1-14.3.

What runs from `file://` with no server: the entire Standalone edition - all modes except
Multiplayer, all import formats, all exports, local storage, audio, 3D. Multiplayer over
WebRTC with manual signaling also runs from `file://`; only the optional STUN and relay need
a network.

What needs HTTPS (a secure context): Web MIDI (also absent in Safari regardless), Wake Lock
(not used), `navigator.share` (optional convenience), the Clipboard API `writeText` (has a
fallback). In Chromium and Firefox `window.isSecureContext` is `true` for `file://`, so a
locally opened file is a secure context; a page served over plain `http://` from a non-
localhost host is the only non-secure context among the deployment options and loses the
listed APIs. The About screen states: "Opening the file directly or over HTTPS gives the
full feature set; plain HTTP disables MIDI input".

What cannot exist inside one HTML file: a persistent, publicly reachable multiplayer
service (B 5.4), NAT traversal infrastructure (STUN/TURN), and any server-side validation of
scores beyond the host player's own client. Smallest exceptions adopted (B 1.4 last bullet):
manual-signaling WebRTC (no service at all), an optional public STUN server (one URL,
off by default), and an optional owner-hosted relay (`server/relay.mjs`, zero dependencies,
documented in Part 3.7). No TURN server is adopted: pairs that need relayed media are told
to use the relay edition or the same network.

Capability table (verified per browser by XT tests; "verify" marks behaviors the plan does
not assume):

| Capability | file:// | http(s) | Secure context required | Fallback |
|---|---|---|---|---|
| Inline script and CSS execution | yes | yes | no | none needed |
| `AudioContext` after a gesture | yes | yes | no | DLG-AudioBlocked re-prompt; `#fatal` only if the constructor throws |
| `decodeAudioData` (wav, mp3, ogg, flac, m4a) | yes; codec set varies by browser | yes | no | unsupported codec -> error listing the browser's decodable formats |
| `OfflineAudioContext` (WAV export) | yes | yes | no | MediaRecorder capture (OQ-2) |
| `MediaRecorder` of a `MediaStreamDestination` | yes (Safari 14.1+) | yes | no | WAV export via OfflineAudioContext; else "Audio export unavailable in this browser" |
| WebGL2 | yes | yes | no | WebGL1 |
| WebGL1 | yes | yes | no | Abstract tier on `canvas#flat` |
| 2D canvas | yes | yes | no | none needed (text-only `#fatal` if absent) |
| Pointer Events | yes | yes | no | Touch Events path (OQ-1) |
| Keyboard `code` | yes | yes | no | `key` for letters and digits |
| Gamepad API | yes (Chromium, Firefox); Safari verify | yes | no | keyboard and touch |
| Web MIDI | Chromium: yes (file:// is secure); Firefox: verify (site permission); Safari: no | https only | yes | setting disabled with reason; four-button play unaffected |
| `localStorage` | yes (Chromium: one origin for all local files; Firefox: per directory; Safari: yes) | yes | no | in-memory settings for the session plus a notice |
| IndexedDB | Chromium yes; Firefox yes; Safari verify (may fail) | yes | no | localStorage-only mode (ADR-08 decision 4) |
| `navigator.storage.estimate` | Chromium yes; others verify | yes | yes in some browsers | quota shown as "unknown" |
| Blob download via anchor `download` | yes | yes | no | open `data:` URL in a new tab |
| `<input type="file">` and drag-and-drop | yes | yes | no | none needed |
| Clipboard `writeText` | Chromium yes; Safari verify | https yes | yes | select text plus `execCommand('copy')`, else manual selection |
| `navigator.share` | no (desktop); mobile verify | https yes | yes | Copy button |
| Fullscreen API | yes with gesture (not on iPhone) | yes | no | layout works unfullscreened; `#rotate` banner |
| Screen Orientation lock | needs fullscreen; iOS no | same | no | recommendation banner only, never blocking |
| `history.pushState` / `popstate` | yes (Chromium, Firefox); Safari verify | yes | no | internal back stack still works; browser back leaves the page with the unsaved guard |
| `visibilitychange`, `pagehide` | yes | yes | no | none needed |
| `RTCPeerConnection` and `RTCDataChannel` | Chromium yes; Firefox yes; Safari verify | yes | Safari: verify | Multiplayer entry disabled with reason "WebRTC is not available in this browser" |
| `WebSocket` to the relay | yes (CSP `connect-src` must list it; Online build) | yes | `wss:` needed from https pages | DLG-NetError |
| Web Workers / AudioWorklet | inconsistent (blob URLs, CSP) | yes | no | not used in v1 (ADR-04, ADR-12) |
| Service Worker | no | https only | yes | not used |
| `fetch` of sibling files | no | yes | no | not used; everything is inline |
| `performance.memory` | Chromium only | Chromium only | no | memory shown as "unavailable" |
| Cross-tab `storage` event | yes (same origin rules above) | yes | no | lock record TTL (15 s) |

Deployment contexts and the sentence each shows on SCR-About:

- Standalone edition, opened from disk: "Standalone edition: everything runs from this file.
  Multiplayer works with other players on your network or with a shared STUN option."
- Standalone edition, served over HTTPS: identical, plus MIDI input where the browser
  supports it.
- Online edition (built with `--online`): "Online edition: this file is the same game plus a
  configured relay server for multiplayer (<relay host>). The relay stores nothing and is
  not needed for any other feature."

Rules derived from the analysis: (1) every feature in the capability table has a fallback
column that is implemented, not a wish; (2) `Caps` records the actual outcome of each probe at
boot and SCR-Diagnostics shows the table live, so XT testers compare it against this plan;
(3) a feature whose probe fails is shown disabled with its reason (B 6.2), never hidden; (4)
the delivered `FingerLickinMusic.html` is the file tested, from `file://` first, in each of
the five browsers, before any compatibility claim is written into `docs/COMPATIBILITY.md` or
the final report.

### 2.19 Decisions deferred to implementation time

Only the three open questions of the BRIEF remain open. Each has its fallback decided now so
that discovering the answer changes a switch, not a design.

| ID | Question | Decided default | Decided fallback | How it is resolved | Where recorded |
|---|---|---|---|---|---|
| OQ-1 | Does iOS Safari deliver simultaneous Pointer Events for four touches on all supported devices? | Pointer Events on `#touch` (ADR-10 decision 2) | Touch Events path in M-07 selected per device when the first-launch four-pad probe counts fewer than 4 concurrent pointers (ADR-10 decision 10); the setting `input.touchApi` (`auto`, `pointer`, `touch`) lets the user force either | XT test on at least two physical iOS devices (one with iOS 14.x-15.x, one current) during Phase 15; the probe runs on every first launch regardless | LEDGER Assumptions, Part 9.2 device matrix row, SCR-Help sentence |
| OQ-2 | Is `OfflineAudioContext` WAV export acceptable on iOS for full mixes (memory)? | OfflineAudioContext render at 48 kHz stereo, written in 16-bit PCM chunks of 10 s to bound peak memory (ADR-04 decision 9) | MediaRecorder capture of a real-time render through `MediaStreamAudioDestinationNode`, producing the browser's native container (`audio/mp4` or `audio/webm`), chosen automatically on iOS when the estimated PCM size exceeds 60 MB or when the offline render throws | PT test on an iOS device with the longest demo (120 s) and a 32-track synthetic project during Phase 14 | LEDGER, Part 9.2, export dialog text "Exports as <format> on this device" |
| OQ-3 | Is the public STUN server reachable from the owner's network? | STUN toggle off; host-candidate (same network) connectivity (ADR-07 decision 3) | If STUN is unreachable or blocked, the lobby shows "STUN unreachable; same-network play only" within 3 s of gathering and play proceeds on the LAN; the Online edition relay is the documented path for internet pairs | XT test of a two-device LAN session with the toggle on and off during Phase 13 | LEDGER, Part 1.4 delivery profile notes, SCR-Multiplayer diagnostics |

Everything else in this part is decided. An implementer who believes a decision here is
wrong records the disagreement and the smallest proposed change in the LEDGER and proceeds
with the decision as written; the plan is amended only through a documented change to Part 15
and this part (B 27 last paragraph).
