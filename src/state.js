import { CFG } from './config.js';

/* =====================================================================
   GAME STATE — everything about the current run
   ===================================================================== */
export const S = {
  screen: '',
  phase: 'wait', piece: null, waitT: 0.3,
  meter: 0, active: { shadow: 0, freeze: 0, block: false }, tileQueue: [],
  placed: 0, fell: 0, perfects: 0, pieces: [], falling: [], strikes: 0, paused: false,
  cubes: 0, box: null, endT: 0, dropping: [], trims: [], pending: 0, queuedDrop: false, predicted: 0,
  celebrateUntil: 0,
};
export const freshBox = () => ({ minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity });
export const used = () => S.placed + S.fell + S.pending;
export const runTotal = () => Math.max(1, CFG.run.pieces | 0);
// linear ramp by piece number: piece 1 = 1×, last piece = CFG.move.rampTo
export const speedMul = i => 1 + (Math.max(1, CFG.move.rampTo) - 1) * Math.min(1, i / Math.max(1, runTotal() - 1));
