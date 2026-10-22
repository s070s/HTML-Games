// ==== S16 MAPS: FORGE TOOLS ====
// The editor's hands (MAP-014): a fly camera, a snapped 3D cursor under the mouse / touch point / screen centre, the placement tools with
// their options, grab-and-drop moving, one command table that keyboard + mouse, gamepad and the touch buttons all call, the render source
// that draws the map and the ghost of what would be placed, and test-play. Nothing here allocates per frame: scratch numbers and typed arrays.
// The model (budget, undo, save) is Forge in 16x-forge.js; the screens are in 18i-ui-forge.js. Contract: docs/api/forge.md.

const FORGE_FLY_SPEED = 14;                 // m/s
const FORGE_FAST_FACTOR = 3;
const FORGE_PAD_DEADZONE = 0.15;
const FORGE_PAD_LOOK = 2.2;                 // rad/s at full stick
const FORGE_MOUSE_LOOK = 0.0035;            // rad per pixel
const FORGE_TURN_SPEED = 1.6;               // rad/s for the touch turn buttons
const FORGE_RAY_LENGTH = 600;
const FORGE_PITCH_LIMIT = 89 * DEG;
const FORGE_CAMERA_ABOVE = 40;              // the camera stays this far above the map top / outside the map
const FORGE_FOCUS_BACK = 9;                 // metres the camera stands back when it jumps to an object
const FORGE_GRID_RADIUS = 10;               // grid lines are drawn this far around the cursor
const FORGE_TURN_STEPS = 4;
const FORGE_PAD_BUTTONS = 16;
const FORGE_LINE = 0.03;                    // thickness of grid lines
const FORGE_EDGE_SELECTED = 0.12, FORGE_EDGE_HOVER = 0.06, FORGE_EDGE_ZONE = 0.08;
const FORGE_PLAY_SEED_RANGE = 99999;

// The placement tools. size = default [width, height, depth] of the stamp for box-like tools. A tool's options are rows of FORGE_OPTIONS.
const FORGE_TOOLS = [
  { id: 'select', label: 'Select', key: 'Digit1' },
  { id: 'box', label: 'Box', key: 'Digit2', list: 'brushes', size: [2, 2, 2] },
  { id: 'ramp', label: 'Ramp', key: 'Digit3', list: 'brushes', size: [3, 1.5, 4] },
  { id: 'spawn', label: 'Spawn', key: 'Digit4', list: 'spawns' },
  { id: 'item', label: 'Item pad', key: 'Digit5', list: 'items' },
  { id: 'objective', label: 'Objective', key: 'Digit6', list: 'objectives' },
  { id: 'zone', label: 'Zone', key: 'Digit7', list: 'zones', size: [10, 12, 10] },
  { id: 'trigger', label: 'Trigger', key: 'Digit8', list: 'triggers', size: [3, 3, 3] },
  { id: 'light', label: 'Light', key: 'Digit9', list: 'lights' },
  { id: 'hint', label: 'Nav hint', key: 'Digit0', list: 'navHints' },
];
const forgeToolById = (id) => FORGE_TOOLS.find((tool) => tool.id === id);
const forgeAllItemKeys = () => [].concat(...MapRules.itemGroups.map((group) => MapRules.itemKeys[group]));
function forgeItemName(key) {
  const row = CAT.weapons.byId(key) || (CAT.powerups && CAT.powerups.byId(key)) || (CAT.items && CAT.items.byId(key));
  return row && row.name ? row.name : key;
}
const FORGE_TEAM_TEXTS = { '-1': 'Anyone', 0: 'Team 0', 1: 'Team 1' };
const forgeTeamTexts = (values) => values.map((value) => FORGE_TEAM_TEXTS[value]);
// Options per tool: the stamp field they set, the values (a function when the list comes from data read at runtime) and how to show each.
const FORGE_OPTIONS = {
  box: [{ key: 'material', label: 'Material', values: () => MapRules.materials }],
  ramp: [{ key: 'material', label: 'Material', values: () => MapRules.materials }],
  spawn: [{ key: 'team', label: 'Team', values: () => [-1, 0, 1], texts: forgeTeamTexts }],
  item: [{ key: 'itemKey', label: 'Item', values: forgeAllItemKeys, texts: (values) => values.map(forgeItemName) }],
  objective: [{ key: 'objectiveKind', label: 'Kind', values: () => MapRules.objectiveKinds },
    { key: 'objectiveTeam', label: 'Team', values: () => [-1, 0, 1], texts: forgeTeamTexts }],
  trigger: [{ key: 'triggerKind', label: 'Kind', values: () => MapRules.triggerKinds }],
  hint: [{ key: 'hintKind', label: 'Kind', values: () => MapRules.hintKinds }],
};

// Colours of the editor's markers, 0xRRGGBB. Converted once to 0..1 triples.
const FORGE_PALETTE = {
  team: { '-1': 0xd8dde3, 0: 0x4a8cff, 1: 0xff5a52 },
  group: { power: 0xb06bff, armor: 0x6fa8dc, health: 0x57d98a, weapon: 0xff9a3c, ammo: 0xf2d04a },
  objective: { flag: 0xffd24a, flagBase: 0xc9a227, point: 0x57d98a, hill: 0xa4e05a, bombsite: 0xff5a52, payloadPath: 0x3fd0d8, relic: 0xf2b632, core: 0xff6fb4, bank: 0x9ad06a, extract: 0x3fd0d8 },
  trigger: { jumppad: 0xff9a3c, teleporter: 0xb06bff, ladder: 0xd8dde3, water: 0x3d8bff, hazard: 0xff5a52, killzone: 0xff2a2a },
  hint: { cover: 0xa0a8b0, sniper: 0xff5a52, choke: 0xf2d04a, flank: 0x57d98a, dummy: 0xffffff, guard: 0xff9a3c },
  selected: 0xffd24a, hover: 0xffffff, grid: 0x4f6178, bounds: 0x3d8bff, cursor: 0xffd24a, zone: 0x57d98a, ghost: 0xffffff, light: 0xffd9a0,
};
const FORGE_RGB = new Map();
function forgeRgb(hex) {
  let triple = FORGE_RGB.get(hex);
  if (!triple) { triple = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]; FORGE_RGB.set(hex, triple); }
  return triple;
}
const FORGE_MATERIAL_RGB = new Map();
function forgeMaterialRgb(material) {
  let triple = FORGE_MATERIAL_RGB.get(material);
  if (!triple) {
    const row = CAT.materials.byId(material);
    triple = forgeRgb(row ? parseInt(row.colorA.slice(1), 16) : 0x9a9a95);
    FORGE_MATERIAL_RGB.set(material, triple);
  }
  return triple;
}
const FORGE_NO_POINTS = [];
const FORGE_CAPTURE_EVENTS = ['keydown', 'keyup'];
const FORGE_RAMP_YAW = { '+z': 0, '+x': Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 };
const FORGE_RAMP_DIRS = ['+z', '+x', '-z', '-x'];

// Keys: held ones fly the camera; the others run a command. A modifier prefix is ctrl+ and shift+ in that order.
const FORGE_HOLD_KEYS = { KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right', KeyE: 'up', KeyQ: 'down', ShiftLeft: 'fast', ShiftRight: 'fast' };
const FORGE_COMMAND_KEYS = {
  'ctrl+KeyZ': 'undo', 'ctrl+KeyY': 'redo', 'ctrl+shift+KeyZ': 'redo', Delete: 'secondary', Backspace: 'secondary', KeyX: 'secondary', KeyR: 'rotate',
  KeyG: 'grab', KeyF: 'snap', KeyV: 'duplicate', BracketLeft: 'optionPrev', BracketRight: 'optionNext', PageUp: 'levelUp', PageDown: 'levelDown',
  Enter: 'primary', KeyT: 'toggleZones', ArrowUp: 'nudgeForward', ArrowDown: 'nudgeBack', ArrowLeft: 'nudgeLeft', ArrowRight: 'nudgeRight', Tab: 'toolNext',
};
const FORGE_PAD_COMMANDS = { 0: 'primary', 1: 'secondary', 2: 'rotate', 3: 'grab', 4: 'optionPrev', 5: 'optionNext', 8: 'undo', 9: 'menu',
  10: 'levelDown', 11: 'levelUp', 12: 'toolPrev', 13: 'toolNext', 14: 'snap', 15: 'redo' };
for (const tool of FORGE_TOOLS) FORGE_COMMAND_KEYS[tool.key] = 'tool:' + tool.id;

// Face of a box a point on its surface lies on: writes the unit normal into out (3 numbers).
function forgeFaceNormal(box, px, py, pz, out) {
  let best = Infinity;
  out[0] = out[1] = out[2] = 0;
  const point = [px, py, pz];
  for (let axis = 0; axis < 3; axis++) {
    const toMin = Math.abs(point[axis] - box[axis]), toMax = Math.abs(point[axis] - box[axis + 3]);
    if (toMin < best) { best = toMin; out[0] = out[1] = out[2] = 0; out[axis] = -1; }
    if (toMax < best) { best = toMax; out[0] = out[1] = out[2] = 0; out[axis] = 1; }
  }
}

const ForgeTools = {
  active: false,
  returning: false,                           // a test match is running: the editor comes back when it stops
  camera: { x: 0, y: 20, z: -20, yaw: 0, pitch: -0.6 },
  cursor: { x: 0, y: 0, z: 0, valid: false },
  pointer: { ndcX: 0, ndcY: 0, centre: false },
  ray: { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 1 },
  hover: { list: '', index: -1, distance: 0 },
  surface: { distance: -1, list: '', index: -1, nx: 0, ny: 1, nz: 0, top: 0 },
  normal: [0, 0, 0],
  box: new Float64Array(6),
  layoutBox: new Float64Array(6),
  tool: 'box',
  elevation: 0,
  snapIndex: 0,
  turns: 0,
  stamp: { material: 'concrete', team: -1, itemKey: 'healthpack', objectiveKind: 'point', objectiveTeam: -1, triggerKind: 'killzone', hintKind: 'cover', sizes: {} },
  view: { zones: false, triggers: true },
  held: {},
  drag: { look: false, x: 0, y: 0, touches: 0 },
  grab: { active: false, list: '', index: -1, ax: 0, ay: 0, az: 0, dx: 0, dy: 0, dz: 0 },
  pad: { forward: 0, strafe: 0, rise: 0, turn: 0, look: 0, previous: new Uint8Array(FORGE_PAD_BUTTONS) },
  move: { forward: 0, strafe: 0, rise: 0, turn: 0, lookUp: 0 },
  nearest: { list: '', index: -1 },
  shellTheme: '',
  savedOverride: null,
  listeners: null,
  cameraHook: null,
  menuRequest: null,                          // fn() set by the screens: open the editor menu
  playMode: '',
  rampScratch: { shape: 'ramp', min: [0, 0, 0], max: [0, 0, 0], dir: '+z' },
  pointScratch: { x: 0, y: 0, z: 0, yaw: 0, group: '', radius: 3, color: 0, kind: '', path: null },
  cameraPlaced: false,

  snap() { return FORGE_SNAPS[this.snapIndex]; },
  toolRow() { return forgeToolById(this.tool); },
  snapTo(value) { return Math.round(value / this.snap()) * this.snap(); },

  // ---- Session: while the editor is open the camera flies and the source draws ----
  attach() {
    if (this.active) return;
    Forge.ensureMap();
    this.active = true;
    this.savedOverride = Render.cameraOverride;
    Render.cameraOverride = this.cameraHook;
    this.loadShell();
    this.listen();
    if (!this.cameraPlaced) this.homeCamera();
  },
  detach() {
    if (!this.active) return;
    this.active = false;
    this.unlisten();
    this.grab.active = false;
    for (const name in this.held) this.held[name] = false;
    this.drag.look = false;
    if (Render.cameraOverride === this.cameraHook) Render.cameraOverride = this.savedOverride;
  },
  // The renderer shows the theme and sky of the loaded world: an empty one carries them (the objects are drawn by the render source).
  loadShell() {
    const map = Forge.map;
    World.load({ id: 'forge', code: 'U00', name: map.name, size: map.size, theme: map.theme, sky: map.sky, category: map.category, modes: [], brushes: [], spawns: [], items: [],
      objectives: [], zones: [], triggers: [], lights: [], navHints: [] });
    this.shellTheme = map.theme;
  },
  homeCamera() {
    const size = Forge.map.size;
    this.camera.x = 0; this.camera.z = -size[2] * 0.55; this.camera.y = size[1] * 0.8 + 6;
    this.camera.yaw = 0; this.camera.pitch = -0.6;
    this.cameraPlaced = true;
  },
  // Stands the camera a little back from a point and looks at it (a clicked problem, a new object).
  focusOn(x, y, z) {
    const camera = this.camera;
    camera.x = x - Math.sin(camera.yaw) * FORGE_FOCUS_BACK;
    camera.z = z - Math.cos(camera.yaw) * FORGE_FOCUS_BACK;
    camera.y = y + FORGE_FOCUS_BACK * 0.6;
    camera.pitch = -0.55;
  },

  // ---- Per frame (Loop 'input' phase) ----
  frame(seconds) {
    if (!this.active) return;
    this.readPad(seconds);
    this.moveCamera(seconds);
    this.updateCursor();
  },
  moveCamera(seconds) {
    const camera = this.camera, held = this.held, pad = this.pad, move = this.move, size = Forge.map.size;
    const axis = (positive, negative, analog) => clamp((held[positive] ? 1 : 0) - (held[negative] ? 1 : 0) + analog, -1, 1);
    move.forward = axis('forward', 'back', pad.forward);
    move.strafe = axis('right', 'left', pad.strafe);
    move.rise = axis('up', 'down', pad.rise);
    move.turn = axis('turnLeft', 'turnRight', 0);
    move.lookUp = axis('lookUp', 'lookDown', 0);
    camera.yaw += (move.turn * FORGE_TURN_SPEED + pad.turn * FORGE_PAD_LOOK) * seconds;
    camera.pitch = clamp(camera.pitch + (move.lookUp * FORGE_TURN_SPEED - pad.look * FORGE_PAD_LOOK) * seconds, -FORGE_PITCH_LIMIT, FORGE_PITCH_LIMIT);
    const speed = FORGE_FLY_SPEED * (held.fast ? FORGE_FAST_FACTOR : 1) * seconds;
    const sinYaw = Math.sin(camera.yaw), cosYaw = Math.cos(camera.yaw), cosPitch = Math.cos(camera.pitch);
    camera.x += (sinYaw * cosPitch * move.forward - cosYaw * move.strafe) * speed;
    camera.y += (Math.sin(camera.pitch) * move.forward + move.rise) * speed;
    camera.z += (cosYaw * cosPitch * move.forward + sinYaw * move.strafe) * speed;
    camera.x = clamp(camera.x, -size[0] / 2 - FORGE_CAMERA_ABOVE, size[0] / 2 + FORGE_CAMERA_ABOVE);
    camera.z = clamp(camera.z, -size[2] / 2 - FORGE_CAMERA_ABOVE, size[2] / 2 + FORGE_CAMERA_ABOVE);
    camera.y = clamp(camera.y, 0.5, size[1] + FORGE_CAMERA_ABOVE);
  },
  // A new map (load, import, template) puts the camera back above it; a theme change reloads the sky.
  onModelChange(what) {
    this.hover.list = ''; this.hover.index = -1;      // the map changed under the pointer: the next frame picks again
    if (!this.active) return;
    if (what === 'map') { this.homeCamera(); this.grab.active = false; }
    if (this.shellTheme !== Forge.map.theme || what === 'map') this.loadShell();
  },
  setHold(name, down) { this.held[name] = down; },
  // The Render.cameraOverride hook (one function, created once).
  placeCamera(target) {
    target.x = this.camera.x; target.y = this.camera.y; target.z = this.camera.z;
    target.yaw = this.camera.yaw; target.pitch = this.camera.pitch; target.roll = 0;
    return true;
  },

  // ---- The 3D cursor ----
  // Direction under the pointer (or the screen centre for the pad) into this.ray.
  aimRay() {
    const camera = this.camera, ray = this.ray, pointer = this.pointer;
    const aspect = window.innerWidth > 0 && window.innerHeight > 0 ? window.innerWidth / window.innerHeight : 16 / 9;
    const tanY = Math.tan(verticalFov(Render.camera.fov) / 2), tanX = tanY * aspect;
    const sy = Math.sin(camera.yaw), cy = Math.cos(camera.yaw), sp = Math.sin(camera.pitch), cp = Math.cos(camera.pitch);
    const u = pointer.centre ? 0 : pointer.ndcX * tanX, v = pointer.centre ? 0 : pointer.ndcY * tanY;
    const x = sy * cp - cy * u - sy * sp * v, y = sp + cp * v, z = cy * cp + sy * u - cy * sp * v;
    const length = Math.hypot(x, y, z);
    ray.ox = camera.x; ray.oy = camera.y; ray.oz = camera.z;
    ray.dx = x / length; ray.dy = y / length; ray.dz = z / length;
  },
  // Nearest brush the ray touches (the surface to build on), skipping one brush (the one being moved). Fills this.surface.
  castSurface(skipIndex) {
    const ray = this.ray, surface = this.surface, brushes = Forge.map.brushes, box = this.box;
    let best = -1, bestIndex = -1;
    for (let i = 0; i < brushes.length; i++) {
      if (i === skipIndex) continue;
      const min = brushes[i].min, max = brushes[i].max;
      const distance = rayBoundsDistance(ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, FORGE_RAY_LENGTH, min[0], min[1], min[2], max[0], max[1], max[2]);
      if (distance > 0 && (best < 0 || distance < best)) { best = distance; bestIndex = i; }
    }
    surface.distance = best; surface.index = bestIndex;
    if (best < 0) return;
    Forge.bounds('brushes', brushes[bestIndex], box);
    forgeFaceNormal(box, ray.ox + ray.dx * best, ray.oy + ray.dy * best, ray.oz + ray.dz * best, this.normal);
    surface.nx = this.normal[0]; surface.ny = this.normal[1]; surface.nz = this.normal[2]; surface.top = box[4];
  },
  updateCursor() {
    this.aimRay();
    this.castSurface(this.grab.active && this.grab.list === 'brushes' ? this.grab.index : -1);
    this.aimCursor();
    this.pickHover();
    this.updateGrab();
  },
  aimCursor() {
    const ray = this.ray, surface = this.surface, cursor = this.cursor, size = Forge.map.size;
    let distance = surface.distance, onGround = false;
    if (ray.dy < -1e-6) {
      const groundDistance = (this.elevation - ray.oy) / ray.dy;
      if (groundDistance > 0 && (distance < 0 || groundDistance < distance)) { distance = groundDistance; onGround = true; }
    }
    if (distance < 0) { cursor.valid = false; return; }
    const px = ray.ox + ray.dx * distance, py = ray.oy + ray.dy * distance, pz = ray.oz + ray.dz * distance;
    cursor.valid = true;
    if (onGround) { cursor.x = this.snapTo(px); cursor.y = this.elevation; cursor.z = this.snapTo(pz); }
    else if (surface.ny > 0.5) { cursor.x = this.snapTo(px); cursor.y = surface.top; cursor.z = this.snapTo(pz); }
    else { cursor.x = this.snapTo(px + surface.nx * 0.25); cursor.y = Math.floor(py / this.snap()) * this.snap(); cursor.z = this.snapTo(pz + surface.nz * 0.25); }
    cursor.x = clamp(cursor.x, -size[0] / 2, size[0] / 2);
    cursor.z = clamp(cursor.z, -size[2] / 2, size[2] / 2);
  },
  // Nearest object under the pointer, any list that is currently shown. Fills this.hover (list '' = nothing).
  pickHover() {
    const ray = this.ray, hover = this.hover, box = this.box;
    hover.list = ''; hover.index = -1; hover.distance = FORGE_RAY_LENGTH;
    for (let k = 0; k < MAP_REQUIRED_LISTS.length; k++) {
      const list = MAP_REQUIRED_LISTS[k];
      if (!this.pickable(list)) continue;
      const items = Forge.map[list];
      for (let i = 0; i < items.length; i++) {
        if (this.grab.active && this.grab.list === list && this.grab.index === i) continue;
        Forge.bounds(list, items[i], box);
        const distance = rayBoundsDistance(ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, hover.distance, box[0], box[1], box[2], box[3], box[4], box[5]);
        if (distance > 0 && distance < hover.distance) { hover.distance = distance; hover.list = list; hover.index = i; }
      }
    }
  },
  // Zones are big boxes that would hide everything behind them: they are picked only while shown or while the zone tool is active.
  pickable(list) {
    if (list === 'zones') return this.view.zones || this.tool === 'zone';
    if (list === 'triggers') return this.view.triggers || this.tool === 'trigger';
    return true;
  },

  // ---- What would be placed: the box of a box-like tool at the cursor, in this.layoutBox ----
  // The stamp size is [width, height, depth]; a quarter turn swaps width and depth (a ramp's depth is its run along '+z').
  layout(tool) {
    const size = this.stamp.sizes[tool.id], box = this.layoutBox, cursor = this.cursor, turned = this.turns % 2 === 1;
    const width = turned ? size[2] : size[0], depth = turned ? size[0] : size[2];
    box[0] = this.snapTo(cursor.x - width / 2); box[1] = cursor.y; box[2] = this.snapTo(cursor.z - depth / 2);
    box[3] = box[0] + width; box[4] = box[1] + size[1]; box[5] = box[2] + depth;
    return box;
  },

  // ---- Making and placing objects ----
  makeObject(tool) {
    const cursor = this.cursor, stamp = this.stamp;
    if (tool.size) return this.makeVolume(tool);
    if (tool.id === 'spawn') return MapKit.spawns([[stamp.team, [], [[cursor.x, cursor.y, cursor.z, this.turns * 90]]]])[0];
    if (tool.id === 'item') return MapKit.item([stamp.itemKey, cursor.x, cursor.y, cursor.z]);
    if (tool.id === 'objective') return this.makeObjective();
    if (tool.id === 'light') return MapKit.light([cursor.x, cursor.y + 3, cursor.z, FORGE_LIGHT_COLOR, 14]);
    return MapKit.hint([stamp.hintKind, cursor.x, cursor.y, cursor.z]);
  },
  makeVolume(tool) {
    const box = this.layout(tool), stamp = this.stamp, center = [(box[0] + box[3]) / 2, (box[2] + box[5]) / 2];
    const min = [box[0], box[1], box[2]], max = [box[3], box[4], box[5]];
    if (tool.id === 'box') return MapKit.brush([stamp.material, ...min, ...max]);
    if (tool.id === 'ramp') return MapKit.brush([stamp.material, ...min, ...max, FORGE_RAMP_DIRS[this.turns]]);
    if (tool.id === 'zone') return { name: Forge.uniqueZoneName('Zone'), min, max };
    return this.makeTrigger(min, max, center);
  },
  makeObjective() {
    const cursor = this.cursor, stamp = this.stamp, kind = stamp.objectiveKind;
    const teamed = kind === 'flag' || kind === 'flagBase' || kind === 'bank';
    const objective = MapKit.objective({ id: Forge.uniqueObjectiveId(kind), kind, team: teamed || kind === 'bombsite' ? stamp.objectiveTeam : -1, x: cursor.x, y: cursor.y, z: cursor.z, radius: 3 });
    if (kind === 'payloadPath') objective.path = [[cursor.x, cursor.y, cursor.z]];
    return objective;
  },
  // Jump pads and teleporters get their far end six metres ahead of the box in the stamp's direction.
  makeTrigger(min, max, center) {
    const kind = this.stamp.triggerKind, trigger = { kind, min, max };
    const ahead = [Math.sin(this.turns * Math.PI / 2) * 6, Math.cos(this.turns * Math.PI / 2) * 6];
    const point = [center[0] + ahead[0], min[1], center[1] + ahead[1]];
    if (kind === 'jumppad') { trigger.target = point; trigger.peak = 3; }
    if (kind === 'teleporter') { trigger.exit = point; trigger.yaw = this.turns * 90; }
    if (kind === 'hazard') { trigger.damage = 15; trigger.element = 'thermal'; }
    return trigger;
  },
  place() {
    const tool = this.toolRow();
    if (!tool.list || !this.cursor.valid) return -1;
    const object = this.makeObject(tool);
    const clamped = Forge.moved(tool.list, object, 0, 0, 0);
    const index = Forge.add(tool.list, clamped);
    if (index >= 0) Forge.select(tool.list, index);
    return index;
  },

  // ---- Grab and drop: the selected object follows the cursor until it is dropped ----
  startGrab() {
    const selection = Forge.selection, grab = this.grab;
    if (!Forge.selected() || !this.cursor.valid) return false;
    grab.active = true; grab.list = selection.list; grab.index = selection.index;
    grab.ax = this.cursor.x; grab.ay = this.cursor.y; grab.az = this.cursor.z;
    grab.dx = grab.dy = grab.dz = 0;
    return true;
  },
  updateGrab() {
    const grab = this.grab, cursor = this.cursor;
    if (!grab.active || !cursor.valid) return;
    grab.dx = cursor.x - grab.ax; grab.dy = cursor.y - grab.ay; grab.dz = cursor.z - grab.az;
  },
  dropGrab() {
    const grab = this.grab;
    if (!grab.active) return false;
    grab.active = false;
    const object = Forge.map[grab.list][grab.index];
    return !!object && Forge.replace(grab.list, grab.index, Forge.moved(grab.list, object, grab.dx, grab.dy, grab.dz));
  },

  // ---- Commands: the one table keyboard, mouse, pad and touch buttons call ----
  command(name) {
    if (name.startsWith('tool:')) return this.setTool(name.slice(5));
    const run = FORGE_COMMANDS[name];
    return run ? run(this) : false;
  },
  setTool(id) {
    if (!forgeToolById(id)) return false;
    this.tool = id;
    this.grab.active = false;
    Forge.announce('tool');
    return true;
  },
  cycleTool(step) {
    const index = FORGE_TOOLS.findIndex((tool) => tool.id === this.tool);
    return this.setTool(FORGE_TOOLS[(index + step + FORGE_TOOLS.length) % FORGE_TOOLS.length].id);
  },
  // The options of the current tool, each with its current value.
  options() { return FORGE_OPTIONS[this.tool] || []; },
  cycleOption(step, which) {
    const option = this.options()[which || 0];
    if (!option) return false;
    const values = option.values(), index = values.indexOf(this.stamp[option.key]);
    this.stamp[option.key] = values[(index + step + values.length) % values.length];
    Forge.announce('tool');
    return true;
  },
  setOption(key, value) { this.stamp[key] = value; Forge.announce('tool'); },
  turnStamp() { this.turns = (this.turns + 1) % FORGE_TURN_STEPS; Forge.announce('tool'); return true; },
  // Stamp sizes (box-like tools): axis 0 width, 1 height, 2 depth.
  resizeStamp(axis, delta) {
    const size = this.stamp.sizes[this.tool];
    if (!size || size[axis] + delta < FORGE_MIN_EXTENT) return false;
    size[axis] += delta;
    Forge.announce('tool');
    return true;
  },
  setLevel(value) { this.elevation = clamp(value, FORGE_FLOOR_LIMIT, Forge.map.size[1]); Forge.announce('tool'); return true; },
  nudge(right, forward) {
    const sinYaw = Math.sin(this.camera.yaw), cosYaw = Math.cos(this.camera.yaw), alongX = Math.abs(sinYaw) > Math.abs(cosYaw);
    const fx = alongX ? Math.sign(sinYaw) : 0, fz = alongX ? 0 : Math.sign(cosYaw), step = this.snap();
    return Forge.nudgeSelected((-fz * right + fx * forward) * step, 0, (fx * right + fz * forward) * step);
  },
  // Selects what is under the pointer (the Select tool); nothing under it clears the selection.
  selectHover() {
    if (this.hover.list) Forge.select(this.hover.list, this.hover.index); else Forge.clearSelection();
    return true;
  },
  // The Delete command: the selection, or the object under the pointer when nothing is selected.
  deleteTarget() {
    if (Forge.selected()) return Forge.deleteSelected();
    return !!this.hover.list && Forge.deleteObject(this.hover.list, this.hover.index);
  },
  // Appends the cursor to the selected payload path (the first point also moves the objective).
  addPathPoint() {
    const cursor = this.cursor, object = Forge.selected();
    if (!object || object.kind !== 'payloadPath' || !cursor.valid) return false;
    return Forge.editSelected((copy) => { copy.path.push([cursor.x, cursor.y, cursor.z]); });
  },

  // ---- Input: keyboard, mouse, touch points, gamepad ----
  listen() {
    if (this.listeners) return;
    const handlers = {
      keydown: (event) => this.onKeyDown(event), keyup: (event) => this.onKeyUp(event), pointerdown: (event) => this.onPointerDown(event),
      pointermove: (event) => this.onPointerMove(event), pointerup: (event) => this.onPointerUp(event), pointercancel: (event) => this.onPointerUp(event),
      wheel: (event) => this.onWheel(event), blur: () => this.releaseAll(),
    };
    this.listeners = handlers;
    for (const type in handlers) window.addEventListener(type, handlers[type], type === 'wheel' ? { passive: false } : FORGE_CAPTURE_EVENTS.includes(type));
  },
  unlisten() {
    if (!this.listeners) return;
    for (const type in this.listeners) window.removeEventListener(type, this.listeners[type], FORGE_CAPTURE_EVENTS.includes(type));
    this.listeners = null;
  },
  releaseAll() {
    for (const name in this.held) this.held[name] = false;
    this.drag.look = false; this.drag.touches = 0;
  },
  keyId(event) { return (event.ctrlKey || event.metaKey ? 'ctrl+' : '') + (event.shiftKey ? 'shift+' : '') + event.code; },
  onKeyDown(event) {
    if (event.target && event.target.tagName === 'INPUT' && event.target.type === 'text') return;
    if (event.target && event.target.tagName === 'TEXTAREA') return;
    Input.setDevice('kbm');
    const hold = FORGE_HOLD_KEYS[event.code], command = FORGE_COMMAND_KEYS[this.keyId(event)];
    if (hold) { this.held[hold] = true; event.preventDefault(); return; }
    if (!command || (event.repeat && !FORGE_REPEATING.includes(command))) return;
    event.preventDefault();
    this.command(command);
  },
  onKeyUp(event) {
    const hold = FORGE_HOLD_KEYS[event.code];
    if (hold) this.held[hold] = false;
  },
  onCanvas(event) { return !!event.target && event.target.id === 'view'; },
  setPointer(event) {
    this.pointer.centre = false;
    this.pointer.ndcX = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.ndcY = 1 - (event.clientY / window.innerHeight) * 2;
  },
  onPointerDown(event) {
    if (!this.onCanvas(event)) return;
    const drag = this.drag;
    this.setPointer(event);
    drag.x = event.clientX; drag.y = event.clientY;
    if (event.pointerType === 'touch') { Input.setDevice('touch'); drag.touches++; drag.look = drag.touches >= 2; return; }
    Input.setDevice('kbm');
    if (event.button === 2) { drag.look = true; return; }
    if (event.button === 0) { this.updateCursor(); this.command('primary'); }
  },
  onPointerMove(event) {
    const drag = this.drag;
    if (this.onCanvas(event) || drag.look) this.setPointer(event);
    if (drag.look) {
      this.camera.yaw -= (event.clientX - drag.x) * FORGE_MOUSE_LOOK;
      this.camera.pitch = clamp(this.camera.pitch - (event.clientY - drag.y) * FORGE_MOUSE_LOOK, -FORGE_PITCH_LIMIT, FORGE_PITCH_LIMIT);
    }
    drag.x = event.clientX; drag.y = event.clientY;
  },
  onPointerUp(event) {
    const drag = this.drag;
    if (event.pointerType === 'touch') { drag.touches = Math.max(0, drag.touches - 1); drag.look = drag.touches >= 2; return; }
    if (event.button === 2) drag.look = false;
  },
  onWheel(event) {
    if (!this.onCanvas(event)) return;
    event.preventDefault();
    this.command(event.shiftKey ? (event.deltaY < 0 ? 'levelUp' : 'levelDown') : 'rotate');
  },
  // Gamepad, read straight from the pad: sticks fly and look, the buttons are commands (FORGE_PAD_COMMANDS). The menu events are swallowed by the screen.
  readPad(seconds) {
    const pad = this.pad;
    pad.forward = pad.strafe = pad.rise = pad.turn = pad.look = 0;
    if (!PadInput.connected) return;
    const state = PadInput.activePad();
    if (!state) return;
    const stick = (value) => (Math.abs(value || 0) < FORGE_PAD_DEADZONE ? 0 : value);
    const trigger = (button) => (state.buttons[button] ? state.buttons[button].value : 0);
    pad.forward = -stick(state.axes[1]); pad.strafe = stick(state.axes[0]);
    pad.turn = -stick(state.axes[2]); pad.look = stick(state.axes[3]);
    pad.rise = trigger(7) - trigger(6);
    if (pad.forward || pad.strafe || pad.turn || pad.look || pad.rise) { Input.setDevice('gamepad'); this.pointer.centre = true; }
    this.padButtons(state);
  },
  padButtons(state) {
    const previous = this.pad.previous;
    for (let button = 0; button < FORGE_PAD_BUTTONS; button++) {
      const down = state.buttons[button] ? (state.buttons[button].pressed ? 1 : 0) : 0;
      const pressed = down === 1 && previous[button] === 0;
      previous[button] = down;
      if (pressed && FORGE_PAD_COMMANDS[button]) { Input.setDevice('gamepad'); this.pointer.centre = true; this.command(FORGE_PAD_COMMANDS[button]); }
    }
  },

  // ---- Drawing (Render.addSource) ----
  draw(batch) {
    if (!this.active) return;
    this.drawGrid(batch);
    this.drawMap(batch);
    this.drawHighlights(batch);
    this.drawGhost(batch);
  },
  drawBox(batch, box, rgb, emissive) {
    batch.mesh('box', (box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2, 0, 0, box[3] - box[0], box[4] - box[1], box[5] - box[2], rgb[0], rgb[1], rgb[2], emissive);
  },
  // The 12 edges of a box as thin bars: the outline of a selection, a zone or a trigger volume.
  drawEdges(batch, box, thickness, rgb, emissive) {
    const cx = (box[0] + box[3]) / 2, cy = (box[1] + box[4]) / 2, cz = (box[2] + box[5]) / 2, sx = box[3] - box[0], sy = box[4] - box[1], sz = box[5] - box[2];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const x = i ? box[3] : box[0], y = i ? box[4] : box[1], z = j ? box[5] : box[2], other = j ? box[4] : box[1], side = j ? box[3] : box[0];
        batch.mesh('box', cx, y, z, 0, 0, sx, thickness, thickness, rgb[0], rgb[1], rgb[2], emissive);
        batch.mesh('box', x, cy, z, 0, 0, thickness, sy, thickness, rgb[0], rgb[1], rgb[2], emissive);
        batch.mesh('box', side, other, cz, 0, 0, thickness, thickness, sz, rgb[0], rgb[1], rgb[2], emissive);
      }
    }
  },
  drawGrid(batch) {
    const size = Forge.map.size, step = Math.max(this.snap(), 1), level = this.elevation + 0.02, cursor = this.cursor;
    const halfX = size[0] / 2, halfZ = size[2] / 2, line = forgeRgb(FORGE_PALETTE.grid), bounds = forgeRgb(FORGE_PALETTE.bounds);
    batch.mesh('box', 0, level, -halfZ, 0, 0, size[0], FORGE_LINE * 2, FORGE_LINE * 2, bounds[0], bounds[1], bounds[2], 0.8);
    batch.mesh('box', 0, level, halfZ, 0, 0, size[0], FORGE_LINE * 2, FORGE_LINE * 2, bounds[0], bounds[1], bounds[2], 0.8);
    batch.mesh('box', -halfX, level, 0, 0, 0, FORGE_LINE * 2, FORGE_LINE * 2, size[2], bounds[0], bounds[1], bounds[2], 0.8);
    batch.mesh('box', halfX, level, 0, 0, 0, FORGE_LINE * 2, FORGE_LINE * 2, size[2], bounds[0], bounds[1], bounds[2], 0.8);
    if (!cursor.valid) return;
    const centreX = Math.round(cursor.x / step) * step, centreZ = Math.round(cursor.z / step) * step, y = cursor.y + 0.02, length = FORGE_GRID_RADIUS * 2;
    for (let offset = -FORGE_GRID_RADIUS; offset <= FORGE_GRID_RADIUS; offset += step) {
      batch.mesh('box', centreX + offset, y, centreZ, 0, 0, FORGE_LINE, FORGE_LINE, length, line[0], line[1], line[2], 0.5);
      batch.mesh('box', centreX, y, centreZ + offset, 0, 0, length, FORGE_LINE, FORGE_LINE, line[0], line[1], line[2], 0.5);
    }
  },
  drawMap(batch) {
    const map = Forge.map, box = this.box;
    for (let i = 0; i < map.brushes.length; i++) this.drawBrush(batch, map.brushes[i], 0, 0, 0, forgeMaterialRgb(map.brushes[i].material), 0);
    for (let i = 0; i < map.spawns.length; i++) this.drawSpawn(batch, map.spawns[i], 0, 0, 0, forgeRgb(FORGE_PALETTE.team[map.spawns[i].team]), 0);
    for (let i = 0; i < map.items.length; i++) this.drawItem(batch, map.items[i], 0, 0, 0, 0);
    for (let i = 0; i < map.objectives.length; i++) this.drawObjective(batch, map.objectives[i], 0, 0, 0, 0);
    for (let i = 0; i < map.lights.length; i++) this.drawLight(batch, map.lights[i], 0, 0, 0);
    for (let i = 0; i < map.navHints.length; i++) this.drawHint(batch, map.navHints[i], 0, 0, 0);
    if (this.view.triggers) for (let i = 0; i < map.triggers.length; i++) this.drawTrigger(batch, map.triggers[i], box);
    if (this.view.zones) for (let i = 0; i < map.zones.length; i++) this.drawEdges(batch, Forge.bounds('zones', map.zones[i], box), FORGE_EDGE_ZONE, forgeRgb(FORGE_PALETTE.zone), 0.4);
  },
  drawBrush(batch, brush, dx, dy, dz, rgb, emissive) {
    const min = brush.min, max = brush.max, sx = max[0] - min[0], sy = max[1] - min[1], sz = max[2] - min[2];
    const cx = (min[0] + max[0]) / 2 + dx, cy = (min[1] + max[1]) / 2 + dy, cz = (min[2] + max[2]) / 2 + dz;
    if (brush.shape !== 'ramp') { batch.mesh('box', cx, cy, cz, 0, 0, sx, sy, sz, rgb[0], rgb[1], rgb[2], emissive); return; }
    const alongX = brush.dir === '+x' || brush.dir === '-x';
    batch.mesh('wedge', cx, cy, cz, FORGE_RAMP_YAW[brush.dir], 0, alongX ? sz : sx, sy, alongX ? sx : sz, rgb[0], rgb[1], rgb[2], emissive);
  },
  drawSpawn(batch, spawn, dx, dy, dz, rgb, emissive) {
    const yaw = spawn.yaw * DEG;
    batch.mesh('capsule', spawn.x + dx, spawn.y + dy + 0.9, spawn.z + dz, 0, 0, 0.7, 1.8, 0.7, rgb[0], rgb[1], rgb[2], emissive);
    batch.mesh('cone', spawn.x + dx + Math.sin(yaw) * 0.8, spawn.y + dy + 1.1, spawn.z + dz + Math.cos(yaw) * 0.8, yaw, -Math.PI / 2, 0.35, 0.6, 0.35, 1, 1, 1, 0.6);
  },
  drawItem(batch, item, dx, dy, dz, emissive) {
    const rgb = forgeRgb(FORGE_PALETTE.group[item.group] || FORGE_PALETTE.ghost);
    batch.mesh('cylinder', item.x + dx, item.y + dy + 0.05, item.z + dz, 0, 0, 0.9, 0.1, 0.9, rgb[0], rgb[1], rgb[2], emissive);
    batch.mesh('sphere', item.x + dx, item.y + dy + 0.6, item.z + dz, 0, 0, 0.5, 0.5, 0.5, rgb[0], rgb[1], rgb[2], 0.5 + emissive);
  },
  drawObjective(batch, objective, dx, dy, dz, emissive) {
    const rgb = forgeRgb(FORGE_PALETTE.objective[objective.kind] || FORGE_PALETTE.ghost), diameter = objective.radius * 2;
    batch.mesh('ring', objective.x + dx, objective.y + dy + 0.15, objective.z + dz, 0, 0, diameter, 0.3, diameter, rgb[0], rgb[1], rgb[2], 0.6 + emissive);
    batch.mesh('cylinder', objective.x + dx, objective.y + dy + 1.5, objective.z + dz, 0, 0, 0.25, 3, 0.25, rgb[0], rgb[1], rgb[2], 0.6 + emissive);
    const path = objective.path || FORGE_NO_POINTS;
    for (let i = 0; i < path.length; i++) batch.mesh('sphere', path[i][0] + dx, path[i][1] + dy + 0.4, path[i][2] + dz, 0, 0, 0.6, 0.6, 0.6, rgb[0], rgb[1], rgb[2], 0.8);
  },
  drawLight(batch, light, dx, dy, dz) {
    const rgb = forgeRgb(light.color);
    batch.mesh('sphere', light.x + dx, light.y + dy, light.z + dz, 0, 0, 0.5, 0.5, 0.5, rgb[0], rgb[1], rgb[2], 1);
  },
  drawHint(batch, hint, dx, dy, dz) {
    const rgb = forgeRgb(FORGE_PALETTE.hint[hint.kind] || FORGE_PALETTE.ghost);
    batch.mesh('cone', hint.x + dx, hint.y + dy + 0.3, hint.z + dz, 0, 0, 0.4, 0.6, 0.4, rgb[0], rgb[1], rgb[2], 0.5);
  },
  drawTrigger(batch, trigger, box) {
    const rgb = forgeRgb(FORGE_PALETTE.trigger[trigger.kind] || FORGE_PALETTE.ghost);
    this.drawEdges(batch, Forge.bounds('triggers', trigger, box), FORGE_EDGE_ZONE, rgb, 0.7);
    const far = trigger.target || trigger.exit;
    if (far) batch.mesh('sphere', far[0], far[1] + 0.4, far[2], 0, 0, 0.7, 0.7, 0.7, rgb[0], rgb[1], rgb[2], 0.9);
  },
  drawHighlights(batch) {
    const hover = this.hover, selection = Forge.selection, box = this.box, grab = this.grab;
    const hovered = hover.list ? Forge.map[hover.list][hover.index] : null;
    if (hovered && !(hover.list === selection.list && hover.index === selection.index)) {
      this.drawEdges(batch, Forge.bounds(hover.list, hovered, box), FORGE_EDGE_HOVER, forgeRgb(FORGE_PALETTE.hover), 0.7);
    }
    const object = Forge.selected();
    if (!object) return;
    Forge.bounds(selection.list, object, box);
    if (grab.active) { box[0] += grab.dx; box[3] += grab.dx; box[1] += grab.dy; box[4] += grab.dy; box[2] += grab.dz; box[5] += grab.dz; this.drawGrabbed(batch, selection.list, object); }
    this.drawEdges(batch, box, FORGE_EDGE_SELECTED, forgeRgb(FORGE_PALETTE.selected), 1);
  },
  drawGrabbed(batch, list, object) {
    const grab = this.grab, ghost = forgeRgb(FORGE_PALETTE.ghost);
    if (list === 'brushes') this.drawBrush(batch, object, grab.dx, grab.dy, grab.dz, ghost, 0.6);
    else if (list === 'spawns') this.drawSpawn(batch, object, grab.dx, grab.dy, grab.dz, ghost, 0.6);
    else if (list === 'items') this.drawItem(batch, object, grab.dx, grab.dy, grab.dz, 0.6);
    else if (list === 'objectives') this.drawObjective(batch, object, grab.dx, grab.dy, grab.dz, 0.6);
    else if (list === 'lights') this.drawLight(batch, object, grab.dx, grab.dy, grab.dz);
    else if (list === 'navHints') this.drawHint(batch, object, grab.dx, grab.dy, grab.dz);
  },
  // What a click would place, plus the cursor mark on the surface.
  drawGhost(batch) {
    const cursor = this.cursor, tool = this.toolRow();
    if (!cursor.valid) return;
    const mark = forgeRgb(FORGE_PALETTE.cursor), size = this.snap();
    batch.mesh('ring', cursor.x, cursor.y + 0.04, cursor.z, 0, 0, size * 1.2, 0.2, size * 1.2, mark[0], mark[1], mark[2], 1);
    if (!tool.list || this.grab.active) return;
    if (!tool.size) { this.drawGhostPoint(batch, tool); return; }
    const box = this.layout(tool);
    if (tool.id === 'box') this.drawBox(batch, box, forgeMaterialRgb(this.stamp.material), 0.35);
    else if (tool.id === 'ramp') this.drawGhostRamp(batch, box);
    else this.drawEdges(batch, box, FORGE_EDGE_ZONE, forgeRgb(FORGE_PALETTE.ghost), 1);
  },
  drawGhostRamp(batch, box) {
    const brush = this.rampScratch;
    for (let i = 0; i < 3; i++) { brush.min[i] = box[i]; brush.max[i] = box[i + 3]; }
    brush.dir = FORGE_RAMP_DIRS[this.turns];
    this.drawBrush(batch, brush, 0, 0, 0, forgeMaterialRgb(this.stamp.material), 0.35);
  },
  drawGhostPoint(batch, tool) {
    const cursor = this.cursor, stamp = this.stamp, scratch = this.pointScratch;
    scratch.x = cursor.x; scratch.y = cursor.y; scratch.z = cursor.z;
    if (tool.id === 'spawn') { scratch.yaw = this.turns * 90; this.drawSpawn(batch, scratch, 0, 0, 0, forgeRgb(FORGE_PALETTE.team[stamp.team]), 0.5); return; }
    if (tool.id === 'item') { scratch.group = MapRules.groupOf(stamp.itemKey); this.drawItem(batch, scratch, 0, 0, 0, 0.5); return; }
    if (tool.id === 'objective') { scratch.kind = stamp.objectiveKind; this.drawObjective(batch, scratch, 0, 0, 0, 0.5); return; }
    if (tool.id === 'light') { scratch.y = cursor.y + 3; scratch.color = FORGE_LIGHT_COLOR; this.drawLight(batch, scratch, 0, 0, 0); return; }
    scratch.kind = stamp.hintKind;
    this.drawHint(batch, scratch, 0, 0, 0);
  },

  // ---- Test-play (MAP-014): start a match on the edited map; the editor returns when it stops ----
  // Modes the match can be played in: the objectives they need exist on the map and a spawn per side.
  playableModes() {
    return Forge.feasibleModes(Forge.toMap(), false).filter((mode) => Modes.isPlayable(mode));
  },
  testPlay(modeId) {
    const map = Forge.toMap();
    if (!this.playableModes().includes(modeId)) return Forge.refuse('This map has no objectives or spawns for that mode.') >= 0;
    const draft = CustomMatch.validate({ mode: modeId }).draft;
    const setup = CustomMatch.setup(draft, Math.floor(performance.now()) % FORGE_PLAY_SEED_RANGE);
    setup.map = map;
    this.returning = true;
    this.playMode = modeId;
    Ui.closeAll();
    this.detach();
    Game.start(setup);
    return true;
  },
  // 'match.stop': the editor comes back with its state as it was (the model never left memory).
  afterPlay() {
    if (!this.returning) return;
    this.returning = false;
    if (Game.headless) { this.attach(); return; }
    Ui.open('forge');
  },
};
const FORGE_REPEATING = ['undo', 'redo', 'levelUp', 'levelDown', 'nudgeForward', 'nudgeBack', 'nudgeLeft', 'nudgeRight'];

const FORGE_COMMANDS = {
  primary(tools) {
    if (tools.grab.active) return tools.dropGrab();
    if (tools.tool === 'select') return tools.selectHover();
    return tools.place() >= 0;
  },
  secondary(tools) {
    if (tools.grab.active) { tools.grab.active = false; return true; }
    return tools.deleteTarget();
  },
  rotate(tools) { return Forge.selected() && !tools.grab.active && tools.tool === 'select' ? Forge.turnSelected() : tools.turnStamp(); },
  grab(tools) {
    if (tools.grab.active) return tools.dropGrab();
    return tools.startGrab();
  },
  duplicate() { return Forge.duplicateSelected(ForgeTools.snap() * 2) >= 0; },
  undo() { return Forge.undo(); },
  redo() { return Forge.redo(); },
  snap(tools) { tools.snapIndex = (tools.snapIndex + 1) % FORGE_SNAPS.length; Forge.announce('tool'); return true; },
  optionPrev(tools) { return tools.cycleOption(-1, 0); },
  optionNext(tools) { return tools.cycleOption(1, 0); },
  toolPrev(tools) { return tools.cycleTool(-1); },
  toolNext(tools) { return tools.cycleTool(1); },
  levelUp(tools) { return tools.setLevel(tools.elevation + tools.snap()); },
  levelDown(tools) { return tools.setLevel(tools.elevation - tools.snap()); },
  toggleZones(tools) { tools.view.zones = !tools.view.zones; Forge.announce('tool'); return true; },
  nudgeForward(tools) { return tools.nudge(0, 1); },
  nudgeBack(tools) { return tools.nudge(0, -1); },
  nudgeLeft(tools) { return tools.nudge(-1, 0); },
  nudgeRight(tools) { return tools.nudge(1, 0); },
  menu(tools) { if (tools.menuRequest) tools.menuRequest(); return true; },
  cancel(tools) {
    if (tools.grab.active) { tools.grab.active = false; return true; }
    if (Forge.selected()) { Forge.clearSelection(); return true; }
    return false;
  },
};

// Stamp sizes start from the tool rows; one fresh array per tool.
for (const tool of FORGE_TOOLS) if (tool.size) ForgeTools.stamp.sizes[tool.id] = tool.size.slice();
ForgeTools.cameraHook = (camera) => ForgeTools.placeCamera(camera);

Render.addSource('forge', (batch) => ForgeTools.draw(batch));
Bus.on('boot', () => Loop.onFrame('input', (seconds) => ForgeTools.frame(seconds)));   // the loop is a later section: it exists by 'boot'
Bus.on('forge.changed', (change) => ForgeTools.onModelChange(change.what));
