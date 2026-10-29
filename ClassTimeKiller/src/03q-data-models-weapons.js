// ==== S03 DATA: WEAPON MODELS ====
// One code-drawn model per weapon W01..W46 (first-person view model, the weapon an actor holds and a weapon pickup) and per
// visible projectile, in the one part format of the model builder (07c-render-models.js, whose header documents parts,
// tints and LODs; MODEL_SCHEMA in 03b). Weapon space = view space in metres: x = right, y = up, z = forward (the muzzle),
// origin = the grip. Projectile space: z = flight. A part turned rotation [0, -90] points the shape's Y axis forward
// (size[1] = its length). lod 2 = the leading parts a far held weapon keeps; lod 0 = small details (sights, rivets).
// tint: body (the weapon or projectile colour) | a palette name | accent | glow (self-lit) | shine (accent, self-lit).
// Row: from = a viewModels class row or an earlier row of the same catalogue whose parts come first (scaled by scale
// [x, y, z], minus its part indexes in drop); pose = the viewModels row for hold / ADS / kick (default: the from row's pose,
// else the weapon class); accent / glow override the pose's. Projectile rows add spin (rad/s about the model's up axis)
// and tumble (rad/s end over end), turning only in flight.

const MODEL_GRIP = { offset: [0, -0.08, -0.01], size: [0.035, 0.09, 0.045], rotation: [0, -10], tint: 'dark' };
// The energy cell of the R8 reload set (P6-01): a glowing block at the side, or a flat one on top (needle pod).
const MODEL_CELL_SIDE = { offset: [-0.04, -0.005, 0.02], size: [0.018, 0.06, 0.05], tint: 'glow', role: 'cell' };
const MODEL_CELL_TOP = { offset: [0, 0.06, 0.05], size: [0.05, 0.03, 0.1], tint: 'accent', role: 'cell' };

Data.define('weaponModels', MODEL_SCHEMA, [
  // ---- Melee: held upright ----
  { id: 'maul', pose: 'melee', parts: [
    { shape: 'cylinder', offset: [0, 0.06, 0], size: [0.035, 0.46, 0.035], tint: 'wood', lod: 2 },
    { offset: [0, 0.3, 0.02], size: [0.1, 0.1, 0.24], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.3, 0.15], size: [0.12, 0.04, 0.12], rotation: [0, -90], tint: 'steel' },
    { shape: 'cone', offset: [0, 0.3, -0.14], size: [0.07, 0.08, 0.07], rotation: [0, 90], tint: 'steel' },
    { shape: 'cylinder', offset: [0, -0.12, 0], size: [0.045, 0.12, 0.045], tint: 'dark' }] },
  { id: 'tanto', pose: 'melee', parts: [
    { shape: 'wedge', offset: [0, 0.15, 0.005], size: [0.012, 0.24, 0.045], tint: 'steel', lod: 2 },
    { shape: 'cylinder', offset: [0, -0.04, 0], size: [0.03, 0.12, 0.03], tint: 'dark', lod: 2 },
    { offset: [0, 0.025, 0], size: [0.07, 0.015, 0.035], tint: 'accent' }] },
  { id: 'bulwark', pose: 'melee', parts: [
    { offset: [-0.06, 0.02, 0.1], size: [0.26, 0.32, 0.03], lod: 2 },
    { shape: 'cylinder', offset: [0.04, 0.2, 0.13], size: [0.2, 0.015, 0.2], rotation: [0, -90], tint: 'steel', lod: 2 },
    { shape: 'ring', offset: [0.04, 0.2, 0.13], size: [0.23, 0.025, 0.23], rotation: [0, -90], tint: 'accent' },
    { offset: [-0.06, 0.18, 0.1], size: [0.27, 0.025, 0.04], tint: 'steel' },
    { shape: 'cylinder', offset: [0.04, 0.2, 0.145], size: [0.05, 0.03, 0.05], rotation: [0, -90], tint: 'dark' }] },
  // ---- Sidearms ----
  { id: 'warden', from: 'sidearm', parts: [
    { offset: [0, -0.09, -0.012], size: [0.04, 0.012, 0.055], tint: 'accent' },
    { offset: [0.012, 0.05, -0.025], size: [0.008, 0.012, 0.012], tint: 'accent', mirror: true, lod: 0 },
    { offset: [0, 0.05, 0.13], size: [0.008, 0.012, 0.012], tint: 'accent', lod: 0 }] },
  { id: 'verdict', pose: 'sidearm', parts: [
    { offset: [0, 0.02, 0.01], size: [0.04, 0.06, 0.1], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.04, 0.17], size: [0.032, 0.22, 0.032], rotation: [0, -90], tint: 'steel', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.025, 0.03], size: [0.07, 0.07, 0.07], rotation: [0, -90], tint: 'steel', role: 'cyl' },
    { offset: [0, -0.05, -0.04], size: [0.036, 0.1, 0.045], rotation: [0, -15], tint: 'wood' },
    { offset: [0, 0.06, 0.16], size: [0.014, 0.012, 0.22] },
    { offset: [0, 0.06, -0.035], size: [0.012, 0.03, 0.02], tint: 'dark', lod: 0 }] },
  { id: 'hush', from: 'sidearm', parts: [
    { shape: 'cylinder', offset: [0, 0.025, 0.27], size: [0.042, 0.2, 0.042], rotation: [0, -90], tint: 'dark' }] },
  { id: 'sparklock', pose: 'sidearm', glow: '#7df9ff', parts: [
    { shape: 'capsule', offset: [0, -0.005, 0.05], size: [0.06, 0.2, 0.06], rotation: [0, -90], lod: 2 },
    { ...MODEL_GRIP, lod: 2 },
    { shape: 'cylinder', offset: [0, -0.005, 0.17], size: [0.024, 0.06, 0.024], rotation: [0, -90], tint: 'steel' },
    { shape: 'ring', offset: [0, -0.005, 0.1], size: [0.075, 0.015, 0.075], rotation: [0, -90], tint: 'glow' },
    { shape: 'ring', offset: [0, -0.005, 0.14], size: [0.065, 0.015, 0.065], rotation: [0, -90], tint: 'glow' },
    MODEL_CELL_SIDE] },
  // ---- SMGs ----
  { id: 'wasp', from: 'smg', accent: '#e8c02a', parts: [
    { offset: [0, 0.04, 0.06], size: [0.02, 0.012, 0.18], tint: 'accent' },
    { offset: [0, -0.01, -0.21], size: [0.045, 0.06, 0.012], tint: 'steel' }] },
  { id: 'hornet', from: 'smg', scale: [1, 1, 1.15], parts: [
    { shape: 'cylinder', offset: [0, -0.045, 0.22], size: [0.045, 0.14, 0.045], rotation: [0, -90], tint: 'steel' },
    { offset: [0, -0.005, -0.16], size: [0.04, 0.06, 0.12], tint: 'dark' },
    { offset: [0, 0.05, 0.04], size: [0.025, 0.025, 0.05], tint: 'dark' }] },
  { id: 'needlethorn', pose: 'smg', accent: '#5b2d6e', glow: '#ff6ad5', parts: [
    { shape: 'capsule', offset: [0, 0, 0.06], size: [0.065, 0.3, 0.065], rotation: [0, -90], tint: 'accent', lod: 2 },
    { shape: 'cone', offset: [0, 0, 0.24], size: [0.02, 0.07, 0.02], rotation: [0, -90], tint: 'glow', lod: 2 },
    MODEL_GRIP,
    { shape: 'sphere', offset: [0, -0.05, 0.1], size: [0.05, 0.06, 0.07], tint: 'accent' },
    { shape: 'cone', offset: [0, 0.05, 0], size: [0.025, 0.05, 0.025], tint: 'glow' },
    { shape: 'cone', offset: [0, 0.05, 0.07], size: [0.025, 0.05, 0.025], tint: 'glow' },
    MODEL_CELL_TOP] },
  // ---- Rifles ----
  { id: 'vanguard', from: 'rifle', drop: [1, 2, 4], parts: [
    { offset: [0, -0.02, -0.17], size: [0.045, 0.075, 0.15], rotation: [0, -6], tint: 'wood', lod: 2 },
    { offset: [0, -0.1, 0.09], size: [0.035, 0.13, 0.05], rotation: [0, 18], tint: 'dark', role: 'mag' },
    { offset: [0, -0.005, 0.2], size: [0.05, 0.05, 0.1], tint: 'wood' },
    { shape: 'cylinder', offset: [0, 0.035, 0.22], size: [0.018, 0.14, 0.018], rotation: [0, -90], tint: 'steel' },
    { offset: [0, 0.04, 0.36], size: [0.01, 0.03, 0.01], tint: 'dark', lod: 0 }] },
  { id: 'ratchet', from: 'rifle', drop: [2, 4], parts: [
    { offset: [0, 0.09, 0.05], size: [0.02, 0.025, 0.26], lod: 2 },
    { offset: [0, -0.08, -0.1], size: [0.035, 0.11, 0.05], tint: 'dark' },
    { offset: [0, -0.07, 0.06], size: [0.03, 0.08, 0.04], rotation: [0, -10], tint: 'dark', role: 'mag' }] },
  // ---- Shotguns ----
  { id: 'scattergun', from: 'shotgun', drop: [3], parts: [
    { offset: [0, -0.03, -0.2], size: [0.05, 0.085, 0.17], rotation: [0, -6], tint: 'wood' },
    { shape: 'cylinder', offset: [0, -0.025, 0.36], size: [0.03, 0.12, 0.03], rotation: [0, -90], tint: 'steel' }] },
  { id: 'hookjaw', pose: 'shotgun', accent: '#c06030', parts: [
    { offset: [0, 0, 0], size: [0.07, 0.07, 0.16], lod: 2 },
    { shape: 'cylinder', offset: [0.019, 0.02, 0.24], size: [0.036, 0.34, 0.036], rotation: [0, -90], tint: 'steel', mirror: true, lod: 2, role: 'barrel' },
    { offset: [0, -0.03, -0.17], size: [0.05, 0.085, 0.2], rotation: [0, -8], tint: 'wood' },
    { offset: [0, -0.015, 0.12], size: [0.06, 0.03, 0.12], tint: 'wood' },
    { shape: 'cone', offset: [0, -0.05, 0.34], size: [0.05, 0.08, 0.05], rotation: [0, -90], tint: 'accent' }] },
  { id: 'shardcaster', pose: 'shotgun', glow: '#ffd27a', parts: [
    { offset: [0, 0, 0.02], size: [0.065, 0.085, 0.26], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.02, 0.24], size: [0.05, 0.18, 0.05], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, -0.07, 0.05], size: [0.11, 0.06, 0.11], rotation: [0, -90], tint: 'accent', role: 'mag' },
    { offset: [0, -0.02, -0.18], size: [0.05, 0.08, 0.14], tint: 'dark' },
    { shape: 'cone', offset: [0, 0.07, 0], size: [0.03, 0.06, 0.03], tint: 'glow' },
    { shape: 'cone', offset: [0, 0.065, 0.06], size: [0.025, 0.05, 0.025], rotation: [0, 20], tint: 'glow' }] },
  // ---- Marksman and sniper ----
  { id: 'lancet', from: 'rail', parts: [
    { shape: 'cylinder', offset: [0, 0.08, 0.02], size: [0.035, 0.16, 0.035], rotation: [0, -90], tint: 'dark' },
    { offset: [0, -0.01, -0.2], size: [0.045, 0.08, 0.14], tint: 'dark' },
    { offset: [0.022, 0, 0.33], size: [0.012, 0.05, 0.12], tint: 'steel', mirror: true },
    MODEL_CELL_SIDE] },
  { id: 'heron', from: 'sniper', parts: [
    { shape: 'cylinder', offset: [0, 0.08, 0.19], size: [0.06, 0.04, 0.06], rotation: [0, -90], tint: 'dark' },
    { offset: [0.025, -0.08, 0.38], size: [0.01, 0.13, 0.01], rotation: [0, 25], tint: 'steel', mirror: true },
    { shape: 'cylinder', offset: [0, 0.01, 0.6], size: [0.035, 0.05, 0.035], rotation: [0, -90], tint: 'steel' },
    { offset: [0.04, 0.02, -0.04], size: [0.045, 0.012, 0.012], tint: 'steel', lod: 0 },
    { offset: [0, 0.045, -0.18], size: [0.04, 0.02, 0.1], tint: 'dark', lod: 0 },
    { offset: [0, -0.06, 0.04], size: [0.03, 0.07, 0.05], tint: 'dark', role: 'mag' },
    { shape: 'cylinder', offset: [0.04, 0.03, -0.02], size: [0.012, 0.05, 0.012], tint: 'steel', lod: 0, role: 'bolt' }] },
  { id: 'kestrel', from: 'dmr', accent: '#5a6a4a', parts: [
    { offset: [0, -0.08, 0.06], size: [0.035, 0.1, 0.06], tint: 'dark', role: 'mag' },
    { offset: [0, 0, 0.24], size: [0.058, 0.062, 0.12], tint: 'accent' },
    { shape: 'cylinder', offset: [0, 0.01, 0.46], size: [0.032, 0.05, 0.032], rotation: [0, -90], tint: 'steel' },
    { shape: 'ring', offset: [0, 0.075, 0.14], size: [0.04, 0.01, 0.04], rotation: [0, -90], tint: 'glow', lod: 0 }] },
  { id: 'stakedriver', pose: 'dmr', accent: '#a04a2a', glow: '#ff8a3d', parts: [
    { offset: [0, 0, 0.03], size: [0.06, 0.08, 0.3], lod: 2 },
    { offset: [0, 0.03, 0.2], size: [0.34, 0.03, 0.04], tint: 'dark', lod: 2, role: 'string' },
    { shape: 'cylinder', offset: [0, 0.06, 0.12], size: [0.025, 0.4, 0.025], rotation: [0, -90], tint: 'wood', role: 'mag' },
    { shape: 'cone', offset: [0, 0.06, 0.34], size: [0.035, 0.06, 0.035], rotation: [0, -90], tint: 'steel' },
    { shape: 'capsule', offset: [0, -0.055, 0.08], size: [0.05, 0.18, 0.05], rotation: [0, -90], tint: 'accent' },
    { offset: [0, -0.015, -0.18], size: [0.045, 0.07, 0.14], tint: 'dark' }] },
  { id: 'talonbow', pose: 'dmr', accent: '#6a8a3a', parts: [
    { offset: [0, 0, 0.12], size: [0.03, 0.16, 0.04], lod: 2 },
    { offset: [0, 0.17, 0.1], size: [0.02, 0.2, 0.03], rotation: [0, 20], tint: 'dark', lod: 2 },
    { offset: [0, -0.17, 0.1], size: [0.02, 0.2, 0.03], rotation: [0, -20], tint: 'dark' },
    { offset: [0, 0, 0.065], size: [0.004, 0.5, 0.004], tint: 'steel', role: 'string' },
    { shape: 'cylinder', offset: [0, 0, 0.12], size: [0.012, 0.34, 0.012], rotation: [0, -90], tint: 'wood', role: 'arrow' },
    { shape: 'cone', offset: [0, 0, 0.3], size: [0.025, 0.05, 0.025], rotation: [0, -90], tint: 'steel', role: 'arrow' }] },
  // ---- Energy ----
  { id: 'coilcaster', pose: 'energy', accent: '#c87533', glow: '#7fd8ff', parts: [
    { offset: [0, 0, 0.02], size: [0.06, 0.085, 0.28], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.01, 0.24], size: [0.03, 0.26, 0.03], rotation: [0, -90], tint: 'steel', lod: 2 },
    { shape: 'ring', offset: [0, 0.01, 0.16], size: [0.085, 0.03, 0.085], rotation: [0, -90], tint: 'accent' },
    { shape: 'ring', offset: [0, 0.01, 0.23], size: [0.08, 0.03, 0.08], rotation: [0, -90], tint: 'accent' },
    { shape: 'ring', offset: [0, 0.01, 0.3], size: [0.075, 0.03, 0.075], rotation: [0, -90], tint: 'accent' },
    MODEL_GRIP,
    { shape: 'sphere', offset: [0, 0.055, 0.02], size: [0.05, 0.04, 0.08], tint: 'glow' },
    MODEL_CELL_SIDE] },
  { id: 'linker', pose: 'energy', accent: '#3a6a8a', parts: [
    { offset: [0, 0, 0.04], size: [0.07, 0.09, 0.3], lod: 2 },
    { offset: [0.025, 0, 0.27], size: [0.015, 0.04, 0.14], tint: 'steel', mirror: true, lod: 2 },
    { shape: 'sphere', offset: [0, 0, 0.25], size: [0.035, 0.035, 0.035], tint: 'glow' },
    MODEL_GRIP,
    { shape: 'cylinder', offset: [0, 0.07, -0.02], size: [0.05, 0.16, 0.05], rotation: [0, -90], tint: 'accent' },
    MODEL_CELL_SIDE] },
  { id: 'ember', pose: 'energy', accent: '#5a3a2a', glow: '#ff7a2a', parts: [
    { offset: [0, 0, 0.04], size: [0.065, 0.09, 0.32], lod: 2 },
    { shape: 'cylinder', offset: [0, 0, 0.27], size: [0.04, 0.16, 0.04], rotation: [0, -90], tint: 'dark', lod: 2 },
    { offset: [0, 0.065, 0.02], size: [0.006, 0.04, 0.16], tint: 'accent' },
    { offset: [0.022, 0.065, 0.02], size: [0.006, 0.04, 0.16], tint: 'accent', mirror: true },
    MODEL_GRIP,
    { offset: [0, -0.02, 0.16], size: [0.07, 0.02, 0.06], tint: 'glow' },
    MODEL_CELL_SIDE] },
  { id: 'stormlash', pose: 'energy', glow: '#9fd8ff', parts: [
    { offset: [0, 0, 0.02], size: [0.065, 0.085, 0.26], lod: 2 },
    { shape: 'sphere', offset: [0, 0.02, 0.22], size: [0.09, 0.09, 0.09], tint: 'glow', lod: 2 },
    { offset: [0.03, 0.02, 0.3], size: [0.012, 0.012, 0.12], tint: 'steel', mirror: true },
    { shape: 'ring', offset: [0, 0.02, 0.15], size: [0.08, 0.02, 0.08], rotation: [0, -90], tint: 'accent' },
    MODEL_GRIP,
    { shape: 'cylinder', offset: [0, -0.06, 0.06], size: [0.04, 0.16, 0.04], rotation: [0, -90], tint: 'dark' },
    MODEL_CELL_SIDE] },
  { id: 'starthrower', pose: 'energy', accent: '#8090a8', glow: '#c8f0ff', parts: [
    { offset: [0, 0, 0.04], size: [0.08, 0.07, 0.3], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.06, 0.02], size: [0.16, 0.025, 0.16], tint: 'accent', lod: 2, role: 'cell' },
    { shape: 'ring', offset: [0, 0.06, 0.02], size: [0.17, 0.02, 0.17], tint: 'glow' },
    MODEL_GRIP,
    { offset: [0, 0, 0.21], size: [0.1, 0.025, 0.04], tint: 'dark' }] },
  { id: 'accelerator', pose: 'energy', glow: '#b07aff', parts: [
    { offset: [0, 0, 0], size: [0.07, 0.09, 0.26], lod: 2 },
    { offset: [0, 0.04, 0.25], size: [0.02, 0.02, 0.3], tint: 'steel', lod: 2 },
    { offset: [0, -0.03, 0.25], size: [0.02, 0.02, 0.3], tint: 'steel' },
    { shape: 'sphere', offset: [0, 0.07, -0.04], size: [0.04, 0.04, 0.04], tint: 'glow' },
    MODEL_GRIP,
    { shape: 'sphere', offset: [0, 0.07, 0.04], size: [0.04, 0.04, 0.04], tint: 'glow' },
    MODEL_CELL_SIDE] },
  // ---- Heavy ----
  { id: 'hailstorm', pose: 'heavy', accent: '#6a6a3a', parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.13, 0.16, 0.13], rotation: [0, -90], lod: 2 },
    { shape: 'cylinder', offset: [0.028, 0.028, 0.2], size: [0.022, 0.3, 0.022], rotation: [0, -90], tint: 'steel', mirror: true, lod: 2 },
    { shape: 'cylinder', offset: [0.028, -0.028, 0.2], size: [0.022, 0.3, 0.022], rotation: [0, -90], tint: 'steel', mirror: true },
    { shape: 'cylinder', offset: [0, 0, 0.33], size: [0.1, 0.025, 0.1], rotation: [0, -90], tint: 'dark' },
    { offset: [0, -0.11, -0.02], size: [0.1, 0.08, 0.1], tint: 'accent', role: 'mag' },
    { offset: [0, 0.1, 0], size: [0.03, 0.04, 0.12], tint: 'dark' },
    { offset: [0, 0.075, 0], size: [0.1, 0.012, 0.12], tint: 'steel', role: 'lid' }] },
  { id: 'kindler', pose: 'heavy', accent: '#a33a2a', glow: '#ff8a3d', parts: [
    { offset: [0, 0, 0.02], size: [0.07, 0.08, 0.26], lod: 2 },
    { shape: 'capsule', offset: [0, -0.075, 0.02], size: [0.08, 0.26, 0.08], rotation: [0, -90], tint: 'accent', lod: 2, role: 'cell' },
    { shape: 'cylinder', offset: [0, 0.01, 0.24], size: [0.04, 0.18, 0.04], rotation: [0, -90], tint: 'steel' },
    { shape: 'cone', offset: [0, 0.01, 0.35], size: [0.075, 0.05, 0.075], rotation: [0, 90], tint: 'dark' },
    { shape: 'sphere', offset: [0, -0.03, 0.34], size: [0.022, 0.022, 0.022], tint: 'glow' },
    { offset: [0, -0.06, -0.09], size: [0.03, 0.08, 0.04], rotation: [0, -10], tint: 'dark' }] },
  // ---- Explosive ----
  { id: 'ramjet', from: 'launcher', drop: [1], accent: '#ff8a3d', parts: [
    { shape: 'cylinder', offset: [0, 0.01, 0.37], size: [0.13, 0.03, 0.13], rotation: [0, -90], tint: 'dark' },
    { shape: 'cone', offset: [0, 0.01, 0.39], size: [0.07, 0.07, 0.07], rotation: [0, -90], tint: 'accent' },
    { shape: 'cone', offset: [0, 0.01, -0.15], size: [0.14, 0.08, 0.14], rotation: [0, -90], tint: 'dark', role: 'lid' },
    { shape: 'cylinder', offset: [0, 0.01, -0.02], size: [0.085, 0.2, 0.085], rotation: [0, -90], tint: 'steel', role: 'mag' },
    { offset: [0, -0.08, 0.2], size: [0.03, 0.07, 0.04], tint: 'dark' }] },
  { id: 'pitcher', pose: 'launcher', accent: '#6a8f3a', parts: [
    { shape: 'cylinder', offset: [0, 0.02, 0.2], size: [0.07, 0.22, 0.07], rotation: [0, -90], lod: 2 },
    { shape: 'cylinder', offset: [0, 0, 0.04], size: [0.14, 0.1, 0.14], rotation: [0, -90], tint: 'dark', lod: 2, role: 'mag' },
    { shape: 'ring', offset: [0, 0, 0.04], size: [0.15, 0.04, 0.15], rotation: [0, -90], tint: 'accent' },
    { offset: [0, 0.055, 0.08], size: [0.03, 0.025, 0.3], tint: 'steel' },
    { offset: [0, -0.03, -0.14], size: [0.045, 0.08, 0.14], tint: 'dark' },
    { offset: [0, -0.08, -0.04], size: [0.035, 0.09, 0.045], rotation: [0, -10], tint: 'dark' }] },
  { id: 'gloop', pose: 'launcher', glow: '#7fe04a', parts: [
    { offset: [0, 0, 0.04], size: [0.06, 0.08, 0.26], lod: 2 },
    { shape: 'sphere', offset: [0, 0.085, 0], size: [0.1, 0.1, 0.1], tint: 'glow', lod: 2, role: 'cell' },
    { shape: 'cylinder', offset: [0, 0, 0.22], size: [0.05, 0.12, 0.05], rotation: [0, -90], tint: 'dark' },
    MODEL_GRIP,
    { shape: 'cone', offset: [0, 0, 0.3], size: [0.08, 0.05, 0.08], rotation: [0, 90], tint: 'dark' }] },
  { id: 'fusionmortar', pose: 'launcher', glow: '#ffee88', parts: [
    { shape: 'cylinder', offset: [0, 0.02, 0.12], size: [0.15, 0.34, 0.15], rotation: [0, -90], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.02, 0.29], size: [0.17, 0.04, 0.17], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'sphere', offset: [0, 0.02, 0.27], size: [0.1, 0.1, 0.1], tint: 'glow', role: 'mag' },
    { shape: 'cylinder', offset: [0, 0.02, -0.06], size: [0.17, 0.03, 0.17], rotation: [0, -90], tint: 'dark', role: 'lid' },
    { offset: [0, -0.1, 0.06], size: [0.035, 0.09, 0.045], rotation: [0, -10], tint: 'dark' }] },
  // ---- Tools ----
  { id: 'lifter', pose: 'tool', parts: [
    { offset: [0, 0, 0], size: [0.09, 0.1, 0.2], lod: 2 },
    { shape: 'sphere', offset: [0, 0, 0.13], size: [0.06, 0.06, 0.06], tint: 'glow', lod: 2 },
    { offset: [0, 0.05, 0.18], size: [0.02, 0.02, 0.12], rotation: [0, 20], tint: 'dark' },
    { offset: [0.045, -0.025, 0.18], size: [0.02, 0.02, 0.12], tint: 'dark', mirror: true },
    { shape: 'ring', offset: [0, 0, 0.1], size: [0.11, 0.02, 0.11], rotation: [0, -90], tint: 'accent' }] },
  { id: 'twingate', pose: 'tool', accent: '#4aa8ff', glow: '#ffa040', parts: [
    { offset: [0, 0, 0.02], size: [0.08, 0.09, 0.22], lod: 2 },
    { shape: 'cylinder', offset: [-0.03, 0.01, 0.16], size: [0.035, 0.08, 0.035], rotation: [0, -90], tint: 'glow', lod: 2 },
    { shape: 'cylinder', offset: [0.03, 0.01, 0.16], size: [0.035, 0.08, 0.035], rotation: [0, -90], tint: 'shine' },
    { offset: [0, 0.06, 0], size: [0.01, 0.03, 0.14], tint: 'dark' },
    { offset: [0, -0.09, -0.02], size: [0.035, 0.09, 0.045], rotation: [0, -10], tint: 'dark' }] },
  // ---- Exotic and power ----
  { id: 'auger', pose: 'exotic', parts: [
    { shape: 'capsule', offset: [0, 0, 0.02], size: [0.08, 0.28, 0.08], rotation: [0, -90], lod: 2 },
    { shape: 'cone', offset: [0, 0, 0.24], size: [0.08, 0.16, 0.08], rotation: [0, -90], tint: 'steel', lod: 2 },
    { shape: 'sphere', offset: [0, 0.07, -0.02], size: [0.07, 0.07, 0.08], tint: 'bone' },
    MODEL_GRIP,
    { shape: 'ring', offset: [0, 0, 0.2], size: [0.085, 0.02, 0.085], rotation: [0, -90], tint: 'dark', role: 'lid' },
    { shape: 'cone', offset: [0, 0.045, 0.02], size: [0.05, 0.1, 0.05], rotation: [0, -90], tint: 'steel', role: 'mag' }] },
  { id: 'razorwind', pose: 'exotic', glow: '#bfe6ff', parts: [
    { shape: 'capsule', offset: [0, 0, 0.06], size: [0.07, 0.3, 0.07], rotation: [0, -90], lod: 2 },
    { shape: 'ring', offset: [0, 0.06, 0.08], size: [0.2, 0.012, 0.2], tint: 'steel', lod: 2 },
    MODEL_GRIP,
    { shape: 'cylinder', offset: [0, 0.06, 0.08], size: [0.05, 0.015, 0.05], tint: 'glow' }] },
  { id: 'daybreak', from: 'power', glow: '#ffd98a', parts: [
    { shape: 'sphere', offset: [0, 0.02, 0.48], size: [0.08, 0.08, 0.08], tint: 'glow' },
    { shape: 'ring', offset: [0, 0.02, 0.48], size: [0.13, 0.015, 0.13], rotation: [0, -90], tint: 'accent' },
    MODEL_CELL_SIDE] },
  { id: 'halcyon', pose: 'power', accent: '#d03a2a', parts: [
    { shape: 'cylinder', offset: [0, 0.02, 0.1], size: [0.13, 0.5, 0.13], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'capsule', offset: [0, 0.02, 0.4], size: [0.11, 0.18, 0.11], rotation: [0, -90], tint: 'bone', lod: 2, role: 'mag' },
    { shape: 'cone', offset: [0, 0.02, 0.5], size: [0.1, 0.08, 0.1], rotation: [0, -90], tint: 'accent', role: 'mag' },
    { shape: 'ring', offset: [0, 0.02, 0.36], size: [0.12, 0.03, 0.12], rotation: [0, -90] },
    { offset: [0, 0.02, -0.12], size: [0.22, 0.014, 0.08] },
    { offset: [0, 0.02, -0.12], size: [0.014, 0.22, 0.08] },
    { offset: [0, -0.1, 0.04], size: [0.035, 0.09, 0.045], rotation: [0, -10], tint: 'dark' }] },
]);

// Visible projectiles (P01..P21 rows of 03c without a model stay a glowing sphere). Sizes in metres.
Data.define('projectileModels', MODEL_SCHEMA, [
  { id: 'rocket', accent: '#3a3f46', glow: '#ffb060', parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.1, 0.34, 0.1], rotation: [0, -90], tint: 'steel', lod: 2 },
    { shape: 'cone', offset: [0, 0, 0.21], size: [0.1, 0.09, 0.1], rotation: [0, -90], lod: 2 },
    { offset: [0, 0, -0.14], size: [0.22, 0.012, 0.07], tint: 'accent' },
    { offset: [0, 0, -0.14], size: [0.012, 0.22, 0.07], tint: 'accent' },
    { shape: 'sphere', offset: [0, 0, -0.2], size: [0.08, 0.08, 0.1], tint: 'glow' }] },
  { id: 'missile', from: 'rocket', scale: [0.75, 0.75, 0.75] },
  { id: 'warhead', from: 'rocket', scale: [2.4, 2.4, 2.4], parts: [
    { shape: 'ring', offset: [0, 0, 0.22], size: [0.26, 0.06, 0.26], rotation: [0, -90], tint: 'accent' }] },
  { id: 'grenade', tumble: 9, parts: [
    { shape: 'sphere', offset: [0, 0, 0], size: [0.17, 0.15, 0.21], lod: 2 },
    { shape: 'ring', offset: [0, 0, 0], size: [0.19, 0.04, 0.19], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, 0, 0.11], size: [0.06, 0.04, 0.06], rotation: [0, -90], tint: 'steel' }] },
  { id: 'contact', from: 'grenade', parts: [
    { shape: 'sphere', offset: [0, 0, 0.13], size: [0.04, 0.04, 0.04], tint: 'glow' }] },
  { id: 'mine', parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.24, 0.07, 0.24], tint: 'dark', lod: 2 },
    { shape: 'sphere', offset: [0, 0.035, 0], size: [0.19, 0.1, 0.19], lod: 2 },
    { shape: 'sphere', offset: [0, 0.09, 0], size: [0.05, 0.05, 0.05], tint: 'glow' }] },
  { id: 'stake', glow: '#ff8a3d', parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.035, 0.5, 0.035], rotation: [0, -90], tint: 'wood', lod: 2 },
    { shape: 'cone', offset: [0, 0, 0.29], size: [0.045, 0.08, 0.045], rotation: [0, -90], tint: 'steel', lod: 2 },
    { shape: 'ring', offset: [0, 0, 0.2], size: [0.05, 0.02, 0.05], rotation: [0, -90], tint: 'glow' }] },
  { id: 'arrow', accent: '#c84a3a', parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.014, 0.6, 0.014], rotation: [0, -90], tint: 'wood', lod: 2 },
    { shape: 'cone', offset: [0, 0, 0.32], size: [0.03, 0.06, 0.03], rotation: [0, -90], tint: 'steel', lod: 2 },
    { offset: [0, 0, -0.26], size: [0.004, 0.05, 0.08], tint: 'accent' },
    { offset: [0, 0, -0.26], size: [0.05, 0.004, 0.08], tint: 'accent' }] },
  { id: 'needle', parts: [
    { shape: 'cone', offset: [0, 0, 0.04], size: [0.025, 0.16, 0.025], rotation: [0, -90], tint: 'glow', lod: 2 },
    { shape: 'cylinder', offset: [0, 0, -0.06], size: [0.012, 0.06, 0.012], rotation: [0, -90], tint: 'dark' }] },
  { id: 'shard', parts: [
    { shape: 'cone', offset: [0, 0, 0.03], size: [0.04, 0.1, 0.04], rotation: [0, -90], tint: 'glow', lod: 2 },
    { shape: 'cone', offset: [0, 0, -0.03], size: [0.04, 0.06, 0.04], rotation: [0, 90], tint: 'glow' }] },
  { id: 'disc', spin: 14, parts: [
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.3, 0.025, 0.3], lod: 2 },
    { shape: 'ring', offset: [0, 0, 0], size: [0.32, 0.03, 0.32], tint: 'glow', lod: 2 },
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.08, 0.035, 0.08], tint: 'dark' }] },
  { id: 'hook', parts: [
    { shape: 'cone', offset: [0, 0, 0.1], size: [0.12, 0.16, 0.12], rotation: [0, -90], tint: 'steel', lod: 2 },
    { shape: 'ring', offset: [0, 0, -0.02], size: [0.16, 0.03, 0.16], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, 0, -0.25], size: [0.015, 0.4, 0.015], rotation: [0, -90], tint: 'dark' }] },
  { id: 'drill', parts: [
    { shape: 'cone', offset: [0, 0, 0.1], size: [0.14, 0.26, 0.14], rotation: [0, -90], tint: 'steel', lod: 2 },
    { shape: 'cylinder', offset: [0, 0, -0.08], size: [0.12, 0.12, 0.12], rotation: [0, -90], lod: 2 },
    { shape: 'ring', offset: [0, 0, 0], size: [0.15, 0.025, 0.15], rotation: [0, -90], tint: 'glow' }] },
  { id: 'blade', spin: 20, parts: [
    { shape: 'ring', offset: [0, 0, 0], size: [0.5, 0.02, 0.5], tint: 'steel', lod: 2 },
    { shape: 'cylinder', offset: [0, 0, 0], size: [0.12, 0.03, 0.12], tint: 'glow', lod: 2 },
    { offset: [0, 0, 0], size: [0.42, 0.01, 0.03], tint: 'steel' }] },
]);
