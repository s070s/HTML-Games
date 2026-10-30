// ==== S03 DATA: GRENADES AND GADGETS ====
// G01..G24 (spec section 9, GAD-001..GAD-003): 17 rows; P3-06 retired G05, G11, G12, G14, G16, G17 and G19 (codes never reused;
// the migration map is GADGET_MIGRATION in 04-save). Generic code in 12c (thrown, areas, smoke) and 12d (placed and deployed)
// reads these fields; `effect` picks the behaviour. Times in seconds, distances in metres, damage in HP.
//
// kind: 'thrown' (BTN.GRENADE, 18 m/s + 5 up, GAD-002), 'placed' (BTN.GADGET, set on the floor or a surface in front),
// 'deployed' (BTN.GADGET, a device in front of the owner). carry: most carried of this row (kits may lower it).
// fuse: seconds from the throw (cook: the fuse runs while the button is held); impact: goes off on the first contact.
// stick / stickActors: sticks to surfaces / actors. bounce: speed kept on a bounce. radius: effect radius; duration:
// effect seconds; damage: HP (peak HP/s for fire areas); status + statusSeconds: the HP-005 status it applies.
// Placed/deployed: health (0 = cannot be destroyed), arm (s before it works), trigger (proximity m), coneDeg (360 = all
// around), range, rate (shots/s), max (active per owner, GAD-003: 1 each type), perTeam (one per team), cooldown
// (s to recharge one use; 0 = consumed), count (devices per use), speed (drones m/s),
// amount (supply: fraction of max ammo per second), charges (trophy: projectiles it can stop), knockback (m/s), pull (m/s^2),
// crouchSafe (mines: crouched or prone enemies pass without setting it off).
// slot (P3-06): the loadout slot of the row: 'lethal' (thrown damage), 'tactical' (thrown utility) or 'device' (placed or deployed).
// loadout (gadget kits): true = the player's saved pickup loadout (13d) picks the lethal, tactical and device instead of the kit's grenades.
Data.define('gadgets', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, kind: REQUIRED, slot: '', effect: REQUIRED, carry: 1, cooldown: 0, fuse: 0, cook: false,
  impact: false, stick: false, stickActors: false, bounce: 0.45, radius: 0, duration: 0, damage: 0, element: 'kinetic',
  status: '', statusSeconds: 0, ownerSafe: false, health: 0, arm: 0, trigger: 0, coneDeg: 360, range: 0, rate: 0, max: 1,
  perTeam: false, count: 1, charges: 0, speed: 0, amount: 0, knockback: 0, pull: 0,
  crouchSafe: false, size: [0.3, 0.3, 0.3], color: 0x808080, index: 0,
}, [
  { id: 'frag', code: 'G01', name: 'Frag Charge', kind: 'thrown', slot: 'lethal', effect: 'explode', carry: 2, fuse: 2.5, cook: true, radius: 5, damage: 100,
    size: [0.22, 0.22, 0.22], color: 0x4a5a3a },
  { id: 'smoke', code: 'G02', name: 'Veil Canister', kind: 'thrown', slot: 'tactical', effect: 'smoke', fuse: 1.5, radius: 5, duration: 18,
    size: [0.14, 0.26, 0.14], color: 0x9a9a9a },
  { id: 'flash', code: 'G03', name: 'Glare Shell', kind: 'thrown', slot: 'tactical', effect: 'flash', carry: 2, fuse: 1.5, radius: 20, duration: 3.5, status: 'blind',
    size: [0.12, 0.24, 0.12], color: 0xdadada },
  { id: 'incendiary', code: 'G04', name: 'Cinder Jar', kind: 'thrown', slot: 'lethal', effect: 'fire', impact: true, fuse: 4, radius: 3, duration: 7, damage: 40,
    element: 'thermal', status: 'burn', statusSeconds: 2, size: [0.18, 0.24, 0.18], color: 0xb05a20 },
  { id: 'sticky', code: 'G06', name: 'Leech Charge', kind: 'thrown', slot: 'lethal', effect: 'explode', fuse: 1.5, stick: true, stickActors: true, radius: 3.5, damage: 110,
    size: [0.2, 0.2, 0.2], color: 0x40a0ff },
  { id: 'impulse', code: 'G07', name: 'Kick Charge', kind: 'thrown', slot: 'tactical', effect: 'impulse', impact: true, fuse: 2, radius: 4, damage: 10, knockback: 18, ownerSafe: true,
    size: [0.2, 0.2, 0.2], color: 0x60e0ff },
  { id: 'cryo', code: 'G08', name: 'Rime Bomb', kind: 'thrown', slot: 'tactical', effect: 'freeze', fuse: 1.5, radius: 4, status: 'freeze', statusSeconds: 3, element: 'cryo',
    size: [0.22, 0.22, 0.22], color: 0xb0e8ff },
  { id: 'singularity', code: 'G09', name: 'Sink Charge', kind: 'thrown', slot: 'tactical', effect: 'singularity', fuse: 1, radius: 6, duration: 4, damage: 60, pull: 14, element: 'void',
    size: [0.24, 0.24, 0.24], color: 0x7a40ff },
  { id: 'claymore', code: 'G10', name: 'Tripjaw Mine', kind: 'placed', slot: 'device', effect: 'mine', arm: 1.5, trigger: 2.5, coneDeg: 60, crouchSafe: true, radius: 3, damage: 150, health: 30,
    size: [0.3, 0.2, 0.12], color: 0x3a4a2a },
  { id: 'cover', code: 'G13', name: 'Barrier Deploy', kind: 'deployed', slot: 'device', effect: 'barrier', health: 300, duration: 30, cooldown: 60,
    size: [2, 1.2, 0.3], color: 0x7a8088 },
  { id: 'sentry', code: 'G15', name: 'Picket Turret', kind: 'deployed', slot: 'device', effect: 'turret', health: 150, damage: 9, rate: 5, range: 25, duration: 30, cooldown: 120,
    size: [0.5, 0.8, 0.5], color: 0x8a6a3a },
  { id: 'jammer', code: 'G18', name: 'Static Jammer', kind: 'deployed', slot: 'device', effect: 'jammer', radius: 20, duration: 30, health: 50, cooldown: 60,
    size: [0.3, 0.6, 0.3], color: 0xd0d040 },
  { id: 'emp', code: 'G20', name: 'Null Pulse', kind: 'thrown', slot: 'tactical', effect: 'emp', fuse: 1.5, radius: 6, duration: 4, element: 'arc',
    size: [0.22, 0.22, 0.22], color: 0xfff27a },
  { id: 'ticks', code: 'G21', name: 'Scuttler', kind: 'deployed', slot: 'device', effect: 'drones', count: 2, range: 30, damage: 60, radius: 2.5, health: 20, speed: 6, duration: 30,
    cooldown: 90, max: 2, size: [0.3, 0.2, 0.3], color: 0xff6040 },
  { id: 'trophy', code: 'G22', name: 'Snatcher', kind: 'deployed', slot: 'device', effect: 'trophy', radius: 6, count: 1, charges: 3, duration: 30, health: 40, cooldown: 90,
    size: [0.3, 0.5, 0.3], color: 0x50a0a0 },
  { id: 'ammobox', code: 'G23', name: 'Supply Crate', kind: 'deployed', slot: 'device', effect: 'supply', radius: 3, duration: 20, amount: 0.2, cooldown: 60,
    size: [0.6, 0.4, 0.4], color: 0xa89050 },
  { id: 'beacon', code: 'G24', name: 'Rally Beacon', kind: 'deployed', slot: 'device', effect: 'beacon', perTeam: true, duration: 60, health: 100, cooldown: 120,
    size: [0.3, 0.9, 0.3], color: 0x40ff40 },
]);

// Spawn kits and carry rules per economy (GAD-001). grenades: { gadgetId: count } given on spawn; gadget: the gadget-slot
// row; total: most grenades carried in all (0 = no limit beyond each row's carry); perType: most of one type (0 = the row's
// carry); limits: per-row exceptions (round buy: 2 flash); refill: ammo caches give back one of each kit grenade.
Data.define('gadgetKits', {
  id: REQUIRED, grenades: {}, gadget: '', total: 0, perType: 0, limits: {}, refill: false, loadout: false,
}, [
  { id: 'pickups', grenades: { frag: 2 }, refill: true, loadout: true },
  { id: 'roundBuy', total: 4, perType: 1, limits: { flash: 2 } },
  { id: 'loot', total: 4 },
  { id: 'classes', grenades: { frag: 1, flash: 1 }, gadget: 'cover' },
  { id: 'heroKits' },
  { id: 'ladder' },
  { id: 'waveShop', grenades: { frag: 1 }, refill: true },
]);

// Shared tunables of grenades and devices (named here so tests and code read one source).
const GADGET_TUNING = {
  throwSpeed: 18, throwLift: 5,                // GAD-002 overhand throw
  underhandSpeed: 9, underhandLift: 2,         // GAD-002 underhand on ALT
  enemyGlintRange: 8,                          // GAD-003: enemy placed gadgets are visible within 8 m
  smokePunchSeconds: 2,                        // G02: bullets and explosions punch holes for 2 s
  smokeExpandSeconds: 1.5,                     // the volume grows to full size over this time
  flashMinimumAngle: 0.1,                      // flash: looking straight away still keeps this share of the blind
  flashMinimumDistance: 0.25,                  // flash: at the edge of its radius this share is left
  fireRampFrom: 0.25,                          // fire area: starts at this share of its peak HP/s
  turretSpreadDeg: 2,
  dropSpeed: 2,                                // a cooking grenade dropped at death rolls out at this speed
};
