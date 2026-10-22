// ==== S03 DATA: BODY MODELS (players and bots) ====
// One row per look: the default body, each hero H01..H08, each ECP04 preset class and the rulesets that dress everyone
// alike (RS03, RS08, RS11). A row starts from `base` (another row, earlier in the list) or the actorParts body (03b),
// drops base parts by id, changes base parts by id (`change: { partId: { field: value } }`) and adds its own `parts` in
// the actorParts format; 07c ActorModels resolves every row once at load. Torso and arms keep the team tint, so teams
// (and the colour-blind palettes) stay readable; the row colour (tints model, modelDark, modelGlow) dresses helmets,
// pads and packs. The far LOD keeps the 6 base far parts (REN-002), so rows change those for a far silhouette and add
// only near parts; `detail` parts are skipped on Potato. PvE enemies have their own parts (14h). Picked on spawn by S13.

// Body regions: the pivot and pose fields an added part shares with the base part it sits on (03b pivots), so a row
// lists only shape, offset, size and tint. Left side regions; bodyPair mirrors them to the right.
const BODY_REGIONS = {
  head: { pivot: [0, 1.62, 0], aim: 1, head: true },
  chest: { pivot: [0, 1.16, 0], aim: 0.25 },
  hips: { pivot: [0, 0.88, 0] },
  shoulder: { pivot: [0.32, 1.4, 0], aim: 0.25 },
  leg: { pivot: [0.13, 0.86, 0], swing: 1 },
};
function bodyPart(region, shape, offset, size, tint, extra) {
  return Object.assign({ shape, offset, size, tint }, BODY_REGIONS[region], extra);
}
// A left part and its mirror image on the right side (x and the walk swing flipped).
function bodyPair(region, shape, offset, size, tint, extra) {
  const left = bodyPart(region, shape, offset, size, tint, extra);
  const right = Object.assign({}, left, { pivot: [-left.pivot[0], left.pivot[1], left.pivot[2]], offset: [-offset[0], offset[1], offset[2]], swing: -(left.swing || 0) });
  return [left, right];
}
// Parts several rows share.
const BODY_HELMET = bodyPart('head', 'sphere', [0, 0.06, -0.01], [0.35, 0.26, 0.36], 'modelDark');
const BODY_KNEE_PADS = bodyPair('leg', 'box', [0, -0.42, 0.1], [0.13, 0.12, 0.05], 'modelDark', { detail: true });
const BODY_PLATE = bodyPart('chest', 'box', [0, 0.02, 0.165], [0.44, 0.38, 0.06], 'model');
// Hero and class rows take their name and (heroes) colour from the hero or class row: one source per value.
const heroBody = (id, row) => Object.assign({ id, kind: 'hero', name: CAT.heroes.byId(id).name, color: CAT.heroes.byId(id).color }, row);
const classBody = (id, row) => Object.assign({ id, kind: 'class', name: CAT.classes.byId(id).name }, row);

Data.define('actorModels', { id: REQUIRED, kind: REQUIRED, name: '', color: 0x808890, base: '', drop: [], change: {}, parts: [], index: 0 }, [
  { id: 'soldier', kind: 'default', name: 'Soldier' },

  // ---- ECP04 preset classes (13d: players their class, bots a class spread by id) ----
  classBody('assault', { color: 0x6f7d4a, parts: [BODY_HELMET, BODY_PLATE, ...BODY_KNEE_PADS,
    ...bodyPair('chest', 'box', [0.11, -0.13, 0.21], [0.1, 0.12, 0.05], 'modelDark', { detail: true })] }),
  classBody('rifleman', { color: 0x8a7552, change: { pack: { size: [0.4, 0.46, 0.18], tint: 'cloth' } }, parts: [
    bodyPart('head', 'cylinder', [0, 0.1, 0], [0.31, 0.12, 0.31], 'model'),
    bodyPart('head', 'box', [0, 0.06, 0.17], [0.24, 0.02, 0.1], 'modelDark'),
    bodyPart('chest', 'box', [0, 0.14, 0.165], [0.5, 0.07, 0.04], 'cloth'),
    bodyPart('shoulder', 'box', [0.03, 0.02, -0.1], [0.09, 0.15, 0.08], 'teamDark', { detail: true }),
    bodyPart('shoulder', 'cylinder', [0.04, 0.3, -0.12], [0.015, 0.42, 0.015], 'teamDark', { detail: true })] }),
  classBody('scout', { color: 0x46604c, drop: ['pack'], change: { torso: { size: [0.46, 0.6, 0.26] } }, parts: [
    bodyPart('head', 'sphere', [0, 0.05, -0.02], [0.31, 0.27, 0.32], 'model'),
    ...bodyPair('head', 'cylinder', [0.065, 0.09, 0.13], [0.09, 0.06, 0.09], 'visor', { tilt: 90, detail: true }),
    bodyPart('head', 'box', [0, -0.07, 0.1], [0.27, 0.11, 0.12], 'cloth'),
    bodyPart('chest', 'box', [0, 0.28, 0.02], [0.34, 0.1, 0.32], 'cloth'),
    bodyPart('hips', 'box', [0, 0, -0.17], [0.28, 0.14, 0.08], 'cloth')] }),
  classBody('breacher', { color: 0x5a6068, change: { torso: { size: [0.58, 0.64, 0.34] }, visor: { offset: [0, -0.01, 0.15], size: [0.27, 0.2, 0.04] } }, parts: [
    BODY_HELMET, bodyPart('chest', 'box', [0, 0.04, 0.18], [0.5, 0.44, 0.08], 'steel'), ...BODY_KNEE_PADS,
    ...bodyPair('shoulder', 'box', [0.03, 0.05, 0], [0.22, 0.14, 0.28], 'modelDark')] }),
  classBody('marksman', { color: 0x5d6b36, drop: ['pack'], parts: [
    bodyPart('head', 'cylinder', [0, 0.08, 0], [0.5, 0.025, 0.5], 'cloth'),
    bodyPart('head', 'cylinder', [0, 0.13, 0], [0.29, 0.1, 0.29], 'cloth'),
    bodyPart('chest', 'box', [0, -0.02, -0.18], [0.54, 0.74, 0.05], 'model', { hold: -6 }),
    bodyPart('chest', 'cylinder', [0.13, 0.12, -0.25], [0.1, 0.92, 0.1], 'teamDark')] }),
  classBody('support', { color: 0x7b6a44, change: { pack: { offset: [0, 0.03, -0.25], size: [0.46, 0.58, 0.24], tint: 'model' } }, parts: [
    BODY_HELMET, bodyPart('chest', 'box', [0, -0.34, -0.25], [0.38, 0.16, 0.22], 'modelDark'),
    bodyPart('chest', 'box', [0, 0.14, 0.165], [0.5, 0.08, 0.04], 'dark'),
    bodyPart('chest', 'cylinder', [-0.16, 0.6, -0.3], [0.02, 0.62, 0.02], 'teamDark', { detail: true })] }),

  // ---- Rulesets that dress every player alike (13d: when no hero or class applies; matched by ruleset id) ----
  { id: 'tactical', kind: 'ruleset', name: 'Operator', color: 0x2e3236, change: { head: { tint: 'teamDark' } }, parts: [
    BODY_HELMET, BODY_PLATE,
    bodyPart('head', 'box', [0, 0.12, 0.15], [0.14, 0.07, 0.08], 'teamDark'),
    ...bodyPair('head', 'cylinder', [0.04, 0.12, 0.2], [0.05, 0.05, 0.05], 'visor', { tilt: 90, detail: true })] },
  { id: 'knight', kind: 'ruleset', name: 'Knight', color: 0xb0302c, drop: ['pack'],
    change: { head: { shape: 'box', size: [0.32, 0.36, 0.32], tint: 'steel' }, visor: { offset: [0, 0.03, 0.165], size: [0.24, 0.03, 0.03], tint: 'teamDark' } }, parts: [
      bodyPart('head', 'box', [0, 0.24, -0.02], [0.05, 0.14, 0.28], 'model'),
      ...bodyPair('shoulder', 'sphere', [0.02, 0.03, 0], [0.24, 0.2, 0.28], 'steel'),
      bodyPart('chest', 'box', [0, -0.2, 0.165], [0.32, 0.8, 0.03], 'team')] },
  { id: 'suit', kind: 'ruleset', name: 'Weave Suit', color: 0x3fd8ff, drop: ['pack'],
    change: { head: { size: [0.31, 0.33, 0.31], tint: 'modelDark' }, visor: { size: [0.26, 0.07, 0.07], tint: 'modelGlow' } }, parts: [
      ...bodyPair('shoulder', 'sphere', [0.02, 0.03, 0], [0.22, 0.2, 0.24], 'modelDark'),
      bodyPart('chest', 'cylinder', [0, 0.04, -0.2], [0.18, 0.4, 0.18], 'modelDark'),
      bodyPart('chest', 'box', [0, 0.04, -0.3], [0.06, 0.3, 0.02], 'modelGlow', { detail: true }),
      bodyPart('chest', 'box', [0, 0.1, 0.155], [0.36, 0.05, 0.02], 'modelGlow', { detail: true })] },

  // ---- Heroes H01..H08 (12e: the hero of this life) ----
  heroBody('bastide', { change: { torso: { size: [0.66, 0.68, 0.38] }, head: { shape: 'box', size: [0.34, 0.36, 0.34], tint: 'model' },
    visor: { offset: [0, 0.03, 0.175], size: [0.26, 0.04, 0.03], tint: 'visor' }, pack: { tint: 'steel' } }, parts: [
    bodyPart('head', 'box', [0, 0.25, 0], [0.05, 0.12, 0.32], 'steel'),
    ...bodyPair('shoulder', 'box', [0.04, 0.06, 0], [0.28, 0.2, 0.34], 'model'),
    bodyPart('hips', 'box', [0, -0.1, 0], [0.54, 0.26, 0.36], 'steel'),
    bodyPart('chest', 'box', [0, 0.06, 0.2], [0.4, 0.3, 0.04], 'modelDark', { detail: true })] }),
  heroBody('moraine', { change: { torso: { size: [0.6, 0.64, 0.36] }, head: { size: [0.36, 0.34, 0.36], tint: 'model' },
    visor: { offset: [0, 0.01, 0.15], size: [0.28, 0.08, 0.07], tint: 'modelGlow' }, pack: { shape: 'cylinder', size: [0.34, 0.5, 0.22], tint: 'modelDark' } }, parts: [
    bodyPart('chest', 'ring', [0, 0.06, -0.34], [0.6, 0.08, 0.6], 'modelGlow', { tilt: 90 }),
    ...bodyPair('shoulder', 'sphere', [0.03, 0.04, 0], [0.26, 0.24, 0.26], 'modelDark'),
    bodyPart('hips', 'box', [0, 0, 0.12], [0.4, 0.16, 0.08], 'model', { detail: true })] }),
  heroBody('quill', { drop: ['pack'], change: { torso: { size: [0.46, 0.58, 0.26] }, visor: { tint: 'modelGlow' } }, parts: [
    bodyPart('head', 'box', [0, 0.16, -0.06], [0.04, 0.1, 0.32], 'model', { tilt: -25 }),
    bodyPart('chest', 'box', [0.05, 0.27, -0.3], [0.1, 0.03, 0.4], 'model', { tilt: 18 }),
    bodyPart('chest', 'box', [0, 0.27, 0.02], [0.3, 0.08, 0.3], 'model'),
    bodyPart('chest', 'sphere', [0, 0.06, 0.14], [0.11, 0.11, 0.06], 'modelGlow', { detail: true }),
    ...bodyPair('leg', 'box', [0, -0.62, -0.1], [0.04, 0.22, 0.12], 'model', { detail: true })] }),
  heroBody('tessaly', { drop: ['pack'], change: { head: { size: [0.3, 0.32, 0.31], tint: 'modelDark' } }, parts: [
    bodyPart('head', 'sphere', [0, 0.03, -0.035], [0.33, 0.34, 0.34], 'model'),
    ...bodyPair('chest', 'box', [0.32, 0.12, -0.21], [0.52, 0.56, 0.03], 'model', { hold: -8 }),
    bodyPart('chest', 'box', [0, 0.06, -0.19], [0.26, 0.32, 0.1], 'steel'),
    ...bodyPair('hips', 'box', [0.12, -0.3, -0.13], [0.18, 0.56, 0.04], 'modelDark', { swing: 0.3 })] }),
  heroBody('brask', { change: { visor: { shape: 'cylinder', offset: [0, -0.06, 0.15], size: [0.12, 0.12, 0.12], tint: 'teamDark', tilt: 90 },
    pack: { size: [0.44, 0.38, 0.22], tint: 'cloth' } }, parts: [
    BODY_HELMET,
    ...bodyPair('head', 'sphere', [0.065, 0.03, 0.12], [0.08, 0.08, 0.05], 'visor', { detail: true }),
    bodyPart('chest', 'sphere', [0.13, 0.12, 0.18], [0.1, 0.1, 0.1], 'model'),
    bodyPart('chest', 'sphere', [0, 0.03, 0.18], [0.1, 0.1, 0.1], 'model'),
    bodyPart('chest', 'sphere', [-0.13, -0.06, 0.18], [0.1, 0.1, 0.1], 'model'),
    bodyPart('hips', 'box', [0, 0.04, 0], [0.5, 0.08, 0.32], 'cloth', { detail: true })] }),
  heroBody('lark', { change: { pack: { tint: 'white' } }, parts: [
    bodyPart('head', 'cylinder', [0, 0.1, 0], [0.3, 0.12, 0.3], 'white'),
    bodyPart('head', 'box', [0, 0.06, 0.17], [0.24, 0.02, 0.1], 'model'),
    bodyPart('chest', 'box', [0, 0.04, -0.28], [0.22, 0.07, 0.02], 'red'),
    bodyPart('chest', 'box', [0, 0.04, -0.28], [0.07, 0.22, 0.02], 'red'),
    bodyPart('chest', 'cylinder', [0.14, 0.46, -0.24], [0.02, 0.4, 0.02], 'steel', { detail: true }),
    bodyPart('chest', 'sphere', [0.14, 0.68, -0.24], [0.09, 0.09, 0.09], 'modelGlow')] }),
  heroBody('mirelle', { drop: ['pack'], parts: [
    bodyPart('head', 'cone', [0, 0.32, -0.03], [0.3, 0.44, 0.3], 'model'),
    bodyPart('head', 'cylinder', [0, 0.1, 0], [0.56, 0.025, 0.56], 'modelDark'),
    bodyPart('hips', 'box', [0, -0.38, 0], [0.5, 0.74, 0.34], 'model'),
    bodyPart('chest', 'box', [0, -0.22, 0.16], [0.14, 0.42, 0.03], 'modelGlow', { detail: true })] }),
  heroBody('tamsin', { change: { pack: { size: [0.3, 0.36, 0.12] } }, parts: [
    bodyPart('head', 'sphere', [0.02, 0.12, 0], [0.33, 0.12, 0.33], 'model'),
    bodyPart('head', 'cylinder', [-0.07, 0.03, 0.14], [0.07, 0.06, 0.07], 'visor', { tilt: 90, detail: true }),
    bodyPart('chest', 'box', [0, 0, -0.17], [0.5, 0.62, 0.03], 'modelDark'),
    bodyPart('chest', 'box', [-0.42, 0.64, -0.1], [0.24, 0.06, 0.24], 'modelDark'),
    bodyPart('chest', 'sphere', [-0.42, 0.6, -0.02], [0.07, 0.07, 0.07], 'modelGlow'),
    bodyPart('chest', 'cylinder', [0.12, 0.5, -0.24], [0.015, 0.5, 0.015], 'steel', { detail: true })] }),
]);
CAT.actorModels.forEach((row, index) => { row.index = index; });
