"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, KeyboardControls, useGLTF, useKeyboardControls, useProgress } from "@react-three/drei";
import type { ExhibitionRoom as Room, RoomPlacement } from "./exhibition";

/** 02-spec F6 가상 전시관 — 분류별 단일 방, 키보드 1인칭 보행, 유물 실제 크기 전시.
 *  성능: 한 방만 로드 + 유물별 스포트라이트 제거(방 전체 조명) + 라벨 occlude 제거. */

const MOVE_SPEED = 4.5;
const TURN_SPEED = 1.8;
const NEAR_DIST = 5.5;
const WALL_X = 5.0; // 벽 위치(전시대 x=±4.2 바깥)
const WALL_H = 7;
const HUMAN_H = 1.7;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type MoveKey = "forward" | "back" | "strafeLeft" | "strafeRight" | "turnLeft" | "turnRight";
type TouchInput = Record<MoveKey, boolean>;

const KEY_MAP = [
  { name: "forward", keys: ["KeyW", "ArrowUp"] },
  { name: "back", keys: ["KeyS", "ArrowDown"] },
  { name: "strafeLeft", keys: ["KeyA"] },
  { name: "strafeRight", keys: ["KeyD"] },
  { name: "turnLeft", keys: ["ArrowLeft", "KeyQ"] },
  { name: "turnRight", keys: ["ArrowRight", "KeyE"] },
];

/** 유물을 실제 치수(realCm)로 스케일하고, 보기 좋게 적응형 높이의 전시대 위에 세운다. */
function Exhibit({ placement, highlighted, onPick }: { placement: RoomPlacement; highlighted: boolean; onPick: () => void }) {
  const { scene } = useGLTF(placement.glbPath);
  const [hovered, setHovered] = useState(false);

  const { obj, heightM, pedH, pedW } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const realM = placement.realCm / 100;
    const s = realM / maxDim;
    clone.position.set(-center.x, -box.min.y, -center.z); // 바닥 y=0
    const g = new THREE.Group();
    g.add(clone);
    g.scale.setScalar(s);
    const hM = size.y * s;
    const footM = Math.max(size.x, size.z) * s;
    return { obj: g, heightM: hM, pedH: clamp(1.4 - hM, 0.3, 1.1), pedW: clamp(footM * 1.4, 0.55, 1.7) };
  }, [scene, placement.realCm]);

  const active = highlighted || hovered;
  return (
    <group
      position={placement.position}
      rotation={[0, placement.rotationY, 0]}
      onClick={(e) => { e.stopPropagation(); onPick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
    >
      <mesh position={[0, pedH / 2, 0]}>
        <boxGeometry args={[pedW, pedH, pedW]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.85} />
      </mesh>
      <primitive object={obj} position={[0, pedH, 0]} />
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[pedW * 0.7, pedW * 0.9, 40]} />
          <meshBasicMaterial color="#0ea5e9" transparent opacity={0.9} />
        </mesh>
      )}
      <Html position={[0, pedH + heightM + 0.2, 0]} center distanceFactor={9}>
        <div className={`whitespace-nowrap rounded px-2 py-0.5 text-[11px] shadow transition ${active ? "bg-neutral-900 text-white" : "bg-white/90 text-neutral-700"}`}>
          {placement.title} · {placement.realCm}cm{placement.hasDim ? "" : "(추정)"}{highlighted ? " · Enter" : ""}
        </div>
      </Html>
    </group>
  );
}

/** 입장부 크기 기준물 — 반투명 사람 형상(약 1.7m)으로 실제 크기를 가늠 */
function ScaleHuman({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.72, 0]}>
        <capsuleGeometry args={[0.17, 1.0, 4, 10]} />
        <meshStandardMaterial color="#aac1e6" emissive="#6b86b8" emissiveIntensity={0.35} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 1.52, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#aac1e6" emissive="#6b86b8" emissiveIntensity={0.35} transparent opacity={0.5} />
      </mesh>
      <Html position={[0, HUMAN_H + 0.2, 0]} center distanceFactor={9}>
        <div className="whitespace-nowrap rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-neutral-700">약 170cm · 크기 비교</div>
      </Html>
    </group>
  );
}

function RoomShell({ room }: { room: Room }) {
  const { bounds } = room;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const length = bounds.maxZ - bounds.minZ + 4;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, centerZ]}>
        <planeGeometry args={[WALL_X * 2, length]} />
        <meshStandardMaterial color="#39322b" roughness={0.75} />
      </mesh>
      {/* 1m 격자 — 실제 크기 가늠 */}
      <gridHelper args={[Math.ceil(Math.max(WALL_X * 2, length)), Math.ceil(Math.max(WALL_X * 2, length)), "#5a5048", "#3a322c"]} position={[0, 0.02, centerZ]} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * WALL_X, WALL_H / 2, centerZ]} rotation={[0, (-s * Math.PI) / 2, 0]}>
          <planeGeometry args={[length, WALL_H]} />
          <meshStandardMaterial color="#16130f" roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, centerZ]}>
        <planeGeometry args={[WALL_X * 2, length]} />
        <meshStandardMaterial color="#0c0a09" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, WALL_H / 2, bounds.maxZ + 2]}>
        <planeGeometry args={[WALL_X * 2, WALL_H]} />
        <meshStandardMaterial color="#1c1917" roughness={1} />
      </mesh>
    </group>
  );
}

function Rig({ room, touch, onNearest }: { room: Room; touch: React.RefObject<TouchInput>; onNearest: (id: string | null) => void }) {
  const { camera } = useThree();
  const [, getKeys] = useKeyboardControls();
  const pos = useRef(new THREE.Vector3(...room.spawn.position));
  const yaw = useRef(room.spawn.yaw);
  const lastNearest = useRef<string | null>(null);
  const eyeY = room.spawn.position[1];

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const k = getKeys() as Record<MoveKey, boolean>;
    const t = touch.current;
    const on = (key: MoveKey) => k[key] || t[key];
    yaw.current += ((on("turnRight") ? 1 : 0) - (on("turnLeft") ? 1 : 0)) * TURN_SPEED * dt;
    const fwd = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const move = (on("forward") ? 1 : 0) - (on("back") ? 1 : 0);
    const strafe = (on("strafeRight") ? 1 : 0) - (on("strafeLeft") ? 1 : 0);
    pos.current.addScaledVector(fwd, move * MOVE_SPEED * dt);
    pos.current.addScaledVector(right, strafe * MOVE_SPEED * dt);
    const b = room.bounds;
    pos.current.x = THREE.MathUtils.clamp(pos.current.x, b.minX, b.maxX);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z, b.minZ, b.maxZ);
    camera.position.set(pos.current.x, eyeY, pos.current.z);
    camera.lookAt(pos.current.x + fwd.x, eyeY, pos.current.z + fwd.z);

    let nearestId: string | null = null;
    let best = NEAR_DIST;
    for (const p of room.placements) {
      const d = Math.hypot(p.position[0] - pos.current.x, p.position[2] - pos.current.z);
      if (d < best) { best = d; nearestId = p.artifactId; }
    }
    if (nearestId !== lastNearest.current) { lastNearest.current = nearestId; onNearest(nearestId); }
  });
  return null;
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="rounded-lg bg-black/70 px-4 py-2 text-sm text-white tabular-nums">전시실 불러오는 중… {Math.round(progress)}%</div>
    </Html>
  );
}

function TouchPad({ touch }: { touch: React.RefObject<TouchInput> }) {
  const press = (key: MoveKey, v: boolean) => {
    // eslint-disable-next-line react-hooks/immutability
    touch.current[key] = v;
  };
  const btn = "select-none touch-none flex h-12 w-12 items-center justify-center rounded-lg bg-white/85 text-lg font-bold text-neutral-800 shadow active:bg-sky-200";
  const bind = (key: MoveKey) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); press(key, true); },
    onPointerUp: () => press(key, false),
    onPointerLeave: () => press(key, false),
    onPointerCancel: () => press(key, false),
  });
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-end justify-between px-4 md:hidden">
      <div className="pointer-events-auto grid grid-cols-3 gap-1.5" aria-hidden="true">
        <span />
        <button type="button" className={btn} {...bind("forward")}>▲</button>
        <span />
        <button type="button" className={btn} {...bind("turnLeft")}>↺</button>
        <button type="button" className={btn} {...bind("back")}>▼</button>
        <button type="button" className={btn} {...bind("turnRight")}>↻</button>
      </div>
    </div>
  );
}

export default function ExhibitionRoom({ room }: { room: Room }) {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [nearest, setNearest] = useState<string | null>(null);
  const nearestRef = useRef<string | null>(null);
  const touch = useRef<TouchInput>({ forward: false, back: false, strafeLeft: false, strafeRight: false, turnLeft: false, turnRight: false });

  const nearestTitle = useMemo(() => room.placements.find((p) => p.artifactId === nearest)?.title ?? null, [room.placements, nearest]);

  useEffect(() => {
    if (!entered) return;
    const MOVE_CODES = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "Space"]);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" && nearestRef.current) { router.push(`/artifacts/${nearestRef.current}`); return; }
      if (MOVE_CODES.has(e.code)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entered, router]);

  if (!entered) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 rounded-2xl bg-neutral-900 px-6 text-center text-white">
        <h2 className="text-2xl font-bold">{room.category} 전시실</h2>
        <p className="text-sm text-neutral-300">유물을 <b>실제 크기</b>로 전시합니다 — 사람 실루엣·바닥 격자(1m)로 크기를 가늠해 보세요.</p>
        <p className="text-xs text-neutral-400">
          대표 {room.shown}점{room.count > room.shown ? ` (분류 전체 ${room.count}점은 카탈로그에서)` : ""} · 약 {room.totalSizeMB}MB
        </p>
        <dl className="mt-1 grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-neutral-300">
          <dt className="font-semibold text-white">이동</dt><dd className="col-span-2 text-left">W·A·S·D 또는 ↑↓ · A·D(좌우)</dd>
          <dt className="font-semibold text-white">둘러보기</dt><dd className="col-span-2 text-left">← → 또는 Q·E</dd>
          <dt className="font-semibold text-white">관람</dt><dd className="col-span-2 text-left">유물에 다가가 Enter 또는 클릭</dd>
        </dl>
        <button type="button" onClick={() => setEntered(true)} className="mt-1 rounded-xl bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200">
          전시실 입장하기
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] overflow-hidden rounded-2xl bg-neutral-800">
      <KeyboardControls map={KEY_MAP}>
        <Canvas dpr={[1, 1.5]} camera={{ fov: 60, near: 0.1, far: 100, position: room.spawn.position }}>
          <color attach="background" args={["#0f0d0b"]} />
          <fog attach="fog" args={["#0f0d0b", 16, 40]} />
          <ambientLight intensity={0.85} />
          <hemisphereLight args={["#e6eeff", "#26201a", 0.7]} />
          <directionalLight position={[4, 8, 5]} intensity={2.2} />
          <directionalLight position={[-5, 6, -3]} intensity={0.9} />
          <Suspense fallback={<Loader />}>
            <RoomShell room={room} />
            <ScaleHuman x={1.8} z={room.spawn.position[2] + 3} />
            {room.placements.map((p) => (
              <Exhibit key={p.artifactId} placement={p} highlighted={p.artifactId === nearest} onPick={() => router.push(`/artifacts/${p.artifactId}`)} />
            ))}
          </Suspense>
          <Rig room={room} touch={touch} onNearest={(id) => { nearestRef.current = id; setNearest(id); }} />
        </Canvas>
      </KeyboardControls>

      <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/55 px-3 py-1.5 text-[11px] leading-relaxed text-white">
        <b>{room.category}</b> · 이동 <b>WASD·↑↓</b> · 회전 <b>←→·QE</b> · 관람 <b>Enter/클릭</b>
      </div>
      {nearestTitle && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <div className="rounded-full bg-sky-600 px-4 py-1.5 text-sm font-medium text-white shadow">
            {nearestTitle} — <kbd className="rounded bg-white/25 px-1">Enter</kbd> 자세히 보기
          </div>
        </div>
      )}
      <TouchPad touch={touch} />
    </div>
  );
}
