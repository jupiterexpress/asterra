import * as THREE from 'three';
import { baseRect, footprint } from './world.js';

/* =====================================================================
   RENDERING
   ===================================================================== */
export const canvas = document.getElementById('scene');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.localClippingEnabled = true;

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd7c2a0, 34, 92);            // warm golden-hour haze fades the distant islets
export const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 260);

// Two lights: an angled key light shades the blocks (lit tops, darker sides) but casts no shadow;
// a straight-down light casts every shadow, so a hovering piece's shadow sits exactly on the squares below it.
scene.add(new THREE.HemisphereLight(0xfff0d8, 0x51604a, 0.78));
export const sun = new THREE.DirectionalLight(0xffd9a6, 0.6);
sun.castShadow = false;
scene.add(sun, sun.target);
export const SUN_OFFSET = new THREE.Vector3(-7, 14, 5);
export const topLight = new THREE.DirectionalLight(0xffffff, 0.85);
topLight.castShadow = true;
topLight.shadow.mapSize.set(2048, 2048);
topLight.shadow.bias = -0.0004; topLight.shadow.normalBias = 0.02;
topLight.shadow.camera.up.set(0, 0, -1);      // straight-down light: keep the shadow camera's up off the view axis
scene.add(topLight, topLight.target);

export const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
export const CUBE = 0.965;
export const cubeGeo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
export const edgeGeo = new THREE.EdgesGeometry(cubeGeo);
const edgeMat = new THREE.LineBasicMaterial({ color: 0x10161d, transparent: true, opacity: 0.28 });

// The visible cube is slightly undersized so its edges read, which let light leak through the seams
// and drew grid lines inside shadows. Shadows now come from an invisible caster that is full width
// (no seams between neighbours) and a little shorter (its top sits below the cube's own top face,
// so a cube never shades itself).
const shadowGeo = new THREE.BoxGeometry(1, 0.9, 1);
const shadowMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
export function makeCube(mat) {
  const m = new THREE.Mesh(cubeGeo, mat); m.castShadow = false; m.receiveShadow = true;
  m.add(new THREE.LineSegments(edgeGeo, edgeMat));
  const caster = new THREE.Mesh(shadowGeo, shadowMat); caster.castShadow = true; caster.receiveShadow = false;
  m.add(caster);
  return m;
}

/* A miniature Asterra site. The grid is a placement guide on a garden foundation. */
const baseGroup = new THREE.Group(); scene.add(baseGroup);
function cellTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#55766e'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#849e8d'; g.lineWidth = 1.5; g.strokeRect(1, 1, 62, 62);
  g.fillStyle = '#718e80'; g.fillRect(30, 30, 4, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
function stripeTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#3d4750'; g.fillRect(0, 0, 64, 64);
  g.save(); g.beginPath(); g.rect(0, 0, 64, 20); g.clip();
  g.fillStyle = '#e2a531'; g.fillRect(0, 0, 64, 20);
  g.fillStyle = '#1c232b';
  for (let i = -64; i < 128; i += 22) { g.beginPath(); g.moveTo(i, 20); g.lineTo(i + 11, 20); g.lineTo(i + 31, 0); g.lineTo(i + 20, 0); g.fill(); }
  g.restore();
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
  return t;
}
export function buildBaseplate() {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  baseGroup.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); if (m.map) textures.add(m.map); }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); baseGroup.clear();
  const { w, d, x0, z0 } = baseRect();
  const cx = x0 + (w - 1) / 2, cz = z0 + (d - 1) / 2;
  const material = color => new THREE.MeshStandardMaterial({ color: lin(color), roughness: .9 });
  const edge = material(0x6e5a48), garden = material(0x6a8b4c), stone = material(0x889e86);
  const top = new THREE.MeshStandardMaterial({ map: cellTexture(), roughness: .9 });
  const radius = Math.hypot(w,d)/2+.9;
  const island = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius*.94, .7, 6), [edge,garden,edge]);
  island.position.set(cx,-.71,cz); baseGroup.add(island);
  const cell = new THREE.BoxGeometry(1,.36,1);
  for (const [x,z] of footprint()) {
    const tile = new THREE.Mesh(cell, [stone,stone,top,edge,stone,stone]); tile.position.set(x,-.18,z); tile.receiveShadow = true; baseGroup.add(tile);
  }
  const box = (x,y,z,a,b,c,mat) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mat); mesh.position.set(x,y,z); baseGroup.add(mesh); return mesh; };
  const amber = new THREE.MeshStandardMaterial({ color: lin(0xffc46a), emissive: lin(0xffb552), emissiveIntensity: 1.2 });
  for (const side of [-1,1]) {
    const x = cx+side*(w/2+.38), z = cz+d/2-.15;
    box(x,-.01,z,.07,.7,.07,edge); box(x,.41,z,.18,.3,.18,amber);
    box(x,.58,z,.26,.06,.26,edge); box(x,.24,z,.23,.06,.23,edge);
    const light = new THREE.PointLight(0xffc078,.4,2.2,2); light.position.set(x,.48,z); baseGroup.add(light);
  }
}
const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshStandardMaterial({ color: lin(0x385850), roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -19; ground.visible = false; scene.add(ground);
