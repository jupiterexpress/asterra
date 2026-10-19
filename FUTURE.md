# Future work

Ordered by priority. Items near the top block a release or are known to be wrong. Balance numbers are placeholders until playtested.

## 1. Before anything else: make the test suite match the game

- **Update `tests/contracts.spec.js`, `powerups.spec.js`, `tutorial.spec.js`, `opening.spec.js`** for the homepage launch flow. They currently go to `/` and click `#contractAccept` directly, which no longer happens for new or returning players. Each should either click through the homepage (`#homeContinue`) or seed localStorage (`asterra-progress-v2`, `polycube-tutorial-complete`).
- **Run `npm test` on a machine with Chromium** and fix or re-record anything that fails. The gameplay golden file should not change, because the physics and piece sequence were not touched; if it does, investigate before re-recording.
- Add tests for the new behavior: homepage routing, the checkmark celebration firing once, New Game clearing only Asterra keys, the results breakdown summing to the balance change, and auto-finish when a hole is blocked.

## 2. Release blockers

- **Test the homepage on a phone and in the iOS app.** Layout was checked at desktop sizes (820×600 up to 1920×1080) only.
- **Re-test the iOS build** (`npm run ios`) after the homepage, economy and auto-finish changes.
- **Hide the tuning panel** (the slider icon) for release builds.
- **Remove the placeholder icon** and confirm the app ID before the first TestFlight upload.

## 3. Bugs and rough edges

- **Auto-finish is a heuristic** (`Contract.stuck()`). It only looks for a block above each open cell. A gap that is unreachable for other reasons, such as sideways under an overhang with nothing above it, will not end the build. Consider checking whether any valid placement exists.
- **Reward balance has not been playtested.** A+ pays more than the most quick placements, but the feel of a whole session is unknown. Watch whether players still rush, and whether D builds feel too punishing.
- **Reset uses a full page reload.** It works, but it causes a flash. A soft reset would be smoother.
- **Focus during the home celebration** moves to CONTINUE when the unlock step runs. Check that keyboard-only players can still see the checkmark before they press anything.
- **`asterra-coins` legacy fallback** is read but never written. Remove it once no save older than the current format is expected.

## 4. Planned features

- **Shop.** The home screen shows a disabled "Coming soon" SHOP button. Decide what it sells before building it. Rooftop gardens and amber-window upgrades are the current candidates. Keep prices in `config.js`.
- **A real City view.** "View City" currently opens the neighborhood card, which shows finished buildings and empty outlines. A city view should show the whole neighborhood, with the scenery and the player's buildings together.
- **Asterra city-building prototype (separate route, not merged yet).** A standalone prototype for rebuilding the city, with its own entry point, so it can be tested without touching the stacking game:
  - A small starting city of connected hex tiles. The player places new hex tiles to expand it, with the hex grid and valid spots clearly marked.
  - The player builds and arranges structures: roads that connect across the city, bridges over water or gaps, ponds, and rooftop gardens bought with coins and added to suitable buildings. Placement previews and feedback must make it clear what connects to what.
  - The city changes as it is rebuilt: fish appear and swim in established ponds, people gradually move in as buildings and roads are added, and rooftop gardens visibly change the buildings they sit on. Keep the animation subtle.
  - A simple economy: show the coin balance and the price of each upgrade, with enough starting money to experiment. Prices stay configurable. No complicated economy and no full simulation at this stage.
  - Same visual style as the rest of Asterra. Designed for mouse and keyboard on desktop.
  - Out of scope for the prototype: merging it with the stacking game, and a full simulation.
- **Save export and import.** A "copy my save" option would let players move progress between browsers. Keep it simple: a text code, no account.

## 5. Later, only if needed

- **Accounts and cloud sync.** Not planned. Add only if players need progress on several devices. This would require a backend and must be a separate decision.
- **Sound design.** Sounds are synthesized placeholders. Replace with a considered set.
- **Accessibility pass.** Color contrast on the path labels, reduced-motion coverage for the celebration, and captions for the welcome story.
- **Localization.** All text is English and inline in the HTML and JS.
