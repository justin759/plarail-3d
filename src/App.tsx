import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RailScene, type DropProjector } from "./components/RailScene";
import { TrackPalette, dragMime } from "./components/TrackPalette";
import { TrainBuilder } from "./components/TrainBuilder";
import { useEditorStore } from "./store";

function TopBar() {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [sceneName, setSceneName] = useState("");
  const sceneNameInput = useRef<HTMLInputElement | null>(null);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const clearAll = useEditorStore((state) => state.clearAll);
  const saveScene = useEditorStore((state) => state.saveScene);
  const loadScene = useEditorStore((state) => state.loadScene);
  const savedScenes = useEditorStore((state) => state.savedScenes);
  const currentSceneId = useEditorStore((state) => state.currentSceneId);
  const pastCount = useEditorStore((state) => state.past.length);
  const futureCount = useEditorStore((state) => state.future.length);
  const currentScene = currentSceneId
    ? savedScenes.find((scene) => scene.id === currentSceneId)
    : null;
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }),
    [],
  );

  const closeDialogs = useCallback(() => {
    setSaveDialogOpen(false);
    setLoadDialogOpen(false);
  }, []);

  useEffect(() => {
    if (!saveDialogOpen) return;
    const timer = window.setTimeout(() => sceneNameInput.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [saveDialogOpen]);

  useEffect(() => {
    if (!saveDialogOpen && !loadDialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialogs();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDialogs, loadDialogOpen, saveDialogOpen]);

  const formatSavedAt = (savedAt: string) => {
    const date = new Date(savedAt);
    return Number.isNaN(date.getTime()) ? "Saved recently" : dateFormatter.format(date);
  };

  const handleSaveClick = () => {
    if (currentScene) {
      saveScene();
      return;
    }
    setSceneName("");
    setLoadDialogOpen(false);
    setSaveDialogOpen(true);
  };

  const handleInitialSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sceneName.trim()) return;
    const saved = saveScene(sceneName);
    if (saved) closeDialogs();
  };

  return (
    <>
      <header className="top-bar">
        <div className="brand-block">
          <span className="brand-mark">R</span>
          <div>
            <h1>Railway Playground</h1>
            <span>{currentScene ? currentScene.name : "Build it. Run it. Change it."}</span>
          </div>
        </div>
        <div className="top-actions">
          <div className="button-cluster">
            <button onClick={handleSaveClick} type="button">
              Save
            </button>
            <button onClick={() => setLoadDialogOpen(true)} type="button">
              Load
            </button>
          </div>
          <div className="button-cluster">
            <button disabled={pastCount === 0} onClick={undo} type="button">
              Undo
            </button>
            <button disabled={futureCount === 0} onClick={redo} type="button">
              Redo
            </button>
            <button className="clear-button" onClick={clearAll} type="button">
              Clear All
            </button>
          </div>
        </div>
      </header>

      {saveDialogOpen && (
        <div
          className="dialog-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialogs();
          }}
        >
          <section
            aria-labelledby="save-scene-title"
            aria-modal="true"
            className="dialog-panel"
            role="dialog"
          >
            <div className="dialog-heading">
              <span className="eyebrow">Save scene</span>
              <h2 id="save-scene-title">Name your scene</h2>
            </div>
            <form className="scene-form" onSubmit={handleInitialSave}>
              <label className="field-label" htmlFor="scene-name">
                Scene name
              </label>
              <input
                id="scene-name"
                maxLength={60}
                onChange={(event) => setSceneName(event.target.value)}
                ref={sceneNameInput}
                type="text"
                value={sceneName}
              />
              <div className="dialog-actions">
                <button className="secondary-button" onClick={closeDialogs} type="button">
                  Cancel
                </button>
                <button
                  className="primary-button"
                  disabled={!sceneName.trim()}
                  type="submit"
                >
                  Save
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {loadDialogOpen && (
        <div
          className="dialog-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialogs();
          }}
        >
          <section
            aria-labelledby="load-scene-title"
            aria-modal="true"
            className="dialog-panel"
            role="dialog"
          >
            <div className="dialog-heading">
              <span className="eyebrow">Saved scenes</span>
              <h2 id="load-scene-title">Load scene</h2>
            </div>
            <div className="saved-scene-list">
              {savedScenes.length === 0 ? (
                <div className="empty-scenes">No saved scenes yet.</div>
              ) : (
                savedScenes.map((scene) => (
                  <button
                    className={`saved-scene-row ${scene.id === currentSceneId ? "is-current" : ""}`}
                    key={scene.id}
                    onClick={() => {
                      loadScene(scene.id);
                      closeDialogs();
                    }}
                    type="button"
                  >
                    <span>
                      <strong>{scene.name}</strong>
                      <small>{formatSavedAt(scene.savedAt)}</small>
                    </span>
                    {scene.id === currentSceneId && <em>Open</em>}
                  </button>
                ))
              )}
            </div>
            <div className="dialog-actions">
              <button className="secondary-button" onClick={closeDialogs} type="button">
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Notice() {
  const notice = useEditorStore((state) => state.notice);
  const setNotice = useEditorStore((state) => state.setNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3400);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  return notice ? <div className="notice">{notice}</div> : null;
}

function WorldFooter() {
  const railCount = useEditorStore((state) => state.rails.length);
  const trainCount = useEditorStore((state) => state.trains.length);
  const activeTool = useEditorStore((state) => state.activeRailTool);
  const trainPlacementActive = useEditorStore((state) => state.trainPlacementActive);

  return (
    <div className="world-footer">
      <span>
        <strong>{railCount}</strong> track pieces
      </span>
      <span>
        <strong>{trainCount}</strong> / 8 trains
      </span>
      <span className="footer-help">
        {activeTool
          ? `Click grass to place ${activeTool} rails. R rotates 15°. Esc or right-click exits.`
          : trainPlacementActive
            ? "Click or drop the train near a rail. Esc or right-click exits."
            : "Drag to move the map. Right-drag to turn or raise the view. Scroll to zoom."}
      </span>
    </div>
  );
}

function App() {
  const projector = useRef<DropProjector | null>(null);
  const placeRail = useEditorStore((state) => state.placeRail);
  const addTrainFromBuilder = useEditorStore((state) => state.addTrainFromBuilder);
  const activeRailTool = useEditorStore((state) => state.activeRailTool);
  const trainPlacementActive = useEditorStore((state) => state.trainPlacementActive);
  const cancelPlacement = useEditorStore((state) => state.cancelPlacement);
  const rotatePlacementRail = useEditorStore((state) => state.rotatePlacementRail);
  const placementActive = Boolean(activeRailTool || trainPlacementActive);

  const registerProjector = useCallback((next: DropProjector | null) => {
    projector.current = next;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && placementActive) {
        event.preventDefault();
        cancelPlacement();
        return;
      }
      if (
        event.code === "KeyR" &&
        activeRailTool &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        rotatePlacementRail();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeRailTool, cancelPlacement, placementActive, rotatePlacementRail]);

  return (
    <main className="app-shell">
      <TopBar />
      <div className="workspace">
        <TrackPalette />
        <section
          className="world-stage"
          onContextMenu={(event) => {
            event.preventDefault();
            if (placementActive) cancelPlacement();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            event.preventDefault();
            const point = projector.current?.(event.clientX, event.clientY);
            if (!point) return;
            try {
              const payload = JSON.parse(event.dataTransfer.getData(dragMime));
              if (payload.kind === "rail") placeRail(payload.railType, point);
              if (
                payload.kind === "train" &&
                useEditorStore.getState().trainPlacementActive
              ) {
                addTrainFromBuilder(point);
              }
            } catch {
              // Ignore unrelated drops.
            }
          }}
          onPointerDownCapture={(event) => {
            if (event.button !== 2 || !placementActive) return;
            event.preventDefault();
            event.stopPropagation();
            cancelPlacement();
          }}
        >
          <RailScene registerProjector={registerProjector} />
          <div className="stage-instructions">
            <strong>Start building</strong>
            <span>Drag blue rails from the left onto the grass.</span>
          </div>
          <WorldFooter />
          <Notice />
        </section>
        <TrainBuilder />
      </div>
    </main>
  );
}

export default App;
