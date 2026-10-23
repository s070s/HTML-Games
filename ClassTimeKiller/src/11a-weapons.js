// ==== S11 WEAPONS / PROJECTILES / DAMAGE ====
// 11a: hit volumes (DATA-003), per-actor weapon state machine and inventory, hitscan, spread and recoil (WPN-001..WPN-010).
// 11b projectiles, 11c the single damage path Damage.apply, 11d tools and exotic behaviours. API: docs/api/weapons-damage.md.

const WEAPON_COUNT = CAT.weapons.length;
const WEAPON_STATE = { IDLE: 0, SWAP: 1, RELOAD: 2 };
const MODE_PRIMARY = 0;
const MODE_ALT = 1;
const MODE_QUICK_MELEE = 2;             // weapon.fire mode index of the MELEE button bash
const FIRE_MODE_LABELS = MODE_NAMES.concat(['melee']);
const ADS_SECONDS = 0.2;                 // time to aim down sights fully
const KICK_SECONDS = 0.12;               // view model kick decay after a shot
const SCOPE_SWAY_DEG = 0.35;             // W24 scope sway (FireMode.breath): drift size in degrees at full scope
const SCOPE_SWAY_RATE = 1.6;             // radians per second of the sway figure eight
const SWAY_STEADY_SCALE = 0.1;           // a held breath shrinks the sway to this...
const SWAY_WINDED_SCALE = 2.5;           // ...until the breath runs out: then it grows to this
const SWAY_SETTLE_RATE = 6;              // the sway size eases toward its target at this rate per second
const BREATH_REFILL_RATE = 1;            // seconds of breath back per second of breathing normally
const STILL_SPEED = 0.2;                 // below this horizontal speed an actor counts as standing still
const MAX_SHOTS_PER_STEP = 4;
const MELEE_RADIUS = 0.25;               // melee traces are fat rays: hit volumes grow by this much
const MAX_LOCKS = 3;
const RELEASE_LATCH = 4;                 // latch bit: a release-trigger mode was held (bits 1 and 2 are the two modes)
const DETONATE_HOLD_SECONDS = 0.35;      // holding a detonate-on-release alt this long, then releasing, detonates
const THIN_COVER_METRES = 0.3;           // WPN-005: brushes this thin (smallest side) can be shot through
const THIN_MATERIALS = ['wood', 'metal', 'glass', 'sheet'];
const PENETRATION_FACTOR = { low: 0.5, med: 0.7, high: 0.85 };
const MUZZLE_FORWARD = 0.45;             // projectiles start this far in front of the eye
const AIM_ASSIST_CONE_DEG = 6;           // INP-008: Input applies its 3 deg slowdown cone inside this search cone
const AIM_ASSIST_RANGE = 60;
const IMPACT_SPARK_COLOR = 0xffe0a0;
const DUAL_FACTOR = 2;                   // W04 dual pistols: magazine and fire rate multiplier
const EQUIP_SCALE_FLOOR = 0.8;           // WPN-010: stacked equip modifiers never make a swap shorter than 0.8 x equipTime
const ATTACHMENT_SLOT_COUNT = ATTACHMENT_SLOTS.length;
const WEAPON_STAT_COUNT = WEAPON_STATS.length;
const STAT = { DAMAGE: 0, SPREAD: 1, RECOIL: 2, RELOAD: 3, MAG: 4, RESERVE: 5, EQUIP: 6, MOVE: 7 }; // indexes into WEAPON_STATS
CAT.attachments.forEach((row, index) => { row.index = index; });
const DEFAULT_RULES = Object.freeze({ health: 'stack', precision: 'standard', weaponSet: 'arenaSet', friendlyFire: 0, selfDamage: 0.5, knockback: 1 });

// The match ruleset, or the spec defaults when no match is running (tests, menus).
function currentRules() { return (Game.match && Game.match.rules) || DEFAULT_RULES; }
function currentWeaponSet() { return CAT.weaponSets.byId(currentRules().weaponSet) || CAT.weaponSets.byId('arenaSet'); }

// ---- Actor hit list along one ray (pierce): sorted nearest first, reused scratch arrays ----
const RayHits = {
  ids: new Int8Array(MAX_ACTORS), distances: new Float32Array(MAX_ACTORS), zones: new Uint8Array(MAX_ACTORS), stomach: new Uint8Array(MAX_ACTORS),
  count: 0,
  collect(shooter, ox, oy, oz, dx, dy, dz, maxDistance, limit, inflate, includeAllies) {
    this.count = 0;
    setHitRay(ox, oy, oz, dx, dy, dz, maxDistance, inflate);   // Hitbox.rayOf: no float arguments per actor (PERF-006)
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id] || id === shooter) continue;
      if (!includeAllies && !Actors.isEnemy(shooter, id)) continue;
      if (Hitbox.rayOf(id)) this.insert(id, Hitbox.distance, limit);
    }
    return this.count;
  },
  insert(id, distance, limit) {
    let slot = Math.min(this.count, limit - 1);
    if (this.count >= limit && distance >= this.distances[slot]) return;
    while (slot > 0 && this.distances[slot - 1] > distance) { this.copy(slot, slot - 1); slot--; }
    this.ids[slot] = id; this.distances[slot] = distance; this.zones[slot] = Hitbox.zone; this.stomach[slot] = Hitbox.stomach ? 1 : 0;
    if (this.count < limit) this.count++;
  },
  copy(to, from) {
    this.ids[to] = this.ids[from]; this.distances[to] = this.distances[from]; this.zones[to] = this.zones[from]; this.stomach[to] = this.stomach[from];
  },
};

// ---- Reused event payloads (ARC-015: listeners copy what they keep) ----
const FIRE_EVENT = { id: 0, weapon: '', weaponClass: '', mode: 'primary', x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
const SWITCH_EVENT = { id: 0, weapon: '' };
const RELOAD_EVENT = { id: 0, weapon: '' };
const EMPTY_EVENT = { id: 0, weapon: '', pool: 'mag' };   // pool: 'mag' or 'alt' (the separate alt rounds ran out)
const IMPACT_EVENT = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, material: '', weapon: '', owner: -1 };

function emitWeaponEvent(type, payload, id, weapon) {
  payload.id = id; payload.weapon = weapon.id;
  Bus.emit(type, payload);
}
function emitImpact(hit, weaponKey, owner) {
  IMPACT_EVENT.x = hit.x; IMPACT_EVENT.y = hit.y; IMPACT_EVENT.z = hit.z; IMPACT_EVENT.nx = hit.nx; IMPACT_EVENT.ny = hit.ny; IMPACT_EVENT.nz = hit.nz;
  IMPACT_EVENT.material = hit.brush ? hit.brush.material : ''; IMPACT_EVENT.weapon = weaponKey; IMPACT_EVENT.owner = owner;
  Bus.emit('impact', IMPACT_EVENT);
  if (Game.headless) return;
  Fx.burst('spark', hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 6, IMPACT_SPARK_COLOR);
  Fx.decal(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 'bullet');
}
// A shot or bolt that stopped at a destructible prop damages it (S08 Props; the breaker is reported on 'world.break').
function damagePropAt(hit, amount, owner) {
  if (hit.brush && hit.brush.prop >= 0) Props.damage(hit.brush.prop, amount, owner);
}
// A shot stopped by a Weapons.rayBlockers entry (device, dome): an impact facing the shooter, so the stop is visible.
const blockedHit = makeHit();
function emitBlockedImpact(x, y, z, dx, dy, dz, weaponKey, owner) {
  blockedHit.x = x; blockedHit.y = y; blockedHit.z = z; blockedHit.nx = -dx; blockedHit.ny = -dy; blockedHit.nz = -dz;
  emitImpact(blockedHit, weaponKey, owner);
}

const shotHit = makeHit();
const exitHit = makeHit();
const aimScratch = Vec.make();
const pointScratch = Vec.make();
const lockScratch = Vec.make();

const Weapons = {
  owned: new Uint8Array(MAX_ACTORS * WEAPON_COUNT),
  magazine: new Int16Array(MAX_ACTORS * WEAPON_COUNT),
  reserve: new Int16Array(MAX_ACTORS * WEAPON_COUNT),
  altAmmo: new Int16Array(MAX_ACTORS * WEAPON_COUNT),
  rarity: new Uint8Array(MAX_ACTORS * WEAPON_COUNT),
  dual: new Uint8Array(MAX_ACTORS * WEAPON_COUNT),  // W04: a second copy was picked up (two guns, doubled magazine and rate)
  current: new Int16Array(MAX_ACTORS).fill(-1),
  pending: new Int16Array(MAX_ACTORS).fill(-1),
  state: new Uint8Array(MAX_ACTORS),
  stateTime: new Float32Array(MAX_ACTORS),
  stateDuration: new Float32Array(MAX_ACTORS),
  nextShot: new Float32Array(MAX_ACTORS),
  nextAlt: new Float32Array(MAX_ACTORS),            // own cooldown of alt modes with `cooldown` (hook)
  burstLeft: new Uint8Array(MAX_ACTORS), burstTimer: new Float32Array(MAX_ACTORS), burstMode: new Uint8Array(MAX_ACTORS),
  charge: new Float32Array(MAX_ACTORS), chargeMode: new Int8Array(MAX_ACTORS).fill(-1),
  spin: new Float32Array(MAX_ACTORS),
  ads: new Float32Array(MAX_ACTORS),
  zoomed: new Uint8Array(MAX_ACTORS),               // 1 = the scope's second step (FireMode.zoomMax) is chosen
  breathUsed: new Float32Array(MAX_ACTORS),         // seconds of the held breath (FireMode.breath) spent; 0 = full lungs
  swayScale: new Float32Array(MAX_ACTORS).fill(1), swayPitch: new Float32Array(MAX_ACTORS), swayYaw: new Float32Array(MAX_ACTORS),   // scope sway in degrees
  toggled: new Uint8Array(MAX_ACTORS),
  heat: new Float32Array(MAX_ACTORS),
  latch: new Uint8Array(MAX_ACTORS),                // bit per mode: a semi/burst trigger already fired during this hold
  altHeld: new Float32Array(MAX_ACTORS),
  recoilShot: new Uint16Array(MAX_ACTORS), recoilPitch: new Float32Array(MAX_ACTORS), recoilYaw: new Float32Array(MAX_ACTORS),
  bloom: new Float32Array(MAX_ACTORS), lastShot: new Float32Array(MAX_ACTORS).fill(-1e9), kick: new Float32Array(MAX_ACTORS),
  lastSlot: new Int8Array(MAX_ACTORS), slotCursor: new Int16Array(MAX_ACTORS),
  lockIds: new Int8Array(MAX_ACTORS * MAX_LOCKS).fill(-1), lockTime: new Float32Array(MAX_ACTORS * MAX_LOCKS), lockCursor: new Uint8Array(MAX_ACTORS),
  fitted: new Int8Array(MAX_ACTORS * WEAPON_COUNT * ATTACHMENT_SLOT_COUNT).fill(-1), // attachment index per weapon slot (-1 none)
  statScale: new Float32Array(MAX_ACTORS * WEAPON_STAT_COUNT).fill(1),              // per-actor stat multipliers (perks write these)
  mutatorScale: new Float32Array(MAX_ACTORS * WEAPON_STAT_COUNT).fill(1),           // the same slots for match mutators (13h): never shared with perks
  speedScale: new Float32Array(MAX_ACTORS).fill(1), // movement multiplies its wish speed by this (moveMult, ADS, stance, status)
  rateScale: new Float32Array(MAX_ACTORS).fill(1),  // fire rate multiplier written by S12 (powerups); 1 = unchanged
  freeAmmo: new Uint8Array(MAX_ACTORS),             // 1 = shots spend no ammo (S12 powerups)
  paidShare: 1,                                     // share of its cost the shot being fired paid (below 1: a short last magazine)
  dropped: '',                                      // weapon key pushed out by the last give() at the carry limit ('' none)
  droppedRarity: 0,                                 // that weapon's rarity (WPN-008), so a pickup can drop it as it was
  deliveries: {},                                   // fire mode type -> fn(id, weapon, mode, modeIndex, fraction)
  tools: {},                                        // FireMode.tool key -> fn(id, weapon, mode)  (11d)
  specials: {},                                     // FireMode.special key -> fn(id, weapon, mode) -> true when it handled the press (11d)
  rayBlockers: [],                                  // fn(ox, oy, oz, dx, dy, dz, maxDistance) -> hit distance or -1: things that stop hitscan (S12 devices, domes)
  altClaim: null,                                   // fn(id) -> true while ALT belongs to something else (S12: the GAD-002 underhand throw)
  altClaimed: new Uint8Array(MAX_ACTORS),           // 1 = ALT was claimed during this hold: the weapon's alt waits for a release
  botTakes: (id, weapon) => true,                   // fn(id, weapon) -> true: a bot at the carry limit swaps this gun in (14e: only an upgrade)
  useClaimed: new Uint8Array(MAX_ACTORS),           // 1 = Use served another action during this hold (claimUse): no carry-limit swap until a release

  // Nearest distance at which a registered blocker stops a shot ray within maxDistance, or -1.
  blockDistance(ox, oy, oz, dx, dy, dz, maxDistance) {
    let best = -1;
    for (let i = 0; i < this.rayBlockers.length; i++) {
      const distance = this.rayBlockers[i](ox, oy, oz, dx, dy, dz, best >= 0 ? best : maxDistance);
      if (distance >= 0 && distance <= maxDistance && (best < 0 || distance < best)) best = distance;
    }
    return best;
  },
  // X41 Ballistics: the ruleset's { gravity, drag } while hitscan pellets fly as 11b bullets, else null.
  ballistics() {
    const fx = currentRules().fx;
    return (fx && fx.ballistics) || null;
  },
  // True when this firing mode's shots fly as X41 bullets instead of settling at once along a ray.
  fliesAsBullet(mode) { return mode.type === 'hitscan' && this.ballistics() !== null; },
  slotIndex(id, weaponIndex) { return id * WEAPON_COUNT + weaponIndex; },
  currentWeapon(id) { const index = this.current[id]; return index < 0 ? null : CAT.weapons[index]; },
  has(id, key) { const weapon = CAT.weapons.byId(key); return !!weapon && this.owned[this.slotIndex(id, weapon.index)] === 1; },
  magSize(id, weapon) {
    const extra = weapon.rarityScale ? WEAPON_RARITY_MAG[this.rarity[this.slotIndex(id, weapon.index)]] : 0;
    return Math.round(weapon.mag * (1 + extra) * this.modifier(id, weapon, STAT.MAG)) * this.dualFactor(id, weapon);
  },
  maxReserve(id, weapon) { return Math.round(weapon.maxAmmo * this.modifier(id, weapon, STAT.RESERVE)); },

  // ---- Attachments (step 5.4): stat = base x per-actor scale x every fitted attachment's multiplier ----
  modifier(id, weapon, stat) {
    const field = WEAPON_STATS[stat], first = this.slotIndex(id, weapon.index) * ATTACHMENT_SLOT_COUNT;
    let scale = this.statScale[id * WEAPON_STAT_COUNT + stat] * this.mutatorScale[id * WEAPON_STAT_COUNT + stat];
    for (let slot = 0; slot < ATTACHMENT_SLOT_COUNT; slot++) {
      const fitted = this.fitted[first + slot];
      if (fitted >= 0) scale *= CAT.attachments[fitted][field];
    }
    return scale;
  },
  acceptsAttachments(weapon) { return weapon.mag > 0 && this.countsTowardCarry(weapon); },
  // Fits an attachment to a weapon (replacing the one in the same slot); the magazine is trimmed to the new size.
  attach(id, weaponKey, attachmentKey) {
    const weapon = CAT.weapons.byId(weaponKey), attachment = CAT.attachments.byId(attachmentKey);
    if (!weapon || !attachment || !this.acceptsAttachments(weapon)) return false;
    const slot = this.slotIndex(id, weapon.index);
    this.fitted[slot * ATTACHMENT_SLOT_COUNT + ATTACHMENT_SLOTS.indexOf(attachment.slot)] = attachment.index;
    this.magazine[slot] = Math.min(this.magazine[slot], this.magSize(id, weapon));
    return true;
  },
  detachAll(id, weapon) {
    const first = this.slotIndex(id, weapon.index) * ATTACHMENT_SLOT_COUNT;
    this.fitted.fill(-1, first, first + ATTACHMENT_SLOT_COUNT);
  },
  // WPN-007: with ammo tiers on, primary-tier weapons never run out of reserve.
  infiniteReserve(weapon) {
    const set = currentWeaponSet(), rules = currentRules();
    if (rules.fx && rules.fx.infiniteAmmo) return true;   // mutators X08, X09, X15
    const tiers = rules.ammoTiers === undefined ? set.ammoTiers : rules.ammoTiers;
    return tiers && weapon.family.tier === 'primary';
  },
  carryLimit() {
    const rules = currentRules();
    return typeof rules.carry === 'number' ? rules.carry : currentWeaponSet().carry;
  },
  countsTowardCarry(weapon) { return weapon.class !== 'melee' && weapon.class !== 'tool'; },

  // ---- Inventory ----
  clear(id) {
    this.owned.fill(0, id * WEAPON_COUNT, (id + 1) * WEAPON_COUNT);
    this.dual.fill(0, id * WEAPON_COUNT, (id + 1) * WEAPON_COUNT);
    this.current[id] = this.pending[id] = -1;
    this.state[id] = WEAPON_STATE.IDLE;
    this.resetFiring(id);
    this.recoilPitch[id] = this.recoilYaw[id] = this.bloom[id] = this.heat[id] = 0;
    this.breathUsed[id] = this.swayPitch[id] = this.swayYaw[id] = 0; this.swayScale[id] = 1;
    this.lastShot[id] = -1e9;
    this.lastSlot[id] = 0; this.speedScale[id] = 1;
  },
  resetFiring(id) {
    this.nextShot[id] = this.nextAlt[id] = 0; this.burstLeft[id] = 0; this.charge[id] = 0; this.chargeMode[id] = -1; this.spin[id] = 0;
    this.ads[id] = 0; this.zoomed[id] = 0; this.toggled[id] = 0; this.latch[id] = 0; this.altHeld[id] = 0; this.altClaimed[id] = 0; this.recoilShot[id] = 0;
    this.swayPitch[id] = this.swayYaw[id] = 0;
    this.lockIds.fill(-1, id * MAX_LOCKS, (id + 1) * MAX_LOCKS);
    WeaponSpecialState.stopBlock(id);
  },
  // Gives a weapon (full magazine and starting reserve). Owned already: adds its pickup ammo instead (WPN-007),
  // and a dual-wield weapon (W04) picked up a second time becomes a pair. At the carry limit the held weapon is
  // replaced and its key (and rarity) left in Weapons.dropped (droppedRarity) for the items section; outsideCarry skips that
  // (the Last Stand pistol is lent on top of the carried weapons).
  give(id, key, rarity, outsideCarry) {
    const weapon = CAT.weapons.byId(key);
    this.dropped = '';
    this.droppedRarity = 0;
    if (!weapon) return false;
    const slot = this.slotIndex(id, weapon.index);
    if (this.owned[slot] && weapon.dualWield && !this.dual[slot]) return this.becomeDual(id, weapon);
    if (this.owned[slot]) return this.addWeaponAmmo(id, weapon, weapon.pickupAmmo) > 0;
    if (!outsideCarry && this.swapsOut(id, weapon)) this.dropForPickup(id);
    this.owned[slot] = 1;
    this.dual[slot] = 0;
    this.rarity[slot] = rarity || 0;
    this.detachAll(id, weapon);
    this.magazine[slot] = this.magSize(id, weapon);
    this.reserve[slot] = Math.round(weapon.reserve * this.modifier(id, weapon, STAT.RESERVE));
    this.altAmmo[slot] = weapon.altAmmo;
    if (this.current[id] < 0) this.current[id] = weapon.index;
    return true;
  },
  // W04 second pickup: two guns share one doubled magazine and fire at twice the rate; the new gun arrives loaded.
  becomeDual(id, weapon) {
    const slot = this.slotIndex(id, weapon.index), single = this.magSize(id, weapon);
    this.dual[slot] = 1;
    this.magazine[slot] = Math.min(this.magSize(id, weapon), this.magazine[slot] + single);
    this.addWeaponAmmo(id, weapon, weapon.pickupAmmo);
    return true;
  },
  dualFactor(id, weapon) { return this.dual[this.slotIndex(id, weapon.index)] ? DUAL_FACTOR : 1; },
  // Giving this weapon would replace a carried one (not owned yet, counts toward the carry limit, limit reached).
  swapsOut(id, weapon) {
    return !this.owned[this.slotIndex(id, weapon.index)] && this.countsTowardCarry(weapon) && this.atCarryLimit(id);
  },
  atCarryLimit(id) {
    const limit = this.carryLimit();
    if (limit <= 0) return false;
    let carried = 0;
    for (let w = 0; w < WEAPON_COUNT; w++) if (this.owned[this.slotIndex(id, w)] && this.countsTowardCarry(CAT.weapons[w])) carried++;
    return carried >= limit;
  },
  // The one carry-limit rule for every weapon pickup (S12 pads and drops, S13 royale loot): a gun that would push a
  // carried one out is taken only by choice, so walking over a gun never costs the one in hand: a person holds Use, a
  // bot takes only a gun it values more than its best (botTakes, 14e), so crossing a worse pad never downgrades it.
  // A Use hold that served another action never swaps (swap-02), nor does the step Use goes down: the plant, defuse
  // or beacon answering that press runs later in the step (S13) and claims it first.
  mayTake(id, weapon) {
    if (!this.swapsOut(id, weapon)) return true;
    if (this.useClaimed[id] || (Actors.pressed[id] & BTN.USE) !== 0) return false;
    if (Actors.kind[id] === ACTOR_KIND.BOT) return this.botTakes(id, weapon);
    return (Actors.buttons[id] & BTN.USE) !== 0;
  },
  // Every hold-Use action marks the hold it serves (11c revive, 13b plant, defuse and arm, 13g squad beacon).
  claimUse(id) { this.useClaimed[id] = 1; },
  // The claim lasts until Use is let go; riding the skimmer claims it too (Use there steps off, 10b).
  updateUseClaim(id) {
    if (!(Actors.buttons[id] & BTN.USE)) this.useClaimed[id] = 0;
    else if (Move.onBoard(id)) this.useClaimed[id] = 1;
  },
  // The weapon a carry-limit pickup pushes out: the held one, else the first carried (-1 = none).
  swapVictim(id) {
    const held = this.current[id];
    return held >= 0 && this.countsTowardCarry(CAT.weapons[held]) ? held : this.firstCarried(id);
  },
  dropForPickup(id) {
    const victim = this.swapVictim(id);
    if (victim < 0) return;
    const slot = this.slotIndex(id, victim);
    this.owned[slot] = 0;
    this.dropped = CAT.weapons[victim].id;
    this.droppedRarity = this.rarity[slot];
    if (this.current[id] === victim) { this.current[id] = -1; this.state[id] = WEAPON_STATE.IDLE; }
  },
  // Takes a weapon away without a drop (a lent weapon going back); the held one is put away.
  takeAway(id, weaponIndex) {
    this.owned[this.slotIndex(id, weaponIndex)] = 0;
    if (this.current[id] === weaponIndex) { this.current[id] = -1; this.state[id] = WEAPON_STATE.IDLE; }
  },
  firstCarried(id) {
    for (let w = 0; w < WEAPON_COUNT; w++) if (this.owned[this.slotIndex(id, w)] && this.countsTowardCarry(CAT.weapons[w])) return w;
    return -1;
  },
  // Replaces the whole inventory; the first key is drawn at once (spawn loadouts never wait for an equip).
  setLoadout(id, keys) {
    this.clear(id);
    for (let i = 0; i < keys.length; i++) this.give(id, keys[i], 0);
    const first = keys.length ? CAT.weapons.byId(keys[keys.length - 1]) : null;
    if (first && this.owned[this.slotIndex(id, first.index)]) this.current[id] = first.index;
  },
  giveStartLoadout(id) { this.setLoadout(id, currentWeaponSet().start); },
  // Ammo pickup for every owned weapon using that ammo type; returns rounds added.
  addAmmo(id, ammoType, amount) {
    let added = 0;
    for (let w = 0; w < WEAPON_COUNT; w++) {
      const weapon = CAT.weapons[w];
      if (weapon.ammoType === ammoType && this.owned[this.slotIndex(id, w)]) added += this.addWeaponAmmo(id, weapon, amount || weapon.pickupAmmo);
    }
    return added;
  },
  addWeaponAmmo(id, weapon, amount) {
    const slot = this.slotIndex(id, weapon.index), before = this.reserve[slot];
    this.reserve[slot] = Math.min(this.maxReserve(id, weapon), before + amount);
    if (weapon.altAmmo) this.altAmmo[slot] = weapon.altAmmo;
    return this.reserve[slot] - before;
  },
  ammo(id) {
    const index = this.current[id];
    if (index < 0) return null;
    const slot = this.slotIndex(id, index);
    AMMO_VIEW.magazine = this.magazine[slot]; AMMO_VIEW.reserve = this.reserve[slot]; AMMO_VIEW.alt = this.altAmmo[slot];
    AMMO_VIEW.infinite = CAT.weapons[index].mag === 0 || this.infiniteReserve(CAT.weapons[index]);
    return AMMO_VIEW;
  },

  // ---- Swap (WPN-010: switching is never faster than the new weapon's equipTime; equip attachments and perks may
  // shorten it down to EQUIP_SCALE_FLOOR x equipTime, never further) ----
  requestSwitch(id, index) {
    if (index < 0 || !this.owned[this.slotIndex(id, index)]) return false;
    const target = this.state[id] === WEAPON_STATE.SWAP ? this.pending[id] : this.current[id];
    if (index === target) return false;
    this.resetFiring(id);
    this.state[id] = WEAPON_STATE.SWAP;
    this.pending[id] = index;
    this.stateTime[id] = 0;
    this.stateDuration[id] = CAT.weapons[index].equipTime * Math.max(EQUIP_SCALE_FLOOR, this.modifier(id, CAT.weapons[index], STAT.EQUIP));
    emitWeaponEvent('weapon.switch', SWITCH_EVENT, id, CAT.weapons[index]);
    return true;
  },
  // Owned weapon after (direction +1) or before (-1) the given one in slot order.
  cycle(id, direction) {
    const from = this.state[id] === WEAPON_STATE.SWAP ? this.pending[id] : this.current[id];
    for (let step = 1; step <= WEAPON_COUNT; step++) {
      const index = ((from < 0 ? 0 : from) + direction * step + WEAPON_COUNT * 2) % WEAPON_COUNT;
      if (this.owned[this.slotIndex(id, index)]) return index;
    }
    return -1;
  },
  // Slot key 1-9: the owned weapon in that slot, cycling between several on repeated presses.
  inSlot(id, slot) {
    const from = this.state[id] === WEAPON_STATE.SWAP ? this.pending[id] : this.current[id];
    for (let step = 1; step <= WEAPON_COUNT; step++) {
      const index = ((from < 0 ? 0 : from) + step) % WEAPON_COUNT;
      if (this.owned[this.slotIndex(id, index)] && CAT.weapons[index].slot === slot) return index;
    }
    return -1;
  },
  handleSwitchInput(id) {
    const pressed = Actors.pressed[id], slot = Actors.slotRequest[id];
    if (slot && slot !== this.lastSlot[id]) this.requestSwitch(id, this.inSlot(id, slot));
    this.lastSlot[id] = slot;
    if (this.stepScopeZoom(id, pressed)) return;
    if (pressed & BTN.NEXT_WEAPON) this.requestSwitch(id, this.cycle(id, 1));
    if (pressed & BTN.PREV_WEAPON) this.requestSwitch(id, this.cycle(id, -1));
  },
  // A full scope with a second zoom step (W24 4x/8x, FireMode.zoomMax) takes next/previous weapon to flip between the steps.
  stepScopeZoom(id, pressed) {
    const weapon = this.currentWeapon(id);
    if (!weapon || this.ads[id] < 1 || !(weapon.alt.zoomMax > weapon.alt.zoom)) return false;
    if (pressed & (BTN.NEXT_WEAPON | BTN.PREV_WEAPON)) this.zoomed[id] ^= 1;
    return true;
  },
  stepSwap(id, dt) {
    this.stateTime[id] += dt;
    if (this.stateTime[id] < this.stateDuration[id]) return;
    this.current[id] = this.pending[id];
    this.state[id] = WEAPON_STATE.IDLE;
  },

  // ---- Reload: magazines refill at the end; shell-by-shell weapons load one round per `reload` and fire interrupts them ----
  canReload(id, weapon) {
    if (!weapon.mag || this.state[id] !== WEAPON_STATE.IDLE) return false;
    const slot = this.slotIndex(id, weapon.index);
    return this.magazine[slot] < this.magSize(id, weapon) && (this.reserve[slot] > 0 || this.infiniteReserve(weapon));
  },
  beginReload(id, weapon) {
    if (!this.canReload(id, weapon)) return false;
    this.state[id] = WEAPON_STATE.RELOAD;
    this.stateTime[id] = 0;
    this.stateDuration[id] = weapon.reload * this.modifier(id, weapon, STAT.RELOAD);
    this.charge[id] = 0; this.chargeMode[id] = -1; this.burstLeft[id] = 0;
    emitWeaponEvent('weapon.reload', RELOAD_EVENT, id, weapon);
    return true;
  },
  stepReload(id, weapon, dt) {
    const firePressed = (Actors.pressed[id] & BTN.FIRE) !== 0;
    if (weapon.reloadShell && firePressed && this.magazine[this.slotIndex(id, weapon.index)] > 0) { this.state[id] = WEAPON_STATE.IDLE; return; }
    this.stateTime[id] += dt;
    if (this.stateTime[id] < this.stateDuration[id]) return;
    this.loadRounds(id, weapon, weapon.reloadShell ? 1 : this.magSize(id, weapon));
    this.state[id] = WEAPON_STATE.IDLE;
    if (weapon.reloadShell) this.beginReload(id, weapon);
  },
  loadRounds(id, weapon, wanted) {
    const slot = this.slotIndex(id, weapon.index);
    const infinite = this.infiniteReserve(weapon);
    const space = this.magSize(id, weapon) - this.magazine[slot];
    const rounds = Math.min(wanted, space, infinite ? space : this.reserve[slot]);
    this.magazine[slot] += rounds;
    if (!infinite) this.reserve[slot] -= rounds;
  },

  // ---- Ammo per fire mode: 'mag' (shared magazine), 'alt' (the weapon's separate alt rounds), 'none' ----
  ammoCost(mode, fraction) {
    if (mode.charge && mode.charge.ammo) return mode.charge.ammo[chargeLevelIndex(mode.charge, fraction)];
    if (mode.charge && mode.charge.target === 'pellets') return mode.ammoPerShot * chargeLevelValue(mode.charge, fraction);
    return mode.ammoPerShot;
  },
  hasAmmo(id, weapon, mode, fraction) {
    if (mode.ammo === 'none' || !weapon.mag) return true;
    const slot = this.slotIndex(id, weapon.index), pool = mode.ammo === 'alt' ? this.altAmmo[slot] : this.magazine[slot];
    const cost = this.ammoCost(mode, fraction);
    return cost <= 0 || (pool > 0 && pool >= Math.min(cost, this.poolLimit(id, weapon, mode, pool)));
  },
  // The most one shot may ask of its pool: the pool's size, or (R-184) just what is left when nothing can refill the
  // magazine, so the W20's last shell still fires one barrel (paidShare). Charge levels never get cheaper this way.
  poolLimit(id, weapon, mode, pool) {
    if (mode.ammo === 'alt') return weapon.altAmmo;
    const refill = mode.charge || this.reserve[this.slotIndex(id, weapon.index)] > 0 || this.infiniteReserve(weapon);
    return refill ? this.magSize(id, weapon) : pool;
  },
  spendAmmo(id, weapon, mode, fraction) {
    this.paidShare = 1;
    if (mode.ammo === 'none' || !weapon.mag || this.freeAmmo[id]) return;
    const slot = this.slotIndex(id, weapon.index), cost = this.ammoCost(mode, fraction);
    const pool = mode.ammo === 'alt' ? this.altAmmo[slot] : this.magazine[slot];
    if (cost > pool) this.paidShare = pool / cost;
    if (mode.ammo === 'alt') this.altAmmo[slot] = Math.max(0, pool - cost);
    else this.magazine[slot] = Math.max(0, pool - cost);
  },
  // Pellets of a shot that was only partly paid for (paidShare), at least one.
  paidPellets(pellets) { return Math.max(1, Math.round(pellets * this.paidShare)); },
  // Fire on empty: one 'weapon.empty' (with the pool that ran out); an empty magazine also reloads when there is reserve.
  // An empty alt pool only clicks (R-081): a magazine reload would not refill it.
  reportEmpty(id, weapon, mode) {
    EMPTY_EVENT.pool = mode.ammo === 'alt' ? 'alt' : 'mag';
    emitWeaponEvent('weapon.empty', EMPTY_EVENT, id, weapon);
    if (mode.ammo !== 'alt') this.beginReload(id, weapon);
  },
  // R-084: the shot that empties the magazine starts the reload, so a held trigger (touch fire) never sits on empty.
  reloadIfEmpty(id, weapon, mode) {
    if (mode.ammo === 'mag' && this.magazine[this.slotIndex(id, weapon.index)] === 0) this.beginReload(id, weapon);
  },

  // Stunned, or downed without the Last Stand pistol (Damage.lastStand): no firing, reloading or switching.
  lowered(id) {
    const flags = Actors.flags[id];
    return (flags & ACTOR_FLAG.FROZEN) !== 0 || ((flags & ACTOR_FLAG.DOWNED) !== 0 && !Damage.lastStand[id]);
  },
  // ---- The per-step state machine ----
  step(dt) {
    for (let id = 0; id < Actors.count; id++) {
      if (Actors.kind[id] === ACTOR_KIND.NONE || !Actors.alive[id]) continue;
      this.updateUseClaim(id);
      this.stepActor(id, dt);
    }
    this.syncBreathButton();
  },
  stepActor(id, dt) {
    this.coolDown(id, dt);
    this.recoverRecoil(id, dt);
    this.updateSpeed(id);
    if (this.lowered(id)) { this.charge[id] = 0; this.burstLeft[id] = 0; return; }
    if (!(Actors.flags[id] & ACTOR_FLAG.DOWNED)) this.handleSwitchInput(id);
    if (this.state[id] === WEAPON_STATE.SWAP) { this.stepSwap(id, dt); return; }
    const weapon = this.currentWeapon(id);
    if (Actors.pressed[id] & BTN.MELEE) this.quickMelee(id);
    if (!weapon) return;
    const altTaken = this.altTaken(id);
    this.updateAds(id, weapon, altTaken, dt);
    this.updateSway(id, weapon, dt);
    if (this.state[id] === WEAPON_STATE.RELOAD) { this.stepReload(id, weapon, dt); return; }
    if (Actors.pressed[id] & BTN.RELOAD) this.beginReload(id, weapon);
    this.stepBurst(id, weapon, dt);
    this.stepMode(id, weapon, weapon.primary, MODE_PRIMARY, BTN.FIRE, dt);
    if (!altTaken) this.stepAltMode(id, weapon, dt);
  },
  // GAD-002: an ALT hold that an underhand throw claimed never reaches the weapon's alt (no sights, no detonate on release).
  altTaken(id) {
    if (!(Actors.buttons[id] & BTN.ALT)) { this.altClaimed[id] = 0; return false; }
    if (this.altClaim && this.altClaim(id)) { this.altClaimed[id] = 1; this.altHeld[id] = 0; }
    return this.altClaimed[id] === 1;
  },
  // Aiming down sights needs a zoom alt (or an alt shot with its own zoom, the W19 slug) held while idle: a reload lowers the sights.
  updateAds(id, weapon, altTaken, dt) {
    const aiming = (weapon.alt.type === 'zoom' || weapon.alt.zoom > 1) && this.state[id] === WEAPON_STATE.IDLE && (Actors.buttons[id] & BTN.ALT) !== 0 && !altTaken;
    this.ads[id] = clamp(this.ads[id] + (aiming ? dt : -dt) / ADS_SECONDS, 0, 1);
    if (!aiming) this.zoomed[id] = 0;   // lowering the sights returns the scope to its first step
  },
  // W24 scope sway (FireMode.breath): an aimed scope drifts in a slow figure eight. Holding breath (the Walk action)
  // steadies it for `breath` seconds; after that the winded sway is stronger until the actor breathes again.
  updateSway(id, weapon, dt) {
    const breath = weapon.alt.breath, swaying = this.scopeSways(id, weapon), holding = swaying && (Actors.buttons[id] & BTN.WALK) !== 0;
    this.breathUsed[id] = holding ? Math.min(breath, this.breathUsed[id] + dt) : Math.max(0, this.breathUsed[id] - dt * BREATH_REFILL_RATE);
    const wanted = !holding ? 1 : this.breathUsed[id] < breath ? SWAY_STEADY_SCALE : SWAY_WINDED_SCALE;
    this.swayScale[id] += (wanted - this.swayScale[id]) * Math.min(1, dt * SWAY_SETTLE_RATE);
    const size = swaying ? SCOPE_SWAY_DEG * this.ads[id] * this.swayScale[id] : 0, phase = Sim.time * SCOPE_SWAY_RATE + id;
    this.swayYaw[id] = Math.sin(phase) * size;
    this.swayPitch[id] = Math.sin(phase * 2) * size * 0.5;   // twice as fast and half as tall: a lying eight
  },
  scopeSways(id, weapon) { return !!weapon && weapon.alt.breath > 0 && this.ads[id] > 0; },
  // The touch BREATH button (Walk) shows while the local player's scope sways; setFlag re-applies the layout on a change only.
  syncBreathButton() {
    const id = Game.playerId;
    TouchInput.setFlag('breath', id >= 0 && Actors.alive[id] === 1 && this.scopeSways(id, this.currentWeapon(id)));
  },
  coolDown(id, dt) {
    // One step of debt is kept so continuous fire hits the exact rate at 120 Hz; idle time never banks extra shots.
    this.nextShot[id] = Math.max(this.nextShot[id] - dt, -dt);
    this.nextAlt[id] = Math.max(this.nextAlt[id] - dt, 0);
    this.kick[id] = Math.max(0, this.kick[id] - dt / KICK_SECONDS);
    if (Sim.time - this.lastShot[id] > HEAT_VENT_DELAY) this.heat[id] = Math.max(0, this.heat[id] - HEAT_VENT_RATE * dt);
  },
  updateSpeed(id) {
    const weapon = this.currentWeapon(id);
    let scale = weapon ? lerp(weapon.moveMult, weapon.adsMoveMult, this.ads[id]) * this.modifier(id, weapon, STAT.MOVE) : 1;
    if (weapon && this.toggled[id] && weapon.alt.toggle) scale *= weapon.alt.toggle.speedMult === undefined ? 1 : weapon.alt.toggle.speedMult;
    this.speedScale[id] = scale * Damage.statusSpeed(id) * WeaponSpecialState.speedFactor(id);
    Move.weaponSpeedScale[id] = this.speedScale[id];   // S10 scales the actor's move speed by it
    Move.weaponReadyTime[id] = weapon ? weapon.readyTime : 0;   // S10 adds it to the sprint-to-fire wait
  },
  stepAltMode(id, weapon, dt) {
    const mode = weapon.alt, held = (Actors.buttons[id] & BTN.ALT) !== 0;
    if (mode.type === 'zoom') return;
    if (mode.type === 'block') { WeaponSpecialState.stepBlock(id, mode, held, dt); return; }
    if (mode.type === 'toggle') { this.stepStance(id, mode); return; }
    if (mode.type === 'detonate') { if (Actors.pressed[id] & BTN.ALT) Projectiles.detonateOwned(id, weapon.index, mode.projectile); return; }
    if (mode.detonateOnRelease) { this.stepDetonateTap(id, weapon, mode, held, dt); return; }
    this.stepMode(id, weapon, mode, MODE_ALT, BTN.ALT, dt);
  },
  // W32 (detonateOnRelease, R-080): a short tap throws on release; a hold of DETONATE_HOLD_SECONDS detonates every owned
  // mine and throws nothing, with or without ammo.
  stepDetonateTap(id, weapon, mode, held, dt) {
    if (held) { this.altHeld[id] += dt; return; }
    const heldFor = this.altHeld[id];
    this.altHeld[id] = 0;
    if (heldFor <= 0) return;
    if (heldFor >= DETONATE_HOLD_SECONDS) Projectiles.detonateOwned(id, weapon.index, mode.projectile);
    else this.releaseShot(id, weapon, mode, MODE_ALT, 0);
  },
  // ALT flips the stance; a mount (W29) needs a ledge and drops as soon as the actor moves or the ledge is gone.
  stepStance(id, mode) {
    const mounted = this.toggled[id] && mode.toggle.needsLedge;
    if (mounted && !canStayMounted(id)) this.toggled[id] = 0;
    if (!(Actors.pressed[id] & BTN.ALT)) return;
    if (!this.toggled[id] && mode.toggle.needsLedge && !hasLedgeInFront(id)) return;
    this.toggled[id] = this.toggled[id] ? 0 : 1;
  },

  // ---- Triggers: auto, semi, burst, charge (fires on release), release (lock-on fires on release) ----
  stepMode(id, weapon, mode, modeIndex, button, dt) {
    const held = (Actors.buttons[id] & button) !== 0, bit = 1 << modeIndex;
    if (!held) this.latch[id] &= ~bit;
    if (mode.type === 'lock') LockOn.update(id, mode, held, dt);
    if (mode.trigger === 'charge') { this.stepCharge(id, weapon, mode, modeIndex, held, dt); return; }
    if (mode.trigger === 'release') { this.stepRelease(id, weapon, mode, modeIndex, held); return; }
    if (!held) { this.spin[id] = Math.max(0, this.spin[id] - dt); return; }
    if (mode.spinUp > 0 && (this.spin[id] += dt) < mode.spinUp) return;
    if (mode.trigger !== 'auto' && (this.latch[id] & bit)) return;
    const shots = mode.trigger === 'auto' ? MAX_SHOTS_PER_STEP : 1;
    for (let shot = 0; shot < shots && this.ready(id, weapon, mode, modeIndex, button, 0); shot++) {
      this.latch[id] |= bit;
      if (mode.trigger === 'burst') this.startBurst(id, weapon, mode, modeIndex);
      this.fire(id, weapon, mode, modeIndex, 0);
    }
  },
  // R-018: the charge stops at the highest level the loaded ammo pays for, so the release always fires (or clicks empty).
  stepCharge(id, weapon, mode, modeIndex, held, dt) {
    if (held) {
      if (this.chargeMode[id] < 0 && !this.ready(id, weapon, mode, modeIndex, modeIndex ? BTN.ALT : BTN.FIRE, 0)) return;
      this.chargeMode[id] = modeIndex;
      const paid = Math.max(0, this.payableCharge(id, weapon, mode));
      this.charge[id] = Math.min(mode.charge.time * paid, this.charge[id] + dt);
      return;
    }
    if (this.chargeMode[id] !== modeIndex) return;
    const fraction = this.charge[id] / mode.charge.time;
    this.charge[id] = 0; this.chargeMode[id] = -1;
    this.releaseShot(id, weapon, mode, modeIndex, Math.min(fraction, Math.max(0, this.payableCharge(id, weapon, mode))));
  },
  // Highest charge fraction (a level step, or 1 for a smooth charge) the loaded ammo pays for; -1 when not even the lowest.
  payableCharge(id, weapon, mode) {
    const steps = mode.charge.levels ? mode.charge.levels.length - 1 : 0;
    for (let level = steps; level >= 0; level--) {
      const fraction = steps ? level / steps : 1;
      if (this.hasAmmo(id, weapon, mode, fraction)) return fraction;
    }
    return -1;
  },
  stepRelease(id, weapon, mode, modeIndex, held) {
    if (held) { this.latch[id] |= RELEASE_LATCH; return; }
    if (!(this.latch[id] & RELEASE_LATCH)) return;
    this.latch[id] &= ~RELEASE_LATCH;
    if (LockOn.lockedCount(id, mode)) this.releaseShot(id, weapon, mode, modeIndex, 0);
    LockOn.clear(id);
  },
  // A shot fired by letting go of the trigger (charge, lock-on, W32 mine tap): short of ammo it clicks empty instead.
  // A charge passed ready() when the hold began, so its release fires even if the actor started sprinting meanwhile.
  releaseShot(id, weapon, mode, modeIndex, fraction) {
    if (!this.hasAmmo(id, weapon, mode, fraction)) { this.reportEmpty(id, weapon, mode); return; }
    if (mode.trigger === 'charge' || this.ready(id, weapon, mode, modeIndex, 0, fraction)) this.fire(id, weapon, mode, modeIndex, fraction);
  },
  startBurst(id, weapon, mode, modeIndex) {
    this.burstLeft[id] = mode.burst - 1;
    this.burstTimer[id] = mode.burstGap / this.rateFactor(id, weapon);
    this.burstMode[id] = modeIndex;
  },
  stepBurst(id, weapon, dt) {
    if (!this.burstLeft[id]) return;
    this.burstTimer[id] -= dt;
    if (this.burstTimer[id] > 0) return;
    const mode = this.burstMode[id] ? weapon.alt : weapon.primary;
    this.burstTimer[id] += mode.burstGap / this.rateFactor(id, weapon);
    this.burstLeft[id]--;
    if (this.hasAmmo(id, weapon, mode, 0)) this.fireShot(id, weapon, mode, this.burstMode[id], 0);
    else this.burstLeft[id] = 0;
  },
  // True when the mode may fire now; a fresh press of `button` on empty reports it (0 = no report).
  ready(id, weapon, mode, modeIndex, button, fraction) {
    if (this.state[id] !== WEAPON_STATE.IDLE || this.burstLeft[id] || !Move.canFire(id)) return false;   // S10: sprint, mantle, board...
    if (mode.cooldown > 0 ? this.nextAlt[id] > 0 || this.nextShot[id] > 0 : this.nextShot[id] > 0) return false;
    if (mode.maxActive && mode.activeRule === 'block' && !mode.special && Projectiles.countOwned(id, weapon.index, CAT.projectiles.byId(mode.projectile).index) >= mode.maxActive) return false;
    if (mode.type === 'lock' && mode.trigger !== 'release' && !LockOn.lockedCount(id, mode)) return false;
    if (this.hasAmmo(id, weapon, mode, fraction)) return true;
    if (Actors.pressed[id] & button) this.reportEmpty(id, weapon, mode);
    return false;
  },
  // One rate rule for every trigger, burst pulls and burst gaps included: the toggle stance, dual wield and rateScale.
  rateFactor(id, weapon) {
    const stance = this.toggled[id] && weapon.alt.toggle && weapon.alt.toggle.rateMult ? weapon.alt.toggle.rateMult : 1;
    return stance * this.dualFactor(id, weapon) * this.rateScale[id];
  },
  shotInterval(id, weapon, mode) { return 1 / (mode.rate * this.rateFactor(id, weapon)); },
  // One trigger pull: timing, then the shot (a burst's later rounds call fireShot directly).
  fire(id, weapon, mode, modeIndex, fraction) {
    if (mode.cooldown > 0) this.nextAlt[id] = mode.cooldown;
    this.nextShot[id] += this.shotInterval(id, weapon, mode);
    if (mode.special && this.specials[mode.special](id, weapon, mode)) return;
    this.fireShot(id, weapon, mode, modeIndex, fraction);
  },
  fireShot(id, weapon, mode, modeIndex, fraction) {
    this.spendAmmo(id, weapon, mode, fraction);
    const deliver = this.deliveries[mode.type];
    deliver(id, weapon, mode, modeIndex, fraction);
    this.heat[id] = Math.min(WEAPON_HEAT_CAP, this.heat[id] + mode.heat);
    this.applyRecoil(id, weapon, mode);
    this.announceShot(id, weapon, mode, modeIndex);
    this.reloadIfEmpty(id, weapon, mode);
  },
  announceShot(id, weapon, mode, modeIndex) {
    const eyeY = Actors.eyeY(id);
    Vec.fromAngles(aimScratch, Actors.yaw[id], Actors.pitch[id]);
    FIRE_EVENT.id = id; FIRE_EVENT.weapon = weapon.id; FIRE_EVENT.weaponClass = weapon.class; FIRE_EVENT.mode = FIRE_MODE_LABELS[modeIndex];
    FIRE_EVENT.x = Actors.x[id]; FIRE_EVENT.y = eyeY; FIRE_EVENT.z = Actors.z[id];
    FIRE_EVENT.dx = aimScratch.x; FIRE_EVENT.dy = aimScratch.y; FIRE_EVENT.dz = aimScratch.z;
    Bus.emit('weapon.fire', FIRE_EVENT);
    emitSound(Actors.x[id], eyeY, Actors.z[id], mode.noise >= 0 ? mode.noise : weapon.noise, 'shot', id);
    this.kick[id] = 1;
    this.lastShot[id] = Sim.time;
    if (!Game.headless && mode.type !== 'melee') Fx.burst('muzzle', Actors.x[id] + aimScratch.x * MUZZLE_FORWARD, eyeY + aimScratch.y * MUZZLE_FORWARD, Actors.z[id] + aimScratch.z * MUZZLE_FORWARD, aimScratch.x, aimScratch.y, aimScratch.z, 3, weapon.family.color);
  },
  quickMelee(id) {
    const weapon = this.currentWeapon(id);
    if (this.state[id] === WEAPON_STATE.RELOAD) this.state[id] = WEAPON_STATE.IDLE;
    if (this.nextShot[id] > 0) return;
    const melee = this.ownedMelee(id);
    const mode = melee ? melee.primary : QUICK_MELEE, striker = melee || weapon || CAT.weapons[0];
    this.nextShot[id] += 1 / mode.rate;
    deliverMelee(id, striker, mode, MODE_PRIMARY, 0);
    this.announceShot(id, striker, mode, MODE_QUICK_MELEE);
  },
  ownedMelee(id) {
    for (let w = 0; w < WEAPON_COUNT; w++) if (this.owned[this.slotIndex(id, w)] && CAT.weapons[w].class === 'melee') return CAT.weapons[w];
    return null;
  },

  // ---- Spread (WPN-003, MOV-025) and recoil (WPN-004) ----
  spreadDegrees(id, weapon, mode) {
    // MOV-025 belongs to the movement preset (S10); its WPN-003 default covers hitscan guns only (arena rockets stay exact).
    const movement = Move.inaccuracy(id, mode.type !== 'hitscan') * mode.moveSpread;
    let base = mode.spreadDeg;
    if (weapon.family.firstShotExact && this.bloom[id] === 0 && movement === 0) base = 0;
    const aiming = lerp(1, mode.adsSpreadMult, this.ads[id]);
    return (base + movement + this.bloom[id] + Damage.limbSpread(id)) * aiming * this.modifier(id, weapon, STAT.SPREAD);
  },
  applyRecoil(id, weapon, mode) {
    const recoil = CAT.recoil.byId(mode.recoil) || CAT.recoil[0];
    const toggle = this.toggled[id] && weapon.alt.toggle && weapon.alt.toggle.recoilMult ? weapon.alt.toggle.recoilMult : 1;
    const stance = toggle * this.modifier(id, weapon, STAT.RECOIL);
    const shot = this.recoilShot[id] % RECOIL_PATTERN_LENGTH;
    this.recoilPitch[id] += (recoil.pattern[shot * 2] + recoil.jitter * Rng.weapons.gauss() * 0.5) * stance;
    this.recoilYaw[id] += (recoil.pattern[shot * 2 + 1] + recoil.jitter * Rng.weapons.gauss() * 0.5) * stance;
    this.bloom[id] = Math.min(recoil.bloomMax, this.bloom[id] + recoil.bloom);
    this.recoilShot[id]++;
  },
  // After recoverDelay without shooting, the aim punch and bloom return to zero at the pattern's recover rate.
  recoverRecoil(id, dt) {
    const weapon = this.currentWeapon(id);
    const recoil = weapon ? CAT.recoil.byId(weapon.primary.recoil) || CAT.recoil[0] : CAT.recoil[0];
    if (Sim.time - this.lastShot[id] < recoil.recoverDelay) return;
    const size = length2(this.recoilPitch[id], this.recoilYaw[id]);
    const keep = size > 0 ? Math.max(0, size - recoil.recover * dt) / size : 0;
    this.recoilPitch[id] *= keep; this.recoilYaw[id] *= keep;
    this.bloom[id] = Math.max(0, this.bloom[id] - recoil.recover * dt);
    if (keep === 0 && this.bloom[id] === 0) this.recoilShot[id] = 0;
  },
  // Shot direction: view angles + recoil punch + scope sway + a seeded random point inside the spread cone.
  aimDirection(id, spreadDeg, out) {
    const radius = spreadDeg * Math.sqrt(Rng.weapons.next()) * DEG, angle = Rng.weapons.next() * Math.PI * 2;
    const pitch = Actors.pitch[id] + (this.recoilPitch[id] + this.swayPitch[id]) * DEG + radius * Math.sin(angle);
    const yaw = Actors.yaw[id] + ((this.recoilYaw[id] + this.swayYaw[id]) * DEG + radius * Math.cos(angle)) / Math.max(0.2, Math.cos(pitch));
    return Vec.fromAngles(out, yaw, pitch);
  },
  shotDamage(id, weapon, mode, fraction) {
    const rarity = weapon.rarityScale ? WEAPON_RARITY_DAMAGE[this.rarity[this.slotIndex(id, weapon.index)]] : 1;
    const stance = this.toggled[id] && weapon.alt.toggle && weapon.alt.toggle.damageMult ? weapon.alt.toggle.damageMult : 1;
    let damage = mode.damage;
    if (mode.charge && mode.charge.target !== 'pellets' && mode.charge.target !== 'multiplier') damage = chargeDamage(mode.charge, fraction);
    if (mode.heatDamage) damage = Math.min(mode.heatDamage, this.heat[id]);
    return damage * rarity * stance * this.modifier(id, weapon, STAT.DAMAGE);
  },

  // ---- Hooks for other sections ----
  // INP-008: nearest visible enemy hit volume inside the assist cone; out = { x, y, z, target, angle (deg) }.
  aimAssist(id, out) {
    const eyeY = Actors.eyeY(id);
    Vec.fromAngles(aimScratch, Actors.yaw[id], Actors.pitch[id]);
    let bestAngle = AIM_ASSIST_CONE_DEG, found = false;
    for (let other = 0; other < Actors.count; other++) {
      if (!Actors.alive[other] || !Actors.isEnemy(id, other) || (Actors.flags[other] & ACTOR_FLAG.INVISIBLE)) continue;
      const angle = angleToZone(id, eyeY, other, ZONE.BODY, aimScratch, AIM_ASSIST_RANGE, bestAngle);
      if (angle < 0) continue;
      bestAngle = angle; found = true;
      Vec.copy(out, pointScratch); out.target = other; out.angle = angle;
    }
    return found;
  },
  // Render.viewModel: what the renderer needs to draw the held weapon of the local player.
  viewModel(out) {
    const id = Game.playerId, weapon = id >= 0 && Actors.alive[id] ? this.currentWeapon(id) : null;
    out.visible = !!weapon;
    if (!weapon) return out;
    const shown = this.state[id] === WEAPON_STATE.SWAP ? CAT.weapons[this.pending[id]] : weapon;
    out.shape = shown.class; out.model = shown.id; out.color = shown.family.color; out.kick = this.kick[id]; out.ads = this.ads[id];
    out.reload = this.state[id] === WEAPON_STATE.RELOAD ? this.stateTime[id] / this.stateDuration[id] : 0;
    out.swap = this.state[id] === WEAPON_STATE.SWAP ? 1 - this.stateTime[id] / this.stateDuration[id] : 0;   // 1 = fully lowered (07e poseWeapon)
    out.zoom = lerp(1, this.zoomed[id] && shown.alt.zoomMax > shown.alt.zoom ? shown.alt.zoomMax : shown.alt.zoom, this.ads[id]);
    out.charge = this.chargeMode[id] >= 0 ? this.charge[id] : 0;
    out.recoilPitch = this.recoilPitch[id] + this.swayPitch[id]; out.recoilYaw = this.recoilYaw[id] + this.swayYaw[id];   // degrees the spray and sway move the view
    out.dual = this.dual[this.slotIndex(id, shown.index)] === 1;
    return out;
  },
};

const AMMO_VIEW = { magazine: 0, reserve: 0, alt: 0, infinite: false };
const QUICK_MELEE = CAT.fireModes.byId('quick.melee');
const WEAPON_HEAT_CAP = 120;             // W36 heat blast: stored heat is capped here
const HEAT_VENT_DELAY = 1;               // R-186: after a second without a shot the stored heat vents...
const HEAT_VENT_RATE = 10;               // ...at this much per second (a full 120 is gone in 12 s)

function chargeLevelIndex(charge, fraction) { return Math.min(charge.levels.length - 1, Math.floor(fraction * (charge.levels.length - 1) + 1e-6)); }
function chargeLevelValue(charge, fraction) { return charge.levels ? charge.levels[chargeLevelIndex(charge, fraction)] : 1; }
function chargeDamage(charge, fraction) { return charge.levels ? chargeLevelValue(charge, fraction) : lerp(charge.min, charge.max, fraction); }

// Angle in degrees between the aim direction and a zone of `other`; -1 when beyond range (measured to the body surface),
// wider than maxAngle or not visible. The line-of-sight ray is cast last because it is the expensive part. Leaves the point in pointScratch.
function angleToZone(id, eyeY, other, zone, aim, range, maxAngle) {
  Hitbox.point(other, zone, pointScratch);
  const dx = pointScratch.x - Actors.x[id], dy = pointScratch.y - eyeY, dz = pointScratch.z - Actors.z[id];
  const distance = length3(dx, dy, dz);
  if (distance - TORSO_RADIUS > range || distance < 1e-3) return -1;
  const angle = Math.acos(clamp((dx * aim.x + dy * aim.y + dz * aim.z) / distance, -1, 1)) / DEG;
  if (angle > maxAngle) return -1;
  return World.lineClear(Actors.x[id], eyeY, Actors.z[id], pointScratch.x, pointScratch.y, pointScratch.z) ? angle : -1;
}

// Mounting (W29): a surface at about chest height right in front of the actor.
function hasLedgeInFront(id) {
  Vec.fromAngles(aimScratch, Actors.yaw[id], 0);
  const probeX = Actors.x[id] + aimScratch.x * 0.7, probeZ = Actors.z[id] + aimScratch.z * 0.7;
  return World.raycast(probeX, Actors.eyeY(id), probeZ, 0, -1, 0, 0.8, exitHit) && exitHit.ny > 0.7;
}
function canStayMounted(id) {
  if (length2(Actors.vx[id], Actors.vz[id]) > STILL_SPEED) return false;
  return hasLedgeInFront(id);
}

// ---- Shot tracing (ARC-014): world first, then actors along the ray, pierce, thin-cover penetration (WPN-005) ----
const Shot = {
  // Traces one ray from an origin; returns the distance where it stopped.
  trace(id, weapon, mode, damage, ox, oy, oz, dx, dy, dz) {
    let factor = 1, travelled = 0, startX = ox, startY = oy, startZ = oz;
    for (let segment = 0; segment < 2; segment++) {
      const range = mode.range - travelled;
      const worldWall = World.raycast(startX, startY, startZ, dx, dy, dz, range, shotHit) ? shotHit.distance : range;
      const blocker = Weapons.blockDistance(startX, startY, startZ, dx, dy, dz, worldWall);   // devices and domes stop the shot
      const wall = blocker >= 0 ? blocker : worldWall;
      // W17: an orb on the ray ends it there, but actors in front of the orb are hit first and may stop it (R-078).
      const orb = mode.combo ? Projectiles.comboTarget(startX, startY, startZ, dx, dy, dz, wall) : -1;
      const reach = orb >= 0 ? Projectiles.comboDistance : wall;
      const stopped = this.hitActors(id, weapon, mode, damage * factor, startX, startY, startZ, dx, dy, dz, reach, travelled);
      if (stopped >= 0) return travelled + stopped;
      if (orb >= 0) { Projectiles.detonateCombo(orb, id, mode); return travelled + reach; }
      travelled += wall;
      if (blocker >= 0) { emitBlockedImpact(startX + dx * wall, startY + dy * wall, startZ + dz * wall, dx, dy, dz, weapon.id, id); return travelled; }
      if (wall >= range) return travelled;
      emitImpact(shotHit, weapon.id, id);
      damagePropAt(shotHit, damage * factor, id);
      const exit = this.penetrate(mode, dx, dy, dz);
      if (exit < 0) return travelled;
      factor *= PENETRATION_FACTOR[mode.penetration];
      travelled += exit;
      startX = shotHit.x + dx * exit; startY = shotHit.y + dy * exit; startZ = shotHit.z + dz * exit;
    }
    return travelled;
  },
  // Damages the actors in front of the wall; returns the distance of the hit that stopped the shot, or -1 when it went on.
  hitActors(id, weapon, mode, damage, ox, oy, oz, dx, dy, dz, wall, travelled) {
    const includeAllies = mode.allyLink > 0 || currentRules().friendlyFire > 0;
    const count = RayHits.collect(id, ox, oy, oz, dx, dy, dz, wall, mode.pierce + 1, 0, includeAllies);
    for (let k = 0; k < count; k++) {
      const target = RayHits.ids[k], distance = RayHits.distances[k];
      if (mode.allyLink && !Actors.isEnemy(id, target)) { WeaponSpecialState.link(target, mode); continue; }
      applyShotDamage(id, target, weapon, mode, damage, RayHits.zones[k], RayHits.stomach[k], ox + dx * distance, oy + dy * distance, oz + dz * distance, dx, dy, dz, travelled + distance);
      if (mode.chain) WeaponSpecialState.chain(id, target, mode, damage);
    }
    if (count === 0 || count <= mode.pierce) return -1;
    return RayHits.distances[count - 1];
  },
  // Distance through a thin brush (wood, metal sheet) or -1 when the shot cannot pass.
  penetrate(mode, dx, dy, dz) {
    const brush = shotHit.brush;
    if (!mode.penetration || !brush || !THIN_MATERIALS.includes(brush.material)) return -1;
    const thinnest = Math.min(brush.maxX - brush.minX, brush.maxY - brush.minY, brush.maxZ - brush.minZ);
    if (thinnest > THIN_COVER_METRES) return -1;
    // Cast back from just beyond the brush to find its far face.
    const backX = shotHit.x + dx, backY = shotHit.y + dy, backZ = shotHit.z + dz;
    if (!World.raycast(backX, backY, backZ, -dx, -dy, -dz, 1, exitHit)) return -1;
    return 1 - exitHit.distance + 0.01;
  },
};

// Builds the damage info for one weapon hit and sends it through the single damage path.
function applyShotDamage(id, target, weapon, mode, damage, zone, stomach, x, y, z, dx, dy, dz, distance) {
  const info = Damage.info();
  info.amount = damage; info.zone = ZONE_NAMES[zone]; info.stomach = stomach === 1; info.mode = mode; info.weapon = weapon.id;
  info.kind = mode.type === 'beam' ? 'beam' : mode.type === 'melee' ? 'melee' : 'hit';
  info.element = mode.element; info.distance = distance; info.knockback = mode.knockback;
  info.x = x; info.y = y; info.z = z; info.dx = dx; info.dy = dy; info.dz = dz;
  return Damage.apply(id, target, info);
}

function eyeOrigin(id, out) { return Vec.set(out, Actors.x[id], Actors.eyeY(id), Actors.z[id]); }
const originScratch = Vec.make();

function drawTracer(id, direction, distance, weapon) {
  if (Game.headless) return;
  const eyeY = Actors.eyeY(id);
  Fx.tracer(Actors.x[id], eyeY - 0.1, Actors.z[id], Actors.x[id] + direction.x * distance, eyeY + direction.y * distance, Actors.z[id] + direction.z * distance, weapon.family.color | 0x404040);
}

// ---- Deliveries per fire mode type ----
function deliverHitscan(id, weapon, mode, modeIndex, fraction) {
  const damage = Weapons.shotDamage(id, weapon, mode, fraction), spread = Weapons.spreadDegrees(id, weapon, mode);
  const ballistics = Weapons.ballistics();   // X41: the pellets fly as bullets (11b)
  eyeOrigin(id, originScratch);
  const pellets = Weapons.paidPellets(mode.pellets);
  for (let pellet = 0; pellet < pellets; pellet++) {
    Weapons.aimDirection(id, spread, aimScratch);
    if (ballistics) { Projectiles.spawnBallistic(id, weapon, mode, modeIndex, aimScratch, damage, ballistics); continue; }
    const distance = Shot.trace(id, weapon, mode, damage, originScratch.x, originScratch.y, originScratch.z, aimScratch.x, aimScratch.y, aimScratch.z);
    if (pellet === 0 || mode.pellets < 4) drawTracer(id, aimScratch, distance, weapon);
    if (mode.splash) splashAtShotEnd(id, mode, distance);
  }
}
// Hitscan splash (flare): a blast just in front of where the shot stopped.
function splashAtShotEnd(id, mode, distance) {
  const back = Math.max(0, distance - 0.1), blast = Damage.blast();
  blast.x = originScratch.x + aimScratch.x * back; blast.y = originScratch.y + aimScratch.y * back; blast.z = originScratch.z + aimScratch.z * back;
  blast.owner = id; blast.mode = mode; blast.radius = mode.splash.r; blast.damage = mode.splash.dmg;
  Damage.explode(blast);
}

// Melee: a fat short ray; backstab bonus; charged ground hits launch the user (W01).
function deliverMelee(id, weapon, mode, modeIndex, fraction) {
  const damage = Weapons.shotDamage(id, weapon, mode, fraction);
  eyeOrigin(id, originScratch);
  Vec.fromAngles(aimScratch, Actors.yaw[id], Actors.pitch[id]);
  const wall = World.raycast(originScratch.x, originScratch.y, originScratch.z, aimScratch.x, aimScratch.y, aimScratch.z, mode.reach, shotHit) ? shotHit.distance : mode.reach;
  const count = RayHits.collect(id, originScratch.x, originScratch.y, originScratch.z, aimScratch.x, aimScratch.y, aimScratch.z, wall, 1, MELEE_RADIUS, false);
  if (count === 0) { meleeMiss(id, mode, wall < mode.reach); return; }
  const target = RayHits.ids[0], distance = RayHits.distances[0];
  const amount = mode.backstab && isBehind(id, target) ? mode.backstab : damage;
  applyShotDamage(id, target, weapon, mode, amount, RayHits.zones[0], 0, originScratch.x + aimScratch.x * distance, originScratch.y + aimScratch.y * distance, originScratch.z + aimScratch.z * distance, aimScratch.x, aimScratch.y, aimScratch.z, distance);
}
const LAUNCH_MIN_DOWN_PITCH = -45 * DEG;
function meleeMiss(id, mode, hitSurface) {
  if (!mode.launch || !hitSurface || shotHit.ny < 0.6 || Actors.pitch[id] > LAUNCH_MIN_DOWN_PITCH) return;
  emitImpulse(id, 0, Math.sqrt(2 * GRAVITY * mode.launch.height), 0);
  const info = Damage.info();
  info.amount = mode.launch.selfDamage; info.kind = 'self'; info.weapon = mode.weapon; info.x = shotHit.x; info.y = shotHit.y; info.z = shotHit.z;
  Damage.apply(id, id, info);
}
// True when the attacker stands behind the target (within 60 deg of the target's back).
function isBehind(attacker, target) {
  const dx = Actors.x[target] - Actors.x[attacker], dz = Actors.z[target] - Actors.z[attacker], length = length2(dx, dz) || 1;
  return (dx * Math.sin(Actors.yaw[target]) + dz * Math.cos(Actors.yaw[target])) / length > 0.5;
}

// Cone: every actor inside the cone and in line of sight (flamer, heat blast, 360 deg shockwave).
function deliverCone(id, weapon, mode, modeIndex, fraction) {
  const damage = Weapons.shotDamage(id, weapon, mode, fraction), eyeY = Actors.eyeY(id);
  if (mode.heatDamage) Weapons.heat[id] = 0;
  Vec.fromAngles(aimScratch, Actors.yaw[id], Actors.pitch[id]);
  const halfAngle = mode.cone.angle >= 360 ? 180 : mode.cone.angle * 0.5;
  for (let target = 0; target < Actors.count; target++) {
    if (!Actors.alive[target] || !Actors.isEnemy(id, target)) continue;
    if (angleToZone(id, eyeY, target, ZONE.BODY, aimScratch, mode.cone.range, halfAngle) < 0) continue;
    const distance = length3(pointScratch.x - Actors.x[id], pointScratch.y - eyeY, pointScratch.z - Actors.z[id]) || 1;
    const dirX = (pointScratch.x - Actors.x[id]) / distance, dirY = (pointScratch.y - eyeY) / distance, dirZ = (pointScratch.z - Actors.z[id]) / distance;
    applyShotDamage(id, target, weapon, mode, damage, ZONE.NONE, 0, pointScratch.x, pointScratch.y, pointScratch.z, dirX, dirY, dirZ, distance);
  }
  if (!Game.headless) Fx.burst(mode.element === 'thermal' ? 'fire' : 'energy', Actors.x[id] + aimScratch.x, eyeY + aimScratch.y, Actors.z[id] + aimScratch.z, aimScratch.x, aimScratch.y, aimScratch.z, 8, weapon.family.color);
}

// Projectile modes: pellets (or charge levels) spawn pooled projectiles with spread.
function deliverProjectile(id, weapon, mode, modeIndex, fraction) {
  const charge = mode.charge;
  const pellets = Weapons.paidPellets(charge && charge.target === 'pellets' ? chargeLevelValue(charge, fraction) : mode.pellets);
  const multiplier = charge && charge.target === 'multiplier' ? chargeLevelValue(charge, fraction) : 1;
  const speed = charge && charge.speed ? lerp(charge.speed[0], charge.speed[1], fraction) : 0;
  const damage = Weapons.shotDamage(id, weapon, mode, fraction), spread = Weapons.spreadDegrees(id, weapon, mode);
  for (let pellet = 0; pellet < pellets; pellet++) {
    Weapons.aimDirection(id, spread, aimScratch);
    Projectiles.spawnFromWeapon(id, weapon, mode, modeIndex, aimScratch, damage, multiplier, speed, LockOn.targetFor(id, mode));
  }
}

// ---- Lock-on (W07 auto-aim, W33 homing volley) ----
const LockOn = {
  update(id, mode, held, dt) {
    if (!held) { if (mode.trigger !== 'release') this.clear(id); return; }
    this.dropStale(id);
    const eyeY = Actors.eyeY(id);
    Vec.fromAngles(lockScratch, Actors.yaw[id], Actors.pitch[id]);
    for (let target = 0; target < Actors.count; target++) {
      if (!Actors.alive[target] || !Actors.isEnemy(id, target)) continue;
      const angle = angleToZone(id, eyeY, target, ZONE.BODY, lockScratch, mode.lock.range, mode.lock.coneDeg * 0.5);
      const slot = this.slotOf(id, target);
      if (angle < 0) { if (slot >= 0) Weapons.lockIds[slot] = -1; continue; }
      this.progress(id, target, slot, mode, dt);
    }
  },
  progress(id, target, slot, mode, dt) {
    const index = slot >= 0 ? slot : this.freeSlot(id, mode.lock.targets);
    if (index < 0) return;
    if (slot < 0) { Weapons.lockIds[index] = target; Weapons.lockTime[index] = 0; }
    Weapons.lockTime[index] = Math.min(mode.lock.time, Weapons.lockTime[index] + dt);
  },
  // R-019: a lock on a dead (or no longer hostile) target frees its slot, so a held trigger moves on to the next enemy
  // (and a respawned target starts its lock again).
  dropStale(id) {
    for (let slot = id * MAX_LOCKS; slot < (id + 1) * MAX_LOCKS; slot++) {
      const target = Weapons.lockIds[slot];
      if (target >= 0 && (!Actors.alive[target] || !Actors.isEnemy(id, target))) Weapons.lockIds[slot] = -1;
    }
  },
  slotOf(id, target) {
    for (let k = 0; k < MAX_LOCKS; k++) if (Weapons.lockIds[id * MAX_LOCKS + k] === target) return id * MAX_LOCKS + k;
    return -1;
  },
  freeSlot(id, limit) {
    for (let k = 0; k < limit; k++) if (Weapons.lockIds[id * MAX_LOCKS + k] < 0) return id * MAX_LOCKS + k;
    return -1;
  },
  isLocked(slot, mode) { return Weapons.lockIds[slot] >= 0 && Actors.alive[Weapons.lockIds[slot]] && Weapons.lockTime[slot] >= mode.lock.time; },
  lockedCount(id, mode) {
    let count = 0;
    for (let k = 0; k < MAX_LOCKS; k++) if (this.isLocked(id * MAX_LOCKS + k, mode)) count++;
    return count;
  },
  // Next fully locked target (round robin), -1 when none.
  next(id, mode) {
    for (let step = 0; step < MAX_LOCKS; step++) {
      const k = (Weapons.lockCursor[id] + step) % MAX_LOCKS;
      if (!this.isLocked(id * MAX_LOCKS + k, mode)) continue;
      Weapons.lockCursor[id] = (k + 1) % MAX_LOCKS;
      return Weapons.lockIds[id * MAX_LOCKS + k];
    }
    return -1;
  },
  // Homing target handed to a projectile: the next full lock (volleys spread over the locks), else any lock in progress.
  targetFor(id, mode) {
    const locked = mode.lock ? this.next(id, mode) : -1;
    if (locked >= 0) return locked;
    for (let k = 0; k < MAX_LOCKS; k++) if (Weapons.lockIds[id * MAX_LOCKS + k] >= 0) return Weapons.lockIds[id * MAX_LOCKS + k];
    return -1;
  },
  clear(id) { Weapons.lockIds.fill(-1, id * MAX_LOCKS, (id + 1) * MAX_LOCKS); },
};

// Lock fire without projectiles: an auto-aimed hitscan at the next locked target (W07).
function deliverLock(id, weapon, mode, modeIndex, fraction) {
  if (mode.projectile) { deliverProjectile(id, weapon, mode, modeIndex, fraction); return; }
  const target = LockOn.next(id, mode);
  if (target < 0) return;
  eyeOrigin(id, originScratch);
  Hitbox.point(target, ZONE.BODY, pointScratch);
  Vec.set(aimScratch, pointScratch.x - originScratch.x, pointScratch.y - originScratch.y, pointScratch.z - originScratch.z);
  Vec.normalize(aimScratch, aimScratch);
  const distance = Shot.trace(id, weapon, mode, Weapons.shotDamage(id, weapon, mode, fraction), originScratch.x, originScratch.y, originScratch.z, aimScratch.x, aimScratch.y, aimScratch.z);
  drawTracer(id, aimScratch, distance, weapon);
}

function deliverTool(id, weapon, mode) { Weapons.tools[mode.tool](id, weapon, mode); }

Weapons.deliveries.hitscan = deliverHitscan;
Weapons.deliveries.beam = deliverHitscan;
Weapons.deliveries.melee = deliverMelee;
Weapons.deliveries.cone = deliverCone;
Weapons.deliveries.projectile = deliverProjectile;
Weapons.deliveries.lock = deliverLock;
Weapons.deliveries.tool = deliverTool;

Sim.addSystem('weapons', 40, (dt) => Weapons.step(dt));
Bus.on('actor.create', (id) => {
  Weapons.clear(id);
  Weapons.statScale.fill(1, id * WEAPON_STAT_COUNT, (id + 1) * WEAPON_STAT_COUNT);
});
Bus.on('actor.spawn', (event) => Weapons.giveStartLoadout(event.id));
Bus.on('match.stop', () => TouchInput.setFlag('breath', false));
Input.aimAssistTarget = (id, out) => Weapons.aimAssist(id, out);
Input.autoFireTrigger = (id) => { const weapon = Weapons.currentWeapon(id); return weapon ? weapon.primary.trigger : 'auto'; };   // INP-006: touch auto-fire pulses semi and burst
// The difficulty preset's aimAssist (rules.botSkill, D01 Stroll 100) replaces the player's setting; -1 keeps it.
Input.aimAssistOverride = () => {
  const skill = currentRules().botSkill;
  return skill && skill.aimAssist >= 0 ? skill.aimAssist : -1;
};
Render.viewModel = (out) => Weapons.viewModel(out);
// Third person: the weapon an actor holds, the one being raised while it swaps (07c draws its model).
Render.heldWeapon = (id) => (Weapons.state[id] === WEAPON_STATE.SWAP && Weapons.pending[id] >= 0 ? Weapons.pending[id] : Weapons.current[id]);
