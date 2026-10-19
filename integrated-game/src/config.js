/* =====================================================================
   CFG — web / daily-challenge build. Keep in sync with polycubestacker/config.js.
   ===================================================================== */
export const CFG = {
  seed: 0,                                  // 0 = daily seed from date; set a number to override
  baseplate: { w: 5, d: 5 },
  piece: { minCells: 3, maxCells: 4, spawnFlat: true },
  move: {
    pattern: 'alternate',
    speed: 2.6,
    margin: 1,
    hoverGap: 2.5,
    rampTo: 1.0,                            // no speed ramp for daily challenge
  },
  turn: { maxPerPiece: 0, meterCost: 0 },
  run: { pieces: 15 },                      // shorter run — ~90 seconds
  strikes: { limit: 3, miss: true, allTrimmed: true, topple: false },
  guides: { pathLine: false },
  buildArea: { trim: true, pause: 0.2, slice: 0.1, tip: 0.15, fall: 0.25 },
  rotate: { animMs: 140, allowTip: true },
  physics: { gravity: 42, dropKick: 6, tolerance: 0, toppleAccel: 10 },
  perfect: { minSupport: 1 },
  celebrate: { flash: 0.1, spark: 0.15, pop: 0.15 },
  meter: { max: 4, success: 0, perfect: 1 },
  powerups: { freeze: { seconds: 8 } },
  // Tile value (contracts only): every tile arrives worth `start` coins and drains every second until dropped.
  // Positive value is paid when the tile lands; below zero it is charged; at `expireAt` the tile expires (a missed placement).
  tileValue: { start: 100, drainPerSec: 10, expireAt: -50, allowNegativeBalance: false },
  // Contract reward = blueprint cells x coins-per-cell for the density grade x the contract's difficulty bonus.
  // Sized so a top grade is worth well more than the most a run of quick placements can pay (tiles x tileValue.start).
  reward: { perCell: { 'A+': 150, A: 110, B: 70, C: 40, D: 15 }, contractBonus: [1, 1.2, 1.4] },
  camera: {
    yaw: 0.72, pitch: 0.52, dist: 14,
    pitchMin: 0.14, pitchMax: 1.12,
    sens: 0.0075, settle: 0.06,
    zoomMin: 0.75, zoomMax: 1.25,
    ring: 0.6,
  },
  spawnDelay: 0.25,
};

export const PALETTE = [0xcbb875, 0x529d90, 0xb9866d, 0x769b9b, 0x92aa6d, 0xc8c4a5];

/* Daily challenge — derive a repeatable seed from the viewer's local date */
const EPOCH_DAYS = Math.floor(Date.UTC(2026, 9, 15) / 86400000); // day 1 = Oct 15 2026
export function dailyDayNum() {
  const d = new Date();
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) - EPOCH_DAYS + 1;
}
export function dailySeed() {
  // deterministic from the day number — same seed for every player on the same day
  const n = dailyDayNum();
  return (n * 2654435761) >>> 0;
}
