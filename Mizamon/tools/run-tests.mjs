// Headless rules tests for Mizamon. Node built-ins only.
// Usage (from the repo root or anywhere): node Mizamon/tools/run-tests.mjs
// It loads the rules code out of Mizamon.html (between RULES-BEGIN and RULES-END) with node:vm,
// so the tests run the same code the game runs. Prints "PASS n / m" and exits 1 on any failure.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const HTML_PATH = new URL('../Mizamon.html', import.meta.url);
const html = readFileSync(HTML_PATH, 'utf8');

export function loadRules(source = html) {
  const begin = source.indexOf('// RULES-BEGIN');
  const end = source.indexOf('// RULES-END');
  assert.ok(begin >= 0 && end > begin, 'RULES markers not found in Mizamon.html');
  const code = source.slice(begin, end);
  return new vm.Script('(function () {\n' + code + '\nreturn RULES;\n})()').runInNewContext({}, { timeout: 5000 });
}
const R = loadRules();

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
// The rules live in another vm realm, so compare structures through JSON.
const same = (a, b, message) => assert.equal(JSON.stringify(a), JSON.stringify(b), message);

// ---- The seed table, typed in again from docs/CONTENT-SEED.md section 2 ----
const SEED_NAMES = { Πολιτικοί: 'pol', Ασφαλίτες: 'asf', Εκκλησία: 'ekk', Celebrities: 'cel', Influencers: 'inf', Επιχειρηματίες: 'biz', Μιμίδια: 'mem' };
const SEED_ROWS = [
  ['Πολιτικοί', ['Επιχειρηματίες', 'Ασφαλίτες'], ['Μιμίδια', 'Influencers']],
  ['Ασφαλίτες', ['Μιμίδια', 'Influencers'], ['Πολιτικοί', 'Εκκλησία']],
  ['Εκκλησία', ['Ασφαλίτες', 'Celebrities'], ['Επιχειρηματίες', 'Μιμίδια']],
  ['Celebrities', ['Πολιτικοί', 'Επιχειρηματίες'], ['Influencers', 'Εκκλησία']],
  ['Influencers', ['Celebrities', 'Πολιτικοί'], ['Ασφαλίτες', 'Μιμίδια']],
  ['Επιχειρηματίες', ['Εκκλησία', 'Influencers'], ['Πολιτικοί', 'Celebrities']],
  ['Μιμίδια', ['Πολιτικοί', 'Εκκλησία'], ['Ασφαλίτες', 'Επιχειρηματίες']],
];

test('type chart equals the seed table (x2, x0.5, same type x0.5, everything else x1)', () => {
  assert.equal(R.TYPE_IDS.length, 7);
  for (const [attacker, strong, weak] of SEED_ROWS) {
    const a = SEED_NAMES[attacker];
    for (const defenderId of R.TYPE_IDS) {
      const strongIds = strong.map((n) => SEED_NAMES[n]);
      const weakIds = weak.map((n) => SEED_NAMES[n]);
      let expected = 1;
      if (strongIds.includes(defenderId)) expected = 2;
      if (weakIds.includes(defenderId)) expected = 0.5;
      if (defenderId === a) expected = 0.5;
      assert.equal(R.typeMultiplier(a, defenderId), expected, a + ' vs ' + defenderId);
    }
  }
});
test('chart sanity: no pair is both x2 and x0.5, every type has 2 strengths and 2 resistances, strong implies the defender resists it back less', () => {
  for (const a of R.TYPE_IDS) {
    const row = R.TYPE_IDS.map((d) => R.TYPE_CHART[a][d]);
    assert.equal(row.filter((m) => m === 2).length, 2, a + ' strengths');
    assert.ok(row.filter((m) => m === 0.5).length >= 3, a + ' resistances (2 + itself)');
    for (const d of R.TYPE_IDS) if (R.typeMultiplier(a, d) === 2) assert.notEqual(R.typeMultiplier(d, a), 2, a + '/' + d + ' both super effective');
  }
});
test('damage numbers for fixed inputs', () => {
  const komma = R.makeMon('komma', 10);
  const fakelakis = R.makeMon('fakelakis', 10);
  assert.equal(R.statOf(komma, 'rat'), 27);
  assert.equal(R.statOf(fakelakis, 'rde'), 20);
  assert.equal(R.maxHp(fakelakis), 39);
  // base = floor(60 * 27 / 20 * (10 + 4) / 90) = 12; STAB 1.5, super effective 2
  assert.equal(R.computeDamage(komma, fakelakis, R.MOVES.psifodeltio, { roll: 1 }).damage, 36);
  assert.equal(R.computeDamage(komma, fakelakis, R.MOVES.psifodeltio, { roll: 1, crit: true }).damage, 54);
  assert.equal(R.computeDamage(komma, fakelakis, R.MOVES.psifodeltio, { roll: 0.85 }).damage, 30);
  // no STAB, resisted: Ο Θείος (mem) against a politician is super effective, a politician's own move against a meme is resisted
  const trolo = R.makeMon('trolosavros', 10);
  const resisted = R.computeDamage(komma, trolo, R.MOVES.psifodeltio, { roll: 1 });
  assert.equal(resisted.effectiveness, 0.5);
  assert.ok(resisted.damage >= 1);
  // always at least 1
  assert.equal(R.computeDamage(R.makeMon('komma', 1), R.makeMon('dimosio', 50), R.MOVES.giagia, { roll: 0.85 }).damage >= 1, true);
  assert.equal(R.xpReward(R.makeMon('fakelakis', 5), false), 50);
  assert.equal(R.xpReward(R.makeMon('fakelakis', 5), true), 75);
});
test('abilities change damage: Παλιά Δόξα below half HP, Ντεσιμπέλ on rhetoric, Κουμπαριά with a fallen ally', () => {
  const foe = R.makeMon('komma', 10);
  const singer = R.makeMon('laikatzis', 10);
  const full = R.computeDamage(singer, foe, R.MOVES.souxe, { roll: 1 }).damage;
  singer.hp = Math.floor(R.maxHp(singer) / 2);
  assert.ok(R.computeDamage(singer, foe, R.MOVES.souxe, { roll: 1 }).damage > full);
  const spy = R.makeMon('spyradonis', 10);
  const loud = R.computeDamage(spy, foe, R.MOVES.fonipanel, { roll: 1 }).damage;
  const plain = R.computeDamage(Object.assign(R.makeMon('komma', 10)), foe, R.MOVES.fonipanel, { roll: 1 }).damage;
  assert.ok(loud > plain);
  const granny = R.makeMon('giagiaka', 10);
  const target = R.makeMon('komma', 10);
  assert.ok(R.computeDamage(granny, target, R.MOVES.giagia, { roll: 1, allyFallen: true }).damage > R.computeDamage(granny, target, R.MOVES.giagia, { roll: 1 }).damage);
});

// ---- Battle helpers ----
function newBattle(playerMon, foeMon, seed, options) {
  return R.createBattle([playerMon], [foeMon], R.makeRng(seed), Object.assign({ kind: 'trainer', foeName: 'Test', bag: { fakelaki: 5, fakelos: 5, koulouri: 3 } }, options));
}
const keysOf = (events) => events.filter((e) => e.k === 'msg').map((e) => e.key);

test('statuses: Υπό Έρευνα -25% attack and ends after 5 turns; Σκάνδαλο -1/8 HP per turn; Απεργία about half; Λαδωμένος about 30%', () => {
  const sick = R.makeMon('komma', 10);
  const base = R.effectiveStat(sick, 'rat');
  sick.status = { id: 'inv', turns: 5 };
  assert.equal(R.effectiveStat(sick, 'rat'), Math.max(1, Math.floor(base * 0.75)));
  // inv comes from a real move and is archived at the end of the 5th turn counted from the move:
  // not before, and the creature is free afterwards. After turn 1 our creature only heals itself
  // (no damage dealt), so the fight cannot end early.
  const b1 = newBattle(R.makeMon('komma', 30), R.makeMon('eforaki', 12), 3);
  R.playTurn(b1, { t: 'move', id: 'exetastiki' });
  assert.equal(b1.sides[1].party[0].status.id, 'inv', 'the investigation starts on turn 1');
  for (let turn = 2; turn <= 6; turn++) {
    const turnKeys = keysOf(R.playTurn(b1, { t: 'move', id: 'promise' }));
    assert.ok(!b1.over, 'the fight goes on');
    assert.equal(turnKeys.includes('b.stend.inv'), turn === 5, 'investigation ends on turn 5 only (turn ' + turn + ')');
    assert.equal(b1.sides[1].party[0].status === null, turn >= 5, 'status cleared from turn 5 (turn ' + turn + ')');
  }
  // scandal: foe loses exactly 1/8 of max HP at the end of the turn when nobody hits it
  const b2 = newBattle(R.makeMon('komma', 12), R.makeMon('eforaki', 12), 5);
  const foe = b2.sides[1].party[0];
  foe.status = { id: 'sca', turns: 0 };
  const before = foe.hp;
  R.playTurn(b2, { t: 'move', id: 'promise' });
  assert.equal(before - foe.hp, Math.floor(R.maxHp(foe) / 8));
  // strike: about 50 % of turns lost (count over many seeds)
  let idle = 0;
  let turns = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const b = newBattle(R.makeMon('komma', 30), R.makeMon('eforaki', 5), seed);
    b.sides[1].party[0].status = { id: 'str', turns: 3 };
    const events = R.playTurn(b, { t: 'move', id: 'promise' });
    turns++;
    if (keysOf(events).includes('b.str.idle')) idle++;
  }
  assert.ok(idle / turns > 0.4 && idle / turns < 0.6, 'strike rate ' + idle / turns);
  let pocket = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const b = newBattle(R.makeMon('komma', 30), R.makeMon('eforaki', 5), seed);
    b.sides[1].party[0].status = { id: 'bri', turns: 4 };
    if (keysOf(R.playTurn(b, { t: 'move', id: 'promise' })).includes('b.bri.pocket')) pocket++;
  }
  assert.ok(pocket / 400 > 0.2 && pocket / 400 < 0.4, 'bribed rate ' + pocket / 400);
});
const msgs = (events, key) => events.filter((e) => e.k === 'msg' && e.key === key);
// How many times a message about the defending side (side 1) shows up in one turn, over many seeds.
function countOnFoe(key, makePlayer, makeFoe, action, seeds = 300) {
  let count = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const fight = newBattle(makePlayer(), makeFoe(), seed);
    count += msgs(R.playTurn(fight, action), key).filter((e) => e.v.mon.side === 1).length;
  }
  return count;
}
test('abilities: Ασυλία blocks Υπό Έρευνα and Σκάνδαλο, Συνδικαλιστής blocks strikes, each against a control', () => {
  // Ασυλία against Υπό Έρευνα
  const b = newBattle(R.makeMon('komma', 10), R.makeMon('komma', 10), 11);
  const events = R.playTurn(b, { t: 'move', id: 'exetastiki' });
  assert.ok(keysOf(events).includes('b.immune'));
  assert.equal(b.sides[1].party[0].status, null);
  const control = newBattle(R.makeMon('komma', 10), R.makeMon('eforaki', 10), 11);
  R.playTurn(control, { t: 'move', id: 'exetastiki' });
  assert.equal(control.sides[1].party[0].status && control.sides[1].party[0].status.id, 'inv', 'the control creature is investigated');
  // Ασυλία against Σκάνδαλο (Αφορισμός, 30 %)
  const scandal = (foeId) => countOnFoe('b.st.sca', () => R.makeMon('psaltak', 10), () => R.makeMon(foeId, 20), { t: 'move', id: 'aforismos' });
  assert.equal(scandal('komma'), 0, 'Ασυλία refuses every Σκάνδαλο');
  assert.ok(scandal('eforaki') > 30, 'the control creature gets Σκάνδαλο');
  // Συνδικαλιστής against Απεργία (Ελλάδα 0 Λογική 1, 30 %)
  const strike = (foeId) => countOnFoe('b.st.str', () => R.makeMon('trolosavros', 10), () => R.makeMon(foeId, 20), { t: 'move', id: 'ellada' });
  assert.equal(strike('koulourak'), 0, 'Συνδικαλιστής refuses every Απεργία');
  assert.ok(strike('komma') > 40, 'the control creature goes on strike');
});
test('abilities: Ούτε Γάτα Ούτε Ζημιά survives one knock-out hit, Γραφειοκρατία starts a status one turn late', () => {
  const b2 = newBattle(R.makeMon('komma', 40), R.makeMon('trolosavros', 3), 2);
  const events2 = R.playTurn(b2, { t: 'move', id: 'psifodeltio' });
  assert.ok(keysOf(events2).includes('b.survive') && b2.sides[1].party[0].hp === 1, 'survives with 1 HP');
  // Γραφειοκρατία: no status after turn 1, the status arrives at the end of turn 2
  const b3 = newBattle(R.makeMon('komma', 10), R.makeMon('dimosio', 10), 4);
  assert.ok(keysOf(R.playTurn(b3, { t: 'move', id: 'exetastiki' })).includes('b.bureau'));
  assert.equal(b3.sides[1].party[0].status, null, 'nothing after turn 1');
  R.playTurn(b3, { t: 'move', id: 'promise' });
  assert.equal(b3.sides[1].party[0].status && b3.sides[1].party[0].status.id, 'inv', 'the investigation starts after turn 2');
});
test('Βύσμα (20 % against a higher level only), Επιτελικό Κράτος priority', () => {
  const ignoredShare = (attackerLevel) => {
    let ignored = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const b = newBattle(R.makeMon('komma', attackerLevel), R.makeMon('eforaki', 5), seed);
      if (keysOf(R.playTurn(b, { t: 'move', id: 'psifodeltio' })).includes('b.vys')) ignored++;
    }
    return ignored / 1000;
  };
  const higher = ignoredShare(30);
  assert.ok(higher > 0.12 && higher < 0.28, 'Βύσμα share ' + higher);
  assert.equal(ignoredShare(5), 0, 'an equal level is never ignored');
  const b = newBattle(R.makeMon('mizotakis', 5), R.makeMon('dimosio', 40), 1);
  const events = R.playTurn(b, { t: 'move', id: 'diaggelma' });
  const used = events.filter((e) => e.k === 'msg' && e.key === 'b.used');
  assert.equal(used[0].v.mon.side, 0, 'the first move of Επιτελικό Κράτος goes first even when slower');
});
test('Viral: after a knock-out the next move hits twice, and only that one', () => {
  const b = R.createBattle([R.makeMon('storoula', 30)], [R.makeMon('fakelakis', 2), R.makeMon('fakelakis', 50)], R.makeRng(8), { kind: 'trainer', foeName: 'Test', bag: {} });
  const first = R.playTurn(b, { t: 'move', id: 'hashtag' });
  assert.ok(first.some((e) => e.k === 'faint' && e.side === 1), 'the first foe falls');
  assert.ok(!keysOf(first).includes('b.viral'));
  const second = R.playTurn(b, { t: 'move', id: 'hashtag' });
  assert.ok(keysOf(second).includes('b.viral'), 'the next move goes viral');
  const hits = msgs(second, 'b.hits');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].v.n, 2);
  const third = R.playTurn(b, { t: 'move', id: 'hashtag' });
  assert.ok(!keysOf(third).includes('b.viral') && msgs(third, 'b.hits').length === 0, 'only one move is doubled');
});
test('Ρουσφέτι: a leaving Φακελάκης heals the next ally 1/8 of its max HP; other creatures do not', () => {
  const healedBy = (leaderId) => {
    const ally = R.makeMon('komma', 10);
    ally.hp = 10;
    const b = R.createBattle([R.makeMon(leaderId, 10), ally], [R.makeMon('eforaki', 5)], R.makeRng(3), { kind: 'trainer', foeName: 'Test', bag: {} });
    const events = R.playTurn(b, { t: 'switch', idx: 1 });
    const at = events.findIndex((e) => e.k === 'msg' && e.key === 'b.rousfeti');
    return at < 0 ? 0 : events[at - 1].hp - 10; // the hp event just before the message
  };
  assert.equal(healedBy('fakelakis'), Math.floor(R.maxHp(R.makeMon('komma', 10)) / 8));
  assert.equal(healedBy('koulourak'), 0);
});
test('Σκάνδαλο ends when the creature is switched out; Υπό Έρευνα stays', () => {
  const afterSwitch = (statusId) => {
    const sick = R.makeMon('koulourak', 10);
    const b = R.createBattle([sick, R.makeMon('komma', 10)], [R.makeMon('eforaki', 5)], R.makeRng(4), { kind: 'trainer', foeName: 'Test', bag: {} });
    sick.status = { id: statusId, turns: 5 };
    R.playTurn(b, { t: 'switch', idx: 1 });
    return sick.status;
  };
  assert.equal(afterSwitch('sca'), null);
  assert.equal(afterSwitch('inv').id, 'inv');
});
test('Κουμπαριά in a battle: a fallen ally of the same type adds damage', () => {
  const damageDealt = (allyFell) => {
    const b = newBattle(R.makeMon('giagiaka', 10), R.makeMon('komma', 30), 9);
    if (allyFell) b.sides[0].fallen.mem = 1;
    const hit = R.playTurn(b, { t: 'move', id: 'giagia' }).find((e) => e.k === 'hp' && e.side === 1);
    return R.maxHp(R.makeMon('komma', 30)) - hit.hp;
  };
  assert.ok(damageDealt(true) > damageDealt(false));
});
test('every status of the MVP can be inflicted by a move some creature learns; Offshore Μεταφορά bribes about 25 %', () => {
  const learnable = new Set();
  for (const species of Object.values(R.SPECIES)) for (const [, moveId] of species.learn) learnable.add(moveId);
  for (const statusId of Object.keys(R.STATUSES)) {
    const sources = [...learnable].filter((id) => (R.MOVES[id].foeSt && R.MOVES[id].foeSt[0] === statusId) || R.MOVES[id].bothSt === statusId);
    assert.ok(sources.length > 0, 'nothing inflicts ' + statusId);
  }
  const bribed = countOnFoe('b.st.bri', () => R.makeMon('fakelakis', 40), () => R.makeMon('komma', 20), { t: 'move', id: 'offshore' }, 400) / 400;
  assert.ok(bribed > 0.15 && bribed < 0.35, 'bribe share ' + bribed);
});
test('recruit odds: monotonic in HP, status and tier; bounded; zero when impossible', () => {
  const foe = R.makeMon('fakelakis', 5);
  const odds = (hpFraction, status, item) => {
    const f = R.makeMon('fakelakis', 5);
    f.hp = Math.max(1, Math.floor(R.maxHp(f) * hpFraction));
    f.status = status ? { id: status, turns: 3 } : null;
    return R.recruitChance(f, item);
  };
  assert.ok(odds(1, null, 'fakelaki') <= odds(0.5, null, 'fakelaki'));
  assert.ok(odds(0.5, null, 'fakelaki') <= odds(0.1, null, 'fakelaki'));
  assert.ok(odds(1, null, 'fakelaki') < odds(1, 'inv', 'fakelaki'));
  assert.ok(odds(1, 'inv', 'fakelaki') < odds(1, 'bri', 'fakelaki'));
  assert.ok(odds(0.3, null, 'fakelaki') < odds(0.3, null, 'fakelos'));
  for (const hp of [1, 0.5, 0.05]) for (const st of [null, 'inv', 'bri']) for (const item of ['fakelaki', 'fakelos']) {
    const value = odds(hp, st, item);
    assert.ok(value >= 0.03 && value <= 0.95, 'bounds ' + value);
  }
  assert.equal(R.recruitChance(R.makeMon('komma', 5), 'fakelaki'), 0);
  assert.equal(R.recruitChance(R.makeMon('mizotakis', 5), 'fakelos'), 0);
  assert.equal(R.recruitChance(foe, 'koulouri'), 0);
  assert.ok(R.recruitChance(R.makeMon('fakelakis', 3), 'fakelaki') > R.recruitChance(R.makeMon('fakelakis', 30), 'fakelaki'), 'higher level is harder');
});
test('recruit in a battle: success adds the creature, the item is spent, trainers refuse, the parody only takes a Φάκελος', () => {
  let recruited = false;
  for (let seed = 1; seed <= 40 && !recruited; seed++) {
    const foe = R.makeMon('fakelakis', 3);
    foe.hp = 1;
    const bag = { fakelaki: 5 };
    const b = R.createBattle([R.makeMon('komma', 8)], [foe], R.makeRng(seed), { kind: 'wild', bag });
    R.playTurn(b, { t: 'recruit', id: 'fakelaki' });
    assert.equal(bag.fakelaki, 4);
    if (b.recruited.length === 1) { recruited = true; assert.equal(b.sides[0].party.length, 2); assert.ok(b.over && b.winner === 0); }
  }
  assert.ok(recruited);
  const trainerBattle = newBattle(R.makeMon('komma', 8), R.makeMon('fakelakis', 3), 1);
  const refused = R.playTurn(trainerBattle, { t: 'recruit', id: 'fakelaki' });
  assert.ok(keysOf(refused).includes('b.rec.trainer'));
  assert.equal(trainerBattle.bag.fakelaki, 5);
  const host = R.createBattle([R.makeMon('komma', 8)], R.buildTrainerTeam('host', 'komma'), R.makeRng(3), { kind: 'trainer', foeName: 'Host', bag: { fakelaki: 2, fakelos: 2 }, recruitable: true, recruitOnly: 'fakelos' });
  assert.ok(keysOf(R.playTurn(host, { t: 'recruit', id: 'fakelaki' })).includes('b.rec.small'));
  assert.equal(host.bag.fakelaki, 2);
});
test('level up, stat growth, XP curve and move learning with a full move list', () => {
  for (let level = 1; level < R.MAX_LEVEL; level++) assert.ok(R.xpForLevel(level + 1) > R.xpForLevel(level));
  assert.equal(R.levelFromXp(R.xpForLevel(12)), 12);
  assert.equal(R.levelFromXp(R.xpForLevel(12) - 1), 11);
  for (const id of Object.keys(R.SPECIES)) {
    for (let level = 1; level < 50; level++) {
      assert.ok(R.statOf(R.makeMon(id, level + 1), 'hp') > R.statOf(R.makeMon(id, level), 'hp'), id + ' hp grows');
      assert.ok(R.statOf(R.makeMon(id, level + 1), 'atk') >= R.statOf(R.makeMon(id, level), 'atk'), id + ' atk does not shrink');
    }
  }
  const mon = R.makeMon('komma', 7);
  assert.equal(mon.moves.length, 3);
  mon.hp = R.maxHp(mon);
  const maxBefore = R.maxHp(mon);
  const gained = R.gainXp(mon, R.xpForLevel(8) - mon.xp);
  assert.equal(mon.lv, 8);
  same(gained[0].learned, ['tropologia']);
  assert.equal(mon.moves.length, 4);
  assert.ok(R.maxHp(mon) > maxBefore && mon.hp === R.maxHp(mon), 'HP rises with the level');
  const full = R.gainXp(mon, R.xpForLevel(11) - mon.xp);
  assert.ok(full.some((entry) => entry.pending.includes('thios')));
  same(mon.pend, ['thios']);
  assert.equal(mon.moves.length, 4);
  const little = R.makeMon('fakelakis', 9);
  assert.equal(R.evolutionFor(little), null);
  R.gainXp(little, R.xpForLevel(10) - little.xp);
  assert.equal(R.evolutionFor(little), 'fakelarchis');
  assert.ok(R.evolveMon(little));
  assert.equal(little.sp, 'fakelarchis');
});
// ---- Moves kept when more than four are known ----
test('a creature keeps its basic attack and its newest three moves when it knows more than four', () => {
  for (const [id, species] of Object.entries(R.SPECIES)) {
    for (let level = 1; level <= 50; level++) {
      const known = [];
      for (const [from, moveId] of species.learn) if (from <= level && !known.includes(moveId)) known.push(moveId);
      const moves = R.movesAtLevel(id, level);
      assert.ok(moves.length <= 4 && moves.every((moveId) => known.includes(moveId)), id + ' L' + level);
      if (known.length <= 4) { same(moves, known); continue; }
      const basic = known.find((moveId) => R.MOVES[moveId].p > 0 && R.MOVES[moveId].t === species.t);
      if (!basic) continue;
      assert.equal(moves[0], basic, id + ' L' + level + ' keeps its basic attack first');
      same(moves.slice(1), known.filter((moveId) => moveId !== basic).slice(-3));
    }
  }
  same(R.movesAtLevel('komma', 11), ['psifodeltio', 'exetastiki', 'tropologia', 'thios']);
  same(R.makeMon('fakelarchis', 13).moves, ['offshore', 'lobbying', 'yperkostol', 'frapes']);
  assert.ok(R.buildTrainerTeam('kotsos', 'komma')[2].moves.includes('offshore'), 'the boss Φακελάρχης still has Offshore Μεταφορά');
});

test('AI picks a super effective move most of the time and uses its item at most once', () => {
  let superEffective = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const attacker = R.makeMon('koulourak', 10); // Χημικά and Γκλομπ are asf; the foe is a meme
    const b = R.createBattle([R.makeMon('trolosavros', 10)], [attacker], R.makeRng(seed), { kind: 'trainer', foeName: 'AI', bag: {} });
    const action = R.chooseAction(b, 1);
    if (action.t === 'move' && R.typeMultiplier(R.MOVES[action.id].t, 'mem') === 2) superEffective++;
  }
  assert.ok(superEffective / 200 > 0.75, 'super effective share ' + superEffective / 200);
  const b = R.createBattle([R.makeMon('komma', 20)], [R.makeMon('eforaki', 5)], R.makeRng(9), { kind: 'trainer', foeName: 'AI', bag: {}, foeItems: ['souvlaki'] });
  b.sides[1].party[0].hp = 2;
  let used = 0;
  for (let i = 0; i < 30; i++) { const action = R.chooseAction(b, 1); if (action.t === 'item') used++; }
  assert.equal(used, 1);
});

test('AI: a setup move stops at +2, a skip move is not repeated, the random pick never takes a pointless move', () => {
  const b = R.createBattle([R.makeMon('komma', 12)], [R.makeMon('mizotakis', 12)], R.makeRng(2), { kind: 'trainer', foeName: 'AI', bag: {} });
  const boss = b.sides[1].party[0];
  const score = (moveId) => R.scoreMove(b, 1, moveId);
  assert.ok(score('technokratis') > 10, 'a first Τεχνοκράτης is worth a turn');
  boss.bt.stage.rde = 2;
  assert.ok(score('technokratis') <= R.USELESS_MOVE_SCORE, 'at +2 it is not');
  assert.ok(score('diaggelma') > score('technokratis'));
  assert.ok(score('psifiako') > 2);
  boss.bt.lastMove = 'psifiako';
  assert.ok(score('psifiako') <= R.USELESS_MOVE_SCORE, 'no skip turn after skip turn');
  // over whole fights the boss never climbs above +2 Ρητορική Άμυνα
  const routeIds = ['komma', 'koulourak', 'psaltak', 'laikatzis', 'storoula', 'trolosavros', 'giagiaka', 'frapedoros', 'eforaki', 'dimosio', 'fakelakis'];
  const rng = R.makeRng(31);
  let highest = 0;
  for (let i = 0; i < 300; i++) {
    const fight = R.createBattle([R.makeMon(R.pickOne(rng, routeIds), 12)], [R.makeMon('mizotakis', 12)], rng, { kind: 'trainer', foeName: 'AI', bag: {} });
    for (let turns = 0; turns < 60 && !fight.over; turns++) {
      if (fight.phase === 'forced') R.playForcedSwitch(fight, R.chooseReplacement(fight, 0));
      else R.playTurn(fight, R.chooseAction(fight, 0));
      highest = Math.max(highest, R.activeMon(fight, 1).bt.stage.rde);
    }
  }
  assert.ok(highest <= 2, 'highest Ρητορική Άμυνα stage ' + highest);
});
test('no battle of a seeded 1,000-battle sample reaches the turn limit, and a stalemate still ends in overtime', () => {
  const rng = R.makeRng(2024);
  let longest = 0;
  for (let i = 0; i < 1000; i++) {
    const result = R.simulateBattle(randomParty(rng, 3), randomParty(rng, 3), rng, {});
    assert.ok(result.battle.over, 'battle ' + i + ' ended before the turn limit');
    longest = Math.max(longest, result.turns);
  }
  assert.ok(longest < R.OVERTIME_TURN + 40, 'longest battle ' + longest + ' turns');
  // The worst case: two Μιζοτάκης that nobody can hurt (Ρητορική Άμυνα +6, Ακρίβεια -6). Overtime ends it.
  const stalemate = R.createBattle([R.makeMon('mizotakis', 12)], [R.makeMon('mizotakis', 12)], R.makeRng(5), { kind: 'trainer', foeName: 'AI', bag: {} });
  for (const side of [0, 1]) { const stage = R.activeMon(stalemate, side).bt.stage; stage.rde = 6; stage.acc = -6; }
  let guard = 0;
  while (!stalemate.over && guard++ < 300) R.playTurn(stalemate, R.chooseAction(stalemate, 0));
  assert.ok(stalemate.over, 'the stalemate ended');
  assert.ok(stalemate.turn >= R.OVERTIME_TURN && stalemate.turn < R.OVERTIME_TURN + 40, 'ended in overtime at turn ' + stalemate.turn);
});

// ---- Determinism ----
function randomParty(rng, size) {
  const ids = Object.keys(R.SPECIES);
  const party = [];
  for (let i = 0; i < size; i++) party.push(R.makeMon(R.pickOne(rng, ids), R.randInt(rng, 5, 15)));
  return party;
}
function sample(seed, count) {
  const rng = R.makeRng(seed);
  let total = 0;
  let wins = 0;
  const lines = [];
  for (let i = 0; i < count; i++) {
    const result = R.simulateBattle(randomParty(rng, 3), randomParty(rng, 3), rng, {});
    total = (total + result.checksum) >>> 0;
    wins += result.winner === 0 ? 1 : 0;
    if (i < 40) for (const e of result.battle.events) lines.push(e);
  }
  return { total, wins, lines };
}
test('seeded replay of a 1,000-battle sample gives equal checksums twice (and a different seed differs)', () => {
  const a = sample(2024, 1000);
  const b = sample(2024, 1000);
  assert.equal(a.total, b.total);
  assert.equal(a.wins, b.wins);
  assert.notEqual(sample(2025, 200).total, sample(2024, 200).total);
  assert.ok(a.wins > 300 && a.wins < 700, 'both sides win sometimes: ' + a.wins);
});
test('the rules never call Math.random or Date', () => {
  const begin = html.indexOf('// RULES-BEGIN');
  const rulesText = html.slice(begin, html.indexOf('// RULES-END')).split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '')).join('\n'); // CRLF checkouts too
  assert.ok(!/Math\.random|Date\.now|new Date|performance\.now/.test(rulesText));
});
test('encounters are seeded and happen at about the set rate on grass only', () => {
  const route = R.MAPS.route1;
  const run = (seed) => {
    const rng = R.makeRng(seed);
    const out = [];
    for (let i = 0; i < 2000; i++) out.push(R.rollEncounter(rng, route, 3, 11));
    return out;
  };
  const first = run(5);
  same(first, run(5));
  const rate = first.filter(Boolean).length / 2000;
  assert.ok(rate > R.ENCOUNTER_CHANCE - 0.03 && rate < R.ENCOUNTER_CHANCE + 0.03, 'rate ' + rate);
  assert.equal(R.rollEncounter(R.makeRng(1), route, 7, 9), null, 'no encounter on the road');
  for (const encounter of first.filter(Boolean)) assert.ok(encounter.lv >= 2 && encounter.lv <= 4 && R.SPECIES[encounter.sp]);
});
test('event texts render in both languages for every event of the sample battles', () => {
  const rng = R.makeRng(77);
  const messages = [];
  for (let i = 0; i < 60; i++) {
    const battle = R.createBattle(randomParty(rng, 3), randomParty(rng, 3), rng, { kind: i % 2 ? 'trainer' : 'wild', foeName: 'Test', bag: {} });
    messages.push(...battle.events.filter((e) => e.k === 'msg'));
    let guard = 0;
    while (!battle.over && guard++ < 300) {
      const events = battle.phase === 'forced' ? R.playForcedSwitch(battle, R.chooseReplacement(battle, 0)) : R.playTurn(battle, R.chooseAction(battle, 0));
      messages.push(...events.filter((e) => e.k === 'msg'));
    }
  }
  assert.ok(messages.length > 200);
  for (const event of messages) for (const lang of ['el', 'en']) for (const gender of ['m', 'f']) for (const kind of ['wild', 'trainer']) {
    const text = R.eventText(event, lang, gender, kind);
    assert.ok(text.length > 2 && !/[{}]/.test(text), event.key + ' -> ' + text);
  }
});

// ---- World ----
test('map reachability: start to the boss door, the boss, and every NPC tile', () => {
  const start = R.START_MAP;
  const open = R.reachableTiles(start.map, start.x, start.y, {});
  const bossWarp = R.MAPS.route1.warps.find((w) => w.to === 'port');
  assert.ok(open.has('route1:' + bossWarp.x + ':' + bossWarp.y), 'boss door reachable');
  assert.ok(open.has('port:' + bossWarp.tx + ':' + bossWarp.ty), 'inside the harbour office reachable');
  const boss = R.MAPS.port.npcs.find((n) => n.id === 'kotsos');
  assert.ok(R.npcTalkable('port', boss, open), 'boss can be talked to');
  const all = R.reachableTiles(start.map, start.x, start.y, { credits: true });
  for (const [mapId, map] of Object.entries(R.MAPS)) {
    for (const npc of map.npcs) assert.ok(R.npcTalkable(mapId, npc, all), mapId + ':' + npc.id + ' unreachable');
    for (const warp of map.warps) assert.ok(all.has(mapId + ':' + warp.x + ':' + warp.y), mapId + ' warp tile ' + warp.x + ',' + warp.y + ' unreachable');
    for (const key of Object.keys(map.signs)) {
      const [sx, sy] = key.split(',').map(Number);
      const standable = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => all.has(mapId + ':' + (sx + dx) + ':' + (sy + dy)));
      assert.ok(standable, mapId + ' sign ' + key + ' unreachable');
    }
  }
  assert.ok(!open.has('studio:4:6'), 'the studio stays shut until the credits');
  assert.ok(all.has('studio:4:6'), 'the studio opens after the credits');
  for (const [mapId, map] of Object.entries(R.MAPS)) {
    assert.equal(map.rows.length, map.h, mapId + ' height');
    for (const row of map.rows) assert.equal(row.length, map.w, mapId + ' width');
    for (const row of map.rows) for (const char of row) assert.ok(R.TILE_DEFS[char], 'unknown tile ' + char);
  }
});
test('every data reference is valid (moves, types, abilities, items, trainers, maps)', () => {
  const abilityHolders = new Set();
  for (const [id, move] of Object.entries(R.MOVES)) {
    assert.ok(R.TYPE_IDS.includes(move.t), id + ' type');
    assert.ok(['p', 'r', 's'].includes(move.c), id + ' category');
    if (move.foeSt) assert.ok(R.STATUSES[move.foeSt[0]], id + ' status');
    if (move.bothSt) assert.ok(R.STATUSES[move.bothSt], id + ' status');
    for (const change of move.stg || []) assert.ok(R.STAGE_KEYS.includes(change[1]), id + ' stage stat');
  }
  for (const type of R.TYPE_IDS) assert.ok(Object.values(R.MOVES).filter((m) => m.t === type).length >= 3, type + ' has at least 3 moves');
  for (const [id, species] of Object.entries(R.SPECIES)) {
    assert.ok(R.TYPE_IDS.includes(species.t), id + ' type');
    assert.ok(R.ABILITY_IDS.includes(species.ab), id + ' ability');
    abilityHolders.add(species.ab);
    assert.equal(species.base.length, 6);
    assert.ok(['m', 'f', 'n'].includes(species.g));
    for (const [level, moveId] of species.learn) assert.ok(R.MOVES[moveId] && level >= 1 && level <= 50, id + ' learns ' + moveId);
    assert.ok(R.movesAtLevel(id, 50).length <= 4, id + ' has at most 4 moves');
    assert.ok(R.makeMon(id, 5).moves.length >= 1);
    if (species.evo) assert.ok(R.SPECIES[species.evo.to]);
  }
  for (const ability of R.ABILITY_IDS) assert.ok(abilityHolders.has(ability), 'ability ' + ability + ' is held by someone');
  assert.equal(Object.keys(R.SPECIES).length, 14, '12 MVP creatures and 2 parody characters');
  same(R.DEX_ORDER.slice().sort(), Object.keys(R.SPECIES).sort());
  for (const id of R.ITEM_IDS) assert.ok(R.ITEMS[id]);
  for (const id of R.SHOP_STOCK) assert.ok(R.ITEMS[id]);
  for (const id of Object.keys(R.START_BAG)) assert.ok(R.ITEMS[id]);
  const looks = [...html.matchAll(/^ {2}(\w+): \{ skin:/gm)].map((m) => m[1]);
  assert.ok(looks.length >= 15);
  for (const [id, trainer] of Object.entries(R.TRAINERS)) {
    assert.ok(looks.includes(trainer.look), id + ' look');
    assert.ok(trainer.team.length >= 1 && trainer.team.length <= 6);
    for (const entry of trainer.team) assert.ok(entry.sp === '$rival' || R.SPECIES[entry.sp], id + ' team member ' + entry.sp);
    for (const item of trainer.items) assert.ok(R.ITEMS[item]);
    for (const starter of R.STARTERS) assert.equal(R.buildTrainerTeam(id, starter).length, trainer.team.length);
  }
  assert.equal(R.TRAINERS.kotsos.team.length, 3, 'the boss has a team of 3');
  for (const starter of R.STARTERS) assert.ok(R.STARTERS.includes(R.RIVAL_STARTER[starter]));
  for (const [mapId, map] of Object.entries(R.MAPS)) {
    for (const warp of map.warps) assert.ok(R.MAPS[warp.to] && !R.tileDef(R.MAPS[warp.to], warp.tx, warp.ty).solid, mapId + ' warp to ' + warp.to);
    for (const npc of map.npcs) {
      assert.ok(looks.includes(npc.look), mapId + ':' + npc.id + ' look ' + npc.look);
      assert.ok(!R.tileDef(map, npc.x, npc.y).solid, mapId + ':' + npc.id + ' stands on a solid tile');
      if (npc.trainer) assert.ok(R.TRAINERS[npc.trainer]);
    }
    for (const zone of map.zones || []) for (const entry of zone.table) assert.ok(R.SPECIES[entry.sp] && entry.min <= entry.max);
    assert.ok(R.STRINGS[map.name], mapId + ' name string');
  }
  for (const id of Object.keys(R.TRAINERS)) {
    const last = R.TRAINERS[id].team[R.TRAINERS[id].team.length - 1];
    assert.ok(last.lv <= 20);
  }
});

// ---- Strings ----
test('strings: every key has Greek and English, same {placeholders}, gender wording only where it makes sense', () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  const keys = Object.keys(R.STRINGS);
  assert.ok(keys.length > 250);
  for (const key of keys) {
    const entry = R.STRINGS[key];
    assert.equal(entry.length, 2, key);
    assert.ok(typeof entry[0] === 'string' && entry[0].length > 0, key + ' Greek');
    assert.ok(typeof entry[1] === 'string' && entry[1].length > 0, key + ' English');
    assert.equal(placeholders(entry[0]), placeholders(entry[1]), key + ' placeholders');
    assert.ok(!/\{[^{}|]*\|[^{}|]*\}/.test(entry[1]), key + ' English must not use gender wording');
  }
  assert.equal(R.formatText('Είσαι έτοιμ{ος|η};', {}, 'f'), 'Είσαι έτοιμη;');
  assert.equal(R.formatText('Είσαι έτοιμ{ος|η};', {}, 'm'), 'Είσαι έτοιμος;');
  assert.equal(R.formatText('Hi {name}, {n}!', { name: 'Α', n: 3 }, 'm'), 'Hi Α, 3!');
  assert.notEqual(R.lookupString('menu.bag', 'el'), R.lookupString('menu.bag', 'en'));
  assert.equal(R.lookupString('no.such.key', 'en'), 'no.such.key');
});
test('strings: every key the code asks for exists, including the keys built from data', () => {
  const S = R.STRINGS;
  const need = (key) => assert.ok(S[key], 'missing string ' + key);
  const used = new Set();
  for (const m of html.matchAll(/\b(?:T|say|askYesNo)\('([A-Za-z0-9_.]*[A-Za-z0-9_])'/g)) used.add(m[1]);
  for (const m of html.matchAll(/logMsg\(battle, '([A-Za-z0-9_.]*[A-Za-z0-9_])'(?! \+)/g)) used.add(m[1]);
  for (const m of html.matchAll(/sayAll\(\[([^\]]*)\]/g)) for (const k of m[1].matchAll(/'([^']+)'/g)) used.add(k[1]);
  for (const m of html.matchAll(/'((?:sign|npc|warp)\.[A-Za-z0-9.]+)'/g)) used.add(m[1]);
  for (const key of used) need(key);
  for (const id of R.TYPE_IDS) need('type.' + id);
  for (const id of R.ABILITY_IDS) { need('ab.' + id); need('abd.' + id); }
  for (const id of Object.keys(R.STATUSES)) { need('st.' + id); need('st.' + id + '.short'); need('b.st.' + id); if (R.STATUSES[id].turns > 0) need('b.stend.' + id); }
  for (const id of Object.keys(R.MOVES)) need('move.' + id);
  for (const id of Object.keys(R.SPECIES)) need('sp.' + id);
  for (const id of R.ITEM_IDS) { need('item.' + id); need('itemd.' + id); }
  for (const key of R.STAT_KEYS.concat(['acc'])) need('stat.' + key);
  for (const key of ['p', 'r', 's']) need('cat.' + key);
  for (const n of [0, 1, 2]) { need('b.rec.out' + n); need('opt.speed' + n); }
  for (const [id, map] of Object.entries(R.MAPS)) {
    need(map.name);
    for (const key of Object.values(map.signs)) need(key);
    for (const npc of map.npcs) if (npc.text) need(npc.text);
    for (const warp of map.warps) if (warp.lockedText) need(warp.lockedText);
  }
  for (const id of Object.keys(R.TRAINERS)) if (id !== 'rival1') for (const part of ['intro', 'win', 'after']) need('tr.' + id + '.' + part);
});

test('strings: no battle text copies another monster game, and no masculine-only form is addressed to the player', () => {
  const copied = [/what will .* do/i, /\bused \{move\}/i, /^go,/i, /come back/i, /^a critical hit/i, /super effective/i, /not very effective/i, /blacked out/i,
    /is evolving/i, /wants to learn/i, /^congratulations! it/i, /sends out/i, /\bmissed!/i, /^hit \{n\} times/i];
  const copiedGreek = [/χρησιμοποίησε/, /Σούπερ αποτελεσματικό/, /Εύστοχο χτύπημα/, /στέλνει στη μάχη/, /τι κάνει;/, /Επιστρέφει:/, /Λιποθύμησες/, /εξελίσσεται\.\.\./, /Συγχαρητήρια/];
  for (const [key, [greek, english]] of Object.entries(R.STRINGS)) {
    for (const pattern of copied) assert.ok(!pattern.test(english), key + ' (English) copies a known line: ' + english);
    for (const pattern of copiedGreek) assert.ok(!pattern.test(greek), key + ' (Greek) copies a known line: ' + greek);
  }
  for (const kind of ['wild', 'trainer']) assert.ok(!/^(Wild|Foe) /.test(R.monLabel({ sp: 'komma', side: 1 }, 'en', kind)));
  // The player may be a woman: forms that only fit a man must sit inside a {man|woman} choice.
  const masculineOnly = /(διάσημος|μόνος|έτοιμος|ανιψιέ|φίλε|κύριε|νεαρέ|αγόρι μου|γίνεις προπονητής)/;
  for (const [key, [greek]] of Object.entries(R.STRINGS)) {
    const outsideChoices = greek.replace(/\{[^{}|]*\|[^{}|]*\}/g, '');
    assert.ok(!masculineOnly.test(outsideChoices), key + ' addresses the player with a masculine-only form: ' + greek);
  }
  assert.equal(R.formatText(R.STRINGS['warp.studio'][0], {}, 'f').includes('διάσημη'), true);
  assert.equal(R.formatText(R.STRINGS['tr.kotsos.intro'][0], {}, 'f').includes('ανιψιά'), true);
});

// ---- Save ----
const sampleV1 = () => ({
  version: 1, player: { name: 'ΜΑΡΙΑ', gender: 'f', map: 'town', x: 5, y: 8, dir: 'left' },
  party: [R.serializeMon(R.makeMon('komma', 9)), R.serializeMon(R.makeMon('fakelakis', 4))], money: 777, bag: { fakelaki: 2, souvlaki: 1 },
  dex: { seen: { komma: true, fakelakis: true, storoula: true }, got: { komma: true } }, flags: { rival1: true, t_rival1: true },
  lastHeal: { map: 'kep', x: 4, y: 6, dir: 'up' }, options: { lang: 'en', sound: false, textSpeed: 2, reduceMotion: true }, rngState: 4242, starter: 'komma',
});
test('save migration: a version-0 save becomes the current version (2); the current version is stable; bad data is refused', () => {
  const v0 = { v: 0, name: 'ΝΙΚΟΣ', girl: false, drachmas: 123, team: [{ id: 'psaltak', lv: 6, xp: 130, hp: 20 }, { id: 'nonsense', lv: 3 }], map: 'town', x: 5, y: 8, items: { fakelaki: 3, bogus: 9 }, seen: ['komma'], got: ['psaltak'] };
  const migrated = R.migrateSave(v0);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.player.name, 'ΝΙΚΟΣ');
  assert.equal(migrated.player.gender, 'm');
  assert.equal(migrated.money, 123);
  assert.equal(migrated.party.length, 1);
  assert.equal(migrated.party[0].sp, 'psaltak');
  assert.equal(migrated.party[0].lv, 6);
  assert.equal(migrated.bag.fakelaki, 3);
  assert.equal(migrated.bag.bogus, undefined);
  assert.ok(migrated.dex.seen.komma && migrated.dex.got.psaltak);
  assert.equal(migrated.player.map, 'town');
  assert.equal(R.migrateSave(Object.assign({}, v0, { girl: true })).player.gender, 'f');
  // a shape without a version number is treated as version 0 too
  assert.equal(R.migrateSave({ name: 'Α', drachmas: 5, team: [{ id: 'komma', lv: 5 }] }).version, 2);
  const v1 = R.migrateSave(sampleV1());
  same(R.migrateSave(JSON.parse(JSON.stringify(v1))), v1);
  assert.equal(v1.options.lang, 'en');
  assert.equal(v1.player.x, 5);
  assert.equal(R.migrateSave({ version: 3, party: [R.serializeMon(R.makeMon('komma', 5))] }), null, 'a newer game save is refused');
  assert.equal(R.migrateSave({ version: 2, party: [] }), null);
  assert.equal(R.migrateSave({ version: 1, party: [] }), null);
  assert.equal(R.migrateSave(null), null);
  assert.equal(R.migrateSave('text'), null);
  // clamped values and unknown places fall back to safe ones
  const odd = sampleV1();
  odd.party[0].lv = 999; odd.player.map = 'atlantis'; odd.money = -5; odd.party.push({ sp: 'komma', lv: 3 }, {}, null, 7, 8, 9, 10);
  const fixed = R.migrateSave(odd);
  assert.equal(fixed.party[0].lv, 50);
  assert.equal(fixed.player.map, R.START_MAP.map);
  assert.equal(fixed.money, 0);
  assert.ok(fixed.party.length <= 6);
  assert.equal(R.SAVE_KEY, 'mizamon.v1.save');
  assert.equal(R.SAVE_VERSION, 2);
});
test('save migration: a version-0 save gets its story flags back (starter chosen, rival met)', () => {
  const v0 = { v: 0, name: 'ΝΙΚΟΣ', girl: false, drachmas: 10, team: [{ id: 'komma', lv: 5, xp: 75, hp: 20 }], map: 'town', x: 5, y: 8 };
  const outside = R.migrateSave(v0);
  assert.equal(outside.flags.gotStarter, true);
  assert.equal(outside.flags.rival1, true, 'the rival meeting happens when leaving the lab');
  assert.equal(outside.flags.t_rival1, true);
  assert.equal(R.MAPS.town.triggers[0].flag, 'rival1', 'with the flag set, the doorstep fight does not repeat');
  const inLab = R.migrateSave(Object.assign({}, v0, { map: 'lab', x: 4, y: 6 }));
  assert.equal(inLab.flags.gotStarter, true);
  assert.equal(inLab.flags.rival1, undefined, 'still in the lab: the rival has not been met');
  assert.equal(inLab.flags.t_rival1, undefined);
  same(R.migrateSave(JSON.parse(JSON.stringify(outside))).flags, outside.flags);
});

// ---- Hospital (MZ-HOSP-01) ----
const monsOf = (species, level, count) => Array.from({ length: count }, () => R.makeMon(species, level));
const HOSPITAL_SPOT = { map: 'hospital', x: 5, y: 7, dir: 'up' };
test('archive: deposit and withdraw keep the creature as it is; the last creature able to fight never leaves; the archive holds 60', () => {
  const party = [R.makeMon('komma', 8), R.makeMon('fakelakis', 4)];
  const archive = [];
  assert.equal(R.ARCHIVE_MAX, 60);
  assert.equal(R.canDeposit([R.makeMon('komma', 5)], archive, 0), false, 'a team of one never goes down to zero');
  party[1].hp = 0;
  assert.equal(R.canDeposit(party, archive, 0), false, 'the only creature able to fight stays');
  assert.equal(R.depositMon(party, archive, 0), false);
  assert.equal(party.length, 2);
  assert.equal(R.canDeposit(party, archive, 1), true, 'a fainted one may go');
  party[1].hp = 5;
  assert.equal(R.depositMon(party, archive, 1), true);
  assert.equal(party.length, 1);
  assert.equal(archive.length, 1);
  assert.equal(archive[0].sp, 'fakelakis');
  assert.equal(archive[0].hp, 5, 'level, moves and HP travel with it');
  assert.equal(R.depositMon(party, archive, 0), false, 'the last one stays');
  assert.equal(R.depositMon(party, archive, 7), false, 'no such team member');
  assert.equal(R.canWithdraw(party, archive, 1), false, 'no such archive entry');
  assert.equal(R.withdrawMon(party, archive, 0), true);
  assert.equal(party.length, 2);
  assert.equal(archive.length, 0);
  assert.equal(party[1].sp, 'fakelakis');
  const fullTeam = monsOf('komma', 3, R.PARTY_MAX);
  const stored = [R.makeMon('fakelakis', 3)];
  assert.equal(R.canWithdraw(fullTeam, stored, 0), false, 'a full team has no room');
  assert.equal(R.withdrawMon(fullTeam, stored, 0), false);
  assert.ok(fullTeam.length === R.PARTY_MAX && stored.length === 1);
  const two = monsOf('komma', 5, 2);
  assert.equal(R.canDeposit(two, monsOf('komma', 3, 60), 0), false, 'a full archive refuses');
  assert.equal(R.depositMon(two, monsOf('komma', 3, 60), 0), false);
  assert.equal(R.canDeposit(two, monsOf('komma', 3, 59), 0), true, 'one free slot is enough');
});
test('archive: a recruit with a full team goes to the archive; a full archive (or none) still refuses', () => {
  let archived = false;
  for (let seed = 1; seed <= 60 && !archived; seed++) {
    const foe = R.makeMon('fakelakis', 3);
    foe.hp = 1;
    const team = monsOf('komma', 8, R.PARTY_MAX);
    const archive = [];
    const bag = { fakelaki: 5 };
    const b = R.createBattle(team, [foe], R.makeRng(seed), { kind: 'wild', bag, archive });
    const keys = keysOf(R.playTurn(b, { t: 'recruit', id: 'fakelaki' }));
    assert.equal(bag.fakelaki, 4, 'the offer costs the item');
    assert.equal(team.length, R.PARTY_MAX, 'the team stays at 6');
    if (b.recruited.length === 0) { assert.equal(archive.length, 0); continue; }
    archived = true;
    assert.equal(archive.length, 1);
    assert.equal(archive[0].sp, 'fakelakis');
    assert.equal(archive[0].status, null);
    assert.ok(keys.includes('b.rec.ok') && keys.includes('b.rec.archived'), 'the "went to the archive" line plays');
    assert.ok(b.over && b.winner === 0);
  }
  assert.ok(archived, 'some seed recruits');
  const foe = R.makeMon('fakelakis', 3);
  foe.hp = 1;
  const packed = monsOf('komma', 3, R.ARCHIVE_MAX);
  const full = R.createBattle(monsOf('komma', 8, R.PARTY_MAX), [foe], R.makeRng(1), { kind: 'wild', bag: { fakelaki: 5 }, archive: packed });
  assert.ok(keysOf(R.playTurn(full, { t: 'recruit', id: 'fakelaki' })).includes('b.rec.full'));
  assert.equal(full.bag.fakelaki, 5, 'a refused offer keeps the item');
  assert.equal(packed.length, R.ARCHIVE_MAX);
  const noArchive = R.createBattle(monsOf('komma', 8, R.PARTY_MAX), [R.makeMon('fakelakis', 3)], R.makeRng(1), { kind: 'wild', bag: { fakelaki: 5 } });
  assert.ok(keysOf(R.playTurn(noArchive, { t: 'recruit', id: 'fakelaki' })).includes('b.rec.full'));
  const run = html.slice(html.indexOf('async function runBattle'), html.indexOf('// ---- Game flow'));
  assert.ok(run.includes('archive: G.archive'), 'the game gives the battle its archive');
});
test('save v2: the archive is saved; version 1 gets an empty archive and its ΚΕΠ heal spot becomes the hospital; version 0 goes through version 1', () => {
  const fromV1 = R.migrateSave(sampleV1());
  assert.equal(fromV1.version, 2);
  same(fromV1.archive, []);
  same(fromV1.lastHeal, HOSPITAL_SPOT);
  assert.equal(fromV1.player.x, 5, 'the rest of the save is untouched');
  assert.equal(fromV1.party.length, 2);
  const onLot = R.migrateSave(Object.assign(sampleV1(), { player: { name: 'ΜΑΡΙΑ', gender: 'f', map: 'town', x: 14, y: 11, dir: 'left' } }));
  assert.ok(onLot.player.map === 'town' && onLot.player.x === 15 && onLot.player.y === 14 && onLot.player.dir === 'down', 'a version-1 save on the hospital lot loads in front of the hospital door');
  const v0 = { v: 0, name: 'ΝΙΚΟΣ', girl: false, drachmas: 5, team: [{ id: 'komma', lv: 5, xp: 75, hp: 20 }], map: 'town', x: 5, y: 8 };
  const fromV0 = R.migrateSave(v0);
  assert.equal(fromV0.version, 2);
  same(fromV0.archive, []);
  same(fromV0.lastHeal, HOSPITAL_SPOT);
  const withArchive = Object.assign(sampleV1(), {
    version: 2, lastHeal: HOSPITAL_SPOT,
    archive: [R.serializeMon(R.makeMon('storoula', 7)), null, { sp: 'nonsense', lv: 3 }, R.serializeMon(R.makeMon('laikatzis', 99))],
  });
  const current = R.migrateSave(withArchive);
  assert.equal(current.archive.length, 2, 'bad entries are dropped');
  assert.ok(current.archive[0].sp === 'storoula' && current.archive[0].lv === 7);
  assert.equal(current.archive[1].lv, 50, 'levels are clamped');
  assert.ok(current.dex.got.storoula && current.dex.got.laikatzis, 'archived creatures count as recruited');
  same(current.lastHeal, HOSPITAL_SPOT);
  same(R.migrateSave(JSON.parse(JSON.stringify(current))), current);
  const crowded = Object.assign(sampleV1(), { version: 2, archive: monsOf('komma', 3, 70).map(R.serializeMon) });
  assert.equal(R.migrateSave(crowded).archive.length, R.ARCHIVE_MAX, 'the archive is cut at its capacity');
  const state = html.slice(html.indexOf('function newGameState'), html.indexOf('// ---- Canvas and scaling'));
  assert.ok(state.includes('archive: []') && state.includes('archive: G.archive.map(serializeMon)') && state.includes('archive: save.archive.map(restoreMon)'), 'new game, save and load all carry the archive');
});
test('hospital heal: the whole team gets full HP and no status; the VIP service spends one Φακελάκι only when asked and owned', () => {
  const sick = () => {
    const team = monsOf('komma', 8, 3);
    team[0].hp = 1; team[0].status = { id: 'sca', turns: 0 };
    team[1].hp = 0;
    team[2].status = { id: 'str', turns: 2 };
    return team;
  };
  const check = (team) => { for (const mon of team) { assert.equal(mon.hp, R.maxHp(mon)); assert.equal(mon.status, null); } };
  const plain = sick(); const plainBag = { fakelaki: 2 };
  assert.equal(R.hospitalHeal(plain, plainBag, false), false);
  check(plain);
  assert.equal(plainBag.fakelaki, 2, 'no VIP: nothing is spent');
  const vip = sick(); const vipBag = { fakelaki: 2 };
  assert.equal(R.hospitalHeal(vip, vipBag, true), true);
  check(vip);
  assert.equal(vipBag.fakelaki, 1, 'VIP spends exactly one');
  const poor = sick(); const poorBag = { fakelaki: 0 };
  assert.equal(R.hospitalHeal(poor, poorBag, true), false, 'the envelope is never required');
  check(poor);
  assert.equal(poorBag.fakelaki, 0);
  const none = sick();
  assert.equal(R.hospitalHeal(none, {}, true), false);
  check(none);
});
test('the black-out spot is the hospital; the ΚΕΠ no longer heals; the engine heals and sends the player there', () => {
  same(R.HOSPITAL_SPOT, HOSPITAL_SPOT);
  same(R.DEFAULT_HEAL_SPOT, HOSPITAL_SPOT);
  assert.ok(!R.tileDef(R.MAPS.hospital, HOSPITAL_SPOT.x, HOSPITAL_SPOT.y).solid, 'the spot is a floor tile');
  const start = R.START_MAP;
  assert.ok(R.reachableTiles(start.map, start.x, start.y, {}).has('hospital:' + HOSPITAL_SPOT.x + ':' + HOSPITAL_SPOT.y), 'the spot can be reached on foot');
  assert.ok(R.MAPS.town.warps.some((warp) => warp.to === 'hospital'), 'the town has the hospital door');
  assert.notEqual(R.MAPS.kep.npcs.find((npc) => npc.id === 'kepclerk').kind, 'heal', 'the ΚΕΠ clerk does not heal');
  assert.ok(R.MAPS.hospital.npcs.some((npc) => npc.kind === 'heal'), 'the hospital receptionist heals');
  const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));
  const blackout = part('OverworldLayer.prototype.blackout', 'OverworldLayer.prototype.bossVictory');
  assert.ok(blackout.includes('hospitalHeal(') && blackout.includes('teleport(G.lastHeal)') && blackout.includes("'blackout.hospital'"), 'black-out: heal, go to the saved spot, hospital line');
  const heal = part('OverworldLayer.prototype.healAtHospital', 'OverworldLayer.prototype.useArchive');
  assert.ok(heal.includes('hospitalHeal(') && heal.includes('G.lastHeal = Object.assign({}, HOSPITAL_SPOT)'), 'a visit heals and keeps the hospital as the return point');
  const kep = part('OverworldLayer.prototype.talkKep', 'OverworldLayer.prototype.healAtHospital');
  assert.ok(!kep.includes('healMon') && !kep.includes('hospitalHeal') && kep.includes("'kep.comeBack'"), 'the ΚΕΠ only jokes');
  assert.ok(html.includes('lastHeal: Object.assign({}, DEFAULT_HEAL_SPOT)'), 'a new game starts with the hospital as the return point');
  for (const [key, greek, english] of [['blackout.hospital', 'Νοσοκομείο', 'Hospital']]) {
    assert.ok(R.STRINGS[key][0].includes(greek) && R.STRINGS[key][1].includes(english), key);
  }
  assert.ok(!/ΚΕΠ/.test(R.STRINGS['blackout.hospital'][0] + R.STRINGS['blackout.text'][0]), 'no black-out text names the ΚΕΠ any more');
  assert.equal(R.STRINGS['blackout.kep'], undefined, 'the old ΚΕΠ black-out line is gone');
});
test('hospital map: counter reach, terminal, furniture, four waiting people, the town stays connected', () => {
  const start = R.START_MAP;
  const all = R.reachableTiles(start.map, start.x, start.y, { credits: true });
  const hospital = R.MAPS.hospital;
  assert.equal(R.MAPS.hospital.name, 'map.hospital');
  const receptionist = hospital.npcs.find((npc) => npc.kind === 'heal');
  assert.ok(R.tileDef(hospital, receptionist.x, receptionist.y + 1).counter, 'the receptionist sits behind a counter');
  assert.ok(R.npcTalkable('hospital', receptionist, all), 'the receptionist can be talked to across the counter');
  for (const [key, action] of Object.entries(hospital.actions)) {
    const [x, y] = key.split(',').map(Number);
    assert.equal(action, 'archive');
    assert.equal(R.tileAt(hospital, x, y), 'A', 'the archive terminal tile');
    assert.equal(x + ',' + y, '1,3', 'the terminal is at the left, away from the reception counter');
    assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => all.has('hospital:' + (x + dx) + ':' + (y + dy))), 'the terminal can be used');
  }
  assert.equal(Object.keys(hospital.actions).length, 1);
  assert.ok(R.tileAt(hospital, 10, 3) === 'V' && R.tileAt(hospital, 5, 3) === 'Y', 'vending machine and TV');
  assert.ok(Object.values(hospital.signs).includes('sign.hosp.vending') && Object.values(hospital.signs).includes('sign.hosp.tv'));
  assert.ok(hospital.rows.join('').split('B').length - 1 >= 4, 'at least four corridor cots (ράντζα)');
  const waiting = hospital.npcs.filter((npc) => npc.kind === 'talk' && npc.id.startsWith('hospwait'));
  assert.equal(waiting.length, 4);
  assert.equal(new Set(waiting.map((npc) => npc.text)).size, 4, 'four different lines');
  assert.ok(/Φακελάκι/.test(R.STRINGS['npc.hosp.doctor'][0]), 'the doctor hints at an envelope');
  hospital.rows.forEach((row, y) => [...row].forEach((char, x) => {
    if (y >= 3 && (char === 'L' || char === 'm') && !hospital.npcs.some((npc) => npc.x === x && npc.y === y)) assert.ok(all.has('hospital:' + x + ':' + y), 'floor ' + x + ',' + y + ' reachable');
  }));
  const town = R.MAPS.town;
  town.rows.forEach((row, y) => [...row].forEach((char, x) => {
    const blocked = R.tileDef(town, x, y).solid || town.npcs.some((npc) => npc.x === x && npc.y === y);
    if (!blocked) assert.ok(all.has('town:' + x + ':' + y), 'town tile ' + x + ',' + y + ' (' + char + ') reachable');
  }));
  const door = town.warps.find((warp) => warp.to === 'hospital');
  assert.ok(R.tileAt(town, door.x, door.y) === 'E' && hospital.warps.every((warp) => warp.to === 'town' && warp.tx === door.x && warp.ty === door.y + 1));
});
test('hospital strings: every new key has both languages, the code finds them, gender wording is used, and nothing copies another game', () => {
  const S = R.STRINGS;
  const hospitalKeys = Object.keys(S).filter((key) => /^(hosp|arch|sign\.hosp|npc\.hosp)\./.test(key) || ['b.rec.archived', 'blackout.hospital', 'kep.comeBack', 'map.hospital', 'sign.hospital'].includes(key));
  assert.ok(hospitalKeys.length >= 30, hospitalKeys.length + ' keys');
  for (const key of ['arch.pickDeposit', 'arch.pickWithdraw', 'arch.listTitle', 'arch.count', 'hosp.monitor', 'hosp.monitorNote', 'hosp.vipAsk', 'hosp.vipTaken', 'hosp.atOnce', 'hosp.done', 'hosp.doneVip']) assert.ok(S[key], key);
  for (const key of hospitalKeys) assert.ok(S[key][0].length > 3 && S[key][1].length > 3 && S[key][0] !== S[key][1], key + ' has two different languages');
  assert.equal(R.formatText(S['hosp.free'][0], {}, 'f').includes('για όποιον έχει υπομονή'), true, 'no gendered adjective: the line reads the same for both');
  assert.equal(R.formatText(S['hosp.free'][0], {}, 'm'), R.formatText(S['hosp.free'][0], {}, 'f'));
  const copiedEnglish = /nurse|joy\b|pok[eé]|red cross|we hope to see you again|restored to full|welcome to our|we heal your/i;
  const copiedGreek = /νοσοκόμα|τζόι|κόκκινος σταυρός|ελπίζουμε να σε ξαναδούμε|θα σε ξαναδούμε|καλώς ήρθες στο κέντρο|θεραπεύουμε/i;
  for (const key of hospitalKeys) {
    assert.ok(!copiedEnglish.test(S[key][1]), key + ' (English) copies a known line: ' + S[key][1]);
    assert.ok(!copiedGreek.test(S[key][0]), key + ' (Greek) copies a known line: ' + S[key][0]);
  }
  assert.ok(/3 έως 5/.test(S['hosp.hello'][0]) && /3 to 5/.test(S['hosp.hello'][1]), 'the "3 to 5 years" joke');
  assert.ok(/Φακελάκι/.test(S['hosp.vipAsk'][0]), 'the VIP offer names the item');
  assert.ok(!/(^|\s)(ασθενής|ασθενείς|αρρώστ|πάσχ|καρκίν|θάνατ)/i.test(hospitalKeys.map((key) => S[key][0]).join(' ')), 'the jokes are about the system, never about patients or illness');
});
test('hospital look: green cross and blue Η, teal roof and mint walls, no red cross, no red roof with white walls, no nurse', () => {
  const builder = html.slice(html.indexOf('const HOSPITAL_GREEN'), html.indexOf('function buildTileSprites'));
  assert.ok(builder.includes("make('P'") && builder.includes('HOSPITAL_GREEN'), 'the cross is green');
  assert.ok(builder.includes("make('H'") && builder.includes("'#2a5fc4'"), 'the Η plate is blue');
  assert.ok(builder.includes("make('6', function (p) { drawRoofTile(p, HOSPITAL_TEAL)"), 'a teal roof');
  assert.ok(builder.includes("'#d9efe6'"), 'mint, not white, walls');
  const outside = builder.slice(builder.indexOf("make('6'"), builder.indexOf("make('i'"));
  const colors = [...outside.matchAll(/'#([0-9a-f]{6})'/gi)].map((m) => [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)));
  assert.ok(colors.length >= 15);
  assert.ok(colors.every(([r, g, b]) => !(r > 140 && g < 110 && b < 110)), 'no red anywhere on the outside of the hospital');
  assert.ok(!html.includes('nurse:') && !/look: 'nurse'/.test(html), 'no nurse look');
  assert.ok(html.includes("hospital: [[1000, 0.05, 'sine'"), 'its own blip sequence');
  const monitor = html.slice(html.indexOf('function MonitorLayer'), html.indexOf('function BadgeLayer'));
  assert.ok(monitor.includes('OPT.reduceMotion') && monitor.includes("Sound.sfx('hospital')"), 'the monitor respects Reduced motion and plays the blips');
});

test('options are normalised', () => {
  same(R.normalizeOptions(null), R.defaultOptions());
  assert.equal(R.normalizeOptions({ lang: 'fr', textSpeed: 9 }).lang, 'el');
  assert.equal(R.normalizeOptions({ lang: 'en' }).lang, 'en');
});
test('the Φάκελος prize rule: boss prize and Αφορολόγητο bonus', () => {
  const b = R.createBattle([R.makeMon('komma', 10)], R.buildTrainerTeam('kotsos', 'komma'), R.makeRng(1), { kind: 'trainer', trainerId: 'kotsos', foeName: 'K', bag: {} });
  assert.equal(R.prizeFor(b, R.TRAINERS.kotsos), 13 * 30 + 200);
  const rich = R.createBattle([R.makeMon('fakelarchis', 10)], R.buildTrainerTeam('kotsos', 'komma'), R.makeRng(1), { kind: 'trainer', trainerId: 'kotsos', foeName: 'K', bag: {} });
  assert.equal(R.prizeFor(rich, R.TRAINERS.kotsos), Math.floor((13 * 30 + 200) * 1.5));
});


// ---- Engine facts the headless tests can still check in the source text ----
test('a battle that throws counts as neither a win nor a loss ("ran"), and Reduced motion follows the OS by default', () => {
  const run = html.slice(html.indexOf('async function runBattle'), html.indexOf('// ---- Game flow'));
  const caught = run.slice(run.indexOf('catch (error)'), run.indexOf('await Fade.start(1, 12)'));
  assert.ok(caught.includes("result = 'ran'") && !caught.includes("'win'") && caught.includes('console.error'), 'the catch block returns ran and logs');
  assert.ok(html.includes("matchMedia('(prefers-reduced-motion: reduce)')"), 'the OS Reduced motion setting is read');
  const load = html.slice(html.indexOf('function loadOptions'), html.indexOf('function saveOptions'));
  assert.ok(load.includes('systemPrefersReducedMotion()'), 'it is the default when nothing is saved');
  const faint = html.slice(html.indexOf("fx.kind === 'faint') {"), html.indexOf("fx.kind === 'enter'"));
  assert.ok(faint.includes('OPT.reduceMotion'), 'the faint animation checks Reduced motion');
});

// ---- Run (only when this file is started directly; balance.mjs imports loadRules) ----
if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL('file:///' + process.argv[1].replace(/\\/g, '/')))) runAll();
function runAll() {
let passed = 0;
const failures = [];
for (const { name, fn } of tests) {
  try {
    fn();
    passed++;
    console.log('ok   ' + name);
  } catch (error) {
    failures.push({ name, error });
    console.log('FAIL ' + name + '\n     ' + String(error && error.message ? error.message : error).split('\n').join('\n     '));
  }
}
console.log('PASS ' + passed + ' / ' + tests.length);
if (failures.length > 0) process.exit(1);
}
