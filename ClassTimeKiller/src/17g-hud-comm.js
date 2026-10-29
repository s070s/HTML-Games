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
const COMM_WHEEL_LABEL_GAP = 4, COMM_WHEEL_TOUCH_GAP = 4;   // design pixels: icon to label; ring to the touch buttons on phones
// On phones the ring fits below the ability row (its top bound) and beside the grenade button (the inner edge of the lower
// buttons), so no label sits under a default touch button and the whole ring stays on screen at any phone size.
const COMM_WHEEL_TOUCH_ROOF = 'ability1', COMM_WHEEL_TOUCH_WALL = 'grenade';
const COMM_WHEEL_FIT_ROUNDS = 8;       // cuts of the phone box for buttons still under a callout (commWheelPlaceRing)
const COMM_WHEEL_MIN_SHARE = 0.4;      // of COMM_WHEEL_RADIUS: the phone ring never shrinks below this (buttons at layout scale 2 leave 0.416)

const CommWheel = {
  open: false,
  source: '',           // what opened it: 'comm' or 'ping' (letting go of that one sends the callout)
  pickX: 0, pickY: 0,   // the look gathered since it opened (radians, y positive = down)
  selected: -1,         // index into COMM_CALLOUTS, -1 = none
  addressee: -1,        // the team bot aimed at when it opened (the callout goes to it only), -1 = the squad
  pingHeld: -1,         // s the Ping action has been held, -1 = up
  pingEdge: false,      // a sim step saw a Ping press that no frame saw held (a tap shorter than a frame is still a tap)
  pingSeen: false,      // a frame saw Ping held since the last sim step: that step's press is this one, not a new tap

  init() {},
  reset() { this.close(); this.pingHeld = -1; this.pingEdge = this.pingSeen = false; },
  // Sim step: the input latch (05a) keeps a press for one step even when it ended inside a frame.
  stepPing() {
    const player = Game.playerId;
    if (player >= 0 && Actors.alive[player] && !this.pingSeen && (Actors.pressed[player] & BTN.PING)) this.pingEdge = true;
    this.pingSeen = false;
  },
  frame(seconds) {
    const player = Game.playerId;
    if (player < 0 || !Game.isRunning() || !Actors.alive[player]) { this.pingEdge = false; if (this.open || this.pingHeld >= 0) this.reset(); return; }
    this.updatePing(player, seconds);
    if (this.open) this.takeLook();
  },
  // Ping: a tap pings at once on release; a hold opens the wheel and its release sends the picked callout.
  updatePing(player, seconds) {
    const edge = this.pingEdge;
    this.pingEdge = false;
    if (Input.effective[Input.actionIndex.ping]) {
      this.pingSeen = true;
      this.pingHeld = Math.max(0, this.pingHeld) + seconds;
      if (!this.open && this.pingHeld >= COMM_WHEEL_HOLD) this.show('ping', player);
      return;
    }
    if (this.pingHeld < 0) { if (edge) BotTeam.playerPing(player); return; }   // pressed and let go between two frames
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
Sim.addSystem('commPing', 5, () => CommWheel.stepPing());
TouchInput.buttonLook = (control) => CommWheel.open && control.action === 'ping';   // the finger holding PING picks the callout
TouchInput.needs.ping = () => Game.playerId >= 0 && currentRules().teams > 0;   // P5-01: PING shows in team matches, where a ping reaches somebody (a held one opens the wheel)
Bus.on('input.action', (event) => { if (event.action === 'comm') CommWheel.onComm(event.down); });
Bus.on('match.stop', () => CommWheel.reset());

// The callouts on a ring around the crosshair, the picked one larger and brighter.
function hudDrawCommWheel(pen, layout) {
  if (!CommWheel.open) return;
  const unit = layout.unit, count = COMM_CALLOUTS.length, ring = commWheelPlaceRing(layout), spot = commWheelSpot;
  pen.shape('square', ring.x, ring.y, (ring.radius + COMM_WHEEL_BACKDROP * unit) * 2, HUD_COLOR.black, 0.35);   // keeps the labels readable on bright walls
  for (let i = 0; i < count; i++) {
    const picked = i === CommWheel.selected;
    commWheelSpotOf(ring, i, picked, unit, spot);
    pen.shape('circle', spot.x, spot.y, spot.size, picked ? Hud.colors.good : HUD_COLOR.dim, picked ? 0.95 : 0.6);
    pen.label(COMM_CALLOUTS[i].label, spot.x, spot.labelY, HUD_TEXT_SMALL * unit, picked ? Hud.colors.good : HUD_COLOR.text, 'center');
  }
  const toY = ring.y + COMM_WHEEL_TO_RISE * unit, addressee = CommWheel.addressee;
  pen.label(COMM_WHEEL_TO, ring.x, toY, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'center');
  pen.label(addressee >= 0 ? Actors.name[addressee] : COMM_WHEEL_SQUAD, ring.x, toY + 16 * unit, HUD_TEXT_SMALL * unit, Hud.colors.good, 'center');
}

// ---- Where the ring goes: around the crosshair on desktops; on phones in the free area beside the lower touch buttons ----
// One source for the drawing and the phone layout test (hudui). Reused objects: nothing is allocated per frame.
const commWheelRing = { x: 0, y: 0, radius: 0 };
const commWheelSpot = { x: 0, y: 0, size: 0, labelY: 0 };
function commWheelWidestLabel(unit) {
  let widest = 0;
  for (let i = 0; i < COMM_CALLOUTS.length; i++) widest = Math.max(widest, HudPen.measure(COMM_CALLOUTS[i].label, HUD_TEXT_SMALL * unit));
  return widest;
}
// Phones: the box runs from below the ability row to the HUD bottom, and from the screen margin to the grenade button (the other
// way round in the left-handed layout); the ring is as large as fits there with its picked icon and labels, never above
// COMM_WHEEL_RADIUS. A shown button still under a callout (moved or grown in the layout editor) cuts the box on its side,
// unless that leaves the ring under COMM_WHEEL_MIN_SHARE of its size (then the callout stays under the button), and the ring
// never shrinks below that share.
const commWheelBox = { left: 0, top: 0, right: 0 }, commWheelLastBox = { left: 0, top: 0, right: 0 };
function commWheelPlaceRing(layout) {
  const ring = commWheelRing, unit = layout.unit, box = commWheelBox;
  ring.x = layout.centerX; ring.y = layout.centerY; ring.radius = COMM_WHEEL_RADIUS * unit;
  if (!layout.touch) return ring;
  const gap = COMM_WHEEL_TOUCH_GAP * unit;
  const roof = TouchInput.places[COMM_WHEEL_TOUCH_ROOF], wall = TouchInput.places[COMM_WHEEL_TOUCH_WALL];   // where the layer draws them (placeAll)
  const wallHalf = wall.radius + gap, wallX = wall.x, mirrored = wallX < layout.centerX;   // the left-handed preset has the buttons on the left
  box.top = roof.y + roof.radius + gap;
  box.left = mirrored ? wallX + wallHalf : layout.left; box.right = mirrored ? layout.right : wallX - wallHalf;
  const floor = COMM_WHEEL_MIN_SHARE * COMM_WHEEL_RADIUS * unit;
  for (let round = 0; ; round++) {
    if (commWheelFitBox(layout, ring, box, floor) < floor) {
      if (round > 0) commWheelFitBox(layout, ring, Object.assign(box, commWheelLastBox), floor);   // that cut was too deep: the box before it
      return ring;
    }
    const place = round < COMM_WHEEL_FIT_ROUNDS && commWheelBlocker(ring, unit);
    if (!place) return ring;
    const reach = place.radius + gap;
    Object.assign(commWheelLastBox, box);
    if (place.y < ring.y) box.top = Math.max(box.top, place.y + reach);
    else if (place.x < ring.x) box.left = Math.max(box.left, place.x + reach);
    else box.right = Math.min(box.right, place.x - reach);
  }
}
// The largest ring in the box down to the HUD bottom, with room for its picked icons and labels (returned); the ring drawn is
// never under floor, moved as little as keeps it on screen.
function commWheelFitBox(layout, ring, box, floor) {
  const unit = layout.unit, icon = COMM_WHEEL_ICON * COMM_WHEEL_PICKED * unit, above = icon / 2;
  const below = icon + COMM_WHEEL_LABEL_GAP * unit + hudTextHalf(HUD_TEXT_SMALL * unit), side = Math.max(above, commWheelWidestLabel(unit) / 2);
  const fits = Math.min(COMM_WHEEL_RADIUS * unit, (layout.bottom - box.top - above - below) / 2, (box.right - box.left) / 2 - side);
  const radius = ring.radius = Math.max(floor, fits);
  ring.x = clamp((box.left + box.right) / 2, layout.left + side + radius, layout.right - side - radius);
  ring.y = clamp((box.top + above + layout.bottom - below) / 2, layout.top + above + radius, layout.bottom - below - radius);
  return fits;
}
// The first shown touch button (the floating stick aside) that meets a callout at its picked size (the box from its icon's top
// to its label's bottom, as wide as the wider of the two), else null.
function commWheelBlocker(ring, unit) {
  const spot = commWheelSpot, textHalf = hudTextHalf(HUD_TEXT_SMALL * unit), places = TouchInput.places;
  for (let i = 0; i < COMM_CALLOUTS.length; i++) {
    commWheelSpotOf(ring, i, true, unit, spot);
    const iconHalf = spot.size / 2, halfWidth = Math.max(HudPen.measure(COMM_CALLOUTS[i].label, HUD_TEXT_SMALL * unit) / 2, iconHalf);
    const top = spot.y - iconHalf, bottom = spot.labelY + textHalf;
    for (let c = 1; c < TOUCH_CONTROLS.length; c++) {   // TOUCH_CONTROLS[0] is the stick
      const place = places[TOUCH_CONTROLS[c].id];
      if (place.shown && length2(clamp(place.x, spot.x - halfWidth, spot.x + halfWidth) - place.x, clamp(place.y, top, bottom) - place.y) < place.radius) return place;
    }
  }
  return null;
}
// One callout's icon centre and size and its label's centre line; the first at the top, then clockwise.
function commWheelSpotOf(ring, index, picked, unit, out) {
  const angle = (index / COMM_CALLOUTS.length) * 2 * Math.PI;
  out.x = ring.x + Math.sin(angle) * ring.radius; out.y = ring.y - Math.cos(angle) * ring.radius;
  out.size = COMM_WHEEL_ICON * unit * (picked ? COMM_WHEEL_PICKED : 1);
  out.labelY = out.y + out.size + COMM_WHEEL_LABEL_GAP * unit;
  return out;
}
Hud.register('front', 'commWheel', '', hudDrawCommWheel, true);
