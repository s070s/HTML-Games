// S12 powerups (step 10.2, PU01..PU20, PWR-002, PWR-003): timed, persistent and pool powerups as modifier sets on the actor.
// Each pickup or expiry rebuilds the actor's aggregate modifiers (damage, taken, speed, fire rate, flags) once; the hooks read
// those typed arrays. Exact expiry on Sim ticks; everything is cleared on death, spawn, match end and match stop (no leaks).

const POWERUP_COUNT = CAT.powerups.length;
const POWERUP_FOREVER = 0x7fffffff;           // endTick of persistent and pool powerups
const FODDER_MELEE_SCALE = 1000;              // PU09: a melee hit on fodder always kills
const GHOST_SHIMMER_PERIOD = 1.2;             // PU04: a cloaked actor flickers into view this often...
const GHOST_SHIMMER_SECONDS = 0.1;            // ...for this long
const POWERUP_TINT = 0.45;                    // share of the powerup colour in a holder's look
const POWERUP_GLOW = 0.5;
const SEER_REVEAL_SECONDS = 1.5;              // PU13 refreshes 'reveal' on enemies every second for this long
const SEER_INTERVAL = 1;
const FLIGHT_VERTICAL = 1;                    // PU06: JUMP climbs, CROUCH sinks at the flight speed
const POWERUP_FLAG = { INVULNERABLE: 1, FREE_AMMO: 2, INVISIBLE: 4, FODDER_MELEE: 8, REVEAL: 16 };
const DAMAGE_KIND_BIT = {};
CAT.damageKinds.forEach((row, index) => { DAMAGE_KIND_BIT[row.id] = 1 << index; });
const FREEZE_INDEX = CAT.statusEffects.byId('freeze').index;   // G08: frozen actors cannot stay cloaked

const POWERUP_EVENT = { id: 0, powerup: '' };
const SOULS_EVENT = { id: 0, count: 0 };
const powerupViews = makePool(POWERUP_COUNT, () => ({ id: '', name: '', remaining: 0, duration: 0, color: 0, persistent: false }));
const POWERUP_RGB = pickupRgbTable(CAT.powerups, (row) => row.color);
const flightScratch = Vec.make();

const Powerups = {
  active: new Uint8Array(MAX_ACTORS * POWERUP_COUNT),
  endTick: new Int32Array(MAX_ACTORS * POWERUP_COUNT),
  charges: new Float32Array(MAX_ACTORS * POWERUP_COUNT),     // pool powerups: boot jumps left
  activeCount: new Uint8Array(MAX_ACTORS),
  // Aggregates rebuilt by refresh(id) whenever the set changes.
  damageScale: new Float32Array(MAX_ACTORS).fill(1), meleeScale: new Float32Array(MAX_ACTORS).fill(1),
  takenScale: new Float32Array(MAX_ACTORS).fill(1), speedScale: new Float32Array(MAX_ACTORS).fill(1),
  rateScale: new Float32Array(MAX_ACTORS).fill(1), lifesteal: new Float32Array(MAX_ACTORS), flight: new Float32Array(MAX_ACTORS),
  perception: new Float32Array(MAX_ACTORS).fill(1),
  jumpScale: new Float32Array(MAX_ACTORS).fill(1), flags: new Uint32Array(MAX_ACTORS), immune: new Uint32Array(MAX_ACTORS),
  regenRow: new Int8Array(MAX_ACTORS).fill(-1), glowRow: new Int8Array(MAX_ACTORS).fill(-1),
  healthScale: new Float32Array(MAX_ACTORS).fill(1), armorScale: new Float32Array(MAX_ACTORS).fill(1),   // applied max HP / armor factors
  setInvisible: new Uint8Array(MAX_ACTORS),                  // INVISIBLE was set here (so only then is it cleared here)
  seerClock: new Float32Array(MAX_ACTORS),
  souls: new Uint16Array(MAX_ACTORS),

  has(id, key) { const row = CAT.powerups.byId(key); return !!row && this.active[id * POWERUP_COUNT + row.index] === 1; },
  isTimed(row) { return row.duration > 0; },
  lasts(row) { return row.duration > 0 || row.persistent || row.pool !== ''; },
  // Ticks left (POWERUP_FOREVER for persistent and pool powerups), 0 when inactive.
  ticksLeft(id, row) {
    const slot = id * POWERUP_COUNT + row.index;
    if (!this.active[slot]) return 0;
    return this.endTick[slot] === POWERUP_FOREVER ? POWERUP_FOREVER : Math.max(0, this.endTick[slot] - Sim.tick);
  },
  runeActive(id) {
    for (let powerup = 0; powerup < POWERUP_COUNT; powerup++) {
      if (this.active[id * POWERUP_COUNT + powerup] && CAT.powerups[powerup].stacking === 'rune') return true;
    }
    return false;
  },

  // ---- Pickup ----
  // Gives a powerup row; timeLeft = ticks left of a dropped one (0 = the full duration). Returns true when taken.
  give(id, row, timeLeft) {
    if (!Actors.alive[id]) return false;
    if (!this.lasts(row)) return this.applyInstant(id, row);
    const slot = id * POWERUP_COUNT + row.index;
    if ((row.stacking === 'rune' && this.runeActive(id)) || this.poolFull(id, row, slot)) return false;
    if (this.active[slot]) this.stack(id, row, slot);
    else this.start(id, row, slot, timeLeft);
    this.applyInstant(id, row);
    this.refresh(id);
    return true;
  },
  start(id, row, slot, timeLeft) {
    this.active[slot] = 1;
    this.activeCount[id]++;
    this.endTick[slot] = this.isTimed(row) ? Sim.tick + (timeLeft || itemTicks(row.duration)) : POWERUP_FOREVER;
    this.charges[slot] = row.charges;
    this.emit('powerup.start', id, row);
  },
  // A pool powerup that would add nothing stays on its spot (unused boots).
  poolFull(id, row, slot) {
    return row.pool === 'jumps' && this.active[slot] === 1 && this.charges[slot] >= row.charges;
  },
  stack(id, row, slot) {
    if (row.pool === 'jumps') this.charges[slot] = row.charges;
    if (!this.isTimed(row)) return;
    if (row.stacking === 'refresh') { this.endTick[slot] = Sim.tick + itemTicks(row.duration); return; }
    const limit = Sim.tick + itemTicks(row.maxDuration || row.duration);
    this.endTick[slot] = Math.min(limit, this.endTick[slot] + itemTicks(row.duration));
  },
  // One-off effects on pickup; returns true when one did something (instant-only rows are refused otherwise).
  applyInstant(id, row) {
    const instant = row.instant;
    let changed = false;
    if (instant.healTo && Actors.health[id] < instant.healTo) { Actors.health[id] = instant.healTo; changed = true; }
    if (instant.heal) changed = Damage.regenerate(id, instant.heal * this.healScale(id, instant), Damage.overhealCap(id)) || changed;
    if (instant.soul) { this.addSoul(id, instant.soul); changed = true; }
    if (instant.vital) changed = this.addVital(id, instant) || changed;
    return changed;
  },
  // C20 Soul Feast multiplies the heal of a soul (rows with instant.soul) for its holder.
  healScale(id, instant) { return instant.soul ? soulCardFx(id, 'soulHeal', 1) : 1; },
  addSoul(id, count) {
    this.souls[id] += count;
    SOULS_EVENT.id = id; SOULS_EVENT.count = this.souls[id];
    Bus.emit('souls', SOULS_EVENT);
  },
  // PU20: +25 max HP up to its cap, then +25 max armor up to its cap.
  addVital(id, instant) {
    if (Actors.maxHealth[id] < instant.vitalHealthCap) {
      Actors.maxHealth[id] = Math.min(instant.vitalHealthCap, Actors.maxHealth[id] + instant.vital);
      Actors.health[id] = Math.min(Actors.maxHealth[id], Actors.health[id] + instant.vital);
      return true;
    }
    if (Actors.maxArmor[id] >= instant.vitalArmorCap) return false;
    Actors.maxArmor[id] = Math.min(instant.vitalArmorCap, Actors.maxArmor[id] + instant.vital);
    return true;
  },

  // ---- Aggregates ----
  resetAggregates(id) {
    this.damageScale[id] = this.meleeScale[id] = this.takenScale[id] = this.speedScale[id] = this.rateScale[id] = 1;
    this.lifesteal[id] = this.flight[id] = 0;
    this.perception[id] = this.jumpScale[id] = 1;
    this.flags[id] = this.immune[id] = 0;
    this.regenRow[id] = this.glowRow[id] = -1;
  },
  refresh(id) {
    this.resetAggregates(id);
    let healthScale = 1, armorScale = 1;
    for (let powerup = 0; powerup < POWERUP_COUNT; powerup++) {
      if (!this.active[id * POWERUP_COUNT + powerup]) continue;
      const mods = CAT.powerups[powerup].mods;
      this.addMods(id, powerup, mods);
      healthScale *= mods.maxHealthScale || 1;
      armorScale *= mods.maxArmorScale || 1;
    }
    this.applyMaxScales(id, healthScale, armorScale);
    this.writeHooks(id);
  },
  addMods(id, powerup, mods) {
    this.damageScale[id] *= mods.damage || 1; this.meleeScale[id] *= mods.melee || 1; this.takenScale[id] *= mods.taken || 1;
    this.speedScale[id] *= mods.speed || 1; this.rateScale[id] *= mods.rate || 1;
    this.lifesteal[id] += mods.lifesteal || 0;
    this.flight[id] = Math.max(this.flight[id], mods.flight || 0);
    this.jumpScale[id] = Math.max(this.jumpScale[id], mods.jumpScale || 1);
    if (mods.invisible) this.perception[id] = Math.min(this.perception[id], mods.perception);
    if (mods.regen) this.regenRow[id] = powerup;
    if (this.glowRow[id] < 0) this.glowRow[id] = powerup;
    this.flags[id] |= (mods.invulnerable ? POWERUP_FLAG.INVULNERABLE : 0) | (mods.freeAmmo ? POWERUP_FLAG.FREE_AMMO : 0)
      | (mods.invisible ? POWERUP_FLAG.INVISIBLE : 0) | (mods.fodderMelee ? POWERUP_FLAG.FODDER_MELEE : 0)
      | (mods.reveal ? POWERUP_FLAG.REVEAL : 0);
    if (mods.noFall) this.immune[id] |= DAMAGE_KIND_BIT.fall;
    if (mods.immune) for (let k = 0; k < mods.immune.length; k++) this.immune[id] |= DAMAGE_KIND_BIT[mods.immune[k]] || 0;
  },
  // PU15: max HP / armor x2 while held; the old maximum comes back when it ends.
  applyMaxScales(id, healthScale, armorScale) {
    if (healthScale !== this.healthScale[id]) {
      Actors.maxHealth[id] = Actors.maxHealth[id] / this.healthScale[id] * healthScale;
      Actors.health[id] = Math.min(Actors.health[id], Damage.overhealCap(id));
      this.healthScale[id] = healthScale;
    }
    if (armorScale === this.armorScale[id]) return;
    Actors.maxArmor[id] = Actors.maxArmor[id] / this.armorScale[id] * armorScale;
    Actors.armor[id] = Math.min(Actors.armor[id], Actors.maxArmor[id]);
    this.armorScale[id] = armorScale;
  },
  // The shared per-actor hooks of S10/S11/S12 that powerups drive.
  writeHooks(id) {
    Buffs.applyScales(id);   // Buffs (12f) is the single writer of the speed and fire rate hooks; it multiplies these factors in
    Weapons.freeAmmo[id] = this.flags[id] & POWERUP_FLAG.FREE_AMMO ? 1 : 0;
    this.setCloak(id, this.cloaked(id));
  },
  // PU04 hides its holder unless a Rime Bomb freeze holds them (G08 stops cloak; it comes back when the freeze ends).
  cloaked(id) {
    if (!(this.flags[id] & POWERUP_FLAG.INVISIBLE)) return false;
    return Damage.statusTime[id * STATUS_COUNT + FREEZE_INDEX] <= 0;
  },
  setCloak(id, on) {
    if (on) { this.raiseCloak(id); return; }
    if (!this.setInvisible[id]) return;
    Actors.flags[id] &= ~ACTOR_FLAG.INVISIBLE;
    this.setInvisible[id] = 0;
  },
  // Sets the flag only when nobody else did (an ability's cloak is left alone when this one ends).
  raiseCloak(id) {
    if (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) return;
    Actors.flags[id] |= ACTOR_FLAG.INVISIBLE;
    this.setInvisible[id] = 1;
  },

  // ---- Expiry and cleanup ----
  end(id, row, announce) {
    const slot = id * POWERUP_COUNT + row.index;
    if (!this.active[slot]) return;
    this.active[slot] = 0; this.charges[slot] = 0;
    this.activeCount[id]--;
    this.refresh(id);
    this.emit('powerup.end', id, row);
    if (announce && id === Game.playerId) Items.announce(row.name + ' wore off');
  },
  // Removes every powerup of an actor; dying drops the droppable ones first (PWR-003: time left, at least 5 s).
  clearActor(id, dropThem) {
    if (dropThem) this.dropAll(id);
    for (let powerup = 0; powerup < POWERUP_COUNT; powerup++) if (this.active[id * POWERUP_COUNT + powerup]) this.end(id, CAT.powerups[powerup], false);
    this.seerClock[id] = 0;
  },
  dropAll(id) {
    let count = 0, k = 0;
    for (let powerup = 0; powerup < POWERUP_COUNT; powerup++) if (this.active[id * POWERUP_COUNT + powerup] && CAT.powerups[powerup].drops) count++;
    for (let powerup = 0; powerup < POWERUP_COUNT; powerup++) {
      const row = CAT.powerups[powerup];
      if (!this.active[id * POWERUP_COUNT + powerup] || !row.drops) continue;
      const left = this.isTimed(row) ? Math.max(itemTicks(ITEM_TIMING.droppedPowerupMinimum), this.ticksLeft(id, row)) : 0;
      Items.dropAround(row.id, id, k++, count, left);
    }
  },
  // A new life starts clean: the spawn listener of S11 has already reset the pools, so the old factors are just forgotten.
  resetActor(id) {
    this.healthScale[id] = this.armorScale[id] = 1;
    this.clearActor(id, false);
    this.writeHooks(id);
  },
  clearAll() { for (let id = 0; id < MAX_ACTORS; id++) if (this.activeCount[id]) this.clearActor(id, false); },
  emit(type, id, row) {
    POWERUP_EVENT.id = id; POWERUP_EVENT.powerup = row.id;
    Bus.emit(type, POWERUP_EVENT);
  },

  // ---- Per-step effects (Sim order 25: after statuses, before movement) ----
  step(dt) {
    for (let id = 0; id < Actors.count; id++) {
      if (!this.activeCount[id] || !Actors.alive[id]) continue;
      this.expire(id);
      if (!this.activeCount[id]) continue;
      this.stepEffects(id, dt);
    }
  },
  expire(id) {
    for (let powerup = 0; powerup < POWERUP_COUNT; powerup++) {
      const slot = id * POWERUP_COUNT + powerup;
      if (this.active[slot] && this.spent(id, CAT.powerups[powerup], slot)) this.end(id, CAT.powerups[powerup], true);
    }
  },
  spent(id, row, slot) {
    if (this.endTick[slot] !== POWERUP_FOREVER) return Sim.tick >= this.endTick[slot];
    return row.pool === 'jumps' && this.charges[slot] <= 0;
  },
  stepEffects(id, dt) {
    if (this.regenRow[id] >= 0) this.regenerate(id, CAT.powerups[this.regenRow[id]].mods.regen, dt);
    if (this.flight[id] > 0) this.fly(id, dt);
    if (this.flags[id] & POWERUP_FLAG.REVEAL) this.reveal(id, dt);
    if (this.flags[id] & POWERUP_FLAG.INVISIBLE) this.setCloak(id, this.cloaked(id));
  },
  // PU05: [rate, upTo, rate, upTo, ...]: the first band below its limit heals.
  regenerate(id, bands, dt) {
    for (let b = 0; b < bands.length; b += 2) {
      if (Actors.health[id] >= bands[b + 1]) continue;
      Actors.health[id] = Math.min(bands[b + 1], Actors.health[id] + bands[b] * dt);
      return;
    }
  },
  // PU06: velocity follows the view and the move keys; gravity of the coming movement step is paid in advance.
  fly(id, dt) {
    if (Actors.flags[id] & ACTOR_FLAG.FROZEN) return;
    Vec.fromAngles(flightScratch, Actors.aimYaw[id], Actors.aimPitch[id]);
    const forward = Actors.moveZ[id], strafe = Actors.moveX[id], buttons = Actors.buttons[id];
    const lift = (buttons & BTN.JUMP ? FLIGHT_VERTICAL : 0) - (buttons & BTN.CROUCH ? FLIGHT_VERTICAL : 0);
    const rightX = -Math.cos(Actors.aimYaw[id]), rightZ = Math.sin(Actors.aimYaw[id]);
    let x = flightScratch.x * forward + rightX * strafe, y = flightScratch.y * forward + lift, z = flightScratch.z * forward + rightZ * strafe;
    const length = length3(x, y, z), speed = this.flight[id];
    if (length > 1) { x /= length; y /= length; z /= length; }
    Actors.vx[id] = x * speed; Actors.vz[id] = z * speed;
    Actors.vy[id] = y * speed + Move.gravity(id) * dt;
  },
  // PU13: the holder's enemies stay revealed (minimap, bots) while it lasts; the Ghost perk (Abilities.hiddenFromPulse) hides.
  reveal(id, dt) {
    this.seerClock[id] -= dt;
    if (this.seerClock[id] > 0) return;
    this.seerClock[id] += SEER_INTERVAL;
    for (let other = 0; other < Actors.count; other++) {
      if (Abilities.hiddenFromPulse && Abilities.hiddenFromPulse(other)) continue;
      if (Actors.alive[other] && Actors.isEnemy(id, other)) Damage.addStatus(other, 'reveal', id, SEER_REVEAL_SECONDS, 1);
    }
  },

  // ---- Damage hooks (HP-001: attacker multipliers, victim reductions) ----
  attackScale(source, target, info) {
    if (source < 0 || !this.activeCount[source]) return 1;
    if (info.kind !== 'melee') return this.damageScale[source];
    const fodder = (this.flags[source] & POWERUP_FLAG.FODDER_MELEE) && isFodder(target);
    return this.damageScale[source] * this.meleeScale[source] * (fodder ? FODDER_MELEE_SCALE : 1);
  },
  reduce(target, amount, info) {
    if (!this.activeCount[target]) return amount;
    if (this.flags[target] & POWERUP_FLAG.INVULNERABLE) return 0;
    if (this.immune[target] & (DAMAGE_KIND_BIT[info.kind] || 0)) return 0;
    return amount * this.takenScale[target];
  },
  // PU12: a share of damage dealt to others heals the dealer (up to the normal maximum).
  onDamage(event) { if (event.source >= 0) Damage.lifesteal(event, this.lifesteal[event.source]); },
  // PU14: boosted jumps (height x jumpScale = speed x its square root), one charge each; no fall damage while worn.
  onJump(event) {
    const id = event.id;
    if (this.jumpScale[id] <= 1) return;
    Actors.vy[id] *= Math.sqrt(this.jumpScale[id]);
    for (let powerup = 0; powerup < POWERUP_COUNT; powerup++) {
      const slot = id * POWERUP_COUNT + powerup;
      if (this.active[slot] && CAT.powerups[powerup].pool === 'jumps') this.charges[slot]--;
    }
  },

  // ---- HUD and render hooks ----
  fillViews(id, out) {
    out.length = 0;
    if (id < 0 || !this.activeCount[id]) return 0;
    for (let powerup = 0; powerup < POWERUP_COUNT; powerup++) {
      if (!this.active[id * POWERUP_COUNT + powerup]) continue;
      const row = CAT.powerups[powerup], view = powerupViews.items[out.length], left = this.ticksLeft(id, row);
      view.id = row.id; view.name = row.name; view.color = row.color; view.persistent = left === POWERUP_FOREVER;
      view.remaining = left === POWERUP_FOREVER ? this.poolLeft(id, row) : left / TICK_RATE;
      view.duration = row.duration || row.charges || 0;
      out.push(view);
    }
    return out.length;
  },
  poolLeft(id, row) {
    return row.pool ? this.charges[id * POWERUP_COUNT + row.index] : 0;
  },
  // Render.actorStyle: holders glow in their powerup colour; Ghostveil hides the body except for a short shimmer.
  style(id, out) {
    if (!this.activeCount[id] || this.glowRow[id] < 0) return;
    const offset = this.glowRow[id] * 3;
    out.r = lerp(out.r, POWERUP_RGB[offset], POWERUP_TINT);
    out.g = lerp(out.g, POWERUP_RGB[offset + 1], POWERUP_TINT);
    out.b = lerp(out.b, POWERUP_RGB[offset + 2], POWERUP_TINT);
    out.emissive = Math.max(out.emissive, POWERUP_GLOW);
    if (this.setInvisible[id] && Render.replayPose === null) out.visible = ghostShimmerVisible(Sim.time, id);   // a replay shimmers by its own clock (S17)
  },
};
// Ghostveil shows a short shimmer of the body; each carrier is offset in time.
function ghostShimmerVisible(time, id) { return (time + id * 0.37) % GHOST_SHIMMER_PERIOD < GHOST_SHIMMER_SECONDS; }

Items.takers[PICKUP_KIND.POWERUP] = (id, slot) => Powerups.give(id, CAT.powerups[Items.row[slot]], Items.timeLeft[slot]);
Items.givers[PICKUP_KIND.POWERUP] = (id, key) => Powerups.give(id, CAT.powerups.byId(key), 0);
Items.activePowerups = (id, out) => Powerups.fillViews(id, out);
Items.uniqueOut = (rowIndex) => {
  for (let id = 0; id < Actors.count; id++) if (Powerups.active[id * POWERUP_COUNT + rowIndex]) return true;
  return false;
};
Items.soulCount = (id) => Powerups.souls[id];
// Bots perceive a cloaked actor at this share of their normal range (PU04); 1 = fully visible.
Items.perceptionScale = (id) => Powerups.cloaked(id) ? Powerups.perception[id] : 1;

Render.addActorStyle((id, out) => Powerups.style(id, out));
Damage.addAttackerScale((source, target, info) => Powerups.attackScale(source, target, info));
Damage.addReducer((source, target, amount, info) => Powerups.reduce(target, amount, info));
Sim.addSystem('powerups', 25, (dt) => Powerups.step(dt));
Bus.on('damage', (event) => Powerups.onDamage(event));
Bus.on('move.jump', (event) => Powerups.onJump(event));
Bus.on('kill', (event) => Powerups.clearActor(event.victim, true));
Bus.on('actor.spawn', (event) => Powerups.resetActor(event.id));
Bus.on('actor.create', (id) => { Powerups.resetActor(id); Powerups.souls[id] = 0; });
Bus.on('match.end', () => Powerups.clearAll());
Bus.on('match.stop', () => Powerups.clearAll());
