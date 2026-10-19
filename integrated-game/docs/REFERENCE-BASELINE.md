# References inspected before integration

Both references were launched in isolated Chromium and passed the initial smoke test before integration changes:

- Original stacking game: project root, `index.html`, local port 4181 for verification. Three.js r128, Vite, localStorage contract progression, identity/onboarding flags, and a 1.9 MB compressed Quaternius scenery library.
- Standalone city: `city-prototype/city.html`, local port 4180. Same renderer, axial hex rules, session-only state, local 5,000-coin sandbox economy, compatible custom water shader, selected Medieval MegaKit OBJ railing, and shared scenery assets.

The originals' available tests were recorded: original `tests/{gameplay,opening,tutorial,contracts,powerups}.spec.js`, golden scenarios; prototype state, placement/life, stacking launch/offline, and preservation tests. The existing historical golden baseline is known to predate current original behavior, and older tutorial/contract specs assume an obsolete launch flow. Neither reference's tests or baselines are edited by this work.

`reference-checksums.json` records original source/configuration/assets and the standalone prototype's source, documentation, test code, and licenses. It excludes generated dependency, distribution, and test-result directories. Final verification compares these hashes.

## Integration decisions

The integrated copy uses one page and one city home, with overview, expandable contracts, site selection, and city-management states. It reuses the original stacking engine, blueprint requirements, controls, density formula, reveal, and timed earnings. Separate scene canvases are retained internally to avoid rewriting the original renderer; only the active mode renders. A new single namespaced localStorage document (`asterra-integrated-v1`) holds city, profile, contracts, coins, and pending completion.

The original tile meter starts at 100 coins and drains 10 per second; it can fall below 50, reach zero, or become a penalty. There is no new perfect-placement coin reward. Density rewards retain the original per-cell values and contract multipliers.
