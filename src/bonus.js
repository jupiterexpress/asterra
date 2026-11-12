import * as THREE from 'three';
import { S } from './state.js';
import { World, Area, footprint } from './world.js';
import { scene, camera, canvas, makeCube, lin } from './scene.js';
import { dustRing, flash } from './fx.js';
import { AudioFX } from './audio.js';
import { Cam } from './camera.js';

/* =====================================================================
   ADD 1×1 BLOCK — powerup. Aim a single cube at any column of the current construction area;
   it fills the lowest empty, supported cell there (so it can plug a gap under an overhang).
   Aim with the mouse or arrow keys / WASD; DROP or Space places it; Esc cancels and keeps the powerup.
   ===================================================================== */
const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffc35a, transparent: true, opacity: 0.6, depthWrite: false, depthTest: false });
const cursorLine = new THREE.LineBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 1, depthTest: false });
const cursor = new THREE.Group();
const cursorBox = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.98, 0.98), cursorMat);
cursorBox.add(new THREE.LineSegments(new THREE.EdgesGeometry(cursorBox.geometry), cursorLine));
const column = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.55, depthWrite: false, depthTest: false }));
column.rotation.x = -Math.PI / 2;
// drawn on top of the build so the aim point is never hidden behind blocks
cursorBox.renderOrder = 10; cursorBox.children[0].renderOrder = 11; column.renderOrder = 10;
cursor.add(cursorBox, column); cursor.visible = false; scene.add(cursor);

const ray = new THREE.Raycaster(), box = new THREE.Box3(), hit = new THREE.Vector3();
const columns = () => footprint().filter(([x, z]) => Area.inside(x, z));
// lowest empty cell in the column that has something directly beneath it (block or plate)
export function targetY(x, z) {
  const top = World.top(x, z) ?? -1;
  for (let y = 0; y <= top + 1; y++) if (!World.has(x, y, z) && World.has(x, y - 1, z)) return y;
  return top + 1;
}

export const Bonus = {
  x: 0, z: 0, api: null,
  init(api) {
    this.api = api;
    canvas.addEventListener('pointermove', e => { if (S.active.block && !Cam.pointers.size) this.hover(e.clientX, e.clientY); });
  },
  start() {
    const cols = columns(); if (!cols.length) return false;
    // start over the middle of the plot
    let cx = 0, cz = 0; for (const [x, z] of cols) { cx += x; cz += z; } cx /= cols.length; cz /= cols.length;
    const [x, z] = cols.reduce((b, c) => Math.hypot(c[0] - cx, c[1] - cz) < Math.hypot(b[0] - cx, b[1] - cz) ? c : b);
    this.x = x; this.z = z;
    S.active.block = true; S.queuedDrop = false;
    this.place(); cursor.visible = true;
    return true;
  },
  cancel(silent) {
    if (!S.active.block) return;
    S.active.block = false; cursor.visible = false;
    if (!silent) this.api?.changed();
  },
  place() {
    const y = targetY(this.x, this.z);
    cursorBox.position.set(this.x, y + 0.5, this.z);
    column.position.set(this.x, (World.top(this.x, this.z) ?? -1) + 1.01, this.z);
    column.visible = y !== (World.top(this.x, this.z) ?? -1) + 1;   // marks the column when the block will tuck underneath
  },
  // arrow keys / WASD move relative to the camera, snapped to the grid
  move(right, away) {
    if (!S.active.block) return;
    const f = Cam.forwardAxis(), r = new THREE.Vector3(-f.z, 0, f.x);
    const dx = Math.round(r.x * right + f.x * away), dz = Math.round(r.z * right + f.z * away);
    const nx = this.x + dx, nz = this.z + dz;
    if (!columns().some(([x, z]) => x === nx && z === nz)) { AudioFX.tone(220, 0.05, 'triangle', 0.04); return; }
    this.x = nx; this.z = nz; this.place(); AudioFX.tick();
  },
  hover(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera({ x: ((clientX - rect.left) / rect.width) * 2 - 1, y: -((clientY - rect.top) / rect.height) * 2 + 1 }, camera);
    let best = null, bestD = Infinity;
    for (const [x, z] of columns()) {                // nearest column whose stack (or landing cell) the pointer is over
      const top = Math.max(targetY(x, z), (World.top(x, z) ?? -1) + 1);
      box.min.set(x - 0.5, -0.4, z - 0.5); box.max.set(x + 0.5, top + 1, z + 0.5);
      if (ray.ray.intersectBox(box, hit)) { const d = hit.distanceTo(ray.ray.origin); if (d < bestD) { bestD = d; best = [x, z]; } }
    }
    if (best && (best[0] !== this.x || best[1] !== this.z)) { this.x = best[0]; this.z = best[1]; this.place(); }
  },
  confirm() {
    if (!S.active.block || S.pending > 0) return false;
    const x = this.x, z = this.z, y = targetY(x, z);
    const mat = new THREE.MeshStandardMaterial({ color: lin(0xe9c48a), roughness: 0.62, metalness: 0.04, emissive: 0x000000 });
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const m = makeCube(mat); body.add(m);
    root.position.set(x, y + 0.5, z); scene.add(root);
    const id = S.pieces.length;
    World.add(x, y, z, id);
    const bx = S.box; S.cubes++;
    bx.minX = Math.min(bx.minX, x); bx.maxX = Math.max(bx.maxX, x); bx.minY = Math.min(bx.minY, y); bx.maxY = Math.max(bx.maxY, y);
    bx.minZ = Math.min(bx.minZ, z); bx.maxZ = Math.max(bx.maxZ, z);
    S.pieces.push({ cells: [[0, 0, 0]], meshes: [m], color: 0xe9c48a, mat, root, body, bonus: true });
    dustRing(x, y, z, 0xfff1c2); flash(mat, 0xfff1c2); AudioFX.thunk(); AudioFX.perfect();
    S.active.block = false; cursor.visible = false;
    this.api?.placed();
    return true;
  },
  update(t) { cursorMat.opacity = 0.45 + 0.2 * Math.sin(t * 6); },
};
