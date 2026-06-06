import { Html, MapControls, Sky } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import {
  CURVE_ANGLE,
  mmToWorld,
  pointOnRoute,
  poseForTrain,
  RIDGE_CENTER_OFFSET,
  RIDGE_HEIGHT,
  RIDGE_WIDTH,
  railRoutes,
  routeLength,
  TRACK_BASE_HEIGHT,
  TRACK_WIDTH,
  LEVEL_HEIGHT,
  VEHICLE_HEIGHT,
  VEHICLE_WIDTH,
} from "../railMath";
import { useEditorStore } from "../store";
import { getTrainCatalogItem } from "../trainCatalog";
import type {
  PlacementPreview,
  RailPiece,
  TrailPoint,
  TrainPlacementPreview,
  TrainSet,
  Vec3,
  VehiclePart,
} from "../types";

export type DropProjector = (clientX: number, clientY: number) => Vec3 | null;

interface RailSceneProps {
  registerProjector: (projector: DropProjector | null) => void;
}

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const TRAIN_MODEL_LENGTH = mmToWorld(150);
const TRAIN_MODEL_WIDTH = VEHICLE_WIDTH;
const TRAIN_MODEL_HEIGHT = VEHICLE_HEIGHT * 1.05;
const TRAIN_LINK_GAP = mmToWorld(6);
const TRAIN_MODEL_CLEARANCE = mmToWorld(1.5);

function Projector({ registerProjector }: RailSceneProps) {
  const { camera, gl } = useThree();

  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    registerProjector((clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      const insetX = Math.min(48, rect.width / 2);
      const insetY = Math.min(48, rect.height / 2);
      const clampedX =
        clientX >= rect.left && clientX <= rect.right
          ? clientX
          : THREE.MathUtils.clamp(clientX, rect.left + insetX, rect.right - insetX);
      const clampedY =
        clientY >= rect.top && clientY <= rect.bottom
          ? clientY
          : THREE.MathUtils.clamp(clientY, rect.top + insetY, rect.bottom - insetY);
      const pointer = new THREE.Vector2(
        ((clampedX - rect.left) / rect.width) * 2 - 1,
        -((clampedY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const world = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
      return world ? [world.x, 0, world.z] : null;
    });
    return () => registerProjector(null);
  }, [camera, gl, registerProjector]);

  return null;
}

function CameraRig() {
  const controls = useRef<any>(null);
  const turn = useEditorStore((state) => state.cameraTurn);
  const placementActive = useEditorStore(
    (state) => Boolean(state.activeRailTool || state.trainPlacementActive),
  );
  const previousTurn = useRef(turn);

  useEffect(() => {
    if (!controls.current) return;
    const delta = turn - previousTurn.current;
    previousTurn.current = turn;
    if (Math.abs(delta) < 0.001) return;
    const target = controls.current.target as THREE.Vector3;
    const offset = controls.current.object.position.clone().sub(target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta);
    controls.current.object.position.copy(target.clone().add(offset));
    controls.current.update();
  }, [turn]);

  return (
    <MapControls
      enableRotate={!placementActive}
      maxDistance={68}
      maxPolarAngle={Math.PI / 2.15}
      minDistance={8}
      minPolarAngle={Math.PI / 5}
      ref={controls}
      screenSpacePanning={false}
    />
  );
}

function Beam({
  a,
  b,
  color,
  opacity,
  width = RIDGE_WIDTH,
  height = RIDGE_HEIGHT,
}: {
  a: Vec3;
  b: Vec3;
  color: string;
  opacity: number;
  width?: number;
  height?: number;
}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);
  const horizontal = Math.hypot(dx, dz);
  const yaw = -Math.atan2(dz, dx);
  const pitch = Math.atan2(dy, horizontal);
  return (
    <mesh
      castShadow
      position={[
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2 + TRACK_BASE_HEIGHT + RIDGE_HEIGHT / 2,
        (a[2] + b[2]) / 2,
      ]}
      rotation={[0, yaw, pitch]}
    >
      <boxGeometry args={[length + 0.04, height, width]} />
      <meshStandardMaterial color={color} opacity={opacity} transparent={opacity < 1} />
    </mesh>
  );
}

function Sleeper({
  point,
  tangent,
  color,
  opacity,
}: {
  point: Vec3;
  tangent: Vec3;
  color: string;
  opacity: number;
}) {
  return (
    <mesh
      castShadow
      position={[point[0], point[1] + TRACK_BASE_HEIGHT / 2, point[2]]}
      rotation={[0, -Math.atan2(tangent[2], tangent[0]), 0]}
    >
      <boxGeometry args={[mmToWorld(12), TRACK_BASE_HEIGHT, TRACK_WIDTH]} />
      <meshStandardMaterial color={color} opacity={opacity} transparent={opacity < 1} />
    </mesh>
  );
}

function RailStrip({
  piece,
  route,
  color,
  opacity,
}: {
  piece: RailPiece;
  route: [number, number];
  color: string;
  opacity: number;
}) {
  const points = useMemo(
    () => {
      const segments = Math.max(5, Math.ceil(routeLength(piece, route) / mmToWorld(16)));
      return Array.from({ length: segments + 1 }, (_, index) =>
        pointOnRoute(piece, route, index / segments),
      );
    },
    [piece, route],
  );

  return (
    <>
      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const delta = new THREE.Vector3(next[0] - point[0], 0, next[2] - point[2]).normalize();
        const normal = new THREE.Vector3(-delta.z, 0, delta.x);
        const offset = normal.multiplyScalar(RIDGE_CENTER_OFFSET);
        const aLeft: Vec3 = [point[0] + offset.x, point[1], point[2] + offset.z];
        const bLeft: Vec3 = [next[0] + offset.x, next[1], next[2] + offset.z];
        const aRight: Vec3 = [point[0] - offset.x, point[1], point[2] - offset.z];
        const bRight: Vec3 = [next[0] - offset.x, next[1], next[2] - offset.z];
        return (
          <group key={`${route.join("-")}-${index}`}>
            <Beam a={aLeft} b={bLeft} color={color} opacity={opacity} />
            <Beam a={aRight} b={bRight} color={color} opacity={opacity} />
            {index % 2 === 0 && (
              <Sleeper
                color={color}
                opacity={opacity}
                point={point}
                tangent={[delta.x, 0, delta.z]}
              />
            )}
          </group>
        );
      })}
    </>
  );
}

function SupportModel({ piece, color, opacity }: { piece: RailPiece; color: string; opacity: number }) {
  const height = piece.supportHeight ?? LEVEL_HEIGHT;
  return (
    <group position={piece.position}>
      <mesh castShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[mmToWorld(30), height, mmToWorld(30)]} />
        <meshStandardMaterial color={color} opacity={opacity} transparent={opacity < 1} />
      </mesh>
      <mesh castShadow position={[0, height + 0.04, 0]}>
        <boxGeometry args={[mmToWorld(56), mmToWorld(6), mmToWorld(40)]} />
        <meshStandardMaterial color={color} opacity={opacity} transparent={opacity < 1} />
      </mesh>
      <mesh castShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[mmToWorld(48), mmToWorld(6), mmToWorld(48)]} />
        <meshStandardMaterial color={color} opacity={opacity} transparent={opacity < 1} />
      </mesh>
    </group>
  );
}

function RailModel({
  piece,
  selected = false,
  ghost = false,
}: {
  piece: RailPiece;
  selected?: boolean;
  ghost?: boolean;
}) {
  const color = ghost ? "#73cdfb" : selected ? "#ffd14c" : "#1677e8";
  const opacity = ghost ? 0.58 : 1;
  const switchable =
    piece.type === "switch" || piece.type === "turnoutLeft" || piece.type === "turnoutRight";
  const leverRotation =
    piece.type === "turnoutLeft"
      ? piece.activeBranch === 1
        ? 0
        : CURVE_ANGLE / 2
      : piece.type === "turnoutRight"
        ? piece.activeBranch === 1
          ? 0
          : -CURVE_ANGLE / 2
        : piece.activeBranch === 1
          ? 0.55
          : -0.55;
  if (piece.type === "support") {
    return <SupportModel color={ghost ? "#f9d980" : selected ? "#ffd14c" : "#f2b642"} opacity={opacity} piece={piece} />;
  }

  return (
    <>
      {railRoutes(piece).map((route) => (
        <RailStrip color={color} key={route.join("-")} opacity={opacity} piece={piece} route={route} />
      ))}
      {switchable && (
        <group position={piece.position} rotation={[0, piece.rotation, 0]}>
          <group position={[-0.42, 0.34, 0]}>
            <group rotation={[0, leverRotation, 0]}>
              <mesh castShadow position={[0.57, 0, 0]}>
                <boxGeometry args={[1.15, 0.14, 0.2]} />
                <meshStandardMaterial color="#f6c445" />
              </mesh>
            </group>
          </group>
          <mesh castShadow position={[-0.42, 0.42, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.16, 16]} />
            <meshStandardMaterial color="#e44b4b" />
          </mesh>
        </group>
      )}
    </>
  );
}

function RailControls({ rail }: { rail: RailPiece }) {
  const rotate = useEditorStore((state) => state.rotateSelectedRail);
  const duplicate = useEditorStore((state) => state.duplicateSelectedRail);
  const remove = useEditorStore((state) => state.deleteSelected);
  const toggleSwitch = useEditorStore((state) => state.toggleSelectedSwitch);
  const switchable =
    rail.type === "switch" || rail.type === "turnoutLeft" || rail.type === "turnoutRight";

  return (
    <Html center distanceFactor={15} position={[rail.position[0], rail.position[1] + 2.35, rail.position[2]]}>
      <div className="world-controls" onPointerDown={(event) => event.stopPropagation()}>
        {rail.type !== "support" && (
          <button onClick={rotate} title="Rotate rail" type="button">
            Rotate
          </button>
        )}
        {switchable && (
          <button className="switch-button" onClick={toggleSwitch} title="Change switch route" type="button">
            Switch
          </button>
        )}
        <button onClick={duplicate} title="Copy rail" type="button">
          Copy
        </button>
        <button className="delete-button" onClick={remove} title="Delete rail" type="button">
          Delete
        </button>
      </div>
    </Html>
  );
}

function RailActor({ rail }: { rail: RailPiece }) {
  const selected = useEditorStore(
    (state) => state.selection?.kind === "rail" && state.selection.id === rail.id,
  );
  const beginRailDrag = useEditorStore((state) => state.beginRailDrag);
  const moveRailLive = useEditorStore((state) => state.moveRailLive);
  const endRailDrag = useEditorStore((state) => state.endRailDrag);
  const trainPlacementActive = useEditorStore((state) => state.trainPlacementActive);
  const addTrainFromBuilder = useEditorStore((state) => state.addTrainFromBuilder);
  const updateTrainPreview = useEditorStore((state) => state.updateTrainPreview);

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (trainPlacementActive) {
      updateTrainPreview([event.point.x, event.point.y, event.point.z]);
      return;
    }
    if (event.buttons !== 1) return;
    const point = event.ray.intersectPlane(groundPlane, new THREE.Vector3());
    if (point) moveRailLive(rail.id, [point.x, 0, point.z]);
  };

  return (
    <group
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (trainPlacementActive) {
          addTrainFromBuilder([event.point.x, event.point.y, event.point.z]);
          return;
        }
        beginRailDrag(rail.id);
        (event.target as Element).setPointerCapture(event.pointerId);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        event.stopPropagation();
        const target = event.target as Element;
        if (target.hasPointerCapture(event.pointerId)) {
          target.releasePointerCapture(event.pointerId);
        }
        endRailDrag();
      }}
    >
      <RailModel piece={rail} selected={selected} />
      {selected && <RailControls rail={rail} />}
    </group>
  );
}

function GhostRail({ preview }: { preview: PlacementPreview }) {
  const piece: RailPiece = {
    id: "ghost",
    type: preview.type,
    position: preview.position,
    rotation: preview.rotation,
    activeBranch: 1,
    supportHeight: preview.supportHeight,
  };
  return <RailModel ghost piece={piece} />;
}

function sampleTrail(
  trail: TrailPoint[],
  distance: number,
  fallbackPosition: Vec3,
  fallbackTangent: Vec3,
) {
  let travelled = 0;
  for (let index = 0; index < trail.length - 1; index += 1) {
    const current = new THREE.Vector3(...trail[index].position);
    const next = new THREE.Vector3(...trail[index + 1].position);
    const segment = current.distanceTo(next);
    if (travelled + segment >= distance) {
      const t = segment === 0 ? 0 : (distance - travelled) / segment;
      const point = current.lerp(next, t);
      const tangent = current.clone().sub(next).normalize();
      return {
        position: [point.x, point.y, point.z] as Vec3,
        tangent: [tangent.x, tangent.y, tangent.z] as Vec3,
      };
    }
    travelled += segment;
  }
  return {
    position: [
      fallbackPosition[0] - fallbackTangent[0] * distance,
      fallbackPosition[1] - fallbackTangent[1] * distance,
      fallbackPosition[2] - fallbackTangent[2] * distance,
    ] as Vec3,
    tangent: fallbackTangent,
  };
}

function VehicleModel({
  part,
  position,
  tangent,
  facesBackward,
  ghost = false,
  onSelect,
}: {
  part: VehiclePart;
  position: Vec3;
  tangent: Vec3;
  facesBackward: boolean;
  ghost?: boolean;
  onSelect: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const asset = getTrainCatalogItem(part.catalogId);
  const yaw = -Math.atan2(tangent[2], tangent[0]);
  const pitch = Math.atan2(tangent[1], Math.hypot(tangent[0], tangent[2]));
  if (!asset) return null;

  const sourceObject = useLoader(OBJLoader, asset.objUrl);
  const texture = useLoader(THREE.TextureLoader, asset.textureUrl);
  const prepared = useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    const object = sourceObject.clone(true);
    const material = new THREE.MeshStandardMaterial({
      color: ghost ? "#bfefff" : "#ffffff",
      map: texture,
      metalness: 0.03,
      opacity: ghost ? 0.48 : 1,
      roughness: 0.7,
      transparent: ghost,
      depthWrite: !ghost,
    });

    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.material = material;
      if (ghost) {
        child.raycast = () => null;
      }
    });

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale: Vec3 = [
      TRAIN_MODEL_WIDTH / Math.max(size.x, 0.001),
      TRAIN_MODEL_HEIGHT / Math.max(size.y, 0.001),
      TRAIN_MODEL_LENGTH / Math.max(size.z, 0.001),
    ];

    return {
      center,
      floorY: box.min.y,
      object,
      scale,
    };
  }, [ghost, sourceObject, texture]);

  const modelRotation = Math.PI / 2 + (facesBackward ? Math.PI : 0);

  return (
    <group
      onClick={ghost ? undefined : onSelect}
      position={[
        position[0],
        position[1] + TRACK_BASE_HEIGHT + RIDGE_HEIGHT + TRAIN_MODEL_CLEARANCE,
        position[2],
      ]}
      rotation={[0, yaw, pitch]}
    >
      <group rotation={[0, modelRotation, 0]} scale={prepared.scale}>
        <primitive
          object={prepared.object}
          position={[-prepared.center.x, -prepared.floorY, -prepared.center.z]}
        />
      </group>
    </group>
  );
}

function GhostDirectionArrow({
  position,
  snapped,
  tangent,
}: {
  position: Vec3;
  snapped: boolean;
  tangent: Vec3;
}) {
  const yaw = -Math.atan2(tangent[2], tangent[0]);
  const pitch = Math.atan2(tangent[1], Math.hypot(tangent[0], tangent[2]));
  const arrowY = position[1] + TRACK_BASE_HEIGHT + RIDGE_HEIGHT + TRAIN_MODEL_HEIGHT + mmToWorld(16);
  const color = snapped ? "#4cc9ff" : "#ffd76a";
  const emissive = snapped ? "#1598d7" : "#d89013";

  return (
    <group position={[position[0], arrowY, position[2]]} rotation={[0, yaw, pitch]}>
      <mesh position={[mmToWorld(42), 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[mmToWorld(3), mmToWorld(3), mmToWorld(72), 16]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.35} opacity={0.72} transparent />
      </mesh>
      <mesh position={[mmToWorld(84), 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[mmToWorld(12), mmToWorld(24), 24]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.42} opacity={0.78} transparent />
      </mesh>
    </group>
  );
}

function TrainPlacementGhost({
  cars,
  preview,
}: {
  cars: VehiclePart[];
  preview: TrainPlacementPreview;
}) {
  if (cars[0]?.carriageType !== "front") return null;

  return (
    <group>
      {cars.map((part, index) => {
        const carriageOffset = index * (TRAIN_MODEL_LENGTH + TRAIN_LINK_GAP);
        const vehiclePose =
          index === 0
            ? preview
            : sampleTrail([], carriageOffset, preview.position, preview.tangent);

        return (
          <VehicleModel
            facesBackward={part.carriageType === "front" && index > 0}
            ghost
            key={part.id}
            onSelect={(event) => event.stopPropagation()}
            part={part}
            position={vehiclePose.position}
            tangent={vehiclePose.tangent}
          />
        );
      })}
      <GhostDirectionArrow position={preview.position} snapped={preview.snapped} tangent={preview.tangent} />
    </group>
  );
}

function TrainControls({ train, position }: { train: TrainSet; position: Vec3 }) {
  const toggle = useEditorStore((state) => state.toggleSelectedTrain);
  const reverse = useEditorStore((state) => state.reverseSelectedTrain);
  const remove = useEditorStore((state) => state.deleteSelected);

  return (
    <Html center distanceFactor={15} position={[position[0], position[1] + 2.7, position[2]]}>
      <div className="world-controls train-world-controls" onPointerDown={(event) => event.stopPropagation()}>
        <button className={train.running ? "stop-button" : "go-button"} onClick={toggle} type="button">
          {train.running ? "Stop" : "Go"}
        </button>
        <button onClick={reverse} type="button">
          Reverse
        </button>
        <button className="delete-button" onClick={remove} type="button">
          Delete
        </button>
      </div>
    </Html>
  );
}

function TrainActor({ train }: { train: TrainSet }) {
  const rails = useEditorStore((state) => state.rails);
  const selected = useEditorStore(
    (state) => state.selection?.kind === "train" && state.selection.id === train.id,
  );
  const select = useEditorStore((state) => state.select);
  const pose = poseForTrain(train, rails);
  if (!pose) return null;

  return (
    <group>
      {train.cars.map((part, index) => {
        const carriageOffset = index * (TRAIN_MODEL_LENGTH + TRAIN_LINK_GAP);
        const vehiclePose =
          index === 0
            ? pose
            : sampleTrail(train.trail, carriageOffset, pose.position, pose.tangent);
        return (
          <VehicleModel
            facesBackward={part.carriageType === "front" && index > 0}
            key={part.id}
            onSelect={(event) => {
              event.stopPropagation();
              select({ kind: "train", id: train.id });
            }}
            part={part}
            position={vehiclePose.position}
            tangent={vehiclePose.tangent}
          />
        );
      })}
      {selected && <TrainControls position={pose.position} train={train} />}
    </group>
  );
}

function Simulation() {
  const tick = useEditorStore((state) => state.tickTrains);
  useFrame((_, delta) => tick(Math.min(delta, 0.05)));
  return null;
}

function World() {
  const rails = useEditorStore((state) => state.rails);
  const trains = useEditorStore((state) => state.trains);
  const builder = useEditorStore((state) => state.builder);
  const activeTool = useEditorStore((state) => state.activeRailTool);
  const trainPlacementActive = useEditorStore((state) => state.trainPlacementActive);
  const trainPreview = useEditorStore((state) => state.trainPreview);
  const preview = useEditorStore((state) => state.preview);
  const updatePreview = useEditorStore((state) => state.updatePreview);
  const updateTrainPreview = useEditorStore((state) => state.updateTrainPreview);
  const placeRail = useEditorStore((state) => state.placeRail);
  const addTrainFromBuilder = useEditorStore((state) => state.addTrainFromBuilder);
  const select = useEditorStore((state) => state.select);

  return (
    <>
      <ambientLight intensity={1.05} />
      <directionalLight castShadow intensity={2.1} position={[25, 34, 18]} shadow-mapSize={[2048, 2048]} />
      <Sky distance={450000} inclination={0.58} azimuth={0.2} />
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          if (activeTool) placeRail(activeTool, [event.point.x, 0, event.point.z]);
          else if (trainPlacementActive) addTrainFromBuilder([event.point.x, 0, event.point.z]);
          else select(null);
        }}
        onPointerMove={(event) => {
          if (activeTool) updatePreview([event.point.x, 0, event.point.z]);
          else if (trainPlacementActive) {
            updateTrainPreview([event.point.x, 0, event.point.z]);
          }
        }}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#74bd5d" roughness={0.96} />
      </mesh>
      <gridHelper args={[500, 250, "#79bb61", "#8bc973"]} position={[0, 0.012, 0]} />
      {rails.map((rail) => (
        <RailActor key={rail.id} rail={rail} />
      ))}
      {preview && activeTool && <GhostRail preview={preview} />}
      <Suspense fallback={null}>
        {trainPlacementActive && trainPreview && (
          <TrainPlacementGhost cars={builder} preview={trainPreview} />
        )}
        {trains.map((train) => (
          <TrainActor key={train.id} train={train} />
        ))}
      </Suspense>
      <Simulation />
      <CameraRig />
    </>
  );
}

export function RailScene({ registerProjector }: RailSceneProps) {
  return (
    <Canvas camera={{ fov: 46, position: [16, 18, 23] }} shadows>
      <Projector registerProjector={registerProjector} />
      <World />
    </Canvas>
  );
}
