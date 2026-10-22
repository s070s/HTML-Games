// ==== S21 BOOTSTRAP ====
// Startup order: errors hooked -> save loaded -> 'boot' event (each section initializes itself, the renderer
// may call Boot.fatal) -> settings applied -> loop started -> 'ready' event (UI shows the main menu).

const Boot = {
  failed: false,
  fatal(title, text, detail) {
    this.failed = true;
    document.getElementById('fatal-title').textContent = title;
    document.getElementById('fatal-text').textContent = text;
    document.getElementById('fatal-detail').textContent = detail || '';
    document.getElementById('fatal').classList.add('show');
  },
  start() {
    window.addEventListener('error', (event) => ErrorLog.add('window', event.error || event.message));
    window.addEventListener('unhandledrejection', (event) => ErrorLog.add('promise', event.reason));
    document.getElementById('version').textContent = 'v' + VERSION;
    window.__CTK = DebugApi;
    try {
      Save.load();
      Bus.emit('boot', null);
      if (this.failed) return;
      Settings.applyAll();
      Loop.start();
      Bus.emit('ready', null);
    } catch (error) {
      ErrorLog.add('boot', error);
      this.fatal('ClassTimeKiller could not start', 'Something went wrong while starting. Reload the page; if it keeps happening, update your browser.', String(error && error.stack || error));
    }
  },
};

Boot.start();
