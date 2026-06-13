"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import type { ExhibitPlacement, ResolvedExhibition } from "./exhibition";

/** 02-spec F6 가상 전시관 — AC-F6-1 ≥4점 배치 / AC-F6-2 시점이동·클릭이동 / AC-F6-3 사전 용량·진행률 */

const PEDESTAL_H = 1;
const DISPLAY_H = 2; // 정규화된 유물(반경 1)을 전시대 위에서 보여줄 목표 높이

function Pedestal() {
  return (
    <mesh position={[0, PEDESTAL_H / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.4, PEDESTAL_H, 1.4]} />
      <meshStandardMaterial color="#e7e5e4" roughness={0.85} />
    </mesh>
  );
}

function Exhibit({ placement, onPick }: { placement: ExhibitPlacement; onPick: () => void }) {
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

  // 모델은 로컬 바닥이 y=0이 되도록 정렬돼 있으므로, 전시대 윗면 높이만큼만 올린다
  const liftY = PEDESTAL_H;

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
      <primitive object={model} position={[0, liftY, 0]} />
      <Html position={[0, 0.35, 0.85]} center distanceFactor={10} occlude>
        <div
          className={`whitespace-nowrap rounded px-2 py-0.5 text-[11px] shadow transition ${
            hovered ? "bg-neutral-900 text-white" : "bg-white/90 text-neutral-700"
          }`}
        >
          {placement.title}
        </div>
      </Html>
    </group>
  );
}

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 14]} />
        <meshStandardMaterial color="#d6d3d1" roughness={1} />
      </mesh>
      <mesh position={[0, 4, -6]} receiveShadow>
        <planeGeometry args={[30, 8]} />
        <meshStandardMaterial color="#1c1917" roughness={1} />
      </mesh>
    </group>
  );
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

export default function ExhibitionRoom({ exhibition }: { exhibition: ResolvedExhibition }) {
  const router = useRouter();
  const [entered, setEntered] = useState(false);

  // AC-F6-3: 입장 전 총 용량 안내
  if (!entered) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 rounded-2xl bg-neutral-900 px-6 text-center text-white">
        <h2 className="text-2xl font-bold">{exhibition.title}</h2>
        <p className="max-w-md text-sm text-neutral-300">{exhibition.theme}</p>
        <p className="text-xs text-neutral-400">
          유물 {exhibition.placements.length}점 · 약 {exhibition.totalSizeMB}MB를 불러옵니다
        </p>
        <button
          type="button"
          onClick={() => setEntered(true)}
          className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200"
        >
          전시실 입장하기
        </button>
      </div>
    );
  }

  return (
    <div className="h-[70vh] overflow-hidden rounded-2xl bg-neutral-800">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 50, position: [0, 4.5, 17] }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 7]} intensity={1.8} castShadow />
        <directionalLight position={[-6, 6, -4]} intensity={0.5} />
        <Suspense fallback={<Loader />}>
          <Room />
          {exhibition.placements.map((p) => (
            <Exhibit
              key={p.artifactId}
              placement={p}
              onPick={() => router.push(`/artifacts/${p.artifactId}`)}
            />
          ))}
        </Suspense>
        <OrbitControls
          makeDefault
          enableDamping
          target={[0, 1.5, 0]}
          minDistance={4}
          maxDistance={20}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>
    </div>
  );
}
