import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { scene, lin } from './scene.js';
import { baseRect } from './world.js';

/* =====================================================================
   SCENERY — purely cosmetic. A floating-village backdrop built from
   Quaternius' Stylized Nature MegaKit + Medieval Village Pack (CC0),
   packed into public/models/scenery.glb.
   Nothing here touches gameplay: no occupancy, no physics, no raycast targets.
   If the file fails to load, the game runs exactly as before.
   ===================================================================== */

const root = new THREE.Group(); root.name = 'scenery'; scene.add(root);
const islets = [];          // { group, baseY, phase, amp }
let protos = null;          // model name -> Object3D
let t = 0, loaded = false;

// small deterministic RNG so the dressing is identical for every player
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const rockMat = new THREE.MeshStandardMaterial({ color: lin(0x6b6655), roughness: 1, flatShading: true });
const rockDark = new THREE.MeshStandardMaterial({ color: lin(0x5c4a3d), roughness: 1, flatShading: true });
const grassMat = new THREE.MeshStandardMaterial({ color: lin(0x8ba76c), roughness: 1, flatShading: true });

// inverted rocky cone hanging under an island
function underside(radius, depth, sides, seed) {
  const g = new THREE.CylinderGeometry(radius, radius * 0.12, depth, sides, 3);
  const r = rng(seed), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > depth / 2 - 0.01) continue;                         // keep the rim flush with the island top
    const k = 0.78 + r() * 0.4;
    p.setXYZ(i, p.getX(i) * k, y + (r() - 0.5) * depth * 0.12, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, [rockMat, rockMat, rockDark]); m.position.y = -depth / 2;
  return m;
}

function makeIslet(radius, seed) {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.97, 0.35, 7), [rockMat, grassMat, rockMat]);
  top.position.y = -0.175; top.rotation.y = seed;
  group.add(top);
  const under = underside(radius * 0.97, radius * 1.5, 7, seed * 31 + 7); under.position.y -= 0.35; under.rotation.y = seed;
  group.add(under);
  return group;
}

// Each prototype's resting offset and footprint, measured once from its real geometry, so every prop
// sits exactly on the surface it is placed on: no floating, no sinking.
const metrics = {};
function measure(name) {
  if (metrics[name]) return metrics[name];
  const p = protos[name], probe = p.clone(true);
  probe.position.set(0, 0, 0); probe.rotation.set(0, 0, 0); probe.scale.setScalar(1); probe.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(probe);
  // footprint: horizontal reach of the lowest fifth of the model (trunk, foundation, stem)
  const cut = box.min.y + (box.max.y - box.min.y) * 0.2, v = new THREE.Vector3();
  let foot = 0;
  probe.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    // quantized meshes store normalized integers; three r128 does not scale them back when read
    const arr = pos.array, q = !pos.normalized ? 1 : arr instanceof Int16Array ? 1 / 32767 : arr instanceof Uint16Array ? 1 / 65535
      : arr instanceof Int8Array ? 1 / 127 : arr instanceof Uint8Array ? 1 / 255 : 1;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).multiplyScalar(q).applyMatrix4(o.matrixWorld);
      if (v.y <= cut) foot = Math.max(foot, Math.hypot(v.x, v.z));
    }
  });
  return (metrics[name] = { minY: box.min.y, foot: foot || Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 });
}
const SINK = 0.015;                                            // a hair into the ground so bevelled bases read as planted
function place(parent, name, x, z, { s = 1, ry = 0, y = 0 } = {}) {
  const p = protos && protos[name]; if (!p) return null;
  const o = p.clone(true);
  o.position.set(x, y - measure(name).minY * s - SINK, z); o.rotation.set(0, ry, 0); o.scale.setScalar(s);
  parent.add(o);
  return o;
}
const footOf = (name, s) => (protos && protos[name] ? measure(name).foot * s : 0);

/* ---- main island: rocky underside + dressing on the grass rim around the board ----
   Rebuilt whenever the plot changes size (each contract has its own blueprint), so props always fit the island. */
let mainGroup = null, mainKey = '';
function hexInside(x, z, apothem) {
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; if (x * Math.sin(a) + z * Math.cos(a) > apothem) return false; }
  return true;
}
function dressMainIsland() {
  const { w, d, x0, z0 } = baseRect();
  const key = [w, d, x0, z0].join();
  if (mainGroup && key === mainKey) return;
  if (mainGroup) { root.remove(mainGroup); mainGroup.userData.under.geometry.dispose(); }   // prop geometry is shared with the prototypes
  mainKey = key;
  const cx = x0 + (w - 1) / 2, cz = z0 + (d - 1) / 2;
  const R = Math.hypot(w, d) / 2 + 0.9;                       // same radius scene.js uses for the island
  const g = new THREE.Group(); g.position.set(cx, 0, cz); root.add(g); mainGroup = g;

  // the island in scene.js is a 0.7-thick hexagonal slab whose top is at y = -0.36 and bottom at -1.06;
  // the rocky cone hangs from the slab's underside and is no wider than it
  const under = underside(R * 0.93, R * 1.25, 6, 99); under.position.y -= 1.06; g.add(under); g.userData.under = under;

  const top = -0.36;                                          // island top surface
  const apothem = R * Math.cos(Math.PI / 6);
  const hx = w / 2, hz = d / 2;                               // board half-extents (tiles span the full rect)
  const offBoard = (x, z, m) => Math.abs(x) > hx + m || Math.abs(z) > hz + m;
  const used = [];
  // lanterns from scene.js stand here (relative to the island centre)
  for (const side of [-1, 1]) used.push([side * (w / 2 + .38), d / 2 - .15, 0.35]);
  const clear = (x, z, r) => used.every(([ux, uz, ur]) => Math.hypot(x - ux, z - uz) >= r + ur);

  // Hand-placed anchors at the hex corners. Each one slides inward along its corner until its base fits on
  // the grass, clear of the board and the lanterns; if it cannot fit at full size it shrinks, then is skipped.
  const anchors = [
    ['CommonTree_1', 3, 0.26, 0.4],
    ['Pine_3',       4, 0.24, 1.2],
    ['Bush_Common_Flowers', 0, 0.42, 0],
    ['Rock_Medium_2', 2, 0.22, 2.1],
    ['Bush_Common',  5, 0.38, 0.7],
    ['Well',         1, 0.85, -0.9],
  ];
  for (const [name, i, s0, ry] of anchors) {
    const a = i * Math.PI / 3, dx = Math.sin(a), dz = Math.cos(a);
    let done = false;
    for (let s = s0; s >= s0 * 0.6 && !done; s *= 0.85) {
      const r = footOf(name, s) + 0.06;
      for (let k = 0.95; k >= 0.45; k -= 0.025) {
        const x = dx * R * k, z = dz * R * k;
        if (hexInside(x, z, apothem - r) && offBoard(x, z, r) && clear(x, z, r)) {
          place(g, name, x, z, { s, ry, y: top }); used.push([x, z, r]); done = true; break;
        }
      }
    }
  }

  // Scatter low ground cover on the rim, outside the board.
  const small = [['Grass_Common_Short', 0.24], ['Grass_Wispy_Short', 0.3], ['Flower_3_Group', 0.18], ['Flower_4_Group', 0.16],
                 ['Clover_1', 0.28], ['Plant_1', 0.32], ['Mushroom_Common', 0.45], ['Pebble_Round_1', 1.1], ['Fern_1', 0.22]];
  const r = rng(2026);
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 34; tries++) {
    const x = (r() * 2 - 1) * R, z = (r() * 2 - 1) * R;
    const [name, s0] = small[Math.floor(r() * small.length)];
    const s = s0 * (0.8 + r() * 0.4), ry = r() * Math.PI * 2, rad = Math.max(0.12, footOf(name, s));
    if (!offBoard(x, z, 0.12) || !hexInside(x, z, apothem - rad - 0.05) || !clear(x, z, rad)) continue;
    place(g, name, x, z, { s, ry, y: top });
    used.push([x, z, rad * 0.8]); placed++;
  }
}

/* ---- floating islets with the village, out in the distance ---- */
const ISLETS = [
  // a: angle around the board (default camera sits at a≈0.72, so a≈3.9 is straight behind the board)
  // d: distance, y: height, r: islet radius. Far islets sit high so they fill the sky above the play space.
  { a: 3.62, d: 30, y: 3.2, r: 3.0, items: [['House_1', 0.2, -0.3, 1, 0.5], ['CommonTree_2', -1.9, 0.9, 0.3, 0], ['Fence', 1.2, 1.9, 1.6, 0.3],
    ['Barrel', 1.7, 0.7, 2.2, 0], ['Crate', 1.9, 1.1, 2.2, 0.4], ['Bush_Common', -1.2, -1.8, 0.4, 0]] },
  { a: 4.3, d: 36, y: 4.5, r: 2.7, items: [['Mill', 0, 0, 0.9, 2.6], ['Hay', 1.6, 1.2, 2.4, 0], ['Hay', 1.9, 0.6, 2.4, 0.7], ['Flower_4_Group', -1.6, 1.1, 0.25, 0]] },
  { a: 3.98, d: 24, y: 0.2, r: 2.2, items: [['House_3', 0, 0, 1, -0.6], ['Pine_1', -1.4, -0.7, 0.24, 0], ['Bush_Common_Flowers', 1.2, 1.0, 0.4, 0]] },
  { a: 3.15, d: 34, y: 5.0, r: 2.2, items: [['Pine_2', 0, -0.4, 0.3, 0], ['Pine_1', 1.1, 0.7, 0.22, 1], ['Rock_Medium_1', -1.1, 0.8, 0.3, 0.4]] },
  { a: 5.1, d: 16, y: -7.0, r: 1.5, items: [['Bonfire_Lit', 0, 0, 2.2, 0], ['Bench_1', 0, -0.9, 2.0, 0], ['Bags', 0.8, 0.6, 2.2, 0.8]] },
  { a: 1.1, d: 30, y: 2.0, r: 3.2, items: [['Inn', 0, 0, 0.75, 3.9], ['MarketStand_1', 2.2, 0.5, 1.1, -1.2], ['CommonTree_3', -2.2, -0.6, 0.22, 0]] },
  { a: 2.1, d: 32, y: 4.0, r: 2.4, items: [['House_2', 0, 0.2, 0.85, 1.2], ['CommonTree_4', 1.7, -0.6, 0.2, 0], ['Cart', -1.5, 1.1, 1.2, 0.9]] },
  { a: 0.2, d: 26, y: 0.5, r: 1.8, items: [['House_4', 0, 0, 1, 0.3], ['Grass_Common_Tall', 1.0, 0.8, 0.3, 0], ['Rock_Medium_3', -1.0, 0.6, 0.2, 1]] },
  { a: 5.9, d: 34, y: 4.5, r: 2.0, items: [['Gazebo', 0, 0, 1.6, 0.4], ['Flower_3_Group', 1.0, 0.7, 0.22, 0], ['Bush_Common', -1.0, 0.6, 0.35, 0]] },
];

function buildIslets() {
  ISLETS.forEach((def, i) => {
    const g = makeIslet(def.r, i + 1);
    g.position.set(Math.sin(def.a) * def.d, def.y, Math.cos(def.a) * def.d);
    g.rotation.y = def.a + Math.PI;                              // front of each islet faces the board
    // pull any prop whose base would hang past the islet's edge back onto the grass
    const apothem = def.r * 0.97 * Math.cos(Math.PI / 7) - 0.05;
    for (const [name, x, z, s, ry] of def.items) {
      const f = footOf(name, s), dist = Math.hypot(x, z), k = dist + f > apothem && dist > 0 ? Math.max(0, apothem - f) / dist : 1;
      place(g, name, x * k, z * k, { s, ry });
    }
    root.add(g);
    islets.push({ group: g, baseY: def.y, phase: i * 1.7, amp: 0.12 + (i % 3) * 0.05 });
  });
}

export function initScenery() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(import.meta.env.BASE_URL + 'models/scenery.glb', gltf => {
    protos = {};
    for (const child of gltf.scene.children) protos[child.name] = child;
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = false;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) { m.metalness = 0; if(m.name==='Windows'){m.emissive=lin(0xffc26b);m.emissiveIntensity=.85;} if (m.map) m.map.anisotropy = 4; }
    });
    dressMainIsland();
    buildIslets();
    loaded = true;
  }, undefined, err => console.warn('scenery failed to load — playing without it', err));
}

// called after the baseplate is rebuilt (new contract, tutorial, restart)
export function refitScenery() { if (loaded) dressMainIsland(); }

export function updateScenery(dt) {
  t += dt;
  for (const s of islets) s.group.position.y = s.baseY + Math.sin(t * 0.45 + s.phase) * s.amp;
}
