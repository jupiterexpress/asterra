import * as THREE from 'three';
import { CFG } from './config.js';
import { S } from './state.js';
import { World, Area } from './world.js';
import { Physics } from './physics.js';
import { Movement } from './movement.js';
import { scene, camera, cubeGeo, edgeGeo, lin } from './scene.js';

/* ghost for Landing Shadow */
export const ghost = {
  group: new THREE.Group(), sig: '',
  mat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false }),
  line: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
  cutLine: new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, dashSize: 0.12, gapSize: 0.1 }),
};
ghost.group.visible = false; ghost.group.renderOrder = 2; scene.add(ghost.group);

/* lane: highlights the top faces the piece travels over, plus the path line at hover height */
export const lane = {
  group: new THREE.Group(), key: '',
  tileGeo: new THREE.PlaneGeometry(0.9, 0.9),
  tileMat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.26, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  lineMat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
  line: null,
};
lane.group.visible = false; scene.add(lane.group);
lane.line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lane.lineMat); lane.line.renderOrder = 1; scene.add(lane.line);
lane.line.visible = false;
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _N = new THREE.Vector3(), _M = new THREE.Matrix4();
// flat ribbon along the travel path that turns to face the camera; fades out when viewed down its length
function updatePathLine(p) {
  const L = lane.line;
  if (!p || S.phase !== 'aim' || !CFG.guides.pathLine) { L.visible = false; return; }
  const len = p.hi - p.lo + 1, mid = (p.lo + p.hi) / 2, y = p.hoverY - 0.04;
  const cx = p.axis === 'x' ? mid : p.cross, cz = p.axis === 'x' ? p.cross : mid;
  L.position.set(cx, y, cz);
  _A.set(p.axis === 'x' ? 1 : 0, 0, p.axis === 'x' ? 0 : 1);
  _N.copy(camera.position).sub(L.position);
  const dist = _N.length(); _N.normalize();
  const align = Math.abs(_N.dot(_A));
  _N.addScaledVector(_A, -_N.dot(_A)).normalize();
  _B.crossVectors(_N, _A);
  L.quaternion.setFromRotationMatrix(_M.makeBasis(_A, _B, _N));
  L.scale.set(len, Math.max(0.035, dist * 0.0032), 1);   // roughly constant on-screen thickness
  lane.lineMat.opacity = 0.75 * Math.min(1, Math.max(0, (0.9 - align) / 0.2));
  L.visible = lane.lineMat.opacity > 0.01;
}
export function updateLane(t) {
  const p = S.piece;
  updatePathLine(p);
  if (!p || S.phase !== 'aim') { lane.group.visible = false; return; }
  // the band covers every row the piece's footprint occupies, over the full stretch it can travel
  const ai = p.axis === 'x' ? 0 : 2, ci = p.axis === 'x' ? 2 : 0;
  const crossOffs = [...new Set(p.cells.map(c => c[ci]))];
  let aMin = Infinity, aMax = -Infinity;
  for (const c of p.cells) { aMin = Math.min(aMin, c[ai]); aMax = Math.max(aMax, c[ai]); }
  const key = p.axis + p.cross + ':' + p.lo + ':' + p.hi + ':' + crossOffs.join('/') + ':' + aMin + ':' + aMax + ':' + World.occ.size;
  if (key !== lane.key) {
    lane.key = key;
    while (lane.group.children.length) lane.group.remove(lane.group.children[0]);
    for (const o of crossOffs) for (let a = Math.ceil(p.lo + aMin); a <= Math.floor(p.hi + aMax); a++) {
      const row = p.cross + o;
      const x = p.axis === 'x' ? a : row, z = p.axis === 'x' ? row : a;
      const top = World.top(x, z); if (top === undefined) continue;
      const m = new THREE.Mesh(lane.tileGeo, lane.tileMat); m.rotation.x = -Math.PI / 2; m.position.set(x, top + 1.005, z);
      lane.group.add(m);
    }
  }
  lane.tileMat.opacity = 0.32 + 0.08 * Math.sin(t * 3);
  lane.group.visible = true;
}


// Landing Shadow: cubes that stay are a see-through ghost; cubes that will be trimmed are a dashed outline
export function updateGhost(t) {
  const p = S.piece;
  const on = p && S.phase === 'aim' && S.active.shadow > 0;
  if (!on) { ghost.group.visible = false; return; }
  const [x, z] = Movement.snapped(p);
  const sig = JSON.stringify(p.cells) + x + ',' + z + ':' + World.occ.size;
  if (sig !== ghost.sig) {
    ghost.sig = sig;
    while (ghost.group.children.length) ghost.group.remove(ghost.group.children[0]);
    const { comps, cut } = Area.split(p.cells, x, z);
    let land0 = Physics.findLanding(p.cells, x, z);
    if (land0 === null && cut.length) land0 = 0;
    ghost.stable = true;
    for (const idx of comps) {
      const cells = idx.map(i => p.cells[i]);
      const land = cut.length ? Physics.findLanding(cells, x, z) : land0;
      if (land === null) continue;
      if (!Physics.evaluate(cells, x, land, z).stable) ghost.stable = false;
      for (const c of cells) {
        const m = new THREE.Mesh(cubeGeo, ghost.mat); m.position.set(x + c[0], land + c[1] + 0.5, z + c[2]); m.renderOrder = 2;
        const l = new THREE.LineSegments(edgeGeo, ghost.line); l.renderOrder = 3; m.add(l);
        ghost.group.add(m);
      }
    }
    if (land0 !== null) for (const i of cut) {
      const c = p.cells[i];
      const l = new THREE.LineSegments(edgeGeo, ghost.cutLine); l.computeLineDistances(); l.renderOrder = 3;
      l.position.set(x + c[0], land0 + c[1] + 0.5, z + c[2]);
      ghost.group.add(l);
    }
  }
  let col = p.color;
  if (CFG.powerups.shadow.showStability) col = ghost.stable ? 0x9be3a6 : 0xff7a66;
  ghost.mat.color.copy(lin(col));
  ghost.mat.opacity = 0.38 + 0.1 * Math.sin(t * 5);
  ghost.group.position.set(0, 0, 0);
  ghost.group.visible = ghost.group.children.length > 0;
}
