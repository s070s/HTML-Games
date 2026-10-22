// Self-tests for S01-S04 and the loop: math, RNG, events, actors, data, save, settings, world rays.

Test.add('core', (check) => {
  const v = Vec.fromAngles(Vec.make(), 0, 0);
  check('yaw 0 looks +Z', Test.near(v.z, 1, 1e-6) && Test.near(v.x, 0, 1e-6));
  Vec.fromAngles(v, 0, 90 * DEG);
  check('pitch +90 looks up', Test.near(v.y, 1, 1e-6));
  check('wrapAngle', Test.near(wrapAngle(3 * Math.PI), Math.PI, 1e-6) || Test.near(wrapAngle(3 * Math.PI), -Math.PI, 1e-6));
  const view = Mat4.firstPerson(Mat4.create(), 0, 0, 0, 0, 0);
  // A point 5 m ahead (+Z) must land on the view-space -Z axis.
  const ahead = { x: view[8] * 5 + view[12], y: view[9] * 5 + view[13], z: view[10] * 5 + view[14] };
  check('view matrix: +Z is in front', Test.near(ahead.z, -5, 1e-5) && Test.near(ahead.x, 0, 1e-5), JSON.stringify(ahead));
  const right = { x: view[0] * -1, z: view[2] * -1 }; // world -X is the camera's right at yaw 0
  check('view matrix: world -X is camera right at yaw 0', Test.near(right.x, 1, 1e-5), JSON.stringify(right));
});

Test.add('core', (check) => {
  const a = makeRandom(42), b = makeRandom(42), c = makeRandom(43);
  let same = true, differs = false;
  for (let i = 0; i < 1000; i++) { const x = a.next(), y = b.next(); if (x !== y) same = false; if (x !== c.next()) differs = true; if (x < 0 || x >= 1) same = false; }
  check('rng: same seed, same sequence in 0..1', same);
  check('rng: different seed differs', differs);
  Rng.reseed(7); const first = Rng.bots.next(); Rng.map.next(); Rng.reseed(7); Rng.map.next(); Rng.map.next();
  check('rng: streams are independent', Rng.bots.next() === first);
});

Test.add('core', (check) => {
  let received = null;
  const handler = Bus.on('test.ping', (value) => { received = value; });
  Bus.emit('test.ping', 5);
  Bus.off('test.ping', handler);
  Bus.emit('test.ping', 9);
  check('bus: on/emit/off', received === 5);
  const thrower = Bus.on('test.throw', () => { throw new Error('listener failure'); });
  check('bus: a throwing listener is logged, not thrown', Test.expectErrors(() => Bus.emit('test.throw', null)) === 1);
  Bus.off('test.throw', thrower);
});

Test.add('core', (check) => {
  const first = Actors.create(ACTOR_KIND.BOT, 1, 'one');
  const second = Actors.create(ACTOR_KIND.BOT, 2, 'two');
  check('actors: create gives distinct ids', first === 0 && second === 1 && Actors.count === 2);
  Actors.remove(second);
  check('actors: remove shrinks count', Actors.count === 1);
  check('actors: enemy test by team', Actors.isEnemy(first, Actors.create(ACTOR_KIND.BOT, 2, 'x')) && !Actors.isEnemy(first, first));
  Actors.buttons[first] = BTN.FIRE;
  Sim.step();
  check('sim: pressed edge on first step', (Actors.pressed[first] & BTN.FIRE) !== 0);
  Sim.step();
  check('sim: no edge while held', (Actors.pressed[first] & BTN.FIRE) === 0);
  Actors.clear();
  check('actors: clear', Actors.count === 0);
});

Test.add('core', (check) => {
  for (const name in Data.schemas) {
    const problems = Data.validate(name);
    check('data: ' + name + ' rows follow the schema', problems.length === 0, problems.slice(0, 5).join('; '));
  }
  check('data: quality presets', CAT.quality.length === 5 && CAT.quality.byId('potato').bots === 7);
});

Test.add('core', (check) => {
  Save.data = Save.emptySave();
  Save.data.settings.example = 3;
  check('save: round trip', Save.saveNow() && JSON.parse(Save.read(SAVE_KEY)).settings.example === 3);
  Save.write(SAVE_KEY, '{"version":1,"settings":');
  Test.expectErrors(() => Save.load());
  check('save: corrupt save resets with notice', Save.data.version === SAVE_VERSION && Save.notice.length > 0 && Save.read(BACKUP_KEY) !== null);
  Save.storage = makeMemoryStorage(true);
  Save.storageWorks = true;
  let crashed = false;
  try { Save.load(); Save.saveNow(); } catch (error) { crashed = true; }
  check('save: blocked storage does not crash', !crashed && !Save.storageWorks);
  Save.storageWorks = true;
});

Test.add('core', (check) => {
  World.load({ id: 'test', brushes: [{ shape: 'box', min: [-10, -1, -10], max: [10, 0, 10] }, { shape: 'ramp', min: [2, 0, -1], max: [6, 2, 1], dir: '+x' }] });
  const hit = makeHit();
  check('world: ray down hits the floor', World.raycast(0, 5, 0, 0, -1, 0, 100, hit) && Test.near(hit.y, 0, 1e-4) && hit.ny > 0.99, JSON.stringify(hit.y));
  check('world: ray down on ramp middle hits at half height', World.raycast(4, 5, 0, 0, -1, 0, 100, hit) && Test.near(hit.y, 1, 1e-3), hit.y);
  check('world: ray misses beyond max distance', !World.raycast(0, 5, 0, 0, -1, 0, 4, hit));
  check('world: line of sight', World.lineClear(-5, 1, 0, -5, 3, 0) && !World.lineClear(0, 1, 0, 0, -2, 0));
  World.clear();
});
