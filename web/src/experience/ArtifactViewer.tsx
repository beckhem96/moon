"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";

/** 02-spec F1: 회전·줌·진행률. 환경맵 CDN 의존 없이 조명만으로 구성(오프라인 안정). */

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

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url, true);
  return <primitive object={scene} />;
}

export default function ArtifactViewer({ glbPath, title }: { glbPath: string; title: string }) {
  const [webglFailed, setWebglFailed] = useState(false);

  if (webglFailed) {
    // AC-F1-3 폴백: 3D 미지원 환경에서도 안내 + (포스터는 T-06에서)
    return (
      <div className="flex h-[60vh] items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
        <p>이 브라우저에서는 3D 보기(WebGL)를 지원하지 않습니다. 아래 유물 정보를 확인해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="h-[60vh] overflow-hidden rounded-xl bg-neutral-900" aria-label={`${title} 3D 뷰어`}>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 45, position: [0, 0.5, 3] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", () => setWebglFailed(true));
        }}
        fallback={<div />}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, 2, -3]} intensity={0.8} />
        <Suspense fallback={<LoadingOverlay />}>
          <Bounds fit clip observe margin={1.15}>
            <Model url={glbPath} />
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enableDamping minDistance={0.3} />
      </Canvas>
    </div>
  );
}
