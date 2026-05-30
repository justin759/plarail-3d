import { Html, MapControls, Sky } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  pointOnRoute,
  poseForTrain,
  railRoutes,
} from "../railMath";
import { useEditorStore } from "../store";
import type {
  PlacementPreview,
  RailPiece,
  TrailPoint,
  TrainSet,
  Vec3,
  VehiclePart,
} from "../types";

export type DropProjector = (clientX: number, clientY: number) => Vec3 | null;

interface RailSceneProps {
  registerProjector: (projector: DropProjector | null) => void;
}

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function Projector({ registerProjector }: RailSceneProps) {
  const { camera, gl } = useThree();

  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    registerProjector((clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
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
      enableRotate={false}
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
  width = 0.22,
  height = 0.15,
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
      position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.13, (a[2] + b[2]) / 2]}
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
      position={[point[0], point[1] + 0.08, point[2]]}
      rotation={[0, -Math.atan2(tangent[2], tangent[0]), 0]}
    >
      <boxGeometry args={[0.32, 0.12, 1.94]} />
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
    () => Array.from({ length: 15 }, (_, index) => pointOnRoute(piece, route, index / 14)),
    [piece, route],
  );

  return (
    <>
      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const delta = new THREE.Vector3(next[0] - point[0], 0, next[2] - point[2]).normalize();
        const normal = new THREE.Vector3(-delta.z, 0, delta.x);
        const offset = normal.multiplyScalar(0.68);
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
  const height = piece.supportHeight ?? 2.4;
  return (
    <group position={piece.position}>
      <mesh castShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[0.72, height, 0.72]} />
        <meshStandardMaterial color={color} opacity={opacity} transparent={opacity < 1} />
      </mesh>
      <mesh castShadow position={[0, height + 0.04, 0]}>
        <boxGeometry args={[1.9, 0.18, 1.25]} />
        <meshStandardMaterial color={color} opacity={opacity} transparent={opacity < 1} />
      </mesh>
      <mesh castShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[1.2, 0.2, 1.2]} />
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
  if (piece.type === "support") {
    return <SupportModel color={ghost ? "#f9d980" : selected ? "#ffd14c" : "#f2b642"} opacity={opacity} piece={piece} />;
  }

  return (
    <>
      {railRoutes(piece).map((route) => (
        <RailStrip color={color} key={route.join("-")} opacity={opacity} piece={piece} route={route} />
      ))}
      {piece.type === "switch" && (
        <group position={[piece.position[0] + 0.1, piece.position[1] + 0.34, piece.position[2]]}>
          <mesh castShadow rotation={[0, piece.activeBranch === 1 ? -0.55 : 0.55, 0]}>
            <boxGeometry args={[1.15, 0.14, 0.2]} />
            <meshStandardMaterial color="#f6c445" />
          </mesh>
          <mesh castShadow position={[-0.52, 0.08, 0]}>
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

  return (
    <Html center distanceFactor={15} position={[rail.position[0], rail.position[1] + 2.35, rail.position[2]]}>
      <div className="world-controls" onPointerDown={(event) => event.stopPropagation()}>
        {rail.type !== "support" && (
          <button onClick={rotate} title="Rotate rail" type="button">
            Rotate
          </button>
        )}
        {rail.type === "switch" && (
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

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (event.buttons !== 1) return;
    const point = event.ray.intersectPlane(groundPlane, new THREE.Vector3());
    if (point) moveRailLive(rail.id, [point.x, 0, point.z]);
  };

  return (
    <group
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.stopPropagation();
        beginRailDrag(rail.id);
        (event.target as Element).setPointerCapture(event.pointerId);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        event.stopPropagation();
        (event.target as Element).releasePointerCapture(event.pointerId);
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

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <mesh castShadow position={[x, 0.17, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.24, 0.24, 0.14, 16]} />
      <meshStandardMaterial color="#293a4b" />
    </mesh>
  );
}

function VehicleModel({
  part,
  position,
  tangent,
  onSelect,
}: {
  part: VehiclePart;
  position: Vec3;
  tangent: Vec3;
  onSelect: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const yaw = -Math.atan2(tangent[2], tangent[0]);
  return (
    <group onClick={onSelect} position={[position[0], position[1] + 0.28, position[2]]} rotation={[0, yaw, 0]}>
      <mesh castShadow position={[0, 0.28, 0]}>
        <boxGeometry args={[1.72, 0.28, 1]} />
        <meshStandardMaterial color="#283e58" />
      </mesh>
      {part.kind === "engine" && (
        <>
          <mesh castShadow position={[-0.28, 0.75, 0]}>
            <boxGeometry args={[1.04, 0.78, 0.9]} />
            <meshStandardMaterial color={part.color} />
          </mesh>
          <mesh castShadow position={[0.62, 0.6, 0]}>
            <boxGeometry args={[0.65, 0.48, 0.82]} />
            <meshStandardMaterial color={part.color} />
          </mesh>
          <mesh castShadow position={[0.62, 0.98, 0]}>
            <cylinderGeometry args={[0.15, 0.2, 0.46, 16]} />
            <meshStandardMaterial color="#f1c34a" />
          </mesh>
          <mesh position={[-0.72, 0.82, -0.46]}>
            <boxGeometry args={[0.35, 0.28, 0.03]} />
            <meshStandardMaterial color="#bce9ff" />
          </mesh>
        </>
      )}
      {part.kind === "passenger" && (
        <>
          <mesh castShadow position={[0, 0.7, 0]}>
            <boxGeometry args={[1.56, 0.72, 0.9]} />
            <meshStandardMaterial color={part.color} />
          </mesh>
          {[-0.48, 0, 0.48].map((x) => (
            <mesh key={x} position={[x, 0.76, -0.46]}>
              <boxGeometry args={[0.27, 0.3, 0.025]} />
              <meshStandardMaterial color="#d8f4ff" />
            </mesh>
          ))}
        </>
      )}
      {part.kind === "cargo" && (
        <>
          <mesh castShadow position={[0, 0.56, 0]}>
            <boxGeometry args={[1.52, 0.42, 0.94]} />
            <meshStandardMaterial color={part.color} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <boxGeometry args={[1.32, 0.24, 0.72]} />
            <meshStandardMaterial color="#ba6d35" />
          </mesh>
        </>
      )}
      {part.kind === "rear" && (
        <>
          <mesh castShadow position={[0, 0.68, 0]}>
            <boxGeometry args={[1.52, 0.68, 0.9]} />
            <meshStandardMaterial color={part.color} />
          </mesh>
          <mesh position={[-0.77, 0.7, 0]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial color="#ffe05c" emissive="#f29632" emissiveIntensity={0.7} />
          </mesh>
        </>
      )}
      <Wheel x={-0.52} z={-0.53} />
      <Wheel x={0.52} z={-0.53} />
      <Wheel x={-0.52} z={0.53} />
      <Wheel x={0.52} z={0.53} />
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
        const vehiclePose =
          index === 0 ? pose : sampleTrail(train.trail, index * 1.72, pose.position, pose.tangent);
        return (
          <VehicleModel
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
  const activeTool = useEditorStore((state) => state.activeRailTool);
  const preview = useEditorStore((state) => state.preview);
  const updatePreview = useEditorStore((state) => state.updatePreview);
  const placeRail = useEditorStore((state) => state.placeRail);
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
          else select(null);
        }}
        onPointerMove={(event) => {
          if (activeTool) updatePreview([event.point.x, 0, event.point.z]);
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
      {trains.map((train) => (
        <TrainActor key={train.id} train={train} />
      ))}
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
