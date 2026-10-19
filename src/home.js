import { S } from './state.js';
import { CONTRACTS, voxelSVG } from './blueprints.js';
import { Contract } from './contract.js';
import { AudioFX } from './audio.js';

/* =====================================================================
   HOME — the hub between builds. Shows the contract path (done · current · locked),
   the coin balance, and where to go next. Progress itself lives in Contract (asterra-progress-v2);
   this screen only reads it. The one thing it stores is how many completed contracts the player
   has already seen celebrated here, so a fresh completion gets its checkmark animation exactly once.
   ===================================================================== */
const $ = id => document.getElementById(id);
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const save = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Session still works. */ } };
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const SEEN = 'asterra-home-seen';

// Path layout in a 460 × 500 box: a winding line through the three contracts, top to bottom.
const W = 460, H = 500;
const NODES = [{ x: 150, y: 78, side: 'right' }, { x: 312, y: 252, side: 'left' }, { x: 160, y: 426, side: 'right' }];
const SEGMENTS = [
  `M150 78 C150 168 312 162 312 252`,
  `M312 252 C312 342 160 336 160 426`,
];
const LEAD = `M262 -6 C262 40 150 22 150 78`;
const TITLE = s => s.toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());

const ICONS = {
  check: '<svg viewBox="0 0 40 40" aria-hidden="true"><path class="hn-check" d="M10 21 l7 7 L31 13"/></svg>',
  lock: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="11" y="18" width="18" height="14" rx="2.5"/><path d="M15 18 v-4 a5 5 0 0 1 10 0 v4" fill="none"/></svg>',
  star: '<svg viewBox="0 0 40 40" aria-hidden="true"><path class="hn-star" d="M20 7 l3.4 8.6 8.6 3.4 -8.6 3.4 L20 31 l-3.4 -8.6 -8.6 -3.4 8.6 -3.4z"/></svg>',
};

export const Home = {
  api: null, timers: [], freshStart: false, confirming: false,
  init(api) {
    this.api = api;
    // Saves from before this screen existed: treat every contract already finished as already celebrated.
    if (read(SEEN) === null) save(SEEN, String(this.doneCount()));
    $('homeContinue').addEventListener('click', () => this.continue());
    $('homeCity').addEventListener('click', () => this.city());
    $('homeCoins').addEventListener('click', () => this.api.openCoins());
    $('homeReset').addEventListener('click', () => this.askReset());
    $('resetCancel').addEventListener('click', () => this.closeReset());
    $('resetConfirm').addEventListener('click', () => this.reset());
    $('homeConfirm').addEventListener('click', e => { if (e.target === $('homeConfirm')) this.closeReset(); });
    $('homePath').addEventListener('click', e => {
      const node = e.target.closest('[data-node]'); if (node) this.pick(Number(node.dataset.node));
    });
    $('contractBack').addEventListener('click', () => this.show());
    $('districtHome').addEventListener('click', () => this.show());
    window.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (S.screen === 'home' && this.confirming) { e.preventDefault(); this.closeReset(); }
      else if (S.screen === 'contract' && !$('contractBrief').hidden) { e.preventDefault(); this.show(); }
      else if (S.screen === 'contract' && !$('districtDone').hidden) { e.preventDefault(); this.show(); }
    });
  },
  doneCount() { return Math.min(CONTRACTS.length, Contract.nextIndex); },
  get active() { return S.screen === 'home'; },

  /* Open the hub. `fresh` = arriving straight from the tutorial, so it greets a new contractor. */
  show({ fresh = false } = {}) {
    this.freshStart = fresh || (this.freshStart && this.doneCount() === 0);
    this.api.reset();
    S.screen = 'home';
    for (const id of ['controls', 'end', 'contractBrief', 'districtDone', 'tileValue']) $(id).hidden = true;
    document.querySelector('.hud-top').inert = true;
    document.body.classList.add('home-active');
    $('hint').classList.add('gone');
    $('home').hidden = false; this.closeReset();
    const seen = Math.max(0, Number(read(SEEN)) || 0), done = this.doneCount();
    const celebrate = done > seen && !reducedMotion() ? done - 1 : -1;
    this.render(celebrate);
    save(SEEN, String(done));
    if (celebrate < 0) $('homeContinue').focus({ preventScroll: true });
  },
  hide() {
    this.clearTimers(); this.closeReset();
    $('home').hidden = true; document.body.classList.remove('home-active');
    if (S.screen === 'home') S.screen = '';
    document.querySelector('.hud-top').inert = false;
  },
  clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; },
  later(ms, fn) { this.timers.push(setTimeout(fn, ms)); },

  state(i, celebrate) {
    const done = this.doneCount();
    // While the checkmark animation runs, the newly finished contract starts as "current" and the next one as locked.
    const progress = celebrate >= 0 ? celebrate : done;
    return i < progress ? 'done' : i === progress ? 'current' : 'locked';
  },

  render(celebrate = -1) {
    this.clearTimers();
    const done = this.doneCount(), all = done >= CONTRACTS.length;
    const name = (read('asterra-contractor') || '').trim();
    $('homeCoinBalance').textContent = Contract.coins.toLocaleString();
    $('homeGreeting').textContent = this.freshStart ? (name ? `Ready to build, ${name}?` : 'Ready to build?') : (name ? `Welcome back, ${name}.` : 'Welcome back.');
    $('homeSummary').textContent = all ? 'Every contract is complete. The neighborhood glows again.'
      : done ? `${done} of ${CONTRACTS.length} buildings complete. Asterra is coming back to life.`
      : 'Three contracts are waiting. Each one adds a building to the neighborhood.';
    $('homeCount').textContent = `${done} / ${CONTRACTS.length} BUILT`;
    $('homeMeter').style.width = `${(done / CONTRACTS.length) * 100}%`;

    // ---- the path
    const segs = SEGMENTS.map((d, i) => {
      const st = i < (celebrate >= 0 ? celebrate : done) ? 'done' : i === (celebrate >= 0 ? celebrate : done) ? 'next' : 'locked';
      return `<path class="hp-groove" d="${d}"/><path class="hp-line ${st}" data-seg="${i}" d="${d}" pathLength="100"/>`;
    }).join('');
    const nodes = CONTRACTS.map((p, i) => {
      const st = this.state(i, celebrate), n = NODES[i], rec = Contract.completed[i];
      const status = st === 'done' ? `<b class="hl-done">✓ BUILT</b>${rec?.grade ? ` · GRADE ${rec.grade}` : ''}`
        : st === 'current' ? `<b class="hl-next">${done === 0 && i === 0 ? 'START HERE' : 'UP NEXT'}</b> · ${p.tiles} TILES`
        : `LOCKED · FINISH ${CONTRACTS[i - 1].short.toUpperCase()}`;
      const label = st === 'done' ? `${p.name}, built${rec?.grade ? ', grade ' + rec.grade : ''}. Select to rebuild.`
        : st === 'current' ? `${p.name}, up next. Select to start.` : `${p.name}, locked. Finish ${CONTRACTS[i - 1].name} first.`;
      return `<div class="hstop ${st} side-${n.side}" role="listitem" data-stop="${i}" style="left:${n.x / W * 100}%;top:${n.y / H * 100}%">
        <span class="hn-bubble" aria-hidden="true">${done === 0 && i === 0 ? 'START' : 'CONTINUE'}</span>
        <button class="hnode" data-node="${i}" aria-label="${label}" ${st === 'locked' ? 'aria-disabled="true"' : ''}>
          <span class="hn-ring" aria-hidden="true"></span>
          <span class="hn-face">${ICONS.check}${ICONS.star}${ICONS.lock}</span>
          ${rec?.grade ? `<span class="hn-grade" aria-hidden="true">${rec.grade}</span>` : ''}
          <span class="hn-burst" aria-hidden="true">${'<i></i>'.repeat(8)}</span>
        </button>
        <div class="hlabel" aria-hidden="true">
          <span class="hl-kicker">${p.district}</span>
          <strong>${TITLE(p.name)}</strong>
          <span class="hl-art">${voxelSVG(rec?.cells?.length ? rec.cells : p.cells, st === 'locked' ? '#61807c' : st === 'done' ? '#eac38a' : '#88c8b7')}</span>
          <span class="hl-status">${status}</span>
        </div>
      </div>`;
    }).join('');
    $('homePath').innerHTML = `<svg class="hp-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="hpFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eac38a" stop-opacity="0"/><stop offset="1" stop-color="#eac38a" stop-opacity=".8"/></linearGradient>
        <linearGradient id="hpFadeGroove" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#081a1f" stop-opacity="0"/><stop offset="1" stop-color="#081a1f" stop-opacity=".55"/></linearGradient></defs>
        <path class="hp-groove lead" d="${LEAD}"/><path class="hp-line lead" d="${LEAD}"/>${segs}</svg>${nodes}`;

    this.renderNext(celebrate >= 0 ? celebrate : -1);
    if (celebrate >= 0) this.celebrate(celebrate);
  },

  /* The side card: what to do next. */
  renderNext(celebrating) {
    const done = this.doneCount(), all = done >= CONTRACTS.length;
    const btn = $('homeContinue'), card = $('homeNext');
    $('homeCity').disabled = done === 0;
    $('homeCityNote').textContent = done === 0 ? 'Finish a building first' : `${done} building${done > 1 ? 's' : ''} so far`;
    card.classList.toggle('all-done', all);
    if (all) {
      $('homeNextKicker').textContent = 'ALL CONTRACTS COMPLETE';
      $('homeNextTitle').textContent = 'Your neighborhood is rebuilt.';
      $('homeNextArt').innerHTML = CONTRACTS.map((p, i) => voxelSVG(Contract.completed[i]?.cells?.length ? Contract.completed[i].cells : p.cells, '#eac38a')).join('');
      $('homeNextText').textContent = 'Visit your city, or pick any building on the path to rebuild it for a denser grade.';
      $('homeNextSpecs').hidden = true;
      btn.innerHTML = 'VIEW CITY <span aria-hidden="true">→</span>';
      return;
    }
    const p = CONTRACTS[done];
    $('homeNextKicker').textContent = `NEXT UP · CONTRACT ${done + 1} OF ${CONTRACTS.length}`;
    $('homeNextTitle').textContent = TITLE(p.name);
    $('homeNextArt').innerHTML = voxelSVG(p.cells);
    $('homeNextText').textContent = p.description;
    $('homeNextSpecs').hidden = false;
    $('homeNextTarget').textContent = `${Math.round(p.goal * 100)}% filled`;
    $('homeNextTiles').textContent = `${p.tiles} tiles`;
    btn.innerHTML = `${done === 0 ? 'START BUILDING' : 'CONTINUE BUILDING'} <span aria-hidden="true">→</span>`;
    if (celebrating >= 0) card.classList.add('arriving');
    else card.classList.remove('arriving');
  },

  /* Checkmark → line fills → next contract unlocks. */
  celebrate(i) {
    const stop = () => $('homePath').querySelector(`[data-stop="${i}"]`);
    const seg = () => $('homePath').querySelector(`[data-seg="${i}"]`);
    const next = () => $('homePath').querySelector(`[data-stop="${i + 1}"]`);
    this.later(450, () => {
      const s = stop(); if (!s) return;
      s.classList.remove('current'); s.classList.add('done', 'completing');
      s.querySelector('.hl-status').innerHTML = `<b class="hl-done">✓ BUILT</b>${Contract.completed[i]?.grade ? ` · GRADE ${Contract.completed[i].grade}` : ''}`;
      s.querySelector('.hl-art').innerHTML = voxelSVG(Contract.completed[i]?.cells?.length ? Contract.completed[i].cells : CONTRACTS[i].cells, '#eac38a');
      AudioFX.perfect();
    });
    if (i + 1 >= CONTRACTS.length) {
      this.later(1500, () => { AudioFX.power(); $('homeNext').classList.add('arriving'); $('homeContinue').focus({ preventScroll: true }); });
      return;
    }
    this.later(1250, () => { const l = seg(); if (l) { l.classList.remove('next'); l.classList.add('done', 'filling'); } });
    this.later(2050, () => {
      const n = next(); if (!n) return;
      n.classList.remove('locked'); n.classList.add('current', 'unlocking');
      n.querySelector('.hnode').removeAttribute('aria-disabled');
      n.querySelector('.hnode').setAttribute('aria-label', `${CONTRACTS[i + 1].name}, up next. Select to start.`);
      n.querySelector('.hl-status').innerHTML = `<b class="hl-next">UP NEXT</b> · ${CONTRACTS[i + 1].tiles} TILES`;
      n.querySelector('.hl-art').innerHTML = voxelSVG(CONTRACTS[i + 1].cells);
      const after = $('homePath').querySelector(`[data-seg="${i + 1}"]`); if (after) after.classList.replace('locked', 'next');
      AudioFX.power();
      $('homeContinue').focus({ preventScroll: true });
    });
  },

  pick(i) {
    const st = $('homePath').querySelector(`[data-stop="${i}"]`);
    if (!st) return;
    if (st.classList.contains('locked')) {
      st.classList.remove('nope'); void st.offsetWidth; st.classList.add('nope');
      $('homeNote').textContent = `Finish ${TITLE(CONTRACTS[i - 1].name)} to unlock ${TITLE(CONTRACTS[i].name)}.`;
      return;
    }
    this.open(i);
  },
  open(i) { AudioFX.unlock(); this.hide(); Contract.brief(i); },
  continue() {
    if (this.doneCount() >= CONTRACTS.length) { this.city(); return; }
    this.open(this.doneCount());
  },
  /* "View City" opens the neighborhood view of buildings finished so far. */
  city() {
    if (!this.doneCount()) return;
    AudioFX.unlock(); this.hide(); Contract.neighborhood();
  },

  askReset() {
    const done = this.doneCount();
    const bits = [done ? `${done} completed building${done > 1 ? 's' : ''}` : '', Contract.coins ? `${Contract.coins.toLocaleString()} coins` : '', 'your contractor name'].filter(Boolean);
    $('resetText').textContent = `This erases ${bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits.at(-1) : bits[0]}, then starts again from the welcome story. It can’t be undone.`;
    this.confirming = true; $('homeConfirm').hidden = false; $('home').querySelector('.home-shell').inert = true;
    $('resetCancel').focus({ preventScroll: true });
  },
  closeReset() {
    const was = this.confirming;
    this.confirming = false; $('homeConfirm').hidden = true; $('home').querySelector('.home-shell').inert = false;
    if (was) $('homeReset').focus({ preventScroll: true });
  },
  /* Erase only Asterra's own saved keys, then start over as a new player. */
  reset() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^(asterra-|polycube-)/.test(k)) keys.push(k); }
      keys.forEach(k => localStorage.removeItem(k));
    } catch { /* storage unavailable: nothing was saved */ }
    location.reload();
  },
};
