import { useEditorStore } from "../store";
import { frontCarriages, trailerCarriages, type TrainCatalogItem } from "../trainCatalog";
import { dragMime } from "./TrackPalette";

function setPartDrag(event: React.DragEvent, catalogId: string) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(dragMime, JSON.stringify({ kind: "builder-part", catalogId }));
}

function hideNativeDragImage(event: React.DragEvent) {
  const image = document.createElement("canvas");
  image.width = 1;
  image.height = 1;
  event.dataTransfer.setDragImage(image, 0, 0);
}

function CarriageChoice({
  item,
  onChoose,
}: {
  item: TrainCatalogItem;
  onChoose: (catalogId: string) => void;
}) {
  return (
    <button
      className={`carriage-choice type-${item.type}`}
      draggable
      onClick={() => onChoose(item.id)}
      onDragStart={(event) => setPartDrag(event, item.id)}
      type="button"
    >
      <span className="carriage-thumb" style={{ backgroundImage: `url("${item.textureUrl}")` }} />
      <span>
        <strong>{item.label}</strong>
        <small>{item.type}</small>
      </span>
    </button>
  );
}

interface TrainBuilderProps {
  onBeginTrainPlacement: (clientX: number, clientY: number) => void;
}

export function TrainBuilder({ onBeginTrainPlacement }: TrainBuilderProps) {
  const builder = useEditorStore((state) => state.builder);
  const addBuilderPart = useEditorStore((state) => state.addBuilderPart);
  const removeBuilderPart = useEditorStore((state) => state.removeBuilderPart);
  const moveBuilderPart = useEditorStore((state) => state.moveBuilderPart);
  const clearBuilder = useEditorStore((state) => state.clearBuilder);
  const cancelPlacement = useEditorStore((state) => state.cancelPlacement);
  const hasFront = builder[0]?.carriageType === "front";

  return (
    <aside className="side-panel train-panel" aria-label="Train builder">
      <div className="panel-heading">
        <span className="eyebrow">Make a train set</span>
        <h2>Train Builder</h2>
      </div>

      <section className="builder-section">
        <div className="section-label">1. Front carriage</div>
        <div className="carriage-grid">
          {frontCarriages.map((item) => (
            <CarriageChoice item={item} key={item.id} onChoose={addBuilderPart} />
          ))}
        </div>
      </section>

      <section className="builder-section">
        <div className="section-label">2. Add carriages</div>
        <div className="carriage-grid">
          {trailerCarriages.map((item) => (
            <CarriageChoice item={item} key={item.id} onChoose={addBuilderPart} />
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
              if (payload.kind === "builder-part") {
                addBuilderPart(payload.catalogId);
              }
            } catch {
              // Ignore unrelated drops.
            }
          }}
        >
          {builder.length === 0 ? (
            <span>Drop train parts here</span>
          ) : (
            builder.map((part, index) => {
              const isTrailingFront = index > 0 && part.carriageType === "front";
              const canMoveLeft = index > 1;
              const canMoveRight = index > 0 && index < builder.length - 1;

              return (
                <div className="assembled-car" key={part.id}>
                  <span className={`assembled-icon type-${part.carriageType}`} />
                  <div className="assembled-copy">
                    <strong>{part.label}</strong>
                    <small>{index === 0 ? "Front" : isTrailingFront ? `Front ${index}` : `Trailer ${index}`}</small>
                  </div>
                  <div className="assembled-actions">
                    {index > 0 && (
                      <>
                        <button
                          aria-label="Move carriage left"
                          disabled={!canMoveLeft}
                          onClick={() => moveBuilderPart(part.id, -1)}
                          type="button"
                        >
                          ‹
                        </button>
                        <button
                          aria-label="Move carriage right"
                          disabled={!canMoveRight}
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
              );
            })
          )}
        </div>
      </section>

      <div
        className={`finished-train ${hasFront ? "is-ready" : ""}`}
        draggable={hasFront}
        onClick={(event) => {
          if (hasFront) onBeginTrainPlacement(event.clientX, event.clientY);
        }}
        onDragStart={(event) => {
          if (!hasFront) return;
          onBeginTrainPlacement(event.clientX, event.clientY);
          event.dataTransfer.effectAllowed = "copy";
          event.dataTransfer.setData(dragMime, JSON.stringify({ kind: "train" }));
          hideNativeDragImage(event);
        }}
        onDragEnd={cancelPlacement}
        onPointerDown={(event) => {
          if (!hasFront || event.button !== 0) return;
          onBeginTrainPlacement(event.clientX, event.clientY);
        }}
      >
        <div>
          <strong>{hasFront ? "Your train is ready👆" : "Start with a front"}</strong>
          <span>{hasFront ? "Drag this train onto any rail" : "Pick a model above"}</span>
        </div>
      </div>
    </aside>
  );
}
