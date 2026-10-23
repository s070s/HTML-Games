// ==== S03 DATA: GEAR MODELS ====
// Built-in 3D models of the gear (07c-render-models.js Models; part format, tints and LODs there; MODEL_SCHEMA in 03b):
// items I01..I17 and powerups PU01..PU20 as world pickups (origin = the floating centre; 12a spins and bobs them), grenades
// G01..G09, G19, G20 (origin = the body's centre, also in the hand), placed and deployed devices G10..G18, G21..G24 (origin = the floor point under the device; the
// barrier panel matches its row size) and one ammo box per weapon ammo type (`ammo-<type>`, own colour: the I08 box shows
// the local player's held weapon's type). Row ids are the catalogue codes. `rune` is a shared base row (PU15..PU17).
// Flat emblems (bolt, wings, fangs) are built in the YZ plane: the pickup spin shows them from every side.
Data.define('gearModels', MODEL_SCHEMA, [
  // ---- Items ----
  { id: 'I01', parts: [
    { shape: 'cylinder', size: [0.13, 0.2, 0.13], tint: 'glow', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.12, 0], size: [0.07, 0.06, 0.07], tint: 'white' },
    { shape: 'cylinder', offset: [0, 0.16, 0], size: [0.09, 0.03, 0.09], tint: 'red', lod: 0 }] },
  { id: 'I02', parts: [
    { size: [0.46, 0.3, 0.3], tint: 'white', lod: 2 },
    { offset: [0, 0, 0.155], size: [0.24, 0.07, 0.02] }, { offset: [0, 0, 0.155], size: [0.07, 0.22, 0.02] },
    { offset: [0, 0, -0.155], size: [0.24, 0.07, 0.02], lod: 0 }, { offset: [0, 0, -0.155], size: [0.07, 0.22, 0.02], lod: 0 },
    { offset: [0, 0.17, 0], size: [0.18, 0.04, 0.04], tint: 'dark', lod: 0 }] },
  { id: 'I03', from: 'I02', scale: 1.45, parts: [{ size: [0.68, 0.06, 0.45], tint: 'shade' }] },
  { id: 'I04', parts: [
    { shape: 'sphere', size: [0.46, 0.46, 0.46], tint: 'glow', lod: 2 },
    { shape: 'ring', size: [0.72, 0.08, 0.72], tint: 'metal' },
    { shape: 'ring', size: [0.72, 0.08, 0.72], rotation: [0, 90], tint: 'metal' },
    { offset: [0, 0, 0.235], size: [0.14, 0.04, 0.01], tint: 'white', lod: 0 }, { offset: [0, 0, 0.235], size: [0.04, 0.14, 0.01], tint: 'white', lod: 0 }] },
  { id: 'I05', parts: [
    { shape: 'cone', offset: [0, 0.08, 0], size: [0.16, 0.16, 0.16], tint: 'glow', lod: 2 },
    { shape: 'cone', offset: [0, -0.08, 0], size: [0.16, 0.16, 0.16], rotation: [0, 180], tint: 'shade' },
    { shape: 'ring', size: [0.22, 0.03, 0.22], tint: 'white', lod: 0 }] },
  { id: 'I06', parts: [
    { size: [0.42, 0.44, 0.1], lod: 2 },
    { offset: [-0.15, 0.25, 0], size: [0.12, 0.08, 0.14], tint: 'shade' }, { offset: [0.15, 0.25, 0], size: [0.12, 0.08, 0.14], tint: 'shade' },
    { offset: [0, -0.06, 0.06], size: [0.26, 0.2, 0.04], tint: 'shade', lod: 0 }] },
  { id: 'I07', from: 'I06', scale: 1.3, parts: [
    { shape: 'sphere', offset: [-0.3, 0.3, 0], size: [0.2, 0.16, 0.22], tint: 'metal' }, { shape: 'sphere', offset: [0.3, 0.3, 0], size: [0.2, 0.16, 0.22], tint: 'metal' }] },
  { id: 'I08', parts: [
    { size: [0.4, 0.26, 0.26], lod: 2 },
    { offset: [0, 0, 0.135], size: [0.4, 0.06, 0.01], tint: 'white', lod: 0 },
    { shape: 'cylinder', offset: [-0.08, 0.18, 0], size: [0.05, 0.1, 0.05], tint: 'brass' }, { shape: 'cylinder', offset: [0.08, 0.18, 0], size: [0.05, 0.1, 0.05], tint: 'brass' },
    { shape: 'cone', offset: [-0.08, 0.25, 0], size: [0.05, 0.05, 0.05], tint: 'brass', lod: 0 }, { shape: 'cone', offset: [0.08, 0.25, 0], size: [0.05, 0.05, 0.05], tint: 'brass', lod: 0 }] },
  { id: 'I09', parts: [
    { size: [0.7, 0.42, 0.44], tint: 'wood', lod: 2 },
    { offset: [0, 0.22, 0], size: [0.74, 0.04, 0.48], tint: 'shade' },
    { offset: [0, 0, 0.225], size: [0.5, 0.1, 0.01], tint: 'brass', lod: 0 },
    { shape: 'cylinder', offset: [0.22, 0.3, 0], size: [0.06, 0.12, 0.06], tint: 'brass' },
    { shape: 'cylinder', offset: [0, 0.3, 0], size: [0.08, 0.12, 0.08], tint: 'red' },
    { shape: 'cone', offset: [-0.22, 0.32, 0], size: [0.1, 0.16, 0.1], tint: 'metal' }] },
  { id: 'I10', parts: [
    { shape: 'ring', size: [1.2, 0.08, 1.2], tint: 'glow', lod: 2 },
    { shape: 'cylinder', offset: [0, -0.02, 0], size: [1, 0.04, 1], tint: 'dark' },
    { shape: 'cone', offset: [0, 0.12, 0], size: [0.2, 0.2, 0.2], lod: 0 }] },
  { id: 'I11', parts: [
    { shape: 'sphere', offset: [0, 0.02, 0], size: [0.38, 0.36, 0.42], lod: 2 },
    { shape: 'cylinder', offset: [0, -0.08, 0], size: [0.44, 0.16, 0.48], tint: 'shade' },
    { offset: [0, -0.02, 0.2], size: [0.26, 0.08, 0.06], tint: 'cyan', lod: 0 }] },
  { id: 'I12', parts: [
    { size: [0.44, 0.5, 0.22], lod: 2 },
    { offset: [-0.13, 0.29, 0], size: [0.1, 0.08, 0.22], tint: 'shade' }, { offset: [0.13, 0.29, 0], size: [0.1, 0.08, 0.22], tint: 'shade' },
    { offset: [0.12, -0.1, 0.13], size: [0.12, 0.14, 0.06], tint: 'shade', lod: 0 }, { offset: [-0.12, -0.1, 0.13], size: [0.12, 0.14, 0.06], tint: 'shade', lod: 0 },
    { offset: [0, -0.1, 0.13], size: [0.08, 0.14, 0.06], tint: 'dark', lod: 0 }] },
  { id: 'I13', parts: [
    { size: [0.28, 0.04, 0.1], lod: 2 }, { size: [0.1, 0.04, 0.28] },
    { offset: [0, 0.025, 0], size: [0.1, 0.02, 0.1], tint: 'red' }] },
  { id: 'I14', from: 'I02', recolor: { white: 'body', body: 'white' } },
  { id: 'I15', parts: [
    { shape: 'cylinder', size: [0.12, 0.2, 0.12], tint: 'glow', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.11, 0], size: [0.13, 0.03, 0.13], tint: 'metal' },
    { shape: 'cylinder', offset: [0, -0.11, 0], size: [0.13, 0.03, 0.13], tint: 'metal' }] },
  { id: 'I16', parts: [
    { size: [0.24, 0.32, 0.16], tint: 'shade', lod: 2 },
    { offset: [0, 0, 0.081], size: [0.16, 0.22, 0.01], tint: 'glow' }, { offset: [0, 0, -0.081], size: [0.16, 0.22, 0.01], tint: 'glow', lod: 0 },
    { offset: [0, 0.18, 0], size: [0.1, 0.04, 0.08], tint: 'metal' }] },
  { id: 'I17', parts: [
    { shape: 'cylinder', size: [0.13, 0.24, 0.13], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.125, 0], size: [0.11, 0.01, 0.11], tint: 'metal' },
    { shape: 'cylinder', offset: [0, 0.02, 0], size: [0.135, 0.06, 0.135], tint: 'white', lod: 0 },
    { offset: [0, 0.135, 0.02], size: [0.03, 0.01, 0.05], tint: 'metal', lod: 0 }] },
  // ---- Ammo boxes by ammo type (own colours) ----
  { id: 'ammo-light', color: 0xc8a86a, parts: [
    { size: [0.3, 0.16, 0.2], lod: 2 },
    { shape: 'cylinder', offset: [-0.08, 0.12, 0], size: [0.04, 0.08, 0.04], tint: 'brass' }, { shape: 'cylinder', offset: [0, 0.12, 0], size: [0.04, 0.08, 0.04], tint: 'brass' },
    { shape: 'cylinder', offset: [0.08, 0.12, 0], size: [0.04, 0.08, 0.04], tint: 'brass', lod: 0 }] },
  { id: 'ammo-heavy', color: 0x4f5e3a, parts: [
    { size: [0.4, 0.26, 0.18], lod: 2 },
    { offset: [0, 0.14, 0], size: [0.42, 0.03, 0.2], tint: 'shade' },
    { offset: [0, 0.18, 0], size: [0.16, 0.03, 0.04], tint: 'dark' },
    { offset: [0, 0, 0.091], size: [0.24, 0.05, 0.01], tint: 'brass', lod: 0 }] },
  { id: 'ammo-shells', color: 0xc0302a, parts: [
    { size: [0.32, 0.08, 0.14], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [-0.09, 0.1, 0], size: [0.08, 0.2, 0.08] }, { shape: 'cylinder', offset: [0, 0.1, 0], size: [0.08, 0.2, 0.08] },
    { shape: 'cylinder', offset: [0.09, 0.1, 0], size: [0.08, 0.2, 0.08] },
    { offset: [0, 0.055, 0], size: [0.3, 0.03, 0.1], tint: 'brass', lod: 0 }] },
  { id: 'ammo-cells', color: 0x3fa7c9, parts: [
    { size: [0.28, 0.2, 0.16], tint: 'shade', lod: 2 },
    { size: [0.29, 0.06, 0.17], tint: 'glow' },
    { shape: 'cylinder', offset: [-0.07, 0.12, 0], size: [0.05, 0.04, 0.05], tint: 'metal', lod: 0 }, { shape: 'cylinder', offset: [0.07, 0.12, 0], size: [0.05, 0.04, 0.05], tint: 'metal', lod: 0 }] },
  { id: 'ammo-rockets', color: 0x7a8a5a, parts: [
    { shape: 'cylinder', size: [0.12, 0.44, 0.12], rotation: [0, -90], lod: 2 },
    { shape: 'cone', offset: [0, 0, 0.3], size: [0.12, 0.16, 0.12], rotation: [0, -90], tint: 'red' },
    { offset: [0, 0, -0.2], size: [0.26, 0.02, 0.1], tint: 'dark' }, { offset: [0, 0, -0.2], size: [0.02, 0.26, 0.1], tint: 'dark' }] },
  { id: 'ammo-special', color: 0x8d5bb0, parts: [
    { shape: 'cylinder', size: [0.16, 0.28, 0.16], tint: 'metal', lod: 2 },
    { shape: 'cylinder', size: [0.17, 0.14, 0.17], tint: 'glow' },
    { shape: 'cylinder', offset: [0, 0.16, 0], size: [0.1, 0.04, 0.1], tint: 'dark', lod: 0 }] },
  // ---- Powerups ----
  { id: 'PU01', parts: [
    { shape: 'sphere', size: [0.4, 0.4, 0.4], tint: 'glow', lod: 2 },
    { shape: 'cone', offset: [0, 0.27, 0], size: [0.14, 0.2, 0.14], tint: 'shade' },
    { shape: 'cone', offset: [0, -0.27, 0], size: [0.14, 0.2, 0.14], rotation: [0, 180], tint: 'shade' },
    { shape: 'cone', offset: [0, 0, 0.27], size: [0.14, 0.2, 0.14], rotation: [0, -90], tint: 'shade' },
    { shape: 'cone', offset: [0, 0, -0.27], size: [0.14, 0.2, 0.14], rotation: [0, 90], tint: 'shade' },
    { shape: 'cone', offset: [-0.27, 0, 0], size: [0.14, 0.2, 0.14], rotation: [-90, -90], tint: 'shade', lod: 0 },
    { shape: 'cone', offset: [0.27, 0, 0], size: [0.14, 0.2, 0.14], rotation: [90, -90], tint: 'shade', lod: 0 }] },
  { id: 'PU02', parts: [
    { size: [0.08, 0.36, 0.44], lod: 2 },
    { shape: 'cone', offset: [0, -0.3, 0], size: [0.08, 0.24, 0.44], rotation: [0, 180] },
    { shape: 'sphere', offset: [0, 0, 0], size: [0.12, 0.14, 0.14], tint: 'brass' },
    { size: [0.1, 0.38, 0.06], tint: 'shade', lod: 0 }] },
  { id: 'PU03', parts: [
    { offset: [0, 0.17, 0.08], size: [0.08, 0.3, 0.12], rotation: [0, -45], tint: 'glow', lod: 2 },
    { offset: [0, 0.02, 0], size: [0.08, 0.1, 0.34], tint: 'glow', lod: 2 },
    { offset: [0, -0.13, -0.08], size: [0.08, 0.26, 0.12], rotation: [0, -45], tint: 'glow' },
    { shape: 'cone', offset: [0, -0.3, -0.2], size: [0.08, 0.18, 0.14], rotation: [0, 135], tint: 'glow', lod: 0 }] },
  { id: 'PU04', parts: [
    { shape: 'cone', offset: [0, -0.12, 0], size: [0.42, 0.42, 0.42], lod: 2 },
    { shape: 'sphere', offset: [0, 0.12, 0], size: [0.32, 0.32, 0.32] },
    { shape: 'sphere', offset: [-0.06, 0.15, 0.14], size: [0.06, 0.08, 0.04], tint: 'black', lod: 0 },
    { shape: 'sphere', offset: [0.06, 0.15, 0.14], size: [0.06, 0.08, 0.04], tint: 'black', lod: 0 }] },
  { id: 'PU05', parts: [
    { shape: 'sphere', offset: [0, 0.06, 0.1], size: [0.18, 0.24, 0.24], tint: 'glow', lod: 2 },
    { shape: 'sphere', offset: [0, 0.06, -0.1], size: [0.18, 0.24, 0.24], tint: 'glow', lod: 2 },
    { shape: 'cone', offset: [0, -0.12, 0], size: [0.16, 0.26, 0.38], rotation: [0, 180], tint: 'glow' }] },
  { id: 'PU06', parts: [
    { shape: 'sphere', size: [0.18, 0.18, 0.18], tint: 'glow', lod: 2 },
    { offset: [0, 0.08, 0.2], size: [0.04, 0.16, 0.34], rotation: [0, -25] },
    { offset: [0, 0.08, -0.2], size: [0.04, 0.16, 0.34], rotation: [0, 25] },
    { offset: [0, -0.02, 0.18], size: [0.04, 0.08, 0.24], rotation: [0, -10], tint: 'shade', lod: 0 },
    { offset: [0, -0.02, -0.18], size: [0.04, 0.08, 0.24], rotation: [0, 10], tint: 'shade', lod: 0 }] },
  { id: 'PU07', parts: [
    { shape: 'sphere', size: [0.38, 0.38, 0.38], tint: 'glow', lod: 2 },
    { shape: 'ring', size: [0.66, 0.06, 0.66], rotation: [0, 20], tint: 'white' },
    { shape: 'sphere', offset: [-0.3, 0.06, 0], size: [0.1, 0.1, 0.1], tint: 'white', lod: 0 },
    { shape: 'sphere', offset: [0.3, -0.06, 0], size: [0.1, 0.1, 0.1], tint: 'white', lod: 0 }] },
  { id: 'PU08', parts: [
    { shape: 'ring', size: [0.6, 0.14, 0.6], lod: 2 },
    { offset: [0, 0, 0.27], size: [0.16, 0.14, 0.06], tint: 'brass' },
    { offset: [0, 0, 0.3], size: [0.06, 0.06, 0.02], tint: 'light', lod: 0 }] },
  { id: 'PU09', parts: [
    { size: [0.28, 0.24, 0.22], lod: 2 },
    { shape: 'cylinder', offset: [0, -0.18, 0], size: [0.2, 0.14, 0.18], tint: 'dark' },
    { shape: 'sphere', offset: [-0.09, 0.08, 0.12], size: [0.09, 0.09, 0.09], tint: 'shade' }, { shape: 'sphere', offset: [-0.03, 0.08, 0.12], size: [0.09, 0.09, 0.09], tint: 'shade' },
    { shape: 'sphere', offset: [0.03, 0.08, 0.12], size: [0.09, 0.09, 0.09], tint: 'shade', lod: 0 }, { shape: 'sphere', offset: [0.09, 0.08, 0.12], size: [0.09, 0.09, 0.09], tint: 'shade', lod: 0 },
    { offset: [-0.16, 0, 0.04], size: [0.06, 0.16, 0.08], tint: 'shade', lod: 0 }] },
  { id: 'PU10', parts: [
    { shape: 'cone', offset: [0, 0.12, 0], size: [0.26, 0.24, 0.26], tint: 'glow', lod: 2 },
    { shape: 'cone', offset: [0, -0.12, 0], size: [0.26, 0.24, 0.26], rotation: [0, 180], tint: 'glow', lod: 2 },
    { shape: 'ring', size: [0.6, 0.06, 0.6], rotation: [0, 90], tint: 'brass' },
    { shape: 'ring', offset: [0, 0.32, 0], size: [0.3, 0.04, 0.3], tint: 'light', lod: 0 }] },
  { id: 'PU11', parts: [
    { shape: 'cylinder', offset: [0, -0.04, 0], size: [0.12, 0.26, 0.12], tint: 'brass', lod: 2 },
    { shape: 'cone', offset: [0, 0.16, 0], size: [0.12, 0.14, 0.12], tint: 'glow' },
    { shape: 'ring', offset: [0, -0.04, 0], size: [0.5, 0.05, 0.5], rotation: [0, 90], lod: 0 }] },
  { id: 'PU12', parts: [
    { offset: [0, 0.1, 0], size: [0.1, 0.1, 0.4], lod: 2 },
    { shape: 'cone', offset: [0, -0.1, 0.12], size: [0.12, 0.3, 0.12], rotation: [0, 180], tint: 'white', lod: 2 },
    { shape: 'cone', offset: [0, -0.1, -0.12], size: [0.12, 0.3, 0.12], rotation: [0, 180], tint: 'white', lod: 2 }] },
  { id: 'PU13', parts: [
    { shape: 'sphere', size: [0.38, 0.38, 0.38], tint: 'white', lod: 2 },
    { shape: 'sphere', offset: [0, 0, 0.15], size: [0.2, 0.2, 0.1], tint: 'glow' },
    { shape: 'sphere', offset: [0, 0, 0.19], size: [0.08, 0.08, 0.04], tint: 'black', lod: 0 }] },
  { id: 'PU14', parts: [
    { offset: [0, 0.1, -0.04], size: [0.16, 0.26, 0.18], lod: 2 },
    { offset: [0, -0.04, 0.06], size: [0.16, 0.1, 0.36], lod: 2 },
    { shape: 'ring', offset: [0, -0.13, 0.04], size: [0.18, 0.06, 0.18], tint: 'metal' },
    { shape: 'ring', offset: [0, -0.19, 0.04], size: [0.18, 0.06, 0.18], tint: 'metal' },
    { offset: [0, 0.22, -0.04], size: [0.18, 0.04, 0.2], tint: 'shade', lod: 0 }] },
  { id: 'rune', parts: [
    { size: [0.3, 0.5, 0.12], tint: 'shade', lod: 2 },
    { shape: 'cone', offset: [0, 0.31, 0], size: [0.3, 0.12, 0.12], tint: 'shade' }] },
  { id: 'PU15', from: 'rune', parts: [
    { offset: [0, 0.04, 0.065], size: [0.16, 0.2, 0.02], tint: 'glow' }, { shape: 'cone', offset: [0, -0.1, 0.065], size: [0.16, 0.1, 0.02], rotation: [0, 180], tint: 'glow' }] },
  { id: 'PU16', from: 'rune', parts: [
    { shape: 'cone', offset: [0, 0.08, 0.065], size: [0.18, 0.14, 0.02], tint: 'glow' }, { offset: [0, -0.06, 0.065], size: [0.05, 0.18, 0.02], tint: 'glow' }] },
  { id: 'PU17', from: 'rune', parts: [
    { shape: 'cylinder', offset: [0, -0.04, 0.07], size: [0.07, 0.18, 0.03], tint: 'glow' }, { shape: 'cone', offset: [0, 0.1, 0.07], size: [0.07, 0.1, 0.03], tint: 'glow' }] },
  { id: 'PU18', parts: [
    { shape: 'sphere', size: [0.2, 0.2, 0.2], tint: 'glow', lod: 2 },
    { shape: 'cone', offset: [0, 0.16, 0], size: [0.14, 0.2, 0.14], tint: 'glow' },
    { shape: 'ring', offset: [0, -0.02, 0], size: [0.3, 0.03, 0.3], tint: 'glow', lod: 0 }] },
  { id: 'PU19', parts: [
    { shape: 'cylinder', offset: [0, -0.16, 0], size: [0.07, 0.3, 0.07], tint: 'wood', lod: 2 },
    { shape: 'cone', offset: [0, 0.02, 0], size: [0.18, 0.1, 0.18], rotation: [0, 180], tint: 'brass' },
    { shape: 'cone', offset: [0, 0.18, 0], size: [0.18, 0.26, 0.18], tint: 'glow', lod: 2 },
    { shape: 'cone', offset: [0, 0.16, 0], size: [0.1, 0.34, 0.1], tint: 'light', lod: 0 }] },
  { id: 'PU20', parts: [
    { shape: 'cone', offset: [0, 0.04, 0], size: [0.16, 0.44, 0.16], tint: 'glow', lod: 2 },
    { shape: 'cone', offset: [0, -0.04, 0.13], size: [0.12, 0.3, 0.12], rotation: [0, -40], tint: 'glow' },
    { shape: 'cone', offset: [0, -0.04, -0.13], size: [0.12, 0.3, 0.12], rotation: [0, 40], tint: 'glow' },
    { shape: 'cylinder', offset: [0, -0.18, 0], size: [0.3, 0.06, 0.3], tint: 'dark', lod: 0 }] },
  // ---- Grenades (thrown; origin = the body's centre) ----
  { id: 'G01', parts: [
    { shape: 'sphere', size: [0.2, 0.22, 0.2], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.12, 0], size: [0.07, 0.06, 0.07], tint: 'metal' },
    { offset: [-0.05, 0.06, 0], size: [0.03, 0.14, 0.05], rotation: [0, 0], tint: 'metal' },
    { shape: 'ring', offset: [0.05, 0.14, 0], size: [0.06, 0.06, 0.06], rotation: [0, 90], tint: 'brass', lod: 0 },
    { shape: 'cylinder', size: [0.205, 0.03, 0.205], tint: 'shade', lod: 0 }] },
  { id: 'G02', parts: [
    { shape: 'cylinder', size: [0.14, 0.26, 0.14], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.14, 0], size: [0.1, 0.03, 0.1], tint: 'dark' },
    { shape: 'cylinder', offset: [0, 0.05, 0], size: [0.145, 0.04, 0.145], tint: 'white', lod: 0 },
    { offset: [-0.06, 0.08, 0], size: [0.02, 0.12, 0.04], tint: 'metal', lod: 0 }] },
  { id: 'G03', parts: [
    { shape: 'cylinder', size: [0.12, 0.24, 0.12], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.07, 0], size: [0.125, 0.03, 0.125], tint: 'dark' },
    { shape: 'cylinder', offset: [0, -0.07, 0], size: [0.125, 0.03, 0.125], tint: 'dark' },
    { shape: 'cylinder', offset: [0, 0.13, 0], size: [0.06, 0.04, 0.06], tint: 'cyan', lod: 0 }] },
  { id: 'G04', parts: [
    { shape: 'sphere', offset: [0, -0.03, 0], size: [0.17, 0.18, 0.17], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.09, 0], size: [0.06, 0.1, 0.06], tint: 'shade' },
    { shape: 'cone', offset: [0, 0.17, 0], size: [0.07, 0.1, 0.07], tint: 'flame' }] },
  { id: 'G05', parts: [
    { shape: 'cylinder', size: [0.12, 0.2, 0.12], lod: 2 },
    { shape: 'cylinder', offset: [0, 0, 0.061], size: [0.08, 0.08, 0.01], rotation: [0, -90], tint: 'dark' },
    { shape: 'cylinder', offset: [-0.03, 0.17, 0], size: [0.01, 0.14, 0.01], tint: 'metal', lod: 0 },
    { shape: 'sphere', offset: [-0.03, 0.24, 0], size: [0.025, 0.025, 0.025], tint: 'lamp', lod: 0 }] },
  { id: 'G06', parts: [
    { shape: 'sphere', offset: [0, 0.02, 0], size: [0.2, 0.14, 0.2], lod: 2 },
    { shape: 'cylinder', offset: [0, -0.04, 0], size: [0.22, 0.04, 0.22], tint: 'dark' },
    { shape: 'sphere', offset: [0, 0.09, 0], size: [0.05, 0.04, 0.05], tint: 'lamp', lod: 0 }] },
  { id: 'G07', parts: [
    { shape: 'cylinder', size: [0.2, 0.1, 0.2], tint: 'shade', lod: 2 },
    { shape: 'ring', size: [0.22, 0.06, 0.22], tint: 'glow' },
    { shape: 'sphere', offset: [0, 0.05, 0], size: [0.1, 0.06, 0.1], tint: 'glow', lod: 0 }] },
  { id: 'G08', parts: [
    { shape: 'sphere', size: [0.18, 0.18, 0.18], lod: 2 },
    { shape: 'cone', offset: [0, 0.12, 0], size: [0.07, 0.1, 0.07], tint: 'white' },
    { shape: 'cone', offset: [0, -0.06, 0.1], size: [0.07, 0.1, 0.07], rotation: [0, -120], tint: 'white' },
    { shape: 'cone', offset: [-0.09, -0.06, -0.05], size: [0.07, 0.1, 0.07], rotation: [-120, -120], tint: 'white', lod: 0 },
    { shape: 'cone', offset: [0.09, -0.06, -0.05], size: [0.07, 0.1, 0.07], rotation: [120, -120], tint: 'white', lod: 0 }] },
  { id: 'G09', parts: [
    { shape: 'sphere', size: [0.18, 0.18, 0.18], tint: 'black', lod: 2 },
    { shape: 'ring', size: [0.34, 0.05, 0.34], rotation: [0, 15], tint: 'glow' },
    { shape: 'ring', size: [0.24, 0.04, 0.24], rotation: [0, -30], tint: 'glow', lod: 0 }] },
  { id: 'G19', parts: [
    { shape: 'cylinder', size: [0.03, 0.22, 0.03], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'cone', offset: [0, 0, 0.15], size: [0.05, 0.1, 0.05], rotation: [0, -90] },
    { offset: [0, 0, -0.1], size: [0.1, 0.01, 0.06] }, { offset: [0, 0, -0.1], size: [0.01, 0.1, 0.06] },
    { shape: 'sphere', offset: [0, 0, 0.05], size: [0.04, 0.04, 0.04], tint: 'lamp', lod: 0 }] },
  { id: 'G20', parts: [
    { shape: 'sphere', size: [0.2, 0.2, 0.2], tint: 'shade', lod: 2 },
    { shape: 'ring', offset: [0, 0.04, 0], size: [0.24, 0.04, 0.24], tint: 'glow' },
    { shape: 'ring', offset: [0, -0.04, 0], size: [0.24, 0.04, 0.24], tint: 'glow' },
    { shape: 'cylinder', offset: [0, 0.14, 0], size: [0.015, 0.1, 0.015], tint: 'metal', lod: 0 }] },
  // ---- Placed and deployed devices (origin = the floor point) ----
  { id: 'G10', parts: [
    { offset: [0, 0.13, 0], size: [0.3, 0.16, 0.07], lod: 2 },
    { offset: [-0.1, 0.03, 0], size: [0.02, 0.08, 0.02], rotation: [0, 20], tint: 'dark' },
    { offset: [0.1, 0.03, 0], size: [0.02, 0.08, 0.02], rotation: [0, 20], tint: 'dark' },
    { offset: [0, 0.13, 0.036], size: [0.24, 0.1, 0.01], tint: 'shade', lod: 0 },
    { shape: 'sphere', offset: [0, 0.23, 0], size: [0.03, 0.03, 0.03], tint: 'lamp', lod: 0 }] },
  { id: 'G11', parts: [
    { shape: 'cylinder', offset: [0, 0.03, 0], size: [0.22, 0.06, 0.22], tint: 'dark', lod: 2 },
    { shape: 'sphere', offset: [0, 0.07, 0], size: [0.16, 0.1, 0.16], lod: 2 },
    { shape: 'cone', offset: [0, 0.14, 0], size: [0.03, 0.05, 0.03], tint: 'metal' },
    { shape: 'cone', offset: [-0.07, 0.11, 0], size: [0.03, 0.05, 0.03], rotation: [-90, -50], tint: 'metal', lod: 0 },
    { shape: 'cone', offset: [0.07, 0.11, 0], size: [0.03, 0.05, 0.03], rotation: [90, -50], tint: 'metal', lod: 0 },
    { shape: 'cone', offset: [0, 0.11, 0.07], size: [0.03, 0.05, 0.03], rotation: [0, -50], tint: 'metal', lod: 0 },
    { shape: 'cone', offset: [0, 0.11, -0.07], size: [0.03, 0.05, 0.03], rotation: [0, 50], tint: 'metal', lod: 0 },
    { shape: 'sphere', offset: [-0.05, 0.1, 0.05], size: [0.03, 0.03, 0.03], tint: 'lamp', lod: 0 }] },
  { id: 'G12', parts: [
    { shape: 'cylinder', offset: [0, 0.05, 0], size: [0.3, 0.1, 0.3], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.15, 0], size: [0.12, 0.12, 0.12], tint: 'metal' },
    { shape: 'sphere', offset: [0, 0.24, 0], size: [0.2, 0.16, 0.2], tint: 'glow', lod: 2 }] },
  { id: 'G13', parts: [
    { offset: [0, 0.62, 0], size: [1.9, 1.08, 0.22], lod: 2 },
    { offset: [-0.97, 0.6, 0], size: [0.1, 1.2, 0.3], tint: 'metal' }, { offset: [0.97, 0.6, 0], size: [0.1, 1.2, 0.3], tint: 'metal' },
    { offset: [0, 1.17, 0], size: [1.9, 0.06, 0.26], tint: 'metal' },
    { offset: [0, 0.04, 0], size: [1.9, 0.08, 0.3], tint: 'dark', lod: 0 },
    { offset: [0, 0.62, 0.115], size: [1.6, 0.08, 0.01], tint: 'light', lod: 0 }] },
  { id: 'G14', parts: [
    { shape: 'cylinder', offset: [0, 0.04, 0], size: [1.8, 0.08, 1.8], tint: 'dark', lod: 2 },
    { shape: 'ring', offset: [0, 0.09, 0], size: [1.5, 0.06, 1.5], tint: 'glow', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.085, 0], size: [0.9, 0.02, 0.9], tint: 'shade' },
    { shape: 'cone', offset: [0, 0.2, 0], size: [0.4, 0.18, 0.4], tint: 'glow', lod: 0 }] },
  { id: 'G15', parts: [
    { offset: [0, 0.62, 0], size: [0.32, 0.22, 0.36], lod: 2 },
    { shape: 'cylinder', offset: [0, 0.64, 0.34], size: [0.06, 0.36, 0.06], rotation: [0, -90], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.3, 0], size: [0.06, 0.5, 0.06], tint: 'dark', lod: 2 },
    { offset: [-0.12, 0.15, 0.08], size: [0.04, 0.34, 0.04], rotation: [-45, 35], tint: 'dark' },
    { offset: [0.12, 0.15, 0.08], size: [0.04, 0.34, 0.04], rotation: [45, 35], tint: 'dark' },
    { offset: [0, 0.15, -0.14], size: [0.04, 0.34, 0.04], rotation: [0, -35], tint: 'dark' },
    { offset: [-0.2, 0.6, -0.04], size: [0.08, 0.14, 0.18], tint: 'shade', lod: 0 },
    { offset: [0, 0.66, 0.185], size: [0.12, 0.05, 0.01], tint: 'lamp', lod: 0 }] },
  { id: 'G16', parts: [
    { shape: 'cylinder', offset: [0, 0.04, 0], size: [0.3, 0.08, 0.3], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.16, 0], size: [0.08, 0.18, 0.08], tint: 'metal' },
    { offset: [0, 0.34, 0], size: [0.22, 0.07, 0.07], tint: 'glow', lod: 2 }, { offset: [0, 0.34, 0], size: [0.07, 0.22, 0.07], tint: 'glow', lod: 2 }] },
  { id: 'G17', parts: [
    { shape: 'cylinder', offset: [0, 0.04, 0], size: [0.3, 0.08, 0.3], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.14, 0], size: [0.08, 0.14, 0.08], tint: 'metal' },
    { shape: 'cone', offset: [0, 0.3, 0], size: [0.3, 0.22, 0.3], rotation: [0, 180], tint: 'glow', lod: 2 },
    { shape: 'ring', offset: [0, 0.42, 0], size: [0.34, 0.04, 0.34], tint: 'shade', lod: 0 }] },
  { id: 'G18', parts: [
    { offset: [0, 0.06, 0], size: [0.26, 0.12, 0.26], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.34, 0], size: [0.03, 0.5, 0.03], tint: 'metal', lod: 2 },
    { offset: [0, 0.38, 0], size: [0.24, 0.025, 0.025] }, { offset: [0, 0.48, 0], size: [0.025, 0.025, 0.18] },
    { shape: 'sphere', offset: [0, 0.6, 0], size: [0.06, 0.06, 0.06], tint: 'glow', lod: 0 }] },
  { id: 'G21', parts: [
    { shape: 'sphere', offset: [0, 0.12, 0], size: [0.26, 0.14, 0.3], lod: 2 },
    { offset: [-0.13, 0.06, 0.08], size: [0.03, 0.12, 0.03], rotation: [-60, 40], tint: 'dark' },
    { offset: [0.13, 0.06, 0.08], size: [0.03, 0.12, 0.03], rotation: [60, 40], tint: 'dark' },
    { offset: [-0.13, 0.06, -0.08], size: [0.03, 0.12, 0.03], rotation: [-120, 40], tint: 'dark' },
    { offset: [0.13, 0.06, -0.08], size: [0.03, 0.12, 0.03], rotation: [120, 40], tint: 'dark' },
    { shape: 'sphere', offset: [0, 0.15, 0.14], size: [0.06, 0.04, 0.04], tint: 'lamp', lod: 0 }] },
  { id: 'G22', parts: [
    { shape: 'cylinder', offset: [0, 0.05, 0], size: [0.28, 0.1, 0.28], tint: 'dark', lod: 2 },
    { shape: 'cylinder', offset: [0, 0.24, 0], size: [0.07, 0.3, 0.07], tint: 'metal', lod: 2 },
    { shape: 'cone', offset: [0, 0.44, 0.02], size: [0.28, 0.1, 0.28], rotation: [0, 160] },
    { shape: 'sphere', offset: [0, 0.42, 0.04], size: [0.06, 0.06, 0.06], tint: 'cyan', lod: 0 }] },
  { id: 'G23', parts: [
    { offset: [0, 0.18, 0], size: [0.6, 0.36, 0.4], lod: 2 },
    { offset: [0, 0.38, 0], size: [0.62, 0.04, 0.42], tint: 'shade' },
    { offset: [0, 0.18, 0.201], size: [0.08, 0.24, 0.01], tint: 'white', lod: 0 }, { offset: [0, 0.18, 0.201], size: [0.24, 0.08, 0.01], tint: 'white', lod: 0 },
    { offset: [-0.31, 0.24, 0], size: [0.02, 0.04, 0.16], tint: 'dark', lod: 0 }, { offset: [0.31, 0.24, 0], size: [0.02, 0.04, 0.16], tint: 'dark', lod: 0 },
    { shape: 'cylinder', offset: [-0.12, 0.44, 0], size: [0.05, 0.1, 0.05], tint: 'brass' }, { shape: 'cylinder', offset: [0.12, 0.44, 0], size: [0.05, 0.1, 0.05], tint: 'brass' }] },
  { id: 'G24', parts: [
    { shape: 'cylinder', offset: [0, 0.48, 0], size: [0.04, 0.9, 0.04], tint: 'metal', lod: 2 },
    { shape: 'sphere', offset: [0, 0.94, 0], size: [0.14, 0.14, 0.14], tint: 'glow', lod: 2 },
    { offset: [0, 0.74, 0.12], size: [0.02, 0.18, 0.22], lod: 2 },
    { shape: 'cone', offset: [0, 0.08, 0], size: [0.3, 0.16, 0.3], tint: 'dark' },
    { shape: 'ring', offset: [0, 0.94, 0], size: [0.24, 0.03, 0.24], tint: 'light', lod: 0 }] },
]);
