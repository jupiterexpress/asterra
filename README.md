# Asterra — integrated city & stacking

Independent project copy. Neither the parent stacking project nor `city-prototype` is used as a runtime source or modified by this integration.

## Run

From this directory:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:4190/. In the current workspace, existing parent dependencies also work without another install. For the production build, run `npm run build` then `npm run preview`. Run `npm run test:state` for state checks or `npm run test:browser` for local browser checks; the browser command builds and starts its own preview server. The reference-only checks need the original projects running and `ORIGINAL_GAME_URL` / `CITY_PROTOTYPE_URL` set. No public deployment was performed.

## Play

Enter your contractor name, follow the original earthquake introduction and guided stacking tutorial, then enter the persistent city. Open **Contracts**, inspect the next blueprint, select a vacant hex, and choose **Continue building**. Complete the original stacking challenge: the completed contract becomes its corresponding village house or workshop at your chosen site. Your stacked cells remain saved and determine density and grade. Completed contracts cannot be rebuilt for another reward.

**Manage city** offers terrain, paths, roads, ponds, bridges, rooftop gardens, groves and lanterns; no finished-building catalog exists. Click a tile to preview, then confirm. R rotates bridges, Escape cancels, Enter confirms. Right-drag to orbit and scroll to zoom. Bridges need water and two clear, opposite dry banks; paths may be added afterward. Roof gardens use a supported terrace on the workshop or an added garden annex on the timber houses.

The single `asterra-integrated-v1` browser save contains identity, introduction/tutorial progress, city, coins and contract completion. Reset affects this save only. Exiting or reloading an unfinished attempt releases its reserved site; already earned tile coins are retained under the original rules. Completed results queued during the finishing animation are recovered on return.

## Implementation

- `shared/store.js`: shared save, currency, site reservation and atomic completion.
- `src/home.js`: one city hub with overview, contracts, site selection and management states.
- `src/contract.js`: original challenge connected to selected sites and shared rewards.
- `city/state.js`: configurable prices and hex placement rules.
- `city/world.js`: terrain, connections, actual stacked buildings, roof gardens, water and ambient life.
- `src/building.js`: blueprint surface extraction. `src/village-buildings.js`: the prototype’s House_1, House_3 workshop and House_2 designs, matching finishing reveal/city appearance, and supported garden terraces.
- `src/integrated.css`, `src/{scene,scenery,opening-scene,config,blueprints}.js`: coordinated visual presentation. Numeric gameplay rules and blueprint requirements are preserved.
- `index.html`, Vite/package/Playwright configuration: independent entry and workflow.

## Assets

Retains the original compressed Quaternius scenery library for vegetation and environmental assets. The selected Medieval Village MegaKit balcony railing is fitted to garden edges. Supplied pack licenses and original project license are included. See `public/models/` and `public/models/city/`. As requested in the visual revision, completed architecture uses the prototype’s distinct village models by contract type, scaled to the completed build’s footprint. Stacking remains the only construction and grading mechanism; there is no house purchase catalog. Ponds reuse the prototype's custom Three.js r128-compatible animated turquoise shader, with stylized sky reflection. The supplied newer Three.js shader demo was not imported as an incompatible dependency.

## Scope and limitations

Three original contracts; no endless progression, passive income, demolition or building relocation. Bridges span one water hex. Gardens occupy supported flat terrace annexes; they do not place planters on sloping roofs. Fish and geometric inhabitants are decorative animations rather than simulation. Saves are local to this browser/origin; unfinished piece-by-piece attempts do not resume. Water uses stylized reflection rather than screen-space or planar scene reflections. No cloud save or public hosting.

See [verification](docs/VERIFICATION.md) for tested flows, economy results and reference preservation.

## Player settings

Open Settings from the city, stacking gear button or pause menu. Save a contractor name, remap the nine stacking actions, toggle sound effects, and adjust stacking camera sensitivity. Duplicate bindings are rejected; Escape remains a fixed menu/pause key. Defaults can be restored. Settings share the existing browser save and old saves receive defaults without resetting the city.
