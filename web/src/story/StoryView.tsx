"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Html, useProgress } from "@react-three/drei";

/** 02-spec F10 역사 이야기 — 스크롤에 따라 sticky 무대(3D/이미지)가 전환되는 스크롤리텔링. */

export interface StoryStep {
  artifactId: string;
  text: string;
  kind: "model" | "image";
  title: string;
  glbPath?: string;
  imagePath?: string;
}
export interface StoryChapter {
  id: string;
  title: string;
  subtitle: string;
  intro: string;
  steps: StoryStep[];
}

function SpinModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, true);
  const ref = useRef<THREE.Group>(null);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const fit = 2.4 / Math.max(size.x, size.y, size.z);
    clone.position.set(-center.x, -center.y, -center.z);
    const g = new THREE.Group();
    g.add(clone);
    g.scale.setScalar(fit);
    return g;
  }, [scene]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.5;
  });
  return <group ref={ref}><primitive object={model} /></group>;
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="rounded bg-black/60 px-3 py-1 text-xs text-white tabular-nums">{Math.round(progress)}%</div>
    </Html>
  );
}

function Stage({ step }: { step: StoryStep }) {
  return (
    <div className="relative h-[58vh] overflow-hidden rounded-2xl bg-neutral-900 md:h-[70vh]">
      {step.kind === "model" && step.glbPath ? (
        <Canvas dpr={[1, 1.5]} camera={{ fov: 45, position: [0, 0.3, 4] }} key={step.glbPath}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 4, 5]} intensity={2.2} />
          <directionalLight position={[-4, 2, -3]} intensity={0.8} />
          <Suspense fallback={<Loader />}>
            <SpinModel url={step.glbPath} />
          </Suspense>
        </Canvas>
      ) : step.imagePath ? (
        <Image src={step.imagePath} alt={step.title} fill sizes="(max-width:768px) 100vw, 50vw" className="object-contain" />
      ) : (
        <div className="flex h-full items-center justify-center text-neutral-400">{step.title}</div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-3">
        <span className="text-sm font-medium text-white">{step.title}</span>
        <Link href={`/artifacts/${step.artifactId}`} className="pointer-events-auto rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-neutral-900 hover:bg-white">
          자세히 보기 →
        </Link>
      </div>
    </div>
  );
}

export default function StoryView({ chapter }: { chapter: StoryChapter }) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = Number((e.target as HTMLElement).dataset.idx);
            setActive(i);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [chapter.id]);

  return (
    <div className="relative grid gap-x-8 md:grid-cols-2">
      {/* 무대 (sticky) */}
      <div className="order-1 md:order-2">
        <div className="sticky top-20">
          <Stage step={chapter.steps[active]} />
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {chapter.steps.map((s, i) => (
              <span key={s.artifactId} className={`h-1.5 flex-1 rounded-full transition ${i === active ? "bg-sky-600" : "bg-neutral-200"}`} />
            ))}
          </div>
        </div>
      </div>

      {/* 스크롤 텍스트 */}
      <div className="order-2 md:order-1">
        {chapter.steps.map((step, i) => (
          <div
            key={step.artifactId}
            data-idx={i}
            ref={(el) => { stepRefs.current[i] = el; }}
            className="flex min-h-[68vh] flex-col justify-center py-6"
          >
            <span className="text-sm font-semibold text-sky-700">
              {String(i + 1).padStart(2, "0")} · {step.title}
            </span>
            <p className="mt-2 text-lg leading-relaxed text-neutral-800">{step.text}</p>
            <Link href={`/artifacts/${step.artifactId}`} className="mt-3 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-900 md:hidden">
              이 유물 자세히 보기 →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
