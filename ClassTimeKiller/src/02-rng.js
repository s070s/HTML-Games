// ==== S02 RNG ====
// Seeded generators (sfc32) with separate streams so one system's draws never shift another's (ARC-012).
// Sim code must use these streams, never Math.random (cosmetic-only code uses Rng.fx).

function hashString(text) { // 32-bit FNV-1a, used to turn seeds and names into stream seeds
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return hash >>> 0;
}

// Match and map seeds are whole numbers below SEED_RANGE; newSeed draws a fresh one (random: a 0..1 source, Math.random by default).
const SEED_RANGE = 0x7fffffff;
function newSeed(random) { return Math.floor((random || Math.random)() * SEED_RANGE); }

function makeRandom(seed) {
  // The four state words live in an Int32Array: as closure variables, words above 2^31 would be boxed on the heap on
  // every draw (PERF-006). Same bits as unsigned words, so every seed gives the same numbers as before.
  const state = new Int32Array([0x9e3779b9, 0x243f6a88, 0xb7e15162, seed]);
  const next = () => { // sfc32: returns 0..1
    const a = state[0], b = state[1], c = state[2], d = state[3];
    const t = (a + b | 0) + d | 0;
    state[3] = d + 1 | 0;
    state[0] = b ^ b >>> 9;
    state[1] = c + (c << 3) | 0;
    state[2] = (c << 21 | c >>> 11) + t | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next(); // warm up so close seeds diverge
  return {
    next,
    range: (low, high) => low + (high - low) * next(),
    fill: (array, count) => { for (let i = 0; i < count; i++) array[i] = next(); },   // count draws into array[0..count): no number is returned, so none is boxed (PERF-006)
    int: (low, highInclusive) => low + Math.floor(next() * (highInclusive - low + 1)),
    chance: (probability) => next() < probability,
    pick: (list) => list[Math.floor(next() * list.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
    gauss: () => { // approximate normal (mean 0, sd 1) from 4 uniforms; no allocation
      return (next() + next() + next() + next() - 2) * 1.7320508;
    },
    shuffle: (list) => {
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const keep = list[i]; list[i] = list[j]; list[j] = keep; }
      return list;
    },
  };
}

const RNG_STREAMS = ['map', 'loot', 'bots', 'rules', 'fx', 'weapons', 'pve'];
const Rng = {
  seed: 1,
  // Re-seeds every stream from one match seed; called by Game.start and __CTK.seed(n).
  reseed(seed) {
    this.seed = seed >>> 0;
    for (const name of RNG_STREAMS) this[name] = makeRandom(hashString(name + ':' + this.seed));
  },
};
Rng.reseed(1);
Bus.on('match.setup', (match) => Rng.reseed(match.setup.seed === undefined ? 1 : match.setup.seed));
