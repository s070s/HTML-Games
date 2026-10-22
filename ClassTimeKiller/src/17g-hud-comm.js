// ==== S17 HUD: COMM WHEEL ====
// The comm and ping wheel (BOT-061/062, INP-003): hold Comm (T), or hold Ping (Z, pad d-pad right, the touch PING button)
// past COMM_WHEEL_HOLD, and the wheel of COMM_CALLOUTS (14f) opens. While it is open, look input (mouse, right stick, touch
// drag, gyro) picks a callout instead of turning the view; letting go sends it (BotTeam.callout: the team sees the ping,
// the bots take the order). A short Ping tap pings the aimed enemy or spot (BotTeam.playerPing). An Input source, so the look
// is taken in the input phase before the view uses it; nothing is allocated per frame.

const COMM_WHEEL_HOLD = 0.3;           // s a Ping press must be held to open the wheel instead of pinging
const COMM_WHEEL_DEADZONE = 0.02;      // radians of look before a callout is picked
const COMM_WHEEL_REACH = 0.06;         // the pick point stays this close to the centre, so turning to another callout is short
const COMM_WHEEL_RADIUS = 120, COMM_WHEEL_ICON = 18, COMM_WHEEL_PICKED = 1.35;   // design pixels (times the HUD unit)

const CommWheel = {
  open: false,
  source: '',           // what opened it: 'comm' or 'ping' (letting go of that one sends the callout)
  pickX: 0, pickY: 0,   // the look gathered since it opened (radians, y positive = down)
  selected: -1,         // index into COMM_CALLOUTS, -1 = none
  pingHeld: -1,         // s the Ping action has been held, -1 = up

  init() {},
  reset() { this.close(); this.pingHeld = -1; },
  frame(seconds) {
    const player = Game.playerId;
    if (player < 0 || !Game.isRunning() || !Actors.alive[player]) { if (this.open || this.pingHeld >= 0) this.reset(); return; }
    this.updatePing(player, seconds);
    if (this.open) this.takeLook();
  },
  // Ping: a tap pings at once on release; a hold opens the wheel and its release sends the picked callout.
  updatePing(player, seconds) {
    if (Input.effective[Input.actionIndex.ping]) {
      this.pingHeld = Math.max(0, this.pingHeld) + seconds;
      if (!this.open && this.pingHeld >= COMM_WHEEL_HOLD) this.show('ping');
      return;
    }
    if (this.pingHeld < 0) return;
    const tapped = this.pingHeld < COMM_WHEEL_HOLD;
    this.pingHeld = -1;
    if (tapped) BotTeam.playerPing(player);
    else if (this.source === 'ping') this.send(player);
  },
  onComm(down) {
    const player = Game.playerId;
    if (player < 0 || !Game.isRunning() || !Actors.alive[player]) return;
    if (down) this.show('comm');
    else if (this.source === 'comm') this.send(player);
  },
  show(source) {
    this.open = true; this.source = source;
    this.pickX = this.pickY = 0; this.selected = -1;
  },
  close() { this.open = false; this.source = ''; this.selected = -1; },
  send(player) {
    const selected = this.selected;
    this.close();
    if (selected >= 0) BotTeam.callout(player, selected);
  },
  // The look the devices gathered this frame moves the pick point; the view does not turn while the wheel is open.
  takeLook() {
    const look = Input.look;
    this.pick(look.mouseX + look.assistedX, look.mouseY + look.assistedY);
    look.mouseX = look.mouseY = look.assistedX = look.assistedY = 0;
  },
  // Past the dead zone the pick point's direction chooses the callout: the first at the top, then clockwise.
  pick(dx, dy) {
    this.pickX += dx; this.pickY += dy;
    const length = Math.hypot(this.pickX, this.pickY);
    if (length < COMM_WHEEL_DEADZONE) return;
    if (length > COMM_WHEEL_REACH) { this.pickX *= COMM_WHEEL_REACH / length; this.pickY *= COMM_WHEEL_REACH / length; }
    const count = COMM_CALLOUTS.length, angle = Math.atan2(this.pickX, -this.pickY);
    this.selected = (Math.round(angle / (2 * Math.PI / count)) + count) % count;
  },
};
Input.sources.push(CommWheel);
Bus.on('input.action', (event) => { if (event.action === 'comm') CommWheel.onComm(event.down); });
Bus.on('match.stop', () => CommWheel.reset());

// The callouts on a ring around the crosshair, the picked one larger and brighter.
function hudDrawCommWheel(pen, layout) {
  if (!CommWheel.open) return;
  const unit = layout.unit, count = COMM_CALLOUTS.length, radius = COMM_WHEEL_RADIUS * unit;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI, picked = i === CommWheel.selected;
    const x = layout.centerX + Math.sin(angle) * radius, y = layout.centerY - Math.cos(angle) * radius;
    const size = COMM_WHEEL_ICON * unit * (picked ? COMM_WHEEL_PICKED : 1);
    pen.shape('circle', x, y, size, picked ? Hud.colors.good : HUD_COLOR.dim, picked ? 0.95 : 0.6);
    pen.label(COMM_CALLOUTS[i].label, x, y + size + 4 * unit, HUD_TEXT_SMALL * unit, picked ? HUD_COLOR.text : HUD_COLOR.dim, 'center');
  }
}
Hud.register('front', 'commWheel', '', hudDrawCommWheel, true);
