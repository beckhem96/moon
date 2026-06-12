"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

/** 02-spec F2 유물 카탈로그 — AC-F2-1 그리드 / AC-F2-2 즉시 검색 / AC-F2-3 필터 조합 / AC-F2-4 빈 상태 */

export interface CatalogItem {
  id: string;
  title: string;
  titleHanja?: string;
  era: string;
  material: string;
  museum: string;
  posterPath?: string;
}

const SELECT =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400";

export default function CatalogBrowser({ items }: { items: CatalogItem[] }) {
  const [q, setQ] = useState("");
  const [era, setEra] = useState("");
  const [material, setMaterial] = useState("");

  const eras = useMemo(() => [...new Set(items.map((i) => i.era))], [items]);
  const materials = useMemo(() => [...new Set(items.map((i) => i.material))], [items]);

  const filtered = items.filter(
    (i) =>
      (!q || i.title.includes(q.trim())) &&
      (!era || i.era === era) &&
      (!material || i.material === material),
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="유물 이름 검색…"
          aria-label="유물 이름 검색"
          className={`${SELECT} min-w-44 flex-1`}
        />
        <select value={era} onChange={(e) => setEra(e.target.value)} aria-label="시대 필터" className={SELECT}>
          <option value="">모든 시대</option>
          {eras.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          aria-label="재질 필터"
          className={SELECT}
        >
          <option value="">모든 재질</option>
          {materials.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-sm text-neutral-500" role="status">
        {filtered.length}점의 유물
      </p>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          <p>조건에 맞는 유물이 없습니다.</p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-sky-600 hover:underline"
            onClick={() => {
              setQ("");
              setEra("");
              setMaterial("");
            }}
          >
            필터 초기화
          </button>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((a) => (
            <li key={a.id}>
              <Link
                href={`/artifacts/${a.id}`}
                className="group block overflow-hidden rounded-xl border border-neutral-200 transition hover:border-neutral-400 hover:shadow-md"
              >
                <div className="relative aspect-square bg-neutral-900">
                  {a.posterPath ? (
                    <Image
                      src={a.posterPath}
                      alt={`${a.title} 3D 렌더 이미지`}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-3 text-center text-sm text-neutral-400">
                      {a.title}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {a.era} · {a.material}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
