import { CFG } from './config.js';
import { DIRS } from './poly.js';

/* =====================================================================
   WORLD — voxel occupancy. Baseplate cells sit at y = -1.
   ===================================================================== */
export const World = {
  occ: new Map(), colTop: new Map(), bounds: null,
  reset() {
    this.occ.clear(); this.colTop.clear();
    this.bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, topY: -Infinity };
    for (const [x,z] of footprint()) this.add(x, -1, z, 'base');
  },
  add(x, y, z, id) {
    this.occ.set(x + ',' + y + ',' + z, id);
    const ck = x + ',' + z; const t = this.colTop.get(ck);
    if (t === undefined || y > t) this.colTop.set(ck, y);
    const b = this.bounds;
    b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x);
    b.minZ = Math.min(b.minZ, z); b.maxZ = Math.max(b.maxZ, z);
    b.topY = Math.max(b.topY, y);
  },
  has(x, y, z) { return this.occ.has(x + ',' + y + ',' + z); },
  top(x, z) { return this.colTop.get(x + ',' + z); },
};
export function baseRect() {
  const w = Math.max(1, CFG.baseplate.w | 0), d = Math.max(1, CFG.baseplate.d | 0);
  return { w, d, x0: -Math.floor(w / 2), z0: -Math.floor(d / 2) };
}
export function footprint() {
  if (CFG.baseplate.cells) return CFG.baseplate.cells;
  const { x0,z0,w,d } = baseRect(), cells = [];
  for (let x=0; x<w; x++) for (let z=0; z<d; z++) cells.push([x0+x,z0+z]);
  return cells;
}


/* =====================================================================
   BUILD AREA — the baseplate footprint. At placement, cubes outside it are cut off;
   whatever is left drops and settles wherever physics puts it.
   ===================================================================== */
export const Area = {
  inside(x, z) {
    if (!CFG.buildArea.trim) return true;
    if (CFG.baseplate.cells) return CFG.baseplate.cells.some(c => c[0] === x && c[1] === z);
    const r = baseRect();
    return x >= r.x0 && x < r.x0 + r.w && z >= r.z0 && z < r.z0 + r.d;
  },
  // returns kept cubes grouped into connected pieces, plus the indices that get cut
  split(cells, x, z) {
    const keep = [], cut = [];
    cells.forEach((c, i) => (this.inside(x + c[0], z + c[2]) ? keep : cut).push(i));
    const byKey = new Map(keep.map(i => [cells[i].join(), i]));
    const left = new Set(keep), comps = [];
    while (left.size) {
      const start = left.values().next().value, comp = [start]; left.delete(start);
      for (let q = 0; q < comp.length; q++) {
        const c = cells[comp[q]];
        for (const d of DIRS) {
          const j = byKey.get([c[0] + d[0], c[1] + d[1], c[2] + d[2]].join());
          if (j !== undefined && left.has(j)) { left.delete(j); comp.push(j); }
        }
      }
      comps.push(comp);
    }
    return { comps, cut };
  },
};


// which side of the baseplate a column is outside of (largest overshoot wins)
export function outsideDir(x, z) {
  const r = baseRect(), ox = x < r.x0 ? x - r.x0 : x >= r.x0 + r.w ? x - (r.x0 + r.w - 1) : 0;
  const oz = z < r.z0 ? z - r.z0 : z >= r.z0 + r.d ? z - (r.z0 + r.d - 1) : 0;
  if (Math.abs(ox) >= Math.abs(oz) && ox !== 0) return { dx: Math.sign(ox), dz: 0, edge: ox > 0 ? r.x0 + r.w - 0.5 : r.x0 - 0.5 };
  return { dx: 0, dz: Math.sign(oz), edge: oz > 0 ? r.z0 + r.d - 0.5 : r.z0 - 0.5 };
}
