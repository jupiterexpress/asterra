import * as THREE from 'three';
import { CFG } from './config.js';
import { outsideDir } from './world.js';
import { scene } from './scene.js';

/* FX */
export const fx = [];
const ringGeo = new THREE.RingGeometry(0.42, 0.56, 40);
export function dustRing(x, y, z, color) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.02, z); scene.add(m);
  fx.push({ t: 0, dur: 0.4, update(k) { const s = 1 + k * 2.6; m.scale.set(s, s, s); m.material.opacity = 0.7 * (1 - k); }, done() { scene.remove(m); m.material.dispose(); } });
}
export function flash(mat, color) {
  fx.push({ t: 0, dur: 0.45, update(k) { mat.emissive.setHex(color); mat.emissiveIntensity = 0.55 * (1 - k); }, done() { mat.emissiveIntensity = 0; } });
}


// a thin sheet of light sweeps along each plate edge that did the cutting
const sliceMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
export function sliceFx(cells, x, land, z) {
  const sides = new Map();
  for (const c of cells) {
    const d = outsideDir(x + c[0], z + c[2]), k = d.dx + ',' + d.dz;
    const along = d.dx ? z + c[2] : x + c[0], y = land + c[1];
    const e = sides.get(k) || { d, a0: Infinity, a1: -Infinity, y0: Infinity, y1: -Infinity };
    e.a0 = Math.min(e.a0, along); e.a1 = Math.max(e.a1, along); e.y0 = Math.min(e.y0, y); e.y1 = Math.max(e.y1, y);
    sides.set(k, e);
  }
  for (const e of sides.values()) {
    const len = e.a1 - e.a0 + 1.3, h = e.y1 - e.y0 + 1.3, mid = (e.a0 + e.a1) / 2, ym = (e.y0 + e.y1) / 2 + 0.5;
    const mat = sliceMat.clone();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    if (e.d.dx) { m.rotation.y = Math.PI / 2; m.position.set(e.d.edge, ym, 0); }
    else m.position.set(0, ym, e.d.edge);
    scene.add(m);
    const dur = Math.max(0.05, CFG.buildArea.slice);
    fx.push({ t: 0, dur: dur + 0.25, update(k) {
      const tt = k * (dur + 0.25), sweep = Math.min(1, tt / dur), fade = tt < dur ? 1 : 1 - (tt - dur) / 0.25;
      const l = Math.max(0.01, len * sweep), start = mid - len / 2;
      m.scale.set(l, h, 1);
      if (e.d.dx) m.position.z = start + l / 2; else m.position.x = start + l / 2;
      mat.opacity = 0.55 * fade;
    }, done() { scene.remove(m); m.geometry.dispose(); mat.dispose(); } });
  }
}


export function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt; const k = Math.min(1, f.t / f.dur); f.update(k);
    if (k >= 1) { f.done(); fx.splice(i, 1); }
  }
}


// a piece that will never be played shrinks away in place
export function vanish(p) {
  const root = p.root, mat = p.mat, s0 = root.scale.x;
  fx.push({ t: 0, dur: 0.25, update(k) { root.scale.setScalar(Math.max(0.001, s0 * (1 - k))); },
    done() { scene.remove(root); mat.dispose(); } });
}
