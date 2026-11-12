import * as THREE from 'three';
import { CFG } from './config.js';
import { rng, randInt } from './rng.js';

/* =====================================================================
   POLYCUBE — shape generation and integer rotation
   ===================================================================== */
export const DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export const Poly = {
  generate() {
    const lo = Math.min(CFG.piece.minCells, CFG.piece.maxCells);
    const hi = Math.max(CFG.piece.minCells, CFG.piece.maxCells);
    const n = randInt(Math.max(1, lo), Math.max(1, hi));
    const cells = [[0,0,0]], seen = new Set(['0,0,0']);
    while (cells.length < n) {
      const c = cells[Math.floor(rng() * cells.length)], d = DIRS[Math.floor(rng() * 6)];
      const k = [c[0]+d[0], c[1]+d[1], c[2]+d[2]], key = k.join();
      if (!seen.has(key)) { seen.add(key); cells.push(k); }
    }
    return Poly.normalize(cells).cells;
  },
  // shift so min y = 0 and the xz centroid sits on the origin cell; returns the shift applied
  normalize(cells) {
    let minY = Infinity, sx = 0, sz = 0;
    for (const c of cells) { minY = Math.min(minY, c[1]); sx += c[0]; sz += c[2]; }
    const s = [Math.round(sx / cells.length), minY, Math.round(sz / cells.length)];
    return { cells: cells.map(c => [c[0]-s[0], c[1]-s[1], c[2]-s[2]]), s };
  },
  rotate(cells, axis, angle) {
    const v = new THREE.Vector3();
    const out = cells.map(c => { v.set(c[0], c[1], c[2]).applyAxisAngle(axis, angle); return [Math.round(v.x), Math.round(v.y), Math.round(v.z)]; });
    return Poly.normalize(out);
  },
};


/* ---------- Orientation: the 24 ways a cube shape can face ----------
   A "resting side" (stance) = which way is down, ignoring spins about the vertical. FLIP steps through a
   shape's resting sides in a fixed order, flattest first; ROTATE spins within a resting side. */
export const ROTS = (() => {
  const out = [new THREE.Quaternion()], seen = new Set(), key = q => {
    const m = new THREE.Matrix4().makeRotationFromQuaternion(q).elements; return m.map(v => Math.round(v)).join(); };
  seen.add(key(out[0]));
  const steps = [new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
                 new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)];
  for (let i = 0; i < out.length; i++) for (const st of steps) {
    const q = st.clone().multiply(out[i]); const k = key(q);
    if (!seen.has(k)) { seen.add(k); out.push(q); }
  }
  return out;   // 24
})();
export function applyRot(q, cells) {
  const v = new THREE.Vector3();
  return Poly.normalize(cells.map(c => { v.set(c[0], c[1], c[2]).applyQuaternion(q); return [Math.round(v.x), Math.round(v.y), Math.round(v.z)]; })).cells;
}
export function shapeKey(cells) {        // position-independent key of an exact orientation
  let mx = Infinity, my = Infinity, mz = Infinity;
  for (const c of cells) { mx = Math.min(mx, c[0]); my = Math.min(my, c[1]); mz = Math.min(mz, c[2]); }
  return cells.map(c => (c[0] - mx) + ',' + (c[1] - my) + ',' + (c[2] - mz)).sort().join('|');
}
export const Y90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
export function stanceKey(cells) {       // same for all four spins about the vertical
  let best = null, q = new THREE.Quaternion();
  for (let k = 0; k < 4; k++) { const kk = shapeKey(applyRot(q, cells)); if (best === null || kk < best) best = kk; q = Y90.clone().multiply(q); }
  return best;
}
// a piece's resting sides, flattest first (lowest height, then widest footprint)
export function stancesOf(base) {
  const map = new Map();
  for (const q of ROTS) {
    const cells = applyRot(q, base), k = stanceKey(cells);
    if (!map.has(k)) {
      let h = 0; const foot = new Set();
      for (const c of cells) { h = Math.max(h, c[1] + 1); foot.add(c[0] + ',' + c[2]); }
      map.set(k, { key: k, h, foot: foot.size, rots: [] });
    }
    map.get(k).rots.push(q);
  }
  return [...map.values()].sort((a, b) => a.h - b.h || b.foot - a.foot || (a.key < b.key ? -1 : 1));
}
export const qAngle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));
