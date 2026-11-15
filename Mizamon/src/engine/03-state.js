// ---- Game state and options ---------------------------------------------------------------------
let OPT = defaultOptions();
let G = null; // the running game; null on the title screen
const PREVIEW_PLAYER = { gender: 'm', name: 'ΝΙΚΟΣ' };
function newGameState(name, gender, starter) {
  const party = [makeMon(starter, 5)];
  const dexSeen = {};
  const dexGot = {};
  dexSeen[starter] = true;
  dexGot[starter] = true;
  return {
    player: { name: name, gender: gender, map: START_MAP.map, x: START_MAP.x, y: START_MAP.y, dir: START_MAP.dir },
    party: party, archive: [], money: START_MONEY, bag: Object.assign({}, START_BAG), dex: { seen: dexSeen, got: dexGot }, flags: { gotStarter: true }, world: newWorldState(),
    lastHeal: Object.assign({}, DEFAULT_HEAL_SPOT), rng: makeRng(1), starter: starter, steps: 0,
  };
}
// Texts without variables are cached, so drawing code can call T() every frame without allocating.
const textCache = { el: { m: {}, f: {} }, en: { m: {}, f: {} } };
function resetTextCache() {
  for (const lang of ['el', 'en']) { textCache[lang].m = {}; textCache[lang].f = {}; }
}
function T(key, vars) {
  const gender = G ? G.player.gender : PREVIEW_PLAYER.gender;
  const name = G ? G.player.name : PREVIEW_PLAYER.name;
  if (vars === undefined) {
    const bucket = textCache[OPT.lang][gender];
    let cached = bucket[key];
    if (cached === undefined) { cached = formatText(lookupString(key, OPT.lang), { name: name }, gender); bucket[key] = cached; }
    return cached;
  }
  return formatText(lookupString(key, OPT.lang), Object.assign({ name: name }, vars), gender);
}
// With no saved choice, Reduced motion follows the operating system setting; the Options screen can change it.
function systemPrefersReducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (error) { return false; }
}
function loadOptions() {
  let saved = null;
  try { saved = JSON.parse(Store.get(OPTIONS_KEY) || 'null'); } catch (error) { saved = null; }
  OPT = normalizeOptions(saved);
  if (!saved || typeof saved.reduceMotion !== 'boolean') OPT.reduceMotion = systemPrefersReducedMotion();
}
function saveOptions() {
  try { Store.set(OPTIONS_KEY, JSON.stringify(OPT)); } catch (error) { /* ignore */ }
}
function buildSaveObject() {
  return {
    version: SAVE_VERSION, player: Object.assign({}, G.player), party: G.party.map(serializeMon), archive: G.archive.map(serializeMon), money: G.money, bag: Object.assign({}, G.bag),
    dex: { seen: Object.assign({}, G.dex.seen), got: Object.assign({}, G.dex.got) }, flags: Object.assign({}, G.flags), world: JSON.parse(JSON.stringify(G.world)),
    lastHeal: Object.assign({}, G.lastHeal), options: Object.assign({}, OPT), rngState: G.rng.getState(), starter: G.starter,
  };
}
function writeSave() {
  try { return Store.set(SAVE_KEY, JSON.stringify(buildSaveObject())); } catch (error) { return false; }
}
function readSave() {
  try { return migrateSave(JSON.parse(Store.get(SAVE_KEY) || 'null')); } catch (error) { return null; }
}
function gameFromSave(save) {
  const state = {
    player: save.player, party: save.party.map(restoreMon), archive: save.archive.map(restoreMon), money: save.money, bag: save.bag, dex: save.dex, flags: save.flags, world: save.world,
    lastHeal: save.lastHeal, rng: makeRng(1), starter: save.starter, steps: 0,
  };
  state.rng.setState(save.rngState);
  return state;
}

