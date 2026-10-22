// ==== S12 ABILITIES / ITEMS ====
// 12a: the pickup framework (step 10.1, PWR-001, WPN-009). Map item spots become runtime pickups on 'match.start' (one pooled
// struct-of-arrays store of 256), actors take them by touching them with their capsule, spots respawn on exact tick timers
// x rules.itemRespawnScale, and deaths drop weapons (rules.dropOnDeath) that vanish after 30 s. 12b adds powerups through
// Items.takers, 12c/12d grenades and devices. API: docs/api/items-gadgets.md.

const PICKUP_CAP = 256;
const PICKUP_STATE = { FREE: 0, READY: 1, WAITING: 2 };
const PICKUP_KIND = { ITEM: 0, POWERUP: 1, WEAPON: 2 };
const PICKUP_GROUPS = ['health', 'armor', 'ammo', 'weapon', 'power', 'tactical', 'loot'];
const PICKUP_GROUP_COLORS = [0x3fd870, 0xffc040, 0xc8b070, 0x8090a0, 0xb040ff, 0x6a7a5a, 0xf0f0f0];
const PICKUP_REACH = ACTOR_RADIUS + 0.5;   // touch distance on the floor plane (capsule radius + item size)
const PICKUP_BELOW = 0.6;                  // an item floor point this far below the feet still counts (steps, slopes)
const PICKUP_FLOAT = 0.55;                 // pickups float this high above their floor point
const PICKUP_SPIN = 1.8;                   // rad/s
const PICKUP_BOB = 0.08;                   // m up and down
const PICKUP_NOISE = 12;                   // bots hear a pickup within this radius (BOT-005); power items further
const POWER_PICKUP_NOISE = 40;
const DROP_RING = 0.8;                     // several drops of one death spread on a ring this wide
const SOUL_HOMING_RANGE = 6;               // ABL-005: souls fly to a nearby player
const SOUL_HOMING_SPEED = 8;
const ANNOUNCE_POWER_PRIORITY = 2;
const NO_TICK = -1;

const PICKUP_EVENT = { id: 0, item: '', group: '', x: 0, y: 0, z: 0 };
const RESPAWN_EVENT = { item: '', group: '', x: 0, y: 0, z: 0 };
const ITEM_ANNOUNCE = { text: '', kind: 'power', priority: ANNOUNCE_POWER_PRIORITY };
const ITEM_SOUND = { x: 0, y: 0, z: 0, radius: 0, kind: 'pickup', source: -1 };
const ITEM_COUNT = CAT.items.length;
CAT.items.forEach((row, index) => { row.index = index; });
CAT.powerups.forEach((row, index) => { row.index = index; });

// Catalogue rows of a pickup kind (index order = the store's `row` field).
const PICKUP_ROWS = [CAT.items, CAT.powerups, CAT.weapons];
// Colours as 0..1 floats per kind and row, computed once (the draw reads them every frame).
const PICKUP_RGB = [CAT.items, CAT.powerups, CAT.weapons].map((rows) => pickupRgbTable(rows, (row) => row.family ? row.family.color : row.color));
const timerViews = makePool(PICKUP_CAP, () => ({ item: '', group: '', x: 0, y: 0, z: 0, remaining: 0 }));

function pickupRgbTable(rows, colorOf) {
  const table = new Float32Array(rows.length * 3);
  rows.forEach((row, index) => { pickupHexColor(table, index * 3, colorOf(row)); });
  return table;
}
// 0xRRGGBB or '#rrggbb' into three 0..1 floats.
function pickupHexColor(out, offset, color) {
  const value = typeof color === 'string' ? parseInt(color.slice(1), 16) : color;
  out[offset] = (value >> 16 & 255) / 255; out[offset + 1] = (value >> 8 & 255) / 255; out[offset + 2] = (value & 255) / 255;
}
const itemTicks = (seconds) => Math.round(seconds * TICK_RATE);
// The ruleset fields S12 reads, with the spec defaults when a test or menu runs without them.
function itemRule(field, fallback) {
  const value = currentRules()[field];
  return value === undefined ? fallback : value;
}
function itemMutatorOn(id) {
  const list = itemRule('mutators', []);
  for (let i = 0; i < list.length; i++) if (list[i] === id || list[i].id === id) return true;
  return false;
}

const Items = {
  state: new Uint8Array(PICKUP_CAP), kind: new Uint8Array(PICKUP_CAP), row: new Int16Array(PICKUP_CAP), group: new Uint8Array(PICKUP_CAP),
  x: new Float32Array(PICKUP_CAP), y: new Float32Array(PICKUP_CAP), z: new Float32Array(PICKUP_CAP),
  spot: new Uint8Array(PICKUP_CAP),                 // 1 = a map spot (respawns), 0 = a dropped pickup (vanishes)
  readyTick: new Int32Array(PICKUP_CAP),            // WAITING: Sim.tick it becomes READY
  despawnTick: new Int32Array(PICKUP_CAP),          // dropped pickups: Sim.tick they vanish
  timeLeft: new Int32Array(PICKUP_CAP),             // dropped powerups: ticks of effect left (0 = the full duration)
  warned: new Uint8Array(PICKUP_CAP),               // PWR-002: the 10 s warning of this wait was announced
  blocker: new Int8Array(PICKUP_CAP).fill(-1),      // the actor who dropped it cannot take it back until stepping off it
  spotCount: 0,                                     // map spots use slots 0..spotCount-1, drops the rest
  carried: new Uint8Array(MAX_ACTORS * ITEM_COUNT), // loot consumables carried (I13..I17)
  usingItem: new Int16Array(MAX_ACTORS).fill(-1), useStart: new Int32Array(MAX_ACTORS), useEnd: new Int32Array(MAX_ACTORS),
  noArmor: new Uint8Array(MAX_ACTORS),              // written by 12b (scout rune): armor pickups refused
  takers: [],                                       // PICKUP_KIND -> fn(id, slot) -> true when taken (12b fills POWERUP)
  effects: {},                                      // item `effect` -> fn(id, row) -> true when it did something
  extraAmmo: [],                                    // fn(id, row) -> true: more refills of an ammo pickup (12c: grenades)
  uniqueOut: (rowIndex) => false,                   // 12b: a unique powerup is held by someone (its spot waits)

  // ---- Lookups ----
  resolve(key) {
    if (CAT.items.byId(key)) return PICKUP_KIND.ITEM;
    if (CAT.powerups.byId(key)) return PICKUP_KIND.POWERUP;
    return CAT.weapons.byId(key) ? PICKUP_KIND.WEAPON : -1;
  },
  rowOf(slot) { return PICKUP_ROWS[this.kind[slot]][this.row[slot]]; },
  keyOf(slot) { return this.rowOf(slot).id; },
  groupName(slot) { return PICKUP_GROUPS[this.group[slot]]; },
  groupFor(kind, row) {
    if (kind === PICKUP_KIND.POWERUP || (kind === PICKUP_KIND.WEAPON && row.class === 'power')) return PICKUP_GROUPS.indexOf('power');
    return PICKUP_GROUPS.indexOf(kind === PICKUP_KIND.WEAPON ? 'weapon' : row.group);
  },
  isPower(slot) { return this.group[slot] === PICKUP_GROUPS.indexOf('power'); },

  // ---- Map spots (match.start) ----
  clear() {
    this.state.fill(0); this.spot.fill(0); this.warned.fill(0); this.blocker.fill(-1);
    this.spotCount = 0;
  },
  // entries: map items [{ x, y, z, item, group, modes }]; mode filters each entry's `modes` list (empty = every mode).
  load(entries, mode) {
    this.clear();
    for (let i = 0; i < entries.length && this.spotCount < PICKUP_CAP; i++) {
      const entry = entries[i];
      if (entry.modes && entry.modes.length && !entry.modes.includes(mode)) continue;
      this.addSpot(entry);
    }
  },
  addSpot(entry) {
    const kind = this.resolve(entry.item);
    if (kind < 0) { ErrorLog.add('items', 'unknown item key ' + entry.item); return -1; }
    if (kind === PICKUP_KIND.POWERUP && itemMutatorOn('nopowerups')) return -1;   // X16
    const slot = this.spotCount++;
    this.place(slot, kind, PICKUP_ROWS[kind].byId(entry.item).index, entry.x, entry.y, entry.z);
    this.spot[slot] = 1;
    if (this.isPower(slot)) this.wait(slot, this.firstPowerTicks());
    return slot;
  },
  place(slot, kind, rowIndex, x, y, z) {
    this.state[slot] = PICKUP_STATE.READY; this.kind[slot] = kind; this.row[slot] = rowIndex;
    this.group[slot] = this.groupFor(kind, PICKUP_ROWS[kind][rowIndex]);
    this.x[slot] = x; this.y[slot] = y; this.z[slot] = z;
    this.despawnTick[slot] = NO_TICK; this.timeLeft[slot] = 0; this.warned[slot] = 0; this.blocker[slot] = -1;
  },
  // PWR-001: power items first appear 45 +/- 15 s after the start (seeded per spot).
  firstPowerTicks() { return itemTicks(ITEM_TIMING.firstPowerSpawn + Rng.loot.range(-ITEM_TIMING.firstPowerSpread, ITEM_TIMING.firstPowerSpread)); },
  wait(slot, ticks) {
    this.state[slot] = PICKUP_STATE.WAITING;
    this.readyTick[slot] = Sim.tick + ticks;
    this.warned[slot] = 0;
  },
  // Respawn time of a spot in ticks (PWR-001, WPN-009) x rules.itemRespawnScale.
  respawnTicks(slot) {
    const row = this.rowOf(slot), pad = CAT.items.byId('weaponpad');
    let seconds = row.respawn;
    if (this.kind[slot] === PICKUP_KIND.WEAPON) seconds = row.class === 'power' ? pad.respawnPower : itemRule('teams', 0) > 0 ? pad.respawnTeams : pad.respawn;
    return itemTicks(seconds * itemRule('itemRespawnScale', 1));
  },
  // Weapon stay (X11, rules.weaponStay): a weapon spot stays for everyone who does not own that weapon; power weapons never stay.
  stays(slot) {
    return this.spot[slot] === 1 && this.kind[slot] === PICKUP_KIND.WEAPON && itemRule('weaponStay', false) === true && this.rowOf(slot).class !== 'power';
  },

  // ---- Dropped pickups ----
  // Drops a pickup by key at a floor point; it vanishes after 30 s. timeLeft: powerup ticks left (0 = full). Returns the slot or -1.
  drop(key, x, y, z, timeLeft, dropper) {
    const kind = this.resolve(key);
    if (kind < 0) return -1;
    const slot = this.dropSlot();
    if (slot < 0) return -1;
    this.place(slot, kind, PICKUP_ROWS[kind].byId(key).index, x, y, z);
    this.spot[slot] = 0;
    this.despawnTick[slot] = Sim.tick + itemTicks(ITEM_TIMING.droppedSeconds);
    this.timeLeft[slot] = timeLeft || 0;
    this.blocker[slot] = dropper === undefined ? -1 : dropper;
    return slot;
  },
  // A free slot after the map spots; a full store recycles the drop closest to vanishing.
  dropSlot() {
    let oldest = -1;
    for (let slot = this.spotCount; slot < PICKUP_CAP; slot++) {
      if (this.state[slot] === PICKUP_STATE.FREE) return slot;
      if (oldest < 0 || this.despawnTick[slot] < this.despawnTick[oldest]) oldest = slot;
    }
    return oldest;
  },
  // Point k of n on a small ring around a death, so several drops do not overlap.
  dropAround(key, id, k, n, timeLeft) {
    const angle = n > 1 ? k / n * Math.PI * 2 : 0, ring = n > 1 ? DROP_RING : 0;
    return this.drop(key, Actors.x[id] + Math.cos(angle) * ring, Actors.y[id], Actors.z[id] + Math.sin(angle) * ring, timeLeft, -1);
  },
  // rules.dropOnDeath: 'none' | 'held' (the held weapon) | 'all' (every carried weapon); melee and tools never drop.
  dropWeapons(victim) {
    const rule = itemRule('dropOnDeath', 'held');
    if (rule === 'none') return;
    const held = Weapons.currentWeapon(victim);
    if (rule === 'held') { if (held && Weapons.countsTowardCarry(held)) this.dropAround(held.id, victim, 0, 1, 0); return; }
    let count = 0;
    for (let w = 0; w < WEAPON_COUNT; w++) if (this.dropsWeapon(victim, w)) count++;
    let k = 0;
    for (let w = 0; w < WEAPON_COUNT; w++) if (this.dropsWeapon(victim, w)) this.dropAround(CAT.weapons[w].id, victim, k++, count, 0);
  },
  dropsWeapon(id, weaponIndex) { return Weapons.owned[Weapons.slotIndex(id, weaponIndex)] === 1 && Weapons.countsTowardCarry(CAT.weapons[weaponIndex]); },
  // PU18: kills of PvE enemies drop souls where the mode asks for them (rules.params.souls or the 'souls' mutator).
  dropSoul(victim) {
    const params = itemRule('params', null);
    if (Actors.kind[victim] !== ACTOR_KIND.ENEMY || !((params && params.souls) || itemMutatorOn('souls'))) return;
    this.drop('soul', Actors.x[victim], Actors.y[victim] + 0.5, Actors.z[victim], 0, -1);
  },

  // ---- The per-step update (Sim order 60) ----
  step(dt) {
    for (let slot = 0; slot < PICKUP_CAP; slot++) {
      const state = this.state[slot];
      if (state === PICKUP_STATE.WAITING) this.stepWaiting(slot);
      else if (state === PICKUP_STATE.READY) this.stepReady(slot, dt);
    }
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id] || (Actors.flags[id] & ACTOR_FLAG.DOWNED)) continue;
      this.touch(id);
      if (this.usingItem[id] >= 0 && Sim.tick >= this.useEnd[id]) this.finishUse(id);
    }
  },
  stepWaiting(slot) {
    const row = this.rowOf(slot);
    if (this.kind[slot] === PICKUP_KIND.POWERUP && row.unique && (this.uniqueOut(row.index) || this.dropExists(slot))) { this.readyTick[slot] = Sim.tick + this.respawnTicks(slot); return; }
    if (this.isPower(slot) && !this.warned[slot] && this.readyTick[slot] - Sim.tick <= itemTicks(ITEM_TIMING.powerWarning)) this.warnPower(slot);
    if (Sim.tick < this.readyTick[slot]) return;
    this.state[slot] = PICKUP_STATE.READY;
    RESPAWN_EVENT.item = row.id; RESPAWN_EVENT.group = this.groupName(slot);
    RESPAWN_EVENT.x = this.x[slot]; RESPAWN_EVENT.y = this.y[slot]; RESPAWN_EVENT.z = this.z[slot];
    Bus.emit('item.respawn', RESPAWN_EVENT);
  },
  stepReady(slot, dt) {
    if (this.spot[slot]) return;
    if (Sim.tick >= this.despawnTick[slot]) { this.state[slot] = PICKUP_STATE.FREE; return; }
    if (this.kind[slot] === PICKUP_KIND.POWERUP && this.rowOf(slot).id === 'soul') this.homeSoul(slot, dt);
  },
  // A dropped copy of the same row lies around (unique powerups wait for it).
  dropExists(spotSlot) {
    for (let slot = this.spotCount; slot < PICKUP_CAP; slot++) {
      if (this.state[slot] === PICKUP_STATE.READY && this.kind[slot] === this.kind[spotSlot] && this.row[slot] === this.row[spotSlot]) return true;
    }
    return false;
  },
  warnPower(slot) {
    this.warned[slot] = 1;
    this.announce(this.rowOf(slot).name + ' in ' + ITEM_TIMING.powerWarning + ' seconds');
  },
  announce(text) {
    ITEM_ANNOUNCE.text = text;
    Bus.emit('announce', ITEM_ANNOUNCE);
  },
  homeSoul(slot, dt) {
    let best = -1, bestDistance = SOUL_HOMING_RANGE;
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id] || Actors.kind[id] === ACTOR_KIND.ENEMY) continue;
      const distance = Math.hypot(Actors.x[id] - this.x[slot], Actors.z[id] - this.z[slot]);
      if (distance < bestDistance) { best = id; bestDistance = distance; }
    }
    if (best < 0 || bestDistance < 1e-3) return;
    const move = Math.min(bestDistance, SOUL_HOMING_SPEED * dt) / bestDistance;
    this.x[slot] += (Actors.x[best] - this.x[slot]) * move; this.z[slot] += (Actors.z[best] - this.z[slot]) * move;
    this.y[slot] += (Actors.y[best] - this.y[slot]) * move;
  },

  // ---- Touch and take ----
  touching(id, slot) {
    const dx = this.x[slot] - Actors.x[id], dz = this.z[slot] - Actors.z[id], dy = this.y[slot] - Actors.y[id];
    return dx * dx + dz * dz <= PICKUP_REACH * PICKUP_REACH && dy >= -PICKUP_BELOW && dy <= Actors.height[id];
  },
  touch(id) {
    for (let slot = 0; slot < PICKUP_CAP; slot++) {
      if (this.state[slot] !== PICKUP_STATE.READY) continue;
      const touching = this.touching(id, slot);
      if (this.blocker[slot] === id) { if (!touching) this.blocker[slot] = -1; continue; }
      if (touching) this.take(id, slot);
    }
  },
  take(id, slot) {
    if (!this.takers[this.kind[slot]](id, slot)) return false;
    this.emitPickup(id, slot);
    if (this.stays(slot)) return true;
    if (this.spot[slot]) this.wait(slot, this.respawnTicks(slot));
    else this.state[slot] = PICKUP_STATE.FREE;
    return true;
  },
  emitPickup(id, slot) {
    const row = this.rowOf(slot), group = this.groupName(slot);
    PICKUP_EVENT.id = id; PICKUP_EVENT.item = row.id; PICKUP_EVENT.group = group;
    PICKUP_EVENT.x = this.x[slot]; PICKUP_EVENT.y = this.y[slot]; PICKUP_EVENT.z = this.z[slot];
    Bus.emit('pickup', PICKUP_EVENT);
    ITEM_SOUND.x = this.x[slot]; ITEM_SOUND.y = this.y[slot]; ITEM_SOUND.z = this.z[slot]; ITEM_SOUND.source = id;
    ITEM_SOUND.radius = this.isPower(slot) ? POWER_PICKUP_NOISE : PICKUP_NOISE;
    Bus.emit('sound', ITEM_SOUND);
    if (this.isPower(slot) && row.announce !== false) this.announce(Actors.name[id] + ' took the ' + row.name);
  },
  takeItem(id, slot) {
    const row = CAT.items[this.row[slot]];
    return this.effects[row.effect](id, row);
  },
  takeWeapon(id, slot) {
    const weapon = CAT.weapons[this.row[slot]];
    if (this.stays(slot) && Weapons.has(id, weapon.id)) return false;
    if (!Weapons.give(id, weapon.id, 0)) return false;
    // At the carry limit the held weapon was swapped out: it lands at the feet, and this actor cannot grab it back at once.
    if (Weapons.dropped) this.drop(Weapons.dropped, Actors.x[id], this.y[slot], Actors.z[id], 0, id);
    return true;
  },

  // ---- Item effects (I01..I17) ----
  healthCap(id, row) {
    if (!row.overheal) return Actors.maxHealth[id];
    return Math.max(Actors.maxHealth[id], Math.min(row.cap, Damage.preset().overhealCap));
  },
  addHealth(id, amount, cap) {
    if (Actors.health[id] >= cap) return false;
    Actors.health[id] = Math.min(cap, Actors.health[id] + amount);
    return true;
  },
  addArmor(id, amount, cap) {
    const limit = Math.min(cap, Actors.maxArmor[id]);
    if (this.noArmor[id] || Actors.armor[id] >= limit) return false;
    Actors.armor[id] = Math.min(limit, Actors.armor[id] + amount);
    return true;
  },
  // I08: the held weapon's ammo type (weapon-sized: each weapon's pickupAmmo); the first other type that needs it otherwise.
  addTypeAmmo(id) {
    const held = Weapons.currentWeapon(id);
    if (held && held.mag > 0 && Weapons.addAmmo(id, held.ammoType, 0) > 0) return true;
    for (let w = 0; w < WEAPON_COUNT; w++) {
      if (this.dropsWeapon(id, w) && CAT.weapons[w].mag > 0 && Weapons.addAmmo(id, CAT.weapons[w].ammoType, 0) > 0) return true;
    }
    return false;
  },
  // I09: every owned weapon + amount x its max ammo, plus the extra refills (kit grenades).
  addAllAmmo(id, row) {
    let added = 0;
    for (let w = 0; w < WEAPON_COUNT; w++) {
      const weapon = CAT.weapons[w];
      if (weapon.mag > 0 && Weapons.owned[Weapons.slotIndex(id, w)]) added += Weapons.addWeaponAmmo(id, weapon, Math.round(Weapons.maxReserve(id, weapon) * row.amount));
    }
    let extra = false;
    for (let i = 0; i < this.extraAmmo.length; i++) if (this.extraAmmo[i](id, row)) extra = true;
    return added > 0 || extra;
  },

  // ---- Bought and loot items ----
  // Gives an item outright (economy buys: helmet, vest; tests). Returns true when it did something.
  grant(id, key) {
    const row = CAT.items.byId(key);
    return !!row && this.effects[row.effect](id, row);
  },
  carriedCount(id, key) { const row = CAT.items.byId(key); return row ? this.carried[id * ITEM_COUNT + row.index] : 0; },
  // Starts using a carried loot consumable (I13..I17): it applies after its useTime. Returns false when it would do nothing.
  use(id, key) {
    const row = CAT.items.byId(key);
    if (!row || row.effect !== 'consume' || !Actors.alive[id] || this.usingItem[id] >= 0) return false;
    if (!this.carried[id * ITEM_COUNT + row.index] || !this.wouldRestore(id, row)) return false;
    this.usingItem[id] = row.index;
    this.useStart[id] = Sim.tick;
    this.useEnd[id] = Sim.tick + itemTicks(row.useTime);
    return true;
  },
  // 0..1 progress of the consumable in use, -1 when none (HUD).
  useProgress(id) {
    if (this.usingItem[id] < 0) return -1;
    return clamp((Sim.tick - this.useStart[id]) / Math.max(1, this.useEnd[id] - this.useStart[id]), 0, 1);
  },
  cancelUse(id) { this.usingItem[id] = -1; },
  finishUse(id) {
    const row = CAT.items[this.usingItem[id]];
    this.usingItem[id] = -1;
    this.carried[id * ITEM_COUNT + row.index]--;
    this.restore(id, row);
  },
  restoreCap(id, row) { return row.restores === 'shield' ? Actors.maxShield[id] : row.cap || Actors.maxHealth[id]; },
  wouldRestore(id, row) {
    if (row.restores === 'overflow') return Actors.health[id] < Actors.maxHealth[id] || Actors.shield[id] < Actors.maxShield[id];
    return (row.restores === 'shield' ? Actors.shield[id] : Actors.health[id]) < this.restoreCap(id, row);
  },
  restore(id, row) {
    const cap = this.restoreCap(id, row), amount = row.amount || cap;
    if (row.restores === 'shield') { Actors.shield[id] = Math.min(cap, Actors.shield[id] + amount); return; }
    const room = Math.max(0, cap - Actors.health[id]);
    Actors.health[id] += Math.min(room, amount);
    if (row.restores === 'overflow') Actors.shield[id] = Math.min(Actors.maxShield[id], Actors.shield[id] + Math.max(0, amount - room));
  },
  resetActor(id) {
    this.carried.fill(0, id * ITEM_COUNT, (id + 1) * ITEM_COUNT);
    this.usingItem[id] = -1; this.noArmor[id] = 0;
  },

  // ---- HUD hooks ----
  // Fills out (array of { item, x, y, z, remaining, group }) with the spots that are respawning; returns the count.
  timers(out) {
    out.length = 0;
    for (let slot = 0; slot < this.spotCount; slot++) {
      if (this.state[slot] !== PICKUP_STATE.WAITING) continue;
      const view = timerViews.items[out.length];
      view.item = this.keyOf(slot); view.group = this.groupName(slot); view.x = this.x[slot]; view.y = this.y[slot]; view.z = this.z[slot];
      view.remaining = Math.max(0, this.readyTick[slot] - Sim.tick) / TICK_RATE;
      out.push(view);
    }
    return out.length;
  },
  // Fills out (array of { id, name, remaining, duration, color }) with the actor's active powerups; returns the count (12b).
  activePowerups(id, out) { out.length = 0; return 0; },

  // ---- Render source: spinning procedural shapes in group colours; empty spots show a faint base ----
  draw(batch) {
    const spin = Sim.time * PICKUP_SPIN, bob = Math.sin(Sim.time * 2) * PICKUP_BOB;
    for (let slot = 0; slot < PICKUP_CAP; slot++) {
      const state = this.state[slot];
      if (state === PICKUP_STATE.READY) this.drawPickup(batch, slot, spin, bob);
      else if (state === PICKUP_STATE.WAITING) this.drawBase(batch, slot, 0.25);
    }
  },
  drawPickup(batch, slot, spin, bob) {
    const kind = this.kind[slot], index = this.row[slot], row = this.rowOf(slot), rgb = PICKUP_RGB[kind], offset = index * 3;
    const y = this.y[slot] + PICKUP_FLOAT + bob, power = this.isPower(slot);
    if (this.spot[slot]) this.drawBase(batch, slot, power ? 0.9 : 0.5);
    if (kind === PICKUP_KIND.WEAPON) { batch.mesh('box', this.x[slot], y, this.z[slot], spin, 0, 0.18, 0.2, 0.8, rgb[offset], rgb[offset + 1], rgb[offset + 2], power ? 0.8 : 0.35); return; }
    const size = row.size, shape = row.shape;
    batch.mesh(shape, this.x[slot], y, this.z[slot], spin, 0, size, shape === 'ring' ? size * 0.3 : size, size, rgb[offset], rgb[offset + 1], rgb[offset + 2], power ? 0.9 : 0.45);
  },
  drawBase(batch, slot, glow) {
    const color = PICKUP_GROUP_COLORS[this.group[slot]];
    pickupHexColor(pickupBaseColor, 0, color);
    batch.mesh('cylinder', this.x[slot], this.y[slot] + 0.02, this.z[slot], 0, 0, 1, 0.04, 1, pickupBaseColor[0], pickupBaseColor[1], pickupBaseColor[2], glow);
  },
};
const pickupBaseColor = new Float32Array(3);

Items.takers[PICKUP_KIND.ITEM] = (id, slot) => Items.takeItem(id, slot);
Items.takers[PICKUP_KIND.POWERUP] = () => false;   // 12b replaces it
Items.takers[PICKUP_KIND.WEAPON] = (id, slot) => Items.takeWeapon(id, slot);
Items.effects.health = (id, row) => Items.addHealth(id, row.amount, Items.healthCap(id, row));
Items.effects.armor = (id, row) => Items.addArmor(id, row.amount, row.cap);
Items.effects.ammoType = (id) => Items.addTypeAmmo(id);
Items.effects.ammoAll = (id, row) => Items.addAllAmmo(id, row);
Items.effects.weapon = () => false;                // weapon spots carry the weapon row itself
Items.effects.helmet = (id) => { if (Damage.helmet[id]) return false; Damage.helmet[id] = 1; return true; };
Items.effects.vest = (id, row) => Items.addArmor(id, row.amount, row.cap);
Items.effects.consume = (id, row) => {
  const slot = id * ITEM_COUNT + row.index;
  if (Items.carried[slot] >= row.stack) return false;
  Items.carried[slot]++;
  return true;
};

Sim.addSystem('items', 60, (dt) => Items.step(dt));
Render.addSource('pickups', (batch) => Items.draw(batch));
Bus.on('match.start', (match) => Items.load(match.map && match.map.items ? match.map.items : [], match.rules ? match.rules.mode : ''));
Bus.on('match.stop', () => Items.clear());
Bus.on('kill', (event) => { Items.dropWeapons(event.victim); Items.dropSoul(event.victim); Items.cancelUse(event.victim); });
Bus.on('actor.spawn', (event) => Items.resetActor(event.id));
Bus.on('actor.create', (id) => Items.resetActor(id));
