// Bot debug view (BOT-091/092, F9 with the developer setting): each bot's path as small markers, its destination and its
// current target; on the HUD its vision cone, its alert meter and its awareness of the player as bars, the nav graph
// near the camera, and a label over its head with tier, state, goal, role and the top goal scores. Pure view code:
// it reads the brains and never changes them. S18 defines and toggles the 'developer.botDebug' setting (F9).
// Per frame it allocates nothing: the nav lines sit in one reused buffer and a label's text is rebuilt 4 times a second.

const BOT_DEBUG_LABEL_PX = 12;
const BOT_DEBUG_LABEL_LIFT = 2.3;       // m above the feet
const BOT_DEBUG_LABEL_SECONDS = 0.25;   // a label's text is rebuilt this often
const BOT_DEBUG_MARKER = 0.15;
const BOT_DEBUG_MAX_POINTS = 48;
const BOT_DEBUG_NAV_LINKS = 8000;       // link segments the nav overlay keeps
const BOT_DEBUG_NAV_RANGE = 35;         // m from the camera: farther links are skipped (the HUD has a quad budget)
const BOT_DEBUG_CONE_SEGMENTS = 6;      // the cone's far edge as this many lines
const BOT_DEBUG_LINE_PX = 1.5;
const BOT_DEBUG_NEAR = 0.05;            // clip w below which a point is behind the camera (lines are cut there)
const BOT_DEBUG_BAR = { width: 44, height: 4, gap: 2, drop: 10 };   // px; the bars sit under the label
const BOT_DEBUG_COLORS = {
  path: [0.3, 0.9, 1], destination: [1, 0.85, 0.2], target: [1, 0.25, 0.2],
};
const BOT_DEBUG_HUD = {
  text: '#e8f4ff', cone: '#7fd0ff', coneAlerted: '#ff8a5c', alert: '#ffcc33', alerted: '#ff4433', aware: '#66e08a', barBack: '#10161c',
};
const BOT_DEBUG_LINK_COLOR_BY_KEY = {
  walk: '#4f9f6a', crouch: '#3f8faf', jump: '#e0c040', drop: '#c07040', ladder: '#c0c0ff', jumppad: '#ff60ff', teleport: '#60ffff', swim: '#4080ff',
};
const BOT_DEBUG_LINK_COLORS = NAV_LINK_ROWS.map((row) => BOT_DEBUG_LINK_COLOR_BY_KEY[row.key]);   // by NAV_LINK type

const debugPoint = Vec.make();
const debugScreen = { x: 0, y: 0 };
const debugLineStart = { x: 0, y: 0 }, debugLineEnd = { x: 0, y: 0 };

const BotDebug = {
  enabled: false,
  navLines: new Float32Array(NAV_DEBUG_STRIDE * BOT_DEBUG_NAV_LINKS), navCount: 0, navStale: true,
  labelText: new Array(MAX_ACTORS).fill(''), labelAt: new Float64Array(MAX_ACTORS).fill(-1e9),
  stats: { lines: 0, bars: 0, labels: 0 },   // what the last HUD pass drew (tests)

  readSettings(key) {
    if (key !== 'developer.botDebug') return;
    this.enabled = !!Settings.get(key);
    this.navStale = true;
  },
  draw(batch) {
    if (!this.enabled) return;
    for (let id = 0; id < Actors.count; id++) if (Bots.isBot(id)) this.drawBot(batch, id);
  },
  drawBot(batch, id) {
    const points = Math.min(BotMove.pointCount[id], BOT_DEBUG_MAX_POINTS);
    for (let i = BotMove.pointIndex[id]; i < points; i++) {
      Nav.resultPoint(id, i, debugPoint);
      marker(batch, debugPoint.x, debugPoint.y, debugPoint.z, BOT_DEBUG_MARKER, BOT_DEBUG_COLORS.path);
    }
    if (BotMove.hasDest[id]) marker(batch, BotMove.destX[id], BotMove.destY[id], BotMove.destZ[id], BOT_DEBUG_MARKER * 2, BOT_DEBUG_COLORS.destination);
    const target = BotCombat.target[id];
    if (target >= 0) marker(batch, Actors.x[target], Actors.eyeY(target) + 0.4, Actors.z[target], BOT_DEBUG_MARKER * 1.5, BOT_DEBUG_COLORS.target);
  },
  // HUD pass: nav graph first (underneath), then each living bot's cone, label and bars.
  drawHud(hud) {
    if (!this.enabled) return;
    this.stats.lines = 0; this.stats.bars = 0; this.stats.labels = 0;
    this.drawNav(hud);
    for (let id = 0; id < Actors.count; id++) if (Bots.isBot(id) && Actors.alive[id]) this.drawBotHud(hud, id);
  },
  // The graph is fixed per map, so it is read once into the buffer (again after a map load or a toggle).
  drawNav(hud) {
    if (this.navStale) { this.navCount = Nav.debugLines(this.navLines); this.navStale = false; }
    const lines = this.navLines, camera = Render.camera, reach = BOT_DEBUG_NAV_RANGE * BOT_DEBUG_NAV_RANGE;
    for (let i = 0; i < this.navCount; i++) {
      const o = i * NAV_DEBUG_STRIDE;
      if (distanceSquared3(lines[o], lines[o + 1], lines[o + 2], camera.x, camera.y, camera.z) > reach) continue;
      debugWorldLine(hud, lines[o], lines[o + 1], lines[o + 2], lines[o + 3], lines[o + 4], lines[o + 5], BOT_DEBUG_LINK_COLORS[lines[o + 6]], 0.7);
    }
  },
  drawBotHud(hud, id) {
    this.drawCone(hud, id);
    if (!projectToScreen(Actors.x[id], Actors.y[id] + BOT_DEBUG_LABEL_LIFT, Actors.z[id], hud, debugScreen)) return;
    hud.text(this.labelFor(id), debugScreen.x, debugScreen.y, BOT_DEBUG_LABEL_PX, BOT_DEBUG_HUD.text, 'center', 0.9);
    this.stats.labels++;
    this.drawBars(hud, id, debugScreen.x, debugScreen.y + BOT_DEBUG_BAR.drop);
  },
  // Vision cone (BOT-003): the two edges of the tier's field of view out to the view range, and the far edge between.
  drawCone(hud, id) {
    const yaw = Actors.yaw[id], half = Bots.tier(id).fov * DEG / 2, range = BotSense.viewRange(id);
    const x = Actors.x[id], y = Actors.eyeY(id), z = Actors.z[id];
    const color = BotSense.alerted(id) ? BOT_DEBUG_HUD.coneAlerted : BOT_DEBUG_HUD.cone;
    debugWorldLine(hud, x, y, z, x + Math.sin(yaw - half) * range, y, z + Math.cos(yaw - half) * range, color, 0.8);
    debugWorldLine(hud, x, y, z, x + Math.sin(yaw + half) * range, y, z + Math.cos(yaw + half) * range, color, 0.8);
    const step = (2 * half) / BOT_DEBUG_CONE_SEGMENTS;
    for (let segment = 0; segment < BOT_DEBUG_CONE_SEGMENTS; segment++) {
      const a = yaw - half + step * segment, b = a + step;
      debugWorldLine(hud, x + Math.sin(a) * range, y, z + Math.cos(a) * range, x + Math.sin(b) * range, y, z + Math.cos(b) * range, color, 0.5);
    }
  },
  // Top bar: the bot's alert meter (BOT-005, red once alerted). Bottom bar: its awareness of the player (BOT-004).
  drawBars(hud, id, x, top) {
    const left = x - BOT_DEBUG_BAR.width / 2;
    this.bar(hud, left, top, BotSense.alert[id], BotSense.alerted(id) ? BOT_DEBUG_HUD.alerted : BOT_DEBUG_HUD.alert);
    const player = Game.playerId;
    if (player < 0 || player === id) return;
    this.bar(hud, left, top + BOT_DEBUG_BAR.height + BOT_DEBUG_BAR.gap, BotSense.awareness[BotSense.pair(id, player)], BOT_DEBUG_HUD.aware);
  },
  bar(hud, left, top, value, color) {
    hud.rect(left, top, BOT_DEBUG_BAR.width, BOT_DEBUG_BAR.height, BOT_DEBUG_HUD.barBack, 0.7);
    hud.rect(left, top, BOT_DEBUG_BAR.width * clamp(value, 0, 1), BOT_DEBUG_BAR.height, color, 0.95);
    this.stats.bars++;
  },
  labelFor(id) {
    const now = Sim.time;
    if (now - this.labelAt[id] < BOT_DEBUG_LABEL_SECONDS && now >= this.labelAt[id]) return this.labelText[id];
    this.labelAt[id] = now;
    this.labelText[id] = this.label(id);
    return this.labelText[id];
  },
  // "Name BT3 engage/attack (defend) a.82 o.61" : tier, state, goal, role and the two best goal scores.
  label(id) {
    const goal = BotDecide.goal[id], role = BotTeam.role[id];
    return Actors.name[id] + ' ' + Bots.tier(id).code + ' ' + BOT_STATE_NAMES[Bots.state[id]] + '/' + GOAL_NAMES[goal] +
      (role ? ' (' + ROLE_NAMES[role] + ')' : '') + ' ' + topScores(id);
  },
};

function marker(batch, x, y, z, size, color) {
  batch.mesh('sphere', x, y, z, 0, 0, size, size, size, color[0], color[1], color[2], 1);
}

function topScores(id) {
  let first = 0, second = 0;
  const base = id * GOAL_COUNT;
  for (let goal = 1; goal < GOAL_COUNT; goal++) {
    const score = BotDecide.scores[base + goal];
    if (score > BotDecide.scores[base + first]) { second = first; first = goal; } else if (score > BotDecide.scores[base + second]) second = goal;
  }
  return scoreText(id, first) + ' ' + scoreText(id, second);
}

function scoreText(id, goal) { return GOAL_NAMES[goal].charAt(0) + BotDecide.scores[id * GOAL_COUNT + goal].toFixed(2).slice(1); }

// Clip-space w of a world point with the frame's view-projection matrix (column-major): its depth in front of the camera.
function debugClipDepth(x, y, z) {
  const m = Render.frame.viewProjection;
  return m[3] * x + m[7] * y + m[11] * z + m[15];
}

// World point -> HUD pixels into out; true when it is in front of the camera and on the screen.
function projectToScreen(x, y, z, hud, out) {
  const m = Render.frame.viewProjection, w = debugClipDepth(x, y, z);
  if (w <= 1e-3) return false;
  const clipX = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, clipY = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out.x = (clipX * 0.5 + 0.5) * hud.width;
  out.y = (0.5 - clipY * 0.5) * hud.height;
  return Math.abs(clipX) <= 1 && Math.abs(clipY) <= 1;
}

// The world segment a-b as a HUD line. The part behind the camera is cut off at the near limit; a line wholly off
// one side of the screen is skipped.
function debugWorldLine(hud, ax, ay, az, bx, by, bz, color, alpha) {
  const wa = debugClipDepth(ax, ay, az), wb = debugClipDepth(bx, by, bz);
  if (wa <= BOT_DEBUG_NEAR && wb <= BOT_DEBUG_NEAR) return;
  const cutA = wa < BOT_DEBUG_NEAR ? (BOT_DEBUG_NEAR - wa) / (wb - wa) : 0;   // fraction from a toward b
  const cutB = wb < BOT_DEBUG_NEAR ? (BOT_DEBUG_NEAR - wb) / (wa - wb) : 0;   // fraction from b toward a
  projectToScreen(ax + (bx - ax) * cutA, ay + (by - ay) * cutA, az + (bz - az) * cutA, hud, debugLineStart);
  projectToScreen(bx + (ax - bx) * cutB, by + (ay - by) * cutB, bz + (az - bz) * cutB, hud, debugLineEnd);
  if (debugLineOffScreen(hud)) return;
  hud.line(debugLineStart.x, debugLineStart.y, debugLineEnd.x, debugLineEnd.y, BOT_DEBUG_LINE_PX, color, alpha);
  BotDebug.stats.lines++;
}

function debugLineOffScreen(hud) {
  if (debugLineStart.x < 0 && debugLineEnd.x < 0) return true;
  if (debugLineStart.y < 0 && debugLineEnd.y < 0) return true;
  return (debugLineStart.x > hud.width && debugLineEnd.x > hud.width) || (debugLineStart.y > hud.height && debugLineEnd.y > hud.height);
}

Render.addSource('botDebug', (batch) => BotDebug.draw(batch));
HudBatch.addLayer('botDebug', 90, (hud) => BotDebug.drawHud(hud));
Bus.on('setting', (key) => BotDebug.readSettings(key));
Bus.on('world.load', () => { BotDebug.navStale = true; });
Bus.on('match.start', () => { BotDebug.navStale = true; BotDebug.labelAt.fill(-1e9); });
