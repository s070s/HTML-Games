// ==== S18 UI: DEVICE (PLT-004: phones, tablets and the Home Screen web app) ====
// Persistent storage after the first gesture and a one-time iPhone backup tip (R-008), Full screen where it exists, a back swipe that
// pauses, no version label in matches (R-009, R-167).

// The Home Screen app has its own storage, apart from Safari's: it starts empty, so the tip says to carry the save over.
const HOME_SCREEN_TIP = { title: 'Keep your progress', text: 'Safari may clear saves after 7 days away; the Home Screen app keeps them but starts '
  + 'empty. Back up here (Copy), add the game to the Home Screen (Share), then Import in the app.', yes: 'Back up now', no: 'Later' };
const HOME_SCREEN_IMPORT = { title: 'Bring your progress?', text: 'This app has its own save. To go on with your Safari progress, copy a backup '
  + 'there (Settings, Back up or restore save) and import it here.', yes: 'Import', no: 'Not now' };
const FULLSCREEN_REFUSED = 'The browser did not allow full screen.';
const BACK_GUARD_STATE = 'ctk-match';
const WAKE_RETRY_MS = 5000;   // a refused or dropped wake lock is asked for again after this long

const Device = {
  persistAsked: false,
  // navigator.storage.persist()'s answer (null = not asked); granted = the browser keeps the save, no tip needed
  persistResult: null,
  // A dialog that waits for the bare main menu (no match, no other dialog), so it never stacks on the Welcome
  pendingDialog: null,
  // Screen Wake Lock: wanted while a match runs; the sentinel while held (the browser drops it when the page hides)
  awake: false,
  wakeSentinel: null,
  wakeRetryAt: 0,       // performance.now() before which a lost wake lock is not asked for again
  isIos(nav) { return isAppleTouch(nav || navigator); },
  // Started from the Home Screen.
  standalone() { return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; },
  // Granted only after a user gesture.
  armPersist() {
    const ask = () => this.requestPersist();
    window.addEventListener('pointerdown', ask, { capture: true, once: true });
    window.addEventListener('keydown', ask, { capture: true, once: true });
  },
  requestPersist() {
    const storage = navigator.storage;
    if (this.persistAsked || !storage || !storage.persist) return;
    this.persistAsked = true;
    storage.persist().then((granted) => { this.persistResult = granted; }, () => { this.persistResult = false; });
  },
  // After a finished match, once, in an iOS Safari tab whose save the browser may clear: shown back on the main menu.
  homeScreenTip() {
    if (!this.isIos() || this.standalone() || Save.data.tips.homeScreen || this.persistResult === true) return;
    this.pendingDialog = HOME_SCREEN_TIP;
  },
  // At start: the Home Screen app's first start (an empty save) offers the import of the Safari backup.
  atReady() {
    if (this.isIos() && this.standalone() && Save.data.revision === 0 && !Save.data.tips.homeScreen) this.pendingDialog = HOME_SCREEN_IMPORT;
  },
  // Once per frame; true when the waiting dialog opened. Either dialog marks tips.homeScreen: each shows once, ever.
  showPendingDialog() {
    if (!this.pendingDialog || Game.state !== 'menu' || Ui.current() !== 'main') return false;
    const dialog = this.pendingDialog;
    this.pendingDialog = null;
    Save.data.tips.homeScreen = true;
    Save.scheduleSave();
    Ui.confirm(Object.assign({ onYes: () => Ui.open('saveTransfer') }, dialog));
    return true;
  },
  // Once per frame: a running, visible match holds the wake lock (a controller is no touch, so the phone would dim and lock
  // mid-match); a pause, the menu or a hidden page lets the screen sleep. Acts only when that changes, or (rate-limited) when
  // the lock was refused or the system let it go.
  updateWakeLock() {
    const wanted = Game.isRunning() && !document.hidden;
    if (wanted === this.awake || (wanted && performance.now() < this.wakeRetryAt)) return;
    this.awake = wanted;
    if (this.wakeSentinel) this.wakeSentinel.release().catch(() => {});
    this.wakeSentinel = null;
    if (!wanted || !navigator.wakeLock) return;
    // An answer that comes after a pause (or after an earlier answer) is let go at once.
    navigator.wakeLock.request('screen').then((sentinel) => {
      if (!this.awake || this.wakeSentinel) { sentinel.release().catch(() => {}); return; }
      this.wakeSentinel = sentinel;
      sentinel.addEventListener('release', () => this.lostWakeLock(sentinel));
    }, () => this.lostWakeLock(null));
  },
  // A refused request, or the system letting the lock go (iOS Low Power Mode): ask again after WAKE_RETRY_MS. A release
  // this code asked for has already cleared wakeSentinel, so it does not count.
  lostWakeLock(sentinel) {
    if (sentinel !== this.wakeSentinel) return;
    this.wakeSentinel = null;
    this.awake = false;
    this.wakeRetryAt = performance.now() + WAKE_RETRY_MS;
  },
  // iPad has only the webkit names; iPhone has none.
  fullscreenAvailable() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); },
  // Called from the click (a user gesture).
  toggleFullscreen() {
    const root = document.documentElement;
    const done = document.fullscreenElement || document.webkitFullscreenElement ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    if (done && done.catch) done.catch(() => Ui.toast(FULLSCREEN_REFUSED));
  },
};

(Ui.settingsExtras.video = Ui.settingsExtras.video || []).push((container) => {
  if (!Device.fullscreenAvailable()) return;
  const foot = makeElement('div', 'ui-foot');
  foot.appendChild(Ui.button('Full screen on or off', () => Device.toggleFullscreen()));
  container.appendChild(foot);
});

// ---- Tab icon: the Home Screen icon again, added while the page loads. Without one the browser asks for /favicon.ico,
// which the CSP (img-src data: blob:) blocks with an error on every load from a web server. ----
const touchIcon = document.querySelector('link[rel="apple-touch-icon"]');
if (touchIcon) document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon', href: touchIcon.href }));

// ---- Back swipe: one history entry per match, so Back pauses instead of leaving ----
function guardBackSwipe() {
  if (Game.headless || (history.state && history.state.ctk === BACK_GUARD_STATE)) return;
  history.pushState({ ctk: BACK_GUARD_STATE }, '');
}
function onBackSwipe() {
  if (Game.state !== 'playing') return;
  // The next swipe is caught too.
  guardBackSwipe();
  Input.autoPause('menu');
}

// ---- The version label (over the ammo panel) shows in menus only ----
function showVersion(shown) { document.getElementById('version').hidden = !shown; }

Bus.on('match.start', () => { guardBackSwipe(); showVersion(false); });
for (const name of ['match.end', 'match.stop']) Bus.on(name, () => showVersion(true));
Bus.on('match.end', () => { if (!Game.headless) Device.homeScreenTip(); });
Bus.on('boot', () => {
  if (Game.headless) return;
  window.addEventListener('popstate', onBackSwipe);
  Device.armPersist();
  Loop.onFrame('ui', () => { Device.showPendingDialog(); Device.updateWakeLock(); });
});
Bus.on('ready', () => { if (!Game.headless) Device.atReady(); });
