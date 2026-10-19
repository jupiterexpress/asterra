import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles.css';
import { CFG, dailySeed, dailyDayNum } from './config.js';
import { World } from './world.js';
import { Physics } from './physics.js';
import { Movement } from './movement.js';
import { renderer, scene, camera } from './scene.js';
import { Cam, initCameraInput } from './camera.js';
import { S } from './state.js';
import { step, advanceClock, reset, spawn, place, rotateY, tip, turn, usePower, startFreeze, nudgeTile } from './game.js';
import { initUI, setPaused, celebrate, updateHUD, setDayNum, updateCoins, openCoins, setHomeHandler } from './ui.js';
import { Tutorial } from './tutorial.js';
import { Opening, readSave, writeSave } from './opening.js';
import { Contract } from './contract.js';
import { Powers } from './powerups.js';
import { initScenery, updateScenery } from './scenery.js';
import { Bonus } from './bonus.js';
import { Home } from './home.js';

/* =====================================================================
   DAILY SEED — inject the day's seed into CFG before reset() is called
   ===================================================================== */
if (!CFG.seed) CFG.seed = dailySeed();
const DAY = dailyDayNum();

/* =====================================================================
   LOOP
   ===================================================================== */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w < h ? 50 : 40; camera.updateProjectionMatrix();
  measureSafe();
}
// Keep the build clear of the top HUD and the control dock: record the screen band between them (clip-space y).
// Measured only while both are on screen; hidden panels report zero size.
const hudTop = document.querySelector('.hud-top'), dockEl = document.querySelector('#controls .dock');
function measureSafe() {
  const h = window.innerHeight, t = hudTop.getBoundingClientRect(), d = dockEl.getBoundingClientRect();
  if (!t.height || !d.height || document.getElementById('controls').hidden) return;
  // the tile value meter sits just above the dock: leave room for it
  const top = 1 - 2 * (t.bottom + 10) / h, bottom = 1 - 2 * (d.top - 52) / h;
  if (top - bottom < 0.6) return;
  const safe = { top: Math.round(top * 50) / 50, bottom: Math.round(bottom * 50) / 50 };
  if (!Cam.safe || Cam.safe.top !== safe.top || Cam.safe.bottom !== safe.bottom) Cam.safe = safe;
}
setInterval(measureSafe, 500);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (Opening.active) { Opening.render(dt); requestAnimationFrame(frame); return; }
  // the home hub turns the island slowly behind its path
  if (S.screen === 'home' && !reduceMotion.matches) Cam.goalYaw += dt * 0.06;
  if (S.paused || S.screen) Cam.update(dt); else { advanceClock(dt); step(dt); }
  updateScenery(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
initScenery();
if (location.search.includes('debug')) { window.__cam = Cam; window.__renderer = renderer; }
initUI();
Powers.init({ use: usePower, update: updateHUD, freeze: startFreeze });
initCameraInput();
Tutorial.init({ reset, spawn, home: () => Home.show({ fresh: Contract.nextIndex === 0 }), update: updateHUD });
Contract.init({ reset, coins: () => updateCoins(), home: () => Home.show(), leaveHome: () => Home.hide() });
Home.init({ reset, openCoins });
setHomeHandler(() => Home.show());
updateCoins();
Opening.init({ reset, tutorial: () => Tutorial.start() });
setDayNum(DAY);

// Launch routing. All progress lives in this browser's localStorage (no accounts).
//   New player  -> welcome story -> how to play -> home.
//   Returning   -> home (never straight into a contract).
// Anyone with saved contract progress counts as returning, even if an older build never set the tutorial flag.
const returning = readSave('polycube-tutorial-complete') === '1' || Contract.nextIndex > 0 || Contract.coins > 0;
if (returning) Home.show();
else Opening.start();

resize();
Cam.update(1);
requestAnimationFrame(frame);

/* debug handle */
window.STACKER = { CFG, S, World, Physics, Movement, Cam, Tutorial, Opening, Contract, Powers, Home,
  spawn, scene, camera: () => camera, place, rotate: rotateY, tip, turn, Bonus, startFreeze, nudgeTile, openCoins,
  setPaused, celebrate: () => { S.meter = CFG.meter.max; celebrate(); }, usePower, reset, DAY,
  step(n, dt, noRender) { for (let i = 0; i < n; i++) step(dt || 1 / 60); if (!noRender) renderer.render(scene, camera); } };
