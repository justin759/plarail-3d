import { useEditorStore } from "../store";
import type { VehicleKind } from "../types";
import { dragMime } from "./TrackPalette";

const carCatalog: { kind: VehicleKind; label: string; detail: string; color: string }[] = [
  { kind: "passenger", label: "Passenger", detail: "Gray coach", color: "#8b96a1" },
  { kind: "cargo", label: "Cargo", detail: "Orange wagon", color: "#f59f38" },
  { kind: "rear", label: "Rear Coach", detail: "Red tail coach", color: "#e95658" },
];

const engineCatalog = [
  { variant: "gray", color: "#7d8792" },
  { variant: "red", color: "#ef5350" },
  { variant: "yellow", color: "#ffbf34" },
];

function setPartDrag(event: React.DragEvent, kind: VehicleKind, variant?: string) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(dragMime, JSON.stringify({ kind: "builder-part", partKind: kind, variant }));
}

export function TrainBuilder() {
  const builder = useEditorStore((state) => state.builder);
  const addBuilderPart = useEditorStore((state) => state.addBuilderPart);
  const removeBuilderPart = useEditorStore((state) => state.removeBuilderPart);
  const moveBuilderPart = useEditorStore((state) => state.moveBuilderPart);
  const clearBuilder = useEditorStore((state) => state.clearBuilder);
  const beginTrainPlacement = useEditorStore((state) => state.beginTrainPlacement);
  const cancelPlacement = useEditorStore((state) => state.cancelPlacement);
  const hasEngine = builder[0]?.kind === "engine";

  return (
    <aside className="side-panel train-panel" aria-label="Train builder">
      <div className="panel-heading">
        <span className="eyebrow">Make a train set</span>
        <h2>Train Builder</h2>
      </div>

      <section className="builder-section">
        <div className="section-label">1. Choose an engine</div>
        <div className="engine-row">
          {engineCatalog.map((engine) => (
            <button
              aria-label={`${engine.variant} engine`}
              className="engine-choice"
              draggable
              key={engine.variant}
              onClick={() => addBuilderPart("engine", engine.variant)}
              onDragStart={(event) => setPartDrag(event, "engine", engine.variant)}
              style={{ "--vehicle-color": engine.color } as React.CSSProperties}
              type="button"
            >
              <span className="engine-mini">
                <i />
              </span>
              <small>{engine.variant}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="builder-section">
        <div className="section-label">2. Add coaches</div>
        <div className="coach-grid">
          {carCatalog.map((car) => (
            <button
              className="coach-choice"
              draggable
              key={car.kind}
              onClick={() => addBuilderPart(car.kind)}
              onDragStart={(event) => setPartDrag(event, car.kind)}
              type="button"
            >
              <span className="coach-swatch" style={{ backgroundColor: car.color }} />
              <span>
                <strong>{car.label}</strong>
                <small>{car.detail}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="builder-section assembly-section">
        <div className="assembly-heading">
          <div className="section-label">3. Your train</div>
          {builder.length > 0 && (
            <button className="text-button" onClick={clearBuilder} type="button">
              Clear
            </button>
          )}
        </div>

        <div
          className={`assembly-strip ${builder.length === 0 ? "is-empty" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            try {
              const payload = JSON.parse(event.dataTransfer.getData(dragMime));
              if (payload.kind === "builder-part") addBuilderPart(payload.partKind, payload.variant);
            } catch {
              // Ignore unrelated drops.
            }
          }}
        >
          {builder.length === 0 ? (
            <span>Drop train parts here</span>
          ) : (
            builder.map((part, index) => (
              <div className="assembled-car" key={part.id}>
                <span className={`assembled-icon kind-${part.kind}`} style={{ background: part.color }}>
                  {part.kind === "engine" ? <i /> : null}
                </span>
                <small>{index === 0 ? "Engine" : index}</small>
                <div className="assembled-actions">
                  {part.kind !== "engine" && (
                    <>
                      <button
                        aria-label="Move coach left"
                        disabled={index <= 1}
                        onClick={() => moveBuilderPart(part.id, -1)}
                        type="button"
                      >
                        ‹
                      </button>
                      <button
                        aria-label="Move coach right"
                        disabled={index === builder.length - 1}
                        onClick={() => moveBuilderPart(part.id, 1)}
                        type="button"
                      >
                        ›
                      </button>
                    </>
                  )}
                  <button aria-label="Remove part" onClick={() => removeBuilderPart(part.id)} type="button">
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div
        className={`finished-train ${hasEngine ? "is-ready" : ""}`}
        draggable={hasEngine}
        onDragStart={(event) => {
          if (!hasEngine) return;
          beginTrainPlacement();
          event.dataTransfer.effectAllowed = "copy";
          event.dataTransfer.setData(dragMime, JSON.stringify({ kind: "train" }));
        }}
        onDragEnd={cancelPlacement}
      >
        <div>
          <strong>{hasEngine ? "Your train is ready" : "Start with an engine"}</strong>
          <span>{hasEngine ? "Drag this train onto any rail" : "Pick a color above"}</span>
        </div>
        <span className="drag-handle">Drag</span>
      </div>
    </aside>
  );
}
