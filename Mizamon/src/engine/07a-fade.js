// ---- Fade (screen transitions) ----------------------------------------------------------------------------------------
const Fade = {
  alpha: 0, from: 0, to: 0, frame: 0, frames: 0, resolve: null,
  start: function (target, frames) {
    if (OPT.reduceMotion || frames <= 0) { this.alpha = target; return Promise.resolve(); }
    this.from = this.alpha; this.to = target; this.frame = 0; this.frames = frames;
    return new Promise(function (resolve) { Fade.resolve = resolve; });
  },
  update: function () {
    if (this.frames <= 0) return;
    this.frame++;
    this.alpha = this.from + (this.to - this.from) * Math.min(1, this.frame / this.frames);
    if (this.frame >= this.frames) { this.frames = 0; const resolve = this.resolve; this.resolve = null; if (resolve) resolve(); }
  },
  draw: function () {
    if (this.alpha <= 0.001) return;
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.globalAlpha = 1;
  },
};

