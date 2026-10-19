# Architecture

How Asterra's code is organized and how the pieces talk to each other. Gameplay decisions and their reasons live in [DESIGN.md](../DESIGN.md).

## The stack

- **Three.js r128** renders the 3D build area (`scene.js`). Models are GLTF with meshopt compression. r128 does not denormalize normalized vertex attributes, so vertex reads in `scenery.js` are scaled by hand.
- **Vite 8** bundles ES modules. `npm run dev` serves the game; `npm run build` writes `dist/`.
- **Capacitor 8** wraps the same build as an iOS app (`npm run ios`).
- **No backend.** All progress lives in localStorage.

## Startup (`src/main.js`)

1. Imports styles and fonts, sets the daily seed, initializes the UI, camera, tutorial, contracts, opening and home.
2. Routing decision, made once at launch:
   - **Returning player** if `polycube-tutorial-complete` is `'1'`, or any contract progress or coins are saved: `Home.show()`.
   - **New player:** `Opening.start()`, which runs the welcome story, then the tutorial, then `Home.show({ fresh: true })`.
3. The loop calls `step()` only while the game is playing. Screens (home, contract brief, results, coins) pause the simulation but keep the camera moving.

`window.STACKER` exposes state and controls for the Playwright tests. Keep it working when refactoring.

## Screens and who owns them

| Screen | Module | Opened by | Leads to |
|---|---|---|---|
| Welcome story | `opening.js` | new players | tutorial |
| How to Play practice | `tutorial.js` | opening, pause menu | `Home.show({fresh})` |
| Home hub | `home.js` | launch, tutorial, results CONTINUE, pause HOME, city back | `Contract.brief(i)`, `Contract.neighborhood()` |
| Contract brief | `contract.js` (`brief`) | home node or CONTINUE | `start()` |
| Build | `game.js`, `powerups.js`, `bonus.js` | ACCEPT CONTRACT | finish or auto-finish |
| Reveal + results | `contract.js` (`end`, `tick`, `showResults`) | finish | CONTINUE → home |
| Neighborhood (View City) | `contract.js` (`neighborhood`) | home | BACK TO HOME |
| Coins page | `ui.js` (`openCoins`) | C, coin chip | back to the previous screen |

`S.screen` records which overlay is open ('home', 'contract', 'coins', 'powers', 'tiles', 'opening'). Keyboard handling in `ui.js` checks it first, so keys do not leak into the build while a menu is open.

## Save data

All keys are plain localStorage entries. `reset()` in `home.js` removes every key starting with `asterra-` or `polycube-`.

| Key | Written by | Contents |
|---|---|---|
| `asterra-progress-v2` | `contract.js` `persist()` | `{ coins, nextIndex, completed: [{cells, grade}] }`. Written in one place so a reward and its unlock are saved together. |
| `asterra-contractor` | `opening.js` | The player's name, used in greetings. |
| `asterra-opening-complete` | `main.js`, `opening.js` | Story finished. |
| `polycube-tutorial-complete` | `tutorial.js` | Practice finished. Drives the returning-player check. |
| `asterra-home-seen` | `home.js` | How many completed contracts the home screen has already celebrated, so each checkmark animates once. Set to the current count when the key is missing (older saves). |
| `asterra-coins` | (legacy) | Read once as a fallback for very old saves. |

`nextIndex` is the first contract not yet built. `completed[i]` is set when contract `i` is built. Rebuilding a finished contract is allowed: each completed build pays its reward again and overwrites `completed[i]` with the new grade and cells. This is intentional for now (the rebuild is how a player improves a grade), but it is a balance question to revisit in FUTURE.md.

## Contracts and rewards (`src/contract.js`, `src/blueprints.js`, `src/config.js`)

- **Blueprints:** three entries in `CONTRACTS`, each a height map. `cells` are the target voxels; `columns` are the footprint; `goal` is the density target; `tiles` is the tile budget.
- **Density grade** (`end()`): `filled / (target cells + extra cells − filled)`. Extra volume never raises the score. Grades: A+ ≥ 95%, A ≥ 85%, B ≥ 75%, C ≥ 65%, D below.
- **Contract reward:** `target cells × CFG.reward.perCell[grade] × CFG.reward.contractBonus[index]`. Paid only when the build is complete. The default values are in `config.js`.
- **Tile value** (`game.js` `settleValue`, `expireTile`, `CFG.tileValue`): each tile starts at +100 and drains `drainPerSec`. Positive value is paid on a landed drop. A negative value is charged, even if the tile misses. A tile that reaches `expireAt` expires: it counts as a missed placement and is charged the expiry amount.
- **Balance floor:** `CFG.tileValue.allowNegativeBalance` is `false`, so the coin balance never goes below zero.
- **Breakdown:** `addCoins(amount, reason, kind)` records quick placements (`'quick'`) and charges (`'penalty'`) into `Contract.run` for the results screen. The total on the results screen equals the change in the balance.
- **Auto-finish** (`Contract.stuck()`): ends the build when every empty blueprint cell has a block above it in its column (an unreachable hole) and the power meter is not full. Full meter, or an active bonus block, keeps play going. This is a heuristic: a gap with nothing above it that is still unreachable (for example, sideways under an overhang) is not detected.

## The homepage (`src/home.js`)

- `Home.render()` builds the path from `CONTRACTS` and the saved progress. Each node is `done`, `current` or `locked`, computed from `Contract.nextIndex`.
- Node and line positions are in one table (`NODES`, `SEGMENTS`) inside a 460×500 SVG-based layout. Labels and the side card are plain HTML.
- `celebrate(i)` plays the checkmark, the line fill and the unlock as timed steps. Timers are cleared on every render and on leaving the screen.
- New Game shows a confirmation card. Confirming clears Asterra keys and reloads the page.

## The build (`src/game.js` and friends)

- `spawn()` picks the next tile from the seeded sequence, or from `S.tileQueue` after Tile Choice.
- `place()` (DROP) checks stability with `physics.js`, then either settles the tile into `World` or sends it to `falling`. A stable drop is recorded as a quick placement if its value is positive.
- `usePower()` / `Powers` manage powerups. The meter fills on perfect placements and resets when a powerup is used. Freeze Time pauses the tile and its value. Add 1×1 Block uses `bonus.js` to aim a cube at the lowest open cell in a column.
- `Contract.checkCompletion()` is polled each step: finish requested, blueprint full, or stuck.

## Rendering and assets

- `scene.js` sets up the renderer, lights and shadows.
- `scenery.js` places decorative props (trees, lanterns, the well, flowers) around the island. `refitScenery()` runs on every reset because each contract changes the island size. Props are grounded from their bounding boxes.
- `building.js` turns a finished build into the revealed building model (`makeBuilding`).
- `opening-scene.js` is a procedural miniature for the welcome story. It uses no external assets.

## Styling

All CSS is in `src/styles.css`, grouped by section. Desktop layouts use `@media` queries for narrow windows, short windows and reduced motion. Colors and fonts follow the palette in DESIGN.md.

## Tests (`tests/`)

- Playwright specs drive the real page in Chromium with SwiftShader, so runs are slow (about 3–4 fps). Waits are based on game state (`STACKER.S.phase`, etc.), not fixed timers.
- `gameplay.spec.js` compares seeded runs against `golden.json`. A change to physics or piece generation breaks it on purpose.
- `contracts.spec.js`, `powerups.spec.js`, `tutorial.spec.js`, `opening.spec.js`: several still assume an older launch flow. See FUTURE.md.

## Adding things

- **New tunable number:** add it to `CFG` in `config.js`, and to the `TUNE` list in `ui.js` if it should be live-adjustable.
- **New contract:** add an entry to `CONTRACTS` in `blueprints.js`. Update the per-contract text, and the `Math.min(3, …)` caps in `contract.js` if the count changes. Recheck the reward table.
- **New screen:** register it in `S.screen`, give it a hidden-by-default element in `index.html`, and make sure `reset()` and the Escape handler in `ui.js` / `home.js` close it.
