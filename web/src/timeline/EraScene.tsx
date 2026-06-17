"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Backdrop from "./backdrops";

/** 02-spec F9 — 양식화 배경 위에 실제 유물을 배치, 클릭하면 쓰임새를 보여주는 인터랙티브 생활 장면 */

export interface SceneItem {
  artifactId: string;
  title: string;
  imagePath?: string;
  usage?: string;
  role: string;
  x: number;
  y: number;
}
export interface EraSceneData {
  eraId: string;
  setting: string;
  title: string;
  items: SceneItem[];
}

export default function EraScene({ scene }: { scene: EraSceneData }) {
  const [sel, setSel] = useState(0);
  const active = scene.items[sel];

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200" aria-label={`${scene.eraId} 생활 장면`}>
      <div className="relative h-60 w-full select-none sm:h-72">
        <Backdrop setting={scene.setting} />
        <p className="absolute left-3 top-2 rounded bg-black/35 px-2 py-0.5 text-xs font-medium text-white">
          {scene.title}
        </p>
        {scene.items.map((it, i) => (
          <button
            key={it.artifactId}
            type="button"
            onClick={() => setSel(i)}
            aria-pressed={i === sel}
            aria-label={`${it.title} — ${it.role}, 쓰임새 보기`}
            className="absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
            style={{ left: `${it.x}%`, top: `${it.y}%` }}
          >
            <span
              className={`block overflow-hidden rounded-full border-2 bg-neutral-900 shadow-lg transition ${
                i === sel ? "border-sky-400 ring-2 ring-sky-300" : "border-white/80 hover:border-sky-300"
              }`}
            >
              <span className="relative block h-14 w-14 sm:h-16 sm:w-16">
                {it.imagePath ? (
                  <Image src={it.imagePath} alt={it.title} fill sizes="64px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] text-neutral-300">
                    {it.title}
                  </span>
                )}
              </span>
            </span>
            <span className="mt-1 block whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-center text-[10px] font-medium text-neutral-800 shadow">
              {it.role}
            </span>
          </button>
        ))}
      </div>

      {/* 선택된 유물 쓰임새 패널 */}
      <div className="flex items-start gap-3 bg-white p-3" aria-live="polite">
        <Link href={`/artifacts/${active.artifactId}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
          {active.imagePath && (
            <Image src={active.imagePath} alt={active.title} fill sizes="64px" className="object-cover" />
          )}
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/artifacts/${active.artifactId}`} className="font-semibold hover:underline">
              {active.title}
            </Link>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">{active.role}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-neutral-700">
            {active.usage ?? "이 유물의 쓰임새 정보를 준비 중입니다."}
          </p>
        </div>
      </div>
      <p className="bg-neutral-50 px-3 py-1.5 text-[11px] text-neutral-500">
        ※ 배경은 이해를 돕기 위한 양식화 그림이며, 유물 이미지·정보는 국립중앙박물관 소장품입니다.
      </p>
    </section>
  );
}
