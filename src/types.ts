export type Vec3 = [number, number, number];

export type RailType =
  | "straight"
  | "curve"
  | "switch"
  | "crossing"
  | "slope"
  | "support";

export type VehicleKind = "engine" | "passenger" | "cargo" | "rear";

export type EngineColor = "blue" | "red" | "yellow";

export interface VehiclePart {
  id: string;
  kind: VehicleKind;
  color: string;
  label: string;
}

export interface RailPiece {
  id: string;
  type: RailType;
  position: Vec3;
  rotation: number;
  activeBranch: 1 | 2;
  supportHeight?: number;
}

export interface TrailPoint {
  position: Vec3;
}

export interface TrainSet {
  id: string;
  cars: VehiclePart[];
  railId: string;
  route: [number, number];
  progress: number;
  running: boolean;
  trail: TrailPoint[];
}

export type Selection =
  | { kind: "rail"; id: string }
  | { kind: "train"; id: string }
  | null;

export interface RailEndpoint {
  position: Vec3;
  direction: Vec3;
}

export interface SceneSnapshot {
  rails: RailPiece[];
  trains: TrainSet[];
}

export interface PlacementPreview {
  type: RailType;
  position: Vec3;
  rotation: number;
  supportHeight?: number;
}
