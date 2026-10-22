// ==== S06 AUDIO: RECIPES AND EVENT ROWS ====
// Content is data. One recipe table drives every sound; one event table says which game event plays which recipe.
// Recipe layers (all optional, generic player code in 06-audio.js):
//   noise { filter, from, to, q, attack, decay, gain }   noise burst through a sweeping filter (the "crack")
//   tone  { wave, from, to, attack, decay, gain, partial }  oscillator glide (the "body"); partial = ratio of a second oscillator
//   pulses [seconds] + pitchSteps [factor]               the envelope repeats at each offset with that pitch factor (clicks, chirps, stings)
// Fields: bus (sfx|voice|ui|music), priority (AUDIO_PRIORITY key), ref/rolloff (distance level), nearRange (metres a near sound
// keeps its priority), range (metres; farther sounds are dropped), gain, occludes, caption + captionKind + captionGap (ACC-002/003),
// retrigger (seconds; one actor starts this recipe at most that often, so a beam asking every step does not eat the voice pool).
// Pulses must be in rising order; a pulse's decay is shortened to the room left before the next pulse (see finishSoundLayer).

const SOUND_RECIPE_DEFAULTS = {
  bus: 'sfx', priority: 'near', ref: 6, rolloff: 0.5, nearRange: 20, range: 150, gain: 1, occludes: true, noise: null, tone: null,
  pulses: [0], caption: null, captionKind: '', captionGap: 0.6, retrigger: 0,
};
const SOUND_PULSE_GAP = 0.002;                 // seconds between the end of one pulse and the start of the next
const SOUND_MIN_PULSE_DECAY = 0.01;           // every pulse needs at least this much decay left (checked by the self-test)
const SOUND_NOISE_DEFAULTS = { filter: 'bandpass', from: 1000, to: 1000, q: 1, attack: 0.002, decay: 0.1, gain: 1 };
const SOUND_TONE_DEFAULTS = { wave: 'sine', from: 440, to: 440, attack: 0.002, decay: 0.1, gain: 1, partial: 0 };

// Groups share defaults; each row is one sound. Weapon classes differ in crack, body and tail so guns can be told apart by ear (AUD-003).
const SOUND_RECIPE_GROUPS = [
  { defaults: { ref: 8, rolloff: 0.45, nearRange: 35, gain: 2.1, caption: 'Gunfire', captionKind: 'gunfire', captionGap: 0.7, retrigger: 0.07 }, rows: [
    { id: 'sidearm', gain: 2.8, noise: { from: 3200, to: 1400, q: 0.9, decay: 0.07, gain: 0.9 }, tone: { wave: 'triangle', from: 420, to: 140, decay: 0.09, gain: 0.5 } },
    { id: 'shotgun', noise: { filter: 'lowpass', from: 5000, to: 500, q: 0.7, decay: 0.32 }, tone: { from: 110, to: 45, decay: 0.26 } },
    { id: 'rifle', noise: { from: 2400, to: 800, q: 0.8, decay: 0.11 }, tone: { wave: 'triangle', from: 190, to: 75, decay: 0.13, gain: 0.7 } },
    { id: 'smg', gain: 3.2, noise: { from: 3800, to: 2000, q: 1.2, decay: 0.045, gain: 0.8 }, tone: { wave: 'square', from: 300, to: 200, decay: 0.05, gain: 0.3 } },
    { id: 'lmg', gain: 2.4, noise: { from: 1800, to: 650, q: 0.7, decay: 0.14 }, tone: { wave: 'sawtooth', from: 150, to: 60, decay: 0.15, gain: 0.6 } },
    { id: 'dmr', noise: { from: 2000, to: 600, q: 0.9, decay: 0.2 }, tone: { wave: 'triangle', from: 160, to: 55, decay: 0.22, gain: 0.9, partial: 1.5 } },
    { id: 'sniper', gain: 1.8, noise: { filter: 'lowpass', from: 6000, to: 350, q: 0.6, decay: 0.55, gain: 1.1 }, tone: { from: 90, to: 38, decay: 0.5, gain: 1.1 } },
    { id: 'rail', noise: { from: 7000, to: 1500, q: 2.5, attack: 0.004, decay: 0.35, gain: 0.7 }, tone: { from: 1400, to: 180, decay: 0.4, gain: 0.8, partial: 1.5 } },
    { id: 'launcher', ref: 10, noise: { filter: 'lowpass', from: 1800, to: 250, q: 0.7, decay: 0.45, gain: 0.9 }, tone: { from: 85, to: 30, decay: 0.4, gain: 1.1 } },
    { id: 'energy', gain: 2.6, noise: { from: 4500, to: 2500, q: 3, decay: 0.08, gain: 0.35 }, tone: { wave: 'sawtooth', from: 1100, to: 300, decay: 0.14, gain: 0.8 } },
    { id: 'heavy', noise: { from: 1500, to: 500, q: 0.6, decay: 0.09 }, tone: { wave: 'square', from: 95, to: 55, decay: 0.1, gain: 0.8 } },
    { id: 'melee', ref: 4, nearRange: 14, caption: null, noise: { from: 1100, to: 300, q: 0.5, attack: 0.03, decay: 0.18, gain: 0.8 }, tone: { from: 160, to: 90, attack: 0.02, decay: 0.12, gain: 0.3 } },
    { id: 'tool', caption: null, noise: { from: 2000, to: 1000, q: 4, decay: 0.12, gain: 0.5 }, tone: { from: 520, to: 780, decay: 0.2, gain: 0.6, partial: 1.5 } },
    { id: 'exotic', noise: { from: 900, to: 3000, q: 4, decay: 0.3, gain: 0.5 }, tone: { from: 300, to: 900, decay: 0.35, gain: 0.7, partial: 1.41 } },
    { id: 'power', gain: 2.0, ref: 14, rolloff: 0.3, nearRange: 60, noise: { filter: 'lowpass', from: 3500, to: 200, q: 0.7, decay: 1 }, tone: { wave: 'sawtooth', from: 70, to: 28, decay: 1, gain: 0.8, partial: 1.5 } },
    { id: 'flame', noise: { filter: 'lowpass', from: 2500, to: 900, q: 0.5, attack: 0.04, decay: 0.25 } },
    { id: 'suppressed', gain: 1.0, ref: 4, nearRange: 14, caption: 'Faint shots', noise: { filter: 'lowpass', from: 2500, to: 900, q: 0.6, decay: 0.06, gain: 0.5 }, tone: { from: 260, to: 120, decay: 0.05, gain: 0.3 } },
    { id: 'stab', gain: 1.0, ref: 3, nearRange: 10, caption: null, noise: { from: 1200, to: 400, q: 0.6, attack: 0.02, decay: 0.12, gain: 0.5 } },
    { id: 'bowshot', gain: 1.2, ref: 4, nearRange: 14, caption: null, noise: { from: 900, to: 300, q: 1.5, decay: 0.12, gain: 0.5 }, tone: { wave: 'triangle', from: 520, to: 180, decay: 0.15, gain: 0.5 } },
  ] },
  { defaults: { ref: 4, rolloff: 0.6, nearRange: 15, range: 30, gain: 1.4 }, rows: [   // movement
    { id: 'jump', gain: 1.6, noise: { from: 600, to: 1500, q: 0.8, attack: 0.03, decay: 0.12, gain: 0.5 } },
    { id: 'land', gain: 1.4, noise: { filter: 'lowpass', from: 900, to: 200, q: 0.7, decay: 0.12, gain: 0.6 }, tone: { from: 110, to: 55, decay: 0.15 } },
    { id: 'slide', noise: { from: 1200, to: 600, q: 0.7, attack: 0.05, decay: 0.35, gain: 0.6 } },
    { id: 'dash', gain: 2.4, noise: { from: 400, to: 3000, attack: 0.01, decay: 0.2, gain: 0.8 } },
    { id: 'mantle', noise: { filter: 'lowpass', from: 1500, to: 400, q: 0.7, decay: 0.15, gain: 0.6 }, tone: { wave: 'triangle', from: 140, to: 90, decay: 0.12, gain: 0.5 } },
    { id: 'wallrun', gain: 1.8, noise: { from: 900, to: 700, q: 2, attack: 0.02, decay: 0.25, gain: 0.6 } },
  ] },
  { defaults: { ref: 3, rolloff: 0.7, nearRange: 12, range: 20, gain: 1.0 }, rows: [   // weapon handling
    { id: 'reload', pulses: [0, 0.28], pitchSteps: [1, 0.8], gain: 1.0, noise: { from: 3500, to: 2500, q: 3, decay: 0.03, gain: 0.8 }, tone: { wave: 'square', from: 900, to: 700, decay: 0.03, gain: 0.3 } },
    { id: 'switch', pulses: [0, 0.07], pitchSteps: [1, 0.85], noise: { from: 3000, to: 2000, q: 3, decay: 0.025, gain: 0.8 }, tone: { wave: 'square', from: 700, to: 500, decay: 0.03, gain: 0.25 } },
    { id: 'empty', gain: 1.2, noise: { from: 4000, to: 3000, q: 2, decay: 0.02, gain: 0.6 }, tone: { wave: 'square', from: 1400, to: 1000, decay: 0.03, gain: 0.4 } },
  ] },
  { defaults: { priority: 'explosion', ref: 14, rolloff: 0.3, nearRange: 45, gain: 1.9, caption: 'Explosion', captionKind: 'explosion', captionGap: 0.4 }, rows: [
    { id: 'explosion', gain: 2.0, noise: { filter: 'lowpass', from: 3000, to: 120, q: 0.7, attack: 0.005, decay: 1.2 }, tone: { from: 70, to: 25, decay: 1, gain: 1.1 } },
    { id: 'explosionFire', noise: { filter: 'lowpass', from: 2500, to: 150, q: 0.6, attack: 0.01, decay: 1.4 }, tone: { wave: 'triangle', from: 80, to: 30, decay: 1.2 } },
    { id: 'explosionFrost', gain: 1.7, noise: { filter: 'highpass', from: 6000, to: 2500, q: 1.2, attack: 0.003, decay: 0.8, gain: 0.8 }, tone: { from: 800, to: 200, decay: 0.7, gain: 0.7, partial: 1.5 } },
    { id: 'explosionShock', gain: 1.8, noise: { from: 4000, to: 800, q: 2, decay: 0.6, gain: 0.9 }, tone: { wave: 'sawtooth', from: 300, to: 60, decay: 0.6, gain: 0.8 } },
  ] },
  { defaults: { priority: 'own', ref: 1, occludes: false, gain: 0.8 }, rows: [   // feedback only the local player hears (AUD-005)
    { id: 'hitTick', gain: 2.5, tone: { from: 1800, to: 1700, attack: 0.001, decay: 0.05, gain: 0.6 } },
    { id: 'headshot', pulses: [0, 0.06], pitchSteps: [1, 1.5], tone: { from: 2400, to: 2300, attack: 0.001, decay: 0.08, gain: 0.7, partial: 2 } },
    { id: 'damageTaken', gain: 1.5, noise: { filter: 'lowpass', from: 900, to: 200, q: 0.7, decay: 0.12, gain: 0.8 }, tone: { from: 90, to: 50, decay: 0.18, gain: 1.2 } },
    { id: 'killConfirm', pulses: [0, 0.09], pitchSteps: [1, 1.33], tone: { wave: 'triangle', from: 880, to: 860, decay: 0.12, gain: 0.7, partial: 2 } },
    { id: 'shieldBreak', gain: 0.9, ref: 6, noise: { filter: 'highpass', from: 7000, to: 1500, q: 0.8, decay: 0.35, gain: 0.8 }, tone: { wave: 'sawtooth', from: 1200, to: 200, decay: 0.3, gain: 0.5, partial: 1.5 } },
    { id: 'heartbeat', gain: 1, pulses: [0, 0.19], noise: { filter: 'lowpass', from: 180, to: 120, q: 0.7, decay: 0.12, gain: 0.3 }, tone: { from: 62, to: 42, attack: 0.01, decay: 0.16, gain: 1.4 } },
  ] },
  { defaults: { ref: 6, nearRange: 25, gain: 0.7 }, rows: [   // world cues other actors cause
    { id: 'death', gain: 1.2, noise: { filter: 'lowpass', from: 1200, to: 150, q: 0.7, decay: 0.5, gain: 0.6 }, tone: { from: 220, to: 60, decay: 0.6, gain: 0.8 } },
    { id: 'pickup', gain: 1.6, caption: 'Pickup', captionKind: 'item', captionGap: 0.8, tone: { wave: 'triangle', from: 500, to: 900, decay: 0.12, gain: 0.6 } },
    { id: 'pickupHealth', gain: 1.6, caption: 'Pickup', captionKind: 'item', captionGap: 0.8, tone: { from: 700, to: 1100, decay: 0.18, gain: 0.6, partial: 1.5 } },
    { id: 'pickupArmor', gain: 1.6, caption: 'Pickup', captionKind: 'item', captionGap: 0.8, tone: { wave: 'triangle', from: 350, to: 500, decay: 0.2, gain: 0.6, partial: 2.01 } },
    { id: 'pickupAmmo', gain: 1.6, caption: 'Pickup', captionKind: 'item', captionGap: 0.8, pulses: [0, 0.05], tone: { wave: 'square', from: 900, to: 700, decay: 0.05, gain: 0.3 } },
    { id: 'pickupWeapon', gain: 1.6, caption: 'Pickup', captionKind: 'item', captionGap: 0.8, pulses: [0, 0.1], pitchSteps: [1, 1.3], noise: { from: 2500, to: 1500, q: 2, decay: 0.06, gain: 0.6 }, tone: { wave: 'square', from: 300, to: 450, decay: 0.12, gain: 0.4 } },
    { id: 'powerChime', gain: 0.9, ref: 10, rolloff: 0.3, nearRange: 60, caption: 'Power item', captionKind: 'item', pulses: [0, 0.12, 0.24], pitchSteps: [1, 1.26, 1.5], tone: { from: 660, to: 650, decay: 0.5, gain: 0.8, partial: 2 } },
    { id: 'itemRespawn', gain: 0.6, ref: 8, nearRange: 30, caption: 'Item respawned', captionKind: 'item', pulses: [0, 0.1], pitchSteps: [1, 1.25], tone: { from: 523, to: 520, decay: 0.3, gain: 0.5 } },
    { id: 'grenadeTick', gain: 1.8, nearRange: 30, caption: 'Grenade', captionKind: 'alert', captionGap: 0.5, noise: { from: 4000, to: 3000, q: 3, decay: 0.02, gain: 0.5 }, tone: { wave: 'square', from: 2400, to: 2000, decay: 0.025, gain: 0.5 } },
    { id: 'rocketWhistle', gain: 0.8, ref: 20, rolloff: 0.3, nearRange: 80, caption: 'Rocket incoming', captionKind: 'alert', captionGap: 0.8, noise: { from: 2500, to: 1500, q: 3, attack: 0.1, decay: 0.6, gain: 0.3 }, tone: { from: 1800, to: 900, attack: 0.15, decay: 0.7, gain: 0.7 } },
    { id: 'abilityCast', gain: 1.2, ref: 8, noise: { from: 500, to: 2500, q: 2, attack: 0.05, decay: 0.3, gain: 0.5 }, tone: { from: 220, to: 660, attack: 0.02, decay: 0.3, gain: 0.6 } },
    { id: 'abilityEnd', gain: 1.2, tone: { from: 600, to: 300, decay: 0.2, gain: 0.5 } },
    { id: 'radioBlip', bus: 'voice', gain: 1.6, ref: 10, nearRange: 40, caption: 'Radio chatter', captionKind: 'voice', captionGap: 1.2, pulses: [0, 0.07], pitchSteps: [1, 1.25], noise: { from: 3000, to: 3000, q: 2, decay: 0.05, gain: 0.2 }, tone: { wave: 'square', from: 1200, to: 1200, decay: 0.03, gain: 0.3 } },
  ] },
  { defaults: { bus: 'voice', ref: 12, rolloff: 0.3, nearRange: 60, gain: 0.75, captionKind: 'voice', captionGap: 0.5 }, rows: [   // pings (AUD-005)
    { id: 'ping', caption: 'Ping', pulses: [0, 0.09], pitchSteps: [1, 1.5], tone: { from: 1000, to: 1000, decay: 0.1, gain: 0.6, partial: 2 } },
    { id: 'pingDanger', caption: 'Danger ping', gain: 0.8, pulses: [0, 0.08, 0.16], pitchSteps: [1.5, 1, 1.5], tone: { wave: 'triangle', from: 900, to: 900, decay: 0.1, gain: 0.6 } },
  ] },
  { defaults: { bus: 'ui', priority: 'ui', ref: 1, occludes: false, gain: 1.0 }, rows: [
    { id: 'uiClick', noise: { from: 3000, to: 2500, decay: 0.015, gain: 0.2 }, tone: { from: 900, to: 700, decay: 0.04, gain: 0.5 } },
    { id: 'uiBack', tone: { from: 600, to: 400, decay: 0.05, gain: 0.5 } },
    { id: 'uiConfirm', pulses: [0, 0.06], pitchSteps: [1, 1.5], tone: { from: 700, to: 700, decay: 0.07, gain: 0.5 } },
    { id: 'uiHover', gain: 1.0, tone: { from: 1200, to: 1200, decay: 0.02, gain: 0.25 } },
    { id: 'uiError', pulses: [0, 0.12], tone: { wave: 'square', from: 200, to: 150, decay: 0.1, gain: 0.3 } },
  ] },
  { defaults: { bus: 'voice', priority: 'ui', ref: 1, occludes: false, gain: 0.8 }, rows: [   // announcer and medal stings (UI-012)
    { id: 'announce', pulses: [0, 0.12, 0.24], pitchSteps: [1, 1.25, 1.5], tone: { wave: 'triangle', from: 440, to: 440, decay: 0.22, gain: 0.8, partial: 2 } },
    { id: 'announceWarn', gain: 0.5, pulses: [0, 0.18], pitchSteps: [1, 0.8], tone: { wave: 'square', from: 330, to: 330, decay: 0.3, gain: 0.4 } },
    { id: 'announceObjective', pulses: [0, 0.14], pitchSteps: [1, 1.33], tone: { wave: 'triangle', from: 520, to: 520, decay: 0.25, gain: 0.7, partial: 2 } },
    { id: 'announcePower', pulses: [0, 0.1, 0.2, 0.3], pitchSteps: [1, 1.26, 1.5, 2], tone: { from: 660, to: 660, decay: 0.3, gain: 0.8, partial: 2 } },
    { id: 'medal', pulses: [0, 0.08, 0.16, 0.24], pitchSteps: [1, 1.25, 1.5, 1.88], tone: { wave: 'triangle', from: 600, to: 600, decay: 0.25, gain: 0.8, partial: 2.01 } },
  ] },
];

// Surface / impact materials. One row makes both an impact recipe and a footstep recipe (AUD-004: a step per surface).
// high/low = noise sweep Hz, body = impact tone Hz, thump = footstep tone Hz, tail = ring-out factor, ring = metallic partial ratio.
const SOUND_MATERIALS = [
  { id: 'concrete', filter: 'bandpass', high: 3000, low: 1200, q: 0.9, wave: 'triangle', body: 220, thump: 120, tail: 1, ring: 0 },
  { id: 'metal', filter: 'bandpass', high: 5200, low: 2600, q: 4, wave: 'square', body: 900, thump: 150, tail: 2, ring: 2.76 },
  { id: 'wood', filter: 'bandpass', high: 2200, low: 800, q: 1.4, wave: 'triangle', body: 330, thump: 140, tail: 1.2, ring: 0 },
  { id: 'glass', filter: 'bandpass', high: 7000, low: 4500, q: 6, wave: 'sine', body: 2200, thump: 200, tail: 2.5, ring: 2.4 },
  { id: 'dirt', filter: 'lowpass', high: 1400, low: 400, q: 0.6, wave: 'sine', body: 150, thump: 90, tail: 0.8, ring: 0 },
  { id: 'water', filter: 'bandpass', high: 1600, low: 500, q: 1.5, wave: 'sine', body: 600, thump: 200, tail: 2, ring: 0 },
  { id: 'flesh', filter: 'lowpass', high: 1800, low: 300, q: 0.7, wave: 'sine', body: 180, thump: 100, tail: 1, ring: 0 },
  { id: 'sparks', filter: 'highpass', high: 6000, low: 3500, q: 1, wave: 'square', body: 1500, thump: 180, tail: 0.7, ring: 1.5 },
];
// Names the world data may use for a surface, mapped to the rows above (unknown names fall back to concrete).
const SOUND_MATERIAL_ALIASES = {
  concrete: ['stone', 'brick', 'tile', 'plaster', 'rock', 'asphalt', 'marble', 'cement', 'floor'],
  metal: ['steel', 'iron', 'grate', 'vent', 'pipe', 'armor'],
  wood: ['plank', 'crate', 'parquet', 'timber'],
  glass: ['window', 'glasspane'],
  dirt: ['sand', 'grass', 'mud', 'gravel', 'snow', 'carpet', 'soil'],
  water: ['liquid', 'puddle'],
  flesh: ['body', 'blood', 'actor'],
  sparks: ['energy', 'shield'],
};

function expandMaterialRecipes() {
  const rows = [];
  for (const material of SOUND_MATERIALS) {
    rows.push({ id: 'impact.' + material.id, priority: 'ambient', ref: 5, rolloff: 0.7, nearRange: 12, range: 45, gain: 1.0,
      noise: { filter: material.filter, from: material.high, to: material.low, q: material.q, decay: 0.04 + 0.05 * material.tail, gain: 0.9 },
      tone: { wave: material.wave, from: material.body * 1.6, to: material.body, decay: 0.06 * material.tail, gain: 0.4, partial: material.ring } });
    rows.push({ id: 'step.' + material.id, ref: 4, rolloff: 0.6, nearRange: 20, range: 45, gain: 1.6, caption: 'Footsteps', captionKind: 'footstep', captionGap: 0.35,
      noise: { filter: material.filter, from: material.high * 0.7, to: material.low, q: material.q, decay: 0.03 + 0.04 * material.tail, gain: 0.85 },
      tone: { from: material.thump * 1.2, to: material.thump, decay: 0.07, gain: 0.9 } });
  }
  return rows;
}

// ---- Lookup tables: payload value -> recipe id. A "default" key answers unknown values. ----
function expandAliasTable(prefix) {
  const table = { default: prefix + 'concrete' };
  for (const material of SOUND_MATERIALS) table[material.id] = prefix + material.id;
  for (const canonical in SOUND_MATERIAL_ALIASES) for (const alias of SOUND_MATERIAL_ALIASES[canonical]) table[alias] = prefix + canonical;
  return table;
}
const SOUND_TABLES = {
  fireMode: { melee: 'melee' },   // a quick melee swings whatever gun is held (no default: the weapon tables decide)
  weaponClass: { sidearm: 'sidearm', shotgun: 'shotgun', rifle: 'rifle', smg: 'smg', lmg: 'lmg', dmr: 'dmr', marksman: 'dmr', sniper: 'sniper', rail: 'rail',
    launcher: 'launcher', explosive: 'launcher', energy: 'energy', heavy: 'heavy', melee: 'melee', tool: 'tool', exotic: 'exotic', power: 'power', default: 'rifle' },
  weaponOverride: { lancet: 'rail', heron: 'sniper', kestrel: 'dmr', longshot: 'dmr', anvil: 'lmg', twinsting: 'smg', kindler: 'flame',
    hush: 'suppressed', tanto: 'stab', talonbow: 'bowshot' },
  material: expandAliasTable('impact.'),
  surface: expandAliasTable('step.'),
  element: { fire: 'explosionFire', frost: 'explosionFrost', shock: 'explosionShock', default: 'explosion' },
  hitZone: { head: 'headshot', default: 'hitTick' },
  itemGroup: { power: 'powerChime', health: 'pickupHealth', armor: 'pickupArmor', weapon: 'pickupWeapon', ammo: 'pickupAmmo', default: 'pickup' },
  itemRespawn: { power: 'powerChime', default: 'itemRespawn' },
  bounce: { default: 'grenadeTick' },
  ping: { danger: 'pingDanger', enemy: 'pingDanger', default: 'ping' },
  uiClick: { click: 'uiClick', back: 'uiBack', confirm: 'uiConfirm', hover: 'uiHover', error: 'uiError', default: 'uiClick' },
  announce: { warning: 'announceWarn', objective: 'announceObjective', power: 'announcePower', default: 'announce' },
};

// Group of an item key, read from the catalogues (power-ups, weapons, items) when they exist.
function soundItemGroup(itemKey) {
  if (CAT.powerups && CAT.powerups.byId(itemKey)) return 'power';
  if (CAT.weapons && CAT.weapons.byId(itemKey)) return 'weapon';
  const item = CAT.items && CAT.items.byId(itemKey);
  return item && item.group ? item.group : '';
}
// Values an event row may look up that are not plain payload fields.
const SOUND_FIELDS = { group: (payload) => payload.group || soundItemGroup(payload.item) };
const SOUND_CONDITIONS = {
  playerHitsOther: (payload) => isLocalPlayer(payload.source) && payload.target !== payload.source,
  playerHurt: (payload) => isLocalPlayer(payload.target) && (payload.amount > 0 || payload.absorbed > 0),
  playerKilled: (payload) => isLocalPlayer(payload.killer) && payload.victim !== payload.killer,
  idIsPlayer: (payload) => isLocalPlayer(payload.id),
};

// ---- Event rows: which event plays which recipe (AUD-003..AUD-005, UI-012, ACC-003) ----
// recipe | lookup [[payloadField, table], ...] (first table hit wins, last table's default otherwise); source = payload field with the acting actor;
// pos = 'payload' (x, y, z) | 'actor' (the source actor) | 'none' (not positional); when = condition name; gain / ownGain (own sounds are
// quieter so enemies stay audible), gainScale / pitchScale {field, from, to, min, max}, altPitch (alt fire), pitchBy (payload field hashed to a pitch), speak.
const SOUND_EVENTS = [
  { event: 'weapon.fire', lookup: [['mode', 'fireMode'], ['weapon', 'weaponOverride'], ['weaponClass', 'weaponClass']], source: 'id', pos: 'payload', altPitch: 0.85 },
  { event: 'weapon.reload', recipe: 'reload', source: 'id', pos: 'actor' },
  { event: 'weapon.switch', recipe: 'switch', source: 'id', pos: 'actor' },
  { event: 'weapon.empty', recipe: 'empty', source: 'id', pos: 'actor' },
  { event: 'impact', lookup: [['material', 'material']], source: 'owner', pos: 'payload' },
  { event: 'explosion', lookup: [['element', 'element']], source: 'owner', pos: 'payload', gainScale: { field: 'radius', from: 2, to: 10, min: 0.7, max: 1.3 }, pitchScale: { field: 'radius', from: 2, to: 12, min: 1.25, max: 0.7 } },
  { event: 'move.step', lookup: [['surface', 'surface']], source: 'id', pos: 'actor', ownGain: 0.45, gainScale: { field: 'speed', from: 0, to: 8, min: 0.45, max: 1 } },
  { event: 'move.jump', recipe: 'jump', source: 'id', pos: 'actor', ownGain: 0.6 },
  { event: 'move.land', recipe: 'land', source: 'id', pos: 'actor', ownGain: 0.7, gainScale: { field: 'speed', from: 0, to: 16, min: 0.4, max: 1.3 } },
  { event: 'move.slide', recipe: 'slide', source: 'id', pos: 'actor', ownGain: 0.6 },
  { event: 'move.dash', recipe: 'dash', source: 'id', pos: 'actor', ownGain: 0.7 },
  { event: 'move.mantle', recipe: 'mantle', source: 'id', pos: 'actor', ownGain: 0.6 },
  { event: 'move.wallrun', recipe: 'wallrun', source: 'id', pos: 'actor', ownGain: 0.6 },
  { event: 'damage', when: 'playerHitsOther', lookup: [['zone', 'hitZone']], source: 'source', pos: 'none' },
  { event: 'damage', when: 'playerHurt', recipe: 'damageTaken', source: 'target', pos: 'none', gainScale: { field: 'amount', from: 5, to: 60, min: 0.5, max: 1.2 } },
  { event: 'kill', when: 'playerKilled', recipe: 'killConfirm', source: 'killer', pos: 'none' },
  { event: 'kill', recipe: 'death', source: 'victim', pos: 'payload' },
  { event: 'pickup', lookup: [['group', 'itemGroup']], source: 'id', pos: 'payload', ownGain: 0.8 },
  { event: 'item.respawn', lookup: [['group', 'itemRespawn']], pos: 'payload' },
  { event: 'projectile.bounce', lookup: [['kind', 'bounce']], source: 'source', pos: 'payload' },
  { event: 'projectile.incoming', recipe: 'rocketWhistle', source: 'source', pos: 'payload' },
  { event: 'ability.cast', recipe: 'abilityCast', source: 'id', pos: 'actor' },
  { event: 'ability.end', recipe: 'abilityEnd', source: 'id', pos: 'actor' },
  { event: 'ping', lookup: [['kind', 'ping']], source: 'id', pos: 'payload' },
  { event: 'bark', recipe: 'radioBlip', source: 'id', pos: 'actor' },
  { event: 'ui.click', lookup: [['kind', 'uiClick']], pos: 'none' },
  { event: 'announce', lookup: [['kind', 'announce']], pos: 'none', speak: true },
  { event: 'medal', when: 'idIsPlayer', recipe: 'medal', source: 'id', pos: 'none', pitchBy: 'medal' },
];

// ---- Generic code that reads the tables ----
function finishSoundRecipe(row, index) {
  const recipe = Object.assign({}, SOUND_RECIPE_DEFAULTS, row);
  recipe.index = index;
  recipe.pitchSteps = row.pitchSteps || recipe.pulses.map(() => 1);
  recipe.noise = finishSoundLayer(row.noise, SOUND_NOISE_DEFAULTS, recipe.pulses);
  recipe.tone = finishSoundLayer(row.tone, SOUND_TONE_DEFAULTS, recipe.pulses);
  recipe.priorityValue = AUDIO_PRIORITY[recipe.priority];
  recipe.duration = soundRecipeDuration(recipe);
  recipe.captionKind = recipe.caption ? AUDIO_CAPTION_KINDS.indexOf(recipe.captionKind) : -1;
  recipe.captionTexts = recipe.caption ? AUDIO_DIRECTIONS.map((direction) => '[' + recipe.caption + ' ' + direction + ']') : null;
  return recipe;
}

// Layer with its defaults and one decay per pulse. A Web Audio ramp starts from the previous event on the timeline, so a decay that
// runs into the next pulse would drag that note's pitch and cut its level: every pulse but the last ends before the next one starts.
function finishSoundLayer(layer, defaults, pulses) {
  if (!layer) return null;
  const finished = Object.assign({}, defaults, layer);
  finished.decays = pulses.map((time, pulse) => {
    if (pulse === pulses.length - 1) return finished.decay;
    return Math.min(finished.decay, pulses[pulse + 1] - time - finished.attack - SOUND_PULSE_GAP);
  });
  return finished;
}

// Seconds from the first start to the end of the last pulse's decay (plus a small margin).
function soundRecipeDuration(recipe) {
  const lastPulse = recipe.pulses[recipe.pulses.length - 1];
  let longest = 0;
  if (recipe.noise) longest = recipe.noise.attack + recipe.noise.decay;
  if (recipe.tone) longest = Math.max(longest, recipe.tone.attack + recipe.tone.decay);
  return lastPulse + longest + 0.03;
}

function buildSoundRecipes() {
  const rows = [];
  for (const group of SOUND_RECIPE_GROUPS) for (const row of group.rows) rows.push(Object.assign({}, group.defaults, row));
  rows.push(...expandMaterialRecipes());
  registerSoundRecipes(rows.map((row, index) => finishSoundRecipe(row, index)));
}

// Installs a finished recipe list and the per-recipe state arrays that depend on its length (tests register extra recipes with it).
function registerSoundRecipes(recipes) {
  Sound.recipes = recipes;
  Sound.recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  Sound.triggerCounts = new Int32Array(recipes.length);
  Sound.retriggerClock = new Float64Array(recipes.length * (MAX_ACTORS + 1)).fill(-1000);
}

// Recipe id for a payload: tries each [field, table] pair, then the last table's default. Unknown values never throw.
function soundLookup(lookup, payload) {
  for (let i = 0; i < lookup.length; i++) {
    const field = lookup[i][0];
    const key = SOUND_FIELDS[field] ? SOUND_FIELDS[field](payload) : payload[field];
    const hit = SOUND_TABLES[lookup[i][1]][key];
    if (typeof hit === 'string') return hit;
  }
  return SOUND_TABLES[lookup[lookup.length - 1][1]].default;
}

function scaleByField(scale, payload) {
  const value = payload[scale.field];
  if (typeof value !== 'number') return scale.max;
  return lerp(scale.min, scale.max, clamp((value - scale.from) / (scale.to - scale.from), 0, 1));
}

const soundPoint = { x: 0, y: 0, z: 0 };
// Where the sound happens: the payload's x/y/z, the acting actor's body, or nowhere. False = skip the event.
function fillSoundPoint(row, payload, source) {
  if (row.pos === 'payload') return setSoundPoint(payload.x, payload.y, payload.z);
  if (!(source >= 0 && source < Actors.count) || Actors.kind[source] === ACTOR_KIND.NONE) return false;
  return setSoundPoint(Actors.x[source], Actors.y[source] + Actors.height[source] * 0.5, Actors.z[source]);
}

// A point with a missing or NaN coordinate would reach the panner and throw there, so such events are skipped.
function setSoundPoint(x, y, z) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
  Vec.set(soundPoint, x, y, z);
  return true;
}

function soundPitch(row, payload) {
  let pitch = row.pitchScale ? scaleByField(row.pitchScale, payload) : 1;
  if (row.altPitch && payload.mode === 'alt') pitch *= row.altPitch;
  if (row.pitchBy) pitch *= 0.85 + (hashString(String(payload[row.pitchBy])) % 7) * 0.05;   // each medal gets its own pitch
  return pitch;
}

function handleSoundEvent(row, payload) {
  if (!Sound.live()) return;
  if (row.when && !SOUND_CONDITIONS[row.when](payload)) return;
  const recipeIndex = Sound.recipeIndex(row.recipe || soundLookup(row.lookup, payload));
  const sourceValue = row.source ? payload[row.source] : -1;
  const source = typeof sourceValue === 'number' ? sourceValue : -1;
  const positional = row.pos !== 'none';
  if (positional && !fillSoundPoint(row, payload, source)) return;
  let gain = row.gainScale ? scaleByField(row.gainScale, payload) : 1;
  if (row.ownGain && isLocalPlayer(source)) gain *= row.ownGain;
  Sound.enqueue(recipeIndex, positional, soundPoint.x, soundPoint.y, soundPoint.z, source, gain, soundPitch(row, payload));
  if (row.speak) Sound.speak(payload.text);
}

buildSoundRecipes();
for (const row of SOUND_EVENTS) Bus.on(row.event, (payload) => handleSoundEvent(row, payload));
