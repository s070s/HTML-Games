// ==== S03 DATA: WEAPON MODELS ====
// One code-drawn model per weapon W01..W46 (first-person view model, the weapon an actor holds and a weapon pickup) and per
// visible projectile, all in the shared part format of 03b viewModels, drawn by the one generic builder (07c-render-models.js).
// Part: { shape (default box), offset: [x, y, z] centre, size: [x, y, z] full size, axis: 'z' (the shape's Y axis points
// forward, size[1] = length), pitch (degrees, + tips the front up), tint, mirror: true (a second copy at -x), fine: true (view
// model only: world models and Potato skip it) }.
// Weapon space = view space in metres: x = right, y = up, z = forward (the muzzle), origin = the grip. Projectile space: z = flight.
// tint: body (the weapon or projectile colour) | dark | steel | wood | bone | accent | glow (self-lit) | shine (accent, self-lit).
// Row: base = a viewModels class row or an earlier row of the same catalogue whose parts come first (scaled by stretch [x, y, z],
// minus the base part indexes in drop); parts = its own parts; far = how many leading parts the far LOD keeps;
// pose = the viewModels row for hold / ADS / kick (default: the base's pose, else the weapon class); accent / glow override the pose's.
// Projectile rows add spin (rad/s about the model's up axis) and tumble (rad/s end over end).

const MODEL_GRIP = { offset: [0, -0.08, -0.01], size: [0.035, 0.09, 0.045], tint: 'dark', pitch: -10 };
const MODEL_SCHEMA = { id: REQUIRED, base: '', stretch: null, drop: [], parts: [], far: 2, pose: '', accent: '', glow: '', spin: 0, tumble: 0 };

Data.define('weaponModels', MODEL_SCHEMA, [
  // ---- Melee: held upright ----
  { id: 'maul', pose: 'melee', parts: [
    { shape: 'cylinder', offset: [0, 0.06, 0], size: [0.035, 0.46, 0.035], tint: 'wood' },
    { offset: [0, 0.3, 0.02], size: [0.1, 0.1, 0.24] },
    { shape: 'cylinder', offset: [0, 0.3, 0.15], size: [0.12, 0.04, 0.12], axis: 'z', tint: 'steel' },
    { shape: 'cone', offset: [0, 0.3, -0.14], size: [0.07, 0.08, 0.07], pitch: 90, tint: 'steel' },
    { shape: 'cylinder', offset: [0, -0.12, 0], size: [0.045, 0.12, 0.045], tint: 'dark' }] },
  { id: 'tanto', pose: 'melee', parts: [
    { shape: 'wedge', offset: [0, 0.15, 0.005], size: [0.012, 0.24, 0.045], tint: 'steel' },
    { shape: 'cylinder', offset: [0, -0.04, 0], size: [0.03, 0.12, 0.03], tint: 'dark' },
    { offset: [0, 0.025, 0], size: [0.07, 0.015, 0.035], tint: 'accent' }] },
  { id: 'bulwark', pose: 'melee', parts: [
    { offset: [-0.06, 0.02, 0.1], size: [0.26, 0.32, 0.03] },
    { shape: 'cylinder', offset: [0.04, 0.2, 0.13], size: [0.2, 0.015, 0.2], axis: 'z', tint: 'steel' },
    { shape: 'ring', offset: [0.04, 0.2, 0.13], size: [0.23, 0.025, 0.23], axis: 'z', tint: 'accent' },
    { offset: [-0.06, 0.18, 0.1], size: [0.27, 0.025, 0.04], tint: 'steel' },
    { shape: 'cylinder', offset: [0.04, 0.2, 0.145], size: [0.05, 0.03, 0.05], axis: 'z', tint: 'dark' }] },
  // ---- Sidearms ----
  { id: 'warden', base: 'sidearm', parts: [
    { offset: [0, -0.09, -0.012], size: [0.04, 0.012, 0.055], tint: 'accent' },
    { offset: [0.012, 0.05, -0.025], size: [0.008, 0.012, 0.012], tint: 'accent', mirror: true, fine: true },
    { offset: [0, 0.05, 0.13], size: [0.008, 0.012, 0.012], tint: 'accent', fine: true }] },
  { id: 'verdict', pose: 'sidearm', parts: [
    { offset: [0, 0.02, 0.01], size: [0.04, 0.06, 0.1] },
    { shape: 'cylinder', offset: [0, 0.04, 0.17], size: [0.032, 0.22, 0.032], axis: 'z', tint: 'steel' },
    { shape: 'cylinder', offset: [0, 0.025, 0.03], size: [0.07, 0.07, 0.07], axis: 'z', tint: 'steel' },
    { offset: [0, -0.05, -0.04], size: [0.036, 0.1, 0.045], pitch: -15, tint: 'wood' },
    { offset: [0, 0.06, 0.16], size: [0.014, 0.012, 0.22] },
    { offset: [0, 0.06, -0.035], size: [0.012, 0.03, 0.02], tint: 'dark', fine: true }] },
  { id: 'hush', base: 'sidearm', parts: [
    { shape: 'cylinder', offset: [0, 0.025, 0.27], size: [0.042, 0.2, 0.042], axis: 'z', tint: 'dark' }] },
  { id: 'sparklock', pose: 'sidearm', glow: '#7df9ff', parts: [
    { shape: 'capsule', offset: [0, -0.005, 0.05], size: [0.06, 0.2, 0.06], axis: 'z' },
    MODEL_GRIP,
    { shape: 'cylinder', offset: [0, -0.005, 0.17], size: [0.024, 0.06, 0.024], axis: 'z', tint: 'steel' },
    { shape: 'ring', offset: [0, -0.005, 0.1], size: [0.075, 0.015, 0.075], axis: 'z', tint: 'glow' },
    { shape: 'ring', offset: [0, -0.005, 0.14], size: [0.065, 0.015, 0.065], axis: 'z', tint: 'glow' }] },
  { id: 'twinsting', base: 'sidearm', drop: [2], accent: '#e05a2a', parts: [
    { offset: [0, -0.125, -0.005], size: [0.03, 0.09, 0.04], tint: 'dark' },
    { shape: 'cylinder', offset: [0.011, 0.025, 0.16], size: [0.016, 0.06, 0.016], axis: 'z', tint: 'steel', mirror: true },
    { offset: [0, -0.04, 0.11], size: [0.025, 0.06, 0.03], tint: 'dark' }] },
  // ---- SMGs ----
  { id: 'wasp', base: 'smg', accent: '#e8c02a', parts: [
    { offset: [0, 0.04, 0.06], size: [0.02, 0.012, 0.18], tint: 'accent' },
    { offset: [0, -0.01, -0.21], size: [0.045, 0.06, 0.012], tint: 'steel' }] },
  { id: 'hornet', base: 'smg', stretch: [1, 1, 1.15], parts: [
    { shape: 'cylinder', offset: [0, -0.045, 0.22], size: [0.045, 0.14, 0.045], axis: 'z', tint: 'steel' },
    { offset: [0, -0.005, -0.16], size: [0.04, 0.06, 0.12], tint: 'dark' },
    { offset: [0, 0.05, 0.04], size: [0.025, 0.025, 0.05], tint: 'dark' }] },
  { id: 'riptide', pose: 'smg', accent: '#3ac8c8', parts: [
    { shape: 'capsule', offset: [0, 0, 0.04], size: [0.07, 0.3, 0.07], axis: 'z' },
    { offset: [0, 0.05, 0.05], size: [0.045, 0.025, 0.22], tint: 'accent' },
    { offset: [0, -0.06, 0.03], size: [0.03, 0.07, 0.04], pitch: -10, tint: 'dark' },
    { offset: [0, -0.04, -0.08], size: [0.04, 0.05, 0.07], tint: 'dark' },
    { shape: 'cylinder', offset: [0, 0, 0.21], size: [0.022, 0.06, 0.022], axis: 'z', tint: 'steel' }] },
  { id: 'needlethorn', pose: 'smg', accent: '#5b2d6e', glow: '#ff6ad5', parts: [
    { shape: 'capsule', offset: [0, 0, 0.06], size: [0.065, 0.3, 0.065], axis: 'z', tint: 'accent' },
    { shape: 'cone', offset: [0, 0, 0.24], size: [0.02, 0.07, 0.02], axis: 'z', tint: 'glow' },
    MODEL_GRIP,
    { shape: 'sphere', offset: [0, -0.05, 0.1], size: [0.05, 0.06, 0.07], tint: 'accent' },
    { shape: 'cone', offset: [0, 0.05, 0], size: [0.025, 0.05, 0.025], tint: 'glow' },
    { shape: 'cone', offset: [0, 0.05, 0.07], size: [0.025, 0.05, 0.025], tint: 'glow' }] },
  // ---- Rifles ----
  { id: 'vanguard', base: 'rifle', drop: [1, 2, 4], parts: [
    { offset: [0, -0.02, -0.17], size: [0.045, 0.075, 0.15], pitch: -6, tint: 'wood' },
    { offset: [0, -0.1, 0.09], size: [0.035, 0.13, 0.05], pitch: 18, tint: 'dark' },
    { offset: [0, -0.005, 0.2], size: [0.05, 0.05, 0.1], tint: 'wood' },
    { shape: 'cylinder', offset: [0, 0.035, 0.22], size: [0.018, 0.14, 0.018], axis: 'z', tint: 'steel' },
    { offset: [0, 0.04, 0.36], size: [0.01, 0.03, 0.01], tint: 'dark', fine: true }] },
  { id: 'tempest', base: 'rifle', drop: [4], glow: '#ff4040', parts: [
    { offset: [0, 0.065, 0.03], size: [0.03, 0.035, 0.05], tint: 'dark' },
    { offset: [0, 0, 0.2], size: [0.06, 0.065, 0.12], tint: 'dark' },
    { offset: [0, -0.07, 0.2], size: [0.025, 0.07, 0.03], tint: 'dark' },
    { shape: 'ring', offset: [0, 0.075, 0.056], size: [0.035, 0.01, 0.035], axis: 'z', tint: 'glow', fine: true }] },
  { id: 'ratchet', base: 'rifle', drop: [2, 4], parts: [
    { offset: [0, 0.09, 0.05], size: [0.02, 0.025, 0.26] },
    { offset: [0, -0.08, -0.1], size: [0.035, 0.11, 0.05], tint: 'dark' },
    { offset: [0, -0.07, 0.06], size: [0.03, 0.08, 0.04], pitch: -10, tint: 'dark' }] },
  { id: 'longshot', base: 'rifle', stretch: [1, 1, 1.15], drop: [4], parts: [
    { shape: 'cylinder', offset: [0, 0.08, 0.05], size: [0.04, 0.2, 0.04], axis: 'z', tint: 'dark' },
    { shape: 'cylinder', offset: [0, 0.08, 0.17], size: [0.052, 0.05, 0.052], axis: 'z', tint: 'dark' },
    { offset: [0.04, 0.02, -0.02], size: [0.04, 0.012, 0.012], tint: 'steel' }] },
  { id: 'pulsecarbine', base: 'rifle', drop: [4], accent: '#3a2a5a', glow: '#a06bff', parts: [
    { shape: 'sphere', offset: [0, 0.05, 0.12], size: [0.06, 0.05, 0.08], tint: 'glow' },
    { offset: [0.03, 0.01, 0.08], size: [0.006, 0.02, 0.24], tint: 'glow', mirror: true },
    { shape: 'cylinder', offset: [0, -0.05, 0.24], size: [0.04, 0.1, 0.04], axis: 'z', tint: 'accent' }] },
  // ---- Shotguns ----
  { id: 'scattergun', base: 'shotgun', drop: [3], parts: [
    { offset: [0, -0.03, -0.2], size: [0.05, 0.085, 0.17], pitch: -6, tint: 'wood' },
    { shape: 'cylinder', offset: [0, -0.025, 0.36], size: [0.03, 0.12, 0.03], axis: 'z', tint: 'steel' }] },
  { id: 'hookjaw', pose: 'shotgun', accent: '#c06030', parts: [
    { offset: [0, 0, 0], size: [0.07, 0.07, 0.16] },
    { shape: 'cylinder', offset: [0.019, 0.02, 0.24], size: [0.036, 0.34, 0.036], axis: 'z', tint: 'steel', mirror: true },
    { offset: [0, -0.03, -0.17], size: [0.05, 0.085, 0.2], pitch: -8, tint: 'wood' },
    { offset: [0, -0.015, 0.12], size: [0.06, 0.03, 0.12], tint: 'wood' },
    { shape: 'cone', offset: [0, -0.05, 0.34], size: [0.05, 0.08, 0.05], axis: 'z', tint: 'accent' }] },
  { id: 'shardcaster', pose: 'shotgun', glow: '#ffd27a', parts: [
    { offset: [0, 0, 0.02], size: [0.065, 0.085, 0.26] },
    { shape: 'cylinder', offset: [0, 0.02, 0.24], size: [0.05, 0.18, 0.05], axis: 'z', tint: 'dark' },
    { shape: 'cylinder', offset: [0, -0.07, 0.05], size: [0.11, 0.06, 0.11], axis: 'z', tint: 'accent' },
    { offset: [0, -0.02, -0.18], size: [0.05, 0.08, 0.14], tint: 'dark' },
    { shape: 'cone', offset: [0, 0.07, 0], size: [0.03, 0.06, 0.03], tint: 'glow' },
    { shape: 'cone', offset: [0, 0.065, 0.06], size: [0.025, 0.05, 0.025], pitch: 20, tint: 'glow' }] },
  { id: 'frostbore', pose: 'shotgun', glow: '#9be8ff', parts: [
    { offset: [0, 0, 0], size: [0.065, 0.085, 0.28] },
    { shape: 'cylinder', offset: [0, 0.015, 0.26], size: [0.06, 0.24, 0.06], axis: 'z', tint: 'steel' },
    { shape: 'ring', offset: [0, 0.015, 0.2], size: [0.085, 0.025, 0.085], axis: 'z', tint: 'glow' },
    { shape: 'ring', offset: [0, 0.015, 0.31], size: [0.08, 0.025, 0.08], axis: 'z', tint: 'glow' },
    { shape: 'capsule', offset: [0.05, -0.02, 0.02], size: [0.045, 0.2, 0.045], axis: 'z', tint: 'glow' },
    { offset: [0, -0.02, -0.2], size: [0.05, 0.08, 0.15], tint: 'dark' }] },
  // ---- Marksman and sniper ----
  { id: 'lancet', base: 'rail', parts: [
    { shape: 'cylinder', offset: [0, 0.08, 0.02], size: [0.035, 0.16, 0.035], axis: 'z', tint: 'dark' },
    { offset: [0, -0.01, -0.2], size: [0.045, 0.08, 0.14], tint: 'dark' },
    { offset: [0.022, 0, 0.33], size: [0.012, 0.05, 0.12], tint: 'steel', mirror: true }] },
  { id: 'heron', base: 'sniper', parts: [
    { shape: 'cylinder', offset: [0, 0.08, 0.19], size: [0.06, 0.04, 0.06], axis: 'z', tint: 'dark' },
    { offset: [0.025, -0.08, 0.38], size: [0.01, 0.13, 0.01], pitch: 25, tint: 'steel', mirror: true },
    { shape: 'cylinder', offset: [0, 0.01, 0.6], size: [0.035, 0.05, 0.035], axis: 'z', tint: 'steel' },
    { offset: [0.04, 0.02, -0.04], size: [0.045, 0.012, 0.012], tint: 'steel', fine: true },
    { offset: [0, 0.045, -0.18], size: [0.04, 0.02, 0.1], tint: 'dark', fine: true }] },
  { id: 'kestrel', base: 'dmr', accent: '#5a6a4a', parts: [
    { offset: [0, -0.08, 0.06], size: [0.035, 0.1, 0.06], tint: 'dark' },
    { offset: [0, 0, 0.24], size: [0.058, 0.062, 0.12], tint: 'accent' },
    { shape: 'cylinder', offset: [0, 0.01, 0.46], size: [0.032, 0.05, 0.032], axis: 'z', tint: 'steel' },
    { shape: 'ring', offset: [0, 0.075, 0.14], size: [0.04, 0.01, 0.04], axis: 'z', tint: 'glow', fine: true }] },
  { id: 'stakedriver', pose: 'dmr', accent: '#a04a2a', glow: '#ff8a3d', parts: [
    { offset: [0, 0, 0.03], size: [0.06, 0.08, 0.3] },
    { offset: [0, 0.03, 0.2], size: [0.34, 0.03, 0.04], tint: 'dark' },
    { shape: 'cylinder', offset: [0, 0.06, 0.12], size: [0.025, 0.4, 0.025], axis: 'z', tint: 'wood' },
    { shape: 'cone', offset: [0, 0.06, 0.34], size: [0.035, 0.06, 0.035], axis: 'z', tint: 'steel' },
    { shape: 'capsule', offset: [0, -0.055, 0.08], size: [0.05, 0.18, 0.05], axis: 'z', tint: 'accent' },
    { offset: [0, -0.015, -0.18], size: [0.045, 0.07, 0.14], tint: 'dark' }] },
  { id: 'talonbow', pose: 'dmr', accent: '#6a8a3a', parts: [
    { offset: [0, 0, 0.12], size: [0.03, 0.16, 0.04] },
    { offset: [0, 0.17, 0.1], size: [0.02, 0.2, 0.03], pitch: 20, tint: 'dark' },
    { offset: [0, -0.17, 0.1], size: [0.02, 0.2, 0.03], pitch: -20, tint: 'dark' },
    { offset: [0, 0, 0.065], size: [0.004, 0.5, 0.004], tint: 'steel' },
    { shape: 'cylinder', offset: [0, 0, 0.12], size: [0.012, 0.34, 0.012], axis: 'z', tint: 'wood' },
    { shape: 'cone', offset: [0, 0, 0.3], size: [0.025, 0.05, 0.025], axis: 'z', tint: 'steel' }] },
  // ---- Energy ----
  { id: 'coilcaster', pose: 'energy', accent: '#c87533', glow: '#7fd8ff', parts: [
    { offset: [0, 0, 0.02], size: [0.06, 0.085, 0.28] },
    { shape: 'cylinder', offset: [0, 0.01, 0.24], size: [0.03, 0.26, 0.03], axis: 'z', tint: 'steel' },
    { shape: 'ring', offset: [0, 0.01, 0.16], size: [0.085, 0.03, 0.085], axis: 'z', tint: 'accent' },
    { shape: 'ring', offset: [0, 0.01, 0.23], size: [0.08, 0.03, 0.08], axis: 'z', tint: 'accent' },
    { shape: 'ring', offset: [0, 0.01, 0.3], size: [0.075, 0.03, 0.075], axis: 'z', tint: 'accent' },
    MODEL_GRIP,
    { shape: 'sphere', offset: [0, 0.055, 0.02], size: [0.05, 0.04, 0.08], tint: 'glow' }] },
  { id: 'linker', pose: 'energy', accent: '#3a6a8a', parts: [
    { offset: [0, 0, 0.04], size: [0.07, 0.09, 0.3] },
    { offset: [0.025, 0, 0.27], size: [0.015, 0.04, 0.14], tint: 'steel', mirror: true },
    { shape: 'sphere', offset: [0, 0, 0.25], size: [0.035, 0.035, 0.035], tint: 'glow' },
    MODEL_GRIP,
    { shape: 'cylinder', offset: [0, 0.07, -0.02], size: [0.05, 0.16, 0.05], axis: 'z', tint: 'accent' }] },
  { id: 'ember', pose: 'energy', accent: '#5a3a2a', glow: '#ff7a2a', parts: [
    { offset: [0, 0, 0.04], size: [0.065, 0.09, 0.32] },
    { shape: 'cylinder', offset: [0, 0, 0.27], size: [0.04, 0.16, 0.04], axis: 'z', tint: 'dark' },
    { offset: [0, 0.065, 0.02], size: [0.006, 0.04, 0.16], tint: 'accent' },
    { offset: [0.022, 0.065, 0.02], size: [0.006, 0.04, 0.16], tint: 'accent', mirror: true },
    MODEL_GRIP,
    { offset: [0, -0.02, 0.16], size: [0.07, 0.02, 0.06], tint: 'glow' }] },
  { id: 'stormlash', pose: 'energy', glow: '#9fd8ff', parts: [
    { offset: [0, 0, 0.02], size: [0.065, 0.085, 0.26] },
    { shape: 'sphere', offset: [0, 0.02, 0.22], size: [0.09, 0.09, 0.09], tint: 'glow' },
    { offset: [0.03, 0.02, 0.3], size: [0.012, 0.012, 0.12], tint: 'steel', mirror: true },
    { shape: 'ring', offset: [0, 0.02, 0.15], size: [0.08, 0.02, 0.08], axis: 'z', tint: 'accent' },
    MODEL_GRIP,
    { shape: 'cylinder', offset: [0, -0.06, 0.06], size: [0.04, 0.16, 0.04], axis: 'z', tint: 'dark' }] },
  { id: 'starthrower', pose: 'energy', accent: '#8090a8', glow: '#c8f0ff', parts: [
    { offset: [0, 0, 0.04], size: [0.08, 0.07, 0.3] },
    { shape: 'cylinder', offset: [0, 0.06, 0.02], size: [0.16, 0.025, 0.16], tint: 'accent' },
    { shape: 'ring', offset: [0, 0.06, 0.02], size: [0.17, 0.02, 0.17], tint: 'glow' },
    MODEL_GRIP,
    { offset: [0, 0, 0.21], size: [0.1, 0.025, 0.04], tint: 'dark' }] },
  { id: 'accelerator', pose: 'energy', glow: '#b07aff', parts: [
    { offset: [0, 0, 0], size: [0.07, 0.09, 0.26] },
    { offset: [0, 0.04, 0.25], size: [0.02, 0.02, 0.3], tint: 'steel' },
    { offset: [0, -0.03, 0.25], size: [0.02, 0.02, 0.3], tint: 'steel' },
    { shape: 'sphere', offset: [0, 0.07, -0.04], size: [0.04, 0.04, 0.04], tint: 'glow' },
    MODEL_GRIP,
    { shape: 'sphere', offset: [0, 0.07, 0.04], size: [0.04, 0.04, 0.04], tint: 'glow' }] },
  // ---- Heavy ----
  { id: 'hailstorm', pose: 'heavy', accent: '#6a6a3a', parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.13, 0.16, 0.13], axis: 'z' },
    { shape: 'cylinder', offset: [0.028, 0.028, 0.2], size: [0.022, 0.3, 0.022], axis: 'z', tint: 'steel', mirror: true },
    { shape: 'cylinder', offset: [0.028, -0.028, 0.2], size: [0.022, 0.3, 0.022], axis: 'z', tint: 'steel', mirror: true },
    { shape: 'cylinder', offset: [0, 0, 0.33], size: [0.1, 0.025, 0.1], axis: 'z', tint: 'dark' },
    { offset: [0, -0.11, -0.02], size: [0.1, 0.08, 0.1], tint: 'accent' },
    { offset: [0, 0.1, 0], size: [0.03, 0.04, 0.12], tint: 'dark' }] },
  { id: 'anvil', base: 'lmg', parts: [
    { shape: 'cylinder', offset: [0, 0.015, 0.3], size: [0.05, 0.14, 0.05], axis: 'z', tint: 'dark' },
    { offset: [0, 0.08, 0.12], size: [0.015, 0.03, 0.1], tint: 'steel' },
    { offset: [0.025, -0.07, 0.44], size: [0.01, 0.12, 0.01], pitch: 25, tint: 'steel', mirror: true }] },
  { id: 'kindler', pose: 'heavy', accent: '#a33a2a', glow: '#ff8a3d', parts: [
    { offset: [0, 0, 0.02], size: [0.07, 0.08, 0.26] },
    { shape: 'capsule', offset: [0, -0.075, 0.02], size: [0.08, 0.26, 0.08], axis: 'z', tint: 'accent' },
    { shape: 'cylinder', offset: [0, 0.01, 0.24], size: [0.04, 0.18, 0.04], axis: 'z', tint: 'steel' },
    { shape: 'cone', offset: [0, 0.01, 0.35], size: [0.075, 0.05, 0.075], pitch: 90, tint: 'dark' },
    { shape: 'sphere', offset: [0, -0.03, 0.34], size: [0.022, 0.022, 0.022], tint: 'glow' },
    { offset: [0, -0.06, -0.09], size: [0.03, 0.08, 0.04], pitch: -10, tint: 'dark' }] },
  // ---- Explosive ----
  { id: 'ramjet', base: 'launcher', drop: [1], accent: '#ff8a3d', parts: [
    { shape: 'cylinder', offset: [0, 0.01, 0.37], size: [0.13, 0.03, 0.13], axis: 'z', tint: 'dark' },
    { shape: 'cone', offset: [0, 0.01, 0.39], size: [0.07, 0.07, 0.07], axis: 'z', tint: 'accent' },
    { shape: 'cone', offset: [0, 0.01, -0.15], size: [0.14, 0.08, 0.14], axis: 'z', tint: 'dark' },
    { offset: [0, -0.08, 0.2], size: [0.03, 0.07, 0.04], tint: 'dark' }] },
  { id: 'pitcher', pose: 'launcher', accent: '#6a8f3a', parts: [
    { shape: 'cylinder', offset: [0, 0.02, 0.2], size: [0.07, 0.22, 0.07], axis: 'z' },
    { shape: 'cylinder', offset: [0, 0, 0.04], size: [0.14, 0.1, 0.14], axis: 'z', tint: 'dark' },
    { shape: 'ring', offset: [0, 0, 0.04], size: [0.15, 0.04, 0.15], axis: 'z', tint: 'accent' },
    { offset: [0, 0.055, 0.08], size: [0.03, 0.025, 0.3], tint: 'steel' },
    { offset: [0, -0.03, -0.14], size: [0.045, 0.08, 0.14], tint: 'dark' },
    { offset: [0, -0.08, -0.04], size: [0.035, 0.09, 0.045], pitch: -10, tint: 'dark' }] },
  { id: 'kingfisher', pose: 'launcher', glow: '#ff5050', parts: [
    { offset: [0, 0.01, 0.1], size: [0.14, 0.12, 0.36] },
    { shape: 'cylinder', offset: [0.035, 0.04, 0.285], size: [0.045, 0.02, 0.045], axis: 'z', tint: 'dark', mirror: true },
    { shape: 'cylinder', offset: [0.035, -0.02, 0.285], size: [0.045, 0.02, 0.045], axis: 'z', tint: 'dark', mirror: true },
    { offset: [0, -0.09, 0.02], size: [0.035, 0.09, 0.045], pitch: -10, tint: 'dark' },
    { offset: [0, 0.09, 0.06], size: [0.02, 0.03, 0.12], tint: 'dark' }] },
  { id: 'gloop', pose: 'launcher', glow: '#7fe04a', parts: [
    { offset: [0, 0, 0.04], size: [0.06, 0.08, 0.26] },
    { shape: 'sphere', offset: [0, 0.085, 0], size: [0.1, 0.1, 0.1], tint: 'glow' },
    { shape: 'cylinder', offset: [0, 0, 0.22], size: [0.05, 0.12, 0.05], axis: 'z', tint: 'dark' },
    MODEL_GRIP,
    { shape: 'cone', offset: [0, 0, 0.3], size: [0.08, 0.05, 0.08], pitch: 90, tint: 'dark' }] },
  { id: 'fusionmortar', pose: 'launcher', glow: '#ffee88', parts: [
    { shape: 'cylinder', offset: [0, 0.02, 0.12], size: [0.15, 0.34, 0.15], axis: 'z' },
    { shape: 'cylinder', offset: [0, 0.02, 0.29], size: [0.17, 0.04, 0.17], axis: 'z', tint: 'dark' },
    { shape: 'sphere', offset: [0, 0.02, 0.27], size: [0.1, 0.1, 0.1], tint: 'glow' },
    { shape: 'cylinder', offset: [0, 0.02, -0.06], size: [0.17, 0.03, 0.17], axis: 'z', tint: 'dark' },
    { offset: [0, -0.1, 0.06], size: [0.035, 0.09, 0.045], pitch: -10, tint: 'dark' }] },
  // ---- Tools ----
  { id: 'lifter', pose: 'tool', parts: [
    { offset: [0, 0, 0], size: [0.09, 0.1, 0.2] },
    { shape: 'sphere', offset: [0, 0, 0.13], size: [0.06, 0.06, 0.06], tint: 'glow' },
    { offset: [0, 0.05, 0.18], size: [0.02, 0.02, 0.12], pitch: 20, tint: 'dark' },
    { offset: [0.045, -0.025, 0.18], size: [0.02, 0.02, 0.12], tint: 'dark', mirror: true },
    { shape: 'ring', offset: [0, 0, 0.1], size: [0.11, 0.02, 0.11], axis: 'z', tint: 'accent' }] },
  { id: 'twingate', pose: 'tool', accent: '#4aa8ff', glow: '#ffa040', parts: [
    { offset: [0, 0, 0.02], size: [0.08, 0.09, 0.22] },
    { shape: 'cylinder', offset: [-0.03, 0.01, 0.16], size: [0.035, 0.08, 0.035], axis: 'z', tint: 'glow' },
    { shape: 'cylinder', offset: [0.03, 0.01, 0.16], size: [0.035, 0.08, 0.035], axis: 'z', tint: 'shine' },
    { offset: [0, 0.06, 0], size: [0.01, 0.03, 0.14], tint: 'dark' },
    { offset: [0, -0.09, -0.02], size: [0.035, 0.09, 0.045], pitch: -10, tint: 'dark' }] },
  // ---- Exotic and power ----
  { id: 'auger', pose: 'exotic', parts: [
    { shape: 'capsule', offset: [0, 0, 0.02], size: [0.08, 0.28, 0.08], axis: 'z' },
    { shape: 'cone', offset: [0, 0, 0.24], size: [0.08, 0.16, 0.08], axis: 'z', tint: 'steel' },
    { shape: 'sphere', offset: [0, 0.07, -0.02], size: [0.07, 0.07, 0.08], tint: 'bone' },
    MODEL_GRIP,
    { shape: 'ring', offset: [0, 0, 0.2], size: [0.085, 0.02, 0.085], axis: 'z', tint: 'dark' }] },
  { id: 'razorwind', pose: 'exotic', glow: '#bfe6ff', parts: [
    { shape: 'capsule', offset: [0, 0, 0.06], size: [0.07, 0.3, 0.07], axis: 'z' },
    { shape: 'ring', offset: [0, 0.06, 0.08], size: [0.2, 0.012, 0.2], tint: 'steel' },
    MODEL_GRIP,
    { shape: 'cylinder', offset: [0, 0.06, 0.08], size: [0.05, 0.015, 0.05], tint: 'glow' }] },
  { id: 'daybreak', base: 'power', glow: '#ffd98a', parts: [
    { shape: 'sphere', offset: [0, 0.02, 0.48], size: [0.08, 0.08, 0.08], tint: 'glow' },
    { shape: 'ring', offset: [0, 0.02, 0.48], size: [0.13, 0.015, 0.13], axis: 'z', tint: 'accent' }] },
  { id: 'halcyon', pose: 'power', accent: '#d03a2a', parts: [
    { shape: 'cylinder', offset: [0, 0.02, 0.1], size: [0.13, 0.5, 0.13], axis: 'z', tint: 'dark' },
    { shape: 'capsule', offset: [0, 0.02, 0.4], size: [0.11, 0.18, 0.11], axis: 'z', tint: 'bone' },
    { shape: 'cone', offset: [0, 0.02, 0.5], size: [0.1, 0.08, 0.1], axis: 'z', tint: 'accent' },
    { shape: 'ring', offset: [0, 0.02, 0.36], size: [0.12, 0.03, 0.12], axis: 'z' },
    { offset: [0, 0.02, -0.12], size: [0.22, 0.014, 0.08] },
    { offset: [0, 0.02, -0.12], size: [0.014, 0.22, 0.08] },
    { offset: [0, -0.1, 0.04], size: [0.035, 0.09, 0.045], pitch: -10, tint: 'dark' }] },
]);

// Visible projectiles (P01..P21 rows of 03c without a model stay a glowing sphere). Sizes in metres.
Data.define('projectileModels', MODEL_SCHEMA, [
  { id: 'rocket', accent: '#3a3f46', glow: '#ffb060', parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.1, 0.34, 0.1], axis: 'z', tint: 'steel' },
    { shape: 'cone', offset: [0, 0, 0.21], size: [0.1, 0.09, 0.1], axis: 'z' },
    { offset: [0, 0, -0.14], size: [0.22, 0.012, 0.07], tint: 'accent' },
    { offset: [0, 0, -0.14], size: [0.012, 0.22, 0.07], tint: 'accent' },
    { shape: 'sphere', offset: [0, 0, -0.2], size: [0.08, 0.08, 0.1], tint: 'glow' }] },
  { id: 'missile', base: 'rocket', stretch: [0.75, 0.75, 0.75] },
  { id: 'warhead', base: 'rocket', stretch: [2.4, 2.4, 2.4], parts: [
    { shape: 'ring', offset: [0, 0, 0.22], size: [0.26, 0.06, 0.26], axis: 'z', tint: 'accent' }] },
  { id: 'grenade', tumble: 9, parts: [
    { shape: 'sphere', offset: [0, 0, 0], size: [0.17, 0.15, 0.21] },
    { shape: 'ring', offset: [0, 0, 0], size: [0.19, 0.04, 0.19], axis: 'z', tint: 'dark' },
    { shape: 'cylinder', offset: [0, 0, 0.11], size: [0.06, 0.04, 0.06], axis: 'z', tint: 'steel' }] },
  { id: 'contact', base: 'grenade', parts: [
    { shape: 'sphere', offset: [0, 0, 0.13], size: [0.04, 0.04, 0.04], tint: 'glow' }] },
  { id: 'mine', parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.24, 0.07, 0.24], tint: 'dark' },
    { shape: 'sphere', offset: [0, 0.035, 0], size: [0.19, 0.1, 0.19] },
    { shape: 'sphere', offset: [0, 0.09, 0], size: [0.05, 0.05, 0.05], tint: 'glow' }] },
  { id: 'stake', glow: '#ff8a3d', parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.035, 0.5, 0.035], axis: 'z', tint: 'wood' },
    { shape: 'cone', offset: [0, 0, 0.29], size: [0.045, 0.08, 0.045], axis: 'z', tint: 'steel' },
    { shape: 'ring', offset: [0, 0, 0.2], size: [0.05, 0.02, 0.05], axis: 'z', tint: 'glow' }] },
  { id: 'arrow', accent: '#c84a3a', parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.014, 0.6, 0.014], axis: 'z', tint: 'wood' },
    { shape: 'cone', offset: [0, 0, 0.32], size: [0.03, 0.06, 0.03], axis: 'z', tint: 'steel' },
    { offset: [0, 0, -0.26], size: [0.004, 0.05, 0.08], tint: 'accent' },
    { offset: [0, 0, -0.26], size: [0.05, 0.004, 0.08], tint: 'accent' }] },
  { id: 'needle', far: 1, parts: [
    { shape: 'cone', offset: [0, 0, 0.04], size: [0.025, 0.16, 0.025], axis: 'z', tint: 'glow' },
    { shape: 'cylinder', offset: [0, 0, -0.06], size: [0.012, 0.06, 0.012], axis: 'z', tint: 'dark' }] },
  { id: 'shard', far: 1, parts: [
    { shape: 'cone', offset: [0, 0, 0.03], size: [0.04, 0.1, 0.04], axis: 'z', tint: 'glow' },
    { shape: 'cone', offset: [0, 0, -0.03], size: [0.04, 0.06, 0.04], pitch: 90, tint: 'glow' }] },
  { id: 'disc', spin: 14, parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.3, 0.025, 0.3] },
    { shape: 'ring', offset: [0, 0, 0], size: [0.32, 0.03, 0.32], tint: 'glow' },
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.08, 0.035, 0.08], tint: 'dark' }] },
  { id: 'hook', parts: [
    { shape: 'cone', offset: [0, 0, 0.1], size: [0.12, 0.16, 0.12], axis: 'z', tint: 'steel' },
    { shape: 'ring', offset: [0, 0, -0.02], size: [0.16, 0.03, 0.16], axis: 'z', tint: 'dark' },
    { shape: 'cylinder', offset: [0, 0, -0.25], size: [0.015, 0.4, 0.015], axis: 'z', tint: 'dark' }] },
  { id: 'drill', parts: [
    { shape: 'cone', offset: [0, 0, 0.1], size: [0.14, 0.26, 0.14], axis: 'z', tint: 'steel' },
    { shape: 'cylinder', offset: [0, 0, -0.08], size: [0.12, 0.12, 0.12], axis: 'z' },
    { shape: 'ring', offset: [0, 0, 0], size: [0.15, 0.025, 0.15], axis: 'z', tint: 'glow' }] },
  { id: 'blade', spin: 20, parts: [
    { shape: 'ring', offset: [0, 0, 0], size: [0.5, 0.02, 0.5], tint: 'steel' },
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.12, 0.03, 0.12], tint: 'glow' },
    { offset: [0, 0, 0], size: [0.42, 0.01, 0.03], tint: 'steel' }] },
]);
