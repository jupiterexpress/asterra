// Deterministic gameplay scenario used by the regression test.
// Drives the game through window.STACKER only, synchronously (no animation frames run
// in between), and returns a snapshot after every drop. The same function was run against
// the original single-file prototype to produce tests/golden.json.
function runScenario(cfgOverrides) {
  const G = window.STACKER, S = G.S, CFG = G.CFG;
  const out = [];
  let a = 12345;                                   // the scenario's own RNG for choosing inputs
  const r = () => { a = (Math.imul(a, 1103515245) + 12345) | 0; return ((a >>> 0) % 100000) / 100000; };
  const setP = (path, v) => { const ks = path.split('.'), last = ks.pop(); ks.reduce((o, k) => o[k], CFG)[last] = v; };
  const snapCfg = JSON.stringify(CFG);
  for (const [k, v] of Object.entries(cfgOverrides.cfg || {})) setP(k, v);
  for (const seed of cfgOverrides.seeds) {
    CFG.seed = seed; G.reset(); S.paused = true;
    const run = [];
    for (let n = 0; n < 45 && S.phase !== 'over'; n++) {
      let g = 0; while (g < 600 && !(S.piece && S.phase === 'aim') && S.phase !== 'over') { G.step(1, 1 / 60, true); g++; }
      if (S.phase === 'over') break;
      const p = S.piece;
      const spawn = [p.axis, p.cross, p.lo, p.hi, JSON.stringify(p.cells)].join(';');
      const acts = Math.floor(r() * 6);
      for (let i = 0; i < acts; i++) {
        const c = r();
        if (c < 0.35) G.rotate(); else if (c < 0.6) G.tip(); else if (c < 0.8) G.turn();
        else if ((S.inv?.shadow || 0) > 0) G.usePower('shadow');
        G.step(1 + Math.floor(r() * 40), 1 / 60, true);
      }
      G.place();
      G.step(Math.floor(r() * 50), 1 / 60, true);
      const occ = [...G.World.occ.keys()].sort().join('|');
      let h = 0; for (let i = 0; i < occ.length; i++) h = (Math.imul(h, 31) + occ.charCodeAt(i)) | 0;
      run.push([spawn, S.placed, S.fell, S.strikes, S.meter, (S.inv?.shadow || 0), S.active.shadow, S.perfects, S.cubes, S.phase, h].join(','));
    }
    let g = 0; while (g < 1200 && S.phase !== 'over') { G.step(1, 1 / 60, true); g++; }
    run.push(['end', S.placed, S.fell, S.strikes, S.perfects, S.cubes, S.phase].join(','));
    out.push(run);
  }
  Object.assign(CFG, JSON.parse(snapCfg));
  return out;
}
const SCENARIOS = [
  { name: 'defaults', seeds: [1, 2, 3, 4, 5, 6, 7, 8], cfg: {} },
  { name: 'no-strikes-long', seeds: [11, 12], cfg: { 'strikes.limit': 0, 'run.pieces': 40 } },
  { name: 'topple-strikes-no-flat', seeds: [21, 22], cfg: { 'strikes.topple': true, 'piece.spawnFlat': false, 'meter.max': 2 } },
  { name: 'no-trim-wide', seeds: [31, 32], cfg: { 'buildArea.trim': false, 'move.margin': 2, 'turn.maxPerPiece': 1 } },
];
module.exports = { runScenario, SCENARIOS };
