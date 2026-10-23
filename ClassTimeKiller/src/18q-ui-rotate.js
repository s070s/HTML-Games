// ==== S18 UI: ROTATE GUARD (LT-C-022, PLT-004) ====
// iOS Safari cannot lock the orientation, and a phone held upright gives a slit of a view under touch buttons that overlap.
// A match on a phone-sized touch screen in portrait pauses (reason 'rotate') behind a full-screen 'turn your phone sideways'
// overlay and resumes once the screen is landscape again. A tablet upright (iPad 768 px and wider) plays on. Menus outside
// a match stay usable upright; a pause the player chose stays.

const ROTATE_TITLE = 'Turn your phone sideways';
const ROTATE_TEXT = 'The match is paused until then.';
// Upright screens at least this many CSS px wide are tablets: a playable view.
const ROTATE_PHONE_MAX_WIDTH = 600;

const RotateGuard = {
  touch: TOUCH_DEVICE,
  // Live .matches: no layout read per frame.
  portrait: window.matchMedia('(orientation: portrait) and (max-width: ' + (ROTATE_PHONE_MAX_WIDTH - 1) + 'px)'),
  element: null,
  shown: false,
  // Once per frame: blocks only a running match or its own pause. The resume is asked for once, on the turn to landscape:
  // a held one (a lost context, a pointer lock that needs a click) leaves the pause menu's Resume button.
  update() {
    const blocked = this.touch && !Game.headless && Game.state === 'playing' && this.portrait.matches
      && (!Game.paused || Game.pauseReason === 'rotate');
    const turned = blocked !== this.shown;
    if (turned) this.show(blocked);
    if (blocked && !Game.paused) Game.pause('rotate');
    else if (turned && !blocked && Game.paused && Game.pauseReason === 'rotate' && Game.state === 'playing') Input.requestResume();
  },
  show(visible) {
    this.shown = visible;
    if (!this.element) this.element = this.build();
    this.element.classList.toggle('show', visible);
  },
  build() {
    const element = makeElement('div');
    element.id = 'rotate';
    element.setAttribute('role', 'alert');
    element.append(makeElement('h1', '', ROTATE_TITLE), makeElement('p', '', ROTATE_TEXT));
    document.body.appendChild(element);
    return element;
  },
};
Bus.on('boot', () => Loop.onFrame('ui', () => RotateGuard.update()));
