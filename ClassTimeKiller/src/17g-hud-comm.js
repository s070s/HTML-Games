// ==== S17 HUD: COMM WHEEL ====
// The comm and ping wheel (BOT-061/062, INP-003): hold Comm (T), or hold Ping (Z, pad d-pad right, the touch PING button)
// past COMM_WHEEL_HOLD, and the wheel of COMM_CALLOUTS (14f) opens. While it is open, look input (mouse, right stick, touch
// drag, gyro) picks a callout instead of turning the view; letting go sends it (BotTeam.callout: the team sees the ping,
// the bots take the order). A short Ping tap pings the aimed enemy or spot (BotTeam.playerPing). Opened while aiming at a team
// bot, the wheel addresses that bot only (else the squad); a reply (Dibs / No / On my way) answers the newest teammate ping on
// the HUD (17d HudPings). The look arrives with the devices' invert-Y already applied (05a/05b/05c), so the pick moves the way
// the view would. An Input source, so the look is taken in the input phase before the view uses it; nothing is allocated per frame.

const COMM_WHEEL_HOLD = 0.3;           // s a Ping press must be held to open the wheel instead of pinging
const COMM_WHEEL_DEADZONE = 0.02;      // radians of look before a callout is picked
const COMM_WHEEL_REACH = 0.06;         // the pick point stays this close to the centre, so turning to another callout is short
const COMM_WHEEL_RADIUS = 150, COMM_WHEEL_ICON = 18, COMM_WHEEL_PICKED = 1.35, COMM_WHEEL_BACKDROP = 60;   // design pixels (times the HUD unit)
const COMM_WHEEL_TO_RISE = 30;         // design pixels: the "orders to" line sits this far below the centre
const COMM_WHEEL_SQUAD = 'SQUAD', COMM_WHEEL_TO = 'ORDERS TO';

const CommWheel = {
  open: false,
  source: '',           // what opened it: 'comm' or 'ping' (letting go of that one sends the callout)
  pickX: 0, pickY: 0,   // the look gathered since it opened (radians, y positive = down)
  selected: -1,         // index into COMM_CALLOUTS, -1 = none
  addressee: -1,        // the team bot aimed at when it opened (the callout goes to it only), -1 = the squad
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
      if (!this.open && this.pingHeld >= COMM_WHEEL_HOLD) this.show('ping', player);
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
    if (down) this.show('comm', player);
    else if (this.source === 'comm') this.send(player);
  },
  show(source, player) {
    this.open = true; this.source = source;
    this.pickX = this.pickY = 0; this.selected = -1;
    this.addressee = BotTeam.addressee(player);
  },
  close() { this.open = false; this.source = ''; this.selected = -1; this.addressee = -1; },
  send(player) {
    const selected = this.selected, addressee = this.addressee;
    this.close();
    if (selected < 0) return;
    if (COMM_CALLOUTS[selected].at === 'reply') this.reply(player, selected);
    else BotTeam.callout(player, selected, addressee);
  },
  // A reply goes to the newest teammate ping still shown, at its spot; with none it is said at the caller's feet.
  reply(player, index) {
    const slot = HudPings.newestToAnswer(player);
    if (slot < 0) { BotTeam.callout(player, index, -1); return; }
    BotTeam.reply(player, index, HudPings.source[slot], HudPings.x[slot], HudPings.y[slot], HudPings.z[slot]);
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
    const length = length2(this.pickX, this.pickY);
    if (length < COMM_WHEEL_DEADZONE) return;
    if (length > COMM_WHEEL_REACH) { this.pickX *= COMM_WHEEL_REACH / length; this.pickY *= COMM_WHEEL_REACH / length; }
    const count = COMM_CALLOUTS.length, angle = Math.atan2(this.pickX, -this.pickY);
    this.selected = (Math.round(angle / (2 * Math.PI / count)) + count) % count;
  },
};
Input.sources.push(CommWheel);
TouchInput.needs.comm = () => true;   // the touch COMM button (05b) shows now that the wheel exists
Bus.on('input.action', (event) => { if (event.action === 'comm') CommWheel.onComm(event.down); });
Bus.on('match.stop', () => CommWheel.reset());

// The callouts on a ring around the crosshair, the picked one larger and brighter.
function hudDrawCommWheel(pen, layout) {
  if (!CommWheel.open) return;
  const unit = layout.unit, count = COMM_CALLOUTS.length, radius = COMM_WHEEL_RADIUS * unit;
  pen.shape('square', layout.centerX, layout.centerY, (radius + COMM_WHEEL_BACKDROP * unit) * 2, HUD_COLOR.black, 0.35);   // keeps the labels readable on bright walls
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI, picked = i === CommWheel.selected;
    const x = layout.centerX + Math.sin(angle) * radius, y = layout.centerY - Math.cos(angle) * radius;
    const size = COMM_WHEEL_ICON * unit * (picked ? COMM_WHEEL_PICKED : 1);
    pen.shape('circle', x, y, size, picked ? Hud.colors.good : HUD_COLOR.dim, picked ? 0.95 : 0.6);
    pen.label(COMM_CALLOUTS[i].label, x, y + size + 4 * unit, HUD_TEXT_SMALL * unit, picked ? Hud.colors.good : HUD_COLOR.text, 'center');
  }
  const toY = layout.centerY + COMM_WHEEL_TO_RISE * unit, addressee = CommWheel.addressee;
  pen.label(COMM_WHEEL_TO, layout.centerX, toY, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'center');
  pen.label(addressee >= 0 ? Actors.name[addressee] : COMM_WHEEL_SQUAD, layout.centerX, toY + 16 * unit, HUD_TEXT_SMALL * unit, Hud.colors.good, 'center');
}
Hud.register('front', 'commWheel', '', hudDrawCommWheel, true);
