import Link from "next/link";
import Image from "next/image";
import { artifactRepository } from "@/src/catalog/repository";

export default function Home() {
  const artifacts = artifactRepository.getAll();
  const featured = artifacts.filter((a) => a.featured).slice(0, 3);
  const avgReduction =
    Math.round(
      (artifacts.reduce((s, a) => s + a.asset.metrics.reductionPct, 0) / artifacts.length) * 10,
    ) / 10;

  return (
    <main className="mx-auto max-w-5xl px-4 py-14">
      <section className="text-center">
        <p className="text-sm font-medium tracking-wide text-sky-600">
          공공 3D 문화유산 데이터 × AI 도슨트
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-bold leading-snug sm:text-4xl">
          박물관 유리장 너머의 유물을,
          <br />
          지금 손끝에서 돌려보세요
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-neutral-500">
          국립중앙박물관이 개방한 3D 원천데이터를 웹에서 바로 체험할 수 있게 다듬었습니다.
          시공간 제약 없는 한국 문화유산 탐방. (가칭 moon)
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Link
            href="/artifacts"
            className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            유물 카탈로그 보기
          </Link>
          {featured[0] && (
            <Link
              href={`/artifacts/${featured[0].id}`}
              className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium transition hover:border-neutral-500"
            >
              대표 유물 바로 체험
            </Link>
          )}
        </div>
        <p className="mt-5 text-xs text-neutral-400">
          유물 {artifacts.length}점 · 원본 대비 평균 {avgReduction}% 경량화로 모바일에서도 빠르게
        </p>
      </section>

      {featured.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-semibold">추천 유물</h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {featured.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/artifacts/${a.id}`}
                  className="group block overflow-hidden rounded-2xl border border-neutral-200 transition hover:border-neutral-400 hover:shadow-md"
                >
                  <div className="relative aspect-square bg-neutral-900">
                    {a.asset.posterPath ? (
                      <Image
                        src={a.asset.posterPath}
                        alt={`${a.title} 3D 렌더 이미지`}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-neutral-400">
                        {a.title}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-medium">{a.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {a.era} · {a.material} · {a.museum}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-16 border-t border-neutral-200 pt-6 text-xs leading-relaxed text-neutral-400">
        <p>
          3D 원천데이터·유물 정보: 국립중앙박물관 (공공누리 제1유형 — 출처표시). 유물별 상세 출처는
          각 유물 페이지에 표기됩니다.
        </p>
      </footer>
    </main>
  );
}
