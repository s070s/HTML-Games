// 28-modes.js - M-28 FLM.Modes (T01.09): the mode manager. Exactly one mode is active, enter and leave are
// serialized, every resource a mode creates carries the mode's owner token and is released on leave, and
// assertClean() proves that repeated navigation leaves nothing behind.
// Separation rule: this file owns exactly one namespace (Modes) and registers it once through FLM.Core.define.
// It declares no module-level global state object (S-07): state lives inside the factory closure.
// Module presence (convention 6 of Part 11): a step whose module is not built yet is skipped and logged once.
// One engine (S-18, T02.06): every mode that has music loads it into the one FLM.Transport.main and makes the one
// Scheduler binding; no mode creates a transport of its own.
// T03.10: the `instrument` mode is assembled (assembleGameplay, bindGameplayInput, startGameplay): the chart comes from
// params.testChart (test build only), a Judge is bound to Transport.main, Input is bound, pause and finish are handled.
// EXTENSION POINT: later tasks add their enter steps (generated charts, stage, the other modes) at the marked place in
// setupMode(); until Audio exists the 50 ms pump also makes the Scheduler's two calls for the transport.
// Spec: docs/IMPLEMENTATION-PLAN.md Part 4.7 (4.7.1 to 4.7.4) and Part 6.28 (6.28.2 to 6.28.4).
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Modes', function (FLM) {
  const Core = FLM.Core;
  const bus = Core.bus;
  const doc = window.document;

  const MODES_OWNER = Symbol('modes');       // owner of the permanent listeners (part of the menu baseline)
  const MENU_OWNER = Symbol('menu');
  const HARD_PANIC_WAIT_MS = 350;            // longest patch release 300 ms plus margin (Part 4.7.2 step 5)
  const AUTOSAVE_TIMEOUT_MS = 2000;
  const STALL_PAUSE_MS = 500;                // sched.stall gaps above this pause a playing gameplay mode
  const MENU_ROOTS = Object.freeze(['SCR-MainMenu', 'SCR-FirstLaunch']);
  const MENU_ROOT = 'SCR-MainMenu';
  const SESSION_MODES = Object.freeze(['quickplay', 'instrument', 'dance', 'studio']);   // flm.v1.lastSession
  const PROJECT_MODES = Object.freeze(['studio', 'freeplay']);                            // autosave on leave
  const RECORDER_BUSY = Object.freeze(['armed', 'countin', 'recording']);
  const FREE_PLAY_SONG_ID = 'freeplay';
  const STUDIO_SONG_ID = 'studio';
  const LIVE_TRACK_ID = 'fp';                // the one track of a Free Play song (Part 6.28.4.3)
  const TUTORIAL_SONG_ID = 'tut-basics';
  const PREVIEW_SECONDS = 15;                // library and import previews stop by themselves (Part 6.28.2)
  const MS_PER_SECOND = 1000;
  const PUMP_MS = 50;                        // the judge is ticked this often (Part 6.28.4.4 step 6)
  const SCHEDULER_LOOKAHEAD_S = 0.12;        // pull window of the stand-in Scheduler (S-10)
  const FINISH_DELAY_MS = 1500;              // "Song complete" shows this long before the results (Part 7.6.4)
  const FINISH_TICK_AHEAD_S = 10;            // a finishing judge is ticked this far ahead: every note is declared
  const LANE_CONTROL = /^lane[0-3]$/;
  const CALIBRATION_JUDGED = Object.freeze(['calibration.inputOffsetMs', 'calibration.audioLatencyMs']);
  const GAMEPLAY_INPUT_CONTEXT = 'instrument';
  const PAUSE_TEXT = Object.freeze({
    hidden: 'Paused because the game went to the background', blur: 'Paused because the window lost focus',
    audio: 'Paused because the sound stopped', gamepad: 'Controller disconnected', stall: 'Playback stalled',
    user: 'Paused', net: 'Paused because the connection changed'
  });
  const TEXT = Object.freeze({
    unsupportedTitle: 'Returned to the menu', graphicsPaused: 'Graphics paused', ok: 'OK',
    unsavedTitle: 'Leave without saving?', unsavedBody: 'This project has changes that are not saved.',
    songComplete: 'Song complete', calibrationChanged: 'Calibration changed; results not comparable.',
    allSoundStopped: 'All sound stopped.'
  });

  const MODES = Object.freeze(['menu', 'quickplay', 'instrument', 'freeplay', 'studio', 'library', 'import', 'dance',
    'multiplayer', 'customize', 'settings', 'help', 'about', 'diagnostics', 'tutorial', 'results']);
  const GAMEPLAY = Object.freeze(['quickplay', 'instrument', 'dance', 'multiplayer', 'tutorial']);
  const LIVE = Object.freeze(['freeplay', 'studio']);

  function deepFreeze(value) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach((name) => deepFreeze(value[name]));
    }
    return value;
  }

  // The Part 4.7 table as data (shape of Part 6.28.2). Panel modes share one base row.
  const PANEL_ROW = { audio: false, transport: 'none', scheduler: 'none', chart: 'none', stage: 'none',
    input: 'menu', hud: null, pads: 'never', landscape: false };
  const PLAY_ROW = { audio: true, transport: 'song', scheduler: 'bound', chart: 'instrument', stage: 'full',
    input: 'instrument', hud: 'instrument', pads: 'touch', landscape: true };
  const panel = (screen, extra) => Object.assign({}, PANEL_ROW, { screen }, extra);
  const play = (screen, extra) => Object.assign({}, PLAY_ROW, { screen }, extra);

  const REQUIREMENTS = deepFreeze({
    menu: panel('SCR-MainMenu'),
    quickplay: play('SCR-QuickPlay', { chart: 'either' }),
    instrument: play('SCR-Instrument'),
    freeplay: play('SCR-FreePlay', { transport: 'tempo', chart: 'none', stage: 'single', input: 'freeplay',
      hud: 'freeplay' }),
    studio: play('SCR-Studio', { transport: 'project', chart: 'none', stage: 'small', input: 'studio', hud: 'studio',
      pads: 'recording', landscape: false }),
    library: panel('SCR-Library', { transport: 'preview', scheduler: 'preview' }),
    import: panel('SCR-ImportInspect', { transport: 'preview', scheduler: 'preview', chart: 'instrument' }),
    dance: play('SCR-Dance', { chart: 'dance', input: 'dance', hud: 'dance' }),
    multiplayer: play('SCR-Multiplayer', { chart: 'either' }),
    customize: panel('SCR-Characters', { stage: 'single' }),
    settings: panel('SCR-Settings'),
    help: panel('SCR-Help'),
    about: panel('SCR-About'),
    diagnostics: panel('SCR-Diagnostics'),
    tutorial: play('SCR-Tutorial', { transport: 'tutorial', chart: 'step' }),
    results: panel('SCR-Results')
  });

  const state = {
    current: { mode: 'none', params: {}, owner: null, enteredAt: 0 },
    queue: Promise.resolve(),
    transitioning: false,
    baseline: null,
    baselineFromMenu: false,                 // false while the baseline is only the provisional load-time one
    initialized: false,
    pauseReason: null,
    rotateDismissed: false,
    skipGuardOnce: false,
    preview: { active: false, timer: null }, // the library or import preview on Transport.main (Part 6.28.3)
    gp: null                                 // gameplay assembly of the current mode, null when none (Part 6.28.3)
  };

  // ---------------------------------------------------------------- calling lower modules (module presence)

  function locate(path) {
    const names = path.split('.');
    const name = names.pop();
    const parent = names.reduce((node, key) => (node === undefined || node === null ? undefined : node[key]), FLM);
    return parent && typeof parent[name] === 'function' ? { parent, name } : null;
  }

  const available = (path) => locate(path) !== null;

  function invoke(path, ...args) {
    const spot = locate(path);
    return spot ? spot.parent[spot.name](...args) : undefined;
  }

  function noteSkip(step, path) {
    const namespace = path.split('.')[0];
    const reason = FLM[namespace] ? path + ' is not available' : namespace + ' not built';
    Core.Log.once('modes.skip.' + step + '.' + path, 'info', 'modes', 'skip ' + step + ': ' + reason);
  }

  /** Calls a lower-module function when it exists; otherwise logs the skip once. */
  function invokeStep(step, path, ...args) {
    if (!available(path)) {
      noteSkip(step, path);
      return undefined;
    }
    return invoke(path, ...args);
  }

  // Runs every call even when one throws, then rethrows the first error (one failure must not skip its siblings).
  async function runAll(step, calls) {
    let firstError = null;
    for (const call of calls) {
      try {
        await invokeStep(step, call[0], ...call.slice(1));
      } catch (error) {
        firstError = firstError || error;
      }
    }
    if (firstError) throw firstError;
  }

  const messageOf = (error) => (error && error.message ? String(error.message) : String(error));

  function plainCopy(value) {
    try {
      return JSON.parse(JSON.stringify(value));   // functions and cycles cannot travel in events
    } catch (error) {
      return {};
    }
  }

  function withTimeout(promise, limitMs) {
    return new Promise((resolve, reject) => {
      const timer = Core.timers.setTimeout(() => reject(new Error('timeout after ' + limitMs + ' ms')), limitMs,
        MODES_OWNER);
      promise.then(
        (value) => { Core.timers.clearTimeout(timer); resolve(value); },
        (error) => { Core.timers.clearTimeout(timer); reject(error); }
      );
    });
  }

  function sleep(ms, owner) {
    return new Promise((resolve) => Core.timers.setTimeout(resolve, ms, owner));
  }

  // ---------------------------------------------------------------- counters (Part 4.7.3, 6.28.4.11)

  const BASELINE = Symbol('baseline');       // the counter must equal its value in the menu baseline
  const NO_NEXT = Object.freeze({});

  const element = (id) => doc.getElementById(id);
  const glCounter = (name) => ({ path: 'Render.counters', map: (counts) => counts[name], want: BASELINE });

  // key: counter name; path: lower-module function to call; map: reduces its result; want: the condition after
  // leave (a constant, BASELINE, or a function of the current snapshot); no want = recorded, not asserted.
  const COUNTERS = Object.freeze([
    { key: 'activeVoices', path: 'Audio.VoiceAllocator.activeCount', want: 0 },
    { key: 'schedulerRunning', path: 'Audio.Scheduler.running', want: false },
    { key: 'schedulerPending', path: 'Audio.Scheduler.pending', want: 0 },
    { key: 'strips', path: 'Audio.stripCount', want: BASELINE },
    { key: 'audioNodes', path: 'Audio.nodeCount', want: BASELINE },
    { key: 'transportState', path: 'Transport.main.state', want: 'stopped' },
    { key: 'transportSong', path: 'Transport.main.song', map: (song) => song !== null, want: false },
    { key: 'timers', read: () => Core.timers.count(), want: BASELINE },
    { key: 'rafHandles', read: () => Core.raf.count(), want: 0 },
    { key: 'loopRunning', path: 'Render.loopRunning', want: false },
    { key: 'busListeners', read: () => bus.listenerCount(), want: BASELINE },
    { key: 'domListeners', read: () => Core.dom.count(), want: BASELINE },
    Object.assign({ key: 'glBuffers' }, glCounter('buffers')),
    Object.assign({ key: 'glTextures' }, glCounter('textures')),
    Object.assign({ key: 'glPrograms' }, glCounter('programs')),
    Object.assign({ key: 'glVaos' }, glCounter('vaos')),
    { key: 'sceneNodes', path: 'Render.renderer', map: (renderer) => (renderer ? renderer.scene.count() : 0), want: 0 },
    { key: 'openDialogs', read: () => FLM.UI.dialogCount(), want: 0 },
    { key: 'screenDepth', read: () => FLM.UI.Screens.depth(), want: (now) => (state.current.mode === 'none'
      ? now.screenDepth : 1) },
    { key: 'hudHidden', read: () => !element('hud') || element('hud').hidden, want: true },
    { key: 'touchHidden', read: () => !element('touch') || element('touch').hidden, want: true },
    { key: 'heldControls', path: 'Input.held', map: (held) => held.length, want: 0 },
    { key: 'boundSurfaces', path: 'Input.boundSurfaces', want: BASELINE },
    { key: 'recorderState', path: 'Studio.Recorder.state', want: 'idle' },
    { key: 'netConnections', path: 'Net.connectionCount', want: (now, options) => (netExempt(options) &&
      now.netConnections === 1 ? 1 : 0) },
    { key: 'audioBuffers', path: 'Import.audioBufferCount', want: () => (available('Project.current') &&
      invoke('Project.current') ? invoke('Project.current').audioTrackCount() : 0) },
    { key: 'undoDepth', path: 'Project.current',
      map: (project) => (project ? project.history.undoStack.counts().undo : 0) },
    { key: 'heapMB', read: () => (window.performance.memory ? window.performance.memory.usedJSHeapSize / 1048576
      : null) }
  ]);

  // The kept multiplayer session: leaving multiplayer for results (or back) keeps one connection open.
  function netExempt(options) {
    const next = options && options.next;
    const from = options && options.from;
    return (from === 'multiplayer' && next === 'results') || (from === 'results' && next === 'multiplayer');
  }

  function readCounter(counter) {
    try {
      if (counter.read) return counter.read();
      const value = invoke(counter.path);
      return counter.map ? counter.map(value) : value;
    } catch (error) {
      Core.Log.warn('modes', 'counter ' + counter.key + ' failed: ' + messageOf(error));
      return null;
    }
  }

  /** @returns {object} the current value of every counter whose module exists */
  function counters() {
    const snapshot = {};
    COUNTERS.forEach((counter) => {
      if (counter.read || available(counter.path)) snapshot[counter.key] = readCounter(counter);
    });
    return snapshot;
  }

  function expectedValue(counter, base, now, options) {
    if (counter.want === BASELINE) return base[counter.key];
    return typeof counter.want === 'function' ? counter.want(now, options) : counter.want;
  }

  /**
   * Compares the counters with the menu baseline (Part 4.7.3).
   * @param {{next?:string, from?:string, exempt?:string[]}=} options
   * @returns {(object|null)} null when clean, else {counter: {expected, actual}} for every violation
   */
  function assertClean(options) {
    const now = counters();
    const base = state.baseline || now;
    const strict = state.baselineFromMenu;   // a provisional baseline can only reveal growth, never shrinkage
    const exempt = (options && options.exempt) || [];
    const leaks = {};
    COUNTERS.forEach((counter) => {
      const asserted = counter.want !== undefined && counter.key in now && !exempt.includes(counter.key);
      if (!asserted || (counter.want === BASELINE && !(counter.key in base))) return;
      const expected = expectedValue(counter, base, now, options);
      const actual = now[counter.key];
      const differs = strict || counter.want !== BASELINE ? expected !== actual : actual > expected;
      if (differs) leaks[counter.key] = { expected, actual };
    });
    return Object.keys(leaks).length > 0 ? leaks : null;
  }

  // ---------------------------------------------------------------- leave (Part 4.7.2, 6.28.4.2)

  function leaveRecorder() {
    if (!available('Studio.Recorder.state')) return invokeStep('recorder', 'Studio.Recorder.state');
    return RECORDER_BUSY.includes(invoke('Studio.Recorder.state')) ? invoke('Studio.Recorder.abort') : undefined;
  }

  // Soft panic first; a voice that survives the 350 ms wait means a defect, so the bus graph is rebuilt.
  async function leaveHardPanic(context) {
    const counting = 'Audio.VoiceAllocator.activeCount';
    if (!available(counting)) return invokeStep('hardPanic', counting);
    if (invoke('Audio.VoiceAllocator.activeCount') === 0) return undefined;
    await sleep(HARD_PANIC_WAIT_MS, context.owner);
    if (invoke('Audio.VoiceAllocator.activeCount') === 0) return undefined;
    invokeStep('hardPanic', 'Audio.panic', true);
    Core.ErrorReporter.report('E-AUD-006', null, { module: 'Modes', mode: context.mode });
    return undefined;
  }

  // Step 6: the judge is disposed (its time map and calibration subscription go with it); charts are plain data.
  function leaveJudge() {
    const gp = state.gp;
    state.gp = null;
    if (gp && gp.judge) gp.judge.dispose();
  }

  // The Studio session closes its own strips; without it (not built yet) the plain unbind and unload apply.
  function leaveBindings(context) {
    state.preview.active = false;              // the stop and unload below end any preview; its timer dies by owner
    if (context.mode === 'studio' && available('Studio.Session.close')) return invoke('Studio.Session.close');
    return runAll('bindings', [['Audio.Scheduler.unbind'], ['Transport.main.unload']]);
  }

  function leaveTimers(context) {
    Core.timers.clearOwner(context.owner);
    Core.raf.cancelOwner(context.owner);
  }

  function leaveTextEntry() {
    FLM.UI.setTextEntryAllowed(true);
    doc.body.classList.remove('in-game');
  }

  function leaveHud() {
    FLM.UI.HUD.hide();
    FLM.UI.HUD.reset();
  }

  function leavePads() {
    FLM.UI.TouchPads.hide();
    hideRotate();
  }

  async function leaveScreens() {
    await FLM.UI.Screens.popTo(MENU_ROOT);
    doc.body.dataset.mode = 'menu';
  }

  function leaveListeners(context) {
    Core.dom.offOwner(context.owner);
    bus.removeOwner(context.owner);
  }

  function leaveNetwork(context) {
    if (context.mode !== 'multiplayer' || context.next === 'results') return undefined;
    return invokeStep('network', 'Net.close', context.reason);
  }

  async function leaveAutosave(context) {
    if (!PROJECT_MODES.includes(context.mode)) return;
    if (!available('Project.isDirty') || !available('Storage.autosave')) {
      noteSkip('autosave', available('Project.isDirty') ? 'Storage.autosave' : 'Project.isDirty');
      return;
    }
    if (!invoke('Project.isDirty')) return;
    await withTimeout(Promise.resolve(invoke('Storage.autosave', invoke('Project.current'))), AUTOSAVE_TIMEOUT_MS);
  }

  // Steps 1 to 13 of Part 4.7.2 in order (the HUD, pads, dialogs and screens are the four parts of step 10).
  const LEAVE_STEPS = Object.freeze([
    { name: 'input', run: (context) => runAll('input', [['Input.releaseAll', 'system'], ['Input.unbind',
      context.owner]]) },
    { name: 'recorder', run: leaveRecorder },
    { name: 'transport', run: () => invokeStep('transport', 'Transport.main.stop') },
    { name: 'panic', run: () => invokeStep('panic', 'Audio.panic', false) },
    { name: 'hardPanic', run: leaveHardPanic },
    { name: 'judge', run: leaveJudge },
    { name: 'bindings', run: leaveBindings },
    { name: 'stage', run: () => runAll('stage', [['Render.stopLoop'], ['Stage.dispose'], ['Animation.Mixer.dispose'],
      ['Render.Flat2D.clear']]) },
    { name: 'timers', run: leaveTimers },
    { name: 'textEntry', run: leaveTextEntry },
    { name: 'hud', run: leaveHud },
    { name: 'touchPads', run: leavePads },
    { name: 'dialogs', run: () => FLM.UI.closeAllDialogs('mode-leave') },
    { name: 'screens', run: leaveScreens },
    { name: 'listeners', run: leaveListeners },
    { name: 'network', run: leaveNetwork },
    { name: 'autosave', run: leaveAutosave }
  ]);

  async function runLeaveStep(step, context) {
    try {
      await step.run(context);
    } catch (error) {
      Core.ErrorReporter.report('E-MODE-003', error, { module: 'Modes', step: step.name, mode: context.mode });
    }
  }

  function isMenuLike(mode) {
    return mode === 'menu' || mode === 'none';
  }

  function menuState() {
    return { mode: 'menu', params: {}, owner: MENU_OWNER, enteredAt: Core.now() };
  }

  async function doLeave(reason, options) {
    const leaving = state.current;
    if (isMenuLike(leaving.mode)) return { leaks: null, ms: 0 };
    const started = Core.now();
    const next = options && options.next;
    const context = { mode: leaving.mode, owner: leaving.owner, reason, next };
    state.pauseReason = null;
    for (const step of LEAVE_STEPS) await runLeaveStep(step, context);
    const leaks = assertClean({ next, from: leaving.mode });
    if (leaks) {
      Core.ErrorReporter.report('E-MODE-001', new Error('leaked: ' + Object.keys(leaks).join(', ')),
        { module: 'Modes', mode: leaving.mode, leaks });
    }
    const ms = Math.round(Core.now() - started);
    state.current = menuState();
    bus.emit('mode.leave', { mode: leaving.mode, next, reason, ms, leaks });
    return { leaks, ms };
  }

  // ---------------------------------------------------------------- enter (Part 4.7.1, 6.28.4.1)

  function hideRotate() {
    const panelElement = element('rotate');
    if (panelElement) panelElement.classList.remove('show');
  }

  // One recommendation per mode enter; dismissing it never blocks anything (Part 6.28.4.9).
  function maybeShowRotate(mode) {
    const wanted = REQUIREMENTS[mode].landscape && !state.rotateDismissed;
    const panelElement = element('rotate');
    if (!wanted || !panelElement || panelElement.classList.contains('show')) return;
    if (!FLM.UI.Layout.compact() || FLM.UI.Layout.orientation() !== 'portrait') return;
    panelElement.classList.add('show');
    const dismiss = element('rotate-dismiss');
    if (dismiss) {
      Core.dom.on(dismiss, 'click', () => { state.rotateDismissed = true; hideRotate(); }, undefined,
        state.current.owner);
    }
  }

  function settingValue(path) {
    return FLM.Screens && FLM.Screens.Settings ? FLM.Screens.Settings.get(path) : undefined;
  }

  function hudKind(mode, params) {
    const wanted = REQUIREMENTS[mode].hud;
    if (wanted === null) return null;
    return (mode === 'quickplay' || mode === 'multiplayer') && params.kind === 'dance' ? 'dance' : wanted;
  }

  function showPads(mode, params) {
    const rule = REQUIREMENTS[mode].pads;
    const visibility = settingValue('input.padsVisible') || 'auto';
    const touchDevice = Core.Caps.get().maxTouchPoints > 0;
    const wanted = rule === 'touch' && (visibility === 'always' || (visibility === 'auto' && touchDevice));
    if (!wanted) return;
    FLM.UI.TouchPads.show({ kind: hudKind(mode, params) === 'dance' ? 'dance' : 'lanes',
      size: settingValue('input.padSize'), layout: settingValue('input.padLayout') });
  }

  // Steps of Part 4.7.1 whose module is not built yet; each is logged once and skipped (convention 6).
  const ASSEMBLED_MODES = Object.freeze(['instrument']);   // the judge and input steps are wired for these (T03.10)
  const PENDING_STEPS = Object.freeze([
    { step: 'audio binding', module: 'Audio', applies: (row) => row.scheduler !== 'none' },
    { step: 'charts', module: 'Mapping', applies: (row) => row.chart !== 'none' },
    { step: 'judge', module: 'Rhythm',
      applies: (row, mode) => row.chart !== 'none' && !ASSEMBLED_MODES.includes(mode) },
    { step: 'stage', module: 'Stage', applies: (row) => row.stage !== 'none' },
    { step: 'input', module: 'Input', applies: (row, mode) => !ASSEMBLED_MODES.includes(mode) }
  ]);

  function notePendingSteps(mode) {
    const row = REQUIREMENTS[mode];
    PENDING_STEPS.filter((item) => item.applies(row, mode)).forEach((item) => {
      const reason = FLM[item.module] ? item.module + ' step not wired yet' : item.module + ' not built';
      Core.Log.once('modes.skip.enter.' + item.step, 'info', 'modes', 'skip ' + item.step + ': ' + reason);
    });
  }

  // ---------------------------------------------------------------- music and binding (Part 4.7.1 steps 5 and 6)

  /** A song made through Song.create for a mode with no catalog song: Free Play (one track) or Studio (empty). */
  function createLiveSong(id, title, withTrack) {
    const song = FLM.Model.Song.create({ id, title });
    if (withTrack) {
      FLM.Model.Song.addTrack(song, FLM.Model.Track.create({ id: LIVE_TRACK_ID, name: title, lockedSource: false },
        song));
    }
    return song;
  }

  // Null while the catalog is not built; a catalog that does not know the id is a failed enter (E-MODE-002).
  async function catalogSong(songId) {
    if (!available('Project.Catalog.getSong')) {
      noteSkip('music', 'Project.Catalog.getSong');
      return null;
    }
    const song = await invoke('Project.Catalog.getSong', songId);
    if (!song) throw new Error('song not found: ' + songId);
    return song;
  }

  function playableSong(mode, params) {
    if (params.song && Array.isArray(params.song.tracks)) return params.song;
    const songId = mode === 'tutorial' ? TUTORIAL_SONG_ID : params.songId;
    return typeof songId === 'string' ? catalogSong(songId) : null;
  }

  function projectSong() {
    const project = available('Project.current') ? invoke('Project.current') : null;
    return project && project.song ? project.song : createLiveSong(STUDIO_SONG_ID, 'Studio', false);
  }

  /** The Song a mode puts into Transport.main, chosen by its REQUIREMENTS row; null means nothing to load. */
  function songFor(mode, params) {
    const source = REQUIREMENTS[mode].transport;
    if (source === 'tempo') return createLiveSong(FREE_PLAY_SONG_ID, 'Free Play', true);
    if (source === 'project') return projectSong();
    if (source === 'song' || source === 'tutorial') return playableSong(mode, params);
    return null;                               // 'none', and 'preview' (preview() loads it, not enter)
  }

  function mixerSettings() {
    const volume = settingValue('audio.masterVolume');
    return { master: { gain: typeof volume === 'number' ? volume : 1 } };
  }

  /**
   * Steps 5 and 6: the song goes into the one Transport.main (never a transport of this mode's own, S-18) and the
   * one Scheduler binding is made over it. Free Play runs on the override tempo; the visibility policy follows the
   * mode kind (gameplay pauses in the background, live modes continue and re-anchor, Part 4.7.4).
   */
  async function setupMusic(mode, params) {
    const row = REQUIREMENTS[mode];
    if (row.transport === 'none') return;
    invokeStep('music', 'Transport.main.setVisibilityPolicy', LIVE.includes(mode) ? 'continue' : 'pause');
    const song = await songFor(mode, params);
    if (song === null) return;
    const tempoOnly = row.transport === 'tempo';
    const options = tempoOnly ? { tempoSource: 'override', overrideBpm: params.overrideBpm } : undefined;
    invokeStep('music', 'Transport.main.load', song, options);
    if (row.scheduler === 'bound') {
      invokeStep('audio binding', 'Audio.Scheduler.bind', FLM.Transport.main, song, mixerSettings());
    }
  }

  // ---------------------------------------------------------------- gameplay assembly (Part 4.7.1 steps 7, 8, 10, 14)
  // Built for `instrument` only (T03.10). Steps 6, 7 and 9 wait for Audio, the chart generator and the stage: the
  // chart comes from params.testChart (a Chart, or null for playback without a Judge), a test-build hook that is
  // never reachable from the UI and is refused in the shipped build.

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isTestBuild = () => Boolean(FLM.SelfTest);

  function refuseTestHooks(params) {
    if (hasOwn(params, 'testChart') && !isTestBuild()) {
      throw new Error('params.testChart is only available in the test build');
    }
  }

  /** Step 7 until Phase 08: the given test chart, or null (no chart, so no Judge). */
  function chartFromParams(params) {
    if (hasOwn(params, 'testChart')) return params.testChart;
    noteSkip('charts', 'Mapping.ChartGenerator.generateAsync');
    return null;
  }

  /** Step 8: a Judge bound to Transport.main. Calibration is applied once, inside the Judge (S-04). */
  function createJudge(chart, song) {
    if (chart === null) return null;
    if (!available('Rhythm.Judge.bind')) {
      noteSkip('judge', 'Rhythm.Judge.bind');
      return null;
    }
    const judge = FLM.Rhythm.Judge.bind({ timeMap: FLM.Transport.main,
      strayPenalty: settingValue('gameplay.strayPressPenalty') === true ? 'combo' : 'none',
      windowsPreset: settingValue('gameplay.judgmentPreset') || 'standard' });
    try {
      judge.load(chart, song);                 // a bad chart throws E-INP-012 and the enter fails
    } catch (error) {
      judge.dispose();
      throw error;
    }
    return judge;
  }

  /** A judge listens only while the transport plays: no judgment, stray or miss during count-in or pause. */
  function syncJudgeActivity() {
    const gp = state.gp;
    if (!gp || !gp.judge || !available('Transport.main.state')) return;
    const running = ['playing', 'recording'].includes(invoke('Transport.main.state'));
    gp.judge.setActive(running);
    if (running) gp.began = true;
  }

  // The Scheduler normally makes these two calls for the transport (Part 6.4.4.9). Until M-05 exists the pump makes
  // them, so that the count-in ends and the end of the song is detected.
  function standInForScheduler(now) {
    if (available('Audio.Scheduler.bind')) return;
    invokeStep('transport pump', 'Transport.main.update', now);
    invokeStep('transport pump', 'Transport.main.pullDue', now + SCHEDULER_LOOKAHEAD_S);
  }

  function refreshHud(now, gp) {
    const tick = invoke('Transport.main.positionAt', now);
    const duration = gp.song.durationTicks;
    const counting = invoke('Transport.main.state') === 'countin';
    const countIn = counting ? invoke('Transport.main.meterMap').beatAt(tick).beat + 1 : null;
    FLM.UI.HUD.set({ progress: duration > 0 ? Core.clamp(tick / duration, 0, 1) : 0, countIn });
  }

  /** The 50 ms pump: transport stand-in, judge ticks (misses) and the time-driven HUD fields. */
  function pump() {
    const gp = state.gp;
    if (!gp || gp.finishing) return;
    const now = audioClockNow();
    standInForScheduler(now);
    if (state.gp !== gp || gp.finishing) return;
    if (gp.judge) gp.judge.tick(now);
    refreshHud(now, gp);
  }

  // M-07 releases a lost gamepad's controls (source 'system') just before it reports input.device. The flag lives
  // only until the end of that synchronous run, so an unrelated release-all never looks like a lost device.
  function trackGamepad(gp, evt) {
    if (evt.type === 'press' && evt.source === 'gamepad') gp.gamepadHeld.add(evt.control);
    if (evt.type !== 'release' || !gp.gamepadHeld.delete(evt.control) || evt.source !== 'system') return;
    gp.deviceLost = true;
    Promise.resolve().then(() => { gp.deviceLost = false; });
  }

  function onPauseControl() {
    if (state.gp.finishing) return;
    if (state.pauseReason === null) {
      startPause('user');
      return;
    }
    const top = FLM.UI.Screens.current();
    if (top && top.id === 'SCR-Pause' && typeof top.controller.onBack === 'function') top.controller.onBack('key');
  }

  // KeyP: pauses first, then stops every sound (Part 7.6.4); Audio itself arrives with T04.01.
  function onPanicControl() {
    if (state.pauseReason === null) startPause('user');
    invokeStep('panic', 'Audio.panic', false);
    FLM.UI.toast(TEXT.allSoundStopped, { kind: 'info', key: 'play.panic' });
  }

  /** The one input.event subscription of a gameplay mode: judge routing and the pause and panic controls. */
  function onGameplayInput(evt) {
    const gp = state.gp;
    if (!gp || !evt) return;
    trackGamepad(gp, evt);
    if (LANE_CONTROL.test(evt.control)) {
      if (gp.judge) gp.judge.onInput(evt);     // inactive while paused: nothing is judged, no stray is counted
      return;
    }
    if (evt.type !== 'press') return;
    if (evt.control === 'pause') onPauseControl();
    else if (evt.control === 'panic') onPanicControl();
  }

  function resultsScreenBuilt() {
    try {
      return Boolean(FLM.Screens && FLM.Screens.get('SCR-Results'));
    } catch (error) {
      return false;
    }
  }

  /** After "Song complete": the results mode, or the menu while SCR-Results is not built (Part 4.7.1 step 12). */
  async function leaveAfterFinish(gp) {
    if (state.gp !== gp) return;
    const results = resultsScreenBuilt();
    const replay = { mode: state.current.mode, params: state.current.params };
    await leave('finished', results ? { next: 'results' } : undefined);
    if (results) await enter('results', { summary: gp.summary, replay, returnTo: replay.params.returnTo });
  }

  /** Once per gameplay (the finishing guard): declares the remaining notes, ends the Judge, shows the end note. */
  function finishGameplay(endedBy) {
    const gp = state.gp;
    if (!gp || gp.finishing) return;
    gp.finishing = true;
    if (gp.judge) {
      gp.judge.tick(audioClockNow() + FINISH_TICK_AHEAD_S);
      gp.judge.finish(endedBy, { songId: gp.song.id, startedAt: gp.startedAtIso,
        durationSec: (Core.now() - gp.startedAtMs) / MS_PER_SECOND });
    }
    FLM.UI.HUD.note(TEXT.songComplete);
    Core.timers.setTimeout(() => {
      leaveAfterFinish(gp).catch((error) => Core.Log.warn('modes', 'finish failed: ' + messageOf(error)));
    }, FINISH_DELAY_MS, gp.owner);
  }

  function onTransportState(event) {
    const gp = state.gp;
    if (!gp || !event) return;
    if (event.state === 'stopped' && event.reason === 'end') finishGameplay('end');   // before the judge goes idle
    syncJudgeActivity();
  }

  function onChartFinished(event) {
    const gp = state.gp;
    if (!gp || !event) return;
    gp.summary = event.summary;
    finishGameplay(event.endedBy);
  }

  // S-PLAY-08 (OI-23): a calibration change after the run began makes the results not comparable (the Judge flags it).
  function onSettingsChanged(event) {
    const gp = state.gp;
    if (!gp || !gp.judge || !gp.began || !event) return;
    const keys = event.key === '*' && Array.isArray(event.keys) ? event.keys : [event.key];
    if (!keys.some((key) => CALIBRATION_JUDGED.includes(key))) return;
    FLM.UI.toast(TEXT.calibrationChanged, { kind: 'warn', key: 'play.calibrationChanged' });
  }

  function subscribeGameplay(owner) {
    const on = (topic, handler) => bus.on(topic, handler, owner);
    on('input.event', onGameplayInput);
    on('transport.state', onTransportState);
    on('chart.finished', onChartFinished);
    on('settings.changed', onSettingsChanged);
  }

  /** Steps 7, 8 and 12 of Part 4.7.1 for a mode that has a song loaded; null when there is nothing to assemble. */
  function assembleGameplay(mode, params) {
    if (!ASSEMBLED_MODES.includes(mode) || !available('Transport.main.song')) return;
    const song = invoke('Transport.main.song');
    if (song === null) return;
    const chart = chartFromParams(params);
    const owner = state.current.owner;
    state.gp = { owner, song, chart, judge: createJudge(chart, song), began: false, finishing: false, summary: null,
      gamepadHeld: new Set(), deviceLost: false, startedAtIso: new Date().toISOString(), startedAtMs: Core.now() };
    subscribeGameplay(owner);
    Core.timers.setInterval(pump, PUMP_MS, owner);
  }

  /** Step 10: the input context of the mode and the in-game look (no text entry, Escape belongs to pause). */
  function bindGameplayInput() {
    if (state.gp === null) return;
    invokeStep('input', 'Input.bind', { owner: state.current.owner, context: GAMEPLAY_INPUT_CONTEXT,
      surface: '#view', pads: '#touch' });
    FLM.UI.setTextEntryAllowed(false);
    doc.body.classList.add('in-game');
  }

  function countInBarsFor(params) {
    if ([0, 1, 2].includes(params.countInBars)) return params.countInBars;
    return settingValue('gameplay.autoCountIn') === false ? 0 : (settingValue('audio.countInBars') || 0);
  }

  /** Step 14: the transport starts, with the count-in of the settings (or params.countInBars). */
  function startGameplay(params) {
    if (state.gp === null || params.autoStart === false) return;
    invokeStep('start', 'Transport.main.play', { countInBars: countInBarsFor(params) });
  }

  /** Part 6.28.2 gameplayState(): what a screen or test may ask about the running gameplay. */
  function gameplayState() {
    const gp = state.gp;
    if (gp === null) return { active: false, kind: null, chartId: null, settingsHash: null, speed: 1, passes: [],
      finished: false };
    return { active: true, kind: 'instrument', chartId: gp.chart ? gp.chart.id : null,
      settingsHash: gp.chart ? gp.chart.settingsHash || null : null, speed: invoke('Transport.main.speed'),
      passes: [], finished: gp.finishing };
  }

  async function setupMenu(params) {
    if (FLM.UI.Screens.depth() === 0) {
      const root = MENU_ROOTS.includes(params.screen) ? params.screen : MENU_ROOT;
      await FLM.UI.Screens.push(root, params);
    }
    if (typeof params.returnTo === 'string') await FLM.UI.Screens.push(params.returnTo, params);
  }

  async function pushModeScreen(mode, params) {
    const screen = REQUIREMENTS[mode].screen;
    const top = FLM.UI.Screens.current();
    if (top && top.id === screen) await FLM.UI.Screens.replace(screen, Object.assign({ phase: 'play' }, params));
    else await FLM.UI.Screens.push(screen, GAMEPLAY.includes(mode) ? Object.assign({ phase: 'play' }, params) : params);
  }

  /** Steps 5 to 12 of Part 4.7.1. */
  async function setupMode(mode, params) {
    if (mode === 'menu') {
      await setupMenu(params);
      return;
    }
    notePendingSteps(mode);
    await setupMusic(mode, params);
    assembleGameplay(mode, params);
    // EXTENSION POINT: stage (step 9) and the other modes' charts and judges go here (later tasks).
    bindGameplayInput();
    const kind = hudKind(mode, params);
    if (kind !== null) FLM.UI.HUD.show(kind, state.current.owner);
    showPads(mode, params);
    await pushModeScreen(mode, params);
    maybeShowRotate(mode);
  }

  // Part 4.7 table note: a mode that needs sound waits for DLG-AudioBlocked (built by T01.11) or is refused.
  async function passAudioGate(mode) {
    if (!REQUIREMENTS[mode].audio) return true;
    if (!available('Audio.isUnlocked')) {
      noteSkip('audio unlock', 'Audio.isUnlocked');
      return true;
    }
    if (invoke('Audio.isUnlocked')) return true;
    const canAsk = FLM.Screens && typeof FLM.Screens.dialog === 'function';
    const answer = canAsk ? await FLM.Screens.dialog('DLG-AudioBlocked', { mode }) : 'cancel';
    if (answer === 'enabled') return true;
    Core.ErrorReporter.report('E-AUD-002', null, { module: 'Modes', mode });
    return false;
  }

  function rememberMode(mode, params) {
    if (FLM.Screens && FLM.Screens.Settings) FLM.Screens.Settings.set('onboarding.lastMode', mode, 'ui');
    if (!SESSION_MODES.includes(mode)) return;
    FLM.Storage.set(FLM.Storage.KEYS.lastSession, { mode, projectId: params.projectId || null,
      songId: params.songId || null, at: new Date().toISOString() });
  }

  function showError(record) {
    const known = FLM.Screens && typeof FLM.Screens.showError === 'function';
    const shown = known ? FLM.Screens.showError(record) : FLM.UI.dialog({ id: 'DLG-Unsupported',
      title: TEXT.unsupportedTitle, body: record.userMessage || record.message,
      buttons: [{ id: 'ok', label: TEXT.ok, kind: 'primary', isDefault: true, isCancel: true }] });
    Promise.resolve(shown).catch((error) => Core.Log.warn('modes', 'error dialog failed: ' + messageOf(error)));
  }

  async function failEnter(mode, error) {
    const record = Core.ErrorReporter.report('E-MODE-002', error, { module: 'Modes', mode,
      message: messageOf(error) });
    await doLeave('error', { next: 'menu' });
    showError(record);                         // not awaited: the dialog waits for the user, the transition does not
    return { ok: false, mode: 'menu', error: record };
  }

  // The HUD builds its nodes and listeners on first use; building them now keeps them in the baseline.
  function takeBaseline() {
    FLM.UI.HUD.note('');
    state.baseline = counters();
    state.baselineFromMenu = true;
  }

  // Boot enters the menu first; a mode entered before that gets the menu root under it (leave pops back to it).
  async function openMenuRoot() {
    state.current = menuState();
    doc.body.dataset.mode = 'menu';
    await setupMenu({});
  }

  async function doEnter(mode, rawParams) {
    const started = Core.now();
    const prev = state.current.mode;
    const params = rawParams && typeof rawParams === 'object' ? rawParams : {};
    try {
      Core.assert(MODES.includes(mode), 'unknown mode ' + mode);
      refuseTestHooks(params);
      if (!isMenuLike(state.current.mode)) await doLeave('user', { next: mode });
      if (state.current.mode === 'none' && mode !== 'menu') await openMenuRoot();
      // Taken only in the menu (Part 4.7.1 step 2). Entering the menu itself takes it after the menu screen is
      // mounted, because menu-level resources (the screen and its listeners) belong to the baseline.
      if (mode !== 'menu') takeBaseline();
      if (!(await passAudioGate(mode))) return { ok: false, mode: 'menu' };
      const owner = mode === 'menu' ? MENU_OWNER : Symbol(mode + ':' + Core.uid());
      state.current = { mode, params, owner, enteredAt: Core.now() };
      doc.body.dataset.mode = mode;
      await setupMode(mode, params);
      if (mode === 'menu') takeBaseline();
      bus.emit('mode.enter', { mode, prev, params: plainCopy(params), ms: Math.round(Core.now() - started) });
      rememberMode(mode, params);
      startGameplay(params);
      return { ok: true, mode };
    } catch (error) {
      return failEnter(mode, error);
    }
  }

  // Serialization: every transition waits for the one before it (Part 4.7). Jobs never reject.
  function runExclusive(job) {
    const run = state.queue.then(async () => {
      state.transitioning = true;
      try {
        return await job();
      } finally {
        state.transitioning = false;
      }
    });
    state.queue = run.catch(() => {});
    return run;
  }

  /** @returns {Promise<{ok:boolean, mode:string, error?:object}>} never rejects; failure returns to the menu */
  function enter(mode, params) {
    return runExclusive(() => doEnter(mode, params));
  }

  /**
   * Full teardown to the menu (Part 4.7.2). Never rejects; a failing step is reported as E-MODE-003 and the
   * sequence continues.
   * @param {string} reason 'user', 'finished', 'error', 'interrupt' or 'net'
   * @param {{next?:string}=} options
   * @returns {Promise<{leaks:(object|null), ms:number}>}
   */
  function leave(reason, options) {
    return runExclusive(() => doLeave(reason || 'user', options || NO_NEXT));
  }

  /** Restarts the current mode with changed parameters (fresh state; gameplay assembly refines it later). */
  async function restart(changes) {
    const mode = state.current.mode;
    if (isMenuLike(mode)) return;
    await enter(mode, Object.assign({}, state.current.params, changes || {}));
  }

  // ---------------------------------------------------------------- previews (library and import, Part 6.28.2)

  /** Ends a preview: stop, release the Scheduler binding, unload the song. Safe to call when none is playing. */
  async function stopPreview() {
    if (!state.preview.active) return;
    Core.timers.clearTimeout(state.preview.timer);
    state.preview = { active: false, timer: null };
    await runAll('preview', [['Transport.main.stop'], ['Audio.Scheduler.unbind'], ['Transport.main.unload']]);
  }

  /**
   * Plays a candidate song on the one Transport.main in a mode whose row says 'preview' (library, import); the
   * Scheduler binding is made here and released when the preview stops or the mode leaves.
   * @param {(object|string)} songOrId a Song, or a catalog id
   * @param {{fromTick?:number, durationS?:number}=} options
   * @returns {Promise<{ok:boolean}>}
   */
  async function preview(songOrId, options) {
    const given = options || {};
    const mode = state.current.mode;
    const owner = state.current.owner;
    if (!REQUIREMENTS[mode] || REQUIREMENTS[mode].transport !== 'preview') return { ok: false };
    const song = typeof songOrId === 'string' ? await catalogSong(songOrId) : songOrId;
    const usable = song && Array.isArray(song.tracks) && available('Transport.main.play');
    if (!usable || state.current.owner !== owner) return { ok: false };
    await stopPreview();
    invoke('Transport.main.load', song);
    invokeStep('audio binding', 'Audio.Scheduler.bind', FLM.Transport.main, song, mixerSettings());
    const seconds = Number.isFinite(given.durationS) ? given.durationS : PREVIEW_SECONDS;
    const timer = Core.timers.setTimeout(() => {
      stopPreview().catch((error) => Core.Log.warn('modes', 'preview stop failed: ' + messageOf(error)));
    }, seconds * MS_PER_SECOND, owner);
    state.preview = { active: true, timer };
    return { ok: invoke('Transport.main.play', { countInBars: 0, fromTick: given.fromTick }) === true };
  }

  // ---------------------------------------------------------------- pause and interruptions (Part 4.7.4)

  const isGameplay = (mode) => GAMEPLAY.includes(mode === undefined ? state.current.mode : mode);

  function releaseInputs() {
    invokeStep('release', 'Input.releaseAll', 'system');
  }

  /** Pauses the transport, releases inputs and shows SCR-Pause when it exists. @returns {Promise<boolean>} */
  async function pause(reason) {
    if (!isGameplay() || state.pauseReason !== null) return false;
    if (state.gp && state.gp.finishing) return false;   // the song is over: nothing left to pause
    state.pauseReason = reason;
    invokeStep('pause', 'Transport.main.pause');
    syncJudgeActivity();                                // the judge is idle before the held controls are released
    releaseInputs();
    if (state.gp) FLM.UI.setTextEntryAllowed(true);
    try {
      await FLM.UI.Screens.push('SCR-Pause', { reason, text: PAUSE_TEXT[reason] || PAUSE_TEXT.user });
    } catch (error) {
      Core.Log.once('modes.skip.pause-screen', 'info', 'modes', 'skip SCR-Pause: ' + messageOf(error));
    }
    return true;
  }

  /** Pops SCR-Pause and resumes the transport. @returns {Promise<boolean>} */
  async function resume() {
    if (state.pauseReason === null) return false;
    state.pauseReason = null;
    const top = FLM.UI.Screens.current();
    if (top && top.id === 'SCR-Pause') await FLM.UI.Screens.pop();
    invokeStep('resume', 'Transport.main.resume');
    syncJudgeActivity();                                // holds that began before the pause are checked here
    if (state.gp) FLM.UI.setTextEntryAllowed(false);
    return true;
  }

  function startPause(reason) {
    pause(reason).catch((error) => Core.Log.warn('modes', 'pause failed: ' + messageOf(error)));
    return 'paused';
  }

  function transportIsRunning() {
    if (!available('Transport.main.state')) return true;   // a gameplay mode is active, so assume it is playing
    return ['playing', 'countin'].includes(invoke('Transport.main.state'));
  }

  // Rows of Part 6.28.4.9 for the sources that exist in this build. Each handler returns the action taken.
  // Live modes keep playing in the background; Transport.main notes when it was hidden so onVisible can compare the
  // audio clock with the performance clock and re-anchor on a drift over 5 ms (Part 4.7.4, UT-04-22).
  function audioClockNow() {
    return available('Audio.clock') ? invoke('Audio.clock').now() : Core.now() / MS_PER_SECOND;
  }

  function whenHidden(kind) {
    if (kind === 'gameplay') return startPause('hidden');
    if (kind !== 'live') return 'ignored';
    invokeStep('visibility', 'Transport.main.onHidden', audioClockNow(), Core.now());
    return releaseAndReport();
  }

  // A re-anchor after the background is recoverable and silent: logged and counted in the diagnostics (E-AUD-009).
  function reportDrift(result) {
    if (!result || result.drifted !== true) return;
    Core.ErrorReporter.report('E-AUD-009', null, { module: 'Modes', driftMs: result.driftMs });
  }

  function whenVisible(kind) {
    if (kind === 'panel') return 'ignored';
    if (kind === 'live') {
      reportDrift(invokeStep('visibility', 'Transport.main.onVisible', audioClockNow(), Core.now()));
    }
    return 'continued';
  }

  function releaseAndReport() {
    releaseInputs();
    return 'released';
  }

  function whenPageHidden(kind) {
    if (FLM.Screens && FLM.Screens.Settings) FLM.Screens.Settings.flush();
    return whenHidden(kind);
  }

  function whenBlur(kind) {
    if (kind === 'gameplay') return transportIsRunning() ? startPause('blur') : 'ignored';
    return kind === 'live' ? 'continued' : 'ignored';
  }

  function whenAudioStops(kind) {
    if (kind === 'gameplay') return startPause('audio');
    if (kind !== 'live') return 'ignored';
    invokeStep('pause', 'Transport.main.pause');
    return 'paused';
  }

  function whenGamepadGone(kind, detail) {
    if (kind === 'gameplay' && detail && detail.released) return startPause('gamepad');
    return kind === 'live' ? 'released' : 'ignored';
  }

  function whenStalled(kind, detail) {
    if (!detail || !(detail.gapMs > STALL_PAUSE_MS)) return 'ignored';
    if (kind === 'gameplay') return startPause('stall');
    return kind === 'live' ? 'continued' : 'ignored';
  }

  function whenGraphicsChange(kind, lost) {
    if (kind === 'panel' || !FLM.UI.HUD.visible()) return 'ignored';
    FLM.UI.HUD.note(lost ? TEXT.graphicsPaused : '');
    return 'continued';
  }

  function whenLayoutChanges() {
    FLM.UI.TouchPads.layout();
    invokeStep('layout', 'Input.layoutChanged');           // the pad rectangles M-07 hit-tests are measured again
    if (!isMenuLike(state.current.mode)) maybeShowRotate(state.current.mode);
    return 'continued';
  }

  function whenNetworkEnds() {
    if (state.current.mode !== 'multiplayer') return 'ignored';
    leave('net').catch(() => {});
    return 'ended';
  }

  const INTERRUPTS = Object.freeze({
    hidden: whenHidden,
    visible: whenVisible,
    pagehide: whenPageHidden,
    freeze: whenPageHidden,
    blur: whenBlur,
    audio: whenAudioStops,
    gamepad: whenGamepadGone,
    stall: whenStalled,
    contextLost: (kind) => whenGraphicsChange(kind, true),
    contextRestored: (kind) => whenGraphicsChange(kind, false),
    layout: whenLayoutChanges,
    net: whenNetworkEnds
  });

  function modeKind() {
    const mode = state.current.mode;
    if (GAMEPLAY.includes(mode)) return 'gameplay';
    return LIVE.includes(mode) ? 'live' : 'panel';
  }

  /**
   * Handles an interruption for the current mode kind (gameplay, live or panel).
   * @param {string} cause 'hidden', 'visible', 'pagehide', 'freeze', 'blur', 'audio', 'gamepad', 'stall',
   *   'contextLost', 'contextRestored', 'layout' or 'net'
   * @returns {string} 'paused', 'continued', 'ended', 'released' or 'ignored'
   * Emits: mode.interrupted {mode, cause, action} for every handled row
   */
  function onInterrupt(cause, detail) {
    const handler = INTERRUPTS[cause];
    if (!handler || isMenuLike(state.current.mode)) return 'ignored';
    const action = handler(modeKind(), detail);
    if (action !== 'ignored') bus.emit('mode.interrupted', { mode: state.current.mode, cause, action });
    return action;
  }

  // ---------------------------------------------------------------- init: permanent listeners (Part 6.28.4.12)

  // Browser back: the unsaved-changes guard first, then the screen stack decides (Part 6.28.4.12).
  async function confirmLeaveUnsaved() {
    const dirty = available('Project.isDirty') && invoke('Project.isDirty');
    if (!dirty || !PROJECT_MODES.includes(state.current.mode)) return true;
    const answer = await FLM.UI.confirmUnsaved({ title: TEXT.unsavedTitle, body: TEXT.unsavedBody });
    return answer === 'discard';
  }

  async function onPopState(event) {
    const skipGuard = state.skipGuardOnce;
    state.skipGuardOnce = false;
    if (!skipGuard && !(await confirmLeaveUnsaved())) {
      state.skipGuardOnce = true;              // history.forward() fires one more popstate; let it through
      window.history.forward();
      return;
    }
    await FLM.UI.Screens.onPopState(event.state);
  }

  function guarded(handler) {
    return (event) => {
      Promise.resolve(handler(event)).catch((error) => Core.ErrorReporter.report('E-GEN-001', error,
        { module: 'Modes', op: 'listener' }));
    };
  }

  function installListeners() {
    const listen = (target, type, handler) => Core.dom.on(target, type, guarded(handler), undefined, MODES_OWNER);
    listen(window, 'popstate', onPopState);
    listen(doc, 'visibilitychange', () => onInterrupt(doc.visibilityState === 'hidden' ? 'hidden' : 'visible'));
    listen(window, 'pagehide', () => onInterrupt('pagehide'));
    listen(doc, 'freeze', () => onInterrupt('freeze'));
    listen(window, 'blur', () => onInterrupt('blur'));
  }

  // A returnToMenu error raised outside a transition sends the user back to the menu (Part 6.28.4.9).
  function onErrorRecord(record) {
    const ours = record.code === 'E-MODE-002';   // enter reports and handles its own failures
    if (record.class !== 'returnToMenu' || ours || state.transitioning) return;
    leave('error').then(() => showError(record));
  }

  function subscribe() {
    const on = (topic, handler) => bus.on(topic, handler, MODES_OWNER);
    on('error', onErrorRecord);
    // Boot-only resources (the error escalation listener) are gone once the menu is up: baseline again then.
    on('boot.ready', () => { if (isMenuLike(state.current.mode)) takeBaseline(); });
    on('audio.state', (event) => { if (event && event.state !== 'running') onInterrupt('audio'); });
    on('render.contextLost', () => onInterrupt('contextLost'));
    on('render.contextRestored', () => onInterrupt('contextRestored'));
    on('ui.layout', () => onInterrupt('layout'));
    on('input.device', (event) => {
      if (!event || event.source !== 'gamepad' || event.connected !== false) return;
      // E-INP-003: only a pad that had a control held pauses the song (M-07 released those controls just before).
      onInterrupt('gamepad', Object.assign({}, event, { released: Boolean(state.gp && state.gp.deviceLost) }));
    });
    on('sched.stall', (event) => onInterrupt('stall', event));
    on('net.state', (event) => {
      if (event && (event.state === 'ended' || event.state === 'error')) onInterrupt('net');
    });
  }

  /** Boot step B10: browser history on, interruption listeners and subscriptions installed once. */
  function init() {
    if (state.initialized) return;
    state.initialized = true;
    state.current = { mode: 'none', params: {}, owner: null, enteredAt: 0 };
    FLM.UI.Screens.setHistory(true);
    installListeners();
    subscribe();
    FLM.UI.HUD.note('');
    state.baseline = counters();               // these permanent listeners are part of the menu baseline
    state.baselineFromMenu = false;
  }

  // Tests only: removes the permanent listeners and returns to the "none" state.
  function teardownForTests() {
    leaveJudge();
    Core.dom.offOwner(MODES_OWNER);
    bus.removeOwner(MODES_OWNER);
    Core.timers.clearOwner(MODES_OWNER);
    if (state.initialized) FLM.UI.Screens.setHistory(false);
    Object.assign(state, { current: { mode: 'none', params: {}, owner: null, enteredAt: 0 },
      queue: Promise.resolve(), transitioning: false, initialized: false, pauseReason: null,
      rotateDismissed: false, skipGuardOnce: false, baselineFromMenu: false, preview: { active: false, timer: null },
      gp: null });
    state.baseline = counters();
  }

  state.baseline = counters();                 // provisional baseline until the first menu entry (see assertClean)

  return Object.freeze({
    MODES,
    GAMEPLAY,
    LIVE,
    REQUIREMENTS,
    init,
    enter,
    leave,
    restart,
    current: () => ({ mode: state.current.mode, params: plainCopy(state.current.params),
      enteredAt: state.current.enteredAt, transitioning: state.transitioning }),
    params: () => plainCopy(state.current.params),
    isGameplay,
    isTransitioning: () => state.transitioning,
    gameplayState,
    pause,
    resume,
    preview,
    stopPreview,
    onInterrupt,
    baseline: counters,
    assertClean,
    counters,
    _teardownForTests: teardownForTests
  });
});
})();
