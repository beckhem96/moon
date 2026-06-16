"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, KeyboardControls, useGLTF, useKeyboardControls, useProgress } from "@react-three/drei";
import { type ExhibitPlacement, type ResolvedExhibition } from "./exhibition";

/** 02-spec F6 가상 전시관 — AC-F6-1 ≥4점 / AC-F6-2 시점이동·클릭이동 / AC-F6-3 사전 용량·진행률
 *  개편: OrbitControls → 키보드 1인칭 보행 + 분류별 구역(zone) 관람 + 근접 유물 Enter 선택. */

const PEDESTAL_H = 1;
const DISPLAY_H = 2; // 정규화된 유물(반경 1)을 전시대 위에서 보여줄 목표 높이
const MOVE_SPEED = 5; // m/s
const TURN_SPEED = 1.8; // rad/s
const NEAR_DIST = 6; // 복도를 지날 때 양옆 벽(x=±4.5)의 가장 가까운 유물이 "Enter로 보기" 대상이 되도록

type MoveKey =
  | "forward"
  | "back"
  | "strafeLeft"
  | "strafeRight"
  | "turnLeft"
  | "turnRight";

type TouchInput = Record<MoveKey, boolean>;

const KEY_MAP = [
  { name: "forward", keys: ["KeyW", "ArrowUp"] },
  { name: "back", keys: ["KeyS", "ArrowDown"] },
  { name: "strafeLeft", keys: ["KeyA"] },
  { name: "strafeRight", keys: ["KeyD"] },
  { name: "turnLeft", keys: ["ArrowLeft", "KeyQ"] },
  { name: "turnRight", keys: ["ArrowRight", "KeyE"] },
];

function Pedestal() {
  return (
    <mesh position={[0, PEDESTAL_H / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.4, PEDESTAL_H, 1.4]} />
      <meshStandardMaterial color="#e7e5e4" roughness={0.85} />
    </mesh>
  );
}

function Exhibit({
  placement,
  highlighted,
  onPick,
}: {
  placement: ExhibitPlacement;
  highlighted: boolean;
  onPick: () => void;
}) {
  const { scene } = useGLTF(placement.glbPath);
  const [hovered, setHovered] = useState(false);

  // 캐시된 씬을 변형하지 않도록 복제 후, 전시대 위에 바닥을 맞춰 정렬
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const fit = DISPLAY_H / Math.max(size.x, size.y, size.z);
    const g = new THREE.Group();
    clone.position.set(-center.x, -center.y + size.y / 2, -center.z); // 바닥 원점화
    g.add(clone);
    g.scale.setScalar(fit * placement.scale);
    return g;
  }, [scene, placement.scale]);

  const active = highlighted || hovered;

  return (
    <group
      position={placement.position}
      rotation={[0, placement.rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <Pedestal />
      {/* 모델은 로컬 바닥이 y=0이 되도록 정렬돼 있으므로, 전시대 윗면 높이만큼만 올린다 */}
      <primitive object={model} position={[0, PEDESTAL_H, 0]} />
      {/* 근접/호버 시 바닥 강조 링 */}
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.1, 1.35, 48]} />
          <meshBasicMaterial color="#0ea5e9" transparent opacity={0.9} />
        </mesh>
      )}
      <Html position={[0, 0.35, 0.85]} center distanceFactor={10} occlude>
        <div
          className={`whitespace-nowrap rounded px-2 py-0.5 text-[11px] shadow transition ${
            active ? "bg-neutral-900 text-white" : "bg-white/90 text-neutral-700"
          }`}
        >
          {placement.title}
          {highlighted ? " · Enter" : ""}
        </div>
      </Html>
    </group>
  );
}

function ZoneSign({ category, count, position }: { category: string; count: number; position: [number, number, number] }) {
  return (
    <Html position={position} center distanceFactor={14} occlude={false}>
      <div className="whitespace-nowrap rounded-lg bg-neutral-900/85 px-4 py-1.5 text-center text-white shadow-lg">
        <p className="text-sm font-bold tracking-wide">{category}</p>
        <p className="text-[11px] text-neutral-300">{count}점</p>
      </div>
    </Html>
  );
}

const WALL_X = 5.7;
const WALL_H = 8;

/** 유물별 집중 조명 — 박물관 스포트라이트 연출 (그림자 비용 없이 분위기) */
function Spot({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.SpotLight>(null);
  const tgt = useRef<THREE.Object3D>(null);
  useEffect(() => {
    if (ref.current && tgt.current) ref.current.target = tgt.current;
  }, []);
  return (
    <group>
      <spotLight
        ref={ref}
        position={[x * 0.7, WALL_H - 1, z]}
        angle={0.5}
        penumbra={0.8}
        intensity={90}
        distance={18}
        decay={1.4}
        color="#fff4e0"
      />
      <object3D ref={tgt} position={[x, 1.3, z]} />
    </group>
  );
}

function Hall({ exhibition }: { exhibition: ResolvedExhibition }) {
  const { bounds, hallLength, zones } = exhibition;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const length = hallLength + 8;
  return (
    <group>
      {/* 바닥 — 어두운 광택 마감 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, centerZ]} receiveShadow>
        <planeGeometry args={[WALL_X * 2, length]} />
        <meshStandardMaterial color="#26211d" roughness={0.55} metalness={0.1} />
      </mesh>
      {/* 구역 입구 바닥 발광 띠로 분류 구역을 구분·강조 */}
      {zones.map((z) => (
        <mesh key={z.category} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z.startZ]}>
          <planeGeometry args={[WALL_X * 2 - 0.4, 0.25]} />
          <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      ))}
      {/* 좌우 벽 (높게) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * WALL_X, WALL_H / 2, centerZ]} rotation={[0, (-s * Math.PI) / 2, 0]} receiveShadow>
          <planeGeometry args={[length, WALL_H]} />
          <meshStandardMaterial color="#14110f" roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* 천장 */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, centerZ]}>
        <planeGeometry args={[WALL_X * 2, length]} />
        <meshStandardMaterial color="#0c0a09" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* 막다른 벽 */}
      <mesh position={[0, WALL_H / 2, bounds.maxZ + 2]} receiveShadow>
        <planeGeometry args={[WALL_X * 2, WALL_H]} />
        <meshStandardMaterial color="#1c1917" roughness={1} />
      </mesh>
      {/* 유물별 스포트라이트 (좌우 벽면) */}
      {exhibition.placements.map((p) => (
        <Spot key={p.artifactId} x={p.position[0]} z={p.position[2]} />
      ))}
    </group>
  );
}

/** 1인칭 보행 컨트롤러: 키보드 + 터치 입력으로 카메라를 이동·회전하고, 근접 유물을 알린다 */
function Rig({
  exhibition,
  touch,
  onNearest,
}: {
  exhibition: ResolvedExhibition;
  touch: React.RefObject<TouchInput>;
  onNearest: (id: string | null) => void;
}) {
  const { camera } = useThree();
  const [, getKeys] = useKeyboardControls();
  const pos = useRef(new THREE.Vector3(...exhibition.spawn.position));
  const yaw = useRef(exhibition.spawn.yaw);
  const lastNearest = useRef<string | null>(null);
  const eyeY = exhibition.spawn.position[1]; // 1인칭 시선 높이(레이아웃이 정의)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05); // 탭 전환 후 큰 점프 방지
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

    // 복도 밖으로 나가지 않도록 클램프
    const b = exhibition.bounds;
    pos.current.x = THREE.MathUtils.clamp(pos.current.x, b.minX, b.maxX);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z, b.minZ, b.maxZ);

    camera.position.set(pos.current.x, eyeY, pos.current.z);
    camera.lookAt(pos.current.x + fwd.x, eyeY, pos.current.z + fwd.z);

    // 가장 가까운(임계 내) 전시물 탐색 → 부모에 알림(변경 시에만)
    let nearestId: string | null = null;
    let best = NEAR_DIST;
    for (const p of exhibition.placements) {
      const dx = p.position[0] - pos.current.x;
      const dz = p.position[2] - pos.current.z;
      const d = Math.hypot(dx, dz);
      if (d < best) {
        best = d;
        nearestId = p.artifactId;
      }
    }
    if (nearestId !== lastNearest.current) {
      lastNearest.current = nearestId;
      onNearest(nearestId);
    }
  });

  return null;
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="rounded-lg bg-black/70 px-4 py-2 text-sm text-white tabular-nums">
        전시실 불러오는 중… {Math.round(progress)}%
      </div>
    </Html>
  );
}

/** 화면 하단 온스크린 D-패드(터치/마우스) — 키보드가 없는 환경 폴백 */
function TouchPad({ touch }: { touch: React.RefObject<TouchInput> }) {
  const press = (key: MoveKey, v: boolean) => {
    // ref.current 변경은 의도된 동작(입력 상태 보관) — 불변성 규칙 예외
    // eslint-disable-next-line react-hooks/immutability
    touch.current[key] = v;
  };
  const btn =
    "select-none touch-none flex h-12 w-12 items-center justify-center rounded-lg bg-white/85 text-lg font-bold text-neutral-800 shadow active:bg-sky-200";
  const bind = (key: MoveKey) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      press(key, true);
    },
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

export default function ExhibitionRoom({ exhibition }: { exhibition: ResolvedExhibition }) {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [nearest, setNearest] = useState<string | null>(null);
  const nearestRef = useRef<string | null>(null);
  const touch = useRef<TouchInput>({
    forward: false,
    back: false,
    strafeLeft: false,
    strafeRight: false,
    turnLeft: false,
    turnRight: false,
  });

  const nearestTitle = useMemo(
    () => exhibition.placements.find((p) => p.artifactId === nearest)?.title ?? null,
    [exhibition.placements, nearest],
  );

  const handleNearest = (id: string | null) => {
    nearestRef.current = id;
    setNearest(id);
  };

  // Enter로 근접 유물 상세 이동 + 보행 키의 페이지 스크롤 방지 (입장 후에만)
  useEffect(() => {
    if (!entered) return;
    const MOVE_CODES = new Set([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyQ",
      "KeyE",
      "Space",
    ]);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" && nearestRef.current) {
        router.push(`/artifacts/${nearestRef.current}`);
        return;
      }
      if (MOVE_CODES.has(e.code)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entered, router]);

  // AC-F6-3: 입장 전 총 용량 안내 + 조작 안내
  if (!entered) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 rounded-2xl bg-neutral-900 px-6 text-center text-white">
        <h2 className="text-2xl font-bold">{exhibition.title}</h2>
        <p className="max-w-md text-sm text-neutral-300">{exhibition.theme}</p>
        <p className="text-xs text-neutral-400">
          유물 {exhibition.placements.length}점 · {exhibition.zones.length}개 분류 구역 · 약{" "}
          {exhibition.totalSizeMB}MB를 불러옵니다
        </p>
        <dl className="mt-1 grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-neutral-300">
          <dt className="font-semibold text-white">이동</dt>
          <dd className="col-span-2 text-left">W·A·S·D 또는 ↑↓ (앞뒤) · A·D (좌우)</dd>
          <dt className="font-semibold text-white">둘러보기</dt>
          <dd className="col-span-2 text-left">← → 또는 Q·E (회전)</dd>
          <dt className="font-semibold text-white">관람</dt>
          <dd className="col-span-2 text-left">유물에 다가가 Enter, 또는 클릭</dd>
        </dl>
        <button
          type="button"
          onClick={() => setEntered(true)}
          className="mt-1 rounded-xl bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200"
        >
          전시실 입장하기
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] overflow-hidden rounded-2xl bg-neutral-800">
      <KeyboardControls map={KEY_MAP}>
        <Canvas dpr={[1, 1.5]} camera={{ fov: 60, near: 0.1, far: 200, position: exhibition.spawn.position }}>
          <color attach="background" args={["#08070a"]} />
          <fog attach="fog" args={["#08070a", 14, 48]} />
          <ambientLight intensity={0.3} />
          <hemisphereLight args={["#cfe0ff", "#1a140e", 0.4]} />
          <Suspense fallback={<Loader />}>
            <Hall exhibition={exhibition} />
            {exhibition.zones.map((z) => (
              <ZoneSign
                key={z.category}
                category={z.category}
                count={z.count}
                position={z.signPosition}
              />
            ))}
            {exhibition.placements.map((p) => (
              <Exhibit
                key={p.artifactId}
                placement={p}
                highlighted={p.artifactId === nearest}
                onPick={() => router.push(`/artifacts/${p.artifactId}`)}
              />
            ))}
          </Suspense>
          <Rig exhibition={exhibition} touch={touch} onNearest={handleNearest} />
        </Canvas>
      </KeyboardControls>

      {/* 상시 조작 힌트 */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/55 px-3 py-1.5 text-[11px] leading-relaxed text-white">
        이동 <b>WASD·↑↓</b> · 회전 <b>←→·QE</b> · 관람 <b>Enter/클릭</b>
      </div>

      {/* 근접 유물 안내 */}
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
