// ---- Canvas and scaling ---------------------------------------------------------------------------
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d', { alpha: false });
const stage = document.getElementById('stage');
const touchPad = document.getElementById('touch');
let viewScale = 1;
let touchVisible = false;
let touchForced = null;
const touchButtons = Array.prototype.slice.call(touchPad.querySelectorAll('[data-btn]'));
function detectTouch() {
  if (touchForced !== null) return touchForced;
  return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}
// The sizes come from screenLayout() in the rules block (tested without a browser).
function resizeScreen() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  touchVisible = detectTouch();
  const layout = screenLayout(window.innerWidth, window.innerHeight, touchVisible, OPT.largeText, OPT.touchHand);
  canvas.style.width = layout.cssW + 'px';
  canvas.style.height = layout.cssH + 'px';
  canvas.width = Math.round(layout.cssW * dpr);
  canvas.height = Math.round(layout.cssH * dpr);
  viewScale = canvas.width / SCREEN_W;
  stage.style.justifyContent = touchVisible && layout.portrait ? 'flex-start' : 'center';
  touchPad.style.display = touchVisible ? 'block' : 'none';
  touchPad.className = layout.portrait ? 'portrait' : 'landscape';
  touchPad.style.height = layout.portrait ? layout.padHeight + 'px' : '100%';
  applyTouchHand(layout.portrait);
  Caption.apply(layout);
}
// One-hand touch controls: every button gets an inline place from oneHandRects(); with both hands the style sheet places them.
function applyTouchHand(portrait) {
  const rects = OPT.touchHand > 0 ? oneHandRects(portrait, OPT.touchHand, window.innerWidth) : null;
  const specs = ONE_HAND_BUTTONS[portrait ? 'portrait' : 'landscape'];
  for (const element of touchButtons) {
    if (!rects) { element.removeAttribute('style'); continue; }
    const name = element.getAttribute('data-btn');
    const style = element.style;
    style.left = rects[name].left + 'px';
    style.right = 'auto';
    style.top = 'auto';
    style.bottom = rects[name].bottom + 'px';
    style.width = rects[name].width + 'px';
    style.height = rects[name].height + 'px';
    style.fontSize = specs[name].font + 'px';
    style.borderRadius = name === 'a' || name === 'b' ? '50%' : (name === 'menu' || name === 'map' ? Math.round(rects[name].height / 2) + 'px' : '12px');
  }
}
