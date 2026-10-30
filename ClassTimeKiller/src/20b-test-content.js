// Content audit (ARC-031, VIS-002, step 20.1): no reference game, studio or character name anywhere in the shipped source.
// The list is base64-encoded so the source itself stays free of those names.

const BANNED_NAMES_B64 = 'WyJhcGV4IGxlZ2VuZHMiLCJiYXR0bGVmaWVsZCIsImJpb3Nob2NrIiwiY2FsbCBvZiBkdXR5IiwibW9kZXJuIHdhcmZhcmUiLCJjb3VudGVyLXN0cmlrZSIsImNvdW50ZXIgc3RyaWtlIiwiY3Jvc3NmaXJlIiwiY3J5c2lzIiwiZGVzdGlueSIsImRldXMgZXgiLCJkaXNob25vcmVkIiwiZG9vbSIsImZvcnRuaXRlIiwiaGFsZi1saWZlIiwiaGFsZiBsaWZlIiwiaGFsbyIsIm92ZXJ3YXRjaCIsInBhaW5raWxsZXIiLCJxdWFrZSIsInRpdGFuZmFsbCIsInR1cm9rIiwidW5yZWFsIHRvdXJuYW1lbnQiLCJ2YWxvcmFudCIsIndhcmZyYW1lIiwibWFzdGVyIGNoaWVmIiwiZ29yZG9uIGZyZWVtYW4iLCJzcGFydGFuIiwiY292ZW5hbnQiLCJuZWVkbGVyIiwiZ3Jhdml0eSBndW4iLCJwb3J0YWwgZ3VuIiwiYmZnIiwiaW5zdGFnaWIiLCJvdmVyc2hpZWxkIiwibWFydHlyZG9tIiwic2xheWVyIiwibWlyYWdlIiwiYmFzdGlvbiIsImp1Z2dlcm5vZyIsImtpbGxzdHJlYWsiLCJuYW5vc3VpdCIsImFwZXJ0dXJlIHNjaWVuY2UiLCJibGFjayBtZXNhIiwidGVubm8iLCJnaG9zdCByZWNvbiIsInJhaW5ib3cgc2l4IiwiYnVuZ2llIiwiZXBpYyBnYW1lcyIsImlkIHNvZnR3YXJlIiwiYmxpenphcmQiLCJyaW90IGdhbWVzIiwiYWN0aXZpc2lvbiIsInViaXNvZnQiLCJxdWFkIGRhbWFnZSJd';

Test.add('content', (check) => {
  const banned = JSON.parse(atob(BANNED_NAMES_B64));
  const source = Array.from(document.scripts).map((script) => script.textContent).join('\n').toLowerCase();
  const hits = [];
  for (const word of banned) {
    const escaped = word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const pattern = new RegExp('(^|[^a-z0-9])' + escaped + '(?![a-z0-9])');
    if (pattern.test(source)) hits.push(word);
  }
  check('no reference names in the source', hits.length === 0, hits.join(', '));
  check('banned list decodes', banned.length > 40);
});

// ---- Balance bands (R-086..R-096): time-to-kill per weapon row against the class bands of weaponClasses.ttk ----
const BASE_HEALTH = 100;
const POINT_BLANK_METRES = 2;     // a shotgun's niche range...
const MID_RANGE_METRES = 15;      // ...and the range where it must have lost it
const ONE_HIT_CLASSES = ['shotgun', 'marksman', 'sniper', 'power', 'melee'];   // classes allowed to kill 100 HP with one hit

// Share of a shot's pellets that land on a body at this distance: the spread cone against the torso disc.
function pelletHitShare(mode, distance) {
  if (!distance || !(mode.spreadDeg > 0)) return 1;
  const coneRadius = distance * Math.tan(mode.spreadDeg * DEG);
  return Math.min(1, (TORSO_RADIUS / coneRadius) ** 2);
}
// Damage of one hit of one pellet at this distance (0 = point blank): the falloff of the real damage path; a direct hit
// never takes its own splash (Projectiles.explodeAt excludes the victim), so the bigger of the two counts.
function damagePerPellet(mode, distance) {
  const charge = mode.charge;
  const damage = charge && charge.target !== 'pellets' && charge.target !== 'multiplier' ? chargeDamage(charge, 1) : mode.damage;
  const direct = damage * falloffFactor({ mode, distance, kind: 'hit' });
  return Math.max(direct, mode.splash ? mode.splash.dmg : 0);
}
// Shots needed against 100 HP and the time from the first to the killing shot (body zone; distance 0: every pellet hits).
function shotsToKill(mode, distance) {
  const pellets = mode.charge && mode.charge.target === 'pellets' ? chargeLevelValue(mode.charge, 1) : mode.pellets;
  const perShot = damagePerPellet(mode, distance) * pellets * pelletHitShare(mode, distance);
  return perShot > 0 ? Math.ceil(BASE_HEALTH / perShot - 1e-9) : -1;
}
function timeToKill(mode, distance) {
  const shots = shotsToKill(mode, distance || 0);
  if (shots < 0) return -1;
  const lockTime = mode.lock ? mode.lock.time : 0, chargeTime = mode.charge ? mode.charge.time : 0;
  const later = shots - 1;
  const between = mode.burst ? Math.floor(later / mode.burst) / mode.rate + (later % mode.burst) * mode.burstGap : later / mode.rate;
  return between + lockTime + chargeTime + mode.spinUp;
}

Test.add('content', (check) => {
  const outside = [], oneHit = [], shotguns = [];
  for (const weapon of CAT.weapons) {
    const band = weapon.family.ttk, mode = weapon.primary;
    const ttk = timeToKill(mode);
    if (band && (ttk < band[0] - 1e-6 || ttk > band[1] + 1e-6)) outside.push(weapon.code + ' ' + weapon.id + ' ' + ttk.toFixed(3) + ' not in ' + band.join('-'));
    if (!ONE_HIT_CLASSES.includes(weapon.class) && mode.damage >= BASE_HEALTH) oneHit.push(weapon.code + ' ' + weapon.id + ' ' + mode.damage);
    if (weapon.class === 'shotgun' && !(shotsToKill(mode, POINT_BLANK_METRES) === 1 && shotsToKill(mode, MID_RANGE_METRES) >= 2)) {
      shotguns.push(weapon.code + ' ' + weapon.id + ' ' + shotsToKill(mode, POINT_BLANK_METRES) + '/' + shotsToKill(mode, MID_RANGE_METRES));
    }
  }
  check('time-to-kill vs 100 HP inside the family band for every weapon', outside.length === 0, outside.join('; '));
  check('TTK table: W13 three shots in 2 / 9 s (P8-04: 9 a second), W24 one shot', Test.near(timeToKill(CAT.weapons.byId('vanguard').primary), 2 / 9, 1e-6) && timeToKill(CAT.weapons.byId('heron').primary) === 0);
  check('R-086/R-089: only shotgun, marksman, sniper and power rows kill 100 HP with one direct hit', oneHit.length === 0, oneHit.join('; '));
  check('R-087: every shotgun one-shots at ' + POINT_BLANK_METRES + ' m and needs two shots at ' + MID_RANGE_METRES + ' m', shotguns.length === 0, shotguns.join('; '));
});
