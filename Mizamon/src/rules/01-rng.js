// ---- Seeded random numbers (mulberry32) --------------------------------------
function makeRng(seed) {
  let state = seed >>> 0;
  const next = function () {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.getState = function () { return state; };
  next.setState = function (value) { state = value >>> 0; };
  return next;
}
function randInt(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }
function pickOne(rng, list) { return list[Math.floor(rng() * list.length)]; }
function pickWeighted(rng, entries) {
  let total = 0;
  for (const entry of entries) total += entry.w;
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry.w;
    if (roll < 0) return entry;
  }
  return entries[entries.length - 1];
}
function hashString(text) { // FNV-1a, used for test checksums
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

