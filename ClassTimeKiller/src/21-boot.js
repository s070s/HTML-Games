// ==== S21 BOOTSTRAP ====
// Startup order: errors hooked -> save loaded -> 'boot' event (each section initializes itself, the renderer
// may call showFatal) -> settings applied -> loop started -> 'ready' event (UI shows the main menu).
// An error before Boot.start runs (a top-level script error) is caught by the inline handler in shell.html.

const BOOT_FATAL_TITLE = 'ClassTimeKiller could not start';
const BOOT_FATAL_TEXT = 'Something went wrong while starting. Reload the page; if it keeps happening, update your browser.';

const Boot = {
  start() {
    window.addEventListener('error', (event) => ErrorLog.add('window', event.error || event.message));
    window.addEventListener('unhandledrejection', (event) => ErrorLog.add('promise', event.reason));
    document.getElementById('version').textContent = 'v' + VERSION;
    window.__CTK = DebugApi;
    try {
      this.run();
    } catch (error) {
      ErrorLog.add('boot', error);
      showFatal(BOOT_FATAL_TITLE, BOOT_FATAL_TEXT, errorText(error));
    }
  },
  run() {
    Save.load();
    this.emitChecked('boot');
    if (fatalShown) return;
    Settings.applyAll();
    Loop.start();
    this.emitChecked('ready');
  },
  // Bus.emit only logs a listener's error, so a start-up listener that throws would leave a blank page: an error logged by
  // a 'boot' or 'ready' listener ends the start like a thrown one, with the fatal screen (ARC-041, PLT-002).
  emitChecked(type) {
    const before = ErrorLog.total;
    Bus.emit(type, null);
    const failure = ErrorLog.since(before).find((entry) => entry.startsWith('event ' + type + ':'));
    if (failure) throw new Error(failure);
  },
};

Boot.start();
