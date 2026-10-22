// ==== S19 GAME LOOP ====
// requestAnimationFrame loop with a fixed 120 Hz simulation (ARC-010), render interpolation (REN-006) and pause (PLT-006).
// Frame phases run in this order every frame: 'input' -> sim steps -> 'render' -> 'hud' -> 'audio' -> 'ui'.
// Match lifecycle events (in order): 'match.setup' (build ruleset) -> 'match.load' (world, nav, renderer)
// -> 'match.start' (mode spawns actors) ... 'match.end' (results) -> 'match.stop' (tear down).

const FRAME_PHASES = ['input', 'render', 'hud', 'audio', 'ui'];
const FRAME_HISTORY = 240;              // frames kept for p50/p95/p99 (2 s at 120 fps)
const MAX_FRAME_SECONDS = 0.25;         // a longer gap (tab switch, debugger) is not simulated

const Perf = {
  frameMs: new Float32Array(FRAME_HISTORY),
  simMs: new Float32Array(FRAME_HISTORY),
  index: 0, filled: 0,
  droppedSteps: 0,
  sorted: new Float32Array(FRAME_HISTORY),
  counters: { drawCalls: 0, triangles: 0, renderMs: 0, hudMs: 0, audioMs: 0, gpuMs: 0, renderScale: 1, particles: 0, projectiles: 0 },
  record(frameMs, simMs) {
    this.frameMs[this.index] = frameMs; this.simMs[this.index] = simMs;
    this.index = (this.index + 1) % FRAME_HISTORY;
    if (this.filled < FRAME_HISTORY) this.filled++;
  },
  percentile(source, fraction) {
    if (!this.filled) return 0;
    const view = this.sorted.subarray(0, this.filled);
    view.set(source.subarray(0, this.filled));
    view.sort();
    return view[Math.min(this.filled - 1, Math.floor(fraction * this.filled))];
  },
  stats() {
    const p50 = this.percentile(this.frameMs, 0.5);
    return { fps: p50 > 0 ? 1000 / p50 : 0, p50, p95: this.percentile(this.frameMs, 0.95), p99: this.percentile(this.frameMs, 0.99),
      simP95: this.percentile(this.simMs, 0.95), droppedSteps: this.droppedSteps, counters: this.counters, systems: Sim.timing };
  },
  reset() { this.index = 0; this.filled = 0; this.droppedSteps = 0; },
};

const Loop = {
  hooks: { input: [], render: [], hud: [], audio: [], ui: [] },
  running: false,
  lastTime: 0,
  accumulator: 0,
  alpha: 0,               // interpolation factor between the previous and current sim state
  frameSeconds: 0,
  onFrame(phase, handler) {
    if (!this.hooks[phase]) throw new Error('unknown frame phase ' + phase);
    this.hooks[phase].push(handler);
  },
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((now) => this.frame(now));
  },
  frame(now) {
    if (!this.running) return;
    requestAnimationFrame((next) => this.frame(next));
    const frameStart = performance.now();
    const seconds = Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.frameSeconds = seconds;
    this.runPhase('input', seconds);
    const simStart = performance.now();
    if (Game.isRunning()) this.advance(seconds);
    const simMs = performance.now() - simStart;
    for (let i = 1; i < FRAME_PHASES.length; i++) this.runPhase(FRAME_PHASES[i], seconds);
    Perf.record(performance.now() - frameStart, simMs);
  },
  // Runs whole sim steps for the elapsed time; at most MAX_STEPS_PER_FRAME, the rest is dropped (spiral-of-death guard).
  advance(seconds) {
    this.accumulator += seconds;
    let steps = 0;
    while (this.accumulator >= TICK_SECONDS && steps < MAX_STEPS_PER_FRAME) {
      Sim.step();
      this.accumulator -= TICK_SECONDS;
      steps++;
    }
    if (this.accumulator >= TICK_SECONDS) {
      Perf.droppedSteps += Math.floor(this.accumulator / TICK_SECONDS);
      this.accumulator %= TICK_SECONDS;
    }
    this.alpha = this.accumulator / TICK_SECONDS;
  },
  runPhase(phase, seconds) {
    const list = this.hooks[phase];
    for (let i = 0; i < list.length; i++) {
      try { list[i](seconds, this.alpha); } catch (error) { ErrorLog.add('frame ' + phase, error); }
    }
  },
};

// The loop restarts its clocks with every match.
Bus.on('match.setup', () => { Perf.reset(); Loop.accumulator = 0; });
Bus.on('game.resume', () => { Loop.lastTime = performance.now(); });
