import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { artifactRepository } from "@/src/catalog/repository";
import { posterOf } from "@/src/catalog/schema";
import { getRelated } from "@/src/catalog/related";
import ArtifactViewer from "@/src/experience/ArtifactViewer";
import DocentChat from "@/src/docent/DocentChat";
import TourismSection from "@/src/tourism/TourismSection";
import { getSiteById } from "@/src/tourism/repository";

export function generateStaticParams() {
  return artifactRepository.getAll().map((a) => ({ id: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const artifact = artifactRepository.getById(id);
  if (!artifact) return {};
  const description = artifact.description.slice(0, 120);
  return {
    title: `${artifact.title} — 3D 보기`,
    description,
    // AC-F7-1: 카톡·슬랙 등 링크 공유 시 미리보기 (포스터 이미지)
    openGraph: {
      title: `${artifact.title} | moon`,
      description,
      images: posterOf(artifact) ? [{ url: posterOf(artifact)! }] : [],
      type: "website",
    },
  };
}

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const artifact = artifactRepository.getById(id);
  if (!artifact) notFound();

  const fields: [string, string | undefined][] = [
    ["시대", artifact.era],
    ["재질", artifact.material],
    ["크기", artifact.dimensions],
    ["소장처", artifact.museum],
    ["소장품번호", artifact.collectionNo],
  ];

  // 비기능 §4 SEO: schema.org VisualArtwork 구조화 데이터
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: artifact.title,
    description: artifact.description,
    artMedium: artifact.material,
    dateCreated: artifact.era,
    ...(artifact.dimensions ? { size: artifact.dimensions } : {}),
    locationCreated: artifact.museum,
    image: posterOf(artifact),
    isAccessibleForFree: true,
    license: "https://www.kogl.or.kr/info/licenseType1.do",
    creditText: `${artifact.attribution.provider} (공공누리 제${artifact.attribution.kogl}유형)`,
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link href="/artifacts" className="text-sm text-neutral-500 hover:underline">
        ← 목록으로
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        {artifact.title}
        {artifact.titleHanja && (
          <span className="ml-2 text-base font-normal text-neutral-500">{artifact.titleHanja}</span>
        )}
      </h1>

      <div className="mt-4">
        {artifact.asset.kind === "model" ? (
          <>
            <ArtifactViewer
              glbPath={artifact.asset.glbPath}
              title={artifact.title}
              posterPath={artifact.asset.posterPath}
              dimensions={artifact.dimensions}
            />
            <p className="mt-1 text-right text-xs text-neutral-500">
              드래그로 회전 · 휠/핀치로 확대 · &quot;실제 크기&quot;로 실물 치수 비교 — 3D{" "}
              {artifact.asset.metrics.publishedSizeMB}MB (원본 대비{" "}
              {artifact.asset.metrics.reductionPct}% 경량화)
            </p>
          </>
        ) : (
          <figure>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-900">
              <Image
                src={artifact.asset.imagePath}
                alt={`${artifact.title} 대표 이미지`}
                fill
                sizes="(max-width: 896px) 100vw, 896px"
                className="object-contain"
                priority
              />
            </div>
            <figcaption className="mt-1 text-right text-xs text-neutral-500">
              이미지 자료 — 국립중앙박물관 소장품(공공누리 제{artifact.attribution.kogl}유형)
            </figcaption>
          </figure>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
        {fields.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-medium text-neutral-500">{k}</dt>
            <dd>{v ?? "정보 없음"}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 leading-relaxed">{artifact.description}</p>

      {artifact.usage && (
        <div className="mt-5 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-sky-900">
            <span aria-hidden>🛠️</span> 쓰임새 — 이렇게 썼어요
          </h2>
          <p className="mt-1.5 leading-relaxed text-neutral-700">{artifact.usage}</p>
        </div>
      )}

      <div className="mt-8">
        <DocentChat artifactId={artifact.id} suggestedQuestions={artifact.suggestedQuestions} />
      </div>

      {artifact.siteId && (() => {
        const site = getSiteById(artifact.siteId);
        return site ? (
          <div className="mt-8">
            <TourismSection site={site} />
          </div>
        ) : null;
      })()}

      {(() => {
        const related = getRelated(artifact.id);
        return related.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">
              비슷한 유물 <span className="text-xs font-normal text-neutral-500">· AI 의미 임베딩 추천</span>
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/artifacts/${r.id}`}
                    className="group block overflow-hidden rounded-xl border border-neutral-200 transition hover:border-neutral-400 hover:shadow-md"
                  >
                    <div className="relative aspect-square bg-neutral-900">
                      <span
                        className={`absolute left-1 top-1 z-10 rounded px-1 py-0.5 text-[9px] font-semibold ${
                          r.mediaKind === "model" ? "bg-sky-700 text-white" : "bg-white/90 text-neutral-700"
                        }`}
                      >
                        {r.mediaKind === "model" ? "3D" : "이미지"}
                      </span>
                      {r.posterPath && (
                        <Image src={r.posterPath} alt={r.title} fill sizes="(max-width:640px) 33vw, 16vw" className="object-cover transition group-hover:scale-105" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-medium">{r.title}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">{r.era} · {r.category}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null;
      })()}

      {/* 출처표시 — 헌법 §1-2: 유물 상세 노출 필수 */}
      <footer className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <p>
          본 3D 데이터·유물 정보의 출처는{" "}
          <a
            href={artifact.attribution.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
          >
            {artifact.attribution.provider}
          </a>
          이며, 공공누리 제{artifact.attribution.kogl}유형(출처표시)에 따라 이용했습니다.
        </p>
        {artifact.sources.length > 0 && (
          <p className="mt-1 text-xs text-neutral-500">메타데이터 출처: {artifact.sources.join(" · ")}</p>
        )}
      </footer>
    </main>
  );
}
