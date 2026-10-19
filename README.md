# Asterra

A cozy, geometric, slightly enchanted browser city-building game. Build a neighborhood one contract at a time: each blueprint asks you to stack tiles into a building, and your density grade decides how many coins it earns. Built with Three.js, bundled with Vite, and wrapped as an iPhone app with Capacitor. Everything runs offline and in this browser. There are no accounts and no server.

- **Design decisions and the reasons behind them:** [DESIGN.md](DESIGN.md). Read it before changing gameplay or balance.
- **How the code fits together:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **What is next, in priority order, plus known bugs:** [FUTURE.md](FUTURE.md).

## Setup (once per machine)

1. Install Node.js 20 or newer (from nodejs.org, or `brew install node`).
2. In this folder: `npm install`
3. For the iPhone app: Xcode from the Mac App Store.
4. For the tests: `npx playwright install chromium`

## Play in a browser

```
npm run dev
```

Open the local address it prints. The "Network" address works on a phone on the same Wi-Fi. Open the server URL rather than `index.html` directly, because Vite bundles the modules, styles and fonts.

### Launch behavior

- **New player** (no saved progress): welcome story, then How to Play practice, then the **home** screen.
- **Returning player** (any saved progress): straight to the **home** screen. The game never opens inside a contract or a development screen.
- Progress is stored in this browser's localStorage. Clearing site data, or using a private window, starts a new player.

## Controls

| Key | Action |
|---|---|
| Mouse drag / scroll, arrow keys | Orbit and zoom the camera |
| R | Rotate the tile |
| F | Flip the tile |
| X | Switch travel axis |
| Space | Drop the tile (the only way to place a tile) |
| Q | Open powerups (when the power meter is full) |
| C | Coins page |
| P or Esc | Pause |
| A / D | Step a frozen tile (Freeze Time) |
| 1 / 2 / 3 | Choose a powerup in the picker |

Clicking or dragging the build area only moves the camera. It never places a tile.

## The game loop

1. **Home.** Pick the highlighted contract (or View City once you have built one).
2. **Blueprint.** Read the target: a density percentage and a tile budget.
3. **Build.** Tiles arrive one at a time. Each starts worth +100 coins and loses value every second. Drop fast to keep more; a slow tile can cost coins, and a tile that runs out is a missed placement.
4. **Finish.** Fill the blueprint to its target and finish, or keep stacking for a higher grade. The game also finishes by itself when no tile can reach the remaining gaps.
5. **Reward.** The building is revealed. Results show the density grade, density reward, quick-placement earnings, penalties and the total.
6. **Home.** The finished contract gets a checkmark and the next one unlocks.

Three contracts are in the game: the Lantern House, the Step House and the Courtyard.

## Balance

Rewards and penalties are configurable in `src/config.js` (`reward`, `tileValue`) and most are on the tuning panel (slider icon, top right). Every number is a placeholder until it has been playtested. See DESIGN.md for the current values and reasoning.

## Run on your iPhone

```
npm run ios
```

This builds the game, copies it into the iOS project and opens Xcode. Then in Xcode:

1. Select the **App** project in the left sidebar, then the **App** target, then **Signing & Capabilities**, and choose your **Team** (sign in with your Apple ID if asked). A free Apple ID can install on your own phone for 7 days at a time; the paid Apple Developer Program is needed for TestFlight and the App Store.
2. Plug in your iPhone, pick it at the top of the Xcode window, and press **Run** (▶).
3. First time only, on the iPhone: turn on **Settings → Privacy & Security → Developer Mode**, and if asked, trust your developer certificate under **Settings → General → VPN & Device Management**.

After changing the game code, run `npm run ios` again (or `npm run sync` if Xcode is already open) before pressing Run.

The app ID is `com.jupiterexpress.polycubestacker` (in `capacitor.config.json`). Change it before the first TestFlight upload if you want a different one; it can't change after the app is on the App Store. The app icon is still Capacitor's placeholder. The iOS build has not been re-tested since the homepage and economy changes.

## Test

```
npm test
```

Builds the game, then runs the Playwright suites in `tests/`:

- **Gameplay is unchanged.** Replays seeded, scripted runs and compares every drop to `tests/golden.json`, recorded from the original prototype (`legacy/stacker-prototype.html`).
- **It works offline.** The page loads with internet access blocked.
- **Onboarding, contracts and powerups.** Several of these specs were written before the homepage existed and start from the contract screen. **They have not been updated yet and are expected to need changes** (see FUTURE.md, item 1).

If you change gameplay on purpose, re-record the reference with `UPDATE_GOLDEN=1 npx playwright test` and commit the new `tests/golden.json` with the change.

## Where things are

Full module map: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The short version:

| File | What it holds |
|---|---|
| `src/main.js` | Startup routing, the animation loop, the `window.STACKER` debug handle |
| `src/home.js` | Homepage: contract path, coin balance, Continue, View City, New Game |
| `src/contract.js` | Contracts, blueprint goal, density grade, rewards, saved progress, auto-finish |
| `src/blueprints.js` | The three contract blueprints |
| `src/game.js` | Spawning, ROTATE / FLIP / AXIS / DROP, landing, tile value, strikes, reset |
| `src/powerups.js` | Powerup picker and banners (Tile Choice, Freeze Time, Add 1×1 Block) |
| `src/bonus.js` | The Add 1×1 Block aiming cursor |
| `src/ui.js` | HUD, buttons, keyboard, pause, coins page, tuning sheet |
| `src/tutorial.js` | Guided placement practice |
| `src/opening.js`, `src/opening-scene.js` | Welcome story and its miniature scene |
| `src/config.js` | Every tunable number |
| `src/styles.css` | All styling |
| `ios/` | Xcode project (Capacitor), created by `npm run ios` |

The tuning panel is a development tool. Hide or remove it for release builds.

## Integrated city game

The [integrated-game](integrated-game/) directory contains the independent Asterra city and stacking game. Run `cd integrated-game && npm install && npm run dev`, then open the local URL shown by Vite. The original stacking game in this repository root remains available with its existing commands.
