/* ---------------- RNG ---------------- */
// mulberry32: small, fast, seedable. A seeded run replays the same piece sequence exactly.
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let current = Math.random;
export function rng() { return current(); }
export function setSeed(seed) { current = mulberry32(seed); }
export const randInt = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
