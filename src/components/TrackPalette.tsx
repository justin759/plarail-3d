import { useEditorStore } from "../store";
import type { RailType } from "../types";

const railItems: { type: RailType; label: string; detail: string; glyph: string }[] = [
  { type: "straight", label: "Straight", detail: "Build forward", glyph: "━" },
  { type: "halfStraight", label: "Half Straight", detail: "Fill a shorter gap", glyph: "─" },
  { type: "quarterStraight", label: "1/4 Straight", detail: "Fine-tune a gap", glyph: "╴" },
  { type: "curve", label: "Curve", detail: "Turn a corner", glyph: "╰" },
  { type: "switch", label: "Y Switch", detail: "Choose a route", glyph: "Y" },
  { type: "turnoutLeft", label: "Turnout Rail L", detail: "Straight or curve left", glyph: "↰" },
  { type: "turnoutRight", label: "Turnout Rail R", detail: "Straight or curve right", glyph: "↱" },
  { type: "crossing", label: "Crossing", detail: "Go straight across", glyph: "+" },
  { type: "slope", label: "Slope", detail: "Climb up or down", glyph: "╱" },
  { type: "support", label: "Support", detail: "Place under high rails", glyph: "▥" },
];

export const dragMime = "application/x-railway-playground";

export function TrackPalette() {
  const activeTool = useEditorStore((state) => state.activeRailTool);
  const chooseRailTool = useEditorStore((state) => state.chooseRailTool);

  return (
    <aside className="side-panel track-panel" aria-label="Track catalog">
      <div className="panel-heading">
        <span className="eyebrow">Build your railway</span>
        <h2>Track Box</h2>
      </div>

      <div className="catalog-list">
        {railItems.map((item) => (
          <button
            className={`catalog-card ${activeTool === item.type ? "is-active" : ""}`}
            draggable
            key={item.type}
            onClick={() => chooseRailTool(activeTool === item.type ? null : item.type)}
            onDragStart={(event) => {
              chooseRailTool(item.type);
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData(
                dragMime,
                JSON.stringify({ kind: "rail", railType: item.type }),
              );
            }}
            type="button"
          >
            <span className={`track-glyph glyph-${item.type}`}>{item.glyph}</span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="panel-tip">
        <strong>Tip</strong>
        <span>Drag a piece onto the grass. Blue ends snap together.</span>
      </div>
    </aside>
  );
}
