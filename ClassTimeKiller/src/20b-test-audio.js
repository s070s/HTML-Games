// Self-tests for S06 audio: settings, voice pool and stealing, recipe tables, spatial maths, events to sounds and captions,
// node pooling against a real OfflineAudioContext, music, pause, unlock, speech. Logic runs without a running AudioContext.

const AUDIO_TEST_WEAPON_CLASSES = ['sidearm', 'shotgun', 'rifle', 'smg', 'lmg', 'dmr', 'sniper', 'rail', 'launcher', 'energy', 'heavy', 'melee', 'tool', 'exotic', 'power',
  'marksman', 'explosive'];                          // the last two are the class names the weapon table uses
const AUDIO_TEST_MATERIALS = ['concrete', 'metal', 'wood', 'glass', 'dirt', 'water', 'flesh', 'sparks'];
const AUDIO_TEST_FRAME = 1 / 60;

// For --eval sessions in a real (non-headless) page: the sound engine, the music and the event bus.
DebugApi.audio = { sound: Sound, music: SoundMusic, bus: Bus, stats: () => Sound.stats() };

// A player at the origin looking down +Z (yaw 0) and one bot; the sound code runs live although the self-test is headless.
function audioTestStart() {
  Actors.clear();
  Sound.forceActive = true;
  Sound.resetState();
  SoundMusic.intensity = 0;
  const player = Actors.create(ACTOR_KIND.PLAYER, 0, 'tester');
  const bot = Actors.create(ACTOR_KIND.BOT, 1, 'target');
  Actors.alive[player] = 1; Actors.alive[bot] = 1;
  Actors.maxHealth[player] = 100; Actors.health[player] = 100;
  Game.playerId = player;
  return { player, bot };
}

function audioTestFinish() {
  Sound.detach();
  Sound.nowMs = audioClockMs; Sound.lineOfSight = null;
  Sound.forceActive = false; Sound.assumeRunning = false; Sound.contextFactory = null; Sound.speechSynth = null; Sound.blockedShown = false;
  SoundMusic.nodes = null; SoundMusic.setMood('auto');
  SoundQueue.count = 0;
  Save.data.settings = {};                           // blocks end with the default settings; the engine re-reads them
  Sound.applyVolumes();
  Sound.refreshQuality();
  Game.playerId = -1; Game.state = 'menu';
  Actors.clear();
}

function audioTestPlace(id, x, y, z) {
  Actors.x[id] = x; Actors.y[id] = y; Actors.z[id] = z;
}

const audioTestCount = (recipeId) => Sound.triggerCounts[Sound.recipeIndex(recipeId)];

// Emits one event, then runs one audio frame of `seconds` (default long enough to clear every caption throttle).
function audioTestEmit(type, payload, seconds) {
  Bus.emit(type, payload);
  Sound.update(seconds === undefined ? 1.5 : seconds);
}

function audioTestCaptions() {
  const captions = [];
  const handler = Bus.on('caption', (payload) => captions.push({ text: payload.text, kind: payload.kind, x: payload.x, z: payload.z }));
  captions.stop = () => Bus.off('caption', handler);
  return captions;
}

// A real OfflineAudioContext whose node factories count calls: persistent chain nodes versus one-shot sources.
function audioTestContext() {
  const context = new OfflineAudioContext(2, 44100, 44100);
  const counts = { persistent: 0, oneShot: 0 };
  const wrap = (names, key) => {
    for (const name of names) {
      const original = context[name].bind(context);
      context[name] = (...args) => { counts[key]++; return original(...args); };
    }
  };
  wrap(['createGain', 'createBiquadFilter', 'createStereoPanner', 'createPanner', 'createDynamicsCompressor'], 'persistent');
  wrap(['createOscillator', 'createBufferSource'], 'oneShot');
  return { context, counts };
}

function audioTestAttach() {
  const made = audioTestContext();
  Sound.contextFactory = () => made.context;
  Sound.assumeRunning = true;
  Sound.unlock();
  return made;
}

Test.add('audio', (check) => {
  const keys = ['master', 'sfx', 'music', 'ui', 'announcer', 'mono', 'hrtf', 'speech'];
  for (const name of keys) {
    const definition = Settings.definitions.get('audio.' + name);
    check('setting audio.' + name + ' has a label and a category', definition && definition.label && definition.category, JSON.stringify(definition));
  }
  check('speech announcer is off by default (Q3)', Settings.definitions.get('audio.speech').fallback === false);
  check('mono audio is an accessibility setting', Settings.definitions.get('audio.mono').category === 'accessibility');
  Settings.readCounts.clear();
  Sound.applyVolumes();
  const unread = keys.filter((name) => name !== 'speech' && !Settings.readCounts.get('audio.' + name));
  check('applyVolumes reads every volume and mode setting', unread.length === 0, unread.join(', '));
  Settings.set('audio.sfx', 0.4);
  check('a setting change reaches the engine', Test.near(Sound.levels.sfx, 0.4, 1e-9));
  Settings.set('audio.mono', true);
  check('mono flag follows the setting', Sound.mono === true && !Sound.useHrtf());
  audioTestFinish();
});

Test.add('audio', (check) => {
  const pool = makeVoiceAllocator(AUDIO_MAX_SLOTS);
  pool.limit = 24;
  const slots = new Set();
  for (let i = 0; i < 24; i++) slots.add(pool.acquire(AUDIO_PRIORITY.far, 10 + i, 0, 5));
  check('24 voices fit without stealing', slots.size === 24 && pool.stolen === 0 && pool.activeCount(0) === 24);
  const taken = pool.acquire(AUDIO_PRIORITY.near, 5, 0, 5);
  check('the 25th sound steals the farthest low-priority voice', pool.lastWasSteal && taken === 23 && pool.stolen === 1, taken);
  check('the voice cap holds', pool.activeCount(0) === 24);

  const small = makeVoiceAllocator(8);
  small.limit = 4;
  small.acquire(AUDIO_PRIORITY.far, 20, 0, 9); small.acquire(AUDIO_PRIORITY.near, 5, 0.1, 9);
  small.acquire(AUDIO_PRIORITY.far, 30, 0.2, 9); small.acquire(AUDIO_PRIORITY.explosion, 12, 0.3, 9);
  check('steal order: lowest priority, then farthest', small.acquire(AUDIO_PRIORITY.near, 8, 1, 9) === 2);
  check('steal order: next the other far voice', small.acquire(AUDIO_PRIORITY.near, 8, 1.1, 9) === 0);
  check('steal order: an explosion goes before close enemy fire', small.acquire(AUDIO_PRIORITY.near, 5, 1.2, 9) === 3);
  const twins = makeVoiceAllocator(2);
  twins.acquire(AUDIO_PRIORITY.near, 5, 0, 9); twins.acquire(AUDIO_PRIORITY.near, 5, 0.5, 9);
  check('steal order: equal priority and distance replaces the oldest', twins.acquire(AUDIO_PRIORITY.near, 5, 1, 9) === 0);

  const full = makeVoiceAllocator(4);
  for (let i = 0; i < 4; i++) full.acquire(AUDIO_PRIORITY.own, 0, 0, 9);
  check('a lesser sound is rejected when every voice matters more', full.acquire(AUDIO_PRIORITY.far, 1, 1, 9) === -1 && full.rejected === 1);
  const equal = makeVoiceAllocator(2);
  equal.acquire(AUDIO_PRIORITY.near, 5, 0, 9); equal.acquire(AUDIO_PRIORITY.near, 6, 0, 9);
  check('an equal sound that is farther than all is rejected', equal.acquire(AUDIO_PRIORITY.near, 40, 1, 9) === -1);
  const expiring = makeVoiceAllocator(2);
  expiring.acquire(AUDIO_PRIORITY.near, 5, 0, 1); expiring.acquire(AUDIO_PRIORITY.near, 5, 0, 9);
  check('a finished voice is reused before anything is stolen', expiring.acquire(AUDIO_PRIORITY.far, 50, 2, 1) === 0 && expiring.stolen === 0);

  Settings.set('video.quality', 'potato');
  Sound.refreshQuality();
  check('Potato has 12 voices and no HRTF', Sound.allocator.limit === 12 && Sound.voiceLimit === 12 && !Sound.hrtfAllowed);
  Settings.set('video.quality', 'high');
  Sound.refreshQuality();
  check('High has 24 voices and HRTF', Sound.allocator.limit === 24 && Sound.hrtfAllowed);
  Settings.set('video.quality', 'medium');
  Sound.refreshQuality();
});

Test.add('audio', (check) => {
  const recipeFor = (lookup, payload) => Sound.recipeById.get(soundLookup(lookup, payload));
  const fireLookup = SOUND_EVENTS.find((row) => row.event === 'weapon.fire').lookup;
  const signatures = new Set();
  for (const weaponClass of AUDIO_TEST_WEAPON_CLASSES) {
    const recipe = recipeFor(fireLookup, { weapon: 'unknown', weaponClass });
    check('weapon class ' + weaponClass + ' resolves to a recipe', !!recipe && !!recipe.noise && !!recipe.tone, weaponClass);
    if (recipe) signatures.add(JSON.stringify([recipe.noise, recipe.tone]));
  }
  check('classes sound different (aliases share one recipe)', signatures.size === 15, signatures.size);
  check('unknown class falls back to a rifle', recipeFor(fireLookup, { weapon: 'x', weaponClass: 'zzz' }).id === 'rifle');
  check('weapon overrides win over the class', recipeFor(fireLookup, { weapon: 'lancet', weaponClass: 'marksman' }).id === 'rail');
  check('a quick melee (mode melee) swings instead of shooting', recipeFor(fireLookup, { weapon: 'hush', weaponClass: 'sidearm', mode: 'melee' }).id === 'melee');
  for (const row of CAT.weapons || []) {
    check('weapon ' + row.id + ' resolves to a recipe', !!recipeFor(fireLookup, { weapon: row.id, weaponClass: row.class || row.weaponClass }));
  }

  const impactLookup = [['material', 'material']], stepLookup = [['surface', 'surface']];
  for (const material of AUDIO_TEST_MATERIALS) {
    check('impact and footstep recipes exist for ' + material, recipeFor(impactLookup, { material }).id === 'impact.' + material && recipeFor(stepLookup, { surface: material }).id === 'step.' + material);
  }
  check('material aliases map to a row', recipeFor(stepLookup, { surface: 'steel' }).id === 'step.metal' && recipeFor(impactLookup, { material: 'grass' }).id === 'impact.dirt');
  check('unknown or hostile material names fall back to concrete', recipeFor(stepLookup, { surface: 'toString' }).id === 'step.concrete' && recipeFor(impactLookup, { material: undefined }).id === 'impact.concrete');

  const problems = [];
  const ids = new Set();
  for (const recipe of Sound.recipes) {
    if (ids.has(recipe.id)) problems.push(recipe.id + ' duplicated');
    ids.add(recipe.id);
    const layers = [recipe.noise, recipe.tone].filter(Boolean);
    if (!layers.length) problems.push(recipe.id + ' has no layer');
    for (const layer of layers) {
      const numbers = [layer.from, layer.to, layer.attack, layer.decay, layer.gain];
      if (!numbers.every((value) => Number.isFinite(value) && value > 0)) problems.push(recipe.id + ' has a non-positive layer number');
    }
    if (recipe.pulses.length !== recipe.pitchSteps.length) problems.push(recipe.id + ' pulses and pitchSteps differ');
    if (!recipe.pulses.every((time, pulse) => pulse === 0 || time > recipe.pulses[pulse - 1])) problems.push(recipe.id + ' pulses are not rising');
    for (const layer of layers) {
      const fits = layer.decays.length === recipe.pulses.length && layer.decays.every((decay, pulse) => decay >= SOUND_MIN_PULSE_DECAY
        && (pulse === layer.decays.length - 1 || recipe.pulses[pulse] + layer.attack + decay < recipe.pulses[pulse + 1]));
      if (!fits) problems.push(recipe.id + ' has a pulse too close to the next one');
    }
    if (!Sound.buses && !['sfx', 'voice', 'ui', 'music'].includes(recipe.bus)) problems.push(recipe.id + ' bus');
    if (!(recipe.priorityValue > 0) || !(recipe.duration > 0) || !(recipe.range > 0)) problems.push(recipe.id + ' priority, duration or range');
    if (recipe.caption && recipe.captionKind < 0) problems.push(recipe.id + ' caption kind');
  }
  check('every recipe is valid', problems.length === 0, problems.slice(0, 4).join('; '));
  const announce = Sound.recipeById.get('announce').tone;
  check('overlapping pulses are cut to the room before the next pulse, the last one rings out', announce.decays[0] < announce.decay && announce.decays[1] < announce.decay && announce.decays[2] === announce.decay);
  check('a lone pulse keeps its whole decay', Sound.recipeById.get('rifle').tone.decays.length === 1 && Sound.recipeById.get('rifle').tone.decays[0] === Sound.recipeById.get('rifle').tone.decay);
  if (CAT.weapons) {
    for (const key in SOUND_TABLES.weaponOverride) check('sound override ' + key + ' names a weapon in the catalogue', !!CAT.weapons.byId(key), key);
  }

  const missing = [];
  for (const row of SOUND_EVENTS) {
    const targets = row.recipe ? [row.recipe] : [].concat(...row.lookup.map((pair) => Object.values(SOUND_TABLES[pair[1]])));
    for (const target of targets) if (!Sound.recipeById.has(target)) missing.push(row.event + ' -> ' + target);
  }
  check('every event row points at an existing recipe', missing.length === 0, missing.join('; '));
  check('the pickup, ping, UI and announcer cues exist', ['powerChime', 'rocketWhistle', 'grenadeTick', 'heartbeat', 'shieldBreak', 'hitTick', 'headshot', 'pingDanger', 'uiClick', 'announce', 'medal', 'radioBlip']
    .every((id) => Sound.recipeById.has(id)));
});

Test.add('audio', (check) => {
  const { player } = audioTestStart();
  setAudioListener(0, 1.62, 0, 0, 0);
  const step = Sound.recipeById.get('step.concrete'), rifle = Sound.recipeById.get('rifle');
  const spatial = audioSpatial;
  computeAudioSpatial(spatial, step, 0, 1, 10);
  check('ahead: centred, direction ahead', Test.near(spatial.pan, 0, 1e-6) && spatial.direction === 0);
  const aheadCutoff = spatial.cutoff;
  computeAudioSpatial(spatial, step, 10, 1, 0);
  check('a source on +X is on the listener\'s left (DATA-002)', spatial.pan < -0.9 && spatial.direction === 3, spatial.pan);
  computeAudioSpatial(spatial, step, -10, 1, 0);
  check('a source on -X is on the right', spatial.pan > 0.9 && spatial.direction === 1);
  computeAudioSpatial(spatial, step, 0, 1, -10);
  check('behind: direction behind and a duller sound', spatial.direction === 2 && spatial.cutoff < aheadCutoff * 0.8);
  setAudioListener(0, 1.62, 0, Math.PI / 2, 0);
  computeAudioSpatial(spatial, step, 10, 1, 0);
  check('turning right 90 degrees puts the +X source ahead', spatial.direction === 0);
  setAudioListener(0, 1.62, 0, 0, 0);
  computeAudioSpatial(spatial, step, 0.1, 1.62, 0.1);
  check('a sound right next to the listener is nearly centred', Math.abs(spatial.pan) < 0.5);
  computeAudioSpatial(spatial, step, 3, 1.62, 4);
  check('pan stays inside -1..1', Math.abs(spatial.pan) <= 1);

  check('footsteps keep 30% of their level at 15 m (AUD-004)', audioAttenuation(step, 15) * step.gain >= 0.3, audioAttenuation(step, 15) * step.gain);
  computeAudioSpatial(spatial, step, 0, 1.62, 15);
  check('footsteps at 15 m are not muffled away', spatial.cutoff > 3000, spatial.cutoff);
  check('gunfire carries farther than footsteps', audioAttenuation(rifle, 50) > audioAttenuation(step, 50));
  check('level never grows with distance', audioAttenuation(rifle, 100) < audioAttenuation(rifle, 20) && audioAttenuation(rifle, 2) === 1);
  check('priority: own > near fire > explosion > far > ambience', audioPriorityFor(rifle, 5, true) === AUDIO_PRIORITY.own && audioPriorityFor(rifle, 5, false) === AUDIO_PRIORITY.near
    && audioPriorityFor(Sound.recipeById.get('explosion'), 5, false) === AUDIO_PRIORITY.explosion && audioPriorityFor(rifle, 80, false) === AUDIO_PRIORITY.far
    && audioPriorityFor(Sound.recipeById.get('impact.dirt'), 5, false) === AUDIO_PRIORITY.ambient && audioPriorityFor(Sound.recipeById.get('uiClick'), 0, true) === AUDIO_PRIORITY.ui);

  World.load({ id: 'wall', brushes: [{ shape: 'box', min: [-5, 0, 4], max: [5, 3, 5] }] });
  computeAudioSpatial(spatial, step, 0, 1.6, 10);
  Sound.lineOfSight = null;   // S08 fills the hook at load; Test.isolate restores it
  check('without a line-of-sight hook nothing is occluded', !Sound.isOccluded(spatial, 0, 1.6, 10));
  Sound.lineOfSight = (ax, ay, az, bx, by, bz) => World.lineClear(ax, ay, az, bx, by, bz);
  check('a wall between listener and source occludes', Sound.isOccluded(spatial, 0, 1.6, 10));
  computeAudioSpatial(spatial, step, 10, 1.6, 0);
  check('open air does not occlude', !Sound.isOccluded(spatial, 10, 1.6, 0));
  computeAudioSpatial(spatial, step, 0, 1.6, 10);
  Sound.occlusionRays = AUDIO_OCCLUSION_RAYS;
  check('occlusion rays are limited per frame', !Sound.isOccluded(spatial, 0, 1.6, 10));
  Sound.occlusionRays = 0;
  Sound.lineOfSight = null;
  World.clear();

  const captions = audioTestCaptions();
  const queued = [];
  for (let i = 0; i < 10; i++) queued.push(Sound.enqueue(Sound.recipeIndex('impact.concrete'), true, 3 + i * 0.05, 1, 10, 7, 1, 1));
  check('pellet impacts at one spot are coalesced into one sound', queued.filter(Boolean).length === 1);
  check('impacts at different spots are kept', Sound.enqueue(Sound.recipeIndex('impact.concrete'), true, 12, 1, 10, 7, 1, 1));
  for (let i = 0; i < 100; i++) SoundQueue.push(Sound.recipeIndex('hitTick'), true, i * 5, 0, 0, i, 1, 1);
  check('the request queue is bounded', SoundQueue.count === AUDIO_QUEUE_SIZE && SoundQueue.dropped > 0);
  Sound.update(AUDIO_TEST_FRAME);
  check('the queue is empty after a frame', SoundQueue.count === 0);
  captions.stop();
  void player;
  audioTestFinish();
});

Test.add('audio', (check) => {
  const { player, bot } = audioTestStart();
  const captions = audioTestCaptions();
  audioTestPlace(bot, 0, 0, 10);
  audioTestEmit('move.step', { id: bot, speed: 6, surface: 'metal' });
  check('enemy footsteps ahead are captioned', captions.length === 1 && captions[0].text === '[Footsteps ahead]' && captions[0].kind === 'footstep', JSON.stringify(captions));
  check('the step plays the metal recipe', audioTestCount('step.metal') === 1);
  audioTestPlace(bot, 10, 0, 0);
  audioTestEmit('move.step', { id: bot, speed: 6, surface: 'wood' });
  audioTestPlace(bot, -10, 0, 0);
  audioTestEmit('move.step', { id: bot, speed: 6, surface: 'dirt' });
  audioTestPlace(bot, 0, 0, -10);
  audioTestEmit('move.step', { id: bot, speed: 6, surface: 'glass' });
  check('captions name left, right and behind', captions.map((caption) => caption.text).join('|') === '[Footsteps ahead]|[Footsteps left]|[Footsteps right]|[Footsteps behind]', captions.map((caption) => caption.text).join('|'));
  check('captions carry the source position for the visual ring', captions[1].x === 10 && captions[3].z === -10);

  audioTestPlace(bot, 0, 0, 10);
  const before = captions.length;
  Bus.emit('move.step', { id: bot, speed: 6, surface: 'metal' });
  Bus.emit('move.step', { id: bot, speed: 6, surface: 'metal' });
  Sound.update(1.5);
  check('a repeated step in one frame is one sound and one caption', captions.length === before + 1);
  Bus.emit('move.step', { id: bot, speed: 6, surface: 'metal' });
  Sound.update(AUDIO_TEST_FRAME);
  check('captions are throttled per actor and kind', captions.length === before + 1);

  audioTestEmit('move.step', { id: player, speed: 6, surface: 'metal' });
  check('your own footsteps play but are not captioned', audioTestCount('step.metal') >= 3 && captions.length === before + 1);
  audioTestPlace(bot, 0, 0, 100);
  audioTestEmit('move.step', { id: bot, speed: 6, surface: 'metal' });
  check('footsteps beyond their range are dropped', captions.length === before + 1);

  audioTestPlace(bot, 0, 0, 12);
  captions.length = 0;
  audioTestEmit('weapon.fire', { id: bot, weapon: 'x', weaponClass: 'shotgun', mode: 'primary', x: 0, y: 1.5, z: 12, dx: 0, dy: 0, dz: -1 });
  audioTestEmit('weapon.fire', { id: player, weapon: 'x', weaponClass: 'rifle', mode: 'primary', x: 0, y: 1.5, z: 0, dx: 0, dy: 0, dz: 1 });
  check('enemy gunfire is captioned, your own is not', captions.length === 1 && captions[0].text === '[Gunfire ahead]' && captions[0].kind === 'gunfire', JSON.stringify(captions));
  check('fire plays the class recipe', audioTestCount('shotgun') === 1 && audioTestCount('rifle') === 1);
  audioTestEmit('weapon.fire', { id: bot, weapon: 'hush', weaponClass: 'sidearm', mode: 'alt', x: 0, y: 1.5, z: 12, dx: 0, dy: 0, dz: -1 });
  check('a suppressed weapon plays its own quiet recipe', audioTestCount('suppressed') === 1 && captions[captions.length - 1].text === '[Faint shots ahead]');

  captions.length = 0;
  audioTestEmit('explosion', { x: 0, y: 1, z: 25, radius: 5, owner: bot, source: 'x', element: 'thermal' });
  audioTestEmit('explosion', { x: 0, y: 1, z: 25, radius: 5, owner: bot, source: 'x', element: '' });
  check('explosions are captioned and use the element recipe', captions.length === 2 && captions[0].kind === 'explosion' && audioTestCount('explosionFire') === 1 && audioTestCount('explosion') === 1);
  audioTestEmit('pickup', { id: bot, item: 'unknown', group: 'power', x: 0, y: 1, z: 20 });
  check('an enemy power pickup plays the chime and is captioned', audioTestCount('powerChime') === 1 && captions[captions.length - 1].kind === 'item');
  audioTestEmit('projectile.incoming', { x: 0, y: 1.5, z: 30, kind: 'rocket', source: bot });
  check('an incoming rocket plays the whistle with an alert caption', audioTestCount('rocketWhistle') === 1 && captions[captions.length - 1].text === '[Rocket incoming ahead]' && captions[captions.length - 1].kind === 'alert');
  audioTestEmit('projectile.bounce', { x: 0, y: 0.5, z: 8, kind: 'grenade', source: bot });
  check('a grenade bounce ticks', audioTestCount('grenadeTick') === 1);
  audioTestEmit('ping', { id: bot, kind: 'danger', x: 3, y: 1, z: 9, target: -1 });
  check('a danger ping chirps', audioTestCount('pingDanger') === 1);
  audioTestEmit('item.respawn', { x: 0, y: 1, z: 20, group: 'power' });
  check('a power item respawn chimes', audioTestCount('powerChime') === 2);
  captions.stop();
  audioTestFinish();
});

Test.add('audio', (check) => {
  const { player, bot } = audioTestStart();
  audioTestPlace(bot, 0, 0, 10);
  audioTestEmit('damage', { target: bot, source: player, amount: 20, absorbed: 0, zone: 'body', weapon: 'x', element: '', x: 0, y: 1, z: 10, dx: 0, dy: 0, dz: 1 });
  check('your hit plays a tick', audioTestCount('hitTick') === 1);
  audioTestEmit('damage', { target: bot, source: player, amount: 90, absorbed: 0, zone: 'head', weapon: 'x', element: '', x: 0, y: 1, z: 10, dx: 0, dy: 0, dz: 1 });
  check('your headshot plays the headshot ping', audioTestCount('headshot') === 1);
  audioTestEmit('damage', { target: player, source: player, amount: 10, absorbed: 0, zone: 'body', weapon: 'x', element: '', x: 0, y: 1, z: 0, dx: 0, dy: 0, dz: 1 });
  check('self damage is a thump, not a hit tick', audioTestCount('hitTick') === 1 && audioTestCount('damageTaken') === 1);
  const other = Actors.create(ACTOR_KIND.BOT, 2, 'third');
  audioTestEmit('damage', { target: other, source: bot, amount: 20, absorbed: 0, zone: 'body', weapon: 'x', element: '', x: 0, y: 1, z: 10, dx: 0, dy: 0, dz: 1 });
  check('hits between other actors make no feedback sound', audioTestCount('hitTick') === 1 && audioTestCount('damageTaken') === 1);
  audioTestEmit('damage', { target: player, source: bot, amount: 30, absorbed: 0, zone: 'body', weapon: 'x', element: '', x: 0, y: 1, z: 10, dx: 0, dy: 0, dz: 1 });
  check('damage taken thumps', audioTestCount('damageTaken') === 2);
  audioTestEmit('kill', { victim: bot, killer: player, assister: -1, weapon: 'x', zone: 'body', element: '', x: 0, y: 1, z: 10 });
  check('your kill confirms and the victim dies audibly', audioTestCount('killConfirm') === 1 && audioTestCount('death') === 1);
  audioTestEmit('kill', { victim: other, killer: bot, assister: -1, weapon: 'x', zone: 'body', element: '', x: 0, y: 1, z: 10 });
  check('other kills only play the death sound', audioTestCount('killConfirm') === 1 && audioTestCount('death') === 2);

  audioTestEmit('ui.click', { kind: 'back' });
  audioTestEmit('ui.click', { kind: 'nonsense' });
  check('menu clicks pick a UI recipe and fall back to a click', audioTestCount('uiBack') === 1 && audioTestCount('uiClick') === 1);
  audioTestEmit('announce', { text: 'Round start', kind: 'warning', priority: 1 });
  check('announcements play a sting by kind', audioTestCount('announceWarn') === 1);
  audioTestEmit('medal', { id: bot, medal: 'double' });
  audioTestEmit('medal', { id: player, medal: 'double' });
  check('only your own medals play a sting', audioTestCount('medal') === 1);

  audioTestEmit('weapon.reload', { id: bot, weapon: 'x' });
  audioTestEmit('weapon.switch', { id: player, weapon: 'x' });
  audioTestEmit('weapon.empty', { id: player, weapon: 'x' });
  audioTestEmit('impact', { x: 0, y: 1, z: 6, nx: 0, ny: 0, nz: -1, material: 'glass', weapon: 'x', owner: player });
  audioTestEmit('move.jump', { id: bot, speed: 5, surface: 'concrete' });
  audioTestEmit('move.land', { id: bot, speed: 12, surface: 'concrete' });
  check('handling, impact and movement events play their recipes', ['reload', 'switch', 'empty', 'impact.glass', 'jump', 'land'].every((id) => audioTestCount(id) === 1));

  Game.headless = true;
  Sound.forceActive = false;
  Bus.emit('move.step', { id: bot, speed: 6, surface: 'metal' });
  check('headless mode queues nothing', SoundQueue.count === 0 && !Sound.unlock());
  Sound.forceActive = true;
  audioTestFinish();
});

// Renders one recipe through the real voice code into an OfflineAudioContext and measures the result.
async function audioTestRender(recipe) {
  const context = new OfflineAudioContext(2, Math.ceil((recipe.duration + 0.1) * 44100), 44100);
  Sound.contextFactory = () => context;
  Sound.assumeRunning = true;
  Sound.unlock();
  Sound.enqueue(recipe.index, false, 0, 0, 0, -1, 1, 1);
  Sound.update(AUDIO_TEST_FRAME);
  const buffer = await context.startRendering();
  let peak = 0, finite = true;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < samples.length; i++) {
      if (!Number.isFinite(samples[i])) finite = false;
      peak = Math.max(peak, Math.abs(samples[i]));
    }
  }
  Sound.detach();
  return { peak, finite };
}

Test.add('audio', async (check) => {
  audioTestStart();
  const silent = [], loud = [], broken = [];
  const peaks = new Map();
  for (const recipe of Sound.recipes) {
    const result = await audioTestRender(recipe);
    peaks.set(recipe.id, result.peak);
    if (!result.finite) broken.push(recipe.id);
    if (result.peak < 0.02) silent.push(recipe.id + ' ' + result.peak.toFixed(3));
    if (result.peak > 1) loud.push(recipe.id + ' ' + result.peak.toFixed(2));
  }
  check('every recipe renders finite samples', broken.length === 0, broken.join(', '));
  check('every recipe is audible', silent.length === 0, silent.join(', '));
  check('no recipe clips the output', loud.length === 0, loud.join(', '));
  const curve = buildSoftClipCurve();
  check('the output clipper stays below full scale and is transparent for normal levels', Math.max(...curve) < 0.96 && Test.near(curve[Math.round(curve.length * 0.75)], 0.5, 1e-3));
  const loudestMenu =Math.max(...['uiClick', 'uiBack', 'uiConfirm', 'uiHover', 'uiError'].map((id) => peaks.get(id)));
  check('menu sounds are softer than gunfire (LT-L-011)', loudestMenu < peaks.get('rifle'), 'menu ' + loudestMenu + ' rifle ' + peaks.get('rifle'));
  audioTestFinish();
});

Test.add('audio', (check) => {
  const { player, bot } = audioTestStart();
  Actors.health[player] = 20;
  for (let i = 0; i < 120; i++) Sound.update(0.0166);
  const beats = audioTestCount('heartbeat');
  check('low health beats about every 0.8 s', beats >= 2 && beats <= 3, beats);
  Actors.health[player] = 60;
  for (let i = 0; i < 120; i++) Sound.update(0.0166);
  check('no heartbeat above 30% health', audioTestCount('heartbeat') === beats);
  Actors.health[player] = 5;
  Sound.resetState();
  for (let i = 0; i < 120; i++) Sound.update(0.0166);
  check('the heartbeat speeds up near death', audioTestCount('heartbeat') >= 3);
  Actors.health[player] = 0; Actors.alive[player] = 0;
  Sound.resetState();
  for (let i = 0; i < 120; i++) Sound.update(0.0166);
  check('a dead player has no heartbeat', audioTestCount('heartbeat') === 0);

  Actors.shield[bot] = 50;
  Sound.update(AUDIO_TEST_FRAME);
  Actors.shield[bot] = 0;
  Sound.update(AUDIO_TEST_FRAME);
  check('a shield running out breaks audibly', audioTestCount('shieldBreak') === 1);
  Actors.shield[bot] = 40;
  Sound.update(AUDIO_TEST_FRAME);
  Actors.alive[bot] = 0; Actors.shield[bot] = 0;
  Sound.update(AUDIO_TEST_FRAME);
  check('dying with a shield is not a shield break', audioTestCount('shieldBreak') === 1);
  audioTestFinish();
});

Test.add('audio', (check) => {
  const { player, bot } = audioTestStart();
  Settings.set('audio.music', 0);
  Sound.applyVolumes();
  const made = audioTestAttach();
  check('the first gesture creates the context', Sound.context === made.context && !!Sound.buses && !!Sound.noiseBuffer);
  const persistentBase = made.counts.persistent, sourcesBase = made.counts.oneShot;
  check('7 buses and 24 voice chains of 7 nodes are built up front', persistentBase === 7 + 24 * 7, persistentBase);
  check('each chain owns its 3 sources, so a sound creates none', sourcesBase === 24 * 3 + 1, sourcesBase);

  for (let frame = 0; frame < 120; frame++) {
    for (let k = 0; k < 4; k++) {
      audioTestPlace(bot, (frame % 7) * 4 - 12, 0, 6 + (k * 7) % 25);
      Bus.emit('move.step', { id: bot, speed: 6, surface: AUDIO_TEST_MATERIALS[(frame + k) % 8] });
      Bus.emit('weapon.fire', { id: 10 + k, weapon: 'x', weaponClass: AUDIO_TEST_WEAPON_CLASSES[(frame + k) % 15], mode: 'primary', x: (k - 2) * 6, y: 1.5, z: 8 + frame % 30, dx: 0, dy: 0, dz: 1 });
    }
    Sound.update(AUDIO_TEST_FRAME);
  }
  const warm = made.counts.persistent;
  const stats = Sound.stats();
  check('voices were started and the cap of 4 new voices per frame holds', stats.started > 24 && stats.maxStartedPerFrame <= 4, JSON.stringify(stats));
  check('the voice cap of 24 holds and stealing happened', stats.voices <= 24 && stats.stolen > 0, JSON.stringify(stats));
  check('no chain beyond the pool was built', Sound.slots.filter(Boolean).length === 24 && warm === persistentBase, warm - persistentBase);
  check('sounds create no source nodes (node creation costs 30 us each)', made.counts.oneShot === sourcesBase, made.counts.oneShot + ' vs ' + sourcesBase);

  for (let frame = 0; frame < 300; frame++) {
    audioTestPlace(bot, 3, 0, 15);
    Bus.emit('weapon.fire', { id: bot, weapon: 'x', weaponClass: 'rifle', mode: 'primary', x: 3, y: 1.5, z: 15, dx: 0, dy: 0, dz: 1 });
    Bus.emit('explosion', { x: -5 + frame % 3, y: 1, z: 20, radius: 4, owner: bot, source: 'x', element: '' });
    Sound.update(AUDIO_TEST_FRAME);
  }
  check('no nodes are created after warm-up', made.counts.persistent === warm && made.counts.oneShot === sourcesBase, made.counts.persistent + ' vs ' + warm);

  Settings.set('video.quality', 'potato');
  const potatoStart = Sound.stats().started;
  for (let frame = 0; frame < 30; frame++) {
    for (let k = 0; k < 10; k++) Bus.emit('weapon.fire', { id: 10 + k, weapon: 'x', weaponClass: 'smg', mode: 'primary', x: k * 3, y: 1.5, z: 10 + frame, dx: 0, dy: 0, dz: 1 });
    Sound.update(AUDIO_TEST_FRAME);
  }
  check('Potato starts at most 2 new voices a frame', Sound.stats().started - potatoStart <= 30 * 2);
  Settings.set('video.quality', 'medium');

  Sound.resetState();
  for (let k = 0; k < 20; k++) Sound.enqueue(Sound.recipeIndex('step.metal'), true, 10 + k * 3, 0, 10, 50 + k, 1, 1);
  Bus.emit('weapon.empty', { id: player, weapon: 'x' });
  for (let k = 0; k < 30; k++) SoundQueue.push(Sound.recipeIndex('impact.dirt'), true, 20 + k * 3, 0, 20, 100 + k, 1, 1);
  Sound.update(AUDIO_TEST_FRAME);
  check('the most important sounds win the per-frame cap: your own click got a voice', Array.from(Sound.allocator.priority.subarray(0, 24)).includes(AUDIO_PRIORITY.own));

  audioTestFinish();
});

Test.add('audio', (check) => {
  const { player, bot } = audioTestStart();
  Game.state = 'playing';
  check('mood API accepts the four moods', ['auto', 'calm', 'combat', 'boss'].every((name) => Sound.setMusicMood(name)) && !Sound.setMusicMood('disco'));
  const weights = { calm: 0, combat: 0, boss: 0 };
  Sound.setMusicMood('calm');
  SoundMusic.targetWeights(weights);
  check('calm mood: only the calm layer', weights.combat === 0 && weights.boss === 0 && weights.calm === 1);
  Sound.setMusicMood('combat');
  SoundMusic.targetWeights(weights);
  check('combat mood: combat layer in', weights.combat === 1 && weights.boss === 0);
  Sound.setMusicMood('boss');
  SoundMusic.targetWeights(weights);
  check('boss mood: boss layer in', weights.boss === 1 && weights.combat === 1);
  Game.state = 'menu';
  SoundMusic.targetWeights(weights);
  check('menus are always calm', weights.boss === 0 && weights.combat === 0);
  Game.state = 'playing';
  Sound.setMusicMood('auto');
  SoundMusic.targetWeights(weights);
  check('auto mood with no fighting is calm', weights.combat === 0);

  audioTestPlace(bot, 0, 0, 10);
  audioTestEmit('damage', { target: bot, source: player, amount: 60, absorbed: 0, zone: 'body', weapon: 'x', element: '', x: 0, y: 1, z: 10, dx: 0, dy: 0, dz: 1 });
  const raised = SoundMusic.intensity;
  check('your damage raises the intensity', raised > 0.2, raised);
  audioTestEmit('damage', { target: player, source: bot, amount: 100, absorbed: 0, zone: 'body', weapon: 'x', element: '', x: 0, y: 1, z: 10, dx: 0, dy: 0, dz: 1 });
  SoundMusic.targetWeights(weights);
  check('taking damage brings the combat layer in', SoundMusic.intensity > raised && weights.combat > 0.8, weights.combat);
  const far = Actors.create(ACTOR_KIND.BOT, 2, 'far');
  SoundMusic.intensity = 0;
  Bus.emit('damage', { target: player, source: bot, zone: 'body', x: 0, y: 1, z: 0 });
  check('a damage event without an amount cannot poison the intensity', SoundMusic.intensity === 0);
  Bus.emit('damage', { target: far, source: bot, amount: 40, absorbed: 0, zone: 'body', weapon: 'x', element: '', x: 200, y: 1, z: 200, dx: 0, dy: 0, dz: 1 });
  check('a far-away fight does not excite the music', SoundMusic.intensity === 0);
  Bus.emit('damage', { target: far, source: bot, amount: 40, absorbed: 0, zone: 'body', weapon: 'x', element: '', x: 5, y: 1, z: 5, dx: 0, dy: 0, dz: 1 });
  check('a nearby fight excites it a little', SoundMusic.intensity > 0 && SoundMusic.intensity < 0.2, SoundMusic.intensity);
  SoundMusic.update(10);
  check('intensity decays back to calm', SoundMusic.intensity === 0);

  Settings.set('video.quality', 'potato');
  Sound.refreshQuality();
  check('music is off by default on Potato', !Sound.musicAllowed);
  Settings.set('video.quality', 'low');
  Sound.refreshQuality();
  check('music is on for Low', Sound.musicAllowed);
  Settings.set('video.quality', 'medium');
  Sound.refreshQuality();

  const made = audioTestAttach();
  Sound.setMusicMood('boss');
  const beforeMusic = made.counts.persistent;
  SoundMusic.update(0.3);
  check('music builds its nodes once when allowed', !!SoundMusic.nodes && made.counts.persistent > beforeMusic);
  const built = [made.counts.persistent, made.counts.oneShot];
  SoundMusic.scheduleUntil(60);
  check('60 s of music creates no nodes (AUD-007)', made.counts.persistent === built[0] && made.counts.oneShot === built[1]);
  check('the progression moves through bars and chords', SoundMusic.bar > 20 && SoundMusic.chordAt(0) !== SoundMusic.chordAt(MUSIC_BARS_PER_CHORD));
  const notes = [];
  for (const chord of MUSIC_CHORDS) for (const index of MUSIC_ARP_NOTES) notes.push(musicHz(chord[index % 3] + 12 * Math.floor(index / 3), 8), musicHz(chord[0], 2), musicHz(chord[0], 4));
  check('every scheduled pitch is audible and below 8 kHz', notes.every((hz) => hz > 30 && hz < 8000));
  let total = 0;
  for (let i = 0; i < 200; i++) {
    SoundMusic.nextStepTime = 0;
    const started = performance.now();
    SoundMusic.scheduleUntil(MUSIC_STEP_SECONDS * 1.5);
    total += performance.now() - started;
  }
  check('scheduling a music step costs well under 0.1 ms', total / 200 < 0.1, (total / 200).toFixed(4));
  Settings.set('video.quality', 'potato');
  SoundMusic.update(0.016);
  check('switching to Potato stops the music', SoundMusic.nodes === null);
  Settings.set('video.quality', 'medium');
  audioTestFinish();
});

Test.add('audio', (check) => {
  audioTestStart();
  const toasts = [];
  const handler = Bus.on('toast', (payload) => toasts.push(payload.text));
  const fakeSession = { audioSession: { type: 'auto' }, userAgent: 'x', platform: '', maxTouchPoints: 0 };
  check('iOS 17 audio session is set to playback', Sound.configureSession(fakeSession) === 'playback' && fakeSession.audioSession.type === 'playback' && toasts.length === 0);
  check('older iOS gets a silent-switch hint', Sound.configureSession({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 }) === 'hint' && toasts.length === 1 && /silent switch/.test(toasts[0]));
  check('other browsers need neither', Sound.configureSession({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)', platform: 'Win32', maxTouchPoints: 0 }) === 'none' && toasts.length === 1);

  const made = audioTestContext();
  Sound.contextFactory = () => made.context;
  Sound.blockedShown = false;
  check('a gesture creates the context', Sound.unlock() && Sound.context === made.context && !Sound.canPlay());
  Sound.checkBlocked();
  Sound.checkBlocked();
  check('a context that stays blocked shows one toast', toasts.length === 2 && /blocked/.test(toasts[1]), toasts.join(' | '));
  Sound.detach();

  Sound.forceActive = false;
  check('headless: a gesture does nothing at all', !Sound.unlock() && Sound.context === null);
  Sound.forceActive = true;

  const spoken = [];
  Sound.speechSynth = { cancel() {}, speak(utterance) { spoken.push(utterance.text); } };
  Bus.emit('announce', { text: 'Fury Core', kind: 'power', priority: 1 });
  check('announcer speech is off by default', spoken.length === 0 && audioTestCount('announcePower') === 0);
  Settings.set('audio.speech', true);
  Bus.emit('announce', { text: 'Fury Core', kind: 'power', priority: 1 });
  check('with the option on, the announcer text is spoken', spoken.length === 1 && spoken[0] === 'Fury Core', spoken.join('|'));
  Sound.update(AUDIO_TEST_FRAME);
  check('the sting still plays', audioTestCount('announcePower') === 1);

  const pause = audioTestAttach();
  Settings.set('audio.mono', true);
  check('mono folds the master bus to one channel', Sound.buses.master.channelCount === 1 && Sound.buses.master.channelCountMode === 'explicit');
  Settings.set('audio.mono', false);
  check('stereo restores two channels', Sound.buses.master.channelCount === 2);
  Bus.emit('game.pause', 'menu');
  check('a menu pause mutes the game but keeps the context for menu clicks', Sound.paused && !Sound.suspendTimer);
  Bus.emit('game.resume', null);
  Bus.emit('game.pause', 'blur');
  check('losing focus fades out and schedules a suspend', Sound.paused && !!Sound.suspendTimer);
  Bus.emit('game.resume', null);
  check('resume cancels it', !Sound.paused && !Sound.pauseSuspended);

  Settings.set('video.quality', 'high');
  const spatialKinds = [];
  Sound.resetState();
  Sound.allocator.reset();
  audioTestPlace(1, 5, 0, 5);
  Sound.enqueue(Sound.recipeIndex('rifle'), true, 5, 1, 5, 1, 1, 1);
  Sound.update(AUDIO_TEST_FRAME);
  spatialKinds.push(Sound.slots[0].spatialKind);
  Settings.set('video.quality', 'medium');
  Sound.resetState();
  Sound.allocator.reset();
  Sound.enqueue(Sound.recipeIndex('rifle'), true, 5, 1, 5, 1, 1, 1);
  Sound.update(AUDIO_TEST_FRAME);
  spatialKinds.push(Sound.slots[0].spatialKind);
  check('HRTF panning on High and up, equal-power stereo below', spatialKinds.join(',') === 'hrtf,stereo', spatialKinds.join(','));
  void pause;
  Bus.off('toast', handler);
  audioTestFinish();
});

// ---- Scheduling cost, stealing, pulses, retrigger, music layers (review fixes) ----

// An OfflineAudioContext does not advance by itself: the test sets the clock by hand.
function audioTestClock(context) {
  const clock = { time: 0 };
  Object.defineProperty(context, 'currentTime', { get: () => clock.time });
  return clock;
}

// Registers extra recipes for one test; buildSoundRecipes() puts the real table back.
function audioTestRegister(rows) {
  registerSoundRecipes(Sound.recipes.concat(rows.map((row, offset) => finishSoundRecipe(row, Sound.recipes.length + offset))));
}

// Runs `script(clock)` against a fresh offline context and returns channel 0 of what it rendered.
async function audioTestRenderScript(seconds, script) {
  const context = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
  Sound.contextFactory = () => context;
  Sound.assumeRunning = true;
  Sound.unlock();
  script(audioTestClock(context));
  const buffer = await context.startRendering();
  Sound.detach();
  return buffer.getChannelData(0);
}

// Pitch of a steady tone from its zero crossings between two times.
function audioTestFrequency(samples, fromSeconds, toSeconds) {
  const first = Math.floor(fromSeconds * 44100), last = Math.floor(toSeconds * 44100);
  let crossings = 0;
  for (let i = first + 1; i < last; i++) if ((samples[i - 1] < 0) !== (samples[i] < 0)) crossings++;
  return crossings / 2 / (toSeconds - fromSeconds);
}

// Several enemies fire at once, each from its own spot ahead of the listener (distinct sources and places, so nothing is merged).
function audioTestVolley(count, firstId) {
  for (let k = 0; k < count; k++) {
    Bus.emit('weapon.fire', { id: firstId + k, weapon: 'x', weaponClass: 'rifle', mode: 'primary', x: k * 3 - 12, y: 1.5, z: 15, dx: 0, dy: 0, dz: -1 });
  }
}

Test.add('audio', (check) => {
  audioTestStart();
  const made = audioTestAttach();
  const clock = audioTestClock(made.context);
  Sound.resetState();
  Sound.allocator.reset();
  // A big fight: eight explosions and six distant shooters every frame, a moving clock, a full pool, so nearly every start steals.
  const frames = 660, warmUp = 60;
  const costs = new Float64Array(frames - warmUp);
  for (let frame = 0; frame < frames; frame++) {
    const begin = performance.now();
    for (let k = 0; k < 8; k++) {
      Bus.emit('explosion', { x: ((frame * 7 + k * 13) % 40) - 20, y: 1, z: 8 + ((frame * 5 + k * 11) % 30), radius: 4, owner: 10 + k, source: 'x', element: '' });
    }
    for (let k = 0; k < 6; k++) {
      Bus.emit('weapon.fire', { id: 20 + k, weapon: 'x', weaponClass: 'rifle', mode: 'primary', x: k * 4 - 10, y: 1.5, z: 10 + (frame + k) % 25, dx: 0, dy: 0, dz: -1 });
    }
    clock.time += AUDIO_TEST_FRAME;
    Sound.update(AUDIO_TEST_FRAME);
    if (frame >= warmUp) costs[frame - warmUp] = performance.now() - begin;
  }
  const stats = Sound.stats();
  costs.sort();
  const average = costs.reduce((sum, value) => sum + value, 0) / costs.length;
  const p95 = costs[Math.floor(costs.length * 0.95)];
  check('the heavy fight really saturates the pool: most starts steal a voice', stats.started > frames && stats.stolen > stats.started / 2 && stats.maxStartedPerFrame <= 4, JSON.stringify(stats));
  check('audio work stays under 0.3 ms per frame on average, steals included (AUD-007)', average < 0.3, average.toFixed(3) + ' ms');
  check('and the slow frames stay short too (95th percentile)', p95 < 0.6, p95.toFixed(3) + ' ms, worst ' + costs[costs.length - 1].toFixed(2));
  audioTestFinish();
});

Test.add('audio', (check) => {
  audioTestStart();
  audioTestAttach();
  const captions = audioTestCaptions();
  Sound.nowMs = () => 0;                              // a frozen clock: only the voice cap limits this part
  audioTestVolley(8, 10);
  Sound.update(AUDIO_TEST_FRAME);
  check('the voice cap lets 4 new voices start in a frame', Sound.startedThisFrame === 4, Sound.startedThisFrame);
  check('shots that got no voice are still captioned (ACC-003)', captions.length === 8 && captions.every((caption) => caption.kind === 'gunfire'), captions.length);

  Sound.resetState();
  Sound.allocator.reset();
  let fake = 0;
  Sound.nowMs = () => (fake += 0.15);                 // a slow phone: every look at the clock costs 0.15 ms
  audioTestVolley(8, 10);
  Sound.update(AUDIO_TEST_FRAME);
  check('the time budget stops further voice starts in a frame', Sound.startedThisFrame === 2, Sound.startedThisFrame);
  Sound.resetState();
  Sound.allocator.reset();
  fake = 0;
  Sound.nowMs = () => (fake += 5);
  audioTestVolley(8, 10);
  Sound.update(AUDIO_TEST_FRAME);
  check('but the first voice always starts', Sound.startedThisFrame === 1, Sound.startedThisFrame);

  Settings.set('video.quality', 'potato');
  Sound.refreshQuality();
  Sound.resetState();
  Sound.allocator.reset();
  Sound.nowMs = () => 0;
  audioTestVolley(8, 10);
  Sound.update(AUDIO_TEST_FRAME);
  check('Potato starts 2 new voices in a frame', Sound.startedThisFrame === 2, Sound.startedThisFrame);
  Settings.set('video.quality', 'medium');
  captions.stop();
  audioTestFinish();
});

Test.add('audio', (check) => {
  const { bot } = audioTestStart();
  const lmg = Sound.recipeIndex('lmg');
  let accepted = 0;
  for (let frame = 0; frame < 60; frame++) {
    for (let k = 0; k < 2; k++) if (Sound.enqueue(lmg, true, k * 5, 1, 10, bot, 1, 1)) accepted++;
    Sound.update(AUDIO_TEST_FRAME);
  }
  check('a beam-like source that asks every frame starts a sound about every 0.07 s', accepted >= 12 && accepted <= 16, accepted);
  check('another actor is not held back by it', Sound.enqueue(lmg, true, 0, 1, 10, bot + 5, 1, 1));
  Sound.update(AUDIO_TEST_FRAME);
  check('recipes without a retrigger time are never held back', Sound.recipeById.get('impact.dirt').retrigger === 0 && Sound.enqueue(Sound.recipeIndex('impact.dirt'), true, 0, 1, 10, bot, 1, 1)
    && Sound.enqueue(Sound.recipeIndex('impact.dirt'), true, 30, 1, 10, bot, 1, 1));
  Sound.resetState();
  check('a new match clears the retrigger times', Sound.enqueue(lmg, true, 0, 1, 10, bot, 1, 1));
  audioTestFinish();
});

Test.add('audio', (check) => {
  const { player } = audioTestStart();
  const before = SoundQueue.count;
  Bus.emit('impact', { x: NaN, y: 1, z: 5, nx: 0, ny: 0, nz: -1, material: 'glass', weapon: 'x', owner: player });
  Bus.emit('impact', { y: 1, z: 5, material: 'glass', owner: player });
  Bus.emit('ping', { id: player, kind: 'danger', x: 1, y: Infinity, z: 2 });
  check('events with a missing or NaN position are skipped', SoundQueue.count === before);
  Bus.emit('move.step', { id: 9999, speed: 5, surface: 'metal' });
  Bus.emit('move.step', { id: MAX_ACTORS - 1, speed: 5, surface: 'metal' });
  Bus.emit('weapon.reload', { id: -4, weapon: 'x' });
  check('actor events with an unknown id are skipped', SoundQueue.count === before);
  Bus.emit('impact', { x: 1, y: 1, z: 5, material: 'glass', owner: player });
  check('a complete position is still accepted', SoundQueue.count === before + 1);
  audioTestFinish();
});

Test.add('audio', async (check) => {
  audioTestStart();
  audioTestRegister([{ id: 'testOverlap', pulses: [0, 0.1], pitchSteps: [1, 2], tone: { from: 400, to: 400, decay: 0.3, gain: 1 } }]);
  const samples = await audioTestRenderScript(0.5, () => {
    Sound.enqueue(Sound.recipeIndex('testOverlap'), false, 0, 0, 0, -1, 1, 1);
    Sound.update(AUDIO_TEST_FRAME);
  });
  const first = audioTestFrequency(samples, 0.012, 0.06), second = audioTestFrequency(samples, 0.13, 0.19);
  check('the second pulse of a sting lands on its own pitch, an octave above the first', Test.near(second / first, 2, 0.15), first.toFixed(0) + ' Hz then ' + second.toFixed(0) + ' Hz');
  buildSoundRecipes();
  audioTestFinish();
});

Test.add('audio', async (check) => {
  audioTestStart();
  audioTestRegister([
    { id: 'testStung', pulses: [0, 0.15], pitchSteps: [1, 3], tone: { from: 400, to: 400, decay: 0.1, gain: 1 } },
    { id: 'testSteady', tone: { from: 1000, to: 1000, decay: 0.5, gain: 1 } },
  ]);
  let stolen = 0;
  const samples = await audioTestRenderScript(0.5, (clock) => {
    Sound.allocator.limit = 1;
    Sound.enqueue(Sound.recipeIndex('testStung'), false, 0, 0, 0, -1, 1, 1);
    Sound.update(AUDIO_TEST_FRAME);
    clock.time = 0.03;                                 // the stung voice is still ringing, its second pulse (3x pitch) is pending
    Sound.enqueue(Sound.recipeIndex('testSteady'), false, 0, 0, 0, -1, 1, 1);
    Sound.update(AUDIO_TEST_FRAME);
    stolen = Sound.allocator.stolen;
  });
  const pitch = audioTestFrequency(samples, 0.16, 0.24);
  check('the second sound stole the voice of the first', stolen === 1, stolen);
  check('a stolen voice keeps nothing of the old pitch automation', Test.near(pitch, 1000, 90), pitch.toFixed(0) + ' Hz (1200 Hz = the old pulse survived)');
  buildSoundRecipes();
  audioTestFinish();
});

Test.add('audio', (check) => {
  audioTestStart();
  Game.state = 'playing';
  audioTestAttach();
  Sound.setMusicMood('calm');
  SoundMusic.update(0.3);
  const nodes = SoundMusic.nodes;
  for (let i = 0; i < 24; i++) SoundMusic.update(0.25);
  check('layers that stay silent are cut from the output', !!nodes && !nodes.linked.boss && !nodes.linked.combat && nodes.linked.calm, JSON.stringify(nodes && nodes.linked));
  Sound.setMusicMood('boss');
  SoundMusic.update(0.25);
  check('a layer that is wanted again is reconnected', nodes.linked.boss && nodes.linked.combat && nodes.linked.calm);
  Sound.setMusicMood('calm');
  for (let i = 0; i < 12; i++) SoundMusic.update(0.25);
  check('a layer silent for 3 s is still connected', nodes.linked.boss === true);
  for (let i = 0; i < 5; i++) SoundMusic.update(0.25);
  check('and it is cut again after 4 silent seconds', nodes.linked.boss === false);
  Sound.setMusicMood('boss');
  SoundMusic.update(0.25);
  Sound.setMusicMood('calm');
  for (let i = 0; i < 8; i++) SoundMusic.update(0.25);
  check('a short break in the music keeps the layer connected', nodes.linked.boss === true);
  audioTestFinish();
});
