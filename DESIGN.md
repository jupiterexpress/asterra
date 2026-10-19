# Design notes

These are decisions made while building the prototype, with the reason for each. Many came from playtesting. Before changing one of these behaviors, read why it is the way it is.

Every number lives in `src/config.js` and is a placeholder to tune, not a final rule.

## Scope so far

The prototype includes the core stacking interaction, Asterra opening story, guided tutorial, and one building contract (the Lantern House). The first contract adds a blueprint, density grading, saved coins, and a per-build amber-light cosmetic. Further contracts, saved buildings, a customization catalog, speed-building mode, and monetization are not built yet.

## Asterra onboarding and first contract

- The opening is player-paced: create a contractor → thriving city → earthquake → aftermath → rebuilding role → blueprint → density/rewards → invitation → training. It uses a procedural geometric miniature and a blue-green nighttime palette with amber light. Reduced motion replaces the earthquake movement with its settled aftermath.
- Training starts with animated controls and then an exact footprint challenge. The initial challenge leaves the transformations for the player to discover. After 6 seconds without progress a contextual observation appears; after 13 seconds it names the relevant control. Advancing toward a solution resets the hint delay.
- Lantern House has a fixed 5 × 5 × 3 blueprint. Density counts occupied cells inside its 75-cell volume, so a narrow tower cannot receive a perfect score. At least 45 filled cells (60%) completes the contract. The existing 30-tile budget, strikes, movement, and physics remain in effect.
- Coins are filled cells plus `floor(50 × density²)`, paid once when the run ends, including partial builds. A 20-coin amber-light upgrade decorates that run’s building. Coins and onboarding save locally; buildings and their cosmetics currently last for the run only.

## Controls

- **ROTATE ↻** spins the tile 90° about the vertical. It sets which way the tile faces and is the main aiming control.
- **FLIP** steps through the tile's *resting sides* (which way is down, ignoring spins) in a fixed order for that shape, flattest first. Flat is always one tap away, and the result never depends on the camera, the lane or the direction of travel. FLIP keeps the facing as close as possible to before, so it shouldn't need a ROTATE to undo it.
  - Why: the original FLIP rolled the tile away from the camera, so the same tap did different things depending on the view, and making a tile flat took a different sequence each time. Rolling toward the travel direction reverses on every bounce. Rolling toward a fixed end of the lane still makes players solve 3D rotations mentally under time pressure. Swiping on the tile conflicts with drag-to-move-the-camera.
- **AXIS** switches the tile's travel direction 90° at its current position; it keeps moving from where it is. Unlimited by default.
- **DROP ↓** snaps to the nearest cell and drops straight down.
- Button names went ROTATE/TIP/TURN/PLACE → SPIN/FLIP/SWITCH/DROP → ROTATE/FLIP/AXIS/DROP. ROTATE vs TURN read as the same thing; TIP read as "hint". Left pair = the tile's orientation, right pair = where and when it lands. In code, AXIS is still called `turn` and FLIP `tip`.
- Tiles arrive lying flat in a random facing (`piece.spawnFlat`; off is intended for harder levels).
- Never say "orbit" to players. Camera instructions say "Drag to change camera angle".

## Movement and guides

- A tile travels along one row or column ("lane"). New lanes are picked only from rows that have something built in them, weighted by how much, so tiles don't spawn over empty air.
- Travel reaches 1 square past the built edge (was 2). Overshooting the plate is allowed so players can make mistakes; 1 square keeps the camera closer.
- The **lane highlight** lights the top faces of every row the tile's footprint covers, across its whole travel range. It shows where the tile travels, not where it lands.
- A floating **path line** exists but is off by default; the full-width highlight replaced it.
- **Speed ramp:** linear by piece number, 1× → 1.5× on the last piece. Capped low because DROP snaps to a cell, and at ~2× the tap window per cell (~0.2 s) turns it into a reflex test. Tied to piece number, not height, so the curve is the same every run.

## Lighting and shadows

- An angled light shades the blocks (lit tops, darker sides) but casts **no** shadow. A straight-down light casts **all** shadows, so a hovering tile's shadow sits directly under it, inside the lane highlight. Both cues must point at the same squares.
- Shadows come from invisible full-width "caster" boxes, not the visible cubes (which are slightly undersized so their edges read). That makes a tile's shadow one solid shape with crisp edges and no seam lines. Blurring was rejected: it smears the edges that show which squares the tile is over.
- Only the plate and blocks receive shadows. The ground and pillar don't, so the part of a tile hanging past the plate casts nothing — no shadow means no support.

## Landing, physics and trimming

- A tile lands on the highest filled cell under any of its cubes. It stays if its center of mass is over the area it rests on; otherwise it rolls off. Placed blocks are rigid.
- The **baseplate is the build area** and never blocks a drop. Cubes past the edge are trimmed **after** the tile lands, so players see where it was going:
  - The tile lands intact, holds 0.2 s (the minimum to see what stuck out), a light sweeps along the edge, the overhanging cubes hinge over the edge (0.15 s) and fall and shrink (0.25 s). About 0.6 s total.
  - No red or warning colors; red was too alarming.
  - Non-blocking: the next tile arrives on schedule. A DROP pressed mid-trim waits until the trim finishes.
  - A tile entirely off the plate stops at plate level past the edge for the same hold, then falls.

## Perfect placements and the Power Meter

- **Perfect** = every cube's underside rests on something and nothing was trimmed.
- **Only perfects fill the meter**, +1 each; 4 fill it (easy-level placeholder). Partly trimmed or overhanging placements earn nothing.
- Landing callouts are one word: "PERFECT +1", "TRIMMED" or "PLACED". No counts.
- **Meter-full payoff**, 0.4 s, never pauses play: the meter flashes (0.1 s), a spark flies to the Landing Shadow button (0.15 s), the button pops with a chime (0.15 s), then the meter shows empty. Without it, a meter emptying on payout read as a reset.
- Watch item: a test bot got perfects on about 1 in 5 drops. If real players earn a Shadow only about once per run, loosen `perfect.minSupport` rather than lowering the meter size.

## Landing Shadow (powerup)

- Earned from the meter, tapped to activate, covers 3 drops.
- Shows the cubes that will stay as a see-through ghost where they'll rest, and cubes that will be trimmed as a dashed outline.
- A timer mode was tried and removed: it punished thinking (when the Shadow is most useful) and its value drifted with the speed ramp.
- More aiming powerups are planned.

## Strikes and run structure

- A run is 30 pieces. A **strike** is a piece that adds nothing: it landed on nothing, or every cube was trimmed. Topples are not strikes yet (they happen too easily); intended for harder levels.
- 3 strikes, counted across the run, end it with "OUT OF STRIKES"; using every piece ends with "BUILD COMPLETE". A known final strike ends the run immediately instead of spawning one more tile.
- The end card shows placed, fell, strikes, height, footprint and compactness. Compactness is misleading (a one-wide tower scores 100%) and should be replaced when density grading is designed.

## Camera

- One-finger drag changes the angle; the view follows the finger and settles in 0.06 s, with **no momentum or glide**.
- The camera's distance is **one value for every angle**, the worst case needed to keep the build and the tiles' travel area on screen. Dragging only rotates; nothing zooms in or out under your finger. The distance only changes, gently, as the build grows.
- History: framing the current tile's path made the camera zoom in on every drop and back out on every new tile; an angle-dependent distance made it drift after a drag. Both were removed.
- Tilt is capped short of straight down. Top-down views turn the game into a flat puzzle and remove the building feel; keep this in mind for blueprints (show targets as 3D silhouettes, not flat outlines).
- Pinch / trackpad zoom is limited to about 25% either side of the automatic distance.

## Pause

- Pause freezes everything, including trims and timers. Resume, Restart, Tuning. Auto-pauses when the app or tab goes to the background. The camera can still be moved while paused, to inspect the build.

## Known issues

- On a narrow phone, the stats line can be wider than the screen and get cut off at the right.
- Topples can feel arbitrary; a short teeter before falling, or slightly more forgiving stability, has been suggested.

## Desktop browser update (Oct 18, 2026)

- **Platform:** designed for desktop browsers, mouse + keyboard. Top bar: contract panel (left, in normal layout flow so text can't collide) · large power meter (centre) · coin balance, pause, tuning (right). Bottom dock: tile value meter over FLIP · ROTATE · AXIS · POWERUPS · DROP, each showing its key.
- **Keys:** R rotate · F flip · X switch axis · Space drop · Q powerups (1/2/3 to pick) · C coins · P / Esc pause · arrow keys orbit · A / D step a frozen tile. Cmd/Ctrl/Alt combos go to the browser; held keys don't repeat actions; a mouse press never leaves focus on a game button, so Space always drops.
- **Placement:** only DROP / Space places a tile. Clicking or dragging the scene only moves the camera (tap-to-place removed).
- **Blocks:** every cube is the same 1×1×1 cell on the grid. Dropping a tile during its arrival scale-up used to freeze it small and off-grid; DROP now completes the arrival first.
- **Scenery:** island props are re-fitted to each blueprint's island and set down using each model's measured base, so nothing floats past the grass or sinks.
- **Tile value (contracts only):** each tile starts at +100 coins and drains `tileValue.drainPerSec` (default 10/s: 0 at 10 s, expiry at 15 s). The value locks when DROP is pressed. A landed tile pays a positive value; a negative value is charged whether or not it lands; at −50 the tile expires as a missed placement (strike) and the −50 is charged. The balance floors at 0 (`tileValue.allowNegativeBalance`). All tunable in the tuning panel. Placeholder numbers, not final rules.
- **Coins:** one balance (◈) for building rewards and tile-value earnings/charges, saved after every change. Coins page (C or the coin chip) shows the balance, how to earn, and recent activity. No shop yet.
- **Powerups** (perfect drops fill a 4-segment meter; using one resets it): Tile Choice (5 options, pick next 3), Freeze Time (8 s: tile and its value stop; ROTATE/FLIP/AXIS still work; A/D step it a cell), Add 1×1 Block (aim with mouse or arrows, Space places it in the lowest open supported cell of that column, so it can fill a gap under an overhang; Esc cancels and keeps the powerup). Landing Shadow, Slow Speed and View/Zoom removed. When ready, the meter glows and the button pulses, glows and shakes; browsers with the Vibration API also buzz.
- **Start-up:** returning players go to their next contract (or the neighbourhood screen once all three are done). New players still start with the tutorial.

## Home hub, economy and auto-finish (Oct 18, 2026)
- **Home** (`src/home.js`): new players go welcome story -> how to play -> home; returning players (any saved progress) open home. A winding path shows the three contracts as done (check + grade), current (highlighted, START/CONTINUE bubble) or locked. The check animation plays once per newly finished contract (`asterra-home-seen`). Shop is a "coming soon" placeholder; View City opens the neighborhood card. New Game / Reset Progress asks for confirmation and erases only `asterra-*` / `polycube-*` keys. No accounts or backend: progress lives in localStorage (`asterra-progress-v2`).
- **Rewards**: contract reward = blueprint cells x `CFG.reward.perCell[grade]` x `CFG.reward.contractBonus[contract]` (A+ 150, A 110, B 70, C 40, D 15 per cell; bonus 1 / 1.2 / 1.4). A+ pays more than the most quick placements can (tiles x 100). All per-grade values are in the tuning panel. Results show quick placements, density reward, penalties and total.
- **Auto-finish**: when every unfilled blueprint cell is covered by a block above it (a hole under an overhang) and the power meter is not full, the build finishes ("No tile can reach the last gaps"). A full meter keeps play going because Add 1x1 Block can still reach those holes.
