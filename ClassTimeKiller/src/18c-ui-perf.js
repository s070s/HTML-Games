// ==== S18 UI: PERFORMANCE OVERLAY (PERF-012, ARC-040, ARC-041) ====
// DOM text panel refreshed 4 times a second while visible (nothing is touched while hidden). F10 toggles it, F9 toggles
// Ui.botDebug, a four-finger tap toggles both (ARC-040). Reads Perf (S19) and Sim.timing at runtime only: the loop starts after every section has loaded.

const PERF_REFRESH_MS = 250;
const PERF_ERROR_LINES = 3;
const PERF_ERROR_CHARS = 110;
const PERF_SYSTEMS_SHOWN = 5;
const AI_SYSTEM_PATTERN = /^(ai|bot|pveBrains)/i;    // PERF-012 wants the bot AI cost always visible, whatever else is slow
const PERF_FLOOR_FPS = 60;               // PERF-001 hard minimum: the panel turns red below it
const BYTES_PER_MEGABYTE = 1048576;
const PERF_CSS = '#overlay > .perf-hud { position: fixed; top: calc(6px + var(--safe-top)); left: calc(6px + var(--safe-left)); z-index: 40; margin: 0; padding: 6px 8px;'
  + ' background: rgba(0, 0, 0, 0.62); color: #9fe8a8; font: 14px/1.3 ui-monospace, Consolas, monospace; white-space: pre; border-radius: 6px; pointer-events: none; max-width: 70vw; overflow: hidden; display: none; }'
  + '#overlay > .perf-hud.show { display: block; } #overlay > .perf-hud.slow { color: #ff9a9a; }';

const PerfOverlay = {
  element: null,
  lastUpdate: 0,
  shown: false,
  counts: { actors: 0, bots: 0 },   // reused, filled by countActors()

  init() {
    injectStyle('perf-style', PERF_CSS);
    this.element = makeElement('pre', 'perf-hud');
    document.getElementById('overlay').appendChild(this.element);
    Loop.onFrame('ui', () => this.frame());
  },
  frame() {
    if (Ui.perfVisible !== this.shown) {
      this.shown = Ui.perfVisible;
      this.element.classList.toggle('show', this.shown);
    }
    if (!this.shown) return;
    const now = performance.now();
    if (now - this.lastUpdate < PERF_REFRESH_MS) return;
    this.lastUpdate = now;
    this.render(Perf.stats());
  },
  render(stats) {
    this.element.textContent = this.format(stats).join('\n');
    this.element.classList.toggle('slow', stats.fps > 0 && stats.fps < PERF_FLOOR_FPS);
  },
  // Alive actors in total, and how many of them are bots (hostile or friendly).
  countActors() {
    const counts = this.counts;
    counts.actors = 0; counts.bots = 0;
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id]) continue;
      counts.actors++;
      const kind = Actors.kind[id];
      if (kind === ACTOR_KIND.BOT || kind === ACTOR_KIND.ENEMY) counts.bots++;
    }
    return counts;
  },
  aiMilliseconds(timing) {
    let total = 0;
    for (const name in timing) if (AI_SYSTEM_PATTERN.test(name)) total += timing[name];
    return total;
  },
  heapText() {
    const memory = performance.memory;
    return memory ? (memory.usedJSHeapSize / BYTES_PER_MEGABYTE).toFixed(1) + ' MB' : 'n/a';
  },
  slowestSystems(timing) {
    return Object.keys(timing).sort((a, b) => timing[b] - timing[a]).slice(0, PERF_SYSTEMS_SHOWN).map((name) => name + ' ' + timing[name].toFixed(2));
  },
  format(stats) {
    const counters = stats.counters, counts = this.countActors();
    const lines = [
      'fps ' + stats.fps.toFixed(1) + '   frame p50 ' + stats.p50.toFixed(2) + '  p95 ' + stats.p95.toFixed(2) + '  p99 ' + stats.p99.toFixed(2) + ' ms',
      'sim p95 ' + stats.simP95.toFixed(2) + ' ms   render ' + counters.renderMs.toFixed(2) + '   hud ' + counters.hudMs.toFixed(2) + '   audio ' + counters.audioMs.toFixed(2) + '   gpu ' + counters.gpuMs.toFixed(2),
      'draw calls ' + counters.drawCalls + '   triangles ' + counters.triangles + '   render scale ' + counters.renderScale.toFixed(2),
      'actors ' + counts.actors + '   bots ' + counts.bots + '   ai ' + this.aiMilliseconds(stats.systems).toFixed(2) + ' ms   projectiles ' + counters.projectiles + '   particles ' + counters.particles + '   dropped steps ' + stats.droppedSteps,
      'heap ' + this.heapText() + '   device ' + Input.device + '   bot debug ' + (Ui.botDebug ? 'on' : 'off'),
      'systems ms: ' + (this.slowestSystems(stats.systems).join('  ') || '-'),
    ];
    const errors = ErrorLog.entries.slice(-PERF_ERROR_LINES);
    lines.push(errors.length ? 'errors:' : 'errors: none');
    for (const entry of errors) lines.push('  ' + entry.slice(0, PERF_ERROR_CHARS));
    return lines;
  },
  // F10 / four-finger tap flip the saved setting, so Options > Developer shows the same state.
  toggleSetting(key, label) {
    const next = !Settings.get(key);
    Settings.set(key, next);
    Ui.toast(label + (next ? ' on' : ' off'));
  },
  onAction(event) {
    if (!event.down) return;
    if (event.action === 'perfHud') this.toggleSetting('developer.perfHud', 'Performance overlay');
    else if (event.action === 'botDebug') this.toggleSetting('developer.botDebug', 'Bot debug view');
  },
};

Bus.on('boot', () => PerfOverlay.init());
Bus.on('input.action', (event) => PerfOverlay.onAction(event));
