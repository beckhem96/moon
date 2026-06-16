"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { categoryRank, eraRank, sortCategories, sortEras } from "./taxonomy";

/** 02-spec F2 유물 카탈로그 — AC-F2-1 그리드 / AC-F2-2 즉시 검색 / AC-F2-3 시대·분류·재질 필터 / AC-F2-4 빈 상태 */

export interface CatalogItem {
  id: string;
  title: string;
  titleHanja?: string;
  era: string;
  category: string;
  material: string;
  museum: string;
  mediaKind: "model" | "image";
  posterPath?: string;
}

type GroupBy = "era" | "category";

const SELECT =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400";

export default function CatalogBrowser({ items }: { items: CatalogItem[] }) {
  const [q, setQ] = useState("");
  const [era, setEra] = useState("");
  const [category, setCategory] = useState("");
  const [material, setMaterial] = useState("");
  const [mtype, setMtype] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("era");

  // 필터 옵션은 분류 체계 순서로 정렬해 노출 (시대=연대순, 분류=채택순)
  const eras = useMemo(() => sortEras([...new Set(items.map((i) => i.era))]), [items]);
  const categories = useMemo(
    () => sortCategories([...new Set(items.map((i) => i.category))]),
    [items],
  );
  const materials = useMemo(() => [...new Set(items.map((i) => i.material))], [items]);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (!q || i.title.includes(q.trim())) &&
          (!era || i.era === era) &&
          (!category || i.category === category) &&
          (!material || i.material === material) &&
          (!mtype || i.mediaKind === mtype),
      ),
    [items, q, era, category, material, mtype],
  );

  // 선택한 차원(시대순/분류별)으로 섹션 그룹화 — "시대별로, 유물 특징 별로 구분"
  const groups = useMemo(() => {
    const keyOf = (i: CatalogItem) => (groupBy === "era" ? i.era : i.category);
    const rankOf = (k: string) => (groupBy === "era" ? eraRank(k) : categoryRank(k));
    const map = new Map<string, CatalogItem[]>();
    for (const i of filtered) {
      const k = keyOf(i);
      const bucket = map.get(k);
      if (bucket) bucket.push(i);
      else map.set(k, [i]);
    }
    return [...map.entries()]
      .sort((a, b) => rankOf(a[0]) - rankOf(b[0]))
      .map(([key, list]) => ({
        key,
        // 그룹 내부도 보조 정렬: 시대 그룹은 분류순, 분류 그룹은 시대순으로 정돈
        items: [...list].sort((x, y) =>
          groupBy === "era"
            ? categoryRank(x.category) - categoryRank(y.category)
            : eraRank(x.era) - eraRank(y.era),
        ),
      }));
  }, [filtered, groupBy]);

  const reset = () => {
    setQ("");
    setEra("");
    setCategory("");
    setMaterial("");
    setMtype("");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
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
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="분류 필터"
          className={SELECT}
        >
          <option value="">모든 분류</option>
          {categories.map((v) => (
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
        <select value={mtype} onChange={(e) => setMtype(e.target.value)} aria-label="유형 필터" className={SELECT}>
          <option value="">모든 유형</option>
          <option value="model">3D 모델</option>
          <option value="image">이미지</option>
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-500" role="status">
          {filtered.length}점의 유물
        </p>
        <div
          className="inline-flex overflow-hidden rounded-lg border border-neutral-300 text-sm"
          role="group"
          aria-label="유물 구분 방식"
        >
          {(
            [
              ["era", "시대순"],
              ["category", "분류별"],
            ] as [GroupBy, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGroupBy(value)}
              aria-pressed={groupBy === value}
              className={`px-3 py-1.5 transition ${
                groupBy === value
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          <p>조건에 맞는 유물이 없습니다.</p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-sky-700 hover:underline"
            onClick={reset}
          >
            필터 초기화
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-8">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.key}>
              <h2 className="mb-3 flex items-baseline gap-2 border-b border-neutral-200 pb-1.5">
                <span className="text-base font-semibold text-neutral-800">{g.key}</span>
                <span className="text-xs text-neutral-500">{g.items.length}점</span>
              </h2>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {g.items.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/artifacts/${a.id}`}
                      className="group block overflow-hidden rounded-xl border border-neutral-200 transition hover:border-neutral-400 hover:shadow-md"
                    >
                      <div className="relative aspect-square bg-neutral-900">
                        <span
                          className={`absolute left-1.5 top-1.5 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            a.mediaKind === "model"
                              ? "bg-sky-700 text-white"
                              : "bg-white/90 text-neutral-700"
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
                          <div className="flex h-full items-center justify-center px-3 text-center text-sm text-neutral-400">
                            {a.title}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="truncate font-medium">{a.title}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {a.era} · {a.category}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">{a.material}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
