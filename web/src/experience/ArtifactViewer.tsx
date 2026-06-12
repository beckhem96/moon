"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { CameraControls, Html, useGLTF, useProgress } from "@react-three/drei";
import type CameraControlsImpl from "camera-controls";

/**
 * 02-spec F1 유물 3D 뷰어
 * AC-F1-1 회전·줌·리셋 / AC-F1-2 진행률 / AC-F1-3 폴백 / AC-F1-4 풀스크린 / AC-F1-5 자동회전(기본 꺼짐)
 * 환경맵 CDN 의존 없이 조명만 사용(오프라인 안정). 렌더 완료 시 <html data-model-ready> 신호(포스터 촬영·E2E 검증용).
 */

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

function Model({ url, onReady }: { url: string; onReady: (scene: THREE.Object3D) => void }) {
  const { scene } = useGLTF(url, true);
  useEffect(() => {
    onReady(scene);
    document.documentElement.dataset.modelReady = "1";
    return () => {
      delete document.documentElement.dataset.modelReady;
    };
  }, [scene, onReady]);
  return <primitive object={scene} />;
}

function AutoRotate({
  controls,
  enabled,
}: {
  controls: React.RefObject<CameraControlsImpl | null>;
  enabled: boolean;
}) {
  useFrame((_, delta) => {
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
  heightClassName = "h-[60vh]",
}: {
  glbPath: string;
  title: string;
  posterPath?: string;
  /** 기본 60vh — 임베드 등 전체 화면 맥락에서 override */
  heightClassName?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleReady = useCallback((scene: THREE.Object3D) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const sphere = new THREE.Box3().setFromObject(scene).getBoundingSphere(new THREE.Sphere());
    // 모델 단위에 무관하게 클리핑되지 않도록 near/far를 크기 기준으로 설정
    const cam = controls.camera as THREE.PerspectiveCamera;
    cam.near = Math.max(sphere.radius / 100, 0.001);
    cam.far = sphere.radius * 50;
    cam.updateProjectionMatrix();
    controls.minDistance = sphere.radius * 0.45;
    controls.maxDistance = sphere.radius * 6;
    controls.fitToSphere(sphere, false);
    controls.saveState();
  }, []);

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
    // AC-F1-3 폴백: 포스터 + 안내 (메타데이터는 페이지 본문에서 항상 접근 가능)
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
          <Model url={glbPath} onReady={handleReady} />
        </Suspense>
        <CameraControls ref={controlsRef} makeDefault smoothTime={0.18} />
        <AutoRotate controls={controlsRef} enabled={autoRotate} />
      </Canvas>

      <div className="absolute right-2 top-2 flex gap-1.5">
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
        <button
          type="button"
          className={BTN}
          onClick={toggleFullscreen}
          aria-label="전체 화면 켜기/끄기"
        >
          {isFullscreen ? "축소" : "전체 화면"}
        </button>
      </div>
    </div>
  );
}
