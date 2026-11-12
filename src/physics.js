import * as THREE from 'three';
import { CFG } from './config.js';
import { World } from './world.js';

/* =====================================================================
   PHYSICS — swappable. Grid drop + center-of-mass-over-support test.
   The placed structure is treated as rigid; only the new piece is judged.
   ===================================================================== */
export const Physics = {
  // lowest base y where the piece rests when dropped straight down at (x, z); null = nothing underneath
  findLanding(cells, x, z) {
    let base = -Infinity;
    for (const c of cells) {
      const t = World.top(x + c[0], z + c[2]);
      if (t !== undefined) base = Math.max(base, t + 1 - c[1]);
    }
    return base === -Infinity ? null : base;
  },
  evaluate(cells, x, y, z) {
    const own = new Set(cells.map(c => c.join()));
    const contacts = [], bottoms = [];
    let comX = 0, comZ = 0;
    for (const c of cells) {
      comX += x + c[0]; comZ += z + c[2];
      const facesDown = !own.has([c[0], c[1] - 1, c[2]].join());
      if (!facesDown) continue;
      bottoms.push(c);
      if (World.has(x + c[0], y + c[1] - 1, z + c[2])) contacts.push(c);
    }
    const com = { x: comX / cells.length, z: comZ / cells.length };
    const pts = [];
    for (const c of contacts) {
      const cx = x + c[0], cz = z + c[2];
      pts.push({ x: cx - 0.5, z: cz - 0.5 }, { x: cx + 0.5, z: cz - 0.5 }, { x: cx + 0.5, z: cz + 0.5 }, { x: cx - 0.5, z: cz + 0.5 });
    }
    const hull = Physics.hull(pts);
    const stable = contacts.length > 0 && Physics.inside(com, hull, CFG.physics.tolerance);
    const supportRatio = contacts.length / bottoms.length;
    const perfect = stable && supportRatio >= Math.min(1, CFG.perfect.minSupport) - 1e-9;
    return { stable, perfect, contacts, com, hull, supportRatio, overhang: bottoms.length - contacts.length };
  },
  hull(p) {
    p = p.slice().sort((a, b) => a.x - b.x || a.z - b.z);
    if (p.length < 3) return p;
    const cr = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length-2], lo[lo.length-1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length-2], up[up.length-1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop();
    return lo.concat(up);
  },
  inside(pt, h, tol) {
    if (h.length < 3) return false;
    for (let i = 0; i < h.length; i++) {
      const a = h[i], b = h[(i + 1) % h.length];
      const ex = b.x - a.x, ez = b.z - a.z, len = Math.hypot(ex, ez) || 1;
      if ((ex * (pt.z - a.z) - ez * (pt.x - a.x)) / len < -tol - 1e-6) return false;
    }
    return true;
  },
  // pivot edge and roll direction for a piece that fails the test
  toppleFrame(ev) {
    let cx = 0, cz = 0;
    for (const q of ev.hull) { cx += q.x; cz += q.z; }
    cx /= ev.hull.length || 1; cz /= ev.hull.length || 1;
    let dx = ev.com.x - cx, dz = ev.com.z - cz; const L = Math.hypot(dx, dz);
    if (L < 1e-4) { dx = 1; dz = 0; } else { dx /= L; dz /= L; }
    let best = -Infinity, px = cx, pz = cz;
    for (const q of ev.hull) { const d = q.x * dx + q.z * dz; if (d > best) { best = d; px = q.x; pz = q.z; } }
    return { dir: new THREE.Vector3(dx, 0, dz), pivot: new THREE.Vector3(px, 0, pz), axis: new THREE.Vector3(dz, 0, -dx) };
  },
};
