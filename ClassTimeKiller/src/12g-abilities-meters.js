// ==== S12 ABILITIES: METERS ====
// The energy bar (ABL-002: 100, regen 5/s after the meter row's regenDelay, +25 per kill orb; HPP08 suits: 25/s after 2 s;
// a draining toggle or hold spends every step, so it never regenerates while it runs) and the match meter of
// rules.meter (ECO-003): streak (score-based rewards), boost (time + score), adrenaline (kills, sprees, captures and
// 4-tap combos), ultimate (5/s + 1 per damage or healing dealt). A34 souls home to their collector within 6 m (ABL-005).

const SOUL_CAP = 32;                     // soul orbs in the world at once (the oldest is recycled)
const SOUL_PICKUP = 1;                   // metres: a soul this close is collected
const SOUL_LIFT = 1;                     // souls float at chest height
const TAP_CODES = { F: 0, B: 1, L: 2, R: 3 };
const TAP_BITS = 2;
const TAP_MASK = 0xff;                   // the last four taps
const COMBO_TAPS = 4;
const METER_HUD = { kind: 'none', value: 0, ready: false, energy: 0, souls: 0 };

const Meters = {
  energy: new Float32Array(MAX_ACTORS).fill(CAT.meters.byId('energy').max),
  lastEnergySpend: new Float64Array(MAX_ACTORS).fill(-1e9),
  points: new Float32Array(MAX_ACTORS),            // the match meter value (0..row.max)
  rewardIndex: new Uint8Array(MAX_ACTORS),         // next streak / boost reward
  streakDiscount: new Float32Array(MAX_ACTORS),    // reward thresholds lowered by this (Hardline perk, S13 writes it)
  souls: new Uint16Array(MAX_ACTORS),
  lifeKills: new Uint16Array(MAX_ACTORS),
  taps: new Uint8Array(MAX_ACTORS), tapCount: new Uint8Array(MAX_ACTORS), lastTap: new Int8Array(MAX_ACTORS).fill(-1),
  soulAlive: new Uint8Array(SOUL_CAP), soulOwner: new Int8Array(SOUL_CAP), soulBorn: new Float64Array(SOUL_CAP),
  soulX: new Float32Array(SOUL_CAP), soulY: new Float32Array(SOUL_CAP), soulZ: new Float32Array(SOUL_CAP),

  row() { return CAT.meters.byId(currentRules().meter) || CAT.meters[0]; },
  kind() { return this.row().id; },
  max() { return this.row().max; },
  // ultimate and adrenaline points pay for the ultimate slot; streak and boost load rewards instead.
  paysUltimate() { const kind = this.kind(); return kind === 'ultimate' || kind === 'adrenaline'; },
  ultimateCost(row) { const meter = this.row(); return Math.min(row.ultCost || meter.cost, meter.max); },
  fraction(id) { const max = this.max(); return max > 0 ? clamp(this.points[id] / max, 0, 1) : 0; },

  // ---- Energy ----
  // Size, rate and delay: the health preset's suit energy (HPP08) when it has one, else the energy meter row (ABL-002).
  energyMax() { const suit = Damage.preset().energy; return suit ? suit.max : CAT.meters.byId('energy').max; },
  energyRegen(id) {
    const suit = Damage.preset().energy, row = CAT.meters.byId('energy');
    const rate = suit ? suit.rate : row.passive, delay = suit ? suit.delay : row.regenDelay;
    return Sim.time - this.lastEnergySpend[id] >= delay ? rate * Buffs.get(id, BUFF.ENERGY_REGEN) : 0;
  },
  energyFraction(id) { return this.energy[id] / this.energyMax(); },
  // Spends up to amount; returns false (and empties the bar) when there was not enough.
  spendEnergy(id, amount) {
    if (amount <= 0) return true;
    this.lastEnergySpend[id] = Sim.time;
    if (this.energy[id] + TICK_EPSILON < amount) { this.energy[id] = 0; return false; }
    this.energy[id] = Math.max(0, this.energy[id] - amount);
    return true;
  },
  addEnergy(id, amount) { this.energy[id] = Math.min(this.energyMax(), this.energy[id] + amount); },

  // ---- Match meter ----
  addPoints(id, amount) {
    if (id < 0 || amount <= 0 || !Actors.kind[id]) return;
    const row = this.row();
    if (row.max <= 0) return;
    this.points[id] = Math.min(row.max, this.points[id] + amount);
    if (row.rewards.length) this.checkRewards(id, row);
  },
  spendPoints(id, amount) { this.points[id] = Math.max(0, this.points[id] - amount); },
  addHealing(id, amount) { if (amount > 0) this.addPoints(id, amount * this.row().perDamage); },
  checkRewards(id, row) {
    while (this.rewardIndex[id] < row.rewards.length) {
      const reward = row.rewards[this.rewardIndex[id]];
      if (this.points[id] + this.streakDiscount[id] < reward.at) return;
      this.rewardIndex[id]++;
      Abilities.grantReward(id, reward.ability);
    }
    if (row.id === 'boost') { this.points[id] = 0; this.rewardIndex[id] = 0; }   // the boost meter starts over after its last reward
  },
  // Adrenaline: an empty ultimate slot holds the first combo so the ULTIMATE button works too.
  fillSlots(id) {
    const row = this.row();
    if (!row.combos.length || Abilities.row(id, SLOT.ULTIMATE)) return;
    Abilities.setSlot(id, SLOT.ULTIMATE, CAT.abilities.byId(row.combos[0].ability));
  },
  step(dt) {
    const row = this.row(), energyMax = this.energyMax();
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id]) continue;
      if (this.energy[id] < energyMax) this.addEnergy(id, this.energyRegen(id) * dt);
      if (row.passive > 0) this.addPoints(id, row.passive * dt);
      if (row.combos.length) this.readTaps(id, row);
    }
    this.stepSouls(dt);
  },

  // ---- Adrenaline combos: four direction taps (F B L R) with a full meter ----
  readTaps(id, row) {
    const tap = tapDirection(id);
    if (tap === this.lastTap[id]) return;
    this.lastTap[id] = tap;
    if (tap < 0) return;
    this.taps[id] = ((this.taps[id] << TAP_BITS) | tap) & TAP_MASK;
    this.tapCount[id] = Math.min(COMBO_TAPS, this.tapCount[id] + 1);
    if (this.tapCount[id] < COMBO_TAPS || this.points[id] < row.max) return;
    const combo = matchingCombo(row, this.taps[id]);
    if (!combo || !Abilities.forceCast(id, combo.ability)) return;
    this.points[id] = 0;
    this.tapCount[id] = 0;
  },

  // ---- Souls (A34): kills by an actor with Wrath drop a soul that homes to it ----
  dropSoul(owner, x, y, z) {
    let slot = 0;
    for (let s = 0; s < SOUL_CAP; s++) {
      if (!this.soulAlive[s]) { slot = s; break; }
      if (this.soulBorn[s] < this.soulBorn[slot]) slot = s;
    }
    this.soulAlive[slot] = 1; this.soulOwner[slot] = owner; this.soulBorn[slot] = Sim.time;
    this.soulX[slot] = x; this.soulY[slot] = y + SOUL_LIFT; this.soulZ[slot] = z;
  },
  stepSouls(dt) {
    for (let s = 0; s < SOUL_CAP; s++) if (this.soulAlive[s]) this.stepSoul(s, dt);
  },
  stepSoul(s, dt) {
    const owner = this.soulOwner[s];
    if (!Actors.alive[owner]) return;
    const dx = Actors.x[owner] - this.soulX[s], dy = Actors.y[owner] + SOUL_LIFT - this.soulY[s], dz = Actors.z[owner] - this.soulZ[s];
    const distance = Math.hypot(dx, dy, dz), homing = soulHomingRange(owner, CAT.abilities.byId('wrath').params.homing);
    if (distance <= SOUL_PICKUP) { this.soulAlive[s] = 0; this.souls[owner]++; return; }
    if (distance > homing) return;
    const step = Math.min(distance, SOUL_HOMING_SPEED * dt) / distance;
    this.soulX[s] += dx * step; this.soulY[s] += dy * step; this.soulZ[s] += dz * step;
  },
  clearSouls() { this.soulAlive.fill(0); },

  // ---- Events ----
  onKill(event) {
    const victim = event.victim, killer = event.killer, row = this.row();
    this.lifeKills[victim] = 0;
    if (row.resetOnDeath) { this.points[victim] = 0; this.rewardIndex[victim] = 0; }
    if (killer < 0 || killer === victim || !Actors.isEnemy(killer, victim)) return;
    this.lifeKills[killer]++;
    this.addEnergy(killer, CAT.meters.byId('energy').perOrb);   // ABL-002 energy orb, collected by the killer
    this.addPoints(killer, row.perKill + (this.lifeKills[killer] % row.spreeKills === 0 ? row.perSpree : 0));
    if (Abilities.slotOf(killer, 'wrath') >= 0) this.dropSoul(killer, event.x, event.y, event.z);
  },
  onScore(event) {
    if (event.id < 0 || event.points <= 0) return;
    const row = this.row();
    this.addPoints(event.id, event.points * row.perScore + (event.reason === 'capture' ? row.perCapture : 0));
  },
  onDamage(event) {
    if (event.source < 0 || event.source === event.target || !Actors.isEnemy(event.source, event.target)) return;
    this.addPoints(event.source, event.amount * this.row().perDamage);
  },
  // A new actor: everything. A spawn: a full energy bar and no half-typed combo; the match meter (points, reward
  // progress) and the souls stay across lives (streak meters restart through resetOnDeath on the kill).
  resetActor(id) {
    this.resetLife(id);
    this.points[id] = 0; this.rewardIndex[id] = 0; this.souls[id] = 0; this.lifeKills[id] = 0; this.streakDiscount[id] = 0;
  },
  resetLife(id) {
    this.energy[id] = this.energyMax(); this.lastEnergySpend[id] = -1e9;
    this.taps[id] = 0; this.tapCount[id] = 0; this.lastTap[id] = -1;
  },
  // Fills out { kind, value 0..1, ready, energy 0..1, souls } for the HUD (the energy bar shows whenever a slot uses it).
  hudState(id, out) {
    const target = out || METER_HUD;
    target.kind = this.kind(); target.value = id >= 0 ? this.fraction(id) : 0;
    target.ready = id >= 0 && Abilities.ready(id, SLOT.ULTIMATE);
    target.energy = id >= 0 ? this.energyFraction(id) : 0;
    target.souls = id >= 0 ? this.souls[id] : 0;
    return target;
  },
};

// Direction tap from the movement input: F B L R code, or -1 while centred.
function tapDirection(id) {
  const forward = Actors.moveZ[id], strafe = Actors.moveX[id];
  if (Math.abs(forward) < TAP_THRESHOLD && Math.abs(strafe) < TAP_THRESHOLD) return -1;
  if (Math.abs(forward) >= Math.abs(strafe)) return forward > 0 ? TAP_CODES.F : TAP_CODES.B;
  return strafe > 0 ? TAP_CODES.R : TAP_CODES.L;
}
function matchingCombo(row, taps) {
  for (let i = 0; i < row.combos.length; i++) if (row.combos[i].code === taps) return row.combos[i];
  return null;
}
function tapCode(taps) {
  let code = 0;
  for (let i = 0; i < taps.length; i++) code = ((code << TAP_BITS) | TAP_CODES[taps[i]]) & TAP_MASK;
  return code;
}

CAT.meters.forEach((row) => row.combos.forEach((combo) => { combo.code = tapCode(combo.taps); }));
Render.addSource('souls', (batch) => {
  for (let s = 0; s < SOUL_CAP; s++) if (Meters.soulAlive[s]) batch.mesh('sphere', Meters.soulX[s], Meters.soulY[s], Meters.soulZ[s], 0, 0, 0.25, 0.25, 0.25, 0.9, 0.95, 1, 1);
});
Sim.addSystem('meters', 22, (dt) => Meters.step(dt));
Bus.on('actor.create', (id) => Meters.resetActor(id));
Bus.on('actor.spawn', (event) => Meters.resetLife(event.id));
Bus.on('kill', (event) => Meters.onKill(event));
Bus.on('score', (event) => Meters.onScore(event));
Bus.on('damage', (event) => Meters.onDamage(event));
Bus.on('match.start', () => Meters.clearSouls());
Bus.on('match.stop', () => Meters.clearSouls());
