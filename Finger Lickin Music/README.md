# Finger Lickin Music

A single-file browser music game: four-button rhythm play, free play, a multitrack studio,
MIDI/MusicXML/Guitar Pro import, a procedural 3D band, dance mode and optional peer-to-peer
multiplayer. Plain JavaScript, Web Audio, WebGL, no libraries, no network requests.

Status: implementation plan in preparation. This commit holds the specification and this README;
docs/IMPLEMENTATION-PLAN.md is added in the next commit. There is no game yet. Nothing in this folder runs.

- docs/IMPLEMENTATION-PLAN.md is the complete design and the executable roadmap (Phases 0-16),
  written to be implemented in one go by an AI coding session (Opus 5.5, high effort).
  Start with its Part 0, "How to use this plan".
- docs/SPECIFICATION.txt is the source specification (FLM-1.0, 1.1.0, 1.2.0, 1.3.0), verbatim.
- docs/STATUS.md and docs/LEDGER.md are created by the implementing session (plan Appendix D).

## Play (once built)
- Computer: double-click FingerLickinMusic.html, or open it from any web server.
- Phone or tablet: put the one HTML file on a web server and open it; landscape is recommended.
- Sound starts after the first tap or key press (browser rule). All instruments are synthesized.

## Develop (once the source exists)
- Source: src/shell.html and src/*.js, joined in file-name order by node tools/build.mjs into
  FingerLickinMusic.html (shipped) and FingerLickinMusic.test.html (with self-tests, not committed).
- Test: node tools/selftest.mjs --all (headless Chromium via preinstalled Playwright); node tools/perf.mjs.
- Corpus: node tools/make-corpus.mjs writes test-corpus/; --check verifies it.
- Optional relay for online multiplayer: node server/relay.mjs (plan Part 3.7).
- Compatibility matrix: docs/COMPATIBILITY.md (written in Phase 12).
