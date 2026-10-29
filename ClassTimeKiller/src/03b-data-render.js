// Render catalogues read by the generic renderer code in 07*: world materials, the six map themes (MAP-022),
// team colours, effect and decal kinds (PERF-010 pools), the humanoid rig parts (REN-002) and the
// view-model parts per weapon class. New content = new rows; colours are '#rrggbb' display colours.

// pattern: noise | panels | tiles | planks | bricks | stripes | glow | grid | flat (drawn by the world shader, 07b).
// scale = pattern repeats per metre, shine = extra sun highlight 0..1, emissive = self-lit 0..1.
Data.define('materials', { id: REQUIRED, name: REQUIRED, pattern: 'noise', scale: 1, colorA: '#8c8c88', colorB: '#72726e', emissive: 0, shine: 0 }, [
  { id: 'concrete', name: 'Concrete', pattern: 'noise', scale: 0.6, colorA: '#9a9a95', colorB: '#7c7c78' },
  { id: 'metal', name: 'Metal panels', pattern: 'panels', scale: 0.5, colorA: '#8d949c', colorB: '#6b7279', shine: 0.5 },
  { id: 'plate', name: 'Floor plate', pattern: 'grid', scale: 1, colorA: '#62676d', colorB: '#45494e', shine: 0.3 },
  { id: 'tile', name: 'Tiles', pattern: 'tiles', scale: 1, colorA: '#c4c8cc', colorB: '#8f9499', shine: 0.2 },
  { id: 'wood', name: 'Wood planks', pattern: 'planks', scale: 0.8, colorA: '#8a6642', colorB: '#6a4c30' },
  { id: 'crate', name: 'Crate', pattern: 'planks', scale: 1.5, colorA: '#9a7a4c', colorB: '#6e5434' },
  { id: 'brick', name: 'Brick', pattern: 'bricks', scale: 1, colorA: '#9b5a44', colorB: '#6d3f30' },
  { id: 'rock', name: 'Rock', pattern: 'noise', scale: 0.35, colorA: '#857f76', colorB: '#625d56' },
  { id: 'sand', name: 'Sand', pattern: 'noise', scale: 1.6, colorA: '#d2bd92', colorB: '#bba57a' },
  { id: 'grass', name: 'Grass', pattern: 'noise', scale: 1.2, colorA: '#5f8f3a', colorB: '#47712c' },
  { id: 'moss', name: 'Moss', pattern: 'noise', scale: 0.8, colorA: '#5c7a3a', colorB: '#3f5a2a' },
  { id: 'snow', name: 'Snow', pattern: 'noise', scale: 0.7, colorA: '#eef3f7', colorB: '#d6e0e8', shine: 0.2 },
  { id: 'ice', name: 'Ice', pattern: 'noise', scale: 0.4, colorA: '#a9d6ec', colorB: '#80b6d3', shine: 0.8 },
  { id: 'glass', name: 'Glass', pattern: 'panels', scale: 0.4, colorA: '#7fa9c4', colorB: '#5c86a3', shine: 1 },
  { id: 'water', name: 'Water', pattern: 'noise', scale: 0.3, colorA: '#2f5d70', colorB: '#3f7890', shine: 1 },
  { id: 'oil', name: 'Oil drum', pattern: 'stripes', scale: 1, colorA: '#3b4a2c', colorB: '#c89a2a', shine: 0.4 },   // a breakable prop of it spills oil (CAT.surfaces)
  { id: 'hazard', name: 'Hazard stripes', pattern: 'stripes', scale: 2, colorA: '#e8b02a', colorB: '#26231f' },
  { id: 'grip', name: 'Grip wall', pattern: 'grid', scale: 2, colorA: '#4f7a5a', colorB: '#2e4a36' },   // MV05 climbs only this (climbGripOnly)
  { id: 'trim', name: 'Trim', pattern: 'flat', scale: 1, colorA: '#c0602a', colorB: '#8a4420' },
  { id: 'light', name: 'Light panel', pattern: 'glow', scale: 1, colorA: '#3a3a3a', colorB: '#fff1cc', emissive: 1 },
]);

// Map themes / tilesets (MAP-022). Map rows pick one with `theme`. palette overrides material colours [A, B].
// sunElevation / sunAzimuth in degrees (azimuth 0 = toward +Z). fogDensity 1 = fog reaches full at the view distance.
Data.define('themes', {
  id: REQUIRED, name: REQUIRED, skyTop: '#2c4f80', skyHorizon: '#b4cbe0', fog: '#b4cbe0', fogDensity: 1,
  sunColor: '#fff2d8', sunIntensity: 1, sunElevation: 50, sunAzimuth: 35, ambientSky: '#71879f', ambientGround: '#4f463c', palette: {},
}, [
  { id: 'foundry', name: 'Foundry', skyTop: '#3b2f3a', skyHorizon: '#d9925a', fog: '#b9815a', sunColor: '#ffc58a', sunElevation: 28, sunAzimuth: 220,
    ambientSky: '#6d6a7a', ambientGround: '#5a4636',
    palette: { concrete: ['#8a7f74', '#6e655c'], metal: ['#7b7f86', '#5d6168'], plate: ['#5c5f63', '#3f4246'], trim: ['#c0602a', '#8a4420'], light: ['#3a2c22', '#ffb066'] } },
  { id: 'ruins', name: 'Ruins', skyTop: '#4f86c6', skyHorizon: '#d8e4ee', fog: '#d6d0c0', sunColor: '#fff1d0', sunElevation: 55, sunAzimuth: 120,
    ambientSky: '#8fa6c0', ambientGround: '#8a7558',
    palette: { concrete: ['#c9b48e', '#a8916b'], brick: ['#b5734f', '#8e5539'], rock: ['#9c8f7b', '#7b705f'], sand: ['#d9c39a', '#c2aa7e'], trim: ['#7f6a4a', '#5f4f36'] } },
  { id: 'station', name: 'Station', skyTop: '#05070f', skyHorizon: '#1b2a44', fog: '#1b2a44', sunColor: '#cfe3ff', sunElevation: 40, sunAzimuth: 300,
    ambientSky: '#5a6f92', ambientGround: '#2c3444',
    palette: { metal: ['#a7b1bf', '#8691a1'], plate: ['#59626f', '#3d4450'], tile: ['#c9d1da', '#a9b2bd'], light: ['#1c2633', '#7fd8ff'], trim: ['#2fa3c9', '#1d6f8c'], concrete: ['#8e96a0', '#737b85'] } },
  { id: 'canal', name: 'Canal', skyTop: '#6f7f8f', skyHorizon: '#c3ccd3', fog: '#aab6bf', sunColor: '#f2f0e6', sunIntensity: 0.8, sunElevation: 35, sunAzimuth: 160,
    ambientSky: '#8d9aa6', ambientGround: '#5c5a52',
    palette: { brick: ['#8f4b3c', '#6e382d'], concrete: ['#9aa0a3', '#7d8386'], water: ['#2f5a6a', '#3f7487'], wood: ['#6e5236', '#533c26'], metal: ['#5e6a70', '#475257'], tile: ['#7d8a6e', '#66725a'] } },
  { id: 'overgrowth', name: 'Overgrowth', skyTop: '#5ea0c8', skyHorizon: '#cfe6d9', fog: '#9fc0a5', sunColor: '#fff4c8', sunElevation: 60, sunAzimuth: 80,
    ambientSky: '#86b28f', ambientGround: '#4f5a36',
    palette: { grass: ['#5f8f3a', '#4a7430'], moss: ['#5c7a3a', '#3f5a2a'], rock: ['#7f8676', '#626a5c'], wood: ['#7a5a38', '#5a4128'], concrete: ['#8c9180', '#717665'], brick: ['#7f6a52', '#64523e'] } },
  { id: 'glacier', name: 'Glacier', skyTop: '#7fb2e6', skyHorizon: '#e9f3fb', fog: '#dce9f2', fogDensity: 1.3, sunColor: '#ffffff', sunElevation: 30, sunAzimuth: 20,
    ambientSky: '#a9c4e0', ambientGround: '#8c98a6',
    palette: { snow: ['#eef3f7', '#d9e3ea'], ice: ['#a9d6ec', '#86bcd8'], rock: ['#6d7682', '#555d68'], metal: ['#9aa4ae', '#7c8690'], concrete: ['#b9c2ca', '#9ea8b1'] } },
]);

// Team colours by team index (team 0 = first row). Free-for-all actors use their profile colour, else a row by actor id.
Data.define('teamColors', { id: REQUIRED, name: REQUIRED, color: REQUIRED }, [
  { id: 'blue', name: 'Blue', color: '#3d8bff' },
  { id: 'red', name: 'Red', color: '#ff4d4d' },
  { id: 'green', name: 'Green', color: '#45c46a' },
  { id: 'gold', name: 'Gold', color: '#f2b632' },
  { id: 'violet', name: 'Violet', color: '#a46bff' },
  { id: 'cyan', name: 'Cyan', color: '#3fd0d8' },
  { id: 'orange', name: 'Orange', color: '#ff8a3d' },
  { id: 'pink', name: 'Pink', color: '#ff6fb4' },
]);

// Particle kinds for Fx.burst (ARCHITECTURE Fx kinds). life/speed = [min, max] seconds / m/s, size = [start, end] metres,
// gravity m/s^2 (negative rises), drag 1/s, spread 0 = along the normal .. 1 = full sphere, alpha 0..1, additive = glow blend.
Data.define('fxKinds', {
  id: REQUIRED, count: 8, life: [0.3, 0.6], speed: [1, 3], size: [0.1, 0.05], gravity: 0, drag: 0, spread: 0.5, color: '#ffffff', alpha: 1, additive: false,
}, [
  { id: 'spark', count: 10, life: [0.15, 0.4], speed: [4, 9], size: [0.05, 0.015], gravity: 12, drag: 2, spread: 0.6, color: '#ffd27a', additive: true },
  { id: 'smoke', count: 6, life: [0.8, 1.6], speed: [0.3, 1.2], size: [0.25, 0.9], gravity: -0.6, drag: 1.5, spread: 1, color: '#8a8a8a', alpha: 0.45 },
  { id: 'dust', count: 8, life: [0.4, 0.9], speed: [0.5, 2], size: [0.12, 0.4], gravity: 1, drag: 3, spread: 0.9, color: '#b8a888', alpha: 0.55 },
  { id: 'blood', count: 8, life: [0.3, 0.6], speed: [1.5, 4], size: [0.07, 0.03], gravity: 9, drag: 1, spread: 0.5, color: '#9a1c1c', alpha: 0.9 },
  { id: 'muzzle', count: 4, life: [0.04, 0.07], speed: [0.5, 2], size: [0.14, 0.06], spread: 0.25, color: '#ffcf6a', additive: true },
  { id: 'explosion', count: 28, life: [0.3, 0.8], speed: [3, 10], size: [0.5, 1.2], gravity: -1, drag: 4, spread: 1, color: '#ff8a2a', additive: true },
  { id: 'energy', count: 12, life: [0.2, 0.5], speed: [2, 6], size: [0.08, 0.02], drag: 3, spread: 0.8, color: '#6fd8ff', additive: true },
  { id: 'water', count: 12, life: [0.3, 0.7], speed: [2, 5], size: [0.08, 0.04], gravity: 10, drag: 1, spread: 0.4, color: '#9fd0ff', alpha: 0.7 },
  { id: 'fire', count: 10, life: [0.4, 0.9], speed: [0.5, 2], size: [0.3, 0.05], gravity: -3, drag: 2, spread: 0.7, color: '#ff6a1a', additive: true },
  { id: 'frost', count: 10, life: [0.5, 1], speed: [0.5, 2.5], size: [0.1, 0.02], gravity: 1, drag: 2, spread: 0.9, color: '#cfefff', additive: true },
  { id: 'shock', count: 12, life: [0.1, 0.3], speed: [3, 8], size: [0.06, 0.02], drag: 4, spread: 1, color: '#b48cff', additive: true },
  { id: 'heal', count: 10, life: [0.6, 1.2], speed: [0.3, 1], size: [0.1, 0.02], gravity: -1.5, drag: 1, spread: 1, color: '#6dff9a', additive: true },
]);

// Decal kinds for Fx.decal (ring buffer sized by the quality row's `decals`). size = radius in metres, life in seconds.
Data.define('decalKinds', { id: REQUIRED, size: 0.1, life: 30, color: '#1b1b1b', alpha: 0.85, additive: false }, [
  { id: 'bullet', size: 0.06, color: '#1b1b1b', alpha: 0.85 },
  { id: 'scorch', size: 0.9, color: '#141210', alpha: 0.75 },
  { id: 'blood', size: 0.35, color: '#5a0d0d', alpha: 0.8 },
  { id: 'energy', size: 0.15, life: 8, color: '#5fd3ff', alpha: 0.9, additive: true },
  { id: 'frost', size: 0.5, life: 12, color: '#d8f2ff', alpha: 0.6 },
  { id: 'paint', size: 0.3, color: '#ff4fa0', alpha: 0.9 },
]);

// Rigid-part humanoid (REN-002) in actor space for a 1.80 m stand: x = left, y = up, z = forward (DATA-002).
// pivot = joint position, offset = part centre relative to the joint, size = full size, hold = base pitch (deg) of the part
// about its joint, tilt = extra pitch (deg) of the shape alone (its centre stays put: a cylinder with tilt 90 points forward),
// aim = how much the part follows the actor's pitch, swing = walk-cycle amplitude and side (+/-), far = kept in the far LOD,
// distant = kept past the preset's lodFar (a still silhouette), head = grows with the X14 head scale about its pivot,
// detail = a small part presets without `modelDetail` (Potato) skip, action = the slot the P6 action layer moves (1 armL, 2 armR, 3 gun, 4 torso, 5 head; 0 none). tint: team | teamDark (the team colour darkened) |
// model | modelDark | modelGlow (the body model row colour, 03s) | a MODEL_PALETTE name (07c-render-models.js).
// The far LOD keeps exactly the 6 parts marked far (REN-002). Body models (03s actorModels) use the same part format.
const ACTOR_PART_SCHEMA = { id: '', shape: 'box', pivot: [0, 0, 0], offset: [0, 0, 0], size: [0.2, 0.2, 0.2], hold: 0, tilt: 0, aim: 0, swing: 0, tint: 'team', far: false, distant: false, head: false, detail: false, action: 0 };
Data.define('actorParts', Object.assign({}, ACTOR_PART_SCHEMA, { id: REQUIRED }), [
  { id: 'torso', shape: 'box', pivot: [0, 1.16, 0], size: [0.52, 0.62, 0.3], aim: 0.25, tint: 'team', far: true, distant: true, action: 4 },
  { id: 'head', shape: 'sphere', pivot: [0, 1.62, 0], size: [0.28, 0.3, 0.28], aim: 1, tint: 'skin', far: true, distant: true, head: true, action: 5 },
  { id: 'legL', shape: 'capsule', pivot: [0.13, 0.86, 0], offset: [0, -0.42, 0], size: [0.19, 0.88, 0.19], swing: 1, tint: 'teamDark', far: true, distant: true },
  { id: 'legR', shape: 'capsule', pivot: [-0.13, 0.86, 0], offset: [0, -0.42, 0], size: [0.19, 0.88, 0.19], swing: -1, tint: 'teamDark', far: true, distant: true },
  { id: 'armL', shape: 'capsule', pivot: [0.32, 1.4, 0], offset: [0, -0.28, 0], size: [0.14, 0.6, 0.14], hold: 62, aim: 1, swing: 0.15, tint: 'team', far: true, action: 1 },
  { id: 'armR', shape: 'capsule', pivot: [-0.32, 1.4, 0], offset: [0, -0.28, 0], size: [0.14, 0.6, 0.14], hold: 80, aim: 1, swing: -0.1, tint: 'team', far: true, action: 2 },
  { id: 'hips', shape: 'box', pivot: [0, 0.88, 0], size: [0.46, 0.2, 0.28], tint: 'teamDark' },
  { id: 'visor', shape: 'box', pivot: [0, 1.62, 0], offset: [0, 0.02, 0.12], size: [0.22, 0.08, 0.07], aim: 1, tint: 'visor', head: true },
  { id: 'pack', shape: 'box', pivot: [0, 1.2, 0], offset: [0, 0, -0.2], size: [0.36, 0.42, 0.14], aim: 0.25, tint: 'teamDark' },
  { id: 'gun', shape: 'box', pivot: [-0.16, 1.32, 0], offset: [0, 0, 0.42], size: [0.08, 0.12, 0.62], aim: 1, tint: 'dark', action: 3 },
]);

// One row format for every code-drawn static model (03b viewModels, 03q weaponModels and projectileModels, 03r gearModels;
// built by 07c-render-models.js, whose header documents parts, tints and LODs): from = a row whose parts come first (minus
// its part indexes in drop, times scale: a number or [x, y, z], tints swapped by recolor { from: to }), parts = the row's own;
// color = the row's own body colour (-1 = the caller's); accent / glow = its accent and glow colours ('' = inherited, else the
// default); pose = the viewModels row for hold / ADS / kick (weapons); spin / tumble = rad/s in flight (projectiles);
// muzzle = [x, y, z] where a weapon's shots leave (null = the front end of its foremost parts, 07c measureMuzzle).
const MODEL_SCHEMA = { id: REQUIRED, from: '', drop: [], scale: null, recolor: {}, parts: [], color: -1, accent: '', glow: '', pose: '', spin: 0, tumble: 0, muzzle: null };

// View pose and base parts per weapon class (Render.viewModel shape): the bases and poses of the per-weapon models (03q).
// View space in metres: x = right, y = up, z = forward. hold / ads = weapon pivot when hip-firing / aiming down sights.
// tint: body (the weapon colour from Render.viewModel) | dark | accent | glow (self-lit).
Data.define('viewModels', Object.assign({}, MODEL_SCHEMA, { hold: [0.11, -0.1, 0.3], ads: [0, -0.11, 0.26], accent: '#c9a03a', glow: '#6fd8ff', kick: 1, parts: REQUIRED }), [
  { id: 'sidearm', ads: [0, -0.09, 0.26], kick: 1.3, parts: [
    { shape: 'box', offset: [0, 0.02, 0.05], size: [0.04, 0.05, 0.18], tint: 'body', lod: 2, role: 'slide' },
    { shape: 'box', offset: [0, -0.04, -0.01], size: [0.035, 0.09, 0.05], tint: 'dark', lod: 2, role: 'mag' },
    { shape: 'cylinder', offset: [0, 0.025, 0.15], size: [0.02, 0.04, 0.02], rotation: [0, -90], tint: 'dark' }] },
  { id: 'smg', kick: 0.6, parts: [
    { shape: 'box', offset: [0, 0, 0.06], size: [0.05, 0.07, 0.26], tint: 'body', lod: 2 },
    { shape: 'box', offset: [0, -0.07, 0.08], size: [0.03, 0.1, 0.04], tint: 'dark', lod: 2, role: 'mag' },
    { shape: 'box', offset: [0, -0.05, -0.03], size: [0.03, 0.08, 0.05], tint: 'dark' },
    { shape: 'cylinder', offset: [0, 0.01, 0.24], size: [0.025, 0.1, 0.025], rotation: [0, -90], tint: 'dark' }] },
  { id: 'rifle', parts: [
    { shape: 'box', offset: [0, 0, 0.04], size: [0.055, 0.08, 0.34], tint: 'body', lod: 2 },
    { shape: 'box', offset: [0, -0.01, -0.17], size: [0.045, 0.07, 0.14], tint: 'dark', lod: 2 },
    { shape: 'box', offset: [0, -0.08, 0.07], size: [0.035, 0.11, 0.05], tint: 'dark', role: 'mag' },
    { shape: 'cylinder', offset: [0, 0.01, 0.3], size: [0.022, 0.2, 0.022], rotation: [0, -90], tint: 'dark' },
    { shape: 'box', offset: [0, 0.055, 0.04], size: [0.03, 0.03, 0.1], tint: 'accent' }] },
  { id: 'shotgun', kick: 1.6, parts: [
    { shape: 'box', offset: [0, 0, 0], size: [0.06, 0.08, 0.3], tint: 'body', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.02, 0.27], size: [0.04, 0.3, 0.04], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, -0.025, 0.22], size: [0.045, 0.16, 0.045], rotation: [0, -90], tint: 'accent', role: 'pump' },
    { shape: 'box', offset: [0, -0.02, -0.2], size: [0.05, 0.08, 0.16], tint: 'dark' }] },
  { id: 'lmg', hold: [0.12, -0.12, 0.32], kick: 0.8, parts: [
    { shape: 'box', offset: [0, 0, 0.04], size: [0.07, 0.1, 0.38], tint: 'body', lod: 2 },
    { shape: 'box', offset: [0, -0.08, 0.06], size: [0.09, 0.08, 0.1], tint: 'accent', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.01, 0.34], size: [0.03, 0.26, 0.03], rotation: [0, -90], tint: 'dark' },
    { shape: 'box', offset: [0, -0.01, -0.2], size: [0.05, 0.08, 0.14], tint: 'dark' }] },
  { id: 'dmr', kick: 1.2, parts: [
    { shape: 'box', offset: [0, 0, 0.05], size: [0.05, 0.075, 0.36], tint: 'body', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.075, 0.06], size: [0.035, 0.16, 0.035], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.01, 0.33], size: [0.02, 0.24, 0.02], rotation: [0, -90], tint: 'dark' },
    { shape: 'box', offset: [0, -0.01, -0.18], size: [0.045, 0.07, 0.14], tint: 'dark' }] },
  { id: 'sniper', hold: [0.11, -0.11, 0.32], ads: [0, -0.13, 0.22], kick: 1.8, parts: [
    { shape: 'box', offset: [0, 0, 0.05], size: [0.05, 0.075, 0.4], tint: 'body', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.08, 0.06], size: [0.045, 0.24, 0.045], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.01, 0.4], size: [0.022, 0.36, 0.022], rotation: [0, -90], tint: 'dark' },
    { shape: 'box', offset: [0, -0.02, -0.2], size: [0.045, 0.09, 0.16], tint: 'accent' }] },
  { id: 'rail', kick: 1.5, glow: '#7dff8a', parts: [
    { shape: 'box', offset: [0, 0, 0.06], size: [0.06, 0.08, 0.4], tint: 'body', lod: 2 },
    { shape: 'ring', offset: [0, 0.005, 0.16], size: [0.09, 0.03, 0.09], rotation: [0, -90], tint: 'glow', lod: 2 },
    { shape: 'ring', offset: [0, 0.005, 0.26], size: [0.08, 0.03, 0.08], rotation: [0, -90], tint: 'glow' },
    { shape: 'box', offset: [0, 0.03, 0.3], size: [0.02, 0.02, 0.24], tint: 'glow' }] },
  { id: 'launcher', hold: [0.13, -0.11, 0.3], ads: [0.05, -0.12, 0.24], kick: 1.4, parts: [
    { shape: 'cylinder', offset: [0, 0.01, 0.12], size: [0.11, 0.5, 0.11], rotation: [0, -90], tint: 'body', lod: 2 },
    { shape: 'cone', offset: [0, 0.01, 0.4], size: [0.13, 0.08, 0.13], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'box', offset: [0, -0.09, 0.05], size: [0.04, 0.1, 0.05], tint: 'dark' },
    { shape: 'box', offset: [0.06, 0.04, 0.05], size: [0.03, 0.05, 0.08], tint: 'accent' }] },
  { id: 'energy', glow: '#6fd8ff', kick: 0.7, parts: [
    { shape: 'box', offset: [0, 0, 0.04], size: [0.065, 0.09, 0.3], tint: 'body', lod: 2 },
    { shape: 'sphere', offset: [0, 0.01, 0.22], size: [0.07, 0.07, 0.07], tint: 'glow', lod: 2 },
    { shape: 'ring', offset: [0, 0.01, 0.22], size: [0.1, 0.025, 0.1], rotation: [0, -90], tint: 'accent' },
    { shape: 'box', offset: [0, -0.08, 0.02], size: [0.035, 0.1, 0.05], tint: 'dark' }] },
  { id: 'heavy', hold: [0.13, -0.13, 0.32], ads: [0.08, -0.15, 0.28], kick: 0.9, parts: [
    { shape: 'box', offset: [0, 0, 0], size: [0.12, 0.14, 0.3], tint: 'body', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.02, 0.28], size: [0.09, 0.3, 0.09], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'ring', offset: [0, 0.02, 0.4], size: [0.1, 0.03, 0.1], rotation: [0, -90], tint: 'accent' },
    { shape: 'box', offset: [0, 0.1, 0], size: [0.04, 0.05, 0.16], tint: 'dark' }] },
  { id: 'melee', hold: [0.13, -0.12, 0.3], ads: [0.12, -0.16, 0.3], kick: 2, parts: [
    { shape: 'cylinder', offset: [0, -0.04, 0], size: [0.035, 0.12, 0.035], tint: 'dark', lod: 2 },
    { shape: 'box', offset: [0, 0.02, 0], size: [0.08, 0.02, 0.03], tint: 'accent', lod: 2 },
    { shape: 'wedge', offset: [0, 0.16, 0.01], size: [0.02, 0.3, 0.06], tint: 'body' }] },
  { id: 'tool', kick: 0.5, glow: '#ffd36a', parts: [
    { shape: 'box', offset: [0, 0, 0.02], size: [0.08, 0.1, 0.18], tint: 'body', lod: 2 },
    { shape: 'box', offset: [0, 0.035, 0.03], size: [0.06, 0.03, 0.12], tint: 'glow', lod: 2 },
    { shape: 'cylinder', offset: [0, -0.01, 0.15], size: [0.03, 0.1, 0.03], rotation: [0, -90], tint: 'dark' },
    { shape: 'box', offset: [0, -0.08, 0], size: [0.035, 0.08, 0.05], tint: 'dark' }] },
  { id: 'exotic', glow: '#ff7ad9', kick: 1, parts: [
    { shape: 'capsule', offset: [0, 0, 0.08], size: [0.08, 0.36, 0.08], rotation: [0, -90], tint: 'body', lod: 2 },
    { shape: 'ring', offset: [0, 0, 0.12], size: [0.12, 0.03, 0.12], rotation: [0, -90], tint: 'glow', lod: 2 },
    { shape: 'sphere', offset: [0, 0, 0.3], size: [0.05, 0.05, 0.05], tint: 'glow' },
    { shape: 'box', offset: [0, -0.08, -0.02], size: [0.035, 0.1, 0.05], tint: 'dark' }] },
  { id: 'power', hold: [0.12, -0.12, 0.32], kick: 1.4, glow: '#ff5d3a', parts: [
    { shape: 'box', offset: [0, 0, 0.04], size: [0.09, 0.11, 0.36], tint: 'body', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.02, 0.3], size: [0.06, 0.18, 0.06], rotation: [0, -90], tint: 'glow', lod: 2 },
    { shape: 'cone', offset: [0, 0.02, 0.42], size: [0.08, 0.06, 0.08], rotation: [0, -90], tint: 'dark' },
    { shape: 'box', offset: [0, -0.09, 0.02], size: [0.04, 0.1, 0.05], tint: 'dark' },
    { shape: 'box', offset: [0, 0.08, -0.04], size: [0.05, 0.04, 0.12], tint: 'accent' }] },
]);
