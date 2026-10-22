// Bot debug view (BOT-091, F9 with the developer setting): each bot's path as small markers, its destination and its
// current target, plus a label over its head with tier, state, goal, role and the top goal scores. Pure view code:
// it reads the brains and never changes them. S18 defines and toggles the 'developer.botDebug' setting (F9).

const BOT_DEBUG_LABEL_PX = 12;
const BOT_DEBUG_LABEL_LIFT = 2.3;       // m above the feet
const BOT_DEBUG_MARKER = 0.15;
const BOT_DEBUG_MAX_POINTS = 48;
const BOT_DEBUG_COLORS = {
  path: [0.3, 0.9, 1], destination: [1, 0.85, 0.2], target: [1, 0.25, 0.2],
};
const BOT_DEBUG_TEXT = '#e8f4ff';


const debugPoint = Vec.make();
const debugScreen = { x: 0, y: 0 };

const BotDebug = {
  enabled: false,

  readSettings(key) { if (key === 'developer.botDebug') this.enabled = !!Settings.get(key); },
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
  drawLabels(hud) {
    if (!this.enabled) return;
    for (let id = 0; id < Actors.count; id++) {
      if (!Bots.isBot(id) || !projectToScreen(Actors.x[id], Actors.y[id] + BOT_DEBUG_LABEL_LIFT, Actors.z[id], hud)) continue;
      hud.text(this.label(id), debugScreen.x, debugScreen.y, BOT_DEBUG_LABEL_PX, BOT_DEBUG_TEXT, 'center', 0.9);
    }
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

// World point -> HUD pixels with the frame's view-projection matrix (column-major); false behind the camera.
function projectToScreen(x, y, z, hud) {
  const m = Render.frame.viewProjection;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (w <= 1e-3) return false;
  const clipX = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, clipY = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  debugScreen.x = (clipX * 0.5 + 0.5) * hud.width;
  debugScreen.y = (0.5 - clipY * 0.5) * hud.height;
  return Math.abs(clipX) <= 1 && Math.abs(clipY) <= 1;
}

Render.addSource('botDebug', (batch) => BotDebug.draw(batch));
HudBatch.addLayer('botDebug', 90, (hud) => BotDebug.drawLabels(hud));
Bus.on('setting', (key) => BotDebug.readSettings(key));
