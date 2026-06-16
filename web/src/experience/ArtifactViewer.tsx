"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { CameraControls, Html, useGLTF, useProgress, useTexture } from "@react-three/drei";
import type CameraControlsImpl from "camera-controls";
import { parseMaxCm } from "./scale";

/**
 * 02-spec F1 유물 3D 뷰어
 * AC-F1-1 회전·줌·리셋 / AC-F1-2 진행률 / AC-F1-3 폴백 / AC-F1-4 풀스크린 / AC-F1-5 자동회전(기본 꺼짐)
 * AC-F1-7 실제 크기 보기(사람 실루엣·눈금자 대조). 환경맵 CDN 의존 없이 조명만 사용(오프라인 안정).
 */

const VIEW_MAXDIM = 1.5; // 일반 모드에서 모델 최대 변을 이 유닛에 맞춤
const HUMAN_H = 1.7; // 대조용 성인 신장(m)

function LoadingOverlay() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="rounded-lg bg-black/70 px-4 py-2 text-sm text-white tabular-nums">
        유물 불러오는 중… {Math.round(progress)}%
      </div>
    </Html>
  );
}

/** GLB을 바닥(y=0)·중심(x,z=0)으로 재정렬하고, 정규화 좌표의 크기를 부모에 보고 */
function Model({
  url,
  onMeasured,
}: {
  url: string;
  onMeasured: (size: THREE.Vector3) => void;
}) {
  const { scene } = useGLTF(url, true);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -box.min.y, -center.z); // 바닥 원점화
    onMeasured(size);
    return clone;
  }, [scene, onMeasured]);
  useEffect(() => {
    document.documentElement.dataset.modelReady = "1";
    return () => {
      delete document.documentElement.dataset.modelReady;
    };
  }, []);
  return <primitive object={object} />;
}

/** 실제 크기 대조: 사람 실루엣 + 눈금자 + 바닥 (단위 m) */
function ScaleReference({ objWidth, objHeight, maxCm }: { objWidth: number; objHeight: number; maxCm: number }) {
  const tex = useTexture("/human-silhouette.png");
  const humanX = objWidth / 2 + 0.55;
  const rulerX = -(objWidth / 2 + 0.3);
  const top = Math.max(objHeight, HUMAN_H);
  // 눈금: 10cm 간격, 50cm마다 라벨
  const ticks = useMemo(() => {
    const arr: { y: number; major: boolean; label?: string }[] = [];
    for (let cm = 0; cm <= Math.ceil((top * 100) / 10) * 10; cm += 10) {
      const major = cm % 50 === 0;
      arr.push({ y: cm / 100, major, label: major ? (cm >= 100 ? `${cm / 100}m` : `${cm}`) : undefined });
    }
    return arr;
  }, [top]);
  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[Math.max(objWidth, 1.2) * 1.6, 48]} />
        <meshStandardMaterial color="#e7e5e4" roughness={1} />
      </mesh>
      {/* 사람 실루엣(약 170cm) */}
      <mesh position={[humanX, HUMAN_H / 2, 0]}>
        <planeGeometry args={[HUMAN_H * 0.4, HUMAN_H]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} />
      </mesh>
      <Html position={[humanX, HUMAN_H + 0.12, 0]} center distanceFactor={6}>
        <div className="whitespace-nowrap rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-neutral-700">약 170cm 성인</div>
      </Html>
      {/* 눈금자 */}
      <mesh position={[rulerX, top / 2, 0]}>
        <boxGeometry args={[0.012, top, 0.012]} />
        <meshStandardMaterial color="#0ea5e9" />
      </mesh>
      {ticks.map((t) => (
        <mesh key={t.y} position={[rulerX - (t.major ? 0.07 : 0.04) / 2, t.y, 0]}>
          <boxGeometry args={[t.major ? 0.07 : 0.04, 0.006, 0.006]} />
          <meshStandardMaterial color="#0ea5e9" />
        </mesh>
      ))}
      {ticks.filter((t) => t.label).map((t) => (
        <Html key={`l${t.y}`} position={[rulerX - 0.16, t.y, 0]} center distanceFactor={6}>
          <div className="whitespace-nowrap text-[9px] text-sky-700">{t.label}</div>
        </Html>
      ))}
      {/* 유물 실치수 라벨 */}
      <Html position={[0, objHeight + 0.1, 0]} center distanceFactor={6}>
        <div className="whitespace-nowrap rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
          실측 약 {maxCm}cm
        </div>
      </Html>
    </group>
  );
}

function AutoRotate({
  controls,
  enabled,
}: {
  controls: React.RefObject<CameraControlsImpl | null>;
  enabled: boolean;
}) {
  useFrame((_, delta) => {
    // camera-controls는 명령형 mutation이 정상 사용법 (ref.current 속성 변경)
    // eslint-disable-next-line react-hooks/immutability
    if (enabled && controls.current) controls.current.azimuthAngle += delta * 0.4;
  });
  return null;
}

const BTN =
  "rounded-md bg-black/55 px-2.5 py-1.5 text-xs text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

export default function ArtifactViewer({
  glbPath,
  title,
  posterPath,
  dimensions,
  heightClassName = "h-[60vh]",
}: {
  glbPath: string;
  title: string;
  posterPath?: string;
  /** 실제 크기 보기용 치수 문자열 (예: "높이 46cm…") */
  dimensions?: string;
  /** 기본 60vh — 임베드 등 전체 화면 맥락에서 override */
  heightClassName?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [realScale, setRealScale] = useState(false);
  const [size, setSize] = useState<THREE.Vector3 | null>(null);

  const maxCm = useMemo(() => parseMaxCm(dimensions), [dimensions]);
  const onMeasured = useCallback((s: THREE.Vector3) => setSize(s.clone()), []);

  // 모델 정규화 최대 변
  const maxDim = size ? Math.max(size.x, size.y, size.z) : 1;
  // 실제 크기: 최대 변을 maxCm(m)로, 일반: VIEW_MAXDIM 유닛으로
  const scale = realScale && maxCm ? maxCm / 100 / maxDim : VIEW_MAXDIM / maxDim;
  const objW = size ? size.x * scale : 1;
  const objH = size ? size.y * scale : 1;

  // 모드/크기 변화 시 카메라 핏
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || !size) return;
    const top = realScale ? Math.max(objH, HUMAN_H) : objH;
    const halfW = realScale ? objW / 2 + 1.0 : Math.max(objW, objH) / 2;
    const center = new THREE.Vector3(realScale ? 0.2 : 0, top / 2, 0);
    const radius = Math.hypot(halfW, top / 2) * 1.15 + 0.2;
    const cam = c.camera as THREE.PerspectiveCamera;
    cam.near = Math.max(radius / 100, 0.001);
    cam.far = radius * 50;
    cam.updateProjectionMatrix();
    c.minDistance = radius * 0.4;
    c.maxDistance = radius * 8;
    void c.fitToSphere(new THREE.Sphere(center, radius), true);
    c.saveState();
  }, [size, realScale, objW, objH]);

  const reset = useCallback(() => controlsRef.current?.reset(true), []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // 비기능 §4 접근성: 키보드 조작 — 화살표 회전, +/- 줌, R 리셋
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const c = controlsRef.current;
    if (!c) return;
    const step = Math.PI / 16;
    const dolly = c.distance * 0.18;
    const map: Record<string, () => void> = {
      ArrowLeft: () => c.rotate(-step, 0, true),
      ArrowRight: () => c.rotate(step, 0, true),
      ArrowUp: () => c.rotate(0, -step / 2, true),
      ArrowDown: () => c.rotate(0, step / 2, true),
      "+": () => c.dolly(dolly, true),
      "=": () => c.dolly(dolly, true),
      "-": () => c.dolly(-dolly, true),
      r: () => void c.reset(true),
      R: () => void c.reset(true),
    };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  }, []);

  if (webglFailed) {
    return (
      <div className={`flex ${heightClassName} flex-col items-center justify-center gap-3 rounded-xl bg-neutral-100 p-6 text-center text-neutral-600`}>
        {posterPath && (
          // eslint-disable-next-line @next/next/no-img-element -- 정적 폴백 이미지
          <img src={posterPath} alt={`${title} 3D 렌더 이미지`} className="max-h-[70%] rounded-lg" />
        )}
        <p className="text-sm">이 환경에서는 3D 보기(WebGL)를 지원하지 않아 이미지를 표시합니다.</p>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="application"
      aria-label={`${title} 3D 뷰어 — 화살표 키로 회전, +/- 키로 확대·축소, R 키로 원위치`}
      onKeyDown={onKeyDown}
      className={`relative ${heightClassName} overflow-hidden rounded-xl bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400`}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 45, position: [0, 0.5, 3] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", () => setWebglFailed(true));
        }}
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">
            3D 초기화 실패 — 새로고침하거나 다른 브라우저를 이용해 주세요.
          </div>
        }
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, 2, -3]} intensity={0.8} />
        <Suspense fallback={<LoadingOverlay />}>
          <group scale={scale}>
            <Model url={glbPath} onMeasured={onMeasured} />
          </group>
          {realScale && maxCm && size && (
            <ScaleReference objWidth={objW} objHeight={objH} maxCm={maxCm} />
          )}
        </Suspense>
        <CameraControls ref={controlsRef} makeDefault smoothTime={0.18} />
        <AutoRotate controls={controlsRef} enabled={autoRotate} />
      </Canvas>

      <div className="absolute right-2 top-2 flex gap-1.5">
        {maxCm && (
          <button
            type="button"
            className={BTN}
            onClick={() => setRealScale((v) => !v)}
            aria-pressed={realScale}
            aria-label="실제 크기 보기 켜기/끄기"
          >
            {realScale ? "크게 보기" : "실제 크기"}
          </button>
        )}
        <button type="button" className={BTN} onClick={reset} aria-label="시점 원위치">
          원위치
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() => setAutoRotate((v) => !v)}
          aria-pressed={autoRotate}
          aria-label="자동 회전 켜기/끄기"
        >
          {autoRotate ? "회전 멈춤" : "자동 회전"}
        </button>
        <button type="button" className={BTN} onClick={toggleFullscreen} aria-label="전체 화면 켜기/끄기">
          {isFullscreen ? "축소" : "전체 화면"}
        </button>
      </div>
    </div>
  );
}
