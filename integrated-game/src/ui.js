import { CFG } from './config.js';
import {Store} from '../shared/store.js';
import {DEFAULT_KEYS,ACTION_LABELS,assignKey,displayKey} from '../shared/settings.js';
import { World } from './world.js';
import { AudioFX } from './audio.js';
import { Cam } from './camera.js';
import { ghost } from './guides.js';
import { S, used, runTotal, speedMul } from './state.js';
import { place, rotateY, tip, turn, canTurn, usePower, reset, compactness, nudgeTile } from './game.js';
import { Bonus } from './bonus.js';
import { Tutorial } from './tutorial.js';
import { Contract } from './contract.js';
import { Powers, POWERUPS } from './powerups.js';

/* =====================================================================
   UI
   ===================================================================== */
export const $ = id => document.getElementById(id);
export const statsEl = $('stats'), meterEl = $('meter'), segsEl = $('segs'), meterNum = $('meterNum');
export const pauseEl = $('pause'), appEl = $('app');
export const endEl = $('end'), controlsEl = $('controls'), turnBtn = $('turnBtn'), turnLabel = $('turnLabel');

let _dayNum = 0, goHome = () => {};
export function setHomeHandler(fn) { goHome = fn; }
export function setDayNum(n) { _dayNum = n; const el = $('dayLabel'); if (el) el.textContent = n > 0 ? 'DAY ' + n : ''; }
export const powerBtn = $('powerBtn'), placeBtn = $('placeBtn'), tipBtn = $('tipBtn'), toastEl = $('toast'), hintEl = $('hint');

export function buildSegs() {
  const n = Math.max(1, CFG.meter.max | 0);
  segsEl.innerHTML = '';
  for (let i = 0; i < n; i++) { const s = document.createElement('div'); s.className = 'seg'; segsEl.appendChild(s); }
}
export function updateHUD() {
  Contract.update();
  const b = World.bounds, max = Math.max(1, CFG.meter.max | 0);
  if (segsEl.children.length !== max) buildSegs();
  const celebrating = Powers.ready;
  [...segsEl.children].forEach((s, i) => s.classList.toggle('on', celebrating || i < S.meter));
  meterNum.textContent = (celebrating ? max : Math.min(S.meter, max)) + '/' + max;
  $('meterHint').textContent = celebrating ? `Powerup ready · press ${displayKey(keyFor('power'))}` : 'Perfect drops charge it';
  meterEl.classList.toggle('full', celebrating);
  updateCoins();
  statsEl.innerHTML =
    '<span>PIECE</span> <b>' + Math.min(runTotal(), used() + (S.piece ? 1 : 0)) + '/' + runTotal() + '</b> <span>·</span> ' +
    '<span>PLACED</span> <b>' + S.placed + '</b> <span>· FELL</span> <b>' + S.fell + '</b>' +
    ' <span>· HEIGHT</span> <b>' + (b.topY + 1) + '</b>' + strikeMarks() + speedTag();
  Powers.update();
  // On a contract the run stats live inside the contract panel, so nothing in the top-left can overlap.
  // the practice round and contracts don't use the daily-run stats line
  statsEl.hidden = Contract.active || Tutorial.mode !== 'off';
  $('dayLabel').hidden = Contract.active || Tutorial.mode !== 'off' || !_dayNum;
  if (Contract.active) $('contractStats').innerHTML = `<span>TILES</span> <b>${Math.min(runTotal(), used()+(S.piece ? 1 : 0))}/${runTotal()}</b> <span>·</span> <span>PLACED</span> <b>${S.placed}</b>${strikeMarks()}`;
  tipBtn.hidden = !CFG.rotate.allowTip;
  const p = S.piece, lim = CFG.turn.maxPerPiece | 0, cost = CFG.turn.meterCost | 0;
  let sub = '';
  if (lim > 0) sub = Math.max(0, lim - (p ? p.turns : 0)) + ' left';
  if (cost > 0) sub = (sub ? sub + ' · ' : '') + cost + ' pwr';
  turnLabel.innerHTML = 'AXIS' + (sub ? '<small> ' + sub + '</small>' : '');
  turnBtn.classList.toggle('spent', !!p && !canTurn(p));
}
function speedTag() {
  const m = S.piece ? S.piece.speedMul : speedMul(used());
  return m > 1.001 ? ' <span>· SPEED</span> <b>' + m.toFixed(2) + '×</b>' : '';
}
function strikeMarks() {
  const lim = CFG.strikes.limit | 0; if (lim <= 0) return '';
  let m = '';
  for (let i = 0; i < lim; i++) m += i < S.strikes ? '<i class="hit">✕</i>' : '<i>○</i>';
  return ' <span>·</span> <span class="strk" aria-label="' + S.strikes + ' of ' + lim + ' strikes">' + m + '</span>';
}
export function toast(text, kind) {
  toastEl.textContent = text; toastEl.className = 'toast ' + (kind || '');
  void toastEl.offsetWidth; toastEl.classList.add('show');
}
export function hideHint() { hintEl.classList.add('gone'); }

/* ---------- coins ---------- */
let shownCoins = null;
export function updateCoins() {
  const n = Contract.coins;
  if (n === shownCoins) return;
  const up = shownCoins !== null && n > shownCoins, down = shownCoins !== null && n < shownCoins;
  shownCoins = n;
  $('coinBalance').textContent = n.toLocaleString();
  if (!$('coinsPage').hidden) renderCoinsPage();
  const chip = $('coinBtn');
  if (up || down) { chip.classList.remove('gain', 'loss'); void chip.offsetWidth; chip.classList.add(up ? 'gain' : 'loss'); }
}
export function coinPop(text, kind) {
  const el = $('coinPop');
  el.textContent = text + ' ◈'; el.className = 'coin-pop ' + kind;
  void el.offsetWidth; el.classList.add('show');
}
function renderCoinsPage() {
  $('coinsTotal').textContent = Contract.coins.toLocaleString();
  const rows = Contract.ledger;
  $('coinsLedger').innerHTML = rows.length ? rows.map(r => {
    const amt = r.amount > 0 ? '+' + r.amount : r.amount < 0 ? '\u2212' + (-r.amount) : '0';
    return `<li class="${r.amount > 0 ? 'gain' : r.amount < 0 ? 'loss' : ''}"><span>${r.reason}${r.contract && !r.reason.startsWith(r.contract) ? ' · ' + r.contract : ''}</span><b>${amt} ◈</b></li>`;
  }).join('') : '<li class="empty"><span>Coins you earn or spend this session show up here.</span></li>';
}
let coinsWasPaused = false, coinsFrom = '';
export function openCoins() {
  if (S.screen && S.screen !== 'coins' && S.screen !== 'home') return;
  if (S.phase === 'finishing') return;
  if (!$('coinsPage').hidden) { closeCoins(); return; }
  coinsWasPaused = S.paused; coinsFrom = S.screen === 'home' ? 'home' : '';
  S.screen = 'coins'; renderCoinsPage();
  $('closeCoins').innerHTML = (coinsFrom ? 'BACK' : 'BACK TO BUILDING') + ' <kbd>ESC</kbd>';
  $('coinsPage').hidden = false; controlsEl.hidden = true; pauseEl.hidden = true;
  document.querySelector('.hud-top').inert = true;
  $('closeCoins').focus({ preventScroll: true });
}
export function closeCoins() {
  if ($('coinsPage').hidden) return;
  $('coinsPage').hidden = true;
  if (S.screen === 'coins') S.screen = coinsFrom;
  if (coinsFrom === 'home') { coinsFrom = ''; $('homeCoins').focus({ preventScroll: true }); return; }
  document.querySelector('.hud-top').inert = false;
  if (coinsWasPaused) { pauseEl.hidden = false; controlsEl.hidden = true; }
  else controlsEl.hidden = S.phase === 'over' || S.phase === 'finishing' || Tutorial.mode === 'overview' || Tutorial.mode === 'complete' || !!S.screen;
  if (S.screen === 'contract') controlsEl.hidden = true;
}

/* ---------- tile value meter ---------- */
let tvSig = '';
export function updateTileValue() {
  const el = $('tileValue'), p = S.piece;
  const show = !!p && p.value != null && S.phase === 'aim';
  if (!show) { if (!el.hidden) { el.hidden = true; tvSig = ''; } return; }
  const T = CFG.tileValue, v = p.locked != null ? p.locked : p.value, n = Math.round(v);
  const span = Math.max(1, T.start - T.expireAt), k = Math.min(1, Math.max(0, (v - T.expireAt) / span));
  const state = n > 0 ? (v > T.start * 0.3 ? 'good' : 'low') : n === 0 ? 'zero' : 'neg';
  const paused = S.active.freeze > 0 || S.active.block;
  const sig = n + state + paused + (p.locked != null);
  el.hidden = false;
  $('tvFill').style.transform = `scaleX(${k})`;
  if (sig === tvSig) return;
  tvSig = sig;
  $('tvZero').style.left = (Math.min(1, Math.max(0, -T.expireAt / span)) * 100) + '%';
  el.className = 'tile-value ' + state + (paused ? ' paused' : '');
  el.setAttribute('aria-valuenow', n);
  $('tvAmount').textContent = (n > 0 ? '+' : n < 0 ? '\u2212' : '') + Math.abs(n) + ' ◈';
  $('tvNote').textContent = p.locked != null ? 'Locked in' : paused ? 'Paused' : n > 0 ? (state === 'good' ? 'Drop fast to earn more' : 'Running low') : n === 0 ? 'Worth nothing now' : `Penalty · expires at ${T.expireAt}`;
}

// buttons: fire on pointerdown for responsiveness; keyboard activation arrives as click with detail 0.
// A mouse press never leaves focus on a game button, so Space always means DROP and never re-presses that button.
function bindBtn(el, fn) {
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); AudioFX.unlock(); if (S.paused || el.disabled) return; el.classList.add('pressed'); fn();
  });
  el.addEventListener('mousedown', e => e.preventDefault());
  const up = () => { el.classList.remove('pressed'); if (document.activeElement === el) el.blur(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
  el.addEventListener('click', e => { if (e.detail === 0 && !S.paused) fn(); });
}

export function setPaused(on) {
  if (S.screen) return;
  if (Tutorial.mode === 'overview' || Tutorial.mode === 'complete') return;
  if (S.phase === 'finishing') { S.paused = on; return; }
  if (on && S.phase === 'over') return;
  S.paused = on;
  pauseEl.hidden = !on || !sheet.hidden;
  controlsEl.hidden = on || S.phase === 'over';
  if (on) toastEl.className = 'toast';
}


export const sheet = $('sheet');
const baseCameraSensitivity=CFG.camera.sens;
let capturing=null;
const keyFor=action=>Store.data.settings.keys[action];
const actionFor=key=>Object.keys(DEFAULT_KEYS).find(action=>keyFor(action)===key);
function applySettings(){
  AudioFX.muted=!Store.data.settings.sound;
  CFG.camera.sens=baseCameraSensitivity*Store.data.settings.cameraSensitivity;
  $('settingName').value=Store.data.profile.name||'';
  $('settingSound').checked=Store.data.settings.sound;
  $('settingCamera').value=String(Store.data.settings.cameraSensitivity);
  $('settingCameraValue').textContent=Store.data.settings.cameraSensitivity.toFixed(1)+'×';
  $('settingKeys').replaceChildren();
  for(const [action,label] of Object.entries(ACTION_LABELS)){
    const button=document.createElement('button');button.type='button';button.dataset.action=action;
    const caption=document.createElement('span'),key=document.createElement('kbd');caption.textContent=label;key.textContent=displayKey(keyFor(action));button.append(caption,key);
    button.onclick=()=>{capturing=action;document.querySelectorAll('#settingKeys button').forEach(b=>b.classList.toggle('capturing',b===button));key.textContent='PRESS KEY';$('settingsMessage').textContent=`Press a new key for ${label}.`;};
    $('settingKeys').append(button);
  }
  for(const action of Object.keys(DEFAULT_KEYS))document.querySelectorAll(`[data-key-action="${action}"]`).forEach(el=>el.textContent=displayKey(keyFor(action)));
  $('rotBtn').setAttribute('aria-label',`Rotate tile (${displayKey(keyFor('rotate'))})`);
  $('tipBtn').setAttribute('aria-label',`Flip tile (${displayKey(keyFor('flip'))})`);
  $('turnBtn').setAttribute('aria-label',`Switch travel axis (${displayKey(keyFor('axis'))})`);
  $('placeBtn').setAttribute('aria-label',`Drop tile (${displayKey(keyFor('drop'))})`);
  $('hint').textContent=`Drag to orbit · Scroll to zoom · ${displayKey(keyFor('rotate'))} rotate · ${displayKey(keyFor('flip'))} flip · ${displayKey(keyFor('axis'))} axis · ${displayKey(keyFor('drop'))} drop`;
}
export function openSettings(){
  applySettings();sheet.hidden=false;$('settingsMessage').textContent='';
  $('cityHub').inert=true;
  if(S.screen!=='home'){S.paused=true;controlsEl.hidden=true;pauseEl.hidden=true;}
  $('settingName').focus({preventScroll:true});
}
function closeSettings(){
  capturing=null;sheet.hidden=true;
  $('cityHub').inert=false;
  if(S.screen!=='home'&&S.paused)setPaused(true);
  else $('hubSettings')?.focus({preventScroll:true});
}
function pressFx(el) { el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 110); }


/* Full charge stays available until a powerup is actually used. */
export function celebrate() {
  S.celebrateUntil = performance.now() + 450;
  meterEl.classList.add('full');
  Powers.notifyReady(); AudioFX.power();
  toast('POWER READY', 'perfect');
  // the button pulses, glows and shakes (CSS .ready); this extra burst marks the moment it arrives
  powerBtn.classList.remove('arriving'); void powerBtn.offsetWidth; powerBtn.classList.add('arriving');
  setTimeout(() => powerBtn.classList.remove('arriving'), 1300);
  updateHUD();
}


export function endRun(why) {
  if (Contract.active) { Contract.end(why); hideHint(); return; }
  S.phase = 'over';
  const dayLabel = _dayNum > 0 ? ' · DAY ' + _dayNum : '';
  $('endTitle').textContent = (why === 'strikes' ? 'OUT OF STRIKES' : 'BUILD COMPLETE') + dayLabel;
  const b = World.bounds;
  const compact = Math.round(compactness() * 100);
  const stats = [
    ['PLACED', S.placed + '/' + runTotal()], ['FELL', S.fell], (CFG.strikes.limit | 0) > 0 ? ['STRIKES', S.strikes + '/' + (CFG.strikes.limit | 0)] : ['PERFECT', S.perfects],
    ['HEIGHT', b.topY + 1], ['FOOTPRINT', (b.maxX - b.minX + 1) + '×' + (b.maxZ - b.minZ + 1)],
    ['COMPACT', compact + '%', 'hi'],
  ];
  $('endGrid').innerHTML = stats.map(([k, v, c]) => '<div class="' + (c || '') + '"><span>' + k + '</span><b>' + v + '</b></div>').join('');
  $('endSub').textContent = S.cubes + ' cubes · ' + S.perfects + ' perfect · tap to share · drag to rotate';
  $('againBtn').textContent = 'BUILD AGAIN';
  // wire share button (idempotent)
  const shareBtn = $('shareBtn');
  if (shareBtn) {
    shareBtn.hidden = false;
    shareBtn.onclick = () => {
      const row = why === 'strikes' ? '❌' : compact >= 80 ? '🏆' : compact >= 60 ? '🥇' : compact >= 40 ? '🥈' : '🥉';
      const placed = S.placed, total = runTotal(), perfects = S.perfects;
      const bars = Math.round(compact / 20);
      const density = '█'.repeat(bars) + '░'.repeat(5 - bars);
      const dayStr = _dayNum > 0 ? ' #' + _dayNum : '';
      const txt = `Asterra Daily${dayStr}  ${row}
${placed}/${total} placed · ${perfects} perfect
${density} ${compact}% compact
asterra.app`;
      if (navigator.share) navigator.share({ text: txt }).catch(() => {});
      else { navigator.clipboard.writeText(txt).then(() => toast('Copied!', 'good')).catch(() => toast(txt, 'good')); }
    };
  }
  controlsEl.hidden = true; endEl.hidden = false; hideHint();
  AudioFX.power();
}


/* wire every control once at startup */
export function initUI() {
  document.body.append(sheet);
  bindBtn($('rotBtn'), rotateY);
  bindBtn(tipBtn, tip);
  bindBtn(placeBtn, place);
  bindBtn(turnBtn, turn);
  $('againBtn').addEventListener('click', () => Contract.active ? Contract.start() : reset());
  $('pauseBtn').addEventListener('click', () => setPaused(!S.paused));
  $('resumeBtn').addEventListener('click', () => setPaused(false));
  $('pRestartBtn').addEventListener('click', () => { if (Tutorial.mode === 'challenge') Tutorial.challenge(); else if (Contract.active) Contract.start(); else reset(); setPaused(false); });
  $('tutorialReplay').addEventListener('click', () => Tutorial.start());
  $('pHomeBtn').addEventListener('click', () => { setPaused(false); goHome(); });
  $('pTuneBtn').addEventListener('click',openSettings);
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); else if (S.phase === 'finishing') S.paused = false; });
  window.addEventListener('blur', () => setPaused(true));
  window.addEventListener('focus', () => { if (S.phase === 'finishing') S.paused = false; });
  bindBtn(powerBtn, () => Powers.open());
  // Desktop keys: R rotate · F flip · X axis · Space drop · Q powerups · C coins · P/Esc pause · arrows orbit.
  // Modifier combos (Cmd/Ctrl/Alt) are left to the browser; held keys do not repeat game actions.
  const GAME_KEYS = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown']);
  const inGameUI = el => !el || el === document.body || !!el.closest?.('#controls, .hud-top, #scene, #activePowers');
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if(!sheet.hidden){
      e.stopImmediatePropagation();
      if(capturing){e.preventDefault();e.stopPropagation();if(k==='escape'){$('settingsMessage').textContent='Key change cancelled.';capturing=null;applySettings();return;}
        const problem=assignKey(Store.data.settings,capturing,k);if(problem){$('settingsMessage').textContent=problem;return;}
        Store.save();const label=ACTION_LABELS[capturing];capturing=null;applySettings();$('settingsMessage').textContent=`${label} now uses ${displayKey(k)}.`;return;
      }
      if(k==='escape'){e.preventDefault();closeSettings();}return;
    }
    if (S.screen === 'coins') { if (k === 'escape' || k === keyFor('coins')) { e.preventDefault(); closeCoins(); } return; }
    if (S.screen === 'powers') {
      if (k === 'escape' || k === keyFor('power')) { e.preventDefault(); Powers.close(); return; }
      const opt = Object.entries(POWERUPS).find(([, p]) => p.key === k);
      if (opt && !e.repeat) { e.preventDefault(); usePower(opt[0]); }
      return;
    }
    if (S.screen === 'tiles') {
      if (k === 'escape') { e.preventDefault(); Powers.open(); return; }
      if (/^[1-5]$/.test(k) && !e.repeat) { e.preventDefault(); Powers.toggleTile(Number(k) - 1); return; }
      if (k === 'enter' && !e.target.closest?.('button') && !e.repeat) { e.preventDefault(); Powers.confirmTiles(); }
      return;
    }
    if (S.screen || S.phase === 'finishing' || (e.target.closest && e.target.closest('.sheet, input, textarea, select'))) return;
    if (Tutorial.mode === 'overview' || Tutorial.mode === 'complete') return;
    // a focused dialog button keeps its native Space/Enter; game buttons never swallow game keys
    if (!inGameUI(e.target) && (k === ' ' || k === 'enter')) return;
    const action=actionFor(k);
    if (GAME_KEYS.has(k)||action) e.preventDefault();
    if (action==='pause' || k === 'escape') {
      if (e.repeat) return;
      if (k === 'escape' && S.active.block) { Bonus.cancel(); updateHUD(); return; }
      setPaused(!S.paused); return;
    }
    if (S.paused || S.phase === 'over') return;
    if (action==='coins') { if (!e.repeat && Contract.active) openCoins(); return; }
    if (S.active.block) {                                  // aiming a bonus block
      if (action==='drop') { if (!e.repeat) place(); }
      else if (k === 'arrowleft' || action==='nudgeLeft') Bonus.move(-1, 0);
      else if (k === 'arrowright' || action==='nudgeRight') Bonus.move(1, 0);
      else if (k === 'arrowup' || k === 'w') Bonus.move(0, 1);
      else if (k === 'arrowdown' || k === 's') Bonus.move(0, -1);
      return;
    }
    if (e.repeat && action!=='nudgeLeft' && action!=='nudgeRight' && !k.startsWith('arrow')) return;
    if (action==='drop') { pressFx(placeBtn); place(); }
    else if (action==='rotate') { pressFx($('rotBtn')); rotateY(); }
    else if (action==='flip') { if (!tipBtn.hidden) { pressFx(tipBtn); tip(); } }
    else if (action==='axis') { pressFx(turnBtn); turn(); }
    else if (action==='power') { Powers.open(); }
    else if (action==='nudgeLeft') nudgeTile(-1);
    else if (action==='nudgeRight') nudgeTile(1);
    else if (k === 'arrowleft') Cam.goalYaw -= 0.15;
    else if (k === 'arrowright') Cam.goalYaw += 0.15;
    else if (k === 'arrowup') Cam.goalPitch += 0.1;
    else if (k === 'arrowdown') Cam.goalPitch -= 0.1;
  });
  // Space on a focused game button would otherwise also "click" it on key-up
  window.addEventListener('keyup', e => { if (e.key === ' ' && inGameUI(e.target) && !S.screen) e.preventDefault(); });
  $('coinBtn').addEventListener('click', () => { if (Contract.active || S.screen === 'contract') openCoins(); });
  $('closeCoins').addEventListener('click', closeCoins);
  $('coinsPage').addEventListener('click', e => { if (e.target === $('coinsPage')) closeCoins(); });
  $('activePowers').addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'block-cancel') { Bonus.cancel(); updateHUD(); }
    else if (act === 'nudge-back') nudgeTile(-1);
    else if (act === 'nudge-fwd') nudgeTile(1);
  });
  applySettings();
  $('gearBtn').addEventListener('click',()=>{if(S.phase!=='finishing')openSettings();});
  $('closeSheet').addEventListener('click',closeSettings);
  $('saveSettingName').addEventListener('click',()=>{const name=$('settingName').value.trim().slice(0,28);if(!name){$('settingsMessage').textContent='Enter a name first.';return;}Store.profile('name',name);$('hubGreeting').textContent=`Welcome home, ${name}.`;$('settingsMessage').textContent='Name saved.';});
  $('settingName').addEventListener('keydown',e=>{if(e.key==='Enter'){$('saveSettingName').click();e.preventDefault();}});
  $('settingSound').addEventListener('change',e=>{Store.data.settings.sound=e.target.checked;Store.save();AudioFX.muted=!e.target.checked;});
  $('settingCamera').addEventListener('input',e=>{Store.data.settings.cameraSensitivity=Number(e.target.value);Store.save();CFG.camera.sens=baseCameraSensitivity*Store.data.settings.cameraSensitivity;$('settingCameraValue').textContent=Store.data.settings.cameraSensitivity.toFixed(1)+'×';});
  $('resetSettingKeys').addEventListener('click',()=>{Store.data.settings.keys={...DEFAULT_KEYS};Store.save();applySettings();$('settingsMessage').textContent='Default keys restored.';});
}
