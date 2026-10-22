// M20 Last Ring on the S13 framework: free-for-all survival on the RS10 bundle (agile movement, HPP06 loot shields, lootSet).
// The ring runs ringWait.length phases: wait ringWait[p] s, then shrink over ringShrink[p] s to ringScale[p] of the starting
// radius (the world's half-diagonal) while its centre drifts inside the old ring (Rng.rules); everyone outside takes
// ringDamage[p] HP per second. Loot spots are the map's items: weapons with a rolled rarity (WPN-008, Rng.loot), armor
// (shield by rarity), heals and ammo. No respawns: the last one standing wins.

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
const LOOT_RARITY_COLORS = [[0.7, 0.7, 0.7], [0.3, 0.85, 0.3], [0.3, 0.55, 1], [0.7, 0.3, 0.95], [1, 0.8, 0.2]];   // common .. legendary
const LOOT_SIZE = 0.5;
const LOOT_LIFT = 0.4;
const ROYALE_STANDING_RANK = 1000;     // standing actors rank above everyone out, then by kills

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
Modes.loot = RoyaleLoot;
Modes.ring = Ring;

Modes.register('royale', {
  hurtTimer: 0, lootTimer: 0, outCount: 0,
  start() {
    this.hurtTimer = 0; this.lootTimer = 0; this.outCount = 0;
    royaleOutOrder.fill(0);
    lootSwapAt.fill(0);
    startRing(Sim.time);
    buildLoot(World.map);
    updateRingHud(Sim.time);
  },
  step(dt, now) {
    stepRing(now);
    this.hurtOutside(dt);
    this.lootTimer += dt;
    if (this.lootTimer + TIME_EPSILON >= LOOT_CHECK_INTERVAL) { this.lootTimer -= LOOT_CHECK_INTERVAL; touchLoot(now); }
    updateRingHud(now);
  },
  hurtOutside(dt) {
    this.hurtTimer += dt;
    if (this.hurtTimer + TIME_EPSILON < RING_HURT_INTERVAL) return;
    this.hurtTimer -= RING_HURT_INTERVAL;
    for (let id = 0; id < Actors.count; id++) {
      if (Actors.alive[id] && Modes.isActive(id) && outsideRing(id)) requestHazard(id, Ring.damage * RING_HURT_INTERVAL);
    }
  },
  onKill(victim) {
    if (victim >= 0 && Modes.participant[victim] && !royaleOutOrder[victim]) royaleOutOrder[victim] = ++this.outCount;
  },
  isOver(now) {
    if (Modes.competitorsAtStart < 2) return Modes.standardIsOver(now);
    let standing = 0, last = DRAW;
    for (let id = 0; id < Actors.count; id++) if (Actors.alive[id] && Modes.isActive(id)) { standing++; last = id; }
    Modes.hud.aliveCount = standing;
    return standing > 1 ? NOT_OVER : Modes.over(standing === 1 ? last : DRAW, 'eliminated');
  },
  score(id) { return Actors.alive[id] ? ROYALE_STANDING_RANK + Modes.kills[id] : royaleOutOrder[id]; },
});

// ---- Ring ----
function startRing(now) {
  worldSafeArea(Ring);
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

// The next circle lies inside the current one and its centre on the map.
function chooseNextCircle(radius) {
  const slack = Math.max(0, Ring.radius - radius);
  const angle = Rng.rules.range(0, Math.PI * 2), offset = Math.sqrt(Rng.rules.next()) * slack;
  let x = Ring.x + Math.sin(angle) * offset, z = Ring.z + Math.cos(angle) * offset;
  if (Number.isFinite(World.boundsMin.x)) { x = clamp(x, World.boundsMin.x, World.boundsMax.x); z = clamp(z, World.boundsMin.z, World.boundsMax.z); }
  const drift = Math.hypot(x - Ring.x, z - Ring.z), keep = drift > slack ? slack / drift : 1;
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

function outsideRing(id) { return Math.hypot(Actors.x[id] - Ring.x, Actors.z[id] - Ring.z) > Ring.radius; }

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
    if (!Actors.alive[id] || !Modes.isActive(id)) continue;
    for (let spot = 0; spot < RoyaleLoot.count; spot++) {
      if (!RoyaleLoot.taken[spot] && withinTouch(id, RoyaleLoot.x[spot], RoyaleLoot.y[spot], RoyaleLoot.z[spot], TOUCH_RADIUS)) takeLoot(id, spot, now);
    }
  }
}

function takeLoot(id, spot, now) {
  const group = RoyaleLoot.group[spot], params = Modes.rules.params;
  if (group === LOOT_GROUP.WEAPON) { takeWeapon(id, spot, now); return; }
  if (group === LOOT_GROUP.ARMOR && !takeArmor(id, params.shieldByRarity[RoyaleLoot.rarity[spot]])) return;
  if (group === LOOT_GROUP.HEALTH && !takeHeal(id, params.lootHeal)) return;
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

function takeHeal(id, amount) {
  if (Actors.health[id] >= Actors.maxHealth[id]) return false;
  Actors.health[id] = Math.min(Actors.maxHealth[id], Actors.health[id] + amount);
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
  batch.mesh('ring', Ring.x, ground + RING_LIFT, Ring.z, 0, 0, Ring.radius, 1, Ring.radius, RING_COLOR[0], RING_COLOR[1], RING_COLOR[2], MARKER_GLOW);
  if (Ring.state !== RING_STATE.CLOSED) batch.mesh('ring', Ring.toX, ground + RING_LIFT, Ring.toZ, 0, 0, Ring.toRadius, 1, Ring.toRadius, RING_NEXT_COLOR[0], RING_NEXT_COLOR[1], RING_NEXT_COLOR[2], MARKER_GLOW);
  for (let spot = 0; spot < RoyaleLoot.count; spot++) {
    if (RoyaleLoot.taken[spot]) continue;
    const color = LOOT_RARITY_COLORS[RoyaleLoot.group[spot] <= LOOT_GROUP.ARMOR ? RoyaleLoot.rarity[spot] : 0];
    batch.mesh('box', RoyaleLoot.x[spot], RoyaleLoot.y[spot] + LOOT_LIFT, RoyaleLoot.z[spot], 0, 0, LOOT_SIZE, LOOT_SIZE, LOOT_SIZE, color[0], color[1], color[2], MARKER_GLOW);
  }
}

Bus.on('match.setup', () => { RoyaleLoot.count = 0; });
Render.addSource('royale', drawRoyale);
