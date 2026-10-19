import {Store} from '../shared/store.js';
import {displayKey} from '../shared/settings.js';
import * as THREE from 'three';
import { S } from './state.js';
import { CFG } from './config.js';
import { Poly, applyRot, Y90, shapeKey, stanceKey } from './poly.js';
import { Movement } from './movement.js';
import { scene } from './scene.js';

const $ = id => document.getElementById(id);
const base = Poly.normalize([[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 0, 1]]).cells;
const target = applyRot(Y90, base).map(c => [c[0], c[1], c[2] - 1]);
const targetKey = target.map(c => c.join(',')).sort().join('|');
const targetStance = stanceKey(target);
const targetShape = shapeKey(target);
const marker = new THREE.Group();
const markerMat = new THREE.MeshBasicMaterial({ color: 0xffcf5a, transparent: true, opacity: 0.48,
  depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
const markerLine = new THREE.LineBasicMaterial({ color: 0xffe7a1, transparent: true, opacity: 0.96 });
for (const [x, , z] of target) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), markerMat);
  plane.rotation.x = -Math.PI / 2; plane.position.set(x, 0.025, z); marker.add(plane);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.92, 0.92)), markerLine);
  edge.rotation.x = -Math.PI / 2; edge.position.set(x, 0.035, z); marker.add(edge);
}
marker.visible = false; scene.add(marker);

const hints = [
  ['Look at the tile’s height compared with the flat target.', 'Try FLIP (F) to lay the tile flat.'],
  ['The tile is flat, but its long side points another way.', 'Try ROTATE (R) to turn its footprint.'],
  ['The tile needs to travel along the target’s row.', 'Use AXIS (X) near the center of the plate.'],
  ['Watch for the tile to pass over the glowing squares.', 'Wait until the tile covers the glowing squares.'],
  ['The tile is lined up with the target.', 'Press DROP (Space) now.'],
];
const keyedHint=text=>text.replace('(F)',`(${displayKey(Store.data.settings.keys.flip)})`).replace('(R)',`(${displayKey(Store.data.settings.keys.rotate)})`).replace('(X)',`(${displayKey(Store.data.settings.keys.axis)})`).replace('(Space)',`(${displayKey(Store.data.settings.keys.drop)})`);

export const Tutorial = {
  mode: 'off', idle: 0, stage: -1, api: null, savedCfg: null,
  init(api) {
    this.api = api;
    $('tutorialStart').addEventListener('click', () => this.challenge());
    $('tutorialContinue').addEventListener('click', () => this.proceed());
    $('tutorialRetry').addEventListener('click', () => this.challenge());
  },
  start() {
    this.prepare();
    this.api.reset(true);
    this.mode = 'overview';
    this.api.update?.();
    $('tutorialOverview').hidden = false;
    $('controls').hidden = true;
    $('tutorialChallenge').hidden = true;
    $('tutorialDone').hidden = true;
    $('hint').classList.add('gone');
  },
  challenge() {
    this.prepare();
    this.api.reset(true);
    this.mode = 'challenge'; this.idle = 0; this.stage = -1;
    this.api.spawn(base);
    const p = S.piece;
    p.axis = 'x'; p.cross = 0; p.lo = -3; p.hi = 3; p.t = -3; p.dir = 1; p.turns = 0;
    p.speedMul = 1;
    marker.visible = true;
    $('tutorialOverview').hidden = true;
    $('tutorialChallenge').hidden = false;
    $('tutorialDone').hidden = true;
    $('controls').hidden = false;
    $('tutorialHint').hidden = true;
    $('tutorialStatus').textContent = 'Match the glowing footprint. DROP when it lines up.';
    this.api.update?.();
  },
  clear() {
    if (this.savedCfg) {
      CFG.baseplate.w = this.savedCfg.w; CFG.baseplate.d = this.savedCfg.d;
      CFG.rotate.allowTip = this.savedCfg.allowTip;
      CFG.turn.maxPerPiece = this.savedCfg.maxPerPiece; CFG.turn.meterCost = this.savedCfg.meterCost;
      this.savedCfg = null;
    }
    this.mode = 'off'; this.idle = 0; this.stage = -1;
    marker.visible = false;
    $('tutorialOverview').hidden = true;
    $('tutorialChallenge').hidden = true;
    $('tutorialDone').hidden = true;
  },
  prepare() {
    if (!this.savedCfg) this.savedCfg = { w: CFG.baseplate.w, d: CFG.baseplate.d, allowTip: CFG.rotate.allowTip,
      maxPerPiece: CFG.turn.maxPerPiece, meterCost: CFG.turn.meterCost };
    CFG.baseplate.w = 5; CFG.baseplate.d = 5;
    CFG.rotate.allowTip = true; CFG.turn.maxPerPiece = 0; CFG.turn.meterCost = 0;
  },
  stageFor(p) {
    if (stanceKey(p.cells) !== targetStance) return 0;
    if (shapeKey(p.cells) !== targetShape) return 1;
    if (p.axis !== 'z' || p.cross !== 0) return 2;
    return this.matches(p) ? 4 : 3;
  },
  matches(p) {
    const [x, z] = Movement.snapped(p);
    return p.cells.map(c => [x + c[0], c[1], z + c[2]].join(',')).sort().join('|') === targetKey;
  },
  onAction() { if (this.mode === 'challenge') this.tick(0); },
  canDrop(p) {
    if (this.mode !== 'challenge') return true;
    if (this.matches(p)) return true;
    $('tutorialStatus').textContent = 'The tile must cover every glowing square first.';
    this.idle = Math.max(this.idle, 5);
    return false;
  },
  tick(dt) {
    if (this.mode !== 'challenge' || !S.piece) return;
    const stage = this.stageFor(S.piece);
    if (stage !== this.stage) {
      if (stage > this.stage && stage < 4) this.idle = 0;
      this.stage = stage;
      $('tutorialHint').hidden = true;
      $('tutorialStatus').textContent = stage === 4 ? keyedHint('That fits! Press DROP (Space).') : 'Match the glowing footprint. DROP when it lines up.';
    }
    this.idle += dt;
    const level = this.idle >= 13 ? 1 : this.idle >= 6 ? 0 : -1;
    const hint = $('tutorialHint');
    hint.hidden = level < 0;
    if (level >= 0) hint.textContent = keyedHint(hints[stage][level]);
    markerMat.opacity = 0.43 + 0.13 * Math.sin(performance.now() * 0.003);
  },
  onPlacement(stable) {
    if (this.mode !== 'challenge') return;
    if (!stable) { this.challenge(); return; }
    this.mode = 'complete'; marker.visible = false;
    $('tutorialChallenge').hidden = true;
    $('tutorialDone').hidden = false;
    $('controls').hidden = true;
  },
  proceed() {
    Store.profile('tutorial',true);
    this.api.home();
  },
};
