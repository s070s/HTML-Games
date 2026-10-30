// Balance harness (P8-04, test build only; group 'balance', batch runner tools/balance.mjs, plan tools/balance-plan.mjs).
// T1 forced loadouts and grants (setup bot entries: loadout / grant), T2 seeded rosters and mirrors, T3 the metrics collector (keys are
// '<catalogue>:<code>' because two ids are shared across catalogues), T4 A / B overrides, T7 the static checks S1..S7 (fast blocks of the
// default suite). __CTK.balance.run(spec) plays one run and returns its record; the runner collects the records as JSON lines.

const BALANCE_SAMPLE_TICKS = 4;                  // the drawn weapon and alive time are sampled every 4th tick (30 Hz)
const BALANCE_EDGES = [3, 8, 10, 15, 25, 50];    // m: kill and death distance buckets are <3, 3-8, 8-10, 10-15, 15-25, 25-50, 50+
const BALANCE_TOUCH_SECONDS = 5;                 // M6: an enemy touched by a use must die to the user's side within this time
const BALANCE_STATUS_WINDOW = 8;                 // s: a status without a row name counts for the user's latest use inside this window
const BALANCE_ID_ORDER = [['gadget', 'gadgets'], ['ability', 'abilities'], ['weapon', 'weapons'], ['item', 'items'], ['powerup', 'powerups']];
const BALANCE_SLOT_CATALOGUE = { melee: 'weapons', secondary: 'weapons', primary: 'weapons', lethal: 'gadgets', tactical: 'gadgets', device: 'gadgets',
  ability1: 'abilities', ability2: 'abilities', ultimate: 'abilities', hero: 'heroes' };
const BALANCE_PERSISTENT_WINDOW = 60;           // s: the window a persistent powerup (no timer) is judged over
const BALANCE_SEED_SALT = 'balance-roster:';

// P8-01 as data (the page returns it; tools/balance.mjs compares the runs with it). Bands are [low, high]; null = open.
const BALANCE_TARGETS = {
  rule: { minEngagements: 150, minUses: 40, minDecided: 16, tolerance: 'a row fails when its whole 95 % interval lies outside the band; watch when only the point value does' },
  // class: ewr per row, mean = class mean, home / away EWR (percent), kri per row, held share of carriers (percent)
  weapons: {
    melee: { ewr: [35, 55], mean: [40, 50], home: [55, null], away: null, kri: [0.6, 1.5], held: [3, 20], homeBuckets: [0, 0] },
    sidearm: { ewr: [40, 55], mean: [42, 50], home: [50, null], away: [null, 50], kri: [0.7, 1.3], held: [5, 35] },
    smg: { ewr: [42, 58], mean: [45, 55], home: [55, null], away: [null, 45], kri: [0.7, 1.4], held: [50, null] },
    shotgun: { ewr: [42, 58], mean: [45, 55], home: [60, null], away: [null, 40], kri: [0.7, 1.4], held: [50, null], homeBuckets: [0, 1], awayBuckets: [4, 6] },
    rifle: { ewr: [45, 58], mean: [47, 55], home: [52, null], away: [null, 48], kri: [0.8, 1.3], held: [50, null] },
    marksman: { ewr: [42, 58], mean: [45, 55], home: [55, null], away: [null, 45], kri: [0.7, 1.4], held: [50, null] },
    sniper: { ewr: [40, 58], mean: null, home: [58, null], away: [null, 40], kri: [0.6, 1.4], held: [50, null], homeBuckets: [5, 6], awayBuckets: [0, 2] },
    energy: { ewr: [42, 58], mean: [45, 55], home: [55, null], away: [null, 45], kri: [0.7, 1.4], held: [50, null] },
    heavy: { ewr: [45, 60], mean: [47, 57], home: [55, null], away: [null, 45], kri: [0.8, 1.5], held: [50, null] },
    explosive: { ewr: [42, 58], mean: [45, 55], home: [55, null], away: [null, 45], kri: [0.7, 1.4], held: [40, null] },
    exotic: { ewr: [40, 58], mean: null, home: [55, null], away: null, kri: [0.6, 1.4], held: [40, null] },
    power: { kd: [2, 6] },
  },
  classRules: { meleeKillShare: [3, 12], meleeKillShareRS08: [10, 25], sidearmKillShareMax: 25, sniperKillShareMax: 20, explosiveSelfDamageMax: 15,
    splashKillShareMax: 30, powerKillShare: [5, 15], powerTopScorerShareMax: 40 },
  rulesetEwr: [35, 65], rulesetClassSpread: 20, skillGap: 15,
  // revised 2026-10-30 (coordinator): the home / away columns above stay as the data the runs report; the pass rule is the range edge
  rangeEdge: { homeMin: 45, rowMin: 0, classMin: 5 },
  // pick shares in percent of the slot (primary: multiples of the fair share)
  picks: { primary: [0.4, 2.5], secondary: [10, 62], lethal: [13, 83], tactical: [6.7, 42], device: [5, 31], ability: [1.5, 9.6], ultimate: [10, 62], favouriteMax: 2 },
  csi: [0.42, 0.58], abilityEwr: [45, 55],
  gadgets: {
    lethal: { use: 0.6, kp: [20, 50] }, tactical: { use: 0.5, kp: [15, 45] }, device: { use: 0.7, kp: [10, 40] },
    // revised 2026-10-30 (coordinator): a bot's throw lands on a hidden or moving target, so the enemy damage per throw is judged from 10 (it was 40 / 30 / 50 for a player's throw)
    lethalDamage: { frag: [10, 100], incendiary: [10, 90], sticky: [10, 110] }, ownDamageMax: 10, tacticalTouched: 1.0,
  },
  powerups: { kd: [1.3, 3.0], kdWide: [1.3, 4.0], wide: ['fury', 'sigil'], topShareMax: 35 },
  abilities: { use: [0.3, 1.0], kp: { recon: [15, 40], control: [20, 50], offense: [20, 50], ultimate: [30, 70] }, reveal: 0.8, affected: 1.0, healed: 60 },
  profileCsiSpread: 0.15, heroCsi: [0.40, 0.60], heroEwr: [40, 60], heroRoleMean: [45, 55],
  fairness: {
    sideWin: [45, 55], sideWinTolerance: [40, 60], sideWinMean: [47, 53], scoreShare: [45, 55], attackerRound: [42, 58], attackerMatch: [35, 65],
    infectionHumans: [30, 60], fiendsRavager: [35, 65], markedShareMax: 2, paceScoreEnd: [0.5, 1.0], paceLeader: 0.8, roundClock: [0.4, 1.0],
    spawnDeathShare: 5, spawnDeathShareArena: 8, spawnPointMax: 2, comeback: [15, 40], rulesetPace: [0.6, 1.6],
    horde: { regular: 60, hardMax: 60, endlessWave10: 50 }, unperceived: 0,
  },
};

let balanceRun = null;            // the running case: every hook below passes straight through while it is null
const balanceBase = { startKeys: Weapons.startKeys, loadoutGear: Gadgets.loadoutGear, botChoice: Abilities.botChoice, wantedHero: Abilities.wantedHero.bind(Abilities),
  addStatus: Damage.addStatus.bind(Damage) };

function balanceFind(name, text) {
  const catalogue = CAT[name];
  return catalogue.byId(text) || catalogue.find((row) => row.code === text) || null;
}
const balanceKey = (kind, row) => kind + ':' + row.code;
const balanceRowOfKey = (key) => {
  const kind = key.slice(0, key.indexOf(':')), code = key.slice(key.indexOf(':') + 1), entry = BALANCE_ID_ORDER.find((pair) => pair[0] === kind);
  return entry ? CAT[entry[1]].find((row) => row.code === code) || null : null;
};

// What a weapon / damage / kill event names (an id) as '<catalogue>:<code>'; a gun in the killer's hand wins over a gadget or ability of the same id.
function balanceKeyOfId(id, killer) {
  const held = killer >= 0 ? Weapons.currentWeapon(killer) : null;
  if (held && held.id === id) return balanceKey('weapon', held);
  for (const [kind, name] of BALANCE_ID_ORDER) {
    const row = CAT[name].byId(id);
    if (row) return balanceKey(kind, row);
  }
  return 'other:' + id;
}

// T1: the loadout of a setup entry with every slot turned into catalogue ids (codes are accepted).
function balanceNormalize(loadout) {
  const forced = {};
  for (const slot in loadout || {}) {
    if (!loadout[slot]) continue;
    if (slot === 'only') { forced.only = loadout.only.map((text) => balanceFind('weapons', text).id); continue; }
    const name = BALANCE_SLOT_CATALOGUE[slot];
    const row = name ? balanceFind(name, loadout[slot]) : null;
    if (!row) throw new Error('balance: unknown ' + slot + ' ' + loadout[slot]);
    forced[slot] = row.id;
  }
  return forced;
}
const balanceForcedFor = (id) => (balanceRun ? balanceRun.forcedOf[id] || null : null);

// The spawn guns with the forced picks laid over them: a slot replaces the gun of its class, a primary is drawn last.
function balanceGunKeys(keys, forced) {
  if (forced.only) return forced.only.slice();
  const result = keys.slice();
  for (const slot of ['melee', 'secondary', 'primary']) {
    if (!forced[slot]) continue;
    const index = result.findIndex((key) => {
      const weaponClass = CAT.weapons.byId(key).class;
      return slot === 'melee' ? weaponClass === 'melee' : slot === 'secondary' ? weaponClass === 'sidearm' : weaponClass !== 'melee' && weaponClass !== 'sidearm';
    });
    if (index >= 0) result[index] = forced[slot]; else if (slot === 'primary') result.push(forced[slot]); else result.unshift(forced[slot]);
  }
  const drawn = result.indexOf(forced.primary);
  if (drawn >= 0 && drawn !== result.length - 1) result.push(result.splice(drawn, 1)[0]);
  return result;
}
Weapons.startKeys = (id) => {
  const keys = balanceBase.startKeys(id), forced = balanceForcedFor(id);
  return forced ? balanceGunKeys(keys, forced) : keys;
};
Gadgets.loadoutGear = (id) => {
  const gear = balanceBase.loadoutGear(id), forced = balanceForcedFor(id);
  if (!gear || !forced) return gear;
  return { lethal: forced.lethal || gear.lethal, tactical: forced.tactical || gear.tactical, device: forced.device || gear.device };
};
Abilities.botChoice = (id, kit, slotName) => {
  const forced = balanceForcedFor(id);
  if (forced && forced[slotName] && kit.choices && kit.choices[slotName] && kit.choices[slotName].includes(forced[slotName])) return forced[slotName];
  return balanceBase.botChoice(id, kit, slotName);
};
Abilities.wantedHero = (id) => {
  const forced = balanceForcedFor(id);
  return forced && forced.hero ? CAT.heroes.byId(forced.hero) : balanceBase.wantedHero(id);
};
// T3: a status counts as a touch of the source's latest use (no row name travels with it).
Damage.addStatus = (id, key, source, seconds, stacks) => {
  if (balanceRun && source >= 0) balanceTouch(balanceRun, source, id, '');
  return balanceBase.addStatus(id, key, source, seconds, stacks);
};

// T4: 'weapons.shardcaster.reload' / 'abilities.scoutdrone.botUse.chance': sets a catalogue row field (nested) for one run; returns the undo list.
function balanceApplyOverrides(overrides) {
  const undo = [];
  for (const path in overrides || {}) {
    const parts = path.split('.'), row = parts[0] === 'botGadgetUse' ? BOT_GADGET_USE[parts[1]] : balanceFind(parts[0], parts[1]);   // botGadgetUse.<effect>.<field>: the bot rule table of 03g
    if (!row) throw new Error('balance: unknown override row ' + path);
    let target = row;
    for (let i = 2; i < parts.length - 1; i++) target = target[parts[i]];
    const field = parts[parts.length - 1];
    undo.push({ target, field, value: target[field] });
    target[field] = overrides[path];
  }
  return undo;
}
const balanceUndoOverrides = (undo) => { for (let i = undo.length - 1; i >= 0; i--) undo[i].target[undo[i].field] = undo[i].value; };

// T2: the bot list of a run: profiles drawn once per seed (the same list for a mirror), teams alternate and swap on a mirror, forced picks on a few bots of side A.
function balanceRoster(spec) {
  const random = makeRandom(hashString(BALANCE_SEED_SALT + spec.seed)), rows = CAT.bots.slice(), bots = [];
  const teams = CAT.modes.byId(spec.mode).teams === 2;
  while (bots.length < spec.botCount) {
    random.shuffle(rows);
    for (const row of rows) if (bots.length < spec.botCount) bots.push({ profile: row.id });
  }
  const step = teams ? 2 : 1;
  bots.forEach((entry, index) => {
    if (teams) entry.team = (index % 2) ^ (spec.mirror ? 1 : 0);
    if (spec.tier !== undefined) entry.tier = spec.tier;
    if (spec.profiles === false) delete entry.profile;
  });
  const count = spec.forcedCount === undefined ? 3 : spec.forcedCount;
  for (let n = 0; n < count && n * step < bots.length; n++) {
    const loadout = Object.assign({}, spec.forced || {});
    if (spec.forcedPick) Object.assign(loadout, balancePickGun(random, spec.forcedPick));
    if (Object.keys(loadout).length) bots[n * step].loadout = loadout;
    if (spec.grant) bots[n * step].grant = spec.grant;
  }
  return bots;
}

// A seeded gun of one of the named weapon classes, as the loadout slot its class fills.
function balancePickGun(random, classes) {
  const weaponClass = random.pick(classes);
  const members = CAT.weapons.filter((row) => row.class === weaponClass && row.botSpawn > 0 && row.id !== 'daybreak' && row.id !== 'halcyon');
  const row = random.pick(members);
  return { [weaponClass === 'melee' ? 'melee' : weaponClass === 'sidearm' ? 'secondary' : 'primary']: row.code };
}

// ---- T3 the collector ----
function balanceRowStats(run, key) {
  let stats = run.rows[key];
  if (!stats) {
    stats = { kills: 0, killsHome: 0, killsAway: 0, killDistance: [0, 0, 0, 0, 0, 0, 0], deaths: 0, deathsHome: 0, deathsAway: 0, deathDistance: [0, 0, 0, 0, 0, 0, 0],
      damage: 0, enemyDamage: 0, selfDamage: 0, teamDamage: 0, splashKills: 0, shots: 0, owned: 0, drawn: 0, uses: 0, usesForced: 0, kpUses: 0, kpUsesForced: 0, touched: 0,
      touchedForced: 0, picks: 0 };
    run.rows[key] = stats;
  }
  return stats;
}
const balanceBucket = (distance) => { let n = 0; while (n < BALANCE_EDGES.length && distance >= BALANCE_EDGES[n]) n++; return n; };
function balanceActorDistance(a, b) {
  return a >= 0 && b >= 0 ? length3(Actors.x[a] - Actors.x[b], Actors.y[a] - Actors.y[b], Actors.z[a] - Actors.z[b]) : -1;
}
const balanceTracked = (id) => Actors.kind[id] === ACTOR_KIND.BOT;
function balanceSide(id) { return Actors.team[id] >= 0 ? 't' + Actors.team[id] : 'a' + id; }

// A touch of an enemy by the source's latest use (the row named, else any inside the status window): the victim's next death inside 5 s credits the use.
function balanceTouch(run, source, victim, key) {
  if (source === victim || !balanceTracked(source) || !Actors.isEnemy(source, victim)) return;
  let use = null;
  if (key) use = run.uses.byActorKey.get(source + '|' + key) || null;
  else {
    const window = Sim.time - BALANCE_STATUS_WINDOW;
    use = run.uses.latest[source];
    if (use && use.time < window) use = null;
  }
  if (!use) return;
  if (!use.touchedBy.has(victim)) { use.touchedBy.set(victim, Sim.time); use.enemies++; }
  else use.touchedBy.set(victim, Sim.time);
  run.touches[victim].push(use);
}
function balanceOnUse(run, id, key) {
  if (id < 0 || id >= MAX_ACTORS || !balanceTracked(id)) return;
  const use = { actor: id, key, time: Sim.time, touchedBy: new Map(), enemies: 0, converted: false, forced: !!run.forcedOf[id] };
  run.uses.list.push(use);
  run.uses.latest[id] = use;
  run.uses.byActorKey.set(id + '|' + key, use);
  const stats = balanceRowStats(run, key);
  stats.uses++;
  if (use.forced) stats.usesForced++;
}
function balanceOnDamage(event) {
  const run = balanceRun;
  if (!run) return;
  const source = event.source, target = event.target, amount = event.amount;
  if (source < 0 || amount <= 0) return;
  const key = balanceKeyOfId(event.weapon, source), stats = balanceRowStats(run, key);
  stats.damage += amount;
  if (source === target) stats.selfDamage += amount;
  else if (Actors.isAlly(source, target)) stats.teamDamage += amount;
  else {
    stats.enemyDamage += amount;
    if (key.startsWith('gadget:') || key.startsWith('ability:')) balanceTouch(run, source, target, key);
  }
}
function balanceOnKill(event) {
  const run = balanceRun;
  if (!run) return;
  const victim = event.victim, killer = event.killer, now = Sim.time;
  run.totals.deaths++;
  const since = now - Math.max(run.spawnTime[victim], Modes.protectUntil[victim]);
  if (since >= 0 && since <= 3) run.totals.spawnDeaths++;
  if (now - run.spawnTime[victim] <= 5) {
    const point = run.spawnKey[victim];
    run.spawnPoints[point] = (run.spawnPoints[point] || 0) + 1;
  }
  const enemyKill = killer >= 0 && killer !== victim && Actors.isEnemy(killer, victim);
  if (enemyKill) {
    run.totals.kills++;
    if (event.kind === 'melee') run.totals.meleeKills++;   // a melee weapon or the quick melee: the share of kills by hand
    if (Actors.team[killer] >= 0) run.totals.teamKills[Actors.team[killer]]++;
    const key = balanceKeyOfId(event.weapon, killer), stats = balanceRowStats(run, key), distance = balanceActorDistance(killer, victim);
    const weapon = key.startsWith('weapon:') ? balanceRowOfKey(key) : null;
    stats.kills++;
    if (event.kind === 'splash') stats.splashKills++;
    if (distance >= 0) {
      stats.killDistance[balanceBucket(distance)]++;
      if (weapon) { if (distance >= weapon.botPref.range[0] && distance <= weapon.botPref.range[1]) stats.killsHome++; else stats.killsAway++; }
    }
    if (run.tracked[killer]) run.kills[killer]++;
    if (run.grant && run.forcedOf[killer] && now - run.spawnTime[killer] <= run.grantTotals.window) run.grantTotals.kills++;
  }
  if (run.grant && run.forcedOf[victim] && enemyKill && now - run.spawnTime[victim] <= run.grantTotals.window) run.grantTotals.deaths++;
  const drawn = Weapons.currentWeapon(victim);
  if (drawn && enemyKill && balanceTracked(victim)) {
    const stats = balanceRowStats(run, balanceKey('weapon', drawn)), distance = balanceActorDistance(killer, victim);
    stats.deaths++;
    if (distance >= 0) {
      stats.deathDistance[balanceBucket(distance)]++;
      if (distance >= drawn.botPref.range[0] && distance <= drawn.botPref.range[1]) stats.deathsHome++; else stats.deathsAway++;
    }
  }
  if (balanceTracked(victim)) run.deathsOf[victim]++;
  if (killer >= 0) for (const use of run.touches[victim]) {
    const touchedAt = use.touchedBy.get(victim);
    if (!use.converted && touchedAt !== undefined && now - touchedAt <= BALANCE_TOUCH_SECONDS && (Actors.isAlly(use.actor, killer) || use.actor === killer)) {
      use.converted = true;
    }
  }
  run.touches[victim].length = 0;
}
function balanceOnSpawn(id) {
  const run = balanceRun;
  if (!run || !balanceTracked(id)) return;
  run.spawns[id]++;
  run.spawnTime[id] = Sim.time;
  run.spawnKey[id] = Math.round(Actors.x[id]) + ',' + Math.round(Actors.z[id]);
  const forced = run.forcedOf[id];
  if (forced) {
    if (forced.primary && !Weapons.has(id, forced.primary)) {
      Weapons.give(id, forced.primary, 0);
      Weapons.requestSwitch(id, CAT.weapons.byId(forced.primary).index);
    }
    if (run.grant && run.entryOf[id] && run.entryOf[id].grant) for (const key of run.grant) Items.giveKey(id, key);
  }
  for (let w = 0; w < WEAPON_COUNT; w++) if (Weapons.owned[id * WEAPON_COUNT + w]) balanceRowStats(run, balanceKey('weapon', CAT.weapons[w])).picks++;
  for (let g = 0; g < GADGET_COUNT; g++) if (Gadgets.count[id * GADGET_COUNT + g] > 0) balanceRowStats(run, balanceKey('gadget', CAT.gadgets[g])).picks++;
  for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot++) {
    const row = Abilities.row(id, slot);
    if (row) balanceRowStats(run, balanceKey('ability', row)).picks++;
  }
}
function balanceOnFire(event) {
  const run = balanceRun;
  if (run && balanceTracked(event.id)) {
    const weapon = CAT.weapons.byId(event.weapon);
    if (weapon) balanceRowStats(run, balanceKey('weapon', weapon)).shots++;
  }
}
Bus.on('damage', balanceOnDamage);
Bus.on('kill', balanceOnKill);
Bus.on('actor.spawn', (event) => balanceOnSpawn(event.id));
Bus.on('weapon.fire', balanceOnFire);
Bus.on('gadget.use', (event) => { if (balanceRun) { const row = CAT.gadgets.byId(event.gadget); if (row) balanceOnUse(balanceRun, event.id, balanceKey('gadget', row)); } });
Bus.on('ability.cast', (event) => { if (balanceRun) { const row = CAT.abilities.byId(event.ability); if (row) balanceOnUse(balanceRun, event.id, balanceKey('ability', row)); } });
Bus.on('pickup', (event) => {
  const run = balanceRun;
  if (!run) return;
  const row = CAT.items.byId(event.item) || CAT.powerups.byId(event.item);
  if (row) run.pickups[(CAT.items.byId(event.item) ? 'item:' : 'powerup:') + row.code] = (run.pickups[(CAT.items.byId(event.item) ? 'item:' : 'powerup:') + row.code] || 0) + 1;
});
Bus.on('actor.create', (id) => {
  const run = balanceRun;
  if (!run) return;
  const kind = Actors.kind[id];
  if (kind !== ACTOR_KIND.BOT && kind !== ACTOR_KIND.DUMMY) return;
  const entry = run.bots[run.created++] || null;
  run.entryOf[id] = entry;
  run.forcedOf[id] = entry ? entry.forced : null;
  run.tracked[id] = kind === ACTOR_KIND.BOT ? 1 : 0;
});

// The per-tick sample: alive time, owned and drawn weapons of every bot (no allocation).
function balanceSample(run) {
  const step = BALANCE_SAMPLE_TICKS;
  for (let id = 0; id < Actors.count; id++) {
    if (!run.tracked[id] || !Actors.alive[id]) continue;
    run.aliveTicks[id] += step;
    const base = id * WEAPON_COUNT;
    for (let w = 0; w < WEAPON_COUNT; w++) if (Weapons.owned[base + w]) run.ownedTicks[base + w] += step;
    const drawn = Weapons.current[id];
    if (drawn >= 0) run.drawnTicks[base + drawn] += step;
  }
}

function balanceBegin(spec) {
  const bots = balanceRoster(spec);
  for (const entry of bots) {
    entry.forced = entry.loadout || entry.grant ? balanceNormalize(entry.loadout) : null;
  }
  const run = {
    spec, bots, created: 0, entryOf: new Array(MAX_ACTORS).fill(null), forcedOf: new Array(MAX_ACTORS).fill(null), tracked: new Uint8Array(MAX_ACTORS),
    rows: {}, pickups: {}, uses: { list: [], latest: new Array(MAX_ACTORS).fill(null), byActorKey: new Map() }, touches: Array.from({ length: MAX_ACTORS }, () => []),
    aliveTicks: new Float64Array(MAX_ACTORS), ownedTicks: new Float64Array(MAX_ACTORS * WEAPON_COUNT), drawnTicks: new Float64Array(MAX_ACTORS * WEAPON_COUNT),
    spawns: new Uint16Array(MAX_ACTORS), spawnTime: new Float64Array(MAX_ACTORS), spawnKey: new Array(MAX_ACTORS).fill(''), spawnPoints: {},
    kills: new Uint16Array(MAX_ACTORS), deathsOf: new Uint16Array(MAX_ACTORS),
    totals: { kills: 0, deaths: 0, spawnDeaths: 0, meleeKills: 0, teamKills: [0, 0] }, grant: spec.grant ? spec.grant.map((key) => balanceFind('powerups', key).id) : null,
    grantTotals: { kills: 0, deaths: 0, window: spec.grant ? (spec.grant.length ? balanceFind('powerups', spec.grant[0]).duration : 0) || BALANCE_PERSISTENT_WINDOW / 2 : 0 },   // grant [] = the control: the same bots, nothing granted
    half: null, tick: 0,
  };
  return run;
}

function balanceTick(run) {
  run.tick++;
  if (run.tick % BALANCE_SAMPLE_TICKS === 0) balanceSample(run);
  const limit = Modes.rules ? Modes.rules.timeLimit : 0;
  if (!run.half && limit > 0 && Modes.active && Sim.time - Modes.startTime >= limit / 2) {
    run.half = { time: Sim.time, scores: Array.from(Modes.teamScore).slice(0, 2), rounds: Array.from(Modes.teamRounds).slice(0, 2) };
  }
}

// The run record: raw counts only; tools/balance.mjs turns them into rates and intervals.
function balanceFinish(run, stats) {
  const rows = run.rows;
  for (let id = 0; id < Actors.count; id++) {
    if (!run.tracked[id]) continue;
    for (let w = 0; w < WEAPON_COUNT; w++) {
      const owned = run.ownedTicks[id * WEAPON_COUNT + w], drawn = run.drawnTicks[id * WEAPON_COUNT + w];
      if (!owned && !drawn) continue;
      const row = balanceRowStats(run, balanceKey('weapon', CAT.weapons[w]));
      row.owned += owned / TICK_RATE; row.drawn += drawn / TICK_RATE;
    }
  }
  for (const use of run.uses.list) {
    const row = rows[use.key];
    row.touched += use.enemies;
    if (use.converted) row.kpUses++;
    if (use.forced) { row.touchedForced += use.enemies; if (use.converted) row.kpUsesForced++; }
  }
  const actors = [], order = [];
  for (let id = 0; id < Actors.count; id++) if (run.tracked[id]) order.push(id);
  order.sort((a, b) => Modes.score[b] - Modes.score[a] || Modes.kills[b] - Modes.kills[a] || Modes.deaths[a] - Modes.deaths[b]);
  order.forEach((id, rank) => {
    const profile = Actors.profile[id];
    actors.push({ id, team: Actors.team[id], profile: profile ? profile.code : '', tier: Bots.tierRow[id] ? Bots.tierRow[id].tier : -1, forced: !!run.forcedOf[id],
      spawns: run.spawns[id], alive: +(run.aliveTicks[id] / TICK_RATE).toFixed(1), kills: Modes.kills[id], deaths: Modes.deaths[id], score: Modes.score[id],
      percentile: order.length > 1 ? +(1 - rank / (order.length - 1)).toFixed(3) : 0.5, hero: Abilities.hero[id] ? Abilities.hero[id].code : '' });
  });
  const rules = Modes.rules;
  return { stats, rows, actors, pickups: run.pickups, totals: run.totals, spawnPoints: run.spawnPoints, half: run.half, grant: run.grantTotals,
    match: { ended: stats.ended, winner: stats.winner, reason: stats.reason, duration: +(Sim.time - Modes.startTime).toFixed(1),
      timeLimit: rules ? rules.timeLimit : 0, scoreLimit: rules ? rules.scoreLimit : 0, teams: rules ? rules.teams : 0, teamScore: Array.from(Modes.teamScore).slice(0, 2),
      teamRounds: Array.from(Modes.teamRounds).slice(0, 2), rounds: Modes.round, rulesetId: rules ? rules.id : '' },
    forcedTotals: balanceForcedTotals(run), powerHeld: balancePowerHeld(run) };
}
// The actors that owned a power weapon at any time (F4: did the match's top scorer hold it?).
function balancePowerHeld(run) {
  const held = [];
  for (let id = 0; id < Actors.count; id++) {
    if (!run.tracked[id]) continue;
    for (let w = 0; w < WEAPON_COUNT; w++) if (CAT.weapons[w].class === 'power' && run.ownedTicks[id * WEAPON_COUNT + w] > 0) { held.push(id); break; }
  }
  return held;
}
function balanceForcedTotals(run) {
  const totals = { actors: 0, spawns: 0, alive: 0, percentile: 0, kills: 0, deaths: 0 };
  const forced = [];
  for (let id = 0; id < Actors.count; id++) if (run.forcedOf[id] && run.tracked[id]) forced.push(id);
  const order = [];
  for (let id = 0; id < Actors.count; id++) if (run.tracked[id]) order.push(id);
  order.sort((a, b) => Modes.score[b] - Modes.score[a] || Modes.kills[b] - Modes.kills[a] || Modes.deaths[a] - Modes.deaths[b]);
  for (const id of forced) {
    totals.actors++; totals.spawns += run.spawns[id]; totals.alive += run.aliveTicks[id] / TICK_RATE; totals.kills += run.kills[id]; totals.deaths += run.deathsOf[id];
    totals.percentile += order.length > 1 ? 1 - order.indexOf(id) / (order.length - 1) : 0.5;
  }
  totals.alive = +totals.alive.toFixed(1);
  totals.percentile = totals.actors ? +(totals.percentile / totals.actors).toFixed(3) : 0;
  return totals;
}

// F4: the map row with its top item spot (the first Mega Cell, else Heavy Plate) turned into a pad of the named power weapon.
function balancePadMap(spec) {
  const base = typeof spec.map === 'string' ? Maps.get(spec.map) : spec.map;
  const items = base.items.map((item) => Object.assign({}, item));
  for (const pad of spec.pads) {
    const spot = items.find((item) => item.item === 'megacell') || items.find((item) => item.item === 'heavyplate');
    if (!spot) throw new Error('balance: no top item spot on ' + base.id);
    spot.item = balanceFind('weapons', pad.item).id; spot.group = MapRules.groupOf(spot.item);
  }
  return Object.assign({}, base, { items });
}

// One run: spec { mode, map, ruleset, minutes, botCount, seed, mirror, tier, forced {slot: code}, forcedCount, grant [powerup codes], overrides, modeOptions,
// teamMode, difficulty }. Returns the record (spec, record counts, wall time).
function balanceRunCase(input) {
  if (input.probe) return balanceProbe(input.probe);
  const spec = Object.assign({}, input, { botCount: input.botCount || CAT.modes.byId(input.mode).sizeDefault });
  if (spec.pads) spec.map = balancePadMap(spec);
  const started = performance.now(), run = balanceBegin(spec), undo = balanceApplyOverrides(spec.overrides);
  balanceRun = run;
  let record = null;
  try {
    const stats = playMatch({ mode: spec.mode, map: spec.map, ruleset: spec.ruleset, difficulty: spec.difficulty || 'regular', minutes: spec.minutes, bots: run.bots,
      seed: spec.seed, modeOptions: spec.modeOptions, mutators: spec.mutators, onTick: () => balanceTick(run), probe: (soak) => { record = balanceFinish(run, soak); } });
    record.stats = stats;
    if (spec.pads) record.stats.map = typeof input.map === 'string' ? input.map : spec.map.id;
  } finally {
    balanceRun = null;
    balanceUndoOverrides(undo);
  }
  record.wallMs = Math.round(performance.now() - started);
  record.spec = { mode: spec.mode, map: spec.map, ruleset: spec.ruleset, seed: spec.seed, mirror: !!spec.mirror, botCount: spec.botCount, minutes: spec.minutes,
    forced: spec.forced || null, forcedPick: spec.forcedPick || null, grant: spec.grant || null, overrides: spec.overrides || null, tier: spec.tier === undefined ? null : spec.tier };
  return record;
}

// F1 / F0 probes: one page call, no match. static1..static7 are the T7 checks; lob is F0-13 (the lobbed shots' miss distance).
function balanceProbe(name) {
  if (name.startsWith('static')) {
    const result = balanceStatics()['S' + name.slice(6)];
    return { probe: name, ok: result.ok, detail: result.detail, data: result.data || null };
  }
  if (name === 'lob') return balanceLobProbe();
  return { probe: name, ok: true, detail: 'no probe ' + name };
}

// F0-13: a lobbed shot fired with the crosshair on the floor 10, 20 and 30 m ahead: how far from that point does it land (horizontal, m)?
const BALANCE_LOB_SHOTS = [['W32 primary', 'pitcher', BTN.FIRE, 0.1], ['W34 primary', 'gloop', BTN.FIRE, 0.1], ['W21 alt', 'shardcaster', BTN.ALT, 0.1], ['W27 primary', 'talonbow', BTN.FIRE, 1]];
const BALANCE_LOB_DISTANCES = [10, 20, 30];
const BALANCE_LOB_SECONDS = 6;
const BALANCE_LOB_GROUND = 0.11;                 // m: a projectile this low has landed
function balanceLobLanding(key, button, hold, distance) {
  TestArena.start({}, []);
  const id = TestArena.actor(1, 0, 0, 0), weapon = giveFull(id, key);
  Actors.pitch[id] = Actors.aimPitch[id] = -Math.atan2(Actors.eyeY(id), distance);
  Actors.yaw[id] = Actors.aimYaw[id] = 0;
  Actors.buttons[id] = button;
  let last = null, fired = false;
  for (let tick = 0; tick < BALANCE_LOB_SECONDS * TICK_RATE; tick++) {
    Sim.step();
    if (tick === Math.round(hold * TICK_RATE)) Actors.buttons[id] = 0;
    let flying = false;
    for (let i = 0; i < PROJECTILE_CAP; i++) {
      if (Projectiles.state[i] === PROJECTILE_STATE.FREE || Projectiles.owner[i] !== id) continue;
      flying = true; fired = true;
      last = { x: Projectiles.x[i], y: Projectiles.y[i], z: Projectiles.z[i] };
    }
    if (fired && (!flying || last.y <= BALANCE_LOB_GROUND)) break;   // the first touch of the floor, before any bounce
  }
  TestArena.finish();
  return last && weapon ? +length2(last.x, last.z - distance).toFixed(2) : -1;
}
function balanceLobProbe() {
  const misses = {}, undo = balanceApplyOverrides({ 'weapons.gloop.primary.spreadDeg': 0 });   // spread at a grazing angle moves the floor point by metres
  for (const [label, key, button, hold] of BALANCE_LOB_SHOTS) misses[label] = BALANCE_LOB_DISTANCES.map((distance) => balanceLobLanding(key, button, hold, distance));
  balanceUndoOverrides(undo);
  return { probe: 'lob', ok: true, detail: 'miss in m at ' + BALANCE_LOB_DISTANCES.join(' / ') + ' m', data: misses };
}

// A debugging aid for a shot that leaves without a trigger: logs every buffered press and every buffered answer of one actor (read with trace.log).
const balanceTraceLog = [];
function balanceTrace(id) {
  const take = Weapons.takeBufferedPress.bind(Weapons), buffer = Weapons.bufferPress.bind(Weapons);
  Weapons.takeBufferedPress = (actor, ...rest) => { const answered = take(actor, ...rest); if ((id < 0 || actor === id) && answered) balanceTraceLog.push('answered a' + actor + ' ' + Sim.time.toFixed(3)); return answered; };
  Weapons.bufferPress = (actor, button, bit) => { const before = Weapons.pressBuffer[actor]; buffer(actor, button, bit); if ((id < 0 || actor === id) && Weapons.pressBuffer[actor] !== before) balanceTraceLog.push('buffer a' + actor + ' ' + before + '->' + Weapons.pressBuffer[actor] + ' ' + Sim.time.toFixed(3) + ' wait ' + Move.fireWait(actor).toFixed(3)); };
  return balanceTraceLog;
}

DebugApi.balance = { trace: balanceTrace, time: () => Sim.time, shotState: (id) => ({ fireWait: +Move.fireWait(id).toFixed(3), buffer: Weapons.pressBuffer[id], bufferLeft: +Weapons.pressBufferLeft[id].toFixed(3), state: Weapons.state[id], stateTime: +Weapons.stateTime[id].toFixed(3), sprint: Motion.sprinting[id], latch: Weapons.latch[id], nextShot: +Weapons.nextShot[id].toFixed(3) }), run: balanceRunCase, targets: () => BALANCE_TARGETS, statics: () => balanceStatics(), key: balanceKeyOfId };

// ---- T7 the static checks S1..S7 (no match): the data against P8-01 ----
const BALANCE_PICK_TIERS = [2, 3];                       // Regular bots play tier 2 or 3 (a named bot is held inside the difficulty's range)
const BALANCE_VERSUS_CATEGORIES = ['arena', 'tactical', 'large'];
const BALANCE_TASTE_STEPS = 8;                           // the fight-distance taste span (BOT_FIGHT_TASTE) is walked in this many even steps

function balanceMapSide(map) { return Math.max(map.size[0], map.size[2]); }
function balanceVersusMaps() { return CAT.maps.filter((map) => BALANCE_VERSUS_CATEGORIES.includes(map.category)); }
// Draw shares of a gun slot over every (profile, map) pair whose profile has no favourite for the slot (a favourite takes the loadout, S4 judges those):
// the botSpawn-weighted pool at the pair's fight distance. uniform = the share a plain draw over the same pool would give (the fair share the primary
// band is measured against, so a row left out of a pool, or down-weighted, shows as a low ratio).
function balanceGunShares(slot) {
  const options = pickupSlotOptions(slot), share = {}, uniform = {};
  options.forEach((key) => { share[key] = 0; uniform[key] = 0; });
  const maps = balanceVersusMaps();
  let contexts = 0;
  for (const profile of CAT.bots.concat([null])) for (const map of maps) for (let step = 0; step < BALANCE_TASTE_STEPS; step++) {
    if (profile && options.includes(profile.favorite)) continue;
    contexts++;
    const taste = BOT_FIGHT_TASTE[0] + (BOT_FIGHT_TASTE[1] - BOT_FIGHT_TASTE[0]) * step / (BALANCE_TASTE_STEPS - 1);
    const distance = botStyleFightDistance(profile ? profile.style : '', balanceMapSide(map), taste), pool = botGunPool(slot, distance);
    const weight = pool.reduce((sum, weapon) => sum + weapon.botSpawn, 0);
    for (const weapon of pool) { uniform[weapon.id] += 1 / pool.length; share[weapon.id] += weapon.botSpawn / weight; }
  }
  for (const key of options) { share[key] /= contexts; uniform[key] /= contexts; }
  return { share, uniform };
}
function balanceGadgetShares(slot) {
  const options = pickupSlotOptions(slot), share = {};
  options.forEach((key) => { share[key] = 0; });
  const tiers = CAT.bots.map((row) => clamp(row.tier, BALANCE_PICK_TIERS[0], BALANCE_PICK_TIERS[1])).concat(BALANCE_PICK_TIERS);
  for (const tier of tiers) {
    const row = CAT.botTiers[tier], weights = options.map((key) => {
      const effect = CAT.gadgets.byId(key).effect, use = BOT_GADGET_USE[effect];
      return effect === 'barrier' || !use || (use.tierFlag && !row[use.tierFlag]) ? 0 : use.chance;
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    options.forEach((key, index) => { share[key] += (total > 0 ? weights[index] / total : index === 0 ? 1 : 0) / tiers.length; });
  }
  return { share };
}
function balanceAbilityShares(slotName) {
  const options = CAT.abilityKits.byId('loadout').choices[slotName], share = {};
  const weights = options.map((key) => { const use = CAT.abilities.byId(key).botUse; return use && use.chance > 0 ? use.chance : 0; });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  options.forEach((key, index) => { share[key] = weights[index] / total; });
  return { share };
}
const balanceCode = (key) => (CAT.weapons.byId(key) || CAT.gadgets.byId(key) || CAT.abilities.byId(key)).code;

function balanceStatics() {
  const out = {}, percent = (value) => +(value * 100).toFixed(1);
  // S1: every combat class has a target row (the TTK values themselves are the 'content' group's check)
  const noTarget = CAT.weapons.filter((row) => row.class !== 'tool' && !BALANCE_TARGETS.weapons[row.class]).map((row) => row.code);
  out.S1 = { ok: noTarget.length === 0, detail: noTarget.join() };
  // S2: R2, a whole-magazine reload of a magazine over 2 rounds takes 1.0 s or more
  const quick = CAT.weapons.filter((row) => row.mag > 2 && !row.reloadShell && row.reload < 1).map((row) => row.code + ' ' + row.reload);
  out.S2 = { ok: quick.length === 0, detail: quick.join('; ') };
  // S3: pick shares per slot (bots)
  const bad = [], data = {};
  const primary = balanceGunShares('primary');
  for (const key of pickupSlotOptions('primary')) {
    const ratio = primary.uniform[key] > 0 ? primary.share[key] / primary.uniform[key] : 0, band = BALANCE_TARGETS.picks.primary;
    data[balanceCode(key)] = { share: percent(primary.share[key]), ratio: +ratio.toFixed(2) };
    if (ratio < band[0] || ratio > band[1]) bad.push('primary ' + balanceCode(key) + ' ' + ratio.toFixed(2) + 'x');
  }
  const bands = [['secondary', balanceGunShares('secondary').share, BALANCE_TARGETS.picks.secondary], ['lethal', balanceGadgetShares('lethal').share, BALANCE_TARGETS.picks.lethal],
    ['tactical', balanceGadgetShares('tactical').share, BALANCE_TARGETS.picks.tactical], ['device', balanceGadgetShares('device').share, BALANCE_TARGETS.picks.device],
    ['ability', balanceAbilityShares('ability1').share, BALANCE_TARGETS.picks.ability], ['ultimate', balanceAbilityShares('ultimate').share, BALANCE_TARGETS.picks.ultimate]];
  for (const [slot, shares, band] of bands) for (const key in shares) {
    const value = percent(shares[key]);
    data[balanceCode(key)] = { share: value };
    if (slot === 'device' && key === 'cover') continue;   // G13: a bot's own wall is not in the nav graph (recorded exception)
    if (value < band[0] || value > band[1]) bad.push(slot + ' ' + balanceCode(key) + ' ' + value + ' %');
  }
  out.S3 = { ok: bad.length === 0, detail: bad.join('; '), data };
  // S4: a weapon is the favourite of 2 profiles at most; every class bots may draw has a favourite
  const count = {};
  for (const profile of CAT.bots) if (CAT.weapons.byId(profile.favorite)) count[profile.favorite] = (count[profile.favorite] || 0) + 1;
  const crowded = Object.keys(count).filter((key) => count[key] > BALANCE_TARGETS.picks.favouriteMax).map((key) => balanceCode(key) + ' x' + count[key]);
  const drawn = new Set(pickupSlotOptions('primary').map((key) => CAT.weapons.byId(key).class));
  const missing = [...drawn].filter((name) => !Object.keys(count).some((key) => CAT.weapons.byId(key).class === name));
  out.S4 = { ok: !crowded.length && !missing.length, detail: crowded.concat(missing.map((name) => 'no favourite in ' + name)).join('; ') };
  // S5: exposure, every combat row and powerup is met in normal play (a spawn pick, a pad or a powerup on a versus map, or its own mode)
  const placed = new Set();
  for (const map of balanceVersusMaps()) for (const item of map.items) placed.add(item.item);
  for (const key of CAT.mapItemSets.byId('power').list) placed.add(key);
  const spawnable = new Set(pickupSlotOptions('primary').concat(pickupSlotOptions('secondary'), pickupSlotOptions('melee')));
  const modeOwned = ['lightbearer', 'soul', 'vitalshard'];
  const unseen = [];
  for (const row of CAT.weapons) if (row.class !== 'tool' && !spawnable.has(row.id) && !placed.has(row.id)) unseen.push(row.code);
  for (const row of CAT.powerups) if (!placed.has(row.id) && !modeOwned.includes(row.id)) unseen.push(row.code);
  out.S5 = { ok: unseen.length === 0, detail: unseen.join() };
  // S6: statistics keys are unique by catalogue and code; the ids shared across catalogues stay apart
  const keys = new Set(), clashes = [];
  for (const [kind, name] of BALANCE_ID_ORDER) for (const row of CAT[name]) {
    const key = balanceKey(kind, row);
    if (keys.has(key) || balanceRowOfKey(key) !== row) clashes.push(key);
    keys.add(key);
  }
  const ids = BALANCE_ID_ORDER.flatMap(([, name]) => CAT[name].map((row) => row.id));
  out.S6 = { ok: clashes.length === 0, detail: clashes.join() + ' shared ids: ' + [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].join() };
  // S7: the bot primary pool per map and style; no pool is empty and every primary is reachable in some pool
  const reach = new Set(), empty = [];
  for (const map of balanceVersusMaps()) for (const style of ['', ...Object.keys(BOT_STYLE_FIGHT_SCALE)]) for (const taste of BOT_FIGHT_TASTE) {
    const pool = botGunPool('primary', botStyleFightDistance(style, balanceMapSide(map), taste));
    if (!pool.length) empty.push(map.id + '/' + style);
    pool.forEach((weapon) => reach.add(weapon.id));
  }
  const unreached = pickupSlotOptions('primary').filter((key) => !reach.has(key)).map(balanceCode);
  out.S7 = { ok: !empty.length && !unreached.length, detail: empty.concat(unreached).join() };
  return out;
}

const BALANCE_STATIC_NAMES = { S1: 'every combat class has a balance target row', S2: 'R2: a whole-magazine reload of a magazine over 2 rounds takes 1.0 s or more',
  S3: 'M1: bot pick shares inside their bands per slot', S4: 'a weapon is the favourite of 2 profiles at most and every drawn class has one',
  S5: 'exposure: every combat row and powerup is met on a built-in map or in its own mode', S6: 'statistics keys are unique by catalogue and code',
  S7: 'the bot primary pool: none empty, every primary reachable' };
Test.add('balance', (check) => {
  const results = balanceStatics();
  for (const name in BALANCE_STATIC_NAMES) check(name + ' ' + BALANCE_STATIC_NAMES[name], results[name].ok, results[name].detail);
});
Test.add('balance', (check) => {
  // the collector smoke run: a short seeded match with a forced gun; the same seed twice gives the same record
  const spec = { mode: 'ffa', map: 'spire', ruleset: 'classic', minutes: 0.4, botCount: 6, seed: 3, forced: { primary: 'W21' }, forcedCount: 2, modeOptions: { timeLimit: 0, scoreLimit: 0 } };
  const first = balanceRunCase(spec), second = balanceRunCase(spec);
  check('a forced loadout reaches the bots that were asked for it', first.actors.filter((entry) => entry.forced).length === 2 && first.rows['weapon:W21'] && first.rows['weapon:W21'].picks >= 2, JSON.stringify(first.forcedTotals));
  check('the collector keeps alive time, drawn time and kills per row', first.rows['weapon:W21'].owned > 0 && first.rows['weapon:W21'].drawn > 0 && first.totals.deaths >= first.totals.kills);
  check('the same seed repeats the same record', JSON.stringify(first.rows) === JSON.stringify(second.rows) && first.stats.kills === second.stats.kills);
  const undo = balanceApplyOverrides({ 'weapons.shardcaster.reload': 7 }), reloaded = CAT.weapons.byId('shardcaster').reload;
  balanceUndoOverrides(undo);
  check('an override sets a catalogue field for the run and the undo restores it', reloaded === 7 && CAT.weapons.byId('shardcaster').reload === 2);
}, { slow: true });

// ---- The P8-04 data and behaviour changes (Appendix C "P8-04"): each one has a check here ----
Test.add('balance', (check) => {
  const weapon = (id) => CAT.weapons.byId(id), item = (id) => CAT.items.byId(id), ability = (id) => CAT.abilities.byId(id);
  check('O2: the Shardcaster reloads its whole 10-round magazine in 2 s', weapon('shardcaster').mag === 10 && weapon('shardcaster').reload === 2 && !weapon('shardcaster').reloadShell);
  check('O1: the Stakedriver primary pins without burning, the alt burns 4 s at any range', !weapon('stakedriver').primary.status && weapon('stakedriver').alt.status.seconds === 4);
  check('O3: the small steps come back sooner (I02 25 s, I06 20 s), the big ones keep 35 s / 25 s', item('healthpack').respawn === 25 && item('lightplate').respawn === 20
    && item('healthcrate').respawn === 35 && item('heavyplate').respawn === 25);
  check('O4: Veil (AX5) ends when its user fires, Ghostveil (PU04) does not', ability('veilcombo').interrupt && ability('veilcombo').interrupt.fire === true && Abilities.interruptRule(ability('veilcombo')).fire === true
    && !CAT.powerups.byId('ghostveil').mods.interruptOnFire);
  check('O7: AX6 shows Rapid Fire and keeps its id berserkcombo; PU09 keeps Berserk Fist', ability('berserkcombo').name === 'Rapid Fire' && CAT.powerups.byId('berserk').name === 'Berserk Fist');
  check('A15 Scout Drone is picked as often as the lowest ability (bot weight 0.5)', ability('scoutdrone').botUse.chance === 0.5);
  const favourites = CAT.bots.map((row) => row.favorite);
  check('favourites: B21 Razorwind, B22 Stakedriver, B23 Hailstorm, none above 2 profiles', favourites[20] === 'razorwind' && favourites[21] === 'stakedriver' && favourites[22] === 'hailstorm');
});
Test.add('balance', (check) => {
  // O5: Second Wind needs a teammate who can go down; a match without that shows it restricted and bots weigh it 0
  Game.start({ mode: 'tdm', map: 'skyyard', ruleset: 'vanguard', seed: 1, bots: [{}, {}, {}, {}] });
  check('O5: Shield Wars cannot down anyone, Second Wind says so and bots weigh it 0', Abilities.restriction('secondwind') === 'Needs downed teammates' && botAbilityWeight('secondwind') === 0 && Abilities.restriction('surge') === '');
  Game.stop();
  Game.start({ mode: 'ffa', map: 'skyyard', ruleset: 'modern', seed: 1, bots: [{}, {}, {}, {}] });
  check('O5: a free-for-all has no teammates to down, whatever the ruleset', Abilities.restriction('secondwind') === 'Needs downed teammates');
  Game.stop();
  Game.start({ mode: 'tdm', map: 'skyyard', ruleset: 'modern', seed: 1, bots: [{}, {}, {}, {}] });
  check('O5: Modern Ops downs players, Second Wind works and bots may pick it', Abilities.restriction('secondwind') === '' && botAbilityWeight('secondwind') > 0);
  Game.stop();
});
Test.add('balance', (check) => {
  // F0-13: a lobbed shot lands on the crosshair point (the low arc through it), in reach of its speed
  const probe = balanceLobProbe().data;
  const misses = Object.keys(probe).map((label) => label + ' ' + probe[label].join('/')).join('; ');
  const lobs = ['W32 primary', 'W34 primary', 'W21 alt'];
  check('F0-13: grenades and goo land within 1.5 m of the crosshair point at 10 and 20 m', lobs.every((label) => probe[label][0] <= 1.5 && probe[label][1] <= 1.5), misses);
  check('F0-13: the Talon Bow arrow (gravity under LOB_MIN_GRAVITY) keeps its drop, a listed drawback', probe['W27 primary'][1] > 3, misses);
  check('F0-13: a point beyond the reach of the flight (30 m for a 22 m/s grenade) gets the farthest arc, not a flat shot (lands near the 24 m reach)', lobs.slice(0, 1).every((label) => probe[label][2] > 3 && probe[label][2] < 9), misses);
});
Test.add('balance', (check) => {
  // the bots of a lob weapon aim at the target itself: no hand-made drop on top of the muzzle's arc
  const mortar = CAT.weapons.byId('pitcher').primary, bullet = CAT.weapons.byId('shardcaster').primary;
  check('bots add no drop to a lobbed row (the muzzle solves it) and still add it to a slightly dropping one', BotCombat.dropFor(mortar, 1) === 0 && BotCombat.dropFor(bullet, 1) > 0);
});

// ---- ARC-033 behaviour (coordinator, P8-04): what a bot does the moment its target is lost ----
const HIDE_WALL = { shape: 'box', min: [5, 0, -1], max: [40, 12, 1] };   // a wall the target can step behind (the bot stands at x 0)
const HIDE_TICKS = 2, HIDE_WARMUP = 4, HIDE_OBSERVE = 1.5, HIDE_SOON_TICKS = 18;   // the look is read 0.15 s after the loss
// Runs a bot with `gun` against a dummy it sees; at HIDE_WARMUP hide(dummy, tick) takes the dummy out of sight (called every tick after).
// Returns the shots before the loss, the shots later than HIDE_TICKS ticks after it, and the bot's look yaw at the end.
function hideProbe(gun, distance, hide, prepare) {
  const [bot, dummy] = startBotTest(botTestMap(false, { brushes: [TEST_FLOOR, HIDE_WALL] }), 'ffa', { bots: [{ tier: 6 }, { dummy: true }] });
  Weapons.setLoadout(bot, [gun]);
  Gadgets.resetActor(bot);
  placeFacing(bot, 0, -distance / 2, 0);
  if (prepare) prepare(distance);
  const shots = startEventLog('weapon.fire'), hideTick = Math.round(HIDE_WARMUP * TICK_RATE);
  let yawSoon = 0;
  for (let tick = 0; tick < hideTick + HIDE_OBSERVE * TICK_RATE; tick++) {
    holdActor(bot, 0, -distance / 2);
    if (tick < hideTick) holdActor(dummy, 0, distance / 2); else hide(dummy, tick - hideTick, distance);
    Sim.run(1);
    if (tick === hideTick + HIDE_SOON_TICKS) yawSoon = Bots.lookYaw[bot] / DEG;
  }
  shots.stop();
  const lostAt = hideTick * TICK_SECONDS, own = shots.filter((event) => event.id === bot);
  const result = { before: own.filter((event) => event.time <= lostAt).length, late: own.filter((event) => event.time > lostAt + HIDE_TICKS * TICK_SECONDS).length,
    sees: BotSense.sees(bot, dummy), lookYaw: yawSoon };
  endBotTest();
  return result;
}
const hideBehindWall = (dummy, since, distance) => holdActor(dummy, 20, distance / 2);
const hideInSmoke = (dummy, since, distance) => holdActor(dummy, 20, distance / 2);   // into a cloud that has been growing since the start (prepareSmoke)
const prepareSmoke = (distance) => Smoke.addVolume(20, 0, distance / 2, 5, 30);
const hideCloaked = (dummy, since, distance) => { holdActor(dummy, 0, distance / 2); if (since === 0) Items.giveKey(dummy, 'ghostveil'); };
Test.add('bots', (check) => {
  for (const [label, hide, distance] of [['steps behind a wall', hideBehindWall, 14], ['steps into smoke', hideInSmoke, 14], ['cloaks', hideCloaked, 30]]) {
    const result = hideProbe('vanguard', distance, hide, label === 'steps into smoke' ? prepareSmoke : null);
    check('auto fire stops within ' + HIDE_TICKS + ' ticks when the target ' + label, result.before > 5 && result.late === 0 && !result.sees, JSON.stringify(result));
  }
  const wall = hideProbe('talonbow', 14, hideBehindWall), trueBearing = Math.atan2(20, 7 + 7) / DEG;
  check('a charge in hand aims at the last known spot, not at the true position behind the wall', Math.abs(wall.lookYaw) < 15 && Math.abs(wall.lookYaw - trueBearing) > 30, JSON.stringify(wall) + ' true ' + trueBearing.toFixed(0));
});
Test.add('balance', (check) => {
  // O4: Veil ends on a weapon shot, not on a melee swing; a bot with it running does not shoot
  const t = AbilityTest.give(AbilityTest.start(), 'veilcombo');
  Weapons.setLoadout(t.caster, ['warden']);
  check('AX5 Veil casts', AbilityTest.cast(t) && Abilities.isActive(t.caster, 'veilcombo'));
  Bus.emit('weapon.fire', { id: t.caster, weapon: 'maul', mode: 'melee', weaponClass: 'melee' });
  check('the quick melee does not end Veil', Abilities.isActive(t.caster, 'veilcombo'));
  Weapons.setLoadout(t.caster, ['maul']);
  TestArena.place(t.enemy, 0, 1.2);
  TestArena.aimAt(t.caster, t.enemy);
  const swings = TestArena.count('weapon.fire', () => TestArena.hold(t.caster, BTN.FIRE, 0.5));
  check('a real Breaker Maul swing (mode primary, class melee) does not end Veil', swings > 0 && Abilities.isActive(t.caster, 'veilcombo'), swings);
  Sim.step();   // the trigger is up for a step before the next gun is pressed
  Weapons.setLoadout(t.caster, ['warden']);
  TestArena.place(t.enemy, 0, ENEMY_DISTANCE);
  TestArena.aimAt(t.caster, t.enemy);
  TestArena.hold(t.caster, BTN.FIRE, 0.3);
  check('a weapon shot ends Veil', !Abilities.isActive(t.caster, 'veilcombo'));
  AbilityTest.give(t, 'veilcombo'); AbilityTest.cast(t);
  Actors.kind[t.caster] = ACTOR_KIND.BOT; Bots.active[t.caster] = 1;
  check('a bot under Veil keeps its trigger up (keepsCloak)', BotCombat.keepsCloak(t.caster));
  Bots.active[t.caster] = 0; Actors.kind[t.caster] = ACTOR_KIND.DUMMY;
  TestArena.finish();
});
Test.add('balance', (check) => {
  // a bot lobs at the point it aims at, not at the wall in front of it; out of reach it takes the farthest arc, not a flat shot
  TestArena.start({}, [{ shape: 'box', min: [-3, 0, 4], max: [3, 6, 5] }]);
  const id = TestArena.actor(1, 0, 0, 0), direction = { x: 0, y: 0, z: 1 }, realLobRange = Muzzle.lobRange;   // the bots' hook (14d), put back below
  Actors.pitch[id] = Actors.aimPitch[id] = 0;
  const reach = (speed, gravity) => { const out = Muzzle.launchFrom; return out.dy > 0 ? speed * speed * 2 * out.dy * Math.sqrt(1 - out.dy * out.dy) / gravity : 0; };
  Muzzle.leaveFromEye(id, Actors.eyeY(id), direction);
  Muzzle.lobRange = (actor) => (actor === id ? 20 : -1);
  const solved = Muzzle.solveLob(id, direction, 22, 20), range = reach(22, 20);
  check('a bot lobs at its own aim point 20 m away although a wall stands 4 m ahead', solved && range > 17 && range < 23, range.toFixed(1));
  Muzzle.leaveFromEye(id, Actors.eyeY(id), direction);
  Muzzle.lobRange = (actor) => (actor === id ? 60 : -1);
  const far = Muzzle.solveLob(id, direction, 22, 20);
  check('a point out of reach (60 m, reach 24 m) gets the farthest arc, about 45 deg', far && Muzzle.launchFrom.dy > 0.6 && Muzzle.launchFrom.dy < 0.8, Muzzle.launchFrom.dy);
  Muzzle.lobRange = null;
  check('no usable speed or gravity leaves the direction alone (no NaN)', !Muzzle.solveLob(id, direction, NaN, 20) && !Muzzle.solveLob(id, direction, 22, 0));
  const sky = { x: 0, y: 0.94, z: 0.34 };   // a shot 70 deg up into the sky: out of reach, and never lowered to 45 deg
  Muzzle.leaveFromEye(id, Actors.eyeY(id), sky);
  Muzzle.solveLob(id, sky, 22, 20);
  check('out of reach the arc is never lower than the eye pitch (a sky shot stays steep)', Muzzle.launchFrom.dy > 0.9, Muzzle.launchFrom.dy);
  Muzzle.lobRange = realLobRange;
  check('the bots\' lob hook is back after the test', Muzzle.lobRange === realLobRange && typeof realLobRange === 'function');
  TestArena.finish();
});
Test.add('balance', (check) => {
  // a trigger held at death is not pressed again after the respawn (a Talon Bow charge used to leave at nothing then)
  const [bot] = startBotTest(botTestMap(false), 'ffa', { bots: [{ tier: 3 }, { dummy: true }] });
  Bots.buttonsWanted[bot] = BTN.FIRE; Bots.slotWanted[bot] = 3;
  Bots.onDeath(bot);
  check('a dead bot has no wish left: no buttons, no weapon slot', Bots.buttonsWanted[bot] === 0 && Bots.slotWanted[bot] === 0 && Actors.buttons[bot] === 0);
  endBotTest();
  // the fairness record: a charge release at an enemy seen 0.1 s ago is "recent", an auto shot never; the enemy is the one the shot was aimed at
  const [shooter, near, far] = startBotTest(botTestMap(false), 'ffa', { bots: [{ tier: 3 }, { dummy: true }, { dummy: true }] });
  placeFacing(shooter, 0, 0, 0); holdActor(near, 0, 10); holdActor(far, 30, 10);
  const aimed = BotCombat.aimedAt(shooter, { dx: 0, dy: 0, dz: 1 });
  check('the target a shot was aimed at is the enemy on its line', aimed === near, aimed + ' / ' + near);
  const before = Object.assign({}, BotCombat.fairness);
  BotSense.seenAt[BotSense.pair(shooter, near)] = Sim.time - 0.1; BotCombat.licenseUntil[shooter] = -1;
  Weapons.setLoadout(shooter, ['talonbow', 'vanguard']);
  BotCombat.recordFairness(shooter, { weapon: 'talonbow', mode: 'primary', dx: 0, dy: 0, dz: 1 });
  check('a charge release at an enemy seen 0.1 s ago is counted apart (recent)', BotCombat.fairness.recent === before.recent + 1 && BotCombat.fairness.unperceived === before.unperceived);
  BotCombat.recordFairness(shooter, { weapon: 'vanguard', mode: 'primary', dx: 0, dy: 0, dz: 1 });
  check('an auto shot in the same case is unperceived', BotCombat.fairness.unperceived === before.unperceived + 1);
  BotSense.seenAt[BotSense.pair(shooter, near)] = Sim.time - 0.5;
  BotCombat.recordFairness(shooter, { weapon: 'talonbow', mode: 'primary', dx: 0, dy: 0, dz: 1 });
  check('a charge release at an enemy seen 0.5 s ago is unperceived (the window is 0.25 s)', BotCombat.fairness.unperceived === before.unperceived + 2);
  BotCombat.fairness.shots = before.shots; BotCombat.fairness.unperceived = before.unperceived; BotCombat.fairness.unknown = before.unknown; BotCombat.fairness.recent = before.recent;
  endBotTest();
});
Test.add('balance', (check) => {
  // a burst left over from another weapon does not fire the weapon that replaced it (it did: rounds of a Ratchet burst left a Ramjet)
  TestArena.start({});
  // (through the carry-limit pickup path: Weapons.give replaces the held gun, nothing resets the firing state but the fix)
  TestArena.finish();
  TestArena.start({ carry: 1 });
  const id = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 20);
  Weapons.clear(id);
  Weapons.give(id, 'ratchet', 0);
  const ratchet = CAT.weapons.byId('ratchet');
  TestArena.aimAt(id, target);
  Weapons.startBurst(id, ratchet, ratchet.primary, 0);
  Weapons.give(id, 'ramjet', 0);
  const swapped = Weapons.currentWeapon(id) && Weapons.currentWeapon(id).id === 'ramjet' && !Weapons.has(id, 'ratchet');
  const shots = TestArena.count('weapon.fire', () => Sim.run(TICK_RATE / 2));
  check('rounds of an abandoned burst do not leave the weapon that replaced it (carry-limit pickup)', swapped && shots === 0 && Weapons.burstLeft[id] === 0, shots);
  // a charge begun with the Talon Bow and released after the Accelerator replaced it does not fire the Accelerator
  Weapons.clear(id);
  Weapons.give(id, 'talonbow', 0);
  TestArena.aimAt(id, target);
  Actors.buttons[id] = BTN.FIRE;
  Sim.run(TICK_RATE / 4);
  Weapons.give(id, 'accelerator', 0);
  Actors.buttons[id] = 0;
  const released = TestArena.count('weapon.fire', () => Sim.run(TICK_RATE / 2));
  check('a charge of the replaced weapon is not released into the new one', Weapons.currentWeapon(id).id === 'accelerator' && released === 0 && Weapons.chargeMode[id] < 0, released);
  TestArena.finish();
});
Test.add('balance', (check) => {
  // a bot that freezes (buy time, a freeze status) with a charge in hand drops it: letting go would fire it at nothing (unperceived release)
  const [bot, dummy] = startBotTest(botTestMap(false), 'ffa', { bots: [{ tier: 3 }, { dummy: true }] });
  Weapons.setLoadout(bot, ['talonbow']);
  placeFacing(bot, 0, -7, 0); holdActor(dummy, 0, 7);
  Sim.run(TICK_RATE);
  const shots = startEventLog('weapon.fire');
  BotCombat.holdSince[bot] = Sim.time; Weapons.chargeMode[bot] = 0; Weapons.charge[bot] = 0.3;
  Actors.flags[bot] |= ACTOR_FLAG.FROZEN;
  for (let tick = 0; tick < TICK_RATE; tick++) { holdActor(bot, 0, -7); holdActor(dummy, 0, 7); Sim.run(1); }
  const whileFrozen = shots.filter((event) => event.id === bot).length, dropped = BotCombat.holdSince[bot] < 0 && Weapons.chargeMode[bot] < 0;
  Actors.flags[bot] &= ~ACTOR_FLAG.FROZEN;   // the thaw: the trigger is up now, which used to release the stale charge at once
  Bots.buttonsWanted[bot] = 0; Actors.buttons[bot] = 0;
  for (let tick = 0; tick < TICK_RATE / 10; tick++) { holdActor(bot, 0, -7); holdActor(dummy, 0, 7); Sim.run(1); }
  shots.stop();
  check('a frozen bot with a held charge fires nothing, not even when it thaws, and forgets the hold', whileFrozen === 0 && dropped && shots.filter((event) => event.id === bot).length === 0, whileFrozen + ' / ' + dropped + ' / ' + shots.filter((event) => event.id === bot).length);
  endBotTest();
});
Test.add('balance', (check) => {
  // a trigger held through a change of weapon fires an automatic gun at once, a semi or burst gun only after a fresh press (a promotion used to start a stale burst)
  TestArena.start({});
  const id = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 20);
  giveFull(id, 'vanguard');
  TestArena.aimAt(id, target);
  Actors.buttons[id] = BTN.FIRE;
  Sim.run(10);
  giveFull(id, 'ratchet');
  const held = TestArena.count('weapon.fire', () => Sim.run(TICK_RATE / 2));
  Actors.buttons[id] = 0;
  Sim.run(2);
  Actors.buttons[id] = BTN.FIRE;
  const fresh = TestArena.count('weapon.fire', () => Sim.run(TICK_RATE / 2));
  check('held through a change to a burst gun: nothing until a fresh press; then it fires', held === 0 && fresh > 0, held + ' / ' + fresh);
  giveFull(id, 'vanguard');
  const auto = TestArena.count('weapon.fire', () => Sim.run(TICK_RATE / 2));
  check('held through a change to an automatic gun: it fires at once', auto > 0, auto);
  Actors.buttons[id] = 0;
  TestArena.finish();
});
Test.add('balance', (check) => {
  // the player's trigger (P8-04): a press during the raise of a semi or burst gun fires, a trigger held all through the change waits for a fresh press (Fire and Alt)
  TestArena.start({});
  const id = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 20);
  const swapTo = (key, button, pressAfterTicks) => {
    Weapons.setLoadout(id, ['vanguard']);
    Weapons.give(id, key, 0);
    Actors.buttons[id] = pressAfterTicks < 0 ? button : 0;
    Sim.run(2);
    TestArena.aimAt(id, target);
    Weapons.requestSwitch(id, CAT.weapons.byId(key).index);
    return TestArena.count('weapon.fire', () => {
      for (let tick = 0; tick < TICK_RATE; tick++) {
        if (tick === pressAfterTicks) Actors.buttons[id] = button;
        Sim.run(1);
      }
    });
  };
  const fresh = swapTo('verdict', BTN.FIRE, 4);
  check('Fire pressed during the raise of a semi-auto gun and held fires it', fresh >= 1, fresh);
  Actors.buttons[id] = 0; Sim.run(2);
  const freshBurst = swapTo('ratchet', BTN.FIRE, 4);
  check('Fire pressed during the raise of a burst gun and held fires it', freshBurst >= 1, freshBurst);
  Actors.buttons[id] = 0; Sim.run(2);
  const heldThrough = swapTo('verdict', BTN.FIRE, -1);
  check('Fire held all through the change waits for a fresh press (a semi-auto gun)', heldThrough === 0, heldThrough);
  Actors.buttons[id] = 0; Sim.run(2);
  const altFresh = swapTo('warden', BTN.ALT, 4);
  check('Alt pressed during the raise of the Warden fires its burst', altFresh >= 1, altFresh);
  Actors.buttons[id] = 0; Sim.run(2);
  const altHeld = swapTo('warden', BTN.ALT, -1);
  check('Alt held all through the change does not fire the Warden burst until it is pressed again', altHeld === 0, altHeld);
  Actors.buttons[id] = 0;
  TestArena.finish();
});

// ---- BOT-071 revive soak (P8-04: moved here from the bots group, where 36 seeds would add about 2.5 minutes to a fast group) ----
// Over seeds 1-36 (about 1,900 downs) bots revive 28.2% of the downed in this tree (28.6% before P8-04, 26.9% after the first pass; without revive goals under 2%),
// about 1.5 points of noise; one match swings from 16% to 47%, and the six seeds this test used to run read anywhere between 20% and 33%. So 36 seeds against a 25% floor.
const REVIVE_SOAK_SECONDS = 180, REVIVE_SOAK_SEEDS = Array.from({ length: 36 }, (_, index) => index + 1), REVIVE_SHARE_MIN = 0.25;
Test.add('balance', (check) => {
  const downed = new Uint8Array(MAX_ACTORS);
  let downs = 0, revives = 0;
  const onTick = () => {
    for (let id = 0; id < Actors.count; id++) {
      const now = Actors.alive[id] && (Actors.flags[id] & ACTOR_FLAG.DOWNED) ? 1 : 0;
      if (now && !downed[id]) downs++;
      if (!now && downed[id] && Actors.alive[id]) revives++;
      downed[id] = now;
    }
  };
  for (const seed of REVIVE_SOAK_SEEDS) {   // one match swings a lot (who is downed where): the share is over 36
    downed.fill(0);
    playMatch({ mode: 'dom', map: 'twinkeeps', ruleset: 'modern', minutes: REVIVE_SOAK_SECONDS / 60, botCount: 10, seed, onTick });
  }
  check('Modern Holdfast: bots revive at least 25% of the downed (36 seeds)', downs > 0 && revives / downs >= REVIVE_SHARE_MIN, revives + ' of ' + downs);
}, { slow: true });   // 2.5 minutes: only with --slow or --group balance

Test.add('balance', (check) => {
  // a bot under Veil or the Phantasm cloak swings a real melee weapon (a melee swing does not end the cloak) but keeps its gun's trigger up
  const [bot, dummy] = startBotTest(botTestMap(false), 'ffa', { bots: [{ tier: 3 }, { dummy: true }] });
  const realKeepsCloak = BotCombat.keepsCloak;
  BotCombat.keepsCloak = () => true;
  const shotsWith = (weaponId) => {
    Weapons.setLoadout(bot, [weaponId]);
    placeFacing(bot, 0, -0.75, 0);
    placeFacing(dummy, 0, 0.75, Math.PI);
    let shots = 0;   // primary-mode shots only: the quick melee (mode melee) is not what the cloak gate decides
    const tap = Bus.on('weapon.fire', (event) => { if (event.id === bot && event.mode !== 'melee') shots++; });
    for (let tick = 0; tick < 2 * TICK_RATE; tick++) { holdActor(bot, 0, -0.75); holdActor(dummy, 0, 0.75); Sim.run(1); }
    Bus.off('weapon.fire', tap);
    return shots;
  };
  const gunShots = shotsWith('vanguard');   // first: the bot needs a moment to notice the dummy
  const swings = shotsWith('maul');
  BotCombat.keepsCloak = realKeepsCloak;
  check('a bot under a cloak swings a real melee weapon at a target in reach', swings > 0, swings);
  check('and the same bot keeps its gun quiet under the cloak', gunShots === 0, gunShots);
  endBotTest();
});
