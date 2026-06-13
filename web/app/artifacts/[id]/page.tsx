import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { artifactRepository } from "@/src/catalog/repository";
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
  return {
    title: `${artifact.title} — 3D 보기`,
    description: artifact.description.slice(0, 120),
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

  const { metrics } = artifact.asset;
  const fields: [string, string | undefined][] = [
    ["시대", artifact.era],
    ["재질", artifact.material],
    ["크기", artifact.dimensions],
    ["소장처", artifact.museum],
    ["소장품번호", artifact.collectionNo],
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← 목록으로
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        {artifact.title}
        {artifact.titleHanja && (
          <span className="ml-2 text-base font-normal text-neutral-400">{artifact.titleHanja}</span>
        )}
      </h1>

      <div className="mt-4">
        <ArtifactViewer
          glbPath={artifact.asset.glbPath}
          title={artifact.title}
          posterPath={artifact.asset.posterPath}
        />
        <p className="mt-1 text-right text-xs text-neutral-400">
          드래그로 회전 · 휠/핀치로 확대 — 3D {metrics.publishedSizeMB}MB (원본 대비 {metrics.reductionPct}% 경량화)
        </p>
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
          <p className="mt-1 text-xs text-neutral-400">메타데이터 출처: {artifact.sources.join(" · ")}</p>
        )}
      </footer>
    </main>
  );
}
