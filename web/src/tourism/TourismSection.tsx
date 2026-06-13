"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { HeritageSite, TourismInfo } from "./acl";

/** 02-spec F5 관광지 연계 — AC-F5-1 지도 / AC-F5-2 주변 관광지 ≥3 / AC-F5-3 폴백 표기 / AC-F5-4 출처 */

const SiteMap = dynamic(() => import("./SiteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-400">
      지도를 불러오는 중…
    </div>
  ),
});

interface TourismResponse {
  source: "live" | "snapshot";
  collectedAt?: string;
  items: TourismInfo[];
}

const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`);

export default function TourismSection({ site }: { site: HeritageSite }) {
  const [data, setData] = useState<TourismResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/tourism?siteId=${site.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [site.id]);

  return (
    <section aria-label="연고지와 주변 여행 정보">
      <h2 className="text-lg font-semibold">직접 가서 만나기</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {site.relation}: <span className="font-medium text-neutral-700">{site.name}</span>
        {site.address && <span className="ml-1 text-neutral-400">({site.address})</span>}
      </p>

      <div className="mt-3">
        <SiteMap site={site} />
      </div>

      <h3 className="mt-5 text-sm font-semibold text-neutral-600">주변 가볼 만한 곳</h3>
      {failed ? (
        <p className="mt-2 text-sm text-neutral-400">관광정보를 일시적으로 불러올 수 없습니다.</p>
      ) : !data ? (
        <p className="mt-2 text-sm text-neutral-400">주변 관광정보를 불러오는 중…</p>
      ) : (
        <>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {data.items.slice(0, 6).map((t) => (
              <li key={t.contentId} className="overflow-hidden rounded-xl border border-neutral-200">
                {t.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 외부(visitkorea) 이미지
                  <img src={t.imageUrl} alt="" className="h-24 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-24 w-full bg-neutral-100" />
                )}
                <div className="p-2.5">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {fmtDist(t.distanceM)} · {t.address?.split("(")[0] ?? ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-neutral-400">
            관광정보 출처: 한국관광공사 TourAPI
            {data.source === "snapshot" && ` (네트워크 문제로 ${data.collectedAt} 수집본 표시 중)`}
          </p>
        </>
      )}
    </section>
  );
}
