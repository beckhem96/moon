"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import EraScene, { type EraSceneData } from "./EraScene";

/** 02-spec F9 시대 타임라인 — 시대별 배경 + 유물을 클릭해 탐색 (3D·이미지 혼합) */

export interface TimelineArtifact {
  id: string;
  title: string;
  category: string;
  mediaKind: "model" | "image";
  posterPath?: string;
}
export interface TimelineEra {
  id: string;
  range: string;
  summary: string;
  life: string;
  artifacts: TimelineArtifact[];
}

export default function TimelineView({
  eras,
  scenes = {},
}: {
  eras: TimelineEra[];
  scenes?: Record<string, EraSceneData>;
}) {
  const [open, setOpen] = useState<string>(eras[0]?.id ?? "");

  return (
    <div>
      {/* 시대 점프 칩 */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {eras.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              setOpen(e.id);
              document.getElementById(`era-${e.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              open === e.id
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
            }`}
          >
            {e.id}
          </button>
        ))}
      </div>

      {/* 타임라인 */}
      <ol className="relative ml-3 border-l-2 border-neutral-200">
        {eras.map((e) => {
          const isOpen = open === e.id;
          return (
            <li key={e.id} id={`era-${e.id}`} className="mb-4 scroll-mt-20 pl-6">
              <span
                className={`absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-white ${
                  isOpen ? "bg-sky-600" : "bg-neutral-400"
                }`}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => setOpen(isOpen ? "" : e.id)}
                aria-expanded={isOpen}
                className="flex w-full items-baseline gap-3 rounded-lg py-1 text-left"
              >
                <span className="text-lg font-bold text-neutral-900">{e.id}</span>
                <span className="text-xs text-neutral-500">{e.range}</span>
                <span className="ml-auto text-xs text-neutral-500">
                  유물 {e.artifacts.length}점 {isOpen ? "▲" : "▼"}
                </span>
              </button>

              <div
                className={`grid transition-all duration-300 ${
                  isOpen ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="rounded-xl bg-neutral-50 p-4">
                    <p className="leading-relaxed text-neutral-800">{e.summary}</p>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">{e.life}</p>
                  </div>

                  {scenes[e.id] && (
                    <div className="mt-4">
                      <h3 className="mb-2 text-sm font-semibold text-neutral-700">
                        이렇게 썼어요 — 생활 장면 <span className="font-normal text-neutral-500">(유물을 눌러보세요)</span>
                      </h3>
                      <EraScene scene={scenes[e.id]} />
                    </div>
                  )}

                  <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {e.artifacts.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/artifacts/${a.id}`}
                          className="group block overflow-hidden rounded-xl border border-neutral-200 transition hover:border-neutral-400 hover:shadow-md"
                        >
                          <div className="relative aspect-square bg-neutral-900">
                            <span
                              className={`absolute left-1.5 top-1.5 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                a.mediaKind === "model" ? "bg-sky-600 text-white" : "bg-white/85 text-neutral-700"
                              }`}
                            >
                              {a.mediaKind === "model" ? "3D" : "이미지"}
                            </span>
                            {a.posterPath ? (
                              <Image
                                src={a.posterPath}
                                alt={`${a.title} ${a.mediaKind === "model" ? "3D 렌더" : "대표"} 이미지`}
                                fill
                                sizes="(max-width: 640px) 50vw, 25vw"
                                className="object-cover transition group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center px-2 text-center text-xs text-neutral-300">
                                {a.title}
                              </div>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="truncate text-sm font-medium">{a.title}</p>
                            <p className="mt-0.5 text-xs text-neutral-500">{a.category}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
