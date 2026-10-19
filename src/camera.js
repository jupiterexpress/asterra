import * as THREE from 'three';
import { CFG } from './config.js';
import { World } from './world.js';
import { canvas, camera, sun, SUN_OFFSET, topLight } from './scene.js';
import { AudioFX } from './audio.js';
import { hideHint } from './ui.js';
import { S } from './state.js';

/* =====================================================================
   CAMERA — mouse-drag / one-finger orbit, wheel / pinch zoom. Independent of the piece.
   ===================================================================== */
export const Cam = {
  yaw: CFG.camera.yaw, pitch: CFG.camera.pitch, goalYaw: CFG.camera.yaw, goalPitch: CFG.camera.pitch, zoom: 1,
  target: new THREE.Vector3(0, 1, 0), dist: CFG.camera.dist, shake: 0,
  pointers: new Map(), pinch0: 0, zoom0: 1, dragged: false,
  update(dt) {
    // the drag sets a goal angle; the view reaches it within CFG.camera.settle seconds and stops there (no momentum)
    if (this.goalYaw === undefined) { this.goalYaw = this.yaw; this.goalPitch = this.pitch; }
    this.goalPitch = Math.min(CFG.camera.pitchMax, Math.max(CFG.camera.pitchMin, this.goalPitch));
    const st = Math.max(0, CFG.camera.settle);
    const ka = st <= 0 ? 1 : 1 - Math.exp(-dt * 4.6 / st);   // ~99% of the way in `settle` seconds
    this.yaw += (this.goalYaw - this.yaw) * ka; this.pitch += (this.goalPitch - this.pitch) * ka;
    this.pitch = Math.min(CFG.camera.pitchMax, Math.max(CFG.camera.pitchMin, this.pitch));
    const b = World.bounds;
    const span = Math.max(b.maxX - b.minX + 1, b.maxZ - b.minZ + 1);
    const h = b.topY + 1;
    // aim between the plate and where pieces hover, so both the build and the piece sit in view
    const showcase = S.phase === 'finishing' || S.phase === 'over';
    const want = new THREE.Vector3((b.minX + b.maxX) / 2, showcase ? Math.max(.3, h*.5-.65) : Math.max(0.8, (h + CFG.move.hoverGap + 1.5) * 0.5), (b.minZ + b.maxZ) / 2);
    const k = 1 - Math.exp(-3 * dt);
    this.target.lerp(want, k);
    // Distance depends only on the structure (never on the current piece), so it can't jump between drops.
    // It is the larger of the old growth rule and a fit that keeps any piece path on screen: a ring around
    // the structure padded by how far pieces can travel past it, from the plate up to hover height.
    const base = (CFG.camera.dist + Math.max(0, Math.max(span - 5, h - 2)) * 0.9) * (camera.aspect < 0.8 ? 1.2 : 1);
    // one distance for every viewing angle, so dragging only rotates; it changes only as the build grows
    const wantDist = CFG.camera.ring > 0 ? Math.max(base, this.fixedFit(b, want)) : base;
    this.baseDist = this.baseDist === undefined ? wantDist : this.baseDist + (wantDist - this.baseDist) * k;
    this.dist = this.baseDist * this.zoom;                    // pinch-zoom applies immediately
    const cp = Math.cos(this.pitch);
    camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * cp * this.dist);
    if (this.shake > 0) { camera.position.y += (Math.random() - 0.5) * this.shake; this.shake *= Math.pow(0.02, dt); if (this.shake < 0.002) this.shake = 0; }
    camera.lookAt(this.target);
    sun.position.copy(this.target).add(SUN_OFFSET); sun.target.position.copy(this.target);
    topLight.target.position.set(this.target.x, 0, this.target.z);
    topLight.position.set(this.target.x, h + 30, this.target.z);
    const ext = Math.max(10, span + 8);
    const sc = topLight.shadow.camera;
    if (sc.right !== ext || sc.far !== h + 60) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.5; sc.far = h + 60; sc.updateProjectionMatrix(); }
  },
  _fit: new THREE.PerspectiveCamera(), _v: new THREE.Vector3(),
  // worst case over all drag angles, cached until the build (or screen shape, or settings) changes
  fixedFit(b, target) {
    const key = [b.minX, b.maxX, b.minZ, b.maxZ, b.topY, target.y.toFixed(2), CFG.move.margin, CFG.move.hoverGap, CFG.camera.ring,
      CFG.camera.pitchMin, CFG.camera.pitchMax, camera.aspect.toFixed(3), camera.fov, this.safe?.top, this.safe?.bottom].join();
    if (this._fitKey === key) return this._fitVal;
    let d = 0;
    const pMin = CFG.camera.pitchMin, pMax = CFG.camera.pitchMax;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++)
      d = Math.max(d, this.ringFit(b, target, j * Math.PI / 4 + Math.PI / 8, pMin + (pMax - pMin) * i / 3));
    this._fitKey = key; this._fitVal = d;
    return d;
  },
  ringFit(b, target, yaw, pitch) {
    const pad = CFG.move.margin + 1.5;
    // keep clear of the HUD panels measured by main.js (screen fractions in clip space)
    const yT = Math.min(0.6, this.safe?.top ?? 0.6), yB = Math.max(-0.7, this.safe?.bottom ?? -0.7);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const r = Math.hypot((b.maxX - b.minX + 1) / 2 + pad, (b.maxZ - b.minZ + 1) / 2 + pad) * CFG.camera.ring;
    const yTop = b.topY + 1 + CFG.move.hoverGap + 2;
    const fc = this._fit; fc.fov = camera.fov; fc.aspect = camera.aspect; fc.near = 0.1; fc.far = 400; fc.updateProjectionMatrix();
    const cp = Math.cos(pitch), dir = new THREE.Vector3(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp);
    let d = 6;
    for (let it = 0; it < 70; it++, d *= 1.04) {
      fc.position.copy(target).addScaledVector(dir, d); fc.lookAt(target); fc.updateMatrixWorld();
      let ok = true;
      // pieces travel at hover height: keep that ring in view; the structure itself only needs its box in view
      for (let a = 0; a < 16 && ok; a++) for (const y of [yTop - 2, yTop]) {
        const v = this._v.set(cx + Math.cos(a * Math.PI / 8) * r, y, cz + Math.sin(a * Math.PI / 8) * r).project(fc);
        if (v.z > 1 || Math.abs(v.x) > 0.98 || v.y > yT || v.y < yB) { ok = false; break; }
      }
      for (const x of [b.minX - 0.5, b.maxX + 0.5]) for (const z of [b.minZ - 0.5, b.maxZ + 0.5]) for (const y of [-1, b.topY + 1]) {
        if (!ok) break;
        const v = this._v.set(x, y, z).project(fc);
        if (v.z > 1 || Math.abs(v.x) > 0.98 || v.y > yT || v.y < yB) ok = false;
      }
      if (ok) break;
    }
    return d;
  },
  // horizontal camera-forward snapped to the nearest world axis (used for the Tip direction)
  forwardAxis() {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    return Math.abs(fx) > Math.abs(fz) ? new THREE.Vector3(Math.sign(fx), 0, 0) : new THREE.Vector3(0, 0, Math.sign(fz));
  },
};


// Mouse / one-finger drag orbits; wheel, trackpad pinch or two fingers zoom within a narrow range.
// The scene never places tiles: clicks and drags here only move the camera (DROP / Space places).
export function initCameraInput() {
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    AudioFX.unlock();
    canvas.setPointerCapture(e.pointerId);
    Cam.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Cam.pointers.size === 2) { const [a, b] = [...Cam.pointers.values()]; Cam.pinch0 = Math.hypot(a.x - b.x, a.y - b.y); Cam.zoom0 = Cam.zoom; }
    Cam.dragged = false;
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', e => {
    const p = Cam.pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (Cam.pointers.size === 1) {
      Cam.goalYaw += -dx * CFG.camera.sens;
      Cam.goalPitch = Math.min(CFG.camera.pitchMax, Math.max(CFG.camera.pitchMin, Cam.goalPitch + dy * CFG.camera.sens));
      if (Math.abs(dx) + Math.abs(dy) > 2) { Cam.dragged = true; hideHint(); }
    } else if (Cam.pointers.size === 2) {
      const [a, b] = [...Cam.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (Cam.pinch0 > 0) Cam.zoom = clampZoom(Cam.zoom0 * Cam.pinch0 / d);
    }
  });
  const endPointer = e => {
    Cam.pointers.delete(e.pointerId);
    if (Cam.pointers.size < 2) Cam.pinch0 = 0;
    if (Cam.pointers.size === 0) { canvas.classList.remove('dragging'); Cam.dragged = false; }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); Cam.zoom = clampZoom(Cam.zoom * (1 + e.deltaY * 0.0012)); }, { passive: false });
}

function clampZoom(z) { return Math.min(CFG.camera.zoomMax, Math.max(CFG.camera.zoomMin, z)); }
