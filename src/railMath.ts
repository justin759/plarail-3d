import * as THREE from "three";
import type {
  PlacementPreview,
  RailEndpoint,
  RailPiece,
  RailType,
  TrainSet,
  Vec3,
} from "./types";

export const RAIL_LENGTH = 4;
export const CURVE_RADIUS = 4;
export const LEVEL_HEIGHT = 2.4;
export const SNAP_DISTANCE = 2.35;
export const TRAIN_SPEED = 2.65;

const CONNECTION_TOLERANCE = 0.24;

const vec = (value: Vec3) => new THREE.Vector3(...value);
const tuple = (value: THREE.Vector3): Vec3 => [value.x, value.y, value.z];

function rotateLocal(local: Vec3, rotation: number): Vec3 {
  const point = vec(local).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
  return tuple(point);
}

function toWorld(piece: Pick<RailPiece, "position" | "rotation">, local: Vec3): Vec3 {
  const rotated = rotateLocal(local, piece.rotation);
  return [
    rotated[0] + piece.position[0],
    rotated[1] + piece.position[1],
    rotated[2] + piece.position[2],
  ];
}

export function localEndpoints(type: RailType): RailEndpoint[] {
  switch (type) {
    case "straight":
      return [
        { position: [-2, 0, 0], direction: [-1, 0, 0] },
        { position: [2, 0, 0], direction: [1, 0, 0] },
      ];
    case "curve":
      return [
        { position: [0, 0, 0], direction: [-1, 0, 0] },
        { position: [4, 0, 4], direction: [0, 0, 1] },
      ];
    case "switch":
      return [
        { position: [-2, 0, 0], direction: [-1, 0, 0] },
        { position: [2, 0, -2], direction: [0.6, 0, -0.8] },
        { position: [2, 0, 2], direction: [0.6, 0, 0.8] },
      ];
    case "crossing":
      return [
        { position: [-2, 0, 0], direction: [-1, 0, 0] },
        { position: [2, 0, 0], direction: [1, 0, 0] },
        { position: [0, 0, -2], direction: [0, 0, -1] },
        { position: [0, 0, 2], direction: [0, 0, 1] },
      ];
    case "slope":
      return [
        { position: [-2, 0, 0], direction: [-1, 0, 0] },
        { position: [2, LEVEL_HEIGHT, 0], direction: [1, 0, 0] },
      ];
    case "support":
      return [];
  }
}

export function railEndpoints(piece: RailPiece): RailEndpoint[] {
  return localEndpoints(piece.type).map((endpoint) => ({
    position: toWorld(piece, endpoint.position),
    direction: rotateLocal(endpoint.direction, piece.rotation),
  }));
}

export function railRoutes(piece: RailPiece): [number, number][] {
  switch (piece.type) {
    case "straight":
    case "curve":
    case "slope":
      return [[0, 1]];
    case "switch":
      return [
        [0, 1],
        [0, 2],
      ];
    case "crossing":
      return [
        [0, 1],
        [2, 3],
      ];
    case "support":
      return [];
  }
}

export function routeForEntry(piece: RailPiece, entry: number): [number, number] | null {
  switch (piece.type) {
    case "straight":
    case "curve":
    case "slope":
      return entry === 0 ? [0, 1] : [1, 0];
    case "switch":
      if (entry === 0) {
        return [0, piece.activeBranch];
      }
      return entry === 1 || entry === 2 ? [entry, 0] : null;
    case "crossing":
      if (entry === 0) return [0, 1];
      if (entry === 1) return [1, 0];
      if (entry === 2) return [2, 3];
      return entry === 3 ? [3, 2] : null;
    case "support":
      return null;
  }
}

function quadratic(a: number, b: number, c: number, t: number) {
  return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
}

function canonicalLocalPoint(type: RailType, canonicalRoute: [number, number], t: number): Vec3 {
  switch (type) {
    case "straight":
      return [-2 + t * 4, 0, 0];
    case "slope":
      return [-2 + t * 4, t * LEVEL_HEIGHT, 0];
    case "curve": {
      const angle = -Math.PI / 2 + t * (Math.PI / 2);
      return [
        CURVE_RADIUS * Math.cos(angle),
        0,
        CURVE_RADIUS + CURVE_RADIUS * Math.sin(angle),
      ];
    }
    case "switch": {
      const branch = canonicalRoute[1] === 1 ? -2 : 2;
      return [
        quadratic(-2, 0.7, 2, t),
        0,
        quadratic(0, 0, branch, t),
      ];
    }
    case "crossing":
      return canonicalRoute[0] === 0 ? [-2 + t * 4, 0, 0] : [0, 0, -2 + t * 4];
    case "support":
      return [0, 0, 0];
  }
}

function canonicalRoute(type: RailType, route: [number, number]): {
  pair: [number, number];
  reversed: boolean;
} {
  if (type === "switch") {
    const branch = route[0] === 0 ? route[1] : route[0];
    return { pair: [0, branch], reversed: route[0] !== 0 };
  }
  if (type === "crossing") {
    if (route.includes(0)) return { pair: [0, 1], reversed: route[0] !== 0 };
    return { pair: [2, 3], reversed: route[0] !== 2 };
  }
  return { pair: [0, 1], reversed: route[0] !== 0 };
}

export function pointOnRoute(piece: RailPiece, route: [number, number], progress: number): Vec3 {
  const canonical = canonicalRoute(piece.type, route);
  const t = canonical.reversed ? 1 - progress : progress;
  return toWorld(piece, canonicalLocalPoint(piece.type, canonical.pair, t));
}

export function tangentOnRoute(piece: RailPiece, route: [number, number], progress: number): Vec3 {
  const before = pointOnRoute(piece, route, Math.max(0, progress - 0.01));
  const after = pointOnRoute(piece, route, Math.min(1, progress + 0.01));
  const direction = vec(after).sub(vec(before)).normalize();
  return tuple(direction);
}

export function routeLength(piece: RailPiece, route: [number, number]): number {
  let total = 0;
  let previous = pointOnRoute(piece, route, 0);
  for (let index = 1; index <= 20; index += 1) {
    const next = pointOnRoute(piece, route, index / 20);
    total += vec(next).distanceTo(vec(previous));
    previous = next;
  }
  return total;
}

export function findConnection(
  rails: RailPiece[],
  railId: string,
  endpointIndex: number,
): { rail: RailPiece; endpointIndex: number } | null {
  const source = rails.find((rail) => rail.id === railId);
  if (!source) return null;
  const sourcePoint = railEndpoints(source)[endpointIndex];
  if (!sourcePoint) return null;

  let closest: { rail: RailPiece; endpointIndex: number; distance: number } | null = null;
  for (const rail of rails) {
    if (rail.id === railId || rail.type === "support") continue;
    for (const [index, endpoint] of railEndpoints(rail).entries()) {
      const distance = vec(sourcePoint.position).distanceTo(vec(endpoint.position));
      if (distance <= CONNECTION_TOLERANCE && (!closest || distance < closest.distance)) {
        closest = { rail, endpointIndex: index, distance };
      }
    }
  }
  return closest ? { rail: closest.rail, endpointIndex: closest.endpointIndex } : null;
}

function overheadSupportHeight(raw: Vec3, rails: RailPiece[]) {
  let best: { distance: number; height: number } | null = null;
  for (const rail of rails) {
    if (rail.type === "support") continue;
    for (const route of railRoutes(rail)) {
      for (let index = 0; index <= 12; index += 1) {
        const point = pointOnRoute(rail, route, index / 12);
        const distance = Math.hypot(raw[0] - point[0], raw[2] - point[2]);
        if (point[1] > 0.3 && distance < 1.2 && (!best || distance < best.distance)) {
          best = { distance, height: point[1] };
        }
      }
    }
  }
  return Math.max(LEVEL_HEIGHT, best?.height ?? LEVEL_HEIGHT);
}

export function placementForRail(
  type: RailType,
  raw: Vec3,
  rails: RailPiece[],
  preferredRotation = 0,
  ignoredRailId?: string,
): PlacementPreview {
  if (type === "support") {
    return {
      type,
      position: [Math.round(raw[0]), 0, Math.round(raw[2])],
      rotation: 0,
      supportHeight: overheadSupportHeight(raw, rails),
    };
  }

  const candidates = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map(
    (offset) => preferredRotation + offset,
  );
  let best: PlacementPreview & { distance: number } | null = null;

  for (const rotation of candidates) {
    for (const ownEndpoint of localEndpoints(type)) {
      const rotatedOwn = rotateLocal(ownEndpoint.position, rotation);
      for (const rail of rails) {
        if (rail.id === ignoredRailId || rail.type === "support") continue;
        for (const endpoint of railEndpoints(rail)) {
          const position: Vec3 = [
            endpoint.position[0] - rotatedOwn[0],
            endpoint.position[1] - rotatedOwn[1],
            endpoint.position[2] - rotatedOwn[2],
          ];
          const distance = Math.hypot(raw[0] - position[0], raw[2] - position[2]);
          if (distance <= SNAP_DISTANCE && (!best || distance < best.distance)) {
            best = { type, position, rotation, distance };
          }
        }
      }
    }
  }

  return (
    best ?? {
      type,
      position: [Math.round(raw[0]), 0, Math.round(raw[2])],
      rotation: preferredRotation,
    }
  );
}

export function closestRailPlacement(
  rails: RailPiece[],
  raw: Vec3,
): { rail: RailPiece; route: [number, number]; progress: number; distance: number } | null {
  let best: {
    rail: RailPiece;
    route: [number, number];
    progress: number;
    distance: number;
  } | null = null;

  for (const rail of rails) {
    for (const route of railRoutes(rail)) {
      for (let index = 0; index <= 24; index += 1) {
        const progress = index / 24;
        const point = pointOnRoute(rail, route, progress);
        const distance = Math.hypot(raw[0] - point[0], raw[2] - point[2]);
        if ((!best || distance < best.distance) && Math.abs(raw[1] - point[1]) < 3.2) {
          best = { rail, route, progress, distance };
        }
      }
    }
  }

  return best && best.distance < 2.2 ? best : null;
}

export function poseForTrain(train: TrainSet, rails: RailPiece[]) {
  const rail = rails.find((item) => item.id === train.railId);
  if (!rail) return null;
  return {
    position: pointOnRoute(rail, train.route, train.progress),
    tangent: tangentOnRoute(rail, train.route, train.progress),
  };
}
