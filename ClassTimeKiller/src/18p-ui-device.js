// ==== S18 UI: DEVICE (PLT-004: phones, tablets and the Home Screen web app) ====
// Persistent storage after the first gesture and a one-time iPhone backup tip (R-008), Full screen where it exists, a back swipe that
// pauses, no version label in matches (R-009, R-167).

const HOME_SCREEN_TIP = { title: 'Keep your progress', text: 'Safari may clear saves after 7 days away. Add the game to the Home Screen (Share, Add to '
  + 'Home Screen), or back up now.', yes: 'Back up now', no: 'Later' };
const FULLSCREEN_REFUSED = 'The browser did not allow full screen.';
const BACK_GUARD_STATE = 'ctk-match';

const Device = {
  persistAsked: false,
  // navigator.storage.persist()'s answer (null = not asked)
  persistResult: null,
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
  // Once, in an iOS Safari tab; true when shown.
  homeScreenTip() {
    if (!this.isIos() || this.standalone() || Save.data.tips.homeScreen) return false;
    Save.data.tips.homeScreen = true;
    Save.scheduleSave();
    Ui.confirm(Object.assign({ onYes: () => Ui.open('saveTransfer') }, HOME_SCREEN_TIP));
    return true;
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
Bus.on('boot', () => {
  if (Game.headless) return;
  window.addEventListener('popstate', onBackSwipe);
  Device.armPersist();
});
Bus.on('ready', () => { if (!Game.headless) Device.homeScreenTip(); });
