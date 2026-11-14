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
  const all = R.reachableTiles(start.map, start.x, start.y, { credits: true, badge: true }); // route 2 and Καστέλλα open with the Port Medal (flag badge)
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
  assert.equal(Object.keys(R.SPECIES).length, 15, '12 MVP creatures, Εφοπλιστάκος (MZ-WORLD-02a) and 2 parody characters');
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
test('save migration: a version-0 save becomes the current version (3); the current version is stable; bad data is refused', () => {
  const v0 = { v: 0, name: 'ΝΙΚΟΣ', girl: false, drachmas: 123, team: [{ id: 'psaltak', lv: 6, xp: 130, hp: 20 }, { id: 'nonsense', lv: 3 }], map: 'town', x: 5, y: 8, items: { fakelaki: 3, bogus: 9 }, seen: ['komma'], got: ['psaltak'] };
  const migrated = R.migrateSave(v0);
  assert.equal(migrated.version, 3);
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
  assert.equal(R.migrateSave({ name: 'Α', drachmas: 5, team: [{ id: 'komma', lv: 5 }] }).version, 3);
  const v1 = R.migrateSave(sampleV1());
  same(R.migrateSave(JSON.parse(JSON.stringify(v1))), v1);
  assert.equal(v1.options.lang, 'en');
  assert.equal(v1.player.x, 5);
  assert.equal(R.migrateSave({ version: 4, party: [R.serializeMon(R.makeMon('komma', 5))] }), null, 'a newer game save is refused');
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
  assert.equal(R.SAVE_VERSION, 3);
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
  assert.equal(fromV1.version, 3);
  same(fromV1.archive, []);
  same(fromV1.lastHeal, HOSPITAL_SPOT);
  assert.equal(fromV1.player.x, 5, 'the rest of the save is untouched');
  assert.equal(fromV1.party.length, 2);
  const onLot = R.migrateSave(Object.assign(sampleV1(), { player: { name: 'ΜΑΡΙΑ', gender: 'f', map: 'town', x: 14, y: 11, dir: 'left' } }));
  assert.ok(onLot.player.map === 'town' && onLot.player.x === 15 && onLot.player.y === 14 && onLot.player.dir === 'down', 'a version-1 save on the hospital lot loads in front of the hospital door');
  const v0 = { v: 0, name: 'ΝΙΚΟΣ', girl: false, drachmas: 5, team: [{ id: 'komma', lv: 5, xp: 75, hp: 20 }], map: 'town', x: 5, y: 8 };
  const fromV0 = R.migrateSave(v0);
  assert.equal(fromV0.version, 3);
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
  assert.ok(heal.includes('hospitalHeal(') && heal.includes('G.lastHeal = Object.assign({}, HOSPITAL_SPOT, { map: this.mapId })'), 'a visit heals and keeps the hospital as the return point');
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


// ---- World and map screen (MZ-MAP-01) ----
const W = R.WORLD;
const isLandChar = (char) => char !== undefined && char !== '~' && char !== '#';
const routeIds = Object.keys(W.routes);
const routeNumber = (id) => Number(id.replace('route', ''));
const pathLength = (path) => path.slice(1).reduce((sum, cell, index) => sum + Math.hypot(cell[0] - path[index][0], cell[1] - path[index][1]), 0);
// The map sizes of the 12 routes: route 1 is built (the real map), the others are the sizes of the build plan (section 11.7).
const ROUTE_SIZES = {
  route1: [32, 18], route2: [40, 14], route3: [40, 14], route4: [36, 20], route5: [36, 16], route6: [40, 16], route7: [32, 18], route8: [44, 14],
  route9: [44, 12], route10: [36, 18], route11: [36, 14], route12: [40, 16],
};

test('WORLD grid: 30 x 15, only known cells, six districts in play order, every label and every hill inside its district', () => {
  assert.equal(W.cols, 30);
  assert.equal(W.rows, 15);
  assert.equal(W.grid.length, 15);
  const letters = Object.values(W.districts).map((district) => district.letter);
  assert.equal(new Set(letters).size, 6);
  for (const row of W.grid) {
    assert.equal(row.length, 30);
    for (const char of row) assert.ok(char === '~' || char === '#' || letters.includes(char.toUpperCase()), 'grid cell ' + char);
  }
  same(Object.values(W.districts).map((district) => district.order).sort(), [1, 2, 3, 4, 5, 6]);
  for (const [id, district] of Object.entries(W.districts)) {
    assert.equal(district.id, id);
    assert.ok(W.grid.some((row) => row.includes(district.letter)), id + ' has land');
    assert.equal(district.badgeFlag, id === 'peiraias' ? 'badge' : 'badge_' + id, id + ' badge flag');
    assert.ok(district.levels[0] <= district.levels[1]);
    assert.match(district.color, /^#[0-9a-f]{6}$/);
    const labelChar = W.grid[Math.floor(district.label[1])][Math.floor(district.label[0])];
    assert.equal(labelChar.toUpperCase(), district.letter, id + ' label sits inside the district');
    assert.ok(R.STRINGS[district.nameKey], id + ' name string');
  }
  assert.equal(Object.values(W.districts).filter((district) => district.built).length, 1, 'only Peiraias is built');
  assert.equal(W.districts.peiraias.built, true);
  assert.equal(R.WORLD_BADGE_COUNT, 6);
});
test('WORLD places: every node cell is land of its district, only the built district has built places, built places have maps', () => {
  assert.equal(Object.keys(W.nodes).length, 14, '12 towns, the harbour office and the Parliament');
  for (const [id, node] of Object.entries(W.nodes)) {
    assert.equal(node.id, id);
    const district = W.districts[node.district];
    assert.ok(district, id + ' district');
    assert.equal(W.grid[node.cell[1]][node.cell[0]].toUpperCase(), district.letter, id + ' stands on land of its district');
    assert.ok(['town', 'boss', 'door'].includes(node.kind), id + ' kind');
    if (!district.built) assert.equal(node.built, false, id + ' is not built');
    for (const mapId of node.maps) assert.ok(R.MAPS[mapId], id + ' lists the map ' + mapId);
    if (node.built) assert.ok(node.maps.length > 0, id + ' is built and has maps');
  }
  same(Object.keys(W.nodes).filter((id) => W.nodes[id].built), ['newPeiraias', 'harbourOffice', 'kastella']);
  same(Object.keys(W.nodes).filter((id) => W.nodes[id].boss).sort(), ['chaidari', 'glyfada', 'harbourOffice', 'marousi', 'spata', 'syntagma']);
  assert.equal(new Set(Object.values(W.nodes).map((node) => node.cell.join(','))).size, 14, 'no two places share a cell');
});
test('WORLD routes: 12 of them, ends are their places, every point of every path is on land, a known progress, chained in play order', () => {
  assert.equal(routeIds.length, 12);
  routeIds.forEach((id, index) => {
    const route = W.routes[id];
    assert.equal(id, 'route' + (index + 1));
    assert.equal(route.id, id);
    assert.ok(W.nodes[route.a] && W.nodes[route.b], id + ' ends');
    same(route.path[0], W.nodes[route.a].cell);
    same(route.path[route.path.length - 1], W.nodes[route.b].cell);
    route.path.forEach(([x, y], pointIndex) => assert.ok(isLandChar(W.grid[y] && W.grid[y][x]), id + ' point ' + pointIndex + ' is on land (not sea, not outside)'));
    assert.ok(['x', '-x', 'y'].includes(route.progress), id + ' progress ' + route.progress);
    assert.equal(route.map, id, 'the map id of a route is its own id');
    assert.ok(W.districts[route.district]);
    assert.equal(route.built, !!R.MAPS[route.map], id + ' built flag matches the maps');
  });
  same(routeIds.map((id) => W.routes[id].progress), ['x', 'x', 'x', 'x', 'x', 'x', '-x', '-x', '-x', '-x', 'x', 'x'], 'R1-R6, R11, R12 left to right; R7-R10 right to left');
  // connected in the play order: each route starts where the one before ended
  assert.equal(W.routes.route1.a, 'newPeiraias');
  for (let n = 2; n <= 12; n++) assert.equal(W.routes['route' + n].a, W.routes['route' + (n - 1)].b, 'route ' + n + ' starts where route ' + (n - 1) + ' ends');
  assert.equal(W.routes.route12.b, 'syntagma');
  // gates agree with the badge flags: the first route of every district after the first starts in the district before it
  const byOrder = Object.values(W.districts).sort((a, b) => a.order - b.order);
  byOrder.forEach((district, index) => {
    const own = routeIds.filter((id) => W.routes[id].district === district.id).sort((a, b) => routeNumber(a) - routeNumber(b));
    assert.equal(own.length, 2, district.id + ' has two routes');
    if (index > 0) assert.equal(W.nodes[W.routes[own[0]].a].district, byOrder[index - 1].id, district.id + ' is entered from ' + byOrder[index - 1].id + ' (needs its badge ' + byOrder[index - 1].badgeFlag + ')');
  });
});
test('WORLD maps: every map of MAPS belongs to exactly one node or route, and mapNode finds it', () => {
  for (const mapId of Object.keys(R.MAPS)) {
    const owners = Object.values(W.nodes).filter((node) => node.maps.includes(mapId)).length + Object.values(W.routes).filter((route) => route.map === mapId).length;
    assert.equal(owners, 1, mapId + ' belongs to ' + owners + ' places');
    assert.ok(R.mapNode(mapId), mapId);
  }
  assert.equal(R.mapNode('town').id, 'newPeiraias');
  for (const mapId of ['lab', 'kep', 'hospital', 'shop', 'cafe', 'studio']) assert.equal(R.mapNode(mapId).id, 'newPeiraias', mapId);
  assert.equal(R.mapNode('port').id, 'harbourOffice');
  assert.equal(R.mapNode('route1').id, 'route1');
  assert.equal(R.mapNode('atlantis'), null);
  assert.equal(R.worldIsRoute(R.mapNode('route1')), true);
  assert.equal(R.worldIsRoute(R.mapNode('town')), false);
});
test('player marker: for each of the 12 routes the entry tile is within 1/w (1/h) of the first end, the exit tile of the second, the middle between', () => {
  for (const id of routeIds) {
    const route = W.routes[id];
    const [width, height] = ROUTE_SIZES[id];
    const dim = route.progress === 'y' ? height : width;
    const length = pathLength(route.path);
    const entry = route.progress === 'x' ? [0, 5] : (route.progress === '-x' ? [width - 1, 5] : [3, 0]); // where the player comes in from the first end
    const exit = route.progress === 'x' ? [width - 1, 5] : (route.progress === '-x' ? [0, 5] : [3, height - 1]);
    const middle = route.progress === 'y' ? [3, Math.floor(height / 2)] : [Math.floor(width / 2), 5];
    const first = R.routeMarkerFraction(route.progress, entry[0], entry[1], width, height);
    const last = R.routeMarkerFraction(route.progress, exit[0], exit[1], width, height);
    const centre = R.routeMarkerFraction(route.progress, middle[0], middle[1], width, height);
    assert.ok(first >= 0 && first <= 1 / dim + 1e-9, id + ' entry fraction ' + first);
    assert.ok(1 - last >= 0 && 1 - last <= 1 / dim + 1e-9, id + ' exit fraction ' + last);
    assert.ok(centre > first && centre < last, id + ' middle ' + centre);
    // in cells: the marker is within 1/dim of the path length from the end it should be at, and the middle is strictly between
    const near = (cell, end) => Math.hypot(cell[0] - end[0], cell[1] - end[1]);
    assert.ok(near(R.pointAlongPath(route.path, first), route.path[0]) <= length / dim + 1e-9, id + ' entry marker near ' + route.a);
    assert.ok(near(R.pointAlongPath(route.path, last), route.path[route.path.length - 1]) <= length / dim + 1e-9, id + ' exit marker near ' + route.b);
    const centreCell = R.pointAlongPath(route.path, centre);
    assert.ok(near(centreCell, route.path[0]) > 0 && near(centreCell, route.path[route.path.length - 1]) > 0, id + ' middle is strictly between the ends');
    // walking in the route's direction moves the marker forward
    let previous = -1;
    for (let step = 0; step < dim; step++) {
      const x = route.progress === 'y' ? 3 : (route.progress === 'x' ? step : width - 1 - step);
      const y = route.progress === 'y' ? step : 5;
      const fraction = R.routeMarkerFraction(route.progress, x, y, width, height);
      assert.ok(fraction > previous, id + ' marker moves forward');
      previous = fraction;
    }
  }
  // the 'y' rule exists in the formula even though no route uses it yet
  assert.ok(Math.abs(R.routeMarkerFraction('y', 3, 4, 20, 10) - 0.45) < 1e-9);
  assert.ok(Math.abs(R.routeMarkerFraction('-x', 0, 4, 20, 10) - 0.975) < 1e-9);
  // worldMarker on the real maps: places give their cell, route 1 gives a point on its line, a map without a place gives null
  same(R.worldMarker('lab', 4, 6).cell, W.nodes.newPeiraias.cell);
  same(R.worldMarker('port', 5, 8).cell, W.nodes.harbourOffice.cell);
  const route1 = R.worldMarker('route1', 0, 9);
  assert.ok(route1.onRoute && route1.id === 'route1' && Math.abs(route1.fraction - 0.5 / 32) < 1e-9);
  const route1End = R.worldMarker('route1', 31, 9);
  assert.ok(Math.abs(route1End.fraction - 31.5 / 32) < 1e-9);
  assert.ok(route1.cell[1] >= 10 && route1.cell[1] <= 12 && route1.cell[0] >= 3 && route1.cell[0] <= 5, 'inside the box of the route-1 line');
  assert.equal(R.worldMarker('atlantis', 1, 1), null);
  same(R.pointAlongPath([[0, 0], [4, 0], [4, 4]], 0.5), [4, 0]);
  same(R.pointAlongPath([[0, 0], [4, 0], [4, 4]], 0.25), [2, 0]);
  same(R.pointAlongPath([[0, 0], [4, 0], [4, 4]], 2), [4, 4], 'clamped at the end');
});
test('map states: a district is locked until the previous badge (and while unbuilt), open, cleared; a place is hidden, unknown, seen or visited', () => {
  const world = R.newWorldState();
  assert.equal(R.districtState(world, 'peiraias'), 'open');
  for (const id of ['notia', 'anatolika', 'voreia', 'dytika', 'athina']) assert.equal(R.districtState(world, id), 'locked', id);
  assert.equal(R.placeState(world, 'newPeiraias'), 'hidden');
  assert.equal(R.placeState(world, 'kastella'), 'hidden', 'Καστέλλα is told about only after the Port Medal');
  W.nodes.kastella.built = false;
  try { assert.equal(R.placeState(world, 'kastella'), 'unknown', 'a place that is built later, in an open district, is a question mark'); } finally { W.nodes.kastella.built = true; }
  assert.equal(R.placeState(world, 'faliro'), 'hidden', 'places of a locked district are not drawn');
  same(R.worldCandidates(world), []);
  R.worldVisit(world, 'lab', {});
  assert.equal(R.placeState(world, 'newPeiraias'), 'visited');
  assert.equal(R.placeState(world, 'harbourOffice'), 'hidden');
  R.worldVisit(world, 'route1', {});
  assert.equal(world.routes.route1, 1);
  assert.equal(R.placeState(world, 'harbourOffice'), 'seen', 'the other end of a walked route is told about');
  same(R.worldCandidates(world), ['newPeiraias', 'harbourOffice']);
  R.worldVisit(world, 'port', { badge: true });
  assert.equal(R.placeState(world, 'harbourOffice'), 'visited');
  assert.equal(world.badges.peiraias, 1, 'the badge flag fills the badges');
  assert.equal(R.districtState(world, 'peiraias'), 'cleared');
  assert.equal(R.placeState(world, 'kastella'), 'seen', 'the Port Medal tells about Καστέλλα');
  assert.equal(R.districtState(world, 'notia'), 'locked', 'the next district stays locked while it is not built');
  // a built next district would open with the badge: model it on a copy of the data
  const second = W.districts.notia;
  second.built = true;
  try { assert.equal(R.districtState(world, 'notia'), 'open'); assert.equal(R.districtState(R.newWorldState(), 'notia'), 'locked', 'without the first badge it stays locked'); } finally { second.built = false; }
  // the district sheet counts the species of the zones of its maps
  const species = R.districtSpecies('peiraias');
  assert.equal(species.length, 10, 'the eight of route 1, Φακελάρχης and Εφοπλιστάκος of route 2');
  assert.ok(species.includes('fakelakis') && species.includes('giagiaka') && species.includes('efoplistakos'));
  same(R.districtSpecies('notia'), []);
});
test('save v3: a version-2 save gets its visited places from its flags and its position; the world part round-trips; damaged parts are cleaned', () => {
  const v2 = (map, x, y, flags) => Object.assign(sampleV1(), { version: 2, lastHeal: HOSPITAL_SPOT, player: { name: 'ΜΑΡΙΑ', gender: 'f', map, x, y, dir: 'down' }, flags });
  const idsOf = (part) => Object.keys(part).sort();
  // the start of the game: standing in the lab
  const lab = R.migrateSave(v2('lab', 4, 6, { gotStarter: true })).world;
  same(idsOf(lab.visited), ['newPeiraias']);
  same(idsOf(lab.routes), []);
  same(idsOf(lab.badges), []);
  // the rival has been met (outside the lab, in the town)
  same(idsOf(R.migrateSave(v2('town', 5, 8, { gotStarter: true, rival1: true })).world.visited), ['newPeiraias']);
  // a trainer of route 1 has been beaten, the player is back in the town: route 1 is walked, the harbour office is told about
  const walked = R.migrateSave(v2('town', 5, 8, { gotStarter: true, rival1: true, t_phoebe: true })).world;
  same(idsOf(walked.routes), ['route1']);
  same(idsOf(walked.seen).sort(), ['harbourOffice', 'newPeiraias']);
  assert.equal(R.placeState(walked, 'harbourOffice'), 'seen');
  assert.equal(R.placeState(walked, 'newPeiraias'), 'visited');
  for (const flag of ['t_stelios', 't_takis', 't_rival2']) same(idsOf(R.migrateSave(v2('town', 5, 8, { gotStarter: true, [flag]: true })).world.routes), ['route1'], flag);
  // standing on route 1 or in the port
  const onRoute = R.migrateSave(v2('route1', 1, 9, { gotStarter: true, rival1: true })).world;
  same(idsOf(onRoute.routes), ['route1']);
  assert.equal(R.placeState(onRoute, 'harbourOffice'), 'seen');
  assert.equal(R.placeState(R.migrateSave(v2('port', 5, 8, { gotStarter: true })).world, 'harbourOffice'), 'visited');
  // the badge is won: the harbour office is visited, route 1 walked, the badge counts
  const won = R.migrateSave(v2('town', 5, 8, { gotStarter: true, rival1: true, badge: true, credits: true })).world;
  same(idsOf(won.visited), ['harbourOffice', 'newPeiraias']);
  same(idsOf(won.routes), ['route1']);
  same(idsOf(won.badges), ['peiraias']);
  assert.equal(R.districtState(won, 'peiraias'), 'cleared');
  // every house of the town is the town
  for (const [mapId, x, y] of [['shop', 3, 4], ['cafe', 4, 6], ['kep', 4, 6], ['hospital', 5, 7], ['studio', 4, 6]]) same(idsOf(R.migrateSave(v2(mapId, x, y, { gotStarter: true })).world.visited), ['newPeiraias'], mapId);
  // an old save keeps everything else as it was
  const old = v2('town', 5, 8, { gotStarter: true, rival1: true });
  const migrated = R.migrateSave(old);
  assert.equal(migrated.version, 3);
  same(migrated.flags, old.flags);
  same(migrated.player, { name: 'ΜΑΡΙΑ', gender: 'f', map: 'town', x: 5, y: 8, dir: 'down' });
  assert.equal(migrated.money, 777);
  // version 0 and 1 saves go through the older steps and then get a world part too
  assert.equal(R.migrateSave(sampleV1()).world.visited.newPeiraias, 1);
  assert.equal(R.migrateSave({ v: 0, name: 'Α', drachmas: 5, team: [{ id: 'komma', lv: 5 }], map: 'lab', x: 4, y: 6 }).world.visited.newPeiraias, 1);
  // a version-3 save: round trip, unknown ids dropped, a missing part rebuilt as empty plus the current map
  same(R.migrateSave(JSON.parse(JSON.stringify(migrated))), migrated);
  const damaged = Object.assign(JSON.parse(JSON.stringify(migrated)), { world: { visited: { atlantis: 1, newPeiraias: 1, kastella: 0 }, routes: { route99: 1, route1: 1 }, stops: { newPeiraias: 1, spata: 1 }, badges: { moon: 1 }, seen: 'nonsense' } });
  const cleaned = R.migrateSave(damaged).world;
  same(idsOf(cleaned.visited), ['newPeiraias']);
  same(idsOf(cleaned.routes), ['route1']);
  same(idsOf(cleaned.stops), ['newPeiraias', 'spata']);
  same(idsOf(cleaned.badges), []);
  same(idsOf(cleaned.seen), ['harbourOffice', 'newPeiraias']);
  const noPart = JSON.parse(JSON.stringify(migrated));
  delete noPart.world;
  same(idsOf(R.migrateSave(noPart).world.visited), ['newPeiraias']);
  // inherited names are not places; a damaged world part never writes "undefined"
  const inherited = JSON.parse(JSON.stringify(migrated));
  inherited.world = { badges: { constructor: 1, toString: 1, peiraias: 1 }, visited: { constructor: 1, hasOwnProperty: 1 }, seen: { valueOf: 1 }, routes: { constructor: 1 }, stops: { toString: 1 } };
  const inheritedWorld = R.migrateSave(inherited).world;
  same(idsOf(inheritedWorld.badges), ['peiraias']);
  same(idsOf(inheritedWorld.visited), ['newPeiraias']);
  same(idsOf(inheritedWorld.routes), []);
  same(idsOf(inheritedWorld.stops), []);
  same(idsOf(inheritedWorld.seen), [], 'no undefined or inherited name, and no place told about without a walked route');
  // a version-3 save whose world part is missing or damaged still gets the walked routes its flags tell
  const walkedV3 = Object.assign(JSON.parse(JSON.stringify(migrated)), { flags: { gotStarter: true, rival1: true, t_phoebe: true, badge: true } });
  for (const damagedPart of [undefined, null, 'x', { routes: 5 }]) {
    walkedV3.world = damagedPart;
    const rebuilt = R.migrateSave(walkedV3).world;
    same(idsOf(rebuilt.routes), ['route1'], String(damagedPart));
    same(idsOf(rebuilt.visited), ['harbourOffice', 'newPeiraias'], String(damagedPart));
    same(idsOf(rebuilt.badges), ['peiraias'], String(damagedPart));
  }
  assert.equal(R.migrateSave({ version: 4, party: [R.serializeMon(R.makeMon('komma', 5))] }), null, 'a newer save is still refused');
  // the engine writes, reads and starts the world part
  const state = html.slice(html.indexOf('function newGameState'), html.indexOf('// ---- Canvas and scaling'));
  assert.ok(state.includes('world: newWorldState()') && state.includes('world: JSON.parse(JSON.stringify(G.world))') && state.includes('world: save.world'), 'new game, save and load all carry the world part');
  assert.ok(html.includes('worldVisit(G.world, mapId, G.flags);'), 'entering a map marks its place');
});
test('map strings: every place, route and district name has Greek and English; every key the map screen asks for exists', () => {
  const S = R.STRINGS;
  const need = (key) => { assert.ok(S[key], 'missing string ' + key); assert.ok(S[key][0] && S[key][1], key + ' needs both languages'); };
  for (const id of Object.keys(W.nodes)) need('world.' + id);
  for (const id of routeIds) need('world.' + id);
  for (const district of Object.values(W.districts)) need(district.nameKey);
  for (const key of ['menu.map', 'map.title', 'map.scale', 'map.soon', 'map.keys', 'map.levels', 'map.sheet.boss', 'map.sheet.stats', 'map.badge.won', 'map.badge.no']) need(key);
  for (const node of Object.values(W.nodes)) for (const key of node.has || []) need('world.has.' + key);
  for (const id of [...Object.keys(W.nodes), ...routeIds, ...Object.values(W.districts).map((district) => district.id)]) {
    const key = id.startsWith('route') || id in W.nodes ? 'world.' + id : 'world.d.' + id;
    assert.match(S[key][0], /[Ͱ-Ͽ]/, key + ' Greek text is Greek');
    assert.match(S[key][1], /[A-Za-z]/, key + ' English text is Latin');
  }
  assert.equal(S['map.scale'][0], 'ΚΛΙΜΑΚΑ: ΠΕΡΙΠΟΥ');
  assert.equal(S['map.scale'][1], 'SCALE: ROUGHLY');
  assert.equal(S['menu.map'][0], 'Χάρτης');
  for (const id of Object.keys(W.nodes)) assert.ok(!/\{/.test(S['world.' + id][0] + S['world.' + id][1]), id + ' has no placeholders');
});
test('map controls: Q, Select, a touch pill and a pause-menu entry after Δικογραφία; the map closes on back, the menu input and its own key', () => {
  const keyMap = html.slice(html.indexOf('const KEY_MAP'), html.indexOf('function padButtonOn'));
  assert.ok(keyMap.includes("KeyQ: 'map'"), 'Q opens the map');
  assert.ok(html.includes("const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'menu', 'map']"), 'map is an input name');
  assert.ok(html.includes("if (padButtonOn(buttons, 8)) this.pad.map = true;"), 'gamepad button 8 (Select/Back) is the map');
  assert.ok(html.includes("if (padButtonOn(buttons, 9) || padButtonOn(buttons, 3)) this.pad.menu = true;"), 'Start and Y still open the menu');
  assert.ok(html.includes('<div class="btn" data-btn="map">ΧΑΡΤΗΣ</div>'), 'the touch pill exists');
  assert.ok(html.includes('#touch.portrait [data-btn="map"]') && html.includes('#touch.landscape [data-btn="map"]'), 'the pill has a place in both layouts');
  const pause = html.slice(html.indexOf('async function openPauseMenu'), html.indexOf('// ---- Map screen'));
  assert.ok(pause.includes("T('menu.dossier'), T('menu.map'), T('menu.save')"), 'Χάρτης comes right after Δικογραφία');
  assert.ok(pause.includes('choice === 3) await openMapScreen()'), 'the menu entry opens the map');
  const overworld = html.slice(html.indexOf('OverworldLayer.prototype.update = '), html.indexOf('OverworldLayer.prototype.backgroundUpdate'));
  assert.ok(overworld.includes('if (this.busy) return;') && overworld.indexOf('if (this.busy) return;') < overworld.indexOf('Input.pressed.map'), 'the map key works only when the overworld is on top and idle');
  const layer = html.slice(html.indexOf('MapLayer.prototype.update'), html.indexOf('MapLayer.prototype.draw'));
  assert.ok(layer.includes('Input.pressed.b || Input.pressed.map || Input.pressed.menu'), 'back, the open key and the menu input close it');
  assert.ok(layer.includes('closeLayer(this)'), 'closing hands control back to the layer below');
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

// ---- MZ-WORLD-02a: the Πειραιάς rework ----
// The walkable tiles (1) and solid tiles (0) of the nine maps before the rework (base fab9f53), row by row: an old save may stand on any 1.
const OLD_WALKABLE = {
  town: '000000000000000000000000/000000000000000000000000/011111111111111111111110/010000100001000010000110/010000100001000010000110/010000100001000010000110/010100101001010010100110/011110111101111011110110/011111111111111111111111/011111111111111111111110/010000111000000000000010/010000111000000000000010/010000111000000000000010/010000111010000100000010/011111111111101111111110/000000000000000000000000',
  lab: '0000000000/0001111100/0111111110/0100110010/0111111110/0111111110/0111111110/0000110000',
  kep: '0000000000/0111111110/0000000000/0111111110/0100110010/0111111110/0111111110/0000110000',
  hospital: '000000000000/011111111110/000000000000/001110111100/011111111110/001111111100/001101101100/011111111110/000001100000',
  shop: '00000000/00011000/00000000/01111110/01111110/00011000',
  cafe: '0000000000/0001111100/0000001110/0111111110/0111111110/0100110010/0111111110/0000110000',
  studio: '0000000000/0111111110/0111111110/0111111110/0100110010/0111111110/0111111110/0000110000',
  route1: '00000000000000000000000000000000/00000000000000000000000000000000/00000000000000000000000000000000/00000000000000000000000000000000/00000000000000000000000001000000/01111111111111111111111111111110/01111111111111111111111111110110/01111111111111111111111101111110/01010111111101111111111111111110/11111111111111111111111111111110/01111111111111111111111111111110/01111111111111111111111011111110/01111111111111111111111111111110/01111111111111111111111111111110/01110111111111111110111111101110/01111101111111111011101111111110/01111111111111111111111111111100/00000000000000000000000000000000',
  port: '000000000000/000111111100/011111111110/011100001110/011111111110/010011110010/011111111110/011111111110/011111111110/000001100000',
};
const OLD_MAP_IDS = Object.keys(OLD_WALKABLE);
const REWORK_FLAGS = { gotStarter: true, rival1: true, badge: true, credits: true };
const NEW_MAP_IDS = ['route2', 'kastella', 'kastella_hospital', 'kastella_shop', 'kastella_theatre'];

test('XP rule: factor 1 up to level 13 (every built fight pays what it paid), above it x foe level / 13; the studio pays 519 + 750', () => {
  assert.equal(R.XP_SCALE_FROM, 13);
  const oldFormula = (speciesId, level, trainer) => Math.max(1, Math.floor(R.SPECIES[speciesId].xp * level / R.XP_DIVISOR * (trainer ? R.TRAINER_XP_BONUS : 1)));
  for (const speciesId of Object.keys(R.SPECIES)) {
    for (let level = 1; level <= 13; level++) {
      for (const trainer of [false, true]) assert.equal(R.xpReward(R.makeMon(speciesId, level), trainer), oldFormula(speciesId, level, trainer), speciesId + ' L' + level);
    }
  }
  assert.equal(R.xpReward(R.makeMon('fakelakis', 13), true), 195, 'level 13: 40 * 13 / 4 * 1.5, no scale');
  assert.equal(R.xpReward(R.makeMon('fakelakis', 26), false), 520, 'level 26 doubles: 40 * 26 / 4 * 2');
  for (const level of [14, 20, 30, 50]) assert.equal(R.xpReward(R.makeMon('frapedoros', level), false), Math.floor(50 * level / 4 * level / 13), 'frapedoros L' + level);
  for (let level = 1; level < R.MAX_LEVEL; level++) assert.ok(R.xpReward(R.makeMon('giagiaka', level + 1), true) >= R.xpReward(R.makeMon('giagiaka', level), true), 'never falls as the level rises');
  const studio = R.TRAINERS.host.team.map((entry) => R.xpReward(R.makeMon(entry.sp, entry.lv), true));
  same(studio, [519, 750], 'Σπυράδωνις L15 and Μιζοτάκης L17 at the trainer bonus');
  assert.equal(oldFormula('spyradonis', 15, true) + oldFormula('mizotakis', 17, true), 1023, 'it was 450 + 573 before: the studio is 24 % richer');
  // the built trainers and the boss are at level 13 or lower: unchanged
  for (const id of ['rival1', 'phoebe', 'stelios', 'takis', 'rival2', 'kotsos']) for (const entry of R.TRAINERS[id].team) assert.ok(entry.lv <= 13, id);
});
test('XP band of Πειραιάς (section 11.4): within W = 15 wild fights, the trainers alone give at most 1.3 times the need', () => {
  const band = xpBand(R, 'peiraias');
  same(band.trainerIds.slice().sort(), ['rival1', 'phoebe', 'stelios', 'takis', 'rival2', 'fan', 'ferrysailor'].sort(), 'the trainers counted: the five built ones and the two of route 2');
  assert.equal(band.trainerIds.length, 7);
  assert.equal(band.top, 13);
  assert.equal(band.need, 3729, '3 x (xpForLevel(13) - xpForLevel(5))');
  let built = 0;
  for (const id of ['rival1', 'phoebe', 'stelios', 'takis', 'rival2']) for (const mon of R.buildTrainerTeam(id, 'komma')) built += R.xpReward(mon, true);
  assert.equal(built, 971, 'the built trainers give 971, as the reference says');
  assert.equal(band.trainerXp, 971 + 374 + 535, 'plus the fan (374) and the ferry sailor (535) of route 2');
  assert.ok(band.wildFights <= 15, 'wild fights still needed: ' + band.wildFights);
  assert.ok(band.trainerShare <= 1.3 && band.trainerShare < 1, 'trainers give ' + band.trainerShare.toFixed(2) + ' of the need');
});
test('the Πειραιάς rework keeps the old ids, flags, positions and every old walkable tile (an old save continues where it stood)', () => {
  assert.equal(R.SAVE_VERSION, 3, 'no new save version: the flags are the old ones');
  for (const id of OLD_MAP_IDS) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE[id].split('/');
    assert.equal(map.h, rows.length, id + ' height');
    assert.equal(map.w, rows[0].length, id + ' width');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (rows[y][x] === '1') assert.ok(!R.tileDef(map, x, y).solid, id + ' ' + x + ',' + y + ' was walkable and still must be');
    }
  }
  const nowWalkable = [];
  for (const id of OLD_MAP_IDS) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE[id].split('/');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (rows[y][x] === '0' && !R.tileDef(map, x, y).solid) nowWalkable.push(id + ':' + x + ',' + y);
  }
  same(nowWalkable, ['route1:31,10'], 'only the gate tile at the east edge of route 1 is new');
  same(OLD_MAP_IDS, ['town', 'lab', 'kep', 'hospital', 'shop', 'cafe', 'studio', 'route1', 'port']);
  assert.equal(R.START_MAP.map, 'lab');
  same(R.HOSPITAL_SPOT, HOSPITAL_SPOT);
  const gate = R.MAPS.route1.warps.find((warp) => warp.x === 31 && warp.y === 10);
  assert.ok(gate && gate.to === 'route2' && gate.needFlag === 'badge' && R.STRINGS[gate.lockedText], 'the gate needs the flag badge and says why');
  for (const mapId of ['town', 'route1']) assert.ok(R.STRINGS[R.MAPS[mapId].name]);
  assert.equal(R.TRAINERS.kotsos.boss, true);
  assert.equal(R.MAPS.port.npcs.find((npc) => npc.id === 'kotsos').trainer, 'kotsos');
});
test('Πειραιάς reachability: the gate is shut without the badge and open with it; route 2, Καστέλλα and its three buildings are reachable and lead back; no dead end', () => {
  const start = R.START_MAP;
  const withoutBadge = R.reachableTiles(start.map, start.x, start.y, { gotStarter: true });
  for (const id of NEW_MAP_IDS) assert.ok(![...withoutBadge].some((key) => key.startsWith(id + ':')), id + ' is not reachable without the badge');
  assert.ok(withoutBadge.has('route1:30:10'), 'the tile before the gate is reachable');
  assert.ok(!withoutBadge.has('route1:31:10'), 'the gate tile is shut without the badge');
  const all = R.reachableTiles(start.map, start.x, start.y, REWORK_FLAGS);
  assert.ok(all.has('route1:31:10') && all.has('route2:1:8') && all.has('route2:38:8') && all.has('kastella:1:12'), 'through the gate, along route 2, into Καστέλλα');
  for (const id of NEW_MAP_IDS) {
    const map = R.MAPS[id];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if ((id === 'kastella_hospital' || id === 'kastella_shop') && y === 1) continue; // behind the counter, as in the templates of New Piraeus: nobody walks there
      if (!R.tileDef(map, x, y).solid && !R.npcAtTile(map, x, y, REWORK_FLAGS)) assert.ok(all.has(id + ':' + x + ':' + y), id + ' walkable tile ' + x + ',' + y + ' is cut off');
    }
    for (const warp of map.warps) { // every warp has a way back: the target map has a warp to this map, and the player arrives on a walkable tile
      assert.ok(R.MAPS[warp.to].warps.some((back) => back.to === id), id + ' -> ' + warp.to + ' has a return warp');
      assert.ok(R.tileWalkable(R.MAPS[warp.to], warp.tx, warp.ty, REWORK_FLAGS), id + ' -> ' + warp.to + ' arrives on a walkable tile');
    }
    for (const npc of map.npcs) assert.ok(R.npcTalkable(id, npc, all), id + ':' + npc.id + ' can be talked to');
  }
  // no dead end: starting inside Καστέλλα (just through the gate from route 2) the player reaches exactly the same places as from the start
  const fromKastella = R.reachableTiles('kastella', 1, 12, REWORK_FLAGS);
  const fromRoute2 = R.reachableTiles('route2', 1, 8, REWORK_FLAGS);
  assert.equal(fromKastella.size, all.size, 'from Καστέλλα everything, including the lab and the start, can be reached again');
  assert.equal(fromRoute2.size, all.size);
  assert.ok(fromKastella.has('lab:4:6') && fromKastella.has('route1:0:9'));
  // every sign of the new maps can be read
  for (const id of NEW_MAP_IDS) for (const key of Object.keys(R.MAPS[id].signs)) {
    const [sx, sy] = key.split(',').map(Number);
    assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => all.has(id + ':' + (sx + dx) + ':' + (sy + dy))), id + ' sign ' + key);
    assert.ok(R.tileDef(R.MAPS[id], sx, sy).solid, id + ' sign ' + key + ' stands on a sign tile');
  }
  assert.ok(R.MAPS.route1.signs['31,9'] && R.MAPS.town.signs['22,15'] && R.MAPS.kastella.signs['6,13'], 'the gate sign and the two ΚΤΕΛ stops');
  assert.ok(all.has('town:22:14') && R.tileDef(R.MAPS.town, 22, 15).solid, 'the ΚΤΕΛ stop of New Piraeus can be read from the pavement');
});
test('Πειραιάς data: every new map is on the world map, rows have their width, tiles are known, wild tables hold the district list, trainers match section 11.4', () => {
  for (const id of NEW_MAP_IDS) {
    const map = R.MAPS[id];
    assert.equal(map.rows.length, map.h, id + ' height');
    for (const row of map.rows) { assert.equal(row.length, map.w, id + ' width'); for (const char of row) assert.ok(R.TILE_DEFS[char], id + ' tile ' + char); }
    assert.ok(R.mapNode(id) && R.mapNode(id).district === 'peiraias', id + ' belongs to a place of Πειραιάς');
    assert.ok(R.STRINGS[map.name], id + ' name');
  }
  assert.equal(R.mapNode('route2').id, 'route2');
  for (const id of ['kastella', 'kastella_hospital', 'kastella_shop', 'kastella_theatre']) assert.equal(R.mapNode(id).id, 'kastella', id);
  same([W.nodes.kastella.built, W.routes.route2.built, W.nodes.kastella.stop], [true, true, true]);
  assert.equal(R.MAPS.route2.w, 40); assert.equal(R.MAPS.route2.h, 14);
  same([R.MAPS.kastella.w, R.MAPS.kastella.h], [26, 18]);
  same([R.MAPS.kastella_hospital.w, R.MAPS.kastella_hospital.h, R.MAPS.kastella_shop.w, R.MAPS.kastella_shop.h, R.MAPS.kastella_theatre.w, R.MAPS.kastella_theatre.h], [12, 9, 8, 6, 12, 10]);
  // route 2: the species of 11.3.1 at levels 10-13, evolved forms only at or above their evolution level
  const allowed = ['fakelarchis', 'efoplistakos', 'laikatzis', 'frapedoros', 'giagiaka'];
  const seenInZones = new Set();
  for (const zone of R.MAPS.route2.zones) for (const entry of zone.table) {
    assert.ok(allowed.includes(entry.sp), 'route 2 species ' + entry.sp);
    assert.ok(entry.min >= 10 && entry.max <= 13 && entry.min <= entry.max, entry.sp + ' levels');
    const evolvesAt = Object.values(R.SPECIES).filter((species) => species.evo && species.evo.to === entry.sp).map((species) => species.evo.lv);
    for (const level of evolvesAt) assert.ok(entry.min >= level, entry.sp + ' appears only from its evolution level');
    seenInZones.add(entry.sp);
  }
  same([...seenInZones].sort(), allowed.slice().sort());
  const rare = R.MAPS.route2.zones[0].table;
  assert.ok(rare.find((entry) => entry.sp === 'efoplistakos').w === Math.min(...rare.map((entry) => entry.w)), 'Εφοπλιστάκος is the rare one');
  assert.ok(R.MAPS.route1.zones.every((zone) => zone.table.every((entry) => entry.max <= 8)), 'route 1 keeps its levels 2-8');
  same(R.districtSpecies('peiraias').sort(), ['dimosio', 'efoplistakos', 'eforaki', 'fakelakis', 'fakelarchis', 'frapedoros', 'giagiaka', 'laikatzis', 'storoula', 'trolosavros']);
  // Εφοπλιστάκος: a new Επιχειρηματίες species with a dossier text and a sprite drawer
  const shipowner = R.SPECIES.efoplistakos;
  assert.equal(shipowner.t, 'biz');
  assert.ok(R.DEX_ORDER.includes('efoplistakos') && R.STRINGS['sp.efoplistakos'][0] && R.STRINGS['sp.efoplistakos'][1]);
  assert.ok(/^ {2}efoplistakos: function \(p\)/m.test(html), 'a procedural sprite');
  assert.ok(shipowner.rec > 0 && shipowner.xp > 0);
  // the two trainers of route 2
  const route2Trainers = R.MAPS.route2.npcs.filter((npc) => npc.kind === 'trainer');
  same(route2Trainers.map((npc) => npc.trainer), ['fan', 'ferrysailor']);
  same(R.TRAINERS.fan.team.map((entry) => entry.lv), [10, 11]);
  same(R.TRAINERS.ferrysailor.team.map((entry) => entry.lv), [11, 12]);
  assert.ok(R.TRAINERS.ferrysailor.team.some((entry) => entry.sp === 'efoplistakos'), 'the ferry sailor brings a shipowner');
  for (const id of ['fan', 'ferrysailor']) for (const part of ['intro', 'win', 'after']) assert.ok(R.STRINGS['tr.' + id + '.' + part], id + ' ' + part);
  for (const npc of route2Trainers) assert.ok(npc.sight >= 1 && R.TRAINERS[npc.trainer]);
  assert.equal(R.TRAINERS.fan.boss, undefined);
  // Καστέλλα: a hospital that heals and is the return point, a kiosk with a shopkeeper, a theatre with a viewpoint
  assert.ok(R.MAPS.kastella_hospital.npcs.some((npc) => npc.kind === 'heal') && R.MAPS.kastella_hospital.actions['1,3'] === 'archive');
  assert.ok(!R.tileDef(R.MAPS.kastella_hospital, HOSPITAL_SPOT.x, HOSPITAL_SPOT.y).solid, 'the spot inside the door of the Καστέλλα hospital');
  assert.ok(R.MAPS.kastella_shop.npcs.some((npc) => npc.kind === 'shop'));
  assert.ok(R.MAPS.kastella_theatre.npcs.some((npc) => npc.id === 'viewpoint'));
  assert.ok(R.MAPS.kastella.warps.some((warp) => warp.to === 'route2') && R.MAPS.route2.warps.some((warp) => warp.to === 'route1' && warp.x === 0));
  // every tile character has a drawn sprite (the four new ones included)
  for (const char of Object.keys(R.TILE_DEFS)) if (char !== '~') assert.ok(html.includes("make('" + char + "'"), 'a sprite for tile ' + char);
});
test('Πειραιάς trainers: a seeded replay of the two new fights twice gives equal checksums, and the fights are winnable at the intended levels', () => {
  const replay = (seed) => {
    const rng = R.makeRng(seed);
    const lines = [];
    for (let i = 0; i < 100; i++) {
      for (const id of ['fan', 'ferrysailor']) {
        const team = [R.makeMon(R.pickOne(rng, R.STARTERS), 12), R.makeMon('fakelakis', 12), R.makeMon('giagiaka', 12)];
        const result = R.simulateBattle(team, R.buildTrainerTeam(id, 'komma'), rng, {});
        lines.push(id + result.winner + ':' + result.turns);
      }
    }
    return R.hashString(lines.join('|'));
  };
  assert.equal(replay(77), replay(77));
  assert.notEqual(replay(77), replay(78));
  const winRate = (trainerId, level, size, runsCount) => {
    const rng = R.makeRng(900 + level + size);
    let wins = 0;
    for (let i = 0; i < runsCount; i++) {
      const pool = ['fakelakis', 'trolosavros', 'laikatzis', 'storoula', 'dimosio', 'eforaki', 'frapedoros', 'giagiaka', 'fakelarchis', 'efoplistakos'];
      const team = [R.makeMon(R.pickOne(rng, R.STARTERS), level)];
      for (let n = 1; n < size; n++) team.push(R.makeMon(pool.splice(Math.floor(rng() * pool.length), 1)[0], level));
      if (R.simulateBattle(team, R.buildTrainerTeam(trainerId, 'komma'), rng, { playerItems: [] }).winner === 0) wins++;
    }
    return wins / runsCount;
  };
  // a full team of the player's level (12, just after the first boss) wins both fights almost always; three creatures still win more often than not
  for (const id of ['fan', 'ferrysailor']) {
    assert.ok(winRate(id, 12, 6, 200) >= 0.9, id + ' with six creatures at level 12');
    assert.ok(winRate(id, 12, 3, 200) >= 0.5, id + ' with three creatures at level 12');
  }
  // Κώτσος unchanged, the win-rate bands of section 11.7 (top level 13): top plus 1 85-97 %, top minus 1 55-75 %, top minus 3 10-30 %, three creatures at top minus 1 8-25 %
  const boss = (level, size, items, runsCount) => {
    const rng = R.makeRng(4000 + level * 10 + size);
    let wins = 0;
    for (let i = 0; i < runsCount; i++) {
      const pool = ['fakelakis', 'trolosavros', 'laikatzis', 'storoula', 'dimosio', 'eforaki', 'frapedoros', 'giagiaka'];
      const team = [R.makeMon(R.pickOne(rng, R.STARTERS), level)];
      for (let n = 1; n < size; n++) team.push(R.makeMon(pool.splice(Math.floor(rng() * pool.length), 1)[0], level));
      if (R.simulateBattle(team, R.buildTrainerTeam('kotsos', 'komma'), rng, { foeItems: R.TRAINERS.kotsos.items, playerItems: items }).winner === 0) wins++;
    }
    return wins / runsCount;
  };
  const bossTop = R.TRAINERS.kotsos.team[R.TRAINERS.kotsos.team.length - 1].lv;
  const twoSouvlaki = ['souvlaki', 'souvlaki'];
  const bands = [
    ['top plus 1, six creatures', boss(bossTop + 1, 6, twoSouvlaki, 600), 0.85, 0.97],
    ['top minus 1, six creatures', boss(bossTop - 1, 6, twoSouvlaki, 600), 0.55, 0.75],
    ['top minus 3, six creatures', boss(bossTop - 3, 6, twoSouvlaki, 600), 0.10, 0.30],
    ['top minus 1, three creatures, no items', boss(bossTop - 1, 3, [], 600), 0.08, 0.25],
  ];
  for (const [label, rate, low, high] of bands) assert.ok(rate >= low && rate <= high, 'Κώτσος, ' + label + ': ' + rate + ' outside ' + low + '-' + high);
});
// Section 11.3: every boss type of a built district has a species that hits it for x2 and can be had by then (a starter or a wild creature of that
// district or an earlier one). Written over the districts that are built, so every later district task is checked by it.
test('type fairness: every type of every built boss is hit for x2 by a starter or a wild creature available by then', () => {
  const built = Object.values(W.districts).filter((district) => district.built).sort((a, b) => a.order - b.order);
  assert.ok(built.length >= 1 && built[0].id === 'peiraias');
  const available = new Set(R.STARTERS);
  const flags = { gotStarter: true };
  for (const district of built) {
    // only zones on maps reachable before the district's own badge count (route 2 opens with that badge, after the boss)
    const start = R.START_MAP;
    const reachableKeys = R.reachableTiles(start.map, start.x, start.y, flags);
    const reachableMaps = new Set([...reachableKeys].map((key) => key.split(':')[0]));
    const ofDistrict = new Set(R.districtSpecies(district.id));
    for (const mapId of reachableMaps) {
      for (const zone of R.MAPS[mapId].zones || []) for (const entry of zone.table) if (ofDistrict.has(entry.sp)) available.add(entry.sp);
    }
    flags[district.badgeFlag] = true; // later districts are entered with this badge
    const bossTypes = new Set(R.TRAINERS[district.bossTrainer].team.map((entry) => R.SPECIES[entry.sp].t));
    for (const bossType of bossTypes) {
      const hitters = [...available].filter((id) => R.typeMultiplier(R.SPECIES[id].t, bossType) === 2);
      assert.ok(hitters.length > 0, district.id + ': no available species hits ' + bossType + ' for x2');
    }
  }
  // Πειραιάς, named: the boss brings Επιχειρηματίες (biz) and Μιμίδια (mem); Κομματάκι (pol) hits biz and Εφοράκι (asf, wild) or Κουλουράκι (asf, starter) hits mem
  assert.equal(R.typeMultiplier(R.SPECIES.komma.t, 'biz'), 2, 'the starter Κομματάκι hits biz for x2');
  assert.ok(R.STARTERS.includes('komma') && R.districtSpecies('peiraias').includes('eforaki') && R.typeMultiplier(R.SPECIES.eforaki.t, 'mem') === 2);
});

// Section 11.8: no real brand, person or party in any text. A deny-list over every STRINGS entry in both languages, compared without case and
// without accents. The marked parodies (Μιζοτάκης, Σπυράδωνις, Νέα Δημοκτατορία) must not match.
const DENIED_WHOLE_WORDS = ['Airbnb', 'Starbucks', 'Coca-Cola', 'Coca Cola', 'Facebook', 'Instagram', 'TikTok', 'Google', 'Amazon',
  'Netflix', 'Uber', 'Wolt', 'efood', 'Lidl', 'Vodafone', 'Cosmote', 'OPAP', 'ΟΠΑΠ', 'ΝΔ', 'Νέα Δημοκρατία', 'ΣΥΡΙΖΑ', 'ΠΑΣΟΚ', 'ΚΚΕ', 'Ελληνική Λύση', 'Χρυσή Αυγή',
  'Syriza', 'Pasok', 'KKE', 'ND', 'New Democracy', 'Golden Dawn', 'Greek Solution',
  'Blue Star', 'Minoan', 'Anek', 'Seajets', 'Hellenic Seaways', 'Attica Group', 'ΑΝΕΚ', 'Μινωικές', 'Μπλου Σταρ', 'Σιτζετς'];
const DENIED_NAME_STEMS = ['McDonald', 'Μητσοτάκ', 'Τσίπρα', 'Ανδρουλάκ', 'Βελόπουλ', 'Κουτσούμπ', 'Γεωργιάδ', 'Mitsotak', 'Tsipras', 'Androulak', 'Velopoul', 'Koutsoumb', 'Georgiad'];
// common words that are also brands: checked on the raw text, capitalised whole words only
const DENIED_CAPITALISED_WORDS = /(?<![\p{L}\p{N}])(?:Apple|Meta)(?![\p{L}\p{N}])/u;
const PARODIES = ['Μιζοτάκης', 'Σπυράδωνις', 'Νέα Δημοκτατορία', 'Mizotakis', 'Spyradonis', 'New Democratorship'];
const plainText = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const escapeForRegex = (text) => plainText(text).replace(/[.*+?^$()|[\]{}\\]/g, '\\$&').replace(/ /g, '[ -]');
const DENY_PATTERN = new RegExp('(?<![\\p{L}\\p{N}])(?:(?:' + DENIED_WHOLE_WORDS.map(escapeForRegex).join('|') + ')(?![\\p{L}\\p{N}])|(?:' + DENIED_NAME_STEMS.map(escapeForRegex).join('|') + '))', 'u');
test('strings: no real brand, person or party in any text of either language (deny-list); the marked parodies are allowed', () => {
  for (const word of ['Airbnb 3000', "McDonald's", 'McDonald’s', 'Starbucks', 'Coca-Cola', 'efood', 'ΟΠΑΠ', 'ΝΔ', 'Νέα Δημοκρατία', 'Ελληνική Λύση', 'Blue Star', 'Μητσοτάκης', 'του Τσίπρα', 'Ανδρουλάκης', 'Γεωργιάδης', 'Wolt',
    'Syriza', 'New Democracy', 'Μπλου Σταρ'])
    assert.ok(DENY_PATTERN.test(plainText('For rent. ' + word + '. The owner is abroad.')), 'the deny-list catches ' + word);
  for (const word of ['Apple', 'Meta']) assert.ok(DENIED_CAPITALISED_WORDS.test('For rent. ' + word + '. The owner is abroad.'), 'the capitalised check catches ' + word);
  for (const word of ['Metaphor', 'Applesauce', 'a meta joke', 'an apple']) assert.ok(!DENIED_CAPITALISED_WORDS.test(word), word + ' is not a false alarm for Apple or Meta');
  for (const word of PARODIES) assert.ok(!DENY_PATTERN.test(plainText('Ο ' + word + ' είπε: ' + word + '.')), 'the parody ' + word + ' is allowed');
  for (const word of ['ανδρας', 'δημοκρατια', 'Metaphor', 'Applesauce', 'τα κοινα', 'κανδαλο']) assert.ok(!DENY_PATTERN.test(plainText(word)), word + ' is not a false alarm');
  let searched = 0;
  const scan = (label, text) => {
    const found = plainText(text).match(DENY_PATTERN) || text.match(DENIED_CAPITALISED_WORDS);
    assert.ok(!found, label + ' contains a real brand, person or party (' + (found && found[0]) + '): ' + text);
    searched++;
  };
  for (const [key, texts] of Object.entries(R.STRINGS)) {
    for (const text of texts.slice(0, 2)) scan(key, text);
  }
  assert.equal(searched, Object.keys(R.STRINGS).length * 2, 'both languages of every entry were searched');
  // names that live outside STRINGS (one Greek text each)
  let names = 0;
  for (const [id, species] of Object.entries(R.SPECIES)) { scan('species ' + id, species.n); names++; }
  for (const [id, trainer] of Object.entries(R.TRAINERS)) { scan('trainer ' + id, trainer.name); names++; }
  for (const [id, move] of Object.entries(R.MOVES)) { scan('move ' + id, move.n); names++; }
  assert.equal(names, Object.keys(R.SPECIES).length + Object.keys(R.TRAINERS).length + Object.keys(R.MOVES).length, 'every species, trainer and move name was searched');
});

// Section 11.7: the district's prize money must buy the stock of its new items. Πειραιάς sells nothing new (the Καστέλλα kiosk has the New Piraeus stock).
const DISTRICT_NEW_ITEMS = { peiraias: [] };
const STOCK_BEFORE_THE_REWORK = ['fakelaki', 'fakelos', 'koulouri', 'souvlaki', 'frapes', 'tsipouro'];
test('money budget: the prize money of the district covers the stock of its new items (Πειραιάς has none)', () => {
  assert.deepEqual(DISTRICT_NEW_ITEMS.peiraias, [], 'Πειραιάς adds no item');
  same(R.SHOP_STOCK, STOCK_BEFORE_THE_REWORK, 'the shop stock is the one before the rework, so no new item exists in Πειραιάς');
  assert.ok(R.MAPS.kastella_shop.npcs.some((npc) => npc.kind === 'shop') && R.MAPS.shop.npcs.some((npc) => npc.kind === 'shop'), 'every kiosk sells that one stock');
  for (const district of Object.values(W.districts).filter((entry) => entry.built)) {
    const trainerIds = xpBand(R, district.id).trainerIds.concat(district.bossTrainer);
    let prizeMoney = 0;
    for (const id of trainerIds) {
      const team = R.buildTrainerTeam(id, 'komma');
      prizeMoney += R.prizeFor({ sides: [{ party: [], active: 0 }, { party: team }] }, R.TRAINERS[id]);
    }
    const cost = (DISTRICT_NEW_ITEMS[district.id] || []).reduce((sum, itemId) => sum + R.ITEMS[itemId].price, 0);
    assert.ok(prizeMoney >= cost, district.id + ': prize money ' + prizeMoney + ' buys the new items (' + cost + ')');
    assert.ok(prizeMoney > 0);
  }
});
test('the chapter card replaces the credits roll after Κώτσος: the badge text is the Port Medal, the flag credits is still set, the studio still opens on it', () => {
  const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));
  const victory = part('OverworldLayer.prototype.bossVictory', 'OverworldLayer.prototype.runEvent');
  assert.ok(victory.includes('new BadgeLayer()') && victory.includes('new ChapterLayer()') && !victory.includes('new CreditsLayer()'), 'the badge, then the chapter card, no credits roll');
  assert.ok(victory.indexOf('G.flags.badge = true') < victory.indexOf('new BadgeLayer()') && victory.indexOf('new ChapterLayer()') < victory.indexOf('G.flags.credits = true'), 'order: badge flag, badge, card, credits flag');
  assert.ok(victory.includes("say('credits.after')"), 'the studio announcement stays');
  assert.ok(html.includes('function ChapterLayer()') && html.includes('function CreditsLayer()'), 'the credits roll stays in the code for the Βουλή');
  assert.ok(!html.includes('new CreditsLayer()'), 'nothing opens the credits roll before the Βουλή is built');
  assert.equal(R.STRINGS['badge.title'][0], 'ΠΑΡΑΣΗΜΟ ΛΙΜΑΝΙΟΥ');
  assert.ok(/Κεφάλαιο 1 ολοκληρώθηκε/.test(R.STRINGS['chapter.title'][0]) && /Chapter 1 complete/.test(R.STRINGS['chapter.title'][1]));
  assert.ok(R.STRINGS['chapter.sub'][0] && R.STRINGS['chapter.sub'][1] && R.STRINGS['boss.win3'][0].includes('Λιμανιού'));
  const studio = R.MAPS.town.warps.find((warp) => warp.to === 'studio');
  assert.equal(studio.needFlag, 'credits', 'the studio opens on the flag credits, as in the old saves');
  const start = R.START_MAP;
  assert.ok(R.reachableTiles(start.map, start.x, start.y, { credits: true }).has('studio:4:6'));
  assert.ok(R.districtState(R.newWorldState(), 'peiraias') === 'open');
});
test('save v2 and v3 saves load and continue in the reworked Πειραιάς with nothing lost', () => {
  const party = [{ sp: 'komma', lv: 14, xp: R.xpForLevel(14), hp: 40 }, { sp: 'fakelakis', lv: 9, xp: R.xpForLevel(9), hp: 20 }];
  const make = (version, map, x, y, flags, extra) => Object.assign({ version, player: { name: 'ΝΙΚΟΣ', gender: 'm', map, x, y, dir: 'right' }, party, archive: [], money: 777, bag: { fakelaki: 3, souvlaki: 2 },
    dex: { seen: { komma: true }, got: { komma: true } }, flags, lastHeal: { map: 'hospital', x: 5, y: 7, dir: 'up' }, options: { lang: 'en', sound: true, textSpeed: 1, reduceMotion: false }, rngState: 4242, starter: 'komma' }, extra || {});
  const idsOf = (part) => Object.keys(part).sort();
  // 1. a version-2 save after the first boss, standing at the east edge of route 1: stays there, gets Καστέλλα as a place it was told about
  const v2 = R.migrateSave(make(2, 'route1', 30, 10, REWORK_FLAGS));
  assert.equal(v2.version, 3);
  same(v2.player, { name: 'ΝΙΚΟΣ', gender: 'm', map: 'route1', x: 30, y: 10, dir: 'right' });
  assert.equal(v2.money, 777); assert.equal(v2.party.length, 2); assert.equal(v2.party[0].lv, 14); assert.equal(v2.options.lang, 'en'); assert.equal(v2.rngState, 4242);
  same(v2.flags, REWORK_FLAGS);
  assert.equal(v2.world.seen.kastella, 1, 'the Port Medal tells about Καστέλλα');
  assert.equal(R.placeState(v2.world, 'kastella'), 'seen');
  assert.equal(v2.world.badges.peiraias, 1);
  same(v2.lastHeal, { map: 'hospital', x: 5, y: 7, dir: 'up' });
  // 2. a version-2 save before the boss: nothing about Καστέλλα, same positions
  const early = R.migrateSave(make(2, 'route1', 16, 9, { gotStarter: true, rival1: true, t_phoebe: true }));
  assert.equal(early.player.map, 'route1'); assert.equal(early.player.x, 16);
  assert.equal(early.world.seen.kastella, undefined);
  assert.equal(R.placeState(early.world, 'kastella'), 'hidden');
  // 3. a version-3 save made by the map version (Καστέλλα was a question mark): loads, and now Καστέλλα is seen
  const v3 = R.migrateSave(make(3, 'studio', 4, 6, REWORK_FLAGS, { world: { visited: { newPeiraias: 1, harbourOffice: 1 }, routes: { route1: 1 }, stops: {}, badges: { peiraias: 1 }, seen: { harbourOffice: 1 } } }));
  same(idsOf(v3.world.visited), ['harbourOffice', 'newPeiraias']);
  assert.equal(v3.world.routes.route1, 1);
  assert.equal(v3.world.seen.kastella, 1);
  assert.equal(v3.player.map, 'studio');
  // 4. a new version-3 save on the new maps round-trips, and a visit marks the places and the route
  const world = R.newWorldState();
  R.worldVisit(world, 'route2', REWORK_FLAGS);
  R.worldVisit(world, 'kastella_theatre', REWORK_FLAGS);
  assert.equal(world.routes.route2, 1);
  assert.equal(world.visited.kastella, 1);
  const stored = R.migrateSave(make(3, 'kastella_hospital', 5, 7, REWORK_FLAGS, { world, lastHeal: { map: 'kastella_hospital', x: 5, y: 7, dir: 'up' } }));
  assert.equal(stored.player.map, 'kastella_hospital');
  same(stored.lastHeal, { map: 'kastella_hospital', x: 5, y: 7, dir: 'up' }, 'the Καστέλλα hospital is a valid return point');
  assert.equal(R.placeState(stored.world, 'kastella'), 'visited');
  assert.equal(stored.world.routes.route2, 1);
  const again = R.migrateSave(JSON.parse(JSON.stringify(stored)));
  same(again, stored);
  // 5. every old position of every old map still loads where it was (a sample per map), and the version-0/1 paths still work
  for (const id of OLD_MAP_IDS) {
    const rows = OLD_WALKABLE[id].split('/');
    let sample = null;
    for (let y = rows.length - 1; y >= 0 && !sample; y--) for (let x = rows[y].length - 1; x >= 0 && !sample; x--) if (rows[y][x] === '1' && R.tileWalkable(R.MAPS[id], x, y, REWORK_FLAGS)) sample = [x, y];
    const loaded = R.migrateSave(make(2, id, sample[0], sample[1], REWORK_FLAGS));
    assert.equal(loaded.player.map, id); assert.equal(loaded.player.x, sample[0]); assert.equal(loaded.player.y, sample[1]);
  }
  assert.equal(R.migrateSave({ version: 4, player: {}, party }), null, 'a newer version is still refused');
});
test('the new maps are painted from the same tiles as the old ones: the ferries, the crane and the yachts stand on water, the ΚΤΕΛ stop on a pavement', () => {
  const town = R.MAPS.town;
  for (const [x, y, char] of [[5, 1, 'Q'], [14, 1, 'Q'], [20, 1, 'X']]) assert.equal(R.tileAt(town, x, y), char, 'the town quay ' + x + ',' + y);
  assert.equal(R.tileAt(town, 22, 15), 'U');
  assert.ok(R.tileAt(town, 1, 1) === '~' && R.tileAt(town, 22, 1) === '~', 'the rest of the quay is still water');
  for (const char of ['Q', 'X', 'y', 'U']) assert.equal(R.TILE_DEFS[char].solid, true, char + ' is solid');
  let ferries = 0;
  for (const row of R.MAPS.route2.rows) for (const char of row) if (char === 'Q') ferries++;
  assert.equal(ferries, 2, 'two ferries on route 2');
});

// ---- XP band of a district (section 11.4): used by a test and by balance.mjs ----
// The player's first creature starts at ARRIVAL_LEVEL; three main creatures must reach the boss' top level. The fixed trainers of the district
// (the boss and the bonus studio host not counted) pay XP at the trainer bonus; the wild fights of the district's last route fill the gap.
export const ARRIVAL_LEVEL = { peiraias: 5 };
export function xpBand(rules, districtId) {
  const district = rules.WORLD.districts[districtId];
  const bossTeam = rules.TRAINERS[district.bossTrainer].team;
  const top = bossTeam[bossTeam.length - 1].lv;
  const need = 3 * (rules.xpForLevel(top) - rules.xpForLevel(ARRIVAL_LEVEL[districtId]));
  const trainerIds = [];
  let wildMapId = null;
  let wildTop = -1;
  for (const [mapId, map] of Object.entries(rules.MAPS)) {
    const place = rules.mapNode(mapId);
    if (!place || place.district !== districtId) continue;
    for (const npc of map.npcs) if (npc.kind === 'trainer' && !rules.TRAINERS[npc.trainer].recruitable) trainerIds.push(npc.trainer);
    for (const trigger of map.triggers || []) trainerIds.push(trigger.event);
    if (map.zones) { // the wild fights of the district are those of its zoned map with the highest levels
      const mapTop = Math.max(...map.zones.flatMap((zone) => zone.table.map((entry) => entry.max)));
      if (mapTop > wildTop) { wildTop = mapTop; wildMapId = mapId; }
    }
  }
  let trainerXp = 0;
  for (const id of trainerIds) for (const mon of rules.buildTrainerTeam(id, 'komma')) trainerXp += rules.xpReward(mon, true);
  let sum = 0;
  let weight = 0;
  for (const zone of rules.MAPS[wildMapId].zones) {
    for (const entry of zone.table) {
      for (let level = entry.min; level <= entry.max; level++) { sum += entry.w * rules.xpReward(rules.makeMon(entry.sp, level), false); weight += entry.w; }
    }
  }
  const wildXp = sum / weight;
  return { trainerIds, top, need, trainerXp, wildXp, wildFights: Math.max(0, Math.ceil((need - trainerXp) / wildXp)), trainerShare: trainerXp / need };
}

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
