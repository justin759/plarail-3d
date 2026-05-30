import { create } from "zustand";
import {
  CURVE_ANGLE,
  closestRailPlacement,
  findConnection,
  placementForRail,
  pointOnRoute,
  poseForTrain,
  routeForEntry,
  routeLength,
  TRAIN_SPEED,
} from "./railMath";
import type {
  PlacementPreview,
  RailPiece,
  RailType,
  SceneSnapshot,
  Selection,
  TrainSet,
  Vec3,
  VehicleKind,
  VehiclePart,
} from "./types";

const id = () => crypto.randomUUID();
const clone = <T,>(value: T): T => structuredClone(value);
const isSwitchableRail = (type: RailType) =>
  type === "switch" || type === "turnoutLeft" || type === "turnoutRight";

const engineColors: Record<string, string> = {
  blue: "#2785f7",
  red: "#ef5350",
  yellow: "#ffbf34",
};

function newPart(kind: VehicleKind, variant?: string): VehiclePart {
  if (kind === "engine") {
    const colorName = variant ?? "blue";
    return {
      id: id(),
      kind,
      color: engineColors[colorName] ?? engineColors.blue,
      label: `${colorName[0].toUpperCase()}${colorName.slice(1)} engine`,
    };
  }
  if (kind === "passenger") {
    return { id: id(), kind, color: "#4b9df8", label: "Passenger coach" };
  }
  if (kind === "cargo") {
    return { id: id(), kind, color: "#f59f38", label: "Cargo wagon" };
  }
  return { id: id(), kind, color: "#e95658", label: "Rear coach" };
}

interface EditorStore {
  rails: RailPiece[];
  trains: TrainSet[];
  builder: VehiclePart[];
  selection: Selection;
  activeRailTool: RailType | null;
  preview: PlacementPreview | null;
  past: SceneSnapshot[];
  future: SceneSnapshot[];
  dragStart: SceneSnapshot | null;
  draggingRailId: string | null;
  cameraTurn: number;
  notice: string | null;
  setNotice: (notice: string | null) => void;
  select: (selection: Selection) => void;
  chooseRailTool: (type: RailType | null) => void;
  updatePreview: (raw: Vec3) => void;
  placeRail: (type: RailType, raw: Vec3) => void;
  beginRailDrag: (railId: string) => void;
  moveRailLive: (railId: string, raw: Vec3) => void;
  endRailDrag: () => void;
  rotateSelectedRail: () => void;
  duplicateSelectedRail: () => void;
  deleteSelected: () => void;
  toggleSelectedSwitch: () => void;
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
  turnCamera: (amount: number) => void;
  addBuilderPart: (kind: VehicleKind, variant?: string) => void;
  removeBuilderPart: (partId: string) => void;
  moveBuilderPart: (partId: string, offset: number) => void;
  clearBuilder: () => void;
  addTrainFromBuilder: (raw: Vec3) => void;
  toggleSelectedTrain: () => void;
  reverseSelectedTrain: () => void;
  tickTrains: (delta: number) => void;
}

function snapshot(state: Pick<EditorStore, "rails" | "trains">): SceneSnapshot {
  return { rails: clone(state.rails), trains: clone(state.trains) };
}

function withHistory(
  state: EditorStore,
  changed: Pick<EditorStore, "rails" | "trains">,
): Partial<EditorStore> {
  return {
    ...changed,
    past: [...state.past.slice(-49), snapshot(state)],
    future: [],
  };
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  rails: [],
  trains: [],
  builder: [],
  selection: null,
  activeRailTool: null,
  preview: null,
  past: [],
  future: [],
  dragStart: null,
  draggingRailId: null,
  cameraTurn: 0,
  notice: null,

  setNotice: (notice) => set({ notice }),
  select: (selection) => set({ selection }),
  chooseRailTool: (type) => set({ activeRailTool: type, preview: null, selection: null }),

  updatePreview: (raw) => {
    const state = get();
    if (!state.activeRailTool) return;
    set({ preview: placementForRail(state.activeRailTool, raw, state.rails) });
  },

  placeRail: (type, raw) => {
    const state = get();
    const placement = placementForRail(type, raw, state.rails);
    const rail: RailPiece = {
      id: id(),
      type,
      position: placement.position,
      rotation: placement.rotation,
      activeBranch: 1,
      supportHeight: placement.supportHeight,
    };
    set({
      ...withHistory(state, { rails: [...state.rails, rail], trains: state.trains }),
      selection: { kind: "rail", id: rail.id },
      preview: placementForRail(type, raw, [...state.rails, rail]),
    });
  },

  beginRailDrag: (railId) => {
    const state = get();
    set({
      selection: { kind: "rail", id: railId },
      dragStart: snapshot(state),
      draggingRailId: railId,
    });
  },

  moveRailLive: (railId, raw) => {
    const state = get();
    if (state.draggingRailId !== railId) return;
    const rail = state.rails.find((item) => item.id === railId);
    if (!rail) return;
    const placement = placementForRail(
      rail.type,
      raw,
      state.rails,
      rail.rotation,
      rail.id,
    );
    set({
      rails: state.rails.map((item) =>
        item.id === railId
          ? {
              ...item,
              position: placement.position,
              rotation: placement.rotation,
              supportHeight: placement.supportHeight ?? item.supportHeight,
            }
          : item,
      ),
    });
  },

  endRailDrag: () => {
    const state = get();
    if (!state.dragStart) {
      set({ draggingRailId: null });
      return;
    }
    set({
      draggingRailId: null,
      dragStart: null,
      past: [...state.past.slice(-49), state.dragStart],
      future: [],
    });
  },

  rotateSelectedRail: () => {
    const state = get();
    if (state.selection?.kind !== "rail") return;
    set(
      withHistory(state, {
        rails: state.rails.map((rail) =>
          rail.id === state.selection?.id
            ? { ...rail, rotation: rail.rotation + CURVE_ANGLE }
            : rail,
        ),
        trains: state.trains,
      }),
    );
  },

  duplicateSelectedRail: () => {
    const state = get();
    if (state.selection?.kind !== "rail") return;
    const selected = state.rails.find((rail) => rail.id === state.selection?.id);
    if (!selected) return;
    const duplicate: RailPiece = {
      ...selected,
      id: id(),
      position: [selected.position[0] + 1, selected.position[1], selected.position[2] + 1],
    };
    set({
      ...withHistory(state, { rails: [...state.rails, duplicate], trains: state.trains }),
      selection: { kind: "rail", id: duplicate.id },
    });
  },

  deleteSelected: () => {
    const state = get();
    if (!state.selection) return;
    if (state.selection.kind === "rail") {
      const railId = state.selection.id;
      set({
        ...withHistory(state, {
          rails: state.rails.filter((rail) => rail.id !== railId),
          trains: state.trains.filter((train) => train.railId !== railId),
        }),
        selection: null,
      });
      return;
    }
    const trainId = state.selection.id;
    set({
      ...withHistory(state, {
        rails: state.rails,
        trains: state.trains.filter((train) => train.id !== trainId),
      }),
      selection: null,
    });
  },

  toggleSelectedSwitch: () => {
    const state = get();
    if (state.selection?.kind !== "rail") return;
    set(
      withHistory(state, {
        rails: state.rails.map((rail) =>
          rail.id === state.selection?.id && isSwitchableRail(rail.type)
            ? { ...rail, activeBranch: rail.activeBranch === 1 ? 2 : 1 }
            : rail,
        ),
        trains: state.trains,
      }),
    );
  },

  clearAll: () => {
    const state = get();
    if (state.rails.length === 0 && state.trains.length === 0) return;
    set({
      ...withHistory(state, { rails: [], trains: [] }),
      selection: null,
      preview: null,
    });
  },

  undo: () => {
    const state = get();
    const previous = state.past.at(-1);
    if (!previous) return;
    set({
      rails: clone(previous.rails),
      trains: clone(previous.trains),
      past: state.past.slice(0, -1),
      future: [snapshot(state), ...state.future.slice(0, 49)],
      selection: null,
    });
  },

  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    set({
      rails: clone(next.rails),
      trains: clone(next.trains),
      past: [...state.past.slice(-49), snapshot(state)],
      future: state.future.slice(1),
      selection: null,
    });
  },

  turnCamera: (amount) => set((state) => ({ cameraTurn: state.cameraTurn + amount })),

  addBuilderPart: (kind, variant) => {
    const state = get();
    if (kind === "engine") {
      const trailing = state.builder.filter((part) => part.kind !== "engine");
      set({ builder: [newPart(kind, variant), ...trailing] });
      return;
    }
    const trailingCount = state.builder.filter((part) => part.kind !== "engine").length;
    if (trailingCount >= 5) {
      set({ notice: "A train can carry up to five coaches." });
      return;
    }
    set({ builder: [...state.builder, newPart(kind, variant)] });
  },

  removeBuilderPart: (partId) =>
    set((state) => ({ builder: state.builder.filter((part) => part.id !== partId) })),

  moveBuilderPart: (partId, offset) =>
    set((state) => {
      const builder = [...state.builder];
      const index = builder.findIndex((part) => part.id === partId);
      if (index <= 0 && offset < 0) return {};
      const next = Math.max(0, Math.min(builder.length - 1, index + offset));
      if (builder[index]?.kind === "engine" || builder[next]?.kind === "engine") return {};
      [builder[index], builder[next]] = [builder[next], builder[index]];
      return { builder };
    }),

  clearBuilder: () => set({ builder: [] }),

  addTrainFromBuilder: (raw) => {
    const state = get();
    if (state.trains.length >= 8) {
      set({ notice: "The railway already has eight trains running." });
      return;
    }
    if (state.builder[0]?.kind !== "engine") {
      set({ notice: "Choose an engine before placing your train." });
      return;
    }
    const placement = closestRailPlacement(state.rails, raw);
    if (!placement) {
      set({ notice: "Drop the train closer to a rail." });
      return;
    }
    const train: TrainSet = {
      id: id(),
      cars: clone(state.builder),
      railId: placement.rail.id,
      route: placement.route,
      progress: placement.progress,
      running: false,
      trail: [],
    };
    set({
      ...withHistory(state, { rails: state.rails, trains: [...state.trains, train] }),
      builder: [],
      selection: { kind: "train", id: train.id },
      notice: "Train ready. Press Go when you want to run it.",
    });
  },

  toggleSelectedTrain: () =>
    set((state) => ({
      trains: state.trains.map((train) =>
        state.selection?.kind === "train" && train.id === state.selection.id
          ? { ...train, running: !train.running }
          : train,
      ),
    })),

  reverseSelectedTrain: () =>
    set((state) => ({
      trains: state.trains.map((train) =>
        state.selection?.kind === "train" && train.id === state.selection.id
          ? {
              ...train,
              route: [train.route[1], train.route[0]],
              progress: 1 - train.progress,
              trail: [],
            }
          : train,
      ),
    })),

  tickTrains: (delta) => {
    const state = get();
    if (!state.trains.some((train) => train.running)) return;
    const trains = state.trains.map((train) => {
      if (!train.running) return train;
      const currentRail = state.rails.find((rail) => rail.id === train.railId);
      if (!currentRail) return { ...train, running: false };

      let rail = currentRail;
      let route = train.route;
      let progress = train.progress + (TRAIN_SPEED * delta) / routeLength(rail, route);
      let running: boolean = train.running;

      while (progress >= 1 && running) {
        const overshoot = (progress - 1) * routeLength(rail, route);
        const connection = findConnection(state.rails, rail.id, route[1]);
        if (!connection) {
          progress = 1;
          running = false;
          break;
        }
        const nextRoute = routeForEntry(connection.rail, connection.endpointIndex);
        if (!nextRoute) {
          progress = 1;
          running = false;
          break;
        }
        rail = connection.rail;
        route = nextRoute;
        progress = overshoot / routeLength(rail, route);
      }

      const updated: TrainSet = {
        ...train,
        railId: rail.id,
        route,
        progress,
        running,
      };
      const pose = poseForTrain(updated, state.rails);
      if (!pose) return updated;
      const latest = train.trail[0]?.position;
      const moved =
        !latest ||
        Math.hypot(
          latest[0] - pose.position[0],
          latest[1] - pose.position[1],
          latest[2] - pose.position[2],
        ) > 0.08;
      return moved
        ? {
            ...updated,
            trail: [{ position: pointOnRoute(rail, route, progress) }, ...train.trail].slice(0, 320),
          }
        : updated;
    });
    set({ trains });
  },
}));
