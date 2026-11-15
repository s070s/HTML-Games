// ---- Main loop --------------------------------------------------------------------------------------------------------
let lastFrameTime = 0;
let accumulator = 0;
let loopPaused = false;
const STEP_MS = 1000 / 60;
function stepGame() {
  Input.poll();
  updateLayers();
  Fade.update();
  Caption.sync(false);
  releaseFrameWaiters();
}
function renderFrame() {
  ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  drawLayers();
  Fade.draw();
}
function frameLoop(now) {
  requestAnimationFrame(frameLoop);
  if (loopPaused) { lastFrameTime = now; return; }
  if (!lastFrameTime) lastFrameTime = now;
  accumulator += Math.min(100, now - lastFrameTime);
  lastFrameTime = now;
  let steps = 0;
  while (accumulator >= STEP_MS && steps < 4) { stepGame(); accumulator -= STEP_MS; steps++; }
  if (steps > 0) renderFrame();
}
function boot() {
  loadOptions();
  buildAllSprites();
  resizeScreen();
  bindTouchButtons();
  window.addEventListener('resize', resizeScreen);
  window.addEventListener('orientationchange', resizeScreen);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { Input.clear(); } });
  window.addEventListener('pointerdown', function () { Sound.unlock(); }, { passive: true });
  titleFlow();
  requestAnimationFrame(frameLoop);
}

