// ==== S18 UI: DEVICE (PLT-004: phones, tablets and the Home Screen web app) ====
// Around the page itself: persistent storage asked for after the first tap or key (R-008), a one-time iPhone tip to add the game to
// the Home Screen or back up the save, a Full screen button where the browser has one (Android, iPad, desktop; iPhone has none), a
// back swipe that pauses a match instead of leaving the page, and the version label hidden in matches (R-009, R-167).

const HOME_SCREEN_TIP = {
  title: 'Keep your progress',
  text: 'Safari can clear a website\'s saved data after 7 days without a visit. Add ClassTimeKiller to the Home Screen (Share, then '
    + 'Add to Home Screen): it opens full screen and keeps your progress. You can also back up your save now.',
  yes: 'Back up now', no: 'Later',
};
const FULLSCREEN_REFUSED = 'The browser did not allow full screen.';
const BACK_GUARD_STATE = 'ctk-match';   // history.state of the entry pushed at match start

const Device = {
  persistAsked: false,
  persistResult: null,    // what navigator.storage.persist() answered (null = not asked yet, or the browser has no such call)
  // iPhone and iPad (iPad Safari reports a Mac, but one with touch).
  isIos() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); },
  // Started from the Home Screen: iOS sets navigator.standalone, other browsers match the display mode.
  standalone() { return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; },
  // Browsers grant persistent storage only after a user gesture, so the request waits for the first tap or key.
  armPersist() {
    const ask = () => {
      window.removeEventListener('pointerdown', ask, true);
      window.removeEventListener('keydown', ask, true);
      this.requestPersist();
    };
    window.addEventListener('pointerdown', ask, true);
    window.addEventListener('keydown', ask, true);
  },
  requestPersist() {
    const storage = navigator.storage;
    if (this.persistAsked || !storage || !storage.persist) return;
    this.persistAsked = true;
    storage.persist().then((granted) => { this.persistResult = granted; }, () => { this.persistResult = false; });
  },
  // A one-time tip on iPhone and iPad in a Safari tab; returns true when it was shown.
  homeScreenTip() {
    if (!this.isIos() || this.standalone() || Save.data.tips.homeScreen) return false;
    Save.data.tips.homeScreen = true;
    Save.scheduleSave();
    Ui.confirm(Object.assign({ onYes: () => Ui.open('saveTransfer') }, HOME_SCREEN_TIP));
    return true;
  },
  // iPad Safari has only the webkit names; iPhone Safari has no element full screen at all.
  fullscreenAvailable() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); },
  inFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
  // Runs inside the click: browsers allow full screen only from a user gesture.
  toggleFullscreen() {
    const root = document.documentElement;
    const done = this.inFullscreen() ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    if (done && done.catch) done.catch(() => Ui.toast(FULLSCREEN_REFUSED));
  },
};

// The Video tab gets a Full screen button only where the browser has full screen.
(Ui.settingsExtras.video = Ui.settingsExtras.video || []).push((container) => {
  if (!Device.fullscreenAvailable()) return;
  const foot = makeElement('div', 'ui-foot');
  foot.appendChild(Ui.button('Full screen on or off', () => Device.toggleFullscreen()));
  container.appendChild(foot);
});

// ---- Back swipe: one history entry per match, so Safari's edge swipe (or Android's Back) pauses instead of leaving ----
function guardBackSwipe() {
  if (Game.headless || (history.state && history.state.ctk === BACK_GUARD_STATE)) return;
  history.pushState({ ctk: BACK_GUARD_STATE }, '');
}
function onBackSwipe() {
  if (Game.state !== 'playing') return;   // in the menus Back leaves the page as usual
  guardBackSwipe();                        // the next swipe is caught too
  Input.autoPause('menu');
}

// ---- The version label sits on the ammo panel: shown in the menus only ----
function showVersion(shown) { document.getElementById('version').hidden = !shown; }

Bus.on('match.start', () => { guardBackSwipe(); showVersion(false); });
Bus.on('match.end', () => showVersion(true));
Bus.on('match.stop', () => showVersion(true));
Bus.on('boot', () => {
  if (Game.headless) return;
  window.addEventListener('popstate', onBackSwipe);
  Device.armPersist();
});
Bus.on('ready', () => { if (!Game.headless) Device.homeScreenTip(); });
