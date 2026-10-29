# ClassTimeKiller

A single-file browser first-person shooter (WebGL2, plain JavaScript, no libraries, no network requests). The shipped game is `ClassTimeKiller.html`; players never build it.

## Play

- Computer: double-click `ClassTimeKiller.html`, or open it from any web server.
- Phone or tablet: put the one HTML file on a web server and open it in the browser. See "iPhone and iPad" below.

## Develop

- Source: `src/shell.html` and `src/*.js`, joined by file name order into one script.
- Build: `node tools/build.mjs` writes `ClassTimeKiller.html`, the game without the self-test blocks (about 2.1 MB; the build fails above 3.5 MB), and `ClassTimeKiller.test.html`, the same game with them (not committed; `--check` only runs the checks). The shipped file leaves out blank and comment-only lines and end-of-line `//` comments and indents with tabs.
- Test: `node tools/selftest.mjs` (headless Chrome on the test build; `--group <name>`, `--slow`, `--timeout <seconds>`, default 480: the full suite takes about 4 minutes). The game file itself: `node tools/selftest.mjs --file ClassTimeKiller.html --no-selftest --eval "__CTK.log.errors().length"` must print 0. Performance: `node tools/perf.mjs`.
- Docs: `docs/SPECIFICATION.md` (requirements), `docs/ARCHITECTURE.md` (contracts), `docs/api/*.md` (per area), `docs/LIVE-TESTS.md` (tests played by hand), `docs/PERFORMANCE.md`, `docs/IMPLEMENTATION-STEPS.md` (the historic build plan).

## iPhone and iPad

1. Serve the file over HTTPS. Gyro/motion aim, the screen wake lock, persistent storage and the Home Screen app need a secure page; over plain `http://` the game plays without them (the gyro shows "Gyro needs HTTPS").
2. Add to Home Screen: open the game in Safari, tap Share, then Add to Home Screen. The icon opens the game full screen.
3. The Home Screen app has its own save, separate from the Safari tab, and starts empty. To move progress: in Safari open Settings, "Back up or restore save", Copy; then in the Home Screen app import it (the app offers this on its first start).
4. On iOS before 17 the silent switch mutes the game's sound (the game shows a one-time tip). From iOS 17 sound plays with the switch on.
5. Hold the phone sideways: an upright phone pauses the match behind a "Turn your phone sideways" screen.

Saves live in the browser's storage on the device (`localStorage`). Safari may clear a site's data after about 7 days away; the Home Screen app and granted persistent storage keep it, and the backup button is the safe copy.
