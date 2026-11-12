# Phase 1 building wear — 12 November 2026

Work is confined to `asterra-restart`, on `wear-phase-1`. This copy did not have its own Git repository. Its complete starting contents were committed as `cdef285` before the feature branch was created. Other project folders and original asset packs were not modified.

## Implementation

The reveal passes the computed grade to `makeBuilding`. The city passes `tile.grade` alongside the existing garden option. `makeBuilding` invokes a single wear implementation for both contexts. It does not write to the store, alter cells, change placement validation, change rewards, or change contract completion rules.

`src/wear-config.js` contains the explicitly PLACEHOLDER values: A+ 0, A 0.15, B 0.35, C 0.6, D 0.85. All new art dimensions, counts, colors and thresholds are also labelled PLACEHOLDER in the rendering code. The nearest completed building is selected using axial hex distance. The lower grade wins equal-distance ties: this rule is PLACEHOLDER. Missing/unknown grades and absence of any completed building render cleanly.

The mesh handling decodes normalized, interleaved attributes from the existing compressed GLB. It welds triangle vertices to identify disconnected windows and roof tiles. Windows are split at their mullions into independent panes. A canvas crack layer is applied only to selected panes; the shared Windows material is never modified. Missing glass becomes a dark opening; boarded panes retain their underlying cracks. Wall cracks and soot use procedural canvas layers on the actual house surfaces. Genuine roof tile components are lifted or omitted, and the house roof edge deforms slightly. D additionally bevels an existing masonry corner and applies a grounded affine lean of approximately two degrees (PLACEHOLDER).

The source House_3 workshop has neither glass nor roof tiles. Small framed side windows and a tiled cap were added procedurally on the workshop itself so it supports the same wear. No wear geometry is placed on the terrace annex. Rooftop gardens remain intact at every grade.

Grove leaf materials become brown at C while retaining texture detail and cutout transparency; D hides foliage and flowers while retaining bare branches/trunks and the bench. Route lanterns use the nearest building grade, including when buildings and cosmetics were already present in a save. D lantern glass is dark and non-emissive; C lanterns remain lit. The building's own entrance lanterns follow its grade as well.

## Verification

Each implementation stage was checked in Chromium before the following stage: grade wiring; individual panes; canvas wall wear; roof geometry; nearest-building environment wear; boards/chip/lean. Intermediate screenshots are in `docs/wear/stage-*.png`.

- `npm run test:state`: **6 passed**.
- `node --test tests/wear/wear.test.js`: **3 passed** (values/defaults, axial distance, tie determinism, no state mutation).
- `node tests/wear/verify.mjs`: **passed** all 15 building/grade combinations, finite geometry, partial/full reveal clipping, old-save load and reload, unchanged coins/completed records/tiles, gardens, and A+/C/D grove and lantern states. No page errors. Machine-readable results: `docs/wear/browser-results.json`.
- `npm run test:browser` (production build, isolated port 4194): **4 passed, 2 skipped, 0 failed** on the final run. Passing tests: complete stacking-to-city journey, navigation, settings, and earthquake introduction. The two unchanged reference-server tests were skipped because `ORIGINAL_GAME_URL` / `CITY_PROTOTYPE_URL` were not configured.
- Read-only reference checksum audit: **81 of 82 matched**. Parent `package.json` does not match its recorded hash. That file and the manifest were not changed. Reference tests and checksum expectations were not edited.

The initial production browser run had one five-second city loading timeout while another software-rendered browser verification was running. A fixture setup error also initially replaced its legacy save on page exit; the fixture now seeds storage before application initialization. A subsequent full journey reached its final assertion but reported three missing favicon requests. An inline Asterra star favicon fixes those requests; the test assertions were not changed.

`legacy-save.json` is a version-1 fixture produced by the unchanged pre-wear store API with deliberate grade inputs. It loads through the actual game, then reloads with identical tiles, completed contracts and coins. No migration or new saved fields are needed. This is not a copy of the user's personal browser save.

The A+, B and D images are controlled screenshots of the actual shared `makeBuilding` reveal renderer, including partially revealed states. They are clearly labelled visual fixtures. D cannot normally complete a contract under the current minimum-density rules; those rules were intentionally preserved. The existing journey test separately exercises real stacking, completion, purchases and reload.

## Evidence

- `wear/reveal-Aplus.png`, `wear/reveal-B.png`, `wear/reveal-D.png`: fully revealed grade comparison.
- `wear/reveal-Aplus-partial.png`, `wear/reveal-B-partial.png`, `wear/reveal-D-partial.png`: partially revealed models with wear sharing the reveal clipping plane.
- `wear/city-grade-comparison.png`: healthy, browning and dead groves with lit/lit/unlit route lanterns near A+/C/D buildings.
- `wear/legacy-city.png`: an old-format saved city rendered by the actual application.
- `wear/stage-6-workshop.png`, `wear/stage-6-courtyard.png`: other building designs with gardens and D wear.

## Files

Application changes:
- `index.html` — inline star favicon, fixing the missing resource reported by the browser journey.
- `src/wear-config.js` — grade values and read-only nearest-building rule.
- `src/building-wear.js` — procedural pane, wall, roof, corner and lean implementation.
- `src/village-buildings.js` — shared factory integration, workshop details, entrance lantern appearance and wear texture cleanup.
- `src/contract.js` — passes grade into the reveal factory; no other change.
- `city/world.js` — passes saved grades; derives cosmetic grove/lantern wear; disposes local grove materials; exposes read-only wear summaries for verification.
- `playwright.config.js` — optional isolated test port, keeping its default behavior and reference assertions intact.

Verification additions:
- `tests/wear/{gallery.html,city.html}` — controlled visual fixtures using the real renderers.
- `tests/wear/{stage-check.mjs,verify.mjs,wear.test.js}` — staged visual checks and regression assertions.
- `tests/wear/{create-legacy-fixture.mjs,legacy-save.json}` — reproducible pre-wear version-1 save fixture.
- `tests/wear/vite.config.js` — local fixture server with hot reload disabled to keep evidence writes from interrupting tests.
- This report and the screenshots/results under `docs/wear/`.

Complete evidence file list (all newly added):

- `docs/wear/browser-results.json`
- `docs/wear/city-grade-comparison.png`
- `docs/wear/legacy-city.png`
- `docs/wear/reveal-Aplus-partial.png`
- `docs/wear/reveal-Aplus.png`
- `docs/wear/reveal-B-partial.png`
- `docs/wear/reveal-B.png`
- `docs/wear/reveal-D-partial.png`
- `docs/wear/reveal-D.png`
- `docs/wear/stage-1.png`
- `docs/wear/stage-2.png`
- `docs/wear/stage-3-close.png`
- `docs/wear/stage-3.png`
- `docs/wear/stage-4.png`
- `docs/wear/stage-5.png`
- `docs/wear/stage-6-courtyard.png`
- `docs/wear/stage-6-workshop.png`
- `docs/wear/stage-6.png`

- `docs/wear/gameplay-stacking-complete.png` — actual stacking completion from the passing journey.
- `docs/wear/gameplay-integrated-city.png` — actual city from that journey.

## Assets and limits

No models were converted or imported. No original GLB, OBJ, texture, archive or license file changed. Existing House_1/2/3 geometry comes from Quaternius Medieval Village Pack; vegetation from Stylized Nature MegaKit Standard; the terrace railing from Medieval Village MegaKit Standard. The included `public/models/LICENSE-quaternius.txt` and `public/models/city/License_Standard.txt` identify these as CC0 1.0 / public domain, permitting commercial use and modification. Unused asset packs were not incorporated.

Lean was retained after inspection. No Phase 1 feature was deliberately skipped. Cracks are subtle at the distant city camera and more visible close up. This is cosmetic wear only, with no collapse, demolition, penalties, loss of coins or gameplay restrictions. Chromium/software WebGL was tested; Safari, Firefox and physical low-end GPUs were not benchmarked.

## Reproduce

From this project:

```sh
npm run dev -- --port 4193
```

Open `http://127.0.0.1:4193/`. Existing saves are browser-origin-specific; changing ports does not automatically transfer another origin's save.

For stable visual verification, start `npm run dev -- --config tests/wear/vite.config.js`, then run `node tests/wear/verify.mjs` in another terminal. The fixture server uses port 4195. `CHROMIUM_PATH` can select an installed Chromium executable. Run `ASTERRA_TEST_PORT=4194 npm run test:browser` to isolate the production suite from another local Asterra server.
