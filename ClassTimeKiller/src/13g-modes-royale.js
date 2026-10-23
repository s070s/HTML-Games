// M20 Last Ring on the S13 framework: free-for-all survival on the RS10 bundle (agile movement, HPP06 loot shields, lootSet).
// The ring runs ringWait.length phases: wait ringWait[p] s, then shrink over ringShrink[p] s to ringScale[p] of the starting
// radius (the world's half-diagonal) while its centre drifts inside the old ring (Rng.rules); everyone outside takes
// ringDamage[p] HP per second. Loot spots are the map's items: weapons with a rolled rarity (WPN-008, Rng.loot), armor
// (shield by rarity), heals and ammo. No respawns: the last one standing wins.
// Squads (params.squadSize > 1 and more participants than one squad): Actors.team = squad index (rules.teams stays 0),
// squadmates spawn together, go down instead of dying (HPP06 downed, S11) and share params.squadBeacons respawn beacon
// uses at one beacon per squad; the last squad standing wins. Drop-in: every spawn falls in from ROYALE_DROP_HEIGHT.

const RING_HURT_INTERVAL = 1;          // the ring hurts once per second
const RING_STATE = { WAIT: 'wait', SHRINK: 'shrink', CLOSED: 'closed' };
const RING_COLOR = [0.35, 0.6, 1];
const RING_NEXT_COLOR = [1, 1, 1];
const RING_LIFT = 0.1;
const LOOT_MAX = 256;                  // ARC-011 pickup pool
const LOOT_CHECK_INTERVAL = 0.1;       // loot touch tests run at 10 Hz
const LOOT_SWAP_DELAY = 1;             // a full inventory swaps a weapon at most once per second (no swapping back at once)
const LOOT_GROUPS = ['weapon', 'armor', 'health', 'ammo'];
const LOOT_GROUP = { WEAPON: 0, ARMOR: 1, HEALTH: 2, AMMO: 3 };
const LOOT_CONSUMABLES = ['patch', 'cell', 'medkit', 'battery', 'fizzcan'];   // health spots by rarity: I13 I15 I14 I16 I17
const LOOT_RARITY_COLORS = [[0.7, 0.7, 0.7], [0.3, 0.85, 0.3], [0.3, 0.55, 1], [0.7, 0.3, 0.95], [1, 0.8, 0.2]];   // common .. legendary
const LOOT_SIZE = 0.5;
const LOOT_LIFT = 0.4;
const ROYALE_STANDING_RANK = 1000;     // standing actors rank above everyone out, then by kills
const ROYALE_DROP_HEIGHT = 30;         // m: drop-in height above the spawn (less under a roof: no drop indoors)
const DROP_PROBE = 1;                  // m: the roof and spread checks start this high above the feet
const DROP_SPREAD = 1.5;               // m: squadmates land this far around the squad's drop point
const BEACON_SECONDS = 4;              // a living squadmate holds Use this long at the beacon to bring the dead back
const BEACON_COLOR = [0.3, 1, 0.5];
const BEACON_HEIGHT = 2;

// Loot spots (struct of arrays). weapon = CAT.weapons index (weapon spots), rarity 0..4, taken 1 once picked up.
const RoyaleLoot = {
  count: 0,
  x: new Float32Array(LOOT_MAX), y: new Float32Array(LOOT_MAX), z: new Float32Array(LOOT_MAX),
  group: new Uint8Array(LOOT_MAX), weapon: new Int16Array(LOOT_MAX), rarity: new Uint8Array(LOOT_MAX), taken: new Uint8Array(LOOT_MAX),
};
// The ring: current circle (x, z, radius), the circle it shrinks from and to, the phase and the time of its next change.
const Ring = {
  phase: 0, phases: 0, state: '', x: 0, z: 0, radius: 0, startRadius: 0, damage: 0, changeAt: 0,
  fromX: 0, fromZ: 0, fromRadius: 0, toX: 0, toZ: 0, toRadius: 0,
};
const royaleOutOrder = new Uint16Array(MAX_ACTORS);       // 1 = first out; 0 = still standing
const lootSwapAt = new Float64Array(MAX_ACTORS);
// Squads, per squad index: the drop point of the current spawn wave (anchorAt = its Sim.time) and how many landed there,
// the beacon spot, its uses left and hold progress; holder/dead are 10 Hz scratch tallies.
const Squads = {
  count: 0,
  anchorX: new Float32Array(MAX_ACTORS), anchorY: new Float32Array(MAX_ACTORS), anchorZ: new Float32Array(MAX_ACTORS),
  anchorAt: new Float64Array(MAX_ACTORS), landed: new Uint8Array(MAX_ACTORS),
  beaconX: new Float32Array(MAX_ACTORS), beaconY: new Float32Array(MAX_ACTORS), beaconZ: new Float32Array(MAX_ACTORS),
  beaconUses: new Uint8Array(MAX_ACTORS), beaconProgress: new Float32Array(MAX_ACTORS),
  holder: new Uint8Array(MAX_ACTORS), dead: new Uint8Array(MAX_ACTORS), seen: new Uint8Array(MAX_ACTORS),
};
Modes.loot = RoyaleLoot;
Modes.ring = Ring;
Modes.squads = Squads;

Modes.register('royale', {
  hurtTimer: 0, lootTimer: 0, outCount: 0,
  start() {
    this.hurtTimer = 0; this.lootTimer = 0; this.outCount = 0;
    royaleOutOrder.fill(0);
    lootSwapAt.fill(0);
    assignSquads();
    placeBeacons();
    startRing(Sim.time);
    buildLoot(World.map);
    updateRingHud(Sim.time);
  },
  step(dt, now) {
    stepRing(now);
    this.hurtOutside(dt);
    if (intervalDue(this, 'lootTimer', dt, LOOT_CHECK_INTERVAL)) { touchLoot(now); stepBeacons(LOOT_CHECK_INTERVAL); }
    updateRingHud(now);
  },
  onSpawn(id) { dropIn(id); },
  hurtOutside(dt) {
    if (intervalDue(this, 'hurtTimer', dt, RING_HURT_INTERVAL)) hurtOutsideZone(Ring.x, Ring.z, Ring.radius, Ring.damage * RING_HURT_INTERVAL);
  },
  onKill(victim) {
    if (victim >= 0 && Modes.participant[victim] && !royaleOutOrder[victim]) royaleOutOrder[victim] = ++this.outCount;
  },
  // Counts sides standing: each squad once, each solo actor on its own. A won squad names the player when it is theirs.
  isOver(now) {
    if (Modes.competitorsAtStart < 2) return Modes.standardIsOver(now);
    let standing = 0, sides = 0, last = DRAW;
    Squads.seen.fill(0, 0, Squads.count);
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id] || !Modes.isActive(id)) continue;
      standing++;
      const squad = Actors.team[id];
      if (squad >= 0 && Squads.seen[squad]) continue;
      if (squad >= 0) Squads.seen[squad] = 1;
      sides++; last = id;
    }
    Modes.hud.aliveCount = standing;
    if (sides > 1) return NOT_OVER;
    return Modes.over(sides === 1 ? squadWinner(last) : DRAW, 'eliminated');
  },
  score(id) { return Actors.alive[id] ? ROYALE_STANDING_RANK + Modes.kills[id] : royaleOutOrder[id]; },
});

// ---- Squads, drop-in and beacons ----
// Round-robin squads of at most squadSize; one squad or fewer (a small match) plays solo.
function assignSquads() {
  const size = Modes.rules.params.squadSize || 1;
  const participants = Modes.countActive();
  Squads.count = size > 1 && participants > size ? Math.ceil(participants / size) : 0;
  Squads.anchorAt.fill(-1);
  let order = 0;
  for (let id = 0; id < Actors.count; id++) if (Modes.isActive(id)) Actors.team[id] = Squads.count ? order++ % Squads.count : NO_TEAM;
}

// One beacon per squad on distinct spawn points (from a random start), with params.squadBeacons uses.
function placeBeacons() {
  const points = Modes.spawnPoints, uses = Modes.rules.params.squadBeacons || 0;
  const offset = Squads.count && points.length ? Rng.rules.int(0, points.length - 1) : 0;
  for (let squad = 0; squad < Squads.count; squad++) {
    const point = points.length ? points[(offset + squad) % points.length] : null;
    Squads.beaconX[squad] = point ? point.x : 0; Squads.beaconY[squad] = point ? point.y : 0; Squads.beaconZ[squad] = point ? point.z : 0;
    Squads.beaconUses[squad] = point ? uses : 0;
    Squads.beaconProgress[squad] = 0;
  }
}

// The first squadmate of a spawn wave sets the squad's drop point; the others land around it.
// The drop lands without fall damage (Move.safeLanding) in every movement preset.
function dropIn(id) {
  const squad = Actors.team[id];
  if (squad >= 0 && Squads.count) joinSquadDrop(id, squad);
  const x = Actors.x[id], y = Actors.y[id], z = Actors.z[id];
  Move.safeLanding[id] = 0;
  if (!World.lineClear(x, y + DROP_PROBE, z, x, y + ROYALE_DROP_HEIGHT + STAND_HEIGHT, z)) return;
  Actors.y[id] = Actors.prevY[id] = y + ROYALE_DROP_HEIGHT;
  Move.safeLanding[id] = 1;
}

function joinSquadDrop(id, squad) {
  if (Squads.anchorAt[squad] !== Sim.time) { setSquadAnchor(squad, Actors.x[id], Actors.y[id], Actors.z[id]); return; }
  const slot = Squads.landed[squad]++;
  const angle = slot * Math.PI * 2 / Math.max(1, Modes.rules.params.squadSize);
  const anchorX = Squads.anchorX[squad], anchorY = Squads.anchorY[squad], anchorZ = Squads.anchorZ[squad];
  let x = anchorX, z = anchorZ;
  if (slot > 0) { x += Math.sin(angle) * DROP_SPREAD; z += Math.cos(angle) * DROP_SPREAD; }
  if (!World.lineClear(anchorX, anchorY + DROP_PROBE, anchorZ, x, anchorY + DROP_PROBE, z)) { x = anchorX; z = anchorZ; }
  Actors.place(id, x, anchorY, z);
}

function setSquadAnchor(squad, x, y, z) {
  Squads.anchorX[squad] = x; Squads.anchorY[squad] = y; Squads.anchorZ[squad] = z;
  Squads.anchorAt[squad] = Sim.time;
  Squads.landed[squad] = 1;
}

// 10 Hz: a squad with dead members and a beacon use left charges while a standing squadmate holds Use at its beacon.
function stepBeacons(interval) {
  if (!Squads.count) return;
  Squads.holder.fill(0, 0, Squads.count); Squads.dead.fill(0, 0, Squads.count);
  for (let id = 0; id < Actors.count; id++) {
    const squad = Actors.team[id];
    if (squad < 0 || squad >= Squads.count || !Modes.isActive(id)) continue;
    if (!Actors.alive[id]) Squads.dead[squad]++;
    else if (holdsBeacon(id, squad)) Squads.holder[squad] = 1;
  }
  for (let squad = 0; squad < Squads.count; squad++) {
    const charging = Squads.holder[squad] && Squads.dead[squad] > 0 && Squads.beaconUses[squad] > 0;
    Squads.beaconProgress[squad] = charging ? Squads.beaconProgress[squad] + interval : 0;
    if (charging && Squads.beaconProgress[squad] + TIME_EPSILON >= BEACON_SECONDS) respawnSquad(squad);
  }
}

function holdsBeacon(id, squad) {
  return (Actors.buttons[id] & BTN.USE) !== 0 && (Actors.flags[id] & ACTOR_FLAG.DOWNED) === 0
    && withinTouchAt(id, Squads.beaconX, Squads.beaconY, Squads.beaconZ, squad, TOUCH_RADIUS);
}

// The squad's dead drop in over the beacon and count as standing again.
function respawnSquad(squad) {
  Squads.beaconUses[squad]--;
  Squads.beaconProgress[squad] = 0;
  setSquadAnchor(squad, Squads.beaconX[squad], Squads.beaconY[squad], Squads.beaconZ[squad]);
  Squads.landed[squad] = 0;
  for (let id = 0; id < Actors.count; id++) {
    if (Actors.team[id] !== squad || Actors.alive[id] || !Modes.isActive(id)) continue;
    royaleOutOrder[id] = 0;
    Modes.spawnActor(id);
  }
  Modes.announce('A squad respawned at its beacon', 'objective', 2);
}

function squadWinner(id) {
  const player = Game.playerId;
  return Squads.count && player >= 0 && Actors.isAlly(player, id) ? player : id;
}

// ---- Ring ----
function startRing(now) {
  mapRingStart(Ring);
  Ring.startRadius = Ring.radius;
  Ring.phases = Modes.rules.params.ringWait.length;
  beginRingPhase(0, now);
}

function beginRingPhase(phase, now) {
  const params = Modes.rules.params;
  Ring.phase = phase;
  Ring.state = RING_STATE.WAIT;
  Ring.changeAt = now + params.ringWait[phase];
  Ring.damage = params.ringDamage[phase];
  Ring.fromX = Ring.x; Ring.fromZ = Ring.z; Ring.fromRadius = Ring.radius;
  chooseNextCircle(params.ringScale[phase] * Ring.startRadius);
}

// The map's own ring centre and start radius (map.ring, e.g. generated islands) when it has a valid one, else the world bounds.
function mapRingStart(out) {
  const ring = World.map ? World.map.ring : null;
  const valid = ring && Number.isFinite(ring.x) && Number.isFinite(ring.z) && ring.radius > 0;
  if (!valid) return worldSafeArea(out);
  out.x = ring.x; out.z = ring.z; out.radius = ring.radius;
  return out;
}

// The next circle lies inside the current one and its centre on the map.
function chooseNextCircle(radius) {
  const slack = Math.max(0, Ring.radius - radius);
  const angle = Rng.rules.range(0, Math.PI * 2), offset = Math.sqrt(Rng.rules.next()) * slack;
  let x = Ring.x + Math.sin(angle) * offset, z = Ring.z + Math.cos(angle) * offset;
  if (Number.isFinite(World.boundsMin.x)) { x = clamp(x, World.boundsMin.x, World.boundsMax.x); z = clamp(z, World.boundsMin.z, World.boundsMax.z); }
  const drift = length2(x - Ring.x, z - Ring.z), keep = drift > slack ? slack / drift : 1;
  Ring.toX = Ring.x + (x - Ring.x) * keep; Ring.toZ = Ring.z + (z - Ring.z) * keep; Ring.toRadius = radius;
}

function stepRing(now) {
  if (Ring.state === RING_STATE.CLOSED) return;
  const params = Modes.rules.params;
  if (Ring.state === RING_STATE.WAIT) {
    if (now + TIME_EPSILON < Ring.changeAt) return;
    Ring.state = RING_STATE.SHRINK;
    Ring.changeAt += params.ringShrink[Ring.phase];
    Modes.announce('The ring is closing', 'objective', 2);
  }
  const shrink = params.ringShrink[Ring.phase];
  const done = now + TIME_EPSILON >= Ring.changeAt;
  const t = done || shrink <= 0 ? 1 : clamp(1 - (Ring.changeAt - now) / shrink, 0, 1);
  Ring.x = lerp(Ring.fromX, Ring.toX, t); Ring.z = lerp(Ring.fromZ, Ring.toZ, t); Ring.radius = lerp(Ring.fromRadius, Ring.toRadius, t);
  if (!done) return;
  if (Ring.phase + 1 < Ring.phases) beginRingPhase(Ring.phase + 1, Ring.changeAt);
  else Ring.state = RING_STATE.CLOSED;
}

function updateRingHud(now) {
  const hud = Modes.hud;
  hud.zoneX = Ring.x; hud.zoneZ = Ring.z; hud.zoneRadius = Ring.radius;
  hud.ringPhase = Ring.phase + 1; hud.ringPhases = Ring.phases; hud.ringState = Ring.state; hud.ringDamage = Ring.damage;
  hud.ringTimeLeft = Ring.state === RING_STATE.CLOSED ? 0 : Math.max(0, Ring.changeAt - now);
  hud.ringNextX = Ring.toX; hud.ringNextZ = Ring.toZ; hud.ringNextRadius = Ring.toRadius;
}

// ---- Loot spots ----
function buildLoot(map) {
  const params = Modes.rules.params, items = map && map.items ? map.items : [];
  RoyaleLoot.count = 0;
  for (const item of items) {
    const group = LOOT_GROUPS.indexOf(item.group);
    if (group < 0 || RoyaleLoot.count >= LOOT_MAX) continue;
    if (item.modes && item.modes.length && !item.modes.includes(Modes.mode.id)) continue;
    const spot = RoyaleLoot.count++;
    RoyaleLoot.x[spot] = item.x; RoyaleLoot.y[spot] = item.y || 0; RoyaleLoot.z[spot] = item.z;
    RoyaleLoot.group[spot] = group; RoyaleLoot.taken[spot] = 0;
    RoyaleLoot.rarity[spot] = rollRarity(params.rarityWeights);
    RoyaleLoot.weapon[spot] = group === LOOT_GROUP.WEAPON ? lootWeaponIndex(item.item) : -1;
  }
}

// Rarity index 0..4 drawn by weight (common .. legendary).
function rollRarity(weights) {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];
  let roll = Rng.loot.next() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

// The spot's own weapon when it is a gun, else a random gun of the match's weapon set.
function lootWeaponIndex(key) {
  const own = CAT.weapons.byId(key);
  if (own && own.class !== 'melee') return own.index;
  const guns = currentWeaponSet().weapons.filter((id) => CAT.weapons.byId(id).class !== 'melee');
  return CAT.weapons.byId(guns.length ? Rng.loot.pick(guns) : ROULETTE_FALLBACK).index;
}

function touchLoot(now) {
  for (let id = 0; id < Actors.count; id++) {
    if (!Items.canTouch(id, true) || !Modes.isActive(id)) continue;   // the one pickup gate: no loot while downed (HP-007)
    for (let spot = 0; spot < RoyaleLoot.count; spot++) {
      if (!RoyaleLoot.taken[spot] && withinTouchAt(id, RoyaleLoot.x, RoyaleLoot.y, RoyaleLoot.z, spot, TOUCH_RADIUS)) takeLoot(id, spot, now);
    }
  }
}

function takeLoot(id, spot, now) {
  const group = RoyaleLoot.group[spot], params = Modes.rules.params;
  if (group === LOOT_GROUP.WEAPON) { takeWeapon(id, spot, now); return; }
  if (group === LOOT_GROUP.ARMOR && !takeArmor(id, params.shieldByRarity[RoyaleLoot.rarity[spot]])) return;
  if (group === LOOT_GROUP.HEALTH && !Items.grant(id, LOOT_CONSUMABLES[RoyaleLoot.rarity[spot]])) return;   // carried until used (BTN.HEAL)
  if (group === LOOT_GROUP.AMMO && !takeAmmo(id)) return;
  RoyaleLoot.taken[spot] = 1;
}

// A full inventory takes a new weapon only while USE is held; the dropped weapon stays on the spot with its rarity.
function takeWeapon(id, spot, now) {
  const key = CAT.weapons[RoyaleLoot.weapon[spot]].id;
  if (Weapons.has(id, key)) { takeDuplicate(id, key, spot); return; }
  if (Weapons.atCarryLimit(id) && ((Actors.buttons[id] & BTN.USE) === 0 || now < lootSwapAt[id])) return;
  Weapons.give(id, key, RoyaleLoot.rarity[spot]);
  const dropped = Weapons.dropped ? CAT.weapons.byId(Weapons.dropped) : null;
  if (!dropped) { RoyaleLoot.taken[spot] = 1; return; }
  RoyaleLoot.weapon[spot] = dropped.index;
  RoyaleLoot.rarity[spot] = Weapons.droppedRarity;
  lootSwapAt[id] = now + LOOT_SWAP_DELAY;
}

// A copy of an owned weapon is taken only when it adds ammo (or makes a pair); the better rarity of the two is kept.
function takeDuplicate(id, key, spot) {
  if (!Weapons.give(id, key, RoyaleLoot.rarity[spot])) return;
  const slot = Weapons.slotIndex(id, CAT.weapons.byId(key).index);
  Weapons.rarity[slot] = Math.max(Weapons.rarity[slot], RoyaleLoot.rarity[spot]);
  RoyaleLoot.taken[spot] = 1;
}

// HPP06: armor sets the shield to its rarity's value; taken only when it beats the shield now.
function takeArmor(id, value) {
  if (Actors.shield[id] >= value) return false;
  Actors.maxShield[id] = value;
  Actors.shield[id] = value;
  return true;
}

function takeAmmo(id) {
  const weapon = Weapons.currentWeapon(id);
  return !!weapon && weapon.ammoType !== '' && Weapons.addAmmo(id, weapon.ammoType, 0) > 0;
}

// The ring wall (current circle), the next circle on the ground and the loot spots in their rarity colours.
function drawRoyale(batch) {
  if (!Modes.active || Modes.mode.id !== 'royale') return;
  const ground = Modes.spawnPoints.length ? Modes.spawnPoints[0].y : 0;
  drawRing(batch, Ring.x, ground, Ring.z, Ring.radius, RING_COLOR);
  if (Ring.state !== RING_STATE.CLOSED) drawRing(batch, Ring.toX, ground, Ring.toZ, Ring.toRadius, RING_NEXT_COLOR);
  const instance = royaleInstance;
  instance.sx = LOOT_SIZE; instance.sy = LOOT_SIZE; instance.sz = LOOT_SIZE;
  royaleAmmoModel = ammoModelFor(Game.playerId);
  for (let spot = 0; spot < RoyaleLoot.count; spot++) {
    if (RoyaleLoot.taken[spot]) continue;
    const color = LOOT_RARITY_COLORS[RoyaleLoot.group[spot] <= LOOT_GROUP.ARMOR ? RoyaleLoot.rarity[spot] : 0];
    instance.x = RoyaleLoot.x[spot]; instance.y = RoyaleLoot.y[spot] + LOOT_LIFT; instance.z = RoyaleLoot.z[spot];
    instance.r = color[0]; instance.g = color[1]; instance.b = color[2];
    if (RoyaleLoot.group[spot] === LOOT_GROUP.WEAPON) batch.meshFrom('box', instance);
    else drawLootModel(batch, spot, instance);
  }
  const pose = royalePose;
  pose.scale = BEACON_HEIGHT; pose.yaw = 0; pose.emissive = MARKER_GLOW;
  pose.r = BEACON_COLOR[0]; pose.g = BEACON_COLOR[1]; pose.b = BEACON_COLOR[2];
  for (let squad = 0; squad < Squads.count; squad++) {
    if (!Squads.beaconUses[squad]) continue;
    pose.x = Squads.beaconX[squad]; pose.y = Squads.beaconY[squad]; pose.z = Squads.beaconZ[squad];
    Models.draw(batch, BEACON_MODEL, pose);
  }
}

// Armor, heal and ammo spots show their gear models (03r, spinning like map pickups): a vest in the rarity colour, the
// consumable the spot gives, and the ammo box of the local player's held weapon (what takeAmmo gives). The squad beacon is
// the G24 Rally Beacon model, BEACON_HEIGHT x its size.
const LOOT_ARMOR_MODEL = GEAR_MODELS.byId[CAT.items.byId('vest').code];
const LOOT_HEAL_ROWS = LOOT_CONSUMABLES.map((id) => CAT.items.byId(id));
const BEACON_MODEL = GEAR_MODELS.byId[CAT.gadgets.byId('beacon').code];
const royalePose = makeModelPose();
let royaleAmmoModel = null;
function drawLootModel(batch, spot, instance) {
  const pose = royalePose, group = RoyaleLoot.group[spot], heal = LOOT_HEAL_ROWS[RoyaleLoot.rarity[spot]];
  pose.x = instance.x; pose.y = instance.y; pose.z = instance.z; pose.yaw = Sim.time * PICKUP_SPIN; pose.scale = 1; pose.emissive = MARKER_GLOW;
  pose.r = instance.r; pose.g = instance.g; pose.b = instance.b;
  if (group === LOOT_GROUP.ARMOR) { Models.draw(batch, LOOT_ARMOR_MODEL, pose); return; }
  if (group === LOOT_GROUP.AMMO) { Models.draw(batch, royaleAmmoModel, pose); return; }
  const rgb = PICKUP_RGB[PICKUP_KIND.ITEM], offset = heal.index * 3;
  pose.r = rgb[offset]; pose.g = rgb[offset + 1]; pose.b = rgb[offset + 2];
  Models.draw(batch, PICKUP_MODELS[PICKUP_KIND.ITEM][heal.index], pose);
}

// Loot boxes and the two ring markers go through one reused instance record (batch.meshFrom, PERF-006: the loot
// loop would box 13 float arguments per box); the rings are two calls a frame.
const royaleInstance = Object.assign(makeShapeInstance(), { emissive: MARKER_GLOW });
function drawRing(batch, x, ground, z, radius, color) {
  const instance = royaleInstance;
  instance.x = x; instance.y = ground + RING_LIFT; instance.z = z; instance.sx = radius; instance.sy = 1; instance.sz = radius;
  instance.r = color[0]; instance.g = color[1]; instance.b = color[2];
  batch.meshFrom('ring', instance);
}

Bus.on('match.setup', () => { RoyaleLoot.count = 0; Squads.count = 0; });
Render.addSource('royale', drawRoyale);
