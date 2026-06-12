import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { artifactRepository } from "@/src/catalog/repository";
import ArtifactViewer from "@/src/experience/ArtifactViewer";

/** 02-spec F7(AC-F7-2) 뷰어 단독 임베드 — 포스터 촬영(scripts/poster.mjs)에도 사용 */

export function generateStaticParams() {
  return artifactRepository.getAll().map((a) => ({ id: a.id }));
}

export const metadata: Metadata = { robots: { index: false } };

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const artifact = artifactRepository.getById(id);
  if (!artifact) notFound();

  return (
    <main className="relative h-dvh w-dvw bg-neutral-900">
      <ArtifactViewer
        glbPath={artifact.asset.glbPath}
        title={artifact.title}
        posterPath={artifact.asset.posterPath}
        heightClassName="h-dvh"
      />
      {/* 헌법 §1-2: 임베드 화면에도 출처표시 */}
      <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/50 px-2 py-0.5 text-[11px] text-neutral-300">
        {artifact.title} — {artifact.attribution.provider} · 공공누리 제{artifact.attribution.kogl}유형
      </p>
    </main>
  );
}
