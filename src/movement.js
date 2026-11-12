import * as THREE from 'three';
import { CFG } from './config.js';
import { rng } from './rng.js';
import { World } from './world.js';

/* =====================================================================
   MOVEMENT — swappable. Ping-pong across the current construction area.
   Knows nothing about the camera.
   ===================================================================== */
export const Movement = {
  axisFlip: 0,
  // every built column, grouped into travel lines: lines(axis).get(cross) = [positions along axis]
  lines(axis) {
    const out = new Map();
    for (const k of World.colTop.keys()) {
      const [x, z] = k.split(',').map(Number);
      const cross = axis === 'x' ? z : x, along = axis === 'x' ? x : z;
      if (!out.has(cross)) out.set(cross, []);
      out.get(cross).push(along);
    }
    return out;
  },
  // travel range = the built extent of this one line, plus the outward margin
  range(axis, cross) {
    const m = CFG.move.margin;
    const line = this.lines(axis).get(cross);
    let a, b;
    if (line && line.length) { a = Math.min(...line); b = Math.max(...line); }
    else { const bd = World.bounds; a = axis === 'x' ? bd.minX : bd.minZ; b = axis === 'x' ? bd.maxX : bd.maxZ; }
    return [a - m, b + m];
  },
  // spawn only on lines that cross real surface, weighted by how much surface they cross
  setup(piece) {
    let axis = CFG.move.pattern;
    if (axis === 'alternate') { axis = this.axisFlip ? 'z' : 'x'; this.axisFlip ^= 1; }
    const lines = [...this.lines(axis).entries()];
    const total = lines.reduce((n, [, l]) => n + l.length, 0);
    let r = rng() * total, cross = lines[0][0];
    for (const [c, l] of lines) { r -= l.length; if (r <= 0) { cross = c; break; } }
    piece.axis = axis; piece.cross = cross;
    [piece.lo, piece.hi] = this.range(axis, cross);
    piece.dir = rng() < 0.5 ? 1 : -1;
    piece.t = piece.dir > 0 ? piece.lo : piece.hi;
    piece.nudge = new THREE.Vector2(0, 0);
    piece.turns = 0;
  },
  // swap travel axis at the current position; keeps moving from exactly where it is
  turn(piece) {
    const [x, z] = this.xz(piece);
    if (piece.axis === 'x') {
      piece.axis = 'z'; piece.cross = Math.round(x); piece.t = z; piece.nudge.x += x - piece.cross;
    } else {
      piece.axis = 'x'; piece.cross = Math.round(z); piece.t = x; piece.nudge.y += z - piece.cross;
    }
    [piece.lo, piece.hi] = this.range(piece.axis, piece.cross);
    piece.lo = Math.min(piece.lo, piece.t); piece.hi = Math.max(piece.hi, piece.t);
    piece.dir = piece.t < (piece.lo + piece.hi) / 2 ? 1 : -1;   // head toward the built part of the line
    piece.turns++;
  },
  update(piece, dt) {
    piece.t += piece.dir * CFG.move.speed * (piece.speedMul || 1) * dt;
    if (piece.t > piece.hi) { piece.t = piece.hi - (piece.t - piece.hi); piece.dir = -1; }
    if (piece.t < piece.lo) { piece.t = piece.lo + (piece.lo - piece.t); piece.dir = 1; }
    piece.t = Math.min(piece.hi, Math.max(piece.lo, piece.t));
  },
  xz(piece) { return piece.axis === 'x' ? [piece.t, piece.cross] : [piece.cross, piece.t]; },
  snapped(piece) { const [x, z] = this.xz(piece); return [Math.round(x), Math.round(z)]; },
};
