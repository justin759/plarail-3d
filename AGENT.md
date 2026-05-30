# Railway Playground Agent Guide

## Purpose

This repository contains a child-friendly browser-based 3D toy railway
sandbox. Read `SPEC.md` before changing product behavior. Preserve the playful,
forgiving experience: direct manipulation, visible controls, predictable track
routing, and no failure-heavy simulation rules.

## Quick Start

```bash
npm install
npm run dev -- --host 127.0.0.1
npm run build
```

The local preview is normally available at `http://127.0.0.1:5173/`.

`npm run build` is the required automated validation command. A `lint` script
exists, but the repository does not yet include an ESLint flat configuration,
so do not treat `npm run lint` as a passing gate until that configuration is
added.

## Repository Map

| File | Responsibility |
| --- | --- |
| `SPEC.md` | Product contract, supported behavior, and deferred scope |
| `src/App.tsx` | Shell layout, top bar, drag/drop projection, notices |
| `src/types.ts` | Shared TypeScript models |
| `src/railMath.ts` | Core route graph and placement calculations |
| `src/store.ts` | Zustand editor state, undo history, builder, train stepping |
| `src/components/RailScene.tsx` | Procedural 3D models and animation loop |
| `src/components/TrackPalette.tsx` | Track catalog |
| `src/components/TrainBuilder.tsx` | Train assembly UI |
| `src/styles.css` | Layout, visual styling, responsive behavior |

## Architectural Rules

### Keep rails graph-driven

Trains follow a lightweight endpoint graph. Do not introduce rigid-body physics
for ordinary train movement. The graph model is deliberate: it keeps behavior
stable, understandable, and fast with several trains.

Each route-bearing rail needs:

- Local endpoints in `localEndpoints()`.
- Available endpoint pairs in `railRoutes()`.
- Entry-to-exit routing in `routeForEntry()`.
- Curve interpolation in `canonicalLocalPoint()`.
- Rendering through the existing route sampling in `RailScene.tsx`.

Supports are decorative. They expose no endpoints and never affect whether a
train can run.

### Preserve the millimeter-derived scale

Use `mmToWorld()` and the constants in `src/railMath.ts` for track geometry.
The canonical conversion is `54 mm` per world unit:

- Standard straight: `216 mm`.
- Half straight: `108 mm`.
- Quarter straight: `54 mm`.
- Overall track width: `25 mm`.
- Raised-ridge interior gap: `20 mm`.
- Curve radius: `215 mm`, with eight 45-degree pieces per full circle.
- Slope: `432 mm` horizontal S-shaped run rising `50 mm`.
- Train segment: `100 mm L x 38 mm W x 40 mm H`.

The crossing and Y-switch dimensions are explicitly documented assumptions in
`SPEC.md`. Turnouts combine the exact standard-straight and standard-curve
routes. Update assumptions when better measurements are available.

### Keep train behavior forgiving

- Trains stop at open endpoints.
- Trains do not collide or derail.
- Trains may overlap visually.
- Slopes alter height but not speed.
- Train segments pitch to follow slope tangents.
- The placed-train limit is eight.
- A built train has one engine followed by at most five coaches.

Do not add penalties, failures, or realism systems unless the product spec is
updated first.

### Keep interaction mouse-first

The MVP is designed for LMB, drag/drop, and scroll-wheel zoom. Important
actions must remain available as visible buttons. Keyboard shortcuts may be
added as optional accelerators, but they cannot replace mouse controls.

### Keep the visuals original

Use procedural toy-like shapes and original styling. Do not add Tomy or
Plarail branding, copied product meshes, logos, or packaging.

## Common Change Recipes

### Add a new track piece

Update these locations together:

1. Add the type to `RailType` in `src/types.ts`.
2. Define local endpoints in `src/railMath.ts`.
3. Define valid routes and entry routing in `src/railMath.ts`.
4. Add route interpolation in `src/railMath.ts`.
5. Add a catalog card in `src/components/TrackPalette.tsx`.
6. Add or adjust rendering in `src/components/RailScene.tsx`.
7. Update `SPEC.md`.
8. Build and manually verify placement, snapping, movement, and endpoint stops.

### Add a new vehicle part

Update these locations together:

1. Extend `VehicleKind` in `src/types.ts` if needed.
2. Add builder metadata and creation behavior in `src/store.ts`.
3. Add the catalog entry in `src/components/TrainBuilder.tsx`.
4. Add procedural geometry in `VehicleModel()` in
   `src/components/RailScene.tsx`.
5. Update `SPEC.md`.

### Change simulation rules

Start in `src/railMath.ts` for geometry and route decisions. Start in
`tickTrains()` in `src/store.ts` for frame-by-frame movement. Keep coach
following based on sampled engine trail positions unless there is a strong
reason to replace it.

## Validation Checklist

Run:

```bash
npm run build
```

For user-facing or simulation changes, also open the local app and verify:

1. Place straight, half-straight, quarter-straight, curve, Y-switch, turnout L,
   turnout R, crossing, slope, and support pieces.
2. Move, rotate, duplicate, and delete a selected rail.
3. Toggle a Y switch and both turnouts, then confirm their levers move.
4. Build a train with an engine and several coaches.
5. Drag the finished train onto a rail.
6. Press Go and confirm the train follows connected rails.
7. Confirm the train stops at an unfinished endpoint.
8. Reverse and delete a selected train.
9. Check Undo, Redo, Clear All, zoom, pan, and Turn View.
10. Check both a wide desktop layout and a narrower browser window.

## Known MVP Constraints

- There is no persistence or import/export.
- There is no automated test suite yet.
- Invalid overlap placement is not blocked yet.
- The Vite production build reports a large bundle warning because the 3D
  dependencies ship in the main chunk.
- Mobile and touch-specific interactions are deferred.
- Supports are visual decoration only.

## Working Style

- Keep changes scoped to the requested behavior.
- Use the existing Zustand state model instead of adding parallel editor state.
- Preserve undo history for scene-changing editor actions.
- Avoid committing `node_modules/`, `dist/`, or TypeScript build metadata.
- Update `SPEC.md` whenever product behavior or scope changes.
- Prefer small procedural models over external asset dependencies for the MVP.
