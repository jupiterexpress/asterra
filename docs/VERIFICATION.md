# Verification — 19 October 2026

## Automated evidence

- Both unchanged reference entry points launched successfully in Chromium before integration.
- Six Node state tests passed: price/adjacency validation, failed purchases, empty bridge banks, landing protection, exact completed cells/site, once-only rewards, queued-result reload recovery, rooftop suitability/duplicates, persistence and reset isolation.
- Full Chromium journey passed: fresh introduction/name entry; real guided FLIP/ROTATE/AXIS/DROP tutorial and rejected misaligned drop; terrain purchase; unaffordable purchase/cancel; site selection; all three contracts completed through the original stacking engine; actual-cell building rendering; reward duplicate prevention; reload; bridge before opposite path; road, garden, pond, path and lantern purchases; final shared save verified. No browser errors.
- Deterministic comparison against the currently running original passed across 14 seeds in four scenarios. Tests use original placement, rotation, stability and scoring operations; they do not insert completed structures into the journey save. Automated timing/alignment makes this a functional test, not a human difficulty evaluation.
- Production full journey passed again (1.2 minutes). Pause, restart, exit-to-city, unfinished-run reload recovery, reset cancellation and isolated reset passed in a separate browser test.
- Production Vite build passed (49 modules; approximately 740 kB main JavaScript, 206 kB gzip). No new runtime dependencies.
- All 82 original/prototype source, asset, config and documentation hashes match their pre-integration values.

The pre-existing historical golden tests were not rewritten to accommodate current source behavior. The current-original comparison avoids relying on those outdated goldens. Desktop Chromium was tested; other browsers and physical low-end GPUs have not been benchmarked.

## Economy measured through real contract completion

| Contract | Tile earnings | Density reward | Total earned |
|---|---:|---:|---:|
| Lantern House (A+, 95.8%) | 515 | 3,600 | 4,115 |
| Step House (A, 86.2%) | 585 | 3,696 | 4,281 |
| Courtyard (A, 85.3%) | 655 | 5,082 | 5,737 |

The first test used seven placements. Original timed tile value starts at 100 and drains at 10/sec; slower play earns less and may incur penalties. Prices are configurable in `city/state.js`: path 200/hex, road 250/hex, lantern 350, grove 450/hex, terrain 500/hex, pond 1,000/hex, bridge 1,200, garden 1,500/building. A first high-grade contract buys roughly two or three major additions, not a fully decorated expanded city. Starting funds of 1,200 cannot buy everything. There is no passive income or repeat completed-contract reward.

## Visual review

`integrated-city.png` shows the three contract designs using the prototype village models, a garden terrace, infrastructure and the management UI. `stacking-complete.png` shows the same House_1 model in the finishing scene. `village-before-quake.png` and `village-after-quake.png` show the reused prototype models and the crumbling sequence. `settings.png` shows the new player settings.

## Known scope

Three contracts only. One-hex bridges; garden terraces on completed contract buildings; decorative inhabitants/fish; stylized water reflection. Local saves only. Unfinished runs release their site on exit/reload and retain earned tile coins, rather than resuming every moving piece. Original timed earnings remain obtainable during restarted unfinished attempts, as in the original; completed density rewards are guarded against duplication.

## Visual revision

The original voxel facade was replaced with the standalone prototype's House_1, House_3 workshop, and House_2 model family, respectively. The same model appears at the completion reveal and in the city. It is scaled to the built footprint; exact stacked cells are still saved for scoring and contract requirements, though the finished architectural silhouette is the chosen model for that contract. The introduction now uses the prototype village models and animates their collapse into roof and timber debris. The tuning controls are removed; a browser test verified name, remapped keys, sound, camera sensitivity, persistence, and rejected duplicate bindings.
