// ==== S02 RNG ====
// Seeded generators (sfc32) with separate streams so one system's draws never shift another's (ARC-012).
// Sim code must use these streams, never Math.random (cosmetic-only code uses Rng.fx).

function hashString(text) { // 32-bit FNV-1a, used to turn seeds and names into stream seeds
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return hash >>> 0;
}

function makeRandom(seed) {
  let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = seed >>> 0;
  const next = () => { // sfc32: returns 0..1
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next(); // warm up so close seeds diverge
  return {
    next,
    range: (low, high) => low + (high - low) * next(),
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
