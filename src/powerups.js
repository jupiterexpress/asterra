import { CFG } from './config.js';
import { S } from './state.js';
import { Poly } from './poly.js';
import { voxelSVG } from './blueprints.js';
import { Bonus } from './bonus.js';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/* =====================================================================
   POWERUPS — perfect placements fill the power meter; when it is full the player picks one.
   Using a powerup resets the meter. Registry so more can be added later.
   ===================================================================== */
export const POWERUPS = {
  choice: { name: 'Tile Choice', icon: '▦', key: '1', description: 'See five tiles and pick your next three, in the order you want.' },
  freeze: { name: 'Freeze Time', icon: '❄', key: '2', description: 'Stop the current tile and its value. Turn it, then step it into place with A / D.' },
  block: { name: 'Add 1×1 Block', icon: '▣', key: '3', description: 'Place one extra block in any open spot of your plot, even under an overhang.' },
};

const $ = id => document.getElementById(id);
const shapes = [
  { name: 'Domino', cells: [[0,0,0],[1,0,0]] },
  { name: 'Line', cells: [[0,0,0],[1,0,0],[2,0,0]] },
  { name: 'Corner', cells: [[0,0,0],[1,0,0],[0,0,1]] },
  { name: 'Square', cells: [[0,0,0],[1,0,0],[0,0,1],[1,0,1]] },
  { name: 'Step', cells: [[0,0,0],[1,0,0],[1,1,0],[1,1,1]] },
].map(p => ({ ...p, cells: Poly.normalize(p.cells).cells }));

export const Powers = {
  selected: [], api: null,
  get ready() { return S.meter >= Math.max(1, CFG.meter.max|0); },
  init(api) {
    this.api = api;
    $('powerOptions').innerHTML = Object.entries(POWERUPS).map(([key,p]) => `<button class="power-option" data-power="${key}"><span class="power-glyph" aria-hidden="true">${p.icon}</span><span><strong>${p.name}</strong><small>${p.description}</small></span><kbd aria-hidden="true">${p.key}</kbd></button>`).join('');
    $('powerOptions').addEventListener('click', e => { const button = e.target.closest('[data-power]'); if (button && !button.disabled) this.api.use(button.dataset.power); });
    $('closePowers').addEventListener('click', () => this.close());
    $('cancelTiles').addEventListener('click', () => this.open());
    $('confirmTiles').addEventListener('click', () => this.confirmTiles());
    $('tileOptions').addEventListener('click', e => {
      const button = e.target.closest('[data-tile]'); if (button) this.toggleTile(Number(button.dataset.tile));
    });
    Bonus.init({ placed: () => { this.spend(); this.api.update(); }, changed: () => this.api.update() });
  },
  toggleTile(i) {
    if (!shapes[i]) return;
    const at = this.selected.indexOf(i);
    if (at >= 0) this.selected.splice(at,1); else if (this.selected.length < 3) this.selected.push(i);
    this.renderTiles();
  },
  confirmTiles() {
    if (!this.ready || this.selected.length !== 3) return;
    S.tileQueue = this.selected.map(i => shapes[i].cells.map(c => [...c]));
    this.spend(); this.close(); this.api.update();
  },
  notifyReady() {
    // Native iPhone haptics; browsers with the Vibration API buzz briefly. Everywhere else the visual alert carries it.
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    else if (typeof navigator.vibrate === 'function') { try { navigator.vibrate([40, 60, 40]); } catch { /* not allowed here */ } }
  },
  canOpen() { return this.ready && !S.paused && !S.active.block && ['aim','wait','drop'].includes(S.phase); },
  open() {
    if (!this.canOpen()) return;
    S.screen = 'powers'; $('powerPicker').hidden = false; $('tilePicker').hidden = true;
    $('controls').hidden = true; document.querySelector('.hud-top').inert = true;
    this.update(true);
    const first = document.querySelector('#powerOptions .power-option:not(:disabled)');
    (first || $('closePowers')).focus({ preventScroll: true });
  },
  close() {
    $('powerPicker').hidden = true; $('tilePicker').hidden = true;
    if (S.screen === 'powers' || S.screen === 'tiles') S.screen = '';
    document.querySelector('.hud-top').inert = false;
    $('controls').hidden = S.paused || S.phase === 'over' || S.phase === 'finishing';
  },
  spend() { S.meter = 0; $('meter').classList.remove('full'); $('powerBtn').classList.remove('ready','arriving'); },
  available(kind) {
    if (kind === 'choice') return !S.tileQueue.length;
    if (kind === 'freeze') return !!S.piece && S.phase === 'aim' && !(S.active.freeze > 0);
    if (kind === 'block') return !S.active.block;
    return false;
  },
  activate(kind) {
    if (!POWERUPS[kind] || !this.ready || S.paused || !['aim','wait','drop'].includes(S.phase)) return false;
    if (S.screen && S.screen !== 'powers') return false;
    if (!this.available(kind)) return false;
    if (kind === 'choice') {
      this.selected = []; S.screen = 'tiles'; $('powerPicker').hidden = true; $('tilePicker').hidden = false;
      $('controls').hidden = true; document.querySelector('.hud-top').inert = true;
      this.renderTiles(); $('tileOptions').querySelector('button')?.focus({ preventScroll: true }); return true;
    }
    if (kind === 'freeze') {
      if (!this.api.freeze(Math.max(1, CFG.powerups.freeze.seconds))) return false;
      this.spend();
    }
    if (kind === 'block') {
      // the meter is spent only once the block is actually placed; Esc backs out and keeps the powerup
      if (!Bonus.start()) return false;
    }
    this.close(); return true;
  },
  renderTiles() {
    $('tileOptions').innerHTML = shapes.map((p,i) => {
      const at = this.selected.indexOf(i);
      return `<button class="tile-option ${at >= 0 ? 'selected' : ''}" data-tile="${i}" aria-label="${p.name}${at>=0 ? ', choice '+(at+1) : ''}" aria-pressed="${at>=0}">${voxelSVG(p.cells)}<strong>${p.name}</strong><span>${at>=0 ? at+1 : i+1}</span></button>`;
    }).join('');
    $('tileSelection').textContent = this.selected.length ? this.selected.map((i,n) => `${n+1}. ${shapes[i].name}`).join(' → ') : 'Click three tiles (or press 1–5) in the order you want them.';
    $('confirmTiles').disabled = this.selected.length !== 3;
    $('confirmTiles').innerHTML = `QUEUE ${this.selected.length} / 3 TILES <kbd>ENTER</kbd>`;
  },
  reset() {
    this.close(); this.selected = [];
    this.signature = '';
    S.active = { shadow: 0, freeze: 0, block: false }; S.tileQueue = [];
  },
  update(force) {
    const ready = this.ready, active = [];
    if (S.tileQueue.length) active.push(`${S.tileQueue.length} chosen tile${S.tileQueue.length > 1 ? 's' : ''} queued`);
    const banner = S.active.block ? 'block' : S.active.freeze > 0 ? 'freeze:' + Math.ceil(S.active.freeze) : active.join('|');
    const options = Object.keys(POWERUPS).map(k => this.available(k)).join();
    const signature = [ready, banner, options].join();
    if (signature === this.signature && !force) return;
    this.signature = signature;
    const button = $('powerBtn');
    button.classList.toggle('ready', ready); button.classList.toggle('empty', !ready && !banner);
    button.classList.toggle('active', !!banner && !ready);
    button.disabled = !ready || S.active.block;
    button.innerHTML = S.active.block ? `<span class="power-star" aria-hidden="true">▣</span>BONUS BLOCK<small>aiming · Esc to cancel</small>`
      : `<kbd aria-hidden="true">Q</kbd><span class="power-star" aria-hidden="true">✧</span>${ready ? 'POWER READY' : 'POWERUPS'}<small>${ready ? 'choose one' : 'perfect drops charge it'}</small>`;
    button.classList.toggle('ready', ready && !S.active.block);
    document.querySelector('.dock').classList.toggle('locked', !!S.active.block);
    // banner above the controls for whatever is running right now
    const el = $('activePowers');
    if (S.active.block) {
      el.className = 'active-powers block';
      el.innerHTML = `<strong>BONUS BLOCK</strong><span>Aim with the mouse or <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> · <kbd>SPACE</kbd> place · <kbd>ESC</kbd> cancel</span><button type="button" data-act="block-cancel">CANCEL</button>`;
    } else if (S.active.freeze > 0) {
      el.className = 'active-powers freeze';
      el.innerHTML = `<strong>❄ FROZEN · ${Math.ceil(S.active.freeze)}s</strong><span>Tile value paused</span><span class="nudge"><button type="button" data-act="nudge-back" aria-label="Step tile back">◀ <kbd>A</kbd></button><button type="button" data-act="nudge-fwd" aria-label="Step tile forward"><kbd>D</kbd> ▶</button></span>`;
    } else {
      el.className = 'active-powers'; el.textContent = active.join(' · ');
    }
    el.hidden = !banner;
    for (const kind of Object.keys(POWERUPS)) {
      const option = document.querySelector(`[data-power="${kind}"]`);
      if (option) option.disabled = !this.available(kind);
    }
  },
};
