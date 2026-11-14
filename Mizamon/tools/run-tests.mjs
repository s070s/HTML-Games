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
  const all = R.reachableTiles(start.map, start.x, start.y, { credits: true, badge: true, badge_notia: true, badge_anatolika: true, badge_voreia: true, badge_dytika: true }); // route 2 and Καστέλλα open with the Port Medal (flag badge), Ανατολικά with the Coast Medal, Βόρεια with the Boarding Medal, Δυτικά with the First Row Medal, Αθήνα with the Tax-Free Medal
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
  assert.equal(Object.keys(R.SPECIES).length, 37, '12 MVP creatures, Εφοπλιστάκος (MZ-WORLD-02a), the four of Νότια (MZ-WORLD-02b), the five of Ανατολικά (MZ-WORLD-02c), the seven of Βόρεια (MZ-WORLD-02d), the five of Δυτικά (MZ-WORLD-02e), the legend of the Rock (MZ-WORLD-02f) and 2 parody characters');
  same(R.DEX_ORDER.slice().sort(), Object.keys(R.SPECIES).sort());
  for (const id of R.ITEM_IDS) assert.ok(R.ITEMS[id]);
  for (const id of R.SHOP_STOCK) assert.ok(R.ITEMS[id]);
  for (const id of Object.keys(R.START_BAG)) assert.ok(R.ITEMS[id]);
  const looks = [...html.matchAll(/^ {2}(\w+): \{ skin:/gm)].map((m) => m[1]);
  assert.ok(looks.length >= 15);
  for (const [id, trainer] of Object.entries(R.TRAINERS)) {
    assert.ok(looks.includes(trainer.look), id + ' look');
    assert.ok(trainer.team.length >= 1 && trainer.team.length <= 6);
    for (const entry of trainer.team) assert.ok(entry.sp === '$rival' || entry.sp === '$rivalEvo' || R.SPECIES[entry.sp], id + ' team member ' + entry.sp);
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
  const topBuiltLevel = 44; // the highest level of the built districts (the Αθήνα boss); raise it when a later district is built
  for (const id of Object.keys(R.TRAINERS)) {
    const last = R.TRAINERS[id].team[R.TRAINERS[id].team.length - 1];
    assert.ok(last.lv <= topBuiltLevel, id + ' last level ' + last.lv + ' is above the built top ' + topBuiltLevel);
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
  same(Object.values(W.districts).filter((district) => district.built).map((district) => district.id), ['peiraias', 'notia', 'anatolika', 'voreia', 'dytika', 'athina'], 'Πειραιάς, Νότια, Ανατολικά, Βόρεια, Δυτικά and Αθήνα are built');
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
  same(Object.keys(W.nodes).filter((id) => W.nodes[id].built), ['newPeiraias', 'harbourOffice', 'kastella', 'faliro', 'glyfada', 'koropi', 'spata', 'kifisia', 'marousi', 'peristeri', 'chaidari', 'monastiraki', 'syntagma']);
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
  assert.equal(R.districtState(world, 'notia'), 'open', 'Νότια is built and opens with the Port Medal');
  assert.equal(R.districtState(R.newWorldState(), 'notia'), 'locked', 'without the first badge it stays locked');
  assert.equal(R.districtState(world, 'anatolika'), 'locked', 'Ανατολικά stays locked until the Coast Medal');
  const withSecondBadge = R.newWorldState();
  withSecondBadge.badges.peiraias = 1; withSecondBadge.badges.notia = 1;
  assert.equal(R.districtState(withSecondBadge, 'anatolika'), 'open', 'Ανατολικά is built and opens with the Coast Medal');
  assert.equal(R.districtState(withSecondBadge, 'voreia'), 'locked', 'Βόρεια stays locked until the Boarding Medal');
  const withThirdBadge = R.newWorldState();
  withThirdBadge.badges.peiraias = 1; withThirdBadge.badges.notia = 1; withThirdBadge.badges.anatolika = 1;
  assert.equal(R.districtState(withThirdBadge, 'voreia'), 'open', 'Βόρεια is built and opens with the Boarding Medal');
  assert.equal(R.districtState(withThirdBadge, 'dytika'), 'locked', 'Δυτικά stays locked until the First Row Medal');
  const withFourthBadge = R.newWorldState();
  withFourthBadge.badges.peiraias = 1; withFourthBadge.badges.notia = 1; withFourthBadge.badges.anatolika = 1; withFourthBadge.badges.voreia = 1;
  assert.equal(R.districtState(withFourthBadge, 'dytika'), 'open', 'Δυτικά is built and opens with the First Row Medal');
  assert.equal(R.districtState(withFourthBadge, 'athina'), 'locked', 'Αθήνα stays locked until the Tax-Free Medal');
  const withFifthBadge = R.newWorldState();
  withFifthBadge.badges.peiraias = 1; withFifthBadge.badges.notia = 1; withFifthBadge.badges.anatolika = 1; withFifthBadge.badges.voreia = 1; withFifthBadge.badges.dytika = 1;
  assert.equal(R.districtState(withFifthBadge, 'athina'), 'open', 'Αθήνα is built and opens with the Tax-Free Medal');
  assert.equal(W.nodes.parliament.built, false, 'the Βουλή is a door on the square, not built yet (MZ-WORLD-02g)');
  // the district sheet counts the species of the zones of its maps
  const species = R.districtSpecies('peiraias');
  assert.equal(species.length, 10, 'the eight of route 1, Φακελάρχης and Εφοπλιστάκος of route 2');
  assert.ok(species.includes('fakelakis') && species.includes('giagiaka') && species.includes('efoplistakos'));
  same(R.districtSpecies('notia').sort(), ['efoplistakos', 'eforaki', 'fakelarchis', 'frapedoros', 'giagiaka', 'kafenovios', 'laikatzis', 'storoula', 'trolosavros'], 'the nine of Νότια (11.3.2)');
  same(R.districtSpecies('anatolika').sort(), ['efoplistakos', 'eforaki', 'influenza', 'kryptomakis', 'monastiriaki', 'monimos', 'nftarchis', 'storoula', 'trolosavros'], 'the nine of Ανατολικά (11.3.3)');
  same(R.districtSpecies('voreia').sort(), ['efoplistakos', 'fakelarchis', 'giotarchis', 'influenza', 'lobbylykaina', 'nftarchis', 'rialito', 'star90', 'trolosavros'], 'the nine of Βόρεια (11.3.4)');
  same(R.districtSpecies('dytika').sort(), ['eforaki', 'elegktis', 'fakelarchis', 'giagiaexo', 'giagiaka', 'giotarchis', 'kafenovios', 'ktimatomesitis', 'lobbylykaina', 'monastiriaki', 'monimos', 'rousfetolykos', 'tavlilordos'], 'the nine of Δυτικά (11.3.5) and the four pre-forms that the form rule keeps in the wild (11.15)');
  same(R.districtSpecies('athina').sort(), ['elegktis', 'giagiaexo', 'giotarchis', 'influenza', 'ktimatomesitis', 'lobbylykaina', 'monimos', 'rousfetolykos', 'star90', 'tavlilordos'], 'the ten wild creatures of Αθήνα (11.3.6; the legend of the Rock is not wild)');
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

// Section 11.7: the district's prize money must buy the stock of its new items. Πειραιάς sells nothing new (the Καστέλλα kiosk has the New Piraeus stock);
// Νότια adds the Δικηγόρος (150) and the Γεμιστά της Μάνας (300) to the two kiosks of its towns.
const DISTRICT_NEW_ITEMS = { peiraias: [], notia: ['dikigoros', 'gemista'], anatolika: [], voreia: ['chontros'], dytika: ['sylvasi'], athina: [] };
const STOCK_BEFORE_THE_REWORK = ['fakelaki', 'fakelos', 'koulouri', 'souvlaki', 'frapes', 'tsipouro'];
test('money budget: the prize money of the district covers the stock of its new items (Πειραιάς has none, Νότια two)', () => {
  assert.deepEqual(DISTRICT_NEW_ITEMS.peiraias, [], 'Πειραιάς adds no item');
  same(R.SHOP_STOCK, STOCK_BEFORE_THE_REWORK, 'the shop stock is the one before the rework, so no new item exists in Πειραιάς');
  assert.ok(R.MAPS.kastella_shop.npcs.some((npc) => npc.kind === 'shop') && R.MAPS.shop.npcs.some((npc) => npc.kind === 'shop'), 'every kiosk of Πειραιάς sells that one stock');
  for (const mapId of ['shop', 'kastella_shop']) same(R.shopStockOf(R.MAPS[mapId]), STOCK_BEFORE_THE_REWORK, mapId + ' keeps the old stock');
  for (const mapId of ['faliro_shop', 'glyfada_shop']) same(R.shopStockOf(R.MAPS[mapId]), STOCK_BEFORE_THE_REWORK.concat(DISTRICT_NEW_ITEMS.notia), mapId + ' adds the two new items');
  same(R.SHOP_STOCK_NOTIA, STOCK_BEFORE_THE_REWORK.concat(DISTRICT_NEW_ITEMS.notia));
  for (const mapId of ['koropi_shop', 'spata_shop']) same(R.shopStockOf(R.MAPS[mapId]), R.SHOP_STOCK_NOTIA, mapId + ' (Ανατολικά) adds no new item: the Χοντρός Φάκελος comes with Βόρεια');
  assert.deepEqual(DISTRICT_NEW_ITEMS.anatolika, [], 'Ανατολικά adds no item');
  for (const mapId of ['kifisia_shop', 'marousi_shop']) same(R.shopStockOf(R.MAPS[mapId]), R.SHOP_STOCK_NOTIA.concat(DISTRICT_NEW_ITEMS.voreia), mapId + ' (Βόρεια) adds the Χοντρός Φάκελος');
  same(R.SHOP_STOCK_VOREIA, R.SHOP_STOCK_NOTIA.concat(['chontros']));
  assert.equal(R.ITEMS.chontros.price, 600);
  for (const mapId of ['peristeri_shop', 'chaidari_shop']) same(R.shopStockOf(R.MAPS[mapId]), R.SHOP_STOCK_VOREIA.concat(DISTRICT_NEW_ITEMS.dytika), mapId + ' (Δυτικά) adds the Συλλογική Σύμβαση');
  same(R.SHOP_STOCK_DYTIKA, R.SHOP_STOCK_VOREIA.concat(['sylvasi']));
  assert.equal(R.ITEMS.sylvasi.price, 150);
  for (const id of DISTRICT_NEW_ITEMS.notia.concat(DISTRICT_NEW_ITEMS.voreia, DISTRICT_NEW_ITEMS.dytika)) assert.ok(!STOCK_BEFORE_THE_REWORK.includes(id) && R.ITEMS[id] && R.STRINGS['item.' + id] && R.STRINGS['itemd.' + id], id + ' is a new item with its texts');
  assert.equal(R.ITEMS.dikigoros.price, 150); assert.equal(R.ITEMS.gemista.price, 300);
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
  assert.ok(victory.includes('new BadgeLayer(') && victory.includes('new ChapterLayer()') && !victory.includes('new CreditsLayer()'), 'the badge, then the chapter card, no credits roll');
  assert.ok(victory.indexOf('G.flags[victory.flag] = true') < victory.indexOf('new BadgeLayer(') && victory.indexOf('new ChapterLayer()') < victory.indexOf('G.flags.credits = true'), 'order: badge flag, badge, card, credits flag');
  assert.ok(victory.indexOf('victory.chapterCard') < victory.indexOf('new ChapterLayer()'), 'only a boss whose victory data asks for it shows the card and sets the credits flag');
  same(R.TRAINERS.kotsos.victory, { flag: 'badge', win2: 'boss.win2', title: 'badge.title', sub: 'badge.sub', win3: 'boss.win3', chapterCard: true });
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

// ---- MZ-WORLD-02b: the district Νότια ----
const NOTIA_MAP_IDS = ['route3', 'faliro', 'faliro_hospital', 'faliro_shop', 'faliro_cafe', 'route4', 'glyfada', 'glyfada_hospital', 'glyfada_shop', 'glyfada_boss'];
const NOTIA_FLAGS = { gotStarter: true, rival1: true, badge: true, credits: true };
const NOTIA_TRAINERS = ['sunbedseller', 'conductor', 'lifeguard', 'surfer', 'rival3', 'golfer', 'skipper'];
const NOTIA_SPECIES = ['efoplistakos', 'eforaki', 'fakelarchis', 'frapedoros', 'giagiaka', 'kafenovios', 'laikatzis', 'storoula', 'trolosavros'];
// the walkable tiles (1) and solid tiles (0) of the five maps of the second half of Πειραιάς, taken from the base build f66b8c0 (MZ-WORLD-02a)
const OLD_WALKABLE_02A = {
  route2: '0000000000000000000000000000000000000000/0000000000000000000000000000000000000000/0000000000000000000000000000000000000000/0111001111111100000000111111111001111110/0111111111101101111110011111111111111110/0111111111111101111110111111111111111110/0111111111111100011000111111111101111110/0101111111111111111111111111111111111010/1111111111111111111111111111111111111111/0111111111011111111111110001100011111110/0111111111111111111111110111111011111110/0111111111111111111111010111111011111110/0111111111111111111111110000000011110110/0000000000000000000000000000000000000000',
  kastella: '00000000000000000000000000/01111111111111111111111110/01000011100000001110000110/01000011100000001110000110/01000011100000001110000110/01000011100010001110000110/01111111111011111111111110/00000011000000000000000000/01000011100000110000100000/01000011100000110000100000/01000011100000110000100000/01000011000100100100100000/11111111111111111111111110/00000000000000000000011000/01111111111111111111111100/00000000000000000000000000/00000000000000000000000000/00000000000000000000000000',
  kastella_hospital: '000000000000/011111111110/000000000000/001110111100/011111111110/001111111100/001101101100/011111111110/000001100000',
  kastella_shop: '00000000/00011000/00000000/01111110/01111110/00011000',
  kastella_theatre: '000000000000/011111111110/011111111110/011111111110/011111111110/011111111110/011111111110/011111111110/011111111110/000001100000',
};

test('Νότια XP band (section 11.4): within W = 10 wild fights, the seven trainers alone give at most 1.3 times the need', () => {
  const band = xpBand(R, 'notia');
  same(band.trainerIds.slice().sort(), NOTIA_TRAINERS.slice().sort(), 'the seven trainers of route 3, route 4 and Γλυφάδα (the boss does not count)');
  assert.equal(band.top, 20);
  assert.equal(band.need, 10446, '3 x (xpForLevel(20) - xpForLevel(13))');
  assert.ok(band.wildFights <= 10, 'wild fights still needed: ' + band.wildFights);
  assert.ok(band.trainerShare <= 1.3 && band.trainerShare < 1, 'trainers give ' + band.trainerShare.toFixed(2) + ' of the need');
  assert.ok(band.trainerXp > 0 && band.wildXp > 0);
  assert.ok(R.TRAINERS.bougatsas.boss && !band.trainerIds.includes('bougatsas'), 'the boss comes after the climb');
});
test('Νότια: the road from Καστέλλα is shut without the Port Medal; every new map is reachable, has its way back and no dead end', () => {
  const start = R.START_MAP;
  const gate = R.MAPS.kastella.warps.find((warp) => warp.x === 25 && warp.y === 14);
  assert.ok(gate && gate.to === 'route3' && gate.needFlag === 'badge' && R.STRINGS[gate.lockedText], 'the gate at the east end of the promenade needs the flag badge and says why');
  assert.ok(!R.tileDef(R.MAPS.kastella, 24, 14).solid && !R.tileDef(R.MAPS.kastella, 25, 14).solid && !R.MAPS.kastella.signs['24,14'], 'the road sign of the roadworks is gone and the promenade walks on');
  const without = R.reachableTiles(start.map, start.x, start.y, { gotStarter: true });
  for (const id of NOTIA_MAP_IDS) assert.ok(![...without].some((key) => key.startsWith(id + ':')), id + ' is not reachable without the badge');
  const shutOnKastella = R.reachableTiles('kastella', 1, 12, { gotStarter: true }); // standing in Καστέλλα, but the medal flag missing (a damaged save)
  assert.ok(shutOnKastella.has('kastella:24:14') && !shutOnKastella.has('kastella:25:14') && !shutOnKastella.has('route3:1:8'), 'the gate tile is shut without the badge flag');
  const all = R.reachableTiles(start.map, start.x, start.y, NOTIA_FLAGS);
  assert.ok(all.has('kastella:25:14') && all.has('route3:1:8') && all.has('route3:38:8') && all.has('faliro:1:9') && all.has('faliro:28:9') && all.has('route4:1:8') && all.has('route4:34:8') && all.has('glyfada:1:7'), 'through the gate and along both routes into Γλυφάδα');
  for (const id of NOTIA_MAP_IDS) {
    const map = R.MAPS[id];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (/_(hospital|shop)$/.test(id) && y === 1) continue; // behind the counter, as in the templates of New Piraeus
      if (id === 'glyfada' && x === 27 && y === 7) continue; // the gate tile to Ανατολικά (MZ-WORLD-02c): shut without the flag badge_notia
      if (!R.tileDef(map, x, y).solid && !R.npcAtTile(map, x, y, NOTIA_FLAGS)) assert.ok(all.has(id + ':' + x + ':' + y), id + ' walkable tile ' + x + ',' + y + ' is cut off');
    }
    for (const warp of map.warps) {
      assert.ok(R.MAPS[warp.to].warps.some((back) => back.to === id), id + ' -> ' + warp.to + ' has a return warp');
      assert.ok(R.tileWalkable(R.MAPS[warp.to], warp.tx, warp.ty, NOTIA_FLAGS), id + ' -> ' + warp.to + ' arrives on a walkable tile');
      if (warp.needFlag === 'badge_notia') continue; // the gate to Ανατολικά: tested by the Ανατολικά tests
      assert.ok(all.has(id + ':' + warp.x + ':' + warp.y), id + ' warp ' + warp.x + ',' + warp.y + ' is reachable');
    }
    for (const npc of map.npcs) assert.ok(R.npcTalkable(id, npc, all), id + ':' + npc.id + ' can be talked to');
    for (const key of Object.keys(map.signs)) {
      const [sx, sy] = key.split(',').map(Number);
      assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => all.has(id + ':' + (sx + dx) + ':' + (sy + dy))), id + ' sign ' + key + ' can be read');
      assert.ok(R.tileDef(map, sx, sy).solid, id + ' sign ' + key + ' stands on a sign tile');
    }
  }
  assert.ok(all.has('route3:0:8') && all.has('route3:39:8'), 'both ends of route 3');
  // no dead end: standing in Γλυφάδα, on route 4 or in Παλαιό Φάληρο the player reaches exactly what is reachable from the start
  for (const [mapId, x, y] of [['glyfada', 1, 7], ['route4', 1, 8], ['faliro', 1, 9], ['route3', 1, 8], ['glyfada_boss', 5, 8]]) {
    assert.equal(R.reachableTiles(mapId, x, y, NOTIA_FLAGS).size, all.size, 'from ' + mapId + ' everything can be reached again');
  }
  // the boss can be talked to across the counter; the east end of Γλυφάδα is the gate to Ανατολικά (MZ-WORLD-02c) with its sign beside it
  assert.ok(R.npcTalkable('glyfada_boss', R.MAPS.glyfada_boss.npcs.find((npc) => npc.id === 'bougatsas'), all));
  assert.equal(R.MAPS.glyfada.signs['27,6'], 'sign.glyfada.east');
  assert.ok(R.MAPS.glyfada.warps.some((warp) => warp.x === 27 && warp.y === 7 && warp.to === 'route5' && warp.needFlag === 'badge_notia'), 'the gate to Ανατολικά');
});
test('Νότια data: sizes of 11.7, places on the world map, rows, tiles, wild tables with the species of 11.3.2, two towns with hospital, kiosk, ΚΤΕΛ stop, café and boss café', () => {
  const sizes = { route3: [40, 14], faliro: [30, 16], faliro_hospital: [12, 9], faliro_shop: [8, 6], faliro_cafe: [10, 8], route4: [36, 20], glyfada: [28, 18], glyfada_hospital: [12, 9], glyfada_shop: [8, 6], glyfada_boss: [12, 10] };
  for (const id of NOTIA_MAP_IDS) {
    const map = R.MAPS[id];
    same([map.w, map.h], sizes[id], id + ' size');
    assert.equal(map.rows.length, map.h);
    for (const row of map.rows) { assert.equal(row.length, map.w, id + ' width'); for (const char of row) assert.ok(R.TILE_DEFS[char], id + ' tile ' + char); }
    assert.ok(R.mapNode(id) && R.mapNode(id).district === 'notia', id + ' belongs to a place of Νότια');
    assert.ok(R.STRINGS[map.name], id + ' name');
  }
  assert.equal(NOTIA_MAP_IDS.reduce((sum, id) => sum + R.MAPS[id].w * R.MAPS[id].h, 0), 40 * 14 + 30 * 16 + 12 * 9 * 2 + 8 * 6 * 2 + 10 * 8 + 36 * 20 + 28 * 18 + 12 * 10, 'the tiles of the build plan');
  same([W.nodes.faliro.built, W.nodes.glyfada.built, W.routes.route3.built, W.routes.route4.built, W.nodes.faliro.stop, W.nodes.glyfada.stop], [true, true, true, true, true, true]);
  same([R.mapNode('faliro_cafe').id, R.mapNode('glyfada_boss').id, R.mapNode('route3').id, R.mapNode('route4').id], ['faliro', 'glyfada', 'route3', 'route4']);
  // wild tables: the species of 11.3.2 at the levels of 11.3.2 (R3 13-16, R4 16-19), evolved forms only at or above their evolution level
  const allowed = { route3: ['eforaki', 'efoplistakos', 'fakelarchis', 'frapedoros', 'laikatzis', 'trolosavros'], route4: ['efoplistakos', 'frapedoros', 'giagiaka', 'kafenovios', 'storoula'] };
  const range = { route3: [13, 16], route4: [16, 19] };
  const seenInZones = new Set();
  for (const mapId of ['route3', 'route4']) {
    const used = new Set();
    for (const zone of R.MAPS[mapId].zones) for (const entry of zone.table) {
      used.add(entry.sp); seenInZones.add(entry.sp);
      assert.ok(entry.min >= range[mapId][0] && entry.max <= range[mapId][1] && entry.min <= entry.max, mapId + ' ' + entry.sp + ' levels');
      for (const species of Object.values(R.SPECIES)) if (species.evo && species.evo.to === entry.sp) assert.ok(entry.min >= species.evo.lv, entry.sp + ' appears only from its evolution level');
    }
    same([...used].sort(), allowed[mapId].slice().sort(), mapId + ' species');
    const lows = R.MAPS[mapId].zones.map((zone) => zone.table.reduce((a, b) => (a.w <= b.w ? a : b)).sp);
    if (mapId === 'route3') assert.ok(lows.every((sp) => sp === 'fakelarchis'), 'Φακελάρχης is the rare one on route 3 (11.3.2)');
  }
  same(R.districtSpecies('notia').sort(), NOTIA_SPECIES);
  assert.equal(Math.min(...R.MAPS.route3.zones.flatMap((zone) => zone.table.map((entry) => entry.min))), 13);
  assert.equal(Math.max(...R.MAPS.route4.zones.flatMap((zone) => zone.table.map((entry) => entry.max))), 19);
  // each town: a hospital that heals (return point), a kiosk with the new stock, a ΚΤΕΛ stop tile; Παλαιό Φάληρο the first Καφενείο, Γλυφάδα the boss café
  for (const [town, buildings] of [['faliro', ['faliro_hospital', 'faliro_shop', 'faliro_cafe']], ['glyfada', ['glyfada_hospital', 'glyfada_shop', 'glyfada_boss']]]) {
    assert.ok(R.MAPS[town].rows.join('').includes('U'), town + ' has its ΚΤΕΛ stop');
    assert.ok(R.MAPS[town].warps.filter((warp) => buildings.includes(warp.to)).length === 3, town + ' has the three doors');
    const hospital = R.MAPS[town + '_hospital'];
    assert.ok(hospital.npcs.some((npc) => npc.kind === 'heal') && hospital.actions['1,3'] === 'archive' && !R.tileDef(hospital, R.HOSPITAL_SPOT.x, R.HOSPITAL_SPOT.y).solid, town + ' hospital heals and has the archive terminal');
    assert.ok(R.MAPS[town + '_shop'].npcs.some((npc) => npc.kind === 'shop'));
  }
  assert.ok(R.MAPS.faliro_cafe.npcs.some((npc) => npc.kind === 'save') && R.STRINGS[R.MAPS.faliro_cafe.cafeHello], 'the first Καφενείο of Νότια saves, with its own greeting');
  assert.ok(!R.MAPS.glyfada_boss.npcs.some((npc) => npc.kind === 'save'), 'only the first town has the café');
  assert.ok(R.MAPS.glyfada_boss.npcs.some((npc) => npc.kind === 'boss' && npc.trainer === 'bougatsas'));
  // the sprites and texts of the new tiles
  for (const char of ['a', 'b', 'k', 'l', 'n', 'o', 'p', 'q', 'u', 'G']) { assert.ok(R.TILE_DEFS[char] && html.includes("make('" + char + "'"), 'a sprite for tile ' + char); }
  for (const char of ['b', 'k', 'n', 'p', 'q', 'G']) assert.equal(R.TILE_DEFS[char].solid, true, char + ' is solid');
  for (const char of ['a', 'l', 'o', 'u']) assert.equal(R.TILE_DEFS[char].solid, false, char + ' is walkable');
  // sand, sea and a lot of grass: the sea is the bottom edge of the maps of the strip (11.3.2)
  for (const id of ['route3', 'faliro', 'route4', 'glyfada']) assert.ok(R.MAPS[id].rows.slice(-4).some((row) => row.includes('~')), id + ' has the sea along its bottom');
  assert.ok(R.MAPS.route4.rows.join('').split('o').length > 60, 'two runways');
  for (const id of ['faliro', 'glyfada']) for (const key of Object.keys(R.MAPS[id].signs)) assert.ok(R.STRINGS[R.MAPS[id].signs[key]]);
});
test('Νότια species: Καφενόβιος and the three middle starter forms have stats, moves, abilities, dossier texts, sprites and an evolution that is consistent', () => {
  const kafenovios = R.SPECIES.kafenovios;
  assert.equal(kafenovios.t, 'mem');
  assert.ok(kafenovios.rec > 0 && kafenovios.xp > 0 && kafenovios.base.reduce((a, b) => a + b, 0) > 280);
  const middle = { komma: 'vouleftakos', koulourak: 'batsonos', psaltak: 'diakosdisko' };
  for (const [starterId, formId] of Object.entries(middle)) {
    const starter = R.SPECIES[starterId];
    const form = R.SPECIES[formId];
    same(starter.evo, { to: formId, lv: 16 }, starterId + ' evolves at level 16 (11.3)');
    assert.equal(form.t, starter.t, formId + ' keeps the type');
    assert.equal(form.ab, starter.ab, formId + ' keeps the ability');
    assert.equal(form.rec, 0, formId + ' cannot be recruited');
    assert.ok(form.base.reduce((a, b) => a + b, 0) > starter.base.reduce((a, b) => a + b, 0), formId + ' is stronger than ' + starterId);
    assert.equal(form.evo.lv, 32, formId + ' evolves at level 32 (11.3, the last starter forms of MZ-WORLD-02d)');
    assert.ok(R.movesAtLevel(formId, 18).length === 4 && R.makeMon(formId, 18).moves.every((id) => R.MOVES[id]));
    assert.equal(R.evolutionFor(R.makeMon(starterId, 15)), null);
    assert.equal(R.evolutionFor(R.makeMon(starterId, 16)), formId);
    const mon = R.makeMon(starterId, 16);
    const before = R.maxHp(mon);
    mon.hp = 5;
    assert.ok(R.evolveMon(mon) && mon.sp === formId && mon.hp === 5 + R.maxHp(mon) - before, 'evolving keeps the damage taken');
  }
  for (const id of ['kafenovios', 'vouleftakos', 'batsonos', 'diakosdisko']) {
    assert.ok(R.DEX_ORDER.includes(id) && R.STRINGS['sp.' + id][0].startsWith('Γνωστός για') && R.STRINGS['sp.' + id][1].includes('Never convicted'), id + ' dossier text');
    assert.ok(new RegExp('^ {2}' + id + ': function \\(p\\)', 'm').test(html), id + ' has a procedural sprite');
    assert.ok(R.STRINGS['sp.' + id][0].includes('Ποτέ δεν καταδικάστηκε'), id + ' Greek dossier ends like all the others');
  }
  // a creature's evolution is reached by levelling: gainXp to level 16 and the evolution is offered
  const komma = R.makeMon('komma', 15);
  R.gainXp(komma, R.xpForLevel(16) - komma.xp);
  assert.equal(komma.lv, 16);
  assert.equal(R.evolutionFor(komma), 'vouleftakos');
  // the rival's third fight shows the evolved form of whatever starter he took
  for (const starter of R.STARTERS) {
    const team = R.buildTrainerTeam('rival3', starter);
    assert.equal(team[team.length - 1].sp, middle[R.RIVAL_STARTER[starter]], 'rival, third fight, player starter ' + starter);
    assert.equal(team[team.length - 1].lv, 18);
  }
  assert.equal(R.TRAINERS.rival3.team[R.TRAINERS.rival3.team.length - 1].lv, R.TRAINERS.bougatsas.team[R.TRAINERS.bougatsas.team.length - 1].lv - 2, 'the rival: the boss top level minus 2');
  assert.equal(R.npcVisible({ kind: 'trainer', trainer: 'rival3' }, {}), true);
  assert.equal(R.npcVisible({ kind: 'trainer', trainer: 'rival3' }, { t_rival3: true }), false, 'he leaves after the third fight');
  // stat boost: only creatures that carry one; the formula for everybody else is the old one
  const plain = R.makeMon('giagiaka', 20);
  const boosted = R.makeMon('giagiaka', 20, 1.3);
  assert.equal(plain.boost, undefined);
  assert.ok(R.statOf(boosted, 'atk') > R.statOf(plain, 'atk') && R.maxHp(boosted) > R.maxHp(plain));
  assert.equal(R.cloneMon(boosted).boost, 1.3);
  assert.equal(R.statOf(plain, 'atk'), Math.floor(R.SPECIES.giagiaka.base[1] * 20 / 25) + 5);
  assert.equal(R.serializeMon(boosted).boost, undefined, 'a boost is never saved');
  for (const id of Object.keys(R.TRAINERS)) if (id !== 'bougatsas') assert.equal(R.TRAINERS[id].boost, undefined, id + ' has no boost');
  assert.ok(R.TRAINERS.bougatsas.boost > 1 && R.TRAINERS.bougatsas.boost <= 1.2);
});
test('Νότια items: the Δικηγόρος and the Γεμιστά της Μάνας heal and clear a status, in and out of a battle', () => {
  const mon = R.makeMon('komma', 40); // 142 HP
  mon.hp = 10; mon.status = { id: 'inv', turns: 3 };
  assert.ok(R.canUseItemOn(mon, 'dikigoros') && R.canUseItemOn(mon, 'gemista'));
  const healed = R.applyItemToMon(mon, 'dikigoros');
  assert.equal(healed, 80);
  assert.equal(mon.hp, 90); assert.equal(mon.status, null, 'the status is gone');
  mon.hp = 12; mon.status = { id: 'sca', turns: 0 };
  R.applyItemToMon(mon, 'gemista');
  assert.equal(mon.hp, R.maxHp(mon)); assert.equal(mon.status, null);
  const sick = R.makeMon('komma', 20); sick.status = { id: 'str', turns: 2 };
  assert.ok(R.canUseItemOn(sick, 'dikigoros') && R.canUseItemOn(sick, 'gemista'), 'a full-HP creature with a status can use them');
  assert.ok(!R.canUseItemOn(R.makeMon('komma', 20), 'dikigoros'), 'nothing to heal or clear');
  assert.ok(!R.canUseItemOn(R.makeMon('komma', 20), 'souvlaki'), 'the old items are as before');
  const fainted = R.makeMon('komma', 20); fainted.hp = 0;
  assert.ok(!R.canUseItemOn(fainted, 'gemista'));
  // in a battle the bag item is used on the active creature and the status event follows
  const battle = R.createBattle([R.makeMon('komma', 20)], [R.makeMon('giagiaka', 20)], R.makeRng(3), { kind: 'trainer', trainerId: 'sim', foeName: 'x', bag: { dikigoros: 1 } });
  const lead = battle.sides[0].party[0];
  lead.hp = 20; lead.status = { id: 'inv', turns: 4 };
  const events = R.playTurn(battle, { t: 'item', id: 'dikigoros', target: 0 });
  assert.ok(events.some((event) => event.k === 'msg' && event.key === 'b.item'), 'the item message');
  assert.equal(battle.bag.dikigoros, 0, 'the item is spent');
  assert.ok(lead.hp > 20 && lead.status === null, 'healed and cleared');
  // the bag of an old save (without the new items) gets zero of them
  const migrated = R.migrateSave({ version: 3, player: { name: 'Α', gender: 'm', map: 'town', x: 5, y: 8, dir: 'left' }, party: [R.serializeMon(R.makeMon('komma', 9))], bag: { fakelaki: 2 }, flags: {}, dex: { seen: {}, got: {} } });
  assert.equal(migrated.bag.dikigoros, 0); assert.equal(migrated.bag.gemista, 0); assert.equal(migrated.bag.fakelaki, 2);
});
test('Νότια trainers: seven trainers with names in the strings, levels 14-18, a seeded 1,000-battle replay twice gives equal checksums, the fights are winnable at the intended levels', () => {
  assert.equal(NOTIA_TRAINERS.length, 7);
  const onMaps = {};
  for (const id of ['route3', 'route4', 'glyfada']) for (const npc of R.MAPS[id].npcs) if (npc.kind === 'trainer') onMaps[npc.trainer] = id;
  same(onMaps, { sunbedseller: 'route3', conductor: 'route3', lifeguard: 'route3', surfer: 'route4', rival3: 'route4', golfer: 'route4', skipper: 'glyfada' }, 'three on route 3, three on route 4, one on the Γλυφάδα pier');
  for (const id of NOTIA_TRAINERS) {
    const trainer = R.TRAINERS[id];
    assert.ok(trainer.team.length >= 2 && trainer.team.length <= 3 && !trainer.boss, id + ' team');
    for (const entry of trainer.team) assert.ok(entry.lv >= 14 && entry.lv <= 18, id + ' level ' + entry.lv);
    for (const part of ['intro', 'win', 'after']) assert.ok(R.STRINGS['tr.' + id + '.' + part], id + ' ' + part);
    const npc = Object.values(R.MAPS).flatMap((map) => map.npcs).find((entry) => entry.trainer === id);
    assert.ok(npc.sight >= 2 && npc.sight <= 3, id + ' sees ' + npc.sight + ' tiles');
  }
  const members = new Set(NOTIA_TRAINERS.flatMap((id) => R.TRAINERS[id].team.map((entry) => entry.sp)));
  for (const species of ['efoplistakos', 'giagiaka', 'kafenovios', 'storoula', 'dimosio', 'eforaki']) assert.ok(members.has(species), 'the trainers use ' + species);
  const replay = (seed) => {
    const rng = R.makeRng(seed);
    const lines = [];
    const ids = NOTIA_TRAINERS.concat(['bougatsas']);
    for (let i = 0; i < 125; i++) {
      for (const id of ids) {
        const team = notiaTeam(R, rng, 18, 3);
        const result = R.simulateBattle(team, R.buildTrainerTeam(id, 'komma'), rng, { foeItems: R.TRAINERS[id].items });
        lines.push(id + result.winner + ':' + result.turns);
      }
    }
    assert.equal(lines.length, 1000);
    return R.hashString(lines.join('|'));
  };
  assert.equal(replay(31), replay(31));
  assert.notEqual(replay(31), replay(32));
  const winRate = (trainerId, level, size, runsCount) => {
    const rng = R.makeRng(1900 + level + size);
    let wins = 0;
    for (let i = 0; i < runsCount; i++) wins += R.simulateBattle(notiaTeam(R, rng, level, size), R.buildTrainerTeam(trainerId, 'komma'), rng, { playerItems: [] }).winner === 0 ? 1 : 0;
    return wins / runsCount;
  };
  // a full team of level 18 (the level of the last route 4 trainers) wins every trainer fight almost always; three creatures still win more often than not
  for (const id of NOTIA_TRAINERS) {
    assert.ok(winRate(id, 18, 6, 100) >= 0.9, id + ' with six creatures at level 18');
    assert.ok(winRate(id, 18, 3, 100) >= 0.5, id + ' with three creatures at level 18');
  }
});
test('Νότια boss, win-rate bands (the offsets of 11.7, kept by the four-creature team and the boost of 11.12) with the AI-played player team, and the boss data', () => {
  const boss = R.TRAINERS.bougatsas;
  same(boss.team.map((entry) => entry.sp + entry.lv), ['kafenovios18', 'efoplistakos20', 'frapedoros19', 'giagiaka20'], 'the boss team of 11.12');
  assert.ok(boss.boost > 1 && boss.boost <= 1.2, 'a small boost, visible in the battle (the mark)');
  assert.equal(boss.boss, true); assert.equal(boss.bonus, 200);
  assert.equal(boss.look, 'bougatsas');
  assert.equal(R.WORLD.districts.notia.bossTrainer, 'bougatsas');
  assert.equal(R.WORLD.districts.notia.badgeFlag, 'badge_notia');
  assert.equal(boss.victory.flag, 'badge_notia');
  for (const key of ['win2', 'title', 'sub', 'win3']) assert.ok(R.STRINGS[boss.victory[key]], 'victory text ' + key);
  assert.equal(boss.victory.chapterCard, undefined, 'only the first boss ends a chapter');
  assert.equal(R.STRINGS['badge.notia.title'][0], 'ΠΑΡΑΣΗΜΟ ΠΑΡΑΛΙΑΚΗΣ');
  // the money: 20 x 30 + 200 for the boss
  const prize = R.prizeFor({ sides: [{ party: [], active: 0 }, { party: R.buildTrainerTeam('bougatsas', 'komma') }] }, boss);
  assert.equal(prize, 20 * 30 + 200);
  // the bands
  const top = boss.team[boss.team.length - 1].lv;
  const twoSouvlaki = ['souvlaki', 'souvlaki'];
  const bands = [];
  for (const [label, offset, size, items, low, high] of bossBands(R, 'bougatsas')) bands.push([label, bossWinRate(R, 'bougatsas', top + offset, size, items === 2 ? twoSouvlaki : [], BOSS_RUNS_PER_CELL, 5000), low, high]);
  for (const [label, rate, low, high] of bands) assert.ok(rate >= low && rate <= high, 'Μπουγάτσας, ' + label + ': ' + rate + ' outside ' + low + '-' + high);
  // stronger than the plain species: without the boost the same fight is easier (top minus 3 with six creatures leaves its band)
  const plainBoss = R.TRAINERS.bougatsas.boost;
  R.TRAINERS.bougatsas.boost = undefined;
  try { assert.ok(bossWinRate(R, 'bougatsas', top - 3, 6, twoSouvlaki, BOSS_RUNS_PER_CELL, 5000) > 0.3, 'no boost: top minus 3 is above 30 %'); } finally { R.TRAINERS.bougatsas.boost = plainBoss; }
});
test('every built district boss, per starter: each starter wins at least 75 % at top plus 1 with six creatures, and the starters are within 35 points of each other at top minus 1', () => {
  const runsPerCell = BOSS_RUNS_PER_CELL;
  for (const bossId of ['kotsos', 'bougatsas', 'faia', 'amartia', 'plousiakis', 'baboulas']) {
    const team = R.TRAINERS[bossId].team;
    const top = team[team.length - 1].lv;
    const atTop = R.STARTERS.map((starter) => starterBossRate(R, bossId, starter, top + 1, 6, runsPerCell, 8000));
    const behind = R.STARTERS.map((starter) => starterBossRate(R, bossId, starter, top - 1, 6, runsPerCell, 8000));
    atTop.forEach((rate, index) => assert.ok(rate >= 0.75, bossId + ', ' + R.STARTERS[index] + ' at top plus 1: ' + rate));
    assert.ok(Math.max(...behind) - Math.min(...behind) <= 0.35, bossId + ' spread at top minus 1: ' + behind.join(' '));
  }
});
test('Νότια: old saves (v2 and v3, standing anywhere in Πειραιάς) load and continue; the new flag and the new places migrate; old creatures evolve at 16', () => {
  const party = [{ sp: 'komma', lv: 17, xp: R.xpForLevel(17), hp: 40 }, { sp: 'fakelakis', lv: 9, xp: R.xpForLevel(9), hp: 20 }];
  const make = (version, map, x, y, flags, extra) => Object.assign({ version, player: { name: 'ΝΙΚΟΣ', gender: 'm', map, x, y, dir: 'left' }, party, archive: [], money: 555, bag: { fakelaki: 3, souvlaki: 2 },
    dex: { seen: { komma: true }, got: { komma: true } }, flags, lastHeal: { map: 'kastella_hospital', x: 5, y: 7, dir: 'up' }, options: { lang: 'el', sound: true, textSpeed: 1, reduceMotion: false }, rngState: 99, starter: 'komma' }, extra || {});
  // every walkable tile of every map of Πειραιάς (the nine old ones, route 2 and Καστέλλα with its three buildings): the save loads where it stood
  const sampleOf = (rows, mapId) => {
    const found = [];
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === '1' && R.tileWalkable(R.MAPS[mapId], x, y, NOTIA_FLAGS)) found.push([x, y]);
    return found;
  };
  let count = 0;
  for (const id of OLD_MAP_IDS) for (const [x, y] of sampleOf(OLD_WALKABLE[id].split('/'), id)) {
    for (const version of [2, 3]) {
      const loaded = R.migrateSave(make(version, id, x, y, NOTIA_FLAGS));
      assert.ok(loaded.player.map === id && loaded.player.x === x && loaded.player.y === y, version + ' ' + id + ' ' + x + ',' + y + ' loads where it stood');
      count++;
    }
  }
  for (const id of Object.keys(OLD_WALKABLE_02A)) for (const [x, y] of sampleOf(OLD_WALKABLE_02A[id].split('/'), id)) {
    const loaded = R.migrateSave(make(3, id, x, y, NOTIA_FLAGS));
    assert.ok(loaded.player.map === id && loaded.player.x === x && loaded.player.y === y, id + ' ' + x + ',' + y + ' loads where it stood');
    count++;
  }
  assert.ok(count > 1500, 'a lot of positions were loaded: ' + count);
  // the creatures of an old save: Κομματάκι L17 is evolvable (the game offers it after the next battle), nothing is lost
  const old = R.migrateSave(make(2, 'kastella', 12, 8, NOTIA_FLAGS));
  assert.equal(old.party[0].sp, 'komma'); assert.equal(old.party[0].lv, 17);
  assert.equal(R.evolutionFor(R.restoreMon(old.party[0])), 'vouleftakos');
  assert.equal(old.money, 555); assert.equal(old.bag.souvlaki, 2); assert.equal(old.bag.gemista, 0);
  same(old.lastHeal, { map: 'kastella_hospital', x: 5, y: 7, dir: 'up' });
  assert.equal(R.placeState(old.world, 'faliro'), 'hidden', 'Παλαιό Φάληρο is told about only when route 3 is walked');
  assert.equal(R.districtState(old.world, 'notia'), 'open', 'the Port Medal opens the district');
  // a new save: Νότια places, the new badge flag
  const world = R.newWorldState();
  R.worldVisit(world, 'route3', NOTIA_FLAGS);
  assert.equal(world.routes.route3, 1); assert.equal(R.placeState(world, 'faliro'), 'seen');
  R.worldVisit(world, 'faliro_cafe', NOTIA_FLAGS);
  R.worldVisit(world, 'route4', NOTIA_FLAGS);
  R.worldVisit(world, 'glyfada_boss', Object.assign({ badge_notia: true }, NOTIA_FLAGS));
  assert.equal(R.placeState(world, 'faliro'), 'visited'); assert.equal(R.placeState(world, 'glyfada'), 'visited');
  assert.equal(world.badges.notia, 1, 'the flag badge_notia fills the badge');
  assert.equal(R.districtState(world, 'notia'), 'cleared');
  assert.equal(R.districtState(world, 'anatolika'), 'open', 'the Coast Medal opens Ανατολικά');
  assert.equal(R.districtState(world, 'voreia'), 'locked', 'the next district is not built');
  const stored = R.migrateSave(make(3, 'glyfada_hospital', 5, 7, Object.assign({ badge_notia: true, t_bougatsas: true }, NOTIA_FLAGS), { world, lastHeal: { map: 'glyfada_hospital', x: 5, y: 7, dir: 'up' } }));
  same(stored.lastHeal, { map: 'glyfada_hospital', x: 5, y: 7, dir: 'up' }, 'the Γλυφάδα hospital is a valid return point');
  assert.equal(stored.player.map, 'glyfada_hospital');
  assert.equal(stored.flags.badge_notia, true);
  assert.equal(stored.world.routes.route4, 1);
  same(R.migrateSave(JSON.parse(JSON.stringify(stored))), stored, 'a second load changes nothing');
  // a flag without the world part (a v2 save of the next build): the badge is still shown
  const flagOnly = R.migrateSave(make(2, 'kastella', 12, 8, Object.assign({ badge_notia: true }, NOTIA_FLAGS)));
  assert.equal(flagOnly.world.badges.notia, 1);
  // a save from this build stands on a Νότια tile that an older build does not know: it falls back to the start, as for every unknown place
  assert.equal(R.migrateSave(make(3, 'atlantis', 3, 3, NOTIA_FLAGS)).player.map, 'lab');
});
test('Νότια leaves Πειραιάς as it was: only the east end of the Καστέλλα promenade changes (24,14 walks on, 25,14 is the gate); every old walkable tile is still walkable', () => {
  for (const id of Object.keys(OLD_WALKABLE_02A)) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE_02A[id].split('/');
    assert.equal(map.h, rows.length, id + ' height'); assert.equal(map.w, rows[0].length, id + ' width');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (rows[y][x] === '1') assert.ok(!R.tileDef(map, x, y).solid, id + ' ' + x + ',' + y + ' was walkable and still must be');
  }
  const nowWalkable = [];
  for (const id of Object.keys(OLD_WALKABLE_02A)) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE_02A[id].split('/');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (rows[y][x] === '0' && !R.tileDef(map, x, y).solid) nowWalkable.push(id + ':' + x + ',' + y);
  }
  same(nowWalkable, ['kastella:24,14', 'kastella:25,14']);
  for (const id of ['route2', 'kastella', 'kastella_hospital', 'kastella_shop', 'kastella_theatre']) assert.ok(R.STRINGS[R.MAPS[id].name]);
  assert.equal(R.MAPS.kastella.signs['24,13'], 'sign.kastella.east');
  assert.equal(R.districtState(R.newWorldState(), 'peiraias'), 'open');
});
test('Νότια boss path: the boss victory sets only the flag of its own badge; the Port Medal flag and the credits flag are not touched; the badge card takes its texts and ribbon from the boss data', () => {
  const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));
  const victory = part('OverworldLayer.prototype.bossVictory', 'OverworldLayer.prototype.runEvent');
  assert.ok(victory.includes('TRAINERS[trainerId].victory') && victory.includes('G.flags[victory.flag] = true'));
  assert.ok(!/G\.flags\.badge\b/.test(victory), 'no hard-coded Port Medal flag any more');
  assert.ok(html.includes('this.bossVictory(trainerId)'), 'the fight tells which boss it was');
  const layer = part('function BadgeLayer(', '// The short card after the first boss');
  assert.ok(layer.includes("titleKey || 'badge.title'") && layer.includes('this.ribbon') && !layer.includes('T(\'badge.title\')'), 'the badge card is data driven');
  // text widths are checked in the page (selfTest); here: the strings differ from the first badge and say what they are
  assert.notEqual(R.STRINGS['badge.notia.title'][0], R.STRINGS['badge.title'][0]);
  assert.ok(R.STRINGS['boss.bougatsas.win3'][0].includes('Παραλιακής') && R.STRINGS['boss.bougatsas.win3'][1].includes('Coast Medal'));
  assert.ok(R.STRINGS['tr.bougatsas.intro'][0].includes('{ανιψιέ|ανιψιά}'), 'the player is addressed with the gender choice');
});
test('Νότια: no per-frame text building in the new code (the shop and the badge card take their text from the cached T() or build it once)', () => {
  const shopDraw = html.slice(html.indexOf('ShopLayer.prototype.draw'), html.indexOf('// ---- Evolution and move learning'));
  assert.ok(!/T\('[^']+', \{/.test(shopDraw) && !shopDraw.includes('wrapText('), 'the shop draw builds no text with variables and does not wrap');
  const badgeDraw = html.slice(html.indexOf('BadgeLayer.prototype.draw'), html.indexOf('// The short card after the first boss'));
  assert.ok(!badgeDraw.includes('shadeColor(') && badgeDraw.includes('this.ribbonDark'), 'the dark ribbon colour is built once in the constructor');
  assert.ok(html.includes('this.ribbonDark = shadeColor(this.ribbon, 0.6)'));
  const pollDraw = html.slice(html.indexOf('BattleLayer.prototype.drawPollPanel'), html.indexOf('// The four command tabs'));
  assert.ok(pollDraw.includes('drawBoostMark(') && !pollDraw.includes('measureText'), 'the boost mark is drawn from a value measured once when the creature is sent out');
});

// ---- MZ-WORLD-02c: the district Ανατολικά ----
const ANATOLIKA_MAP_IDS = ['route5', 'koropi', 'koropi_hospital', 'koropi_shop', 'koropi_cafe', 'route6', 'spata', 'spata_hospital', 'spata_shop', 'spata_boss'];
const ANATOLIKA_FLAGS = Object.assign({ badge_notia: true }, NOTIA_FLAGS);
const ANATOLIKA_TRAINERS = ['pilgrim', 'customs', 'tourist', 'vineyard', 'cryptoseller', 'spotter', 'checkin'];
const ANATOLIKA_SPECIES = ['efoplistakos', 'eforaki', 'influenza', 'kryptomakis', 'monastiriaki', 'monimos', 'nftarchis', 'storoula', 'trolosavros'];
const ANATOLIKA_NEW_SPECIES = ['monastiriaki', 'monimos', 'influenza', 'kryptomakis', 'nftarchis'];
// the walkable tiles (1) and solid tiles (0) of the ten maps of Νότια, taken from the base build e05a06c (MZ-WORLD-02b)
const OLD_WALKABLE_02B = {
route3: '0000000000000000000000000000000000000000/0111111111111111111111111111111111111110/0111111111111011111111111111111111111110/0111111111110111111111111111011111111110/0111111111111111111111111110111111111110/0111111111111111111111111111111111111100/0101111111111111111111111111111111111010/1111111111111111111111111111111111111111/1111111111111111111111111111111111111111/0111111111111110111110111110111111111110/0101111111011011101111110111111111111100/0000000000000000000000000000000000000000/0000000000000000000000000000000000000000/0000000000000000000000000000000000000000',
  faliro: '000000000000000000000000000000/011111111111111111111111111110/010000001000001000001011100000/010000011000011000001101100000/010000011000011000001111100000/010010001010001001000111000000/011111111111111111111111111110/011111111111111111111101111110/011111111111011111111111111110/111111111111111111111111111111/011111111111111111111111111110/010110111111110110111111111010/011111111011011111110111101110/000000000000000000000000000000/000000000000000000000000000000/000000000000000000000000000000',
  faliro_hospital: '000000000000/011111111110/000000000000/001110111100/011111111110/001111111100/001101101100/011111111110/000001100000',
  faliro_shop: '00000000/00011000/00000000/01111110/01111110/00011000',
  faliro_cafe: '0000000000/0001111100/0000001110/0111111110/0111111110/0100110010/0111111110/0000110000',
  route4: '000000000000000000000000000000000000/011000000011111111111111000000000110/011000000011111111111111000000000110/011111111110111111111011111111111110/011111111111111111111111111111111110/011111111111111111111111111111111110/011111111111111111111111111111111110/010111111111111111111111111111111010/111111111111111111111111111111111111/011111111111111111111111111111111110/011111111110111111111111101111111110/011111111111111111111111111111111110/011111111111111111111111111111111110/011111111111111111111111111111111110/011111011111111111111101111111111110/011111111111101111111111111111011110/011101111111011111110111111101111110/000000000000000000000000000000000000/000000000000000000000000000000000000/000000000000000000000000000000000000',
  glyfada: '0000000000000000000000000000/0111111111111111111111111110/0100000010000100000000100000/0100000110000100000000100000/0100000110000100000000100000/0100100010100000010000000000/0111111111111111111111101110/1111111111111111111111111100/0011111111111111111111111110/0111111111111000011000011110/0111111111101000011000010110/0111111111111000011000011110/0111111111110000011000001010/0111011111111111111111111110/0000000000001100000000000000/0000000000001100000000000000/0000000000000000000000000000/0000000000000000000000000000',
  glyfada_hospital: '000000000000/011111111110/000000000000/001110111100/011111111110/001111111100/001101101100/011111111110/000001100000',
  glyfada_shop: '00000000/00011000/00000000/01111110/01111110/00011000',
  glyfada_boss: '000000000000/000111111100/011111111110/011100001110/011111111110/010011110010/011111111110/010011110010/011111111110/000001100000',
};

test('Ανατολικά XP band (section 11.4): within W = 10 wild fights, the seven trainers alone give at most 1.3 times the need', () => {
  const band = xpBand(R, 'anatolika');
  same(band.trainerIds.slice().sort(), ANATOLIKA_TRAINERS.slice().sort(), 'the seven trainers of route 5, route 6 and Σπάτα (the boss does not count)');
  assert.equal(band.top, 26);
  assert.equal(band.need, 17235, '3 x (xpForLevel(26) - xpForLevel(20))');
  assert.ok(band.wildFights <= 10, 'wild fights still needed: ' + band.wildFights);
  assert.ok(band.trainerShare <= 1.3 && band.trainerShare < 1, 'trainers give ' + band.trainerShare.toFixed(2) + ' of the need');
  assert.ok(band.trainerXp > 0 && band.wildXp > 0);
  assert.ok(R.TRAINERS.faia.boss && !band.trainerIds.includes('faia'), 'the boss comes after the climb');
});
test('Ανατολικά: the road from Γλυφάδα is shut without the Coast Medal; every new map is reachable, has its way back and no dead end', () => {
  const start = R.START_MAP;
  const gate = R.MAPS.glyfada.warps.find((warp) => warp.x === 27 && warp.y === 7);
  assert.ok(gate && gate.to === 'route5' && gate.needFlag === 'badge_notia' && R.STRINGS[gate.lockedText], 'the gate at the east end of the street needs the flag badge_notia and says why');
  assert.ok(!R.tileDef(R.MAPS.glyfada, 26, 7).solid && !R.tileDef(R.MAPS.glyfada, 27, 7).solid && !R.MAPS.glyfada.signs['26,7'], 'the sign of the old roadworks is gone and the street walks on to the edge');
  assert.ok(R.tileDef(R.MAPS.glyfada, 27, 6).solid && R.MAPS.glyfada.signs['27,6'] === 'sign.glyfada.east' && R.STRINGS['sign.glyfada.east'], 'the sign stands beside the gate');
  const without = R.reachableTiles(start.map, start.x, start.y, NOTIA_FLAGS);
  for (const id of ANATOLIKA_MAP_IDS) assert.ok(![...without].some((key) => key.startsWith(id + ':')), id + ' is not reachable without the Coast Medal');
  const shutOnGlyfada = R.reachableTiles('glyfada', 1, 7, NOTIA_FLAGS); // standing in Γλυφάδα with the badge flag missing (a damaged save)
  assert.ok(shutOnGlyfada.has('glyfada:26:7') && !shutOnGlyfada.has('glyfada:27:7') && !shutOnGlyfada.has('route5:1:13'), 'the gate tile is shut without the badge flag');
  const all = R.reachableTiles(start.map, start.x, start.y, ANATOLIKA_FLAGS);
  for (const key of ['glyfada:27:7', 'route5:1:13', 'route5:34:4', 'koropi:1:9', 'koropi:24:9', 'route6:1:8', 'route6:38:8', 'spata:1:9']) assert.ok(all.has(key), key + ' is reachable through the gate and along both routes');
  for (const id of ANATOLIKA_MAP_IDS) {
    const map = R.MAPS[id];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (/_(hospital|shop)$/.test(id) && y === 1) continue; // behind the counter, as in the templates of New Piraeus
      if (id === 'spata' && x === 27 && y === 9) continue; // the gate tile to Βόρεια (MZ-WORLD-02d): shut without the flag badge_anatolika
      if (!R.tileDef(map, x, y).solid && !R.npcAtTile(map, x, y, ANATOLIKA_FLAGS)) assert.ok(all.has(id + ':' + x + ':' + y), id + ' walkable tile ' + x + ',' + y + ' is cut off');
    }
    for (const warp of map.warps) {
      assert.ok(R.MAPS[warp.to].warps.some((back) => back.to === id), id + ' -> ' + warp.to + ' has a return warp');
      if (warp.needFlag === 'badge_anatolika') continue; // the gate to Βόρεια: tested by the Βόρεια tests
      assert.ok(R.tileWalkable(R.MAPS[warp.to], warp.tx, warp.ty, ANATOLIKA_FLAGS), id + ' -> ' + warp.to + ' arrives on a walkable tile');
      assert.ok(all.has(id + ':' + warp.x + ':' + warp.y), id + ' warp ' + warp.x + ',' + warp.y + ' is reachable');
    }
    for (const npc of map.npcs) assert.ok(R.npcTalkable(id, npc, all), id + ':' + npc.id + ' can be talked to');
    for (const key of Object.keys(map.signs)) {
      const [sx, sy] = key.split(',').map(Number);
      assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => all.has(id + ':' + (sx + dx) + ':' + (sy + dy))), id + ' sign ' + key + ' can be read');
      assert.ok(R.tileDef(map, sx, sy).solid, id + ' sign ' + key + ' stands on a solid tile');
    }
  }
  // no dead end: from the arrival tile of each new map the player reaches exactly what is reachable from the start
  for (const [mapId, x, y] of [['route5', 1, 13], ['koropi', 1, 9], ['route6', 1, 8], ['spata', 1, 9], ['spata_boss', 6, 8], ['koropi_cafe', 4, 6]]) {
    assert.equal(R.reachableTiles(mapId, x, y, ANATOLIKA_FLAGS).size, all.size, 'from ' + mapId + ' everything can be reached again');
  }
  // the boss can be talked to across the counter; the east end of Σπάτα is the gate to Βόρεια (MZ-WORLD-02d) with its sign beside it
  assert.ok(R.npcTalkable('spata_boss', R.MAPS.spata_boss.npcs.find((npc) => npc.id === 'faia'), all));
  assert.equal(R.MAPS.spata.signs['27,8'], 'sign.spata.north');
  assert.ok(R.MAPS.spata.warps.some((warp) => warp.x === 27 && warp.y === 9 && warp.to === 'route7' && warp.needFlag === 'badge_anatolika'), 'the gate to Βόρεια');
});
test('Ανατολικά data: sizes of 11.7, places on the world map, rows, tiles, wild tables with the species of 11.3.3, two towns with hospital, kiosk and ΚΤΕΛ stop, the café of Κορωπί, the terminal', () => {
  const sizes = { route5: [36, 16], koropi: [26, 16], koropi_hospital: [12, 9], koropi_shop: [8, 6], koropi_cafe: [10, 8], route6: [40, 16], spata: [28, 18], spata_hospital: [12, 9], spata_shop: [8, 6], spata_boss: [14, 10] };
  for (const id of ANATOLIKA_MAP_IDS) {
    const map = R.MAPS[id];
    same([map.w, map.h], sizes[id], id + ' size');
    assert.equal(map.rows.length, map.h);
    for (const row of map.rows) { assert.equal(row.length, map.w, id + ' width'); for (const char of row) assert.ok(R.TILE_DEFS[char], id + ' tile ' + char); }
    assert.ok(R.mapNode(id) && R.mapNode(id).district === 'anatolika', id + ' belongs to a place of Ανατολικά');
    assert.ok(R.STRINGS[map.name], id + ' name');
  }
  assert.equal(ANATOLIKA_MAP_IDS.reduce((sum, id) => sum + R.MAPS[id].w * R.MAPS[id].h, 0), 36 * 16 + 26 * 16 + 12 * 9 * 2 + 8 * 6 * 2 + 10 * 8 + 40 * 16 + 28 * 18 + 14 * 10, 'the tiles of the build plan (2,668)');
  same([W.districts.anatolika.built, W.nodes.koropi.built, W.nodes.spata.built, W.routes.route5.built, W.routes.route6.built, W.nodes.koropi.stop, W.nodes.spata.stop], [true, true, true, true, true, true, true]);
  same([R.mapNode('koropi_cafe').id, R.mapNode('spata_boss').id, R.mapNode('route5').id, R.mapNode('route6').id], ['koropi', 'spata', 'route5', 'route6']);
  // wild tables: the species of 11.3.3 at the levels of 11.3.3 (R5 19-22, R6 22-26); a creature appears in the form that fits its level
  const allowed = { route5: ['efoplistakos', 'eforaki', 'monastiriaki', 'storoula', 'trolosavros'], route6: ['influenza', 'kryptomakis', 'monimos', 'nftarchis'] };
  const range = { route5: [19, 22], route6: [22, 26] };
  for (const mapId of ['route5', 'route6']) {
    const used = new Set();
    for (const zone of R.MAPS[mapId].zones) for (const entry of zone.table) {
      used.add(entry.sp);
      assert.ok(entry.min >= range[mapId][0] && entry.max <= range[mapId][1] && entry.min <= entry.max, mapId + ' ' + entry.sp + ' levels');
      for (const species of Object.values(R.SPECIES)) if (species.evo && species.evo.to === entry.sp) assert.ok(entry.min >= species.evo.lv, entry.sp + ' appears only from its evolution level');
      if (R.SPECIES[entry.sp].evo) assert.ok(entry.max < R.SPECIES[entry.sp].evo.lv, entry.sp + ' is wild only below its evolution level (the evolved form takes over)');
    }
    same([...used].sort(), allowed[mapId].slice().sort(), mapId + ' species');
  }
  for (const zone of R.MAPS.route5.zones) assert.equal(zone.table.reduce((a, b) => (a.w <= b.w ? a : b)).sp, 'monastiriaki', 'Μοναστηριάκι is the rare one on route 5 (11.3.3)');
  const nft = R.MAPS.route6.zones.flatMap((zone) => zone.table).filter((entry) => entry.sp === 'nftarchis');
  assert.ok(nft.length === 1 && nft[0].min === 26 && nft[0].max === 26 && nft[0].w === Math.min(...R.MAPS.route6.zones[1].table.map((entry) => entry.w)), 'NFT-άρχης is the rare level-26 one on route 6');
  same(R.districtSpecies('anatolika').sort(), ANATOLIKA_SPECIES);
  assert.equal(Math.min(...R.MAPS.route5.zones.flatMap((zone) => zone.table.map((entry) => entry.min))), 19);
  assert.equal(Math.max(...R.MAPS.route6.zones.flatMap((zone) => zone.table.map((entry) => entry.max))), 26);
  // each town: a hospital that heals (return point), a kiosk with the stock of Νότια (no new item), a ΚΤΕΛ stop tile; Κορωπί the first Καφενείο, Σπάτα the terminal
  for (const [town, buildings] of [['koropi', ['koropi_hospital', 'koropi_shop', 'koropi_cafe']], ['spata', ['spata_hospital', 'spata_shop', 'spata_boss']]]) {
    assert.ok(R.MAPS[town].rows.join('').includes('U'), town + ' has its ΚΤΕΛ stop');
    assert.ok(R.MAPS[town].warps.filter((warp) => buildings.includes(warp.to)).length === 3, town + ' has the three doors');
    const hospital = R.MAPS[town + '_hospital'];
    assert.ok(hospital.npcs.some((npc) => npc.kind === 'heal') && hospital.actions['1,3'] === 'archive' && !R.tileDef(hospital, R.HOSPITAL_SPOT.x, R.HOSPITAL_SPOT.y).solid, town + ' hospital heals and has the archive terminal');
    assert.ok(R.MAPS[town + '_shop'].npcs.some((npc) => npc.kind === 'shop'));
    same(R.shopStockOf(R.MAPS[town + '_shop']), R.SHOP_STOCK_NOTIA, town + ' kiosk sells the stock of Νότια');
  }
  assert.ok(R.MAPS.koropi_cafe.npcs.some((npc) => npc.kind === 'save') && R.STRINGS[R.MAPS.koropi_cafe.cafeHello], 'the first Καφενείο of Ανατολικά saves, with its own greeting');
  assert.ok(!R.MAPS.spata_boss.npcs.some((npc) => npc.kind === 'save'), 'only the first town has the café');
  assert.ok(R.MAPS.spata_boss.npcs.some((npc) => npc.kind === 'boss' && npc.trainer === 'faia'));
  // the sprites and walking rules of the new tiles; the decor is a pass, a plain, a bridge and an airport: no cross and no religious icon is drawn
  const decor = ['R', 'v', 'I', 'J', 'O', 'z', '7', 'x', '8', '9', '0'];
  for (const char of decor) assert.ok(R.TILE_DEFS[char] && html.includes("make('" + char + "'"), 'a sprite for tile ' + char);
  for (const char of ['R', 'v', 'I', 'J', 'O', '7', 'x', '9', '0']) assert.equal(R.TILE_DEFS[char].solid, true, char + ' is solid');
  for (const char of ['z', '8']) assert.equal(R.TILE_DEFS[char].solid, false, char + ' is walkable');
  const bridgeColumn = (x) => [6, 7, 8, 9].map((y) => R.MAPS.route6.rows[y][x]).join('');
  for (const x of [17, 18, 19]) assert.equal(bridgeColumn(x), 'OzzO', 'the highway bridge crosses the road at x ' + x + ': the road runs under it');
  assert.ok(R.MAPS.route5.rows.join('').split('.').length > 150 && R.MAPS.route5.rows.join('').includes('J'), 'route 5 is a road with switchbacks and a monastery wall');
  assert.ok(R.MAPS.spata.rows.join('').includes('x') && R.MAPS.spata.rows.join('').includes('8') && R.MAPS.spata.rows.join('').includes('9') && R.MAPS.spata.rows.join('').includes('0') && R.MAPS.spata.rows.join('').includes('o'), 'the airport: terminal front and door, tower, planes, apron');
  for (const id of ['koropi', 'spata']) for (const key of Object.keys(R.MAPS[id].signs)) assert.ok(R.STRINGS[R.MAPS[id].signs[key]]);
  for (const id of ['route5', 'route6']) for (const key of Object.keys(R.MAPS[id].signs)) assert.ok(R.STRINGS[R.MAPS[id].signs[key]]);
});
test('Ανατολικά species: the five new creatures have stats, moves, abilities, dossier texts, sprites and the evolutions of 11.3 are consistent', () => {
  const lines = [['dimosio', 'monimos', 20], ['storoula', 'influenza', 22], ['kryptomakis', 'nftarchis', 26]];
  for (const [fromId, toId, level] of lines) {
    const from = R.SPECIES[fromId];
    const to = R.SPECIES[toId];
    same(from.evo, { to: toId, lv: level }, fromId + ' evolves at ' + level + ' (11.3)');
    assert.equal(to.t, from.t, toId + ' keeps the type');
    assert.equal(to.ab, from.ab, toId + ' keeps the ability');
    assert.ok(to.base.reduce((a, b) => a + b, 0) > from.base.reduce((a, b) => a + b, 0), toId + ' is stronger than ' + fromId);
    assert.ok(!to.evo, toId + ' has no later form in this roster');
    assert.equal(R.evolutionFor(R.makeMon(fromId, level - 1)), null);
    assert.equal(R.evolutionFor(R.makeMon(fromId, level)), toId);
    const mon = R.makeMon(fromId, level);
    const before = R.maxHp(mon);
    mon.hp = 5;
    assert.ok(R.evolveMon(mon) && mon.sp === toId && mon.hp === 5 + R.maxHp(mon) - before, 'evolving keeps the damage taken');
  }
  same(R.SPECIES.monastiriaki.evo, { to: 'ktimatomesitis', lv: 36 }, 'Μοναστηριάκι evolves into the Κτηματομεσίτης (MZ-WORLD-02e; 36, not the 32 of 11.3, see 11.15)');
  for (const id of ANATOLIKA_NEW_SPECIES) {
    const species = R.SPECIES[id];
    assert.ok(R.TYPE_IDS.includes(species.t) && R.ABILITY_IDS.includes(species.ab) && ['m', 'f', 'n'].includes(species.g), id + ' type, ability, gender');
    assert.ok(species.rec > 0 && species.xp > 0 && species.base.length === 6 && species.base.reduce((a, b) => a + b, 0) > 250, id + ' stats');
    assert.ok(species.learn.every(([lv, moveId]) => R.MOVES[moveId] && lv >= 1) && R.movesAtLevel(id, 26).length === 4, id + ' moves');
    assert.ok(R.DEX_ORDER.includes(id) && R.STRINGS['sp.' + id][0].startsWith('Γνωστ') && R.STRINGS['sp.' + id][0].includes('Ποτέ δεν καταδικάστηκε') && R.STRINGS['sp.' + id][1].includes('Never convicted'), id + ' dossier text');
    assert.ok(new RegExp('^ {2}' + id + ': function \\(p\\)', 'm').test(html), id + ' has a procedural sprite');
  }
  // a creature of an old save that is level 20 or more evolves after its next battle: the evolution is data, so the old save needs nothing
  const dimosio = R.makeMon('dimosio', 19);
  R.gainXp(dimosio, R.xpForLevel(20) - dimosio.xp);
  assert.equal(dimosio.lv, 20);
  assert.equal(R.evolutionFor(dimosio), 'monimos');
  // the trainers and the boss show the form that fits the level
  for (const id of ANATOLIKA_TRAINERS.concat(['faia'])) for (const entry of R.TRAINERS[id].team) {
    const species = R.SPECIES[entry.sp];
    if (species.evo) assert.ok(entry.lv < species.evo.lv, id + ': ' + entry.sp + ' at ' + entry.lv + ' would have evolved');
    for (const other of Object.values(R.SPECIES)) if (other.evo && other.evo.to === entry.sp) assert.ok(entry.lv >= other.evo.lv, id + ': ' + entry.sp + ' at ' + entry.lv + ' is below its evolution level');
  }
});
test('Ανατολικά trainers: seven trainers with names in the strings, levels 20-25, a seeded 1,000-battle replay twice gives equal checksums, the fights are winnable at the intended levels', () => {
  assert.equal(ANATOLIKA_TRAINERS.length, 7);
  const onMaps = {};
  for (const id of ['route5', 'route6', 'spata']) for (const npc of R.MAPS[id].npcs) if (npc.kind === 'trainer') onMaps[npc.trainer] = id;
  same(onMaps, { pilgrim: 'route5', customs: 'route5', tourist: 'route5', vineyard: 'route6', cryptoseller: 'route6', spotter: 'route6', checkin: 'spata' }, 'three on route 5, three on route 6, one at the Σπάτα check-in');
  for (const id of ANATOLIKA_TRAINERS) {
    const trainer = R.TRAINERS[id];
    assert.ok(trainer.team.length >= 2 && trainer.team.length <= 3 && !trainer.boss && trainer.boost === undefined, id + ' team');
    for (const entry of trainer.team) assert.ok(entry.lv >= 20 && entry.lv <= 25, id + ' level ' + entry.lv);
    for (const part of ['intro', 'win', 'after']) assert.ok(R.STRINGS['tr.' + id + '.' + part], id + ' ' + part);
    const npc = Object.values(R.MAPS).flatMap((map) => map.npcs).find((entry) => entry.trainer === id);
    assert.ok(npc.sight >= 2 && npc.sight <= 3, id + ' sees ' + npc.sight + ' tiles');
  }
  const members = new Set(ANATOLIKA_TRAINERS.flatMap((id) => R.TRAINERS[id].team.map((entry) => entry.sp)));
  for (const species of ['monastiriaki', 'monimos', 'influenza', 'kryptomakis', 'eforaki', 'efoplistakos', 'kafenovios']) assert.ok(members.has(species), 'the trainers use ' + species);
  const replay = (seed) => {
    const rng = R.makeRng(seed);
    const lines = [];
    const ids = ANATOLIKA_TRAINERS.concat(['faia']);
    for (let i = 0; i < 125; i++) {
      for (const id of ids) {
        const team = anatolikaTeam(R, rng, 25, 3);
        const result = R.simulateBattle(team, R.buildTrainerTeam(id, 'komma'), rng, { foeItems: R.TRAINERS[id].items });
        lines.push(id + result.winner + ':' + result.turns);
      }
    }
    assert.equal(lines.length, 1000);
    return R.hashString(lines.join('|'));
  };
  assert.equal(replay(41), replay(41));
  assert.notEqual(replay(41), replay(42));
  const winRate = (trainerId, level, size, runsCount) => {
    const rng = R.makeRng(2900 + level + size);
    let wins = 0;
    for (let i = 0; i < runsCount; i++) wins += R.simulateBattle(anatolikaTeam(R, rng, level, size), R.buildTrainerTeam(trainerId, 'komma'), rng, { playerItems: [] }).winner === 0 ? 1 : 0;
    return wins / runsCount;
  };
  // a full team of level 25 (the level of the last trainers) wins every trainer fight almost always; three creatures still win more often than not
  for (const id of ANATOLIKA_TRAINERS) {
    assert.ok(winRate(id, 25, 6, 100) >= 0.9, id + ' with six creatures at level 25');
    assert.ok(winRate(id, 25, 3, 100) >= 0.5, id + ' with three creatures at level 25');
  }
});
test('Ανατολικά boss: the win-rate bands of 11.7 (the same offsets and bands as the other bosses) with the AI-played player team, and the boss data', () => {
  const boss = R.TRAINERS.faia;
  same(boss.team.map((entry) => entry.sp + entry.lv), ['kryptomakis23', 'influenza24', 'monimos24', 'trolosavros25', 'nftarchis26'], 'the boss team of 11.13');
  assert.equal(boss.boss, true); assert.equal(boss.bonus, 200);
  assert.equal(boss.look, 'faia');
  assert.equal(R.WORLD.districts.anatolika.bossTrainer, 'faia');
  assert.equal(R.WORLD.districts.anatolika.badgeFlag, 'badge_anatolika');
  assert.equal(boss.victory.flag, 'badge_anatolika');
  for (const key of ['win2', 'title', 'sub', 'win3']) assert.ok(R.STRINGS[boss.victory[key]], 'victory text ' + key);
  assert.equal(boss.victory.chapterCard, undefined, 'only the first boss ends a chapter');
  assert.equal(R.STRINGS['badge.anatolika.title'][0], 'ΠΑΡΑΣΗΜΟ ΕΠΙΒΙΒΑΣΗΣ');
  assert.ok(R.STRINGS['tr.faia.intro'][0].includes('{ακόλουθε|ακόλουθη}'), 'the player is addressed with the gender choice');
  assert.ok(R.STRINGS['boss.faia.win3'][0].includes('Επιβίβασης') && R.STRINGS['boss.faia.win3'][1].includes('Boarding Medal'));
  // the money: 26 x 30 + 200 for the boss
  const prize = R.prizeFor({ sides: [{ party: [], active: 0 }, { party: R.buildTrainerTeam('faia', 'komma') }] }, boss);
  assert.equal(prize, 26 * 30 + 200);
  // no hidden stat boost (11.13): her team holds the bands by its stats, so the only boosted boss is still Μπουγάτσας, whose boost is told in his greeting
  assert.equal(boss.boost, undefined, 'the boss has no boost');
  for (const id of Object.keys(R.TRAINERS)) if (id !== 'bougatsas') assert.equal(R.TRAINERS[id].boost, undefined, id + ' has no boost');
  same(boss.items, ['gemista'], 'she carries one Γεμιστά (a full heal that clears a status)');
  // the bands
  const top = boss.team.reduce((best, entry) => Math.max(best, entry.lv), 0);
  const twoSouvlaki = ['souvlaki', 'souvlaki'];
  const bands = [];
  for (const [label, offset, size, items, low, high] of bossBands(R, 'faia')) bands.push([label, bossWinRate(R, 'faia', top + offset, size, items === 2 ? twoSouvlaki : [], BOSS_RUNS_PER_CELL, 5000), low, high]);
  for (const [label, rate, low, high] of bands) assert.ok(rate >= low && rate <= high, 'Φαίη, ' + label + ': ' + rate + ' outside ' + low + '-' + high);
});
test('Ανατολικά: old saves (v2 and v3, standing anywhere in Πειραιάς or Νότια) load and continue; the new flag and the new places migrate; old creatures evolve at their level', () => {
  const party = [{ sp: 'dimosio', lv: 21, xp: R.xpForLevel(21), hp: 40 }, { sp: 'storoula', lv: 23, xp: R.xpForLevel(23), hp: 30 }, { sp: 'komma', lv: 17, xp: R.xpForLevel(17), hp: 40 }];
  const make = (version, map, x, y, flags, extra) => Object.assign({ version, player: { name: 'ΝΙΚΟΣ', gender: 'm', map, x, y, dir: 'left' }, party, archive: [], money: 555, bag: { fakelaki: 3, dikigoros: 1 },
    dex: { seen: { komma: true }, got: { komma: true } }, flags, lastHeal: { map: 'glyfada_hospital', x: 5, y: 7, dir: 'up' }, options: { lang: 'el', sound: true, textSpeed: 1, reduceMotion: false }, rngState: 99, starter: 'komma' }, extra || {});
  const sampleOf = (rows, mapId) => {
    const found = [];
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === '1' && R.tileWalkable(R.MAPS[mapId], x, y, ANATOLIKA_FLAGS)) found.push([x, y]);
    return found;
  };
  let count = 0;
  for (const id of OLD_MAP_IDS) for (const [x, y] of sampleOf(OLD_WALKABLE[id].split('/'), id)) {
    for (const version of [2, 3]) {
      const loaded = R.migrateSave(make(version, id, x, y, ANATOLIKA_FLAGS));
      assert.ok(loaded.player.map === id && loaded.player.x === x && loaded.player.y === y, version + ' ' + id + ' ' + x + ',' + y + ' loads where it stood');
      count++;
    }
  }
  for (const table of [OLD_WALKABLE_02A, OLD_WALKABLE_02B]) for (const id of Object.keys(table)) for (const [x, y] of sampleOf(table[id].split('/'), id)) {
    const loaded = R.migrateSave(make(3, id, x, y, ANATOLIKA_FLAGS));
    assert.ok(loaded.player.map === id && loaded.player.x === x && loaded.player.y === y, id + ' ' + x + ',' + y + ' loads where it stood');
    count++;
  }
  assert.ok(count > 2500, 'a lot of positions were loaded: ' + count);
  // the creatures of an old save: Δημοσιοϋπαλληλάκι L21 and Story-ούλα L23 are evolvable (the game offers it after the next battle), nothing is lost
  const old = R.migrateSave(make(2, 'glyfada', 12, 7, Object.assign({ badge_notia: true }, NOTIA_FLAGS)));
  assert.equal(old.party[0].sp, 'dimosio'); assert.equal(old.party[1].lv, 23);
  assert.equal(R.evolutionFor(R.restoreMon(old.party[0])), 'monimos'); assert.equal(R.evolutionFor(R.restoreMon(old.party[1])), 'influenza');
  assert.equal(old.money, 555); assert.equal(old.bag.dikigoros, 1); assert.equal(old.bag.gemista, 0);
  assert.equal(R.placeState(old.world, 'koropi'), 'hidden', 'Κορωπί is told about only when route 5 is walked');
  assert.equal(R.districtState(old.world, 'anatolika'), 'open', 'the Coast Medal opens the district');
  // a new save: Ανατολικά places, the new badge flag
  const world = R.newWorldState();
  R.worldVisit(world, 'route5', ANATOLIKA_FLAGS);
  assert.equal(world.routes.route5, 1); assert.equal(R.placeState(world, 'koropi'), 'seen');
  R.worldVisit(world, 'koropi_cafe', ANATOLIKA_FLAGS);
  R.worldVisit(world, 'route6', ANATOLIKA_FLAGS);
  assert.equal(R.placeState(world, 'spata'), 'seen');
  R.worldVisit(world, 'spata_boss', Object.assign({ badge_anatolika: true }, ANATOLIKA_FLAGS));
  assert.equal(R.placeState(world, 'koropi'), 'visited'); assert.equal(R.placeState(world, 'spata'), 'visited');
  assert.equal(world.badges.anatolika, 1, 'the flag badge_anatolika fills the badge');
  assert.equal(R.districtState(world, 'anatolika'), 'cleared');
  assert.equal(R.districtState(world, 'voreia'), 'open', 'the Boarding Medal opens Βόρεια');
  assert.equal(R.districtState(world, 'dytika'), 'locked', 'the next district is not built');
  const stored = R.migrateSave(make(3, 'spata_hospital', 5, 7, Object.assign({ badge_anatolika: true, t_faia: true }, ANATOLIKA_FLAGS), { world, lastHeal: { map: 'spata_hospital', x: 5, y: 7, dir: 'up' } }));
  same(stored.lastHeal, { map: 'spata_hospital', x: 5, y: 7, dir: 'up' }, 'the Σπάτα hospital is a valid return point');
  assert.equal(stored.player.map, 'spata_hospital');
  assert.equal(stored.flags.badge_anatolika, true);
  assert.equal(stored.world.routes.route6, 1);
  same(R.migrateSave(JSON.parse(JSON.stringify(stored))), stored, 'a second load changes nothing');
  const flagOnly = R.migrateSave(make(2, 'glyfada', 12, 7, Object.assign({ badge_anatolika: true }, ANATOLIKA_FLAGS)));
  assert.equal(flagOnly.world.badges.anatolika, 1);
  // a save from this build stands on an Ανατολικά tile that an older build does not know: it falls back to the start, as for every unknown place
  assert.equal(R.migrateSave(make(3, 'atlantis', 3, 3, ANATOLIKA_FLAGS)).player.map, 'lab');
});
test('Ανατολικά leaves Νότια as it was: only the east end of the Γλυφάδα street changes (26,7 walks on, 27,7 is the gate); every old walkable tile is still walkable', () => {
  for (const id of Object.keys(OLD_WALKABLE_02B)) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE_02B[id].split('/');
    assert.equal(map.h, rows.length, id + ' height'); assert.equal(map.w, rows[0].length, id + ' width');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (rows[y][x] === '1') assert.ok(!R.tileDef(map, x, y).solid, id + ' ' + x + ',' + y + ' was walkable and still must be');
  }
  const nowWalkable = [];
  for (const id of Object.keys(OLD_WALKABLE_02B)) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE_02B[id].split('/');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (rows[y][x] === '0' && !R.tileDef(map, x, y).solid) nowWalkable.push(id + ':' + x + ',' + y);
  }
  same(nowWalkable, ['glyfada:26,7', 'glyfada:27,7']);
  assert.equal(R.districtState(R.newWorldState(), 'notia'), 'locked');
});
test('Ανατολικά boss path: the victory data of the boss sets only the flag of its own badge; the other flags and the credits flag are not touched', () => {
  const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));
  const victory = part('OverworldLayer.prototype.bossVictory', 'OverworldLayer.prototype.runEvent');
  assert.ok(victory.includes('TRAINERS[trainerId].victory') && victory.includes('G.flags[victory.flag] = true') && !/G\.flags\.(badge|badge_notia|badge_anatolika)\b/.test(victory));
  same(R.TRAINERS.faia.victory, { flag: 'badge_anatolika', win2: 'boss.faia.win2', title: 'badge.anatolika.title', sub: 'badge.anatolika.sub', win3: 'boss.faia.win3', ribbon: '#a8449a' });
  assert.notEqual(R.TRAINERS.faia.victory.ribbon, R.TRAINERS.bougatsas.victory.ribbon, 'each badge has its own ribbon colour');
  assert.notEqual(R.STRINGS['badge.anatolika.title'][0], R.STRINGS['badge.notia.title'][0]);
  assert.ok(!R.STRINGS['boss.bougatsas.win3'][0].includes('υπό έργα'), 'the Coast Medal text no longer says the road to the East is shut');
  assert.ok(!R.STRINGS['boss.faia.win3'][0].includes('υπό έργα'), 'the Boarding Medal text no longer says the road to the North is shut');
});
test('Ανατολικά: no per-frame work in the new content (the tiles and creature sprites are drawn once into canvases; the texts are cached strings; no new draw code)', () => {
  const tileBuilder = html.slice(html.indexOf('function buildTileSprites()'), html.indexOf('buildHospitalTiles(make);'));
  for (const char of ['R', 'v', 'I', 'J', 'O', 'z', '7', 'x', '8', '9', '0']) assert.ok(tileBuilder.includes("make('" + char + "'"), 'the sprite of tile ' + char + ' is built once in buildTileSprites');
  const cache = html.slice(html.indexOf('function creatureSprite('), html.indexOf('function buildAllSprites()'));
  assert.ok(cache.includes('if (creatureSprites[speciesId]) return creatureSprites[speciesId];'), 'creature sprites are cached after the first draw');
  for (const id of ANATOLIKA_NEW_SPECIES) assert.ok(new RegExp('^ {2}' + id + ': function \\(p\\) \\{', 'm').test(html.slice(html.indexOf('const creatureDrawers = {'), html.indexOf('const creatureSprites = {}'))), id + ' is drawn by a creatureDrawers entry (run once)');
  const overworldDraw = html.slice(html.indexOf('OverworldLayer.prototype.draw = function'), html.indexOf('OverworldLayer.prototype.drawNpc'));
  assert.ok(!/(koropi|spata|route5|route6|anatolika|faia)/i.test(overworldDraw), 'the overworld draw code has no Ανατολικά special case');
});
test('Ανατολικά: type fairness named: every type of the boss is hit for x2 by a starter or a wild creature that is available before her', () => {
  const types = new Set(R.TRAINERS.faia.team.map((entry) => R.SPECIES[entry.sp].t));
  assert.ok(types.has('inf') && types.has('mem'), 'the boss brings Influencers and Μιμίδια');
  assert.ok(R.typeMultiplier('asf', 'inf') === 2 && R.districtSpecies('peiraias').includes('eforaki') && R.STARTERS.includes('koulourak'), 'Εφοράκι (wild in Πειραιάς) and Κουλουράκι (starter) hit Influencers and Μιμίδια for x2');
  for (const type of types) assert.ok([...R.STARTERS, ...R.districtSpecies('peiraias'), ...R.districtSpecies('notia')].some((id) => R.typeMultiplier(R.SPECIES[id].t, type) === 2), 'a starter or a creature of the first two districts hits ' + type);
});

// ---- MZ-WORLD-02d: the district Βόρεια ----
const VOREIA_MAP_IDS = ['route7', 'kifisia', 'kifisia_hospital', 'kifisia_shop', 'kifisia_cafe', 'route8', 'marousi', 'marousi_hospital', 'marousi_shop', 'marousi_boss'];
const BOSS_TEAM_02D = ['rialito29', 'influenza30', 'fakelarchis32', 'lobbylykaina32', 'star9032'];
const BOSS_BOOST_02D = undefined; // no boost (11.14)
const BOSS_ITEMS_02D = ['gemista'];
const VOREIA_FLAGS = Object.assign({ badge_anatolika: true }, ANATOLIKA_FLAGS);
const VOREIA_TRAINERS = ['oldstar', 'gardener', 'contestant', 'lobbyist', 'tennis', 'rival4', 'usher'];
const VOREIA_SPECIES = ['efoplistakos', 'fakelarchis', 'giotarchis', 'influenza', 'lobbylykaina', 'nftarchis', 'rialito', 'star90', 'trolosavros'];
const VOREIA_NEW_SPECIES = ['star90', 'rialito', 'lobbylykaina', 'giotarchis', 'yperypourgos', 'matanthropos', 'despotakis'];
const FINAL_FORMS = { vouleftakos: 'yperypourgos', batsonos: 'matanthropos', diakosdisko: 'despotakis' };
// the walkable tiles (1) and solid tiles (0) of the ten maps of Ανατολικά, taken from the base build 75a5b1c (MZ-WORLD-02c)
const OLD_WALKABLE_02C = {
  route5: '000000000000000000000000000000000000/000000000000000000000000000000000000/000000000000000000000000000000000000/011111111111111111111111111111111111/011111111111111111111111111111111111/011101111111011111111111011111111010/011111111111111111111101111111111010/011011111101111111111111111111111110/011111111111111111111111111111100000/011111111111111111111111111111100000/011111111111111111111111111111100000/011101110111111111110111101111100000/010111111111111011111111111111000000/111111111111111111111111111111100000/111111111111111111111111111111111110/000000000000000000000000000000000000',
  koropi: '00000000000000000000000000/01111111111111111111111110/01000001100001100000100000/01000001100001100000100000/01000001100001100000100000/01001000101000100100000000/01111111111111111111111110/00111111101101101111110100/01111101111111111111111110/11111111111111111111111111/01111111111111111111111110/01000000001111100000000010/01000000001111100000000010/01000000001111100000000010/01111111111111111111111110/00000000000000000000000000',
  koropi_hospital: '000000000000/011111111110/000000000000/001110111100/011111111110/001111111100/001101101100/011111111110/000001100000',
  koropi_shop: '00000000/00011000/00000000/01111110/01111110/00011000',
  koropi_cafe: '0000000000/0001111100/0000001110/0111111110/0111111110/0100110010/0111111110/0000110000',
  route6: '0000000000000000000000000000000000000000/0111111111111111100011111111111111111110/0110000001100000100011100000011000000110/0110000001000000100011100000011000000110/0010000001100000100011100000011000000100/0111111111111111100011111111111111111110/0101111111111111100011111111111111111110/1111111111111111111111111111111111111111/1111111111111111111111111111111111111111/0111111111111111100011111111111111111010/0111111111111111100011111111111111111110/0011111111111111100011111111111111111100/0110000001100000100011100000001000000110/0110000001100000100011100000000000000110/0111111111111111100011111111111111111110/0000000000000000000000000000000000000000',
  spata: '0000000000000000000000000000/0111111111111111111111111110/0100000110000100000000000010/0100000110000100000000000000/0100000110000100000000000010/0100100010100000000100000010/0111111111111111101111111110/0011111111111111111111110110/0111101101111111111111111110/1111111111111111111111111100/0000000001110000000000000000/0111111111111111111111111110/0111111111111111111110111110/0111101111111111111111111110/0111111111111011111111111110/0111111111111111111111111110/0000000000000000000000000000/0000000000000000000000000000',
  spata_hospital: '000000000000/011111111110/000000000000/001110111100/011111111110/001111111100/001101101100/011111111110/000001100000',
  spata_shop: '00000000/00011000/00000000/01111110/01111110/00011000',
  spata_boss: '00000000000000/00011111111000/01111111111110/01110000001110/01111111111110/01111111111110/01111111111110/01001111110010/01111111111110/00000011000000',
};

test('Βόρεια XP band (section 11.4): within W = 10 wild fights, the seven trainers alone give at most 1.3 times the need', () => {
  const band = xpBand(R, 'voreia');
  same(band.trainerIds.slice().sort(), VOREIA_TRAINERS.slice().sort(), 'the seven trainers of route 7, route 8 and Μαρούσι (the boss does not count)');
  assert.equal(band.top, 32);
  assert.equal(band.need, 27345, '3 x (xpForLevel(32) - xpForLevel(26))');
  assert.ok(band.wildFights <= 10, 'wild fights still needed: ' + band.wildFights);
  assert.ok(band.trainerShare <= 1.3 && band.trainerShare < 1, 'trainers give ' + band.trainerShare.toFixed(2) + ' of the need');
  assert.ok(band.trainerXp > 0 && band.wildXp > 0);
  assert.ok(R.TRAINERS.amartia.boss && !band.trainerIds.includes('amartia'), 'the boss comes after the climb');
});
test('Βόρεια: the road from Σπάτα is shut without the Boarding Medal; every new map is reachable, has its way back and no dead end', () => {
  const start = R.START_MAP;
  const gate = R.MAPS.spata.warps.find((warp) => warp.x === 27 && warp.y === 9);
  assert.ok(gate && gate.to === 'route7' && gate.needFlag === 'badge_anatolika' && R.STRINGS[gate.lockedText], 'the gate at the east end of the street needs the flag badge_anatolika and says why');
  assert.ok(!R.tileDef(R.MAPS.spata, 26, 9).solid && !R.tileDef(R.MAPS.spata, 27, 9).solid && !R.MAPS.spata.signs['26,9'], 'the old sign is gone and the street walks on to the edge');
  assert.ok(R.tileDef(R.MAPS.spata, 27, 8).solid && R.MAPS.spata.signs['27,8'] === 'sign.spata.north' && R.STRINGS['sign.spata.north'], 'the sign stands beside the gate');
  const without = R.reachableTiles(start.map, start.x, start.y, ANATOLIKA_FLAGS);
  for (const id of VOREIA_MAP_IDS) assert.ok(![...without].some((key) => key.startsWith(id + ':')), id + ' is not reachable without the Boarding Medal');
  const shutOnSpata = R.reachableTiles('spata', 1, 9, ANATOLIKA_FLAGS); // standing in Σπάτα with the badge flag missing (a damaged save)
  assert.ok(shutOnSpata.has('spata:26:9') && !shutOnSpata.has('spata:27:9') && !shutOnSpata.has('route7:30:14'), 'the gate tile is shut without the badge flag');
  const all = R.reachableTiles(start.map, start.x, start.y, VOREIA_FLAGS);
  for (const key of ['spata:27:9', 'route7:30:14', 'route7:1:3', 'kifisia:24:9', 'kifisia:1:9', 'route8:42:6', 'route8:1:6', 'marousi:26:9']) assert.ok(all.has(key), key + ' is reachable through the gate and along both routes');
  for (const id of VOREIA_MAP_IDS) {
    const map = R.MAPS[id];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (/_(hospital|shop)$/.test(id) && y === 1) continue; // behind the counter, as in the templates of New Piraeus
      if (id === 'marousi' && x === 0 && y === 9) continue; // the gate tile to Δυτικά (MZ-WORLD-02e): shut without the flag badge_voreia
      if (!R.tileDef(map, x, y).solid && !R.npcAtTile(map, x, y, VOREIA_FLAGS)) assert.ok(all.has(id + ':' + x + ':' + y), id + ' walkable tile ' + x + ',' + y + ' is cut off');
    }
    for (const warp of map.warps) {
      assert.ok(R.MAPS[warp.to].warps.some((back) => back.to === id), id + ' -> ' + warp.to + ' has a return warp');
      if (warp.needFlag === 'badge_voreia') continue; // the gate to Δυτικά: tested by the Δυτικά tests
      assert.ok(R.tileWalkable(R.MAPS[warp.to], warp.tx, warp.ty, VOREIA_FLAGS), id + ' -> ' + warp.to + ' arrives on a walkable tile');
      assert.ok(all.has(id + ':' + warp.x + ':' + warp.y), id + ' warp ' + warp.x + ',' + warp.y + ' is reachable');
    }
    for (const npc of map.npcs) assert.ok(R.npcTalkable(id, npc, all), id + ':' + npc.id + ' can be talked to');
    for (const key of Object.keys(map.signs)) {
      const [sx, sy] = key.split(',').map(Number);
      assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => all.has(id + ':' + (sx + dx) + ':' + (sy + dy))), id + ' sign ' + key + ' can be read');
      assert.ok(R.tileDef(map, sx, sy).solid, id + ' sign ' + key + ' stands on a solid tile');
    }
  }
  // no dead end: from the arrival tile of each new map the player reaches exactly what is reachable from the start
  for (const [mapId, x, y] of [['route7', 30, 14], ['kifisia', 24, 9], ['route8', 42, 6], ['marousi', 26, 9], ['marousi_boss', 6, 8], ['kifisia_cafe', 4, 6]]) {
    assert.equal(R.reachableTiles(mapId, x, y, VOREIA_FLAGS).size, all.size, 'from ' + mapId + ' everything can be reached again');
  }
  // the boss can be talked to across the counter; the west end of Μαρούσι is the gate to Δυτικά (MZ-WORLD-02e) with its sign beside it
  assert.ok(R.npcTalkable('marousi_boss', R.MAPS.marousi_boss.npcs.find((npc) => npc.id === 'amartia'), all));
  assert.equal(R.MAPS.marousi.signs['0,8'], 'sign.marousi.west');
  assert.ok(R.MAPS.marousi.warps.some((warp) => warp.x === 0 && warp.y === 9 && warp.to === 'route9' && warp.needFlag === 'badge_voreia'), 'the gate to Δυτικά');
});
test('Βόρεια data: sizes of 11.7, places on the world map, rows, tiles, wild tables with the species of 11.3.4, two towns with hospital, kiosk and ΚΤΕΛ stop, the café of Κηφισιά, the arena', () => {
  const sizes = { route7: [32, 18], kifisia: [26, 18], kifisia_hospital: [12, 9], kifisia_shop: [8, 6], kifisia_cafe: [10, 8], route8: [44, 14], marousi: [28, 18], marousi_hospital: [12, 9], marousi_shop: [8, 6], marousi_boss: [14, 10] };
  for (const id of VOREIA_MAP_IDS) {
    const map = R.MAPS[id];
    same([map.w, map.h], sizes[id], id + ' size');
    assert.equal(map.rows.length, map.h);
    for (const row of map.rows) { assert.equal(row.length, map.w, id + ' width'); for (const char of row) assert.ok(R.TILE_DEFS[char], id + ' tile ' + char); }
    assert.ok(R.mapNode(id) && R.mapNode(id).district === 'voreia', id + ' belongs to a place of Βόρεια');
    assert.ok(R.STRINGS[map.name], id + ' name');
  }
  assert.equal(VOREIA_MAP_IDS.reduce((sum, id) => sum + R.MAPS[id].w * R.MAPS[id].h, 0), 32 * 18 + 26 * 18 + 12 * 9 * 2 + 8 * 6 * 2 + 10 * 8 + 44 * 14 + 28 * 18 + 14 * 10, 'the tiles of the build plan (2,696)');
  same([W.districts.voreia.built, W.nodes.kifisia.built, W.nodes.marousi.built, W.routes.route7.built, W.routes.route8.built, W.nodes.kifisia.stop, W.nodes.marousi.stop], [true, true, true, true, true, true, true]);
  same([R.mapNode('kifisia_cafe').id, R.mapNode('marousi_boss').id, R.mapNode('route7').id, R.mapNode('route8').id], ['kifisia', 'marousi', 'route7', 'route8']);
  // both routes run right to left (11.5): the marker of the first tile is near the first end
  assert.equal(W.routes.route7.progress, '-x'); assert.equal(W.routes.route8.progress, '-x');
  // wild tables: the species of 11.3.4 at the levels of 11.4 (R7 26-29, R8 29-31); a creature appears in the form that fits its level
  const allowed = { route7: ['efoplistakos', 'fakelarchis', 'influenza', 'nftarchis', 'rialito', 'star90', 'trolosavros'], route8: VOREIA_SPECIES };
  const range = { route7: [26, 29], route8: [29, 31] };
  for (const mapId of ['route7', 'route8']) {
    const used = new Set();
    for (const zone of R.MAPS[mapId].zones) for (const entry of zone.table) {
      used.add(entry.sp);
      assert.ok(entry.min >= range[mapId][0] && entry.max <= range[mapId][1] && entry.min <= entry.max, mapId + ' ' + entry.sp + ' levels');
      for (const species of Object.values(R.SPECIES)) if (species.evo && species.evo.to === entry.sp) assert.ok(entry.min >= species.evo.lv, entry.sp + ' appears only from its evolution level');
      if (R.SPECIES[entry.sp].evo) assert.ok(entry.max < R.SPECIES[entry.sp].evo.lv, entry.sp + ' is wild only below its evolution level (the evolved form takes over)');
    }
    same([...used].sort(), allowed[mapId].slice().sort(), mapId + ' species');
  }
  const lowest = (zone) => zone.table.reduce((a, b) => (a.w <= b.w ? a : b)).sp;
  assert.equal(lowest(R.MAPS.route7.zones[0]), 'rialito', 'Ριάλιτο-Νταής is the rare one on route 7 (from level 28, 11.3.4)');
  assert.equal(lowest(R.MAPS.route8.zones[1]), 'giotarchis', 'Γιοτάρχης is the rare one on route 8 (11.3.4)');
  same(R.districtSpecies('voreia').sort(), VOREIA_SPECIES);
  assert.equal(Math.min(...R.MAPS.route7.zones.flatMap((zone) => zone.table.map((entry) => entry.min))), 26);
  assert.equal(Math.max(...R.MAPS.route8.zones.flatMap((zone) => zone.table.map((entry) => entry.max))), 31);
  // each town: a hospital that heals (return point), a kiosk with the nine items (the Χοντρός Φάκελος is new), a ΚΤΕΛ stop tile; Κηφισιά the first Καφενείο, Μαρούσι the arena
  for (const [town, buildings] of [['kifisia', ['kifisia_hospital', 'kifisia_shop', 'kifisia_cafe']], ['marousi', ['marousi_hospital', 'marousi_shop', 'marousi_boss']]]) {
    assert.ok(R.MAPS[town].rows.join('').includes('U'), town + ' has its ΚΤΕΛ stop');
    assert.ok(R.MAPS[town].warps.filter((warp) => buildings.includes(warp.to)).length === 3, town + ' has the three doors');
    const hospital = R.MAPS[town + '_hospital'];
    assert.ok(hospital.npcs.some((npc) => npc.kind === 'heal') && hospital.actions['1,3'] === 'archive' && !R.tileDef(hospital, R.HOSPITAL_SPOT.x, R.HOSPITAL_SPOT.y).solid, town + ' hospital heals and has the archive terminal');
    assert.ok(R.MAPS[town + '_shop'].npcs.some((npc) => npc.kind === 'shop'));
    same(R.shopStockOf(R.MAPS[town + '_shop']), R.SHOP_STOCK_VOREIA, town + ' kiosk sells nine items');
  }
  assert.ok(R.MAPS.kifisia_cafe.npcs.some((npc) => npc.kind === 'save') && R.STRINGS[R.MAPS.kifisia_cafe.cafeHello], 'the first Καφενείο of Βόρεια saves, with its own greeting');
  assert.ok(!R.MAPS.marousi_boss.npcs.some((npc) => npc.kind === 'save'), 'only the first town has the café');
  assert.ok(R.MAPS.marousi_boss.npcs.some((npc) => npc.kind === 'boss' && npc.trainer === 'amartia'));
  // the decor: ten new tiles with sprites; no cross and no religious icon is drawn, the shop windows carry no writing
  const decor = ['%', '&', '=', '>', '?', '^', '_', ';', ':', '!'];
  for (const char of decor) assert.ok(R.TILE_DEFS[char] && html.includes("make('" + char + "'"), 'a sprite for tile ' + char);
  for (const char of ['%', '=', '>', '?', '^', '_', ':']) assert.equal(R.TILE_DEFS[char].solid, true, char + ' is solid');
  for (const char of ['&', ';', '!']) assert.equal(R.TILE_DEFS[char].solid, false, char + ' is walkable');
  const mapRows = (id) => R.MAPS[id].rows.join('');
  assert.ok(mapRows('route7').includes('%') && mapRows('route7').includes('&') && mapRows('route7').includes('q'), 'route 7: marble blocks, marble steps and cranes');
  assert.ok(mapRows('route8').includes('>') && mapRows('route8').includes('?'), 'route 8: shop windows and the roundabout island');
  assert.ok(mapRows('marousi').includes('^') && mapRows('marousi').includes('_') && mapRows('marousi').includes('!'), 'Μαρούσι: the arched roof with scaffolding, the tennis court');
  assert.ok(mapRows('marousi_boss').includes(';') && mapRows('marousi_boss').includes(':'), 'the arena: stage boards and speaker stacks');
  assert.ok(mapRows('kifisia').includes('=') && mapRows('kifisia').includes('7') && mapRows('kifisia').includes('j'), 'Κηφισιά: hedges, the fountain, the metro sign');
  for (const id of VOREIA_MAP_IDS) for (const key of Object.keys(R.MAPS[id].signs)) assert.ok(R.STRINGS[R.MAPS[id].signs[key]], id + ' sign ' + key + ' has a text');
});
test('Βόρεια species: the seven new creatures have stats, moves, abilities, dossier texts, sprites; the evolutions of 11.3 (Λαϊκατζής 27, Εφοπλιστάκος 30, the three starters 32) are consistent', () => {
  const lines = [['laikatzis', 'star90', 27], ['efoplistakos', 'giotarchis', 30], ['vouleftakos', 'yperypourgos', 32], ['batsonos', 'matanthropos', 32], ['diakosdisko', 'despotakis', 32]];
  for (const [fromId, toId, level] of lines) {
    const from = R.SPECIES[fromId];
    const to = R.SPECIES[toId];
    same(from.evo, { to: toId, lv: level }, fromId + ' evolves at ' + level + ' (11.3)');
    assert.equal(to.t, from.t, toId + ' keeps the type');
    assert.equal(to.ab, from.ab, toId + ' keeps the ability');
    assert.ok(to.base.reduce((a, b) => a + b, 0) > from.base.reduce((a, b) => a + b, 0), toId + ' is stronger than ' + fromId);
    assert.ok(!to.evo, toId + ' has no later form in this roster');
    assert.equal(R.evolutionFor(R.makeMon(fromId, level - 1)), null);
    assert.equal(R.evolutionFor(R.makeMon(fromId, level)), toId);
    const mon = R.makeMon(fromId, level);
    const before = R.maxHp(mon);
    mon.hp = 5;
    assert.ok(R.evolveMon(mon) && mon.sp === toId && mon.hp === 5 + R.maxHp(mon) - before, 'evolving keeps the damage taken');
  }
  same(Object.entries(FINAL_FORMS), lines.slice(2).map(([from, to]) => [from, to]), 'the three last starter forms');
  for (const [starterId, formId] of [['komma', 'vouleftakos'], ['koulourak', 'batsonos'], ['psaltak', 'diakosdisko']]) {
    const mon = R.makeMon(starterId, 32);
    assert.ok(R.evolveMon(mon) && mon.sp === formId && R.evolveMon(mon) && mon.sp === FINAL_FORMS[formId] && !R.evolveMon(mon), starterId + ' at 32 goes through both forms and stops at the last');
  }
  for (const id of VOREIA_NEW_SPECIES) {
    const species = R.SPECIES[id];
    assert.ok(R.TYPE_IDS.includes(species.t) && R.ABILITY_IDS.includes(species.ab) && ['m', 'f', 'n'].includes(species.g), id + ' type, ability, gender');
    assert.ok(species.xp > 0 && species.base.length === 6 && species.base.reduce((a, b) => a + b, 0) > 300, id + ' stats');
    assert.ok(species.rec > 0 || FINAL_FORMS[id] === undefined && !['star90', 'rialito', 'lobbylykaina', 'giotarchis'].includes(id), id + ' recruit rate (the starter forms cannot be recruited)');
    assert.ok(species.learn.every(([lv, moveId]) => R.MOVES[moveId] && lv >= 1) && R.movesAtLevel(id, 32).length >= 4, id + ' moves');
    assert.ok(R.DEX_ORDER.includes(id) && R.STRINGS['sp.' + id][0].startsWith('Γνωστ') && R.STRINGS['sp.' + id][0].includes('Ποτέ δεν καταδικάστηκε') && R.STRINGS['sp.' + id][1].includes('Never convicted'), id + ' dossier text');
    assert.ok(new RegExp('^ {2}' + id + ': function \\(p\\)', 'm').test(html), id + ' has a procedural sprite');
  }
  for (const id of ['yperypourgos', 'matanthropos', 'despotakis']) assert.equal(R.SPECIES[id].rec, 0, id + ' cannot be recruited');
  assert.ok(R.SPECIES.rialito.t === 'cel' && R.SPECIES.lobbylykaina.t === 'pol' && R.SPECIES.giotarchis.t === 'biz' && R.SPECIES.star90.t === 'cel');
  // a creature of an old save that is level 27 / 30 / 32 or more evolves after its next battle: the evolution is data, so the old save needs nothing
  const laikatzis = R.makeMon('laikatzis', 26);
  R.gainXp(laikatzis, R.xpForLevel(27) - laikatzis.xp);
  assert.equal(laikatzis.lv, 27);
  assert.equal(R.evolutionFor(laikatzis), 'star90');
  // the trainers and the boss show the form that fits the level
  for (const id of VOREIA_TRAINERS.concat(['amartia'])) for (const entry of R.TRAINERS[id].team) {
    const species = R.SPECIES[entry.sp];
    if (species && species.evo) assert.ok(entry.lv < species.evo.lv, id + ': ' + entry.sp + ' at ' + entry.lv + ' would have evolved');
    for (const other of Object.values(R.SPECIES)) if (other.evo && other.evo.to === entry.sp) assert.ok(entry.lv >= other.evo.lv, id + ': ' + entry.sp + ' at ' + entry.lv + ' is below its evolution level');
  }
});
test('Βόρεια items: the Χοντρός Φάκελος is a recruit item stronger than the Φάκελος, sold at 600 by the kiosks of Βόρεια only; an old bag gets 0 of it', () => {
  assert.ok(R.ITEMS.chontros.kind === 'recruit' && R.ITEMS.chontros.mult > R.ITEMS.fakelos.mult && R.ITEMS.chontros.price === 600);
  assert.ok(R.ITEM_IDS.includes('chontros') && R.STRINGS['item.chontros'] && R.STRINGS['itemd.chontros']);
  for (const mapId of Object.keys(R.MAPS)) if (R.MAPS[mapId].npcs.some((npc) => npc.kind === 'shop')) {
    assert.equal(R.shopStockOf(R.MAPS[mapId]).includes('chontros'), /^(kifisia|marousi|peristeri|chaidari|monastiraki|syntagma)_shop$/.test(mapId), mapId + ': only the kiosks of Βόρεια, Δυτικά and Αθήνα sell it');
  }
  const foe = R.makeMon('nftarchis', 28);
  assert.ok(R.recruitChance(foe, 'chontros') > R.recruitChance(foe, 'fakelos') && R.recruitChance(foe, 'fakelos') > R.recruitChance(foe, 'fakelaki'));
  assert.ok(R.recruitChance(foe, 'chontros') <= 0.95);
  const old = R.migrateSave({ version: 3, player: { name: 'ΝΙΚΟΣ', gender: 'm', map: 'spata', x: 12, y: 9, dir: 'left' }, party: [{ sp: 'komma', lv: 17, xp: R.xpForLevel(17), hp: 40 }], archive: [], money: 5, bag: { fakelaki: 3 },
    dex: { seen: {}, got: {} }, flags: { gotStarter: true }, lastHeal: R.HOSPITAL_SPOT, options: { lang: 'el', sound: true, textSpeed: 1, reduceMotion: false }, rngState: 1, starter: 'komma' });
  assert.equal(old.bag.chontros, 0);
});
test('Βόρεια trainers: seven trainers with names in the strings, levels 27-30, a seeded 1,000-battle replay twice gives equal checksums, the fights are winnable at the intended levels; the rival of the fourth fight', () => {
  assert.equal(VOREIA_TRAINERS.length, 7);
  const onMaps = {};
  for (const id of ['route7', 'route8', 'marousi']) for (const npc of R.MAPS[id].npcs) if (npc.kind === 'trainer') onMaps[npc.trainer] = id;
  same(onMaps, { oldstar: 'route7', gardener: 'route7', contestant: 'route7', rival4: 'route8', lobbyist: 'route8', tennis: 'route8', usher: 'marousi' }, 'three on route 7, three on route 8, one in Μαρούσι');
  for (const id of VOREIA_TRAINERS) {
    const trainer = R.TRAINERS[id];
    assert.ok(trainer.team.length >= 2 && trainer.team.length <= 3 && !trainer.boss && trainer.boost === undefined, id + ' team');
    for (const entry of trainer.team) assert.ok(entry.lv >= 27 && entry.lv <= 30, id + ' level ' + entry.lv);
    for (const part of ['intro', 'win', 'after']) assert.ok(R.STRINGS['tr.' + id + '.' + part], id + ' ' + part);
    const npc = Object.values(R.MAPS).flatMap((map) => map.npcs).find((entry) => entry.trainer === id);
    assert.ok(npc.sight >= 2 && npc.sight <= 3, id + ' sees ' + npc.sight + ' tiles');
  }
  const members = new Set(VOREIA_TRAINERS.flatMap((id) => R.TRAINERS[id].team.map((entry) => entry.sp)));
  for (const species of ['star90', 'rialito', 'lobbylykaina', 'influenza', 'nftarchis', 'efoplistakos', 'fakelarchis']) assert.ok(members.has(species), 'the trainers use ' + species);
  // the rival, fourth fight: the middle form of the starter he took (the last form comes at 32, after this fight), the boss' top level minus 2
  for (const starter of R.STARTERS) {
    const team = R.buildTrainerTeam('rival4', starter);
    assert.equal(team[team.length - 1].sp, R.SPECIES[R.RIVAL_STARTER[starter]].evo.to, 'rival, fourth fight, player starter ' + starter);
    assert.equal(team[team.length - 1].lv, 30);
  }
  assert.equal(R.TRAINERS.rival4.team[R.TRAINERS.rival4.team.length - 1].lv, R.TRAINERS.amartia.team[R.TRAINERS.amartia.team.length - 1].lv - 2, 'the rival: the boss top level minus 2');
  assert.equal(R.npcVisible({ kind: 'trainer', trainer: 'rival4' }, {}), true);
  assert.equal(R.npcVisible({ kind: 'trainer', trainer: 'rival4' }, { t_rival4: true }), false, 'he leaves after the fourth fight');
  const replay = (seed) => {
    const rng = R.makeRng(seed);
    const lines = [];
    const ids = VOREIA_TRAINERS.concat(['amartia']);
    for (let i = 0; i < 125; i++) {
      for (const id of ids) {
        const team = voreiaTeam(R, rng, 31, 3);
        const result = R.simulateBattle(team, R.buildTrainerTeam(id, 'komma'), rng, { foeItems: R.TRAINERS[id].items });
        lines.push(id + result.winner + ':' + result.turns);
      }
    }
    assert.equal(lines.length, 1000);
    return R.hashString(lines.join('|'));
  };
  assert.equal(replay(41), replay(41));
  assert.notEqual(replay(41), replay(42));
  const winRate = (trainerId, level, size, runsCount) => {
    const rng = R.makeRng(3900 + level + size);
    let wins = 0;
    for (let i = 0; i < runsCount; i++) wins += R.simulateBattle(voreiaTeam(R, rng, level, size), R.buildTrainerTeam(trainerId, 'komma'), rng, { playerItems: [] }).winner === 0 ? 1 : 0;
    return wins / runsCount;
  };
  // a full team of level 30 (the level of the last trainers) wins every trainer fight almost always; three creatures still win more often than not
  for (const id of VOREIA_TRAINERS) {
    assert.ok(winRate(id, 30, 6, 100) >= 0.9, id + ' with six creatures at level 30');
    assert.ok(winRate(id, 30, 3, 100) >= 0.5, id + ' with three creatures at level 30');
  }
});
test('Βόρεια boss: the win-rate bands of 11.7 (the same offsets and bands as the other bosses) with the AI-played player team, and the boss data', () => {
  const boss = R.TRAINERS.amartia;
  same(boss.team.map((entry) => entry.sp + entry.lv), BOSS_TEAM_02D, 'the boss team of 11.14');
  assert.equal(boss.boss, true); assert.equal(boss.bonus, 200);
  assert.equal(boss.look, 'amartia');
  assert.equal(R.WORLD.districts.voreia.bossTrainer, 'amartia');
  assert.equal(R.WORLD.districts.voreia.badgeFlag, 'badge_voreia');
  assert.equal(boss.victory.flag, 'badge_voreia');
  for (const key of ['win2', 'title', 'sub', 'win3']) assert.ok(R.STRINGS[boss.victory[key]], 'victory text ' + key);
  assert.equal(boss.victory.chapterCard, undefined, 'only the first boss ends a chapter');
  assert.equal(R.STRINGS['badge.voreia.title'][0], 'ΠΑΡΑΣΗΜΟ ΠΡΩΤΗΣ ΣΕΙΡΑΣ');
  assert.ok(R.STRINGS['tr.amartia.intro'][0].includes('{φίλε|φίλη}'), 'the player is addressed with the gender choice');
  assert.ok(R.STRINGS['boss.amartia.win3'][0].includes('Πρώτης Σειράς') && R.STRINGS['boss.amartia.win3'][1].includes('First Row Medal'));
  assert.ok(boss.name === 'DJ Αμαρτία', 'a clearly invented name');
  // the money: 32 x 30 + 200 for the boss
  const prize = R.prizeFor({ sides: [{ party: [], active: 0 }, { party: R.buildTrainerTeam('amartia', 'komma') }] }, boss);
  assert.equal(prize, 32 * 30 + 200);
  assert.equal(boss.boost, BOSS_BOOST_02D, 'the boost of 11.14 (none when undefined)');
  for (const id of Object.keys(R.TRAINERS)) if (id !== 'bougatsas' && id !== 'amartia') assert.equal(R.TRAINERS[id].boost, undefined, id + ' has no boost');
  same(boss.items, BOSS_ITEMS_02D, 'the items in her bag');
  // the bands
  const top = boss.team.reduce((best, entry) => Math.max(best, entry.lv), 0);
  assert.equal(top, 32);
  const twoSouvlaki = ['souvlaki', 'souvlaki'];
  const bands = [];
  for (const [label, offset, size, items, low, high] of bossBands(R, 'amartia')) bands.push([label, bossWinRate(R, 'amartia', top + offset, size, items === 2 ? twoSouvlaki : [], BOSS_RUNS_PER_CELL, 5000), low, high]);
  for (const [label, rate, low, high] of bands) assert.ok(rate >= low && rate <= high, 'DJ Αμαρτία, ' + label + ': ' + rate + ' outside ' + low + '-' + high);
});
test('Βόρεια: old saves (v2 and v3, standing anywhere in Πειραιάς, Νότια or Ανατολικά) load and continue; the new flag and the new places migrate; old creatures evolve at their level', () => {
  const party = [{ sp: 'laikatzis', lv: 27, xp: R.xpForLevel(27), hp: 40 }, { sp: 'vouleftakos', lv: 33, xp: R.xpForLevel(33), hp: 30 }, { sp: 'efoplistakos', lv: 30, xp: R.xpForLevel(30), hp: 40 }];
  const make = (version, map, x, y, flags, extra) => Object.assign({ version, player: { name: 'ΝΙΚΟΣ', gender: 'm', map, x, y, dir: 'left' }, party, archive: [], money: 555, bag: { fakelaki: 3, gemista: 1 },
    dex: { seen: { komma: true }, got: { komma: true } }, flags, lastHeal: { map: 'spata_hospital', x: 5, y: 7, dir: 'up' }, options: { lang: 'el', sound: true, textSpeed: 1, reduceMotion: false }, rngState: 99, starter: 'komma' }, extra || {});
  const sampleOf = (rows, mapId) => {
    const found = [];
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === '1' && R.tileWalkable(R.MAPS[mapId], x, y, VOREIA_FLAGS)) found.push([x, y]);
    return found;
  };
  let count = 0;
  for (const id of OLD_MAP_IDS) for (const [x, y] of sampleOf(OLD_WALKABLE[id].split('/'), id)) {
    for (const version of [2, 3]) {
      const loaded = R.migrateSave(make(version, id, x, y, VOREIA_FLAGS));
      assert.ok(loaded.player.map === id && loaded.player.x === x && loaded.player.y === y, version + ' ' + id + ' ' + x + ',' + y + ' loads where it stood');
      count++;
    }
  }
  for (const table of [OLD_WALKABLE_02A, OLD_WALKABLE_02B, OLD_WALKABLE_02C]) for (const id of Object.keys(table)) for (const [x, y] of sampleOf(table[id].split('/'), id)) {
    const loaded = R.migrateSave(make(3, id, x, y, VOREIA_FLAGS));
    assert.ok(loaded.player.map === id && loaded.player.x === x && loaded.player.y === y, id + ' ' + x + ',' + y + ' loads where it stood');
    count++;
  }
  assert.ok(count > 3500, 'a lot of positions were loaded: ' + count);
  // the creatures of an old save: Λαϊκατζής L27, Εφοπλιστάκος L30 and a Βουλευτάκος L33 are evolvable (the game offers it after the next battle), nothing is lost
  const old = R.migrateSave(make(2, 'spata', 12, 9, Object.assign({ badge_anatolika: true }, ANATOLIKA_FLAGS)));
  assert.equal(old.party[0].sp, 'laikatzis'); assert.equal(old.party[1].lv, 33);
  assert.equal(R.evolutionFor(R.restoreMon(old.party[0])), 'star90'); assert.equal(R.evolutionFor(R.restoreMon(old.party[1])), 'yperypourgos'); assert.equal(R.evolutionFor(R.restoreMon(old.party[2])), 'giotarchis');
  assert.equal(old.money, 555); assert.equal(old.bag.gemista, 1); assert.equal(old.bag.chontros, 0);
  assert.equal(R.placeState(old.world, 'kifisia'), 'hidden', 'Κηφισιά is told about only when route 7 is walked');
  assert.equal(R.districtState(old.world, 'voreia'), 'open', 'the Boarding Medal opens the district');
  // a new save: Βόρεια places, the new badge flag
  const world = R.newWorldState();
  R.worldVisit(world, 'route7', VOREIA_FLAGS);
  assert.equal(world.routes.route7, 1); assert.equal(R.placeState(world, 'kifisia'), 'seen');
  R.worldVisit(world, 'kifisia_cafe', VOREIA_FLAGS);
  R.worldVisit(world, 'route8', VOREIA_FLAGS);
  assert.equal(R.placeState(world, 'marousi'), 'seen');
  R.worldVisit(world, 'marousi_boss', Object.assign({ badge_voreia: true }, VOREIA_FLAGS));
  assert.equal(R.placeState(world, 'kifisia'), 'visited'); assert.equal(R.placeState(world, 'marousi'), 'visited');
  assert.equal(world.badges.voreia, 1, 'the flag badge_voreia fills the badge');
  assert.equal(R.districtState(world, 'voreia'), 'cleared');
  assert.equal(R.districtState(world, 'dytika'), 'open', 'the First Row Medal opens Δυτικά');
  assert.equal(R.districtState(world, 'athina'), 'locked', 'the next district is not built');
  const stored = R.migrateSave(make(3, 'marousi_hospital', 5, 7, Object.assign({ badge_voreia: true, t_amartia: true }, VOREIA_FLAGS), { world, lastHeal: { map: 'marousi_hospital', x: 5, y: 7, dir: 'up' } }));
  same(stored.lastHeal, { map: 'marousi_hospital', x: 5, y: 7, dir: 'up' }, 'the Μαρούσι hospital is a valid return point');
  assert.equal(stored.player.map, 'marousi_hospital');
  assert.equal(stored.flags.badge_voreia, true);
  assert.equal(stored.world.routes.route8, 1);
  same(R.migrateSave(JSON.parse(JSON.stringify(stored))), stored, 'a second load changes nothing');
  const flagOnly = R.migrateSave(make(2, 'spata', 12, 9, Object.assign({ badge_voreia: true }, VOREIA_FLAGS)));
  assert.equal(flagOnly.world.badges.voreia, 1);
  // a save from this build stands on a Βόρεια tile that an older build does not know: it falls back to the start, as for every unknown place
  assert.equal(R.migrateSave(make(3, 'atlantis', 3, 3, VOREIA_FLAGS)).player.map, 'lab');
});
test('Βόρεια leaves Ανατολικά as it was: only the east end of the Σπάτα street changes (26,9 walks on, 27,9 is the gate); every old walkable tile is still walkable', () => {
  for (const id of Object.keys(OLD_WALKABLE_02C)) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE_02C[id].split('/');
    assert.equal(map.h, rows.length, id + ' height'); assert.equal(map.w, rows[0].length, id + ' width');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (rows[y][x] === '1') assert.ok(!R.tileDef(map, x, y).solid, id + ' ' + x + ',' + y + ' was walkable and still must be');
  }
  const nowWalkable = [];
  for (const id of Object.keys(OLD_WALKABLE_02C)) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE_02C[id].split('/');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (rows[y][x] === '0' && !R.tileDef(map, x, y).solid) nowWalkable.push(id + ':' + x + ',' + y);
  }
  same(nowWalkable, ['spata:26,9', 'spata:27,9']);
  assert.equal(R.districtState(R.newWorldState(), 'anatolika'), 'locked');
});
test('Βόρεια boss path: the victory data of the boss sets only the flag of its own badge; the other flags and the credits flag are not touched', () => {
  const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));
  const victory = part('OverworldLayer.prototype.bossVictory', 'OverworldLayer.prototype.runEvent');
  assert.ok(victory.includes('TRAINERS[trainerId].victory') && victory.includes('G.flags[victory.flag] = true') && !/G\.flags\.(badge|badge_notia|badge_anatolika|badge_voreia)\b/.test(victory));
  same(R.TRAINERS.amartia.victory, { flag: 'badge_voreia', win2: 'boss.amartia.win2', title: 'badge.voreia.title', sub: 'badge.voreia.sub', win3: 'boss.amartia.win3', ribbon: '#3f9a52' });
  for (const other of ['bougatsas', 'faia']) assert.notEqual(R.TRAINERS.amartia.victory.ribbon, R.TRAINERS[other].victory.ribbon, 'each badge has its own ribbon colour');
  assert.notEqual(R.STRINGS['badge.voreia.title'][0], R.STRINGS['badge.anatolika.title'][0]);
});
test('Βόρεια: no per-frame work in the new content (the tiles and creature sprites are drawn once into canvases; the texts are cached strings; the shop draws nine rows from the stock list)', () => {
  const tileBuilder = html.slice(html.indexOf('function buildTileSprites()'), html.indexOf('buildHospitalTiles(make);'));
  for (const char of ['%', '&', '=', '>', '?', '^', '_', ';', ':', '!']) assert.ok(tileBuilder.includes("make('" + char + "'"), 'the sprite of tile ' + char + ' is built once in buildTileSprites');
  const cache = html.slice(html.indexOf('function creatureSprite('), html.indexOf('function buildAllSprites()'));
  assert.ok(cache.includes('if (creatureSprites[speciesId]) return creatureSprites[speciesId];'), 'creature sprites are cached after the first draw');
  for (const id of VOREIA_NEW_SPECIES) assert.ok(new RegExp('^ {2}' + id + ': function \\(p\\) \\{', 'm').test(html.slice(html.indexOf('const creatureDrawers = {'), html.indexOf('const creatureSprites = {}'))), id + ' is drawn by a creatureDrawers entry (run once)');
  const overworldDraw = html.slice(html.indexOf('OverworldLayer.prototype.draw = function'), html.indexOf('OverworldLayer.prototype.drawNpc'));
  assert.ok(!/(kifisia|marousi|route7|route8|voreia|amartia)/i.test(overworldDraw), 'the overworld draw code has no Βόρεια special case');
  const shopDraw = html.slice(html.indexOf('ShopLayer.prototype.draw = function'), html.indexOf('// ---- Evolution and move learning'));
  assert.ok(!shopDraw.includes('measureText') && shopDraw.includes('i * 10') && shopDraw.includes('this.stock.length'), 'the shop draws one row per stock item, 10 px apart, with no text measuring per frame');
  assert.ok(19 + 10 * 9 + 8 <= 16 + 103, 'ten rows (the last starts at y 109, 8 px tall) fit in the list panel (16 + 103 = 119)');
});
test('Βόρεια: type fairness named: every type of the boss is hit for x2 by a starter or a creature that is available before him', () => {
  const types = new Set(R.TRAINERS.amartia.team.map((entry) => R.SPECIES[entry.sp].t));
  assert.ok(types.has('cel') && types.has('biz') && types.has('pol'), 'the boss brings Celebrities, Επιχειρηματίες and Πολιτικοί');
  const before = [...R.STARTERS, ...R.districtSpecies('peiraias'), ...R.districtSpecies('notia'), ...R.districtSpecies('anatolika')].filter((id) => !VOREIA_NEW_SPECIES.includes(id));
  for (const type of types) assert.ok(before.some((id) => R.typeMultiplier(R.SPECIES[id].t, type) === 2), 'a starter or a creature of the first three districts hits ' + type);
  assert.ok(R.typeMultiplier('inf', 'cel') === 2 && R.typeMultiplier('ekk', 'cel') === 2 && R.STARTERS.includes('psaltak') && R.districtSpecies('notia').includes('storoula'), 'Ψαλτάκι (a starter) and Story-ούλα (wild in Νότια) hit Celebrities for x2');
});

// ---- MZ-WORLD-02e: the district Δυτικά ----
const DYTIKA_MAP_IDS = ['route9', 'peristeri', 'peristeri_hospital', 'peristeri_shop', 'peristeri_cafe', 'route10', 'chaidari', 'chaidari_hospital', 'chaidari_shop', 'chaidari_boss'];
const BOSS_TEAM_02E = ['ktimatomesitis36', 'giagiaexo37', 'tavlilordos38', 'fakelarchis37', 'despotakis38'];
const BOSS_BOOST_02E = undefined; // no boost (11.15)
const BOSS_ITEMS_02E = []; // nothing in his bag (11.15)
const DYTIKA_FLAGS = Object.assign({ badge_voreia: true }, VOREIA_FLAGS);
const DYTIKA_TRAINERS = ['tollclerk', 'ultras', 'granny', 'marketeer', 'philosopher', 'steward', 'gatekeeper'];
// the nine creatures of 11.3.5 plus the pre-forms that the form rule keeps in the wild below their evolution level (11.15)
const DYTIKA_SPECIES = ['eforaki', 'elegktis', 'fakelarchis', 'giagiaexo', 'giagiaka', 'giotarchis', 'kafenovios', 'ktimatomesitis', 'lobbylykaina', 'monastiriaki', 'monimos', 'rousfetolykos', 'tavlilordos'];
const DYTIKA_NEW_SPECIES = ['tavlilordos', 'giagiaexo', 'elegktis', 'ktimatomesitis', 'rousfetolykos'];
// [pre-form, evolved form, evolution level]: the levels of 11.15 (11.3 proposed 30 / 32 / 32 / 32)
const DYTIKA_EVOLUTIONS = [['kafenovios', 'tavlilordos', 36], ['giagiaka', 'giagiaexo', 37], ['eforaki', 'elegktis', 36], ['monastiriaki', 'ktimatomesitis', 36]];
// the walkable tiles (1) and solid tiles (0) of the ten maps of Βόρεια, taken from the base build 5677122 (MZ-WORLD-02d)
const OLD_WALKABLE_02D = {
  route7: '00000000000000000000000000000000/00000000000000000000000000000110/00000000000000000000000000000110/11111111111111111111111111111110/11111111111111111111111111111110/01011111111111111111111111111110/01110111110111110111011111111010/01111111111101111101111111111110/01111111111111111111111111111110/01111111111111111111111111111110/01111111111111111111111111111110/01111111111011111111111111101110/01101111111111011111110111111110/01111111111111111111111111111010/01011111111111111111111111111111/01111011111111111111111111111111/01111111111111111111111111111110/00000000000000000000000000000000',
  kifisia: '00000000000000000000000000/01111111111111111111111110/01000001100001100000100000/01000001100001100000100000/01000001100001100000100000/01001000101000100100000000/01111111111111111111111110/00000111111111111111000000/01111111011111111111111010/11111111111111111111111111/01111111111111111111111110/01000000111011101110000000/01000000101110111010000000/01000000111011101110000000/01000000111111111010000000/00000000011111111100000000/00000000000000000000000000/00000000000000000000000000',
  kifisia_hospital: '000000000000/011111111110/000000000000/001110111100/011111111110/001111111100/001101101100/011111111110/000001100000',
  kifisia_shop: '00000000/00011000/00000000/01111110/01111110/00011000',
  kifisia_cafe: '0000000000/0001111100/0000001110/0111111110/0111111110/0100110010/0111111110/0000110000',
  route8: '00000000000000000000000000000000000000000000/00000000100000001000000010000000010000000010/00000000100000001000000010000000010000000010/01111111111111111111111111111111111111111110/01101111111111111111111111111111111111111010/11111111111111111111100001111111111111111111/11111111111111111111100001111111111111111111/01110111110111110011100001111101111101111010/01111111111111111111100001111111111111111110/01111110111111111111111111111111101111111110/01111111111110111111111111111111111111011110/01111111111111111111111111111111111111111110/01111111111111111111111111111111111111111110/00000000000000000000000000000000000000000000',
  marousi: '0000000000000000000000000000/0111111111111100000000000000/0100000110000100000000000000/0100000110000100000000000000/0100000110000100000010000000/0100100010100011101111111110/0111111111111111111111111110/0111111111111111111111111110/0111111011110111111111111110/0011111111111111111111111111/0000010000011111111111111110/0011111111010100000110000010/0011111111011100000100000010/0011111111011100000110000010/0011111111010100000100000010/0000000000011111111111111110/0000000000000000000000000000/0000000000000000000000000000',
  marousi_hospital: '000000000000/011111111110/000000000000/001110111100/011111111110/001111111100/001101101100/011111111110/000001100000',
  marousi_shop: '00000000/00011000/00000000/01111110/01111110/00011000',
  marousi_boss: '00000000000000/00111111111100/00111111111100/01110000001110/01111111111110/01111111111110/01111111111110/01001111110010/01111111111110/00000011000000',
};
// words of faith, prayer or rites (αγιο|αγια only at the start of a word, or Γιαγιά would match): no text of the new district may carry one (the Εκκλησία type and the abbot joke about wealth, property and tax only, 11.15)
const FAITH_WORDS = /προσευχ|αγιασμ|σταυρ|θυμιαμ|λιτανει|λειτουργ|εξομολογ|χριστ|θεου|θεος|prayer|pray |saint|holy|cross|incense|ritual|liturg|bless|sacred|faith|priest|baptis|(?<!\p{L})(?:αγιο|αγια)|παναγι|θεε(?!\p{L})|ευλογ|εικονισμ|εικονοστ|προσκυν|θαυμα(?!σ)/u;
const DYTIKA_STRING_KEY = /^(map\.(route9|peristeri|route10|chaidari)|warp\.route9|sign\.(route9|toll|peristeri|route10|channel|chaidari)|npc\.(tollwatcher|hitchhiker|peristeri|pscafe|stallholder|angler|chaidari)|cafe\.hello\.peristeri|tr\.(tollclerk|ultras|granny|marketeer|philosopher|steward|gatekeeper|plousiakis)|boss\.plousiakis|badge\.dytika|item\.sylvasi|itemd\.sylvasi|sp\.(tavlilordos|giagiaexo|elegktis|ktimatomesitis|rousfetolykos))/;

test('Δυτικά XP band (section 11.4): within W = 10 wild fights, the seven trainers alone give at most 1.3 times the need', () => {
  const band = xpBand(R, 'dytika');
  same(band.trainerIds.slice().sort(), DYTIKA_TRAINERS.slice().sort(), 'the seven trainers of route 9, route 10 and Χαϊδάρι (the boss does not count; no rival fight in this district)');
  assert.equal(band.top, 38);
  assert.equal(band.need, 39789, '3 x (xpForLevel(38) - xpForLevel(32))');
  assert.ok(band.wildFights <= 10, 'wild fights still needed: ' + band.wildFights);
  assert.ok(band.trainerShare <= 1.3 && band.trainerShare < 1, 'trainers give ' + band.trainerShare.toFixed(2) + ' of the need');
  assert.ok(band.trainerXp > 0 && band.wildXp > 0);
  assert.ok(R.TRAINERS.plousiakis.boss && !band.trainerIds.includes('plousiakis'), 'the boss comes after the climb');
});
test('Δυτικά: the road from Μαρούσι is shut without the First Row Medal; every new map is reachable, has its way back and no dead end', () => {
  const start = R.START_MAP;
  const gate = R.MAPS.marousi.warps.find((warp) => warp.x === 0 && warp.y === 9);
  assert.ok(gate && gate.to === 'route9' && gate.needFlag === 'badge_voreia' && R.STRINGS[gate.lockedText], 'the gate at the west end of the street needs the flag badge_voreia and says why');
  assert.ok(!R.tileDef(R.MAPS.marousi, 0, 9).solid && !R.tileDef(R.MAPS.marousi, 1, 9).solid && !R.MAPS.marousi.signs['1,9'], 'the old sign is gone and the street walks on to the edge');
  assert.ok(R.tileDef(R.MAPS.marousi, 0, 8).solid && R.MAPS.marousi.signs['0,8'] === 'sign.marousi.west' && R.STRINGS['sign.marousi.west'], 'the sign stands beside the gate');
  const without = R.reachableTiles(start.map, start.x, start.y, VOREIA_FLAGS);
  for (const id of DYTIKA_MAP_IDS) assert.ok(![...without].some((key) => key.startsWith(id + ':')), id + ' is not reachable without the First Row Medal');
  const shutOnMarousi = R.reachableTiles('marousi', 26, 9, VOREIA_FLAGS); // standing in Μαρούσι with the badge flag missing (a damaged save)
  assert.ok(shutOnMarousi.has('marousi:1:9') && !shutOnMarousi.has('marousi:0:9') && !shutOnMarousi.has('route9:42:5'), 'the gate tile is shut without the badge flag');
  const all = R.reachableTiles(start.map, start.x, start.y, DYTIKA_FLAGS);
  for (const key of ['marousi:0:9', 'route9:42:5', 'route9:1:5', 'peristeri:24:9', 'peristeri:1:9', 'route10:34:8', 'route10:1:8', 'chaidari:26:9']) assert.ok(all.has(key), key + ' is reachable through the gate and along both routes');
  for (const id of DYTIKA_MAP_IDS) {
    const map = R.MAPS[id];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (/_(hospital|shop)$/.test(id) && y === 1) continue; // behind the counter, as in the templates of New Piraeus
      if (id === 'chaidari' && x === 0 && y === 9) continue; // the gate tile to Αθήνα (MZ-WORLD-02f): shut without the flag badge_dytika
      if (!R.tileDef(map, x, y).solid && !R.npcAtTile(map, x, y, DYTIKA_FLAGS)) assert.ok(all.has(id + ':' + x + ':' + y), id + ' walkable tile ' + x + ',' + y + ' is cut off');
    }
    for (const warp of map.warps) {
      assert.ok(R.MAPS[warp.to].warps.some((back) => back.to === id), id + ' -> ' + warp.to + ' has a return warp');
      if (warp.needFlag === 'badge_dytika') continue; // the gate to Αθήνα: tested by the Αθήνα tests
      assert.ok(R.tileWalkable(R.MAPS[warp.to], warp.tx, warp.ty, DYTIKA_FLAGS), id + ' -> ' + warp.to + ' arrives on a walkable tile');
      assert.ok(all.has(id + ':' + warp.x + ':' + warp.y), id + ' warp ' + warp.x + ',' + warp.y + ' is reachable');
    }
    for (const npc of map.npcs) assert.ok(R.npcTalkable(id, npc, all), id + ':' + npc.id + ' can be talked to');
    for (const key of Object.keys(map.signs)) {
      const [sx, sy] = key.split(',').map(Number);
      assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => all.has(id + ':' + (sx + dx) + ':' + (sy + dy))), id + ' sign ' + key + ' can be read');
      assert.ok(R.tileDef(map, sx, sy).solid, id + ' sign ' + key + ' stands on a solid tile');
    }
  }
  // no dead end: from the arrival tile of each new map the player reaches exactly what is reachable from the start
  for (const [mapId, x, y] of [['route9', 42, 5], ['peristeri', 24, 9], ['route10', 34, 8], ['chaidari', 26, 9], ['chaidari_boss', 5, 8], ['peristeri_cafe', 4, 6]]) {
    assert.equal(R.reachableTiles(mapId, x, y, DYTIKA_FLAGS).size, all.size, 'from ' + mapId + ' everything can be reached again');
  }
  // the boss can be talked to across the counter; the west end of the Χαϊδάρι street is the gate to Αθήνα (MZ-WORLD-02f) with its sign beside it
  assert.ok(R.npcTalkable('chaidari_boss', R.MAPS.chaidari_boss.npcs.find((npc) => npc.id === 'plousiakis'), all));
  assert.equal(R.MAPS.chaidari.signs['0,8'], 'sign.chaidari.west');
  assert.ok(R.MAPS.chaidari.warps.some((warp) => warp.x === 0 && warp.y === 9 && warp.to === 'route11' && warp.needFlag === 'badge_dytika'), 'the gate to Αθήνα');
});
test('Δυτικά data: sizes of 11.7, places on the world map, rows, tiles, wild tables with the species of 11.3.5, two towns with hospital, kiosk and ΚΤΕΛ stop, the café of Περιστέρι, the monastery', () => {
  const sizes = { route9: [44, 12], peristeri: [26, 18], peristeri_hospital: [12, 9], peristeri_shop: [8, 6], peristeri_cafe: [10, 8], route10: [36, 18], chaidari: [28, 18], chaidari_hospital: [12, 9], chaidari_shop: [8, 6], chaidari_boss: [12, 10] };
  for (const id of DYTIKA_MAP_IDS) {
    const map = R.MAPS[id];
    same([map.w, map.h], sizes[id], id + ' size');
    assert.equal(map.rows.length, map.h);
    for (const row of map.rows) { assert.equal(row.length, map.w, id + ' width'); for (const char of row) assert.ok(R.TILE_DEFS[char], id + ' tile ' + char); }
    assert.ok(R.mapNode(id) && R.mapNode(id).district === 'dytika', id + ' belongs to a place of Δυτικά');
    assert.ok(R.STRINGS[map.name], id + ' name');
  }
  assert.equal(DYTIKA_MAP_IDS.reduce((sum, id) => sum + R.MAPS[id].w * R.MAPS[id].h, 0), 44 * 12 + 26 * 18 + 12 * 9 * 2 + 8 * 6 * 2 + 10 * 8 + 36 * 18 + 28 * 18 + 12 * 10, 'the tiles of the build plan (2,660)');
  same([W.districts.dytika.built, W.nodes.peristeri.built, W.nodes.chaidari.built, W.routes.route9.built, W.routes.route10.built, W.nodes.peristeri.stop, W.nodes.chaidari.stop], [true, true, true, true, true, true, true]);
  same([R.mapNode('peristeri_cafe').id, R.mapNode('chaidari_boss').id, R.mapNode('route9').id, R.mapNode('route10').id], ['peristeri', 'chaidari', 'route9', 'route10']);
  // both routes run right to left (11.5)
  assert.equal(W.routes.route9.progress, '-x'); assert.equal(W.routes.route10.progress, '-x');
  // wild tables: the species of 11.3.5 at the levels of 11.4 (R9 32-35, R10 34-37); a creature appears in the form that fits its level
  const allowed = { route9: ['eforaki', 'fakelarchis', 'giagiaka', 'giotarchis', 'kafenovios', 'lobbylykaina', 'monastiriaki', 'monimos'], route10: DYTIKA_SPECIES.filter((id) => id !== 'giotarchis') };
  const range = { route9: [32, 35], route10: [34, 37] };
  for (const mapId of ['route9', 'route10']) {
    const used = new Set();
    for (const zone of R.MAPS[mapId].zones) for (const entry of zone.table) {
      used.add(entry.sp);
      assert.ok(entry.min >= range[mapId][0] && entry.max <= range[mapId][1] && entry.min <= entry.max, mapId + ' ' + entry.sp + ' levels');
      for (const species of Object.values(R.SPECIES)) if (species.evo && species.evo.to === entry.sp) assert.ok(entry.min >= species.evo.lv, entry.sp + ' appears only from its evolution level');
      if (R.SPECIES[entry.sp].evo) assert.ok(entry.max < R.SPECIES[entry.sp].evo.lv, entry.sp + ' is wild only below its evolution level (the evolved form takes over)');
    }
    same([...used].sort(), allowed[mapId].slice().sort(), mapId + ' species');
  }
  const lowest = (zone) => zone.table.reduce((a, b) => (a.w <= b.w ? a : b)).sp;
  assert.equal(lowest(R.MAPS.route10.zones[1]), 'elegktis', 'Ελεγκτής ΣΔΟΕ 3000 and Ρουσφετόλυκος are the rare ones on route 10 (11.3.5)');
  assert.ok(R.MAPS.route10.zones[1].table.find((entry) => entry.sp === 'rousfetolykos').w === 8 && R.MAPS.route10.zones[1].table.find((entry) => entry.sp === 'elegktis').w === 8);
  assert.ok(R.MAPS.route10.zones[0].table.every((entry) => !DYTIKA_NEW_SPECIES.includes(entry.sp)), 'the first half of route 10 (levels 34-36) holds the pre-forms: the evolved forms start at level 36');
  same(R.districtSpecies('dytika').sort(), DYTIKA_SPECIES);
  assert.equal(Math.min(...R.MAPS.route9.zones.flatMap((zone) => zone.table.map((entry) => entry.min))), 32);
  assert.equal(Math.max(...R.MAPS.route10.zones.flatMap((zone) => zone.table.map((entry) => entry.max))), 37);
  // each town: a hospital that heals (return point), a kiosk with ten items (the Συλλογική Σύμβαση is new), a ΚΤΕΛ stop tile; Περιστέρι the first Καφενείο, Χαϊδάρι the monastery
  for (const [town, buildings] of [['peristeri', ['peristeri_hospital', 'peristeri_shop', 'peristeri_cafe']], ['chaidari', ['chaidari_hospital', 'chaidari_shop', 'chaidari_boss']]]) {
    assert.ok(R.MAPS[town].rows.join('').includes('U'), town + ' has its ΚΤΕΛ stop');
    assert.ok(R.MAPS[town].warps.filter((warp) => buildings.includes(warp.to)).length === 3, town + ' has the three doors');
    const hospital = R.MAPS[town + '_hospital'];
    assert.ok(hospital.npcs.some((npc) => npc.kind === 'heal') && hospital.actions['1,3'] === 'archive' && !R.tileDef(hospital, R.HOSPITAL_SPOT.x, R.HOSPITAL_SPOT.y).solid, town + ' hospital heals and has the archive terminal');
    assert.ok(R.MAPS[town + '_shop'].npcs.some((npc) => npc.kind === 'shop'));
    same(R.shopStockOf(R.MAPS[town + '_shop']), R.SHOP_STOCK_DYTIKA, town + ' kiosk sells ten items');
  }
  assert.ok(R.MAPS.peristeri_cafe.npcs.some((npc) => npc.kind === 'save') && R.STRINGS[R.MAPS.peristeri_cafe.cafeHello], 'the first Καφενείο of Δυτικά saves, with its own greeting');
  assert.ok(!R.MAPS.chaidari_boss.npcs.some((npc) => npc.kind === 'save'), 'only the first town has the café');
  assert.ok(R.MAPS.chaidari_boss.npcs.some((npc) => npc.kind === 'boss' && npc.trainer === 'plousiakis'));
  // the decor: ten new tiles with sprites; no cross and no religious icon is drawn (the monastery is a plain whitewashed compound with a roof, a door and a car park)
  const decor = ['*', '+', '-', '/', '<', '|', '@', '`', ')', '('];
  for (const char of decor) assert.ok(R.TILE_DEFS[char] && html.includes("make('" + char + "'"), 'a sprite for tile ' + char);
  for (const char of ['*', '+', '-', '/', '|', '@', '(']) assert.equal(R.TILE_DEFS[char].solid, true, char + ' is solid');
  for (const char of ['<', '`', ')']) assert.equal(R.TILE_DEFS[char].solid, false, char + ' is walkable');
  assert.ok(!R.TILE_DEFS['<'].grass && !R.TILE_DEFS['`'].grass, 'the pitch and the road have no wild encounters');
  const mapRows = (id) => R.MAPS[id].rows.join('');
  assert.ok(mapRows('route9').includes('*') && mapRows('route9').includes('@') && mapRows('route9').includes(')'), 'route 9: toll booths, crash barriers, dashed lanes');
  assert.ok(mapRows('route10').includes('/') && mapRows('route10').includes('-'), 'route 10: market stalls and the river channel');
  assert.ok(mapRows('peristeri').includes('+') && mapRows('peristeri').includes('<') && mapRows('peristeri').includes('|') && mapRows('peristeri').includes('/'), 'Περιστέρι: apartment blocks with laundry, the football ground with goals, the market');
  assert.ok(mapRows('chaidari').includes('J') && mapRows('chaidari').includes('(') && mapRows('chaidari').includes('R'), 'Χαϊδάρι: the whitewashed wall of the monastery, parked cars, the ridge');
  for (const id of DYTIKA_MAP_IDS) for (const key of Object.keys(R.MAPS[id].signs)) assert.ok(R.STRINGS[R.MAPS[id].signs[key]], id + ' sign ' + key + ' has a text');
  // no text of the district speaks of faith, prayer or rites (11.15): the abbot, the Monastery and the Εκκλησία type joke about wealth, property and tax only
  let checked = 0;
  for (const [key, texts] of Object.entries(R.STRINGS)) {
    if (!DYTIKA_STRING_KEY.test(key)) continue;
    for (const text of texts.slice(0, 2)) { assert.ok(!FAITH_WORDS.test(plainText(text)), key + ' speaks of faith: ' + text); checked++; }
  }
  assert.ok(checked > 150, 'the faith-word check read ' + checked + ' texts');
  for (const id of DYTIKA_NEW_SPECIES.concat(DYTIKA_TRAINERS, ['plousiakis'])) assert.ok(!FAITH_WORDS.test(plainText((R.SPECIES[id] || R.TRAINERS[id]).n || R.TRAINERS[id].name)), id + ' name');
  for (const id of ['ktimatomesitis']) for (const [, moveId] of R.SPECIES[id].learn) assert.ok(!['agiasmos', 'thymiama', 'litaneia', 'aforismos'].includes(moveId), id + ' has no move about rites: its moves are about property');
});
test('Δυτικά species: the five new creatures have stats, moves, abilities, dossier texts, sprites; the evolutions (Καφενόβιος, Γιαγιάκα, Εφοράκι, Μοναστηριάκι) are consistent and kept clear of the earlier bosses', () => {
  for (const [fromId, toId, level] of DYTIKA_EVOLUTIONS) {
    const from = R.SPECIES[fromId];
    const to = R.SPECIES[toId];
    same(from.evo, { to: toId, lv: level }, fromId + ' evolves at ' + level + ' (11.15)');
    assert.equal(to.t, from.t, toId + ' keeps the type');
    assert.equal(to.ab, from.ab, toId + ' keeps the ability');
    assert.ok(to.base.reduce((a, b) => a + b, 0) > from.base.reduce((a, b) => a + b, 0), toId + ' is stronger than ' + fromId);
    assert.ok(!to.evo, toId + ' has no later form in this roster');
    assert.ok(level > 33, toId + ': no earlier boss meets the evolved form (DJ Αμαρτία\'s top plus 1 is level 33, 11.15)');
    assert.equal(R.evolutionFor(R.makeMon(fromId, level - 1)), null);
    assert.equal(R.evolutionFor(R.makeMon(fromId, level)), toId);
    const mon = R.makeMon(fromId, level);
    const before = R.maxHp(mon);
    mon.hp = 5;
    assert.ok(R.evolveMon(mon) && mon.sp === toId && mon.hp === 5 + R.maxHp(mon) - before, 'evolving keeps the damage taken');
  }
  for (const id of DYTIKA_NEW_SPECIES) {
    const species = R.SPECIES[id];
    assert.ok(R.TYPE_IDS.includes(species.t) && R.ABILITY_IDS.includes(species.ab) && ['m', 'f', 'n'].includes(species.g), id + ' type, ability, gender');
    assert.ok(species.xp > 0 && species.rec > 0 && species.base.length === 6 && species.base.reduce((a, b) => a + b, 0) > 300, id + ' stats and a recruit rate');
    assert.ok(species.learn.every(([lv, moveId]) => R.MOVES[moveId] && lv >= 1) && R.movesAtLevel(id, 34).length >= 4, id + ' moves');
    assert.ok(R.DEX_ORDER.includes(id) && R.STRINGS['sp.' + id][0].startsWith('Γνωστ') && R.STRINGS['sp.' + id][0].includes('Ποτέ δεν καταδικάστηκε') && R.STRINGS['sp.' + id][1].includes('Never convicted'), id + ' dossier text');
    assert.ok(new RegExp('^ {2}' + id + ': function \\(p\\)', 'm').test(html), id + ' has a procedural sprite');
    assert.ok(species.n.length <= 20, id + ' name length');
  }
  assert.ok(R.SPECIES.tavlilordos.t === 'mem' && R.SPECIES.giagiaexo.t === 'mem' && R.SPECIES.elegktis.t === 'asf' && R.SPECIES.ktimatomesitis.t === 'ekk' && R.SPECIES.rousfetolykos.t === 'pol');
  assert.ok(R.SPECIES.giagiaexo.n !== 'Γιαγιά Τερμινέιτορ' && !/Τερμινέιτορ|(?<![a-z])Terminator/i.test(R.SPECIES.giagiaexo.n + R.STRINGS['sp.giagiaexo'].join(' ')), 'the plan\'s name is a trademark echo: the creature is the Γιαγιά Παντόφλα (11.15)');
  // a creature of an old save that is above its level evolves after its next battle: the evolution is data, so the old save needs nothing
  const monastiriaki = R.makeMon('monastiriaki', DYTIKA_EVOLUTIONS.find(([from]) => from === 'monastiriaki')[2]);
  assert.equal(R.evolutionFor(monastiriaki), 'ktimatomesitis');
  // the trainers and the boss show the form that fits the level
  for (const id of DYTIKA_TRAINERS.concat(['plousiakis'])) for (const entry of R.TRAINERS[id].team) {
    const species = R.SPECIES[entry.sp];
    if (species && species.evo) assert.ok(entry.lv < species.evo.lv, id + ': ' + entry.sp + ' at ' + entry.lv + ' would have evolved');
    for (const other of Object.values(R.SPECIES)) if (other.evo && other.evo.to === entry.sp) assert.ok(entry.lv >= other.evo.lv, id + ': ' + entry.sp + ' at ' + entry.lv + ' is below its evolution level');
  }
});
test('Δυτικά items: the Συλλογική Σύμβαση is a heal item between the Δικηγόρος and the Γεμιστά, sold at 150 by the kiosks of Δυτικά only; an old bag gets 0 of it', () => {
  const item = R.ITEMS.sylvasi;
  assert.ok(item.kind === 'heal' && item.amount === 120 && item.price === 150 && !item.cures, 'heals 120, costs 150, cleans no status');
  assert.ok(item.amount > R.ITEMS.dikigoros.amount && item.amount < R.ITEMS.gemista.amount && item.price <= R.ITEMS.dikigoros.price);
  assert.ok(R.ITEM_IDS.includes('sylvasi') && R.STRINGS['item.sylvasi'] && R.STRINGS['itemd.sylvasi']);
  for (const mapId of Object.keys(R.MAPS)) if (R.MAPS[mapId].npcs.some((npc) => npc.kind === 'shop')) {
    assert.equal(R.shopStockOf(R.MAPS[mapId]).includes('sylvasi'), /^(peristeri|chaidari|monastiraki|syntagma)_shop$/.test(mapId), mapId + ': only the kiosks of Δυτικά and Αθήνα sell it (Αθήνα adds nothing new)');
  }
  const mon = R.makeMon('komma', 36);
  mon.hp = 10;
  const missing = R.maxHp(mon) - 10;
  assert.ok(missing > 0 && R.canUseItemOn(mon, 'sylvasi') && R.applyItemToMon(mon, 'sylvasi') === Math.min(120, missing), 'it heals 120 (or what is missing)');
  const big = R.makeMon('despotakis', 60);
  big.hp = 1;
  assert.equal(R.applyItemToMon(big, 'sylvasi'), 120, 'a creature with more than 120 missing HP gets exactly 120');
  mon.hp = R.maxHp(mon);
  assert.ok(!R.canUseItemOn(mon, 'sylvasi'), 'it is not usable on a healthy creature');
  const old = R.migrateSave({ version: 3, player: { name: 'ΝΙΚΟΣ', gender: 'm', map: 'marousi', x: 12, y: 9, dir: 'left' }, party: [{ sp: 'komma', lv: 17, xp: R.xpForLevel(17), hp: 40 }], archive: [], money: 5, bag: { fakelaki: 3 },
    dex: { seen: {}, got: {} }, flags: { gotStarter: true }, lastHeal: R.HOSPITAL_SPOT, options: { lang: 'el', sound: true, textSpeed: 1, reduceMotion: false }, rngState: 1, starter: 'komma' });
  assert.equal(old.bag.sylvasi, 0);
});
test('Δυτικά trainers: seven trainers with names in the strings, levels 34-37, a seeded 1,000-battle replay twice gives equal checksums, the fights are winnable at the intended levels; no rival here', () => {
  assert.equal(DYTIKA_TRAINERS.length, 7);
  const onMaps = {};
  for (const id of ['route9', 'route10', 'chaidari']) for (const npc of R.MAPS[id].npcs) if (npc.kind === 'trainer') onMaps[npc.trainer] = id;
  same(onMaps, { tollclerk: 'route9', ultras: 'route9', granny: 'route9', marketeer: 'route10', philosopher: 'route10', steward: 'route10', gatekeeper: 'chaidari' }, 'three on route 9, three on route 10, one at the monastery door');
  const otherNames = new Set(Object.entries(R.TRAINERS).filter(([id]) => !DYTIKA_TRAINERS.includes(id)).map(([, trainer]) => trainer.name));
  for (const id of DYTIKA_TRAINERS) assert.ok(!otherNames.has(R.TRAINERS[id].name), id + ' has a name of its own');
  for (const id of DYTIKA_TRAINERS) {
    const trainer = R.TRAINERS[id];
    assert.ok(trainer.team.length >= 2 && trainer.team.length <= 3 && !trainer.boss && trainer.boost === undefined, id + ' team');
    for (const entry of trainer.team) assert.ok(entry.lv >= 34 && entry.lv <= 37, id + ' level ' + entry.lv);
    for (const part of ['intro', 'win', 'after']) assert.ok(R.STRINGS['tr.' + id + '.' + part], id + ' ' + part);
    const npc = Object.values(R.MAPS).flatMap((map) => map.npcs).find((entry) => entry.trainer === id);
    assert.ok(npc.sight >= 2 && npc.sight <= 3, id + ' sees ' + npc.sight + ' tiles');
  }
  const members = new Set(DYTIKA_TRAINERS.flatMap((id) => R.TRAINERS[id].team.map((entry) => entry.sp)));
  for (const species of ['giagiaka', 'elegktis', 'ktimatomesitis', 'tavlilordos', 'rousfetolykos', 'monimos', 'fakelarchis']) assert.ok(members.has(species), 'the trainers use ' + species);
  const replay = (seed) => {
    const rng = R.makeRng(seed);
    const lines = [];
    const ids = DYTIKA_TRAINERS.concat(['plousiakis']);
    for (let i = 0; i < 125; i++) {
      for (const id of ids) {
        const team = dytikaTeam(R, rng, 37, 3);
        const result = R.simulateBattle(team, R.buildTrainerTeam(id, 'komma'), rng, { foeItems: R.TRAINERS[id].items });
        lines.push(id + result.winner + ':' + result.turns);
      }
    }
    assert.equal(lines.length, 1000);
    return R.hashString(lines.join('|'));
  };
  assert.equal(replay(41), replay(41));
  assert.notEqual(replay(41), replay(42));
  const winRate = (trainerId, level, size, runsCount) => {
    const rng = R.makeRng(4200 + level + size);
    let wins = 0;
    for (let i = 0; i < runsCount; i++) wins += R.simulateBattle(dytikaTeam(R, rng, level, size), R.buildTrainerTeam(trainerId, 'komma'), rng, { playerItems: [] }).winner === 0 ? 1 : 0;
    return wins / runsCount;
  };
  // a full team of level 37 (the level of the last trainer) wins every trainer fight almost always; three creatures still win more often than not
  for (const id of DYTIKA_TRAINERS) {
    assert.ok(winRate(id, 37, 6, 100) >= 0.9, id + ' with six creatures at level 37');
    assert.ok(winRate(id, 37, 3, 100) >= 0.5, id + ' with three creatures at level 37');
  }
});
test('Δυτικά boss: the win-rate bands of 11.7 (the same offsets and bands as the other bosses) with the AI-played player team, and the boss data', () => {
  const boss = R.TRAINERS.plousiakis;
  same(boss.team.map((entry) => entry.sp + entry.lv), BOSS_TEAM_02E, 'the boss team of 11.15');
  assert.equal(boss.boss, true); assert.equal(boss.bonus, 200);
  assert.equal(boss.look, 'plousiakis');
  assert.equal(R.WORLD.districts.dytika.bossTrainer, 'plousiakis');
  assert.equal(R.WORLD.districts.dytika.badgeFlag, 'badge_dytika');
  assert.equal(boss.victory.flag, 'badge_dytika');
  for (const key of ['win2', 'title', 'sub', 'win3']) assert.ok(R.STRINGS[boss.victory[key]], 'victory text ' + key);
  assert.equal(boss.victory.chapterCard, undefined, 'only the first boss ends a chapter');
  assert.equal(R.STRINGS['badge.dytika.title'][0], 'ΠΑΡΑΣΗΜΟ ΑΦΟΡΟΛΟΓΗΤΟΥ');
  assert.ok(R.STRINGS['tr.plousiakis.intro'][0].includes('{φίλε|φίλη}'), 'the player is addressed with the gender choice');
  assert.ok(R.STRINGS['boss.plousiakis.win3'][0].includes('Αφορολογήτου') && R.STRINGS['boss.plousiakis.win3'][1].includes('Tax-Free Medal'));
  assert.ok(!R.STRINGS['boss.amartia.win3'][0].includes('υπό έργα'), 'the First Row Medal text no longer says the road to the West is shut');
  assert.ok(boss.name === 'Ο Ηγούμενος Πλουσιάκης', 'the invented name of the plan ("Mr Rich")');
  // the money: 38 x 30 + 200 for the boss
  const prize = R.prizeFor({ sides: [{ party: [], active: 0 }, { party: R.buildTrainerTeam('plousiakis', 'komma') }] }, boss);
  assert.equal(prize, 38 * 30 + 200);
  assert.equal(boss.boost, BOSS_BOOST_02E, 'the boost of 11.15 (none when undefined)');
  same(boss.items, BOSS_ITEMS_02E, 'the items in his bag');
  // type fairness of the team is its own test; the bands
  const top = boss.team.reduce((best, entry) => Math.max(best, entry.lv), 0);
  assert.equal(top, 38);
  const twoSouvlaki = ['souvlaki', 'souvlaki'];
  const bands = [];
  for (const [label, offset, size, items, low, high] of bossBands(R, 'plousiakis')) bands.push([label, bossWinRate(R, 'plousiakis', top + offset, size, items === 2 ? twoSouvlaki : [], BOSS_RUNS_PER_CELL, 5000), low, high]);
  for (const [label, rate, low, high] of bands) assert.ok(rate >= low && rate <= high, 'Ο Ηγούμενος Πλουσιάκης, ' + label + ': ' + rate + ' outside ' + low + '-' + high);
});
test('Δυτικά: old saves (v2 and v3, standing anywhere in the four built districts) load and continue; the new flag and the new places migrate; old creatures evolve at their level', () => {
  const party = [{ sp: 'monastiriaki', lv: 36, xp: R.xpForLevel(36), hp: 40 }, { sp: 'giagiaka', lv: 38, xp: R.xpForLevel(38), hp: 30 }, { sp: 'kafenovios', lv: 40, xp: R.xpForLevel(40), hp: 40 }];
  const make = (version, map, x, y, flags, extra) => Object.assign({ version, player: { name: 'ΝΙΚΟΣ', gender: 'm', map, x, y, dir: 'left' }, party, archive: [], money: 555, bag: { fakelaki: 3, gemista: 1 },
    dex: { seen: { komma: true }, got: { komma: true } }, flags, lastHeal: { map: 'marousi_hospital', x: 5, y: 7, dir: 'up' }, options: { lang: 'el', sound: true, textSpeed: 1, reduceMotion: false }, rngState: 99, starter: 'komma' }, extra || {});
  const sampleOf = (rows, mapId) => {
    const found = [];
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === '1' && R.tileWalkable(R.MAPS[mapId], x, y, DYTIKA_FLAGS)) found.push([x, y]);
    return found;
  };
  let count = 0;
  for (const id of OLD_MAP_IDS) for (const [x, y] of sampleOf(OLD_WALKABLE[id].split('/'), id)) {
    for (const version of [2, 3]) {
      const loaded = R.migrateSave(make(version, id, x, y, DYTIKA_FLAGS));
      assert.ok(loaded.player.map === id && loaded.player.x === x && loaded.player.y === y, version + ' ' + id + ' ' + x + ',' + y + ' loads where it stood');
      count++;
    }
  }
  for (const table of [OLD_WALKABLE_02A, OLD_WALKABLE_02B, OLD_WALKABLE_02C, OLD_WALKABLE_02D]) for (const id of Object.keys(table)) for (const [x, y] of sampleOf(table[id].split('/'), id)) {
    const loaded = R.migrateSave(make(3, id, x, y, DYTIKA_FLAGS));
    assert.ok(loaded.player.map === id && loaded.player.x === x && loaded.player.y === y, id + ' ' + x + ',' + y + ' loads where it stood');
    count++;
  }
  assert.ok(count > 6000, 'a lot of positions were loaded: ' + count);
  // the creatures of an old save: Μοναστηριάκι L36, Γιαγιάκα L38 and a Καφενόβιος L40 are evolvable (the game offers it after the next battle), nothing is lost
  const old = R.migrateSave(make(2, 'marousi', 12, 9, DYTIKA_FLAGS));
  assert.equal(old.party[0].sp, 'monastiriaki'); assert.equal(old.party[1].lv, 38);
  assert.equal(R.evolutionFor(R.restoreMon(old.party[0])), 'ktimatomesitis'); assert.equal(R.evolutionFor(R.restoreMon(old.party[1])), 'giagiaexo'); assert.equal(R.evolutionFor(R.restoreMon(old.party[2])), 'tavlilordos');
  assert.equal(old.money, 555); assert.equal(old.bag.gemista, 1); assert.equal(old.bag.sylvasi, 0);
  assert.equal(R.placeState(old.world, 'peristeri'), 'hidden', 'Περιστέρι is told about only when route 9 is walked');
  assert.equal(R.districtState(old.world, 'dytika'), 'open', 'the First Row Medal opens the district');
  // a new save: Δυτικά places, the new badge flag
  const world = R.newWorldState();
  R.worldVisit(world, 'route9', DYTIKA_FLAGS);
  assert.equal(world.routes.route9, 1); assert.equal(R.placeState(world, 'peristeri'), 'seen');
  R.worldVisit(world, 'peristeri_cafe', DYTIKA_FLAGS);
  R.worldVisit(world, 'route10', DYTIKA_FLAGS);
  assert.equal(R.placeState(world, 'chaidari'), 'seen');
  R.worldVisit(world, 'chaidari_boss', Object.assign({ badge_dytika: true }, DYTIKA_FLAGS));
  assert.equal(R.placeState(world, 'peristeri'), 'visited'); assert.equal(R.placeState(world, 'chaidari'), 'visited');
  assert.equal(world.badges.dytika, 1, 'the flag badge_dytika fills the badge');
  assert.equal(R.districtState(world, 'dytika'), 'cleared');
  assert.equal(R.districtState(world, 'athina'), 'open', 'the Tax-Free Medal opens Αθήνα');
  const stored = R.migrateSave(make(3, 'chaidari_hospital', 5, 7, Object.assign({ badge_dytika: true, t_plousiakis: true }, DYTIKA_FLAGS), { world, lastHeal: { map: 'chaidari_hospital', x: 5, y: 7, dir: 'up' } }));
  same(stored.lastHeal, { map: 'chaidari_hospital', x: 5, y: 7, dir: 'up' }, 'the Χαϊδάρι hospital is a valid return point');
  assert.equal(stored.player.map, 'chaidari_hospital');
  assert.equal(stored.flags.badge_dytika, true);
  assert.equal(stored.world.routes.route10, 1);
  same(R.migrateSave(JSON.parse(JSON.stringify(stored))), stored, 'a second load changes nothing');
  const flagOnly = R.migrateSave(make(2, 'marousi', 12, 9, Object.assign({ badge_dytika: true }, DYTIKA_FLAGS)));
  assert.equal(flagOnly.world.badges.dytika, 1);
  // a save from this build stands on a Δυτικά tile that an older build does not know: it falls back to the start, as for every unknown place
  assert.equal(R.migrateSave(make(3, 'atlantis', 3, 3, DYTIKA_FLAGS)).player.map, 'lab');
});
test('Δυτικά leaves Βόρεια as it was: only the west end of the Μαρούσι street changes (1,9 walks on, 0,9 is the gate); every old walkable tile is still walkable', () => {
  for (const id of Object.keys(OLD_WALKABLE_02D)) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE_02D[id].split('/');
    assert.equal(map.h, rows.length, id + ' height'); assert.equal(map.w, rows[0].length, id + ' width');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (rows[y][x] === '1') assert.ok(!R.tileDef(map, x, y).solid, id + ' ' + x + ',' + y + ' was walkable and still must be');
  }
  const nowWalkable = [];
  for (const id of Object.keys(OLD_WALKABLE_02D)) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE_02D[id].split('/');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (rows[y][x] === '0' && !R.tileDef(map, x, y).solid) nowWalkable.push(id + ':' + x + ',' + y);
  }
  same(nowWalkable, ['marousi:0,9', 'marousi:1,9']);
  assert.equal(R.districtState(R.newWorldState(), 'voreia'), 'locked');
});
test('Δυτικά boss path: the victory data of the boss sets only the flag of its own badge; the other flags and the credits flag are not touched', () => {
  const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));
  const victory = part('OverworldLayer.prototype.bossVictory', 'OverworldLayer.prototype.runEvent');
  assert.ok(victory.includes('TRAINERS[trainerId].victory') && victory.includes('G.flags[victory.flag] = true') && !/G\.flags\.(badge|badge_notia|badge_anatolika|badge_voreia|badge_dytika)\b/.test(victory));
  same(R.TRAINERS.plousiakis.victory, { flag: 'badge_dytika', win2: 'boss.plousiakis.win2', title: 'badge.dytika.title', sub: 'badge.dytika.sub', win3: 'boss.plousiakis.win3', ribbon: '#d8a82a' });
  for (const other of ['bougatsas', 'faia', 'amartia']) assert.notEqual(R.TRAINERS.plousiakis.victory.ribbon, R.TRAINERS[other].victory.ribbon, 'each badge has its own ribbon colour');
  assert.notEqual(R.STRINGS['badge.dytika.title'][0], R.STRINGS['badge.voreia.title'][0]);
});
test('Δυτικά: no per-frame work in the new content (the tiles and creature sprites are drawn once into canvases; the texts are cached strings; the shop draws ten rows from the stock list)', () => {
  const tileBuilder = html.slice(html.indexOf('function buildTileSprites()'), html.indexOf('buildHospitalTiles(make);'));
  for (const char of ['*', '+', '-', '/', '<', '|', '@', '`', ')', '(']) assert.ok(tileBuilder.includes("make('" + char + "'"), 'the sprite of tile ' + char + ' is built once in buildTileSprites');
  const cache = html.slice(html.indexOf('function creatureSprite('), html.indexOf('function buildAllSprites()'));
  assert.ok(cache.includes('if (creatureSprites[speciesId]) return creatureSprites[speciesId];'), 'creature sprites are cached after the first draw');
  for (const id of DYTIKA_NEW_SPECIES) assert.ok(new RegExp('^ {2}' + id + ': function \\(p\\) \\{', 'm').test(html.slice(html.indexOf('const creatureDrawers = {'), html.indexOf('const creatureSprites = {}'))), id + ' is drawn by a creatureDrawers entry (run once)');
  const overworldDraw = html.slice(html.indexOf('OverworldLayer.prototype.draw = function'), html.indexOf('OverworldLayer.prototype.drawNpc'));
  assert.ok(!/(peristeri|chaidari|route9|route10|dytika|plousiakis)/i.test(overworldDraw), 'the overworld draw code has no Δυτικά special case');
  const shopDraw = html.slice(html.indexOf('ShopLayer.prototype.draw = function'), html.indexOf('// ---- Evolution and move learning'));
  assert.ok(!shopDraw.includes('measureText') && shopDraw.includes('this.stock.length') && !/sylvasi/.test(shopDraw), 'the shop draw has no special case for the new item and no text measuring per frame');
  const charDraw = html.slice(html.indexOf('function drawCharFrame('), html.indexOf('const charSheets = {}'));
  assert.ok(charDraw.includes('look.slipper'), 'the slipper of the grandmother is a look option drawn into the cached sheet');
});
test('Δυτικά: type fairness named: every type of the boss is hit for x2 by a starter or a creature that is available before him', () => {
  const types = new Set(R.TRAINERS.plousiakis.team.map((entry) => R.SPECIES[entry.sp].t));
  assert.ok(types.has('ekk') && types.has('mem') && types.has('biz'), 'the boss brings Εκκλησία, Memes and Επιχειρηματίες');
  const before = [...R.STARTERS, ...R.districtSpecies('peiraias'), ...R.districtSpecies('notia'), ...R.districtSpecies('anatolika'), ...R.districtSpecies('voreia')].filter((id) => !DYTIKA_NEW_SPECIES.includes(id));
  for (const type of types) assert.ok(before.some((id) => R.typeMultiplier(R.SPECIES[id].t, type) === 2), 'a starter or a creature of the first four districts hits ' + type);
  assert.ok(R.typeMultiplier('asf', 'mem') === 2 && R.typeMultiplier('pol', 'biz') === 2 && R.typeMultiplier('biz', 'ekk') === 2 && R.typeMultiplier('mem', 'ekk') === 2, 'Κουλουράκι (Ασφαλίτες) hits the Memes, Κομματάκι (Πολιτικοί) hits the Επιχειρηματίες, and Φακελάκης (Επιχειρηματίες) or Τρολόσαυρος (Memes) hit the Εκκλησία');
});

// ---- MZ-WORLD-02f: the district Αθήνα ----
const ATHINA_MAP_IDS = ['route11', 'monastiraki', 'monastiraki_hospital', 'monastiraki_shop', 'monastiraki_cafe', 'rock', 'route12', 'lycabettus', 'syntagma', 'syntagma_hospital', 'syntagma_shop'];
const BOSS_TEAM_02F = ['despotakis43', 'lobbylykaina39', 'star9039', 'tavlilordos41', 'despotakis44'];
const BOSS_BOOST_02F = undefined;
const BOSS_ITEMS_02F = ['gemista']; // one Γεμιστά της Μάνας in his bag (11.16)
const ATHINA_FLAGS = Object.assign({ badge_dytika: true }, DYTIKA_FLAGS);
const ATHINA_TRAINERS = ['clerk', 'guide', 'porter', 'student', 'busker', 'rival5', 'inspector', 'cadet'];
// the ten wild creatures of 11.3.6 (all final forms: every earlier evolution is at level 37 or lower, so no pre-form is wild here)
const ATHINA_SPECIES = ['elegktis', 'giagiaexo', 'giotarchis', 'influenza', 'ktimatomesitis', 'lobbylykaina', 'monimos', 'rousfetolykos', 'star90', 'tavlilordos'];
// the walkable tiles (1) and solid tiles (0) of the ten maps of Δυτικά, taken from the base build 31edeb0 (MZ-WORLD-02e)
const OLD_WALKABLE_02E = {
  route9: '00000000000000000000000000000000000000000000/01111111111111111111011111111111111111111110/01101111111111111101101111111111111111111010/00000011100000001110000000000111000000111000/11111111111111111111111111111111111111111111/11111111111111111111110011111111111111111111/11111111111111111111111111111111111111111111/11111111111111111111110011111111111111111111/00000000011100000000011100000000001110000000/01011111111111011111010111111111111111111110/01111111110111111111111101111110111111110110/00000000000000000000000000000000000000000000',
  peristeri: '00000000000000000000000000/01111111111111111111111110/01000001100001100000100000/01000001100001100000100000/01000001100001100000100000/01001000101000100100000000/01111111111111111111111110/01101011111101010101111100/01111111011111111111111010/11111111111111111111111111/00000100000111111111111110/00111111110100000100000000/00011111100100000100000000/00011111100100000100000000/00111111110100000100000000/00000000000101111111111100/00000000000000000000000000/00000000000000000000000000',
  peristeri_hospital: '000000000000/011111111110/000000000000/001110111100/011111111110/001111111100/001101101100/011111111110/000001100000',
  peristeri_shop: '00000000/00011000/00000000/01111110/01111110/00011000',
  peristeri_cafe: '0000000000/0001111100/0000001110/0111111110/0111111110/0100110010/0111111110/0000110000',
  route10: '000000000000000000000000000000000000/011111111111111111111111111111111110/011111111111110111111111111111111110/011111110111111111101111110111111010/011100111100111100111100111100111010/011111111111111111111111111111111110/011111111111111111111111111111111110/111111111111111111111111111111111111/111111111111111111111111111111111111/011111111111111111111111111111111110/010111111111111111111111111111111110/011111111111111111101111111111111110/010111011111111110111111111111011100/000000000000000000000000000000000000/000000000000000000000000000000000000/000000000000000000000000000000000000/000000000000000000000000000000000000/000000000000000000000000000000000000',
  chaidari: '0000000000000000000000000000/0111111111111100000000000000/0100000110000100000000000000/0100000110000100000000000000/0100000110000000000010000000/0100100010100011111111111110/0111111111111110111111101110/0111111111101011101111111010/0111111111110100111111111110/0111111111111111111111111111/0000010000111111111111111110/0000010000100000110000010010/0000010000100000100000010010/0000000000100000110000010010/0000000000100000100000010010/0000000000110111111111101110/0000000000000000000000000000/0000000000000000000000000000',
  chaidari_hospital: '000000000000/011111111110/000000000000/001110111100/011111111110/001111111100/001101101100/011111111110/000001100000',
  chaidari_shop: '00000000/00011000/00000000/01111110/01111110/00011000',
  chaidari_boss: '000000000000/000111111000/011111111110/011100001110/011111111110/011111111110/011111111110/010011110010/011111111110/000001100000',
};
// words that no text of the district may carry: the faith filter of 11.15 (the Rock and the Hill show landmarks generically: no chapel, no cross, no church icon), the real monuments (no real monument name
// on any shop or sign), and the real events and violence that the rules of this district forbid (the junta, the Polytechnic uprising, riots, deaths, real police violence, real fires)
const ATHINA_FORBIDDEN_WORDS = /παρεκκλ|εκκλησ|chapel|church|τζαμ|sinagog|ακροπολ|παρθενών|parthenon|acropolis|λυκαβηττ|lycabettus|χούντα|χουντα|junta|πολυτεχνει|polytechnic|riot|ταραχ|δακρυγόν|tear gas|νεκρ|σκοτώ|killed|violence|βία(?!\p{L})|πυρκαγι|wildfire/u;
const ATHINA_STRING_KEY = /^(map\.(route11|route12|monastiraki|rock|lycabettus|syntagma)|warp\.route11|sign\.(route11|dig|stumps|monastiraki|rock|route12|omonia|avenue|hill|syntagma|chaidari\.west)|npc\.(digger|roadtourist|monastiraki|mncafe|rock|avenue|hill|syntagma)|legend\.|cafe\.hello\.monastiraki|tr\.(clerk|guide|porter|student|busker|rival5|inspector|cadet|baboulas)|boss\.(baboulas|plousiakis\.win3)|badge\.athina|sp\.taxpayer)/;

test('Αθήνα XP band (section 11.4): within W = 10 wild fights, the eight trainers alone give at most 1.3 times the need (and less than the need)', () => {
  const band = xpBand(R, 'athina');
  same(band.trainerIds.slice().sort(), ATHINA_TRAINERS.slice().sort(), 'the eight trainers of route 11, Μοναστηράκι, route 12, the Hill and Σύνταγμα (the boss does not count; the rival is one of them)');
  assert.equal(band.top, 44);
  assert.equal(band.need, 54561, '3 x (xpForLevel(44) - xpForLevel(38))');
  assert.ok(band.wildFights <= 10, 'wild fights still needed: ' + band.wildFights);
  assert.ok(band.trainerShare <= 1.3 && band.trainerShare < 1, 'trainers give ' + band.trainerShare.toFixed(2) + ' of the need');
  assert.ok(band.trainerXp > 0 && band.wildXp > 0);
  assert.ok(R.TRAINERS.baboulas.boss && !band.trainerIds.includes('baboulas'), 'the boss comes after the climb');
});
test('Αθήνα: the road from Χαϊδάρι is shut without the Tax-Free Medal; every new map is reachable, has its way back and no dead end; the way into the Βουλή is a shut door with a sign', () => {
  const start = R.START_MAP;
  const gate = R.MAPS.chaidari.warps.find((warp) => warp.x === 0 && warp.y === 9);
  assert.ok(gate && gate.to === 'route11' && gate.needFlag === 'badge_dytika' && R.STRINGS[gate.lockedText], 'the gate at the west end of the street needs the flag badge_dytika and says why');
  assert.ok(!R.tileDef(R.MAPS.chaidari, 0, 9).solid && !R.tileDef(R.MAPS.chaidari, 1, 9).solid, 'the street walks on to the edge');
  assert.ok(R.tileDef(R.MAPS.chaidari, 0, 8).solid && R.MAPS.chaidari.signs['0,8'] === 'sign.chaidari.west' && R.STRINGS['sign.chaidari.west'], 'the sign stands beside the gate');
  assert.ok(!/(works|έργα)/i.test(R.STRINGS['sign.chaidari.west'].join(' ')), 'the sign no longer says that the road is under works');
  const without = R.reachableTiles(start.map, start.x, start.y, DYTIKA_FLAGS);
  for (const id of ATHINA_MAP_IDS) assert.ok(![...without].some((key) => key.startsWith(id + ':')), id + ' is not reachable without the Tax-Free Medal');
  const shutOnChaidari = R.reachableTiles('chaidari', 26, 9, DYTIKA_FLAGS); // standing in Χαϊδάρι with the badge flag missing (a damaged save)
  assert.ok(shutOnChaidari.has('chaidari:1:9') && !shutOnChaidari.has('chaidari:0:9') && !shutOnChaidari.has('route11:1:6'), 'the gate tile is shut without the badge flag');
  const all = R.reachableTiles(start.map, start.x, start.y, ATHINA_FLAGS);
  for (const key of ['chaidari:0:9', 'route11:1:6', 'route11:34:6', 'monastiraki:1:9', 'monastiraki:24:9', 'route12:1:8', 'route12:38:8', 'syntagma:1:10', 'rock:10:14', 'rock:9:6', 'lycabettus:10:14', 'lycabettus:10:4']) assert.ok(all.has(key), key + ' is reachable through the gate and along both routes');
  for (const id of ATHINA_MAP_IDS) {
    const map = R.MAPS[id];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (/_(hospital|shop)$/.test(id) && y === 1) continue; // behind the counter, as in the templates of New Piraeus
      if (!R.tileDef(map, x, y).solid && !R.npcAtTile(map, x, y, ATHINA_FLAGS)) assert.ok(all.has(id + ':' + x + ':' + y), id + ' walkable tile ' + x + ',' + y + ' is cut off');
    }
    for (const warp of map.warps) {
      assert.ok(R.MAPS[warp.to].warps.some((back) => back.to === id), id + ' -> ' + warp.to + ' has a return warp');
      assert.ok(R.tileWalkable(R.MAPS[warp.to], warp.tx, warp.ty, ATHINA_FLAGS), id + ' -> ' + warp.to + ' arrives on a walkable tile');
      assert.ok(all.has(id + ':' + warp.x + ':' + warp.y), id + ' warp ' + warp.x + ',' + warp.y + ' is reachable');
    }
    for (const npc of map.npcs) assert.ok(R.npcTalkable(id, npc, all), id + ':' + npc.id + ' can be talked to');
    for (const key of Object.keys(map.signs)) {
      const [sx, sy] = key.split(',').map(Number);
      assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => all.has(id + ':' + (sx + dx) + ':' + (sy + dy))), id + ' sign ' + key + ' can be read');
      assert.ok(R.tileDef(map, sx, sy).solid, id + ' sign ' + key + ' stands on a solid tile');
    }
  }
  // no dead end: from the arrival tile of each new map the player reaches exactly what is reachable from the start
  for (const [mapId, x, y] of [['route11', 1, 6], ['monastiraki', 1, 9], ['route12', 1, 8], ['syntagma', 1, 10], ['rock', 10, 14], ['lycabettus', 10, 14], ['monastiraki_cafe', 4, 6]]) {
    assert.equal(R.reachableTiles(mapId, x, y, ATHINA_FLAGS).size, all.size, 'from ' + mapId + ' everything can be reached again');
  }
  // the boss stands in the middle of the square and can be talked to; the door of the parliament is a solid tile with a sign beside it and no warp (MZ-WORLD-02g)
  assert.ok(R.npcTalkable('syntagma', R.MAPS.syntagma.npcs.find((npc) => npc.id === 'baboulas'), all));
  assert.ok(R.tileDef(R.MAPS.syntagma, 14, 4).solid && !R.MAPS.syntagma.warps.some((warp) => warp.x === 14 && warp.y === 4), 'the door of the parliament is shut');
  assert.equal(R.MAPS.syntagma.signs['11,5'], 'sign.syntagma.parliament');
  assert.ok(!R.MAPS.syntagma.warps.some((warp) => warp.to === 'parliament'), 'no way into the Βουλή yet');
});
test('Αθήνα data: sizes of 11.7, places on the world map, rows, tiles, wild tables with the species of 11.3.6, two towns with hospital, kiosk and ΚΤΕΛ stop, the café of Μοναστηράκι, the Rock and the Hill', () => {
  const sizes = { route11: [36, 14], monastiraki: [26, 18], monastiraki_hospital: [12, 9], monastiraki_shop: [8, 6], monastiraki_cafe: [10, 8], rock: [20, 16], route12: [40, 16], lycabettus: [20, 16], syntagma: [30, 20], syntagma_hospital: [12, 9], syntagma_shop: [8, 6] };
  for (const id of ATHINA_MAP_IDS) {
    const map = R.MAPS[id];
    same([map.w, map.h], sizes[id], id + ' size');
    assert.equal(map.rows.length, map.h);
    for (const row of map.rows) { assert.equal(row.length, map.w, id + ' width'); for (const char of row) assert.ok(R.TILE_DEFS[char], id + ' tile ' + char); }
    assert.ok(R.mapNode(id) && R.mapNode(id).district === 'athina', id + ' belongs to a place of Αθήνα');
    assert.ok(R.STRINGS[map.name], id + ' name');
  }
  assert.equal(ATHINA_MAP_IDS.reduce((sum, id) => sum + R.MAPS[id].w * R.MAPS[id].h, 0), 36 * 14 + 26 * 18 + 12 * 9 * 2 + 8 * 6 * 2 + 10 * 8 + 20 * 16 + 40 * 16 + 20 * 16 + 30 * 20, 'the tiles of the build plan (3,244)');
  same([W.districts.athina.built, W.nodes.monastiraki.built, W.nodes.syntagma.built, W.routes.route11.built, W.routes.route12.built, W.nodes.monastiraki.stop, W.nodes.syntagma.stop], [true, true, true, true, true, true, true]);
  assert.equal(W.nodes.parliament.built, false, 'the Βουλή stays a locked door (MZ-WORLD-02g)');
  same([R.mapNode('monastiraki_cafe').id, R.mapNode('rock').id, R.mapNode('syntagma_shop').id, R.mapNode('lycabettus').id, R.mapNode('route11').id, R.mapNode('route12').id], ['monastiraki', 'monastiraki', 'syntagma', 'syntagma', 'route11', 'route12']);
  // both routes run left to right (11.5)
  assert.equal(W.routes.route11.progress, 'x'); assert.equal(W.routes.route12.progress, 'x');
  // wild tables: the ten species of 11.3.6 at the levels of 11.4 (R11 38-41, R12 40-43); every one of them is a final form, so no pre-form is wild here
  const range = { route11: [38, 41], route12: [40, 43], lycabettus: [40, 43] };
  const allowed = { route11: ['elegktis', 'giagiaexo', 'lobbylykaina', 'monimos', 'rousfetolykos', 'star90', 'tavlilordos'], route12: ATHINA_SPECIES, lycabettus: ['giotarchis', 'influenza', 'ktimatomesitis', 'lobbylykaina', 'rousfetolykos', 'star90'] };
  for (const mapId of Object.keys(range)) {
    const used = new Set();
    for (const zone of R.MAPS[mapId].zones) for (const entry of zone.table) {
      used.add(entry.sp);
      assert.ok(entry.min >= range[mapId][0] && entry.max <= range[mapId][1] && entry.min <= entry.max, mapId + ' ' + entry.sp + ' levels');
      for (const species of Object.values(R.SPECIES)) if (species.evo && species.evo.to === entry.sp) assert.ok(entry.min >= species.evo.lv, entry.sp + ' appears only from its evolution level');
      assert.ok(!R.SPECIES[entry.sp].evo, entry.sp + ' is a final form (a wild creature of this level has evolved)');
    }
    same([...used].sort(), allowed[mapId].slice().sort(), mapId + ' species');
  }
  assert.equal(Math.min(...R.MAPS.route11.zones.flatMap((zone) => zone.table.map((entry) => entry.min))), 38);
  assert.equal(Math.max(...R.MAPS.route12.zones.flatMap((zone) => zone.table.map((entry) => entry.max))), 43);
  const rare = R.MAPS.route12.zones.map((zone) => zone.table.find((entry) => entry.sp === 'ktimatomesitis').w);
  assert.ok(rare.every((weight) => weight <= 6), 'Κτηματομεσίτης is the rare one (11.3.6)');
  same(R.districtSpecies('athina').sort(), ATHINA_SPECIES);
  assert.ok(!R.districtSpecies('athina').includes('taxpayer'), 'the legend is not wild');
  // each town: a hospital that heals (return point), a kiosk with the ten items, a ΚΤΕΛ stop tile; Μοναστηράκι the first Καφενείο, Σύνταγμα the boss in the open square
  for (const [town, buildings] of [['monastiraki', ['monastiraki_hospital', 'monastiraki_shop', 'monastiraki_cafe']], ['syntagma', ['syntagma_hospital', 'syntagma_shop']]]) {
    assert.ok(R.MAPS[town].rows.join('').includes('U'), town + ' has its ΚΤΕΛ stop');
    assert.equal(R.MAPS[town].warps.filter((warp) => buildings.includes(warp.to)).length, buildings.length, town + ' has its doors');
    const hospital = R.MAPS[town + '_hospital'];
    assert.ok(hospital.npcs.some((npc) => npc.kind === 'heal') && hospital.actions['1,3'] === 'archive' && !R.tileDef(hospital, R.HOSPITAL_SPOT.x, R.HOSPITAL_SPOT.y).solid, town + ' hospital heals and has the archive terminal');
    assert.ok(R.MAPS[town + '_shop'].npcs.some((npc) => npc.kind === 'shop'));
    same(R.shopStockOf(R.MAPS[town + '_shop']), R.SHOP_STOCK_DYTIKA, town + ' kiosk sells the ten items (nothing new in Αθήνα)');
  }
  assert.ok(R.MAPS.monastiraki_cafe.npcs.some((npc) => npc.kind === 'save') && R.STRINGS[R.MAPS.monastiraki_cafe.cafeHello], 'the first Καφενείο of Αθήνα saves, with its own greeting');
  assert.ok(!R.MAPS.syntagma.npcs.some((npc) => npc.kind === 'save') && !R.MAPS.syntagma_hospital.npcs.some((npc) => npc.kind === 'save'), 'only the first town has the café');
  const boss = R.MAPS.syntagma.npcs.find((npc) => npc.kind === 'boss');
  assert.ok(boss && boss.trainer === 'baboulas' && boss.x >= 10 && boss.x <= 20 && boss.y >= 6 && boss.y <= 12, 'the boss stands in the middle of the square');
  // the decor: six new tiles with sprites; no cross and no religious icon is drawn (the Hill has a viewpoint and a closed station, no chapel)
  const decor = ['"', '$', '[', ']', '{', '}'];
  for (const char of decor) assert.ok(R.TILE_DEFS[char] && html.includes("make('" + char + "'"), 'a sprite for tile ' + char);
  assert.equal(R.TILE_DEFS['"'].solid, false);
  for (const char of ['$', '[', ']', '{', '}']) assert.equal(R.TILE_DEFS[char].solid, true, char + ' is solid');
  assert.ok(!R.TILE_DEFS['"'].grass, 'the old paving has no wild encounters');
  const mapRows = (id) => R.MAPS[id].rows.join('');
  assert.ok(mapRows('route11').includes('"') && mapRows('route11').includes('$') && mapRows('route11').includes('['), 'route 11: ancient paving, column stumps, closed digs');
  assert.ok(mapRows('monastiraki').includes('/') && mapRows('monastiraki').includes('}') && mapRows('monastiraki').includes('&'), 'Μοναστηράκι: market stalls, the clock tower, the marble steps up to the Rock');
  assert.ok(mapRows('rock').includes('_') && mapRows('rock').includes('$') && mapRows('rock').includes('K'), 'the Rock: scaffolding, columns, the ticket booth');
  assert.ok(mapRows('route12').includes(']') && mapRows('route12').includes('7') && mapRows('route12').includes('>'), 'route 12: neoclassical fronts, the fountain of the plaza, shop windows');
  assert.ok(mapRows('syntagma').includes('{') && mapRows('syntagma').includes(']') && mapRows('syntagma').includes('j') && mapRows('syntagma').includes('7'), 'Σύνταγμα: police vans, the parliament front, the closed metro entrance, the fountain');
  assert.ok(!/[†✝☦]/.test(ATHINA_MAP_IDS.map((id) => R.MAPS[id].rows.join('')).join('')), 'no cross character in any map');
  for (const id of ATHINA_MAP_IDS) for (const key of Object.keys(R.MAPS[id].signs)) assert.ok(R.STRINGS[R.MAPS[id].signs[key]], id + ' sign ' + key + ' has a text');
  // no text of the district carries a forbidden word (faith, real monuments, real events and violence), and every key of the district was read
  let checked = 0;
  for (const [key, texts] of Object.entries(R.STRINGS)) {
    if (!ATHINA_STRING_KEY.test(key)) continue;
    for (const text of texts.slice(0, 2)) { assert.ok(!FAITH_WORDS.test(plainText(text)) && !ATHINA_FORBIDDEN_WORDS.test(plainText(text)), key + ' carries a forbidden word: ' + text); checked++; }
  }
  assert.ok(checked > 180, 'the word checks read ' + checked + ' texts');
  for (const id of ATHINA_TRAINERS.concat(['baboulas'])) assert.ok(!FAITH_WORDS.test(plainText(R.TRAINERS[id].name)) && !ATHINA_FORBIDDEN_WORDS.test(plainText(R.TRAINERS[id].name)), id + ' name');
  for (const key of ['map.monastiraki.shop', 'map.syntagma.shop', 'map.monastiraki.cafe']) for (const text of R.STRINGS[key].slice(0, 2)) assert.ok(!/(ακροπολ|παρθενών|acropolis|parthenon|βράχος|rock)/.test(plainText(text)), key + ': no real monument name on a shop');
});
test('Αθήνα legend: the Φορολογούμενος is a single recruitable creature met on the Rock at level 40 (a fixed encounter), gone once beaten or recruited, and a fair fight for a level 40 team', () => {
  const species = R.SPECIES.taxpayer;
  assert.ok(species.t === 'mem' && species.ab === 'out' && species.g === 'm' && !species.evo && !species.starter && !species.parody, 'type, ability, gender, no evolution');
  assert.ok(species.base.length === 6 && species.base.reduce((a, b) => a + b, 0) > 600 && species.xp >= 100 && species.rec > 0 && species.rec <= 10, 'a legend: strong, a lot of XP, a very low recruit rate');
  assert.ok(species.learn.every(([lv, moveId]) => R.MOVES[moveId] && lv >= 1) && R.movesAtLevel('taxpayer', 40).length === 4 && R.movesAtLevel('taxpayer', 40).every((moveId) => R.MOVES[moveId].t === 'mem'), 'four moves, all of its own type');
  assert.ok(R.DEX_ORDER.includes('taxpayer') && R.STRINGS['sp.taxpayer'][0].startsWith('Γνωστ') && R.STRINGS['sp.taxpayer'][0].includes('Ποτέ δεν καταδικάστηκε') && R.STRINGS['sp.taxpayer'][1].includes('Never convicted'), 'dossier text');
  assert.ok(R.STRINGS['sp.taxpayer'][0].length > 0 && R.STRINGS['sp.taxpayer'][1].includes('The Last Taxpayer'), 'the full name of the legend is in the dossier text');
  assert.ok(new RegExp('^ {2}taxpayer: function \\(p\\)', 'm').test(html), 'the legend has a procedural sprite');
  assert.ok(species.n.length <= 16, 'the name is short enough for the battle name panel (the full name does not fit: 11.16)');
  const npcs = Object.values(R.MAPS).flatMap((map) => map.npcs.filter((npc) => npc.kind === 'legend'));
  assert.equal(npcs.length, 1, 'one legend in the game so far');
  const legend = R.MAPS.rock.npcs.find((npc) => npc.kind === 'legend');
  assert.ok(legend && legend.species === 'taxpayer' && legend.level === 40 && legend.hideFlag === 'legend_taxpayer', 'on the Rock, level 40, hidden by the flag legend_taxpayer');
  assert.ok(legend.x >= 5 && legend.x <= 14 && legend.y >= 4 && legend.y <= 6, 'on the top terrace in front of the monument');
  assert.equal(R.npcVisible(legend, {}), true); assert.equal(R.npcVisible(legend, { legend_taxpayer: true }), false, 'it is gone once the flag is set');
  assert.ok(R.STRINGS['legend.taxpayer.intro'] && R.STRINGS['legend.taxpayer.gone'], 'its two texts');
  for (const map of Object.values(R.MAPS)) for (const zone of map.zones || []) for (const entry of zone.table) assert.notEqual(entry.sp, 'taxpayer', 'it is in no wild table');
  // the way the game handles it: the talk starts a wild battle against that one creature, and only a win sets the flag (running away or losing leaves it standing; no random roll)
  const method = html.slice(html.indexOf('OverworldLayer.prototype.legendEncounter = async function'), html.indexOf('OverworldLayer.prototype.challenge = async function'));
  assert.ok(method.includes("kind: 'wild'") && method.includes('makeMon(def.species, def.level)') && method.includes("if (result !== 'win') return;") && method.indexOf("if (result !== 'win') return;") < method.indexOf('G.flags[def.hideFlag] = true'), 'a won fight sets the flag, nothing else does');
  assert.ok(!method.includes('rng'), 'no random roll');
  assert.ok(html.includes("else if (def.kind === 'legend') await this.legendEncounter(npc);"), 'talking to the legend starts the encounter');
  // a fair fight: a team of six at level 40 beats it most of the time, three creatures less often, and it is not a pushover
  const rate = (size, level, seed) => {
    const rng = R.makeRng(seed);
    let wins = 0;
    for (let i = 0; i < 200; i++) wins += R.simulateBattle(athinaTeam(R, rng, level, size), [R.makeMon('taxpayer', 40)], rng, { playerItems: [] }).winner === 0 ? 1 : 0;
    return wins / 200;
  };
  const six = rate(6, 40, 6100);
  const three = rate(3, 40, 6200);
  assert.ok(six >= 0.45 && six <= 0.9, 'six creatures at level 40 beat the legend ' + six);
  assert.ok(three >= 0.15 && three < six, 'three creatures at level 40 beat the legend ' + three);
  assert.ok(rate(6, 44, 6300) > six, 'a stronger team beats it more often');
  const recruitHard = R.recruitChance(R.makeMon('taxpayer', 40), 'chontros');
  assert.ok(recruitHard > 0 && recruitHard < R.recruitChance(R.makeMon('star90', 40), 'chontros'), 'it is harder to recruit than an ordinary creature');
});
test('Αθήνα items: the kiosks sell the ten items of Δυτικά and nothing new; the prize money of the district is far above the stock', () => {
  same(R.SHOP_STOCK_DYTIKA.length, 10);
  for (const mapId of ['monastiraki_shop', 'syntagma_shop']) same(R.shopStockOf(R.MAPS[mapId]), R.SHOP_STOCK_DYTIKA, mapId);
  same(DISTRICT_NEW_ITEMS.athina, []);
  assert.equal(R.ITEM_IDS.length, 10, 'no new item in Αθήνα');
});
test('Αθήνα trainers: eight trainers with names in the strings, levels 39-42 (the rival: 42, the boss top level minus 2), a seeded 1,000-battle replay twice gives equal checksums, the fights are winnable at the intended levels', () => {
  assert.equal(ATHINA_TRAINERS.length, 8);
  const onMaps = {};
  for (const id of ['route11', 'monastiraki', 'route12', 'lycabettus', 'syntagma']) for (const npc of R.MAPS[id].npcs) if (npc.kind === 'trainer') onMaps[npc.trainer] = id;
  same(onMaps, { clerk: 'route11', guide: 'route11', porter: 'monastiraki', student: 'route12', busker: 'route12', rival5: 'route12', inspector: 'lycabettus', cadet: 'syntagma' }, 'two on route 11, one in Μοναστηράκι, three on route 12 (the rival among them), one on the Hill, one on the square');
  const otherNames = new Set(Object.entries(R.TRAINERS).filter(([id]) => !ATHINA_TRAINERS.includes(id) && id !== 'baboulas' && !/^rival/.test(id)).map(([, trainer]) => trainer.name));
  for (const id of ATHINA_TRAINERS.filter((id) => id !== 'rival5')) assert.ok(!otherNames.has(R.TRAINERS[id].name), id + ' has a name of its own');
  for (const id of ATHINA_TRAINERS) {
    const trainer = R.TRAINERS[id];
    assert.ok(trainer.team.length >= 2 && trainer.team.length <= 3 && !trainer.boss && trainer.boost === undefined, id + ' team');
    for (const entry of trainer.team) assert.ok(entry.lv >= 39 && entry.lv <= 42, id + ' level ' + entry.lv);
    for (const part of ['intro', 'win', 'after']) assert.ok(R.STRINGS['tr.' + id + '.' + part], id + ' ' + part);
    const npc = Object.values(R.MAPS).flatMap((map) => map.npcs).find((entry) => entry.trainer === id);
    assert.ok(npc.sight >= 2 && npc.sight <= 3, id + ' sees ' + npc.sight + ' tiles');
  }
  const members = new Set(ATHINA_TRAINERS.flatMap((id) => R.TRAINERS[id].team.map((entry) => entry.sp)));
  for (const species of ['monimos', 'elegktis', 'star90', 'giagiaexo', 'tavlilordos', 'influenza', 'lobbylykaina', 'giotarchis', 'matanthropos']) assert.ok(members.has(species), 'the trainers use ' + species);
  // the rival: his fifth fight is the boss' top level minus 2 with the middle form of his starter (the last forms are the Βουλή's), a Σουβλάκι in the bag; he leaves after it
  const topLevel = R.TRAINERS.baboulas.team[R.TRAINERS.baboulas.team.length - 1].lv;
  const rivalTeam = R.TRAINERS.rival5.team;
  assert.equal(rivalTeam[rivalTeam.length - 1].lv, topLevel - 2, 'the rival: the boss top level minus 2');
  for (const starter of R.STARTERS) {
    const team = R.buildTrainerTeam('rival5', starter);
    assert.equal(team[team.length - 1].sp, R.SPECIES[R.RIVAL_STARTER[starter]].evo.to, 'his last creature is the middle form of the starter he took');
  }
  same(R.TRAINERS.rival5.items, ['souvlaki']);
  assert.equal(R.npcVisible({ kind: 'trainer', trainer: 'rival5' }, {}), true);
  assert.equal(R.npcVisible({ kind: 'trainer', trainer: 'rival5' }, { t_rival5: true }), false, 'he leaves after the fifth fight');
  const replay = (seed) => {
    const rng = R.makeRng(seed);
    const lines = [];
    const ids = ATHINA_TRAINERS.concat(['baboulas']);
    for (let i = 0; i < 111; i++) {
      for (const id of ids) {
        const team = athinaTeam(R, rng, 42, 3);
        const result = R.simulateBattle(team, R.buildTrainerTeam(id, 'komma'), rng, { foeItems: R.TRAINERS[id].items });
        lines.push(id + result.winner + ':' + result.turns);
      }
    }
    assert.equal(lines.length, 999);
    lines.push('end');
    return R.hashString(lines.join('|'));
  };
  assert.equal(replay(51), replay(51));
  assert.notEqual(replay(51), replay(52));
  const winRate = (trainerId, level, size, runsCount) => {
    const rng = R.makeRng(5200 + level + size);
    let wins = 0;
    for (let i = 0; i < runsCount; i++) wins += R.simulateBattle(athinaTeam(R, rng, level, size), R.buildTrainerTeam(trainerId, 'komma'), rng, { playerItems: [] }).winner === 0 ? 1 : 0;
    return wins / runsCount;
  };
  // a full team of level 42 (the level of the last trainer) wins every trainer fight almost always; three creatures still win more often than not
  for (const id of ATHINA_TRAINERS) {
    assert.ok(winRate(id, 42, 6, 100) >= 0.9, id + ' with six creatures at level 42');
    assert.ok(winRate(id, 42, 3, 100) >= 0.5, id + ' with three creatures at level 42');
  }
});
test('Αθήνα boss: the win-rate bands of 11.7 (the same offsets and bands as the other bosses) with the AI-played player team, and the boss data', () => {
  const boss = R.TRAINERS.baboulas;
  same(boss.team.map((entry) => entry.sp + entry.lv), BOSS_TEAM_02F, 'the boss team of 11.16');
  assert.equal(boss.boss, true); assert.equal(boss.bonus, 200);
  assert.equal(boss.look, 'baboulas');
  assert.equal(R.WORLD.districts.athina.bossTrainer, 'baboulas');
  assert.equal(R.WORLD.districts.athina.badgeFlag, 'badge_athina');
  assert.equal(boss.victory.flag, 'badge_athina');
  for (const key of ['win2', 'title', 'sub', 'win3']) assert.ok(R.STRINGS[boss.victory[key]], 'victory text ' + key);
  assert.equal(boss.victory.chapterCard, undefined, 'only the first boss ends a chapter');
  assert.equal(R.STRINGS['badge.athina.title'][0], 'ΠΑΡΑΣΗΜΟ ΣΥΓΚΕΝΤΡΩΣΗΣ');
  assert.ok(R.STRINGS['tr.baboulas.intro'][0].includes('{φίλε|φίλη}'), 'the player is addressed with the gender choice');
  assert.ok(R.STRINGS['boss.baboulas.win3'][0].includes('Συγκέντρωσης') && R.STRINGS['boss.baboulas.win3'][1].includes('Assembly Medal'));
  assert.ok(!R.STRINGS['boss.plousiakis.win3'][0].includes('υπό έργα') && !R.STRINGS['boss.plousiakis.win3'][1].includes('under works'), 'the Tax-Free Medal text no longer says the road to Αθήνα is shut');
  assert.equal(boss.name, 'Ο Ταξίαρχος Μπαμπούλας');
  assert.equal(R.TRAINERS.plousiakis.victory.ribbon !== boss.victory.ribbon, true);
  // the money: 44 x 30 + 200 for the boss
  const prize = R.prizeFor({ sides: [{ party: [], active: 0 }, { party: R.buildTrainerTeam('baboulas', 'komma') }] }, boss);
  assert.equal(prize, 44 * 30 + 200);
  assert.equal(boss.boost, BOSS_BOOST_02F, 'the boost of 11.16 (none when undefined)');
  same(boss.items, BOSS_ITEMS_02F, 'the items in his bag');
  // the bands, seeded
  const top = boss.team.reduce((best, entry) => Math.max(best, entry.lv), 0);
  assert.equal(top, 44);
  const twoSouvlaki = ['souvlaki', 'souvlaki'];
  const bands = [];
  for (const [label, offset, size, items, low, high] of bossBands(R, 'baboulas')) bands.push([label, bossWinRate(R, 'baboulas', top + offset, size, items === 2 ? twoSouvlaki : [], BOSS_RUNS_PER_CELL, 5000), low, high]);
  for (const [label, rate, low, high] of bands) assert.ok(rate >= low && rate <= high, 'Ο Ταξίαρχος Μπαμπούλας, ' + label + ': ' + rate + ' outside ' + low + '-' + high);
  assert.equal(bossBands(R, 'baboulas')[3][1], 0, 'a boss with four or more creatures has its three-creature row at offset 0');
  assert.equal(bossBands(R, 'baboulas')[2][1], -5, 'a boss of level 44 or more has its lowest row at top minus 5 (11.16)');
  for (const earlier of ['bougatsas', 'faia', 'amartia', 'plousiakis']) assert.equal(bossBands(R, earlier)[2][1], -3, earlier + ' keeps top minus 3');
});
test('Αθήνα: old saves (v2 and v3, standing anywhere in the five built districts) load and continue; the new flags and places migrate; the old creatures are untouched', () => {
  const party = [{ sp: 'ktimatomesitis', lv: 40, xp: R.xpForLevel(40), hp: 40 }, { sp: 'giagiaexo', lv: 41, xp: R.xpForLevel(41), hp: 30 }, { sp: 'tavlilordos', lv: 42, xp: R.xpForLevel(42), hp: 40 }];
  const make = (version, map, x, y, flags, extra) => Object.assign({ version, player: { name: 'ΝΙΚΟΣ', gender: 'm', map, x, y, dir: 'left' }, party, archive: [], money: 555, bag: { fakelaki: 3, gemista: 1, sylvasi: 2 },
    dex: { seen: { komma: true }, got: { komma: true } }, flags, lastHeal: { map: 'chaidari_hospital', x: 5, y: 7, dir: 'up' }, options: { lang: 'el', sound: true, textSpeed: 1, reduceMotion: false }, rngState: 99, starter: 'komma' }, extra || {});
  const sampleOf = (rows, mapId) => {
    const found = [];
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === '1' && R.tileWalkable(R.MAPS[mapId], x, y, ATHINA_FLAGS)) found.push([x, y]);
    return found;
  };
  let count = 0;
  for (const id of OLD_MAP_IDS) for (const [x, y] of sampleOf(OLD_WALKABLE[id].split('/'), id)) {
    for (const version of [2, 3]) {
      const loaded = R.migrateSave(make(version, id, x, y, ATHINA_FLAGS));
      assert.ok(loaded.player.map === id && loaded.player.x === x && loaded.player.y === y, version + ' ' + id + ' ' + x + ',' + y + ' loads where it stood');
      count++;
    }
  }
  for (const table of [OLD_WALKABLE_02A, OLD_WALKABLE_02B, OLD_WALKABLE_02C, OLD_WALKABLE_02D, OLD_WALKABLE_02E]) for (const id of Object.keys(table)) for (const [x, y] of sampleOf(table[id].split('/'), id)) {
    const loaded = R.migrateSave(make(3, id, x, y, ATHINA_FLAGS));
    assert.ok(loaded.player.map === id && loaded.player.x === x && loaded.player.y === y, id + ' ' + x + ',' + y + ' loads where it stood');
    count++;
  }
  assert.ok(count > 7500, 'a lot of positions were loaded: ' + count);
  const old = R.migrateSave(make(2, 'chaidari', 12, 9, ATHINA_FLAGS));
  assert.equal(old.party[0].sp, 'ktimatomesitis'); assert.equal(old.party[1].lv, 41);
  assert.equal(old.money, 555); assert.equal(old.bag.gemista, 1); assert.equal(old.bag.sylvasi, 2);
  assert.equal(R.placeState(old.world, 'monastiraki'), 'hidden', 'Μοναστηράκι is told about only when route 11 is walked');
  assert.equal(R.districtState(old.world, 'athina'), 'open', 'the Tax-Free Medal opens the district');
  // a new save: Αθήνα places, the new badge flag
  const world = R.newWorldState();
  R.worldVisit(world, 'route11', ATHINA_FLAGS);
  assert.equal(world.routes.route11, 1); assert.equal(R.placeState(world, 'monastiraki'), 'seen');
  R.worldVisit(world, 'monastiraki_cafe', ATHINA_FLAGS);
  R.worldVisit(world, 'rock', ATHINA_FLAGS);
  R.worldVisit(world, 'route12', ATHINA_FLAGS);
  assert.equal(R.placeState(world, 'syntagma'), 'seen');
  R.worldVisit(world, 'lycabettus', Object.assign({ badge_athina: true }, ATHINA_FLAGS));
  assert.equal(R.placeState(world, 'monastiraki'), 'visited'); assert.equal(R.placeState(world, 'syntagma'), 'visited', 'the Hill belongs to Σύνταγμα');
  assert.equal(world.badges.athina, 1, 'the flag badge_athina fills the badge');
  assert.equal(R.districtState(world, 'athina'), 'cleared');
  assert.equal(R.placeState(world, 'parliament'), 'unknown', 'the Βουλή is still a question mark');
  const stored = R.migrateSave(make(3, 'syntagma_hospital', 5, 7, Object.assign({ badge_athina: true, t_baboulas: true, legend_taxpayer: true }, ATHINA_FLAGS), { world, lastHeal: { map: 'syntagma_hospital', x: 5, y: 7, dir: 'up' } }));
  same(stored.lastHeal, { map: 'syntagma_hospital', x: 5, y: 7, dir: 'up' }, 'the Σύνταγμα hospital is a valid return point');
  assert.equal(stored.player.map, 'syntagma_hospital');
  assert.equal(stored.flags.badge_athina, true); assert.equal(stored.flags.legend_taxpayer, true);
  assert.equal(stored.world.routes.route11, 1);
  same(R.migrateSave(JSON.parse(JSON.stringify(stored))), stored, 'a second load changes nothing');
  const flagOnly = R.migrateSave(make(2, 'chaidari', 12, 9, Object.assign({ badge_athina: true }, ATHINA_FLAGS)));
  assert.equal(flagOnly.world.badges.athina, 1);
  // a save from this build stands on an Αθήνα tile that an older build does not know: it falls back to the start, as for every unknown place
  assert.equal(R.migrateSave(make(3, 'atlantis', 3, 3, ATHINA_FLAGS)).player.map, 'lab');
});
test('Αθήνα leaves Δυτικά as it was: only the west end of the Χαϊδάρι street changes (0,9 is the gate); every old walkable tile is still walkable', () => {
  for (const id of Object.keys(OLD_WALKABLE_02E)) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE_02E[id].split('/');
    assert.equal(map.h, rows.length, id + ' height'); assert.equal(map.w, rows[0].length, id + ' width');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (rows[y][x] === '1') assert.ok(!R.tileDef(map, x, y).solid, id + ' ' + x + ',' + y + ' was walkable and still must be');
  }
  const nowWalkable = [];
  for (const id of Object.keys(OLD_WALKABLE_02E)) {
    const map = R.MAPS[id];
    const rows = OLD_WALKABLE_02E[id].split('/');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (rows[y][x] === '0' && !R.tileDef(map, x, y).solid) nowWalkable.push(id + ':' + x + ',' + y);
  }
  same(nowWalkable, ['chaidari:0,9']);
  assert.equal(R.districtState(R.newWorldState(), 'athina'), 'locked');
});
test('Αθήνα boss path: the victory data of the boss sets only the flag of its own badge; the other flags and the credits flag are not touched', () => {
  const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));
  const victory = part('OverworldLayer.prototype.bossVictory', 'OverworldLayer.prototype.runEvent');
  assert.ok(victory.includes('TRAINERS[trainerId].victory') && victory.includes('G.flags[victory.flag] = true') && !/G\.flags\.(badge|badge_notia|badge_anatolika|badge_voreia|badge_dytika|badge_athina)\b/.test(victory));
  same(R.TRAINERS.baboulas.victory, { flag: 'badge_athina', win2: 'boss.baboulas.win2', title: 'badge.athina.title', sub: 'badge.athina.sub', win3: 'boss.baboulas.win3', ribbon: '#3a6ea5' });
  for (const other of ['bougatsas', 'faia', 'amartia', 'plousiakis']) assert.notEqual(R.TRAINERS.baboulas.victory.ribbon, R.TRAINERS[other].victory.ribbon, 'each badge has its own ribbon colour');
  assert.notEqual(R.STRINGS['badge.athina.title'][0], R.STRINGS['badge.dytika.title'][0]);
});
test('Αθήνα: no per-frame work in the new content (the tiles and creature sprites are drawn once into canvases; the texts are cached strings; the legend is a talk, not a roll)', () => {
  const tileBuilder = html.slice(html.indexOf('function buildTileSprites()'), html.indexOf('buildHospitalTiles(make);'));
  for (const char of ['"', '$', '[', ']', '{', '}']) assert.ok(tileBuilder.includes("make('" + char + "'"), 'the sprite of tile ' + char + ' is built once in buildTileSprites');
  const cache = html.slice(html.indexOf('function creatureSprite('), html.indexOf('function buildAllSprites()'));
  assert.ok(cache.includes('if (creatureSprites[speciesId]) return creatureSprites[speciesId];'), 'creature sprites are cached after the first draw');
  assert.ok(new RegExp('^ {2}taxpayer: function \\(p\\) \\{', 'm').test(html.slice(html.indexOf('const creatureDrawers = {'), html.indexOf('const creatureSprites = {}'))), 'the legend is drawn by a creatureDrawers entry (run once)');
  const overworldDraw = html.slice(html.indexOf('OverworldLayer.prototype.draw = function'), html.indexOf('OverworldLayer.prototype.drawNpc'));
  assert.ok(!/(monastiraki|syntagma|route11|route12|athina|baboulas|legend|taxpayer|lycabettus)/i.test(overworldDraw), 'the overworld draw code has no Αθήνα special case');
  const shopDraw = html.slice(html.indexOf('ShopLayer.prototype.draw = function'), html.indexOf('// ---- Evolution and move learning'));
  assert.ok(!shopDraw.includes('measureText') && shopDraw.includes('this.stock.length'), 'the shop draw is unchanged: no text measuring per frame');
  const legendMethod = html.slice(html.indexOf('OverworldLayer.prototype.legendEncounter = async function'), html.indexOf('OverworldLayer.prototype.challenge = async function'));
  assert.ok(!/(setInterval|requestAnimationFrame|update\s*=)/.test(legendMethod), 'the legend encounter runs only when the player talks to it');
});
test('Αθήνα: type fairness named: every type of the boss is hit for x2 by a starter or a creature that is available before him', () => {
  const types = new Set(R.TRAINERS.baboulas.team.map((entry) => R.SPECIES[entry.sp].t));
  assert.ok(['ekk', 'mem', 'cel', 'pol'].every((type) => types.has(type)) && types.size === 4, 'the boss brings Εκκλησία, Memes, Celebrities and Πολιτικοί (11.16: the police stand in front of the powerful)');
  const before = [...R.STARTERS, ...R.districtSpecies('peiraias'), ...R.districtSpecies('notia'), ...R.districtSpecies('anatolika'), ...R.districtSpecies('voreia'), ...R.districtSpecies('dytika'), ...R.districtSpecies('athina')];
  for (const type of types) assert.ok(before.some((id) => R.typeMultiplier(R.SPECIES[id].t, type) === 2), 'a starter or a creature of the districts up to Αθήνα hits ' + type);
  assert.ok(R.typeMultiplier('biz', 'ekk') === 2 && R.typeMultiplier('mem', 'pol') === 2 && R.typeMultiplier('asf', 'mem') === 2 && R.typeMultiplier('ekk', 'cel') === 2, 'Φακελάκης (Επιχειρηματίες) hits the Εκκλησία, Τρολόσαυρος (Memes) the Πολιτικοί, Κουλουράκι (Ασφαλίτες) the Memes and Ψαλτάκι (Εκκλησία) the Celebrities');
});
test('Αθήνα leaves the earlier bosses as they were: nothing it adds can reach their levels (the legend is one level 40 creature, no evolution, no wild table and no place in a test pool)', () => {
  assert.ok(R.SPECIES.taxpayer.rec <= 10 && !R.SPECIES.taxpayer.evo && ![...ATHINA_POOL, ...DYTIKA_POOL].includes('taxpayer'), 'the legend is in no test pool and is no evolution');
  for (const [id, species] of Object.entries(R.SPECIES)) if (species.evo) assert.notEqual(species.evo.to, 'taxpayer', id + ' does not evolve into the legend');
  assert.equal(ATHINA_POOL.length, DYTIKA_POOL.length, 'the pool of Αθήνα is the pool of Δυτικά (every wild creature of Αθήνα is an evolved form of it or in it)');
  assert.equal(R.TRAINERS.plousiakis.team.length, 5, 'the Δυτικά boss is as it was (its bands are measured by its own test, at the same seed)');
});

// The player team of a Νότια, Ανατολικά, Βόρεια, Δυτικά or Αθήνα fight: one starter (in its middle form from level 16, in its last form from level 32) and creatures of the pool, every creature evolved as far as its level allows.
export const NOTIA_POOL = ['fakelakis', 'trolosavros', 'laikatzis', 'storoula', 'dimosio', 'eforaki', 'frapedoros', 'giagiaka', 'fakelarchis', 'efoplistakos', 'kafenovios'];
// The pool of Ανατολικά: that of Νότια plus the Μοναστηριάκι of route 5 and the Κρυπτο-Μάκης of route 6 (the other creatures of the district are evolved forms of the pool:
// Μόνιμος of Δημοσιοϋπαλληλάκι, Influεnζα of Story-ούλα, NFT-άρχης of Κρυπτο-Μάκης).
export const ANATOLIKA_POOL = NOTIA_POOL.concat(['monastiriaki', 'kryptomakis']);
export function notiaTeam(rules, rng, level, size) { return poolTeam(rules, rng, level, size, NOTIA_POOL); }
export function anatolikaTeam(rules, rng, level, size) { return poolTeam(rules, rng, level, size, ANATOLIKA_POOL); }
// The pool of Βόρεια: that of Ανατολικά plus the wild Ριάλιτο-Νταής and Lobby-Λύκαινα (Σταρ των 90ς is the evolved Λαϊκατζής, Γιοτάρχης the evolved Εφοπλιστάκος).
export const VOREIA_POOL = ANATOLIKA_POOL.concat(['rialito', 'lobbylykaina']);
export function voreiaTeam(rules, rng, level, size) { return poolTeam(rules, rng, level, size, VOREIA_POOL); }
// The pool of Δυτικά: that of Βόρεια plus the wild Ρουσφετόλυκος (Τάβλι-λόρδος, Γιαγιά Παντόφλα, Ελεγκτής ΣΔΟΕ 3000 and Κτηματομεσίτης are the evolved Καφενόβιος, Γιαγιάκα, Εφοράκι and Μοναστηριάκι).
export const DYTIKA_POOL = VOREIA_POOL.concat(['rousfetolykos']);
export function dytikaTeam(rules, rng, level, size) { return poolTeam(rules, rng, level, size, DYTIKA_POOL); }
// The pool of Αθήνα: that of Δυτικά again. Every wild creature of the district is in it or is an evolved form of one in it (Σταρ των 90ς, Influεnζα, Γιοτάρχης, Μόνιμος, Ελεγκτής ΣΔΟΕ 3000, Τάβλι-λόρδος, Γιαγιά Παντόφλα,
// Κτηματομεσίτης), and the legend of the Rock is a single recruitable creature, not part of the test teams.
export const ATHINA_POOL = DYTIKA_POOL.slice();
export function athinaTeam(rules, rng, level, size) { return poolTeam(rules, rng, level, size, ATHINA_POOL); }
function poolTeam(rules, rng, level, size, poolIds) {
  const evolved = (mon) => { while (rules.evolveMon(mon)); return mon; }; // as far as the level allows (a starter has two steps from level 32)
  const team = [evolved(rules.makeMon(rules.pickOne(rng, rules.STARTERS), level))];
  const pool = poolIds.slice();
  for (let n = 1; n < size; n++) team.push(evolved(rules.makeMon(pool.splice(Math.floor(rng() * pool.length), 1)[0], level)));
  return team;
}
export function bossWinRate(rules, bossId, level, size, items, runsCount, seed) {
  const rng = rules.makeRng(seed + level * 10 + size);
  let wins = 0;
  for (let i = 0; i < runsCount; i++) {
    if (rules.simulateBattle(({ bougatsas: notiaTeam, faia: anatolikaTeam, amartia: voreiaTeam, plousiakis: dytikaTeam, baboulas: athinaTeam }[bossId] || notiaTeam)(rules, rng, level, size), rules.buildTrainerTeam(bossId, 'komma'), rng, { foeItems: rules.TRAINERS[bossId].items, playerItems: items }).winner === 0) wins++;
  }
  return wins / runsCount;
}
// Runs per cell of the boss tests: the standard error of a win rate is about 1.5 points here, and the settings of 11.12 sit about 1 to 3 of those inside the bands.
export const BOSS_RUNS_PER_CELL = 1000;
// [label, level offset to the boss' top level, creatures, 2 = two Σουβλάκι else none, lowest, highest]: the offsets and bands of section 11.7, the same for every boss
// (section 11.12: the Νότια boss keeps them by a four-creature team and a small boost).
export const NOTIA_BOSS_BANDS = [
  ['top plus 1, six creatures', 1, 6, 2, 0.85, 0.97],
  ['top minus 1, six creatures', -1, 6, 2, 0.55, 0.75],
  ['top minus 3, six creatures', -3, 6, 2, 0.10, 0.30],
  ['top minus 1, three creatures, no items', -1, 3, 0, 0.08, 0.25],
];
// A boss with four or more creatures meets the three-creature row at its top level (offset 0, not top minus 1): three player creatures against four boss creatures are
// already outnumbered (section 11.7).
// A boss whose top level is 44 or more has its lowest row two levels lower, at top minus 5 (section 11.16): one level is 3.1 % of a creature's stats at level 32 and 2.3 % at level 44, and no boss
// team built of the roster's creatures (more than 600 team settings measured) falls from 85 % to 30 % in four levels at level 44 (the bands of 11.7 need that: 0.65 logit a level; the best teams give about 0.6),
// nor in five (0.5 a level at these win rates, margin 0): the lowest row sits five levels below the top, so the steps keep the power ratio they have for the other bosses with some room. The other rows and the bands are those of every other boss.
export const HIGH_LEVEL_BOSS_TOP = 44;
export function bossBands(rules, bossId) {
  const team = rules.TRAINERS[bossId].team;
  const longTeam = team.length >= 4;
  const high = Math.max(...team.map((entry) => entry.lv)) >= HIGH_LEVEL_BOSS_TOP;
  return NOTIA_BOSS_BANDS.map(([label, offset, size, items, low, up]) => {
    if (size === 3 && longTeam) return ['top, three creatures, no items', 0, size, items, low, up];
    if (offset === -3 && high) return ['top minus 5, six creatures', -5, size, items, low, up];
    return [label, offset, size, items, low, up];
  });
}
// One fixed starter (evolved as far as its level allows) plus five creatures of the district's pool: the win rate of that starter against a boss (section 11.12, per-starter check).
export const PEIRAIAS_POOL = ['fakelakis', 'trolosavros', 'laikatzis', 'storoula', 'dimosio', 'eforaki', 'frapedoros', 'giagiaka'];
export function starterBossRate(rules, bossId, starter, level, size, runsCount, seed) {
  const pool = { kotsos: PEIRAIAS_POOL, bougatsas: NOTIA_POOL, faia: ANATOLIKA_POOL, amartia: VOREIA_POOL, plousiakis: DYTIKA_POOL, baboulas: ATHINA_POOL }[bossId];
  const rng = rules.makeRng(seed + level * 10 + size);
  let wins = 0;
  for (let i = 0; i < runsCount; i++) {
    const team = [rules.makeMon(starter, level)];
    const rest = pool.slice();
    for (let n = 1; n < size; n++) team.push(rules.makeMon(rest.splice(Math.floor(rng() * rest.length), 1)[0], level));
    for (const mon of team) while (rules.evolveMon(mon));
    if (rules.simulateBattle(team, rules.buildTrainerTeam(bossId, starter), rng, { foeItems: rules.TRAINERS[bossId].items, playerItems: ['souvlaki', 'souvlaki'] }).winner === 0) wins++;
  }
  return wins / runsCount;
}

// ---- XP band of a district (section 11.4): used by a test and by balance.mjs ----
// The player's first creature starts at ARRIVAL_LEVEL; three main creatures must reach the boss' top level. The fixed trainers of the district
// (the boss and the bonus studio host not counted) pay XP at the trainer bonus; the wild fights of the district's last route fill the gap.
export const ARRIVAL_LEVEL = { peiraias: 5, notia: 13, anatolika: 20, voreia: 26, dytika: 32, athina: 38 };
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
