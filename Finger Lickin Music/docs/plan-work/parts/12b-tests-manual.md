### 12.8 Cross-device and browser tests (XT-001..)

XT tests run the delivered file in real browsers on real devices (B 25.5, E 9, I 12, P 14,
P 18, P 20). They are planned here; every result cell starts as "not run" and is filled
only from a recorded run (12.11). The implementing session cannot reach physical devices or
non-Chromium browsers (Part 0.6, Part 0.10); it prepares the artifacts, runs the
pre-checks it can run, and lists every XT row as an owner action in the LEDGER until the
owner reports a result.

#### 12.8.1 Rules for every XT test

1. Artifact under test. The shipped `FingerLickinMusic.html` of the release candidate
   commit, built by `node tools/build.mjs`, unless a row names the test build
   (`FingerLickinMusic.test.html`, needed only for "Run self-test" and "Run performance
   scenarios" on SCR-Diagnostics, Part 7.6.15 and 9.7.5). The tester records the file's
   SHA-256 (`sha256sum`, `shasum -a 256` or `certutil -hashfile <file> SHA256`) and the
   version line of SCR-Diagnostics "Build". A result obtained with a different hash does not
   count for the release candidate.
2. Browsers. The five targets of Part 1.6: Desktop Chromium (Chrome; Edge is run as a
   second result line of the same row), Desktop Firefox, Desktop Safari, iOS Safari,
   Android Chrome. Each row runs on the current stable release and on the previous major
   release where the tester can obtain it (Part 1.6); each version is a separate result
   line. Other Chromium-based browsers are not tested (Part 1.6 rule 4).
3. Devices. Device classes are those of Part 9.2.1 (`ref-desktop`, `low-desktop`,
   `ref-android`, `low-android`, `ref-ios`, `old-ios`, `tablet`). Every result line records
   the model, OS build, browser version string (from `navigator.userAgent` as shown in the
   diagnostics export), devicePixelRatio, viewport in CSS px and `navigator.maxTouchPoints`.
4. Contexts. Every row names the contexts it runs in:

   | Context | URL form | Secure context | Used on |
   |---|---|---|---|
   | C1 | `file:///.../Finger Lickin Music/FingerLickinMusic.html` (path with spaces), and a second run after copying the file alone to another folder (for example Downloads) | browser-dependent (Part 1.6) | desktop; Android through `file:///sdcard/Download/FingerLickinMusic.html` or the Files app "Open with Chrome" (the scheme shown, `file://` or `content://`, is recorded); iOS see rule 6 |
   | C2 | `http://localhost:8080/` | yes | desktop |
   | C3 | `https://<static host>/FingerLickinMusic.html` | yes | all five browsers |
   | C4 | `http://<LAN address of the serving computer>:8080/` | no | desktop (from a second computer) and mobile |

   A row "passes for a browser" only when it passes in every listed context on every tested
   version. The `file://` and `http(s)` results are recorded in separate cells (12.11).
5. Serving for C2 and C4 uses Node built-ins only (no npm, ADR-02). From the repository
   root, with the desktop firewall allowing TCP 8080:

   ```text
   cd "Finger Lickin Music"
   node -e "const h=require('http'),fs=require('fs');h.createServer((q,s)=>{const u=q.url.split('?')[0];const f=u==='/'?'FingerLickinMusic.html':decodeURIComponent(u.slice(1));if(f.includes('..')||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(f).pipe(s);}).listen(8080,'0.0.0.0',()=>console.log('serving on 8080'))"
   ```

   The same server lets mobile devices download corpus files from
   `http://<LAN address>:8080/test-corpus/<file>` into their Downloads or Files storage
   before the import rows. C3 uses any static HTTPS host the owner controls (for example
   the repository's GitHub Pages site if the owner enables it); the host name is recorded.
   No row requires a server-side header (R-E9-11).
6. iOS `file://`. When the device offers no way to open a local HTML file with scripts
   running in Safari (the Files app shows only a preview), the C1 cell of an iOS row is
   recorded "n/a: platform cannot open local HTML files" (not "fail"), and the published
   claim for iOS Safari names C3 only (12.11.3 rule 4).
7. Profiles and data. The first run of a browser uses a fresh profile with no site data
   (Chrome or Edge `--user-data-dir=<new folder>`, Firefox `-P` with a new profile, Safari
   Settings > Privacy > Manage Website Data > Remove All, iOS Settings > Safari > Clear
   History and Website Data, Android Chrome Settings > Site settings > All sites > clear).
   Rows that test returning-user behavior say so.
8. Network. C1 runs with the network disconnected (airplane mode or adapter off) from
   before the file is opened, so every C1 run is also an offline run (R-E9-04, R-P18-06).
   C2, C3 and C4 need the network only to load the page; rows that test offline behavior
   disconnect after load.
9. Inspection tools. Desktop: the browser's developer tools (Console and Network panels).
   iOS: Safari Web Inspector from a Mac (Settings > Safari > Advanced > Web Inspector).
   Android: `chrome://inspect` from a desktop Chrome over USB debugging. Where no inspector
   is available, the diagnostics export (`.flmdiag.json`, SCR-Diagnostics "Export
   diagnostics") is the evidence.
10. Console rule. Every row also requires: no uncaught exception and no `#fatal` panel
    during the row, and no network request after the document itself in C2 and C3 (the
    Network panel shows exactly one request, the document) unless the row exercises
    multiplayer with the STUN toggle on or the relay.
11. Session pre-checks. The implementing session runs the Desktop Chromium rows that need
    no physical device in headless Chromium (C1 and C2) as pre-checks; their results are
    recorded "pre-check (headless)" in the LEDGER and never fill a release cell or support
    a Supported claim (Part 9.2.1, Part 1.6 policy).
12. Failure handling. A failing row opens a STATUS.md section 6 defect with the row ID,
    browser line and context; a fixed defect is re-run on the new release candidate hash
    and gains a regression test where one can be automated (I 17).

#### 12.8.2 Open, boot and offline core functions (XT-001..XT-005)

Covers R-B26.1-01, R-B26.1-03, R-E9-01, R-E9-02, R-E9-04, R-E9-16, R-P18-05, R-P18-06,
R-E13-05.

Procedure (every row): (1) open the URL of each listed context in a fresh profile; (2)
SCR-FirstLaunch shows the four `fl-checks` rows, each "Ready" or "Limited" with a reason;
(3) press "Start", choose Keyboard or Touch, then "Go to the main menu"; (4) SCR-MainMenu
lists the 12 entries in the brief's order, every unavailable entry disabled with its
one-line reason; (5) start Quick Play with the default selection (`demo-poprock`, Keys,
beginner) and play 30 s; (6) leave, open Free Play and play 10 notes; (7) open SCR-About
and read the edition sentence and the "Limits of this version" block; (8) open
SCR-Diagnostics, read "Load timing" and the Capabilities section, press "Export
diagnostics"; (9) reload and confirm SCR-MainMenu opens directly (returning user).

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-001 | Desktop Chromium | `ref-desktop` (Windows or Linux) | C1, C2, C3, C4 | Chrome and Edge as two result lines; C1 opened by double-click and by drag onto a browser window; C4 opened from a second computer | procedure steps 1-9 succeed in every context; console rule holds; diagnostics export saved |
| XT-002 | Desktop Firefox | `ref-desktop` | C1, C2, C3, C4 | `security.fileuri.strict_origin_policy` left at its default | as XT-001 |
| XT-003 | Desktop Safari | `ref-desktop` (macOS 13 or newer) | C1, C2, C3 | Develop menu enabled for inspection only; "Disable Local File Restrictions" stays off (default settings are under test) | as XT-001 |
| XT-004 | iOS Safari | `ref-ios` and `old-ios` | C1 (rule 6), C3, C4 | C3 also once from a Home Screen bookmark ("Add to Home Screen"); inspection through Web Inspector | as XT-001 for every context that is not "n/a" |
| XT-005 | Android Chrome | `ref-android` and `low-android` | C1, C3, C4 | C1 scheme recorded; inspection through `chrome://inspect` | as XT-001 |

#### 12.8.3 Audio unlock (XT-006..XT-010)

Covers R-P14-09, R-I12-10, R-P4-02, R-E9-14 (activation part); risk RISK-02.

Procedure: (1) fresh profile, open the context URL; before any gesture, confirm silence
and that no mode can start; (2) press "Start" on SCR-FirstLaunch; within 1 s
SCR-Diagnostics Timing (opened afterwards) shows audio state `running`; (3) enter Quick
Play and hear the count-in clicks with the accent on beat 1; (4) reload as a returning
user, press nothing, try to start Quick Play with the pointer: the first click or tap both
unlocks and starts (or DLG-AudioBlocked appears and its "Turn on sound" succeeds); (5)
reload, press a key first (desktop) or tap an empty area (mobile), then start Quick Play
by keyboard; (6) with the device volume at zero, press "Turn on sound" in DLG-AudioBlocked
and confirm the S-AUD-03 text appears only after a failed attempt, not after a success.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-006 | Desktop Chromium | `ref-desktop` | C1, C2, C3 | autoplay policy at default | audio `running` within 1 s after the first gesture in every context; no sound before it; steps 3-6 as described |
| XT-007 | Desktop Firefox | `ref-desktop` | C1, C2, C3 | Settings > Privacy > Autoplay left at "Block Audio" (default) | as XT-006 |
| XT-008 | Desktop Safari | `ref-desktop` | C1, C2, C3 | Settings > Websites > Auto-Play left at default | as XT-006 |
| XT-009 | iOS Safari | `ref-ios` and `old-ios` | C3, C4 | ring and silent switch set to ring for this row (silent case is XT-072); unlock must survive the first tap being on the "Start" button (silent-buffer kick, Part 6.5) | as XT-006 |
| XT-010 | Android Chrome | `ref-android` and `low-android` | C1, C3, C4 | media volume above zero | as XT-006 |

#### 12.8.4 Four simultaneous touches on the pads (XT-011..XT-015, OQ-1)

Covers R-P14-03, R-I12-03, R-P5.1-03, R-B26.2-02 (touch part); risk RISK-53; resolves OQ-1
(Part 2.19). Uses the old-ios and ref-ios classes for the two physical iOS devices that
Part 2.19 requires.

Procedure: (1) fresh profile; at SCR-FirstLaunch step 2 choose "Touch" and place four
fingers on the four pads at once; record the `fl-touch-result` sentence; (2) SCR-Diagnostics
Input shows the same "touch probe maximum" and the pad surface in use (`pointer` or
`touch`); (3) Free Play, profile C (chords) and profile A (lanes): press all four pads at
once 20 times in portrait and 20 times in landscape; count lit pads and heard notes; (4)
set SCR-Settings Controls `input.touchApi` to `pointer`, repeat step 3 in portrait; set it
to `touch`, repeat; set it back to `auto`; (5) Instrument Mode on `demo-poprock` Rhythm
Guitar at expert (four-note chords) for 30 s: chord judgments appear for four-lane chords.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-011 | iOS Safari | `old-ios` (A12, iOS 16.4 or newer) | C3 | the device Part 2.19 calls the older iOS device | in `auto`, 40 of 40 four-finger presses register 4 distinct presses (4 lit pads, 4 notes) on the path M-07 selected; the selected path and the probe count are written to the LEDGER Assumptions (OQ-1) and the 9.2 Notes |
| XT-012 | iOS Safari | `ref-ios` (A13-A15, current iOS) | C3 | as XT-011 | as XT-011 |
| XT-013 | iOS Safari (iPadOS) | `tablet` (iPad) | C3 | landscape with `input.padLayout` `right` (2 x 2 grid) and `bottom` | as XT-011 |
| XT-014 | Android Chrome | `ref-android` | C1, C3 | as XT-011 | as XT-011 |
| XT-015 | Android Chrome | `low-android` | C3 | a device that reports `maxTouchPoints < 4` must show the HUD note of Part 9.8 instead | as XT-011, or, when the hardware reports fewer than 4 touch points, the Part 9.8 note is shown and every press up to the reported count registers |

If a device fails XT-011 to XT-015 on both paths, the Touch Events fallback is not enough
for it: the device is published Partial with the failing capability named (Part 1.6 rule
1), and the LEDGER Decisions section records the outcome of OQ-1.

#### 12.8.5 Touch release lifecycle (XT-016..XT-019, E 13 item 7)

Covers R-P14-04, R-P5.1-04, R-P5.1-06, R-I12-04, R-E13-07; risk RISK-09.

Procedure: Free Play with GM program 19 (Church Organ, sustained), profile A, sustain off.
For each case below hold one pad (cases a-f) or four pads (cases g-h), perform the action,
then lift every finger; after each case SCR-Diagnostics Input "held controls" reads 0, no
note keeps sounding and no pad stays lit. Cases: (a) slide the finger onto the
neighboring pad and lift there; (b) slide the finger off all pads onto the highway; (c)
open the notification shade (Android) or Control Center or Notification Center (iOS) from
the screen edge while holding; (d) rotate the device while holding; (e) switch to another
app with the system gesture while holding and come back; (f) receive an alarm or timer
alert while holding; (g) hold four pads and lift all at once; (h) lay the palm across all
pads and lift. Each case 5 times in portrait and 5 times in landscape.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-016 | iOS Safari | `ref-ios` | C3 | case (c) with both Control Center and Notification Center | 80 of 80 case runs end with 0 held controls and silence at the moment of release (no audible tail beyond the instrument's release); case (a) sounds the new pad's note and releases the old one |
| XT-017 | iOS Safari | `old-ios` | C3 | as XT-016 | as XT-016 |
| XT-018 | Android Chrome | `ref-android` | C1, C3 | gesture navigation and three-button navigation both, if the device offers both | as XT-016 in each context |
| XT-019 | Android Chrome | `low-android` | C3 | as XT-018 | as XT-016 |

#### 12.8.6 Storage: IndexedDB and localStorage (XT-020..XT-024)

Covers R-P18-09, R-E9-12, R-B26.5-04 (per browser), R-I12-09; risks RISK-13, RISK-58.

Procedure: (1) fresh profile; SCR-Diagnostics Storage shows the mode (`full`,
`localOnly` or `memory`), the notice (none, or S-STO-06 to S-STO-09 of Part 7.11) and the
quota line ("unknown" allowed); (2) in Studio create project "XT storage", record an
8-bar Free Play take on one track, add a marker, save; (3) reload: SCR-Library lists the
project with the same name, size and modified time; open it and play the take; (4) quit
the browser completely, reopen the same URL: the project and the settings changed in step
2 (master volume 70 percent) are still present; (5) C1 only: copy the HTML file alone to a
second folder and open it there: record whether the project is visible (Chromium shares
one origin for local files, Firefox scopes by directory, Part 13 RISK-58); SCR-Library
shows the keep-in-one-folder sentence when the project list is empty on a `file://` page;
(6) open a private or incognito window on the same URL: record the mode and notice; save
a project there and confirm that Save either persists for the window's lifetime or shows
DLG-SaveFailed with "Export to file", never a false "Saved"; (7) in `full` mode, save a
project with a 5 MB recording (Studio, long take) and confirm it is kept in IndexedDB; in
`localOnly` mode, confirm DLG-ProjectTooLarge appears for a project above 2 MB.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-020 | Desktop Chromium | `ref-desktop` | C1, C2, C3 | step 5 expected to show the project in the second folder (shared local origin); recorded either way | every context reaches `full` or a reduced mode with its exact notice; steps 3-4 keep the project and settings in `full` and `localOnly`; no step shows "Saved" without persistence; the observed mode per context is recorded for `docs/COMPATIBILITY.md` |
| XT-021 | Desktop Firefox | `ref-desktop` | C1, C2, C3 | step 5 expected to show an empty library (per-directory origin); private window: IndexedDB may be unavailable, expect `localOnly` or `memory` with its notice | as XT-020 |
| XT-022 | Desktop Safari | `ref-desktop` | C1, C2, C3 | on C1 IndexedDB may be denied or hang: the probe must give up within its 2,000 ms timeout (Part 4.3 B5) and show S-STO-09 | as XT-020; boot to the main menu is not delayed by more than 2,500 ms by a hanging probe |
| XT-023 | iOS Safari | `ref-ios` and `old-ios` | C3, C4 | record whether `navigator.storage.persist()` was granted (Diagnostics Storage); step 4 includes closing Safari from the app switcher | as XT-020 |
| XT-024 | Android Chrome | `ref-android` and `low-android` | C1, C3, C4 | step 4 includes swiping the browser away from the recent-apps list | as XT-020 |

#### 12.8.7 Download and export (XT-025..XT-029)

Covers R-P18-10, R-B26.5-05 (per browser), R-E10-07;
risks RISK-21, RISK-54 (OQ-2).

Procedure: from the delivered file in each context: (1) Library: export `demo-poprock` as
`.mid` through DLG-Export; (2) export project "XT storage" as `.flm.json`; (3) SCR-Settings
Data and backup: "Export settings (.flmsettings.json)"; (4) SCR-Characters: export one
character as `.flmchar.json`; (5) Studio: export the audio mix of `demo-piano` (102 s);
record the path taken (OfflineAudioContext WAV, or the MediaRecorder capture of OQ-2 with
the S-STU-09 text) and the container; (6) find every file in the browser's download
location with the default file name of Part 5.14 and a non-zero size; (7) re-import the
`.flm.json` and the `.mid` through Import Music and play 10 s of each; (8) play the
exported audio file in the operating system's media player; (9) if the browser blocks
`a[download]`, confirm the data URL fallback opens a new tab with the save instructions
and that saving from there produces the same file.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-025 | Desktop Chromium | `ref-desktop` | C1, C2, C3 | "Ask where to save each file" off and on (two runs) | all five exports saved with their default names and re-openable (steps 6-8) in every context; any fallback used is recorded and still yields the file |
| XT-026 | Desktop Firefox | `ref-desktop` | C1, C2, C3 | download panel confirmation accepted | as XT-025 |
| XT-027 | Desktop Safari | `ref-desktop` | C1, C2, C3 | Safari may rename unknown extensions; `.flm.json` must keep both suffixes, else the rename is recorded as a defect | as XT-025 |
| XT-028 | iOS Safari | `ref-ios` and `old-ios` | C3, C4 | downloads land in Files > Downloads after the Safari download prompt; step 5 on the 120 s `demo-dance` too; OQ-2 path recorded | as XT-025; the audio export completes without the tab reloading (a reload is the OQ-2 memory failure and selects the MediaRecorder path) |
| XT-029 | Android Chrome | `ref-android` and `low-android` | C1, C3, C4 | downloads land in the Download folder; C1 may refuse downloads from `content://` pages: the fallback of step 9 then applies | as XT-025 |

#### 12.8.8 File import from the delivered file (XT-030..XT-034)

Covers R-P18-10, R-E9-09, R-E9-13, R-P11-01, R-B26.3-01 (per browser); risk RISK-37
(audio codecs per browser).

Setup: the files `midi-multitrack-band.mid`, `midi-tempo-changes.mid`,
`xml-basic-partwise.musicxml`, `mxl-deflate.mxl`, `gp3-basic.gp3`, `gp5-basic.gp5`,
`gp6-file.gpx`, `audio-sine-1s.wav` and `midi-mono-simple.bad-magic.mid` from
`test-corpus/`, plus one valid `.mp3`, one Ogg Vorbis `.ogg` and one `.flac` supplied by
the owner (the generated corpus has no valid compressed audio), copied to the device
(mobile: downloaded through the rule-5 server or the C3 host).

Procedure: (1) Import Music > file picker: the picker opens, every file above is
selectable (none greyed out by the accept list); (2) import each valid file: SCR-ImportInspect
shows the inspection report; play 10 s; (3) `gp6-file.gpx` shows the exact Guitar Pro 6 or
7 refusal sentence of Part 1.5; `midi-mono-simple.bad-magic.mid` shows its E-IMP error
naming the file, and the open project is unchanged; (4) audio files: record per codec
whether the browser decoded it (audio track created) or showed the decode error E-IMP-008
with the sentence that no notes are generated from audio; (5) desktop only: drag each
valid file onto `#app` and repeat step 2 for two of them; (6) import over an open project
with unsaved changes: DLG-ImportReplace appears before anything is replaced.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-030 | Desktop Chromium | `ref-desktop` | C1, C2, C3 | drag and drop from the file manager | every valid file imports and plays in every context; refusals show their exact messages; the codec support line per format is recorded for `docs/COMPATIBILITY.md` |
| XT-031 | Desktop Firefox | `ref-desktop` | C1, C2, C3 | as XT-030 | as XT-030 |
| XT-032 | Desktop Safari | `ref-desktop` | C1, C2, C3 | Ogg Vorbis decode support is recorded, not assumed | as XT-030 |
| XT-033 | iOS Safari | `ref-ios` and `old-ios` | C3, C4 | the picker offers Files and recent items; `.mxl` and `.gp5` must be selectable (accept list check) | as XT-030 without step 5 |
| XT-034 | Android Chrome | `ref-android` and `low-android` | C1, C3, C4 | the picker opens the system file chooser | as XT-030 without step 5 |

#### 12.8.9 WebGL initialization, tier and context loss (XT-035..XT-039)

Covers R-E9-15, R-P14-11, R-I12.1-01..R-I12.1-05, R-E13-06 (per browser), R-P19-05;
risks RISK-45, RISK-62.

Procedure: (1) fresh profile; SCR-FirstLaunch `fl-tier` and SCR-Diagnostics Render show
the context type (WebGL2, WebGL1 or 2D) and the initial tier with its reason; compare with
the expected tier of the device class (Part 9.2.1); (2) Quick Play `demo-poprock` with five
performers for 60 s: the highway is readable, performers animate, no visual corruption;
(3) during play, in the console (on iOS through Web Inspector) run
`var c = document.getElementById('view'); var gl = c.getContext('webgl2') || c.getContext('webgl'); var ext = gl.getExtension('WEBGL_lose_context'); ext.loseContext();`
(`getContext` returns the context the game already created): the HUD shows "Graphics
paused"; music, input and scoring continue; (4) after 1 s call `restoreContext()` on the same extension object: the
stage returns within 3 s; (5) repeat step 3 without restoring: the Abstract tier takes over
after 3 s with a toast naming the switch to the flat visualizer (text per the Part 10.6 code registry), the song continues to the end and SCR-Results opens;
(6) SCR-Settings Video: force each tier High, Balanced, Low, Abstract in turn for 20 s of
play each; no tier change stops, seeks or re-anchors the Transport (the beat indicator
continues without a jump).

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-035 | Desktop Chromium | `ref-desktop` and `low-desktop` | C1, C3 | `low-desktop` expected to start High and auto-downgrade (Part 9.2.1); record the unmasked renderer string | steps 1-6 hold in every context; music never stops during steps 3-6; the tier and context type per device are recorded |
| XT-036 | Desktop Firefox | `ref-desktop` | C1, C3 | `webgl.disabled` set to true for one extra run: the Abstract tier and the toast "3D stage unavailable in this browser; using the flat visualizer." appear, menus and audio work | as XT-035 plus the extra run |
| XT-037 | Desktop Safari | `ref-desktop` | C1, C3 | as XT-035 | as XT-035 |
| XT-038 | iOS Safari | `ref-ios` and `old-ios` | C3 | expected initial tier Balanced | as XT-035 |
| XT-039 | Android Chrome | `ref-android` and `low-android` | C1, C3 | expected Balanced, `low-android` then a downgrade to Low | as XT-035 |

#### 12.8.10 Orientation change (XT-040..XT-042)

Covers R-P14-05, R-P14-08, R-I12-05, E 6.2 and the orientation row of Part 10.8; risk RISK-09.

Procedure: (1) start Instrument Mode on `demo-poprock` Keys intermediate in portrait: the
`#rotate` recommendation appears before the count-in, "Continue in portrait" dismisses it,
and it does not appear again in that mode during the session; (2) during play rotate
portrait -> landscape -> portrait five times, each time at a different point (count-in,
mid-phrase, during a hold, during a chord, while paused); (3) watch the song-time readout
and the beat indicator during each rotation; (4) after each rotation check the pad region
(portrait bottom 28 percent; landscape bottom or right 24 percent per `input.padLayout`)
and the hit line position; (5) repeat steps 2-4 in Dance Mode (portrait design) and in
Studio during playback.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-040 | iOS Safari | `ref-ios` and `old-ios` | C3 | orientation lock off; also with the device orientation locked (no relayout expected) | no rotation stops, pauses, seeks or audibly interrupts playback; the song-time readout continues without a jump; layout is correct within 500 ms of the rotation; no pad stays pressed; the recommendation appears at most once per mode |
| XT-041 | Android Chrome | `ref-android` and `low-android` | C1, C3 | auto-rotate on | as XT-040 |
| XT-042 | iOS Safari (iPadOS) and Android Chrome on a tablet | `tablet` | C3 | split view or a floating window once, if the OS offers it (counts as a resize) | as XT-040 |

#### 12.8.11 Background return (XT-043..XT-047)

Covers R-P14-13, R-P6.3-06, R-E9-14, the B 21.4 rows of Part 10.8; risks RISK-30, RISK-64.

Procedure: (1) Quick Play playing: switch to another tab (desktop) or to the home screen
(mobile) for 5 min; on return SCR-Pause shows "Paused because the game went to the
background"; "Resume" continues from the paused tick with the count-in rules of M-04 and
highway, audio and judgments in step; (2) Studio playback of `demo-jazz` with the tab
hidden for 2 min (RISK-64): record whether playback continued audibly and whether
stutter was heard; on return SCR-Diagnostics Timing shows the last drift check result and,
when the cursor differed by more than 5 ms, an E-AUD-009 entry in the log; (3) Studio
recording in progress: hide the page for 30 s; on return the take is stopped and offered
for review ("Keep take"), the previous take is unchanged; (4) desktop only: switch windows
with Alt-Tab or Cmd-Tab while holding a lane key: the note is released, play does not
pause; (5) after return from each case, SCR-Diagnostics Audio shows active voices equal to
the voices actually sounding (0 when paused).

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-043 | Desktop Chromium | `ref-desktop` | C1, C3 | Memory Saver or tab discarding left at default; a discarded tab reloads and must offer DLG-RecoverCheckpoint for the dirty project | steps 1-5 hold; no stuck note; no automatic resume; the observed background playback behavior of step 2 is recorded |
| XT-044 | Desktop Firefox | `ref-desktop` | C1, C3 | as XT-043 | as XT-043 |
| XT-045 | Desktop Safari | `ref-desktop` | C1, C3 | as XT-043 | as XT-043 |
| XT-046 | iOS Safari | `ref-ios` and `old-ios` | C3 | the page may be evicted after 5 min in the background: then the next open must offer the recovery copy (S-STO-01) for a dirty project | as XT-043 |
| XT-047 | Android Chrome | `ref-android` and `low-android` | C1, C3 | as XT-046 | as XT-043 |

#### 12.8.12 Screen lock and power saving (XT-048..XT-052)

Covers R-E9-14, R-I12-10 (resume part), R-P19-04; Part 10.8 rows "Screen lock or power
saving" and "Audio context suspended"; risk RISK-30.

Procedure: (1) Quick Play playing; lock the screen (mobile power button; desktop Win+L,
Ctrl+Cmd+Q or the desktop environment's lock shortcut) for 1 min, then unlock; (2) the
game is paused; when the audio context is not running, DLG-ResumeAudio appears; "Resume
sound" (a gesture) resumes the audio and the user resumes the song from SCR-Pause at the
frozen tick; (3) repeat with a 5 min lock; (4) Studio recording during the lock: take
stopped and kept for review; (5) mobile only: enable the battery saver or Low Power Mode
and play 60 s: playback continues, any tier change is announced by toast; (6) mobile only:
receive a phone call or start a voice assistant during play (audio interruption while
visible): DLG-ResumeAudio with E-AUD-007 only after a failed resume.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-048 | Desktop Chromium | `ref-desktop` | C1, C3 | steps 1-4 | the game is paused after every lock; resuming continues from the frozen tick with audio and highway in step; no stuck note; the take of step 4 is kept for review and the previous take is unchanged |
| XT-049 | Desktop Firefox | `ref-desktop` | C1, C3 | steps 1-4 | as XT-048 |
| XT-050 | Desktop Safari | `ref-desktop` | C1, C3 | steps 1-4 | as XT-048 |
| XT-051 | iOS Safari | `ref-ios` and `old-ios` | C3 | steps 1-6; the AudioContext state `interrupted` is expected on iOS | as XT-048 plus steps 5-6 |
| XT-052 | Android Chrome | `ref-android` and `low-android` | C1, C3 | steps 1-6 | as XT-048 plus steps 5-6 |

#### 12.8.13 Web MIDI availability message (XT-053..XT-057)

Covers R-E9-10, R-E9-18, R-P4-10, Part 1.5 Web MIDI row; risk RISK-50.

Procedure: (1) SCR-Settings Controls, MIDI device row: where `Caps.webMidi` and
`Caps.secureContext` are both true the row is enabled, otherwise it is disabled and shows
the exact E-INP-001 sentence "MIDI devices are not available here. Web MIDI needs a
supporting browser and a secure page (https:// or localhost). Keyboard, touch and gamepad
controls are unaffected."; (2) no permission prompt appears at launch or on any screen
before the user turns MIDI input on; (3) where enabled and a USB MIDI keyboard is
available: turn MIDI input on, accept the prompt, play 10 notes and a chord in Free Play
(they sound and light the lanes), then unplug the device: toast E-INP-006, held notes
released; (4) in every context the four-button keyboard and touch play of XT-001 step 5
works whether or not MIDI is available; (5) SCR-Help shows the same Web MIDI sentence.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-053 | Desktop Chromium | `ref-desktop` | C1, C2, C3, C4 | expected enabled on C2 and C3, disabled with the sentence on C4; C1 recorded as observed | the row state matches `Caps.webMidi && Caps.secureContext` as shown in SCR-Diagnostics Capabilities in every context; steps 2-5 hold; with no MIDI device available step 3 is recorded "not run: no device" and the row may still pass |
| XT-054 | Desktop Firefox | `ref-desktop` | C1, C2, C3, C4 | Firefox gates Web MIDI behind a site permission; the observed availability is recorded | as XT-053 |
| XT-055 | Desktop Safari | `ref-desktop` | C1, C2, C3 | expected disabled with the sentence in every context (`requestMIDIAccess` absent) | as XT-053 |
| XT-056 | iOS Safari | `ref-ios` | C3, C4 | expected disabled with the sentence | as XT-053 |
| XT-057 | Android Chrome | `ref-android` | C1, C3, C4 | expected enabled on C3; a USB-OTG MIDI keyboard if available | as XT-053 |

#### 12.8.14 WebRTC availability (XT-058..XT-062)

Covers R-B26.7-04, R-P13-12, R-P18-07, R-E9-04 (multiplayer part), Part 1.4 rules 2-4.

Procedure: (1) SCR-MainMenu: Multiplayer is enabled, or disabled with E-CAP-005
"Multiplayer needs WebRTC, which this browser does not provide." when `RTCPeerConnection`
is missing; (2) SCR-Multiplayer: the "How this works" panel shows the Standalone edition
sentence and the privacy statement (S-NET-01); (3) with STUN off, create a Synchronized
Play room: the invite code appears within 3 s of "Create"; record its length in
characters; "Copy" places it on the clipboard; (4) open the same URL in a second window
(or a second browser on the same computer or device), join with the pasted invite, paste
the answer back: both lobbies show two players; start a song and play 30 s; (5) turn the
STUN toggle on with the network disconnected: within 3 s of gathering the lobby shows "STUN
server not reachable; connections may only work on the same network." and an invite code
is still produced; (6) close one window during play: the other shows DLG-NetError or the
disconnected state of Part 10.8 and every local mode still works afterwards (enter Quick
Play and play 10 s).

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-058 | Desktop Chromium | `ref-desktop` | C1, C3 | step 4 between two windows of the same profile | steps 1-6 hold in every context; no network request is made while STUN is off (Network panel and rule 10) |
| XT-059 | Desktop Firefox | `ref-desktop` | C1, C3 | `media.peerconnection.enabled` at default; one extra run with it set to false must show the E-CAP-005 disabled entry while every other entry stays enabled | as XT-058 plus the extra run |
| XT-060 | Desktop Safari | `ref-desktop` | C1, C3 | as XT-058 | as XT-058 |
| XT-061 | iOS Safari | `ref-ios` | C3 | step 4 with a second device (Desktop Chromium on the same LAN) | as XT-058 |
| XT-062 | Android Chrome | `ref-android` | C1, C3 | step 4 with a second device (Desktop Firefox on the same LAN) | as XT-058 |

#### 12.8.15 Two-device multiplayer sessions (XT-063..XT-064)

Covers R-B26.7-01, R-B26.7-02, R-B26.7-03, R-P13-03, R-P13-04; resolves OQ-3; risks
RISK-07, RISK-48, RISK-55, RISK-56.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-063 | Desktop Chromium host, Android Chrome guest | `ref-desktop`, `ref-android` on one Wi-Fi LAN | host C1, guest C3 | STUN off. Synchronized Play on `demo-poprock` Keys intermediate. Exchange the invite and the answer through a chat app on the phone and through e-mail to the desktop (codes may be line-wrapped by the apps). SCR-Multiplayer shows each player's name, instrument and avatar; SCR-Diagnostics Network on both shows RTT, offset and jitter. Start: count-in on both devices. Play to the end. Then repeat the start and switch the guest's Wi-Fi off for 20 s mid-song and back on | the codes decode after the round trip through both apps (or show the damaged-code message with the character count, never a silent failure); the sync badge reads "good"; the tester standing between the devices hears the two count-ins as one click (Part 9.1.2 row 36); both SCR-Results show the host's scores; after the Wi-Fi gap the guest rejoins within 60 s with its slot and score, or ends with results marked "Disconnected"; no local project, setting or history is changed on either device |
| XT-064 | Desktop Firefox host, iOS Safari guest | `ref-desktop`, `ref-ios` | host C3, guest C3 | Cooperative Band on `demo-jazz` (host piano, guest bass). Run 1: STUN off, same LAN. Run 2: STUN on, same LAN. Run 3: STUN on, the phone on mobile data (different network). Run 4: host closes the browser mid-song | runs 1 and 2 connect and finish the song in sync as in XT-063; run 3 either connects or shows DLG-NetError with the same-network hint within the gathering timeout, and the result is recorded as the OQ-3 outcome in the LEDGER; run 4 shows the guest "The host has left. The session has ended; here are the results so far." and SCR-Results |

#### 12.8.16 Test build self-test and device scenarios (XT-065..XT-069)

Covers R-B25.5-01..R-B25.5-07, R-P20-06, R-P20-07, R-P17-14, R-P14-12; risks RISK-01, RISK-05,
RISK-62, RISK-67, RISK-73. These rows are how the in-page automated suite and the Part 9.7
device scenarios reach the non-Chromium browsers and the physical devices.

Procedure: (1) open `FingerLickinMusic.test.html` (C1 on desktop and Android, C3 on iOS);
(2) SCR-Diagnostics "Run self-test": wait for the summary line "{passed} of {total}
passed"; copy the results table; (3) "Run performance scenarios" (9.7.5) on the device's
assigned tier: copy the result JSON (`environment: "device"`); for the touch variant of
`input-latency` tap the four pads 50 times; (4) cold-load procedure of 9.7.5 for Load
and TTI with the shipped file; (5) memory reading by the method of Part 9.1.1 item 6 at
120 s of `demo-poprock` (task manager, Web Inspector or the remote Memory panel); (6) the
owner sends the JSON, the self-test table and the readings to the session, which
transcribes them into the Part 9.2 matrix row and STATUS.md section 7 and stores the JSON
verbatim in the LEDGER entry of the day.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-065 | Desktop Chromium | `ref-desktop` and `low-desktop` | C1 | headed browser, not headless | every self-test passes, including the fixed-vector and determinism tests UT-01-22, UT-01-24 and UT-08-22 (so generated charts and hashes match the reference values in this browser); the scenario JSON is complete and transcribed; budget pass or fail is then judged per Part 9.2.3 rule 4 (the PT gate), not by this row |
| XT-066 | Desktop Firefox | `ref-desktop` | C1 | as XT-065 | as XT-065 |
| XT-067 | Desktop Safari | `ref-desktop` | C1 | as XT-065 | as XT-065 |
| XT-068 | iOS Safari | `ref-ios`, `old-ios`, `tablet` | C3 | Low Power Mode off; memory through Web Inspector | as XT-065; the mobile memory reading (Part 9.1.2 row 19) is recorded with its method |
| XT-069 | Android Chrome | `ref-android`, `low-android` | C1 | battery saver off; memory through `chrome://inspect` | as XT-068 |

#### 12.8.17 Further cross-device checks (XT-070..XT-076)

Rows below run on several browsers; the result is recorded per browser line exactly like
the rows above, and each browser line counts toward that browser's XT pass under Part 1.6.

| ID | Browser | Device class | Contexts | Browser-specific steps and expectations | Pass criterion |
|---|---|---|---|---|---|
| XT-070 | All five, at the Part 1.6 floor versions (Chromium 110, Firefox 115 ESR, Safari 16.4, iOS Safari 16.4, Android Chrome 110) | any class that runs the floor version | C1 (desktop), C3 (mobile) | open the shipped file; boot to SCR-MainMenu; play Quick Play 30 s; open SCR-Studio and SCR-Settings | no `#fatal` panel (in particular not E-CAP-004 "This browser is too old to run Finger Lickin Music."), no uncaught exception; when a floor version cannot be obtained the line is "not run: version not available" and `docs/COMPATIBILITY.md` states the lowest version actually tested instead of the floor (risk RISK-66) |
| XT-071 | Desktop Chromium, Firefox, Safari | `ref-desktop` with the OS keyboard layout set to French AZERTY, then German QWERTZ | C1 | Instrument Mode with the default lanes: play by physical key position (the keys printed Q S K L on AZERTY); remap one lane; hold a lane key and switch windows | lanes respond to the physical positions of `KeyA KeyS KeyK KeyL` (event `code`); remapping captures the pressed key; the held note releases on the window switch (risk RISK-39) |
| XT-072 | iOS Safari | `ref-ios`, `old-ios` | C3 | ring and silent switch set to silent; start Quick Play; then switch to ring | where `navigator.audioSession` exists the game is audible with the switch on silent; otherwise the result "silent with switch on silent" is recorded and SCR-Help shows "No sound on iPhone or iPad? Check that the ring and silent switch is not set to silent, and raise the volume." (risk RISK-71) |
| XT-073 | Desktop Chromium, iOS Safari, Android Chrome | `ref-desktop`, `ref-ios`, `ref-android` | C1 or C3 | outputs: built-in speaker, wired headphones, a Bluetooth headset. For each: run DLG-Calibration to its summary; record `Audio.latency()` and the two saved values; during play connect and disconnect the headphones | playback continues with the output-change toast when the context stays running, or DLG-ResumeAudio when it suspends (Part 10.8); the wizard completes for each output and the values are recorded in the 9.2 Notes (risks RISK-63, RISK-76) |
| XT-074 | All three desktop browsers | `ref-desktop` | C2, C3 | open the same project in Studio in two tabs | the second tab opens read-only with the "Project open in another tab" dialog; "Take over" makes the first tab read-only within 2 s (storage event); no edit from the read-only tab reaches storage (risk RISK-43) |
| XT-075 | iOS Safari, Android Chrome | `ref-ios`, `ref-android`, `tablet` | C3 | with the inspector read `getBoundingClientRect()` of `#pad-0` to `#pad-3`, of the `#touch` region and of the SCR-MainMenu buttons at `input.padSize` small, medium and large, portrait and landscape (`bottom` and `right`) | every pad >= 56 x 56 CSS px with >= 8 px gaps; region height (portrait) or width or height (landscape) within 1 px of 28 or 24 percent of the viewport after the safe-area insets (Part 9.1.2 row 43); menu targets >= 56 x 56 on touch layouts |
| XT-076 | All five | `ref-desktop` (window 1280 x 800 at 100 and 200 percent browser zoom), `ref-ios`, `ref-android` | C1 or C3 | `video.uiScale` 0.8, 1.0 and 1.5 (Part 5.11 range) in both orientations on phones; visit SCR-MainMenu, SCR-Settings, SCR-Studio, SCR-Results and the Instrument HUD | no horizontal page scroll, no clipped or overlapping text or controls on any visited screen at any scale; at 1.3 and above on phones the multi-column grids collapse to one column (Part 7.5.5) |

#### 12.8.18 XT coverage by browser

A browser is published Supported only when every XT ID in its column passes (Part 1.6
policy 1); "-" means the capability does not apply to that browser.

| Capability | Desktop Chromium | Desktop Firefox | Desktop Safari | iOS Safari | Android Chrome |
|---|---|---|---|---|---|
| Open, boot, offline core | XT-001 | XT-002 | XT-003 | XT-004 | XT-005 |
| Audio unlock | XT-006 | XT-007 | XT-008 | XT-009 | XT-010 |
| Four simultaneous touches (OQ-1) | - | - | - | XT-011, XT-012, XT-013 | XT-014, XT-015 |
| Touch release lifecycle | - | - | - | XT-016, XT-017 | XT-018, XT-019 |
| IndexedDB and localStorage | XT-020 | XT-021 | XT-022 | XT-023 | XT-024 |
| Download and export | XT-025 | XT-026 | XT-027 | XT-028 | XT-029 |
| File import | XT-030 | XT-031 | XT-032 | XT-033 | XT-034 |
| WebGL init, tier, context loss | XT-035 | XT-036 | XT-037 | XT-038 | XT-039 |
| Orientation change | - | - | - | XT-040, XT-042 | XT-041, XT-042 |
| Background return | XT-043 | XT-044 | XT-045 | XT-046 | XT-047 |
| Screen lock and power saving | XT-048 | XT-049 | XT-050 | XT-051 | XT-052 |
| Web MIDI availability message | XT-053 | XT-054 | XT-055 | XT-056 | XT-057 |
| WebRTC availability | XT-058 | XT-059 | XT-060 | XT-061 | XT-062 |
| Two-device sessions | XT-063 | XT-064 | - | XT-064 | XT-063 |
| Self-test and device scenarios | XT-065 | XT-066 | XT-067 | XT-068 | XT-069 |
| Floor versions | XT-070 | XT-070 | XT-070 | XT-070 | XT-070 |
| Non-US keyboard layouts | XT-071 | XT-071 | XT-071 | - | - |
| Ring and silent switch | - | - | - | XT-072 | - |
| Output changes and calibration | XT-073 | - | - | XT-073 | XT-073 |
| Same project in two tabs | XT-074 | XT-074 | XT-074 | - | - |
| Touch targets measured | - | - | - | XT-075 | XT-075 |
| UI scale and zoom | XT-076 | XT-076 | XT-076 | XT-076 | XT-076 |

### 12.9 Live manual tests (LT-001..)

LT tests need human perception or judgment: eyes for alignment, readability and visual
quality, ears for timbre, clicks and synchronization, hands for gestures and feel, and
reviewers for wording and documentation. They complement the automated suite (12.3-12.7)
and never replace an automated test where one exists.

#### 12.9.1 Rules for every LT test

1. Artifact and recording. The shipped `FingerLickinMusic.html` of the release candidate
   (SHA-256 recorded as in 12.8.1 rule 1), opened in context C1 on desktop and Android and
   C3 on iOS unless the row says otherwise. Each run records tester, date, device class and
   model, OS build, browser version, file hash, result ("pass", "fail: <reason>", "not
   run") and a findings list.
2. Testers. The owner, or testers the owner names. The implementing session runs no LT row
   on a physical device (Part 0.6); rows whose Device(s) cell says "screenshots allowed"
   may be pre-reviewed by the session from Playwright screenshots of the test build, recorded
   "pre-check (screenshots)", which never fills a release cell.
3. Listening conditions. Audio rows use closed-back wired headphones at a comfortable level
   in a quiet room unless the row names speakers or a Bluetooth output. Rows that compare
   with a reference player name it in the findings.
4. Video evidence. Rows that judge timing by eye use a screen recording at 60 frames per
   second (desktop) or a second phone filming at 240 frames per second (mobile); the clip
   name is written in the findings, the clip itself is kept by the owner (not committed).
5. Findings. Each finding gets a severity by Part 13.2 and, when Medium or higher, a
   STATUS.md section 6 defect. A row passes only when its pass criterion holds and no
   finding of severity High or Critical is open against it; Low and Medium findings are
   recorded and do not fail the row unless the criterion names them.
6. Default inputs. "Keyboard" means the default keys of the brief (lanes `KeyA KeyS KeyK
   KeyL`, dance arrows), "touch" means the on-screen pads at `input.padSize` medium,
   "gamepad" means a standard-mapping controller (an Xbox or PlayStation controller over
   USB or Bluetooth).
7. Content. Rows use the built-in content (`demo-poprock`, `demo-piano`, `demo-electro`,
   `demo-jazz`, `demo-dance`, `tut-basics`), files from `test-corpus/`, and, where a row
   says "real files", files the owner supplies; real files are never committed (licensing).
8. Calibration. Unless a row tests calibration, the tester runs DLG-Calibration once per
   device and output before the first timing row and keeps the result.

#### 12.9.2 Launch, onboarding and navigation (LT-001..LT-007)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-001 | Launch and onboarding | `ref-desktop`, Desktop Chromium, C1 | fresh profile; network off; stopwatch | (1) open the file and start the stopwatch; (2) press "Start" as soon as it is enabled; (3) choose Keyboard, "Continue"; (4) choose "Play a demo song"; (5) play to the end | one setup screen with three steps; sound starts at "Start"; the demo begins with an audible count-in; SCR-Results opens at the end | count-in starts within 5 s of the file open (B 20.1, R-P1-05) when the tester acts at once; the tester needs no help text to finish; no step asks for a permission (R-P4-10) |
| LT-002 | Launch and onboarding | `ref-ios` Safari C3; `ref-android` Chrome C1 | fresh profile; stopwatch | as LT-001 with Touch chosen in step 3 | as LT-001; the pads appear in the portrait layout; the first tap on "Start" turns sound on (RISK-02) | count-in starts within 8 s of the file open; sound is heard on the first attempt on both devices |
| LT-003 | Launch and onboarding | `ref-desktop` Chromium; `ref-android` Chrome | LT-001 or LT-002 completed with master volume 60 percent and reduced motion on | (1) reload; (2) open SCR-Help and start the tutorial from there; (3) open SCR-Settings | SCR-MainMenu opens directly without setup; the tutorial is reachable from SCR-Help; the first-launch choices are kept | no setup screen for the returning user; volume 60 percent and reduced motion still set (R-P4-11, R-P4-12) |
| LT-004 | Tutorial | `ref-desktop` with keyboard; `ref-desktop` with a gamepad; `ref-android` with touch | onboarding reset ("Show first-launch setup again") | (1) choose "Learn the basics"; (2) complete every step; (3) use "Repeat" once on step 2 and "Skip" once on step 5; (4) perform the two-lane simultaneous press step | prompts show A S K L on keyboard, the pads on touch and the controller buttons on gamepad; judgments are the real ones; Skip and Repeat exist on every step | a tester new to the game finishes on each of the three inputs without outside help in about 3 minutes (no more than 6); every step offers Skip and Repeat (R-P4-05 to R-P4-08) |
| LT-005 | Navigation | `ref-desktop` Chromium; `ref-android` Chrome | none | (1) open each of the 12 main-menu entries in turn; (2) return from each with Escape, then with browser back, then with the on-screen Back (Android: also the system back gesture); (3) during gameplay press back once and twice | the 12 entries in the brief's order, Quick Play first and focused; each mode reached in at most two transitions; back returns one screen; in gameplay the first back opens SCR-Pause | every mode reached in <= 2 transitions (R-P3-04); no back action skips a screen; gameplay is never left without SCR-Pause (R-P3-05, R-P3-12) |
| LT-006 | Navigation | `ref-desktop` Chromium | a Studio project with 3 unsaved edits | try to leave by (1) the menu, (2) browser back, (3) opening another project, (4) importing a file, (5) "New project" | DLG-UnsavedChanges or DLG-ImportReplace each time, with the consequence text of Part 7.7 | no path discards the edits without a dialog (R-P3-06, R-P11-13); "Cancel" keeps the project open and dirty; the dialog texts name what is lost (R-P21-09) |
| LT-007 | Discoverability | `ref-desktop` Chromium | a tester who has not used the game; SCR-Help closed | find, without being told where: (a) the calibration wizard, (b) the loop region, (c) MIDI export, (d) key remapping, (e) the Dance Mode explanation | contextual help and the "Advanced" groups lead to each feature; SCR-FirstLaunch and SCR-Help explain Instrument Mode, Free Play, Studio and Dance Mode in one sentence each | each of (a)-(e) found within 60 s (R-P1-06, R-P4-09) |

#### 12.9.3 Visual quality and layout (LT-008..LT-016)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-008 | Layout | `ref-desktop` Chromium device emulation at 360 x 640, 390 x 844, 844 x 390, 768 x 1024, 1024 x 768, 1366 x 768, 1920 x 1080 (screenshots allowed) | a project with an 80-character track name and a 24-character character name | visit every SCR-* screen and open every DLG-* dialog at each viewport; take a screenshot of each | no misaligned icon, text, panel or control; no clipping or overlap; long names end with "..." and show the full text in the tooltip; no horizontal scroll; every panel has its empty state | zero findings of clipped, overlapping or misaligned elements across all screenshots (R-P2.2-01 to R-P2.2-05, R-P2.2-09) |
| LT-009 | Layout, gameplay | `ref-ios` and `ref-android`, portrait and landscape | Instrument Mode `demo-poprock` Keys intermediate | (1) play 60 s in each orientation and each camera preset; (2) open and close the pause screen; (3) trigger a toast (save in Studio, then enter play) | the highway hit zone and incoming notes are never covered by a panel, toast, effect or performer; HUD readable | no frame in the recording shows the hit line or an incoming note covered (R-P5.2-04, R-P7.1-05, R-P7.3-07) |
| LT-010 | Safe areas and browser bars | `ref-ios` with a notch or Dynamic Island; `ref-android` with gesture navigation | none | (1) visit SCR-MainMenu, a dialog, the HUD and the pads in both orientations; (2) scroll a list so the browser bars hide and show; (3) rotate | top bars, HUD, pads and dialog buttons stay inside the safe areas; the browser bars never cover a control (dvh layout) | no essential control under the notch, the home indicator or a browser bar in any state (R-P14-06, R-P14-07) |
| LT-011 | Visual identity | `ref-desktop` Chromium and `ref-android`; screenshots of LT-008 | the Part 7.1 rules at hand | review every screen against Part 7.1: one visual direction, tokens only, no decorative gradients or blur, effects only on musical events, one primary action per screen, Title Case titles and sentence case labels, glossary terms, distinct focus, hover, pressed, selected, disabled and loading states | a consistent product look across menus, stage, editor and HUD | no High finding; every Medium finding becomes a defect (R-P2.1-01 to R-P2.1-08, R-P2.2-08, R-P2.3-01 to R-P2.3-06) |
| LT-012 | Transitions | `ref-desktop` (60 fps screen recording); `ref-android` (240 fps camera) | none | (1) switch between five modes ten times; (2) open and close each Studio panel and each settings group; (3) step through the recording frame by frame | cross-fade between modes; panels overlay or use reserved space | no blank, white or unstyled frame and no content jump in any transition (R-P2.2-06, R-P2.2-07) |
| LT-013 | Contrast | `ref-desktop` Chromium with the developer tools contrast picker | default and high-contrast token sets; every stage theme | measure text over each stage theme (bright and dark), HUD labels, menu text, focus ring, slider tracks, text-field boundaries and toggle states | text >= 4.5:1 (>= 3:1 for large text); non-text indicators >= 3:1 (Part 10.5 targets) | every measured pair meets its target; the list of measured pairs and ratios is recorded (R-P2.1-09, R-P15-02) |
| LT-014 | Non-color cues | `ref-desktop` and `ref-android` with the OS grayscale filter on | none | play Instrument Mode and Dance Mode 60 s each; take screenshots of the highway, the pads, a judgment, SCR-Results and a compatibility badge | lanes distinguished by glyph and position, directions by arrows, judgments by word and flash shape, status by icon and word | a second person identifies every lane, direction and judgment from grayscale screenshots alone (R-P15-04, RISK-68) |
| LT-015 | Note readability | `ref-desktop` and `ref-ios` | Instrument `demo-jazz` piano advanced; Dance `demo-dance` hard | play 30 s at note speed x0.5 (3,000 ms lead) and 30 s at x2.5 (600 ms lead); screenshot chords and holds | notes and arrows readable at both speeds; chords joined by a bar; hold tails match the duration | measured note height >= 24 CSS px in the screenshots; the tester reads every chord before it reaches the line at both speeds (R-P5.2-01 to R-P5.2-03, R-P12-01) |
| LT-016 | Asset sharpness | `ref-desktop` at DPR 2; `ref-ios` (DPR 3) | none | inspect icons, lane glyphs, HUD text and canvas text closely | crisp edges at the device pixel ratio; no blurry or stretched element | no blurred or distorted asset found (R-P2.2-10) |

#### 12.9.4 Gameplay feel and timing (LT-017..LT-030)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-017 | Audio-visual alignment | `ref-desktop` Chromium, wired headphones | calibration done (rule 8) | (1) Instrument Mode `demo-electro` Arp expert, watch without playing for 30 s; (2) repeat at practice speed 0.75; (3) record the screen with audio and step through 20 notes | each note reaches the hit line when its sound is heard | in the recording every checked note is at the hit line within 1 frame (16.7 ms) of its audible onset after the calibrated audio latency (R-B26.2-03, R-P6.3-07) |
| LT-018 | Audio-visual alignment, mobile | `ref-ios` Safari and `ref-android` Chrome with the built-in speaker and with a Bluetooth headset | calibration run separately for each output | as LT-017 steps 1-2 on each output | as LT-017; with Bluetooth the alignment holds only after its own calibration | the tester perceives notes and sound together on each output after calibration (RISK-40); the wizard values per output are recorded |
| LT-019 | Calibration predictability | `ref-desktop` Chromium; `ref-android` Chrome | an experienced rhythm-game tester | (1) set both offsets to 0 and play `demo-poprock` Keys beginner; (2) run DLG-Calibration, save, play again; (3) tap deliberately unevenly in the wizard | after calibration most hits are Perfect or Great; uneven tapping shows S-CAL-02 and too few taps S-CAL-01 | >= 80 percent of judgments Perfect or Great in step 2; the result screen of step 2 lists the offsets used; the quality messages appear in step 3 (R-B26.2-04, R-P5.1-10, R-P5.3-07) |
| LT-020 | Press feedback | `ref-desktop` (keyboard, 60 fps screen recording); `ref-ios` and `ref-android` (240 fps camera filming the screen) | Free Play, profile A | tap each pad and press each lane key 10 times; count frames from contact (or key travel end) to the highlight | pad and receptor highlight in the next rendered frame; pressed and released looks clearly differ | every highlight visible within 50 ms of contact in the clip (12 frames at 240 fps, 3 frames at 60 fps) (R-P1-01, R-P5.1-01, R-P5.1-02) |
| LT-021 | Live input-to-sound feel | `ref-desktop` wired output; `ref-ios` and `ref-android` speaker and wired | Free Play, program 115 (Woodblock) | (1) tap 20 times; (2) record the tap noise and the game sound with an external microphone; (3) measure each gap in an audio editor | the sound feels immediate; the gap is the device output latency plus at most one frame of processing (Part 9.1.2 row 17) | the tester rates the response as immediate on desktop wired output; the median gap per device and output is recorded in the 9.2 Notes (RISK-76); output latency is recorded, not gated (row 17) |
| LT-022 | Judgment feedback | `ref-desktop`; `ref-android` | Instrument `demo-poprock` Bass intermediate | play deliberately early, late, on time and miss notes; reach combos 10, 20 and 30 | "Perfect", "Great", "Good", "Miss" as words with distinct flash shapes in the frame after the judgment; combo pulse only at 10, 20, 30; a miss shows a muted flash and lane hint | every judgment visible as word and shape; no pulse except at multiplier changes; no screen shake or harsh sound on a miss (R-P5.2-06, R-P5.2-08, R-P5.2-09) |
| LT-023 | Keyboard chords and rollover | `ref-desktop` laptop keyboard and an external USB keyboard; macOS and Windows | Free Play, profile C | press `KeyA KeyS KeyK KeyL` together 20 times, then together with `KeyE` (octave) | four notes per press where the keyboard hardware allows | 20 of 20 four-key presses register on at least one tested keyboard per OS; keyboards that drop keys are listed with their model in `docs/COMPATIBILITY.md` as a hardware limit (R-B26.2-02 documented limits) |
| LT-024 | Touch play feel | `ref-ios` and `ref-android`, portrait and landscape | Instrument `demo-poprock` Rhythm Guitar advanced | play 2 min per orientation: fast alternation, slides between pads, chords | presses register as played; nothing sticks | no stuck note at song end; the tester reports no missed presses beyond their own errors; Diagnostics held controls 0 after the song (R-B26.2-05, RISK-09) |
| LT-025 | Accidental navigation | `ref-ios` Safari; `ref-android` Chrome | Instrument play running | during play: (1) iOS edge swipe back; (2) Android back gesture and back button; (3) pull down on the highway; (4) pinch on the stage; (5) double-tap a pad; (6) long-press a pad | (1)-(2) open SCR-Pause instead of leaving; (3)-(6) do nothing: no refresh, no zoom, no text selection or callout | no step leaves the mode, reloads, zooms or shows a callout (R-I12-11) |
| LT-026 | Gamepad | `ref-desktop` Chromium and Firefox with a standard controller | controller connected before boot and once after | (1) Instrument play with face buttons; (2) pause with start, panic with select; (3) Free Play octave with LB and RB; (4) Dance with the d-pad; (5) disconnect the controller while holding a lane | the Part 10.5.2 mapping in every context; step 5 pauses with "Controller disconnected. Reconnect it or use another input, then resume." | every action of 10.5.2 works on both browsers; step 5 pauses and releases the held note (R-P1-11, R-P15-01) |
| LT-027 | Free Play musicality | `ref-desktop`; `ref-android` | Free Play; a chromatic tuner app on a phone | (1) for 3 keys (C, F sharp, B flat) and 3 scales (major, natural minor, dorian) in profile D, press each lane and read the tuner; (2) profile C: play I-IV-V-I with each inversion; (3) octave keys up and down to the range ends; (4) hold notes with the Sustain toggle; (5) change instrument while holding | every lane plays the pitch its label names; inversions sound as labeled; octave shifts by 12 semitones within MIDI 0-127; held notes of the old instrument stop at the change | every checked pitch matches its label; no note of the old instrument keeps sounding after step 5 (R-P9-01 to R-P9-03, R-P9-08, R-P9-09, R-P9-12) |
| LT-028 | Difficulty and musical intent | `ref-desktop` | an experienced musician as reviewer | for each of the five demos play one melodic track at beginner and at expert, then solo the source track in Studio | beginner keeps the melodic contour and sections; expert adds density and chords from the source | the reviewer finds no invented notes and no lost contour on any of the ten charts; each difficulty preview shows notes per second, chord ratio and window (R-P5.3-01 to R-P5.3-03) |
| LT-029 | Practice tools | `ref-desktop`; `ref-ios` | Instrument `demo-jazz` Bass advanced | (1) set a loop on one section and practice speed 0.5; play 4 loops; (2) switch the judgment preset to Relaxed; finish the song | the loop repeats seamlessly; judgments still follow song time; SCR-Results shows the "Practice settings" badge; personal bests ignore the result | badge shown and the result excluded from personal bests (R-P5.3-05, R-P5.3-06, R-P5.3-08) |
| LT-030 | Pause and restart | `ref-desktop`; `ref-android` | Instrument play | (1) pause mid-song; press lane keys and pads while paused; (2) resume; (3) pause and choose Restart | (1) nothing sounds or is judged, panic still works; (2) continues from the paused tick; (3) score 0, count-in, tick 0 | no judgment while paused; restart starts a fresh ScoreState (R-P5.2-10 to R-P5.2-12, R-P5.1-11) |

#### 12.9.5 Audio quality (LT-031..LT-042)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-031 | Instrument families | `ref-desktop` Chromium, headphones; repeated on `ref-android` speaker | Free Play | for each of the 16 GM families pick its first program and two others (48 programs): play a one-octave scale, a sustained chord and a fast repeated note at soft and loud velocity; then play the 12 drum voices with profile F | each family sounds like its family and differs from the others; sustained families hold; plucked ones decay; drums recognizable | the reviewer marks all 16 families as fitting and distinct and all 12 drum voices as recognizable; a family marked unrecognizable is a High defect because P 6 is release-critical (R-P6-01, R-P6.1-02, R-P6.1-06, RISK-61) |
| LT-032 | Demo content | `ref-desktop` headphones; a second listener | none | listen to all five demos and the tutorial song in full; compare with any melody the listeners recognize | coherent, balanced arrangements; no melody recognizable as an existing work | both listeners report no recognizable existing melody; no balance finding of High severity (R-P21-19, RISK-69) |
| LT-033 | Clicks and pops | `ref-desktop` headphones; `ref-ios` headphones | `demo-electro` (sustained pad) | perform 10 times each: start, stop, pause, resume, seek, loop wrap on a sustained pad chord, mute and unmute, solo and unsolo, master and track volume sweeps, panic, mode leave during play, Library audio preview start and stop | every transition is smooth | no audible click, pop or level spike in any of the 120 transitions (R-P6.2-05, R-P6.2-06, R-P21-06, RISK-70) |
| LT-034 | Dense passages | `ref-desktop` headphones; `ref-android` (32-voice cap) | master volume 100 percent | play the `demo-poprock` chorus, `midi-poly-chords.mid` and `midi-drums-heavy.mid` from `test-corpus/`; set every track gain to maximum in Studio | full but undistorted sound; voice stealing inaudible as clicks | no audible distortion or crackle on either device; Diagnostics shows active voices at or below the cap (R-P6.2-04, R-P6.1-10, RISK-10) |
| LT-035 | Stuck notes | `ref-desktop`; `ref-android` | `demo-piano` (CC 64 sustain) and Free Play with Sustain on | in each of Quick Play, Instrument, Free Play, Studio playback, Studio recording, Dance, Tutorial and a multiplayer song: while chords sustain, do each of stop, leave mode, panic, change instrument and seek; listen 3 s after each | sound ends within the instrument's release each time | 40 of 40 cases silent after the release; Diagnostics active voices 0 within 350 ms (R-E13-02, RISK-04) |
| LT-036 | Real-world MIDI | `ref-desktop` headphones; the OS or a DAW as reference player | real files: a band arrangement with drums, a piano piece with sustain and tempo changes, an orchestral file with program changes | import each, read SCR-ImportInspect, play it in full in the game and in the reference player | same parts, same tempo changes, chords intact, each track on its program | no missing or extra part, tempo changes at the same bars, every chord complete, every track's program as in the reference (R-B26.3-01 to R-B26.3-04, RISK-03) |
| LT-037 | Long loop by ear | `ref-desktop` headphones | `demo-jazz`, a 4-bar loop, metronome on | listen at the start, at 5 min and at 10 min of continuous looping; watch the beat indicator against the click | click, music and highway stay together | no audible or visible drift at 10 min (R-B26.3-05, R-P6.3-02) |
| LT-038 | Metronome and count-in | `ref-desktop`; `ref-ios` | a reference metronome app on a second device | (1) metronome at 60, 120 and 200 BPM, accent on beat 1; (2) count-in 1 bar and 2 bars before recording; (3) run the game metronome and the reference at 120 BPM together for 2 min | steady clicks, accented downbeats, the configured count-in length | no audible phasing against the reference over 2 min; count-in length as configured (R-P9-07, R-P10-02, RISK-63) |
| LT-039 | Mixer | `ref-desktop` headphones | Studio with the `demo-poprock` tracks | move master, metronome and track gain; pan the bass hard left and right; mute and solo tracks during playback; repeat the mute and solo in Quick Play backing | changes apply at once without clicks; pan audible in the correct ear; mute and solo leave no hanging note | every change audible within the next beat; pan sides correct; behavior identical in Studio and Quick Play (R-P6.2-01 to R-P6.2-03, R-P6.2-07, R-P10-05) |
| LT-040 | Reverb | `ref-desktop` headphones; `ref-android` at the Low tier | Studio mixer | set Reverb to 0, 15 and 100 percent while `demo-piano` plays; check a drums track and the metronome | audible space at 15 and 100, none at 0; drums dry by default; metronome always dry; on Low the reverb is off until enabled | all expectations hold (Part 1.5 reverb decision) |
| LT-041 | Expressive controls | `ref-desktop` headphones | none | listen for the lead pitch bends and the pad CC 1 sweep in `demo-electro`, the CC 11 pad dips in `demo-dance` and the CC 64 sustain in `demo-piano` | each control is audible as described in Part 1.7 | all four controls audible at their places (R-P6.1-05, R-P6.1-09) |
| LT-042 | Velocity | `ref-desktop` headphones | none | compare the ghost notes in `demo-jazz` with the main hits, and the `demo-poprock` verse (velocity 80) with the chorus (110) | softer notes are quieter and darker on synth-velocity programs | the reviewer hears both differences (R-P6.1-04) |

#### 12.9.6 Stage, animation and characters (LT-043..LT-052)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-043 | Instrument animation | `ref-desktop` Chromium, High tier, 60 fps screen recording with audio | the Focus camera on one performer at a time | for each performer of the five demos (keys, guitars, bass, drums, synths, piano) watch 30 s and step through 10 notes in the recording | gestures land on the heard notes with anticipation; hands stay on the instrument; feet stay planted; sustained notes hold the pose; rests settle to idle within 500 ms; blends are smooth; two performers on similar parts move differently | no gesture off its note by more than 1 frame; no hand detached, foot sliding or joint popping in the checked clips (R-B26.4-01, R-P7.2-01 to R-P7.2-09, RISK-19) |
| LT-044 | Full band | `ref-desktop` at 1920 x 1080; `ref-android` at 360 px width portrait | `demo-poprock`, five performers, FullBand camera | watch the whole song on each device | all five perform at once, centered and framed; the highway stays readable | every performer animates in every section; all five in frame at 360 px (R-B26.4-02, R-P7.1-08, R-P7.1-09, R-P7.3-01) |
| LT-045 | Dense visuals versus audio | `ref-desktop` High; `ref-android` Balanced; headphones | `demo-electro` drop sections | play the drops while watching and listening | any visual stutter never affects the sound | no audible gap, late note or stutter during the drops on either device (R-B26.4-03) |
| LT-046 | Camera direction | `ref-desktop`, 60 fps recording | camera motion full, then reduced, then off | play `demo-poprock` once per setting, and twice with "full" | eases of at least 400 ms; hard cuts only on beats and at most one per bar; solo focus follows the busiest track; reduced has no automatic cuts; off is one static view; the two "full" runs cut identically | every expectation holds in the recordings (R-P7.1-04, R-P7.3-02 to R-P7.3-06, R-P7.3-08) |
| LT-047 | Tier looks | `ref-desktop`, forced High, Balanced, Low and Abstract | `demo-jazz` Piano intermediate | play 60 s per tier | each tier is a designed look; Abstract shows one visual per musical event; timing feels identical | no broken or empty view on any tier; judgments of a repeated section are as consistent across tiers as within one tier (R-B26.4-04, R-P7.1-10, R-I12.1-02 to R-I12.1-04) |
| LT-048 | Reduced motion and effects | `ref-desktop` with the OS reduce-motion setting on, then the in-app setting; `ref-ios` | none | play Instrument and Dance 60 s with effects level 0, 1 and 2 | reduced motion: instant camera cuts, no particles, small choreography; level 0 keeps the hit flash, judgment word, beat indicator and highway motion | all gameplay feedback stays at every level; no non-essential animation under reduced motion (R-P15-05, R-P15-12, R-P12-11) |
| LT-049 | Scene quality | `ref-desktop` High; `ref-android` Balanced | none | review the stage of each demo | one focal performer area, readable lighting on every performer, effects only on notes, beats and sections, static low-contrast background | no High finding against P 7.1 (R-P7.1-01 to R-P7.1-07) |
| LT-050 | GPU load and app switch | `ref-android`, tier forced High | `demo-poprock` full band | switch to another app and back 10 times within 60 s during play | the game is paused on each return; graphics restored or the Abstract tier shown; sound resumes after Resume | no crash, reload or permanent loss of audio or transport (R-E13-06, RISK-45) |
| LT-051 | Character editor | `ref-desktop`; `ref-android` with the stats overlay on | SCR-Characters | (1) change every option once; (2) load each of the 8 presets; (3) press Randomize 20 times; (4) check accessories on each body type; (5) view under each tier | every option visibly changes the preview; visual changes in the next frame, rig changes within 100 ms; no body or instrument intersection; colors correct under stage light | no option without a visible effect; randomize always yields a valid character; the preview holds >= 30 FPS on `ref-android` (R-P8-01 to R-P8-04, R-P8-07, R-P8-08, R-P8-12, RISK-46) |
| LT-052 | Saved appearance | `ref-desktop` Chromium and Firefox | a customized character | (1) assign it to slot 0 and play; (2) reload and play again; (3) export `.flmchar.json`, import it in the other browser and play | the same appearance on stage, after reload and in the other browser | identical appearance in all three views (R-P8-05, R-P8-06) |

#### 12.9.7 Studio, recording and export (LT-053..LT-062)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-053 | Recording | `ref-desktop` keyboard; `ref-android` touch | Free Play and Studio, count-in 1 bar, then 2 bars | record an 8-bar take in each place on each device, then play it back | the take starts at the end of the count-in and plays back as performed | the played-back take matches the performance by ear and starts on the downbeat after the count-in (R-B26.5-01, R-P9-11, R-P10-01) |
| LT-054 | Multitrack overdub | `ref-desktop` headphones | new Studio project at 100 BPM | record four tracks one after another (drums with profile F, bass, keys, lead), each with the earlier tracks playing; give each a different program | earlier tracks play during every overdub; each track keeps its program; parts line up | all four tracks audible together in time by ear and on the piano-roll grid; no program change leaks to another track (R-B26.5-02, R-B26.5-03, R-P10-03, R-P10-04) |
| LT-055 | Piano roll editing | `ref-desktop` mouse and keyboard; `tablet` touch | the LT-054 project | select by click, box and keyboard; move, lengthen, shorten, delete, copy and paste; undo and redo 10 steps; edit with snap on and off; on the tablet long-press to select and drag to move | every edit lands on the grid or on the exact tick with snap off; undo and redo restore exactly | every operation works on both input types; undo and redo reproduce each prior state (R-P10-07, R-P10-09, R-P14-14) |
| LT-056 | Interrupted recording | `ref-ios` (lock screen); `ref-desktop` (close the tab) | a project with one complete take on the target track | start a second take and interrupt it after 4 bars; reopen | the first take is unchanged; the interrupted take is offered for review ("Keep take") and applied only on that choice | the first take is intact in every run (R-P19-03, R-P10-12, E 11 rule 7, RISK-41) |
| LT-057 | Save and reopen | `ref-desktop` Chromium; `ref-ios` | the LT-054 project with markers, a character and mixer changes | save; quit the browser; reopen the file the next day; open the project from the Library | the project is exactly as saved | tracks, notes, markers, character, mixer and settings identical by inspection and by ear (R-B26.5-04) |
| LT-058 | MIDI export in other tools | `ref-desktop` with a DAW or notation program the owner uses | the LT-054 project | export `.mid`; open it in the external program | four tracks with names, programs, tempo and notes | the external program shows every track and note of the project (R-B26.5-05, R-P10-15) |
| LT-059 | Audio mix export | `ref-desktop`; `ref-ios` | the LT-054 project | export the audio mix; play it in the OS media player | the file sounds like the in-game mix with the same length | no clicks, missing parts or wrong length; the iOS export path (OQ-2) is recorded (RISK-54) |
| LT-060 | Backup by export | `ref-desktop` Chromium; `ref-android` | the LT-054 project and changed settings | export `.flm.json` and `.flmsettings.json`; clear the site data; re-import both | the project and settings return exactly | identical project and settings after re-import (R-E10-07, RISK-08, RISK-13, RISK-21) |
| LT-061 | Studio on a phone | `ref-ios` and `ref-android`, portrait and landscape | new project | create two tracks, record one, edit three notes, mix, save; toggle "Show stage" | the compact layout is usable by touch; the stage starts hidden and the toggle shows it | every step done by touch without zooming (P 10, R-P14-14) |
| LT-062 | Destructive actions | `ref-desktop` | the LT-054 project | delete a track, clear a take, replace the project by an import; read each dialog; undo where offered | each dialog states what is lost and names its confirm button by its effect; undo restores | every destructive action asks first and the undoable ones return exactly (R-P10-10, R-P21-09) |

#### 12.9.8 Import (LT-063..LT-068)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-063 | Real MusicXML | `ref-desktop` headphones | real files: three MusicXML exports from three different notation programs, together covering ties across bars, tuplets, repeats with endings, several parts and a transposing instrument | import each; read the warnings; play in full and compare with the source program's playback | the same notes, ties, tempo and dynamics at sounding pitch; every loss named by a warning | no unexplained difference; each difference has a warning (R-P11-09, RISK-36) |
| LT-064 | Real Guitar Pro | `ref-desktop` headphones; Guitar Pro or TuxGuitar as reference | real files: three each of GP3, GP4 and GP5 from different sources | import each; play and compare tracks, tunings, tempo and notes | each file plays like the reference; unsupported effects produce warnings | all nine files import; no unexplained difference; the result decides the GP version rows of `docs/COMPATIBILITY.md` (R-P11-10, RISK-51, RISK-11) |
| LT-065 | Import inspection | `ref-desktop`; `ref-android` | `midi-multitrack-band.mid`, `gp6-file.gpx`, an owner-supplied `.mp3` | read SCR-ImportInspect for each; preview the generated chart with audio before play | tracks, programs and warnings in plain words; difficulty metrics; the Guitar Pro 6 or 7 refusal sentence; the audio-only info row | a tester explains what will happen for each file from the screen alone (R-P11-15, R-P11-08, R-P11-11) |
| LT-066 | Import progress and errors | `ref-desktop`; `ref-android` | `mem-1m-events.mid`, `mem-26mb.mid`, `midi-mono-simple.bad-vlq.mid` | import each | progress appears after 300 ms and counts bytes or events; the oversize file is refused before reading; the malformed file's error names the file, the problem and what to try | messages are understandable without technical terms and show no stack trace or path (R-P11-02, R-P11-03, R-P11-12) |
| LT-067 | Drag and drop | `ref-desktop` Chromium, Firefox and Safari | files of LT-065 in a file manager window | drop each file onto the game window on SCR-MainMenu and on SCR-Library; check the picker hint text | each drop starts the same import as the picker; the hint lists the formats | drops work in all three browsers (R-E9-13, R-P11-01) |
| LT-068 | Backing audio alignment | `ref-desktop` headphones | real files: a song audio file and a MIDI file of the same song with the same start | import the MIDI, add the audio as a backing track, set the sync offset until aligned, save, reopen | the audio plays in time with the MIDI parts after the offset; the offset is kept | aligned by ear after reopening; audio tracks are silent at practice speed other than 1.0x with the documented notice (RISK-37) |

#### 12.9.9 Dance Mode (LT-069..LT-072)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-069 | Dance controls and judging | `ref-desktop` keyboard (arrows, then D F J K) and gamepad; `ref-android` pads | `demo-dance` easy, normal and hard | play each difficulty once per input; include jumps (two directions) and holds | each input works; a jump is judged as one step; holds judged at head and release; harder levels are denser | judgments match the tester's timing on every input; easy, normal and hard previews show rising step density and jump ratio (R-B26.6-02, R-P12-02 to R-P12-04, R-P12-06) |
| LT-070 | Choreography sync | `ref-desktop` High, 60 fps recording; `ref-ios` | `demo-dance` normal | watch the avatar for the whole song; step through 10 steps in the recording | foot contacts land when the arrows reach the receptors; idle dance motion in long rests | every checked foot contact within 1 frame of its step time (R-B26.6-01, R-B26.6-04, R-P12-05, RISK-47) |
| LT-071 | Dance layout | `ref-ios` and `ref-android` portrait; `ref-desktop` | arrows layout, then pads layout (2 x 2 diamond) | play 60 s per layout | the dance HUD differs from the instrument HUD; arrows readable; the diamond places up at top, left and right in the middle, down at the bottom | the tester plays both layouts without confusing directions (R-P12-07, R-P12-01) |
| LT-072 | Dance practice and pause | `ref-desktop` | `demo-dance` hard | set a loop on the Drop and speed 0.75; pause and resume; restart | judgments follow song time at 0.75; pause freezes; restart is fresh | as for instrument play (R-P12-08, R-P12-12) |

#### 12.9.10 Multiplayer (LT-073..LT-078)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-073 | Session setup usability | two devices (`ref-desktop`, `ref-android`) on one LAN; two testers new to the game | none | the testers create and join a Synchronized Play session using only the on-screen steps; they read the "What is shared" panel | numbered steps with Copy and Paste buttons; the lobby labels each player with name, instrument and avatar | the session starts within 3 min without outside help; both testers can say what data is shared (R-P13-01, R-P13-02, R-P13-13) |
| LT-074 | Codes through other apps | `ref-ios`, `ref-android`, `ref-desktop` | none | send invite and answer codes through two chat apps, SMS and e-mail; paste them | codes survive line wrapping and inserted spaces, or show the damaged-code message with the expected and received character counts | every route either connects or shows the damaged-code message; none fails silently (RISK-56) |
| LT-075 | Four players | four devices (any classes) on one LAN | Cooperative Band on `demo-poprock` | four players join and play the song; a fifth device tries to join | four performers on every stage; the fifth sees the room-full message | the song completes on all four in sync by ear; the fifth join is refused (R-B26.7-01, Part 9.1.2 row 32) |
| LT-076 | Disconnect and reconnect | three devices on one LAN | Synchronized Play in progress | (1) a guest switches Wi-Fi off for 20 s and on; (2) later the host closes the browser | (1) the guest rejoins its slot with its score or ends with results marked "Disconnected"; (2) guests see the host-left sentence and their results | no device loses a project, setting or performance history entry (R-B26.7-03, R-P13-05, R-P13-06) |
| LT-077 | Multiplayer unavailable | `ref-desktop`; `ref-android` in airplane mode | none | open SCR-Multiplayer; then play Quick Play, Studio and Dance | the multiplayer screen explains the missing network; every local mode works | no local mode is affected (R-B26.7-04, R-P13-12, R-B26.1-04) |
| LT-078 | Online edition relay | a computer running `server/relay.mjs` (Node 22) and two devices on one LAN | `node tools/build.mjs --online ws://<LAN address>:8787`; `PORT=8787 node server/relay.mjs` | (1) create a room by 6-character code and join from the second device; play a song; (2) restart the relay mid-song; (3) stop the relay and try again | (1) works by room code; (2) both clients show DLG-NetError and return to create-or-join with local results kept; (3) the unreachable-relay sentence of Part 1.4 and the invite-code flow | all three expectations hold; the Standalone build ignores `?online=` with its toast (Part 1.4) |

#### 12.9.11 Accessibility (LT-079..LT-085)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-079 | Keyboard-only pass | `ref-desktop` Chromium and Firefox, mouse unplugged | none | operate every screen and dialog with Tab, Shift+Tab, arrows, Home, End, PageUp, PageDown, Enter, Space and Escape: menus, settings, sliders, Library, Studio piano roll, character editor, dialogs, results | every control reachable and operable; the focus ring always visible; only dialogs trap focus | the tester completes the 12.9.14 task list without a mouse (R-P20-09, R-P15-01, R-P14-14) |
| LT-080 | Screen reader pass | NVDA with Firefox and with Chrome on Windows; VoiceOver with Safari on macOS and on iOS; TalkBack with Chrome on Android | `accessibility.screenReaderLabels` on | navigate menus, settings, Library, results, help and every dialog; play one song and listen to the live region | each control announced with name, role and state; disabled controls announce their reason; the HUD live region updates at most once per second | no unlabeled control found; every dialog title and body announced (R-P20-09, R-P15-07, R-P15-09) |
| LT-081 | Focus handling | `ref-desktop` | none | open and close each dialog from the keyboard; open a destructive dialog | focus moves into the dialog (Cancel for destructive ones), stays inside, and returns to the opener on close | every dialog behaves so (R-P15-03, R-P3-07) |
| LT-082 | High contrast | `ref-desktop`; `ref-android` | `video.highContrast` on | play Instrument and Dance on every stage theme; visit menus | white lane outlines, black surfaces, white focus ring; lane glyphs forced on | the highway and HUD stay readable on every theme (Part 10.5) |
| LT-083 | Touch-only pass | `ref-ios` and `ref-android`, no keyboard attached | none | operate every screen and dialog by touch, including sliders, text fields and the piano roll | every control usable; text entry only where Part 7.5.5 allows it | the tester completes the 12.9.14 task list by touch alone (R-P14-14) |
| LT-084 | Remapping | `ref-desktop` | none | remap the four lanes and the dance keys; try a key already in use; try `Tab` and `F5`; reset controls; play with the new keys | the conflict dialog names the clashing action; reserved keys refused with their message; reset restores the defaults | every case behaves as described and play works with the new keys (R-P5.1-09, Part 10.5.1) |
| LT-085 | Settings across modes | `ref-desktop`; `ref-ios` | set high contrast, reduced motion, UI scale 1.3, flash on beat | reload; visit Instrument, Studio, Dance and Tutorial | the settings apply identically in every mode after reload | no mode ignores a setting (R-P15-11, R-P1-10) |

#### 12.9.12 Mobile endurance and performance feel (LT-086..LT-089)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-086 | Long session on a phone | `ref-android` and `ref-ios`, charged, screen auto-lock off | none | play Quick Play songs back to back for 30 min; read the memory by the 9.1.1 method at the end | no crash, reload or audio degradation; tier changes announced | 30 min without a crash or audible degradation; memory reading recorded against Part 9.1.2 row 19; device warmth noted (R-P17-10, R-P14-12) |
| LT-087 | Low-end device | `low-android` | none | first launch, then play `demo-poprock` Keys intermediate twice | Balanced at start, a downgrade to Low with its toast when needed; responsive input; stable audio | the song plays without audio gaps and every press shows feedback at once (R-P1-02, R-I12-08, R-P14-11) |
| LT-088 | Long recording | `ref-desktop`; `ref-android` | new Studio project | record one 10 min take; save; reopen; play the whole take | the take is complete and plays back in time | no gap, cut or misalignment over 10 min (R-P17-10) |
| LT-089 | Large project | `ref-desktop` | `midi-large-100k.mid` imported into Studio | scroll and zoom the piano roll; edit 10 notes; save and reopen | editing stays responsive; only visible notes are drawn | every interaction responds within one beat at 120 BPM (500 ms) by feel; save completes (R-P10-13) |

#### 12.9.13 Delivery, documentation and final review (LT-090..LT-096)

| ID | Area | Device(s) | Setup | Steps | Expected | Pass criterion |
|---|---|---|---|---|---|---|
| LT-090 | Independent validation | a computer that has never held the repository; Desktop Chromium and Desktop Firefox with fresh profiles; network off | only `FingerLickinMusic.html` copied there on a USB stick; corpus files copied separately | run the core function list: Quick Play, Instrument, Free Play, Studio record, save and reopen, Library, Import (corpus `.mid`, `.mxl`, `.gp5`), Dance, Characters, Settings, Help, About, export of `.mid` and `.flm.json` | every function works from the single file without network | every function on the list succeeds in both browsers (R-P18-11, R-P20-14, R-E13-05, RISK-06) |
| LT-091 | Documentation accuracy | `ref-desktop` | `docs/COMPATIBILITY.md`, `README.md`, SCR-About, `docs/FINAL-REPORT.md` drafts | compare every limitation, format status and browser claim with the recorded FT, XT and LT results | every claim matches a recorded result; nothing untested is called Supported; nothing incomplete is called complete | zero claims without evidence (R-B26.8-04, R-B26.8-06, R-P20-12) |
| LT-092 | Error and fallback wording | `ref-desktop`; `ref-ios` | none | trigger: a malformed import, a save in a private window, graphics disabled (Firefox `webgl.disabled`), MIDI unavailable, a failed connection; read each message | each names the operation and the next action; no stack trace, file path or peer address; fallbacks are stated, never silent | every message passes the three checks (R-P19-09, R-P15-08, R-P19-08, RISK-28) |
| LT-093 | Help content | `ref-desktop` | none | read SCR-Help completely | controls per input, the judgment windows per difficulty, the background-tab stutter sentence, the iOS silent-switch sentence, the Web MIDI sentence, the two-players-on-one-keyboard sentence | every listed item present and correct against Parts 1.5 and 9.1.2 row 40 (R-P5.2-05) |
| LT-094 | License inventory | `ref-desktop` | SCR-About, the inventory in `docs/FINAL-REPORT.md` | review the license text and the inventory against the shipped file | no runtime dependency; the development tools listed; the content declared original; the game license per the owner decision of Part 10.3 | no unlisted embedded code or content (R-B26.8-03, R-P18-03, R-P20-10) |
| LT-095 | Relay deployment walkthrough | a fresh machine with Node 22 | the README relay instructions only | follow the instructions: start the relay, call `GET /health`, optionally put a TLS reverse proxy in front, build the Online edition for that URL, connect two clients | the documented steps alone produce a working relay | a person other than the author completes the walkthrough without other help (R-B26.8-02, R-P13-14) |
| LT-096 | Final product review | `ref-desktop` and `ref-android`; the owner | the release candidate after every other LT row | play 60 min across every mode; check each subsystem against the P 22 conditions | the product looks consistent, sounds convincing, responds at once, keeps work and behaves predictably | no open broken-timing, confusing-control or lost-recording finding; every P 22 condition holds per subsystem (R-P22-01 to R-P22-13) |

#### 12.9.14 Task list for the keyboard-only and touch-only passes

LT-079 and LT-083 use this list; each item is done without the excluded input:

1. Complete first-launch setup and reach SCR-MainMenu.
2. Start Quick Play with a non-default song, track and difficulty; pause, resume, quit.
3. Change master volume, note speed, UI scale and one key or pad setting in SCR-Settings.
4. Run DLG-Calibration to its summary and save.
5. In Studio: add a track, record 4 bars, select and move two notes, undo, save as a new
   project.
6. In SCR-Library: find the project by search, rename it, export it, delete a demo copy
   (and cancel once).
7. Import `midi-multitrack-band.mid` and start play from SCR-ImportInspect.
8. In SCR-Characters: change three options, save the character.
9. Open SCR-Multiplayer, create an invite, copy it, cancel.
10. Open SCR-Help, SCR-About and SCR-Diagnostics and return to the menu.

#### 12.9.15 Coverage of human-judged acceptance criteria

B 26 bullets whose acceptance needs a person (the automated part is in 12.3-12.7):

| B 26 bullet | R-ID | LT tests | XT tests |
|---|---|---|---|
| The HTML file opens in supported desktop browsers | R-B26.1-01 | LT-001, LT-090 | XT-001 to XT-003, XT-070 |
| Local gameplay usable without network access | R-B26.1-03 | LT-001, LT-090 | XT-001 to XT-005 (C1 offline) |
| Optional network failures do not disable standalone features | R-B26.1-04 | LT-077 | XT-058 to XT-062 |
| Four-button input triggers the intended mapped musical actions | R-B26.2-01 | LT-027 | XT-001 to XT-005 |
| Chords and simultaneous inputs within documented limits | R-B26.2-02 | LT-023, LT-024 | XT-011 to XT-015 |
| Timing judgments based on the musical timeline | R-B26.2-03 | LT-017, LT-018 | XT-065 to XT-069 |
| Input calibration affects scoring predictably | R-B26.2-04 | LT-019 | XT-073 |
| Keyboard and touch controls work | R-B26.2-05 | LT-024, LT-079, LT-083 | XT-016 to XT-019, XT-071, XT-075 |
| Imported supported MIDI preserves track and note structure | R-B26.3-01 | LT-036 | XT-030 to XT-034 |
| Tempo changes are respected | R-B26.3-02 | LT-036, LT-037 | - |
| Polyphonic passages remain polyphonic | R-B26.3-03 | LT-034, LT-036 | - |
| Program assignments applied as documented | R-B26.3-04 | LT-031, LT-036 | - |
| Pause, resume, seek and loop without cumulative drift | R-B26.3-05 | LT-030, LT-037 | XT-043 to XT-052 |
| Instrument animations respond to actual events | R-B26.4-01 | LT-043 | - |
| Multiple instruments perform simultaneously | R-B26.4-02 | LT-044 | - |
| Dense passages without blocking audio scheduling | R-B26.4-03 | LT-045 | XT-065 to XT-069 |
| Reduced-quality modes preserve the timeline | R-B26.4-04 | LT-047 | XT-035 to XT-039 |
| Users can record a performance | R-B26.5-01 | LT-053 | - |
| Users can create multiple tracks; earlier tracks play during overdubbing | R-B26.5-02, R-B26.5-03 | LT-054 | - |
| Projects can be saved and reopened | R-B26.5-04 | LT-057, LT-060 | XT-020 to XT-024 |
| Exported supported formats pass their validation tests | R-B26.5-05 | LT-058, LT-059 | XT-025 to XT-029 |
| Dance steps aligned to the musical timeline | R-B26.6-01 | LT-070 | - |
| Four-button dance inputs evaluated correctly | R-B26.6-02 | LT-069 | - |
| Avatar movement synchronized with the chart | R-B26.6-04 | LT-070 | - |
| Players can join a session | R-B26.7-01 | LT-073, LT-075, LT-078 | XT-063, XT-064 |
| Session start and position synchronized within limits | R-B26.7-02 | LT-075 | XT-063, XT-064 |
| Disconnection and reconnection without corrupting local state | R-B26.7-03 | LT-076 | XT-063, XT-064 |
| Standalone gameplay works when multiplayer is unavailable | R-B26.7-04 | LT-077 | XT-058 to XT-062 |
| Delivery bullets (B 26.8) | R-B26.8-01 to R-B26.8-06 | LT-090, LT-091, LT-094, LT-095 | all, through 12.10 |

R-B26.6-03 (deterministic dance scores) has no human part; it is covered only by
automated tests.

P checklist items that cannot be automated, by kind:

| Kind | P items | LT tests |
|---|---|---|
| Visual alignment and layout | P 2.2, P 5.2 (target readability, hit zone), P 7.1, P 7.3, P 12 (arrow readability), P 14 (safe areas, browser bars) | LT-008, LT-009, LT-010, LT-015, LT-017, LT-044, LT-046, LT-049, LT-071 |
| Visual identity and readability | P 2.1, P 2.3, P 15 (contrast, focus, scaling), P 21 (truncation, empty states, units) | LT-011, LT-013, LT-014, LT-016, LT-082 |
| Audio pops, timbre and mix | P 6.1, P 6.2, P 21 (preview fades), P 9 (metronome) | LT-031, LT-033, LT-034, LT-038 to LT-042 |
| Timing feel | P 5.1, P 6.3, P 9, P 10, P 12 | LT-017 to LT-021, LT-037, LT-053, LT-054, LT-070 |
| Gestures and touch | P 5.1, P 14 | LT-024, LT-025, LT-055, LT-061, LT-083 |
| Animation quality | P 7.2, P 8, P 12 | LT-043, LT-048, LT-051, LT-052, LT-070 |
| Wording and documentation | P 13, P 18, P 19, P 20, P 21 (confirmations) | LT-006, LT-073, LT-091 to LT-095 |
| Final polish definition | P 22 | LT-096 |

Risk register rows whose Verification names LT (Part 13.1) and the LT tests that serve them:
RISK-02 LT-001, LT-002; RISK-03 LT-036; RISK-04 LT-035; RISK-06 LT-090; RISK-08 LT-060;
RISK-09 LT-024; RISK-10 LT-034; RISK-11 LT-063, LT-064; RISK-13 LT-060; RISK-19 LT-043;
RISK-21 LT-060; RISK-25 LT-036, LT-063, LT-064; RISK-28 LT-092; RISK-33 LT-035;
RISK-36 LT-063; RISK-40 LT-018, LT-019; RISK-45 LT-050; RISK-46 LT-051; RISK-47 LT-070;
RISK-51 LT-064; RISK-53 LT-024 (with XT-011 to XT-015); RISK-56 LT-074; RISK-58 LT-060
(with XT-020 to XT-024); RISK-61 LT-031; RISK-63 LT-038; RISK-68 LT-014; RISK-69 LT-032;
RISK-70 LT-033; RISK-71 XT-072 and LT-093; RISK-73 every LT and XT row (owner-run);
RISK-76 LT-021.

### 12.10 Release-blocking gate

The implementation must not be declared production-ready, and `docs/FINAL-REPORT.md`,
`README.md`, SCR-About and STATUS.md must not call the release complete, while any gate
row below is unresolved (E 13, B 26.8, Part 0.8 item 6). Test IDs are those of 12.3 to
12.9 (FI IDs from 12.7, hooks of Part 10.9.2) and the acceptance tests `AT-<R-ID>` of
12.12 and 12.13. Build checks are the Part 3.3.4 checks of `tools/build.mjs`, which have no
test ID.

#### 12.10.1 Gate rules

1. A gate row is resolved only when every test it lists has a recorded pass on the release
   candidate's file hash (12.8.1 rule 1) or, for in-page and tool tests, on the build of
   the release candidate commit, and every AT it lists passes.
2. A listed test that cannot run in the environment (owner device and browser tests) keeps
   the row unresolved with the reason "awaiting owner device test"; the session never
   treats "not run" as a pass and never removes a test from a row to resolve it.
3. Part 9.1.2 release-blocking budget rows (2, 14, 15, 20, 21, 22) are part of the gate
   through the PT tests named below; a failure of one of them blocks regardless of other
   results.
4. A row with a failing test produces a STATUS.md section 6 defect of severity Critical
   (Part 13.2); the row resolves only after the fix, the added regression test (I 17) and
   a full re-run of the row on the new release candidate.
5. Lower-priority features may be Deferred only per E 13 (row G-11): their status is in
   STATUS.md and `docs/FINAL-REPORT.md`, and every row G-01 to G-10 and D-01 to D-06 is
   resolved.
6. The gate decision (resolved or not, per row) is written to the Phase 16 LEDGER entry and
   to `docs/FINAL-REPORT.md` (12.11); a release that is delivered with unresolved rows is
   delivered as "not production-ready" with those rows listed.

#### 12.10.2 E 13 gate conditions

| Gate | Condition that blocks the release (E 13) | AT tests | Automated tests that must pass | Device and manual tests that must pass | Evidence to record |
|---|---|---|---|---|---|
| G-01 | Audio timing drifts during normal gameplay | AT-R-E13-01, AT-R-B26.3-05, AT-R-P6.3-01, AT-R-P6.3-02, AT-R-P6.3-03, AT-R-P6.3-06, AT-R-P6.3-08 | UT-04-20, UT-04-22; TT-001, TT-003, TT-004, TT-005, TT-006, TT-008, TT-011, TT-014, TT-015, TT-017, TT-019, TT-020, TT-021, TT-022; IT-013, IT-039; FI-032, FI-033, FI-034; PT-004, PT-007, PT-008, PT-022 | XT-043 to XT-052, XT-065 to XT-069; LT-017, LT-018, LT-037 | `--all` results JSON; perf JSON with `driftMs`, `schedErrorMaxMs` and `lateEvents` per scenario; device JSON per browser; the 9.2 matrix "Audio glitches" cell per device |
| G-02 | Stuck notes can persist after stopping or changing modes | AT-R-E13-02, AT-R-P5.1-04, AT-R-P5.1-11 | UT-03-08 to UT-03-13, UT-05-21, UT-05-22, UT-05-23, UT-05-24, UT-05-31, UT-28-01, UT-28-07; TT-007, TT-009, TT-011, TT-031; IT-032, IT-033, IT-043; PT-011, PT-012; FI-005, FI-006, FI-038, FI-040 | XT-016 to XT-019; LT-035 | `assertClean()` results of IT-032 and PT-011; `voicesMax` and active voices after stop from PT-012 (Part 9.1.2 rows 21 and 22); LT-035 case table |
| G-03 | Valid supported MIDI files lose musical events | AT-R-E13-03, AT-R-B26.3-01, AT-R-B26.3-03, AT-R-P11-04, AT-R-P11-05, AT-R-P11-06 | UT-10-12, UT-10-14, UT-10-34, UT-10-35; FT-001 to FT-022, FT-107, FT-109, FT-110; IT-006, IT-007, IT-008 | XT-030 to XT-034; LT-036 | FT results with the event, track and warning comparison per corpus file; round-trip diffs (empty); LT-036 file list and findings |
| G-04 | Saving can silently destroy an existing project | AT-R-E13-04, AT-R-E11-13, AT-R-E11-16, AT-R-P16-01, AT-R-P16-02, AT-R-P16-12 | UT-16-05, UT-16-06, UT-16-07, UT-16-08, UT-16-12, UT-16-13; FT-111, FT-112, FT-113; IT-014, IT-044, IT-054, IT-055, IT-057, IT-058; PT-017; FI-002, FI-003, FI-013 to FI-019, FI-042 | XT-020 to XT-024; LT-056, LT-057, LT-060 | FI result table per stage showing the previous version and `.bak` intact and no `project.saved` event; XT storage mode per browser and context; LT-056 and LT-060 findings |
| G-05 | The advertised standalone file cannot perform its documented core functions | AT-R-E13-05, AT-R-B26.1-01, AT-R-B26.1-03, AT-R-B26.1-04, AT-R-E9-01, AT-R-E9-16, AT-R-P18-05, AT-R-P18-06, AT-R-P18-11, AT-R-B5.2-01 | build checks; PT-001, PT-002, PT-003; IT-030, IT-031 | XT-001 to XT-005, XT-070; LT-001, LT-002, LT-090 | file hash and size; per browser and context the XT-001 to XT-005 result cells; LT-090 core function list with results |
| G-06 | A rendering failure permanently disables audio or transport | AT-R-E13-06, AT-R-E11-11, AT-R-E9-15, AT-R-I12.1-05 | IT-011, IT-012, IT-045, IT-059; TT-020; PT-006; FI-009, FI-010, FI-011, FI-012, FI-035 | XT-035 to XT-039; LT-050 | transport state and scheduled-event log across each injected failure; tier and context type per browser; LT-050 findings |
| G-07 | Mobile controls fail to release inputs reliably | AT-R-E13-07, AT-R-P14-04, AT-R-I12-04, AT-R-P5.1-05, AT-R-P5.1-06 | UT-07-12, UT-07-13, UT-07-16, UT-07-17, UT-07-18, UT-07-19, UT-07-20; IT-002, IT-043; PT-024; FI-027, FI-028, FI-029 | XT-011 to XT-019, XT-040 to XT-042; LT-024, LT-025 | per device the 80 case runs of XT-016 to XT-019 with held-control counts; the OQ-1 outcome in the LEDGER |
| G-08 | Multiplayer accepts invalid authoritative results without the intended validation | AT-R-E13-08, AT-R-P13-07, AT-R-P13-08, AT-R-P13-10 | UT-24-03 to UT-24-10, UT-24-15, UT-24-16, UT-24-21, UT-24-22, UT-24-35; IT-026, IT-028; PT-020; FI-020 to FI-026 | XT-063, XT-064 | IT-028 table of forged results and their rejection codes; rejected and dropped message counters from SCR-Diagnostics Network |
| G-09 | Required supported file formats have not been tested against a representative corpus | AT-R-E13-09, AT-R-P20-03, AT-R-P11-16 | FT-001 to FT-114 (whole corpus); FI-030, FI-031; IT-041, IT-042 | XT-030 to XT-034; LT-036, LT-063, LT-064, LT-091 | for every format and version cell of `docs/COMPATIBILITY.md` the FT IDs and real-file LT results that justify it; a version without at least two passing valid FT files and one passing malformed FT file is published Partial, not Supported (Part 8.9 publication rule) |
| G-10 | Critical errors are silently ignored or reported as successful operations | AT-R-E13-10, AT-R-P19-01, AT-R-P19-11, AT-R-P19-12, AT-R-E11-15 | UT-01-15, UT-28-13; IT-041, IT-042, IT-044; FI-001 to FI-042 (each asserts a visible message and an `error` event where the failure is user-relevant), in particular FI-039 and FI-041 | LT-092 | the FI table with the message shown per hook; STATUS.md section 6 with no open Critical defect |
| G-11 | A lower-priority feature is deferred without documented status while core criteria fail | AT-R-E13-11 | none beyond G-01 to G-10 | LT-091 | STATUS.md section 3 and section 5 rows for every Deferred item of Part 1.5; the same list in `docs/FINAL-REPORT.md` item 11 |

#### 12.10.3 B 26.8 delivery conditions

| Gate | Delivery condition (B 26.8) | AT tests | Automated tests that must pass | Device and manual tests that must pass | Evidence to record |
|---|---|---|---|---|---|
| D-01 | The final standalone HTML is provided | AT-R-B26.8-01, AT-R-B28-01, AT-R-B28-14, AT-R-P18-01, AT-R-P18-02, AT-R-B5.3-01 | build checks (no external reference, no test code, `node --check`, size); PT-001 | XT-001 to XT-005; LT-090 | path `Finger Lickin Music/FingerLickinMusic.html`, commit hash, file SHA-256, byte size against Part 9.1.2 rows 1 and 2 |
| D-02 | Any external services or optional resources are documented | AT-R-B26.8-02, AT-R-P18-04, AT-R-B28-07, AT-R-B28-13 | IT-031 | XT-058 to XT-064; LT-078, LT-095 | the SCR-About and `README.md` sentences for the STUN toggle and the relay (Part 1.4); relay requirements in `docs/FINAL-REPORT.md` item 7 |
| D-03 | Dependency licenses are documented | AT-R-B26.8-03, AT-R-B28-06, AT-R-P18-03, AT-R-P20-10, AT-R-B19.5-01 | build checks (no external URL) | LT-094 | the inventory of `docs/FINAL-REPORT.md` item 6: no runtime dependency, the development tools with versions (Node, Playwright, Chromium), content originality statement, the game license per Part 10.3 |
| D-04 | Supported file formats and limitations are listed | AT-R-B26.8-04, AT-R-B28-05, AT-R-B1.5-02, AT-R-P11-16 | FT-001 to FT-114; FT-095 (compatibility table data) | XT-030 to XT-034; LT-063, LT-064, LT-091 | `docs/COMPATIBILITY.md` with every format, version and browser cell citing its test IDs; the SCR-About "Limits of this version" block matching it |
| D-05 | Automated test results and known issues are included | AT-R-B26.8-05, AT-R-B28-10, AT-R-B28-11, AT-R-P20-11 | `node tools/selftest.mjs --all` (every UT, IT, FT, TT, FI); `node tools/perf.mjs --slow` (every PT) | XT and LT result tables (12.11) | pass and fail counts per category with the run date and commit; STATUS.md section 6 copied into `docs/FINAL-REPORT.md` item 11 |
| D-06 | No feature is falsely described as complete | AT-R-B26.8-06, AT-R-B28-15, AT-R-B1.5-06, AT-R-P20-12 | none beyond D-05 | LT-091 | the Part 15 Status column and STATUS.md counts equal (Part 0.7 rule 7); every Implemented requirement lists passing tests; every claim in the documents traced to a recorded result |

#### 12.10.4 Gate procedure

1. Build the release candidate with `node tools/build.mjs` from a clean tree; record the
   commit hash, the file hash and the size (D-01).
2. Run `node tools/selftest.mjs --all` and `node tools/perf.mjs --slow`; store both result
   JSON files in the Phase 16 LEDGER entry (D-05).
3. Hand the owner the XT and LT run list (12.8, 12.9) for the release candidate hash, with
   the corpus files and the rule-5 serving command; transcribe the returned results.
4. Evaluate every AT of 12.12 and 12.13 named in 12.10.2 and 12.10.3.
5. Fill the two gate tables of 12.10.2 and 12.10.3 in `docs/FINAL-REPORT.md` with
   "resolved" or "unresolved: <tests not passing or not run>" per row.
6. Only when all 17 rows are resolved may the documents call the release production-ready.

### 12.11 Evidence recording

Every result of 12.3 to 12.10 is evidence only once it is written down in the places below
with its run identity. Nothing is presented as tested, measured or verified without such a
record (B 28 last paragraph, B 25.5, Part 9.2.3 rule 1).

#### 12.11.1 Where results go

| Result | Primary record | Summary copies | `docs/FINAL-REPORT.md` item (B 28 numbering) |
|---|---|---|---|
| In-page suite (`node tools/selftest.mjs --all`: UT, IT, FT, TT, FI) | the results JSON stored verbatim in the LEDGER entry of the run | STATUS.md header line "Self-test (--all)"; STATUS.md section 6 for failures | item 10 "Automated test results": pass and fail counts per category and per group, run date, commit, Chromium and Playwright versions |
| Performance (`node tools/perf.mjs`, PT) | the result JSON of Part 9.7.6 in the LEDGER entry | STATUS.md section 7 per Part 9.1 row; the `headless` row of the Part 9.2 matrix | item 9 "Performance measurements": each Part 9.1.2 row with its value or "not measured" |
| Device scenario runs (XT-065 to XT-069) | the device JSON pasted by the owner, stored verbatim in the LEDGER entry of the day | the device rows of the Part 9.2 matrix in `docs/COMPATIBILITY.md`; STATUS.md section 7 | items 8 and 9 |
| XT results | one record line per XT row, browser version and context (12.11.2) in the LEDGER | the browser matrix of `docs/COMPATIBILITY.md` (one row per browser version and device, one column per 12.8.18 capability, separate `file://` and `http(s)` cells); STATUS.md header line "Live and device tests (LT, XT)" | item 8 "Browser and device compatibility report" |
| LT results | one record line per LT run with its findings list in the LEDGER | STATUS.md section 6 for findings of Medium severity or higher; the same header line | item 4 "Feature-completion report" (an LT result table by area) and item 11 for open findings |
| AT results | the AT evaluation table of 12.12 and 12.13 with pass, fail or "not run" per AT and the tests it relied on | Part 15 Status column at Phase 16 (Part 0.7 rule 7) | item 2 (traceability matrix with final statuses) and item 4 |
| Release-blocking gate (12.10) | the two gate tables, filled per 12.10.4 step 5, in the Phase 16 LEDGER entry | none | item 4, closing table "Release-blocking gate"; every unresolved row repeated in item 11 |
| Format evidence | FT IDs and real-file LT results per format and version | `docs/COMPATIBILITY.md` format matrix (each Supported, Partial, Conversion or Unsupported cell cites its tests) | item 5 "Supported file-format and version matrix" |
| Packaging evidence (D-01, LT-090) | commit hash, file SHA-256, byte size, the build report | STATUS.md header line "Build" | item 1 and item 14 |

#### 12.11.2 Record format

XT and LT record lines in the LEDGER use one fixed line per run (fields separated by
semicolons; no field left empty; unknown values are written "unknown"):

```text
XT-020; Desktop Firefox; Firefox <full version string>; <OS name and build>; ref-desktop <model>; DPR <n>; C1 pass; C2 pass; C3 fail: <reason>; file <sha256 first 12 hex>; <YYYY-MM-DD>; <tester>
LT-033; Audio quality; <browser and full version>; <OS name and build>; ref-ios <model>; pass; findings: <none or the list with severities>; file <sha256 first 12 hex>; <YYYY-MM-DD>; <tester>
```

A context cell or a result is one of "pass", "fail: <reason>", "n/a: <reason>" (only for
the cases 12.8.1 rule 6 and the "-" cells of 12.8.18 allow) or "not run". "pre-check
(headless)" and "pre-check (screenshots)" lines are kept in the LEDGER but are never
copied into `docs/COMPATIBILITY.md` or the final report as results.

#### 12.11.3 The "not measured" and "not run" rules

1. A budget cell without a recorded measurement reads "not measured"; a test without a
   recorded run reads "not run". Neither is replaced by an estimate, an expectation, a
   value from another device or browser version, or a value inferred from the engine
   name (Part 1.6 rule 3, Part 9.2.3 rule 1).
2. Values measured in the session's headless Chromium under software GL carry the suffix
   "(software GL)" and never stand for a device (Part 9.2.1).
3. A browser stays "not yet verified" on SCR-About, in `README.md` and in
   `docs/COMPATIBILITY.md` until all XT IDs of its 12.8.18 column have passing records on
   the release candidate (Part 1.6 rules 1 and 2). With some failing or not run, it is
   published Partial with the failing or untested capabilities named, or Unsupported.
4. When the platform cannot open local HTML files (12.8.1 rule 6), the claim names the
   contexts actually tested, for example "iOS Safari <recorded version>: tested over https only"
   (the placeholder is the recorded version).
5. When a floor version cannot be obtained (XT-070), the claim states the lowest
   version actually tested.
6. Requirements whose named tests include unrun XT or LT rows stay Partial in STATUS.md
   with the reason "awaiting owner device test" (Part 0.7 rule 3); the final report lists
   them under unverified behavior, separate from implemented and tested functionality and
   from future work (B 28).
7. Results are tied to a file hash. A new release candidate invalidates earlier XT and LT
   results for the rows its changes can affect; the session lists those rows for re-run
   in the LEDGER and marks the old records "superseded by <hash>"; records are never
   deleted.

#### 12.11.4 Browser versions, devices and testers

Every XT and LT record names: the browser and its full version string (as reported in the
diagnostics export), the operating system with its build, the device model and its Part
9.2.1 class, the devicePixelRatio and viewport for layout rows, the output device for
audio rows (speaker, wired, Bluetooth model), the date and the tester. `docs/COMPATIBILITY.md`
and the final report reproduce the browser version, OS build, device model and date for
every published result (B 25.5 "Browser versions and actual test devices must be
recorded"). Records and screenshots contain no personal data: device names are models,
not owner-given names; diagnostics exports keep "Include song content" off (S-GEN-05);
real-world music files used in LT rows are named by type and source program only.

#### 12.11.5 Owner actions

Every XT and LT row, and every 12.10 gate row that depends on them, is listed in the LEDGER
"Owner actions" section with the release candidate hash until a result is recorded (Part
0.6). The final report's item 8 and item 11 list the rows still "not run" at delivery and
say that the corresponding behavior is unverified.
