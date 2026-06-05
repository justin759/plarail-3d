# Development Log

Use this file to record notable project changes, decisions, and follow-up ideas.
Add new entries below older ones so the development journey reads from earliest
to latest.

## 2026-06-05

### Local Scene Save/Load

- Removed the top-bar `Turn View` button cluster. Camera rotation remains
  available through right-dragging the 3D stage.
- Added top-bar `Save` and `Load` actions.
- Initial `Save` opens a dialog that requires a scene name.
- Subsequent `Save` actions quick-save the current named scene without opening
  the dialog again.
- Added a `Load` dialog that lists saved scenes with names, timestamps, and an
  `Open` marker for the currently loaded scene.
- Saving persists placed rails and trains as scene snapshots in browser
  `localStorage` under `railway-playground:saved-scenes`.
- Loading replaces the current scene and clears transient editor state such as
  selection, active placement tools, drag state, undo history, and redo history.

### Persistence Decision

- Saved scenes are intentionally browser-local for now.
- Saves should survive browser restarts and device reboots when users return in
  the same browser profile, on the same device, and at the same app origin.
- Saves do not sync across devices, browsers, profiles, or origins.
- Private browsing, clearing site data, storage pressure, or browser privacy
  settings may remove saved scenes.
- The list of saved scenes persists after reload, but the current open scene
  identity is runtime-only; quick-save resumes after the user loads a saved
  scene.

### Spec And Verification

- Updated `SPEC.md` to document Save/Load as part of the MVP instead of a
  deferred feature.
- Added the local-storage persistence limits, quick-save rule, load behavior,
  and updated top-bar diagram to the spec.
- Verified with `npm run build`.
- Browser-tested initial save, quick-save, load, desktop/mobile top-bar layout,
  absence of `Turn View`, and nonblank 3D canvas rendering.
- `npm run lint` still cannot run because the repo does not yet include an
  ESLint v9 flat config file.

### Real Train Models

- Replaced the procedural MVP train meshes with real OBJ train assets from
  `assets/train`.
- Added catalog-driven train selection from `assets/train/catalog.csv`.
- Each catalog entry now resolves `filename + ".obj"` as the mesh and
  `filename + "_d.png"` as the UV texture.
- Added runtime OBJ and texture loading in the 3D scene.
- Normalized train assets into the toy scene scale and aligned their local long
  axis to the rail tangent.

### Train Builder

- Changed the builder from mock engine/coach parts to catalog carriages.
- A train must start with a `front` carriage.
- After the lead front exists, users can add any mix of trailer and additional
  front carriages.
- The `2. Add Carriages` section shows trailer types only; front types are not
  repeated there.
- Any non-lead front carriage renders rotated 180 degrees for physical linkage.
- Trailing carriages can be reordered or removed.

### Placement And Verification

- Added click-to-place support in addition to drag/drop placement.
- Successful train placement now clears placement mode and the builder.
- Increased train trail history so longer consists can follow curves and slopes
  more reliably.
- Verified with `npm run build` and browser checks: catalog thumbnails load,
  real textured train models render on rails, mixed front/trailer consists place
  correctly, and no console warnings/errors were observed.

### Notes

- `assets/` contains the train OBJ/PNG files and must be committed with the code
  for the real model flow to work.
- The Vite production build still reports the known large bundle warning.

## 2026-06-06

### Browser Memory Investigation

- Investigated browser reloads caused by high memory use in the dev app.
- Chrome heap snapshots showed large retained `PerformanceMeasure` growth.
- Confirmed the app does not call `performance.mark()` or
  `performance.measure()` directly.
- Traced the retained measures to React development instrumentation triggered
  by frequent React/zustand commits from the train simulation loop.

### Memory Fix

- Added a dev-only Performance Timeline guard that clears accumulated
  performance marks and measures every second.
- Wired the guard into app startup before React renders.
- Reduced train simulation state commits from every rendered frame to a fixed
  30 Hz cadence.
- Kept production behavior free of the dev-only timeline guard.

### Verification

- Verified with `npm run build`.
- Confirmed the running Vite dev server serves the updated performance guard.
- User re-tested the app and confirmed the memory leak is fixed.
- `npm run lint` still cannot run because the repo does not yet include an
  ESLint v9 flat config file.
