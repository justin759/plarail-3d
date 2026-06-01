import { useCallback, useEffect, useRef } from "react";
import { RailScene, type DropProjector } from "./components/RailScene";
import { TrackPalette, dragMime } from "./components/TrackPalette";
import { TrainBuilder } from "./components/TrainBuilder";
import { useEditorStore } from "./store";

function TopBar() {
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const clearAll = useEditorStore((state) => state.clearAll);
  const turnCamera = useEditorStore((state) => state.turnCamera);
  const pastCount = useEditorStore((state) => state.past.length);
  const futureCount = useEditorStore((state) => state.future.length);

  return (
    <header className="top-bar">
      <div className="brand-block">
        <span className="brand-mark">R</span>
        <div>
          <h1>Railway Playground</h1>
          <span>Build it. Run it. Change it.</span>
        </div>
      </div>
      <div className="top-actions">
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
        <div className="button-cluster camera-cluster">
          <span>Turn view</span>
          <button aria-label="Turn view left" onClick={() => turnCamera(-Math.PI / 8)} type="button">
            ◀
          </button>
          <button aria-label="Turn view right" onClick={() => turnCamera(Math.PI / 8)} type="button">
            ▶
          </button>
        </div>
      </div>
    </header>
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
            ? "Drop the train onto a rail. Esc or right-click exits."
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
