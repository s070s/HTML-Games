// 29-boot.js - M-29 FLM.Boot (T01.10): the initialization order of Part 4.3 (Phase B steps B1 to B16), the
// capability gate, URL parameters, the boot progress panel, the audio unlock gesture for returning users, the
// global surface FLM.diagnostics / FLM.debug / FLM.selfTest and the fault dispatcher behind FLM.debug.inject.
// Separation rule: this file owns exactly one namespace (Boot) and registers it once through FLM.Core.define.
// It declares no module-level global state object (S-07): state lives inside the factory closure.
// Module presence (convention 6 of Part 11): a step whose module is not built yet is skipped and logged once.
// Stage records: `ms` is the absolute performance.now() at the END of the step (Part 9.1 row 3: menuMs is the
// absolute B16 time, phaseAMs the B1 time); `stepMs` is the duration of the step, so the stepMs values add up to
// the `ms` of boot.ready (UT-29-12).
// Spec: docs/IMPLEMENTATION-PLAN.md Part 4.3, Part 6.29 (6.29.2 to 6.29.8) and Part 10.6.2 (E-CAP codes).
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('Boot', function (FLM) {
  const Core = FLM.Core;
  const bus = Core.bus;
  const Log = Core.Log;
  const doc = window.document;

  const BOOT_OWNER = Symbol('boot');
  const STEP_COUNT = 16;
  const PANEL_DELAY_MS = 300;                // the progress panel appears when B1 to B8 take longer than this
  const LAST_PROGRESS_STEP = 8;
  const MAX_ONLINE_LENGTH = 200;
  const MS_ROUNDING = 100;                   // stage times are kept to 0.01 ms
  const FIRST_LAUNCH_SCREEN = 'SCR-FirstLaunch';
  const MAIN_MENU_SCREEN = 'SCR-MainMenu';
  const RELOAD_CLASS = 'reload';
  const MIN_CATALOG_ENTRIES = 5;
  const PROGRESS_LABELS = Object.freeze(['Storage', 'Settings', 'Sound', 'Graphics']);
  const TIER_NAMES = Object.freeze({ high: 'High', balanced: 'Balanced', low: 'Low', abstract: 'Abstract' });
  const LOG_LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
  // Keys that never count as the first gesture: modifiers alone, and Tab (keyboard navigation, Part 6.29.4.3).
  const IGNORED_KEYS = Object.freeze(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock', 'NumLock',
    'ScrollLock', 'Fn', 'FnLock', 'Tab']);

  /** Namespaces whose files exist (convention 6 of Part 11); every entry that adds a module file appends its name. */
  const EXPECTED_MODULES = Object.freeze(['Core', 'Theory', 'Model', 'UI', 'Storage', 'Screens', 'Modes', 'Boot']);

  /** Fault prefix -> namespace that owns the fault (Part 6.29.4.8). */
  const FAULT_ROUTES = Object.freeze({
    audio: 'Audio', render: 'Render', storage: 'Storage', net: 'Net', input: 'Input', import: 'Import',
    transport: 'Transport', mode: 'Modes', error: 'Boot'
  });

  // ---------------------------------------------------------------------------------------------
  // Capability gate (Part 6.29.4.5). Hard rows stop the boot; soft rows only disable features.
  // canvas2d and raf are probed by Boot itself (the M-01 report does not carry them); a caps object
  // without those two keys (synthetic caps in tests) counts as passing. The webrtc row reads caps.webrtc the same
  // way: the build lint allows the WebRTC constructor name only in 24-net.js, and M-01 does not probe it yet.
  // ---------------------------------------------------------------------------------------------
  function hardRow(id, code, reason, test) {
    return Object.freeze({ id, test, hard: true, code, reason, affects: Object.freeze(['everything']) });
  }

  function softRow(id, reason, affects, test) {
    return Object.freeze({ id, test, hard: false, code: null, reason, affects: Object.freeze([affects]) });
  }

  const GATE = Object.freeze([
    hardRow('canvas2d', 'E-CAP-002', 'This browser cannot draw graphics.', (caps) => caps.canvas2d !== false),
    hardRow('audio', 'E-CAP-001', 'This browser has no Web Audio support, so nothing could play.',
      (caps) => Boolean(caps.audioContext)),
    hardRow('raf', 'E-CAP-003', 'This browser is missing animation support.', (caps) => caps.raf !== false),
    softRow('webgl2', 'Advanced 3D unavailable; using simpler graphics.', 'High tier', (caps) => Boolean(caps.webgl2)),
    softRow('webgl', '3D stage unavailable in this browser; using the flat visualizer.', '3D tiers',
      (caps) => Boolean(caps.webgl2 || caps.webgl1)),
    softRow('pointer', '', 'touch input', (caps) => Boolean(caps.pointerEvents)),
    softRow('touch4', 'This device reports fewer than 4 simultaneous touches.', 'four-pad chords on touch',
      (caps) => !(caps.maxTouchPoints > 0 && caps.maxTouchPoints < 4)),
    softRow('gamepad', 'Gamepad input is not available in this browser.', 'gamepad', (caps) => Boolean(caps.gamepad)),
    softRow('midi', 'Web MIDI needs a secure context and a supporting browser.', 'MIDI input',
      (caps) => Boolean(caps.webMidi)),
    softRow('localStorage', 'Settings and projects cannot be saved in this browser mode. Use Export.', 'saving',
      (caps) => Boolean(caps.localStorage)),
    softRow('indexedDB', 'Large projects cannot be stored; projects are limited to 2 MB. Use Export for backups.',
      'large projects', (caps) => Boolean(caps.indexedDB)),
    softRow('offline', 'WAV export is not available in this browser.', 'WAV export',
      (caps) => Boolean(caps.offlineAudioContext)),
    softRow('mediaRecorder', 'Real-time mix recording is not available in this browser.', 'mix recording',
      (caps) => Boolean(caps.mediaRecorder)),
    softRow('webrtc', 'This browser has no WebRTC support.', 'Multiplayer',
      (caps) => caps.webrtc !== false),
    softRow('visibility', '', 'interruption detection', (caps) => Boolean(caps.visibility)),
    softRow('storageEstimate', '', 'quota display', (caps) => Boolean(caps.storageEstimate)),
    softRow('memory', '', 'memory heuristic', (caps) => Boolean(caps.performanceMemory))
  ]);

  function rowFails(row, caps) {
    try {
      return !row.test(caps);
    } catch (error) {
      return true;                           // a probe that throws counts as missing
    }
  }

  /** Pure: evaluates the gate against a caps object. @returns {{hard:object[], soft:object[], degraded:string[]}} */
  function evaluateGate(caps) {
    const source = caps && typeof caps === 'object' ? caps : {};
    const failed = GATE.filter((row) => rowFails(row, source));
    const soft = failed.filter((row) => !row.hard);
    return { hard: failed.filter((row) => row.hard), soft, degraded: soft.map((row) => row.id) };
  }

  // ---------------------------------------------------------------------------------------------
  // URL parameters (Part 6.29.4.6)
  // ---------------------------------------------------------------------------------------------
  function parseTier(query, warnings) {
    if (!query.has('tier')) return null;
    const name = TIER_NAMES[query.get('tier').toLowerCase()];
    if (name) return name;
    warnings.push('W-URL-TIER');
    return null;
  }

  function isRelayUrl(text) {
    if (text.length > MAX_ONLINE_LENGTH) return false;
    try {
      const protocol = new URL(text).protocol;
      return protocol === 'ws:' || protocol === 'wss:';
    } catch (error) {
      return false;
    }
  }

  function parseOnline(query, warnings) {
    if (!query.has('online')) return null;
    const text = query.get('online');
    if (isRelayUrl(text)) return text;
    warnings.push('W-URL-ONLINE');
    return null;
  }

  /** Pure: parses a search string such as '?test&tier=low'. Unknown keys are ignored. */
  function parseUrlParams(search) {
    const query = new URLSearchParams(typeof search === 'string' ? search : '');
    const warnings = [];
    return {
      test: query.has('test'),
      tier: parseTier(query, warnings),
      diag: query.has('diag'),
      online: parseOnline(query, warnings),
      perf: query.has('perf'),
      warnings
    };
  }

  const isOnlineEdition = () => typeof Core.RELAY_URL === 'string' && Core.RELAY_URL !== '';

  /** The relay URL that ?online may apply: none in the standalone build (T01.10). */
  function relayUrlFrom(parsed) {
    if (parsed.online === null) return null;
    if (isOnlineEdition()) return parsed.online;
    Log.once('boot.online.ignored', 'info', 'boot', '?online ignored in the standalone build');
    return null;
  }

  // ---------------------------------------------------------------------------------------------
  // State of the page-wide boot (one run per page; tests use separate runs through _runForTests)
  // ---------------------------------------------------------------------------------------------
  const state = {
    started: null,
    stages: [],
    gate: null,
    params: parseUrlParams(''),
    phase: 'idle',                           // idle, booting, ready or failed
    bootDone: false,
    gestureOff: null,
    errorOff: null,
    faults: new Map(),
    showStats: false,
    resolveReady: null
  };
  const readyPromise = new Promise((resolve) => { state.resolveReady = resolve; });

  /** Applies parsed parameters (B2): warnings are logged, ?diag enables the debug surface, ?online the relay. */
  function applyUrlParams(parsed) {
    state.params = parsed;
    parsed.warnings.forEach((code) => Log.warn('boot', code + ': ignored a bad URL parameter'));
    if (parsed.diag && FLM.debug) FLM.debug.enabled = true;
    const relayUrl = relayUrlFrom(parsed);
    if (relayUrl !== null && FLM.Net && typeof FLM.Net.setRelayUrl === 'function') FLM.Net.setRelayUrl(relayUrl);
    if (parsed.perf && FLM.SelfTest) Log.info('boot', '?perf: in-page performance hooks enabled');
  }

  // ---------------------------------------------------------------------------------------------
  // Landing (B14)
  // ---------------------------------------------------------------------------------------------
  function isAudioLocked() {
    const audio = FLM.Audio;
    return Boolean(audio) && typeof audio.isUnlocked === 'function' && !audio.isUnlocked();
  }

  /** Pure apart from reading the audio lock state: which screen boot lands on. */
  function landing(settingsDoc, parsed) {
    const onboarding = settingsDoc && settingsDoc.onboarding;
    const isTest = Boolean(parsed && parsed.test);
    const firstLaunch = !isTest && Boolean(onboarding) && onboarding.firstLaunchDone === false;
    return {
      mode: 'menu',
      screen: firstLaunch ? FIRST_LAUNCH_SCREEN : MAIN_MENU_SCREEN,
      banner: !isTest && !firstLaunch && isAudioLocked()
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Escalation of errors during boot (Part 4.9 origin rule 1, Part 6.29.4.4)
  // ---------------------------------------------------------------------------------------------
  function onBootError(record) {
    if (!record || record.class === RELOAD_CLASS) return;   // reload records already show #fatal
    // An Error object keeps this record distinct: M-01 merges records with equal code, message and module,
    // and a merged record would keep its old (non-reload) class and never show #fatal.
    const cause = new Error('escalated by boot: ' + record.code);
    Core.ErrorReporter.fatal(record.code, cause, { escalatedBy: 'boot', original: record.id });
  }

  function beginPhase(phase) {
    state.phase = phase;
    if (!state.errorOff) state.errorOff = bus.on('error', onBootError, BOOT_OWNER);
  }

  function endPhase(phase) {
    state.phase = phase;
    if (state.errorOff) state.errorOff();
    state.errorOff = null;
  }

  /** Test hook (UT-29-07): 'booting' starts the escalation of errors, any other phase stops it. */
  function simulatePhase(phase) {
    if (phase === 'booting') beginPhase(phase);
    else endPhase(phase);
  }

  // ---------------------------------------------------------------------------------------------
  // Audio unlock gesture for returning users (Part 6.29.4.3)
  // ---------------------------------------------------------------------------------------------
  function removeUnlockGesture() {
    if (state.gestureOff) state.gestureOff();
    state.gestureOff = null;
  }

  function onGesture(event) {
    if (event.type === 'keydown' && (event.repeat || IGNORED_KEYS.includes(event.key))) return;
    const audio = FLM.Audio;
    if (!audio || typeof audio.unlock !== 'function') return;
    // unlock() must start inside the handler: browsers drop the user activation after any await.
    Promise.resolve(audio.unlock()).catch((error) => Log.warn('boot', 'unlock failed: ' + (error && error.message)));
  }

  /** Installs the one-shot unlock listeners; returns a function that removes them. Idempotent. */
  function installUnlockGesture() {
    if (state.gestureOff) return removeUnlockGesture;
    const overlay = doc.getElementById('overlay');
    const offPointer = Core.dom.on(overlay, 'pointerdown', onGesture, { capture: true }, BOOT_OWNER);
    const offKey = Core.dom.on(window, 'keydown', onGesture, { capture: true }, BOOT_OWNER);
    state.gestureOff = () => { offPointer(); offKey(); };
    bus.once('audio.unlocked', removeUnlockGesture, BOOT_OWNER);
    return removeUnlockGesture;
  }

  // ---------------------------------------------------------------------------------------------
  // Boot progress panel (B1 to B8, Part 6.29.4.2): four labels, no percentage
  // ---------------------------------------------------------------------------------------------
  const PANEL_STYLE = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:1rem 1.5rem;'
    + 'background:var(--c-panel);border:var(--border);border-radius:var(--r-2);color:var(--c-text);';

  function labelText(label, isDone) {
    return label + ': ' + (isDone ? 'Ready' : 'Checking');
  }

  function showPanel(run) {
    if (run.panel || !run.main) return;
    const overlay = doc.getElementById('overlay');
    if (!overlay) return;
    const panel = doc.createElement('div');
    panel.className = 'boot-progress';
    panel.setAttribute('role', 'status');
    panel.style.cssText = PANEL_STYLE;
    run.rows = PROGRESS_LABELS.map((label) => {
      const row = doc.createElement('div');
      row.textContent = labelText(label, run.done.has(label));
      panel.appendChild(row);
      return row;
    });
    overlay.appendChild(panel);
    run.panel = panel;
  }

  function removePanel(run) {
    if (run.panelTimer !== null) Core.timers.clearTimeout(run.panelTimer);
    run.panelTimer = null;
    if (run.panel && run.panel.parentNode) run.panel.parentNode.removeChild(run.panel);
    run.panel = null;
  }

  function markProgress(run, label) {
    run.done.add(label);
    if (!run.panel) return;
    const index = PROGRESS_LABELS.indexOf(label);
    run.rows[index].textContent = labelText(label, true);
  }

  function schedulePanel(run) {
    if (!run.main) return;
    run.panelTimer = Core.timers.setTimeout(() => showPanel(run), PANEL_DELAY_MS, BOOT_OWNER);
  }

  // ---------------------------------------------------------------------------------------------
  // Steps B1 to B16. A step returns {} on success, {skipped:true} when its module is not built,
  // {ok:false} for a failure that does not stop the boot, or {ok:false, fatal:true, code} to stop it.
  // ---------------------------------------------------------------------------------------------
  function skipStep(stage, namespace) {
    Log.once('boot.skip.' + stage + '.' + namespace, 'info', 'boot', 'skip ' + stage + ': ' + namespace + ' not built');
    return { skipped: true };
  }

  function hasFunction(owner, name) {
    return Boolean(owner) && typeof owner[name] === 'function';
  }

  function settingValue(run, path) {
    return path.split('.').reduce((node, key) => (node === undefined || node === null ? undefined : node[key]),
      run.settings);
  }

  /** The B1 check: first expected namespace missing from `registered`, reported as fatal E-GEN-001. */
  function checkModules(registered, expected) {
    const missing = expected.find((name) => !registered.includes(name));
    if (missing === undefined) return null;
    // M-01 builds the user text from the plain E-GEN-001 row; the boot wording is the 'E-GEN-001:boot' variant
    // (Part 7.11), so it goes on screen first (showFatal keeps the first text it is given).
    const text = Core.Text.get('E-GEN-001:boot', { name: missing });
    Core.ErrorReporter.showFatal({ code: 'E-GEN-001', userMessage: text });
    Core.ErrorReporter.fatal('E-GEN-001', null, { module: missing });
    return missing;
  }

  function stepModules(run) {
    Log.info('boot', 'FLM ' + Core.VERSION + ' starting');
    schedulePanel(run);
    const registered = Core.modules().map((item) => item.name);
    return checkModules(registered, EXPECTED_MODULES) === null ? {} : { ok: false, fatal: true, code: 'E-GEN-001' };
  }

  function stepParams(run) {
    run.params = parseUrlParams(run.search);
    if (run.main) applyUrlParams(run.params);
    return {};
  }

  function stepCaps(run) {
    run.caps = Core.Caps.get();              // the load-time report is reused when it already exists
    return {};
  }

  function probeCanvas2d() {
    const canvas = doc.createElement('canvas');
    const available = Boolean(canvas.getContext && canvas.getContext('2d'));
    canvas.width = 0;                        // release the probe surface at once
    return available;
  }

  function stepGate(run) {
    const probes = { canvas2d: probeCanvas2d(), raf: typeof window.requestAnimationFrame === 'function' };
    run.gateCaps = Object.assign({}, run.caps, probes);
    run.gate = evaluateGate(run.gateCaps);
    if (run.main) state.gate = run.gate;
    if (run.gate.hard.length === 0) return {};
    const row = run.gate.hard[0];
    Core.ErrorReporter.fatal(row.code, null, { cap: row.id });
    return { ok: false, fatal: true, code: row.code };
  }

  // A browser can expose a storage API and still refuse it: the storage rows follow the B5 probe result.
  function gateWithStorage(run, status) {
    const overlay = {};
    if (status.local && status.local.ok === false) overlay.localStorage = false;
    if (status.idb && status.idb.ok === false) overlay.indexedDB = false;
    return evaluateGate(Object.assign({}, run.gateCaps, overlay));
  }

  async function stepStorage(run) {
    const storage = run.mod('Storage');
    if (!hasFunction(storage, 'open')) return skipStep('B5', 'Storage');
    run.status = await storage.open();
    run.notice = run.status && run.status.notice ? run.status.notice : null;
    if (run.status) run.gate = gateWithStorage(run, run.status);
    if (run.main) state.gate = run.gate;
    return {};
  }

  function applyInputMap(run) {
    const input = run.mod('Input');
    const settingsApi = run.settingsApi;
    if (hasFunction(input, 'setMap') && hasFunction(settingsApi, 'mapsFromSettings')) {
      input.setMap(settingsApi.mapsFromSettings(run.settings));
      return;
    }
    skipStep('B6 input map', 'Input');
  }

  function stepSettings(run) {
    const screens = run.mod('Screens');
    run.settingsApi = screens && screens.Settings ? screens.Settings : null;
    if (run.settingsApi) {
      run.settingsApi.load();
      run.settings = run.settingsApi.all();
    } else {
      skipStep('B6', 'Screens.Settings');
    }
    // UI.init applies the UI scale, reduced motion and high contrast from the settings document.
    run.mod('UI').init({ settings: run.settings, caps: run.caps });
    doc.body.classList.toggle('touch', run.caps.maxTouchPoints > 0);
    applyInputMap(run);
    const relayUrl = run.main ? relayUrlFrom(run.params) : null;
    if (relayUrl !== null && run.settingsApi) run.settingsApi.set('net.relayUrl', relayUrl, 'url');
    return {};
  }

  function stepAudio(run) {
    const audio = run.mod('Audio');
    if (!hasFunction(audio, 'init')) return skipStep('B7', 'Audio');
    try {
      audio.init({ mobile: run.caps.mobile === true, polyphony: settingValue(run, 'audio.polyphonyCap') });
      const transport = run.mod('Transport');
      if (transport && transport.main && hasFunction(transport.main, 'setClock')) {
        transport.main.setClock(audio.clock());
      }
    } catch (error) {
      Core.ErrorReporter.fatal('E-AUD-001', error, { module: 'Audio' });
      return { ok: false, fatal: true, code: 'E-AUD-001' };
    }
    return {};
  }

  function stepRender(run) {
    const render = run.mod('Render');
    if (!hasFunction(render, 'init')) return skipStep('B8', 'Render');
    try {
      const pick = render.pickTier(run.caps, run.settings, run.params.tier);
      render.init(doc.getElementById('view'), doc.getElementById('flat'), pick);
    } catch (error) {
      Log.error('boot', 'render init failed: ' + (error && error.message));   // Render falls back by itself
      return { ok: false };
    }
    return {};
  }

  function stepInput(run) {
    const input = run.mod('Input');
    if (!hasFunction(input, 'init')) return skipStep('B9', 'Input');
    input.init({ keyboardTarget: window, padRoot: doc.getElementById('touch'), surface: doc.getElementById('view') });
    return {};
  }

  function stepModes(run) {
    run.mod('Modes').init();
    run.mod('UI').Screens.setHistory(!run.params.test);
    return {};
  }

  function stepScreens(run) {
    const screens = run.mod('Screens');
    if (!hasFunction(screens, 'register')) return skipStep('B11', 'Screens.register');
    screens.register();
    return {};
  }

  function stepCatalog(run) {
    const project = run.mod('Project');
    if (!project || !project.Catalog) return skipStep('B12', 'Project');
    if (project.Catalog.list().length < MIN_CATALOG_ENTRIES) Log.warn('boot', 'catalog incomplete');
    return {};
  }

  async function stepTestHooks(run) {
    if (!FLM.SelfTest) return { skipped: true };      // the shipped build has no selfTest property at all
    if (run.main) {
      FLM.selfTest = (groups, options) => FLM.SelfTest.run(groups, options);
      FLM.debug.enabled = true;
    }
    if (!run.params.test) return {};
    const audio = run.mod('Audio');
    if (!hasFunction(audio, 'unlock')) return skipStep('B13', 'Audio');
    try {
      await audio.unlock();                           // allowed without a gesture by the headless autoplay flag
    } catch (error) {
      Log.warn('boot', 'test-mode unlock failed: ' + (error && error.message));   // tests then use OfflineAudioContext
    }
    return {};
  }

  async function stepLanding(run) {
    run.land = landing(run.settings, run.params);
    const modes = run.mod('Modes');
    const screens = run.mod('Screens');
    // Screens.register wires every SCR-* controller; without it no menu screen can be mounted yet.
    if (!hasFunction(screens, 'register')) return skipStep('B14', 'SCR-MainMenu');
    // The panel and its timer go before the menu mounts: Modes takes its leak baseline once the menu is up.
    removePanel(run);
    const entered = await modes.enter('menu', { screen: run.land.screen, notice: run.notice });
    if (entered && entered.ok === false) return { ok: false, fatal: true, code: 'E-MODE-002' };
    return {};
  }

  function stepUnlock(run) {
    if (run.params.test || run.land.screen === FIRST_LAUNCH_SCREEN) return { skipped: true };
    const audio = run.mod('Audio');
    if (!hasFunction(audio, 'isUnlocked')) return skipStep('B15', 'Audio');
    if (audio.isUnlocked()) return { skipped: true };
    if (run.main) installUnlockGesture();
    return {};
  }

  function setShowStats(value, source) {
    const settingsApi = FLM.Screens && FLM.Screens.Settings;
    if (settingsApi) settingsApi.set('video.showStats', Boolean(value), source);
    state.showStats = Boolean(value);
  }

  function stepReady(run) {
    if (!run.main) return {};
    state.bootDone = true;
    if (FLM.SelfTest) FLM.selfTestReady = true;
    if (run.params.diag) setShowStats(true, 'ui');
    return {};
  }

  const STEPS = Object.freeze([
    { id: 'B1', name: 'modules', run: stepModules },
    { id: 'B2', name: 'params', run: stepParams },
    { id: 'B3', name: 'caps', run: stepCaps },
    { id: 'B4', name: 'gate', run: stepGate },
    { id: 'B5', name: 'storage', label: 'Storage', run: stepStorage },
    { id: 'B6', name: 'settings', label: 'Settings', run: stepSettings },
    { id: 'B7', name: 'audio', label: 'Sound', run: stepAudio },
    { id: 'B8', name: 'render', label: 'Graphics', run: stepRender },
    { id: 'B9', name: 'input', run: stepInput },
    { id: 'B10', name: 'modes', run: stepModes },
    { id: 'B11', name: 'screens', run: stepScreens },
    { id: 'B12', name: 'catalog', run: stepCatalog },
    { id: 'B13', name: 'testHooks', run: stepTestHooks },
    { id: 'B14', name: 'landing', run: stepLanding },
    { id: 'B15', name: 'unlock', run: stepUnlock },
    { id: 'B16', name: 'ready', run: stepReady }
  ]);

  // ---------------------------------------------------------------------------------------------
  // The run loop
  // ---------------------------------------------------------------------------------------------
  const roundMs = (value) => Math.round(value * MS_ROUNDING) / MS_ROUNDING;

  function createRun(options) {
    const settings = options || {};
    const modules = settings.modules ? Object.assign({}, FLM, settings.modules) : FLM;
    return {
      main: settings.main === true,
      search: typeof settings.search === 'string' ? settings.search : '',
      mod: (name) => modules[name] || null,
      stages: [],
      params: parseUrlParams(''),
      settings: {},
      settingsApi: null,
      caps: {},
      gateCaps: {},
      gate: null,
      status: null,
      notice: null,
      land: { mode: 'menu', screen: MAIN_MENU_SCREEN, banner: false },
      t0: 0,
      lastEnd: 0,
      panel: null,
      rows: [],
      panelTimer: null,
      done: new Set()
    };
  }

  function recordStep(run, step, index, outcome) {
    const ended = Core.now();
    const record = { stage: step.id, name: step.name, ms: roundMs(ended), stepMs: roundMs(ended - run.lastEnd),
      ok: outcome.ok !== false, skipped: outcome.skipped === true };
    run.lastEnd = ended;
    run.stages.push(record);
    if (!run.main) return;
    state.stages.push(record);
    bus.emit('boot.stage', { stage: record.stage, index: index + 1, total: STEP_COUNT, ms: record.ms,
      stepMs: record.stepMs });
  }

  async function runStep(run, step, index) {
    let outcome;
    try {
      outcome = (await step.run(run)) || {};
    } catch (error) {
      Core.ErrorReporter.fatal('E-GEN-001', error, { module: 'Boot', step: step.id });
      outcome = { ok: false, fatal: true, code: 'E-GEN-001' };
    }
    recordStep(run, step, index, outcome);
    if (step.label) markProgress(run, step.label);
    if (index < LAST_PROGRESS_STEP && run.lastEnd - run.t0 > PANEL_DELAY_MS) showPanel(run);
    return outcome;
  }

  function activeTier(run) {
    const render = run.mod('Render');
    return hasFunction(render, 'tier') ? render.tier() : 'none';
  }

  function finishRun(run, failure) {
    removePanel(run);
    const ms = roundMs(run.lastEnd - run.t0);
    const firstLaunch = failure === null && run.land.screen === FIRST_LAUNCH_SCREEN;
    const result = { ok: failure === null, ms, tier: activeTier(run), firstLaunch };
    if (failure !== null) result.code = failure.code;
    if (!run.main) return result;
    // The error escalation listener goes first: Modes re-takes its leak baseline on boot.ready, and a boot-only
    // listener must not be part of it.
    endPhase(failure === null ? 'ready' : 'failed');
    if (failure === null) {
      const degraded = run.gate ? run.gate.degraded.slice() : [];
      bus.emit('boot.ready', { ms, tier: result.tier, firstLaunch, degraded });
    }
    return result;
  }

  async function executeRun(run) {
    run.t0 = Core.now();
    run.lastEnd = run.t0;
    if (run.main) beginPhase('booting');
    let failure = null;
    for (let index = 0; index < STEPS.length && failure === null; index += 1) {
      const outcome = await runStep(run, STEPS[index], index);
      if (outcome.fatal === true) failure = outcome;
    }
    return finishRun(run, failure);
  }

  const mainRun = createRun({ main: true, search: window.location.search });

  /** Phase B. Runs once; a second call returns the same promise. Never rejects. */
  function start() {
    if (state.started) return state.started;
    state.started = executeRun(mainRun).catch((error) => {
      Core.ErrorReporter.fatal('E-GEN-001', error, { module: 'Boot' });
      endPhase('failed');
      return { ok: false, ms: 0, tier: 'none', firstLaunch: false, code: 'E-GEN-001' };
    });
    state.started.then((result) => state.resolveReady(result));
    return state.started;
  }

  /** Test hook: an independent run that never emits boot events or touches the page-wide state. */
  async function runForTests(options) {
    const run = createRun(Object.assign({ search: '?test' }, options, { main: false }));
    const result = await executeRun(run);
    return { result, stages: run.stages.slice(), notice: run.notice, gate: run.gate };
  }

  // ---------------------------------------------------------------------------------------------
  // Fault dispatcher (Part 6.29.4.8, Part 10.9.1)
  // ---------------------------------------------------------------------------------------------
  function ownerOf(namespace) {
    return namespace === 'Boot' ? null : FLM[namespace];
  }

  // error.throw {origin}: 'listener' needs an `error` listener to throw from; the others go to their module.
  function armErrorThrow(args) {
    const origin = args && args.origin ? args.origin : 'frame';
    const namespace = { frame: 'Modes', scheduler: 'Audio' }[origin];
    const owner = namespace ? FLM[namespace] : null;
    if (hasFunction(owner, 'debugInject')) return owner.debugInject('error.throw', args) === true;
    if (origin === 'listener') bus.once('error', () => {}, BOOT_OWNER);
    return Core.Faults.set('error.throw', args);
  }

  function armFault(fault, args) {
    const prefix = String(fault).split('.')[0];
    if (!Object.prototype.hasOwnProperty.call(FAULT_ROUTES, prefix)) return false;
    if (fault === 'error.throw') return armErrorThrow(args);
    const owner = ownerOf(FAULT_ROUTES[prefix]);
    if (hasFunction(owner, 'debugInject')) return owner.debugInject(fault, args) === true;
    return Core.Faults.set(fault, args);     // the registry in M-01 is the mechanism behind every module hook
  }

  /** The fault dispatcher behind FLM.debug.inject: false unless FLM.debug.enabled. */
  function inject(fault, args) {
    if (!FLM.debug || FLM.debug.enabled !== true) return false;
    const armed = armFault(fault, args);
    if (!armed) {
      Log.warn('fault', 'unsupported', { fault: String(fault) });
      return false;
    }
    state.faults.set(String(fault), args || {});
    return true;
  }

  function clear(fault) {
    const prefix = String(fault).split('.')[0];
    const owner = Object.prototype.hasOwnProperty.call(FAULT_ROUTES, prefix) ? ownerOf(FAULT_ROUTES[prefix]) : null;
    if (hasFunction(owner, 'debugClear')) owner.debugClear(fault);
    else Core.Faults.clear(fault);
    state.faults.delete(String(fault));
  }

  // ---------------------------------------------------------------------------------------------
  // Public surface FLM.diagnostics and FLM.debug (Part 4.8, Part 6.29.4.7)
  // ---------------------------------------------------------------------------------------------
  function diagnostics(options) {
    const includeContent = Boolean(options && options.includeSong === true);
    return JSON.parse(Core.Diagnostics.export({ includeContent }).json);
  }

  function gateSummary() {
    const gate = state.gate;
    if (!gate) return { hard: [], soft: [], degraded: [] };
    return { hard: gate.hard.map((row) => row.id), soft: gate.soft.map((row) => row.id),
      degraded: gate.degraded.slice() };
  }

  function bootDiagnostics() {
    const faults = Array.from(state.faults, ([fault, args]) => ({ fault, args }));
    return { stages: state.stages.slice(), gate: gateSummary(), params: state.params, faults,
      bootDone: state.bootDone };
  }

  function debugLog(level) {
    const floor = Object.prototype.hasOwnProperty.call(LOG_LEVELS, level) ? LOG_LEVELS[level] : LOG_LEVELS.debug;
    return Log.entries().filter((entry) => LOG_LEVELS[entry.level] >= floor);
  }

  function debugCounters() {
    return hasFunction(FLM.Modes, 'counters') ? FLM.Modes.counters() : {};
  }

  function readTier() {
    return hasFunction(FLM.Render, 'tier') ? FLM.Render.tier() : null;
  }

  function writeTier(name) {
    if (hasFunction(FLM.Render, 'setTier')) FLM.Render.setTier(name, 'user');
  }

  function readShowStats() {
    const settingsApi = FLM.Screens && FLM.Screens.Settings;
    return settingsApi ? settingsApi.get('video.showStats') === true : state.showStats;
  }

  function createDebug() {
    const debug = { enabled: false, inject, clear, log: debugLog, counters: debugCounters };
    Object.defineProperty(debug, 'tier', { enumerable: true, get: readTier, set: writeTier });
    Object.defineProperty(debug, 'showStats', { enumerable: true, get: readShowStats,
      set: (value) => setShowStats(value, 'ui') });
    return debug;
  }

  /** Defines FLM.diagnostics, FLM.debug, FLM.selfTestReady and, in the test build, FLM.selfTest. Idempotent. */
  function installSurface() {
    if (!FLM.debug) FLM.debug = createDebug();
    if (typeof FLM.diagnostics !== 'function') FLM.diagnostics = diagnostics;
    if (FLM.selfTestReady === undefined) FLM.selfTestReady = false;
    if (FLM.SelfTest && typeof FLM.selfTest !== 'function') {
      FLM.selfTest = (groups, options) => FLM.SelfTest.run(groups, options);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Phase A (Part 4.3 A3): surface first, so it works even when Phase B fails; then the start trigger.
  // ---------------------------------------------------------------------------------------------
  function scheduleStart() {
    if (doc.readyState !== 'loading') {
      Core.timers.setTimeout(start, 0, BOOT_OWNER);
      return;
    }
    const onLoaded = () => {
      Core.dom.off(doc, 'DOMContentLoaded', onLoaded);
      start();
    };
    Core.dom.on(doc, 'DOMContentLoaded', onLoaded, undefined, BOOT_OWNER);
  }

  installSurface();
  Core.Diagnostics.provide('boot', bootDiagnostics);
  scheduleStart();

  return Object.freeze({
    EXPECTED_MODULES,
    GATE,
    FAULT_ROUTES,
    start,
    stage: () => state.stages.slice(),
    ready: () => readyPromise,
    gateResult: () => {
      const gate = state.gate;
      return gate ? { hard: gate.hard.slice(), soft: gate.soft.slice(), degraded: gate.degraded.slice() }
        : { hard: [], soft: [], degraded: [] };
    },
    evaluateGate,
    parseUrlParams,
    applyUrlParams,
    landing,
    installSurface,
    inject,
    clear,
    _simulatePhase: simulatePhase,
    _checkModules: checkModules,
    _installUnlockGesture: installUnlockGesture,
    _runForTests: runForTests
  });
});
})();
