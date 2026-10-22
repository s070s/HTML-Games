// Mutators X01..X50 (spec section 14). A mutator is a set of data operations that S13 (13h-mutators.js) applies to the
// built ruleset in the 'mutators' stage (MOV-001: after the bundle, before difficulty), plus - for effects that cannot be
// a static field - a runtime effect that 13h runs from the rule flags the operations leave in rules.fx.
//
// params: typed parameters. { key, kind: 'range' | 'choice', min, max, step, default, unit } or
//   { key, kind: 'choice', options: [...], labels: [...], default } (source: 'weaponSets' = the options are that catalogue's ids,
//   extra = further fixed options). A flag mutator has no params; its value is true. One param -> the value is a number or a string;
//   several params -> the value is an object keyed by param key. A value of false means "not chosen".
// set: operations in order. { field, op, value } writes a literal; { field, op, param, scale, add } writes param value x scale + add.
//   field: a ruleset field or a dotted path ('respawn.delay', 'fx.radar.mode'); fx is the bag of effect flags other sections read.
//   op: 'set' | 'mul' (missing field counts as 1) | 'min' | 'max'
//       | 'mulMove' (fields: [...] of the movement preset, multiplied and written to moveOverrides)
//       | 'setMove' (field of moveOverrides = value) | 'atLeastMove' (preset field raised to at least value)
//       | 'weaponList' (value: weapon codes or keys; the match is armed with exactly these weapons)
//       | 'weaponSet' (param: a weapon set id, 'random', or a list of weapon keys)
// conflicts: ids that cannot be combined with this one (symmetric; the later choice wins, MUT-002).
// Times are seconds, speeds metres per second, percentages are whole numbers.

const MUTATOR_SPEED_FIELDS = ['groundSpeed', 'sprintSpeed', 'tacSprintSpeed', 'airWishCap', 'wallRunSpeed'];
const MUTATOR_PERCENT = 0.01;

function mutatorPercentParam(min, max, step, standard, key) {
  return { key: key || 'value', kind: 'range', min, max, step, default: standard, unit: '%' };
}
function mutatorPercentOp(field, op) { return { field, op, param: 'value', scale: MUTATOR_PERCENT }; }
function mutatorFlagOp(field) { return { field, op: 'set', value: true }; }

Data.define('mutators', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, effect: '', params: [], set: [], conflicts: [],
}, [
  { id: 'gravity', code: 'X01', name: 'Gravity', effect: 'Scales gravity for everyone.', params: [mutatorPercentParam(25, 300, 5, 50)], set: [mutatorPercentOp('gravityScale', 'mul')] },
  { id: 'gamespeed', code: 'X02', name: 'Game Speed', effect: 'Runs the whole simulation faster or slower.', params: [mutatorPercentParam(50, 200, 5, 125)], set: [mutatorPercentOp('fx.timeScale', 'mul')] },
  { id: 'playerspeed', code: 'X03', name: 'Player Speed', effect: 'Scales every run speed of the movement preset.', params: [mutatorPercentParam(25, 300, 5, 150)],
    set: [{ field: '', op: 'mulMove', fields: MUTATOR_SPEED_FIELDS, param: 'value', scale: MUTATOR_PERCENT }] },
  { id: 'dmgout', code: 'X04', name: 'Damage Dealt', effect: 'Scales all damage dealt by actors.', params: [mutatorPercentParam(25, 400, 5, 200)], set: [mutatorPercentOp('fx.damageOut', 'mul')] },
  { id: 'dmgin', code: 'X05', name: 'Damage Taken', effect: 'Scales all damage taken.', params: [mutatorPercentParam(25, 400, 5, 50)], set: [mutatorPercentOp('fx.damageIn', 'mul')] },
  { id: 'health', code: 'X06', name: 'Health', effect: 'Everyone starts with this much health, which is also the maximum.',
    params: [{ key: 'value', kind: 'range', min: 25, max: 500, step: 5, default: 200, unit: 'HP' }], set: [{ field: 'fx.health', op: 'set', param: 'value' }] },
  { id: 'shields', code: 'X07', name: 'Shields', effect: 'Shield pool as a share of the preset shield (50 points when it has none). Off removes shields.',
    params: [mutatorPercentParam(0, 300, 50, 150)], set: [{ field: 'fx.shields', op: 'set', param: 'value' }] },
  { id: 'oneshot', code: 'X08', name: 'One-Shot', effect: 'Everyone has the Lancet Rail with infinite ammo. One hit kills. No items.',
    set: [{ field: '', op: 'weaponList', value: ['W23'] }, mutatorFlagOp('fx.infiniteAmmo'), mutatorFlagOp('fx.oneHit'), mutatorFlagOp('fx.noItems'), mutatorFlagOp('fx.noPowerups'), { field: 'items', op: 'set', value: false }],
    conflicts: ['rocketpit', 'weaponset', 'superpowerups', 'volatile'] },
  { id: 'rocketpit', code: 'X09', name: 'Rocket Pit', effect: 'Everyone has only the Ramjet Launcher with infinite ammo.',
    set: [{ field: '', op: 'weaponList', value: ['W31'] }, mutatorFlagOp('fx.infiniteAmmo'), { field: 'items', op: 'set', value: false }],
    conflicts: ['oneshot', 'weaponset', 'volatile'] },
  { id: 'weaponset', code: 'X10', name: 'Weapon Set', effect: 'Chooses the weapon set, a custom weapon list, or a random set.',
    params: [{ key: 'value', kind: 'choice', source: 'weaponSets', extra: ['random'], default: 'fullSet' }], set: [{ field: '', op: 'weaponSet', param: 'value' }],
    conflicts: ['oneshot', 'rocketpit'] },
  { id: 'weaponstay', code: 'X11', name: 'Weapon Stay', effect: 'Picked-up weapons stay on their pads.', set: [{ field: 'weaponStay', op: 'set', value: true }] },
  { id: 'dropall', code: 'X12', name: 'Drop on Death', effect: 'What a dead actor leaves behind.',
    params: [{ key: 'value', kind: 'choice', options: ['none', 'held', 'all'], labels: ['Nothing', 'Held weapon', 'Everything'], default: 'all' }], set: [{ field: 'dropOnDeath', op: 'set', param: 'value' }] },
  { id: 'vampire', code: 'X13', name: 'Vampire', effect: 'Damage dealt heals the attacker for this share.', params: [mutatorPercentParam(10, 100, 5, 50)], set: [mutatorPercentOp('fx.lifesteal', 'set')] },
  { id: 'bighead', code: 'X14', name: 'Big Head', effect: 'Heads are 2.5 times larger.', set: [{ field: 'fx.headScale', op: 'set', value: 2.5 }] },
  { id: 'infammo', code: 'X15', name: 'Infinite Ammo', effect: 'Reserve ammo never runs out.', set: [mutatorFlagOp('fx.infiniteAmmo')] },
  { id: 'nopowerups', code: 'X16', name: 'No Powerups', effect: 'Powerups are removed from the map.', set: [mutatorFlagOp('fx.noPowerups')], conflicts: ['superpowerups'] },
  { id: 'superpowerups', code: 'X17', name: 'Super Powerups', effect: 'Everyone receives a random powerup at this interval.',
    params: [{ key: 'value', kind: 'range', min: 15, max: 120, step: 5, default: 60, unit: 's' }], set: [{ field: 'fx.superPowerups', op: 'set', param: 'value' }],
    conflicts: ['nopowerups', 'oneshot'] },
  { id: 'regen', code: 'X18', name: 'Regeneration', effect: 'Everyone regains health every second.',
    params: [{ key: 'value', kind: 'range', min: 1, max: 25, step: 1, default: 5, unit: 'HP/s' }], set: [{ field: 'fx.regen', op: 'set', param: 'value' }], conflicts: ['limbs'] },
  { id: 'noself', code: 'X19', name: 'No Self Damage', effect: 'Your own weapons never hurt you; knockback stays.', set: [{ field: 'selfDamage', op: 'set', value: 0 }] },
  { id: 'freejump', code: 'X20', name: 'Free Weapon Jumps', effect: 'Weapon jumps cost nothing: no self damage and no fall damage.',
    set: [{ field: 'selfDamage', op: 'set', value: 0 }, mutatorFlagOp('fx.noFallDamage')] },
  { id: 'ff', code: 'X21', name: 'Friendly Fire', effect: 'How much damage teammates deal to each other.',
    params: [{ key: 'value', kind: 'choice', options: [0, 50, 100], labels: ['0%', '50%', '100%'], default: 50 }], set: [mutatorPercentOp('friendlyFire', 'set')], conflicts: ['hardcore'] },
  { id: 'handicap', code: 'X22', name: 'Handicap', effect: 'The player deals only this share of normal damage (bots use their own handicap).', params: [mutatorPercentParam(25, 100, 5, 50)],
    set: [mutatorFlagOp('fx.handicap'), { field: 'fx.handicapPlayer', op: 'set', param: 'value', scale: MUTATOR_PERCENT }] },
  { id: 'knockback', code: 'X23', name: 'Knockback', effect: 'Scales the push of every hit and blast.', params: [mutatorPercentParam(0, 300, 10, 200)], set: [mutatorPercentOp('knockback', 'mul')] },
  { id: 'aircontrol', code: 'X24', name: 'Air Control Assist', effect: 'Everyone steers in the air with the air-control assist.', set: [] },   // no field: S10 reads the id from the mutator list
  { id: 'autohop', code: 'X25', name: 'Auto-Hop', effect: 'Holding jump repeats the jump.', set: [] },   // no field: S10 reads the id from the mutator list
  { id: 'multijump', code: 'X26', name: 'Multi-Jump', effect: 'Extra jumps in the air.',
    params: [{ key: 'value', kind: 'range', min: 0, max: 4, step: 1, default: 2, unit: '' }],
    set: [{ field: 'extraJumps', op: 'setMove', param: 'value' }, { field: 'extraJumpVel', op: 'atLeastMove', value: 6 }] },
  { id: 'slowmokills', code: 'X27', name: 'Kill Slow-Mo', effect: 'Your kill slows time to half for 1.5 seconds.', set: [mutatorFlagOp('fx.slowmoKills')] },
  { id: 'headonly', code: 'X28', name: 'Headshots Only', effect: 'Bullets that miss the head do no damage.', set: [mutatorFlagOp('fx.headOnly')] },
  { id: 'lastgift', code: 'X29', name: 'Last Gift', effect: 'A dying actor drops a live grenade.', set: [mutatorFlagOp('fx.lastGift')] },
  { id: 'volatile', code: 'X30', name: 'Volatile Ammo', effect: 'Ammo pickups explode when shot.', set: [mutatorFlagOp('fx.volatileAmmo')], conflicts: ['oneshot', 'rocketpit'] },
  { id: 'colossal', code: 'X31', name: 'Growth', effect: 'Each kill adds 5% size and health, up to 50%, until you die.', set: [mutatorFlagOp('fx.growth')], conflicts: ['shrinkhit', 'limbs'] },
  { id: 'lives', code: 'X32', name: 'Lives', effect: 'Lives per player; out of lives means out of the match.',
    params: [{ key: 'value', kind: 'range', min: 1, max: 10, step: 1, default: 3, unit: '' }], set: [{ field: 'lives', op: 'set', param: 'value' }] },
  { id: 'respawn', code: 'X33', name: 'Respawn Time', effect: 'Delay before a respawn; a wave interval above 0 groups respawns into waves.',
    params: [{ key: 'delay', kind: 'range', min: 0, max: 15, step: 1, default: 5, unit: 's' }, { key: 'wave', kind: 'range', min: 0, max: 30, step: 5, default: 0, unit: 's' }],
    set: [{ field: 'respawn.delay', op: 'set', param: 'delay' }, { field: 'respawn.wave', op: 'set', param: 'wave' }, { field: 'respawn.forced', op: 'max', param: 'delay', add: 5 }] },
  { id: 'protect', code: 'X34', name: 'Spawn Protection', effect: 'Seconds of protection after a spawn (it ends when you fire).',
    params: [{ key: 'value', kind: 'range', min: 0, max: 5, step: 0.5, default: 3, unit: 's' }], set: [{ field: 'respawn.protect', op: 'set', param: 'value' }] },
  { id: 'radar', code: 'X35', name: 'Motion Tracker', effect: 'Shows moving actors on the radar within range.',
    params: [{ key: 'mode', kind: 'choice', options: ['off', 'team', 'all'], labels: ['Off', 'Team', 'Everyone'], default: 'team' },
      { key: 'range', kind: 'range', min: 10, max: 50, step: 5, default: 25, unit: 'm' }],
    set: [{ field: 'fx.radar.mode', op: 'set', param: 'mode' }, { field: 'fx.radar.range', op: 'set', param: 'range' }] },
  { id: 'hardcore', code: 'X36', name: 'Hardcore HUD', effect: 'No HUD, full friendly fire and 30% health.',
    set: [mutatorFlagOp('fx.noHud'), { field: 'friendlyFire', op: 'set', value: 1 }, { field: 'fx.healthScale', op: 'mul', value: 0.3 }], conflicts: ['ff', 'limbs'] },
  { id: 'darkness', code: 'X37', name: 'Lights Out', effect: 'Dense fog; only flashlights show the way.', set: [mutatorFlagOp('fx.darkness')] },
  { id: 'airborne', code: 'X38', name: 'Sky Duel', effect: 'Only airborne targets take damage.', set: [mutatorFlagOp('fx.airborneOnly')] },
  { id: 'shrinkhit', code: 'X39', name: 'Diminish', effect: 'Every hit shrinks the target by 5%, down to 50%, until it dies.', set: [mutatorFlagOp('fx.shrinkHit')], conflicts: ['colossal'] },
  { id: 'mirror', code: 'X40', name: 'Mirror Match', effect: 'Bots copy your loadout and hero.', set: [mutatorFlagOp('fx.mirror')] },
  { id: 'ballistics', code: 'X41', name: 'Ballistics', effect: 'Hitscan shots become projectiles with drop and drag.', set: [{ field: 'fx.ballistics', op: 'set', value: { gravity: 9.8, drag: 0.05 } }] },
  { id: 'tags', code: 'X42', name: 'Confirm Kills', effect: 'Kills drop tags; the score comes when your side collects them.',
    set: [mutatorFlagOp('fx.tags'), { field: 'scoring.kill', op: 'set', value: 0 }, { field: 'scoring.tag', op: 'set', value: 1 }] },
  { id: 'adrenaline', code: 'X43', name: 'Combos', effect: 'Turns the adrenaline meter on.', set: [{ field: 'meter', op: 'set', value: 'adrenaline' }] },
  { id: 'suppression', code: 'X44', name: 'Suppression', effect: 'Shots passing close blur the view, widen your spread and delay health regeneration.', set: [mutatorFlagOp('fx.suppression')] },
  { id: 'itemfrenzy', code: 'X45', name: 'Item Frenzy', effect: 'Items respawn four times faster.', set: [{ field: 'itemRespawnScale', op: 'mul', value: 0.25 }] },
  { id: 'powers', code: 'X46', name: 'Powers for All', effect: 'Every life you get one random ability.', set: [mutatorFlagOp('fx.powers')] },
  { id: 'triangle', code: 'X47', name: 'Resource Triangle', effect: 'Melee kills refill health and ammo, burning kills give armor. Reserve ammo is halved.', set: [mutatorFlagOp('fx.triangle')], conflicts: ['limbs'] },
  { id: 'cards', code: 'X48', name: 'Cards Allowed', effect: 'Enables cards in versus matches.', set: [mutatorFlagOp('fx.cards')] },
  { id: 'limbs', code: 'X49', name: 'Locational Damage', effect: 'Each limb has its own health pool.', set: [{ field: 'health', op: 'set', value: 'limb' }],
    conflicts: ['health', 'hardcore', 'vampire', 'regen', 'colossal', 'triangle'] },
  { id: 'wildlife', code: 'X50', name: 'Wildlife', effect: 'Four neutral beasts attack the nearest actor; flares lure them.', set: [{ field: 'fx.wildlife', op: 'set', value: 4 }] },
]);
