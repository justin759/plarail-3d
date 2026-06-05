# Railway Playground Specification

## 1. Product Summary

Railway Playground is a browser-based 3D toy railway sandbox for children. It is
inspired by the playful proportions and snap-together experience of Plarail, but
uses original designs, colors, branding, and geometry.

The core loop is intentionally simple:

1. Pick track pieces from the left panel.
2. Build a connected railway on a large grassland.
3. Assemble a colorful train set in the right panel.
4. Drag the finished train onto a rail.
5. Press Go, change switch routes, and keep building.

The product is a relaxing sandbox rather than a realistic railway simulator.
There are no objectives, failures, collisions, or resource systems in the MVP.

## 2. Audience And Design Principles

### Primary audience

Children using a mouse on a desktop or laptop browser.

### Experience principles

- Favor direct manipulation over configuration screens.
- Make important actions visible through large buttons and short labels.
- Keep railway behavior predictable and forgiving.
- Use bright, chunky toy-plastic visuals rather than product realism.
- Avoid penalties: trains stop safely at unfinished track endpoints.
- Keep the world visually quiet so the railway remains the focus.

## 3. Branding Constraints

- Do not use Tomy logos, Plarail logos, packaging, or copied product designs.
- Keep the project name `Railway Playground`.
- Use original toy-like procedural geometry and color choices for tracks,
  supports, and UI.
- Third-party branded train models or assets require explicit approval and a
  clear license before they are added to `assets/train`.

## 4. MVP Scope

### Included

- Large green play plane with a simple blue sky.
- Mouse-first track construction and editing.
- Straight rails, half-straight rails, quarter-straight rails, curved rails,
  Y-switch rails, left and right turnout rails, crossings, slopes, and
  supports.
- Endpoint snapping for track placement and movement.
- Decorative elevated-track supports placed manually by the player.
- A train builder populated from `assets/train/catalog.csv`.
- Dragging an assembled train onto a rail or clicking it near a rail.
- Up to eight trains in the same layout.
- Fixed-speed train movement over the connected rail graph.
- Go, Stop, Reverse, and Delete controls for trains.
- Rotate, Copy, Delete, and Switch controls for rails.
- Save, Load, Undo, Redo, Clear All, zoom, pan, and mouse view rotation.
- Browser-local scene saving and loading.
- Responsive compact UI behavior for narrower browser windows.

### Deferred

- Autosave and export/import.
- User accounts, cloud storage, and shared layout links.
- Mobile or touch-first controls.
- Audio.
- Tutorials, challenges, missions, or scoring.
- Terrain editing, scenery placement, stations, tunnels, and buildings.
- Collisions, derailments, batteries, speed controls, or physics simulation.
- Automatic support generation.
- Additional camera modes such as top-down, follow-train, or driver view.
- Licensed or branded assets.

## 5. World And Camera

### Environment

- The play surface is a `500 x 500` green plane.
- A subtle grid helps players judge spacing.
- The sky is rendered with Drei's `Sky` component.
- No scenery objects are included in the MVP.

### Camera

- Use a single free-build camera.
- LMB drag on open space pans around the map.
- RMB drag left or right rotates around the current ground target.
- RMB drag up or down adjusts camera height while keeping the ground target in view.
- The scroll wheel zooms in and out.
- Camera distance is constrained to avoid losing the play area.

## 6. Track Construction

### Catalog

The left-side Track Box contains these pieces:

| Piece | Purpose | Routes |
| --- | --- | --- |
| Straight | Standard 216 mm rail segment | Endpoint `0` to `1` |
| Half Straight | Shorter 108 mm rail segment | Endpoint `0` to `1` |
| 1/4 Straight | Fine-adjustment 54 mm rail segment | Endpoint `0` to `1` |
| Curve | 215 mm radius, 45-degree turn | Endpoint `0` to `1` |
| Y Switch | Stem with two selectable branches | `0` to `1`, `0` to `2` |
| Turnout L | Standard straight with a left-hand curve exit | `0` to `1`, `0` to `2` |
| Turnout R | Standard straight with a right-hand curve exit | `0` to `1`, `0` to `2` |
| Crossing | Two independent straight paths | `0` to `1`, `2` to `3` |
| Slope | 432 mm S-shaped run rising by 50 mm | Endpoint `0` to `1` |
| Support | Decorative elevated-track pillar | No train route |

### Placement

- Clicking a catalog card activates that track tool.
- Clicking the grass places the active piece.
- Dragging a track card onto the play area also places that piece.
- The first rail may be placed anywhere on the ground grid.
- Later rails snap to nearby endpoints and rotate into a compatible
  45-degree orientation.
- Non-snapped pieces are placed on integer grid coordinates.
- A translucent preview follows the pointer while a rail tool is active.
- While a rail tool is active, `R` rotates its preview in 15-degree steps.
- `Esc` or RMB exits rail placement mode.

### Physical scale

The simulator uses `54 mm` per world unit. This keeps the original 4-unit
standard straight while making each route dimension traceable to its physical
measurement.

| Constant | Value | Purpose |
| --- | --- | --- |
| `MILLIMETERS_PER_WORLD_UNIT` | `54` | Scale conversion |
| `TRACK_WIDTH_MM` | `25 mm` | Overall molded track width |
| `RIDGE_GAP_MM` | `20 mm` | Interior gap between raised ridges |
| `RAIL_LENGTH` | `4` units = `216 mm` | Standard straight length |
| `HALF_RAIL_LENGTH` | `2` units = `108 mm` | Half-straight length |
| `QUARTER_RAIL_LENGTH` | `1` unit = `54 mm` | Quarter-straight length |
| `CURVE_RADIUS` | `3.9815` units = `215 mm` | Curve centerline radius |
| `CURVE_ANGLE` | `45 degrees` | Eight curves form a full circle |
| `SLOPE_RUN` | `8` units = `432 mm` | Two-straight horizontal slope run |
| `LEVEL_HEIGHT` | `0.9259` units = `50 mm` | Height gained by a slope |
| `SNAP_DISTANCE` | `2` units = `108 mm` | Placement snap search radius |
| Connection tolerance | `0.0370` units = `2 mm` | Runtime endpoint matching tolerance |

The raised ridges are centered so that their interior edges remain exactly
`20 mm` apart inside the `25 mm` overall track width.

### Inferred dimensions

Measurements for every catalog item were not supplied. Until more references
are provided:

- The crossing uses one standard straight span (`216 mm`) in each direction.
- The Y switch uses a standard straight horizontal run (`216 mm`) and a
  half-straight branch offset (`108 mm`).
- Each turnout combines an unchanged standard straight route (`216 mm`) with
  one unchanged standard curve route (`215 mm` radius, `45 degrees`). Turnout L
  and Turnout R mirror the curve exit.
- Supports are decorative and default to the standard `50 mm` level height.

### Slopes And Supports

- A slope spans two standard straights horizontally and uses a smooth S-shaped
  elevation curve to rise by `LEVEL_HEIGHT`.
- Elevated straight and curved rails may attach to elevated endpoints.
- Supports never participate in the route graph.
- Children place supports manually as decoration.
- A newly placed support estimates its height from nearby elevated rails.
- Missing supports must not prevent a train from running.

### Switches, Turnouts, And Crossings

- A Y switch has one stem and two branches.
- A turnout has one stem, one straight exit, and one curved exit.
- Turnout L curves left and Turnout R curves right.
- A selected Y switch or turnout exposes a floating `Switch` button.
- The button toggles the active branch and visibly moves the yellow lever.
- A train entering from the stem follows the active branch.
- A train entering from either branch of a Y switch or turnout merges toward
  the stem.
- A crossing has two independent routes. Trains always continue straight.

## 7. Track Editing

Click or drag a rail to select it. Floating controls appear above the selected
piece:

- `Rotate`: rotate the selected non-support rail by 45 degrees.
- `Switch`: toggle the active branch of a selected Y switch or turnout.
- `Copy`: duplicate the piece with a small position offset.
- `Delete`: remove the piece.

Dragging an existing rail moves it and recalculates its snapped placement.
Deleting a rail also deletes any train whose lead carriage is currently on that
rail.

The top bar includes:

- `Save`
- `Load`
- `Undo`
- `Redo`
- `Clear All`

Undo history stores up to 50 scene snapshots. Scene history includes rails and
placed trains. The in-progress train builder is intentionally not part of the
undo history.

## 8. Scene Saving And Loading

### Save behavior

- The first `Save` action for an unnamed scene opens a dialog asking for a
  scene name.
- The scene name is required before the initial save can complete.
- A successful initial save assigns the current browser session a saved scene
  identity.
- Later `Save` actions for that scene update the existing saved scene directly
  without reopening the name dialog.
- The saved payload is a scene snapshot containing placed rails and placed
  trains.
- The in-progress train builder is not included in saved scene snapshots.

### Load behavior

- `Load` opens a dialog listing all scenes saved in the current browser storage.
- Each saved scene row shows the scene name and last-saved timestamp.
- The currently open saved scene is visually marked in the load list.
- Loading a scene replaces the current placed rails and trains with the saved
  snapshot.
- Loading clears selection, placement preview state, active placement tools,
  drag state, undo history, and redo history.

### Persistence limits

- Saved scenes are stored in `window.localStorage` under
  `railway-playground:saved-scenes`.
- Saved scenes persist across browser restarts and device reboots when the user
  returns in the same browser profile, on the same device, and at the same app
  origin.
- Saved scenes do not sync to other devices, browsers, browser profiles, or app
  origins.
- Private browsing sessions, clearing site data, browser storage pressure, or
  browser privacy settings may remove saved scenes.
- The saved scene list persists after a page reload, but the current open scene
  identity is runtime state. After reopening the app, the user can choose a
  saved scene from `Load`; quick-save resumes after that load.

## 9. Train Builder

### Layout

The right-side Train Builder contains:

1. Front-carriage catalog.
2. Trailer carriage catalog.
3. The current train assembly strip.
4. A finished-train drag handle.

### Starter catalog

The catalog is read from `assets/train/catalog.csv`.

| Column | Meaning |
| --- | --- | --- |
| `type` | `front` or `trailer` |
| `label` | User-facing model name |
| `filename` | Asset basename without extension |

Each row uses `filename + ".obj"` for the mesh and `filename + "_d.png"` for
the UV texture.

### Vehicle dimensions

Real train assets are normalized into the toy scene scale:

| Dimension | Value |
| --- | --- |
| Length | `150 mm` |
| Width | `38 mm` |
| Height | `42 mm` |

The OBJ files are authored with their long axis along local `Z`. Runtime
rendering rotates that axis onto the route tangent and applies the catalog
texture to the mesh.

### Builder rules

- A valid train starts with a `front` carriage.
- After the lead carriage exists, additional carriages may be either `trailer`
  or `front` type.
- Section 2 lists trailer carriages only; front carriages are not repeated
  there.
- Any non-lead `front` carriage is rendered rotated `180` degrees for physical
  linkage.
- Trailing carriages may be reordered or removed from the assembly strip.
- The builder may be cleared without changing already placed trains.
- Dragging the finished train onto a nearby rail or clicking it near a rail
  creates a placed train and clears the builder.
- `Esc` or RMB exits train placement mode without placing the train.
- A newly placed train starts stopped and selected.

## 10. Train Simulation

### Behavior

- A layout may contain up to eight trains.
- Trains run at a fixed child-friendly speed.
- Lead carriages follow the connected route graph.
- Trailing carriages follow a sampled trail of prior lead-carriage positions at
  fixed spacing.
- Every segment pitches to match the current track slope.
- Slopes change train height but do not affect speed.
- Trains stop gently when they reach an unconnected endpoint.
- Trains do not collide or derail.
- Trains may visually pass through one another.
- Deleting a train removes it immediately.

### Train controls

Click a placed train to show:

- `Go` or `Stop`
- `Reverse`
- `Delete`

Reverse swaps the current route direction, mirrors progress along that route,
and clears the stored carriage trail so the consist settles into its new
direction.

### Simulation constants

| Constant | Value | Purpose |
| --- | --- | --- |
| `TRAIN_SPEED` | `2.65` | World units travelled per second |
| Carriage spacing | `2.8889` units = `156 mm` | Distance between sampled vehicle poses |
| Trail cap | `1200` samples | Maximum stored lead-carriage path history |
| Frame delta cap | `0.05` seconds | Limits large animation jumps |

## 11. User Interface

```text
┌──────────────────────────────────────────────────────────────┐
│ Railway Playground      Save Load Undo Redo Clear All       │
├──────────────┬────────────────────────────┬──────────────────┤
│ Track Box    │                            │ Train Builder    │
│              │       3D grassland         │                  │
│ rail pieces  │       floating controls    │ fronts/trailers  │
│ supports     │                            │ assembled train  │
└──────────────┴────────────────────────────┴──────────────────┘
```

### Responsive behavior

- The standard desktop layout uses a `224px` left panel and `282px` right
  panel.
- Below `900px`, both panels and controls become more compact.
- The 3D stage always remains between the two panels.
- Mobile and touch-specific interaction design remain deferred.

## 12. Technical Architecture

### Stack

- React 19
- TypeScript
- Vite
- Three.js
- React Three Fiber
- Drei
- Zustand

### Module responsibilities

| Module | Responsibility |
| --- | --- |
| `src/App.tsx` | Application shell, top bar, stage drop handling, notices |
| `src/types.ts` | Shared editor and simulation data structures |
| `src/railMath.ts` | Rail endpoints, routes, snapping, interpolation, connections |
| `src/trainCatalog.ts` | Train asset catalog parsing and URL resolution |
| `src/store.ts` | Zustand state, history, saved scenes, builder actions, simulation stepping |
| `src/components/RailScene.tsx` | 3D rendering, camera, selection controls, animation loop |
| `src/components/TrackPalette.tsx` | Left-side rail catalog |
| `src/components/TrainBuilder.tsx` | Right-side train assembly interface |
| `src/styles.css` | Desktop and compact responsive styling |

### State model

```ts
interface RailPiece {
  id: string;
  type: RailType;
  position: [number, number, number];
  rotation: number;
  activeBranch: 1 | 2;
  supportHeight?: number;
}

interface TrainSet {
  id: string;
  cars: VehiclePart[];
  railId: string;
  route: [number, number];
  progress: number;
  running: boolean;
  trail: TrailPoint[];
}

interface SceneSnapshot {
  rails: RailPiece[];
  trains: TrainSet[];
}

interface SavedScene {
  id: string;
  name: string;
  savedAt: string;
  snapshot: SceneSnapshot;
}
```

### Route graph design

Each route-bearing rail exposes typed endpoints in local space. Endpoint
positions are transformed into world space using the rail position and
rotation. A connection exists when two world-space endpoints fall within the
connection tolerance.

The simulation does not use rigid-body physics. Each lead carriage advances
along a route curve, detects the matching endpoint on the next rail, asks that
rail for the route corresponding to its entry endpoint, and continues with any
overshoot distance preserved.

## 13. Acceptance Criteria

- A child can build connected tracks using visible mouse controls.
- Straight, half-straight, quarter-straight, curved, Y-switch, turnout L,
  turnout R, crossing, slope, and support pieces can be placed.
- Nearby rail endpoints snap together automatically.
- Rails can be moved, rotated, duplicated, and deleted.
- A Y switch or turnout route can be toggled while trains are running.
- Children can assemble a train from a front carriage followed by any mix of
  trailer and additional front carriages.
- A finished train can be dragged or clicked onto a rail and started with the
  floating `Go` button.
- A train follows connected rails and stops at unfinished endpoints.
- Several trains can run at once without collision handling.
- The first scene save asks for a name and stores the current scene locally.
- Subsequent saves of that same scene update it without reopening the name
  dialog.
- Saved scenes appear in the `Load` dialog and can replace the current scene.
- Undo, Redo, and Clear All remain available through visible controls.
- The interface remains usable in a narrower side-by-side browser window.
- `npm run build` succeeds.

## 14. Current MVP Notes

The initial implementation is a playable MVP. These refinements are reasonable
future improvements but are not blockers for the current release:

- Add invalid-placement detection and a red invalid preview.
- Add automated tests for rail interpolation, snapping, and route transitions.
- Add an ESLint flat configuration before treating `npm run lint` as a required
  check.
- Split the production JavaScript bundle if load performance becomes a concern.
- Profile layouts near the intended upper range of 300 rail pieces and eight
  active trains.
