# src/ - Finger Lickin Music source

`node tools/build.mjs` joins `shell.html` and every `NN-name.js` in this folder, in file-name
order, into `FingerLickinMusic.html` (shipped) and `FingerLickinMusic.test.html` (test build).
Spec: `docs/IMPLEMENTATION-PLAN.md` Part 3 (3.1 file tree, 3.2 shell, 3.3 build, 3.11 style).

## Files

- `shell.html` - the only HTML file: head with the CSP, design tokens, base CSS, DOM scaffold,
  glyph sprite, early error handler and one `/*@@SCRIPT@@*/` marker. The build replaces the
  marker and nothing else. No external reference of any kind; ASCII only.
- `01-core.js` to `30-content.js` - the shipped modules M-01 to M-30. File names match
  `^\d\d[a-z]?-[a-z0-9-]+\.js$`.
- `90-selftest.js`, `91-test-<module>.js`, `92-test-<group>.js` - test build only; never in the
  shipped file.

## Rules for every file (Part 3.11)

- UTF-8 with BOM, LF line endings, ASCII-only content, 2-space indent, single quotes,
  semicolons, `const` and `let` only, `===` only, maximum line length 120.
- ES2020 ceiling: no `??=`, `||=`, `&&=`, private class fields, static blocks, top-level
  `await`, `import` or `export`.
- Exactly one IIFE per file; its first statement is `'use strict';`; nothing is declared outside it.
- One namespace per module: each file registers one `FLM.Core.define('<Namespace>', factory)`
  (01-core.js creates `window.FLM` itself). A module uses only lower-numbered modules (R-DEP of
  Part 4.2). There is no module-level global state object (S-07).
- Banned by the build: `fetch(`, `XMLHttpRequest`, `import(`, `importScripts`,
  `navigator.sendBeacon`, `eval(`, `new Function(`, `document.write`, the HTML-injection
  properties and methods, string timers; `new WebSocket` and `RTCPeerConnection` only in
  `24-net.js`; assignments to `window.` properties only in `01-core.js` and `90-selftest.js`.
- Also checked: no remote reference (`<script src=`, stylesheet links, `@import`, `url(http`,
  `src="http`, `href="http`) and no credential pattern (Part 10.4) in the shipped set.
- Text from users or files is inserted with `textContent` only.

## Module skeleton (template for every new `NN-name.js`)

```js
// NN-name.js - M-NN FLM.Namespace: one-line responsibility.
// Separation rule: this file owns exactly one namespace and registers it once through
// FLM.Core.define. It may use only lower-numbered modules (Part 4.2, R-DEP). It declares no
// module-level global state object (S-07): state lives inside the factory closure.
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Namespace', function (FLM) {
  const { assert } = FLM.Core;
  const bus = FLM.Core.bus;                 // the shared event bus (Part 4.4)

  const EXAMPLE_LIMIT = 8;                  // named constant, brief why-comment

  /**
   * One JSDoc block per public function.
   * @param {number} value
   * @returns {number}
   * @throws {Error} code E-XXX-nnn when the input is invalid
   * Emits: topic.name
   */
  function example(value) {
    assert(Number.isInteger(value), 'example needs an integer');
    return Math.min(value, EXAMPLE_LIMIT);
  }

  return Object.freeze({ example /* , ... every public name */ });
});
})();
```

Test files (`91-test-<module>.js`) use the same IIFE shape with one
`FLM.SelfTest.group('<module>', (t) => { ... });` call (Part 3.11). `01-core.js` is the one
exception: it creates the namespace itself (`const FLM = window.FLM = { VERSION, BUILD, RELAY_URL };`).

## SCR-About text (consumed by T01.11)

Source: Part 10.3.2 (credits block), Part 2.17 (dependency inventory), T01.02. Plain text for
SCR-About and the folder README. The built-in content statement is completed by T04.10.

Dependency and license inventory:

```text
Runtime dependencies: none. The game is a single HTML file that loads nothing from the
network: no libraries, fonts, images, sound files, 3D models or scripts.
Development tools, not part of the game and not needed to play it: Node.js (MIT license)
runs the build and test scripts; Playwright (Apache-2.0 license) and its Chromium browser
(BSD-3-Clause and bundled component licenses) run the automated tests; Git keeps the history.
```

Credits and licenses (verbatim from Part 10.3.2):

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

Built-in content statement (to be completed by T04.10):

```text
Built-in content: the five demo songs, the tutorial, the character presets and the default
settings are part of the file as data or are generated by the program while it runs. Nothing
is downloaded or fetched.
```

No server headers needed (also for the folder README):

```text
No special server settings are needed. The game does not use SharedArrayBuffer, and it does
not need the COOP or COEP headers. It works when opened from a file or from any plain web server.
```
