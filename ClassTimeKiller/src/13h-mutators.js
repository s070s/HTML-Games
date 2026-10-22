// ==== S13 MUTATORS ====
// Mutators X01..X50 (rows: 03m-data-mutators.js). A mutator is applied in the Rules 'mutators' stage (MOV-001): its data operations
// change ruleset fields, movement overrides and the effect bag rules.fx. Effects that cannot be a static field run from the match
// hooks below (spawn, kill, damage, fire, one sim system and the Damage attacker scale), each guarded by its own rules.fx flag.
// Several mutators can be active; Mutators.resolve removes the earlier one of a conflicting pair (MUT-002, last chosen wins).
// Contract for other sections: docs/api/mutators-custom.md ("rules.fx").

const MATCH_SET_ID = 'matchSet';             // the reserved weapon set row the match fills for lists (X08, X09, X10, custom editor)
const MATCH_SET_PLACEHOLDER = ['maul'];
const MUTATOR_STEP_ORDER = 85;               // after the PvE director (80), before bookkeeping (90)
const SLOWMO_SIM_SECONDS = 0.75;             // X27: 1.5 s of real time at half speed
const SLOWMO_FACTOR = 0.5;
const HEAD_SIZE_DEFAULT = 1;
const GROWTH_PER_KILL = 0.05;                // X31
const GROWTH_MAX_KILLS = 10;
const SHRINK_PER_HIT = 0.05;                 // X39
const SHRINK_MIN = 0.5;
const SHIELD_DEFAULT_POOL = 50;              // X07 on a preset without shields
const ONE_HIT_FACTOR = 1000;                 // X08: more than any health pool
const MAX_TAGS = 24;                         // X42
const TAG_LIFE_SECONDS = 15;
const TAG_REACH = 1.5;
const MAX_GIFTS = 12;                        // X29
const GIFT_FUSE_SECONDS = 3;
const GIFT_RADIUS = 5;
const GIFT_DAMAGE = 100;
const GIFT_DRAW_SIZE = 0.3;
const GIFT_BLINK_SLOW = 6, GIFT_BLINK_FAST = 24;   // blink speed (radians per second) at the start of the fuse and what is added by its end
const SUPPRESS_RANGE = 60;                   // X44: a shot passing within this distance of a target, closer than SUPPRESS_REACH
const SUPPRESS_REACH = 2.5;
const SUPPRESS_SECONDS = 1.5;
const SUPPRESS_SPREAD = 1.5;
const TRIANGLE_HEALTH = 25;                  // X47
const TRIANGLE_ARMOR = 25;
const TRIANGLE_AMMO = 12;
const TRIANGLE_RESERVE_SCALE = 0.5;
const POWER_FIRST = 5, POWER_LAST = 33;      // X46: abilities A05..A33
const MUTATOR_ZONE_HEAD = 'head';

const GRANT_EVENT = { id: 0, item: '' };
const POWER_EVENT = { id: 0, ability: '' };
const TOAST_EVENT = { text: '' };
const NEAR_ACTORS = new Array(MAX_ACTORS).fill(0);

const Mutators = {
  messages: [],                    // notices of the last resolve (what was removed and why)
  fx: null,                        // rules.fx of the running match, null when no mutator is active (hot paths return at once)
  rules: null,
  growth: new Uint8Array(MAX_ACTORS),            // X31 kills this life
  shrink: new Float32Array(MAX_ACTORS).fill(1),  // X39 size factor
  suppressed: new Float32Array(MAX_ACTORS),      // X44 seconds left (HUD blur: Mutators.suppression(id))
  slowmoLeft: 0,
  nextSuperPowerup: 0,
  tagCount: 0,
  powerNames: [],
  hooks: { spawn: [], kill: [], damage: [], fire: [], step: [] },   // runtime effect hooks, see runHooks

  addHook(kind, hook) { this.hooks[kind].push(hook); },
  row(id) { return CAT.mutators.byId(id); },
  isActive(id) { return !!this.rules && this.rules.mutators.some((entry) => entry.id === id); },
  value(id) {
    const entry = this.rules ? this.rules.mutators.find((item) => item.id === id) : null;
    return entry ? entry.value : undefined;
  },

  // ---- Typed values ----
  optionsOf(param) {
    const base = param.source === 'weaponSets' ? CAT.weaponSets.filter((row) => row.id !== MATCH_SET_ID).map((row) => row.id) : param.options;
    return base.concat(param.extra || []);
  },
  defaultValue(row) {
    if (!row.params.length) return true;
    if (row.params.length === 1) return row.params[0].default;
    const value = {};
    for (const param of row.params) value[param.key] = param.default;
    return value;
  },
  // The canonical value for a row, or undefined when it is not valid (false and null mean "not chosen"). true and
  // undefined stand for the defaults; numbers are clamped and snapped to the step.
  coerce(row, value) {
    if (value === false || value === null) return undefined;
    if (!row.params.length) return true;
    if (value === true || value === undefined) return this.defaultValue(row);
    if (row.params.length === 1) return this.coerceParam(row.params[0], value);
    if (typeof value !== 'object' || Array.isArray(value)) return undefined;
    const result = {};
    for (const param of row.params) {
      result[param.key] = value[param.key] === undefined ? param.default : this.coerceParam(param, value[param.key]);
      if (result[param.key] === undefined) return undefined;
    }
    return result;
  },
  coerceParam(param, value) {
    if (param.kind === 'range') return typeof value === 'number' && isFinite(value) ? snapToStep(param, value) : undefined;
    if (Array.isArray(value)) return this.coerceWeaponList(param, value);
    return this.optionsOf(param).includes(value) ? value : undefined;
  },
  coerceWeaponList(param, list) {
    if (param.source !== 'weaponSets' || !list.length || !list.every((key) => typeof key === 'string' && CAT.weapons.byId(key))) return undefined;
    return Array.from(new Set(list));
  },

  // ---- Conflicts (MUT-002) ----
  conflicts(idA, idB) {
    const a = this.row(idA), b = this.row(idB);
    return !!a && !!b && idA !== idB && (a.conflicts.includes(idB) || b.conflicts.includes(idA));
  },
  conflictMessage(kept, removed) {
    return this.row(kept).name + ' cannot be combined with ' + this.row(removed).name + '. ' + this.row(removed).name + ' was turned off.';
  },
  // Adds (or replaces) one mutator in a list of { id, value }; conflicting earlier entries are removed. Returns { list, added, removed, message }.
  add(list, id, value) {
    const row = this.row(id);
    const coerced = row ? this.coerce(row, value) : undefined;
    if (coerced === undefined) return { list: list.slice(), added: false, removed: [], message: row ? row.name + ' has an invalid value.' : 'Unknown mutator ' + id + '.' };
    const kept = [], removed = [];
    for (const entry of list) {
      if (entry.id === id) continue;
      if (this.conflicts(id, entry.id)) removed.push(entry.id); else kept.push(entry);
    }
    kept.push({ id, value: coerced });
    const message = removed.map((other) => this.conflictMessage(id, other)).join(' ');
    return { list: kept, added: true, removed, message };
  },
  remove(list, id) { return list.filter((entry) => entry.id !== id); },
  // Canonical list: strings and { id, value } accepted, invalid entries dropped (notes in messages), conflicts resolved last-wins.
  resolve(list) {
    const messages = [], unknown = [];
    let result = [];
    for (const raw of list || []) {
      const spec = typeof raw === 'string' ? { id: raw, value: true } : raw;
      const row = spec ? this.row(spec.id) : null;
      if (!row) { unknown.push(spec ? spec.id : '?'); continue; }
      if (spec.value === false || spec.value === null) { result = this.remove(result, spec.id); continue; }
      let value = this.coerce(row, spec.value);
      if (value === undefined) { messages.push(row.name + ' had an invalid value; the default is used.'); value = this.defaultValue(row); }
      const step = this.add(result, spec.id, value);
      if (step.message) messages.push(step.message);
      result = step.list;
    }
    this.messages = messages;
    return { list: result, messages, unknown };
  },
  describe(entry) {
    const row = this.row(entry.id);
    if (!row) return entry.id;
    if (!row.params.length) return row.name;
    const parts = row.params.map((param) => this.describeValue(param, row.params.length === 1 ? entry.value : entry.value[param.key]));
    return row.name + ' ' + parts.join(', ');
  },
  describeValue(param, value) {
    if (Array.isArray(value)) return value.length + ' weapons';
    if (param.kind === 'choice') return param.labels ? param.labels[param.options.indexOf(value)] || String(value) : String(value);
    return value + (param.unit || '');
  },

  // ---- Runtime access for other sections ----
  suppression(id) { return this.fx && this.fx.suppression ? clamp(this.suppressed[id] / SUPPRESS_SECONDS, 0, 1) : 0; },
  sizeScale(id) { return Hitbox.sizeScale[id]; },
};

function snapToStep(param, value) {
  const clamped = clamp(value, param.min, param.max);
  const snapped = param.min + Math.round((clamped - param.min) / param.step) * param.step;
  return Number(clamp(snapped, param.min, param.max).toFixed(4));
}

// ---- Static operations (rows' set lists) ----
function getPath(target, path) {
  let node = target;
  for (const key of path.split('.')) {
    if (node === undefined || node === null) return undefined;
    node = node[key];
  }
  return node;
}
function setPath(target, path, value) {
  const keys = path.split('.');
  let node = target;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!isPlainObject(node[keys[i]])) node[keys[i]] = {};
    node = node[keys[i]];
  }
  node[keys[keys.length - 1]] = value;
}
function paramValue(operation, value) {
  const raw = isPlainObject(value) ? value[operation.param] : value;
  if (typeof raw !== 'number') return raw;
  return raw * (operation.scale === undefined ? 1 : operation.scale) + (operation.add || 0);
}
function operationValue(operation, value) {
  return operation.value !== undefined ? copyRuleValue(operation.value) : paramValue(operation, value);
}
// The movement preset value the match will use (override first), so a mutator can scale it.
function movePresetValue(rules, field) {
  if (rules.moveOverrides[field] !== undefined) return rules.moveOverrides[field];
  const row = CAT.movement.byId(rules.move);
  return row ? row[field] : 0;
}
function weaponKeyOf(codeOrKey) {
  const weapon = CAT.weapons.byId(codeOrKey) || CAT.weapons.find((row) => row.code === codeOrKey);
  return weapon ? weapon.id : null;
}
function armMatchSet(rules, keys) {
  setPath(rules, 'fx.weaponList', keys);
  rules.weaponSet = MATCH_SET_ID;
}
function randomWeaponSet() {
  return Rng.rules.pick(CAT.weaponSets.filter((row) => row.id !== MATCH_SET_ID)).id;
}

const MUTATOR_OPERATIONS = {
  set(rules, operation, value) { setPath(rules, operation.field, operationValue(operation, value)); },
  mul(rules, operation, value) {
    const current = getPath(rules, operation.field);
    setPath(rules, operation.field, (current === undefined ? 1 : current) * operationValue(operation, value));
  },
  min(rules, operation, value) {
    const current = getPath(rules, operation.field), next = operationValue(operation, value);
    setPath(rules, operation.field, current === undefined ? next : Math.min(current, next));
  },
  max(rules, operation, value) {
    const current = getPath(rules, operation.field), next = operationValue(operation, value);
    setPath(rules, operation.field, current === undefined ? next : Math.max(current, next));
  },
  mulMove(rules, operation, value) {
    const factor = paramValue(operation, value);
    for (const field of operation.fields) {
      const base = movePresetValue(rules, field);
      if (base) rules.moveOverrides[field] = base * factor;
    }
  },
  setMove(rules, operation, value) { rules.moveOverrides[operation.field] = operationValue(operation, value); },
  atLeastMove(rules, operation, value) { rules.moveOverrides[operation.field] = Math.max(movePresetValue(rules, operation.field), operationValue(operation, value)); },
  weaponList(rules, operation) { armMatchSet(rules, operation.value.map(weaponKeyOf).filter(Boolean)); },
  weaponSet(rules, operation, value) {
    const choice = paramValue(operation, value);
    if (Array.isArray(choice)) armMatchSet(rules, choice.slice());
    else rules.weaponSet = choice === 'random' ? randomWeaponSet() : choice;
  },
};

function applyMutator(rules, entry) {
  const row = Mutators.row(entry.id);
  for (const operation of row.set) MUTATOR_OPERATIONS[operation.op](rules, operation, entry.value);
}

// The 'mutators' rule stage: canonical list, then every operation in list order. rules.fx always exists afterwards.
function applyMutatorStage(rules) {
  const resolved = Mutators.resolve(rules.mutators);
  for (const id of resolved.unknown) Rules.report('unknown mutator ' + id);
  rules.mutators = resolved.list;
  rules.fx = {};
  for (const entry of rules.mutators) applyMutator(rules, entry);
  for (const text of resolved.messages) { TOAST_EVENT.text = text; Bus.emit('toast', TOAST_EVENT); }
}
// X22: the player's handicap, unless the setup names one (the handicap stage runs after the mutators).
function applyMutatorHandicap(rules, setup) {
  const named = setup.player && typeof setup.player.handicap === 'number';
  if (rules.fx && rules.fx.handicap && !named) rules.handicap.player = clampHandicap(rules.fx.handicapPlayer);
}
Rules.addModifier('mutators', applyMutatorStage);
Rules.addModifier('handicap', applyMutatorHandicap);

// ---- Runtime effects: damage scale (one Damage hook) ----
const AIMED_HIT_KINDS = ['hit', 'beam'];      // direct hits of guns and beams: head-only (X28) and one-shot (X08) both judge these
function isOpponentDamage(source, target) { return source >= 0 && source !== target; }

function mutatorDamageScale(source, target, info) {
  const fx = Mutators.fx;
  if (!fx) return 1;
  if (info.kind === 'fall' && fx.noFallDamage) return 0;
  let factor = (fx.damageIn === undefined ? 1 : fx.damageIn);
  if (!isOpponentDamage(source, target)) return factor;
  if (fx.damageOut !== undefined) factor *= fx.damageOut;
  if (fx.headOnly && AIMED_HIT_KINDS.includes(info.kind) && info.zone !== MUTATOR_ZONE_HEAD) return 0;
  if (fx.airborneOnly && (Actors.flags[target] & ACTOR_FLAG.ON_GROUND)) return 0;
  if (fx.oneHit && AIMED_HIT_KINDS.includes(info.kind)) factor *= ONE_HIT_FACTOR;
  return factor;
}
Damage.addAttackerScale(mutatorDamageScale);

// ---- Runtime effects: one hook list per event ----
// Mutators.addHook(kind, fn(fx, a, b)) with kind spawn (a = actor id), kill (a = kill event), damage (a = damage event), fire (a = shot) or
// step (a = dt). Hooks run only while rules.fx has entries and each one checks its own flag, so a match without mutators pays nothing.
function runHooks(kind, first, second) {
  const fx = Mutators.fx;
  if (!fx) return;
  const list = Mutators.hooks[kind];
  for (let i = 0; i < list.length; i++) list[i](fx, first, second);
}

// ---- Sizes (hit volumes and the drawn body) ----
function refreshSize(id) {
  const grown = 1 + GROWTH_PER_KILL * Mutators.growth[id];
  Hitbox.sizeScale[id] = grown * Mutators.shrink[id];
}
function resetSize(id) {
  Mutators.growth[id] = 0;
  Mutators.shrink[id] = 1;
  Hitbox.sizeScale[id] = 1;
  Hitbox.headScale[id] = Mutators.fx && Mutators.fx.headScale ? Mutators.fx.headScale : HEAD_SIZE_DEFAULT;
}

// ---- Spawn hooks ----
function setMutatorStat(id, stat, scale) { Weapons.mutatorScale[id * WEAPON_STAT_COUNT + stat] = scale; }
function onSpawnReset(fx, id) {
  resetSize(id);
  Mutators.suppressed[id] = 0;
  setMutatorStat(id, STAT.SPREAD, 1);
}
function onSpawnHealth(fx, id) {
  if (fx.health) { Actors.health[id] = fx.health; Actors.maxHealth[id] = fx.health; }
  if (fx.healthScale === undefined) return;
  Actors.health[id] *= fx.healthScale;
  Actors.maxHealth[id] *= fx.healthScale;
}
function onSpawnShield(fx, id) {
  if (fx.shields === undefined) return;
  const base = Actors.maxShield[id] > 0 ? Actors.maxShield[id] : SHIELD_DEFAULT_POOL;
  const pool = fx.shields === 0 ? 0 : base * fx.shields / 100;
  Actors.shield[id] = pool;
  Actors.maxShield[id] = pool;
}
function onSpawnMirror(fx, id) {
  const player = Game.playerId;
  if (!fx.mirror || player < 0 || player === id || Actors.kind[id] === ACTOR_KIND.PLAYER || !Actors.alive[player]) return;
  const keys = CAT.weapons.filter((row) => Weapons.has(player, row.id)).map((row) => row.id);
  if (keys.length) Weapons.setLoadout(id, keys);
}
function onSpawnPower(fx, id) {
  if (!fx.powers || !Mutators.powerNames.length) return;
  POWER_EVENT.id = id;
  POWER_EVENT.ability = Rng.rules.pick(Mutators.powerNames);
  Bus.emit('power.pick', POWER_EVENT);
}

// ---- Confirm tags (X42) and last gifts (X29): two small pools of timed spots, no allocation per step ----
function makeSpotPool(size, seconds) {
  return {
    x: new Float32Array(size), y: new Float32Array(size), z: new Float32Array(size),
    timer: new Float32Array(size), owner: new Int8Array(size).fill(-1),
    clear() { this.timer.fill(0); },
    drop(x, y, z, owner) {
      let slot = this.timer.findIndex((left) => left <= 0);
      if (slot < 0) slot = 0;
      this.x[slot] = x; this.y[slot] = y; this.z[slot] = z; this.timer[slot] = seconds; this.owner[slot] = owner;
    },
    // Counts every live spot down and calls visit(slot) for it (the visit may end the spot by zeroing its timer).
    step(dt, visit) {
      for (let slot = 0; slot < size; slot++) {
        if (this.timer[slot] <= 0) continue;
        this.timer[slot] -= dt;
        visit(slot);
      }
    },
  };
}
const TagPool = makeSpotPool(MAX_TAGS, TAG_LIFE_SECONDS);
const GiftPool = makeSpotPool(MAX_GIFTS, GIFT_FUSE_SECONDS);

// A teammate of the killer touching a tag collects it (score); when only opponents touch it, it is denied.
function touchTag(slot) {
  const count = World.actorsInSphere(TagPool.x[slot], TagPool.y[slot], TagPool.z[slot], TAG_REACH, NEAR_ACTORS);
  if (!count) return;
  let collector = -1;
  for (let i = 0; i < count && collector < 0; i++) if (!Actors.isEnemy(TagPool.owner[slot], NEAR_ACTORS[i])) collector = NEAR_ACTORS[i];
  if (collector >= 0) collectTag(collector);
  TagPool.timer[slot] = 0;
}
function collectTag(collector) {
  Modes.objective[collector]++;
  Modes.awardKillPoints(collector, Mutators.rules.scoring.tag || 0, 'tag');
}
function detonateGift(slot) {
  if (GiftPool.timer[slot] > 0) return;
  const blast = Damage.blast();
  blast.x = GiftPool.x[slot]; blast.y = GiftPool.y[slot]; blast.z = GiftPool.z[slot]; blast.owner = GiftPool.owner[slot];
  blast.radius = GIFT_RADIUS; blast.damage = GIFT_DAMAGE; blast.weapon = 'lastgift'; blast.element = 'kinetic';
  Damage.explode(blast);
}

// ---- Kill hooks ----
function onKillGift(fx, event) {
  if (fx.lastGift) GiftPool.drop(event.x, event.y + 0.5, event.z, event.victim);
}
function onKillTag(fx, event) {
  if (fx.tags && event.killer >= 0 && event.killer !== event.victim) TagPool.drop(event.x, event.y + 0.3, event.z, event.killer);
}
function onKillSlowmo(fx, event) {
  if (fx.slowmoKills && event.killer === Game.playerId && event.killer !== event.victim) Mutators.slowmoLeft = SLOWMO_SIM_SECONDS;
}
function isOpponentKill(event) { return event.killer >= 0 && event.killer !== event.victim && Actors.alive[event.killer]; }
function onKillTriangle(fx, event) {
  if (!fx.triangle || !isOpponentKill(event)) return;
  const killer = event.killer, weapon = CAT.weapons.byId(event.weapon);
  if (weapon && weapon.class === 'melee') {
    Actors.health[killer] = Math.min(Actors.maxHealth[killer], Actors.health[killer] + TRIANGLE_HEALTH);
    const held = Weapons.currentWeapon(killer);
    if (held) Weapons.addAmmo(killer, held.ammoType, TRIANGLE_AMMO);
  }
  if (event.element === 'thermal') Actors.armor[killer] = Math.min(Math.max(Actors.maxArmor[killer], TRIANGLE_ARMOR), Actors.armor[killer] + TRIANGLE_ARMOR);
}
function onKillGrowth(fx, event) {
  const killer = event.killer;
  if (!fx.growth || !isOpponentKill(event) || Mutators.growth[killer] >= GROWTH_MAX_KILLS) return;
  Mutators.growth[killer]++;
  const share = 1 + GROWTH_PER_KILL / (1 + GROWTH_PER_KILL * (Mutators.growth[killer] - 1));
  Actors.maxHealth[killer] *= share;
  Actors.health[killer] *= share;
  refreshSize(killer);
}

// ---- Damage hooks ----
function onDamageLifesteal(fx, event) {
  const source = event.source;
  if (!fx.lifesteal || !isOpponentDamage(source, event.target) || !Actors.alive[source]) return;
  Actors.health[source] = Math.min(Actors.maxHealth[source], Actors.health[source] + event.amount * fx.lifesteal);
}
function onDamageShrink(fx, event) {
  const target = event.target;
  if (!fx.shrinkHit || !isOpponentDamage(event.source, target) || !Actors.alive[target]) return;
  Mutators.shrink[target] = Math.max(SHRINK_MIN, Mutators.shrink[target] - SHRINK_PER_HIT);
  refreshSize(target);
}

// ---- Fire hook: near misses (X44) ----
function suppressTarget(id) {
  if (Mutators.suppressed[id] <= 0) setMutatorStat(id, STAT.SPREAD, SUPPRESS_SPREAD);
  Mutators.suppressed[id] = SUPPRESS_SECONDS;
  Damage.lastDamageTime[id] = Sim.time;     // delays health regeneration
}
function passesNear(shot, id) {
  const vx = Actors.x[id] - shot.x, vy = Actors.y[id] + 1 - shot.y, vz = Actors.z[id] - shot.z;
  const along = vx * shot.dx + vy * shot.dy + vz * shot.dz;
  if (along < 1 || along > SUPPRESS_RANGE) return false;
  return vx * vx + vy * vy + vz * vz - along * along <= SUPPRESS_REACH * SUPPRESS_REACH;
}
function onFireSuppress(fx, shot) {
  if (!fx.suppression || shot.weaponClass === 'melee') return;
  for (let id = 0; id < Actors.count; id++) {
    if (id === shot.id || !Actors.alive[id] || !Actors.isEnemy(shot.id, id)) continue;
    if (passesNear(shot, id)) suppressTarget(id);
  }
}

// ---- Step hooks (one sim system, order 85) ----
function onStepTimeScale(fx, dt) {
  if (Mutators.slowmoLeft > 0) Mutators.slowmoLeft = Math.max(0, Mutators.slowmoLeft - dt);
  Sim.timeScale = (fx.timeScale === undefined ? 1 : fx.timeScale) * (Mutators.slowmoLeft > 0 ? SLOWMO_FACTOR : 1);
}
function onStepRegeneration(fx, dt) {
  if (!fx.regen) return;
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id] || (Actors.flags[id] & ACTOR_FLAG.DOWNED)) continue;
    if (Actors.health[id] < Actors.maxHealth[id]) Actors.health[id] = Math.min(Actors.maxHealth[id], Actors.health[id] + fx.regen * dt);
  }
}
function onStepSuppression(fx, dt) {
  if (!fx.suppression) return;
  for (let id = 0; id < Actors.count; id++) {
    if (Mutators.suppressed[id] <= 0) continue;
    Mutators.suppressed[id] = Math.max(0, Mutators.suppressed[id] - dt);
    if (Mutators.suppressed[id] === 0) setMutatorStat(id, STAT.SPREAD, 1);
  }
}
function onStepTags(fx, dt) { if (fx.tags) TagPool.step(dt, touchTag); }
function onStepGifts(fx, dt) { if (fx.lastGift) GiftPool.step(dt, detonateGift); }
function onStepSuperPowerups(fx) {
  if (!fx.superPowerups || !CAT.powerups || Sim.time < Mutators.nextSuperPowerup) return;
  Mutators.nextSuperPowerup = Sim.time + fx.superPowerups;
  const item = Rng.rules.pick(CAT.powerups).id;
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id]) continue;
    GRANT_EVENT.id = id;
    GRANT_EVENT.item = item;
    Bus.emit('item.grant', GRANT_EVENT);
  }
}

const MUTATOR_HOOKS = {
  spawn: [onSpawnReset, onSpawnHealth, onSpawnShield, onSpawnMirror, onSpawnPower],
  kill: [onKillGift, onKillTag, onKillSlowmo, onKillTriangle, onKillGrowth],
  damage: [onDamageLifesteal, onDamageShrink],
  fire: [onFireSuppress],
  step: [onStepTimeScale, onStepRegeneration, onStepSuppression, onStepTags, onStepGifts, onStepSuperPowerups],
};
for (const kind in MUTATOR_HOOKS) for (const hook of MUTATOR_HOOKS[kind]) Mutators.addHook(kind, hook);
Sim.addSystem('mutators', MUTATOR_STEP_ORDER, (dt) => runHooks('step', dt));

// ---- Match lifecycle ----
function powerNamesOf() {
  if (!CAT.abilities) return [];
  return CAT.abilities.filter((row) => {
    const number = Number(String(row.code).slice(1));
    return number >= POWER_FIRST && number <= POWER_LAST;
  }).map((row) => row.id);
}
// Fills the reserved weapon set row with the match's weapon list: melee first, then up to two guns, as the spawn loadout.
function fillMatchSet(keys) {
  const row = CAT.weaponSets.byId(MATCH_SET_ID);
  const melee = keys.filter((key) => CAT.weapons.byId(key).class === 'melee');
  const guns = keys.filter((key) => CAT.weapons.byId(key).class !== 'melee');
  row.weapons = keys.slice();
  row.start = melee.slice(0, 1).concat(guns.slice(0, 2));
}
function emptyMatchSet() {
  const row = CAT.weaponSets.byId(MATCH_SET_ID);
  row.weapons = MATCH_SET_PLACEHOLDER.slice();
  row.start = MATCH_SET_PLACEHOLDER.slice();
}
function startMutators(match) {
  const rules = match.rules;
  Mutators.rules = rules;
  Mutators.fx = rules.fx && Object.keys(rules.fx).length ? rules.fx : null;   // later stages (difficulty) may add fx.timeScale too
  Mutators.slowmoLeft = 0;
  Mutators.nextSuperPowerup = rules.fx && rules.fx.superPowerups ? rules.fx.superPowerups : 0;
  Mutators.powerNames = Mutators.fx && Mutators.fx.powers ? powerNamesOf() : [];
  TagPool.clear();
  GiftPool.clear();
  Sim.timeScale = Mutators.fx && Mutators.fx.timeScale ? Mutators.fx.timeScale : 1;
  if (rules.weaponSet === MATCH_SET_ID && rules.fx && rules.fx.weaponList) fillMatchSet(rules.fx.weaponList);
}
function stopMutators() {
  Mutators.rules = null;
  Mutators.fx = null;
  Sim.timeScale = 1;
  emptyMatchSet();
  Hitbox.sizeScale.fill(1);
  Hitbox.headScale.fill(HEAD_SIZE_DEFAULT);
  Mutators.suppressed.fill(0);
  Weapons.mutatorScale.fill(1);
}
Bus.on('match.setup', startMutators);
Bus.on('match.stop', stopMutators);
Bus.on('actor.create', (id) => {
  resetSize(id);
  Mutators.suppressed[id] = 0;
  Weapons.mutatorScale.fill(1, id * WEAPON_STAT_COUNT, (id + 1) * WEAPON_STAT_COUNT);
  if (Mutators.fx && Mutators.fx.triangle) setMutatorStat(id, STAT.RESERVE, TRIANGLE_RESERVE_SCALE);   // before the first loadout is given
});
Bus.on('actor.spawn', (event) => runHooks('spawn', event.id));
Bus.on('kill', (event) => runHooks('kill', event));
Bus.on('damage', (event) => runHooks('damage', event));
Bus.on('weapon.fire', (shot) => runHooks('fire', shot));

// Size changes (X31, X39) also scale the drawn body; chained after any hook an earlier section installed.
const previousActorStyle = Render.actorStyle;
Render.actorStyle = (id, style) => {
  if (previousActorStyle) previousActorStyle(id, style);
  style.scale *= Hitbox.sizeScale[id];
};

// Confirm tags (X42) are drawn as small yellow plates above the floor, live last gifts (X29) as red balls that blink faster before the blast.
Render.addSource('tags', (batch) => {
  if (!Mutators.fx || !Mutators.fx.tags) return;
  for (let slot = 0; slot < MAX_TAGS; slot++) {
    if (TagPool.timer[slot] <= 0) continue;
    batch.mesh('box', TagPool.x[slot], TagPool.y[slot] + 0.1 * Math.sin(Sim.time * 4), TagPool.z[slot], Sim.time * 2, 0, 0.18, 0.28, 0.04, 1, 0.85, 0.2, 0.6);
  }
});
Render.addSource('gifts', (batch) => {
  if (!Mutators.fx || !Mutators.fx.lastGift) return;
  for (let slot = 0; slot < MAX_GIFTS; slot++) {
    const left = GiftPool.timer[slot];
    if (left <= 0) continue;
    const blinkRate = GIFT_BLINK_SLOW + GIFT_BLINK_FAST * (1 - left / GIFT_FUSE_SECONDS);
    const lit = Math.sin(Sim.time * blinkRate) > 0 ? 1 : 0.25;
    batch.mesh('sphere', GiftPool.x[slot], GiftPool.y[slot], GiftPool.z[slot], 0, 0, GIFT_DRAW_SIZE, GIFT_DRAW_SIZE, GIFT_DRAW_SIZE, 1, 0.2, 0.1, lit);
  }
});
