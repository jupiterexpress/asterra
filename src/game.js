import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { rng, setSeed } from './rng.js';
import { Poly, applyRot, stanceKey, stancesOf, qAngle } from './poly.js';
import { World, Area, outsideDir } from './world.js';
import { Physics } from './physics.js';
import { Movement } from './movement.js';
import { Powers } from './powerups.js';
import { scene, makeCube, lin, buildBaseplate } from './scene.js';
import { refitScenery } from './scenery.js';
import { Bonus } from './bonus.js';
import { ghost, lane, updateGhost, updateLane } from './guides.js';
import { fx, dustRing, flash, sliceFx, updateFx, vanish } from './fx.js';
import { Cam } from './camera.js';
import { AudioFX } from './audio.js';
import { S, freshBox, used, runTotal, speedMul } from './state.js';
import { Tutorial } from './tutorial.js';
import { Contract } from './contract.js';
import { updateHUD, buildSegs, toast, hideHint, celebrate, endRun, meterEl, pauseEl, endEl, controlsEl, coinPop, updateTileValue } from './ui.js';

/* =====================================================================
   GAME — spawning, controls, dropping, trimming, landing, scoring
   ===================================================================== */
const QI = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);


export function hoverBaseY() { return World.bounds.topY + 1 + CFG.move.hoverGap; }

export function spawn(baseOverride = null) {
  const base = baseOverride || S.tileQueue.shift() || Poly.generate();
  const stances = stancesOf(base);
  // arrive in the flattest resting side (random facing), or as generated
  const q0 = baseOverride ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    : CFG.piece.spawnFlat ? stances[0].rots[Math.floor(rng() * stances[0].rots.length)].clone() : new THREE.Quaternion();
  const cells = applyRot(q0, base);
  const color = PALETTE[Math.floor(rng() * PALETTE.length)];
  const mat = new THREE.MeshStandardMaterial({ color: lin(color), roughness: 0.62, metalness: 0.04, emissive: 0x000000 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const meshes = cells.map(c => { const m = makeCube(mat); m.position.set(c[0], c[1], c[2]); body.add(m); return m; });
  const p = { cells, base, stances, q: q0, color, mat, root, body, meshes, anim: null, hoverY: hoverBaseY(), born: 0 };
  Movement.setup(p);
  const [x, z] = Movement.xz(p);
  root.position.set(x, p.hoverY + 0.5, z);
  root.scale.setScalar(0.01);
  scene.add(root);
  p.speedMul = speedMul(used());
  p.value = Contract.active ? CFG.tileValue.start : null;     // tile value only exists on contracts
  S.piece = p; S.phase = 'aim'; S.queuedDrop = false;
  ghost.sig = ''; lane.key = '';
  updateHUD();
}

function visState(p) {
  if (!p.anim) return { Q: QI.clone(), V: new THREE.Vector3() };
  const e = 1 - Math.pow(1 - Math.min(1, p.anim.t / p.anim.dur), 3);
  return { Q: p.anim.q0.clone().slerp(QI, e), V: p.anim.v0.clone().multiplyScalar(1 - e) };
}



export function rotatePiece(axis, angle, action = 'rotate') {
  const p = S.piece; if (!p || S.phase !== 'aim' || S.active.block) return;
  const { cells, s } = Poly.rotate(p.cells, axis, angle);
  const R = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  p.q = R.clone().multiply(p.q);
  const { Q, V } = visState(p);
  const q0 = Q.clone().multiply(R.clone().invert());
  const v0 = new THREE.Vector3(s[0], s[1], s[2]).applyQuaternion(q0).add(V);
  p.anim = { q0, v0, t: 0, dur: CFG.rotate.animMs / 1000 };
  p.cells = cells;
  cells.forEach((c, i) => p.meshes[i].position.set(c[0], c[1], c[2]));
  AudioFX.tick();
  Tutorial.onAction(action);
}
export function rotateY() { rotatePiece(Y_AXIS, Math.PI / 2); }
// FLIP: move to the next resting side in this shape's fixed order (flattest first), keeping the
// facing as close as possible to how it was, so a FLIP never needs a ROTATE to undo it
export function tip() {
  if (!CFG.rotate.allowTip) return;
  const p = S.piece; if (!p || S.phase !== 'aim' || S.active.block) return;
  if (p.stances.length < 2) { AudioFX.tone(260, 0.06, 'triangle', 0.05); return; }
  const cur = stanceKey(p.cells);
  let i = p.stances.findIndex(st => st.key === cur); if (i < 0) i = 0;
  const next = p.stances[(i + 1) % p.stances.length];
  let best = null, bestA = Infinity;
  for (const q of next.rots) { const a = qAngle(q, p.q); if (a < bestA - 1e-6) { bestA = a; best = q; } }
  const D = best.clone().multiply(p.q.clone().invert());
  if (D.w < 0) { D.x = -D.x; D.y = -D.y; D.z = -D.z; D.w = -D.w; }
  const ang = 2 * Math.acos(Math.min(1, D.w)), sn = Math.sqrt(Math.max(1e-9, 1 - D.w * D.w));
  rotatePiece(new THREE.Vector3(D.x / sn, D.y / sn, D.z / sn).normalize(), ang, 'flip');
}

export function turn() {
  const p = S.piece; if (!p || S.phase !== 'aim' || S.active.block) return;
  if (!canTurn(p)) { AudioFX.tone(180, 0.08, 'square', 0.05); return; }
  if (CFG.turn.meterCost > 0) S.meter -= CFG.turn.meterCost;
  Movement.turn(p);
  if (S.active.freeze > 0) { p.t = Math.round(p.t); p.nudge.set(0, 0); }   // frozen tiles stay on the grid
  AudioFX.tone(520, 0.06, 'triangle', 0.09); AudioFX.tone(700, 0.06, 'triangle', 0.07, 0.04);
  hideHint(); updateHUD();
  Tutorial.onAction('axis');
}
export function canTurn(p) {
  if (!p) return false;
  if (CFG.turn.maxPerPiece > 0 && p.turns >= CFG.turn.maxPerPiece) return false;
  if (CFG.turn.meterCost > 0 && S.meter < CFG.turn.meterCost) return false;
  return true;
}


// DROP: the whole piece falls intact. Trimming (if any) happens after it lands.

// DROP is the only way a tile is placed: the DROP button or the Space key. Clicks on the scene never place.
export function place() {
  if (S.active.block) { Bonus.confirm(); return; }           // DROP confirms a bonus block while one is being aimed
  const p = S.piece; if (!p || S.phase !== 'aim') return;
  if (!Tutorial.canDrop(p)) return;
  AudioFX.unlock();
  if (p.value != null && p.locked == null) p.locked = p.value; // the value is fixed the moment DROP is pressed
  if (S.pending > 0) { S.queuedDrop = true; return; }   // previous piece still settling: drop the moment it's done
  endFreeze(p);
  // Every cube is a full 1×1×1 cell on the grid: finish any arrival scale-up or rotation before the tile falls.
  p.anim = null; p.body.quaternion.identity(); p.body.position.set(0, 0, 0);
  p.born = 1; p.root.scale.setScalar(1); p.nudge.set(0, 0);
  const [x, z] = Movement.snapped(p);
  const { comps, cut } = Area.split(p.cells, x, z);
  let land = Physics.findLanding(p.cells, x, z);
  if (land === null && cut.length) land = 0;             // fully outside: stop at plate level so the miss is visible
  p.pl = { total: 1, done: 0, stable: 0, allPerfect: true, trimmed: cut.length > 0, allTrimmed: comps.length === 0,
           cutCount: cut.length, overhang: 0, value: p.locked };
  // outcomes known at release: a full trim or a drop onto nothing will be a strike
  const willStrike = (comps.length === 0 && CFG.strikes.allTrimmed) || (land === null && !cut.length && CFG.strikes.miss);
  if (willStrike && (CFG.strikes.limit | 0) > 0) { p.pl.predicted = true; S.predicted++; }
  if (cut.length) p.trim = { comps, cut };
  p.drop = { x0: p.root.position.x, z0: p.root.position.z, x, z, vy: CFG.physics.dropKick, t: 0,
             target: land === null ? null : land + 0.5, land };
  S.dropping.push(p); S.pending++;
  S.piece = null; S.phase = 'drop';
  ghost.group.visible = false;
  hideHint();
  updateHUD();
}

// first contact of a dropped piece: next piece can start coming in
function releaseSpawn() { if (S.phase === 'drop') { S.phase = 'wait'; S.waitT = CFG.spawnDelay; } }

// a disconnected leftover becomes its own body with its own material
function splitOff(p, sub) {
  const mat = p.mat.clone();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  root.position.copy(p.root.position); root.quaternion.copy(p.root.quaternion); root.scale.copy(p.root.scale);
  for (const m of sub.meshes) { m.material = mat; body.add(m); }
  scene.add(root);
  return { cells: sub.cells, meshes: sub.meshes, color: p.color, mat, root, body };
}


// the piece has landed with cubes over the edge: hold, then slice
function startTrim(b) {
  const { x, z, land } = b.drop;
  b.root.position.set(x, land + 0.5, z);
  Cam.shake = 0.03; AudioFX.thunk();
  S.trims.push({ b, t: 0 });
  releaseSpawn();
}
function updateTrims(dt) {
  for (const tr of S.trims.slice()) {
    tr.t += dt;
    if (tr.t < CFG.buildArea.pause) continue;
    S.trims.splice(S.trims.indexOf(tr), 1);
    slice(tr.b);
  }
}
function slice(b) {
  const { x, z, land } = b.drop, { comps, cut } = b.trim;
  const cells = b.cells, meshes = b.meshes;
  sliceFx(cut.map(i => cells[i]), x, land, z);
  cutAway(b, cut.map(i => ({ m: meshes[i], c: cells[i] })), x, land, z);
  const pl = b.pl;
  const bodies = comps.map((idx, n) => {
    const sub = { cells: idx.map(i => cells[i]), meshes: idx.map(i => meshes[i]) };
    if (n === 0) { b.cells = sub.cells; b.meshes = sub.meshes; return b; }
    return splitOff(b, sub);
  });
  b.trim = null;
  if (!bodies.length) { scene.remove(b.root); b.mat.dispose(); pl.total = 0; finishPlacement(pl); return; }
  pl.total = bodies.length;
  for (const o of bodies) {
    const l = Physics.findLanding(o.cells, x, z);
    o.pl = pl;
    o.drop = { x0: x, z0: z, x, z, vy: 0, t: 1, target: l + 0.5, land: l };
    S.dropping.push(o);
  }
}

// cut cubes hinge over the plate edge, then fall and shrink away
function cutAway(b, list, x, land, z) {
  b.root.updateMatrixWorld(true);
  const wp = new THREE.Vector3();
  for (const { m, c } of list) {
    m.getWorldPosition(wp);
    const mat = b.mat.clone();
    const root = new THREE.Group(); root.position.copy(wp); scene.add(root);
    m.material = mat; root.add(m); m.position.set(0, 0, 0);
    const d = outsideDir(x + c[0], z + c[2]);
    const pivot = new THREE.Vector3(d.dx ? d.edge : wp.x, land + c[1], d.dz ? d.edge : wp.z);
    S.falling.push({ root, mat, phase: 'tip', fade: 0, axis: new THREE.Vector3(d.dz, 0, -d.dx), pivot,
      basePos: root.position.clone(), baseQ: root.quaternion.clone(), ang: 0, w: 0,
      tipDur: Math.max(0.03, CFG.buildArea.tip), tipT: 0, fadeDur: Math.max(0.05, CFG.buildArea.fall) });
  }
  AudioFX.snip();
}


function updateDropping(dt) {
  for (const b of S.dropping.slice()) {
    const d = b.drop; d.t += dt;
    const k = Math.min(1, d.t / 0.07);
    b.root.position.x = d.x0 + (d.x - d.x0) * k;
    b.root.position.z = d.z0 + (d.z - d.z0) * k;
    d.vy += CFG.physics.gravity * dt;
    b.root.position.y -= d.vy * dt;
    if (d.target !== null && b.root.position.y <= d.target) {
      S.dropping.splice(S.dropping.indexOf(b), 1);
      if (b.trim) startTrim(b); else landBody(b);
    } else if (d.target === null && b.root.position.y < -0.5) {
      S.dropping.splice(S.dropping.indexOf(b), 1);
      missBody(b);
    }
  }
}

function landBody(b) {
  const { x, z, land } = b.drop;
  b.root.position.set(x, land + 0.5, z);
  const ev = Physics.evaluate(b.cells, x, land, z);
  const pl = b.pl;
  if (ev.stable) {
    const id = S.pieces.length;
    for (const c of b.cells) {
      const cx = x + c[0], cy = land + c[1], cz = z + c[2];
      World.add(cx, cy, cz, id);
      const bx = S.box; S.cubes++;
      bx.minX = Math.min(bx.minX, cx); bx.maxX = Math.max(bx.maxX, cx); bx.minY = Math.min(bx.minY, cy); bx.maxY = Math.max(bx.maxY, cy);
      bx.minZ = Math.min(bx.minZ, cz); bx.maxZ = Math.max(bx.maxZ, cz);
    }
    S.pieces.push(b); pl.stable++;
    if (!ev.perfect) pl.allPerfect = false;
    pl.overhang += ev.overhang;
    for (const c of ev.contacts) dustRing(x + c[0], land + c[1], z + c[2], 0xf4f1e8);
    Cam.shake = 0.05; AudioFX.thunk();
    // other parts of the same placement may now rest on this one
    for (const o of S.dropping) if (o.pl === pl && o.drop.target !== null) {
      const l2 = Physics.findLanding(o.cells, o.drop.x, o.drop.z);
      o.drop.land = l2; o.drop.target = l2 + 0.5;
      if (o.root.position.y < o.drop.target) o.root.position.y = o.drop.target;
    }
  } else {
    pl.allPerfect = false; pl.toppled = true;
    const fr = Physics.toppleFrame(ev);
    fr.pivot.y = land;
    S.falling.push({ root: b.root, mat: b.mat, phase: 'tip', axis: fr.axis, pivot: fr.pivot,
      basePos: b.root.position.clone(), baseQ: b.root.quaternion.clone(), ang: 0, w: 0.6, vel: null });
    AudioFX.thunk(); AudioFX.fall();
  }
  releaseSpawn();
  resolveBody(b);
}

function missBody(b) {
  b.pl.allPerfect = false;
  S.falling.push({ root: b.root, mat: b.mat, phase: 'fall', vel: new THREE.Vector3(0, -b.drop.vy, 0),
    axis: new THREE.Vector3(1, 0, 0.4).normalize(), w: 1.5 });
  AudioFX.fall();
  releaseSpawn();
  resolveBody(b);
}

function resolveBody(b) {
  b.pl.done++;
  if (b.pl.done >= b.pl.total) finishPlacement(b.pl);
}

// one placement = one piece, however many parts it was cut into
function finishPlacement(pl) {
  S.pending = Math.max(0, S.pending - 1);
  if (pl.predicted) S.predicted = Math.max(0, S.predicted - 1);
  if (pl.stable > 0) {
    S.placed++;
    const perfect = pl.allPerfect && !pl.trimmed;
    if (perfect) { S.perfects++; for (const b of S.pieces.slice(-pl.stable)) flash(b.mat, 0xfff1c2); AudioFX.perfect(); }
    const pts = perfect ? CFG.meter.perfect : CFG.meter.success;
    // the callout always says why a placement did or didn't count
    const label = perfect ? 'PERFECT' : pl.trimmed ? 'TRIMMED' : 'PLACED';
    addMeter(pts, label + (pts > 0 ? ' +' + pts : ''), perfect ? 'perfect' : 'good');
  } else {
    S.fell++;
    const kind = pl.allTrimmed ? 'allTrimmed' : pl.toppled ? 'topple' : 'miss';
    const label = { allTrimmed: 'ALL TRIMMED', topple: 'TOPPLED', miss: 'MISSED' }[kind];
    const lim = CFG.strikes.limit | 0;
    if (lim > 0 && CFG.strikes[kind]) { S.strikes++; toast(label + ' · STRIKE ' + S.strikes + '/' + lim, 'bad'); }
    else toast(label, 'bad');
  }
  if (pl.value != null) settleValue(pl.value, pl.stable > 0);
  updateHUD();
  if (Tutorial.mode === 'challenge') Tutorial.onPlacement(pl.stable > 0);
}

// Time-based coins: a landed tile pays what is left on its meter; below zero the value is charged instead.
function settleValue(v, landed) {
  const n = Math.round(v);
  if (n > 0 && landed) { Contract.addCoins(n, 'Quick placement', 'quick'); coinPop('+' + n, 'gain'); }
  else if (n < 0) { Contract.addCoins(n, 'Slow placement', 'penalty'); coinPop('\u2212' + (-n), 'loss'); }
}

// a tile whose value runs down to the expiry point is lost: it counts as a missed placement
function expireTile() {
  const p = S.piece; if (!p) return;
  endFreeze(p);
  vanish(p); S.piece = null; S.phase = 'wait'; S.waitT = CFG.spawnDelay; S.queuedDrop = false;
  ghost.group.visible = false;
  S.fell++;
  const n = Math.round(CFG.tileValue.expireAt);
  if (n < 0) { Contract.addCoins(n, 'Tile expired', 'penalty'); coinPop('\u2212' + (-n), 'loss'); }
  const lim = CFG.strikes.limit | 0;
  if (lim > 0 && CFG.strikes.miss) { S.strikes++; toast('TILE EXPIRED · STRIKE ' + S.strikes + '/' + lim, 'bad'); }
  else toast('TILE EXPIRED', 'bad');
  AudioFX.fall();
  updateHUD();
}

/* Freeze Time: the tile holds still on the grid and its value stops draining. A / D step it along its line. */
const ICE = new THREE.Color(0x8fd3e8);
export function startFreeze(seconds) {
  const p = S.piece; if (!p || S.phase !== 'aim') return false;
  S.active.freeze = seconds;
  p.t = Math.round(p.t); p.nudge.set(0, 0);
  p.mat.emissive.copy(ICE); p.mat.emissiveIntensity = 0.28;
  return true;
}
function endFreeze(p) {
  if (!(S.active.freeze > 0)) return;
  S.active.freeze = 0;
  if (p) { p.mat.emissive.setHex(0x000000); p.mat.emissiveIntensity = 0; }
}
export function nudgeTile(dir) {
  const p = S.piece; if (!p || S.phase !== 'aim' || !(S.active.freeze > 0) || S.active.block) return;
  const t = Math.min(p.hi, Math.max(p.lo, Math.round(p.t) + dir));
  if (t === Math.round(p.t)) { AudioFX.tone(220, 0.05, 'triangle', 0.04); return; }
  p.t = t; AudioFX.tick();
}

function addMeter(pts, text, kind) {
  toast(text, kind);
  if (!(pts > 0)) return;
  const max = Math.max(1, CFG.meter.max | 0);
  const wasReady = S.meter >= max;
  S.meter = Math.min(max, S.meter + pts);
  meterEl.classList.remove('bump'); void meterEl.offsetWidth; meterEl.classList.add('bump');
  if (S.meter >= max && !wasReady) celebrate();
}


export function usePower(kind) {
  if (!Powers.activate(kind)) return;
  ghost.sig = '';
  AudioFX.tick();
  updateHUD();
}

function updatePiece(dt) {
  const p = S.piece; if (!p) return;
  p.born = Math.min(1, p.born + dt / 0.18);
  const sc = p.born < 1 ? 1 - Math.pow(1 - p.born, 3) : 1;
  p.root.scale.setScalar(Math.max(0.01, sc));
  if (p.anim) { p.anim.t += dt; if (p.anim.t >= p.anim.dur) p.anim = null; }
  const { Q, V } = visState(p);
  p.body.quaternion.copy(Q); p.body.position.copy(V);
  if (S.active.block) { /* aiming a bonus block: the tile waits, its value paused */ }
  else if (S.active.freeze > 0) {
    S.active.freeze = Math.max(0, S.active.freeze - dt);
    if (!S.active.freeze) endFreeze(p);
  } else {
    Movement.update(p, dt);
    if (p.value != null && p.locked == null) {
      p.value -= Math.max(0, CFG.tileValue.drainPerSec) * dt;
      if (p.value <= CFG.tileValue.expireAt && !S.queuedDrop) { p.value = CFG.tileValue.expireAt; updateTileValue(); expireTile(); return; }
    }
  }
  updateTileValue();
  const [x, z] = Movement.xz(p);
  p.nudge.multiplyScalar(Math.exp(-18 * dt));
  p.hoverY += (hoverBaseY() - p.hoverY) * (1 - Math.exp(-6 * dt));
  p.root.position.set(x + p.nudge.x, p.hoverY + 0.5, z + p.nudge.y);
}

function updateFalling(dt) {
  const g = CFG.physics.gravity;
  for (let i = S.falling.length - 1; i >= 0; i--) {
    const f = S.falling[i];
    if (f.phase === 'tip') {
      if (f.tipDur) {                          // timed hinge (trimmed cubes): reach the release angle in tipDur
        f.tipT += dt; const u = Math.min(1, f.tipT / f.tipDur);
        f.ang = 1.06 * u * u; f.w = 2.12 / f.tipDur;
      } else { f.w += CFG.physics.toppleAccel * dt; f.ang += f.w * dt; }
      const q = new THREE.Quaternion().setFromAxisAngle(f.axis, f.ang);
      f.root.position.copy(f.basePos).sub(f.pivot).applyQuaternion(q).add(f.pivot);
      f.root.quaternion.copy(q).multiply(f.baseQ);
      if (f.ang > 1.05) {
        const r = f.root.position.clone().sub(f.pivot);
        f.vel = f.axis.clone().multiplyScalar(f.w).cross(r);
        f.phase = 'fall';
      }
    } else {
      f.vel.y -= g * 0.6 * dt;
      f.root.position.addScaledVector(f.vel, dt);
      f.root.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(f.axis, f.w * dt));
      let gone = f.root.position.y < -17;
      if (f.fade !== undefined) {
        f.fade += dt;
        const k = Math.max(0, 1 - f.fade / (f.fadeDur || 0.25));
        f.root.scale.setScalar(k * (2 - k));
        if (k <= 0) gone = true;
      }
      if (gone) { scene.remove(f.root); f.mat.dispose(); S.falling.splice(i, 1); }
    }
  }
}


export function reset(keepTutorial = false) {
  Powers.reset();
  S.screen = '';
  document.querySelector('.hud-top').inert = false;
  Contract.clear();
  if (!keepTutorial) Tutorial.clear();
  for (const p of S.pieces) { scene.remove(p.root); p.mat.dispose(); }
  for (const f of S.falling) { scene.remove(f.root); f.mat.dispose(); }
  if (S.piece) { scene.remove(S.piece.root); S.piece.mat.dispose(); }
  for (const b of S.dropping) { scene.remove(b.root); b.mat.dispose(); }
  for (const t of S.trims) { scene.remove(t.b.root); t.b.mat.dispose(); }
  Bonus.cancel(true);
  Object.assign(S, { phase: 'wait', piece: null, waitT: 0.3, meter: 0, active: { shadow: 0, freeze: 0, block: false }, tileQueue: [],
    placed: 0, fell: 0, perfects: 0, pieces: [], falling: [], cubes: 0, box: freshBox(), endT: 0, dropping: [], trims: [], pending: 0, queuedDrop: false, predicted: 0,
    strikes: 0, paused: false, celebrateUntil: 0 });
  pauseEl.hidden = true;
  document.getElementById('sheet').hidden = true;
  meterEl.classList.remove('full','bump');
  endEl.hidden = true; controlsEl.hidden = false;
  const seed = CFG.seed ? CFG.seed : (Math.random() * 2 ** 31) | 0;
  setSeed(seed); S.seed = seed;
  Movement.axisFlip = 0;
  World.reset(); buildBaseplate(); refitScenery(); buildSegs(); updateHUD(); updateTileValue();
  ghost.group.visible = false; ghost.sig = ''; lane.key = '';
}


/* end of run */
export function compactness() {
  const b = S.box; if (!S.cubes) return 0;
  const vol = (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1) * (b.maxZ - b.minZ + 1);
  return S.cubes / vol;
}


/* clock for the pulsing guides; advanced by the animation loop only (debug stepping leaves it alone) */
export let clock = 0;
export function advanceClock(dt) { clock += dt; }

export function step(dt) {
  if (S.screen) return;
  if (S.phase === 'finishing') { Contract.tick(dt); Cam.update(dt); return; }
  if (S.phase === 'over') { Cam.update(dt); return; }
  Powers.update();
  if (Tutorial.mode === 'overview' || Tutorial.mode === 'complete') { Cam.update(dt); return; }
  if (Tutorial.mode === 'challenge') {
    if (S.phase === 'aim') updatePiece(dt);
    updateDropping(dt); updateTrims(dt); updateFalling(dt); updateFx(dt);
    updateGhost(clock); updateLane(clock); Tutorial.tick(dt); Cam.update(dt);
    return;
  }
  const lim = CFG.strikes.limit | 0;
  const out = lim > 0 && S.strikes >= lim;
  // safety net: a strike that only resolved after the next piece appeared still ends the run now
  if (out && S.phase === 'aim' && S.piece) { vanish(S.piece); S.piece = null; S.phase = 'wait'; S.queuedDrop = false; }
  if (S.active.block) Bonus.update(clock);
  if (S.phase === 'wait' && !S.active.block) {
    S.waitT -= dt;
    const outSoon = lim > 0 && S.strikes + S.predicted >= lim;   // the piece in flight is a known final strike
    const settled = S.falling.length === 0 && S.pending === 0;
    if (out || used() >= runTotal()) {       // out of strikes or pieces: end once everything has settled
      if (settled) { S.endT += dt; if (S.endT > 0.6) { endRun(out ? 'strikes' : 'complete'); updateGhost(clock); updateLane(clock); return; } }
    } else if (!outSoon && S.waitT <= 0) spawn();
  }
  if (S.phase === 'aim') updatePiece(dt);
  updateDropping(dt);
  updateTrims(dt);
  if (S.queuedDrop && S.pending === 0 && !S.active.block) { S.queuedDrop = false; place(); }
  updateFalling(dt);
  updateFx(dt);
  if (Contract.checkCompletion()) endRun('complete');
  updateGhost(clock);
  updateLane(clock);
  updateTileValue();
  Cam.update(dt);
}
